/**
 * weather_forecast_test.js
 * 
 * Comprehensive Automated Test Suite for Open-Meteo Weather Forecast.
 * Tests all 20 required criteria across backend service, normalization,
 * WMO code mapping, 38 TN districts, caching, and error resilience.
 */

import assert from 'node:assert';
import { 
  getWeatherForecast, 
  getWMOInterpretation, 
  WMO_WEATHER_CODES, 
  setMockFixtures, 
  clearCache, 
  getCurrentISTTimestamp, 
  normalizeDistrictForecast,
  OPEN_METEO_SOURCE
} from '../services/weatherService.js';
import { TN_DISTRICTS, getDistrictById } from '../config/districtsConfig.js';

let passed = 0;
let failed = 0;

function report(testNum, testName, isOk, errorMsg = '') {
  if (isOk) {
    passed++;
    console.log(`Test ${testNum}: ${testName}\n   ✓ Passed`);
  } else {
    failed++;
    console.error(`Test ${testNum}: ${testName}\n   ✗ FAILED: ${errorMsg}`);
  }
}

// Sample Open-Meteo valid response fixture for Chennai
const mockChennaiRaw = {
  current: {
    time: '2026-09-11T18:15',
    temperature_2m: 29.4,
    relative_humidity_2m: 84,
    apparent_temperature: 36.0,
    precipitation: 0.0,
    rain: 0.0,
    showers: 0.0,
    weather_code: 3,
    wind_speed_10m: 7.8,
    wind_gusts_10m: 16.6
  },
  daily: {
    time: ['2026-09-11', '2026-09-12', '2026-09-13', '2026-09-14', '2026-09-15'],
    weather_code: [81, 3, 95, 95, 51],
    temperature_2m_max: [33.5, 33.6, 31.6, 30.8, 31.0],
    temperature_2m_min: [25.1, 25.6, 26.4, 26.0, 24.5],
    apparent_temperature_max: [40.4, 40.6, 39.7, 39.6, 38.9],
    apparent_temperature_min: [29.4, 29.4, 31.6, 32.2, 29.1],
    precipitation_sum: [11.4, 0.0, 4.6, 5.1, 0.2],
    rain_sum: [4.4, 0.0, 1.5, 1.6, 0.2],
    precipitation_probability_max: [100, 37, 51, 59, 55],
    wind_speed_10m_max: [13.2, 16.4, 13.5, 10.5, 11.9],
    wind_gusts_10m_max: [27.0, 36.4, 32.8, 28.4, 32.0],
    sunrise: ['2026-09-11T05:58', '2026-09-12T05:58', '2026-09-13T05:58', '2026-09-14T05:58', '2026-09-15T05:58'],
    sunset: ['2026-09-11T18:13', '2026-09-12T18:12', '2026-09-13T18:11', '2026-09-14T18:11', '2026-09-15T18:10']
  }
};

