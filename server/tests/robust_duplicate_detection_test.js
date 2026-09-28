/**
 * Robust Duplicate Detection Comprehensive Test Suite
 * Tests Category Normalization, Image Hashing, Unified Duplicate Detection Engine,
 * Cross-Pipeline Matching, and Spatial Discrimination.
 */

import { normalizeCategory, areCategoriesCompatible, getSearchRadius, CANONICAL_CATEGORIES } from '../services/categoryNormalizationService.js';
import { computeImageHash, computeHammingDistance, computeImageSimilarity } from '../services/imageHashService.js';
import { findUnifiedDuplicate, findDuplicateCandidate, DUPLICATE_CONFIG, calculateHaversineDistance, computeTextSimilarity } from '../services/duplicateDetectionService.js';
import { getAllTransportationRecords } from '../controllers/transportationController.js';

let passedCount = 0;
let failedCount = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passedCount++;
  } else {
    console.error(`[FAIL] ${testName} - ${details}`);
    failedCount++;
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('STARTING ROBUST DUPLICATE DETECTION TEST SUITE');
  console.log('====================================================\n');

  // --- SECTION 1: Category Normalization Tests ---
  console.log('--- 1. CATEGORY NORMALIZATION TESTS ---');

  assert(normalizeCategory('roads') === 'roads', 'Civic roads normalizes to roads');
  assert(normalizeCategory('Damaged Roads') === 'roads', 'Transportation Damaged Roads normalizes to roads');
  assert(normalizeCategory('Potholes') === 'roads', 'Transportation Potholes normalizes to roads');
  assert(normalizeCategory('Road Surface Damage') === 'roads', 'Road Surface Damage normalizes to roads');
  assert(normalizeCategory('Traffic Signal Not Working') === 'traffic', 'Traffic Signal Not Working normalizes to traffic');
  assert(normalizeCategory('Broken Street Lights') === 'streetlights', 'Broken Street Lights normalizes to streetlights');
  assert(normalizeCategory('Waterlogging') === 'water_supply', 'Waterlogging normalizes to water_supply');
  assert(normalizeCategory('Other Transportation Issue') === 'other', 'Other Transportation Issue normalizes to other');
  assert(normalizeCategory('unknown_xyz') === 'other', 'Unknown category defaults to other');

  // --- SECTION 2: Category Compatibility Matrix ---
  console.log('\n--- 2. CATEGORY COMPATIBILITY MATRIX TESTS ---');

  assert(areCategoriesCompatible('roads', 'Damaged Roads') === 1.0, 'roads and Damaged Roads have 1.0 compatibility');
  assert(areCategoriesCompatible('Damaged Roads', 'Potholes') === 1.0, 'Damaged Roads and Potholes have 1.0 compatibility');
  assert(areCategoriesCompatible('roads', 'traffic') === 0.5, 'roads and traffic have 0.5 compatibility (related)');
  assert(areCategoriesCompatible('water_supply', 'drainage') === 0.5, 'water_supply and drainage have 0.5 compatibility (related)');
  assert(areCategoriesCompatible('garbage', 'sanitation') === 0.5, 'garbage and sanitation have 0.5 compatibility (related)');
  assert(areCategoriesCompatible('roads', 'garbage') === 0.0, 'roads and garbage have 0.0 compatibility (unrelated)');
  assert(areCategoriesCompatible('streetlights', 'drainage') === 0.0, 'streetlights and drainage have 0.0 compatibility (unrelated)');

  // --- SECTION 3: Category Radii ---
  console.log('\n--- 3. CATEGORY RADII CONFIGURATION TESTS ---');

  assert(getSearchRadius('roads') === 120, 'roads search radius is 120m');
  assert(getSearchRadius('streetlights') === 100, 'streetlights search radius is 100m');
  assert(getSearchRadius('traffic') === 300, 'traffic search radius is 300m');
  assert(getSearchRadius('water_supply') === 250, 'water_supply search radius is 250m');

  // --- SECTION 4: Image Hashing Tests ---
  console.log('\n--- 4. IMAGE HASHING TESTS ---');

  // Generate synthetic test image buffers with sharp
  const { default: sharp } = await import('sharp');
  
  // Test Image A: 100x100 white square
  const imgABuffer = await sharp({
    create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 255, b: 255 } }
  }).jpeg().toBuffer();

  // Test Image B: Identical to Image A
  const imgBBuffer = await sharp({
    create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 255, b: 255 } }
  }).jpeg().toBuffer();

  // Test Image C: 100x100 with gradient/split (half black, half white)
  const imgCBuffer = await sharp({
    create: { width: 100, height: 100, channels: 3, background: { r: 0, g: 0, b: 0 } }
  }).composite([{
    input: await sharp({
      create: { width: 50, height: 100, channels: 3, background: { r: 255, g: 255, b: 255 } }
    }).raw().toBuffer(),
    left: 50,
    top: 0,
    raw: { width: 50, height: 100, channels: 3 }
  }]).jpeg().toBuffer();

  const hashA = await computeImageHash(imgABuffer);
  const hashB = await computeImageHash(imgBBuffer);
  const hashC = await computeImageHash(imgCBuffer);

  assert(hashA && hashA.hash && hashA.hash.length === 16, 'computeImageHash returns 16-char hex hash', `hash=${hashA?.hash}`);
  assert(hashB && hashB.hash === hashA.hash, 'Identical images produce identical dHash');

  const simIdentical = computeImageSimilarity(hashA.hash, hashB.hash);
  assert(simIdentical === 1.0, 'Identical image similarity is 1.0', `similarity=${simIdentical}`);

  const distAC = computeHammingDistance(hashA.hash, hashC.hash);
  const simAC = computeImageSimilarity(hashA.hash, hashC.hash);
  assert(distAC > 0, 'Different images have Hamming distance > 0', `dist=${distAC}`);
  assert(simAC < 1.0, 'Different images have similarity < 1.0', `similarity=${simAC}`);

  // Test null/invalid input resilience
  const nullHash = await computeImageHash(null);
  assert(nullHash === null, 'computeImageHash handles null input gracefully');
  assert(computeImageSimilarity(null, hashA.hash) === 0, 'computeImageSimilarity handles null hash');

  // --- SECTION 5: Text Similarity & Distance Math ---
  console.log('\n--- 5. TEXT SIMILARITY & SPATIAL MATH TESTS ---');

  const text1 = 'Severe damaged road with deep potholes in front of shop';
  const text2 = 'Potholes and broken road surface near supermarket';
  const textSim = computeTextSimilarity(text1, text2);
  assert(textSim > 0.3, 'computeTextSimilarity detects overlapping civic phrases', `sim=${textSim}`);

  const unrelatedText = 'Streetlight bulb not glowing in residential layout';
  const unrelatedSim = computeTextSimilarity(text1, unrelatedText);
  assert(unrelatedSim < textSim, 'Unrelated text has significantly lower similarity', `unrelatedSim=${unrelatedSim}`);

  // Haversine test: Known coordinates in Coimbatore
  const dist = calculateHaversineDistance(11.0168, 76.9558, 11.0169, 76.9558);
  assert(dist > 5 && dist < 20, 'calculateHaversineDistance computes accurate short distance', `dist=${dist.toFixed(1)}m`);

  // --- SECTION 6: Unified Candidate Retrieval ---
  console.log('\n--- 6. UNIFIED CANDIDATE RETRIEVAL TESTS ---');

  const transRecords = await getAllTransportationRecords();
  assert(Array.isArray(transRecords) && transRecords.length > 0, 'getAllTransportationRecords returns transportation records', `count=${transRecords.length}`);

  // Known transportation report in disk store: trp-1790582037960
  // Location: 10.9996, 77.0839 (KM 331/6 of Nagapattinam-Mysore Road)
  const canonicalTrans = transRecords.find(r => r.id === 'trp-1790582037960' || (r.category && r.category.includes('Road')));
  assert(Boolean(canonicalTrans), 'Found seeded transportation record for testing');

  if (canonicalTrans) {
    const lat = parseFloat(canonicalTrans.latitude);
    const lng = parseFloat(canonicalTrans.longitude);

    // Scenario A: Exact duplicate submitted from another device (same location, same category, similar AI text)
    console.log('\n--- 7. SAME-ISSUE DUPLICATE DETECTION SCENARIOS ---');

    const exactDupResult = await findUnifiedDuplicate({
      latitude: lat + 0.00005, // ~5.5m away
      longitude: lng + 0.00005,
      category: 'Damaged Roads',
      title: 'Road damage and potholes on highway stretch',
      description: canonicalTrans.description || 'Damaged roads and potholes observed at this location',
      sourceType: 'transportation'
    });

    console.log('Exact duplicate query result:', {
      result: exactDupResult.result,
      score: exactDupResult.score?.toFixed(3),
      candidateId: exactDupResult.candidate?.complaint_id,
      distance: exactDupResult.candidate?.distance_meters
    });

    assert(
      exactDupResult.result === 'CONFIRMED_DUPLICATE',
      'Confirmed duplicate detected for same issue within 10m',
      `result=${exactDupResult.result}, score=${exactDupResult.score}`
    );
    assert(
      exactDupResult.candidate !== null,
      'Duplicate candidate record is returned'
    );
    assert(
      exactDupResult.candidate?.distance_meters !== undefined,
      'Candidate includes distance_meters'
    );

    // Scenario B: Cross-pipeline match (Civic complaint matching Transportation report)
    console.log('\n--- 8. CROSS-PIPELINE DETECTION SCENARIOS ---');

    const crossPipelineResult = await findUnifiedDuplicate({
      latitude: lat + 0.00008, // ~9m away
      longitude: lng + 0.00008,
      category: 'roads', // Civic category
      title: 'Damaged road surface with large craters',
      description: 'Potholes and broken asphalt on main road',
      sourceType: 'civic' // Civic reporting pipeline
    });

    console.log('Cross-pipeline query result:', {
      result: crossPipelineResult.result,
      score: crossPipelineResult.score?.toFixed(3),
      candidateId: crossPipelineResult.candidate?.complaint_id,
      candidateSource: crossPipelineResult.candidate?.sourceType
    });

    assert(
      crossPipelineResult.result === 'CONFIRMED_DUPLICATE' || crossPipelineResult.result === 'POSSIBLE_DUPLICATE',
      'Cross-pipeline duplicate detected (civic input matches transportation complaint)',
      `result=${crossPipelineResult.result}`
    );

    // Scenario C: Spatial discrimination (Different issue at same location)
    console.log('\n--- 9. SPATIAL DISCRIMINATION SCENARIOS ---');

    const differentIssueResult = await findUnifiedDuplicate({
      latitude: lat,
      longitude: lng,
      category: 'streetlights', // Streetlight issue at the exact same coordinates
      title: 'Streetlight pole broken and not functional',
      description: 'The light on this pole has been dark for two weeks',
      sourceType: 'civic'
    });

    console.log('Different issue query result:', {
      result: differentIssueResult.result,
      score: differentIssueResult.score,
      candidate: differentIssueResult.candidate
    });

    assert(
      differentIssueResult.result === 'NEW_ISSUE',
      'Different issue at same location correctly identified as NEW_ISSUE',
      `result=${differentIssueResult.result}`
    );

    // Scenario D: Distance boundary (Same issue type, but 500m away)
    console.log('\n--- 10. DISTANCE BOUNDARY SCENARIOS ---');

    const farAwayResult = await findUnifiedDuplicate({
      latitude: lat + 0.005, // ~550m away
      longitude: lng + 0.005,
      category: 'Damaged Roads',
      title: 'Damaged roads and potholes observed at this location',
      description: 'Damaged roads and potholes observed at this location',
      sourceType: 'transportation'
    });

    assert(
      farAwayResult.result === 'NEW_ISSUE',
      'Same issue > 500m away correctly identified as NEW_ISSUE',
      `result=${farAwayResult.result}`
    );
  }

  // --- SECTION 11: Backward Compatibility ---
  console.log('\n--- 11. BACKWARD COMPATIBILITY TESTS ---');

  const legacyResult = await findDuplicateCandidate({
    latitude: 10.9996,
    longitude: 77.0839,
    category: 'roads',
    title: 'Damaged road surface',
    description: 'Road damage near highway'
  });

  assert(
    typeof legacyResult.is_duplicate === 'boolean',
    'findDuplicateCandidate returns { is_duplicate: boolean }'
  );
  assert(
    typeof legacyResult.score === 'number',
    'findDuplicateCandidate returns { score: number }'
  );

  console.log('\n====================================================');
  console.log(`TEST RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log('====================================================');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test suite uncaught error:', err);
  process.exit(1);
});
