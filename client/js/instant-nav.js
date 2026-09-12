/**
 * instant-nav.js
 * CrowdCity AI — Speculative Link Prefetcher for Instant Page Transitions
 * 
 * Automatically prefetches internal HTML pages on link hover / touchstart.
 * Results in near-instant (0ms–25ms) perceived page navigation.
 */
(function() {
  'use strict';

  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const prefetched = new Set();
  const currentOrigin = window.location.origin;

  function canPrefetch(url) {
    if (!url) return false;
    try {
      const parsed = new URL(url, window.location.href);
      if (parsed.origin !== currentOrigin) return false;
      if (parsed.pathname === window.location.pathname) return false;
      if (parsed.searchParams.has('logout') || parsed.pathname.includes('logout')) return false;
      if (prefetched.has(parsed.href)) return false;
      return true;
    } catch (e) {
      return false;
    }
  }

  function prefetch(url) {
    if (!canPrefetch(url)) return;
    try {
      const parsed = new URL(url, window.location.href);
      prefetched.add(parsed.href);

      // Prefer rel=prefetch, fallback to low-priority fetch
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = parsed.href;
      link.as = 'document';
      document.head.appendChild(link);
    } catch (e) {}
  }

  let hoverTimer = null;

  function onPointerOver(e) {
    const anchor = e.target.closest('a[href]');
    if (!anchor) return;
    const href = anchor.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('tel:') || href.startsWith('mailto:')) return;

    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => {
      prefetch(anchor.href);
    }, 65);
  }

  function onPointerOut() {
    clearTimeout(hoverTimer);
  }

  function onTouchStart(e) {
    const anchor = e.target.closest('a[href]');
    if (!anchor) return;
    const href = anchor.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('tel:') || href.startsWith('mailto:')) return;
    prefetch(anchor.href);
  }

  // Delegated event listeners for instant discovery
  document.addEventListener('mouseover', onPointerOver, { passive: true });
  document.addEventListener('mouseout', onPointerOut, { passive: true });
  document.addEventListener('touchstart', onTouchStart, { passive: true });

})();
