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
  const realSessionStr = localStorage.getItem('cc_session');
  let sessionActive = false;
  let role = localStorage.getItem('cc_user_role');

  if (realSessionStr) {
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
    .maintenance-logos-container {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 1.25rem;
      margin: 0 auto 1.75rem;
      position: relative;
    }
    .logo-box {
      width: 76px;
      height: 76px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4);
      transition: transform 0.3s ease, border-color 0.3s;
    }
    .logo-box img {
      width: 50px;
      height: 50px;
      object-fit: contain;
      filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.25));
    }
    .logo-left {
      animation: float-left 4s ease-in-out infinite alternate;
    }
    .logo-right {
      animation: float-right 4s ease-in-out infinite alternate;
    }
    @keyframes float-left {
      0% { transform: translateY(0) rotate(-2deg); }
      100% { transform: translateY(-8px) rotate(3deg); }
    }
    @keyframes float-right {
      0% { transform: translateY(0) rotate(2deg); }
      100% { transform: translateY(-8px) rotate(-3deg); }
    }
    .logo-connector {
      position: relative;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .pulse-dot {
      width: 8px;
      height: 8px;
      background: #0d9488;
      border-radius: 50%;
      box-shadow: 0 0 12px #0d9488;
      position: absolute;
    }
    .pulse-ring {
      width: 24px;
      height: 24px;
      border: 2px solid rgba(13, 148, 136, 0.4);
      border-radius: 50%;
      position: absolute;
      animation: ring-expand 2s cubic-bezier(0.16, 1, 0.3, 1) infinite;
    }
    @keyframes ring-expand {
      0% { transform: scale(0.6); opacity: 1; }
      100% { transform: scale(1.6); opacity: 0; }
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
    .guide-icon {
      width: 16px;
      height: 16px;
      color: #9ca3af;
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
        <div class="maintenance-logos-container">
          <div class="logo-box logo-left">
            <img src="https://upload.wikimedia.org/wikipedia/commons/8/83/Emblem_of_Tamil_Nadu.svg" alt="Govt. of Tamil Nadu" />
          </div>
          <div class="logo-connector">
            <span class="pulse-ring"></span>
            <span class="pulse-dot"></span>
          </div>
          <div class="logo-box logo-right">
            <img src="images/crowdcity_icon_transparent.png" alt="CrowdCity" />
          </div>
        </div>
        <h2 class="maintenance-title">Mobile Layout Under Maintenance</h2>
        <p class="maintenance-desc">
          CrowdCity AI is currently undergoing mobile layout updates. To access the portal, please use a desktop computer or switch your mobile browser to <strong>'Desktop site'</strong> mode.
        </p>
        <div class="desktop-guide">
          <div class="desktop-guide-title">
            <svg class="guide-icon" viewBox="0 0 24 24"><path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.13,5.91,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.04,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z" fill="currentColor"/></svg>
            How to switch to Desktop Site
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

// Universal Demo Notice Modal Injection
(function() {
  function injectDemoNotice() {
    // Only show if the session storage flag is set to true
    if (sessionStorage.getItem('cc_show_demo_notice') !== 'true') {
      return;
    }

    // Ensure we don't inject multiple times
    if (document.getElementById('demo-notice-modal')) {
      return;
    }

    // Inject modal styles
    const modalStyle = document.createElement('style');
    modalStyle.id = 'demo-notice-modal-style';
    modalStyle.innerHTML = `
      #demo-notice-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(3, 7, 18, 0.85);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999999;
        opacity: 1;
        visibility: visible;
        transition: opacity 0.3s ease, visibility 0.3s ease;
        font-family: system-ui, -apple-system, sans-serif;
        padding: 1rem;
        box-sizing: border-box;
      }
      .demo-notice-card {
        background: rgba(17, 24, 39, 0.95);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 16px;
        max-width: 550px;
        width: 100%;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(13, 148, 136, 0.15);
        overflow: hidden;
        display: flex;
        flex-direction: column;
        animation: demoModalFadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        box-sizing: border-box;
      }
      @keyframes demoModalFadeIn {
        from { opacity: 0; transform: scale(0.95) translateY(10px); }
        to { opacity: 1; transform: scale(1) translateY(0); }
      }
      .demo-notice-header {
        padding: 1.5rem 1.75rem 1rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }
      .demo-notice-header-icon {
        font-size: 1.5rem;
        color: #3b82f6;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .demo-notice-title {
        font-size: 1.25rem;
        font-weight: 700;
        color: #ffffff;
        margin: 0;
      }
      .demo-notice-body {
        padding: 1.5rem 1.75rem;
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
        box-sizing: border-box;
      }
      .demo-notice-banner {
        background: rgba(59, 130, 246, 0.08);
        border-left: 4px solid #3b82f6;
        border-radius: 6px;
        padding: 1rem 1.25rem;
        display: flex;
        gap: 0.75rem;
        align-items: flex-start;
        box-sizing: border-box;
      }
      .demo-notice-banner-icon {
        color: #3b82f6;
        font-size: 1.1rem;
        margin-top: 0.1rem;
        flex-shrink: 0;
      }
      .demo-notice-banner-text {
        font-size: 0.88rem;
        line-height: 1.5;
        color: #cbd5e1;
        margin: 0;
      }
      .demo-notice-checkbox-wrapper {
        display: flex;
        align-items: flex-start;
        gap: 0.75rem;
        cursor: pointer;
        user-select: none;
        padding: 0.25rem 0;
      }
      .demo-notice-checkbox-input {
        width: 18px;
        height: 18px;
        border-radius: 4px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        background: rgba(255, 255, 255, 0.05);
        cursor: pointer;
        margin-top: 0.1rem;
        accent-color: #0D9488;
        flex-shrink: 0;
      }
      .demo-notice-checkbox-label {
        font-size: 0.88rem;
        color: #e2e8f0;
        line-height: 1.4;
        font-weight: 500;
      }
      .demo-notice-footer {
        padding: 1.25rem 1.75rem 1.5rem;
        border-top: 1px solid rgba(255, 255, 255, 0.06);
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
        background: rgba(10, 15, 30, 0.5);
        box-sizing: border-box;
      }
      .demo-notice-btn {
        padding: 0.6rem 1.25rem;
        font-size: 0.88rem;
        font-weight: 600;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s ease;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        outline: none;
        box-sizing: border-box;
      }
      .demo-notice-btn-primary {
        background: #0D9488;
        color: #ffffff;
        border: 1px solid transparent;
      }
      .demo-notice-btn-primary:hover:not(:disabled) {
        background: #0f766e;
        box-shadow: 0 0 12px rgba(13, 148, 136, 0.3);
      }
      .demo-notice-btn-primary:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
      .demo-notice-btn-secondary {
        background: transparent;
        color: #cbd5e1;
        border: 1px solid rgba(255, 255, 255, 0.15);
        text-decoration: none;
      }
      .demo-notice-btn-secondary:hover {
        background: rgba(255, 255, 255, 0.05);
        color: #ffffff;
        border-color: rgba(255, 255, 255, 0.3);
      }
    `;
    document.head.appendChild(modalStyle);

    // Build the modal HTML elements dynamically
    const modal = document.createElement('div');
    modal.id = 'demo-notice-modal';
    modal.innerHTML = `
      <div class="demo-notice-card">
        <div class="demo-notice-header">
          <div class="demo-notice-header-icon">
            <svg style="width: 24px; height: 24px;" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
            </svg>
          </div>
          <h3 class="demo-notice-title">Demo Notice</h3>
        </div>
        <div class="demo-notice-body">
          <div class="demo-notice-banner">
            <div class="demo-notice-banner-icon">
              <svg style="width: 20px; height: 20px;" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11 9h2V7h-2v2zm0 8h2v-6h-2v6zm1-15C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
              </svg>
            </div>
            <p class="demo-notice-banner-text">
              This application is a demonstration prototype developed for educational and project purposes. It is not an official Government of India or State Government service. Any complaints, user accounts, images, locations, analytics, notifications, reports, AI responses, and other data shown may be sample or test data and should not be considered official records. Do not submit confidential, personal, financial, or legally sensitive information through this demo. The developers are not responsible for decisions made based on the information displayed in this prototype.
            </p>
          </div>
          <label class="demo-notice-checkbox-wrapper" for="demo-notice-checkbox">
            <input type="checkbox" id="demo-notice-checkbox" class="demo-notice-checkbox-input" />
            <span class="demo-notice-checkbox-label">I understand that this is a demonstration application.</span>
          </label>
        </div>
        <div class="demo-notice-footer">
          <a href="https://github.com/Dhanushraagav/CrowdCity" target="_blank" class="demo-notice-btn demo-notice-btn-secondary">Learn More</a>
          <button type="button" id="demo-notice-continue-btn" class="demo-notice-btn demo-notice-btn-primary" disabled>Continue</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Add interactivity
    const checkbox = document.getElementById('demo-notice-checkbox');
    const continueBtn = document.getElementById('demo-notice-continue-btn');

    checkbox.addEventListener('change', function() {
      continueBtn.disabled = !this.checked;
    });

    continueBtn.addEventListener('click', function() {
      sessionStorage.removeItem('cc_show_demo_notice');
      modal.style.opacity = '0';
      modal.style.visibility = 'hidden';
      setTimeout(() => {
        modal.remove();
        modalStyle.remove();
      }, 300);
    });

    // Make sure ESC key does not close it
    window.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && document.getElementById('demo-notice-modal')) {
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);
  }

  // Inject once DOM body is available
  if (document.body) {
    injectDemoNotice();
  } else {
    const observer = new MutationObserver(() => {
      if (document.body) {
        injectDemoNotice();
        observer.disconnect();
      }
    });
    observer.observe(document.documentElement, { childList: true });
    document.addEventListener('DOMContentLoaded', injectDemoNotice);
  }
})();

