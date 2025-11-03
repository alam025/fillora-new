// Fillora Chrome Extension - ULTIMATE POPUP SYSTEM
// Production-grade popup with advanced features
console.log('🚀 [FILLORA ULTIMATE] Loading popup system...');

// ==================== STATE MANAGEMENT ====================
let appState = {
    isAuthenticated: false,
    user: null,
    automation: {
        isRunning: false,
        currentAction: null,
        startTime: null
    },
    stats: {
        totalAutoFills: 0,
        totalLinkedInApps: 0,
        successRate: 100
    }
};

// ==================== ERROR & SUCCESS HANDLING ====================
function showError(message, duration = 5000) {
    console.error('❌ [ERROR]', message);
    
    let errorDiv = document.getElementById('error-message');
    
    if (!errorDiv) {
        const container = document.getElementById('auth-screen') || 
                         document.querySelector('.content') || 
                         document.body;
        errorDiv = document.createElement('div');
        errorDiv.id = 'error-message';
        errorDiv.className = 'error-message';
        errorDiv.style.cssText = `
            background: linear-gradient(135deg, #EF4444, #DC2626);
            color: white;
            padding: 14px 16px;
            border-radius: 10px;
            margin: 12px 0;
            text-align: center;
            font-weight: 500;
            font-size: 13px;
            display: none;
            box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
            animation: slideDown 0.3s ease-out;
        `;
        container.appendChild(errorDiv);
    }
    
    errorDiv.textContent = '❌ ' + message;
    errorDiv.style.display = 'block';
    
    setTimeout(() => {
        if (errorDiv) {
            errorDiv.style.animation = 'slideUp 0.3s ease-in';
            setTimeout(() => {
                errorDiv.style.display = 'none';
            }, 300);
        }
    }, duration);
}

function showSuccess(message, duration = 3000) {
    console.log('✅ [SUCCESS]', message);
    
    let successDiv = document.getElementById('success-message');
    
    if (!successDiv) {
        const container = document.querySelector('.content') || 
                         document.getElementById('dashboard-screen') || 
                         document.body;
        successDiv = document.createElement('div');
        successDiv.id = 'success-message';
        successDiv.className = 'success-message';
        successDiv.style.cssText = `
            background: linear-gradient(135deg, #10B981, #059669);
            color: white;
            padding: 14px 16px;
            border-radius: 10px;
            margin: 12px 0;
            text-align: center;
            font-weight: 500;
            font-size: 13px;
            display: none;
            box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
            animation: slideDown 0.3s ease-out;
        `;
        container.appendChild(successDiv);
    }
    
    successDiv.textContent = '✅ ' + message;
    successDiv.style.display = 'block';
    
    setTimeout(() => {
        if (successDiv) {
            successDiv.style.animation = 'slideUp 0.3s ease-in';
            setTimeout(() => {
                successDiv.style.display = 'none';
            }, 300);
        }
    }, duration);
}

function showInfo(message, duration = 2000) {
    console.log('ℹ️ [INFO]', message);
    
    let infoDiv = document.getElementById('info-message');
    
    if (!infoDiv) {
        const container = document.querySelector('.content') || document.body;
        infoDiv = document.createElement('div');
        infoDiv.id = 'info-message';
        infoDiv.style.cssText = `
            background: linear-gradient(135deg, #3B82F6, #2563EB);
            color: white;
            padding: 12px 16px;
            border-radius: 10px;
            margin: 10px 0;
            text-align: center;
            font-weight: 500;
            font-size: 13px;
            display: none;
            box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
        `;
        container.appendChild(infoDiv);
    }
    
    infoDiv.textContent = 'ℹ️ ' + message;
    infoDiv.style.display = 'block';
    
    setTimeout(() => {
        if (infoDiv) infoDiv.style.display = 'none';
    }, duration);
}

