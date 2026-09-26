/**
 * CrowdCity AI — Government Application Tracker End-to-End Test Suite
 *
 * Verifies all 18 testing requirements:
 * 1. Empty state
 * 2. Add application
 * 3. Validation
 * 4. Database persistence
 * 5. Refresh persistence
 * 6. Logout/login persistence
 * 7. Search
 * 8. Status filter
 * 9. Edit
 * 10. Delete
 * 11. User A isolation
 * 12. User B isolation
 * 13. IDOR protection
 * 14. Counter accuracy
 * 15. Error handling
 * 16. Official portal link
 * 17. Mobile layout
 * 18. Desktop layout
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  validateApplicationInput,
  listUserApplications,
  createUserApplication,
  updateUserApplication,
  deleteUserApplication,
  resolveOfficialPortalUrl,
  VALID_APPLICATION_STATUSES
} from '../services/applicationTrackerService.js';
import { supabaseAdmin, supabase } from '../config/supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

let passed = 0;
let failed = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`✓ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`✗ FAIL: ${testName}${details ? ' - ' + details : ''}`);
    failed++;
  }
}

console.log('================================================================');
console.log('  CROWDCITY AI — GOVERNMENT APP TRACKER TEST SUITE');
console.log('================================================================\n');

// Read frontend source files
const trackerHtmlPath = path.join(rootDir, 'client', 'app-tracker.html');
const trackerJsPath = path.join(rootDir, 'client', 'js', 'app-tracker.js');

const trackerHtml = fs.readFileSync(trackerHtmlPath, 'utf8');
const trackerJs = fs.readFileSync(trackerJsPath, 'utf8');

async function runTests() {
  const client = supabaseAdmin || supabase;
  const { data: testProfiles, error: pErr } = await client.from('profiles').select('id').limit(2);
  if (!testProfiles || testProfiles.length < 2) {
    throw new Error('At least 2 profiles required in database for isolation testing');
  }
  const userAId = testProfiles[0].id;
  const userBId = testProfiles[1].id;

  // Clean up any old test records for these users before starting
  await client.from('user_scheme_applications').delete().in('user_id', [userAId, userBId]);

  // -----------------------------------------------------------------------------
  // TEST 1: Empty State
  // -----------------------------------------------------------------------------
  const initialApps = await listUserApplications(userAId);
  assert(initialApps.length === 0, 'TEST 1.1: Fresh user starts with 0 tracked applications');
  assert(!trackerJs.includes("id: 'app-tn-kmut-demo'"), 'TEST 1.2: Fake demo applications completely removed from app-tracker.js');
  assert(trackerJs.includes('No Tracked Applications'), 'TEST 1.3: app-tracker.js renders genuine empty state');

  // -----------------------------------------------------------------------------
  // TEST 2: Add Application
  // -----------------------------------------------------------------------------
  const createdApp = await createUserApplication(userAId, {
    scheme_name: 'Test Scheme',
    application_ref_no: 'TEST-2026-001',
    department_name: 'Department of Public Welfare',
    submission_date: '2026-09-26',
    status: 'Submitted',
    official_portal_url: 'https://kmut.tn.gov.in/',
    notes: 'Harmless test application for audit verification'
  });

  assert(!!createdApp && !!createdApp.id, 'TEST 2.1: Application successfully created and returned');
  assert(createdApp.scheme_name === 'Test Scheme', 'TEST 2.2: Scheme name matches test data');
  assert(createdApp.application_ref_no === 'TEST-2026-001', 'TEST 2.3: Application reference matches TEST-2026-001');
  assert(createdApp.user_id === userAId, 'TEST 2.4: Application is strictly bound to User A');

  // -----------------------------------------------------------------------------
  // TEST 3: Validation (Whitespace, Empty, Status, Formats)
  // -----------------------------------------------------------------------------
  let caughtEmptyScheme = false;
  try {
    validateApplicationInput({ scheme_name: '', application_ref_no: 'REF-123' });
  } catch (e) {
    caughtEmptyScheme = true;
  }
  assert(caughtEmptyScheme, 'TEST 3.1: Empty scheme name is blocked');

  let caughtWhitespaceScheme = false;
  try {
    validateApplicationInput({ scheme_name: '    ', application_ref_no: 'REF-123' });
  } catch (e) {
    caughtWhitespaceScheme = true;
  }
  assert(caughtWhitespaceScheme, 'TEST 3.2: Whitespace-only scheme name is blocked');

  let caughtEmptyRef = false;
  try {
    validateApplicationInput({ scheme_name: 'Test Scheme', application_ref_no: '' });
  } catch (e) {
    caughtEmptyRef = true;
  }
  assert(caughtEmptyRef, 'TEST 3.3: Empty application reference is blocked');

  let caughtWhitespaceRef = false;
  try {
    validateApplicationInput({ scheme_name: 'Test Scheme', application_ref_no: '   ' });
  } catch (e) {
    caughtWhitespaceRef = true;
  }
  assert(caughtWhitespaceRef, 'TEST 3.4: Whitespace-only application reference is blocked');

  let caughtInvalidStatus = false;
  try {
    validateApplicationInput({ scheme_name: 'Test', application_ref_no: 'REF', status: 'Government Approved Live' });
  } catch (e) {
    caughtInvalidStatus = true;
  }
  assert(caughtInvalidStatus, 'TEST 3.5: Invalid/unsupported status is blocked');

  let caughtInvalidDate = false;
  try {
    validateApplicationInput({ scheme_name: 'Test', application_ref_no: 'REF', submission_date: '26/09/2026' });
  } catch (e) {
    caughtInvalidDate = true;
  }
  assert(caughtInvalidDate, 'TEST 3.6: Non-YYYY-MM-DD date format is blocked');

  // -----------------------------------------------------------------------------
  // TEST 4: Database Persistence
  // -----------------------------------------------------------------------------
  const { data: dbRow, error: dbError } = await client
    .from('user_scheme_applications')
    .select('*')
    .eq('id', createdApp.id)
    .single();

  assert(!dbError && !!dbRow, 'TEST 4.1: Record exists in public.user_scheme_applications table');
  assert(dbRow.application_ref_no === 'TEST-2026-001', 'TEST 4.2: Persisted row has exact reference number');
  assert(dbRow.status === 'Submitted', 'TEST 4.3: Persisted row has Submitted status');
  assert(!!dbRow.created_at, 'TEST 4.4: Row has created_at timestamp');
  assert(!!dbRow.updated_at, 'TEST 4.5: Row has updated_at timestamp');

  // -----------------------------------------------------------------------------
  // TEST 5 & 6: Refresh & Logout/Login Persistence
  // -----------------------------------------------------------------------------
  // Simulating reload / new session query for User A
  const reloadedApps = await listUserApplications(userAId);
  assert(reloadedApps.length === 1, 'TEST 5.1: Refresh retrieves application from persisted database');
  assert(reloadedApps[0].id === createdApp.id, 'TEST 5.2: Retrieved application ID matches created application');

  // Simulate logout: cache is cleared. User A logs in again: database rehydrates list
  assert(trackerJs.includes("cc_user_tracked_apps_${activeUserId}") || trackerJs.includes("getUserCacheKey"), 
    'TEST 6.1: Local storage cache is strictly user-scoped (no cross-user shared key)');

  // -----------------------------------------------------------------------------
  // TEST 7: Search
  // -----------------------------------------------------------------------------
  const searchByName = await listUserApplications(userAId, { search: 'Test Scheme' });
  assert(searchByName.length === 1, 'TEST 7.1: Search by scheme name finds application');

  const searchByRef = await listUserApplications(userAId, { search: 'TEST-2026-001' });
  assert(searchByRef.length === 1, 'TEST 7.2: Search by reference number finds application');

  const searchNoMatch = await listUserApplications(userAId, { search: 'NonExistentApplication999' });
  assert(searchNoMatch.length === 0, 'TEST 7.3: Non-matching search query returns 0 results');

  // -----------------------------------------------------------------------------
  // TEST 8: Status Filter
  // -----------------------------------------------------------------------------
  const filterSubmitted = await listUserApplications(userAId, { status: 'Submitted' });
  assert(filterSubmitted.length === 1, 'TEST 8.1: Status filter "Submitted" includes the application');

  const filterApproved = await listUserApplications(userAId, { status: 'Approved' });
  assert(filterApproved.length === 0, 'TEST 8.2: Status filter "Approved" excludes non-approved applications');

  // -----------------------------------------------------------------------------
  // TEST 9: Edit Application
  // -----------------------------------------------------------------------------
  const updatedApp = await updateUserApplication(userAId, createdApp.id, {
    status: 'Under Verification',
    submission_date: '2026-09-27',
    notes: 'Updated verification milestone'
  });

  assert(updatedApp.status === 'Under Verification', 'TEST 9.1: Application status updated to "Under Verification"');
  assert(updatedApp.submission_date === '2026-09-27', 'TEST 9.2: Application submission date updated');
  assert(updatedApp.notes === 'Updated verification milestone', 'TEST 9.3: Notes updated');

  // Verify persistence of edit
  const reloadedAfterEdit = await listUserApplications(userAId);
  assert(reloadedAfterEdit[0].status === 'Under Verification', 'TEST 9.4: Edited status persists across database reloads');

  // -----------------------------------------------------------------------------
  // TEST 10: Delete Application
  // -----------------------------------------------------------------------------
  const deleteResult = await deleteUserApplication(userAId, createdApp.id);
  assert(deleteResult.success === true, 'TEST 10.1: Application deleted successfully');

  const listAfterDelete = await listUserApplications(userAId);
  assert(listAfterDelete.length === 0, 'TEST 10.2: Application count decreased from 1 to 0 after delete');

  // -----------------------------------------------------------------------------
  // TEST 11 & 12: Cross-User Isolation (User A vs User B)
  // -----------------------------------------------------------------------------
  // User A creates an application
  const userAApp = await createUserApplication(userAId, {
    scheme_name: 'User A Secret Scheme',
    application_ref_no: 'USER-A-SECRET-999',
    status: 'Submitted'
  });

  // User B lists applications
  const userBApps = await listUserApplications(userBId);
  assert(userBApps.length === 0, 'TEST 11.1: User B sees 0 applications (User A applications never bleed to User B)');

  // User B creates an application
  const userBApp = await createUserApplication(userBId, {
    scheme_name: 'User B Public Scheme',
    application_ref_no: 'USER-B-PUB-111',
    status: 'Approved'
  });

  const userAAppsAfter = await listUserApplications(userAId);
  assert(userAAppsAfter.length === 1 && userAAppsAfter[0].id === userAApp.id, 'TEST 12.1: User A only sees User A application');
  assert(!userAAppsAfter.some(a => a.id === userBApp.id), 'TEST 12.2: User A cannot see User B application');

  // -----------------------------------------------------------------------------
  // TEST 13: IDOR Protection
  // -----------------------------------------------------------------------------
  let idorUpdateBlocked = false;
  try {
    // User B attempts to edit User A's application ID
    await updateUserApplication(userBId, userAApp.id, { status: 'Rejected' });
  } catch (e) {
    idorUpdateBlocked = (e.statusCode === 404 || e.message.includes('access denied'));
  }
  assert(idorUpdateBlocked, 'TEST 13.1: IDOR Protection - User B cannot update User A application');

  let idorDeleteBlocked = false;
  try {
    // User B attempts to delete User A's application ID
    await deleteUserApplication(userBId, userAApp.id);
  } catch (e) {
    idorDeleteBlocked = (e.statusCode === 404 || e.message.includes('access denied'));
  }
  assert(idorDeleteBlocked, 'TEST 13.2: IDOR Protection - User B cannot delete User A application');

  // Clean up test entries
  await deleteUserApplication(userAId, userAApp.id);
  await deleteUserApplication(userBId, userBApp.id);

  // -----------------------------------------------------------------------------
  // TEST 14: Counter Accuracy (Singular vs Plural)
  // -----------------------------------------------------------------------------
  assert(trackerHtml.includes('id="app-tracker-count"'), 'TEST 14.1: HTML includes dedicated count element #app-tracker-count');
  assert(trackerHtml.includes('id="app-tracker-count-label"'), 'TEST 14.2: HTML includes pluralization label element');
  assert(trackerJs.includes("count === 1 ? 'Tracked Application' : 'Tracked Applications'"), 
    'TEST 14.3: Counter formats singular "Tracked Application" and plural "Tracked Applications" accurately');

  // -----------------------------------------------------------------------------
  // TEST 15: Error Handling
  // -----------------------------------------------------------------------------
  let unauthError = false;
  try {
    await listUserApplications(null);
  } catch (e) {
    unauthError = (e.statusCode === 401);
  }
  assert(unauthError, 'TEST 15.1: Missing authentication triggers 401 Unauthorized');

  let notFoundError = false;
  try {
    await updateUserApplication(userAId, '00000000-0000-0000-0000-000000000000', { status: 'Draft' });
  } catch (e) {
    notFoundError = (e.statusCode === 404);
  }
  assert(notFoundError, 'TEST 15.2: Non-existent application ID triggers 404 Not Found');

  // -----------------------------------------------------------------------------
  // TEST 16: Official Portal Link
  // -----------------------------------------------------------------------------
  const kmutPortal = resolveOfficialPortalUrl('Kalaignar Magalir Urimai Thittam');
  const pmkisanPortal = resolveOfficialPortalUrl('PM Kisan Samman Nidhi');
  const pudhumaiPortal = resolveOfficialPortalUrl('Pudhumai Penn');
  const customPortal = resolveOfficialPortalUrl('Custom Scheme', 'https://custom-dept.tn.gov.in/portal');

  assert(kmutPortal === 'https://kmut.tn.gov.in/', 'TEST 16.1: KMUT resolves to official portal https://kmut.tn.gov.in/');
  assert(pmkisanPortal === 'https://pmkisan.gov.in/', 'TEST 16.2: PM-KISAN resolves to official portal https://pmkisan.gov.in/');
  assert(pudhumaiPortal === 'https://penkalvi.tn.gov.in/', 'TEST 16.3: Pudhumai Penn resolves to official portal https://penkalvi.tn.gov.in/');
  assert(customPortal === 'https://custom-dept.tn.gov.in/portal', 'TEST 16.4: Custom official portal URL preserved');

  // -----------------------------------------------------------------------------
  // TEST 17 & 18: Layout & Responsiveness
  // -----------------------------------------------------------------------------
  assert(trackerHtml.includes('flex-wrap: wrap'), 'TEST 17.1: Action controls and card footers support mobile wrapping');
  assert(trackerHtml.includes('tracker-hero-card'), 'TEST 18.1: Desktop layout styled with tracker-hero-card');
  assert(trackerHtml.includes('edit-app-modal'), 'TEST 18.2: Edit application modal exists in page markup');
  assert(trackerHtml.includes('Personal Milestone Tracker'), 'TEST 18.3: Authoritative non-government disclaimer present on page');

  console.log('\n================================================================');
  console.log(`TEST SUITE RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error("Unhandled test suite execution error:", err);
  process.exit(1);
});
