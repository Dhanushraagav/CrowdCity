import { getAuthorityCivicIntelligence } from '../services/analyticsService.js';
import logger from '../config/logger.js';
import dotenv from 'dotenv';
dotenv.config();

console.log('\n====================================================');
console.log('    RUNNING AUTHORITY CIVIC INTELLIGENCE TEST SUITE   ');
console.log('====================================================\n');

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✓ PASS: ${message}`);
    passCount++;
  } else {
    console.error(`✗ FAIL: ${message}`);
    failCount++;
  }
}

async function runTests() {
  try {
    // -------------------------------------------------------------
    // TEST 1: Admin Statewide Intelligence
    // -------------------------------------------------------------
    console.log('--- TEST 1: Admin Authority Context (All Tamil Nadu) ---');
    const adminContext = { id: 'test-admin-uuid', role: 'admin' };
    const adminData = await getAuthorityCivicIntelligence(adminContext, { date_range: 'all_time' });

    assert(adminData !== null && typeof adminData === 'object', 'Returned valid object');
    assert(adminData.overview !== undefined, 'Overview section exists');
    assert(typeof adminData.overview.total_complaints === 'number', 'Total complaints is numeric');
    assert(adminData.overview.total_complaints >= 0, `Total complaints >= 0 (${adminData.overview.total_complaints})`);
    assert(
      adminData.overview.total_complaints === adminData.overview.active_complaints + adminData.overview.resolved_complaints,
      `Total equals Active (${adminData.overview.active_complaints}) + Resolved (${adminData.overview.resolved_complaints})`
    );
    assert(typeof adminData.overview.sla_compliance === 'string', `SLA compliance is formatted (${adminData.overview.sla_compliance})`);
    assert(typeof adminData.overview.avg_resolution_time === 'string', `Avg resolution time exists (${adminData.overview.avg_resolution_time})`);

    // -------------------------------------------------------------
    // TEST 2: Issue Categories & Civic Hotspots
    // -------------------------------------------------------------
    console.log('\n--- TEST 2: Category Breakdown & Civic Hotspots ---');
    assert(Array.isArray(adminData.category_analytics), 'Category analytics is an array');
    if (adminData.category_analytics.length > 0) {
      const topCat = adminData.category_analytics[0];
      assert(topCat.category && typeof topCat.count === 'number', `Top category: ${topCat.category} (${topCat.count})`);
      assert(typeof topCat.percentage === 'number', `Category percentage calculated (${topCat.percentage}%)`);
    }

    assert(Array.isArray(adminData.top_hotspots), 'Top hotspots is an array');
    if (adminData.top_hotspots.length > 0) {
      const topHotspot = adminData.top_hotspots[0];
      assert(topHotspot.area && typeof topHotspot.count === 'number', `Top hotspot: ${topHotspot.area} (${topHotspot.count})`);
    }

    // -------------------------------------------------------------
    // TEST 3: SLA & Escalation Intelligence
    // -------------------------------------------------------------
    console.log('\n--- TEST 3: SLA & Escalation Intelligence ---');
    assert(adminData.sla_intelligence !== undefined, 'SLA intelligence exists');
    assert(typeof adminData.sla_intelligence.on_track === 'number', `On-track SLA count: ${adminData.sla_intelligence.on_track}`);
    assert(typeof adminData.sla_intelligence.overdue === 'number', `Overdue SLA count: ${adminData.sla_intelligence.overdue}`);
    assert(typeof adminData.sla_intelligence.escalated === 'number', `Escalated count: ${adminData.sla_intelligence.escalated}`);

    // -------------------------------------------------------------
    // TEST 4: District Intelligence & Comparison (Admin)
    // -------------------------------------------------------------
    console.log('\n--- TEST 4: 38-District Analytics & Comparison Matrix (Admin) ---');
    assert(Array.isArray(adminData.district_intelligence), 'District intelligence is an array');
    assert(adminData.district_intelligence.length === 38, `Covers all 38 Tamil Nadu districts (${adminData.district_intelligence.length})`);
    assert(Array.isArray(adminData.district_comparison), 'District comparison matrix is present for admin');
    assert(adminData.district_comparison.length === 38, 'Comparison matrix contains 38 districts');

    // -------------------------------------------------------------
    // TEST 5: Department Performance
    // -------------------------------------------------------------
    console.log('\n--- TEST 5: Department Operational Performance ---');
    assert(Array.isArray(adminData.department_performance), 'Department performance is an array');
    if (adminData.department_performance.length > 0) {
      const dept = adminData.department_performance[0];
      assert(dept.department && typeof dept.total_assigned === 'number', `Top dept: ${dept.department} (${dept.total_assigned} cases)`);
      assert(typeof dept.sla_compliance === 'string', `Dept SLA compliance calculated (${dept.sla_compliance})`);
    }

    // -------------------------------------------------------------
    // TEST 6: Time Trends
    // -------------------------------------------------------------
    console.log('\n--- TEST 6: Time Trends Timeline ---');
    assert(Array.isArray(adminData.timeline), 'Timeline is an array');

    // -------------------------------------------------------------
    // TEST 7: Strict RBAC & District Scoping
    // -------------------------------------------------------------
    console.log('\n--- TEST 7: Strict RBAC & Geographic Scoping (District Authority) ---');
    const districtOfficerContext = { id: 'officer-coimbatore', role: 'authority', district: 'coimbatore' };
    
    // Attempt query with unauthorized district parameter: should be restricted to coimbatore
    const scopedData = await getAuthorityCivicIntelligence(districtOfficerContext, { district: 'chennai' });
    assert(scopedData.meta.scope.enforced_district === 'coimbatore', 'Enforced district is coimbatore');
    assert(scopedData.meta.scope.active_district === 'coimbatore', 'Active district locked to coimbatore despite query manipulation');
    assert(scopedData.district_intelligence.length === 1, 'District intelligence limited to authorized district only');
    assert(scopedData.district_intelligence[0].id === 'coimbatore', 'Authorized district is coimbatore');
    assert(scopedData.district_comparison === null, 'District comparison matrix hidden from non-admin');

    // -------------------------------------------------------------
    // TEST 8: Strict Privacy & PII Leak Audit
    // -------------------------------------------------------------
    console.log('\n--- TEST 8: Strict Privacy & Zero PII Exposure ---');
    const serialized = JSON.stringify(adminData);
    assert(!serialized.includes('@gmail.com') && !serialized.includes('@yahoo.com'), 'No email addresses leaked in analytics');
    assert(!serialized.includes('phone') || !serialized.includes('citizen_phone'), 'No phone numbers exposed in analytics');
    assert(!serialized.includes('reporter_id'), 'No reporter IDs exposed in analytics');

    // -------------------------------------------------------------
    // TEST 9: Filter Validation
    // -------------------------------------------------------------
    console.log('\n--- TEST 9: Filter Validation (Category, Priority, Status) ---');
    const filteredByCategory = await getAuthorityCivicIntelligence(adminContext, { category: 'streetlights' });
    assert(filteredByCategory.meta.filters_applied.category === 'streetlights', 'Category filter registered');

    const filteredByPriority = await getAuthorityCivicIntelligence(adminContext, { priority: 'critical' });
    assert(filteredByPriority.meta.filters_applied.priority === 'critical', 'Priority filter registered');

    const filteredByStatus = await getAuthorityCivicIntelligence(adminContext, { status: 'resolved' });
    assert(filteredByStatus.meta.filters_applied.status === 'resolved', 'Status filter registered');

  } catch (err) {
    console.error('Test execution error:', err);
    failCount++;
  }

  console.log('\n====================================================');
  console.log(`  RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('====================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runTests();
