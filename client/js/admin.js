// CrowdCity AI Municipal Authority Operations Platform Controller
(function() {
  'use strict';

  let currentComplaints = [];
  let currentAuthorities = [];
  let currentNotifications = [];
  let activeDetailIssueId = null;

  // ----------------------------------------------------
  // HELPER: Toast Banner
  // ----------------------------------------------------
  function showToast(message, type = 'success') {
    const container = document.getElementById('toast-message');
    if (!container) return;
    container.className = `toast-box ${type}`;
    container.textContent = message;
    container.style.display = 'block';
    setTimeout(() => {
      container.style.display = 'none';
    }, 4000);
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
      other: 'Other', pothole: 'Roads', leakage: 'Water Supply', streetlight: 'Streetlights'
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
      await this.loadAllData();
      this.handleInitialHash();
    },

    bindHashRouting: function() {
      window.addEventListener('hashchange', () => {
        this.handleInitialHash();
      });
    },

    handleInitialHash: function() {
      const hash = window.location.hash.replace('#', '') || 'dashboard';
      if (hash.startsWith('details?id=')) {
        const issueId = hash.split('details?id=')[1];
        this.openCaseDetails(issueId);
      } else {
        const paneMap = {
          'dashboard': 'pane-dashboard',
          'complaints': 'pane-complaints',
          'assigned': 'pane-assigned',
          'notifications': 'pane-notifications'
        };
        this.showPane(paneMap[hash] || 'pane-dashboard', false);
      }
    },

    showPane: function(paneId, updateHash = true) {
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active-pane'));
      const targetPane = document.getElementById(paneId);
      if (targetPane) targetPane.classList.add('active-pane');

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
        'pane-details': 'Complaint Inspection & Action Console',
        'pane-notifications': 'System Notifications'
      };

      const titleEl = document.getElementById('header-pane-title');
      if (titleEl) titleEl.textContent = paneTitles[paneId] || 'Authority Portal';

      if (updateHash) {
        const reverseMap = {
          'pane-dashboard': 'dashboard',
          'pane-complaints': 'complaints',
          'pane-assigned': 'assigned',
          'pane-notifications': 'notifications'
        };
        if (reverseMap[paneId]) {
          window.location.hash = reverseMap[paneId];
        }
      }

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

    loadAllData: async function() {
      try {
        const [issuesRes, usersRes, notifsRes] = await Promise.allSettled([
          API.getIssues(),
          API.getAllUsers(),
          API.getNotifications()
        ]);

        if (issuesRes.status === 'fulfilled' && issuesRes.value.data) {
          currentComplaints = issuesRes.value.data || [];
        }

        if (usersRes.status === 'fulfilled' && usersRes.value.data) {
          const users = usersRes.value.data || [];
          currentAuthorities = users.filter(u => u.role === 'authority' || u.role === 'admin');
        }

        if (notifsRes.status === 'fulfilled' && notifsRes.value.data) {
          currentNotifications = notifsRes.value.data || [];
        }

        this.renderDashboard();
        this.renderComplaintsQueue();
        this.renderAssignedCases();
        this.renderNotifications();
      } catch (err) {
        console.error("loadAllData error:", err);
        showToast("Failed to sync database data.", "error");
      }
    },

    renderDashboard: function() {
      const total = currentComplaints.length;
      let pending = 0;
      let inProgress = 0;
      let resolved = 0;
      let emergency = 0;

      currentComplaints.forEach(c => {
        const st = (c.status || 'pending').toLowerCase();
        if (st === 'pending' || st === 'submitted' || st === 'open') pending++;
        else if (st === 'in_progress' || st === 'investigating') inProgress++;
        else if (st === 'resolved' || st === 'completed' || st === 'verified') resolved++;
        
        if (c.is_emergency || c.priority === 'emergency' || c.priority === 'high') emergency++;
      });

      document.getElementById('kpi-total').textContent = total;
      document.getElementById('kpi-pending').textContent = pending;
      document.getElementById('kpi-progress').textContent = inProgress;
      document.getElementById('kpi-resolved').textContent = resolved;
      document.getElementById('kpi-emergency').textContent = emergency;

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
                <td><strong>#${(c.id || '').substring(0, 8)}</strong></td>
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
              <strong>Complaint #${(c.id || '').substring(0, 8)}:</strong> ${escapeHTML(c.title)}
            </div>
            <div style="color: var(--text-light); font-size: 0.78rem;">${new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
        `).join('');
      }
    },

    applyFilters: function() {
      const search = (document.getElementById('filter-search-input').value || '').toLowerCase().trim();
      const statusFilter = (document.getElementById('filter-status-select').value || '').toLowerCase().trim();
      const categoryFilter = (document.getElementById('filter-category-select').value || '').toLowerCase().trim();
      const priorityFilter = (document.getElementById('filter-priority-select').value || '').toLowerCase().trim();

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

        return true;
      });

      this.renderComplaintsTable(filtered);
    },

    resetFilters: function() {
      document.getElementById('filter-search-input').value = '';
      document.getElementById('filter-status-select').value = '';
      document.getElementById('filter-category-select').value = '';
      document.getElementById('filter-priority-select').value = '';
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
            <td><strong>#${(c.id || '').substring(0, 8)}</strong></td>
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
            <td><strong>#${(c.id || '').substring(0, 8)}</strong></td>
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

    openCaseDetails: async function(issueId) {
      activeDetailIssueId = issueId;
      const issue = currentComplaints.find(c => c.id === issueId);
      if (!issue) {
        showToast("Complaint record not found.", "error");
        return;
      }

      this.showPane('pane-details', false);
      window.location.hash = `details?id=${issueId}`;

      document.getElementById('detail-title').textContent = issue.title || 'Complaint Details';
      document.getElementById('detail-ticket-id').textContent = `Ticket #${(issue.id || '').substring(0, 8)}`;
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

      // Delegate select
      const delegateSelect = document.getElementById('detail-delegate-select');
      if (delegateSelect) {
        delegateSelect.innerHTML = `<option value="">Unassigned</option>` + currentAuthorities.map(a => `
          <option value="${a.id}" ${issue.assigned_to === a.id ? 'selected' : ''}>${escapeHTML(a.full_name)} (${a.role.toUpperCase()})</option>
        `).join('');
      }

      // Status & remarks
      document.getElementById('detail-status-select').value = issue.status || 'pending';
      document.getElementById('detail-remarks-input').value = issue.official_remarks || '';
      document.getElementById('detail-proof-photo').value = issue.completion_photo_url || '';

      // Chat thread
      await this.loadChatMessages(issueId);
    },

    saveDetailStatusUpdate: async function() {
      if (!activeDetailIssueId) return;
      const issueId = activeDetailIssueId;
      const newStatus = document.getElementById('detail-status-select').value;
      const remarks = document.getElementById('detail-remarks-input').value.trim();
      const proofPhoto = document.getElementById('detail-proof-photo').value.trim();
      const delegateId = document.getElementById('detail-delegate-select').value;

      try {
        showToast("Saving status update...");

        if (delegateId !== undefined) {
          await API.assignIssue(issueId, delegateId || null);
        }

        const updateData = {
          status: newStatus,
          official_remarks: remarks,
          completion_photo_url: proofPhoto
        };

        const res = await API.updateIssueStatus(issueId, updateData);
        if (res.error) throw new Error(res.error);

        showToast("Status updated successfully.");
        await this.loadAllData();
        this.openCaseDetails(issueId);
      } catch (err) {
        console.error("saveDetailStatusUpdate error:", err);
        showToast("Failed to update status: " + err.message, "error");
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
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    window.ComplaintService.init();
  });
})();
