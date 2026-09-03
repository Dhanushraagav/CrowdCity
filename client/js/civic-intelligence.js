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

  let currentSortColumn = 'total_issues';
  let currentSortAsc = false;
  let districtSearchQuery = '';

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
        if (currentData && currentData.districts) {
          render38DistrictsGrid(currentData.districts, districtSearchQuery);
        }
      });
    }
  }

  /**
   * Fetch data with dual-fetch resilience (API client + Direct Fetch fallback)
   */
  async function fetchCivicIntelligence() {
    const mainContainer = document.getElementById('intel-main-container');
    if (mainContainer) mainContainer.classList.add('intel-loading-shimmer');

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

      if (res && res.data) {
        currentData = res.data;
        updateDistrictDropdownSelection();
        renderStateOverview(currentData.state_overview);
        renderScopeDeepDive(currentData.selected_scope);
        render38DistrictsGrid(currentData.districts, districtSearchQuery);
        renderComparisonMatrix(currentData.comparison);

        const updatedEl = document.getElementById('intel-last-updated');
        if (updatedEl) {
          updatedEl.textContent = `Live Synced (${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })})`;
        }
      }
    } catch (err) {
      console.error('Error loading civic intelligence:', err);
    } finally {
      if (mainContainer) mainContainer.classList.remove('intel-loading-shimmer');
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
      badgeEl.textContent = scope.district_id === 'all' ? 'State Consolidated View' : `${scope.district_name} District Active`;
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
   * 3. Render 38 Districts Directory Grid
   */
  function render38DistrictsGrid(districts = [], filterQuery = '') {
    const container = document.getElementById('districts-38-container');
    if (!container) return;

    let filtered = districts;
    if (filterQuery) {
      filtered = districts.filter(d => 
        d.name.toLowerCase().includes(filterQuery) || 
        d.nameTa.includes(filterQuery) ||
        d.code.toLowerCase().includes(filterQuery)
      );
    }

    if (filtered.length === 0) {
      container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 2.5rem; color: var(--text-muted);">No districts match your filter query.</div>`;
      return;
    }

    container.innerHTML = filtered.map(d => {
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

          <div style="margin-bottom: 0.85rem;">
            <div class="district-metric-row">
              <span>Total Issues</span>
              <strong>${d.total_issues}</strong>
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

          <button type="button" class="btn btn-secondary" style="width: 100%; padding: 0.45rem; font-size: 0.78rem; font-weight: 700; border-radius: 8px; justify-content: center; gap: 0.4rem;">
            <span>Inspect District</span>
            <i class="fa-solid fa-arrow-right" style="font-size: 0.7rem;"></i>
          </button>
        </div>
      `;
    }).join('');
  }

  /**
   * 4. Render District Comparison Matrix
   */
  function renderComparisonMatrix(comparison = []) {
    const tbody = document.getElementById('comparison-table-body');
    if (!tbody) return;

    if (comparison.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 2rem; color: var(--text-muted);">No district comparison metrics available.</td></tr>`;
      return;
    }

    const sorted = [...comparison].sort((a, b) => {
      let valA = a[currentSortColumn];
      let valB = b[currentSortColumn];
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return currentSortAsc ? -1 : 1;
      if (valA > valB) return currentSortAsc ? 1 : -1;
      return 0;
    });

    tbody.innerHTML = sorted.map((row, idx) => {
      const isSelected = activeDistrict === row.id;
      const rateNum = row.resolution_rate_numeric || 0;
      const rateColor = rateNum >= 70 ? '#10b981' : (rateNum >= 40 ? '#f59e0b' : '#64748b');

      return `
        <tr style="cursor: pointer; ${isSelected ? 'background: rgba(15, 118, 110, 0.08); font-weight: 600;' : ''}" onclick="window.selectDistrict('${row.id}')">
          <td style="color: var(--text-muted); font-family: monospace; font-size: 0.78rem;">#${idx + 1}</td>
          <td>
            <strong>${escapeHtml(row.district)}</strong>
            <span style="color: var(--text-muted); font-size: 0.72rem; margin-left: 0.35rem; text-transform: uppercase;">(${escapeHtml(row.district_code)})</span>
          </td>
          <td><strong>${Number(row.total_issues || 0).toLocaleString('en-IN')}</strong></td>
          <td style="color: #10b981; font-weight: 600;">${Number(row.resolved_issues || 0).toLocaleString('en-IN')}</td>
          <td>
            <span style="display: inline-flex; align-items: center; gap: 0.4rem;">
              <span style="font-weight: 700; color: ${rateColor};">${row.resolution_rate}</span>
              <span style="width: 45px; height: 6px; background: rgba(148, 163, 184, 0.2); border-radius: 3px; display: inline-block; overflow: hidden;">
                <span style="width: ${rateNum}%; height: 100%; background: ${rateColor}; display: block;"></span>
              </span>
            </span>
          </td>
          <td style="color: ${row.critical_issues > 0 ? '#dc2626' : 'inherit'}; font-weight: ${row.critical_issues > 0 ? '700' : 'normal'};">
            ${row.critical_issues}
          </td>
          <td style="color: ${row.overdue_issues > 0 ? '#ef4444' : 'inherit'};">
            ${row.overdue_issues}
          </td>
          <td style="color: ${row.escalated_issues > 0 ? '#7f1d1d' : 'inherit'}; font-weight: ${row.escalated_issues > 0 ? '700' : 'normal'};">
            ${row.escalated_issues}
          </td>
        </tr>
      `;
    }).join('');
  }

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
   * Helper to sort comparison matrix
   */
  window.sortComparison = function(column) {
    if (column === 'rank') {
      currentSortColumn = 'total_issues';
      currentSortAsc = false;
    } else if (currentSortColumn === column) {
      currentSortAsc = !currentSortAsc;
    } else {
      currentSortColumn = column;
      currentSortAsc = false;
    }

    if (currentData && currentData.comparison) {
      renderComparisonMatrix(currentData.comparison);
    }
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
