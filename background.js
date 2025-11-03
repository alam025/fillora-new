// Fillora Chrome Extension - Background Script
console.log('🚀 [FILLORA] Background script loading...');

// Import configuration from config.js
// config.js must be loaded before this script in manifest.json
const SUPABASE_URL = window.FILLORA_CONFIG?.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = window.FILLORA_CONFIG?.SUPABASE_ANON_KEY || '';
const OPENAI_API_KEY = window.FILLORA_CONFIG?.OPENAI_API_KEY_BACKGROUND || '';
const SESSION_DURATION = window.FILLORA_CONFIG?.SESSION_DURATION || (30 * 24 * 60 * 60 * 1000);
const CACHE_DURATION = window.FILLORA_CONFIG?.CACHE_DURATION || (10 * 60 * 1000);

// Verify configuration loaded
if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !OPENAI_API_KEY) {
    console.error('❌ [FILLORA] Configuration not loaded! Make sure config.js is loaded first.');
    console.error('Check manifest.json: config.js must be in web_accessible_resources');
} else {
    console.log('✅ [FILLORA] Configuration loaded successfully');
}

let extensionState = {
  isAuthenticated: false,
  user: null,
  authToken: null,
  sessionExpiry: null,
  lastResumeData: null,
  lastFetchTime: null,
  lastDatabaseData: null,
  lastDatabaseFetchTime: null
};

chrome.runtime.onStartup.addListener(async () => {
  console.log('🔄 Starting...');
  await loadStoredAuth();
});

chrome.runtime.onInstalled.addListener(async () => {
  console.log('🔄 Installed/Updated');
  await loadStoredAuth();
});

async function loadStoredAuth() {
  try {
    const result = await chrome.storage.local.get([
      'fillora_user', 
      'fillora_token', 
      'fillora_session_expiry',
      'fillora_resume_cache',
      'fillora_cache_time',
      'fillora_database_cache',
      'fillora_database_cache_time'
    ]);
    
    if (result.fillora_user && result.fillora_token && result.fillora_session_expiry) {
      const now = Date.now();
      if (now < result.fillora_session_expiry) {
        extensionState.user = result.fillora_user;
        extensionState.authToken = result.fillora_token;
        extensionState.sessionExpiry = result.fillora_session_expiry;
        extensionState.isAuthenticated = true;
        
        if (result.fillora_resume_cache && result.fillora_cache_time) {
          extensionState.lastResumeData = result.fillora_resume_cache;
          extensionState.lastFetchTime = result.fillora_cache_time;
        }
        
        if (result.fillora_database_cache && result.fillora_database_cache_time) {
          extensionState.lastDatabaseData = result.fillora_database_cache;
          extensionState.lastDatabaseFetchTime = result.fillora_database_cache_time;
        }
        
        console.log('✅ Session restored:', result.fillora_user.email);
      } else {
        await clearAuthData();
      }
    }
  } catch (error) {
    console.error('❌ Load auth error:', error);
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📨 Message:', request.action);
  handleMessage(request, sender, sendResponse);
  return true;
});

