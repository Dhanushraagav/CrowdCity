/**
 * CrowdCity AI — Authoritative Civic Issue Priority Scoring Engine
 * 
 * Mathematical, deterministic priority scoring system.
 * Formula:
 *   P = 0.30S + 0.25A + 0.20R + 0.15D + 0.10U
 * 
 * Where:
 *   S = Severity Score (0–100)
 *   A = Affected Citizens Score (0–100)
 *   R = Recurrence Score (0–100)
 *   D = Duration Score (0–100)
 *   U = Public Location Importance Score (0–100)
 * 
 * Clamped to [0, 100].
 * Levels: LOW (0–24.99), MODERATE (25–49.99), HIGH (50–74.99), CRITICAL (75–100).
 */

import { supabaseAdmin, supabase } from '../config/supabase.js';
import logger from '../config/logger.js';
import {
  CIVIC_PRIORITY_CONFIG,
  validateWeights,
  classifyPriorityLevel,
  normalizeSeverity,
  normalizeAffectedCitizens,
  normalizeRecurrence,
  normalizeDuration,
  normalizePublicImportance
} from '../config/civicPriorityConfig.js';
import { calculateHaversineDistance } from './duplicateDetectionService.js';

/**
 * Calculates deterministic mathematical priority score for a civic complaint.
 * 
 * @param {Object} params
 * @param {Object} params.complaint Complaint record or parameters
 * @param {number} [params.recurrenceCount] Pre-calculated recurrence count
 * @param {Date} [params.currentTime=new Date()] Evaluation timestamp
 * @returns {{
 *   priority_score: number,
 *   priority_level: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL',
 *   priority_factors: {
 *     severity: number,
 *     affected: number,
 *     recurrence: number,
 *     duration: number,
 *     public_importance: number
 *   },
 *   priority_calculated_at: string,
 *   priority_model_version: string
 * }}
 */
export function calculatePriorityScore({
  complaint,
  recurrenceCount = 0,
  currentTime = new Date()
}) {
  if (!complaint || typeof complaint !== 'object') {
    return {
      priority_score: 0,
      priority_level: 'LOW',
      priority_factors: {
        severity: 0,
        affected: 0,
        recurrence: 0,
        duration: 0,
        public_importance: 0
      },
      priority_calculated_at: new Date().toISOString(),
      priority_model_version: CIVIC_PRIORITY_CONFIG.model_version
    };
  }

  // 1. Compute Factor S (Severity): 0–100
  const rawSeverity = complaint.severity || complaint.priority || complaint.ai_priority || null;
  const isEmergency = complaint.is_emergency === true || complaint.is_emergency === 'true';
  const S = normalizeSeverity(rawSeverity, isEmergency);

  // 2. Compute Factor A (Affected Citizens): 0–100
  // In master complaint consolidation, citizen_count tracks consolidated reporters
  const affectedCount = complaint.citizen_count !== undefined && complaint.citizen_count !== null
    ? complaint.citizen_count
    : (complaint.affected_count !== undefined ? complaint.affected_count : 1);
  const A = normalizeAffectedCitizens(affectedCount);

  // 3. Compute Factor R (Recurrence): 0–100
  const rCount = recurrenceCount !== undefined && recurrenceCount !== null
    ? recurrenceCount
    : (complaint.recurrence_count || 0);
  const R = normalizeRecurrence(rCount);

  // 4. Compute Factor D (Duration): 0–100
  const D = normalizeDuration({
    createdAt: complaint.created_at,
    slaDeadline: complaint.sla_deadline,
    status: complaint.status,
    priority: rawSeverity,
    isEmergency,
    currentTime
  });

  // 5. Compute Factor U (Public Location Importance): 0–100
  const locationImportance = complaint.location_importance || complaint.place_type || complaint.location_type || null;
  const U = normalizePublicImportance(locationImportance);

  // 6. Weighted Sum Calculation
  const { weights } = CIVIC_PRIORITY_CONFIG;
  const rawP =
    (S * weights.severity) +
    (A * weights.affected) +
    (R * weights.recurrence) +
    (D * weights.duration) +
    (U * weights.public_importance);

  // 7. Clamp to [0, 100]
  const clampedP = Math.max(0, Math.min(100, rawP));
  const roundedScore = Number(clampedP.toFixed(2));
  const level = classifyPriorityLevel(roundedScore);

  return {
    priority_score: roundedScore,
    priority_level: level,
    priority_factors: {
      severity: Math.round(S),
      affected: Math.round(A),
      recurrence: Math.round(R),
      duration: Math.round(D),
      public_importance: Math.round(U)
    },
    priority_calculated_at: new Date().toISOString(),
    priority_model_version: CIVIC_PRIORITY_CONFIG.model_version
  };
}

