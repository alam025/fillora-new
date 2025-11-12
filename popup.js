// Fillora Chrome Extension - FIXED POPUP
// ✅ Button stays DISABLED until automation completes
// ✅ No second click needed
console.log('🚀 [FILLORA POPUP] Loading fixed version...');

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

function showError(message, duration = 5000) {
    console.error('❌ [ERROR]', message);
    
    let errorDiv = document.getElementById('error-message');
    
    if (!errorDiv) {
        const container = document.getElementById('auth-screen') || 
                         document.querySelector('.content') || 
                         document.body;
        errorDiv = document.createElement('div');
        errorDiv.id = 'error-message';
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
        `;
        container.appendChild(errorDiv);
    }
    
    errorDiv.textContent = '❌ ' + message;
    errorDiv.style.display = 'block';
    
    setTimeout(() => {
        if (errorDiv) errorDiv.style.display = 'none';
    }, duration);
}

function showSuccess(message, duration = 3000) {
    console.log('✅ [SUCCESS]', message);
    
    let successDiv = document.getElementById('success-message');
    
    if (!successDiv) {
        const container = document.querySelector('.content') || document.body;
        successDiv = document.createElement('div');
        successDiv.id = 'success-message';
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
        `;
        container.appendChild(successDiv);
    }
    
    successDiv.textContent = '✅ ' + message;
    successDiv.style.display = 'block';
    
    setTimeout(() => {
        if (successDiv) successDiv.style.display = 'none';
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

async function handleAuth() {
    console.log('🔐 [AUTH] Starting...');
    
    const email = document.getElementById('email')?.value?.trim();
    const password = document.getElementById('password')?.value?.trim();
    
    if (!email || !password) {
        showError('Please enter email and password');
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
            
            showSuccess('Welcome back, ' + (response.user.name || 'User') + '!');
            
            setTimeout(() => {
                showDashboard();
            }, 500);
        } else {
            throw new Error(response?.error || 'Authentication failed');
        }
    } catch (error) {
        showError(error.message || 'Login failed');
    } finally {
        if (loginBtn) {
            loginBtn.disabled = false;
            loginBtn.textContent = originalText;
        }
    }
}

async function handleLogout() {
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
        showError('Logout failed');
    }
}

function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function showAuthScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    const authScreen = document.getElementById('auth-screen');
    const dashboard = document.getElementById('dashboard-screen');
    
    if (loadingScreen) loadingScreen.classList.add('hidden');
    if (authScreen) authScreen.classList.remove('hidden');
    if (dashboard) dashboard.classList.add('hidden');
}

