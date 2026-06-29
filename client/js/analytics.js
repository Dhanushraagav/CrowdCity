// CrowdCity - Advanced Analytics Page Controller

let map = null;
let heatmapLayer = null;
let showHeatmap = true;

// Raw fetched data buffers for client-side filtering
let rawData = null;

// Chart.js instances
let categoriesChart = null;
let statusesChart = null;
let trendsChart = null;
let deptChart = null;

const CATEGORY_COLORS = {
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

const STATUS_COLORS = {
  pending: '#f59e0b',     // Amber
  assigned: '#3b82f6',    // Blue
  in_progress: '#3b82f6', // Blue
  resolved: '#22c55e',    // Green
  rejected: '#ef4444'     // Red
};

document.addEventListener('DOMContentLoaded', () => {
  // Listen to auth changes
  window.addEventListener('auth-change', (e) => {
    loadAnalyticsDashboard();
  });

  // Listen to language changes to translate dynamic contents and charts
  window.addEventListener('language-change', (e) => {
    loadAnalyticsDashboard();
  });

  // Setup Filters
  const categoryFilter = document.getElementById('analytics-category-filter');
  const rangeFilter = document.getElementById('analytics-range-filter');

  if (categoryFilter) categoryFilter.addEventListener('change', filterAndUpdateDashboard);
  if (rangeFilter) rangeFilter.addEventListener('change', filterAndUpdateDashboard);

  loadAnalyticsDashboard();
});

/**
 * Main loader to fetch API data and initialize layout elements
 */
async function loadAnalyticsDashboard() {
  const { data, error } = await window.API.getAdvancedAnalytics();

  if (error) {
    console.error("Failed to retrieve advanced analytics:", error);
    return;
  }

  rawData = data;
  
  // Initialize Leaflet map if not done
  initAnalyticsMap();

  // Render static city-wide insights and department scorecards
  renderAiInsights(rawData.aiInsights);
  renderDepartmentScorecards(rawData.departmentPerformance);

  // Apply filters and populate charts/statistics
  filterAndUpdateDashboard();
}

/**
 * Initialize Leaflet map focused on San Francisco
 */
function initAnalyticsMap() {
  if (map) return;

  const defaultCenter = [11.0168, 76.9558]; // Coimbatore, India
  map = L.map('analytics-map', {
    scrollWheelZoom: false
  }).setView(defaultCenter, 13);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  // Resize handling to ensure Leaflet maps redraw correctly on mobile/window resize
  const mapElement = document.getElementById('analytics-map');
  if (mapElement) {
    window.addEventListener('resize', () => {
      if (map) {
        map.invalidateSize();
      }
    });

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => {
        if (map) {
          map.invalidateSize();
        }
      });
      observer.observe(mapElement);
    }
  }
}

/**
 * Filter data client-side for immediate visual response, then update UI components
 */
function filterAndUpdateDashboard() {
  if (!rawData) return;

  const activeCategory = document.getElementById('analytics-category-filter').value;
  const activeRangeDays = document.getElementById('analytics-range-filter').value;

  // Filter issues list based on criteria
  let filteredPoints = [...rawData.heatmapPoints];

  // 1. Filter by Category
  if (activeCategory) {
    filteredPoints = filteredPoints.filter(p => p.category === activeCategory);
  }

  // 2. Filter by Date range
  if (activeRangeDays !== 'all') {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(activeRangeDays));
    filteredPoints = filteredPoints.filter(p => {
      if (!p.created_at) return false;
      const created = new Date(p.created_at);
      return created >= cutoffDate;
    });
  }

  // Recalculate KPI metrics on filtered list
  updateKPIs(filteredPoints, activeCategory);

  // Redraw Heatmap Overlay
  renderHeatmap(filteredPoints);

  // Redraw Neighborhood List
  renderNeighborhoodsList(filteredPoints);

  // Redraw Charts (rebuilt from filtered set)
  updateCharts(filteredPoints);
}

/**
 * Recalculate KPIs based on filtered complaints
 */
