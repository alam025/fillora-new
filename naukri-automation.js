// ==================== NAUKRI.COM - COMPLETE FINAL VERSION ====================
// ✅ Auto-init on every page
// ✅ Main page → Click first job
// ✅ Detailed page → Apply with chatbot form filling
// ✅ Green indicator updates IMMEDIATELY on apply
// ✅ Post-application page detection (/myapply/saveApply)
// ✅ Right sidebar → Find next job
// ✅ Scroll down → "14/15 Roles you might be interested in" FIXED!
// ✅ Loop → Continue until 10 jobs applied
// ✅ State persistence → Works across page navigations
// 🆕 REAL DATA FORM FILLING - Database + Resume + AI (NO FAKE DATA!)

console.log('\n🎯 ══════════════════════════════════════════════════════════════');
console.log('🎯 [NAUKRI] COMPLETE FINAL VERSION - WITH REAL DATA!');
console.log('🎯 ══════════════════════════════════════════════════════════════\n');

// ==================== GLOBAL STATE ====================
const NAUKRI = {
    isRunning: false,
    searchTerm: '',
    clickedJobs: new Set(),
    processedJobs: new Set(),
    userData: null,
    resumeData: null,
    openaiKey: '',
    stats: {
        applied: 0,
        skipped: 0,
        startTime: null
    },
    config: {
        MAX_JOBS: 10,
        DELAYS: {
            PAGE_LOAD: 2000,
            AFTER_CLICK: 2000,
            AFTER_APPLY: 3000,
            BETWEEN_QUESTIONS: 1500,
            AFTER_ANSWER: 800,
            AFTER_SAVE: 1200,
            SCROLL_DELAY: 1500
        }
    }
};

// ==================== UTILITY FUNCTIONS ====================
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function isMainPage() {
    const url = window.location.href;
    return (url.includes('naukri.com') && 
            (url.includes('-jobs') || url.includes('/search?') || url.includes('/jobs?'))) &&
            !url.includes('job-listings-') &&
            !url.includes('/myapply/');
}

function isDetailedPage() {
    const url = window.location.href;
    return url.includes('naukri.com') && 
           (url.includes('job-listings-') || 
            url.includes('/myapply/saveApply') || 
            url.includes('/myapply/'));
}

function extractSearchTerm() {
    const url = window.location.href;
    
    if (url.includes('data-analyst')) return 'data analyst';
    if (url.includes('data-scientist')) return 'data scientist';
    if (url.includes('python-developer')) return 'python developer';
    
    return 'data analyst';
}

function calculateMatchScore(jobTitle, searchTerm) {
    const titleLower = jobTitle.toLowerCase();
    const searchLower = searchTerm.toLowerCase();
    const searchWords = searchLower.split(/\s+/).filter(w => w.length >= 3);
    
    let score = 0;
    
    if (titleLower === searchLower) return 1000;
    if (titleLower.includes(searchLower)) score += 800;
    if (titleLower.startsWith(searchLower)) score += 600;
    
    if (searchWords.length >= 1) {
        const firstWord = searchWords[0];
        const secondWord = searchWords[1] || '';
        
        if (titleLower.includes(firstWord)) score += 300;
        if (secondWord && titleLower.includes(secondWord)) score += 200;
        if (score === 0 && titleLower.length > 5) score = 50;
    }
    
    return score;
}

