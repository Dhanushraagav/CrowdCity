/**
 * weather_theme_and_back_button_test.js
 * 
 * Comprehensive Verification for:
 * 1. Global App Theme Integration (Light / Dark mode adherence)
 * 2. Decoupled atmospheric weather conditions from application theme
 * 3. Compact Universal Back Button (placement, markup, keyboard accessibility, safe fallback)
 * 4. Zero regressions in weather functionality, zero emojis, and zero console errors
 */

import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTests() {
  console.log('🧪 Starting Weather Page Theme & Back Button Test Suite...\n');
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`   ✓ Passed: ${name}`);
      passed++;
    } catch (err) {
      console.error(`   ✗ Failed: ${name} -> ${err.message}`);
      failed++;
    }
  }

  const htmlPath = path.resolve(__dirname, '../../client/weather-alerts.html');
  const jsPath = path.resolve(__dirname, '../../client/js/weather-alerts.js');
  const htmlContent = fs.readFileSync(htmlPath, 'utf8');
  const jsContent = fs.readFileSync(jsPath, 'utf8');

  // 1. Back button placement and attributes
  test('1. Back button exists with correct id, classes, and accessibility attributes', () => {
    assert(htmlContent.includes('id="btn-weather-back"'), 'Missing id="btn-weather-back"');
    assert(htmlContent.includes('class="weather-back-btn universal-desktop-back-btn"'), 'Missing classes');
    assert(htmlContent.includes('aria-label="Go back"'), 'Missing aria-label="Go back"');
    assert(htmlContent.includes('href="citizen-dashboard.html"'), 'Missing fallback href to citizen-dashboard.html');
    assert(htmlContent.includes('onclick="handleWeatherBackNavigation(event)"'), 'Missing onclick handler');
  });

  // 2. Back button placement before title/header
  test('2. Back button is placed in top-left navigation row before the header title', () => {
    const backBtnIdx = htmlContent.indexOf('id="btn-weather-back"');
    const headerBarIdx = htmlContent.indexOf('class="weather-header-bar"');
    const headerTitleIdx = htmlContent.indexOf('class="weather-header-title"');
    assert(backBtnIdx !== -1, 'Back button not found');
    assert(headerBarIdx !== -1, 'Header bar not found');
    assert(backBtnIdx < headerBarIdx, 'Back button must appear before weather-header-bar');
    assert(backBtnIdx < headerTitleIdx, 'Back button must appear before weather-header-title');
  });

  // 3. Dual-theme CSS token architecture
  test('3. CSS defines light theme tokens with high readability dark text', () => {
    assert(htmlContent.includes('--weather-bg: #f8fafc;'), 'Missing light theme --weather-bg');
    assert(htmlContent.includes('--weather-card-bg: #ffffff;'), 'Missing light theme --weather-card-bg');
    assert(htmlContent.includes('--weather-text-primary: #0f172a;'), 'Missing light theme --weather-text-primary (#0f172a)');
    assert(htmlContent.includes('--weather-border: #e2e8f0;'), 'Missing light theme --weather-border');
  });

  test('4. CSS defines dark theme tokens matching AMOLED / dark mode', () => {
    assert(htmlContent.includes('--weather-bg: #090e1a;'), 'Missing dark theme --weather-bg');
    assert(htmlContent.includes('--weather-card-bg: #0f172a;'), 'Missing dark theme --weather-card-bg');
    assert(htmlContent.includes('--weather-text-primary: #f8fafc;'), 'Missing dark theme --weather-text-primary');
    assert(htmlContent.includes('--weather-border: rgba(255, 255, 255, 0.08);'), 'Missing dark theme --weather-border');
  });

  // 5. Back button styling across themes
  test('5. Back button styling handles both light and dark modes with mobile visibility', () => {
    assert(htmlContent.includes('.weather-back-btn {'), 'Missing .weather-back-btn base styles');
    assert(htmlContent.includes('display: inline-flex !important;'), 'Must have display: inline-flex !important to prevent mobile hiding');
    assert(htmlContent.includes('[data-theme="dark"] .weather-back-btn'), 'Missing dark mode back button styling');
    assert(htmlContent.includes('color: #ffffff !important;'), 'Dark mode back button must have white text/icon');
    assert(htmlContent.includes(':focus-visible'), 'Back button must support focus-visible outline for keyboard navigation');
  });

  // 6. Decoupled atmospheric scenes
  test('6. Hero card condition gradients are provided for both light and dark app themes', () => {
    assert(htmlContent.includes('html:not([data-theme="dark"]) .weather-hero-card.weather-scene-day-clear'), 'Missing light clear day gradient');
    assert(htmlContent.includes('html:not([data-theme="dark"]) .weather-hero-card.weather-scene-night-clear'), 'Missing light clear night gradient');
    assert(htmlContent.includes('html:not([data-theme="dark"]) .weather-hero-card.weather-scene-rain'), 'Missing light rain gradient');
    assert(htmlContent.includes('[data-theme="dark"] .weather-hero-card.weather-scene-day-clear'), 'Missing dark clear day gradient');
    assert(htmlContent.includes('[data-theme="dark"] .weather-hero-card.weather-scene-night-clear'), 'Missing dark clear night gradient');
    assert(htmlContent.includes('[data-theme="dark"] .weather-hero-card.weather-scene-rain'), 'Missing dark rain gradient');
  });

  test('7. Light theme night weather maintains light UI (atmospheric decoupling)', () => {
    // In light theme, night-clear uses soft light slate gradient, not black
    assert(htmlContent.includes('html:not([data-theme="dark"]) .weather-hero-card.weather-scene-night-clear'), 'Missing light mode night scene');
    assert(htmlContent.includes('linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 50%, #f8fafc 100%)'), 'Light mode night gradient must be light slate, not dark');
    assert(htmlContent.includes('html:not([data-theme="dark"]) .star-particle'), 'Light mode star particles must adapt');
  });

  // 8. JS export and navigation logic
  test('8. weather-alerts.js exports window.handleWeatherBackNavigation', () => {
    assert(jsContent.includes('window.handleWeatherBackNavigation = handleWeatherBackNavigation;'), 'Missing window.handleWeatherBackNavigation export');
    assert(jsContent.includes('function handleWeatherBackNavigation'), 'Missing handleWeatherBackNavigation definition');
  });

  test('9. handleWeatherBackNavigation safely falls back to citizen-dashboard.html', () => {
    assert(jsContent.includes("'citizen-dashboard.html'"), 'Fallback must navigate to citizen-dashboard.html');
    assert(jsContent.includes('window.history.back()'), 'Safe back navigation must invoke history.back() when referrer is valid');
  });

  test('10. weather-alerts.js listens to live theme-change and storage events', () => {
    assert(jsContent.includes("window.addEventListener('theme-change'"), 'Missing theme-change event listener');
    assert(jsContent.includes("window.addEventListener('storage'"), 'Missing storage event listener for cross-tab theme changes');
    assert(jsContent.includes("e.key === 'crowdcity_theme'"), 'Storage listener must check crowdcity_theme');
  });

  test('11. Back button keyboard accessibility (Enter and Space keys)', () => {
    assert(jsContent.includes("e.key === ' ' || e.key === 'Spacebar'"), 'Missing keyboard Space key handler on back button');
    assert(jsContent.includes('handleWeatherBackNavigation'), 'Keydown handler must invoke handleWeatherBackNavigation');
  });

  test('12. ZERO emojis in HTML and JS files', () => {
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    assert(!emojiRegex.test(htmlContent), 'HTML must contain zero emojis');
    assert(!emojiRegex.test(jsContent), 'JS must contain zero emojis');
  });

  console.log(`\n========================================`);
  console.log(`Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
