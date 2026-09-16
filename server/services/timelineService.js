/**
 * Complaint Timeline Service
 * 
 * Centralized, data-driven engine for building the 5-stage complaint lifecycle:
 * SUBMITTED -> VERIFIED -> ASSIGNED -> IN PROGRESS -> RESOLVED
 * 
 * Rules:
 * 1. Data-Driven: Events derived strictly from actual complaint records and status_history audit logs.
 * 2. No Fake Timestamps: Never fabricates timestamps or generates speculative dates.
 * 3. Existing Status Authority: issue.status remains the single source of truth.
 * 4. Legacy Safe: Correctly infers completed prerequisites without inventing historical dates.
 * 5. RBAC Conscious: Sanitizes internal operational data for citizens while preserving operational visibility for authorities.
 */

import { formatTamilNaduDate } from '../config/slaConfig.js';
import logger from '../config/logger.js';

export const TIMELINE_STAGES = [
  { id: 'submitted', key: 'stage_submitted', label: 'Submitted' },
  { id: 'verified', key: 'stage_verified', label: 'Verified' },
  { id: 'assigned', key: 'stage_assigned', label: 'Assigned' },
  { id: 'in_progress', key: 'stage_in_progress', label: 'In Progress' },
  { id: 'resolved', key: 'stage_resolved', label: 'Resolved' }
];

/**
 * Builds a deterministic, structured timeline for a complaint.
 * 
 * @param {Object} issue - The complaint record from `issues` table
 * @param {Array} historyLogs - Chronological logs from `status_history` table
 * @param {string} userRole - 'citizen', 'authority', or 'admin'
 * @returns {Object} Full timeline lifecycle payload
 */
