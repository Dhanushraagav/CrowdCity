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
const isMockAuth = false;

// Fatal configuration error screen displaying a premium glassmorphic overlay
function showFatalConfigError(details) {
  // Create fatal overlay if not already present
  if (document.getElementById('cc-fatal-config-overlay')) return;
  
  const overlay = document.createElement('div');
  overlay.id = 'cc-fatal-config-overlay';
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100vw';
  overlay.style.height = '100vh';
  overlay.style.background = 'radial-gradient(circle at top right, rgba(15, 23, 42, 0.95), rgba(8, 12, 21, 0.99))';
  overlay.style.zIndex = '100000';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.backdropFilter = 'blur(12px)';
  overlay.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  overlay.style.color = '#f8fafc';
  overlay.style.padding = '2rem';
  overlay.style.boxSizing = 'border-box';

  const container = document.createElement('div');
  container.style.maxWidth = '550px';
  container.style.width = '100%';
  container.style.background = 'rgba(30, 41, 59, 0.7)';
  container.style.border = '1px solid rgba(255, 255, 255, 0.08)';
  container.style.borderRadius = '24px';
  container.style.padding = '3rem 2.5rem';
  container.style.boxShadow = '0 25px 50px -12px rgba(0, 0, 0, 0.5), inset 0 1px 0 0 rgba(255, 255, 255, 0.05)';
  container.style.textAlign = 'center';
  container.style.animation = 'fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards';

  // Inject a stylesheet for keyframes if not present
  if (!document.getElementById('cc-fatal-style')) {
    const style = document.createElement('style');
    style.id = 'cc-fatal-style';
    style.textContent = `
      @keyframes fadeInUp {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .glow-icon {
        animation: pulseGlow 3s infinite alternate;
      }
      @keyframes pulseGlow {
        0% { box-shadow: 0 0 15px rgba(239, 68, 68, 0.2); }
        100% { box-shadow: 0 0 35px rgba(239, 68, 68, 0.6); }
      }
    `;
    document.head.appendChild(style);
  }

  container.innerHTML = `
    <div style="display: inline-flex; align-items: center; justify-content: center; width: 80px; height: 80px; background: rgba(239, 68, 68, 0.1); border: 2px solid rgba(239, 68, 68, 0.3); border-radius: 50%; margin-bottom: 2rem; color: #ef4444;" class="glow-icon">
      <svg style="width: 40px; height: 40px;" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
      </svg>
    </div>
    <h1 style="font-size: 1.8rem; font-weight: 700; letter-spacing: -0.025em; margin: 0 0 1rem 0; color: #ffffff;">Configuration Error</h1>
    <p style="font-size: 1rem; line-height: 1.6; color: #94a3b8; margin: 0 0 2rem 0;">
      CrowdCity AI environment configuration is invalid or incomplete. The application requires a valid connection to Supabase to run securely.
    </p>
    <div style="background: rgba(15, 23, 42, 0.4); border-radius: 12px; padding: 1.25rem; font-family: monospace; font-size: 0.875rem; color: #f1f5f9; text-align: left; border: 1px solid rgba(255, 255, 255, 0.05); margin-bottom: 2rem; word-break: break-all;">
      <span style="color: #ef4444; font-weight: bold;">[Error Details]</span><br/>
      ${details || 'Supabase URL/Anon Key is missing or invalid placeholders are detected.'}
    </div>
    <p style="font-size: 0.875rem; color: #64748b; margin: 0;">
      Please check your server environment variables or contact system administrator.
    </p>
  `;

  overlay.appendChild(container);
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
}
window.showFatalConfigError = showFatalConfigError;

