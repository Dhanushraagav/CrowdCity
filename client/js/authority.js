// CrowdCity - Authority Dashboard Controller

let activeStatusFilter = '';
let currentAssignedIssues = [];

// Initialize Page
async function initAuthorityDashboard() {
  // Check authorization role
  const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  const role = typeof getUserRole === 'function' ? getUserRole() : null;

  if (!user || (role !== 'authority' && role !== 'admin')) {
    window.showToast("Unauthorized: You must be logged in as an Authority inspector or Administrator to access this portal.", "error");
    window.authRouter.redirectToLogin('authority');
    return;
  }

  // Display authority nav link explicitly
  const authorityLink = document.getElementById('nav-authority-link');
  if (authorityLink) authorityLink.classList.remove('hidden');

  setupModalHandlers();
  setupFilterListeners();
  await loadDashboardData();
}

// Load caseload statistics and complaint queue feed
async function loadDashboardData() {
  await loadStats();
  await loadQueueList();
}

// Load Caseload Metrics
async function loadStats() {
  const { data: stats, error } = await window.API.getAuthorityStats();
  if (error || !stats) {
    console.error("Failed to load caseload statistics:", error);
    return;
  }

  document.getElementById('stats-total').textContent = stats.totalAssigned || 0;
  document.getElementById('stats-assigned').textContent = stats.assigned || 0;
  document.getElementById('stats-progress').textContent = stats.inProgress || 0;
  document.getElementById('stats-resolved').textContent = stats.resolved || 0;
}

// Load Assigned Complaints Queue
async function loadQueueList() {
  const queueContainer = document.getElementById('authority-queue-list');
  if (!queueContainer) return;

  queueContainer.innerHTML = `
    <div class="issue-card skeleton-pulse skeleton-card"></div>
    <div class="issue-card skeleton-pulse skeleton-card"></div>
  `;

  const user = getCurrentUser();
  const { data: issues, error } = await window.API.getIssues({
    assigned_to: user.id,
    status: activeStatusFilter
  });

  if (error || !issues) {
    queueContainer.innerHTML = `
      <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
        <i class="fa-solid fa-circle-xmark" style="font-size: 2rem; color: #ef4444; margin-bottom: 0.5rem;"></i>
        <p>Failed to load complaints queue: ${error || 'Unknown error'}</p>
      </div>
    `;
    return;
  }

  currentAssignedIssues = issues;
  renderQueueList(issues);
}