async function runTests() {
  console.log('\n🧪 Starting Open-Meteo Weather Forecast Test Suite (20 Tests)...\n');

  // Test 1: Open-Meteo successful response parsing
  try {
    clearCache();
    setMockFixtures(TN_DISTRICTS.map(() => mockChennaiRaw));
    const result = await getWeatherForecast({ refresh: true });
    report(1, 'Open-Meteo successful response parsing', 
      result.success === true && result.source_available === true && result.total_districts === 38
    );
  } catch (err) {
    report(1, 'Open-Meteo successful response parsing', false, err.message);
  }

  // Test 2: Current weather normalization
  try {
    const chennaiDistrict = TN_DISTRICTS.find(d => d.id === 'chennai');
    const norm = normalizeDistrictForecast(chennaiDistrict, mockChennaiRaw);
    report(2, 'Current weather normalization',
      norm.current.temperature_c === 29.4 &&
      norm.current.apparent_temperature_c === 36.0 &&
      norm.current.relative_humidity_pct === 84 &&
      norm.current.condition === 'Overcast' &&
      norm.current.icon_class === 'fa-cloud' &&
      norm.current.wind_speed_kmh === 7.8
    );
  } catch (err) {
    report(2, 'Current weather normalization', false, err.message);
  }

  // Test 3: Daily forecast normalization (5 days)
  try {
    const chennaiDistrict = TN_DISTRICTS.find(d => d.id === 'chennai');
    const norm = normalizeDistrictForecast(chennaiDistrict, mockChennaiRaw);
    report(3, 'Daily forecast normalization (5 days)',
      Array.isArray(norm.daily) && norm.daily.length === 5 &&
      norm.daily[0].day_label === 'Today' &&
      norm.daily[1].day_label === 'Tomorrow' &&
      norm.daily[4].day_label === 'Day 5'
    );
  } catch (err) {
    report(3, 'Daily forecast normalization (5 days)', false, err.message);
  }

  // Test 4: WMO weather code mapping
  try {
    const c0 = getWMOInterpretation(0);
    const c3 = getWMOInterpretation(3);
    const c65 = getWMOInterpretation(65);
    const c95 = getWMOInterpretation(95);
    report(4, 'WMO weather code mapping',
      c0.label === 'Clear sky' &&
      c3.label === 'Overcast' &&
      c65.label === 'Heavy rain' &&
      c95.label === 'Thunderstorm' &&
      c0.icon === 'fa-sun'
    );
  } catch (err) {
    report(4, 'WMO weather code mapping', false, err.message);
  }

  // Test 5: Temperature conversion and numerical integrity
  try {
    const chennaiDistrict = TN_DISTRICTS.find(d => d.id === 'chennai');
    const norm = normalizeDistrictForecast(chennaiDistrict, mockChennaiRaw);
    report(5, 'Temperature conversion / numbers',
      typeof norm.current.temperature_c === 'number' &&
      typeof norm.daily[0].temperature_max_c === 'number' &&
      norm.daily[0].temperature_max_c === 33.5 &&
      norm.daily[0].temperature_min_c === 25.1
    );
  } catch (err) {
    report(5, 'Temperature conversion / numbers', false, err.message);
  }

  // Test 6: Rainfall values (mm)
  try {
    const chennaiDistrict = TN_DISTRICTS.find(d => d.id === 'chennai');
    const norm = normalizeDistrictForecast(chennaiDistrict, mockChennaiRaw);
    report(6, 'Rainfall values (mm)',
      norm.daily[0].precipitation_sum_mm === 11.4 &&
      norm.daily[0].rain_sum_mm === 4.4 &&
      norm.current.precipitation_mm === 0
    );
  } catch (err) {
    report(6, 'Rainfall values (mm)', false, err.message);
  }

  // Test 7: Precipitation probability (%)
  try {
    const chennaiDistrict = TN_DISTRICTS.find(d => d.id === 'chennai');
    const norm = normalizeDistrictForecast(chennaiDistrict, mockChennaiRaw);
    report(7, 'Precipitation probability (%)',
      norm.daily[0].precipitation_probability_pct === 100 &&
      norm.daily[1].precipitation_probability_pct === 37
    );
  } catch (err) {
    report(7, 'Precipitation probability (%)', false, err.message);
  }

  // Test 8: Wind values (km/h)
  try {
    const chennaiDistrict = TN_DISTRICTS.find(d => d.id === 'chennai');
    const norm = normalizeDistrictForecast(chennaiDistrict, mockChennaiRaw);
    report(8, 'Wind values (km/h)',
      norm.current.wind_speed_kmh === 7.8 &&
      norm.current.wind_gusts_kmh === 16.6 &&
      norm.daily[0].wind_speed_max_kmh === 13.2
    );
  } catch (err) {
    report(8, 'Wind values (km/h)', false, err.message);
  }

  // Test 9: Asia/Kolkata timezone format
  try {
    const ts = getCurrentISTTimestamp();
    report(9, 'Asia/Kolkata timezone format',
      ts.endsWith('IST') && !ts.includes('UTC')
    );
  } catch (err) {
    report(9, 'Asia/Kolkata timezone format', false, err.message);
  }

  // Test 10: 38 Tamil Nadu districts verification
  try {
    const count = TN_DISTRICTS.length;
    const allHaveCentroids = TN_DISTRICTS.every(d => typeof d.lat === 'number' && typeof d.lng === 'number');
    report(10, '38 Tamil Nadu districts verification',
      count === 38 && allHaveCentroids
    );
  } catch (err) {
    report(10, '38 Tamil Nadu districts verification', false, err.message);
  }

  // Test 11: District coordinate lookup from master data
  try {
    const cbe = getDistrictById('coimbatore');
    const chn = getDistrictById('chennai');
    report(11, 'District coordinate lookup from master data',
      cbe && cbe.lat === 11.0168 && cbe.lng === 76.9558 &&
      chn && chn.lat === 13.0827 && chn.lng === 80.2707
    );
  } catch (err) {
    report(11, 'District coordinate lookup from master data', false, err.message);
  }

  // Test 12: Invalid district handling
  try {
    const result = await getWeatherForecast({ district: 'nonexistent-district' });
    report(12, 'Invalid district handling',
      result.success === false && result.error.includes('not found')
    );
  } catch (err) {
    report(12, 'Invalid district handling', false, err.message);
  }

  // Test 13: Missing coordinates handling
  try {
    const fakeDist = { id: 'missing', name: 'Missing' };
    const norm = normalizeDistrictForecast(fakeDist, null);
    report(13, 'Missing coordinates / null forecast handling',
      norm === null
    );
  } catch (err) {
    report(13, 'Missing coordinates / null forecast handling', false, err.message);
  }

  // Test 14: Open-Meteo API timeout handling
  try {
    clearCache();
    setMockFixtures(() => new Promise((_, reject) => {
      const err = new Error('The operation was aborted due to timeout');
      err.name = 'AbortError';
      reject(err);
    }));
    const result = await getWeatherForecast({ refresh: true });
    report(14, 'Open-Meteo API timeout handling',
      result.success === false && result.source_available === false && result.districts_forecast.length === 0
    );
  } catch (err) {
    report(14, 'Open-Meteo API timeout handling', false, err.message);
  }

  // Test 15: Open-Meteo API failure handling (503 / 500)
  try {
    clearCache();
    setMockFixtures(() => {
      throw new Error('503 Service Unavailable');
    });
    const result = await getWeatherForecast({ refresh: true });
    report(15, 'Open-Meteo API failure handling',
      result.success === false && result.source_available === false && result.districts_forecast.length === 0
    );
  } catch (err) {
    report(15, 'Open-Meteo API failure handling', false, err.message);
  }

  // Test 16: Cache hit verification
  try {
    clearCache();
    let fetchCount = 0;
    setMockFixtures(() => {
      fetchCount++;
      return TN_DISTRICTS.map(() => mockChennaiRaw);
    });

    await getWeatherForecast();
    const countAfterFirst = fetchCount;
    await getWeatherForecast();
    const countAfterSecond = fetchCount;

    report(16, '15-minute cache hit verification',
      countAfterFirst === 1 && countAfterSecond === 1
    );
  } catch (err) {
    report(16, '15-minute cache hit verification', false, err.message);
  }

  // Test 17: Cache expiry / forced refresh verification
  try {
    let fetchCount = 0;
    setMockFixtures(() => {
      fetchCount++;
      return TN_DISTRICTS.map(() => mockChennaiRaw);
    });

    await getWeatherForecast({ refresh: true });
    report(17, 'Forced refresh verification',
      fetchCount === 1
    );
  } catch (err) {
    report(17, 'Forced refresh verification', false, err.message);
  }

  // Test 18: Malformed API response handling
  try {
    clearCache();
    setMockFixtures(() => ({ corrupted: true }));
    const result = await getWeatherForecast({ refresh: true });
    report(18, 'Malformed API response handling',
      result.total_districts === 0 || (result.current_district && result.current_district.current.temperature_c === null)
    );
  } catch (err) {
    report(18, 'Malformed API response handling', false, err.message);
  }

  // Test 19: No fake fallback data verification
  try {
    clearCache();
    setMockFixtures(() => {
      throw new Error('Connection refused');
    });
    const result = await getWeatherForecast({ refresh: true });
    report(19, 'Zero dummy data on unavailable source',
      result.success === false && result.districts_forecast.length === 0
    );
  } catch (err) {
    report(19, 'Zero dummy data on unavailable source', false, err.message);
  }

  // Test 20: Mobile / API response compatibility
  try {
    clearCache();
    setMockFixtures(TN_DISTRICTS.map(() => mockChennaiRaw));
    const result = await getWeatherForecast({ district: 'coimbatore' });
    report(20, 'API response compatibility',
      result.success === true &&
      result.source.name === 'Open-Meteo' &&
      result.current_district &&
      result.current_district.current &&
      Array.isArray(result.current_district.daily)
    );
  } catch (err) {
    report(20, 'API response compatibility', false, err.message);
  }

  // Reset fixtures back to null for live usage
  setMockFixtures(null);
  clearCache();

  console.log('\n========================================');
  console.log(`Total: 20 | Passed: ${passed} | Failed: ${failed}`);
  console.log('========================================');

  if (failed === 0) {
    console.log('All 20 Open-Meteo Weather Forecast tests passed successfully! ✨\n');
    process.exit(0);
  } else {
    console.error(`Tests failed with ${failed} errors.`);
    process.exit(1);
  }
}

runTests();