async function handleMessage(request, sender, sendResponse) {
  try {
    switch (request.action) {
      case 'GET_AUTH_STATUS':
        await handleAuthStatus(sendResponse);
        break;
      case 'LOGIN_REQUEST':
        await handleLogin(request.email, request.password, sendResponse);
        break;
      case 'LOGOUT_REQUEST':
        await handleLogout(sendResponse);
        break;
      case 'FETCH_USER_DATA_FOR_AUTOFILL':
        await fetchUserDataForAutofill(request.userId, sendResponse);
        break;
      case 'PARSE_REAL_RESUME_CONTENT':
        await extractResumeWithSmartExperience(request.userId, sendResponse);
        break;
      case 'FETCH_ALL_DATABASE_TABLES':
        await fetchAllDatabaseTables(request.userId, sendResponse);
        break;
      case 'FETCH_RESUME_FILE':
        await fetchResumeFile(request.userId, sendResponse);
        break;
      default:
        sendResponse({ success: false, error: 'Unknown action' });
    }
  } catch (error) {
    console.error('❌ Handler error:', error);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleAuthStatus(sendResponse) {
  try {
    const now = Date.now();
    const isSessionValid = extensionState.isAuthenticated && 
                          extensionState.authToken &&
                          extensionState.sessionExpiry && 
                          now < extensionState.sessionExpiry;
    
    sendResponse({
      success: true,
      isAuthenticated: isSessionValid,
      user: extensionState.user,
      sessionExpiry: extensionState.sessionExpiry
    });
  } catch (error) {
    console.error('❌ Auth status error:', error);
    sendResponse({ success: false, error: 'Auth check failed' });
  }
}

async function handleLogin(email, password, sendResponse) {
  console.log('🔑 Login:', email);
  
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      sendResponse({ 
        success: false, 
        error: errorData.error_description || 'Login failed' 
      });
      return;
    }
    
    const data = await response.json();
    const userData = {
      id: data.user.id,
      email: data.user.email,
      name: data.user.user_metadata?.full_name || data.user.email.split('@')[0]
    };
    
    const sessionExpiry = Date.now() + SESSION_DURATION;
    
    await chrome.storage.local.set({
      fillora_user: userData,
      fillora_token: data.access_token,
      fillora_session_expiry: sessionExpiry
    });
    
    extensionState.user = userData;
    extensionState.authToken = data.access_token;
    extensionState.sessionExpiry = sessionExpiry;
    extensionState.isAuthenticated = true;
    
    console.log('✅ Login success');
    sendResponse({ 
      success: true, 
      user: userData, 
      sessionExpiry
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    sendResponse({ success: false, error: 'Network error' });
  }
}

async function handleLogout(sendResponse) {
  try {
    await clearAuthData();
    console.log('✅ Logout');
    sendResponse({ success: true });
  } catch (error) {
    console.error('❌ Logout error:', error);
    sendResponse({ success: false, error: 'Logout failed' });
  }
}

// MAIN FUNCTION: Fetch comprehensive user data (Database + Resume)
async function fetchUserDataForAutofill(userId, sendResponse) {
  console.log('📊 Fetching comprehensive user data...');
  
  if (!extensionState.isAuthenticated || !extensionState.authToken) {
    await loadStoredAuth();
    if (!extensionState.isAuthenticated) {
      sendResponse({ success: false, error: 'Not authenticated' });
      return;
    }
  }
  
  try {
    // Fetch both database and resume data in parallel
    const [databaseResult, resumeResult] = await Promise.all([
      fetchDatabaseDataInternal(userId),
      fetchResumeDataInternal(userId)
    ]);
    
    // Merge database and resume data (database takes priority)
    const mergedData = {
      ...resumeResult,
      ...databaseResult,
      // Ensure critical fields from database override resume
      name: databaseResult.name || resumeResult.name || '',
      email: databaseResult.email || resumeResult.email || '',
      phone: databaseResult.phone || resumeResult.phone || '',
      totalExperience: databaseResult.totalExperience || resumeResult.totalExperience || 0
    };
    
    console.log('✅ Comprehensive data merged successfully');
    sendResponse({ success: true, data: mergedData });
    
  } catch (error) {
    console.error('❌ Data fetch error:', error);
    sendResponse({ success: false, error: error.message });
  }
}

async function fetchDatabaseDataInternal(userId) {
  const now = Date.now();
  if (extensionState.lastDatabaseData && extensionState.lastDatabaseFetchTime) {
    if (now - extensionState.lastDatabaseFetchTime < CACHE_DURATION) {
      console.log('✅ Using cached database data');
      return extensionState.lastDatabaseData;
    }
  }
  
  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${extensionState.authToken}`,
    'Content-Type': 'application/json'
  };
  
  const [profileRes, workRes, eduRes, jobPrefRes, skillsRes] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/user_profiles?user_id=eq.${userId}&select=*`, { headers }),
    fetch(`${SUPABASE_URL}/rest/v1/work_experience?user_id=eq.${userId}&select=*&order=start_date.desc`, { headers }),
    fetch(`${SUPABASE_URL}/rest/v1/education?user_id=eq.${userId}&select=*&order=graduation_year.desc`, { headers }),
    fetch(`${SUPABASE_URL}/rest/v1/job_preferences?user_id=eq.${userId}&select=*`, { headers }),
    fetch(`${SUPABASE_URL}/rest/v1/user_skills?user_id=eq.${userId}&select=*`, { headers })
  ]);
  
  const profile = (await profileRes.json())[0] || {};
  const workExp = await workRes.json() || [];
  const education = await eduRes.json() || [];
  const jobPrefs = (await jobPrefRes.json())[0] || {};
  const skillsData = await skillsRes.json();
  const skills = Array.isArray(skillsData) ? skillsData : [];
  
  const databaseData = {
    name: profile.full_name || '',
    fullName: profile.full_name || '',
    firstName: profile.first_name || '',
    lastName: profile.last_name || '',
    email: profile.email || extensionState.user?.email || '',
    phone: profile.phone || profile.mobile || '',
    address: profile.address || profile.current_address || '',
    city: profile.city || profile.current_city || '',
    state: profile.state || profile.current_state || '',
    country: profile.country || profile.current_country || 'India',
    pincode: profile.postal_code || profile.zip_code || '',
    currentCompany: workExp[0]?.company_name || '',
    currentTitle: workExp[0]?.job_title || profile.current_title || '',
    totalExperience: calculateDatabaseExperience(workExp),
    currentSalary: profile.current_salary || '',
    expectedSalary: profile.expected_salary || jobPrefs.expected_salary || '',
    noticePeriod: profile.notice_period || jobPrefs.notice_period || '',
    education: education[0]?.degree || '',
    institution: education[0]?.institution || '',
    graduationYear: education[0]?.graduation_year || '',
    fieldOfStudy: education[0]?.field_of_study || '',
    skills: skills.map(s => s.skill_name || s.name).filter(Boolean),
    skillsText: skills.map(s => s.skill_name || s.name).filter(Boolean).join(', '),
    linkedin: profile.linkedin_url || '',
    github: profile.github_url || '',
    portfolio: profile.portfolio_url || '',
    workHistory: workExp.map(w => ({
      company: w.company_name,
      title: w.job_title,
      startDate: w.start_date,
      endDate: w.end_date || 'Present'
    })),
    preferredLocations: Array.isArray(jobPrefs.preferred_locations) ? jobPrefs.preferred_locations : [],
    jobType: jobPrefs.job_type || ''
  };
  
  extensionState.lastDatabaseData = databaseData;
  extensionState.lastDatabaseFetchTime = now;
  await chrome.storage.local.set({
    fillora_database_cache: databaseData,
    fillora_database_cache_time: now
  });
  
  return databaseData;
}

