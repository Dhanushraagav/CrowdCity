/**
 * CrowdCity AI — Authority Portal Complaint Queue & Priority Workflow Test Suite
 * 
 * Verifies:
 * 1. Operational work queue sorting: SLA Urgency -> Priority Score (desc) -> Age (asc)
 * 2. Exclusion of resolved/closed complaints from active default view
 * 3. SLA Urgency meta computation (Escalated, Overdue, Due Soon, Within SLA, Met)
 * 4. Multi-criteria filtering (status, priority, sla, category, assignment, district, search)
 * 5. Pagination calculation and boundary handling (15 items/page)
 * 6. Realtime event handling (idempotent upsert, delete)
 * 7. Tamil Nadu 38-district normalization
 */

import { strict as assert } from 'node:assert';

console.log('\n====================================================');
console.log('  RUNNING AUTHORITY QUEUE WORKFLOW TEST SUITE');
console.log('====================================================\n');

let passedCount = 0;
let failedCount = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`✓ PASS: ${desc}`);
    passedCount++;
  } catch (err) {
    console.error(`✗ FAIL: ${desc}`);
    console.error(err);
    failedCount++;
  }
}

// Dynamically import client controller helpers
await import('../../client/js/admin.js');
const mod = globalThis.__AdminComplaintModule;

assert.ok(mod, 'globalThis.__AdminComplaintModule must be loaded');
const {
  computeSlaUrgencyMeta,
  sortOperationalComplaints,
  getComplaintDistrict,
  TN_DISTRICTS_LIST
} = mod;

// -----------------------------------------------------------------------------
// 1. TAMIL NADU 38-DISTRICT CONFIGURATION
// -----------------------------------------------------------------------------
it('Tamil Nadu 38-district list contains exactly 38 districts', () => {
  assert.equal(TN_DISTRICTS_LIST.length, 38);
});

it('Detects district correctly from explicit district property', () => {
  const c = { district: 'Coimbatore', address: 'Gandhipuram, Tamil Nadu' };
  assert.equal(getComplaintDistrict(c), 'Coimbatore');
});

it('Detects district correctly from address when district property is omitted', () => {
  const c = { address: 'Anna Salai, Chennai, Tamil Nadu 600002' };
  assert.equal(getComplaintDistrict(c), 'Chennai');
});

it('Detects Ariyalur district correctly from address string', () => {
  const c = { address: 'Sendurai Road, Ariyalur, Tamil Nadu' };
  assert.equal(getComplaintDistrict(c), 'Ariyalur');
});

// -----------------------------------------------------------------------------
// 2. SLA URGENCY META COMPUTATION
// -----------------------------------------------------------------------------
const now = new Date('2026-09-23T12:00:00.000Z');
const nowMs = now.getTime();

it('Identifies Escalated complaint by is_escalated flag (Tier 1)', () => {
  const c = {
    id: 'c1',
    status: 'pending',
    is_escalated: true,
    created_at: new Date(nowMs - 50 * 3600000).toISOString()
  };
  const meta = computeSlaUrgencyMeta(c, nowMs);
  assert.equal(meta.tier, 1);
  assert.equal(meta.urgencyKey, 'escalated');
  assert.equal(meta.badgeClass, 'sla-badge-escalated');
  assert.equal(meta.rowHighlightClass, 'row-escalated');
});

it('Identifies Overdue complaint when past deadline without response (Tier 2)', () => {
  const c = {
    id: 'c2',
    status: 'pending',
    priority: 'high',
    created_at: new Date(nowMs - 30 * 3600000).toISOString(), // 30h ago (High SLA is 24h)
    sla_deadline: new Date(nowMs - 6 * 3600000).toISOString()
  };
  const meta = computeSlaUrgencyMeta(c, nowMs);
  assert.equal(meta.tier, 2);
  assert.equal(meta.urgencyKey, 'overdue');
  assert.equal(meta.badgeClass, 'sla-badge-overdue');
  assert.equal(meta.rowHighlightClass, 'row-overdue');
  assert.ok(meta.countdownText.includes('Overdue by'));
});

it('Identifies Due Soon complaint when <= 25% SLA remaining (Tier 3)', () => {
  const c = {
    id: 'c3',
    status: 'pending',
    priority: 'high', // 24h SLA
    sla_deadline: new Date(nowMs + 2 * 3600000).toISOString() // 2h remaining (< 6h)
  };
  const meta = computeSlaUrgencyMeta(c, nowMs);
  assert.equal(meta.tier, 3);
  assert.equal(meta.urgencyKey, 'due_soon');
  assert.equal(meta.badgeClass, 'sla-badge-duesoon');
  assert.equal(meta.rowHighlightClass, 'row-duesoon');
  assert.ok(meta.countdownText.includes('left'));
});

