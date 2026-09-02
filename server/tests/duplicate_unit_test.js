/**
 * In-memory Unit Test for Multi-Signal Duplicate Detection Logic
 */

import { calculateHaversineDistance, computeTextSimilarity } from '../services/duplicateDetectionService.js';

function runUnitTests() {
  console.log('--- STARTING DUPLICATE DETECTION LOGIC UNIT TESTS ---');
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

  // Simulation scoring function matching duplicateDetectionService
  function scoreCandidate(input, candidate, maxRadius = 120) {
    const dist = calculateHaversineDistance(input.lat, input.lng, candidate.lat, candidate.lng);
    if (dist > maxRadius) return { score: 0, distance: dist, match: false };

    const locScore = Math.max(0, 1.0 - dist / maxRadius);
    const catScore = input.category === candidate.category ? 1.0 : 0.0;
    if (catScore === 0) return { score: 0, distance: dist, match: false };

    const textScore = computeTextSimilarity(
      `${input.title} ${input.description}`,
      `${candidate.title} ${candidate.description}`
    );

    const total = (locScore * 0.50) + (catScore * 0.25) + (textScore * 0.25);
    return { score: total, distance: dist, match: total >= 0.65 };
  }

  const baseInput = {
    lat: 11.0168,
    lng: 76.9558,
    category: 'roads',
    title: 'Severe pothole in front of supermarket',
    description: 'Deep road crater causing bike accidents'
  };

  // Case 1: Identical location (30m away), same category, similar wording
  const candidateNearby = {
    lat: 11.0170, // ~22m away
    lng: 76.9559,
    category: 'roads',
    title: 'Huge road crater near supermarket',
    description: 'Bike slipped on deep road pothole'
  };
  const res1 = scoreCandidate(baseInput, candidateNearby, 120);
  console.log(`Case 1 (Nearby & Similar): Distance=${Math.round(res1.distance)}m, Score=${res1.score.toFixed(2)}`);
  assert(res1.match === true && res1.score >= 0.70, 'Matched strong duplicate candidate nearby');

  // Case 2: Same category, but 250m away (exceeds 120m roads radius)
  const candidateFar = {
    lat: 11.0195, // ~300m away
    lng: 76.9565,
    category: 'roads',
    title: 'Severe pothole in front of supermarket',
    description: 'Deep road crater causing bike accidents'
  };
  const res2 = scoreCandidate(baseInput, candidateFar, 120);
  console.log(`Case 2 (Far away): Distance=${Math.round(res2.distance)}m, Score=${res2.score.toFixed(2)}`);
  assert(res2.match === false && res2.score === 0, 'Correctly rejected candidate beyond category radius');

  // Case 3: Same location, but completely different civic category (e.g. streetlight)
  const candidateDifferentCat = {
    lat: 11.0170,
    lng: 76.9559,
    category: 'streetlights',
    title: 'Streetlight completely dark',
    description: 'Streetlight pole broken near supermarket'
  };
  const res3 = scoreCandidate(baseInput, candidateDifferentCat, 120);
  console.log(`Case 3 (Different Category): Score=${res3.score.toFixed(2)}`);
  assert(res3.match === false && res3.score === 0, 'Correctly rejected candidate with unrelated category');

  console.log(`\n--- UNIT TESTS: ${passed} PASSED, ${failed} FAILED ---`);
  if (failed > 0) process.exit(1);
}

runUnitTests();
