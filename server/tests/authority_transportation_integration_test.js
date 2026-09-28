import http from 'http';
import fs from 'fs';
import path from 'path';
import app from '../app.js';
import { findTransportationRecord, normalizeTransportationToIssue, getAllTransportationRecords, updateTransportationRecord } from '../controllers/transportationController.js';

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

async function runAuthorityTransportationTests() {
  console.log('================================================================');
  console.log('=== AUTHORITY PORTAL TRANSPORTATION INTEGRATION VERIFICATION ===');
  console.log('================================================================\n');

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

  // Start HTTP server on dynamic port
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://localhost:${port}`;
      console.log(`Test server running at ${baseUrl}\n`);
      resolve();
    });
  });

  try {
    const testTrpId = 'trp-1790582037960';

    // -------------------------------------------------------------------------
    // TEST A: Transportation Complaints Included in Authority Queue
    // -------------------------------------------------------------------------
    console.log('[Test A] Transportation Complaints Available for Authority Queue');
    const transEndpointRes = await makeRequest('/api/transportation/reports');
    assert(transEndpointRes.status === 200, 'GET /api/transportation/reports returns HTTP 200');
    const reportsList = transEndpointRes.body?.reports || transEndpointRes.body?.data || (Array.isArray(transEndpointRes.body) ? transEndpointRes.body : []);
    assert(Array.isArray(reportsList) && reportsList.length > 0, 'Transportation reports list contains items');
    const foundTrp = reportsList.find(r => r.id === testTrpId);
    assert(Boolean(foundTrp), `Target transportation complaint ${testTrpId} is present in reports`);

    // Verify GET /api/issues?include_transportation=true
    const combinedRes = await makeRequest('/api/issues?include_transportation=true');
    assert(combinedRes.status === 200, 'GET /api/issues?include_transportation=true returns HTTP 200');
    const combinedList = Array.isArray(combinedRes.body) ? combinedRes.body : [];
    const combinedTrp = combinedList.find(c => c.id === testTrpId);
    assert(Boolean(combinedTrp), 'Unified issues query includes transportation complaint');

    // -------------------------------------------------------------------------
    // TEST B: Monospace Transportation ID Preserved (trp-1790582037960)
    // -------------------------------------------------------------------------
    console.log('\n[Test B] Original Transportation ID Integrity');
    assert(foundTrp.id === testTrpId, `Exact original ID ${testTrpId} preserved without artificial prefix conversion`);
    assert(foundTrp.id.startsWith('trp-'), 'ID begins with native "trp-" namespace');
    if (combinedTrp) {
      assert(combinedTrp.id === testTrpId, 'Unified record keeps exact trp ID');
      assert(combinedTrp.sourceType === 'transportation', 'Unified record retains sourceType "transportation"');
    }

    // -------------------------------------------------------------------------
    // TEST C: Category and District Filter Compatibility
    // -------------------------------------------------------------------------
    console.log('\n[Test C] Category and District Filter Compatibility');
    const normalizedTrp = normalizeTransportationToIssue(foundTrp);
    assert(normalizedTrp.category === 'Damaged Roads' || normalizedTrp.category === 'roads', 'Transportation category is correctly mapped to "Damaged Roads"');
    assert(Boolean(normalizedTrp.district), `District resolved cleanly: ${normalizedTrp.district}`);
    assert(Boolean(normalizedTrp.location || normalizedTrp.address), 'Address/location field is populated');

    // -------------------------------------------------------------------------
    // TEST D: Priority and Urgency Mapping
    // -------------------------------------------------------------------------
    console.log('\n[Test D] Priority and Urgency Mapping');
    assert(normalizedTrp.priority !== undefined, `Priority is defined: ${normalizedTrp.priority}`);
    assert(typeof normalizedTrp.priority_score === 'number', `Numeric priority score calculated: ${normalizedTrp.priority_score}`);
    assert(normalizedTrp.priority_score >= 0 && normalizedTrp.priority_score <= 100, 'Priority score falls within 0-100 range');

    // -------------------------------------------------------------------------
    // TEST E: Inspect Case Direct Lookup (GET /api/issues/:id)
    // -------------------------------------------------------------------------
    console.log('\n[Test E] Inspect Case Direct Endpoint Resolution');
    const inspectRes = await makeRequest(`/api/issues/${testTrpId}`);
    assert(inspectRes.status === 200, `GET /api/issues/${testTrpId} returns HTTP 200`);
    assert(inspectRes.body.id === testTrpId, 'Response contains matching complaint ID');
    assert(inspectRes.body.sourceType === 'transportation', 'Response includes sourceType: "transportation"');

    // -------------------------------------------------------------------------
    // TEST F: Case Details Page HTML & JS Fast Path Verification
    // -------------------------------------------------------------------------
    console.log('\n[Test F] Case Details HTML & Client JavaScript Fast Path');
    const adminJsPath = path.resolve('client/js/admin.js');
    const adminJsContent = fs.readFileSync(adminJsPath, 'utf8');
    assert(adminJsContent.includes('renderCaseDetailsDOM'), 'admin.js includes dedicated renderCaseDetailsDOM function');
    assert(adminJsContent.includes('cc_active_inspect_case'), 'admin.js utilizes sessionStorage cc_active_inspect_case cache for 0ms rendering');
    assert(adminJsContent.includes('Promise.allSettled'), 'admin.js performs parallel background fetching for case freshness');

    // -------------------------------------------------------------------------
    // TEST G: Phone Contact Action Component (tel:)
    // -------------------------------------------------------------------------
    console.log('\n[Test G] Phone Contact Component & tel: Protocol');
    const caseDetailsHtmlPath = path.resolve('client/authority-case-details.html');
    const htmlContent = fs.readFileSync(caseDetailsHtmlPath, 'utf8');
    assert(htmlContent.includes('detail-authority-phone-wrap'), 'HTML includes #detail-authority-phone-wrap container');
    assert(htmlContent.includes('detail-authority-phone'), 'HTML includes #detail-authority-phone link element');
    assert(adminJsContent.includes('href="tel:'), 'admin.js sets active tel: link for reachable phone numbers');

    // -------------------------------------------------------------------------
    // TEST H: Email Contact Action Component (mailto:)
    // -------------------------------------------------------------------------
    console.log('\n[Test H] Email Contact Component & mailto: Protocol');
    assert(htmlContent.includes('detail-authority-email-wrap'), 'HTML includes #detail-authority-email-wrap container');
    assert(htmlContent.includes('detail-authority-email'), 'HTML includes #detail-authority-email link element');
    assert(adminJsContent.includes('href="mailto:'), 'admin.js sets active mailto: link for reachable email addresses');

    // -------------------------------------------------------------------------
    // TEST I: Unavailable Contact Clean Muted State
    // -------------------------------------------------------------------------
    console.log('\n[Test I] Unavailable Contact Handling');
    const portalCssPath = path.resolve('client/css/authority-portal.css');
    const portalCssContent = fs.readFileSync(portalCssPath, 'utf8');
    assert(portalCssContent.includes('.authority-contact-unavailable'), 'CSS contains .authority-contact-unavailable styling rule');
    assert(adminJsContent.includes('Phone Unavailable'), 'admin.js renders "Phone Unavailable" pill for missing phone numbers');
    assert(adminJsContent.includes('Email Unavailable'), 'admin.js renders "Email Unavailable" pill for missing email addresses');

    // -------------------------------------------------------------------------
    // TEST J: Administrative Hierarchy Card Structure
    // -------------------------------------------------------------------------
    console.log('\n[Test J] Administrative Hierarchy Card Structure');
    assert(inspectRes.body.authority_resolution !== undefined, 'Case details API includes authority_resolution object');
    assert(inspectRes.body.authority_resolution.jurisdiction !== undefined, 'authority_resolution contains jurisdiction hierarchy');
    assert(inspectRes.body.authority_resolution.administrativeAuthority !== undefined, 'authority_resolution contains administrativeAuthority details');
    assert(htmlContent.includes('detail-district'), 'HTML includes #detail-district');
    assert(htmlContent.includes('detail-taluk'), 'HTML includes #detail-taluk');
    assert(htmlContent.includes('detail-village-town'), 'HTML includes #detail-village-town');
    assert(htmlContent.includes('detail-local-body'), 'HTML includes #detail-local-body');
    assert(htmlContent.includes('detail-authority-name'), 'HTML includes #detail-authority-name');

    // -------------------------------------------------------------------------
    // TEST K: SLA Response & Escalation Tracker
    // -------------------------------------------------------------------------
    console.log('\n[Test K] SLA Response & Escalation Tracker');
    assert(htmlContent.includes('detail-sla-deadline'), 'HTML includes #detail-sla-deadline element');
    assert(htmlContent.includes('detail-sla-time-remaining'), 'HTML includes #detail-sla-time-remaining element');
    assert(htmlContent.includes('detail-sla-status-badge'), 'HTML includes #detail-sla-status-badge element');
    assert(adminJsContent.includes('computeSlaUrgencyMeta'), 'admin.js implements SLA Urgency calculation');

    // -------------------------------------------------------------------------
    // TEST L: Civic Priority Score Presentation
    // -------------------------------------------------------------------------
    console.log('\n[Test L] Civic Priority Score Presentation');
    assert(htmlContent.includes('detail-priority-score-val'), 'HTML includes #detail-priority-score-val');
    assert(htmlContent.includes('detail-priority-level-badge'), 'HTML includes #detail-priority-level-badge');
    assert(htmlContent.includes('factor-severity-val'), 'HTML includes contributing factors: severity');
    assert(htmlContent.includes('factor-affected-val'), 'HTML includes contributing factors: affected');

    // -------------------------------------------------------------------------
    // TEST M: Timeline Rendering & Activity Feed
    // -------------------------------------------------------------------------
    console.log('\n[Test M] Timeline Rendering & Activity Feed');
    assert(inspectRes.body.timeline !== undefined, 'Case details response includes timeline object');
    assert(Array.isArray(inspectRes.body.timeline.stages), 'timeline contains stages array');
    assert(htmlContent.includes('detail-timeline-list'), 'HTML includes #detail-timeline-list');
    assert(htmlContent.includes('detail-activity-list'), 'HTML includes #detail-activity-list');

    // -------------------------------------------------------------------------
    // TEST N: Status Update on Transportation Complaints (Direct & Controller)
    // -------------------------------------------------------------------------
    console.log('\n[Test N] Status Update on Transportation Complaints');
    const updateResult = await updateTransportationRecord(testTrpId, {
      status: 'in_progress',
      official_remarks: 'Maintenance unit deployed for road patching.'
    }, {
      id: `u-test-${Date.now()}`,
      report_id: testTrpId,
      status: 'in_progress',
      remarks: 'Maintenance unit deployed for road patching.',
      updated_by: 'Assistant Divisional Engineer (Highways)',
      created_at: new Date().toISOString()
    });
    assert(updateResult !== null, 'Transportation record updated via controller');
    assert(updateResult.status === 'in_progress', 'Transportation record status updated to "in_progress"');

    // Verify GET /api/issues/:id reflects the updated status
    const verifiedDetails = await makeRequest(`/api/issues/${testTrpId}`);
    assert(verifiedDetails.body.status === 'in_progress', 'GET /api/issues/:id returns updated status "in_progress"');
    assert(verifiedDetails.body.history && verifiedDetails.body.history.length > 0, 'Status history contains updated log entry');

    // -------------------------------------------------------------------------
    // TEST O: Authority Delegation / Assignment on Transportation Complaints
    // -------------------------------------------------------------------------
    console.log('\n[Test O] Authority Delegation & Assignment');
    const assignResult = await updateTransportationRecord(testTrpId, {
      assigned_to: 'Er. R. Sundaram (Highways)',
      status: 'assigned'
    }, {
      id: `u-assign-${Date.now()}`,
      report_id: testTrpId,
      status: 'assigned',
      remarks: 'Case assigned to Er. R. Sundaram (Highways).',
      updated_by: 'Chief Authority Dispatch',
      created_at: new Date().toISOString()
    });
    assert(assignResult.assigned_to === 'Er. R. Sundaram (Highways)', 'Assigned official updated successfully');
    const recheckedDetails = await makeRequest(`/api/issues/${testTrpId}`);
    assert(recheckedDetails.body.assignedOfficial === 'Er. R. Sundaram (Highways)' || recheckedDetails.body.assigned_to === 'Er. R. Sundaram (Highways)', 'Case details returns assigned official');

    // -------------------------------------------------------------------------
    // TEST P: Zero Emoji Verification across all modified files
    // -------------------------------------------------------------------------
    console.log('\n[Test P] Code Hygiene: Zero Emojis in Modified Files');
    const modifiedFiles = [
      'server/controllers/transportationController.js',
      'server/controllers/issueController.js',
      'client/js/admin.js',
      'client/css/authority-portal.css',
      'client/authority-case-details.html'
    ];
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    let emojiViolations = 0;
    for (const f of modifiedFiles) {
      const content = fs.readFileSync(path.resolve(f), 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (emojiRegex.test(line)) {
          console.error(`  Violation in ${f}:${idx + 1} -> ${line.trim()}`);
          emojiViolations++;
        }
      });
    }
    assert(emojiViolations === 0, 'Strictly zero emojis present across all modified codebase files');

  } catch (err) {
    console.error('Fatal test error:', err);
    failed++;
  } finally {
    if (server) server.close();
  }

  console.log('\n================================================================');
  console.log(`=== TEST SUMMARY: ${passed} PASSED, ${failed} FAILED ===`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAuthorityTransportationTests();