// Render queue list cards
function renderQueueList(issues) {
  const queueContainer = document.getElementById('authority-queue-list');
  if (!queueContainer) return;

  if (issues.length === 0) {
    queueContainer.innerHTML = `
      <div style="text-align: center; padding: 3rem 1.5rem; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-md); color: var(--text-muted);">
        <i class="fa-solid fa-clipboard-check" style="font-size: 2.5rem; margin-bottom: 0.75rem; color: var(--slate-300);"></i>
        <p style="font-weight: 600; font-size: 0.95rem;">Clear Caseload Queue!</p>
        <p style="font-size: 0.8rem; margin-top: 0.25rem;">No complaints require status updates in this category.</p>
      </div>
    `;
    return;
  }

  queueContainer.innerHTML = issues.map(issue => {
    const formattedDate = formatDate(new Date(issue.created_at));
    const isResolved = issue.status === 'resolved';

    let actionBtnHtml = `
      <button class="btn btn-primary" onclick="openStatusModal('${issue.id}', '${escapeQuote(issue.title)}', '${issue.status}')" style="padding: 0.4rem 0.85rem; font-size: 0.8rem; border-radius: var(--radius-sm);">
        <i class="fa-solid fa-pen-to-square"></i> Update Status
      </button>
    `;

    if (isResolved) {
      actionBtnHtml = `
        <span style="font-size: 0.8rem; color: var(--status-resolved); font-weight: 700; display:inline-flex; align-items:center; gap:0.25rem;">
          <i class="fa-solid fa-circle-check"></i> Work Completed
        </span>
      `;
    }

    return `
      <article class="issue-card ${issue.is_emergency ? 'emergency-card-glow' : ''}" style="background-color: var(--bg-surface);">
        <div class="issue-card-header">
          <span class="badge badge-category ${issue.category}">${window.formatCategoryName(issue.category)}</span>
          <div style="display: flex; gap: 0.5rem; align-items: center;">
            ${issue.is_emergency ? `<span class="badge badge-status critical" style="background-color: #ef4444; animation: pulse-red 1.5s infinite;"><i class="fa-solid fa-triangle-exclamation"></i> EMERGENCY</span>` : ''}
            <span class="badge badge-status ${issue.status}">${issue.status.replace('_', ' ')}</span>
          </div>
        </div>
        <h3 class="issue-card-title">${escapeHTML(issue.title)}</h3>
        <p class="issue-card-description" style="-webkit-line-clamp: 3;">${escapeHTML(issue.description)}</p>
        
        <div style="font-size: 0.8rem; color: var(--text-muted); display: flex; align-items: center; gap: 0.35rem; margin: 0.25rem 0;">
          <i class="fa-solid fa-location-dot"></i> <span>${escapeHTML(issue.address || 'Address')}</span>
        </div>

        <div class="issue-card-meta" style="margin-top: 0.5rem; padding-top: 0.75rem;">
          <div style="font-size: 0.75rem; color: var(--text-muted);">
            <i class="fa-regular fa-calendar-days"></i> Assigned: ${formattedDate}
          </div>
          <div style="display: flex; gap: 0.5rem; align-items:center;">
            ${actionBtnHtml}
            <a href="authority-issue-details.html?id=${issue.id}" class="btn btn-secondary" style="padding: 0.4rem 0.85rem; font-size: 0.8rem; border-radius: var(--radius-sm);">
              View details
            </a>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

// Setup Status Filter Pills
function setupFilterListeners() {
  const filters = document.getElementById('authority-status-filters');
  if (!filters) return;

  filters.addEventListener('click', async (e) => {
    const pill = e.target.closest('.filter-pill');
    if (!pill) return;

    filters.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');

    activeStatusFilter = pill.dataset.status;
    await loadQueueList();
  });
}

// Modal dialog configurations
function setupModalHandlers() {
  const modal = document.getElementById('status-modal');
  const closeBtn = document.getElementById('btn-close-modal');
  const statusSelect = document.getElementById('modal-status-select');
  const proofGroup = document.getElementById('modal-proof-group');
  
  // Close triggers
  closeBtn.addEventListener('click', () => modal.classList.remove('active'));
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('active');
  });

  // Toggle image upload proof on Resolved selection
  statusSelect.addEventListener('change', (e) => {
    if (e.target.value === 'resolved') {
      proofGroup.classList.remove('hidden');
    } else {
      proofGroup.classList.add('hidden');
    }
  });

  // Setup completion proof image upload preview
  const uploadZone = document.getElementById('proof-upload-zone');
  const fileInput = document.getElementById('modal-proof-input');
  const previewContainer = document.getElementById('proof-preview-container');
  const previewImage = document.getElementById('proof-preview');
  const removeBtn = document.getElementById('btn-remove-proof');

  uploadZone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    if (fileInput.files.length) {
      const reader = new FileReader();
      reader.onload = (e) => {
        previewImage.src = e.target.result;
        previewContainer.classList.remove('hidden');
        uploadZone.classList.add('hidden');
      };
      reader.readAsDataURL(fileInput.files[0]);
    }
  });

  removeBtn.addEventListener('click', () => {
    fileInput.value = '';
    previewContainer.classList.add('hidden');
    uploadZone.classList.remove('hidden');
  });

  // Handle Form submit
  const form = document.getElementById('modal-status-form');
  const alertBanner = document.getElementById('modal-alert');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    alertBanner.classList.add('hidden');

    const issueId = document.getElementById('modal-issue-id').value;
    const status = statusSelect.value;
    const remarks = document.getElementById('modal-remarks').value.trim();

    // Validation
    if (status === 'resolved' && fileInput.files.length === 0) {
      alertBanner.textContent = 'Please upload a photo proof of completion to resolve the complaint.';
      alertBanner.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
      alertBanner.style.color = '#ef4444';
      alertBanner.classList.remove('hidden');
      return;
    }

    const submitBtn = document.getElementById('btn-modal-submit');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Saving...';

    // Pack FormData
    const formData = new FormData();
    formData.append('status', status);
    formData.append('notes', remarks);
    if (fileInput.files.length) {
      formData.append('proof', fileInput.files[0]);
    }

    const { data, error } = await window.API.updateIssueStatus(issueId, formData);

    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Changes';

    if (error) {
      alertBanner.textContent = `Update failed: ${error}`;
      alertBanner.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
      alertBanner.style.color = '#ef4444';
      alertBanner.classList.remove('hidden');
    } else {
      modal.classList.remove('active');
      window.showToast('Case status updated successfully!', 'success');
      
      // Reload stats and queue list
      await loadDashboardData();
    }
  });
}

// Open update modal programmatically
function openStatusModal(id, title, status) {
  const modal = document.getElementById('status-modal');
  
  // Set details
  document.getElementById('modal-issue-id').value = id;
  document.getElementById('modal-issue-title').innerHTML = `Update: <span style="color:var(--primary); font-weight:700;">${escapeHTML(title)}</span>`;
  document.getElementById('modal-status-select').value = status;
  document.getElementById('modal-remarks').value = '';
  
  // Reset file input and previews
  document.getElementById('modal-proof-input').value = '';
  document.getElementById('proof-preview-container').classList.add('hidden');
  document.getElementById('proof-upload-zone').classList.remove('hidden');

  // Trigger select change to hide/show upload panel initially
  document.getElementById('modal-status-select').dispatchEvent(new Event('change'));

  // Open modal
  modal.classList.add('active');
}
window.openStatusModal = openStatusModal;

// Helper date formatter
function formatDate(date) {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

// Escape quotes helper
function escapeQuote(str) {
  if (!str) return '';
  return str.replace(/'/g, "\\'");
}

// Escapes raw HTML to prevent injection
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

// Listen for auth-change custom events to refresh dashboard
window.addEventListener('auth-change', async () => {
  await initAuthorityDashboard();
});

// Bootstrap authority dashboard page
window.addEventListener('DOMContentLoaded', async () => {
  if (window.authInitPromise) {
    await window.authInitPromise;
  }
  await initAuthorityDashboard();
});
