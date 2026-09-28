/**
 * End-to-End HTTP Test for Duplicate Detection & Image Attachment Persistence
 */

import express from 'express';
import transportationRoutes from '../routes/transportationRoutes.js';
import issueRoutes from '../routes/issueRoutes.js';
import sharp from 'sharp';

import { checkIssueDuplicate } from '../controllers/issueController.js';

let passed = 0;
let failed = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passed++;
  } else {
    console.error(`[FAIL] ${testName} - ${details}`);
    failed++;
  }
}

async function runE2ETests() {
  console.log('====================================================');
  console.log('STARTING E2E HTTP TESTS (DUPLICATE DETECTION & ATTACHMENT PERSISTENCE)');
  console.log('====================================================\n');

  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use('/api/transportation', transportationRoutes);
  app.post('/api/issues/check-duplicate-test', checkIssueDuplicate);

  const server = await new Promise(resolve => {
    const s = app.listen(0, () => resolve(s));
  });
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;
  console.log(`Test server running at ${baseUrl}`);

  try {
    // 1. Test POST /api/transportation/reports/check-duplicate
    console.log('\n--- 1. HTTP: /api/transportation/reports/check-duplicate ---');
    const checkRes = await fetch(`${baseUrl}/api/transportation/reports/check-duplicate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        latitude: 10.9996,
        longitude: 77.0839,
        category: 'Damaged Roads',
        title: 'Road damaged with deep potholes',
        description: 'Road damage and potholes near highway'
      })
    });

    assert(checkRes.status === 200, 'POST /api/transportation/reports/check-duplicate returns HTTP 200', `status=${checkRes.status}`);
    const checkData = await checkRes.json();
    console.log('Transportation check-duplicate response:', {
      is_duplicate: checkData.is_duplicate,
      result: checkData.result,
      score: checkData.score?.toFixed(3),
      candidateId: checkData.candidate?.complaint_id
    });

    assert(checkData.is_duplicate === true, 'Duplicate is detected for known nearby transportation issue');
    assert(Boolean(checkData.candidate), 'Candidate object returned in duplicate check response');

    // 2. Test POST /api/issues/check-duplicate (Unified Civic endpoint)
    console.log('\n--- 2. HTTP: /api/issues/check-duplicate ---');
    const civicCheckRes = await fetch(`${baseUrl}/api/issues/check-duplicate-test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        latitude: 10.9996,
        longitude: 77.0839,
        category: 'roads',
        title: 'Road damage and deep craters',
        description: 'Broken road surface in front of shops'
      })
    });

    assert(civicCheckRes.status === 200, 'POST /api/issues/check-duplicate returns HTTP 200', `status=${civicCheckRes.status}`);
    const civicCheckData = await civicCheckRes.json();
    console.log('Civic check-duplicate response:', {
      is_duplicate: civicCheckData.is_duplicate,
      result: civicCheckData.result,
      score: civicCheckData.score?.toFixed(3),
      candidateId: civicCheckData.candidate?.complaint_id
    });
    assert(civicCheckData.is_duplicate === true, 'Civic check-duplicate identifies cross-pipeline candidate');

    // 3. Test POST /api/transportation/reports with Multipart FormData & Image
    console.log('\n--- 3. HTTP: POST /api/transportation/reports (Multipart FormData + Image Attachment) ---');

    // Generate a valid synthetic JPEG image buffer
    const testImageBuffer = await sharp({
      create: { width: 120, height: 120, channels: 3, background: { r: 180, g: 70, b: 50 } }
    }).jpeg().toBuffer();

    const uniqueLat = (11.2000 + Math.random() * 0.05).toFixed(4);
    const uniqueLng = (76.8000 + Math.random() * 0.05).toFixed(4);

    const formData = new FormData();
    formData.append('title', `New distinct road problem on link ${Date.now()}`);
    formData.append('category', 'Damaged Roads');
    formData.append('description', 'Surface erosion on rural link after heavy rain');
    formData.append('latitude', uniqueLat); // Distinct new location
    formData.append('longitude', uniqueLng);
    formData.append('address', 'Rural link road, Annur');
    formData.append('user_id', 'test_citizen_e2e');

    const imageBlob = new Blob([testImageBuffer], { type: 'image/jpeg' });
    formData.append('image', imageBlob, 'road_damage_evidence.jpg');

    const submitRes = await fetch(`${baseUrl}/api/transportation/reports`, {
      method: 'POST',
      body: formData
    });

    assert(submitRes.status === 201, 'POST /api/transportation/reports with image returns HTTP 201', `status=${submitRes.status}`);
    const submitData = await submitRes.json();
    console.log('Submission response:', {
      success: submitData.success,
      reportId: submitData.report?.id,
      reportNumber: submitData.report?.report_number,
      photoUrlsCount: submitData.report?.photo_urls?.length,
      firstPhoto: submitData.report?.photo_urls?.[0]?.substring(0, 60),
      imageHash: submitData.report?.image_hash
    });

    assert(submitData.success === true, 'Transportation report submission succeeded');
    assert(Array.isArray(submitData.report?.photo_urls), 'report.photo_urls is an array');
    assert(submitData.report?.photo_urls?.length > 0, 'report.photo_urls contains uploaded photo URL (Image Attachment Persisted!)');
    assert(Boolean(submitData.report?.image_hash), 'report.image_hash was computed and stored');

    // 4. Test Backend Duplicate Enforcement on POST /api/transportation/reports
    console.log('\n--- 4. HTTP: Backend Duplicate Enforcement on Submission ---');

    // Attempt to submit an identical complaint at exact same coordinates with same text
    const dupFormData = new FormData();
    dupFormData.append('title', 'Road damaged with deep potholes');
    dupFormData.append('category', 'Damaged Roads');
    dupFormData.append('description', 'Road damage and potholes near highway');
    dupFormData.append('latitude', '10.9996');
    dupFormData.append('longitude', '77.0839');
    dupFormData.append('address', 'KM 331/6 of Nagapattinam-Mysore Road');

    const dupSubmitRes = await fetch(`${baseUrl}/api/transportation/reports`, {
      method: 'POST',
      body: dupFormData
    });

    const dupSubmitData = await dupSubmitRes.json();
    console.log('Duplicate submission response:', {
      duplicate_detected: dupSubmitData.duplicate_detected,
      duplicate_result: dupSubmitData.duplicate_result,
      message: dupSubmitData.message
    });

    assert(dupSubmitData.duplicate_detected === true, 'Backend enforcement blocks duplicate creation and returns duplicate_detected: true');
    assert(dupSubmitData.duplicate_result === 'CONFIRMED_DUPLICATE', 'Duplicate result is CONFIRMED_DUPLICATE');

    console.log('\n====================================================');
    console.log(`E2E TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================');

    if (failed > 0) process.exit(1);
  } finally {
    server.close();
  }
}

runE2ETests().catch(err => {
  console.error('E2E test error:', err);
  process.exit(1);
});
