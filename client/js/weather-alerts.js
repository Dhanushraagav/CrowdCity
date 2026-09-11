/**
 * weather-alerts.js
 * 
 * Official India Meteorological Department (IMD) Weather Alerts Module.
 * Client controller for Public Pulse > Weather Alerts.
 */

(function() {
  'use strict';

  const state = {
    district: 'all',
    date: 'all',
    severity: 'all',
    searchQuery: '',
    alerts: [],
    activeAlerts: [],
    noWarningDistricts: [],
    sourceAvailable: false,
    isStale: false,
    lastUpdatedIST: null,
    sourceMessage: null,
    isLoading: false
  };

  const TN_DISTRICTS_FALLBACK = [
    'Ariyalur', 'Chengalpattu', 'Chennai', 'Coimbatore', 'Cuddalore',
    'Dharmapuri', 'Dindigul', 'Erode', 'Kallakurichi', 'Kanchipuram',
    'Kanniyakumari', 'Karur', 'Krishnagiri', 'Madurai', 'Mayiladuthurai',
    'Nagapattinam', 'Namakkal', 'Nilgiris', 'Perambalur', 'Pudukkottai',
    'Ramanathapuram', 'Ranipet', 'Salem', 'Sivaganga', 'Tenkasi',
    'Thanjavur', 'Theni', 'Thoothukudi', 'Tiruchirappalli', 'Tirunelveli',
    'Tirupathur', 'Tiruppur', 'Tiruvallur', 'Tiruvannamalai', 'Tiruvarur',
    'Vellore', 'Viluppuram', 'Virudhunagar'
  ];

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    await populateDistrictsDropdown();
    setupEventListeners();
    await fetchWeatherAlerts();
  }

  /**
   * Populate districts dropdown dynamically using CrowdCity's master location API.
   */
  async function populateDistrictsDropdown() {
    const select = document.getElementById('weather-district-filter');
    if (!select) return;

    let districts = TN_DISTRICTS_FALLBACK;
    try {
      const res = await fetch('/api/locations/districts');
      if (res.ok) {
        const json = await res.json();
        if (json.data && Array.isArray(json.data) && json.data.length > 0) {
          districts = json.data.map(d => d.name || d.nameEn || d.id);
        }
      }
    } catch (e) {
      console.warn('[WeatherAlerts] Using fallback 38-districts master list:', e.message);
    }

    // Sort alphabetically
    districts = Array.from(new Set(districts)).sort();

    // Rebuild options preserving "all"
    const currentVal = select.value;
    select.innerHTML = '<option value="all" data-i18n="weather_filter_district_all">All Districts (38)</option>';
    
    districts.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d;
      opt.textContent = d;
      select.appendChild(opt);
    });

    if (currentVal && districts.includes(currentVal)) {
      select.value = currentVal;
    }
  }

  function setupEventListeners() {
    // Refresh button
    const refreshBtn = document.getElementById('btn-refresh-weather');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => fetchWeatherAlerts(true));
    }

    // District select
    const distSelect = document.getElementById('weather-district-filter');
    if (distSelect) {
      distSelect.addEventListener('change', (e) => {
        state.district = e.target.value;
        renderAlerts();
      });
    }

    // Severity select
    const sevSelect = document.getElementById('weather-severity-filter');
    if (sevSelect) {
      sevSelect.addEventListener('change', (e) => {
        state.severity = e.target.value;
        renderAlerts();
      });
    }

    // Date picker
    const dateInput = document.getElementById('weather-date-input');
    if (dateInput) {
      dateInput.addEventListener('change', (e) => {
        if (e.target.value) {
          clearTabSelection();
          state.date = e.target.value;
          renderAlerts();
        }
      });
    }

    // Search input
    const searchInput = document.getElementById('weather-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value.trim().toLowerCase();
        renderAlerts();
      });
    }
  }

  window.setWeatherTimeframeTab = function(tabKey) {
    state.date = tabKey;
    const dateInput = document.getElementById('weather-date-input');
    if (dateInput) dateInput.value = '';

    // Update tab classes
    document.querySelectorAll('.weather-tab-btn').forEach(btn => {
      if (btn.dataset.tab === tabKey) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    renderAlerts();
  };

  function clearTabSelection() {
    document.querySelectorAll('.weather-tab-btn').forEach(btn => btn.classList.remove('active'));
  }

  window.resetWeatherFilters = function() {
    state.district = 'all';
    state.date = 'all';
    state.severity = 'all';
    state.searchQuery = '';

    const distSelect = document.getElementById('weather-district-filter');
    if (distSelect) distSelect.value = 'all';

    const sevSelect = document.getElementById('weather-severity-filter');
    if (sevSelect) sevSelect.value = 'all';

    const dateInput = document.getElementById('weather-date-input');
    if (dateInput) dateInput.value = '';

    const searchInput = document.getElementById('weather-search-input');
    if (searchInput) searchInput.value = '';

    window.setWeatherTimeframeTab('all');
  };

  /**
   * Fetch weather alerts from CrowdCity backend endpoint.
   */
  async function fetchWeatherAlerts(forceRefresh = false) {
    if (state.isLoading) return;
    state.isLoading = true;

    const grid = document.getElementById('weather-alerts-container');
    const refreshIcon = document.getElementById('refresh-weather-icon');
    if (refreshIcon) refreshIcon.classList.add('fa-spin');

    if (grid && state.alerts.length === 0) {
      grid.innerHTML = getSkeletonHtml();
    }

    try {
      const url = `/api/public-pulse/weather-alerts${forceRefresh ? '?refresh=true' : ''}`;
      const res = await fetch(url);
      const data = await res.json();

      state.sourceAvailable = Boolean(data.source_available);
      state.isStale = Boolean(data.is_stale);
      state.lastUpdatedIST = data.last_updated_ist || null;
      state.sourceMessage = data.source_message || null;
      state.alerts = data.alerts || [];
      state.activeAlerts = data.active_alerts || [];
      state.noWarningDistricts = data.no_warning_districts || [];

      updateHeaderStatus();
      renderAlerts();
    } catch (err) {
      console.error('[WeatherAlerts] Fetch error:', err);
      state.sourceAvailable = false;
      showErrorState('Unable to connect to the weather alerts service.');
    } finally {
      state.isLoading = false;
      if (refreshIcon) refreshIcon.classList.remove('fa-spin');
    }
  }

  function updateHeaderStatus() {
    const updatedEl = document.getElementById('weather-last-updated-text');
    const staleNoticeEl = document.getElementById('weather-stale-badge');

    if (updatedEl) {
      updatedEl.textContent = state.lastUpdatedIST || 'Unavailable';
    }

    if (staleNoticeEl) {
      if (state.isStale && state.alerts.length > 0) {
        staleNoticeEl.classList.remove('hidden');
      } else {
        staleNoticeEl.classList.add('hidden');
      }
    }
  }

  /**
   * Filter and render alert cards.
   */
  function renderAlerts() {
    const grid = document.getElementById('weather-alerts-container');
    const emptyState = document.getElementById('weather-empty-state');
    const noWarningBox = document.getElementById('weather-no-warning-box');
    const sourceUnavailableBox = document.getElementById('weather-source-unavailable-box');
    const errorState = document.getElementById('weather-error-state');

    if (!grid) return;

    if (errorState) errorState.classList.add('hidden');

    // 1. If official source is unavailable and no cache exists: show official source notice
    if (!state.sourceAvailable && state.alerts.length === 0) {
      grid.innerHTML = '';
      if (emptyState) emptyState.classList.add('hidden');
      if (noWarningBox) noWarningBox.classList.add('hidden');
      if (sourceUnavailableBox) sourceUnavailableBox.classList.remove('hidden');
      return;
    }

    if (sourceUnavailableBox) sourceUnavailableBox.classList.add('hidden');

    // 2. Filter alerts in memory
    let filtered = [...state.alerts];

    // District filter
    if (state.district !== 'all') {
      filtered = filtered.filter(a => a.district.toLowerCase() === state.district.toLowerCase());
    }

    // Severity filter
    if (state.severity !== 'all') {
      filtered = filtered.filter(a => a.severity.toLowerCase() === state.severity.toLowerCase());
    }

    // Date filter
    if (state.date !== 'all') {
      const todayIST = getTodayISTStr();
      if (state.date === 'today' || state.date === '1') {
        filtered = filtered.filter(a => a.day_index === 1 || a.warning_date === todayIST);
      } else if (state.date === 'tomorrow' || state.date === '2') {
        filtered = filtered.filter(a => a.day_index === 2);
      } else if (state.date === 'day3' || state.date === '3') {
        filtered = filtered.filter(a => a.day_index === 3);
      } else if (state.date === 'day4' || state.date === '4') {
        filtered = filtered.filter(a => a.day_index === 4);
      } else if (state.date === 'day5' || state.date === '5') {
        filtered = filtered.filter(a => a.day_index === 5);
      } else {
        // Specific ISO date YYYY-MM-DD
        filtered = filtered.filter(a => a.warning_date === state.date);
      }
    }

    // Search query filter (matches district, warning type, or severity)
    if (state.searchQuery) {
      filtered = filtered.filter(a => 
        a.district.toLowerCase().includes(state.searchQuery) ||
        a.warning_types.some(t => t.toLowerCase().includes(state.searchQuery)) ||
        a.severity.toLowerCase().includes(state.searchQuery)
      );
    }

    // 3. Handle specific single-district "No Warning" scenario
    if (state.district !== 'all' && filtered.length > 0 && filtered.every(a => a.is_no_warning)) {
      grid.innerHTML = '';
      if (emptyState) emptyState.classList.add('hidden');
      if (noWarningBox) {
        const titleEl = document.getElementById('no-warning-district-name');
        if (titleEl) titleEl.textContent = state.district;
        noWarningBox.classList.remove('hidden');
      }
      return;
    }

    if (noWarningBox) noWarningBox.classList.add('hidden');

    // 4. If no items match filters
    if (filtered.length === 0) {
      grid.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    // Filter out "No Warning" records from main card grid unless explicitly selected
    const displayItems = state.severity.toLowerCase() === 'no warning'
      ? filtered
      : filtered.filter(a => !a.is_no_warning);

    if (displayItems.length === 0) {
      grid.innerHTML = '';
      if (state.district !== 'all') {
        if (noWarningBox) {
          const titleEl = document.getElementById('no-warning-district-name');
          if (titleEl) titleEl.textContent = state.district;
          noWarningBox.classList.remove('hidden');
        }
      } else {
        if (emptyState) emptyState.classList.remove('hidden');
      }
      return;
    }

    // Render cards
    grid.innerHTML = displayItems.map(item => createWeatherAlertCardHtml(item)).join('');
  }

  /**
   * HTML template for individual Weather Alert Card.
   * Follows clean, professional government-grade design.
   */
  function createWeatherAlertCardHtml(item) {
    const sev = (item.severity || 'Watch').toUpperCase();
    let sevBadgeHtml = '';

    if (sev === 'WARNING') {
      sevBadgeHtml = `
        <span class="weather-severity-badge severity-warning">
          <span class="severity-dot-warning"></span>
          WARNING
        </span>
      `;
    } else if (sev === 'ALERT') {
      sevBadgeHtml = `
        <span class="weather-severity-badge severity-alert">
          <span class="severity-dot-alert"></span>
          ALERT
        </span>
      `;
    } else if (sev === 'WATCH') {
      sevBadgeHtml = `
        <span class="weather-severity-badge severity-watch">
          <span class="severity-dot-watch"></span>
          WATCH
        </span>
      `;
    } else {
      sevBadgeHtml = `
        <span class="weather-severity-badge severity-nowarning">
          <span class="severity-dot-nowarning"></span>
          NO WARNING
        </span>
      `;
    }

    const warningText = (item.warning_types && item.warning_types.length > 0)
      ? item.warning_types.join(' &bull; ')
      : (item.warning_type_primary || 'Weather Advisory');

    const formattedValidDate = formatDisplayDate(item.warning_date);
    const formattedIssued = item.issued_date
      ? `${formatDisplayDate(item.issued_date)}, ${item.issued_time || '16:00 IST'}`
      : (item.issued_time || 'Official IMD Bulletin');

    return `
      <article class="weather-alert-card" id="alert-card-${escapeHtml(item.id || '')}">
        <div>
          <div class="weather-card-header">
            <div class="weather-badges-wrap">
              <span class="weather-district-badge">
                <i class="fa-solid fa-location-dot" style="font-size: 0.68rem; color: #64748b;"></i>
                ${escapeHtml(item.district || 'Tamil Nadu')}
              </span>
              <span class="weather-day-badge">${escapeHtml(item.day_label || 'Forecast')}</span>
            </div>
            ${sevBadgeHtml}
          </div>

          <h2 class="weather-warning-title">
            ${escapeHtml(warningText)}
          </h2>

          <div class="weather-meta-row">
            <i class="fa-regular fa-calendar" style="color: #64748b;"></i>
            <span><strong>Valid:</strong> ${escapeHtml(formattedValidDate)}</span>
          </div>

          <div class="weather-meta-row" style="font-size: 0.76rem; color: var(--text-muted, #64748b);">
            <i class="fa-regular fa-clock" style="color: #94a3b8;"></i>
            <span>Issued: ${escapeHtml(formattedIssued)}</span>
          </div>
        </div>

        <div class="weather-card-footer">
          <span class="weather-source-tag">
            <i class="fa-solid fa-building-columns" style="font-size: 0.72rem; color: #94a3b8;"></i>
            Source: India Meteorological Department
          </span>
          <button class="weather-btn-share" onclick="shareWeatherAlert('${escapeHtml(item.district)}', '${escapeHtml(warningText)}', '${escapeHtml(item.severity)}', '${escapeHtml(formattedValidDate)}')" title="Copy alert details">
            <i class="fa-regular fa-copy"></i>
            <span>Share</span>
          </button>
        </div>
      </article>
    `;
  }

  window.shareWeatherAlert = function(district, warning, severity, date) {
    const text = `CrowdCity Official Weather Alert (IMD)\nDistrict: ${district}\nSeverity: ${severity}\nWarning: ${warning}\nValid Date: ${date}\nSource: India Meteorological Department\nhttps://mausam.imd.gov.in/`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        alert('Alert details copied to clipboard.');
      }).catch(() => {
        prompt('Copy alert details:', text);
      });
    } else {
      prompt('Copy alert details:', text);
    }
  };

  function formatDisplayDate(dateStr) {
    if (!dateStr) return 'Valid Date';
    try {
      const [year, month, day] = dateStr.split('-').map(Number);
      const d = new Date(Date.UTC(year, month - 1, day));
      return d.toLocaleDateString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    } catch (e) {
      return dateStr;
    }
  }

  function getTodayISTStr() {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(now);
    const map = {};
    parts.forEach(p => { map[p.type] = p.value; });
    return `${map.year}-${map.month}-${map.day}`;
  }

  function showErrorState(msg) {
    const errorState = document.getElementById('weather-error-state');
    const msgEl = document.getElementById('weather-error-message');
    if (msgEl) msgEl.textContent = msg || 'Weather alert data is temporarily unavailable.';
    if (errorState) errorState.classList.remove('hidden');
  }

  function getSkeletonHtml() {
    return Array(3).fill(0).map(() => `
      <div class="weather-alert-card" style="opacity: 0.6; pointer-events: none;">
        <div style="height: 20px; background: #e2e8f0; border-radius: 6px; width: 45%; margin-bottom: 1rem;"></div>
        <div style="height: 24px; background: #e2e8f0; border-radius: 6px; width: 80%; margin-bottom: 1rem;"></div>
        <div style="height: 38px; background: #f1f5f9; border-radius: 6px; width: 100%; margin-bottom: 1rem;"></div>
        <div style="height: 20px; background: #f1f5f9; border-radius: 4px; width: 60%;"></div>
      </div>
    `).join('');
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

})();
