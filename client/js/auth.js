// CrowdCity - Authentication Manager

// Global helper to format category names nicely for display
window.formatCategoryName = function(category) {
  if (!category) return '';
  const token = category.toLowerCase().trim();
  const key = `category_${token}`;
  if (window.i18n && typeof window.i18n.t === 'function') {
    const translated = window.i18n.t(key);
    if (translated !== key) {
      return translated;
    }
  }
  const mapping = {
    roads: 'Roads',
    streetlights: 'Streetlights',
    water_supply: 'Water Supply',
    drainage: 'Drainage',
    garbage: 'Garbage',
    traffic: 'Traffic',
    public_property: 'Public Property',
    parks: 'Parks',
    sanitation: 'Sanitation',
    safety_hazard: 'Safety Hazard',
    environment: 'Environment',
    other: 'Other'
  };
  const oldMapping = {
    pothole: 'Roads',
    road: 'Roads',
    streetlight: 'Streetlights',
    leakage: 'Water Supply'
  };
  return mapping[token] || oldMapping[token] || category.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

let resolveAuthInit;
window.authInitPromise = new Promise((resolve) => {
  resolveAuthInit = resolve;
});

let supabaseClient = null;
let isMockAuth = false;

// Fallback MOCK_PROFILES to prevent client-side reference errors in mock auth mode
const MOCK_PROFILES = window.MOCK_PROFILES || [
  { id: 'mock-user-citizen', email: 'citizen@example.com', role: 'citizen', full_name: 'Citizen User', avatar_url: '' },
  { id: 'mock-user-authority', email: 'authority@example.com', role: 'authority', is_verified_authority: true, avatar_url: '' },
  { id: 'mock-user-admin', email: 'admin@example.com', role: 'admin', is_verified_authority: true, avatar_url: '' }
];

// Initialize Supabase Client dynamically from server config
async function initAuth() {
  try {
    const response = await fetch('/api/config');

    // A non-OK response (e.g. 429 Too Many Requests) must NOT trigger mock-auth.
    // Doing so would clear the logged-in user's session and show the Sign-In button.
    // Instead: attempt to recover from a locally cached config, then retry silently.
    if (!response.ok) {
      console.warn(`[Auth] /api/config returned HTTP ${response.status}. Attempting cached-config recovery...`);
      const recovered = _tryInitFromCache();
      if (!recovered) {
        // No cache yet — retry after a short delay without touching the UI.
        console.warn('[Auth] No cached config. Will retry initAuth in 10 s.');
        setTimeout(initAuth, 10000);
      }
      return;
    }

    const config = await response.json();

    const isKeyPlaceholder = !config.supabaseAnonKey || 
                             config.supabaseAnonKey.includes('placeholder') || 
                             config.supabaseAnonKey === '' || 
                             (!config.supabaseAnonKey.startsWith('eyJ') && !config.supabaseAnonKey.startsWith('sb_publishable_'));

    if (!config.supabaseUrl || config.supabaseUrl.includes('placeholder') || config.supabaseUrl === '' || isKeyPlaceholder) {
      console.warn("Using Mock Auth Mode: Supabase API variables are not configured or invalid.");
      isMockAuth = true;
      setupMockSessionListener();
      updateAuthUI();
      syncUserProfileBackground();
      resolveAuthInit();
      return;
    }

    // Persist config so we can recover from transient server errors later.
    try { localStorage.setItem('cc_config_cache', JSON.stringify(config)); } catch (e) {}

    // Initialize real Supabase client
    console.log("[Auth] Connecting to Supabase at URL:", config.supabaseUrl);
    console.log("[Auth] Supabase publishable key prefix detected:", config.supabaseAnonKey ? config.supabaseAnonKey.substring(0, 15) + '...' : 'none');
    supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
    isMockAuth = false;
    localStorage.removeItem('cc_mock_session');
    console.log("Supabase Auth initialized successfully.");
    _attachAuthStateListener();
    updateAuthUI();
    resolveAuthInit();

  } catch (error) {
    // True network failure (server is completely unreachable).
    // Try cached config before giving up and going mock.
    console.error("[Auth] Network error fetching /api/config. Attempting cached-config recovery:", error);
    const recovered = _tryInitFromCache();
    if (!recovered) {
      console.error("[Auth] No cached config. Falling back to mock mode.");
      isMockAuth = true;
      setupMockSessionListener();
      updateAuthUI();
      syncUserProfileBackground();
      resolveAuthInit();
    }
  }
}

// Try to bootstrap Supabase from a previously cached config.
// Returns true if successful, false otherwise.
function _tryInitFromCache() {
  try {
    const raw = localStorage.getItem('cc_config_cache');
    if (!raw) return false;
    const config = JSON.parse(raw);
    const isKeyPlaceholder = !config.supabaseAnonKey || 
                             config.supabaseAnonKey.includes('placeholder') || 
                             (!config.supabaseAnonKey.startsWith('eyJ') && !config.supabaseAnonKey.startsWith('sb_publishable_'));
    if (!config.supabaseUrl || config.supabaseUrl.includes('placeholder') || isKeyPlaceholder) return false;
    supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
    isMockAuth = false;
    localStorage.removeItem('cc_mock_session');
    console.log('[Auth] Supabase initialised from cached config.');
    _attachAuthStateListener();
    updateAuthUI();
    resolveAuthInit();
    return true;
  } catch (e) {
    console.error('[Auth] Failed to init from cache:', e);
    return false;
  }
}

// Attach the Supabase auth-state listener.
// Extracted so it can be called from multiple init paths.
function _attachAuthStateListener() {
  supabaseClient.auth.onAuthStateChange(async (event, session) => {
    // Proper logging for Goal 7: SIGNED_IN, PASSWORD_RECOVERY, SIGNED_OUT
    if (event === 'SIGNED_IN') {
      console.log('[Auth Log] SIGNED_IN event triggered');
    } else if (event === 'PASSWORD_RECOVERY') {
      console.log('[Auth Log] PASSWORD_RECOVERY event triggered');
      localStorage.setItem('cc_password_recovery_active', 'true');
    } else if (event === 'SIGNED_OUT') {
      console.log('[Auth Log] SIGNED_OUT event triggered');
      localStorage.removeItem('cc_password_recovery_active');
    } else {
      console.log(`[Auth] onAuthStateChange event: ${event}`);
    }

    const isRecoveryActive = localStorage.getItem('cc_password_recovery_active') === 'true';

    if (session) {
      localStorage.setItem('cc_session', JSON.stringify(session));

      const path = window.location.pathname;
      const normalizedPath = path.replace(/\.html$/, '');
      const isCitizenLoginPage = (normalizedPath.includes('auth') || normalizedPath.includes('auth.html')) && !normalizedPath.includes('authority-login');
      const isAuthorityLoginPage = normalizedPath.includes('authority-login');
      const isLoginOrRoot = isCitizenLoginPage || isAuthorityLoginPage || normalizedPath.endsWith('/') || normalizedPath.endsWith('/index');
      const isResetPage = normalizedPath.includes('reset-password');

      // Prevent automatic dashboard redirects if recovery is active (Goal 3 & 6)
      if (isLoginOrRoot && !isResetPage && !isRecoveryActive) {
        console.log('[Auth] OAuth SIGNED_IN on login page. Routing user.');
        // Reset routing guard so each fresh sign-in can proceed
        window.cc_routing_in_progress = false;
        await verifyProfileAndRoute(session.user, showAuthAlert);
      } else {
        await fetchAndCacheRole(session.access_token);
        syncUserProfileBackground();

        // If recovery is active and we are not on reset-password.html, redirect to reset-password.html (Goal 6)
        if (isRecoveryActive && !isResetPage) {
          console.log('[Auth] Recovery active. Redirecting to reset-password.html');
          window.location.href = 'reset-password.html';
        }
      }
    } else if (event === 'SIGNED_OUT') {
      console.log('[Auth] SIGNED_OUT event triggered. Clearing session cache.');
      localStorage.removeItem('cc_session');
      localStorage.removeItem('cc_user_role');
      localStorage.removeItem('cc_user_profile');

      const path = window.location.pathname;
      const normalizedPath = path.replace(/\.html$/, '');
      const isCitizenLoginPage = (normalizedPath.includes('auth') || normalizedPath.includes('auth.html')) && !normalizedPath.includes('authority-login');
      const isAuthorityLoginPage = normalizedPath.includes('authority-login');
      const isLoginOrRoot = isCitizenLoginPage || isAuthorityLoginPage || normalizedPath.endsWith('/') || normalizedPath.endsWith('/index');
      const isResetPage = normalizedPath.includes('reset-password');

      if (!isLoginOrRoot && !isResetPage) {
        console.warn('[Auth] Session is inactive on a protected page. Redirecting to login.');
        const isAuthorityPage = normalizedPath.includes('authority-') || normalizedPath.includes('authority') || normalizedPath.includes('admin');
        window.authRouter.redirectToLogin(isAuthorityPage ? 'authority' : 'citizen');
        return;
      }
    } else {
      // For INITIAL_SESSION with session = null, do NOT clear cache immediately
      // if a session is currently stored. Let the getSession() probe handle it.
      if (!localStorage.getItem('cc_session')) {
        localStorage.removeItem('cc_user_role');
        localStorage.removeItem('cc_user_profile');
      }
    }
    updateAuthUI();
  });

  // --- OAuth return handler ---
  // When the user returns from Google OAuth, Supabase exchanges the URL hash
  // tokens and resolves the session BEFORE onAuthStateChange fires. We probe
  // getSession() here so we catch sessions that are already resolved.
  (async () => {
    try {
      const { data: { session }, error } = await supabaseClient.auth.getSession();
      if (error) {
        console.warn('[Auth] getSession() error after listener attach:', error.message);
        return;
      }
      if (session) {
        const path = window.location.pathname;
        const normalizedPath = path.replace(/\.html$/, '');
        const isCitizenLoginPage = (normalizedPath.includes('auth') || normalizedPath.includes('auth.html')) && !normalizedPath.includes('authority-login');
        const isAuthorityLoginPage = normalizedPath.includes('authority-login');
        const isLoginOrRoot = isCitizenLoginPage || isAuthorityLoginPage || normalizedPath.endsWith('/') || normalizedPath.endsWith('/index');
        const isResetPage = normalizedPath.includes('reset-password');
        const isRecoveryActive = localStorage.getItem('cc_password_recovery_active') === 'true';

        if (isLoginOrRoot && !isResetPage && !isRecoveryActive) {
          console.log('[Auth] Session found via getSession() on login page (OAuth return). Routing user.');
          localStorage.setItem('cc_session', JSON.stringify(session));
          // Allow routing even if onAuthStateChange already fired
          window.cc_routing_in_progress = false;
          await verifyProfileAndRoute(session.user, showAuthAlert);
        } else {
          // On dashboard/protected pages: just refresh cache silently
          localStorage.setItem('cc_session', JSON.stringify(session));
          await fetchAndCacheRole(session.access_token);
          updateAuthUI();

          // If recovery is active and we are not on reset-password.html, redirect to reset-password.html (Goal 6)
          if (isRecoveryActive && !isResetPage) {
            console.log('[Auth] Recovery active in session probe. Redirecting to reset-password.html');
            window.location.href = 'reset-password.html';
          }
        }
      } else {
        // Probe returned null session: user is not authenticated.
        // If we had a cached session, clear it now since we're sure it's invalid.
        if (localStorage.getItem('cc_session')) {
          console.log('[Auth] Session probe returned null. Invalidating cache.');
          localStorage.removeItem('cc_session');
          localStorage.removeItem('cc_user_role');
          localStorage.removeItem('cc_user_profile');
          updateAuthUI();

          const path = window.location.pathname;
          const normalizedPath = path.replace(/\.html$/, '');
          const isCitizenLoginPage = (normalizedPath.includes('auth') || normalizedPath.includes('auth.html')) && !normalizedPath.includes('authority-login');
          const isAuthorityLoginPage = normalizedPath.includes('authority-login');
          const isLoginOrRoot = isCitizenLoginPage || isAuthorityLoginPage || normalizedPath.endsWith('/') || normalizedPath.endsWith('/index');
          const isResetPage = normalizedPath.includes('reset-password');

          if (!isLoginOrRoot && !isResetPage) {
            console.warn('[Auth] Session is inactive on a protected page. Redirecting to login.');
            const isAuthorityPage = normalizedPath.includes('authority-') || normalizedPath.includes('authority') || normalizedPath.includes('admin');
            window.authRouter.redirectToLogin(isAuthorityPage ? 'authority' : 'citizen');
          }
        }
      }
    } catch (e) {
      console.warn('[Auth] getSession() probe error:', e);
    }
  })();
}

// Fetch user profile from Express server and cache the role locally
async function fetchAndCacheRole(token) {
  console.log('[Debug Log] Profile loading');
  try {
    const response = await fetch('/api/auth/profile', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (response.ok) {
      const profile = await response.json();
      if (profile && profile.role) {
        localStorage.setItem('cc_user_role', profile.role);
        localStorage.setItem('cc_user_profile', JSON.stringify(profile));
      }
    }
  } catch (err) {
    console.error('Error fetching user role:', err);
  }
}

// Fetch fresh profile in the background and update cache/UI if changed
async function syncUserProfileBackground() {
  console.log('[Debug Log] Profile loading');
  const token = getAuthToken();
  if (!token) return;

  try {
    const response = await fetch('/api/auth/profile', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (response.ok) {
      const freshProfile = await response.json();
      
      if (freshProfile && freshProfile.role) {
        // Update role cache
        localStorage.setItem('cc_user_role', freshProfile.role);

        // Parse cached profile and compare key properties to determine if it has changed
        let hasChanged = true;
        const cachedStr = localStorage.getItem('cc_user_profile');
        if (cachedStr) {
          try {
            const cachedProfile = JSON.parse(cachedStr);
            if (cachedProfile && typeof cachedProfile === 'object') {
              hasChanged = (
                cachedProfile.role !== freshProfile.role ||
                cachedProfile.full_name !== freshProfile.full_name ||
                cachedProfile.email !== freshProfile.email ||
                cachedProfile.is_verified_authority !== (freshProfile.is_verified_authority || freshProfile.is_verified) ||
                cachedProfile.points !== freshProfile.points
              );
            }
          } catch (e) {
            hasChanged = true;
          }
        }

        if (hasChanged) {
          localStorage.setItem('cc_user_profile', JSON.stringify(freshProfile));
          updateAuthUI();
        }
      }
    }
  } catch (err) {
    console.error("Background profile sync failed:", err);
  }
}

// Mock auth session setup
function setupMockSessionListener() {
  window.addEventListener('storage', (e) => {
    if (e.key === 'cc_mock_session') {
      updateAuthUI();
    }
  });
}

// Helper to get active session
function getSession() {
  if (isMockAuth) {
    const mock = localStorage.getItem('cc_mock_session');
    return mock ? JSON.parse(mock) : null;
  }
  const real = localStorage.getItem('cc_session');
  return real ? JSON.parse(real) : null;
}

// Get JWT Token for API header injection
function getAuthToken() {
  const session = getSession();
  if (!session) return null;
  
  if (isMockAuth) {
    const role = getUserRole();
    return `mock-jwt-token-${role}`;
  }
  
  return session.access_token;
}

// Get or refresh JWT Token for API header injection
async function getOrRefreshAccessToken() {
  if (window.authInitPromise) {
    await window.authInitPromise;
  }

  if (typeof isMockAuth !== 'undefined' && isMockAuth) {
    const role = getUserRole();
    return `mock-jwt-token-${role}`;
  }

  if (typeof supabaseClient !== 'undefined' && supabaseClient) {
    try {
      const { data: { session }, error } = await supabaseClient.auth.getSession();
      if (!error && session) {
        localStorage.setItem('cc_session', JSON.stringify(session));
        return session.access_token;
      }
    } catch (e) {
      console.error("Error retrieving fresh session in getOrRefreshAccessToken:", e);
    }
  }

  const session = getSession();
  return session ? session.access_token : null;
}
window.getOrRefreshAccessToken = getOrRefreshAccessToken;

// Get User Profile information
function getCurrentUser() {
  const session = getSession();
  return session ? session.user : null;
}

// Get User Role (Citizen, Authority, Admin)
function getUserRole() {
  if (isMockAuth) {
    const session = getSession();
    return session && session.user ? session.user.role : null;
  }
  return localStorage.getItem('cc_user_role');
}

// Global flag to prevent multiple routing triggers
window.cc_routing_in_progress = false;

// Alert banner display helper
function showAuthAlert(msg, isSuccess = false) {
  const alertBanner = document.getElementById('auth-alert');
  if (!alertBanner) return;
  alertBanner.textContent = msg;
  if (isSuccess) {
    alertBanner.className = 'alert-banner success';
    alertBanner.style.backgroundColor = 'rgba(16, 185, 129, 0.15)';
    alertBanner.style.color = '#10b981';
  } else {
    alertBanner.className = 'alert-banner error';
    alertBanner.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
    alertBanner.style.color = '#ef4444';
  }
  alertBanner.classList.remove('hidden');
}

// Clear session helper without redirect
async function clearSessionSilent() {
  // Reset routing guard so the next login attempt is not blocked
  window.cc_routing_in_progress = false;

  localStorage.removeItem('cc_session');
  localStorage.removeItem('cc_mock_session');
  localStorage.removeItem('cc_user_role');
  localStorage.removeItem('cc_user_profile');
  localStorage.removeItem('cc_unread_notifications_count');
  localStorage.removeItem('cc_user_stat_total');
  localStorage.removeItem('cc_user_stat_resolved');
  localStorage.removeItem('cc_user_stat_active');

  if (!isMockAuth && supabaseClient) {
    try {
      await supabaseClient.auth.signOut();
    } catch (e) {
      console.error('Supabase signOut error in clearSessionSilent:', e);
    }
  }
  updateAuthUI();
}

// Restore submit button states helper
function restoreSubmitButtons() {
  const loginBtn = document.getElementById('btn-login-submit');
  if (loginBtn) {
    loginBtn.disabled = false;
    const path = window.location.pathname;
    const normalizedPath = path.replace(/\.html$/, '');
    loginBtn.innerHTML = normalizedPath.includes('authority-login')
      ? '<i class="fa-solid fa-right-to-bracket"></i> Access Dashboard'
      : '<i class="fa-solid fa-right-to-bracket"></i> Sign In';
  }
  const signupBtn = document.getElementById('btn-signup-submit');
  if (signupBtn) {
    signupBtn.disabled = false;
    signupBtn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Create Account';
  }
}

// Core routing verification function
async function verifyProfileAndRoute(user, showAlert) {
  console.log("[Auth Client] verifyProfileAndRoute triggered for user ID:", user ? user.id : 'none', "Email:", user ? user.email : 'none');
  if (window.cc_routing_in_progress) {
    console.warn("[Auth Client] Routing already in progress, ignoring subsequent call.");
    return;
  }
  window.cc_routing_in_progress = true;

  console.log("AUTH SUCCESS");

  let profile = null;

  if (isMockAuth) {
    console.log("[Mock Auth] Simulating profile fetch...");
    const mockUserId = user.id;
    const found = MOCK_PROFILES.find(p => p.id === mockUserId || p.email === user.email);
    if (found) {
      profile = {
        role: found.role,
        is_verified: found.is_verified_authority
      };
    }
  } else {
    try {
      const supabase = supabaseClient;
      console.log(`[Auth Client] Querying profiles table for user ID: ${user.id}...`);
      const { data, error } = await supabase
        .from('profiles')
        .select('role,is_verified:is_verified_authority')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error("[Auth Client] Error fetching profile from Supabase:", error.message || error);
      } else {
        console.log("[Auth Client] Profile queried successfully from Supabase:", data);
        profile = data;
      }
    } catch (err) {
      console.error("[Auth Client] Unexpected exception during profile fetch:", err);
    }
  }

  if (!profile) {
    console.warn("Profile record not found");
    window.cc_routing_in_progress = false;
    await clearSessionSilent();
    showAlert("Profile record not found");
    restoreSubmitButtons();
    return;
  }

  console.log("PROFILE FOUND");
  console.log("- User ID:", user.id);
  console.log("- Email:", user.email);
  console.log("- Role:", profile.role);
  console.log("- Is Verified:", profile.is_verified);

  const role = profile.role;
  if (!role) {
    console.warn("Role not detected in profile");
    window.cc_routing_in_progress = false;
    await clearSessionSilent();
    showAlert("Profile record not found");
    restoreSubmitButtons();
    return;
  }

  // Enforce strict portal-role boundaries
  const path = window.location.pathname;
  const normalizedPath = path.replace(/\.html$/, '');
  const isAuthorityLoginPage = normalizedPath.includes('authority-login');

  if (isAuthorityLoginPage) {
    if (role === 'citizen') {
      console.log("AUTHORITY PORTAL LOGIN ATTEMPT");
      console.log("ROLE DETECTED: citizen");
      console.log("ACCESS DENIED: WRONG PORTAL");
      window.cc_routing_in_progress = false;
      await clearSessionSilent();
      showAlert("Citizen accounts cannot access the Authority Portal.");
      restoreSubmitButtons();
      return;
    }
  } else {
    if (role !== 'citizen') {
      console.log("AUTH PORTAL LOGIN ATTEMPT");
      console.log("ROLE DETECTED: " + role);
      console.log("ACCESS DENIED: WRONG PORTAL");
      window.cc_routing_in_progress = false;
      await clearSessionSilent();
      showAlert("This account belongs to the Authority Portal. Please use the Authority Login page.");
      restoreSubmitButtons();
      return;
    }
  }

  console.log("ROLE DETECTED: " + role);

  let redirectTarget = null;
  if (role === 'authority') {
    if (profile.is_verified === true) {
      redirectTarget = 'authority-dashboard.html';
    } else {
      console.warn("Authority user is not verified");
      window.cc_routing_in_progress = false;
      await clearSessionSilent();
      showAlert("Access Denied: Your authority account is not yet verified by an administrator.");
      restoreSubmitButtons();
      return;
    }
  } else if (role === 'citizen') {
    redirectTarget = 'citizen-dashboard.html';
  } else if (role === 'admin') {
    redirectTarget = 'admin.html';
  } else {
    console.warn("Unknown role designated:", role);
    window.cc_routing_in_progress = false;
    await clearSessionSilent();
    showAlert("Unauthorized role designations.");
    restoreSubmitButtons();
    return;
  }

  console.log("REDIRECT TARGET");
  console.log("Redirecting to:", redirectTarget);

  // Cache session info
  localStorage.setItem('cc_user_role', role);
  
  // Set user profile in localStorage so other components can access full_name etc.
  const storedProfile = {
    role: role,
    is_verified_authority: profile.is_verified,
    full_name: user.user_metadata?.full_name || (role === 'authority' ? 'Inspector' : (role === 'admin' ? 'Admin' : 'Citizen')),
    email: user.email
  };
  localStorage.setItem('cc_user_profile', JSON.stringify(storedProfile));

  const provider = user?.app_metadata?.provider;
  const flow = provider === 'google' ? 'GOOGLE_LOGIN' : 'NORMAL_LOGIN';
  console.log("FLOW DETECTED: " + flow);
  console.log("ROLE DETECTED: " + role);
  console.log("TARGET PAGE: " + redirectTarget);

  const successOverlay = document.getElementById('auth-success-overlay');
  if (successOverlay) {
    const fullName = user.user_metadata?.full_name || user.email || 'Citizen';
    const nameElem = document.getElementById('success-user-name');
    if (nameElem) nameElem.textContent = fullName;
    
    // Hide standard alerts since success overlay covers the screen
    const alertBanner = document.getElementById('auth-alert');
    if (alertBanner) alertBanner.classList.add('hidden');
    
    successOverlay.classList.remove('hidden-field');
    
    setTimeout(() => {
      document.body.style.transition = 'opacity 0.5s ease-out';
      document.body.style.opacity = '0';
      setTimeout(() => {
        window.authRouter.redirectToDashboard(role);
      }, 500);
    }, 1000);
  } else {
    showAlert("Login successful! Redirecting...", true);
    setTimeout(() => {
      window.authRouter.redirectToDashboard(role);
    }, 1000);
  }
}

window.verifyProfileAndRoute = verifyProfileAndRoute;

// Register a new user
async function registerUser(email, password, fullName) {
  if (isMockAuth) {
    const mockSession = {
      access_token: 'mock-jwt-token-citizen',
      user: {
        id: 'mock-user-id-' + Date.now(),
        email: email,
        role: 'citizen',
        user_metadata: { full_name: fullName }
      }
    };
    localStorage.setItem('cc_mock_session', JSON.stringify(mockSession));
    updateAuthUI();

    // Trigger mock welcome email immediately
    try {
      fetch('/api/auth/send-welcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email,
          userId: mockSession.user.id,
          fullName: fullName
        })
      }).catch(e => console.warn('[Auth] Mock welcome email trigger failed:', e));
    } catch (e) {}

    return { data: mockSession, error: null };
  }

  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName
      }
    }
  });

  // Trigger welcome email immediately after successful registration
  if (!error && data && data.user) {
    console.log('[Auth] Signup successful. Triggering immediate welcome email for:', data.user.email);
    fetch('/api/auth/send-welcome', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: data.user.email,
        userId: data.user.id,
        fullName: fullName
      })
    })
    .then(async (res) => {
      const result = await res.json();
      console.log('[Auth] Send welcome email response:', result);
    })
    .catch((err) => {
      console.error('[Auth] Failed to trigger send-welcome API:', err);
    });
  }

  return { data, error };
}

