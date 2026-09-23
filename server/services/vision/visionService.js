/**
 * CrowdCity AI — Civic Vision Analysis Service
 * High-level service facade for municipal image hazard analysis.
 * 
 * Enforces:
 * - Strict MIME & magic byte validation (JPEG, PNG, WEBP)
 * - Payload size caps (5MB max decoded size)
 * - Data minimization & privacy (ephemeral in-memory only, no pre-submission storage)
 * - Standardized structured output schema
 * - Non-blocking graceful fallback without fake static AI
 */

import { getVisionProvider } from './visionProviderFactory.js';
import logger from '../../config/logger.js';

// Max allowed decoded image payload size: 5MB
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// Recognized CrowdCity AI municipal categories
export const CROWDCITY_CATEGORIES = [
  { code: 'roads', name: 'Roads', aliases: ['road', 'roads', 'pothole', 'footpath', 'sidewalk', 'pavement', 'asphalt'] },
  { code: 'streetlights', name: 'Streetlights', aliases: ['streetlight', 'streetlights', 'street light', 'lamp', 'pole', 'lighting'] },
  { code: 'water_supply', name: 'Water Supply', aliases: ['water', 'water supply', 'water pipe', 'pipe leak', 'drinking water', 'public tap'] },
  { code: 'drainage', name: 'Drainage', aliases: ['drain', 'drainage', 'sewer', 'sewage', 'gutter', 'stormwater', 'manhole'] },
  { code: 'garbage', name: 'Garbage', aliases: ['garbage', 'waste', 'trash', 'debris', 'dumping', 'rubbish', 'litter', 'dumpster', 'bin'] },
  { code: 'traffic', name: 'Traffic', aliases: ['traffic', 'signal', 'traffic light', 'road sign', 'zebra crossing', 'parking'] },
  { code: 'public_property', name: 'Public Property', aliases: ['public property', 'bus stop', 'bus shelter', 'bench', 'fence', 'government building'] },
  { code: 'parks', name: 'Parks', aliases: ['park', 'parks', 'garden', 'playground', 'tree', 'fallen tree', 'branch'] },
  { code: 'sanitation', name: 'Sanitation', aliases: ['sanitation', 'toilet', 'urinal', 'public toilet', 'hygiene'] },
  { code: 'safety_hazard', name: 'Safety Hazard', aliases: ['safety hazard', 'live wire', 'open wire', 'sinkhole', 'collapse', 'danger'] },
  { code: 'environment', name: 'Environment', aliases: ['environment', 'pollution', 'lake', 'air', 'smoke', 'wetland'] },
  { code: 'other', name: 'Other', aliases: [] }
];

/**
 * Validates image payload string and format.
 * 
 * @param {string} payload 
 * @returns {{ valid: boolean, mimeType?: string, cleanBase64?: string, error?: string, buffer?: Buffer }}
 */
export function validateImagePayload(payload) {
  if (!payload || typeof payload !== 'string' || !payload.trim()) {
    return { valid: false, error: 'Image data is required.' };
  }

  const trimmed = payload.trim();
  let mimeType = 'image/jpeg';
  let cleanBase64 = trimmed;

  const dataUriMatch = trimmed.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.*)$/s);
  if (dataUriMatch) {
    mimeType = dataUriMatch[1].toLowerCase();
    cleanBase64 = dataUriMatch[2].replace(/\s/g, '');
  } else {
    // If raw base64, detect from first few bytes
    cleanBase64 = trimmed.replace(/\s/g, '');
  }

  // Allowed MIME types
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (dataUriMatch && !allowedMimes.includes(mimeType)) {
    return {
      valid: false,
      error: `Unsupported image format (${mimeType}). Supported formats: JPEG, PNG, WEBP.`
    };
  }

  // Decode buffer
  let buffer;
  try {
    buffer = Buffer.from(cleanBase64, 'base64');
  } catch (err) {
    return { valid: false, error: 'Malformed base64 image data.' };
  }

  if (!buffer || buffer.length === 0) {
    return { valid: false, error: 'Empty image buffer received.' };
  }

  // Check payload size
  if (buffer.length > MAX_IMAGE_BYTES) {
    const sizeMb = (buffer.length / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `Image size (${sizeMb} MB) exceeds maximum allowed size of 5 MB.`
    };
  }

  // Magic bytes inspection
  const isJpeg = buffer.length > 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
  const isPng = buffer.length > 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
  const isWebp = buffer.length > 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP';

  if (!isJpeg && !isPng && !isWebp) {
    return {
      valid: false,
      error: 'Corrupt or unsupported image file header. Must be a valid JPEG, PNG, or WEBP.'
    };
  }

  const canonicalMime = isJpeg ? 'image/jpeg' : (isPng ? 'image/png' : 'image/webp');

  return {
    valid: true,
    mimeType: canonicalMime,
    cleanBase64,
    buffer
  };
}

