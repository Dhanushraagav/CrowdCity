/**
 * CrowdCity - Global Premium Civic Data Loading System Test Suite
 * Validates:
 * 1. Global API exports (CrowdCityLoading, Loading)
 * 2. Reference counting for concurrent async requests
 * 3. Accessibility (role, aria-busy, aria-live)
 * 4. SVG emblem integrity (orbital ring, satellite nodes, hex beacon shield)
 * 5. Button loading state preservation and restoration
 * 6. Cache-aware background sync indicators
 * 7. Promise wrap lifecycle with clean finally() guarantees
 * 8. CSS styling, true AMOLED black dark theme, reduced motion
 * 9. Zero fake delays / zero artificial setTimeout loading
 * 10. Zero emojis
 */

import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple DOM Mock for Node testing of loading-system.js
class MockClassList {
  constructor(el) {
    this.el = el;
    this.classes = new Set();
  }
  add(...names) { names.forEach(n => this.classes.add(n)); }
  remove(...names) { names.forEach(n => this.classes.delete(n)); }
  contains(name) { return this.classes.has(name); }
  toggle(name, force) {
    if (force !== undefined) {
      if (force) this.classes.add(name);
      else this.classes.delete(name);
      return force;
    }
    if (this.classes.has(name)) {
      this.classes.delete(name);
      return false;
    }
    this.classes.add(name);
    return true;
  }
}

class MockElement {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.attributes = new Map();
    this.classList = new MockClassList(this);
    this.style = {};
    this._innerHTML = '';
    this.textContent = '';
    this.disabled = false;
  }

  get innerHTML() {
    return this._innerHTML || '';
  }

  set innerHTML(val) {
    this._innerHTML = String(val || '');
    if (this._innerHTML === '') {
      this.children = [];
    }
  }

  get className() {
    return Array.from(this.classList.classes).join(' ');
  }

  set className(val) {
    this.classList.classes.clear();
    String(val || '').split(/\s+/).filter(Boolean).forEach(c => this.classList.add(c));
  }

  get firstChild() {
    return this.children[0] || null;
  }

  setAttribute(k, v) { this.attributes.set(k, String(v)); }
  getAttribute(k) { return this.attributes.get(k) || null; }
  hasAttribute(k) { return this.attributes.has(k); }
  removeAttribute(k) { this.attributes.delete(k); }

  appendChild(child) {
    this.children.push(child);
    child.parentElement = this;
    return child;
  }

  insertBefore(newChild, refChild) {
    const idx = this.children.indexOf(refChild);
    if (idx === -1) {
      this.children.unshift(newChild);
    } else {
      this.children.splice(idx, 0, newChild);
    }
    newChild.parentElement = this;
    return newChild;
  }

  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) {
      this.children.splice(idx, 1);
      child.parentElement = null;
    }
    return child;
  }

  remove() {
    if (this.parentElement) {
      this.parentElement.removeChild(this);
    }
  }

  querySelector(selector) {
    return this._findMatching(selector);
  }

  querySelectorAll(selector) {
    const results = [];
    this._findAllMatching(selector, results);
    return results;
  }

  _findMatching(selector) {
    for (const child of this.children) {
      if (this._matches(child, selector)) return child;
      const found = child._findMatching(selector);
      if (found) return found;
    }
    return null;
  }

  _findAllMatching(selector, results) {
    for (const child of this.children) {
      if (this._matches(child, selector)) results.push(child);
      child._findAllMatching(selector, results);
    }
  }

  _matches(el, selector) {
    const parts = selector.split(',').map(p => p.trim().replace(':scope > ', ''));
    return parts.some(s => {
      if (s.startsWith('.')) {
        const cls = s.substring(1).split('.')[0];
        return el.classList.contains(cls);
      }
      if (s.startsWith('[')) {
        const attr = s.replace(/[[\]]/g, '').split('=')[0];
        return el.hasAttribute(attr);
      }
      return el.tagName.toLowerCase() === s.toLowerCase();
    });
  }
}

// Global Environment Setup for testing client script
global.window = global;
global.HTMLElement = MockElement;
global.document = {
  createElement: (tag) => new MockElement(tag),
  getElementById: (id) => null,
  querySelector: (sel) => null,
  querySelectorAll: (sel) => []
};

// Load loading-system.js in memory
const loadingJsPath = path.resolve(__dirname, '../../client/js/loading-system.js');
const loadingJsContent = fs.readFileSync(loadingJsPath, 'utf8');
eval(loadingJsContent);

console.log('--- CrowdCity Loading System Test Suite ---');
let totalTests = 0;
let passedTests = 0;

function it(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] ${name}`);
    console.error(`         ${err.message}`);
  }
}

async function itAsync(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] ${name}`);
    console.error(`         ${err.message}`);
  }
}

