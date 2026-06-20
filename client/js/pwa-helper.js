// CrowdCity AI - PWA Setup and Installation Helper
// Registers sw.js, handles the installation banners, and displays verification toasts.

(function() {
  // Styles for the Install Banner and Toast Notifications
  const pwaStyles = `
    /* Floating Glassmorphic Install Banner */
    #cc-pwa-banner {
      position: fixed;
      bottom: 20px;
      left: 20px;
      right: 20px;
      background: rgba(15, 23, 42, 0.92);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      padding: 1rem 1.25rem;
      display: flex;
      align-items: center;
      gap: 16px;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45);
      z-index: 10000;
      transform: translateY(150%);
      transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
      box-sizing: border-box;
    }

    #cc-pwa-banner.show {
      transform: translateY(0);
    }

    #cc-pwa-banner-icon {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      object-fit: cover;
      flex-shrink: 0;
      background-color: var(--primary, #0d9488);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .cc-pwa-banner-info {
      flex: 1;
    }

    .cc-pwa-banner-info h4 {
      font-size: 0.95rem;
      font-weight: 600;
      color: #ffffff;
      margin: 0 0 2px 0;
      font-family: system-ui, sans-serif;
    }

    .cc-pwa-banner-info p {
      font-size: 0.8rem;
      color: #94a3b8;
      margin: 0;
      line-height: 1.4;
      font-family: system-ui, sans-serif;
    }

    .cc-pwa-banner-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    #cc-pwa-banner-install-btn {
      background-color: #0d9488;
      color: #ffffff;
      border: none;
      border-radius: 8px;
      padding: 8px 16px;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
      transition: background-color 0.2s ease, transform 0.1s ease;
      font-family: system-ui, sans-serif;
    }

    #cc-pwa-banner-install-btn:hover {
      background-color: #14b8a6;
    }

    #cc-pwa-banner-install-btn:active {
      transform: scale(0.97);
    }

    #cc-pwa-banner-close-btn {
      background: none;
      border: none;
      color: #94a3b8;
      font-size: 1.25rem;
      cursor: pointer;
      padding: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: color 0.15s ease;
    }

    #cc-pwa-banner-close-btn:hover {
      color: #ffffff;
    }

    /* PWA Success Toast Notification */
    #cc-pwa-toast {
      position: fixed;
      top: 24px;
      left: 50%;
      transform: translate(-50%, -180%);
      background: #10b981;
      color: #ffffff;
      padding: 12px 24px;
      border-radius: 12px;
      font-size: 0.9rem;
      font-weight: 600;
      box-shadow: 0 10px 25px rgba(16, 185, 129, 0.35);
      z-index: 10001;
      opacity: 0;
      transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease;
      white-space: nowrap;
      pointer-events: none;
      font-family: system-ui, sans-serif;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    #cc-pwa-toast.show {
      transform: translate(-50%, 0);
      opacity: 1;
    }

    /* Mobile Responsive Optimizations */
    @media (max-width: 768px) {
      #cc-pwa-banner {
        left: 12px;
        right: 12px;
        bottom: 12px;
        padding: 0.85rem 1rem;
        gap: 12px;
      }
    }

    @media (max-width: 540px) {
      #cc-pwa-banner {
        flex-direction: column;
        align-items: stretch;
        gap: 14px;
      }
      .cc-pwa-banner-actions {
        justify-content: flex-end;
      }
      #cc-pwa-banner-install-btn {
        flex: 1;
        text-align: center;
      }
    }
  `;

  let deferredPrompt = null;

  // Initialize PWA scripts
  function initPwaHelper() {
    // 1. Inject styling dynamically
    const styleEl = document.createElement('style');
    styleEl.innerHTML = pwaStyles;
    document.head.appendChild(styleEl);

    // 2. Create the PWA Install Banner DOM structure (initially hidden)
    const banner = document.createElement('div');
    banner.id = 'cc-pwa-banner';
    banner.innerHTML = `
      <img id="cc-pwa-banner-icon" src="icon-192.png" alt="CrowdCity AI Logo">
      <div class="cc-pwa-banner-info">
        <h4>Install CrowdCity AI</h4>
        <p>Install CrowdCity as a standalone application on your home screen.</p>
      </div>
      <div class="cc-pwa-banner-actions">
        <button id="cc-pwa-banner-install-btn">Install</button>
        <button id="cc-pwa-banner-close-btn" aria-label="Dismiss">&times;</button>
      </div>
    `;
    document.body.appendChild(banner);

    // 3. Create the toast DOM structure
    const toast = document.createElement('div');
    toast.id = 'cc-pwa-toast';
    toast.innerHTML = `
      <span>🎉</span>
      <span>CrowdCity AI installed successfully!</span>
    `;
    document.body.appendChild(toast);

    // 4. Attach banner button click events
    const installBtn = document.getElementById('cc-pwa-banner-install-btn');
    const closeBtn = document.getElementById('cc-pwa-banner-close-btn');

    installBtn.addEventListener('click', handleInstallClick);
    closeBtn.addEventListener('click', dismissBanner);

    // 5. Register Service Worker after load
    registerServiceWorker();
  }

  // Register sw.js safely
  async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('✅ ServiceWorker registered successfully with scope:', registration.scope);
      } catch (error) {
        console.error('❌ ServiceWorker registration failed:', error);
      }
    }
  }

  // Handle BeforeInstallPrompt event
  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent default browser install banner/infobar
    e.preventDefault();
    // Cache the event so it can be triggered later
    deferredPrompt = e;

    console.log('[PWA] Captured beforeinstallprompt event.');

    // Only display if the user hasn't explicitly dismissed it in this session,
    // and if the application is not already installed.
    const isDismissed = localStorage.getItem('cc_pwa_install_dismissed') === 'true';
    const isInstalled = localStorage.getItem('cc_pwa_installed') === 'true';

    // Target mobile screens for install banners as specified
    if (!isDismissed && !isInstalled) {
      setTimeout(showBanner, 2000); // 2 second delay for better entry feel
    }
  });

  // Handle successful installation
  window.addEventListener('appinstalled', (e) => {
    console.log('[PWA] App successfully installed!');
    // Set install state
    localStorage.setItem('cc_pwa_installed', 'true');
    deferredPrompt = null;
    hideBanner();
    showInstallToast();
  });

  // Slide-in the banner
  function showBanner() {
    const banner = document.getElementById('cc-pwa-banner');
    if (banner) {
      banner.classList.add('show');
    }
  }

  // Slide-out the banner
  function hideBanner() {
    const banner = document.getElementById('cc-pwa-banner');
    if (banner) {
      banner.classList.remove('show');
    }
  }

  // Dismiss banner handler
  function dismissBanner() {
    hideBanner();
    // Remember dismissal in localStorage so it doesn't reappear
    localStorage.setItem('cc_pwa_install_dismissed', 'true');
  }

  // Install button click handler
  async function handleInstallClick() {
    if (!deferredPrompt) return;

    // Show native browser install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`[PWA] User install choice outcome: ${outcome}`);

    // If accepted, hide prompt.
    if (outcome === 'accepted') {
      localStorage.setItem('cc_pwa_installed', 'true');
      hideBanner();
    }
    
    deferredPrompt = null;
  }

  // Display success toast notification
  function showInstallToast() {
    const toast = document.getElementById('cc-pwa-toast');
    if (toast) {
      toast.classList.add('show');
      setTimeout(() => {
        toast.classList.remove('show');
      }, 4000); // Hide after 4 seconds
    }
  }

  // Load PWA UI elements on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPwaHelper);
  } else {
    initPwaHelper();
  }
})();
