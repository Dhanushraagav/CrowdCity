import http from 'http';
import app from '../app.js';
import { findTransportationRecord, normalizeTransportationToIssue, getAllTransportationRecords } from '../controllers/transportationController.js';

let server;
let baseUrl;

function makeRequest(urlPath, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, baseUrl);
    const reqOptions = {
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = http.request(url, reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch (e) {
          parsed = data;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: parsed
        });
      });
    });

    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('=== [START] TRANSPORTATION COMPLAINT INTEGRATION TESTS ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  PASS: ${message}`);
      passed++;
    } else {
      console.error(`  FAIL: ${message}`);
      failed++;
    }
  }

  // Start temporary server
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://localhost:${port}`;
      console.log(`Test server running at ${baseUrl}\n`);
      resolve();
    });
  });

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Direct Controller Record Lookup
    // -------------------------------------------------------------------------
    console.log('[Test 1] Controller: findTransportationRecord for trp-1790582037960');
    const directRecord = await findTransportationRecord('trp-1790582037960');
    assert(directRecord && directRecord.report, 'Record trp-1790582037960 should be found in transportation store');
    assert(directRecord?.report?.id === 'trp-1790582037960', 'Record ID must match trp-1790582037960');
    assert(directRecord?.report?.category === 'Damaged Roads', 'Category should match Damaged Roads');

    // -------------------------------------------------------------------------
    // TEST 2: Schema Normalization
    // -------------------------------------------------------------------------
    console.log('\n[Test 2] Schema Normalization: normalizeTransportationToIssue');
    const normalized = normalizeTransportationToIssue(directRecord.report, directRecord.updates);
    assert(normalized.id === 'trp-1790582037960', 'Normalized ID must preserve original trp ID');
    assert(normalized.sourceType === 'transportation', 'Normalized sourceType must be "transportation"');
    assert(normalized.is_transportation === true, 'is_transportation flag must be true');
    assert(typeof normalized.latitude === 'number', 'latitude must be numeric');
    assert(typeof normalized.longitude === 'number', 'longitude must be numeric');
    assert(Array.isArray(normalized.history), 'history must be an array');

    // -------------------------------------------------------------------------
    // TEST 3: GET /api/issues/:id with Transportation ID trp-1790582037960
    // -------------------------------------------------------------------------
    console.log('\n[Test 3] API: GET /api/issues/trp-1790582037960 (Issue Details)');
    const resTrpDetails = await makeRequest('/api/issues/trp-1790582037960');
    assert(resTrpDetails.status === 200, `Expected HTTP 200 for trp-1790582037960, received ${resTrpDetails.status}`);
    assert(resTrpDetails.body && resTrpDetails.body.id === 'trp-1790582037960', 'Response body ID should be trp-1790582037960');
    assert(resTrpDetails.body.sourceType === 'transportation', 'sourceType in response should be "transportation"');
    assert(resTrpDetails.body.timeline && Array.isArray(resTrpDetails.body.timeline.stages), 'timeline.stages should be an array');
    assert(resTrpDetails.body.timeline.stages.length === 5, 'timeline.stages should contain all 5 lifecycle stages');
    assert(resTrpDetails.body.authority_resolution !== undefined, 'authority_resolution should be present');

    // -------------------------------------------------------------------------
    // TEST 4: GET /api/issues/:id with Report Number TRP-2026-9281
    // -------------------------------------------------------------------------
    console.log('\n[Test 4] API: GET /api/issues/TRP-2026-9281 (Lookup by report number)');
    const resTrpNumber = await makeRequest('/api/issues/TRP-2026-9281');
    assert(resTrpNumber.status === 200, `Expected HTTP 200 for TRP-2026-9281, received ${resTrpNumber.status}`);
    assert(resTrpNumber.body && resTrpNumber.body.id === 'trp-1790582037960', 'Resolved issue ID should be trp-1790582037960');

    // -------------------------------------------------------------------------
    // TEST 5: GET /api/issues/:id/timeline with Transportation ID
    // -------------------------------------------------------------------------
    console.log('\n[Test 5] API: GET /api/issues/trp-1790582037960/timeline');
    const resTrpTimeline = await makeRequest('/api/issues/trp-1790582037960/timeline');
    assert(resTrpTimeline.status === 200, `Expected HTTP 200 for timeline, received ${resTrpTimeline.status}`);
    assert(resTrpTimeline.body.success === true, 'timeline response should indicate success');
    assert(resTrpTimeline.body.timeline && Array.isArray(resTrpTimeline.body.timeline.stages), 'timeline.stages should be an array');
    assert(resTrpTimeline.body.timeline.stages[0].id === 'submitted', 'Stage 1 should be "submitted"');
    assert(resTrpTimeline.body.timeline.stages[0].state === 'completed', 'Stage 1 state should be "completed"');

    // -------------------------------------------------------------------------
    // TEST 6: Validation: Non-existent Transportation ID should return 404 (NOT 400)
    // -------------------------------------------------------------------------
    console.log('\n[Test 6] API: Non-existent transportation ID (trp-9999999999999)');
    const resNotFound = await makeRequest('/api/issues/trp-9999999999999');
    assert(resNotFound.status === 404, `Expected HTTP 404 for missing transportation report, received ${resNotFound.status}`);

    // -------------------------------------------------------------------------
    // TEST 7: Validation: Invalid ID format should return HTTP 400
    // -------------------------------------------------------------------------
    console.log('\n[Test 7] API: Invalid ID format validation');
    const resInvalid = await makeRequest('/api/issues/invalid!@#$ID');
    assert(resInvalid.status === 400, `Expected HTTP 400 for malformed ID, received ${resInvalid.status}`);

    // -------------------------------------------------------------------------
    // TEST 8: GET /api/transportation/reports endpoint
    // -------------------------------------------------------------------------
    console.log('\n[Test 8] API: GET /api/transportation/reports');
    const resTransReports = await makeRequest('/api/transportation/reports');
    assert(resTransReports.status === 200, `Expected HTTP 200 from transportation reports, received ${resTransReports.status}`);
    assert(resTransReports.body && Array.isArray(resTransReports.body.reports), 'reports array should be present');
    assert(resTransReports.body.reports.some(r => r.id === 'trp-1790582037960'), 'Seeded report trp-1790582037960 must be in reports');

    // -------------------------------------------------------------------------
    // TEST 9: Citizen Dashboard Stats Normalization & Aggregation Logic
    // -------------------------------------------------------------------------
    console.log('\n[Test 9] Unit: Combined Stats Aggregation Logic');
    const mockCivicList = [
      { id: '11111111-1111-1111-1111-111111111111', status: 'pending', created_at: new Date().toISOString(), reporter_id: 'user-1' },
      { id: '22222222-2222-2222-2222-222222222222', status: 'resolved', created_at: new Date(Date.now() - 86400000).toISOString(), reporter_id: 'user-1' }
    ];
    const mockTransList = [
      { id: 'trp-1790582037960', status: 'Submitted', created_at: new Date().toISOString(), user_id: 'user-1', category: 'Damaged Roads' }
    ];

    const normalizedTransList = mockTransList.map(r => ({
      id: r.id,
      status: (r.status || 'submitted').toLowerCase().replace(/\s+/g, '_'),
      created_at: r.created_at,
      reporter_id: r.user_id,
      sourceType: 'transportation'
    }));

    // Deduplication check
    const dedupMap = new Map();
    mockCivicList.forEach(i => dedupMap.set(i.id, i));
    normalizedTransList.forEach(t => dedupMap.set(t.id, t));
    const combinedUserIssues = Array.from(dedupMap.values());

    assert(combinedUserIssues.length === 3, 'Combined list should contain exactly 3 items');
    const totalAllTime = combinedUserIssues.length;
    const resolvedCount = combinedUserIssues.filter(i => ['resolved', 'verified', 'closed'].includes(i.status.toLowerCase())).length;
    const activeCount = combinedUserIssues.filter(i => !['resolved', 'verified', 'closed'].includes(i.status.toLowerCase())).length;

    assert(totalAllTime === 3, 'Total complaints count should be 3');
    assert(resolvedCount === 1, 'Resolved complaints count should be 1');
    assert(activeCount === 2, 'Active complaints count should be 2 (1 civic pending + 1 transportation submitted)');

    // -------------------------------------------------------------------------
    // TEST 10: Existing Civic Issue Details Resolution (Regression Prevention)
    // -------------------------------------------------------------------------
    console.log('\n[Test 10] API: GET /api/issues (Civic complaints feed)');
    const resCivicFeed = await makeRequest('/api/issues');
    assert(resCivicFeed.status === 200, `Expected HTTP 200 for /api/issues feed, received ${resCivicFeed.status}`);

  } catch (error) {
    console.error('Unhandled test suite exception:', error);
    failed++;
  } finally {
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
  }

  console.log('\n==================================================');
  console.log(`TOTAL TESTS: ${passed + failed}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log('==================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
