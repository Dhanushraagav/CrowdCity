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

  // Inject 100% Hardware GPU-Accelerated 60FPS Page Loader (ZERO LOGOS, MINIMAL TEXT)
  const loaderStyle = document.createElement('style');
  loaderStyle.id = 'global-page-loader-style';
  loaderStyle.innerHTML = `
    #global-page-loader {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: #ffffff;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 2147483646;
      transition: opacity 0.2s linear, visibility 0.2s linear;
      opacity: 1;
      visibility: visible;
      will-change: opacity, visibility;
      font-family: system-ui, -apple-system, sans-serif;
    }
    .light-theme #global-page-loader {
      background: #ffffff;
    }
    #global-page-loader.fade-out {
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
    }
    #gov-top-loader-bar {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 3px;
      background: linear-gradient(90deg, #0d9488, #38bdf8, #10b981);
      z-index: 2147483647;
      will-change: transform;
      transform: translate3d(-100%, 0, 0);
      animation: gpuTopLoaderBar 1.2s linear infinite;
    }
    @keyframes gpuTopLoaderBar {
      0% { transform: translate3d(-100%, 0, 0); }
      100% { transform: translate3d(100%, 0, 0); }
    }
    .gpu-pulse-container {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      height: 32px;
    }
    .gpu-pulse-bar {
      width: 5px;
      height: 22px;
      border-radius: 999px;
      will-change: transform, opacity;
      transform: translate3d(0, 0, 0);
      animation: gpuBarPulse 0.75s ease-in-out infinite alternate;
    }
    .gpu-pulse-bar:nth-child(1) {
      background: #14b8a6;
      animation-delay: 0s;
    }
    .gpu-pulse-bar:nth-child(2) {
      background: #38bdf8;
      animation-delay: 0.15s;
    }
    .gpu-pulse-bar:nth-child(3) {
      background: #10b981;
      animation-delay: 0.3s;
    }
    .gpu-pulse-bar:nth-child(4) {
      background: #0284c7;
      animation-delay: 0.45s;
    }
    @keyframes gpuBarPulse {
      0% {
        transform: translate3d(0, 3px, 0) scaleY(0.4);
        opacity: 0.3;
      }
      100% {
        transform: translate3d(0, -5px, 0) scaleY(1.1);
        opacity: 1;
      }
    }
    .gov-loader-title {
      font-size: 0.72rem;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: 0.28em;
      margin-top: 1.2rem;
      text-transform: uppercase;
      text-align: center;
    }
    .light-theme .gov-loader-title {
      color: #64748b;
    }
  `;
  (document.head || document.documentElement).appendChild(loaderStyle);

  // Inject loader HTML strictly during real browser page loading
  function injectLoaderHTML() {
    if (document.getElementById('global-page-loader')) return;
    const loader = document.createElement('div');
    loader.id = 'global-page-loader';
    loader.innerHTML = `
      <div id="gov-top-loader-bar"></div>
      <div class="gpu-pulse-container">
        <div class="gpu-pulse-bar"></div>
        <div class="gpu-pulse-bar"></div>
        <div class="gpu-pulse-bar"></div>
        <div class="gpu-pulse-bar"></div>
      </div>
      <div class="gov-loader-title">Loading</div>
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
    else if (role === 'admin') target = 'authority-dashboard.html';
    
    if (!target) {
      console.error(`[Auth Router] Cannot redirect to dashboard: Unknown or empty role "${role}"`);
      return;
    }
    
    // Set flag to display mandatory Demo Notice disclaimer on dashboard arrival
    sessionStorage.setItem('cc_show_demo_notice', 'true');

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
  const ADMIN_DASHBOARD = 'authority-dashboard.html';
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
          window.authRouter.redirectToDashboard(role);
          return;
        } else {
        console.log("[Auth Router] Session active but role not cached yet. Waiting for page auth logic to route...");
      }
    }
  }

  // D. Role Separation Redirection (Prevent accessing wrong dashboards/pages)
  // NOTE: admin.html is the unified Authority Portal shared by both 'authority' and 'admin' roles.
  if (sessionActive && role) {
    if (role === 'citizen') {
      if (isAuthorityPage || isAdminPage) {
        console.warn("[Auth Router] Citizen role cannot access authority/admin page. Redirecting.");
        window.location.href = CITIZEN_DASHBOARD;
        return;
      }
    } else if (role === 'authority' || role === 'admin') {
      if (isCitizenPage) {
        console.warn("[Auth Router] Authority/Admin role cannot access citizen page. Redirecting.");
        window.location.href = AUTHORITY_DASHBOARD;
        return;
      }
    }
    // Safe to display page: session exists and matches the role requirements
    document.documentElement.classList.remove('auth-protected-hidden');
  }
})();

// Universal Demo Notice Modal Injection
(function() {
  function injectDemoNotice() {
    // Only show if the session storage flag is set to true
    if (sessionStorage.getItem('cc_show_demo_notice') !== 'true') {
      return;
    }

    // Avoid showing on login or authentication pages
    const path = window.location.pathname;
    const normalizedPath = path.toLowerCase().replace(/\.html$/, '');
    if (
      normalizedPath.endsWith('/auth') ||
      normalizedPath.endsWith('/authority-login') ||
      normalizedPath.includes('auth.html') ||
      normalizedPath.includes('authority-login.html') ||
      normalizedPath.endsWith('/') ||
      normalizedPath.endsWith('/index')
    ) {
      return;
    }

    // Ensure we don't inject multiple times
    if (document.getElementById('demo-notice-modal')) {
      return;
    }

    const translations = {
      en: {
        title: "Notice",
        badge: "SANDBOX",
        checkbox: "I understand that this is a demonstration application.",
        learnMore: "Learn More",
        continue: "Continue"
      },
      ta: {
        title: "அறிவிப்பு",
        badge: "சோதனைக்களம்",
        checkbox: "இது ஒரு மாதிரி செயலி என்பதை நான் புரிந்து கொள்கிறேன்.",
        learnMore: "மேலும் அறிய",
        continue: "தொடரவும்"
      }
    };

    const currentLang = localStorage.getItem('cc_lang') || 'en';
    const t = translations[currentLang] || translations['en'];

    // Inject modal styles
    const modalStyle = document.createElement('style');
    modalStyle.id = 'demo-notice-modal-style';
    modalStyle.innerHTML = `
      #demo-notice-modal {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        height: 100dvh !important;
        background: rgba(3, 7, 18, 0.85) !important;
        backdrop-filter: blur(12px) !important;
        -webkit-backdrop-filter: blur(12px) !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        z-index: 2147483647 !important;
        padding: calc(1rem + env(safe-area-inset-top, 0px)) 1rem calc(1rem + env(safe-area-inset-bottom, 0px)) !important;
        box-sizing: border-box !important;
        user-select: none !important;
        -webkit-user-select: none !important;
      }
      .demo-notice-card {
        background: #0b1329 !important;
        background: linear-gradient(145deg, #0e172e 0%, #080e1e 100%) !important;
        border: 1px solid rgba(255, 255, 255, 0.08) !important;
        border-radius: 20px !important;
        max-width: 520px !important;
        width: 100% !important;
        max-height: 90vh !important;
        max-height: 90dvh !important;
        box-shadow: 0 25px 60px -10px rgba(0, 0, 0, 0.8), 0 0 35px rgba(13, 148, 136, 0.12) !important;
        overflow: hidden !important;
        display: flex !important;
        flex-direction: column !important;
        animation: demoModalPop 0.35s cubic-bezier(0.16, 1, 0.3, 1) !important;
        box-sizing: border-box !important;
        position: relative !important;
      }
      @keyframes demoModalPop {
        from { opacity: 0; transform: scale(0.95) translate3d(0, 12px, 0); }
        to { opacity: 1; transform: scale(1) translate3d(0, 0, 0); }
      }
      .demo-notice-header {
        padding: 1.25rem 1.5rem 1rem !important;
        border-bottom: 1px solid rgba(255, 255, 255, 0.06) !important;
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
      }
      .demo-notice-header-left {
        display: flex !important;
        align-items: center !important;
        gap: 0.85rem !important;
      }
      .demo-notice-logo {
        height: 32px !important;
        width: auto !important;
        display: block !important;
      }
      .demo-notice-title {
        font-size: 1.25rem !important;
        font-weight: 800 !important;
        color: #ffffff !important;
        margin: 0 !important;
        letter-spacing: -0.02em !important;
        font-family: system-ui, -apple-system, sans-serif !important;
      }
      .demo-notice-badge {
        font-size: 0.7rem !important;
        font-weight: 800 !important;
        text-transform: uppercase !important;
        background: rgba(13, 148, 136, 0.15) !important;
        color: #14b8a6 !important;
        padding: 0.3rem 0.75rem !important;
        border-radius: 9999px !important;
        border: 1px solid rgba(13, 148, 136, 0.3) !important;
        letter-spacing: 0.08em !important;
        font-family: system-ui, -apple-system, sans-serif !important;
      }
      .demo-notice-body {
        padding: 1.25rem 1.5rem !important;
        display: flex !important;
        flex-direction: column !important;
        gap: 1rem !important;
        box-sizing: border-box !important;
        overflow-y: auto !important;
        -webkit-overflow-scrolling: touch !important;
        max-height: calc(90vh - 130px) !important;
        max-height: calc(90dvh - 130px) !important;
      }
      .demo-notice-box {
        background: rgba(15, 23, 42, 0.7) !important;
        border: 1px solid rgba(255, 255, 255, 0.06) !important;
        border-radius: 12px !important;
        padding: 1rem 1.15rem !important;
        display: flex !important;
        gap: 0.85rem !important;
        align-items: flex-start !important;
        box-sizing: border-box !important;
      }
      .demo-notice-info-icon {
        width: 22px !important;
        height: 22px !important;
        background: #0ea5e9 !important;
        color: #ffffff !important;
        border-radius: 50% !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        font-size: 0.75rem !important;
        font-weight: 900 !important;
        flex-shrink: 0 !important;
        margin-top: 0.15rem !important;
        font-family: serif !important;
        font-style: italic !important;
      }
      .demo-notice-text {
        font-size: 0.88rem !important;
        line-height: 1.55 !important;
        color: #94a3b8 !important;
        margin: 0 !important;
        font-family: system-ui, -apple-system, sans-serif !important;
      }
      .demo-notice-text strong.red {
        color: #f87171 !important;
        font-weight: 800 !important;
      }
      .demo-notice-text strong.yellow {
        color: #fbbf24 !important;
        font-weight: 800 !important;
      }
      .demo-notice-checkbox-block {
        display: flex !important;
        align-items: center !important;
        gap: 0.85rem !important;
        cursor: pointer !important;
        padding: 0.85rem 1rem !important;
        border-radius: 12px !important;
        background: rgba(15, 23, 42, 0.7) !important;
        border: 1px solid rgba(255, 255, 255, 0.06) !important;
        transition: all 0.2s ease !important;
        touch-action: manipulation !important;
        -webkit-tap-highlight-color: transparent !important;
        box-sizing: border-box !important;
      }
      .demo-notice-checkbox-block:hover {
        border-color: rgba(20, 184, 166, 0.3) !important;
        background: rgba(20, 184, 166, 0.05) !important;
      }
      .demo-notice-check-box {
        width: 22px !important;
        height: 22px !important;
        border-radius: 6px !important;
        border: 2px solid rgba(255, 255, 255, 0.25) !important;
        background: rgba(255, 255, 255, 0.04) !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        color: #ffffff !important;
        flex-shrink: 0 !important;
        transition: all 0.2s ease !important;
      }
      .demo-notice-check-box svg {
        width: 14px !important;
        height: 14px !important;
        opacity: 0 !important;
        transform: scale(0.5) !important;
        transition: all 0.2s ease !important;
      }
      .demo-notice-checkbox-block.checked .demo-notice-check-box {
        background: #14b8a6 !important;
        border-color: #14b8a6 !important;
        box-shadow: 0 0 12px rgba(20, 184, 166, 0.4) !important;
      }
      .demo-notice-checkbox-block.checked .demo-notice-check-box svg {
        opacity: 1 !important;
        transform: scale(1) !important;
      }
      .demo-notice-checkbox-label {
        font-size: 0.88rem !important;
        color: #ffffff !important;
        line-height: 1.4 !important;
        font-weight: 700 !important;
        font-family: system-ui, -apple-system, sans-serif !important;
      }
      .demo-notice-footer {
        padding: 1rem 1.5rem 1.25rem !important;
        border-top: 1px solid rgba(255, 255, 255, 0.06) !important;
        display: flex !important;
        justify-content: flex-end !important;
        gap: 0.85rem !important;
        background: rgba(8, 14, 30, 0.8) !important;
        box-sizing: border-box !important;
      }
      .demo-notice-btn {
        padding: 0.75rem 1.6rem !important;
        font-size: 0.92rem !important;
        font-weight: 800 !important;
        border-radius: 12px !important;
        cursor: pointer !important;
        transition: all 0.2s ease !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        outline: none !important;
        border: none !important;
        box-sizing: border-box !important;
        touch-action: manipulation !important;
        -webkit-tap-highlight-color: transparent !important;
        font-family: system-ui, -apple-system, sans-serif !important;
      }
      .demo-notice-btn-learn {
        background: transparent !important;
        color: #94a3b8 !important;
        border: 1px solid rgba(255, 255, 255, 0.12) !important;
        text-decoration: none !important;
      }
      .demo-notice-btn-learn:hover {
        background: rgba(255, 255, 255, 0.06) !important;
        color: #ffffff !important;
        border-color: rgba(255, 255, 255, 0.25) !important;
      }
      .demo-notice-btn-continue {
        background: rgba(255, 255, 255, 0.06) !important;
        color: rgba(255, 255, 255, 0.35) !important;
        border: 1px solid rgba(255, 255, 255, 0.06) !important;
        cursor: not-allowed !important;
      }
      .demo-notice-btn-continue.active {
        background: linear-gradient(135deg, #0d9488 0%, #0284c7 100%) !important;
        color: #ffffff !important;
        border: 1px solid rgba(255, 255, 255, 0.15) !important;
        box-shadow: 0 6px 20px rgba(13, 148, 136, 0.35) !important;
        cursor: pointer !important;
      }
      .demo-notice-btn-continue.active:hover {
        transform: translate3d(0, -1.5px, 0) !important;
        box-shadow: 0 10px 25px rgba(13, 148, 136, 0.5) !important;
      }
    `;
    document.head.appendChild(modalStyle);

    // Lock body scroll
    document.body.style.overflow = 'hidden';

    // Modal DOM Container
    const modal = document.createElement('div');
    modal.id = 'demo-notice-modal';
    modal.innerHTML = `
      <div class="demo-notice-card" role="dialog" aria-modal="true">
        <div class="demo-notice-header">
          <div class="demo-notice-header-left">
            <img src="images/crowdcity_icon_transparent.png" onerror="this.onerror=null; this.src='/images/crowdcity_icon_transparent.png';" alt="CrowdCity Logo" class="demo-notice-logo" />
            <h3 class="demo-notice-title">${t.title}</h3>
          </div>
          <span class="demo-notice-badge">${t.badge}</span>
        </div>
        <div class="demo-notice-body">
          <!-- English Box -->
          <div class="demo-notice-box">
            <div class="demo-notice-info-icon">i</div>
            <p class="demo-notice-text">
              This is a <strong class="red">demonstration prototype</strong> for project purposes, <strong class="red">not an official government service</strong>. All complaints, accounts, and analytics are simulated/sample data. <strong class="yellow">Do not submit confidential, personal, financial, or sensitive information.</strong> The developers are not liable for actions based on this prototype.
            </p>
          </div>
          
          <!-- Tamil Box -->
          <div class="demo-notice-box">
            <div class="demo-notice-info-icon">i</div>
            <p class="demo-notice-text">
              இது ஒரு <strong class="red">மாதிரி முன்மாதிரி (prototype)</strong> செயலி, <strong class="red">அதிகாரப்பூர்வ அரசு சேவை அல்ல</strong>. இதில் உள்ள புகார்கள் மற்றும் தரவுகள் அனைத்தும் மாதிரி தகவல்களே. <strong class="yellow">ரகசியமான, தனிப்பட்ட, நிதி அல்லது உணர்வுப்பூர்வமான தகவல்களை சமர்ப்பிக்க வேண்டாம்.</strong> இதில் காட்டப்படும் தகவல்களால் ஏற்படும் விளைவுகளுக்கு டெவலப்பர்கள் பொறுப்பல்ல.
            </p>
          </div>

          <!-- Checkbox Block -->
          <div id="demo-notice-checkbox-block" class="demo-notice-checkbox-block">
            <div class="demo-notice-check-box">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
            <span class="demo-notice-checkbox-label">${t.checkbox}</span>
          </div>
        </div>
        <div class="demo-notice-footer">
          <a href="https://github.com/Dhanushraagav/CrowdCity" target="_blank" class="demo-notice-btn demo-notice-btn-learn">${t.learnMore}</a>
          <button type="button" id="demo-notice-continue-btn" class="demo-notice-btn demo-notice-btn-continue">${t.continue}</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Interactive State Manager
    let isChecked = false;
    const checkboxBlock = document.getElementById('demo-notice-checkbox-block');
    const continueBtn = document.getElementById('demo-notice-continue-btn');

    // Toggle Checkbox ON / OFF instantly on 1 tap
    function toggleCheckbox(e) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      isChecked = !isChecked;
      if (isChecked) {
        checkboxBlock.classList.add('checked');
        continueBtn.classList.add('active');
      } else {
        checkboxBlock.classList.remove('checked');
        continueBtn.classList.remove('active');
      }
    }

    checkboxBlock.addEventListener('click', toggleCheckbox);

    // Continue Action Handler
    function handleContinue(e) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (!isChecked) return;

      sessionStorage.removeItem('cc_show_demo_notice');
      document.body.style.overflow = '';

      modal.style.opacity = '0';
      modal.style.visibility = 'hidden';
      setTimeout(() => {
        if (modal.parentNode) modal.remove();
        if (modalStyle.parentNode) modalStyle.remove();
      }, 150);
    }

    continueBtn.addEventListener('click', handleContinue);

    // Prevent ESC key from closing, allow Enter key when checked
    window.addEventListener('keydown', function(e) {
      if (!document.getElementById('demo-notice-modal')) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
      } else if (e.key === 'Enter' && isChecked) {
        e.preventDefault();
        handleContinue();
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


