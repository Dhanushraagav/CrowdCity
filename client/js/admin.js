// CrowdCity AI v2.4 - Modular Authority Portal Controller
(function() {
  'use strict';

  // Global cache objects
  let currentUsers = [];
  let currentComplaints = [];
  let allDepartments = [];
  let categoriesChart = null;
  let statusesChart = null;
  let performanceChart = null;

  // ----------------------------------------------------
  // HELPER: Show Alert Notification Toast
  // ----------------------------------------------------
  function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    container.className = `toast-banner ${type}`;
    container.innerHTML = `
      <i class="fa-solid ${type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}"></i>
      <span>${message}</span>
    `;
    container.classList.remove('hidden');
    
    // Auto-hide after 4 seconds
    setTimeout(() => {
      container.classList.add('hidden');
    }, 4000);
  }

  // Escape HTML helper
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

  // Check authorization
  function checkAccess() {
    const role = typeof getUserRole === 'function' ? getUserRole() : null;
    if (!role || (role !== 'authority' && role !== 'admin')) {
      showToast("Access Denied: Administrative access is required to view this panel.", "error");
      if (window.authRouter) {
        window.authRouter.redirectToLogin('authority');
      } else {
        window.location.href = 'authority-login.html';
      }
      return false;
    }
    // Set is-admin state on body to conditionally display panels
    if (role === 'admin') {
      document.body.classList.add('is-admin');
    }
    return true;
  }

  // ----------------------------------------------------
  // SERVICE 1: DashboardService ( Caseload & KPIs )
  // ----------------------------------------------------
  window.DashboardService = {
    init: async function() {
      // Load all dashboard widgets in parallel for faster initial render
      await Promise.allSettled([
        this.loadKPIs(),
        this.loadRecentAssigned(),
        this.loadPriorityCases(),
        this.loadActivityLog()
      ]);
    },

    loadKPIs: async function() {
      const totalEl = document.getElementById('kpi-total');
      const pendingEl = document.getElementById('kpi-pending');
      const resolvedEl = document.getElementById('kpi-resolved');
      const staffEl = document.getElementById('kpi-staff');

      const catContainer = document.getElementById('chart-categories-container');
      const statContainer = document.getElementById('chart-statuses-container');
      const perfContainer = document.getElementById('chart-performance-container');

      // Reset to skeletons
      if (totalEl) totalEl.innerHTML = '<div class="skeleton" style="width: 40px; height: 1.5rem;"></div>';
      if (pendingEl) pendingEl.innerHTML = '<div class="skeleton" style="width: 40px; height: 1.5rem;"></div>';
      if (resolvedEl) resolvedEl.innerHTML = '<div class="skeleton" style="width: 40px; height: 1.5rem;"></div>';
      if (staffEl) staffEl.innerHTML = '<div class="skeleton" style="width: 40px; height: 1.5rem;"></div>';

      if (catContainer) catContainer.innerHTML = '<div class="skeleton-shimmer skeleton-chart" style="height: 260px;"></div>';
      if (statContainer) statContainer.innerHTML = '<div class="skeleton-shimmer skeleton-chart" style="height: 260px;"></div>';
      if (perfContainer) perfContainer.innerHTML = '<div class="skeleton-shimmer skeleton-chart" style="height: 260px;"></div>';

      try {
        const analyticsPromise = API.getAdminAnalytics();
        const usersPromise = API.getAllUsers();

        analyticsPromise.then(analyticsRes => {
          if (analyticsRes.error) throw new Error(analyticsRes.error);
          const analytics = analyticsRes.data;

          if (totalEl) totalEl.textContent = analytics.totalComplaints;
          if (pendingEl) pendingEl.textContent = analytics.byStatus.pending || 0;
          if (resolvedEl) resolvedEl.textContent = analytics.byStatus.resolved || 0;

          // Re-create canvases and render
          if (catContainer) catContainer.innerHTML = '<canvas id="chart-categories"></canvas>';
          if (statContainer) statContainer.innerHTML = '<canvas id="chart-statuses"></canvas>';
          if (perfContainer) perfContainer.innerHTML = '<canvas id="chart-performance"></canvas>';

          this.renderCharts(analytics);
        }).catch(err => {
          console.error("Dashboard statistics load failed:", err);
          const errorRetryHtml = `
            <div class="error-retry-card" style="background-color: var(--bg-surface); border: 1px dashed #ef4444; border-radius: var(--radius-md); padding: 1.5rem; text-align: center; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center;">
              <i class="fa-solid fa-triangle-exclamation" style="color: #ef4444; font-size: 1.5rem; margin-bottom: 0.5rem;"></i>
              <p style="font-weight: 600; font-size: 0.88rem; color: var(--text-main); margin: 0;">Analytics temporarily unavailable</p>
              <button onclick="window.DashboardService.loadKPIs()" class="btn" style="margin-top:0.75rem; padding: 0.4rem 0.8rem; font-size: 0.75rem; border: 1px solid var(--border-color); background: var(--bg-surface); color: var(--text-main); cursor: pointer; border-radius: var(--radius-sm);">
                <i class="fa-solid fa-rotate-right"></i> Retry
              </button>
            </div>
          `;
          if (catContainer) catContainer.innerHTML = errorRetryHtml;
          if (statContainer) statContainer.innerHTML = errorRetryHtml;
          if (perfContainer) perfContainer.innerHTML = errorRetryHtml;

          if (totalEl) totalEl.innerHTML = '<span style="color:#ef4444;"><i class="fa-solid fa-triangle-exclamation"></i></span>';
          if (pendingEl) pendingEl.innerHTML = '<span style="color:#ef4444;"><i class="fa-solid fa-triangle-exclamation"></i></span>';
          if (resolvedEl) resolvedEl.innerHTML = '<span style="color:#ef4444;"><i class="fa-solid fa-triangle-exclamation"></i></span>';
        });

        usersPromise.then(usersRes => {
          if (usersRes.error) throw new Error(usersRes.error);
          const count = (usersRes.data || []).filter(u => u.role === 'authority' || u.role === 'admin').length;
          if (staffEl) staffEl.textContent = count;
        }).catch(err => {
          console.error("Dashboard users load failed:", err);
          if (staffEl) staffEl.innerHTML = '<span style="color:#ef4444;"><i class="fa-solid fa-triangle-exclamation"></i></span>';
        });
      } catch (err) {
        console.error("loadKPIs outer error:", err);
      }
    },

    renderCharts: function(analytics) {
      if (categoriesChart) categoriesChart.destroy();
      if (statusesChart) statusesChart.destroy();
      if (performanceChart) performanceChart.destroy();

      const textColor = '#334155';
      const gridColor = '#cbd5e1';
      const isDarkMode = document.documentElement.classList.contains('dark-theme');

      // 1. Categories Chart
      const catCtx = document.getElementById('chart-categories');
      if (catCtx) {
        const catsData = analytics.byCategory || {};
        const labels = Object.keys(catsData).map(k => window.formatCategoryName ? window.formatCategoryName(k) : k.toUpperCase());
        const data = Object.values(catsData);
        const categoryColors = {
          roads: '#d97706', streetlights: '#f59e0b', water_supply: '#3b82f6', drainage: '#06b6d4',
          garbage: '#10b981', traffic: '#ef4444', public_property: '#8b5cf6', parks: '#22c55e',
          sanitation: '#ec4899', safety_hazard: '#f97316', environment: '#14b8a6', other: '#64748b',
          pothole: '#d97706', leakage: '#3b82f6', streetlight: '#f59e0b', road: '#64748b'
        };
        const colors = Object.keys(catsData).map(k => categoryColors[k.toLowerCase()] || categoryColors.other);

        categoriesChart = new Chart(catCtx, {
          type: 'doughnut',
          data: {
            labels: labels,
            datasets: [{
              data: data,
              backgroundColor: colors,
              borderWidth: isDarkMode ? 2 : 1,
              borderColor: isDarkMode ? '#0f1115' : '#ffffff'
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { position: 'bottom', labels: { color: textColor, font: { family: 'Inter', size: 10 } } }
            }
          }
        });
      }

      // 2. Statuses Chart
      const statusCtx = document.getElementById('chart-statuses');
      if (statusCtx) {
        const statusData = analytics.byStatus || {};
        const labels = ['Pending', 'Assigned', 'In Progress', 'Resolved', 'Rejected'];
        const data = [
          statusData.pending || 0,
          statusData.assigned || 0,
          statusData.in_progress || 0,
          statusData.resolved || 0,
          statusData.rejected || 0
        ];

        statusesChart = new Chart(statusCtx, {
          type: 'bar',
          data: {
            labels: labels,
            datasets: [{
              label: 'Complaints',
              data: data,
              backgroundColor: ['#f59e0b', '#3b82f6', '#8b5cf6', '#10b981', '#ef4444'],
              borderRadius: 6
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { grid: { display: false }, ticks: { color: textColor } },
              y: { grid: { color: gridColor }, ticks: { color: textColor, precision: 0 } }
            }
          }
        });
      }

      // 3. Performance Chart
      const perfCtx = document.getElementById('chart-performance');
      if (perfCtx) {
        const perfData = analytics.performance || [];
        perfData.sort((a, b) => b.resolvedCount - a.resolvedCount);
        const labels = perfData.map(p => p.name);
        const data = perfData.map(p => p.resolvedCount);

        performanceChart = new Chart(perfCtx, {
          type: 'bar',
          data: {
            labels: labels.length ? labels : ['No Resolutions Yet'],
            datasets: [{
              label: 'Resolved cases',
              data: data.length ? data : [0],
              backgroundColor: '#ec4899',
              borderRadius: 6
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { grid: { display: false }, ticks: { color: textColor } },
              y: { grid: { color: gridColor }, ticks: { color: textColor, precision: 0 } }
            }
          }
        });
      }
    },

    loadRecentAssigned: async function() {
      const container = document.getElementById('recent-assigned-list');
      if (!container) return;

      const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
      if (!user) return;

      const { data: issues, error } = await API.getIssues({ assigned_to: user.id });

      if (error || !issues) {
        container.innerHTML = `
          <div class="error-retry-card" style="background-color: var(--bg-surface); border: 1px dashed #ef4444; border-radius: var(--radius-md); padding: 1.5rem; text-align: center;">
            <i class="fa-solid fa-triangle-exclamation" style="color: #ef4444; font-size: 1.2rem; margin-bottom: 0.5rem;"></i>
            <p style="font-weight: 600; font-size: 0.82rem; color: var(--text-main); margin: 0;">Failed to load assignments</p>
            <button onclick="window.DashboardService.loadRecentAssigned()" class="btn" style="margin-top:0.75rem; padding: 0.3rem 0.6rem; font-size: 0.7rem; border: 1px solid var(--border-color); background: var(--bg-surface); color: var(--text-main); cursor: pointer; border-radius: var(--radius-sm);">
              <i class="fa-solid fa-rotate-right"></i> Retry
            </button>
          </div>
        `;
        return;
      }

      const activeCases = issues
        .filter(i => i.status !== 'resolved' && i.status !== 'verified' && i.status !== 'rejected')
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      const recent = activeCases.slice(0, 3);

      if (recent.length === 0) {
        container.innerHTML = `
          <div style="background-color: var(--bg-surface); border: 1px dashed var(--border-color); border-radius: var(--radius-md); padding: 1.5rem; text-align: center; color: var(--text-muted); font-size: 0.8rem;">
            <i class="fa-solid fa-clipboard-check" style="font-size: 1.5rem; margin-bottom: 0.35rem; color: var(--slate-300);"></i>
            <p style="font-weight: 600; color: var(--text-main); margin: 0;">All Clear!</p>
            <p style="margin: 0.2rem 0 0 0;">You have no active pending assignments.</p>
          </div>
        `;
        return;
      }

      container.innerHTML = recent.map(issue => {
        const dateStr = new Date(issue.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        const catName = window.formatCategoryName ? window.formatCategoryName(issue.category) : issue.category.toUpperCase();
        return `
          <div class="complaint-admin-card ${issue.is_emergency ? 'emergency-card-glow' : ''}" style="padding: 1rem; cursor: pointer;" onclick="window.location.hash='#complaints'">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-main);">
                  ${issue.is_emergency ? `<span class="badge-emergency"><i class="fa-solid fa-triangle-exclamation"></i> EMER</span> ` : ''}
                  ${escapeHTML(issue.title)}
                </div>
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;">
                  <span class="badge" style="background-color:var(--border-color); color:var(--text-main); font-size:0.65rem;">${catName}</span>
                  <span style="margin-left: 0.5rem;">Reported: ${dateStr}</span>
                </div>
              </div>
              <span class="badge badge-status ${issue.status}" style="font-size:0.65rem;">${issue.status.replace('_', ' ')}</span>
            </div>
          </div>
        `;
      }).join('');
    },

    loadPriorityCases: async function() {
      const container = document.getElementById('priority-cases-list');
      if (!container) return;

      try {
        const { data: issues, error } = await API.getIssues({ status: 'pending' });

        if (error || !issues) {
          container.innerHTML = `
            <div class="error-retry-card" style="background-color: var(--bg-surface); border: 1px dashed #ef4444; border-radius: var(--radius-md); padding: 1.5rem; text-align: center;">
              <i class="fa-solid fa-triangle-exclamation" style="color: #ef4444; font-size: 1.2rem; margin-bottom: 0.5rem;"></i>
              <p style="font-weight: 600; font-size: 0.82rem; color: var(--text-main); margin: 0;">Failed to load priority cases</p>
              <button onclick="window.DashboardService.loadPriorityCases()" class="btn" style="margin-top:0.75rem; padding: 0.3rem 0.6rem; font-size: 0.7rem; border: 1px solid var(--border-color); background: var(--bg-surface); color: var(--text-main); cursor: pointer; border-radius: var(--radius-sm);">
                <i class="fa-solid fa-rotate-right"></i> Retry
              </button>
            </div>
          `;
          return;
        }

        const priority = issues
          .sort((a, b) => (b.upvotes_count || 0) - (a.upvotes_count || 0))
          .slice(0, 2);

        if (priority.length === 0) {
          container.innerHTML = `
            <div style="background-color: var(--bg-surface); border: 1px dashed var(--border-color); border-radius: var(--radius-md); padding: 1.5rem; text-align: center; color: var(--text-muted); font-size: 0.8rem;">
              <p style="font-weight: 600; color: var(--text-main); margin: 0;">No Priority Cases</p>
              <p style="margin: 0.2rem 0 0 0;">All pending cases are delegated or assigned.</p>
            </div>
          `;
          return;
        }

        container.innerHTML = priority.map(issue => {
          const dateStr = new Date(issue.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
          const catName = window.formatCategoryName ? window.formatCategoryName(issue.category) : issue.category.toUpperCase();
          return `
            <div class="complaint-admin-card ${issue.is_emergency ? 'emergency-card-glow' : ''}" style="padding: 1rem; cursor: pointer;" onclick="window.location.hash='#complaints'">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <div style="font-weight: 700; font-size: 0.95rem; color: var(--text-main);">
                    ${issue.is_emergency ? `<span class="badge-emergency"><i class="fa-solid fa-triangle-exclamation"></i> EMER</span> ` : ''}
                    ${escapeHTML(issue.title)}
                  </div>
                  <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;">
                    <span class="badge" style="background-color:var(--border-color); color:var(--text-main); font-size:0.65rem;">${catName}</span>
                    <span style="margin-left: 0.5rem; color:var(--primary); font-weight:600;"><i class="fa-solid fa-thumbs-up"></i> ${issue.upvotes_count || 0}</span>
                    <span style="margin-left: 0.5rem;">Reported: ${dateStr}</span>
                  </div>
                </div>
                <span class="badge badge-status ${issue.status}" style="font-size:0.65rem;">${issue.status.replace('_', ' ')}</span>
              </div>
            </div>
          `;
        }).join('');
      } catch (err) {
        console.error("loadPriorityCases failed:", err);
      }
    },

    loadActivityLog: async function() {
      const container = document.getElementById('activity-log-timeline');
      if (!container) return;

      try {
        const { data: notifications, error } = await API.getNotifications();
        if (error || !notifications) {
          container.innerHTML = `
            <div class="error-retry-card" style="background-color: var(--bg-surface); border: 1px dashed #ef4444; border-radius: var(--radius-md); padding: 1rem; text-align: center;">
              <p style="font-weight: 600; font-size: 0.8rem; color: var(--text-main); margin: 0;">Failed to load activity</p>
              <button onclick="window.DashboardService.loadActivityLog()" class="btn" style="margin-top:0.5rem; padding: 0.25rem 0.5rem; font-size: 0.75rem;">
                <i class="fa-solid fa-rotate-right"></i> Retry
              </button>
            </div>
          `;
          return;
        }

        const logs = notifications.slice(0, 4);
        if (logs.length === 0) {
          container.innerHTML = `<div style="color: var(--text-muted); font-size: 0.8rem; padding: 1rem 0; text-align: center;">No activity logged yet.</div>`;
          return;
        }

        const formatTime = (date) => {
          const seconds = Math.floor((new Date() - date) / 1000);
          let interval = Math.floor(seconds / 3600);
          if (interval >= 1) return interval + "h ago";
          interval = Math.floor(seconds / 60);
          if (interval >= 1) return interval + "m ago";
          return "just now";
        };

        container.innerHTML = logs.map(n => {
          const timeAgo = formatTime(new Date(n.created_at));
          let dotColor = '#8b5cf6';
          if (n.title.toLowerCase().includes('resolved')) dotColor = '#10b981';
          else if (n.title.toLowerCase().includes('assigned') || n.title.toLowerCase().includes('progress')) dotColor = '#f59e0b';

          return `
            <div style="position: relative; padding-bottom: 0.5rem;">
              <span style="position: absolute; left: -29px; top: 4px; width: 8px; height: 8px; border-radius: 50%; background: ${dotColor}; border: 2px solid var(--bg-surface);"></span>
              <div style="display: flex; flex-direction: column;">
                <span style="font-size: 0.8rem; font-weight: 700; color: var(--text-main);">${escapeHTML(n.title)}</span>
                <span style="font-size: 0.72rem; color: var(--text-muted); margin-top: 0.1rem;">${escapeHTML(n.message)}</span>
                <span style="font-size: 0.65rem; color: var(--text-muted); margin-top: 0.15rem;">${timeAgo}</span>
              </div>
            </div>
          `;
        }).join('');
      } catch (err) {
        console.error("loadActivityLog failed:", err);
      }
    }
  };

  // ----------------------------------------------------
  // SERVICE 2: ComplaintService ( Queue & Actions )
  // ----------------------------------------------------
  window.ComplaintService = {
    init: async function() {
      await this.loadComplaints();
      this.bindFilters();
    },

    loadComplaints: async function() {
      const listEl = document.getElementById('admin-complaints-list');
      if (!listEl) return;

      listEl.innerHTML = `
        <div style="text-align: center; padding: 3rem; color: var(--text-muted); background-color:var(--bg-surface); border:1px solid var(--border-color); border-radius:var(--radius-md);">
          <i class="fa-solid fa-spinner fa-spin" style="margin-right:0.5rem; font-size:1.5rem;"></i> Loading complaints queue...
        </div>
      `;

      try {
        const issuesRes = await API.getIssues();
        const usersRes = await API.getAllUsers();

        if (issuesRes.error) throw new Error(issuesRes.error);
        if (usersRes.error) throw new Error(usersRes.error);

        currentComplaints = issuesRes.data || [];
        const authorities = (usersRes.data || []).filter(u => u.role === 'authority' || u.role === 'admin');
        this.renderComplaints(authorities);
      } catch (err) {
        console.error("ComplaintService load error:", err);
        listEl.innerHTML = `
          <div style="text-align: center; padding: 3rem;">
            <div class="error-retry-card" style="display:inline-block; background-color: var(--bg-surface); border: 1px dashed #ef4444; border-radius: var(--radius-md); padding: 1.5rem; text-align: center; max-width:400px;">
              <i class="fa-solid fa-triangle-exclamation" style="color: #ef4444; font-size: 1.5rem; margin-bottom: 0.5rem;"></i>
              <p style="font-weight: 600; font-size: 0.88rem; color: var(--text-main); margin: 0;">Failed to load complaints</p>
              <button onclick="window.ComplaintService.loadComplaints()" class="btn" style="margin-top:0.75rem; padding: 0.4rem 0.8rem; font-size: 0.75rem; border: 1px solid var(--border-color); background: var(--bg-surface); color: var(--text-main); cursor: pointer; border-radius: var(--radius-sm);">
                <i class="fa-solid fa-rotate-right"></i> Retry
              </button>
            </div>
          </div>
        `;
      }
    },

    renderComplaints: function(authorities) {
      const listEl = document.getElementById('admin-complaints-list');
      const activeFilterPill = document.querySelector('#admin-status-filters .filter-pill.active');
      const filterStatus = activeFilterPill ? activeFilterPill.getAttribute('data-status') : '';
      if (!listEl) return;

      const filtered = currentComplaints.filter(c => filterStatus === '' || c.status === filterStatus);

      if (filtered.length === 0) {
        listEl.innerHTML = `
          <div style="text-align: center; padding: 3rem; color: var(--text-muted); background-color:var(--bg-surface); border:1px solid var(--border-color); border-radius:var(--radius-md);">
            No complaints match the selected status filter.
          </div>
        `;
        return;
      }

      const catNames = {
        roads: 'Roads', streetlights: 'Streetlights', water_supply: 'Water Supply', drainage: 'Drainage',
        garbage: 'Garbage', traffic: 'Traffic', public_property: 'Public Property', parks: 'Parks',
        sanitation: 'Sanitation', safety_hazard: 'Safety Hazard', environment: 'Environment', other: 'Other',
        pothole: 'Roads', leakage: 'Water Supply', streetlight: 'Streetlights', road: 'Roads'
      };

      listEl.innerHTML = filtered.map(issue => {
        const dropdownOptions = authorities.map(auth => {
          const isSelected = issue.assigned_to === auth.id;
          return `<option value="${auth.id}" ${isSelected ? 'selected' : ''}>${auth.full_name} (${auth.role})</option>`;
        }).join('');

        const reporterName = issue.reporter ? (issue.reporter.full_name || 'Anonymous') : 'Anonymous';
        const statusText = issue.status ? issue.status.replace('_', ' ') : 'pending';

        return `
          <div class="complaint-admin-card ${issue.is_emergency ? 'emergency-card-glow' : ''}" id="card-${issue.id}">
            <div style="display:flex; justify-content:space-between; align-items:start; flex-wrap:wrap; gap:1rem;">
              <div>
                ${issue.is_emergency ? `<span class="badge" style="background-color: #ef4444; color: white; text-transform: uppercase; font-size: 0.72rem; margin-right: 0.5rem; display: inline-block; animation: pulse-red 1.5s infinite;"><i class="fa-solid fa-triangle-exclamation"></i> EMERGENCY</span>` : ''}
                <span class="badge" style="background-color: var(--primary); color: white; text-transform: uppercase; font-size: 0.72rem; margin-right: 0.5rem; display: inline-block;">
                  ${catNames[issue.category] || 'Other'}
                </span>
                <h3 style="font-size: 1.2rem; font-weight: 700; margin: 0.5rem 0 0.25rem 0;">${escapeHTML(issue.title)}</h3>
                <p style="color:var(--text-muted); font-size:0.88rem; margin:0; max-width:700px;">${escapeHTML(issue.description)}</p>
              </div>
              <span class="badge badge-status ${issue.status}" style="text-transform: uppercase; font-size: 0.72rem;">
                ${statusText}
              </span>
            </div>

            <div style="font-size:0.8rem; color:var(--text-muted); display:flex; gap:1.5rem; flex-wrap:wrap; margin-top:0.5rem; border-top: 1px solid var(--border-color); padding-top:0.5rem;">
              <span><i class="fa-solid fa-location-dot"></i> ${escapeHTML(issue.address || 'Address not listed')}</span>
              <span><i class="fa-solid fa-user"></i> Reported by: <strong>${escapeHTML(reporterName)}</strong></span>
              <span><i class="fa-solid fa-calendar-days"></i> ${new Date(issue.created_at).toLocaleDateString()}</span>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.75rem; flex-wrap:wrap; gap:1rem;">
              <div style="display:flex; align-items:center; gap:0.5rem;">
                <span style="font-size:0.8rem; font-weight:600;"><i class="fa-solid fa-user-gear"></i> Delegate:</span>
                <select class="form-select complaint-delegate-select" data-issue-id="${issue.id}" style="margin: 0; padding: 0.25rem 0.5rem; font-size: 0.8rem; width: auto; cursor:pointer;">
                  <option value="">-- Not Assigned --</option>
                  ${dropdownOptions}
                </select>
              </div>

              <div>
                <button class="btn btn-secondary btn-delete-complaint" data-issue-id="${issue.id}" style="padding: 0.3rem 0.6rem; font-size: 0.75rem; border-color: #fca5a5; color: #ef4444; border-radius:6px;">
                  <i class="fa-solid fa-trash-can"></i> Delete
                </button>
              </div>
            </div>
          </div>
        `;
      }).join('');

      this.bindCardActions(authorities);
    },

    bindCardActions: function(authorities) {
      document.querySelectorAll('.complaint-delegate-select').forEach(select => {
        select.addEventListener('change', async (e) => {
          const issueId = e.target.getAttribute('data-issue-id');
          const inspectorId = e.target.value;
          e.target.disabled = true;

          try {
            const assignRes = await API.assignIssue(issueId, inspectorId || null);
            if (assignRes.error) throw new Error(assignRes.error);
            showToast("Complaint delegated successfully!");
            await this.loadComplaints();
          } catch (err) {
            console.error("Delegate error:", err);
            showToast("Failed to delegate: " + err.message, "error");
            e.target.value = e.target.dataset.oldValue || '';
          } finally {
            e.target.disabled = false;
          }
        });
        select.dataset.oldValue = select.value;
      });

      document.querySelectorAll('.btn-delete-complaint').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const issueId = btn.getAttribute('data-issue-id');
          if (!confirm("Are you sure you want to permanently delete this complaint? This cannot be undone.")) return;

          btn.disabled = true;
          try {
            // Check if API has deleteIssue or direct client call
            const activeClient = await window.getOrInitSupabaseClient();
            const { error } = await activeClient.from('issues').delete().eq('id', issueId);
            if (error) throw error;
            showToast("Complaint deleted successfully.");
            await this.loadComplaints();
          } catch (err) {
            console.error("Delete complaint error:", err);
            showToast("Failed to delete complaint: " + err.message, "error");
          } finally {
            btn.disabled = false;
          }
        });
      });
    },

    bindFilters: function() {
      const pills = document.querySelectorAll('#admin-status-filters .filter-pill');
      pills.forEach(pill => {
        pill.replaceWith(pill.cloneNode(true)); // remove old listeners
      });

      document.querySelectorAll('#admin-status-filters .filter-pill').forEach(pill => {
        pill.addEventListener('click', async (e) => {
          document.querySelectorAll('#admin-status-filters .filter-pill').forEach(p => p.classList.remove('active'));
          e.target.classList.add('active');
          
          const usersRes = await API.getAllUsers();
          const authorities = (usersRes.data || []).filter(u => u.role === 'authority' || u.role === 'admin');
          this.renderComplaints(authorities);
        });
      });
    }
  };

  // ----------------------------------------------------
  // SERVICE 3: GovernmentService ( CMS Contents )
  // ----------------------------------------------------
  let cmsTab = 'schemes';
  let cmsSchemes = [];
  let cmsOffices = [];
  let cmsAnnouncements = [];
  let cmsFaqs = [];

  const defaultSchemes = [
    { id: 'tn-kmut', scheme_name: 'Kalaignar Magalir Urimai Thittam', department_name: 'Social Welfare & Women Empowerment Dept, Govt of TN', is_active: true, eligibility_criteria: { min_age: 21, max_age: 60, gender: 'female', max_annual_income: 250000 } },
    { id: 'tn-pudhumai', scheme_name: 'Pudhumai Penn Higher Education Assistance', department_name: 'Social Welfare & Women Empowerment Dept, Govt of TN', is_active: true, eligibility_criteria: { min_age: 17, max_age: 25, gender: 'female', student_required: true, gov_school_required: true } }
  ];
  const defaultOffices = [
    { id: 'off-1', name: 'Taluk Office Guindy', type: 'Taluk Office', district: 'Chennai', phone: '044-22345678' },
    { id: 'off-2', name: 'TNEGA E-Sevai Center T. Nagar', type: 'E-Sevai Center', district: 'Chennai', phone: '044-24341122' }
  ];
  const defaultAnnouncements = [
    { id: 'ann-1', title: 'Pudhumai Penn Phase 4 Registration Extended', description: 'Application deadline for college female students extended to August 31, 2026.', priority: 'High', is_published: true },
    { id: 'ann-2', title: 'Special E-Sevai Camps in District Collectorates', description: 'Special camps organized across all Tamil Nadu districts for Aadhaar-Bank account linking.', priority: 'Normal', is_published: true }
  ];
  const defaultFaqs = [
    { id: 'faq-1', question: 'How do I link Aadhaar to my bank account for KMUT?', answer: 'Visit your home bank branch with your original Aadhaar Card and fill the DBT consent form.', category: 'Eligibility & Aadhaar' },
    { id: 'faq-2', question: 'What is the income limit for Pudhumai Penn?', answer: 'Female students who completed Classes 6 to 12 in Government schools are eligible regardless of family income.', category: 'Student Assistance' }
  ];

  window.GovernmentService = {
    init: async function() {
      this.bindTabs();
      this.bindModal();
      await this.loadCMSData();
    },

    loadCMSData: async function() {
      try {
        const client = await window.getOrInitSupabaseClient();
        if (client) {
          const { data, error } = await client.from('government_schemes').select('*').order('created_at', { ascending: false });
          if (!error && data && data.length > 0) {
            cmsSchemes = data;
          } else {
            cmsSchemes = [...defaultSchemes];
          }
        } else {
          cmsSchemes = [...defaultSchemes];
        }
      } catch (e) {
        cmsSchemes = [...defaultSchemes];
      }

      cmsOffices = [...defaultOffices];
      cmsAnnouncements = [...defaultAnnouncements];
      cmsFaqs = [...defaultFaqs];

      this.renderSummary();
      this.renderTabContent();
    },

    renderSummary: function() {
      const schemesEl = document.getElementById('stat-total-schemes');
      const officesEl = document.getElementById('stat-total-offices');
      const annEl = document.getElementById('stat-total-announcements');
      const faqsEl = document.getElementById('stat-total-faqs');

      if (schemesEl) schemesEl.textContent = cmsSchemes.length;
      if (officesEl) officesEl.textContent = cmsOffices.length;
      if (annEl) annEl.textContent = cmsAnnouncements.length;
      if (faqsEl) faqsEl.textContent = cmsFaqs.length;
    },

    renderTabContent: function() {
      const container = document.getElementById('admin-tab-content');
      if (!container) return;

      if (cmsTab === 'schemes') {
        container.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
            <h3 style="font-size: 1.1rem; font-weight: 800; color: var(--text-main); margin: 0;">Government Schemes (${cmsSchemes.length})</h3>
          </div>
          <div style="display: flex; flex-direction: column; gap: 0.85rem;">
            ${cmsSchemes.map(s => {
              const active = s.is_active;
              return `
                <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 14px; padding: 1.2rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap;">
                  <div>
                    <span style="font-size: 0.65rem; font-weight: 800; text-transform: uppercase; color: ${active ? '#10b981' : '#6b7280'}; background: ${active ? 'rgba(16, 185, 129, 0.1)' : 'rgba(107, 114, 128, 0.1)'}; padding: 0.2rem 0.5rem; border-radius: 999px;">
                      ${active ? 'Published' : 'Archived'}
                    </span>
                    <h4 style="font-size: 1rem; font-weight: 800; color: var(--text-main); margin: 0.35rem 0 0.15rem 0;">${escapeHTML(s.scheme_name)}</h4>
                    <p style="font-size: 0.8rem; color: var(--text-muted); margin: 0;">${escapeHTML(s.department_name)}</p>
                  </div>
                  <div style="display: flex; gap: 0.5rem;">
                    <button type="button" class="btn btn-primary btn-edit-rules" data-id="${s.id}" style="padding: 0.4rem 0.8rem; font-size: 0.75rem; font-weight: 700; border-radius: 8px;">
                      <i class="fa-solid fa-gear"></i> Rules
                    </button>
                    <button type="button" class="btn btn-secondary btn-archive-scheme" data-id="${s.id}" style="padding: 0.4rem 0.8rem; font-size: 0.75rem; font-weight: 700; border-radius: 8px; color: ${active ? '#ef4444' : '#10b981'};">
                      ${active ? 'Archive' : 'Activate'}
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `;

        this.bindSchemeActions();
      } else if (cmsTab === 'offices') {
        container.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
            <h3 style="font-size: 1.1rem; font-weight: 800; color: var(--text-main); margin: 0;">Registered Offices (${cmsOffices.length})</h3>
          </div>
          <div style="display: flex; flex-direction: column; gap: 0.85rem;">
            ${cmsOffices.map(o => `
              <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 14px; padding: 1.2rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem;">
                <div>
                  <span style="font-size: 0.65rem; font-weight: 800; text-transform: uppercase; color: var(--primary); background: rgba(13, 148, 136, 0.12); padding: 0.2rem 0.5rem; border-radius: 999px;">${o.type}</span>
                  <h4 style="font-size: 1rem; font-weight: 800; color: var(--text-main); margin: 0.35rem 0 0.15rem 0;">${escapeHTML(o.name)}</h4>
                  <p style="font-size: 0.8rem; color: var(--text-muted); margin: 0;">${o.district} District • ${o.phone}</p>
                </div>
              </div>
            `).join('')}
          </div>
        `;
      } else if (cmsTab === 'announcements') {
        container.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
            <h3 style="font-size: 1.1rem; font-weight: 800; color: var(--text-main); margin: 0;">Citizen Broadcast Announcements (${cmsAnnouncements.length})</h3>
          </div>
          <div style="display: flex; flex-direction: column; gap: 0.85rem;">
            ${cmsAnnouncements.map(a => `
              <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 14px; padding: 1.2rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
                  <h4 style="font-size: 1rem; font-weight: 800; color: var(--text-main); margin: 0;">${escapeHTML(a.title)}</h4>
                  <span style="font-size: 0.65rem; font-weight: 800; text-transform: uppercase; color: #ef4444; background: rgba(239, 68, 68, 0.12); padding: 0.2rem 0.5rem; border-radius: 999px;">${a.priority} Priority</span>
                </div>
                <p style="font-size: 0.82rem; color: var(--text-muted); margin: 0;">${escapeHTML(a.description)}</p>
              </div>
            `).join('')}
          </div>
        `;
      } else if (cmsTab === 'faqs') {
        container.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
            <h3 style="font-size: 1.1rem; font-weight: 800; color: var(--text-main); margin: 0;">AI Knowledge Base FAQs (${cmsFaqs.length})</h3>
          </div>
          <div style="display: flex; flex-direction: column; gap: 0.85rem;">
            ${cmsFaqs.map(f => `
              <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 14px; padding: 1.2rem;">
                <span style="font-size: 0.65rem; font-weight: 800; text-transform: uppercase; color: #6366f1; background: rgba(99, 102, 241, 0.12); padding: 0.2rem 0.5rem; border-radius: 999px;">${f.category}</span>
                <h4 style="font-size: 0.95rem; font-weight: 800; color: var(--text-main); margin: 0.4rem 0 0.25rem 0;">Q: ${escapeHTML(f.question)}</h4>
                <p style="font-size: 0.82rem; color: var(--text-muted); margin: 0;">A: ${escapeHTML(f.answer)}</p>
              </div>
            `).join('')}
          </div>
        `;
      }
    },

    bindSchemeActions: function() {
      document.querySelectorAll('.btn-edit-rules').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.id;
          const scheme = cmsSchemes.find(x => x.id === id);
          if (scheme) this.openEditModal(scheme);
        });
      });

      document.querySelectorAll('.btn-archive-scheme').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.id;
          const scheme = cmsSchemes.find(x => x.id === id);
          if (scheme) {
            const newStatus = !scheme.is_active;
            try {
              const client = await window.getOrInitSupabaseClient();
              if (client) {
                const { error } = await client.from('government_schemes').update({ is_active: newStatus }).eq('id', id);
                if (error) throw error;
                showToast(`Scheme status updated successfully.`);
                await this.loadCMSData();
              }
            } catch (err) {
              console.error("Update scheme error:", err);
              showToast("Failed to update status", "error");
            }
          }
        });
      });
    },

    openEditModal: function(scheme) {
      const modal = document.getElementById('modal-edit-eligibility');
      if (!modal) return;

      const criteria = scheme.eligibility_criteria || {};
      document.getElementById('edit-scheme-id').value = scheme.id;
      document.getElementById('edit-scheme-name').value = scheme.scheme_name;
      document.getElementById('edit-min-age').value = criteria.min_age || '';
      document.getElementById('edit-max-age').value = criteria.max_age || '';
      document.getElementById('edit-max-income').value = criteria.max_annual_income || '';
      document.getElementById('edit-gender').value = criteria.gender || 'all';
      document.getElementById('edit-student-req').value = criteria.student_required ? 'true' : 'false';
      document.getElementById('edit-gov-school').value = criteria.gov_school_required ? 'true' : 'false';
      document.getElementById('edit-gov-college').value = criteria.gov_college_required ? 'true' : 'false';
      document.getElementById('edit-disability').value = criteria.disability_required ? 'true' : 'false';
      document.getElementById('edit-widow').value = criteria.widow_required ? 'true' : 'false';
      document.getElementById('edit-farmer').value = criteria.farmer_required ? 'true' : 'false';
      document.getElementById('edit-native-state').value = criteria.native_state || '';
      document.getElementById('edit-certificates').value = (criteria.required_certificates || []).join(', ');

      document.getElementById('edit-official-url').value = scheme.official_portal_url || '';
      document.getElementById('edit-dept-name').value = scheme.department_name || '';
      document.getElementById('edit-notif-number').value = scheme.official_notification_number || '';
      document.getElementById('edit-pdf-link').value = scheme.official_pdf_link || '';
      document.getElementById('edit-data-source').value = scheme.data_source || '';

      if (scheme.last_verified_date) {
        const dateObj = new Date(scheme.last_verified_date);
        const yyyy = dateObj.getFullYear();
        const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
        const dd = String(dateObj.getDate()).padStart(2, '0');
        document.getElementById('edit-verified-date').value = `${yyyy}-${mm}-${dd}`;
      } else {
        document.getElementById('edit-verified-date').value = '';
      }

      document.getElementById('edit-change-reason').value = '';
      modal.style.display = 'flex';
    },

    bindModal: function() {
      const closeBtn = document.getElementById('btn-close-modal');
      const cancelBtn = document.getElementById('btn-cancel-modal');
      const modal = document.getElementById('modal-edit-eligibility');
      const form = document.getElementById('form-edit-eligibility');

      if (closeBtn) closeBtn.onclick = () => modal.style.display = 'none';
      if (cancelBtn) cancelBtn.onclick = () => modal.style.display = 'none';

      if (form) {
        form.onsubmit = async (e) => {
          e.preventDefault();
          const id = document.getElementById('edit-scheme-id').value;
          const min_age = parseInt(document.getElementById('edit-min-age').value) || null;
          const max_age = parseInt(document.getElementById('edit-max-age').value) || null;
          const max_income = parseInt(document.getElementById('edit-max-income').value) || null;
          const gender = document.getElementById('edit-gender').value;
          const student_required = document.getElementById('edit-student-req').value === 'true';
          const gov_school_required = document.getElementById('edit-gov-school').value === 'true';
          const gov_college_required = document.getElementById('edit-gov-college').value === 'true';
          const disability_required = document.getElementById('edit-disability').value === 'true';
          const widow_required = document.getElementById('edit-widow').value === 'true';
          const farmer_required = document.getElementById('edit-farmer').value === 'true';
          const native_state = document.getElementById('edit-native-state').value;
          const certificates = document.getElementById('edit-certificates').value.split(',').map(x => x.trim()).filter(Boolean);

          const change_reason = document.getElementById('edit-change-reason').value;
          if (!change_reason.trim()) {
            showToast("Change Log Audit Reason is required to update rules.", "error");
            return;
          }

          const payload = {
            eligibility_criteria: {
              min_age, max_age, max_annual_income: max_income, gender,
              student_required, gov_school_required, gov_college_required,
              disability_required, widow_required, farmer_required,
              native_state, required_certificates: certificates
            },
            official_portal_url: document.getElementById('edit-official-url').value || null,
            department_name: document.getElementById('edit-dept-name').value || null,
            official_notification_number: document.getElementById('edit-notif-number').value || null,
            official_pdf_link: document.getElementById('edit-pdf-link').value || null,
            data_source: document.getElementById('edit-data-source').value || null,
            last_verified_date: document.getElementById('edit-verified-date').value || new Date().toISOString().split('T')[0]
          };

          try {
            const client = await window.getOrInitSupabaseClient();
            if (client) {
              const { error } = await client.from('government_schemes').update(payload).eq('id', id);
              if (error) throw error;

              // Write Audit Log
              const user = typeof getCurrentUser === 'function' ? getCurrentUser() : { email: 'Admin' };
              await client.from('audit_logs').insert({
                action: 'UPDATE_SCHEME_RULES',
                actor: user.email,
                details: `Scheme ${id} eligibility updated. Reason: ${change_reason}`
              });

              showToast("Scheme rules updated successfully.");
              modal.style.display = 'none';
              await this.loadCMSData();
            }
          } catch (err) {
            console.error("Save scheme rules failed:", err);
            showToast("Failed to save rules: " + err.message, "error");
          }
        };
      }
    },

    bindTabs: function() {
      const tabs = document.querySelectorAll('#pane-services .admin-nav-tab');
      tabs.forEach(tab => {
        tab.replaceWith(tab.cloneNode(true)); // clean listeners
      });

      document.querySelectorAll('#pane-services .admin-nav-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
          document.querySelectorAll('#pane-services .admin-nav-tab').forEach(t => {
            t.classList.remove('active-sub-tab');
            t.style.background = 'transparent';
            t.style.color = 'var(--text-muted)';
          });
          e.target.classList.add('active-sub-tab');
          e.target.style.background = 'var(--primary)';
          e.target.style.color = '#ffffff';

          cmsTab = e.target.dataset.tab;
          this.renderTabContent();
        });
      });
    }
  };

  // ----------------------------------------------------
  // SERVICE 4: UserService ( User Management )
  // ----------------------------------------------------
  window.UserService = {
    init: async function() {
      await this.loadUsers();
      this.bindSearchFilters();
    },

    loadUsers: async function() {
      const tbody = document.getElementById('users-table-body');
      if (!tbody) return;

      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-muted);">
            <i class="fa-solid fa-spinner fa-spin" style="margin-right:0.5rem;"></i> Fetching users list...
          </td>
        </tr>
      `;

      try {
        const usersRes = await API.getAllUsers();
        const deptsRes = await API.getDepartments();

        if (usersRes.error) throw new Error(usersRes.error);
        if (deptsRes.error) throw new Error(deptsRes.error);

        currentUsers = usersRes.data || [];
        allDepartments = deptsRes.data || [];
        this.renderUsers();
      } catch (err) {
        console.error("UserService load error:", err);
        tbody.innerHTML = `
          <tr>
            <td colspan="7" style="text-align: center; padding: 2rem;">
              <div class="error-retry-card" style="display:inline-block; background-color: var(--bg-surface); border: 1px dashed #ef4444; border-radius: var(--radius-md); padding: 1.5rem; text-align: center; max-width:400px;">
                <i class="fa-solid fa-triangle-exclamation" style="color: #ef4444; font-size: 1.5rem; margin-bottom: 0.5rem;"></i>
                <p style="font-weight: 600; font-size: 0.88rem; color: var(--text-main); margin: 0;">Failed to load users</p>
                <button onclick="window.UserService.loadUsers()" class="btn" style="margin-top:0.75rem; padding: 0.4rem 0.8rem; font-size: 0.75rem; border: 1px solid var(--border-color); background: var(--bg-surface); color: var(--text-main); cursor: pointer; border-radius: var(--radius-sm);">
                  <i class="fa-solid fa-rotate-right"></i> Retry
                </button>
              </div>
            </td>
          </tr>
        `;
      }
    },

    renderUsers: function() {
      const tbody = document.getElementById('users-table-body');
      const searchVal = document.getElementById('user-search-input').value.toLowerCase();
      const roleFilter = document.getElementById('user-role-filter').value;
      if (!tbody) return;

      const filtered = currentUsers.filter(user => {
        const matchesSearch = (user.full_name || '').toLowerCase().includes(searchVal) ||
                              (user.email || '').toLowerCase().includes(searchVal);
        const matchesRole = roleFilter === '' || user.role === roleFilter;
        return matchesSearch && matchesRole;
      });

      if (filtered.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-muted);">
              No users match your filter search criteria.
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = filtered.map(user => {
        const regDate = user.created_at
          ? new Date(user.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
          : 'N/A';
          
        const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
        const isSelf = currentUser && currentUser.id === user.id;

        let verifyAuthCell = '';
        if (user.role === 'authority') {
          verifyAuthCell = `
            <label style="display:inline-flex; align-items:center; gap:0.35rem; cursor:pointer;">
              <input type="checkbox" class="user-verify-checkbox" data-user-id="${user.id}" ${user.is_verified_authority ? 'checked' : ''} style="cursor:pointer; width:16px; height:16px; accent-color:var(--primary);">
              <span style="font-size:0.82rem; color:${user.is_verified_authority ? 'var(--primary)' : 'var(--text-muted)'}; font-weight:600;">
                ${user.is_verified_authority ? 'Verified' : 'Unverified'}
              </span>
            </label>
          `;
        } else {
          verifyAuthCell = `<span style="color:var(--text-muted); font-size:0.8rem;">N/A (${user.role})</span>`;
        }

        const deptOptions = allDepartments.map(d => `<option value="${d.id}" ${user.department_id === d.id ? 'selected' : ''}>${d.name}</option>`).join('');
        const deptCell = `
          <select class="form-select user-department-select" data-user-id="${user.id}" ${user.role !== 'authority' ? 'disabled' : ''} style="margin: 0; font-size: 0.85rem; padding: 0.25rem 0.5rem; width: 100%; cursor:pointer;">
            <option value="">-- Unassigned --</option>
            ${deptOptions}
          </select>
        `;

        const isSuspended = !!user.is_suspended;
        const suspendCell = `
          <span class="badge badge-suspend" data-user-id="${user.id}" data-suspended="${isSuspended}" style="cursor: ${isSelf ? 'not-allowed' : 'pointer'}; opacity: ${isSelf ? 0.5 : 1}; background-color: ${isSuspended ? '#ef4444' : '#10b981'}; color: white; text-transform: uppercase; font-size: 0.72rem; padding: 0.25rem 0.5rem; border-radius: 4px; display: inline-block; font-weight:700;">
            ${isSuspended ? 'Suspended' : 'Active'}
          </span>
        `;

        return `
          <tr>
            <td style="font-weight:600;">${escapeHTML(user.full_name || 'Citizen')} ${isSelf ? '<span style="color:var(--text-muted); font-size:0.75rem;">(You)</span>' : ''}</td>
            <td>${escapeHTML(user.email || 'N/A')}</td>
            <td style="color:var(--text-muted);">${regDate}</td>
            <td>
              <select class="form-select user-role-select" data-user-id="${user.id}" ${isSelf ? 'disabled' : ''} style="margin: 0; font-size: 0.85rem; padding: 0.25rem 0.5rem; width: auto; cursor:pointer;">
                <option value="citizen" ${user.role === 'citizen' ? 'selected' : ''}>Citizen</option>
                <option value="authority" ${user.role === 'authority' ? 'selected' : ''}>Authority</option>
                <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
              </select>
            </td>
            <td>${verifyAuthCell}</td>
            <td>${deptCell}</td>
            <td>${suspendCell}</td>
          </tr>
        `;
      }).join('');

      this.bindUserActions();
    },

    bindUserActions: function() {
      // Role select
      document.querySelectorAll('.user-role-select').forEach(select => {
        select.addEventListener('change', async (e) => {
          const userId = e.target.getAttribute('data-user-id');
          const newRole = e.target.value;
          e.target.disabled = true;

          try {
            const updateRes = await API.updateUserRole(userId, newRole);
            if (updateRes.error) throw new Error(updateRes.error);
            showToast(`Role updated successfully to ${newRole.toUpperCase()}!`);
            await this.loadUsers();
          } catch (err) {
            console.error("update role error:", err);
            showToast("Failed to update role: " + err.message, "error");
            select.value = select.dataset.oldValue;
          } finally {
            e.target.disabled = false;
          }
        });
        select.dataset.oldValue = select.value;
      });

      // Verify authority checkbox
      document.querySelectorAll('.user-verify-checkbox').forEach(chk => {
        chk.addEventListener('change', async (e) => {
          const userId = e.target.getAttribute('data-user-id');
          const isChecked = e.target.checked;
          chk.disabled = true;

          try {
            const verifyRes = await API.verifyAuthority(userId, isChecked);
            if (verifyRes.error) throw new Error(verifyRes.error);
            showToast(isChecked ? "Authority verified successfully!" : "Authority verification retracted.");
            await this.loadUsers();
          } catch (err) {
            console.error("verify authority error:", err);
            showToast("Failed to update verification status: " + err.message, "error");
            chk.checked = !isChecked;
          } finally {
            chk.disabled = false;
          }
        });
      });

      // Department select
      document.querySelectorAll('.user-department-select').forEach(select => {
        select.addEventListener('change', async (e) => {
          const userId = e.target.getAttribute('data-user-id');
          const deptId = e.target.value;
          select.disabled = true;

          try {
            const assignRes = await API.assignUserDepartment(userId, deptId || null);
            if (assignRes.error) throw new Error(assignRes.error);
            showToast("Department assignment updated successfully!");
            await this.loadUsers();
          } catch (err) {
            console.error("assign department error:", err);
            showToast("Failed to assign department: " + err.message, "error");
            select.value = select.dataset.oldValue;
          } finally {
            select.disabled = false;
          }
        });
        select.dataset.oldValue = select.value;
      });

      // Suspension badge clickable
      document.querySelectorAll('.badge-suspend').forEach(badge => {
        badge.addEventListener('click', async (e) => {
          const userId = badge.getAttribute('data-user-id');
          const isSuspended = badge.getAttribute('data-suspended') === 'true';
          const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
          if (currentUser && currentUser.id === userId) return;

          const actionWord = isSuspended ? 'unsuspend' : 'suspend';
          if (!confirm(`Are you sure you want to ${actionWord} this user account?`)) return;

          try {
            const suspendRes = await API.suspendUser(userId, !isSuspended);
            if (suspendRes.error) throw new Error(suspendRes.error);
            showToast(`User account ${isSuspended ? 'reactivated' : 'suspended'} successfully.`);
            await this.loadUsers();
          } catch (err) {
            console.error("Set suspension error:", err);
            showToast("Failed to update suspension: " + err.message, "error");
          }
        });
      });
    },

    bindSearchFilters: function() {
      const search = document.getElementById('user-search-input');
      const filter = document.getElementById('user-role-filter');

      if (search) {
        search.replaceWith(search.cloneNode(true));
        document.getElementById('user-search-input').addEventListener('input', () => this.renderUsers());
      }
      if (filter) {
        filter.replaceWith(filter.cloneNode(true));
        document.getElementById('user-role-filter').addEventListener('change', () => this.renderUsers());
      }
    }
  };

  // ----------------------------------------------------
  // SERVICE 5: WhatsAppService ( Gateway Client )
  // ----------------------------------------------------
  let gatewayPollId = null;
  let whatsappActiveSubtab = 'logs';

  window.WhatsAppService = {
    init: async function() {
      this.bindButtons();
      await this.fetchGatewayStatus();
      this.startPolling();
    },

    destroy: function() {
      if (gatewayPollId) {
        clearInterval(gatewayPollId);
        gatewayPollId = null;
      }
    },

    startPolling: function() {
      if (gatewayPollId) clearInterval(gatewayPollId);
      gatewayPollId = setInterval(() => {
        this.fetchGatewayStatus();
      }, 5000);
    },

    getAuthHeaders: async function() {
      let token = null;
      if (typeof window.getOrInitSupabaseClient === 'function') {
        const client = await window.getOrInitSupabaseClient();
        if (client) {
          const session = await client.auth.getSession();
          token = session?.data?.session?.access_token;
        }
      }
      if (!token) token = localStorage.getItem('cc_auth_token') || localStorage.getItem('cc_session');
      return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };
    },

    fetchGatewayStatus: async function() {
      try {
        const headers = await this.getAuthHeaders();
        const res = await fetch('/api/whatsapp/status', { headers });
        if (res.status === 401) {
          window.location.href = 'authority-login.html';
          return;
        }
        const data = await res.json();
        if (data) {
          this.updateStatusUI(data);
          this.refreshLogsAndQueue(data);
        }
      } catch (err) {
        console.warn("Fetch whatsapp gateway status failed:", err);
      }
    },

    updateStatusUI: function(data) {
      const stateEl = document.getElementById('stat-connection-state');
      const queueEl = document.getElementById('stat-queue-count');
      const badgeContainer = document.getElementById('status-badge-container');
      const qrPlaceholder = document.getElementById('qr-placeholder');
      const qrImg = document.getElementById('qr-img');

      if (queueEl) queueEl.textContent = data.queueCount || 0;

      if (stateEl) {
        stateEl.textContent = data.status.toUpperCase();
        if (data.status === 'ready') stateEl.style.color = '#10b981';
        else if (data.status === 'connecting' || data.status === 'qr_ready') stateEl.style.color = '#f59e0b';
        else stateEl.style.color = '#ef4444';
      }

      if (badgeContainer) {
        let badgeClass = 'status-disconnected';
        let icon = 'fa-circle';
        let text = 'Offline';

        if (data.status === 'ready') {
          badgeClass = 'status-ready'; icon = 'fa-circle-check'; text = 'Online / Ready';
        } else if (data.status === 'connecting') {
          badgeClass = 'status-disconnected'; icon = 'fa-spinner fa-spin'; text = 'Connecting...';
        } else if (data.status === 'qr_ready') {
          badgeClass = 'status-disconnected'; icon = 'fa-qrcode'; text = 'QR Code Ready';
        }

        badgeContainer.innerHTML = `<span class="status-badge ${badgeClass}"><i class="fa-solid ${icon}"></i> ${text}</span>`;
      }

      if (data.status === 'qr_ready' && data.qrCode) {
        if (qrPlaceholder) qrPlaceholder.classList.add('hidden');
        if (qrImg) {
          qrImg.src = data.qrCode;
          qrImg.classList.remove('hidden');
        }
      } else {
        if (qrPlaceholder) qrPlaceholder.classList.remove('hidden');
        if (qrImg) {
          qrImg.src = '';
          qrImg.classList.add('hidden');
        }
      }
    },

    refreshLogsAndQueue: function(data) {
      const container = document.getElementById('logs-container');
      if (!container) return;

      if (whatsappActiveSubtab === 'logs') {
        const logs = data.recentLogs || [];
        if (logs.length === 0) {
          container.innerHTML = `<div style="color: var(--text-muted);">No system logs captured.</div>`;
          return;
        }
        container.innerHTML = logs.map(l => {
          const timestamp = new Date(l.timestamp).toLocaleTimeString();
          let color = 'var(--text-main)';
          if (l.level === 'error') color = '#ef4444';
          else if (l.level === 'warn') color = '#f59e0b';
          return `<div style="color: ${color}; margin-bottom: 0.25rem;">[${timestamp}] ${escapeHTML(l.message)}</div>`;
        }).join('');
      } else {
        const queue = data.messageQueue || [];
        if (queue.length === 0) {
          container.innerHTML = `<div style="color: var(--text-muted);">Message queue is empty.</div>`;
          return;
        }
        container.innerHTML = queue.map(m => {
          const added = new Date(m.addedAt).toLocaleTimeString();
          return `<div style="margin-bottom: 0.35rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.25rem;">
            <div style="font-weight: 700;">To: +${m.recipient} [Added: ${added}]</div>
            <div style="color: var(--text-muted); text-overflow: ellipsis; white-space: nowrap; overflow: hidden;">${escapeHTML(m.message)}</div>
          </div>`;
        }).join('');
      }
    },

    bindButtons: function() {
      const btnReconnect = document.getElementById('btn-reconnect');
      const btnDisconnect = document.getElementById('btn-disconnect');
      const formTest = document.getElementById('form-test-message');
      const tabLogsBtn = document.getElementById('tab-logs-btn');
      const tabQueueBtn = document.getElementById('tab-queue-btn');

      if (btnReconnect) {
        btnReconnect.onclick = async () => {
          btnReconnect.disabled = true;
          try {
            const headers = await this.getAuthHeaders();
            const res = await fetch('/api/whatsapp/reconnect', { method: 'POST', headers });
            const result = await res.json();
            if (result.success) showToast("WhatsApp connection initialized! Awaiting scan...");
            else showToast("Failed to initialize gateway.", "error");
          } catch (e) {
            showToast("Error connecting gateway", "error");
          } finally {
            btnReconnect.disabled = false;
          }
        };
      }

      if (btnDisconnect) {
        btnDisconnect.onclick = async () => {
          if (!confirm("Are you sure you want to terminate current WhatsApp session?")) return;
          btnDisconnect.disabled = true;
          try {
            const headers = await this.getAuthHeaders();
            const res = await fetch('/api/whatsapp/disconnect', { method: 'POST', headers });
            const result = await res.json();
            if (result.success) showToast("WhatsApp session disconnected successfully.");
            else showToast("Error disconnecting session.", "error");
          } catch (e) {
            showToast("Connection close error", "error");
          } finally {
            btnDisconnect.disabled = false;
          }
        };
      }

      if (formTest) {
        formTest.onsubmit = async (e) => {
          e.preventDefault();
          const recipient = document.getElementById('test-phone-input').value;
          const message = document.getElementById('test-message-input').value;
          
          try {
            const headers = await this.getAuthHeaders();
            const res = await fetch('/api/whatsapp/test-send', {
              method: 'POST',
              headers,
              body: JSON.stringify({ recipient, message })
            });
            const result = await res.json();
            if (result.success) {
              showToast("Test notification sent successfully!");
              document.getElementById('test-message-input').value = '';
            } else {
              showToast("Failed to send test: " + result.error, "error");
            }
          } catch (err) {
            showToast("Error sending test message", "error");
          }
        };
      }

      if (tabLogsBtn && tabQueueBtn) {
        tabLogsBtn.onclick = () => {
          tabLogsBtn.classList.add('active-sub-tab'); tabLogsBtn.style.background = 'var(--primary)'; tabLogsBtn.style.color = '#ffffff';
          tabQueueBtn.classList.remove('active-sub-tab'); tabQueueBtn.style.background = 'transparent'; tabQueueBtn.style.color = 'var(--text-muted)';
          whatsappActiveSubtab = 'logs';
          this.fetchGatewayStatus();
        };

        tabQueueBtn.onclick = () => {
          tabQueueBtn.classList.add('active-sub-tab'); tabQueueBtn.style.background = 'var(--primary)'; tabQueueBtn.style.color = '#ffffff';
          tabLogsBtn.classList.remove('active-sub-tab'); tabLogsBtn.style.background = 'transparent'; tabLogsBtn.style.color = 'var(--text-muted)';
          whatsappActiveSubtab = 'queue';
          this.fetchGatewayStatus();
        };
      }
    }
  };

  // ----------------------------------------------------
  // SERVICE 6: SettingsService ( Departments & AI Monitor )
  // ----------------------------------------------------
  let settingsActiveTab = 'departments';

  window.SettingsService = {
    init: async function() {
      this.bindTabs();
      this.bindDeptForm();
      this.bindAiOverrideForm();
      await this.loadDepartments();
      await this.loadAiDecisions();
    },

    loadDepartments: async function() {
      const tbody = document.getElementById('departments-table-body');
      if (!tbody) return;

      tbody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align: center; padding: 2rem; color: var(--text-muted);">
            <i class="fa-solid fa-spinner fa-spin"></i> Fetching departments list...
          </td>
        </tr>
      `;

      try {
        const res = await API.getDepartments();
        if (res.error) throw new Error(res.error);
        allDepartments = res.data || [];
        
        tbody.innerHTML = allDepartments.map(dept => `
          <tr>
            <td style="font-weight: 700; color: var(--primary);">${escapeHTML(dept.code)}</td>
            <td style="font-weight: 600;">${escapeHTML(dept.name)}</td>
            <td style="color: var(--text-muted); font-size: 0.82rem;">${escapeHTML(dept.description || 'No description provided')}</td>
            <td style="text-align: right;">
              <button class="btn btn-secondary btn-edit-dept" data-id="${dept.id}" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">Edit</button>
              <button class="btn btn-secondary btn-delete-dept" data-id="${dept.id}" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; color: #ef4444; border-color: rgba(239, 68, 68, 0.2);">Delete</button>
            </td>
          </tr>
        `).join('');

        this.bindDeptActions();
      } catch (err) {
        console.error("loadDepartments settings error:", err);
      }
    },

    bindDeptActions: function() {
      document.querySelectorAll('.btn-edit-dept').forEach(btn => {
        btn.onclick = () => {
          const id = btn.dataset.id;
          const dept = allDepartments.find(d => d.id === id);
          if (dept) {
            document.getElementById('dept-edit-id').value = dept.id;
            document.getElementById('dept-name-input').value = dept.name;
            document.getElementById('dept-code-input').value = dept.code;
            document.getElementById('dept-desc-input').value = dept.description || '';
            document.getElementById('dept-form-title').innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Edit Department';
            document.getElementById('department-form-card').classList.remove('hidden');
          }
        };
      });

      document.querySelectorAll('.btn-delete-dept').forEach(btn => {
        btn.onclick = async () => {
          const id = btn.dataset.id;
          if (!confirm("Are you sure you want to delete this department? All inspectors assigned to it will be unlinked.")) return;
          try {
            const res = await API.deleteDepartment(id);
            if (res.error) throw new Error(res.error);
            showToast("Department deleted successfully.");
            await this.loadDepartments();
          } catch (err) {
            showToast("Delete failed: " + err.message, "error");
          }
        };
      });
    },

    bindDeptForm: function() {
      const form = document.getElementById('department-crud-form');
      const cancelBtn = document.getElementById('btn-cancel-dept');
      const addBtn = document.getElementById('btn-add-department');

      if (addBtn) {
        addBtn.onclick = () => {
          document.getElementById('dept-edit-id').value = '';
          form.reset();
          document.getElementById('dept-form-title').innerHTML = '<i class="fa-solid fa-square-plus"></i> Create Department';
          document.getElementById('department-form-card').classList.remove('hidden');
        };
      }

      if (cancelBtn) {
        cancelBtn.onclick = () => {
          document.getElementById('department-form-card').classList.add('hidden');
          form.reset();
        };
      }

      if (form) {
        form.onsubmit = async (e) => {
          e.preventDefault();
          const id = document.getElementById('dept-edit-id').value;
          const name = document.getElementById('dept-name-input').value;
          const code = document.getElementById('dept-code-input').value.toUpperCase();
          const description = document.getElementById('dept-desc-input').value;

          try {
            let res;
            if (id) {
              res = await API.updateDepartment(id, { name, code, description });
            } else {
              res = await API.createDepartment({ name, code, description });
            }
            if (res.error) throw new Error(res.error);

            showToast(id ? "Department updated!" : "Department created!");
            document.getElementById('department-form-card').classList.add('hidden');
            form.reset();
            await this.loadDepartments();
          } catch (err) {
            showToast("Save failed: " + err.message, "error");
          }
        };
      }
    },

    loadAiDecisions: async function() {
      const tbody = document.getElementById('ai-decisions-table-body');
      if (!tbody) return;

      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-muted);">
            <i class="fa-solid fa-spinner fa-spin"></i> Loading AI predictions logs...
          </td>
        </tr>
      `;

      try {
        const res = await API.getAiDecisions();
        if (res.error) throw new Error(res.error);
        const logs = res.data || [];

        tbody.innerHTML = logs.map(item => {
          const isMatch = item.category === item.ai_predicted_category;
          const matchLabel = isMatch 
            ? `<span style="color:#10b981; font-weight:700;"><i class="fa-solid fa-circle-check"></i> Match</span>` 
            : `<span style="color:#ef4444; font-weight:700;"><i class="fa-solid fa-triangle-exclamation"></i> Discrepancy</span>`;
          
          return `
            <tr>
              <td>
                <div style="font-weight: 600;">${escapeHTML(item.title)}</div>
                <div style="font-size:0.75rem; color:var(--text-muted); text-overflow:ellipsis; overflow:hidden; white-space:nowrap; max-width:200px;">${escapeHTML(item.description)}</div>
              </td>
              <td style="font-weight: 600; text-transform: capitalize;">${item.category}</td>
              <td style="font-weight: 600; text-transform: capitalize; color: var(--primary);">${item.ai_predicted_category || 'N/A'}</td>
              <td>${item.ai_assigned_department_code || 'ROAD'}</td>
              <td style="text-transform: uppercase; font-size:0.8rem; font-weight:700;">${item.ai_predicted_priority || 'MEDIUM'}</td>
              <td>${matchLabel}</td>
              <td style="text-align: right;">
                <button class="btn btn-secondary btn-override-ai" data-id="${item.id}" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; border-color: #f59e0b; color: #f59e0b;">Override</button>
              </td>
            </tr>
          `;
        }).join('');

        this.bindAiActions();
      } catch (err) {
        console.error("loadAiDecisions error:", err);
      }
    },

    bindAiActions: function() {
      document.querySelectorAll('.btn-override-ai').forEach(btn => {
        btn.onclick = async () => {
          const id = btn.dataset.id;
          
          // Populate department select options in form
          const selectDept = document.getElementById('override-department');
          if (selectDept) {
            selectDept.innerHTML = allDepartments.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
          }

          document.getElementById('override-issue-id').value = id;
          document.getElementById('ai-override-card').classList.remove('hidden');
        };
      });
    },

    bindAiOverrideForm: function() {
      const form = document.getElementById('ai-override-form');
      const cancelBtn = document.getElementById('btn-cancel-override');

      if (cancelBtn) {
        cancelBtn.onclick = () => {
          document.getElementById('ai-override-card').classList.add('hidden');
        };
      }

      if (form) {
        form.onsubmit = async (e) => {
          e.preventDefault();
          const id = document.getElementById('override-issue-id').value;
          const category = document.getElementById('override-category').value;
          const department_id = document.getElementById('override-department').value;
          const priority = document.getElementById('override-priority').value;

          try {
            const res = await API.overrideAiDecision(id, { category, department_id, priority });
            if (res.error) throw new Error(res.error);
            showToast("AI predictions overridden successfully!");
            document.getElementById('ai-override-card').classList.add('hidden');
            await this.loadAiDecisions();
          } catch (err) {
            showToast("Override failed: " + err.message, "error");
          }
        };
      }
    },

    bindTabs: function() {
      const tabs = document.querySelectorAll('#pane-settings .admin-nav-tab');
      tabs.forEach(tab => {
        tab.replaceWith(tab.cloneNode(true));
      });

      document.querySelectorAll('#pane-settings .admin-nav-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
          document.querySelectorAll('#pane-settings .admin-nav-tab').forEach(t => {
            t.classList.remove('active-sub-tab');
            t.style.background = 'transparent';
            t.style.color = 'var(--text-muted)';
          });
          e.target.classList.add('active-sub-tab');
          e.target.style.background = 'var(--primary)';
          e.target.style.color = '#ffffff';

          settingsActiveTab = e.target.dataset.settingTab;
          if (settingsActiveTab === 'departments') {
            document.getElementById('subpane-departments').style.display = 'block';
            document.getElementById('subpane-ai-decisions').style.display = 'none';
          } else {
            document.getElementById('subpane-departments').style.display = 'none';
            document.getElementById('subpane-ai-decisions').style.display = 'block';
          }
        });
      });
    }
  };

  // Admin-only tabs that require 'admin' role
  const ADMIN_ONLY_TABS = ['users', 'whatsapp', 'settings'];

  // ----------------------------------------------------
  // ROUTING & TAB NAVIGATION SWAPPING
  // ----------------------------------------------------
  function showTab(tabId) {
    // Role-based hash guard: prevent authority users from accessing admin-only tabs
    const role = typeof getUserRole === 'function' ? getUserRole() : null;
    if (role !== 'admin' && ADMIN_ONLY_TABS.includes(tabId)) {
      console.warn(`[Admin.js] Role "${role}" denied access to tab "${tabId}". Falling back to dashboard.`);
      window.location.hash = '#dashboard';
      return;
    }

    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active-pane'));
    document.querySelectorAll('.app-sidebar-link').forEach(l => l.classList.remove('active'));

    // Find tab target
    const targetPane = document.getElementById('pane-' + tabId);
    if (targetPane) {
      targetPane.classList.add('active-pane');
      
      const navLink = document.querySelector(`.app-sidebar-link[data-target="pane-${tabId}"]`);
      if (navLink) navLink.classList.add('active');

      const activeBreadcrumb = document.getElementById('breadcrumb-active-tab');
      if (activeBreadcrumb) {
        const spanText = navLink ? navLink.querySelector('span').textContent : tabId.toUpperCase();
        activeBreadcrumb.textContent = spanText;
      }
    }

    // Clean up WhatsApp polling if leaving whatsapp tab
    if (tabId !== 'whatsapp') {
      window.WhatsAppService.destroy();
    }

    // Lazy load initialization
    if (tabId === 'dashboard') window.DashboardService.init();
    else if (tabId === 'complaints') window.ComplaintService.init();
    else if (tabId === 'services') window.GovernmentService.init();
    else if (tabId === 'users') window.UserService.init();
    else if (tabId === 'whatsapp') window.WhatsAppService.init();
    else if (tabId === 'settings') window.SettingsService.init();
  }

  // ----------------------------------------------------
  // REPORT EXPORT TRIGGERS BINDING
  // ----------------------------------------------------
  function bindReportExporter() {
    const exportBtn = document.getElementById('btn-export-report');
    if (!exportBtn) return;

    exportBtn.onclick = async () => {
      const range = document.getElementById('export-range').value;
      const formatEl = document.querySelector('input[name="export-format"]:checked');
      const format = formatEl ? formatEl.value : 'csv';

      exportBtn.disabled = true;
      const originalText = exportBtn.innerHTML;
      exportBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Exporting...`;

      try {
        let token = null;
        if (typeof window.getOrInitSupabaseClient === 'function') {
          const client = await window.getOrInitSupabaseClient();
          if (client) {
            const session = await client.auth.getSession();
            token = session?.data?.session?.access_token;
          }
        }
        if (!token) token = localStorage.getItem('cc_auth_token') || localStorage.getItem('cc_session');

        const url = `/api/issues/admin/reports/export?range=${range}&format=${format}`;
        const response = await fetch(url, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error(`HTTP error ${response.status}`);

        if (format === 'csv') {
          const blob = await response.blob();
          const downloadUrl = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = downloadUrl;
          a.download = `crowdcity-report-${range}-${Date.now()}.csv`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(downloadUrl);
          showToast("Report exported successfully as CSV!");
        } else {
          const html = await response.text();
          const printWindow = window.open('', '_blank');
          if (printWindow) {
            printWindow.document.open();
            printWindow.document.write(html);
            printWindow.document.close();
            showToast("Printable report opened in new tab!");
          } else {
            showToast("Pop-up blocked. Please enable pop-ups to open reports.", "error");
          }
        }
      } catch (err) {
        console.error("Export report error:", err);
        showToast("Error generating report", "error");
      } finally {
        exportBtn.disabled = false;
        exportBtn.innerHTML = originalText;
      }
    };
  }

  // ----------------------------------------------------
  // WEATHER WIDGET INITIALIZATION
  // ----------------------------------------------------
  function initWeatherWidget() {
    const cityEl = document.getElementById('weather-city');
    const tempEl = document.getElementById('weather-temp');
    const iconEl = document.getElementById('weather-icon');
    const widget = document.getElementById('weather-widget');
    if (!cityEl || !tempEl || !widget) return;

    // Mapping code to icons
    function getWeatherIcon(code) {
      if (code === 0) return 'fa-sun';
      if (code <= 3) return 'fa-cloud-sun';
      if (code <= 48) return 'fa-smog';
      if (code <= 57) return 'fa-cloud-rain';
      if (code <= 67) return 'fa-cloud-showers-heavy';
      if (code <= 77) return 'fa-snowflake';
      if (code <= 82) return 'fa-cloud-showers-heavy';
      if (code <= 99) return 'fa-bolt';
      return 'fa-cloud';
    }

    async function fetchWeather(lat, lon) {
      try {
        const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=10&addressdetails=1`);
        const geoData = await geoRes.json();
        const addr = geoData.address || {};
        const district = (addr.state_district || addr.county || addr.city || addr.town || 'Chennai').replace(/ district$/i, '').replace(/ taluk$/i, '');

        const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
        const weatherData = await weatherRes.json();
        const current = weatherData.current_weather;
        const temp = Math.round(current.temperature);
        const code = current.weathercode;

        cityEl.textContent = district;
        tempEl.textContent = `${temp}°C`;
        iconEl.innerHTML = `<i class="fa-solid ${getWeatherIcon(code)}"></i>`;
        widget.classList.remove('loading');
      } catch (e) {
        cityEl.textContent = 'Chennai';
        tempEl.textContent = '31°C';
        iconEl.innerHTML = `<i class="fa-solid fa-cloud-sun"></i>`;
        widget.classList.remove('loading');
      }
    }

    // Default coordinates (Guindy, Chennai)
    fetchWeather(13.0067, 80.2206);
  }

  // ----------------------------------------------------
  // LIVE CLOCK WIDGET
  // ----------------------------------------------------
  function initLiveClock() {
    const dateEl = document.getElementById('widget-date');
    const timeEl = document.getElementById('widget-time');
    if (!dateEl || !timeEl) return;

    function tick() {
      const now = new Date();
      dateEl.textContent = now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
      timeEl.textContent = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
    tick();
    setInterval(tick, 1000);
  }

  // ----------------------------------------------------
  // MOBILE SIDEBAR TOGGLE
  // ----------------------------------------------------
  function initMobileSidebar() {
    const toggleBtn = document.getElementById('mobile-menu-btn');
    const sidebar = document.querySelector('.app-sidebar');
    if (!toggleBtn || !sidebar) return;

    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('sidebar-open');
    });

    // Close sidebar when clicking a nav link on mobile
    document.querySelectorAll('.app-sidebar-link').forEach(link => {
      link.addEventListener('click', () => {
        if (window.innerWidth < 1024) {
          sidebar.classList.remove('sidebar-open');
        }
      });
    });
  }

  // ----------------------------------------------------
  // INITIALIZATION ON LOAD
  // ----------------------------------------------------
  window.addEventListener('DOMContentLoaded', () => {
    if (!checkAccess()) return;
    
    // Bind sidebar clicks to URL hash changing
    document.querySelectorAll('.app-sidebar-link').forEach(link => {
      const targetHash = link.getAttribute('href');
      if (targetHash && targetHash.startsWith('#')) {
        link.onclick = (e) => {
          e.preventDefault();
          window.location.hash = targetHash;
        };
      }
    });

    // Register hashchange listener AFTER DOM is ready
    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.replace('#', '') || 'dashboard';
      showTab(hash);
    });

    // Boot current route hash
    const startHash = window.location.hash.replace('#', '') || 'dashboard';
    showTab(startHash);

    // Bind other global setups
    bindReportExporter();
    initWeatherWidget();
    initLiveClock();
    initMobileSidebar();
  });

})();