// Sign in with email and password
async function loginUser(email, password) {
  console.log(`[Auth Client] Attempting Email/Password login for: ${email}`);
  if (isMockAuth) {
    let mockRole = 'citizen';
    if (email.includes('authority') || email.includes('inspector')) mockRole = 'authority';
    else if (email.includes('admin')) mockRole = 'admin';
    const mockSession = {
      access_token: `mock-jwt-token-${mockRole}`,
      user: {
        id: `mock-user-${mockRole}`,
        email,
        role: mockRole,
        user_metadata: { full_name: email.split('@')[0] }
      }
    };
    console.log('[Auth Client] Mock Mode Active. Returning mock session:', mockSession);
    localStorage.setItem('cc_mock_session', JSON.stringify(mockSession));
    updateAuthUI();
    return { data: mockSession, error: null };
  }
  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
      console.error('[Auth Client] Supabase signInWithPassword error:', error.message || error);
    } else {
      console.log('[Auth Client] Supabase signInWithPassword success. User ID:', data.user ? data.user.id : 'none');
    }
    return { data, error };
  } catch (err) {
    console.error('[Auth Client] Supabase signInWithPassword unexpected exception:', err);
    return { data: null, error: err };
  }
}

// Sign in with Google OAuth
async function loginWithGoogle() {
  console.log('[Auth Client] Attempting Google OAuth login...');
  if (isMockAuth) {
    const mockSession = {
      access_token: 'mock-jwt-token-citizen',
      user: {
        id: 'mock-user-id-google-' + Date.now(),
        email: 'googleuser@example.com',
        role: 'citizen',
        user_metadata: {
          full_name: 'Google Citizen',
          avatar_url: ''
        }
      }
    };
    console.log('[Auth Client] Mock Mode Active. Returning mock Google session:', mockSession);
    localStorage.setItem('cc_mock_session', JSON.stringify(mockSession));
    updateAuthUI();
    return { data: mockSession, error: null };
  }

  // redirectTo must point to auth.html (the page that loads the Supabase SDK).
  // Supabase appends the OAuth session tokens to the URL hash; auth.js then
  // exchanges them and fires onAuthStateChange → SIGNED_IN → verifyProfileAndRoute.
  //
  // DO NOT redirect to index.html — auth-router.js runs synchronously there
  // before the SDK loads, sees no cached session, and strips the hash tokens.
  const redirectUrl = window.location.origin + '/auth.html';
  console.log('[Auth Client] Google OAuth redirectTo URL:', redirectUrl);

  try {
    const { data, error } = await supabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        queryParams: {
          prompt: 'select_account'
        }
      }
    });
    if (error) {
      console.error('[Auth Client] Google OAuth signInWithOAuth error:', error.message || error);
    } else {
      console.log('[Auth Client] Google OAuth signInWithOAuth redirected successfully.');
    }
    return { data, error };
  } catch (err) {
    console.error('[Auth Client] Google OAuth unexpected exception:', err);
    return { data: null, error: err };
  }
}

