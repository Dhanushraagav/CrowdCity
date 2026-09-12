/**
 * weather-alerts.js
 * 
 * Open-Meteo Weather Forecast Client Controller.
 * Powers the Public Pulse > Weather Forecast page.
 * 
 * Strict Standards:
 * - Real forecast data from Open-Meteo via CrowdCity backend (/api/public-pulse/weather)
 * - Clean, professional government-grade UI
 * - NO emojis anywhere
 * - Functional icons only
 * - 38 Tamil Nadu districts
 * - Desktop (4 col), tablet (2 col), mobile (1 col) responsive
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

    // 2. If no district was found in local storage, trigger immediate GPS detection
    if (!state.userDetectedDistrict) {
      state.isDetectingLocation = true;
      if (window.CrowdCityLocation && typeof window.CrowdCityLocation.detectUserDistrict === 'function') {
        window.CrowdCityLocation.detectUserDistrict({ timeoutMs: 5000, requestGps: true }).then(gpsDistrict => {
          state.isDetectingLocation = false;
          if (gpsDistrict && !state.userHasManuallyChangedDistrict) {
            state.userDetectedDistrict = gpsDistrict;
            state.district = gpsDistrict.toLowerCase();
            const distSelect = document.getElementById('weather-district-filter');
            if (distSelect) distSelect.value = state.district;
            updateLocationBanner();
            updateSelectedDistrictView();
            renderView();
          } else {
            updateLocationBanner();
          }
        });
      }
    }

    await populateDistrictsDropdown();
    setupEventListeners();
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
      state.isDetectingLocation = false;
      const distSelect = document.getElementById('weather-district-filter');
      if (distSelect) distSelect.value = state.district;
      updateLocationBanner();
      updateSelectedDistrictView();
      renderView();
    }
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

    if (state.userDetectedDistrict) {
      banner.classList.remove('hidden');
      const contentEl = banner.querySelector('.weather-location-banner-content');
      if (contentEl) {
        if (state.district === 'all') {
          contentEl.innerHTML = `
            <i class="fa-solid fa-globe"></i>
            <span>Showing all 38 districts across Tamil Nadu. Your detected location: <strong>${escapeHtml(state.userDetectedDistrict)}</strong></span>
          `;
        } else {
          contentEl.innerHTML = `
            <i class="fa-solid fa-location-dot"></i>
            <span>Showing live weather forecast for your location: <strong>${escapeHtml(state.userDetectedDistrict)}</strong></span>
          `;
        }
      }
      if (switchBtn) {
        switchBtn.style.display = 'inline-flex';
        if (state.district === 'all') {
          switchBtn.innerHTML = `<span>Back to ${escapeHtml(state.userDetectedDistrict)}</span> <i class="fa-solid fa-location-crosshairs"></i>`;
          switchBtn.onclick = () => window.selectUserDetectedDistrict();
        } else {
          switchBtn.innerHTML = `<span>View All 38 Districts</span> <i class="fa-solid fa-arrow-right"></i>`;
          switchBtn.onclick = () => window.resetWeatherFilters();
        }
      }
    } else {
      banner.classList.remove('hidden');
      const contentEl = banner.querySelector('.weather-location-banner-content');
      if (contentEl) {
        contentEl.innerHTML = `
          <i class="fa-solid fa-location-pin"></i>
          <span>Select your district to showcase local weather forecast.</span>
        `;
      }
      if (switchBtn) switchBtn.style.display = 'none';
    }
  }

  window.selectUserDetectedDistrict = function() {
    if (state.userDetectedDistrict) {
      state.district = state.userDetectedDistrict.toLowerCase();
      state.userHasManuallyChangedDistrict = false;
      const distSelect = document.getElementById('weather-district-filter');
      if (distSelect) distSelect.value = state.district;
      updateLocationBanner();
      updateSelectedDistrictView();
      renderView();
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

    // District select
    const distSelect = document.getElementById('weather-district-filter');
    if (distSelect) {
      distSelect.addEventListener('change', (e) => {
        state.district = e.target.value.toLowerCase();
        state.userHasManuallyChangedDistrict = true;
        updateLocationBanner();
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
    state.userHasManuallyChangedDistrict = true;

    const distSelect = document.getElementById('weather-district-filter');
    if (distSelect) distSelect.value = 'all';

    const searchInput = document.getElementById('weather-search-input');
    if (searchInput) searchInput.value = '';

    window.setWeatherTimeframeTab('all');
    updateLocationBanner();
    updateSelectedDistrictView();
    renderView();
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
      // Prioritize user's detected location first even in statewide overview!
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

    if (!state.sourceAvailable && state.districtsForecast.length === 0) {
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

    // Target district for Current Weather and 5-Day Forecast
    const targetDistrict = (state.searchQuery && matchingDistricts.length === 1)
      ? matchingDistricts[0]
      : state.currentDistrict;

    if (heroContainer && targetDistrict) {
      heroContainer.innerHTML = createCurrentWeatherHeroHtml(targetDistrict);
    }

    // 5-Day Forecast Grid for target district
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
        forecastSectionHeading.textContent = `${targetDistrict.district.name} · ${timeframeLabel}`;
      }
    }

    // 38-District Overview Grid
    if (allDistrictsSection && allDistrictsGrid) {
      if (state.district === 'all') {
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
   * HTML Template: Refined Current Weather Panel (Clean 2-level layout).
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

    const feelsLikeLabel = window.i18n ? window.i18n.t('weather_feels_like') : 'Feels like';
    const rainLabel = window.i18n ? window.i18n.t('weather_rainfall') : 'Rain';
    const humidityLabel = window.i18n ? window.i18n.t('weather_humidity') : 'Humidity';
    const windLabel = window.i18n ? window.i18n.t('weather_wind') : 'Wind';
    const gustsLabel = window.i18n ? window.i18n.t('weather_wind_gusts') : 'Wind gusts';

    return `
      <section class="current-weather-panel">
        <div class="current-weather-top">
          <div>
            <h2 class="current-district-name">${escapeHtml(dist.name)}</h2>
            <div class="current-temp-summary">
              <span class="current-temperature">${escapeHtml(tempDisplay)}</span>
              <div class="current-condition-wrap">
                <span class="current-condition-text">
                  <i class="fa-solid ${escapeHtml(curr.icon_class)}"></i>
                  <span>${escapeHtml(curr.condition)}</span>
                </span>
                <span class="current-feels-like">${escapeHtml(feelsLikeLabel)} ${escapeHtml(feelsLikeDisplay)}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="current-metrics-row">
          <div class="metric-block">
            <span class="metric-label">
              <i class="fa-solid fa-droplet"></i> ${escapeHtml(rainLabel)}
            </span>
            <span class="metric-value">${escapeHtml(rainDisplay)}</span>
          </div>

          <div class="metric-block">
            <span class="metric-label">
              <i class="fa-solid fa-water"></i> ${escapeHtml(humidityLabel)}
            </span>
            <span class="metric-value">${escapeHtml(humidityDisplay)}</span>
          </div>

          <div class="metric-block">
            <span class="metric-label">
              <i class="fa-solid fa-wind"></i> ${escapeHtml(windLabel)}
            </span>
            <span class="metric-value">${escapeHtml(windDisplay)}</span>
          </div>

          <div class="metric-block">
            <span class="metric-label">
              <i class="fa-solid fa-gauge-high"></i> ${escapeHtml(gustsLabel)}
            </span>
            <span class="metric-value">${escapeHtml(gustsDisplay)}</span>
          </div>
        </div>
      </section>
    `;
  }

  /**
   * HTML Template: Refined 5-Day Forecast Card.
   */
  function createForecastCardHtml(districtName, item) {
    const tempMax = item.temperature_max_c !== null ? `${item.temperature_max_c}°C` : '--';
    const tempMin = item.temperature_min_c !== null ? `${item.temperature_min_c}°C` : '--';
    const precipProb = `${item.precipitation_probability_pct}%`;
    const rainSum = `${item.precipitation_sum_mm} mm`;
    const windMax = `${item.wind_speed_max_kmh} km/h`;

    const rainChanceLabel = window.i18n ? window.i18n.t('weather_precip_prob') : 'Rain chance';
    const rainfallLabel = window.i18n ? window.i18n.t('weather_rainfall') : 'Rainfall';
    const maxWindLabel = 'Max wind';
    const sunriseLabel = window.i18n ? window.i18n.t('weather_sunrise') : 'Sunrise';
    const sunsetLabel = window.i18n ? window.i18n.t('weather_sunset') : 'Sunset';

    return `
      <article class="forecast-card">
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
   * HTML Template: Refined 38-District Overview Card.
   */
  function createDistrictOverviewCardHtml(item) {
    const dist = item.district;
    const curr = item.current;
    const todayDaily = (item.daily && item.daily[0]) || {};

    const tempDisplay = curr.temperature_c !== null ? `${curr.temperature_c}°C` : '--';
    const rainProb = todayDaily.precipitation_probability_pct !== undefined ? `${todayDaily.precipitation_probability_pct}%` : '--';
    const isUserLocation = state.userDetectedDistrict && (
      dist.name.toLowerCase() === state.userDetectedDistrict.toLowerCase() ||
      dist.id.toLowerCase() === state.userDetectedDistrict.toLowerCase()
    );

    return `
      <div class="district-card ${isUserLocation ? 'user-location-highlight' : ''}" onclick="selectDistrict('${escapeHtml(dist.id)}')">
        <div class="district-card-top">
          <div>
            <div class="district-card-name">
              ${escapeHtml(dist.name)}
              ${isUserLocation ? '<span class="user-location-pill"><i class="fa-solid fa-location-dot"></i> Your Area</span>' : ''}
            </div>
            <div class="district-card-condition">
              <i class="fa-solid ${escapeHtml(curr.icon_class)}" style="color: #64748b;"></i>
              <span>${escapeHtml(curr.condition)}</span>
            </div>
          </div>
          <div class="district-card-temp">${escapeHtml(tempDisplay)}</div>
        </div>

        <div class="district-card-bottom">
          <span>Rain chance ${escapeHtml(rainProb)}</span>
          <span>Wind ${escapeHtml(curr.wind_speed_kmh)} km/h</span>
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

    const hero = document.getElementById('current-weather-container');
    if (hero) {
      hero.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  window.shareForecast = function(district, dayLabel, date, condition, high, low, rainChance, rainSum) {
    const text = `CrowdCity Weather Forecast\nDistrict: ${district}\nForecast: ${dayLabel} (${date})\nCondition: ${condition}\nTemperature: High ${high} / Low ${low}\nRain chance: ${rainChance} (${rainSum})\nSource: Open-Meteo\nhttps://open-meteo.com/`;
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
      <div class="current-weather-panel" style="opacity: 0.6; pointer-events: none;">
        <div style="height: 24px; background: #e2e8f0; border-radius: 6px; width: 30%; margin-bottom: 0.75rem;"></div>
        <div style="height: 44px; background: #e2e8f0; border-radius: 6px; width: 45%; margin-bottom: 1.25rem;"></div>
        <div class="current-metrics-row">
          <div style="height: 52px; background: #f1f5f9; border-radius: 8px;"></div>
          <div style="height: 52px; background: #f1f5f9; border-radius: 8px;"></div>
          <div style="height: 52px; background: #f1f5f9; border-radius: 8px;"></div>
          <div style="height: 52px; background: #f1f5f9; border-radius: 8px;"></div>
        </div>
      </div>
    `;
  }

  function getForecastSkeletonHtml() {
    return Array(5).fill(0).map(() => `
      <div class="forecast-card" style="opacity: 0.6; pointer-events: none;">
        <div style="height: 18px; background: #e2e8f0; border-radius: 6px; width: 45%; margin-bottom: 0.85rem;"></div>
        <div style="height: 24px; background: #e2e8f0; border-radius: 6px; width: 65%; margin-bottom: 0.85rem;"></div>
        <div style="height: 32px; background: #f1f5f9; border-radius: 6px; width: 100%; margin-bottom: 0.85rem;"></div>
        <div style="height: 16px; background: #f1f5f9; border-radius: 4px; width: 40%;"></div>
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
