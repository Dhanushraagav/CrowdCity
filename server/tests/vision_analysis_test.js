/**
 * CrowdCity AI — Civic Vision Analysis Test Suite
 * 
 * Verifies:
 * 1. Image payload validation & MIME type enforcement (JPEG, PNG, WEBP)
 * 2. Magic byte verification and corrupt payload rejection
 * 3. Payload size limit protection (5MB cap)
 * 4. Standardized structured output schema (detected_issue, suggested_category, evidence_observed, needs_user_confirmation)
 * 5. CrowdCity category mapping and code normalization
 * 6. Non-civic image handling (selfie/document/food -> is_valid_civic_issue: false)
 * 7. Graceful degradation and non-blocking fallback on provider timeout/offline
 * 8. Zero fake static AI fallback assertion
 * 9. Provider factory & Qwen provider contract
 */

import {
  analyzeCivicImage,
  validateImagePayload,
  normalizeCategory,
  CROWDCITY_CATEGORIES
} from '../services/vision/visionService.js';
import { getVisionProvider, resetVisionProviderCache } from '../services/vision/visionProviderFactory.js';
import { MockVisionProvider } from '../services/vision/providers/mockVisionProvider.js';
import { QwenVisionProvider } from '../services/vision/providers/qwenVisionProvider.js';

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

// Helper to create small valid image buffers
function createMinimalJpegBase64() {
  // 3-byte JPEG magic + some padding
  const buf = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01]);
  return `data:image/jpeg;base64,${buf.toString('base64')}`;
}

function createMinimalPngBase64() {
  // 8-byte PNG magic header + padding
  const buf = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D]);
  return `data:image/png;base64,${buf.toString('base64')}`;
}

function createMinimalWebpBase64() {
  // RIFF....WEBP header
  const header = Buffer.from('RIFF1234WEBPVP8 ');
  return `data:image/webp;base64,${header.toString('base64')}`;
}

