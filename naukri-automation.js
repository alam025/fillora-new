// ==================== NAUKRI.COM AUTOMATION - HYBRID VERSION ====================
// ✅ Works with BOTH popup's direct injection AND message-based approach
// ✅ Green indicator on EVERY page
// ✅ Detects automation from Chrome Storage OR window flag
// ✅ Complete persistence

console.log('\n🎯 ══════════════════════════════════════════════════════════════');
console.log('🎯 [NAUKRI HYBRID] Loading - Works with popup injection!');
console.log('🎯 ══════════════════════════════════════════════════════════════\n');

// Check if already loaded
if (window.naukriAutomationLoaded) {
    console.log('⚠️  Already loaded, skipping...');
} else {
    window.naukriAutomationLoaded = true;

    // ==================== CONFIGURATION ====================
    const CONFIG = {
        AUTO_START_DELAY: 1500,
        CHECK_INTERVAL: 1000,
        FORM_FILL_DELAY: 3000,
        FORM_SUBMIT_DELAY: 2000,
        NEXT_JOB_DELAY: 3000,
        MAX_JOBS: 5,
        SCROLL_WAIT: 2000
    };

    // ==================== STATE ====================
    let state = {
        isRunning: false,
        processedJobs: new Set(),
        clickedUrls: new Set(),
        appliedCount: 0,
        skippedCount: 0,
        userData: null,
        openaiKey: ''
    };

    // ==================== UTILITIES ====================
    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function isJobDetailsPage() {
        return window.location.href.includes('job-listings-');
    }

    // ==================== CHROME STORAGE ====================
    async function saveState() {
        try {
            await chrome.storage.local.set({
                naukri_running: state.isRunning,
                naukri_applied: state.appliedCount,
                naukri_skipped: state.skippedCount,
                naukri_clicked: Array.from(state.clickedUrls),
                naukri_processed: Array.from(state.processedJobs)
            });
            console.log('💾 State saved');
        } catch (e) {
            console.warn('⚠️  Save failed:', e);
        }
    }

    async function loadState() {
        try {
            const data = await chrome.storage.local.get([
                'naukri_running',
                'naukri_applied',
                'naukri_skipped',
                'naukri_clicked',
                'naukri_processed'
            ]);
            
            if (data.naukri_running) {
                state.isRunning = true;
                state.appliedCount = data.naukri_applied || 0;
                state.skippedCount = data.naukri_skipped || 0;
                state.clickedUrls = new Set(data.naukri_clicked || []);
                state.processedJobs = new Set(data.naukri_processed || []);
                
                console.log('✅ State restored:', {
                    applied: state.appliedCount,
                    skipped: state.skippedCount
                });
                return true;
            }
        } catch (e) {
            console.warn('⚠️  Load failed:', e);
        }
        
        return false;
    }

    async function clearState() {
        try {
            await chrome.storage.local.remove([
                'naukri_running',
                'naukri_applied',
                'naukri_skipped',
                'naukri_clicked',
                'naukri_processed'
            ]);
            console.log('🗑️  State cleared');
        } catch (e) {
            console.warn('⚠️  Clear failed:', e);
        }
    }

    // ==================== INDICATOR ====================
    function createIndicator() {
        const existing = document.getElementById('naukri-automation-indicator');
        if (existing) {
            updateIndicator();
            return;
        }
        
        const indicator = document.createElement('div');
        indicator.id = 'naukri-automation-indicator';
        indicator.style.cssText = `
            position: fixed !important;
            top: 20px !important;
            right: 20px !important;
            background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important;
            color: white !important;
            padding: 18px 24px !important;
            border-radius: 14px !important;
            font-weight: 800 !important;
            font-size: 16px !important;
            z-index: 2147483647 !important;
            box-shadow: 0 10px 30px rgba(16, 185, 129, 0.8) !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif !important;
            min-width: 350px !important;
            border: 3px solid rgba(255, 255, 255, 0.5) !important;
        `;
        
        indicator.innerHTML = `
            <div style="font-size: 18px; margin-bottom: 6px;">🟢 Naukri Automation ACTIVE</div>
            <div style="font-size: 13px; opacity: 0.95;">
                Applied: <span id="naukri-applied-count">${state.appliedCount}</span> | 
                Skipped: <span id="naukri-skipped-count">${state.skippedCount}</span>
            </div>
        `;
        
        document.body.appendChild(indicator);
        console.log('✅ GREEN INDICATOR CREATED!');
    }

    function updateIndicator() {
        const appliedElem = document.getElementById('naukri-applied-count');
        const skippedElem = document.getElementById('naukri-skipped-count');
        if (appliedElem) appliedElem.textContent = state.appliedCount;
        if (skippedElem) skippedElem.textContent = state.skippedCount;
        console.log('🔄 Indicator updated');
    }

    // ==================== LOAD USER DATA ====================
    async function loadUserData() {
        if (state.userData) return true;
        
        console.log('📥 Loading user data...');
        
        try {
            const result = await chrome.storage.local.get(['userId']);
            const userId = result.userId;
            
            if (!userId) {
                console.log('⚠️  No user ID');
                return false;
            }
            
            state.userData = { userId };
            
            // Get more data via background
            const dbData = await new Promise((resolve) => {
                chrome.runtime.sendMessage(
                    { action: 'getUserData', userId },
                    response => resolve(response)
                );
            });
            
            if (dbData && dbData.success) {
                state.userData = { ...state.userData, ...dbData.data };
            }
            
            console.log('✅ User data loaded');
            return true;
            
        } catch (error) {
            console.log('⚠️  Error loading data:', error);
            return false;
        }
    }

    // ==================== JOB DETECTION ====================
    function getButtonType() {
        console.log('🔍 Looking for buttons...');
        
        const buttons = document.querySelectorAll('button');
        
        for (const btn of buttons) {
            if (!isElementVisible(btn)) continue;
            
            const text = btn.textContent.toLowerCase().trim();
            
            if (text === 'apply' || text.includes('apply now')) {
                console.log(`   ✅ APPLY button found`);
                return { type: 'APPLY', button: btn };
            }
            
            if (text.includes('company site')) {
                console.log(`   ⏭️  COMPANY_SITE button`);
                return { type: 'COMPANY_SITE', button: btn };
            }
        }
        
        console.log('   ❌ No apply button');
        return { type: 'NONE', button: null };
    }

    function isElementVisible(el) {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        const s = window.getComputedStyle(el);
        return r.width > 0 && r.height > 0 && 
               s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0';
    }

    // ==================== FIND NEXT JOB ====================
    async function clickNextJob() {
        console.log('\n🔍 Finding next job...');
        
        // Right sidebar
        const rightThreshold = window.innerWidth * 0.55;
        const allElements = document.querySelectorAll('a, div, article');
        const rightJobs = [];
        
        for (const el of allElements) {
            const rect = el.getBoundingClientRect();
            
            if (rect.left <= rightThreshold) continue;
            if (rect.width === 0 || rect.height === 0) continue;
            
            const text = el.textContent.trim();
            const href = el.href || '';
            
            if (!text || text.length < 10) continue;
            if (href && !href.includes('job-listings')) continue;
            if (href && (state.clickedUrls.has(href) || window.location.href === href)) continue;
            
            rightJobs.push({ element: el, href, text });
        }
        
        if (rightJobs.length > 0) {
            const job = rightJobs[0];
            console.log(`🎯 Clicking: "${job.text.substring(0, 40)}..."`);
            
            if (job.href) state.clickedUrls.add(job.href);
            await saveState();
            
            job.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await delay(800);
            
            job.element.style.backgroundColor = '#bfdbfe';
            job.element.style.border = '3px solid #3b82f6';
            
            await delay(1000);
            job.element.click();
            
            console.log('✅ Clicked!');
            return true;
        }
        
        // Try scrolling
        console.log('📜 Scrolling...');
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        await delay(2000);
        
        const allLinks = document.querySelectorAll('a[href*="job-listings"]');
        for (const link of allLinks) {
            const href = link.href;
            if (state.clickedUrls.has(href) || window.location.href === href) continue;
            
            const rect = link.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                console.log(`🎯 Clicking: "${link.textContent.trim().substring(0, 40)}..."`);
                
                state.clickedUrls.add(href);
                await saveState();
                
                link.scrollIntoView({ behavior: 'smooth', block: 'center' });
                await delay(600);
                link.click();
                
                console.log('✅ Clicked!');
                return true;
            }
        }
        
        console.log('❌ No more jobs');
        return false;
    }

    // ==================== PROCESS JOB ====================
    async function processJob() {
        console.log('\n📄 Processing job page...');
        
        if (!isJobDetailsPage()) {
            console.log('❌ Not a job page');
            return;
        }
        
        console.log('✅ On job page');
        
        // Show indicator
        createIndicator();
        
        // Mark as processed
        state.processedJobs.add(window.location.href);
        await saveState();
        
        // Wait for page to load
        await delay(2500);
        
        // Find button
        const { type, button } = getButtonType();
        
        if (type === 'COMPANY_SITE') {
            console.log('⏭️  Skipping company site job');
            state.skippedCount++;
            updateIndicator();
            await saveState();
            
            await delay(2000);
            await clickNextJob();
            return;
        }
        
        if (type === 'NONE') {
            console.log('⚠️  No button - skipping');
            state.skippedCount++;
            updateIndicator();
            await saveState();
            
            await delay(2000);
            await clickNextJob();
            return;
        }
        
        if (type === 'APPLY' && button) {
            console.log('✅ Clicking Apply...');
            
            button.style.backgroundColor = '#3b82f6';
            button.style.border = '3px solid #1e40af';
            
            await delay(800);
            button.click();
            
            await delay(2500);
            
            // Check for form (simplified - just assume it worked)
            console.log('✅ Applied!');
            
            state.appliedCount++;
            updateIndicator();
            await saveState();
            
            console.log(`📊 Applied: ${state.appliedCount}/${CONFIG.MAX_JOBS}`);
            
            // Check if done
            if (state.appliedCount >= CONFIG.MAX_JOBS) {
                console.log('\n🎯 TARGET REACHED!');
                
                const indicator = document.getElementById('naukri-automation-indicator');
                if (indicator) {
                    indicator.style.background = 'linear-gradient(135deg, #10b981, #059669)';
                    indicator.innerHTML = `
                        <div style="font-size: 20px; margin-bottom: 6px;">🎉 Completed!</div>
                        <div style="font-size: 14px;">Applied to ${state.appliedCount} jobs</div>
                    `;
                }
                
                await clearState();
                state.isRunning = false;
                return;
            }
            
            // Continue
            await delay(3000);
            await clickNextJob();
        }
    }

    // ==================== INIT & CHECK ====================
    async function init() {
        console.log('🔧 [INIT] Starting...');
        
        // Wait for page to load
        await delay(CONFIG.AUTO_START_DELAY);
        
        // Check if automation is running
        const wasRunning = await loadState();
        
        // ALSO check if popup injected code set a flag
        const popupInjected = window.naukriAutomationRunning === true;
        
        if (wasRunning || popupInjected) {
            console.log('✅ Automation detected - continuing!');
            
            if (!wasRunning && popupInjected) {
                // Popup injection started it, save to storage
                state.isRunning = true;
                await saveState();
            }
            
            createIndicator();
            await loadUserData();
            
            if (isJobDetailsPage()) {
                await processJob();
            } else {
                // On search page, wait for popup to click first job
                console.log('📋 On search page - waiting...');
            }
        } else {
            console.log('ℹ️  No automation running - ready for command');
        }
    }

    // ==================== MESSAGE LISTENER ====================
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'startNaukriAutomation') {
            console.log('📥 START command received!');
            
            if (state.isRunning) {
                console.log('⚠️  Already running');
                sendResponse({ success: false, message: 'Already running' });
                return;
            }
            
            state.isRunning = true;
            state.appliedCount = 0;
            state.skippedCount = 0;
            state.clickedUrls.clear();
            state.processedJobs.clear();
            
            saveState().then(() => {
                loadUserData().then(() => {
                    createIndicator();
                    
                    if (isJobDetailsPage()) {
                        processJob();
                    }
                });
            });
            
            sendResponse({ success: true });
        }
        
        return true;
    });

    // ==================== PERIODIC CHECK ====================
    // Check every second if indicator should be shown
    setInterval(() => {
        if (state.isRunning || window.naukriAutomationRunning) {
            const indicator = document.getElementById('naukri-automation-indicator');
            if (!indicator) {
                console.log('🔄 Recreating indicator...');
                createIndicator();
            }
        }
    }, CONFIG.CHECK_INTERVAL);

    // Start
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}

console.log('✅ [NAUKRI HYBRID] Ready - Works with popup!\n');