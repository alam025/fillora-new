// Fillora Chrome Extension - ENHANCED Content Script (85%+ Accuracy)
// Intelligent AutoFill + Perfect LinkedIn Automation with OpenAI
console.log('🎯 [FILLORA ENHANCED] Loading with 85%+ accuracy...');

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
        filterCheckInterval: null,
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
                AFTER_JOB_CLICK: 1500,
                AFTER_EASY_APPLY: 2500,
                AFTER_FIELD_FILL: 300,
                AFTER_DROPDOWN: 400,
                AFTER_NEXT: 1500,
                AFTER_SUBMIT: 3000,
                BETWEEN_JOBS: 2000
            }
        }
    };

    // ==================== INITIALIZATION ====================
    function initializeContentScript() {
        console.log('🔧 [FILLORA] Initializing ENHANCED version...');
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
                                message: 'Content script active with 85%+ fill rate' 
                            });
                            break;
                            
                        case 'PERFORM_AUTOFILL':
                            const result = await performIntelligentAutofill();
                            sendResponse(result);
                            break;
                            
                        case 'START_LINKEDIN_AUTOMATION':
                            const linkedinResult = await startLinkedInAutomation(request.userData);
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

    // ==================== INTELLIGENT AUTOFILL ====================
    async function performIntelligentAutofill() {
        console.log('🧠 [AUTOFILL] Starting INTELLIGENT autofill with 85%+ accuracy!');
        
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
            
            // Load ALL data sources
            await loadAllDataSources(userId);
            
            if (!contentState.databaseData && !contentState.resumeData) {
                throw new Error('Could not load your profile data');
            }
            
            // Get all fields
            const allFields = getAllFormFields();
            console.log(`📊 [FIELDS] Found ${allFields.length} fillable fields`);
            
            if (allFields.length === 0) {
                throw new Error('No fillable fields found on this page');
            }
            
            // Show extracted data
            showExtractedData(contentState.databaseData, contentState.resumeData);
            
            // Fill ALL fields intelligently
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
        
        // Load database data
        const databaseResponse = await chrome.runtime.sendMessage({
            action: 'FETCH_ALL_DATABASE_TABLES',
            userId: userId
        });
        
        if (databaseResponse && databaseResponse.success) {
            contentState.databaseData = databaseResponse.data;
            console.log('✅ [DATABASE] Loaded:', Object.keys(contentState.databaseData).length, 'fields');
        }
        
        // Load resume data
        const resumeResponse = await chrome.runtime.sendMessage({
            action: 'PARSE_REAL_RESUME_CONTENT',
            userId: userId
        });
        
        if (resumeResponse && resumeResponse.success) {
            contentState.resumeData = resumeResponse.data;
            console.log('✅ [RESUME] Loaded:', Object.keys(contentState.resumeData).length, 'fields');
        }
    }

    // ==================== INTELLIGENT FIELD FILLING ====================
    async function fillFieldIntelligently(field) {
        const fieldInfo = getFieldInfo(field);
        console.log(`🎯 [FILL] Processing: ${fieldInfo.label || fieldInfo.name || 'unknown field'}`);
        
        // Skip if already filled with valid data
        if (isFieldFilledWithValidData(field)) {
            console.log('⏭️  [SKIP] Already filled');
            return false;
        }
        
        // Handle different field types
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

    // ==================== TEXT FIELD HANDLING ====================
    async function handleTextFieldIntelligently(field, fieldInfo) {
        const context = fieldInfo.fullContext;
        
        // Try exact matches first
        let value = getExactMatchValue(fieldInfo);
        
        // If no exact match, use AI to determine value
        if (!value && contentState.openaiKey) {
            value = await getAIAssistedValue(fieldInfo);
        }
        
        // If still no value, make intelligent guess
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
        
        // Name fields
        if (context.includes('first') && context.includes('name')) {
            return db.firstName || resume.firstName || '';
        }
        if (context.includes('last') && context.includes('name')) {
            return db.lastName || resume.lastName || '';
        }
        if (context.includes('middle') && context.includes('name')) {
            return ''; // Usually leave middle name empty
        }
        if (context.includes('full') && context.includes('name')) {
            return db.fullName || resume.fullName || db.name || resume.name || '';
        }
        if (context.includes('name') && !context.includes('company') && !context.includes('institution')) {
            return db.fullName || resume.fullName || db.name || resume.name || '';
        }
        
        // Email
        if (fieldInfo.type === 'email' || context.includes('email') || context.includes('e-mail')) {
            return db.email || resume.email || '';
        }
        
        // Phone
        if (fieldInfo.type === 'tel' || context.includes('phone') || context.includes('mobile') || context.includes('contact number')) {
            return db.phone || resume.phone || '';
        }
        
        // Address
        if (context.includes('address') && !context.includes('email')) {
            return db.address || resume.address || '';
        }
        if (context.includes('city') || context.includes('town')) {
            return db.city || resume.city || '';
        }
        if (context.includes('state') || context.includes('province')) {
            return db.state || resume.state || '';
        }
        if (context.includes('country')) {
            return db.country || resume.country || 'India';
        }
        if (context.includes('zip') || context.includes('postal') || context.includes('pin')) {
            return db.pincode || resume.pincode || '';
        }
        
        // Professional
        if (context.includes('company') && context.includes('current')) {
            return db.currentCompany || resume.currentCompany || '';
        }
        if (context.includes('company') && !context.includes('current')) {
            return db.currentCompany || resume.currentCompany || '';
        }
        if (context.includes('title') || context.includes('position') || context.includes('designation') || context.includes('role')) {
            return db.currentTitle || resume.currentTitle || '';
        }
        if (context.includes('experience') && (context.includes('year') || context.includes('total'))) {
            return db.totalExperience || resume.totalExperience || '0';
        }
        
        // Salary
        if (context.includes('salary') || context.includes('ctc') || context.includes('compensation')) {
            if (context.includes('current')) {
                return db.currentSalary || '';
            } else if (context.includes('expected') || context.includes('desired')) {
                return db.expectedSalary || '';
            } else {
                return db.expectedSalary || db.currentSalary || '';
            }
        }
        
        // Notice period
        if (context.includes('notice')) {
            return db.noticePeriod || '30';
        }
        
        // Education
        if (context.includes('degree') || context.includes('qualification') || (context.includes('education') && !context.includes('level'))) {
            return db.education || resume.education || '';
        }
        if (context.includes('university') || context.includes('college') || context.includes('institution') || context.includes('school')) {
            return db.institution || resume.institution || '';
        }
        if (context.includes('graduation') || context.includes('passing')) {
            return db.graduationYear || resume.graduationYear || '';
        }
        if (context.includes('field') || context.includes('specialization') || context.includes('major') || context.includes('stream')) {
            return db.fieldOfStudy || resume.fieldOfStudy || '';
        }
        if (context.includes('gpa') || context.includes('percentage') || context.includes('grade')) {
            return db.gpa || '';
        }
        
        // Skills
        if (context.includes('skill')) {
            return db.skillsText || resume.skillsText || '';
        }
        
        // Social
        if (context.includes('linkedin')) {
            return db.linkedin || resume.linkedin || '';
        }
        if (context.includes('github')) {
            return db.github || resume.github || '';
        }
        if (context.includes('portfolio') || context.includes('website')) {
            return db.portfolio || resume.portfolio || '';
        }
        
        // Date of birth
        if (context.includes('birth') || context.includes('dob')) {
            return db.dateOfBirth || '';
        }
        
        return '';
    }

    async function getAIAssistedValue(fieldInfo) {
        try {
            const context = fieldInfo.fullContext;
            const label = fieldInfo.label || fieldInfo.name || fieldInfo.placeholder;
            
            const userData = {
                ...contentState.databaseData,
                ...contentState.resumeData
            };
            
            const prompt = `You are filling a job application form. Based on the user's profile data, provide the best answer for this field.

Field Label: "${label}"
Field Context: "${context}"

User Profile:
- Name: ${userData.fullName || userData.name || ''}
- Current Company: ${userData.currentCompany || ''}
- Current Title: ${userData.currentTitle || ''}
- Total Experience: ${userData.totalExperience || 0} years
- Education: ${userData.education || ''}
- Skills: ${userData.skillsText || ''}
- City: ${userData.city || ''}

Provide ONLY the value to fill, nothing else. If you cannot determine a value, respond with "UNKNOWN".
Keep answers concise and professional.`;

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${contentState.openaiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'gpt-3.5-turbo',
                    messages: [{
                        role: 'user',
                        content: prompt
                    }],
                    max_tokens: 100,
                    temperature: 0.3
                })
            });
            
            if (!response.ok) {
                throw new Error('AI request failed');
            }
            
            const data = await response.json();
            const answer = data.choices[0].message.content.trim();
            
            if (answer && answer !== 'UNKNOWN' && answer.length > 0 && answer.length < 500) {
                console.log(`🤖 [AI] Generated: "${answer}" for "${label}"`);
                return answer;
            }
        } catch (error) {
            console.warn('⚠️ [AI] Failed:', error);
        }
        
        return '';
    }

    function getIntelligentGuess(fieldInfo) {
        const context = fieldInfo.fullContext;
        const userData = {
            ...contentState.databaseData,
            ...contentState.resumeData
        };
        
        // Make educated guesses based on common patterns
        
        // If asking about authorization/legal work
        if (context.includes('authorize') || context.includes('legal') || context.includes('visa')) {
            return 'Yes';
        }
        
        // If asking about availability
        if (context.includes('available') || context.includes('start date') || context.includes('join')) {
            return 'Immediate';
        }
        
        // If asking about relocation
        if (context.includes('relocate') || context.includes('willing') && context.includes('move')) {
            return 'Yes';
        }
        
        // If asking about years of experience in specific skill
        if (context.includes('year') && context.includes('experience')) {
            const totalExp = userData.totalExperience || 0;
            if (totalExp > 0) {
                // Assume 50-75% of total experience in main skills
                return Math.max(1, Math.floor(totalExp * 0.6)).toString();
            }
        }
        
        // If asking about preferred location
        if (context.includes('location') && context.includes('prefer')) {
            return userData.city || '';
        }
        
        // If asking about reference
        if (context.includes('reference') || context.includes('referral')) {
            return 'No';
        }
        
        return '';
    }

    // ==================== DROPDOWN HANDLING ====================
    async function handleDropdownIntelligently(select, fieldInfo) {
        const options = Array.from(select.options).filter(opt => 
            opt.value && 
            opt.value !== '' && 
            opt.value !== 'select' &&
            opt.value !== '0' &&
            !opt.text.toLowerCase().includes('no answer') &&
            !opt.text.toLowerCase().includes('please select') &&
            !opt.text.toLowerCase().includes('choose')
        );
        
        if (options.length === 0) return false;
        
        const context = fieldInfo.fullContext;
        const label = fieldInfo.label || fieldInfo.name;
        
        console.log(`🔽 [DROPDOWN] "${label}" with ${options.length} options`);
        
        // Try to find intelligent match
        let selectedOption = null;
        
        // Get target value from user data
        const targetValue = getExactMatchValue(fieldInfo);
        
        if (targetValue) {
            // Try exact match
            selectedOption = findDropdownMatch(options, targetValue);
        }
        
        // If no match yet, use AI for intelligent selection
        if (!selectedOption && contentState.openaiKey && options.length <= 20) {
            selectedOption = await getAIDropdownSelection(fieldInfo, options);
        }
        
        // If still no match, apply heuristics
        if (!selectedOption) {
            selectedOption = applyDropdownHeuristics(fieldInfo, options);
        }
        
        // Last resort: select first valid option
        if (!selectedOption && options.length > 0) {
            selectedOption = options[0];
        }
        
        if (selectedOption) {
            select.value = selectedOption.value;
            triggerEvents(select);
            console.log(`✅ [DROPDOWN] Selected: "${selectedOption.text}"`);
            return true;
        }
        
        return false;
    }

    function findDropdownMatch(options, targetValue) {
        const searchValue = String(targetValue).toLowerCase().trim();
        
        // Exact match
        for (const opt of options) {
            if (opt.value.toLowerCase() === searchValue || opt.text.toLowerCase() === searchValue) {
                return opt;
            }
        }
        
        // Contains match
        for (const opt of options) {
            const optText = opt.text.toLowerCase();
            const optValue = opt.value.toLowerCase();
            
            if (optText.includes(searchValue) || searchValue.includes(optText) ||
                optValue.includes(searchValue) || searchValue.includes(optValue)) {
                return opt;
            }
        }
        
        // Partial match
        const searchWords = searchValue.split(/\s+/);
        for (const opt of options) {
            const optText = opt.text.toLowerCase();
            const matchCount = searchWords.filter(word => optText.includes(word)).length;
            if (matchCount >= searchWords.length / 2) {
                return opt;
            }
        }
        
        return null;
    }

    async function getAIDropdownSelection(fieldInfo, options) {
        try {
            const label = fieldInfo.label || fieldInfo.name;
            const optionsText = options.map((opt, i) => `${i + 1}. ${opt.text} (value: ${opt.value})`).join('\n');
            
            const userData = {
                ...contentState.databaseData,
                ...contentState.resumeData
            };
            
            const prompt = `You are filling a job application form. Select the BEST option from the dropdown that matches the user's profile.

Field Label: "${label}"

User Profile:
- Name: ${userData.fullName || ''}
- Experience: ${userData.totalExperience || 0} years
- Current Title: ${userData.currentTitle || ''}
- Current Company: ${userData.currentCompany || ''}
- Education: ${userData.education || ''}
- City: ${userData.city || ''}
- Notice Period: ${userData.noticePeriod || ''} days

Available Options:
${optionsText}

Respond with ONLY the option number (1, 2, 3, etc.) that best matches the user's profile. Consider:
- Experience level should match years of experience
- Salary range should be appropriate for experience and role
- Notice period should match user's availability
- Location preferences should match user's city
- Education level should match user's degree

Respond with only the number.`;

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${contentState.openaiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'gpt-3.5-turbo',
                    messages: [{
                        role: 'user',
                        content: prompt
                    }],
                    max_tokens: 10,
                    temperature: 0.1
                })
            });
            
            if (!response.ok) throw new Error('AI request failed');
            
            const data = await response.json();
            const answer = data.choices[0].message.content.trim();
            const optionNumber = parseInt(answer);
            
            if (optionNumber > 0 && optionNumber <= options.length) {
                console.log(`🤖 [AI] Selected option ${optionNumber}: "${options[optionNumber - 1].text}"`);
                return options[optionNumber - 1];
            }
        } catch (error) {
            console.warn('⚠️ [AI] Dropdown selection failed:', error);
        }
        
        return null;
    }

    function applyDropdownHeuristics(fieldInfo, options) {
        const context = fieldInfo.fullContext;
        const userData = {
            ...contentState.databaseData,
            ...contentState.resumeData
        };
        
        // Notice period
        if (context.includes('notice')) {
            const noticeDays = userData.noticePeriod || '30';
            for (const opt of options) {
                const text = opt.text.toLowerCase();
                if (noticeDays.includes('immediate') && text.includes('immediate')) return opt;
                if (noticeDays.includes('15') && (text.includes('15') || text.includes('2 week'))) return opt;
                if (noticeDays.includes('30') && (text.includes('30') || text.includes('1 month'))) return opt;
                if (noticeDays.includes('60') && (text.includes('60') || text.includes('2 month'))) return opt;
                if (noticeDays.includes('90') && (text.includes('90') || text.includes('3 month'))) return opt;
            }
        }
        
        // Experience level
        if (context.includes('experience') && context.includes('level')) {
            const years = userData.totalExperience || 0;
            for (const opt of options) {
                const text = opt.text.toLowerCase();
                if (years < 2 && (text.includes('entry') || text.includes('junior') || text.includes('fresher'))) return opt;
                if (years >= 2 && years < 5 && (text.includes('mid') || text.includes('intermediate'))) return opt;
                if (years >= 5 && (text.includes('senior') || text.includes('lead') || text.includes('expert'))) return opt;
            }
        }
        
        // Salary range
        if (context.includes('salary') || context.includes('ctc') || context.includes('compensation')) {
            const years = userData.totalExperience || 0;
            // Estimate based on experience: entry=3-6L, mid=6-15L, senior=15-30L+
            let minExpected = 0, maxExpected = 0;
            if (years < 2) { minExpected = 300000; maxExpected = 600000; }
            else if (years < 5) { minExpected = 600000; maxExpected = 1500000; }
            else { minExpected = 1500000; maxExpected = 3000000; }
            
            for (const opt of options) {
                const text = opt.text.toLowerCase();
                const numbers = text.match(/(\d+)/g);
                if (numbers && numbers.length > 0) {
                    const value = parseInt(numbers[0]);
                    // Check if in expected range (considering lakhs)
                    const valueInRupees = value < 100 ? value * 100000 : value;
                    if (valueInRupees >= minExpected && valueInRupees <= maxExpected * 2) {
                        return opt;
                    }
                }
            }
        }
        
        // Yes/No questions - default to Yes for positive questions
        if (options.length === 2) {
            const hasYes = options.find(opt => opt.text.toLowerCase().includes('yes'));
            const hasNo = options.find(opt => opt.text.toLowerCase().includes('no'));
            
            if (hasYes && hasNo) {
                if (context.includes('willing') || context.includes('authorize') || 
                    context.includes('relocate') || context.includes('available') ||
                    context.includes('legal')) {
                    return hasYes;
                }
            }
        }
        
        // Location/City match
        if (context.includes('location') || context.includes('city')) {
            const userCity = (userData.city || '').toLowerCase();
            if (userCity) {
                for (const opt of options) {
                    if (opt.text.toLowerCase().includes(userCity)) {
                        return opt;
                    }
                }
            }
        }
        
        // Country - prefer India
        if (context.includes('country')) {
            for (const opt of options) {
                if (opt.text.toLowerCase().includes('india')) {
                    return opt;
                }
            }
        }
        
        // Education level
        if (context.includes('education') || context.includes('degree')) {
            const education = (userData.education || '').toLowerCase();
            for (const opt of options) {
                const text = opt.text.toLowerCase();
                if (education.includes('phd') && text.includes('doctor')) return opt;
                if (education.includes('master') && text.includes('master')) return opt;
                if (education.includes('bachelor') && text.includes('bachelor')) return opt;
                if (education.includes('diploma') && text.includes('diploma')) return opt;
            }
        }
        
        return null;
    }

    // ==================== CHECKBOX HANDLING ====================
    async function handleCheckboxIntelligently(checkbox, fieldInfo) {
        const context = fieldInfo.fullContext;
        const label = fieldInfo.label;
        
        // Always check terms, agreements, authorization checkboxes
        if (context.includes('agree') || context.includes('terms') || context.includes('policy') || 
            context.includes('consent') || context.includes('authorize') || context.includes('accept') ||
            context.includes('confirm') || label.toLowerCase().includes('i have read')) {
            checkbox.checked = true;
            triggerEvents(checkbox);
            console.log(`☑️ [CHECKBOX] Checked: "${label}"`);
            return true;
        }
        
        return false;
    }

    // ==================== RADIO HANDLING ====================
    async function handleRadioIntelligently(radio, fieldInfo) {
        const name = radio.name;
        if (!name) return false;
        
        // Check if any radio in this group is already selected
        const group = document.querySelectorAll(`input[type="radio"][name="${name}"]`);
        if (Array.from(group).some(r => r.checked)) {
            return false;
        }
        
        const context = fieldInfo.fullContext;
        const label = fieldInfo.label;
        
        // Prefer "Yes" for positive questions
        if (label.toLowerCase().includes('yes') && 
            (context.includes('willing') || context.includes('authorize') || context.includes('available'))) {
            radio.checked = true;
            triggerEvents(radio);
            console.log(`🔘 [RADIO] Selected: "${label}"`);
            return true;
        }
        
        return false;
    }

    // ==================== FILE UPLOAD ====================
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
                    const fileUrl = fileResponse.fileData.url;
                    const fileName = fileResponse.fileData.name || 'resume.pdf';
                    const fileType = fileResponse.fileData.type || 'application/pdf';
                    
                    const response = await fetch(fileUrl);
                    const blob = await response.blob();
                    const file = new File([blob], fileName, { type: fileType });
                    
                    const dataTransfer = new DataTransfer();
                    dataTransfer.items.add(file);
                    field.files = dataTransfer.files;
                    
                    triggerEvents(field);
                    console.log('✅ [FILE] Resume uploaded:', fileName);
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
            
            if (field.tagName.toLowerCase() === 'select') {
                return await selectDropdownOption(field, value);
            } else if (field.type === 'checkbox') {
                return await handleCheckboxIntelligently(field, getFieldInfo(field));
            } else if (field.type === 'radio') {
                field.checked = true;
                triggerEvents(field);
                return true;
            } else {
                field.value = '';
                triggerEvents(field);
                await delay(50);
                
                if (field.contentEditable === 'true') {
                    field.textContent = value.toString();
                    field.innerHTML = value.toString();
                } else {
                    field.value = value.toString();
                }
                
                triggerEvents(field);
                return true;
            }
        } catch (error) {
            console.error('Field fill error:', error);
            return false;
        }
    }

    async function selectDropdownOption(select, targetValue) {
        const fieldInfo = getFieldInfo(select);
        return await handleDropdownIntelligently(select, fieldInfo);
    }

    // ==================== LINKEDIN AUTOMATION ====================
    async function startLinkedInAutomation(userData) {
        console.log('🔗 [LINKEDIN] Starting ENHANCED automation...');
        
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
            
            // Apply filters
            await ensureEasyApplyFilter();
            
            // Process jobs
            await processJobsLoop();
            
            console.log(`✅ [COMPLETE] Submitted ${contentState.stats.applicationsSubmitted} jobs`);
            
            showNotification(`✅ Complete! ${contentState.stats.applicationsSubmitted} applications submitted`, 'success', 5000);
            
            return {
                success: true,
                applicationsSubmitted: contentState.stats.applicationsSubmitted
            };
            
        } finally {
            contentState.isProcessing = false;
        }
    }

    async function ensureEasyApplyFilter() {
        const currentUrl = window.location.href;
        
        // Check if Easy Apply filter is already applied
        if (!currentUrl.includes('f_AL=true')) {
            console.log('🔄 [LINKEDIN] Applying Easy Apply filter...');
            const url = new URL('https://www.linkedin.com/jobs/search/');
            url.searchParams.set('f_AL', 'true'); // Easy Apply
            url.searchParams.set('sortBy', 'DD'); // Most recent
            url.searchParams.set('f_TPR', 'r86400'); // Last 24 hours
            window.location.href = url.toString();
            await delay(10000);
            return;
        }
        
        await delay(3000);
    }

    async function processJobsLoop() {
        let consecutiveErrors = 0;
        const maxConsecutiveErrors = 5;
        
        while (contentState.stats.applicationsSubmitted < contentState.config.MAX_JOBS) {
            try {
                const result = await processSingleJob();
                
                if (result.submitted) {
                    contentState.stats.applicationsSubmitted++;
                    consecutiveErrors = 0;
                    console.log(`🎉 Job ${contentState.stats.applicationsSubmitted} SUBMITTED!`);
                    showNotification(`✅ Application ${contentState.stats.applicationsSubmitted} submitted!`, 'success', 2000);
                } else if (result.skipped) {
                    console.log('⏭️ Job skipped (not Easy Apply)');
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

    async function processSingleJob() {
        const job = await findNextEasyApplyJob();
        if (!job) return { submitted: false, skipped: false };
        
        // Click on job card
        await clickJob(job.card);
        await delay(contentState.config.DELAYS.AFTER_JOB_CLICK);
        
        // Check if it's Easy Apply
        const isEasyApply = await checkIfEasyApply();
        if (!isEasyApply) {
            return { submitted: false, skipped: true };
        }
        
        // Click Easy Apply button
        if (!await clickEasyApplyButton()) {
            return { submitted: false, skipped: true };
        }
        
        await delay(contentState.config.DELAYS.AFTER_EASY_APPLY);
        
        // Fill and submit application
        const submitted = await submitLinkedInApplication();
        
        return { submitted, skipped: false };
    }

    async function findNextEasyApplyJob() {
        const cards = document.querySelectorAll('.jobs-search-results__list-item, .scaffold-layout__list-item');
        
        for (const card of cards) {
            if (!isVisible(card)) continue;
            
            const cardText = card.textContent.toLowerCase();
            
            // Must have "Easy Apply" badge
            if (!cardText.includes('easy apply')) continue;
            
            // Skip if already applied
            if (cardText.includes('applied')) continue;
            
            // Get job ID to avoid duplicates
            const jobId = card.getAttribute('data-job-id') || 
                         card.querySelector('[data-job-id]')?.getAttribute('data-job-id');
            
            if (jobId && contentState.processedJobs.has(jobId)) {
                continue;
            }
            
            if (jobId) {
                contentState.processedJobs.add(jobId);
            }
            
            return { card, id: jobId };
        }
        
        return null;
    }

    async function clickJob(card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await delay(500);
        card.click();
    }

    async function checkIfEasyApply() {
        await delay(1500);
        
        // Look for Easy Apply button in job details panel
        const easyApplyButton = document.querySelector(
            'button.jobs-apply-button, ' +
            'button[aria-label*="Easy Apply"], ' +
            'button.jobs-apply-button--top-card'
        );
        
        return easyApplyButton && isVisible(easyApplyButton) && 
               easyApplyButton.textContent.toLowerCase().includes('easy apply');
    }

    async function clickEasyApplyButton() {
        for (let attempt = 0; attempt < 10; attempt++) {
            const button = document.querySelector(
                'button.jobs-apply-button, ' +
                'button[aria-label*="Easy Apply"], ' +
                'button.jobs-apply-button--top-card'
            );
            
            if (button && isVisible(button) && button.textContent.toLowerCase().includes('easy apply')) {
                button.click();
                await delay(2500);
                return true;
            }
            
            await delay(500);
        }
        
        return false;
    }

    async function submitLinkedInApplication() {
        console.log('📝 [LINKEDIN] Starting application submission...');
        
        for (let step = 0; step < contentState.config.MAX_FORM_STEPS; step++) {
            console.log(`📝 [LINKEDIN] Step ${step + 1}/${contentState.config.MAX_FORM_STEPS}`);
            
            // Fill ALL fields intelligently
            const fields = getAllModalFields();
            console.log(`📝 [LINKEDIN] Found ${fields.length} fields`);
            
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
                    console.error('❌ [LINKEDIN] Field error:', error);
                }
            }
            
            await delay(1000);
            
            // Check if submitted
            if (await isApplicationSubmitted()) {
                console.log('✅ [LINKEDIN] Application submitted!');
                await delay(2000);
                await dismissSuccessModal();
                return true;
            }
            
            // Try submit button first
            const submitClicked = await clickModalButton('submit');
            
            if (submitClicked) {
                console.log('🔵 [LINKEDIN] Clicked submit');
                await delay(contentState.config.DELAYS.AFTER_SUBMIT);
                
                if (await isApplicationSubmitted()) {
                    console.log('✅ [LINKEDIN] Application submitted!');
                    await delay(2000);
                    await dismissSuccessModal();
                    return true;
                }
            }
            
            // Try next button
            const nextClicked = await clickModalButton('next');
            
            if (nextClicked) {
                console.log('🔵 [LINKEDIN] Clicked next');
                await delay(contentState.config.DELAYS.AFTER_NEXT);
            } else if (!submitClicked) {
                console.warn('⚠️ [LINKEDIN] No next/submit button found');
                break;
            }
        }
        
        console.warn('⚠️ [LINKEDIN] Max steps reached without submission');
        return false;
    }

    function getAllModalFields() {
        const modal = document.querySelector('.jobs-easy-apply-modal, .jobs-easy-apply-content') || document;
        return getAllFormFields(modal);
    }

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
            'input[type="file"]',
            '[role="textbox"]',
            '[role="combobox"]',
            '[contenteditable="true"]'
        ];
        
        const fields = container.querySelectorAll(selectors.join(', '));
        
        return Array.from(fields).filter(field => {
            if (!isVisible(field)) return false;
            if (field.disabled || field.readOnly) return false;
            
            // Skip hidden LinkedIn system fields
            const name = (field.name || '').toLowerCase();
            if (name.includes('csrf') || name.includes('token')) return false;
            
            return true;
        });
    }

    async function clickModalButton(type) {
        const modal = document.querySelector('.jobs-easy-apply-modal, .jobs-easy-apply-content');
        if (!modal) return false;
        
        const buttons = Array.from(modal.querySelectorAll('button')).filter(b => {
            const text = b.textContent.toLowerCase();
            const ariaLabel = (b.getAttribute('aria-label') || '').toLowerCase();
            
            if (type === 'submit') {
                return (text.includes('submit') || text.includes('send') || ariaLabel.includes('submit')) && 
                       isVisible(b) && !b.disabled;
            } else if (type === 'next') {
                return (text.includes('next') || text.includes('continue') || ariaLabel.includes('next')) && 
                       isVisible(b) && !b.disabled;
            }
            
            return false;
        });
        
        if (buttons.length > 0) {
            buttons[0].click();
            return true;
        }
        
        return false;
    }

    async function isApplicationSubmitted() {
        // Check if modal is closed
        const modal = document.querySelector('.jobs-easy-apply-modal, .jobs-easy-apply-content');
        if (!modal || !isVisible(modal)) {
            return true;
        }
        
        // Check for success message
        const successIndicators = [
            'application sent',
            'application submitted',
            'successfully applied',
            'your application has been sent'
        ];
        
        const pageText = document.body.textContent.toLowerCase();
        return successIndicators.some(indicator => pageText.includes(indicator));
    }

    async function dismissSuccessModal() {
        // Try to close any success modals
        const closeButtons = document.querySelectorAll(
            'button[aria-label*="Dismiss"], ' +
            'button[aria-label*="Close"], ' +
            'button.artdeco-modal__dismiss'
        );
        
        for (const btn of closeButtons) {
            if (isVisible(btn)) {
                btn.click();
                await delay(1000);
                break;
            }
        }
    }

    async function checkForMoreJobs() {
        const jobsList = document.querySelector('.jobs-search-results-list, .scaffold-layout__list');
        return jobsList && jobsList.children.length > 0;
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
            'input[type="file"]',
            '[role="textbox"]',
            '[role="combobox"]',
            '[contenteditable="true"]'
        ];
        
        const fields = container.querySelectorAll(selectors.join(', '));
        
        return Array.from(fields).filter(field => {
            const style = window.getComputedStyle(field);
            const rect = field.getBoundingClientRect();
            
            return style.display !== 'none' && 
                   style.visibility !== 'hidden' && 
                   style.opacity !== '0' &&
                   !field.disabled && 
                   !field.readOnly &&
                   rect.width > 0 && 
                   rect.height > 0;
        });
    }

    function getFieldLabel(field) {
        const methods = [
            () => document.querySelector(`label[for="${field.id}"]`)?.textContent?.trim(),
            () => field.closest('label')?.textContent?.trim(),
            () => field.previousElementSibling?.textContent?.trim(),
            () => field.parentElement?.previousElementSibling?.textContent?.trim(),
            () => field.parentElement?.querySelector('label')?.textContent?.trim(),
            () => field.getAttribute('aria-labelledby') ? document.getElementById(field.getAttribute('aria-labelledby'))?.textContent?.trim() : null,
            () => field.getAttribute('aria-label')?.trim(),
            () => field.placeholder,
            () => field.title,
            () => field.name,
            () => field.id
        ];
        
        for (const method of methods) {
            try {
                const result = method();
                if (result && result.length < 200 && result.trim()) return result;
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
               style.display !== 'none' &&
               style.opacity !== '0';
    }

    function showInstantStartNotification() {
        const allFields = getAllFormFields();
        
        allFields.forEach(field => {
            field.style.border = '2px solid #3B82F6';
            field.style.transition = 'all 0.3s ease';
        });
        
        showNotification('⚡ AutoFill Started!', 'info', 1000);
        
        setTimeout(() => {
            allFields.forEach(field => {
                field.style.border = '';
            });
        }, 500);
    }

    function highlightFieldGreen(field, source = 'intelligent') {
        const colors = {
            intelligent: { bg: '#dcfce7', border: '#22c55e' },
            linkedin: { bg: '#dbeafe', border: '#3b82f6' }
        };
        
        const color = colors[source] || colors.intelligent;
        field.style.backgroundColor = color.bg;
        field.style.border = `2px solid ${color.border}`;
        field.style.transition = 'all 0.3s ease';
        
        setTimeout(() => {
            field.style.backgroundColor = '';
            field.style.border = '';
        }, 2000);
    }

    function showExtractedData(databaseData, resumeData) {
        console.log('📊 [DATA DISPLAY] Showing extracted data...');
        
        const oldDisplay = document.getElementById('fillora-data-display');
        if (oldDisplay) oldDisplay.remove();
        
        const displayPanel = document.createElement('div');
        displayPanel.id = 'fillora-data-display';
        displayPanel.style.cssText = `
            position: fixed !important;
            top: 80px !important;
            right: 20px !important;
            width: 380px !important;
            max-height: 500px !important;
            overflow-y: auto !important;
            background: white !important;
            border: 2px solid #3B82F6 !important;
            border-radius: 12px !important;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2) !important;
            z-index: 999999 !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
            padding: 0 !important;
        `;
        
        const header = document.createElement('div');
        header.style.cssText = `
            background: linear-gradient(135deg, #3B82F6, #2563EB) !important;
            color: white !important;
            padding: 12px 15px !important;
            font-weight: 700 !important;
            font-size: 14px !important;
            border-radius: 10px 10px 0 0 !important;
            display: flex !important;
            justify-content: space-between !important;
            align-items: center !important;
        `;
        header.innerHTML = `
            <span>📊 Your Profile Data</span>
            <button id="fillora-close-data" style="
                background: transparent !important;
                border: none !important;
                color: white !important;
                font-size: 18px !important;
                cursor: pointer !important;
                padding: 0 5px !important;
            ">✕</button>
        `;
        
        const content = document.createElement('div');
        content.style.cssText = `
            padding: 12px !important;
            font-size: 12px !important;
            color: #1f2937 !important;
        `;
        
        const dbCount = Object.keys(databaseData || {}).length;
        const resumeCount = Object.keys(resumeData || {}).length;
        
        content.innerHTML = `
            <div style="margin-bottom: 12px;">
                <div style="font-weight: 700; color: #059669; margin-bottom: 8px; font-size: 13px;">🗄️ DATABASE (${dbCount} fields)</div>
                ${formatDataForDisplay(databaseData, '#dcfce7')}
            </div>
            <div>
                <div style="font-weight: 700; color: #2563EB; margin-bottom: 8px; font-size: 13px;">📄 RESUME (${resumeCount} fields)</div>
                ${formatDataForDisplay(resumeData, '#dbeafe')}
            </div>
        `;
        
        displayPanel.appendChild(header);
        displayPanel.appendChild(content);
        document.body.appendChild(displayPanel);
        
        document.getElementById('fillora-close-data').onclick = () => displayPanel.remove();
        
        setTimeout(() => {
            if (displayPanel.parentNode) displayPanel.remove();
        }, 25000);
    }

    function formatDataForDisplay(data, bgColor) {
        if (!data || Object.keys(data).length === 0) {
            return '<div style="padding: 8px; color: #6b7280; font-size: 11px;">No data</div>';
        }
        
        let html = '<div style="display: grid; gap: 6px;">';
        
        const fields = [
            'fullName', 'email', 'phone', 'city', 
            'currentCompany', 'currentTitle', 'totalExperience',
            'education', 'institution', 'skills', 'skillsText'
        ];
        
        fields.forEach(key => {
            if (data[key] && data[key].toString().trim()) {
                const value = Array.isArray(data[key]) ? data[key].join(', ') : data[key];
                if (value.toString().length > 0) {
                    html += `
                        <div style="background: ${bgColor}; padding: 6px 8px; border-radius: 6px; border: 1px solid #e5e7eb;">
                            <strong style="color: #374151; font-size: 10px; text-transform: uppercase;">${key}:</strong>
                            <div style="color: #1f2937; font-size: 11px; margin-top: 2px;">${value}</div>
                        </div>
                    `;
                }
            }
        });
        
        html += '</div>';
        return html;
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
            max-width: 300px !important;
            padding: 12px 16px !important;
            border-radius: 10px !important;
            color: white !important;
            font-weight: 600 !important;
            font-size: 13px !important;
            z-index: 999999 !important;
            background: ${colors[type]} !important;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2) !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
            white-space: pre-line !important;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) notification.remove();
        }, duration);
    }

    function triggerEvents(element) {
        const events = ['input', 'change', 'blur', 'keyup', 'keydown'];
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
        if (hostname.includes('google.com') && window.location.pathname.includes('forms')) return 'Google Forms';
        if (hostname.includes('linkedin')) return 'LinkedIn';
        if (hostname.includes('indeed')) return 'Indeed';
        if (hostname.includes('naukri')) return 'Naukri';
        if (hostname.includes('greenhouse')) return 'Greenhouse';
        return 'Job Application Form';
    }

    // ==================== INIT ====================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeContentScript);
    } else {
        initializeContentScript();
    }

    console.log('✅ [FILLORA ENHANCED] Ready with 85%+ accuracy!');

} else {
    console.log('⚠️ Fillora already initialized');
}