// Initialize Supabase Client dynamically from server config
async function initAuth() {
  // Pre-load from cache for instant CAPTCHA and UI loading
  try {
    const raw = localStorage.getItem('cc_config_cache');
    if (raw) {
      const cachedConfig = JSON.parse(raw);
      if (cachedConfig && cachedConfig.supabaseUrl && cachedConfig.supabaseAnonKey) {
        window.supabaseConfig = cachedConfig;
        if (typeof window.supabase !== 'undefined' && !supabaseClient) {
          supabaseClient = window.supabase.createClient(cachedConfig.supabaseUrl, cachedConfig.supabaseAnonKey);
          window.supabaseClient = supabaseClient;
          _attachAuthStateListener();
          updateAuthUI();
          if (window.turnstileLoaded) {
            window.renderTurnstileWidgets();
          }
        }
      }
    }
  } catch (e) {
    console.warn('[Auth] Pre-init config cache check failed:', e);
  }

  try {
    const response = await fetch('/api/config');

    if (!response.ok) {
      console.warn(`[Auth] /api/config returned HTTP ${response.status}. Attempting cached-config recovery...`);
      const recovered = _tryInitFromCache();
      if (!recovered) {
        console.warn('[Auth] No cached config. Will retry initAuth in 10 s.');
        setTimeout(initAuth, 10000);
      }
      return;
    }

    const config = await response.json();
    window.supabaseConfig = config;

    const isKeyPlaceholder = !config.supabaseAnonKey || 
                             config.supabaseAnonKey.includes('placeholder') || 
                             config.supabaseAnonKey === '' || 
                             (!config.supabaseAnonKey.startsWith('eyJ') && !config.supabaseAnonKey.startsWith('sb_publishable_'));

    if (!config.supabaseUrl || config.supabaseUrl.includes('placeholder') || config.supabaseUrl === '' || isKeyPlaceholder) {
      console.error("Supabase API variables are not configured or invalid.");
      showFatalConfigError("Supabase environment variables (SUPABASE_URL / SUPABASE_ANON_KEY) are missing or set to placeholder values on the server.");
      return;
    }

    // Check if Supabase URL has changed to clear legacy local sessions
    const oldConfigRaw = localStorage.getItem('cc_config_cache');
    if (oldConfigRaw) {
      try {
        const oldConfig = JSON.parse(oldConfigRaw);
        if (oldConfig && oldConfig.supabaseUrl !== config.supabaseUrl) {
          console.warn("[Auth] Supabase URL changed. Clearing legacy session cache.");
          localStorage.removeItem('cc_session');
          localStorage.removeItem('cc_user_role');
          localStorage.removeItem('cc_user_profile');
        }
      } catch (e) {}
    }

    // Persist config so we can recover from transient server errors later.
    try { localStorage.setItem('cc_config_cache', JSON.stringify(config)); } catch (e) {}

    // Initialize real Supabase client
    console.log("[Auth] Connecting to Supabase at URL:", config.supabaseUrl);
    supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
    window.supabaseClient = supabaseClient;
    console.log("Supabase Auth initialized successfully.");
    _attachAuthStateListener();
    updateAuthUI();
    if (window.turnstileLoaded) {
      window.renderTurnstileWidgets();
    }
    resolveAuthInit();

  } catch (error) {
    console.error("[Auth] Network error fetching /api/config. Attempting cached-config recovery:", error);
    const recovered = _tryInitFromCache();
    if (!recovered) {
      console.error("[Auth] No cached config. Showing configuration error.");
      showFatalConfigError("Network failure connecting to backend configuration endpoint: " + (error.message || error));
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
    window.supabaseConfig = config;
    const isKeyPlaceholder = !config.supabaseAnonKey || 
                             config.supabaseAnonKey.includes('placeholder') || 
                             (!config.supabaseAnonKey.startsWith('eyJ') && !config.supabaseAnonKey.startsWith('sb_publishable_'));
    if (!config.supabaseUrl || config.supabaseUrl.includes('placeholder') || isKeyPlaceholder) return false;
    supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
    window.supabaseClient = supabaseClient;
    console.log('[Auth] Supabase initialised from cached config.');
    _attachAuthStateListener();
    updateAuthUI();
    if (window.turnstileLoaded) {
      window.renderTurnstileWidgets();
    }
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
      const isCitizenLoginPage = normalizedPath.endsWith('/auth') || normalizedPath === 'auth';
      const isAuthorityLoginPage = normalizedPath.includes('authority-login');
      const isLoginOrRoot = isCitizenLoginPage || isAuthorityLoginPage || normalizedPath.endsWith('/') || normalizedPath.endsWith('/index');
      const isResetPage = normalizedPath.includes('reset-password');

      // Prevent automatic dashboard redirects if recovery is active (Goal 3 & 6)
      if (isLoginOrRoot && !isResetPage && !isRecoveryActive) {
        console.log('[Auth] OAuth SIGNED_IN on login page. Routing user.');
        const hasHash = window.location.hash.includes('access_token') || window.location.search.includes('code=');
        if (hasHash) {
          window.cc_manual_signin = true;
        }
        // Reset routing guard so each fresh sign-in can proceed
        window.cc_routing_in_progress = false;
        await verifyProfileAndRoute(session.user, showAuthAlert, session.access_token);
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
      const isCitizenLoginPage = normalizedPath.endsWith('/auth') || normalizedPath === 'auth';
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
        const isCitizenLoginPage = normalizedPath.endsWith('/auth') || normalizedPath === 'auth';
        const isAuthorityLoginPage = normalizedPath.includes('authority-login');
        const isLoginOrRoot = isCitizenLoginPage || isAuthorityLoginPage || normalizedPath.endsWith('/') || normalizedPath.endsWith('/index');
        const isResetPage = normalizedPath.includes('reset-password');
        const isRecoveryActive = localStorage.getItem('cc_password_recovery_active') === 'true';

        if (isLoginOrRoot && !isResetPage && !isRecoveryActive) {
          console.log('[Auth] Session found via getSession() on login page (OAuth return). Routing user.');
          localStorage.setItem('cc_session', JSON.stringify(session));
          // Allow routing even if onAuthStateChange already fired
          window.cc_routing_in_progress = false;
          await verifyProfileAndRoute(session.user, showAuthAlert, session.access_token);
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
          const isCitizenLoginPage = normalizedPath.endsWith('/auth') || normalizedPath === 'auth';
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
        verifyRoleForCurrentPage(profile.role);
        return;
      }
    } else if (response.status === 401 || response.status === 403) {
      // Token is explicitly invalid/expired, log out immediately
      verifyRoleForCurrentPage(null);
      return;
    }
    
    // For other transient status errors (e.g. 500, 502, 503, or rate limits)
    // Fall back to cached role if it exists to allow offline support
    const cachedRole = localStorage.getItem('cc_user_role');
    if (cachedRole) {
      verifyRoleForCurrentPage(cachedRole);
    } else {
      verifyRoleForCurrentPage(null);
    }
  } catch (err) {
    console.error('Error fetching user role:', err);
    // Fall back to cached role on network exceptions/offline state
    const cachedRole = localStorage.getItem('cc_user_role');
    if (cachedRole) {
      verifyRoleForCurrentPage(cachedRole);
    } else {
      verifyRoleForCurrentPage(null);
    }
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
        verifyRoleForCurrentPage(freshProfile.role);

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

// Helper to get active session
function getSession() {
  const real = localStorage.getItem('cc_session');
  return real ? JSON.parse(real) : null;
}

// Helper to search localStorage for native Supabase auth keys when CC session cache is not yet synced
function getSupabaseFallbackToken() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
        // Read directly using the original localStorage method if needed, but since it's not in authKeys list
        // the proxied getItem will delegate to the original localStorage.getItem anyway.
        const val = localStorage.getItem(key);
        if (val) {
          const parsed = JSON.parse(val);
          if (parsed && parsed.access_token) {
            return parsed.access_token;
          }
        }
      }
    }
  } catch (e) {
    console.warn("[Auth Fallback] Failed to parse Supabase local token:", e);
  }
  return null;
}