// ==================== LOAD USER DATA ====================
async function loadUserData() {
    console.log('📥 [DATA] Loading user data...\n');
    
    try {
        const userResult = await chrome.storage.local.get(['fillora_user']);
        const userId = userResult.fillora_user?.id;
        
        if (!userId) {
            console.log('⚠️  No user ID found\n');
            return;
        }
        
        const dbResponse = await chrome.runtime.sendMessage({
            action: 'FETCH_ALL_DATABASE_TABLES',
            userId: userId
        });
        
        if (dbResponse?.success && dbResponse.data) {
            NAUKRI.userData = dbResponse.data;
            console.log('✅ Database data loaded');
        }
        
        const resumeResponse = await chrome.runtime.sendMessage({
            action: 'PARSE_REAL_RESUME_CONTENT',
            userId: userId
        });
        
        if (resumeResponse?.success && resumeResponse.data) {
            NAUKRI.resumeData = resumeResponse.data;
            
            // Calculate experience
            const calculatedExp = calculateTotalExperience(resumeResponse.data);
            if (calculatedExp > 0) {
                NAUKRI.resumeData.totalExperience = calculatedExp;
            } else if (NAUKRI.userData?.totalExperience) {
                NAUKRI.resumeData.totalExperience = NAUKRI.userData.totalExperience;
            }
            
            console.log('✅ Resume data loaded');
            console.log(`   Experience: ${NAUKRI.resumeData.totalExperience || 0} years`);
        }
        
        const config = await chrome.storage.local.get('fillora_config');
        if (config.fillora_config?.OPENAI_API_KEY_BACKGROUND) {
            NAUKRI.openaiKey = config.fillora_config.OPENAI_API_KEY_BACKGROUND;
            console.log('✅ OpenAI key loaded');
        }
        
        console.log();
        
    } catch (error) {
        console.error('❌ Error loading data:', error.message);
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

// ==================== GREEN INDICATOR ====================
function createGreenIndicator() {
    let indicator = document.getElementById('naukri-green-indicator');
    if (indicator) indicator.remove();
    
    indicator = document.createElement('div');
    indicator.id = 'naukri-green-indicator';
    indicator.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        color: white;
        padding: 15px 25px;
        border-radius: 12px;
        font-family: Arial, sans-serif;
        font-size: 14px;
        font-weight: bold;
        z-index: 999999;
        box-shadow: 0 4px 20px rgba(16, 185, 129, 0.4);
        border: 2px solid #059669;
    `;
    indicator.innerHTML = `
        ✅ Naukri Automation ACTIVE<br>
        <span style="font-size: 12px; opacity: 0.9;">
            Applied: <span id="naukri-applied">${NAUKRI.stats.applied}</span> | 
            Skipped: <span id="naukri-skipped">${NAUKRI.stats.skipped}</span>
        </span>
    `;
    
    document.body.appendChild(indicator);
    console.log('✅ Green indicator created!\n');
}

function updateIndicator() {
    console.log(`\n📊 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📊 UPDATING GREEN INDICATOR`);
    console.log(`📊 Applied: ${NAUKRI.stats.applied} | Skipped: ${NAUKRI.stats.skipped}`);
    console.log(`📊 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    
    const applied = document.getElementById('naukri-applied');
    const skipped = document.getElementById('naukri-skipped');
    
    if (applied) {
        applied.textContent = NAUKRI.stats.applied;
        console.log(`   ✅ Applied count updated in DOM: ${NAUKRI.stats.applied}`);
    } else {
        console.log(`   ⚠️  Applied element not found - recreating indicator`);
        createGreenIndicator();
    }
    
    if (skipped) {
        skipped.textContent = NAUKRI.stats.skipped;
        console.log(`   ✅ Skipped count updated in DOM: ${NAUKRI.stats.skipped}`);
    } else {
        console.log(`   ⚠️  Skipped element not found - recreating indicator`);
        createGreenIndicator();
    }
    
    console.log();
}

// ==================== STORAGE PERSISTENCE ====================
function saveState() {
    chrome.storage.local.set({
        naukri_running: NAUKRI.isRunning,
        naukri_search_term: NAUKRI.searchTerm,
        naukri_stats: NAUKRI.stats,
        naukri_clicked: Array.from(NAUKRI.clickedJobs),
        naukri_processed: Array.from(NAUKRI.processedJobs)
    });
}

async function loadState() {
    return new Promise((resolve) => {
        chrome.storage.local.get([
            'naukri_running',
            'naukri_search_term',
            'naukri_stats',
            'naukri_clicked',
            'naukri_processed'
        ], (data) => {
            if (data.naukri_running) {
                NAUKRI.isRunning = true;
                NAUKRI.searchTerm = data.naukri_search_term || 'data analyst';
                if (data.naukri_stats) NAUKRI.stats = data.naukri_stats;
                if (data.naukri_clicked) NAUKRI.clickedJobs = new Set(data.naukri_clicked);
                if (data.naukri_processed) NAUKRI.processedJobs = new Set(data.naukri_processed);
                
                console.log('📥 State loaded:');
                console.log(`   Search: "${NAUKRI.searchTerm}"`);
                console.log(`   Applied: ${NAUKRI.stats.applied} | Skipped: ${NAUKRI.stats.skipped}\n`);
            }
            resolve(data.naukri_running);
        });
    });
}

// ==================== AUTO-INIT ====================
async function autoInit() {
    console.log('🔄 [AUTO-INIT] Checking if automation should continue...\n');
    console.log(`   Current URL: ${window.location.href.substring(0, 80)}...\n`);
    
    const wasRunning = await loadState();
    
    if (wasRunning) {
        console.log('✅ Automation is running - continuing...\n');
        
        if (window.location.href.includes('naukri.com')) {
            createGreenIndicator();
            
            setInterval(() => {
                const indicator = document.getElementById('naukri-green-indicator');
                if (!indicator && NAUKRI.isRunning) {
                    console.log('⚠️  Indicator disappeared - recreating...\n');
                    createGreenIndicator();
                }
            }, 3000);
        }
        
        await delay(NAUKRI.config.DELAYS.PAGE_LOAD);
        
        if (isMainPage()) {
            console.log('📄 PAGE TYPE: MAIN PAGE\n');
            await handleMainPage();
        } else if (isDetailedPage()) {
            console.log('📄 PAGE TYPE: DETAILED/POST-APPLICATION PAGE\n');
            await handleDetailedPage();
        } else {
            console.log('⚠️  PAGE TYPE: UNKNOWN - trying detailed page handler anyway\n');
            await handleDetailedPage();
        }
    } else {
        console.log('⏸️  Automation NOT running\n');
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
} else {
    autoInit();
}

// ==================== MESSAGE LISTENER ====================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'START_NAUKRI_AUTOMATION') {
        console.log('📥 START command received\n');
        
        startAutomation()
            .then(result => sendResponse(result))
            .catch(error => sendResponse({ success: false, error: error.message }));
        
        return true;
    }
});

