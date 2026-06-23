// CrowdCity - Authority Reports Controller

let allIssues = [];
let lastLoadedUserIdAuthReports = null;

const bootstrapReports = () => {
  // Check authorization and load data
  window.addEventListener('auth-change', (e) => {
    const user = getCurrentUser();
    const role = getUserRole();
    if (!user || (role !== 'authority' && role !== 'admin')) {
      window.authRouter.redirectToLogin('authority');
    } else {
      if (user.id === lastLoadedUserIdAuthReports) {
        // Prevent duplicate calls that cause layout flickering
        return;
      }
      lastLoadedUserIdAuthReports = user.id;
      loadReportsData();
    }
  });

  const user = getCurrentUser();
  if (user) {
    lastLoadedUserIdAuthReports = user.id;
    loadReportsData();
  }

  setupFilterListeners();
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrapReports);
} else {
  bootstrapReports();
}

async function loadReportsData() {
  const { data: issues, error } = await window.API.getIssues();
  if (error || !issues) {
    console.error("Failed to load reports queue:", error);
    const tbody = document.getElementById('reports-list-body');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 3rem; color: var(--text-muted);">
            <i class="fa-solid fa-circle-xmark" style="font-size: 1.5rem; color: #ef4444; margin-bottom: 0.5rem;"></i>
            <p>Failed to load cases from database. Please refresh or try again later.</p>
          </td>
        </tr>
      `;
    }
    return;
  }

  allIssues = issues;
  applyFiltersAndRender();
}

function setupFilterListeners() {
  const searchInput = document.getElementById('search-input');
  const categoryFilter = document.getElementById('category-filter');
  const statusFilter = document.getElementById('status-filter');
  const assigneeFilter = document.getElementById('assignee-filter');

  const triggers = [categoryFilter, statusFilter, assigneeFilter];
  triggers.forEach(t => {
    if (t) t.addEventListener('change', applyFiltersAndRender);
  });

  if (searchInput) {
    searchInput.addEventListener('input', applyFiltersAndRender);
  }
}

function applyFiltersAndRender() {
  const tbody = document.getElementById('reports-list-body');
  if (!tbody) return;

  const searchInput = document.getElementById('search-input');
  const categoryFilter = document.getElementById('category-filter');
  const statusFilter = document.getElementById('status-filter');
  const assigneeFilter = document.getElementById('assignee-filter');

  const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
  const categoryVal = categoryFilter ? categoryFilter.value : '';
  const statusVal = statusFilter ? statusFilter.value : '';
  const assigneeVal = assigneeFilter ? assigneeFilter.value : '';

  const user = getCurrentUser();
  if (!user) return;

  let filtered = [...allIssues];

  // 1. Search term filter
  if (searchTerm) {
    filtered = filtered.filter(i => 
      i.title.toLowerCase().includes(searchTerm) ||
      i.description.toLowerCase().includes(searchTerm) ||
      (i.address && i.address.toLowerCase().includes(searchTerm))
    );
  }

  // 2. Category filter
  if (categoryVal) {
    filtered = filtered.filter(i => i.category === categoryVal);
  }

  // 3. Status filter
  if (statusVal) {
    filtered = filtered.filter(i => i.status === statusVal);
  }

  // 4. Assignee filter
  if (assigneeVal === 'me') {
    filtered = filtered.filter(i => i.assigned_to === user.id);
  } else if (assigneeVal === 'unassigned') {
    filtered = filtered.filter(i => !i.assigned_to);
  }

  // Sort newest first
  filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 4rem; color: var(--text-muted);">
          <i class="fa-regular fa-folder-open" style="font-size: 2.5rem; margin-bottom: 0.75rem; opacity: 0.6;"></i>
          <p style="font-weight: 600; font-size: 0.95rem;">No cases match active filters</p>
          <p style="font-size: 0.8rem; margin-top: 0.2rem;">Try adjusting search terms or status select dropdown values.</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(issue => {
    const dateStr = new Date(issue.created_at).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    const assigneeName = issue.reporter?.full_name || 'System Dispatcher'; // Fallback if no joined reporter profile exists
    // Wait, the API joins reporter:profiles!issues_reporter_id_fkey(full_name, avatar_url)
    // Wait! Let's check who the assignee is.
    // In our database update, we can fetch profiles or check if reporter is resolved.
    // Wait! Let's check how the assignee's name is obtained.
    // In `server/controllers/issueController.js` `getAllIssues`, does it query assignee profile details?
    // Let's check `getAllIssues`:
    // `let query = activeClient.from('issues').select('*, reporter:profiles!issues_reporter_id_fkey(full_name, avatar_url)');`
    // Ah! It only selects reporter profiles. It does NOT select the assignee profile details!
    // Wait, so `issue.assigned_to` is just the UUID.
    // But wait! How does the inspector see who it is assigned to?
    // If it equals their own user.id, it's assigned to "Me" / logged-in worker.
    // If it's another ID, we can display "Assigned (ID)" or do a lookup, or if it's null, display "Unassigned".
    // Let's show:
    // If `!issue.assigned_to`, show `Unassigned` (gray text).
    // If `issue.assigned_to === user.id`, show `Me` / `You`.
    // If `issue.assigned_to`, show `Assigned`.
    // This is clean, robust, and doesn't require any modifications to the backend select query!
    
    let assigneeText = '<span style="color: var(--text-muted); font-style: italic;">Unassigned</span>';
    if (issue.assigned_to) {
      assigneeText = issue.assigned_to === user.id ? 
        '<span style="color: var(--primary); font-weight: 700;">Me</span>' : 
        '<span style="color: var(--text-main); font-weight: 600;">Assigned</span>';
    }

    const truncatedAddress = issue.address ? 
      (issue.address.length > 30 ? issue.address.substring(0, 30) + '...' : issue.address) : 
      `Coordinates: ${issue.latitude.toFixed(4)}, ${issue.longitude.toFixed(4)}`;

    return `
      <tr class="${issue.is_emergency ? 'emergency-row' : ''}">
        <td><span class="badge badge-category ${issue.category}">${window.formatCategoryName(issue.category)}</span></td>
        <td style="font-weight: 700; color: var(--text-main); max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          ${issue.is_emergency ? `<i class="fa-solid fa-triangle-exclamation" style="color: #ef4444; margin-right: 0.35rem; animation: pulse-red 1.5s infinite;" title="EMERGENCY"></i>` : ''}
          ${escapeHTML(issue.title)}
        </td>
        <td>${dateStr}</td>
        <td style="max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHTML(issue.address || '')}">${escapeHTML(truncatedAddress)}</td>
        <td><span class="badge badge-status ${issue.status}">${issue.status.replace('_', ' ')}</span></td>
        <td>${assigneeText}</td>
        <td style="text-align: center;">
          <a href="authority-issue-details.html?id=${issue.id}" class="btn btn-secondary" style="padding: 0.35rem 0.75rem; font-size: 0.78rem; font-weight: 700; border-radius: var(--radius-sm);">
            <i class="fa-solid fa-magnifying-glass-chart"></i> Inspect
          </a>
        </td>
      </tr>
    `;
  }).join('');
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