/**
 * Resolves historical recurrence count for an issue based on nearby matching category
 * complaints in the configured historical time window.
 * 
 * @param {Object} params
 * @param {Object} params.complaint
 * @param {Object} [params.client]
 * @returns {Promise<number>} Recurrence count
 */
export async function resolveRecurrenceCount({ complaint, client }) {
  if (!complaint || !complaint.latitude || !complaint.longitude || !complaint.category) {
    return 0;
  }

  const activeClient = client || supabaseAdmin || supabase;
  if (!activeClient) return 0;

  const lat = parseFloat(complaint.latitude);
  const lng = parseFloat(complaint.longitude);
  if (isNaN(lat) || isNaN(lng)) return 0;

  const windowDays = CIVIC_PRIORITY_CONFIG.recurrence.window_days;
  const windowDate = new Date(Date.now() - (windowDays * 24 * 60 * 60 * 1000)).toISOString();
  const radiusMeters = CIVIC_PRIORITY_CONFIG.recurrence.radius_meters;

  // Approximate bounding box
  const latDelta = (radiusMeters * 1.5) / 111000;
  const lngDelta = (radiusMeters * 1.5) / (111000 * Math.cos((lat * Math.PI) / 180));

  try {
    let query = activeClient
      .from('issues')
      .select('id, latitude, longitude, created_at, category')
      .eq('category', complaint.category)
      .gte('created_at', windowDate)
      .gte('latitude', lat - latDelta)
      .lte('latitude', lat + latDelta)
      .gte('longitude', lng - lngDelta)
      .lte('longitude', lng + lngDelta);

    if (complaint.id) {
      query = query.neq('id', complaint.id);
    }

    const { data: candidates, error } = await query.limit(30);
    if (error || !candidates || candidates.length === 0) {
      return 0;
    }

    // Filter by exact Haversine distance
    let matchingCount = 0;
    for (const item of candidates) {
      const dist = calculateHaversineDistance(lat, lng, item.latitude, item.longitude);
      if (dist <= radiusMeters) {
        matchingCount++;
      }
    }

    return matchingCount;
  } catch (err) {
    logger.warn('[civicPriorityService] resolveRecurrenceCount note:', err.message);
    return 0;
  }
}

/**
 * Enriches an issue record with priority scoring fields.
 * Safely computes dynamic values if database columns are unpopulated.
 * 
 * @param {Object} issue
 * @param {Date} [currentTime=new Date()]
 * @returns {Object} Enriched issue
 */
export function enrichIssueWithPriority(issue, currentTime = new Date()) {
  if (!issue) return issue;

  // If issue already has stored authoritative priority_score and priority_factors,
  // ensure presentation consistency
  if (issue.priority_score !== undefined && issue.priority_score !== null && issue.priority_factors) {
    issue.priority_score = Number(Number(issue.priority_score).toFixed(2));
    if (!issue.priority_level) {
      issue.priority_level = classifyPriorityLevel(issue.priority_score);
    }
    if (!issue.priority_model_version) {
      issue.priority_model_version = CIVIC_PRIORITY_CONFIG.model_version;
    }
    return issue;
  }

  // Fallback: calculate dynamically
  const result = calculatePriorityScore({ complaint: issue, currentTime });
  issue.priority_score = result.priority_score;
  issue.priority_level = result.priority_level;
  issue.priority_factors = result.priority_factors;
  issue.priority_calculated_at = result.priority_calculated_at;
  issue.priority_model_version = result.priority_model_version;

  return issue;
}
