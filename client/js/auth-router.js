// CrowdCity - Central Authentication Router & Role Separator
// Runs synchronously in `<head>` to prevent flashes of unauthorized/incorrect layouts

// Universal LocalStorage to SessionStorage Proxy for Auth Keys
// This converts all auth session storage to sessionStorage so closing the browser logs the user out.
(function() {
  const originalGet = localStorage.getItem;
  const originalSet = localStorage.setItem;
  const originalRemove = localStorage.removeItem;

  const authKeys = [
    'cc_session',
    'cc_mock_session',
    'cc_user_role',
    'cc_user_profile',
    'cc_password_recovery_active',
    'cc_unread_notifications_count',
    'cc_user_stat_total',
    'cc_user_stat_resolved',
    'cc_user_stat_active'
  ];

  localStorage.getItem = function(key) {
    if (authKeys.includes(key)) {
      return sessionStorage.getItem(key);
    }
    return originalGet.call(localStorage, key);
  };

  localStorage.setItem = function(key, value) {
    if (authKeys.includes(key)) {
      sessionStorage.setItem(key, value);
      return;
    }
    originalSet.call(localStorage, key, value);
  };

  localStorage.removeItem = function(key) {
    if (authKeys.includes(key)) {
      sessionStorage.removeItem(key);
      return;
    }
    originalRemove.call(localStorage, key);
  };
})();

// Universal Page Loader Injection
(function() {
  // Avoid loader on simple redirection pages or offline
  const path = window.location.pathname;
  if (path.endsWith('/') || path.endsWith('/index') || path.endsWith('/index.html') || path.includes('offline')) {
    return;
  }

  // Record start time to ensure minimum loader duration
  window.authLoaderStartTime = Date.now();

  // Inject loader CSS
  const loaderStyle = document.createElement('style');
  loaderStyle.id = 'global-page-loader-style';
  loaderStyle.innerHTML = `
    #global-page-loader {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(3, 7, 18, 0.9);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 999999;
      transition: opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.4s;
      opacity: 1;
      visibility: visible;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
    }
    #global-page-loader.fade-out {
      opacity: 0;
      visibility: hidden;
    }
    .loader-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1.5rem;
      width: 90%;
      max-width: 400px;
    }
    .loader-spinner-ring {
      position: relative;
      width: 80px;
      height: 80px;
    }
    .loader-spinner-ring div {
      box-sizing: border-box;
      display: block;
      position: absolute;
      width: 64px;
      height: 64px;
      margin: 8px;
      border: 4px solid transparent;
      border-radius: 50%;
      animation: spinner-ring-rotate 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite;
      border-top-color: #0d9488;
    }
    .loader-spinner-ring div:nth-child(1) { animation-delay: -0.45s; }
    .loader-spinner-ring div:nth-child(2) { animation-delay: -0.3s; }
    .loader-spinner-ring div:nth-child(3) { animation-delay: -0.15s; }
    @keyframes spinner-ring-rotate {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .loader-logo {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 0.8rem;
      font-size: 1.35rem;
      font-weight: 700;
      color: #ffffff;
      letter-spacing: 0.05em;
    }
    .loader-logo-divider,
    .loader-logo div[style*="width: 1px"],
    .loader-logo div[style*="width:1px"] {
      display: none !important;
    }
    .loader-logo div[style*="line-height"] {
      text-align: center !important;
      align-items: center !important;
    }
    .loader-text {
      font-size: 0.78rem;
      color: rgba(255, 255, 255, 0.5);
      letter-spacing: 0.08em;
      font-weight: 600;
      text-transform: uppercase;
    }
    @media (min-width: 1024px) {
      .loader-logo {
        flex-direction: row !important;
        text-align: left !important;
        gap: 0.6rem !important;
      }
      .loader-logo-divider,
      .loader-logo div[style*="width: 1px"],
      .loader-logo div[style*="width:1px"] {
        display: block !important;
        width: 1px !important;
        height: 32px !important;
        background: rgba(255, 255, 255, 0.2) !important;
        margin: 0 0.1rem !important;
      }
      .loader-logo div[style*="line-height"] {
        text-align: left !important;
        align-items: flex-start !important;
      }
    }
  `;
  (document.head || document.documentElement).appendChild(loaderStyle);

  // Inject loader HTML as soon as body is available
  function injectLoaderHTML() {
    if (document.getElementById('global-page-loader')) return;
    const loader = document.createElement('div');
    loader.id = 'global-page-loader';
    loader.innerHTML = `
      <div class="loader-container">
        <div class="loader-spinner-ring">
          <div></div><div></div><div></div><div></div>
        </div>
        <div class="loader-logo">
          <img src="https://upload.wikimedia.org/wikipedia/commons/8/83/Emblem_of_Tamil_Nadu.svg" alt="Govt. of Tamil Nadu" style="height: 48px; object-fit: contain;" />
          <div class="loader-logo-divider"></div>
          <img src="images/crowdcity_icon_transparent.png" alt="CrowdCity" style="height: 38px; object-fit: contain;" />
          <div style="display: flex; flex-direction: column; line-height: 1.1; font-family: var(--font-heading, sans-serif);">
            <span style="font-size: 1.25rem; font-weight: 800; color: #ffffff; letter-spacing: 0.5px;">CrowdCity AI</span>
            <span style="font-size: 0.62rem; font-weight: 700; color: #fbbf24; text-transform: uppercase; letter-spacing: 0.8px;">TN Government Partnership</span>
          </div>
        </div>
        <div class="loader-text">Loading Portal...</div>
      </div>
    `;
    document.body.insertBefore(loader, document.body.firstChild);
  }

  if (document.body) {
    injectLoaderHTML();
  } else {
    const bodyObserver = new MutationObserver((mutations, observer) => {
      if (document.body) {
        injectLoaderHTML();
        observer.disconnect();
      }
    });
    bodyObserver.observe(document.documentElement, { childList: true });
    
    // Fallback
    document.addEventListener('DOMContentLoaded', injectLoaderHTML);
  }
})();