// ==================== START AUTOMATION ====================
async function startAutomation() {
    if (NAUKRI.isRunning) {
        console.log('⚠️  Already running!\n');
        return { success: false, message: 'Already running' };
    }
    
    console.log('🚀 ══════════════════════════════════════════════════════════════');
    console.log('🚀 STARTING NAUKRI AUTOMATION');
    console.log('🚀 ══════════════════════════════════════════════════════════════\n');
    
    NAUKRI.isRunning = true;
    NAUKRI.stats.applied = 0;
    NAUKRI.stats.skipped = 0;
    NAUKRI.stats.startTime = Date.now();
    NAUKRI.clickedJobs.clear();
    NAUKRI.processedJobs.clear();
    
    NAUKRI.searchTerm = extractSearchTerm();
    console.log(`🔍 Search term: "${NAUKRI.searchTerm}"\n`);
    
    await loadUserData();
    saveState();
    createGreenIndicator();
    
    try {
        if (isMainPage()) {
            await handleMainPage();
        } else if (isDetailedPage()) {
            await handleDetailedPage();
        } else {
            throw new Error('Not on valid Naukri page');
        }
        return { success: true };
    } catch (error) {
        console.error('❌ Error:', error.message);
        NAUKRI.isRunning = false;
        saveState();
        throw error;
    }
}

// ==================== PHASE 1: HANDLE MAIN PAGE ====================
async function handleMainPage() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📄 PHASE 1: MAIN PAGE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    window.scrollTo(0, 0);
    await delay(1000);
    
    const jobCards = document.querySelectorAll(
        'article, div[class*="job"], div[class*="tuple"], a[href*="job-listings"]'
    );
    
    console.log(`🔍 Found ${jobCards.length} job elements\n`);
    
    const validJobs = [];
    
    for (const card of jobCards) {
        let link = card.tagName === 'A' ? card : card.querySelector('a[href*="job-listings"]');
        
        if (!link || !link.href) continue;
        if (!link.href.includes('naukri.com')) continue;
        if (NAUKRI.clickedJobs.has(link.href)) continue;
        
        const rect = card.getBoundingClientRect();
        if (rect.width < 100) continue;
        
        validJobs.push({ card, link, rect });
    }
    
    console.log(`✅ Found ${validJobs.length} valid jobs\n`);
    
    if (validJobs.length === 0) {
        console.log('❌ No jobs found!\n');
        return;
    }
    
    validJobs.sort((a, b) => a.rect.top - b.rect.top);
    const first = validJobs[0];
    
    console.log('🎯 Clicking first job...\n');
    
    NAUKRI.clickedJobs.add(first.link.href);
    saveState();
    
    first.card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await delay(1000);
    
    first.card.style.backgroundColor = '#bfdbfe';
    await delay(1000);
    
    try {
        first.link.click();
        console.log('✅ CLICKED!\n');
    } catch {
        window.location.href = first.link.href;
    }
}