// Send password reset email
async function requestPasswordReset(email) {
  if (isMockAuth) {
    console.log(`Mock: Password reset email sent to ${email}`);
    return { data: {}, error: null };
  }
  
  const { data, error } = await supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/reset-password.html'
  });
  return { data, error };
}

// Update password (used in recovery mode)
async function updatePassword(newPassword) {
  if (isMockAuth) {
    console.log(`Mock: Password updated successfully.`);
    return { data: {}, error: null };
  }

  const { data, error } = await supabaseClient.auth.updateUser({
    password: newPassword
  });
  return { data, error };
}

// Verify current password and update password (used in settings page)
async function verifyAndChangePassword(currentPassword, newPassword) {
  if (isMockAuth) {
    console.log(`Mock: Verifying current password and updating to new password.`);
    if (!currentPassword) {
      return { error: { message: "Current password is required." } };
    }
    return { data: {}, error: null };
  }

  const session = getSession();
  if (!session || !session.user || !session.user.email) {
    return { error: { message: "User session not found. Please sign in again." } };
  }

  const isGoogleUser = session.user.app_metadata && session.user.app_metadata.provider === 'google';

  if (!isGoogleUser) {
    // Re-authenticate by signing in with the current password
    const { error: signInError } = await supabaseClient.auth.signInWithPassword({
      email: session.user.email,
      password: currentPassword
    });

    if (signInError) {
      console.error("[Auth] Current password verification failed:", signInError.message);
      return { error: { message: "Incorrect current password." } };
    }
  }

  // Update password
  const { data, error: updateError } = await supabaseClient.auth.updateUser({
    password: newPassword
  });

  return { data, error: updateError };
}

