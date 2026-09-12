/**
 * emergency_services_test.js
 * 
 * Comprehensive Automated Verification Suite for Location-First Emergency Assistance in CrowdCity AI.
 * Tests:
 * 1. Haversine distance accuracy & distance formatting
 * 2. Nearby services discovery with live GPS coordinates
 * 3. Strict nearest-first sorting across all categories
 * 4. District fallback when coordinates are missing
 * 5. Error handling for invalid/missing location
 * 6. Authenticity & Data Quality (No AI hallucinations, no fake phone numbers, valid source attributions)
 * 7. Category filtering and limit enforcement
 * 8. Status and source metadata endpoint
 */

import assert from 'assert';
import {
  calculateHaversineDistanceKm,
  formatDistance,
  getDirectionsUrl,
  getNearbyEmergencyServices,
  getOfficialSourceStatus
} from '../services/emergencyService.js';

let totalTests = 0;
let passedTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    Error: ${err.message}`);
  }
}

async function asyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    Error: ${err.message}`);
  }
}

console.log('\n🧪 Starting CrowdCity Emergency Services Test Suite...\n');

// 1. Haversine Distance & Formatting Tests
test('Haversine distance calculation produces accurate geometric distance', () => {
  // Distance between Chennai Central (13.0827, 80.2707) and Guindy (13.0067, 80.2085) is ~10.8 km
  const dist = calculateHaversineDistanceKm(13.0827, 80.2707, 13.0067, 80.2085);
  assert(dist > 10 && dist < 12, `Expected distance ~10.8 km, got ${dist}`);
  
  // Same point distance should be 0
  const zeroDist = calculateHaversineDistanceKm(11.0, 77.0, 11.0, 77.0);
  assert.strictEqual(Math.round(zeroDist), 0);
});

test('Format distance correctly handles meters vs kilometers', () => {
  assert.strictEqual(formatDistance(0.45), '450 m');
  assert.strictEqual(formatDistance(0.05), '50 m');
  assert.strictEqual(formatDistance(1.23), '1.2 km');
  assert.strictEqual(formatDistance(14.89), '14.9 km');
});

test('Directions URL points to valid Google Maps destination', () => {
  const url = getDirectionsUrl(13.0817, 80.2778);
  assert(url.includes('https://www.google.com/maps/dir/?api=1'));
  assert(url.includes('destination=13.0817,80.2778'));
});

// 2. Proximity Queries with Live Coordinates
await asyncTest('GPS Coordinates (Chennai) discovers nearby Chennai facilities', async () => {
  // Chennai Central coordinates
  const res = await getNearbyEmergencyServices({
    latitude: 13.0827,
    longitude: 80.2707,
    limit: 5
  });

  assert.strictEqual(res.success, true);
  assert.strictEqual(res.location.district, 'Chennai');
  assert(res.results.hospitals.length > 0, 'Should return nearby hospitals');
  assert(res.results.ambulances.length > 0, 'Should return nearby ambulances');
  assert(res.results.police_stations.length > 0, 'Should return nearby police stations');
  assert(res.results.fire_stations.length > 0, 'Should return nearby fire stations');

  // Closest hospital to Chennai Central should be RGGGH (within ~1.5 km)
  const topHosp = res.results.hospitals[0];
  assert(topHosp.distanceKm < 3.0, `Top hospital should be close, got ${topHosp.distanceKm} km`);
  assert(topHosp.name.includes('Rajiv Gandhi') || topHosp.name.includes('RGGGH'), 'Expected RGGGH as nearest hospital');
});

await asyncTest('GPS Coordinates (Coimbatore / Sulur) discovers nearby Coimbatore facilities', async () => {
  // Coordinates around Sulur, Coimbatore
  const res = await getNearbyEmergencyServices({
    latitude: 11.0264,
    longitude: 77.1264,
    limit: 5
  });

  assert.strictEqual(res.success, true);
  assert.strictEqual(res.location.district, 'Coimbatore');
  assert(res.results.hospitals.length > 0);
  
  // Nearest hospital should be Sulur GH (< 1 km)
  const topHosp = res.results.hospitals[0];
  assert(topHosp.distanceKm < 2.0);
  assert(topHosp.name.includes('Sulur') || topHosp.name.includes('Coimbatore'));
});