// ==================== AUTHENTICATION ====================
async function handleAuth() {
    console.log('🔐 [AUTH] Starting authentication...');
    
    const email = document.getElementById('email')?.value?.trim();
    const password = document.getElementById('password')?.value?.trim();
    
    // Validation
    if (!email || !password) {
        showError('Please enter both email and password');
        return;
    }
    
    if (!validateEmail(email)) {
        showError('Please enter a valid email address');
        return;
    }
    
    const loginBtn = document.getElementById('login-btn');
    const originalText = loginBtn?.textContent || 'Sign In';
    
    if (loginBtn) {
        loginBtn.disabled = true;
        loginBtn.innerHTML = '<span style="animation: spin 1s linear infinite;">⚙️</span> Signing in...';
    }
    
    try {
        const response = await chrome.runtime.sendMessage({
            action: 'LOGIN_REQUEST',
            email: email,
            password: password
        });
        
        if (response && response.success) {
            appState.isAuthenticated = true;
            appState.user = response.user;
            
            console.log('✅ Authentication successful:', response.user.email);
            showSuccess('Welcome back, ' + (response.user.name || 'User') + '!');
            
            // Smooth transition
            setTimeout(() => {
                showDashboard();
            }, 500);
        } else {
            throw new Error(response?.error || 'Authentication failed. Please check your credentials.');
        }
    } catch (error) {
        console.error('❌ Auth error:', error);
        showError(error.message || 'Authentication failed. Please try again.');
    } finally {
        if (loginBtn) {
            loginBtn.disabled = false;
            loginBtn.textContent = originalText;
        }
    }
}

async function handleLogout() {
    console.log('🚪 [AUTH] Logging out...');
    
    try {
        await chrome.runtime.sendMessage({ action: 'LOGOUT_REQUEST' });
        appState.isAuthenticated = false;
        appState.user = null;
        appState.automation.isRunning = false;
        
        showInfo('Logged out successfully');
        setTimeout(() => {
            showAuthScreen();
        }, 500);
    } catch (error) {
        console.error('❌ Logout error:', error);
        showError('Logout failed. Please try again.');
    }
}

function validateEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
}

// ==================== UI MANAGEMENT ====================
function showAuthScreen() {
    console.log('🎨 [UI] Showing authentication screen');
    
    const loadingScreen = document.getElementById('loading-screen');
    const authScreen = document.getElementById('auth-screen');
    const dashboard = document.getElementById('dashboard-screen');
    
    if (loadingScreen) loadingScreen.classList.add('hidden');
    if (authScreen) authScreen.classList.remove('hidden');
    if (dashboard) dashboard.classList.add('hidden');
    
    // Clear form
    const emailField = document.getElementById('email');
    const passwordField = document.getElementById('password');
    if (emailField) emailField.value = '';
    if (passwordField) passwordField.value = '';
}

function showDashboard() {
    console.log('🎨 [UI] Showing dashboard');
    
    const loadingScreen = document.getElementById('loading-screen');
    const authScreen = document.getElementById('auth-screen');
    const dashboard = document.getElementById('dashboard-screen');
    
    if (loadingScreen) loadingScreen.classList.add('hidden');
    if (authScreen) authScreen.classList.add('hidden');
    if (dashboard) dashboard.classList.remove('hidden');
    
    // Update user info
    updateUserInfo();
    updateStats();
}

function updateUserInfo() {
    const userNameSpan = document.getElementById('user-name');
    const userEmailSpan = document.getElementById('user-email');
    const userAvatar = document.getElementById('user-avatar');
    
    if (userNameSpan && appState.user) {
        userNameSpan.textContent = appState.user.name || appState.user.email || 'User';
    }
    if (userEmailSpan && appState.user) {
        userEmailSpan.textContent = appState.user.email || '';
    }
    if (userAvatar && appState.user) {
        const initial = (appState.user.name || appState.user.email || 'U')[0].toUpperCase();
        userAvatar.textContent = initial;
    }
}

function updateStats() {
    // Update stats if elements exist
    const statsElements = {
        autoFills: document.getElementById('stat-autofills'),
        linkedInApps: document.getElementById('stat-linkedin'),
        successRate: document.getElementById('stat-success-rate')
    };
    
    if (statsElements.autoFills) {
        statsElements.autoFills.textContent = appState.stats.totalAutoFills;
    }
    if (statsElements.linkedInApps) {
        statsElements.linkedInApps.textContent = appState.stats.totalLinkedInApps;
    }
    if (statsElements.successRate) {
        statsElements.successRate.textContent = appState.stats.successRate + '%';
    }
}

