import { searchCivicIssues } from '../services/searchService.js';
import dotenv from 'dotenv';
dotenv.config();

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`✗ FAIL: ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('      RUNNING GLOBAL CIVIC SEARCH TEST SUITE        ');
  console.log('====================================================\n');

  try {
    // TEST 1: Exact Complaint ID Search (e.g. CC-2026-000001)
    console.log('--- TEST 1: Exact Complaint ID Search ---');
    const exactRes = await searchCivicIssues({ q: 'CC-2026-000001' });
    assert(exactRes.success === true, 'Response status is success');
    assert(exactRes.total >= 1, `Found ${exactRes.total} matching complaint(s) for CC-2026-000001`);
    assert(exactRes.data[0].complaint_id === 'CC-2026-000001', 'Rank #1 result is exact Complaint ID CC-2026-000001');
    assert(exactRes.data[0].relevance_score >= 1000, `Exact match has top relevance score (${exactRes.data[0].relevance_score})`);

    // TEST 2: Partial Complaint ID Search
    console.log('\n--- TEST 2: Partial Complaint ID Search ---');
    const partialRes = await searchCivicIssues({ q: '000002' });
    assert(partialRes.success === true, 'Partial search succeeded');
    assert(partialRes.total >= 1, `Found ${partialRes.total} results for partial ID "000002"`);
    assert(partialRes.data.some(i => i.complaint_id.includes('000002')), 'Contains CC-2026-000002');

    // TEST 3: District Search
    console.log('\n--- TEST 3: District Search ---');
    const districtRes = await searchCivicIssues({ q: 'Coimbatore' });
    assert(districtRes.success === true, 'District search succeeded');
    assert(districtRes.total >= 1, `Found ${districtRes.total} complaints for district "Coimbatore"`);
    assert(districtRes.data.every(i => i.district?.id === 'coimbatore' || (i.address && i.address.toLowerCase().includes('coimbatore')) || (i.address && i.address.toLowerCase().includes('sulur'))), 'All returned issues belong to Coimbatore region');

    // TEST 4: Category Search (e.g. Streetlights / Roads / Garbage)
    console.log('\n--- TEST 4: Category Keyword Search ---');
    const catRes = await searchCivicIssues({ q: 'Streetlights' });
    assert(catRes.success === true, 'Category search succeeded');
    assert(catRes.total >= 1, `Found ${catRes.total} issues for "Streetlights"`);
    assert(catRes.data[0].category === 'streetlights', 'Top result is in streetlights category');

    // TEST 4b: Category Synonym (e.g. "pothole" -> roads)
    const potholeRes = await searchCivicIssues({ q: 'Pothole' });
    assert(potholeRes.success === true, 'Synonym search for "Pothole" succeeded');
    assert(potholeRes.data.some(i => i.category === 'roads'), 'Found road complaint from pothole query');

    // TEST 5: Status / SLA Search (e.g. "verified" or "resolved" or "pending")
    console.log('\n--- TEST 5: Status / SLA Search ---');
    const statusRes = await searchCivicIssues({ q: 'verified' });
    assert(statusRes.success === true, 'Status search succeeded');
    assert(statusRes.total >= 1, `Found ${statusRes.total} verified issues`);
    assert(statusRes.data.some(i => i.status === 'verified' || i.status === 'resolved'), 'Returned issues match verified/resolved state');

    // TEST 6: Department Search (e.g. "Sanitation" or "Electrical")
    console.log('\n--- TEST 6: Department Search ---');
    const deptRes = await searchCivicIssues({ q: 'Sanitation' });
    assert(deptRes.success === true, 'Department search succeeded');
    assert(deptRes.total >= 1, `Found ${deptRes.total} issues for Sanitation Department`);
    assert(deptRes.data.some(i => (i.department && i.department.toLowerCase().includes('sanitation'))), 'Department matches Sanitation');

    // TEST 7: Combined Filters
    console.log('\n--- TEST 7: Combined Filters ---');
    const combinedRes = await searchCivicIssues({
      district: 'coimbatore',
      status: 'resolved',
      category: 'streetlights'
    });
    assert(combinedRes.success === true, 'Combined filter query succeeded');
    assert(combinedRes.total >= 1, `Found ${combinedRes.total} issues matching combined filters`);
    assert(combinedRes.data[0].category === 'streetlights', 'Matches category streetlights');
    assert(combinedRes.data[0].status === 'verified' || combinedRes.data[0].status === 'resolved', 'Matches resolved status');

    // TEST 8: Non-Existent Search Query
    console.log('\n--- TEST 8: Non-Existent Query ---');
    const emptyRes = await searchCivicIssues({ q: 'XYZNONEXISTENTQUERY99999' });
    assert(emptyRes.success === true, 'Empty response is success: true');
    assert(emptyRes.total === 0, 'Total count is 0');
    assert(Array.isArray(emptyRes.data) && emptyRes.data.length === 0, 'Data array is empty');

    // TEST 9: Completely Empty Query
    console.log('\n--- TEST 9: Empty Query Handling ---');
    const noParamRes = await searchCivicIssues({});
    assert(noParamRes.success === true, 'Empty parameters returns success');
    assert(noParamRes.total === 0, 'Total count is 0 when no query or filters passed');

    // TEST 10: Strict Privacy Audit (No Citizen Personal Data)
    console.log('\n--- TEST 10: Strict Privacy & RBAC Audit ---');
    const sampleResults = (await searchCivicIssues({ q: 'Sulur' })).data;
    assert(sampleResults.length > 0, 'Retrieved sample results for privacy check');
    for (const item of sampleResults) {
      assert(item.reporter_id === undefined, `reporter_id is not exposed for issue ${item.complaint_id}`);
      assert(item.email === undefined, `email is not exposed for issue ${item.complaint_id}`);
      assert(item.phone === undefined, `phone is not exposed for issue ${item.complaint_id}`);
      assert(item.citizen_phone === undefined, `citizen_phone is not exposed for issue ${item.complaint_id}`);
      assert(item.citizen_email === undefined, `citizen_email is not exposed for issue ${item.complaint_id}`);
    }

    // TEST 11: Limit Bounds Enforcement
    console.log('\n--- TEST 11: Result Limit Bounds ---');
    const limitedRes = await searchCivicIssues({ q: 'Sulur', limit: 1 });
    assert(limitedRes.data.length <= 1, 'Limit=1 is strictly respected');

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  }

  console.log('\n====================================================');
  console.log(`  RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) process.exit(1);
}

runTests();
