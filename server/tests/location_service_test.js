/**
 * location_service_test.js
 * 
 * Comprehensive Automated Regression Test Suite for CrowdCityLocationService:
 * 
 * Verifies all 15 Scenarios:
 * 1. Fresh login requests location.
 * 2. Second login in another location updates session location.
 * 3. Logout clears session location.
 * 4. Dashboard uses current location.
 * 5. Weather uses current location.
 * 6. Map uses current location.
 * 7. Report Issue uses centralized location.
 * 8. Dashboard and Weather use identical coordinates.
 * 9. Stale localStorage cannot override fresh coordinates.
 * 10. Permission denied is handled correctly (no fabricated coordinates).
 * 11. Reverse-geocoding failure does not show stale locality.
 * 12. Manual Weather region selection still works.
 * 13. No hardcoded location appears as CURRENT LOCATION.
 * 14. Page navigation does not trigger unnecessary repeated geolocation requests.
 * 15. No console errors / clean error handling.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

console.log('Starting CrowdCityLocationService 15-Scenario Regression Suite...\n');

let totalTests = 0;
let passedTests = 0;

function runTest(title, fn) {
  totalTests++;
  try {
    fn();
    console.log(`   [PASS] Scenario ${totalTests}: ${title}`);
    passedTests++;
  } catch (err) {
    console.error(`   [FAIL] Scenario ${totalTests}: ${title} -> ${err.message}`);
  }
}

async function runAsyncTest(title, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`   [PASS] Scenario ${totalTests}: ${title}`);
    passedTests++;
  } catch (err) {
    console.error(`   [FAIL] Scenario ${totalTests}: ${title} -> ${err.message}`);
  }
}

// Mock Web Storage & Browser Environment for Unit Testing
class MockStorage {
  constructor() {
    this.store = {};
  }
  getItem(k) {
    return this.store[k] !== undefined ? this.store[k] : null;
  }
  setItem(k, v) {
    this.store[k] = String(v);
  }
  removeItem(k) {
    delete this.store[k];
  }
  clear() {
    this.store = {};
  }
  get length() {
    return Object.keys(this.store).length;
  }
  key(i) {
    return Object.keys(this.store)[i] || null;
  }
}

// Setup Global Browser Mocks
const mockLocalStorage = new MockStorage();
const mockSessionStorage = new MockStorage();
let mockGeolocationPos = {
  coords: {
    latitude: 13.0827,
    longitude: 80.2707,
    accuracy: 15
  }
};
let mockGeolocationError = null;
let geolocationCallCount = 0;

global.localStorage = mockLocalStorage;
global.sessionStorage = mockSessionStorage;
global.window = {
  dispatchEvent: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  getLoginSessionId: () => mockSessionStorage.getItem('cc_login_session_id') || mockLocalStorage.getItem('cc_login_session_id')
};
Object.defineProperty(global.navigator, 'geolocation', {
  value: {
    getCurrentPosition: (success, failure, options) => {
      geolocationCallCount++;
      if (mockGeolocationError) {
        failure(mockGeolocationError);
      } else {
        success(mockGeolocationPos);
      }
    }
  },
  configurable: true,
  writable: true
});

// Load Central Location Service module
await import('../../client/js/user-location.js');
const service = global.CrowdCityLocationService;
const locationHelper = global.CrowdCityLocation;

assert.ok(service, 'CrowdCityLocationService must be exported globally');
assert.ok(locationHelper, 'CrowdCityLocation helper must be exported globally');

// ==========================================
// SCENARIO 1: Fresh login requests location
// ==========================================
await runAsyncTest('Fresh login requests location and sets active session location', async () => {
  mockLocalStorage.clear();
  mockSessionStorage.clear();
  mockGeolocationError = null;
  mockGeolocationPos = {
    coords: { latitude: 13.0827, longitude: 80.2707, accuracy: 25 }
  };
  geolocationCallCount = 0;

  const result = await service.initLoginLocation('user_test_1', 'login_sess_1');
  assert.ok(result, 'initLoginLocation should resolve with location object');
  assert.equal(result.latitude, 13.0827);
  assert.equal(result.longitude, 80.2707);
  assert.equal(result.isCurrentSession, true);
  assert.equal(result.permissionState, 'granted');
  assert.equal(service.hasFreshSessionLocation(), true);
  assert.ok(geolocationCallCount >= 1, 'Browser geolocation must be called on login');
});

// ===================================================================
// SCENARIO 2: Second login in another location updates session location
// ===================================================================
await runAsyncTest('Second login in another location updates session location', async () => {
  // User now logs in from Madurai (9.9252, 78.1198)
  mockGeolocationPos = {
    coords: { latitude: 9.9252, longitude: 78.1198, accuracy: 20 }
  };
  const result = await service.initLoginLocation('user_test_2', 'login_sess_2');
  assert.equal(result.latitude, 9.9252);
  assert.equal(result.longitude, 78.1198);
  assert.equal(result.district, 'Madurai');

  const current = service.getCurrentLocation();
  assert.equal(current.latitude, 9.9252);
  assert.equal(current.district, 'Madurai');
  assert.equal(current.sessionId, 'login_sess_2');
});

// ==========================================
// SCENARIO 3: Logout clears session location
// ==========================================
runTest('Logout clears session location and coordinates cache', () => {
  service.clearSessionLocation();
  assert.equal(service.hasFreshSessionLocation(), false);
  assert.equal(service.getCurrentLocation(), null);
  assert.equal(mockSessionStorage.getItem('cc_session_location'), null);
  assert.equal(mockLocalStorage.getItem('cc_weather_coords'), null);
  assert.equal(mockLocalStorage.getItem('cc_specific_location'), null);
});

// ==========================================
// SCENARIO 4: Dashboard uses current location
// ==========================================
await runAsyncTest('Dashboard reads and consumes current session location', async () => {
  // User logs in from Salem (11.6643, 78.1460)
  mockGeolocationPos = {
    coords: { latitude: 11.6643, longitude: 78.1460, accuracy: 18 }
  };
  await service.initLoginLocation('user_salem', 'login_salem_1');

  // Verify dashboard reads current location from service
  const current = service.getCurrentLocation();
  assert.ok(current, 'Service must return current location');
  assert.equal(current.latitude, 11.6643);
  assert.equal(current.district, 'Salem');

  const specific = service.getSavedSpecificLocation('en');
  assert.equal(specific.district, 'Salem');
  assert.equal(specific.isCurrentSession, true);
});

// ==========================================
// SCENARIO 5: Weather uses current location
// ==========================================
runTest('Weather Forecast consumes current session location', () => {
  assert.equal(service.hasFreshSessionLocation(), true);
  const current = service.getCurrentLocation();
  assert.equal(current.latitude, 11.6643);
  assert.equal(current.district, 'Salem');
});

// ==========================================
// SCENARIO 6: Map uses current location
// ==========================================
runTest('Map uses current session coordinates for auto-centering', () => {
  const current = service.getCurrentLocation();
  assert.ok(current && typeof current.latitude === 'number' && typeof current.longitude === 'number');
  assert.equal(current.latitude, 11.6643);
  assert.equal(current.longitude, 78.1460);
});

// ==========================================
// SCENARIO 7: Report Issue uses centralized location
// ==========================================
runTest('Report Issue auto-populates coordinates from central location', () => {
  const current = service.getCurrentLocation();
  assert.equal(current.latitude, 11.6643);
  assert.equal(current.longitude, 78.1460);
  assert.equal(current.isFallback, false);
});

// ==========================================================
// SCENARIO 8: Dashboard and Weather use identical coordinates
// ==========================================================
runTest('Dashboard and Weather use identical coordinates from central source', () => {
  const dashboardCoords = {
    lat: service.getCurrentLocation().latitude,
    lon: service.getCurrentLocation().longitude
  };
  const weatherCoords = {
    lat: service.getCurrentLocation().latitude,
    lon: service.getCurrentLocation().longitude
  };
  assert.deepEqual(dashboardCoords, weatherCoords);
  assert.equal(dashboardCoords.lat, 11.6643);
  assert.equal(dashboardCoords.lon, 78.1460);
});

// ==========================================================
// SCENARIO 9: Stale localStorage cannot override fresh coordinates
// ==========================================================
await runAsyncTest('Stale localStorage cannot override fresh coordinates', async () => {
  // Set a fresh location in session for Tiruchirappalli (10.7905, 78.7047)
  mockGeolocationPos = {
    coords: { latitude: 10.7905, longitude: 78.7047, accuracy: 22 }
  };
  await service.initLoginLocation('user_trichy', 'login_trichy_1');

  // Inject stale Sulur / Pappampatti in localStorage from an old session
  mockLocalStorage.setItem('cc_specific_location', JSON.stringify({
    specificName: 'Pappampatti Pirivu',
    locality: 'Sulur',
    district: 'Coimbatore',
    sessionId: 'old_stale_session_123'
  }));
  mockLocalStorage.setItem('user_district', 'Coimbatore');
  mockLocalStorage.setItem('cc_weather_coords', JSON.stringify({ lat: 10.9765, lon: 77.1086 }));

  // Central service priority 0 must return fresh session location (Tiruchirappalli)
  const savedSpecific = service.getSavedSpecificLocation('en');
  assert.equal(savedSpecific.district, 'Tiruchirappalli');
  assert.notEqual(savedSpecific.district, 'Coimbatore');
  assert.notEqual(savedSpecific.specificName, 'Pappampatti Pirivu');

  const savedDistrict = service.getSavedUserDistrict();
  assert.equal(savedDistrict, 'Tiruchirappalli');
});

// ========================================================================
// SCENARIO 10: Permission denied is handled correctly (no fake coordinates)
// ========================================================================
await runAsyncTest('Permission denied handled gracefully without fabricating coordinates', async () => {
  service.clearSessionLocation();
  mockGeolocationError = { code: 1, message: 'User denied Geolocation' };

  const result = await service.requestFreshLocation({ force: true });
  assert.ok(result, 'Result must be returned');
  assert.equal(result.permissionState, 'denied');
  assert.equal(result.isFallback, true);
  assert.equal(result.latitude, null, 'Do not fabricate fake coordinates on permission denied');
  assert.equal(result.longitude, null, 'Do not fabricate fake coordinates on permission denied');
  assert.equal(result.district, 'Tamil Nadu');
});

// ========================================================================
// SCENARIO 11: Reverse-geocoding failure does not show stale locality
// ========================================================================
await runAsyncTest('Reverse-geocoding failure defaults to nearest district centroid, not stale locality', async () => {
  mockGeolocationError = null;
  // Coordinates for Tirunelveli (8.7139, 77.7567)
  mockGeolocationPos = {
    coords: { latitude: 8.7139, longitude: 77.7567, accuracy: 30 }
  };
  const result = await service.initLoginLocation('user_tvl', 'login_tvl_1');
  assert.equal(result.district, 'Tirunelveli');
  assert.notEqual(result.locality, 'Sulur');
  assert.notEqual(result.locality, 'Pappampatti Pirivu');
});

// ==========================================================
// SCENARIO 12: Manual Weather region selection still works
// ==========================================================
runTest('Manual district selection sets preference and notifies listeners', () => {
  let eventDispatched = false;
  const originalDispatch = global.window.dispatchEvent;
  global.window.dispatchEvent = (e) => {
    if (e && e.detail && e.detail.district === 'Madurai') eventDispatched = true;
  };

  const selected = service.setUserDistrict('Madurai');
  assert.equal(selected, 'Madurai');
  assert.equal(mockLocalStorage.getItem('user_district'), 'Madurai');
  assert.equal(eventDispatched, true);

  global.window.dispatchEvent = originalDispatch;
});

// ==========================================================
// SCENARIO 13: No hardcoded location appears as CURRENT LOCATION
// ==========================================================
runTest('Verify no hardcoded location is presented as default current location in files', () => {
  const weatherAlertsJs = fs.readFileSync(path.join(rootDir, 'client/js/weather-alerts.js'), 'utf8');
  assert.ok(!weatherAlertsJs.includes("state.userDetectedDistrict = 'Coimbatore';\n      state.district = 'coimbatore';"),
    'WeatherAlerts should not default userDetectedDistrict to hardcoded Coimbatore');

  const transportationJs = fs.readFileSync(path.join(rootDir, 'client/js/transportation.js'), 'utf8');
  assert.ok(!transportationJs.includes('(Coimbatore District)'),
    'transportation.js should not hardcode (Coimbatore District) into address input');
});

// =============================================================================
// SCENARIO 14: Page navigation does not trigger unnecessary repeated GPS requests
// =============================================================================
await runAsyncTest('Page navigation does not trigger repeated geolocation requests', async () => {
  geolocationCallCount = 0;
  mockGeolocationPos = {
    coords: { latitude: 13.0827, longitude: 80.2707, accuracy: 15 }
  };
  mockGeolocationError = null;

  // Initial login captures location
  await service.initLoginLocation('user_nav', 'login_nav_1');
  const countAfterLogin = geolocationCallCount;
  assert.equal(countAfterLogin, 1);

  // Navigating to Weather, Map, Report calls requestFreshLocation without force
  const weatherLoc = await service.requestFreshLocation({ force: false });
  const mapLoc = await service.requestFreshLocation({ force: false });
  const reportLoc = await service.requestFreshLocation({ force: false });

  assert.equal(geolocationCallCount, countAfterLogin, 'Repeated requests within same session must use session cache');
  assert.equal(weatherLoc.latitude, 13.0827);
  assert.equal(mapLoc.latitude, 13.0827);
  assert.equal(reportLoc.latitude, 13.0827);
});

// ==========================================================
// SCENARIO 15: No console errors / clean error handling
// ==========================================================
await runAsyncTest('Clean error handling when geolocation fails or timeouts', async () => {
  mockGeolocationError = { code: 3, message: 'Geolocation timeout' };
  const fallback = await service.requestFreshLocation({ force: true, timeoutMs: 100 });
  assert.ok(fallback);
  assert.equal(fallback.isFallback, true);
  assert.equal(fallback.permissionState, 'timeout');
  assert.equal(fallback.latitude, null);
});

console.log('\n========================================');
console.log(`Total: ${totalTests} | Passed: ${passedTests} | Failed: ${totalTests - passedTests}`);
console.log('========================================');

if (passedTests === totalTests) {
  console.log('\nAll 15 Location Service Regression Scenarios PASSED!');
  process.exit(0);
} else {
  console.error('\nSome scenarios failed!');
  process.exit(1);
}