// ==================== AUTOFILL FUNCTIONALITY ====================
async function startAutoFill() {
    if (appState.automation.isRunning) {
        showError('Another automation is already running. Please wait.');
        return;
    }

    console.log('🤖 [AUTOFILL] Starting intelligent AutoFill...');
    
    const autofillBtn = document.getElementById('autofill-btn');
    const originalHTML = autofillBtn?.innerHTML || '🤖 AI AutoFill Ready';
    
    if (autofillBtn) {
        autofillBtn.disabled = true;
        autofillBtn.innerHTML = '⚙️ Initializing...';
    }

    appState.automation.isRunning = true;
    appState.automation.currentAction = 'autofill';
    appState.automation.startTime = Date.now();

    try {
        // Get active tab
        const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!currentTab) {
            throw new Error('No active tab found. Please open a webpage with a form.');
        }

        // Inject content script
        if (autofillBtn) autofillBtn.innerHTML = '📦 Loading extension...';
        try {
            await chrome.scripting.executeScript({
                target: { tabId: currentTab.id },
                files: ['content.js']
            });
            await delay(1000);
        } catch (e) {
            console.log('ℹ️ Content script already loaded');
        }

        // Fetch comprehensive user data
        if (autofillBtn) autofillBtn.innerHTML = '📊 Loading your data...';
        
        const userDataResponse = await chrome.runtime.sendMessage({
            action: 'FETCH_USER_DATA_FOR_AUTOFILL',
            userId: appState.user.id
        });

        if (!userDataResponse.success) {
            throw new Error('Failed to load user data: ' + userDataResponse.error);
        }

        console.log('✅ User data loaded:', Object.keys(userDataResponse.data).length, 'fields');

        // Start AutoFill
        if (autofillBtn) autofillBtn.innerHTML = '🤖 Filling form intelligently...';
        
        const result = await chrome.tabs.sendMessage(currentTab.id, {
            action: 'PERFORM_AUTOFILL',
            userData: userDataResponse.data
        });

        if (result && result.success) {
            const timeTaken = ((Date.now() - appState.automation.startTime) / 1000).toFixed(1);
            const message = `AutoFill Complete! ${result.fieldsFilled}/${result.totalFields} fields (${result.successRate}%) in ${timeTaken}s`;
            
            console.log('✅ [AUTOFILL]', message);
            showSuccess(message, 5000);
            
            // Update stats
            appState.stats.totalAutoFills++;
            updateStats();
            
            if (autofillBtn) {
                autofillBtn.innerHTML = `✅ Filled ${result.fieldsFilled}/${result.totalFields} fields!`;
                autofillBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
            }
        } else {
            throw new Error(result?.error || 'AutoFill failed. Please try again.');
        }

    } catch (error) {
        console.error('❌ [AUTOFILL] Error:', error);
        showError('AutoFill failed: ' + error.message);
        
        if (autofillBtn) {
            autofillBtn.innerHTML = '❌ Failed - Try Again';
            autofillBtn.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
        }
    } finally {
        if (autofillBtn) {
            setTimeout(() => {
                autofillBtn.disabled = false;
                autofillBtn.innerHTML = originalHTML;
                autofillBtn.style.background = '';
            }, 3000);
        }
        appState.automation.isRunning = false;
        appState.automation.currentAction = null;
    }
}

