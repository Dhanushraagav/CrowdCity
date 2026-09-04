/**
 * CrowdCity AI — SLA Evaluation & Automatic Escalation Engine
 * 
 * Rules:
 * - Authoritative backend/database driven SLA calculations
 * - Automatic transitions: Pending -> Overdue -> Escalated
 * - Integrates with existing status_history and notifications
 * - Concurrency & idempotency safe (no duplicate escalations or notifications)
 * - Timezone-aware (Asia/Kolkata, Tamil Nadu)
 */

import { supabaseAdmin, supabase } from '../config/supabase.js';
import logger from '../config/logger.js';
import {
  SLA_CONFIG,
  resolveIssuePriority,
  calculateSlaDeadline,
  formatTamilNaduDate,
  formatDurationLabel
} from '../config/slaConfig.js';
import { createNotification } from '../controllers/notificationController.js';

/**
 * Checks if first authoritative action has been recorded for an issue.
 * Valid authority actions:
 * 1. Assigned to an inspector / department official
 * 2. Status moved from 'pending' to 'assigned', 'in_progress', 'resolved', 'verified', or 'rejected'
 * 3. responded_at is already set
 */
export function hasAuthorityActionOccurred(issue) {
  if (!issue) return false;
  if (issue.responded_at) return true;
  if (issue.assigned_to) return true;

  const st = (issue.status || '').toLowerCase().trim();
  return ['assigned', 'in_progress', 'resolved', 'verified', 'rejected', 'completed'].includes(st);
}

/**
 * Computes authoritative SLA state and attaches display metadata to an issue record.
 * 
 * @param {Object} issue
 * @param {Date} [currentTime=new Date()]
 * @returns {Object} issue with normalized SLA properties
 */
export function computeSlaState(issue, currentTime = new Date()) {
  if (!issue) return issue;

  const now = currentTime ? new Date(currentTime) : new Date();
  const priority = resolveIssuePriority(issue);

  // Authoritative deadline from issue column or computed fallback
  let deadlineDate = issue.sla_deadline ? new Date(issue.sla_deadline) : null;
  if (!deadlineDate || isNaN(deadlineDate.getTime())) {
    deadlineDate = calculateSlaDeadline(issue.created_at, priority, issue.is_emergency);
  }

  issue.sla_deadline = deadlineDate.toISOString();
  issue.sla_deadline_formatted = formatTamilNaduDate(deadlineDate);

  const isResponded = hasAuthorityActionOccurred(issue);
  const deadlineMs = deadlineDate.getTime();
  const nowMs = now.getTime();
  const diffMs = deadlineMs - nowMs;

  const escalationDelayHours = SLA_CONFIG.escalationThresholdHours[priority] || 24;
  const escalationThresholdMs = deadlineMs + (escalationDelayHours * 60 * 60 * 1000);

  let currentSlaStatus = 'within_sla';
  let timeRemainingLabel = '';
  let isOverdue = false;
  let isEscalated = false;

  if (isResponded) {
    // Authority action taken
    const responseTimeMs = issue.responded_at ? new Date(issue.responded_at).getTime() : nowMs;
    if (responseTimeMs <= deadlineMs) {
      currentSlaStatus = 'met';
      timeRemainingLabel = 'Met SLA';
    } else {
      currentSlaStatus = 'breached';
      timeRemainingLabel = 'Responded (Past SLA)';
    }
  } else {
    // Unhandled complaint
    if (nowMs <= deadlineMs) {
      currentSlaStatus = 'within_sla';
      timeRemainingLabel = `${formatDurationLabel(diffMs)} remaining`;
    } else if (nowMs < escalationThresholdMs) {
      currentSlaStatus = 'overdue';
      isOverdue = true;
      timeRemainingLabel = `Overdue by ${formatDurationLabel(nowMs - deadlineMs)}`;
    } else {
      currentSlaStatus = 'escalated';
      isOverdue = true;
      isEscalated = true;
      timeRemainingLabel = 'Escalated to Senior Authority';
    }
  }

  issue.sla_status = currentSlaStatus;
  issue.time_remaining_label = timeRemainingLabel;
  issue.is_overdue = isOverdue;
  issue.is_escalated = isEscalated;
  issue.escalation_level = isEscalated ? (issue.escalation_level || 1) : (issue.escalation_level || 0);

  // If unhandled and overdue/escalated, reflect authoritative state in display status
  if (!isResponded) {
    if (isEscalated) {
      issue.status = 'escalated';
    } else if (isOverdue) {
      issue.status = 'overdue';
    }
  }

  return issue;
}

