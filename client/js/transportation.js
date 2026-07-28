/**
 * CrowdCity AI v3.2 - Smart Transportation Module Frontend Controller
 */

(function () {
  'use strict';

  let transportMap = null;
  let transportMarkers = [];
  let currentReports = [];
  let userLat = 11.0168;
  let userLng = 76.9558;

  // Category to Color & Icon Mapper
  const categoryConfig = {
    'Potholes': { color: '#e11d48', icon: 'fa-triangle-exclamation' },
    'Damaged Roads': { color: '#e11d48', icon: 'fa-road' },
    'Traffic Signal Not Working': { color: '#c2410c', icon: 'fa-traffic-light' },
    'Waterlogging': { color: '#0284c7', icon: 'fa-water' },
    'Broken Street Lights': { color: '#7c3aed', icon: 'fa-lightbulb' },
    'Illegal Parking': { color: '#059669', icon: 'fa-square-parking' },
    'Missing Road Signs': { color: '#d97706', icon: 'fa-diamond-turn-right' },
    'Bus Stop Issues': { color: '#2563eb', icon: 'fa-bus' },
    'Road Block': { color: '#dc2626', icon: 'fa-ban' },
    'Construction Work': { color: '#d97706', icon: 'fa-person-digging' },
    'Accident': { color: '#991b1b', icon: 'fa-car-burst' },
    'Heavy Traffic': { color: '#ea580c', icon: 'fa-car-side' },
    'Other Transportation Issue': { color: '#64748b', icon: 'fa-circle-info' }
  };

  // Status Badge Class Helper
  function getStatusBadge(status) {
    const s = (status || '').toUpperCase();
    if (s === 'IN_PROGRESS' || s === 'IN PROGRESS') {
      return '<span class="status-badge-sm badge-progress">In Progress</span>';
    }
    if (s === 'RESOLVED' || s === 'CLOSED') {
      return '<span class="status-badge-sm badge-resolved">Resolved</span>';
    }
    if (s === 'ASSIGNED') {
      return '<span class="status-badge-sm" style="background: #e0e7ff; color: #3730a3; font-weight: 700;">Assigned</span>';
    }
    return '<span class="status-badge-sm badge-pending">Submitted</span>';
  }

  // Priority Pill Helper
  function getPriorityPill(priority) {
    const p = (priority || 'Medium').toLowerCase();
    return `<span class="priority-pill priority-${p}">${priority || 'Medium'}</span>`;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // 1. Initialize Transportation Leaflet Map
  function initTransportMap() {
    const mapContainer = document.getElementById('transportation-map');
    if (!mapContainer || typeof L === 'undefined') return;

    if (!transportMap) {
      transportMap = L.map('transportation-map').setView([userLat, userLng], 13);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(transportMap);

      setTimeout(() => {
        if (transportMap) transportMap.invalidateSize();
      }, 200);
    }
  }

  // 2. Render Map Markers
  function renderMapMarkers(reports) {
    if (!transportMap || typeof L === 'undefined') return;

    // Clear existing markers
    transportMarkers.forEach(m => transportMap.removeLayer(m));
    transportMarkers = [];

    reports.forEach(report => {
      const lat = parseFloat(report.latitude) || 11.0168;
      const lng = parseFloat(report.longitude) || 76.9558;
      const conf = categoryConfig[report.category] || { color: '#0d9488', icon: 'fa-road' };

      const customIcon = L.divIcon({
        className: 'custom-transport-pin',
        html: `
          <div style="background-color: ${conf.color}; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; box-shadow: 0 4px 10px rgba(0,0,0,0.3); border: 2px solid white;">
            <i class="fa-solid ${conf.icon}" style="font-size: 0.85rem;"></i>
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 34],
        popupAnchor: [0, -34]
      });

      const marker = L.marker([lat, lng], { icon: customIcon }).addTo(transportMap);
      
      const popupHtml = `
        <div style="font-family: var(--font-body, sans-serif); min-width: 200px;">
          <div style="font-size: 0.72rem; font-weight: 800; color: ${conf.color}; text-transform: uppercase;">${escapeHtml(report.category)}</div>
          <h4 style="margin: 0.2rem 0; font-size: 0.9rem; font-weight: 800; font-family: var(--font-heading, sans-serif);">${escapeHtml(report.title)}</h4>
          <div style="font-size: 0.78rem; color: var(--text-muted, #64748b); margin-bottom: 0.5rem;">${escapeHtml(report.address)}</div>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            ${getPriorityPill(report.priority)}
            ${getStatusBadge(report.status)}
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml);
      transportMarkers.push(marker);
    });
  }

  // 3. Render Reports Feed / Grid
  function renderReportsFeed(reports) {
    const gridEl = document.getElementById('transport-reports-grid');
    if (!gridEl) return;

    if (!reports || reports.length === 0) {
      gridEl.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 3.5rem 2rem; text-align: center; background: var(--bg-surface, #ffffff); border: 1px solid var(--border-color, #e2e8f0); border-radius: var(--radius-lg, 16px); box-shadow: var(--shadow-sm);">
          <div style="width: 64px; height: 64px; border-radius: 50%; background: rgba(13, 148, 136, 0.1); color: var(--primary, #0d9488); display: flex; align-items: center; justify-content: center; font-size: 1.8rem; margin: 0 auto 1.25rem;">
            <i class="fa-solid fa-road"></i>
          </div>
          <h3 style="font-family: var(--font-heading); font-size: 1.25rem; font-weight: 800; margin: 0 0 0.4rem 0; color: var(--text-main, #0f172a);">
            No transportation issues have been reported yet.
          </h3>
          <p style="margin: 0 0 1.5rem 0; font-size: 0.9rem; color: var(--text-muted, #64748b); max-width: 480px; margin-left: auto; margin-right: auto;">
            Be the first to report a road hazard, traffic signal outage, waterlogging, or transit infrastructure issue in your area.
          </p>
          <a href="transportation-report.html" class="btn btn-primary" style="padding: 0.7rem 1.5rem; font-weight: 700; border-radius: 10px;">
            <i class="fa-solid fa-plus"></i> Report Transportation Issue
          </a>
        </div>
      `;
      return;
    }

    gridEl.innerHTML = reports.map(r => {
      const conf = categoryConfig[r.category] || { color: '#0d9488', icon: 'fa-road' };
      const photoHtml = (r.photo_urls && r.photo_urls.length > 0)
        ? `<div style="height: 140px; border-radius: 12px; overflow: hidden; margin-bottom: 0.85rem; background: #f8fafc;"><img src="${escapeHtml(r.photo_urls[0])}" alt="Issue Photo" style="width: 100%; height: 100%; object-fit: cover;" /></div>`
        : `<div style="height: 110px; border-radius: 12px; margin-bottom: 0.85rem; background: var(--bg-surface-hover, #f8fafc); border: 1px dashed var(--border-color, #cbd5e1); display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--text-muted); gap: 0.35rem;">
            <i class="fa-solid ${conf.icon}" style="font-size: 1.5rem; color: ${conf.color};"></i>
            <span style="font-size: 0.75rem; font-weight: 600;">Transportation Infrastructure Report</span>
           </div>`;

      return `
        <div class="transport-card">
          ${photoHtml}
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.4rem;">
            <span style="display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.72rem; font-weight: 800; color: ${conf.color}; background: #f8fafc; padding: 0.2rem 0.6rem; border-radius: 6px; border: 1px solid var(--border-color, #e2e8f0);">
              <i class="fa-solid ${conf.icon}"></i> ${escapeHtml(r.category)}
            </span>
            ${getPriorityPill(r.priority)}
          </div>

          <h3 style="font-family: var(--font-heading); font-size: 1rem; font-weight: 800; margin: 0 0 0.35rem 0; color: var(--text-main); line-height: 1.3;">
            ${escapeHtml(r.title)}
          </h3>

          <p style="font-size: 0.84rem; color: var(--text-muted); margin: 0 0 0.6rem 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.4;">
            ${escapeHtml(r.description)}
          </p>

          <div style="font-size: 0.78rem; color: var(--text-muted); display: flex; align-items: center; gap: 0.4rem; margin-bottom: 0.75rem;">
            <i class="fa-solid fa-location-dot" style="color: var(--primary, #0d9488);"></i>
            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(r.road_name || r.address || 'Coimbatore')}</span>
          </div>

          <div style="padding-top: 0.75rem; border-top: 1px solid var(--border-color, #e2e8f0); display: flex; justify-content: space-between; align-items: center;">
            <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted);">
              <i class="fa-solid fa-building-user"></i> ${escapeHtml(r.responsible_department || 'Roads Dept')}
            </div>
            ${getStatusBadge(r.status)}
          </div>
        </div>
      `;
    }).join('');
  }

  // 4. Update Stats Cards
  function updateStats(reports) {
    const totalEl = document.getElementById('stat-total-reports');
    const pendingEl = document.getElementById('stat-pending-cases');
    const resolvedEl = document.getElementById('stat-resolved-cases');

    if (totalEl) totalEl.textContent = reports.length;
    if (pendingEl) pendingEl.textContent = reports.filter(r => r.status !== 'Resolved' && r.status !== 'Closed').length;
    if (resolvedEl) resolvedEl.textContent = reports.filter(r => r.status === 'Resolved' || r.status === 'Closed').length;
  }

  // 5. Fetch Reports from Backend API
  async function loadReports() {
    try {
      const category = document.getElementById('filter-category')?.value || 'All';
      const priority = document.getElementById('filter-priority')?.value || 'All';
      const status = document.getElementById('filter-status')?.value || 'All';
      const search = document.getElementById('transport-search-input')?.value || '';

      const res = await window.API.getTransportationReports({ category, priority, status, search });
      const reports = (res && res.data && res.data.reports) ? res.data.reports : ((res && res.reports) ? res.reports : []);
      currentReports = reports;
      renderReportsFeed(currentReports);
      renderMapMarkers(currentReports);
      updateStats(currentReports);
    } catch (err) {
      console.error('Error loading transportation reports:', err);
    }
  }

  // 6. Real-Time AI Triage Debounce Handler
  let aiDebounceTimer = null;
  function handleAiPreviewInput() {
    clearTimeout(aiDebounceTimer);
    aiDebounceTimer = setTimeout(async () => {
      const title = document.getElementById('report-title')?.value || '';
      const desc = document.getElementById('report-description')?.value || '';
      const category = document.getElementById('report-category')?.value || '';
      const previewTextEl = document.getElementById('ai-preview-text');

      if (title.length > 5 && desc.length > 10 && previewTextEl) {
        previewTextEl.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Running AI Triage analysis...`;
        try {
          const res = await window.API.analyzeTransportationIssue({ title, description: desc, category });
          const a = (res && res.data && res.data.analysis) ? res.data.analysis : (res && res.analysis ? res.analysis : null);
          if (a) {
            previewTextEl.innerHTML = `
              <strong>Category:</strong> ${escapeHtml(a.category)} &bull; 
              <strong>Priority:</strong> <span class="priority-pill priority-${(a.priority || 'Medium').toLowerCase()}">${escapeHtml(a.priority)}</span> &bull; 
              <strong>Dept:</strong> ${escapeHtml(a.department)}<br/>
              <span style="font-size: 0.78rem; color: #166534; margin-top: 0.25rem; display: block;">Suggested Action: ${escapeHtml(a.suggested_resolution)} (Confidence: ${a.confidence_score}%)</span>
            `;
          }
        } catch (e) {
          previewTextEl.textContent = 'AI Triage active. Department will be assigned automatically upon submission.';
        }
      }
    }, 600);
  }

  // 7. Modal Controls
  window.openReportModal = function () {
    const modal = document.getElementById('report-transport-modal');
    if (modal) {
      modal.classList.add('active');
    }
  };

  window.closeReportModal = function () {
    const modal = document.getElementById('report-transport-modal');
    if (modal) {
      modal.classList.remove('active');
    }
  };

  window.getCurrentGpsLocation = function () {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          userLat = pos.coords.latitude;
          userLng = pos.coords.longitude;
          const addressInput = document.getElementById('report-address');
          if (addressInput) {
            addressInput.value = `Lat: ${userLat.toFixed(4)}, Lng: ${userLng.toFixed(4)} (Coimbatore District)`;
          }
          if (window.showToast) window.showToast('GPS Location captured successfully!', 'success');
        },
        () => {
          if (window.showToast) window.showToast('Using default city location.', 'info');
        }
      );
    }
  };

  // 8. Submit Form Handler
  window.handleTransportSubmit = async function (e) {
    e.preventDefault();

    const title = document.getElementById('report-title')?.value;
    const category = document.getElementById('report-category')?.value;
    const description = document.getElementById('report-description')?.value;
    const address = document.getElementById('report-address')?.value;
    const photoUrl = document.getElementById('report-photo-url')?.value;
    const submitBtn = document.getElementById('submit-transport-btn');

    if (!title || !description || !address) {
      if (window.showToast) window.showToast('Please fill in all required fields.', 'error');
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Processing AI Triage...`;
    }

    try {
      const user = typeof window.getCurrentUser === 'function' ? window.getCurrentUser() : null;
      const res = await window.API.createTransportationReport({
        title,
        category,
        description,
        address,
        latitude: userLat,
        longitude: userLng,
        photo_urls: photoUrl ? [photoUrl] : [],
        user_id: user ? user.id : 'anonymous'
      });

      const reportData = (res && res.data && res.data.report) ? res.data.report : (res && res.report ? res.report : null);
      if (reportData) {
        if (window.showToast) {
          window.showToast(`Report ${reportData.report_number || reportData.id} submitted! AI assigned to ${reportData.responsible_department}.`, 'success');
        }
        closeReportModal();
        document.getElementById('transport-report-form')?.reset();
        await loadReports();
      }
    } catch (err) {
      console.error('Error submitting transportation report:', err);
      if (window.showToast) window.showToast('Failed to submit report. Please try again.', 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Submit Report`;
      }
    }
  };

  // 9. Init Event Listeners
  document.addEventListener('DOMContentLoaded', () => {
    initTransportMap();
    loadReports();

    // Bind Filter Listeners
    document.getElementById('filter-category')?.addEventListener('change', loadReports);
    document.getElementById('filter-priority')?.addEventListener('change', loadReports);
    document.getElementById('filter-status')?.addEventListener('change', loadReports);

    // Search Input Debounce
    let searchDebounce = null;
    document.getElementById('transport-search-input')?.addEventListener('input', () => {
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(loadReports, 300);
    });

    // AI Preview Input Listener
    document.getElementById('report-title')?.addEventListener('input', handleAiPreviewInput);
    document.getElementById('report-description')?.addEventListener('input', handleAiPreviewInput);
  });

})();
