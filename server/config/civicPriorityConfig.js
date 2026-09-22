/**
 * CrowdCity AI — Authoritative Civic Issue Priority Score Configuration
 * 
 * Centralized configuration for the mathematical priority scoring engine.
 * Rule: Numeric weights, thresholds, and normalization limits must NOT be scattered.
 * Weights must strictly sum to 1.00.
 */

import { SLA_CONFIG, resolveIssuePriority } from './slaConfig.js';

export const CIVIC_PRIORITY_CONFIG = {
  // Model version for auditability and schema tracking
  model_version: 'v1',

  // Authoritative factor weights (must strictly sum to 1.00)
  weights: {
    severity: 0.30,           // 30%: Severity of civic complaint
    affected: 0.25,           // 25%: Number of affected / reporting citizens (duplicate consolidation)
    recurrence: 0.20,         // 20%: Frequency of same issue/category in local vicinity
    duration: 0.15,           // 15%: Duration unresolved relative to SLA timeline
    public_importance: 0.10   // 10%: Public importance of location
  },

  // Priority classification thresholds (0–100 scale)
  thresholds: {
    low: { min: 0, max: 24.99, label: 'LOW' },
    moderate: { min: 25, max: 49.99, label: 'MODERATE' },
    high: { min: 50, max: 74.99, label: 'HIGH' },
    critical: { min: 75, max: 100, label: 'CRITICAL' }
  },

  // Severity normalization mapping (0–100)
  severity_mapping: {
    low: 25,
    medium: 50,
    high: 75,
    critical: 100,
    emergency: 100,
    default: 50
  },

  // Affected citizen normalization parameters
  affected_citizens: {
    reference_count: 25,      // 25+ affected citizens = 100 max score
    min_count: 1,
    cap: 100
  },

  // Recurrence normalization parameters
  recurrence: {
    reference_count: 5,       // 5 recurring complaints in window = 100 max score
    window_days: 30,          // 30-day historical evaluation window
    radius_meters: 250,       // Geographic proximity window
    cap: 100
  },

  // Duration normalization parameters relative to SLA
  duration: {
    deadline_score: 75,       // Score reached at exact SLA deadline
    max_score: 100,           // Score reached when overdue by escalation threshold
    cap: 100
  },

  // Public Location Importance tiers (0–100)
  location_importance: {
    tiers: {
      EMERGENCY_SERVICE: 100,
      HOSPITAL: 100,
      SCHOOL: 90,
      TRANSPORT_HUB: 90,
      PUBLIC_ROAD: 70,
      RESIDENTIAL: 50,
      GENERAL_AREA: 40
    },
    default_tier: 'RESIDENTIAL',
    default_score: 50
  }
};

/**
 * Validates that all priority weights strictly total 1.00.
 * Throws an Error if validation fails.
 * 
 * @returns {boolean} true if valid
 */
export function validateWeights() {
  const { severity, affected, recurrence, duration, public_importance } = CIVIC_PRIORITY_CONFIG.weights;
  const sum = Number((severity + affected + recurrence + duration + public_importance).toFixed(4));
  if (Math.abs(sum - 1.0) > 0.0001) {
    throw new Error(`[CIVIC_PRIORITY_CONFIG] Critical configuration error: Priority weights sum to ${sum}, expected exactly 1.00`);
  }
  return true;
}

// Validate weights immediately at module load time
validateWeights();

/**
 * Maps a raw numeric score [0, 100] to its priority level label.
 * 
 * @param {number} score 
 * @returns {'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL'}
 */
export function classifyPriorityLevel(score) {
  const clamped = Math.max(0, Math.min(100, Number(score) || 0));
  if (clamped >= 75) return 'CRITICAL';
  if (clamped >= 50) return 'HIGH';
  if (clamped >= 25) return 'MODERATE';
  return 'LOW';
}

/**
 * Normalizes complaint severity to 0–100.
 * 
 * @param {string} severity 
 * @param {boolean} [isEmergency=false] 
 * @returns {number} 0–100
 */
export function normalizeSeverity(severity, isEmergency = false) {
  if (isEmergency === true || isEmergency === 'true') {
    return CIVIC_PRIORITY_CONFIG.severity_mapping.emergency;
  }
  if (!severity) {
    return CIVIC_PRIORITY_CONFIG.severity_mapping.default;
  }
  const clean = String(severity).toLowerCase().trim();
  return CIVIC_PRIORITY_CONFIG.severity_mapping[clean] || CIVIC_PRIORITY_CONFIG.severity_mapping.default;
}

/**
 * Normalizes affected citizens count to 0–100.
 * 
 * @param {number} count 
 * @returns {number} 0–100
 */
