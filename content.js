// Fillora Chrome Extension - PRODUCTION-GRADE LINKEDIN AUTOMATION
// Built for reliability, scalability, and user trust
// Version: 2.0 - Enterprise Edition

console.log('🚀 [FILLORA PRO] Initializing enterprise-grade automation system...');

if (typeof window.filloraInitialized === 'undefined') {
    window.filloraInitialized = true;
    
    // Import API key from config.js (loaded via manifest.json)
    const OPENAI_API_KEY = window.FILLORA_CONFIG?.OPENAI_API_KEY_CONTENT || '';
    
    // Verify configuration loaded
    if (!OPENAI_API_KEY) {
        console.error('❌ [FILLORA CONTENT] OpenAI API key not loaded from config.js!');
        console.error('Check manifest.json: config.js must be loaded before content.js');
    } else {
        console.log('✅ [FILLORA CONTENT] OpenAI API key loaded from config.js');
    }
    
    // ==================== ENTERPRISE STATE MANAGEMENT ====================
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
            successRate: 0,
            errors: [],
            startTime: null,
            endTime: null
        },
        config: {
            MAX_JOBS: window.FILLORA_CONFIG?.MAX_JOBS || 5,
            MAX_RETRIES_PER_JOB: window.FILLORA_CONFIG?.MAX_ATTEMPTS_PER_JOB || 3,
            MAX_TOTAL_ATTEMPTS: 25,
            SUBMISSION_TIMEOUT: window.FILLORA_CONFIG?.SUBMISSION_TIMEOUT || 120000,
            MAX_CONSECUTIVE_FAILURES: 7,
            DELAYS: window.FILLORA_CONFIG?.DELAYS || {
                AFTER_JOB_CLICK: 2500,
                AFTER_EASY_APPLY: 2500,
                AFTER_FIELD_FILL: 150,
                AFTER_NEXT: 2000,
                AFTER_SUBMIT: 5000,
                BETWEEN_JOBS: 2500,
                VERIFICATION: 2500,
                ERROR_RECOVERY: 1500
            }
        }
    };

    // ==================== ENTERPRISE LOGGING SYSTEM ====================
    const Logger = {
        log: (level, category, message, data = {}) => {
            const timestamp = new Date().toISOString();
            const logEntry = {
                timestamp,
                level,
                category,
                message,
                data,
                jobId: state.currentJobId
            };
            
            const emoji = {
                'INFO': 'ℹ️',
                'SUCCESS': '✅',
                'WARNING': '⚠️',
                'ERROR': '❌',
                'DEBUG': '🔍'
            }[level] || '📝';
            
            console.log(`${emoji} [${level}] [${category}] ${message}`, data);
            
            // Store critical errors
            if (level === 'ERROR') {
                state.stats.errors.push(logEntry);
            }
            
            return logEntry;
        },
        
        info: (category, message, data) => Logger.log('INFO', category, message, data),
        success: (category, message, data) => Logger.log('SUCCESS', category, message, data),
        warn: (category, message, data) => Logger.log('WARNING', category, message, data),
        error: (category, message, data) => Logger.log('ERROR', category, message, data),
        debug: (category, message, data) => Logger.log('DEBUG', category, message, data)
    };

    // ==================== ENTERPRISE ERROR HANDLER ====================
    class FilloraError extends Error {
        constructor(message, code, recoverable = true, context = {}) {
            super(message);
            this.name = 'FilloraError';
            this.code = code;
            this.recoverable = recoverable;
            this.context = context;
            this.timestamp = Date.now();
        }
    }

    const ErrorHandler = {
        handle: async (error, context = {}) => {
            Logger.error('ERROR_HANDLER', error.message, {
                code: error.code,
                recoverable: error.recoverable,
                context: error.context,
                stack: error.stack
            });
            
            // Attempt recovery based on error type
            if (error.recoverable) {
                return await ErrorHandler.attemptRecovery(error, context);
            }
            
            return false;
        },
        
        attemptRecovery: async (error, context) => {
            Logger.info('ERROR_RECOVERY', `Attempting recovery for: ${error.code}`);
            
            try {
                // Close any stuck modals
                await closeAllModals();
                await delay(state.config.DELAYS.ERROR_RECOVERY);
                
                // Clear any stuck states
                document.querySelectorAll('.fillora-highlight').forEach(el => {
                    el.classList.remove('fillora-highlight');
                });
                
                return true;
            } catch (recoveryError) {
                Logger.error('ERROR_RECOVERY', 'Recovery failed', { error: recoveryError.message });
                return false;
            }
        }
    };

    // ==================== INITIALIZATION ====================
    function initialize() {
        state.isActive = true;
        setupMessageListener();
        setupGlobalErrorHandlers();
        Logger.success('INIT', 'Enterprise automation system initialized');
    }

    function setupMessageListener() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            Logger.info('MESSAGE', `Received: ${request.action}`);
            
            (async () => {
                try {
                    if (request.action === 'START_LINKEDIN_AUTOMATION') {
                        const result = await startLinkedInAutomation(request.userData);
                        sendResponse(result);
                    } else if (request.action === 'PERFORM_AUTOFILL') {
                        const result = await performAutoFill(request.userData);
                        sendResponse(result);
                    } else {
                        sendResponse({ success: false, error: 'Unknown action' });
                    }
                } catch (error) {
                    const handled = await ErrorHandler.handle(error, { action: request.action });
                    sendResponse({ success: false, error: error.message, handled });
                }
            })();
            
            return true;
        });
    }

    function setupGlobalErrorHandlers() {
        window.addEventListener('error', (event) => {
            Logger.error('GLOBAL_ERROR', 'Uncaught error', {
                message: event.message,
                filename: event.filename,
                lineno: event.lineno
            });
        });
        
        window.addEventListener('unhandledrejection', (event) => {
            Logger.error('UNHANDLED_REJECTION', 'Unhandled promise rejection', {
                reason: event.reason
            });
        });
    }

    // ==================== MAIN AUTOMATION ORCHESTRATOR ====================
    async function startLinkedInAutomation(userData) {
        Logger.info('AUTOMATION', '🚀 Starting production-grade LinkedIn automation');
        
        if (state.isProcessing) {
            throw new FilloraError('Automation already in progress', 'ALREADY_RUNNING', false);
        }
        
        // Reset state
        state.isProcessing = true;
        state.userData = userData;
        state.stats = {
            applicationsSubmitted: 0,
            applicationsAttempted: 0,
            applicationsSkipped: 0,
            totalAttempts: 0,
            successRate: 0,
            errors: [],
            startTime: Date.now(),
            endTime: null
        };
        state.processedJobs.clear();
        state.failedJobs.clear();
        
        try {
            // Step 1: Verify we're on LinkedIn with Easy Apply filter
            await ensureCorrectPage();
            
            // Step 2: Main processing loop
            const result = await processJobsMainLoop();
            
            // Step 3: Calculate final statistics
            state.stats.endTime = Date.now();
            state.stats.successRate = state.stats.totalAttempts > 0 
                ? Math.round((state.stats.applicationsSubmitted / state.stats.totalAttempts) * 100) 
                : 0;
            
            const duration = ((state.stats.endTime - state.stats.startTime) / 1000).toFixed(1);
            
            Logger.success('AUTOMATION', `Completed in ${duration}s`, {
                submitted: state.stats.applicationsSubmitted,
                attempted: state.stats.applicationsAttempted,
                skipped: state.stats.applicationsSkipped,
                successRate: `${state.stats.successRate}%`
            });
            
            return {
                success: true,
                applicationsSubmitted: state.stats.applicationsSubmitted,
                applicationsAttempted: state.stats.applicationsAttempted,
                applicationsSkipped: state.stats.applicationsSkipped,
                totalAttempts: state.stats.totalAttempts,
                successRate: state.stats.successRate,
                duration: parseFloat(duration),
                errors: state.stats.errors.length
            };
            
        } catch (error) {
            Logger.error('AUTOMATION', 'Fatal error in automation', { error: error.message });
            throw error;
        } finally {
            state.isProcessing = false;
            await closeAllModals();
        }
    }

    async function ensureCorrectPage() {
        Logger.info('NAVIGATION', 'Verifying LinkedIn jobs page with Easy Apply filter');
        
        const currentUrl = window.location.href;
        const isOnLinkedIn = currentUrl.includes('linkedin.com/jobs');
        const hasEasyApplyFilter = currentUrl.includes('f_AL=true');
        
        if (!isOnLinkedIn || !hasEasyApplyFilter) {
            Logger.warn('NAVIGATION', 'Navigating to correct page');
            showNotification('⚡ Opening LinkedIn with Easy Apply filter...', 'info');
            
            window.location.href = 'https://www.linkedin.com/jobs/search/?f_AL=true&keywords=software%20engineer&location=India&sortBy=DD';
            await delay(10000);
        }
        
        // Verify filter is actually applied in UI
        await verifyEasyApplyFilterUI();
        
        Logger.success('NAVIGATION', 'On correct page with Easy Apply filter active');
    }

    async function verifyEasyApplyFilterUI() {
        // Check if Easy Apply filter button is active/pressed
        const filterButtons = document.querySelectorAll('button[aria-label*="Easy Apply"], button[aria-label*="easy apply"]');
        
        for (const button of filterButtons) {
            if (isVisible(button)) {
                const isActive = button.getAttribute('aria-pressed') === 'true' || 
                               button.classList.contains('selected') ||
                               button.classList.contains('active');
                
                if (!isActive) {
                    Logger.info('FILTER', 'Activating Easy Apply filter button');
                    button.click();
                    await delay(3000);
                }
                
                Logger.success('FILTER', 'Easy Apply filter verified active');
                return true;
            }
        }
        
        Logger.warn('FILTER', 'Could not find Easy Apply filter button, but URL filter is active');
        return true;
    }

    // ==================== MAIN PROCESSING LOOP ====================
    async function processJobsMainLoop() {
        Logger.info('MAIN_LOOP', `Starting main processing loop (Target: ${state.config.MAX_JOBS} jobs)`);
        
        let consecutiveFailures = 0;
        
        while (state.stats.applicationsSubmitted < state.config.MAX_JOBS) {
            state.stats.totalAttempts++;
            
            // Safety checks
            if (state.stats.totalAttempts > state.config.MAX_TOTAL_ATTEMPTS) {
                Logger.warn('MAIN_LOOP', 'Maximum total attempts reached');
                break;
            }
            
            if (consecutiveFailures >= state.config.MAX_CONSECUTIVE_FAILURES) {
                Logger.warn('MAIN_LOOP', 'Too many consecutive failures - might be out of jobs');
                await scrollToLoadMoreJobs();
                consecutiveFailures = 0;
                await delay(3000);
            }
            
            logProgress();
            
            try {
                const jobResult = await processNextJob();
                
                if (jobResult.submitted) {
                    state.stats.applicationsSubmitted++;
                    state.stats.applicationsAttempted++;
                    consecutiveFailures = 0;
                    
                    showNotification(`✅ Job ${state.stats.applicationsSubmitted}/${state.config.MAX_JOBS} submitted!`, 'success');
                    Logger.success('JOB_COMPLETE', `Job #${state.stats.applicationsSubmitted} submitted successfully`);
                    
                } else if (jobResult.skipped) {
                    state.stats.applicationsSkipped++;
                    consecutiveFailures++;
                    Logger.info('JOB_COMPLETE', `Job skipped: ${jobResult.reason}`);
                    
                } else {
                    state.stats.applicationsAttempted++;
                    consecutiveFailures++;
                    Logger.warn('JOB_COMPLETE', `Job failed: ${jobResult.reason}`);
                }
                
            } catch (error) {
                Logger.error('JOB_PROCESSING', 'Error processing job', { error: error.message });
                consecutiveFailures++;
                await ErrorHandler.handle(error, { loop: 'main' });
            }
            
            // Cleanup between jobs
            await closeAllModals();
            await delay(state.config.DELAYS.BETWEEN_JOBS);
        }
        
        Logger.success('MAIN_LOOP', 'Main processing loop completed');
        return {
            submitted: state.stats.applicationsSubmitted,
            attempted: state.stats.applicationsAttempted,
            skipped: state.stats.applicationsSkipped
        };
    }

    function logProgress() {
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`📊 ATTEMPT ${state.stats.totalAttempts}`);
        console.log(`✅ Submitted: ${state.stats.applicationsSubmitted}/${state.config.MAX_JOBS}`);
        console.log(`🎯 Attempted: ${state.stats.applicationsAttempted}`);
        console.log(`⏭️  Skipped: ${state.stats.applicationsSkipped}`);
        console.log(`📝 Processed: ${state.processedJobs.size}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    }

    // ==================== JOB PROCESSING ====================
    async function processNextJob() {
        Logger.info('JOB', 'Finding next job to process');
        
        let retries = 0;
        const maxRetries = state.config.MAX_RETRIES_PER_JOB;
        
        while (retries < maxRetries) {
            try {
                // Step 1: Find and select job
                const job = await findAndSelectNextJob();
                if (!job) {
                    return { submitted: false, skipped: true, reason: 'No jobs found' };
                }
                
                state.currentJobId = job.id;
                await delay(state.config.DELAYS.AFTER_JOB_CLICK);
                
                // Step 2: Open Easy Apply modal
                const modalOpened = await openEasyApplyModal();
                if (!modalOpened) {
                    Logger.warn('JOB', 'Failed to open Easy Apply modal');
                    return { submitted: false, skipped: true, reason: 'No Easy Apply modal' };
                }
                
                await delay(state.config.DELAYS.AFTER_EASY_APPLY);
                
                // Step 3: Submit application
                const submitted = await submitApplication();
                
                if (submitted) {
                    Logger.success('JOB', `Job ${state.currentJobId} submitted successfully`);
                    return { submitted: true, skipped: false, reason: 'Success' };
                } else {
                    retries++;
                    Logger.warn('JOB', `Job submission failed (retry ${retries}/${maxRetries})`);
                    
                    if (retries < maxRetries) {
                        await closeAllModals();
                        await delay(2000);
                        continue;
                    }
                }
                
            } catch (error) {
                retries++;
                Logger.error('JOB', `Error in job processing (retry ${retries}/${maxRetries})`, { error: error.message });
                
                if (retries < maxRetries) {
                    await ErrorHandler.handle(error, { retries });
                    continue;
                }
            }
        }
        
        state.failedJobs.add(state.currentJobId);
        return { submitted: false, skipped: false, reason: 'Max retries exceeded' };
    }

    // ==================== JOB SELECTION ====================
    async function findAndSelectNextJob() {
        Logger.info('JOB_SEARCH', 'Searching for unprocessed Easy Apply job');
        
        const selectors = [
            '.scaffold-layout__list-item',
            '.jobs-search-results__list-item',
            '.job-card-container',
            '[data-job-id]'
        ];
        
        for (const selector of selectors) {
            const cards = Array.from(document.querySelectorAll(selector));
            Logger.debug('JOB_SEARCH', `Found ${cards.length} cards with selector: ${selector}`);
            
            for (const card of cards) {
                if (!isVisible(card)) continue;
                
                const jobId = getJobId(card);
                if (!jobId) continue;
                
                // Skip if already processed or failed
                if (state.processedJobs.has(jobId) || state.failedJobs.has(jobId)) {
                    Logger.debug('JOB_SEARCH', `Skipping already processed job: ${jobId.substring(0, 10)}...`);
                    continue;
                }
                
                // Check for skip indicators
                const cardText = card.textContent.toLowerCase();
                if (cardText.includes("we won't show") || 
                    cardText.includes("you applied") ||
                    cardText.includes("application sent")) {
                    Logger.info('JOB_SEARCH', `Skipping already applied job: ${jobId.substring(0, 10)}...`);
                    state.processedJobs.add(jobId);
                    continue;
                }
                
                // Must have Easy Apply badge
                if (!cardText.includes('easy apply')) {
                    Logger.debug('JOB_SEARCH', `Skipping non-Easy Apply job: ${jobId.substring(0, 10)}...`);
                    state.processedJobs.add(jobId);
                    continue;
                }
                
                // Click and verify
                Logger.info('JOB_SEARCH', `Found potential job: ${jobId.substring(0, 10)}...`);
                highlightElement(card, '#0A66C2');
                await scrollIntoView(card);
                await delay(500);
                
                card.click();
                await delay(2000);
                
                // Final verification: Easy Apply button must exist
                if (findEasyApplyButton()) {
                    Logger.success('JOB_SEARCH', `Confirmed Easy Apply job: ${jobId.substring(0, 10)}...`);
                    state.processedJobs.add(jobId);
                    return { id: jobId, element: card };
                } else {
                    Logger.warn('JOB_SEARCH', `Easy Apply button not found for job: ${jobId.substring(0, 10)}...`);
                    state.processedJobs.add(jobId);
                    continue;
                }
            }
        }
        
        Logger.warn('JOB_SEARCH', 'No unprocessed Easy Apply jobs found');
        return null;
    }

    function getJobId(card) {
        return card.getAttribute('data-job-id') || 
               card.getAttribute('data-occludable-job-id') ||
               card.querySelector('[data-job-id]')?.getAttribute('data-job-id') ||
               card.id ||
               `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    function findEasyApplyButton() {
        const selectors = [
            'button.jobs-apply-button',
            'button[aria-label*="Easy Apply"]',
            'button[aria-label*="easy apply"]',
            '.jobs-apply-button'
        ];
        
        for (const selector of selectors) {
            const button = document.querySelector(selector);
            if (button && isVisible(button)) {
                const text = button.textContent.toLowerCase();
                const aria = (button.getAttribute('aria-label') || '').toLowerCase();
                if (text.includes('easy apply') || aria.includes('easy apply')) {
                    return button;
                }
            }
        }
        
        // Fallback: search all buttons
        const allButtons = document.querySelectorAll('button');
        for (const button of allButtons) {
            if (!isVisible(button)) continue;
            const combined = (button.textContent + ' ' + (button.getAttribute('aria-label') || '')).toLowerCase();
            if (combined.includes('easy apply') && !combined.includes('continue') && !combined.includes('already')) {
                return button;
            }
        }
        
        return null;
    }

    async function openEasyApplyModal() {
        Logger.info('MODAL', 'Opening Easy Apply modal');
        
        for (let attempt = 1; attempt <= 3; attempt++) {
            const button = findEasyApplyButton();
            
            if (button && isVisible(button) && !button.disabled) {
                // Verify it's actually Easy Apply
                const text = button.textContent.toLowerCase();
                const aria = (button.getAttribute('aria-label') || '').toLowerCase();
                
                if (!text.includes('easy apply') && !aria.includes('easy apply')) {
                    Logger.warn('MODAL', 'Button is not Easy Apply, skipping');
                    return false;
                }
                
                highlightElement(button, '#057642');
                await delay(300);
                button.click();
                
                Logger.success('MODAL', 'Easy Apply button clicked');
                return true;
            }
            
            if (attempt < 3) {
                Logger.warn('MODAL', `Button not found (attempt ${attempt}/3), retrying...`);
                await delay(1000);
            }
        }
        
        Logger.error('MODAL', 'Failed to open Easy Apply modal after 3 attempts');
        return false;
    }

    // ==================== APPLICATION SUBMISSION ====================
    async function submitApplication() {
        Logger.info('SUBMISSION', 'Starting application submission process');
        
        const startTime = Date.now();
        let currentStep = 0;
        const maxSteps = 15;
        
        while (Date.now() - startTime < state.config.SUBMISSION_TIMEOUT && currentStep < maxSteps) {
            currentStep++;
            Logger.info('SUBMISSION', `Processing step ${currentStep}/${maxSteps}`);
            
            // Check if already submitted
            if (await checkIfSubmitted()) {
                Logger.success('SUBMISSION', 'Application confirmed submitted!');
                return true;
            }
            
            // Fill all visible fields
            await fillAllFields();
            await delay(500);
            
            // Fix validation errors
            await fixValidationErrors();
            await delay(500);
            
            // Try to submit
            if (await tryToSubmit()) {
                Logger.info('SUBMISSION', 'Submit button clicked, waiting for confirmation...');
                await delay(state.config.DELAYS.AFTER_SUBMIT);
                
                if (await checkIfSubmitted()) {
                    Logger.success('SUBMISSION', 'Submission confirmed!');
                    return true;
                }
                
                // Double-check after extra delay
                await delay(state.config.DELAYS.VERIFICATION);
                if (await checkIfSubmitted()) {
                    Logger.success('SUBMISSION', 'Submission confirmed (delayed)!');
                    return true;
                }
            }
            
            // Try to go next
            if (await tryToGoNext()) {
                Logger.info('SUBMISSION', 'Moved to next page');
                await delay(state.config.DELAYS.AFTER_NEXT);
                continue;
            }
            
            // If stuck, try any action button
            if (await tryAnyActionButton()) {
                await delay(2000);
                if (await checkIfSubmitted()) {
                    Logger.success('SUBMISSION', 'Submission confirmed (via action button)!');
                    return true;
                }
                continue;
            }
            
            // If we've been here too long, give up
            if (currentStep >= 10) {
                Logger.warn('SUBMISSION', 'Too many steps, likely stuck');
                break;
            }
            
            await delay(1000);
        }
        
        Logger.error('SUBMISSION', 'Failed to submit application');
        return false;
    }

    async function fillAllFields() {
        Logger.info('FORM_FILL', 'Filling all visible form fields');
        
        const fields = getVisibleFormFields();
        Logger.debug('FORM_FILL', `Found ${fields.length} fields`);
        
        let filled = 0;
        
        for (const field of fields) {
            try {
                if (field.value && field.value.trim()) continue;
                
                const fieldInfo = analyzeField(field);
                const value = await getBestFieldValue(fieldInfo);
                
                if (value) {
                    await setFieldValue(field, value, fieldInfo);
                    filled++;
                    await delay(state.config.DELAYS.AFTER_FIELD_FILL);
                }
            } catch (error) {
                Logger.warn('FORM_FILL', `Error filling field: ${error.message}`);
            }
        }
        
        Logger.success('FORM_FILL', `Filled ${filled}/${fields.length} fields`);
        
        // Handle special inputs
        await handleCheckboxes();
        await handleRadios();
        await handleDropdowns();
    }

    async function tryToSubmit() {
        const button = findSubmitButton();
        if (button && isVisible(button) && !button.disabled) {
            highlightElement(button, '#057642');
            Logger.info('SUBMIT_BTN', `Clicking submit: "${button.textContent.trim()}"`);
            await delay(500);
            button.click();
            return true;
        }
        return false;
    }

    async function tryToGoNext() {
        const button = findNextButton();
        if (button && isVisible(button) && !button.disabled) {
            highlightElement(button, '#0A66C2');
            Logger.info('NEXT_BTN', `Clicking next: "${button.textContent.trim()}"`);
            await delay(500);
            button.click();
            return true;
        }
        return false;
    }

    async function tryAnyActionButton() {
        const buttons = Array.from(document.querySelectorAll('button'));
        
        for (const button of buttons) {
            if (!isVisible(button) || button.disabled) continue;
            
            const classes = button.className.toLowerCase();
            const text = button.textContent.toLowerCase().trim();
            
            if (classes.includes('primary') && 
                !text.includes('back') && 
                !text.includes('cancel') &&
                !text.includes('close')) {
                
                Logger.info('ACTION_BTN', `Clicking action button: "${text}"`);
                button.click();
                return true;
            }
        }
        
        return false;
    }

    function findSubmitButton() {
        const allButtons = Array.from(document.querySelectorAll('button'));
        
        // Priority 1: Exact "Submit Application"
        for (const btn of allButtons) {
            if (!isVisible(btn) || btn.disabled) continue;
            const text = btn.textContent.toLowerCase().trim();
            if (text === 'submit application' || text === 'submit') {
                return btn;
            }
        }
        
        // Priority 2: Contains "submit" but not "next"
        for (const btn of allButtons) {
            if (!isVisible(btn) || btn.disabled) continue;
            const text = btn.textContent.toLowerCase();
            if (text.includes('submit') && !text.includes('next')) {
                return btn;
            }
        }
        
        return null;
    }

    function findNextButton() {
        const allButtons = Array.from(document.querySelectorAll('button'));
        
        for (const btn of allButtons) {
            if (!isVisible(btn) || btn.disabled) continue;
            const text = btn.textContent.toLowerCase();
            const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
            const combined = text + ' ' + aria;
            
            if ((combined.includes('next') || combined.includes('continue')) && 
                !combined.includes('submit') && 
                !combined.includes('back')) {
                return btn;
            }
        }
        
        return null;
    }

    async function checkIfSubmitted() {
        // Check for success indicators
        const successSelectors = [
            '[data-test-modal-id*="application-submitted"]',
            '.artdeco-toast-item--success',
            '.jobs-easy-apply-content__success'
        ];
        
        for (const selector of successSelectors) {
            if (document.querySelector(selector)) {
                return true;
            }
        }
        
        // Check text
        const bodyText = document.body.textContent.toLowerCase();
        if (bodyText.includes('application submitted') || 
            bodyText.includes('application sent') ||
            bodyText.includes('submitted successfully')) {
            return true;
        }
        
        // Check if modal closed
        const modal = document.querySelector('.jobs-easy-apply-modal');
        if (!modal || !isVisible(modal)) {
            return true;
        }
        
        return false;
    }

    async function fixValidationErrors() {
        const errorElements = document.querySelectorAll('[role="alert"], .error-message');
        if (errorElements.length === 0) return;
        
        Logger.warn('VALIDATION', `Found ${errorElements.length} validation errors, fixing...`);
        
        const requiredFields = document.querySelectorAll('[required], [aria-required="true"]');
        for (const field of requiredFields) {
            if (!isVisible(field) || field.value) continue;
            
            if (field.tagName === 'SELECT') {
                const options = Array.from(field.options).filter(opt => opt.value && opt.value !== 'select');
                if (options.length > 0) {
                    field.value = options[0].value;
                    field.dispatchEvent(new Event('change', { bubbles: true }));
                }
            } else if (field.type === 'number') {
                field.value = '1';
                field.dispatchEvent(new Event('input', { bubbles: true }));
            } else {
                field.value = 'Not specified';
                field.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }
    }

    // ==================== FIELD VALUE GENERATION ====================
    async function getBestFieldValue(fieldInfo) {
        const { label, type, name, placeholder } = fieldInfo;
        const searchText = (label + ' ' + name + ' ' + placeholder).toLowerCase();
        
        // Try user data first
        let value = getUserDataValue(searchText, fieldInfo);
        if (value) return value;
        
        // Try AI (only if API key is available)
        if (OPENAI_API_KEY) {
            value = await getAIValue(fieldInfo, searchText);
            if (value) return value;
        }
        
        // Smart defaults
        return getSmartDefault(searchText, type);
    }

    function getUserDataValue(searchText, fieldInfo) {
        if (!state.userData) return null;
        
        const user = state.userData;
        
        if (searchText.includes('first') && searchText.includes('name')) return user.firstName;
        if (searchText.includes('last') && searchText.includes('name')) return user.lastName;
        if (searchText.match(/\bname\b/)) return user.fullName || user.name;
        if (searchText.includes('email')) return user.email;
        if (searchText.includes('phone')) return user.phone;
        if (searchText.includes('city')) return user.city;
        if (searchText.includes('state')) return user.state;
        if (searchText.includes('country')) return user.country;
        if (searchText.includes('company')) return user.currentCompany;
        if (searchText.includes('title') || searchText.includes('position')) return user.currentTitle;
        
        if (searchText.includes('experience') && searchText.includes('year')) {
            const exp = user.totalExperience || 0;
            return fieldInfo.type === 'number' ? String(Math.floor(exp)) : String(exp);
        }
        
        if (searchText.includes('ctc') || searchText.includes('salary')) {
            const exp = user.totalExperience || 2;
            let ctc;
            if (user.currentSalary) {
                ctc = parseFloat(user.currentSalary);
            } else {
                if (exp < 1) ctc = 3.5;
                else if (exp < 2) ctc = 5;
                else if (exp < 3) ctc = 7;
                else if (exp < 4) ctc = 9;
                else if (exp < 5) ctc = 12;
                else if (exp < 7) ctc = 16;
                else ctc = 22;
            }
            return String(ctc);
        }
        
        if (searchText.includes('notice')) {
            if (user.noticePeriod) {
                const match = user.noticePeriod.match(/\d+/);
                return match ? match[0] : '30';
            }
            return '30';
        }
        
        if (searchText.includes('education') || searchText.includes('degree')) return user.education;
        if (searchText.includes('school') || searchText.includes('university')) return user.institution;
        if (searchText.includes('skill')) return user.skillsText;
        if (searchText.includes('linkedin')) return user.linkedin;
        if (searchText.includes('github')) return user.github;
        
        return null;
    }

    async function getAIValue(fieldInfo, searchText) {
        if (!OPENAI_API_KEY) {
            Logger.warn('AI_VALUE', 'OpenAI API key not configured, skipping AI generation');
            return null;
        }
        
        try {
            const userContext = state.userData ? `
Experience: ${state.userData.totalExperience || 0} years
Role: ${state.userData.currentTitle || 'Not specified'}
Location: ${state.userData.city || 'India'}
` : '';

            const prompt = `${userContext}
Field: "${fieldInfo.label || fieldInfo.name}"
Type: ${fieldInfo.type}

Provide a SHORT answer for this job application field. 
For salary: return ONLY number (e.g. "12")
For notice period: return ONLY days (e.g. "30")
For Yes/No: return ONLY "Yes" or "No"
Keep answers under 10 words.`;

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: 50,
                    temperature: 0.2
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                let answer = data.choices[0].message.content.trim();
                answer = answer.replace(/['"]/g, '').replace(/\.$/, '');
                
                if (fieldInfo.type === 'number') {
                    const numMatch = answer.match(/[\d.]+/);
                    if (numMatch) answer = numMatch[0];
                }
                
                return answer;
            }
        } catch (error) {
            Logger.warn('AI_VALUE', `AI failed: ${error.message}`);
        }
        return null;
    }

    function getSmartDefault(searchText, type) {
        if (searchText.includes('ctc') || searchText.includes('salary')) return '10';
        if (searchText.includes('experience')) return '3';
        if (searchText.includes('notice')) return '30';
        if (searchText.includes('relocate')) return 'Yes';
        if (searchText.includes('authorized')) return 'Yes';
        if (searchText.includes('sponsor')) return 'No';
        if (searchText.includes('client') || searchText.includes('delivery')) return 'Yes';
        
        if (type === 'email') return 'user@example.com';
        if (type === 'tel') return '+919876543210';
        if (type === 'number') return '0';
        
        return null;
    }

    async function setFieldValue(field, value, fieldInfo) {
        try {
            field.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await delay(150);
            field.focus();
            await delay(100);
            
            if (field.tagName === 'SELECT') {
                await handleSelectField(field, value);
            } else if (field.type === 'checkbox') {
                field.checked = value === 'Yes' || value === 'yes' || value === true;
            } else if (field.type === 'radio') {
                field.checked = true;
            } else if (field.type === 'number') {
                field.value = String(value).replace(/[^\d.]/g, '');
            } else {
                field.value = value;
            }
            
            field.dispatchEvent(new Event('input', { bubbles: true }));
            field.dispatchEvent(new Event('change', { bubbles: true }));
            field.dispatchEvent(new Event('blur', { bubbles: true }));
            
            return true;
        } catch (error) {
            return false;
        }
    }

    async function handleSelectField(selectField, value) {
        const options = Array.from(selectField.options).filter(opt => 
            opt.value && opt.value !== '' && opt.value !== 'select'
        );
        
        if (options.length === 0) return false;
        
        const searchValue = String(value).toLowerCase().trim();
        
        // Exact match
        for (const opt of options) {
            if (opt.text.toLowerCase().trim() === searchValue) {
                selectField.value = opt.value;
                selectField.dispatchEvent(new Event('change', { bubbles: true }));
                return true;
            }
        }
        
        // Partial match
        for (const opt of options) {
            if (opt.text.toLowerCase().includes(searchValue)) {
                selectField.value = opt.value;
                selectField.dispatchEvent(new Event('change', { bubbles: true }));
                return true;
            }
        }
        
        // First option fallback
        selectField.value = options[0].value;
        selectField.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
    }

    async function handleCheckboxes() {
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        for (const checkbox of checkboxes) {
            if (!isVisible(checkbox) || checkbox.checked) continue;
            const label = getFieldLabel(checkbox).toLowerCase();
            if (label.includes('agree') || label.includes('terms') || label.includes('policy')) {
                checkbox.checked = true;
                checkbox.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
    }

    async function handleRadios() {
        const radioGroups = {};
        const radios = document.querySelectorAll('input[type="radio"]');
        
        for (const radio of radios) {
            if (!isVisible(radio)) continue;
            const name = radio.name;
            if (!name) continue;
            if (!radioGroups[name]) radioGroups[name] = [];
            radioGroups[name].push(radio);
        }
        
        for (const groupName in radioGroups) {
            const group = radioGroups[groupName];
            if (group.some(r => r.checked)) continue;
            
            const yesOption = group.find(r => getFieldLabel(r).toLowerCase().includes('yes'));
            if (yesOption) {
                yesOption.checked = true;
                yesOption.dispatchEvent(new Event('change', { bubbles: true }));
            } else if (group.length > 0) {
                group[0].checked = true;
                group[0].dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
    }

    async function handleDropdowns() {
        const dropdowns = document.querySelectorAll('select');
        for (const dropdown of dropdowns) {
            if (!isVisible(dropdown) || dropdown.disabled) continue;
            if (dropdown.value && dropdown.value !== 'select') continue;
            
            const fieldInfo = analyzeField(dropdown);
            const value = await getBestFieldValue(fieldInfo);
            
            if (value) {
                await handleSelectField(dropdown, value);
            } else {
                const options = Array.from(dropdown.options).filter(opt => opt.value && opt.value !== 'select');
                if (options.length > 0) {
                    dropdown.value = options[0].value;
                    dropdown.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
        }
    }

    // ==================== UTILITY FUNCTIONS ====================
    function getVisibleFormFields() {
        return Array.from(document.querySelectorAll(`
            input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([disabled]), 
            textarea:not([disabled]), 
            select:not([disabled])
        `)).filter(field => isVisible(field));
    }

    function analyzeField(field) {
        return {
            type: field.type || field.tagName.toLowerCase(),
            name: field.name || '',
            id: field.id || '',
            label: getFieldLabel(field),
            placeholder: field.placeholder || ''
        };
    }

    function getFieldLabel(field) {
        const label = document.querySelector(`label[for="${field.id}"]`);
        if (label) return label.textContent.trim();
        
        const parentLabel = field.closest('label');
        if (parentLabel) return parentLabel.textContent.trim();
        
        return field.getAttribute('aria-label') || field.placeholder || '';
    }

    function isVisible(element) {
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && 
               style.visibility !== 'hidden' && style.display !== 'none' && 
               style.opacity !== '0';
    }

    async function scrollIntoView(element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await delay(500);
    }

    async function scrollToLoadMoreJobs() {
        Logger.info('SCROLL', 'Scrolling to load more jobs');
        const jobList = document.querySelector('.scaffold-layout__list') || 
                       document.querySelector('.jobs-search-results__list');
        if (jobList) {
            jobList.scrollBy(0, 1000);
        } else {
            window.scrollBy(0, 1000);
        }
        await delay(2000);
    }

    async function closeAllModals() {
        const closeSelectors = [
            'button[aria-label*="Dismiss"]',
            'button[aria-label*="dismiss"]',
            'button[aria-label*="Close"]',
            '.artdeco-modal__dismiss'
        ];
        
        for (const selector of closeSelectors) {
            const buttons = document.querySelectorAll(selector);
            for (const button of buttons) {
                if (isVisible(button)) {
                    button.click();
                    await delay(500);
                    
                    // Handle discard dialog
                    const discardBtn = Array.from(document.querySelectorAll('button')).find(b => 
                        b.textContent.toLowerCase().includes('discard')
                    );
                    if (discardBtn && isVisible(discardBtn)) {
                        discardBtn.click();
                        await delay(500);
                    }
                    
                    return;
                }
            }
        }
        
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await delay(500);
    }

    function highlightElement(element, color) {
        element.classList.add('fillora-highlight');
        const original = element.style.boxShadow;
        element.style.boxShadow = `0 0 0 3px ${color}`;
        setTimeout(() => {
            element.style.boxShadow = original;
            element.classList.remove('fillora-highlight');
        }, 2000);
    }

    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed; top: 20px; right: 20px; z-index: 999999;
            background: ${type === 'success' ? '#057642' : type === 'error' ? '#cc1016' : '#0A66C2'};
            color: white; padding: 12px 20px; border-radius: 8px;
            font-weight: 600; box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        `;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }

    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ==================== AUTOFILL FUNCTIONALITY ====================
    async function performAutoFill(userData) {
        Logger.info('AUTOFILL', 'Starting AutoFill');
        
        state.userData = userData;
        const fields = getVisibleFormFields();
        let fieldsFilled = 0;
        
        for (const field of fields) {
            try {
                if (field.value) continue;
                const fieldInfo = analyzeField(field);
                const value = await getBestFieldValue(fieldInfo);
                if (value) {
                    await setFieldValue(field, value, fieldInfo);
                    fieldsFilled++;
                }
                await delay(200);
            } catch (error) {
                Logger.warn('AUTOFILL', `Field error: ${error.message}`);
            }
        }
        
        await handleCheckboxes();
        await handleRadios();
        await handleDropdowns();
        
        const successRate = fields.length > 0 ? Math.round((fieldsFilled / fields.length) * 100) : 0;
        
        Logger.success('AUTOFILL', `Complete: ${fieldsFilled}/${fields.length} (${successRate}%)`);
        
        return {
            success: true,
            fieldsFilled,
            totalFields: fields.length,
            successRate
        };
    }

    // ==================== INITIALIZATION ====================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

    Logger.success('SYSTEM', '🚀 Fillora Pro v2.0 - Enterprise Edition Ready');
    Logger.info('SYSTEM', 'Built for reliability, scalability, and user trust');

} else {
    console.log('⚠️ Fillora already initialized');
}