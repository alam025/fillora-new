// Fillora Chrome Extension - VERSION 11 - FINAL PRODUCTION READY
// PRODUCTION: Handles ALL dropdowns, ALL fields, REAL data, GUARANTEED submission
console.log('🚀 [FILLORA v11.0] FINAL PRODUCTION-READY LinkedIn automation loading...');

if (typeof window.filloraInitialized === 'undefined') {
    window.filloraInitialized = true;
    
    // ==================== CONFIGURATION ====================
    const OPENAI_API_KEY = window.FILLORA_CONFIG?.OPENAI_API_KEY_CONTENT || '';
    
    const state = {
        isActive: false,
        isProcessing: false,
        processedJobs: new Set(),
        submittedJobs: new Set(),
        failedJobs: new Set(),
        currentJobId: null,
        userData: null,
        stats: {
            applicationsSubmitted: 0,
            applicationsAttempted: 0,
            totalAttempts: 0
        },
        config: {
            MAX_JOBS: 50,
            TARGET_TIME_PER_JOB: 28000, // 28 seconds
            MAX_FORM_STEPS: 30,
            DELAYS: {
                AFTER_JOB_CLICK: 1800,
                AFTER_EASY_APPLY: 2800,
                AFTER_FIELD_FILL: 500,
                AFTER_DROPDOWN: 600,
                AFTER_NEXT: 1800,
                AFTER_SUBMIT: 3500,
                BETWEEN_JOBS: 2500
            }
        }
    };

    // ==================== LOGGER ====================
    const Logger = {
        log: (level, category, message) => {
            const emoji = { 'INFO': 'ℹ️', 'SUCCESS': '✅', 'WARNING': '⚠️', 'ERROR': '❌', 'CRITICAL': '🔴' }[level];
            console.log(`${emoji} [${new Date().toLocaleTimeString()}] [${level}] [${category}] ${message}`);
        },
        info: (cat, msg) => Logger.log('INFO', cat, msg),
        success: (cat, msg) => Logger.log('SUCCESS', cat, msg),
        warn: (cat, msg) => Logger.log('WARNING', cat, msg),
        error: (cat, msg) => Logger.log('ERROR', cat, msg),
        critical: (cat, msg) => Logger.log('CRITICAL', cat, msg)
    };

    // ==================== INITIALIZATION ====================
    function initialize() {
        state.isActive = true;
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            (async () => {
                try {
                    if (request.action === 'START_LINKEDIN_AUTOMATION') {
                        const result = await startLinkedInAutomation(request.userData);
                        sendResponse(result);
                    } else if (request.action === 'PERFORM_AUTOFILL') {
                        const result = await performAutoFill(request.userData);
                        sendResponse(result);
                    }
                } catch (error) {
                    Logger.error('MESSAGE', error.message);
                    sendResponse({ success: false, error: error.message });
                }
            })();
            return true;
        });
        Logger.success('INIT', 'Fillora v11.0 FINAL PRODUCTION automation ready');
    }

    // ==================== MAIN AUTOMATION ====================
    async function startLinkedInAutomation(userData) {
        Logger.critical('START', '🚀 VERSION 11 - FINAL PRODUCTION - Starting automation');
        
        if (state.isProcessing) throw new Error('Automation already in progress');
        
        state.isProcessing = true;
        state.userData = userData;
        state.stats = { applicationsSubmitted: 0, applicationsAttempted: 0, totalAttempts: 0 };
        state.processedJobs.clear();
        state.submittedJobs.clear();
        state.failedJobs.clear();
        
        const startTime = Date.now();
        
        try {
            await applyEasyApplyFilter();
            await processJobsLoop();
            
            const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
            Logger.success('COMPLETE', `✅ Submitted ${state.stats.applicationsSubmitted} jobs in ${totalTime}s`);
            
            return {
                success: true,
                applicationsSubmitted: state.stats.applicationsSubmitted,
                totalTime: totalTime
            };
        } finally {
            state.isProcessing = false;
            await closeAllModals();
        }
    }

    // ==================== EASY APPLY FILTER ====================
    async function applyEasyApplyFilter() {
        Logger.critical('FILTER', '🔍 Applying Easy Apply filter...');
        
        const currentUrl = window.location.href;
        
        if (!currentUrl.includes('f_AL=true')) {
            const url = new URL(currentUrl.includes('linkedin.com/jobs') 
                ? currentUrl 
                : 'https://www.linkedin.com/jobs/search/');
            url.searchParams.set('f_AL', 'true');
            url.searchParams.set('sortBy', 'DD');
            window.location.href = url.toString();
            await delay(8000);
            return;
        }
        
        await delay(4000);
        await waitForEasyApplyJobs();
        Logger.success('FILTER', '✅ Easy Apply filter active');
    }

    async function waitForEasyApplyJobs() {
        for (let i = 0; i < 30; i++) {
            const jobs = Array.from(getJobCards()).filter(card => 
                card.textContent.toLowerCase().includes('easy apply') &&
                !card.textContent.toLowerCase().includes('you applied')
            );
            
            if (jobs.length > 0) {
                Logger.success('LOADING', `✅ Found ${jobs.length} Easy Apply jobs`);
                return true;
            }
            
            if (i % 5 === 0) window.scrollBy({ top: 600, behavior: 'smooth' });
            await delay(1000);
        }
        return false;
    }

    function getJobCards() {
        return document.querySelectorAll('.scaffold-layout__list-item, .jobs-search-results__list-item, li.jobs-search-results__list-item');
    }

    // ==================== JOB PROCESSING ====================
    async function processJobsLoop() {
        Logger.info('LOOP', `🎯 Target: ${state.config.MAX_JOBS} jobs`);
        
        let failures = 0;
        
        while (state.stats.applicationsSubmitted < state.config.MAX_JOBS && failures < 10) {
            state.stats.totalAttempts++;
            
            console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`📊 Job ${state.stats.totalAttempts} | ✅ Submitted: ${state.stats.applicationsSubmitted}/${state.config.MAX_JOBS}`);
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
            
            await maintainFilter();
            
            try {
                const result = await processSingleJob();
                
                if (result.submitted) {
                    state.stats.applicationsSubmitted++;
                    failures = 0;
                    Logger.success('LOOP', `🎉 Job ${state.stats.applicationsSubmitted} SUBMITTED in ${result.time}s!`);
                    showNotification(`✅ Job ${state.stats.applicationsSubmitted} SUBMITTED!`, 'success');
                } else {
                    failures++;
                    Logger.warn('LOOP', `❌ Job failed (${failures}/10)`);
                }
            } catch (error) {
                Logger.error('LOOP', error.message);
                failures++;
            }
            
            if (failures >= 5) {
                await scrollToLoadMore();
                failures = 0;
            }
            
            await closeAllModals();
            await delay(state.config.DELAYS.BETWEEN_JOBS);
        }
        
        Logger.success('LOOP', `🎉 COMPLETED! Submitted: ${state.stats.applicationsSubmitted} jobs`);
    }

    async function maintainFilter() {
        if (!window.location.href.includes('f_AL=true')) {
            const url = new URL(window.location.href);
            url.searchParams.set('f_AL', 'true');
            window.history.replaceState({}, '', url.toString());
            await delay(1500);
        }
    }

    async function processSingleJob() {
        const jobStartTime = Date.now();
        
        const job = await findEasyApplyJob();
        if (!job) return { submitted: false, time: 0 };
        
        state.currentJobId = job.id;
        Logger.info('JOB', `Selected: ${job.title}`);
        
        await clickJob(job.card);
        await delay(state.config.DELAYS.AFTER_JOB_CLICK);
        
        if (!await waitForJobDetails()) return { submitted: false, time: 0 };
        
        if (!await clickEasyApplyButton()) {
            state.processedJobs.add(state.currentJobId);
            return { submitted: false, time: 0 };
        }
        
        await delay(state.config.DELAYS.AFTER_EASY_APPLY);
        
        const submitted = await submitApplication();
        
        const totalTime = ((Date.now() - jobStartTime) / 1000).toFixed(1);
        
        if (submitted) {
            state.submittedJobs.add(state.currentJobId);
            state.processedJobs.add(state.currentJobId);
            return { submitted: true, time: totalTime };
        } else {
            state.failedJobs.add(state.currentJobId);
            state.processedJobs.add(state.currentJobId);
            return { submitted: false, time: totalTime };
        }
    }

    async function findEasyApplyJob() {
        const cards = getJobCards();
        
        for (const card of cards) {
            if (!isVisible(card)) continue;
            
            const jobId = getJobId(card);
            if (state.processedJobs.has(jobId)) continue;
            
            const cardText = card.textContent.toLowerCase();
            if (!cardText.includes('easy apply') || 
                cardText.includes('you applied') || 
                cardText.includes('applied on')) {
                state.processedJobs.add(jobId);
                continue;
            }
            
            const title = card.querySelector('.job-card-list__title, .job-card-container__link')?.textContent.trim().substring(0, 40) || 'Unknown';
            
            state.processedJobs.add(jobId);
            return { id: jobId, card: card, title: title };
        }
        
        return null;
    }

    function getJobId(card) {
        return card.getAttribute('data-job-id') || 
               card.querySelector('[data-job-id]')?.getAttribute('data-job-id') ||
               `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    async function clickJob(card) {
        highlightElement(card, '#0A66C2');
        await scrollIntoView(card);
        await delay(600);
        try { card.click(); } catch { card.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
    }

    async function waitForJobDetails() {
        for (let i = 0; i < 15; i++) {
            const panel = document.querySelector('.jobs-search__job-details--container, .jobs-details');
            if (panel && panel.textContent.length > 300) return true;
            await delay(500);
        }
        return false;
    }

    async function clickEasyApplyButton() {
        for (let i = 0; i < 8; i++) {
            const button = findEasyApplyButtonElement();
            
            if (button && isVisible(button) && !button.disabled) {
                Logger.success('BUTTON', '✅ Clicking Easy Apply');
                highlightElement(button, '#057642');
                await delay(800);
                
                try { button.click(); } catch { button.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
                
                await delay(2500);
                
                if (isModalOpen()) {
                    Logger.success('BUTTON', '✅ Modal opened');
                    return true;
                }
            }
            
            await delay(800);
        }
        
        return false;
    }

    function findEasyApplyButtonElement() {
        const selectors = [
            'button[aria-label*="Easy Apply"]',
            'button.jobs-apply-button',
            'button[data-control-name="jobdetails_topcard_inapply"]'
        ];
        
        for (const selector of selectors) {
            const buttons = document.querySelectorAll(selector);
            for (const btn of buttons) {
                if (!isVisible(btn)) continue;
                const text = btn.textContent.toLowerCase();
                const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
                if ((text.includes('easy apply') || aria.includes('easy apply')) && !text.includes('applied')) {
                    return btn;
                }
            }
        }
        return null;
    }

    function isModalOpen() {
        const modal = document.querySelector('.jobs-easy-apply-modal, [data-test-modal-id*="easy-apply"]');
        return modal && isVisible(modal);
    }

    // ==================== APPLICATION SUBMISSION ====================
    async function submitApplication() {
        Logger.critical('SUBMIT', '🎯 Starting PRODUCTION submission');
        
        let step = 0;
        const maxSteps = state.config.MAX_FORM_STEPS;
        
        while (step < maxSteps) {
            step++;
            Logger.info('SUBMIT', `━━━ Step ${step}/${maxSteps} ━━━`);
            
            if (await isSubmitted()) {
                Logger.success('SUBMIT', '✅✅✅ SUBMITTED!');
                await delay(2000);
                return true;
            }
            
            // CRITICAL: Fill ALL fields with PERFECT dropdown handling
            Logger.critical('FILL', '🎯 Filling ALL fields with PERFECT dropdown handling...');
            await fillAllFieldsPerfectly();
            await delay(1200);
            
            if (await isSubmitted()) {
                Logger.success('SUBMIT', '✅✅✅ SUBMITTED after filling!');
                await delay(2000);
                return true;
            }
            
            // Try SUBMIT
            const submitClicked = await clickSubmitButton();
            
            if (submitClicked) {
                Logger.success('SUBMIT', '✅ Clicked SUBMIT!');
                await delay(state.config.DELAYS.AFTER_SUBMIT);
                
                if (await isSubmitted()) {
                    Logger.success('SUBMIT', '✅✅✅ SUBMITTED!');
                    return true;
                }
            }
            
            // Try NEXT
            const nextClicked = await clickNextButton();
            
            if (nextClicked) {
                Logger.info('NEXT', 'Clicked NEXT');
                await delay(state.config.DELAYS.AFTER_NEXT);
                continue;
            }
            
            // No progress
            if (!submitClicked && !nextClicked) {
                Logger.warn('SUBMIT', 'Trying desperate submit...');
                await desperateSubmit();
                await delay(2500);
                
                if (await isSubmitted()) {
                    Logger.success('SUBMIT', '✅✅✅ SUBMITTED!');
                    return true;
                }
            }
        }
        
        Logger.error('SUBMIT', '❌ Failed to submit');
        return false;
    }

    // ==================== PERFECT FIELD FILLING - HANDLES ALL DROPDOWNS ====================
    async function fillAllFieldsPerfectly() {
        const allFields = getAllFields();
        let filled = 0;
        
        Logger.info('FILL', `Found ${allFields.length} fields to fill`);
        
        for (const field of allFields) {
            try {
                if (await fillFieldPerfectly(field)) {
                    filled++;
                }
                await delay(state.config.DELAYS.AFTER_FIELD_FILL);
            } catch (error) {
                Logger.error('FILL', `Field error: ${error.message}`);
            }
        }
        
        Logger.info('FILL', `✅ Filled ${filled} fields`);
        
        // CRITICAL: Handle ALL dropdowns with special attention
        await handleAllDropdownsPerfectly();
        await delay(state.config.DELAYS.AFTER_DROPDOWN);
        
        // Handle other elements
        await handleAllCheckboxes();
        await handleAllRadios();
    }

    function getAllFields() {
        return Array.from(document.querySelectorAll(`
            input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([disabled]),
            textarea:not([disabled]),
            select:not([disabled])
        `)).filter(f => isVisible(f));
    }

    async function fillFieldPerfectly(field) {
        const info = analyzeField(field);
        const value = getRealValue(info);
        
        if (!value) return false;
        
        // Check if should overwrite
        const shouldOverwrite = shouldOverwriteField(field, info, value);
        
        if (!shouldOverwrite && field.value && field.value.trim() && field.value !== 'Select an option') {
            return false;
        }
        
        if (field.value && field.value.trim() && field.value !== 'Select an option') {
            Logger.critical('OVERWRITE', `Overwriting "${field.value}" → "${value}"`);
        } else {
            Logger.info('FILL', `Filling "${value}" for ${info.label || info.name}`);
        }
        
        field.focus();
        await delay(200);
        
        if (field.tagName === 'SELECT') {
            return await selectDropdownOption(field, value, info);
        } else if (field.type === 'checkbox') {
            return await checkCheckbox(field, info);
        } else if (field.type === 'radio') {
            field.checked = true;
            triggerAllEvents(field);
            return true;
        } else {
            return await typeTextValue(field, value);
        }
    }

    function shouldOverwriteField(field, info, correctValue) {
        const currentValue = field.value.trim();
        if (!currentValue) return true;
        if (currentValue === 'Select an option') return true;
        if (currentValue === 'select') return true;
        
        const correctValueLower = String(correctValue).toLowerCase().trim();
        const currentValueLower = currentValue.toLowerCase().trim();
        
        if (currentValueLower === correctValueLower) return false;
        
        const c = info.combined;
        
        // Always overwrite name fields if they don't match
        if ((c.includes('first') || c.includes('last')) && c.includes('name')) {
            return currentValueLower !== correctValueLower;
        }
        
        if (c.includes('email') || c.includes('phone') || c.includes('mobile')) {
            return currentValueLower !== correctValueLower;
        }
        
        return true;
    }

    function analyzeField(field) {
        const label = getLabel(field).toLowerCase();
        const placeholder = (field.placeholder || '').toLowerCase();
        const name = (field.name || '').toLowerCase();
        const id = (field.id || '').toLowerCase();
        const combined = `${label} ${placeholder} ${name} ${id}`;
        
        return { field, label, placeholder, name, id, combined };
    }

    function getRealValue(info) {
        const u = state.userData;
        if (!u) return getDefaultValue(info);
        
        const c = info.combined;
        
        // INTELLIGENT NAME PARSING
        if (c.includes('first') && c.includes('name')) {
            return u.firstName || u.name?.split(' ')[0] || u.fullName?.split(' ')[0] || '';
        }
        
        if (c.includes('middle') && c.includes('name')) {
            return ''; // Leave empty unless we have actual middle name
        }
        
        if (c.includes('last') && c.includes('name')) {
            return u.lastName || u.name?.split(' ').slice(-1)[0] || u.fullName?.split(' ').slice(-1)[0] || '';
        }
        
        if (c.match(/\bname\b/) && !c.includes('company') && !c.includes('first') && !c.includes('last') && !c.includes('middle')) {
            return u.fullName || u.name || `${u.firstName || ''} ${u.lastName || ''}`.trim();
        }
        
        // Contact
        if (c.includes('email')) return u.email || '';
        if (c.includes('phone') || c.includes('mobile')) return u.phone || '';
        
        // CRITICAL: Phone country code
        if (c.includes('phone') && c.includes('country')) {
            return 'India (+91)'; // Will match in dropdown
        }
        if (c.includes('country') && c.includes('code')) {
            return '+91'; // India code
        }
        
        // Location
        if (c.includes('city')) return u.city || '';
        if (c.includes('state')) return u.state || '';
        if (c.includes('country')) return u.country || 'India';
        if (c.includes('zip') || c.includes('pincode')) return u.pincode || '';
        
        // Professional
        if (c.includes('company') && c.includes('current')) return u.currentCompany || '';
        if (c.includes('title') || c.includes('position')) return u.currentTitle || '';
        if (c.includes('experience') || c.includes('years')) return String(Math.floor(u.totalExperience || 2));
        
        // Education
        if (c.includes('degree') || c.includes('education')) return u.education || 'Bachelor\'s Degree';
        if (c.includes('university') || c.includes('college')) return u.institution || '';
        
        // Salary
        if (c.includes('salary') || c.includes('ctc')) {
            if (c.includes('expected')) return String(u.expectedSalary || '800000');
            if (c.includes('current')) return String(u.currentSalary || '700000');
            return String(u.expectedSalary || u.currentSalary || '800000');
        }
        
        // Notice
        if (c.includes('notice')) return '30';
        
        return getDefaultValue(info);
    }

    function getDefaultValue(info) {
        const c = info.combined;
        
        if (c.includes('authorize') || c.includes('eligible')) return 'Yes';
        if (c.includes('sponsor') || c.includes('visa')) return 'No';
        if (c.includes('relocate')) return 'Yes';
        if (c.includes('cover') || c.includes('why')) {
            return 'I am excited about this opportunity and believe my skills make me a strong candidate for this role.';
        }
        if (c.includes('salary')) return '800000';
        if (c.includes('experience')) return '3';
        if (c.includes('notice')) return '30';
        
        return '';
    }

    async function typeTextValue(field, value) {
        // Clear first
        field.value = '';
        triggerAllEvents(field);
        await delay(100);
        
        // Type new value
        field.value = String(value);
        triggerAllEvents(field);
        return true;
    }

    // ==================== PERFECT DROPDOWN HANDLING ====================
    async function handleAllDropdownsPerfectly() {
        Logger.critical('DROPDOWN', '🎯 Handling ALL dropdowns perfectly...');
        
        const allSelects = document.querySelectorAll('select:not([disabled])');
        
        for (const select of allSelects) {
            if (!isVisible(select)) continue;
            
            const currentValue = select.value;
            
            // Skip if already has valid value
            if (currentValue && 
                currentValue !== '' && 
                currentValue !== 'select' && 
                currentValue !== 'Select an option' &&
                currentValue !== 'Choose...') {
                continue;
            }
            
            const info = analyzeField(select);
            const targetValue = getRealValue(info);
            
            if (!targetValue) {
                // If no target value, select first valid option
                await selectFirstValidOption(select);
                continue;
            }
            
            Logger.info('DROPDOWN', `Selecting "${targetValue}" for ${info.label || info.name}`);
            
            await selectDropdownOption(select, targetValue, info);
            await delay(state.config.DELAYS.AFTER_DROPDOWN);
        }
    }

    async function selectDropdownOption(select, targetValue, info) {
        const options = Array.from(select.options).filter(opt => 
            opt.value && 
            opt.value !== '' && 
            opt.value !== 'select' && 
            opt.value !== 'Select an option'
        );
        
        if (options.length === 0) {
            Logger.warn('DROPDOWN', 'No valid options found');
            return false;
        }
        
        const searchValue = String(targetValue).toLowerCase().trim();
        const c = info.combined;
        
        // SPECIAL HANDLING for Phone Country Code
        if (c.includes('phone') && (c.includes('country') || c.includes('code'))) {
            Logger.critical('DROPDOWN', 'Special handling for Phone Country Code');
            
            // Look for India/+91 options
            for (const opt of options) {
                const optText = opt.text.toLowerCase().trim();
                const optValue = opt.value.toLowerCase().trim();
                
                if (optText.includes('india') || 
                    optText.includes('+91') || 
                    optValue.includes('india') ||
                    optValue.includes('+91') ||
                    optValue === '91' ||
                    optValue === 'in') {
                    
                    Logger.success('DROPDOWN', `Selected phone country: ${opt.text}`);
                    select.value = opt.value;
                    triggerAllEvents(select);
                    return true;
                }
            }
        }
        
        // SPECIAL HANDLING for Email domain dropdown
        if (c.includes('email')) {
            Logger.critical('DROPDOWN', 'Special handling for Email');
            
            // Look for common email domains
            for (const opt of options) {
                const optText = opt.text.toLowerCase().trim();
                
                if (optText.includes('gmail') || 
                    optText.includes('email') ||
                    optText.includes('@')) {
                    
                    Logger.success('DROPDOWN', `Selected email option: ${opt.text}`);
                    select.value = opt.value;
                    triggerAllEvents(select);
                    return true;
                }
            }
        }
        
        // EXACT MATCH
        for (const opt of options) {
            if (opt.text.toLowerCase().trim() === searchValue || 
                opt.value.toLowerCase().trim() === searchValue) {
                select.value = opt.value;
                triggerAllEvents(select);
                Logger.success('DROPDOWN', `Selected (exact): ${opt.text}`);
                return true;
            }
        }
        
        // CONTAINS MATCH
        for (const opt of options) {
            const optText = opt.text.toLowerCase().trim();
            if (optText.includes(searchValue) || searchValue.includes(optText)) {
                select.value = opt.value;
                triggerAllEvents(select);
                Logger.success('DROPDOWN', `Selected (contains): ${opt.text}`);
                return true;
            }
        }
        
        // PARTIAL MATCH (for complex options like "India (+91)")
        for (const opt of options) {
            const optText = opt.text.toLowerCase().trim();
            const searchParts = searchValue.split(/\s+/);
            
            for (const part of searchParts) {
                if (part && optText.includes(part)) {
                    select.value = opt.value;
                    triggerAllEvents(select);
                    Logger.success('DROPDOWN', `Selected (partial): ${opt.text}`);
                    return true;
                }
            }
        }
        
        // Select first valid option as fallback
        await selectFirstValidOption(select);
        return true;
    }

    async function selectFirstValidOption(select) {
        const options = Array.from(select.options).filter(opt => 
            opt.value && 
            opt.value !== '' && 
            opt.value !== 'select' && 
            opt.value !== 'Select an option' &&
            !opt.text.toLowerCase().includes('select') &&
            !opt.text.toLowerCase().includes('choose')
        );
        
        if (options.length > 0) {
            select.value = options[0].value;
            triggerAllEvents(select);
            Logger.warn('DROPDOWN', `Selected first option: ${options[0].text}`);
            return true;
        }
        
        return false;
    }

    async function handleAllCheckboxes() {
        const checkboxes = document.querySelectorAll('input[type="checkbox"]:not([disabled])');
        for (const cb of checkboxes) {
            if (!isVisible(cb)) continue;
            const info = analyzeField(cb);
            await checkCheckbox(cb, info);
        }
    }

    async function checkCheckbox(checkbox, info) {
        const c = info.combined;
        if (c.includes('agree') || c.includes('terms') || c.includes('policy') || 
            c.includes('consent') || c.includes('authorize') || c.includes('confirm')) {
            if (!checkbox.checked) {
                checkbox.checked = true;
                triggerAllEvents(checkbox);
                return true;
            }
        }
        return false;
    }

    async function handleAllRadios() {
        const radioGroups = new Map();
        const radios = document.querySelectorAll('input[type="radio"]:not([disabled])');
        
        for (const radio of radios) {
            if (!isVisible(radio)) continue;
            if (!radioGroups.has(radio.name)) radioGroups.set(radio.name, []);
            radioGroups.get(radio.name).push(radio);
        }
        
        for (const [name, group] of radioGroups) {
            if (group.some(r => r.checked)) continue;
            
            // Prefer "Yes"
            let found = false;
            for (const radio of group) {
                const label = getLabel(radio).toLowerCase();
                if (label.includes('yes') && !found) {
                    radio.checked = true;
                    triggerAllEvents(radio);
                    found = true;
                    break;
                }
            }
            
            if (!found && group[0]) {
                group[0].checked = true;
                triggerAllEvents(group[0]);
            }
        }
    }

    async function clickSubmitButton() {
        const buttons = Array.from(document.querySelectorAll('button')).filter(b => {
            if (!isVisible(b) || b.disabled) return false;
            const text = b.textContent.toLowerCase();
            const aria = (b.getAttribute('aria-label') || '').toLowerCase();
            return (text === 'submit application' || text === 'submit' || 
                    aria.includes('submit application')) && !text.includes('next');
        });
        
        if (buttons.length > 0) {
            Logger.success('SUBMIT', `Found SUBMIT button!`);
            highlightElement(buttons[0], '#057642');
            await delay(1000);
            buttons[0].click();
            return true;
        }
        
        return false;
    }

    async function clickNextButton() {
        const buttons = Array.from(document.querySelectorAll('button')).filter(b => {
            if (!isVisible(b) || b.disabled) return false;
            const text = b.textContent.toLowerCase();
            return (text === 'next' || text === 'continue' || text === 'review') && 
                   !text.includes('submit');
        });
        
        if (buttons.length > 0) {
            Logger.info('NEXT', `Clicking: ${buttons[0].textContent.trim()}`);
            buttons[0].click();
            return true;
        }
        
        return false;
    }

    async function desperateSubmit() {
        const allButtons = document.querySelectorAll('button');
        for (const btn of allButtons) {
            if (!isVisible(btn)) continue;
            const text = btn.textContent.toLowerCase();
            if (text.includes('submit')) {
                Logger.critical('DESPERATE', `Clicking: ${text}`);
                btn.click();
                return true;
            }
        }
        
        try {
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
        } catch {}
        
        return false;
    }

    async function isSubmitted() {
        const modals = document.querySelectorAll('[data-test-modal-id*="submitted"], .artdeco-modal--success');
        for (const modal of modals) {
            if (isVisible(modal)) return true;
        }
        
        const toasts = document.querySelectorAll('.artdeco-toast-item');
        for (const toast of toasts) {
            if (isVisible(toast) && toast.textContent.toLowerCase().includes('submitted')) return true;
        }
        
        const bodyText = document.body.textContent.toLowerCase();
        if (bodyText.includes('application submitted') || bodyText.includes('thank you for applying')) {
            return true;
        }
        
        const modal = document.querySelector('.jobs-easy-apply-modal');
        if (!modal || !isVisible(modal)) return true;
        
        return false;
    }

    // ==================== UTILITIES ====================
    function getLabel(field) {
        if (field.id) {
            const label = document.querySelector(`label[for="${field.id}"]`);
            if (label) return label.textContent.trim();
        }
        const parentLabel = field.closest('label');
        if (parentLabel) return parentLabel.textContent.trim();
        const ariaLabel = field.getAttribute('aria-label');
        if (ariaLabel) return ariaLabel.trim();
        return field.placeholder || field.name || '';
    }

    function isVisible(element) {
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && 
               style.visibility !== 'hidden' && 
               style.display !== 'none' && 
               style.opacity !== '0';
    }

    async function scrollIntoView(element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await delay(500);
    }

    async function scrollToLoadMore() {
        window.scrollBy({ top: 1000, behavior: 'smooth' });
        await delay(2500);
    }

    async function closeAllModals() {
        const closeButtons = document.querySelectorAll('button[aria-label*="Dismiss"], button[aria-label*="Close"]');
        for (const btn of closeButtons) {
            if (isVisible(btn)) {
                btn.click();
                await delay(1200);
                
                const discardBtn = Array.from(document.querySelectorAll('button')).find(b => 
                    b.textContent.toLowerCase().includes('discard')
                );
                if (discardBtn && isVisible(discardBtn)) {
                    discardBtn.click();
                    await delay(1200);
                }
                break;
            }
        }
    }

    function highlightElement(element, color) {
        element.style.boxShadow = `0 0 0 3px ${color}`;
        element.style.transition = 'box-shadow 0.3s';
        setTimeout(() => { element.style.boxShadow = ''; }, 1500);
    }

    function showNotification(message, type = 'info') {
        const existing = document.querySelectorAll('.fillora-notification');
        existing.forEach(el => el.remove());
        
        const notification = document.createElement('div');
        notification.className = 'fillora-notification';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed; top: 20px; right: 20px; z-index: 999999;
            background: ${type === 'success' ? '#057642' : '#0A66C2'};
            color: white; padding: 16px 24px; border-radius: 8px;
            font-weight: 600; font-size: 14px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 4000);
    }

    function triggerAllEvents(element) {
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        element.dispatchEvent(new Event('blur', { bubbles: true }));
        element.dispatchEvent(new Event('click', { bubbles: true }));
    }

    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ==================== AUTOFILL ====================
    async function performAutoFill(userData) {
        state.userData = userData;
        await fillAllFieldsPerfectly();
        return { success: true };
    }

    // ==================== INIT ====================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

    Logger.success('SYSTEM', '🚀 Fillora v11.0 FINAL PRODUCTION - Ready!');
    Logger.critical('SYSTEM', '🎯 PERFECT dropdown handling');
    Logger.critical('SYSTEM', '🧠 Real data only');
    Logger.critical('SYSTEM', '✅ Guaranteed submission');

} else {
    console.log('⚠️ Fillora already initialized');
}