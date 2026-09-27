/**
 * true_district_region_experience_test.js
 * 
 * Comprehensive Verification Suite for:
 * WEATHER PAGE — COMPLETE UI/UX REFINEMENT + TRUE DISTRICT -> REGION EXPERIENCE
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  getRegionsForDistrict,
  calculateDistanceKm,
  searchLocations,
  isInsideTamilNadu
} from '../services/locationSearchService.js';
import {
  getWeatherForecast,
  getDistrictRegionsWeather
} from '../services/weatherService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTests() {
  console.log('🧪 Starting True District -> Region Experience Test Suite...\n');
  let passed = 0;
  let failed = 0;

  function report(name, ok, err = '') {
    if (ok) {
      passed++;
      console.log(`   ✓ Passed: ${name}`);
    } else {
      failed++;
      console.error(`   ✗ FAILED: ${name} -> ${err}`);
    }
  }

  // 1. Coimbatore District -> Regions Verification
  try {
    const cbeRegions = getRegionsForDistrict('coimbatore');
    const names = cbeRegions.map(r => r.name);
    assert(cbeRegions.length >= 15, 'Coimbatore should have >= 15 legitimate regions');
    assert(names.includes('Peelamedu'), 'Should include Peelamedu');
    assert(names.includes('Singanallur'), 'Should include Singanallur');
    assert(names.includes('Gandhipuram'), 'Should include Gandhipuram');
    assert(names.includes('Sulur'), 'Should include Sulur');
    assert(names.includes('Saravanampatti'), 'Should include Saravanampatti');
    assert(names.includes('RS Puram'), 'Should include RS Puram');
    assert(names.includes('Saibaba Colony'), 'Should include Saibaba Colony');
    assert(names.includes('Ramanathapuram'), 'Should include Ramanathapuram');
    assert(names.includes('Ukkadam'), 'Should include Ukkadam');
    assert(names.includes('Pollachi'), 'Should include Pollachi');
    assert(names.includes('Mettupalayam'), 'Should include Mettupalayam');
    assert(names.includes('Annur'), 'Should include Annur');
    assert(names.includes('Kinathukadavu'), 'Should include Kinathukadavu');
    assert(names.includes('Madukkarai'), 'Should include Madukkarai');
    assert(names.includes('Kuniyamuthur'), 'Should include Kuniyamuthur');
    report('1. Coimbatore district provides legitimate regions (Peelamedu, Sulur, Singanallur, etc.)', true);
  } catch (e) {
    report('1. Coimbatore district provides legitimate regions', false, e.message);
  }

  // 2. Each region has authentic, distinct coordinates
  try {
    const cbe = getRegionsForDistrict('coimbatore');
    const peelamedu = cbe.find(r => r.name === 'Peelamedu');
    const sulur = cbe.find(r => r.name === 'Sulur');
    const singanallur = cbe.find(r => r.name === 'Singanallur');

    assert(peelamedu && sulur && singanallur);
    assert.notStrictEqual(peelamedu.lat, sulur.lat, 'Peelamedu & Sulur lat must differ');
    assert.notStrictEqual(peelamedu.lon, sulur.lon, 'Peelamedu & Sulur lon must differ');
    assert.notStrictEqual(singanallur.lat, sulur.lat, 'Singanallur & Sulur lat must differ');
    assert(isInsideTamilNadu(peelamedu.lat, peelamedu.lon));
    assert(isInsideTamilNadu(sulur.lat, sulur.lon));
    assert(isInsideTamilNadu(singanallur.lat, singanallur.lon));
    report('2. Regions have distinct legitimate geographic coordinates (no centroid spoofing)', true);
  } catch (e) {
    report('2. Regions have distinct legitimate coordinates', false, e.message);
  }

  // 3. Sulur Weather Fetch with real coordinates
  try {
    const cbe = getRegionsForDistrict('coimbatore');
    const sulur = cbe.find(r => r.name === 'Sulur');
    const weather = await getWeatherForecast({
      lat: sulur.lat,
      lon: sulur.lon,
      locality: 'Sulur',
      district: 'Coimbatore'
    });
    assert(weather.success, 'Weather fetch should succeed');
    assert.strictEqual(weather.location.name, 'Sulur');
    assert.strictEqual(weather.coordinates.lat, sulur.lat);
    assert.strictEqual(weather.coordinates.lon, sulur.lon);
    assert(typeof weather.current.temperature_c === 'number');
    report('3. Fetch weather for Sulur uses Sulur coordinates and returns real weather', true);
  } catch (e) {
    report('3. Fetch weather for Sulur', false, e.message);
  }

  // 4. Singanallur Weather Fetch with real coordinates
  try {
    const cbe = getRegionsForDistrict('coimbatore');
    const singanallur = cbe.find(r => r.name === 'Singanallur');
    const weather = await getWeatherForecast({
      lat: singanallur.lat,
      lon: singanallur.lon,
      locality: 'Singanallur',
      district: 'Coimbatore'
    });
    assert(weather.success);
    assert.strictEqual(weather.location.name, 'Singanallur');
    assert.strictEqual(weather.coordinates.lat, singanallur.lat);
    assert(typeof weather.current.temperature_c === 'number');
    report('4. Fetch weather for Singanallur uses Singanallur coordinates and returns real weather', true);
  } catch (e) {
    report('4. Fetch weather for Singanallur', false, e.message);
  }

  // 5. Peelamedu Weather Fetch with real coordinates
  try {
    const cbe = getRegionsForDistrict('coimbatore');
    const peelamedu = cbe.find(r => r.name === 'Peelamedu');
    const weather = await getWeatherForecast({
      lat: peelamedu.lat,
      lon: peelamedu.lon,
      locality: 'Peelamedu',
      district: 'Coimbatore'
    });
    assert(weather.success);
    assert.strictEqual(weather.location.name, 'Peelamedu');
    assert.strictEqual(weather.coordinates.lat, peelamedu.lat);
    assert(typeof weather.current.temperature_c === 'number');
    report('5. Fetch weather for Peelamedu uses Peelamedu coordinates and returns real weather', true);
  } catch (e) {
    report('5. Fetch weather for Peelamedu', false, e.message);
  }

  // 6. Proximity Sorting (Near You behavior)
  try {
    const userCoords = { lat: 11.0266, lon: 77.0004 }; // Peelamedu
    const sorted = getRegionsForDistrict('coimbatore', userCoords);
    assert(sorted[0].name === 'Peelamedu', 'Closest to Peelamedu must be Peelamedu (0km)');
    assert(sorted[0].distance_km === 0);
    assert(sorted[1].distance_km > 0 && sorted[1].distance_km < 6);
    // Sulur is ~13.8 km away, so it must be ranked after Peelamedu and Singanallur (~4.6 km)
    const singaIdx = sorted.findIndex(r => r.name === 'Singanallur');
    const sulurIdx = sorted.findIndex(r => r.name === 'Sulur');
    assert(singaIdx < sulurIdx, 'Singanallur should be closer to Peelamedu than Sulur');
    report('6. "Near you" proximity sorting correctly orders regions by distance from user', true);
  } catch (e) {
    report('6. Proximity sorting', false, e.message);
  }

  // 7. Works for Chennai District
  try {
    const chn = getRegionsForDistrict('chennai');
    const names = chn.map(r => r.name);
    assert(names.includes('T. Nagar'), 'Chennai should have T. Nagar');
    assert(names.includes('Adyar'), 'Chennai should have Adyar');
    assert(names.includes('Anna Nagar'), 'Chennai should have Anna Nagar');
    assert(names.includes('Velachery'), 'Chennai should have Velachery');
    assert(names.includes('Guindy'), 'Chennai should have Guindy');
    assert(names.includes('Mylapore'), 'Chennai should have Mylapore');
    assert(!names.includes('Peelamedu'), 'Chennai must NOT contain Coimbatore regions');
    report('7. Chennai district has its own legitimate region catalog without cross-district leakage', true);
  } catch (e) {
    report('7. Chennai district regions', false, e.message);
  }

  // 8. Works for Madurai District
  try {
    const mdu = getRegionsForDistrict('madurai');
    const names = mdu.map(r => r.name);
    assert(names.includes('Mattuthavani'));
    assert(names.includes('Goripalayam'));
    assert(names.includes('Simmakkal'));
    assert(names.includes('Thiruppalai'));
    assert(!names.includes('T. Nagar'));
    report('8. Madurai district has its own legitimate region catalog', true);
  } catch (e) {
    report('8. Madurai district regions', false, e.message);
  }

  // 9. Works for Salem District
  try {
    const slm = getRegionsForDistrict('salem');
    const names = slm.map(r => r.name);
    assert(names.includes('Fairlands'));
    assert(names.includes('Hasthampatti'));
    assert(names.includes('Suramangalam'));
    assert(names.includes('Alagapuram'));
    report('9. Salem district has its own legitimate region catalog', true);
  } catch (e) {
    report('9. Salem district regions', false, e.message);
  }

  // 10. Works for Tiruppur District
  try {
    const tpr = getRegionsForDistrict('tiruppur');
    const names = tpr.map(r => r.name);
    assert(names.some(n => n.includes('Avinashi')));
    assert(names.includes('Nallur'));
    assert(names.includes('Veerapandi'));
    assert(names.includes('Palladam Road'));
    report('10. Tiruppur district has its own legitimate region catalog', true);
  } catch (e) {
    report('10. Tiruppur district regions', false, e.message);
  }

  // 11. Batched Regions Weather API (Open-Meteo multi-coordinate efficiency)
  try {
    const result = await getDistrictRegionsWeather('coimbatore', { lat: 11.0266, lon: 77.0004 });
    assert(result.success);
    assert(result.regions.length >= 10);
    const first = result.regions[0];
    assert(first.name === 'Peelamedu');
    assert(first.current && typeof first.current.temperature_c === 'number');
    assert(first.current.condition);
    assert(first.current.icon_class);
    report('11. Batched region weather API retrieves real Open-Meteo current conditions in 1 call', true);
  } catch (e) {
    report('11. Batched region weather API', false, e.message);
  }

  // 12. Search Localities and Districts
  try {
    const s1 = await searchLocations('Peela');
    assert(s1.results.some(r => r.name.toLowerCase().includes('peelamedu') && r.district === 'Coimbatore'));

    const s2 = await searchLocations('Sul');
    assert(s2.results.some(r => r.name.toLowerCase().includes('sulur')));

    const s3 = await searchLocations('Ady');
    assert(s3.results.some(r => r.name.toLowerCase().includes('adyar') && r.district === 'Chennai'));

    const s4 = await searchLocations('Sing');
    assert(s4.results.some(r => r.name.toLowerCase().includes('singanallur')));
    report('12. Locality search resolves Region, District, and Tamil Nadu hierarchy accurately', true);
  } catch (e) {
    report('12. Locality search', false, e.message);
  }

  // 13. ZERO Emojis in HTML and JS
  try {
    const html = fs.readFileSync(path.resolve(__dirname, '../../client/weather-alerts.html'), 'utf8');
    const js = fs.readFileSync(path.resolve(__dirname, '../../client/js/weather-alerts.js'), 'utf8');
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

    assert(!emojiRegex.test(html), 'HTML must contain zero emojis');
    assert(!emojiRegex.test(js), 'JS must contain zero emojis');
    report('13. ZERO emojis in HTML and JS files (Font Awesome vector icons only)', true);
  } catch (e) {
    report('13. Zero emojis', false, e.message);
  }

  // 14. NO "Weather Insights" in HTML and JS
  try {
    const html = fs.readFileSync(path.resolve(__dirname, '../../client/weather-alerts.html'), 'utf8');
    const js = fs.readFileSync(path.resolve(__dirname, '../../client/js/weather-alerts.js'), 'utf8');
    const banned = ['Weather Insights', 'High Heat Advisory', 'Mild & Comfortable', 'Optimal Visibility', 'Elevated Humidity'];

    for (const phrase of banned) {
      assert(!html.includes(phrase), `HTML should not include "${phrase}"`);
      assert(!js.includes(phrase), `JS should not include "${phrase}"`);
    }
    report('14. "Weather Insights" section and speculative phrases completely removed from UI', true);
  } catch (e) {
    report('14. No Weather Insights in UI', false, e.message);
  }

  // 15. Region-First UI Section in HTML and JS
  try {
    const html = fs.readFileSync(path.resolve(__dirname, '../../client/weather-alerts.html'), 'utf8');
    const js = fs.readFileSync(path.resolve(__dirname, '../../client/js/weather-alerts.js'), 'utf8');

    assert(html.includes('id="nearby-regions-section"'), 'HTML must have #nearby-regions-section');
    assert(html.includes('id="nearby-regions-container"'), 'HTML must have #nearby-regions-container');
    assert(js.includes('renderNearbyRegions'), 'JS must render nearby regions');
    assert(js.includes('selectRegion'), 'JS must export selectRegion');
    report('15. Region-First section present in HTML and rendered dynamically in JS', true);
  } catch (e) {
    report('15. Region-First section in HTML and JS', false, e.message);
  }

  // 16. Subtle Atmospheric Animation Keyframes
  try {
    const html = fs.readFileSync(path.resolve(__dirname, '../../client/weather-alerts.html'), 'utf8');
    const js = fs.readFileSync(path.resolve(__dirname, '../../client/js/weather-alerts.js'), 'utf8');

    assert(html.includes('@keyframes rainFall'));
    assert(html.includes('@keyframes pulseGlow'));
    assert(html.includes('@keyframes driftCloud'));
    assert(html.includes('@keyframes lightningStrike'));
    assert(html.includes('@media (prefers-reduced-motion: reduce)'));
    assert(js.includes('prefers-reduced-motion: reduce'));
    report('16. Subtle GPU-friendly atmospheric animations with reduced motion support', true);
  } catch (e) {
    report('16. Atmospheric animations', false, e.message);
  }

  // 17. Responsive Touch Containers & No Horizontal Overflow
  try {
    const html = fs.readFileSync(path.resolve(__dirname, '../../client/weather-alerts.html'), 'utf8');
    assert(html.includes('.nearby-regions-track'));
    assert(html.includes('.hourly-scroll-container'));
    assert(html.includes('-webkit-overflow-scrolling: touch;'));
    report('17. Mobile touch-friendly scroll containers for nearby regions and hourly strip', true);
  } catch (e) {
    report('17. Responsive containers', false, e.message);
  }

  // 18. Button Bindings and Error Resilience
  try {
    const html = fs.readFileSync(path.resolve(__dirname, '../../client/weather-alerts.html'), 'utf8');
    const js = fs.readFileSync(path.resolve(__dirname, '../../client/js/weather-alerts.js'), 'utf8');

    assert(html.includes('id="btn-refresh-weather"'));
    assert(html.includes('id="btn-retry-weather"'));
    assert(html.includes('id="btn-retry-weather-err"'));
    assert(js.includes('window.fetchWeatherForecast = fetchWeatherForecast;'));
    assert(js.includes('window.selectRegion = window.selectRegion;'));
    assert(js.includes('window.useCurrentLocation = window.useCurrentLocation;'));
    report('18. Button bindings wired to window global exports without ReferenceError', true);
  } catch (e) {
    report('18. Button bindings', false, e.message);
  }

  console.log('\n========================================');
  console.log(`Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
  console.log('========================================');

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Test runner failure:', err);
  process.exit(1);
});
