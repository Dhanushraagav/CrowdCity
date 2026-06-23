// CrowdCity - Admin Operations controller

let currentUsers = [];
let currentComplaints = [];
let categoriesChart = null;
let statusesChart = null;
let performanceChart = null;

// Check authorization on load
function checkAdminAccess() {
  const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  const role = typeof getUserRole === 'function' ? getUserRole() : null;
  
  if (!user || role !== 'admin') {
    window.showToast("Access Denied: Administrative access is required to view this panel.", "error");
    window.authRouter.redirectToLogin('citizen');
    return false;
  }
  return true;
}

// Show Alert notifications
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

// ----------------------------------------------------
// Tab 1: Analytics
// ----------------------------------------------------
async function loadAnalytics() {
  const totalEl = document.getElementById('kpi-total');
  const pendingEl = document.getElementById('kpi-pending');
  const resolvedEl = document.getElementById('kpi-resolved');
  const staffEl = document.getElementById('kpi-staff');

  try {
    // 1. Fetch Analytics data
    const analyticsRes = await API.getAdminAnalytics();
    if (analyticsRes.error) {
      showToast("Failed to fetch analytics statistics: " + analyticsRes.error, "error");
      return;
    }
    const analytics = analyticsRes.data;

    // 2. Fetch users list to count authorities
    const usersRes = await API.getAllUsers();
    let authorityCount = 0;
    if (!usersRes.error && usersRes.data) {
      authorityCount = usersRes.data.filter(u => u.role === 'authority' || u.role === 'admin').length;
    }

    // 3. Update KPI values
    if (totalEl) totalEl.textContent = analytics.totalComplaints;
    if (pendingEl) pendingEl.textContent = analytics.byStatus.pending || 0;
    if (resolvedEl) resolvedEl.textContent = analytics.byStatus.resolved || 0;
    if (staffEl) staffEl.textContent = authorityCount;

    // 4. Render Charts
    renderCharts(analytics);

  } catch (err) {
    console.error("loadAnalytics error:", err);
    showToast("Server error loading admin analytics", "error");
  }
}

function renderCharts(analytics) {
  // Destroy old charts to prevent duplicate draw conflicts
  if (categoriesChart) categoriesChart.destroy();
  if (statusesChart) statusesChart.destroy();
  if (performanceChart) performanceChart.destroy();

  const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const textColor = isDarkMode ? '#cbd5e1' : '#334155';
  const gridColor = isDarkMode ? '#1e293b' : '#cbd5e1';

  // Chart 1: Categories Doughnut Chart
  const categoriesCtx = document.getElementById('chart-categories');
  if (categoriesCtx) {
    const catsData = analytics.byCategory;
    const labels = Object.keys(catsData).map(k => window.i18n ? window.i18n.t('category_' + k.toLowerCase()) : k.toUpperCase());
    const data = Object.values(catsData);
    const categoryColors = {
      roads: '#d97706',
      streetlights: '#f59e0b',
      water_supply: '#3b82f6',
      drainage: '#06b6d4',
      garbage: '#10b981',
      traffic: '#ef4444',
      public_property: '#8b5cf6',
      parks: '#22c55e',
      sanitation: '#ec4899',
      safety_hazard: '#f97316',
      environment: '#14b8a6',
      other: '#64748b',
      
      // Legacy categories compatibility
      pothole: '#d97706',
      leakage: '#3b82f6',
      streetlight: '#f59e0b',
      road: '#64748b'
    };
    const colors = Object.keys(catsData).map(k => categoryColors[k.toLowerCase()] || categoryColors.other);

    categoriesChart = new Chart(categoriesCtx, {
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
          legend: {
            position: 'bottom',
            labels: { color: textColor, font: { family: 'Inter', size: 11 } }
          }
        }
      }
    });
  }

  // Chart 2: Statuses Bar Chart
  const statusesCtx = document.getElementById('chart-statuses');
  if (statusesCtx) {
    const statusData = analytics.byStatus;
    const labels = ['Pending', 'Assigned', 'In Progress', 'Resolved', 'Rejected'].map(s => window.i18n ? window.i18n.t('status_' + s.toLowerCase().replace(' ', '_')) : s);
    const data = [
      statusData.pending || 0,
      statusData.assigned || 0,
      statusData.in_progress || 0,
      statusData.resolved || 0,
      statusData.rejected || 0
    ];

    statusesChart = new Chart(statusesCtx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: window.i18n ? window.i18n.t('reports_count') : 'Complaints',
          data: data,
          backgroundColor: [
            '#f59e0b', // pending (warning amber)
            '#3b82f6', // assigned (info blue)
            '#3b82f6', // in_progress (info blue)
            '#22c55e', // resolved (success green)
            '#ef4444'  // rejected (danger red)
          ],
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: textColor }
          },
          y: {
            grid: { color: gridColor },
            ticks: { color: textColor, precision: 0 }
          }
        }
      }
    });
  }

  // Chart 3: Inspector Resolution Performance
  const performanceCtx = document.getElementById('chart-performance');
  if (performanceCtx) {
    const perfData = analytics.performance || [];
    // Sort performance descending
    perfData.sort((a, b) => b.resolvedCount - a.resolvedCount);

    const labels = perfData.map(p => p.name);
    const data = perfData.map(p => p.resolvedCount);

    performanceChart = new Chart(performanceCtx, {
      type: 'bar',
      data: {
        labels: labels.length ? labels : [window.i18n ? window.i18n.t('no_resolutions_yet') : 'No Resolutions Yet'],
        datasets: [{
          label: window.i18n ? window.i18n.t('resolved_issues') : 'Issues Resolved',
          data: data.length ? data : [0],
          backgroundColor: '#94a3b8',
          borderRadius: 6
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            grid: { color: gridColor },
            ticks: { color: textColor, precision: 0 }
          },
          y: {
            grid: { display: false },
            ticks: { color: textColor }
          }
        }
      }
    });
  }
}

