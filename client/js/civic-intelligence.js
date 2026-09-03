/**
 * Tamil Nadu 38-District Civic Intelligence Engine
 * Dynamically queries and visualizes live civic telemetry, SLA response rates, and district metrics.
 */

(function() {
  'use strict';

  let currentData = null;
  let activeDistrict = 'all';
  let activeDateRange = 'all_time';
  let activeCategory = 'all';
  let activeStatus = 'all';
  let activePriority = 'all';

  let districtSearchQuery = '';
  let districtCurrentPage = 1;
  const districtsPerPage = 8;
  let districtFilterTab = 'all'; // 'all' or 'active'

  const CATEGORY_META = {
    roads: { label: 'Roads & Pavements', icon: 'fa-road', color: '#0284c7' },
    streetlights: { label: 'Streetlights & Electrical', icon: 'fa-lightbulb', color: '#f59e0b' },
    water_supply: { label: 'Water Supply', icon: 'fa-faucet-drip', color: '#06b6d4' },
    drainage: { label: 'Drainage & Sewerage', icon: 'fa-water', color: '#6366f1' },
    garbage: { label: 'Garbage & Waste', icon: 'fa-trash-can', color: '#10b981' },
    traffic: { label: 'Traffic & Signals', icon: 'fa-traffic-light', color: '#ec4899' },
    public_property: { label: 'Public Property', icon: 'fa-building-shield', color: '#8b5cf6' },
    parks: { label: 'Parks & Playgrounds', icon: 'fa-tree', color: '#14b8a6' },
    sanitation: { label: 'Public Sanitation', icon: 'fa-hand-sparkles', color: '#10b981' },
    safety_hazard: { label: 'Safety Hazards', icon: 'fa-triangle-exclamation', color: '#ef4444' },
    environment: { label: 'Environment & Pollution', icon: 'fa-leaf', color: '#84cc16' },
    other: { label: 'Other Concerns', icon: 'fa-circle-question', color: '#64748b' }
  };

  /**
   * Initialize on DOM Ready
   */
  document.addEventListener('DOMContentLoaded', async () => {
    // Check URL parameters for preset district (e.g. ?district=coimbatore)
    const urlParams = new URLSearchParams(window.location.search);
    const distParam = urlParams.get('district');
    if (distParam) {
      activeDistrict = distParam.toLowerCase();
      const select = document.getElementById('intel-district-select');
      if (select) select.value = activeDistrict;
    }

    bindControls();
    await fetchCivicIntelligence();
  });

  /**
   * Bind event listeners
   */
  function bindControls() {
    const districtSelect = document.getElementById('intel-district-select');
    if (districtSelect) {
      districtSelect.addEventListener('change', (e) => {
        activeDistrict = e.target.value;
        fetchCivicIntelligence();
      });
    }

    const rangeSelect = document.getElementById('intel-range-select');
    if (rangeSelect) {
      rangeSelect.addEventListener('change', (e) => {
        activeDateRange = e.target.value;
        fetchCivicIntelligence();
      });
    }

    const catFilter = document.getElementById('filter-category');
    if (catFilter) {
      catFilter.addEventListener('change', (e) => {
        activeCategory = e.target.value;
        fetchCivicIntelligence();
      });
    }

    const statusFilter = document.getElementById('filter-status');
    if (statusFilter) {
      statusFilter.addEventListener('change', (e) => {
        activeStatus = e.target.value;
        fetchCivicIntelligence();
      });
    }

    const priorityFilter = document.getElementById('filter-priority');
    if (priorityFilter) {
      priorityFilter.addEventListener('change', (e) => {
        activePriority = e.target.value;
        fetchCivicIntelligence();
      });
    }

    const btnReset = document.getElementById('btn-reset-filters');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        activeCategory = 'all';
        activeStatus = 'all';
        activePriority = 'all';
        if (catFilter) catFilter.value = 'all';
        if (statusFilter) statusFilter.value = 'all';
        if (priorityFilter) priorityFilter.value = 'all';
        fetchCivicIntelligence();
      });
    }

    const btnRefresh = document.getElementById('btn-intel-refresh');
    if (btnRefresh) {
      btnRefresh.addEventListener('click', () => {
        const icon = document.getElementById('intel-refresh-icon');
        if (icon) icon.classList.add('fa-spin');
        fetchCivicIntelligence().finally(() => {
          if (icon) icon.classList.remove('fa-spin');
        });
      });
    }

    const searchInput = document.getElementById('input-search-districts');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        districtSearchQuery = e.target.value.toLowerCase().trim();
        districtCurrentPage = 1;
        if (currentData && currentData.districts) {
          render38DistrictsGrid(currentData.districts, districtSearchQuery);
        }
      });
    }
  }

  /**
   * Fetch data with dual-fetch resilience (No blur or jarring animations)
   */
  async function fetchCivicIntelligence() {
    const refreshIcon = document.getElementById('intel-refresh-icon');
    if (refreshIcon) refreshIcon.classList.add('fa-spin');

    try {
      let res = null;

      // 1. Try unified window.API client first
      if (window.API && typeof window.API.getCivicIntelligence === 'function') {
        try {
          res = await window.API.getCivicIntelligence({
            district: activeDistrict,
            date_range: activeDateRange,
            category: activeCategory,
            status: activeStatus,
            priority: activePriority
          });
        } catch (apiErr) {
          console.warn('API client call threw error, falling back to direct fetch:', apiErr);
          res = null;
        }
      }

      // 2. Direct fetch fallback ensuring zero-failure even with cached js files
      if (!res || !res.data) {
        const params = new URLSearchParams();
        if (activeDistrict && activeDistrict !== 'all') params.append('district', activeDistrict);
        if (activeDateRange && activeDateRange !== 'all_time') params.append('date_range', activeDateRange);
        if (activeCategory && activeCategory !== 'all') params.append('category', activeCategory);
        if (activeStatus && activeStatus !== 'all') params.append('status', activeStatus);
        if (activePriority && activePriority !== 'all') params.append('priority', activePriority);

        const raw = await fetch(`/api/analytics/tamilnadu?${params.toString()}`);
        if (raw.ok) {
          res = await raw.json();
        }
      }

      // Resolve payload safely whether wrapped by window.API or direct fetch
      let payload = null;
      if (res) {
        if (res.data && res.data.data && res.data.data.state_overview) {
          payload = res.data.data;
        } else if (res.data && res.data.state_overview) {
          payload = res.data;
        } else if (res.state_overview) {
          payload = res;
        }
      }

      if (payload && payload.state_overview) {
        currentData = payload;
        updateDistrictDropdownSelection();
        renderStateOverview(currentData.state_overview);
        renderScopeDeepDive(currentData.selected_scope);
        render38DistrictsGrid(currentData.districts, districtSearchQuery);

        const updatedEl = document.getElementById('intel-last-updated');
        if (updatedEl) {
          updatedEl.textContent = `Live Synced (${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })})`;
        }
      }
    } catch (err) {
      console.error('Error loading civic intelligence:', err);
    } finally {
      if (refreshIcon) refreshIcon.classList.remove('fa-spin');
    }
  }

  /**
   * Sync active district with select dropdown
   */
  function updateDistrictDropdownSelection() {
    const select = document.getElementById('intel-district-select');
    if (!select) return;
    select.value = activeDistrict;
  }

  /**
   * 1. Render State Overview KPI Cards
   */
  function renderStateOverview(overview = {}) {
    const formatNum = (n) => Number(n || 0).toLocaleString('en-IN');

    const totalEl = document.getElementById('kpi-total-issues');
    if (totalEl) totalEl.textContent = formatNum(overview.total_issues);

    const openEl = document.getElementById('kpi-open-issues');
    if (openEl) openEl.textContent = formatNum(overview.open_issues);

    const resolvedEl = document.getElementById('kpi-resolved-issues');
    if (resolvedEl) resolvedEl.textContent = formatNum(overview.resolved_issues);

    const rateEl = document.getElementById('kpi-resolution-rate');
    if (rateEl) rateEl.textContent = overview.resolution_rate || '0.0%';

    const overdueEl = document.getElementById('kpi-overdue-issues');
    if (overdueEl) overdueEl.textContent = formatNum(overview.overdue_issues);

    const escalatedEl = document.getElementById('kpi-escalated-issues');
    if (escalatedEl) escalatedEl.textContent = formatNum(overview.escalated_issues);

    const criticalEl = document.getElementById('kpi-critical-issues');
    if (criticalEl) criticalEl.textContent = formatNum(overview.critical_issues);

    const pendingEl = document.getElementById('kpi-pending-issues');
    if (pendingEl) pendingEl.textContent = formatNum(overview.pending_issues);
  }

  /**
   * 2. Render District Deep Dive
   */
  function renderScopeDeepDive(scope = {}) {
    const titleEl = document.getElementById('scope-header-title');
    if (titleEl) {
      titleEl.textContent = `${scope.district_name || 'Tamil Nadu'} Analytical Profile`;
    }

    const badgeEl = document.getElementById('scope-badge');
    if (badgeEl) {
      const isAll = !scope.district_id || scope.district_id === 'all';
      const dName = scope.district_name || 'Selected';
      badgeEl.textContent = isAll ? 'State Consolidated View' : `${dName} District Active`;
    }

    // Top Category Card
    const topCatEl = document.getElementById('scope-top-category');
    const topCatCountEl = document.getElementById('scope-top-category-count');
    if (topCatEl && topCatCountEl) {
      const catKey = (scope.most_reported_issue?.category || 'None').toLowerCase();
      const meta = CATEGORY_META[catKey];
      topCatEl.textContent = meta ? meta.label : (scope.most_reported_issue?.category || 'None');
      topCatCountEl.textContent = `${scope.most_reported_issue?.count || 0} reports (${scope.most_reported_issue?.percentage || 0}%)`;
    }

    // Resolution Rate
    const rateEl = document.getElementById('scope-resolution-rate');
    const barEl = document.getElementById('scope-resolution-bar');
    if (rateEl) rateEl.textContent = scope.overview?.resolution_rate || '0.0%';
    if (barEl) {
      const pct = Math.min(100, Math.max(0, scope.overview?.resolution_rate_numeric || 0));
      barEl.style.width = `${pct}%`;
    }

    // Critical Count
    const critEl = document.getElementById('scope-critical-count');
    if (critEl) critEl.textContent = Number(scope.overview?.critical_issues || 0).toLocaleString('en-IN');

    // Overdue / Escalated
    const overEl = document.getElementById('scope-overdue-count');
    const escEl = document.getElementById('scope-escalated-subtext');
    if (overEl) overEl.textContent = Number(scope.overview?.overdue_issues || 0).toLocaleString('en-IN');
    if (escEl) escEl.textContent = `${scope.overview?.escalated_issues || 0} escalated to Level 1`;

    // Category Distribution Bars
    renderCategoryDistribution(scope.category_distribution || []);

    // Status Distribution Bars
    renderStatusDistribution(scope.status_distribution || []);

    // Most Affected Areas List
    renderMostAffectedAreas(scope.most_affected_areas || []);

    // Priority Distribution
    renderPriorityDistribution(scope.priority_distribution || {});
  }

  /**
   * Render Category Distribution visual bars
   */
  function renderCategoryDistribution(categories = []) {
    const container = document.getElementById('category-distribution-container');
    if (!container) return;

    if (categories.length === 0) {
      container.innerHTML = `<div style="font-size: 0.85rem; color: var(--text-muted); text-align: center; padding: 1.5rem 0;">No category complaints recorded for this selection.</div>`;
      return;
    }

    container.innerHTML = categories.map(catItem => {
      const meta = CATEGORY_META[catItem.category.toLowerCase()] || { label: catItem.category, icon: 'fa-circle-dot', color: '#0f766e' };
      return `
        <div class="dist-bar-item">
          <div class="dist-bar-header">
            <span><i class="fa-solid ${meta.icon}" style="color: ${meta.color}; width: 18px;"></i> ${meta.label}</span>
            <span><strong>${catItem.count}</strong> <span style="color: var(--text-muted); font-size: 0.78rem;">(${catItem.percentage}%)</span></span>
          </div>
          <div class="dist-bar-track">
            <div class="dist-bar-fill" style="width: ${catItem.percentage}%; background: ${meta.color};"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  /**
   * Render Status Distribution visual bars
   */
  function renderStatusDistribution(statuses = []) {
    const container = document.getElementById('status-distribution-container');
    if (!container) return;

    if (statuses.length === 0) {
      container.innerHTML = `<div style="font-size: 0.85rem; color: var(--text-muted); text-align: center; padding: 1rem 0;">No active casework status available.</div>`;
      return;
    }

    const statusColors = {
      pending: '#f59e0b',
      assigned: '#0284c7',
      in_progress: '#6366f1',
      resolved: '#10b981',
      rejected: '#ef4444'
    };

    container.innerHTML = statuses.map(st => {
      const color = statusColors[st.status] || '#64748b';
      const label = st.status.replace('_', ' ').toUpperCase();
      return `
        <div class="dist-bar-item">
          <div class="dist-bar-header">
            <span style="text-transform: capitalize;">${label}</span>
            <span><strong>${st.count}</strong> <span style="color: var(--text-muted); font-size: 0.78rem;">(${st.percentage}%)</span></span>
          </div>
          <div class="dist-bar-track">
            <div class="dist-bar-fill" style="width: ${st.percentage}%; background: ${color};"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  /**
   * Render Most Affected Areas List
   */
  function renderMostAffectedAreas(areas = []) {
    const container = document.getElementById('most-affected-areas-list');
    if (!container) return;

    if (areas.length === 0) {
      container.innerHTML = `<div style="font-size: 0.85rem; color: var(--text-muted); text-align: center; padding: 1.5rem 0;">No specific locality concentrations recorded in this scope.</div>`;
      return;
    }

    container.innerHTML = areas.map((area, idx) => {
      return `
        <div class="area-row">
          <span style="font-weight: 600; color: var(--text-main); display: flex; align-items: center; gap: 0.6rem;">
            <span style="color: var(--text-muted); font-family: monospace; font-size: 0.78rem;">#${idx + 1}</span>
            <span>${escapeHtml(area.name)}</span>
          </span>
          <span class="area-count-badge">
            ${area.count} ${area.count === 1 ? 'issue' : 'issues'} (${area.percentage}%)
          </span>
        </div>
      `;
    }).join('');
  }

  /**
   * Render Priority Distribution
   */
  function renderPriorityDistribution(priorities = {}) {
    const container = document.getElementById('priority-distribution-container');
    if (!container) return;

    const cards = [
      { key: 'critical', label: 'Critical', count: priorities.critical || 0, color: '#dc2626', bg: 'rgba(220, 38, 38, 0.08)' },
      { key: 'high', label: 'High', count: priorities.high || 0, color: '#ea580c', bg: 'rgba(234, 88, 12, 0.08)' },
      { key: 'medium', label: 'Medium', count: priorities.medium || 0, color: '#ca8a04', bg: 'rgba(202, 138, 4, 0.08)' },
      { key: 'low', label: 'Low', count: priorities.low || 0, color: '#16a34a', bg: 'rgba(22, 163, 74, 0.08)' }
    ];

    container.innerHTML = cards.map(c => `
      <div style="background: ${c.bg}; border: 1px solid ${c.color}22; border-radius: 12px; padding: 0.85rem 0.5rem; text-align: center;">
        <span style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: ${c.color}; display: block; margin-bottom: 0.25rem;">${c.label}</span>
        <strong style="font-size: 1.35rem; color: ${c.color}; font-weight: 800;">${c.count}</strong>
      </div>
    `).join('');
  }

  /**
   * 3. Render 38 Districts Directory Grid with Pagination (Eliminates long scroll)
   */
  function render38DistrictsGrid(districts = [], filterQuery = '') {
    const container = document.getElementById('districts-38-container');
    if (!container) return;

    // 1. Update active districts count in tab
    const activeDistrictsCount = districts.filter(d => d.total_issues > 0).length;
    const countActiveEl = document.getElementById('count-dist-active');
    if (countActiveEl) countActiveEl.textContent = activeDistrictsCount;

    // 2. Filter by tab ('all' vs 'active')
    let filtered = districts;
    if (districtFilterTab === 'active') {
      filtered = filtered.filter(d => d.total_issues > 0);
    }

    // 3. Filter by search query
    if (filterQuery) {
      filtered = filtered.filter(d => 
        d.name.toLowerCase().includes(filterQuery) || 
        d.nameTa.includes(filterQuery) ||
        d.code.toLowerCase().includes(filterQuery)
      );
    }

    const totalDistricts = filtered.length;
    const totalPages = Math.ceil(totalDistricts / districtsPerPage) || 1;
    if (districtCurrentPage > totalPages) districtCurrentPage = totalPages;
    if (districtCurrentPage < 1) districtCurrentPage = 1;

    // 4. Paginate items (8 per page)
    const startIndex = (districtCurrentPage - 1) * districtsPerPage;
    const endIndex = Math.min(startIndex + districtsPerPage, totalDistricts);
    const pageItems = filtered.slice(startIndex, endIndex);

    if (totalDistricts === 0) {
      container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 2.5rem; color: var(--text-muted); background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 12px;">No districts match your filter query.</div>`;
      renderDistrictPagination(0, 0, 0, 1);
      return;
    }

    container.innerHTML = pageItems.map(d => {
      const isSelected = activeDistrict === d.id;
      const rateColor = d.resolution_rate_numeric >= 70 ? '#10b981' : (d.resolution_rate_numeric >= 40 ? '#f59e0b' : '#64748b');

      return `
        <div class="district-card-item ${isSelected ? 'selected' : ''}" onclick="window.selectDistrict('${d.id}')">
          <div class="district-card-header">
            <div>
              <span class="district-name-text">${escapeHtml(d.name)}</span>
              <span class="district-name-ta">${escapeHtml(d.nameTa)}</span>
            </div>
            <span style="font-size: 0.72rem; font-weight: 700; text-transform: uppercase; background: rgba(148, 163, 184, 0.15); padding: 0.2rem 0.45rem; border-radius: 6px; color: var(--text-muted); font-family: monospace;">
              ${escapeHtml(d.code)}
            </span>
          </div>

          <div style="margin-bottom: 0.75rem;">
            <div class="district-metric-row">
              <span>Total Issues</span>
              <strong style="${d.total_issues > 0 ? 'color: var(--primary); font-size: 0.92rem;' : ''}">${d.total_issues}</strong>
            </div>
            <div class="district-metric-row">
              <span>Resolved</span>
              <strong style="color: #10b981;">${d.resolved_issues}</strong>
            </div>
            <div class="district-metric-row">
              <span>Resolution Rate</span>
              <strong style="color: ${rateColor};">${d.resolution_rate}</strong>
            </div>
            <div class="district-metric-row">
              <span>Critical</span>
              <strong style="color: ${d.critical_issues > 0 ? '#dc2626' : 'var(--text-main)'};">${d.critical_issues}</strong>
            </div>
          </div>

          <button type="button" class="btn btn-secondary" style="width: 100%; padding: 0.4rem; font-size: 0.78rem; font-weight: 700; border-radius: 8px; justify-content: center; gap: 0.4rem;">
            <span>Select District</span>
            <i class="fa-solid fa-arrow-right" style="font-size: 0.7rem;"></i>
          </button>
        </div>
      `;
    }).join('');

    renderDistrictPagination(startIndex, endIndex, totalDistricts, totalPages);
  }

  /**
   * Render Pagination Controls
   */
  function renderDistrictPagination(startIndex, endIndex, totalDistricts, totalPages) {
    const infoEl = document.getElementById('district-page-info');
    const controlsEl = document.getElementById('district-page-controls');
    if (!infoEl || !controlsEl) return;

    infoEl.textContent = totalDistricts > 0 
      ? `Showing ${startIndex + 1}–${endIndex} of ${totalDistricts} districts (Page ${districtCurrentPage} of ${totalPages})`
      : 'No districts to display';

    if (totalPages <= 1) {
      controlsEl.innerHTML = '';
      return;
    }

    let buttonsHtml = `
      <button type="button" class="district-page-btn" ${districtCurrentPage === 1 ? 'disabled' : ''} onclick="window.goToDistrictPage(${districtCurrentPage - 1})" title="Previous Page">
        <i class="fa-solid fa-chevron-left" style="font-size: 0.72rem;"></i>
      </button>
    `;

    for (let p = 1; p <= totalPages; p++) {
      buttonsHtml += `
        <button type="button" class="district-page-btn ${p === districtCurrentPage ? 'active' : ''}" onclick="window.goToDistrictPage(${p})">
          ${p}
        </button>
      `;
    }

    buttonsHtml += `
      <button type="button" class="district-page-btn" ${districtCurrentPage === totalPages ? 'disabled' : ''} onclick="window.goToDistrictPage(${districtCurrentPage + 1})" title="Next Page">
        <i class="fa-solid fa-chevron-right" style="font-size: 0.72rem;"></i>
      </button>
    `;

    controlsEl.innerHTML = buttonsHtml;
  }

  /**
   * Switch between All Districts and Active Districts tabs
   */
  window.setDistrictFilterTab = function(tab) {
    districtFilterTab = tab;
    districtCurrentPage = 1;

    const tabAll = document.getElementById('tab-dist-all');
    const tabActive = document.getElementById('tab-dist-active');
    if (tabAll) tabAll.classList.toggle('active', tab === 'all');
    if (tabActive) tabActive.classList.toggle('active', tab === 'active');

    if (currentData && currentData.districts) {
      render38DistrictsGrid(currentData.districts, districtSearchQuery);
    }
  };

  /**
   * Page Navigation
   */
  window.goToDistrictPage = function(page) {
    districtCurrentPage = page;
    if (currentData && currentData.districts) {
      render38DistrictsGrid(currentData.districts, districtSearchQuery);
    }
  };

  /**
   * Helper to select district programmatically
   */
  window.selectDistrict = function(distId) {
    if (!distId) return;
    activeDistrict = distId;
    const select = document.getElementById('intel-district-select');
    if (select) select.value = distId;

    const target = document.getElementById('scope-header-title');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    fetchCivicIntelligence();
  };

  /**
   * String escaping helper
   */
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

})();
