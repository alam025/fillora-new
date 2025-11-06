// Fillora Chrome Extension - PERFECT Background Script
// COMPLETE FIXED VERSION - No JSON Errors + Improved Reliability
console.log('🚀 [FILLORA PERFECT] Loading COMPLETE FIXED background script...');

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
      const errorData = await response.json();
      throw new Error(errorData.error_description || 'Login failed');
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
    
    console.log('✅ [LOGIN] Success:', userData.email);
    sendResponse({ 
      success: true, 
      user: userData, 
      sessionExpiry,
      message: 'Login successful'
    });
    
  } catch (error) {
    console.error('❌ [LOGIN] Error:', error);
    sendResponse({ success: false, error: error.message });
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

// ==================== TRIPLE SOURCE DATA ====================
async function fetchTripleSourceData(userId, sendResponse) {
  console.log('📊 [TRIPLE-SOURCE] Fetching triple source data...');
  
  if (!extensionState.isAuthenticated || !extensionState.authToken) {
    await loadStoredAuth();
    if (!extensionState.isAuthenticated) {
      sendResponse({ success: false, error: 'Not authenticated' });
      return;
    }
  }
  
  try {
    // Fetch both database and resume data in parallel
    const [databaseData, resumeData] = await Promise.all([
      fetchDatabaseDataInternal(userId),
      fetchResumeDataInternal(userId)
    ]);
    
    // Merge data (resume overrides database for conflicts)
    const mergedData = { 
      ...databaseData, 
      ...resumeData,
      // Ensure critical fields are always populated
      name: resumeData.name || databaseData.name,
      email: resumeData.email || databaseData.email,
      phone: resumeData.phone || databaseData.phone,
      city: resumeData.city || databaseData.city,
      currentCompany: resumeData.currentCompany || databaseData.currentCompany,
      currentTitle: resumeData.currentTitle || databaseData.currentTitle
    };
    
    console.log('✅ [TRIPLE-SOURCE] Data merged successfully');
    
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

// ==================== DATABASE DATA EXTRACTION ====================
async function fetchDatabaseDataInternal(userId) {
  const now = Date.now();
  
  // Return cached data if valid
  if (extensionState.lastDatabaseData && extensionState.lastDatabaseFetchTime) {
    if (now - extensionState.lastDatabaseFetchTime < CACHE_DURATION) {
      console.log('✅ [DATABASE] Using cached data');
      return extensionState.lastDatabaseData;
    }
  }
  
  console.log('📊 [DATABASE] Fetching fresh data from database...');
  
  try {
    const headers = {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${extensionState.authToken}`,
      'Content-Type': 'application/json'
    };
    
    // Fetch all user data in parallel
    const [profileRes, workRes, eduRes, jobPrefRes, skillsRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/user_profiles?user_id=eq.${userId}&select=*`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/work_experience?user_id=eq.${userId}&select=*&order=start_date.desc`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/education?user_id=eq.${userId}&select=*&order=graduation_year.desc`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/job_preferences?user_id=eq.${userId}&select=*`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/user_skills?user_id=eq.${userId}&select=*`, { headers })
    ]);
    
    // Check responses
    if (!profileRes.ok) throw new Error(`Profile fetch failed: ${profileRes.status}`);
    if (!workRes.ok) throw new Error(`Work experience fetch failed: ${workRes.status}`);
    if (!eduRes.ok) throw new Error(`Education fetch failed: ${eduRes.status}`);
    
    const profile = (await profileRes.json())[0] || {};
    const workExp = await workRes.json() || [];
    const education = await eduRes.json() || [];
    const jobPrefs = (await jobPrefRes.json())[0] || {};
    const skillsData = await skillsRes.json() || [];
    
    const skills = Array.isArray(skillsData) ? skillsData : [];
    
    // Calculate total experience from work history
    const totalExperience = calculateDatabaseExperience(workExp);
    
    const databaseData = {
      // Personal Info
      name: profile.full_name || '',
      fullName: profile.full_name || '',
      firstName: profile.first_name || '',
      lastName: profile.last_name || '',
      email: profile.email || extensionState.user?.email || '',
      phone: profile.phone || profile.mobile || '',
      
      // Address
      address: profile.address || profile.current_address || '',
      city: profile.city || profile.current_city || '',
      state: profile.state || profile.current_state || '',
      country: profile.country || profile.current_country || 'India',
      pincode: profile.postal_code || profile.zip_code || '',
      
      // Professional
      currentCompany: workExp[0]?.company_name || workExp[0]?.employer || '',
      currentTitle: workExp[0]?.job_title || workExp[0]?.position || '',
      totalExperience: totalExperience,
      currentSalary: profile.current_salary || profile.current_ctc || '',
      expectedSalary: profile.expected_salary || profile.expected_ctc || jobPrefs.expected_salary || '',
      noticePeriod: profile.notice_period || jobPrefs.notice_period || '',
      
      // Education
      education: education[0]?.degree || education[0]?.qualification || '',
      institution: education[0]?.institution || education[0]?.university || '',
      graduationYear: education[0]?.graduation_year || education[0]?.passing_year || '',
      fieldOfStudy: education[0]?.field_of_study || education[0]?.specialization || '',
      
      // Skills
      skills: skills.map(s => s.skill_name || s.name).filter(Boolean),
      skillsText: skills.map(s => s.skill_name || s.name).filter(Boolean).join(', '),
      
      // Social & Links
      linkedin: profile.linkedin_url || profile.linkedin || '',
      github: profile.github_url || profile.github || '',
      portfolio: profile.portfolio_url || profile.website || '',
      
      // Additional data for forms
      dateOfBirth: profile.date_of_birth || profile.dob || '',
      workAuthorization: profile.work_authorization || profile.visa_status || ''
    };
    
    // Cache the results
    extensionState.lastDatabaseData = databaseData;
    extensionState.lastDatabaseFetchTime = now;
    
    await chrome.storage.local.set({
      fillora_database_cache: databaseData,
      fillora_database_cache_time: now
    });
    
    console.log('✅ [DATABASE] Extracted', Object.keys(databaseData).length, 'fields');
    return databaseData;
    
  } catch (error) {
    console.error('❌ [DATABASE] Error:', error);
    
    // Return cached data even if expired as fallback
    if (extensionState.lastDatabaseData) {
      console.log('🔄 [DATABASE] Using expired cache as fallback');
      return extensionState.lastDatabaseData;
    }
    
    return {};
  }
}

function calculateDatabaseExperience(workExp) {
  if (!workExp || workExp.length === 0) return 0;
  
  let totalMonths = 0;
  const currentDate = new Date();
  
  workExp.forEach(job => {
    let startDate, endDate;
    
    // Parse start date
    if (job.start_date) {
      if (typeof job.start_date === 'string') {
        startDate = new Date(job.start_date);
      } else if (job.start_date.includes('-')) {
        startDate = new Date(job.start_date);
      }
    }
    
    // Parse end date or use current date if present
    if (job.end_date && job.end_date.toString().toLowerCase().includes('present')) {
      endDate = currentDate;
    } else if (job.end_date) {
      if (typeof job.end_date === 'string') {
        endDate = new Date(job.end_date);
      } else if (job.end_date.includes('-')) {
        endDate = new Date(job.end_date);
      }
    } else {
      endDate = currentDate;
    }
    
    if (startDate && endDate && !isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
      const months = (endDate.getFullYear() - startDate.getFullYear()) * 12 + 
                    (endDate.getMonth() - startDate.getMonth());
      totalMonths += Math.max(0, months);
    }
  });
  
  const years = totalMonths / 12;
  return Math.round(years * 10) / 10; // Round to 1 decimal place
}

// ==================== RESUME DATA EXTRACTION (FIXED VERSION) ====================
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
  
  // Return cached data if valid
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
    
    console.log('🔍 [RESUME] Fetching resume file from database...');
    const resumeResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/user_cvs?user_id=eq.${userId}&is_active=eq.true&select=file_url,file_name&order=uploaded_at.desc&limit=1`,
      { headers }
    );
    
    if (!resumeResponse.ok) {
      console.error('❌ [RESUME] Database query failed:', resumeResponse.status);
      sendResponse({ success: false, error: 'Resume not found in database' });
      return;
    }
    
    const resumeData = await resumeResponse.json();
    
    if (!resumeData || resumeData.length === 0) {
      console.warn('⚠️ [RESUME] No active resume found');
      sendResponse({ success: false, error: 'No active resume found' });
      return;
    }
    
    const resume = resumeData[0];
    console.log('📄 [RESUME] Found file:', resume.file_name, 'URL:', resume.file_url);
    
    // Extract text using OCR
    console.log('🔍 [RESUME] Extracting text with OCR...');
    const formData = new FormData();
    formData.append('url', resume.file_url);
    formData.append('apikey', 'K86401488788957');
    formData.append('isOverlayRequired', 'false');
    formData.append('OCREngine', '2');
    
    const ocrResponse = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      body: formData
    });
    
    if (!ocrResponse.ok) {
      console.error('❌ [RESUME] OCR request failed:', ocrResponse.status);
      sendResponse({ success: false, error: 'OCR extraction failed' });
      return;
    }
    
    const ocrResult = await ocrResponse.json();
    
    if (!ocrResult.ParsedResults || ocrResult.ParsedResults.length === 0) {
      console.error('❌ [RESUME] OCR failed - no parsed results');
      sendResponse({ success: false, error: 'OCR parsing failed - no text extracted' });
      return;
    }
    
    const extractedText = ocrResult.ParsedResults[0].ParsedText || '';
    console.log('✅ [RESUME] Text extracted, length:', extractedText.length);
    
    if (!extractedText.trim()) {
      console.error('❌ [RESUME] No text content extracted');
      sendResponse({ success: false, error: 'No text content found in resume' });
      return;
    }
    
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
              content: 'You are a resume parser. Extract information accurately and return ONLY valid JSON without any additional text or markdown formatting.'
            }, {
              role: 'user',
              content: `Extract the following information from this resume text and return ONLY valid JSON:

Resume Text:
${extractedText.substring(0, 3500)}

Return this exact JSON structure with the extracted data:
{
  "name": "full name from resume",
  "email": "email address from resume",
  "phone": "phone number from resume",
  "city": "city name from resume", 
  "state": "state name from resume",
  "country": "country name from resume",
  "currentCompany": "current/most recent company",
  "currentTitle": "current/most recent job title",
  "totalExperience": "total years of experience",
  "education": "highest education degree",
  "institution": "university/college name",
  "graduationYear": "graduation year",
  "skills": ["skill1", "skill2", "skill3"]
}

If any field is not found in the resume, use empty string for strings, empty array for skills, and 0 for experience.`
            }],
            max_tokens: 2000,
            temperature: 0.1
          })
        });
        
        if (!openaiResponse.ok) {
          const errorText = await openaiResponse.text();
          console.error('❌ [RESUME] OpenAI request failed:', openaiResponse.status, errorText);
          throw new Error(`OpenAI API failed: ${openaiResponse.status}`);
        }
        
        const aiData = await openaiResponse.json();
        const content = aiData.choices[0].message.content.trim();
        
        console.log('📄 [RESUME] AI response received');
        
        // FIXED JSON PARSING - Multiple attempts with better error handling
        let parsedData;
        let parseSuccess = false;
        
        // Attempt 1: Direct JSON parse
        try {
          parsedData = JSON.parse(content);
          parseSuccess = true;
          console.log('✅ [RESUME] Direct JSON parse successful');
        } catch (firstError) {
          console.log('🔄 [RESUME] First parse failed, trying text extraction...');
          
          // Attempt 2: Extract JSON from text
          try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              parsedData = JSON.parse(jsonMatch[0]);
              parseSuccess = true;
              console.log('✅ [RESUME] JSON extraction successful');
            } else {
              throw new Error('No JSON object found in response');
            }
          } catch (secondError) {
            console.error('❌ [RESUME] JSON extraction failed:', secondError);
          }
        }
        
        if (parseSuccess && parsedData) {
          const finalData = processResumeData(parsedData);
          
          // Cache the result
          extensionState.lastResumeData = finalData;
          extensionState.lastFetchTime = now;
          
          await chrome.storage.local.set({
            fillora_resume_cache: finalData,
            fillora_cache_time: now
          });
          
          console.log('✅ [RESUME] AI parsing completed successfully');
          sendResponse({ success: true, data: finalData });
          return;
        } else {
          throw new Error('Failed to parse AI response as JSON');
        }
        
      } catch (aiError) {
        console.error('❌ [RESUME] AI parsing failed, using fallback:', aiError);
        // Fall back to basic extraction
        const fallbackData = extractFallbackData(extractedText);
        sendResponse({ success: true, data: fallbackData });
        return;
      }
    } else {
      console.log('🔄 [RESUME] No OpenAI key, using fallback extraction');
      const fallbackData = extractFallbackData(extractedText);
      sendResponse({ success: true, data: fallbackData });
      return;
    }
    
  } catch (error) {
    console.error('❌ [RESUME] Fatal error:', error);
    
    // Return cached data even if expired as fallback
    if (extensionState.lastResumeData) {
      console.log('🔄 [RESUME] Using expired cache as fallback');
      sendResponse({ success: true, data: extensionState.lastResumeData });
      return;
    }
    
    sendResponse({ success: false, error: error.message });
  }
}

// Fallback extraction when AI fails
function extractFallbackData(text) {
  console.log('🔄 [RESUME] Using fallback extraction...');
  
  // Enhanced regex patterns for better extraction
  const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  const phoneMatch = text.match(/(?:\+?(\d{1,3}))?[-. (]*(\d{1,4})[-. )]*(\d{1,4})[-. ]*(\d{1,9})/);
  const nameMatch = text.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/m) || 
                   text.match(/([A-Z][a-z]+\s+[A-Z][a-z]+)/);
  
  const linkedinMatch = text.match(/(?:linkedin\.com\/in\/|linkedin\.com\/pub\/)([a-zA-Z0-9-]+)/i);
  const githubMatch = text.match(/github\.com\/([a-zA-Z0-9-]+)/i);
  
  // Enhanced skills extraction
  const skillsSection = text.match(/skills?[:]?\s*([^]*?)(?=\n\n|\n[A-Z]|$)/i);
  let skills = [];
  if (skillsSection) {
    skills = skillsSection[1].split(/[,;•·\-]\s*/)
      .map(s => s.trim())
      .filter(s => s.length > 0 && s.length < 50)
      .slice(0, 20);
  }
  
  // Enhanced location extraction
  const locationMatch = text.match(/([A-Z][a-z]+(?:[\s-][A-Z][a-z]+)*),\s*([A-Z]{2,})/i) ||
                       text.match(/([A-Z][a-z]+(?:[\s-][A-Z][a-z]+)*)(?:\s*,\s*|\s+)([A-Z][a-z]+)/i);
  
  // Enhanced company and title extraction
  const currentCompanyMatch = text.match(/(?:company|employer|organization)[: ]*([^\n,]+)/i) ||
                            text.match(/([A-Z][a-zA-Z& ]+?(?:Inc|LLC|Corp|Ltd|Company))|(?:at\s+)([A-Z][a-zA-Z& ]+)/i);
  
  const currentTitleMatch = text.match(/(?:title|position|role)[: ]*([^\n,]+)/i) ||
                          text.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:Engineer|Developer|Manager|Analyst|Specialist|Designer))/);
  
  // Experience extraction
  const experienceMatch = text.match(/(\d+[\+]?)\s*(?:years?|yrs?)/i) ||
                         text.match(/(\d+)\s*\+\s*years?/i);
  
  const fallbackData = {
    name: nameMatch?.[0]?.trim() || nameMatch?.[1]?.trim() || '',
    fullName: nameMatch?.[0]?.trim() || nameMatch?.[1]?.trim() || '',
    firstName: nameMatch?.[0]?.split(' ')[0] || '',
    lastName: nameMatch?.[0]?.split(' ').slice(1).join(' ') || '',
    email: emailMatch?.[0] || '',
    phone: phoneMatch?.[0] || '',
    address: '',
    city: locationMatch?.[1] || '',
    state: locationMatch?.[2] || '',
    country: 'India',
    pincode: '',
    currentCompany: currentCompanyMatch?.[0] || currentCompanyMatch?.[1] || '',
    currentTitle: currentTitleMatch?.[0] || currentTitleMatch?.[1] || '',
    totalExperience: experienceMatch ? parseInt(experienceMatch[1]) : 0,
    education: '',
    institution: '',
    graduationYear: '',
    fieldOfStudy: '',
    skills: skills,
    skillsText: skills.join(', '),
    linkedin: linkedinMatch ? `https://linkedin.com/in/${linkedinMatch[1]}` : '',
    github: githubMatch ? `https://github.com/${githubMatch[1]}` : '',
    portfolio: ''
  };
  
  console.log('✅ [RESUME] Fallback extraction complete');
  return fallbackData;
}

