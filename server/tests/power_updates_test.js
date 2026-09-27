/**
 * power_updates_test.js
 * 
 * Comprehensive automated verification test suite for Tamil Nadu Power Updates:
 * 1. Date Simulation: Scenarios A (27 Sept), B (28 Sept), C (29 Sept), D (1 Oct)
 * 2. Multi-District Strict Isolation: Coimbatore, Chennai, Madurai, Salem, Tiruppur
 * 3. Expired Record Exclusion: Expired records never appear in upcoming/today/tomorrow/week
 * 4. Empty State Verification: Verified no shutdown for audited districts
 * 5. Deduplication: district + area + scheduledDate + timeWindow uniqueness
 * 6. Dynamic Real-Time Status Computation (SCHEDULED, ONGOING, RESTORED, CANCELLED)
 * 7. Cache Invalidation and Refresh Bypass
 * 8. HTTP API routes (/api/power-updates and /api/power-updates/status) with Cache-Control headers
 */

import assert from 'assert';
import http from 'http';
import {
  getCurrentIST,
  addDaysIST,
  calculateDynamicStatus,
  deduplicateShutdowns,
  getOfficialSourceStatus,
  getPowerShutdowns,
  clearPowerCache
} from '../services/powerShutdownService.js';
import app from '../app.js';

