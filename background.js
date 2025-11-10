// Fillora Chrome Extension - PERFECT Background Script
// Original Flawless AutoFill Logic + LinkedIn Automation
console.log('🚀 [FILLORA PERFECT] Loading background script...');

// Config loaded from chrome.storage
let SUPABASE_URL = '';
let SUPABASE_ANON_KEY = '';
let OPENAI_API_KEY = '';
let SESSION_DURATION = 30 * 24 * 60 * 60 * 1000;
let CACHE_DURATION = 10 * 60 * 1000;

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

// ==================== CONFIG LOADING ====================
async function loadSecureConfig() {
  try {
    const result = await chrome.storage.local.get('fillora_config');
    
    if (result.fillora_config) {
      const config = result.fillora_config;
      SUPABASE_URL = config.SUPABASE_URL || '';
      SUPABASE_ANON_KEY = config.SUPABASE_ANON_KEY || '';
      OPENAI_API_KEY = config.OPENAI_API_KEY_BACKGROUND || '';
      SESSION_DURATION = config.SESSION_DURATION || SESSION_DURATION;
      CACHE_DURATION = config.CACHE_DURATION || CACHE_DURATION;
      
      console.log('✅ [CONFIG] Loaded successfully');
      return true;
    }
    
    console.warn('⚠️ [CONFIG] Not found in storage');
    return false;
  } catch (error) {
    console.error('❌ [CONFIG] Failed to load:', error);
    return false;
  }
}

async function ensureConfigLoaded(maxAttempts = 5) {
  if (SUPABASE_URL && SUPABASE_ANON_KEY) return true;
  
  for (let i = 0; i < maxAttempts; i++) {
    const loaded = await loadSecureConfig();
    if (loaded && SUPABASE_URL && SUPABASE_ANON_KEY) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return false;
}

// ==================== INITIALIZATION ====================
chrome.runtime.onInstalled.addListener(async () => {
  console.log('🔄 [INSTALL] Extension installed/updated');
  await loadSecureConfig();
  await loadStoredAuth();
});

chrome.runtime.onStartup.addListener(async () => {
  console.log('🔄 [STARTUP] Extension starting');
  await loadSecureConfig();
  await loadStoredAuth();
});

loadSecureConfig();

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
        
        console.log('✅ [AUTH] Session restored:', result.fillora_user.email);
      } else {
        await clearAuthData();
      }
    }
  } catch (error) {
    console.error('❌ [AUTH] Load error:', error);
  }
}

// ==================== MESSAGE HANDLER ====================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📨 [MESSAGE] Received:', request.action);
  handleMessage(request, sender, sendResponse);
  return true;
});

