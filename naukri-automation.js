// ==================== NAUKRI.COM AUTOMATION - FINAL COMPLETE VERSION ====================
// ✅ Main page → Click first job
// ✅ Detailed page → Check Apply button → Click/Skip accordingly  
// ✅ Right sidebar → Click matching job with intelligent partial matching
// ✅ If no sidebar → Scroll down → Find "Roles you might be interested in"
// ✅ Green indicator on EVERY page/tab
// ✅ Partial match priority: data analyst > data scientist > associate analyst

console.log('\n🎯 ══════════════════════════════════════════════════════════════');
console.log('🎯 [NAUKRI] FINAL COMPLETE VERSION - All Features Loaded');
console.log('🎯 ══════════════════════════════════════════════════════════════\n');

// ==================== GLOBAL STATE ====================
const NAUKRI = {
    isRunning: false,
    searchTerm: '',
    clickedJobs: new Set(),
    processedJobs: new Set(),
    stats: {
        applied: 0,
        skipped: 0,
        startTime: null
    },
    config: {
        MAX_JOBS: 10,
        DELAYS: {
            PAGE_LOAD: 2000,
            AFTER_CLICK: 1500,
            BEFORE_APPLY: 1000,
            AFTER_APPLY: 2500,
            SCROLL_DELAY: 1500,
            HIGHLIGHT_DELAY: 2500
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
            !url.includes('job-listings-');
}

function isDetailedPage() {
    return window.location.href.includes('naukri.com') && window.location.href.includes('job-listings-');
}

function extractSearchTerm() {
    const url = window.location.href;
    
    // Try URL patterns
    if (url.includes('data-analyst')) return 'data analyst';
    if (url.includes('data-scientist')) return 'data scientist';
    if (url.includes('python-developer')) return 'python developer';
    
    // Try page heading
    const heading = document.querySelector('h1, h2, [class*="heading"]');
    if (heading) {
        const text = heading.textContent.toLowerCase();
        if (text.includes('jobs')) {
            return text.replace(/\s+jobs.*$/i, '').trim();
        }
    }
    
    // Try search input
    const searchInput = document.querySelector('input[placeholder*="job"], input[placeholder*="search"]');
    if (searchInput && searchInput.value) {
        return searchInput.value.toLowerCase().trim();
    }
    
    // Default
    return 'data analyst';
}

function calculateMatchScore(jobTitle, searchTerm) {
    const titleLower = jobTitle.toLowerCase();
    const searchLower = searchTerm.toLowerCase();
    const searchWords = searchLower.split(/\s+/).filter(w => w.length >= 3);
    
    let score = 0;
    
    // 1. EXACT MATCH = HIGHEST PRIORITY (1000 points)
    if (titleLower === searchLower) {
        return 1000;
    }
    
    // 2. CONTAINS EXACT PHRASE = VERY HIGH (800 points)
    if (titleLower.includes(searchLower)) {
        score += 800;
    }
    
    // 3. STARTS WITH SEARCH TERM = HIGH (600 points)
    if (titleLower.startsWith(searchLower)) {
        score += 600;
    }
    
    // 4. PARTIAL MATCHING WITH PRIORITY
    if (searchWords.length >= 2) {
        const firstWord = searchWords[0];  // e.g., "data"
        const secondWord = searchWords[1]; // e.g., "analyst"
        
        // First word match = PRIORITY 1 (300 points)
        if (titleLower.includes(firstWord)) {
            score += 300;
            
            // Bonus if title STARTS with first word (extra 100)
            if (titleLower.startsWith(firstWord)) {
                score += 100;
            }
        }
        
        // Second word match = PRIORITY 2 (200 points)
        if (titleLower.includes(secondWord)) {
            score += 200;
        }
        
        // Both words present = BONUS (extra 150)
        if (titleLower.includes(firstWord) && titleLower.includes(secondWord)) {
            score += 150;
        }
    } else if (searchWords.length === 1) {
        // Single word search
        const word = searchWords[0];
        if (titleLower.includes(word)) {
            score += 400;
            if (titleLower.startsWith(word)) {
                score += 200;
            }
        }
    }
    
    // 5. WORD BOUNDARY MATCHING (cleaner matches)
    const searchRegex = new RegExp(`\\b${searchLower}\\b`, 'i');
    if (searchRegex.test(titleLower)) {
        score += 100;
    }
    
    return score;
}

// ==================== PERSISTENT GREEN INDICATOR ====================
function createGreenIndicator() {
    // Remove existing indicator
    let indicator = document.getElementById('naukri-green-indicator');
    if (indicator) indicator.remove();
    
    // Create new indicator
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
        transition: all 0.3s ease;
    `;
    indicator.innerHTML = `
        ✅ Naukri Automation ACTIVE<br>
        <span style="font-size: 12px; opacity: 0.9;">
            Applied: <span id="naukri-applied">${NAUKRI.stats.applied}</span> | 
            Skipped: <span id="naukri-skipped">${NAUKRI.stats.skipped}</span>
        </span>
    `;
    
    document.body.appendChild(indicator);
    console.log('✅ Green indicator created and visible!\n');
}

function updateIndicator() {
    const applied = document.getElementById('naukri-applied');
    const skipped = document.getElementById('naukri-skipped');
    if (applied) applied.textContent = NAUKRI.stats.applied;
    if (skipped) skipped.textContent = NAUKRI.stats.skipped;
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
                if (data.naukri_stats) {
                    NAUKRI.stats = data.naukri_stats;
                }
                if (data.naukri_clicked) {
                    NAUKRI.clickedJobs = new Set(data.naukri_clicked);
                }
                if (data.naukri_processed) {
                    NAUKRI.processedJobs = new Set(data.naukri_processed);
                }
                console.log('📥 State loaded from storage:');
                console.log(`   Search term: "${NAUKRI.searchTerm}"`);
                console.log(`   Applied: ${NAUKRI.stats.applied}/${NAUKRI.config.MAX_JOBS}`);
                console.log(`   Skipped: ${NAUKRI.stats.skipped}\n`);
            }
            resolve(data.naukri_running);
        });
    });
}

// ==================== AUTO-INIT ====================
async function autoInit() {
    console.log('🔄 [AUTO-INIT] Page loaded, checking automation status...\n');
    console.log(`   Current URL: ${window.location.href.substring(0, 80)}...\n`);
    
    const wasRunning = await loadState();
    
    if (wasRunning) {
        console.log('✅ Automation is RUNNING - continuing on this page...\n');
        
        // ALWAYS show green indicator on Naukri pages
        if (window.location.href.includes('naukri.com')) {
            createGreenIndicator();
        }
        
        // Wait for page to fully load
        await delay(NAUKRI.config.DELAYS.PAGE_LOAD);
        
        // Determine page type and handle accordingly
        if (isMainPage()) {
            console.log('📄 Page type: MAIN PAGE (job listings)\n');
            await handleMainPage();
        } else if (isDetailedPage()) {
            console.log('📄 Page type: DETAILED PAGE (job description)\n');
            await handleDetailedPage();
        } else {
            console.log('📄 Page type: UNKNOWN (showing indicator only)\n');
        }
    } else {
        console.log('⏸️  Automation is NOT running\n');
    }
}

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
} else {
    autoInit();
}

// ==================== MESSAGE LISTENER ====================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'START_NAUKRI_AUTOMATION') {
        console.log('📥 START command received from popup\n');
        
        startAutomation()
            .then(result => sendResponse(result))
            .catch(error => sendResponse({ success: false, error: error.message }));
        
        return true; // Keep channel open for async response
    }
});

// ==================== START AUTOMATION ====================
async function startAutomation() {
    if (NAUKRI.isRunning) {
        console.log('⚠️  Automation is already running!\n');
        return { success: false, message: 'Already running' };
    }
    
    console.log('🚀 ══════════════════════════════════════════════════════════════');
    console.log('🚀 STARTING NAUKRI AUTOMATION');
    console.log('🚀 ══════════════════════════════════════════════════════════════\n');
    
    // Initialize state
    NAUKRI.isRunning = true;
    NAUKRI.stats.applied = 0;
    NAUKRI.stats.skipped = 0;
    NAUKRI.stats.startTime = Date.now();
    NAUKRI.clickedJobs.clear();
    NAUKRI.processedJobs.clear();
    
    // Extract search term
    NAUKRI.searchTerm = extractSearchTerm();
    console.log(`🔍 Detected search term: "${NAUKRI.searchTerm}"\n`);
    
    // Save state and show indicator
    saveState();
    createGreenIndicator();
    
    try {
        if (isMainPage()) {
            await handleMainPage();
        } else if (isDetailedPage()) {
            await handleDetailedPage();
        } else {
            throw new Error('Not on a valid Naukri page');
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
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📄 PHASE 1: MAIN PAGE');
    console.log('🎯 Task: Click the FIRST job card to open detailed page');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Scroll to top
    window.scrollTo(0, 0);
    await delay(1000);
    
    // Find all potential job cards
    const jobCards = document.querySelectorAll(
        'article, div[class*="job"], div[class*="card"], a[href*="job-listings"], div[class*="tuple"]'
    );
    console.log(`🔍 Found ${jobCards.length} potential job elements\n`);
    
    const validJobs = [];
    
    for (const card of jobCards) {
        // Get link - either the card itself or a link inside
        let link = card.tagName === 'A' ? card : card.querySelector('a[href*="job-listings"]');
        
        if (!link || !link.href) continue;
        if (!link.href.includes('naukri.com')) continue;
        if (!link.href.includes('job-listings')) continue;
        if (NAUKRI.clickedJobs.has(link.href)) continue;
        if (link.href === window.location.href) continue;
        
        // Check if visible
        const text = card.textContent.trim();
        if (text.length < 10) continue;
        
        const rect = card.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        
        validJobs.push({ card, link, text, rect });
    }
    
    console.log(`✅ Found ${validJobs.length} valid job cards\n`);
    
    if (validJobs.length === 0) {
        console.log('❌ No jobs found on main page!\n');
        return;
    }
    
    // Sort by position (top to bottom, left to right)
    validJobs.sort((a, b) => {
        if (Math.abs(a.rect.top - b.rect.top) > 50) {
            return a.rect.top - b.rect.top;
        }
        return a.rect.left - b.rect.left;
    });
    
    // Click the FIRST job
    const firstJob = validJobs[0];
    
    console.log('🎯 FIRST JOB SELECTED:\n');
    console.log(`   Title: ${firstJob.text.substring(0, 60)}...`);
    console.log(`   URL: ${firstJob.link.href.substring(0, 80)}...\n`);
    
    // Mark as clicked
    NAUKRI.clickedJobs.add(firstJob.link.href);
    saveState();
    
    // Scroll to job
    firstJob.card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await delay(1000);
    
    // Highlight with massive blue glow
    firstJob.card.style.cssText = `
        background-color: #bfdbfe !important;
        border: 15px solid #3b82f6 !important;
        padding: 20px !important;
        margin: 10px !important;
        border-radius: 20px !important;
        box-shadow: 0 0 80px rgba(59, 130, 246, 1) !important;
        transform: scale(1.15) !important;
        z-index: 9999 !important;
        position: relative !important;
        transition: all 0.3s ease !important;
    `;
    
    await delay(2000);
    
    console.log('🖱️  CLICKING NOW...\n');
    
    try {
        firstJob.link.click();
        console.log('✅ CLICKED! Opening detailed page...\n');
    } catch (error) {
        console.log('⚠️  Direct click failed, using location.href...\n');
        window.location.href = firstJob.link.href;
    }
}

// ==================== PHASE 2: HANDLE DETAILED PAGE ====================
async function handleDetailedPage() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📄 PHASE 2: DETAILED PAGE');
    console.log('🎯 Tasks: Check button type → Apply/Skip → Find next job');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const currentUrl = window.location.href;
    
    // Check if already processed
    if (NAUKRI.processedJobs.has(currentUrl)) {
        console.log('⏭️  Job already processed, looking for next job...\n');
        await findAndClickMatchingJob();
        return;
    }
    
    // Mark as processed
    NAUKRI.processedJobs.add(currentUrl);
    saveState();
    
    // Get job title
    const titleElem = document.querySelector('h1, [class*="title"], header h1');
    const jobTitle = titleElem ? titleElem.textContent.trim() : 'Unknown Job';
    console.log(`📋 Current job: ${jobTitle.substring(0, 60)}...\n`);
    
    // Wait for page to stabilize
    await delay(1500);
    
    // Check button type
    const buttonInfo = getButtonType();
    console.log(`🔘 Button type detected: ${buttonInfo.type}\n`);
    
    if (buttonInfo.type === 'APPLY' && buttonInfo.button) {
        // APPLY button found - click it!
        console.log('✅ "Apply" button found - APPLYING...\n');
        
        buttonInfo.button.style.backgroundColor = '#3b82f6';
        buttonInfo.button.style.border = '4px solid #1e40af';
        buttonInfo.button.style.transform = 'scale(1.1)';
        
        await delay(NAUKRI.config.DELAYS.BEFORE_APPLY);
        buttonInfo.button.click();
        
        NAUKRI.stats.applied++;
        updateIndicator();
        saveState();
        
        console.log(`🎉 Applied successfully! Total: ${NAUKRI.stats.applied}/${NAUKRI.config.MAX_JOBS}\n`);
        
        await delay(NAUKRI.config.DELAYS.AFTER_APPLY);
        
    } else if (buttonInfo.type === 'COMPANY_SITE') {
        // Company site button - skip
        console.log('⏭️  "Apply on company site" button - SKIPPING...\n');
        NAUKRI.stats.skipped++;
        updateIndicator();
        saveState();
    } else {
        // No button found - skip
        console.log('❌ No apply button found - SKIPPING...\n');
        NAUKRI.stats.skipped++;
        updateIndicator();
        saveState();
    }
    
    // Check if target reached
    if (NAUKRI.stats.applied >= NAUKRI.config.MAX_JOBS) {
        const time = ((Date.now() - NAUKRI.stats.startTime) / 1000).toFixed(1);
        
        console.log('\n🎉 ══════════════════════════════════════════════════════════════');
        console.log('🎉 TARGET REACHED! AUTOMATION COMPLETE!');
        console.log('🎉 ══════════════════════════════════════════════════════════════');
        console.log(`📊 Applied: ${NAUKRI.stats.applied}/${NAUKRI.config.MAX_JOBS}`);
        console.log(`⏭️  Skipped: ${NAUKRI.stats.skipped}`);
        console.log(`⏱️  Time: ${time}s\n`);
        
        NAUKRI.isRunning = false;
        saveState();
        return;
    }
    
    // Find next job
    console.log('🔍 Looking for next job to apply...\n');
    await delay(NAUKRI.config.DELAYS.AFTER_CLICK);
    await findAndClickMatchingJob();
}

// ==================== GET BUTTON TYPE ====================
function getButtonType() {
    const buttons = document.querySelectorAll(
        'button, a[role="button"], div[role="button"], a[class*="apply"], button[class*="apply"]'
    );
    
    for (const button of buttons) {
        // Check if visible
        const rect = button.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        
        const style = window.getComputedStyle(button);
        if (style.display === 'none' || style.visibility === 'hidden') continue;
        
        const text = button.textContent.toLowerCase().trim();
        
        // Check for "Apply on company site"
        if (text.includes('apply on company site') || 
            text.includes('apply on company website')) {
            return { type: 'COMPANY_SITE', button };
        }
        
        // Check for regular "Apply" button
        if (text === 'apply' || text === 'apply now' || text.includes('quick apply')) {
            return { type: 'APPLY', button };
        }
    }
    
    return { type: 'NONE', button: null };
}

// ==================== PHASE 3: FIND AND CLICK NEXT JOB ====================
async function findAndClickMatchingJob() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎯 PHASE 3: FINDING NEXT MATCHING JOB');
    console.log(`🔍 Search term: "${NAUKRI.searchTerm}"`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Scroll to top first
    window.scrollTo(0, 0);
    await delay(1000);
    
    // ========== TRY 1: RIGHT SIDEBAR ==========
    console.log('[Strategy 1] Checking RIGHT SIDEBAR ("Jobs you might be interested in")...\n');
    
    const sidebarJobs = await findJobsInArea('RIGHT_SIDEBAR');
    
    if (sidebarJobs.length > 0) {
        console.log(`✅ Found ${sidebarJobs.length} jobs in right sidebar!\n`);
        await clickBestMatchingJob(sidebarJobs);
        return;
    }
    
    console.log('❌ No jobs found in right sidebar\n');
    
    // ========== TRY 2: SCROLL DOWN ==========
    console.log('[Strategy 2] SCROLLING DOWN to find more jobs...\n');
    
    window.scrollTo(0, document.body.scrollHeight * 0.5);
    await delay(NAUKRI.config.DELAYS.SCROLL_DELAY);
    
    const scrollJobs = await findJobsInArea('SCROLL_DOWN');
    
    if (scrollJobs.length > 0) {
        console.log(`✅ Found ${scrollJobs.length} jobs after scrolling down!\n`);
        await clickBestMatchingJob(scrollJobs);
        return;
    }
    
    console.log('❌ No jobs found after scrolling\n');
    
    // ========== NO MORE JOBS ==========
    const time = NAUKRI.stats.startTime ? 
        ((Date.now() - NAUKRI.stats.startTime) / 1000).toFixed(1) : '0';
    
    console.log('\n🏁 ══════════════════════════════════════════════════════════════');
    console.log('🏁 NO MORE JOBS FOUND - AUTOMATION COMPLETE');
    console.log('🏁 ══════════════════════════════════════════════════════════════');
    console.log(`📊 Applied: ${NAUKRI.stats.applied} jobs`);
    console.log(`⏭️  Skipped: ${NAUKRI.stats.skipped} jobs`);
    console.log(`⏱️  Total time: ${time} seconds\n`);
    
    NAUKRI.isRunning = false;
    saveState();
}

// ==================== FIND JOBS IN SPECIFIC AREA ====================
async function findJobsInArea(area) {
    let container = null;
    
    if (area === 'RIGHT_SIDEBAR') {
        // Try multiple sidebar selectors
        const selectors = [
            'section[class*="simjobs-right"]',
            'section[class*="simjobs"]',
            'div[class*="right-container"]',
            'aside[class*="similar"]',
            'div[class*="similar-jobs"]'
        ];
        
        for (const sel of selectors) {
            container = document.querySelector(sel);
            if (container) {
                console.log(`   ✓ Found container using selector: ${sel}\n`);
                break;
            }
        }
        
        // If not found, try by text
        if (!container) {
            const allElems = document.querySelectorAll('h2, h3, h4, div, section');
            for (const elem of allElems) {
                const text = elem.textContent.toLowerCase();
                if (text.includes('jobs you might be interested in') || 
                    text.includes('jobs you might')) {
                    container = elem.parentElement;
                    console.log(`   ✓ Found container by heading text\n`);
                    break;
                }
            }
        }
        
    } else if (area === 'SCROLL_DOWN') {
        // Find "15 Roles you might be interested in" section - EXACT MATCH
        const allElems = document.querySelectorAll('h2, h3, h4, h5, div, section, p, span');
        
        console.log('   🔍 Searching for "Roles you might be interested in" heading...\n');
        
        for (const elem of allElems) {
            const text = elem.textContent.trim();
            const textLower = text.toLowerCase();
            
            // EXACT pattern match for "15 Roles you might be interested in"
            if (textLower === '15 roles you might be interested in' ||
                textLower === '20 roles you might be interested in' ||
                textLower === '10 roles you might be interested in' ||
                textLower.match(/^\d+\s+roles\s+you\s+might\s+be\s+interested\s+in$/)) {
                
                console.log(`   ✅ FOUND HEADING: "${text}"\n`);
                
                // Get parent container - go UP until we find a large container
                let parent = elem.parentElement;
                let attempts = 0;
                
                while (parent && attempts < 5) {
                    const children = parent.querySelectorAll('article, div[class*="tuple"], div[class*="job"]');
                    
                    if (children.length >= 2) {
                        container = parent;
                        console.log(`   ✅ Found container with ${children.length} job cards\n`);
                        break;
                    }
                    
                    parent = parent.parentElement;
                    attempts++;
                }
                
                if (container) break;
            }
        }
        
        // Fallback: search below success message
        if (!container) {
            console.log('   ⚠️  Heading not found, trying fallback method...\n');
            
            const successMsg = Array.from(document.querySelectorAll('div, p, span')).find(el => 
                el.textContent.toLowerCase().includes('successfully applied')
            );
            
            if (successMsg) {
                console.log('   ✅ Found success message, scanning below...\n');
                
                // Get all content below success message
                let current = successMsg;
                for (let i = 0; i < 10; i++) {
                    current = current.parentElement;
                    if (!current) break;
                    
                    const jobCards = current.querySelectorAll('article, div[class*="tuple"]');
                    if (jobCards.length >= 2) {
                        container = current;
                        console.log(`   ✅ Found container with ${jobCards.length} job cards\n`);
                        break;
                    }
                }
            }
        }
    }
    
    if (!container) {
        console.log(`   ❌ Container not found for ${area}\n`);
        return [];
    }
    
    console.log(`   📦 Container found! Scanning for job cards...\n`);
    
    // Find ALL clickable job cards - must have links
    const jobCards = container.querySelectorAll('article, div[class*="tuple"], div[class*="jobTuple"]');
    
    console.log(`   Found ${jobCards.length} job card elements\n`);
    
    const scoredJobs = [];
    
    for (const card of jobCards) {
        // MUST have a link to job-listings
        const link = card.querySelector('a[href*="job-listings"]');
        if (!link || !link.href) {
            continue;
        }
        
        // Get full text
        const text = card.textContent.trim();
        
        // Basic validation
        if (text.length < 20 || text.length > 1000) {
            continue;
        }
        
        // Check for job-related keywords
        const textLower = text.toLowerCase();
        const hasKeywords = textLower.includes('reviews') ||
                           textLower.includes('days ago') ||
                           textLower.includes('day ago') ||
                           textLower.includes('experience') ||
                           textLower.includes('lacs') ||
                           textLower.includes('years');
        
        if (!hasKeywords) {
            continue;
        }
        
        // Check if visible
        const rect = card.getBoundingClientRect();
        if (rect.width < 100 || rect.height < 50) {
            continue;
        }
        
        // Create unique ID from URL
        const cardId = link.href;
        if (NAUKRI.clickedJobs.has(cardId)) {
            console.log(`      ⏭️  Skipping already clicked job\n`);
            continue;
        }
        
        // Extract job title - FIRST meaningful line
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 3);
        let jobTitle = lines[0] || 'Unknown Job';
        
        // Clean title - remove company info if present
        if (jobTitle.length > 60) {
            jobTitle = jobTitle.substring(0, 60);
        }
        
        console.log(`      📋 Job found: "${jobTitle}"`);
        console.log(`      🔗 URL: ${link.href.substring(0, 70)}...`);
        
        // Calculate match score
        const score = calculateMatchScore(jobTitle, NAUKRI.searchTerm);
        console.log(`      ⭐ Match score: ${score}\n`);
        
        if (score > 0) {
            scoredJobs.push({ 
                card,
                link,
                cardId,
                title: jobTitle, 
                score 
            });
        }
    }
    
    if (scoredJobs.length > 0) {
        console.log(`   ✅ Total valid jobs found: ${scoredJobs.length}\n`);
    } else {
        console.log(`   ❌ No valid jobs found in this area\n`);
    }
    
    return scoredJobs;
}

// ==================== CLICK BEST MATCHING JOB ====================
async function clickBestMatchingJob(scoredJobs) {
    // Sort by score (highest first)
    scoredJobs.sort((a, b) => b.score - a.score);
    
    console.log('   📊 Jobs ranked by match score:\n');
    scoredJobs.slice(0, Math.min(5, scoredJobs.length)).forEach((job, idx) => {
        let matchType = '';
        if (job.score >= 800) matchType = '🎯 FULL MATCH';
        else if (job.score >= 400) matchType = '✅ HIGH MATCH';
        else if (job.score >= 200) matchType = '⚡ PARTIAL MATCH';
        else matchType = '💡 LOW MATCH';
        
        console.log(`      [${idx + 1}] ${matchType} (${job.score}) - "${job.title.substring(0, 50)}"`);
    });
    console.log();
    
    const bestMatch = scoredJobs[0];
    
    console.log('🎯 ═══════════════════════════════════════════════════════════════');
    console.log('🎯 CLICKING BEST MATCHING JOB:');
    console.log(`🎯 Title: "${bestMatch.title}"`);
    console.log(`🎯 Score: ${bestMatch.score}`);
    console.log(`🎯 URL: ${bestMatch.link.href.substring(0, 80)}...`);
    console.log('🎯 ═══════════════════════════════════════════════════════════════\n');
    
    // Mark as clicked using URL
    NAUKRI.clickedJobs.add(bestMatch.cardId);
    saveState();
    
    // Scroll to job
    bestMatch.card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await delay(1500);
    
    // Apply MASSIVE highlight to the CARD (not just link)
    bestMatch.card.style.cssText = `
        background-color: #bfdbfe !important;
        border: 15px solid #3b82f6 !important;
        padding: 30px !important;
        margin: 10px !important;
        border-radius: 25px !important;
        box-shadow: 0 0 100px rgba(59, 130, 246, 1) !important;
        transform: scale(1.25) !important;
        z-index: 99999 !important;
        position: relative !important;
        transition: all 0.3s ease !important;
    `;
    
    await delay(NAUKRI.config.DELAYS.HIGHLIGHT_DELAY);
    
    console.log('🖱️  CLICKING JOB LINK NOW...\n');
    
    try {
        // Method 1: Direct link click
        bestMatch.link.click();
        console.log('✅ Link clicked successfully!\n');
        return;
    } catch (e1) {
        console.log('⚠️  Link click failed, trying alternative methods...\n');
    }
    
    try {
        // Method 2: Navigation
        window.location.href = bestMatch.link.href;
        console.log('✅ Navigating via location.href\n');
        return;
    } catch (e2) {
        console.log('❌ All click methods failed!\n');
    }
}

console.log('✅ [NAUKRI] Final complete automation loaded and ready!\n');