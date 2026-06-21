// CrowdCity - Central Authentication Router & Role Separator
// Runs synchronously in `<head>` to prevent flashes of unauthorized/incorrect layouts

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
      align-items: center;
      gap: 0.6rem;
      font-size: 1.35rem;
      font-weight: 700;
      color: #ffffff;
      letter-spacing: 0.05em;
    }
    .loader-logo i {
      color: #0d9488;
      font-size: 1.5rem;
    }
    .loader-text {
      font-size: 0.78rem;
      color: rgba(255, 255, 255, 0.5);
      letter-spacing: 0.08em;
      font-weight: 600;
      text-transform: uppercase;
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
          <i class="fa-solid fa-city"></i>
          <span>CrowdCity AI</span>
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

  // If we are on the reset-password page, let reset-password.js manage it
  if (isResetPasswordPage) {
    console.log('[Auth Router] Reset password page detected. Delegating routing control to reset-password.js.');
    return;
  }

  // 1. Detect OAuth callback — Supabase returns access_token in the URL hash
  // after Google OAuth. auth.js must process these tokens; DO NOT redirect away.
  const isCitizenLoginPage_early = (normalizedPath.includes('auth') || normalizedPath.includes('auth.html')) && !normalizedPath.includes('authority-login');
  const hasOAuthHash = hash.includes('access_token') ||
                       hash.includes('refresh_token') ||
                       hash.includes('type=signup') ||
                       search.includes('code=');   // PKCE flow
  if (isCitizenLoginPage_early && hasOAuthHash) {
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
  const isIndexPage = normalizedPath.endsWith('/') || normalizedPath.endsWith('/index');
  const isCitizenLoginPage = (normalizedPath.includes('auth') || normalizedPath.includes('auth.html')) && !normalizedPath.includes('authority-login');
  const isAuthorityLoginPage = normalizedPath.includes('authority-login');

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
  }
})();