async function handleMessage(request, sender, sendResponse) {
  try {
    const configLoaded = await ensureConfigLoaded();
    
    switch (request.action) {
      case 'GET_AUTH_STATUS':
        await handleAuthStatus(sendResponse);
        break;
        
      case 'LOGIN_REQUEST':
        if (!configLoaded) {
          sendResponse({ success: false, error: 'Configuration not loaded' });
          return;
        }
        await handleLogin(request.email, request.password, sendResponse);
        break;
        
      case 'LOGOUT_REQUEST':
        await handleLogout(sendResponse);
        break;
        
      case 'FETCH_ALL_DATABASE_TABLES':
        if (!configLoaded) {
          sendResponse({ success: false, error: 'Configuration not loaded' });
          return;
        }
        await fetchAllDatabaseTables(request.userId, sendResponse);
        break;
        
      case 'FETCH_TRIPLE_SOURCE_DATA':
        if (!configLoaded) {
          sendResponse({ success: false, error: 'Configuration not loaded' });
          return;
        }
        await fetchTripleSourceData(request.userId, sendResponse);
        break;
        
      case 'PARSE_REAL_RESUME_CONTENT':
        if (!configLoaded) {
          sendResponse({ success: false, error: 'Configuration not loaded' });
          return;
        }
        await extractResumeWithSmartExperience(request.userId, sendResponse);
        break;
        
      case 'FETCH_RESUME_FILE':
        if (!configLoaded) {
          sendResponse({ success: false, error: 'Configuration not loaded' });
          return;
        }
        await fetchResumeFile(request.userId, sendResponse);
        break;
        
      default:
        sendResponse({ success: false, error: 'Unknown action: ' + request.action });
    }
  } catch (error) {
    console.error('❌ [HANDLER] Error:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// ==================== AUTHENTICATION ====================
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
    console.error('❌ [AUTH] Status check error:', error);
    sendResponse({ success: false, error: 'Auth check failed' });
  }
}

async function handleLogin(email, password, sendResponse) {
  console.log('🔑 [LOGIN] Attempting login for:', email);
  
  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error('Configuration not loaded');
    }
    
    const loginUrl = `${SUPABASE_URL}/auth/v1/token?grant_type=password`;
    
    const response = await fetch(loginUrl, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });
    
    if (!response.ok) {
      let errorMessage = 'Login failed';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error_description || errorData.msg || errorData.error || 'Login failed';
      } catch (parseError) {
        // If we can't parse the error response, use the status text
        errorMessage = `Login failed: ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }
    
    const data = await response.json();
    
    // Validate the response data structure
    if (!data.user || !data.access_token) {
      throw new Error('Invalid login response format');
    }
    
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
    
    console.log('✅ [LOGIN] Success:', userData.email);
    sendResponse({ 
      success: true, 
      user: userData, 
      sessionExpiry,
      message: 'Login successful'
    });
    
  } catch (error) {
    // Fixed: Properly handle error logging
    console.error('❌ [LOGIN] Error:');
    console.error(error);
    
    // Send only the error message string to the client
    sendResponse({ 
      success: false, 
      error: error.message || 'Login failed'
    });
  }
}

async function handleLogout(sendResponse) {
  try {
    await clearAuthData();
    console.log('✅ [LOGOUT] Success');
    sendResponse({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('❌ [LOGOUT] Error:', error);
    sendResponse({ success: false, error: 'Logout failed' });
  }
}

// ==================== TRIPLE SOURCE DATA (for popup.js compatibility) ====================
async function fetchTripleSourceData(userId, sendResponse) {
  console.log('📊 [TRIPLE-SOURCE] Fetching data...');
  
  if (!extensionState.isAuthenticated || !extensionState.authToken) {
    await loadStoredAuth();
    if (!extensionState.isAuthenticated) {
      sendResponse({ success: false, error: 'Not authenticated' });
      return;
    }
  }
  
  try {
    // Fetch both database and resume data
    const databaseData = await fetchDatabaseDataInternal(userId);
    const resumeData = await fetchResumeDataInternal(userId);
    
    // Merge data (resume overrides database)
    const mergedData = { ...databaseData, ...resumeData };
    
    sendResponse({ 
      success: true, 
      data: {
        database: databaseData,
        resume: resumeData,
        merged: mergedData
      }
    });
    
  } catch (error) {
    console.error('❌ [TRIPLE-SOURCE] Error:', error);
    sendResponse({ success: false, error: error.message });
  }
}

async function fetchDatabaseDataInternal(userId) {
  const now = Date.now();
  if (extensionState.lastDatabaseData && extensionState.lastDatabaseFetchTime) {
    if (now - extensionState.lastDatabaseFetchTime < CACHE_DURATION) {
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
    phone: profile.phone || '',
    address: profile.address || '',
    city: profile.city || '',
    state: profile.state || '',
    country: profile.country || 'India',
    pincode: profile.postal_code || '',
    currentCompany: workExp[0]?.company_name || '',
    currentTitle: workExp[0]?.job_title || '',
    totalExperience: calculateDatabaseExperience(workExp),
    expectedSalary: profile.expected_salary || jobPrefs.expected_salary || '',
    noticePeriod: profile.notice_period || jobPrefs.notice_period || '',
    education: education[0]?.degree || '',
    institution: education[0]?.institution || '',
    graduationYear: education[0]?.graduation_year || '',
    fieldOfStudy: education[0]?.field_of_study || '',
    skills: skills.map(s => s.skill_name).filter(Boolean),
    skillsText: skills.map(s => s.skill_name).filter(Boolean).join(', '),
    linkedin: profile.linkedin_url || '',
    github: profile.github_url || '',
    portfolio: profile.portfolio_url || ''
  };
  
  extensionState.lastDatabaseData = databaseData;
  extensionState.lastDatabaseFetchTime = now;
  
  return databaseData;
}

async function fetchResumeDataInternal(userId) {
  console.log('📄 [RESUME] Starting extraction for user:', userId);
  
  const now = Date.now();
  if (extensionState.lastResumeData && extensionState.lastFetchTime) {
    if (now - extensionState.lastFetchTime < CACHE_DURATION) {
      console.log('✅ [RESUME] Using cached data');
      return extensionState.lastResumeData;
    }
  }
  
  try {
    const headers = {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${extensionState.authToken}`,
      'Content-Type': 'application/json'
    };
    
    console.log('🔍 [RESUME] Fetching from user_cvs table...');
    const resumeResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/user_cvs?user_id=eq.${userId}&is_active=eq.true&select=file_url,file_name&order=uploaded_at.desc&limit=1`,
      { headers }
    );
    
    if (!resumeResponse.ok) {
      console.error('❌ [RESUME] Database query failed:', resumeResponse.status);
      return {};
    }
    
    const resumeData = await resumeResponse.json();
    console.log('📄 [RESUME] Database response:', resumeData);
    
    if (!resumeData || resumeData.length === 0) {
      console.warn('⚠️ [RESUME] No resume found in user_cvs table');
      return {};
    }
    
    const resume = resumeData[0];
    console.log('📄 [RESUME] Found file:', resume.file_name, 'URL:', resume.file_url);
    
    // Extract text using OCR
    console.log('🔍 [RESUME] Extracting text with OCR...');
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
    
    if (!ocrResponse.ok) {
      console.error('❌ [RESUME] OCR request failed:', ocrResponse.status);
      return {};
    }
    
    const ocrResult = await ocrResponse.json();
    console.log('📄 [RESUME] OCR response:', ocrResult);
    
    if (!ocrResult.ParsedResults || ocrResult.ParsedResults.length === 0) {
      console.error('❌ [RESUME] OCR extraction failed, no ParsedResults');
      return {};
    }
    
    const extractedText = ocrResult.ParsedResults[0].ParsedText || '';
    console.log('✅ [RESUME] Text extracted, length:', extractedText.length, 'chars');
    console.log('📄 [RESUME] First 500 chars:', extractedText.substring(0, 500));
    
    // Parse with AI if available
    if (OPENAI_API_KEY) {
      console.log('🤖 [RESUME] Parsing with OpenAI...');
      
      try {
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
              content: 'You are a resume parser. Extract ALL information accurately and return valid JSON.'
            }, {
              role: 'user',
              content: `Extract comprehensive information from this resume and return ONLY valid JSON:

Resume Text:
${extractedText.substring(0, 3000)}

Return this exact JSON structure (fill with actual data from resume):
{
  "name": "full name",
  "fullName": "full name",
  "firstName": "first name",
  "lastName": "last name",
  "email": "email address",
  "phone": "phone number",
  "address": "full address",
  "city": "city name",
  "state": "state name",
  "country": "country name",
  "pincode": "postal code",
  "currentCompany": "current company name",
  "currentTitle": "current job title",
  "totalExperience": number_of_years,
  "education": "highest degree",
  "institution": "university name",
  "graduationYear": "year",
  "fieldOfStudy": "field of study",
  "skills": ["skill1", "skill2", "skill3"],
  "skillsText": "comma separated skills",
  "linkedin": "linkedin url",
  "github": "github url",
  "portfolio": "portfolio url"
}`
            }],
            max_tokens: 1500,
            temperature: 0
          })
        });
        
        if (!openaiResponse.ok) {
          console.error('❌ [RESUME] OpenAI request failed:', openaiResponse.status);
          const errorText = await openaiResponse.text();
          console.error('❌ [RESUME] OpenAI error:', errorText);
          return extractFallbackData(extractedText);
        }
        
        const aiData = await openaiResponse.json();
        console.log('🤖 [RESUME] OpenAI response:', aiData);
        
        const content = aiData.choices[0].message.content;
        console.log('📄 [RESUME] AI extracted content:', content);
        
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          console.error('❌ [RESUME] No JSON found in AI response');
          return extractFallbackData(extractedText);
        }
        
        const parsedData = JSON.parse(jsonMatch[0]);
        console.log('✅ [RESUME] Parsed data:', parsedData);
        
        const finalData = processResumeData(parsedData);
        console.log('✅ [RESUME] Final processed data:', finalData);
        
        // Cache the result
        extensionState.lastResumeData = finalData;
        extensionState.lastFetchTime = now;
        
        await chrome.storage.local.set({
          fillora_resume_cache: finalData,
          fillora_cache_time: now
        });
        
        console.log('✅ [RESUME] Extraction complete, fields:', Object.keys(finalData).length);
        return finalData;
        
      } catch (aiError) {
        console.error('❌ [RESUME] AI parsing error:', aiError);
        return extractFallbackData(extractedText);
      }
    } else {
      console.warn('⚠️ [RESUME] No OpenAI key, using fallback extraction');
      return extractFallbackData(extractedText);
    }
    
  } catch (error) {
    console.error('❌ [RESUME] Fatal error:', error);
    console.error('❌ [RESUME] Error stack:', error.stack);
    return {};
  }
}

// Fallback extraction when AI fails
function extractFallbackData(text) {
  console.log('🔄 [RESUME] Using fallback extraction...');
  
  const emailMatch = text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
  const phoneMatch = text.match(/(\+?\d{10,15})/);
  const nameMatch = text.match(/^([A-Z][a-z]+ [A-Z][a-z]+)/m);
  const linkedinMatch = text.match(/linkedin\.com\/in\/[^\s]+/i);
  const githubMatch = text.match(/github\.com\/[^\s]+/i);
  
  // Extract skills
  const skillsMatch = text.match(/skills?:?\s*([^\n]+)/i);
  const skills = skillsMatch ? skillsMatch[1].split(/[,;]/).map(s => s.trim()) : [];
  
  // Extract city and state
  const locationMatch = text.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?),\s*([A-Z][a-z]+)/);
  
  const fallbackData = {
    name: nameMatch?.[0] || '',
    fullName: nameMatch?.[0] || '',
    firstName: nameMatch?.[0]?.split(' ')[0] || '',
    lastName: nameMatch?.[0]?.split(' ')[1] || '',
    email: emailMatch?.[0] || '',
    phone: phoneMatch?.[0] || '',
    address: '',
    city: locationMatch?.[1] || '',
    state: locationMatch?.[2] || '',
    country: 'India',
    pincode: '',
    currentCompany: '',
    currentTitle: '',
    totalExperience: 0,
    education: '',
    institution: '',
    graduationYear: '',
    fieldOfStudy: '',
    skills: skills,
    skillsText: skills.join(', '),
    linkedin: linkedinMatch?.[0] || '',
    github: githubMatch?.[0] || '',
    portfolio: ''
  };
  
  console.log('✅ [RESUME] Fallback extraction complete:', fallbackData);
  return fallbackData;
}

// ==================== DATABASE EXTRACTION (ORIGINAL LOGIC) ====================
async function fetchAllDatabaseTables(userId, sendResponse) {
  console.log('📊 [DATABASE] Fetching ALL tables for user:', userId);
  
  if (!extensionState.isAuthenticated || !extensionState.authToken) {
    await loadStoredAuth();
    if (!extensionState.isAuthenticated) {
      sendResponse({ success: false, error: 'Not authenticated' });
      return;
    }
  }
  
  const now = Date.now();
  if (extensionState.lastDatabaseData && extensionState.lastDatabaseFetchTime) {
    if (now - extensionState.lastDatabaseFetchTime < CACHE_DURATION) {
      console.log('✅ [DATABASE] Using cached data');
      sendResponse({ success: true, data: extensionState.lastDatabaseData });
      return;
    }
  }
  
  try {
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
      name: profile.full_name || (profile.first_name && profile.last_name ? `${profile.first_name} ${profile.last_name}` : ''),
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
      dateOfBirth: profile.date_of_birth || profile.dob || '',
      currentCompany: workExp[0]?.company_name || workExp[0]?.employer || '',
      currentTitle: workExp[0]?.job_title || workExp[0]?.position || profile.current_title || '',
      totalExperience: calculateDatabaseExperience(workExp),
      currentSalary: profile.current_salary || profile.current_ctc || '',
      expectedSalary: profile.expected_salary || profile.expected_ctc || jobPrefs.expected_salary || '',
      noticePeriod: profile.notice_period || jobPrefs.notice_period || '',
      workAuthorization: profile.work_authorization || profile.visa_status || '',
      education: education[0]?.degree || education[0]?.qualification || '',
      institution: education[0]?.institution || education[0]?.university || '',
      graduationYear: education[0]?.graduation_year || education[0]?.passing_year || '',
      fieldOfStudy: education[0]?.field_of_study || education[0]?.specialization || '',
      gpa: education[0]?.gpa || education[0]?.percentage || '',
      skills: skills.length > 0 ? skills.map(s => s.skill_name || s.name).filter(Boolean) : [],
      skillsText: skills.length > 0 ? skills.map(s => s.skill_name || s.name).filter(Boolean).join(', ') : '',
      linkedin: profile.linkedin_url || profile.linkedin || '',
      github: profile.github_url || profile.github || '',
      portfolio: profile.portfolio_url || profile.website || '',
      workHistory: workExp.map(w => ({
        company: w.company_name || w.employer,
        title: w.job_title || w.position,
        startDate: w.start_date,
        endDate: w.end_date || 'Present',
        location: w.location
      })),
      preferredLocations: Array.isArray(jobPrefs.preferred_locations) ? jobPrefs.preferred_locations : [],
      jobType: jobPrefs.job_type || '',
      industry: jobPrefs.industry || profile.industry || ''
    };
    
    extensionState.lastDatabaseData = databaseData;
    extensionState.lastDatabaseFetchTime = now;
    
    await chrome.storage.local.set({
      fillora_database_cache: databaseData,
      fillora_database_cache_time: now
    });
    
    console.log('✅ [DATABASE] Extracted', Object.keys(databaseData).length, 'fields');
    sendResponse({ success: true, data: databaseData });
    
  } catch (error) {
    console.error('❌ [DATABASE] Error:', error);
    sendResponse({ success: false, error: 'Failed to fetch database' });
  }
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

// ==================== RESUME EXTRACTION (ORIGINAL LOGIC) ====================
async function extractResumeWithSmartExperience(userId, sendResponse) {
  console.log('📄 [RESUME] Starting extraction...');
  
  if (!extensionState.isAuthenticated || !extensionState.authToken) {
    await loadStoredAuth();
    if (!extensionState.isAuthenticated) {
      sendResponse({ success: false, error: 'Not authenticated' });
      return;
    }
  }
  
  const now = Date.now();
  if (extensionState.lastResumeData && extensionState.lastFetchTime) {
    if (now - extensionState.lastFetchTime < CACHE_DURATION) {
      console.log('✅ [RESUME] Using cached data');
      sendResponse({ success: true, data: extensionState.lastResumeData });
      return;
    }
  }
  
  try {
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
      console.warn('⚠️ [RESUME] No resume found');
      sendResponse({ success: false, error: 'No resume found' });
      return;
    }
    
    const resume = resumeData[0];
    console.log('📄 [RESUME] Found:', resume.file_name);
    
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
      console.error('❌ [RESUME] OCR failed');
      sendResponse({ success: false, error: 'OCR extraction failed' });
      return;
    }
    
    const extractedText = ocrResult.ParsedResults[0].ParsedText || '';
    console.log('✅ [RESUME] Text extracted, parsing...');
    
    if (OPENAI_API_KEY) {
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
            content: 'Extract ALL information from resume accurately.'
          }, {
            role: 'user',
            content: `Extract: name, email, phone, city, state, country, totalExperience, currentCompany, currentTitle, education, institution, graduationYear, skills, linkedin, github from:\n\n${extractedText.substring(0, 3000)}`
          }],
          max_tokens: 1500,
          temperature: 0
        })
      });
      
      if (openaiResponse.ok) {
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
        
        console.log('✅ [RESUME] Parsed successfully');
        sendResponse({ success: true, data: finalData });
        return;
      }
    }
    
    sendResponse({ success: false, error: 'Resume parsing failed' });
    
  } catch (error) {
    console.error('❌ [RESUME] Error:', error);
    sendResponse({ success: false, error: error.message });
  }
}

function processResumeData(data) {
  return {
    name: data.name || '',
    fullName: data.fullName || data.name || '',
    firstName: data.firstName || (data.name || '').split(' ')[0] || '',
    lastName: data.lastName || (data.name || '').split(' ').slice(1).join(' ') || '',
    email: data.email || '',
    phone: data.phone || '',
    address: data.address || '',
    city: data.city || '',
    state: data.state || '',
    country: data.country || '',
    pincode: data.pincode || '',
    totalExperience: data.totalExperience || 0,
    currentCompany: data.currentCompany || '',
    currentTitle: data.currentTitle || '',
    education: data.education || '',
    institution: data.institution || '',
    graduationYear: data.graduationYear || '',
    fieldOfStudy: data.fieldOfStudy || '',
    skills: data.skills || [],
    skillsText: data.skillsText || (data.skills || []).join(', '),
    linkedin: data.linkedin || '',
    github: data.github || '',
    portfolio: data.portfolio || ''
  };
}

async function fetchResumeFile(userId, sendResponse) {
  try {
    const headers = {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${extensionState.authToken}`,
      'Content-Type': 'application/json'
    };
    
    const resumeResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/user_cvs?user_id=eq.${userId}&is_active=eq.true&select=*&order=uploaded_at.desc&limit=1`,
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
        size: resume.file_size,
        url: resume.file_url
      }
    });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

// ==================== CLEANUP ====================
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

console.log('✅ [FILLORA PERFECT] Background ready!');
console.log('📊 [DATA] Original flawless autofill logic preserved');