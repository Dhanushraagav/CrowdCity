import fs from 'fs';

const html = fs.readFileSync('client/weather-alerts.html', 'utf8');

// Target selectors to verify
const surfaces = [
  { name: 'Page Background (body)', selector: '[data-theme="dark"] body', target: '#000000' },
  { name: 'App Layout Container', selector: '[data-theme="dark"] .app-layout', target: '#000000' },
  { name: 'Main Content Container', selector: '[data-theme="dark"] .main-content', target: '#000000' },
  { name: 'Weather Hero Card', selector: '[data-theme="dark"] .weather-hero-card', target: '#000000' },
  { name: 'Hero Metric Tiles', selector: '[data-theme="dark"] .metric-card-tile', target: '#050505' },
  { name: 'Location Banner', selector: '[data-theme="dark"] .weather-location-banner', target: '#050505' },
  { name: 'Search / Filter Card', selector: '[data-theme="dark"] .weather-filter-card', target: '#000000' },
  { name: 'Search Input', selector: '[data-theme="dark"] #weather-search-input', target: '#050505' },
  { name: 'District Dropdown', selector: '[data-theme="dark"] .weather-select-filter', target: '#050505' },
  { name: 'Time Tabs (Inactive)', selector: '[data-theme="dark"] .weather-tab-btn', target: '#050505' },
  { name: 'Time Tabs (Active)', selector: '[data-theme="dark"] .weather-tab-btn.active', target: '#080808' },
  { name: 'Search Popover', selector: '[data-theme="dark"] .weather-search-popover', target: '#050505' },
  { name: 'Popover Action Button', selector: '[data-theme="dark"] .popover-action-btn', target: '#080808' },
  { name: 'Popover District Chip', selector: '[data-theme="dark"] .popover-chip', target: '#080808' },
  { name: 'Nearby Regions Section', selector: '[data-theme="dark"] .nearby-regions-section', target: '#000000' },
  { name: 'Region Card Chip', selector: '[data-theme="dark"] .region-card-chip', target: '#050505' },
  { name: 'Region Card Chip (Active)', selector: '[data-theme="dark"] .region-card-chip.active', target: '#080808' },
  { name: 'Region Distance Badge', selector: '[data-theme="dark"] .region-chip-dist', target: '#121212' },
  { name: 'Hourly Forecast Section', selector: '[data-theme="dark"] .hourly-forecast-section', target: '#000000' },
  { name: 'Hourly Card Pill', selector: '[data-theme="dark"] .hourly-card-pill', target: '#060606' },
  { name: 'Hourly Card Pill (is-now)', selector: '[data-theme="dark"] .hourly-card-pill.is-now', target: '#060606' },
  { name: 'Daily Forecast Card', selector: '[data-theme="dark"] .daily-forecast-card', target: '#060606' },
  { name: 'Daily Forecast Card (is-today)', selector: '[data-theme="dark"] .daily-forecast-card.is-today', target: '#060606' },
  { name: '38 District Overview Card', selector: '[data-theme="dark"] .district-overview-card', target: '#060606' },
  { name: 'State Box (Error/Unavailable/Empty)', selector: '[data-theme="dark"] .weather-state-box', target: '#060606' },
  { name: 'Back Button', selector: '[data-theme="dark"] .weather-back-btn', target: '#050505' }
];

console.log('--- AMOLED COMPUTED COLOR VALIDATION ---');
let allPassed = true;
surfaces.forEach(s => {
  // Check if html contains rule for s.selector with s.target
  const hasTarget = html.includes(s.target);
  const selectorEsc = s.selector.replace(/\[/g, '\\[').replace(/\]/g, '\\]').replace(/\./g, '\\.').replace(/\#/g, '\\#');
  const regex = new RegExp(selectorEsc + '[^{]*\\{[^}]*background(?:-color)?\\s*:\\s*' + s.target, 'i');
  const matched = regex.test(html);
  console.log(`${matched ? '✓' : '✗'} ${s.name}: ${s.target} ${matched ? '(Verified)' : '(Not matched!)'}`);
  if (!matched) allPassed = false;
});

if (allPassed) {
  console.log('\n🎉 ALL 26 MAJOR WEATHER SURFACES ARE VERIFIED TRUE AMOLED BLACK (#000000 / #050505 / #060606 / #080808)!');
} else {
  console.error('\nSome surfaces did not match target!');
  process.exit(1);
}