/**
 * Maps raw model category to standard CrowdCity category.
 * 
 * @param {string} rawCategory 
 * @returns {{ code: string, name: string }}
 */
export function normalizeCategory(rawCategory = '') {
  if (!rawCategory || typeof rawCategory !== 'string') {
    return { code: 'other', name: 'Other' };
  }

  const target = rawCategory.toLowerCase().trim();

  // Direct exact match by code or name
  for (const cat of CROWDCITY_CATEGORIES) {
    if (cat.code.toLowerCase() === target || cat.name.toLowerCase() === target) {
      return { code: cat.code, name: cat.name };
    }
  }

  // Match via aliases
  for (const cat of CROWDCITY_CATEGORIES) {
    if (cat.aliases.some(alias => target.includes(alias))) {
      return { code: cat.code, name: cat.name };
    }
  }

  return { code: 'other', name: 'Other' };
}

/**
 * Analyzes civic complaint photo and generates structured recommendations.
 * 
 * @param {string} imageBase64 Raw or data-URI base64 string
 * @param {Object} [options] Optional configuration overrides
 * @returns {Promise<Object>} Standardized structured result
 */
export async function analyzeCivicImage(imageBase64, options = {}) {
  // 1. Validation & Data Integrity Guardrails
  const validation = validateImagePayload(imageBase64);
  if (!validation.valid) {
    return {
      success: false,
      error: validation.error,
      statusCode: 400,
      canProceedManually: true
    };
  }

  // 2. Resolve Vision Provider
  let provider;
  try {
    provider = getVisionProvider(options.providerType, options.providerConfig);
  } catch (err) {
    logger.error('Failed to initialize vision provider: %O', err);
    return {
      success: false,
      error: 'Image analysis is temporarily unavailable. You can continue submitting your complaint manually.',
      canProceedManually: true
    };
  }

  // 3. Multimodal Inference
  try {
    const rawResult = await provider.analyze({
      imageBase64: validation.cleanBase64,
      mimeType: validation.mimeType
    });

    if (!rawResult || typeof rawResult !== 'object') {
      throw new Error('Invalid response structure from vision model');
    }

    // 4. Handle Non-Civic / Invalid Image
    if (rawResult.is_valid_civic_issue === false) {
      return {
        success: true,
        is_valid_civic_issue: false,
        detected_issue: rawResult.detected_issue || 'Non-Civic Photo Detected',
        description: rawResult.description || 'The uploaded photo does not appear to show a municipal infrastructure issue. Please upload or take a clear photo of the civic hazard (pothole, streetlight, garbage, etc.).',
        evidence_observed: Array.isArray(rawResult.evidence_observed) ? rawResult.evidence_observed : [],
        needs_user_confirmation: true
      };
    }

    // 5. Structure & Normalize Valid Civic Hazard
    const normalizedCat = normalizeCategory(rawResult.suggested_category);
    const evidenceList = Array.isArray(rawResult.evidence_observed) && rawResult.evidence_observed.length > 0
      ? rawResult.evidence_observed.filter(e => typeof e === 'string' && e.trim().length > 0)
      : ['Visual infrastructure damage observed'];

    return {
      success: true,
      is_valid_civic_issue: true,
      detected_issue: (rawResult.detected_issue || 'Civic Infrastructure Hazard').trim(),
      suggested_category: normalizedCat.name,
      category_code: normalizedCat.code,
      description: (rawResult.description || 'Visual analysis identified an infrastructure hazard requiring municipal attention.').trim(),
      evidence_observed: evidenceList,
      priority_hint: rawResult.priority_hint || 'Medium',
      confidence: typeof rawResult.confidence === 'number' ? Math.min(Math.max(rawResult.confidence, 0), 1) : 0.90,
      needs_user_confirmation: true
    };

  } catch (err) {
    logger.warn('Vision analysis inference failed: %s', err.message);

    // Non-blocking graceful fallback
    return {
      success: false,
      error: 'Image analysis is temporarily unavailable. You can continue submitting your complaint manually.',
      canProceedManually: true
    };
  }
}

export default {
  analyzeCivicImage,
  validateImagePayload,
  normalizeCategory,
  CROWDCITY_CATEGORIES
};