// Change mock role (Development Testing Utility)
function changeMockRole(role) {
  const session = getSession();
  if (session && session.user) {
    session.user.role = role;
    localStorage.setItem('cc_mock_session', JSON.stringify(session));
    console.log(`Mock role changed to: ${role}`);
    updateAuthUI();
    // Dispatch event to force update components on other pages if listening
    window.dispatchEvent(new Event('auth-change'));
    // Reload feed if on dashboard page
    if (typeof loadAndRenderIssues === 'function') {
       loadAndRenderIssues();
    } else if (typeof loadIssueDetails === 'function') {
       loadIssueDetails();
    }
  }
}
window.changeMockRole = changeMockRole;

// Sign out user
async function logoutUser() {
  const role = getUserRole(); // Get role before clearing cache
  console.log('[Auth Client] Logging out user. Current role:', role);

  // 1. Show loading overlay
  let overlay = document.getElementById('cc-logout-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'cc-logout-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.backgroundColor = 'var(--bg-app, #0f172a)'; // match dark theme
    overlay.style.zIndex = '99999';
    overlay.style.display = 'flex';
    overlay.style.flexDirection = 'column';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.color = 'var(--text-main, #ffffff)';
    overlay.style.fontFamily = 'var(--font-body, sans-serif)';
    overlay.style.gap = '1rem';
    overlay.style.visibility = 'visible';
    
    overlay.innerHTML = `
      <i class="fa-solid fa-spinner fa-spin fa-2x" style="color: var(--primary, #4f46e5);"></i>
      <span style="font-weight: 600; font-size: 1.1rem;">Signing out...</span>
    `;
    document.body.appendChild(overlay);
  }
  overlay.style.display = 'flex';
  
  // Hide page body to prevent dashboard layout updates/rendering
  document.body.style.visibility = 'hidden';

  // 2. await supabaseClient.auth.signOut()
  if (!isMockAuth && supabaseClient) {
    try {
      console.log('[Auth Client] Calling supabaseClient.auth.signOut()...');
      await supabaseClient.auth.signOut();
      console.log('[Auth Client] Supabase signOut completed successfully.');
    } catch (e) {
      console.error("[Auth Client] Supabase signOut error in logoutUser:", e);
    }
  }

  // 3. clear local session state
  console.log('[Auth Client] Clearing all cached credentials and states from localStorage.');
  localStorage.removeItem('cc_session');
  localStorage.removeItem('cc_mock_session');
  localStorage.removeItem('cc_user_role');
  localStorage.removeItem('cc_user_profile');
  localStorage.removeItem('cc_unread_notifications_count');
  localStorage.removeItem('cc_user_stat_total');
  localStorage.removeItem('cc_user_stat_resolved');
  localStorage.removeItem('cc_user_stat_active');
  localStorage.removeItem('cc_my_complaints');
  localStorage.removeItem('cc_notifications_cache');

  // 4. redirect to auth.html / authority-login.html
  updateAuthUI();
  console.log('[Auth Client] Redirecting to login target for role:', role || 'citizen');
  window.authRouter.redirectToLogin(role || 'citizen');
}


// Update Header Navigation UI depending on active state
// Globally accessible toast notification function
window.showToast = function(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let icon = '<i class="fa-solid fa-circle-info"></i>';
  if (type === 'success') icon = '<i class="fa-solid fa-circle-check"></i>';
  else if (type === 'error') icon = '<i class="fa-solid fa-circle-exclamation"></i>';
  else if (type === 'warning') icon = '<i class="fa-solid fa-triangle-exclamation"></i>';

  toast.innerHTML = `
    <div class="toast-icon">${icon}</div>
    <div class="toast-content">${message}</div>
    <button class="toast-close" onclick="this.parentElement.remove()"><i class="fa-solid fa-xmark"></i></button>
  `;

  container.appendChild(toast);
  
  // Trigger animation after adding to DOM
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);

  // Auto-remove after 4 seconds
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 4000);
};