function processResumeData(data) {
  // Ensure all required fields exist and are properly formatted
  const processed = {
    name: data.name || '',
    fullName: data.fullName || data.name || '',
    firstName: data.firstName || (data.name || '').split(' ')[0] || '',
    lastName: data.lastName || (data.name || '').split(' ').slice(1).join(' ') || '',
    email: data.email || '',
    phone: data.phone || '',
    address: data.address || '',
    city: data.city || '',
    state: data.state || '',
    country: data.country || 'India',
    pincode: data.pincode || '',
    totalExperience: typeof data.totalExperience === 'number' ? data.totalExperience : 
                   parseFloat(data.totalExperience) || 0,
    currentCompany: data.currentCompany || '',
    currentTitle: data.currentTitle || '',
    education: data.education || '',
    institution: data.institution || '',
    graduationYear: data.graduationYear || '',
    fieldOfStudy: data.fieldOfStudy || '',
    skills: Array.isArray(data.skills) ? data.skills : [],
    skillsText: Array.isArray(data.skills) ? data.skills.join(', ') : 
               (data.skillsText || ''),
    linkedin: data.linkedin || '',
    github: data.github || '',
    portfolio: data.portfolio || ''
  };
  
  return processed;
}

// ==================== RESUME FILE FETCH ====================
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
    
    if (!resumeResponse.ok) {
      sendResponse({ success: false, error: 'Failed to fetch resume file' });
      return;
    }
    
    const resumeData = await resumeResponse.json();
    
    if (!resumeData || resumeData.length === 0) {
      sendResponse({ success: false, error: 'No resume file found' });
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
    console.error('❌ [RESUME FILE] Error:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// ==================== DATABASE TABLES FETCH ====================
async function fetchAllDatabaseTables(userId, sendResponse) {
  console.log('📊 [DATABASE] Fetching ALL tables for user:', userId);
  
  if (!extensionState.isAuthenticated || !extensionState.authToken) {
    await loadStoredAuth();
    if (!extensionState.isAuthenticated) {
      sendResponse({ success: false, error: 'Not authenticated' });
      return;
    }
  }
  
  try {
    const databaseData = await fetchDatabaseDataInternal(userId);
    sendResponse({ success: true, data: databaseData });
    
  } catch (error) {
    console.error('❌ [DATABASE] Error:', error);
    sendResponse({ success: false, error: 'Failed to fetch database data' });
  }
}

// ==================== FETCH RESUME DATA INTERNAL ====================
async function fetchResumeDataInternal(userId) {
  const now = Date.now();
  
  // Return cached data if valid
  if (extensionState.lastResumeData && extensionState.lastFetchTime) {
    if (now - extensionState.lastFetchTime < CACHE_DURATION) {
      return extensionState.lastResumeData;
    }
  }
  
  console.log('📄 [RESUME] Fetching fresh resume data...');
  
  try {
    const headers = {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${extensionState.authToken}`,
      'Content-Type': 'application/json'
    };
    
    const resumeResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/user_cvs?user_id=eq.${userId}&is_active=eq.true&select=file_url,file_name&order=uploaded_at.desc&limit=1`,
      { headers }
    );
    
    if (!resumeResponse.ok || !resumeResponse.json) {
      console.error('❌ [RESUME] Database query failed');
      return {};
    }
    
    const resumeData = await resumeResponse.json();
    
    if (!resumeData || resumeData.length === 0) {
      console.warn('⚠️ [RESUME] No resume found');
      return {};
    }
    
    const resume = resumeData[0];
    
    // For internal use, we'll use a simplified approach without OCR to avoid delays
    // Return basic data that can be extracted from file name or use cached data
    if (extensionState.lastResumeData) {
      return extensionState.lastResumeData;
    }
    
    return {};
    
  } catch (error) {
    console.error('❌ [RESUME] Internal fetch error:', error);
    return {};
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
  
  console.log('✅ [CLEANUP] All auth data cleared');
}

console.log('✅ [FILLORA PERFECT] COMPLETE FIXED Background script ready!');
console.log('🔥 FIXES: JSON Parsing ✅ Error Handling ✅ Reliability ✅');