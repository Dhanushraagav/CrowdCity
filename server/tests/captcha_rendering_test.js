import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import app from '../app.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

function runTest(name, fn) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
  } catch (err) {
    console.error(`[FAIL] ${name}: ${err.message}`);
    process.exitCode = 1;
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn();
    console.log(`[PASS] ${name}`);
  } catch (err) {
    console.error(`[FAIL] ${name}: ${err.message}`);
    process.exitCode = 1;
  }
}

console.log('====================================================');
console.log('  Cloudflare Turnstile CAPTCHA Verification Suite  ');
console.log('====================================================');

// Test 1: client/auth.html structure & callbacks
runTest('auth.html defines onloadTurnstileCallback and imports Turnstile API with explicit render', () => {
  const authHtmlPath = path.join(rootDir, 'client/auth.html');
  const content = fs.readFileSync(authHtmlPath, 'utf8');

  if (!content.includes('window.onloadTurnstileCallback = function()')) {
    throw new Error('window.onloadTurnstileCallback is not defined in auth.html');
  }
  if (!content.includes('challenges.cloudflare.com/turnstile/v0/api.js?onload=onloadTurnstileCallback&render=explicit')) {
    throw new Error('Cloudflare Turnstile explicit script tag missing or misconfigured in auth.html');
  }
  if (!content.includes('id="login-captcha"')) {
    throw new Error('login-captcha container missing from auth.html');
  }
  if (!content.includes('id="signup-captcha"')) {
    throw new Error('signup-captcha container missing from auth.html');
  }
  if (!content.includes('id="recovery-captcha"')) {
    throw new Error('recovery-captcha container missing from auth.html');
  }
});

// Test 2: client/authority-login.html structure & callbacks
runTest('authority-login.html defines onloadTurnstileCallback and imports Turnstile API with explicit render', () => {
  const authLoginHtmlPath = path.join(rootDir, 'client/authority-login.html');
  const content = fs.readFileSync(authLoginHtmlPath, 'utf8');

  if (!content.includes('window.onloadTurnstileCallback = function()')) {
    throw new Error('window.onloadTurnstileCallback is not defined in authority-login.html');
  }
  if (!content.includes('challenges.cloudflare.com/turnstile/v0/api.js?onload=onloadTurnstileCallback&render=explicit')) {
    throw new Error('Cloudflare Turnstile explicit script tag missing or misconfigured in authority-login.html');
  }
  if (!content.includes('id="login-captcha"')) {
    throw new Error('login-captcha container missing from authority-login.html');
  }
});

// Test 3: client/js/auth.js Turnstile implementation
runTest('auth.js implements self-healing renderTurnstileWidgets and fallback site key', () => {
  const authJsPath = path.join(rootDir, 'client/js/auth.js');
  const content = fs.readFileSync(authJsPath, 'utf8');

  if (!content.includes('window.renderTurnstileWidgets = function()')) {
    throw new Error('window.renderTurnstileWidgets is not defined in auth.js');
  }
  if (!content.includes('0x4AAAAAADpoqphtoebgazMP')) {
    throw new Error('Production Turnstile site key 0x4AAAAAADpoqphtoebgazMP not present in auth.js');
  }
  if (!content.includes("const turnstileTheme = 'light'")) {
    throw new Error("Turnstile theme is not set to 'light' in auth.js");
  }
  if (!content.includes('window.turnstileLoaded = true')) {
    throw new Error('window.turnstileLoaded state is never set in auth.js');
  }
  if (!content.includes('window.onloadTurnstileCallback = function()')) {
    throw new Error('window.onloadTurnstileCallback chained handler is missing in auth.js');
  }
});

// Test 4: client/js/authority-login.js Turnstile integration
runTest('authority-login.js calls renderTurnstileWidgets during initialization', () => {
  const authLoginJsPath = path.join(rootDir, 'client/js/authority-login.js');
  const content = fs.readFileSync(authLoginJsPath, 'utf8');

  if (!content.includes('window.renderTurnstileWidgets()')) {
    throw new Error('window.renderTurnstileWidgets() is not called in authority-login.js');
  }
});

// Test 5: /api/config endpoint provides production site key
await runAsyncTest('/api/config returns valid production Turnstile site key', async () => {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/config`);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    if (!data.turnstileSiteKey) {
      throw new Error('turnstileSiteKey missing from /api/config response');
    }
    if (data.turnstileSiteKey !== '0x4AAAAAADpoqphtoebgazMP') {
      throw new Error(`Expected turnstileSiteKey '0x4AAAAAADpoqphtoebgazMP', got '${data.turnstileSiteKey}'`);
    }
  } finally {
    server.close();
  }
});

if (process.exitCode === 1) {
  console.log('\nSome tests failed.');
  process.exit(1);
} else {
  console.log('\nAll Cloudflare Turnstile tests passed successfully.');
}