// Update Header Navigation UI depending on active state
function updateAuthUI() {
  const user = getCurrentUser();
  if (user) {
    document.body.classList.add('ready');
    document.body.style.visibility = 'visible';
  }

  const container = document.getElementById('auth-nav-container');
  const navMenu = document.getElementById('nav-menu');

  // Overwrite the entire navigation list dynamically to maintain 100% layout sync
  if (navMenu) {
    const role = getUserRole();
    const path = window.location.pathname;
    let linksHtml = '';

    if (user) {
      const tDashboard = window.i18n ? window.i18n.t('nav_dashboard') : 'Dashboard';
      const tCases = window.i18n ? window.i18n.t('nav_cases') : 'Cases';
      const tNotifications = window.i18n ? window.i18n.t('nav_notifications') : 'Notifications';
      const tAdminPanel = window.i18n ? window.i18n.t('nav_admin') : 'Admin Panel';
      const tReportIssue = window.i18n ? window.i18n.t('nav_report') : 'Report Issue';
      const tMyComplaints = window.i18n ? window.i18n.t('nav_my_complaints') : 'My Complaints';
      const tMap = window.i18n ? window.i18n.t('nav_map') : 'Map';

      if (role === 'authority' || role === 'admin') {
        const isDashboard = path.includes('authority-dashboard.html');
        const isReports = path.includes('authority-reports.html') || path.includes('authority-issue-details.html');
        const isNotifications = path.includes('authority-notifications.html');

        linksHtml = `
          <a href="authority-dashboard.html" class="nav-link ${isDashboard ? 'active' : ''}"><i class="fa-solid fa-house-chimney"></i> ${tDashboard}</a>
          <a href="authority-reports.html" class="nav-link ${isReports ? 'active' : ''}"><i class="fa-solid fa-clipboard-list"></i> ${tCases}</a>
          <a href="authority-notifications.html" class="nav-link ${isNotifications ? 'active' : ''}"><i class="fa-regular fa-bell"></i> ${tNotifications}</a>
        `;
        if (role === 'admin') {
          const isAdmin = path.includes('admin.html');
          linksHtml += `<a href="admin.html" class="nav-link ${isAdmin ? 'active' : ''}"><i class="fa-solid fa-chart-line"></i> ${tAdminPanel}</a>`;
        }
      } else {
        const isDashboard = path.includes('citizen-dashboard.html') || path.endsWith('/') || path.endsWith('/index.html');
        const isReport = path.includes('report.html');
        const isComplaints = path.includes('my-complaints.html') || path.includes('issue-details.html');
        const isMap = path.includes('map.html');

        linksHtml = `
          <a href="citizen-dashboard.html" class="nav-link ${isDashboard ? 'active' : ''}"><i class="fa-solid fa-house-chimney"></i> ${tDashboard}</a>
          <a href="report.html" class="nav-link ${isReport ? 'active' : ''}"><i class="fa-solid fa-triangle-exclamation"></i> ${tReportIssue}</a>
          <a href="my-complaints.html" class="nav-link ${isComplaints ? 'active' : ''}"><i class="fa-solid fa-clipboard-list"></i> ${tMyComplaints}</a>
          <a href="map.html" class="nav-link ${isMap ? 'active' : ''}"><i class="fa-solid fa-map-location-dot"></i> ${tMap}</a>
        `;
      }
    } else {
      const tDashboard = window.i18n ? window.i18n.t('nav_dashboard') : 'Dashboard';
      const tMapView = window.i18n ? window.i18n.t('nav_map') : 'Map View';
      const tReportIssue = window.i18n ? window.i18n.t('nav_report') : 'Report Issue';

      linksHtml = `
        <a href="citizen-dashboard.html" class="nav-link"><i class="fa-solid fa-house-chimney"></i> ${tDashboard}</a>
        <a href="map.html" class="nav-link"><i class="fa-solid fa-map-location-dot"></i> ${tMapView}</a>
        <a href="report.html" class="nav-link"><i class="fa-solid fa-triangle-exclamation"></i> ${tReportIssue}</a>
      `;
    }

    // Preserve the theme toggle and auth container elements
    let authContainer = document.getElementById('auth-nav-container');
    if (!authContainer) {
      authContainer = document.createElement('div');
      authContainer.id = 'auth-nav-container';
    }
    const themeToggle = document.getElementById('header-theme-toggle');

    navMenu.innerHTML = '';
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = linksHtml;
    while (tempDiv.firstChild) {
      navMenu.appendChild(tempDiv.firstChild);
    }

    if (themeToggle) {
      navMenu.appendChild(themeToggle);
    }
    navMenu.appendChild(authContainer);
  }

  // Double check container exists after menu rewrite
  const finalContainer = document.getElementById('auth-nav-container');
  if (!finalContainer) return;

  if (user) {
    const role = getUserRole();
    
    // Retrieve cached profile data
    let cachedProfile = null;
    try {
      const profileStr = localStorage.getItem('cc_user_profile');
      if (profileStr) {
        cachedProfile = JSON.parse(profileStr);
      }
    } catch (e) {
      console.warn("Failed to parse cached user profile", e);
    }

    const defaultName = role === 'admin' ? 'Admin' : (role === 'authority' ? 'Inspector' : 'User');
    const fullName = cachedProfile?.full_name || user.user_metadata?.full_name || defaultName;
    const initial = (fullName && fullName !== defaultName) ? fullName.charAt(0).toUpperCase() : defaultName.charAt(0).toUpperCase();

    if (role === 'authority' || role === 'admin') {
      const tRole = window.i18n ? window.i18n.t('role_' + role) : role;
      const tCitizenOpt = window.i18n ? window.i18n.t('role_citizen') : 'Citizen';
      const tAuthorityOpt = window.i18n ? window.i18n.t('role_authority') : 'Authority';
      const tAdminOpt = window.i18n ? window.i18n.t('role_admin') : 'Admin';
      
      let roleSelectorHtml = `Role: <strong style="color: var(--primary); text-transform: capitalize;">${tRole}</strong>`;
      
      if (isMockAuth) {
        roleSelectorHtml = `
          Role: <select onchange="changeMockRole(this.value)" style="background:var(--bg-app); color:var(--text-main); border:1px solid var(--border-color); border-radius:4px; font-size:0.7rem; padding:1px; cursor:pointer;">
            <option value="citizen" ${role === 'citizen' ? 'selected' : ''}>${tCitizenOpt}</option>
            <option value="authority" ${role === 'authority' ? 'selected' : ''}>${tAuthorityOpt}</option>
            <option value="admin" ${role === 'admin' ? 'selected' : ''}>${tAdminOpt}</option>
          </select>
        `;
      }

      const tProfile = window.i18n ? window.i18n.t('nav_profile') : 'Profile';
      const tSettings = window.i18n ? window.i18n.t('nav_settings') : 'Settings';
      const tSignOut = window.i18n ? window.i18n.t('nav_logout') : 'Sign Out';
      const tRoleLabel = role === 'admin' ? tAdminOpt : (window.i18n ? window.i18n.t('role_authority') : 'Inspector');

      finalContainer.innerHTML = `
        <div class="auth-nav-wrapper">
          <!-- User profile menu -->
          <div class="user-menu" id="user-menu-btn" onclick="toggleUserDropdown()" style="position: relative; display: flex; align-items: center; gap: 0.5rem; cursor: pointer; user-select: none;">
            <div class="user-avatar" style="width: 28px; height: 28px; border-radius: 50%; background-color: var(--primary-light-alpha); color: var(--primary); font-weight: 700; font-size: 0.82rem; display: flex; align-items: center; justify-content: center;">${initial}</div>
            <span style="font-size: 0.9rem; font-weight: 600; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              ${tRoleLabel}: <strong style="color: var(--text-main); font-weight: 700;">${fullName}</strong>
            </span>
            <i class="fa-solid fa-chevron-down" style="font-size: 0.72rem; color: var(--text-muted); transition: transform 0.15s ease;"></i>
            
            <!-- Dropdown Menu -->
            <div id="user-dropdown" class="hidden" style="position: absolute; top: calc(100% + 10px); right: 0; background-color: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); box-shadow: var(--shadow-lg); width: 180px; padding: 0.5rem; display: flex; flex-direction: column; gap: 0.25rem; z-index: 1100;" onclick="event.stopPropagation()">
              <div style="font-size: 0.72rem; padding: 0.4rem 0.5rem; border-bottom: 1px solid var(--border-color); color: var(--text-muted); display: flex; justify-content: space-between; align-items: center;">
                ${roleSelectorHtml}
              </div>
              <a href="${role === 'admin' ? 'admin.html' : 'authority-profile.html'}" class="nav-dropdown-item">
                <i class="fa-regular fa-user" style="width: 16px; color: var(--text-muted);"></i> ${tProfile}
              </a>
              <a href="${role === 'admin' ? 'admin.html' : 'authority-settings.html'}" class="nav-dropdown-item">
                <i class="fa-solid fa-gear" style="width: 16px; color: var(--text-muted);"></i> ${tSettings}
              </a>
              <div style="border-top: 1px solid var(--border-color); margin: 0.15rem 0;"></div>
              <button onclick="logoutUser()" class="nav-dropdown-item btn-logout">
                <i class="fa-solid fa-right-from-bracket" style="width: 16px; color: #ef4444;"></i> ${tSignOut}
              </button>
            </div>
          </div>
        </div>
      `;
      return;
    }

    const tRole = window.i18n ? window.i18n.t('role_' + role) : role;
    const tCitizenOpt = window.i18n ? window.i18n.t('role_citizen') : 'Citizen';
    const tAuthorityOpt = window.i18n ? window.i18n.t('role_authority') : 'Authority';
    const tAdminOpt = window.i18n ? window.i18n.t('role_admin') : 'Admin';

    let roleDisplayHtml = `Role: <span style="font-weight:700; color:var(--primary); text-transform:capitalize;">${tRole}</span>`;
    
    // Add selector for mock mode testing
    if (isMockAuth) {
      roleDisplayHtml = `
        Role: <select onchange="changeMockRole(this.value)" onclick="event.stopPropagation()" style="background:var(--bg-app); color:var(--text-main); border:1px solid var(--border-color); border-radius:4px; font-size:0.75rem; padding:2px; font-weight:600; cursor:pointer;">
          <option value="citizen" ${role === 'citizen' ? 'selected' : ''}>${tCitizenOpt}</option>
          <option value="authority" ${role === 'authority' ? 'selected' : ''}>${tAuthorityOpt}</option>
          <option value="admin" ${role === 'admin' ? 'selected' : ''}>${tAdminOpt}</option>
        </select>
      `;
    }

    const isCitizen = role === 'citizen';
    const tViewAllNotifications = window.i18n ? window.i18n.t('view_all_notifications') : 'View All Notifications';
    const notificationsFooterHtml = isCitizen
      ? `<div class="notification-dropdown-footer">
            <a href="notifications.html" class="view-all-link">${tViewAllNotifications}</a>
          </div>`
      : '';

    const cachedUnreadCount = parseInt(localStorage.getItem('cc_unread_notifications_count') || '0', 10);
    const badgeClass = cachedUnreadCount > 0 ? 'bell-badge' : 'bell-badge hidden';

    const tNotifications = window.i18n ? window.i18n.t('nav_notifications') : 'Notifications';
    const tMarkAllRead = window.i18n ? window.i18n.t('mark_all_read') : 'Mark all as read';
    const tNoNotifications = window.i18n ? window.i18n.t('no_notifications') : 'No new notifications';
    const tProfile = window.i18n ? window.i18n.t('nav_profile') : 'Profile';
    const tSettings = window.i18n ? window.i18n.t('nav_settings') : 'Settings';
    const tSignIn = window.i18n ? window.i18n.t('sign_in') : 'Sign In';

    finalContainer.innerHTML = `
      <div class="auth-nav-wrapper">
        <!-- Notification Bell Container -->
        <div class="notification-bell-wrapper" id="bell-wrapper">
          <button class="bell-btn" id="bell-btn" aria-label="${tNotifications}" onclick="toggleNotificationDropdown(event)">
            <i class="fa-regular fa-bell"></i>
            <span class="${badgeClass}" id="bell-badge">${cachedUnreadCount}</span>
          </button>
          
          <!-- Dropdown Menu -->
          <div id="notification-dropdown" class="notification-dropdown hidden">
            <div class="notification-dropdown-header">
              <h3>${tNotifications}</h3>
              <button id="mark-all-read-btn" class="btn-text" onclick="handleMarkAllRead(event)">${tMarkAllRead}</button>
            </div>
            <div class="notification-list" id="notification-dropdown-list">
              <div class="no-notifications">${tNoNotifications}</div>
            </div>
            ${notificationsFooterHtml}
          </div>
        </div>

        <!-- User profile menu -->
        <div class="user-menu" id="user-menu-btn" onclick="toggleUserDropdown()">
          <div class="user-avatar">${initial}</div>
          <span style="font-size: 0.9rem; font-weight: 600; max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${fullName}</span>
          <i class="fa-solid fa-chevron-down" style="font-size: 0.75rem; color: var(--text-muted);"></i>
          
          <!-- Dropdown Menu -->
          <div id="user-dropdown" class="hidden" style="position: absolute; top: calc(100% + 10px); right: 0; background-color: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); box-shadow: var(--shadow-lg); width: 170px; padding: 0.5rem; display: flex; flex-direction: column; gap: 0.25rem; z-index: 1100;">
            <div style="font-size: 0.75rem; padding: 0.4rem 0.5rem; border-bottom: 1px solid var(--border-color); color: var(--text-muted);">
              ${roleDisplayHtml}
            </div>
            <a href="profile.html" class="nav-dropdown-item">
              <i class="fa-regular fa-user" style="width: 16px; color: var(--text-muted);"></i> ${tProfile}
            </a>
            <a href="notifications.html" class="nav-dropdown-item">
              <i class="fa-regular fa-bell" style="width: 16px; color: var(--text-muted);"></i> ${tNotifications}
            </a>
            <a href="settings.html" class="nav-dropdown-item">
              <i class="fa-solid fa-gear" style="width: 16px; color: var(--text-muted);"></i> ${tSettings}
            </a>
          </div>
        </div>
      </div>
    `;
  } else {
    const tSignIn = window.i18n ? window.i18n.t('sign_in') : 'Sign In';
    finalContainer.innerHTML = `
      <a href="auth.html" class="btn auth-nav-btn"><i class="fa-solid fa-right-to-bracket"></i> ${tSignIn}</a>
    `;
  }

  // Populate dynamic notifications dropdown elements if window.renderNotifications is loaded
  if (typeof window.renderNotifications === 'function') {
    window.renderNotifications();
  }
  
  // Dispatch custom auth change event ONLY if:
  // 1. The user transitions from logged-out to logged-in (loggedIn: true)
  // 2. The user transitions from logged-in to logged-out (loggedIn: false, but _lastDispatchedLoggedIn was true)
  // 3. The logged-in user ID changed
  const loggedIn = !!user;
  const userId = user ? user.id : null;
  
  const isFirstDispatch = window._lastDispatchedLoggedIn === undefined;
  const loggedInChanged = window._lastDispatchedLoggedIn !== loggedIn;
  const userIdChanged = window._lastDispatchedUserId !== userId;

  let shouldDispatch = false;
  if (isFirstDispatch) {
    shouldDispatch = loggedIn;
  } else {
    shouldDispatch = loggedInChanged || userIdChanged;
  }

  if (shouldDispatch) {
    window._lastDispatchedUserId = userId;
    window._lastDispatchedLoggedIn = loggedIn;
    console.log(`[Debug Log] Dispatching auth-change event (loggedIn: ${loggedIn})`);
    window.dispatchEvent(new CustomEvent('auth-change', { detail: { loggedIn, user } }));
  }

  // Initialize/update mobile responsive navigation drawer
  if (typeof initResponsiveSidebar === 'function') {
    initResponsiveSidebar();
  }
}