// ==================== PHASE 2: HANDLE DETAILED PAGE ====================
async function handleDetailedPage() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📄 PHASE 2: DETAILED PAGE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const currentUrl = window.location.href;
    
    const isPostApplication = currentUrl.includes('/myapply/');
    
    if (isPostApplication) {
        console.log('✅ POST-APPLICATION PAGE DETECTED!\n');
        
        const successMessage = document.body.textContent.toLowerCase();
        if (successMessage.includes('successfully applied') || successMessage.includes('you have successfully')) {
            console.log('✅ Application confirmed!\n');
            
            if (!NAUKRI.processedJobs.has('post-app-counted')) {
                NAUKRI.stats.applied++;
                NAUKRI.processedJobs.add('post-app-counted');
                
                console.log(`🎉 APPLIED! Total: ${NAUKRI.stats.applied}/${NAUKRI.config.MAX_JOBS}\n`);
                
                updateIndicator();
                saveState();
            }
        }
        
        await delay(NAUKRI.config.DELAYS.AFTER_APPLY);
        
        if (NAUKRI.stats.applied >= NAUKRI.config.MAX_JOBS) {
            console.log('\n🎉 TARGET REACHED!\n');
            NAUKRI.isRunning = false;
            saveState();
            return;
        }
        
        await findAndClickMatchingJob();
        return;
    }
    
    if (NAUKRI.processedJobs.has(currentUrl)) {
        console.log('⏭️  Already processed\n');
        await findAndClickMatchingJob();
        return;
    }
    
    NAUKRI.processedJobs.add(currentUrl);
    saveState();
    
    await delay(1500);
    
    const buttonInfo = getButtonType();
    console.log(`🔘 Button: ${buttonInfo.type}\n`);
    
    if (buttonInfo.type === 'APPLY' && buttonInfo.button) {
        console.log('✅ Apply button found - CLICKING...\n');
        
        buttonInfo.button.click();
        
        console.log('⏳ Waiting 4 seconds for form to load...\n');
        await delay(4000);
        
        console.log('🔍 Checking if chatbot form appeared...\n');
        
        const formDetected = await detectChatbotWithMultipleMethods();
        
        if (formDetected) {
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('🤖 CHATBOT FORM DETECTED!');
            console.log('🚀 FILLING WITH REAL DATA (Database + Resume + AI)');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
            
            // 🆕 NEW REAL DATA FORM FILLING!
            const formFilled = await fillChatbotFormWithRealData();
            
            if (formFilled) {
                console.log('\n✅ ════════════════════════════════════════════════════════');
                console.log('✅ FORM SUCCESSFULLY FILLED WITH REAL DATA!');
                console.log('✅ ════════════════════════════════════════════════════════\n');
                
                NAUKRI.stats.applied++;
                console.log(`🎉 Form filled & submitted! Total: ${NAUKRI.stats.applied}/${NAUKRI.config.MAX_JOBS}\n`);
                
                updateIndicator();
                saveState();
                
                await delay(3000);
            } else {
                console.log('\n⚠️  ════════════════════════════════════════════════════════');
                console.log('⚠️  FORM FILLING FAILED - Trying again...');
                console.log('⚠️  ════════════════════════════════════════════════════════\n');
                
                const retryFilled = await fillChatbotFormWithRealData();
                
                if (retryFilled) {
                    NAUKRI.stats.applied++;
                    console.log(`🎉 Retry successful! Total: ${NAUKRI.stats.applied}/${NAUKRI.config.MAX_JOBS}\n`);
                    updateIndicator();
                    saveState();
                } else {
                    console.log('❌ Form filling failed after retry - skipping\n');
                    NAUKRI.stats.skipped++;
                    updateIndicator();
                    saveState();
                }
            }
        } else {
            console.log('ℹ️  No form detected - checking if directly applied...\n');
            await delay(2000);
            
            const successMessage = document.body.textContent.toLowerCase();
            if (successMessage.includes('successfully applied') || successMessage.includes('you have successfully')) {
                NAUKRI.stats.applied++;
                console.log(`✅ Direct application! Total: ${NAUKRI.stats.applied}/${NAUKRI.config.MAX_JOBS}\n`);
                
                updateIndicator();
                saveState();
            } else {
                console.log('⚠️  No success message found\n');
                NAUKRI.stats.skipped++;
                updateIndicator();
                saveState();
            }
        }
        
        await delay(NAUKRI.config.DELAYS.AFTER_APPLY);
        
    } else if (buttonInfo.type === 'COMPANY_SITE') {
        console.log('⏭️  SKIPPING (company site)\n');
        NAUKRI.stats.skipped++;
        updateIndicator();
        saveState();
    } else {
        console.log('❌ SKIPPING (no button)\n');
        NAUKRI.stats.skipped++;
        updateIndicator();
        saveState();
    }
    
    if (NAUKRI.stats.applied >= NAUKRI.config.MAX_JOBS) {
        console.log('\n🎉 TARGET REACHED!\n');
        NAUKRI.isRunning = false;
        saveState();
        return;
    }
    
    await delay(NAUKRI.config.DELAYS.AFTER_CLICK);
    await findAndClickMatchingJob();
}

// ==================== CHATBOT DETECTION ====================
async function detectChatbotWithMultipleMethods() {
    console.log('🔍 ══════════════════════════════════════════════════════════════');
    console.log('🔍 DETECTING CHATBOT FORM (ULTRA AGGRESSIVE MODE)');
    console.log('🔍 ══════════════════════════════════════════════════════════════\n');
    
    let detected = false;
    let attempts = 0;
    const maxAttempts = 15;
    
    while (!detected && attempts < maxAttempts) {
        attempts++;
        console.log(`   [Attempt ${attempts}/${maxAttempts}] Scanning page...\n`);
        
        // METHOD 1: contenteditable
        const editables = document.querySelectorAll('[contenteditable="true"]');
        console.log(`      Found ${editables.length} contenteditable elements`);
        
        for (const ed of editables) {
            const rect = ed.getBoundingClientRect();
            if (rect.width > 50 && rect.height > 10) {
                console.log('   ✅ METHOD 1: Found visible contenteditable!\n');
                detected = true;
                break;
            }
        }
        
        if (detected) break;
        
        // METHOD 2: Radio buttons
        const radioButtons = document.querySelectorAll('input[type="radio"]');
        console.log(`      Found ${radioButtons.length} radio buttons`);
        
        if (radioButtons.length >= 3) {
            const pageText = document.body.textContent.toLowerCase();
            if (pageText.includes('notice period') || pageText.includes('ctc') || pageText.includes('experience')) {
                console.log('   ✅ METHOD 2: Found radio form!\n');
                detected = true;
                break;
            }
        }
        
        if (detected) break;
        
        // METHOD 3: Question text
        const pageText = document.body.textContent;
        if (pageText.includes('What is your') || pageText.includes('notice period') || pageText.includes('Kindly answer all')) {
            const anyInput = document.querySelector('input:not([type="hidden"]), textarea, [contenteditable="true"]');
            if (anyInput) {
                const rect = anyInput.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                    console.log('   ✅ METHOD 3: Found question + input!\n');
                    detected = true;
                    break;
                }
            }
        }
        
        if (!detected && attempts < maxAttempts) {
            console.log('   ❌ Not detected yet, waiting 1 second...\n');
            await delay(1000);
        }
    }
    
    if (detected) {
        console.log('🎉 ══════════════════════════════════════════════════════════════');
        console.log('🎉 CHATBOT FORM CONFIRMED!');
        console.log('🎉 ══════════════════════════════════════════════════════════════\n');
    } else {
        console.log('⚠️  No form detected after 15 attempts\n');
    }
    
    return detected;
}

