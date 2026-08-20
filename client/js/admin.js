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

  // Helper to compute client-side analytics fallback from issues array
  function computeAnalyticsFromIssues(issuesList) {
    const byCategory = {
      roads: 0, streetlights: 0, water_supply: 0, drainage: 0, garbage: 0,
      traffic: 0, public_property: 0, parks: 0, sanitation: 0, safety_hazard: 0,
      environment: 0, other: 0
    };
    const byStatus = {
      pending: 0, assigned: 0, in_progress: 0, resolved: 0, rejected: 0
    };

    (issuesList || []).forEach(issue => {
      let rawCat = (issue.category || '').toLowerCase().trim().replace(/ /g, '_');
      if (rawCat === 'pothole' || rawCat === 'road') rawCat = 'roads';
      if (rawCat === 'leakage' || rawCat === 'water') rawCat = 'water_supply';
      if (rawCat === 'street_light' || rawCat === 'streetlight') rawCat = 'streetlights';
      if (byCategory.hasOwnProperty(rawCat)) byCategory[rawCat]++;
      else byCategory['other']++;

      let rawStatus = (issue.status || '').toLowerCase().trim();
      if (rawStatus === 'resolved' || rawStatus === 'completed' || rawStatus === 'closed' || rawStatus === 'verified') byStatus.resolved++;
      else if (rawStatus === 'assigned') byStatus.assigned++;
      else if (rawStatus === 'in_progress' || rawStatus === 'investigating') byStatus.in_progress++;
      else if (rawStatus === 'rejected' || rawStatus === 'declined') byStatus.rejected++;
      else byStatus.pending++;
    });

    return {
      totalComplaints: (issuesList || []).length,
      byCategory,
      byStatus
    };
  }

  // ----------------------------------------------------
  // SERVICE 1: DashboardService ( Caseload & KPIs )
  // ----------------------------------------------------
  window.DashboardService = {
    cachedAnalytics: null,

    init: async function() {
      // Load all dashboard widgets in parallel for faster initial render
      await Promise.allSettled([
        this.loadKPIs(),
        this.loadRecentAssigned(),
        this.loadPriorityCases(),
        this.loadActivityLog()
      ]);
    },

    applyAnalyticsData: function(analytics) {
      if (!analytics) return;
      const totalEl = document.getElementById('kpi-total');
      const pendingEl = document.getElementById('kpi-pending');
      const resolvedEl = document.getElementById('kpi-resolved');

      const catContainer = document.getElementById('chart-categories-container');
      const statContainer = document.getElementById('chart-statuses-container');
      const perfContainer = document.getElementById('chart-performance-container');

      if (totalEl) totalEl.textContent = analytics.totalComplaints;
      if (pendingEl) pendingEl.textContent = analytics.byStatus ? (analytics.byStatus.pending || 0) : 0;
      if (resolvedEl) resolvedEl.textContent = analytics.byStatus ? (analytics.byStatus.resolved || 0) : 0;

      if (catContainer && !catContainer.querySelector('canvas')) {
        catContainer.innerHTML = '<canvas id="chart-categories"></canvas>';
      }
      if (statContainer && !statContainer.querySelector('canvas')) {
        statContainer.innerHTML = '<canvas id="chart-statuses"></canvas>';
      }
      if (perfContainer && !perfContainer.querySelector('canvas')) {
        perfContainer.innerHTML = '<canvas id="chart-performance"></canvas>';
      }

      this.renderCharts(analytics);
    },

    loadKPIs: async function(forceSkeleton = false) {
      const totalEl = document.getElementById('kpi-total');
      const pendingEl = document.getElementById('kpi-pending');
      const resolvedEl = document.getElementById('kpi-resolved');
      const staffEl = document.getElementById('kpi-staff');

      const catContainer = document.getElementById('chart-categories-container');
      const statContainer = document.getElementById('chart-statuses-container');
      const perfContainer = document.getElementById('chart-performance-container');

      // Instant UI render from cache if available to prevent skeleton delay
      if (this.cachedAnalytics) {
        this.applyAnalyticsData(this.cachedAnalytics);
      } else if (currentComplaints && currentComplaints.length > 0) {
        const computed = computeAnalyticsFromIssues(currentComplaints);
        this.applyAnalyticsData(computed);
      } else if (forceSkeleton || (totalEl && totalEl.querySelector('.skeleton'))) {
        // Show skeleton shimmer on cold initial load only
        if (totalEl) totalEl.innerHTML = '<div class="skeleton" style="width: 40px; height: 1.5rem;"></div>';
        if (pendingEl) pendingEl.innerHTML = '<div class="skeleton" style="width: 40px; height: 1.5rem;"></div>';
        if (resolvedEl) resolvedEl.innerHTML = '<div class="skeleton" style="width: 40px; height: 1.5rem;"></div>';
        if (staffEl) staffEl.innerHTML = '<div class="skeleton" style="width: 40px; height: 1.5rem;"></div>';

        if (catContainer) catContainer.innerHTML = '<div class="skeleton-shimmer skeleton-chart" style="height: 260px;"></div>';
        if (statContainer) statContainer.innerHTML = '<div class="skeleton-shimmer skeleton-chart" style="height: 260px;"></div>';
        if (perfContainer) perfContainer.innerHTML = '<div class="skeleton-shimmer skeleton-chart" style="height: 260px;"></div>';
      }

      try {
        const analyticsPromise = API.getAdminAnalytics();
        const usersPromise = API.getAllUsers();
        const issuesPromise = (currentComplaints && currentComplaints.length) 
          ? Promise.resolve({ data: currentComplaints }) 
          : API.getIssues();

        const [analyticsRes, usersRes, issuesRes] = await Promise.allSettled([
          analyticsPromise,
          usersPromise,
          issuesPromise
        ]);

        let analyticsData = null;

        if (analyticsRes.status === 'fulfilled' && analyticsRes.value && !analyticsRes.value.error) {
          analyticsData = analyticsRes.value.data;
        } else if (issuesRes.status === 'fulfilled' && issuesRes.value && !issuesRes.value.error) {
          currentComplaints = issuesRes.value.data || [];
          analyticsData = computeAnalyticsFromIssues(currentComplaints);
        }

        if (analyticsData) {
          this.cachedAnalytics = analyticsData;
          this.applyAnalyticsData(analyticsData);
        }

        if (usersRes.status === 'fulfilled' && usersRes.value && !usersRes.value.error) {
          const count = (usersRes.value.data || []).filter(u => u.role === 'authority' || u.role === 'admin').length;
          if (staffEl) staffEl.textContent = count;
        }
      } catch (err) {
        console.error("loadKPIs error:", err);
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

    loadComplaints: async function(forceSpinner = false) {
      const listEl = document.getElementById('admin-complaints-list');
      if (!listEl) return;

      // Render cached data immediately if available to eliminate loading delays
      if (currentComplaints && currentComplaints.length > 0 && this.cachedAuthorities) {
        this.renderComplaints(this.cachedAuthorities);
      } else if (forceSpinner || !listEl.children.length) {
        listEl.innerHTML = `
          <div style="text-align: center; padding: 3rem; color: var(--text-muted); background-color:var(--bg-surface); border:1px solid var(--border-color); border-radius:var(--radius-md);">
            <i class="fa-solid fa-spinner fa-spin" style="margin-right:0.5rem; font-size:1.5rem;"></i> Loading complaints queue...
          </div>
        `;
      }

      try {
        const [issuesRes, usersRes] = await Promise.all([
          API.getIssues(),
          API.getAllUsers()
        ]);

        if (issuesRes.error) throw new Error(issuesRes.error);
        if (usersRes.error) throw new Error(usersRes.error);

        currentComplaints = issuesRes.data || [];
        const authorities = (usersRes.data || []).filter(u => u.role === 'authority' || u.role === 'admin');
        this.cachedAuthorities = authorities;
        this.renderComplaints(authorities);
      } catch (err) {
        console.error("ComplaintService load error:", err);
        if (!currentComplaints || currentComplaints.length === 0) {
          listEl.innerHTML = `
            <div style="text-align: center; padding: 3rem;">
              <div class="error-retry-card" style="display:inline-block; background-color: var(--bg-surface); border: 1px dashed #ef4444; border-radius: var(--radius-md); padding: 1.5rem; text-align: center; max-width:400px;">
                <i class="fa-solid fa-triangle-exclamation" style="color: #ef4444; font-size: 1.5rem; margin-bottom: 0.5rem;"></i>
                <p style="font-weight: 600; font-size: 0.88rem; color: var(--text-main); margin: 0;">Failed to load complaints</p>
                <button onclick="window.ComplaintService.loadComplaints(true)" class="btn" style="margin-top:0.75rem; padding: 0.4rem 0.8rem; font-size: 0.75rem; border: 1px solid var(--border-color); background: var(--bg-surface); color: var(--text-main); cursor: pointer; border-radius: var(--radius-sm);">
                  <i class="fa-solid fa-rotate-right"></i> Retry
                </button>
              </div>
            </div>
          `;
        }
      }
    },

    renderComplaints: function(authorities) {
      const listEl = document.getElementById('admin-complaints-list');
      
      if (this.pendingFilterStatus !== undefined) {
        const targetStatus = this.pendingFilterStatus;
        this.pendingFilterStatus = undefined;
        const filterPills = document.querySelectorAll('#admin-status-filters .filter-pill');
        filterPills.forEach(pill => {
          const statusAttr = pill.getAttribute('data-status') || '';
          if (statusAttr === targetStatus || (targetStatus === 'all' && statusAttr === '')) {
            pill.classList.add('active');
          } else {
            pill.classList.remove('active');
          }
        });
      }

      const activeFilterPill = document.querySelector('#admin-status-filters .filter-pill.active');
      const rawFilterStatus = activeFilterPill ? (activeFilterPill.getAttribute('data-status') || '') : '';
      const filterStatus = rawFilterStatus.toLowerCase().trim();
      if (!listEl) return;

      const filtered = currentComplaints.filter(c => {
        if (!filterStatus || filterStatus === '' || filterStatus === 'all') return true;
        const cStatus = (c.status || 'pending').toLowerCase().trim();

        if (filterStatus === 'pending') {
          return cStatus === 'pending' || cStatus === 'submitted' || cStatus === 'open';
        }
        if (filterStatus === 'assigned') {
          return cStatus === 'assigned';
        }
        if (filterStatus === 'in_progress') {
          return cStatus === 'in_progress' || cStatus === 'in progress' || cStatus === 'investigating';
        }
        if (filterStatus === 'resolved') {
          return cStatus === 'resolved' || cStatus === 'verified' || cStatus === 'closed';
        }
        if (filterStatus === 'rejected') {
          return cStatus === 'rejected' || cStatus === 'declined';
        }
        return cStatus === filterStatus;
      });

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
        const photoUrl = issue.image_url || issue.photo_url || issue.media_url || null;

        return `
          <div class="complaint-admin-card ${issue.is_emergency ? 'emergency-card-glow' : ''}" id="card-${issue.id}" style="cursor: pointer; position: relative;" onclick="window.ComplaintService.openDetailModal('${issue.id}')">
            <div style="display:flex; justify-content:space-between; align-items:start; flex-wrap:wrap; gap:1rem;">
              <div style="display: flex; gap: 1rem; align-items: start; flex: 1;">
                ${photoUrl ? `
                  <div style="width: 80px; height: 80px; border-radius: 8px; overflow: hidden; background: #0f172a; flex-shrink: 0; border: 1px solid var(--border-color);">
                    <img src="${photoUrl}" alt="Evidence Thumbnail" style="width: 100%; height: 100%; object-fit: cover;" />
                  </div>
                ` : `
                  <div style="width: 80px; height: 80px; border-radius: 8px; background: var(--slate-100); flex-shrink: 0; border: 1px solid var(--border-color); display: flex; align-items: center; justify-content: center; color: var(--text-muted);">
                    <i class="fa-solid fa-image-slash" style="font-size: 1.2rem; opacity: 0.5;"></i>
                  </div>
                `}
                <div style="flex: 1;">
                  <div>
                    ${issue.is_emergency ? `<span class="badge" style="background-color: #ef4444; color: white; text-transform: uppercase; font-size: 0.72rem; margin-right: 0.5rem; display: inline-block; animation: pulse-red 1.5s infinite;"><i class="fa-solid fa-triangle-exclamation"></i> EMERGENCY</span>` : ''}
                    <span class="badge" style="background-color: var(--primary); color: white; text-transform: uppercase; font-size: 0.72rem; margin-right: 0.5rem; display: inline-block;">
                      ${catNames[issue.category] || 'Other'}
                    </span>
                  </div>
                  <h3 style="font-size: 1.15rem; font-weight: 700; margin: 0.35rem 0 0.25rem 0; color: var(--text-main);">${escapeHTML(issue.title)}</h3>
                  <p style="color:var(--text-muted); font-size:0.85rem; margin:0; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${escapeHTML(issue.description)}</p>
                </div>
              </div>

              <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 0.5rem;">
                <span class="badge badge-status ${issue.status}" style="text-transform: uppercase; font-size: 0.72rem; padding: 0.3rem 0.65rem;">
                  ${statusText}
                </span>
                ${photoUrl ? `<span style="font-size: 0.72rem; font-weight: 700; color: #10b981; background: rgba(16,185,129,0.1); padding: 0.15rem 0.5rem; border-radius: 4px;"><i class="fa-solid fa-camera"></i> Photo Proof</span>` : ''}
              </div>
            </div>

            <div style="font-size:0.8rem; color:var(--text-muted); display:flex; gap:1.5rem; flex-wrap:wrap; margin-top:0.75rem; border-top: 1px solid var(--border-color); padding-top:0.55rem; align-items: center;">
              <span><i class="fa-solid fa-location-dot" style="color:#ef4444;"></i> ${escapeHTML(issue.address || 'Address not listed')}</span>
              <span><i class="fa-solid fa-user" style="color:var(--primary);"></i> Reported by: <strong>${escapeHTML(reporterName)}</strong></span>
              <span><i class="fa-solid fa-calendar-days"></i> ${new Date(issue.created_at).toLocaleDateString()}</span>
            </div>

            <!-- Action Toolbar Directly on Card -->
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.75rem; flex-wrap:wrap; gap:0.75rem; background: var(--bg-app); padding: 0.6rem 0.8rem; border-radius: 8px; border: 1px solid var(--border-color);" onclick="event.stopPropagation();">
              <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap: wrap;">
                <span style="font-size:0.78rem; font-weight:700; color:var(--text-main);"><i class="fa-solid fa-user-gear"></i> Delegate:</span>
                <select class="form-select complaint-delegate-select" data-issue-id="${issue.id}" style="margin: 0; padding: 0.3rem 0.5rem; font-size: 0.78rem; width: auto; cursor:pointer; border-radius: 6px;">
                  <option value="">-- Not Assigned --</option>
                  ${dropdownOptions}
                </select>
              </div>

              <!-- Quick Status Buttons on Card -->
              <div style="display: flex; gap: 0.35rem; flex-wrap: wrap; align-items: center;">
                <button type="button" onclick="event.stopPropagation(); window.ComplaintService.updateStatus('${issue.id}', 'assigned')" class="btn" style="background: #3b82f6; color: white; border: none; padding: 0.35rem 0.6rem; font-size: 0.72rem; font-weight: 700; border-radius: 6px; cursor: pointer;">
                  <i class="fa-solid fa-user-check"></i> Assign
                </button>
                <button type="button" onclick="event.stopPropagation(); window.ComplaintService.updateStatus('${issue.id}', 'in_progress')" class="btn" style="background: #8b5cf6; color: white; border: none; padding: 0.35rem 0.6rem; font-size: 0.72rem; font-weight: 700; border-radius: 6px; cursor: pointer;">
                  <i class="fa-solid fa-spinner"></i> In Progress
                </button>
                <button type="button" onclick="event.stopPropagation(); window.ComplaintService.updateStatus('${issue.id}', 'resolved')" class="btn" style="background: #10b981; color: white; border: none; padding: 0.35rem 0.6rem; font-size: 0.72rem; font-weight: 700; border-radius: 6px; cursor: pointer;">
                  <i class="fa-solid fa-circle-check"></i> Resolve
                </button>
                <button type="button" onclick="event.stopPropagation(); window.ComplaintService.updateStatus('${issue.id}', 'rejected')" class="btn" style="background: #ef4444; color: white; border: none; padding: 0.35rem 0.6rem; font-size: 0.72rem; font-weight: 700; border-radius: 6px; cursor: pointer;">
                  <i class="fa-solid fa-circle-xmark"></i> Reject
                </button>
                <button type="button" onclick="event.stopPropagation(); window.ComplaintService.openDetailModal('${issue.id}')" class="btn btn-primary" style="padding: 0.35rem 0.65rem; font-size: 0.72rem; font-weight: 700; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 0.3rem;">
                  <i class="fa-solid fa-arrow-up-right-from-square"></i> Details & Live Chat
                </button>
              </div>
            </div>
          </div>
        `;
      }).join('');

      this.bindCardActions(authorities);
    },

    activeDetailIssueId: null,

    openDetailModal: async function(issueId) {
      this.activeDetailIssueId = issueId;
      const issue = (currentComplaints || []).find(c => c.id === issueId);
      const modal = document.getElementById('modal-complaint-detail');
      if (!modal) return;

      if (!issue) {
        showToast("Complaint not found", "error");
        return;
      }

      // Populate Header
      document.getElementById('detail-title').textContent = issue.title || 'Complaint Details';
      document.getElementById('detail-ticket-id').textContent = `#${(issue.id || '').substring(0, 8)}`;
      
      const emerBadge = document.getElementById('detail-emergency-badge');
      if (emerBadge) emerBadge.style.display = issue.is_emergency ? 'inline-block' : 'none';

      const catBadge = document.getElementById('detail-category-badge');
      if (catBadge) catBadge.textContent = (window.formatCategoryName ? window.formatCategoryName(issue.category) : (issue.category || 'OTHER')).toUpperCase();

      const statusBadge = document.getElementById('detail-status-badge');
      if (statusBadge) {
        statusBadge.textContent = (issue.status || 'pending').replace('_', ' ').toUpperCase();
        statusBadge.className = `badge badge-status ${issue.status}`;
      }

      // Populate Photo
      const photoUrl = issue.image_url || issue.photo_url || issue.media_url || null;
      const imgEl = document.getElementById('detail-photo-img');
      const fallbackEl = document.getElementById('detail-photo-fallback');
      const photoBadge = document.getElementById('detail-photo-badge');

      if (photoUrl && imgEl && fallbackEl) {
        imgEl.src = photoUrl;
        imgEl.style.display = 'block';
        fallbackEl.style.display = 'none';
        if (photoBadge) {
          photoBadge.textContent = 'ATTACHED';
          photoBadge.style.background = 'rgba(16, 185, 129, 0.15)';
          photoBadge.style.color = '#10b981';
        }
      } else if (imgEl && fallbackEl) {
        imgEl.style.display = 'none';
        fallbackEl.style.display = 'block';
        if (photoBadge) {
          photoBadge.textContent = 'NO PHOTO';
          photoBadge.style.background = 'rgba(148, 163, 184, 0.15)';
          photoBadge.style.color = '#64748b';
        }
      }

      // Populate Meta
      document.getElementById('detail-description').textContent = issue.description || 'No description provided.';
      document.getElementById('detail-address').textContent = issue.address || 'Location coordinates registered';
      
      const coordsLink = document.getElementById('detail-coords-link');
      if (coordsLink) {
        const lat = issue.latitude || 11.0168;
        const lng = issue.longitude || 76.9558;
        coordsLink.textContent = `${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)} (Open Map)`;
        coordsLink.href = `https://maps.google.com/?q=${lat},${lng}`;
      }

      const reporterName = issue.reporter ? (issue.reporter.full_name || 'Anonymous Citizen') : 'Anonymous Citizen';
      document.getElementById('detail-reporter').textContent = reporterName;
      document.getElementById('detail-date').textContent = new Date(issue.created_at).toLocaleString();
      document.getElementById('detail-ai-summary').textContent = issue.ai_summary || `Categorized as ${issue.category} with ${issue.is_emergency ? 'HIGH EMERGENCY' : 'standard'} priority. Automatically routed for department inspection.`;

      // Populate Delegate Dropdown
      const delegateSelect = document.getElementById('detail-delegate-select');
      if (delegateSelect && this.cachedAuthorities) {
        delegateSelect.innerHTML = `<option value="">-- Unassigned --</option>` + this.cachedAuthorities.map(auth => {
          return `<option value="${auth.id}" ${issue.assigned_to === auth.id ? 'selected' : ''}>${auth.full_name} (${auth.role})</option>`;
        }).join('');
      }

      // Clear Remarks & Proof inputs
      document.getElementById('detail-remarks-input').value = issue.official_remarks || '';
      document.getElementById('detail-proof-photo').value = issue.completion_photo_url || '';

      // Load Chat Thread
      this.loadChatMessages(issueId);

      // Open Modal
      modal.classList.add('active');
    },

    closeDetailModal: function() {
      const modal = document.getElementById('modal-complaint-detail');
      if (modal) modal.classList.remove('active');
      this.activeDetailIssueId = null;
    },

    updateStatus: async function(issueId, newStatus) {
      try {
        showToast(`Updating status to ${newStatus.replace('_', ' ')}...`);
        const res = await API.updateIssueStatus(issueId, { status: newStatus });
        if (res.error) throw new Error(res.error);

        showToast(`Status updated to ${newStatus.replace('_', ' ')}!`);
        await this.loadComplaints();
        
        if (this.activeDetailIssueId === issueId) {
          const statusBadge = document.getElementById('detail-status-badge');
          if (statusBadge) {
            statusBadge.textContent = newStatus.replace('_', ' ').toUpperCase();
            statusBadge.className = `badge badge-status ${newStatus}`;
          }
        }
      } catch (err) {
        console.error("updateStatus error:", err);
        showToast("Failed to update status: " + err.message, "error");
      }
    },

    handleModalStatusAction: async function(newStatus) {
      if (!this.activeDetailIssueId) return;
      await this.updateStatus(this.activeDetailIssueId, newStatus);
    },

    saveModalStatusUpdate: async function() {
      if (!this.activeDetailIssueId) return;
      const issueId = this.activeDetailIssueId;
      const remarks = document.getElementById('detail-remarks-input').value.trim();
      const proofPhoto = document.getElementById('detail-proof-photo').value.trim();
      const inspectorId = document.getElementById('detail-delegate-select').value;

      try {
        showToast("Saving changes...");
        if (inspectorId !== undefined) {
          await API.assignIssue(issueId, inspectorId || null);
        }

        const updateData = {
          official_remarks: remarks,
          completion_photo_url: proofPhoto
        };
        const res = await API.updateIssueStatus(issueId, updateData);
        if (res.error) throw new Error(res.error);

        showToast("Complaint details updated successfully!");
        await this.loadComplaints();
      } catch (err) {
        console.error("saveModalStatusUpdate error:", err);
        showToast("Failed to save updates: " + err.message, "error");
      }
    },

    loadChatMessages: async function(issueId) {
      const threadEl = document.getElementById('detail-chat-thread');
      if (!threadEl) return;

      try {
        const { data: comments, error } = await API.request(`/issues/${issueId}/comments`, { method: 'GET' });
        const list = (comments || []);

        if (list.length === 0) {
          threadEl.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 0.78rem; margin: auto;">No messages yet. Start live chat below!</div>`;
          return;
        }

        threadEl.innerHTML = list.map(c => {
          const isAuthority = c.user_role === 'authority' || c.user_role === 'admin';
          const senderName = c.user_name || (isAuthority ? 'Authority Officer' : 'Citizen');
          const timeStr = new Date(c.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          return `
            <div style="background: ${isAuthority ? 'rgba(13,148,136,0.1)' : 'var(--bg-surface)'}; border: 1px solid ${isAuthority ? 'rgba(13,148,136,0.3)' : 'var(--border-color)'}; padding: 0.45rem 0.65rem; border-radius: 8px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.2rem;">
                <span style="font-size: 0.75rem; font-weight: 700; color: ${isAuthority ? 'var(--primary)' : 'var(--text-main)'};">
                  ${isAuthority ? '<i class="fa-solid fa-user-shield"></i> ' : '<i class="fa-solid fa-user"></i> '}${escapeHTML(senderName)}
                </span>
                <span style="font-size: 0.65rem; color: var(--text-muted);">${timeStr}</span>
              </div>
              <p style="margin: 0; font-size: 0.82rem; color: var(--text-main); line-height: 1.35;">${escapeHTML(c.comment_text || c.message || '')}</p>
            </div>
          `;
        }).join('');

        threadEl.scrollTop = threadEl.scrollHeight;
      } catch (err) {
        console.error("loadChatMessages error:", err);
        threadEl.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 0.78rem; margin: auto;">Ready for live chat!</div>`;
      }
    },

    sendDetailChatMessage: async function(e) {
      e.preventDefault();
      if (!this.activeDetailIssueId) return;
      const issueId = this.activeDetailIssueId;
      const inputEl = document.getElementById('detail-chat-input');
      const text = inputEl ? inputEl.value.trim() : '';
      if (!text) return;

      inputEl.value = '';
      try {
        const res = await API.addComment(issueId, text);
        if (res.error) throw new Error(res.error);
        showToast("Message sent to citizen!");
        await this.loadChatMessages(issueId);
      } catch (err) {
        console.error("sendDetailChatMessage error:", err);
      }
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
    },

    bindFilters: function() {
      const pills = document.querySelectorAll('#admin-status-filters .filter-pill');
      pills.forEach(pill => {
        pill.replaceWith(pill.cloneNode(true)); // remove old listeners
      });

      document.querySelectorAll('#admin-status-filters .filter-pill').forEach(pill => {
        pill.addEventListener('click', async (e) => {
          const targetPill = e.target.closest('.filter-pill');
          if (!targetPill) return;

          document.querySelectorAll('#admin-status-filters .filter-pill').forEach(p => p.classList.remove('active'));
          targetPill.classList.add('active');

          const authorities = this.cachedAuthorities || [];
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
        const [usersRes, deptsRes] = await Promise.all([
          API.getAllUsers(),
          API.getDepartments()
        ]);

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
  const ADMIN_ONLY_TABS = ['users', 'settings'];

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

    // Lazy load initialization
    if (tabId === 'dashboard') window.DashboardService.init();
    else if (tabId === 'complaints') window.ComplaintService.init();
    else if (tabId === 'transportation') window.TransportationService.init();
    else if (tabId === 'services') window.GovernmentService.init();
    else if (tabId === 'users') window.UserService.init();
    else if (tabId === 'settings') window.SettingsService.init();
  }

  // Global handler for clicking top metric cards to navigate to complaints tab & filter
  window.filterComplaintsByStatus = function(targetStatus) {
    if (window.ComplaintService) {
      window.ComplaintService.pendingFilterStatus = targetStatus;
    }
    
    // Switch active pane & sidebar tab immediately
    window.location.hash = '#complaints';
    showTab('complaints');

    // Also update filter pill state in DOM immediately for visual feedback
    const filterPills = document.querySelectorAll('#admin-status-filters .filter-pill');
    filterPills.forEach(pill => {
      const statusAttr = pill.getAttribute('data-status') || '';
      if (statusAttr === targetStatus || (targetStatus === 'all' && statusAttr === '')) {
        pill.classList.add('active');
      } else {
        pill.classList.remove('active');
      }
    });

    if (window.ComplaintService && window.ComplaintService.cachedAuthorities && window.ComplaintService.cachedAuthorities.length > 0) {
      window.ComplaintService.renderComplaints(window.ComplaintService.cachedAuthorities);
    }
  };

  // ----------------------------------------------------
  // TRANSPORTATION MODULE SERVICE (v3.2)
  // ----------------------------------------------------
  window.TransportationService = {
    initialized: false,
    reports: [],

    async init() {
      if (!this.initialized) {
        this.bindListeners();
        this.initialized = true;
      }
      await this.loadReports();
    },

    bindListeners() {
      const searchInput = document.getElementById('admin-trans-search');
      const catFilter = document.getElementById('admin-trans-filter-category');
      const statusFilter = document.getElementById('admin-trans-filter-status');
      const priorityFilter = document.getElementById('admin-trans-filter-priority');

      let debounce = null;
      if (searchInput) {
        searchInput.oninput = () => {
          clearTimeout(debounce);
          debounce = setTimeout(() => this.loadReports(), 300);
        };
      }

      if (catFilter) catFilter.onchange = () => this.loadReports();
      if (statusFilter) statusFilter.onchange = () => this.loadReports();
      if (priorityFilter) priorityFilter.onchange = () => this.loadReports();
    },

    async loadReports() {
      const tbody = document.getElementById('admin-trans-table-body');
      if (!tbody) return;

      const category = document.getElementById('admin-trans-filter-category')?.value || 'All';
      const status = document.getElementById('admin-trans-filter-status')?.value || 'All';
      const priority = document.getElementById('admin-trans-filter-priority')?.value || 'All';
      const search = document.getElementById('admin-trans-search')?.value || '';

      try {
        const res = await window.API.getTransportationReports({ category, status, priority, search });
        const reports = (res && res.data && res.data.reports) ? res.data.reports : ((res && res.reports) ? res.reports : []);
        this.reports = reports;
        this.renderTable(this.reports);
      } catch (err) {
        console.error('Error loading admin transportation reports:', err);
        tbody.innerHTML = `<tr><td colspan="7" style="padding: 1.5rem; text-align: center; color: #ef4444;">Failed to load reports. Please try again.</td></tr>`;
      }
    },

    renderTable(reports) {
      const tbody = document.getElementById('admin-trans-table-body');
      if (!tbody) return;

      if (!reports || reports.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="padding: 2rem; text-align: center; color: var(--text-muted);">No transportation reports match current filters.</td></tr>`;
        return;
      }

      tbody.innerHTML = reports.map(r => `
        <tr style="border-bottom: 1px solid var(--border-color);">
          <td style="padding: 0.85rem 1rem; font-weight: 800; color: var(--primary);">${escapeHTML(r.report_number || r.id)}</td>
          <td style="padding: 0.85rem 1rem;">
            <div style="font-weight: 700; color: var(--text-main);">${escapeHTML(r.title)}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHTML(r.category)}</div>
          </td>
          <td style="padding: 0.85rem 1rem;">
            <span class="priority-pill priority-${(r.priority || 'Medium').toLowerCase()}">${escapeHTML(r.priority || 'Medium')}</span>
          </td>
          <td style="padding: 0.85rem 1rem; font-size: 0.78rem; font-weight: 600;">${escapeHTML(r.responsible_department || 'Roads Dept')}</td>
          <td style="padding: 0.85rem 1rem; font-size: 0.78rem;">${escapeHTML(r.assigned_to || 'Unassigned')}</td>
          <td style="padding: 0.85rem 1rem;">
            <span class="status-badge status-${(r.status || 'submitted').toLowerCase().replace(' ', '-')}">${escapeHTML(r.status)}</span>
          </td>
          <td style="padding: 0.85rem 1rem; text-align: right;">
            <button onclick="openTransModal('${escapeHTML(r.id)}')" class="btn btn-outline" style="font-size: 0.75rem; padding: 0.3rem 0.6rem; border-radius: 6px;">
              <i class="fa-solid fa-pen-to-square"></i> Manage
            </button>
          </td>
        </tr>
      `).join('');
    }
  };

  window.openTransModal = function(id) {
    const report = window.TransportationService.reports.find(r => r.id === id || r.report_number === id);
    if (!report) return;

    document.getElementById('trans-report-id-input').value = report.id;
    document.getElementById('trans-modal-id').textContent = '#' + (report.report_number || report.id);
    document.getElementById('trans-update-status').value = report.status || 'Submitted';
    document.getElementById('trans-update-engineer').value = report.assigned_to || '';
    document.getElementById('trans-update-remarks').value = '';
    document.getElementById('trans-update-photo').value = '';

    const aiBox = document.getElementById('trans-modal-ai-details');
    if (aiBox) {
      aiBox.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-bottom: 0.5rem; font-size: 0.8rem;">
          <div><strong>Category:</strong> ${escapeHTML(report.category)}</div>
          <div><strong>Priority:</strong> <span style="font-weight: 800; color: #fbbf24;">${escapeHTML(report.priority || 'Medium')}</span></div>
          <div><strong>Severity Score:</strong> ${report.severity_score || 5} / 10</div>
          <div><strong>Dept:</strong> ${escapeHTML(report.responsible_department || 'Roads Dept')}</div>
        </div>
        <div style="font-size: 0.78rem; color: #cbd5e1; font-style: italic;">
          "${escapeHTML(report.summary || report.description || 'No summary')}"
        </div>
        <div style="margin-top: 0.4rem; font-size: 0.78rem; color: #34d399; font-weight: 600;">
          Suggested Action: ${escapeHTML(report.suggested_resolution || 'Inspect location and assign repair unit.')}
        </div>
      `;
    }

    const modal = document.getElementById('modal-update-transportation');
    if (modal) modal.classList.add('active');
  };

  window.closeTransModal = function() {
    const modal = document.getElementById('modal-update-transportation');
    if (modal) modal.classList.remove('active');
  };

  window.handleTransUpdateSubmit = async function(e) {
    e.preventDefault();
    const id = document.getElementById('trans-report-id-input').value;
    const status = document.getElementById('trans-update-status').value;
    const assigned_to = document.getElementById('trans-update-engineer').value;
    const remarks = document.getElementById('trans-update-remarks').value;
    const photo = document.getElementById('trans-update-photo').value;

    try {
      const res = await window.API.updateTransportationReportStatus(id, {
        status,
        assigned_to,
        remarks,
        completion_photo_url: photo
      });

      if (res && res.success) {
        showToast(`Transportation report ${res.report.report_number || id} updated successfully!`, 'success');
        closeTransModal();
        await window.TransportationService.loadReports();
      }
    } catch (err) {
      console.error('Error updating transportation report:', err);
      showToast('Failed to update report status.', 'error');
    }
  };

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
    const widget = document.getElementById('header-datetime-widget');
    if (widget) widget.remove();
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
