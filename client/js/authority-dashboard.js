let lastLoadedUserIdAuthDashboard = null;

const bootstrapDashboard = () => {
  // Check authorization and bootstrap page loading
  window.addEventListener('auth-change', (e) => {
    const user = getCurrentUser();
    const role = getUserRole();
    if (!user || (role !== 'authority' && role !== 'admin')) {
      window.authRouter.redirectToLogin('authority');
    } else {
      if (user.id === lastLoadedUserIdAuthDashboard) {
        // Prevent duplicate calls that cause layout flickering
        return;
      }
      lastLoadedUserIdAuthDashboard = user.id;
      loadDashboardTelemetry();
    }
  });

  // Check if session is already active
  const user = getCurrentUser();
  if (user) {
    lastLoadedUserIdAuthDashboard = user.id;
    loadDashboardTelemetry();
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrapDashboard);
} else {
  bootstrapDashboard();
}

async function loadDashboardTelemetry() {
  await Promise.all([
    loadStats(),
    loadRecentAssigned(),
    loadPriorityCases(),
    loadActivityLog()
  ]);
}

// Fetch stats via API
async function loadStats() {
  const { data: stats, error } = await window.API.getAuthorityStats();
  if (error || !stats) {
    console.error("Failed to load authority caseload stats:", error);
    return;
  }

  const pendingEl = document.getElementById('stats-pending');
  const assignedEl = document.getElementById('stats-assigned');
  const progressEl = document.getElementById('stats-progress');
  const resolvedTodayEl = document.getElementById('stats-resolved-today');

  if (pendingEl) pendingEl.textContent = stats.pending || 0;
  if (assignedEl) assignedEl.textContent = stats.assigned || 0;
  if (progressEl) progressEl.textContent = stats.inProgress || 0;
  if (resolvedTodayEl) resolvedTodayEl.textContent = stats.resolvedToday || 0;
}

