import { supabaseAdmin, supabase } from '../config/supabase.js';
import logger from '../config/logger.js';
import { normalizeCategory, areCategoriesCompatible, getSearchRadius } from './categoryNormalizationService.js';
import { computeImageSimilarity, computeImageHash } from './imageHashService.js';
import { getAllTransportationRecords } from '../controllers/transportationController.js';

// In-memory cache for remote image hashes to avoid re-fetching
const imageHashCache = new Map();

export const DUPLICATE_CONFIG = {
  CONFIRMED_THRESHOLD: 0.78,
  POSSIBLE_THRESHOLD: 0.55,
  MAX_CANDIDATES: 25,
  TEMPORAL_WINDOW_DAYS: 90,
  WEIGHTS: {
    location: 0.40,
    category: 0.20,
    semantic: 0.25,
    image: 0.15
  },
  SPATIAL: {
    STRONG_RANGE_METERS: 15,
    MEDIUM_RANGE_METERS: 30
  }
};

const STOP_WORDS = new Set(['the', 'is', 'at', 'which', 'on', 'in', 'a', 'an', 'and', 'or', 'for', 'to', 'of', 'with', 'it', 'this', 'that']);

/**
 * Calculates the Haversine distance between two coordinates in meters.
 * @param {number} lat1 
 * @param {number} lon1 
 * @param {number} lat2 
 * @param {number} lon2 
 * @returns {number} Distance in meters
 */
export function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const toRadians = (deg) => deg * (Math.PI / 180);
  
  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const deltaPhi = toRadians(lat2 - lat1);
  const deltaLambda = toRadians(lon2 - lon1);

  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Computes Dice coefficient based text similarity.
 * @param {string} textA 
 * @param {string} textB 
 * @returns {number} Similarity score between 0 and 1
 */
export function computeTextSimilarity(textA, textB) {
  if (!textA && !textB) return 1.0;
  if (!textA || !textB) return 0.0;

  const normalize = (str) => {
    return str.toLowerCase().replace(/[^\w\s]/g, '');
  };

  const getTokens = (str) => {
    // Basic stop words removal and tokenization
    const tokens = normalize(str).split(/\s+/).filter(t => t.length > 0 && !STOP_WORDS.has(t));
    return new Set(tokens);
  };

  const setA = getTokens(textA);
  const setB = getTokens(textB);

  if (setA.size === 0 && setB.size === 0) return 1.0;

  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) {
      intersection++;
    }
  }

  // Dice coefficient
  return (2.0 * intersection) / (setA.size + setB.size);
}

/**
 * Helper function to generate a bounding box
 */
function getBoundingBox(lat, lon, distanceMeters) {
  const latRadian = distanceMeters / 6371000.0;
  const lonRadian = distanceMeters / (6371000.0 * Math.cos(lat * (Math.PI / 180)));

  return {
    minLat: lat - (latRadian * (180 / Math.PI)),
    maxLat: lat + (latRadian * (180 / Math.PI)),
    minLon: lon - (lonRadian * (180 / Math.PI)),
    maxLon: lon + (lonRadian * (180 / Math.PI))
  };
}

/**
 * Primary unified duplicate detection function.
 */