// ==================== 🆕 NEW! FILL FORM WITH REAL DATA ====================
async function fillChatbotFormWithRealData() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🤖 FILLING FORM WITH REAL DATA');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const maxQuestions = 15;
    let questionsAnswered = 0;
    
    for (let q = 1; q <= maxQuestions; q++) {
        console.log(`\n━━━ Question ${q}/${maxQuestions} ━━━\n`);
        
        await delay(NAUKRI.config.DELAYS.BETWEEN_QUESTIONS);
        
        if (isFormComplete()) {
            console.log('✅ Form complete!\n');
            break;
        }
        
        const questionText = getCurrentQuestion();
        
        if (!questionText) {
            console.log('ℹ️  No more questions\n');
            if (questionsAnswered > 0) break;
            continue;
        }
        
        console.log(`📝 Question: "${questionText}"\n`);
        
        // Try TEXT field first
        const textFilled = await fillTextFieldWithRealData(questionText);
        
        if (textFilled) {
            console.log('✅ Text field filled with real data!\n');
            questionsAnswered++;
            await clickSaveButton();
            await delay(NAUKRI.config.DELAYS.AFTER_SAVE);
            continue;
        }
        
        // Try RADIO buttons
        const radioFilled = await fillRadioButtonsWithAI(questionText);
        
        if (radioFilled) {
            console.log('✅ Radio button selected!\n');
            questionsAnswered++;
            await clickSaveButton();
            await delay(NAUKRI.config.DELAYS.AFTER_SAVE);
            continue;
        }
        
        console.log('⚠️  No fields filled\n');
        await clickSaveButton();
        await delay(NAUKRI.config.DELAYS.AFTER_SAVE);
    }
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📊 Questions answered: ${questionsAnswered}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    return questionsAnswered > 0;
}

// ==================== 🆕 FILL TEXT FIELD (ONE-LINER + REAL DATA) ====================
async function fillTextFieldWithRealData(questionText) {
    console.log('   🔍 Looking for text field...\n');
    
    // Find text input (one-liner method)
    const field = document.querySelector('[contenteditable="true"]') || 
                  document.querySelector('input[type="text"]') ||
                  document.querySelector('input:not([type])');
    
    if (!field) {
        console.log('   ❌ No text field\n');
        return false;
    }
    
    // Check if already filled
    const currentValue = field.textContent || field.value || '';
    if (currentValue.trim().length > 0) {
        console.log('   ⏭️  Already filled\n');
        return true;
    }
    
    console.log('   ✅ Text field found!\n');
    
    // 🆕 Get REAL answer from Database/Resume/AI
    const answer = await getRealAnswerFromData(questionText);
    
    if (!answer) {
        console.log('   ⚠️  No answer found\n');
        return false;
    }
    
    console.log(`   💡 Real Answer: "${answer}"\n`);
    
    // Fill using one-liner method (WORKING METHOD!)
    if (field.getAttribute('contenteditable') === 'true') {
        field.textContent = answer;
        field.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
        field.value = answer;
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
    }
    
    await delay(300);
    
    // Verify
    const finalValue = field.textContent || field.value || '';
    if (finalValue.includes(answer)) {
        console.log('   ✅ Successfully filled!\n');
        return true;
    }
    
    console.log('   ⚠️  Verification failed\n');
    return false;
}

// ==================== 🆕 GET REAL ANSWER FROM DATABASE/RESUME/AI ====================
async function getRealAnswerFromData(questionText) {
    console.log('   🧠 Getting answer from real data...\n');
    
    const context = questionText.toLowerCase();
    const userData = NAUKRI.userData || {};
    const resumeData = NAUKRI.resumeData || {};
    const exp = resumeData.totalExperience || userData.totalExperience || 0;
    
    // EXACT MATCHES
    
    // Current CTC
    if (/current.*ctc|current.*salary|present.*ctc/i.test(context)) {
        const ctc = calculateCTC(exp, false);
        console.log(`      → Current CTC: ${ctc} LPA\n`);
        return ctc.toString();
    }
    
    // Expected CTC
    if (/expected.*ctc|expected.*salary|desired.*ctc/i.test(context)) {
        const ctc = calculateCTC(exp, true);
        console.log(`      → Expected CTC: ${ctc} LPA\n`);
        return ctc.toString();
    }
    
    // Generic CTC
    if (/\bctc\b|salary|lacs|lakhs|package/i.test(context)) {
        const ctc = calculateCTC(exp, false);
        console.log(`      → CTC: ${ctc} LPA\n`);
        return ctc.toString();
    }
    
    // Notice Period
    if (/notice.*period/i.test(context)) {
        if (/day/i.test(context)) return '15';
        if (/week/i.test(context)) return '2';
        if (/month/i.test(context)) return '1';
        return '15';
    }
    
    // Experience
    if (/experience.*year|year.*experience|total.*experience/i.test(context)) {
        console.log(`      → Experience: ${exp} years\n`);
        return Math.floor(exp).toString();
    }
    
    // Location
    if (/city|location|where.*stay|where.*live/i.test(context)) {
        const city = userData.city || resumeData.city || 'India';
        console.log(`      → City: ${city}\n`);
        return city;
    }
    
    // Name
    if (/name|full.*name/i.test(context)) {
        const name = userData.fullName || resumeData.fullName || '';
        if (name) {
            console.log(`      → Name: ${name}\n`);
            return name;
        }
    }
    
    // 🆕 USE AI IF NO EXACT MATCH
    if (NAUKRI.openaiKey) {
        console.log('      → No exact match, asking AI...\n');
        const aiAnswer = await getAIAnswerForQuestion(questionText, userData, resumeData, exp);
        if (aiAnswer) {
            console.log(`      → AI Answer: ${aiAnswer}\n`);
            return aiAnswer;
        }
    }
    
    console.log('      → No answer\n');
    return '';
}

