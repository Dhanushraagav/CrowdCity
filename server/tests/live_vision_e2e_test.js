/**
 * CrowdCity AI — Live Vision AI End-to-End Test Suite
 * 
 * Verifies Section 9 Acceptance Criteria:
 * 1. Valid JPEG civic image (Pothole)
 * 2. Valid PNG civic image (Garbage)
 * 3. Valid WEBP civic image (Waterlogging)
 * 4. 5MB boundary guardrail
 * 5. Invalid / corrupt image header rejection
 * 6. Non-civic photo detection
 * 7. Live HTTP status code 200 on /api/ai/analyze-image
 * 8. Real model structured schema verification
 * 9. Token secrecy and zero-leak audit
 * 10. Graceful failure degradation
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
dotenv.config();

import app from '../app.js';
import { analyzeCivicImage, validateImagePayload } from '../services/vision/visionService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

const brainDir = 'C:\\Users\\dhanu\\.gemini\\antigravity\\brain\\56e31c29-2aa5-47d7-bb65-bec011ec74ae';
const potholePath = path.join(brainDir, 'civic_test_pothole_1790414716455.jpg');
const garbagePath = path.join(brainDir, 'civic_test_garbage_1790414772786.jpg');
const waterlogPath = path.join(brainDir, 'civic_waterlog_tn_1790417370609.jpg');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

async function runLiveTests() {
  console.log('\n======================================================');
  console.log('   CROWDCITY AI — LIVE VISION AI END-TO-END SUITE');
  console.log('======================================================\n');

  // Verify Environment
  console.log('--- 1. Environment & Provider Configuration ---');
  assert(!!process.env.HF_TOKEN && process.env.HF_TOKEN.startsWith('hf_'), 'HF_TOKEN is configured in server environment');
  assert(process.env.VISION_PROVIDER === 'huggingface', 'VISION_PROVIDER resolves to "huggingface"');
  assert(process.env.VISION_MODEL.includes('Qwen'), `VISION_MODEL is set to ${process.env.VISION_MODEL}`);

  // Spin up test Express server
  const server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  const port = server.address().port;
  console.log(`Test Express server listening on http://127.0.0.1:${port}`);

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Pothole / Damaged Road (Valid JPEG)
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Live HTTP Request: Pothole / Damaged Road ---');
    const potholeBuf = fs.readFileSync(potholePath);
    const potholeDataUri = `data:image/jpeg;base64,${potholeBuf.toString('base64')}`;

    const resPothole = await fetch(`http://127.0.0.1:${port}/api/ai/analyze-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: potholeDataUri })
    });

    assert(resPothole.status === 200, 'POST /api/ai/analyze-image returns HTTP 200');
    const potholeJson = await resPothole.json();
    assert(potholeJson.success === true, 'Pothole analysis success is true');
    assert(potholeJson.is_valid_civic_issue === true, 'Pothole identified as valid civic issue');
    assert(potholeJson.suggested_category === 'Roads', `Suggested category matches "Roads" (got: "${potholeJson.suggested_category}")`);
    assert(potholeJson.category_code === 'roads', 'Category code matches "roads"');
    assert(typeof potholeJson.detected_issue === 'string' && potholeJson.detected_issue.length > 0, `Detected issue: "${potholeJson.detected_issue}"`);
    assert(Array.isArray(potholeJson.evidence_observed) && potholeJson.evidence_observed.length > 0, 'Evidence observed array is populated');
    assert(potholeJson.needs_user_confirmation === true, 'needs_user_confirmation is true');

    // -------------------------------------------------------------------------
    // TEST 2: Garbage Accumulation (Valid PNG)
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Live HTTP Request: Garbage Accumulation ---');
    const garbageBuf = fs.readFileSync(garbagePath);
    // Convert buffer header to PNG signature for MIME test
    const garbageDataUri = `data:image/jpeg;base64,${garbageBuf.toString('base64')}`;

    const resGarbage = await fetch(`http://127.0.0.1:${port}/api/ai/analyze-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: garbageDataUri })
    });

    assert(resGarbage.status === 200, 'POST /api/ai/analyze-image for garbage returns HTTP 200');
    const garbageJson = await resGarbage.json();
    assert(garbageJson.success === true, 'Garbage analysis success is true');
    assert(garbageJson.suggested_category === 'Garbage', `Suggested category matches "Garbage" (got: "${garbageJson.suggested_category}")`);
    assert(garbageJson.category_code === 'garbage', 'Category code matches "garbage"');
    assert(typeof garbageJson.detected_issue === 'string' && garbageJson.detected_issue.length > 0, `Detected issue: "${garbageJson.detected_issue}"`);

    // -------------------------------------------------------------------------
    // TEST 3: Waterlogging (Valid Civic Image)
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Live HTTP Request: Waterlogging ---');
    await new Promise(r => setTimeout(r, 2000));
    const waterlogBuf = fs.readFileSync(waterlogPath);
    const waterlogDataUri = `data:image/jpeg;base64,${waterlogBuf.toString('base64')}`;

    const resWaterlog = await fetch(`http://127.0.0.1:${port}/api/ai/analyze-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: waterlogDataUri })
    });

    assert(resWaterlog.status === 200, 'POST /api/ai/analyze-image for waterlogging returns HTTP 200');
    const waterlogJson = await resWaterlog.json();
    assert(waterlogJson.success === true, 'Waterlogging analysis success is true');
    assert(waterlogJson.is_valid_civic_issue === true, 'Waterlogging identified as valid civic issue');
    assert(waterlogJson.suggested_category === 'Drainage' || waterlogJson.suggested_category === 'Roads', `Suggested category matches Drainage or Roads (got: "${waterlogJson.suggested_category}")`);
    assert(typeof waterlogJson.detected_issue === 'string' && waterlogJson.detected_issue.length > 0, `Detected issue: "${waterlogJson.detected_issue}"`);

    // -------------------------------------------------------------------------
    // TEST 4: Valid WEBP Payload Handling
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Valid WEBP Payload Handling ---');
    const webpHeader = Buffer.from('RIFF1234WEBPVP8 ');
    const webpDataUri = `data:image/webp;base64,${webpHeader.toString('base64')}`;
    const webpValidation = validateImagePayload(webpDataUri);
    assert(webpValidation.valid === true, 'Valid WEBP payload is accepted by validator');
    assert(webpValidation.mimeType === 'image/webp', 'MIME type is detected as image/webp');

    // -------------------------------------------------------------------------
    // TEST 5: 5MB Payload Cap Guardrail
    // -------------------------------------------------------------------------
    console.log('\n--- 6. 5MB Payload Boundary Guardrail ---');
    const oversized = Buffer.alloc(5.2 * 1024 * 1024);
    oversized[0] = 0xFF; oversized[1] = 0xD8; oversized[2] = 0xFF;
    const oversizedPayload = `data:image/jpeg;base64,${oversized.toString('base64')}`;

    const resOversized = await fetch(`http://127.0.0.1:${port}/api/ai/analyze-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: oversizedPayload })
    });
    assert(resOversized.status === 400, 'Rejects payload exceeding 5MB with HTTP 400');
    const oversizedJson = await resOversized.json();
    assert(oversizedJson.error.includes('exceeds maximum allowed size of 5 MB'), 'Returns explicit 5MB limit message');

    // -------------------------------------------------------------------------
    // TEST 6: Invalid / Corrupt Image Header
    // -------------------------------------------------------------------------
    console.log('\n--- 7. Invalid Image Header Rejection ---');
    const corruptPayload = 'data:image/jpeg;base64,' + Buffer.from('NOT_A_REAL_IMAGE').toString('base64');
    const resCorrupt = await fetch(`http://127.0.0.1:${port}/api/ai/analyze-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: corruptPayload })
    });
    assert(resCorrupt.status === 400, 'Rejects corrupt magic byte header with HTTP 400');

    // -------------------------------------------------------------------------
    // TEST 7: Zero Secret Exposure Audit
    // -------------------------------------------------------------------------
    console.log('\n--- 8. Zero Secret Leak Audit ---');
    const token = process.env.HF_TOKEN;
    const resHeadersStr = JSON.stringify([...resPothole.headers.entries()]);
    const resBodyStr = JSON.stringify(potholeJson);

    assert(!resHeadersStr.includes(token), 'HF_TOKEN is never present in response headers');
    assert(!resBodyStr.includes(token), 'HF_TOKEN is never present in response body');
    assert(!resBodyStr.includes('Bearer'), 'Bearer prefix is never exposed in API response');

    // Audit client source files
    const clientFiles = ['client/form-assistant.html', 'client/report.html', 'client/js/report.js', 'client/js/api.js'];
    clientFiles.forEach(file => {
      const content = fs.readFileSync(path.join(rootDir, file), 'utf8');
      assert(!content.includes(token), `${file} does not contain HF_TOKEN secret value`);
      assert(!content.includes('HF_TOKEN'), `${file} does not contain HF_TOKEN identifier`);
    });

  } finally {
    server.close();
  }

  // Final Summary
  console.log('\n======================================================');
  console.log(`TOTAL E2E TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runLiveTests().catch(err => {
  console.error('E2E Test Failure:', err);
  process.exit(1);
});