// 1. API Exports
it('Exports CrowdCityLoading and Loading globals with full API', () => {
  assert.ok(window.CrowdCityLoading, 'window.CrowdCityLoading must exist');
  assert.strictEqual(window.CrowdCityLoading, window.Loading, 'window.Loading must be alias to CrowdCityLoading');
  assert.strictEqual(typeof window.CrowdCityLoading.show, 'function');
  assert.strictEqual(typeof window.CrowdCityLoading.hide, 'function');
  assert.strictEqual(typeof window.CrowdCityLoading.wrap, 'function');
  assert.strictEqual(typeof window.CrowdCityLoading.setButtonLoading, 'function');
  assert.strictEqual(typeof window.CrowdCityLoading.showBackgroundSync, 'function');
  assert.strictEqual(typeof window.CrowdCityLoading.hideBackgroundSync, 'function');
  assert.strictEqual(typeof window.CrowdCityLoading.getSvgMark, 'function');
  assert.strictEqual(typeof window.CrowdCityLoading.renderHTML, 'function');
});

// 2. DOM Structure and Accessibility
it('Mounts accessible loader with proper role and aria attributes', () => {
  const container = new MockElement('div');
  const loader = window.CrowdCityLoading.show(container, {
    message: 'Testing loader retrieval...',
    subtitle: 'Checking civic telemetry',
    size: 'lg'
  });

  assert.ok(loader, 'show() should return the loader element');
  assert.strictEqual(loader.getAttribute('role'), 'status', 'Must have role="status"');
  assert.strictEqual(loader.getAttribute('aria-busy'), 'true', 'Must have aria-busy="true"');
  assert.strictEqual(loader.getAttribute('aria-live'), 'polite', 'Must have aria-live="polite"');
  assert.strictEqual(container.getAttribute('aria-busy'), 'true', 'Target must have aria-busy="true"');

  // Verify SVG mark inside
  const svg = window.CrowdCityLoading.getSvgMark('lg');
  assert.ok(svg.includes('<svg class="cc-loader-svg"'), 'Emblem must include cc-loader-svg');
  assert.ok(svg.includes('cc-loader-orbit-fast'), 'Emblem must include orbital rings');
  assert.ok(svg.includes('cc-loader-satellites'), 'Emblem must include satellite cardinal nodes');
  assert.ok(svg.includes('cc-loader-shield'), 'Emblem must include center hex shield');
  assert.ok(svg.includes('cc-loader-beacon'), 'Emblem must include core beacon');
});

// 3. Reference Counting for Concurrent Async Operations
await itAsync('Handles concurrent requests with reference counting', async () => {
  const target = new MockElement('div');
  
  // First request starts
  window.CrowdCityLoading.show(target, { message: 'Request 1' });
  assert.strictEqual(target.children.length, 1, 'Target should have 1 loader element');

  // Second concurrent request starts
  window.CrowdCityLoading.show(target, { message: 'Request 2' });
  assert.strictEqual(target.children.length, 1, 'Target should still have 1 loader element (no duplication)');

  // Request 1 finishes
  window.CrowdCityLoading.hide(target);
  assert.strictEqual(target.children.length, 1, 'Target must retain loader while Request 2 is still active');

  // Request 2 finishes
  window.CrowdCityLoading.hide(target);
  await new Promise(r => setTimeout(r, 200));
  assert.strictEqual(target.children.length, 0, 'Target should remove loader when all concurrent requests finish');
});

// 4. Force Hide
it('forceHide() immediately cleans up even with pending counter', () => {
  const target = new MockElement('div');
  window.CrowdCityLoading.show(target);
  window.CrowdCityLoading.show(target);
  window.CrowdCityLoading.show(target);
  
  window.CrowdCityLoading.forceHide(target);
  assert.strictEqual(target.children.length, 0, 'forceHide must immediately remove loader');
});

// 5. Button State Management
it('Safely disables and restores button during action loading', () => {
  const btn = new MockElement('button');
  btn.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> <span>Refresh Data</span>';

  // Enter button loading state
  window.CrowdCityLoading.setButtonLoading(btn, true, 'Syncing...');
  assert.strictEqual(btn.disabled, true, 'Button should be disabled during loading');
  assert.strictEqual(btn.getAttribute('aria-busy'), 'true', 'Button aria-busy should be true');
  assert.ok(btn.classList.contains('cc-btn-loading'), 'Button must receive cc-btn-loading class');
  assert.ok(btn.innerHTML.includes('Syncing...'), 'Button should display loading text');

  // Restore button
  window.CrowdCityLoading.setButtonLoading(btn, false);
  assert.strictEqual(btn.disabled, false, 'Button should be re-enabled');
  assert.strictEqual(btn.getAttribute('aria-busy'), null, 'Button aria-busy should be removed');
  assert.ok(!btn.classList.contains('cc-btn-loading'), 'cc-btn-loading class must be removed');
  assert.strictEqual(btn.innerHTML, '<i class="fa-solid fa-arrows-rotate"></i> <span>Refresh Data</span>', 'Original HTML must be restored exactly');
});

