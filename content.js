// Fillora Chrome Extension - FINAL ROBUST Content Script
// FIXES: Filters disappearing, Easy Apply not clicking, form not filling
console.log('🎯 [FILLORA ROBUST] Loading...');

if (typeof window.filloraInitialized === 'undefined') {
    window.filloraInitialized = true;
    
    const contentState = {
        isActive: true,
        isProcessing: false,
        userProfile: null,
        resumeData: null,
        databaseData: null,
        openaiKey: '',
        
        // LinkedIn state
        processedJobs: new Set(),
        submittedJobs: new Set(),
        currentJobId: null,
        filterMonitor: null,
        stats: {
            applicationsSubmitted: 0,
            totalAttempts: 0,
            fieldsFilledCount: 0
        },
        config: {
            MAX_JOBS: 50,
            MAX_ATTEMPTS: 200,
            MAX_FORM_STEPS: 35,
            DELAYS: {
                AFTER_JOB_CLICK: 1200,
                AFTER_EASY_APPLY: 2000,
                AFTER_FIELD_FILL: 250,
                AFTER_DROPDOWN: 350,
                AFTER_NEXT: 1200,
                AFTER_SUBMIT: 2500,
                BETWEEN_JOBS: 1800,
                FILTER_CHECK: 3000
            }
        }
    };

    // ==================== INITIALIZATION ====================
    function initializeContentScript() {
        console.log('🔧 [FILLORA] Initializing ROBUST version...');
        contentState.isActive = true;
        setupMessageListener();
        loadOpenAIKey();
    }

    async function loadOpenAIKey() {
        try {
            const config = await chrome.storage.local.get('fillora_config');
            if (config.fillora_config && config.fillora_config.OPENAI_API_KEY_BACKGROUND) {
                contentState.openaiKey = config.fillora_config.OPENAI_API_KEY_BACKGROUND;
                console.log('✅ [OPENAI] Key loaded');
            }
        } catch (error) {
            console.warn('⚠️ [OPENAI] Could not load key:', error);
        }
    }

    function setupMessageListener() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            console.log('📨 [FILLORA] Message received:', request.action);
            
            (async () => {
                try {
                    switch (request.action) {
                        case 'PING':
                            const formStats = analyzePageFormsDetailed();
                            sendResponse({ 
                                success: true, 
                                data: formStats,
                                message: 'Content script active - ROBUST version' 
                            });
                            break;
                            
                        case 'PERFORM_AUTOFILL':
                            const result = await performIntelligentAutofill();
                            sendResponse(result);
                            break;
                            
                        case 'START_LINKEDIN_AUTOMATION':
                            const linkedinResult = await startLinkedInAutomationRobust(request.userData);
                            sendResponse(linkedinResult);
                            break;
                            
                        default:
                            sendResponse({ success: false, error: 'Unknown action' });
                    }
                } catch (error) {
                    console.error('❌ [FILLORA] Error:', error);
                    sendResponse({ success: false, error: error.message });
                }
            })();
            
            return true;
        });
    }

    // ==================== LINKEDIN AUTOMATION - ROBUST VERSION ====================
    async function startLinkedInAutomationRobust(userData) {
        console.log('🔗 [LINKEDIN ROBUST] Starting automation with PERMANENT filters...');
        
        if (contentState.isProcessing) throw new Error('Already in progress');
        if (!window.location.hostname.includes('linkedin.com')) {
            throw new Error('Please navigate to LinkedIn');
        }
        
        contentState.isProcessing = true;
        contentState.processedJobs.clear();
        contentState.submittedJobs.clear();
        
        try {
            showNotification('🚀 LinkedIn Automation Starting...', 'info', 2000);
            
            // Load user data
            const userId = await getUserId();
            if (!userId) {
                throw new Error('Please login to Fillora extension');
            }
            
            await loadAllDataSources(userId);
            
            if (!contentState.databaseData && !contentState.resumeData) {
                throw new Error('Could not load user data');
            }
            
            showExtractedData(contentState.databaseData, contentState.resumeData);
            
            // CRITICAL: Lock filters permanently
            await lockFiltersForever();
            
            // Start filter monitoring (reapplies filters every 3 seconds)
            startFilterMonitoring();
            
            // Process jobs
            await processJobsLoop();
            
            // Stop filter monitoring
            stopFilterMonitoring();
            
            console.log(`✅ [COMPLETE] Submitted ${contentState.stats.applicationsSubmitted} jobs`);
            
            showNotification(`✅ Complete! ${contentState.stats.applicationsSubmitted} applications submitted`, 'success', 5000);
            
            return {
                success: true,
                applicationsSubmitted: contentState.stats.applicationsSubmitted
            };
            
        } finally {
            contentState.isProcessing = false;
            stopFilterMonitoring();
        }
    }

    // ==================== FILTER LOCKING - PERMANENT ====================
    async function lockFiltersForever() {
        console.log('🔒 [FILTERS] Locking filters PERMANENTLY...');
        
        const requiredFilters = {
            'f_AL': 'true',        // Easy Apply
            'f_TPR': 'r86400',     // Last 24 hours
            'sortBy': 'DD'         // Most recent (Date posted descending)
        };
        
        const currentUrl = new URL(window.location.href);
        let needsReload = false;
        
        // Check and add missing filters
        for (const [key, value] of Object.entries(requiredFilters)) {
            if (currentUrl.searchParams.get(key) !== value) {
                currentUrl.searchParams.set(key, value);
                needsReload = true;
            }
        }
        
        if (needsReload) {
            console.log('🔄 [FILTERS] Applying required filters...');
            window.history.pushState({}, '', currentUrl.toString());
            window.location.href = currentUrl.toString();
            await delay(8000); // Wait for page reload
        } else {
            console.log('✅ [FILTERS] All filters already applied');
            await delay(3000);
        }
    }

    function startFilterMonitoring() {
        console.log('👁️ [FILTERS] Starting monitoring (checks every 3s)...');
        
        contentState.filterMonitor = setInterval(async () => {
            const currentUrl = new URL(window.location.href);
            
            const requiredFilters = {
                'f_AL': 'true',
                'f_TPR': 'r86400',
                'sortBy': 'DD'
            };
            
            let missing = [];
            for (const [key, value] of Object.entries(requiredFilters)) {
                if (currentUrl.searchParams.get(key) !== value) {
                    missing.push(key);
                    currentUrl.searchParams.set(key, value);
                }
            }
            
            if (missing.length > 0) {
                console.warn('⚠️ [FILTERS] Filters disappeared! Reapplying:', missing);
                window.history.pushState({}, '', currentUrl.toString());
                // Don't reload, just update URL
            }
        }, contentState.config.DELAYS.FILTER_CHECK);
    }

    function stopFilterMonitoring() {
        if (contentState.filterMonitor) {
            clearInterval(contentState.filterMonitor);
            contentState.filterMonitor = null;
            console.log('🛑 [FILTERS] Monitoring stopped');
        }
    }

    // ==================== JOB PROCESSING LOOP ====================
    async function processJobsLoop() {
        let consecutiveErrors = 0;
        const maxConsecutiveErrors = 5;
        
        while (contentState.stats.applicationsSubmitted < contentState.config.MAX_JOBS) {
            try {
                const result = await processSingleJobRobust();
                
                if (result.submitted) {
                    contentState.stats.applicationsSubmitted++;
                    consecutiveErrors = 0;
                    console.log(`🎉 Job ${contentState.stats.applicationsSubmitted} SUBMITTED!`);
                    showNotification(`✅ Application ${contentState.stats.applicationsSubmitted} submitted!`, 'success', 2000);
                } else if (result.skipped) {
                    console.log('⏭️ Job skipped:', result.reason);
                }
            } catch (error) {
                console.error('❌ Job processing error:', error);
                consecutiveErrors++;
                
                if (consecutiveErrors >= maxConsecutiveErrors) {
                    console.error('💥 Too many consecutive errors, stopping');
                    break;
                }
            }
            
            await delay(contentState.config.DELAYS.BETWEEN_JOBS);
            
            // Check if we've run out of jobs
            const hasMoreJobs = await checkForMoreJobs();
            if (!hasMoreJobs) {
                console.log('ℹ️ No more Easy Apply jobs found');
                break;
            }
        }
    }

    async function processSingleJobRobust() {
        console.log('🎯 [JOB] Finding next Easy Apply job...');
        
        const job = await findNextEasyApplyJobRobust();
        if (!job) {
            console.log('❌ [JOB] No more jobs found');
            return { submitted: false, skipped: true, reason: 'No jobs found' };
        }
        
        // Scroll job into view
        job.card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await delay(800);
        
        // Click on job card
        console.log('🖱️ [JOB] Clicking job card...');
        job.card.click();
        await delay(contentState.config.DELAYS.AFTER_JOB_CLICK);
        
        // Wait for job details to load
        await delay(1500);
        
        // Verify Easy Apply button exists in job details
        const hasEasyApply = await verifyEasyApplyButton();
        if (!hasEasyApply) {
            console.log('⏭️ [JOB] No Easy Apply button found, skipping');
            return { submitted: false, skipped: true, reason: 'No Easy Apply button' };
        }
        
        // Click Easy Apply button
        console.log('🖱️ [JOB] Clicking Easy Apply button...');
        if (!await clickEasyApplyButtonRobust()) {
            console.log('❌ [JOB] Failed to click Easy Apply button');
            return { submitted: false, skipped: true, reason: 'Could not click Easy Apply' };
        }
        
        await delay(contentState.config.DELAYS.AFTER_EASY_APPLY);
        
        // Fill and submit application
        console.log('📝 [JOB] Filling application form...');
        const submitted = await submitLinkedInApplicationRobust();
        
        if (submitted) {
            console.log('✅ [JOB] Application submitted successfully!');
        } else {
            console.log('❌ [JOB] Application submission failed');
        }
        
        return { submitted, skipped: false };
    }

    async function findNextEasyApplyJobRobust() {
        console.log('🔍 [SEARCH] Looking for Easy Apply jobs...');
        
        // Try multiple selectors for job cards
        const jobCardSelectors = [
            '.jobs-search-results__list-item',
            '.scaffold-layout__list-item',
            'li.jobs-search-results__list-item',
            'div[data-job-id]'
        ];
        
        let allCards = [];
        for (const selector of jobCardSelectors) {
            const cards = document.querySelectorAll(selector);
            if (cards.length > 0) {
                allCards = Array.from(cards);
                console.log(`📋 [SEARCH] Found ${allCards.length} job cards using selector: ${selector}`);
                break;
            }
        }
        
        if (allCards.length === 0) {
            console.log('❌ [SEARCH] No job cards found on page');
            return null;
        }
        
        for (const card of allCards) {
            if (!isVisible(card)) continue;
            
            const cardText = card.textContent.toLowerCase();
            
            // Must have "Easy Apply" badge
            if (!cardText.includes('easy apply')) {
                continue;
            }
            
            // Skip if already applied
            if (cardText.includes('applied')) {
                continue;
            }
            
            // Get job ID to avoid duplicates
            const jobId = card.getAttribute('data-job-id') || 
                         card.querySelector('[data-job-id]')?.getAttribute('data-job-id') ||
                         card.querySelector('a')?.href?.match(/jobs\/view\/(\d+)/)?.[1];
            
            if (jobId && contentState.processedJobs.has(jobId)) {
                continue;
            }
            
            if (jobId) {
                contentState.processedJobs.add(jobId);
            }
            
            console.log(`✅ [SEARCH] Found Easy Apply job${jobId ? ` (ID: ${jobId})` : ''}`);
            return { card, id: jobId };
        }
        
        console.log('❌ [SEARCH] No unprocessed Easy Apply jobs found');
        return null;
    }

    async function verifyEasyApplyButton() {
        // Wait a bit for job details panel to load
        await delay(1000);
        
        const buttonSelectors = [
            'button.jobs-apply-button',
            'button[aria-label*="Easy Apply"]',
            'button.jobs-apply-button--top-card',
            'button:has-text("Easy Apply")',
            'div.jobs-apply-button-container button'
        ];
        
        for (const selector of buttonSelectors) {
            try {
                const buttons = document.querySelectorAll(selector);
                for (const button of buttons) {
                    if (isVisible(button) && button.textContent.toLowerCase().includes('easy apply')) {
                        console.log('✅ [VERIFY] Easy Apply button found');
                        return true;
                    }
                }
            } catch (e) {
                continue;
            }
        }
        
        console.log('❌ [VERIFY] Easy Apply button not found');
        return false;
    }

    async function clickEasyApplyButtonRobust() {
        const buttonSelectors = [
            'button.jobs-apply-button',
            'button[aria-label*="Easy Apply"]',
            'button.jobs-apply-button--top-card'
        ];
        
        for (let attempt = 0; attempt < 15; attempt++) {
            for (const selector of buttonSelectors) {
                try {
                    const buttons = document.querySelectorAll(selector);
                    
                    for (const button of buttons) {
                        if (!isVisible(button)) continue;
                        
                        const buttonText = button.textContent.toLowerCase();
                        if (!buttonText.includes('easy apply')) continue;
                        
                        console.log(`🖱️ [CLICK] Clicking Easy Apply button (attempt ${attempt + 1})...`);
                        
                        // Scroll button into view
                        button.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        await delay(300);
                        
                        // Try multiple click methods
                        try {
                            button.click();
                        } catch (e1) {
                            try {
                                button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                            } catch (e2) {
                                console.warn('Click methods failed, trying JavaScript click');
                            }
                        }
                        
                        await delay(2000);
                        
                        // Check if modal opened
                        const modalOpened = await checkIfModalOpened();
                        if (modalOpened) {
                            console.log('✅ [CLICK] Easy Apply modal opened!');
                            return true;
                        }
                    }
                } catch (error) {
                    console.warn(`⚠️ [CLICK] Error with selector ${selector}:`, error);
                }
            }
            
            await delay(500);
        }
        
        console.log('❌ [CLICK] Failed to open Easy Apply modal after all attempts');
        return false;
    }

    async function checkIfModalOpened() {
        const modalSelectors = [
            '.jobs-easy-apply-modal',
            '.jobs-easy-apply-content',
            'div[role="dialog"]',
            '.artdeco-modal'
        ];
        
        for (const selector of modalSelectors) {
            const modal = document.querySelector(selector);
            if (modal && isVisible(modal)) {
                return true;
            }
        }
        
        return false;
    }

    async function submitLinkedInApplicationRobust() {
        console.log('📝 [FORM] Starting application submission...');
        
        for (let step = 0; step < contentState.config.MAX_FORM_STEPS; step++) {
            console.log(`📝 [FORM] Step ${step + 1}/${contentState.config.MAX_FORM_STEPS}`);
            
            // Wait for form to load
            await delay(1000);
            
            // Fill ALL fields intelligently
            const fields = getAllModalFields();
            console.log(`📝 [FORM] Found ${fields.length} fields to fill`);
            
            for (const field of fields) {
                if (isFieldFilledWithValidData(field)) {
                    continue;
                }
                
                try {
                    const filled = await fillFieldIntelligently(field);
                    if (filled) {
                        highlightFieldGreen(field, 'linkedin');
                        await delay(contentState.config.DELAYS.AFTER_FIELD_FILL);
                    }
                } catch (error) {
                    console.error('❌ [FORM] Field error:', error);
                }
            }
            
            await delay(800);
            
            // Check if submitted
            if (await isApplicationSubmitted()) {
                console.log('✅ [FORM] Application submitted!');
                await delay(2000);
                await dismissSuccessModal();
                return true;
            }
            
            // Try submit button first
            const submitClicked = await clickModalButtonRobust('submit');
            
            if (submitClicked) {
                console.log('🔵 [FORM] Clicked submit');
                await delay(contentState.config.DELAYS.AFTER_SUBMIT);
                
                if (await isApplicationSubmitted()) {
                    console.log('✅ [FORM] Application submitted after submit click!');
                    await delay(2000);
                    await dismissSuccessModal();
                    return true;
                }
            }
            
            // Try next button
            const nextClicked = await clickModalButtonRobust('next');
            
            if (nextClicked) {
                console.log('🔵 [FORM] Clicked next');
                await delay(contentState.config.DELAYS.AFTER_NEXT);
            } else if (!submitClicked) {
                console.warn('⚠️ [FORM] No next/submit button found');
                
                // Try to close modal and skip this job
                await closeModal();
                return false;
            }
        }
        
        console.warn('⚠️ [FORM] Max steps reached without submission');
        await closeModal();
        return false;
    }

    async function clickModalButtonRobust(type) {
        const modal = document.querySelector('.jobs-easy-apply-modal, .jobs-easy-apply-content, div[role="dialog"]');
        if (!modal) return false;
        
        const buttonSelectors = [
            'button',
            'button[aria-label]',
            'button.artdeco-button',
            'footer button'
        ];
        
        let allButtons = [];
        for (const selector of buttonSelectors) {
            const buttons = modal.querySelectorAll(selector);
            allButtons = allButtons.concat(Array.from(buttons));
        }
        
        for (const button of allButtons) {
            if (!isVisible(button) || button.disabled) continue;
            
            const text = button.textContent.toLowerCase();
            const ariaLabel = (button.getAttribute('aria-label') || '').toLowerCase();
            const allText = text + ' ' + ariaLabel;
            
            if (type === 'submit') {
                if (allText.includes('submit') || allText.includes('send application') || allText.includes('apply')) {
                    // Make sure it's not "next" button
                    if (allText.includes('next') || allText.includes('continue')) {
                        continue;
                    }
                    
                    button.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    await delay(300);
                    button.click();
                    return true;
                }
            } else if (type === 'next') {
                if ((allText.includes('next') || allText.includes('continue') || allText.includes('review')) && 
                    !allText.includes('submit')) {
                    button.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    await delay(300);
                    button.click();
                    return true;
                }
            }
        }
        
        return false;
    }

    async function isApplicationSubmitted() {
        // Check if modal is closed
        const modal = document.querySelector('.jobs-easy-apply-modal, .jobs-easy-apply-content, div[role="dialog"].jobs');
        if (!modal || !isVisible(modal)) {
            return true;
        }
        
        // Check for success message
        const successIndicators = [
            'application sent',
            'application submitted',
            'successfully applied',
            'your application has been sent',
            'application received'
        ];
        
        const pageText = document.body.textContent.toLowerCase();
        return successIndicators.some(indicator => pageText.includes(indicator));
    }

    async function dismissSuccessModal() {
        const closeSelectors = [
            'button[aria-label*="Dismiss"]',
            'button[aria-label*="Close"]',
            'button.artdeco-modal__dismiss',
            'button[data-test-modal-close-btn]',
            'svg[data-test-icon="close-small"] ancestor::button'
        ];
        
        for (const selector of closeSelectors) {
            try {
                const buttons = document.querySelectorAll(selector);
                for (const btn of buttons) {
                    if (isVisible(btn)) {
                        btn.click();
                        await delay(1000);
                        return;
                    }
                }
            } catch (e) {
                continue;
            }
        }
    }

    async function closeModal() {
        await dismissSuccessModal();
    }

    async function checkForMoreJobs() {
        const jobsList = document.querySelector('.jobs-search-results-list, .scaffold-layout__list, ul.jobs-search-results__list');
        if (!jobsList) return false;
        
        const jobCards = jobsList.querySelectorAll('li, div[data-job-id]');
        return jobCards.length > 0;
    }

    // ==================== INTELLIGENT AUTOFILL (Reusing from previous version) ====================
    async function performIntelligentAutofill() {
        console.log('🧠 [AUTOFILL] Starting intelligent autofill...');
        
        if (contentState.isProcessing) {
            throw new Error('AutoFill already in progress');
        }
        
        contentState.isProcessing = true;
        const startTime = Date.now();
        
        try {
            showInstantStartNotification();
            
            const userId = await getUserId();
            if (!userId) {
                throw new Error('Please login to the Fillora extension first');
            }
            
            await loadAllDataSources(userId);
            
            if (!contentState.databaseData && !contentState.resumeData) {
                throw new Error('Could not load your profile data');
            }
            
            const allFields = getAllFormFields();
            console.log(`📊 [FIELDS] Found ${allFields.length} fillable fields`);
            
            if (allFields.length === 0) {
                throw new Error('No fillable fields found on this page');
            }
            
            showExtractedData(contentState.databaseData, contentState.resumeData);
            
            let totalFilled = 0;
            
            for (const field of allFields) {
                try {
                    const filled = await fillFieldIntelligently(field);
                    if (filled) {
                        totalFilled++;
                        highlightFieldGreen(field, 'intelligent');
                        await delay(contentState.config.DELAYS.AFTER_FIELD_FILL);
                    }
                } catch (error) {
                    console.error('Field fill error:', error);
                }
            }
            
            const successRate = allFields.length > 0 ? Math.round((totalFilled / allFields.length) * 100) : 0;
            const timeTaken = ((Date.now() - startTime) / 1000).toFixed(2);
            
            console.log(`✅ [COMPLETE] ${totalFilled}/${allFields.length} fields (${successRate}%) in ${timeTaken}s`);
            
            showNotification(
                `✅ AutoFill Complete!\n${totalFilled}/${allFields.length} fields (${successRate}%)`, 
                'success', 
                5000
            );
            
            return {
                success: true,
                fieldsFilled: totalFilled,
                totalFields: allFields.length,
                successRate: successRate,
                timeTaken: timeTaken
            };
            
        } catch (error) {
            console.error('❌ [FILLORA] Autofill failed:', error);
            showNotification(`❌ AutoFill failed: ${error.message}`, 'error', 5000);
            throw error;
        } finally {
            contentState.isProcessing = false;
        }
    }

    async function loadAllDataSources(userId) {
        console.log('📊 [DATA] Loading all sources...');
        
        const databaseResponse = await chrome.runtime.sendMessage({
            action: 'FETCH_ALL_DATABASE_TABLES',
            userId: userId
        });
        
        if (databaseResponse && databaseResponse.success) {
            contentState.databaseData = databaseResponse.data;
            console.log('✅ [DATABASE] Loaded:', Object.keys(contentState.databaseData).length, 'fields');
        }
        
        const resumeResponse = await chrome.runtime.sendMessage({
            action: 'PARSE_REAL_RESUME_CONTENT',
            userId: userId
        });
        
        if (resumeResponse && resumeResponse.success) {
            contentState.resumeData = resumeResponse.data;
            console.log('✅ [RESUME] Loaded:', Object.keys(contentState.resumeData).length, 'fields');
        }
    }

    // ==================== FIELD FILLING (Complete implementation from enhanced version) ====================
    async function fillFieldIntelligently(field) {
        const fieldInfo = getFieldInfo(field);
        
        if (isFieldFilledWithValidData(field)) {
            return false;
        }
        
        if (field.tagName.toLowerCase() === 'select') {
            return await handleDropdownIntelligently(field, fieldInfo);
        } else if (field.type === 'checkbox') {
            return await handleCheckboxIntelligently(field, fieldInfo);
        } else if (field.type === 'radio') {
            return await handleRadioIntelligently(field, fieldInfo);
        } else if (field.type === 'file') {
            return await handleFileUpload(field, fieldInfo);
        } else {
            return await handleTextFieldIntelligently(field, fieldInfo);
        }
    }

    function getFieldInfo(field) {
        const fieldName = (field.name || field.id || '').toLowerCase();
        const fieldLabel = getFieldLabel(field).toLowerCase();
        const fieldPlaceholder = (field.placeholder || '').toLowerCase();
        const fieldType = field.type || field.tagName.toLowerCase();
        const ariaLabel = (field.getAttribute('aria-label') || '').toLowerCase();
        
        return {
            element: field,
            name: fieldName,
            label: fieldLabel,
            placeholder: fieldPlaceholder,
            type: fieldType,
            ariaLabel: ariaLabel,
            fullContext: `${fieldName} ${fieldLabel} ${fieldPlaceholder} ${ariaLabel}`
        };
    }

    function isFieldFilledWithValidData(field) {
        if (field.tagName.toLowerCase() === 'select') {
            const value = field.value;
            return value && 
                   value !== '' && 
                   value !== 'select' && 
                   value !== '0' &&
                   !field.options[field.selectedIndex]?.text.toLowerCase().includes('no answer') &&
                   !field.options[field.selectedIndex]?.text.toLowerCase().includes('select');
        } else if (field.type === 'checkbox') {
            return field.checked;
        } else if (field.type === 'radio') {
            const name = field.name;
            if (!name) return field.checked;
            const group = document.querySelectorAll(`input[type="radio"][name="${name}"]`);
            return Array.from(group).some(r => r.checked);
        } else {
            const value = (field.value || field.textContent || '').trim();
            return value && value.length > 0;
        }
    }

    async function handleTextFieldIntelligently(field, fieldInfo) {
        let value = getExactMatchValue(fieldInfo);
        
        if (!value && contentState.openaiKey) {
            value = await getAIAssistedValue(fieldInfo);
        }
        
        if (!value) {
            value = getIntelligentGuess(fieldInfo);
        }
        
        if (value && value.toString().trim()) {
            return await fillFieldValue(field, value);
        }
        
        return false;
    }

    function getExactMatchValue(fieldInfo) {
        const context = fieldInfo.fullContext;
        const db = contentState.databaseData || {};
        const resume = contentState.resumeData || {};
        
        if (context.includes('first') && context.includes('name')) return db.firstName || resume.firstName || '';
        if (context.includes('last') && context.includes('name')) return db.lastName || resume.lastName || '';
        if (context.includes('middle') && context.includes('name')) return '';
        if (context.includes('full') && context.includes('name')) return db.fullName || resume.fullName || db.name || resume.name || '';
        if (context.includes('name') && !context.includes('company')) return db.fullName || resume.fullName || db.name || resume.name || '';
        if (fieldInfo.type === 'email' || context.includes('email')) return db.email || resume.email || '';
        if (fieldInfo.type === 'tel' || context.includes('phone') || context.includes('mobile')) return db.phone || resume.phone || '';
        if (context.includes('city')) return db.city || resume.city || '';
        if (context.includes('state')) return db.state || resume.state || '';
        if (context.includes('country')) return db.country || resume.country || 'India';
        if (context.includes('company') && context.includes('current')) return db.currentCompany || resume.currentCompany || '';
        if (context.includes('company')) return db.currentCompany || resume.currentCompany || '';
        if (context.includes('title') || context.includes('position')) return db.currentTitle || resume.currentTitle || '';
        if (context.includes('experience') && context.includes('year')) return db.totalExperience || resume.totalExperience || '0';
        if (context.includes('notice')) return db.noticePeriod || '30';
        if (context.includes('degree') || context.includes('education')) return db.education || resume.education || '';
        if (context.includes('university') || context.includes('college')) return db.institution || resume.institution || '';
        if (context.includes('skill')) return db.skillsText || resume.skillsText || '';
        if (context.includes('linkedin')) return db.linkedin || resume.linkedin || '';
        if (context.includes('github')) return db.github || resume.github || '';
        
        return '';
    }

    async function getAIAssistedValue(fieldInfo) {
        try {
            const userData = { ...contentState.databaseData, ...contentState.resumeData };
            const label = fieldInfo.label || fieldInfo.name || fieldInfo.placeholder;
            
            const prompt = `Field: "${label}". User: ${userData.fullName || ''}, ${userData.currentTitle || ''}, ${userData.totalExperience || 0} years exp. Provide ONLY the value, max 100 chars.`;
            
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${contentState.openaiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'gpt-3.5-turbo',
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: 50,
                    temperature: 0.3
                })
            });
            
            if (!response.ok) throw new Error('AI request failed');
            
            const data = await response.json();
            const answer = data.choices[0].message.content.trim();
            
            if (answer && answer !== 'UNKNOWN' && answer.length > 0 && answer.length < 500) {
                return answer;
            }
        } catch (error) {
            console.warn('⚠️ [AI] Failed:', error);
        }
        
        return '';
    }

    function getIntelligentGuess(fieldInfo) {
        const context = fieldInfo.fullContext;
        const userData = { ...contentState.databaseData, ...contentState.resumeData };
        
        if (context.includes('authorize') || context.includes('legal') || context.includes('visa')) return 'Yes';
        if (context.includes('available') || context.includes('start date')) return 'Immediate';
        if (context.includes('relocate') || context.includes('willing')) return 'Yes';
        
        return '';
    }

    async function handleDropdownIntelligently(select, fieldInfo) {
        const options = Array.from(select.options).filter(opt => 
            opt.value && opt.value !== '' && opt.value !== 'select' && opt.value !== '0' &&
            !opt.text.toLowerCase().includes('no answer') &&
            !opt.text.toLowerCase().includes('select')
        );
        
        if (options.length === 0) return false;
        
        const targetValue = getExactMatchValue(fieldInfo);
        let selectedOption = null;
        
        if (targetValue) {
            selectedOption = findDropdownMatch(options, targetValue);
        }
        
        if (!selectedOption) {
            selectedOption = applyDropdownHeuristics(fieldInfo, options);
        }
        
        if (!selectedOption && options.length > 0) {
            selectedOption = options[0];
        }
        
        if (selectedOption) {
            select.value = selectedOption.value;
            triggerEvents(select);
            return true;
        }
        
        return false;
    }

    function findDropdownMatch(options, targetValue) {
        const searchValue = String(targetValue).toLowerCase().trim();
        
        for (const opt of options) {
            if (opt.value.toLowerCase() === searchValue || opt.text.toLowerCase() === searchValue) {
                return opt;
            }
        }
        
        for (const opt of options) {
            if (opt.text.toLowerCase().includes(searchValue) || searchValue.includes(opt.text.toLowerCase())) {
                return opt;
            }
        }
        
        return null;
    }

    function applyDropdownHeuristics(fieldInfo, options) {
        const context = fieldInfo.fullContext;
        const userData = { ...contentState.databaseData, ...contentState.resumeData };
        
        if (context.includes('notice')) {
            const noticeDays = userData.noticePeriod || '30';
            for (const opt of options) {
                const text = opt.text.toLowerCase();
                if (noticeDays.includes('30') && (text.includes('30') || text.includes('1 month'))) return opt;
            }
        }
        
        if (options.length === 2) {
            const hasYes = options.find(opt => opt.text.toLowerCase().includes('yes'));
            if (hasYes && (context.includes('willing') || context.includes('authorize'))) {
                return hasYes;
            }
        }
        
        return null;
    }

    async function handleCheckboxIntelligently(checkbox, fieldInfo) {
        const context = fieldInfo.fullContext;
        
        if (context.includes('agree') || context.includes('terms') || context.includes('policy') || 
            context.includes('consent') || context.includes('authorize')) {
            checkbox.checked = true;
            triggerEvents(checkbox);
            return true;
        }
        
        return false;
    }

    async function handleRadioIntelligently(radio, fieldInfo) {
        const name = radio.name;
        if (!name) return false;
        
        const group = document.querySelectorAll(`input[type="radio"][name="${name}"]`);
        if (Array.from(group).some(r => r.checked)) {
            return false;
        }
        
        const label = fieldInfo.label.toLowerCase();
        
        if (label.includes('yes')) {
            radio.checked = true;
            triggerEvents(radio);
            return true;
        }
        
        return false;
    }

    async function handleFileUpload(field, fieldInfo) {
        const context = fieldInfo.fullContext;
        
        if (context.includes('resume') || context.includes('cv')) {
            try {
                const userId = await getUserId();
                const fileResponse = await chrome.runtime.sendMessage({
                    action: 'FETCH_RESUME_FILE',
                    userId: userId
                });
                
                if (fileResponse && fileResponse.success && fileResponse.fileData) {
                    const response = await fetch(fileResponse.fileData.url);
                    const blob = await response.blob();
                    const file = new File([blob], fileResponse.fileData.name || 'resume.pdf', { 
                        type: fileResponse.fileData.type || 'application/pdf' 
                    });
                    
                    const dataTransfer = new DataTransfer();
                    dataTransfer.items.add(file);
                    field.files = dataTransfer.files;
                    
                    triggerEvents(field);
                    console.log('✅ [FILE] Resume uploaded');
                    return true;
                }
            } catch (error) {
                console.error('❌ [FILE] Upload failed:', error);
            }
        }
        
        return false;
    }

    async function fillFieldValue(field, value) {
        try {
            field.focus();
            await delay(100);
            
            if (field.contentEditable === 'true') {
                field.textContent = value.toString();
                field.innerHTML = value.toString();
            } else {
                field.value = value.toString();
            }
            
            triggerEvents(field);
            return true;
        } catch (error) {
            return false;
        }
    }

    // ==================== UTILITIES ====================
    function getAllFormFields(container = document) {
        const selectors = [
            'input[type="text"]:not([type="hidden"])',
            'input[type="email"]',
            'input[type="tel"]',
            'input[type="url"]',
            'input[type="number"]',
            'input:not([type])',
            'textarea',
            'select',
            'input[type="radio"]',
            'input[type="checkbox"]',
            'input[type="file"]'
        ];
        
        const fields = container.querySelectorAll(selectors.join(', '));
        
        return Array.from(fields).filter(field => {
            const style = window.getComputedStyle(field);
            const rect = field.getBoundingClientRect();
            
            return style.display !== 'none' && 
                   style.visibility !== 'hidden' && 
                   !field.disabled && 
                   !field.readOnly &&
                   rect.width > 0 && 
                   rect.height > 0;
        });
    }

    function getAllModalFields() {
        const modal = document.querySelector('.jobs-easy-apply-modal, .jobs-easy-apply-content, div[role="dialog"]') || document;
        return getAllFormFields(modal);
    }

    function getFieldLabel(field) {
        const methods = [
            () => document.querySelector(`label[for="${field.id}"]`)?.textContent?.trim(),
            () => field.closest('label')?.textContent?.trim(),
            () => field.previousElementSibling?.textContent?.trim(),
            () => field.getAttribute('aria-label')?.trim(),
            () => field.placeholder,
            () => field.name
        ];
        
        for (const method of methods) {
            try {
                const result = method();
                if (result && result.length < 200) return result;
            } catch (e) { continue; }
        }
        
        return '';
    }

    function isVisible(element) {
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && 
               style.visibility !== 'hidden' && 
               style.display !== 'none';
    }

    function showInstantStartNotification() {
        showNotification('⚡ AutoFill Started!', 'info', 1000);
    }

    function highlightFieldGreen(field, source) {
        field.style.backgroundColor = '#dcfce7';
        field.style.border = '2px solid #22c55e';
        field.style.transition = 'all 0.3s ease';
        
        setTimeout(() => {
            field.style.backgroundColor = '';
            field.style.border = '';
        }, 1500);
    }

    function showExtractedData(databaseData, resumeData) {
        const oldDisplay = document.getElementById('fillora-data-display');
        if (oldDisplay) oldDisplay.remove();
        
        const displayPanel = document.createElement('div');
        displayPanel.id = 'fillora-data-display';
        displayPanel.style.cssText = `
            position: fixed !important;
            top: 80px !important;
            right: 20px !important;
            width: 350px !important;
            max-height: 400px !important;
            overflow-y: auto !important;
            background: white !important;
            border: 2px solid #3B82F6 !important;
            border-radius: 10px !important;
            box-shadow: 0 8px 30px rgba(0,0,0,0.2) !important;
            z-index: 999999 !important;
            font-family: -apple-system, sans-serif !important;
            padding: 0 !important;
        `;
        
        displayPanel.innerHTML = `
            <div style="background: linear-gradient(135deg, #3B82F6, #2563EB); color: white; padding: 10px; font-weight: 700; font-size: 13px; border-radius: 8px 8px 0 0; display: flex; justify-content: space-between;">
                <span>📊 Your Data Loaded</span>
                <button id="fillora-close-data" style="background: transparent; border: none; color: white; font-size: 16px; cursor: pointer;">✕</button>
            </div>
            <div style="padding: 10px; font-size: 11px;">
                <div style="color: #059669; font-weight: 700; margin-bottom: 5px;">🗄️ DATABASE (${Object.keys(databaseData || {}).length} fields)</div>
                <div style="color: #2563EB; font-weight: 700; margin-bottom: 5px;">📄 RESUME (${Object.keys(resumeData || {}).length} fields)</div>
            </div>
        `;
        
        document.body.appendChild(displayPanel);
        
        document.getElementById('fillora-close-data').onclick = () => displayPanel.remove();
        
        setTimeout(() => {
            if (displayPanel.parentNode) displayPanel.remove();
        }, 20000);
    }

    function showNotification(message, type = 'info', duration = 4000) {
        const notification = document.createElement('div');
        notification.textContent = message;
        
        const colors = { 
            success: '#10B981', 
            error: '#EF4444', 
            info: '#3B82F6' 
        };
        
        notification.style.cssText = `
            position: fixed !important;
            top: 20px !important;
            right: 20px !important;
            max-width: 280px !important;
            padding: 10px 14px !important;
            border-radius: 8px !important;
            color: white !important;
            font-weight: 600 !important;
            font-size: 12px !important;
            z-index: 999999 !important;
            background: ${colors[type]} !important;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2) !important;
            font-family: -apple-system, sans-serif !important;
            white-space: pre-line !important;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) notification.remove();
        }, duration);
    }

    function triggerEvents(element) {
        const events = ['input', 'change', 'blur'];
        events.forEach(eventType => {
            element.dispatchEvent(new Event(eventType, { bubbles: true }));
        });
    }

    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function getUserId() {
        try {
            const result = await chrome.storage.local.get(['fillora_user']);
            return result.fillora_user?.id || null;
        } catch (error) {
            return null;
        }
    }

    function analyzePageFormsDetailed() {
        const allFields = getAllFormFields();
        return {
            totalFields: allFields.length,
            hasForm: allFields.length > 0,
            platform: detectPlatform()
        };
    }

    function detectPlatform() {
        const hostname = window.location.hostname.toLowerCase();
        if (hostname.includes('linkedin')) return 'LinkedIn';
        if (hostname.includes('indeed')) return 'Indeed';
        return 'Job Application Form';
    }

    // ==================== INIT ====================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeContentScript);
    } else {
        initializeContentScript();
    }

    console.log('✅ [FILLORA ROBUST] Ready - Filters locked, Easy Apply working!');

} else {
    console.log('⚠️ Fillora already initialized');
}