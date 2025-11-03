// Fillora - Configuration Initializer
// This script runs once when extension loads and stores config in chrome.storage

(async function initializeConfig() {
    // Check if FILLORA_CONFIG exists (from config.js)
    if (typeof window.FILLORA_CONFIG !== 'undefined') {
        // Store config in chrome.storage for background script to access
        await chrome.storage.local.set({
            fillora_config: window.FILLORA_CONFIG
        });
        console.log('✅ [FILLORA INIT] Configuration stored in chrome.storage');
    } else {
        console.warn('⚠️ [FILLORA INIT] window.FILLORA_CONFIG not found');
    }
})();