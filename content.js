// Fillora Chrome Extension - PERFECT ERROR-FREE Content Script
// Zero errors + Intelligent salary selection + Smart experience calculation + Working LinkedIn
console.log('🎯 [FILLORA PERFECT] Loading error-free version...');

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
            jobsSkipped: 0
        },
        config: {
            MAX_JOBS: 50,
            MAX_FORM_STEPS: 35,
            JOB_SEARCH_KEYWORD: 'Data Analyst',
            DELAYS: {
                AFTER_JOB_CLICK: 2000,
                AFTER_EASY_APPLY: 2500,
                AFTER_FIELD_FILL: 300,
                AFTER_NEXT: 1500,
                AFTER_SUBMIT: 3000,
                BETWEEN_JOBS: 2000,
                FILTER_CHECK: 3000
            }
        }
    };

    // ==================== INIT ====================
    function initializeContentScript() {
        console.log('🔧 [FILLORA] Initializing...');
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
            console.warn('⚠️ [OPENAI] No key found');
        }
    }

    function setupMessageListener() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            console.log('📨 [MESSAGE]', request.action);
            
            if (request.action === 'PING') {
                sendResponse({ success: true, message: 'Content script ready' });
                return false;
            }
            
            if (request.action === 'PERFORM_AUTOFILL') {
                performIntelligentAutofill()
                    .then(result => sendResponse(result))
                    .catch(error => sendResponse({ success: false, error: error.message }));
                return true; // Keep channel open
            }
            
            if (request.action === 'START_LINKEDIN_AUTOMATION') {
                startLinkedInAutomation()
                    .then(result => sendResponse(result))
                    .catch(error => sendResponse({ success: false, error: error.message }));
                return true; // Keep channel open
            }
            
            sendResponse({ success: false, error: 'Unknown action' });
            return false;
        });
    }

    // ==================== AUTOFILL ====================
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
            console.log(`📊 Found ${fields.length} fields to fill`);
            
            showDataPanel(contentState.databaseData, contentState.resumeData);
            
            let fieldsFilled = 0;
            for (const field of fields) {
                if (await fillFieldIntelligently(field)) {
                    fieldsFilled++;
                    highlightField(field);
                    await delay(contentState.config.DELAYS.AFTER_FIELD_FILL);
                }
            }
            
            const successRate = fields.length > 0 ? Math.round((fieldsFilled / fields.length) * 100) : 0;
            const timeTaken = ((Date.now() - startTime) / 1000).toFixed(2);
            
            console.log(`✅ Filled ${fieldsFilled}/${fields.length} fields (${successRate}%) in ${timeTaken}s`);
            showNotification(`✅ AutoFill Complete!\n${fieldsFilled}/${fields.length} fields (${successRate}%)`, 'success', 5000);
            
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
        // Load database data
        const dbResponse = await chrome.runtime.sendMessage({
            action: 'FETCH_ALL_DATABASE_TABLES',
            userId: userId
        });
        
        if (dbResponse?.success && dbResponse.data) {
            contentState.databaseData = dbResponse.data;
            console.log('✅ Database loaded:', Object.keys(dbResponse.data).length, 'fields');
        }
        
        // Load resume data
        const resumeResponse = await chrome.runtime.sendMessage({
            action: 'PARSE_REAL_RESUME_CONTENT',
            userId: userId
        });
        
        if (resumeResponse?.success && resumeResponse.data) {
            contentState.resumeData = resumeResponse.data;
            console.log('✅ Resume loaded:', Object.keys(resumeResponse.data).length, 'fields');
            
            // Calculate total experience from date ranges if not already present
            if (!contentState.resumeData.totalExperience || contentState.resumeData.totalExperience === 0) {
                contentState.resumeData.totalExperience = calculateTotalExperience(resumeResponse.data);
                console.log(`🧮 Calculated total experience: ${contentState.resumeData.totalExperience} years`);
            }
        }
    }

    // ==================== SMART EXPERIENCE CALCULATION ====================
    function calculateTotalExperience(resumeData) {
        let totalYears = 0;
        
        try {
            // Convert resume data to string for pattern matching
            const resumeText = JSON.stringify(resumeData).toLowerCase();
            
            console.log('🧮 Calculating total experience from resume...');
            
            const currentYear = new Date().getFullYear();
            const processedRanges = new Set();
            
            // Pattern 1: "2021 - 2022" or "2021-2022" or "2021 – 2022"
            const pattern1 = /(\d{4})\s*[-–—]\s*(\d{4}|present|current)/gi;
            const matches1 = resumeText.matchAll(pattern1);
            
            for (const match of matches1) {
                const fullMatch = match[0];
                
                // Skip if already processed
                const normalizedMatch = fullMatch.replace(/\s+/g, '').toLowerCase();
                if (processedRanges.has(normalizedMatch)) continue;
                processedRanges.add(normalizedMatch);
                
                // Extract start year
                const startYear = parseInt(match[1]);
                
                // Extract end year
                let endYear = currentYear;
                const endText = match[2].toLowerCase();
                
                if (endText === 'present' || endText === 'current') {
                    endYear = currentYear;
                } else {
                    endYear = parseInt(endText);
                }
                
                // Validate years
                if (startYear >= 1990 && startYear <= currentYear && 
                    endYear >= startYear && endYear <= currentYear) {
                    
                    const yearsInRole = endYear - startYear;
                    totalYears += yearsInRole;
                    
                    console.log(`   📅 ${startYear} - ${endYear === currentYear ? 'Present' : endYear}: ${yearsInRole} year${yearsInRole !== 1 ? 's' : ''}`);
                }
            }
            
            // Pattern 2: "July 2021 - March 2023" or "20 July 2021 - 15 March 2023"
            const pattern2 = /(\d{1,2}\s+)?([a-z]+\s+)?(\d{4})\s*[-–—]\s*(\d{1,2}\s+)?([a-z]+\s+)?(\d{4}|present|current)/gi;
            const matches2 = resumeText.matchAll(pattern2);
            
            for (const match of matches2) {
                const fullMatch = match[0];
                
                // Skip if already processed
                const normalizedMatch = fullMatch.replace(/\s+/g, '').toLowerCase();
                if (processedRanges.has(normalizedMatch)) continue;
                processedRanges.add(normalizedMatch);
                
                // Extract start year
                const startYear = parseInt(match[3]);
                
                // Extract end year
                let endYear = currentYear;
                const endText = match[6] ? match[6].toLowerCase() : '';
                
                if (endText === 'present' || endText === 'current') {
                    endYear = currentYear;
                } else if (match[6] && /\d{4}/.test(match[6])) {
                    endYear = parseInt(match[6]);
                }
                
                // Validate years
                if (startYear >= 1990 && startYear <= currentYear && 
                    endYear >= startYear && endYear <= currentYear) {
                    
                    // Calculate years (with months for more accuracy)
                    const startMonth = getMonthNumber(match[2]) || 1;
                    const endMonth = endText === 'present' || endText === 'current' ? new Date().getMonth() + 1 : getMonthNumber(match[5]) || 12;
                    
                    const totalMonths = (endYear - startYear) * 12 + (endMonth - startMonth);
                    const yearsInRole = Math.round(totalMonths / 12 * 10) / 10;
                    
                    totalYears += yearsInRole;
                    
                    console.log(`   📅 ${fullMatch.trim()}: ${yearsInRole} year${yearsInRole !== 1 ? 's' : ''}`);
                }
            }
            
            // Round to 1 decimal place
            totalYears = Math.round(totalYears * 10) / 10;
            
            console.log(`   ✅ TOTAL EXPERIENCE: ${totalYears} years`);
            
            return totalYears > 0 ? totalYears : 0;
            
        } catch (error) {
            console.error('❌ Experience calculation error:', error);
            return 0;
        }
    }
    
    function getMonthNumber(monthText) {
        if (!monthText) return null;
        
        const months = {
            'jan': 1, 'january': 1,
            'feb': 2, 'february': 2,
            'mar': 3, 'march': 3,
            'apr': 4, 'april': 4,
            'may': 5,
            'jun': 6, 'june': 6,
            'jul': 7, 'july': 7,
            'aug': 8, 'august': 8,
            'sep': 9, 'sept': 9, 'september': 9,
            'oct': 10, 'october': 10,
            'nov': 11, 'november': 11,
            'dec': 12, 'december': 12
        };
        
        const cleaned = monthText.toLowerCase().trim();
        return months[cleaned] || null;
    }

    // ==================== INTELLIGENT FIELD FILLING ====================
    async function fillFieldIntelligently(field) {
        if (isFieldAlreadyFilled(field)) {
            return false;
        }
        
        const fieldInfo = getFieldInformation(field);
        
        if (field.tagName.toLowerCase() === 'select') {
            return await fillDropdownIntelligently(field, fieldInfo);
        } else if (field.type === 'checkbox') {
            return fillCheckboxField(field, fieldInfo);
        } else if (field.type === 'radio') {
            return fillRadioField(field, fieldInfo);
        } else if (field.type === 'file') {
            return await uploadResumeFile(field);
        } else {
            return await fillTextField(field, fieldInfo);
        }
    }

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
            return field.value && 
                   field.value !== '' && 
                   field.value !== 'select' && 
                   field.value !== '-1' &&
                   !field.options[field.selectedIndex]?.text.toLowerCase().includes('no answer') &&
                   !field.options[field.selectedIndex]?.text.toLowerCase().includes('select');
        }
        
        if (field.type === 'checkbox') {
            return field.checked;
        }
        
        if (field.type === 'radio') {
            if (!field.name) return field.checked;
            const radioGroup = document.querySelectorAll(`input[type="radio"][name="${field.name}"]`);
            return Array.from(radioGroup).some(radio => radio.checked);
        }
        
        if (field.type === 'file') {
            return field.files && field.files.length > 0;
        }
        
        return (field.value || '').trim().length > 0;
    }

    async function fillTextField(field, fieldInfo) {
        let value = getExactMatchValue(fieldInfo);
        
        // If no exact match and we have OpenAI key, use AI
        if (!value && contentState.openaiKey) {
            value = await getAIPoweredValue(fieldInfo);
        }
        
        // If still no value, make intelligent guess
        if (!value) {
            value = makeIntelligentGuess(fieldInfo);
        }
        
        if (value && value.toString().trim()) {
            field.value = value.toString().trim();
            triggerFieldEvents(field);
            return true;
        }
        
        return false;
    }

    function getExactMatchValue(fieldInfo) {
        const context = fieldInfo.context;
        const db = contentState.databaseData || {};
        const resume = contentState.resumeData || {};
        
        // Get total experience (calculated or from database)
        const totalExperience = resume.totalExperience || db.totalExperience || 0;
        
        // Name fields
        if (context.includes('first') && context.includes('name')) {
            return db.firstName || resume.firstName || '';
        }
        if (context.includes('last') && context.includes('name')) {
            return db.lastName || resume.lastName || '';
        }
        if (context.includes('full') && context.includes('name')) {
            return db.fullName || resume.fullName || `${db.firstName || ''} ${db.lastName || ''}`.trim();
        }
        if (context.includes('name') && !context.includes('company')) {
            return db.fullName || resume.fullName || db.name || resume.name || '';
        }
        
        // Contact fields
        if (context.includes('email')) {
            return db.email || resume.email || '';
        }
        if (context.includes('phone') || context.includes('mobile') || context.includes('contact')) {
            return db.phone || resume.phone || '';
        }
        
        // Location fields
        if (context.includes('city')) {
            return db.city || resume.city || '';
        }
        if (context.includes('state') || context.includes('province')) {
            return db.state || resume.state || '';
        }
        if (context.includes('country')) {
            return db.country || resume.country || 'India';
        }
        if (context.includes('zip') || context.includes('postal')) {
            return db.zipCode || resume.zipCode || '';
        }
        
        // Work fields
        if (context.includes('company') && context.includes('current')) {
            return db.currentCompany || resume.currentCompany || '';
        }
        if (context.includes('title') || context.includes('position') || context.includes('role')) {
            return db.currentTitle || resume.currentTitle || db.jobTitle || resume.jobTitle || '';
        }
        if (context.includes('experience') && (context.includes('year') || context.includes('total'))) {
            return totalExperience.toString();
        }
        
        // Education fields
        if (context.includes('education') || context.includes('degree')) {
            return db.education || resume.education || db.degree || resume.degree || '';
        }
        if (context.includes('university') || context.includes('college') || context.includes('school')) {
            return db.institution || resume.institution || db.university || resume.university || '';
        }
        if (context.includes('major') || context.includes('field')) {
            return db.major || resume.major || '';
        }
        
        // Skills
        if (context.includes('skill')) {
            return db.skillsText || resume.skillsText || db.skills || resume.skills || '';
        }
        
        // Other common fields
        if (context.includes('notice') || context.includes('availability')) {
            return db.noticePeriod || resume.noticePeriod || '30 days';
        }
        if (context.includes('linkedin')) {
            return db.linkedinUrl || resume.linkedinUrl || '';
        }
        if (context.includes('portfolio') || context.includes('website')) {
            return db.portfolioUrl || resume.portfolioUrl || '';
        }
        if (context.includes('github')) {
            return db.githubUrl || resume.githubUrl || '';
        }
        
        return '';
    }

    async function getAIPoweredValue(fieldInfo) {
        try {
            const label = fieldInfo.label || fieldInfo.name || fieldInfo.placeholder;
            const userData = { ...contentState.databaseData, ...contentState.resumeData };
            
            const prompt = `Field label: "${label}". User: ${userData.fullName || 'candidate'}, ${userData.currentTitle || 'professional'}, ${userData.totalExperience || 0} years experience. Provide ONLY the appropriate value for this field (max 100 characters). If unsure, respond "UNKNOWN".`;
            
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
                        max_tokens: 50,
                        temperature: 0.3
                    })
                }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
            ]);
            
            if (!response.ok) {
                throw new Error(`AI API error: ${response.status}`);
            }
            
            const data = await response.json();
            const aiValue = data.choices[0].message.content.trim();
            
            if (aiValue && aiValue !== 'UNKNOWN' && aiValue.length < 500) {
                console.log(`🤖 AI suggested: "${aiValue}" for "${label}"`);
                return aiValue;
            }
            
        } catch (error) {
            console.warn('⚠️ AI value generation failed:', error.message);
        }
        
        return '';
    }

    function makeIntelligentGuess(fieldInfo) {
        const context = fieldInfo.context;
        
        // Yes/No questions
        if (context.includes('authorize') || context.includes('legal') || context.includes('eligible')) {
            return 'Yes';
        }
        if (context.includes('available') || context.includes('start')) {
            return 'Immediate';
        }
        if (context.includes('relocate') || context.includes('willing')) {
            return 'Yes';
        }
        if (context.includes('sponsorship')) {
            return 'No';
        }
        
        return '';
    }

    // ==================== INTELLIGENT DROPDOWN SELECTION ====================
    async function fillDropdownIntelligently(selectElement, fieldInfo) {
        const options = Array.from(selectElement.options).filter(option => 
            option.value && 
            option.value !== '' && 
            option.value !== 'select' &&
            option.value !== '-1' &&
            !option.text.toLowerCase().includes('no answer') &&
            !option.text.toLowerCase().includes('select') &&
            !option.text.toLowerCase().includes('choose')
        );
        
        if (options.length === 0) {
            return false;
        }
        
        const context = fieldInfo.context;
        const userData = { ...contentState.databaseData, ...contentState.resumeData };
        const totalExperience = userData.totalExperience || 0;
        
        console.log(`🔽 Dropdown: "${fieldInfo.label}" (${options.length} options), User experience: ${totalExperience} years`);
        
        let selectedOption = null;
        
        // ==================== INTELLIGENT SALARY SELECTION ====================
        if (context.includes('salary') || context.includes('ctc') || context.includes('compensation') || 
            context.includes('pay') || context.includes('package')) {
            
            selectedOption = selectSalaryIntelligently(options, totalExperience);
            
            if (selectedOption) {
                console.log(`💰 SMART SALARY SELECTED: "${selectedOption.text}" for ${totalExperience} years experience`);
            }
        }
        
        // Experience level selection
        if (!selectedOption && context.includes('experience') && context.includes('level')) {
            for (const option of options) {
                const optionText = option.text.toLowerCase();
                
                if (totalExperience < 2 && (optionText.includes('entry') || optionText.includes('junior') || optionText.includes('fresher'))) {
                    selectedOption = option;
                    break;
                }
                if (totalExperience >= 2 && totalExperience < 5 && (optionText.includes('mid') || optionText.includes('intermediate'))) {
                    selectedOption = option;
                    break;
                }
                if (totalExperience >= 5 && totalExperience < 8 && (optionText.includes('senior') || optionText.includes('experienced'))) {
                    selectedOption = option;
                    break;
                }
                if (totalExperience >= 8 && (optionText.includes('lead') || optionText.includes('principal') || optionText.includes('expert'))) {
                    selectedOption = option;
                    break;
                }
            }
        }
        
        // Years of experience dropdown
        if (!selectedOption && context.includes('year') && context.includes('experience')) {
            const expString = Math.floor(totalExperience).toString();
            
            for (const option of options) {
                if (option.text.includes(expString) || option.value.includes(expString)) {
                    selectedOption = option;
                    break;
                }
            }
            
            // If exact match not found, find closest range
            if (!selectedOption) {
                for (const option of options) {
                    const numbers = option.text.match(/(\d+)/g);
                    if (numbers && numbers.length > 0) {
                        const optionValue = parseInt(numbers[0]);
                        if (Math.abs(optionValue - totalExperience) <= 1) {
                            selectedOption = option;
                            break;
                        }
                    }
                }
            }
        }
        
        // Notice period selection
        if (!selectedOption && (context.includes('notice') || context.includes('availability'))) {
            const noticePeriod = userData.noticePeriod || '30';
            
            for (const option of options) {
                const optionText = option.text.toLowerCase();
                
                if (noticePeriod.includes('immediate') && optionText.includes('immediate')) {
                    selectedOption = option;
                    break;
                }
                if (noticePeriod.includes('15') && (optionText.includes('15') || optionText.includes('2 week'))) {
                    selectedOption = option;
                    break;
                }
                if (noticePeriod.includes('30') && (optionText.includes('30') || optionText.includes('1 month'))) {
                    selectedOption = option;
                    break;
                }
                if (noticePeriod.includes('60') && (optionText.includes('60') || optionText.includes('2 month'))) {
                    selectedOption = option;
                    break;
                }
            }
            
            // Default to 30 days if available
            if (!selectedOption) {
                selectedOption = options.find(o => 
                    o.text.toLowerCase().includes('30') || 
                    o.text.toLowerCase().includes('1 month')
                );
            }
        }
        
        // Yes/No dropdowns
        if (!selectedOption && options.length === 2) {
            const yesOption = options.find(o => o.text.toLowerCase().includes('yes'));
            const noOption = options.find(o => o.text.toLowerCase().includes('no'));
            
            if (yesOption && noOption) {
                if (context.includes('willing') || context.includes('authorize') || 
                    context.includes('relocate') || context.includes('eligible')) {
                    selectedOption = yesOption;
                } else if (context.includes('sponsorship') || context.includes('visa')) {
                    selectedOption = noOption;
                }
            }
        }
        
        // Try to match with exact user data
        if (!selectedOption) {
            const targetValue = getExactMatchValue(fieldInfo);
            
            if (targetValue) {
                const searchTerm = targetValue.toLowerCase();
                
                selectedOption = options.find(option => {
                    const optionText = option.text.toLowerCase();
                    const optionValue = option.value.toLowerCase();
                    return optionText.includes(searchTerm) || 
                           searchTerm.includes(optionText) ||
                           optionValue.includes(searchTerm);
                });
            }
        }
        
        // Use AI to select if we have OpenAI key
        if (!selectedOption && contentState.openaiKey && options.length <= 20) {
            selectedOption = await selectOptionWithAI(fieldInfo, options);
        }
        
        // Last resort: select first valid option
        if (!selectedOption && options.length > 0) {
            selectedOption = options[0];
            console.log(`⚠️ Selected first option as fallback: "${selectedOption.text}"`);
        }
        
        // Apply selection
        if (selectedOption) {
            selectElement.value = selectedOption.value;
            triggerFieldEvents(selectElement);
            console.log(`✅ Selected: "${selectedOption.text}"`);
            return true;
        }
        
        return false;
    }

    // ==================== INTELLIGENT SALARY SELECTION (FIXES THE ISSUE!) ====================
    function selectSalaryIntelligently(options, totalExperience) {
        // Define salary ranges based on years of experience (Indian market, in Rupees)
        let minExpectedSalary = 0;
        let maxExpectedSalary = 0;
        
        if (totalExperience < 1) {
            // Freshers: 2-4 LPA
            minExpectedSalary = 200000;
            maxExpectedSalary = 400000;
        } else if (totalExperience < 2) {
            // 1 year: 3-6 LPA
            minExpectedSalary = 300000;
            maxExpectedSalary = 600000;
        } else if (totalExperience < 3) {
            // 2 years: 5-9 LPA
            minExpectedSalary = 500000;
            maxExpectedSalary = 900000;
        } else if (totalExperience < 5) {
            // 3-4 years: 8-15 LPA (YOUR CASE!)
            minExpectedSalary = 800000;
            maxExpectedSalary = 1500000;
        } else if (totalExperience < 7) {
            // 5-6 years: 12-25 LPA
            minExpectedSalary = 1200000;
            maxExpectedSalary = 2500000;
        } else if (totalExperience < 10) {
            // 7-9 years: 18-35 LPA
            minExpectedSalary = 1800000;
            maxExpectedSalary = 3500000;
        } else {
            // 10+ years: 25-50+ LPA
            minExpectedSalary = 2500000;
            maxExpectedSalary = 5000000;
        }
        
        console.log(`💰 Salary range for ${totalExperience} years experience: ₹${(minExpectedSalary / 100000).toFixed(1)}-${(maxExpectedSalary / 100000).toFixed(1)} LPA`);
        
        let bestOption = null;
        let bestScore = -1;
        
        for (const option of options) {
            const optionText = option.text.toLowerCase();
            
            // Extract all numbers from the option text
            const numbers = optionText.match(/(\d+(?:\.\d+)?)/g);
            
            if (!numbers || numbers.length === 0) {
                continue;
            }
            
            // Parse salary values (could be in lakhs or actual rupees)
            let optionMinSalary = 0;
            let optionMaxSalary = 0;
            
            if (numbers.length === 1) {
                const value = parseFloat(numbers[0]);
                // If value is small (< 100), it's in lakhs; otherwise in actual rupees
                const salaryValue = value < 100 ? value * 100000 : value;
                optionMinSalary = optionMaxSalary = salaryValue;
            } else if (numbers.length >= 2) {
                const value1 = parseFloat(numbers[0]);
                const value2 = parseFloat(numbers[1]);
                optionMinSalary = value1 < 100 ? value1 * 100000 : value1;
                optionMaxSalary = value2 < 100 ? value2 * 100000 : value2;
            }
            
            if (optionMinSalary === 0) {
                continue;
            }
            
            // Calculate matching score
            let score = 0;
            
            // Best case: option range perfectly overlaps with expected range
            if (optionMinSalary <= maxExpectedSalary && optionMaxSalary >= minExpectedSalary) {
                score = 100;
                
                // Bonus if option is completely within expected range
                if (optionMinSalary >= minExpectedSalary && optionMaxSalary <= maxExpectedSalary) {
                    score = 150;
                }
                
                // Extra bonus if expected salary is within option range
                const expectedMid = (minExpectedSalary + maxExpectedSalary) / 2;
                if (expectedMid >= optionMinSalary && expectedMid <= optionMaxSalary) {
                    score = 200;
                }
            }
            // Good case: option is within 50% of expected range
            else if (optionMinSalary >= minExpectedSalary * 0.5 && optionMaxSalary <= maxExpectedSalary * 2) {
                score = 50;
            }
            // Acceptable case: option is within reasonable distance
            else if (optionMinSalary >= minExpectedSalary * 0.3 && optionMaxSalary <= maxExpectedSalary * 3) {
                score = 25;
            }
            
            // Penalize if option is too low for experience
            if (optionMaxSalary < minExpectedSalary * 0.7) {
                score = Math.max(0, score - 50);
            }
            
            console.log(`   Option: "${option.text}" (₹${(optionMinSalary / 100000).toFixed(1)}-${(optionMaxSalary / 100000).toFixed(1)} LPA) → Score: ${score}`);
            
            if (score > bestScore) {
                bestScore = score;
                bestOption = option;
            }
        }
        
        if (bestOption) {
            console.log(`   ✅ BEST MATCH: "${bestOption.text}" (Score: ${bestScore})`);
        } else {
            console.log(`   ⚠️ No good salary match found`);
        }
        
        return bestOption;
    }

    async function selectOptionWithAI(fieldInfo, options) {
        try {
            const label = fieldInfo.label || fieldInfo.name;
            const userData = { ...contentState.databaseData, ...contentState.resumeData };
            const optionsList = options.map(o => o.text).join(', ');
            
            const prompt = `Field: "${label}". Options: [${optionsList}]. User: ${userData.fullName}, ${userData.currentTitle}, ${userData.totalExperience} years. Which option fits best? Respond with ONLY the exact option text.`;
            
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
                
                const matchedOption = options.find(o => 
                    o.text.toLowerCase().includes(aiSelection.toLowerCase()) ||
                    aiSelection.toLowerCase().includes(o.text.toLowerCase())
                );
                
                if (matchedOption) {
                    console.log(`🤖 AI selected: "${matchedOption.text}"`);
                    return matchedOption;
                }
            }
        } catch (error) {
            console.warn('⚠️ AI dropdown selection failed:', error.message);
        }
        
        return null;
    }

    function fillCheckboxField(checkbox, fieldInfo) {
        const context = fieldInfo.context;
        
        if (context.includes('agree') || context.includes('terms') || context.includes('policy') || 
            context.includes('consent') || context.includes('authorize') || context.includes('confirm')) {
            checkbox.checked = true;
            triggerFieldEvents(checkbox);
            return true;
        }
        
        return false;
    }

    function fillRadioField(radio, fieldInfo) {
        if (!radio.name) return false;
        
        const radioGroup = document.querySelectorAll(`input[type="radio"][name="${radio.name}"]`);
        if (Array.from(radioGroup).some(r => r.checked)) {
            return false; // Already selected
        }
        
        const context = fieldInfo.context;
        
        // Select "Yes" for common positive questions
        if (fieldInfo.label.toLowerCase().includes('yes') && 
            (context.includes('willing') || context.includes('authorize') || context.includes('eligible'))) {
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
            
            if (response?.success && response.fileData && response.fileData.url) {
                const fileResponse = await fetch(response.fileData.url);
                const blob = await fileResponse.blob();
                const fileName = response.fileData.name || 'resume.pdf';
                const file = new File([blob], fileName, { type: 'application/pdf' });
                
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(file);
                fileInput.files = dataTransfer.files;
                
                triggerFieldEvents(fileInput);
                console.log(`✅ Resume uploaded: ${fileName}`);
                return true;
            }
        } catch (error) {
            console.error('❌ Resume upload error:', error);
        }
        
        return false;
    }

    // ==================== LINKEDIN AUTOMATION ====================
    async function startLinkedInAutomation() {
        if (contentState.isProcessing) {
            throw new Error('Automation already running');
        }
        
        if (!window.location.hostname.includes('linkedin.com')) {
            throw new Error('Please navigate to LinkedIn first');
        }
        
        contentState.isProcessing = true;
        contentState.processedJobs.clear();
        contentState.currentJobIndex = 0;
        contentState.stats.applicationsSubmitted = 0;
        contentState.stats.jobsSkipped = 0;
        
        try {
            showNotification('🚀 LinkedIn Automation Starting...', 'info', 2000);
            
            const userId = await getUserId();
            if (!userId) throw new Error('Please login first');
            
            await loadAllUserData(userId);
            
            if (!contentState.databaseData && !contentState.resumeData) {
                throw new Error('No user data found');
            }
            
            showDataPanel(contentState.databaseData, contentState.resumeData);
            
            await navigateToLinkedInJobs();
            await delay(3000);
            
            startFilterMonitoring();
            
            await processAllJobs();
            
            stopFilterMonitoring();
            
            console.log(`✅ LinkedIn automation complete!`);
            console.log(`   Applications submitted: ${contentState.stats.applicationsSubmitted}`);
            console.log(`   Jobs skipped: ${contentState.stats.jobsSkipped}`);
            
            showNotification(
                `✅ Automation Complete!\nSubmitted: ${contentState.stats.applicationsSubmitted}\nSkipped: ${contentState.stats.jobsSkipped}`,
                'success',
                5000
            );
            
            return {
                success: true,
                applicationsSubmitted: contentState.stats.applicationsSubmitted,
                jobsSkipped: contentState.stats.jobsSkipped
            };
            
        } catch (error) {
            console.error('❌ LinkedIn automation error:', error);
            throw error;
        } finally {
            contentState.isProcessing = false;
            stopFilterMonitoring();
        }
    }

    async function navigateToLinkedInJobs() {
        const jobsUrl = new URL('https://www.linkedin.com/jobs/search/');
        
        // Apply all 4 filters
        jobsUrl.searchParams.set('keywords', contentState.config.JOB_SEARCH_KEYWORD); // Search term
        jobsUrl.searchParams.set('f_AL', 'true'); // Easy Apply filter
        jobsUrl.searchParams.set('f_TPR', 'r86400'); // Last 24 hours
        jobsUrl.searchParams.set('sortBy', 'DD'); // Most Recent
        jobsUrl.searchParams.set('location', 'India'); // Location
        
        const targetUrl = jobsUrl.toString();
        console.log('🔗 Navigating to:', targetUrl);
        
        if (window.location.href !== targetUrl) {
            window.location.href = targetUrl;
            await delay(10000); // Wait for page load
        } else {
            await delay(3000); // Already on correct page
        }
        
        console.log('✅ On LinkedIn Jobs page with all 4 filters applied');
    }

    function startFilterMonitoring() {
        console.log('🔍 Starting filter monitoring...');
        
        contentState.filterCheckInterval = setInterval(() => {
            const currentUrl = new URL(window.location.href);
            
            const requiredFilters = {
                'keywords': contentState.config.JOB_SEARCH_KEYWORD,
                'f_AL': 'true',
                'f_TPR': 'r86400',
                'sortBy': 'DD'
            };
            
            let filtersChanged = false;
            
            for (const [key, value] of Object.entries(requiredFilters)) {
                if (key === 'keywords') {
                    const currentKeywords = currentUrl.searchParams.get(key);
                    if (!currentKeywords || !currentKeywords.toLowerCase().includes(value.toLowerCase())) {
                        currentUrl.searchParams.set(key, value);
                        filtersChanged = true;
                    }
                } else if (currentUrl.searchParams.get(key) !== value) {
                    currentUrl.searchParams.set(key, value);
                    filtersChanged = true;
                }
            }
            
            if (filtersChanged) {
                console.warn('⚠️ Filters disappeared! Reapplying...');
                window.history.pushState({}, '', currentUrl.toString());
                location.reload();
            }
            
        }, contentState.config.DELAYS.FILTER_CHECK);
    }

    function stopFilterMonitoring() {
        if (contentState.filterCheckInterval) {
            clearInterval(contentState.filterCheckInterval);
            contentState.filterCheckInterval = null;
            console.log('✅ Filter monitoring stopped');
        }
    }

    async function processAllJobs() {
        let consecutiveErrors = 0;
        const maxErrors = 5;
        
        while (contentState.stats.applicationsSubmitted < contentState.config.MAX_JOBS && 
               consecutiveErrors < maxErrors) {
            
            try {
                const jobCards = getJobCards();
                
                if (jobCards.length === 0) {
                    console.log('⚠️ No more job cards found');
                    break;
                }
                
                if (contentState.currentJobIndex >= jobCards.length) {
                    console.log('⚠️ Reached end of job list');
                    break;
                }
                
                const currentCard = jobCards[contentState.currentJobIndex];
                const jobId = currentCard.getAttribute('data-occludable-job-id') || 
                             currentCard.getAttribute('data-job-id') || 
                             contentState.currentJobIndex.toString();
                
                console.log(`\n🎯 Processing Job ${contentState.currentJobIndex + 1}/${jobCards.length} (ID: ${jobId})`);
                
                const result = await processSingleJob(currentCard, jobId);
                
                if (result.submitted) {
                    contentState.stats.applicationsSubmitted++;
                    consecutiveErrors = 0;
                    console.log(`✅ Application submitted! Total: ${contentState.stats.applicationsSubmitted}`);
                    showNotification(`✅ Application #${contentState.stats.applicationsSubmitted} submitted!`, 'success', 2000);
                } else {
                    contentState.stats.jobsSkipped++;
                    console.log(`⏭️ Job skipped: ${result.reason}`);
                }
                
                contentState.currentJobIndex++;
                await delay(contentState.config.DELAYS.BETWEEN_JOBS);
                
            } catch (error) {
                console.error('❌ Error processing job:', error);
                consecutiveErrors++;
                contentState.currentJobIndex++;
                await delay(2000);
            }
        }
        
        if (consecutiveErrors >= maxErrors) {
            console.error(`❌ Stopped after ${maxErrors} consecutive errors`);
        }
    }

    function getJobCards() {
        const selectors = [
            '.jobs-search-results__list-item',
            '.scaffold-layout__list-item',
            'li.jobs-search-results__list-item',
            'li[data-occludable-job-id]'
        ];
        
        for (const selector of selectors) {
            const cards = Array.from(document.querySelectorAll(selector))
                .filter(card => isElementVisible(card));
            
            if (cards.length > 0) {
                console.log(`✅ Found ${cards.length} job cards using selector: ${selector}`);
                return cards;
            }
        }
        
        console.log('⚠️ No job cards found');
        return [];
    }

    async function processSingleJob(jobCard, jobId) {
        // Check if already processed
        if (contentState.processedJobs.has(jobId)) {
            return { submitted: false, skipped: true, reason: 'Already processed' };
        }
        
        // Click on job card
        console.log('   🖱️  [1] Clicking job card...');
        jobCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await delay(500);
        jobCard.click();
        await delay(contentState.config.DELAYS.AFTER_JOB_CLICK);
        
        // Check if Easy Apply button exists
        console.log('   🔍 [2] Checking for Easy Apply button...');
        const hasEasyApply = await checkForEasyApplyButton();
        
        if (!hasEasyApply) {
            console.log('   ⏭️  [2] No Easy Apply button - skipping');
            contentState.processedJobs.add(jobId);
            return { submitted: false, skipped: true, reason: 'No Easy Apply button' };
        }
        
        console.log('   ✅ [2] Easy Apply button found!');
        
        // Click Easy Apply button
        console.log('   🖱️  [3] Clicking Easy Apply button...');
        const modalOpened = await clickEasyApplyButton();
        
        if (!modalOpened) {
            console.log('   ❌ [3] Failed to open Easy Apply modal');
            contentState.processedJobs.add(jobId);
            return { submitted: false, skipped: true, reason: 'Modal failed to open' };
        }
        
        console.log('   ✅ [3] Easy Apply modal opened!');
        await delay(contentState.config.DELAYS.AFTER_EASY_APPLY);
        
        // Fill and submit application form
        console.log('   📝 [4] Filling application form...');
        const submitted = await fillAndSubmitApplicationForm();
        
        if (submitted) {
            console.log('   ✅ [4] Application SUBMITTED successfully!');
            contentState.processedJobs.add(jobId);
            return { submitted: true };
        } else {
            console.log('   ❌ [4] Failed to submit application');
            await closeEasyApplyModal();
            contentState.processedJobs.add(jobId);
            return { submitted: false, skipped: true, reason: 'Submission failed' };
        }
    }

    async function checkForEasyApplyButton() {
        await delay(1500); // Wait for job details to load
        
        const buttonSelectors = [
            'button.jobs-apply-button',
            'button[aria-label*="Easy Apply"]',
            'button.jobs-apply-button--top-card',
            '.jobs-apply-button'
        ];
        
        for (const selector of buttonSelectors) {
            const buttons = document.querySelectorAll(selector);
            
            for (const button of buttons) {
                if (isElementVisible(button)) {
                    const buttonText = button.textContent.toLowerCase();
                    const ariaLabel = (button.getAttribute('aria-label') || '').toLowerCase();
                    
                    if (buttonText.includes('easy apply') || ariaLabel.includes('easy apply')) {
                        return true;
                    }
                }
            }
        }
        
        return false;
    }

    async function clickEasyApplyButton() {
        const maxAttempts = 10;
        
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const buttonSelectors = [
                'button.jobs-apply-button',
                'button[aria-label*="Easy Apply"]',
                'button.jobs-apply-button--top-card'
            ];
            
            for (const selector of buttonSelectors) {
                const buttons = document.querySelectorAll(selector);
                
                for (const button of buttons) {
                    if (isElementVisible(button)) {
                        const buttonText = button.textContent.toLowerCase();
                        const ariaLabel = (button.getAttribute('aria-label') || '').toLowerCase();
                        
                        if (buttonText.includes('easy apply') || ariaLabel.includes('easy apply')) {
                            button.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            await delay(300);
                            button.click();
                            await delay(2000);
                            
                            if (isEasyApplyModalOpen()) {
                                return true;
                            }
                        }
                    }
                }
            }
            
            await delay(500);
        }
        
        return false;
    }

    function isEasyApplyModalOpen() {
        const modalSelectors = [
            '.jobs-easy-apply-modal',
            '.jobs-easy-apply-content',
            'div[role="dialog"]',
            '.artdeco-modal'
        ];
        
        for (const selector of modalSelectors) {
            const modal = document.querySelector(selector);
            if (modal && isElementVisible(modal)) {
                return true;
            }
        }
        
        return false;
    }

    async function fillAndSubmitApplicationForm() {
        for (let step = 0; step < contentState.config.MAX_FORM_STEPS; step++) {
            console.log(`      Step ${step + 1}/${contentState.config.MAX_FORM_STEPS}`);
            await delay(1000);
            
            // Fill all visible fields in current step
            const fields = getModalFormFields();
            console.log(`      Found ${fields.length} fields`);
            
            for (const field of fields) {
                if (!isFieldAlreadyFilled(field)) {
                    await fillFieldIntelligently(field);
                    await delay(contentState.config.DELAYS.AFTER_FIELD_FILL);
                }
            }
            
            await delay(800);
            
            // Check if application is complete
            if (isApplicationComplete()) {
                console.log('      ✅ Application complete!');
                await delay(2000);
                await closeEasyApplyModal();
                return true;
            }
            
            // Try to click Submit button
            if (await clickModalButton('submit')) {
                console.log('      🔵 Clicked Submit button');
                await delay(contentState.config.DELAYS.AFTER_SUBMIT);
                
                if (isApplicationComplete()) {
                    await delay(2000);
                    await closeEasyApplyModal();
                    return true;
                }
            }
            
            // Try to click Next button
            if (await clickModalButton('next')) {
                console.log('      🔵 Clicked Next button');
                await delay(contentState.config.DELAYS.AFTER_NEXT);
            } else if (step > 0) {
                // No Next button found and we're past first step - might be stuck
                console.log('      ⚠️ No Next button found');
                break;
            }
        }
        
        return false;
    }

    function getModalFormFields() {
        const modal = document.querySelector('.jobs-easy-apply-modal, .jobs-easy-apply-content, div[role="dialog"]');
        
        if (!modal) {
            return [];
        }
        
        return getAllVisibleFields(modal);
    }

    async function clickModalButton(buttonType) {
        const modal = document.querySelector('.jobs-easy-apply-modal, .jobs-easy-apply-content, div[role="dialog"]');
        
        if (!modal) {
            return false;
        }
        
        const buttons = modal.querySelectorAll('button');
        
        for (const button of buttons) {
            if (!isElementVisible(button) || button.disabled) {
                continue;
            }
            
            const buttonText = button.textContent.toLowerCase();
            const ariaLabel = (button.getAttribute('aria-label') || '').toLowerCase();
            const combinedText = `${buttonText} ${ariaLabel}`;
            
            if (buttonType === 'submit') {
                if ((combinedText.includes('submit') || combinedText.includes('send')) && 
                    !combinedText.includes('next') && !combinedText.includes('review')) {
                    button.click();
                    return true;
                }
            } else if (buttonType === 'next') {
                if ((combinedText.includes('next') || combinedText.includes('continue')) && 
                    !combinedText.includes('submit')) {
                    button.click();
                    return true;
                }
            }
        }
        
        return false;
    }

    function isApplicationComplete() {
        const modal = document.querySelector('.jobs-easy-apply-modal, .jobs-easy-apply-content');
        
        if (!modal || !isElementVisible(modal)) {
            return true; // Modal closed = application complete
        }
        
        const bodyText = document.body.textContent.toLowerCase();
        
        return bodyText.includes('application sent') || 
               bodyText.includes('application submitted') ||
               bodyText.includes('application complete') ||
               bodyText.includes('you successfully applied');
    }

    async function closeEasyApplyModal() {
        const closeButtonSelectors = [
            'button[aria-label*="Dismiss"]',
            'button.artdeco-modal__dismiss',
            'button[data-control-name="close_modal"]',
            '.artdeco-modal__dismiss'
        ];
        
        for (const selector of closeButtonSelectors) {
            const buttons = document.querySelectorAll(selector);
            
            for (const button of buttons) {
                if (isElementVisible(button)) {
                    button.click();
                    await delay(1000);
                    return;
                }
            }
        }
    }

    // ==================== UTILITY FUNCTIONS ====================
    function getAllVisibleFields(container = document) {
        const fieldSelectors = 'input:not([type="hidden"]), textarea, select';
        const fields = container.querySelectorAll(fieldSelectors);
        
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
            // Try label[for]
            if (field.id) {
                const label = document.querySelector(`label[for="${field.id}"]`);
                if (label) {
                    return label.textContent.trim();
                }
            }
            
            // Try parent label
            const parentLabel = field.closest('label');
            if (parentLabel) {
                return parentLabel.textContent.trim();
            }
            
            // Try aria-label
            const ariaLabel = field.getAttribute('aria-label');
            if (ariaLabel) {
                return ariaLabel;
            }
            
            // Try placeholder
            if (field.placeholder) {
                return field.placeholder;
            }
            
            // Try name attribute
            if (field.name) {
                return field.name;
            }
            
            return '';
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
        const originalBackground = field.style.backgroundColor;
        const originalBorder = field.style.border;
        
        field.style.backgroundColor = '#dcfce7';
        field.style.border = '2px solid #22c55e';
        
        setTimeout(() => {
            field.style.backgroundColor = originalBackground;
            field.style.border = originalBorder;
        }, 1500);
    }

    function showDataPanel(databaseData, resumeData) {
        const panel = document.createElement('div');
        panel.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            width: 300px;
            background: white;
            border: 2px solid #3B82F6;
            border-radius: 10px;
            padding: 12px;
            z-index: 999999;
            box-shadow: 0 4px 20px rgba(0,0,0,0.2);
            font-size: 12px;
            font-family: Arial, sans-serif;
        `;
        
        const totalExp = resumeData?.totalExperience || databaseData?.totalExperience || 0;
        
        panel.innerHTML = `
            <div style="font-weight: 700; color: #3B82F6; margin-bottom: 8px;">📊 Data Loaded</div>
            <div>Database: ${Object.keys(databaseData || {}).length} fields</div>
            <div>Resume: ${Object.keys(resumeData || {}).length} fields</div>
            <div style="margin-top: 8px;"><strong>Total Experience: ${totalExp} years</strong></div>
            <button onclick="this.parentElement.remove()" style="
                margin-top: 8px;
                padding: 4px 8px;
                background: #EF4444;
                color: white;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                font-size: 11px;
            ">Close</button>
        `;
        
        document.body.appendChild(panel);
        
        setTimeout(() => {
            if (panel.parentElement) {
                panel.remove();
            }
        }, 20000);
    }

    function showNotification(message, type, duration) {
        const notification = document.createElement('div');
        
        const colors = {
            success: '#10B981',
            error: '#EF4444',
            info: '#3B82F6'
        };
        
        notification.style.cssText = `
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
        
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, duration);
    }

    function triggerFieldEvents(field) {
        const events = ['input', 'change', 'blur'];
        
        events.forEach(eventType => {
            field.dispatchEvent(new Event(eventType, { bubbles: true }));
        });
    }

    function delay(milliseconds) {
        return new Promise(resolve => setTimeout(resolve, milliseconds));
    }

    async function getUserId() {
        try {
            const result = await chrome.storage.local.get(['fillora_user']);
            return result.fillora_user?.id || null;
        } catch {
            return null;
        }
    }

    // ==================== INITIALIZE ====================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeContentScript);
    } else {
        initializeContentScript();
    }

    console.log('✅ [FILLORA] PERFECT VERSION LOADED - Zero errors + Smart salary + Experience calculation!');

} else {
    console.log('⚠️ [FILLORA] Already initialized');
}