export function normalizeAffectedCitizens(count) {
  const c = Math.max(0, parseInt(count, 10) || 0);
  const ref = CIVIC_PRIORITY_CONFIG.affected_citizens.reference_count;
  const rawScore = (100 * c) / ref;
  return Math.min(CIVIC_PRIORITY_CONFIG.affected_citizens.cap, Math.max(0, rawScore));
}

/**
 * Normalizes recurrence count to 0–100.
 * 
 * @param {number} count 
 * @returns {number} 0–100
 */
export function normalizeRecurrence(count) {
  const c = Math.max(0, parseInt(count, 10) || 0);
  const ref = CIVIC_PRIORITY_CONFIG.recurrence.reference_count;
  const rawScore = (100 * c) / ref;
  return Math.min(CIVIC_PRIORITY_CONFIG.recurrence.cap, Math.max(0, rawScore));
}

/**
 * Normalizes unresolved duration against the existing SLA timeline to 0–100.
 * 
 * @param {Object} params
 * @param {Date|string} params.createdAt
 * @param {Date|string} [params.slaDeadline]
 * @param {string} [params.status]
 * @param {string} [params.priority]
 * @param {boolean} [params.isEmergency]
 * @param {Date} [params.currentTime=new Date()]
 * @returns {number} 0–100
 */
export function normalizeDuration({
  createdAt,
  slaDeadline,
  status,
  priority,
  isEmergency = false,
  currentTime = new Date()
}) {
  const st = (status || 'pending').toLowerCase().trim();
  // Resolved, verified, completed, or rejected issues have 0 active duration urgency
  if (['resolved', 'verified', 'completed', 'rejected'].includes(st)) {
    return 0;
  }

  const createdDate = createdAt ? new Date(createdAt) : new Date();
  const createdMs = isNaN(createdDate.getTime()) ? Date.now() : createdDate.getTime();
  const nowMs = currentTime ? new Date(currentTime).getTime() : Date.now();
  const elapsedMs = Math.max(0, nowMs - createdMs);
  const elapsedHours = elapsedMs / (1000 * 60 * 60);

  const normPriority = resolveIssuePriority({ priority, is_emergency: isEmergency });
  const slaDurationHours = SLA_CONFIG.durationsHours[normPriority] || 72;
  const escalationThresholdHours = SLA_CONFIG.escalationThresholdHours[normPriority] || 24;

  let deadlineMs;
  if (slaDeadline && !isNaN(new Date(slaDeadline).getTime())) {
    deadlineMs = new Date(slaDeadline).getTime();
  } else {
    deadlineMs = createdMs + slaDurationHours * 60 * 60 * 1000;
  }

  if (nowMs <= deadlineMs) {
    // Within SLA: scale smoothly from 0 up to deadline_score (75)
    const ratio = slaDurationHours > 0 ? Math.min(1, elapsedHours / slaDurationHours) : 1;
    return ratio * CIVIC_PRIORITY_CONFIG.duration.deadline_score;
  } else {
    // Overdue: scale from deadline_score (75) up to 100 based on escalation delay
    const overdueHours = (nowMs - deadlineMs) / (1000 * 60 * 60);
    const overdueRatio = escalationThresholdHours > 0 ? Math.min(1, overdueHours / escalationThresholdHours) : 1;
    const additional = overdueRatio * (CIVIC_PRIORITY_CONFIG.duration.max_score - CIVIC_PRIORITY_CONFIG.duration.deadline_score);
    return Math.min(100, CIVIC_PRIORITY_CONFIG.duration.deadline_score + additional);
  }
}

/**
 * Normalizes public location importance to 0–100.
 * 
 * @param {string|number} locationImportance Metadata tier name or explicit score
 * @returns {number} 0–100
 */
export function normalizePublicImportance(locationImportance) {
  if (locationImportance === null || locationImportance === undefined || locationImportance === '') {
    return CIVIC_PRIORITY_CONFIG.location_importance.default_score;
  }
  
  if (typeof locationImportance === 'number' && !isNaN(locationImportance)) {
    return Math.max(0, Math.min(100, locationImportance));
  }

  const str = String(locationImportance).toUpperCase().trim();
  if (CIVIC_PRIORITY_CONFIG.location_importance.tiers[str] !== undefined) {
    return CIVIC_PRIORITY_CONFIG.location_importance.tiers[str];
  }

  const parsed = parseFloat(str);
  if (!isNaN(parsed)) {
    return Math.max(0, Math.min(100, parsed));
  }

  return CIVIC_PRIORITY_CONFIG.location_importance.default_score;
}