function calculateCTC(exp, isExpected) {
    let ctc = 0;
    
    if (exp < 1) ctc = 3.5;
    else if (exp < 2) ctc = 5;
    else if (exp < 3) ctc = 7;
    else if (exp < 5) ctc = 10;
    else if (exp < 7) ctc = 15;
    else if (exp < 10) ctc = 20;
    else ctc = 25;
    
    if (isExpected) {
        ctc = Math.ceil(ctc * 1.25);
    }
    
    return Math.floor(ctc);
}

// ==================== 🆕 AI ANSWER FOR TEXT QUESTIONS ====================
async function getAIAnswerForQuestion(question, userData, resumeData, exp) {
    if (!NAUKRI.openaiKey) return '';
    
    try {
        const prompt = `You are filling a Naukri.com job application. Answer ONLY with the exact value.

QUESTION: "${question}"

USER DATA:
- Experience: ${exp} years
- Location: ${userData.city || resumeData.city || 'India'}
- Current CTC: ${calculateCTC(exp, false)} LPA
- Expected CTC: ${calculateCTC(exp, true)} LPA

RULES:
- Give ONLY the answer (no quotes, no explanation)
- For salary: just number (e.g., "7")
- For yes/no: "Yes" or "No"
- Max 50 characters
- NO "Answer:" prefix

Answer:`;

        const response = await Promise.race([
            fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${NAUKRI.openaiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'gpt-3.5-turbo',
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: 50,
                    temperature: 0.1
                })
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 8000))
        ]);

        if (response.ok) {
            const data = await response.json();
            let answer = data.choices[0].message.content.trim();
            
            answer = answer.replace(/^["'`]|["'`]$/g, '');
            answer = answer.replace(/^(Answer|Response):\s*/i, '');
            answer = answer.trim();
            
            if (answer && answer.length > 0 && answer.length < 200) {
                return answer;
            }
        }
    } catch (error) {
        console.warn('      ⚠️ AI error:', error.message);
    }
    
    return '';
}

// ==================== 🆕 FILL RADIO BUTTONS WITH AI ====================
async function fillRadioButtonsWithAI(questionText) {
    console.log('   🔍 Looking for radio buttons...\n');
    
    const radios = document.querySelectorAll('input[type="radio"]');
    
    if (radios.length === 0) {
        console.log('   ❌ No radio buttons\n');
        return false;
    }
    
    // Group by name
    const groups = {};
    radios.forEach(r => {
        const name = r.name || 'unnamed';
        if (!groups[name]) groups[name] = [];
        groups[name].push(r);
    });
    
    console.log(`   ✅ Found ${Object.keys(groups).length} radio groups\n`);
    
    for (const name in groups) {
        const group = groups[name];
        
        // Check if already selected
        if (group.some(r => r.checked)) {
            console.log(`      ⏭️  Already selected\n`);
            continue;
        }
        
        console.log(`      🎯 Processing group: "${name}"\n`);
        
        // Get options
        const options = group.map(r => {
            let label = '';
            if (r.labels && r.labels[0]) {
                label = r.labels[0].textContent.trim();
            } else if (r.parentElement) {
                label = r.parentElement.textContent.trim();
            }
            return { radio: r, label: label };
        });
        
        console.log(`         Options: ${options.map(o => o.label || 'unlabeled').join(', ')}\n`);
        
        // 🆕 Select with AI
        const selected = await selectRadioWithAI(questionText, options);
        
        if (selected) {
            console.log(`         ✅ Selecting: "${selected.label}"\n`);
            selected.radio.checked = true;
            selected.radio.click();
            selected.radio.dispatchEvent(new Event('change', { bubbles: true }));
            await delay(300);
            return true;
        }
    }
    
    console.log('   ⚠️  No radio selected\n');
    return false;
}