// Toggle Dropdown Display
function toggleUserDropdown() {
  const dropdown = document.getElementById('user-dropdown');
  if (dropdown) {
    dropdown.classList.toggle('hidden');
  }
  // Close notification dropdown if user dropdown is opened
  const notifDropdown = document.getElementById('notification-dropdown');
  if (notifDropdown && dropdown && !dropdown.classList.contains('hidden')) {
    notifDropdown.classList.add('hidden');
  }
}

// Close dropdowns if clicking outside
window.addEventListener('click', (e) => {
  // User dropdown
  const menuBtn = document.getElementById('user-menu-btn');
  const dropdown = document.getElementById('user-dropdown');
  if (menuBtn && dropdown && !menuBtn.contains(e.target)) {
    dropdown.classList.add('hidden');
  }

  // Notification dropdown
  const bellBtn = document.getElementById('bell-btn');
  const notifDropdown = document.getElementById('notification-dropdown');
  if (bellBtn && notifDropdown && !bellBtn.contains(e.target) && !notifDropdown.contains(e.target)) {
    notifDropdown.classList.add('hidden');
  }
});

// Mobile navbar toggle support
function initHeaderClock() {
  const dateEl = document.getElementById('widget-date');
  const timeEl = document.getElementById('widget-time');
  if (!dateEl || !timeEl) return;

  // Clear any existing clock interval to prevent conflicting multiple timers when language is toggled
  if (window.headerClockInterval) {
    clearInterval(window.headerClockInterval);
    window.headerClockInterval = null;
  }

  function updateClock() {
    const now = new Date();
    
    const days = [
      window.i18n ? window.i18n.t('day_0') : "Sunday",
      window.i18n ? window.i18n.t('day_1') : "Monday",
      window.i18n ? window.i18n.t('day_2') : "Tuesday",
      window.i18n ? window.i18n.t('day_3') : "Wednesday",
      window.i18n ? window.i18n.t('day_4') : "Thursday",
      window.i18n ? window.i18n.t('day_5') : "Friday",
      window.i18n ? window.i18n.t('day_6') : "Saturday"
    ];

    const months = [
      window.i18n ? window.i18n.t('month_0') : "January",
      window.i18n ? window.i18n.t('month_1') : "February",
      window.i18n ? window.i18n.t('month_2') : "March",
      window.i18n ? window.i18n.t('month_3') : "April",
      window.i18n ? window.i18n.t('month_4') : "May",
      window.i18n ? window.i18n.t('month_5') : "June",
      window.i18n ? window.i18n.t('month_6') : "July",
      window.i18n ? window.i18n.t('month_7') : "August",
      window.i18n ? window.i18n.t('month_8') : "September",
      window.i18n ? window.i18n.t('month_9') : "October",
      window.i18n ? window.i18n.t('month_10') : "November",
      window.i18n ? window.i18n.t('month_11') : "December"
    ];

    // Format Date: Sunday, 14 June 2026
    const dateStr = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
    
    // Format Time: 10:25:31 AM
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const timeStr = `${hours}:${minutes}:${seconds} ${ampm}`;

    if (timeEl.textContent !== timeStr) {
      timeEl.style.opacity = '0.5';
      setTimeout(() => {
        dateEl.textContent = dateStr;
        timeEl.textContent = timeStr;
        timeEl.style.opacity = '1';
      }, 100);
    }
  }

  updateClock();
  window.headerClockInterval = setInterval(updateClock, 1000);
}