function showDashboard() {
    const loadingScreen = document.getElementById('loading-screen');
    const authScreen = document.getElementById('auth-screen');
    const dashboard = document.getElementById('dashboard-screen');
    
    if (loadingScreen) loadingScreen.classList.add('hidden');
    if (authScreen) authScreen.classList.add('hidden');
    if (dashboard) dashboard.classList.remove('hidden');
    
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

async function startAutoFill() {
    if (appState.automation.isRunning) {
        showError('Another automation is running');
        return;
    }

    const autofillBtn = document.getElementById('autofill-btn');
    const originalHTML = autofillBtn?.innerHTML || '🤖 AI AutoFill Ready';
    
    if (autofillBtn) {
        autofillBtn.disabled = true;
        autofillBtn.innerHTML = '⚙️ Starting...';
    }

    appState.automation.isRunning = true;

    try {
        const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!currentTab) {
            throw new Error('No active tab');
        }

        if (autofillBtn) autofillBtn.innerHTML = '📦 Loading...';
        
        try {
            await chrome.scripting.executeScript({
                target: { tabId: currentTab.id },
                files: ['config.js', 'content.js']
            });
            await delay(1000);
        } catch (e) {
            console.log('ℹ️ Script already loaded');
        }

        if (autofillBtn) autofillBtn.innerHTML = '📊 Loading data...';
        
        const userDataResponse = await chrome.runtime.sendMessage({
            action: 'FETCH_TRIPLE_SOURCE_DATA',
            userId: appState.user.id
        });

        if (!userDataResponse.success) {
            throw new Error('Failed to load data');
        }

        if (autofillBtn) autofillBtn.innerHTML = '🤖 Filling...';
        
        const result = await chrome.tabs.sendMessage(currentTab.id, {
            action: 'PERFORM_AUTOFILL',
            userData: userDataResponse.data.merged,
            databaseData: userDataResponse.data.database,
            resumeData: userDataResponse.data.resume
        });

        if (result && result.success) {
            showSuccess(`✅ Filled ${result.fieldsFilled}/${result.totalFields} fields (${result.successRate}%)`);
            
            appState.stats.totalAutoFills++;
            updateStats();
            
            if (autofillBtn) {
                autofillBtn.innerHTML = `✅ Filled ${result.fieldsFilled} fields!`;
                autofillBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
            }
        } else {
            throw new Error('AutoFill failed');
        }

    } catch (error) {
        showError('AutoFill failed: ' + error.message);
        
        if (autofillBtn) {
            autofillBtn.innerHTML = '❌ Failed';
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
    }
}

// ==================== LINKEDIN AUTOMATION (KEEPS BUTTON DISABLED!) ====================
async function startLinkedInAutomation() {
    if (appState.automation.isRunning) {
        showError('Already running');
        return;
    }

    console.log('🔗 [LINKEDIN] Starting...');
    
    const linkedinBtn = document.getElementById('linkedin-automation-btn');
    const originalHTML = linkedinBtn?.innerHTML || '🔗 LinkedIn Automation';
    
    // CRITICAL: Disable button immediately and keep it disabled!
    if (linkedinBtn) {
        linkedinBtn.disabled = true;
        linkedinBtn.innerHTML = '⚙️ Initializing...';
    }

    appState.automation.isRunning = true;
    appState.automation.currentAction = 'linkedin';
    appState.automation.startTime = Date.now();

    try {
        const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!currentTab) {
            throw new Error('No active tab');
        }

        // Check if on LinkedIn
        if (!currentTab.url.includes('linkedin.com')) {
            if (linkedinBtn) linkedinBtn.innerHTML = '🔗 Opening LinkedIn...';
            showInfo('Navigating to LinkedIn...');
            
            await chrome.tabs.update(currentTab.id, {
                url: 'https://www.linkedin.com/jobs/search/?f_AL=true&sortBy=DD&f_TPR=r86400&keywords=Data+Analyst&location=India'
            });
            await delay(8000);
        }

        // Inject script
        if (linkedinBtn) linkedinBtn.innerHTML = '📦 Loading system...';
        
        try {
            await chrome.scripting.executeScript({
                target: { tabId: currentTab.id },
                files: ['config.js', 'content.js']
            });
            await delay(2000);
        } catch (e) {
            console.log('ℹ️ Script loaded');
        }

        // Load data
        if (linkedinBtn) linkedinBtn.innerHTML = '📊 Loading data...';
        
        const userDataResponse = await chrome.runtime.sendMessage({
            action: 'FETCH_TRIPLE_SOURCE_DATA',
            userId: appState.user.id
        });

        if (!userDataResponse.success) {
            throw new Error('Failed to load data');
        }

        // CRITICAL: Send message and DON'T re-enable button until completion!
        if (linkedinBtn) linkedinBtn.innerHTML = '🚀 Running automation...';
        
        console.log('📤 [POPUP] Sending START message...');
        
        // Send message with callback to handle completion
        chrome.tabs.sendMessage(currentTab.id, {
            action: 'START_LINKEDIN_AUTOMATION',
            userData: userDataResponse.data.merged,
            databaseData: userDataResponse.data.database,
            resumeData: userDataResponse.data.resume
        }, (response) => {
            console.log('📥 [POPUP] Received response:', response);
            
            if (chrome.runtime.lastError) {
                console.log('ℹ️ [POPUP] Message sent (popup may have closed)');
                
                // Re-enable button after automation completes
                if (linkedinBtn) {
                    linkedinBtn.disabled = false;
                    linkedinBtn.innerHTML = originalHTML;
                    linkedinBtn.style.background = '';
                }
                appState.automation.isRunning = false;
                
            } else if (response && response.success) {
                console.log('✅ [POPUP] Automation completed successfully');
                
                appState.stats.totalLinkedInApps += (response.applicationsSubmitted || 0);
                updateStats();
                
                showSuccess(`✅ Done!\nSubmitted: ${response.applicationsSubmitted}/5`);
                
                if (linkedinBtn) {
                    linkedinBtn.innerHTML = `✅ Submitted ${response.applicationsSubmitted}/5!`;
                    linkedinBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
                }
                
                // Re-enable button after 4 seconds
                setTimeout(() => {
                    if (linkedinBtn) {
                        linkedinBtn.disabled = false;
                        linkedinBtn.innerHTML = originalHTML;
                        linkedinBtn.style.background = '';
                    }
                    appState.automation.isRunning = false;
                }, 4000);
                
            } else {
                // Error case
                showError('Automation failed');
                
                if (linkedinBtn) {
                    linkedinBtn.innerHTML = '❌ Failed';
                    linkedinBtn.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
                }
                
                setTimeout(() => {
                    if (linkedinBtn) {
                        linkedinBtn.disabled = false;
                        linkedinBtn.innerHTML = originalHTML;
                        linkedinBtn.style.background = '';
                    }
                    appState.automation.isRunning = false;
                }, 4000);
            }
        });
        
        // Show immediate feedback
        showSuccess('✅ Automation started!\n\nRunning in background.\nCheck console (F12) for progress.', 6000);
        
        console.log('✅ [POPUP] Message sent successfully');
        console.log('ℹ️ [POPUP] Open console (F12) for live progress');

    } catch (error) {
        console.error('❌ [POPUP] Error:', error);
        showError('Failed: ' + error.message);
        
        if (linkedinBtn) {
            linkedinBtn.innerHTML = '❌ Failed';
            linkedinBtn.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
        }
        
        setTimeout(() => {
            if (linkedinBtn) {
                linkedinBtn.disabled = false;
                linkedinBtn.innerHTML = originalHTML;
                linkedinBtn.style.background = '';
            }
            appState.automation.isRunning = false;
        }, 4000);
    }
}

