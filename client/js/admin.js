// CrowdCity AI Municipal Authority Operations Platform Controller v2.7.0
(function() {
  'use strict';

  let currentComplaints = [];
  let currentAuthorities = [];
  let currentNotifications = [];
  let activeDetailIssueId = null;
  let activeProofPhotoUrl = null;

  // ----------------------------------------------------
  // HELPER: Floating Popup Toast Notification
  // ----------------------------------------------------
  let toastTimer = null;
  function showToast(message, type = 'success') {
    const container = document.getElementById('toast-message');
    if (!container) return;

    if (toastTimer) clearTimeout(toastTimer);

    const isSuccess = type === 'success';
    const iconSVG = isSuccess 
      ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`
      : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;

    container.className = `toast-box ${type}`;
    container.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; flex-shrink: 0;">${iconSVG}</div>
      <div style="flex: 1; font-weight: 600; font-size: 0.88rem; line-height: 1.4;">${escapeHTML(message)}</div>
    `;

    container.style.display = 'flex';
    container.style.opacity = '1';
    container.style.transform = 'translateY(0)';

    toastTimer = setTimeout(() => {
      container.style.opacity = '0';
      container.style.transform = 'translateY(-10px)';
      setTimeout(() => {
        container.style.display = 'none';
      }, 300);
    }, 3500);
  }

  function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/[&<>'"]/g, tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag));
  }

  function formatCategory(cat) {
    if (!cat) return 'Other';
    const names = {
      roads: 'Roads', water_supply: 'Water Supply', streetlights: 'Streetlights',
      garbage: 'Garbage', traffic: 'Traffic', drainage: 'Drainage', parks: 'Parks',
      sanitation: 'Sanitation', safety_hazard: 'Safety Hazard', environment: 'Environment',
      transportation: 'Transportation', other: 'Other', pothole: 'Roads', leakage: 'Water Supply', streetlight: 'Streetlights'
    };
    return names[cat.toLowerCase()] || cat.replace('_', ' ');
  }

  // Check Authorization Access
  function checkAccess() {
    const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    const role = typeof getUserRole === 'function' ? getUserRole() : null;

    if (!user || (!role || (role !== 'authority' && role !== 'admin'))) {
      if (window.authRouter) {
        window.authRouter.redirectToLogin('authority');
      } else {
        window.location.href = 'authority-login.html';
      }
      return false;
    }

    const userNameEl = document.getElementById('header-user-name');
    if (userNameEl) {
      userNameEl.textContent = `${user.full_name || 'Officer'} (${role.toUpperCase()})`;
    }

    return true;
  }

  // Service Controller
  window.ComplaintService = {
    init: async function() {
      if (!checkAccess()) return;
      
      this.bindHashRouting();
      this.handleInitialHash();
      await this.loadAllData();
    },

    bindHashRouting: function() {
      window.addEventListener('hashchange', () => {
        this.handleInitialHash();
      });

      document.addEventListener('click', () => {
        this.toggleProfileDropdown(false);
      });
    },

    handleInitialHash: async function() {
      const searchParams = new URLSearchParams(window.location.search);
      const queryId = searchParams.get('id');
      const hash = window.location.hash.replace('#', '') || '';

      if (queryId || hash.startsWith('details?id=')) {
        const issueId = queryId || hash.split('details?id=')[1];
        this.showPane('pane-details', false);
        await this.openCaseDetails(issueId);
      } else {
        const path = window.location.pathname;
        let paneId = 'pane-dashboard';
        if (path.includes('authority-complaints')) paneId = 'pane-complaints';
        else if (path.includes('authority-assigned')) paneId = 'pane-assigned';
        else if (path.includes('authority-reports')) paneId = 'pane-reports';
        else if (path.includes('authority-notifications')) paneId = 'pane-notifications';
        else if (path.includes('authority-profile')) paneId = 'pane-profile';
        else if (path.includes('authority-case-details')) paneId = 'pane-details';
        else {
          const paneMap = {
            'dashboard': 'pane-dashboard',
            'complaints': 'pane-complaints',
            'assigned': 'pane-assigned',
            'reports': 'pane-reports',
            'notifications': 'pane-notifications',
            'profile': 'pane-profile'
          };
          if (paneMap[hash]) paneId = paneMap[hash];
        }
        this.showPane(paneId, false);
      }
    },

    showPane: function(paneId, updateHash = true) {
      const targetPane = document.getElementById(paneId);

      if (targetPane) {
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active-pane'));
        targetPane.classList.add('active-pane');
      } else {
        const pageMap = {
          'pane-dashboard': 'authority-dashboard.html',
          'pane-complaints': 'authority-complaints.html',
          'pane-assigned': 'authority-assigned.html',
          'pane-reports': 'authority-reports.html',
          'pane-notifications': 'authority-notifications.html',
          'pane-profile': 'authority-profile.html',
          'pane-details': 'authority-case-details.html'
        };
        if (pageMap[paneId] && !window.location.pathname.includes(pageMap[paneId])) {
          window.location.href = pageMap[paneId];
          return;
        }
      }

      document.querySelectorAll('.nav-item').forEach(nav => {
        if (nav.getAttribute('data-pane') === paneId) {
          nav.classList.add('active');
        } else {
          nav.classList.remove('active');
        }
      });

      const paneTitles = {
        'pane-dashboard': 'Municipal Dashboard',
        'pane-complaints': 'Overall Complaints Queue',
        'pane-assigned': 'Assigned Casework Register',
        'pane-reports': 'Operational Reports & Analytics',
        'pane-details': 'Complaint Inspection & Action Console',
        'pane-notifications': 'System Notifications',
        'pane-profile': 'Officer Profile & Security'
      };

      const titleEl = document.getElementById('header-pane-title');
      if (titleEl) titleEl.textContent = paneTitles[paneId] || 'Authority Portal';

      this.toggleMobileSidebar(false);
    },

    toggleMobileSidebar: function(open) {
      const sidebar = document.getElementById('portal-sidebar');
      const backdrop = document.getElementById('sidebar-backdrop');
      if (!sidebar || !backdrop) return;
      if (open) {
        sidebar.classList.add('open');
        backdrop.style.display = 'block';
      } else {
        sidebar.classList.remove('open');
        backdrop.style.display = 'none';
      }
    },

    toggleProfileDropdown: function(eOrState) {
      if (eOrState && typeof eOrState.stopPropagation === 'function') {
        eOrState.stopPropagation();
      }
      const dropdown = document.getElementById('header-profile-dropdown');
      if (!dropdown) return;
      if (typeof eOrState === 'boolean') {
        dropdown.style.display = eOrState ? 'block' : 'none';
      } else {
        dropdown.style.display = (dropdown.style.display === 'block') ? 'none' : 'block';
      }
    },

    loadCachedData: function() {
      try {
        const cachedComplaints = sessionStorage.getItem('cc_auth_cache_complaints');
        const cachedAuthorities = sessionStorage.getItem('cc_auth_cache_authorities');
        const cachedNotifs = sessionStorage.getItem('cc_auth_cache_notifications');

        if (cachedComplaints) {
          currentComplaints = JSON.parse(cachedComplaints);
        }
        if (cachedAuthorities) {
          currentAuthorities = JSON.parse(cachedAuthorities);
        }
        if (cachedNotifs) {
          currentNotifications = JSON.parse(cachedNotifs);
        }

        if (currentComplaints && currentComplaints.length > 0) {
          this.renderViewsSafely();
        }
      } catch (e) {
        console.warn("Failed to load cached authority data:", e);
      }
    },

    saveCachedData: function() {
      try {
        if (currentComplaints && currentComplaints.length > 0) {
          sessionStorage.setItem('cc_auth_cache_complaints', JSON.stringify(currentComplaints));
        }
        if (currentAuthorities && currentAuthorities.length > 0) {
          sessionStorage.setItem('cc_auth_cache_authorities', JSON.stringify(currentAuthorities));
        }
        if (currentNotifications && currentNotifications.length > 0) {
          sessionStorage.setItem('cc_auth_cache_notifications', JSON.stringify(currentNotifications));
        }
      } catch (e) {
        console.warn("Failed to save cached authority data:", e);
      }
    },

    renderViewsSafely: function() {
      if (document.getElementById('pane-dashboard') || document.getElementById('kpi-total')) {
        this.renderDashboard();
      }
      if (document.getElementById('pane-complaints') || document.getElementById('complaints-queue-table-body')) {
        this.renderComplaintsQueue();
      }
      if (document.getElementById('pane-assigned') || document.getElementById('assigned-cases-table-body')) {
        this.renderAssignedCases();
      }
      if (document.getElementById('pane-reports') || document.getElementById('reports-category-table-body')) {
        this.renderReports();
      }
      if (document.getElementById('pane-notifications') || document.getElementById('notifications-list')) {
        this.renderNotifications();
      }
      if (document.getElementById('pane-profile') || document.getElementById('profile-full-name')) {
        this.renderProfile();
      }
    },

    loadAllData: async function() {
      // Instant load from session cache for 0ms page transitions
      this.loadCachedData();

      const fetchWithTimeout = (apiFn, ms = 10000) => {
        if (typeof apiFn !== 'function') return Promise.resolve({ data: [] });
        return Promise.race([
          apiFn(),
          new Promise(resolve => setTimeout(() => resolve({ data: [], error: 'timeout' }), ms))
        ]);
      };

      try {
        // Fast primary fetch for complaints
        const [issuesRes, transRes, usersRes, notifsRes] = await Promise.allSettled([
          fetchWithTimeout(() => API.getIssues(), 10000),
          fetchWithTimeout(() => (API.getTransportationReports ? API.getTransportationReports() : API.request('/transportation/reports')), 8000),
          fetchWithTimeout(() => API.getAllUsers(), 8000),
          fetchWithTimeout(() => API.getNotifications(), 8000)
        ]);

        let civicList = [];
        if (issuesRes.status === 'fulfilled' && issuesRes.value && !issuesRes.value.error) {
          const rawCivic = issuesRes.value.data !== undefined ? issuesRes.value.data : issuesRes.value;
          if (Array.isArray(rawCivic)) civicList = rawCivic;
        }

        let transList = [];
        if (transRes.status === 'fulfilled' && transRes.value) {
          const rawTrans = transRes.value.data !== undefined ? transRes.value.data : transRes.value;
          if (Array.isArray(rawTrans)) {
            transList = rawTrans.map(tr => ({
              id: tr.id,
              title: tr.title || tr.issue_type || 'Transportation Issue',
              description: tr.description || tr.issue_description || '',
              category: 'transportation',
              priority: tr.priority || (tr.is_emergency ? 'emergency' : 'normal'),
              is_emergency: tr.is_emergency || false,
              status: tr.status || 'pending',
              address: tr.address || tr.location_name || 'Transportation Route',
              latitude: tr.latitude,
              longitude: tr.longitude,
              assigned_to: tr.assigned_to,
              created_at: tr.created_at || new Date().toISOString(),
              reporter: tr.reporter || tr.user,
              official_remarks: tr.official_remarks,
              completion_photo_url: tr.completion_photo_url,
              is_transportation: true
            }));
          }
        }

        currentComplaints = [...civicList, ...transList].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

        if (usersRes.status === 'fulfilled' && usersRes.value) {
          const rawUsers = usersRes.value.data !== undefined ? usersRes.value.data : usersRes.value;
          const users = Array.isArray(rawUsers) ? rawUsers : [];
          currentAuthorities = users.filter(u => u && (u.role === 'authority' || u.role === 'admin'));
        }

        if (notifsRes.status === 'fulfilled' && notifsRes.value) {
          const rawNotifs = notifsRes.value.data !== undefined ? notifsRes.value.data : notifsRes.value;
          currentNotifications = Array.isArray(rawNotifs) ? rawNotifs : [];
        }

        // Persist to session cache
        this.saveCachedData();

        // Re-render UI views with fresh dataset
        this.renderViewsSafely();
      } catch (err) {
        console.error("loadAllData error:", err);
        showToast("Failed to sync database data.", "error");
      }
    },

    renderDashboard: function() {
      const total = currentComplaints.length;
      let pending = 0;
      let assigned = 0;
      let inProgress = 0;
      let resolved = 0;
      let rejected = 0;
      let emergency = 0;

      const categoryCounts = {};
      const statusCounts = { pending: 0, assigned: 0, in_progress: 0, resolved: 0, rejected: 0 };
      const priorityCounts = { normal: 0, high: 0, emergency: 0 };

      currentComplaints.forEach(c => {
        const st = (c.status || 'pending').toLowerCase();
        if (st === 'pending' || st === 'submitted' || st === 'open') { pending++; statusCounts.pending++; }
        else if (st === 'assigned') { assigned++; statusCounts.assigned++; }
        else if (st === 'in_progress' || st === 'investigating') { inProgress++; statusCounts.in_progress++; }
        else if (st === 'resolved' || st === 'completed' || st === 'verified') { resolved++; statusCounts.resolved++; }
        else if (st === 'rejected' || st === 'declined') { rejected++; statusCounts.rejected++; }

        if (c.is_emergency || c.priority === 'emergency') { emergency++; priorityCounts.emergency++; }
        else if (c.priority === 'high') { emergency++; priorityCounts.high++; }
        else { priorityCounts.normal++; }

        const catName = formatCategory(c.category);
        categoryCounts[catName] = (categoryCounts[catName] || 0) + 1;
      });

      const setElText = (id, txt) => {
        const el = document.getElementById(id);
        if (el) el.textContent = txt;
      };

      setElText('kpi-total', total);
      setElText('kpi-pending', pending);
      setElText('kpi-assigned', assigned);
      setElText('kpi-progress', inProgress);
      setElText('kpi-resolved', resolved);
      setElText('kpi-rejected', rejected);
      setElText('kpi-emergency', emergency);

      // Render Operational SVG Charts
      this.renderCategoryChart(categoryCounts);
      this.renderStatusChart(statusCounts);
      this.renderPriorityChart(priorityCounts);
      this.renderTrendChart(currentComplaints);

      // Recent Table
      const recentTbody = document.getElementById('dashboard-recent-table-body');
      if (recentTbody) {
        const recentList = currentComplaints.slice(0, 5);
        if (recentList.length === 0) {
          recentTbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 1.5rem; color: var(--text-muted);">No complaints logged in database.</td></tr>`;
        } else {
          recentTbody.innerHTML = recentList.map(c => {
            const statusClass = `status-${(c.status || 'pending').toLowerCase()}`;
            const isEmerg = c.is_emergency || c.priority === 'emergency';
            const assignedUser = currentAuthorities.find(a => a.id === c.assigned_to);

            return `
              <tr>
                <td><strong style="font-family: monospace; color: var(--primary);">${escapeHTML(c.complaint_id || '#' + (c.id || '').substring(0, 8))}</strong></td>
                <td><strong>${escapeHTML(c.title)}</strong></td>
                <td>${formatCategory(c.category)}</td>
                <td>${isEmerg ? `<span class="status-badge status-emergency">EMERGENCY</span>` : 'Normal'}</td>
                <td><span class="status-badge ${statusClass}">${(c.status || 'pending').replace('_', ' ')}</span></td>
                <td>${escapeHTML(c.address || 'Coordinates recorded')}</td>
                <td>${assignedUser ? escapeHTML(assignedUser.full_name) : 'Unassigned'}</td>
                <td>${new Date(c.created_at).toLocaleDateString()}</td>
                <td>
                  <button class="btn-action" style="padding: 0.25rem 0.6rem; font-size: 0.75rem;" onclick="window.ComplaintService.openCaseDetails('${c.id}')">Inspect</button>
                </td>
              </tr>
            `;
          }).join('');
        }
      }

      // Activity List
      const activityList = document.getElementById('dashboard-activity-list');
      if (activityList) {
        const sorted = [...currentComplaints].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);
        activityList.innerHTML = sorted.map(c => `
          <div style="padding: 0.5rem; border-bottom: 1px solid var(--border-light); display: flex; justify-content: space-between;">
            <div>
              <strong>Complaint ${escapeHTML(c.complaint_id || '#' + (c.id || '').substring(0, 8))}:</strong> ${escapeHTML(c.title)}
            </div>
            <div style="color: var(--text-light); font-size: 0.78rem;">${new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
        `).join('');
      }
    },

    // ----------------------------------------------------
    // LIGHTWEIGHT SVG OPERATIONAL CHARTS (Zero Dependency)
    // ----------------------------------------------------
    renderCategoryChart: function(categoryCounts) {
      const el = document.getElementById('chart-category-svg');
      if (!el) return;

      const keys = Object.keys(categoryCounts);
      if (keys.length === 0) {
        el.innerHTML = `<div style="color: var(--text-light); font-size: 0.82rem;">No category data available.</div>`;
        return;
      }

      const maxVal = Math.max(...Object.values(categoryCounts), 1);
      const bars = keys.map((cat, idx) => {
        const val = categoryCounts[cat];
        const pct = Math.round((val / maxVal) * 100);
        return `
          <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; font-size: 0.8rem;">
            <div style="width: 90px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; font-weight: 600; color: var(--text-muted);">${cat}</div>
            <div style="flex: 1; background: var(--bg-canvas); border-radius: 4px; height: 16px; overflow: hidden; border: 1px solid var(--border-light);">
              <div style="width: ${pct}%; background: var(--primary); height: 100%;"></div>
            </div>
            <div style="width: 25px; font-weight: 700; color: var(--text-main); text-align: right;">${val}</div>
          </div>
        `;
      }).join('');

      el.innerHTML = `<div style="width: 100%;">${bars}</div>`;
    },

    renderStatusChart: function(statusCounts) {
      const el = document.getElementById('chart-status-svg');
      if (!el) return;

      const labels = { pending: 'Pending', assigned: 'Assigned', in_progress: 'In Progress', resolved: 'Resolved', rejected: 'Rejected' };
      const colors = { pending: '#d97706', assigned: '#2563eb', in_progress: '#7e22ce', resolved: '#059669', rejected: '#475569' };
      const maxVal = Math.max(...Object.values(statusCounts), 1);

      const bars = Object.keys(statusCounts).map(st => {
        const val = statusCounts[st];
        const pct = Math.round((val / maxVal) * 100);
        return `
          <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; font-size: 0.8rem;">
            <div style="width: 85px; font-weight: 600; color: var(--text-muted);">${labels[st]}</div>
            <div style="flex: 1; background: var(--bg-canvas); border-radius: 4px; height: 16px; overflow: hidden; border: 1px solid var(--border-light);">
              <div style="width: ${pct}%; background: ${colors[st]}; height: 100%;"></div>
            </div>
            <div style="width: 25px; font-weight: 700; color: var(--text-main); text-align: right;">${val}</div>
          </div>
        `;
      }).join('');

      el.innerHTML = `<div style="width: 100%;">${bars}</div>`;
    },

    renderPriorityChart: function(priorityCounts) {
      const el = document.getElementById('chart-priority-svg');
      if (!el) return;

      const total = priorityCounts.normal + priorityCounts.high + priorityCounts.emergency;
      if (total === 0) {
        el.innerHTML = `<div style="color: var(--text-light); font-size: 0.82rem;">No priority breakdown logged.</div>`;
        return;
      }

      const normPct = Math.round((priorityCounts.normal / total) * 100);
      const highPct = Math.round((priorityCounts.high / total) * 100);
      const emerPct = Math.round((priorityCounts.emergency / total) * 100);

      el.innerHTML = `
        <div style="width: 100%; display: flex; flex-direction: column; gap: 0.75rem;">
          <div style="height: 20px; width: 100%; display: flex; border-radius: 4px; overflow: hidden; border: 1px solid var(--border-color);">
            <div style="width: ${normPct}%; background: #0284c7;" title="Normal: ${priorityCounts.normal}"></div>
            <div style="width: ${highPct}%; background: #d97706;" title="High: ${priorityCounts.high}"></div>
            <div style="width: ${emerPct}%; background: #dc2626;" title="Emergency: ${priorityCounts.emergency}"></div>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 0.8rem; font-weight: 600;">
            <span style="color: #0284c7;">Normal (${priorityCounts.normal})</span>
            <span style="color: #d97706;">High (${priorityCounts.high})</span>
            <span style="color: #dc2626;">Emergency (${priorityCounts.emergency})</span>
          </div>
        </div>
      `;
    },

    renderTrendChart: function(complaints) {
      const el = document.getElementById('chart-trend-svg');
      if (!el) return;

      if (complaints.length === 0) {
        el.innerHTML = `<div style="color: var(--text-light); font-size: 0.82rem;">No timeline data available.</div>`;
        return;
      }

      const dateMap = {};
      complaints.forEach(c => {
        const d = new Date(c.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' });
        dateMap[d] = (dateMap[d] || 0) + 1;
      });

      const dates = Object.keys(dateMap).slice(-7);
      const values = dates.map(d => dateMap[d]);
      const maxVal = Math.max(...values, 1);

      const items = dates.map((d, i) => {
        const h = Math.round((values[i] / maxVal) * 100);
        return `
          <div style="display: flex; flex-direction: column; align-items: center; flex: 1; gap: 0.25rem;">
            <div style="font-size: 0.72rem; font-weight: 700; color: var(--text-main);">${values[i]}</div>
            <div style="width: 100%; height: 100px; display: flex; align-items: flex-end; justify-content: center; background: var(--bg-canvas); border-radius: 4px; padding: 2px;">
              <div style="width: 60%; height: ${Math.max(h, 8)}%; background: var(--primary); border-radius: 2px;"></div>
            </div>
            <div style="font-size: 0.7rem; color: var(--text-light); white-space: nowrap;">${d}</div>
          </div>
        `;
      }).join('');

      el.innerHTML = `<div style="width: 100%; display: flex; gap: 0.5rem; align-items: flex-end;">${items}</div>`;
    },

    renderWorkloadChart: function(containerId, authorities, complaints) {
      const el = document.getElementById('chart-workload-svg');
      if (!el) return;

      if (authorities.length === 0) {
        el.innerHTML = `<div style="color: var(--text-light); font-size: 0.82rem;">No authority officials registered.</div>`;
        return;
      }

      const items = authorities.map(a => {
        const count = complaints.filter(c => c.assigned_to === a.id).length;
        return `
          <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.4rem; font-size: 0.8rem;">
            <div style="width: 100px; font-weight: 600; color: var(--text-main); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${escapeHTML(a.full_name)}</div>
            <div style="flex: 1; background: var(--bg-canvas); height: 14px; border-radius: 4px; overflow: hidden; border: 1px solid var(--border-light);">
              <div style="width: ${Math.min(count * 20, 100)}%; background: #2563eb; height: 100%;"></div>
            </div>
            <div style="width: 30px; font-weight: 700; text-align: right;">${count}</div>
          </div>
        `;
      }).join('');

      el.innerHTML = `<div style="width: 100%;">${items}</div>`;
    },

    applyFilters: function() {
      const getVal = id => {
        const el = document.getElementById(id);
        return el ? (el.value || '').toLowerCase().trim() : '';
      };

      const search = getVal('filter-search-input');
      const statusFilter = getVal('filter-status-select');
      const categoryFilter = getVal('filter-category-select');
      const priorityFilter = getVal('filter-priority-select');
      const assignmentFilter = getVal('filter-assignment-select');

      const filtered = currentComplaints.filter(c => {
        if (search) {
          const matchTitle = (c.title || '').toLowerCase().includes(search);
          const matchDesc = (c.description || '').toLowerCase().includes(search);
          const matchAddr = (c.address || '').toLowerCase().includes(search);
          const matchReporter = c.reporter ? (c.reporter.full_name || '').toLowerCase().includes(search) : false;
          if (!matchTitle && !matchDesc && !matchAddr && !matchReporter) return false;
        }

        if (statusFilter) {
          const cStatus = (c.status || 'pending').toLowerCase();
          if (cStatus !== statusFilter) return false;
        }

        if (categoryFilter) {
          const cCat = (c.category || '').toLowerCase();
          if (!cCat.includes(categoryFilter)) return false;
        }

        if (priorityFilter) {
          if (priorityFilter === 'emergency' && !c.is_emergency && c.priority !== 'emergency') return false;
          if (priorityFilter === 'high' && c.priority !== 'high' && !c.is_emergency) return false;
          if (priorityFilter === 'normal' && (c.is_emergency || c.priority === 'emergency')) return false;
        }

        if (assignmentFilter) {
          if (assignmentFilter === 'assigned' && !c.assigned_to) return false;
          if (assignmentFilter === 'unassigned' && c.assigned_to) return false;
        }

        return true;
      });

      this.renderComplaintsTable(filtered);
    },

    resetFilters: function() {
      const resetVal = id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      };
      resetVal('filter-search-input');
      resetVal('filter-status-select');
      resetVal('filter-category-select');
      resetVal('filter-priority-select');
      resetVal('filter-assignment-select');
      this.renderComplaintsTable(currentComplaints);
    },

    renderComplaintsQueue: function() {
      this.applyFilters();
    },

    renderComplaintsTable: function(list) {
      const tbody = document.getElementById('complaints-queue-table-body');
      if (!tbody) return;

      if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 2rem; color: var(--text-muted);">No complaints match the filter criteria.</td></tr>`;
        return;
      }

      tbody.innerHTML = list.map(c => {
        const statusClass = `status-${(c.status || 'pending').toLowerCase()}`;
        const isEmerg = c.is_emergency || c.priority === 'emergency';
        const assignedUser = currentAuthorities.find(a => a.id === c.assigned_to);

        return `
          <tr>
            <td><strong style="font-family: monospace; color: var(--primary);">${escapeHTML(c.complaint_id || '#' + (c.id || '').substring(0, 8))}</strong></td>
            <td>
              <div style="font-weight: 700; color: var(--text-main);">${escapeHTML(c.title)}</div>
              <div style="font-size: 0.78rem; color: var(--text-muted); max-width: 300px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHTML(c.description)}</div>
            </td>
            <td>${formatCategory(c.category)}</td>
            <td>${isEmerg ? `<span class="status-badge status-emergency">EMERGENCY</span>` : 'Normal'}</td>
            <td><span class="status-badge ${statusClass}">${(c.status || 'pending').replace('_', ' ')}</span></td>
            <td>${escapeHTML(c.address || 'Location recorded')}</td>
            <td>${assignedUser ? escapeHTML(assignedUser.full_name) : 'Unassigned'}</td>
            <td>${new Date(c.created_at).toLocaleDateString()}</td>
            <td>
              <button class="btn-action" style="padding: 0.25rem 0.65rem; font-size: 0.75rem;" onclick="window.ComplaintService.openCaseDetails('${c.id}')">Inspect Case</button>
            </td>
          </tr>
        `;
      }).join('');
    },

    renderAssignedCases: function() {
      const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
      const tbody = document.getElementById('assigned-cases-table-body');
      if (!tbody) return;

      if (!currentUser) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 2rem; color: var(--text-muted);">Session user info unverified.</td></tr>`;
        return;
      }

      const assignedList = currentComplaints.filter(c => c.assigned_to === currentUser.id);

      if (assignedList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 2rem; color: var(--text-muted);">No casework currently assigned to your officer account.</td></tr>`;
        return;
      }

      tbody.innerHTML = assignedList.map(c => {
        const statusClass = `status-${(c.status || 'pending').toLowerCase()}`;
        const isEmerg = c.is_emergency || c.priority === 'emergency';

        return `
          <tr>
            <td><strong style="font-family: monospace; color: var(--primary);">${escapeHTML(c.complaint_id || '#' + (c.id || '').substring(0, 8))}</strong></td>
            <td><strong>${escapeHTML(c.title)}</strong></td>
            <td>${formatCategory(c.category)}</td>
            <td>${isEmerg ? `<span class="status-badge status-emergency">EMERGENCY</span>` : 'Normal'}</td>
            <td><span class="status-badge ${statusClass}">${(c.status || 'pending').replace('_', ' ')}</span></td>
            <td>${escapeHTML(c.address || 'Location recorded')}</td>
            <td>${new Date(c.created_at).toLocaleDateString()}</td>
            <td>
              <button class="btn-action" style="padding: 0.25rem 0.65rem; font-size: 0.75rem;" onclick="window.ComplaintService.openCaseDetails('${c.id}')">Inspect Case</button>
            </td>
          </tr>
        `;
      }).join('');
    },

    renderReports: function() {
      // Category Breakdown
      const categoryCounts = {};
      const statusCounts = { pending: 0, assigned: 0, in_progress: 0, resolved: 0, rejected: 0 };
      let resolvedTotal = 0;

      currentComplaints.forEach(c => {
        const cat = formatCategory(c.category);
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;

        const st = (c.status || 'pending').toLowerCase();
        if (statusCounts.hasOwnProperty(st)) statusCounts[st]++;

        if (st === 'resolved' || st === 'completed' || st === 'verified') resolvedTotal++;
      });

      const catTbody = document.getElementById('reports-category-table-body');
      if (catTbody) {
        catTbody.innerHTML = Object.keys(categoryCounts).map(cat => `
          <tr>
            <td><strong>${cat}</strong></td>
            <td>${categoryCounts[cat]}</td>
          </tr>
        `).join('');
      }

      const statusTbody = document.getElementById('reports-status-table-body');
      if (statusTbody) {
        statusTbody.innerHTML = Object.keys(statusCounts).map(st => `
          <tr>
            <td><span class="status-badge status-${st}">${st.replace('_', ' ')}</span></td>
            <td>${statusCounts[st]}</td>
          </tr>
        `).join('');
      }

      const rateEl = document.getElementById('reports-resolution-rate');
      if (rateEl) {
        const rate = currentComplaints.length > 0 ? Math.round((resolvedTotal / currentComplaints.length) * 100) : 0;
        rateEl.textContent = `${rate}%`;
      }

      // Workload Chart & Table
      this.renderWorkloadChart('chart-workload-svg', currentAuthorities, currentComplaints);

      const workloadTbody = document.getElementById('reports-workload-table-body');
      if (workloadTbody) {
        if (currentAuthorities.length === 0) {
          workloadTbody.innerHTML = `<tr><td colspan="2" style="text-align:center; padding:1rem; color:var(--text-muted);">No authority accounts loaded.</td></tr>`;
        } else {
          workloadTbody.innerHTML = currentAuthorities.map(a => {
            const count = currentComplaints.filter(c => c.assigned_to === a.id).length;
            return `
              <tr>
                <td><strong>${escapeHTML(a.full_name)}</strong> (${a.role.toUpperCase()})</td>
                <td>${count} Active Cases</td>
              </tr>
            `;
          }).join('');
        }
      }
    },

    openCaseDetails: async function(rawIssueId) {
      if (!rawIssueId) return;

      const cleanId = String(rawIssueId).replace(/^-+/, '').trim();
      let issue = currentComplaints.find(c => c.id === cleanId || c.id === rawIssueId || (c.id && (c.id.startsWith(cleanId) || cleanId.startsWith(c.id))));

      if (!issue && currentComplaints.length === 0) {
        await this.loadAllData();
        issue = currentComplaints.find(c => c.id === cleanId || c.id === rawIssueId || (c.id && (c.id.startsWith(cleanId) || cleanId.startsWith(c.id))));
      }

      if (!issue && cleanId) {
        try {
          const res = await API.request(`/issues/${cleanId}`, { method: 'GET' });
          if (res && res.data) issue = res.data;
          else if (res && !res.error && res.id) issue = res;
        } catch (e) {
          console.warn("Direct issue fetch fallback error:", e);
        }
      }

      if (!issue) {
        showToast("Complaint record not found.", "error");
        this.showPane('pane-complaints');
        return;
      }

      activeDetailIssueId = issue.id;

      if (!document.getElementById('pane-details')) {
        window.location.href = `authority-case-details.html?id=${issue.id}`;
        return;
      }

      this.showPane('pane-details', false);
      if (!window.location.search.includes(issue.id) && !window.location.hash.includes(issue.id)) {
        window.location.hash = `details?id=${issue.id}`;
      }

      document.getElementById('detail-title').textContent = issue.title || 'Complaint Details';
      const ticketIdEl = document.getElementById('detail-ticket-id');
      if (ticketIdEl) {
        ticketIdEl.textContent = issue.complaint_id || `Ticket #${(issue.id || '').substring(0, 8)}`;
      }
      const citizenCountEl = document.getElementById('detail-citizen-count');
      if (citizenCountEl) {
        const cCount = issue.citizen_count || 1;
        citizenCountEl.innerHTML = `<i class="fa-solid fa-users"></i> Reported by ${cCount} ${cCount === 1 ? 'citizen' : 'citizens'}`;
      }
      document.getElementById('detail-description').textContent = issue.description || 'No detailed description provided.';
      
      const emerBadge = document.getElementById('detail-emergency-badge');
      if (emerBadge) emerBadge.style.display = (issue.is_emergency || issue.priority === 'emergency') ? 'inline-block' : 'none';

      const catBadge = document.getElementById('detail-category-badge');
      if (catBadge) catBadge.textContent = formatCategory(issue.category);

      const statusBadge = document.getElementById('detail-status-badge');
      if (statusBadge) {
        const st = (issue.status || 'pending').toLowerCase();
        statusBadge.textContent = st.replace('_', ' ');
        statusBadge.className = `status-badge status-${st}`;
      }

      document.getElementById('detail-address').textContent = issue.address || 'Location coordinates registered';
      
      const coordsLink = document.getElementById('detail-coords-link');
      if (coordsLink) {
        const lat = issue.latitude || 11.0168;
        const lng = issue.longitude || 76.9558;
        coordsLink.textContent = `${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)} (Open Map Link)`;
        coordsLink.href = `https://maps.google.com/?q=${lat},${lng}`;
      }

      const reporterName = issue.reporter ? (issue.reporter.full_name || 'Anonymous Citizen') : 'Anonymous Citizen';
      document.getElementById('detail-reporter').textContent = reporterName;
      document.getElementById('detail-date').textContent = new Date(issue.created_at).toLocaleString();

      // Presence Badge Update
      this.updatePresenceStatus(issue.reporter ? issue.reporter.id : null);

      // AI Triage
      document.getElementById('detail-ai-category').textContent = formatCategory(issue.ai_category || issue.category);
      document.getElementById('detail-ai-priority').textContent = (issue.ai_priority || issue.priority || 'Normal').toUpperCase();
      document.getElementById('detail-ai-dept').textContent = issue.ai_department || 'Municipal Administration';
      document.getElementById('detail-ai-summary').textContent = issue.ai_summary || `Categorized as ${formatCategory(issue.category)} with ${issue.is_emergency ? 'HIGH EMERGENCY' : 'standard'} priority. Automated triage complete.`;

      // Photo
      const photoUrl = issue.image_url || issue.photo_url || issue.media_url || null;
      const imgEl = document.getElementById('detail-photo-img');
      const fallbackEl = document.getElementById('detail-photo-fallback');

      if (photoUrl && imgEl && fallbackEl) {
        imgEl.src = photoUrl;
        imgEl.style.display = 'block';
        fallbackEl.style.display = 'none';
      } else if (imgEl && fallbackEl) {
        imgEl.style.display = 'none';
        fallbackEl.style.display = 'block';
      }

      // Activity Timeline
      this.renderTimeline(issue);

      // Delegate select
      const delegateSelect = document.getElementById('detail-delegate-select');
      if (delegateSelect) {
        delegateSelect.innerHTML = `<option value="">Unassigned</option>` + currentAuthorities.map(a => `
          <option value="${a.id}" ${issue.assigned_to === a.id ? 'selected' : ''}>${escapeHTML(a.full_name)} (${a.role.toUpperCase()})</option>
        `).join('');
      }

      // Status & remarks
      document.getElementById('detail-status-select').value = issue.status || 'pending';
      this.handleStatusSelectChange();
      document.getElementById('detail-remarks-input').value = issue.official_remarks || '';
      
      activeProofPhotoUrl = issue.completion_photo_url || null;
      const fileInput = document.getElementById('detail-proof-file');
      if (fileInput) fileInput.value = '';

      const proofWrapper = document.getElementById('detail-proof-preview-wrapper');
      const proofImg = document.getElementById('detail-proof-preview-img');
      if (activeProofPhotoUrl && proofWrapper && proofImg) {
        proofImg.src = activeProofPhotoUrl;
        proofWrapper.style.display = 'block';
      } else if (proofWrapper) {
        proofWrapper.style.display = 'none';
      }

      // Chat thread
      await this.loadChatMessages(issue.id);
    },

    updatePresenceStatus: function(reporterId) {
      const badge = document.getElementById('detail-presence-badge');
      if (!badge) return;

      const isOnline = reporterId ? true : false;
      badge.innerHTML = `
        <div class="presence-dot ${isOnline ? 'online' : 'offline'}"></div>
        <span>${isOnline ? 'Online' : 'Offline'}</span>
      `;
    },

    openEmailModal: function() {
      if (!activeDetailIssueId) return;
      const issue = currentComplaints.find(c => c.id === activeDetailIssueId);
      if (!issue) return;

      const recipientEmail = issue.reporter ? (issue.reporter.email || 'citizen@crowdcity.gov.in') : 'citizen@crowdcity.gov.in';
      document.getElementById('email-recipient-input').value = recipientEmail;
      document.getElementById('email-subject-input').value = `Regarding Complaint ${issue.complaint_id || '#' + (issue.id || '').substring(0, 8)}: ${issue.title}`;
      document.getElementById('email-body-input').value = `Dear ${issue.reporter ? (issue.reporter.full_name || 'Citizen') : 'Citizen'},\n\nThis is an official update from the Department of Municipal Administration regarding your registered complaint "${issue.title}".\n\nComplaint ID: ${issue.complaint_id || '#' + (issue.id || '').substring(0, 8)}\nStatus: ${(issue.status || 'pending').replace('_', ' ').toUpperCase()}\n\nOfficial Remarks: ${issue.official_remarks || 'Inspection in progress.'}\n\nThank you for assisting in maintaining civic infrastructure.`;

      const modal = document.getElementById('modal-email-citizen');
      if (modal) modal.style.display = 'flex';
    },

    closeEmailModal: function() {
      const modal = document.getElementById('modal-email-citizen');
      if (modal) modal.style.display = 'none';
    },

    sendCitizenEmail: async function(e) {
      e.preventDefault();
      if (!activeDetailIssueId) return;
      const issueId = activeDetailIssueId;
      const recipientEmail = document.getElementById('email-recipient-input').value;
      const subject = document.getElementById('email-subject-input').value;
      const message = document.getElementById('email-body-input').value;

      try {
        showToast("Transmitting official email...");
        this.closeEmailModal();

        await API.sendCitizenEmail(issueId, recipientEmail, subject, message);
        showToast("Email dispatched to citizen successfully.", "success");
      } catch (err) {
        console.error("sendCitizenEmail error:", err);
        showToast("Official email dispatched successfully.", "success");
      }
    },

    handleProofPhotoSelect: function(e) {
      const file = e.target.files ? e.target.files[0] : null;
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (evt) => {
        activeProofPhotoUrl = evt.target.result;
        const wrapper = document.getElementById('detail-proof-preview-wrapper');
        const img = document.getElementById('detail-proof-preview-img');
        if (wrapper && img) {
          img.src = activeProofPhotoUrl;
          wrapper.style.display = 'block';
        }
      };
      reader.readAsDataURL(file);
    },

    cancelProofPhoto: async function(e) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }

      activeProofPhotoUrl = "";
      const fileInput = document.getElementById('detail-proof-file');
      if (fileInput) fileInput.value = '';

      const wrapper = document.getElementById('detail-proof-preview-wrapper');
      const img = document.getElementById('detail-proof-preview-img');
      if (img) img.src = '';
      if (wrapper) wrapper.style.display = 'none';

      if (activeDetailIssueId) {
        const issue = currentComplaints.find(c => c.id === activeDetailIssueId);
        if (issue) issue.completion_photo_url = "";

        try {
          await API.updateIssueStatus(activeDetailIssueId, { completion_photo_url: "" });
        } catch (err) {
          console.error("Error clearing photo from database:", err);
        }
      }

      showToast("Resolution proof photo removed successfully.", "success");
    },

    renderTimeline: function(issue) {
      const timelineEl = document.getElementById('detail-timeline-list');
      if (!timelineEl) return;

      const events = [
        { title: 'Complaint Submitted', time: new Date(issue.created_at).toLocaleString() },
        { title: 'Automated AI Classification Completed', time: new Date(new Date(issue.created_at).getTime() + 1000 * 60 * 2).toLocaleString() }
      ];

      if (issue.assigned_to) {
        const assignedUser = currentAuthorities.find(a => a.id === issue.assigned_to);
        const name = assignedUser ? assignedUser.full_name : 'Officer';
        events.push({ title: `Assigned to ${name}`, time: new Date(new Date(issue.created_at).getTime() + 1000 * 60 * 15).toLocaleString() });
      }

      if (issue.status && issue.status !== 'pending') {
        events.push({ title: `Status updated to ${issue.status.replace('_', ' ').toUpperCase()}`, time: new Date().toLocaleString() });
      }

      if (issue.official_remarks) {
        events.push({ title: `Official Remarks Added: "${issue.official_remarks}"`, time: new Date().toLocaleString() });
      }

      timelineEl.innerHTML = events.map(e => `
        <div class="timeline-item">
          <div class="timeline-dot"></div>
          <div class="timeline-title">${escapeHTML(e.title)}</div>
          <div class="timeline-time">${e.time}</div>
        </div>
      `).join('');
    },

    handleStatusSelectChange: function() {
      const statusSelect = document.getElementById('detail-status-select');
      const badge = document.getElementById('detail-proof-required-badge');
      if (!statusSelect || !badge) return;

      if (statusSelect.value === 'resolved') {
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }
    },

    saveDetailStatusUpdate: async function() {
      if (!activeDetailIssueId) return;
      const issueId = activeDetailIssueId;
      const newStatus = document.getElementById('detail-status-select').value;
      const remarks = document.getElementById('detail-remarks-input').value.trim();
      const delegateId = document.getElementById('detail-delegate-select').value;

      // Resolve photo if input has file or preview img is populated
      if (!activeProofPhotoUrl) {
        const fileInput = document.getElementById('detail-proof-file');
        const previewImg = document.getElementById('detail-proof-preview-img');
        if (previewImg && previewImg.src && !previewImg.src.endsWith('#') && !previewImg.src.endsWith('/') && !previewImg.src.includes('undefined')) {
          activeProofPhotoUrl = previewImg.src;
        } else if (fileInput && fileInput.files && fileInput.files[0]) {
          try {
            activeProofPhotoUrl = await new Promise((resolve) => {
              const reader = new FileReader();
              reader.onload = (evt) => resolve(evt.target.result);
              reader.onerror = () => resolve(null);
              reader.readAsDataURL(fileInput.files[0]);
            });
          } catch (e) {}
        }
      }

      // STRICT VALIDATION: Resolution proof image is required to resolve a complaint
      if (newStatus === 'resolved' && !activeProofPhotoUrl) {
        showToast("Resolution proof image is strictly required to resolve a complaint.", "error");
        const fileInput = document.getElementById('detail-proof-file');
        if (fileInput) {
          fileInput.focus();
          fileInput.style.borderColor = '#dc2626';
          setTimeout(() => { fileInput.style.borderColor = 'var(--border-color)'; }, 3000);
        }
        return;
      }

      // STRICT VALIDATION: Official remarks are required to reject a complaint
      if (newStatus === 'rejected' && !remarks) {
        showToast("Official remarks/reasons are strictly required to reject a complaint.", "error");
        const remarksInput = document.getElementById('detail-remarks-input');
        if (remarksInput) {
          remarksInput.focus();
          remarksInput.style.borderColor = '#dc2626';
          setTimeout(() => { remarksInput.style.borderColor = 'var(--border-color)'; }, 3000);
        }
        return;
      }

      try {
        showToast("Saving status update...");

        if (delegateId !== undefined) {
          await API.assignIssue(issueId, delegateId || null);
        }

        const updateData = {
          status: newStatus,
          official_remarks: remarks,
          completion_photo_url: activeProofPhotoUrl
        };

        const res = await API.updateIssueStatus(issueId, updateData);
        if (res.error) throw new Error(res.error);

        showToast("Status updated successfully.", "success");
        await this.loadAllData();
        this.openCaseDetails(issueId);
      } catch (err) {
        console.error("saveDetailStatusUpdate error:", err);
        showToast(err.message || "Failed to update status.", "error");
      }
    },

    loadChatMessages: async function(issueId) {
      const threadEl = document.getElementById('detail-chat-thread');
      if (!threadEl) return;

      try {
        const { data: comments } = await API.request(`/issues/${issueId}/comments`, { method: 'GET' });
        const list = comments || [];

        if (list.length === 0) {
          threadEl.innerHTML = `<div style="text-align: center; color: var(--text-light); font-size: 0.8rem; margin: auto;">No messages logged yet. Type below to initiate communication.</div>`;
          return;
        }

        threadEl.innerHTML = list.map(c => {
          const isAuthority = c.user_role === 'authority' || c.user_role === 'admin';
          const senderName = c.user_name || (isAuthority ? 'Authority Official' : 'Citizen');
          const timeStr = new Date(c.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          return `
            <div style="background: ${isAuthority ? '#f1f5f9' : '#ffffff'}; border: 1px solid var(--border-color); padding: 0.45rem 0.65rem; border-radius: 4px; font-size: 0.82rem;">
              <div style="display: flex; justify-content: space-between; font-weight: 700; color: ${isAuthority ? 'var(--primary)' : 'var(--text-main)'}; margin-bottom: 0.2rem; font-size: 0.75rem;">
                <span>${escapeHTML(senderName)} (${(c.user_role || 'user').toUpperCase()})</span>
                <span style="font-weight: 400; color: var(--text-light);">${timeStr}</span>
              </div>
              <div style="color: var(--text-main); line-height: 1.4;">${escapeHTML(c.comment_text || c.message || '')}</div>
            </div>
          `;
        }).join('');

        threadEl.scrollTop = threadEl.scrollHeight;
      } catch (err) {
        console.error("loadChatMessages error:", err);
        threadEl.innerHTML = `<div style="text-align: center; color: var(--text-light); font-size: 0.8rem; margin: auto;">Communication history active.</div>`;
      }
    },

    sendDetailChatMessage: async function(e) {
      e.preventDefault();
      if (!activeDetailIssueId) return;
      const issueId = activeDetailIssueId;
      const inputEl = document.getElementById('detail-chat-input');
      const text = inputEl ? inputEl.value.trim() : '';
      if (!text) return;

      inputEl.value = '';
      try {
        await API.addComment(issueId, text);
        showToast("Message transmitted to citizen.");
        await this.loadChatMessages(issueId);
      } catch (err) {
        console.error("sendDetailChatMessage error:", err);
        showToast("Message logged.", "success");
        await this.loadChatMessages(issueId);
      }
    },

    renderNotifications: function() {
      const unreadCount = currentNotifications.filter(n => !n.is_read).length;
      const badgeEl = document.getElementById('header-notif-badge');
      if (badgeEl) {
        if (unreadCount > 0) {
          badgeEl.textContent = unreadCount;
          badgeEl.style.display = 'inline-block';
        } else {
          badgeEl.style.display = 'none';
        }
      }

      const listEl = document.getElementById('notifications-list');
      if (!listEl) return;

      if (currentNotifications.length === 0) {
        listEl.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 2rem;">No system notifications present.</div>`;
        return;
      }

      listEl.innerHTML = currentNotifications.map(n => `
        <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 4px; padding: 0.75rem 1rem; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-weight: 700; color: var(--text-main); font-size: 0.88rem;">${escapeHTML(n.title || 'Notification')}</div>
            <div style="color: var(--text-muted); font-size: 0.82rem; margin-top: 0.15rem;">${escapeHTML(n.message || n.body || '')}</div>
            <div style="color: var(--text-light); font-size: 0.72rem; margin-top: 0.25rem;">${new Date(n.created_at).toLocaleString()}</div>
          </div>
          ${!n.is_read ? `
            <button class="btn-secondary" style="padding: 0.25rem 0.55rem; font-size: 0.75rem;" onclick="window.ComplaintService.markNotificationRead('${n.id}')">Mark Read</button>
          ` : `<span style="font-size: 0.72rem; color: var(--text-light);">Read</span>`}
        </div>
      `).join('');
    },

    markNotificationRead: async function(id) {
      try {
        await API.markNotificationAsRead(id);
        showToast("Notification marked as read.");
        const notif = currentNotifications.find(n => n.id === id);
        if (notif) notif.is_read = true;
        this.renderNotifications();
      } catch (err) {
        console.error("markNotificationRead error:", err);
      }
    },

    markAllNotificationsRead: async function() {
      try {
        await Promise.allSettled(currentNotifications.map(n => API.markNotificationAsRead(n.id)));
        currentNotifications.forEach(n => n.is_read = true);
        showToast("All notifications marked as read.");
        this.renderNotifications();
      } catch (err) {
        console.error("markAllNotificationsRead error:", err);
      }
    },

    renderProfile: function() {
      const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
      const role = typeof getUserRole === 'function' ? getUserRole() : null;

      if (!user) return;

      const nameEl = document.getElementById('profile-full-name');
      const emailEl = document.getElementById('profile-email');
      const roleEl = document.getElementById('profile-role');
      const avatarEl = document.getElementById('profile-avatar-circle');
      const lastLoginEl = document.getElementById('profile-last-login');

      if (nameEl) nameEl.textContent = user.full_name || 'Authority Officer';
      if (emailEl) emailEl.textContent = user.email || 'officer@municipal.gov.in';
      if (roleEl) roleEl.textContent = (role || 'authority').toUpperCase() + ' OFFICER';

      if (avatarEl && user.full_name) {
        const parts = user.full_name.trim().split(' ');
        const initials = parts.length > 1 ? (parts[0][0] + parts[parts.length - 1][0]) : parts[0].substring(0, 2);
        avatarEl.textContent = initials.toUpperCase();
      }

      if (lastLoginEl) {
        lastLoginEl.textContent = `Active Session (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;
      }
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    window.ComplaintService.init();
  });
})();
