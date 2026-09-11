/**
 * weather-alerts.js
 * 
 * Open-Meteo Weather Forecast Client Controller.
 * Powers the Public Pulse > Weather Forecast page.
 * 
 * Strict Integrity & Standards:
 * - Real forecast data from Open-Meteo via CrowdCity backend (/api/public-pulse/weather)
 * - NO emojis anywhere
 * - NO dummy data
 * - WMO weather code mapping
 * - 38 Tamil Nadu districts
 * - Desktop, tablet & mobile responsive
 */

(function() {
  'use strict';

  const state = {
    district: 'all',
    dateTab: 'all',
    searchQuery: '',
    districtsForecast: [],
    currentDistrict: null,
    sourceAvailable: false,
    isStale: false,
    lastUpdatedIST: null,
    isLoading: false
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

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    await populateDistrictsDropdown();
    setupEventListeners();
    await fetchWeatherForecast();
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
      console.warn('[WeatherForecast] Using fallback 38-districts master list:', e.message);
    }

    districts = Array.from(new Set(districts)).sort();

    const currentVal = select.value;
    select.innerHTML = '<option value="all" data-i18n="weather_filter_district_all">All Districts (38)</option>';

    districts.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.toLowerCase();
      opt.textContent = d;
      select.appendChild(opt);
    });

    if (currentVal && (currentVal === 'all' || districts.map(d => d.toLowerCase()).includes(currentVal.toLowerCase()))) {
      select.value = currentVal;
    }
  }

  function setupEventListeners() {
    // Refresh button
    const refreshBtn = document.getElementById('btn-refresh-weather');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => fetchWeatherForecast(true));
    }

    // District select
    const distSelect = document.getElementById('weather-district-filter');
    if (distSelect) {
      distSelect.addEventListener('change', (e) => {
        state.district = e.target.value.toLowerCase();
        updateSelectedDistrictView();
        renderView();
      });
    }

    // Search input
    const searchInput = document.getElementById('weather-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value.trim().toLowerCase();
        renderView();
      });
    }
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
    state.dateTab = 'all';
    state.searchQuery = '';

    const distSelect = document.getElementById('weather-district-filter');
    if (distSelect) distSelect.value = 'all';

    const searchInput = document.getElementById('weather-search-input');
    if (searchInput) searchInput.value = '';

    window.setWeatherTimeframeTab('all');
  };

  /**
   * Fetch weather forecast from CrowdCity backend endpoint.
   */
  async function fetchWeatherForecast(forceRefresh = false) {
    if (state.isLoading) return;
    state.isLoading = true;

    const refreshIcon = document.getElementById('refresh-weather-icon');
    if (refreshIcon) refreshIcon.classList.add('fa-spin');

    const heroContainer = document.getElementById('current-weather-container');
    const forecastGrid = document.getElementById('weather-forecast-container');

    if (state.districtsForecast.length === 0) {
      if (heroContainer) heroContainer.innerHTML = getHeroSkeletonHtml();
      if (forecastGrid) forecastGrid.innerHTML = getForecastSkeletonHtml();
    }

    try {
      const url = `/api/public-pulse/weather${forceRefresh ? '?refresh=true' : ''}`;
      const res = await fetch(url);
      const data = await res.json();

      state.sourceAvailable = Boolean(data.source_available);
      state.isStale = Boolean(data.is_stale);
      state.lastUpdatedIST = data.last_updated_ist || null;
      state.districtsForecast = data.districts_forecast || [];

      // Determine active district
      updateSelectedDistrictView();

      updateHeaderStatus();
      renderView();
    } catch (err) {
      console.error('[WeatherForecast] Fetch error:', err);
      state.sourceAvailable = false;
      showErrorState('Unable to connect to the weather forecast service.');
    } finally {
      state.isLoading = false;
      if (refreshIcon) refreshIcon.classList.remove('fa-spin');
    }
  }

  function updateSelectedDistrictView() {
    if (state.districtsForecast.length === 0) {
      state.currentDistrict = null;
      return;
    }

    if (state.district !== 'all') {
      const found = state.districtsForecast.find(d => 
        d.district.id.toLowerCase() === state.district ||
        d.district.name.toLowerCase() === state.district
      );
      state.currentDistrict = found || state.districtsForecast[0];
    } else {
      // Default to Chennai or first available
      const chennai = state.districtsForecast.find(d => d.district.id.toLowerCase() === 'chennai');
      state.currentDistrict = chennai || state.districtsForecast[0];
    }
  }

  function updateHeaderStatus() {
    const updatedEl = document.getElementById('weather-last-updated-text');
    const staleNoticeEl = document.getElementById('weather-stale-badge');

    if (updatedEl) {
      updatedEl.textContent = state.lastUpdatedIST || 'Unavailable';
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

    if (!state.sourceAvailable && state.districtsForecast.length === 0) {
      if (heroContainer) heroContainer.innerHTML = '';
      if (forecastContainer) forecastContainer.innerHTML = '';
      if (allDistrictsSection) allDistrictsSection.classList.add('hidden');
      if (emptyState) emptyState.classList.add('hidden');
      if (sourceUnavailableBox) sourceUnavailableBox.classList.remove('hidden');
      return;
    }

    if (sourceUnavailableBox) sourceUnavailableBox.classList.add('hidden');

    // Handle search query filtering
    let matchingDistricts = [...state.districtsForecast];
    if (state.searchQuery) {
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

    // Render Current Weather Card
    const targetDistrict = (state.searchQuery && matchingDistricts.length === 1)
      ? matchingDistricts[0]
      : state.currentDistrict;

    if (heroContainer && targetDistrict) {
      heroContainer.innerHTML = createCurrentWeatherHeroHtml(targetDistrict);
    }

    // Render 5-Day Forecast Grid for target district
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

      forecastContainer.innerHTML = filteredDaily.map(item => 
        createForecastCardHtml(targetDistrict.district.name, item)
      ).join('');

      if (forecastSectionHeading) {
        const timeframeLabel = state.dateTab === 'all' ? '5-Day Forecast' : `${filteredDaily[0]?.day_label || 'Day'} Forecast`;
        forecastSectionHeading.innerHTML = `
          <i class="fa-regular fa-calendar-days" style="color: var(--primary);"></i>
          <span>${escapeHtml(targetDistrict.district.name)} &bull; ${escapeHtml(timeframeLabel)}</span>
        `;
      }
    }

    // If "All Districts" is selected, also render the 38-District Overview Grid
    if (allDistrictsSection && allDistrictsGrid) {
      if (state.district === 'all') {
        allDistrictsSection.classList.remove('hidden');
        allDistrictsGrid.innerHTML = matchingDistricts.map(item => createDistrictOverviewCardHtml(item)).join('');
      } else {
        allDistrictsSection.classList.add('hidden');
      }
    }
  }

  /**
   * HTML Template: Current Weather Hero Card.
   */
  function createCurrentWeatherHeroHtml(item) {
    const dist = item.district;
    const curr = item.current;

    const tempDisplay = curr.temperature_c !== null ? `${curr.temperature_c}°C` : '--';
    const feelsLikeDisplay = curr.apparent_temperature_c !== null ? `${curr.apparent_temperature_c}°C` : '--';
    const rainDisplay = `${curr.precipitation_mm} mm`;
    const humidityDisplay = curr.relative_humidity_pct !== null ? `${curr.relative_humidity_pct}%` : '--';
    const windDisplay = `${curr.wind_speed_kmh} km/h`;
    const gustsDisplay = `${curr.wind_gusts_kmh} km/h`;

    return `
      <section class="current-weather-hero">
        <div class="current-weather-header">
          <div>
            <h2 class="current-district-title">
              <i class="fa-solid fa-location-dot" style="color: var(--primary); font-size: 1.1rem;"></i>
              <span>${escapeHtml(dist.name)}</span>
              <span style="font-size: 0.72rem; font-weight: 600; padding: 0.2rem 0.5rem; background: #e0f2fe; color: #0369a1; border-radius: 4px; text-transform: uppercase;">Current Conditions</span>
            </h2>
            <div class="current-temp-block">
              <span class="current-temp-large">${escapeHtml(tempDisplay)}</span>
              <span class="current-condition-badge">
                <i class="fa-solid ${escapeHtml(curr.icon_class)}" style="color: var(--primary);"></i>
                <span>${escapeHtml(curr.condition)}</span>
              </span>
              <span class="current-feels-like">Feels like <strong>${escapeHtml(feelsLikeDisplay)}</strong></span>
            </div>
          </div>

          <div style="text-align: right; font-size: 0.76rem; color: var(--text-muted);">
            <div>Observed at ${escapeHtml(curr.time_ist)}</div>
            <div style="font-weight: 600; color: var(--text-main); margin-top: 0.15rem;">Open-Meteo Live Feed</div>
          </div>
        </div>

        <div class="current-metrics-grid">
          <div class="current-metric-item">
            <span class="current-metric-label">
              <i class="fa-solid fa-cloud-rain" style="color: #0284c7;"></i> Rain
            </span>
            <span class="current-metric-value">${escapeHtml(rainDisplay)}</span>
          </div>

          <div class="current-metric-item">
            <span class="current-metric-label">
              <i class="fa-solid fa-droplet" style="color: #0d9488;"></i> Humidity
            </span>
            <span class="current-metric-value">${escapeHtml(humidityDisplay)}</span>
          </div>

          <div class="current-metric-item">
            <span class="current-metric-label">
              <i class="fa-solid fa-wind" style="color: #64748b;"></i> Wind
            </span>
            <span class="current-metric-value">${escapeHtml(windDisplay)}</span>
          </div>

          <div class="current-metric-item">
            <span class="current-metric-label">
              <i class="fa-solid fa-gauge-high" style="color: #d97706;"></i> Wind Gusts
            </span>
            <span class="current-metric-value">${escapeHtml(gustsDisplay)}</span>
          </div>
        </div>
      </section>
    `;
  }

  /**
   * HTML Template: 5-Day Forecast Card.
   */
  function createForecastCardHtml(districtName, item) {
    const tempMax = item.temperature_max_c !== null ? `${item.temperature_max_c}°C` : '--';
    const tempMin = item.temperature_min_c !== null ? `${item.temperature_min_c}°C` : '--';
    const precipProb = `${item.precipitation_probability_pct}%`;
    const rainSum = `${item.precipitation_sum_mm} mm`;
    const windMax = `${item.wind_speed_max_kmh} km/h`;
    const gustsMax = `${item.wind_gusts_max_kmh} km/h`;

    return `
      <article class="forecast-card">
        <div>
          <div class="forecast-card-header">
            <span class="forecast-day-tag">${escapeHtml(item.day_label)}</span>
            <span class="forecast-date-tag">${escapeHtml(item.date_formatted)}</span>
          </div>

          <div class="forecast-condition-row">
            <div class="forecast-icon-wrap">
              <i class="fa-solid ${escapeHtml(item.icon_class)}"></i>
            </div>
            <div class="forecast-condition-text">${escapeHtml(item.condition)}</div>
          </div>

          <div class="forecast-temps-row">
            <span class="forecast-temp-max">${escapeHtml(tempMax)}</span>
            <span class="forecast-temp-min">/ ${escapeHtml(tempMin)}</span>
          </div>

          <div class="forecast-details-list">
            <div class="forecast-detail-row">
              <span class="forecast-detail-label">
                <i class="fa-solid fa-umbrella" style="color: #0284c7; width: 14px;"></i> Rain Chance
              </span>
              <span class="forecast-detail-val">${escapeHtml(precipProb)}</span>
            </div>

            <div class="forecast-detail-row">
              <span class="forecast-detail-label">
                <i class="fa-solid fa-cloud-showers-heavy" style="color: #0d9488; width: 14px;"></i> Rainfall
              </span>
              <span class="forecast-detail-val">${escapeHtml(rainSum)}</span>
            </div>

            <div class="forecast-detail-row">
              <span class="forecast-detail-label">
                <i class="fa-solid fa-wind" style="color: #64748b; width: 14px;"></i> Max Wind
              </span>
              <span class="forecast-detail-val">${escapeHtml(windMax)}</span>
            </div>

            <div class="forecast-detail-row">
              <span class="forecast-detail-label">
                <i class="fa-solid fa-sun" style="color: #f59e0b; width: 14px;"></i> Sun Times
              </span>
              <span class="forecast-detail-val">${escapeHtml(item.sunrise)} &bull; ${escapeHtml(item.sunset)}</span>
            </div>
          </div>
        </div>

        <div class="forecast-card-footer">
          <span style="font-size: 0.72rem; color: #94a3b8;">Source: Open-Meteo</span>
          <button class="weather-btn-share" onclick="shareForecast('${escapeHtml(districtName)}', '${escapeHtml(item.day_label)}', '${escapeHtml(item.date_formatted)}', '${escapeHtml(item.condition)}', '${escapeHtml(tempMax)}', '${escapeHtml(tempMin)}', '${escapeHtml(precipProb)}', '${escapeHtml(rainSum)}')" title="Copy forecast details">
            <i class="fa-regular fa-copy"></i>
            <span>Share</span>
          </button>
        </div>
      </article>
    `;
  }

  /**
   * HTML Template: Compact Overview Card for 38-Districts Grid.
   */
  function createDistrictOverviewCardHtml(item) {
    const dist = item.district;
    const curr = item.current;
    const todayDaily = (item.daily && item.daily[0]) || {};

    const tempDisplay = curr.temperature_c !== null ? `${curr.temperature_c}°C` : '--';
    const rainProb = todayDaily.precipitation_probability_pct !== undefined ? `${todayDaily.precipitation_probability_pct}%` : '--';

    return `
      <div class="district-overview-card" onclick="selectDistrict('${escapeHtml(dist.id)}')">
        <div class="district-overview-top">
          <div>
            <div class="district-overview-name">${escapeHtml(dist.name)}</div>
            <div class="district-overview-condition">
              <i class="fa-solid ${escapeHtml(curr.icon_class)}" style="color: var(--primary); margin-right: 0.25rem;"></i>
              ${escapeHtml(curr.condition)}
            </div>
          </div>
          <div class="district-overview-temp">${escapeHtml(tempDisplay)}</div>
        </div>

        <div class="district-overview-bottom">
          <span>Rain Chance: <strong>${escapeHtml(rainProb)}</strong></span>
          <span>Wind: <strong>${escapeHtml(curr.wind_speed_kmh)} km/h</strong></span>
        </div>
      </div>
    `;
  }

  window.selectDistrict = function(districtId) {
    state.district = districtId.toLowerCase();
    const select = document.getElementById('weather-district-filter');
    if (select) select.value = state.district;

    updateSelectedDistrictView();
    renderView();

    // Smooth scroll to top of current weather
    const hero = document.getElementById('current-weather-container');
    if (hero) {
      hero.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  window.shareForecast = function(district, dayLabel, date, condition, high, low, rainChance, rainSum) {
    const text = `CrowdCity Weather Forecast\nDistrict: ${district}\nForecast: ${dayLabel} (${date})\nCondition: ${condition}\nTemperature: High ${high} / Low ${low}\nRain Chance: ${rainChance} (${rainSum})\nSource: Open-Meteo\nhttps://open-meteo.com/`;
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
    if (msgEl) msgEl.textContent = msg || 'Weather forecast data is temporarily unavailable.';
    if (errorState) errorState.classList.remove('hidden');
  }

  function getHeroSkeletonHtml() {
    return `
      <div class="current-weather-hero" style="opacity: 0.6; pointer-events: none;">
        <div style="height: 24px; background: #e2e8f0; border-radius: 6px; width: 35%; margin-bottom: 1rem;"></div>
        <div style="height: 40px; background: #e2e8f0; border-radius: 6px; width: 50%; margin-bottom: 1.5rem;"></div>
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.85rem;">
          <div style="height: 50px; background: #f1f5f9; border-radius: 6px;"></div>
          <div style="height: 50px; background: #f1f5f9; border-radius: 6px;"></div>
          <div style="height: 50px; background: #f1f5f9; border-radius: 6px;"></div>
          <div style="height: 50px; background: #f1f5f9; border-radius: 6px;"></div>
        </div>
      </div>
    `;
  }

  function getForecastSkeletonHtml() {
    return Array(5).fill(0).map(() => `
      <div class="forecast-card" style="opacity: 0.6; pointer-events: none;">
        <div style="height: 20px; background: #e2e8f0; border-radius: 6px; width: 45%; margin-bottom: 1rem;"></div>
        <div style="height: 32px; background: #e2e8f0; border-radius: 6px; width: 70%; margin-bottom: 1rem;"></div>
        <div style="height: 40px; background: #f1f5f9; border-radius: 6px; width: 100%; margin-bottom: 1rem;"></div>
        <div style="height: 20px; background: #f1f5f9; border-radius: 4px; width: 50%;"></div>
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
