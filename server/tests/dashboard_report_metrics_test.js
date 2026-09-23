/**
 * CrowdCity AI — Dashboard Report Metrics & Semantics Verification Test Suite
 * 
 * Verifies:
 * TEST 1: Static HTML Markup & Semantics — Confirms 4 KPI cards with proper IDs, labels, and initial states.
 * TEST 2: IST Monday Week-Boundary Determinism — Verifies getStartOfWeekIST strictly calculates Monday 00:00:00.000 IST (UTC+05:30).
 * TEST 3: Metric Semantics Case 1 — 5 total complaints, 0 this week -> Submitted = 0, Total = 5 (strictly not identical).
 * TEST 4: Metric Semantics Case 2 — 5 total complaints, 2 this week -> Submitted = 2, Total = 5.
 * TEST 5: Metric Semantics Case 3 — 5 total complaints, 5 this week -> Submitted = 5, Total = 5 (legitimate equality without artificial tampering).
 * TEST 6: Metric Semantics Case 4 — 0 total complaints -> Submitted = 0, Resolved = 0, Active = 0, Total = 0.
 * TEST 7: Strict User Data Isolation — Verifies complaints from User A are never counted in User B's stats.
 * TEST 8: Card Status & Resolution Rate Semantics — Correctly counts resolved (resolved/verified/closed) vs active issues and calculates rate.
 * TEST 9: Unauthenticated & Session Expiry Reset — loadUserStats resets all 4 cards to 0 when user is null.
 * TEST 10: Auth Storage Scoping & Invalidation — Verifies stat keys are invalidated on switch/logout in auth.js and auth-router.js.
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

console.log('================================================================');
console.log('  CROWD CITY DASHBOARD REPORT METRICS TEST SUITE ');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// TEST 1: Static HTML Markup & Semantics in citizen-dashboard.html
// -----------------------------------------------------------------------------
const citizenDashboardHtmlPath = path.join(rootDir, 'client', 'citizen-dashboard.html');
const citizenDashboardHtml = fs.readFileSync(citizenDashboardHtmlPath, 'utf8');

const hasStatTotalReports = citizenDashboardHtml.includes('id="stat-total-reports"');
const hasStatTotalReportsChange = citizenDashboardHtml.includes('id="stat-total-reports-change"');
const hasStatResolvedIssues = citizenDashboardHtml.includes('id="stat-resolved-issues"');
const hasStatResolvedRate = citizenDashboardHtml.includes('id="stat-resolved-rate"');
const hasStatInprogressReports = citizenDashboardHtml.includes('id="stat-inprogress-reports"');
const hasStatCityTotalReports = citizenDashboardHtml.includes('id="stat-city-total-reports"');
const hasStatCityTotalSub = citizenDashboardHtml.includes('id="stat-city-total-sub"');

assert(hasStatTotalReports && hasStatTotalReportsChange, 'TEST 1.1: Card 1 (REPORTS SUBMITTED) elements exist in HTML');
assert(hasStatResolvedIssues && hasStatResolvedRate, 'TEST 1.2: Card 2 (RESOLVED REPORTS) elements exist in HTML');
assert(hasStatInprogressReports, 'TEST 1.3: Card 3 (IN PROGRESS) element exists in HTML');
assert(hasStatCityTotalReports && hasStatCityTotalSub, 'TEST 1.4: Card 4 (TOTAL REPORTS) elements exist in HTML');

// -----------------------------------------------------------------------------
// Pure logic implementation of getStartOfWeekIST matching app.js
// -----------------------------------------------------------------------------
function getStartOfWeekIST(refDate = new Date()) {
  const d = new Date(refDate);
  const validDate = isNaN(d.getTime()) ? new Date() : d;

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour12: false
  }).formatToParts(validDate);

  const map = {};
  for (const p of parts) map[p.type] = p.value;

  const year = parseInt(map.year, 10);
  const month = parseInt(map.month, 10) - 1; // 0-indexed
  const day = parseInt(map.day, 10);

  // Day of week in IST
  const istDate = new Date(Date.UTC(year, month, day));
  const dayOfWeek = istDate.getUTCDay(); // 0 is Sunday, 1 is Monday...
  const daysSinceMonday = (dayOfWeek + 6) % 7;

  // Monday at 00:00:00.000 in IST (Asia/Kolkata is UTC+05:30)
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  return new Date(Date.UTC(year, month, day - daysSinceMonday, 0, 0, 0, 0) - IST_OFFSET_MS);
}

// -----------------------------------------------------------------------------
// Pure logic implementation of dashboard calculation matching app.js
// -----------------------------------------------------------------------------
function computeDashboardMetrics(userIssues, currentUser = null, refDate = new Date()) {
  const currentUserId = currentUser ? (currentUser.id || currentUser.sub) : null;

  // Strict user isolation filter
  const filteredIssues = currentUserId
    ? userIssues.filter(i => {
        if (!i) return false;
        return (
          i.reporter_id === currentUserId ||
          (currentUser.email && i.user_email === currentUser.email) ||
          (
            i.is_supporting_report === true &&
            (
              !i.supporter_id ||
              i.supporter_id === currentUserId
            )
          )
        );
      })
    : [];

  const totalAllTime = filteredIssues.length;

  const startOfWeekIST = getStartOfWeekIST(refDate);
  const weeklyCount = filteredIssues.filter(i => {
    const rawDate = i.created_at || i.createdAt;
    if (!rawDate) return false;
    const issueDate = new Date(rawDate);
    return !isNaN(issueDate.getTime()) && issueDate.getTime() >= startOfWeekIST.getTime();
  }).length;

  const resolved = filteredIssues.filter(i => {
    const s = (i.status || '').toLowerCase();
    return s === 'resolved' || s === 'verified' || s === 'closed';
  }).length;

  const active = filteredIssues.filter(i => {
    const s = (i.status || '').toLowerCase();
    return s !== 'resolved' && s !== 'verified' && s !== 'closed';
  }).length;

  const resolutionRate = totalAllTime > 0 ? Math.round((resolved / totalAllTime) * 100) : 0;

  return {
    submittedThisWeek: weeklyCount,
    totalAllTime: totalAllTime,
    resolvedAllTime: resolved,
    activeReports: active,
    resolutionRate: resolutionRate,
    startOfWeekIST: startOfWeekIST.toISOString()
  };
}

// -----------------------------------------------------------------------------
// TEST 2: IST Monday Week-Boundary Determinism
// -----------------------------------------------------------------------------
// Test with a known date: Wednesday Sep 23, 2026, 10:00:00 IST
// Corresponding Monday is Sep 21, 2026, 00:00:00 IST = Sep 20, 2026, 18:30:00.000 UTC
const wednesdayTestDate = new Date('2026-09-23T04:30:00.000Z'); // 10:00 IST
const computedMonday = getStartOfWeekIST(wednesdayTestDate);
const expectedMondayUTC = new Date('2026-09-20T18:30:00.000Z');

assert(
  computedMonday.getTime() === expectedMondayUTC.getTime(),
  'TEST 2.1: getStartOfWeekIST correctly computes Monday 00:00:00 IST (UTC 18:30 Sunday prior)',
  `Computed: ${computedMonday.toISOString()}, Expected: ${expectedMondayUTC.toISOString()}`
);

// Sunday just before midnight IST (Sep 20, 2026, 23:59:59 IST = Sep 20 18:29:59 UTC)
// Must belong to previous week (Monday Sep 14, 2026, 00:00:00 IST = Sep 13 18:30:00 UTC)
const sundayLate = new Date('2026-09-20T18:29:59.000Z');
const mondayFromSunday = getStartOfWeekIST(sundayLate);
const expectedPrevMondayUTC = new Date('2026-09-13T18:30:00.000Z');

assert(
  mondayFromSunday.getTime() === expectedPrevMondayUTC.getTime(),
  'TEST 2.2: Sunday 23:59:59 IST correctly falls in prior week',
  `Computed: ${mondayFromSunday.toISOString()}, Expected: ${expectedPrevMondayUTC.toISOString()}`
);

// Monday exactly at 00:00:00 IST (Sep 21, 2026 00:00:00 IST = Sep 20 18:30:00 UTC)
const mondayExact = new Date('2026-09-20T18:30:00.000Z');
const mondayFromMonday = getStartOfWeekIST(mondayExact);
assert(
  mondayFromMonday.getTime() === expectedMondayUTC.getTime(),
  'TEST 2.3: Monday 00:00:00 IST starts the new week exactly on itself'
);

// -----------------------------------------------------------------------------
// TEST 3: Metric Semantics Case 1 — 5 total, 0 this week
// -----------------------------------------------------------------------------
const testUser = { id: 'usr-citizen-1', email: 'citizen1@test.com' };
const refDateNow = new Date('2026-09-23T10:00:00.000Z'); // Wednesday

// 5 issues submitted last week or earlier (e.g. Sep 10 - Sep 15, 2026)
const issuesCase1 = [
  { id: '1', reporter_id: 'usr-citizen-1', status: 'resolved', created_at: '2026-09-10T10:00:00.000Z' },
  { id: '2', reporter_id: 'usr-citizen-1', status: 'in_progress', created_at: '2026-09-12T10:00:00.000Z' },
  { id: '3', reporter_id: 'usr-citizen-1', status: 'open', created_at: '2026-09-14T10:00:00.000Z' },
  { id: '4', reporter_id: 'usr-citizen-1', status: 'resolved', created_at: '2026-09-15T10:00:00.000Z' },
  { id: '5', reporter_id: 'usr-citizen-1', status: 'assigned', created_at: '2026-09-16T10:00:00.000Z' },
];

const metricsCase1 = computeDashboardMetrics(issuesCase1, testUser, refDateNow);
assert(metricsCase1.submittedThisWeek === 0, 'TEST 3.1: Case 1 - Reports Submitted this week is 0');
assert(metricsCase1.totalAllTime === 5, 'TEST 3.2: Case 1 - Total Reports all time is 5');
assert(metricsCase1.submittedThisWeek !== metricsCase1.totalAllTime, 'TEST 3.3: Case 1 - Reports Submitted (0) and Total Reports (5) are strictly NOT identical');

// -----------------------------------------------------------------------------
// TEST 4: Metric Semantics Case 2 — 5 total, 2 this week, 3 older
// -----------------------------------------------------------------------------
const issuesCase2 = [
  // 3 older
  { id: '1', reporter_id: 'usr-citizen-1', status: 'resolved', created_at: '2026-09-10T10:00:00.000Z' },
  { id: '2', reporter_id: 'usr-citizen-1', status: 'resolved', created_at: '2026-09-12T10:00:00.000Z' },
  { id: '3', reporter_id: 'usr-citizen-1', status: 'open', created_at: '2026-09-14T10:00:00.000Z' },
  // 2 this week (Monday Sep 21 and Tuesday Sep 22)
  { id: '4', reporter_id: 'usr-citizen-1', status: 'in_progress', created_at: '2026-09-21T06:00:00.000Z' },
  { id: '5', reporter_id: 'usr-citizen-1', status: 'open', created_at: '2026-09-22T08:00:00.000Z' },
];

const metricsCase2 = computeDashboardMetrics(issuesCase2, testUser, refDateNow);
assert(metricsCase2.submittedThisWeek === 2, 'TEST 4.1: Case 2 - Reports Submitted this week is 2');
assert(metricsCase2.totalAllTime === 5, 'TEST 4.2: Case 2 - Total Reports all time is 5');
assert(metricsCase2.submittedThisWeek !== metricsCase2.totalAllTime, 'TEST 4.3: Case 2 - Reports Submitted (2) and Total Reports (5) differ accurately');

// -----------------------------------------------------------------------------
// TEST 5: Metric Semantics Case 3 — 5 total, 5 this week (legitimate equality)
// -----------------------------------------------------------------------------
const issuesCase3 = [
  { id: '1', reporter_id: 'usr-citizen-1', status: 'open', created_at: '2026-09-21T04:00:00.000Z' },
  { id: '2', reporter_id: 'usr-citizen-1', status: 'in_progress', created_at: '2026-09-21T09:00:00.000Z' },
  { id: '3', reporter_id: 'usr-citizen-1', status: 'resolved', created_at: '2026-09-22T02:00:00.000Z' },
  { id: '4', reporter_id: 'usr-citizen-1', status: 'open', created_at: '2026-09-22T14:00:00.000Z' },
  { id: '5', reporter_id: 'usr-citizen-1', status: 'open', created_at: '2026-09-23T01:00:00.000Z' },
];

const metricsCase3 = computeDashboardMetrics(issuesCase3, testUser, refDateNow);
assert(metricsCase3.submittedThisWeek === 5, 'TEST 5.1: Case 3 - Reports Submitted this week is 5');
assert(metricsCase3.totalAllTime === 5, 'TEST 5.2: Case 3 - Total Reports all time is 5');
assert(
  metricsCase3.submittedThisWeek === metricsCase3.totalAllTime,
  'TEST 5.3: Case 3 - Reports Submitted (5) and Total Reports (5) legitimately equal when all 5 submitted this week'
);

// -----------------------------------------------------------------------------
// TEST 6: Metric Semantics Case 4 — 0 total complaints
// -----------------------------------------------------------------------------
const issuesCase4 = [];
const metricsCase4 = computeDashboardMetrics(issuesCase4, testUser, refDateNow);
assert(metricsCase4.submittedThisWeek === 0, 'TEST 6.1: Case 4 - Reports Submitted is 0');
assert(metricsCase4.totalAllTime === 0, 'TEST 6.2: Case 4 - Total Reports is 0');
assert(metricsCase4.resolvedAllTime === 0, 'TEST 6.3: Case 4 - Resolved Reports is 0');
assert(metricsCase4.activeReports === 0, 'TEST 6.4: Case 4 - In Progress is 0');
assert(metricsCase4.resolutionRate === 0, 'TEST 6.5: Case 4 - Resolution Rate is 0%');

// -----------------------------------------------------------------------------
// TEST 7: Strict User Data Isolation
// -----------------------------------------------------------------------------
const userA = { id: 'usr-a-dhanush', email: 'dhanush@test.com' };
const userB = { id: 'usr-b-priya', email: 'priya@test.com' };

const mixedIssuesDatabase = [
  // User A's 5 issues (2 this week, 3 older)
  { id: 'a1', reporter_id: 'usr-a-dhanush', status: 'resolved', created_at: '2026-09-10T10:00:00.000Z' },
  { id: 'a2', reporter_id: 'usr-a-dhanush', status: 'resolved', created_at: '2026-09-12T10:00:00.000Z' },
  { id: 'a3', reporter_id: 'usr-a-dhanush', status: 'open', created_at: '2026-09-14T10:00:00.000Z' },
  { id: 'a4', reporter_id: 'usr-a-dhanush', status: 'in_progress', created_at: '2026-09-21T06:00:00.000Z' },
  { id: 'a5', reporter_id: 'usr-a-dhanush', status: 'open', created_at: '2026-09-22T08:00:00.000Z' },
  // User B's 1 issue (this week)
  { id: 'b1', reporter_id: 'usr-b-priya', status: 'open', created_at: '2026-09-23T05:00:00.000Z' },
];

const metricsUserA = computeDashboardMetrics(mixedIssuesDatabase, userA, refDateNow);
assert(metricsUserA.submittedThisWeek === 2, 'TEST 7.1: User A has 2 submitted this week');
assert(metricsUserA.totalAllTime === 5, 'TEST 7.2: User A has 5 total all time (User B not included)');

const metricsUserB = computeDashboardMetrics(mixedIssuesDatabase, userB, refDateNow);
assert(metricsUserB.submittedThisWeek === 1, 'TEST 7.3: User B has 1 submitted this week');
assert(metricsUserB.totalAllTime === 1, 'TEST 7.4: User B has 1 total all time (User A not included)');

// -----------------------------------------------------------------------------
// TEST 8: Card Status & Resolution Rate Semantics
// -----------------------------------------------------------------------------
// Verify resolved statuses: resolved, verified, closed
const issuesForStatus = [
  { id: '1', reporter_id: 'usr-citizen-1', status: 'Resolved', created_at: '2026-09-10T00:00:00.000Z' },
  { id: '2', reporter_id: 'usr-citizen-1', status: 'VERIFIED', created_at: '2026-09-10T00:00:00.000Z' },
  { id: '3', reporter_id: 'usr-citizen-1', status: 'closed', created_at: '2026-09-10T00:00:00.000Z' },
  { id: '4', reporter_id: 'usr-citizen-1', status: 'in_progress', created_at: '2026-09-10T00:00:00.000Z' },
];
const metricsStatus = computeDashboardMetrics(issuesForStatus, testUser, refDateNow);
assert(metricsStatus.resolvedAllTime === 3, 'TEST 8.1: Status resolution counts resolved, verified, closed (3/4)');
assert(metricsStatus.activeReports === 1, 'TEST 8.2: Status active reports count remaining (1/4)');
assert(metricsStatus.resolutionRate === 75, 'TEST 8.3: Resolution rate is 75%');

// -----------------------------------------------------------------------------
// TEST 9: Unauthenticated Reset in app.js
// -----------------------------------------------------------------------------
const appJsPath = path.join(rootDir, 'client', 'js', 'app.js');
const appJs = fs.readFileSync(appJsPath, 'utf8');

const hasZeroResetWhenNoUser = appJs.includes('if (!userId) {') &&
  appJs.includes("if (totalEl) totalEl.textContent = '0';") &&
  appJs.includes("if (cityTotalEl) cityTotalEl.textContent = '0';");

assert(hasZeroResetWhenNoUser, 'TEST 9: app.js contains explicit zeroing of stat cards when user is not authenticated');

// -----------------------------------------------------------------------------
// TEST 10: Auth Storage Scoping & Invalidation
// -----------------------------------------------------------------------------
const authJsPath = path.join(rootDir, 'client', 'js', 'auth.js');
const authJs = fs.readFileSync(authJsPath, 'utf8');

const authRouterJsPath = path.join(rootDir, 'client', 'js', 'auth-router.js');
const authRouterJs = fs.readFileSync(authRouterJsPath, 'utf8');

const authJsCleansSubmitted = authJs.includes("'cc_user_stat_submitted'");
const authJsCleansCityTotal = authJs.includes("'cc_city_stat_total'");
const authRouterCleansSubmitted = authRouterJs.includes("'cc_user_stat_submitted'");
const authRouterProxiesCityStat = authRouterJs.includes("key.startsWith('cc_city_stat_')");

assert(authJsCleansSubmitted && authJsCleansCityTotal, 'TEST 10.1: auth.js explicitly invalidates cc_user_stat_submitted and cc_city_stat_total');
assert(authRouterCleansSubmitted && authRouterProxiesCityStat, 'TEST 10.2: auth-router.js proxies and purges cc_city_stat_* and user stats');

// -----------------------------------------------------------------------------
// TEST 11: Co-Reported Dashboard Statistics Regression Suite (Cases 1 - 6)
// -----------------------------------------------------------------------------
const citizenUser = { id: 'usr-citizen-dhanush', email: 'dhanush@test.com' };

// CASE 1: 3 direct + 2 co-reported (matches authenticated citizen profile)
const case1Issues = [
  // 3 direct complaints
  { id: 'cc1', complaint_id: 'CC-2026-000001', reporter_id: 'usr-citizen-dhanush', status: 'verified', created_at: '2026-08-30T14:59:29.000Z' },
  { id: 'cc2', complaint_id: 'CC-2026-000002', reporter_id: 'usr-citizen-dhanush', status: 'verified', created_at: '2026-09-01T04:06:22.000Z' },
  { id: 'cc3', complaint_id: 'CC-2026-000003', reporter_id: 'usr-citizen-dhanush', status: 'assigned', created_at: '2026-09-02T15:56:26.000Z' },
  // 2 co-reported complaints (primary author is another user)
  { id: 'cc4', complaint_id: 'CC-2026-000004', reporter_id: 'usr-other-1', is_supporting_report: true, supporter_id: 'usr-citizen-dhanush', status: 'assigned', created_at: '2026-09-03T08:23:49.000Z' },
  { id: 'cc5', complaint_id: 'CC-2026-000005', reporter_id: 'usr-other-2', is_supporting_report: true, supporter_id: 'usr-citizen-dhanush', status: 'verified', created_at: '2026-09-03T08:51:44.000Z' },
];

const case1Metrics = computeDashboardMetrics(case1Issues, citizenUser, refDateNow);
assert(case1Metrics.totalAllTime === 5, 'TEST 11.1: Case 1 - Total reports is exactly 5 (3 direct + 2 co-reported)');
assert(case1Metrics.resolvedAllTime === 3, 'TEST 11.2: Case 1 - Resolved reports is 3 (CC1, CC2, CC5)');
assert(case1Metrics.activeReports === 2, 'TEST 11.3: Case 1 - In Progress reports is 2 (CC3, CC4)');
assert(case1Metrics.resolutionRate === 60, 'TEST 11.4: Case 1 - Resolution Rate is 60% (3/5)');
assert(case1Metrics.submittedThisWeek === 0, 'TEST 11.5: Case 1 - Reports Submitted this week is 0');

// CASE 2: User with only direct reports
const case2Issues = [
  { id: 'd1', reporter_id: 'usr-citizen-dhanush', status: 'resolved', created_at: '2026-09-01T00:00:00.000Z' },
  { id: 'd2', reporter_id: 'usr-citizen-dhanush', status: 'assigned', created_at: '2026-09-02T00:00:00.000Z' },
];
const case2Metrics = computeDashboardMetrics(case2Issues, citizenUser, refDateNow);
assert(case2Metrics.totalAllTime === 2, 'TEST 11.6: Case 2 - Direct-only user has Total = 2');
assert(case2Metrics.resolvedAllTime === 1 && case2Metrics.activeReports === 1, 'TEST 11.7: Case 2 - Direct-only status aggregation is accurate');

// CASE 3: User with only co-reported reports
const case3Issues = [
  { id: 'c1', reporter_id: 'usr-other-1', is_supporting_report: true, supporter_id: 'usr-citizen-dhanush', status: 'resolved', created_at: '2026-09-01T00:00:00.000Z' },
  { id: 'c2', reporter_id: 'usr-other-2', is_supporting_report: true, supporter_id: 'usr-citizen-dhanush', status: 'open', created_at: '2026-09-02T00:00:00.000Z' },
];
const case3Metrics = computeDashboardMetrics(case3Issues, citizenUser, refDateNow);
assert(case3Metrics.totalAllTime === 2, 'TEST 11.8: Case 3 - Co-report-only user has Total = 2');
assert(case3Metrics.resolvedAllTime === 1 && case3Metrics.activeReports === 1, 'TEST 11.9: Case 3 - Co-report-only status aggregation is accurate');

// CASE 4: Two users co-reporting the same civic issue (isolation)
const sharedIssue = { id: 'shared-issue-1', reporter_id: 'usr-creator-3', status: 'open', created_at: '2026-09-01T00:00:00.000Z' };
const user1Issues = [{ ...sharedIssue, is_supporting_report: true, supporter_id: 'usr-citizen-1' }];
const user2Issues = [{ ...sharedIssue, is_supporting_report: false, supporter_id: null }];

const mUser1 = computeDashboardMetrics(user1Issues, { id: 'usr-citizen-1' }, refDateNow);
const mUser2 = computeDashboardMetrics(user2Issues, { id: 'usr-citizen-2' }, refDateNow);
assert(mUser1.totalAllTime === 1, 'TEST 11.10: Case 4 - Shared issue counts for User 1 who co-reported it');
assert(mUser2.totalAllTime === 0, 'TEST 11.11: Case 4 - Shared issue does NOT count for User 2 who did not co-report it');

// CASE 5: Unauthenticated user (no fallback to all issues)
const mUnauth = computeDashboardMetrics(case1Issues, null, refDateNow);
assert(mUnauth.totalAllTime === 0, 'TEST 11.12: Case 5 - Unauthenticated user results in 0 total (no fallback to all issues)');
assert(mUnauth.resolvedAllTime === 0 && mUnauth.activeReports === 0, 'TEST 11.13: Case 5 - Unauthenticated user has 0 resolved and 0 active');

// CASE 6: Controller attaches supporter_id metadata
const controllerJsPath = path.join(rootDir, 'server', 'controllers', 'issueController.js');
const controllerJs = fs.readFileSync(controllerJsPath, 'utf8');
const controllerAttachesSupporterId = controllerJs.includes('issue.supporter_id = reporter_id;');
assert(controllerAttachesSupporterId, 'TEST 11.14: Case 6 - issueController.js explicitly attaches supporter_id = reporter_id to co-reported response metadata');

// -----------------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------------
console.log('\n================================================================');
console.log(`  TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('================================================================');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