// ==================== LINKEDIN AUTOMATION ====================
async function startLinkedInAutomation() {
    if (appState.automation.isRunning) {
        showError('Another automation is already running. Please wait.');
        return;
    }

    console.log('🔗 [LINKEDIN] Starting advanced LinkedIn automation...');
    
    const linkedinBtn = document.getElementById('linkedin-automation-btn');
    const originalHTML = linkedinBtn?.innerHTML || '🔗 LinkedIn Automation (5 Jobs)';
    
    if (linkedinBtn) {
        linkedinBtn.disabled = true;
        linkedinBtn.innerHTML = '⚙️ Initializing...';
    }

    appState.automation.isRunning = true;
    appState.automation.currentAction = 'linkedin';
    appState.automation.startTime = Date.now();

    try {
        // Get active tab
        const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!currentTab) {
            throw new Error('No active tab found. Please open a browser tab.');
        }

        // Check if on LinkedIn
        if (!currentTab.url.includes('linkedin.com')) {
            if (linkedinBtn) linkedinBtn.innerHTML = '🔗 Opening LinkedIn...';
            showInfo('Navigating to LinkedIn job search...');
            
            await chrome.tabs.update(currentTab.id, {
                url: 'https://www.linkedin.com/jobs/search/?keywords=data%20analyst&location=India&f_AL=true&f_TPR=r86400&sortBy=DD'
            });
            await delay(8000);
        }

        // Inject content script
        if (linkedinBtn) linkedinBtn.innerHTML = '📦 Loading automation system...';
        try {
            await chrome.scripting.executeScript({
                target: { tabId: currentTab.id },
                files: ['content.js']
            });
            await delay(2000);
        } catch (e) {
            console.log('ℹ️ Content script already loaded');
        }

        // Fetch user data
        if (linkedinBtn) linkedinBtn.innerHTML = '📊 Loading your profile data...';
        
        const userDataResponse = await chrome.runtime.sendMessage({
            action: 'FETCH_USER_DATA_FOR_AUTOFILL',
            userId: appState.user.id
        });

        if (!userDataResponse.success) {
            throw new Error('Failed to load user data: ' + userDataResponse.error);
        }

        console.log('✅ User data loaded for LinkedIn:', Object.keys(userDataResponse.data).length, 'fields');

        // Start LinkedIn automation
        if (linkedinBtn) linkedinBtn.innerHTML = '🚀 Applying to jobs (0/5)...';
        showInfo('LinkedIn automation started! This may take 2-3 minutes.');
        
        const result = await chrome.tabs.sendMessage(currentTab.id, {
            action: 'START_LINKEDIN_AUTOMATION',
            userData: userDataResponse.data
        });

        if (result && result.success) {
            const timeTaken = ((Date.now() - appState.automation.startTime) / 1000).toFixed(0);
            const message = `LinkedIn Complete! ${result.applicationsSubmitted}/5 jobs applied in ${timeTaken}s`;
            
            console.log('✅ [LINKEDIN]', message);
            showSuccess(message, 5000);
            
            // Update stats
            appState.stats.totalLinkedInApps += result.applicationsSubmitted;
            appState.stats.successRate = result.successRate || 100;
            updateStats();
            
            if (linkedinBtn) {
                linkedinBtn.innerHTML = `✅ Applied to ${result.applicationsSubmitted} jobs!`;
                linkedinBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
            }
        } else {
            throw new Error(result?.error || 'LinkedIn automation failed. Please try again.');
        }

    } catch (error) {
        console.error('❌ [LINKEDIN] Error:', error);
        showError('LinkedIn automation failed: ' + error.message);
        
        if (linkedinBtn) {
            linkedinBtn.innerHTML = '❌ Failed - Try Again';
            linkedinBtn.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
        }
    } finally {
        if (linkedinBtn) {
            setTimeout(() => {
                linkedinBtn.disabled = false;
                linkedinBtn.innerHTML = originalHTML;
                linkedinBtn.style.background = '';
            }, 4000);
        }
        appState.automation.isRunning = false;
        appState.automation.currentAction = null;
    }
}

// ==================== NAVIGATION ====================
function openDashboard() {
    console.log('🌐 Opening web dashboard');
    window.open('https://fillora.figma.site/dashboard', '_blank');
}

function openProfile() {
    console.log('👤 Opening profile page');
    window.open('https://fillora.figma.site/profile', '_blank');
}

function openSignup() {
    console.log('📝 Opening signup page');
    window.open('https://fillora.figma.site', '_blank');
}

function openHelp() {
    console.log('❓ Opening help center');
    window.open('https://fillora.figma.site/help', '_blank');
}

// ==================== INITIALIZATION ====================
async function init() {
    console.log('🔄 [INIT] Initializing Fillora extension...');
    
    const loadingScreen = document.getElementById('loading-screen');
    
    // Add CSS animations
    addAnimationStyles();
    
    try {
        // Check authentication status
        const response = await chrome.runtime.sendMessage({ action: 'GET_AUTH_STATUS' });
        
        if (response && response.isAuthenticated && response.user) {
            appState.isAuthenticated = true;
            appState.user = response.user;
            
            console.log('✅ User authenticated:', response.user.email);
            
            setTimeout(() => {
                if (loadingScreen) loadingScreen.classList.add('hidden');
                showDashboard();
            }, 1500);
        } else {
            console.log('ℹ️ User not authenticated');
            
            setTimeout(() => {
                if (loadingScreen) loadingScreen.classList.add('hidden');
                showAuthScreen();
            }, 1500);
        }
    } catch (error) {
        console.error('❌ Init error:', error);
        
        setTimeout(() => {
            if (loadingScreen) loadingScreen.classList.add('hidden');
            showAuthScreen();
        }, 1500);
    }
}