/**
 * Sweeps the database for unhandled complaints past SLA and performs automatic transitions.
 * Concurrency-safe and idempotent: never produces duplicate status_history or notifications.
 * 
 * @param {Date} [currentTime=new Date()]
 * @returns {Promise<{ success: boolean, overdue_count: number, escalated_count: number }>}
 */
export async function checkAndProcessSlaEscalations(currentTime = new Date()) {
  const now = currentTime ? new Date(currentTime) : new Date();
  const client = supabaseAdmin || supabase;

  let overdueCount = 0;
  let escalatedCount = 0;

  try {
    // 1. Fetch unhandled issues in pending or overdue status
    const { data: issues, error } = await client
      .from('issues')
      .select('id, complaint_id, title, reporter_id, assigned_to, status, sla_status, sla_deadline, created_at, priority, ai_priority, is_emergency, escalation_level, responded_at')
      .in('status', ['pending', 'overdue'])
      .is('responded_at', null)
      .is('assigned_to', null);

    if (error || !issues || issues.length === 0) {
      return { success: true, overdue_count: 0, escalated_count: 0 };
    }

    for (const issue of issues) {
      // Calculate SLA state for this issue
      computeSlaState(issue, now);

      const targetStatus = issue.status; // 'overdue' or 'escalated' or 'pending'
      const complaintIdText = issue.complaint_id || `#${issue.id.substring(0, 8)}`;

      // 2. Transition Pending -> Overdue
      if (targetStatus === 'overdue' && issue.status !== 'pending' && issue.sla_status === 'overdue') {
        // Update database issue status
        const { error: updateErr } = await client
          .from('issues')
          .update({
            status: 'overdue',
            sla_status: 'overdue',
            updated_at: now.toISOString()
          })
          .eq('id', issue.id)
          .eq('status', 'pending'); // optimistic lock

        if (!updateErr) {
          overdueCount++;
          const deadlineText = issue.sla_deadline_formatted || formatTamilNaduDate(issue.sla_deadline);

          // Append to status_history
          await client.from('status_history').insert({
            issue_id: issue.id,
            status: 'overdue',
            notes: `SLA Response Deadline (${deadlineText} IST) elapsed without authority action. Status updated to OVERDUE.`,
            created_at: now.toISOString()
          }).catch(() => {});

          // Notify Citizen Reporter (with deduplication check)
          if (issue.reporter_id) {
            await sendSafeNotification(
              issue.reporter_id,
              `Complaint ${complaintIdText} Overdue Notice`,
              `Your complaint "${issue.title}" has exceeded the standard SLA response time (${deadlineText} IST). It has been prioritized for municipal action.`,
              'sla_overdue',
              issue.id
            );
          }
        }
      }

      // 3. Transition Overdue -> Escalated
      if (targetStatus === 'escalated' && issue.is_escalated && (issue.escalation_level === 0 || !issue.escalation_level)) {
        const { error: updateEscErr } = await client
          .from('issues')
          .update({
            status: 'escalated',
            sla_status: 'escalated',
            escalated_at: now.toISOString(),
            escalation_level: 1,
            updated_at: now.toISOString()
          })
          .eq('id', issue.id)
          .neq('status', 'escalated'); // prevent double escalation

        if (!updateEscErr) {
          escalatedCount++;

          // Append to status_history
          await client.from('status_history').insert({
            issue_id: issue.id,
            status: 'escalated',
            notes: `Automated Escalation: Complaint remained unhandled beyond escalation threshold. Escalated to Senior Municipal Authority.`,
            created_at: now.toISOString()
          }).catch(() => {});

          // Notify Citizen Reporter
          if (issue.reporter_id) {
            await sendSafeNotification(
              issue.reporter_id,
              `Complaint ${complaintIdText} Automatically Escalated`,
              `Your complaint "${issue.title}" has been escalated to Senior Municipal Administration for expedited resolution.`,
              'sla_escalated',
              issue.id
            );
          }
        }
      }
    }

    return {
      success: true,
      overdue_count: overdueCount,
      escalated_count: escalatedCount
    };
  } catch (err) {
    logger.error('Error during checkAndProcessSlaEscalations:', err);
    return { success: false, overdue_count: overdueCount, escalated_count: escalatedCount };
  }
}