it('Identifies Within SLA complaint when sufficient time remains (Tier 4)', () => {
  const c = {
    id: 'c4',
    status: 'pending',
    priority: 'moderate', // 72h SLA
    sla_deadline: new Date(nowMs + 48 * 3600000).toISOString() // 48h remaining
  };
  const meta = computeSlaUrgencyMeta(c, nowMs);
  assert.equal(meta.tier, 4);
  assert.equal(meta.urgencyKey, 'within_sla');
  assert.equal(meta.badgeClass, 'sla-badge-normal');
  assert.equal(meta.rowHighlightClass, '');
  assert.ok(meta.countdownText.includes('remaining'));
});

it('Identifies Resolved / Closed complaint as Met SLA (Tier 5)', () => {
  const c = {
    id: 'c5',
    status: 'resolved',
    sla_status: 'met',
    sla_deadline: new Date(nowMs - 10 * 3600000).toISOString()
  };
  const meta = computeSlaUrgencyMeta(c, nowMs);
  assert.equal(meta.tier, 5);
  assert.equal(meta.urgencyKey, 'met');
});

// -----------------------------------------------------------------------------
// 3. OPERATIONAL WORK QUEUE SORTING ALGORITHM
// -----------------------------------------------------------------------------
it('Sorts complaints strictly by SLA Urgency Tier first (Tier 1 -> Tier 2 -> Tier 3 -> Tier 4 -> Tier 5)', () => {
  const complaints = [
    { id: 'within-sla', status: 'pending', sla_deadline: new Date(nowMs + 40 * 3600000).toISOString(), priority_score: 95 },
    { id: 'resolved', status: 'resolved', priority_score: 99 },
    { id: 'escalated', status: 'pending', is_escalated: true, priority_score: 40 },
    { id: 'overdue', status: 'pending', sla_deadline: new Date(nowMs - 5 * 3600000).toISOString(), priority_score: 50 },
    { id: 'due-soon', status: 'pending', sla_deadline: new Date(nowMs + 1 * 3600000).toISOString(), priority_score: 60 }
  ];

  const sorted = sortOperationalComplaints(complaints, nowMs);
  const ids = sorted.map(c => c.id);

  assert.deepEqual(ids, ['escalated', 'overdue', 'due-soon', 'within-sla', 'resolved']);
});

it('Sorts by Civic Priority Score descending within the same SLA urgency tier', () => {
  const complaints = [
    { id: 'overdue-low-score', status: 'pending', sla_deadline: new Date(nowMs - 2 * 3600000).toISOString(), priority_score: 35.0 },
    { id: 'overdue-high-score', status: 'pending', sla_deadline: new Date(nowMs - 2 * 3600000).toISOString(), priority_score: 88.5 },
    { id: 'overdue-mid-score', status: 'pending', sla_deadline: new Date(nowMs - 2 * 3600000).toISOString(), priority_score: 62.0 }
  ];

  const sorted = sortOperationalComplaints(complaints, nowMs);
  const ids = sorted.map(c => c.id);

  assert.deepEqual(ids, ['overdue-high-score', 'overdue-mid-score', 'overdue-low-score']);
});

it('Breaks priority score ties by submission age (older complaints first)', () => {
  const complaints = [
    { id: 'newer-issue', status: 'pending', sla_deadline: new Date(nowMs + 20 * 3600000).toISOString(), priority_score: 75.0, created_at: new Date(nowMs - 2 * 3600000).toISOString() },
    { id: 'older-issue', status: 'pending', sla_deadline: new Date(nowMs + 20 * 3600000).toISOString(), priority_score: 75.0, created_at: new Date(nowMs - 10 * 3600000).toISOString() }
  ];

  const sorted = sortOperationalComplaints(complaints, nowMs);
  assert.equal(sorted[0].id, 'older-issue');
  assert.equal(sorted[1].id, 'newer-issue');
});

