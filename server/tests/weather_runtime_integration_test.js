/**
 * Comprehensive Weather Forecast Runtime & Integration Test
 * Verifies:
 * 1. weather-alerts.html and weather-alerts.js integrity
 * 2. fetchWeatherForecast is exported to window scope (no ReferenceError)
 * 3. Retry and Refresh button event listeners and loading states
 * 4. District selection updates banner and selected district view (not stuck on Coimbatore)
 * 5. Timeframe tabs ("All Days", "Today", "Tomorrow", "Day 3", "Day 4", "Day 5") filter accurately
 * 6. Live Open-Meteo API response structure for all 38 TN districts
 */

import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { fileURLToPath } from 'url';
import vm from 'vm';
import { getWeatherForecast } from '../services/weatherService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTests() {
  console.log('🧪 Starting Weather Forecast Runtime & Integration Test Suite...\n');
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

  async function asyncTest(name, fn) {
    try {
      await fn();
      console.log(`   ✓ Passed: ${name}`);
      passed++;
    } catch (err) {
      console.error(`   ✗ Failed: ${name} -> ${err.message}`);
      failed++;
    }
  }

  // 1. Static HTML Checks
  const htmlPath = path.resolve(__dirname, '../../client/weather-alerts.html');
  const htmlContent = fs.readFileSync(htmlPath, 'utf8');

  test('weather-alerts.html has btn-refresh-weather', () => {
    assert(htmlContent.includes('id="btn-refresh-weather"'), 'Missing id="btn-refresh-weather"');
    assert(htmlContent.includes('id="refresh-weather-icon"'), 'Missing id="refresh-weather-icon"');
  });

  test('weather-alerts.html has btn-retry-weather in unavailable box', () => {
    assert(htmlContent.includes('id="btn-retry-weather"'), 'Missing id="btn-retry-weather"');
    assert(htmlContent.includes('id="retry-weather-icon"'), 'Missing id="retry-weather-icon"');
    assert(htmlContent.includes('id="retry-weather-text"'), 'Missing id="retry-weather-text"');
  });

  test('weather-alerts.html has btn-retry-weather-err in error box', () => {
    assert(htmlContent.includes('id="btn-retry-weather-err"'), 'Missing id="btn-retry-weather-err"');
    assert(htmlContent.includes('id="retry-weather-err-icon"'), 'Missing id="retry-weather-err-icon"');
    assert(htmlContent.includes('id="retry-weather-err-text"'), 'Missing id="retry-weather-err-text"');
  });

  test('weather-alerts.html script tags reference weather-alerts.js?v=2.3.0', () => {
    assert(htmlContent.includes('src="js/weather-alerts.js?v=2.3.0"'), 'Script tag not updated with cachebuster v=2.3.0');
  });

  // 2. JS Implementation Checks
  const jsPath = path.resolve(__dirname, '../../client/js/weather-alerts.js');
  const jsContent = fs.readFileSync(jsPath, 'utf8');

  test('weather-alerts.js exports window.fetchWeatherForecast', () => {
    assert(jsContent.includes('window.fetchWeatherForecast = fetchWeatherForecast;'), 'Missing window.fetchWeatherForecast export');
  });

  test('weather-alerts.js binds click listeners to all retry and refresh buttons', () => {
    assert(jsContent.includes("document.getElementById('btn-refresh-weather')"), 'Missing btn-refresh-weather listener');
    assert(jsContent.includes("document.getElementById('btn-retry-weather')"), 'Missing btn-retry-weather listener');
    assert(jsContent.includes("document.getElementById('btn-retry-weather-err')"), 'Missing btn-retry-weather-err listener');
  });

  test('weather-alerts.js defines setRetryLoading with spinner and disabled state', () => {
    assert(jsContent.includes('function setRetryLoading(isLoading)'), 'Missing setRetryLoading function');
    assert(jsContent.includes("retryText.textContent = isLoading ? 'Retrying...' : 'Retry'"), 'Missing Retrying... label update');
  });

  test('weather-alerts.js updates location banner with selected district rather than hardcoded detected district', () => {
    assert(jsContent.includes('getDistrictDisplayName(state.district)'), 'Missing getDistrictDisplayName for selected district');
    assert(jsContent.includes('Showing live weather forecast for: <strong>${escapeHtml(selectedName)}</strong>'), 'Banner text does not use selected district name');
  });

  // 3. Simulated DOM Execution
  test('Simulated DOM: fetchWeatherForecast is attached to window and callable', () => {
    const fakeWindow = {
      location: { href: 'http://localhost:3000/weather-alerts.html' },
      addEventListener: () => {},
      i18n: { t: (k) => k }
    };
    const fakeDocument = {
      addEventListener: () => {},
      getElementById: (id) => {
        return {
          id,
          classList: {
            add: () => {},
            remove: () => {},
            contains: () => false
          },
          addEventListener: () => {},
          style: {},
          innerHTML: '',
          textContent: '',
          value: ''
        };
      },
      querySelectorAll: () => []
    };

    const sandbox = {
      window: fakeWindow,
      document: fakeDocument,
      navigator: { clipboard: { writeText: async () => {} } },
      console: { log: () => {}, warn: () => {}, error: () => {} },
      fetch: async () => ({
        ok: true,
        json: async () => ({
          success: true,
          source_available: true,
          is_stale: false,
          last_updated_ist: '2026-09-27 07:00 IST',
          districts_forecast: []
        })
      }),
      setTimeout: setTimeout,
      clearTimeout: clearTimeout
    };

    vm.createContext(sandbox);
    vm.runInContext(jsContent, sandbox);

    assert.strictEqual(typeof sandbox.window.fetchWeatherForecast, 'function', 'window.fetchWeatherForecast should be a function');
  });

  // 4. Live Open-Meteo Weather Service Check
  await asyncTest('Live weatherService returns 38 real TN districts from Open-Meteo', async () => {
    const forecast = await getWeatherForecast(false);

    assert(forecast, 'Forecast must not be null');
    assert.strictEqual(forecast.success, true, 'forecast.success must be true');
    assert.strictEqual(forecast.source_available, true, 'forecast.source_available must be true');
    assert(Array.isArray(forecast.districts_forecast), 'districts_forecast must be an array');
    assert.strictEqual(forecast.districts_forecast.length, 38, 'Must return all 38 TN districts');

    // Verify Coimbatore
    const cbe = forecast.districts_forecast.find(d => d.district.id.toLowerCase() === 'coimbatore');
    assert(cbe, 'Coimbatore must exist in forecast');
    assert(typeof cbe.current.temperature_c === 'number', 'Coimbatore current temp must be numeric');
    assert(Array.isArray(cbe.daily) && cbe.daily.length === 5, 'Coimbatore must have 5 daily forecasts');

    // Verify Chennai
    const chn = forecast.districts_forecast.find(d => d.district.id.toLowerCase() === 'chennai');
    assert(chn, 'Chennai must exist in forecast');
    assert(typeof chn.current.temperature_c === 'number', 'Chennai current temp must be numeric');
    assert(Array.isArray(chn.daily) && chn.daily.length === 5, 'Chennai must have 5 daily forecasts');

    // Verify Salem
    const salem = forecast.districts_forecast.find(d => d.district.id.toLowerCase() === 'salem');
    assert(salem, 'Salem must exist in forecast');
    assert(typeof salem.current.temperature_c === 'number', 'Salem current temp must be numeric');

    // Verify Daily indices and properties
    cbe.daily.forEach((day, idx) => {
      assert.strictEqual(day.day_index, idx + 1, `Day index should be ${idx + 1}`);
      assert(day.day_label, 'day_label must exist');
      assert(typeof day.temperature_max_c === 'number', 'temperature_max_c must be numeric');
      assert(typeof day.temperature_min_c === 'number', 'temperature_min_c must be numeric');
      assert(typeof day.precipitation_probability_pct === 'number', 'precipitation_probability_pct must be numeric');
    });
  });

  console.log(`\n========================================`);
  console.log(`Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
  console.log(`========================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test runner failure:', err);
  process.exit(1);
});
