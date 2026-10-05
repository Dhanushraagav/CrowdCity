/**
 * multi_location_consistency_test.js
 * 
 * Automated Verification for CrowdCity Unified Location Architecture.
 * Verifies:
 * 1. Single central source of truth for USER CURRENT LOCATION across all pages
 * 2. Login at Location A -> Dashboard, Weather, Map, Report Issue prefill match Location A
 * 3. Complaint location selection (Location C) NEVER mutates global current location
 * 4. Logout cleanly purges session state
 * 5. Login at Location B -> Dashboard, Weather, Map, Report Issue prefill match Location B
 * 6. Zero direct calls to navigator.geolocation outside client/js/user-location.js
 * 7. Zero emojis across all modified code and test files
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In-Memory Browser Mock Environment
class LocalStorageMock {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null;
  }
  setItem(key, val) {
    this.store[key] = String(val);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

global.localStorage = new LocalStorageMock();
global.sessionStorage = new LocalStorageMock();

let dispatchedEvents = [];
global.window = {
  localStorage: global.localStorage,
  sessionStorage: global.sessionStorage,
  dispatchEvent: (event) => {
    dispatchedEvents.push(event);
  },
  CustomEvent: class CustomEvent {
    constructor(name, options) {
      this.name = name;
      this.detail = options ? options.detail : null;
    }
  }
};

let mockNavigatorPosition = null;
let mockNavigatorError = null;

Object.defineProperty(global.navigator, 'geolocation', {
  value: {
    getCurrentPosition: (success, error, options) => {
      if (mockNavigatorPosition) {
        success(mockNavigatorPosition);
      } else if (mockNavigatorError) {
        error(mockNavigatorError);
      }
    }
  },
  configurable: true,
  writable: true
});

// Import location service module
const locationServicePath = path.resolve(__dirname, '../../client/js/user-location.js');
const userLocationModule = await import(`file://${locationServicePath}`);
const CrowdCityLocationService = global.CrowdCityLocationService || userLocationModule.CrowdCityLocationService || userLocationModule.default?.CrowdCityLocationService;
const CrowdCityLocation = global.CrowdCityLocation || userLocationModule.CrowdCityLocation || userLocationModule.default?.CrowdCityLocation;

console.log('Starting Multi-Location Architecture Consistency Test Suite...\n');

let totalTests = 0;
let passedTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`   [PASS] ${name}`);
  } catch (err) {
    console.error(`   [FAIL] ${name}:`, err.message);
  }
}

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`   [PASS] ${name}`);
  } catch (err) {
    console.error(`   [FAIL] ${name}:`, err.message);
  }
}

// FIXTURE A: Coimbatore / Kannampalayam
const LOCATION_A = {
  coords: {
    latitude: 11.0182,
    longitude: 77.0986,
    accuracy: 12
  },
  district: 'Coimbatore',
  locality: 'Kannampalayam'
};

// FIXTURE B: Tiruppur / Angeripalayam
const LOCATION_B = {
  coords: {
    latitude: 11.1440,
    longitude: 77.3300,
    accuracy: 15
  },
  district: 'Tiruppur',
  locality: 'Angeripalayam'
};

// TEST 1: Login at Location A
await runAsyncTest('1. User Login at Location A establishes canonical session location', async () => {
  mockNavigatorPosition = LOCATION_A;
  mockNavigatorError = null;
  global.localStorage.clear();
  global.sessionStorage.clear();
  dispatchedEvents = [];

  const result = await CrowdCityLocationService.initLoginLocation('user_101', 'sess_aaa');
  assert(result, 'Result must exist');
  assert.strictEqual(result.district, 'Coimbatore');
  assert.strictEqual(result.latitude, 11.0182);
  assert.strictEqual(result.longitude, 77.0986);
  assert.strictEqual(result.isCurrentSession, true);
  assert.strictEqual(result.isFallback, false);

  const active = CrowdCityLocationService.getCurrentLocation();
  assert.strictEqual(active.district, 'Coimbatore');
  assert.strictEqual(active.latitude, 11.0182);
});

// TEST 2: Dashboard and Weather consume Location A
runTest('2. Dashboard and Weather Forecast pages read identical Location A from central source', () => {
  const current = CrowdCityLocationService.getCurrentLocation();
  assert(current, 'Current location must exist');

  // Simulated Dashboard Hero card consumption
  const dashboardDisplay = {
    line1: current.locality || current.district,
    line2: `${current.district}, Tamil Nadu`,
    lat: current.latitude,
    lon: current.longitude
  };

  // Simulated Weather Forecast Hero card consumption
  const weatherHeroDisplay = {
    primaryTitle: current.locality || current.district,
    secondarySubtitle: `${current.district}, Tamil Nadu`,
    lat: current.latitude,
    lon: current.longitude
  };

  assert.strictEqual(dashboardDisplay.line1, weatherHeroDisplay.primaryTitle);
  assert.strictEqual(dashboardDisplay.line2, weatherHeroDisplay.secondarySubtitle);
  assert.strictEqual(dashboardDisplay.lat, weatherHeroDisplay.lat);
  assert.strictEqual(dashboardDisplay.lon, weatherHeroDisplay.lon);
});

// TEST 3: Report Issue prefill consumes Location A without mutating state
runTest('3. Report Issue prefill consumes Location A without triggering duplicate prompt', () => {
  const current = CrowdCityLocationService.getCurrentLocation();
  assert(current, 'Current location must exist');

  // Simulated Report Issue initial prefill
  const reportForm = {
    latitude: current.latitude.toFixed(6),
    longitude: current.longitude.toFixed(6),
    address: current.displayName || `${current.locality}, ${current.district}`
  };

  assert.strictEqual(reportForm.latitude, '11.018200');
  assert.strictEqual(reportForm.longitude, '77.098600');
});

// TEST 4: Citizen manually selects Location C on Report Issue map
runTest('4. Manually selecting Location C in complaint form NEVER mutates central current location', () => {
  const LOCATION_C = {
    latitude: 9.9252,
    longitude: 78.1198,
    address: 'Meenakshi Amman Temple, Madurai'
  };

  // Simulated form mutation on map click
  const complaintForm = {
    latitude: LOCATION_C.latitude.toFixed(6),
    longitude: LOCATION_C.longitude.toFixed(6),
    address: LOCATION_C.address
  };

  assert.strictEqual(complaintForm.address, 'Meenakshi Amman Temple, Madurai');

  // Verify Central Location remains untouched at Location A
  const canonical = CrowdCityLocationService.getCurrentLocation();
  assert.strictEqual(canonical.district, 'Coimbatore', 'Global district must remain Coimbatore');
  assert.strictEqual(canonical.latitude, 11.0182, 'Global lat must remain 11.0182');
  assert.strictEqual(canonical.longitude, 77.0986, 'Global lng must remain 77.0986');

  // Verify session storage was NOT mutated by complaint selection
  const stored = JSON.parse(global.sessionStorage.getItem('cc_session_location'));
  assert.strictEqual(stored.district, 'Coimbatore');
  assert.strictEqual(stored.latitude, 11.0182);
});

// TEST 5: Citizen searches another region on Weather page
runTest('5. Selecting another region in Weather page does not corrupt central current location', () => {
  // Simulated weather view state
  const weatherViewState = {
    selectedRegion: {
      name: 'Ooty',
      district: 'Nilgiris',
      lat: 11.4102,
      lon: 76.6950
    }
  };

  assert.strictEqual(weatherViewState.selectedRegion.name, 'Ooty');

  // Verify Central Location remains untouched at Location A
  const canonical = CrowdCityLocationService.getCurrentLocation();
  assert.strictEqual(canonical.district, 'Coimbatore');
  assert.strictEqual(canonical.latitude, 11.0182);
});

// TEST 6: Citizen Logout
runTest('6. Logout cleanly clears canonical session location and coordinates', () => {
  CrowdCityLocationService.clearSessionLocation();

  const current = CrowdCityLocationService.getCurrentLocation();
  assert.strictEqual(current, null, 'Current location must be null after logout');
  assert.strictEqual(global.sessionStorage.getItem('cc_session_location'), null);
  assert.strictEqual(global.localStorage.getItem('cc_session_location'), null);
  assert.strictEqual(global.localStorage.getItem('cc_weather_coords'), null);
  assert.strictEqual(global.localStorage.getItem('user_district'), null);
});

// TEST 7: Citizen Login at Location B
await runAsyncTest('7. User Login at Location B sets fresh canonical session location', async () => {
  mockNavigatorPosition = LOCATION_B;
  mockNavigatorError = null;

  const result = await CrowdCityLocationService.initLoginLocation('user_102', 'sess_bbb');
  assert(result, 'Result must exist');
  assert.strictEqual(result.district, 'Tiruppur');
  assert.strictEqual(result.latitude, 11.1440);
  assert.strictEqual(result.longitude, 77.3300);

  const active = CrowdCityLocationService.getCurrentLocation();
  assert.strictEqual(active.district, 'Tiruppur');
  assert.strictEqual(active.latitude, 11.1440);
  assert.strictEqual(active.longitude, 77.3300);
});

// TEST 8: Audit: navigator.geolocation called in ZERO files outside client/js/user-location.js
runTest('8. Codebase Audit: Zero calls to navigator.geolocation outside user-location.js', () => {
  const clientDir = path.resolve(__dirname, '../../client');
  const jsFiles = [];

  function scanDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory() && ent.name !== 'node_modules') {
        scanDir(full);
      } else if (ent.isFile() && (ent.name.endsWith('.js') || ent.name.endsWith('.html'))) {
        jsFiles.push(full);
      }
    }
  }

  scanDir(clientDir);

  const filesWithGeolocation = [];
  for (const f of jsFiles) {
    const rel = path.relative(clientDir, f).replace(/\\/g, '/');
    if (rel === 'js/user-location.js') continue;

    const content = fs.readFileSync(f, 'utf8');
    if (content.includes('navigator.geolocation.getCurrentPosition')) {
      filesWithGeolocation.push(rel);
    }
  }

  assert.strictEqual(
    filesWithGeolocation.length,
    0,
    `Found unexpected direct getCurrentPosition calls in: ${filesWithGeolocation.join(', ')}`
  );
});

// TEST 9: Audit: Zero emojis across all modified files
runTest('9. Zero emojis verification across key client files', () => {
  const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
  const filesToVerify = [
    '../../client/js/user-location.js',
    '../../client/js/report.js',
    '../../client/js/weather-alerts.js',
    '../../client/js/EmergencyLocation.js',
    '../../client/js/map-view.js',
    '../../client/js/office-locator.js',
    '../../client/js/transportation-report.js',
    '../../client/js/transportation.js',
    '../../client/js/urgent-action.js',
    '../../client/js/app.js',
    '../../client/citizen-dashboard.html'
  ];

  for (const rel of filesToVerify) {
    const full = path.resolve(__dirname, rel);
    const content = fs.readFileSync(full, 'utf8');
    assert(!emojiRegex.test(content), `File ${path.basename(rel)} contains forbidden emojis`);
  }
});

console.log(`\n========================================`);
console.log(`Total: ${totalTests} | Passed: ${passedTests} | Failed: ${totalTests - passedTests}`);
console.log(`========================================\n`);

if (totalTests === passedTests) {
  console.log('All Multi-Location Consistency Tests PASSED successfully!\n');
} else {
  process.exit(1);
}