async function fetchResumeDataInternal(userId) {
  const now = Date.now();
  if (extensionState.lastResumeData && extensionState.lastFetchTime) {
    if (now - extensionState.lastFetchTime < CACHE_DURATION) {
      console.log('✅ Using cached resume data');
      return extensionState.lastResumeData;
    }
  }
  
  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${extensionState.authToken}`,
    'Content-Type': 'application/json'
  };
  
  const resumeResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/user_cvs?user_id=eq.${userId}&is_active=eq.true&upload_status=eq.completed&select=file_url,file_name&order=uploaded_at.desc&limit=1`,
    { headers }
  );
  
  const resumeData = await resumeResponse.json();
  if (!resumeData || resumeData.length === 0) {
    throw new Error('No resume found');
  }
  
  const resume = resumeData[0];
  
  // Extract text using OCR
  const formData = new FormData();
  formData.append('url', resume.file_url);
  formData.append('apikey', 'K86401488788957');
  formData.append('isOverlayRequired', 'false');
  formData.append('scale', 'true');
  formData.append('isTable', 'true');
  formData.append('OCREngine', '2');
  
  const ocrResponse = await fetch('https://api.ocr.space/parse/image', {
    method: 'POST',
    body: formData
  });
  
  const ocrResult = await ocrResponse.json();
  if (!ocrResult.ParsedResults || ocrResult.ParsedResults.length === 0) {
    throw new Error('Failed to extract resume text');
  }
  
  const extractedText = ocrResult.ParsedResults[0].ParsedText || '';
  
  // Parse with AI
  const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [{
        role: 'system',
        content: 'Extract resume data and calculate total experience accurately.'
      }, {
        role: 'user',
        content: `Extract all information from this resume:\n\n${extractedText}\n\nReturn JSON with: name, email, phone, address, city, state, country, totalExperience, currentCompany, currentTitle, education, institution, skills, linkedin, github, workHistory`
      }],
      max_tokens: 2000,
      temperature: 0
    })
  });
  
  if (!openaiResponse.ok) {
    return extractFallback(extractedText);
  }
  
  const aiData = await openaiResponse.json();
  const content = aiData.choices[0].message.content;
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  const parsedData = JSON.parse(jsonMatch ? jsonMatch[0] : content);
  
  const finalData = processResumeData(parsedData);
  
  extensionState.lastResumeData = finalData;
  extensionState.lastFetchTime = now;
  await chrome.storage.local.set({
    fillora_resume_cache: finalData,
    fillora_cache_time: now
  });
  
  return finalData;
}

function calculateDatabaseExperience(workExp) {
  if (!workExp || workExp.length === 0) return 0;
  
  let totalMonths = 0;
  const currentYear = new Date().getFullYear();
  
  workExp.forEach(job => {
    const startYear = job.start_date ? parseInt(job.start_date.match(/(\d{4})/)?.[1]) : null;
    const endYear = job.end_date ? 
      (job.end_date.toLowerCase().includes('present') ? currentYear : parseInt(job.end_date.match(/(\d{4})/)?.[1])) 
      : currentYear;
    
    if (startYear && endYear) {
      totalMonths += (endYear - startYear) * 12;
    }
  });
  
  return Math.round(totalMonths / 12 * 10) / 10;
}