async function runTestSuite() {
  console.log('⚡ Starting Comprehensive Power Updates Verification Suite...\n');

  // =========================================================================
  // TEST 1: Asia/Kolkata (IST) Date Engine & UTC math helpers
  // =========================================================================
  console.log('--- TEST 1: Asia/Kolkata (IST) & Date Helpers ---');
  const istLive = getCurrentIST();
  assert.ok(istLive.date instanceof Date, 'ist.date must be a Date');
  assert.match(istLive.dateStr, /^\d{4}-\d{2}-\d{2}$/, 'ist.dateStr must be YYYY-MM-DD');

  // Test simulation override
  const istSim = getCurrentIST('2026-09-28');
  assert.strictEqual(istSim.dateStr, '2026-09-28');
  assert.strictEqual(istSim.year, 2026);
  assert.strictEqual(istSim.month, 9);
  assert.strictEqual(istSim.day, 28);

  // Test addDaysIST
  assert.strictEqual(addDaysIST('2026-09-27', 1), '2026-09-28');
  assert.strictEqual(addDaysIST('2026-09-27', 6), '2026-10-03');
  assert.strictEqual(addDaysIST('2026-09-30', 1), '2026-10-01');
  console.log('   ✅ IST date engine & addDaysIST passed\n');

  // =========================================================================
  // TEST 2: Dynamic Status Calculation (Asia/Kolkata)
  // =========================================================================
  console.log('--- TEST 2: Dynamic Status Calculation ---');
  const mockISTNoon = {
    date: new Date(Date.UTC(2026, 8, 27, 6, 30, 0)), // 12:00 PM IST on 2026-09-27
    dateStr: '2026-09-27',
    year: 2026,
    month: 9,
    day: 27,
    hour: 12,
    minute: 0,
    second: 0
  };

  // 2a. Today before start time -> SCHEDULED
  const recFutureToday = {
    shutdown_date: '2026-09-27',
    start_time: '14:00',
    end_time: '18:00'
  };
  assert.strictEqual(calculateDynamicStatus(recFutureToday, mockISTNoon), 'SCHEDULED');

  // 2b. Today between start and end -> ONGOING
  const recOngoingToday = {
    shutdown_date: '2026-09-27',
    start_time: '09:00',
    end_time: '17:00'
  };
  assert.strictEqual(calculateDynamicStatus(recOngoingToday, mockISTNoon), 'ONGOING');

  // 2c. Today after end time -> RESTORED
  const recPastToday = {
    shutdown_date: '2026-09-27',
    start_time: '07:00',
    end_time: '11:00'
  };
  assert.strictEqual(calculateDynamicStatus(recPastToday, mockISTNoon), 'RESTORED');

  // 2d. Future date -> SCHEDULED
  const recFutureDate = {
    shutdown_date: '2026-09-28',
    start_time: '09:00',
    end_time: '16:00'
  };
  assert.strictEqual(calculateDynamicStatus(recFutureDate, mockISTNoon), 'SCHEDULED');

  // 2e. Past date -> RESTORED
  const recPastDate = {
    shutdown_date: '2026-09-26',
    start_time: '09:00',
    end_time: '17:00'
  };
  assert.strictEqual(calculateDynamicStatus(recPastDate, mockISTNoon), 'RESTORED');

  // 2f. Explicit cancelled status -> CANCELLED
  const recCancelled = {
    shutdown_date: '2026-09-27',
    start_time: '09:00',
    end_time: '17:00',
    status: 'CANCELLED'
  };
  assert.strictEqual(calculateDynamicStatus(recCancelled, mockISTNoon), 'CANCELLED');
  console.log('   ✅ Real-time dynamic statuses (SCHEDULED, ONGOING, RESTORED, CANCELLED) passed\n');

  // =========================================================================
  // TEST 3: Deduplication
  // =========================================================================
  console.log('--- TEST 3: Deduplication by District + Area + Date + Times ---');
  const duplicateRecords = [
    { district: 'Coimbatore', area: 'Peelamedu 110/22KV Substation', shutdown_date: '2026-09-27', start_time: '09:00', end_time: '17:00' },
    { district: 'Coimbatore', area: 'Peelamedu 110/22KV Substation', shutdown_date: '2026-09-27', start_time: '09:00', end_time: '17:00' },
    { district: 'Coimbatore', area: 'Ondipudur 110/11KV Substation', shutdown_date: '2026-09-28', start_time: '09:00', end_time: '16:00' }
  ];
  const deduped = deduplicateShutdowns(duplicateRecords);
  assert.strictEqual(deduped.length, 2, 'Duplicates must be merged');
  console.log('   ✅ Deduplication correctly collapsed duplicates to unique records\n');

  // =========================================================================
  // TEST 4: Date Simulation Tests (Scenarios A, B, C, D)
  // =========================================================================
  console.log('--- TEST 4: Date Simulation Scenarios ---');

  // --- SCENARIO A: Today = 27 Sept 2026 ---
  console.log('Scenario A (Today = 2026-09-27):');
  clearPowerCache();
  const resA_today = await getPowerShutdowns({ district: 'Coimbatore', tab: 'today', sim_date: '2026-09-27' });
  assert.strictEqual(resA_today.count, 1, 'Coimbatore Today must have Peelamedu on 27 Sept');
  assert.ok(resA_today.shutdowns[0].area.includes('Peelamedu'), 'Expected Peelamedu Substation');
  assert.strictEqual(resA_today.shutdowns[0].shutdown_date, '2026-09-27');

  const resA_tomorrow = await getPowerShutdowns({ district: 'Coimbatore', tab: 'tomorrow', sim_date: '2026-09-27' });
  assert.strictEqual(resA_tomorrow.count, 1, 'Coimbatore Tomorrow must have Ondipudur on 28 Sept');
  assert.ok(resA_tomorrow.shutdowns[0].area.includes('Ondipudur'), 'Expected Ondipudur Substation');
  assert.strictEqual(resA_tomorrow.shutdowns[0].shutdown_date, '2026-09-28');

  const resA_all = await getPowerShutdowns({ district: 'Coimbatore', tab: 'all', sim_date: '2026-09-27' });
  assert.ok(resA_all.shutdowns.some(r => r.area.includes('Peelamedu')), 'Peelamedu should be in upcoming');
  assert.ok(resA_all.shutdowns.some(r => r.area.includes('Ondipudur')), 'Ondipudur should be in upcoming');
  assert.ok(resA_all.shutdowns.some(r => r.area.includes('Saravanampatti')), 'Saravanampatti should be in upcoming');
  console.log('   ✅ Scenario A passed: Peelamedu is Today, Ondipudur is Tomorrow, Saravanampatti is Upcoming');

  // --- SCENARIO B: Today = 28 Sept 2026 ---
  console.log('Scenario B (Today = 2026-09-28):');
  clearPowerCache();
  const resB_today = await getPowerShutdowns({ district: 'Coimbatore', tab: 'today', sim_date: '2026-09-28' });
  assert.strictEqual(resB_today.count, 1, 'Coimbatore Today must have Ondipudur on 28 Sept');
  assert.ok(resB_today.shutdowns[0].area.includes('Ondipudur'), 'Ondipudur is now Today');
  assert.strictEqual(resB_today.shutdowns[0].shutdown_date, '2026-09-28');

  const resB_all = await getPowerShutdowns({ district: 'Coimbatore', tab: 'all', sim_date: '2026-09-28' });
  const hasPeelameduB = resB_all.shutdowns.some(r => r.area.includes('Peelamedu'));
  assert.strictEqual(hasPeelameduB, false, 'Expired Peelamedu (27 Sept) must NOT appear in default upcoming schedule on 28 Sept!');
  assert.ok(resB_all.shutdowns.some(r => r.area.includes('Ondipudur')), 'Ondipudur is in upcoming');
  assert.ok(resB_all.shutdowns.some(r => r.area.includes('Saravanampatti')), 'Saravanampatti is in upcoming');
  console.log('   ✅ Scenario B passed: Peelamedu expired & eliminated; Ondipudur is Today; Saravanampatti is Upcoming');

  // --- SCENARIO C: Today = 29 Sept 2026 ---
  console.log('Scenario C (Today = 2026-09-29):');
  clearPowerCache();
  const resC_today = await getPowerShutdowns({ district: 'Coimbatore', tab: 'today', sim_date: '2026-09-29' });
  assert.strictEqual(resC_today.count, 0, 'Coimbatore Today must have 0 shutdowns on 29 Sept');
  assert.strictEqual(resC_today.status, 'verified_no_shutdown', 'Must report verified_no_shutdown');
  assert.strictEqual(resC_today.verification_status, 'verified', 'Must be verified');
  assert.ok(resC_today.message.includes('No planned power shutdowns found for Coimbatore on 2026-09-29'));

  const resC_all = await getPowerShutdowns({ district: 'Coimbatore', tab: 'all', sim_date: '2026-09-29' });
  assert.strictEqual(resC_all.shutdowns.some(r => r.area.includes('Peelamedu')), false, 'Peelamedu must not appear');
  assert.strictEqual(resC_all.shutdowns.some(r => r.area.includes('Ondipudur')), false, 'Ondipudur must not appear');
  assert.ok(resC_all.shutdowns.some(r => r.area.includes('Saravanampatti')), 'Saravanampatti (1 Oct) is in upcoming');
  console.log('   ✅ Scenario C passed: Both Peelamedu & Ondipudur expired; Today is verified clear; Saravanampatti is upcoming');

  // --- SCENARIO D: Today = 1 Oct 2026 ---
  console.log('Scenario D (Today = 2026-10-01):');
  clearPowerCache();
  const resD_today = await getPowerShutdowns({ district: 'Coimbatore', tab: 'today', sim_date: '2026-10-01' });
  assert.strictEqual(resD_today.count, 1, 'Saravanampatti must be Today on 1 Oct');
  assert.ok(resD_today.shutdowns[0].area.includes('Saravanampatti'), 'Saravanampatti is Today');
  assert.strictEqual(resD_today.shutdowns[0].shutdown_date, '2026-10-01');

  const resD_all = await getPowerShutdowns({ district: 'Coimbatore', tab: 'all', sim_date: '2026-10-01' });
  assert.strictEqual(resD_all.shutdowns.some(r => r.area.includes('Peelamedu')), false, 'Peelamedu expired');
  assert.strictEqual(resD_all.shutdowns.some(r => r.area.includes('Ondipudur')), false, 'Ondipudur expired');
  assert.ok(resD_all.shutdowns.some(r => r.area.includes('Saravanampatti')), 'Saravanampatti is in list');
  console.log('   ✅ Scenario D passed: Saravanampatti is now Today; past shutdowns remain expired\n');

  // =========================================================================
  // TEST 5: Multi-District Isolation (Coimbatore, Chennai, Madurai, Salem, Tiruppur)
  // =========================================================================
  console.log('--- TEST 5: Multi-District Strict Isolation ---');
  clearPowerCache();

  // 5a. Chennai
  const resChennai = await getPowerShutdowns({ district: 'Chennai', tab: 'all', sim_date: '2026-09-27' });
  assert.ok(resChennai.count > 0, 'Chennai must have scheduled shutdowns');
  assert.ok(resChennai.shutdowns.every(r => r.district === 'Chennai'), 'All records must be strictly Chennai');
  assert.strictEqual(resChennai.shutdowns.some(r => r.district.includes('Coimbatore')), false, 'Zero Coimbatore cards in Chennai!');
  console.log(`   5a. Chennai: ${resChennai.count} shutdowns, 100% Chennai (zero Coimbatore leakage)`);

  // 5b. Madurai
  const resMadurai = await getPowerShutdowns({ district: 'Madurai', tab: 'all', sim_date: '2026-09-27' });
  assert.ok(resMadurai.count > 0, 'Madurai must have scheduled shutdowns');
  assert.ok(resMadurai.shutdowns.every(r => r.district === 'Madurai'), 'All records must be strictly Madurai');
  assert.strictEqual(resMadurai.shutdowns.some(r => r.district.includes('Coimbatore')), false, 'Zero Coimbatore cards in Madurai!');
  console.log(`   5b. Madurai: ${resMadurai.count} shutdowns, 100% Madurai (zero Coimbatore leakage)`);

  // 5c. Salem
  const resSalem = await getPowerShutdowns({ district: 'Salem', tab: 'all', sim_date: '2026-09-27' });
  assert.ok(resSalem.count > 0, 'Salem must have scheduled shutdowns');
  assert.ok(resSalem.shutdowns.every(r => r.district === 'Salem'), 'All records must be strictly Salem');
  assert.strictEqual(resSalem.shutdowns.some(r => r.district.includes('Coimbatore')), false, 'Zero Coimbatore cards in Salem!');
  console.log(`   5c. Salem: ${resSalem.count} shutdowns, 100% Salem (zero Coimbatore leakage)`);

  // 5d. Tiruppur
  const resTiruppur = await getPowerShutdowns({ district: 'Tiruppur', tab: 'all', sim_date: '2026-09-27' });
  assert.ok(resTiruppur.count > 0, 'Tiruppur must have scheduled shutdowns');
  assert.ok(resTiruppur.shutdowns.every(r => r.district === 'Tiruppur'), 'All records must be strictly Tiruppur');
  assert.strictEqual(resTiruppur.shutdowns.some(r => r.district.includes('Coimbatore')), false, 'Zero Coimbatore cards in Tiruppur!');
  console.log(`   5d. Tiruppur: ${resTiruppur.count} shutdowns, 100% Tiruppur (zero Coimbatore leakage)`);

  // 5e. Coimbatore
  const resCoimbatore = await getPowerShutdowns({ district: 'Coimbatore', tab: 'all', sim_date: '2026-09-27' });
  assert.ok(resCoimbatore.shutdowns.every(r => r.district === 'Coimbatore'), 'All records must be strictly Coimbatore');
  assert.strictEqual(resCoimbatore.shutdowns.some(r => r.district.includes('Chennai')), false, 'Zero Chennai cards in Coimbatore!');
  console.log(`   5e. Coimbatore: ${resCoimbatore.count} shutdowns, 100% Coimbatore (zero cross-district leakage)`);
  console.log('   ✅ Multi-District strict isolation passed with ZERO cross-district contamination\n');

  // =========================================================================
  // TEST 6: Empty State & Verified Status
  // =========================================================================
  console.log('--- TEST 6: Empty State & Verified Status ---');
  clearPowerCache();
  // Ariyalur has 0 shutdowns on 2026-09-27
  const resAriyalur = await getPowerShutdowns({ district: 'Ariyalur', date: '2026-09-27', sim_date: '2026-09-27' });
  assert.strictEqual(resAriyalur.count, 0);
  assert.strictEqual(resAriyalur.status, 'verified_no_shutdown');
  assert.strictEqual(resAriyalur.verification_status, 'verified');
  assert.ok(resAriyalur.message.includes('No planned power shutdowns found for Ariyalur on 2026-09-27'));

  // Non-TN district
  const resInvalid = await getPowerShutdowns({ district: 'UnknownNonTNDistrict', date: '2026-09-27' });
  assert.strictEqual(resInvalid.status, 'unable_to_verify');
  assert.strictEqual(resInvalid.verification_status, 'unable_to_verify');
  console.log('   ✅ Authentic empty state & verified status determination passed\n');

  // =========================================================================
  // TEST 7: Cache Invalidation & Refresh Bypass
  // =========================================================================
  console.log('--- TEST 7: Cache Invalidation & Refresh Bypass ---');
  clearPowerCache();
  const res1 = await getPowerShutdowns({ district: 'Coimbatore', tab: 'all', sim_date: '2026-09-27' });
  assert.strictEqual(res1.success, true);

  // Calling with refresh = true bypasses cache
  const resRefresh = await getPowerShutdowns({ district: 'Coimbatore', tab: 'all', refresh: true, sim_date: '2026-09-27' });
  assert.strictEqual(resRefresh.success, true);
  assert.ok(resRefresh.last_checked_ist.includes('IST'));
  console.log('   ✅ Cache and Refresh bypass functioning correctly\n');

  // =========================================================================
  // TEST 8: HTTP Integration Endpoints via Express
  // =========================================================================
  console.log('--- TEST 8: HTTP API Endpoints & Headers ---');
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;

  try {
    // 8a. GET /api/power-updates with Coimbatore filter
    const httpRes1 = await fetch(`http://localhost:${port}/api/power-updates?district=Coimbatore&tab=today&sim_date=2026-09-27`);
    assert.strictEqual(httpRes1.status, 200);
    assert.strictEqual(httpRes1.headers.get('cache-control'), 'no-cache, private');
    const json1 = await httpRes1.json();
    assert.strictEqual(json1.success, true);
    assert.strictEqual(json1.district, 'Coimbatore');
    assert.strictEqual(json1.count, 1);
    assert.ok(json1.shutdowns[0].area.includes('Peelamedu'));
    console.log('   8a. GET /api/power-updates (Coimbatore Today) returned 200 OK with correct data');

    // 8b. GET /api/power-updates with Chennai filter
    const httpRes2 = await fetch(`http://localhost:${port}/api/power-updates?district=Chennai&tab=today&sim_date=2026-09-27`);
    assert.strictEqual(httpRes2.status, 200);
    const json2 = await httpRes2.json();
    assert.strictEqual(json2.success, true);
    assert.strictEqual(json2.district, 'Chennai');
    assert.strictEqual(json2.count, 1);
    assert.ok(json2.shutdowns[0].area.includes('Guindy'));
    assert.strictEqual(json2.shutdowns.some(r => r.district.includes('Coimbatore')), false);
    console.log('   8b. GET /api/power-updates (Chennai Today) returned 200 OK with zero Coimbatore leakage');

    // 8c. GET /api/power-updates with refresh=true
    const httpRes3 = await fetch(`http://localhost:${port}/api/power-updates?district=Coimbatore&refresh=true&sim_date=2026-09-27`);
    assert.strictEqual(httpRes3.status, 200);
    assert.strictEqual(httpRes3.headers.get('cache-control'), 'no-cache, no-store, must-revalidate');
    const json3 = await httpRes3.json();
    assert.strictEqual(json3.success, true);
    assert.ok(json3.last_checked_ist.includes('IST'));
    console.log('   8c. GET /api/power-updates?refresh=true returned 200 OK with no-store cache header');

    // 8d. GET /api/power-updates/status
    const httpRes4 = await fetch(`http://localhost:${port}/api/power-updates/status`);
    assert.strictEqual(httpRes4.status, 200);
    const json4 = await httpRes4.json();
    assert.strictEqual(json4.success, true);
    assert.strictEqual(json4.source, 'TNPDCL');
    assert.strictEqual(json4.access_safety.captcha_protected, true);
    console.log('   8d. GET /api/power-updates/status returned 200 OK with source metadata\n');
  } finally {
    server.close();
  }

  console.log('✨ ALL POWER UPDATES TESTS PASSED SUCCESSFULLY! 🌟');
  process.exit(0);
}

runTestSuite().catch(err => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
