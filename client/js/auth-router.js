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

  // Inject premium government top progress bar loader (ZERO LOGOS)
  const loaderStyle = document.createElement('style');
  loaderStyle.id = 'global-page-loader-style';
  loaderStyle.innerHTML = `
    #global-page-loader {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 999999;
      transition: opacity 0.25s ease, visibility 0.25s ease;
      opacity: 1;
      visibility: visible;
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
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
      background: linear-gradient(90deg, #0f766e, #2dd4bf, #0f766e);
      z-index: 1000000;
      animation: govTopLoaderProgress 1.5s linear infinite;
      box-shadow: 0 0 10px rgba(15, 118, 110, 0.5);
    }
    @keyframes govTopLoaderProgress {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(100%); }
    }
    .gov-loader-spinner {
      width: 42px;
      height: 42px;
      border: 3px solid rgba(15, 118, 110, 0.15);
      border-top-color: #0f766e;
      border-radius: 50%;
      animation: govSpinnerRotate 0.8s linear infinite;
    }
    @keyframes govSpinnerRotate {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .gov-loader-title {
      font-size: 0.85rem;
      font-weight: 700;
      color: #0f172a;
      letter-spacing: 0.05em;
      margin-top: 1.25rem;
      text-transform: uppercase;
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
      <div class="gov-loader-spinner"></div>
      <div class="gov-loader-title">Government Services Portal</div>
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
    else if (role === 'authority') target = 'admin.html';
    else if (role === 'admin') target = 'admin.html';
    
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
  const AUTHORITY_DASHBOARD = 'admin.html';
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
    } else if (role === 'authority') {
      // Authority users CAN access admin.html (unified portal) but NOT citizen pages
      if (isCitizenPage) {
        console.warn("[Auth Router] Authority role cannot access citizen page. Redirecting.");
        window.location.href = AUTHORITY_DASHBOARD;
        return;
      }
    } else if (role === 'admin') {
      if (isCitizenPage) {
        console.warn("[Auth Router] Admin role cannot access citizen page. Redirecting.");
        window.location.href = ADMIN_DASHBOARD;
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
    if (normalizedPath.endsWith('/auth') || normalizedPath.endsWith('/authority-login') || normalizedPath.includes('auth.html') || normalizedPath.includes('authority-login.html') || normalizedPath.endsWith('/') || normalizedPath.endsWith('/index')) {
      return;
    }

    // Ensure we don't inject multiple times
    if (document.getElementById('demo-notice-modal')) {
      return;
    }

    const translations = {
      en: {
        title: "Notice",
        badge: "Sandbox",
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
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(3, 7, 18, 0.85);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
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
        background: linear-gradient(135deg, #111827, #0f172a);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 20px;
        max-width: 680px;
        width: 100%;
        max-height: 90vh;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
        overflow: hidden;
        display: flex;
        flex-direction: column;
        animation: demoModalFadeIn 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        box-sizing: border-box;
        position: relative;
      }
      @keyframes demoModalFadeIn {
        from { opacity: 0; transform: scale(0.93) translateY(20px); }
        to { opacity: 1; transform: scale(1) translateY(0); }
      }
      .demo-notice-header {
        position: relative;
        z-index: 1;
        padding: 1.25rem 1.5rem 1rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .demo-notice-header-left {
        display: flex;
        align-items: center;
        gap: 0.85rem;
      }
      .demo-notice-header-icon {
        font-size: 1.75rem;
        color: #3b82f6;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .demo-notice-title {
        font-size: 1.25rem;
        font-weight: 800;
        color: #ffffff;
        margin: 0;
        letter-spacing: -0.02em;
      }
      .demo-notice-badge {
        font-size: 0.7rem;
        font-weight: 700;
        text-transform: uppercase;
        background: rgba(59, 130, 246, 0.15);
        color: #60a5fa;
        padding: 0.25rem 0.6rem;
        border-radius: 9999px;
        border: 1px solid rgba(59, 130, 246, 0.2);
        letter-spacing: 0.05em;
      }
      .demo-notice-body {
        position: relative;
        z-index: 1;
        padding: 1.25rem 1.5rem;
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
        box-sizing: border-box;
        overflow-y: auto;
        max-height: calc(90vh - 120px);
      }
      .demo-notice-banner {
        background: rgba(3, 7, 18, 0.6);
        border: 1px solid rgba(59, 130, 246, 0.25);
        border-radius: 12px;
        padding: 1.25rem 1.5rem;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1.5rem;
        box-sizing: border-box;
        position: relative;
      }
      .demo-notice-col-left {
        padding-right: 1.5rem;
        border-right: 1px solid rgba(255, 255, 255, 0.08);
      }
      @media (max-width: 768px) {
        .demo-notice-banner {
          grid-template-columns: 1fr;
          gap: 1.25rem;
          padding: 1rem 1.25rem;
        }
        .demo-notice-col-left {
          padding-right: 0;
          border-right: none;
          padding-bottom: 1.25rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }
      }
      .demo-notice-banner-icon {
        color: #60a5fa;
        font-size: 1.2rem;
        margin-top: 0.15rem;
        flex-shrink: 0;
      }
      .demo-notice-banner-text {
        font-size: 0.92rem;
        line-height: 1.6;
        color: #f1f5f9;
        margin: 0;
      }
      .demo-notice-banner-text strong {
        color: #ffffff;
        font-weight: 800;
      }
      .demo-notice-banner-text .alert-strong {
        color: #f87171;
        font-weight: 800;
      }
      .demo-notice-banner-text .alert-highlight {
        color: #fbbf24;
        font-weight: 800;
      }
      .demo-notice-checkbox-wrapper {
        display: flex;
        align-items: center;
        gap: 0.85rem;
        cursor: pointer;
        user-select: none;
        padding: 0.5rem 0.75rem;
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.02);
        border: 1px solid rgba(255, 255, 255, 0.03);
        transition: all 0.2s ease;
      }
      .demo-notice-checkbox-wrapper:hover {
        background: rgba(255, 255, 255, 0.05);
        border-color: rgba(255, 255, 255, 0.07);
      }
      .demo-notice-checkbox-input {
        width: 20px;
        height: 20px;
        border-radius: 6px;
        border: 1.5px solid rgba(255, 255, 255, 0.2);
        background: rgba(255, 255, 255, 0.05);
        cursor: pointer;
        accent-color: #0D9488;
        flex-shrink: 0;
        transition: all 0.2s ease;
      }
      .demo-notice-checkbox-label {
        font-size: 0.88rem;
        color: #e2e8f0;
        line-height: 1.4;
        font-weight: 600;
      }
      .demo-notice-footer {
        position: relative;
        z-index: 1;
        padding: 1rem 1.5rem 1.25rem;
        border-top: 1px solid rgba(255, 255, 255, 0.06);
        display: flex;
        justify-content: flex-end;
        gap: 0.85rem;
        background: rgba(10, 15, 30, 0.5);
        box-sizing: border-box;
      }
      .demo-notice-btn {
        padding: 0.7rem 1.5rem;
        font-size: 0.9rem;
        font-weight: 700;
        border-radius: 10px;
        cursor: pointer;
        transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        outline: none;
        box-sizing: border-box;
      }
      .demo-notice-btn-primary {
        background: linear-gradient(135deg, #0d9488 0%, #0f766e 100%);
        color: #ffffff;
        border: 1px solid rgba(255, 255, 255, 0.1);
      }
      .demo-notice-btn-primary:hover:not(:disabled) {
        transform: translateY(-1.5px);
        background: linear-gradient(135deg, #0f766e 0%, #115e59 100%);
      }
      .demo-notice-btn-primary:active:not(:disabled) {
        transform: translateY(0);
      }
      .demo-notice-btn-primary:disabled {
        opacity: 0.35;
        cursor: not-allowed;
        background: rgba(255, 255, 255, 0.05);
        color: rgba(255, 255, 255, 0.3);
        border: 1px solid rgba(255, 255, 255, 0.05);
      }
      .demo-notice-btn-secondary {
        background: transparent;
        color: #cbd5e1;
        border: 1px solid rgba(255, 255, 255, 0.12);
        text-decoration: none;
      }
      .demo-notice-btn-secondary:hover {
        background: rgba(255, 255, 255, 0.05);
        color: #ffffff;
        border-color: rgba(255, 255, 255, 0.25);
        transform: translateY(-1.5px);
      }
    `;
    document.head.appendChild(modalStyle);

    // Build the modal HTML elements dynamically
    const modal = document.createElement('div');
    modal.id = 'demo-notice-modal';
    modal.innerHTML = `
      <div class="demo-notice-card">
        <div class="demo-notice-header">
          <div class="demo-notice-header-left">
            <div class="demo-notice-header-icon" style="margin-right: 0.25rem;">
              <img src="images/crowdcity_icon_transparent.png" alt="CrowdCity Logo" style="height: 32px; width: auto; display: block;" />
            </div>
            <h3 class="demo-notice-title">${t.title}</h3>
          </div>
          <span class="demo-notice-badge">${t.badge}</span>
        </div>
        <div class="demo-notice-body">
          <div class="demo-notice-banner">
            <!-- English Version -->
            <div class="demo-notice-col-left" style="display: flex; gap: 0.75rem; align-items: flex-start;">
              <div class="demo-notice-banner-icon" style="color: #60a5fa; margin-top: 0.1rem;">
                <svg style="width: 20px; height: 20px;" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
                </svg>
              </div>
              <p class="demo-notice-banner-text">
                This is a <strong class="alert-strong">demonstration prototype</strong> for project purposes, <strong class="alert-strong">not an official government service</strong>. All complaints, accounts, and analytics are simulated/sample data. <span class="alert-highlight">Do not submit confidential, personal, financial, or sensitive information</span>. The developers are not liable for actions based on this prototype.
              </p>
            </div>
            
            <!-- Tamil Version -->
            <div class="demo-notice-col-right" style="display: flex; gap: 0.75rem; align-items: flex-start;">
              <div class="demo-notice-banner-icon" style="color: #60a5fa; margin-top: 0.1rem;">
                <svg style="width: 20px; height: 20px;" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
                </svg>
              </div>
              <p class="demo-notice-banner-text">
                இது ஒரு <strong class="alert-strong">மாதிரி முன்மாதிரி (prototype)</strong> செயலி, <strong class="alert-strong">அதிகாரப்பூர்வ அரசு சேவை அல்ல</strong>. இதில் உள்ள புகார்கள் மற்றும் தரவுகள் அனைத்தும் மாதிரி தகவல்களே. <span class="alert-highlight">ரகசியமான, தனிப்பட்ட, நிதி அல்லது உணர்வுப்பூர்வமான தகவல்களை சமர்ப்பிக்க வேண்டாம்</span>. இதில் காட்டப்படும் தகவல்களால் ஏற்படும் விளைவுகளுக்கு டெவலப்பர்கள் பொறுப்பல்ல.
              </p>
            </div>
          </div>
          <label class="demo-notice-checkbox-wrapper" for="demo-notice-checkbox">
            <input type="checkbox" id="demo-notice-checkbox" class="demo-notice-checkbox-input" />
            <span class="demo-notice-checkbox-label">${t.checkbox}</span>
          </label>
        </div>
        <div class="demo-notice-footer">
          <a href="https://github.com/Dhanushraagav/CrowdCity" target="_blank" class="demo-notice-btn demo-notice-btn-secondary">${t.learnMore}</a>
          <button type="button" id="demo-notice-continue-btn" class="demo-notice-btn demo-notice-btn-primary" disabled>${t.continue}</button>
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