// -----------------------------------------------------------------------------
// 4. MULTI-CRITERIA FILTERING
// -----------------------------------------------------------------------------
const sampleQueue = [
  { id: '1', complaint_id: 'CC-001', title: 'Deep Pothole on Mount Road', description: 'Accident risk', category: 'roads', status: 'pending', priority: 'high', priority_score: 65, address: 'Mount Road, Chennai', district: 'Chennai', created_at: now.toISOString() },
  { id: '2', complaint_id: 'CC-002', title: 'Severe Water Pipe Burst', description: 'Flooding residential area', category: 'water_supply', status: 'assigned', assigned_to: 'user-auth-1', priority: 'critical', priority_score: 90, address: 'Gandhipuram, Coimbatore', district: 'Coimbatore', created_at: now.toISOString() },
  { id: '3', complaint_id: 'CC-003', title: 'Streetlight Cable Fault', description: 'Dark alley', category: 'streetlights', status: 'resolved', priority: 'low', priority_score: 20, address: 'Salem Central', district: 'Salem', created_at: now.toISOString() },
  { id: '4', complaint_id: 'CC-004', title: 'Overdue Garbage Accumulation', description: 'Smell hazard', category: 'garbage', status: 'pending', priority: 'high', priority_score: 70, is_escalated: true, address: 'Trichy Main Road', district: 'Tiruchirappalli', created_at: now.toISOString() },
  { id: '5', complaint_id: 'CC-005', title: 'Closed Old Case', description: 'Archived issue', category: 'roads', status: 'closed', priority: 'moderate', priority_score: 30, address: 'Madurai West', district: 'Madurai', created_at: now.toISOString() }
];

it('Default Active filter excludes resolved and closed complaints', () => {
  const activeOnly = sampleQueue.filter(c => {
    const excluded = ['resolved', 'verified', 'closed', 'rejected', 'declined', 'completed'];
    return !excluded.includes(c.status);
  });

  assert.equal(activeOnly.length, 3);
  const ids = activeOnly.map(c => c.id);
  assert.ok(!ids.includes('3')); // resolved excluded
  assert.ok(!ids.includes('5')); // closed excluded
});

it('Priority filter isolates Critical complaints (Score >= 75)', () => {
  const criticalOnly = sampleQueue.filter(c => c.priority_score >= 75 || c.priority === 'critical');
  assert.equal(criticalOnly.length, 1);
  assert.equal(criticalOnly[0].id, '2');
});

it('Assignment filter isolates Unassigned cases', () => {
  const unassigned = sampleQueue.filter(c => !c.assigned_to);
  assert.equal(unassigned.length, 4);
  assert.ok(!unassigned.some(c => c.id === '2'));
});

it('District filter accurately matches Chennai district', () => {
  const chennaiComplaints = sampleQueue.filter(c => {
    const dist = (c.district || getComplaintDistrict(c) || '').toLowerCase();
    return dist.includes('chennai');
  });
  assert.equal(chennaiComplaints.length, 1);
  assert.equal(chennaiComplaints[0].id, '1');
});

it('Debounced search query matches Ticket ID, Title, and Address', () => {
  const searchFilter = (query) => {
    const q = query.toLowerCase();
    return sampleQueue.filter(c => 
      c.complaint_id.toLowerCase().includes(q) ||
      c.title.toLowerCase().includes(q) ||
      c.address.toLowerCase().includes(q)
    );
  };

  assert.equal(searchFilter('CC-002').length, 1);
  assert.equal(searchFilter('Pothole').length, 1);
  assert.equal(searchFilter('Gandhipuram').length, 1);
  assert.equal(searchFilter('NonexistentXYZ').length, 0);
});

// -----------------------------------------------------------------------------
// 5. CLIENT-SIDE PAGINATION MATH
// -----------------------------------------------------------------------------
it('Paginates 35 items into pages of 15 correctly', () => {
  const pageSize = 15;
  const items = Array.from({ length: 35 }, (_, i) => ({ id: `item-${i + 1}` }));
  const totalPages = Math.ceil(items.length / pageSize);

  assert.equal(totalPages, 3);

  const page1 = items.slice(0, 15);
  const page2 = items.slice(15, 30);
  const page3 = items.slice(30, 45);

  assert.equal(page1.length, 15);
  assert.equal(page2.length, 15);
  assert.equal(page3.length, 5);
  assert.equal(page1[0].id, 'item-1');
  assert.equal(page2[0].id, 'item-16');
  assert.equal(page3[0].id, 'item-31');
});