function openDashboard() {
    window.open('https://fillora.figma.site/dashboard', '_blank');
}

function openProfile() {
    window.open('https://fillora.figma.site/profile', '_blank');
}

function openSignup() {
    window.open('https://fillora.figma.site', '_blank');
}

function openHelp() {
    window.open('https://fillora.figma.site/help', '_blank');
}

async function init() {
    console.log('🔄 [INIT] Starting...');
    
    const loadingScreen = document.getElementById('loading-screen');
    
    try {
        const response = await chrome.runtime.sendMessage({ action: 'GET_AUTH_STATUS' });
        
        if (response && response.isAuthenticated && response.user) {
            appState.isAuthenticated = true;
            appState.user = response.user;
            
            setTimeout(() => {
                if (loadingScreen) loadingScreen.classList.add('hidden');
                showDashboard();
            }, 1500);
        } else {
            setTimeout(() => {
                if (loadingScreen) loadingScreen.classList.add('hidden');
                showAuthScreen();
            }, 1500);
        }
    } catch (error) {
        setTimeout(() => {
            if (loadingScreen) loadingScreen.classList.add('hidden');
            showAuthScreen();
        }, 1500);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 [DOM] Loaded');
    
    setTimeout(() => {
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
        
        const passwordField = document.getElementById('password');
        if (passwordField) {
            passwordField.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAuth();
                }
            });
        }
        
        const autofillBtn = document.getElementById('autofill-btn');
        if (autofillBtn) {
            autofillBtn.onclick = startAutoFill;
        }
        
        const linkedinBtn = document.getElementById('linkedin-automation-btn');
        if (linkedinBtn) {
            linkedinBtn.onclick = startLinkedInAutomation;
        }
        
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.onclick = handleLogout;
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
        
        init();
        
    }, 100);
});

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

console.log('✅ [FILLORA POPUP] Loaded!');
console.log('🎯 Button stays DISABLED until automation completes');