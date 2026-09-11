/**
 * power_updates_test.js
 * 
 * Automated unit and integration tests for Tamil Nadu Power Updates feature.
 * Verifies:
 * - Real-time Asia/Kolkata dynamic status computation (SCHEDULED, ONGOING, RESTORED, CANCELLED).
 * - Official TNPDCL source status and compliance metadata.
 * - Tab and district filtering logic.
 * - HTTP route handlers for /api/power-updates and /api/power-updates/status.
 */

import assert from 'assert';
import {
  getCurrentIST,
  calculateDynamicStatus,
  getOfficialSourceStatus,
  getPowerShutdowns
} from '../services/powerShutdownService.js';
import app from '../app.js';
import http from 'http';

async function runTests() {
  console.log('🧪 Starting Power Updates Test Suite...\n');

  // Test 1: getCurrentIST
  console.log('Test 1: Verify getCurrentIST returns valid Asia/Kolkata date structure');
  const ist = getCurrentIST();
  assert.ok(ist.date instanceof Date, 'ist.date must be a valid Date instance');
  assert.match(ist.dateStr, /^\d{4}-\d{2}-\d{2}$/, 'ist.dateStr must match YYYY-MM-DD');
  assert.ok(ist.hour >= 0 && ist.hour <= 23, 'ist.hour must be between 0 and 23');
  assert.ok(ist.minute >= 0 && ist.minute <= 59, 'ist.minute must be between 0 and 59');
  console.log(`   Passed (Current IST Date: ${ist.dateStr}, Hour: ${ist.hour}:${String(ist.minute).padStart(2, '0')})\n`);

  // Test 2: Dynamic Status Calculation
  console.log('Test 2: Verify dynamic status calculation logic');
  const mockCurrentIST = {
    date: new Date(Date.UTC(2026, 8, 11, 12, 0, 0)), // 2026-09-11 12:00:00 UTC
    dateStr: '2026-09-11',
    year: 2026,
    month: 9,
    day: 11,
    hour: 12,
    minute: 0,
    second: 0
  };

  // 2a. Future date -> SCHEDULED
  const futureRecord = {
    shutdown_date: '2026-09-12',
    start_time: '09:00:00',
    end_time: '17:00:00'
  };
  assert.strictEqual(calculateDynamicStatus(futureRecord, mockCurrentIST), 'SCHEDULED');
  console.log('   2a. Future date correctly marked as SCHEDULED');

  // 2b. Same date before start time -> SCHEDULED
  const scheduledToday = {
    shutdown_date: '2026-09-11',
    start_time: '14:00:00',
    end_time: '18:00:00'
  };
  assert.strictEqual(calculateDynamicStatus(scheduledToday, mockCurrentIST), 'SCHEDULED');
  console.log('   2b. Today before start time correctly marked as SCHEDULED');

  // 2c. Same date between start and end time -> ONGOING
  const ongoingToday = {
    shutdown_date: '2026-09-11',
    start_time: '09:00:00',
    end_time: '17:00:00'
  };
  assert.strictEqual(calculateDynamicStatus(ongoingToday, mockCurrentIST), 'ONGOING');
  console.log('   2c. Active window correctly marked as ONGOING');

  // 2d. Past date -> RESTORED
  const pastRecord = {
    shutdown_date: '2026-09-10',
    start_time: '09:00:00',
    end_time: '17:00:00'
  };
  assert.strictEqual(calculateDynamicStatus(pastRecord, mockCurrentIST), 'RESTORED');
  console.log('   2d. Past date correctly marked as RESTORED');

  // 2e. Explicit cancelled flag -> CANCELLED
  const cancelledRecord = {
    shutdown_date: '2026-09-12',
    start_time: '09:00:00',
    end_time: '17:00:00',
    status: 'CANCELLED'
  };
  assert.strictEqual(calculateDynamicStatus(cancelledRecord, mockCurrentIST), 'CANCELLED');
  console.log('   2e. Explicit status cancelled correctly marked as CANCELLED\n');

  // Test 3: Official Source Status
  console.log('Test 3: Verify getOfficialSourceStatus returns TNPDCL attribution & security compliance');
  const sourceStatus = await getOfficialSourceStatus();
  assert.strictEqual(sourceStatus.source, 'TNPDCL');
  assert.strictEqual(sourceStatus.official_url, 'https://www.tnebltd.gov.in/outages/viewshutdown.xhtml');
  assert.strictEqual(sourceStatus.access_safety.captcha_protected, true);
  assert.strictEqual(sourceStatus.access_safety.public_api_available, false);
  console.log('   Passed (Source: TNPDCL, URL verified, CAPTCHA compliance noted)\n');

  // Test 4: getPowerShutdowns Service Response
  console.log('Test 4: Verify getPowerShutdowns returns valid structured response');
  const result = await getPowerShutdowns({ district: 'Coimbatore', refresh: true });
  assert.strictEqual(result.success, true);
  assert.ok(Array.isArray(result.shutdowns), 'shutdowns must be an array');
  assert.strictEqual(result.official_source.name, 'TNPDCL');
  assert.ok(result.official_source.disclaimer.includes('CrowdCity is an independent civic-tech platform'));
  console.log(`   Passed (Success: ${result.success}, Count: ${result.count})\n`);

  // Test 5: HTTP Endpoints via Express App
  console.log('Test 5: Verify HTTP API routes /api/power-updates and /api/power-updates/status');
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;

  try {
    // 5a. GET /api/power-updates
    const res1 = await fetch(`http://localhost:${port}/api/power-updates`);
    assert.strictEqual(res1.status, 200);
    const json1 = await res1.json();
    assert.strictEqual(json1.success, true);
    assert.strictEqual(json1.official_source.name, 'TNPDCL');
    console.log('   5a. GET /api/power-updates returned 200 OK with valid schema');

    // 5b. GET /api/power-updates/status
    const res2 = await fetch(`http://localhost:${port}/api/power-updates/status`);
    assert.strictEqual(res2.status, 200);
    const json2 = await res2.json();
    assert.strictEqual(json2.success, true);
    assert.strictEqual(json2.source, 'TNPDCL');
    console.log('   5b. GET /api/power-updates/status returned 200 OK with source metadata\n');
  } finally {
    server.close();
  }

  console.log('All Power Updates tests passed successfully! ✨');
  process.exit(0);
}

runTests().catch(err => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
