// Fillora Chrome Extension - ROBUST LINKEDIN AUTOMATION
// Version: 6.0 - POWERFUL + INTELLIGENT + HUMAN-LIKE
console.log('🚀 [FILLORA v6.0] Initializing ROBUST LinkedIn automation...');

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
            applicationsSkipped: 0,
            totalAttempts: 0,
            errors: []
        },
        config: {
            MAX_JOBS: 50,
            MAX_ATTEMPTS: 200,
            MIN_JOB_TIME: 30000, // Minimum 30 seconds per job
            MAX_JOB_TIME: 60000, // Maximum 60 seconds per job
            MAX_RETRIES_PER_JOB: 2,
            DELAYS: {
                AFTER_JOB_CLICK: 1500,
                AFTER_EASY_APPLY: 2000,
                AFTER_FIELD_FILL: 800, // Increased for human-like behavior
                AFTER_NEXT: 1500,
                AFTER_SUBMIT: 3000,
                BETWEEN_JOBS: 2000,
                VERIFICATION: 2500,
                RETRY_DELAY: 2000,
                HUMAN_PAUSE: 1200 // Random human-like pauses
            }
        },
        fieldCache: new Map(),
        jobStartTime: null
    };

    // ==================== ENHANCED LOGGER ====================
    const Logger = {
        log: (level, category, message) => {
            const emoji = {
                'INFO': 'ℹ️',
                'SUCCESS': '✅',
                'WARNING': '⚠️',
                'ERROR': '❌',
                'TIME': '⏱️',
                'FILTER': '🔍'
            }[level] || '📝';
            console.log(`${emoji} [${level}] [${category}] ${message}`);
        },
        info: (cat, msg) => Logger.log('INFO', cat, msg),
        success: (cat, msg) => Logger.log('SUCCESS', cat, msg),
        warn: (cat, msg) => Logger.log('WARNING', cat, msg),
        error: (cat, msg) => Logger.log('ERROR', cat, msg),
        time: (cat, msg) => Logger.log('TIME', cat, msg),
        filter: (cat, msg) => Logger.log('FILTER', cat, msg)
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
        
        Logger.success('INIT', 'Fillora ROBUST automation ready');
    }

    // ==================== MAIN AUTOMATION ENTRY ====================
    async function startLinkedInAutomation(userData) {
        Logger.info('AUTOMATION', '🚀 Starting ROBUST LinkedIn Easy Apply automation');
        
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
        state.submittedJobs.clear();
        state.failedJobs.clear();
        state.fieldCache.clear();
        
        const startTime = Date.now();
        
        try {
            // STEP 1: Ensure we're on correct page with Easy Apply filter
            await ensureCorrectPageWithEasyApply();
            
            // STEP 2: Process jobs
            const result = await processJobsMainLoop();
            
            const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
            const timePerJob = (totalTime / Math.max(1, state.stats.applicationsSubmitted)).toFixed(1);
            
            Logger.success('AUTOMATION', `✅ COMPLETED! Submitted: ${state.stats.applicationsSubmitted} jobs`);
            Logger.time('AUTOMATION', `⏱️ Total: ${totalTime}s | Average: ${timePerJob}s per job`);
            
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

    // ==================== ENHANCED PAGE NAVIGATION WITH EASY APPLY FILTER ====================
    async function ensureCorrectPageWithEasyApply() {
        const currentUrl = window.location.href;
        
        // Check if we're on LinkedIn Jobs with Easy Apply filter
        const hasEasyApplyFilter = currentUrl.includes('f_AL=true');
        const isJobsPage = currentUrl.includes('linkedin.com/jobs');
        
        if (!isJobsPage) {
            Logger.info('NAVIGATION', '🔍 Navigating to LinkedIn Jobs...');
            window.location.href = 'https://www.linkedin.com/jobs/search/';
            await delay(6000);
        }
        
        // Apply Easy Apply filter if not present
        if (!hasEasyApplyFilter) {
            Logger.filter('FILTER', 'Applying Easy Apply filter...');
            const filterApplied = await applyEasyApplyFilter();
            
            if (!filterApplied) {
                Logger.warn('FILTER', 'Using direct URL with Easy Apply filter');
                window.location.href = 'https://www.linkedin.com/jobs/search/?f_AL=true&keywords=data%20analyst&location=India&sortBy=DD';
                await delay(8000);
            } else {
                Logger.success('FILTER', '✅ Easy Apply filter applied successfully');
                await delay(5000);
            }
        }
        
        // Wait for jobs to load
        await waitForJobsToLoad();
        
        Logger.success('NAVIGATION', '✅ On LinkedIn Easy Apply jobs page');
    }

    async function applyEasyApplyFilter() {
        try {
            Logger.filter('FILTER', 'Looking for Easy Apply filter...');
            
            // Method 1: Look for filter pills
            const filterPills = document.querySelectorAll('.search-reusables__filter-pill-button, .search-reusables__filter-button');
            for (const pill of filterPills) {
                const text = pill.textContent.toLowerCase();
                if (text.includes('easy') && text.includes('apply')) {
                    Logger.filter('FILTER', 'Clicking Easy Apply filter pill');
                    pill.click();
                    await delay(3000);
                    return true;
                }
            }
            
            // Method 2: Look for "All filters" button and then Easy Apply
            const allFiltersButton = Array.from(document.querySelectorAll('button')).find(btn => 
                btn.textContent.toLowerCase().includes('all filters') ||
                btn.textContent.toLowerCase().includes('show all filters')
            );
            
            if (allFiltersButton) {
                Logger.filter('FILTER', 'Opening All Filters...');
                allFiltersButton.click();
                await delay(3000);
                
                // Look for Easy Apply checkbox in the filters modal
                const checkboxes = document.querySelectorAll('input[type="checkbox"]');
                for (const checkbox of checkboxes) {
                    const label = getCheckboxLabel(checkbox);
                    if (label && label.toLowerCase().includes('easy apply')) {
                        Logger.filter('FILTER', 'Checking Easy Apply checkbox');
                        if (!checkbox.checked) {
                            checkbox.click();
                            await delay(1000);
                        }
                        
                        // Find and click "Show results" or "Apply" button
                        const showResults = Array.from(document.querySelectorAll('button')).find(btn => 
                            btn.textContent.toLowerCase().includes('show results') ||
                            btn.textContent.toLowerCase().includes('apply')
                        );
                        
                        if (showResults) {
                            showResults.click();
                            await delay(4000);
                            return true;
                        }
                    }
                }
            }
            
            // Method 3: Look for binary toggle
            const toggleButtons = document.querySelectorAll('.search-reusables__filter-binary-toggle');
            for (const toggle of toggleButtons) {
                const text = toggle.textContent.toLowerCase();
                if (text.includes('easy apply')) {
                    Logger.filter('FILTER', 'Toggling Easy Apply filter');
                    toggle.click();
                    await delay(3000);
                    return true;
                }
            }
            
            return false;
            
        } catch (error) {
            Logger.error('FILTER', `Error applying filter: ${error.message}`);
            return false;
        }
    }

    function getCheckboxLabel(checkbox) {
        // Try to find associated label
        if (checkbox.id) {
            const label = document.querySelector(`label[for="${checkbox.id}"]`);
            if (label) return label.textContent;
        }
        
        // Try parent label
        const parentLabel = checkbox.closest('label');
        if (parentLabel) return parentLabel.textContent;
        
        return '';
    }

    async function waitForJobsToLoad() {
        Logger.info('LOADING', 'Waiting for Easy Apply jobs to load...');
        
        let attempts = 0;
        const maxAttempts = 30;
        
        while (attempts < maxAttempts) {
            const jobCards = getJobCards();
            const easyApplyJobs = Array.from(jobCards).filter(card => 
                isEasyApplyJob(card)
            );
            
            if (easyApplyJobs.length > 0) {
                Logger.success('LOADING', `✅ Found ${easyApplyJobs.length} Easy Apply jobs`);
                return true;
            }
            
            // Scroll to trigger loading
            if (attempts % 5 === 0) {
                window.scrollBy(0, 800);
                await delay(2000);
            }
            
            await delay(1000);
            attempts++;
        }
        
        Logger.warn('LOADING', 'No Easy Apply jobs found after waiting');
        return false;
    }

    function isEasyApplyJob(card) {
        const cardText = card.textContent.toLowerCase();
        return cardText.includes('easy apply') && 
               !cardText.includes('you applied') &&
               !cardText.includes('applied on');
    }

    function getJobCards() {
        return document.querySelectorAll([
            '.scaffold-layout__list-item',
            '.jobs-search-results__list-item',
            '.job-card-container',
            '[data-job-id]',
            '.job-card-list__entity-lockup',
            '.jobs-search-results__list-item--active'
        ].join(','));
    }

    // ==================== ROBUST JOB PROCESSING LOOP ====================
    async function processJobsMainLoop() {
        Logger.info('LOOP', `🎯 Target: ${state.config.MAX_JOBS} successful submissions`);
        
        let consecutiveFailures = 0;
        let scrollCount = 0;
        
        while (state.stats.applicationsSubmitted < state.config.MAX_JOBS && 
               state.stats.totalAttempts < state.config.MAX_ATTEMPTS) {
            
            state.stats.totalAttempts++;
            
            console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`📊 ATTEMPT ${state.stats.totalAttempts} | ✅ Submitted: ${state.stats.applicationsSubmitted}/${state.config.MAX_JOBS}`);
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
            
            try {
                const jobResult = await processNextJob();
                
                if (jobResult.submitted) {
                    state.stats.applicationsSubmitted++;
                    state.stats.applicationsAttempted++;
                    consecutiveFailures = 0;
                    scrollCount = 0;
                    
                    Logger.success('LOOP', `🎉 Progress: ${state.stats.applicationsSubmitted}/${state.config.MAX_JOBS}`);
                    showNotification(`✅ Job ${state.stats.applicationsSubmitted}/${state.config.MAX_JOBS} SUBMITTED!`, 'success');
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
            
            // Scroll for more jobs if needed
            if (consecutiveFailures >= 3 || scrollCount >= 5) {
                Logger.info('SCROLL', 'Loading more jobs...');
                await scrollToLoadMoreJobs();
                consecutiveFailures = 0;
                scrollCount = 0;
                await delay(3000);
            }
            
            scrollCount++;
            await closeAllModals();
            await delay(state.config.DELAYS.BETWEEN_JOBS);
        }
        
        // Final summary
        Logger.success('LOOP', `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        Logger.success('LOOP', `🎉 ROBUST AUTOMATION COMPLETED!`);
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
        state.jobStartTime = Date.now();
        const maxRetries = state.config.MAX_RETRIES_PER_JOB;
        let retryCount = 0;
        
        while (retryCount < maxRetries) {
            try {
                // Step 1: Find and click on an Easy Apply job
                const job = await findAndClickEasyApplyJob();
                if (!job) {
                    Logger.warn('JOB', 'No suitable Easy Apply jobs found');
                    return { submitted: false, skipped: true };
                }
                
                state.currentJobId = job.id;
                Logger.info('JOB', `Selected job: ${job.title || job.id.substring(0, 15)}... (Attempt ${retryCount + 1}/${maxRetries})`);
                
                await humanLikeDelay(state.config.DELAYS.AFTER_JOB_CLICK);
                
                // Step 2: Click "Easy Apply" button
                const easyApplyClicked = await clickEasyApplyButton();
                if (!easyApplyClicked) {
                    Logger.warn('JOB', 'Easy Apply button not found or already applied');
                    await closeAllModals();
                    retryCount++;
                    continue;
                }
                
                await humanLikeDelay(state.config.DELAYS.AFTER_EASY_APPLY);
                
                // Step 3: Submit application with proper timing
                const submitted = await submitApplicationWithProperTiming();
                
                if (submitted) {
                    const jobTime = Date.now() - state.jobStartTime;
                    Logger.success('JOB', `✅ SUBMITTED successfully in ${(jobTime/1000).toFixed(1)}s`);
                    state.submittedJobs.add(state.currentJobId);
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

    async function submitApplicationWithProperTiming() {
        const startTime = Date.now();
        const result = await submitApplicationComplete();
        const elapsed = Date.now() - startTime;
        
        // Ensure minimum time spent on job (human-like behavior)
        if (result && elapsed < state.config.MIN_JOB_TIME) {
            const remaining = state.config.MIN_JOB_TIME - elapsed;
            Logger.time('TIMING', `Spending additional ${remaining/1000}s for human-like behavior`);
            await delay(remaining);
        }
        
        return result;
    }

    async function findAndClickEasyApplyJob() {
        const jobCards = getJobCards();
        
        for (const card of jobCards) {
            if (!isVisible(card)) continue;
            
            const jobId = getJobId(card);
            if (!jobId || state.processedJobs.has(jobId) || state.failedJobs.has(jobId) || state.submittedJobs.has(jobId)) {
                continue;
            }
            
            // CRITICAL: Only process Easy Apply jobs that haven't been applied to
            if (!isEasyApplyJob(card)) {
                state.processedJobs.add(jobId);
                continue;
            }
            
            // Get job title for logging
            const titleElement = card.querySelector('.job-card-list__title') || 
                               card.querySelector('.job-card-container__link');
            const jobTitle = titleElement ? titleElement.textContent.trim() : 'Unknown Title';
            
            // Click the job card
            Logger.info('JOB_CLICK', `Clicking: ${jobTitle}`);
            highlightElement(card, '#0A66C2');
            await scrollIntoView(card);
            
            // Human-like click with slight variation
            await humanLikeDelay(800);
            card.click();
            await humanLikeDelay(1200);
            
            // Verify job details loaded
            const jobLoaded = await waitForJobDetails();
            if (!jobLoaded) {
                Logger.warn('JOB_CLICK', 'Job details not loading properly');
                continue;
            }
            
            state.processedJobs.add(jobId);
            return { id: jobId, element: card, title: jobTitle };
        }
        
        return null;
    }

    async function waitForJobDetails() {
        let attempts = 0;
        while (attempts < 15) {
            // Check multiple indicators that job details are loaded
            const jobPanel = document.querySelector('.jobs-search__job-details--container') ||
                           document.querySelector('.jobs-details') ||
                           document.querySelector('.jobs-details__main-content');
            
            const easyApplyButton = document.querySelector('button[aria-label*="Easy Apply"]') ||
                                  document.querySelector('button.jobs-apply-button');
            
            if (jobPanel && jobPanel.textContent && jobPanel.textContent.length > 200) {
                return true;
            }
            
            // If Easy Apply button is visible, details are likely loaded
            if (easyApplyButton && isVisible(easyApplyButton)) {
                return true;
            }
            
            await delay(500);
            attempts++;
        }
        return false;
    }

    // ==================== ROBUST EASY APPLY CLICK ====================
    async function clickEasyApplyButton() {
        await humanLikeDelay(1000);
        
        const buttonSelectors = [
            'button[aria-label*="Easy Apply"]',
            'button[aria-label*="easy apply"]',
            'button.jobs-apply-button',
            'button[data-control-name="jobdetails_topcard_inapply"]',
            'button[aria-label*="Apply now"]',
            '.jobs-apply-button'
        ];
        
        for (const selector of buttonSelectors) {
            const buttons = document.querySelectorAll(selector);
            for (const button of buttons) {
                if (!isVisible(button) || button.disabled) continue;
                
                const text = button.textContent.toLowerCase().trim();
                const aria = (button.getAttribute('aria-label') || '').toLowerCase();
                
                // Only click genuine Easy Apply buttons
                if ((text.includes('easy apply') || aria.includes('easy apply') || 
                     text.includes('apply now') || aria.includes('apply now')) &&
                    !text.includes('applied on') &&
                    !aria.includes('application sent')) {
                    
                    Logger.info('BUTTON', `✅ Clicking: "${button.textContent.trim()}"`);
                    highlightElement(button, '#057642');
                    await humanLikeDelay(600);
                    button.click();
                    return true;
                }
            }
        }
        
        return false;
    }

    // ==================== INTELLIGENT APPLICATION SUBMISSION ====================
    async function submitApplicationComplete() {
        Logger.info('SUBMIT', '🚀 Starting intelligent application submission');
        
        let currentStep = 0;
        const maxSteps = 20;
        
        while (currentStep < maxSteps) {
            currentStep++;
            
            // Check if already submitted
            if (await isApplicationSubmitted()) {
                Logger.success('SUBMIT', '✅ Application SUBMITTED successfully!');
                return true;
            }
            
            // Fill fields with human-like timing
            await fillAllFieldsIntelligently();
            
            // Handle dynamic content and questions
            await handleAdditionalQuestions();
            
            // Check again if submitted
            if (await isApplicationSubmitted()) {
                return true;
            }
            
            // Try to progress through application
            const progressed = await progressApplication();
            if (!progressed) {
                // No progression possible - might be done or stuck
                Logger.warn('SUBMIT', 'No progression possible - checking completion');
                await humanLikeDelay(1500);
                
                if (await isApplicationSubmitted()) {
                    return true;
                }
                
                // Final attempt to find submit button
                if (await clickFinalSubmit()) {
                    await humanLikeDelay(2000);
                    if (await isApplicationSubmitted()) {
                        return true;
                    }
                }
                
                break;
            }
            
            // Ensure we don't go too fast
            await humanLikeDelay(1000);
        }
        
        Logger.error('SUBMIT', '❌ Max steps reached without submission');
        return false;
    }

    async function fillAllFieldsIntelligently() {
        const fields = getAllVisibleFormFields();
        
        if (fields.length === 0) {
            Logger.info('FILL', 'No fields found to fill');
            return;
        }
        
        Logger.info('FILL', `Intelligently filling ${fields.length} fields`);
        
        // Process fields sequentially with human-like timing
        for (const field of fields) {
            await fillFieldIntelligently(field);
            await humanLikeDelay(state.config.DELAYS.AFTER_FIELD_FILL);
        }
        
        // Handle special field types
        await handleAllDropdownsIntelligently();
        await handleCheckboxesIntelligently();
        await handleRadioButtons();
    }

    async function fillFieldIntelligently(field) {
        try {
            // Skip if already filled with meaningful data
            if (field.value && field.value.trim() && field.value !== 'select' && field.value !== 'Choose...') {
                return;
            }
            
            const fieldInfo = analyzeFieldComprehensively(field);
            const value = await getBestValueForFieldIntelligently(fieldInfo);
            
            if (!value) {
                Logger.warn('FILL', `No intelligent value for: ${fieldInfo.label || fieldInfo.name}`);
                return;
            }
            
            // Human-like focusing
            field.focus();
            await humanLikeDelay(400);
            
            if (field.tagName === 'SELECT') {
                await selectDropdownOptionIntelligently(field, value);
            } else if (field.type === 'checkbox') {
                if (!field.checked) {
                    field.checked = true;
                    field.dispatchEvent(new Event('change', { bubbles: true }));
                    field.dispatchEvent(new Event('click', { bubbles: true }));
                }
            } else if (field.type === 'radio') {
                if (!field.checked) {
                    field.checked = true;
                    field.dispatchEvent(new Event('change', { bubbles: true }));
                    field.dispatchEvent(new Event('click', { bubbles: true }));
                }
            } else {
                // Type value character by character for text fields (human-like)
                await typeValueHumanLike(field, value);
            }
            
        } catch (error) {
            Logger.error('FILL', `Error filling field: ${error.message}`);
        }
    }

    async function typeValueHumanLike(field, value) {
        if (!value) return;
        
        // Clear field first if needed
        if (field.value) {
            field.value = '';
            field.dispatchEvent(new Event('input', { bubbles: true }));
            await humanLikeDelay(300);
        }
        
        // Type character by character for longer text (more human-like)
        if (value.length > 8 && (field.type === 'text' || field.type === 'textarea')) {
            for (let i = 0; i < value.length; i++) {
                field.value += value[i];
                field.dispatchEvent(new Event('input', { bubbles: true }));
                
                // Random typing speed variation
                const delay = Math.random() * 100 + 50;
                await delay(delay);
            }
        } else {
            // Instant fill for short values
            field.value = value;
            field.dispatchEvent(new Event('input', { bubbles: true }));
            field.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    function analyzeFieldComprehensively(field) {
        const label = getFieldLabel(field).toLowerCase();
        const placeholder = (field.placeholder || '').toLowerCase();
        const name = (field.name || '').toLowerCase();
        const id = (field.id || '').toLowerCase();
        const type = field.type || field.tagName.toLowerCase();
        
        // Comprehensive field analysis
        return {
            type: type,
            label: label,
            name: name,
            placeholder: placeholder,
            id: id,
            combined: `${label} ${placeholder} ${name} ${id}`,
            isRequired: field.required || label.includes('required') || placeholder.includes('required')
        };
    }

    async function getBestValueForFieldIntelligently(fieldInfo) {
        const u = state.userData;
        const combined = fieldInfo.combined;
        
        // Priority 1: User data from database/resume
        if (u) {
            // Name fields
            if (combined.includes('first') && combined.includes('name')) return u.firstName;
            if (combined.includes('last') && combined.includes('name')) return u.lastName;
            if ((combined.match(/\bname\b/) || combined.includes('full name')) && !combined.includes('company')) {
                return u.fullName || u.name || `${u.firstName || ''} ${u.lastName || ''}`.trim();
            }
            
            // Contact fields
            if (combined.includes('email')) return u.email;
            if (combined.includes('phone') || combined.includes('mobile') || combined.includes('telephone')) return u.phone;
            
            // Location fields
            if (combined.includes('city')) return u.city;
            if (combined.includes('state') || combined.includes('province')) return u.state;
            if (combined.includes('country')) return u.country || 'India';
            if (combined.includes('zip') || combined.includes('pincode') || combined.includes('postal')) return u.pincode;
            if (combined.includes('address')) return u.address;
            
            // Professional fields
            if (combined.includes('company') && combined.includes('current')) return u.currentCompany;
            if (combined.includes('employer')) return u.currentCompany;
            if (combined.includes('title') || combined.includes('position') || combined.includes('role')) return u.currentTitle;
            
            // Experience and education
            if ((combined.includes('experience') || combined.includes('years')) && combined.includes('work')) {
                return String(Math.floor(u.totalExperience || 2));
            }
            if (combined.includes('education') || combined.includes('degree')) return u.education;
            if (combined.includes('university') || combined.includes('college') || combined.includes('institution')) return u.institution;
            
            // Salary
            if (combined.includes('salary') || combined.includes('ctc') || combined.includes('compensation')) {
                return String(u.currentSalary || u.expectedSalary || calculateExpectedSalary(u.totalExperience || 2));
            }
            
            // Notice period
            if (combined.includes('notice')) {
                if (u.noticePeriod) {
                    const match = String(u.noticePeriod).match(/\d+/);
                    return match ? match[0] : '30';
                }
                return '30';
            }
            
            // Skills
            if (combined.includes('skill') && u.skillsText) {
                return u.skillsText;
            }
        }
        
        // Priority 2: Smart defaults based on field type and context
        return getIntelligentDefault(fieldInfo);
    }

    function getIntelligentDefault(fieldInfo) {
        const combined = fieldInfo.combined;
        
        // Salary expectations
        if (combined.includes('salary') || combined.includes('ctc')) {
            return '800000'; // 8 LPA as reasonable default
        }
        
        // Experience
        if (combined.includes('experience') && combined.includes('year')) {
            return '3';
        }
        
        // Notice period
        if (combined.includes('notice')) {
            return '30';
        }
        
        // Location preferences
        if (combined.includes('relocate') || combined.includes('willing') || combined.includes('location')) {
            return 'Yes';
        }
        
        // Visa/sponsorship
        if (combined.includes('sponsor') || combined.includes('visa') || combined.includes('work permit')) {
            return 'No';
        }
        
        // Authorization to work
        if (combined.includes('authorized') || combined.includes('eligible') || combined.includes('legally')) {
            return 'Yes';
        }
        
        // Diversity questions
        if (combined.includes('gender') || combined.includes('diversity')) {
            return 'Prefer not to say';
        }
        
        // Website/portfolio
        if (combined.includes('website') || combined.includes('portfolio') || combined.includes('linkedin')) {
            return 'https://linkedin.com/in/profile';
        }
        
        // Type-based defaults
        if (fieldInfo.type === 'email') return 'user@example.com';
        if (fieldInfo.type === 'tel') return '+919876543210';
        if (fieldInfo.type === 'number') return '1';
        if (fieldInfo.type === 'url') return 'https://linkedin.com';
        
        return 'Available on request'; // Generic fallback
    }

    async function selectDropdownOptionIntelligently(select, targetValue) {
        const options = Array.from(select.options).filter(opt => 
            opt.value && opt.value !== '' && opt.value !== 'select' && opt.value !== 'Choose...'
        );
        
        if (options.length === 0) return false;
        
        const searchValue = String(targetValue).toLowerCase().trim();
        
        // Multiple matching strategies
        for (const opt of options) {
            const optText = opt.text.toLowerCase().trim();
            
            // Exact match
            if (optText === searchValue) {
                select.value = opt.value;
                triggerChangeEvent(select);
                return true;
            }
            
            // Contains match
            if (optText.includes(searchValue) || searchValue.includes(optText)) {
                select.value = opt.value;
                triggerChangeEvent(select);
                return true;
            }
        }
        
        // Number matching for years/salary
        if (!isNaN(searchValue)) {
            const numValue = parseFloat(searchValue);
            for (const opt of options) {
                const optNum = extractNumber(opt.text);
                if (!isNaN(optNum) && Math.abs(optNum - numValue) <= 1) {
                    select.value = opt.value;
                    triggerChangeEvent(select);
                    return true;
                }
            }
        }
        
        // Select first reasonable option as fallback
        if (options[0] && options[0].value) {
            select.value = options[0].value;
            triggerChangeEvent(select);
        }
        
        return true;
    }

    function extractNumber(text) {
        const match = text.match(/(\d+\.?\d*)/);
        return match ? parseFloat(match[1]) : NaN;
    }

    function triggerChangeEvent(element) {
        element.dispatchEvent(new Event('change', { bubbles: true }));
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('blur', { bubbles: true }));
    }

    async function handleAllDropdownsIntelligently() {
        const dropdowns = document.querySelectorAll('select');
        for (const dropdown of dropdowns) {
            if (!isVisible(dropdown) || dropdown.disabled) continue;
            if (dropdown.value && dropdown.value !== 'select' && dropdown.value !== 'Choose...' && dropdown.value !== '') continue;
            
            const fieldInfo = analyzeFieldComprehensively(dropdown);
            const value = await getBestValueForFieldIntelligently(fieldInfo);
            
            if (value) {
                await selectDropdownOptionIntelligently(dropdown, value);
                await humanLikeDelay(500);
            }
        }
    }

    async function handleCheckboxesIntelligently() {
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        
        for (const checkbox of checkboxes) {
            if (!isVisible(checkbox) || checkbox.disabled) continue;
            
            const label = getFieldLabel(checkbox).toLowerCase();
            
            // Auto-check agreement/consent checkboxes
            if (label.includes('agree') || 
                label.includes('terms') || 
                label.includes('condition') ||
                label.includes('policy') ||
                label.includes('consent') ||
                label.includes('acknowledge') ||
                label.includes('certify') ||
                label.includes('authorize')) {
                
                if (!checkbox.checked) {
                    checkbox.checked = true;
                    triggerChangeEvent(checkbox);
                    await humanLikeDelay(200);
                }
            }
        }
    }

    async function handleRadioButtons() {
        const radioGroups = new Map();
        const radios = document.querySelectorAll('input[type="radio"]');
        
        // Group radios by name
        for (const radio of radios) {
            if (!isVisible(radio) || radio.disabled) continue;
            const name = radio.name;
            if (!radioGroups.has(name)) {
                radioGroups.set(name, []);
            }
            radioGroups.get(name).push(radio);
        }
        
        // Select appropriate radio buttons
        for (const [name, radiosInGroup] of radioGroups) {
            let selected = false;
            
            // Prefer "Yes" options for boolean questions
            for (const radio of radiosInGroup) {
                const label = getFieldLabel(radio).toLowerCase();
                const value = radio.value.toLowerCase();
                
                if ((label.includes('yes') || value.includes('yes') || value === 'true') && !selected) {
                    radio.checked = true;
                    triggerChangeEvent(radio);
                    selected = true;
                    await humanLikeDelay(200);
                }
            }
            
            // If no "Yes" found, select first option
            if (!selected && radiosInGroup.length > 0) {
                radiosInGroup[0].checked = true;
                triggerChangeEvent(radiosInGroup[0]);
                await humanLikeDelay(200);
            }
        }
    }

    async function handleAdditionalQuestions() {
        // Handle any additional questions that might appear
        const textareas = document.querySelectorAll('textarea');
        for (const textarea of textareas) {
            if (!isVisible(textarea) || textarea.disabled) continue;
            if (textarea.value && textarea.value.trim()) continue;
            
            const label = getFieldLabel(textarea).toLowerCase();
            if (label.includes('cover') || label.includes('additional') || label.includes('why')) {
                const response = await generateAIResponse(label);
                if (response) {
                    await typeValueHumanLike(textarea, response);
                }
            }
        }
    }

    async function generateAIResponse(question) {
        if (!OPENAI_API_KEY) {
            return "I am excited about this opportunity and believe my skills align well with your requirements.";
        }
        
        try {
            // This would be your AI response generation logic
            return "I am very interested in this position and believe my experience makes me a strong candidate for this role.";
        } catch (error) {
            return "I am enthusiastic about this opportunity and confident in my ability to contribute to your team.";
        }
    }

    async function progressApplication() {
        // Try SUBMIT first
        if (await clickSubmitButton()) {
            await humanLikeDelay(state.config.DELAYS.AFTER_SUBMIT);
            return true;
        }
        
        // Try NEXT/CONTINUE
        if (await clickNextButton()) {
            await humanLikeDelay(state.config.DELAYS.AFTER_NEXT);
            return true;
        }
        
        // Try REVIEW
        if (await clickReviewButton()) {
            await humanLikeDelay(2000);
            return true;
        }
        
        return false;
    }

    async function clickSubmitButton() {
        const buttons = getVisibleButtons();
        
        for (const btn of buttons) {
            const text = btn.textContent.toLowerCase().trim();
            const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
            const combined = text + ' ' + aria;
            
            if ((text === 'submit application' || 
                 text === 'submit' || 
                 combined.includes('submit application')) &&
                !combined.includes('next') && 
                !combined.includes('continue')) {
                
                Logger.info('BUTTON', `✅ Clicking SUBMIT: "${text}"`);
                highlightElement(btn, '#057642');
                await humanLikeDelay(600);
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
            
            if ((combined.includes('next') || 
                 combined.includes('continue') || 
                 text === 'next') &&
                !combined.includes('submit') && 
                !combined.includes('back')) {
                
                Logger.info('BUTTON', `➡️ Clicking NEXT: "${text}"`);
                highlightElement(btn, '#0A66C2');
                await humanLikeDelay(600);
                btn.click();
                return true;
            }
        }
        
        return false;
    }

    async function clickReviewButton() {
        const buttons = getVisibleButtons();
        
        for (const btn of buttons) {
            const text = btn.textContent.toLowerCase().trim();
            if (text.includes('review') || text.includes('reivew application')) {
                Logger.info('BUTTON', `📋 Clicking REVIEW: "${text}"`);
                btn.click();
                return true;
            }
        }
        
        return false;
    }

    async function clickFinalSubmit() {
        return await clickSubmitButton();
    }

    // ==================== ENHANCED SUBMISSION VERIFICATION ====================
    async function isApplicationSubmitted() {
        const successIndicators = [
            // Success modals
            () => document.querySelector('[data-test-modal-id*="submitted"]'),
            () => document.querySelector('[data-test-modal-id*="application-submitted"]'),
            () => document.querySelector('.artdeco-modal--success'),
            
            // Success toasts
            () => document.querySelector('.artdeco-toast-item--success'),
            () => document.querySelector('[data-test-artdeco-toast-item-type="success"]'),
            
            // Success messages in text
            () => {
                const bodyText = document.body.textContent.toLowerCase();
                return bodyText.includes('application submitted') || 
                       bodyText.includes('application sent') ||
                       bodyText.includes('submitted successfully');
            },
            
            // Modal closed (likely submitted)
            () => {
                const modal = document.querySelector('.jobs-easy-apply-modal');
                return !modal || !isVisible(modal);
            },
            
            // Thank you messages
            () => {
                const headers = document.querySelectorAll('h1, h2, h3, .artdeco-toast-item__message');
                for (const header of headers) {
                    const text = header.textContent.toLowerCase();
                    if (text.includes('thank you') || text.includes('application complete')) {
                        return true;
                    }
                }
                return false;
            }
        ];
        
        for (const indicator of successIndicators) {
            if (indicator()) {
                return true;
            }
        }
        
        return false;
    }

    // ==================== UTILITY FUNCTIONS ====================
    function getAllVisibleFormFields() {
        return Array.from(document.querySelectorAll(`
            input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([disabled]),
            textarea:not([disabled]),
            select:not([disabled])
        `)).filter(field => isVisible(field));
    }

    function getVisibleButtons() {
        return Array.from(document.querySelectorAll('button'))
            .filter(b => isVisible(b) && !b.disabled);
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
        
        // Try to find nearby text
        const parent = field.parentElement;
        if (parent) {
            const text = parent.textContent.trim();
            if (text && text.length < 100) return text;
        }
        
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
               style.opacity !== '0' &&
               rect.top >= 0 &&
               rect.left >= 0 &&
               rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
               rect.right <= (window.innerWidth || document.documentElement.clientWidth);
    }

    async function scrollIntoView(element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await delay(500);
    }

    async function scrollToLoadMoreJobs() {
        Logger.info('SCROLL', 'Loading more jobs...');
        window.scrollBy({ top: 1200, behavior: 'smooth' });
        await delay(3000);
    }

    async function closeAllModals() {
        const closeSelectors = [
            'button[aria-label*="Dismiss"]',
            'button[aria-label*="dismiss"]',
            'button[aria-label*="Close"]',
            'button[aria-label*="close"]',
            'button.artdeco-modal__dismiss',
            '.artdeco-modal__dismiss'
        ];
        
        for (const selector of closeSelectors) {
            const elements = document.querySelectorAll(selector);
            for (const element of elements) {
                if (isVisible(element)) {
                    element.click();
                    await delay(1000);
                    
                    // Handle any confirmation dialogs
                    const discardBtn = Array.from(document.querySelectorAll('button')).find(b => 
                        b.textContent.toLowerCase().includes('discard') ||
                        b.textContent.toLowerCase().includes('cancel')
                    );
                    
                    if (discardBtn && isVisible(discardBtn)) {
                        discardBtn.click();
                        await delay(1000);
                    }
                    
                    return;
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
        }, 1500);
    }

    function showNotification(message, type = 'info') {
        // Remove existing notifications
        const existing = document.querySelectorAll('.fillora-notification');
        existing.forEach(el => el.remove());
        
        const notification = document.createElement('div');
        notification.className = 'fillora-notification';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            background: ${type === 'success' ? '#057642' : '#0A66C2'};
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            font-weight: 600;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            max-width: 300px;
            word-wrap: break-word;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transition = 'opacity 0.5s ease';
            setTimeout(() => notification.remove(), 500);
        }, 4000);
    }

    function calculateExpectedSalary(experience) {
        const base = 4; // Base in LPA
        const increment = 1.5; // Increment per year
        return Math.round((base + (experience * increment)) * 100000);
    }

    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function humanLikeDelay(baseMs) {
        const variation = baseMs * 0.3; // 30% variation
        const actualMs = baseMs + (Math.random() * variation * 2 - variation);
        await delay(actualMs);
    }

    // ==================== AUTOFILL API ====================
    async function performAutoFill(userData) {
        state.userData = userData;
        state.fieldCache.clear();
        
        const fields = getAllVisibleFormFields();
        let filledCount = 0;
        
        for (const field of fields) {
            try {
                const before = field.value;
                await fillFieldIntelligently(field);
                if (field.value && field.value !== before) {
                    filledCount++;
                }
                await humanLikeDelay(500);
            } catch (error) {
                // Continue on error
            }
        }
        
        await handleCheckboxesIntelligently();
        await handleAllDropdownsIntelligently();
        await handleRadioButtons();
        
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

    Logger.success('SYSTEM', '🚀 Fillora v6.0 - ROBUST automation ready!');
    Logger.time('SYSTEM', '⏱️ Optimized timing: 30-60 seconds per job');
    Logger.info('SYSTEM', '🔍 Will apply Easy Apply filter automatically');

} else {
    console.log('⚠️ Fillora already initialized - skipping');
}