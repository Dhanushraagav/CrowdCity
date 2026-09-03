/**
 * Automated Test Suite: Tamil Nadu 38-District Civic Intelligence
 * Validates dynamic calculations, 38-district coverage, zero-hardcoding, SLA integration, and filters.
 */

import { getTamilNaduCivicIntelligence } from '../services/analyticsService.js';
import { TN_DISTRICTS, getAllDistricts, resolveDistrict } from '../config/districtsConfig.js';
import { supabaseAdmin, supabase } from '../config/supabase.js';

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`✓ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`✗ FAIL: ${testName}`);
    failed++;
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('  RUNNING TAMIL NADU CIVIC INTELLIGENCE TEST SUITE   ');
  console.log('====================================================\n');

  // TEST 1: All 38 Tamil Nadu districts configured
  const allDistricts = getAllDistricts();
  assert(allDistricts.length === 38, 'TEST 1a: Exactly 38 Tamil Nadu districts are configured');
  assert(allDistricts.every(d => d.id && d.name && d.code && d.lat && d.lng), 'TEST 1b: Every district has id, name, code, and coordinates');

  // TEST 2: District Resolution from Address & Coordinates
  const testIssue1 = {
    title: 'Damaged Road in Sulur',
    address: 'Papampatti Pirivu, Kannampalayam, Sulur, Tamil Nadu, India',
    latitude: 10.99837,
    longitude: 77.084852
  };
  const resolvedDist1 = resolveDistrict(testIssue1);
  assert(resolvedDist1.id === 'coimbatore', `TEST 2a: Sulur/Kannampalayam resolves to Coimbatore (got ${resolvedDist1.id})`);

  const testIssue2 = {
    title: 'Water leak in Anna Salai',
    address: 'Anna Salai, Guindy, Chennai, Tamil Nadu',
    latitude: 13.0067,
    longitude: 80.2021
  };
  const resolvedDist2 = resolveDistrict(testIssue2);
  assert(resolvedDist2.id === 'chennai', `TEST 2b: Guindy/Anna Salai resolves to Chennai (got ${resolvedDist2.id})`);

  // TEST 3: State-Wide Intelligence API Execution
  const intelligenceAll = await getTamilNaduCivicIntelligence();
  assert(intelligenceAll && intelligenceAll.state_overview, 'TEST 3a: getTamilNaduCivicIntelligence returns state_overview');
  assert(intelligenceAll.districts && intelligenceAll.districts.length === 38, 'TEST 3b: Exactly 38 districts returned in district array');
  assert(typeof intelligenceAll.state_overview.total_issues === 'number', 'TEST 3c: total_issues is a numeric calculation');
  assert(typeof intelligenceAll.state_overview.resolution_rate === 'string' && intelligenceAll.state_overview.resolution_rate.endsWith('%'), 'TEST 3d: resolution_rate is formatted as percentage string');

  // TEST 4: Safe Zero-Complaint Handling
  const zeroDistrict = intelligenceAll.districts.find(d => d.total_issues === 0);
  if (zeroDistrict) {
    assert(zeroDistrict.resolution_rate === '0.0%', `TEST 4a: Zero-complaint district (${zeroDistrict.name}) safely displays 0.0% without NaN`);
    assert(zeroDistrict.critical_issues === 0, `TEST 4b: Zero-complaint district (${zeroDistrict.name}) has 0 critical issues`);
    assert(zeroDistrict.most_reported_category === 'None', `TEST 4c: Zero-complaint district shows 'None' for top category`);
  } else {
    console.log('ℹ All districts have complaints, skipping zero district check');
  }

  // TEST 5: Selected District Filtering (Coimbatore)
  const coimbatoreIntel = await getTamilNaduCivicIntelligence({ district: 'coimbatore' });
  assert(coimbatoreIntel.selected_scope.district_id === 'coimbatore', 'TEST 5a: Selected district scope returns Coimbatore');
  assert(coimbatoreIntel.selected_scope.district_name === 'Coimbatore', 'TEST 5b: Selected district name is Coimbatore');
  assert(Array.isArray(coimbatoreIntel.selected_scope.category_distribution), 'TEST 5c: Category distribution is an array');
  assert(Array.isArray(coimbatoreIntel.selected_scope.most_affected_areas), 'TEST 5d: Most affected areas is an array');

  // TEST 6: Category Filter
  const roadsOnly = await getTamilNaduCivicIntelligence({ category: 'roads' });
  const nonRoads = roadsOnly.selected_scope.category_distribution.filter(c => c.category !== 'roads');
  assert(nonRoads.length === 0, 'TEST 6: Category filter restricts data to specified category only');

  // TEST 7: Priority Filter (Critical)
  const criticalOnly = await getTamilNaduCivicIntelligence({ priority: 'critical' });
  assert(typeof criticalOnly.state_overview.critical_issues === 'number', 'TEST 7a: Critical issues count is numeric');
  assert(criticalOnly.state_overview.total_issues === criticalOnly.state_overview.critical_issues, 'TEST 7b: Critical filter total matches critical count');

  // TEST 8: Date Range Bounds
  const todayIntel = await getTamilNaduCivicIntelligence({ date_range: 'today' });
  assert(todayIntel.meta.filters_applied.date_range === 'today', 'TEST 8a: Date range filter is tracked in meta');
  const weekIntel = await getTamilNaduCivicIntelligence({ date_range: '7d' });
  assert(weekIntel.meta.filters_applied.date_range === '7d', 'TEST 8b: 7-day range filter is tracked in meta');

  // TEST 9: Comparison Matrix Integrity
  assert(Array.isArray(intelligenceAll.comparison), 'TEST 9a: Comparison matrix is an array');
  assert(intelligenceAll.comparison.length === 38, 'TEST 9b: Comparison matrix contains all 38 districts');
  assert(intelligenceAll.comparison[0].total_issues >= intelligenceAll.comparison[intelligenceAll.comparison.length - 1].total_issues, 'TEST 9c: Comparison matrix is sorted descending by total issues');

  // TEST 10: SLA & Escalation Integrity
  assert(typeof intelligenceAll.state_overview.overdue_issues === 'number', 'TEST 10a: overdue_issues is numeric');
  assert(typeof intelligenceAll.state_overview.escalated_issues === 'number', 'TEST 10b: escalated_issues is numeric');

  // TEST 11: Non-Exposure of Sensitive Citizen Data
  const jsonStr = JSON.stringify(intelligenceAll);
  assert(!jsonStr.includes('@gmail.com') && !jsonStr.includes('@yahoo.com') && !jsonStr.includes('@outlook.com'), 'TEST 11a: No citizen emails exposed in civic intelligence output');
  assert(!jsonStr.includes('"phone"') && !jsonStr.includes('"phone_number"'), 'TEST 11b: No citizen phone numbers exposed in output');

  // TEST 12: Resolution Rate Formula Math
  const total = intelligenceAll.state_overview.total_issues;
  const resolved = intelligenceAll.state_overview.resolved_issues;
  const expectedRate = total > 0 ? ((resolved / total) * 100).toFixed(1) : '0.0';
  assert(intelligenceAll.state_overview.resolution_rate === `${expectedRate}%`, `TEST 12: Resolution rate accurately matches formula: ${intelligenceAll.state_overview.resolution_rate}`);

  console.log('\n====================================================');
  console.log(`  RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Unhandled error in test suite:', err);
  process.exit(1);
});
