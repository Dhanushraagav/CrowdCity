/**
 * Automated Verification Suite for Complaint ID & Duplicate Complaint Engine
 */

import { generateNextComplaintId, normalizeComplaintRecord } from '../services/complaintIdService.js';
import {
  calculateHaversineDistance,
  computeTextSimilarity,
  findDuplicateCandidate
} from '../services/duplicateDetectionService.js';

async function runTests() {
  console.log('--- STARTING COMPLAINT ID & DUPLICATE DETECTION TEST SUITE ---');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failed++;
    }
  }

  // TEST 1: Complaint ID Format
  const currentYear = new Date().getFullYear();
  const id1 = await generateNextComplaintId();
  console.log(`Generated ID 1: ${id1}`);
  const idFormatRegex = new RegExp(`^CC-${currentYear}-\\d{6}$`);
  assert(idFormatRegex.test(id1), `Complaint ID matches CC-${currentYear}-NNNNNN format: ${id1}`);

  // TEST 2: Concurrency & Monotonic Sequence
  const concurrentCount = 5;
  const ids = await Promise.all(Array.from({ length: concurrentCount }, () => generateNextComplaintId()));
  console.log('Concurrent IDs generated:', ids);
  const uniqueIds = new Set(ids);
  assert(uniqueIds.size === concurrentCount, `All ${concurrentCount} concurrent IDs are strictly unique`);

  // Ensure sequence numbers increase monotonically
  const nums = ids.map(id => parseInt(id.split('-')[2], 10));
  let isMonotonic = true;
  for (let i = 1; i < nums.length; i++) {
    if (nums[i] <= nums[i - 1]) isMonotonic = false;
  }
  assert(isMonotonic, `Sequential numbers are monotonically increasing: ${nums.join(', ')}`);

  // TEST 3: normalizeComplaintRecord
  const rawIssue = {
    id: 'ae450a07-8899-44aa-bbcc-123456789abc',
    title: 'Pothole on Main Road',
    created_at: '2026-03-01T12:00:00Z'
  };
  normalizeComplaintRecord(rawIssue);
  assert(rawIssue.complaint_id.startsWith(`CC-${currentYear}-`), `Normalized complaint ID is valid: ${rawIssue.complaint_id}`);
  assert(rawIssue.citizen_count === 1, `Normalized default citizen_count is 1`);

  // TEST 4: Haversine Distance
  // Coimbatore Gandhipuram (11.0168, 76.9558) to Cross Cut Road ~200m away (11.0180, 76.9565)
  const dist = calculateHaversineDistance(11.0168, 76.9558, 11.0180, 76.9565);
  console.log(`Calculated distance: ${Math.round(dist)} meters`);
  assert(dist > 100 && dist < 250, `Distance calculation is accurate (~${Math.round(dist)}m)`);

  // TEST 5: Text Similarity
  const simHigh = computeTextSimilarity(
    'Huge deep pothole damaging vehicles on 100 feet road',
    'Severe pothole on 100 feet road causing vehicle tire damage'
  );
  const simLow = computeTextSimilarity(
    'Huge deep pothole on road',
    'Streetlight broken dark alleyway at night'
  );
  console.log(`Text similarity high: ${simHigh.toFixed(2)}, low: ${simLow.toFixed(2)}`);
  assert(simHigh > 0.4, `Text similarity accurately scored high for similar issues (${simHigh.toFixed(2)})`);
  assert(simLow === 0, `Text similarity accurately scored 0 for unrelated issues (${simLow.toFixed(2)})`);

  // TEST 6: Bounding Box & Active Duplicate Candidate Finder
  // Search for issue in Coimbatore (or empty if none in bounding box)
  const dupCheck = await findDuplicateCandidate({
    latitude: 11.0168,
    longitude: 76.9558,
    category: 'roads',
    title: 'Dangerous road damage',
    description: 'Very dangerous pothole near the bus stop'
  });
  console.log('Duplicate check response:', dupCheck);
  assert(typeof dupCheck.is_duplicate === 'boolean', 'findDuplicateCandidate executed successfully and returned boolean result');

  console.log(`\n--- TEST SUMMARY: ${passed} PASSED, ${failed} FAILED ---`);
  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