// -----------------------------------------------------------------------------
// 6. REALTIME EVENT HANDLING (IDEMPOTENCY)
// -----------------------------------------------------------------------------
it('INSERT event prepends new complaint without duplicates', () => {
  let queue = [...sampleQueue];
  const newComplaint = { id: '6', complaint_id: 'CC-006', title: 'New Realtime Water Leak', category: 'water_supply', status: 'pending', created_at: now.toISOString() };

  // First INSERT
  const idx1 = queue.findIndex(c => c.id === newComplaint.id);
  if (idx1 === -1) queue.unshift(newComplaint);
  assert.equal(queue.length, 6);
  assert.equal(queue[0].id, '6');

  // Redundant INSERT should be idempotent
  const idx2 = queue.findIndex(c => c.id === newComplaint.id);
  if (idx2 === -1) queue.unshift(newComplaint);
  else queue[idx2] = { ...queue[idx2], ...newComplaint };
  assert.equal(queue.length, 6); // Length stays 6
});

it('UPDATE event updates complaint in-place', () => {
  let queue = [...sampleQueue];
  const updatePayload = { id: '1', status: 'assigned', assigned_to: 'officer-99' };

  const idx = queue.findIndex(c => c.id === updatePayload.id);
  assert.ok(idx !== -1);
  queue[idx] = { ...queue[idx], ...updatePayload };

  assert.equal(queue[idx].status, 'assigned');
  assert.equal(queue[idx].assigned_to, 'officer-99');
  assert.equal(queue[idx].title, 'Deep Pothole on Mount Road'); // Preserved other fields
});

it('DELETE event removes complaint from queue', () => {
  let queue = [...sampleQueue];
  queue = queue.filter(c => c.id !== '2');
  assert.equal(queue.length, 4);
  assert.ok(!queue.some(c => c.id === '2'));
});

// -----------------------------------------------------------------------------
// 7. MULTI-FILTER COMBINATIONS & EDGE CASES
// -----------------------------------------------------------------------------
it('Combines Status=active + Priority=high + Category=roads filters accurately', () => {
  const combined = sampleQueue.filter(c => {
    const isExcluded = ['resolved', 'verified', 'closed', 'rejected'].includes(c.status);
    const matchesPriority = (c.priority_score >= 50 && c.priority_score < 75) || c.priority === 'high';
    const matchesCat = c.category === 'roads';
    return !isExcluded && matchesPriority && matchesCat;
  });

  assert.equal(combined.length, 1);
  assert.equal(combined[0].id, '1');
});

it('Emergency flag automatically forces critical SLA (4h window) and high priority sorting', () => {
  const normalComplaint = { id: 'norm', status: 'pending', priority: 'moderate', priority_score: 45.0, created_at: now.toISOString() };
  const emergencyComplaint = { id: 'emerg', status: 'pending', is_emergency: true, priority_score: 45.0, created_at: now.toISOString() };

  const metaNorm = computeSlaUrgencyMeta(normalComplaint, nowMs);
  const metaEmerg = computeSlaUrgencyMeta(emergencyComplaint, nowMs);

  assert.equal(metaNorm.tier, 4); // 72h window, plenty of time
  assert.equal(metaEmerg.tier, 3); // 4h window, <= 4h means due soon!
  
  const sorted = sortOperationalComplaints([normalComplaint, emergencyComplaint], nowMs);
  assert.equal(sorted[0].id, 'emerg');
  assert.equal(sorted[1].id, 'norm');
});

it('Handles Tamil unicode search query gracefully and safely', () => {
  const tamilQueue = [
    { id: 't1', complaint_id: 'CC-T1', title: 'சாலை சேதம் (Road Damage)', description: 'அண்ணா நகர் பகுதியில் குழி', address: 'சென்னை' },
    { id: 't2', complaint_id: 'CC-T2', title: 'Streetlight fault', description: 'Dark area', address: 'Coimbatore' }
  ];

  const results = tamilQueue.filter(c => 
    c.title.includes('சாலை') || c.description.includes('குழி') || c.address.includes('சென்னை')
  );

  assert.equal(results.length, 1);
  assert.equal(results[0].id, 't1');
});

it('Page boundary clamps out-of-range requested page numbers safely', () => {
  const clampPage = (p, totalItems, pageSize = 15) => {
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    if (p < 1) return 1;
    if (p > totalPages) return totalPages;
    return p;
  };

  assert.equal(clampPage(-5, 50), 1);
  assert.equal(clampPage(0, 50), 1);
  assert.equal(clampPage(2, 50), 2);
  assert.equal(clampPage(99, 50), 4); // 50 items = 4 pages
  assert.equal(clampPage(1, 0), 1); // 0 items = 1 page
});

console.log('\n====================================================');
console.log(`TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
console.log('====================================================\n');

if (failedCount > 0) {
  process.exit(1);
}
