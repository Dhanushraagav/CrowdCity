/**
 * CrowdCity AI — Authoritative SLA & Escalation Configuration
 * 
 * Rules:
 * - Single authoritative source for all SLA durations and escalation thresholds
 * - Timezone: Asia/Kolkata (Indian Standard Time, UTC+05:30)
 * - Configurable values that do not require frontend changes
 */

export const SLA_CONFIG = {
  // Authoritative response SLA durations in hours based on priority
  durationsHours: {
    critical: 4,    // 4 hours (Immediate public safety risk / emergency)
    high: 24,       // 24 hours (Severe infrastructure disruption)
    medium: 72,     // 72 hours / 3 days (Standard municipal maintenance)
    low: 168        // 168 hours / 7 days (Routine non-urgent civic work)
  },

  // Authoritative automatic escalation delays after becoming overdue (in hours)
  escalationThresholdHours: {
    critical: 2,    // 2 hours after overdue -> ESCALATED
    high: 12,       // 12 hours after overdue -> ESCALATED
    medium: 24,     // 24 hours after overdue -> ESCALATED
    low: 48         // 48 hours after overdue -> ESCALATED
  },

  // Target municipal timezone for CrowdCity (Tamil Nadu, India)
  timezone: 'Asia/Kolkata'
};

/**
 * Resolves normalized priority string ('critical', 'high', 'medium', 'low')
 */
export function resolveIssuePriority(issue) {
  if (!issue) return 'medium';
  if (issue.is_emergency === true || issue.is_emergency === 'true') return 'critical';
  
  const p = (issue.priority || issue.ai_priority || '').toString().toLowerCase().trim();
  if (p === 'critical' || p === 'emergency') return 'critical';
  if (p === 'high') return 'high';
  if (p === 'low') return 'low';
  return 'medium';
}

/**
 * Calculates authoritative SLA response deadline Date object for a complaint
 * 
 * @param {Date|string} createdAt - Complaint creation timestamp
 * @param {string} [priority] - Complaint priority
 * @param {boolean} [isEmergency=false] - Emergency flag
 * @returns {Date} SLA Deadline Date
 */
export function calculateSlaDeadline(createdAt, priority, isEmergency = false) {
  const baseDate = createdAt ? new Date(createdAt) : new Date();
  const validDate = isNaN(baseDate.getTime()) ? new Date() : baseDate;

  let normPriority = 'medium';
  if (isEmergency === true || isEmergency === 'true') {
    normPriority = 'critical';
  } else if (priority) {
    const p = priority.toString().toLowerCase().trim();
    if (p === 'critical' || p === 'emergency') normPriority = 'critical';
    else if (p === 'high') normPriority = 'high';
    else if (p === 'low') normPriority = 'low';
  }

  const hours = SLA_CONFIG.durationsHours[normPriority] || SLA_CONFIG.durationsHours.medium;
  const deadline = new Date(validDate.getTime() + hours * 60 * 60 * 1000);
  return deadline;
}

/**
 * Formats a timestamp into Tamil Nadu localized display (IST: Asia/Kolkata)
 * Example: "02 Sep 2026, 10:30 AM"
 */
export function formatTamilNaduDate(date) {
  if (!date) return 'N/A';
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'N/A';

  return new Intl.DateTimeFormat('en-IN', {
    timeZone: SLA_CONFIG.timezone,
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }).format(d);
}

/**
 * Formats duration milliseconds into human-readable label (e.g. "8h 24m", "3d 2h")
 */
export function formatDurationLabel(ms) {
  if (ms <= 0) return '0m';

  const totalMinutes = Math.floor(ms / (1000 * 60));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}