// Get JWT Token for API header injection
function getAuthToken() {
  const session = getSession();
  if (session && session.access_token) {
    return session.access_token;
  }
  return getSupabaseFallbackToken();
}

// Get or refresh JWT Token for API header injection
async function getOrRefreshAccessToken() {
  // Check cache first: if we have a valid, unexpired token, use it immediately
  const cachedSession = getSession();
  if (cachedSession && cachedSession.access_token && cachedSession.expires_at) {
    // Check if token has at least 60 seconds of validity remaining
    const isExpired = Math.floor(Date.now() / 1000) >= (cachedSession.expires_at - 60);
    if (!isExpired) {
      return cachedSession.access_token;
    }
  }

  // Fallback check in native Supabase local storage key
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
        const val = localStorage.getItem(key);
        if (val) {
          const parsed = JSON.parse(val);
          if (parsed && parsed.access_token && parsed.expires_at) {
            const isExpired = Math.floor(Date.now() / 1000) >= (parsed.expires_at - 60);
            if (!isExpired) {
              return parsed.access_token;
            }
          }
        }
      }
    }
  } catch (e) {}

  // If expired or not found, try to refresh via Supabase Client
  if (window.authInitPromise) {
    await window.authInitPromise;
  }

  if (typeof supabaseClient !== 'undefined' && supabaseClient) {
    try {
      const getSessionPromise = supabaseClient.auth.getSession();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Session timeout')), 2000)
      );
      const { data: { session }, error } = await Promise.race([getSessionPromise, timeoutPromise]);
      if (!error && session) {
        localStorage.setItem('cc_session', JSON.stringify(session));
        return session.access_token;
      }
    } catch (e) {
      console.warn("Error retrieving fresh session in getOrRefreshAccessToken (will use cached fallback):", e.message || e);
    }
  }

  const session = getSession();
  if (session && session.access_token) {
    return session.access_token;
  }
  return getSupabaseFallbackToken();
}
window.getOrRefreshAccessToken = getOrRefreshAccessToken;

