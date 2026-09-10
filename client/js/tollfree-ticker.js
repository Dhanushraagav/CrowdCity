/**
 * CrowdCity AI - Customer Toll-Free Header Widget & Mobile Quick Action Engine
 * 
 * Features:
 * 1. Placed near "TN Updates" in the top navigation header in crisp White Theme.
 * 2. Authentic news-typing typewriter animation cycling through official toll-free lines.
 * 3. 1-tap call (tel:18004251100) & 1-click clipboard copy with feedback toast.
 * 4. Placed as the 1st item in Quick Actions on mobile view.
 * 5. Completely removes old bottom-left dark floating bubble.
 */

(function(window, document) {
  'use strict';

  // Primary Customer Toll-Free Number
  const PRIMARY_TOLL_FREE = window.CROWDCITY_TOLL_FREE || 
                            localStorage.getItem('crowdcity_toll_free') || 
                            '1800-425-1100';

  // Header News Ticker Messages (compact, crisp, highly legible)
  const TICKER_MESSAGES = [
    `${PRIMARY_TOLL_FREE} (24/7 Support)`,
    `CM Helpline: 1100 (Toll-Free)`,
    `Municipal: 1913 (Toll-Free)`,
    `Emergency: 112 (Toll-Free)`,
    `Toll-Free: ${PRIMARY_TOLL_FREE}`
  ];

  // Remove any legacy bottom-left floating dark container
  function removeLegacyFloatingWidget() {
    const legacy = document.getElementById('cc-tollfree-ticker-root');
    if (legacy) legacy.remove();
  }

  // Animation State
  let currentMsgIdx = 0;
  let currentCharIdx = 0;
  let isDeleting = false;
  let typingTimer = null;

  /**
   * Typewriter news animation engine for header widget
   */
  function runTypewriter() {
    const textEl = document.getElementById('header-tf-text');
    if (!textEl || TICKER_MESSAGES.length === 0) return;

    const currentMsg = TICKER_MESSAGES[currentMsgIdx % TICKER_MESSAGES.length];
    
    // Grapheme-safe splitting for Tamil and Unicode characters
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
        // Hold for reading
        isDeleting = true;
        typingTimer = setTimeout(runTypewriter, 3800);
        return;
      }

      const variance = Math.floor(Math.random() * 16);
      typingTimer = setTimeout(runTypewriter, 36 + variance);
    } else {
      // Backward erasing
      currentCharIdx -= 2;
      if (currentCharIdx < 0) currentCharIdx = 0;
      textEl.textContent = chars.slice(0, currentCharIdx).join('');

      if (currentCharIdx <= 0) {
        // Transition to next message
        isDeleting = false;
        currentMsgIdx = (currentMsgIdx + 1) % TICKER_MESSAGES.length;
        typingTimer = setTimeout(runTypewriter, 300);
        return;
      }

      typingTimer = setTimeout(runTypewriter, 18);
    }
  }

  /**
   * Start / restart news-typing animation
   */
  function startHeaderAnimation() {
    if (typingTimer) {
      clearTimeout(typingTimer);
      typingTimer = null;
    }
    currentCharIdx = 0;
    isDeleting = false;
    runTypewriter();
  }

  /**
   * Show mini copy toast
   */
  function showCopyToast(x, y) {
    let toast = document.getElementById('cc-header-tf-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'cc-header-tf-toast';
      toast.style.cssText = `
        position: fixed;
        background: #0f172a;
        color: #ffffff;
        font-family: 'Inter', system-ui, sans-serif;
        font-size: 0.75rem;
        font-weight: 700;
        padding: 5px 12px;
        border-radius: 6px;
        box-shadow: 0 6px 18px rgba(0,0,0,0.3);
        z-index: 100000;
        pointer-events: none;
        opacity: 0;
        transform: translateY(-4px);
        transition: opacity 0.2s ease, transform 0.2s ease;
      `;
      document.body.appendChild(toast);
    }

    toast.textContent = `Copied ${PRIMARY_TOLL_FREE}!`;
    if (x && y) {
      toast.style.left = `${Math.max(10, x - 50)}px`;
      toast.style.top = `${y + 12}px`;
    } else {
      toast.style.top = '60px';
      toast.style.right = '240px';
    }

    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-4px)';
    }, 2000);
  }

  /**
   * Copy Toll-Free Number with feedback
   */
  function copyNumber(e) {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    const rect = e && e.target ? e.target.getBoundingClientRect() : null;
    const x = rect ? rect.left : 0;
    const y = rect ? rect.bottom : 0;

    const numToCopy = PRIMARY_TOLL_FREE;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(numToCopy)
        .then(() => showCopyToast(x, y))
        .catch(() => fallbackCopy(numToCopy, x, y));
    } else {
      fallbackCopy(numToCopy, x, y);
    }
  }

  function fallbackCopy(text, x, y) {
    try {
      const temp = document.createElement('input');
      temp.value = text;
      document.body.appendChild(temp);
      temp.select();
      document.execCommand('copy');
      document.body.removeChild(temp);
      showCopyToast(x, y);
    } catch (err) {
      console.warn('Copy failed:', err);
    }
  }

  /**
   * Ensure Header Widget is attached if auth.js ran before or without it
   */
  function ensureHeaderWidget() {
    removeLegacyFloatingWidget();

    // Check if already present
    if (document.getElementById('header-tollfree-widget')) {
      startHeaderAnimation();
      return;
    }

    // Try finding .header-tn-updates-btn or .auth-nav-wrapper
    const tnBtn = document.querySelector('.header-tn-updates-btn');
    const authWrapper = document.querySelector('.auth-nav-wrapper');

    if (tnBtn || authWrapper) {
      const widget = document.createElement('div');
      widget.className = 'header-tollfree-pill';
      widget.id = 'header-tollfree-widget';
      widget.title = `24/7 Citizen Toll-Free Helpline: ${PRIMARY_TOLL_FREE}`;
      widget.innerHTML = `
        <a href="tel:${PRIMARY_TOLL_FREE.replace(/[^0-9+]/g, '')}" class="header-tf-link">
          <span class="header-tf-icon-wrap">
            <i class="fa-solid fa-phone-volume"></i>
            <span class="header-tf-live-dot"></span>
          </span>
          <span class="header-tf-badge">Toll-Free</span>
          <span class="header-tf-text-wrap">
            <span id="header-tf-text" class="header-tf-news-text">${PRIMARY_TOLL_FREE}</span>
            <span class="header-tf-cursor">|</span>
          </span>
        </a>
        <button type="button" class="header-tf-copy-btn" title="Copy Toll-Free Number">
          <i class="fa-regular fa-copy"></i>
        </button>
      `;

      const copyBtn = widget.querySelector('.header-tf-copy-btn');
      if (copyBtn) {
        copyBtn.addEventListener('click', copyNumber);
      }

      if (tnBtn && tnBtn.parentNode) {
        tnBtn.parentNode.insertBefore(widget, tnBtn);
      } else if (authWrapper) {
        authWrapper.insertBefore(widget, authWrapper.firstChild);
      }

      startHeaderAnimation();
    }
  }

  /**
   * Public API
   */
  window.CrowdCityTollFree = {
    getNumber: () => PRIMARY_TOLL_FREE,
    copyNumber: copyNumber,
    startHeaderAnimation: startHeaderAnimation,
    ensureHeaderWidget: ensureHeaderWidget
  };

  /**
   * Initialize on DOM Ready
   */
  function init() {
    removeLegacyFloatingWidget();
    ensureHeaderWidget();
    // In case auth.js updates the header asynchronously, re-check
    setTimeout(ensureHeaderWidget, 400);
    setTimeout(ensureHeaderWidget, 1200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})(window, document);