// ----------------------------------------------------
// Tab 2: User Management
// ----------------------------------------------------
let allDepartments = [];

async function loadUsers() {
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

    if (usersRes.error) {
      showToast("Failed to load users: " + usersRes.error, "error");
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-muted);">
            <i class="fa-solid fa-triangle-exclamation" style="color:var(--status-duplicate);"></i> Failed to load users.
          </td>
        </tr>
      `;
      return;
    }

    currentUsers = usersRes.data || [];
    allDepartments = deptsRes.data || [];
    filterAndRenderUsers();

  } catch (err) {
    console.error("loadUsers error:", err);
    showToast("Server error loading users list", "error");
  }
}

function filterAndRenderUsers() {
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
      
    const currentUser = getCurrentUser();
    const isSelf = currentUser && currentUser.id === user.id;

    // Verify Authority toggle
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
      verifyAuthCell = `<span style="color:var(--text-muted); font-size:0.8rem;">N/A (${user.role === 'admin' ? 'Admin' : 'Citizen'})</span>`;
    }

    // Department selection options
    const deptOptions = allDepartments.map(d => `<option value="${d.id}" ${user.department_id === d.id ? 'selected' : ''}>${d.name}</option>`).join('');
    const deptCell = `
      <select class="form-select user-department-select" data-user-id="${user.id}" ${user.role !== 'authority' ? 'disabled' : ''} style="margin: 0; font-size: 0.85rem; padding: 0.25rem 0.5rem; width: 100%; cursor:pointer;">
        <option value="">-- Unassigned --</option>
        ${deptOptions}
      </select>
    `;

    // Status / Suspension
    const isSuspended = !!user.is_suspended;
    const suspendCell = `
      <span class="badge badge-suspend" data-user-id="${user.id}" data-suspended="${isSuspended}" style="cursor: ${isSelf ? 'not-allowed' : 'pointer'}; opacity: ${isSelf ? 0.5 : 1}; background-color: ${isSuspended ? '#ef4444' : '#10b981'}; color: white; text-transform: uppercase; font-size: 0.72rem; padding: 0.25rem 0.5rem; border-radius: 4px; display: inline-block; font-weight:700;">
        ${isSuspended ? 'Suspended' : 'Active'}
      </span>
    `;

    return `
      <tr>
        <td style="font-weight:600;">${user.full_name || 'Citizen'} ${isSelf ? '<span style="color:var(--text-muted); font-size:0.75rem;">(You)</span>' : ''}</td>
        <td>${user.email || 'N/A'}</td>
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

  // Bind change event listeners
  document.querySelectorAll('.user-role-select').forEach(select => {
    select.addEventListener('change', async (e) => {
      const userId = e.target.getAttribute('data-user-id');
      const newRole = e.target.value;
      
      e.target.disabled = true;
      try {
        const updateRes = await API.updateUserRole(userId, newRole);
        if (updateRes.error) {
          showToast("Failed to update role: " + updateRes.error, "error");
          e.target.value = e.target.dataset.oldValue || e.target.value; // revert
        } else {
          showToast(`Role updated successfully to ${newRole.toUpperCase()}!`);
          await loadUsers(); // refresh
        }
      } catch (err) {
        console.error("update role error:", err);
        showToast("Error updating role", "error");
      } finally {
        e.target.disabled = false;
      }
    });
    // Save old value for rollback fallback
    select.dataset.oldValue = select.value;
  });

  // Bind verify authority listeners
  document.querySelectorAll('.user-verify-checkbox').forEach(chk => {
    chk.addEventListener('change', async (e) => {
      const userId = e.target.getAttribute('data-user-id');
      const isChecked = e.target.checked;
      
      e.target.disabled = true;
      try {
        const verifyRes = await API.verifyAuthority(userId, isChecked);
        if (verifyRes.error) {
          showToast("Failed to update verification status: " + verifyRes.error, "error");
          e.target.checked = !isChecked; // revert
        } else {
          showToast(isChecked ? "Authority verified successfully!" : "Authority verification retracted.");
          await loadUsers();
        }
      } catch (err) {
        console.error("verify authority error:", err);
        showToast("Error updating authority verification status", "error");
        e.target.checked = !isChecked; // revert
      } finally {
        e.target.disabled = false;
      }
    });
  });

  // Bind department assignment select listeners
  document.querySelectorAll('.user-department-select').forEach(select => {
    select.addEventListener('change', async (e) => {
      const userId = e.target.getAttribute('data-user-id');
      const deptId = e.target.value;
      
      e.target.disabled = true;
      try {
        const assignRes = await API.assignUserDepartment(userId, deptId || null);
        if (assignRes.error) {
          showToast("Failed to assign department: " + assignRes.error, "error");
          e.target.value = e.target.dataset.oldValue || e.target.value; // revert
        } else {
          showToast("Department assignment updated successfully!");
          await loadUsers();
        }
      } catch (err) {
        console.error("assign department error:", err);
        showToast("Error updating department assignment", "error");
        e.target.value = e.target.dataset.oldValue || e.target.value; // revert
      } finally {
        e.target.disabled = false;
      }
    });
    select.dataset.oldValue = select.value;
  });

  // Bind suspension clickable badges
  document.querySelectorAll('.badge-suspend').forEach(badge => {
    badge.addEventListener('click', async (e) => {
      const userId = e.target.getAttribute('data-user-id');
      const currentUser = getCurrentUser();
      if (currentUser && currentUser.id === userId) return; // Prevent self-suspension

      const isSuspended = e.target.getAttribute('data-suspended') === 'true';
      const newState = !isSuspended;

      const confirmMsg = newState 
        ? "Are you sure you want to SUSPEND this user? They will not be allowed to perform operations until unsuspended."
        : "Are you sure you want to UNSUSPEND this user?";

      if (confirm(confirmMsg)) {
        try {
          const res = await API.suspendUser(userId, newState);
          if (res.error) {
            showToast("Failed to update suspension status: " + res.error, "error");
          } else {
            showToast(newState ? "User account has been suspended." : "User account unsuspended successfully!");
            await loadUsers();
          }
        } catch (err) {
          console.error("suspension error:", err);
          showToast("Error updating suspension status", "error");
        }
      }
    });
  });
}

