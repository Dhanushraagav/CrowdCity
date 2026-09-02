/**
 * CrowdCity AI - Multi-Signal Duplicate Complaint Detection Engine
 * 
 * Determines duplicate probability using weighted signals:
 * 1. Geographic proximity (category-adaptive radius, strongest signal: 50%)
 * 2. Issue / category match (strong supporting signal: 25%)
 * 3. Description & title text similarity (supporting signal: 25%)
 * 4. Active/open lifecycle status check (pending, assigned, in_progress only)
 */

import { supabaseAdmin, supabase } from '../config/supabase.js';
import logger from '../config/logger.js';

// Earth radius in meters
const EARTH_RADIUS_METERS = 6371000;

// Category-specific search radius in meters
const CATEGORY_RADII = {
  roads: 120,          // Potholes, road damage are highly localized
  streetlights: 100,   // Streetlights typically spaced ~30-50m
  water_supply: 250,   // Pipeline breaks or shortages affect wider area
  drainage: 150,       // Open drains/overflows affect neighborhood
  garbage: 150,        // Garbage dumps affect street/corner
  traffic: 300,        // Bottlenecks & signals impact entire intersection
  public_property: 150,
  parks: 200,
  sanitation: 150,
  safety_hazard: 200,
  environment: 300,
  other: 100
};

// Common civic stop words
const STOP_WORDS = new Set([
  'the', 'is', 'at', 'in', 'near', 'on', 'of', 'a', 'an', 'and', 'or', 'for', 'to',
  'this', 'that', 'there', 'here', 'please', 'help', 'fix', 'very', 'bad', 'huge',
  'road', 'street', 'area', 'nagar', 'colony', 'city', 'cross', 'main', 'tamil', 'nadu'
]);

/**
 * Calculates Haversine distance between two latitude/longitude points in meters.
 */
export function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

/**
 * Computes word token similarity between two civic complaint texts.
 * Uses civic stemming and Dice coefficient for robust phrase matching.
 */
export function computeTextSimilarity(textA, textB) {
  if (!textA || !textB) return 0;

  const stem = (word) => {
    if (word.length > 5 && word.endsWith('ing')) return word.slice(0, -3);
    if (word.length > 5 && word.endsWith('ed')) return word.slice(0, -2);
    if (word.length > 4 && word.endsWith('es')) return word.slice(0, -2);
    if (word.length > 3 && word.endsWith('s')) return word.slice(0, -1);
    return word;
  };

  const tokenize = (text) => {
    return new Set(
      text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .map((w) => stem(w.trim()))
        .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
    );
  };

  const tokensA = tokenize(textA);
  const tokensB = tokenize(textB);

  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersection = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) {
      intersection++;
    }
  }

  // Dice coefficient: 2 * |A ∩ B| / (|A| + |B|)
  return (2 * intersection) / (tokensA.size + tokensB.size);
}

/**
 * Computes category compatibility score.
 */
function computeCategoryScore(catA, catB) {
  if (!catA || !catB) return 0;
  if (catA.toLowerCase() === catB.toLowerCase()) return 1.0;

  // Related category pairs
  const relatedGroups = [
    ['roads', 'traffic'],
    ['water_supply', 'drainage'],
    ['garbage', 'sanitation', 'environment'],
    ['safety_hazard', 'streetlights']
  ];

  for (const group of relatedGroups) {
    if (group.includes(catA.toLowerCase()) && group.includes(catB.toLowerCase())) {
      return 0.5;
    }
  }

  return 0.0;
}

/**
 * Searches the database for active master complaint duplicate candidates.
 * 
 * @param {Object} params
 * @param {number} params.latitude
 * @param {number} params.longitude
 * @param {string} params.category
 * @param {string} params.title
 * @param {string} params.description
 * @param {string} [params.excludeIssueId]
 * @returns {Promise<{ is_duplicate: boolean, score: number, candidate: Object|null }>}
 */
export async function findDuplicateCandidate({
  latitude,
  longitude,
  category,
  title,
  description,
  excludeIssueId = null
}) {
  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);

  if (isNaN(lat) || isNaN(lng)) {
    return { is_duplicate: false, score: 0, candidate: null };
  }

  const client = supabaseAdmin || supabase;
  const maxRadiusMeters = CATEGORY_RADII[category] || 120;

  // Approximate 1 degree latitude ~ 111,000 meters
  // 1 degree longitude ~ 111,000 * cos(lat) meters
  const latDelta = (maxRadiusMeters * 1.5) / 111000;
  const lngDelta = (maxRadiusMeters * 1.5) / (111000 * Math.cos((lat * Math.PI) / 180));

  const minLat = lat - latDelta;
  const maxLat = lat + latDelta;
  const minLng = lng - lngDelta;
  const maxLng = lng + lngDelta;

  try {
    // 1. Perform high-performance indexed spatial & status bounding box filter
    let query = client
      .from('issues')
      .select('id, complaint_id, title, description, category, status, latitude, longitude, address, image_url, citizen_count, created_at, reporter_id')
      .in('status', ['pending', 'assigned', 'in_progress'])
      .gte('latitude', minLat)
      .lte('latitude', maxLat)
      .gte('longitude', minLng)
      .lte('longitude', maxLng);

    if (excludeIssueId) {
      query = query.neq('id', excludeIssueId);
    }

    const { data: candidates, error } = await query.limit(20);

    if (error || !candidates || candidates.length === 0) {
      return { is_duplicate: false, score: 0, candidate: null };
    }

    // 2. Score candidates using weighted multi-signal logic
    let bestCandidate = null;
    let bestScore = 0;
    const inputCombinedText = `${title || ''} ${description || ''}`;

    for (const item of candidates) {
      // 2a. Calculate exact Haversine distance
      const distance = calculateHaversineDistance(lat, lng, item.latitude, item.longitude);
      
      // If outside max radius, skip
      if (distance > maxRadiusMeters) {
        continue;
      }

      // Location score (1.0 at 0m, 0.0 at maxRadius)
      const locationScore = Math.max(0, 1.0 - distance / maxRadiusMeters);

      // 2b. Category match score
      const categoryScore = computeCategoryScore(category, item.category);

      // If categories are completely unrelated, do not merge regardless of location
      if (categoryScore === 0) {
        continue;
      }

      // 2c. Text similarity score
      const candidateCombinedText = `${item.title || ''} ${item.description || ''}`;
      const textScore = computeTextSimilarity(inputCombinedText, candidateCombinedText);

      // Weighted total score: Location (50%) + Category (25%) + Text (25%)
      const totalScore = (locationScore * 0.50) + (categoryScore * 0.25) + (textScore * 0.25);

      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestCandidate = {
          ...item,
          distance_meters: Math.round(distance),
          match_score: Math.round(totalScore * 100)
        };
      }
    }

    // Strong threshold: >= 0.65
    const isDuplicate = bestScore >= 0.65 && bestCandidate !== null;

    return {
      is_duplicate: isDuplicate,
      score: bestScore,
      candidate: bestCandidate
    };
  } catch (err) {
    logger.error('Error during findDuplicateCandidate:', err);
    return { is_duplicate: false, score: 0, candidate: null };
  }
}