function processResumeData(parsedData) {
  let calculatedExperience = parsedData.totalExperience || 0;
  
  if (parsedData.workHistory && parsedData.workHistory.length > 0) {
    const smartExperience = calculateSmartExperience(parsedData.workHistory);
    if (smartExperience > calculatedExperience) {
      calculatedExperience = smartExperience;
    }
  }
  
  return {
    name: parsedData.name || '',
    fullName: parsedData.fullName || parsedData.name || '',
    firstName: parsedData.firstName || '',
    lastName: parsedData.lastName || '',
    email: parsedData.email || '',
    phone: parsedData.phone || '',
    address: parsedData.address || '',
    city: parsedData.city || '',
    state: parsedData.state || '',
    country: parsedData.country || 'India',
    pincode: parsedData.pincode || '',
    totalExperience: calculatedExperience,
    currentCompany: parsedData.currentCompany || '',
    currentTitle: parsedData.currentTitle || '',
    workHistory: parsedData.workHistory || [],
    education: parsedData.education || '',
    institution: parsedData.institution || '',
    graduationYear: parsedData.graduationYear || '',
    skills: parsedData.skills || [],
    skillsText: parsedData.skillsText || '',
    linkedin: parsedData.linkedin || '',
    github: parsedData.github || '',
    portfolio: parsedData.portfolio || ''
  };
}

function calculateSmartExperience(workHistory) {
  if (!workHistory || workHistory.length === 0) return 0;
  
  let totalMonths = 0;
  const currentYear = new Date().getFullYear();
  
  workHistory.forEach(job => {
    let startYear, endYear;
    
    if (job.startDate) {
      const startMatch = job.startDate.match(/(\d{4})/);
      startYear = startMatch ? parseInt(startMatch[1]) : null;
    }
    
    if (job.endDate) {
      if (job.endDate.toLowerCase().includes('present') || 
          job.endDate.toLowerCase().includes('current')) {
        endYear = currentYear;
      } else {
        const endMatch = job.endDate.match(/(\d{4})/);
        endYear = endMatch ? parseInt(endMatch[1]) : currentYear;
      }
    } else {
      endYear = currentYear;
    }
    
    if (startYear && endYear) {
      const yearsWorked = Math.max(endYear - startYear, 0.5);
      totalMonths += yearsWorked * 12;
    }
  });
  
  return Math.round(totalMonths / 12 * 10) / 10;
}

function extractFallback(text) {
  const emailMatch = text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
  const phoneMatch = text.match(/(\+?\d{10,15})/);
  const nameMatch = text.match(/^([A-Z][a-z]+ [A-Z][a-z]+)/m);
  
  return {
    name: nameMatch?.[0] || '',
    email: emailMatch?.[0] || '',
    phone: phoneMatch?.[0] || '',
    totalExperience: 0
  };
}

async function fetchAllDatabaseTables(userId, sendResponse) {
  try {
    const data = await fetchDatabaseDataInternal(userId);
    sendResponse({ success: true, data });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

async function extractResumeWithSmartExperience(userId, sendResponse) {
  try {
    const data = await fetchResumeDataInternal(userId);
    sendResponse({ success: true, data });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

async function fetchResumeFile(userId, sendResponse) {
  try {
    const headers = {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${extensionState.authToken}`,
      'Content-Type': 'application/json'
    };
    
    const resumeResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/user_cvs?user_id=eq.${userId}&is_active=eq.true&select=*&limit=1`,
      { headers }
    );
    
    const resumeData = await resumeResponse.json();
    if (!resumeData || resumeData.length === 0) {
      sendResponse({ success: false, error: 'No resume found' });
      return;
    }
    
    const resume = resumeData[0];
    sendResponse({ 
      success: true, 
      fileData: {
        name: resume.file_name,
        type: resume.file_type,
        url: resume.file_url
      }
    });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

async function clearAuthData() {
  await chrome.storage.local.remove([
    'fillora_user', 
    'fillora_token', 
    'fillora_session_expiry',
    'fillora_resume_cache',
    'fillora_cache_time',
    'fillora_database_cache',
    'fillora_database_cache_time'
  ]);
  
  extensionState = {
    isAuthenticated: false,
    user: null,
    authToken: null,
    sessionExpiry: null,
    lastResumeData: null,
    lastFetchTime: null,
    lastDatabaseData: null,
    lastDatabaseFetchTime: null
  };
}

console.log('✅ [FILLORA] Background script ready!');