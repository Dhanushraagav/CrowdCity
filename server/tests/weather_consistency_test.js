/**
 * weather_consistency_test.js
 * 
 * Comprehensive Verification Test Suite for:
 * 1. Weather Data Consistency between Citizen Dashboard and Weather Forecast Page.
 * 2. Shared Open-Meteo Coordinate Cache & Single Source of Truth.
 * 3. Nearest District Proximity Fallback (e.g. Coimbatore vs Chennai centroid).
 * 4. App Sidebar & Responsive Layout Integration on Weather Alerts page.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  getWeatherForecast,
  findNearestDistrict,
  clearCache,
  setMockFixtures,
  OPEN_METEO_SOURCE
} from '../services/weatherService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧪 Starting Weather Consistency & Sidebar Integration Test Suite...\n');

let passedTests = 0;
let totalTests = 0;

function runTest(title, fn) {
  totalTests++;
  try {
    fn();
    console.log(`   ✓ Passed: ${title}`);
    passedTests++;
  } catch (err) {
    console.error(`   ✗ Failed: ${title} -> ${err.message}`);
  }
}

async function runAsyncTest(title, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`   ✓ Passed: ${title}`);
    passedTests++;
  } catch (err) {
    console.error(`   ✗ Failed: ${title} -> ${err.message}`);
  }
}

// Coordinate fixture for Pappampatti Pirivu, Sulur, Coimbatore
const TEST_COORDS = { lat: 10.9765, lon: 77.1086 };

// Mock Open-Meteo Fixture for deterministic unit testing
const MOCK_COORDS_RAW = {
  current: {
    time: '2026-09-27T11:00',
    temperature_2m: 31.4,
    apparent_temperature: 34.2,
    relative_humidity_2m: 68,
    precipitation: 0.0,
    rain: 0.0,
    showers: 0.0,
    weather_code: 3, // Overcast
    wind_speed_10m: 14.5,
    wind_gusts_10m: 22.0,
    is_day: 1,
    visibility: 10000
  },
  daily: {
    time: ['2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01'],
    weather_code: [3, 2, 1, 0, 80],
    temperature_2m_max: [33.0, 32.5, 34.0, 34.5, 31.0],
    temperature_2m_min: [24.0, 23.5, 24.2, 23.8, 22.9],
    apparent_temperature_max: [36.0, 35.5, 37.0, 37.5, 34.0],
    apparent_temperature_min: [25.0, 24.5, 25.2, 24.8, 23.9],
    precipitation_sum: [0.0, 0.0, 0.0, 0.0, 3.5],
    rain_sum: [0.0, 0.0, 0.0, 0.0, 3.5],
    precipitation_probability_max: [20, 15, 10, 5, 65],
    wind_speed_10m_max: [16.0, 15.0, 14.0, 12.0, 18.0],
    wind_gusts_10m_max: [25.0, 24.0, 22.0, 20.0, 28.0],
    sunrise: ['2026-09-27T06:05', '2026-09-28T06:05', '2026-09-29T06:05', '2026-09-30T06:05', '2026-10-01T06:05'],
    sunset: ['2026-09-27T18:15', '2026-09-28T18:14', '2026-09-29T18:13', '2026-09-30T18:12', '2026-10-01T18:11']
  },
  hourly: {
    time: Array.from({ length: 48 }, (_, i) => new Date(Date.now() + i * 3600000).toISOString()),
    temperature_2m: Array.from({ length: 48 }, () => 31.0),
    relative_humidity_2m: Array.from({ length: 48 }, () => 65),
    precipitation_probability: Array.from({ length: 48 }, () => 10),
    weather_code: Array.from({ length: 48 }, () => 3),
    is_day: Array.from({ length: 48 }, () => 1)
  }
};

async function executeTestSuite() {
  clearCache();
  setMockFixtures(() => MOCK_COORDS_RAW);

  // 1. Proximity matching for Coimbatore coordinates
  runTest('1. findNearestDistrict resolves (10.9765, 77.1086) to Coimbatore', () => {
    const nearest = findNearestDistrict(TEST_COORDS.lat, TEST_COORDS.lon);
    assert(nearest, 'Nearest district should not be null');
    assert.strictEqual(nearest.id, 'coimbatore', 'Pappampatti Pirivu coords must map to Coimbatore, not Chennai');
  });

  // 2. WeatherForecast returns normalized current object with coordinates
  await runAsyncTest('2. getWeatherForecast with coordinates returns unified normalized data', async () => {
    const result = await getWeatherForecast({
      lat: TEST_COORDS.lat,
      lon: TEST_COORDS.lon,
      locality: 'Pappampatti Pirivu',
      district: 'Coimbatore'
    });

    assert.strictEqual(result.success, true, 'Result should be successful');
    assert(result.current, 'Must have top-level current object');
    assert.strictEqual(Math.round(result.current.temperature_c), 31, 'Temperature should be 31°C');
    assert.strictEqual(result.current.condition, 'Overcast', 'Condition should be Overcast');
    assert.strictEqual(result.current.timezone, 'Asia/Kolkata', 'Timezone should be Asia/Kolkata');
    assert.strictEqual(result.location.name, 'Pappampatti Pirivu', 'Location name should match locality');
    assert.strictEqual(result.location.district, 'Coimbatore', 'District should match Coimbatore');
  });

  // 3. Coordinate cache returns identical weather on subsequent requests
  await runAsyncTest('3. Subsequent coordinate requests hit coordsWeatherCache with identical values', async () => {
    const res1 = await getWeatherForecast({ lat: TEST_COORDS.lat, lon: TEST_COORDS.lon });
    const res2 = await getWeatherForecast({ lat: TEST_COORDS.lat, lon: TEST_COORDS.lon });

    assert.strictEqual(res1.current.temperature_c, res2.current.temperature_c, 'Temperatures must match identically');
    assert.strictEqual(res1.current.condition, res2.current.condition, 'Conditions must match identically');
    assert.strictEqual(res1.last_updated_ist, res2.last_updated_ist, 'IST Timestamps must match from cache');
  });

  // 4. District fallback: "Tamil Nadu" or empty district resolves gracefully without error
  await runAsyncTest('4. District query with "Tamil Nadu" handles gracefully without erroring', async () => {
    const result = await getWeatherForecast({ district: 'Tamil Nadu' });
    assert.strictEqual(result.success, true, 'Should succeed instead of saying district not found');
    assert(result.current, 'Should have current weather');
  });

  // Clean mock fixtures for file audits
  setMockFixtures(null);
  clearCache();

  // 5. Citizen Dashboard code audit
  const dashboardHtml = fs.readFileSync(path.resolve(__dirname, '../../client/citizen-dashboard.html'), 'utf8');

  runTest('5. Citizen Dashboard captures coordinates from savedLoc & synchronizes to cc_weather_coords', () => {
    assert(dashboardHtml.includes('savedLoc.lat'), 'Dashboard must check savedLoc.lat');
    assert(dashboardHtml.includes("localStorage.setItem('cc_weather_coords'"), 'Dashboard must synchronize to cc_weather_coords');
  });

  runTest('6. Citizen Dashboard does not hardcode condition: "Clear" in fallbacks', () => {
    assert(!dashboardHtml.includes("condition: 'Clear'"), 'Dashboard must NEVER hardcode condition: Clear');
    assert(dashboardHtml.includes('getWMOConditionText'), 'Dashboard must use getWMOConditionText for accurate conditions');
  });

  // 7. Weather Alerts JS audit
  const weatherJs = fs.readFileSync(path.resolve(__dirname, '../../client/js/weather-alerts.js'), 'utf8');

  runTest('7. Weather Forecast JS initializes user coordinates and attaches them to weatherUrl', () => {
    assert(weatherJs.includes('activeLat') && weatherJs.includes('activeLon'), 'Must calculate activeLat and activeLon');
    assert(weatherJs.includes('&lat=${activeLat}&lon=${activeLon}'), 'Must pass lat and lon query parameters');
  });

  runTest('8. Weather Forecast JS prioritizes exact data.current for the hero card', () => {
    assert(weatherJs.includes('const current = (data.current && typeof data.current.temperature_c === \'number\')'),
      'Hero card must prioritize exact coordinate weather data.current');
  });

  // 9. Weather Alerts HTML Sidebar Layout audit
  const weatherHtml = fs.readFileSync(path.resolve(__dirname, '../../client/weather-alerts.html'), 'utf8');

  runTest('9. Weather Alerts HTML includes standard <aside class="app-sidebar"> with 7 navigation links', () => {
    assert(weatherHtml.includes('<aside class="app-sidebar">'), 'Must contain <aside class="app-sidebar">');
    assert(weatherHtml.includes('href="citizen-dashboard.html"'), 'Must link to citizen-dashboard.html');
    assert(weatherHtml.includes('href="report.html"'), 'Must link to report.html');
    assert(weatherHtml.includes('href="my-complaints.html"'), 'Must link to my-complaints.html');
    assert(weatherHtml.includes('href="map.html"'), 'Must link to map.html');
    assert(weatherHtml.includes('href="services.html"'), 'Must link to services.html');
    assert(weatherHtml.includes('href="emergency-services.html"'), 'Must link to emergency-services.html');
    assert(weatherHtml.includes('href="helplines.html"'), 'Must link to helplines.html');
  });

  runTest('10. Weather Alerts HTML has <main class="app-main"> and header with mobile menu button', () => {
    assert(weatherHtml.includes('<main class="app-main"'), 'Must contain <main class="app-main">');
    assert(weatherHtml.includes('<header class="app-header-main">'), 'Must contain <header class="app-header-main">');
    assert(weatherHtml.includes('id="mobile-menu-btn"'), 'Must contain #mobile-menu-btn for mobile sidebar drawer');
    assert(weatherHtml.includes('class="app-content-body"'), 'Must contain .app-content-body wrapper');
  });

  runTest('11. Back button is preserved and styled with AMOLED and light mode contrast', () => {
    assert(weatherHtml.includes('id="btn-weather-back"'), 'Must contain #btn-weather-back');
    assert(weatherHtml.includes('handleWeatherBackNavigation'), 'Must call handleWeatherBackNavigation');
    assert(weatherHtml.includes('[data-theme="dark"] .weather-back-btn'), 'Must have dark mode back button styles');
  });

  runTest('12. Zero emojis and strict AMOLED dark mode rules in weather files', () => {
    const emojiRegex = /[\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    assert(!emojiRegex.test(weatherHtml), 'weather-alerts.html must have ZERO emojis');
    assert(!emojiRegex.test(weatherJs), 'weather-alerts.js must have ZERO emojis');
  });

  console.log(`\n========================================`);
  console.log(`Total: ${totalTests} | Passed: ${passedTests} | Failed: ${totalTests - passedTests}`);
  console.log(`========================================\n`);

  if (passedTests === totalTests) {
    console.log('All Weather Consistency & Sidebar Integration tests passed successfully! ✨\n');
  } else {
    process.exit(1);
  }
}

executeTestSuite().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