// ----------------------------------------------------
// Tab 3: Complaint Queue
// ----------------------------------------------------
async function loadComplaints() {
  const listEl = document.getElementById('admin-complaints-list');
  if (!listEl) return;

  listEl.innerHTML = `
    <div style="text-align: center; padding: 3rem; color: var(--text-muted); background-color:var(--bg-surface); border:1px solid var(--border-color); border-radius:var(--radius-md);">
      <i class="fa-solid fa-spinner fa-spin" style="margin-right:0.5rem; font-size:1.5rem;"></i> Loading complaints queue...
    </div>
  `;

  try {
    // Fetch issues and users concurrently
    const [issuesRes, usersRes] = await Promise.all([
      API.getIssues(),
      API.getAllUsers()
    ]);

    if (issuesRes.error) {
      showToast("Failed to load complaints: " + issuesRes.error, "error");
      listEl.innerHTML = `
        <div style="text-align: center; padding: 3rem; color: var(--text-muted); background-color:var(--bg-surface); border:1px solid var(--border-color); border-radius:var(--radius-md);">
          <i class="fa-solid fa-triangle-exclamation" style="color:var(--status-duplicate); font-size:1.5rem; margin-bottom:0.5rem;"></i><br>
          Failed to load complaints list.
        </div>
      `;
      return;
    }

    currentComplaints = issuesRes.data || [];
    const authorities = (usersRes.data || []).filter(u => u.role === 'authority' || u.role === 'admin');

    filterAndRenderComplaints(authorities);

  } catch (err) {
    console.error("loadComplaints error:", err);
    showToast("Server error loading complaints list", "error");
  }
}