function updateKPIs(points, category) {
  const totalEl = document.getElementById('kpi-total-complaints');
  const resolvedEl = document.getElementById('kpi-resolved-complaints');
  const avgEl = document.getElementById('kpi-avg-resolution');
  const hotspotsEl = document.getElementById('kpi-hotspots-count');

  const total = points.length;
  const resolved = points.filter(p => p.status === 'resolved').length;
  
  let avgHours = rawData.averageResolutionTimeHours || 0;

  if (totalEl) totalEl.textContent = total;
  if (resolvedEl) resolvedEl.textContent = resolved;
  if (avgEl) avgEl.textContent = avgHours > 24 ? `${Math.round(avgHours / 24 * 10) / 10} days` : `${avgHours} hr`;
  if (hotspotsEl) hotspotsEl.textContent = points.filter(p => p.weight > 5).length;
}

/**
 * Render toggable Leaflet Heatmap Layer
 */
function renderHeatmap(points) {
  if (!map) return;

  // Clear existing layer if present
  if (heatmapLayer) {
    map.removeLayer(heatmapLayer);
  }

  if (!showHeatmap) return;

  // Format array for Leaflet.heat: [lat, lng, intensity]
  const heatData = points.map(p => [p.lat, p.lng, p.weight ? Math.min(p.weight / 10, 1.0) : 0.2]);

  heatmapLayer = L.heatLayer(heatData, {
    radius: 25,
    blur: 15,
    maxZoom: 15,
    max: 1.0,
    gradient: {
      0.4: 'blue',
      0.65: 'lime',
      0.85: 'orange',
      1.0: 'red'
    }
  }).addTo(map);
}

/**
 * Toggle between Heatmap Overlay and standard marker view
 */
function toggleHeatmapView() {
  showHeatmap = !showHeatmap;
  const btn = document.getElementById('toggle-heatmap-btn');
  if (btn) {
    btn.classList.toggle('active', showHeatmap);
  }
  filterAndUpdateDashboard();
}
window.toggleHeatmapView = toggleHeatmapView;

/**
 * Populate Neighborhood list
 */