async function runTests() {
  console.log('\n======================================================');
  console.log('   CROWDCITY AI — CIVIC VISION ANALYSIS TEST SUITE');
  console.log('======================================================\n');

  // TEST SUITE 1: Image Payload & MIME Validation
  console.log('--- Suite 1: Image Payload & MIME Validation ---');
  {
    // Valid JPEG
    const jpegRes = validateImagePayload(createMinimalJpegBase64());
    assert(jpegRes.valid === true, 'Accepts valid JPEG image payload');
    assert(jpegRes.mimeType === 'image/jpeg', 'Correctly detects image/jpeg MIME type');

    // Valid PNG
    const pngRes = validateImagePayload(createMinimalPngBase64());
    assert(pngRes.valid === true, 'Accepts valid PNG image payload');
    assert(pngRes.mimeType === 'image/png', 'Correctly detects image/png MIME type');

    // Valid WEBP
    const webpRes = validateImagePayload(createMinimalWebpBase64());
    assert(webpRes.valid === true, 'Accepts valid WEBP image payload');
    assert(webpRes.mimeType === 'image/webp', 'Correctly detects image/webp MIME type');

    // Unsupported MIME (PDF)
    const pdfPayload = 'data:application/pdf;base64,JVBERi0xLjQK';
    const pdfRes = validateImagePayload(pdfPayload);
    assert(pdfRes.valid === false, 'Rejects non-image PDF MIME type');
    assert(pdfRes.error.includes('Unsupported image format'), 'Returns clear unsupported format error message');

    // Unsupported MIME (GIF)
    const gifPayload = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    const gifRes = validateImagePayload(gifPayload);
    assert(gifRes.valid === false, 'Rejects unsupported GIF image format');

    // Missing / Empty payload
    const emptyRes = validateImagePayload('');
    assert(emptyRes.valid === false && emptyRes.error.includes('required'), 'Rejects empty payload string');

    const nullRes = validateImagePayload(null);
    assert(nullRes.valid === false, 'Rejects null payload');
  }

  // TEST SUITE 2: Magic Byte Integrity & Size Guardrails
  console.log('\n--- Suite 2: Magic Bytes & Size Guardrails ---');
  {
    // Fake image header (claims to be jpeg but has text content)
    const fakeTextPayload = 'data:image/jpeg;base64,' + Buffer.from('Hello this is not an image').toString('base64');
    const fakeRes = validateImagePayload(fakeTextPayload);
    assert(fakeRes.valid === false, 'Rejects payload with invalid magic bytes');
    assert(fakeRes.error.includes('Corrupt or unsupported'), 'Returns corruption error on header mismatch');

    // Oversized payload (> 5MB)
    const largeBuffer = Buffer.alloc(5.5 * 1024 * 1024);
    // Fake JPEG header on oversized buffer
    largeBuffer[0] = 0xFF; largeBuffer[1] = 0xD8; largeBuffer[2] = 0xFF;
    const oversizedPayload = `data:image/jpeg;base64,${largeBuffer.toString('base64')}`;
    const oversizedRes = validateImagePayload(oversizedPayload);
    assert(oversizedRes.valid === false, 'Rejects payload exceeding 5MB cap');
    assert(oversizedRes.error.includes('exceeds maximum allowed size'), 'Provides explicit MB limit in error');
  }

  // TEST SUITE 3: Category Normalization
  console.log('\n--- Suite 3: Category Normalization ---');
  {
    assert(normalizeCategory('Roads').code === 'roads', 'Normalizes "Roads" -> "roads"');
    assert(normalizeCategory('pothole hazard').code === 'roads', 'Normalizes pothole alias -> "roads"');
    assert(normalizeCategory('broken streetlight').code === 'streetlights', 'Normalizes streetlight alias -> "streetlights"');
    assert(normalizeCategory('water pipe burst').code === 'water_supply', 'Normalizes water leak alias -> "water_supply"');
    assert(normalizeCategory('clogged sewage drain').code === 'drainage', 'Normalizes drainage alias -> "drainage"');
    assert(normalizeCategory('overflowing garbage dumpster').code === 'garbage', 'Normalizes garbage alias -> "garbage"');
    assert(normalizeCategory('broken traffic signal').code === 'traffic', 'Normalizes traffic signal alias -> "traffic"');
    assert(normalizeCategory('unknown civic object').code === 'other', 'Falls back to "other" for unknown categories');
  }

  // TEST SUITE 4: Structured Vision Output Schema
  console.log('\n--- Suite 4: Structured Vision Output Schema ---');
  {
    resetVisionProviderCache();
    const mockProvider = new MockVisionProvider();
    const result = await analyzeCivicImage(createMinimalJpegBase64(), {
      providerType: 'mock',
      providerConfig: { customResponse: null }
    });

    assert(result.success === true, 'Analysis returns success: true');
    assert(result.is_valid_civic_issue === true, 'Identifies issue as valid civic hazard');
    assert(typeof result.detected_issue === 'string' && result.detected_issue.length > 0, 'Includes detected_issue string');
    assert(result.suggested_category === 'Roads', 'Matches suggested_category: "Roads"');
    assert(result.category_code === 'roads', 'Includes canonical category_code: "roads"');
    assert(Array.isArray(result.evidence_observed) && result.evidence_observed.length >= 2, 'Includes visual evidence observed array');
    assert(result.needs_user_confirmation === true, 'Enforces needs_user_confirmation: true (human-in-the-loop)');
    assert(typeof result.confidence === 'number' && result.confidence >= 0 && result.confidence <= 1, 'Confidence score is normalized between 0.0 and 1.0');
    assert(typeof result.description === 'string' && result.description.length > 0, 'Includes objective visual description');
  }

  // TEST SUITE 5: Non-Civic Image Rejection
  console.log('\n--- Suite 5: Non-Civic Image Handling ---');
  {
    const nonCivicProvider = new MockVisionProvider({
      customResponse: {
        is_valid_civic_issue: false,
        detected_issue: 'Human Selfie / Portrait',
        description: 'Photo contains a person selfie with no visible public municipal infrastructure.',
        evidence_observed: []
      }
    });

    const result = await analyzeCivicImage(createMinimalJpegBase64(), {
      providerType: 'mock',
      providerConfig: { customResponse: nonCivicProvider.customResponse }
    });

    assert(result.success === true, 'Returns success: true indicating clean processing');
    assert(result.is_valid_civic_issue === false, 'Flags photo as is_valid_civic_issue: false');
    assert(result.detected_issue.includes('Selfie'), 'Identifies non-civic subject');
    assert(result.description.includes('municipal infrastructure'), 'Provides guidance on valid civic hazard photos');
  }

  // TEST SUITE 6: Offline / Error Graceful Degradation (No Fake AI)
  console.log('\n--- Suite 6: Offline / Error Graceful Degradation ---');
  {
    // Simulate HTTP 503 model offline
    const offlineResult = await analyzeCivicImage(createMinimalJpegBase64(), {
      providerType: 'mock',
      providerConfig: { shouldFail: true, failureType: 'HTTP_503' }
    });

    assert(offlineResult.success === false, 'Returns success: false when provider is offline');
    assert(offlineResult.canProceedManually === true, 'Confirms citizen can proceed manually without blocking');
    assert(offlineResult.error.includes('temporarily unavailable'), 'Displays non-blocking message');
    assert(!offlineResult.detected_issue, 'Does NOT return fake static hazard title ("No Fake AI")');
    assert(!offlineResult.suggested_category, 'Does NOT return fake static category ("No Fake AI")');

    // Simulate timeout
    const timeoutResult = await analyzeCivicImage(createMinimalJpegBase64(), {
      providerType: 'mock',
      providerConfig: { shouldFail: true, failureType: 'TIMEOUT' }
    });
    assert(timeoutResult.success === false, 'Handles timeout cleanly');
    assert(timeoutResult.canProceedManually === true, 'Permits manual submission on timeout');
  }

  // TEST SUITE 7: Vision Provider Factory & Qwen Configuration
  console.log('\n--- Suite 7: Vision Provider Factory & Qwen Provider ---');
  {
    resetVisionProviderCache();
    const hfProvider = getVisionProvider('huggingface');
    assert(hfProvider instanceof QwenVisionProvider, 'Factory instantiates QwenVisionProvider for huggingface');
    assert(hfProvider.model === 'Qwen/Qwen3-VL-2B-Instruct', 'Uses Qwen/Qwen3-VL-2B-Instruct model by default');
    assert(hfProvider.endpointUrl.includes('router.huggingface.co'), 'Points to Hugging Face Router endpoint');

    resetVisionProviderCache();
    const localProvider = getVisionProvider('local', { endpointUrl: 'http://localhost:11434/v1/chat/completions' });
    assert(localProvider.endpointUrl === 'http://localhost:11434/v1/chat/completions', 'Factory supports custom local endpoint');

    resetVisionProviderCache();
    const mockInst = getVisionProvider('mock');
    assert(mockInst instanceof MockVisionProvider, 'Factory instantiates MockVisionProvider for mock type');
  }

  // SUMMARY
  console.log('\n======================================================');
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Unhandled test suite error:', err);
  process.exit(1);
});