export function buildTimeline(issue, historyLogs = [], userRole = 'citizen') {
  if (!issue) return null;

  const logs = Array.isArray(historyLogs) ? [...historyLogs] : [];
  logs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const isAuthorityOrAdmin = userRole === 'authority' || userRole === 'admin';
  const status = (issue.status || 'pending').toLowerCase();

  // Find explicit status logs (first occurrence of each key status)
  const submittedLog = logs.find(l => l.status === 'pending') || null;
  const assignedLog = logs.find(l => l.status === 'assigned') || null;
  const inProgressLogs = logs.filter(l => l.status === 'in_progress');
  const inProgressLog = inProgressLogs.length > 0 ? inProgressLogs[0] : null;
  const latestInProgressLog = inProgressLogs.length > 0 ? inProgressLogs[inProgressLogs.length - 1] : null;
  const resolvedLog = logs.find(l => l.status === 'resolved') || null;

  // Disambiguate pre-assignment triage verification from post-resolution citizen verification
  const hasAssigned = !!(issue.assigned_to || assignedLog || status === 'assigned');
  const hasResolvedProof = !!(issue.completion_proof_url || issue.completion_notes);
  const isPostResolutionVerified = (status === 'verified') && (hasResolvedProof || resolvedLog || hasAssigned);
  const isTriageVerified = (status === 'verified') && !isPostResolutionVerified;

  const preAssignmentVerifiedLog = logs.find(l => {
    if (l.status !== 'verified') return false;
    if (assignedLog && new Date(l.created_at).getTime() > new Date(assignedLog.created_at).getTime()) return false;
    if (resolvedLog && new Date(l.created_at).getTime() > new Date(resolvedLog.created_at).getTime()) return false;
    if (l.notes && /resolution.*approved|verified.*citizen/i.test(l.notes)) return false;
    return true;
  }) || null;

  const postResolutionVerifiedLog = logs.find(l => {
    if (l.status !== 'verified') return false;
    if (resolvedLog && new Date(l.created_at).getTime() >= new Date(resolvedLog.created_at).getTime()) return true;
    if (l.notes && /resolution.*approved|verified.*citizen/i.test(l.notes)) return true;
    return false;
  }) || null;

  // Derive department/authority display name
  const authorityDisplay = 
    issue.assigned_officer?.full_name ||
    (assignedLog?.profiles?.full_name ? assignedLog.profiles.full_name : null) ||
    issue.authority_resolution?.administrativeAuthority?.officeName ||
    issue.authority_resolution?.administrativeAuthority?.departmentName ||
    issue.ai_department ||
    'Local Municipal Authority';

  // 1. SUBMITTED STAGE (Always completed for any created issue)
  const submittedTimestamp = submittedLog?.created_at || issue.created_at;
  const stageSubmitted = {
    id: 'submitted',
    key: 'stage_submitted',
    label: 'Submitted',
    state: 'completed',
    timestamp: submittedTimestamp || null,
    timestamp_formatted: submittedTimestamp ? formatTamilNaduDate(submittedTimestamp) : null,
    title: 'Complaint Submitted',
    notes: submittedLog?.notes || 'Complaint successfully registered in public civic system.',
    actor_name: issue.reporter?.full_name || submittedLog?.profiles?.full_name || 'Citizen Reporter',
    actor_role: 'citizen',
    is_inferred: false
  };

  // 2. VERIFIED STAGE
  let verifiedState = 'pending';
  let verifiedTimestamp = null;
  let verifiedNotes = null;
  let verifiedActor = null;
  let verifiedIsInferred = false;

  if (preAssignmentVerifiedLog) {
    verifiedState = isTriageVerified ? 'current' : 'completed';
    verifiedTimestamp = preAssignmentVerifiedLog.created_at;
    verifiedNotes = preAssignmentVerifiedLog.notes || preAssignmentVerifiedLog.remarks || 'Complaint verified by administrative authority.';
    verifiedActor = preAssignmentVerifiedLog.profiles?.full_name || 'Municipal Officer';
  } else if (isTriageVerified) {
    verifiedState = 'current';
    verifiedTimestamp = issue.updated_at || null;
    verifiedNotes = issue.official_remarks || 'Complaint verified for department assignment.';
    verifiedActor = 'Municipal Officer';
  } else if (['assigned', 'in_progress', 'resolved', 'verified'].includes(status) || hasAssigned || isPostResolutionVerified) {
    // Inferred completed as prerequisite of assignment
    verifiedState = 'completed';
    // Do NOT invent a fake historical timestamp if no explicit log exists
    verifiedTimestamp = null;
    verifiedNotes = 'Complaint verified and approved for authority dispatch.';
    verifiedActor = 'Administrative Authority';
    verifiedIsInferred = true;
  }

  const stageVerified = {
    id: 'verified',
    key: 'stage_verified',
    label: 'Verified',
    state: verifiedState,
    timestamp: verifiedTimestamp,
    timestamp_formatted: verifiedTimestamp ? formatTamilNaduDate(verifiedTimestamp) : null,
    title: 'Complaint Verified',
    notes: verifiedNotes || (verifiedState === 'pending' ? 'Awaiting authority verification and triage.' : 'Complaint verified.'),
    actor_name: verifiedActor,
    actor_role: 'authority',
    is_inferred: verifiedIsInferred
  };

  // 3. ASSIGNED STAGE
  let assignedState = 'pending';
  let assignedTimestamp = null;
  let assignedNotes = null;
  let assignedActor = null;
  let assignedIsInferred = false;

  if (assignedLog) {
    assignedState = status === 'assigned' ? 'current' : (['in_progress', 'resolved'].includes(status) || isPostResolutionVerified ? 'completed' : 'pending');
    assignedTimestamp = assignedLog.created_at;
    assignedNotes = assignedLog.notes || `Assigned to ${authorityDisplay}.`;
    assignedActor = assignedLog.profiles?.full_name || authorityDisplay;
  } else if (issue.assigned_to || status === 'assigned') {
    assignedState = status === 'assigned' ? 'current' : (['in_progress', 'resolved'].includes(status) || isPostResolutionVerified ? 'completed' : 'pending');
    assignedTimestamp = issue.assigned_at || issue.updated_at || null;
    assignedNotes = `Assigned to ${authorityDisplay}.`;
    assignedActor = authorityDisplay;
  } else if (['in_progress', 'resolved'].includes(status) || isPostResolutionVerified) {
    assignedState = 'completed';
    assignedTimestamp = null;
    assignedNotes = `Assigned to ${authorityDisplay}.`;
    assignedActor = authorityDisplay;
    assignedIsInferred = true;
  }

  const stageAssigned = {
    id: 'assigned',
    key: 'stage_assigned',
    label: 'Assigned',
    state: assignedState,
    timestamp: assignedTimestamp,
    timestamp_formatted: assignedTimestamp ? formatTamilNaduDate(assignedTimestamp) : null,
    title: 'Authority Assignment',
    notes: assignedNotes || (assignedState === 'pending' ? 'Awaiting department & officer assignment.' : `Assigned to ${authorityDisplay}.`),
    authority_name: authorityDisplay,
    actor_name: assignedActor,
    actor_role: 'authority',
    is_inferred: assignedIsInferred
  };

  // 4. IN PROGRESS STAGE
  let inProgressState = 'pending';
  let inProgressTimestamp = null;
  let inProgressNotes = null;
  let inProgressActor = null;
  let inProgressIsInferred = false;

  if (inProgressLog) {
    inProgressState = status === 'in_progress' ? 'current' : (['resolved'].includes(status) || isPostResolutionVerified ? 'completed' : 'pending');
    inProgressTimestamp = latestInProgressLog?.created_at || inProgressLog.created_at;
    inProgressNotes = latestInProgressLog?.notes || inProgressLog.notes || issue.official_remarks || 'Field work and inspection initiated.';
    inProgressActor = latestInProgressLog?.profiles?.full_name || inProgressLog.profiles?.full_name || authorityDisplay;
  } else if (status === 'in_progress') {
    inProgressState = 'current';
    inProgressTimestamp = issue.updated_at || null;
    inProgressNotes = issue.official_remarks || 'Field work and inspection initiated.';
    inProgressActor = authorityDisplay;
  } else if (status === 'resolved' || isPostResolutionVerified) {
    inProgressState = 'completed';
    inProgressTimestamp = null;
    inProgressNotes = 'Field resolution work executed.';
    inProgressActor = authorityDisplay;
    inProgressIsInferred = true;
  }

  const stageInProgress = {
    id: 'in_progress',
    key: 'stage_in_progress',
    label: 'In Progress',
    state: inProgressState,
    timestamp: inProgressTimestamp,
    timestamp_formatted: inProgressTimestamp ? formatTamilNaduDate(inProgressTimestamp) : null,
    title: 'Work In Progress',
    notes: inProgressNotes || (inProgressState === 'pending' ? 'Field work will commence after assignment.' : 'Field work underway.'),
    actor_name: inProgressActor,
    actor_role: 'authority',
    is_inferred: inProgressIsInferred
  };

  // 5. RESOLVED STAGE
  let resolvedState = 'pending';
  let resolvedTimestamp = null;
  let resolvedNotes = null;
  let resolvedActor = null;
  let resolvedProof = null;

  if (resolvedLog) {
    resolvedState = 'completed';
    resolvedTimestamp = resolvedLog.created_at;
    resolvedNotes = resolvedLog.notes || issue.completion_notes || (isPostResolutionVerified ? 'Resolution approved and verified by citizen reporter.' : 'Complaint resolved successfully.');
    resolvedActor = resolvedLog.profiles?.full_name || authorityDisplay;
    resolvedProof = issue.completion_proof_url || null;
  } else if (status === 'resolved' || isPostResolutionVerified || (hasResolvedProof && ['assigned', 'in_progress', 'resolved', 'verified'].includes(status))) {
    resolvedState = 'completed';
    resolvedTimestamp = issue.resolved_at || (status === 'resolved' ? issue.updated_at : null) || null;
    resolvedNotes = issue.completion_notes || issue.official_remarks || (isPostResolutionVerified ? 'Resolution approved and verified by citizen reporter.' : 'Complaint resolved successfully.');
    resolvedActor = authorityDisplay;
    resolvedProof = issue.completion_proof_url || null;
  }

  const stageResolved = {
    id: 'resolved',
    key: 'stage_resolved',
    label: 'Resolved',
    state: resolvedState,
    timestamp: resolvedTimestamp,
    timestamp_formatted: resolvedTimestamp ? formatTamilNaduDate(resolvedTimestamp) : null,
    title: isPostResolutionVerified ? 'Resolution Completed & Verified' : 'Resolution Completed',
    notes: resolvedNotes || (resolvedState === 'pending' ? 'Resolution confirmation and completion proof.' : 'Complaint resolved.'),
    actor_name: resolvedActor,
    actor_role: 'authority',
    proof_url: resolvedProof,
    is_inferred: false
  };

  const stages = [stageSubmitted, stageVerified, stageAssigned, stageInProgress, stageResolved];

  const CANONICAL_ORDER = {
    submitted: 1,
    verified: 2,
    assigned: 3,
    in_progress: 4,
    resolved: 5
  };

  // Strictly enforce chronological event ordering (oldest at top -> newest at bottom).
  // Under no circumstance should a later timestamp appear above an earlier timestamp.
  stages.sort((a, b) => {
    const timeA = a.timestamp ? new Date(a.timestamp).getTime() : null;
    const timeB = b.timestamp ? new Date(b.timestamp).getTime() : null;
    const orderA = CANONICAL_ORDER[a.id] || 0;
    const orderB = CANONICAL_ORDER[b.id] || 0;

    // 1. Both have valid timestamps: STRICT CHRONOLOGICAL ORDER
    if (timeA !== null && timeB !== null) {
      if (timeA !== timeB) {
        return timeA - timeB; // Ascending: oldest first
      }
      return orderA - orderB; // Tie-breaker: canonical lifecycle sequence
    }

    // 2. Both lack timestamps:
    if (timeA === null && timeB === null) {
      // Completed stages precede pending stages
      if (a.state !== 'pending' && b.state === 'pending') return -1;
      if (a.state === 'pending' && b.state !== 'pending') return 1;
      return orderA - orderB;
    }

    // 3. One has timestamp, the other lacks timestamp:
    // Completed stages always precede pending stages
    if (a.state === 'pending') return 1;
    if (b.state === 'pending') return -1;

    // Both are completed (one explicit timestamp, one inferred prerequisite):
    // Position according to canonical lifecycle sequence
    return orderA - orderB;
  });

  // Determine active stage ID
  let currentStageId = 'submitted';
  if (resolvedState === 'completed') currentStageId = 'resolved';
  else if (inProgressState === 'current') currentStageId = 'in_progress';
  else if (assignedState === 'current') currentStageId = 'assigned';
  else if (verifiedState === 'current') currentStageId = 'verified';
  else if (status === 'rejected' || status === 'withdrawn') currentStageId = status;

  // Extract non-linear / audit milestones & authority update notes
  const auditEvents = [];
  const firstProgIdx = logs.findIndex(l => l.status === 'in_progress');
  logs.forEach((log, idx) => {
    if (['overdue', 'escalated', 'rejected', 'withdrawn', 'timeline_update'].includes(log.status)) {
      auditEvents.push({
        id: log.id,
        event_type: log.status,
        timestamp: log.created_at,
        timestamp_formatted: formatTamilNaduDate(log.created_at),
        notes: log.notes || log.remarks || '',
        actor_name: log.profiles?.full_name || (isAuthorityOrAdmin ? 'System Audit' : 'Authority System'),
        actor_role: log.profiles?.role || 'system'
      });
    } else if (log.status === 'in_progress' && idx > firstProgIdx && log.notes) {
      auditEvents.push({
        id: log.id,
        event_type: 'authority_update',
        timestamp: log.created_at,
        timestamp_formatted: formatTamilNaduDate(log.created_at),
        notes: log.notes,
        actor_name: log.profiles?.full_name || (isAuthorityOrAdmin ? 'Field Officer' : 'Authority Official'),
        actor_role: log.profiles?.role || 'authority'
      });
    }
  });

  if (postResolutionVerifiedLog) {
    auditEvents.push({
      id: postResolutionVerifiedLog.id,
      event_type: 'resolution_verified',
      timestamp: postResolutionVerifiedLog.created_at,
      timestamp_formatted: formatTamilNaduDate(postResolutionVerifiedLog.created_at),
      notes: postResolutionVerifiedLog.notes || 'Resolution approved and verified by citizen reporter.',
      actor_name: postResolutionVerifiedLog.profiles?.full_name || 'Citizen Reporter',
      actor_role: 'citizen'
    });
  }

  // Ensure audit events are strictly sorted chronologically ascending (oldest to newest)
  auditEvents.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return {
    complaint_id: issue.complaint_id || `CC-2026-${String(issue.id || '').substring(0, 6)}`,
    issue_id: issue.id,
    current_status: issue.status,
    current_stage: currentStageId,
    is_overdue: !!issue.is_overdue,
    is_escalated: !!issue.is_escalated,
    escalation_level: issue.escalation_level || 0,
    sla_deadline: issue.sla_deadline || null,
    sla_deadline_formatted: issue.sla_deadline_formatted || (issue.sla_deadline ? formatTamilNaduDate(issue.sla_deadline) : null),
    stages,
    audit_events: auditEvents
  };
}