// Get User Profile information
function getCurrentUser() {
  const session = getSession();
  return session ? session.user : null;
}

// Get User Role (Citizen, Authority, Admin)
function getUserRole() {
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
  localStorage.removeItem('cc_user_role');
  localStorage.removeItem('cc_user_profile');
  localStorage.removeItem('cc_unread_notifications_count');
  localStorage.removeItem('cc_user_stat_total');
  localStorage.removeItem('cc_user_stat_resolved');
  localStorage.removeItem('cc_user_stat_active');

  if (supabaseClient) {
    try {
      // Fire-and-forget: do not await so we don't block the offline recovery path
      supabaseClient.auth.signOut().catch(err => {
        console.warn('Supabase signOut failed (expected offline/blocked):', err.message || err);
      });
    } catch (e) {
      console.error('Supabase signOut exception in clearSessionSilent:', e);
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

// Strict client-side route role verification to prevent Page Flash/Execution After Redirect
function verifyRoleForCurrentPage(role) {
  const path = window.location.pathname;
  const normalizedPath = path.replace(/\.html$/, '');
  
  const isIndexPage = normalizedPath.endsWith('/') || normalizedPath.endsWith('/index');
  const isCitizenLoginPage = normalizedPath.endsWith('/auth') || normalizedPath === 'auth';
  const isAuthorityLoginPage = normalizedPath.includes('authority-login');
  const isResetPasswordPage = normalizedPath.includes('reset-password');
  const isOfflinePage = normalizedPath.includes('offline');

  const isGuestPage = isIndexPage || isCitizenLoginPage || isAuthorityLoginPage || isResetPasswordPage || isOfflinePage;
  
  if (isGuestPage) {
    document.documentElement.classList.remove('auth-protected-hidden');
    return;
  }

  const isAdminPage = normalizedPath.includes('admin');
  const isAuthorityPage = (normalizedPath.includes('authority-') || normalizedPath.includes('authority')) && !isAuthorityLoginPage && !isResetPasswordPage;
  const isCitizenPage = !isIndexPage && !isCitizenLoginPage && !isAuthorityLoginPage && !isResetPasswordPage && !isAuthorityPage && !isAdminPage;

  if (!role) {
    console.warn("[Auth Security] No role detected on protected page. Clearing session and redirecting to login.");
    clearSessionSilent().then(() => {
      window.authRouter.redirectToLogin(isAuthorityPage || isAdminPage ? 'authority' : 'citizen');
    });
    return;
  }

  let accessDenied = false;
  if (role === 'citizen') {
    if (isAuthorityPage || isAdminPage) accessDenied = true;
  } else if (role === 'authority') {
    if (isCitizenPage || isAdminPage) accessDenied = true;
  } else if (role === 'admin') {
    if (isCitizenPage || isAuthorityPage) accessDenied = true;
  }

  if (accessDenied) {
    console.warn(`[Auth Security] Role "${role}" is unauthorized for page "${path}". Redirecting.`);
    window.authRouter.redirectToDashboard(role);
  } else {
    // Reveal protected page layout
    document.documentElement.classList.remove('auth-protected-hidden');
  }
}
window.verifyRoleForCurrentPage = verifyRoleForCurrentPage;

// Core routing verification function
async function verifyProfileAndRoute(user, showAlert, passedToken = null) {
  console.log("[Auth Client] verifyProfileAndRoute triggered for user ID:", user ? user.id : 'none', "Email:", user ? user.email : 'none');
  if (window.cc_routing_in_progress) {
    console.warn("[Auth Client] Routing already in progress, ignoring subsequent call.");
    return;
  }
  window.cc_routing_in_progress = true;

  console.log("AUTH SUCCESS");

  let profile = null;

  try {
    const supabase = supabaseClient;
    console.log(`[Auth Client] Querying profiles table for user ID: ${user.id}...`);
    
    const queryPromise = supabase
      .from('profiles')
      .select('role,is_verified:is_verified_authority')
      .eq('id', user.id)
      .single();
      
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout')), 5000)
    );

    const result = await Promise.race([queryPromise, timeoutPromise]);
    const data = result.data;
    const error = result.error;

    if (error) {
      console.error("[Auth Client] Error fetching profile from Supabase:", error.message || error);
      throw error;
    } else {
      console.log("[Auth Client] Profile queried successfully from Supabase:", data);
      profile = data;
    }
  } catch (err) {
    console.warn("[Auth Client] Direct Supabase profile query failed or timed out. Attempting server fallback API...", err);
    try {
      const token = passedToken || getAuthToken() || await getOrRefreshAccessToken();
      if (token) {
        console.log("[Auth Client] Fetching profile via Express API endpoint /api/auth/profile...");
        const response = await fetch('/api/auth/profile', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (response.ok) {
          const freshProfile = await response.json();
          console.log("[Auth Client] Profile retrieved successfully from Express API:", freshProfile);
          profile = {
            role: freshProfile.role,
            is_verified: freshProfile.is_verified_authority || freshProfile.is_verified
          };
        } else {
          console.error("[Auth Client] Express API profile fetch returned non-ok status:", response.status);
        }
      } else {
        console.warn("[Auth Client] No access token available for Express API fallback.");
      }
    } catch (fallbackErr) {
      console.error("[Auth Client] Express API profile fallback query failed:", fallbackErr);
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
  
  if (role === 'citizen' || role === 'authority') {
    sessionStorage.setItem('cc_show_demo_notice', 'true');
  }
  
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

  const isManual = window.cc_manual_signin === true;
  
  if (isManual) {
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
  } else {
    // Silent instant redirection for background cached session restoration
    window.authRouter.redirectToDashboard(role);
  }
}

window.verifyProfileAndRoute = verifyProfileAndRoute;

// Register a new user
async function registerUser(email, password, fullName, captchaToken) {
  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName
      },
      captchaToken: captchaToken
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
async function loginUser(email, password, captchaToken) {
  console.log(`[Auth Client] Attempting Email/Password login for: ${email}`);
  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ 
      email, 
      password,
      options: {
        captchaToken: captchaToken
      }
    });
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
async function requestPasswordReset(email, captchaToken) {
  const { data, error } = await supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/reset-password.html',
    captchaToken: captchaToken
  });
  return { data, error };
}

// Update password (used in recovery mode)
async function updatePassword(newPassword) {
  const { data, error } = await supabaseClient.auth.updateUser({
    password: newPassword
  });
  return { data, error };
}

// Verify current password and update password (used in settings page)
async function verifyAndChangePassword(currentPassword, newPassword) {
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
  if (supabaseClient) {
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

  // Inject Tamil Nadu Government & CrowdCity partnership branding globally
  const injectGovtBranding = () => {
    // 1. Sidebar Logos (Desktop Sidebar Layout)
    const sidebarLogos = document.querySelectorAll('.app-sidebar-logo');
    sidebarLogos.forEach(logo => {
      if (logo.dataset.tnBranded) return;
      logo.dataset.tnBranded = "true";
      
      const role = getUserRole();
      const subtitleText = role === 'authority' || role === 'admin' ? 'Authority Portal' : 'Citizen Portal';
      
      const tnEmblem = document.createElement('img');
      tnEmblem.src = "https://upload.wikimedia.org/wikipedia/commons/8/83/Emblem_of_Tamil_Nadu.svg";
      tnEmblem.alt = "Govt. of Tamil Nadu";
      tnEmblem.className = "brand-emblem";
      tnEmblem.style.cssText = "width: 38px; height: 38px; flex-shrink: 0; object-fit: contain;";
      
      const divider = document.createElement('div');
      divider.style.cssText = "width: 1px; height: 26px; background: var(--border-color); margin: 0 0.1rem;";
      
      const ccEmblem = logo.querySelector('.brand-emblem');
      if (ccEmblem) {
        ccEmblem.style.width = "28px";
        ccEmblem.style.height = "28px";
      }
      
      logo.insertBefore(divider, logo.firstChild);
      logo.insertBefore(tnEmblem, logo.firstChild);
      
      const brandText = logo.querySelector('.brand-text-container');
      if (brandText) {
        brandText.style.gap = "0.05rem";
        const title = brandText.querySelector('.brand-title');
        if (title) {
          title.style.fontSize = "0.95rem";
          title.style.color = "var(--text-main)";
        }
        const subtitle = brandText.querySelector('.brand-subtitle');
        if (subtitle) {
          subtitle.style.fontSize = "0.58rem";
          subtitle.style.color = "var(--brand-subtitle-color)";
          subtitle.textContent = subtitleText;
        }
      }
    });

    // 2. Mobile Header Logos
    const mobileLogos = document.querySelectorAll('.app-header-logo-mobile');
    mobileLogos.forEach(logo => {
      if (logo.dataset.tnBranded) return;
      logo.dataset.tnBranded = "true";
      
      const role = getUserRole();
      const subtitleText = role === 'authority' || role === 'admin' ? 'Govt. of Tamil Nadu' : 'Tamil Nadu Portal';
      
      logo.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.4rem;">
          <img src="https://upload.wikimedia.org/wikipedia/commons/8/83/Emblem_of_Tamil_Nadu.svg" alt="Govt. of Tamil Nadu" style="width: 26px; height: 26px; object-fit: contain;" />
          <div style="width: 1px; height: 18px; background: var(--border-color); margin: 0 0.05rem;"></div>
          <img src="images/crowdcity_icon_transparent.png" alt="CrowdCity" style="width: 20px; height: 20px; object-fit: contain;" />
          <span style="font-size: 0.85rem; font-weight: 800; color: var(--text-main); font-family: var(--font-heading); display: flex; flex-direction: column; line-height: 1.1; text-align: left;">
            <span>CrowdCity AI</span>
            <span style="font-size: 0.52rem; font-weight: 700; color: var(--brand-subtitle-color, #fbbf24); text-transform: uppercase; letter-spacing: 0.3px;">${subtitleText}</span>
          </span>
        </div>
      `;
    });

    // 3. Topnav Logos (e.g. report.html)
    const topnavLogos = document.querySelectorAll('.topnav-logo');
    topnavLogos.forEach(logo => {
      if (logo.dataset.tnBranded) return;
      logo.dataset.tnBranded = "true";
      
      logo.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <img src="https://upload.wikimedia.org/wikipedia/commons/8/83/Emblem_of_Tamil_Nadu.svg" alt="Govt. of Tamil Nadu" style="width: 30px; height: 30px; object-fit: contain;" />
          <div style="width: 1px; height: 20px; background: var(--border-color); margin: 0 0.1rem;"></div>
          <img src="images/crowdcity_icon_transparent.png" alt="CrowdCity" style="width: 24px; height: 24px; object-fit: contain;" />
          <span style="font-size: 0.9rem; font-weight: 800; color: var(--text-main); font-family: var(--font-heading); display: flex; flex-direction: column; line-height: 1.1; text-align: left;">
            <span>CrowdCity AI</span>
            <span style="font-size: 0.55rem; font-weight: 700; color: var(--brand-subtitle-color, #fbbf24); text-transform: uppercase; letter-spacing: 0.3px;">Tamil Nadu Portal</span>
          </span>
        </div>
      `;
    });
    
    // 4. Logo Containers (e.g. admin.html, analytics.html)
    const logoContainers = document.querySelectorAll('.logo-container');
    logoContainers.forEach(container => {
      if (container.closest('.auth-brand-panel') || container.dataset.tnBranded) return;
      container.dataset.tnBranded = "true";
      
      const role = getUserRole();
      const subtitleText = role === 'admin' ? 'Admin Control' : 'TN Initiative';
      
      const tnEmblem = document.createElement('img');
      tnEmblem.src = "https://upload.wikimedia.org/wikipedia/commons/8/83/Emblem_of_Tamil_Nadu.svg";
      tnEmblem.alt = "Govt. of Tamil Nadu";
      tnEmblem.style.cssText = "width: 32px; height: 32px; flex-shrink: 0; object-fit: contain;";
      
      const divider = document.createElement('div');
      divider.style.cssText = "width: 1px; height: 22px; background: var(--border-color); margin: 0 0.1rem;";
      
      const ccEmblem = container.querySelector('.brand-emblem');
      if (ccEmblem) {
        ccEmblem.style.width = "26px";
        ccEmblem.style.height = "26px";
      }
      
      container.insertBefore(divider, container.firstChild);
      container.insertBefore(tnEmblem, container.firstChild);
      
      const brandText = container.querySelector('.brand-text-container');
      if (brandText) {
        const title = brandText.querySelector('.brand-title');
        if (title) {
          title.style.fontSize = "0.95rem";
          title.style.color = "var(--text-main)";
        }
        const subtitle = brandText.querySelector('.brand-subtitle');
        if (subtitle) {
          subtitle.style.fontSize = "0.55rem";
          subtitle.style.color = "var(--brand-subtitle-color)";
          subtitle.textContent = subtitleText;
        }
      }
    });
  };

  // Inject dynamic government bulletin card at the top of dashboards
  const injectGovtBanner = () => {
    const contentBody = document.querySelector('.app-content-body');
    if (!contentBody || document.getElementById('tn-govt-bulletin')) return;
    
    const path = window.location.pathname;
    const isDashboard = path.includes('citizen-dashboard.html') || path.includes('authority-dashboard.html');
    if (!isDashboard) return;
    
    const role = getUserRole();
    const banner = document.createElement('div');
    banner.id = 'tn-govt-bulletin';
    banner.className = 'tn-govt-announcement-banner';
    
    if (role === 'authority' || role === 'admin') {
      banner.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <div style="background: rgba(13, 148, 136, 0.1); color: var(--primary); width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.05rem; flex-shrink: 0;">
            <i class="fa-solid fa-shield-halved"></i>
          </div>
          <div style="text-align: left;">
            <h4 style="margin: 0; font-size: 0.88rem; font-weight: 700; color: var(--text-main); letter-spacing: 0.3px;">TAMIL NADU MUNICIPAL ADMINISTRATION CONSOLE</h4>
            <p style="margin: 0; font-size: 0.76rem; color: var(--text-muted); line-height: 1.35;">Official administrative dashboard. Monitor municipal complaints, dispatch crews, and update task status flags.</p>
          </div>
        </div>
        <div style="display: flex; gap: 0.5rem; align-items: center; font-size: 0.75rem; color: var(--primary); font-weight: 700; white-space: nowrap;">
          <span class="bulletin-pulse"></span>
          <span>Official Session</span>
        </div>
      `;
    } else {
      banner.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <div style="background: rgba(13, 148, 136, 0.1); color: var(--primary); width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.05rem; flex-shrink: 0;">
            <i class="fa-solid fa-bullhorn"></i>
          </div>
          <div style="text-align: left;">
            <h4 style="margin: 0; font-size: 0.88rem; font-weight: 700; color: var(--text-main); letter-spacing: 0.3px;">TAMIL NADU CIVIC BULLETIN</h4>
            <p style="margin: 0; font-size: 0.76rem; color: var(--text-muted); line-height: 1.35;">Integrated citizen grievance portal in partnership with local municipalities. All services operational.</p>
          </div>
        </div>
        <div style="display: flex; gap: 0.5rem; align-items: center; font-size: 0.75rem; color: var(--primary); font-weight: 700; white-space: nowrap;">
          <span class="bulletin-pulse"></span>
          <span>Live Redressal Active</span>
        </div>
      `;
    }
    
    contentBody.insertBefore(banner, contentBody.firstChild);
  };

  // Inject dynamic helpline widget to the sidebar footer
  const injectHelplineWidget = () => {
    const sidebarFooter = document.querySelector('.app-sidebar-footer');
    if (!sidebarFooter || document.getElementById('sidebar-helpline')) return;
    
    const helplineCard = document.createElement('div');
    helplineCard.id = 'sidebar-helpline';
    helplineCard.className = 'sidebar-helpdesk-card';
    helplineCard.innerHTML = `
      <div style="display: flex; align-items: center; gap: 0.4rem; margin-bottom: 0.25rem; color: #fbbf24; font-weight: 700;">
        <i class="fa-solid fa-phone"></i>
        <span>TN STATE HELPLINE</span>
      </div>
      <div style="font-size: 0.88rem; font-weight: 800; color: #ffffff; margin-bottom: 0.15rem;">1913</div>
      <div>Municipal Corporation Support</div>
    `;
    
    sidebarFooter.insertBefore(helplineCard, sidebarFooter.firstChild);
  };

  // Run dynamic government news cycler inside the ticker banner
  const initNewsTicker = () => {
    const tickerText = document.getElementById('civic-intelligence-feed-text');
    if (!tickerText || window.cc_ticker_initialized) return;
    window.cc_ticker_initialized = true;
    
    const newsItems = [
      "All municipal services are operational. Check the feed below for community reports.",
      "State Government allocates ₹150 Crore for urban road repair and pothole filling.",
      "Namakkal Municipal Corporation launches 24/7 civic helpline (1913).",
      "Smart City project integrations completed for Chennai, Coimbatore, and Madurai.",
      "Public satisfaction rating for resolved municipal grievances reaches 92.4%."
    ];
    
    let currentIndex = 0;
    tickerText.style.transition = 'opacity 0.3s ease';
    setInterval(() => {
      tickerText.style.opacity = 0;
      setTimeout(() => {
        currentIndex = (currentIndex + 1) % newsItems.length;
        tickerText.textContent = newsItems[currentIndex];
        tickerText.style.opacity = 1;
      }, 300);
    }, 6000);
  };

  // Run dynamic branding injections
  injectGovtBranding();
  injectGovtBanner();
  injectHelplineWidget();
  initNewsTicker();

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

  // Apply saved theme on page load immediately (lock to light-theme)
  document.documentElement.classList.add('light-theme');
  document.documentElement.classList.remove('dark-theme');
  localStorage.setItem('cc_theme', 'light');

  localStorage.removeItem('cc_mock_session');


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
  // Theme toggle disabled to enforce clean professional white theme
  return;
}

function getActiveTheme() {
  return 'light';
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

  // Dynamic password visibility toggle listener
  document.addEventListener('click', (e) => {
    const toggle = e.target.closest('.toggle-password-visibility');
    if (!toggle) return;
    
    const targetId = toggle.getAttribute('data-target');
    // Query within the same parent container or globally
    const parentContainer = toggle.closest('.password-input-container');
    const passwordInput = parentContainer 
      ? parentContainer.querySelector('input') 
      : document.getElementById(targetId);
      
    if (!passwordInput) return;
    
    if (passwordInput.type === 'password') {
      passwordInput.type = 'text';
      toggle.classList.remove('fa-eye');
      toggle.classList.add('fa-eye-slash');
    } else {
      passwordInput.type = 'password';
      toggle.classList.remove('fa-eye-slash');
      toggle.classList.add('fa-eye');
    }
  });
});

// Dismiss Global Page Loader
(function() {
  const startTime = window.authLoaderStartTime || Date.now();
  
  function dismissLoader() {
    const loader = document.getElementById('global-page-loader');
    if (!loader || loader.classList.contains('fade-out')) return;

    const elapsed = Date.now() - startTime;
    const delay = Math.max(0, 800 - elapsed);

    setTimeout(() => {
      loader.classList.add('fade-out');
      document.documentElement.classList.remove('loader-active');
      // Remove from DOM after transition completes
      setTimeout(() => {
        if (loader.parentNode) {
          loader.parentNode.removeChild(loader);
        }
      }, 400);
    }, delay);
  }

  // Safety fail-safe timeout (3.5s) to guarantee user access
  setTimeout(dismissLoader, 3500);

  // Wait for both authInitPromise and document load complete
  const docLoaded = new Promise(resolve => {
    if (document.readyState === 'complete') {
      resolve();
    } else {
      window.addEventListener('load', resolve);
    }
  });

  Promise.all([
    window.authInitPromise || Promise.resolve(),
    docLoaded
  ]).then(dismissLoader);
})();

// Cloudflare Turnstile CAPTCHA Integration
window.loginWidgetId = null;
window.signupWidgetId = null;
window.recoveryWidgetId = null;
window.turnstileLoaded = false;

window.renderTurnstileWidgets = function() {
  if (typeof turnstile === 'undefined') {
    console.warn('[Turnstile] Script not yet loaded.');
    return;
  }

  const siteKey = window.supabaseConfig?.turnstileSiteKey || '1x00000000000000000000AA';
  const theme = 'light';

  if (document.getElementById('login-captcha') && window.loginWidgetId === null) {
    try {
      window.loginWidgetId = turnstile.render('#login-captcha', {
        sitekey: siteKey,
        theme: theme,
        callback: function(token) {
          console.log('[Turnstile] Login challenge completed');
        }
      });
    } catch (e) {
      console.error('[Turnstile] Failed to render login widget:', e);
    }
  }

  if (document.getElementById('signup-captcha') && window.signupWidgetId === null) {
    try {
      window.signupWidgetId = turnstile.render('#signup-captcha', {
        sitekey: siteKey,
        theme: theme,
        callback: function(token) {
          console.log('[Turnstile] Signup challenge completed');
        }
      });
    } catch (e) {
      console.error('[Turnstile] Failed to render signup widget:', e);
    }
  }

  if (document.getElementById('recovery-captcha') && window.recoveryWidgetId === null) {
    try {
      window.recoveryWidgetId = turnstile.render('#recovery-captcha', {
        sitekey: siteKey,
        theme: theme,
        callback: function(token) {
          console.log('[Turnstile] Recovery challenge completed');
        }
      });
    } catch (e) {
      console.error('[Turnstile] Failed to render recovery widget:', e);
    }
  }
};

window.onloadTurnstileCallback = function() {
  window.turnstileLoaded = true;
  if (window.supabaseConfig) {
    window.renderTurnstileWidgets();
  }
};


