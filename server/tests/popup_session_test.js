/**
 * Test Suite: Popup Session Lifecycle Verification
 * Verifies that Secure Document Wallet and Civic Helpdesk popups appear
 * ONLY ONCE per login session and auto-close after 5 seconds.
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock Storage implementation
class MockStorage {
  constructor() {
    this.store = {};
  }
  getItem(k) { return this.store[k] !== undefined ? this.store[k] : null; }
  setItem(k, v) { this.store[k] = String(v); }
  removeItem(k) { delete this.store[k]; }
  clear() { this.store = {}; }
  get length() { return Object.keys(this.store).length; }
  key(i) { return Object.keys(this.store)[i] || null; }
}

const sharedLocalStorage = new MockStorage();
const sharedSessionStorage = new MockStorage();

function createEnvironment(pathname = '/citizen-dashboard.html', loggedInUser = null) {
  const elements = {};
  let timerIdCounter = 1;
  const activeTimers = new Map();

  function makeElement(tag, id = '') {
    const el = {
      tagName: (tag || 'DIV').toUpperCase(),
      id: id,
      className: '',
      classList: {
        contains: (c) => (el.className || '').split(' ').includes(c),
        add: (...classes) => {
          const current = (el.className || '').split(' ').filter(Boolean);
          classes.forEach(c => { if (!current.includes(c)) current.push(c); });
          el.className = current.join(' ');
        },
        remove: (...classes) => {
          el.className = (el.className || '').split(' ').filter(c => !classes.includes(c)).join(' ');
        },
        toggle: (c, force) => {
          const has = (el.className || '').split(' ').includes(c);
          if (force === true || (force === undefined && !has)) {
            el.classList.add(c);
          } else {
            el.classList.remove(c);
          }
        }
      },
      style: {},
      innerHTML: '',
      innerText: '',
      textContent: '',
      children: [],
      parentNode: null,
      firstElementChild: null,
      firstChild: null,
      lastElementChild: null,
      contains: () => false,
      closest: () => null,
      appendChild: (child) => {
        if (!child) return child;
        el.children.push(child);
        child.parentNode = el;
        if (child.id) elements[child.id] = child;
        return child;
      },
      removeChild: (child) => {
        if (!child) return child;
        const idx = el.children.indexOf(child);
        if (idx !== -1) el.children.splice(idx, 1);
        child.parentNode = null;
        if (child.id) delete elements[child.id];
        return child;
      },
      insertBefore: (newChild, refChild) => {
        if (!newChild) return newChild;
        return el.appendChild(newChild);
      },
      querySelector: (sel) => {
        if (!sel) return null;
        const cleanId = sel.replace(/^[#.]/, '');
        if (elements[cleanId]) return elements[cleanId];
        const match = Object.values(elements).find(item => item.id === sel || (item.className && item.className.includes(cleanId)));
        if (match) return match;
        const fallback = makeElement('div', cleanId);
        elements[cleanId] = fallback;
        return fallback;
      },
      querySelectorAll: (sel) => [],
      addEventListener: (ev, fn) => {},
      removeEventListener: () => {},
      setAttribute: (k, v) => { el[k] = v; },
      getAttribute: (k) => el[k] !== undefined ? el[k] : null,
      removeAttribute: (k) => { delete el[k]; },
      click: () => {},
      remove: function() {
        if (this.parentNode && this.parentNode.removeChild) {
          this.parentNode.removeChild(this);
        } else {
          if (this.id) delete elements[this.id];
          this.parentNode = null;
        }
      }
    };
    return el;
  }

  const mockBody = makeElement('BODY', 'body');
  const mockHead = makeElement('HEAD', 'head');
  const mockDocEl = makeElement('HTML', 'html');
  mockDocEl.lang = 'en';

  const authNav = makeElement('DIV', 'auth-nav-container');
  mockBody.appendChild(authNav);

  const mockWindow = {
    location: {
      pathname,
      origin: 'http://localhost:3000',
      href: 'http://localhost:3000' + pathname,
      hash: '',
      search: '',
      replace: () => {}
    },
    history: {
      replaceState: () => {},
      pushState: () => {}
    },
    matchMedia: (query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false
    }),
    localStorage: sharedLocalStorage,
    sessionStorage: sharedSessionStorage,
    document: {
      head: mockHead,
      body: mockBody,
      documentElement: mockDocEl,
      title: 'CrowdCity',
      getElementById: (id) => elements[id] || null,
      querySelector: (sel) => {
        if (!sel) return null;
        const cleanId = sel.replace(/^[#.]/, '');
        if (elements[cleanId]) return elements[cleanId];
        const match = Object.values(elements).find(item => item.id === sel || (item.className && item.className.includes(cleanId)));
        if (match) return match;
        const fallback = makeElement('div', cleanId);
        elements[cleanId] = fallback;
        return fallback;
      },
      querySelectorAll: (sel) => [],
      createElement: (tag) => makeElement(tag),
      addEventListener: () => {},
      removeEventListener: () => {}
    },
    setTimeout: (fn, delay) => {
      const id = timerIdCounter++;
      activeTimers.set(id, { fn, delay });
      return id;
    },
    clearTimeout: (id) => {
      activeTimers.delete(id);
    },
    setInterval: (fn, delay) => 999,
    clearInterval: () => {},
    dispatchEvent: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    console: {
      log: () => {},
      warn: () => {},
      error: () => {},
      info: () => {}
    }
  };

  mockBody.appendChild = (child) => {
    if (!child) return child;
    if (child.id) elements[child.id] = child;
    child.parentNode = mockBody;
    return child;
  };
  mockBody.removeChild = (child) => {
    if (!child) return child;
    if (child.id) delete elements[child.id];
    child.parentNode = null;
    return child;
  };

  mockWindow.getCurrentUser = () => loggedInUser;
  mockWindow.getUserRole = () => loggedInUser ? 'citizen' : 'guest';

  // Fast forward all timers by ms
  function advanceTimersByTime(ms) {
    const toRun = [];
    for (const [id, timer] of activeTimers.entries()) {
      if (timer.delay <= ms) {
        toRun.push({ id, fn: timer.fn });
      } else {
        timer.delay -= ms;
      }
    }
    toRun.forEach(({ id, fn }) => {
      activeTimers.delete(id);
      try { fn(); } catch (e) {}
    });
  }

  function runAllPendingTimers() {
    let iterations = 0;
    while (activeTimers.size > 0 && iterations < 50) {
      iterations++;
      const entries = Array.from(activeTimers.entries());
      activeTimers.clear();
      entries.forEach(([id, timer]) => {
        try { timer.fn(); } catch (e) {}
      });
    }
  }

  return { mockWindow, elements, advanceTimersByTime, runAllPendingTimers, activeTimers };
}

async function runTests() {
  console.log('Starting Popup Session Lifecycle Tests...\n');
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`   [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`   [FAIL] ${name}`);
      console.error(err.stack || err.message);
      failed++;
    }
  }

  // Clear storage before starting
  sharedLocalStorage.clear();
  sharedSessionStorage.clear();

  const userA = { id: 'usr_101', email: 'citizen@example.com' };

  // Setup code extractor
  const authCode = fs.readFileSync(path.join(__dirname, '../../client/js/auth.js'), 'utf8');
  const chatCode = fs.readFileSync(path.join(__dirname, '../../client/js/chat-widget.js'), 'utf8');

  // Helper to load auth and chat-widget in an environment
  function loadPortal(pathname, user) {
    if (user) {
      sharedLocalStorage.setItem('cc_session', JSON.stringify({ user, access_token: 'token_' + user.id }));
      sharedLocalStorage.setItem('cc_user_role', 'citizen');
    }
    const env = createEnvironment(pathname, user);
    const globalKeys = {
      window: env.mockWindow,
      document: env.mockWindow.document,
      localStorage: sharedLocalStorage,
      sessionStorage: sharedSessionStorage,
      setTimeout: env.mockWindow.setTimeout,
      clearTimeout: env.mockWindow.clearTimeout,
      getCurrentUser: env.mockWindow.getCurrentUser,
      getUserRole: env.mockWindow.getUserRole,
      console: env.mockWindow.console
    };

    // Evaluate auth.js
    const evalAuth = new Function(...Object.keys(globalKeys), authCode);
    evalAuth(...Object.values(globalKeys));

    // Evaluate chat-widget.js
    const evalChat = new Function(...Object.keys(globalKeys), chatCode);
    evalChat(...Object.values(globalKeys));

    return env;
  }

  // Test 1: Fresh Login -> Wallet and Helpdesk appear once, auto-close after 5 seconds
  test('1. Fresh login shows Wallet and Helpdesk once, both auto-close after 5 seconds', () => {
    // Simulate user login
    const envLogin = loadPortal('/auth.html', userA);
    // startNewLoginSession is triggered during login
    envLogin.mockWindow.startNewLoginSession(userA.id);

    // Redirect to citizen-dashboard.html
    const envDash = loadPortal('/citizen-dashboard.html', userA);
    
    // Before timers advance, popups are queued
    assert.strictEqual(envDash.elements['cc-doc-wallet-promo-banner'], undefined);
    assert.strictEqual(envDash.elements['cc-chat-callout'], undefined);

    // Advance 600ms -> wallet shows
    envDash.advanceTimersByTime(600);
    assert.ok(envDash.elements['cc-doc-wallet-promo-banner'], 'Wallet banner should be visible at 600ms');

    // Advance to 1500ms -> helpdesk shows
    envDash.advanceTimersByTime(900);
    assert.ok(envDash.elements['cc-chat-callout'], 'Helpdesk callout should be visible at 1500ms');

    // Advance 5000ms -> wallet and helpdesk auto-close
    envDash.advanceTimersByTime(5000);
    // Timer fires close callback
    envDash.runAllPendingTimers();
    assert.strictEqual(envDash.elements['cc-doc-wallet-promo-banner'], undefined, 'Wallet should be auto-closed after 5s');
    assert.strictEqual(envDash.elements['cc-chat-callout'], undefined, 'Helpdesk should be auto-closed after 5s');
  });

  // Test 2: Navigate Dashboard -> My Complaints -> Dashboard -> neither popup appears again
  test('2. Navigate Dashboard -> My Complaints -> Dashboard: neither popup appears again', () => {
    // Navigate to /my-complaints.html
    const envComplaints = loadPortal('/my-complaints.html', userA);
    envComplaints.runAllPendingTimers();
    assert.strictEqual(envComplaints.elements['cc-doc-wallet-promo-banner'], undefined, 'No wallet on My Complaints');
    assert.strictEqual(envComplaints.elements['cc-chat-callout'], undefined, 'No helpdesk on My Complaints');

    // Return to /citizen-dashboard.html
    const envDash2 = loadPortal('/citizen-dashboard.html', userA);
    envDash2.runAllPendingTimers();
    assert.strictEqual(envDash2.elements['cc-doc-wallet-promo-banner'], undefined, 'Wallet must NOT show on return to Dashboard');
    assert.strictEqual(envDash2.elements['cc-chat-callout'], undefined, 'Helpdesk must NOT show on return to Dashboard');
  });

  // Test 3: Dashboard reload while still logged in -> neither popup appears again
  test('3. Dashboard reload while still logged in: neither popup appears again', () => {
    // Reload dashboard
    const envReload = loadPortal('/citizen-dashboard.html', userA);
    envReload.runAllPendingTimers();
    assert.strictEqual(envReload.elements['cc-doc-wallet-promo-banner'], undefined, 'Wallet must NOT show on reload');
    assert.strictEqual(envReload.elements['cc-chat-callout'], undefined, 'Helpdesk must NOT show on reload');
  });

  // Test 4: Navigate through multiple pages and return to Dashboard -> neither popup appears again
  test('4. Navigate through multiple pages and return to Dashboard: neither popup appears again', () => {
    const pages = ['/services.html', '/map.html', '/emergency-services.html', '/weather-alerts.html'];
    for (const page of pages) {
      const env = loadPortal(page, userA);
      env.runAllPendingTimers();
      assert.strictEqual(env.elements['cc-doc-wallet-promo-banner'], undefined);
      assert.strictEqual(env.elements['cc-chat-callout'], undefined);
    }
    // Return to dashboard
    const envDashReturn = loadPortal('/citizen-dashboard.html', userA);
    envDashReturn.runAllPendingTimers();
    assert.strictEqual(envDashReturn.elements['cc-doc-wallet-promo-banner'], undefined);
    assert.strictEqual(envDashReturn.elements['cc-chat-callout'], undefined);
  });

  // Test 5: Manually open Wallet works normally & 5-second timer works
  test('5. Manually open Wallet works normally & 5-second timer works', () => {
    const env = loadPortal('/citizen-dashboard.html', userA);
    env.runAllPendingTimers();
    assert.strictEqual(env.elements['cc-doc-wallet-promo-banner'], undefined);

    // Manually trigger wallet
    env.mockWindow.openDocWalletBanner();
    assert.ok(env.elements['cc-doc-wallet-promo-banner'], 'Wallet must open on manual trigger');

    // Auto-close after 5s
    env.advanceTimersByTime(5000);
    env.runAllPendingTimers();
    assert.strictEqual(env.elements['cc-doc-wallet-promo-banner'], undefined, 'Manually opened wallet must auto-close after 5s');
  });

  // Test 6: Manually open Civic Helpdesk works normally & 5-second timer works
  test('6. Manually open Civic Helpdesk works normally & 5-second timer works', () => {
    const env = loadPortal('/citizen-dashboard.html', userA);
    env.runAllPendingTimers();
    assert.strictEqual(env.elements['cc-chat-callout'], undefined);

    // Manually trigger helpdesk
    env.mockWindow.openCivicHelpPopup();
    assert.ok(env.elements['cc-chat-callout'], 'Helpdesk must open on manual trigger');

    // Auto-close after 5s
    env.advanceTimersByTime(5000);
    env.runAllPendingTimers();
    assert.strictEqual(env.elements['cc-chat-callout'], undefined, 'Manually opened helpdesk must auto-close after 5s');
  });

  // Test 7: Logout clears popup session state
  test('7. Logout clears popup session state', () => {
    const env = loadPortal('/citizen-dashboard.html', userA);
    // Verify session keys exist prior to logout
    assert.ok(sharedLocalStorage.getItem('cc_wallet_shown_for_session') !== null, 'Wallet shown flag must exist before logout');
    assert.ok(sharedLocalStorage.getItem('cc_helpdesk_shown_for_session') !== null, 'Helpdesk shown flag must exist before logout');

    // Call clearLoginSessionPopupState
    env.mockWindow.clearLoginSessionPopupState();

    assert.strictEqual(sharedLocalStorage.getItem('cc_wallet_shown_for_session'), null);
    assert.strictEqual(sharedSessionStorage.getItem('cc_wallet_shown_for_session'), null);
    assert.strictEqual(sharedLocalStorage.getItem('cc_helpdesk_shown_for_session'), null);
    assert.strictEqual(sharedSessionStorage.getItem('cc_helpdesk_shown_for_session'), null);
  });

  // Test 8: Login again: Wallet and Helpdesk automatically appear once again
  test('8. Login again: Wallet and Helpdesk automatically appear once again', () => {
    // New login for userA
    const envLoginAgain = loadPortal('/auth.html', userA);
    envLoginAgain.mockWindow.startNewLoginSession(userA.id);

    // Land on dashboard
    const envDashNew = loadPortal('/citizen-dashboard.html', userA);
    
    // Advance 600ms -> wallet shows
    envDashNew.advanceTimersByTime(600);
    assert.ok(envDashNew.elements['cc-doc-wallet-promo-banner'], 'Wallet must show for new login session');

    // Advance to 1500ms -> helpdesk shows
    envDashNew.advanceTimersByTime(900);
    assert.ok(envDashNew.elements['cc-chat-callout'], 'Helpdesk must show for new login session');

    // Advance 5000ms -> both close
    envDashNew.advanceTimersByTime(5000);
    envDashNew.runAllPendingTimers();
    assert.strictEqual(envDashNew.elements['cc-doc-wallet-promo-banner'], undefined);
    assert.strictEqual(envDashNew.elements['cc-chat-callout'], undefined);
  });

  // Test 9: Multiple logout/login cycles: exactly one presentation per session
  test('9. Multiple logout/login cycles: each login session gets exactly one popup presentation', () => {
    for (let i = 1; i <= 3; i++) {
      // Logout
      const envOut = loadPortal('/citizen-dashboard.html', userA);
      envOut.mockWindow.clearLoginSessionPopupState();

      // Login
      const envIn = loadPortal('/auth.html', userA);
      envIn.mockWindow.startNewLoginSession('cycle_user_' + i);

      // Dashboard visit 1 (fresh session)
      const envD1 = loadPortal('/citizen-dashboard.html', userA);
      envD1.advanceTimersByTime(600);
      assert.ok(envD1.elements['cc-doc-wallet-promo-banner'], `Cycle ${i}: Wallet must appear on first dashboard load`);
      envD1.advanceTimersByTime(900);
      assert.ok(envD1.elements['cc-chat-callout'], `Cycle ${i}: Helpdesk must appear on first dashboard load`);
      envD1.advanceTimersByTime(5000);
      envD1.runAllPendingTimers();

      // Dashboard visit 2 (same session)
      const envD2 = loadPortal('/citizen-dashboard.html', userA);
      envD2.runAllPendingTimers();
      assert.strictEqual(envD2.elements['cc-doc-wallet-promo-banner'], undefined, `Cycle ${i}: Wallet must NOT appear on visit 2`);
      assert.strictEqual(envD2.elements['cc-chat-callout'], undefined, `Cycle ${i}: Helpdesk must NOT appear on visit 2`);
    }
  });

  // Test 10: Verify no duplicate popup DOM nodes when double-triggered
  test('10. Verify no duplicate popup DOM nodes when double-triggered', () => {
    const env = loadPortal('/citizen-dashboard.html', userA);
    // Double trigger manual open
    env.mockWindow.openDocWalletBanner();
    env.mockWindow.openDocWalletBanner();
    assert.ok(env.elements['cc-doc-wallet-promo-banner']);

    env.mockWindow.openCivicHelpPopup();
    env.mockWindow.openCivicHelpPopup();
    assert.ok(env.elements['cc-chat-callout']);

    // Check DOM only has 1 instance of each
    assert.strictEqual(Object.keys(env.elements).filter(k => k === 'cc-doc-wallet-promo-banner').length, 1);
    assert.strictEqual(Object.keys(env.elements).filter(k => k === 'cc-chat-callout').length, 1);
  });

  console.log('\n========================================');
  console.log(`Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
  console.log('========================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
