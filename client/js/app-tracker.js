// CrowdCity AI v2.0 - Government Application Tracker JavaScript
// Manages application tracking records, status updates, timeline activity logs, and Supabase database sync.

(function() {
  'use strict';

  let trackedApplications = [];
  let currentFilterStatus = 'all';
  let currentSearchQuery = '';

  const fallbackApplications = [
    {
      id: 'app-tn-kmut-demo',
      scheme_name: 'Kalaignar Magalir Urimai Thittam',
      department_name: 'Social Welfare & Women Empowerment Dept, Govt of TN',
      application_ref_no: 'TN-KMUT-2026-88194',
      submission_date: '2026-06-15',
      status: 'Under Verification',
      official_portal_url: 'https://kmut.tn.gov.in/',
      notes: 'Application submitted via E-Sevai center. Ration Card and Bank Passbook verified.',
      created_at: new Date().toISOString()
    },
    {
      id: 'app-central-pmkisan-demo',
      scheme_name: 'PM Kisan Samman Nidhi (PM-KISAN)',
      department_name: 'Ministry of Agriculture, Govt of India',
      application_ref_no: 'PMK-2026-1049281',
      submission_date: '2026-05-10',
      status: 'Approved',
      official_portal_url: 'https://pmkisan.gov.in/',
      notes: 'Direct Benefit Transfer installment approved and scheduled.',
      created_at: new Date().toISOString()
    }
  ];

  async function fetchTrackedApplications() {
    const container = document.getElementById('applications-list-container');
    if (container) {
      container.innerHTML = `
        <div style="text-align: center; padding: 4rem 1rem;">
          <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 2.2rem; color: var(--primary); margin-bottom: 1rem;"></i>
          <p style="font-size: 0.95rem; color: var(--text-muted);">Loading your government application records...</p>
        </div>
      `;
    }

    try {
      if (typeof window.getOrInitSupabaseClient === 'function') {
        const client = await window.getOrInitSupabaseClient();
        if (client) {
          const session = await client.auth.getSession();
          const userId = session?.data?.session?.user?.id;

          if (!userId) {
            renderEmptyState("Please sign in to organize and track your government applications.");
            return;
          }

          const { data, error } = await client
            .from('user_scheme_applications')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

          if (!error && data) {
            trackedApplications = data;
            localStorage.setItem('cc_user_tracked_apps', JSON.stringify(trackedApplications));
            renderApplicationsList();
            return;
          }
        }
      }
    } catch (err) {
      console.warn("Supabase fetch applications error, using local fallback:", err);
    }

    // LocalStorage Fallback
    try {
      const stored = localStorage.getItem('cc_user_tracked_apps');
      if (stored) {
        trackedApplications = JSON.parse(stored);
        renderApplicationsList();
        return;
      }
    } catch (e) {}

    trackedApplications = [...fallbackApplications];
    renderApplicationsList();
  }

  function renderEmptyState(message) {
    const container = document.getElementById('applications-list-container');
    const countElem = document.getElementById('app-tracker-count');
    if (countElem) countElem.textContent = '0';

    if (!container) return;

    container.innerHTML = `
      <div style="text-align: center; padding: 4rem 1.5rem; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 20px;">
        <i class="fa-solid fa-folder-open" style="font-size: 2.8rem; color: var(--text-muted); margin-bottom: 1rem;"></i>
        <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--text-main); margin: 0 0 0.5rem 0;">No Tracked Applications</h3>
        <p style="font-size: 0.9rem; color: var(--text-muted); max-width: 480px; margin: 0 auto 1.5rem auto; line-height: 1.5;">${message}</p>
        <button type="button" class="btn btn-primary" onclick="document.getElementById('add-app-modal').style.display='flex'" style="padding: 0.75rem 1.5rem; font-weight: 700; border-radius: 12px; display: inline-flex; align-items: center; gap: 0.5rem;">
          <i class="fa-solid fa-plus"></i> <span>Add First Application</span>
        </button>
      </div>
    `;
  }

  function getStatusBadgeStyle(status) {
    switch (status) {
      case 'Approved':
      case 'Completed':
        return { bg: 'rgba(16, 185, 129, 0.15)', text: '#10b981', border: 'rgba(16, 185, 129, 0.3)' };
      case 'Under Verification':
      case 'Submitted':
        return { bg: 'rgba(99, 102, 241, 0.15)', text: '#6366f1', border: 'rgba(99, 102, 241, 0.3)' };
      case 'Additional Documents Requested':
      case 'Draft':
        return { bg: 'rgba(245, 158, 11, 0.15)', text: '#d97706', border: 'rgba(245, 158, 11, 0.3)' };
      case 'Rejected':
        return { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444', border: 'rgba(239, 68, 68, 0.3)' };
      default:
        return { bg: 'rgba(13, 148, 136, 0.15)', text: 'var(--primary)', border: 'rgba(13, 148, 136, 0.3)' };
    }
  }

  function renderApplicationsList() {
    const container = document.getElementById('applications-list-container');
    const countElem = document.getElementById('app-tracker-count');

    let filtered = trackedApplications;
    if (currentFilterStatus !== 'all') {
      filtered = filtered.filter(a => a.status === currentFilterStatus);
    }
    if (currentSearchQuery) {
      filtered = filtered.filter(a => 
        a.scheme_name.toLowerCase().includes(currentSearchQuery) ||
        a.application_ref_no.toLowerCase().includes(currentSearchQuery) ||
        (a.department_name && a.department_name.toLowerCase().includes(currentSearchQuery))
      );
    }

    if (countElem) countElem.textContent = filtered.length;

    if (!container) return;

    if (filtered.length === 0) {
      renderEmptyState("No applications match your selected status or search query.");
      return;
    }

    container.innerHTML = filtered.map(app => {
      const badgeStyle = getStatusBadgeStyle(app.status);

      return `
        <div class="app-tracker-card" style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 20px; padding: 1.75rem; margin-bottom: 1.5rem; box-shadow: 0 8px 25px rgba(0,0,0,0.04);">
          
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; margin-bottom: 0.75rem; flex-wrap: wrap;">
            <div>
              <span style="font-size: 0.68rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; padding: 0.25rem 0.65rem; border-radius: 999px; background: ${badgeStyle.bg}; color: ${badgeStyle.text}; border: 1px solid ${badgeStyle.border}; display: inline-block; margin-bottom: 0.35rem;">
                ${app.status}
              </span>
              <h3 style="font-size: 1.3rem; font-weight: 800; color: var(--text-main); margin: 0; line-height: 1.3;">${app.scheme_name}</h3>
            </div>

            <div style="font-size: 0.82rem; font-weight: 800; color: var(--text-main); background: var(--bg-app); border: 1px solid var(--border-color); padding: 0.4rem 0.85rem; border-radius: 10px; font-family: monospace;">
              Ref: ${app.application_ref_no}
            </div>
          </div>

          <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0 0 1rem 0;">
            <i class="fa-solid fa-building-columns" style="color: var(--primary);"></i> ${app.department_name || 'Government Department'}
          </p>

          <div style="background: var(--bg-app); border: 1px solid var(--border-color); border-radius: 12px; padding: 1rem; margin-bottom: 1.25rem;">
            <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.4rem;">
              <span><strong>Submitted:</strong> ${app.submission_date || 'Recent'}</span>
              <span><strong>Last Updated:</strong> ${new Date(app.updated_at || app.created_at || Date.now()).toLocaleDateString('en-IN')}</span>
            </div>
            ${app.notes ? `<div style="font-size: 0.88rem; color: var(--text-main); line-height: 1.5; font-weight: 600;">${app.notes}</div>` : ''}
          </div>

          <!-- Actions & Manual Status Update -->
          <div style="display: flex; align-items: center; justify-content: space-between; border-top: 1px dashed var(--border-color); padding-top: 1.25rem; flex-wrap: wrap; gap: 1rem;">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span style="font-size: 0.78rem; font-weight: 700; color: var(--text-muted);">Update Status:</span>
              <select class="select-update-status" data-id="${app.id}" style="padding: 0.35rem 0.65rem; font-size: 0.78rem; font-weight: 700; border-radius: 8px; background: var(--bg-surface); border: 1px solid var(--border-color); color: var(--text-main);">
                <option value="Draft" ${app.status === 'Draft' ? 'selected' : ''}>Draft</option>
                <option value="Submitted" ${app.status === 'Submitted' ? 'selected' : ''}>Submitted</option>
                <option value="Under Verification" ${app.status === 'Under Verification' ? 'selected' : ''}>Under Verification</option>
                <option value="Additional Documents Requested" ${app.status === 'Additional Documents Requested' ? 'selected' : ''}>Additional Documents Requested</option>
                <option value="Approved" ${app.status === 'Approved' ? 'selected' : ''}>Approved</option>
                <option value="Rejected" ${app.status === 'Rejected' ? 'selected' : ''}>Rejected</option>
                <option value="Completed" ${app.status === 'Completed' ? 'selected' : ''}>Completed</option>
              </select>
            </div>

            <div style="display: flex; gap: 0.75rem;">
              <button type="button" class="btn-delete-app" data-id="${app.id}" title="Delete Record" style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); color: #ef4444; width: 36px; height: 36px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                <i class="fa-solid fa-trash-can"></i>
              </button>

              <a href="${app.official_portal_url || '#'}" target="_blank" rel="noopener noreferrer" class="btn btn-primary" style="padding: 0.55rem 1.2rem; font-size: 0.82rem; font-weight: 800; border-radius: 10px; text-decoration: none; display: inline-flex; align-items: center; gap: 0.4rem;">
                <span>Official Portal</span> <i class="fa-solid fa-arrow-up-right-from-square"></i>
              </a>
            </div>
          </div>

        </div>
      `;
    }).join('');

    // Attach Status Select Listeners
    container.querySelectorAll('.select-update-status').forEach(sel => {
      sel.addEventListener('change', async () => {
        const appId = sel.dataset.id;
        const newStatus = sel.value;
        await updateApplicationStatus(appId, newStatus);
      });
    });

    // Attach Delete Listeners
    container.querySelectorAll('.btn-delete-app').forEach(btn => {
      btn.addEventListener('click', async () => {
        const appId = btn.dataset.id;
        await deleteApplication(appId);
      });
    });
  }

  async function addApplicationRecord(newApp) {
    try {
      if (typeof window.getOrInitSupabaseClient === 'function') {
        const client = await window.getOrInitSupabaseClient();
        if (client) {
          const session = await client.auth.getSession();
          const userId = session?.data?.session?.user?.id;

          if (userId) {
            const payload = { user_id: userId, ...newApp };
            const { data, error } = await client.from('user_scheme_applications').insert(payload).select();
            if (!error && data) {
              if (window.showToast) window.showToast("Application record saved to your tracker!", "success");
              fetchTrackedApplications();
              return;
            }
          }
        }
      }
    } catch (e) {}

    newApp.id = 'local_' + Date.now();
    trackedApplications.unshift(newApp);
    localStorage.setItem('cc_user_tracked_apps', JSON.stringify(trackedApplications));
    if (window.showToast) window.showToast("Application saved locally to tracker!", "success");
    renderApplicationsList();
  }

  async function updateApplicationStatus(appId, newStatus) {
    try {
      if (typeof window.getOrInitSupabaseClient === 'function') {
        const client = await window.getOrInitSupabaseClient();
        if (client) {
          await client.from('user_scheme_applications').update({ status: newStatus, updated_at: new executionTimestamp() }).eq('id', appId);
        }
      }
    } catch (e) {}

    const target = trackedApplications.find(a => a.id === appId);
    if (target) {
      target.status = newStatus;
      target.updated_at = new Date().toISOString();
      localStorage.setItem('cc_user_tracked_apps', JSON.stringify(trackedApplications));
      if (window.showToast) window.showToast(`Status updated to '${newStatus}'`, "info");
      renderApplicationsList();
    }
  }

  function executionTimestamp() { return new Date().toISOString(); }

  async function deleteApplication(appId) {
    try {
      if (typeof window.getOrInitSupabaseClient === 'function') {
        const client = await window.getOrInitSupabaseClient();
        if (client) {
          await client.from('user_scheme_applications').delete().eq('id', appId);
        }
      }
    } catch (e) {}

    trackedApplications = trackedApplications.filter(a => a.id !== appId);
    localStorage.setItem('cc_user_tracked_apps', JSON.stringify(trackedApplications));
    if (window.showToast) window.showToast("Application record deleted.", "info");
    renderApplicationsList();
  }

  document.addEventListener('DOMContentLoaded', () => {
    fetchTrackedApplications();

    // Add Application Modal Handlers
    const modal = document.getElementById('add-app-modal');
    const openModalBtn = document.getElementById('btn-open-add-app-modal');
    const closeModalBtn = document.getElementById('btn-close-add-app-modal');
    const saveAppBtn = document.getElementById('btn-save-new-app');

    if (openModalBtn && modal) openModalBtn.addEventListener('click', () => modal.style.display = 'flex');
    if (closeModalBtn && modal) closeModalBtn.addEventListener('click', () => modal.style.display = 'none');

    if (saveAppBtn) {
      saveAppBtn.addEventListener('click', () => {
        const schemeName = document.getElementById('new-app-scheme-name')?.value;
        const refNo = document.getElementById('new-app-ref-no')?.value;
        const dept = document.getElementById('new-app-dept')?.value;
        const subDate = document.getElementById('new-app-date')?.value || new Date().toISOString().split('T')[0];
        const status = document.getElementById('new-app-status')?.value || 'Submitted';
        const portal = document.getElementById('new-app-portal')?.value;
        const notes = document.getElementById('new-app-notes')?.value;

        if (!schemeName || !refNo) {
          if (window.showToast) window.showToast("Please enter Scheme Name and Application Reference Number.", "error");
          return;
        }

        addApplicationRecord({
          scheme_name: schemeName,
          application_ref_no: refNo,
          department_name: dept || 'Government Department',
          submission_date: subDate,
          status: status,
          official_portal_url: portal || 'https://tn.gov.in/',
          notes: notes
        });

        if (modal) modal.style.display = 'none';
      });
    }

    // Search & Filter Listeners
    const searchInput = document.getElementById('input-app-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        currentSearchQuery = e.target.value.toLowerCase().trim();
        renderApplicationsList();
      });
    }

    const statusFilter = document.getElementById('select-filter-status');
    if (statusFilter) {
      statusFilter.addEventListener('change', (e) => {
        currentFilterStatus = e.target.value;
        renderApplicationsList();
      });
    }
  });

})();
