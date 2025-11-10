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
            
            // ==================== FIRST PASS ====================
            console.log('\n🔄 FIRST PASS: Filling all fields...');
            let fieldsFilled = 0;
            for (const field of fields) {
                if (await fillFieldIntelligently(field)) {
                    fieldsFilled++;
                    highlightField(field);
                    await delay(contentState.config.DELAYS.AFTER_FIELD_FILL);
                }
            }
            
            console.log(`✅ First pass complete: ${fieldsFilled}/${fields.length} fields filled`);
            
            // ==================== SECOND PASS: Catch Missed Fields ====================
            console.log('\n🔄 SECOND PASS: Checking for missed fields...');
            await delay(500);
            
            const fieldsAfterFirstPass = getAllVisibleFields();
            const emptyFields = fieldsAfterFirstPass.filter(f => !isFieldAlreadyFilled(f));
            
            if (emptyFields.length > 0) {
                console.log(`⚠️ Found ${emptyFields.length} empty fields after first pass`);
                console.log('🔧 Attempting to fill missed fields with enhanced logic...');
                
                let secondPassFilled = 0;
                for (const field of emptyFields) {
                    const fieldInfo = getFieldInformation(field);
                    console.log(`   🔍 Missed field: "${fieldInfo.label}" (${field.type || field.tagName})`);
                    
                    // Try harder to fill this field
                    let filled = false;
                    
                    // Try exact match again
                    let value = getExactMatchValue(fieldInfo);
                    
                    // If still no value, use AI (with more attempts)
                    if (!value && contentState.openaiKey) {
                        console.log(`      🤖 Using AI to fill "${fieldInfo.label}"`);
                        value = await getAIPoweredValue(fieldInfo);
                    }
                    
                    // If still empty, make intelligent guess
                    if (!value) {
                        value = makeIntelligentGuess(fieldInfo);
                    }
                    
                    // Fill the field
                    if (value && value.toString().trim()) {
                        if (field.tagName.toLowerCase() === 'select') {
                            filled = await fillDropdownIntelligently(field, fieldInfo);
                        } else if (field.type === 'file') {
                            filled = await uploadResumeFile(field);
                        } else if (field.type === 'checkbox') {
                            filled = fillCheckboxField(field, fieldInfo);
                        } else if (field.type === 'radio') {
                            filled = fillRadioField(field, fieldInfo);
                        } else {
                            field.value = value.toString().trim();
                            triggerFieldEvents(field);
                            filled = true;
                        }
                        
                        if (filled) {
                            secondPassFilled++;
                            highlightField(field);
                            console.log(`      ✅ Filled in second pass: "${value}"`);
                            await delay(contentState.config.DELAYS.AFTER_FIELD_FILL);
                        }
                    } else {
                        console.log(`      ⚠️ Could not determine value for "${fieldInfo.label}"`);
                    }
                }
                
                fieldsFilled += secondPassFilled;
                console.log(`✅ Second pass complete: ${secondPassFilled} additional fields filled`);
            } else {
                console.log('✅ No empty fields found - all fields filled in first pass!');
            }
            
            // ==================== FINAL VERIFICATION ====================
            console.log('\n🔍 FINAL VERIFICATION: Checking all fields...');
            await delay(300);
            
            const finalFields = getAllVisibleFields();
            const stillEmpty = finalFields.filter(f => !isFieldAlreadyFilled(f));
            
            if (stillEmpty.length > 0) {
                console.log(`⚠️ ${stillEmpty.length} fields still empty after two passes:`);
                stillEmpty.forEach(f => {
                    const info = getFieldInformation(f);
                    console.log(`   • "${info.label}" (${f.type || f.tagName})`);
                });
            } else {
                console.log('✅ Perfect! All fields filled successfully!');
            }
            
            const successRate = fields.length > 0 ? Math.round((fieldsFilled / fields.length) * 100) : 0;
            const timeTaken = ((Date.now() - startTime) / 1000).toFixed(2);
            
            console.log(`\n✅ AUTOFILL COMPLETE: ${fieldsFilled}/${fields.length} fields (${successRate}%) in ${timeTaken}s\n`);
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
        console.log('📥 Loading user data for userId:', userId);
        
        // Load database data
        const dbResponse = await chrome.runtime.sendMessage({
            action: 'FETCH_ALL_DATABASE_TABLES',
            userId: userId
        });
        
        if (dbResponse?.success && dbResponse.data) {
            contentState.databaseData = dbResponse.data;
            console.log('✅ Database loaded:', Object.keys(dbResponse.data).length, 'fields');
            console.log('🗄️ Database data:', dbResponse.data);
        } else {
            console.warn('⚠️ No database data loaded');
        }
        
        // Load resume data
        const resumeResponse = await chrome.runtime.sendMessage({
            action: 'PARSE_REAL_RESUME_CONTENT',
            userId: userId
        });
        
        if (resumeResponse?.success && resumeResponse.data) {
            contentState.resumeData = resumeResponse.data;
            console.log('✅ Resume loaded:', Object.keys(resumeResponse.data).length, 'fields');
            console.log('📄 Resume data:', resumeResponse.data);
            
            // CRITICAL: ALWAYS recalculate experience from date ranges
            // Don't trust pre-existing totalExperience value as it might be wrong!
            console.log('\n🔍 Checking experience in resume data...');
            console.log('   resume.totalExperience (PRE-EXISTING):', resumeResponse.data.totalExperience);
            console.log('   resume.experience:', resumeResponse.data.experience);
            console.log('   resume.workExperience:', resumeResponse.data.workExperience);
            console.log('   resume.professionalExperience:', resumeResponse.data.professionalExperience);
            
            // FORCE RECALCULATION - Don't trust existing value!
            console.log('\n🧮 FORCING recalculation from date ranges (ignoring pre-existing value)...');
            const calculatedExp = calculateTotalExperience(resumeResponse.data);
            
            // Use calculated value if it's greater than 0, otherwise fall back to database
            if (calculatedExp > 0) {
                contentState.resumeData.totalExperience = calculatedExp;
                console.log(`✅ OVERRIDE: Set totalExperience to ${calculatedExp} years (calculated)\n`);
            } else if (contentState.databaseData?.totalExperience) {
                contentState.resumeData.totalExperience = contentState.databaseData.totalExperience;
                console.log(`✅ FALLBACK: Using database totalExperience: ${contentState.databaseData.totalExperience} years\n`);
            } else {
                console.warn(`⚠️ Could not calculate experience, keeping original: ${resumeResponse.data.totalExperience} years\n`);
            }
            
        } else {
            console.warn('⚠️ No resume data loaded');
        }
        
        console.log('\n📊 FINAL DATA STATE:');
        console.log('   Database fields:', Object.keys(contentState.databaseData || {}).length);
        console.log('   Resume fields:', Object.keys(contentState.resumeData || {}).length);
        console.log('   Total Experience (FINAL):', contentState.resumeData?.totalExperience || contentState.databaseData?.totalExperience || 0, 'years');
        console.log('');
    }

    // ==================== SMART EXPERIENCE CALCULATION (FIXED!) ====================
    function calculateTotalExperience(resumeData) {
        try {
            console.log('🧮 Calculating total experience from resume...');
            console.log('📄 Resume data received:', resumeData);
            
            // Convert ENTIRE resume data to string for pattern matching
            // This ensures we catch date ranges regardless of which field they're in
            const resumeText = JSON.stringify(resumeData);
            console.log('📝 Resume text length:', resumeText.length, 'characters');
            
            const currentYear = new Date().getFullYear();
            const currentMonth = new Date().getMonth() + 1;
            
            let totalMonths = 0;
            const foundRanges = [];
            const processedRanges = new Set();
            
            // Pattern to match date ranges like:
            // "2021 – 2022", "2021-2022", "2021 - 2022"
            // "2022 – Present", "2022-Present", "2022 - Present"
            const rangePattern = /\b(19|20)\d{2}\s*[–\-—]\s*((19|20)\d{2}|present|current)\b/gi;
            const matches = Array.from(resumeText.matchAll(rangePattern));
            
            console.log(`🔍 Found ${matches.length} potential date ranges in resume`);
            
            for (const match of matches) {
                const fullMatch = match[0];
                
                // Normalize the match for duplicate detection
                const normalized = fullMatch.replace(/\s+/g, '').toLowerCase();
                if (processedRanges.has(normalized)) {
                    console.log(`   ⏭️ Skipping duplicate: ${fullMatch}`);
                    continue;
                }
                processedRanges.add(normalized);
                
                console.log(`   🔍 Processing range: "${fullMatch}"`);
                
                // Extract start year (first 4-digit year)
                const startYearMatch = fullMatch.match(/\b(19|20)\d{2}\b/);
                if (!startYearMatch) {
                    console.log(`      ❌ Could not extract start year`);
                    continue;
                }
                const startYear = parseInt(startYearMatch[0]);
                
                // Extract end year or "present"
                const parts = fullMatch.split(/[–\-—]/);
                if (parts.length < 2) {
                    console.log(`      ❌ Could not split into start and end`);
                    continue;
                }
                
                const endPart = parts[1].trim().toLowerCase();
                let endYear, endMonth;
                
                if (endPart.includes('present') || endPart.includes('current')) {
                    endYear = currentYear;
                    endMonth = currentMonth;
                    console.log(`      📅 Start: ${startYear}, End: Present (${currentYear})`);
                } else {
                    const endYearMatch = endPart.match(/\b(19|20)\d{2}\b/);
                    if (endYearMatch) {
                        endYear = parseInt(endYearMatch[0]);
                        endMonth = 12; // Assume full year
                        console.log(`      📅 Start: ${startYear}, End: ${endYear}`);
                    } else {
                        console.log(`      ❌ Could not extract end year from: "${endPart}"`);
                        continue;
                    }
                }
                
                // Validate years
                if (startYear < 1990 || startYear > currentYear) {
                    console.log(`      ❌ Invalid start year: ${startYear} (must be 1990-${currentYear})`);
                    continue;
                }
                if (endYear < startYear) {
                    console.log(`      ❌ End year (${endYear}) before start year (${startYear})`);
                    continue;
                }
                if (endYear > currentYear) {
                    console.log(`      ❌ End year (${endYear}) is in the future`);
                    continue;
                }
                
                // Calculate months
                // From start of start year to end of end year
                const startMonth = 1; // Assume January of start year
                const monthsInRange = (endYear - startYear) * 12 + (endMonth - startMonth);
                
                if (monthsInRange <= 0) {
                    console.log(`      ❌ Invalid range: ${monthsInRange} months`);
                    continue;
                }
                
                totalMonths += monthsInRange;
                const yearsInRange = Math.round(monthsInRange / 12 * 10) / 10;
                
                foundRanges.push({
                    text: fullMatch,
                    startYear,
                    endYear,
                    months: monthsInRange,
                    years: yearsInRange
                });
                
                console.log(`      ✅ ${startYear} to ${endYear === currentYear ? 'Present' : endYear} = ${yearsInRange} years (${monthsInRange} months)`);
            }
            
            // Calculate total years
            const totalYears = Math.round(totalMonths / 12 * 10) / 10;
            
            console.log('\n📊 ═══════════════════════════════════════════════');
            console.log('📊 EXPERIENCE CALCULATION SUMMARY:');
            console.log('📊 ═══════════════════════════════════════════════');
            
            if (foundRanges.length === 0) {
                console.log('   ⚠️ No date ranges found in resume');
                console.log('   💡 Make sure resume contains date ranges like "2021-2022" or "2022-Present"');
            } else {
                foundRanges.forEach((range, index) => {
                    console.log(`   ${index + 1}. ${range.text}`);
                    console.log(`      → ${range.startYear} to ${range.endYear === currentYear ? 'Present' : range.endYear}`);
                    console.log(`      → ${range.years} years (${range.months} months)`);
                });
                console.log('   ─────────────────────────────────────────────');
                console.log(`   ✅ TOTAL EXPERIENCE: ${totalYears} years (${totalMonths} months)`);
            }
            
            console.log('📊 ═══════════════════════════════════════════════\n');
            
            return totalYears > 0 ? totalYears : 0;
            
        } catch (error) {
            console.error('❌ Experience calculation error:', error);
            console.error('Stack:', error.stack);
            return 0;
        }
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
        
        // Address fields - CRITICAL FIX!
        if (context.includes('address') || context.includes('street') || context.includes('location')) {
            // Try multiple address field names
            const fullAddress = db.address || resume.address || 
                               db.fullAddress || resume.fullAddress ||
                               db.streetAddress || resume.streetAddress || '';
            
            if (fullAddress) return fullAddress;
            
            // If no full address, build from components
            const city = db.city || resume.city || '';
            const state = db.state || resume.state || '';
            const country = db.country || resume.country || '';
            
            if (city || state || country) {
                return [city, state, country].filter(x => x).join(', ');
            }
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
        if (context.includes('zip') || context.includes('postal') || context.includes('pincode')) {
            return db.zipCode || resume.zipCode || db.pincode || resume.pincode || '';
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
            
            // FIRST PASS
            let filled = 0;
            for (const field of fields) {
                if (!isFieldAlreadyFilled(field)) {
                    if (await fillFieldIntelligently(field)) {
                        filled++;
                    }
                    await delay(contentState.config.DELAYS.AFTER_FIELD_FILL);
                }
            }
            console.log(`      ✅ First pass: ${filled} fields filled`);
            
            // SECOND PASS - Check for missed fields
            await delay(500);
            const fieldsAfter = getModalFormFields();
            const emptyFields = fieldsAfter.filter(f => !isFieldAlreadyFilled(f));
            
            if (emptyFields.length > 0) {
                console.log(`      ⚠️ ${emptyFields.length} fields still empty, retrying...`);
                let secondFilled = 0;
                
                for (const field of emptyFields) {
                    const fieldInfo = getFieldInformation(field);
                    
                    // Try harder with AI if available
                    let value = getExactMatchValue(fieldInfo);
                    if (!value && contentState.openaiKey) {
                        value = await getAIPoweredValue(fieldInfo);
                    }
                    if (!value) {
                        value = makeIntelligentGuess(fieldInfo);
                    }
                    
                    if (value) {
                        if (field.tagName.toLowerCase() === 'select') {
                            if (await fillDropdownIntelligently(field, fieldInfo)) secondFilled++;
                        } else if (field.type === 'file') {
                            if (await uploadResumeFile(field)) secondFilled++;
                        } else if (field.type === 'checkbox') {
                            if (fillCheckboxField(field, fieldInfo)) secondFilled++;
                        } else if (field.type === 'radio') {
                            if (fillRadioField(field, fieldInfo)) secondFilled++;
                        } else if (value.toString().trim()) {
                            field.value = value.toString().trim();
                            triggerFieldEvents(field);
                            secondFilled++;
                        }
                        await delay(contentState.config.DELAYS.AFTER_FIELD_FILL);
                    }
                }
                
                if (secondFilled > 0) {
                    console.log(`      ✅ Second pass: ${secondFilled} additional fields filled`);
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
            width: 380px;
            max-height: 600px;
            overflow-y: auto;
            background: white;
            border: 2px solid #3B82F6;
            border-radius: 10px;
            padding: 14px;
            z-index: 999999;
            box-shadow: 0 4px 20px rgba(0,0,0,0.2);
            font-size: 11px;
            font-family: Arial, sans-serif;
            line-height: 1.6;
        `;
        
        const db = databaseData || {};
        const resume = resumeData || {};
        
        // Get final merged data
        const fullName = db.fullName || resume.fullName || db.name || resume.name || 'N/A';
        const email = db.email || resume.email || 'N/A';
        const phone = db.phone || resume.phone || 'N/A';
        const currentTitle = db.currentTitle || resume.currentTitle || db.jobTitle || resume.jobTitle || 'N/A';
        const currentCompany = db.currentCompany || resume.currentCompany || 'N/A';
        const city = db.city || resume.city || 'N/A';
        const totalExp = resume.totalExperience || db.totalExperience || 0;
        const education = db.education || resume.education || db.degree || resume.degree || 'N/A';
        
        // Build HTML with RAW data from both sources
        let html = `
            <div style="font-weight: 700; color: #3B82F6; margin-bottom: 10px; font-size: 13px; display: flex; align-items: center; gap: 6px;">
                <span>📊</span>
                <span>Extracted Data from Sources</span>
            </div>
        `;
        
        // DATABASE DATA SECTION
        html += `
            <div style="background: #DBEAFE; padding: 10px; border-radius: 6px; margin-bottom: 10px; border-left: 3px solid #3B82F6;">
                <div style="font-weight: 700; color: #1E40AF; margin-bottom: 6px; font-size: 12px;">
                    🗄️ DATABASE DATA (${Object.keys(db).length} fields)
                </div>
                <div style="font-size: 10px; color: #1E3A8A; line-height: 1.5;">
        `;
        
        if (Object.keys(db).length > 0) {
            // Show top 15 database fields
            const dbEntries = Object.entries(db).slice(0, 15);
            dbEntries.forEach(([key, value]) => {
                const displayValue = value && value.toString().length > 50 ? 
                    value.toString().substring(0, 50) + '...' : value;
                html += `<div><strong>${key}:</strong> ${displayValue || 'N/A'}</div>`;
            });
            if (Object.keys(db).length > 15) {
                html += `<div style="color: #64748B; font-style: italic;">... and ${Object.keys(db).length - 15} more fields</div>`;
            }
        } else {
            html += `<div style="color: #64748B; font-style: italic;">No database data found</div>`;
        }
        
        html += `
                </div>
            </div>
        `;
        
        // RESUME DATA SECTION
        html += `
            <div style="background: #FEF3C7; padding: 10px; border-radius: 6px; margin-bottom: 10px; border-left: 3px solid #F59E0B;">
                <div style="font-weight: 700; color: #92400E; margin-bottom: 6px; font-size: 12px;">
                    📄 RESUME DATA (${Object.keys(resume).length} fields)
                </div>
                <div style="font-size: 10px; color: #78350F; line-height: 1.5;">
        `;
        
        if (Object.keys(resume).length > 0) {
            // Show top 15 resume fields
            const resumeEntries = Object.entries(resume).slice(0, 15);
            resumeEntries.forEach(([key, value]) => {
                const displayValue = value && value.toString().length > 50 ? 
                    value.toString().substring(0, 50) + '...' : value;
                html += `<div><strong>${key}:</strong> ${displayValue || 'N/A'}</div>`;
            });
            if (Object.keys(resume).length > 15) {
                html += `<div style="color: #64748B; font-style: italic;">... and ${Object.keys(resume).length - 15} more fields</div>`;
            }
        } else {
            html += `<div style="color: #64748B; font-style: italic;">No resume data found</div>`;
        }
        
        html += `
                </div>
            </div>
        `;
        
        // EXPERIENCE CALCULATION SECTION
        html += `
            <div style="background: #DCFCE7; padding: 10px; border-radius: 6px; margin-bottom: 10px; border-left: 3px solid #10B981;">
                <div style="font-weight: 700; color: #065F46; margin-bottom: 6px; font-size: 12px;">
                    🧮 EXPERIENCE CALCULATION
                </div>
                <div style="font-size: 10px; color: #064E3B; line-height: 1.5;">
                    <div><strong>From Database:</strong> ${db.totalExperience || 'Not found'}</div>
                    <div><strong>From Resume:</strong> ${resume.totalExperience || 'Calculated'} years</div>
                    <div style="margin-top: 6px; padding: 6px; background: #FEF3C7; border-radius: 4px;">
                        <div style="font-weight: 700; color: #92400E; font-size: 11px;">
                            💼 FINAL EXPERIENCE: ${totalExp} years
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // MERGED FINAL DATA SECTION
        html += `
            <div style="background: #F1F5F9; padding: 10px; border-radius: 6px; margin-bottom: 10px;">
                <div style="font-weight: 700; color: #334155; margin-bottom: 6px; font-size: 12px;">
                    ✅ FINAL MERGED DATA (Used for Autofill)
                </div>
                <div style="font-size: 10px; color: #475569; line-height: 1.5;">
                    <div><strong>👤 Name:</strong> ${fullName}</div>
                    <div><strong>💼 Title:</strong> ${currentTitle}</div>
                    <div><strong>🏢 Company:</strong> ${currentCompany}</div>
                    <div><strong>📧 Email:</strong> ${email}</div>
                    <div><strong>📱 Phone:</strong> ${phone}</div>
                    <div><strong>📍 Location:</strong> ${city}</div>
                    <div><strong>🎓 Education:</strong> ${education}</div>
                    <div><strong>💼 Experience:</strong> ${totalExp} years</div>
                </div>
            </div>
        `;
        
        html += `
            <button onclick="this.parentElement.remove()" style="
                margin-top: 10px;
                width: 100%;
                padding: 8px 10px;
                background: #EF4444;
                color: white;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 11px;
                font-weight: 600;
            ">Close Panel</button>
        `;
        
        panel.innerHTML = html;
        document.body.appendChild(panel);
        
        // Auto-close after 45 seconds
        setTimeout(() => {
            if (panel.parentElement) {
                panel.remove();
            }
        }, 45000);
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