// Fetch and render 3 most recent assigned cases
async function loadRecentAssigned() {
  const container = document.getElementById('recent-assigned-list');
  if (!container) return;

  const user = getCurrentUser();
  if (!user) return;

  const { data: issues, error } = await window.API.getIssues({
    assigned_to: user.id
  });

  if (error || !issues) {
    container.innerHTML = `<div style="padding: 1.5rem; text-align: center; color: var(--text-muted); font-size: 0.85rem;">Failed to load active assignments.</div>`;
    return;
  }

  // Filter for active (non-resolved, non-rejected) and sort newest first
  const activeCases = issues
    .filter(i => i.status !== 'resolved' && i.status !== 'verified' && i.status !== 'rejected')
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const recent = activeCases.slice(0, 3);

  if (recent.length === 0) {
    container.innerHTML = `
      <div style="background-color: var(--bg-surface); border: 1px dashed var(--border-color); border-radius: var(--radius-md); padding: 2.5rem 1.5rem; text-align: center; color: var(--text-muted);">
        <i class="fa-solid fa-clipboard-check" style="font-size: 2rem; margin-bottom: 0.5rem; color: var(--slate-300); opacity:0.6;"></i>
        <p style="font-weight: 600; font-size: 0.88rem; color: var(--text-main);">All Clear!</p>
        <p style="font-size: 0.8rem; margin-top: 0.2rem;">You do not have any pending assigned complaints.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = recent.map(issue => {
    const dateStr = new Date(issue.created_at).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    
    return `
      <div class="case-preview-card" onclick="window.location.href='authority-issue-details.html?id=${issue.id}'">
        <div>
          <div class="case-title">${escapeHTML(issue.title)}</div>
          <div class="case-meta">
            <span class="badge badge-category ${issue.category}">${window.formatCategoryName(issue.category)}</span>
            <span style="margin-left: 0.5rem;">Reported: ${dateStr}</span>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <span class="badge badge-status ${issue.status}">${issue.status.replace('_', ' ')}</span>
          <i class="fa-solid fa-chevron-right" style="font-size: 0.8rem; color: var(--text-muted);"></i>
        </div>
      </div>
    `;
  }).join('');
}

// Fetch and render priority (most upvoted pending) cases
async function loadPriorityCases() {
  const container = document.getElementById('priority-cases-list');
  if (!container) return;

  try {
    const { data: issues, error } = await window.API.getIssues({ status: 'pending' });

    if (error || !issues) {
      container.innerHTML = `<div style="padding: 1.5rem; text-align: center; color: var(--text-muted); font-size: 0.85rem;">Failed to load priority cases.</div>`;
      return;
    }

    // Sort by upvotes count descending
    const priority = issues
      .sort((a, b) => (b.upvotes_count || 0) - (a.upvotes_count || 0))
      .slice(0, 3);

    if (priority.length === 0) {
      container.innerHTML = `
        <div style="background-color: var(--bg-surface); border: 1px dashed var(--border-color); border-radius: var(--radius-md); padding: 2.5rem 1.5rem; text-align: center; color: var(--text-muted);">
          <p style="font-weight: 600; font-size: 0.88rem; color: var(--text-main);">No Priority Cases</p>
          <p style="font-size: 0.8rem; margin-top: 0.2rem;">All pending cases are currently prioritized or assigned.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = priority.map(issue => {
      const dateStr = new Date(issue.created_at).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
      
      return `
        <div class="case-preview-card" onclick="window.location.href='authority-issue-details.html?id=${issue.id}'">
          <div>
            <div class="case-title">${escapeHTML(issue.title)}</div>
            <div class="case-meta">
              <span class="badge badge-category ${issue.category}">${window.formatCategoryName(issue.category)}</span>
              <span style="margin-left: 0.5rem; font-weight: 600; color: var(--primary);"><i class="fa-solid fa-thumbs-up"></i> ${issue.upvotes_count || 0} Upvotes</span>
              <span style="margin-left: 0.5rem;">Reported: ${dateStr}</span>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <span class="badge badge-status ${issue.status}">${issue.status.replace('_', ' ')}</span>
            <i class="fa-solid fa-chevron-right" style="font-size: 0.8rem; color: var(--text-muted);"></i>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error("Failed to load priority cases:", err);
    container.innerHTML = `<div style="padding: 1.5rem; text-align: center; color: var(--text-muted); font-size: 0.85rem;">Failed to load priority cases.</div>`;
  }
}

// Fetch and render authority activity log
async function loadActivityLog() {
  const container = document.getElementById('activity-log-timeline');
  if (!container) return;

  try {
    if (!window.API || typeof window.API.getNotifications !== 'function') {
      container.innerHTML = `<div style="color: var(--text-muted); font-size: 0.85rem; padding: 1rem 0; text-align: center;">No activity logged yet.</div>`;
      return;
    }
    const { data: notifications, error } = await window.API.getNotifications();
    if (error || !notifications) {
      container.innerHTML = `<div style="color: var(--text-muted); font-size: 0.85rem; padding: 1rem 0; text-align: center;">No activity logged yet.</div>`;
      return;
    }

    const logs = notifications.slice(0, 4);
    if (logs.length === 0) {
      container.innerHTML = `<div style="color: var(--text-muted); font-size: 0.85rem; padding: 1rem 0; text-align: center;">No activity logged yet.</div>`;
      return;
    }

    // A helper for times
    const formatTimeLog = (date) => {
      const seconds = Math.floor((new Date() - date) / 1000);
      let interval = Math.floor(seconds / 3600);
      if (interval >= 1) return interval + "h ago";
      interval = Math.floor(seconds / 60);
      if (interval >= 1) return interval + "m ago";
      return "just now";
    };

    container.innerHTML = logs.map(n => {
      const timeAgoStr = formatTimeLog(new Date(n.created_at));
      let dotColor = '#8b5cf6'; // default purple/neutral
      if (n.title.toLowerCase().includes('resolved')) {
        dotColor = '#10b981'; // emerald
      } else if (n.title.toLowerCase().includes('assigned') || n.title.toLowerCase().includes('progress')) {
        dotColor = '#f59e0b'; // amber
      }

      return `
        <div style="position: relative;">
          <span style="position: absolute; left: -25px; top: 4px; width: 10px; height: 10px; border-radius: 50%; background: ${dotColor}; border: 2px solid var(--bg-surface); box-shadow: 0 0 0 1px var(--border-color);"></span>
          <div style="display: flex; flex-direction: column; gap: 0.15rem;">
            <span style="font-size: 0.82rem; font-weight: 600; color: var(--text-main);">${escapeHTML(n.title)}</span>
            <span style="font-size: 0.72rem; color: var(--text-muted);">${escapeHTML(n.message)}</span>
            <span style="font-size: 0.68rem; color: var(--text-muted);">${timeAgoStr}</span>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error("Failed to load activity logs:", err);
    container.innerHTML = `<div style="color: var(--text-muted); font-size: 0.85rem; padding: 1rem 0; text-align: center;">No activity logged yet.</div>`;
  }
}

// Escape helper
function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}
