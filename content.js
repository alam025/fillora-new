// Fillora Chrome Extension - ULTIMATE LINKEDIN AUTOMATION
// Version: 5.0 - FAST + RELIABLE + COMPREHENSIVE
console.log('🚀 [FILLORA v5.0] Initializing ULTIMATE LinkedIn automation...');

if (typeof window.filloraInitialized === 'undefined') {
    window.filloraInitialized = true;
    
    // ==================== CONFIGURATION ====================
    const OPENAI_API_KEY = window.FILLORA_CONFIG?.OPENAI_API_KEY_CONTENT || '';
    
    const state = {
        isActive: false,
        isProcessing: false,
        processedJobs: new Set(),
        failedJobs: new Set(),
        currentJobId: null,
        userData: null,
        stats: {
            applicationsSubmitted: 0,
            applicationsAttempted: 0,
            applicationsSkipped: 0,
            totalAttempts: 0,
            errors: []
        },
        config: {
            MAX_JOBS: 50, // Increased limit
            MAX_ATTEMPTS: 200,
            JOB_TIMEOUT: 55000, // 55 seconds per job
            MAX_RETRIES_PER_JOB: 2,
            DELAYS: {
                AFTER_JOB_CLICK: 800,
                AFTER_EASY_APPLY: 1200,
                AFTER_FIELD_FILL: 50, // Reduced for speed
                AFTER_NEXT: 800,
                AFTER_SUBMIT: 2000,
                BETWEEN_JOBS: 1000,
                VERIFICATION: 1500,
                RETRY_DELAY: 1000
            }
        },
        fieldCache: new Map() // Cache field values for speed
    };

    // ==================== ENHANCED LOGGER ====================
    const Logger = {
        log: (level, category, message) => {
            const emoji = {
                'INFO': 'ℹ️',
                'SUCCESS': '✅',
                'WARNING': '⚠️',
                'ERROR': '❌',
                'SPEED': '⚡'
            }[level] || '📝';
            console.log(`${emoji} [${level}] [${category}] ${message}`);
        },
        info: (cat, msg) => Logger.log('INFO', cat, msg),
        success: (cat, msg) => Logger.log('SUCCESS', cat, msg),
        warn: (cat, msg) => Logger.log('WARNING', cat, msg),
        error: (cat, msg) => Logger.log('ERROR', cat, msg),
        speed: (cat, msg) => Logger.log('SPEED', cat, msg)
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
        
        Logger.success('INIT', 'Fillora ULTIMATE automation ready');
    }

    // ==================== MAIN AUTOMATION ENTRY ====================
    async function startLinkedInAutomation(userData) {
        Logger.info('AUTOMATION', '🚀 Starting ULTIMATE LinkedIn Easy Apply automation');
        
        if (state.isProcessing) {
            throw new Error('Automation already in progress');
        }
        
        state.isProcessing = true;
        state.userData = userData;
        state.stats = {
            applicationsSubmitted: 0,
            applicationsAttempted: 0,
            applicationsSkipped: 0,
            totalAttempts: 0,
            errors: []
        };
        state.processedJobs.clear();
        state.failedJobs.clear();
        state.fieldCache.clear();
        
        const startTime = Date.now();
        
        try {
            await ensureCorrectPage();
            const result = await processJobsMainLoop();
            
            const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
            const timePerJob = (totalTime / Math.max(1, state.stats.applicationsSubmitted)).toFixed(1);
            
            Logger.success('AUTOMATION', `✅ COMPLETED! Submitted: ${state.stats.applicationsSubmitted} jobs`);
            Logger.speed('AUTOMATION', `⏱️ Total: ${totalTime}s | Average: ${timePerJob}s per job`);
            
            return {
                success: true,
                applicationsSubmitted: state.stats.applicationsSubmitted,
                applicationsAttempted: state.stats.applicationsAttempted,
                applicationsSkipped: state.stats.applicationsSkipped,
                totalTime: totalTime,
                averageTimePerJob: timePerJob
            };
            
        } finally {
            state.isProcessing = false;
            await closeAllModals();
        }
    }

    // ==================== ENHANCED PAGE NAVIGATION ====================
    async function ensureCorrectPage() {
        const currentUrl = window.location.href;
        
        // Ensure we're on jobs page with Easy Apply filter
        if (!currentUrl.includes('linkedin.com/jobs') || !currentUrl.includes('f_AL=true')) {
            Logger.info('NAVIGATION', '🔍 Navigating to LinkedIn Easy Apply jobs...');
            
            // Direct navigation with Easy Apply filter
            window.location.href = 'https://www.linkedin.com/jobs/search/?f_AL=true&keywords=software%20engineer&location=India&sortBy=DD';
            await delay(6000);
        }
        
        // Wait for jobs to load with enhanced detection
        await waitForJobsToLoad();
        
        Logger.success('NAVIGATION', '✅ On LinkedIn Easy Apply jobs page');
    }
    
    async function waitForJobsToLoad() {
        Logger.info('LOADING', 'Waiting for jobs to load...');
        
        let attempts = 0;
        const maxAttempts = 25;
        
        while (attempts < maxAttempts) {
            const jobCards = getJobCards();
            
            if (jobCards.length > 0) {
                const easyApplyJobs = Array.from(jobCards).filter(card => 
                    card.textContent.toLowerCase().includes('easy apply')
                ).length;
                
                Logger.success('LOADING', `✅ Found ${jobCards.length} jobs (${easyApplyJobs} Easy Apply)`);
                return true;
            }
            
            // Scroll to trigger loading if no jobs found
            if (attempts % 5 === 0) {
                window.scrollBy(0, 500);
            }
            
            await delay(500);
            attempts++;
        }
        
        Logger.warn('LOADING', 'Jobs took longer than expected to load');
        return false;
    }

    function getJobCards() {
        return document.querySelectorAll([
            '.scaffold-layout__list-item',
            '.jobs-search-results__list-item',
            '.job-card-container',
            '[data-job-id]',
            '.job-card-list__entity-lockup'
        ].join(','));
    }

    // ==================== OPTIMIZED JOB PROCESSING LOOP ====================
    async function processJobsMainLoop() {
        Logger.info('LOOP', `🎯 Target: ${state.config.MAX_JOBS} successful submissions`);
        
        let consecutiveFailures = 0;
        let lastJobCount = 0;
        let noNewJobsCount = 0;
        
        while (state.stats.applicationsSubmitted < state.config.MAX_JOBS && 
               state.stats.totalAttempts < state.config.MAX_ATTEMPTS) {
            
            state.stats.totalAttempts++;
            
            console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`📊 ATTEMPT ${state.stats.totalAttempts} | ✅ Submitted: ${state.stats.applicationsSubmitted}/${state.config.MAX_JOBS}`);
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
            
            // Check if we're stuck with no new jobs
            const currentJobCount = getJobCards().length;
            if (currentJobCount === lastJobCount) {
                noNewJobsCount++;
                if (noNewJobsCount >= 3) {
                    Logger.warn('LOOP', 'No new jobs loading - scrolling for more');
                    await scrollToLoadMoreJobs();
                    noNewJobsCount = 0;
                }
            } else {
                noNewJobsCount = 0;
            }
            lastJobCount = currentJobCount;
            
            try {
                const jobStartTime = Date.now();
                const jobResult = await processNextJob();
                const jobTime = ((Date.now() - jobStartTime) / 1000).toFixed(1);
                
                if (jobResult.submitted) {
                    state.stats.applicationsSubmitted++;
                    state.stats.applicationsAttempted++;
                    consecutiveFailures = 0;
                    
                    Logger.success('LOOP', `🎉 Progress: ${state.stats.applicationsSubmitted}/${state.config.MAX_JOBS}`);
                    Logger.speed('LOOP', `⏱️ Job completed in ${jobTime}s`);
                    
                    showNotification(`✅ Job ${state.stats.applicationsSubmitted}/${state.config.MAX_JOBS} SUBMITTED in ${jobTime}s!`, 'success');
                } else {
                    state.stats.applicationsAttempted++;
                    consecutiveFailures++;
                    Logger.warn('LOOP', `Job failed - consecutive failures: ${consecutiveFailures}`);
                }
                
            } catch (error) {
                Logger.error('LOOP', `Error: ${error.message}`);
                state.stats.errors.push(error.message);
                consecutiveFailures++;
            }
            
            // Reset if too many consecutive failures
            if (consecutiveFailures >= 5) {
                Logger.warn('LOOP', 'Multiple consecutive failures - refreshing strategy');
                await scrollToLoadMoreJobs();
                consecutiveFailures = 0;
                await delay(2000);
            }
            
            await closeAllModals();
            await delay(state.config.DELAYS.BETWEEN_JOBS);
        }
        
        // Final summary
        Logger.success('LOOP', `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        Logger.success('LOOP', `🎉 ULTIMATE AUTOMATION COMPLETED!`);
        Logger.success('LOOP', `✅ Submitted: ${state.stats.applicationsSubmitted}`);
        Logger.success('LOOP', `📝 Attempted: ${state.stats.applicationsAttempted}`);
        Logger.success('LOOP', `⏭️  Skipped: ${state.stats.applicationsSkipped}`);
        Logger.success('LOOP', `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        
        return {
            submitted: state.stats.applicationsSubmitted,
            attempted: state.stats.applicationsAttempted,
            skipped: state.stats.applicationsSkipped
        };
    }

    // ==================== ENHANCED SINGLE JOB PROCESSING ====================
    async function processNextJob() {
        const maxRetries = state.config.MAX_RETRIES_PER_JOB;
        let retryCount = 0;
        
        while (retryCount < maxRetries) {
            try {
                // Step 1: Find and click on an Easy Apply job
                const job = await findAndClickEasyApplyJob();
                if (!job) {
                    Logger.warn('JOB', 'No Easy Apply jobs found');
                    await scrollToLoadMoreJobs();
                    retryCount++;
                    continue;
                }
                
                state.currentJobId = job.id;
                Logger.info('JOB', `Selected job: ${job.id.substring(0, 15)}... (Attempt ${retryCount + 1}/${maxRetries})`);
                
                await delay(state.config.DELAYS.AFTER_JOB_CLICK);
                
                // Step 2: Click "Easy Apply" button
                const easyApplyClicked = await clickEasyApplyButton();
                if (!easyApplyClicked) {
                    Logger.warn('JOB', 'Easy Apply button not found');
                    await closeAllModals();
                    retryCount++;
                    continue;
                }
                
                await delay(state.config.DELAYS.AFTER_EASY_APPLY);
                
                // Step 3: Submit application with enhanced timeout handling
                const submitted = await submitApplicationWithRetry();
                
                if (submitted) {
                    Logger.success('JOB', `✅ SUBMITTED successfully`);
                    return { submitted: true, skipped: false };
                } else {
                    Logger.warn('JOB', `⚠️ Attempt ${retryCount + 1} failed`);
                    await closeAllModals();
                    retryCount++;
                    
                    // Remove from processed set to allow retry
                    if (state.currentJobId) {
                        state.processedJobs.delete(state.currentJobId);
                    }
                    
                    await delay(state.config.DELAYS.RETRY_DELAY);
                }
                
            } catch (error) {
                Logger.error('JOB', `Error on attempt ${retryCount + 1}: ${error.message}`);
                await closeAllModals();
                retryCount++;
                await delay(state.config.DELAYS.RETRY_DELAY);
            }
        }
        
        // After max retries, mark as failed
        Logger.error('JOB', `❌ Failed after ${maxRetries} attempts`);
        if (state.currentJobId) {
            state.failedJobs.add(state.currentJobId);
        }
        
        return { submitted: false, skipped: false, reason: 'Max retries reached' };
    }

    async function submitApplicationWithRetry() {
        return Promise.race([
            submitApplicationComplete(),
            timeout(state.config.JOB_TIMEOUT, false)
        ]);
    }

    // ==================== ENHANCED JOB SELECTION ====================
    async function findAndClickEasyApplyJob() {
        const jobCards = getJobCards();
        
        for (const card of jobCards) {
            if (!isVisible(card)) continue;
            
            const jobId = getJobId(card);
            if (!jobId || state.processedJobs.has(jobId) || state.failedJobs.has(jobId)) {
                continue;
            }
            
            const cardText = card.textContent.toLowerCase();
            
            // Skip if already applied
            if (cardText.includes('you applied') || 
                cardText.includes('applied on') ||
                cardText.includes('application sent')) {
                state.processedJobs.add(jobId);
                continue;
            }
            
            // Must have "Easy Apply"
            if (!cardText.includes('easy apply')) {
                state.processedJobs.add(jobId);
                continue;
            }
            
            // Click the job card
            Logger.info('JOB_CLICK', `Clicking Easy Apply job`);
            highlightElement(card, '#0A66C2');
            await scrollIntoView(card);
            card.click();
            await delay(800);
            
            // Verify job details loaded
            const jobLoaded = await waitForJobDetails();
            if (!jobLoaded) {
                Logger.warn('JOB_CLICK', 'Job details not loading - skipping');
                continue;
            }
            
            state.processedJobs.add(jobId);
            return { id: jobId, element: card };
        }
        
        return null;
    }

    async function waitForJobDetails() {
        let attempts = 0;
        while (attempts < 10) {
            // Check if job details panel is visible and has content
            const jobPanel = document.querySelector('.jobs-search__job-details--container') ||
                           document.querySelector('.jobs-details') ||
                           document.querySelector('[data-job-id]');
            
            if (jobPanel && jobPanel.textContent && jobPanel.textContent.length > 100) {
                return true;
            }
            await delay(300);
            attempts++;
        }
        return false;
    }

    // ==================== ENHANCED EASY APPLY CLICK ====================
    async function clickEasyApplyButton() {
        await delay(600);
        
        const buttonSelectors = [
            'button[aria-label*="Easy Apply"]',
            'button[aria-label*="easy apply"]',
            'button.jobs-apply-button',
            'button[data-control-name="jobdetails_topcard_inapply"]'
        ];
        
        for (const selector of buttonSelectors) {
            const buttons = document.querySelectorAll(selector);
            for (const button of buttons) {
                if (!isVisible(button) || button.disabled) continue;
                
                const text = button.textContent.toLowerCase().trim();
                const aria = (button.getAttribute('aria-label') || '').toLowerCase();
                
                if ((text.includes('easy apply') || aria.includes('easy apply')) &&
                    !text.includes('applied on') &&
                    !aria.includes('application sent')) {
                    
                    Logger.info('BUTTON', `✅ Clicking "Easy Apply" button`);
                    highlightElement(button, '#057642');
                    await delay(200);
                    button.click();
                    return true;
                }
            }
        }
        
        return false;
    }

    // ==================== ULTIMATE APPLICATION SUBMISSION ====================
    async function submitApplicationComplete() {
        Logger.info('SUBMIT', '🚀 Starting ULTIMATE application submission');
        
        let currentStep = 0;
        const maxSteps = 15; // Reduced for speed
        
        while (currentStep < maxSteps) {
            currentStep++;
            
            // Check if already submitted
            if (await isApplicationSubmitted()) {
                Logger.success('SUBMIT', '✅ Application SUBMITTED successfully!');
                return true;
            }
            
            // FAST FIELD FILLING - Process all fields in parallel when possible
            await fillAllFieldsFast();
            
            // Handle dynamic content
            await handleDynamicContent();
            
            // Check again if submitted
            if (await isApplicationSubmitted()) {
                return true;
            }
            
            // Try to progress through application
            const progressed = await progressApplication();
            if (!progressed) {
                // No progression possible - might be done or stuck
                Logger.warn('SUBMIT', 'No progression possible - checking completion');
                await delay(800);
                
                if (await isApplicationSubmitted()) {
                    return true;
                }
                
                // If still not submitted and no progression, break
                break;
            }
        }
        
        // Final submission attempt
        if (await clickFinalSubmit()) {
            Logger.success('SUBMIT', '✅ Final submission successful!');
            return true;
        }
        
        Logger.error('SUBMIT', '❌ Max steps reached without submission');
        return false;
    }

    async function fillAllFieldsFast() {
        const fields = getAllVisibleFormFields();
        
        if (fields.length === 0) {
            return;
        }
        
        Logger.info('FILL', `Fast-filling ${fields.length} fields`);
        
        // Process fields in batches for speed
        const batchSize = 3;
        for (let i = 0; i < fields.length; i += batchSize) {
            const batch = fields.slice(i, i + batchSize);
            await Promise.all(batch.map(field => fillFieldUltraFast(field)));
            await delay(100); // Small delay between batches
        }
        
        // Handle special fields
        await handleAllDropdownsFast();
        await handleCheckboxesFast();
    }

    async function fillFieldUltraFast(field) {
        try {
            // Skip if already filled
            if (field.value && field.value.trim() && field.value !== 'select') {
                return;
            }
            
            const fieldKey = getFieldIdentifier(field);
            let value = state.fieldCache.get(fieldKey);
            
            if (!value) {
                const fieldInfo = analyzeField(field);
                value = await getBestValueForField(fieldInfo);
                state.fieldCache.set(fieldKey, value || '');
            }
            
            if (!value) return;
            
            // Ultra-fast filling
            if (field.tagName === 'SELECT') {
                await selectDropdownOptionFast(field, value);
            } else if (field.type === 'checkbox') {
                if (!field.checked) {
                    field.checked = true;
                    field.dispatchEvent(new Event('change', { bubbles: true }));
                }
            } else if (field.type === 'radio') {
                if (!field.checked) {
                    field.checked = true;
                    field.dispatchEvent(new Event('change', { bubbles: true }));
                }
            } else {
                field.value = value;
                field.dispatchEvent(new Event('input', { bubbles: true }));
            }
            
        } catch (error) {
            // Silent fail for speed
        }
    }

    function getFieldIdentifier(field) {
        return `${field.type}-${field.name}-${field.id}-${getFieldLabel(field)}`;
    }

    function analyzeField(field) {
        const label = getFieldLabel(field).toLowerCase();
        const placeholder = (field.placeholder || '').toLowerCase();
        const name = (field.name || '').toLowerCase();
        const id = (field.id || '').toLowerCase();
        
        return {
            type: field.type || field.tagName.toLowerCase(),
            label: label,
            name: name,
            placeholder: placeholder,
            id: id,
            combined: `${label} ${placeholder} ${name} ${id}`
        };
    }

    async function getBestValueForField(fieldInfo) {
        const u = state.userData;
        if (!u) return getSmartDefault(fieldInfo);
        
        const combined = fieldInfo.combined;
        
        // Name fields
        if (combined.includes('first') && combined.includes('name')) return u.firstName;
        if (combined.includes('last') && combined.includes('name')) return u.lastName;
        if (combined.match(/\bname\b/) && !combined.includes('company')) {
            return u.fullName || u.name || `${u.firstName || ''} ${u.lastName || ''}`.trim();
        }
        
        // Contact fields
        if (combined.includes('email')) return u.email;
        if (combined.includes('phone') || combined.includes('mobile')) return u.phone;
        
        // Location fields
        if (combined.includes('city')) return u.city;
        if (combined.includes('state')) return u.state;
        if (combined.includes('country')) return u.country || 'India';
        if (combined.includes('zip') || combined.includes('pincode')) return u.pincode;
        
        // Work fields
        if (combined.includes('company') && combined.includes('current')) return u.currentCompany;
        if (combined.includes('employer')) return u.currentCompany;
        if (combined.includes('title') || combined.includes('position')) return u.currentTitle;
        
        // Experience
        if ((combined.includes('experience') || combined.includes('years')) && 
            combined.includes('work')) {
            return String(Math.floor(u.totalExperience || 2));
        }
        
        // Salary
        if (combined.includes('salary') || combined.includes('ctc')) {
            return String(u.currentSalary || calculateExpectedSalary(u.totalExperience || 2));
        }
        
        // Notice period
        if (combined.includes('notice')) {
            return u.noticePeriod ? String(u.noticePeriod).replace(/\D/g, '') : '30';
        }
        
        return getSmartDefault(fieldInfo);
    }

    function getSmartDefault(fieldInfo) {
        const combined = fieldInfo.combined;
        
        if (combined.includes('salary') || combined.includes('ctc')) return '8';
        if (combined.includes('experience') && combined.includes('year')) return '3';
        if (combined.includes('notice')) return '30';
        if (combined.includes('relocate') || combined.includes('willing')) return 'Yes';
        if (combined.includes('sponsor') || combined.includes('visa')) return 'No';
        if (combined.includes('authorized') || combined.includes('eligible')) return 'Yes';
        if (fieldInfo.type === 'email') return 'user@example.com';
        if (fieldInfo.type === 'tel') return '+919876543210';
        if (fieldInfo.type === 'number') return '1';
        if (fieldInfo.type === 'url') return 'https://linkedin.com';
        
        return '1'; // Default fallback
    }

    async function selectDropdownOptionFast(select, targetValue) {
        const options = Array.from(select.options).filter(opt => 
            opt.value && opt.value !== '' && opt.value !== 'select'
        );
        
        if (options.length === 0) return false;
        
        const searchValue = String(targetValue).toLowerCase().trim();
        
        // Quick match attempts
        for (const opt of options) {
            const optText = opt.text.toLowerCase().trim();
            if (optText === searchValue || optText.includes(searchValue) || searchValue.includes(optText)) {
                select.value = opt.value;
                select.dispatchEvent(new Event('change', { bubbles: true }));
                return true;
            }
        }
        
        // Number match
        if (!isNaN(searchValue)) {
            const numValue = parseFloat(searchValue);
            for (const opt of options) {
                const optNum = parseFloat(opt.text);
                if (!isNaN(optNum) && Math.abs(optNum - numValue) < 2) {
                    select.value = opt.value;
                    select.dispatchEvent(new Event('change', { bubbles: true }));
                    return true;
                }
            }
        }
        
        // First valid option
        if (options[0]) {
            select.value = options[0].value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
        }
        
        return true;
    }

    async function handleAllDropdownsFast() {
        const dropdowns = document.querySelectorAll('select');
        await Promise.all(Array.from(dropdowns).map(handleDropdownFast));
    }

    async function handleDropdownFast(dropdown) {
        if (!isVisible(dropdown) || dropdown.disabled) return;
        if (dropdown.value && dropdown.value !== 'select' && dropdown.value !== '') return;
        
        await selectDropdownOptionFast(dropdown, '1'); // Default to first option
    }

    async function handleCheckboxesFast() {
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        
        for (const checkbox of checkboxes) {
            if (!isVisible(checkbox) || checkbox.checked || checkbox.disabled) continue;
            
            const label = getFieldLabel(checkbox).toLowerCase();
            if (label.includes('agree') || label.includes('terms') || label.includes('consent')) {
                checkbox.checked = true;
                checkbox.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
    }

    async function handleDynamicContent() {
        // Handle any dynamic content that might appear
        await delay(300);
    }

    async function progressApplication() {
        // Try SUBMIT first
        if (await clickSubmitButton()) {
            await delay(state.config.DELAYS.AFTER_SUBMIT);
            return true;
        }
        
        // Try NEXT/CONTINUE
        if (await clickNextButton()) {
            await delay(state.config.DELAYS.AFTER_NEXT);
            return true;
        }
        
        // Try any primary button
        if (await clickAnyPrimaryButton()) {
            await delay(1000);
            return true;
        }
        
        return false;
    }

    async function clickFinalSubmit() {
        if (await clickSubmitButton()) {
            await delay(2000);
            return await isApplicationSubmitted();
        }
        return false;
    }

    // ==================== ENHANCED BUTTON CLICKING ====================
    async function clickSubmitButton() {
        const buttons = getVisibleButtons();
        
        for (const btn of buttons) {
            const text = btn.textContent.toLowerCase().trim();
            const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
            const combined = text + ' ' + aria;
            
            if ((text === 'submit application' || text === 'submit' || combined.includes('submit application')) &&
                !combined.includes('next') && !combined.includes('continue')) {
                
                Logger.info('BUTTON', `✅ Clicking SUBMIT: "${text}"`);
                highlightElement(btn, '#057642');
                btn.click();
                return true;
            }
        }
        
        return false;
    }

    async function clickNextButton() {
        const buttons = getVisibleButtons();
        
        for (const btn of buttons) {
            const text = btn.textContent.toLowerCase().trim();
            const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
            const combined = text + ' ' + aria;
            
            if ((combined.includes('next') || combined.includes('continue') || combined.includes('review')) &&
                !combined.includes('submit') && !combined.includes('back')) {
                
                Logger.info('BUTTON', `➡️ Clicking NEXT: "${text}"`);
                highlightElement(btn, '#0A66C2');
                btn.click();
                return true;
            }
        }
        
        return false;
    }

    async function clickAnyPrimaryButton() {
        const buttons = getVisibleButtons();
        
        for (const btn of buttons) {
            const classes = btn.className.toLowerCase();
            const text = btn.textContent.toLowerCase().trim();
            
            if ((classes.includes('primary') || classes.includes('artdeco-button--primary')) && 
                !text.includes('back') && !text.includes('cancel')) {
                
                btn.click();
                return true;
            }
        }
        
        return false;
    }

    function getVisibleButtons() {
        return Array.from(document.querySelectorAll('button'))
            .filter(b => isVisible(b) && !b.disabled);
    }

    // ==================== ENHANCED SUBMISSION VERIFICATION ====================
    async function isApplicationSubmitted() {
        // Check multiple success indicators
        const successIndicators = [
            () => document.querySelector('[data-test-modal-id*="submitted"]'),
            () => document.querySelector('[data-test-modal-id*="application-submitted"]'),
            () => document.querySelector('.artdeco-toast-item--success'),
            () => {
                const bodyText = document.body.textContent.toLowerCase();
                return bodyText.includes('application submitted') || 
                       bodyText.includes('application sent');
            },
            () => {
                const modal = document.querySelector('.jobs-easy-apply-modal');
                return !modal || !isVisible(modal);
            }
        ];
        
        for (const indicator of successIndicators) {
            if (indicator()) {
                return true;
            }
        }
        
        return false;
    }

    // ==================== OPTIMIZED UTILITY FUNCTIONS ====================
    function getAllVisibleFormFields() {
        return Array.from(document.querySelectorAll(`
            input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([disabled]),
            textarea:not([disabled]),
            select:not([disabled])
        `)).filter(field => isVisible(field));
    }

    function getFieldLabel(field) {
        if (field.id) {
            const label = document.querySelector(`label[for="${field.id}"]`);
            if (label) return label.textContent.trim();
        }
        
        const parentLabel = field.closest('label');
        if (parentLabel) return parentLabel.textContent.trim();
        
        const ariaLabel = field.getAttribute('aria-label');
        if (ariaLabel) return ariaLabel.trim();
        
        const labelledBy = field.getAttribute('aria-labelledby');
        if (labelledBy) {
            const labelElement = document.getElementById(labelledBy);
            if (labelElement) return labelElement.textContent.trim();
        }
        
        if (field.placeholder) return field.placeholder.trim();
        if (field.name) return field.name.replace(/[_-]/g, ' ').trim();
        
        return '';
    }

    function getJobId(card) {
        return card.getAttribute('data-job-id') || 
               card.getAttribute('data-occludable-job-id') ||
               card.querySelector('[data-job-id]')?.getAttribute('data-job-id') ||
               `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    function isVisible(element) {
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && 
               rect.height > 0 && 
               style.visibility !== 'hidden' && 
               style.display !== 'none' && 
               style.opacity !== '0';
    }

    async function scrollIntoView(element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await delay(300);
    }

    async function scrollToLoadMoreJobs() {
        Logger.info('SCROLL', 'Loading more jobs...');
        window.scrollBy({ top: 800, behavior: 'smooth' });
        await delay(2000);
    }

    async function closeAllModals() {
        const closeSelectors = [
            'button[aria-label*="Dismiss"]',
            'button[aria-label*="dismiss"]',
            'button[aria-label*="Close"]',
            'button[aria-label*="close"]',
            'button.artdeco-modal__dismiss'
        ];
        
        for (const selector of closeSelectors) {
            const buttons = document.querySelectorAll(selector);
            for (const button of buttons) {
                if (isVisible(button)) {
                    button.click();
                    await delay(400);
                    
                    // Handle discard confirmation
                    const discardBtn = Array.from(document.querySelectorAll('button')).find(b => 
                        b.textContent.toLowerCase().includes('discard')
                    );
                    
                    if (discardBtn && isVisible(discardBtn)) {
                        discardBtn.click();
                        await delay(300);
                    }
                    
                    return;
                }
            }
        }
    }

    function highlightElement(element, color) {
        const originalShadow = element.style.boxShadow;
        element.style.boxShadow = `0 0 0 3px ${color}`;
        setTimeout(() => {
            element.style.boxShadow = originalShadow;
        }, 800);
    }

    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 999999;
            background: ${type === 'success' ? '#057642' : '#0A66C2'};
            color: white;
            padding: 12px 20px;
            border-radius: 6px;
            font-weight: 600;
            font-size: 13px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    function calculateExpectedSalary(experience) {
        const baseSalaries = {
            0: 3.5, 1: 5, 2: 7, 3: 9, 4: 12, 5: 16, 7: 22
        };
        
        for (let exp = 7; exp >= 0; exp--) {
            if (experience >= exp) return baseSalaries[exp];
        }
        return 8;
    }

    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function timeout(ms, returnValue) {
        return new Promise(resolve => setTimeout(() => resolve(returnValue), ms));
    }

    // ==================== AUTOFILL API ====================
    async function performAutoFill(userData) {
        state.userData = userData;
        state.fieldCache.clear();
        
        const fields = getAllVisibleFormFields();
        let filledCount = 0;
        
        // Fast parallel processing
        await Promise.all(fields.map(async (field) => {
            try {
                const before = field.value;
                await fillFieldUltraFast(field);
                if (field.value && field.value !== before) {
                    filledCount++;
                }
            } catch (error) {
                // Continue on error
            }
        }));
        
        await handleCheckboxesFast();
        await handleAllDropdownsFast();
        
        return {
            success: true,
            fieldsFilled: filledCount,
            totalFields: fields.length
        };
    }

    // ==================== INITIALIZATION ====================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

    Logger.success('SYSTEM', '🚀 Fillora v5.0 - ULTIMATE automation ready!');
    Logger.speed('SYSTEM', '⚡ Optimized for speed: <60 seconds per job');

} else {
    console.log('⚠️ Fillora already initialized - skipping');
}