function initAuthModule() {
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const appSidebar = document.querySelector('.app-sidebar');
  const navMenu = document.getElementById('nav-menu');
  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (appSidebar) {
        appSidebar.classList.toggle('active');
      } else if (navMenu) {
        navMenu.classList.toggle('active');
      }
    });
  }

  // Close sidebar on click outside
  document.addEventListener('click', (e) => {
    if (appSidebar && appSidebar.classList.contains('active')) {
      if (!appSidebar.contains(e.target) && e.target !== mobileMenuBtn && !mobileMenuBtn?.contains(e.target)) {
        appSidebar.classList.remove('active');
      }
    }
  });

  // Topnav hamburger toggle for report.html mobile drawer
  const topnavHamburger = document.getElementById('topnav-hamburger');
  const topnavMobileDrawer = document.getElementById('topnav-mobile-drawer');
  if (topnavHamburger && topnavMobileDrawer) {
    topnavHamburger.addEventListener('click', (e) => {
      e.stopPropagation();
      topnavMobileDrawer.classList.toggle('open');
    });

    // Close topnav drawer on click outside
    document.addEventListener('click', (e) => {
      if (topnavMobileDrawer.classList.contains('open')) {
        if (!topnavMobileDrawer.contains(e.target) && !topnavHamburger.contains(e.target)) {
          topnavMobileDrawer.classList.remove('open');
        }
      }
    });
  }

  // Apply saved theme on page load immediately to align with localStorage
  const activeTheme = getActiveTheme();
  if (activeTheme === 'dark') {
    document.documentElement.classList.add('dark-theme');
    document.documentElement.classList.remove('light-theme');
  } else {
    document.documentElement.classList.add('light-theme');
    document.documentElement.classList.remove('dark-theme');
  }

  // Auto-detect mock mode synchronously if mock session exists and no real session exists
  let checkMock = false;
  try {
    const cachedConfigRaw = localStorage.getItem('cc_config_cache');
    if (cachedConfigRaw) {
      const config = JSON.parse(cachedConfigRaw);
      const isKeyPlaceholder = !config.supabaseAnonKey || 
                               config.supabaseAnonKey.includes('placeholder') || 
                               config.supabaseAnonKey === '' || 
                               (!config.supabaseAnonKey.startsWith('eyJ') && !config.supabaseAnonKey.startsWith('sb_publishable_'));
      const isUrlPlaceholder = !config.supabaseUrl || 
                               config.supabaseUrl.includes('placeholder') || 
                               config.supabaseUrl === '';
      if (isUrlPlaceholder || isKeyPlaceholder) {
        checkMock = true;
      }
    } else {
      checkMock = true; // Default to check mock if no config cache is present yet
    }
  } catch (e) {
    checkMock = true;
  }

  if (checkMock && localStorage.getItem('cc_mock_session') && !localStorage.getItem('cc_session')) {
    isMockAuth = true;
  } else {
    isMockAuth = false;
    localStorage.removeItem('cc_mock_session');
  }


  // Bootstrap clock and authentication
  initHeaderClock();
  updateAuthUI(); // <-- Render navbar instantly from cached profile data!
  initAuth();
  initThemeToggle();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAuthModule);
} else {
  initAuthModule();
}

/**
 * Fetch user points/level/badges count to render in dropdown
 */
