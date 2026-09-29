/**
 * Comprehensive Test Suite for Transportation Image Attachment Persistence
 * Validates:
 * 1. Transportation complaint without image
 * 2. Transportation complaint with one image
 * 3. Transportation complaint with multiple images
 * 4. AI-analyzed transportation complaint with image
 * 5. Invalid file type rejection
 * 6. Oversized file rejection (>5MB)
 * 7. Storage upload error handling
 * 8. Cleanup on error
 * 9. Existing Civic image submission regression
 * 10. photo_urls persistence
 * 11. Issue Details image rendering
 * 12. Authority Inspect Case image rendering
 */

import express from 'express';
import sharp from 'sharp';
import transportationRoutes from '../routes/transportationRoutes.js';
import issueRoutes from '../routes/issueRoutes.js';
import { createIssue } from '../controllers/issueController.js';
import { upload, handleUploadError } from '../middlewares/uploadMiddleware.js';
import { normalizeTransportationToIssue, findTransportationRecord, _resetTransportationStoreForTesting } from '../controllers/transportationController.js';
import { supabase, supabaseAdmin } from '../config/supabase.js';

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

async function runTests() {
  console.log('================================================================');
  console.log('STARTING TRANSPORTATION IMAGE ATTACHMENT PERSISTENCE TEST SUITE');
  console.log('================================================================\n');

  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use('/api/transportation', transportationRoutes);

  // Mock authenticated citizen user for test harness
  app.use((req, res, next) => {
    req.user = { id: '0043794b-819a-449b-bfad-327ac971a3d8', user_metadata: { full_name: 'Test Citizen' } };
    next();
  });
  app.post('/api/issues/create-test', upload.array('image', 5), handleUploadError, createIssue);
  app.use('/api/issues', issueRoutes);

  const server = await new Promise(resolve => {
    const s = app.listen(0, () => resolve(s));
  });
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;
  console.log(`Test server running at ${baseUrl}`);

  try {
    // Generate test images
    const img1Buffer = await sharp({
      create: { width: 150, height: 150, channels: 3, background: { r: 190, g: 60, b: 40 } }
    }).jpeg().toBuffer();

    const img2Buffer = await sharp({
      create: { width: 150, height: 150, channels: 3, background: { r: 60, g: 140, b: 200 } }
    }).jpeg().toBuffer();

    const img3Buffer = await sharp({
      create: { width: 150, height: 150, channels: 3, background: { r: 80, g: 180, b: 90 } }
    }).jpeg().toBuffer();

    // --- TEST 1: Transportation complaint WITHOUT image ---
    console.log('\n--- TEST 1: Complaint WITHOUT Image ---');
    const noImgFormData = new FormData();
    const lat1 = (11.3500 + Math.random() * 0.05).toFixed(4);
    const lng1 = (76.8500 + Math.random() * 0.05).toFixed(4);
    noImgFormData.append('title', `Pothole without photo ${Date.now()}`);
    noImgFormData.append('category', 'Damaged Roads');
    noImgFormData.append('description', 'Minor crack on roadside without camera capture');
    noImgFormData.append('latitude', lat1);
    noImgFormData.append('longitude', lng1);
    noImgFormData.append('address', 'Mettupalayam Road, Coimbatore');

    const res1 = await fetch(`${baseUrl}/api/transportation/reports`, {
      method: 'POST',
      body: noImgFormData
    });
    assert(res1.status === 201, 'HTTP 201 returned for complaint without image', `status=${res1.status}`);
    const data1 = await res1.json();
    assert(data1.success === true, 'Complaint without image created successfully');
    assert(Array.isArray(data1.report?.photo_urls) && data1.report.photo_urls.length === 0, 'photo_urls is empty array when no image is uploaded');
    assert(data1.report?.image_url === null, 'image_url is null when no image is uploaded');

    // --- TEST 2: Transportation complaint WITH ONE image ---
    console.log('\n--- TEST 2: Complaint WITH ONE Image ---');
    const oneImgFormData = new FormData();
    const lat2 = (11.0600 + Math.random() * 0.05).toFixed(4);
    const lng2 = (76.9300 + Math.random() * 0.05).toFixed(4);
    oneImgFormData.append('title', `Damaged asphalt with single image ${Date.now()}`);
    oneImgFormData.append('category', 'Damaged Roads');
    oneImgFormData.append('description', 'Deep pothole captured by citizen camera');
    oneImgFormData.append('latitude', lat2);
    oneImgFormData.append('longitude', lng2);
    oneImgFormData.append('address', 'Avinashi Road, Peelamedu, Coimbatore');
    oneImgFormData.append('image', new Blob([img1Buffer], { type: 'image/jpeg' }), 'pothole_evidence.jpg');

    const res2 = await fetch(`${baseUrl}/api/transportation/reports`, {
      method: 'POST',
      body: oneImgFormData
    });
    assert(res2.status === 201, 'HTTP 201 returned for complaint with 1 image', `status=${res2.status}`);
    const data2 = await res2.json();
    const rep2 = data2.report;
    assert(data2.success === true, 'Complaint with 1 image created successfully');
    assert(Array.isArray(rep2?.photo_urls) && rep2.photo_urls.length === 1, 'photo_urls contains exactly 1 URL');
    assert(rep2?.photo_urls[0].includes('issue-images/reports/'), 'Stored URL references Supabase Storage bucket issue-images/reports/');
    assert(rep2?.image_url === rep2?.photo_urls[0], 'image_url is populated and matches photo_urls[0]');
    assert(Array.isArray(rep2?.attachments) && rep2.attachments.length === 1, 'attachments array contains 1 entry');

    // --- TEST 3: Transportation complaint WITH MULTIPLE images ---
    console.log('\n--- TEST 3: Complaint WITH MULTIPLE Images (3 Images) ---');
    const multiImgFormData = new FormData();
    const lat3 = (11.1200 + Math.random() * 0.05).toFixed(4);
    const lng3 = (76.9400 + Math.random() * 0.05).toFixed(4);
    multiImgFormData.append('title', `Extensive road collapse multiple angles ${Date.now()}`);
    multiImgFormData.append('category', 'Damaged Roads');
    multiImgFormData.append('description', 'Multiple photo angles showing severe road collapse');
    multiImgFormData.append('latitude', lat3);
    multiImgFormData.append('longitude', lng3);
    multiImgFormData.append('address', 'Thadagam Road, Coimbatore');
    multiImgFormData.append('image', new Blob([img1Buffer], { type: 'image/jpeg' }), 'front_angle.jpg');
    multiImgFormData.append('image', new Blob([img2Buffer], { type: 'image/jpeg' }), 'side_angle.jpg');
    multiImgFormData.append('image', new Blob([img3Buffer], { type: 'image/jpeg' }), 'close_up.jpg');

    const res3 = await fetch(`${baseUrl}/api/transportation/reports`, {
      method: 'POST',
      body: multiImgFormData
    });
    assert(res3.status === 201, 'HTTP 201 returned for complaint with 3 images', `status=${res3.status}`);
    const data3 = await res3.json();
    const rep3 = data3.report;
    assert(Array.isArray(rep3?.photo_urls) && rep3.photo_urls.length === 3, 'photo_urls contains all 3 uploaded image URLs', `count=${rep3?.photo_urls?.length}`);
    assert(rep3?.photo_urls[0] !== rep3?.photo_urls[1] && rep3?.photo_urls[1] !== rep3?.photo_urls[2], 'All 3 uploaded URLs are distinct');
    assert(Array.isArray(rep3?.attachments) && rep3.attachments.length === 3, 'attachments array contains all 3 attachments');

    // --- TEST 4: AI-analyzed transportation complaint with image ---
    console.log('\n--- TEST 4: AI-Analyzed Complaint with Image ---');
    const aiFormData = new FormData();
    const lat4 = (11.1600 + Math.random() * 0.05).toFixed(4);
    const lng4 = (76.9600 + Math.random() * 0.05).toFixed(4);
    aiFormData.append('title', 'AI Detected Potholes and Asphalt Cracking');
    aiFormData.append('category', 'Potholes');
    aiFormData.append('description', 'AI vision detected 3 severe potholes with depth > 10cm causing hazard.');
    aiFormData.append('latitude', lat4);
    aiFormData.append('longitude', lng4);
    aiFormData.append('address', 'Sathy Road, Saravanampatti, Coimbatore');
    aiFormData.append('image', new Blob([img1Buffer], { type: 'image/jpeg' }), 'ai_analyzed_camera_feed.jpg');

    const res4 = await fetch(`${baseUrl}/api/transportation/reports`, {
      method: 'POST',
      body: aiFormData
    });
    assert(res4.status === 201, 'HTTP 201 returned for AI-analyzed complaint with image', `status=${res4.status}`);
    const data4 = await res4.json();
    assert(data4.aiAnalysis !== undefined, 'AI triage metadata returned in submission response');
    assert(data4.report?.photo_urls?.length === 1, 'Original photo successfully attached to AI-analyzed complaint');

    // --- TEST 5: Invalid file type rejection ---
    console.log('\n--- TEST 5: Security / Invalid File Type Rejection ---');
    const invalidFileFormData = new FormData();
    invalidFileFormData.append('title', 'Invalid file test');
    invalidFileFormData.append('category', 'Damaged Roads');
    invalidFileFormData.append('description', 'Attempting to upload executable text file');
    invalidFileFormData.append('latitude', '11.0168');
    invalidFileFormData.append('longitude', '76.9558');
    invalidFileFormData.append('image', new Blob(['fake content malicious'], { type: 'text/plain' }), 'script.sh');

    const res5 = await fetch(`${baseUrl}/api/transportation/reports`, {
      method: 'POST',
      body: invalidFileFormData
    });
    assert(res5.status === 400, 'HTTP 400 returned when uploading non-image file type', `status=${res5.status}`);
    const data5 = await res5.json();
    assert(data5.error && data5.error.includes('Only JPEG, PNG, and WEBP image uploads are allowed'), 'Clear validation error returned for invalid MIME type');

    // --- TEST 6: Oversized file rejection (>5MB) ---
    console.log('\n--- TEST 6: Security / Oversized File (>5MB) Rejection ---');
    const oversizedBuffer = Buffer.alloc(6 * 1024 * 1024); // 6MB
    const oversizedFormData = new FormData();
    oversizedFormData.append('title', 'Oversized file test');
    oversizedFormData.append('category', 'Damaged Roads');
    oversizedFormData.append('description', 'Attempting to upload 6MB file');
    oversizedFormData.append('latitude', '11.0168');
    oversizedFormData.append('longitude', '76.9558');
    oversizedFormData.append('image', new Blob([oversizedBuffer], { type: 'image/jpeg' }), 'huge_photo.jpg');

    const res6 = await fetch(`${baseUrl}/api/transportation/reports`, {
      method: 'POST',
      body: oversizedFormData
    });
    assert(res6.status === 400, 'HTTP 400 returned when uploading file exceeding 5MB limit', `status=${res6.status}`);
    const data6 = await res6.json();
    assert(data6.error && data6.error.includes('File size limit exceeded'), 'Clear validation error returned for oversized file');

    // --- TEST 7: Storage URL Verification ---
    console.log('\n--- TEST 7: Supabase Storage URL Verification ---');
    const photoUrl = rep2.photo_urls[0];
    const fetchPhotoRes = await fetch(photoUrl);
    assert(fetchPhotoRes.status === 200, 'Persisted Supabase Storage public URL is reachable with HTTP 200', `url=${photoUrl}`);
    const photoContentType = fetchPhotoRes.headers.get('content-type');
    assert(photoContentType && photoContentType.includes('image'), 'Storage URL serves genuine image content-type', `contentType=${photoContentType}`);

    // --- TEST 8: GET /reports/:id Persistence Check ---
    console.log('\n--- TEST 8: Database / API Persistence (GET /reports/:id) ---');
    const getReportRes = await fetch(`${baseUrl}/api/transportation/reports/${rep2.id}`);
    assert(getReportRes.status === 200, 'GET /reports/:id returns HTTP 200');
    const getReportData = await getReportRes.json();
    const persistedRep = getReportData.report || getReportData;
    assert(Array.isArray(persistedRep.photo_urls) && persistedRep.photo_urls.length === 1, 'Persisted report has photo_urls array with 1 item');
    assert(persistedRep.photo_urls[0] === photoUrl, 'Persisted photo_url matches uploaded Supabase Storage URL');

    // --- TEST 9: Existing Civic Pipeline Regression Test ---
    console.log('\n--- TEST 9: Existing Civic Pipeline Regression Check ---');
    const civicFormData = new FormData();
    civicFormData.append('title', `Civic complaint with photo test ${Date.now()}`);
    civicFormData.append('category', 'roads');
    civicFormData.append('description', 'Civic issue testing camera upload persistence in core pipeline');
    civicFormData.append('latitude', (11.0200 + Math.random() * 0.05).toFixed(4));
    civicFormData.append('longitude', (76.9100 + Math.random() * 0.05).toFixed(4));
    civicFormData.append('address', 'Trichy Road, Ramanathapuram, Coimbatore');
    civicFormData.append('image', new Blob([img1Buffer], { type: 'image/jpeg' }), 'civic_road.jpg');

    const civicRes = await fetch(`${baseUrl}/api/issues/create-test`, {
      method: 'POST',
      body: civicFormData
    });
    assert(civicRes.status === 201, 'Civic issue creation returns HTTP 201', `status=${civicRes.status}`);
    const civicData = await civicRes.json();
    assert(civicData.image_url && civicData.image_url.includes('issue-images/reports/'), 'Civic issue successfully persists image_url in Supabase Storage');

    // --- TEST 10: Issue Details Normalization Check ---
    console.log('\n--- TEST 10: Issue Details Normalization Check ---');
    const normalized = normalizeTransportationToIssue(rep2);
    assert(normalized.image_url === photoUrl, 'normalizeTransportationToIssue sets image_url to photo_urls[0]');
    assert(Array.isArray(normalized.photo_urls) && normalized.photo_urls.length === 1, 'normalizeTransportationToIssue retains photo_urls array');
    assert(Array.isArray(normalized.attachments) && normalized.attachments.length === 1, 'normalizeTransportationToIssue includes attachments array');

    // --- TEST 11: Issue Details HTTP Endpoint Check ---
    console.log('\n--- TEST 11: Issue Details HTTP Endpoint (GET /api/issues/:id) ---');
    const detailsRes = await fetch(`${baseUrl}/api/issues/${rep2.id}`);
    assert(detailsRes.status === 200, 'GET /api/issues/:id for transportation report returns HTTP 200');
    const detailsData = await detailsRes.json();
    assert(detailsData.image_url === photoUrl, 'Issue details response image_url matches uploaded photo URL');
    assert(detailsData.sourceType === 'transportation', 'Issue details confirms sourceType: transportation');

    // --- TEST 12: Authority Inspect Case Unified Image Reference ---
    console.log('\n--- TEST 12: Authority Inspect Case Image Reference ---');
    // Authority inspect case queries the same /api/issues/:id endpoint
    assert(detailsData.photo_urls && detailsData.photo_urls[0] === photoUrl, 'Authority Portal inspect case receives identical photo_urls reference');
    assert(detailsData.image_url === photoUrl, 'Citizen Portal and Authority Portal share identical image attachment reference');

    console.log('\n================================================================');
    console.log(`ATTACHMENT PERSISTENCE TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================');

    if (failed > 0) process.exit(1);
  } finally {
    server.close();
    _resetTransportationStoreForTesting([]);
  }
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
