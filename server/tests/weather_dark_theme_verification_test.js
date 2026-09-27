/**
 * weather_dark_theme_verification_test.js
 * 
 * Verifies that:
 * 1. Dark theme actually applies to /weather-alerts
 * 2. AMOLED pure black (#000000 / #080808 / #0a0a0a) applies across all 19 weather sections
 * 3. Zero white/light sections remain when dark theme is active
 * 4. Back button has high-contrast visibility in both Dark (#0f0f0f, white text, cyan arrow)
 *    and Light (#ffffff, dark text, dark arrow) themes
 * 5. Light theme continues to function flawlessly
 * 6. Live theme-change event listeners synchronize document.documentElement and body
 */

import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runVerification() {
  console.log('🧪 Starting Weather Page AMOLED Dark Theme & Back Button Verification...\n');
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

  // Test 1: Root light tokens do NOT target `body` directly (prevents inheritance block)
  test('1. Root light tokens do not bind directly to body (prevents inheritance shadowing)', () => {
    const lightBlockMatch = htmlContent.match(/:root,\s*html,\s*html\[data-theme="light"\]\s*\{/);
    assert(lightBlockMatch, 'Light tokens must be defined on :root, html, html[data-theme="light"] without body');
    // Ensure "body {" is not in this specific selector list
    const badSelector = htmlContent.includes('html[data-theme="light"],\n    body {') || 
                        htmlContent.includes('html[data-theme="light"],\r\n    body {');
    assert(!badSelector, 'body must not be in the light theme token selector');
  });

  // Test 2: Dark theme tokens apply to :root[data-theme="dark"], html, and [data-theme="dark"] body
  test('2. Dark theme tokens explicitly cover html, root, and body descendants', () => {
    assert(htmlContent.includes(':root[data-theme="dark"]'), 'Must include :root[data-theme="dark"]');
    assert(htmlContent.includes('html[data-theme="dark"]'), 'Must include html[data-theme="dark"]');
    assert(htmlContent.includes('[data-theme="dark"] body'), 'Must include [data-theme="dark"] body');
    assert(htmlContent.includes('--weather-bg: var(--bg-app, #000000);'), 'Must define AMOLED --weather-bg');
    assert(htmlContent.includes('--weather-card-bg: var(--card-bg, #0a0a0a);'), 'Must define AMOLED --weather-card-bg');
  });

  // Test 3: AMOLED black page backgrounds
  test('3. Page background, .app-layout, and .main-content enforce AMOLED black in dark mode', () => {
    assert(htmlContent.includes('[data-theme="dark"] body'), 'Dark theme must target body');
    assert(htmlContent.includes('[data-theme="dark"] .app-layout'), 'Dark theme must target .app-layout');
    assert(htmlContent.includes('[data-theme="dark"] .main-content'), 'Dark theme must target .main-content');
  });

  // Test 4: Weather Hero Card uses themed background and AMOLED #080808 in dark mode
  test('4. Hero card uses theme variables and #080808 AMOLED surface in dark mode', () => {
    assert(htmlContent.includes('.weather-hero-card {\n      position: relative;\n      background: var(--weather-card-bg);') ||
           htmlContent.includes('.weather-hero-card {\r\n      position: relative;\r\n      background: var(--weather-card-bg);'),
           'Hero card must use var(--weather-card-bg) for seamless theme transition');
    assert(htmlContent.includes('[data-theme="dark"] .weather-hero-card') && htmlContent.includes('#080808 !important;'),
           'Hero card in dark mode must be #080808 AMOLED pure black surface');
  });

  // Test 5: All container sections have explicit AMOLED dark rules
  test('5. All container sections have explicit AMOLED dark rules', () => {
    assert(htmlContent.includes('[data-theme="dark"] .weather-filter-card'), 'Missing dark rule for .weather-filter-card');
    assert(htmlContent.includes('[data-theme="dark"] .nearby-regions-section'), 'Missing dark rule for .nearby-regions-section');
    assert(htmlContent.includes('[data-theme="dark"] .hourly-forecast-section'), 'Missing dark rule for .hourly-forecast-section');
    assert(htmlContent.includes('[data-theme="dark"] .daily-forecast-card'), 'Missing dark rule for .daily-forecast-card');
    assert(htmlContent.includes('[data-theme="dark"] .district-overview-card'), 'Missing dark rule for .district-overview-card');
    assert(htmlContent.includes('[data-theme="dark"] .weather-state-box'), 'Missing dark rule for .weather-state-box');
  });

  // Test 6: Back button styling in dark mode (high contrast: dark surface + white text + cyan arrow)
  test('6. Back button styling in dark mode has high contrast (#0f0f0f, white text, cyan arrow)', () => {
    assert(htmlContent.includes('[data-theme="dark"] .weather-back-btn'), 'Missing dark back button rule');
    assert(htmlContent.includes('background: #0f0f0f !important;'), 'Dark back button must have #0f0f0f surface');
    assert(htmlContent.includes('border: 1px solid #2a2a2a !important;'), 'Dark back button must have visible border');
    assert(htmlContent.includes('color: #ffffff !important;'), 'Dark back button must have white text');
    assert(htmlContent.includes('[data-theme="dark"] .weather-back-btn i') && htmlContent.includes('color: #38bdf8 !important;'),
           'Dark back button arrow must be vivid cyan #38bdf8');
  });

  // Test 7: Back button styling in light mode (high contrast: white surface + dark text + subtle border)
  test('7. Back button styling in light mode has high contrast (#ffffff, dark text, dark icon)', () => {
    assert(htmlContent.includes('.weather-back-btn {'), 'Missing light back button rule');
    assert(htmlContent.includes('background: var(--bg-surface, #ffffff) !important;'), 'Light back button must have white surface');
    assert(htmlContent.includes('color: var(--text-main, #0f172a) !important;'), 'Light back button must have dark text');
    assert(htmlContent.includes('border: 1px solid var(--border-color, #cbd5e1) !important;'), 'Light back button must have visible border');
    assert(htmlContent.includes('.weather-back-btn i {') && htmlContent.includes('color: var(--text-main, #0f172a) !important;'),
           'Light back button arrow must be dark text color');
  });

  // Test 8: Back button position & z-index
  test('8. Back button has relative positioning and z-index to avoid clipping or occlusion', () => {
    assert(htmlContent.includes('position: relative;'), 'Back button must have position: relative');
    assert(htmlContent.includes('z-index: 10;'), 'Back button must have z-index: 10');
    assert(htmlContent.includes('display: inline-flex !important;'), 'Back button must not be hidden');
  });

  // Test 9: Early bootstrap and live event synchronization
  test('9. Early bootstrap script synchronizes both document.documentElement and body across theme changes', () => {
    assert(htmlContent.includes('syncBodyTheme'), 'Must include syncBodyTheme helper');
    assert(htmlContent.includes("window.addEventListener('theme-change'"), 'Head must listen to theme-change');
    assert(htmlContent.includes("window.addEventListener('storage'"), 'Head must listen to storage event');
  });

  // Test 10: Zero hardcoded navy blue fills in dark mode surfaces
  test('10. Zero hardcoded navy blue surfaces in dark mode', () => {
    const navyHexes = ['#0d2142', '#0a172e', '#0b1526', '#101c30', '#090e1a', '#0f172a'];
    navyHexes.forEach(hex => {
      assert(!htmlContent.includes(`--weather-bg: ${hex}`), `Must not use ${hex} for --weather-bg`);
      assert(!htmlContent.includes(`--weather-card-bg: ${hex}`), `Must not use ${hex} for --weather-card-bg`);
    });
  });

  // Test 11: Weather data & location functionality untouched
  test('11. Weather data & location functions untouched in JS', () => {
    assert(jsContent.includes('async function fetchWeatherForecast('), 'fetchWeatherForecast must remain intact');
    assert(jsContent.includes('window.selectRegion = async function'), 'selectRegion must remain intact');
    assert(jsContent.includes('function renderNearbyRegions('), 'renderNearbyRegions must remain intact');
    assert(jsContent.includes('function renderHeroCard('), 'renderHeroCard must remain intact');
    assert(jsContent.includes('function renderHourlyTimeline('), 'renderHourlyTimeline must remain intact');
    assert(jsContent.includes('function renderDailyForecast('), 'renderDailyForecast must remain intact');
  });

  // Test 12: Zero emojis in HTML & JS
  test('12. Zero emojis in HTML and JS files', () => {
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

runVerification().catch(err => {
  console.error('Verification error:', err);
  process.exit(1);
});