function filterAndRenderComplaints(authorities) {
  const listEl = document.getElementById('admin-complaints-list');
  const activeFilterPill = document.querySelector('#admin-status-filters .filter-pill.active');
  const filterStatus = activeFilterPill ? activeFilterPill.getAttribute('data-status') : '';
  
  if (!listEl) return;

  const filtered = currentComplaints.filter(complaint => {
    return filterStatus === '' || complaint.status === filterStatus;
  });

  if (filtered.length === 0) {
    listEl.innerHTML = `
      <div style="text-align: center; padding: 3rem; color: var(--text-muted); background-color:var(--bg-surface); border:1px solid var(--border-color); border-radius:var(--radius-md);">
        No complaints currently match the selected status filter.
      </div>
    `;
    return;
  }

  const catNames = {
    roads: 'Roads',
    streetlights: 'Streetlights',
    water_supply: 'Water Supply',
    drainage: 'Drainage',
    garbage: 'Garbage',
    traffic: 'Traffic',
    public_property: 'Public Property',
    parks: 'Parks',
    sanitation: 'Sanitation',
    safety_hazard: 'Safety Hazard',
    environment: 'Environment',
    other: 'Other',
    
    // Legacy mapping
    pothole: 'Roads',
    leakage: 'Water Supply',
    streetlight: 'Streetlights',
    road: 'Roads'
  };

  listEl.innerHTML = filtered.map(issue => {
    // Generate inspector dropdown options
    const dropdownOptions = authorities.map(auth => {
      const isSelected = issue.assigned_to === auth.id;
      return `<option value="${auth.id}" ${isSelected ? 'selected' : ''}>${auth.full_name} (${auth.role})</option>`;
    }).join('');

    const reporterName = issue.reporter ? (issue.reporter.full_name || 'Anonymous') : 'Anonymous';
    const statusText = issue.status ? issue.status.replace('_', ' ') : 'pending';

    return `
      <div class="complaint-admin-card ${issue.is_emergency ? 'emergency-card-glow' : ''}" id="card-${issue.id}">
        <div class="complaint-admin-header">
          <div>
            ${issue.is_emergency ? `<span class="badge" style="background-color: #ef4444; color: white; text-transform: uppercase; font-size: 0.72rem; margin-right: 0.5rem; display: inline-block; animation: pulse-red 1.5s infinite;"><i class="fa-solid fa-triangle-exclamation"></i> EMERGENCY</span>` : ''}
            <span class="badge" style="background-color: var(--color-${issue.category || 'other'}); color: white; text-transform: uppercase; font-size: 0.72rem; margin-right: 0.5rem; display: inline-block;">
              ${catNames[issue.category] || 'Other'}
            </span>
            <h3 style="font-size: 1.25rem; font-weight: 700; margin-top: 0.5rem; display: inline-block;">${issue.title}</h3>
            <p style="color:var(--text-muted); font-size:0.88rem; margin-top:0.25rem; max-width:700px;">${issue.description}</p>
          </div>
          <span class="badge" style="background-color: var(--status-${issue.status === 'in_progress' ? 'in-progress' : (issue.status === 'rejected' ? 'duplicate' : (issue.status === 'assigned' ? 'investigating' : issue.status))}); color: white; text-transform: uppercase; font-size: 0.75rem;">
            ${statusText}
          </span>
        </div>

        <div style="font-size:0.82rem; color:var(--text-muted); display:flex; gap:1.5rem; flex-wrap:wrap;">
          <span><i class="fa-solid fa-location-dot"></i> ${issue.address || 'Address not listed'}</span>
          <span><i class="fa-solid fa-user"></i> Reported by: <strong>${reporterName}</strong></span>
          <span><i class="fa-solid fa-calendar-days"></i> ${new Date(issue.created_at).toLocaleDateString()}</span>
        </div>

        <div class="complaint-admin-body">
          <div class="delegation-control">
            <span style="font-size:0.85rem; font-weight:600;"><i class="fa-solid fa-user-gear"></i> Assigned Officer:</span>
            <select class="form-select complaint-delegate-select" data-issue-id="${issue.id}" style="margin: 0; padding: 0.35rem 0.75rem; font-size: 0.82rem; width: auto; cursor:pointer;">
              <option value="">-- Not Assigned --</option>
              ${dropdownOptions}
            </select>
          </div>

          <div class="action-row">
            <button class="btn btn-secondary btn-delete-complaint" data-issue-id="${issue.id}" style="padding: 0.35rem 0.75rem; font-size: 0.82rem; border-color: #fca5a5; color: #ef4444;">
              <i class="fa-solid fa-trash-can"></i> Delete
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Bind delegation select listeners
  document.querySelectorAll('.complaint-delegate-select').forEach(select => {
    select.addEventListener('change', async (e) => {
      const issueId = e.target.getAttribute('data-issue-id');
      const inspectorId = e.target.value;
      
      e.target.disabled = true;
      try {
        const assignRes = await API.assignIssue(issueId, inspectorId || null);
        if (assignRes.error) {
          showToast("Failed to delegate case: " + assignRes.error, "error");
          e.target.value = e.target.dataset.oldValue || e.target.value;
        } else {
          showToast("Complaint delegated successfully!");
          await loadComplaints(); // refresh
        }
      } catch (err) {
        console.error("delegate error:", err);
        showToast("Error delegating complaint", "error");
      } finally {
        e.target.disabled = false;
      }
    });
    select.dataset.oldValue = select.value;
  });

  // Bind delete button click listeners
  document.querySelectorAll('.btn-delete-complaint').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const issueId = e.target.closest('button').getAttribute('data-issue-id');
      
      if (confirm("Are you sure you want to delete this complaint? This will permanently erase the report, timeline logs, and upvotes.")) {
        try {
          const deleteRes = await API.deleteIssue(issueId);
          if (deleteRes.error) {
            showToast("Failed to delete complaint: " + deleteRes.error, "error");
          } else {
            showToast("Complaint deleted successfully!");
            // Smoothly remove card from DOM
            const card = document.getElementById(`card-${issueId}`);
            if (card) card.remove();
            
            // Reload local list cache
            currentComplaints = currentComplaints.filter(c => c.id !== issueId);
            if (currentComplaints.filter(c => filterStatus === '' || c.status === filterStatus).length === 0) {
              await loadComplaints();
            }
          }
        } catch (err) {
          console.error("delete error:", err);
          showToast("Error deleting complaint", "error");
        }
      }
    });
  });
}

// ----------------------------------------------------
// Tab 4: Department Management
// ----------------------------------------------------
async function loadDepartments() {
  const tbody = document.getElementById('departments-table-body');
  if (!tbody) return;

  tbody.innerHTML = `
    <tr>
      <td colspan="4" style="text-align: center; padding: 2rem; color: var(--text-muted);">
        <i class="fa-solid fa-spinner fa-spin" style="margin-right:0.5rem;"></i> Loading departments list...
      </td>
    </tr>
  `;

  try {
    const res = await API.getDepartments();
    if (res.error) {
      showToast("Failed to load departments: " + res.error, "error");
      tbody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align: center; padding: 2rem; color: var(--text-muted);">
            <i class="fa-solid fa-triangle-exclamation" style="color:var(--status-duplicate);"></i> Failed to load departments.
          </td>
        </tr>
      `;
      return;
    }

    allDepartments = res.data || [];
    renderDepartments();

  } catch (err) {
    console.error("loadDepartments error:", err);
    showToast("Server error loading departments", "error");
  }
}

