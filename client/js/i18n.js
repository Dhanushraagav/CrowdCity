const INLINE_EMBEDDED_TRANSLATIONS = {
  en: {
    nav_dashboard: "Dashboard",
    nav_report: "Report Issue",
    nav_my_complaints: "My Complaints",
    nav_map: "Map",
    nav_transportation: "Transportation",
    nav_services: "Government Services",
    district_helplines: "District Helplines",
    nav_ministers: "Council of Ministers",
    nav_about: "About CrowdCity AI",
    nav_admin: "Admin Panel",
    nav_cases: "Cases",
    nav_notifications: "Notifications",
    nav_profile: "Profile",
    nav_settings: "Settings",
    nav_logout: "Logout",
    sign_out: "Sign Out",
    sign_in: "Sign In",
    sign_up: "Sign Up"
  },
  ta: {
    nav_dashboard: "டாஷ்போர்ட்",
    nav_report: "புகார் அளி",
    nav_my_complaints: "எனது புகார்கள்",
    nav_map: "வரைபடம்",
    nav_transportation: "போக்குவரத்து",
    nav_services: "அரசு சேவைகள்",
    district_helplines: "மாவட்ட உதவி எண்கள்",
    nav_ministers: "அமைச்சரவை",
    nav_about: "CrowdCity AI பற்றி",
    nav_admin: "நிர்வாகி பேனல்",
    nav_cases: "வழக்குகள்",
    nav_notifications: "அறிவிப்புகள்",
    nav_profile: "சுயவிவரம்",
    nav_settings: "அமைப்புகள்",
    nav_logout: "வெளியேறு",
    sign_out: "வெளியேறு",
    sign_in: "உள்நுழை",
    sign_up: "பதிவு செய்"
  }
};

class I18nService {
  constructor() {
    this.currentLanguage = localStorage.getItem('cc_lang') || 'en';
    
    // Synchronous inline initializations (0ms startup delay)
    this.fallbackTranslations = { ...INLINE_EMBEDDED_TRANSLATIONS.en };
    this.translations = this.currentLanguage === 'ta' 
      ? { ...INLINE_EMBEDDED_TRANSLATIONS.ta } 
      : { ...INLINE_EMBEDDED_TRANSLATIONS.en };

    this.reverseEnglishMap = {};
    this.observer = null;

    // Build reverse map synchronously on startup
    this.buildReverseMap();

    // Perform immediate synchronous DOM translation if DOM is already populated
    if (document.body) {
      this.translatePage();
    }

    this.initPromise = this.init();
  }

  async init() {
    // Inject the custom styles for the toggle dynamically
    this.injectStyles();

    // Load full fallback translations asynchronously (English)
    try {
      const fullEn = await this.loadLocale('en');
      this.fallbackTranslations = { ...this.fallbackTranslations, ...fullEn };
    } catch (e) {
      console.error('Failed to load fallback translations (en):', e);
    }

    // Load full selected language translations asynchronously
    if (this.currentLanguage !== 'en') {
      try {
        const fullLang = await this.loadLocale(this.currentLanguage);
        this.translations = { ...this.translations, ...fullLang };
      } catch (e) {
        console.error(`Failed to load translations for ${this.currentLanguage}, falling back to English.`, e);
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
    const res = await fetch(`/locales/${lang}.json?v=1.0.9`);
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

    // Custom phrase mappings for common navigation & UI labels
    const customMappings = {
      "dashboard": "nav_dashboard",
      "report issue": "nav_report",
      "my complaints": "nav_my_complaints",
      "map": "nav_map",
      "transportation": "nav_transportation",
      "government services": "nav_services",
      "district helplines": "district_helplines",
      "council of ministers": "nav_ministers",
      "about crowdcity ai": "nav_about",
      "admin panel": "nav_admin",
      "cases": "nav_cases",
      "notifications": "nav_notifications",
      "profile": "nav_profile",
      "settings": "nav_settings",
      "logout": "nav_logout",
      "sign out": "sign_out",
      "sign in": "sign_in",
      "sign up": "sign_up",
      "step 1": "step_1",
      "step 2": "step_2",
      "step 3": "step_3",
      "choose issue type": "choose_issue_type",
      "report details": "report_details",
      "ai review": "ai_review",
      "civic issue": "civic_issue",
      "transportation issue": "transportation_issue",
      "examples:": "examples_label",
      "all schemes": "all_categories",
      "social welfare": "category_social_welfare",
      "education & youth": "category_education",
      "health & insurance": "category_health",
      "agriculture & farmers": "category_agriculture",
      "skill development": "category_skill_dev"
    };

    Object.keys(customMappings).forEach(phrase => {
      this.reverseEnglishMap[phrase.toLowerCase()] = customMappings[phrase];
    });
  }

  onDomReady() {
    this.injectLanguageToggle();
    this.translatePage();
    this.setupMutationObserver();
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
        const fullLang = await this.loadLocale(lang);
        this.translations = { ...INLINE_EMBEDDED_TRANSLATIONS.ta, ...fullLang };
      }
      this.currentLanguage = lang;
      localStorage.setItem('cc_lang', lang);
      
      this.updateToggleUI();
      this.translatePage();
      
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

    // 4. Smart auto-translation & data-i18n auto-stamping (when language is Tamil)
    if (this.currentLanguage === 'ta') {
      const selector = 'span, a, button, h1, h2, h3, h4, h5, h6, label, p, small, strong, li, td, th, .nav-link, .app-sidebar-link, .badge, .status-badge, .category-tag';
      const targets = document.querySelectorAll(selector);
      targets.forEach(el => {
        if (el.hasAttribute('data-i18n')) return;
        
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
            // Auto-stamp data-i18n attribute on the element to permanently lock its translation
            el.setAttribute('data-i18n', mappedKey);
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
          el.removeAttribute('data-i18n');
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
      }, 150);
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
      document.querySelector('.app-header-main') ||
      document.querySelector('.user-menu-wrapper') ||
      document.querySelector('.user-profile-menu') ||
      document.querySelector('.header-container');

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
