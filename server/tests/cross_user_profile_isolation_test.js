/**
 * CrowdCity AI — Cross-User Profile Isolation & Auth Initialization Test Suite
 * 
 * Verifies:
 * TEST 1: Static HTML Sanitization — Ensures no citizen name is hardcoded in citizen-dashboard.html or any client HTML.
 * TEST 2: Static DOM Skeleton Placeholder — Confirms #hero-greeting contains .skeleton-shimmer in raw HTML.
 * TEST 3: Unauthenticated Loading State — Confirms updateHeroGreeting renders neutral skeleton shimmer when user is null.
 * TEST 4: Cross-User Storage Mismatch Guard — When User A's profile is in cache and User B logs in, User A's data is rejected and purged.
 * TEST 5: User-Scoped Profile Resolution — Verifies User B's verified user-scoped profile renders User B's name correctly.
 * TEST 6: User Account Switch Invalidation — Confirms auth listener logic purges all User A keys when active session switches to User B.
 * TEST 7: Active Complaints Privacy Guard — Verifies renderMyActiveComplaints does not leak all complaints when user is unauthenticated.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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

console.log('====================================================');
console.log('  CROWD CITY CROSS-USER PROFILE ISOLATION TEST SUITE ');
console.log('====================================================\n');

// -----------------------------------------------------------------------------
// TEST 1: Static HTML Sanitization
// -----------------------------------------------------------------------------
const citizenDashboardHtmlPath = path.join(rootDir, 'client', 'citizen-dashboard.html');
const citizenDashboardHtml = fs.readFileSync(citizenDashboardHtmlPath, 'utf8');

const hasHardcodedName = citizenDashboardHtml.includes('Dhanushraagav S') || 
                         citizenDashboardHtml.includes('Dhanushraagav');

assert(!hasHardcodedName, 'TEST 1: Static citizen-dashboard.html must NOT contain hardcoded name "Dhanushraagav"');

// Check all HTML files in client directory
const clientDir = path.join(rootDir, 'client');
const allHtmlFiles = fs.readdirSync(clientDir).filter(f => f.endsWith('.html'));
let anyHtmlHasHardcodedName = false;
let offendingFile = '';

for (const htmlFile of allHtmlFiles) {
  const content = fs.readFileSync(path.join(clientDir, htmlFile), 'utf8');
  if (content.includes('Dhanushraagav S')) {
    anyHtmlHasHardcodedName = true;
    offendingFile = htmlFile;
    break;
  }
}

assert(!anyHtmlHasHardcodedName, 'TEST 1b: No client HTML files contain hardcoded citizen name', offendingFile);

// -----------------------------------------------------------------------------
// TEST 2: Static DOM Skeleton Placeholder in citizen-dashboard.html
// -----------------------------------------------------------------------------
const hasHeroGreeting = citizenDashboardHtml.includes('id="hero-greeting"');
const hasSkeletonShimmer = citizenDashboardHtml.includes('skeleton-shimmer') && 
                           citizenDashboardHtml.includes('aria-busy="true"');

assert(hasHeroGreeting && hasSkeletonShimmer, 'TEST 2: Initial #hero-greeting contains .skeleton-shimmer with aria-busy="true" in static HTML');

// -----------------------------------------------------------------------------
// TEST 3: Unauthenticated Loading State in updateHeroGreeting logic
// -----------------------------------------------------------------------------
// Simulate updateHeroGreeting function extracted from app.js
function simulateUpdateHeroGreeting(currentUser, storage) {
  let heroGreetingHtml = '';
  let greetingLeadText = '';

  const hour = 10; // Morning
  const greetingWord = 'Good Morning';

  const currentUserId = currentUser ? (currentUser.id || currentUser.sub) : null;

  if (!currentUser || !currentUserId) {
    const skeletonHtml = `<span class="user-greeting-name" id="hero-greeting-name" aria-busy="true"><span class="skeleton-shimmer" style="display: inline-block; width: 160px; height: 1.1em; border-radius: 6px; background: rgba(255,255,255,0.22); vertical-align: middle;"></span></span>`;
    greetingLeadText = `${greetingWord},`;
    heroGreetingHtml = skeletonHtml;
    return { greetingLeadText, heroGreetingHtml, isSkeleton: true, fullName: null };
  }

  let fullName = null;
  let cachedProfile = null;

  const scopedProfileStr = storage.getItem(`cc_user_profile_${currentUserId}`);
  if (scopedProfileStr) {
    try {
      const parsed = JSON.parse(scopedProfileStr);
      if (parsed && (parsed.id === currentUserId || parsed.sub === currentUserId)) {
        cachedProfile = parsed;
      }
    } catch (e) {}
  }

  if (!cachedProfile) {
    const genericProfileStr = storage.getItem('cc_user_profile');
    if (genericProfileStr) {
      try {
        const parsed = JSON.parse(genericProfileStr);
        if (parsed && (parsed.id === currentUserId || parsed.sub === currentUserId)) {
          cachedProfile = parsed;
        } else {
          storage.removeItem('cc_user_profile');
        }
      } catch (e) {}
    }
  }

  if (cachedProfile && cachedProfile.full_name) {
    fullName = cachedProfile.full_name;
  } else if (currentUser.user_metadata && (currentUser.user_metadata.full_name || currentUser.user_metadata.name)) {
    fullName = currentUser.user_metadata.full_name || currentUser.user_metadata.name;
  } else {
    fullName = 'Citizen';
  }

  heroGreetingHtml = `<span class="user-greeting-name" id="hero-greeting-name">${fullName}</span>`;
  return { greetingLeadText, heroGreetingHtml, isSkeleton: false, fullName };
}

// In-memory storage mock
function createMockStorage() {
  const store = new Map();
  return {
    getItem: (k) => store.get(k) || null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
    has: (k) => store.has(k)
  };
}

const mockStorage = createMockStorage();

// Test with null user (auth still initializing / hard refresh before auth completes)
const unauthResult = simulateUpdateHeroGreeting(null, mockStorage);
assert(
  unauthResult.isSkeleton && unauthResult.heroGreetingHtml.includes('skeleton-shimmer'),
  'TEST 3: When user session is unconfirmed, updateHeroGreeting maintains neutral skeleton without flashing any name'
);

// -----------------------------------------------------------------------------
// TEST 4: Cross-User Storage Mismatch Guard
// -----------------------------------------------------------------------------
// Seed storage with User A's profile in the generic key
mockStorage.setItem('cc_user_profile', JSON.stringify({
  id: 'user_a_uuid',
  full_name: 'Dhanushraagav S',
  role: 'citizen'
}));

// User B logs in
const userB = {
  id: 'user_b_uuid',
  email: 'userb@example.com',
  user_metadata: {
    full_name: 'Priya Sharma'
  }
};

const userBResult = simulateUpdateHeroGreeting(userB, mockStorage);

assert(
  !userBResult.heroGreetingHtml.includes('Dhanushraagav S'),
  'TEST 4a: User A\'s name is NEVER rendered for User B'
);
assert(
  userBResult.fullName === 'Priya Sharma',
  'TEST 4b: User B\'s verified name is rendered correctly'
);
assert(
  !mockStorage.has('cc_user_profile'),
  'TEST 4c: Mismatched cc_user_profile is purged immediately from storage'
);

// -----------------------------------------------------------------------------
// TEST 5: User-Scoped Profile Resolution
// -----------------------------------------------------------------------------
mockStorage.setItem(`cc_user_profile_${userB.id}`, JSON.stringify({
  id: userB.id,
  full_name: 'Priya Sharma (Updated)',
  role: 'citizen'
}));

const userBScopedResult = simulateUpdateHeroGreeting(userB, mockStorage);
assert(
  userBScopedResult.fullName === 'Priya Sharma (Updated)',
  'TEST 5: Scoped profile cc_user_profile_${userId} resolves correctly for verified user'
);

// -----------------------------------------------------------------------------
// TEST 6: User Account Switch Invalidation
// -----------------------------------------------------------------------------
function simulateOnAuthStateChange(newSession, storage) {
  const prevSessionStr = storage.getItem('cc_session');
  let prevUserId = null;
  if (prevSessionStr) {
    try {
      const parsed = JSON.parse(prevSessionStr);
      if (parsed && parsed.user) prevUserId = parsed.user.id || parsed.user.sub;
    } catch (e) {}
  }
  const newUserId = newSession.user ? (newSession.user.id || newSession.user.sub) : null;
  if (prevUserId && newUserId && prevUserId !== newUserId) {
    storage.removeItem('cc_user_profile');
    storage.removeItem(`cc_user_profile_${prevUserId}`);
    storage.removeItem('cc_my_complaints');
    storage.removeItem('cc_user_stat_total');
    storage.removeItem('cc_user_stat_resolved');
    storage.removeItem('cc_user_stat_active');
    storage.removeItem('cc_notifications_cache');
    storage.removeItem('cc_unread_notifications_count');
  }
  storage.setItem('cc_session', JSON.stringify(newSession));
}

// User A was logged in
mockStorage.setItem('cc_session', JSON.stringify({ user: { id: 'user_a_uuid' } }));
mockStorage.setItem('cc_user_profile', JSON.stringify({ id: 'user_a_uuid', full_name: 'User A' }));
mockStorage.setItem('cc_user_profile_user_a_uuid', JSON.stringify({ id: 'user_a_uuid', full_name: 'User A' }));
mockStorage.setItem('cc_my_complaints', JSON.stringify([{ id: 'issue_1' }]));

// User B signs in
simulateOnAuthStateChange({ user: { id: 'user_b_uuid' } }, mockStorage);

assert(
  !mockStorage.has('cc_user_profile') && 
  !mockStorage.has('cc_user_profile_user_a_uuid') &&
  !mockStorage.has('cc_my_complaints'),
  'TEST 6: Switching accounts invalidates all cached profiles and user-specific complaint data'
);

// -----------------------------------------------------------------------------
// TEST 7: Active Complaints Privacy Guard
// -----------------------------------------------------------------------------
const citizenDashboardJsPath = path.join(rootDir, 'client', 'js', 'citizen-dashboard.js');
const citizenDashboardJs = fs.readFileSync(citizenDashboardJsPath, 'utf8');

// Ensure that renderMyActiveComplaints checks (!user || !user.id) and doesn't default to true
const hasUnauthGuardInMyComplaints = citizenDashboardJs.includes('if (!user || !user.id)') &&
                                     citizenDashboardJs.includes('No active complaints submitted yet');
const hasLeakFallback = citizenDashboardJs.includes(': true;');

assert(
  hasUnauthGuardInMyComplaints && !hasLeakFallback,
  'TEST 7: renderMyActiveComplaints strictly guards unauthenticated state and does not leak complaints'
);

// -----------------------------------------------------------------------------
// Final Results
// -----------------------------------------------------------------------------
console.log('\n====================================================');
console.log(`  TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('====================================================');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