// 6. Promise Wrap Lifecycle with finally()
await itAsync('wrap() properly manages loader lifecycle across successful and failed promises', async () => {
  const target = new MockElement('div');

  // Successful promise
  await window.CrowdCityLoading.wrap(target, async () => {
    assert.strictEqual(target.children.length, 1, 'Loader must be mounted during promise execution');
    return 42;
  });
  await new Promise(r => setTimeout(r, 200));
  assert.strictEqual(target.children.length, 0, 'Loader must be unmounted after promise resolves');

  // Rejected promise
  let thrown = false;
  try {
    await window.CrowdCityLoading.wrap(target, async () => {
      assert.strictEqual(target.children.length, 1, 'Loader must be mounted during promise execution');
      throw new Error('Network error simulation');
    });
  } catch (e) {
    thrown = true;
  }
  assert.ok(thrown, 'Exception must be propagated to caller');
  await new Promise(r => setTimeout(r, 200));
  assert.strictEqual(target.children.length, 0, 'Loader must be cleaned up in finally even on promise rejection');
});

// 7. Background Sync Indicator
await itAsync('Creates and removes cache-aware background sync indicator', async () => {
  const target = new MockElement('div');
  window.CrowdCityLoading.showBackgroundSync(target, 'Refreshing in background...');
  assert.strictEqual(target.children.length, 1, 'Sync bar should be mounted');
  assert.ok(target.children[0].classList.contains('cc-sync-indicator-bar'), 'Must have cc-sync-indicator-bar class');

  window.CrowdCityLoading.hideBackgroundSync(target);
  await new Promise(r => setTimeout(r, 220));
  assert.strictEqual(target.children.length, 0, 'Sync bar should be removed after fadeout');
});

// 8. renderHTML Helper
it('renderHTML produces clean accessible HTML without requiring DOM mount', () => {
  const html = window.CrowdCityLoading.renderHTML({
    message: 'Loading telemetry...',
    subtitle: 'State Grid',
    size: 'sm'
  });
  assert.ok(html.includes('cc-loading-container cc-loading-sm'), 'HTML contains proper classes');
  assert.ok(html.includes('Loading telemetry...'), 'HTML contains message');
  assert.ok(html.includes('State Grid'), 'HTML contains subtitle');
  assert.ok(html.includes('role="status"'), 'HTML contains accessibility role');
});

// 9. CSS Verification: True AMOLED Black & GPU-Accelerated Keyframes
it('loading-system.css conforms to True AMOLED dark theme and 60fps GPU acceleration', () => {
  const cssPath = path.resolve(__dirname, '../../client/css/loading-system.css');
  assert.ok(fs.existsSync(cssPath), 'client/css/loading-system.css must exist');
  const css = fs.readFileSync(cssPath, 'utf8');

  // Dark Theme surfaces
  assert.ok(css.includes('#000000') || css.includes('#050505'), 'Must contain true black / near black surfaces for dark theme');
  assert.ok(!css.includes('#0f172a'), 'Must not contain blue/navy #0f172a');
  assert.ok(!css.includes('#1e293b'), 'Must not contain blue/navy #1e293b');

  // Keyframes
  assert.ok(css.includes('@keyframes ccOrbitRotate'), 'Must define ccOrbitRotate keyframe');
  assert.ok(css.includes('@keyframes ccOrbitReverse'), 'Must define ccOrbitReverse keyframe');
  assert.ok(css.includes('@keyframes ccBeaconPulse'), 'Must define ccBeaconPulse keyframe');
  assert.ok(css.includes('@keyframes ccGlowPulse'), 'Must define ccGlowPulse keyframe');

  // Reduced motion
  assert.ok(css.includes('@media (prefers-reduced-motion: reduce)'), 'Must support prefers-reduced-motion');

  // Verify components.css imports loading-system.css
  const compCssPath = path.resolve(__dirname, '../../client/css/components.css');
  const compCss = fs.readFileSync(compCssPath, 'utf8');
  assert.ok(compCss.includes('@import "loading-system.css";') || compCss.includes('@import "./loading-system.css";'), 'components.css must import loading-system.css');
});

// 10. Audit for Fake Delays and Emojis
it('Contains NO fake loading delays (setTimeout) or emojis in loading-system files', () => {
  const filesToScan = [
    '../../client/js/loading-system.js',
    '../../client/css/loading-system.css'
  ];

  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

  for (const file of filesToScan) {
    const fullPath = path.resolve(__dirname, file);
    const content = fs.readFileSync(fullPath, 'utf8');
    assert.strictEqual(emojiRegex.test(content), false, `${file} must not contain any emojis`);

    // Check for artificial setTimeout loading delays
    if (file.endsWith('.js')) {
      assert.ok(!content.includes('setTimeout(resolve'), `${file} must not use setTimeout to simulate artificial loading delays`);
    }
  }
});

// Summary
console.log(`\nResults: ${passedTests} / ${totalTests} tests passed.`);
if (passedTests !== totalTests) {
  process.exit(1);
}