function renderDepartments() {
  const tbody = document.getElementById('departments-table-body');
  if (!tbody) return;

  if (allDepartments.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align: center; padding: 2rem; color: var(--text-muted);">
          No departments exist. Click "Add New Department" to create one.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = allDepartments.map(dept => {
    return `
      <tr>
        <td style="font-family: monospace; font-weight: bold; color: var(--primary);">${dept.code}</td>
        <td style="font-weight: 600;">${dept.name}</td>
        <td style="color: var(--text-muted); font-size: 0.88rem;">${dept.description || 'No description provided.'}</td>
        <td style="text-align: right; white-space: nowrap;">
          <button class="btn btn-secondary btn-edit-dept" data-dept-id="${dept.id}" style="padding: 0.25rem 0.5rem; font-size: 0.8rem; margin-right: 0.25rem;">
            <i class="fa-solid fa-pen"></i> Edit
          </button>
          <button class="btn btn-secondary btn-delete-dept" data-dept-id="${dept.id}" style="padding: 0.25rem 0.5rem; font-size: 0.8rem; border-color: #fca5a5; color: #ef4444;">
            <i class="fa-solid fa-trash-can"></i> Delete
          </button>
        </td>
      </tr>
    `;
  }).join('');

  // Bind actions
  document.querySelectorAll('.btn-edit-dept').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const deptId = e.target.closest('button').getAttribute('data-dept-id');
      const dept = allDepartments.find(d => d.id === deptId);
      if (dept) {
        showDepartmentForm(dept);
      }
    });
  });

  document.querySelectorAll('.btn-delete-dept').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const deptId = e.target.closest('button').getAttribute('data-dept-id');
      if (confirm("Are you sure you want to delete this department? Authority users assigned to it will be unassigned.")) {
        try {
          const deleteRes = await API.deleteDepartment(deptId);
          if (deleteRes.error) {
            showToast("Failed to delete department: " + deleteRes.error, "error");
          } else {
            showToast("Department deleted successfully!");
            await loadDepartments();
          }
        } catch (err) {
          console.error("delete dept error:", err);
          showToast("Error deleting department", "error");
        }
      }
    });
  });
}