export async function findUnifiedDuplicate({
  latitude,
  longitude,
  category,
  title,
  description,
  imageHash,
  excludeId,
  sourceType = 'civic'
}) {
  try {
    const inputCategoryCode = normalizeCategory(category);
    const searchRadius = getSearchRadius(inputCategoryCode) || 100;
    const bbox = getBoundingBox(latitude, longitude, searchRadius);

    // a. Query Supabase issues
    const client = supabaseAdmin || supabase;
    const { data: civicIssues, error } = await client
      .from('issues')
      .select('id, complaint_id, title, description, category, status, latitude, longitude, address, image_url, citizen_count, created_at, updated_at, reporter_id')
      .gte('latitude', bbox.minLat)
      .lte('latitude', bbox.maxLat)
      .gte('longitude', bbox.minLon)
      .lte('longitude', bbox.maxLon)
      .in('status', ['pending', 'assigned', 'in_progress', 'resolved'])
      .order('created_at', { ascending: false })
      .limit(DUPLICATE_CONFIG.MAX_CANDIDATES);

    if (error) {
      logger.error('Error fetching civic issues for duplicate detection', { error });
      // Proceed without throwing to check transportation records
    }

    // b. Read transportation reports
    const transportationRecords = await getAllTransportationRecords();

    // c. Filter transportation records by bounding box and active status
    const filteredTrans = transportationRecords.filter(record => {
      const lat = parseFloat(record.latitude);
      const lon = parseFloat(record.longitude);
      if (isNaN(lat) || isNaN(lon)) return false;
      const rawStatus = (record.status || 'Submitted').toLowerCase();
      const isActive = rawStatus.includes('submit') || rawStatus.includes('progress') ||
                       rawStatus.includes('assign') || rawStatus.includes('resolved');
      return isActive &&
             lat >= bbox.minLat && lat <= bbox.maxLat &&
             lon >= bbox.minLon && lon <= bbox.maxLon;
    });

    // d. Combine and normalize
    const candidates = [];
    const now = new Date();

    for (const issue of (civicIssues || [])) {
      if (excludeId && issue.id === excludeId) continue;
      
      const createdAtDate = new Date(issue.created_at);
      const daysOld = (now - createdAtDate) / (1000 * 60 * 60 * 24);
      
      // e. Temporal window filter
      if (daysOld > DUPLICATE_CONFIG.TEMPORAL_WINDOW_DAYS) continue;

      candidates.push({
        id: issue.id,
        complaintId: issue.complaint_id || issue.id,
        sourceType: 'civic',
        category: issue.category,
        categoryCode: normalizeCategory(issue.category),
        title: issue.title,
        description: issue.description,
        latitude: parseFloat(issue.latitude),
        longitude: parseFloat(issue.longitude),
        address: issue.address,
        imageUrl: issue.image_url,
        imageHash: issue.image_hash || null,
        createdAt: issue.created_at,
        status: issue.status,
        reporterId: issue.reporter_id,
        citizenCount: issue.citizen_count || 1,
        updatedAt: issue.updated_at
      });
    }

    for (const record of filteredTrans) {
      if (excludeId && record.id === excludeId) continue;

      const createdAtDate = new Date(record.created_at || record.createdAt);
      const daysOld = (now - createdAtDate) / (1000 * 60 * 60 * 24);
      
      if (daysOld > DUPLICATE_CONFIG.TEMPORAL_WINDOW_DAYS) continue;

      // Map status
      let normalizedStatus = 'pending';
      const s = (record.status || '').toLowerCase();
      if (s.includes('progress') || s.includes('assigned')) normalizedStatus = 'in_progress';
      else if (s.includes('resolved') || s.includes('closed')) normalizedStatus = 'resolved';

      candidates.push({
        id: record.id,
        complaintId: record.report_number || record.id,
        sourceType: 'transportation',
        category: record.category || 'Damaged Roads',
        categoryCode: normalizeCategory(record.category || 'Damaged Roads'),
        title: record.title || record.category,
        description: record.description,
        latitude: parseFloat(record.latitude),
        longitude: parseFloat(record.longitude),
        address: record.address || record.road_name || '',
        imageUrl: (record.photo_urls && record.photo_urls[0]) || null,
        imageHash: record.image_hash || null,
        createdAt: record.created_at || record.createdAt,
        status: normalizedStatus,
        reporterId: record.user_id || 'anonymous_citizen',
        citizenCount: 1,
        updatedAt: record.updated_at || record.created_at
      });
    }

    let bestCandidate = null;
    let highestTotalScore = 0;
    let bestSignals = null;
    let bestDistance = Infinity;
    
    // f. Scoring
    for (const candidate of candidates) {
      let weightMultiplier = 1.0;
      if (candidate.status === 'resolved') {
        const resolvedDate = new Date(candidate.updatedAt || candidate.createdAt);
        const resolvedDays = (now - resolvedDate) / (1000 * 60 * 60 * 24);
        if (resolvedDays > 14) continue; // Hard filter resolved > 14 days
        weightMultiplier = 0.5; // Reduced weight for recently resolved
      }

      // Location Score
      const distance = calculateHaversineDistance(latitude, longitude, candidate.latitude, candidate.longitude);
      const locationScore = Math.max(0, 1.0 - (distance / searchRadius));

      // Category Score
      const categoryScore = areCategoriesCompatible(inputCategoryCode, candidate.categoryCode);
      if (categoryScore === 0) continue; // Hard filter

      // Semantic Score
      const textA = `${title || ''} ${description || ''}`;
      const textB = `${candidate.title || ''} ${candidate.description || ''}`;
      const semanticScore = computeTextSimilarity(textA, textB);

      // Image Score
      let imageScore = 0;
      let candHash = candidate.imageHash;
      if (!candHash && candidate.imageUrl && imageHash) {
        if (imageHashCache.has(candidate.imageUrl)) {
          candHash = imageHashCache.get(candidate.imageUrl);
        } else {
          try {
            const computed = await computeImageHash(candidate.imageUrl);
            candHash = computed ? computed.hash : null;
            if (candHash) {
              imageHashCache.set(candidate.imageUrl, candHash);
              if (imageHashCache.size > 200) {
                const firstKey = imageHashCache.keys().next().value;
                imageHashCache.delete(firstKey);
              }
            }
          } catch (e) {
            candHash = null;
          }
        }
      }

      const hasImageComparison = Boolean(imageHash && candHash);
      if (hasImageComparison) {
        imageScore = computeImageSimilarity(imageHash, candHash);
      }

      let totalScore = 0;
      if (hasImageComparison) {
        totalScore = (
          (locationScore * DUPLICATE_CONFIG.WEIGHTS.location) +
          (categoryScore * DUPLICATE_CONFIG.WEIGHTS.category) +
          (semanticScore * DUPLICATE_CONFIG.WEIGHTS.semantic) +
          (imageScore * DUPLICATE_CONFIG.WEIGHTS.image)
        );
      } else {
        const textWeightSum = DUPLICATE_CONFIG.WEIGHTS.location + DUPLICATE_CONFIG.WEIGHTS.category + DUPLICATE_CONFIG.WEIGHTS.semantic;
        totalScore = (
          (locationScore * (DUPLICATE_CONFIG.WEIGHTS.location / textWeightSum)) +
          (categoryScore * (DUPLICATE_CONFIG.WEIGHTS.category / textWeightSum)) +
          (semanticScore * (DUPLICATE_CONFIG.WEIGHTS.semantic / textWeightSum))
        );
      }
      totalScore *= weightMultiplier;

      if (totalScore > highestTotalScore) {
        highestTotalScore = totalScore;
        bestCandidate = candidate;
        bestDistance = distance;
        bestSignals = {
          locationScore,
          categoryScore,
          semanticScore,
          imageScore,
          totalScore
        };
      }
    }

    if (!bestCandidate) {
      return { result: 'NEW_ISSUE', score: 0, candidate: null, signals: null };
    }

    // 7. Result Classification
    let result = 'NEW_ISSUE';
    if (bestSignals && bestSignals.imageScore >= 0.85 && bestDistance < 30 && bestSignals.categoryScore > 0) {
      result = 'CONFIRMED_DUPLICATE';
    } else if (bestDistance < DUPLICATE_CONFIG.SPATIAL.STRONG_RANGE_METERS && highestTotalScore >= 0.70 && bestSignals.categoryScore === 1.0) {
      // 0-15m: strong spatial signal + identical canonical category + supporting evidence
      result = 'CONFIRMED_DUPLICATE';
    } else if (highestTotalScore >= DUPLICATE_CONFIG.CONFIRMED_THRESHOLD && bestDistance < DUPLICATE_CONFIG.SPATIAL.MEDIUM_RANGE_METERS) {
      // 15-30m: requires stronger multi-signal evidence
      result = 'CONFIRMED_DUPLICATE';
    } else if (highestTotalScore >= DUPLICATE_CONFIG.POSSIBLE_THRESHOLD) {
      result = 'POSSIBLE_DUPLICATE';
    }

    const candidateOutput = result !== 'NEW_ISSUE' ? {
      ...bestCandidate,
      complaint_id: bestCandidate.complaintId || bestCandidate.id,
      citizen_count: bestCandidate.citizenCount || 1,
      distance_meters: Math.round(bestDistance),
      match_score: Math.round(highestTotalScore * 100)
    } : null;

    return {
      result,
      score: highestTotalScore,
      candidate: candidateOutput,
      signals: bestSignals
    };

  } catch (error) {
    logger.error('Error in findUnifiedDuplicate', { error });
    return { result: 'NEW_ISSUE', score: 0, candidate: null, signals: null };
  }
}

/**
 * Backward-compatible duplicate search function.
 * Maps unified response to previous structure.
 */
export async function findDuplicateCandidate({
  latitude,
  longitude,
  category,
  title,
  description,
  excludeIssueId
}) {
  const result = await findUnifiedDuplicate({
    latitude,
    longitude,
    category,
    title,
    description,
    excludeId: excludeIssueId,
    sourceType: 'civic'
  });

  return {
    is_duplicate: result.result !== 'NEW_ISSUE',
    score: result.score,
    candidate: result.candidate
  };
}
