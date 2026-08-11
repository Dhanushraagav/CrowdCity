class I18nService {
  constructor() {
    this.currentLanguage = localStorage.getItem('cc_lang') || 'en';
    this.translations = {};
    this.fallbackTranslations = {};
    this.reverseEnglishMap = {};
    this.observer = null;
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

    this.buildReverseMap();

    // Listen for DOMContentLoaded to set up initial translations and language toggle
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.onDomReady());
    } else {
      this.onDomReady();
    }
  }

  async loadLocale(lang) {
    const res = await fetch(`/locales/${lang}.json?v=1.0.7`);
    if (!res.ok) throw new Error(`Status ${res.status}`);
    return await res.json();
  }

  buildReverseMap() {
    this.reverseEnglishMap = {};
    if (!this.fallbackTranslations) return;

    Object.keys(this.fallbackTranslations).forEach(key => {
      const enVal = this.fallbackTranslations[key];
      if (typeof enVal === 'string' && enVal.trim()) {
        this.reverseEnglishMap[enVal.trim().toLowerCase()] = key;
      }
      const formattedKey = this.formatFallbackKey(key);
      if (formattedKey && formattedKey.trim()) {
        this.reverseEnglishMap[formattedKey.trim().toLowerCase()] = key;
      }
    });
  }

  onDomReady() {
    // Inject language toggle
    this.injectLanguageToggle();
    // Perform initial page translation
    this.translatePage();
    // Setup observer for dynamically rendered JS elements
    this.setupMutationObserver();
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
    // 1. Scan and translate explicit data-i18n elements
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (key) {
        const hasTranslation = this.translations[key] || this.fallbackTranslations[key];
        if (hasTranslation) {
          el.textContent = this.t(key);
        } else if (!el.textContent.trim()) {
          el.textContent = this.t(key);
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
        }
      }
    });

    // 4. Smart auto-translation for un-annotated DOM text nodes (when language is Tamil)
    if (this.currentLanguage === 'ta') {
      const targets = document.querySelectorAll(
        'button, a, h1, h2, h3, h4, h5, h6, label, .nav-text, .nav-item, .status-badge, .badge, .category-tag, th, .btn, .card-title, .header-title'
      );
      targets.forEach(el => {
        if (el.hasAttribute('data-i18n') || el.children.length > 2) return;
        
        const directText = Array.from(el.childNodes)
          .filter(n => n.nodeType === Node.TEXT_NODE)
          .map(n => n.textContent.trim())
          .join(' ')
          .trim();

        if (directText) {
          const lowerText = directText.toLowerCase();
          const mappedKey = this.reverseEnglishMap[lowerText];
          if (mappedKey && this.translations[mappedKey]) {
            if (!el.getAttribute('data-orig-en')) {
              el.setAttribute('data-orig-en', directText);
            }
            const tamilText = this.translations[mappedKey];
            el.childNodes.forEach(n => {
              if (n.nodeType === Node.TEXT_NODE && n.textContent.trim().toLowerCase() === lowerText) {
                n.textContent = tamilText;
              }
            });
          }
        }
      });
    } else if (this.currentLanguage === 'en') {
      // Restore original English text when toggling back
      const origElements = document.querySelectorAll('[data-orig-en]');
      origElements.forEach(el => {
        const origText = el.getAttribute('data-orig-en');
        if (origText) {
          el.childNodes.forEach(n => {
            if (n.nodeType === Node.TEXT_NODE) {
              n.textContent = origText;
            }
          });
        }
      });
    }
  }

  setupMutationObserver() {
    if (this.observer) return;
    let timeoutId = null;
    this.observer = new MutationObserver(() => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        this.translatePage();
      }, 250);
    });
    this.observer.observe(document.body, { childList: true, subtree: true });
  }

  injectStyles() {
    if (document.getElementById('i18n-styles')) return;
    const style = document.createElement('style');
    style.id = 'i18n-styles';
    style.textContent = `
      .lang-toggle {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        font-family: inherit;
        font-size: 0.82rem;
        font-weight: 700;
        color: var(--text-muted, #64748b);
        background: var(--bg-surface-hover, #f8fafc);
        border: 1px solid var(--border-color, #e2e8f0);
        border-radius: 10px;
        padding: 0.42rem 0.75rem;
        height: 38px;
        box-sizing: border-box;
        user-select: none;
      }
      .lang-globe-icon {
        font-size: 0.85rem;
        color: var(--text-muted, #64748b);
      }
      .lang-option {
        cursor: pointer;
        opacity: 0.7;
        transition: opacity 0.15s ease, color 0.15s ease;
        font-weight: 700;
        padding: 0 2px;
      }
      .lang-option:hover {
        opacity: 1;
        color: var(--primary, #0d9488);
      }
      .lang-option.active {
        opacity: 1;
        color: var(--primary, #0d9488) !important;
        font-weight: 800;
      }
      .lang-separator {
        opacity: 0.3;
        margin: 0 2px;
      }
      .lang-toggle-fixed {
        position: fixed;
        top: 1.25rem;
        right: 1.5rem;
        z-index: 10000;
        background-color: var(--bg-surface, #1e293b);
        border: 1px solid var(--border-color, #334155);
        padding: 0.4rem 0.75rem;
        border-radius: 10px;
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

    const targetHeader = 
      document.querySelector('.app-header-actions') ||
      document.querySelector('.header-actions') ||
      document.querySelector('.topnav-right') ||
      document.querySelector('.nav-actions') ||
      document.querySelector('.header-right') ||
      document.querySelector('.auth-header') ||
      document.querySelector('.app-header-main');

    if (targetHeader) {
      targetHeader.insertBefore(container, targetHeader.firstChild);
      targetHeader.addEventListener('click', (e) => e.stopPropagation());
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