function showDepartmentForm(dept = null) {
  const formCard = document.getElementById('department-form-card');
  const formTitle = document.getElementById('dept-form-title');
  const editIdInput = document.getElementById('dept-edit-id');
  const nameInput = document.getElementById('dept-name-input');
  const codeInput = document.getElementById('dept-code-input');
  const descInput = document.getElementById('dept-desc-input');

  if (!formCard) return;

  formCard.classList.remove('hidden');

  if (dept) {
    formTitle.innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Edit Department: ${dept.name}`;
    editIdInput.value = dept.id;
    nameInput.value = dept.name;
    codeInput.value = dept.code;
    codeInput.disabled = true;
    descInput.value = dept.description || '';
  } else {
    formTitle.innerHTML = `<i class="fa-solid fa-square-plus"></i> Create Department`;
    editIdInput.value = '';
    nameInput.value = '';
    codeInput.value = '';
    codeInput.disabled = false;
    descInput.value = '';
  }

  formCard.scrollIntoView({ behavior: 'smooth' });
}

function hideDepartmentForm() {
  const formCard = document.getElementById('department-form-card');
  if (formCard) formCard.classList.add('hidden');
}

// ----------------------------------------------------
// Tab 5: AI Decisions Auditor
// ----------------------------------------------------
let aiDecisionsList = [];

async function loadAiDecisions() {
  const tbody = document.getElementById('ai-decisions-table-body');
  if (!tbody) return;

  tbody.innerHTML = `
    <tr>
      <td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-muted);">
        <i class="fa-solid fa-spinner fa-spin" style="margin-right:0.5rem;"></i> Querying AI model audit records...
      </td>
    </tr>
  `;

  try {
    const [decisionsRes, deptsRes] = await Promise.all([
      API.getAiDecisions(),
      API.getDepartments()
    ]);

    if (decisionsRes.error) {
      showToast("Failed to load AI decisions: " + decisionsRes.error, "error");
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-muted);">
            <i class="fa-solid fa-triangle-exclamation" style="color:var(--status-duplicate);"></i> Failed to load AI decisions.
          </td>
        </tr>
      `;
      return;
    }

    aiDecisionsList = decisionsRes.data || [];
    allDepartments = deptsRes.data || [];

    // Populate department list dropdown inside AI override block
    const overrideDeptSelect = document.getElementById('override-department');
    if (overrideDeptSelect) {
      overrideDeptSelect.innerHTML = allDepartments.map(d => `<option value="${d.name}">${d.name}</option>`).join('');
    }

    renderAiDecisions();

  } catch (err) {
    console.error("loadAiDecisions error:", err);
    showToast("Server error loading AI decisions", "error");
  }
}