// Expose exactly ONE source of truth for all redirects in the project
window.authRouter = {
  redirectToDashboard: function(role) {
    let target = null;
    if (role === 'citizen') target = 'citizen-dashboard.html';
    else if (role === 'authority') target = 'authority-dashboard.html';
    else if (role === 'admin') target = 'admin.html';
    
    if (!target) {
      console.error(`[Auth Router] Cannot redirect to dashboard: Unknown or empty role "${role}"`);
      return;
    }
    
    console.log(`[Auth Router] ROLE: ${role} | TARGET PAGE: ${target}`);
    window.location.href = target;
  },
  redirectToLogin: function(role) {
    let target = 'auth.html';
    if (role === 'authority' || role === 'admin') target = 'authority-login.html';
    
    console.log(`[Auth Router] Redirecting to login. Target: ${target}`);
    window.location.href = target;
  },
  redirectToResetPassword: function(search = '', hash = '') {
    console.log(`[Auth Router] FLOW DETECTED: PASSWORD_RECOVERY | TARGET PAGE: reset-password.html`);
    window.location.href = 'reset-password.html' + search + hash;
  }
};

(function() {
  const path = window.location.pathname;
  const hash = window.location.hash;
  const search = window.location.search;

  // Normalize path to ignore extension (.html) so clean URLs work
  const normalizedPath = path.replace(/\.html$/, '');

  const isResetPasswordPage = normalizedPath.includes('reset-password');
  const isIndexPage = normalizedPath.endsWith('/') || normalizedPath.endsWith('/index');
  const isCitizenLoginPage = normalizedPath.endsWith('/auth') || normalizedPath === 'auth';
  const isAuthorityLoginPage = normalizedPath.includes('authority-login');
  const isOfflinePage = normalizedPath.includes('offline');

  const isGuestPage = isIndexPage || isCitizenLoginPage || isAuthorityLoginPage || isResetPasswordPage || isOfflinePage;

  if (!isGuestPage) {
    // Hide the document on protected pages immediately to prevent EAR / Page Flash vulnerabilities
    const style = document.createElement('style');
    style.id = 'auth-protect-style';
    style.innerHTML = '.auth-protected-hidden { display: none !important; }';
    (document.head || document.documentElement).appendChild(style);
    document.documentElement.classList.add('auth-protected-hidden');
  }

  // If we are on the reset-password page, let reset-password.js manage it
  if (isResetPasswordPage) {
    console.log('[Auth Router] Reset password page detected. Delegating routing control to reset-password.js.');
    return;
  }

  // 1. Detect OAuth callback — Supabase returns access_token in the URL hash
  // after Google OAuth. auth.js must process these tokens; DO NOT redirect away.
  const hasOAuthHash = hash.includes('access_token') ||
                       hash.includes('refresh_token') ||
                       hash.includes('type=signup') ||
                       search.includes('code=');   // PKCE flow
  if (isCitizenLoginPage && hasOAuthHash) {
    console.log('[Auth Router] OAuth callback detected on auth.html. Delegating to auth.js.');
    return;
  }

  // 2. Detect Supabase Password Recovery parameters
  const isRecoveryInUrl = hash.includes('type=recovery') || search.includes('type=recovery');

  if (isRecoveryInUrl) {
    console.log('[Auth Router] Password recovery context detected. Skipping role routing and dashboard redirects.');
    localStorage.setItem('cc_password_recovery_active', 'true');
    // Redirect to reset-password.html to process recovery
    window.authRouter.redirectToResetPassword(search, hash);
    return;
  }

  const isRecoveryActive = localStorage.getItem('cc_password_recovery_active') === 'true';
  if (isRecoveryActive) {
    console.log('[Auth Router] Password recovery active. Redirecting to reset-password.html');
    window.location.href = 'reset-password.html';
    return;
  }

  // 2. Define route targets
  const CITIZEN_DASHBOARD = 'citizen-dashboard.html';
  const AUTHORITY_DASHBOARD = 'authority-dashboard.html';
  const ADMIN_DASHBOARD = 'admin.html';
  const CITIZEN_LOGIN = 'auth.html';
  const AUTHORITY_LOGIN = 'authority-login.html';

  // 3. Read active session & role synchronously from localStorage
  let isMock = localStorage.getItem('cc_mock_session');
  const realSessionStr = localStorage.getItem('cc_session');
  let sessionActive = false;
  let role = localStorage.getItem('cc_user_role');

  // Verify if we have a valid cached configuration for real Supabase
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
      if (!isUrlPlaceholder && !isKeyPlaceholder) {
        if (isMock) {
          console.warn('[Auth Router] Real Supabase is configured. Discarding leftover mock session.');
          localStorage.removeItem('cc_mock_session');
          isMock = null;
        }
      }
    }
  } catch (e) {
    console.error('[Auth Router] Error reading cached config:', e);
  }


  if (isMock) {
    sessionActive = true;
  } else if (realSessionStr) {
    try {
      const session = JSON.parse(realSessionStr);
      if (session && session.access_token) {
        let isExpired = false;
        if (session.expires_at) {
          isExpired = Math.floor(Date.now() / 1000) >= session.expires_at;
        } else {
          // Fallback to base64 decoding of the JWT payload
          try {
            const parts = session.access_token.split('.');
            if (parts.length === 3) {
              const payload = JSON.parse(atob(parts[1]));
              if (payload.exp) {
                isExpired = Math.floor(Date.now() / 1000) >= payload.exp;
              }
            }
          } catch (jwtErr) {
            isExpired = true;
          }
        }

        if (isExpired) {
          console.warn('[Auth Router] Synchronous check: Session has expired. Clearing storage.');
          localStorage.removeItem('cc_session');
          localStorage.removeItem('cc_user_role');
          localStorage.removeItem('cc_user_profile');
          localStorage.removeItem('cc_unread_notifications_count');
          localStorage.removeItem('cc_user_stat_total');
          localStorage.removeItem('cc_user_stat_resolved');
          localStorage.removeItem('cc_user_stat_active');
          sessionActive = false;
          role = null;
        } else {
          sessionActive = true;
        }
      }
    } catch (e) {
      console.warn('[Auth Router] Failed to parse cc_session:', e);
    }
  }

  // Page classifications

  // Protect dashboard pages and sub-routes
  const isAdminPage = normalizedPath.includes('admin');
  const isAuthorityPage = (normalizedPath.includes('authority-') || normalizedPath.includes('authority')) && !isAuthorityLoginPage && !isResetPasswordPage;
  const isCitizenPage = !isIndexPage && !isCitizenLoginPage && !isAuthorityLoginPage && !isResetPasswordPage && !isAuthorityPage && !isAdminPage;

  console.log(`[Auth Router] Path: "${path}", Active Session: ${sessionActive}, Role: "${role}"`);

  // A. Root page redirection
  if (isIndexPage) {
    if (!sessionActive) {
      window.location.href = CITIZEN_LOGIN;
    } else {
      if (role === 'authority') {
        window.location.href = AUTHORITY_DASHBOARD;
      } else if (role === 'admin') {
        window.location.href = ADMIN_DASHBOARD;
      } else if (role === 'citizen') {
        window.location.href = CITIZEN_DASHBOARD;
      } else {
        // Restored session but role not cached yet. Route to login/loading to resolve it.
        window.location.href = CITIZEN_LOGIN;
      }
    }
    return;
  }

  // B. Guest Access Control (Unauthenticated)
  if (!sessionActive) {
    if (isCitizenPage) {
      console.warn("[Auth Router] Unauthenticated citizen access. Redirecting to login.");
      window.location.href = CITIZEN_LOGIN;
      return;
    }
    if (isAuthorityPage || isAdminPage) {
      console.warn("[Auth Router] Unauthenticated authority/admin access. Redirecting to authority login.");
      window.location.href = AUTHORITY_LOGIN;
      return;
    }
  }

  // C. Logged-in Session Restricting (Prevent accessing login pages)
  if (sessionActive) {
    if (isCitizenLoginPage || isAuthorityLoginPage) {
      if (role) {
        console.log("[Auth Router] Already logged in. Redirecting to respective dashboard.");
        if (role === 'authority') {
          window.location.href = AUTHORITY_DASHBOARD;
        } else if (role === 'admin') {
          window.location.href = ADMIN_DASHBOARD;
        } else if (role === 'citizen') {
          window.location.href = CITIZEN_DASHBOARD;
        }
        return;
      } else {
        console.log("[Auth Router] Session active but role not cached yet. Waiting for page auth logic to route...");
      }
    }
  }

  // D. Role Separation Redirection (Prevent accessing wrong dashboards/pages)
  if (sessionActive && role) {
    if (role === 'citizen') {
      if (isAuthorityPage || isAdminPage) {
        console.warn("[Auth Router] Citizen role cannot access authority/admin page. Redirecting.");
        window.location.href = CITIZEN_DASHBOARD;
        return;
      }
    } else if (role === 'authority') {
      if (isCitizenPage || isAdminPage) {
        console.warn("[Auth Router] Authority role cannot access citizen/admin page. Redirecting.");
        window.location.href = AUTHORITY_DASHBOARD;
        return;
      }
    } else if (role === 'admin') {
      if (isCitizenPage || isAuthorityPage) {
        console.warn("[Auth Router] Admin role cannot access citizen/authority page. Redirecting.");
        window.location.href = ADMIN_DASHBOARD;
        return;
      }
    }
    // Safe to display page: session exists and matches the role requirements
    document.documentElement.classList.remove('auth-protected-hidden');
  }
})();

