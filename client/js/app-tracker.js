// CrowdCity AI v2.0 - Government Application Tracker JavaScript
// Manages personal application tracking records, milestone status updates, 
// secure backend API syncing, user-isolated caching, and official portal links.

(function() {
  'use strict';

  let trackedApplications = [];
  let currentFilterStatus = 'all';
  let currentSearchQuery = '';
  let activeUserId = null;
  let activeAuthToken = null;

  // Curated official government portal mappings
  const KNOWN_SCHEME_PORTALS = {
    'kalaignar magalir urimai': 'https://kmut.tn.gov.in/',
    'kmut': 'https://kmut.tn.gov.in/',
    'pudhumai penn': 'https://penkalvi.tn.gov.in/',
    'pen kalvi': 'https://penkalvi.tn.gov.in/',
    'naan mudhalvan': 'https://www.naanmudhalvan.tn.gov.in/',
    'cmchis': 'https://cmchistn.com/',
    'chief minister comprehensive health insurance': 'https://cmchistn.com/',
    'pm kisan': 'https://pmkisan.gov.in/',
    'pm-kisan': 'https://pmkisan.gov.in/',
    'ayushman bharat': 'https://pmjay.gov.in/',
    'pm-jay': 'https://pmjay.gov.in/',
    'pmjay': 'https://pmjay.gov.in/',
    'mudra': 'https://www.mudra.org.in/',
    'pmmy': 'https://www.mudra.org.in/',
    'sukanya samriddhi': 'https://www.indiapost.gov.in/',
    'pmay': 'https://pmaymis.gov.in/',
    'pradhan mantri awas': 'https://pmaymis.gov.in/',
    'vidyalakshmi': 'https://www.vidyalakshmi.co.in/',
    'kalaignar kanavu illam': 'https://tnrd.tn.gov.in/',
    'uzhavar pathukappu': 'https://agritech.tnau.ac.in/'
  };

  function resolvePortalUrl(schemeName, customUrl) {
    if (customUrl && typeof customUrl === 'string' && customUrl.trim().startsWith('http')) {
      return customUrl.trim();
    }
    if (schemeName && typeof schemeName === 'string') {
      const lower = schemeName.toLowerCase();
      for (const [k, v] of Object.entries(KNOWN_SCHEME_PORTALS)) {
        if (lower.includes(k)) return v;
      }
    }
    return 'https://tn.gov.in/';
  }

  // ---------------------------------------------------------------------------
  // 1. AUTHENTICATION & USER RESOLUTION
  // ---------------------------------------------------------------------------
  async function resolveActiveUser() {
    activeUserId = null;
    activeAuthToken = null;

    // A. Check window.getCurrentUser from auth.js
    try {
      if (typeof window.getCurrentUser === 'function') {
        const u = window.getCurrentUser();
        if (u?.id) activeUserId = u.id;
      }
    } catch (e) {}

    // B. Check Supabase session token in localStorage
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('sb-') && k.endsWith('-auth-token')) {
          const val = localStorage.getItem(k);
          if (val) {
            const parsed = JSON.parse(val);
            if (parsed?.user?.id) {
              activeUserId = parsed.user.id;
            }
            if (parsed?.access_token) {
              activeAuthToken = parsed.access_token;
            }
          }
        }
      }
    } catch (e) {}

    // C. Check Supabase client session if available
    try {
      if (typeof window.getOrInitSupabaseClient === 'function') {
        const client = await window.getOrInitSupabaseClient();
        if (client) {
          const session = await client.auth.getSession();
          if (session?.data?.session?.user?.id) {
            activeUserId = session.data.session.user.id;
          }
          if (session?.data?.session?.access_token) {
            activeAuthToken = session.data.session.access_token;
          }
        }
      }
    } catch (e) {}

    return { userId: activeUserId, token: activeAuthToken };
  }

  function getUserCacheKey() {
    return activeUserId ? `cc_user_tracked_apps_${activeUserId}` : null;
  }

  // ---------------------------------------------------------------------------
  // 2. FETCH TRACKED APPLICATIONS (API FIRST -> SUPABASE -> USER CACHE)
  // ---------------------------------------------------------------------------
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

    await resolveActiveUser();

    if (!activeUserId) {
      trackedApplications = [];
      updateCounterDisplay(0);
      renderUnauthenticatedState();
      return;
    }

    // 1. Try Backend API (/api/applications)
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (activeAuthToken) {
        headers['Authorization'] = `Bearer ${activeAuthToken}`;
      }

      const res = await fetch('/api/applications', { headers });
      if (res.ok) {
        const json = await res.json();
        if (json && Array.isArray(json.applications)) {
          trackedApplications = json.applications;
          saveUserCache(trackedApplications);
          renderApplicationsList();
          return;
        }
      }
    } catch (apiErr) {
      // Backend API not reachable or network error, fallback to Supabase
    }

    // 2. Try Supabase directly with Row Level Security
    try {
      if (typeof window.getOrInitSupabaseClient === 'function') {
        const client = await window.getOrInitSupabaseClient();
        if (client) {
          const { data, error } = await client
            .from('user_scheme_applications')
            .select('*')
            .eq('user_id', activeUserId)
            .order('created_at', { ascending: false });

          if (!error && Array.isArray(data)) {
            trackedApplications = data;
            saveUserCache(trackedApplications);
            renderApplicationsList();
            return;
          }
        }
      }
    } catch (sbErr) {
      console.warn('[AppTracker] Supabase direct query notice:', sbErr.message || sbErr);
    }

    // 3. User-Scoped LocalStorage Cache
    const cacheKey = getUserCacheKey();
    if (cacheKey) {
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            trackedApplications = parsed;
            renderApplicationsList();
            return;
          }
        }
      } catch (e) {}
    }

    // 4. Default: Genuine empty list for new or zero-application users
    trackedApplications = [];
    saveUserCache([]);
    renderApplicationsList();
  }

  function saveUserCache(apps) {
    const key = getUserCacheKey();
    if (key) {
      try {
        localStorage.setItem(key, JSON.stringify(apps));
      } catch (e) {}
    }
  }

  // ---------------------------------------------------------------------------
  // 3. UI RENDERING & COUNTER UPDATE
  // ---------------------------------------------------------------------------
  function updateCounterDisplay(count) {
    const countElem = document.getElementById('app-tracker-count');
    const labelElem = document.getElementById('app-tracker-count-label');
    if (countElem) countElem.textContent = count;
    if (labelElem) {
      labelElem.textContent = count === 1 ? 'Tracked Application' : 'Tracked Applications';
    }
  }

  function renderUnauthenticatedState() {
    const container = document.getElementById('applications-list-container');
    updateCounterDisplay(0);

    if (!container) return;

    container.innerHTML = `
      <div style="text-align: center; padding: 4rem 1.5rem; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 20px;">
        <i class="fa-solid fa-lock" style="font-size: 2.8rem; color: var(--text-muted); margin-bottom: 1rem;"></i>
        <h3 style="font-size: 1.2rem; font-weight: 800; color: var(--text-main); margin: 0 0 0.5rem 0;">Sign In Required</h3>
        <p style="font-size: 0.9rem; color: var(--text-muted); max-width: 480px; margin: 0 auto 1.5rem auto; line-height: 1.5;">
          Please sign in to organize and track your personal government welfare applications securely.
        </p>
        <a href="auth.html" class="btn btn-primary" style="padding: 0.75rem 1.5rem; font-weight: 700; border-radius: 12px; display: inline-flex; align-items: center; gap: 0.5rem; text-decoration: none;">
          <i class="fa-solid fa-right-to-bracket"></i> <span>Sign In to Continue</span>
        </a>
      </div>
    `;
  }

  function renderEmptyState(message) {
    const container = document.getElementById('applications-list-container');
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

    let filtered = trackedApplications;
    if (currentFilterStatus !== 'all') {
      filtered = filtered.filter(a => a.status === currentFilterStatus);
    }
    if (currentSearchQuery) {
      filtered = filtered.filter(a => 
        (a.scheme_name && a.scheme_name.toLowerCase().includes(currentSearchQuery)) ||
        (a.application_ref_no && a.application_ref_no.toLowerCase().includes(currentSearchQuery)) ||
        (a.department_name && a.department_name.toLowerCase().includes(currentSearchQuery)) ||
        (a.notes && a.notes.toLowerCase().includes(currentSearchQuery))
      );
    }

    updateCounterDisplay(trackedApplications.length);

    if (!container) return;

    if (filtered.length === 0) {
      if (trackedApplications.length === 0) {
        renderEmptyState("You haven't added any government applications to track yet. Click below to add your first application.");
      } else {
        renderEmptyState("No applications match your selected status filter or search query.");
      }
      return;
    }

    container.innerHTML = filtered.map(app => {
      const badgeStyle = getStatusBadgeStyle(app.status);
      const portalUrl = resolvePortalUrl(app.scheme_name, app.official_portal_url);

      return `
        <div class="app-tracker-card" data-card-id="${app.id}" style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 20px; padding: 1.75rem; margin-bottom: 1.5rem; box-shadow: 0 8px 25px rgba(0,0,0,0.04);">
          
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
            <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.4rem; flex-wrap: wrap; gap: 0.5rem;">
              <span><strong>Submitted:</strong> ${app.submission_date || 'Recent'}</span>
              <span><strong>Last Updated:</strong> ${new Date(app.updated_at || app.created_at || Date.now()).toLocaleDateString('en-IN')}</span>
            </div>
            ${app.notes ? `<div style="font-size: 0.88rem; color: var(--text-main); line-height: 1.5; font-weight: 600;">${app.notes}</div>` : ''}
          </div>

          <!-- Actions & Controls -->
          <div style="display: flex; align-items: center; justify-content: space-between; border-top: 1px dashed var(--border-color); padding-top: 1.25rem; flex-wrap: wrap; gap: 1rem;">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span style="font-size: 0.78rem; font-weight: 700; color: var(--text-muted);">Quick Status:</span>
              <select class="select-update-status" data-id="${app.id}" style="padding: 0.35rem 0.65rem; font-size: 0.78rem; font-weight: 700; border-radius: 8px; background: var(--bg-surface); border: 1px solid var(--border-color); color: var(--text-main);">
                <option value="Submitted" ${app.status === 'Submitted' ? 'selected' : ''}>Submitted</option>
                <option value="Under Verification" ${app.status === 'Under Verification' ? 'selected' : ''}>Under Verification</option>
                <option value="Additional Documents Requested" ${app.status === 'Additional Documents Requested' ? 'selected' : ''}>Additional Documents Requested</option>
                <option value="Approved" ${app.status === 'Approved' ? 'selected' : ''}>Approved</option>
                <option value="Rejected" ${app.status === 'Rejected' ? 'selected' : ''}>Rejected</option>
                <option value="Completed" ${app.status === 'Completed' ? 'selected' : ''}>Completed</option>
                <option value="Draft" ${app.status === 'Draft' ? 'selected' : ''}>Draft</option>
              </select>
            </div>

            <div style="display: flex; gap: 0.65rem; align-items: center;">
              <!-- Edit Button -->
              <button type="button" class="btn-edit-app" data-id="${app.id}" title="Edit Application Details" style="background: rgba(13, 148, 136, 0.1); border: 1px solid rgba(13, 148, 136, 0.25); color: var(--primary); padding: 0.5rem 0.85rem; border-radius: 8px; cursor: pointer; display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.8rem; font-weight: 700;">
                <i class="fa-solid fa-pen-to-square"></i> <span>Edit</span>
              </button>

              <!-- Delete Button -->
              <button type="button" class="btn-delete-app" data-id="${app.id}" title="Delete Record" style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); color: #ef4444; width: 36px; height: 36px; border-radius: 8px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center;">
                <i class="fa-solid fa-trash-can"></i>
              </button>

              <!-- Official Portal Link -->
              <a href="${portalUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-primary" style="padding: 0.55rem 1.2rem; font-size: 0.82rem; font-weight: 800; border-radius: 10px; text-decoration: none; display: inline-flex; align-items: center; gap: 0.4rem;">
                <span>Official Portal</span> <i class="fa-solid fa-arrow-up-right-from-square"></i>
              </a>
            </div>
          </div>

        </div>
      `;
    }).join('');

    attachCardListeners(container);
  }

  function attachCardListeners(container) {
    // Quick Status Select Listeners
    container.querySelectorAll('.select-update-status').forEach(sel => {
      sel.addEventListener('change', async () => {
        const appId = sel.dataset.id;
        const newStatus = sel.value;
        await updateApplicationStatus(appId, { status: newStatus });
      });
    });

    // Edit Listeners
    container.querySelectorAll('.btn-edit-app').forEach(btn => {
      btn.addEventListener('click', () => {
        const appId = btn.dataset.id;
        openEditModal(appId);
      });
    });

    // Delete Listeners
    container.querySelectorAll('.btn-delete-app').forEach(btn => {
      btn.addEventListener('click', async () => {
        const appId = btn.dataset.id;
        if (confirm("Are you sure you want to delete this tracked application?")) {
          await deleteApplication(appId);
        }
      });
    });
  }

  // ---------------------------------------------------------------------------
  // 4. CRUD OPERATIONS (API & SUPABASE SYNC WITH FALLBACK)
  // ---------------------------------------------------------------------------
  async function addApplicationRecord(newApp) {
    await resolveActiveUser();

    // 1. Try Backend API
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (activeAuthToken) {
        headers['Authorization'] = `Bearer ${activeAuthToken}`;
      }

      const res = await fetch('/api/applications', {
        method: 'POST',
        headers,
        body: JSON.stringify(newApp)
      });

      if (res.ok) {
        const json = await res.json();
        if (json?.application) {
          trackedApplications.unshift(json.application);
          saveUserCache(trackedApplications);
          if (window.showToast) window.showToast("Application record saved to your tracker!", "success");
          renderApplicationsList();
          return;
        }
      }
    } catch (apiErr) {
      // Fallback to Supabase client
    }

    // 2. Try Supabase Client
    try {
      if (typeof window.getOrInitSupabaseClient === 'function' && activeUserId) {
        const client = await window.getOrInitSupabaseClient();
        if (client) {
          const payload = { user_id: activeUserId, ...newApp };
          const { data, error } = await client.from('user_scheme_applications').insert(payload).select().single();
          if (!error && data) {
            trackedApplications.unshift(data);
            saveUserCache(trackedApplications);
            if (window.showToast) window.showToast("Application record saved to your tracker!", "success");
            renderApplicationsList();
            return;
          }
        }
      }
    } catch (sbErr) {}

    // 3. Fallback to User-Scoped Local Storage Cache
    newApp.id = 'local_' + Date.now();
    newApp.created_at = new Date().toISOString();
    newApp.updated_at = new Date().toISOString();
    trackedApplications.unshift(newApp);
    saveUserCache(trackedApplications);
    if (window.showToast) window.showToast("Application saved to your tracker!", "success");
    renderApplicationsList();
  }

  async function updateApplicationStatus(appId, updates) {
    await resolveActiveUser();

    // 1. Try Backend API
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (activeAuthToken) {
        headers['Authorization'] = `Bearer ${activeAuthToken}`;
      }

      const res = await fetch(`/api/applications/${appId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(updates)
      });

      if (res.ok) {
        const json = await res.json();
        if (json?.application) {
          const idx = trackedApplications.findIndex(a => a.id === appId);
          if (idx !== -1) {
            trackedApplications[idx] = json.application;
          }
          saveUserCache(trackedApplications);
          if (window.showToast) window.showToast("Application updated successfully!", "info");
          renderApplicationsList();
          return;
        }
      }
    } catch (apiErr) {}

    // 2. Try Supabase Client
    try {
      if (typeof window.getOrInitSupabaseClient === 'function' && activeUserId) {
        const client = await window.getOrInitSupabaseClient();
        if (client) {
          await client.from('user_scheme_applications')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', appId)
            .eq('user_id', activeUserId);
        }
      }
    } catch (sbErr) {}

    // 3. Local update in-memory
    const target = trackedApplications.find(a => a.id === appId);
    if (target) {
      Object.assign(target, updates);
      target.updated_at = new Date().toISOString();
      saveUserCache(trackedApplications);
      if (window.showToast) window.showToast("Application updated!", "info");
      renderApplicationsList();
    }
  }

  async function deleteApplication(appId) {
    await resolveActiveUser();

    // 1. Try Backend API
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (activeAuthToken) {
        headers['Authorization'] = `Bearer ${activeAuthToken}`;
      }

      const res = await fetch(`/api/applications/${appId}`, {
        method: 'DELETE',
        headers
      });

      if (res.ok) {
        trackedApplications = trackedApplications.filter(a => a.id !== appId);
        saveUserCache(trackedApplications);
        if (window.showToast) window.showToast("Application record deleted.", "info");
        renderApplicationsList();
        return;
      }
    } catch (apiErr) {}

    // 2. Try Supabase Client
    try {
      if (typeof window.getOrInitSupabaseClient === 'function' && activeUserId) {
        const client = await window.getOrInitSupabaseClient();
        if (client) {
          await client.from('user_scheme_applications')
            .delete()
            .eq('id', appId)
            .eq('user_id', activeUserId);
        }
      }
    } catch (sbErr) {}

    // 3. Local removal
    trackedApplications = trackedApplications.filter(a => a.id !== appId);
    saveUserCache(trackedApplications);
    if (window.showToast) window.showToast("Application record deleted.", "info");
    renderApplicationsList();
  }

  // ---------------------------------------------------------------------------
  // 5. MODAL WORKFLOWS (ADD & EDIT)
  // ---------------------------------------------------------------------------
  function openEditModal(appId) {
    const app = trackedApplications.find(a => a.id === appId);
    if (!app) return;

    const modal = document.getElementById('edit-app-modal');
    if (!modal) return;

    document.getElementById('edit-app-id').value = app.id;
    document.getElementById('edit-app-scheme-name').value = app.scheme_name || '';
    document.getElementById('edit-app-ref-no').value = app.application_ref_no || '';
    document.getElementById('edit-app-dept').value = app.department_name || '';
    document.getElementById('edit-app-date').value = app.submission_date || '';
    document.getElementById('edit-app-status').value = app.status || 'Submitted';
    document.getElementById('edit-app-portal').value = app.official_portal_url || '';
    document.getElementById('edit-app-notes').value = app.notes || '';

    modal.style.display = 'flex';
  }

  function initModalListeners() {
    // Add Application Modal
    const addModal = document.getElementById('add-app-modal');
    const openAddBtn = document.getElementById('btn-open-add-app-modal');
    const closeAddBtn = document.getElementById('btn-close-add-app-modal');
    const saveNewBtn = document.getElementById('btn-save-new-app');

    if (openAddBtn && addModal) openAddBtn.addEventListener('click', () => addModal.style.display = 'flex');
    if (closeAddBtn && addModal) closeAddBtn.addEventListener('click', () => addModal.style.display = 'none');

    if (saveNewBtn) {
      saveNewBtn.addEventListener('click', async () => {
        const schemeName = (document.getElementById('new-app-scheme-name')?.value || '').trim();
        const refNo = (document.getElementById('new-app-ref-no')?.value || '').trim();
        const dept = (document.getElementById('new-app-dept')?.value || '').trim();
        const subDate = document.getElementById('new-app-date')?.value || new Date().toISOString().split('T')[0];
        const status = document.getElementById('new-app-status')?.value || 'Submitted';
        const portal = (document.getElementById('new-app-portal')?.value || '').trim();
        const notes = (document.getElementById('new-app-notes')?.value || '').trim();

        if (!schemeName || !refNo) {
          if (window.showToast) window.showToast("Please enter Scheme Name and Application Reference Number.", "error");
          return;
        }

        await addApplicationRecord({
          scheme_name: schemeName,
          application_ref_no: refNo,
          department_name: dept || 'Government Department',
          submission_date: subDate,
          status: status,
          official_portal_url: portal || resolvePortalUrl(schemeName),
          notes: notes || null
        });

        // Reset inputs and close
        if (document.getElementById('new-app-scheme-name')) document.getElementById('new-app-scheme-name').value = '';
        if (document.getElementById('new-app-ref-no')) document.getElementById('new-app-ref-no').value = '';
        if (document.getElementById('new-app-dept')) document.getElementById('new-app-dept').value = '';
        if (document.getElementById('new-app-portal')) document.getElementById('new-app-portal').value = '';
        if (document.getElementById('new-app-notes')) document.getElementById('new-app-notes').value = '';
        if (addModal) addModal.style.display = 'none';
      });
    }

    // Edit Application Modal
    const editModal = document.getElementById('edit-app-modal');
    const closeEditBtn = document.getElementById('btn-close-edit-app-modal');
    const saveEditBtn = document.getElementById('btn-save-edit-app');

    if (closeEditBtn && editModal) closeEditBtn.addEventListener('click', () => editModal.style.display = 'none');

    if (saveEditBtn) {
      saveEditBtn.addEventListener('click', async () => {
        const appId = document.getElementById('edit-app-id')?.value;
        const schemeName = (document.getElementById('edit-app-scheme-name')?.value || '').trim();
        const refNo = (document.getElementById('edit-app-ref-no')?.value || '').trim();
        const dept = (document.getElementById('edit-app-dept')?.value || '').trim();
        const subDate = document.getElementById('edit-app-date')?.value;
        const status = document.getElementById('edit-app-status')?.value || 'Submitted';
        const portal = (document.getElementById('edit-app-portal')?.value || '').trim();
        const notes = (document.getElementById('edit-app-notes')?.value || '').trim();

        if (!schemeName || !refNo) {
          if (window.showToast) window.showToast("Please enter Scheme Name and Application Reference Number.", "error");
          return;
        }

        const updates = {
          scheme_name: schemeName,
          application_ref_no: refNo,
          department_name: dept || 'Government Department',
          submission_date: subDate || new Date().toISOString().split('T')[0],
          status: status,
          official_portal_url: portal || resolvePortalUrl(schemeName),
          notes: notes || null
        };

        await updateApplicationStatus(appId, updates);
        if (editModal) editModal.style.display = 'none';
      });
    }
  }

  // ---------------------------------------------------------------------------
  // 6. INITIALIZATION & MODULE EXPORT
  // ---------------------------------------------------------------------------
  function initAppTracker() {
    fetchTrackedApplications();
    initModalListeners();

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

    // Handle logout or auth change: reset state
    window.addEventListener('storage', (e) => {
      if (e.key && e.key.includes('auth-token') && !e.newValue) {
        trackedApplications = [];
        updateCounterDisplay(0);
        renderUnauthenticatedState();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAppTracker);
  } else {
    initAppTracker();
  }

  // Export module globally for testing & headless verification
  window.CrowdCityAppTracker = {
    getApplications: () => [...trackedApplications],
    setApplications: (arr) => { trackedApplications = [...arr]; renderApplicationsList(); },
    addApplication: addApplicationRecord,
    updateApplication: updateApplicationStatus,
    deleteApplication: deleteApplication,
    fetchApplications: fetchTrackedApplications,
    resolvePortal: resolvePortalUrl,
    init: initAppTracker
  };

})();
