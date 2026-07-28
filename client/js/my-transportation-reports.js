// CrowdCity AI v3.2 - My Transportation Reports Controller

let allMyReports = [];
let filteredReports = [];

document.addEventListener('DOMContentLoaded', () => {
  loadMyTransportationReports();
});

async function loadMyTransportationReports() {
  const tbody = document.getElementById('my-reports-tbody');
  if (!tbody) return;

  tbody.innerHTML = `
    <tr>
      <td colspan="8" style="text-align: center; padding: 2rem; color: var(--text-muted);">
        <i class="fa-solid fa-circle-notch fa-spin"></i> Loading your transportation reports...
      </td>
    </tr>
  `;

  let userId = 'citizen_anonymous';
  try {
    if (typeof getCurrentUser === 'function') {
      const user = getCurrentUser();
      if (user) userId = user.id;
    }
  } catch (err) {}

  try {
    let reports = [];
    if (window.API && typeof window.API.getTransportationReports === 'function') {
      const res = await window.API.getTransportationReports({ user_id: userId });
      reports = (res && res.reports) ? res.reports : ((res && res.data && res.data.reports) ? res.data.reports : []);
    }

    if (!reports) {
      reports = [];
    }

    allMyReports = reports;
    filteredReports = [...allMyReports];
    renderReportsTable(filteredReports);
  } catch (err) {
    console.error('Failed to load my transportation reports:', err);
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 2rem; color: #ef4444;">
          Failed to load transportation reports. Please try refreshing.
        </td>
      </tr>
    `;
  }
}

function filterMyReports() {
  const search = document.getElementById('trans-search-input')?.value.trim().toLowerCase() || '';
  const category = document.getElementById('filter-category')?.value || 'All';
  const priority = document.getElementById('filter-priority')?.value || 'All';
  const department = document.getElementById('filter-department')?.value || 'All';
  const status = document.getElementById('filter-status')?.value || 'All';

  filteredReports = allMyReports.filter(r => {
    if (category !== 'All' && (r.category || '').toLowerCase() !== category.toLowerCase()) return false;
    if (priority !== 'All' && (r.priority || '').toLowerCase() !== priority.toLowerCase()) return false;
    if (department !== 'All' && (r.responsible_department || '').toLowerCase() !== department.toLowerCase()) return false;
    if (status !== 'All' && (r.status || '').toLowerCase() !== status.toLowerCase()) return false;

    if (search !== '') {
      const match = (r.title || '').toLowerCase().includes(search) ||
                    (r.road_name || '').toLowerCase().includes(search) ||
                    (r.address || '').toLowerCase().includes(search) ||
                    (r.report_number || '').toLowerCase().includes(search) ||
                    (r.category || '').toLowerCase().includes(search);
      if (!match) return false;
    }

    return true;
  });

  renderReportsTable(filteredReports);
}

function resetFilters() {
  document.getElementById('trans-search-input').value = '';
  document.getElementById('filter-category').value = 'All';
  document.getElementById('filter-priority').value = 'All';
  document.getElementById('filter-department').value = 'All';
  document.getElementById('filter-status').value = 'All';
  filteredReports = [...allMyReports];
  renderReportsTable(filteredReports);
}

function renderReportsTable(reports) {
  const tbody = document.getElementById('my-reports-tbody');
  if (!tbody) return;

  if (!reports || reports.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 2.5rem 1rem; color: var(--text-muted);">
          No transportation reports found matching your criteria.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = reports.map(r => {
    const prioClass = `prio-${(r.priority || 'medium').toLowerCase()}`;
    const statusClass = getStatusBadgeClass(r.status);
    const dateStr = new Date(r.created_at || Date.now()).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });

    return `
      <tr>
        <td style="font-weight: 800; color: var(--primary);">#${escapeHtml(r.report_number || r.id)}</td>
        <td>
          <div style="font-weight: 700; color: var(--text-main);">${escapeHtml(r.title)}</div>
          <div style="font-size: 0.78rem; color: var(--text-muted);">${escapeHtml(r.road_name || r.address || 'Coimbatore')}</div>
        </td>
        <td><span style="font-size: 0.82rem; font-weight: 600;">${escapeHtml(r.category)}</span></td>
        <td><span class="prio-badge ${prioClass}">${escapeHtml(r.priority || 'Medium')}</span></td>
        <td><span style="font-size: 0.82rem; color: var(--text-main);">${escapeHtml(r.responsible_department || 'Roads Dept')}</span></td>
        <td><span class="status-badge ${statusClass}">${escapeHtml(r.status || 'Submitted')}</span></td>
        <td style="font-size: 0.82rem; color: var(--text-muted);">${dateStr}</td>
        <td>
          <button type="button" onclick="openDetailsModal('${r.id}')" class="btn btn-outline" style="font-size: 0.75rem; padding: 0.3rem 0.65rem;">
            <i class="fa-solid fa-eye"></i> View Details
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function getStatusBadgeClass(status) {
  const s = (status || '').toLowerCase();
  if (s.includes('submitted')) return 'status-submitted';
  if (s.includes('assigned')) return 'status-assigned';
  if (s.includes('progress')) return 'status-progress';
  if (s.includes('resolved')) return 'status-resolved';
  return 'status-closed';
}

function openDetailsModal(reportId) {
  const report = allMyReports.find(r => r.id === reportId || r.report_number === reportId);
  if (!report) return;

  const modal = document.getElementById('trans-details-modal');
  const body = document.getElementById('modal-body-content');
  if (!modal || !body) return;

  document.getElementById('modal-title').textContent = `Transportation Report #${report.report_number || report.id}`;

  const prioClass = `prio-${(report.priority || 'medium').toLowerCase()}`;
  const statusClass = getStatusBadgeClass(report.status);

  body.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.75rem; background: var(--bg-surface-hover); padding: 0.85rem; border-radius: 10px; border: 1px solid var(--border-color);">
      <div>
        <h4 style="margin: 0 0 0.25rem 0; font-size: 1rem; font-weight: 800; color: var(--text-main);">${escapeHtml(report.title)}</h4>
        <span style="font-size: 0.8rem; color: var(--text-muted);">${escapeHtml(report.address || '')}</span>
      </div>
      <div style="text-align: right;">
        <span class="status-badge ${statusClass}">${escapeHtml(report.status || 'Submitted')}</span>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; font-size: 0.84rem;">
      <div><strong>Category:</strong> ${escapeHtml(report.category)}</div>
      <div><strong>Priority:</strong> <span class="prio-badge ${prioClass}">${escapeHtml(report.priority)}</span></div>
      <div><strong>Department:</strong> ${escapeHtml(report.responsible_department || 'Roads Dept')}</div>
      <div><strong>Assigned Official:</strong> ${escapeHtml(report.assigned_to || 'Unassigned')}</div>
    </div>

    <div>
      <strong style="display: block; margin-bottom: 4px;">Issue Description:</strong>
      <div style="background: var(--bg-surface-hover); padding: 0.75rem; border-radius: 8px; font-size: 0.85rem; color: var(--text-main); border: 1px solid var(--border-color);">
        ${escapeHtml(report.description || 'No description provided.')}
      </div>
    </div>

    ${report.summary ? `
      <div>
        <strong style="display: block; margin-bottom: 4px; color: var(--primary);">Groq AI Executive Summary:</strong>
        <div style="background: rgba(13, 148, 136, 0.08); padding: 0.75rem; border-radius: 8px; font-size: 0.85rem; color: var(--text-main); border: 1px solid rgba(13, 148, 136, 0.2);">
          ${escapeHtml(report.summary)}
        </div>
      </div>
    ` : ''}

    ${report.suggested_resolution ? `
      <div>
        <strong style="display: block; margin-bottom: 4px; color: #059669;">Suggested Engineering Action:</strong>
        <div style="background: rgba(16, 185, 129, 0.08); padding: 0.75rem; border-radius: 8px; font-size: 0.85rem; color: var(--text-main); border: 1px solid rgba(16, 185, 129, 0.2);">
          ${escapeHtml(report.suggested_resolution)}
        </div>
      </div>
    ` : ''}

    ${Array.isArray(report.photo_urls) && report.photo_urls.length > 0 ? `
      <div>
        <strong style="display: block; margin-bottom: 6px;">Attached Photos:</strong>
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          ${report.photo_urls.map(url => `
            <img src="${escapeHtml(url)}" alt="Photo" style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px; border: 1px solid var(--border-color);" />
          `).join('')}
        </div>
      </div>
    ` : ''}
  `;

  modal.style.display = 'flex';
}

function closeDetailsModal() {
  const modal = document.getElementById('trans-details-modal');
  if (modal) modal.style.display = 'none';
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
