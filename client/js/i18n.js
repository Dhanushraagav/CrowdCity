class I18nService {
  constructor() {
    this.currentLanguage = localStorage.getItem('cc_lang') || 'en';
    this.translations = {};
    this.fallbackTranslations = {};
    this.initPromise = this.init();
  }

  async init() {
    // Inject the custom styles for the toggle dynamically
    this.injectStyles();

    // Load fallback translations first (English)
    try {
      this.fallbackTranslations = await this.loadLocale('en');
    } catch (e) {
      console.error('Failed to load fallback translations (en):', e);
    }

    // Load selected language translations
    if (this.currentLanguage !== 'en') {
      try {
        this.translations = await this.loadLocale(this.currentLanguage);
      } catch (e) {
        console.error(`Failed to load translations for ${this.currentLanguage}, falling back to English.`, e);
        this.currentLanguage = 'en';
        this.translations = this.fallbackTranslations;
      }
    } else {
      this.translations = this.fallbackTranslations;
    }

    // Listen for DOMContentLoaded to set up initial translations and language toggle
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.onDomReady());
    } else {
      this.onDomReady();
    }
  }

  async loadLocale(lang) {
    const res = await fetch(`/locales/${lang}.json`);
    if (!res.ok) throw new Error(`Status ${res.status}`);
    return await res.json();
  }

  onDomReady() {
    // Inject language toggle
    this.injectLanguageToggle();
    // Perform initial page translation
    this.translatePage();
    // Dispatch initial language-change event to update dynamic layouts
    window.dispatchEvent(new CustomEvent('language-change', { detail: { language: this.currentLanguage } }));
  }

  getLanguage() {
    return this.currentLanguage;
  }

  async setLanguage(lang) {
    if (lang === this.currentLanguage) return;

    try {
      if (lang === 'en') {
        this.translations = this.fallbackTranslations;
      } else {
        this.translations = await this.loadLocale(lang);
      }
      this.currentLanguage = lang;
      localStorage.setItem('cc_lang', lang);
      
      // Update UI toggle buttons active status
      this.updateToggleUI();

      // Translate the DOM
      this.translatePage();

      // Dispatch global event for page controllers
      window.dispatchEvent(new CustomEvent('language-change', { detail: { language: lang } }));
    } catch (e) {
      console.error(`Failed to switch language to ${lang}:`, e);
    }
  }

  formatFallbackKey(key) {
    if (!key) return '';
    let cleanKey = key.replace(/^(status_|category_|cat_|nav_)/i, '');
    return cleanKey
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  t(key, variables = {}) {
    let text = this.translations[key] || this.fallbackTranslations[key];
    if (!text) {
      text = this.formatFallbackKey(key);
    }
    // Replace variable placeholders like {name}
    Object.keys(variables).forEach(varName => {
      text = text.replace(new RegExp(`{${varName}}`, 'g'), variables[varName]);
    });
    return text;
  }

  translatePage() {
    // 1. Scan and translate static elements
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (key) {
        const hasTranslation = this.translations[key] || this.fallbackTranslations[key];
        if (hasTranslation) {
          el.textContent = this.t(key);
        } else {
          // If no translation exists, only set formatted fallback key if element is currently empty
          if (!el.textContent.trim()) {
            el.textContent = this.t(key);
          }
        }
      }
    });

    // 2. Scan and translate input placeholders
    const placeholders = document.querySelectorAll('[data-i18n-placeholder]');
    placeholders.forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (key) {
        const hasTranslation = this.translations[key] || this.fallbackTranslations[key];
        if (hasTranslation) {
          el.placeholder = this.t(key);
        } else {
          if (!el.placeholder) {
            el.placeholder = this.t(key);
          }
        }
      }
    });

    // 3. Scan and translate titles
    const titles = document.querySelectorAll('[data-i18n-title]');
    titles.forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      if (key) {
        const hasTranslation = this.translations[key] || this.fallbackTranslations[key];
        if (hasTranslation) {
          el.title = this.t(key);
        } else {
          if (!el.title) {
            el.title = this.t(key);
          }
        }
      }
    });
  }

  injectStyles() {
    if (document.getElementById('i18n-styles')) return;
    const style = document.createElement('style');
    style.id = 'i18n-styles';
    style.textContent = `
      .lang-toggle {
        display: inline-flex;
        align-items: center;
        font-family: var(--font-heading, system-ui, -apple-system, sans-serif);
        font-size: 0.85rem;
        color: var(--text-muted, #94a3b8);
        margin-right: 0.75rem;
        user-select: none;
      }
      .lang-globe-icon {
        margin-right: 6px;
        font-size: 0.95rem;
        color: var(--text-muted, #94a3b8);
      }
      .lang-option {
        cursor: pointer;
        opacity: 0.65;
        transition: opacity 0.15s ease, color 0.15s ease;
        font-weight: 600;
        padding: 2px 4px;
        border-radius: var(--radius-sm, 4px);
      }
      .lang-option:hover {
        opacity: 0.9;
        color: var(--text-main, #f8fafc);
        background-color: var(--bg-surface-hover, rgba(255,255,255,0.05));
      }
      .lang-option.active {
        opacity: 1;
        color: var(--primary, #10b981) !important;
        font-weight: 700;
      }
      .lang-separator {
        opacity: 0.3;
        margin: 0 4px;
      }
      .lang-toggle-fixed {
        position: fixed;
        top: 1.25rem;
        right: 1.5rem;
        z-index: 10000;
        background-color: var(--bg-surface, #1e293b);
        border: 1px solid var(--border-color, #334155);
        padding: 0.4rem 0.75rem;
        border-radius: var(--radius-md, 6px);
        box-shadow: var(--shadow-lg, 0 10px 15px -3px rgba(0, 0, 0, 0.1));
        margin-right: 0 !important;
      }
    `;
    document.head.appendChild(style);
  }

  injectLanguageToggle() {
    if (document.getElementById('lang-toggle-container')) return;

    const container = document.createElement('div');
    container.id = 'lang-toggle-container';
    container.className = 'lang-toggle';
    container.innerHTML = `
      <i class="fa-solid fa-globe lang-globe-icon"></i>
      <span class="lang-option" data-lang="en">EN</span>
      <span class="lang-separator">|</span>
      <span class="lang-option" data-lang="ta">தமிழ்</span>
    `;

    // Add click listeners to spans
    container.querySelectorAll('.lang-option').forEach(span => {
      span.addEventListener('click', (e) => {
        const lang = e.target.getAttribute('data-lang');
        this.setLanguage(lang);
      });
    });

    const headerActions = document.querySelector('.app-header-actions');
    const topnavRight = document.querySelector('.topnav-right');

    if (headerActions) {
      headerActions.insertBefore(container, headerActions.firstChild);
      headerActions.addEventListener('click', (e) => e.stopPropagation());
    } else if (topnavRight) {
      topnavRight.insertBefore(container, topnavRight.firstChild);
    } else {
      container.classList.add('lang-toggle-fixed');
      document.body.appendChild(container);
    }

    this.updateToggleUI();
  }

  updateToggleUI() {
    const container = document.getElementById('lang-toggle-container');
    if (!container) return;
    const options = container.querySelectorAll('.lang-option');
    options.forEach(opt => {
      if (opt.getAttribute('data-lang') === this.currentLanguage) {
        opt.classList.add('active');
      } else {
        opt.classList.remove('active');
      }
    });
  }
}

window.i18n = new I18nService();
