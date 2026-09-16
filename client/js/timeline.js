/**
 * CrowdCity Complaint Timeline Component (Shared)
 * 
 * Provides a clear, professional, mobile-first 5-stage complaint lifecycle visualization:
 * SUBMITTED -> VERIFIED -> ASSIGNED -> IN PROGRESS -> RESOLVED
 * 
 * Rules:
 * - 100% data-driven from real complaint data and status_history logs.
 * - ZERO fake timestamps.
 * - Distinguishes explicit historical timestamps from verified lifecycle progression.
 * - Supports Citizen & Authority roles with appropriate RBAC visibility.
 * - Full Dark Mode (AMOLED true black) and Light Mode support.
 * - Localized via window.i18n (Tamil & English).
 */

(function () {
  'use strict';

  function escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function t(key, fallback) {
    if (window.i18n && typeof window.i18n.t === 'function') {
      const val = window.i18n.t(key);
      if (val && val !== key) return val;
    }
    return fallback;
  }

  function formatTimestamp(ts) {
    if (!ts) return null;
    if (typeof window.formatDate === 'function') {
      try {
        return window.formatDate(new Date(ts));
      } catch (e) {}
    }
    try {
      const d = new Date(ts);
      if (isNaN(d.getTime())) return null;
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (e) {
      return null;
    }
  }

  const ComplaintTimeline = {
    /**
     * Derives deterministic timeline data from an issue and its history logs.
     * Uses backend precomputed issue.timeline if available, else evaluates locally.
     */
    buildTimelineData: function (issue) {
      if (!issue) return null;
      if (issue.timeline && Array.isArray(issue.timeline.stages)) {
        return issue.timeline;
      }

      const status = (issue.status || 'pending').toLowerCase();
      const logs = Array.isArray(issue.history) ? [...issue.history] : [];
      logs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      const submittedLog = logs.find(l => l.status === 'pending') || null;
      const assignedLog = logs.find(l => l.status === 'assigned') || null;
      const inProgressLogs = logs.filter(l => l.status === 'in_progress');
      const inProgressLog = inProgressLogs.length > 0 ? inProgressLogs[0] : null;
      const latestProgLog = inProgressLogs.length > 0 ? inProgressLogs[inProgressLogs.length - 1] : null;
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

      const authorityName =
        issue.assigned_officer?.full_name ||
        assignedLog?.profiles?.full_name ||
        issue.authority_resolution?.administrativeAuthority?.officeName ||
        issue.ai_department ||
        'Administrative Authority';

      // 1. SUBMITTED
      const subTs = submittedLog?.created_at || issue.created_at;
      const stageSubmitted = {
        id: 'submitted',
        label: t('timeline_stage_submitted', 'Submitted'),
        state: 'completed',
        timestamp: subTs,
        timestamp_formatted: formatTimestamp(subTs),
        notes: submittedLog?.notes || t('timeline_submitted_desc', 'Complaint registered in public civic database.'),
        actor_name: issue.reporter?.full_name || submittedLog?.profiles?.full_name || 'Citizen Reporter',
        is_inferred: false
      };

      // 2. VERIFIED
      let verState = 'pending';
      let verTs = null;
      let verNotes = null;
      let verActor = null;
      let verInferred = false;

      if (preAssignmentVerifiedLog) {
        verState = isTriageVerified ? 'current' : 'completed';
        verTs = preAssignmentVerifiedLog.created_at;
        verNotes = preAssignmentVerifiedLog.notes || preAssignmentVerifiedLog.remarks || t('timeline_verified_desc', 'Complaint verified and approved for action.');
        verActor = preAssignmentVerifiedLog.profiles?.full_name || 'Municipal Officer';
      } else if (isTriageVerified) {
        verState = 'current';
        verTs = issue.updated_at || null;
        verNotes = issue.official_remarks || t('timeline_verified_desc', 'Complaint verified and approved for action.');
        verActor = 'Municipal Officer';
      } else if (['assigned', 'in_progress', 'resolved', 'verified'].includes(status) || hasAssigned || isPostResolutionVerified) {
        verState = 'completed';
        verTs = null;
        verNotes = t('timeline_verified_desc', 'Complaint verified and approved for action.');
        verActor = 'Administrative Authority';
        verInferred = true;
      }

      const stageVerified = {
        id: 'verified',
        label: t('timeline_stage_verified', 'Verified'),
        state: verState,
        timestamp: verTs,
        timestamp_formatted: formatTimestamp(verTs),
        notes: verNotes || t('timeline_verified_desc', 'Complaint verified and approved for action.'),
        actor_name: verActor,
        is_inferred: verInferred
      };

      // 3. ASSIGNED
      let assState = 'pending';
      let assTs = null;
      let assNotes = null;
      let assActor = null;
      let assInferred = false;

      if (assignedLog) {
        assState = status === 'assigned' ? 'current' : (['in_progress', 'resolved'].includes(status) || isPostResolutionVerified ? 'completed' : 'pending');
        assTs = assignedLog.created_at;
        assNotes = assignedLog.notes || `${t('timeline_assigned_desc', 'Assigned to department & field officer.')} (${authorityName})`;
        assActor = assignedLog.profiles?.full_name || authorityName;
      } else if (issue.assigned_to || status === 'assigned') {
        assState = status === 'assigned' ? 'current' : (['in_progress', 'resolved'].includes(status) || isPostResolutionVerified ? 'completed' : 'pending');
        assTs = issue.assigned_at || issue.updated_at || null;
        assNotes = `${t('timeline_assigned_desc', 'Assigned to department & field officer.')} (${authorityName})`;
        assActor = authorityName;
      } else if (['in_progress', 'resolved'].includes(status) || isPostResolutionVerified) {
        assState = 'completed';
        assTs = null;
        assNotes = `${t('timeline_assigned_desc', 'Assigned to department & field officer.')} (${authorityName})`;
        assActor = authorityName;
        assInferred = true;
      }

      const stageAssigned = {
        id: 'assigned',
        label: t('timeline_stage_assigned', 'Assigned'),
        state: assState,
        timestamp: assTs,
        timestamp_formatted: formatTimestamp(assTs),
        notes: assNotes || t('timeline_assigned_desc', 'Assigned to department & field officer.'),
        authority_name: authorityName,
        actor_name: assActor,
        is_inferred: assInferred
      };

      // 4. IN PROGRESS
      let progState = 'pending';
      let progTs = null;
      let progNotes = null;
      let progActor = null;
      let progInferred = false;

      if (inProgressLog) {
        progState = status === 'in_progress' ? 'current' : (['resolved'].includes(status) || isPostResolutionVerified ? 'completed' : 'pending');
        progTs = latestProgLog?.created_at || inProgressLog.created_at;
        progNotes = latestProgLog?.notes || inProgressLog.notes || issue.official_remarks || t('timeline_in_progress_desc', 'Field inspection & resolution work underway.');
        progActor = latestProgLog?.profiles?.full_name || inProgressLog.profiles?.full_name || authorityName;
      } else if (status === 'in_progress') {
        progState = 'current';
        progTs = issue.updated_at || null;
        progNotes = issue.official_remarks || t('timeline_in_progress_desc', 'Field inspection & resolution work underway.');
        progActor = authorityName;
      } else if (status === 'resolved' || isPostResolutionVerified) {
        progState = 'completed';
        progTs = null;
        progNotes = t('timeline_in_progress_desc', 'Field inspection & resolution work underway.');
        progActor = authorityName;
        progInferred = true;
      }

      const stageInProgress = {
        id: 'in_progress',
        label: t('timeline_stage_in_progress', 'In Progress'),
        state: progState,
        timestamp: progTs,
        timestamp_formatted: formatTimestamp(progTs),
        notes: progNotes || t('timeline_in_progress_desc', 'Field inspection & resolution work underway.'),
        actor_name: progActor,
        is_inferred: progInferred
      };

      // 5. RESOLVED
      let resState = 'pending';
      let resTs = null;
      let resNotes = null;
      let resActor = null;
      let resProof = null;

      if (resolvedLog) {
        resState = 'completed';
        resTs = resolvedLog.created_at;
        resNotes = resolvedLog.notes || issue.completion_notes || (isPostResolutionVerified ? t('timeline_resolved_verified_desc', 'Resolution approved and verified by citizen reporter.') : t('timeline_resolved_desc', 'Resolution work completed with evidence proof.'));
        resActor = resolvedLog.profiles?.full_name || authorityName;
        resProof = issue.completion_proof_url || null;
      } else if (status === 'resolved' || isPostResolutionVerified || (hasResolvedProof && ['assigned', 'in_progress', 'resolved', 'verified'].includes(status))) {
        resState = 'completed';
        resTs = issue.resolved_at || (status === 'resolved' ? issue.updated_at : null) || null;
        resNotes = issue.completion_notes || issue.official_remarks || (isPostResolutionVerified ? t('timeline_resolved_verified_desc', 'Resolution approved and verified by citizen reporter.') : t('timeline_resolved_desc', 'Resolution work completed with evidence proof.'));
        resActor = authorityName;
        resProof = issue.completion_proof_url || null;
      }

      const stageResolved = {
        id: 'resolved',
        label: t('timeline_stage_resolved', 'Resolved'),
        state: resState,
        timestamp: resTs,
        timestamp_formatted: formatTimestamp(resTs),
        notes: resNotes || t('timeline_resolved_desc', 'Resolution work completed with evidence proof.'),
        actor_name: resActor,
        proof_url: resProof,
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
          return orderA - orderB;
        }

        // 2. Both lack timestamps:
        if (timeA === null && timeB === null) {
          if (a.state !== 'pending' && b.state === 'pending') return -1;
          if (a.state === 'pending' && b.state !== 'pending') return 1;
          return orderA - orderB;
        }

        // 3. One has timestamp, the other lacks timestamp:
        if (a.state === 'pending') return 1;
        if (b.state === 'pending') return -1;

        return orderA - orderB;
      });

      const auditEvents = [];
      const firstProgIdx = logs.findIndex(l => l.status === 'in_progress');
      logs.forEach((log, idx) => {
        if (['overdue', 'escalated', 'rejected', 'withdrawn', 'timeline_update'].includes(log.status)) {
          auditEvents.push({
            id: log.id,
            event_type: log.status,
            timestamp: log.created_at,
            timestamp_formatted: formatTimestamp(log.created_at),
            notes: log.notes || log.remarks || '',
            actor_name: log.profiles?.full_name || 'Municipal System',
            actor_role: log.profiles?.role || 'system'
          });
        } else if (log.status === 'in_progress' && idx > firstProgIdx && log.notes) {
          auditEvents.push({
            id: log.id,
            event_type: 'authority_update',
            timestamp: log.created_at,
            timestamp_formatted: formatTimestamp(log.created_at),
            notes: log.notes,
            actor_name: log.profiles?.full_name || authorityName,
            actor_role: 'authority'
          });
        }
      });

      if (postResolutionVerifiedLog) {
        auditEvents.push({
          id: postResolutionVerifiedLog.id,
          event_type: 'resolution_verified',
          timestamp: postResolutionVerifiedLog.created_at,
          timestamp_formatted: formatTimestamp(postResolutionVerifiedLog.created_at),
          notes: postResolutionVerifiedLog.notes || 'Resolution approved and verified by citizen reporter.',
          actor_name: postResolutionVerifiedLog.profiles?.full_name || 'Citizen Reporter',
          actor_role: 'citizen'
        });
      }

      auditEvents.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      return {
        complaint_id: issue.complaint_id || `CC-2026-${String(issue.id || '').substring(0, 6)}`,
        issue_id: issue.id,
        current_status: status,
        stages: stages,
        audit_events: auditEvents
      };
    },

    /**
     * Renders the modern, clean, accessible complaint timeline into the specified container.
     * 
     * @param {HTMLElement} containerEl - Target DOM container
     * @param {Object} issue - Complaint issue record
     * @param {Object} options - { role: 'citizen' | 'authority' }
     */
    render: function (containerEl, issue, options = {}) {
      if (!containerEl || !issue) return;

      const data = this.buildTimelineData(issue);
      if (!data || !Array.isArray(data.stages)) return;

      const isAuthority = options.role === 'authority';

      const html = `
        <div class="complaint-timeline-widget">
          
          <div class="timeline-header-bar">
            <div class="timeline-header-left">
              <i class="fa-solid fa-timeline" style="color: var(--primary);"></i>
              <h4 class="timeline-header-title">${isAuthority ? t('case_activity_timeline', 'CASE ACTIVITY TIMELINE') : t('complaint_timeline', 'Complaint Timeline')}</h4>
            </div>
            <div class="timeline-header-right">
              <span class="timeline-cid-tag"><i class="fa-solid fa-hashtag"></i> ${escapeHTML(data.complaint_id)}</span>
            </div>
          </div>

          <div class="timeline-track-container">
            ${data.stages.map((stage, idx) => {
              const isLast = idx === data.stages.length - 1;
              const stateClass = `state-${stage.state}`;

              let iconHtml = '<i class="fa-solid fa-circle" style="font-size: 0.5rem;"></i>';
              if (stage.state === 'completed') {
                iconHtml = '<i class="fa-solid fa-check"></i>';
              } else if (stage.state === 'current') {
                iconHtml = '<span class="timeline-pulse-dot"></span>';
              }

              let stateBadgeText = t('timeline_status_pending', 'Pending');
              let badgeClass = 'badge-timeline-pending';
              if (stage.state === 'completed') {
                stateBadgeText = t('timeline_status_completed', 'Completed');
                badgeClass = 'badge-timeline-completed';
              } else if (stage.state === 'current') {
                stateBadgeText = t('timeline_status_current', 'Current');
                badgeClass = 'badge-timeline-current';
              }

              return `
                <div class="timeline-step-row ${stateClass}" data-stage="${stage.id}">
                  <div class="timeline-node-column">
                    <div class="timeline-node-circle ${stage.state}">
                      ${iconHtml}
                    </div>
                    ${!isLast ? '<div class="timeline-connector-line"></div>' : ''}
                  </div>

                  <div class="timeline-card-box ${stage.state}">
                    <div class="timeline-card-header">
                      <div class="timeline-card-title-group">
                        <span class="timeline-step-name">${escapeHTML(stage.label)}</span>
                        <span class="timeline-badge ${badgeClass}">${stateBadgeText}</span>
                      </div>
                      ${stage.timestamp_formatted ? `
                        <div class="timeline-timestamp">
                          <i class="fa-regular fa-clock"></i> ${stage.timestamp_formatted}
                        </div>
                      ` : ''}
                    </div>

                    ${stage.is_inferred && stage.state === 'completed' ? `
                      <div class="timeline-inferred-pill">
                        <i class="fa-solid fa-circle-check"></i> ${t('timeline_inferred_note', 'Status confirmed via lifecycle progression')}
                      </div>
                    ` : ''}

                    ${stage.notes ? `
                      <p class="timeline-notes-text">${escapeHTML(stage.notes)}</p>
                    ` : ''}

                    ${stage.actor_name && stage.state !== 'pending' ? `
                      <div class="timeline-actor-row">
                        <span class="timeline-actor-badge">
                          <i class="fa-solid fa-user-shield"></i> ${escapeHTML(stage.actor_name)}
                        </span>
                        ${stage.authority_name && stage.authority_name !== stage.actor_name ? `
                          <span class="timeline-authority-tag">
                            <i class="fa-solid fa-building-columns"></i> ${escapeHTML(stage.authority_name)}
                          </span>
                        ` : ''}
                      </div>
                    ` : ''}

                    ${stage.proof_url ? `
                      <div class="timeline-proof-container">
                        <span class="timeline-proof-label"><i class="fa-solid fa-camera"></i> ${t('timeline_resolution_proof', 'Resolution Proof')}:</span>
                        <a href="${escapeHTML(stage.proof_url)}" target="_blank" rel="noopener noreferrer" class="timeline-proof-link">
                          <img src="${escapeHTML(stage.proof_url)}" alt="Resolution Proof" class="timeline-proof-thumb" / decoding="async">
                          <span>${t('timeline_view_proof', 'View Proof Photo')} <i class="fa-solid fa-up-right-from-square"></i></span>
                        </a>
                      </div>
                    ` : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>

          ${data.audit_events && data.audit_events.length > 0 ? `
            <div class="timeline-audit-section">
              <div class="timeline-audit-header">
                <i class="fa-solid fa-shield-halved" style="color: var(--text-muted); font-size: 0.8rem;"></i>
                <span>${t('timeline_official_remarks', 'Official Action Notes')} (${data.audit_events.length})</span>
              </div>
              <div class="timeline-audit-list">
                ${data.audit_events.map(ev => {
                  let alertClass = 'audit-milestone-info';
                  let icon = 'fa-circle-info';
                  let eventLabel = ev.event_type.replace('_', ' ').toUpperCase();

                  if (ev.event_type === 'overdue') {
                    alertClass = 'audit-milestone-danger';
                    icon = 'fa-triangle-exclamation';
                    eventLabel = t('timeline_overdue_alert', 'SLA Response Deadline Elapsed');
                  } else if (ev.event_type === 'escalated') {
                    alertClass = 'audit-milestone-warning';
                    icon = 'fa-arrow-trend-up';
                    eventLabel = t('timeline_escalated_alert', 'Escalated to Senior Authority');
                  } else if (ev.event_type === 'rejected') {
                    alertClass = 'audit-milestone-danger';
                    icon = 'fa-circle-xmark';
                  }

                  return `
                    <div class="timeline-audit-card ${alertClass}">
                      <div class="timeline-audit-top">
                        <span class="timeline-audit-type"><i class="fa-solid ${icon}"></i> ${escapeHTML(eventLabel)}</span>
                        ${ev.timestamp_formatted ? `<span class="timeline-audit-time">${ev.timestamp_formatted}</span>` : ''}
                      </div>
                      ${ev.notes ? `<p class="timeline-audit-notes">${escapeHTML(ev.notes)}</p>` : ''}
                      ${isAuthority && ev.actor_name ? `<div class="timeline-audit-actor">By: ${escapeHTML(ev.actor_name)}</div>` : ''}
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          ` : ''}

        </div>
      `;

      containerEl.innerHTML = html;
    }
  };

  window.ComplaintTimeline = ComplaintTimeline;
})();