// Temporary Mobile Maintenance Overlay Popup
(function() {
  // 1. Inject Maintenance Overlay CSS Styles
  const style = document.createElement('style');
  style.id = 'mobile-maintenance-style';
  style.innerHTML = `
    #mobile-maintenance-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: radial-gradient(circle at center, #0f172a 0%, #030712 100%);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 10000000;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      padding: 1.5rem;
      box-sizing: border-box;
      color: #ffffff;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.4s ease, visibility 0.4s ease;
    }
    #mobile-maintenance-overlay.active {
      opacity: 1;
      visibility: visible;
    }
    .maintenance-card {
      background: rgba(15, 23, 42, 0.45);
      border: 1px solid rgba(255, 255, 255, 0.08);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      padding: 2.5rem 2rem;
      border-radius: 24px;
      max-width: 440px;
      width: 100%;
      text-align: center;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      transform: scale(0.95);
      transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    }
    #mobile-maintenance-overlay.active .maintenance-card {
      transform: scale(1);
    }
    .maintenance-icon-wrapper {
      width: 80px;
      height: 80px;
      background: rgba(245, 158, 11, 0.1);
      border: 1.5px dashed rgba(245, 158, 11, 0.5);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 1.5rem;
      animation: rotate-dashed 20s linear infinite;
    }
    @keyframes rotate-dashed {
      100% { transform: rotate(360deg); }
    }
    .maintenance-icon {
      color: #f59e0b;
      font-size: 2.2rem;
      animation: pulse-icon 2s ease-in-out infinite alternate;
    }
    @keyframes pulse-icon {
      0% { transform: scale(1); opacity: 0.9; }
      100% { transform: scale(1.1); opacity: 1; }
    }
    .maintenance-title {
      font-size: 1.5rem;
      font-weight: 800;
      color: #ffffff;
      margin-bottom: 0.85rem;
      letter-spacing: -0.02em;
    }
    .maintenance-desc {
      font-size: 0.88rem;
      line-height: 1.6;
      color: #9ca3af;
      margin-bottom: 1.75rem;
    }
    .maintenance-desc strong {
      color: #fbbf24;
      font-weight: 700;
    }
    .desktop-guide {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 16px;
      padding: 1.25rem;
      text-align: left;
      margin-bottom: 2rem;
    }
    .desktop-guide-title {
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #e5e7eb;
      font-weight: 700;
      margin-bottom: 0.75rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .desktop-guide-steps {
      margin: 0;
      padding-left: 1.1rem;
      font-size: 0.82rem;
      color: #9ca3af;
    }
    .desktop-guide-steps li {
      margin-bottom: 0.5rem;
      line-height: 1.4;
    }
    .desktop-guide-steps li:last-child {
      margin-bottom: 0;
    }
    .maintenance-btn {
      background: #0d9488;
      color: #ffffff;
      border: none;
      padding: 0.85rem 1.75rem;
      font-size: 0.88rem;
      font-weight: 700;
      border-radius: 12px;
      cursor: pointer;
      width: 100%;
      box-shadow: 0 4px 14px rgba(13, 148, 136, 0.4);
      transition: background 0.2s, transform 0.1s, box-shadow 0.2s;
    }
    .maintenance-btn:hover {
      background: #0f766e;
      box-shadow: 0 6px 20px rgba(13, 148, 136, 0.5);
    }
    .maintenance-btn:active {
      transform: scale(0.98);
    }
  `;
  (document.head || document.documentElement).appendChild(style);

  // 2. Mobile Detection Logic
  function checkMobile() {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isSmallScreen = window.innerWidth < 980;
    return isMobile && isSmallScreen;
  }

  // 3. Inject Maintenance HTML
  function injectMaintenanceHTML() {
    if (document.getElementById('mobile-maintenance-overlay')) return;
    
    const overlay = document.createElement('div');
    overlay.id = 'mobile-maintenance-overlay';
    overlay.innerHTML = `
      <div class="maintenance-card">
        <div class="maintenance-icon-wrapper">
          <div class="maintenance-icon">⚡</div>
        </div>
        <h2 class="maintenance-title">Mobile Layout Under Maintenance</h2>
        <p class="maintenance-desc">
          CrowdCity AI is currently undergoing mobile layout updates. To access the portal, please use a desktop computer or switch your mobile browser to <strong>'Desktop site'</strong> mode.
        </p>
        <div class="desktop-guide">
          <div class="desktop-guide-title">
            <span>⚙️</span> How to switch to Desktop Site
          </div>
          <ol class="desktop-guide-steps">
            <li>Open your browser menu (tap <strong>⋮</strong> on Android or <strong>aA</strong> on iOS Safari).</li>
            <li>Select/check <strong>"Desktop site"</strong> or <strong>"Request Desktop Website"</strong>.</li>
            <li>The portal will automatically reload and let you sign in properly.</li>
          </ol>
        </div>
        <button class="maintenance-btn" id="maintenance-reload-btn">I've switched to Desktop Site</button>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    document.getElementById('maintenance-reload-btn').addEventListener('click', () => {
      window.location.reload();
    });
  }

  // 4. Update Overlay Visibility State
  function updateOverlayState() {
    const overlay = document.getElementById('mobile-maintenance-overlay');
    if (!overlay) {
      if (checkMobile() && document.body) {
        injectMaintenanceHTML();
        setTimeout(() => {
          const overlayNow = document.getElementById('mobile-maintenance-overlay');
          if (overlayNow) overlayNow.classList.add('active');
        }, 50);
      }
      return;
    }

    if (checkMobile()) {
      overlay.classList.add('active');
    } else {
      overlay.classList.remove('active');
    }
  }

  // Run immediately if DOM body is loaded, or wait
  if (document.body) {
    updateOverlayState();
  } else {
    const observer = new MutationObserver(() => {
      if (document.body) {
        updateOverlayState();
        observer.disconnect();
      }
    });
    observer.observe(document.documentElement, { childList: true });
    document.addEventListener('DOMContentLoaded', updateOverlayState);
  }

  // Re-check on window resize (e.g. rotating landscape mode or toggling DevTools device simulation)
  window.addEventListener('resize', updateOverlayState);
})();