function addAnimationStyles() {
    if (!document.getElementById('fillora-popup-animations')) {
        const styleSheet = document.createElement('style');
        styleSheet.id = 'fillora-popup-animations';
        styleSheet.textContent = `
            @keyframes slideDown {
                from {
                    transform: translateY(-20px);
                    opacity: 0;
                }
                to {
                    transform: translateY(0);
                    opacity: 1;
                }
            }
            
            @keyframes slideUp {
                from {
                    transform: translateY(0);
                    opacity: 1;
                }
                to {
                    transform: translateY(-20px);
                    opacity: 0;
                }
            }
            
            @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
            
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }
            
            .hidden {
                display: none !important;
            }
        `;
        document.head.appendChild(styleSheet);
    }
}

// ==================== EVENT LISTENERS ====================
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 [DOM] Content loaded, setting up event listeners...');
    
    setTimeout(() => {
        // Auth screen listeners
        const loginBtn = document.getElementById('login-btn');
        if (loginBtn) {
            loginBtn.onclick = function(e) {
                e.preventDefault();
                handleAuth();
            };
        }
        
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.onsubmit = function(e) {
                e.preventDefault();
                handleAuth();
            };
        }
        
        // Enter key on password field
        const passwordField = document.getElementById('password');
        if (passwordField) {
            passwordField.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAuth();
                }
            });
        }
        
        // Dashboard listeners
        const autofillBtn = document.getElementById('autofill-btn');
        if (autofillBtn) {
            autofillBtn.onclick = startAutoFill;
            console.log('✅ AutoFill button listener attached');
        }
        
        const linkedinBtn = document.getElementById('linkedin-automation-btn');
        if (linkedinBtn) {
            linkedinBtn.onclick = startLinkedInAutomation;
            console.log('✅ LinkedIn button listener attached');
        }
        
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.onclick = handleLogout;
            console.log('✅ Logout button listener attached');
        }
        
        const signupBtn = document.getElementById('signup-btn');
        if (signupBtn) {
            signupBtn.onclick = openSignup;
        }
        
        const dashboardBtn = document.getElementById('dashboard-btn');
        if (dashboardBtn) {
            dashboardBtn.onclick = openDashboard;
        }
        
        const profileBtn = document.getElementById('profile-btn');
        if (profileBtn) {
            profileBtn.onclick = openProfile;
        }
        
        const helpBtn = document.getElementById('help-btn');
        if (helpBtn) {
            helpBtn.onclick = openHelp;
        }
        
        // Initialize app
        init();
        
    }, 100);
});

// ==================== UTILITY FUNCTIONS ====================
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ==================== KEYBOARD SHORTCUTS ====================
document.addEventListener('keydown', function(e) {
    // Ctrl/Cmd + Enter to trigger AutoFill
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        if (appState.isAuthenticated && !appState.automation.isRunning) {
            e.preventDefault();
            startAutoFill();
        }
    }
    
    // Ctrl/Cmd + L to trigger LinkedIn
    if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
        if (appState.isAuthenticated && !appState.automation.isRunning) {
            e.preventDefault();
            startLinkedInAutomation();
        }
    }
});

// ==================== PERFORMANCE MONITORING ====================
window.addEventListener('load', function() {
    const loadTime = performance.now();
    console.log(`⚡ Popup loaded in ${loadTime.toFixed(2)}ms`);
});

// ==================== GLOBAL ERROR HANDLER ====================
window.addEventListener('error', function(e) {
    console.error('💥 Global error:', e.error);
    showError('An unexpected error occurred. Please refresh and try again.');
});

window.addEventListener('unhandledrejection', function(e) {
    console.error('💥 Unhandled promise rejection:', e.reason);
    showError('An unexpected error occurred. Please refresh and try again.');
});

console.log('✅ [FILLORA ULTIMATE] Popup system loaded successfully!');
console.log('🎯 Features: Smart AutoFill + Advanced LinkedIn Automation');
console.log('⚡ Keyboard Shortcuts: Ctrl+Enter (AutoFill) | Ctrl+L (LinkedIn)');
console.log('📊 Ready for production use!');