/**
 * CrowdCity AI - Centralized Theme Management Service
 * 
 * Production Architecture:
 * 1. Single source of truth for authenticated users: Supabase Account Profile
 * 2. Default theme for new users: 'light'
 * 3. Early synchronous evaluation: applies 'data-theme' and theme classes to <html>
 *    before first paint to guarantee zero flash of wrong theme (0ms layout shift).
 * 4. Auth pages (auth.html, authority-login.html, reset-password.html) MUST ALWAYS REMAIN LIGHT MODE.
 * 5. Strictly decoupled from language preference.
 * 6. Theme controls reside EXCLUSIVELY in Settings -> Appearance / Theme.
 */

function isAuthPage() {
  if (typeof window !== 'undefined' && typeof window.getPageScope === 'function') {
    var s = window.getPageScope();
    return s === 'citizen-auth' || s === 'authority-auth';
  }
  if (typeof window === 'undefined' || !window.location) return false;
  var path = (window.location.pathname || '').toLowerCase().replace(/\\/g, '/');
  var file = path.split('/').pop().replace(/\.html$/, '');
  return file === 'auth' || file === 'authority-login' || file === 'reset-password' || file === 'login' || file === 'signup' || file === 'forgot-password';
}
if (typeof window !== 'undefined') {
  window.isAuthPage = isAuthPage;
}

(function() {
  function getSavedTheme() {
    try {
      var stored = localStorage.getItem('crowdcity_theme') || localStorage.getItem('cc_theme');
      return (stored === 'dark') ? 'dark' : 'light';
    } catch (e) {
      return 'light';
    }
  }

  function applyThemeImmediately(theme) {
    if (typeof document === 'undefined' || !document.documentElement) return;
    var effectiveTheme = isAuthPage() ? 'light' : theme;
    var isDark = (effectiveTheme === 'dark');
    document.documentElement.setAttribute('data-theme', effectiveTheme);
    document.documentElement.classList.toggle('dark-theme', isDark);
    document.documentElement.classList.toggle('theme-dark', isDark);
    document.documentElement.classList.toggle('light-theme', !isDark);
    document.documentElement.classList.toggle('theme-light', !isDark);
  }

  // Synchronous early paint bootstrap
  // Auth pages MUST ALWAYS be Light Mode
  var initialTheme = isAuthPage() ? 'light' : getSavedTheme();
  applyThemeImmediately(initialTheme);
})();

class CrowdCityThemeService {
  constructor() {
    this.currentTheme = this.getTheme();
    this.init();
  }

  getTheme() {
    try {
      var stored = localStorage.getItem('crowdcity_theme') || localStorage.getItem('cc_theme');
      return (stored === 'dark') ? 'dark' : 'light';
    } catch (e) {
      return 'light';
    }
  }

  setTheme(newTheme) {
    var theme = (newTheme === 'dark') ? 'dark' : 'light';
    var isSameTheme = (this.currentTheme === theme && 
      document.documentElement && 
      document.documentElement.getAttribute('data-theme') === theme);
    this.currentTheme = theme;

    try {
      localStorage.setItem('crowdcity_theme', theme);
      localStorage.setItem('cc_theme', theme);
      localStorage.setItem('cc_theme_explicit', theme);
      localStorage.setItem('cc_theme_updated_at', String(Date.now()));
    } catch (e) {
      console.warn('[CrowdCityTheme] Failed to persist theme to localStorage:', e);
    }

    this.applyTheme(theme);

    // Dispatch global custom event for reactive components (maps, charts, widgets)
    if (typeof window !== 'undefined' && !isSameTheme) {
      window.dispatchEvent(new CustomEvent('theme-change', {
        detail: { theme: theme, isDark: theme === 'dark' }
      }));
    }

    return theme;
  }

  applyTheme(theme) {
    if (typeof document === 'undefined' || !document.documentElement) return;
    var effectiveTheme = isAuthPage() ? 'light' : theme;
    var isDark = (effectiveTheme === 'dark');
    var root = document.documentElement;

    // Suppress CSS transitions during instantaneous theme toggle to prevent color fade flicker
    root.classList.add('theme-switching');

    root.setAttribute('data-theme', effectiveTheme);
    root.classList.toggle('dark-theme', isDark);
    root.classList.toggle('theme-dark', isDark);
    root.classList.toggle('light-theme', !isDark);
    root.classList.toggle('theme-light', !isDark);

    // Sync Settings UI if present on the page
    this.updateSettingsUI(theme);

    // Release theme-switching on next frame so normal component transitions function smoothly
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(function() {
        root.classList.remove('theme-switching');
      });
    } else {
      setTimeout(function() {
        root.classList.remove('theme-switching');
      }, 50);
    }
  }

  updateSettingsUI(theme) {
    if (typeof document === 'undefined') return;
    var isDark = (theme === 'dark');

    var btnLight = document.getElementById('btn-theme-light');
    var btnDark = document.getElementById('btn-theme-dark');
    var checkLight = document.getElementById('check-theme-light');
    var checkDark = document.getElementById('check-theme-dark');

    if (btnLight && btnDark) {
      if (isDark) {
        btnDark.style.borderColor = 'var(--primary)';
        btnDark.style.backgroundColor = 'var(--primary-light-alpha, rgba(13, 148, 136, 0.1))';
        btnLight.style.borderColor = 'var(--border-color)';
        btnLight.style.backgroundColor = 'var(--bg-app)';
        if (checkDark) checkDark.style.display = 'block';
        if (checkLight) checkLight.style.display = 'none';
      } else {
        btnLight.style.borderColor = 'var(--primary)';
        btnLight.style.backgroundColor = 'var(--primary-light-alpha, rgba(13, 148, 136, 0.1))';
        btnDark.style.borderColor = 'var(--border-color)';
        btnDark.style.backgroundColor = 'var(--bg-app)';
        if (checkLight) checkLight.style.display = 'block';
        if (checkDark) checkDark.style.display = 'none';
      }
    }
  }

  init() {
    this.currentTheme = this.getTheme();
    this.applyTheme(this.currentTheme);

    // Re-sync on DOM ready to update any theme control UI
    if (typeof document !== 'undefined') {
      const syncTheme = () => {
        this.currentTheme = this.getTheme();
        this.applyTheme(this.currentTheme);
      };

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', syncTheme);
      } else {
        syncTheme();
      }
    }

    // Handle Back/Forward Cache (BFCache) navigation
    if (typeof window !== 'undefined') {
      window.addEventListener('pageshow', (event) => {
        this.currentTheme = this.getTheme();
        this.applyTheme(this.currentTheme);
      });

      // Synchronize across open browser tabs
      window.addEventListener('storage', (event) => {
        if (event.key === 'crowdcity_theme' || event.key === 'cc_theme') {
          this.currentTheme = this.getTheme();
          this.applyTheme(this.currentTheme);
        }
      });
    }
  }
}

// Instantiate globally
if (typeof window !== 'undefined') {
  window.CrowdCityTheme = new CrowdCityThemeService();
  window.getPortalTheme = function() {
    return window.CrowdCityTheme.getTheme();
  };
  window.setPortalTheme = function(theme) {
    return window.CrowdCityTheme.setTheme(theme);
  };
}