function renderAiDecisions() {
  const tbody = document.getElementById('ai-decisions-table-body');
  if (!tbody) return;

  if (aiDecisionsList.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-muted);">
          No complaints reported yet. AI decisions will appear after citizen report submissions.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = aiDecisionsList.map(issue => {
    const isMatch = (issue.category || '').toLowerCase() === (issue.ai_category || '').toLowerCase();
    const matchBadge = isMatch 
      ? `<span class="badge" style="background-color: #10b981; color: white; font-size: 0.72rem; font-weight:700;">MATCH</span>`
      : `<span class="badge" style="background-color: #ef4444; color: white; font-size: 0.72rem; font-weight:700;">MISMATCH</span>`;

    return `
      <tr class="${issue.is_emergency ? 'emergency-row' : ''}">
        <td>
          <div style="font-weight: 600;">
            ${issue.is_emergency ? `<i class="fa-solid fa-triangle-exclamation" style="color: #ef4444; margin-right: 0.35rem; animation: pulse-red 1.5s infinite;" title="EMERGENCY"></i>` : ''}
            ${issue.title}
          </div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">${issue.id}</div>
        </td>
        <td style="text-transform: capitalize;">${issue.category || 'other'}</td>
        <td style="text-transform: capitalize; color: var(--primary); font-weight: 600;">${issue.ai_category || 'N/A'}</td>
        <td>${issue.ai_department || 'Unassigned'}</td>
        <td style="text-transform: uppercase; font-weight: bold; font-size: 0.8rem; color: var(--color-${issue.ai_priority === 'critical' ? 'roads' : (issue.ai_priority === 'high' ? 'streetlights' : 'water_supply')})">
          ${issue.ai_priority || 'MEDIUM'}
        </td>
        <td>${matchBadge}</td>
        <td style="text-align: right;">
          <button class="btn btn-secondary btn-override-ai" data-issue-id="${issue.id}" style="padding: 0.25rem 0.5rem; font-size: 0.8rem; border-color: #f59e0b; color: #f59e0b; font-weight: 600;">
            <i class="fa-solid fa-pen-nib"></i> Override
          </button>
        </td>
      </tr>
    `;
  }).join('');

  // Bind override actions
  document.querySelectorAll('.btn-override-ai').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const issueId = e.target.closest('button').getAttribute('data-issue-id');
      const issue = aiDecisionsList.find(i => i.id === issueId);
      if (issue) {
        showOverrideForm(issue);
      }
    });
  });
}

function showOverrideForm(issue) {
  const formCard = document.getElementById('ai-override-card');
  const issueIdInput = document.getElementById('override-issue-id');
  const catSelect = document.getElementById('override-category');
  const deptSelect = document.getElementById('override-department');
  const priSelect = document.getElementById('override-priority');

  if (!formCard) return;

  formCard.classList.remove('hidden');
  issueIdInput.value = issue.id;
  catSelect.value = issue.category || 'other';

  if (deptSelect) {
    deptSelect.value = issue.ai_department || (allDepartments[0] ? allDepartments[0].name : '');
  }

  if (priSelect) {
    priSelect.value = issue.ai_priority || 'medium';
  }

  formCard.scrollIntoView({ behavior: 'smooth' });
}

function hideOverrideForm() {
  const formCard = document.getElementById('ai-override-card');
  if (formCard) formCard.classList.add('hidden');
}

