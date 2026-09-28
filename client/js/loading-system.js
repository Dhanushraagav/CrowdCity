/**
 * CrowdCity - Global Premium Civic-Tech Data Loading System
 * Reusable, cache-aware, concurrent-safe loading architecture.
 * Strictly ZERO emojis, zero fake delays, 100% tied to real async request lifecycles.
 */

(function () {
  'use strict';

  // Request & Target Reference Counter Map
  const _targetCounters = new WeakMap();
  const _selectorCounters = new Map();
  const _activeGlobalRequests = new Set();

  /**
   * Generates the SVG string for the CrowdCity Civic-Tech Geometric Emblem
   * @param {'lg'|'md'|'sm'} size
   */
  function getSvgEmblem(size = 'lg') {
    const isSm = size === 'sm';
    const viewBox = '0 0 80 80';

    if (isSm) {
      return `
        <svg class="cc-loader-svg" viewBox="${viewBox}" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <circle class="cc-loader-track" cx="40" cy="40" r="32" stroke="currentColor" stroke-opacity="0.2" stroke-width="6" />
          <circle class="cc-loader-orbit-fast" cx="40" cy="40" r="32" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-dasharray="50 150" />
          <circle class="cc-loader-beacon" cx="40" cy="40" r="10" fill="currentColor" />
        </svg>
      `;
    }

    return `
      <svg class="cc-loader-svg" viewBox="${viewBox}" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <linearGradient id="ccLoaderGradLight" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#0d9488" stop-opacity="1" />
            <stop offset="50%" stop-color="#06b6d4" stop-opacity="0.85" />
            <stop offset="100%" stop-color="#0284c7" stop-opacity="0" />
          </linearGradient>
          <linearGradient id="ccLoaderGradDark" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#38bdf8" stop-opacity="1" />
            <stop offset="50%" stop-color="#2dd4bf" stop-opacity="0.85" />
            <stop offset="100%" stop-color="#38bdf8" stop-opacity="0" />
          </linearGradient>
          <radialGradient id="ccLoaderPulseGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="var(--cc-loader-accent)" stop-opacity="0.22" />
            <stop offset="100%" stop-color="var(--cc-loader-accent)" stop-opacity="0" />
          </radialGradient>
        </defs>

        <!-- Ambient Center Glow -->
        <circle class="cc-loader-ambient-glow" cx="40" cy="40" r="30" fill="url(#ccLoaderPulseGrad)" />

        <!-- Outer Track Ring -->
        <circle class="cc-loader-track" cx="40" cy="40" r="35" stroke="var(--cc-loader-track)" stroke-width="1.5" stroke-linecap="round" />

        <!-- Orbital Sweep Arc (Rotates clockwise) -->
        <circle class="cc-loader-orbit-fast" cx="40" cy="40" r="35" stroke="var(--cc-loader-sweep)" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="65 155" />

        <!-- Inner Segmented Counter Ring (Rotates counter-clockwise) -->
        <circle class="cc-loader-orbit-reverse" cx="40" cy="40" r="27" stroke="var(--cc-loader-subtle)" stroke-width="1.2" stroke-dasharray="8 12" />

        <!-- 4 Cardinal Orbital Satellite Nodes -->
        <g class="cc-loader-satellites">
          <circle cx="40" cy="5" r="2.2" fill="var(--cc-loader-node)" class="cc-node cc-node-n" />
          <circle cx="75" cy="40" r="2.2" fill="var(--cc-loader-node)" class="cc-node cc-node-e" />
          <circle cx="40" cy="75" r="2.2" fill="var(--cc-loader-node)" class="cc-node cc-node-s" />
          <circle cx="5" cy="40" r="2.2" fill="var(--cc-loader-node)" class="cc-node cc-node-w" />
        </g>

        <!-- Center Geometric Civic Emblem -->
        <g class="cc-loader-center-emblem">
          <path class="cc-loader-shield" d="M40 23 L53 30.5 L53 47.5 L40 55 L27 47.5 L27 30.5 Z" stroke="var(--cc-loader-shield-stroke)" stroke-width="1.5" fill="var(--cc-loader-shield-fill)" stroke-linejoin="round" />
          <path class="cc-loader-c-mark" d="M44.5 35 C43.2 33.8 41.5 33.2 39.5 33.2 C35.8 33.2 33.2 36.2 33.2 40 C33.2 43.8 35.8 46.8 39.5 46.8 C41.5 46.8 43.2 46.2 44.5 45" stroke="var(--cc-loader-c-stroke)" stroke-width="2.2" stroke-linecap="round" fill="none" />
          <circle class="cc-loader-beacon" cx="40" cy="40" r="1.8" fill="var(--cc-loader-beacon)" />
        </g>
      </svg>
    `;
  }

  /**
   * Resolve DOM element from selector, string, or node
   */
  function resolveTarget(target) {
    if (!target) return null;
    if (typeof target === 'string') {
      return document.querySelector(target);
    }
    if (typeof HTMLElement !== 'undefined' && target instanceof HTMLElement) {
      return target;
    }
    if (target && (target.nodeType === 1 || target.children !== undefined)) {
      return target;
    }
    return null;
  }

  /**
   * Increment active request counter on target
   */
  function incrementCounter(element) {
    if (!element) return 1;
    const current = _targetCounters.get(element) || 0;
    const next = current + 1;
    _targetCounters.set(element, next);
    return next;
  }

  /**
   * Decrement active request counter on target
   */
  function decrementCounter(element) {
    if (!element) return 0;
    const current = _targetCounters.get(element) || 1;
    const next = Math.max(0, current - 1);
    if (next === 0) {
      _targetCounters.delete(element);
    } else {
      _targetCounters.set(element, next);
    }
    return next;
  }

  /**
   * Main Public CrowdCityLoading API
   */
  const CrowdCityLoading = {
    /**
     * Show a premium loading state in a container or section.
     * @param {HTMLElement|string} target - Target container or selector
     * @param {Object} options - Configuration options
     * @param {string} [options.message='Retrieving civic data...'] - Contextual title
     * @param {string} [options.subtitle=''] - Contextual secondary text
     * @param {'lg'|'md'|'sm'} [options.size='lg'] - Indicator scale
     * @param {boolean} [options.overlay=false] - Show as non-destructive overlay over existing section
     * @param {boolean} [options.inlineSeamless=false] - Transparent background without box border
     * @param {string} [options.minHeight] - Minimum container height
     * @returns {HTMLElement|null} The mounted loader element
     */
    show(target, options = {}) {
      const el = resolveTarget(target);
      if (!el) return null;

      const activeCount = incrementCounter(el);

      const message = options.message || 'Retrieving civic data...';
      const subtitle = options.subtitle || '';
      const size = options.size || (options.overlay ? 'md' : 'lg');
      const isOverlay = Boolean(options.overlay);
      const isSeamless = Boolean(options.inlineSeamless);

      // If loader already exists in this target, update message and return
      const existingLoader = el.querySelector(':scope > .cc-loading-container, :scope > .cc-section-overlay');
      if (existingLoader) {
        const titleEl = existingLoader.querySelector('.cc-loading-title');
        const subEl = existingLoader.querySelector('.cc-loading-subtitle');
        if (titleEl) titleEl.textContent = message;
        if (subEl) {
          subEl.textContent = subtitle;
          subEl.style.display = subtitle ? 'block' : 'none';
        }
        return existingLoader;
      }

      el.setAttribute('aria-busy', 'true');

      if (isOverlay) {
        el.classList.add('cc-loading-target-relative');
        const overlay = document.createElement('div');
        overlay.className = 'cc-section-overlay';
        overlay.setAttribute('role', 'status');
        overlay.setAttribute('aria-live', 'polite');
        overlay.setAttribute('aria-busy', 'true');
        overlay.innerHTML = `
          <div class="cc-loading-emblem-wrap cc-loader-${size}">
            ${getSvgEmblem(size)}
          </div>
          <p class="cc-loading-title">${escapeHtml(message)}</p>
          ${subtitle ? `<p class="cc-loading-subtitle">${escapeHtml(subtitle)}</p>` : ''}
          <div class="cc-loading-stream" aria-hidden="true"><div class="cc-loading-stream-bar"></div></div>
        `;
        el.appendChild(overlay);
        // Force reflow for smooth opacity transition
        overlay.offsetWidth;
        overlay.classList.add('active');
        return overlay;
      }

      // Default container replacement mode
      const loader = document.createElement('div');
      loader.className = `cc-loading-container cc-loader-${size}${isSeamless ? ' inline-seamless' : ''}`;
      loader.setAttribute('role', 'status');
      loader.setAttribute('aria-live', 'polite');
      loader.setAttribute('aria-busy', 'true');
      if (options.minHeight) {
        loader.style.minHeight = options.minHeight;
      }

      loader.innerHTML = `
        <div class="cc-loading-emblem-wrap">
          ${getSvgEmblem(size)}
        </div>
        <h4 class="cc-loading-title">${escapeHtml(message)}</h4>
        ${subtitle ? `<p class="cc-loading-subtitle">${escapeHtml(subtitle)}</p>` : ''}
        <div class="cc-loading-stream" aria-hidden="true"><div class="cc-loading-stream-bar"></div></div>
      `;

      el.innerHTML = '';
      el.appendChild(loader);
      return loader;
    },

    /**
     * Hide loading state for a target. Respects concurrent request reference counting.
     * @param {HTMLElement|string} target - Target container or selector
     * @param {boolean} [force=false] - Force removal regardless of active request counter
     */
    hide(target, force = false) {
      const el = resolveTarget(target);
      if (!el) return;

      const remaining = force ? 0 : decrementCounter(el);
      if (remaining > 0 && !force) {
        // Another concurrent request is still active on this container
        return;
      }

      el.removeAttribute('aria-busy');
      const loader = el.querySelector(':scope > .cc-loading-container, :scope > .cc-section-overlay');
      if (loader) {
        if (force) {
          loader.remove();
          if (el.classList.contains('cc-loading-target-relative')) {
            el.classList.remove('cc-loading-target-relative');
          }
          return;
        }
        if (loader.style) {
          loader.style.opacity = '0';
          loader.style.transition = 'opacity 0.16s ease';
        }
        setTimeout(() => {
          if (loader.parentNode === el || loader.parentElement === el) {
            loader.remove();
          }
          if (el.classList.contains('cc-loading-target-relative')) {
            el.classList.remove('cc-loading-target-relative');
          }
        }, 160);
      }
    },

    /**
     * Force hide loading state immediately regardless of pending counter.
     * @param {HTMLElement|string} target
     */
    forceHide(target) {
      return this.hide(target, true);
    },

    /**
     * Wrap any Promise or async function with guaranteed lifecycle loading.
     * Guaranteed to hide the loader in finally() regardless of success, error, or abort.
     * @param {Promise|Function|HTMLElement|string} arg1 - Action or Target
     * @param {HTMLElement|string|Promise|Function} arg2 - Target or Action
     * @param {Object} [options] - Loading options
     * @returns {Promise<any>}
     */
    async wrap(arg1, arg2, options = {}) {
      let action, target;
      if (typeof arg1 === 'function' || (arg1 && typeof arg1.then === 'function')) {
        action = arg1;
        target = arg2;
      } else {
        target = arg1;
        action = arg2;
      }
      CrowdCityLoading.show(target, options);
      try {
        const promise = typeof action === 'function' ? action() : action;
        return await promise;
      } finally {
        CrowdCityLoading.hide(target);
      }
    },

    /**
     * Set button action loading state (Refresh, Retry, Search, Submit, etc.).
     * Saves original HTML and restores it perfectly when loading finishes.
     * @param {HTMLElement|string} button - Button element or selector
     * @param {boolean} isLoading - Loading state
     * @param {Object|string} [options] - Options or loading text string
     * @param {string} [options.text='Loading...'] - Button text during loading
     */
    setButtonLoading(button, isLoading, options = {}) {
      const btn = resolveTarget(button);
      if (!btn) return;

      if (isLoading) {
        if (!btn._ccOriginalHtml) {
          btn._ccOriginalHtml = btn.innerHTML;
        }
        btn.disabled = true;
        btn.classList.add('cc-btn-loading');
        btn.setAttribute('aria-busy', 'true');
        const loadingText = typeof options === 'string' ? options : (options && options.text ? options.text : 'Loading...');
        btn.innerHTML = `
          <span class="cc-btn-loader-icon">${getSvgEmblem('sm')}</span>
          <span class="cc-btn-text">${escapeHtml(loadingText)}</span>
        `;
      } else {
        if (btn._ccOriginalHtml) {
          btn.innerHTML = btn._ccOriginalHtml;
          delete btn._ccOriginalHtml;
        }
        btn.disabled = false;
        btn.classList.remove('cc-btn-loading');
        btn.removeAttribute('aria-busy');
      }
    },

    /**
     * Cache-aware background refresh indicator.
     * Displays a subtle 2px accent progress sweep at the top edge of a container
     * without blanking or interrupting existing cached data.
     * @param {HTMLElement|string} target
     */
    showBackgroundSync(target) {
      const el = resolveTarget(target);
      if (!el) return;

      el.classList.add('cc-loading-target-relative');
      let syncBar = el.querySelector(':scope > .cc-sync-indicator-bar');
      if (!syncBar) {
        syncBar = document.createElement('div');
        syncBar.className = 'cc-sync-indicator-bar';
        syncBar.innerHTML = '<div class="cc-sync-indicator-progress"></div>';
        el.insertBefore(syncBar, el.firstChild);
      }
    },

    /**
     * Remove background sync indicator.
     * @param {HTMLElement|string} target
     */
    hideBackgroundSync(target) {
      const el = resolveTarget(target);
      if (!el) return;

      const syncBar = el.querySelector(':scope > .cc-sync-indicator-bar');
      if (syncBar) {
        syncBar.style.opacity = '0';
        syncBar.style.transition = 'opacity 0.2s ease';
        setTimeout(() => {
          syncBar.remove();
        }, 200);
      }
    },

    /**
     * Returns raw SVG string for use in custom templates.
     */
    getSvgMark(size = 'lg') {
      return getSvgEmblem(size);
    },

    /**
     * Returns full HTML string for rendering within table cells or custom blocks.
     */
    renderHTML(options = {}) {
      const message = options.message || 'Retrieving civic data...';
      const subtitle = options.subtitle || '';
      const size = options.size || 'md';
      return `
        <div class="cc-loading-container cc-loading-${size}" role="status" aria-busy="true" aria-live="polite" style="padding: 1.5rem 1rem; border: none; background: transparent;">
          <div class="cc-emblem-wrap">
            ${getSvgEmblem(size)}
          </div>
          <div class="cc-loading-content">
            <span class="cc-loading-title">${escapeHtml(message)}</span>
            ${subtitle ? `<span class="cc-loading-subtitle">${escapeHtml(subtitle)}</span>` : ''}
          </div>
        </div>
      `;
    }
  };

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Global Exports
  window.CrowdCityLoading = CrowdCityLoading;
  window.Loading = CrowdCityLoading;

})();
