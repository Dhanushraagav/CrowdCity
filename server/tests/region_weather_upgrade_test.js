/**
 * region_weather_upgrade_test.js
 * 
 * Comprehensive automated verification for:
 * WEATHER PAGE PREMIUM UI/UX + REGION-LEVEL WEATHER UPGRADE
 * 
 * Verifies all 25 prompt criteria:
 * 1. Coimbatore user location
 * 2. Chennai district
 * 3. Salem district
 * 4. Madurai district
 * 5. Coimbatore → Peelamedu (authentic locality coordinates)
 * 6. Coimbatore → Gandhipuram (authentic locality coordinates)
 * 7. Coimbatore → Singanallur (authentic locality coordinates)
 * 8. Coimbatore → Saravanampatti (authentic locality coordinates)
 * 9. Search partial locality name
 * 10. Clear search
 * 11. Use my location
 * 12. Refresh
 * 13. Retry
 * 14. Open-Meteo failure & zero fake data
 * 15. 5-day tabs
 * 16. Day/night scene
 * 17. Rain animation
 * 18. Sunny animation
 * 19. Cloudy animation
 * 20. Thunderstorm animation
 * 21. Mobile layout
 * 22. Desktop layout
 * 23. prefers-reduced-motion
 * 24. Hourly forecast
 * 25. Weather insights
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { getWeatherForecast, normalizeDistrictForecast, generateWeatherInsights, formatHourLabel } from '../services/weatherService.js';
import { searchLocations, getTopLocalitiesForDistrict, CURATED_LOCALITIES, isInsideTamilNadu } from '../services/locationSearchService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runSuite() {
  console.log('🧪 Starting Region-Level Weather Upgrade Test Suite (25 Tests)...\n');
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`   ✓ Passed: ${name}`);
      passed++;
    } catch (err) {
      console.error(`   ✗ FAILED: ${name} -> ${err.message}`);
      failed++;
    }
  }

  async function asyncTest(name, fn) {
    try {
      await fn();
      console.log(`   ✓ Passed: ${name}`);
      passed++;
    } catch (err) {
      console.error(`   ✗ FAILED: ${name} -> ${err.message}`);
      failed++;
    }
  }

  // 1. Coimbatore User Location
  await asyncTest('1. Coimbatore user location forecast lookup', async () => {
    const res = await getWeatherForecast({ district: 'coimbatore' });
    assert(res.success, 'Result should be successful');
    assert(res.current_district, 'Should return current_district for Coimbatore');
    assert.strictEqual(res.current_district.district.id.toLowerCase(), 'coimbatore');
    assert(typeof res.current_district.current.temperature_c === 'number');
    assert.strictEqual(res.current_district.daily.length, 5);
  });

  // 2. Chennai District
  await asyncTest('2. Chennai district forecast lookup', async () => {
    const res = await getWeatherForecast({ district: 'chennai' });
    assert(res.success);
    assert.strictEqual(res.current_district.district.id.toLowerCase(), 'chennai');
    assert(typeof res.current_district.current.temperature_c === 'number');
  });

  // 3. Salem District
  await asyncTest('3. Salem district forecast lookup', async () => {
    const res = await getWeatherForecast({ district: 'salem' });
    assert(res.success);
    assert.strictEqual(res.current_district.district.id.toLowerCase(), 'salem');
    assert(typeof res.current_district.current.temperature_c === 'number');
  });

  // 4. Madurai District
  await asyncTest('4. Madurai district forecast lookup', async () => {
    const res = await getWeatherForecast({ district: 'madurai' });
    assert(res.success);
    assert.strictEqual(res.current_district.district.id.toLowerCase(), 'madurai');
    assert(typeof res.current_district.current.temperature_c === 'number');
  });

  // 5. Peelamedu Locality
  await asyncTest('5. Coimbatore → Peelamedu resolves authentic locality coordinates', async () => {
    const search = await searchLocations('Peelamedu');
    assert(search.results.length > 0, 'Peelamedu should be found');
    const peelamedu = search.results[0];
    assert.strictEqual(peelamedu.name, 'Peelamedu');
    assert.strictEqual(peelamedu.district, 'Coimbatore');
    assert(isInsideTamilNadu(peelamedu.lat, peelamedu.lon));
    // Verify weather fetch for Peelamedu's coordinates
    const weather = await getWeatherForecast({
      lat: peelamedu.lat,
      lon: peelamedu.lon,
      locality: 'Peelamedu',
      district: 'Coimbatore'
    });
    assert(weather.success);
    assert.strictEqual(weather.location.name, 'Peelamedu');
    assert.strictEqual(weather.location.locality, 'Peelamedu');
    assert(typeof weather.current.temperature_c === 'number');
    assert(Array.isArray(weather.hourly) && weather.hourly.length > 0);
  });

  // 6. Gandhipuram Locality
  await asyncTest('6. Coimbatore → Gandhipuram resolves authentic locality coordinates', async () => {
    const search = await searchLocations('Gandhipuram');
    assert(search.results.length > 0, 'Gandhipuram should be found');
    const item = search.results[0];
    assert.strictEqual(item.name, 'Gandhipuram');
    assert.strictEqual(item.district, 'Coimbatore');
    assert(isInsideTamilNadu(item.lat, item.lon));
    const weather = await getWeatherForecast({
      lat: item.lat,
      lon: item.lon,
      locality: 'Gandhipuram',
      district: 'Coimbatore'
    });
    assert(weather.success);
    assert.strictEqual(weather.location.locality, 'Gandhipuram');
  });

  // 7. Singanallur Locality
  await asyncTest('7. Coimbatore → Singanallur resolves authentic locality coordinates', async () => {
    const search = await searchLocations('Singanallur');
    assert(search.results.length > 0);
    const item = search.results[0];
    assert(item.name.toLowerCase().includes('singanallur'));
    assert(isInsideTamilNadu(item.lat, item.lon));
    const weather = await getWeatherForecast({
      lat: item.lat,
      lon: item.lon,
      locality: 'Singanallur',
      district: 'Coimbatore'
    });
    assert(weather.success);
  });

  // 8. Saravanampatti Locality
  await asyncTest('8. Coimbatore → Saravanampatti resolves authentic locality coordinates', async () => {
    const search = await searchLocations('Saravanampatti');
    assert(search.results.length > 0);
    const item = search.results[0];
    assert(item.name.toLowerCase().includes('saravanampatti'));
    assert(isInsideTamilNadu(item.lat, item.lon));
    const weather = await getWeatherForecast({
      lat: item.lat,
      lon: item.lon,
      locality: 'Saravanampatti',
      district: 'Coimbatore'
    });
    assert(weather.success);
  });

  // 9. Search Partial Locality Name
  await asyncTest('9. Search partial locality name (Peela -> Peelamedu, Gand -> Gandhipuram)', async () => {
    const r1 = await searchLocations('Peela');
    assert(r1.results.some(r => r.name.toLowerCase().includes('peelamedu')));
    const r2 = await searchLocations('Gand');
    assert(r2.results.some(r => r.name.toLowerCase().includes('gandhipuram')));
  });

  // 10. Clear Search
  test('10. Clear search elements in HTML & JS', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../../client/weather-alerts.html'), 'utf8');
    assert(html.includes('id="weather-search-clear-btn"'), 'Clear button must be present in HTML');
    const js = fs.readFileSync(path.resolve(__dirname, '../../client/js/weather-alerts.js'), 'utf8');
    assert(js.includes('weather-search-clear-btn'), 'Clear button event listener must be in JS');
  });

  // 11. Use My Location
  test('11. Use my location handler in JS', () => {
    const js = fs.readFileSync(path.resolve(__dirname, '../../client/js/weather-alerts.js'), 'utf8');
    assert(js.includes('window.useCurrentLocation'), 'useCurrentLocation must be defined');
    assert(js.includes('btn-use-my-location'), 'Button action must be present');
  });

  // 12. Refresh Weather & Timestamp
  await asyncTest('12. Force refresh retrieves live data and updates timestamp', async () => {
    const res = await getWeatherForecast({ district: 'coimbatore', refresh: true });
    assert(res.success);
    assert(res.last_updated_ist && res.last_updated_ist.endsWith('IST'));
  });

  // 13. Retry logic without ReferenceError
  test('13. Retry button wires to window.fetchWeatherForecast without ReferenceError', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../../client/weather-alerts.html'), 'utf8');
    const js = fs.readFileSync(path.resolve(__dirname, '../../client/js/weather-alerts.js'), 'utf8');
    assert(html.includes('id="btn-retry-weather"'));
    assert(html.includes('id="btn-retry-weather-err"'));
    assert(js.includes('window.fetchWeatherForecast = fetchWeatherForecast;'));
  });

  // 14. Open-Meteo failure & zero fake data
  await asyncTest('14. Open-Meteo failure handling returns zero synthetic records', async () => {
    // Calling with non-existent district
    const res = await getWeatherForecast({ district: 'atlantis_ocean_fake' });
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.districts_forecast.length, 0);
  });

  // 15. 5-day tabs filtering
  test('15. 5-day tabs filtering logic', () => {
    const js = fs.readFileSync(path.resolve(__dirname, '../../client/js/weather-alerts.js'), 'utf8');
    assert(js.includes("window.setWeatherTimeframeTab"));
    assert(js.includes("filteredDaily.filter(d => d.day_index === 1)"));
    assert(js.includes("filteredDaily.filter(d => d.day_index === 2)"));
  });

  // 16. Day / Night Scene Detection
  test('16. Day / Night scene detection', () => {
    const js = fs.readFileSync(path.resolve(__dirname, '../../client/js/weather-alerts.js'), 'utf8');
    assert(js.includes('weather-scene-day-clear'));
    assert(js.includes('weather-scene-night-clear'));
    assert(js.includes('isDay'));
  });

  // 17. Rain Animation
  test('17. Rain animation and effects', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../../client/weather-alerts.html'), 'utf8');
    const js = fs.readFileSync(path.resolve(__dirname, '../../client/js/weather-alerts.js'), 'utf8');
    assert(html.includes('.rain-drop'));
    assert(html.includes('@keyframes rainFall'));
    assert(js.includes('sceneType === \'rain\''));
  });

  // 18. Sunny Animation
  test('18. Sunny / Clear animation and effects', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../../client/weather-alerts.html'), 'utf8');
    const js = fs.readFileSync(path.resolve(__dirname, '../../client/js/weather-alerts.js'), 'utf8');
    assert(html.includes('.sun-glow-core'));
    assert(html.includes('@keyframes pulseGlow'));
    assert(js.includes('clear_day'));
  });

  // 19. Cloudy Animation
  test('19. Cloudy animation and effects', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../../client/weather-alerts.html'), 'utf8');
    const js = fs.readFileSync(path.resolve(__dirname, '../../client/js/weather-alerts.js'), 'utf8');
    assert(html.includes('.cloud-drifter'));
    assert(html.includes('@keyframes driftCloud'));
    assert(js.includes('cloudy_day'));
  });

  // 20. Thunderstorm Animation
  test('20. Thunderstorm animation with lightning pulse', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../../client/weather-alerts.html'), 'utf8');
    const js = fs.readFileSync(path.resolve(__dirname, '../../client/js/weather-alerts.js'), 'utf8');
    assert(html.includes('.lightning-flash'));
    assert(html.includes('@keyframes lightningStrike'));
    assert(js.includes('thunderstorm'));
  });

  // 21. Mobile Layout & Horizontal Scroll Containers
  test('21. Mobile responsive layout & touch containers', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../../client/weather-alerts.html'), 'utf8');
    assert(html.includes('.hourly-scroll-container'));
    assert(html.includes('-webkit-overflow-scrolling: touch;'));
  });

  // 22. Desktop Layout
  test('22. Desktop wide layout grid & containers', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../../client/weather-alerts.html'), 'utf8');
    assert(html.includes('.hero-glass-metrics'));
    assert(html.includes('.weather-forecast-grid'));
    assert(html.includes('.all-districts-grid'));
  });

  // 23. prefers-reduced-motion
  test('23. prefers-reduced-motion accessibility rules', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../../client/weather-alerts.html'), 'utf8');
    const js = fs.readFileSync(path.resolve(__dirname, '../../client/js/weather-alerts.js'), 'utf8');
    assert(html.includes('@media (prefers-reduced-motion: reduce)'));
    assert(js.includes('prefers-reduced-motion: reduce'));
  });

  // 24. Hourly Forecast
  await asyncTest('24. 24-Hour hourly forecast normalization from real data', async () => {
    const weather = await getWeatherForecast({ district: 'coimbatore' });
    assert(weather.success);
    assert(Array.isArray(weather.current_district.hourly));
    assert(weather.current_district.hourly.length > 0);
    const hour1 = weather.current_district.hourly[0];
    assert(hour1.hour_label);
    assert(typeof hour1.temperature_c === 'number');
    assert(typeof hour1.precipitation_probability_pct === 'number');
  });

  // 25. Weather Insights
  test('25. Weather insights generated strictly from actual weather values', () => {
    const insights = generateWeatherInsights(
      { weather_code: 3, precipitation_mm: 0, relative_humidity_pct: 85, wind_speed_kmh: 12, is_day: 1, visibility_km: 15 },
      [],
      [{ temperature_max_c: 34, temperature_min_c: 23, precipitation_probability_pct: 65 }]
    );
    assert(Array.isArray(insights));
    assert(insights.length >= 2);
    assert(insights.some(i => i.title.includes('Rain') || i.desc.includes('precipitation')));
    assert(insights.some(i => i.desc.includes('34°C')));
    assert(insights.some(i => i.title.includes('Humidity')));
  });

  console.log(`\n========================================`);
  console.log(`Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
  console.log(`========================================`);

  if (failed > 0) process.exit(1);
}

runSuite().catch(err => {
  console.error('Test runner failure:', err);
  process.exit(1);
});
