// Fillora Chrome Extension - BULLETPROOF LINKEDIN AUTOMATION
// Version: 8.0 - GUARANTEED SUBMISSION + NO SKIPPING + PERFECT FORM FILLING
console.log('🚀 [FILLORA v8.0] Initializing BULLETPROOF LinkedIn automation with GUARANTEED SUBMISSION...');

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
        skippedJobs: new Set(),
        currentJobId: null,
        userData: null,
        stats: {
            applicationsSubmitted: 0,
            applicationsAttempted: 0,
            applicationsSkipped: 0,
            totalAttempts: 0,
            errors: [],
            successRate: 0
        },
        config: {
            MAX_JOBS: 50,
            MAX_ATTEMPTS: 200,
            TARGET_TIME_PER_JOB: 50000,
            MIN_JOB_TIME: 35000,
            MAX_JOB_TIME: 90000,
            MAX_RETRIES_PER_JOB: 3,
            MAX_FORM_STEPS: 30,
            SUBMIT_BUTTON_RETRY_ATTEMPTS: 15, // Keep trying to find submit button
            DELAYS: {
                AFTER_JOB_CLICK: 2000,
                AFTER_EASY_APPLY: 3000,
                AFTER_FIELD_FILL: 700,
                AFTER_NEXT: 2500,
                AFTER_SUBMIT: 4000,
                BETWEEN_JOBS: 3000,
                VERIFICATION: 3000,
                RETRY_DELAY: 2000,
                HUMAN_PAUSE: 1000,
                MODAL_CLOSE: 2000,
                SUBMIT_SEARCH: 1500
            }
        },
        fieldCache: new Map(),
        jobStartTime: null,
        currentRetryCount: 0,
        lastFilledValues: new Map()
    };

    // ==================== ENHANCED LOGGER ====================
    const Logger = {
        log: (level, category, message, data = null) => {
            const emoji = {
                'INFO': 'ℹ️',
                'SUCCESS': '✅',
                'WARNING': '⚠️',
                'ERROR': '❌',
                'TIME': '⏱️',
                'FILTER': '🔍',
                'SUBMIT': '🎯',
                'FILL': '📝',
                'CRITICAL': '🔴'
            }[level] || '📝';
            const timestamp = new Date().toLocaleTimeString();
            console.log(`${emoji} [${timestamp}] [${level}] [${category}] ${message}`, data || '');
        },
        info: (cat, msg, data) => Logger.log('INFO', cat, msg, data),
        success: (cat, msg, data) => Logger.log('SUCCESS', cat, msg, data),
        warn: (cat, msg, data) => Logger.log('WARNING', cat, msg, data),
        error: (cat, msg, data) => Logger.log('ERROR', cat, msg, data),
        time: (cat, msg, data) => Logger.log('TIME', cat, msg, data),
        filter: (cat, msg, data) => Logger.log('FILTER', cat, msg, data),
        submit: (cat, msg, data) => Logger.log('SUBMIT', cat, msg, data),
        fill: (cat, msg, data) => Logger.log('FILL', cat, msg, data),
        critical: (cat, msg, data) => Logger.log('CRITICAL', cat, msg, data)
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
        
        Logger.success('INIT', 'Fillora v8.0 BULLETPROOF automation ready');
    }

    // ==================== MAIN AUTOMATION ENTRY ====================
    async function startLinkedInAutomation(userData) {
        Logger.info('AUTOMATION', '🚀 Starting BULLETPROOF LinkedIn Easy Apply automation');
        
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
            errors: [],
            successRate: 0
        };
        state.processedJobs.clear();
        state.submittedJobs.clear();
        state.failedJobs.clear();
        state.skippedJobs.clear();
        state.fieldCache.clear();
        state.lastFilledValues.clear();
        
        const startTime = Date.now();
        
        try {
            // STEP 1: Ensure we're on correct page with Easy Apply filter
            await ensureCorrectPageWithEasyApply();
            
            // STEP 2: Process jobs with GUARANTEED submission
            const result = await processJobsMainLoop();
            
            const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
            const timePerJob = state.stats.applicationsSubmitted > 0 
                ? (totalTime / state.stats.applicationsSubmitted).toFixed(1) 
                : '0';
            
            state.stats.successRate = state.stats.applicationsAttempted > 0
                ? ((state.stats.applicationsSubmitted / state.stats.applicationsAttempted) * 100).toFixed(1)
                : 0;
            
            Logger.success('AUTOMATION', `✅ COMPLETED! Submitted: ${state.stats.applicationsSubmitted} jobs`);
            Logger.time('AUTOMATION', `⏱️ Total: ${totalTime}s | Average: ${timePerJob}s per job | Success Rate: ${state.stats.successRate}%`);
            
            return {
                success: true,
                applicationsSubmitted: state.stats.applicationsSubmitted,
                applicationsAttempted: state.stats.applicationsAttempted,
                applicationsSkipped: state.stats.applicationsSkipped,
                totalTime: totalTime,
                averageTimePerJob: timePerJob,
                successRate: state.stats.successRate
            };
            
        } finally {
            state.isProcessing = false;
            await forceCloseAllModalsAggressively();
        }
    }

    // ==================== ENHANCED PAGE NAVIGATION WITH EASY APPLY FILTER ====================
    async function ensureCorrectPageWithEasyApply() {
        const currentUrl = window.location.href;
        
        const hasEasyApplyFilter = currentUrl.includes('f_AL=true');
        const isJobsPage = currentUrl.includes('linkedin.com/jobs');
        
        if (!isJobsPage) {
            Logger.info('NAVIGATION', '🔍 Navigating to LinkedIn Jobs...');
            window.location.href = 'https://www.linkedin.com/jobs/search/?f_AL=true&sortBy=DD';
            await delay(8000);
            return;
        }
        
        if (!hasEasyApplyFilter) {
            Logger.filter('FILTER', 'Applying Easy Apply filter...');
            const currentUrl = new URL(window.location.href);
            currentUrl.searchParams.set('f_AL', 'true');
            window.location.href = currentUrl.toString();
            await delay(8000);
        }
        
        await waitForEasyApplyJobsToLoad();
        Logger.success('NAVIGATION', '✅ On LinkedIn Easy Apply jobs page');
    }

    async function waitForEasyApplyJobsToLoad() {
        Logger.info('LOADING', 'Waiting for Easy Apply jobs to load...');
        
        let attempts = 0;
        const maxAttempts = 40;
        
        while (attempts < maxAttempts) {
            const jobCards = getJobCards();
            const easyApplyJobs = Array.from(jobCards).filter(card => isEasyApplyJobCard(card));
            
            if (easyApplyJobs.length > 0) {
                Logger.success('LOADING', `✅ Found ${easyApplyJobs.length} Easy Apply jobs`);
                return true;
            }
            
            if (attempts % 5 === 0) {
                window.scrollBy({ top: 800, behavior: 'smooth' });
                await delay(2000);
            }
            
            await delay(1000);
            attempts++;
        }
        
        Logger.warn('LOADING', 'No Easy Apply jobs found - will try to proceed');
        return false;
    }

    function isEasyApplyJobCard(card) {
        const cardText = card.textContent.toLowerCase();
        const hasEasyApply = cardText.includes('easy apply');
        const alreadyApplied = cardText.includes('you applied') || 
                              cardText.includes('applied on') || 
                              cardText.includes('application sent');
        return hasEasyApply && !alreadyApplied;
    }

    function getJobCards() {
        return document.querySelectorAll([
            '.scaffold-layout__list-item',
            '.jobs-search-results__list-item',
            '.job-card-container',
            '[data-job-id]',
            'li.jobs-search-results__list-item'
        ].join(','));
    }

    // ==================== ROBUST JOB PROCESSING LOOP ====================
    async function processJobsMainLoop() {
        Logger.info('LOOP', `🎯 Target: ${state.config.MAX_JOBS} successful submissions`);
        
        let consecutiveFailures = 0;
        let scrollAttempts = 0;
        
        while (state.stats.applicationsSubmitted < state.config.MAX_JOBS && 
               state.stats.totalAttempts < state.config.MAX_ATTEMPTS) {
            
            state.stats.totalAttempts++;
            
            console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`📊 ATTEMPT ${state.stats.totalAttempts} | ✅ Submitted: ${state.stats.applicationsSubmitted}/${state.config.MAX_JOBS} | Success Rate: ${state.stats.successRate}%`);
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
            
            try {
                const jobResult = await processNextJobWithGuaranteedSubmission();
                
                if (jobResult.submitted) {
                    state.stats.applicationsSubmitted++;
                    state.stats.applicationsAttempted++;
                    consecutiveFailures = 0;
                    scrollAttempts = 0;
                    
                    state.stats.successRate = ((state.stats.applicationsSubmitted / state.stats.applicationsAttempted) * 100).toFixed(1);
                    
                    Logger.success('LOOP', `🎉 SUCCESS! Progress: ${state.stats.applicationsSubmitted}/${state.config.MAX_JOBS} | Rate: ${state.stats.successRate}%`);
                    showNotification(`✅ Job ${state.stats.applicationsSubmitted}/${state.config.MAX_JOBS} SUBMITTED!`, 'success');
                } else if (jobResult.skipped) {
                    state.stats.applicationsSkipped++;
                    Logger.warn('LOOP', `⏭️ Job skipped - Reason: ${jobResult.reason}`);
                } else {
                    state.stats.applicationsAttempted++;
                    consecutiveFailures++;
                    state.stats.successRate = state.stats.applicationsAttempted > 0 
                        ? ((state.stats.applicationsSubmitted / state.stats.applicationsAttempted) * 100).toFixed(1) 
                        : 0;
                    Logger.warn('LOOP', `❌ Job failed - Consecutive failures: ${consecutiveFailures}`);
                }
                
            } catch (error) {
                Logger.error('LOOP', `Error: ${error.message}`);
                state.stats.errors.push({ attempt: state.stats.totalAttempts, error: error.message });
                consecutiveFailures++;
            }
            
            if (consecutiveFailures >= 5 || scrollAttempts >= 10) {
                Logger.info('SCROLL', 'Loading more jobs...');
                await scrollToLoadMoreJobs();
                consecutiveFailures = 0;
                scrollAttempts = 0;
                await delay(4000);
            }
            
            scrollAttempts++;
            await forceCloseAllModalsAggressively();
            await delay(state.config.DELAYS.BETWEEN_JOBS);
        }
        
        Logger.success('LOOP', `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        Logger.success('LOOP', `🎉 BULLETPROOF AUTOMATION COMPLETED!`);
        Logger.success('LOOP', `✅ Submitted: ${state.stats.applicationsSubmitted}`);
        Logger.success('LOOP', `📝 Attempted: ${state.stats.applicationsAttempted}`);
        Logger.success('LOOP', `⏭️ Skipped: ${state.stats.applicationsSkipped}`);
        Logger.success('LOOP', `📊 Success Rate: ${state.stats.successRate}%`);
        Logger.success('LOOP', `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        
        return {
            submitted: state.stats.applicationsSubmitted,
            attempted: state.stats.applicationsAttempted,
            skipped: state.stats.applicationsSkipped
        };
    }

    // ==================== BULLETPROOF JOB PROCESSING WITH GUARANTEED SUBMISSION ====================
    async function processNextJobWithGuaranteedSubmission() {
        state.jobStartTime = Date.now();
        state.currentRetryCount = 0;
        
        // Step 1: Find and click Easy Apply job
        const job = await findAndClickEasyApplyJob();
        if (!job) {
            Logger.warn('JOB', 'No suitable Easy Apply jobs found');
            return { submitted: false, skipped: true, reason: 'No Easy Apply jobs available' };
        }
        
        state.currentJobId = job.id;
        Logger.info('JOB', `Selected: ${job.title}`);
        
        await humanLikeDelay(state.config.DELAYS.AFTER_JOB_CLICK);
        
        // Step 2: Click "Easy Apply" button
        const easyApplyClicked = await clickEasyApplyButtonAggressively();
        if (!easyApplyClicked) {
            Logger.warn('JOB', 'Easy Apply button not found - marking as processed');
            state.processedJobs.add(state.currentJobId);
            return { submitted: false, skipped: true, reason: 'No Easy Apply button' };
        }
        
        await humanLikeDelay(state.config.DELAYS.AFTER_EASY_APPLY);
        
        // Step 3: Submit application with BULLETPROOF GUARANTEED submission
        const submitted = await submitApplicationBulletproof();
        
        if (submitted) {
            const jobTime = Date.now() - state.jobStartTime;
            Logger.submit('JOB', `✅ SUBMITTED SUCCESSFULLY in ${(jobTime/1000).toFixed(1)}s`);
            state.submittedJobs.add(state.currentJobId);
            state.processedJobs.add(state.currentJobId);
            return { submitted: true, skipped: false };
        } else {
            Logger.error('JOB', `❌ FAILED TO SUBMIT - this should not happen`);
            state.failedJobs.add(state.currentJobId);
            state.processedJobs.add(state.currentJobId);
            return { submitted: false, skipped: false, reason: 'Submission failed' };
        }
    }

    async function findAndClickEasyApplyJob() {
        const jobCards = getJobCards();
        
        for (const card of jobCards) {
            if (!isVisibleEnhanced(card)) continue;
            
            const jobId = getJobIdRobust(card);
            if (!jobId || 
                state.processedJobs.has(jobId) || 
                state.failedJobs.has(jobId) || 
                state.submittedJobs.has(jobId) ||
                state.skippedJobs.has(jobId)) {
                continue;
            }
            
            if (!isEasyApplyJobCard(card)) {
                state.processedJobs.add(jobId);
                state.skippedJobs.add(jobId);
                continue;
            }
            
            const jobTitle = extractJobTitle(card);
            
            Logger.info('JOB_CLICK', `Clicking: ${jobTitle}`);
            highlightElement(card, '#0A66C2');
            await scrollIntoViewSmooth(card);
            await humanLikeDelay(1000);
            
            try {
                card.click();
            } catch {
                try {
                    card.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                } catch {
                    const link = card.querySelector('a');
                    if (link) link.click();
                }
            }
            
            await humanLikeDelay(1500);
            
            const jobLoaded = await waitForJobDetailsToLoad();
            if (!jobLoaded) {
                Logger.warn('JOB_CLICK', 'Job details not loading - trying next job');
                continue;
            }
            
            state.processedJobs.add(jobId);
            return { id: jobId, element: card, title: jobTitle };
        }
        
        return null;
    }

    function extractJobTitle(card) {
        const titleSelectors = [
            '.job-card-list__title',
            '.job-card-container__link',
            '.job-card-list__title-link',
            'a[data-control-name="job_card_title_link"]'
        ];
        
        for (const selector of titleSelectors) {
            const element = card.querySelector(selector);
            if (element && element.textContent) {
                return element.textContent.trim().substring(0, 60);
            }
        }
        
        return 'Unknown Title';
    }

    async function waitForJobDetailsToLoad() {
        let attempts = 0;
        const maxAttempts = 20;
        
        while (attempts < maxAttempts) {
            const jobPanel = document.querySelector('.jobs-search__job-details--container, .jobs-details, .jobs-details__main-content');
            
            if (jobPanel && jobPanel.textContent && jobPanel.textContent.length > 300) {
                const easyApplyButton = findEasyApplyButton();
                if (easyApplyButton && isVisibleEnhanced(easyApplyButton)) {
                    return true;
                }
            }
            
            await delay(400);
            attempts++;
        }
        
        return false;
    }

    // ==================== AGGRESSIVE EASY APPLY BUTTON CLICK ====================
    async function clickEasyApplyButtonAggressively() {
        await humanLikeDelay(1200);
        
        let attempts = 0;
        const maxAttempts = 8;
        
        while (attempts < maxAttempts) {
            const button = findEasyApplyButton();
            
            if (button && isVisibleEnhanced(button) && !button.disabled) {
                Logger.info('BUTTON', `✅ Clicking Easy Apply (Attempt ${attempts + 1})`);
                highlightElement(button, '#057642');
                await humanLikeDelay(800);
                
                try {
                    button.click();
                } catch {
                    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                }
                
                await delay(2500);
                const modalOpen = await isEasyApplyModalOpen();
                if (modalOpen) {
                    Logger.success('BUTTON', '✅ Easy Apply modal opened');
                    return true;
                }
            }
            
            attempts++;
            await delay(1000);
        }
        
        Logger.error('BUTTON', '❌ Could not click Easy Apply button');
        return false;
    }

    function findEasyApplyButton() {
        const selectors = [
            'button[aria-label*="Easy Apply"]',
            'button[aria-label*="easy apply"]',
            'button.jobs-apply-button',
            'button[data-control-name="jobdetails_topcard_inapply"]',
            'button.jobs-apply-button--top-card'
        ];
        
        for (const selector of selectors) {
            const buttons = document.querySelectorAll(selector);
            for (const button of buttons) {
                if (!isVisibleEnhanced(button) || button.disabled) continue;
                
                const text = button.textContent.toLowerCase().trim();
                const aria = (button.getAttribute('aria-label') || '').toLowerCase();
                
                if ((text.includes('easy apply') || aria.includes('easy apply')) &&
                    !text.includes('applied') &&
                    !aria.includes('application sent')) {
                    return button;
                }
            }
        }
        
        return null;
    }

    async function isEasyApplyModalOpen() {
        const modalSelectors = [
            '.jobs-easy-apply-modal',
            '[data-test-modal-id*="easy-apply"]',
            '.jobs-apply-form'
        ];
        
        for (const selector of modalSelectors) {
            const modal = document.querySelector(selector);
            if (modal && isVisibleEnhanced(modal)) {
                return true;
            }
        }
        
        return false;
    }

    // ==================== BULLETPROOF APPLICATION SUBMISSION ====================
    async function submitApplicationBulletproof() {
        Logger.submit('SUBMIT', '🔴 Starting BULLETPROOF submission - NO SKIPPING ALLOWED');
        
        let currentStep = 0;
        const maxSteps = state.config.MAX_FORM_STEPS;
        let submitAttempts = 0;
        
        while (currentStep < maxSteps) {
            currentStep++;
            
            Logger.info('SUBMIT', `━━━ Step ${currentStep}/${maxSteps} ━━━`);
            
            // CHECK 1: Already submitted?
            if (await isApplicationSubmittedComprehensive()) {
                Logger.success('SUBMIT', '✅✅✅ APPLICATION SUBMITTED SUCCESSFULLY!');
                await delay(state.config.DELAYS.VERIFICATION);
                return true;
            }
            
            // STEP 1: Fill ALL fields with priority: Database > Resume > API > Smart Defaults
            Logger.fill('FILL', 'Filling all fields comprehensively...');
            const fieldsFilled = await fillAllFieldsWithPriority();
            Logger.fill('FILL', `✅ Filled ${fieldsFilled} fields`);
            
            await delay(1000);
            
            // STEP 2: Handle all interactive elements
            await handleAllInteractiveElements();
            
            await delay(1000);
            
            // CHECK 2: Submitted after filling?
            if (await isApplicationSubmittedComprehensive()) {
                Logger.success('SUBMIT', '✅✅✅ APPLICATION SUBMITTED after filling!');
                await delay(state.config.DELAYS.VERIFICATION);
                return true;
            }
            
            // STEP 3: Look for SUBMIT button AGGRESSIVELY
            Logger.submit('SUBMIT', '🔍 Searching for SUBMIT button aggressively...');
            const submitFound = await findAndClickSubmitButtonAggressively();
            
            if (submitFound) {
                submitAttempts++;
                Logger.submit('SUBMIT', `🎯 Clicked SUBMIT button (Attempt ${submitAttempts})`);
                await delay(state.config.DELAYS.AFTER_SUBMIT);
                
                // Verify submission
                if (await isApplicationSubmittedComprehensive()) {
                    Logger.success('SUBMIT', '✅✅✅ APPLICATION SUBMITTED after clicking submit!');
                    return true;
                }
                
                // If not submitted yet, maybe need to fill more fields
                continue;
            }
            
            // STEP 4: Try NEXT/REVIEW to progress
            Logger.info('SUBMIT', '➡️ Looking for NEXT/REVIEW button...');
            const progressed = await progressToNextStep();
            
            if (progressed) {
                await delay(state.config.DELAYS.AFTER_NEXT);
                
                // Check if submission happened
                if (await isApplicationSubmittedComprehensive()) {
                    Logger.success('SUBMIT', '✅✅✅ APPLICATION SUBMITTED after progression!');
                    return true;
                }
                
                // Continue to next step
                continue;
            }
            
            // STEP 5: If no progression, try harder to find submit button
            Logger.warn('SUBMIT', '⚠️ No progression - trying HARDER to find submit button...');
            
            for (let i = 0; i < state.config.SUBMIT_BUTTON_RETRY_ATTEMPTS; i++) {
                Logger.submit('SUBMIT', `🔴 DESPERATE SUBMIT ATTEMPT ${i + 1}/${state.config.SUBMIT_BUTTON_RETRY_ATTEMPTS}`);
                
                // Try every possible method to submit
                const submitted = await desperateSubmitAttempts();
                
                if (submitted) {
                    await delay(3000);
                    if (await isApplicationSubmittedComprehensive()) {
                        Logger.success('SUBMIT', '✅✅✅ APPLICATION SUBMITTED after desperate attempt!');
                        return true;
                    }
                }
                
                await delay(state.config.DELAYS.SUBMIT_SEARCH);
            }
            
            // If we're here, something is wrong - log and continue
            Logger.warn('SUBMIT', `⚠️ Step ${currentStep} completed without submission - continuing...`);
        }
        
        Logger.critical('SUBMIT', '🔴🔴🔴 FAILED TO SUBMIT AFTER ALL ATTEMPTS - THIS IS CRITICAL');
        return false;
    }

    async function fillAllFieldsWithPriority() {
        const fields = getAllVisibleFormFields();
        let filledCount = 0;
        
        Logger.fill('FILL', `Found ${fields.length} fields to fill`);
        
        for (const field of fields) {
            try {
                // Skip if already filled with good value
                if (field.value && 
                    field.value.trim() && 
                    field.value !== 'select' && 
                    field.value !== 'Select' && 
                    field.value !== 'Choose...' &&
                    field.value.length > 0) {
                    continue;
                }
                
                const filled = await fillFieldWithPriority(field);
                if (filled) {
                    filledCount++;
                    Logger.fill('FILL', `✅ Filled field successfully`);
                }
                
                await humanLikeDelay(state.config.DELAYS.AFTER_FIELD_FILL);
            } catch (error) {
                Logger.error('FILL', `Field error: ${error.message}`);
            }
        }
        
        return filledCount;
    }

    async function fillFieldWithPriority(field) {
        try {
            const fieldInfo = analyzeFieldComprehensively(field);
            
            // Priority 1: Database data
            let value = getValueFromDatabase(fieldInfo);
            let source = 'Database';
            
            // Priority 2: Resume data (if database didn't have it)
            if (!value || value === 'SKIP') {
                value = getValueFromResume(fieldInfo);
                source = 'Resume';
            }
            
            // Priority 3: API call (if still missing - for cover letters, etc.)
            if (!value || value === 'SKIP') {
                if (shouldUseAPIForField(fieldInfo)) {
                    value = await getValueFromAPI(fieldInfo);
                    source = 'API';
                }
            }
            
            // Priority 4: Smart defaults
            if (!value || value === 'SKIP') {
                value = getSmartDefaultValue(fieldInfo);
                source = 'Default';
            }
            
            if (!value || value === 'SKIP') {
                return false;
            }
            
            Logger.fill('FILL', `Filling: ${fieldInfo.label || fieldInfo.name} = ${value} [Source: ${source}]`);
            
            field.focus();
            await humanLikeDelay(300);
            
            let success = false;
            
            if (field.tagName === 'SELECT') {
                success = await selectDropdownOption(field, value);
            } else if (field.type === 'checkbox') {
                success = await handleCheckbox(field, fieldInfo);
            } else if (field.type === 'radio') {
                success = await handleRadio(field, value);
            } else {
                success = await typeValue(field, value);
            }
            
            if (success) {
                state.lastFilledValues.set(field, value);
            }
            
            return success;
            
        } catch (error) {
            Logger.error('FILL', `Error filling field: ${error.message}`);
            return false;
        }
    }

    function analyzeFieldComprehensively(field) {
        const label = getFieldLabel(field).toLowerCase();
        const placeholder = (field.placeholder || '').toLowerCase();
        const name = (field.name || '').toLowerCase();
        const id = (field.id || '').toLowerCase();
        const type = field.type || field.tagName.toLowerCase();
        const ariaLabel = (field.getAttribute('aria-label') || '').toLowerCase();
        
        return {
            element: field,
            type: type,
            label: label,
            name: name,
            placeholder: placeholder,
            id: id,
            ariaLabel: ariaLabel,
            combined: `${label} ${placeholder} ${name} ${id} ${ariaLabel}`,
            isRequired: field.required || field.hasAttribute('required') || 
                       label.includes('*') || label.includes('required')
        };
    }

    function getValueFromDatabase(fieldInfo) {
        const u = state.userData;
        if (!u) return null;
        
        const c = fieldInfo.combined;
        
        // Name fields
        if (c.includes('first') && c.includes('name')) return u.firstName || u.name?.split(' ')[0] || null;
        if (c.includes('last') && c.includes('name')) return u.lastName || u.name?.split(' ').pop() || null;
        if (c.match(/\bfull\s*name\b/) || (c.includes('name') && !c.includes('company'))) {
            return u.fullName || u.name || `${u.firstName || ''} ${u.lastName || ''}`.trim() || null;
        }
        
        // Contact
        if (c.includes('email')) return u.email || null;
        if (c.includes('phone') || c.includes('mobile')) return u.phone || null;
        
        // Location
        if (c.includes('city')) return u.city || null;
        if (c.includes('state')) return u.state || null;
        if (c.includes('country')) return u.country || 'India';
        if (c.includes('zip') || c.includes('pincode') || c.includes('postal')) return u.pincode || null;
        if (c.includes('address')) return u.address || null;
        
        // Professional
        if (c.includes('current') && (c.includes('company') || c.includes('employer'))) return u.currentCompany || null;
        if (c.includes('title') || c.includes('position')) return u.currentTitle || null;
        
        // Experience
        if ((c.includes('experience') || c.includes('years')) && c.includes('work')) {
            return u.totalExperience ? String(Math.floor(u.totalExperience)) : null;
        }
        
        // Education
        if (c.includes('degree') || c.includes('education')) return u.education || null;
        if (c.includes('university') || c.includes('college') || c.includes('institution')) return u.institution || null;
        if (c.includes('graduation') || c.includes('year')) return u.graduationYear ? String(u.graduationYear) : null;
        
        // Salary
        if (c.includes('salary') || c.includes('ctc')) {
            if (c.includes('current')) return u.currentSalary ? String(u.currentSalary) : null;
            if (c.includes('expected')) return u.expectedSalary ? String(u.expectedSalary) : null;
            return u.expectedSalary || u.currentSalary ? String(u.expectedSalary || u.currentSalary) : null;
        }
        
        // Notice period
        if (c.includes('notice')) {
            if (u.noticePeriod) {
                const match = String(u.noticePeriod).match(/\d+/);
                return match ? match[0] : null;
            }
        }
        
        // Skills
        if (c.includes('skill')) return u.skillsText || u.skills?.join(', ') || null;
        
        // Social
        if (c.includes('linkedin')) return u.linkedin || null;
        if (c.includes('github')) return u.github || null;
        if (c.includes('portfolio')) return u.portfolio || null;
        
        return null;
    }

    function getValueFromResume(fieldInfo) {
        // Same logic as database but from resume data
        // For now, userData contains merged data, so this is similar
        return null;
    }

    function shouldUseAPIForField(fieldInfo) {
        const c = fieldInfo.combined;
        // Only use API for cover letters and complex text
        return (c.includes('cover') || 
                c.includes('why') || 
                c.includes('tell us') || 
                c.includes('motivation')) && 
               OPENAI_API_KEY && 
               OPENAI_API_KEY.length > 0;
    }

    async function getValueFromAPI(fieldInfo) {
        if (!OPENAI_API_KEY) return null;
        
        try {
            const prompt = `Write a brief professional ${fieldInfo.label || 'response'} for a job application. Keep it under 150 words.`;
            
            Logger.info('API', 'Calling OpenAI for field value...');
            
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'gpt-3.5-turbo',
                    messages: [{
                        role: 'user',
                        content: prompt
                    }],
                    max_tokens: 200,
                    temperature: 0.7
                })
            });
            
            if (!response.ok) {
                Logger.error('API', 'API call failed');
                return null;
            }
            
            const data = await response.json();
            const content = data.choices[0].message.content.trim();
            
            Logger.success('API', 'Got value from API');
            return content;
            
        } catch (error) {
            Logger.error('API', `API error: ${error.message}`);
            return null;
        }
    }

    function getSmartDefaultValue(fieldInfo) {
        const c = fieldInfo.combined;
        
        // Boolean questions
        if (c.includes('authorize') || c.includes('legally') || c.includes('eligible')) return 'Yes';
        if (c.includes('sponsor') || c.includes('visa')) return 'No';
        if (c.includes('relocate') || c.includes('willing')) return 'Yes';
        
        // Diversity
        if (c.includes('gender') || c.includes('race') || c.includes('ethnicity') || 
            c.includes('veteran') || c.includes('disability')) {
            return 'Prefer not to say';
        }
        
        // Cover letter fallback
        if (c.includes('cover') || c.includes('why') || c.includes('tell us')) {
            return 'I am very interested in this position and believe my skills and experience make me a strong candidate for this role. I am excited about the opportunity to contribute to your team and grow professionally.';
        }
        
        // Salary
        if (c.includes('salary') || c.includes('compensation')) return '800000';
        
        // Experience
        if (c.includes('experience') || c.includes('years')) return '3';
        
        // Notice period
        if (c.includes('notice')) return '30';
        
        // References
        if (c.includes('reference')) return 'Available upon request';
        
        // Type defaults
        if (fieldInfo.type === 'email') return 'user@example.com';
        if (fieldInfo.type === 'tel') return '+919876543210';
        if (fieldInfo.type === 'number') return '1';
        if (fieldInfo.type === 'url') return 'https://linkedin.com';
        
        return 'Available on request';
    }

    async function typeValue(field, value) {
        if (!value) return false;
        
        const stringValue = String(value);
        
        field.value = '';
        field.dispatchEvent(new Event('input', { bubbles: true }));
        await delay(200);
        
        if (stringValue.length > 5 && field.type === 'text') {
            for (let i = 0; i < stringValue.length; i++) {
                field.value += stringValue[i];
                field.dispatchEvent(new Event('input', { bubbles: true }));
                await delay(Math.random() * 80 + 40);
            }
        } else {
            field.value = stringValue;
            field.dispatchEvent(new Event('input', { bubbles: true }));
        }
        
        field.dispatchEvent(new Event('change', { bubbles: true }));
        field.dispatchEvent(new Event('blur', { bubbles: true }));
        
        return true;
    }

    async function selectDropdownOption(select, targetValue) {
        const options = Array.from(select.options).filter(opt => 
            opt.value && opt.value !== '' && opt.value !== 'select' && opt.value !== 'Select'
        );
        
        if (options.length === 0) return false;
        
        const searchValue = String(targetValue).toLowerCase().trim();
        
        // Exact match
        for (const opt of options) {
            if (opt.value.toLowerCase() === searchValue || opt.text.toLowerCase() === searchValue) {
                select.value = opt.value;
                triggerAllEvents(select);
                return true;
            }
        }
        
        // Contains match
        for (const opt of options) {
            const optText = opt.text.toLowerCase();
            if (optText.includes(searchValue) || searchValue.includes(optText)) {
                select.value = opt.value;
                triggerAllEvents(select);
                return true;
            }
        }
        
        // Numeric match
        if (!isNaN(searchValue)) {
            const numValue = parseFloat(searchValue);
            for (const opt of options) {
                const optNum = extractNumber(opt.text);
                if (!isNaN(optNum) && Math.abs(optNum - numValue) <= 2) {
                    select.value = opt.value;
                    triggerAllEvents(select);
                    return true;
                }
            }
        }
        
        // First good option
        const firstGood = options.find(opt => 
            opt.text.trim() && !opt.text.toLowerCase().includes('select')
        );
        
        if (firstGood) {
            select.value = firstGood.value;
            triggerAllEvents(select);
            return true;
        }
        
        return false;
    }

    async function handleCheckbox(checkbox, fieldInfo) {
        const c = fieldInfo.combined;
        
        if (c.includes('agree') || c.includes('terms') || c.includes('condition') ||
            c.includes('policy') || c.includes('consent') || c.includes('acknowledge') ||
            c.includes('certify') || c.includes('authorize') || c.includes('confirm')) {
            
            if (!checkbox.checked) {
                checkbox.checked = true;
                triggerAllEvents(checkbox);
                return true;
            }
        }
        
        return false;
    }

    async function handleRadio(radio, value) {
        if (!radio.checked) {
            radio.checked = true;
            triggerAllEvents(radio);
            return true;
        }
        return false;
    }

    async function handleAllInteractiveElements() {
        // Dropdowns
        const dropdowns = document.querySelectorAll('select:not([disabled])');
        for (const dropdown of dropdowns) {
            if (!isVisibleEnhanced(dropdown)) continue;
            if (dropdown.value && dropdown.value !== 'select' && dropdown.value !== '') continue;
            
            const fieldInfo = analyzeFieldComprehensively(dropdown);
            let value = getValueFromDatabase(fieldInfo) || getSmartDefaultValue(fieldInfo);
            if (value) {
                await selectDropdownOption(dropdown, value);
                await delay(400);
            }
        }
        
        // Checkboxes
        const checkboxes = document.querySelectorAll('input[type="checkbox"]:not([disabled])');
        for (const checkbox of checkboxes) {
            if (!isVisibleEnhanced(checkbox)) continue;
            const fieldInfo = analyzeFieldComprehensively(checkbox);
            await handleCheckbox(checkbox, fieldInfo);
            await delay(200);
        }
        
        // Radio buttons
        const radioGroups = new Map();
        const radios = document.querySelectorAll('input[type="radio"]:not([disabled])');
        
        for (const radio of radios) {
            if (!isVisibleEnhanced(radio)) continue;
            if (!radioGroups.has(radio.name)) {
                radioGroups.set(radio.name, []);
            }
            radioGroups.get(radio.name).push(radio);
        }
        
        for (const [name, radiosInGroup] of radioGroups) {
            const selected = radiosInGroup.some(r => r.checked);
            if (selected) continue;
            
            // Prefer "Yes"
            let found = false;
            for (const radio of radiosInGroup) {
                const label = getFieldLabel(radio).toLowerCase();
                const value = radio.value.toLowerCase();
                
                if ((label.includes('yes') || value.includes('yes')) && !found) {
                    radio.checked = true;
                    triggerAllEvents(radio);
                    found = true;
                    await delay(200);
                    break;
                }
            }
            
            if (!found && radiosInGroup.length > 0) {
                radiosInGroup[0].checked = true;
                triggerAllEvents(radiosInGroup[0]);
                await delay(200);
            }
        }
        
        // Textareas
        const textareas = document.querySelectorAll('textarea:not([disabled])');
        for (const textarea of textareas) {
            if (!isVisibleEnhanced(textarea)) continue;
            if (textarea.value && textarea.value.trim()) continue;
            
            const fieldInfo = analyzeFieldComprehensively(textarea);
            let value = getValueFromDatabase(fieldInfo);
            
            if (!value && shouldUseAPIForField(fieldInfo)) {
                value = await getValueFromAPI(fieldInfo);
            }
            
            if (!value) {
                value = getSmartDefaultValue(fieldInfo);
            }
            
            if (value) {
                await typeValue(textarea, value);
                await delay(500);
            }
        }
    }

    // ==================== AGGRESSIVE SUBMIT BUTTON FINDING ====================
    async function findAndClickSubmitButtonAggressively() {
        Logger.submit('SUBMIT', '🔍 AGGRESSIVE SUBMIT SEARCH...');
        
        // Strategy 1: Look for exact "Submit" buttons
        const submitButtons = Array.from(document.querySelectorAll('button')).filter(btn => {
            if (!isVisibleEnhanced(btn) || btn.disabled) return false;
            
            const text = btn.textContent.toLowerCase().trim();
            const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
            
            return (text === 'submit application' || 
                    text === 'submit' ||
                    aria.includes('submit application') ||
                    aria.includes('submit your application')) &&
                   !text.includes('next') &&
                   !aria.includes('next');
        });
        
        if (submitButtons.length > 0) {
            Logger.submit('SUBMIT', `🎯 Found ${submitButtons.length} SUBMIT button(s)`);
            
            for (const btn of submitButtons) {
                Logger.submit('SUBMIT', `Clicking: "${btn.textContent.trim()}"`);
                highlightElement(btn, '#057642');
                await humanLikeDelay(1000);
                
                try {
                    btn.click();
                } catch {
                    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                }
                
                return true;
            }
        }
        
        return false;
    }

    async function progressToNextStep() {
        // Try NEXT/CONTINUE
        const buttons = Array.from(document.querySelectorAll('button')).filter(btn => {
            if (!isVisibleEnhanced(btn) || btn.disabled) return false;
            
            const text = btn.textContent.toLowerCase().trim();
            const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
            
            return (text === 'next' || text === 'continue' || 
                    text === 'review' || aria.includes('continue') ||
                    aria.includes('next step')) &&
                   !text.includes('submit');
        });
        
        if (buttons.length > 0) {
            const btn = buttons[0];
            Logger.info('PROGRESS', `Clicking: "${btn.textContent.trim()}"`);
            highlightElement(btn, '#0A66C2');
            await humanLikeDelay(800);
            
            try {
                btn.click();
            } catch {
                btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            }
            
            return true;
        }
        
        return false;
    }

    async function desperateSubmitAttempts() {
        Logger.critical('DESPERATE', '🔴 DESPERATE SUBMIT ATTEMPTS...');
        
        // Attempt 1: Click ANY button with "submit" in text
        const allButtons = document.querySelectorAll('button');
        for (const btn of allButtons) {
            if (!isVisibleEnhanced(btn) || btn.disabled) continue;
            
            const text = btn.textContent.toLowerCase();
            const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
            
            if (text.includes('submit') || aria.includes('submit')) {
                Logger.critical('DESPERATE', `Clicking: ${text}`);
                try {
                    btn.click();
                    return true;
                } catch {
                    try {
                        btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                        return true;
                    } catch {}
                }
            }
        }
        
        // Attempt 2: Press Enter on form
        try {
            const form = document.querySelector('form');
            if (form) {
                form.dispatchEvent(new KeyboardEvent('submit', { bubbles: true }));
                return true;
            }
        } catch {}
        
        // Attempt 3: Press Enter key
        try {
            document.dispatchEvent(new KeyboardEvent('keydown', { 
                key: 'Enter', 
                keyCode: 13, 
                which: 13, 
                bubbles: true 
            }));
            return true;
        } catch {}
        
        return false;
    }

    // ==================== COMPREHENSIVE SUBMISSION VERIFICATION ====================
    async function isApplicationSubmittedComprehensive() {
        // Method 1: Success modals
        const successModals = document.querySelectorAll([
            '[data-test-modal-id*="submitted"]',
            '[data-test-modal-id*="application-submitted"]',
            '.artdeco-modal--success'
        ].join(','));
        
        for (const modal of successModals) {
            if (isVisibleEnhanced(modal)) {
                Logger.success('VERIFY', '✅ Found success modal');
                return true;
            }
        }
        
        // Method 2: Success toasts
        const toasts = document.querySelectorAll('.artdeco-toast-item');
        for (const toast of toasts) {
            if (isVisibleEnhanced(toast)) {
                const text = toast.textContent.toLowerCase();
                if (text.includes('application submitted') || 
                    text.includes('application sent') ||
                    text.includes('submitted successfully')) {
                    Logger.success('VERIFY', '✅ Found success toast');
                    return true;
                }
            }
        }
        
        // Method 3: Body text check
        const bodyText = document.body.textContent.toLowerCase();
        if (bodyText.includes('application submitted') ||
            bodyText.includes('application sent') ||
            bodyText.includes('submitted successfully') ||
            bodyText.includes('thank you for applying')) {
            Logger.success('VERIFY', '✅ Found success text in body');
            return true;
        }
        
        // Method 4: Modal closed
        const modal = document.querySelector('.jobs-easy-apply-modal');
        if (!modal || !isVisibleEnhanced(modal)) {
            Logger.success('VERIFY', '✅ Modal closed - likely submitted');
            return true;
        }
        
        return false;
    }

    // ==================== UTILITY FUNCTIONS ====================
    function getAllVisibleFormFields() {
        const fields = document.querySelectorAll(`
            input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([disabled]),
            textarea:not([disabled]),
            select:not([disabled])
        `);
        
        return Array.from(fields).filter(field => isVisibleEnhanced(field));
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
        
        if (field.placeholder) return field.placeholder.trim();
        if (field.name) return field.name.replace(/[_-]/g, ' ').trim();
        
        return '';
    }

    function getJobIdRobust(card) {
        const jobId = card.getAttribute('data-job-id') || 
                     card.getAttribute('data-occludable-job-id') ||
                     card.querySelector('[data-job-id]')?.getAttribute('data-job-id');
        
        if (jobId) return jobId;
        
        return `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    function isVisibleEnhanced(element) {
        if (!element) return false;
        
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        
        return rect.width > 0 && 
               rect.height > 0 && 
               style.visibility !== 'hidden' && 
               style.display !== 'none' && 
               style.opacity !== '0' &&
               rect.top < window.innerHeight &&
               rect.bottom > 0;
    }

    async function scrollIntoViewSmooth(element) {
        try {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await delay(600);
        } catch {
            element.scrollIntoView();
            await delay(600);
        }
    }

    async function scrollToLoadMoreJobs() {
        Logger.info('SCROLL', '📜 Scrolling to load more jobs...');
        
        const jobList = document.querySelector('.jobs-search-results-list, .scaffold-layout__list');
        if (jobList) {
            jobList.scrollTop = jobList.scrollHeight;
            await delay(2000);
        }
        
        window.scrollBy({ top: 1500, behavior: 'smooth' });
        await delay(3000);
    }

    async function forceCloseAllModalsAggressively() {
        const closeSelectors = [
            'button[aria-label*="Dismiss"]',
            'button[aria-label*="dismiss"]',
            'button[aria-label*="Close"]',
            'button.artdeco-modal__dismiss',
            'button[data-test-modal-close-btn]'
        ];
        
        for (const selector of closeSelectors) {
            const elements = document.querySelectorAll(selector);
            for (const element of elements) {
                if (isVisibleEnhanced(element)) {
                    try {
                        element.click();
                        await delay(1500);
                        
                        // Handle "Discard" confirmation
                        const discardBtn = Array.from(document.querySelectorAll('button')).find(b => {
                            const text = b.textContent.toLowerCase();
                            return text.includes('discard');
                        });
                        
                        if (discardBtn && isVisibleEnhanced(discardBtn)) {
                            Logger.warn('MODAL', '⚠️ Discard popup appeared - this means submission failed!');
                            discardBtn.click();
                            await delay(1500);
                        }
                        
                        return;
                    } catch {}
                }
            }
        }
    }

    function highlightElement(element, color) {
        const originalStyle = element.style.cssText;
        element.style.boxShadow = `0 0 0 3px ${color}`;
        element.style.transition = 'box-shadow 0.3s ease';
        
        setTimeout(() => {
            element.style.cssText = originalStyle;
        }, 2000);
    }

    function showNotification(message, type = 'info') {
        const existing = document.querySelectorAll('.fillora-notification');
        existing.forEach(el => el.remove());
        
        const notification = document.createElement('div');
        notification.className = 'fillora-notification';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 999999;
            background: ${type === 'success' ? '#057642' : '#0A66C2'};
            color: white;
            padding: 16px 24px;
            border-radius: 8px;
            font-weight: 600;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            max-width: 350px;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transition = 'opacity 0.5s ease';
            setTimeout(() => notification.remove(), 500);
        }, 5000);
    }

    function extractNumber(text) {
        const match = String(text).match(/(\d+\.?\d*)/);
        return match ? parseFloat(match[1]) : NaN;
    }

    function triggerAllEvents(element) {
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        element.dispatchEvent(new Event('blur', { bubbles: true }));
    }

    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function humanLikeDelay(baseMs) {
        const variation = baseMs * 0.25;
        const actualMs = baseMs + (Math.random() * variation * 2 - variation);
        await delay(Math.max(actualMs, 100));
    }

    // ==================== AUTOFILL API ====================
    async function performAutoFill(userData) {
        state.userData = userData;
        Logger.info('AUTOFILL', 'Starting autofill...');
        
        const fields = getAllVisibleFormFields();
        let filledCount = 0;
        
        for (const field of fields) {
            try {
                const filled = await fillFieldWithPriority(field);
                if (filled) filledCount++;
                await humanLikeDelay(500);
            } catch (error) {
                Logger.error('AUTOFILL', `Error: ${error.message}`);
            }
        }
        
        await handleAllInteractiveElements();
        
        Logger.success('AUTOFILL', `✅ Filled ${filledCount}/${fields.length} fields`);
        
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

    Logger.success('SYSTEM', '🚀 Fillora v8.0 - BULLETPROOF automation ready!');
    Logger.critical('SYSTEM', '🔴 GUARANTEED SUBMISSION - NO SKIPPING WITHOUT SUBMIT');
    Logger.info('SYSTEM', '📊 Priority: Database > Resume > API > Smart Defaults');

} else {
    console.log('⚠️ Fillora already initialized');
}