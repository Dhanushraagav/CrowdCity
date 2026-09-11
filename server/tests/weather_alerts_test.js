/**
 * weather_alerts_test.js
 * 
 * Test suite for CrowdCity Public Pulse Official IMD Weather Alerts module.
 * Covers all 20 specified criteria.
 */

import {
  fetchOfficialImdData,
  getWeatherAlerts,
  normalizeImdResponse,
  matchTamilNaduDistrict,
  mapWarningCode,
  mapSeverityCode,
  setMockFixtures,
  clearCache,
  getCurrentIST,
  IMD_WARNING_CODES,
  IMD_SEVERITY_CODES,
  IMD_OFFICIAL_SOURCE
} from '../services/weatherAlertService.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`   ✓ ${message}`);
    passed++;
  } else {
    console.error(`   ✗ FAILED: ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('🧪 Starting Official IMD Weather Alerts Test Suite (20 Tests)...\n');

  // Sample official IMD test fixture for Tamil Nadu districts
  const sampleImdValidResponse = [
    {
      id: 'tn-01',
      district: 'Chennai',
      issue_date: '2026-09-11',
      issue_time: '16:00 IST',
      day1_warning: 2,  // Heavy Rain
      day1_color: 2,    // Alert
      day2_warning: 16, // Very Heavy Rain
      day2_color: 1,    // Warning
      day3_warning: 4,  // Thunderstorm
      day3_color: 3,    // Watch
      day4_warning: 1,  // No Warning
      day4_color: 4,    // No Warning
      day5_warning: 1,
      day5_color: 4
    },
    {
      id: 'tn-02',
      district: 'Coimbatore',
      issue_date: '2026-09-11',
      issue_time: '16:00 IST',
      day1_warning: 8,  // Strong Surface Winds
      day1_color: 3,    // Watch
      day2_warning: 17, // Extremely Heavy Rain
      day2_color: 1,    // Warning
      day3_warning: 9,  // Heat Wave
      day3_color: 2,    // Alert
      day4_warning: 1,
      day4_color: 4,
      day5_warning: 1,
      day5_color: 4
    },
    {
      id: 'non-tn-01',
      district: 'Bengaluru Urban', // Non-Tamil Nadu
      issue_date: '2026-09-11',
      issue_time: '16:00 IST',
      day1_warning: 2,
      day1_color: 2
    },
    {
      id: 'non-tn-02',
      district: 'Mumbai Suburban', // Non-Tamil Nadu
      issue_date: '2026-09-11',
      issue_time: '16:00 IST',
      day1_warning: 17,
      day1_color: 1
    }
  ];

  // Test 1: Valid IMD response
  console.log('Test 1: Parse and normalize valid IMD response');
  clearCache();
  setMockFixtures(sampleImdValidResponse);
  const res1 = await fetchOfficialImdData({ forceRefresh: true });
  assert(res1.alerts && res1.alerts.length > 0, 'Successfully parsed valid IMD alerts');
  assert(res1.sourceAvailable === true, 'Source is marked available');

  // Test 2: Invalid IMD response
  console.log('\nTest 2: Handle malformed / invalid IMD response');
  clearCache();
  setMockFixtures('MALFORMED_NON_JSON_STRING_DATA');
  const res2 = await fetchOfficialImdData({ forceRefresh: true });
  assert(Array.isArray(res2.alerts) && res2.alerts.length === 0, 'Gracefully returns empty array for malformed data without throwing');

  // Test 3: Empty response
  console.log('\nTest 3: Handle empty IMD response');
  clearCache();
  setMockFixtures([]);
  const res3 = await fetchOfficialImdData({ forceRefresh: true });
  assert(Array.isArray(res3.alerts) && res3.alerts.length === 0, 'Gracefully handles empty array');

  // Test 4: API timeout handling
  console.log('\nTest 4: Handle API timeout');
  clearCache();
  setMockFixtures(async () => {
    const err = new Error('The operation was aborted due to timeout');
    err.name = 'TimeoutError';
    throw err;
  });
  const res4 = await fetchOfficialImdData({ forceRefresh: true });
  assert(res4.sourceAvailable === false, 'Source correctly marked unavailable on timeout');
  assert(res4.alerts.length === 0, 'No fake data generated on timeout');

  // Test 5: API failure handling
  console.log('\nTest 5: Handle network / HTTP API failure');
  clearCache();
  setMockFixtures(async () => {
    throw new Error('Connection refused: 503 Service Unavailable');
  });
  const res5 = await fetchOfficialImdData({ forceRefresh: true });
  assert(res5.sourceAvailable === false, 'Source correctly marked unavailable on 503 error');
  assert(res5.alerts.length === 0, 'No fake data generated on failure');

  // Test 6: Cache hit verification
  console.log('\nTest 6: Verify 15-minute cache hit');
  clearCache();
  let fetchCount = 0;
  setMockFixtures(() => {
    fetchCount++;
    return sampleImdValidResponse;
  });
  await fetchOfficialImdData({ forceRefresh: true }); // Fetch 1
  assert(fetchCount === 1, 'First call fetched from mock source');
  await fetchOfficialImdData({ forceRefresh: false }); // Fetch 2 (should hit cache)
  assert(fetchCount === 1, 'Second call served from in-memory cache without refetching');

  // Test 7: Cache expiry verification
  console.log('\nTest 7: Verify cache bypass on forceRefresh');
  await fetchOfficialImdData({ forceRefresh: true }); // Force refresh
  assert(fetchCount === 2, 'Forced refresh re-evaluates source data when requested');

  // Test 8: Tamil Nadu district filtering (non-TN rejected)
  console.log('\nTest 8: Filter strictly for Tamil Nadu 38 districts');
  const normalized = normalizeImdResponse(sampleImdValidResponse);
  const districtsFound = new Set(normalized.map(a => a.district));
  assert(districtsFound.has('Chennai'), 'Includes Chennai');
  assert(districtsFound.has('Coimbatore'), 'Includes Coimbatore');
  assert(!districtsFound.has('Bengaluru Urban'), 'Bengaluru Urban strictly excluded');
  assert(!districtsFound.has('Mumbai Suburban'), 'Mumbai Suburban strictly excluded');
  assert(matchTamilNaduDistrict('Madurai') === 'Madurai', 'Validates authentic TN district');
  assert(matchTamilNaduDistrict('New Delhi') === null, 'Rejects non-TN district');

  // Test 9: Warning code 1 mapping ("No Warning")
  console.log('\nTest 9: Verify Warning Code 1');
  assert(mapWarningCode(1) === 'No Warning', 'Code 1 maps to "No Warning"');

  // Test 10: Warning code 2 mapping ("Heavy Rain")
  console.log('\nTest 10: Verify Warning Code 2');
  assert(mapWarningCode(2) === 'Heavy Rain', 'Code 2 maps to "Heavy Rain"');

  // Test 11: Warning code 4 mapping ("Thunderstorm & Lightning, Squall etc")
  console.log('\nTest 11: Verify Warning Code 4');
  assert(mapWarningCode(4) === 'Thunderstorm & Lightning, Squall etc', 'Code 4 maps to "Thunderstorm & Lightning, Squall etc"');

  // Test 12: Warning code 8 mapping ("Strong Surface Winds")
  console.log('\nTest 12: Verify Warning Code 8');
  assert(mapWarningCode(8) === 'Strong Surface Winds', 'Code 8 maps to "Strong Surface Winds"');

  // Test 13: Warning code 9 mapping ("Heat Wave")
  console.log('\nTest 13: Verify Warning Code 9');
  assert(mapWarningCode(9) === 'Heat Wave', 'Code 9 maps to "Heat Wave"');

  // Test 14: Warning code 16 mapping ("Very Heavy Rain")
  console.log('\nTest 14: Verify Warning Code 16');
  assert(mapWarningCode(16) === 'Very Heavy Rain', 'Code 16 maps to "Very Heavy Rain"');

  // Test 15: Warning code 17 mapping ("Extremely Heavy Rain")
  console.log('\nTest 15: Verify Warning Code 17');
  assert(mapWarningCode(17) === 'Extremely Heavy Rain', 'Code 17 maps to "Extremely Heavy Rain"');

  // Test 16: Severity mapping (1=Warning, 2=Alert, 3=Watch, 4=No Warning)
  console.log('\nTest 16: Verify Severity Code mapping');
  assert(mapSeverityCode(1).name === 'Warning', 'Severity 1 maps to Warning');
  assert(mapSeverityCode(2).name === 'Alert', 'Severity 2 maps to Alert');
  assert(mapSeverityCode(3).name === 'Watch', 'Severity 3 maps to Watch');
  assert(mapSeverityCode(4).name === 'No Warning', 'Severity 4 maps to No Warning');

  // Test 17: IST timestamp handling
  console.log('\nTest 17: Verify Asia/Kolkata (IST) timestamp format');
  const ist = getCurrentIST();
  assert(ist.formattedIST.endsWith('IST'), 'Timestamp explicitly ends with IST');
  assert(/^\d{4}-\d{2}-\d{2}$/.test(ist.dateStr), 'Date string is in valid YYYY-MM-DD format');

  // Test 18: Stale-data handling on subsequent failure
  console.log('\nTest 18: Verify stale cache preservation when subsequent fetch fails');
  clearCache();
  // 1st call: Successful
  setMockFixtures(sampleImdValidResponse);
  await fetchOfficialImdData({ forceRefresh: true });
  // 2nd call: Network fails
  setMockFixtures(async () => {
    throw new Error('500 Internal Server Error from remote');
  });
  const staleRes = await fetchOfficialImdData({ forceRefresh: true });
  assert(staleRes.isStale === true, 'Response is explicitly marked as stale');
  assert(staleRes.alerts && staleRes.alerts.length > 0, 'Cached alerts preserved without data loss');

  // Test 19: No fake / invented data guarantee
  console.log('\nTest 19: Verify zero dummy data when source unavailable and no cache');
  clearCache();
  setMockFixtures(async () => {
    throw new Error('Connection refused');
  });
  const noDataRes = await getWeatherAlerts({ district: 'all' });
  assert(noDataRes.alerts.length === 0, 'Strictly zero alerts returned on unwhitelisted/unavailable source');
  assert(noDataRes.counts.total_records === 0, 'Total records reported as 0 (no simulated rows)');

  // Test 20: Source attribution verification
  console.log('\nTest 20: Verify official IMD source attribution');
  assert(IMD_OFFICIAL_SOURCE.name === 'India Meteorological Department', 'Source name is India Meteorological Department');
  assert(IMD_OFFICIAL_SOURCE.url === 'https://mausam.imd.gov.in/', 'Official URL points to mausam.imd.gov.in');
  assert(noDataRes.source.ministry.includes('Ministry of Earth Sciences'), 'Attribution includes Ministry of Earth Sciences');

  // Restore live fixtures
  setMockFixtures(null);
  clearCache();

  console.log('\n========================================');
  console.log(`Total: 20 | Passed: ${passed} | Failed: ${failed}`);
  console.log('========================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('All 20 Official IMD Weather Alerts tests passed successfully! ✨\n');
  }
}

runTests().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