function renderNeighborhoodsList(points) {
  const container = document.getElementById('area-list-container');
  if (!container) return;

  const areaCounts = {};
  points.forEach(p => {
    const match = rawData.areaDistribution.find(a => p.title && p.title.toLowerCase().includes(a.area.toLowerCase()));
    const area = match ? match.area : 'Downtown Area';
    areaCounts[area] = (areaCounts[area] || 0) + 1;
  });

  const sortedAreas = Object.keys(areaCounts)
    .map(area => ({ area, count: areaCounts[area] }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  if (sortedAreas.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding: 2rem; color:var(--text-muted);">No locations match active filter.</div>`;
    return;
  }

  let html = '';
  sortedAreas.forEach(item => {
    html += `
      <div class="area-item">
        <span class="area-name"><i class="fa-solid fa-location-dot"></i> ${item.area}</span>
        <span class="area-count">${item.count} issues</span>
      </div>
    `;
  });

  container.innerHTML = html;
}

/**
 * Render AI Insights
 */
function renderAiInsights(insights) {
  const listEl = document.getElementById('ai-insights-list');
  if (!listEl) return;

  if (!insights || insights.length === 0) {
    listEl.innerHTML = `<div style="color:var(--text-muted); font-size:0.9rem;">No smart city insights available at this moment.</div>`;
    return;
  }

  listEl.innerHTML = insights.map((insight, idx) => {
    return `
      <div style="display:flex; gap:0.75rem; align-items:flex-start; margin-bottom: 0.25rem;">
        <span style="color:var(--primary); font-size:1.1rem; line-height:1.2; margin-top:2px;">
          <i class="fa-solid fa-circle-nodes"></i>
        </span>
        <p style="margin:0; font-size:0.95rem; color:var(--text-main); font-weight:500; line-height:1.5;">${insight}</p>
      </div>
    `;
  }).join('');
}

/**
 * Render Department scorecards
 */
function renderDepartmentScorecards(depts) {
  const gridEl = document.getElementById('dept-scorecard-grid');
  if (!gridEl) return;

  if (!depts || depts.length === 0) {
    gridEl.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:2rem; color:var(--text-muted);">No department statistics found.</div>`;
    return;
  }

  gridEl.innerHTML = depts.map(d => {
    let statusColor = '#10b981'; 
    if (d.performanceScore < 50) statusColor = '#ef4444'; 
    else if (d.performanceScore < 75) statusColor = '#f59e0b'; 

    const resolvedRate = d.totalCount > 0 ? Math.round((d.resolvedCount / d.totalCount) * 100) : 0;
    const avgSpeed = d.avgResolutionHours > 0 
      ? (d.avgResolutionHours > 24 ? `${Math.round(d.avgResolutionHours / 24 * 10) / 10} days` : `${d.avgResolutionHours} hours`)
      : 'N/A';

    return `
      <div class="glass-panel" style="padding:1.25rem; display:flex; flex-direction:column; gap:0.75rem; border:1px solid var(--border-color); border-radius:var(--radius-md); box-shadow:var(--shadow-sm); transition:transform 0.2s;" onmouseenter="this.style.transform='translateY(-2px)'" onmouseleave="this.style.transform='translateY(0)'">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:0.5rem;">
          <div>
            <h4 style="margin:0; font-size:0.95rem; font-weight:700; color:var(--text-main); line-height:1.3;">${d.department}</h4>
            <span style="font-size:0.75rem; color:var(--text-muted); font-weight:600; text-transform:uppercase;">Caseload: ${d.totalCount} issues</span>
          </div>
          <div style="display:flex; flex-direction:column; align-items:center; line-height:1;">
            <span style="font-size:1.5rem; font-weight:800; color:${statusColor};">${d.grade}</span>
            <span style="font-size:0.65rem; color:var(--text-muted); font-weight:700; text-transform:uppercase; margin-top:0.2rem;">Grade</span>
          </div>
        </div>
        
        <div>
          <div style="display:flex; justify-content:space-between; font-size:0.8rem; margin-bottom:0.35rem;">
            <span style="color:var(--text-muted); font-weight:500;">Performance Score</span>
            <strong style="color:var(--text-main); font-weight:700;">${d.performanceScore}/100</strong>
          </div>
          <div style="width:100%; height:6px; background-color:var(--bg-surface-hover); border-radius:3px; overflow:hidden;">
            <div style="width:${d.performanceScore}%; height:100%; background-color:${statusColor}; border-radius:3px; transition:width 0.8s ease-in-out;"></div>
          </div>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; color:var(--text-muted); border-top:1px dashed var(--border-color); padding-top:0.5rem; margin-top:0.25rem;">
          <span>Resolved: <strong>${resolvedRate}%</strong></span>
          <span>Avg Speed: <strong>${avgSpeed}</strong></span>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Redraw all Chart.js instances
 */
function updateCharts(points) {
  const categoryCounts = {};
  const statusCounts = {};

  Object.keys(CATEGORY_COLORS).forEach(c => categoryCounts[c] = 0);
  Object.keys(STATUS_COLORS).forEach(s => statusCounts[s] = 0);

  points.forEach(p => {
    if (categoryCounts[p.category] !== undefined) categoryCounts[p.category]++;
    else categoryCounts.other++;

    if (statusCounts[p.status] !== undefined) statusCounts[p.status]++;
  });

  // Re-group Monthly Trends on filtered points
  const monthlyCounts = {};
  points.forEach(p => {
    if (p.created_at) {
      const date = new Date(p.created_at);
      if (!isNaN(date)) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const key = `${year}-${month}`;
        monthlyCounts[key] = (monthlyCounts[key] || 0) + 1;
      }
    }
  });
  const trends = Object.keys(monthlyCounts).map(month => ({
    month,
    count: monthlyCounts[month]
  })).sort((a, b) => a.month.localeCompare(b.month));

  // Re-group Department stats on filtered points
  const deptStats = {};
  points.forEach(p => {
    let dept = 'Road Department';
    if (p.category === 'garbage' || p.category === 'sanitation' || p.category === 'environment') dept = 'Sanitation Department';
    else if (p.category === 'water_supply' || p.category === 'leakage' || p.category === 'drainage') dept = 'Water Department';
    else if (p.category === 'streetlights' || p.category === 'streetlight') dept = 'Electrical Department';
    else if (p.category === 'other') dept = 'General Department';
    
    if (!deptStats[dept]) {
      deptStats[dept] = { total: 0, resolved: 0 };
    }
    deptStats[dept].total++;
    if (p.status === 'resolved') {
      deptStats[dept].resolved++;
    }
  });
  const depts = Object.keys(deptStats).map(dept => ({
    department: dept,
    totalCount: deptStats[dept].total,
    resolvedCount: deptStats[dept].resolved
  }));

  // Render Charts
  renderCategoriesChart(categoryCounts);
  renderStatusesChart(statusCounts);
  renderTrendsChart(trends);
  renderDepartmentPerformanceChart(depts);
}

/**
 * Chart 1: Categories Doughnut
 */
function renderCategoriesChart(counts) {
  const ctx = document.getElementById('chart-advanced-categories');
  if (!ctx) return;

  if (categoriesChart) categoriesChart.destroy();

  const labels = Object.keys(counts).map(k => window.formatCategoryName(k));
  const data = Object.values(counts);
  const colors = Object.keys(counts).map(k => CATEGORY_COLORS[k] || CATEGORY_COLORS.other);

  categoriesChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderWidth: 2,
        borderColor: 'var(--bg-surface)'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: 'var(--text-main)',
            font: { family: 'Inter', weight: 500 }
          }
        }
      }
    }
  });
}

/**
 * Chart 2: Statuses Horizontal Bar
 */
function renderStatusesChart(counts) {
  const ctx = document.getElementById('chart-advanced-statuses');
  if (!ctx) return;

  if (statusesChart) statusesChart.destroy();

  const labels = Object.keys(counts).map(k => window.i18n ? window.i18n.t('status_' + k.toLowerCase()) : k.replace('_', ' ').toUpperCase());
  const data = Object.values(counts);
  const colors = Object.keys(counts).map(k => STATUS_COLORS[k]);

  statusesChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: window.i18n ? window.i18n.t('reports_count') : 'Issues Count',
        data,
        backgroundColor: colors,
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
          grid: { color: 'var(--border-color)' },
          ticks: { color: 'var(--text-muted)' }
        },
        y: {
          grid: { display: false },
          ticks: { color: 'var(--text-muted)' }
        }
      }
    }
  });
}

/**
 * Chart 3: Monthly Trends Line Chart
 */
function renderTrendsChart(trends) {
  const ctx = document.getElementById('chart-monthly-trends');
  if (!ctx) return;

  if (trendsChart) trendsChart.destroy();

  const labels = trends.map(t => {
    const [year, month] = t.month.split('-');
    const date = new Date(year, parseInt(month) - 1, 1);
    return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  });
  const data = trends.map(t => t.count);

  trendsChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: window.i18n ? window.i18n.t('hazards_reported') : 'Hazards Reported',
        data,
        borderColor: '#94a3b8',
        backgroundColor: 'rgba(148, 163, 184, 0.1)',
        borderWidth: 3,
        fill: true,
        tension: 0.35,
        pointBackgroundColor: '#94a3b8',
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: 'var(--text-main)' }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: 'var(--text-muted)' }
        },
        y: {
          grid: { color: 'var(--border-color)' },
          ticks: { color: 'var(--text-muted)', stepSize: 1 }
        }
      }
    }
  });
}

/**
 * Chart 4: Department Performance Grouped Bar
 */
function renderDepartmentPerformanceChart(depts) {
  const ctx = document.getElementById('chart-department-performance');
  if (!ctx) return;

  if (deptChart) deptChart.destroy();

  const labels = depts.map(d => d.department.replace('Department of ', '').replace('Bureau of ', ''));
  const totalData = depts.map(d => d.totalCount);
  const resolvedData = depts.map(d => d.resolvedCount);

  deptChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: window.i18n ? window.i18n.t('total_reports') : 'Total Reports',
          data: totalData,
          backgroundColor: 'rgba(100, 116, 139, 0.5)',
          borderColor: '#64748b',
          borderWidth: 1.5,
          borderRadius: 4
        },
        {
          label: window.i18n ? window.i18n.t('resolved_reports') : 'Resolved Reports',
          data: resolvedData,
          backgroundColor: 'rgba(34, 197, 94, 0.75)',
          borderColor: '#22c55e',
          borderWidth: 1.5,
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: 'var(--text-main)' }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: 'var(--text-muted)', font: { size: 10 } }
        },
        y: {
          grid: { color: 'var(--border-color)' },
          ticks: { color: 'var(--text-muted)', stepSize: 1 }
        }
      }
    }
  });
}
