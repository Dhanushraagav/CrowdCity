/**
 * CrowdCity AI - Centralized Theme Management Service
 * 
 * Production Architecture:
 * 1. Single source of truth: localStorage 'crowdcity_theme' / 'cc_theme'
 * 2. Default theme for new users: 'light'
 * 3. Early synchronous evaluation: applies 'data-theme' and theme classes to <html>
 *    before first paint to guarantee zero flash of wrong theme (0ms layout shift).
 * 4. Strictly decoupled from language preference.
 * 5. Theme controls reside EXCLUSIVELY in Settings -> Appearance / Theme.
 */

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
    var isDark = (theme === 'dark');
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.classList.toggle('dark-theme', isDark);
    document.documentElement.classList.toggle('theme-dark', isDark);
    document.documentElement.classList.toggle('light-theme', !isDark);
    document.documentElement.classList.toggle('theme-light', !isDark);
  }

  // Synchronous early paint bootstrap
  var initialTheme = getSavedTheme();
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
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('theme-change', {
        detail: { theme: theme, isDark: theme === 'dark' }
      }));
    }

    return theme;
  }

  applyTheme(theme) {
    if (typeof document === 'undefined' || !document.documentElement) return;
    var isDark = (theme === 'dark');
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.classList.toggle('dark-theme', isDark);
    document.documentElement.classList.toggle('theme-dark', isDark);
    document.documentElement.classList.toggle('light-theme', !isDark);
    document.documentElement.classList.toggle('theme-light', !isDark);

    // Sync Settings UI if present on the page
    this.updateSettingsUI(theme);
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
