/**
 * emergencyDeduplicator.js
 * 
 * High-precision deduplication engine for hybrid emergency services.
 * Merges authoritative government/private registries with live OpenStreetMap discoveries.
 * 
 * Rules:
 * 1. Proximity (< 250 meters) + name token similarity (>= 0.40) => DUPLICATE.
 * 2. Exact phone number match (ignoring STD code/spaces) => DUPLICATE.
 * 3. Authoritative records take precedence over community discoveries.
 * 4. Merging enriches authoritative records with any additional live contact info or tags.
 */

import { calculateHaversineDistanceKm } from './emergencyService.js';

/**
 * Tokenize and normalize facility name for similarity comparison
 */
function extractTokens(name) {
  if (!name) return new Set();
  const clean = name
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\b(the|and|govt|government|hospital|hospitals|clinic|centre|center|station|salai|road|street|nagar|dr|branch|care|multispeciality|multi|speciality|super)\b/g, ' ')
    .trim();

  return new Set(clean.split(/\s+/).filter(t => t.length > 2));
}

/**
 * Calculate Jaccard similarity between two token sets
 */
function calculateTokenOverlap(setA, setB) {
  if (setA.size === 0 || setB.size === 0) return 0;
  let matches = 0;
  for (const t of setA) {
    if (setB.has(t)) matches++;
  }
  return matches / Math.min(setA.size, setB.size);
}

/**
 * Clean phone string down to last 7-10 digits for matching
 */
function cleanPhoneNumber(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  return digits.length >= 7 ? digits.slice(-7) : null;
}

/**
 * Check if two services represent the same real-world facility
 */
export function areDuplicates(s1, s2) {
  // Service category check (allow hospital vs clinic matching for deduplication)
  const isTypeCompatible =
    s1.service_type === s2.service_type ||
    (s1.service_type === 'hospital' && s2.service_type === 'clinic') ||
    (s1.service_type === 'clinic' && s2.service_type === 'hospital');

  if (!isTypeCompatible) return false;

  // 1. Phone match check
  const p1 = cleanPhoneNumber(s1.phone);
  const p2 = cleanPhoneNumber(s2.phone);
  if (p1 && p2 && p1 === p2) {
    return true;
  }

  // 2. Spatial distance check (< 250 meters)
  const distKm = calculateHaversineDistanceKm(s1.latitude, s1.longitude, s2.latitude, s2.longitude);
  if (distKm > 0.25) {
    return false;
  }

  // 3. Name token overlap
  const tokens1 = extractTokens(s1.name);
  const tokens2 = extractTokens(s2.name);
  const similarity = calculateTokenOverlap(tokens1, tokens2);

  return similarity >= 0.40;
}

/**
 * Merge and deduplicate an authoritative list and an OSM discovered list
 * 
 * @param {Array} authoritativeServices High-confidence base records
 * @param {Array} osmServices Live discovered records
 * @returns {Array} Deduplicated unified emergency services list
 */
export function deduplicateEmergencyServices(authoritativeServices = [], osmServices = []) {
  // Start with authoritative services as base
  const unified = [...authoritativeServices];

  for (const osmItem of osmServices) {
    let duplicateIndex = -1;

    for (let i = 0; i < unified.length; i++) {
      if (areDuplicates(unified[i], osmItem)) {
        duplicateIndex = i;
        break;
      }
    }

    if (duplicateIndex !== -1) {
      // Enrich existing authoritative record if OSM has extra phone/data
      const existing = unified[duplicateIndex];
      if (!existing.phone && osmItem.phone) {
        existing.phone = osmItem.phone;
      }
      if (!existing.emergency_phone && osmItem.emergency_phone) {
        existing.emergency_phone = osmItem.emergency_phone;
      }
      // If authoritative didn't specify emergency availability but OSM verified it
      if (!existing.emergency_available && osmItem.emergency_available) {
        existing.emergency_available = true;
      }
    } else {
      // Unique real-world service discovered via OSM
      unified.push(osmItem);
    }
  }

  return unified;
}

export default {
  areDuplicates,
  deduplicateEmergencyServices
};