async function fetchDropdownGamificationStats(userId) {
  try {
    const token = getAuthToken();
    if (!token) return;

    const profileRes = await fetch('/api/auth/profile', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const badgesRes = await fetch('/api/gamification/badges', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (profileRes.ok && badgesRes.ok) {
      const profile = await profileRes.json();
      const badges = await badgesRes.json();

      const points = profile.points || 0;
      const level = getLevelFromPoints(points);
      const badgeCount = badges ? badges.length : 0;

      const ptsEl = document.getElementById('user-points-display');
      const lvlEl = document.getElementById('user-level-display');
      const bdgEl = document.getElementById('user-badges-display');

      if (ptsEl) {
        ptsEl.className = '';
        ptsEl.style = 'color: var(--primary); font-weight: 800;';
        ptsEl.innerText = `${points} pts`;
      }
      if (lvlEl) {
        lvlEl.className = '';
        lvlEl.style = 'font-weight: 700; font-size: 0.75rem;';
        lvlEl.innerText = level;
      }
      if (bdgEl) {
        bdgEl.className = '';
        bdgEl.style = 'color: var(--primary);';
        bdgEl.innerHTML = `<i class="fa-solid fa-medal"></i> ${badgeCount}`;
      }
    }
  } catch (err) {
    console.error('Failed to fetch dropdown gamification stats:', err);
  }
}

function getLevelFromPoints(points) {
  let key = "level_civic_novice";
  if (points >= 300) key = "level_city_legend";
  else if (points >= 150) key = "level_civic_leader";
  else if (points >= 50) key = "level_local_watchdog";
  
  if (window.i18n && typeof window.i18n.t === 'function') {
    return window.i18n.t(key);
  }
  
  if (points >= 300) return "City Legend";
  if (points >= 150) return "Civic Leader";
  if (points >= 50) return "Local Watchdog";
  return "Civic Novice";
}

function updateDailyStreak() {
  const todayStr = new Date().toISOString().split('T')[0];
  const lastActive = localStorage.getItem('cc_last_active_date');
  let streak = parseInt(localStorage.getItem('cc_login_streak') || '0', 10);

  if (lastActive === todayStr) {
    return streak || 1;
  }

  if (lastActive) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    if (lastActive === yesterdayStr) {
      streak += 1;
    } else {
      streak = 1;
    }
  } else {
    streak = 1;
  }

  localStorage.setItem('cc_last_active_date', todayStr);
  localStorage.setItem('cc_login_streak', streak.toString());
  return streak;
}

function initThemeToggle() {
  const navMenu = document.getElementById('nav-menu');
  const authContainer = document.getElementById('auth-nav-container');
  if (!navMenu || !authContainer) return;

  if (document.getElementById('header-theme-toggle')) return;

  const toggleBtn = document.createElement('button');
  toggleBtn.id = 'header-theme-toggle';
  toggleBtn.className = 'theme-toggle-btn';
  toggleBtn.setAttribute('aria-label', 'Toggle Theme');
  
  const currentTheme = getActiveTheme();
  toggleBtn.innerHTML = currentTheme === 'dark' ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
  
  navMenu.insertBefore(toggleBtn, authContainer);

  toggleBtn.addEventListener('click', () => {
    const activeTheme = getActiveTheme();
    if (activeTheme === 'dark') {
      document.documentElement.classList.remove('dark-theme');
      document.documentElement.classList.add('light-theme');
      localStorage.setItem('cc_theme', 'light');
      toggleBtn.innerHTML = '<i class="fa-solid fa-moon"></i>';
    } else {
      document.documentElement.classList.remove('light-theme');
      document.documentElement.classList.add('dark-theme');
      localStorage.setItem('cc_theme', 'dark');
      toggleBtn.innerHTML = '<i class="fa-solid fa-sun"></i>';
    }
    window.dispatchEvent(new Event('theme-change'));
  });
}

function getActiveTheme() {
  const savedTheme = localStorage.getItem('cc_theme');
  if (savedTheme) return savedTheme;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

window.addEventListener('language-change', () => {
  updateAuthUI();
  // Force update the header clock immediately
  initHeaderClock();
});

// MD3 Responsive Side Drawer Helper Functions
function initResponsiveSidebar() {
  const isMobile = window.innerWidth < 768;
  const sidebar = document.querySelector('.app-sidebar');
  const topnavDrawer = document.getElementById('topnav-mobile-drawer');
  
  if (isMobile) {
    // Cache original desktop sidebar markup
    if (sidebar && !window._originalSidebarHtml) {
      window._originalSidebarHtml = sidebar.innerHTML;
    }
    if (topnavDrawer && !window._originalTopnavDrawerHtml) {
      window._originalTopnavDrawerHtml = topnavDrawer.innerHTML;
    }
    
    // Render dynamic MD3 layout
    const user = getCurrentUser();
    const role = getUserRole();
    let fullName = 'User';
    let userEmail = '';
    let avatarUrl = '';
    if (user) {
      let cachedProfile = null;
      try {
        const profileStr = localStorage.getItem('cc_user_profile');
        if (profileStr) cachedProfile = JSON.parse(profileStr);
      } catch (e) {}
      fullName = cachedProfile?.full_name || user.user_metadata?.full_name || (role === 'admin' ? 'Admin' : (role === 'authority' ? 'Inspector' : 'User'));
      userEmail = user.email || '';
      avatarUrl = cachedProfile?.avatar_url || user.user_metadata?.avatar_url || '';
    }
    const avatarInitial = fullName.charAt(0).toUpperCase();
    const avatarHtml = avatarUrl 
      ? `<img src="${avatarUrl}" class="mobile-drawer-avatar-img" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`
      : avatarInitial;
    
    const profileHref = (role === 'admin' ? 'admin.html' : (role === 'authority' ? 'authority-profile.html' : 'profile.html'));
    
    const path = window.location.pathname;
    const isActive = (href) => path.includes(href) || (href === 'citizen-dashboard.html' && (path.endsWith('/') || path.endsWith('/index.html')));
    
    const isAuth = role === 'authority' || role === 'admin';
    const links = isAuth ? [
      { href: 'authority-dashboard.html', icon: 'fa-house-chimney', label: 'Dashboard', key: 'nav_dashboard' },
      { href: 'authority-reports.html', icon: 'fa-clipboard-list', label: 'Cases', key: 'nav_cases' },
      { href: 'authority-notifications.html', icon: 'fa-bell', label: 'Notifications', key: 'nav_notifications' },
      { href: 'authority-settings.html', icon: 'fa-gear', label: 'Settings', key: 'nav_settings' }
    ] : [
      { href: 'citizen-dashboard.html', icon: 'fa-house-chimney', label: 'Dashboard', key: 'nav_dashboard' },
      { href: 'report.html', icon: 'fa-plus', label: 'Report Issue', key: 'nav_report' },
      { href: 'my-complaints.html', icon: 'fa-clipboard-list', label: 'My Complaints', key: 'nav_my_complaints' },
      { href: 'notifications.html', icon: 'fa-bell', label: 'Notifications', key: 'nav_notifications' },
      { href: 'settings.html', icon: 'fa-gear', label: 'Settings', key: 'nav_settings' }
    ];
    
    let linksHtml = links.map(link => {
      const tLabel = window.i18n ? window.i18n.t(link.key) : link.label;
      return `
        <a href="${link.href}" class="mobile-drawer-link ${isActive(link.href) ? 'active' : ''}">
          <i class="fa-solid ${link.icon}"></i> <span>${tLabel}</span>
        </a>
      `;
    }).join('');

    const tLogout = window.i18n ? window.i18n.t('nav_logout') : 'Logout';
    
    const mobileHtml = `
      <a href="${profileHref}" class="mobile-drawer-header-link" style="text-decoration: none; color: inherit; display: block; width: 100%;">
        <div class="mobile-drawer-header" style="cursor: pointer;">
          <div class="mobile-drawer-avatar">${avatarHtml}</div>
          <div class="mobile-drawer-profile-info">
            <div class="mobile-drawer-username">${fullName}</div>
            <div class="mobile-drawer-useremail">${userEmail}</div>
          </div>
        </div>
      </a>
      <div class="mobile-drawer-divider"></div>
      <nav class="mobile-drawer-nav">
        ${linksHtml}
        <button onclick="logoutUser()" class="mobile-drawer-link" style="border: none; background: none; text-align: left; width: 100%; cursor: pointer;">
          <i class="fa-solid fa-right-from-bracket"></i> <span>${tLogout}</span>
        </button>
      </nav>
      <div class="mobile-drawer-divider"></div>
    `;
    
    if (sidebar) sidebar.innerHTML = mobileHtml;
    if (topnavDrawer) {
      topnavDrawer.innerHTML = mobileHtml;
      topnavDrawer.classList.add('mobile-drawer-panel');
    }
    
    // Inject and handle backdrop
    let backdrop = document.getElementById('drawer-backdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'drawer-backdrop';
      backdrop.className = 'drawer-backdrop';
      document.body.appendChild(backdrop);
      backdrop.addEventListener('click', () => {
        if (sidebar) sidebar.classList.remove('active');
        if (topnavDrawer) topnavDrawer.classList.remove('active');
        backdrop.classList.remove('active');
      });
    }
  } else {
    // Restore original desktop markup
    if (sidebar && window._originalSidebarHtml) {
      sidebar.innerHTML = window._originalSidebarHtml;
      window._originalSidebarHtml = null;
    }
    if (topnavDrawer && window._originalTopnavDrawerHtml) {
      topnavDrawer.innerHTML = window._originalTopnavDrawerHtml;
      topnavDrawer.classList.remove('mobile-drawer-panel');
      window._originalTopnavDrawerHtml = null;
    }
    const backdrop = document.getElementById('drawer-backdrop');
    if (backdrop) backdrop.classList.remove('active');
    if (sidebar) sidebar.classList.remove('active');
    if (topnavDrawer) topnavDrawer.classList.remove('active');
  }
}

// Bind resize listener
window.addEventListener('resize', initResponsiveSidebar);

// Bind toggle action logic
document.addEventListener('DOMContentLoaded', () => {
  const sidebar = document.querySelector('.app-sidebar');
  const topnavDrawer = document.getElementById('topnav-mobile-drawer');
  const setupToggleListeners = () => {
    const toggles = document.querySelectorAll('#mobile-menu-btn, #topnav-hamburger, .mobile-menu-toggle, .topnav-hamburger');
    toggles.forEach(btn => {
      // Avoid duplicate event listener binding
      if (btn.dataset.drawerBound) return;
      btn.dataset.drawerBound = "true";
      
      btn.addEventListener('click', () => {
        const backdrop = document.getElementById('drawer-backdrop');
        if (backdrop) {
          setTimeout(() => {
            const activeSidebar = sidebar && sidebar.classList.contains('active');
            const activeTopnav = topnavDrawer && topnavDrawer.classList.contains('active');
            if (activeSidebar || activeTopnav) {
              backdrop.classList.add('active');
            } else {
              backdrop.classList.remove('active');
            }
          }, 20);
        }
      });
    });
  };
  
  setupToggleListeners();
  
  // Also run setup whenever auth UI renders
  window.addEventListener('auth-change', () => {
    setTimeout(setupToggleListeners, 50);
  });
});
