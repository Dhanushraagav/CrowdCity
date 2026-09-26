/**
 * office_locator_test.js
 * 
 * Comprehensive 20-Point Automated Verification Suite for
 * CrowdCity AI - Tamil Nadu Government Office & E-Sevai Locator.
 */

import assert from 'assert';
import {
  calculateHaversineDistanceKm,
  formatDistance,
  buildMapLinks,
  getGovernmentOffices,
  getOfficeById,
  getDistrictsAndTaluks
} from '../services/officeService.js';
import { AUTHORITATIVE_GOVERNMENT_OFFICES } from '../data/authoritativeOfficesData.js';
import { TN_DISTRICTS } from '../config/districtsConfig.js';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

async function runTest(testNumber, name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  ✓ [TEST ${testNumber.toString().padStart(2, '0')}/20 PASS] ${name}`);
  } catch (err) {
    failedTests++;
    console.error(`  ✗ [TEST ${testNumber.toString().padStart(2, '0')}/20 FAIL] ${name}`);
    console.error(`    Details: ${err.message}`);
  }
}

async function runOfficeLocatorTestSuite() {
  console.log('\n============================================================');
  console.log('🏛️  CROWDCITY AI - GOVERNMENT OFFICE LOCATOR 20-POINT TEST');
  console.log('============================================================\n');

  // Test 1: Service API returns success and structured response
  await runTest(1, 'Baseline offices query returns success with metadata', async () => {
    const res = await getGovernmentOffices();
    assert.strictEqual(res.success, true, 'Result should have success: true');
    assert(Array.isArray(res.data), 'Data should be an array');
    assert(res.total > 0, 'Total should be greater than zero');
    assert(res.metadata.authoritativeSource.includes('Tamil Nadu'), 'Metadata source should cite official portals');
  });

  // Test 2: Statewide coverage exceeds the old 4-office limitation
  await runTest(2, 'Data completeness resolves the 4-office limitation (has 50+ offices statewide)', async () => {
    const res = await getGovernmentOffices();
    assert(res.total >= 50, `Expected at least 50 authoritative offices across TN, got ${res.total}`);
    assert(res.total > 4, 'Root cause resolution verified: Results are not capped at 4 or 6');
  });

  // Test 3: District filter for Chennai
  await runTest(3, 'District filter accurately isolates Chennai offices', async () => {
    const res = await getGovernmentOffices({ district: 'Chennai' });
    assert(res.data.length > 0, 'Should find Chennai offices');
    res.data.forEach(off => {
      assert.strictEqual(off.district.toLowerCase(), 'chennai', `Office ${off.id} district should be Chennai`);
    });
  });

  // Test 4: District filter for Coimbatore
  await runTest(4, 'District filter accurately isolates Coimbatore offices', async () => {
    const res = await getGovernmentOffices({ district: 'Coimbatore' });
    assert(res.data.length > 0, 'Should find Coimbatore offices');
    res.data.forEach(off => {
      assert.strictEqual(off.district.toLowerCase(), 'coimbatore', `Office ${off.id} district should be Coimbatore`);
    });
  });

  // Test 5: District filter for Madurai
  await runTest(5, 'District filter accurately isolates Madurai offices', async () => {
    const res = await getGovernmentOffices({ district: 'Madurai' });
    assert(res.data.length > 0, 'Should find Madurai offices');
    res.data.forEach(off => {
      assert.strictEqual(off.district.toLowerCase(), 'madurai', `Office ${off.id} district should be Madurai`);
    });
  });

  // Test 6: Office type filter for Collectorates
  await runTest(6, 'Office type filter returns all 38 District Collectorates', async () => {
    const res = await getGovernmentOffices({ type: 'collectorate' });
    assert(res.data.length >= 38, `Expected at least 38 collectorates across TN, got ${res.data.length}`);
    res.data.forEach(off => {
      assert.strictEqual(off.office_type, 'collectorate', `Office ${off.id} must be collectorate`);
    });
  });

  // Test 7: Office type filter for E-Sevai Centers
  await runTest(7, 'Office type filter returns verified E-Sevai Centers', async () => {
    const res = await getGovernmentOffices({ type: 'esevai' });
    assert(res.data.length > 0, 'Should return verified e-Sevai centers');
    res.data.forEach(off => {
      assert.strictEqual(off.office_type, 'esevai', `Office ${off.id} must be esevai`);
    });
  });

  // Test 8: Office type filter for Taluk Revenue Offices
  await runTest(8, 'Office type filter returns Taluk Revenue Offices', async () => {
    const res = await getGovernmentOffices({ type: 'taluk' });
    assert(res.data.length > 0, 'Should return taluk revenue offices');
    res.data.forEach(off => {
      assert.strictEqual(off.office_type, 'taluk', `Office ${off.id} must be taluk`);
    });
  });

  // Test 9: Office type filter for VAO Offices
  await runTest(9, 'Office type filter returns VAO Offices', async () => {
    const res = await getGovernmentOffices({ type: 'vao' });
    assert(res.data.length > 0, 'Should return VAO offices');
    res.data.forEach(off => {
      assert.strictEqual(off.office_type, 'vao', `Office ${off.id} must be vao`);
    });
  });

  // Test 10: Free-text search by service keyword
  await runTest(10, 'Search keyword "Patta" finds revenue offices handling land administration', async () => {
    const res = await getGovernmentOffices({ search: 'Patta' });
    assert(res.data.length > 0, 'Should return offices providing Patta services');
    res.data.forEach(off => {
      const matchInServices = Array.isArray(off.services) && off.services.some(s => s.toLowerCase().includes('patta'));
      const matchInText = (off.name + off.department + off.address).toLowerCase().includes('patta');
      assert(matchInServices || matchInText, `Office ${off.id} must relate to search keyword Patta`);
    });
  });

  // Test 11: Pincode search
  await runTest(11, 'Search by pincode "600001" accurately returns North Chennai offices', async () => {
    const res = await getGovernmentOffices({ search: '600001' });
    assert(res.data.length > 0, 'Should find office with pincode 600001');
    assert(res.data.some(o => o.pincode === '600001'), 'Must include 600001 office');
  });

  // Test 12: Taluk-specific filter
  await runTest(12, 'Taluk filter restricts to specific taluk jurisdiction', async () => {
    const res = await getGovernmentOffices({ taluk: 'Guindy' });
    assert(res.data.length > 0, 'Should return Guindy taluk offices');
    res.data.forEach(off => {
      assert(off.taluk.toLowerCase().includes('guindy'), `Office ${off.id} taluk must match Guindy`);
    });
  });

  // Test 13: Combined Multi-Criteria Filter (District + Type + Search)
  await runTest(13, 'Multi-criteria filter (District: Chennai, Type: taluk, Search: Guindy)', async () => {
    const res = await getGovernmentOffices({
      district: 'Chennai',
      type: 'taluk',
      search: 'Guindy'
    });
    assert(res.data.length >= 1, 'Should find matching Guindy taluk office in Chennai');
    res.data.forEach(off => {
      assert.strictEqual(off.district.toLowerCase(), 'chennai');
      assert.strictEqual(off.office_type, 'taluk');
      assert(off.name.toLowerCase().includes('guindy') || off.taluk.toLowerCase().includes('guindy'));
    });
  });

  // Test 14: Geolocation Proximity Sorting (Haversine Euclidean distance)
  await runTest(14, 'Geolocation proximity sorting puts closest offices first', async () => {
    // Guindy coordinate: 13.0067, 80.2020
    const res = await getGovernmentOffices({ lat: 13.0067, lng: 80.2020 });
    assert(res.data.length > 0, 'Should return proximity-sorted offices');
    assert(res.data[0].distance_km !== null, 'Closest office must have calculated distance_km');
    assert(res.data[0].distance_km < 3, `Closest office should be within 3km of Guindy, got ${res.data[0].distance_km}km`);
    
    // Check ascending sort
    for (let i = 0; i < res.data.length - 1; i++) {
      if (res.data[i].distance_km !== null && res.data[i + 1].distance_km !== null) {
        assert(res.data[i].distance_km <= res.data[i + 1].distance_km, 'Offices must be sorted ascending by distance');
      }
    }
  });

  // Test 15: Geolocation Radius Filter
  await runTest(15, 'Geolocation radius filter strictly limits results to radius boundary', async () => {
    const res = await getGovernmentOffices({
      lat: 13.0827,
      lng: 80.2707, // Chennai Central
      radiusKm: 15
    });
    assert(res.data.length > 0, 'Should find offices within 15 km of Chennai Central');
    res.data.forEach(off => {
      assert(off.distance_km <= 15, `Office ${off.id} distance ${off.distance_km} exceeds 15 km radius`);
    });
  });

  // Test 16: Pagination handling
  await runTest(16, 'Pagination parameters slice results without data corruption', async () => {
    const page1 = await getGovernmentOffices({ page: 1, limit: 5 });
    const page2 = await getGovernmentOffices({ page: 2, limit: 5 });
    assert.strictEqual(page1.data.length, 5, 'Page 1 should have 5 items');
    assert.strictEqual(page2.data.length, 5, 'Page 2 should have 5 items');
    assert.notStrictEqual(page1.data[0].id, page2.data[0].id, 'Page 1 and Page 2 should have distinct items');
    assert(page1.totalPages > 1, 'Total pages should be greater than 1');
  });

  // Test 17: Single office lookup by ID
  await runTest(17, 'Office detail lookup by ID returns correct office with map directions', async () => {
    const office = await getOfficeById('off-col-chennai');
    assert(office !== null, 'Should find office off-col-chennai');
    assert.strictEqual(office.name, 'Chennai District Collectorate');
    assert(office.directions_url.includes('google.com/maps'), 'Directions URL should be present');
  });

  // Test 18: Districts directory coverage
  await runTest(18, 'Districts directory covers all 38 districts of Tamil Nadu', async () => {
    const dir = await getDistrictsAndTaluks();
    assert.strictEqual(dir.success, true);
    assert.strictEqual(dir.districts.length, 38, `Expected all 38 districts, got ${dir.districts.length}`);
    
    // Verify every TN district is present
    TN_DISTRICTS.forEach(d => {
      const found = dir.districts.find(item => item.name.toLowerCase() === d.name.toLowerCase());
      assert(found, `District ${d.name} must exist in districts directory`);
    });
  });

  // Test 19: Strict Zero-Fabrication Validation
  await runTest(19, 'Authoritative provenance: 100% of offices have official sources and active status', async () => {
    const offices = AUTHORITATIVE_GOVERNMENT_OFFICES;
    assert(offices.length > 0, 'Authoritative offices array must not be empty');

    offices.forEach(off => {
      assert(off.id, `Office missing id: ${JSON.stringify(off)}`);
      assert(off.name, `Office ${off.id} missing name`);
      assert(off.office_type, `Office ${off.id} missing office_type`);
      assert(off.department, `Office ${off.id} missing department`);
      assert(off.address, `Office ${off.id} missing address`);
      assert(off.district, `Office ${off.id} missing district`);
      assert(typeof off.latitude === 'number', `Office ${off.id} invalid latitude`);
      assert(typeof off.longitude === 'number', `Office ${off.id} invalid longitude`);
      assert(off.source_name, `Office ${off.id} missing source_name`);
      assert(off.source_url, `Office ${off.id} missing source_url`);
      assert.strictEqual(off.is_verified, true, `Office ${off.id} must be marked is_verified: true`);
      assert.strictEqual(off.is_active, true, `Office ${off.id} must be marked is_active: true`);
    });
  });

  // Test 20: Robustness, edge cases, and empty queries
  await runTest(20, 'Robustness against invalid inputs, non-numeric coordinates, and non-matching searches', async () => {
    // Non-matching search returns 0 without crashing
    const emptyRes = await getGovernmentOffices({ search: 'xyznonexistent123abc' });
    assert.strictEqual(emptyRes.success, true);
    assert.strictEqual(emptyRes.total, 0);
    assert.strictEqual(emptyRes.data.length, 0);

    // Invalid coordinates do not crash proximity sorting
    const badCoordRes = await getGovernmentOffices({ lat: 'not-a-number', lng: 'invalid' });
    assert.strictEqual(badCoordRes.success, true);
    assert(badCoordRes.data.length > 0, 'Should fall back gracefully without crashing');

    // Negative page or high page
    const highPageRes = await getGovernmentOffices({ page: 9999, limit: 10 });
    assert.strictEqual(highPageRes.success, true);
    assert.strictEqual(highPageRes.data.length, 0);
  });

  console.log('\n============================================================');
  console.log(`📊 TEST RESULTS: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
  console.log('============================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runOfficeLocatorTestSuite();