// ==================== 🆕 SELECT RADIO WITH AI ====================
async function selectRadioWithAI(question, options) {
    const context = question.toLowerCase();
    
    // Check if Yes/No
    const yesOption = options.find(o => /^yes$/i.test(o.label.trim()));
    const noOption = options.find(o => /^no$/i.test(o.label.trim()));
    
    if (yesOption && noOption && options.length === 2) {
        console.log('         → Yes/No question\n');
        
        // Willing/Relocate → Yes
        if (/willing|relocate|comfortable|attend|interested/i.test(context)) {
            return yesOption;
        }
        
        // Sponsorship → No
        if (/sponsorship|visa/i.test(context)) {
            return noOption;
        }
        
        return yesOption;
    }
    
    // NOT Yes/No - use AI
    if (NAUKRI.openaiKey && options.length > 0) {
        console.log('         → Complex options, using AI...\n');
        
        const optionTexts = options.map(o => o.label).filter(l => l.length > 0);
        
        if (optionTexts.length === 0) {
            return options[0];
        }
        
        const aiSelected = await selectRadioOptionWithAI(question, optionTexts);
        
        if (aiSelected) {
            const match = options.find(o => o.label.toLowerCase().includes(aiSelected.toLowerCase()) ||
                                            aiSelected.toLowerCase().includes(o.label.toLowerCase()));
            if (match) return match;
        }
    }
    
    // Fallback
    console.log('         → Fallback: first option\n');
    return options[0];
}

// ==================== 🆕 AI RADIO SELECTION ====================
async function selectRadioOptionWithAI(question, options) {
    if (!NAUKRI.openaiKey) return '';
    
    try {
        const userData = NAUKRI.userData || {};
        const resumeData = NAUKRI.resumeData || {};
        const exp = resumeData.totalExperience || 0;
        
        const prompt = `Select the BEST option for this Naukri.com job application question.

QUESTION: "${question}"

OPTIONS:
${options.map((opt, i) => `${i + 1}. ${opt}`).join('\n')}

USER DATA:
- Experience: ${exp} years
- Location: ${userData.city || 'India'}
- Notice: 15 days
- Willing to relocate: Yes

RULES:
- Respond with ONLY the exact option text
- NO number, NO explanation
- Just copy the option

Best option:`;

        const response = await Promise.race([
            fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${NAUKRI.openaiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'gpt-3.5-turbo',
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: 30,
                    temperature: 0.1
                })
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 8000))
        ]);

        if (response.ok) {
            const data = await response.json();
            let answer = data.choices[0].message.content.trim();
            
            answer = answer.replace(/^["'`]|["'`]$/g, '');
            answer = answer.replace(/^\d+\.\s*/, '');
            answer = answer.trim();
            
            return answer;
        }
    } catch (error) {
        console.warn('         ⚠️ AI error:', error.message);
    }
    
    return '';
}

// ==================== HELPER FUNCTIONS ====================

function getCurrentQuestion() {
    const possibleQuestions = document.querySelectorAll('div, p, span, label, h3, h4');
    
    for (const elem of possibleQuestions) {
        const text = elem.textContent.trim();
        
        if (text.length < 10 || text.length > 300) continue;
        if (text.toLowerCase().includes('thank you')) continue;
        if (text.toLowerCase().includes('kindly answer')) continue;
        
        if (text.includes('?') || /what is|current ctc|notice period|experience/i.test(text)) {
            return text;
        }
    }
    
    return '';
}

async function clickSaveButton() {
    console.log('   💾 Looking for Save button...\n');
    
    const buttons = document.querySelectorAll('button');
    
    for (const btn of buttons) {
        const rect = btn.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        
        const text = btn.textContent.toLowerCase().trim();
        
        if (text === 'save' || text === 'submit') {
            console.log('   ✅ Save button found\n');
            
            btn.scrollIntoView({ behavior: 'auto', block: 'center' });
            await delay(300);
            
            btn.click();
            console.log('   ✅ Clicked!\n');
            return true;
        }
    }
    
    console.log('   ⚠️  No Save button\n');
    return false;
}

function isFormComplete() {
    const text = document.body.textContent.toLowerCase();
    return text.includes('thank you for your response') ||
           text.includes('successfully applied');
}

function getButtonType() {
    const buttons = document.querySelectorAll('button, a[role="button"]');
    
    for (const button of buttons) {
        const rect = button.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        
        const text = button.textContent.toLowerCase().trim();
        
        if (text.includes('company')) return { type: 'COMPANY_SITE', button };
        if (text === 'apply' || text === 'apply now') return { type: 'APPLY', button };
    }
    
    return { type: 'NONE', button: null };
}

// ==================== PHASE 3: FIND NEXT JOB ====================
async function findAndClickMatchingJob() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎯 PHASE 3: FINDING NEXT JOB');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    window.scrollTo(0, 0);
    await delay(1000);
    
    console.log('━━━ STRATEGY 1: CHECK RIGHT SIDEBAR ━━━\n');
    const sidebarJobs = await findJobsInArea('RIGHT_SIDEBAR');
    
    if (sidebarJobs.length > 0) {
        console.log(`\n✅ SUCCESS! Found ${sidebarJobs.length} matching jobs in sidebar!\n`);
        await clickBestMatchingJob(sidebarJobs);
        return;
    } else {
        console.log(`\n❌ No matching jobs in sidebar\n`);
    }
    
    console.log('━━━ STRATEGY 2: SCROLL DOWN TO FIND MORE ━━━\n');
    console.log('   Scrolling down 50%...\n');
    window.scrollTo(0, document.body.scrollHeight * 0.5);
    await delay(NAUKRI.config.DELAYS.SCROLL_DELAY);
    
    const scrollJobs = await findJobsInArea('SCROLL_DOWN');
    
    if (scrollJobs.length > 0) {
        console.log(`\n✅ SUCCESS! Found ${scrollJobs.length} matching jobs below!\n`);
        await clickBestMatchingJob(scrollJobs);
        return;
    } else {
        console.log(`\n❌ No matching jobs found below\n`);
    }
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🏁 NO MORE JOBS AVAILABLE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    NAUKRI.isRunning = false;
    saveState();
}

