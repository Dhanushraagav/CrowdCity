/**
 * weather-alerts.js
 * 
 * Premium Open-Meteo Weather Forecast Client Controller.
 * Powers the Public Pulse > Weather Forecast page.
 * 
 * Features:
 * - Real forecast data from Open-Meteo via CrowdCity backend (/api/public-pulse/weather)
 * - Region-level and locality weather lookup (Peelamedu, Gandhipuram, RS Puram, Singanallur, etc.)
 * - Unified location search with suggestions popover, recent searches, and city quick-picks
 * - Apple Weather-inspired atmospheric hero with condition-aware dynamic backgrounds
 * - Lightweight, GPU-accelerated CSS animations (rain, thunder, clouds, sun glow, stars, fog)
 * - Respects prefers-reduced-motion for accessibility
 * - 24-hour horizontally scrollable hourly forecast strip
 * - Truthful weather insights section computed strictly from genuine weather values
 * - Redesigned 5-day forecast cards with "LIVE NOW" badge for today & temp range bars
 * - 38 Tamil Nadu districts overview grid
 * - Resilient error handling and zero fake/synthetic data
 */

(function() {
  'use strict';

  const state = {
    district: 'all',
    userDetectedDistrict: null,
    isDetectingLocation: false,
    userHasManuallyChangedDistrict: false,
    dateTab: 'all',
    searchQuery: '',
    districtsForecast: [],
    currentDistrict: null,
    sourceAvailable: false,
    isStale: false,
    lastUpdatedIST: null,
    isLoading: false,

    // Region / Locality Upgrade
    selectedLocation: null, // { name, locality, district, displayName, lat, lon }
    hourlyForecast: [],
    weatherInsights: [],
    recentLocations: []
  };

  const TN_DISTRICTS_FALLBACK = [
    'Ariyalur', 'Chengalpattu', 'Chennai', 'Coimbatore', 'Cuddalore',
    'Dharmapuri', 'Dindigul', 'Erode', 'Kallakurichi', 'Kancheepuram',
    'Kanniyakumari', 'Karur', 'Krishnagiri', 'Madurai', 'Mayiladuthurai',
    'Nagapattinam', 'Namakkal', 'Nilgiris', 'Perambalur', 'Pudukkottai',
    'Ramanathapuram', 'Ranipet', 'Salem', 'Sivaganga', 'Tenkasi',
    'Thanjavur', 'Theni', 'Thoothukudi', 'Tiruchirappalli', 'Tirunelveli',
    'Tirupathur', 'Tiruppur', 'Tiruvallur', 'Tiruvannamalai', 'Tiruvarur',
    'Vellore', 'Viluppuram', 'Virudhunagar'
  ];

  const MAJOR_CITIES_CHIPS = [
    { name: 'Coimbatore', id: 'coimbatore' },
    { name: 'Chennai', id: 'chennai' },
    { name: 'Madurai', id: 'madurai' },
    { name: 'Salem', id: 'salem' },
    { name: 'Tiruchirappalli', id: 'tiruchirappalli' },
    { name: 'Tiruppur', id: 'tiruppur' },
    { name: 'Erode', id: 'erode' },
    { name: 'Vellore', id: 'vellore' }
  ];

  const RECENT_LOCATIONS_STORAGE_KEY = 'cc_weather_recent_locations';

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    loadRecentLocations();

    // 1. Resolve known citizen district synchronously from client storage / coordinates
    if (window.CrowdCityLocation && typeof window.CrowdCityLocation.getSavedUserDistrict === 'function') {
      const saved = window.CrowdCityLocation.getSavedUserDistrict();
      if (saved) {
        state.userDetectedDistrict = saved;
        state.district = saved.toLowerCase();
      }
    } else {
      const saved = localStorage.getItem('user_district');
      if (saved && saved !== 'all' && saved !== 'Tamil Nadu') {
        state.userDetectedDistrict = saved;
        state.district = saved.toLowerCase();
      }
    }

    // 2. If no district was found in local storage, check cached location without forcing browser GPS prompt
    if (!state.userDetectedDistrict) {
      if (window.CrowdCityLocation && typeof window.CrowdCityLocation.detectUserDistrict === 'function') {
        const cachedDistrict = await window.CrowdCityLocation.detectUserDistrict({ timeoutMs: 3000, requestGps: false });
        if (cachedDistrict && !state.userHasManuallyChangedDistrict) {
          state.userDetectedDistrict = cachedDistrict;
          state.district = cachedDistrict.toLowerCase();
          const distSelect = document.getElementById('weather-district-filter');
          if (distSelect) distSelect.value = state.district;
          updateSelectedDistrictView();
        }
      }
    }

    await populateDistrictsDropdown();
    setupEventListeners();
    setupLocationSearch();
    updateLocationBanner();
    await fetchWeatherForecast();

    // 3. Listen for global location detection and change events
    window.addEventListener('crowdcity:location_detected', handleLocationEvent);
    window.addEventListener('crowdcity:location_changed', handleLocationEvent);
  }

  function handleLocationEvent(e) {
    if (e.detail && e.detail.district && !state.userHasManuallyChangedDistrict) {
      state.userDetectedDistrict = e.detail.district;
      state.district = e.detail.district.toLowerCase();
      state.selectedLocation = null;
      state.isDetectingLocation = false;
      const distSelect = document.getElementById('weather-district-filter');
      if (distSelect) distSelect.value = state.district;
      updateLocationBanner();
      updateSelectedDistrictView();
      renderView();
    }
  }

  function loadRecentLocations() {
    try {
      const raw = localStorage.getItem(RECENT_LOCATIONS_STORAGE_KEY);
      if (raw) {
        state.recentLocations = JSON.parse(raw);
        if (!Array.isArray(state.recentLocations)) state.recentLocations = [];
      }
    } catch {
      state.recentLocations = [];
    }
  }

  function saveRecentLocation(item) {
    if (!item || !item.name) return;
    try {
      const filtered = state.recentLocations.filter(r => 
        r.name.toLowerCase() !== item.name.toLowerCase() ||
        (r.district && item.district && r.district.toLowerCase() !== item.district.toLowerCase())
      );
      filtered.unshift({
        name: item.name,
        locality: item.locality || null,
        district: item.district || '',
        displayName: item.displayName || item.name,
        lat: item.lat,
        lon: item.lon,
        type: item.type || 'locality'
      });
      state.recentLocations = filtered.slice(0, 6);
      localStorage.setItem(RECENT_LOCATIONS_STORAGE_KEY, JSON.stringify(state.recentLocations));
    } catch {
      // Ignore storage errors
    }
  }

  window.clearRecentLocations = function() {
    state.recentLocations = [];
    localStorage.removeItem(RECENT_LOCATIONS_STORAGE_KEY);
    renderRecentLocations();
  };

  function getDistrictDisplayName(id) {
    if (!id || id === 'all') return 'Tamil Nadu';
    if (state.selectedLocation && state.selectedLocation.name) {
      return state.selectedLocation.displayName || state.selectedLocation.name;
    }
    if (state.districtsForecast && state.districtsForecast.length > 0) {
      const found = state.districtsForecast.find(d => 
        (d.district && d.district.id && d.district.id.toLowerCase() === id.toLowerCase()) ||
        (d.district && d.district.name && d.district.name.toLowerCase() === id.toLowerCase())
      );
      if (found && found.district && found.district.name) {
        return found.district.name;
      }
    }
    return id.charAt(0).toUpperCase() + id.slice(1);
  }

  /**
   * Update the auto-detected location notification banner.
   */
  function updateLocationBanner() {
    const banner = document.getElementById('weather-location-banner');
    const switchBtn = document.getElementById('btn-weather-all-districts');
    if (!banner) return;

    if (state.isDetectingLocation) {
      banner.classList.remove('hidden');
      const contentEl = banner.querySelector('.weather-location-banner-content');
      if (contentEl) {
        contentEl.innerHTML = `
          <i class="fa-solid fa-location-crosshairs fa-spin"></i>
          <span>Detecting your live current location...</span>
        `;
      }
      if (switchBtn) switchBtn.style.display = 'none';
      return;
    }

    const selectedName = state.selectedLocation
      ? (state.selectedLocation.locality ? `${state.selectedLocation.locality} (${state.selectedLocation.district})` : state.selectedLocation.name)
      : getDistrictDisplayName(state.district);

    if (state.userDetectedDistrict) {
      banner.classList.remove('hidden');
      const contentEl = banner.querySelector('.weather-location-banner-content');
      const isViewingDetected = Boolean(
        !state.selectedLocation &&
        state.district &&
        state.district.toLowerCase() === state.userDetectedDistrict.toLowerCase()
      );

      if (contentEl) {
        if (state.district === 'all' && !state.selectedLocation) {
          contentEl.innerHTML = `
            <i class="fa-solid fa-globe"></i>
            <span>Showing all 38 districts across Tamil Nadu. Your detected location: <strong>${escapeHtml(state.userDetectedDistrict)}</strong></span>
          `;
        } else if (isViewingDetected) {
          contentEl.innerHTML = `
            <i class="fa-solid fa-location-dot"></i>
            <span>Showing live weather forecast for your location: <strong>${escapeHtml(state.userDetectedDistrict)}</strong></span>
          `;
        } else {
          contentEl.innerHTML = `
            <i class="fa-solid fa-location-dot"></i>
            <span>Showing live weather forecast for: <strong>${escapeHtml(selectedName)}</strong></span>
          `;
        }
      }

      if (switchBtn) {
        switchBtn.style.display = 'inline-flex';
        if (state.district === 'all' && !state.selectedLocation) {
          switchBtn.innerHTML = `<span>Back to ${escapeHtml(state.userDetectedDistrict)}</span> <i class="fa-solid fa-location-crosshairs"></i>`;
          switchBtn.onclick = () => window.selectUserDetectedDistrict();
        } else if (isViewingDetected) {
          switchBtn.innerHTML = `<span>View All 38 Districts</span> <i class="fa-solid fa-arrow-right"></i>`;
          switchBtn.onclick = () => window.resetWeatherFilters();
        } else {
          switchBtn.innerHTML = `<span>Back to ${escapeHtml(state.userDetectedDistrict)}</span> <i class="fa-solid fa-location-crosshairs"></i>`;
          switchBtn.onclick = () => window.selectUserDetectedDistrict();
        }
      }
    } else {
      banner.classList.remove('hidden');
      const contentEl = banner.querySelector('.weather-location-banner-content');
      if (contentEl) {
        if (state.district !== 'all' || state.selectedLocation) {
          contentEl.innerHTML = `
            <i class="fa-solid fa-location-dot"></i>
            <span>Showing live weather forecast for: <strong>${escapeHtml(activeLocationName)}</strong></span>
          `;
        } else {
          contentEl.innerHTML = `
            <i class="fa-solid fa-location-pin"></i>
            <span>Select your locality or district to showcase local weather forecast.</span>
          `;
        }
      }
      if (switchBtn) {
        if (state.district !== 'all' || state.selectedLocation) {
          switchBtn.style.display = 'inline-flex';
          switchBtn.innerHTML = `<span>View All 38 Districts</span> <i class="fa-solid fa-arrow-right"></i>`;
          switchBtn.onclick = () => window.resetWeatherFilters();
        } else {
          switchBtn.style.display = 'none';
        }
      }
    }
  }

  window.selectUserDetectedDistrict = function() {
    if (state.userDetectedDistrict) {
      state.district = state.userDetectedDistrict.toLowerCase();
      state.selectedLocation = null;
      state.userHasManuallyChangedDistrict = false;
      const distSelect = document.getElementById('weather-district-filter');
      if (distSelect) distSelect.value = state.district;
      updateLocationBanner();
      closeSearchPopover();
      fetchWeatherForecast();
    }
  };

  /**
   * Populate districts dropdown dynamically using CrowdCity master location data.
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
      console.warn('[WeatherForecast] Using fallback 38-districts list:', e.message);
    }

    districts = Array.from(new Set(districts)).sort();

    select.innerHTML = '<option value="all" data-i18n="weather_filter_district_all">All Districts (38)</option>';

    districts.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.toLowerCase();
      const isDetected = state.userDetectedDistrict && state.userDetectedDistrict.toLowerCase() === d.toLowerCase();
      opt.textContent = isDetected ? `${d} (Your Location)` : d;
      select.appendChild(opt);
    });

    if (state.district && state.district !== 'all') {
      select.value = state.district;
    }
  }

  function setupEventListeners() {
    // Refresh button
    const refreshBtn = document.getElementById('btn-refresh-weather');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => fetchWeatherForecast(true));
    }

    // Retry buttons
    const retryBtn = document.getElementById('btn-retry-weather');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => fetchWeatherForecast(true));
    }
    const retryErrBtn = document.getElementById('btn-retry-weather-err');
    if (retryErrBtn) {
      retryErrBtn.addEventListener('click', () => fetchWeatherForecast(true));
    }

    // District select dropdown
    const distSelect = document.getElementById('weather-district-filter');
    if (distSelect) {
      distSelect.addEventListener('change', (e) => {
        state.district = e.target.value.toLowerCase();
        state.selectedLocation = null;
        state.userHasManuallyChangedDistrict = true;
        updateLocationBanner();
        updateSelectedDistrictView();
        fetchWeatherForecast();
      });
    }
  }

  /**
   * Premium Location Search & Suggestions Setup.
   */
  function setupLocationSearch() {
    const searchInput = document.getElementById('weather-search-input');
    const clearBtn = document.getElementById('weather-search-clear-btn');
    const popover = document.getElementById('weather-search-popover');
    if (!searchInput) return;

    renderQuickDistricts();
    renderRecentLocations();

    let debounceTimer = null;

    searchInput.addEventListener('focus', () => {
      openSearchPopover();
      if (!searchInput.value.trim()) {
        showDefaultPopoverViews();
      }
    });

    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.trim();
      state.searchQuery = q.toLowerCase();

      if (clearBtn) {
        if (q.length > 0) clearBtn.classList.remove('hidden');
        else clearBtn.classList.add('hidden');
      }

      openSearchPopover();

      if (q.length < 2) {
        showDefaultPopoverViews();
        // If empty, let local overview filter immediately
        if (q.length === 0) {
          renderView();
        }
        return;
      }

      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        performAsyncLocationSearch(q);
      }, 220);
    });

    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeSearchPopover();
      }
    });

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        state.searchQuery = '';
        clearBtn.classList.add('hidden');
        showDefaultPopoverViews();
        renderView();
        searchInput.focus();
      });
    }

    const useMyLocBtn = document.getElementById('btn-use-my-location');
    if (useMyLocBtn) {
      useMyLocBtn.addEventListener('click', () => window.useCurrentLocation());
    }

    const backDetectedBtn = document.getElementById('btn-back-detected');
    if (backDetectedBtn) {
      backDetectedBtn.addEventListener('click', () => window.selectUserDetectedDistrict());
    }

    // Close popover when clicking outside
    document.addEventListener('click', (e) => {
      const wrapper = document.getElementById('weather-search-wrapper');
      if (wrapper && !wrapper.contains(e.target)) {
        closeSearchPopover();
      }
    });
  }

  function openSearchPopover() {
    const popover = document.getElementById('weather-search-popover');
    if (popover) popover.classList.remove('hidden');

    const backText = document.getElementById('popover-back-detected-text');
    if (backText) {
      backText.textContent = state.userDetectedDistrict
        ? `Back to ${state.userDetectedDistrict}`
        : 'Back to Detected Location';
    }
  }

  function closeSearchPopover() {
    const popover = document.getElementById('weather-search-popover');
    if (popover) popover.classList.add('hidden');
  }

  function showDefaultPopoverViews() {
    const resultsSec = document.getElementById('popover-results-section');
    const recentsSec = document.getElementById('popover-recents-section');
    const districtsSec = document.getElementById('popover-quick-districts-section');

    if (resultsSec) resultsSec.classList.add('hidden');
    if (recentsSec) {
      if (state.recentLocations.length > 0) recentsSec.classList.remove('hidden');
      else recentsSec.classList.add('hidden');
    }
    if (districtsSec) districtsSec.classList.remove('hidden');
  }

  function renderQuickDistricts() {
    const container = document.getElementById('popover-district-chips');
    if (!container) return;

    container.innerHTML = MAJOR_CITIES_CHIPS.map(c => `
      <button type="button" class="popover-chip" onclick="selectQuickDistrict('${escapeHtml(c.id)}', '${escapeHtml(c.name)}')">
        ${escapeHtml(c.name)}
      </button>
    `).join('');
  }

  function renderRecentLocations() {
    const container = document.getElementById('popover-recents-list');
    const section = document.getElementById('popover-recents-section');
    if (!container || !section) return;

    if (state.recentLocations.length === 0) {
      section.classList.add('hidden');
      container.innerHTML = '';
      return;
    }

    section.classList.remove('hidden');
    container.innerHTML = state.recentLocations.map((item, idx) => `
      <div class="popover-result-item" onclick="selectRecentLocationIndex(${idx})">
        <div class="popover-result-left">
          <i class="fa-regular fa-clock"></i>
          <div class="popover-result-text">
            <span class="popover-result-name">${escapeHtml(item.name)}</span>
            <span class="popover-result-meta">${escapeHtml(item.district ? `${item.district}, Tamil Nadu` : 'Tamil Nadu')}</span>
          </div>
        </div>
        <span class="popover-result-badge">${item.locality ? 'Locality' : 'District'}</span>
      </div>
    `).join('');
  }

  window.selectQuickDistrict = function(districtId, districtName) {
    state.district = districtId.toLowerCase();
    state.selectedLocation = {
      name: districtName,
      locality: null,
      district: districtName,
      displayName: `${districtName}, Tamil Nadu`,
      lat: null,
      lon: null,
      type: 'district'
    };
    state.userHasManuallyChangedDistrict = true;
    saveRecentLocation(state.selectedLocation);

    const distSelect = document.getElementById('weather-district-filter');
    if (distSelect) distSelect.value = state.district;

    const searchInput = document.getElementById('weather-search-input');
    if (searchInput) searchInput.value = districtName;

    closeSearchPopover();
    updateLocationBanner();
    fetchWeatherForecast();
  };

  window.selectRecentLocationIndex = function(idx) {
    const item = state.recentLocations[idx];
    if (!item) return;
    selectLocation(item);
  };

  async function performAsyncLocationSearch(query) {
    const spinner = document.getElementById('weather-search-spinner');
    const resultsSec = document.getElementById('popover-results-section');
    const resultsList = document.getElementById('popover-results-list');
    const recentsSec = document.getElementById('popover-recents-section');
    const districtsSec = document.getElementById('popover-quick-districts-section');

    if (spinner) spinner.classList.remove('hidden');

    try {
      const url = `/api/public-pulse/weather/search?q=${encodeURIComponent(query)}&district=${encodeURIComponent(state.district || '')}`;
      const res = await fetch(url);
      const data = await res.json();

      if (spinner) spinner.classList.add('hidden');

      if (data && Array.isArray(data.results) && data.results.length > 0) {
        if (recentsSec) recentsSec.classList.add('hidden');
        if (districtsSec) districtsSec.classList.add('hidden');
        if (resultsSec) resultsSec.classList.remove('hidden');

        resultsList.innerHTML = data.results.map(r => `
          <div class="popover-result-item" onclick="selectLocationRecord('${encodeURIComponent(JSON.stringify(r))}')">
            <div class="popover-result-left">
              <i class="fa-solid fa-location-dot"></i>
              <div class="popover-result-text">
                <span class="popover-result-name">${escapeHtml(r.name)}</span>
                <span class="popover-result-meta">${escapeHtml(r.subtitle || `${r.district}, Tamil Nadu`)}</span>
              </div>
            </div>
            <span class="popover-result-badge">${r.type === 'locality' ? 'Locality' : 'District'}</span>
          </div>
        `).join('');
      } else {
        if (resultsSec) resultsSec.classList.remove('hidden');
        resultsList.innerHTML = `
          <div style="padding: 0.75rem; text-align: center; color: var(--text-muted, #64748b); font-size: 0.8rem;">
            No localities or districts found for "${escapeHtml(query)}".
          </div>
        `;
      }
    } catch (err) {
      if (spinner) spinner.classList.add('hidden');
      console.warn('[LocationSearch] Query failed:', err.message);
    }
  }

  window.selectLocationRecord = function(encodedStr) {
    try {
      const r = JSON.parse(decodeURIComponent(encodedStr));
      selectLocation(r);
    } catch (e) {
      console.error('Failed to parse selected location:', e);
    }
  };

  function selectLocation(loc) {
    state.selectedLocation = loc;
    if (loc.district) {
      state.district = loc.district.toLowerCase();
    }
    state.userHasManuallyChangedDistrict = true;
    saveRecentLocation(loc);

    const distSelect = document.getElementById('weather-district-filter');
    if (distSelect && state.district) {
      distSelect.value = state.district;
    }

    const searchInput = document.getElementById('weather-search-input');
    if (searchInput) {
      searchInput.value = loc.displayName || loc.name;
    }

    closeSearchPopover();
    updateLocationBanner();
    fetchWeatherForecast();
  }

  window.focusLocationSearch = function() {
    const input = document.getElementById('weather-search-input');
    if (input) {
      input.focus();
      input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  window.useCurrentLocation = async function() {
    state.isDetectingLocation = true;
    updateLocationBanner();
    closeSearchPopover();

    if (window.CrowdCityLocation && typeof window.CrowdCityLocation.detectUserDistrict === 'function') {
      try {
        const detected = await window.CrowdCityLocation.detectUserDistrict({ timeoutMs: 5000, requestGps: true });
        if (detected) {
          state.userDetectedDistrict = detected;
          state.district = detected.toLowerCase();
          state.selectedLocation = null;
          state.userHasManuallyChangedDistrict = false;
        }
      } catch {
        // Fallback
      }
    }

    state.isDetectingLocation = false;
    updateLocationBanner();
    fetchWeatherForecast();
  };

  function setRetryLoading(isLoading) {
    const refreshBtn = document.getElementById('btn-refresh-weather');
    const refreshIcon = document.getElementById('refresh-weather-icon');
    if (refreshBtn) refreshBtn.disabled = isLoading;
    if (refreshIcon) {
      if (isLoading) refreshIcon.classList.add('fa-spin');
      else refreshIcon.classList.remove('fa-spin');
    }

    const retryBtn = document.getElementById('btn-retry-weather');
    const retryIcon = document.getElementById('retry-weather-icon');
    const retryText = document.getElementById('retry-weather-text');
    if (retryBtn) retryBtn.disabled = isLoading;
    if (retryIcon) {
      retryIcon.style.display = isLoading ? 'inline-block' : 'none';
      if (isLoading) retryIcon.classList.add('fa-spin');
      else retryIcon.classList.remove('fa-spin');
    }
    if (retryText) retryText.textContent = isLoading ? 'Retrying...' : 'Retry';

    const retryErrBtn = document.getElementById('btn-retry-weather-err');
    const retryErrIcon = document.getElementById('retry-weather-err-icon');
    const retryErrText = document.getElementById('retry-weather-err-text');
    if (retryErrBtn) retryErrBtn.disabled = isLoading;
    if (retryErrIcon) {
      retryErrIcon.style.display = isLoading ? 'inline-block' : 'none';
      if (isLoading) retryErrIcon.classList.add('fa-spin');
      else retryErrIcon.classList.remove('fa-spin');
    }
    if (retryErrText) retryErrText.textContent = isLoading ? 'Retrying...' : 'Retry';
  }

  window.setWeatherTimeframeTab = function(tabKey) {
    state.dateTab = tabKey;

    document.querySelectorAll('.weather-tab-btn').forEach(btn => {
      if (btn.dataset.tab === tabKey) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    renderView();
  };

  window.resetWeatherFilters = function() {
    state.district = 'all';
    state.selectedLocation = null;
    state.dateTab = 'all';
    state.searchQuery = '';
    state.userHasManuallyChangedDistrict = true;

    const distSelect = document.getElementById('weather-district-filter');
    if (distSelect) distSelect.value = 'all';

    const searchInput = document.getElementById('weather-search-input');
    if (searchInput) searchInput.value = '';

    window.setWeatherTimeframeTab('all');
    updateLocationBanner();
    updateSelectedDistrictView();
    fetchWeatherForecast();
  };

  /**
   * Fetch weather forecast from CrowdCity backend endpoint.
   */
  async function fetchWeatherForecast(forceRefresh = false) {
    if (state.isLoading) return;
    state.isLoading = true;
    setRetryLoading(true);

    const heroContainer = document.getElementById('current-weather-container');
    const forecastGrid = document.getElementById('weather-forecast-container');

    if (state.districtsForecast.length === 0) {
      if (heroContainer) heroContainer.innerHTML = getHeroSkeletonHtml();
      if (forecastGrid) forecastGrid.innerHTML = getForecastSkeletonHtml();
    }

    try {
      let url = '/api/public-pulse/weather';
      const params = new URLSearchParams();

      if (forceRefresh) {
        params.append('refresh', 'true');
      }

      // If specific locality/region coordinates selected
      if (state.selectedLocation && typeof state.selectedLocation.lat === 'number' && typeof state.selectedLocation.lon === 'number') {
        params.append('lat', state.selectedLocation.lat);
        params.append('lon', state.selectedLocation.lon);
        if (state.selectedLocation.locality) {
          params.append('locality', state.selectedLocation.locality);
        }
        if (state.selectedLocation.district) {
          params.append('district', state.selectedLocation.district);
        }
        if (state.selectedLocation.displayName) {
          params.append('displayName', state.selectedLocation.displayName);
        }
      } else if (state.district && state.district !== 'all') {
        params.append('district', state.district);
      }

      const qs = params.toString();
      if (qs) url += `?${qs}`;

      const res = await fetch(url);
      const data = await res.json();

      state.sourceAvailable = Boolean(data.source_available);
      state.isStale = Boolean(data.is_stale);
      state.lastUpdatedIST = data.last_updated_ist || null;
      state.districtsForecast = data.districts_forecast || [];

      if (data.current_district) {
        state.currentDistrict = data.current_district;
      }
      if (Array.isArray(data.hourly)) {
        state.hourlyForecast = data.hourly;
      } else if (data.current_district && Array.isArray(data.current_district.hourly)) {
        state.hourlyForecast = data.current_district.hourly;
      } else {
        state.hourlyForecast = [];
      }

      if (Array.isArray(data.insights)) {
        state.weatherInsights = data.insights;
      } else if (data.current_district && Array.isArray(data.current_district.insights)) {
        state.weatherInsights = data.current_district.insights;
      } else {
        state.weatherInsights = [];
      }

      if (data.location && state.selectedLocation) {
        state.selectedLocation = {
          ...state.selectedLocation,
          ...data.location
        };
      }

      if (state.sourceAvailable && (state.districtsForecast.length > 0 || state.currentDistrict)) {
        const errorState = document.getElementById('weather-error-state');
        const sourceUnavailableBox = document.getElementById('weather-source-unavailable-box');
        if (errorState) errorState.classList.add('hidden');
        if (sourceUnavailableBox) sourceUnavailableBox.classList.add('hidden');
      }

      updateSelectedDistrictView();
      updateLocationBanner();
      updateHeaderStatus();
      renderView();
      renderHourlyForecast();
      renderWeatherInsights();
    } catch (err) {
      console.error('[WeatherForecast] Fetch error:', err);
      state.sourceAvailable = false;
      showErrorState('Unable to connect to the weather forecast service.');
    } finally {
      state.isLoading = false;
      setRetryLoading(false);
    }
  }

  // Export fetchWeatherForecast to window for inline onclick handlers & external scripts
  window.fetchWeatherForecast = fetchWeatherForecast;

  function updateSelectedDistrictView() {
    if (state.districtsForecast.length === 0 && !state.currentDistrict) {
      state.currentDistrict = null;
      return;
    }

    // If specific locality weather is loaded into state.currentDistrict, preserve it!
    if (state.selectedLocation && state.currentDistrict && state.currentDistrict.district) {
      return;
    }

    if (state.district !== 'all') {
      const found = state.districtsForecast.find(d => 
        d.district.id.toLowerCase() === state.district ||
        d.district.name.toLowerCase() === state.district
      );
      state.currentDistrict = found || state.districtsForecast[0];
    } else {
      let preferred = null;
      if (state.userDetectedDistrict) {
        preferred = state.districtsForecast.find(d => 
          d.district.id.toLowerCase() === state.userDetectedDistrict.toLowerCase() ||
          d.district.name.toLowerCase() === state.userDetectedDistrict.toLowerCase()
        );
      }
      state.currentDistrict = preferred || state.districtsForecast[0];
    }
  }

  function updateHeaderStatus() {
    const updatedEl = document.getElementById('weather-last-updated-text');
    const staleNoticeEl = document.getElementById('weather-stale-badge');

    if (updatedEl) {
      const prefix = window.i18n ? window.i18n.t('weather_last_updated') : 'Updated';
      updatedEl.textContent = state.lastUpdatedIST ? `${prefix} ${state.lastUpdatedIST}` : '--';
    }

    if (staleNoticeEl) {
      if (state.isStale && state.districtsForecast.length > 0) {
        staleNoticeEl.classList.remove('hidden');
      } else {
        staleNoticeEl.classList.add('hidden');
      }
    }
  }

  /**
   * Render view based on active filters and state.
   */
  function renderView() {
    const errorState = document.getElementById('weather-error-state');
    const sourceUnavailableBox = document.getElementById('weather-source-unavailable-box');
    const emptyState = document.getElementById('weather-empty-state');
    const heroContainer = document.getElementById('current-weather-container');
    const forecastContainer = document.getElementById('weather-forecast-container');
    const allDistrictsSection = document.getElementById('all-districts-section-wrap');
    const allDistrictsGrid = document.getElementById('all-districts-grid-container');
    const forecastSectionHeading = document.getElementById('forecast-section-heading');

    if (errorState) errorState.classList.add('hidden');

    if (!state.sourceAvailable && state.districtsForecast.length === 0 && !state.currentDistrict) {
      if (heroContainer) heroContainer.innerHTML = '';
      if (forecastContainer) forecastContainer.innerHTML = '';
      if (allDistrictsSection) allDistrictsSection.classList.add('hidden');
      if (emptyState) emptyState.classList.add('hidden');
      if (sourceUnavailableBox) sourceUnavailableBox.classList.remove('hidden');
      return;
    }

    if (sourceUnavailableBox) sourceUnavailableBox.classList.add('hidden');

    // Handle search filtering
    let matchingDistricts = [...state.districtsForecast];
    if (state.searchQuery && !state.selectedLocation) {
      matchingDistricts = matchingDistricts.filter(d => 
        d.district.name.toLowerCase().includes(state.searchQuery) ||
        (d.district.nameTa && d.district.nameTa.toLowerCase().includes(state.searchQuery))
      );

      if (matchingDistricts.length === 0) {
        if (heroContainer) heroContainer.innerHTML = '';
        if (forecastContainer) forecastContainer.innerHTML = '';
        if (allDistrictsSection) allDistrictsSection.classList.add('hidden');
        if (emptyState) emptyState.classList.remove('hidden');
        return;
      }
    }

    if (emptyState) emptyState.classList.add('hidden');

    // Target district/location for Hero and 5-Day Forecast
    const targetDistrict = state.currentDistrict || (state.searchQuery && matchingDistricts.length === 1 ? matchingDistricts[0] : null);

    if (heroContainer && targetDistrict) {
      heroContainer.innerHTML = createCurrentWeatherHeroHtml(targetDistrict);
    }

    // 5-Day Forecast Grid for target location
    if (forecastContainer && targetDistrict && targetDistrict.daily) {
      let filteredDaily = [...targetDistrict.daily];

      if (state.dateTab === 'today') {
        filteredDaily = filteredDaily.filter(d => d.day_index === 1);
      } else if (state.dateTab === 'tomorrow') {
        filteredDaily = filteredDaily.filter(d => d.day_index === 2);
      } else if (state.dateTab === 'day3') {
        filteredDaily = filteredDaily.filter(d => d.day_index === 3);
      } else if (state.dateTab === 'day4') {
        filteredDaily = filteredDaily.filter(d => d.day_index === 4);
      } else if (state.dateTab === 'day5') {
        filteredDaily = filteredDaily.filter(d => d.day_index === 5);
      }

      const activeName = state.selectedLocation?.locality || targetDistrict.district.locality || targetDistrict.district.name;

      forecastContainer.innerHTML = filteredDaily.map(item => 
        createForecastCardHtml(activeName, item)
      ).join('');

      if (forecastSectionHeading) {
        const timeframeLabel = state.dateTab === 'all' ? '5-Day Forecast' : `${filteredDaily[0]?.day_label || 'Day'} Forecast`;
        forecastSectionHeading.textContent = `${activeName} · ${timeframeLabel}`;
      }
    }

    // 38-District Overview Grid
    if (allDistrictsSection && allDistrictsGrid) {
      if (state.district === 'all' && !state.selectedLocation) {
        allDistrictsSection.classList.remove('hidden');
        let sortedDistricts = [...matchingDistricts];
        if (state.userDetectedDistrict && !state.searchQuery) {
          const userIdx = sortedDistricts.findIndex(d => 
            d.district.name.toLowerCase() === state.userDetectedDistrict.toLowerCase() ||
            d.district.id.toLowerCase() === state.userDetectedDistrict.toLowerCase()
          );
          if (userIdx > -1) {
            const [userItem] = sortedDistricts.splice(userIdx, 1);
            sortedDistricts.unshift(userItem);
          }
        }
        allDistrictsGrid.innerHTML = sortedDistricts.map(item => createDistrictOverviewCardHtml(item)).join('');
      } else {
        allDistrictsSection.classList.add('hidden');
      }
    }
  }

  /**
   * Determine CSS condition class & dynamic animation parameters.
   */
  function getWeatherSceneDetails(weatherCode, isDay = 1) {
    const code = Number(weatherCode) || 0;
    const isDayBool = Boolean(isDay);

    if (code >= 95) {
      return { className: 'weather-scene-thunderstorm', type: 'thunderstorm' };
    }
    if (code === 65 || code === 82) {
      return { className: 'weather-scene-heavy-rain', type: 'heavy_rain' };
    }
    if ((code >= 61 && code <= 63) || (code >= 80 && code <= 81)) {
      return { className: 'weather-scene-rain', type: 'rain' };
    }
    if (code >= 51 && code <= 57) {
      return { className: 'weather-scene-rain', type: 'drizzle' };
    }
    if (code === 45 || code === 48) {
      return { className: 'weather-scene-fog', type: 'fog' };
    }
    if (code <= 1) {
      return {
        className: isDayBool ? 'weather-scene-day-clear' : 'weather-scene-night-clear',
        type: isDayBool ? 'clear_day' : 'clear_night'
      };
    }
    return {
      className: isDayBool ? 'weather-scene-day-cloudy' : 'weather-scene-night-cloudy',
      type: isDayBool ? 'cloudy_day' : 'cloudy_night'
    };
  }

  /**
   * Generate lightweight HTML for condition-aware background FX layer.
   */
  function generateWeatherFxHtml(sceneType) {
    // Check prefers-reduced-motion
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return '<div class="weather-fx-layer"></div>';
    }

    if (sceneType === 'rain' || sceneType === 'drizzle') {
      const count = sceneType === 'drizzle' ? 16 : 28;
      const drops = Array.from({ length: count }, (_, i) => {
        const left = Math.round((i * (100 / count)) + (Math.random() * 3));
        const delay = (Math.random() * 0.8).toFixed(2);
        const duration = (0.65 + Math.random() * 0.25).toFixed(2);
        return `<div class="rain-drop" style="left: ${left}%; animation-delay: -${delay}s; animation-duration: ${duration}s;"></div>`;
      }).join('');
      return `<div class="weather-fx-layer">${drops}</div>`;
    }

    if (sceneType === 'heavy_rain') {
      const drops = Array.from({ length: 40 }, (_, i) => {
        const left = Math.round((i * 2.5) + (Math.random() * 2));
        const delay = (Math.random() * 0.7).toFixed(2);
        const duration = (0.5 + Math.random() * 0.2).toFixed(2);
        return `<div class="rain-drop" style="left: ${left}%; animation-delay: -${delay}s; animation-duration: ${duration}s; height: 32px;"></div>`;
      }).join('');
      return `<div class="weather-fx-layer">${drops}</div>`;
    }

    if (sceneType === 'thunderstorm') {
      const drops = Array.from({ length: 30 }, (_, i) => {
        const left = Math.round((i * 3.3) + (Math.random() * 2));
        const delay = (Math.random() * 0.7).toFixed(2);
        return `<div class="rain-drop" style="left: ${left}%; animation-delay: -${delay}s;"></div>`;
      }).join('');
      return `
        <div class="weather-fx-layer">
          <div class="lightning-flash"></div>
          ${drops}
        </div>
      `;
    }

    if (sceneType === 'clear_day') {
      return `
        <div class="weather-fx-layer">
          <div class="sun-glow-core"></div>
        </div>
      `;
    }

    if (sceneType === 'clear_night') {
      const stars = Array.from({ length: 22 }, () => {
        const left = Math.round(Math.random() * 96);
        const top = Math.round(Math.random() * 85);
        const delay = (Math.random() * 3).toFixed(2);
        const duration = (2 + Math.random() * 2).toFixed(2);
        return `<div class="star-particle" style="left: ${left}%; top: ${top}%; animation-delay: -${delay}s; animation-duration: ${duration}s;"></div>`;
      }).join('');
      return `<div class="weather-fx-layer">${stars}</div>`;
    }

    if (sceneType === 'cloudy_day' || sceneType === 'cloudy_night') {
      return `
        <div class="weather-fx-layer">
          <div class="cloud-drifter" style="top: 15px; width: 140px; height: 38px; animation-duration: 38s; animation-delay: -5s;"></div>
          <div class="cloud-drifter" style="top: 80px; width: 220px; height: 50px; animation-duration: 52s; animation-delay: -22s;"></div>
          <div class="cloud-drifter" style="top: 150px; width: 160px; height: 42px; animation-duration: 44s; animation-delay: -12s;"></div>
        </div>
      `;
    }

    if (sceneType === 'fog') {
      return `
        <div class="weather-fx-layer">
          <div class="fog-wave" style="top: 25%;"></div>
          <div class="fog-wave" style="top: 65%; animation-delay: -6s;"></div>
        </div>
      `;
    }

    return '<div class="weather-fx-layer"></div>';
  }

  /**
   * HTML Template: Apple Weather Inspired Atmospheric Weather Hero.
   */
  function createCurrentWeatherHeroHtml(item) {
    const dist = item.district;
    const curr = item.current;
    const today = item.daily && item.daily[0] ? item.daily[0] : null;

    const scene = getWeatherSceneDetails(curr.weather_code, curr.is_day);
    const fxHtml = generateWeatherFxHtml(scene.type);

    const tempDisplay = curr.temperature_c !== null ? `${Math.round(curr.temperature_c)}` : '--';
    const feelsLikeDisplay = curr.apparent_temperature_c !== null ? `${Math.round(curr.apparent_temperature_c)}°` : '--';
    const highLowDisplay = today && typeof today.temperature_max_c === 'number'
      ? `H: ${Math.round(today.temperature_max_c)}° · L: ${Math.round(today.temperature_min_c)}°`
      : '';

    const rainDisplay = `${curr.precipitation_mm} mm`;
    const humidityDisplay = curr.relative_humidity_pct !== null ? `${curr.relative_humidity_pct}%` : '--';
    const windDisplay = `${curr.wind_speed_kmh} km/h`;
    const gustsDisplay = `${curr.wind_gusts_kmh} km/h`;
    const visibilityDisplay = typeof curr.visibility_km === 'number' ? `${curr.visibility_km} km` : '10 km';

    const localityTitle = state.selectedLocation?.locality || dist.locality || dist.name;
    const regionSubtitle = dist.locality && dist.name !== dist.locality
      ? `${dist.name}, Tamil Nadu`
      : 'Tamil Nadu';

    const lastUpdated = state.lastUpdatedIST ? `Updated ${state.lastUpdatedIST}` : 'Live';

    return `
      <section class="current-weather-panel ${escapeHtml(scene.className)}">
        ${fxHtml}

        <div class="weather-hero-content">
          <div class="hero-top-row">
            <div class="hero-location-block">
              <span class="hero-live-pill">
                <span class="pulse-dot"></span> LIVE WEATHER
              </span>
              <div class="hero-location-title-row">
                <h2 class="hero-locality-name">📍 ${escapeHtml(localityTitle)}</h2>
                <button type="button" class="hero-location-change-btn" onclick="focusLocationSearch()">
                  <i class="fa-solid fa-magnifying-glass-location"></i> Change
                </button>
              </div>
              <p class="hero-region-sub">${escapeHtml(regionSubtitle)}</p>
            </div>
            <span class="hero-updated-badge">${escapeHtml(lastUpdated)}</span>
          </div>

          <div class="hero-main-row">
            <div class="hero-temp-group">
              <div class="hero-huge-temp">
                <span>${escapeHtml(tempDisplay)}</span><span class="deg">°</span>
              </div>
              <div class="hero-condition-text">
                <i class="fa-solid ${escapeHtml(curr.icon_class)}"></i>
                <span>${escapeHtml(curr.condition)}</span>
              </div>
              <div class="hero-feels-like-row">
                <span>Feels like ${escapeHtml(feelsLikeDisplay)}</span>
                ${highLowDisplay ? `<span> · ${escapeHtml(highLowDisplay)}</span>` : ''}
              </div>
            </div>

            <div class="hero-weather-visual" aria-hidden="true">
              <i class="fa-solid ${escapeHtml(curr.icon_class)}"></i>
            </div>
          </div>

          <div class="hero-glass-metrics">
            <div class="glass-metric-tile">
              <span class="metric-tile-header"><i class="fa-solid fa-droplets"></i> Humidity</span>
              <span class="metric-tile-val">${escapeHtml(humidityDisplay)}</span>
              <span class="metric-tile-sub">${curr.relative_humidity_pct >= 80 ? 'High moisture' : 'Comfortable'}</span>
            </div>

            <div class="glass-metric-tile">
              <span class="metric-tile-header"><i class="fa-solid fa-wind"></i> Wind</span>
              <span class="metric-tile-val">${escapeHtml(windDisplay)}</span>
              <span class="metric-tile-sub">Gusts ${escapeHtml(gustsDisplay)}</span>
            </div>

            <div class="glass-metric-tile">
              <span class="metric-tile-header"><i class="fa-solid fa-cloud-rain"></i> Rainfall</span>
              <span class="metric-tile-val">${escapeHtml(rainDisplay)}</span>
              <span class="metric-tile-sub">${today ? `${today.precipitation_probability_pct}% chance` : 'Precipitation'}</span>
            </div>

            <div class="glass-metric-tile">
              <span class="metric-tile-header"><i class="fa-solid fa-eye"></i> Visibility</span>
              <span class="metric-tile-val">${escapeHtml(visibilityDisplay)}</span>
              <span class="metric-tile-sub">${curr.visibility_km >= 10 ? 'Optimal horizon' : 'Moderate'}</span>
            </div>

            <div class="glass-metric-tile">
              <span class="metric-tile-header"><i class="fa-regular fa-sun"></i> Sun Schedule</span>
              <span class="metric-tile-val" style="font-size: 0.95rem;">${escapeHtml(today?.sunrise || '--')}</span>
              <span class="metric-tile-sub">Sunset ${escapeHtml(today?.sunset || '--')}</span>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  /**
   * Render 24-Hour Hourly Forecast Strip.
   */
  function renderHourlyForecast() {
    const section = document.getElementById('hourly-forecast-section');
    const track = document.getElementById('hourly-forecast-track');
    if (!section || !track) return;

    if (!Array.isArray(state.hourlyForecast) || state.hourlyForecast.length === 0) {
      section.style.display = 'none';
      return;
    }

    section.style.display = 'block';

    track.innerHTML = state.hourlyForecast.map((h, idx) => {
      const isActive = h.is_now || idx === 0;
      const label = isActive ? 'Now' : h.hour_label;
      const temp = h.temperature_c !== null ? `${Math.round(h.temperature_c)}°` : '--';
      const rainBadge = h.precipitation_probability_pct > 0
        ? `<span class="hourly-rain-badge"><i class="fa-solid fa-droplet"></i> ${h.precipitation_probability_pct}%</span>`
        : '';

      return `
        <div class="hourly-card ${isActive ? 'active' : ''}">
          <span class="hourly-time">${escapeHtml(label)}</span>
          <i class="fa-solid ${escapeHtml(h.icon_class)} hourly-icon"></i>
          <span class="hourly-temp">${escapeHtml(temp)}</span>
          ${rainBadge}
        </div>
      `;
    }).join('');
  }

  window.scrollHourly = function(offset) {
    const scrollEl = document.getElementById('hourly-scroll-container');
    if (scrollEl) {
      scrollEl.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  /**
   * Render Dynamic Weather Insights Card based strictly on genuine values.
   */
  function renderWeatherInsights() {
    const section = document.getElementById('weather-insights-section');
    const container = document.getElementById('weather-insights-container');
    if (!section || !container) return;

    if (!Array.isArray(state.weatherInsights) || state.weatherInsights.length === 0) {
      section.style.display = 'none';
      return;
    }

    section.style.display = 'block';

    container.innerHTML = state.weatherInsights.map(insight => `
      <div class="weather-insight-card insight-${escapeHtml(insight.type || 'general')}">
        <div class="insight-icon-wrap">
          <i class="fa-solid ${escapeHtml(insight.icon || 'fa-info')}"></i>
        </div>
        <div class="insight-content">
          <span class="insight-title">${escapeHtml(insight.title)}</span>
          <p class="insight-desc">${escapeHtml(insight.desc)}</p>
        </div>
      </div>
    `).join('');
  }

  /**
   * HTML Template: Refined 5-Day Forecast Card with LIVE NOW badge for today.
   */
  function createForecastCardHtml(districtName, item) {
    const isToday = item.day_index === 1;
    const tempMax = item.temperature_max_c !== null ? `${Math.round(item.temperature_max_c)}°C` : '--';
    const tempMin = item.temperature_min_c !== null ? `${Math.round(item.temperature_min_c)}°C` : '--';
    const precipProb = `${item.precipitation_probability_pct}%`;
    const rainSum = `${item.precipitation_sum_mm} mm`;
    const windMax = `${item.wind_speed_max_kmh} km/h`;

    const rainChanceLabel = window.i18n ? window.i18n.t('weather_precip_prob') : 'Rain chance';
    const rainfallLabel = window.i18n ? window.i18n.t('weather_rainfall') : 'Rainfall';
    const maxWindLabel = 'Max wind';
    const sunriseLabel = window.i18n ? window.i18n.t('weather_sunrise') : 'Sunrise';
    const sunsetLabel = window.i18n ? window.i18n.t('weather_sunset') : 'Sunset';

    return `
      <article class="forecast-card ${isToday ? 'forecast-card-today' : ''}">
        ${isToday ? `
          <div class="forecast-live-now-badge">
            <span class="badge-pulse"></span> LIVE NOW
          </div>
        ` : ''}

        <div>
          <div class="forecast-card-header">
            <span class="forecast-day-tag">${escapeHtml(item.day_label)}</span>
            <span class="forecast-date-tag">${escapeHtml(item.date_formatted)}</span>
          </div>

          <div class="forecast-condition-row">
            <i class="fa-solid ${escapeHtml(item.icon_class)}"></i>
            <span class="forecast-condition-text">${escapeHtml(item.condition)}</span>
          </div>

          <div class="forecast-temps-row">
            <span class="forecast-temp-max">${escapeHtml(tempMax)}</span>
            <span class="forecast-temp-min">/ ${escapeHtml(tempMin)}</span>
          </div>

          <div class="forecast-temp-bar-wrap" aria-hidden="true">
            <div class="temp-bar-track"></div>
          </div>

          <div class="forecast-details-list">
            <div class="forecast-detail-row">
              <span class="forecast-detail-label">
                <i class="fa-solid fa-droplet"></i> ${escapeHtml(rainChanceLabel)}
              </span>
              <span class="forecast-detail-val">${escapeHtml(precipProb)}</span>
            </div>

            <div class="forecast-detail-row">
              <span class="forecast-detail-label">
                <i class="fa-solid fa-cloud-rain"></i> ${escapeHtml(rainfallLabel)}
              </span>
              <span class="forecast-detail-val">${escapeHtml(rainSum)}</span>
            </div>

            <div class="forecast-detail-row">
              <span class="forecast-detail-label">
                <i class="fa-solid fa-wind"></i> ${escapeHtml(maxWindLabel)}
              </span>
              <span class="forecast-detail-val">${escapeHtml(windMax)}</span>
            </div>

            <div class="forecast-detail-row">
              <span class="forecast-detail-label">
                <i class="fa-regular fa-sun"></i> ${escapeHtml(sunriseLabel)}
              </span>
              <span class="forecast-detail-val">${escapeHtml(item.sunrise)}</span>
            </div>

            <div class="forecast-detail-row">
              <span class="forecast-detail-label">
                <i class="fa-regular fa-moon"></i> ${escapeHtml(sunsetLabel)}
              </span>
              <span class="forecast-detail-val">${escapeHtml(item.sunset)}</span>
            </div>
          </div>
        </div>

        <div class="forecast-card-footer">
          <span>Source: Open-Meteo</span>
          <button class="weather-btn-share" onclick="shareForecast('${escapeHtml(districtName)}', '${escapeHtml(item.day_label)}', '${escapeHtml(item.date_formatted)}', '${escapeHtml(item.condition)}', '${escapeHtml(tempMax)}', '${escapeHtml(tempMin)}', '${escapeHtml(precipProb)}', '${escapeHtml(rainSum)}')" title="Copy forecast details">
            <i class="fa-regular fa-copy"></i>
            <span>Share</span>
          </button>
        </div>
      </article>
    `;
  }

  /**
   * HTML Template: Compact Overview Card for 38-District Section.
   */
  function createDistrictOverviewCardHtml(item) {
    const dist = item.district;
    const curr = item.current;
    const isDetected = state.userDetectedDistrict && state.userDetectedDistrict.toLowerCase() === dist.name.toLowerCase();

    const tempDisplay = curr.temperature_c !== null ? `${Math.round(curr.temperature_c)}°C` : '--';

    return `
      <div class="district-overview-card ${isDetected ? 'user-district-highlight' : ''}" onclick="selectDistrictFromCard('${escapeHtml(dist.name)}')" title="Click to view ${escapeHtml(dist.name)} forecast">
        <div class="district-card-top">
          <span class="district-card-name">
            ${escapeHtml(dist.name)}
            ${isDetected ? '<i class="fa-solid fa-location-crosshairs user-loc-pin" title="Your detected location"></i>' : ''}
          </span>
          <span class="district-card-temp">${escapeHtml(tempDisplay)}</span>
        </div>
        <div class="district-card-condition">
          <i class="fa-solid ${escapeHtml(curr.icon_class)}"></i>
          <span>${escapeHtml(curr.condition)}</span>
        </div>
        <div class="district-card-bottom">
          <span><i class="fa-solid fa-droplet"></i> ${escapeHtml(curr.precipitation_mm)} mm</span>
          <span><i class="fa-solid fa-wind"></i> ${escapeHtml(curr.wind_speed_kmh)} km/h</span>
        </div>
      </div>
    `;
  }

  window.selectDistrictFromCard = function(districtName) {
    state.district = districtName.toLowerCase();
    state.selectedLocation = null;
    state.userHasManuallyChangedDistrict = true;
    const distSelect = document.getElementById('weather-district-filter');
    if (distSelect) distSelect.value = state.district;
    updateLocationBanner();
    fetchWeatherForecast();

    const hero = document.getElementById('current-weather-container');
    if (hero) {
      hero.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  window.shareForecast = function(district, dayLabel, date, condition, high, low, rainChance, rainSum) {
    const text = `CrowdCity Weather Forecast\nLocation: ${district}\nForecast: ${dayLabel} (${date})\nCondition: ${condition}\nTemperature: High ${high} / Low ${low}\nRain chance: ${rainChance} (${rainSum})\nSource: Open-Meteo\nhttps://open-meteo.com/`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        alert('Weather forecast details copied to clipboard.');
      }).catch(() => {
        prompt('Copy forecast details:', text);
      });
    } else {
      prompt('Copy forecast details:', text);
    }
  };

  function showErrorState(msg) {
    const errorState = document.getElementById('weather-error-state');
    const msgEl = document.getElementById('weather-error-message');
    if (msgEl) msgEl.textContent = msg || 'Weather data unavailable.';
    if (errorState) errorState.classList.remove('hidden');
  }

  function getHeroSkeletonHtml() {
    return `
      <div class="current-weather-panel" style="opacity: 0.6; pointer-events: none; background: #334155;">
        <div style="height: 24px; background: rgba(255,255,255,0.2); border-radius: 6px; width: 30%; margin-bottom: 0.75rem;"></div>
        <div style="height: 54px; background: rgba(255,255,255,0.2); border-radius: 6px; width: 45%; margin-bottom: 1.25rem;"></div>
        <div class="hero-glass-metrics">
          <div style="height: 64px; background: rgba(255,255,255,0.15); border-radius: 12px;"></div>
          <div style="height: 64px; background: rgba(255,255,255,0.15); border-radius: 12px;"></div>
          <div style="height: 64px; background: rgba(255,255,255,0.15); border-radius: 12px;"></div>
          <div style="height: 64px; background: rgba(255,255,255,0.15); border-radius: 12px;"></div>
        </div>
      </div>
    `;
  }

  function getForecastSkeletonHtml() {
    return Array(5).fill(0).map(() => `
      <div class="forecast-card" style="opacity: 0.6; pointer-events: none;">
        <div style="height: 18px; background: var(--border-color, #e2e8f0); border-radius: 6px; width: 45%; margin-bottom: 0.85rem;"></div>
        <div style="height: 24px; background: var(--border-color, #e2e8f0); border-radius: 6px; width: 65%; margin-bottom: 0.85rem;"></div>
        <div style="height: 32px; background: var(--bg-hover, #f1f5f9); border-radius: 6px; width: 100%; margin-bottom: 0.85rem;"></div>
        <div style="height: 16px; background: var(--bg-hover, #f1f5f9); border-radius: 4px; width: 40%;"></div>
      </div>
    `).join('');
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

})();