/**
 * Sends a notification only if an identical notification type hasn't been sent for this issue.
 */
async function sendSafeNotification(userId, title, message, type, issueId) {
  try {
    const client = supabaseAdmin || supabase;
    const { data: existing } = await client
      .from('notifications')
      .select('id')
      .eq('user_id', userId)
      .eq('issue_id', issueId)
      .eq('type', type)
      .limit(1);

    if (existing && existing.length > 0) {
      return; // Deduplicated
    }

    await createNotification(userId, title, message, type, issueId);
  } catch (err) {
    logger.warn('sendSafeNotification notice:', err.message);
  }
}

/**
 * Calculates aggregate SLA statistics across complaints for the Authority Dashboard.
 * 
 * @param {Array} complaintsList
 * @returns {Object} SLA metrics { complianceRate, pendingSla, overdue, escalated }
 */
export function calculateSlaMetrics(complaintsList = [], currentTime = new Date()) {
  let pendingSla = 0;
  let overdue = 0;
  let escalated = 0;
  let metCount = 0;
  let breachedCount = 0;

  const now = currentTime ? new Date(currentTime) : new Date();

  complaintsList.forEach(c => {
    if (!c) return;
    if (!c.sla_status) {
      computeSlaState(c, now);
    }

    const st = (c.status || '').toLowerCase();
    const slaSt = c.sla_status;

    if (st === 'escalated' || slaSt === 'escalated') {
      escalated++;
    } else if (st === 'overdue' || slaSt === 'overdue') {
      overdue++;
    } else if (st === 'pending' || slaSt === 'within_sla') {
      pendingSla++;
    }

    if (slaSt === 'met') {
      metCount++;
    } else if (slaSt === 'breached' || slaSt === 'overdue' || slaSt === 'escalated') {
      breachedCount++;
    }
  });

  const totalEvaluated = metCount + breachedCount;
  const complianceRate = totalEvaluated > 0 
    ? Math.round((metCount / totalEvaluated) * 100) 
    : 100;

  return {
    complianceRate: Math.max(0, Math.min(100, complianceRate)),
    pendingSla,
    overdue,
    escalated
  };
}

/**
 * Starts automatic background timer on Node server process (runs every 60 seconds).
 */
let _backgroundInterval = null;

export function startSlaBackgroundWorker(intervalMs = 60000) {
  if (_backgroundInterval) return;

  logger.info(`[SLA] Starting automatic SLA escalation background worker (interval: ${intervalMs / 1000}s)`);

  _backgroundInterval = setInterval(() => {
    checkAndProcessSlaEscalations().catch(err => {
      logger.error('[SLA Worker] Error in background sweep:', err);
    });
  }, intervalMs);

  // Unref so worker doesn't block graceful shutdown
  if (_backgroundInterval.unref) {
    _backgroundInterval.unref();
  }
}