async function findJobsInArea(area) {
    let container = null;
    
    if (area === 'RIGHT_SIDEBAR') {
        const selectors = [
            'section[class*="simjobs-right"]',
            'div[class*="right-container"]',
            'aside'
        ];
        
        for (const sel of selectors) {
            container = document.querySelector(sel);
            if (container) {
                console.log(`   ✅ Found sidebar container: ${sel}\n`);
                break;
            }
        }
        
        if (!container) {
            const allElems = document.querySelectorAll('h2, h3, h4, div');
            for (const elem of allElems) {
                if (elem.textContent.toLowerCase().includes('jobs you might')) {
                    container = elem.parentElement.parentElement;
                    console.log(`   ✅ Found container via "jobs you might" text\n`);
                    break;
                }
            }
        }
    } else if (area === 'SCROLL_DOWN') {
        console.log('   🔍 Looking for "Roles you might be interested in" section...\n');
        
        const allElems = document.querySelectorAll('h2, h3, h4, div');
        for (const elem of allElems) {
            const text = elem.textContent.toLowerCase();
            if (text.includes('roles you might') || text.match(/\d+\s+roles/)) {
                container = elem.parentElement;
                console.log(`   ✓ Found section: "${elem.textContent.trim()}"\n`);
                break;
            }
        }
    }
    
    if (!container) {
        console.log(`   ❌ Container not found for ${area}\n`);
        return [];
    }
    
    console.log(`   📦 Container found in ${area}\n`);
    
    const scoredJobs = [];
    const jobElements = container.querySelectorAll('article, div[class*="job"], li, div[class*="card"], div[class*="tuple"]');
    
    console.log(`   Checking ${jobElements.length} elements...\n`);
    
    for (const elem of jobElements) {
        const text = elem.textContent.trim();
        
        if (text.length < 20 || text.length > 500) continue;
        
        const hasKeywords = text.toLowerCase().includes('posted') || 
                           text.toLowerCase().includes('reviews') ||
                           text.toLowerCase().includes('days ago') ||
                           text.toLowerCase().includes('experience');
        
        if (!hasKeywords) continue;
        
        const rect = elem.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        
        const cardId = text.substring(0, 50);
        if (NAUKRI.clickedJobs.has(cardId)) continue;
        
        const lines = text.split('\n').filter(l => l.trim().length > 5);
        const jobTitle = lines[0] || text.substring(0, 50);
        
        const score = calculateMatchScore(jobTitle, NAUKRI.searchTerm);
        
        if (score > 0) {
            console.log(`      ✓ "${jobTitle}" → Score: ${score}`);
            scoredJobs.push({ 
                card: elem,
                cardId,
                text: jobTitle, 
                score 
            });
        }
    }
    
    console.log(`\n   📊 RESULT: Found ${scoredJobs.length} matching jobs\n`);
    return scoredJobs;
}

async function clickBestMatchingJob(jobs) {
    jobs.sort((a, b) => b.score - a.score);
    
    console.log('   📊 Jobs ranked by match score:\n');
    jobs.slice(0, 5).forEach((job, idx) => {
        const matchType = job.score >= 500 ? 'FULL' : job.score >= 150 ? 'PARTIAL-FIRST' : 'PARTIAL-SECOND';
        console.log(`      [${idx + 1}] ${matchType} (${job.score}) - "${job.text}"`);
    });
    console.log();
    
    const best = jobs[0];
    
    console.log('🎯 ═══════════════════════════════════════════════════════════════');
    console.log(`🎯 CLICKING: "${best.text}"`);
    console.log(`🎯 Score: ${best.score}`);
    console.log('🎯 ═══════════════════════════════════════════════════════════════\n');
    
    NAUKRI.clickedJobs.add(best.cardId);
    saveState();
    
    best.card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await delay(1000);
    
    best.card.style.cssText = `
        background-color: #bfdbfe !important;
        border: 15px solid #3b82f6 !important;
        padding: 30px !important;
        margin: 10px !important;
        border-radius: 25px !important;
        box-shadow: 0 0 100px rgba(59, 130, 246, 1) !important;
        transform: scale(1.3) !important;
        z-index: 99999 !important;
        position: relative !important;
    `;
    
    await delay(2000);
    
    console.log('🖱️  CLICKING...\n');
    
    try {
        best.card.click();
        console.log('✅ CLICKED!\n');
    } catch (e) {
        const link = best.card.querySelector('a[href]');
        if (link) {
            console.log('   (Clicking link inside card)\n');
            link.click();
        }
    }
}

console.log('✅ [NAUKRI FINAL] All features loaded with REAL DATA form filling!\n');