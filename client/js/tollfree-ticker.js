/**
 * CrowdCity AI - Persistent Floating Customer Toll-Free News-Typing Widget
 * 
 * Features:
 * 1. Self-contained floating glassmorphic pill located at bottom-left.
 * 2. Authentic news-typing typewriter animation with blinking cursor.
 * 3. Rotates customer toll-free assistance with official Tamil Nadu helplines (1100 & 1913).
 * 4. 1-tap direct phone dialer (tel:18004251100), 1-click clipboard copy with toast.
 * 5. Minimize / Expand toggle for maximum screen comfort on mobile and desktop.
 * 6. Responsive and non-colliding with existing elements (e.g. chat widget on bottom-right).
 */

(function(window, document) {
  'use strict';

  if (document.getElementById('cc-tollfree-ticker-root')) {
    return; // Already initialized
  }

  // Primary Customer Toll-Free Number
  const PRIMARY_TOLL_FREE = window.CROWDCITY_TOLL_FREE || 
                            localStorage.getItem('crowdcity_toll_free') || 
                            '1800-425-1100';

  // News ticker messages list
  const TICKER_MESSAGES = [
    `Customer Toll-Free: ${PRIMARY_TOLL_FREE} (24/7 Citizen Support)`,
    `Tamil Nadu CM Helpline (Toll-Free): 1100`,
    `Municipal Corporation Helpline (Toll-Free): 1913`,
    `Universal Emergency Helpline (Toll-Free): 112`,
    `Instant Civic Redressal • Call Toll-Free: ${PRIMARY_TOLL_FREE}`
  ];

  // Self-injecting styles
  const CSS_STYLES = `
    /* Floating Customer Toll-Free Widget */
    #cc-tollfree-ticker-root {
      position: fixed;
      bottom: 24px;
      left: 24px;
      z-index: 9992;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      user-select: none;
      -webkit-user-select: none;
      transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease;
    }

    .cc-tf-pill {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 6px 12px 6px 8px;
      background: rgba(15, 23, 42, 0.94);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 9999px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(13, 148, 136, 0.25);
      color: #f8fafc;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      max-width: 480px;
      cursor: default;
    }

    .cc-tf-pill:hover {
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(13, 148, 136, 0.45);
      border-color: rgba(45, 212, 191, 0.35);
      transform: translateY(-2px);
    }

    /* Left Icon Pill with Live Indicator */
    .cc-tf-icon-wrap {
      position: relative;
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: linear-gradient(135deg, #0d9488 0%, #059669 100%);
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.95rem;
      flex-shrink: 0;
      box-shadow: 0 2px 10px rgba(13, 148, 136, 0.4);
      cursor: pointer;
      text-decoration: none;
    }

    .cc-tf-icon-wrap i {
      animation: cc-tf-ring 5s infinite;
    }

    @keyframes cc-tf-ring {
      0%, 85%, 100% { transform: rotate(0deg) scale(1); }
      88% { transform: rotate(14deg) scale(1.1); }
      91% { transform: rotate(-14deg) scale(1.1); }
      94% { transform: rotate(10deg) scale(1.1); }
      97% { transform: rotate(-10deg) scale(1.1); }
    }

    .cc-tf-live-dot {
      position: absolute;
      top: -2px;
      right: -2px;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #22c55e;
      border: 2px solid #0f172a;
      box-shadow: 0 0 8px #22c55e;
    }

    .cc-tf-live-dot::after {
      content: '';
      position: absolute;
      inset: -2px;
      border-radius: 50%;
      border: 1.5px solid #22c55e;
      animation: cc-tf-dot-pulse 2s infinite;
    }

    @keyframes cc-tf-dot-pulse {
      0% { transform: scale(0.8); opacity: 0.9; }
      100% { transform: scale(2.2); opacity: 0; }
    }

    /* Badge Tag */
    .cc-tf-badge {
      font-size: 0.65rem;
      font-weight: 800;
      letter-spacing: 0.5px;
      background: rgba(13, 148, 136, 0.22);
      color: #2dd4bf;
      padding: 2px 7px;
      border-radius: 4px;
      border: 1px solid rgba(45, 212, 191, 0.3);
      flex-shrink: 0;
      text-transform: uppercase;
      white-space: nowrap;
    }

    /* News Typing Text Container */
    .cc-tf-text-wrap {
      display: flex;
      align-items: center;
      overflow: hidden;
      white-space: nowrap;
      font-size: 0.82rem;
      font-weight: 600;
      color: #f1f5f9;
      min-width: 160px;
      max-width: 250px;
      line-height: 1.2;
    }

    .cc-tf-text-wrap a {
      color: inherit;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
    }

    .cc-tf-typing-text {
      display: inline;
      color: #f8fafc;
    }

    .cc-tf-cursor {
      display: inline-block;
      color: #38bdf8;
      font-weight: 300;
      margin-left: 2px;
      opacity: 1;
      animation: cc-tf-blink 0.8s infinite;
    }

    @keyframes cc-tf-blink {
      0%, 49% { opacity: 1; }
      50%, 100% { opacity: 0; }
    }

    /* Action Buttons */
    .cc-tf-actions {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
      margin-left: auto;
    }

    .cc-tf-btn-call {
      background: #10b981;
      color: #ffffff !important;
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 700;
      text-decoration: none !important;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      transition: background-color 0.15s ease, transform 0.15s ease;
      box-shadow: 0 2px 8px rgba(16, 185, 129, 0.35);
    }

    .cc-tf-btn-call:hover {
      background: #059669;
      transform: scale(1.04);
    }

    .cc-tf-btn-action {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.12);
      color: #cbd5e1;
      width: 26px;
      height: 26px;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      cursor: pointer;
      padding: 0;
      transition: all 0.15s ease;
    }

    .cc-tf-btn-action:hover {
      background: rgba(255, 255, 255, 0.18);
      color: #ffffff;
      transform: scale(1.08);
    }

    /* Minimized Compact Badge View */
    #cc-tollfree-ticker-root.minimized .cc-tf-pill {
      padding: 5px 12px 5px 6px;
      gap: 8px;
    }

    #cc-tollfree-ticker-root.minimized .cc-tf-badge,
    #cc-tollfree-ticker-root.minimized .cc-tf-text-wrap,
    #cc-tollfree-ticker-root.minimized .cc-tf-btn-call,
    #cc-tollfree-ticker-root.minimized .cc-tf-btn-copy {
      display: none;
    }

    .cc-tf-mini-label {
      display: none;
      font-size: 0.78rem;
      font-weight: 700;
      color: #2dd4bf;
      white-space: nowrap;
    }

    #cc-tollfree-ticker-root.minimized .cc-tf-mini-label {
      display: inline-block;
    }

    #cc-tollfree-ticker-root.minimized .cc-tf-btn-toggle i {
      transform: rotate(180deg);
    }

    /* Toast Notification for Number Copy */
    .cc-tf-toast {
      position: absolute;
      top: -38px;
      left: 50%;
      transform: translateX(-50%) translateY(6px);
      background: #0f172a;
      color: #38bdf8;
      font-size: 0.75rem;
      font-weight: 600;
      padding: 5px 12px;
      border-radius: 6px;
      border: 1px solid rgba(56, 189, 248, 0.35);
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
      white-space: nowrap;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.25s ease, transform 0.25s ease;
      z-index: 9993;
    }

    .cc-tf-toast.show {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }

    /* Responsive Design for Mobile Devices */
    @media (max-width: 768px) {
      #cc-tollfree-ticker-root {
        bottom: 16px;
        left: 14px;
        max-width: calc(100vw - 86px);
      }

      .cc-tf-pill {
        padding: 5px 10px 5px 6px;
        gap: 8px;
        max-width: 100%;
      }

      .cc-tf-badge {
        display: none; /* Hide badge tag on very small screens to fit text */
      }

      .cc-tf-text-wrap {
        font-size: 0.76rem;
        max-width: 170px;
        min-width: 120px;
      }

      .cc-tf-btn-call span {
        display: none; /* Icon-only on mobile */
      }

      .cc-tf-btn-call {
        padding: 4px 8px;
      }
    }
  `;

  // State
  let currentMsgIdx = 0;
  let currentCharIdx = 0;
  let isDeleting = false;
  let typingTimer = null;
  let isMinimized = localStorage.getItem('cc_tollfree_minimized') === 'true';

  /**
   * Inject CSS styles into DOM
   */
  function injectStyles() {
    if (document.getElementById('cc-tollfree-ticker-styles')) return;
    const styleEl = document.createElement('style');
    styleEl.id = 'cc-tollfree-ticker-styles';
    styleEl.innerHTML = CSS_STYLES;
    document.head.appendChild(styleEl);
  }

  /**
   * Create and mount the floating ticker DOM element
   */
  function createWidgetDOM() {
    if (document.getElementById('cc-tollfree-ticker-root')) return;

    const container = document.createElement('div');
    container.id = 'cc-tollfree-ticker-root';
    if (isMinimized) {
      container.classList.add('minimized');
    }

    container.innerHTML = `
      <!-- Copy feedback toast -->
      <div id="cc-tf-toast" class="cc-tf-toast">Copied Toll-Free Number!</div>

      <div class="cc-tf-pill" id="cc-tf-pill">
        <!-- Call Icon with Live Pulse -->
        <a href="tel:${PRIMARY_TOLL_FREE.replace(/[^0-9+]/g, '')}" class="cc-tf-icon-wrap" title="Direct Dial Toll-Free Support">
          <i class="fa-solid fa-phone-volume"></i>
          <span class="cc-tf-live-dot"></span>
        </a>

        <!-- Badge -->
        <span class="cc-tf-badge">Toll-Free</span>

        <!-- Minimized Label -->
        <a href="tel:${PRIMARY_TOLL_FREE.replace(/[^0-9+]/g, '')}" class="cc-tf-mini-label" title="Call Toll-Free: ${PRIMARY_TOLL_FREE}">
          ${PRIMARY_TOLL_FREE}
        </a>

        <!-- News Typing Animation Area -->
        <div class="cc-tf-text-wrap">
          <a href="tel:${PRIMARY_TOLL_FREE.replace(/[^0-9+]/g, '')}" title="Click to Call 24/7 Helpline">
            <span id="cc-tf-text" class="cc-tf-typing-text"></span><span class="cc-tf-cursor">|</span>
          </a>
        </div>

        <!-- Action Controls -->
        <div class="cc-tf-actions">
          <!-- 1-Tap Call Button -->
          <a href="tel:${PRIMARY_TOLL_FREE.replace(/[^0-9+]/g, '')}" class="cc-tf-btn-call" title="Call Toll-Free Support">
            <i class="fa-solid fa-phone"></i> <span>Call</span>
          </a>

          <!-- Copy Button -->
          <button type="button" class="cc-tf-btn-action cc-tf-btn-copy" id="cc-tf-copy-btn" title="Copy Number">
            <i class="fa-regular fa-copy"></i>
          </button>

          <!-- Minimize / Expand Toggle -->
          <button type="button" class="cc-tf-btn-action cc-tf-btn-toggle" id="cc-tf-toggle-btn" title="Minimize / Expand">
            <i class="fa-solid fa-minus"></i>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(container);
    bindEvents();
    startTypewriter();
  }

  /**
   * Bind interactive events (Call, Copy, Minimize)
   */
  function bindEvents() {
    const copyBtn = document.getElementById('cc-tf-copy-btn');
    const toggleBtn = document.getElementById('cc-tf-toggle-btn');
    const toast = document.getElementById('cc-tf-toast');

    if (copyBtn) {
      copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const numToCopy = PRIMARY_TOLL_FREE;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(numToCopy).then(showToast).catch(() => fallbackCopy(numToCopy));
        } else {
          fallbackCopy(numToCopy);
        }
      });
    }

    function fallbackCopy(text) {
      try {
        const temp = document.createElement('input');
        temp.value = text;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand('copy');
        document.body.removeChild(temp);
        showToast();
      } catch (err) {
        console.warn('Copy failed:', err);
      }
    }

    function showToast() {
      if (!toast) return;
      toast.textContent = `Copied ${PRIMARY_TOLL_FREE}!`;
      toast.classList.add('show');
      setTimeout(() => {
        toast.classList.remove('show');
      }, 2200);
    }

    if (toggleBtn) {
      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleMinimize();
      });
    }

    const pill = document.getElementById('cc-tf-pill');
    if (pill) {
      pill.addEventListener('click', (e) => {
        // If clicking while minimized, expand it back
        const root = document.getElementById('cc-tollfree-ticker-root');
        if (root && root.classList.contains('minimized') && !e.target.closest('a')) {
          toggleMinimize();
        }
      });
    }
  }

  /**
   * Toggle minimized state
   */
  function toggleMinimize() {
    const root = document.getElementById('cc-tollfree-ticker-root');
    if (!root) return;
    isMinimized = !isMinimized;
    if (isMinimized) {
      root.classList.add('minimized');
    } else {
      root.classList.remove('minimized');
    }
    localStorage.setItem('cc_tollfree_minimized', isMinimized ? 'true' : 'false');
  }

  /**
   * Typewriter news animation engine
   */
  function startTypewriter() {
    const textEl = document.getElementById('cc-tf-text');
    if (!textEl || TICKER_MESSAGES.length === 0) return;

    const currentMsg = TICKER_MESSAGES[currentMsgIdx % TICKER_MESSAGES.length];
    
    // Grapheme safe splitting for Unicode / Tamil characters
    let chars;
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
      chars = Array.from(segmenter.segment(currentMsg), s => s.segment);
    } else {
      chars = Array.from(currentMsg);
    }

    if (!isDeleting) {
      // Forward typing
      currentCharIdx++;
      textEl.textContent = chars.slice(0, currentCharIdx).join('');

      if (currentCharIdx >= chars.length) {
        // Full message typed: hold for reading (4.2 seconds)
        isDeleting = true;
        typingTimer = setTimeout(startTypewriter, 4200);
        return;
      }

      // Realistic typing speed with subtle variance
      const variance = Math.floor(Math.random() * 16);
      typingTimer = setTimeout(startTypewriter, 34 + variance);
    } else {
      // Backward erasing
      currentCharIdx -= 2;
      if (currentCharIdx < 0) currentCharIdx = 0;
      textEl.textContent = chars.slice(0, currentCharIdx).join('');

      if (currentCharIdx <= 0) {
        // Finished erasing: advance to next message
        isDeleting = false;
        currentMsgIdx = (currentMsgIdx + 1) % TICKER_MESSAGES.length;
        typingTimer = setTimeout(startTypewriter, 350);
        return;
      }

      // Fast backspace speed
      typingTimer = setTimeout(startTypewriter, 15);
    }
  }

  /**
   * Public API
   */
  window.CrowdCityTollFree = {
    getNumber: () => PRIMARY_TOLL_FREE,
    setNumber: (newNumber) => {
      if (newNumber) {
        localStorage.setItem('crowdcity_toll_free', newNumber);
        location.reload();
      }
    },
    toggle: toggleMinimize,
    show: () => {
      const el = document.getElementById('cc-tollfree-ticker-root');
      if (el) el.style.display = 'block';
    },
    hide: () => {
      const el = document.getElementById('cc-tollfree-ticker-root');
      if (el) el.style.display = 'none';
    }
  };

  /**
   * Initialization
   */
  function init() {
    injectStyles();
    createWidgetDOM();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})(window, document);