// 3. Strict Nearest-First Sorting
await asyncTest('All returned category lists are strictly sorted nearest first', async () => {
  const res = await getNearbyEmergencyServices({
    latitude: 11.6643,
    longitude: 78.1460, // Salem
    limit: 10
  });

  ['hospitals', 'ambulances', 'police_stations', 'fire_stations'].forEach(cat => {
    const list = res.results[cat];
    assert(list.length > 0, `${cat} should have results`);
    for (let i = 1; i < list.length; i++) {
      assert(
        list[i].distanceKm >= list[i - 1].distanceKm,
        `${cat} item ${i} (${list[i].distanceKm} km) should be >= item ${i-1} (${list[i-1].distanceKm} km)`
      );
    }
  });
});

// 4. Manual District Fallback
await asyncTest('Manual district fallback resolves centroid coordinates and discovers services', async () => {
  const res = await getNearbyEmergencyServices({
    districtId: 'namakkal',
    limit: 5
  });

  assert.strictEqual(res.success, true);
  assert.strictEqual(res.location.district, 'Namakkal');
  assert(res.results.hospitals.length > 0);
  assert(res.results.hospitals.some(h => h.name.includes('Namakkal')));
});

// 5. Missing / Invalid Inputs
await asyncTest('Missing coordinates and districtId returns clean error message', async () => {
  const res = await getNearbyEmergencyServices({});
  assert.strictEqual(res.success, false);
  assert(res.error.includes('Valid coordinates'));
});

// 6. Data Integrity & Authenticity
await asyncTest('All services have authentic metadata and NO hallucinated data', async () => {
  const res = await getNearbyEmergencyServices({
    latitude: 13.0827,
    longitude: 80.2707,
    limit: 20
  });

  const allReturned = [
    ...res.results.hospitals,
    ...res.results.ambulances,
    ...res.results.police_stations,
    ...res.results.fire_stations
  ];

  allReturned.forEach(svc => {
    assert(svc.id && svc.id.length > 3, 'Service must have an id');
    assert(svc.name && svc.name.trim().length > 3, 'Service must have a name');
    assert(svc.address && svc.address.trim().length > 5, 'Service must have an address');
    assert(typeof svc.latitude === 'number' && !isNaN(svc.latitude), 'Valid latitude');
    assert(typeof svc.longitude === 'number' && !isNaN(svc.longitude), 'Valid longitude');
    assert(svc.source_name && svc.source_name.trim().length > 0, 'Must have official source attribution');
    assert.strictEqual(svc.is_verified, true, 'Must be verified');

    // Phone must be verified string or null (never "555-xxx" or dummy pattern)
    if (svc.phone) {
      assert(typeof svc.phone === 'string');
      assert(!svc.phone.includes('1234567890'), 'No dummy phone numbers allowed');
      assert(!svc.phone.includes('0000000'), 'No placeholder phone numbers');
    }
  });
});

// 7. Category Filter Support
await asyncTest('Single serviceType filter returns only that category', async () => {
  const res = await getNearbyEmergencyServices({
    latitude: 9.9252,
    longitude: 78.1198, // Madurai
    serviceType: 'police_station',
    limit: 3
  });

  assert.strictEqual(res.success, true);
  assert(res.results.police_stations && res.results.police_stations.length > 0);
  assert.strictEqual(res.results.hospitals, undefined);
  assert.strictEqual(res.results.ambulances, undefined);
  assert.strictEqual(res.results.fire_stations, undefined);
  assert(res.results.police_stations.length <= 3);
});

// 8. Official Status & Compliance Metadata
test('Official status endpoint returns authoritative government sources', () => {
  const status = getOfficialSourceStatus();
  assert(Array.isArray(status.sources));
  assert(status.sources.length >= 4);
  assert(status.sources.some(s => s.authority.includes('Health and Family Welfare')));
  assert(status.sources.some(s => s.authority.includes('Police')));
  assert(status.sources.some(s => s.authority.includes('Fire and Rescue')));
  assert(status.compliance.includes('Zero AI-generated records'));
});

console.log('\n========================================');
console.log(`Total: ${totalTests} | Passed: ${passedTests} | Failed: ${totalTests - passedTests}`);
console.log('========================================');

if (totalTests !== passedTests) {
  process.exit(1);
} else {
  console.log('All Emergency Services tests passed successfully! ✨\n');
}