// ----------------------------------------------------
// Event Initializations
// ----------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
  if (window.authInitPromise) {
    await window.authInitPromise;
  }
  if (!checkAdminAccess()) return;
    
    // Setup tab listeners
    const tabs = document.querySelectorAll('.tab-btn');
    const panes = document.querySelectorAll('.tab-pane');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
        });
        panes.forEach(p => p.classList.add('hidden'));
        
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        const targetId = tab.getAttribute('aria-controls');
        const targetPane = document.getElementById(targetId);
        if (targetPane) targetPane.classList.remove('hidden');
        
        // Load data corresponding to tab
        if (targetId === 'pane-analytics') {
          loadAnalytics();
        } else if (targetId === 'pane-users') {
          loadUsers();
        } else if (targetId === 'pane-complaints') {
          loadComplaints();
        } else if (targetId === 'pane-departments') {
          loadDepartments();
        } else if (targetId === 'pane-ai-decisions') {
          loadAiDecisions();
        }
      });
    });

    // User Search and Filter Listeners
    const searchInput = document.getElementById('user-search-input');
    const roleFilter = document.getElementById('user-role-filter');
    if (searchInput) searchInput.addEventListener('input', filterAndRenderUsers);
    if (roleFilter) roleFilter.addEventListener('change', filterAndRenderUsers);

    // Complaint status filters
    const complaintFiltersContainer = document.getElementById('admin-status-filters');
    if (complaintFiltersContainer) {
      complaintFiltersContainer.addEventListener('click', async (e) => {
        const pill = e.target.closest('.filter-pill');
        if (!pill) return;
        
        complaintFiltersContainer.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        await loadComplaints();
      });
    }

    // Department CRUD Form Bindings
    const deptForm = document.getElementById('department-crud-form');
    if (deptForm) {
      deptForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('dept-edit-id').value;
        const name = document.getElementById('dept-name-input').value;
        const code = document.getElementById('dept-code-input').value;
        const description = document.getElementById('dept-desc-input').value;

        const submitBtn = document.getElementById('btn-submit-dept');
        if (submitBtn) submitBtn.disabled = true;

        try {
          let res;
          if (id) {
            res = await API.updateDepartment(id, { name, description });
          } else {
            res = await API.createDepartment({ name, code, description });
          }

          if (res.error) {
            showToast("Failed to save department: " + res.error, "error");
          } else {
            showToast(id ? "Department updated successfully!" : "Department created successfully!");
            hideDepartmentForm();
            await loadDepartments();
          }
        } catch (err) {
          console.error("save department error:", err);
          showToast("Error saving department", "error");
        } finally {
          if (submitBtn) submitBtn.disabled = false;
        }
      });
    }

    const cancelDeptBtn = document.getElementById('btn-cancel-dept');
    if (cancelDeptBtn) cancelDeptBtn.addEventListener('click', hideDepartmentForm);

    const addDeptBtn = document.getElementById('btn-add-department');
    if (addDeptBtn) addDeptBtn.addEventListener('click', () => showDepartmentForm(null));

    // AI Override Form Bindings
    const overrideForm = document.getElementById('ai-override-form');
    if (overrideForm) {
      overrideForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('override-issue-id').value;
        const category = document.getElementById('override-category').value;
        const department = document.getElementById('override-department').value;
        const priority = document.getElementById('override-priority').value;

        try {
          const res = await API.overrideAiDecision(id, { category, department, priority });
          if (res.error) {
            showToast("Failed to override AI decision: " + res.error, "error");
          } else {
            showToast("AI decisions overridden successfully!");
            hideOverrideForm();
            await loadAiDecisions();
          }
        } catch (err) {
          console.error("AI override error:", err);
          showToast("Error executing AI override", "error");
        }
      });
    }

    const cancelOverrideBtn = document.getElementById('btn-cancel-override');
    if (cancelOverrideBtn) cancelOverrideBtn.addEventListener('click', hideOverrideForm);

    // Export Reports Bindings
    const exportBtn = document.getElementById('btn-export-report');
    if (exportBtn) {
      exportBtn.addEventListener('click', async () => {
        const range = document.getElementById('export-range').value;
        const formatEl = document.querySelector('input[name="export-format"]:checked');
        const format = formatEl ? formatEl.value : 'csv';

        exportBtn.disabled = true;
        const originalText = exportBtn.innerHTML;
        exportBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Generating report...`;

        try {
          const token = typeof getAuthToken === 'function' ? getAuthToken() : null;
          const url = `/api/issues/admin/reports/export?range=${range}&format=${format}`;

          const response = await fetch(url, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

          if (!response.ok) {
            const errorMsg = await response.text();
            throw new Error(errorMsg || `HTTP error ${response.status}`);
          }

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
          } else if (format === 'pdf') {
            const html = await response.text();
            const printWindow = window.open('', '_blank');
            if (printWindow) {
              printWindow.document.open();
              printWindow.document.write(html);
              printWindow.document.close();
              showToast("HTML printable report loaded!");
            } else {
              showToast("Pop-up blocked. Please allow pop-ups to print reports.", "error");
            }
          }
        } catch (err) {
          console.error("export report error:", err);
          showToast("Failed to generate report: " + err.message, "error");
        } finally {
          exportBtn.disabled = false;
          exportBtn.innerHTML = originalText;
        }
      });
    }

    // Load default tab
    loadAnalytics();
});

// Watch for authentication changes (mock role changes)
window.addEventListener('auth-change', () => {
  if (checkAdminAccess()) {
    const activeTab = document.querySelector('.tab-btn.active');
    if (activeTab) {
      const targetId = activeTab.getAttribute('aria-controls');
      if (targetId === 'pane-analytics') loadAnalytics();
      else if (targetId === 'pane-users') loadUsers();
      else if (targetId === 'pane-complaints') loadComplaints();
      else if (targetId === 'pane-departments') loadDepartments();
      else if (targetId === 'pane-ai-decisions') loadAiDecisions();
    }
  }
});

// Watch for language change to reload translation contents
window.addEventListener('language-change', () => {
  if (typeof checkAdminAccess === 'function' && checkAdminAccess()) {
    const activeTab = document.querySelector('.tab-btn.active');
    if (activeTab) {
      const targetId = activeTab.getAttribute('aria-controls');
      if (targetId === 'pane-analytics') loadAnalytics();
      else if (targetId === 'pane-users') loadUsers();
      else if (targetId === 'pane-complaints') loadComplaints();
      else if (targetId === 'pane-departments') loadDepartments();
      else if (targetId === 'pane-ai-decisions') loadAiDecisions();
    }
  }
});
