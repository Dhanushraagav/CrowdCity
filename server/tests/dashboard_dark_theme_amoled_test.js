import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('=== CITIZEN DASHBOARD AMOLED DARK THEME VERIFICATION TEST ===\n');

const cssPath = path.join(__dirname, '../../client/css/components.css');
const cssContent = fs.readFileSync(cssPath, 'utf8');

let passedTests = 0;
let failedTests = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] ${name}: ${err.message}`);
    failedTests++;
  }
}

// 1. Dashboard filter panel has AMOLED black surface #050505 and neutral dark border #161616
runTest('Dashboard Filter Panel Dark Theme AMOLED Surface', () => {
  const panelMatch = cssContent.match(/\[data-theme="dark"\]\s*\.dashboard-filter-panel[\s\S]*?\{([\s\S]*?)\}/);
  assert(panelMatch, 'Could not find dark theme rule for .dashboard-filter-panel');
  const body = panelMatch[1];
  assert(body.includes('#050505'), 'Panel background should be #050505');
  assert(body.includes('#161616'), 'Panel border should be #161616');
  assert(!body.includes('#0f172a'), 'Panel background must NOT be #0f172a');
});

// 2. Feed tabs container has near-black surface #080808 and border #1c1c1c
runTest('Feed Tabs Container Dark Theme Surface', () => {
  const tabsMatch = cssContent.match(/\[data-theme="dark"\]\s*#feed-tabs-container[\s\S]*?\{([\s\S]*?)\}/);
  assert(tabsMatch, 'Could not find dark theme rule for #feed-tabs-container');
  const body = tabsMatch[1];
  assert(body.includes('#080808'), 'Feed tabs container background should be #080808');
  assert(body.includes('#1c1c1c'), 'Feed tabs container border should be #1c1c1c');
  assert(!body.includes('#1e293b'), 'Feed tabs container must NOT be #1e293b');
});

// 3. Active Feed Tab retains cyan/teal accent with AMOLED surface
runTest('Feed Tab Active Dark Theme Colors & Accent', () => {
  const activeTabMatch = cssContent.match(/\[data-theme="dark"\]\s*\.feed-tab\.active[\s\S]*?\{([\s\S]*?)\}/);
  assert(activeTabMatch, 'Could not find dark theme rule for .feed-tab.active');
  const body = activeTabMatch[1];
  assert(body.includes('#050505'), 'Active tab background should be #050505');
  assert(body.includes('#2dd4bf'), 'Active tab text should remain teal accent #2dd4bf');
  assert(!body.includes('#0f172a'), 'Active tab must NOT be #0f172a');
});

// 4. Search input has AMOLED surface #080808 and focus surface #050505 with accent ring
runTest('Search Input Dark Theme Surface and Focus', () => {
  const searchMatch = cssContent.match(/\[data-theme="dark"\]\s*\.dashboard-filter-panel\s*\.search-input-wrapper\s*\.search-input[\s\S]*?\{([\s\S]*?)\}/);
  assert(searchMatch, 'Could not find dark theme rule for .search-input');
  const body = searchMatch[1];
  assert(body.includes('#080808'), 'Search input background should be #080808');
  assert(body.includes('#1c1c1c'), 'Search input border should be #1c1c1c');
  assert(!body.includes('#1e293b'), 'Search input must NOT be #1e293b');

  const focusMatch = cssContent.match(/\[data-theme="dark"\]\s*\.dashboard-filter-panel\s*\.search-input-wrapper\s*\.search-input:focus[\s\S]*?\{([\s\S]*?)\}/);
  assert(focusMatch, 'Could not find dark theme rule for .search-input:focus');
  const focusBody = focusMatch[1];
  assert(focusBody.includes('#050505'), 'Search input focus background should be #050505');
  assert(focusBody.includes('#2dd4bf'), 'Search input focus border should be #2dd4bf');
  assert(!focusBody.includes('#0f172a'), 'Search input focus must NOT be #0f172a');
});

// 5. Filter pills have AMOLED surface #080808 and hover #141414
runTest('Filter Pills Dark Theme Surface and Hover', () => {
  const pillMatch = cssContent.match(/\[data-theme="dark"\]\s*\.filter-pill[\s\S]*?\{([\s\S]*?)\}/);
  assert(pillMatch, 'Could not find dark theme rule for .filter-pill');
  const body = pillMatch[1];
  assert(body.includes('#080808'), 'Filter pill background should be #080808');
  assert(!body.includes('#1e293b'), 'Filter pill must NOT be #1e293b');

  const hoverMatch = cssContent.match(/\[data-theme="dark"\]\s*\.filter-pill:hover[\s\S]*?\{([\s\S]*?)\}/);
  assert(hoverMatch, 'Could not find dark theme rule for .filter-pill:hover');
  const hoverBody = hoverMatch[1];
  assert(hoverBody.includes('#141414'), 'Filter pill hover background should be #141414');
  assert(!hoverBody.includes('#334155'), 'Filter pill hover must NOT be #334155');
});

// 6. Main Feed Issue Cards have AMOLED surface #050505, border #161616, and hover #0a0a0a
runTest('Feed Issue Cards (.stitch-item-card) AMOLED Surface', () => {
  const cardMatch = cssContent.match(/\[data-theme="dark"\]\s*\.stitch-item-card[\s\S]*?\{([\s\S]*?)\}/);
  assert(cardMatch, 'Could not find dark theme rule for .stitch-item-card');
  const body = cardMatch[1];
  assert(body.includes('#050505'), 'Issue card background should be #050505');
  assert(body.includes('#161616'), 'Issue card border should be #161616');
  assert(!body.includes('#0f172a'), 'Issue card must NOT be #0f172a');

  const cardHoverMatch = cssContent.match(/\[data-theme="dark"\]\s*\.stitch-item-card:hover[\s\S]*?\{([\s\S]*?)\}/);
  assert(cardHoverMatch, 'Could not find dark theme rule for .stitch-item-card:hover');
  const hoverBody = cardHoverMatch[1];
  assert(hoverBody.includes('#0a0a0a'), 'Issue card hover background should be #0a0a0a');
});

// 7. Right sidebar cards have AMOLED surface #050505 and border #161616
runTest('Sidebar Guidelines & Notification Cards AMOLED Surface', () => {
  const guideMatch = cssContent.match(/\[data-theme="dark"\]\s*\.stitch-guidelines-card[\s\S]*?\{([\s\S]*?)\}/);
  assert(guideMatch, 'Could not find dark theme rule for .stitch-guidelines-card');
  const body = guideMatch[1];
  assert(body.includes('#050505'), 'Guidelines card background should be #050505');
  assert(body.includes('#161616'), 'Guidelines card border should be #161616');
  assert(!body.includes('#0f172a'), 'Guidelines card must NOT be #0f172a');
});

// 8. Compact notifications items have AMOLED surface #080808 and border #161616
runTest('Compact Notifications Items AMOLED Surface', () => {
  const notifMatch = cssContent.match(/\[data-theme="dark"\]\s*#compact-notifications-list\s*>\s*div[\s\S]*?\{([\s\S]*?)\}/);
  assert(notifMatch, 'Could not find dark theme rule for #compact-notifications-list > div');
  const body = notifMatch[1];
  assert(body.includes('#080808'), 'Notification item background should be #080808');
  assert(body.includes('#161616'), 'Notification item border should be #161616');
  assert(!body.includes('#1e293b'), 'Notification item must NOT be #1e293b');
});

// 9. Community timeline hover is dark neutral #0e0e0e
runTest('Community Activity Timeline Dark Surface', () => {
  const timelineMatch = cssContent.match(/\[data-theme="dark"\]\s*#community-activity-timeline\s*>\s*div\s*>\s*div:hover[\s\S]*?\{([\s\S]*?)\}/);
  assert(timelineMatch, 'Could not find dark theme rule for #community-activity-timeline hover');
  const body = timelineMatch[1];
  assert(body.includes('#0e0e0e'), 'Timeline item hover background should be #0e0e0e');
  assert(!body.includes('#1e293b'), 'Timeline item hover must NOT be #1e293b');
});

// 10. KPI stat card dark theme fallbacks are neutral AMOLED #080808
runTest('KPI Stat Card Dark Theme AMOLED Fallbacks', () => {
  const statMatch = cssContent.match(/\/\* Subtle, low-contrast KPI Stat Cards in Dark Mode \*\/[\s\S]*?\[data-theme="dark"\]\s*\.stitch-stat-card[\s\S]*?\{([\s\S]*?)\}/);
  assert(statMatch, 'Could not find dark theme rule for .stitch-stat-card');
  const body = statMatch[1];
  assert(body.includes('#080808'), 'Stat card fallback should be #080808');
  assert(body.includes('#161616'), 'Stat card border fallback should be #161616');
  assert(!body.includes('#1e293b'), 'Stat card must NOT have #1e293b fallback');
  assert(!body.includes('#334155'), 'Stat card must NOT have #334155 fallback');
});

// 11. Preserved Status Badges and Accent Colors
runTest('Preserved Accents on Cards and Status Badges', () => {
  // Assigned badge
  assert(cssContent.includes('.stitch-badge.assigned'), 'Must preserve .stitch-badge.assigned');
  assert(cssContent.includes('#7c3aed'), 'Must preserve Assigned purple accent #7c3aed');
  
  // Verified badge
  assert(cssContent.includes('.stitch-badge.verified'), 'Must preserve .stitch-badge.verified');
  assert(cssContent.includes('#059669'), 'Must preserve Verified green accent #059669');

  // Pending badge
  assert(cssContent.includes('.stitch-badge.pending'), 'Must preserve .stitch-badge.pending');
  assert(cssContent.includes('#e11d48'), 'Must preserve Pending red accent #e11d48');

  // Upvote button accent
  assert(cssContent.includes('span[id^="vote-btn-"]'), 'Must preserve upvote button selector');
  assert(cssContent.includes('#2dd4bf'), 'Must preserve upvote teal accent #2dd4bf');
});

// 12. Preserved Light Mode Card Styles
runTest('Preserved Light Mode Styling', () => {
  const lightGuide = cssContent.match(/\.stitch-guidelines-card\s*\{([\s\S]*?)\}/);
  assert(lightGuide, 'Light mode .stitch-guidelines-card rule must exist');
  assert(lightGuide[1].includes('#ffffff'), 'Light mode guidelines card must remain #ffffff');

  const lightNotif = cssContent.match(/#compact-notifications-list\s*>\s*div\s*\{([\s\S]*?)\}/);
  assert(lightNotif, 'Light mode #compact-notifications-list > div must exist');
  assert(lightNotif[1].includes('#ffffff') || lightNotif[1].includes('#f8fafc'), 'Light mode notification item must remain light');
});

console.log(`\n=== RESULTS: ${passedTests} passed, ${failedTests} failed ===`);
if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('ALL DASHBOARD AMOLED TESTS PASSED SUCCESSFULLY!');
  process.exit(0);
}
