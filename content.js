// Fillora Chrome Extension - COMPLETE WORKING VERSION
// ✅ Clicks Easy Apply jobs and applies
// ✅ No more endless scrolling
// ✅ Actually submits applications
console.log('🎯 [FILLORA WORKING] Loading version that actually works...');

if (typeof window.filloraInitialized === 'undefined') {
    window.filloraInitialized = true;
    
    const contentState = {
        isActive: true,
        isProcessing: false,
        userProfile: null,
        resumeData: null,
        databaseData: null,
        openaiKey: '',
        
        processedJobs: new Set(),
        currentJobIndex: 0,
        filterCheckInterval: null,
        stats: {
            applicationsSubmitted: 0,
            jobsSkipped: 0,
            startTime: null
        },
        config: {
            MAX_JOBS: 5,
            MAX_FORM_STEPS: 35,
            MAX_CONSECUTIVE_ERRORS: 3,
            MAX_DROPDOWN_RETRIES: 3,
            JOB_SEARCH_KEYWORD: 'Data Analyst',
            DELAYS: {
                AFTER_JOB_CLICK: 1500,        // 2000 → 1500
                AFTER_EASY_APPLY_CLICK: 2000,  // 2500 → 2000
                AFTER_MODAL_OPEN: 1500,        // 2000 → 1500
                AFTER_FIELD_FILL: 200,         // 300 → 200
                AFTER_DROPDOWN_FILL: 400,      // 500 → 400
                AFTER_NEXT_CLICK: 1000,        // 1200 → 1000
                AFTER_REVIEW_CLICK: 1500,      // 1800 → 1500
                AFTER_SUBMIT_CLICK: 2500,      // 3000 → 2500
                BETWEEN_JOBS: 1500,            // 1800 → 1500
                WAIT_FOR_BUTTON: 400           // 500 → 400
            }
        }
    };

    function initializeContentScript() {
        console.log('🔧 [INIT] Starting...');
        setupMessageListener();
        loadOpenAIKey();
    }

    async function loadOpenAIKey() {
        try {
            const config = await chrome.storage.local.get('fillora_config');
            if (config.fillora_config?.OPENAI_API_KEY_BACKGROUND) {
                contentState.openaiKey = config.fillora_config.OPENAI_API_KEY_BACKGROUND;
                console.log('✅ [OPENAI] Key loaded');
            }
        } catch (e) {
            console.warn('⚠️ [OPENAI] No key');
        }
    }

    function setupMessageListener() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === 'PING') {
                sendResponse({ success: true });
                return false;
            }
            
            if (request.action === 'PERFORM_AUTOFILL') {
                performIntelligentAutofill()
                    .then(result => sendResponse(result))
                    .catch(error => sendResponse({ success: false, error: error.message }));
                return true;
            }
            
            if (request.action === 'START_LINKEDIN_AUTOMATION') {
                startLinkedInAutomation()
                    .then(result => sendResponse(result))
                    .catch(error => sendResponse({ success: false, error: error.message }));
                return true;
            }
            
            sendResponse({ success: false, error: 'Unknown action' });
            return false;
        });
    }

    // ==================== AUTOFILL (UNCHANGED) ====================
    async function performIntelligentAutofill() {
        if (contentState.isProcessing) {
            throw new Error('Already running');
        }
        
        contentState.isProcessing = true;
        const startTime = Date.now();
        
        try {
            showNotification('⚡ AutoFill Started!', 'info', 1000);
            
            const userId = await getUserId();
            if (!userId) throw new Error('Please login first');
            
            await loadAllUserData(userId);
            
            if (!contentState.databaseData && !contentState.resumeData) {
                throw new Error('No user data found');
            }
            
            const fields = getAllVisibleFields();
            let fieldsFilled = 0;
            
            for (const field of fields) {
                if (!isFieldAlreadyFilled(field)) {
                    const fieldInfo = getFieldInformation(field);
                    let filled = false;
                    
                    if (field.tagName.toLowerCase() === 'select') {
                        filled = await fillDropdownIntelligently(field, fieldInfo);
                    } else if (field.type === 'file') {
                        filled = await uploadResumeFile(field);
                    } else if (field.type === 'checkbox') {
                        filled = fillCheckboxField(field, fieldInfo);
                    } else if (field.type === 'radio') {
                        filled = fillRadioField(field, fieldInfo);
                    } else {
                        let value = getExactMatchValue(fieldInfo);
                        
                        if (!value && contentState.openaiKey) {
                            value = await getAIPoweredValue(fieldInfo);
                        }
                        
                        if (!value) {
                            value = makeIntelligentGuess(fieldInfo);
                        }
                        
                        if (value && value.toString().trim()) {
                            field.value = value.toString().trim();
                            triggerFieldEvents(field);
                            filled = true;
                        }
                    }
                    
                    if (filled) {
                        fieldsFilled++;
                        highlightField(field);
                    }
                    
                    await delay(200);
                }
            }
            
            const successRate = fields.length > 0 ? Math.round((fieldsFilled / fields.length) * 100) : 0;
            const timeTaken = ((Date.now() - startTime) / 1000).toFixed(2);
            
            showNotification(`✅ AutoFill Complete!\n${fieldsFilled}/${fields.length} (${successRate}%)`, 'success', 5000);
            
            return {
                success: true,
                fieldsFilled: fieldsFilled,
                totalFields: fields.length,
                successRate: successRate
            };
            
        } finally {
            contentState.isProcessing = false;
        }
    }

    async function loadAllUserData(userId) {
        console.log('📥 [DATA] Loading...');
        
        const dbResponse = await chrome.runtime.sendMessage({
            action: 'FETCH_ALL_DATABASE_TABLES',
            userId: userId
        });
        
        if (dbResponse?.success && dbResponse.data) {
            contentState.databaseData = dbResponse.data;
        }
        
        const resumeResponse = await chrome.runtime.sendMessage({
            action: 'PARSE_REAL_RESUME_CONTENT',
            userId: userId
        });
        
        if (resumeResponse?.success && resumeResponse.data) {
            contentState.resumeData = resumeResponse.data;
            
            const calculatedExp = calculateTotalExperience(resumeResponse.data);
            
            if (calculatedExp > 0) {
                contentState.resumeData.totalExperience = calculatedExp;
            } else if (contentState.databaseData?.totalExperience) {
                contentState.resumeData.totalExperience = contentState.databaseData.totalExperience;
            }
        }
    }

    function calculateTotalExperience(resumeData) {
        try {
            const resumeText = JSON.stringify(resumeData);
            const currentYear = new Date().getFullYear();
            const currentMonth = new Date().getMonth() + 1;
            
            let totalMonths = 0;
            const processedRanges = new Set();
            
            const rangePattern = /\b(19|20)\d{2}\s*[–\-—]\s*((19|20)\d{2}|present|current)\b/gi;
            const matches = Array.from(resumeText.matchAll(rangePattern));
            
            for (const match of matches) {
                const fullMatch = match[0];
                const normalized = fullMatch.replace(/\s+/g, '').toLowerCase();
                
                if (processedRanges.has(normalized)) continue;
                processedRanges.add(normalized);
                
                const startYearMatch = fullMatch.match(/\b(19|20)\d{2}\b/);
                if (!startYearMatch) continue;
                
                const startYear = parseInt(startYearMatch[0]);
                const parts = fullMatch.split(/[–\-—]/);
                if (parts.length < 2) continue;
                
                const endPart = parts[1].trim().toLowerCase();
                let endYear, endMonth;
                
                if (endPart.includes('present') || endPart.includes('current')) {
                    endYear = currentYear;
                    endMonth = currentMonth;
                } else {
                    const endYearMatch = endPart.match(/\b(19|20)\d{2}\b/);
                    if (!endYearMatch) continue;
                    endYear = parseInt(endYearMatch[0]);
                    endMonth = 12;
                }
                
                if (startYear < 1990 || startYear > currentYear || endYear < startYear || endYear > currentYear) {
                    continue;
                }
                
                const startMonth = 1;
                const monthsInRange = (endYear - startYear) * 12 + (endMonth - startMonth);
                
                if (monthsInRange > 0) {
                    totalMonths += monthsInRange;
                }
            }
            
            const totalYears = Math.round(totalMonths / 12 * 10) / 10;
            return totalYears > 0 ? totalYears : 0;
            
        } catch (error) {
            return 0;
        }
    }

    // ==================== LINKEDIN AUTOMATION (FIXED - ACTUALLY WORKS!) ====================
    
    async function startLinkedInAutomation() {
        if (contentState.isProcessing) {
            throw new Error('Already running');
        }
        
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🚀 [LINKEDIN] STARTING - WILL ACTUALLY APPLY NOW');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        
        contentState.isProcessing = true;
        contentState.processedJobs.clear();
        contentState.currentJobIndex = 0;
        contentState.stats.applicationsSubmitted = 0;
        contentState.stats.jobsSkipped = 0;
        contentState.stats.startTime = Date.now();
        
        try {
            showNotification('📥 Loading data...', 'info', 2000);
            
            const userId = await getUserId();
            if (!userId) throw new Error('Please login first');
            
            console.log('📥 [1/3] Loading data...');
            await loadAllUserData(userId);
            
            if (!contentState.databaseData && !contentState.resumeData) {
                throw new Error('No user data found');
            }
            console.log('✅ [1/3] Data loaded\n');
            
            showNotification('🔗 Checking page...', 'info', 2000);
            console.log('🔗 [2/3] Navigation...');
            
            const isOnCorrectPage = checkIfOnCorrectLinkedInPage();
            
            if (!isOnCorrectPage) {
                console.log('   Navigating...');
                navigateToLinkedInJobs();
                await delay(8000);
            } else {
                console.log('   ✅ Already on correct page');
            }
            console.log('✅ [2/3] Page ready\n');
            
            showNotification('🚀 Starting applications...', 'info', 2000);
            console.log('🚀 [3/3] Processing jobs...\n');
            
            // CRITICAL: Process jobs WITHOUT strict filtering!
            await processAllJobsWithEasyApplyCheck();
            
            const totalTime = ((Date.now() - contentState.stats.startTime) / 1000).toFixed(1);
            
            console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('✅ [COMPLETE]');
            console.log(`📊 Submitted: ${contentState.stats.applicationsSubmitted}/${contentState.config.MAX_JOBS}`);
            console.log(`⏭️  Skipped: ${contentState.stats.jobsSkipped}`);
            console.log(`⏱️  Time: ${totalTime}s`);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
            
            showNotification(
                `✅ Done!\nSubmitted: ${contentState.stats.applicationsSubmitted}/${contentState.config.MAX_JOBS}`,
                'success',
                8000
            );
            
            return {
                success: true,
                applicationsSubmitted: contentState.stats.applicationsSubmitted,
                jobsSkipped: contentState.stats.jobsSkipped,
                totalTime: totalTime
            };
            
        } catch (error) {
            console.error('❌ [ERROR]', error);
            throw error;
        } finally {
            contentState.isProcessing = false;
        }
    }

    function checkIfOnCorrectLinkedInPage() {
        const currentUrl = new URL(window.location.href);
        
        if (!currentUrl.hostname.includes('linkedin.com')) return false;
        if (!currentUrl.pathname.includes('/jobs/')) return false;
        
        const hasEasyApply = currentUrl.searchParams.get('f_AL') === 'true';
        const hasPast24h = currentUrl.searchParams.get('f_TPR') === 'r86400';
        const hasMostRecent = currentUrl.searchParams.get('sortBy') === 'DD';
        
        return hasEasyApply && hasPast24h && hasMostRecent;
    }

    function navigateToLinkedInJobs() {
        const jobsUrl = new URL('https://www.linkedin.com/jobs/search/');
        jobsUrl.searchParams.set('keywords', contentState.config.JOB_SEARCH_KEYWORD);
        jobsUrl.searchParams.set('f_AL', 'true');
        jobsUrl.searchParams.set('f_TPR', 'r86400');
        jobsUrl.searchParams.set('sortBy', 'DD');
        jobsUrl.searchParams.set('location', 'India');
        
        window.location.href = jobsUrl.toString();
    }

    // ==================== CRITICAL: PROCESS JOBS WITHOUT FILTERING! ====================
    
    async function processAllJobsWithEasyApplyCheck() {
        let consecutiveErrors = 0;
        const maxErrors = contentState.config.MAX_CONSECUTIVE_ERRORS;
        
        while (contentState.stats.applicationsSubmitted < contentState.config.MAX_JOBS && 
               consecutiveErrors < maxErrors) {
            
            try {
                // CRITICAL: Get ALL job cards, don't filter yet!
                const allJobCards = getAllJobCards();
                
                if (allJobCards.length === 0) {
                    console.log('⚠️ [JOBS] No jobs found, waiting...');
                    await delay(3000);
                    continue;
                }
                
                // Check if need to scroll
                if (contentState.currentJobIndex >= allJobCards.length) {
                    console.log('📜 [JOBS] End of list, scrolling...');
                    window.scrollTo(0, document.body.scrollHeight);
                    await delay(3000);
                    contentState.currentJobIndex = 0;
                    continue;
                }
                
                const currentCard = allJobCards[contentState.currentJobIndex];
                const jobId = extractJobId(currentCard);
                
                console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                console.log(`🎯 [JOB ${contentState.currentJobIndex + 1}/${allJobCards.length}] ID: ${jobId}`);
                console.log(`   📊 Progress: ${contentState.stats.applicationsSubmitted}/${contentState.config.MAX_JOBS}`);
                console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                
                // Process this job
                const result = await processSingleJob(currentCard, jobId);
                
                if (result.submitted) {
                    contentState.stats.applicationsSubmitted++;
                    consecutiveErrors = 0;
                    console.log(`✅ [SUCCESS] ${contentState.stats.applicationsSubmitted}/${contentState.config.MAX_JOBS}`);
                    showNotification(`✅ App ${contentState.stats.applicationsSubmitted}/${contentState.config.MAX_JOBS}`, 'success', 2000);
                } else {
                    contentState.stats.jobsSkipped++;
                    console.log(`⏭️  [SKIPPED] ${result.reason}`);
                }
                
                // Always move to next job
                contentState.currentJobIndex++;
                await delay(contentState.config.DELAYS.BETWEEN_JOBS);
                
            } catch (error) {
                console.error(`❌ [ERROR]`, error.message);
                consecutiveErrors++;
                contentState.stats.jobsSkipped++;
                contentState.currentJobIndex++;
                
                if (consecutiveErrors >= maxErrors) {
                    console.error(`❌ [FATAL] Stopping`);
                    break;
                }
                
                await delay(2000);
            }
        }
    }

    // Get ALL job cards (no filtering!)
    function getAllJobCards() {
        const selectors = [
            '.jobs-search-results__list-item',
            '.scaffold-layout__list-item',
            'li[data-occludable-job-id]',
            'li[data-job-id]'
        ];
        
        for (const selector of selectors) {
            const cards = Array.from(document.querySelectorAll(selector))
                .filter(card => isElementVisible(card));
            
            if (cards.length > 0) {
                console.log(`   📋 Found ${cards.length} job cards`);
                return cards;
            }
        }
        
        return [];
    }

    function extractJobId(jobCard) {
        return jobCard.getAttribute('data-occludable-job-id') || 
               jobCard.getAttribute('data-job-id') || 
               `job-${contentState.currentJobIndex}`;
    }

    // ==================== PROCESS SINGLE JOB (CHECK EASY APPLY AFTER CLICKING!) ====================
    
    async function processSingleJob(jobCard, jobId) {
        if (contentState.processedJobs.has(jobId)) {
            return { submitted: false, skipped: true, reason: 'Already processed' };
        }
        
        try {
            // STEP 1: Click job card FIRST
            console.log('   [1/5] 🖱️  Clicking job...');
            await clickJobCard(jobCard);
            await delay(contentState.config.DELAYS.AFTER_JOB_CLICK);
            console.log('   [1/5] ✅ Job clicked');
            
            // STEP 2: NOW check if Easy Apply button appears
            console.log('   [2/5] 🔍 Checking for Easy Apply button...');
            const hasEasyApply = await waitForEasyApplyButton(3000); // 5000 → 3000 for speed
            
            if (!hasEasyApply) {
                console.log('   [2/5] ⏭️  NO Easy Apply - skipping');
                contentState.processedJobs.add(jobId);
                return { submitted: false, skipped: true, reason: 'No Easy Apply button' };
            }
            console.log('   [2/5] ✅ Easy Apply button found!');
            
            // STEP 3: Click Easy Apply
            console.log('   [3/5] 🖱️  Clicking Easy Apply...');
            const modalOpened = await clickEasyApplyButton();
            
            if (!modalOpened) {
                console.log('   [3/5] ❌ Modal failed to open');
                contentState.processedJobs.add(jobId);
                return { submitted: false, skipped: true, reason: 'Modal failed' };
            }
            await delay(contentState.config.DELAYS.AFTER_MODAL_OPEN);
            console.log('   [3/5] ✅ Modal opened!');
            
            // STEP 4: Fill form
            console.log('   [4/5] 📝 Filling form...');
            const submitted = await fillAndSubmitForm();
            
            if (!submitted) {
                console.log('   [4/5] ❌ Submit failed');
                await handleDiscardPopup();
                await closeModal();
                contentState.processedJobs.add(jobId);
                return { submitted: false, skipped: true, reason: 'Submit failed' };
            }
            console.log('   [4/5] ✅ Form submitted!');
            
            // STEP 5: Verify
            console.log('   [5/5] ✅ Verifying...');
            await delay(2000);
            
            const isComplete = await checkApplicationComplete();
            await closeModal();
            contentState.processedJobs.add(jobId);
            
            return isComplete ? 
                { submitted: true } : 
                { submitted: false, skipped: true, reason: 'Verification uncertain' };
            
        } catch (error) {
            console.error('   ❌ ERROR:', error.message);
            await handleDiscardPopup();
            await closeModal();
            contentState.processedJobs.add(jobId);
            return { submitted: false, skipped: true, reason: error.message };
        }
    }

    async function clickJobCard(jobCard) {
        jobCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await delay(500);
        
        try {
            jobCard.click();
        } catch {
            jobCard.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        }
    }

    async function waitForEasyApplyButton(maxWait = 5000) {
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxWait) {
            const buttons = document.querySelectorAll('button');
            
            for (const button of buttons) {
                if (isElementVisible(button) && !button.disabled) {
                    const text = button.textContent.toLowerCase();
                    const ariaLabel = (button.getAttribute('aria-label') || '').toLowerCase();
                    
                    if (text.includes('easy apply') || ariaLabel.includes('easy apply')) {
                        return true;
                    }
                }
            }
            
            await delay(200); // 300 → 200 for speed
        }
        
        return false;
    }

    async function clickEasyApplyButton() {
        for (let attempt = 1; attempt <= 6; attempt++) { // 10 → 6 for speed
            const buttons = document.querySelectorAll('button');
            
            for (const button of buttons) {
                if (isElementVisible(button) && !button.disabled) {
                    const text = button.textContent.toLowerCase();
                    const ariaLabel = (button.getAttribute('aria-label') || '').toLowerCase();
                    
                    if (text.includes('easy apply') || ariaLabel.includes('easy apply')) {
                        button.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        await delay(300);
                        
                        try {
                            button.click();
                        } catch {
                            button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                        }
                        
                        await delay(contentState.config.DELAYS.AFTER_EASY_APPLY_CLICK);
                        
                        if (isModalOpen()) {
                            return true;
                        }
                    }
                }
            }
            
            await delay(400);
        }
        
        return false;
    }

    function isModalOpen() {
        const selectors = ['.jobs-easy-apply-modal', '.jobs-easy-apply-content', 'div[role="dialog"]'];
        
        for (const selector of selectors) {
            const modal = document.querySelector(selector);
            if (modal && isElementVisible(modal)) return true;
        }
        
        return false;
    }

    function getModal() {
        const selectors = ['.jobs-easy-apply-modal', '.jobs-easy-apply-content', 'div[role="dialog"]'];
        
        for (const selector of selectors) {
            const modal = document.querySelector(selector);
            if (modal && isElementVisible(modal)) return modal;
        }
        
        return null;
    }

    async function fillAndSubmitForm() {
        for (let step = 1; step <= contentState.config.MAX_FORM_STEPS; step++) {
            console.log(`      [Step ${step}]`);
            
            if (await checkApplicationComplete()) {
                return true;
            }
            
            await delay(1000);
            const filled = await fillAllFieldsInModal();
            console.log(`         Filled ${filled} fields`);
            
            await delay(1000);
            
            const buttonClicked = await clickNextOrSubmitButton();
            
            if (!buttonClicked) {
                await delay(2000);
                if (await checkApplicationComplete()) {
                    return true;
                }
                
                if (step > 3) {
                    return false;
                }
            }
            
            await delay(1500);
        }
        
        return false;
    }

    async function fillAllFieldsInModal() {
        const modal = getModal();
        if (!modal) return 0;
        
        const fields = getAllVisibleFields(modal);
        let filled = 0;
        
        for (const field of fields) {
            if (!isFieldAlreadyFilled(field)) {
                const fieldInfo = getFieldInformation(field);
                
                let success = false;
                
                if (field.tagName.toLowerCase() === 'select') {
                    success = await fillDropdownWithRetry(field, fieldInfo);
                } else if (field.type === 'file') {
                    success = await uploadResumeFile(field);
                } else if (field.type === 'checkbox') {
                    success = fillCheckboxField(field, fieldInfo);
                } else if (field.type === 'radio') {
                    success = fillRadioField(field, fieldInfo);
                } else {
                    let value = getExactMatchValue(fieldInfo);
                    
                    if (!value && contentState.openaiKey) {
                        value = await getAIPoweredValue(fieldInfo);
                    }
                    
                    if (!value) {
                        value = makeIntelligentGuess(fieldInfo);
                    }
                    
                    if (value && value.toString().trim()) {
                        // VALIDATION: Check if field requires numeric input
                        if (field.type === 'number' || field.inputMode === 'numeric' || field.inputMode === 'decimal') {
                            // Extract only numeric value
                            const numericValue = value.toString().replace(/[^0-9.]/g, '');
                            
                            if (numericValue && parseFloat(numericValue) > 0) {
                                field.value = numericValue;
                                triggerFieldEvents(field);
                                success = true;
                            }
                        } else {
                            // Regular text field
                            field.value = value.toString().trim();
                            triggerFieldEvents(field);
                            success = true;
                        }
                    }
                }
                
                if (success) filled++;
                await delay(contentState.config.DELAYS.AFTER_FIELD_FILL);
            }
        }
        
        return filled;
    }

    async function fillDropdownWithRetry(selectElement, fieldInfo) {
        for (let attempt = 1; attempt <= contentState.config.MAX_DROPDOWN_RETRIES; attempt++) {
            const success = await fillDropdownIntelligently(selectElement, fieldInfo);
            
            if (success) {
                await delay(contentState.config.DELAYS.AFTER_DROPDOWN_FILL);
                
                if (isFieldAlreadyFilled(selectElement)) {
                    return true;
                }
            }
            
            await delay(300);
        }
        
        return false;
    }

    async function fillDropdownIntelligently(selectElement, fieldInfo) {
        const options = Array.from(selectElement.options).filter(option => 
            option.value && 
            option.value !== '' && 
            option.value !== 'select' &&
            option.value !== '-1' &&
            !option.text.toLowerCase().includes('select an option') &&
            !option.text.toLowerCase().includes('no answer')
        );
        
        if (options.length === 0) return false;
        
        const context = fieldInfo.context;
        const userData = { ...contentState.databaseData, ...contentState.resumeData };
        const totalExperience = userData.totalExperience || 0;
        
        let selectedOption = null;
        
        // Salary
        if (context.includes('salary') || context.includes('ctc') || context.includes('compensation')) {
            selectedOption = selectSalaryIntelligently(options, totalExperience);
        }
        
        // Experience level
        if (!selectedOption && context.includes('experience') && context.includes('level')) {
            if (totalExperience < 2) {
                selectedOption = options.find(o => /entry|junior|fresher/i.test(o.text));
            } else if (totalExperience < 5) {
                selectedOption = options.find(o => /mid|intermediate/i.test(o.text));
            } else if (totalExperience < 8) {
                selectedOption = options.find(o => /senior/i.test(o.text));
            } else {
                selectedOption = options.find(o => /lead|expert|principal/i.test(o.text));
            }
        }
        
        // Years
        if (!selectedOption && context.includes('year') && context.includes('experience')) {
            const expString = Math.floor(totalExperience).toString();
            selectedOption = options.find(o => o.text.includes(expString) || o.value.includes(expString));
        }
        
        // Tools
        if (!selectedOption && (context.includes('visualization') || context.includes('tableau') || context.includes('power bi'))) {
            selectedOption = options.find(o => /yes|tableau|power bi|python/i.test(o.text));
        }
        
        // Cloud
        if (!selectedOption && (context.includes('cloud') || context.includes('aws') || context.includes('azure'))) {
            selectedOption = options.find(o => /yes|aws|azure/i.test(o.text));
        }
        
        // Availability
        if (!selectedOption && (context.includes('available') || context.includes('joining'))) {
            selectedOption = options.find(o => /immediate|yes|now/i.test(o.text));
        }
        
        // Yes/No
        if (!selectedOption && options.length === 2) {
            const yesOption = options.find(o => /yes/i.test(o.text));
            const noOption = options.find(o => /no/i.test(o.text));
            
            if (yesOption && noOption) {
                if (/willing|authorize|relocate|eligible/i.test(context)) {
                    selectedOption = yesOption;
                } else if (/sponsorship|visa/i.test(context)) {
                    selectedOption = noOption;
                } else {
                    selectedOption = yesOption;
                }
            }
        }
        
        // Exact match
        if (!selectedOption) {
            const targetValue = getExactMatchValue(fieldInfo);
            if (targetValue) {
                selectedOption = options.find(o => 
                    o.text.toLowerCase().includes(targetValue.toLowerCase()) ||
                    targetValue.toLowerCase().includes(o.text.toLowerCase())
                );
            }
        }
        
        // AI
        if (!selectedOption && contentState.openaiKey && options.length <= 20) {
            selectedOption = await selectOptionWithAI(fieldInfo, options);
        }
        
        // FALLBACK: Always select first option
        if (!selectedOption) {
            selectedOption = options[0];
        }
        
        if (selectedOption) {
            selectElement.value = selectedOption.value;
            selectElement.selectedIndex = Array.from(selectElement.options).indexOf(selectedOption);
            selectedOption.selected = true;
            triggerFieldEvents(selectElement);
            return true;
        }
        
        return false;
    }

    function selectSalaryIntelligently(options, exp) {
        let min = 0, max = 0;
        
        if (exp < 1) { min = 200000; max = 400000; }
        else if (exp < 2) { min = 300000; max = 600000; }
        else if (exp < 3) { min = 500000; max = 900000; }
        else if (exp < 5) { min = 800000; max = 1500000; }
        else if (exp < 7) { min = 1200000; max = 2500000; }
        else if (exp < 10) { min = 1800000; max = 3500000; }
        else { min = 2500000; max = 5000000; }
        
        let best = null, bestScore = -1;
        
        for (const opt of options) {
            const nums = opt.text.match(/(\d+(?:\.\d+)?)/g);
            if (!nums) continue;
            
            let optMin = 0, optMax = 0;
            
            if (nums.length === 1) {
                const val = parseFloat(nums[0]);
                optMin = optMax = val < 100 ? val * 100000 : val;
            } else {
                optMin = parseFloat(nums[0]) < 100 ? parseFloat(nums[0]) * 100000 : parseFloat(nums[0]);
                optMax = parseFloat(nums[1]) < 100 ? parseFloat(nums[1]) * 100000 : parseFloat(nums[1]);
            }
            
            if (optMin === 0) continue;
            
            let score = 0;
            
            if (optMin <= max && optMax >= min) {
                score = 100;
                if (optMin >= min && optMax <= max) score = 150;
                const mid = (min + max) / 2;
                if (mid >= optMin && mid <= optMax) score = 200;
            }
            
            if (score > bestScore) {
                bestScore = score;
                best = opt;
            }
        }
        
        return best;
    }

    async function selectOptionWithAI(fieldInfo, options) {
        if (!contentState.openaiKey) return null;
        
        try {
            const label = fieldInfo.label || fieldInfo.name;
            const userData = { ...contentState.databaseData, ...contentState.resumeData };
            const optionsList = options.map(o => o.text).join(', ');
            
            const prompt = `Field: "${label}". Options: [${optionsList}]. User: ${userData.fullName}, ${userData.totalExperience} years. Which option? Respond with ONLY the exact option text.`;
            
            const response = await Promise.race([
                fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${contentState.openaiKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: 'gpt-3.5-turbo',
                        messages: [{ role: 'user', content: prompt }],
                        max_tokens: 30,
                        temperature: 0.2
                    })
                }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
            ]);
            
            if (response.ok) {
                const data = await response.json();
                const aiSelection = data.choices[0].message.content.trim();
                
                return options.find(o => 
                    o.text.toLowerCase().includes(aiSelection.toLowerCase()) ||
                    aiSelection.toLowerCase().includes(o.text.toLowerCase())
                );
            }
        } catch (error) {
            // Silent
        }
        
        return null;
    }

    async function clickNextOrSubmitButton() {
        const modal = getModal();
        if (!modal) return false;
        
        const buttons = Array.from(modal.querySelectorAll('button')).filter(b => 
            isElementVisible(b) && !b.disabled
        );
        
        if (buttons.length === 0) return false;
        
        // Priority: Review → Submit → Next
        for (const btn of buttons) {
            const text = btn.textContent.toLowerCase();
            const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
            const combined = `${text} ${aria}`;
            
            if (/review|preview/i.test(combined) && !/next|submit|back/i.test(combined)) {
                btn.click();
                await delay(contentState.config.DELAYS.AFTER_REVIEW_CLICK);
                return true;
            }
        }
        
        for (const btn of buttons) {
            const text = btn.textContent.toLowerCase();
            const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
            const combined = `${text} ${aria}`;
            
            if (/submit|send/i.test(combined) && !/next|review|back/i.test(combined)) {
                btn.click();
                await delay(contentState.config.DELAYS.AFTER_SUBMIT_CLICK);
                return true;
            }
        }
        
        for (const btn of buttons) {
            const text = btn.textContent.toLowerCase();
            const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
            const combined = `${text} ${aria}`;
            
            if (/next|continue/i.test(combined) && !/submit|back/i.test(combined)) {
                btn.click();
                await delay(contentState.config.DELAYS.AFTER_NEXT_CLICK);
                return true;
            }
        }
        
        return false;
    }

    async function checkApplicationComplete() {
        if (!isModalOpen()) return true;
        
        const text = document.body.textContent.toLowerCase();
        return /application sent|application submitted|successfully applied|application complete/i.test(text);
    }

    async function handleDiscardPopup() {
        await delay(1000);
        
        const buttons = document.querySelectorAll('button');
        for (const btn of buttons) {
            if (/discard|don't save/i.test(btn.textContent)) {
                btn.click();
                await delay(1000);
                return;
            }
        }
    }

    async function closeModal() {
        const selectors = ['button[aria-label*="Dismiss"]', 'button.artdeco-modal__dismiss', '.artdeco-modal__dismiss'];
        
        for (const selector of selectors) {
            const buttons = document.querySelectorAll(selector);
            for (const btn of buttons) {
                if (isElementVisible(btn)) {
                    btn.click();
                    await delay(1000);
                    return;
                }
            }
        }
    }

    // ==================== HELPER FUNCTIONS ====================
    
    function getFieldInformation(field) {
        const label = getFieldLabel(field).toLowerCase();
        const name = (field.name || '').toLowerCase();
        const placeholder = (field.placeholder || '').toLowerCase();
        const ariaLabel = (field.getAttribute('aria-label') || '').toLowerCase();
        
        return {
            field: field,
            label: label,
            name: name,
            placeholder: placeholder,
            ariaLabel: ariaLabel,
            context: `${label} ${name} ${placeholder} ${ariaLabel}`
        };
    }

    function isFieldAlreadyFilled(field) {
        if (field.tagName.toLowerCase() === 'select') {
            if (!field.value || field.value === '' || field.value === 'select' || field.value === '-1') {
                return false;
            }
            
            const opt = field.options[field.selectedIndex];
            if (!opt) return false;
            
            const text = opt.text.toLowerCase();
            return !text.includes('select') && !text.includes('no answer') && !text.includes('choose');
        }
        
        if (field.type === 'checkbox') return field.checked;
        
        if (field.type === 'radio') {
            if (!field.name) return field.checked;
            const group = document.querySelectorAll(`input[type="radio"][name="${field.name}"]`);
            return Array.from(group).some(r => r.checked);
        }
        
        if (field.type === 'file') return field.files && field.files.length > 0;
        
        return (field.value || '').trim().length > 0;
    }

    function getExactMatchValue(fieldInfo) {
        const context = fieldInfo.context.toLowerCase();
        const db = contentState.databaseData || {};
        const resume = contentState.resumeData || {};
        const exp = resume.totalExperience || db.totalExperience || 0;
        
        // Basic fields
        if (/first.*name/i.test(context)) return db.firstName || resume.firstName || '';
        if (/last.*name/i.test(context)) return db.lastName || resume.lastName || '';
        if (/email/i.test(context)) return db.email || resume.email || '';
        if (/phone/i.test(context)) return db.phone || resume.phone || '';
        if (/city/i.test(context)) return db.city || resume.city || '';
        
        // Experience in YEARS
        if (/experience.*year/i.test(context) && !/notice/i.test(context)) {
            return exp.toString();
        }
        
        // CRITICAL: Notice Period - ALWAYS in DAYS!
        if (/notice.*period/i.test(context)) {
            // Check if they want it in days/weeks/months
            if (/day/i.test(context)) {
                return '15'; // 15 days notice
            } else if (/week/i.test(context)) {
                return '2'; // 2 weeks
            } else if (/month/i.test(context)) {
                return '1'; // 1 month
            } else {
                // Default: assume days
                return '15';
            }
        }
        
        // Current CTC (in Lakhs)
        if (/current.*ctc|current.*salary|current.*compensation/i.test(context)) {
            const expYears = Math.floor(exp);
            let ctc = 0;
            
            if (expYears < 1) ctc = 3.5;
            else if (expYears < 2) ctc = 5;
            else if (expYears < 3) ctc = 7;
            else if (expYears < 5) ctc = 10;
            else if (expYears < 7) ctc = 15;
            else if (expYears < 10) ctc = 20;
            else ctc = 25;
            
            return ctc.toString();
        }
        
        // Expected CTC (20-30% more than current)
        if (/expected.*ctc|expected.*salary|expected.*compensation/i.test(context)) {
            const expYears = Math.floor(exp);
            let expectedCtc = 0;
            
            if (expYears < 1) expectedCtc = 4.5;
            else if (expYears < 2) expectedCtc = 6.5;
            else if (expYears < 3) expectedCtc = 9;
            else if (expYears < 5) expectedCtc = 13;
            else if (expYears < 7) expectedCtc = 19;
            else if (expYears < 10) expectedCtc = 26;
            else expectedCtc = 32;
            
            return expectedCtc.toString();
        }
        
        // Official Notice Period (in days - MUST be numeric!)
        if (/official.*notice/i.test(context)) {
            return '30'; // 30 days standard
        }
        
        return '';
    }

    async function getAIPoweredValue(fieldInfo) {
        if (!contentState.openaiKey) return '';
        
        try {
            const label = fieldInfo.label || fieldInfo.name || fieldInfo.placeholder;
            const userData = { ...contentState.databaseData, ...contentState.resumeData };
            const exp = userData.totalExperience || 0;
            
            // Build intelligent prompt with context
            const prompt = `You are filling a LinkedIn job application form. Read the question carefully and provide ONLY the exact value to fill (no explanation).

Question: "${label}"
User Profile:
- Name: ${userData.fullName || userData.firstName + ' ' + userData.lastName}
- Experience: ${exp} years
- Current Role: Data Analyst/Data Scientist
- Location: India

CRITICAL RULES:
1. If question asks for "notice period" in DAYS → answer with number like "15" or "30" (NOT years!)
2. If question asks for "notice period" in MONTHS → answer "1" or "2"
3. If question asks "Current CTC" → answer in Lakhs (e.g., "10" for 10 LPA)
4. If question asks "Expected CTC" → answer 20-30% more than current (e.g., "13" if current is 10)
5. If question asks "comfortable with 6 months contract?" → answer "Yes"
6. If question asks "willing to relocate?" → answer "Yes"
7. If question is numeric, answer with JUST the number (no units unless asked)
8. If question is yes/no, answer with "Yes" or "No"
9. Read the question VERY CAREFULLY before answering

Give ONLY the value to fill (max 100 characters). If you're unsure, say "UNKNOWN".`;
            
            const response = await Promise.race([
                fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${contentState.openaiKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: 'gpt-3.5-turbo',
                        messages: [{ role: 'user', content: prompt }],
                        max_tokens: 100,
                        temperature: 0.1 // Very low temperature for consistent, accurate answers
                    })
                }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 8000))
            ]);
            
            if (response.ok) {
                const data = await response.json();
                const aiValue = data.choices[0].message.content.trim();
                
                // Clean up AI response
                const cleanedValue = aiValue.replace(/["'`]/g, '').trim();
                
                if (cleanedValue && cleanedValue !== 'UNKNOWN' && cleanedValue.length < 500) {
                    console.log(`      🤖 AI filled "${label}" with: "${cleanedValue}"`);
                    return cleanedValue;
                }
            }
        } catch (error) {
            console.warn('      ⚠️ AI error:', error.message);
        }
        
        return '';
    }

    function makeIntelligentGuess(fieldInfo) {
        const context = fieldInfo.context.toLowerCase();
        
        // Notice period (ALWAYS in days unless specified)
        if (/notice.*period/i.test(context)) {
            if (/day/i.test(context)) return '15';
            if (/week/i.test(context)) return '2';
            if (/month/i.test(context)) return '1';
            return '15'; // Default: 15 days
        }
        
        // Official notice period
        if (/official.*notice/i.test(context)) {
            return '30';
        }
        
        // Contract/comfortable questions
        if (/contract|comfortable/i.test(context)) return 'Yes';
        
        // Authorization/eligibility
        if (/authorize|eligible/i.test(context)) return 'Yes';
        
        // Availability
        if (/available|start|joining/i.test(context)) return 'Immediate';
        
        // Relocation
        if (/relocate|willing/i.test(context)) return 'Yes';
        
        // Sponsorship
        if (/sponsorship|visa/i.test(context)) return 'No';
        
        return '';
    }

    function fillCheckboxField(checkbox, fieldInfo) {
        if (/agree|terms|policy|consent|authorize/i.test(fieldInfo.context)) {
            checkbox.checked = true;
            triggerFieldEvents(checkbox);
            return true;
        }
        return false;
    }

    function fillRadioField(radio, fieldInfo) {
        if (!radio.name) return false;
        
        const group = document.querySelectorAll(`input[type="radio"][name="${radio.name}"]`);
        if (Array.from(group).some(r => r.checked)) return false;
        
        if (/yes/i.test(fieldInfo.label) && /willing|authorize/i.test(fieldInfo.context)) {
            radio.checked = true;
            triggerFieldEvents(radio);
            return true;
        }
        
        return false;
    }

    async function uploadResumeFile(fileInput) {
        try {
            const userId = await getUserId();
            if (!userId) return false;
            
            const response = await chrome.runtime.sendMessage({
                action: 'FETCH_RESUME_FILE',
                userId: userId
            });
            
            if (response?.success && response.fileData?.url) {
                const fileResponse = await fetch(response.fileData.url);
                const blob = await fileResponse.blob();
                const file = new File([blob], response.fileData.name || 'resume.pdf', { type: 'application/pdf' });
                
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(file);
                fileInput.files = dataTransfer.files;
                
                triggerFieldEvents(fileInput);
                return true;
            }
        } catch (error) {
            // Silent
        }
        
        return false;
    }

    function getAllVisibleFields(container = document) {
        const fields = container.querySelectorAll('input:not([type="hidden"]), textarea, select');
        
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

    function getFieldLabel(field) {
        try {
            if (field.id) {
                const label = document.querySelector(`label[for="${field.id}"]`);
                if (label) return label.textContent.trim();
            }
            
            const parentLabel = field.closest('label');
            if (parentLabel) return parentLabel.textContent.trim();
            
            return field.getAttribute('aria-label') || field.placeholder || field.name || '';
        } catch {
            return '';
        }
    }

    function isElementVisible(element) {
        if (!element) return false;
        
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        
        return rect.width > 0 && 
               rect.height > 0 && 
               style.display !== 'none' && 
               style.visibility !== 'hidden' &&
               style.opacity !== '0';
    }

    function highlightField(field) {
        const orig = { bg: field.style.backgroundColor, border: field.style.border };
        
        field.style.backgroundColor = '#dcfce7';
        field.style.border = '2px solid #22c55e';
        
        setTimeout(() => {
            field.style.backgroundColor = orig.bg;
            field.style.border = orig.border;
        }, 1500);
    }

    function showNotification(message, type, duration) {
        const notif = document.createElement('div');
        
        const colors = { success: '#10B981', error: '#EF4444', info: '#3B82F6' };
        
        notif.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 10px 14px;
            background: ${colors[type] || colors.info};
            color: white;
            border-radius: 8px;
            z-index: 999999;
            font-weight: 600;
            font-size: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            max-width: 280px;
            font-family: Arial, sans-serif;
        `;
        
        notif.textContent = message;
        document.body.appendChild(notif);
        
        setTimeout(() => {
            if (notif.parentElement) notif.remove();
        }, duration);
    }

    function triggerFieldEvents(field) {
        ['input', 'change', 'blur', 'focusout'].forEach(type => {
            field.dispatchEvent(new Event(type, { bubbles: true }));
        });
        
        const nativeInputSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        const nativeSelectSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')?.set;
        
        if (field.tagName === 'SELECT' && nativeSelectSetter) {
            nativeSelectSetter.call(field, field.value);
        } else if (nativeInputSetter) {
            nativeInputSetter.call(field, field.value);
        }
        
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function getUserId() {
        try {
            const result = await chrome.storage.local.get(['fillora_user']);
            return result.fillora_user?.id || null;
        } catch {
            return null;
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeContentScript);
    } else {
        initializeContentScript();
    }

    console.log('✅ [FILLORA WORKING] Ready - Will actually click and apply!');

} else {
    console.log('⚠️ Already initialized');
}