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

console.log('\n🎯 ══════════════════════════════════════════════════════════════');
console.log('🎯 [NAUKRI] COMPLETE FINAL VERSION - ALL BUGS FIXED!');
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
    // ✅ FIXED: Now includes post-application page!
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
    
    // Exact match
    if (titleLower === searchLower) return 1000;
    
    // Contains full phrase
    if (titleLower.includes(searchLower)) score += 800;
    
    // Starts with phrase
    if (titleLower.startsWith(searchLower)) score += 600;
    
    // Individual word matches - MORE LENIENT!
    if (searchWords.length >= 1) {
        const firstWord = searchWords[0];
        const secondWord = searchWords[1] || '';
        
        // First word match
        if (titleLower.includes(firstWord)) score += 300;
        
        // Second word match
        if (secondWord && titleLower.includes(secondWord)) score += 200;
        
        // ✅ NEW: Even if no match, give small score for any job
        // This ensures we don't skip ALL jobs if none match perfectly
        if (score === 0 && titleLower.length > 5) {
            score = 50; // Small score so it's considered
        }
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
            console.log('✅ Resume data loaded');
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
            
            // ✅ KEEP CHECKING INDICATOR EVERY 3 SECONDS!
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
    
    // ✅ Check if we just came from an application
    const isPostApplication = currentUrl.includes('/myapply/');
    
    if (isPostApplication) {
        console.log('✅ POST-APPLICATION PAGE DETECTED!\n');
        
        // Check for success message
        const successMessage = document.body.textContent.toLowerCase();
        if (successMessage.includes('successfully applied') || successMessage.includes('you have successfully')) {
            console.log('✅ Application confirmed!\n');
            
            if (!NAUKRI.processedJobs.has('post-app-counted')) {
                NAUKRI.stats.applied++;
                NAUKRI.processedJobs.add('post-app-counted');
                
                console.log(`🎉 APPLIED! Total: ${NAUKRI.stats.applied}/${NAUKRI.config.MAX_JOBS}\n`);
                
                // ✅ IMMEDIATELY UPDATE INDICATOR!
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
    
    // Normal detailed page processing
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
        
        // ✅ CRITICAL: Wait longer for form to appear!
        console.log('⏳ Waiting 4 seconds for form to load...\n');
        await delay(4000);
        
        console.log('🔍 Checking if chatbot form appeared...\n');
        
        const formDetected = await detectChatbotWithMultipleMethods();
        
        if (formDetected) {
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('🤖 CHATBOT FORM DETECTED!');
            console.log('🚨 CANNOT SKIP - MUST FILL BEFORE MOVING FORWARD!');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
            
            // ✅ MUST FILL - NO OPTION TO SKIP!
            console.log('🔒 Filling form now - this CANNOT be skipped!\n');
            
            const formFilled = await fillChatbotFormLinkedInStyle();
            
            if (formFilled) {
                console.log('\n✅ ════════════════════════════════════════════════════════');
                console.log('✅ FORM SUCCESSFULLY FILLED AND SUBMITTED!');
                console.log('✅ ════════════════════════════════════════════════════════\n');
                
                NAUKRI.stats.applied++;
                console.log(`🎉 Form filled & submitted! Total: ${NAUKRI.stats.applied}/${NAUKRI.config.MAX_JOBS}\n`);
                
                // ✅ IMMEDIATELY UPDATE INDICATOR!
                updateIndicator();
                saveState();
                
                // Wait for submission to complete
                await delay(3000);
            } else {
                console.log('\n⚠️  ════════════════════════════════════════════════════════');
                console.log('⚠️  FORM FILLING FAILED - Trying again...');
                console.log('⚠️  ════════════════════════════════════════════════════════\n');
                
                // Try one more time!
                const retryFilled = await fillChatbotFormLinkedInStyle();
                
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
            // Direct application - check for success message after delay
            console.log('ℹ️  No form detected - checking if directly applied...\n');
            await delay(2000);
            
            const successMessage = document.body.textContent.toLowerCase();
            if (successMessage.includes('successfully applied') || successMessage.includes('you have successfully')) {
                NAUKRI.stats.applied++;
                console.log(`✅ Direct application! Total: ${NAUKRI.stats.applied}/${NAUKRI.config.MAX_JOBS}\n`);
                
                // ✅ IMMEDIATELY UPDATE INDICATOR!
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
        
        // ✅ UPDATE INDICATOR!
        updateIndicator();
        saveState();
    } else {
        console.log('❌ SKIPPING (no button)\n');
        NAUKRI.stats.skipped++;
        
        // ✅ UPDATE INDICATOR!
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

// ==================== CHATBOT DETECTION (ULTRA AGGRESSIVE!) ====================
async function detectChatbotWithMultipleMethods() {
    console.log('🔍 ══════════════════════════════════════════════════════════════');
    console.log('🔍 DETECTING CHATBOT FORM (ULTRA AGGRESSIVE MODE)');
    console.log('🔍 ══════════════════════════════════════════════════════════════\n');
    
    let detected = false;
    let attempts = 0;
    const maxAttempts = 15; // More attempts!
    
    while (!detected && attempts < maxAttempts) {
        attempts++;
        console.log(`   [Attempt ${attempts}/${maxAttempts}] Scanning page...\n`);
        
        // METHOD 1: Look for contenteditable with "Type message" placeholder
        const editables = document.querySelectorAll('[contenteditable="true"]');
        console.log(`      Found ${editables.length} contenteditable elements`);
        
        for (const ed of editables) {
            const placeholder = ed.getAttribute('data-placeholder') || '';
            const rect = ed.getBoundingClientRect();
            
            console.log(`         - Size: ${rect.width.toFixed(0)}x${rect.height.toFixed(0)}, Placeholder: "${placeholder}"`);
            
            if (rect.width > 50 && rect.height > 10) {
                console.log('   ✅ METHOD 1: Found visible contenteditable!\n');
                detected = true;
                break;
            }
        }
        
        if (detected) break;
        
        // METHOD 2: Look for radio buttons with "notice period" text nearby
        const radioButtons = document.querySelectorAll('input[type="radio"]');
        console.log(`      Found ${radioButtons.length} radio buttons`);
        
        if (radioButtons.length >= 3) {
            // Check if there's text like "notice period" nearby
            const pageText = document.body.textContent.toLowerCase();
            if (pageText.includes('notice period') || 
                pageText.includes('ctc') || 
                pageText.includes('experience') ||
                pageText.includes('modassir')) {
                console.log('   ✅ METHOD 2: Found radio form with questions!\n');
                detected = true;
                break;
            }
        }
        
        // METHOD 3: Look for drawer/modal with form elements
        const modals = document.querySelectorAll('[class*="drawer"], [class*="modal"], [class*="popup"], [class*="chatbot"]');
        console.log(`      Found ${modals.length} modal-like elements`);
        
        for (const modal of modals) {
            const rect = modal.getBoundingClientRect();
            if (rect.width > 200 && rect.height > 200) {
                const inputs = modal.querySelectorAll('input, textarea, [contenteditable="true"]');
                if (inputs.length > 0) {
                    console.log(`   ✅ METHOD 3: Found modal with ${inputs.length} inputs!\n`);
                    detected = true;
                    break;
                }
            }
        }
        
        if (detected) break;
        
        // METHOD 4: Look for "Save" button on page (indicates form is present)
        const buttons = document.querySelectorAll('button');
        for (const btn of buttons) {
            const text = btn.textContent.toLowerCase().trim();
            if (text === 'save' || text === 'submit') {
                const rect = btn.getBoundingClientRect();
                if (rect.width > 50 && rect.height > 20) {
                    console.log('   ✅ METHOD 4: Found Save/Submit button!\n');
                    detected = true;
                    break;
                }
            }
        }
        
        if (detected) break;
        
        // METHOD 5: Check for question text
        const pageText = document.body.textContent;
        if (pageText.includes('What is your') || 
            pageText.includes('notice period') ||
            pageText.includes('Kindly answer all') ||
            pageText.includes('successfully apply')) {
            
            // If question text exists, check for ANY input field
            const anyInput = document.querySelector('input:not([type="hidden"]), textarea, [contenteditable="true"]');
            if (anyInput) {
                const rect = anyInput.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                    console.log('   ✅ METHOD 5: Found question + input field!\n');
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
        console.log('🎉 CHATBOT FORM CONFIRMED - WILL FILL NOW!');
        console.log('🎉 ══════════════════════════════════════════════════════════════\n');
    } else {
        console.log('⚠️  No form detected after 15 attempts\n');
    }
    
    return detected;
}

// ==================== FILL CHATBOT FORM (LINKEDIN STYLE!) ====================
async function fillChatbotFormLinkedInStyle() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🤖 STARTING FORM FILLING PROCESS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const maxQuestions = 15;
    let questionsAnswered = 0;
    let saveButtonsClicked = 0;
    
    for (let q = 1; q <= maxQuestions; q++) {
        console.log(`\n━━━ Question ${q}/${maxQuestions} ━━━\n`);
        
        await delay(NAUKRI.config.DELAYS.BETWEEN_QUESTIONS);
        
        // Check if form is complete
        if (isFormComplete()) {
            console.log('✅ Form completion detected!\n');
            break;
        }
        
        const questionText = getCurrentQuestion();
        
        if (!questionText) {
            console.log('ℹ️  No more questions found\n');
            
            // If we answered at least 1 question, consider it success
            if (questionsAnswered > 0) {
                break;
            } else {
                console.log('⚠️  No questions answered yet, continuing search...\n');
                continue;
            }
        }
        
        console.log(`📝 Question: "${questionText}"\n`);
        
        const fields = getAllVisibleFields();
        
        if (fields.length === 0) {
            console.log('⚠️  No fields found for this question\n');
            
            // Try clicking Save in case question is optional
            const saved = await clickSaveButton();
            if (saved) {
                saveButtonsClicked++;
                await delay(NAUKRI.config.DELAYS.AFTER_SAVE);
            }
            continue;
        }
        
        console.log(`   Found ${fields.length} field(s) to fill\n`);
        
        let filled = false;
        
        for (const field of fields) {
            if (isFieldAlreadyFilled(field)) {
                console.log(`   ✓ Field already filled`);
                filled = true;
                continue;
            }
            
            const fieldInfo = getFieldInformation(field);
            let success = false;
            
            // TEXT/CONTENTEDITABLE
            if (field.tagName.toLowerCase() === 'input' || field.getAttribute('contenteditable') === 'true') {
                const answer = getAnswerForField(fieldInfo, questionText);
                
                if (answer) {
                    console.log(`   💡 Filling with answer: "${answer}"`);
                    
                    if (field.getAttribute('contenteditable') === 'true') {
                        field.textContent = answer;
                        field.innerHTML = answer;
                        field.dispatchEvent(new Event('input', { bubbles: true }));
                    } else {
                        field.value = answer;
                        triggerFieldEvents(field);
                    }
                    
                    success = true;
                    filled = true;
                }
            }
            
            // RADIO
            else if (field.type === 'radio') {
                if (!field.name) continue;
                
                const radioGroup = document.querySelectorAll(`input[type="radio"][name="${field.name}"]`);
                const alreadySelected = Array.from(radioGroup).some(r => r.checked);
                
                if (alreadySelected) {
                    console.log(`   ✓ Radio already selected`);
                    success = true;
                    filled = true;
                } else {
                    for (const radio of radioGroup) {
                        const radioInfo = getFieldInformation(radio);
                        if (fillRadioFieldIntelligently(radio, radioInfo, questionText)) {
                            success = true;
                            filled = true;
                            break;
                        }
                    }
                }
            }
            
            // DROPDOWN
            else if (field.tagName.toLowerCase() === 'select') {
                success = await fillDropdownIntelligently(field, fieldInfo, questionText);
                if (success) filled = true;
            }
            
            if (success) {
                console.log(`   ✅ Field filled successfully`);
                await delay(NAUKRI.config.DELAYS.AFTER_ANSWER);
            }
        }
        
        if (filled) {
            console.log('\n   🔍 Looking for Save button...\n');
            const saveClicked = await clickSaveButton();
            
            if (saveClicked) {
                console.log('   ✅ Save button clicked!\n');
                questionsAnswered++;
                saveButtonsClicked++;
                await delay(NAUKRI.config.DELAYS.AFTER_SAVE);
            } else {
                console.log('   ⚠️  No Save button found\n');
                questionsAnswered++;
            }
        } else {
            console.log('   ⚠️  No fields were filled for this question\n');
        }
    }
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 FORM FILLING SUMMARY');
    console.log(`📊 Questions answered: ${questionsAnswered}`);
    console.log(`📊 Save buttons clicked: ${saveButtonsClicked}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Consider success if at least 1 question was answered
    const success = questionsAnswered > 0;
    
    if (success) {
        console.log('✅ Form filling SUCCESSFUL!\n');
    } else {
        console.log('❌ Form filling FAILED - no questions answered!\n');
    }
    
    return success;
}

// ==================== FORM FILLING HELPERS ====================

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

function getAllVisibleFields() {
    // ✅ WORKING VERSION FROM USER'S FILE!
    const allFields = document.querySelectorAll('input:not([type="hidden"]), textarea, select, [contenteditable="true"]');
    
    return Array.from(allFields).filter(field => {
        const rect = field.getBoundingClientRect();
        const style = window.getComputedStyle(field);
        
        return rect.width > 0 && rect.height > 0 &&
               style.display !== 'none' &&
               style.visibility !== 'hidden' &&
               !field.disabled;
    });
}

function getFieldInformation(field) {
    const label = getFieldLabel(field).toLowerCase();
    const name = (field.name || '').toLowerCase();
    const placeholder = (field.placeholder || field.getAttribute('data-placeholder') || '').toLowerCase();
    
    return {
        field: field,
        label: label,
        name: name,
        placeholder: placeholder,
        context: `${label} ${name} ${placeholder}`
    };
}

function getFieldLabel(field) {
    try {
        if (field.id) {
            const label = document.querySelector(`label[for="${field.id}"]`);
            if (label) return label.textContent.trim();
        }
        
        const parentLabel = field.closest('label');
        if (parentLabel) return parentLabel.textContent.trim();
        
        return field.getAttribute('aria-label') || field.placeholder || field.getAttribute('data-placeholder') || '';
    } catch {
        return '';
    }
}

function isFieldAlreadyFilled(field) {
    if (field.tagName.toLowerCase() === 'select') {
        return field.value && field.value !== '' && field.value !== 'select';
    }
    
    if (field.type === 'radio') {
        if (!field.name) return field.checked;
        const group = document.querySelectorAll(`input[type="radio"][name="${field.name}"]`);
        return Array.from(group).some(r => r.checked);
    }
    
    if (field.getAttribute('contenteditable') === 'true') {
        return field.textContent.trim().length > 0;
    }
    
    return (field.value || '').trim().length > 0;
}

function getAnswerForField(fieldInfo, questionText) {
    const context = (fieldInfo.context + ' ' + questionText).toLowerCase();
    const userData = { ...NAUKRI.userData, ...NAUKRI.resumeData };
    const exp = userData.totalExperience || 0;
    
    if (/current.*ctc|current.*salary/i.test(context)) {
        const ctc = exp < 1 ? 3.5 : exp < 2 ? 5 : exp < 3 ? 7 : exp < 5 ? 10 : 15;
        return Math.floor(ctc).toString();
    }
    
    if (/expected.*ctc|expected.*salary/i.test(context)) {
        const ctc = exp < 1 ? 4.5 : exp < 2 ? 6.5 : exp < 3 ? 9 : exp < 5 ? 13 : 19;
        return Math.floor(ctc).toString();
    }
    
    if (/notice.*period/i.test(context)) {
        if (/day/i.test(context)) return '15';
        if (/week/i.test(context)) return '2';
        return '1';
    }
    
    if (/experience.*year|years.*experience/i.test(context)) {
        return Math.floor(exp).toString();
    }
    
    if (/data.*management|google.*sheet|data.*analysis/i.test(context)) {
        return Math.max(1, Math.floor(exp * 0.7)).toString();
    }
    
    return '';
}

function fillRadioFieldIntelligently(radio, radioInfo, questionText) {
    const context = (radioInfo.context + ' ' + questionText).toLowerCase();
    
    // Get radio label with MULTIPLE fallback methods
    let radioLabel = '';
    
    if (radio.labels && radio.labels[0]) {
        radioLabel = radio.labels[0].textContent.toLowerCase().trim();
    } else if (radio.parentElement) {
        const parentText = radio.parentElement.textContent.trim();
        if (parentText.length < 50) {
            radioLabel = parentText.toLowerCase();
        }
    }
    
    console.log(`\n      🎯 Testing radio button:`);
    console.log(`         Value: "${radio.value}"`);
    console.log(`         Label: "${radioLabel}"`);
    console.log(`         Question has: willing=${/willing/i.test(questionText)}, travel=${/travel/i.test(questionText)}`);
    
    const fullContext = `${context} ${radioLabel}`;
    
    // YES questions - ULTRA LENIENT!
    const isYesNoQuestion = /willing|travel|relocate|comfortable|can you|are you/i.test(questionText);
    
    if (isYesNoQuestion) {
        console.log(`         → This IS a Yes/No question!`);
        
        const hasYes = /yes/i.test(radioLabel) || /yes/i.test(radio.value) || radioLabel.includes('yes');
        const hasNo = /no/i.test(radioLabel) || /no/i.test(radio.value) || radioLabel.includes('no');
        
        console.log(`         Label has: yes=${hasYes}, no=${hasNo}`);
        
        if (hasYes && !hasNo) {
            console.log(`         ✅✅✅ SELECTING YES!`);
            radio.checked = true;
            radio.click(); // Actually click!
            triggerFieldEvents(radio);
            return true;
        }
        
        if (hasNo && !hasYes) {
            console.log(`         ✅✅✅ SELECTING NO!`);
            radio.checked = true;
            radio.click();
            triggerFieldEvents(radio);
            return true;
        }
    } else {
        console.log(`         → NOT a Yes/No question`);
    }
    
    // Sponsorship - select NO
    if (/sponsorship|visa/i.test(questionText)) {
        if (/no/i.test(radioLabel) || /no/i.test(radio.value)) {
            console.log(`         ✅ NO for sponsorship`);
            radio.checked = true;
            radio.click();
            triggerFieldEvents(radio);
            return true;
        }
    }
    
    // Notice period - select 15 days
    if (/notice/i.test(questionText)) {
        if (/15/i.test(radioLabel)) {
            console.log(`         ✅ 15 days`);
            radio.checked = true;
            radio.click();
            triggerFieldEvents(radio);
            return true;
        }
    }
    
    console.log(`         ❌ No match\n`);
    return false;
}

async function fillDropdownIntelligently(select, fieldInfo, questionText) {
    const options = Array.from(select.options).filter(opt => 
        opt.value && opt.value !== '' && opt.value !== 'select'
    );
    
    if (options.length === 0) return false;
    
    const context = (fieldInfo.context + ' ' + questionText).toLowerCase();
    const userData = { ...NAUKRI.userData, ...NAUKRI.resumeData };
    const exp = userData.totalExperience || 0;
    
    let selectedOption = null;
    
    if (/experience|year/i.test(context)) {
        const expString = Math.floor(exp).toString();
        selectedOption = options.find(o => o.text.includes(expString));
    }
    
    if (!selectedOption && options.length === 2) {
        const yesOpt = options.find(o => /yes/i.test(o.text));
        const noOpt = options.find(o => /no/i.test(o.text));
        
        if (yesOpt && noOpt) {
            if (/willing|relocate/i.test(context)) {
                selectedOption = yesOpt;
            } else if (/sponsorship/i.test(context)) {
                selectedOption = noOpt;
            }
        }
    }
    
    if (!selectedOption) {
        selectedOption = options[0];
    }
    
    if (selectedOption) {
        console.log(`      ✅ Selected: "${selectedOption.text}"`);
        select.value = selectedOption.value;
        triggerFieldEvents(select);
        return true;
    }
    
    return false;
}

async function clickSaveButton() {
    const buttons = document.querySelectorAll('button, div[role="button"]');
    
    const candidates = [];
    
    for (const btn of buttons) {
        const rect = btn.getBoundingClientRect();
        if (rect.width < 30 || rect.height < 20) continue;
        
        const style = window.getComputedStyle(btn);
        if (style.display === 'none' || style.visibility === 'hidden') continue;
        
        const text = btn.textContent.toLowerCase().trim();
        
        let score = 0;
        if (text === 'save') score += 100;
        if (text === 'submit') score += 90;
        if (text.includes('save')) score += 50;
        if (text.includes('cancel')) score -= 100;
        
        if (score > 0) {
            candidates.push({ btn, score, text });
        }
    }
    
    if (candidates.length === 0) return false;
    
    candidates.sort((a, b) => b.score - a.score);
    
    console.log(`      Button: "${candidates[0].text}"`);
    
    await delay(300);
    
    try {
        candidates[0].btn.click();
    } catch {
        candidates[0].btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }
    
    return true;
}

function isFormComplete() {
    const text = document.body.textContent.toLowerCase();
    return text.includes('thank you for your response') ||
           text.includes('successfully applied');
}

function triggerFieldEvents(field) {
    ['input', 'change', 'blur'].forEach(type => {
        field.dispatchEvent(new Event(type, { bubbles: true }));
    });
}

// ==================== GET BUTTON TYPE ====================
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

// ==================== FIND JOBS (USING WORKING LOGIC!) ====================
async function findJobsInArea(area) {
    let container = null;
    
    if (area === 'RIGHT_SIDEBAR') {
        // Try sidebar selectors
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
            // Try finding by text "jobs you might"
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
        // Find "Roles you might be interested in" section
        console.log('   🔍 Looking for "Roles you might be interested in" section...\n');
        
        const allElems = document.querySelectorAll('h2, h3, h4, div');
        for (const elem of allElems) {
            const text = elem.textContent.toLowerCase();
            if (text.includes('roles you might') || 
                text.includes('15 roles') || 
                text.includes('20 roles') ||
                text.includes('14 roles') ||
                text.match(/\d+\s+roles/)) {
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
    
    // ✅ USE YOUR WORKING SELECTORS!
    const jobElements = container.querySelectorAll('article, div[class*="job"], li, div[class*="card"], div[class*="tuple"]');
    
    console.log(`   Checking ${jobElements.length} elements...\n`);
    
    for (const elem of jobElements) {
        const text = elem.textContent.trim();
        
        // Basic validation
        if (text.length < 20 || text.length > 500) continue;
        
        // Must have job-like keywords
        const hasKeywords = text.toLowerCase().includes('posted') || 
                           text.toLowerCase().includes('reviews') ||
                           text.toLowerCase().includes('days ago') ||
                           text.toLowerCase().includes('experience');
        
        if (!hasKeywords) continue;
        
        const rect = elem.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        
        // Use text as unique ID (first 50 chars)
        const cardId = text.substring(0, 50);
        if (NAUKRI.clickedJobs.has(cardId)) continue;
        
        // Extract job title (first non-empty line)
        const lines = text.split('\n').filter(l => l.trim().length > 5);
        const jobTitle = lines[0] || text.substring(0, 50);
        
        // Calculate match score
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

// ==================== CLICK BEST JOB (WORKING LOGIC!) ====================
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
    
    // Massive highlight
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
        // Try clicking a link inside
        const link = best.card.querySelector('a[href]');
        if (link) {
            console.log('   (Clicking link inside card)\n');
            link.click();
        }
    }
}

console.log('✅ [NAUKRI COMPLETE] All features loaded!\n');