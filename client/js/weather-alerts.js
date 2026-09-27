/**
 * weather-alerts.js - Version 3.2.0
 * 
 * Complete UI/UX Refinement + True District -> Region Weather Experience.
 * Theme Integration: Respects global application Light / Dark theme.
 * Decouples weather condition (day/night) from application theme preference.
 * Features:
 * - Region-First UX: User location determines default district & nearby regions.
 * - Sub-district locality switching (e.g. Peelamedu, Sulur, Singanallur, Gandhipuram, etc.)
 *   with legitimate, authentic coordinates for each region.
 * - Works across all 38 districts of Tamil Nadu (Chennai, Coimbatore, Madurai, Salem, Tiruppur, etc.).
 * - Apple Weather-inspired minimal atmospheric hero with GPU-accelerated subtle animations.
 * - Proximity-sorted "Regions near you" cards with real Open-Meteo temperatures.
 * - 24-Hour horizontal hourly timeline.
 * - 5-Day compact daily forecast.
 * - Zero Emojis (Font Awesome professional vector icons only).
 * - Zero synthetic/fake data.
 * - Focused purely on authentic meteorological observations.
 * - Full accessibility (prefers-reduced-motion) and responsive mobile/desktop layouts.
 */

(function () {
  'use strict';

  /**
   * Universal Back Navigation Handler for Weather Page.
   * If valid browser history exists within the same domain, navigate back cleanly.
   * Otherwise fall back to citizen-dashboard.html.
   */
  function handleWeatherBackNavigation(event) {
    if (event) {
      if (typeof event.preventDefault === 'function') event.preventDefault();
      if (typeof event.stopPropagation === 'function') event.stopPropagation();
    }

    try {
      const hasHistory = window.history && window.history.length > 1;
      const referrer = document.referrer;
      const isSameOriginReferrer = referrer && (
        referrer.indexOf(window.location.host) !== -1 ||
        referrer.indexOf(window.location.hostname) !== -1
      );

      if (hasHistory && isSameOriginReferrer) {
        window.history.back();
        return;
      }
    } catch (e) {
      console.warn('[WeatherAlerts] History back navigation error:', e);
    }

    window.location.href = 'citizen-dashboard.html';
  };

  // Constants
  const WEATHER_API_BASE = '/api/public-pulse/weather';
  const REGIONS_API_BASE = '/api/public-pulse/weather/regions';
  const SEARCH_API_BASE = '/api/public-pulse/weather/search';
  const RECENT_LOCATIONS_STORAGE_KEY = 'crowdcity_recent_weather_locations_v3';

  // State Management
  const state = {
    district: 'coimbatore', // Default fallback district
    userDetectedDistrict: null,
    userCoordinates: null,
    selectedRegion: null, // { name, locality, district, lat, lon }
    districtRegions: [], // Real weather for regions in this district
    weatherData: null, // Full forecast for currently active region/district
    districtsForecast: [], // 38 districts overview
    activeTab: 'all',
    searchQuery: '',
    isLoading: false,
    isDetectingLocation: false,
    userHasManuallyChangedDistrict: false,
    recentLocations: []
  };

  // Fallback 38 Districts List
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

  // Quick District Selection Chips
  const QUICK_DISTRICTS = [
    'Coimbatore', 'Chennai', 'Madurai', 'Salem', 'Tiruppur', 'Tiruchirappalli', 'The Nilgiris', 'Erode'
  ];

  // Helper: Escape HTML
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Load Recent Locations from LocalStorage
  function loadRecentLocations() {
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem(RECENT_LOCATIONS_STORAGE_KEY);
        if (saved) {
          state.recentLocations = JSON.parse(saved).slice(0, 5);
        }
      }
    } catch {
      state.recentLocations = [];
    }
  }

  // Save Recent Location
  function saveRecentLocation(item) {
    if (!item || !item.name) return;
    try {
      const filtered = state.recentLocations.filter(r => r.name.toLowerCase() !== item.name.toLowerCase());
      filtered.unshift({
        name: item.name,
        locality: item.locality || item.name,
        district: item.district || '',
        displayName: item.displayName || (item.district ? `${item.name}, ${item.district}` : item.name),
        lat: item.lat,
        lon: item.lon
      });
      state.recentLocations = filtered.slice(0, 5);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(RECENT_LOCATIONS_STORAGE_KEY, JSON.stringify(state.recentLocations));
      }
      renderRecentLocations();
    } catch {
      // Ignore
    }
  }

  window.clearRecentLocations = function () {
    state.recentLocations = [];
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(RECENT_LOCATIONS_STORAGE_KEY);
      }
    } catch {}
    renderRecentLocations();
  };

  /**
   * Initialize User Location Detection.
   * Region-First: If user is in Peelamedu, Coimbatore -> district = Coimbatore, region = Peelamedu.
   */
  async function initializeUserLocation() {
    state.isDetectingLocation = true;
    updateLocationBanner();

    let detectedDistrict = null;
    let detectedLocality = null;
    let detectedCoords = null;

    // 1. Check CrowdCityLocation service
    if (typeof window !== 'undefined' && window.CrowdCityLocation) {
      // Check saved specific location first (e.g. Peelamedu, Coimbatore)
      if (typeof window.CrowdCityLocation.getSavedSpecificLocation === 'function') {
        const savedSpec = window.CrowdCityLocation.getSavedSpecificLocation();
        if (savedSpec && savedSpec.district) {
          detectedDistrict = savedSpec.district;
          if (savedSpec.specificName && savedSpec.specificName.toLowerCase() !== savedSpec.district.toLowerCase()) {
            detectedLocality = savedSpec.specificName;
          }
          if (savedSpec.lat && (savedSpec.lon || savedSpec.lng)) {
            detectedCoords = { lat: savedSpec.lat, lon: savedSpec.lon || savedSpec.lng };
          }
        }
      }

      // If not yet found, check saved district
      if (!detectedDistrict && typeof window.CrowdCityLocation.getSavedUserDistrict === 'function') {
        detectedDistrict = window.CrowdCityLocation.getSavedUserDistrict();
      }

      // Check stored coordinates
      if (!detectedCoords) {
        try {
          if (typeof localStorage !== 'undefined') {
            const rawCoords = localStorage.getItem('cc_weather_coords');
            if (rawCoords) {
              const parsed = JSON.parse(rawCoords);
              if (parsed.lat && parsed.lon) {
                detectedCoords = { lat: parsed.lat, lon: parsed.lon };
              }
            }
          }
        } catch {}
      }

      // If still missing, trigger light detection without blocking
      if (!detectedDistrict && typeof window.CrowdCityLocation.detectUserDistrict === 'function') {
        try {
          detectedDistrict = await window.CrowdCityLocation.detectUserDistrict({ timeoutMs: 2500, requestGps: false });
        } catch {}
      }
    }

    // Fallback to localStorage
    if (!detectedDistrict) {
      try {
        if (typeof localStorage !== 'undefined') {
          detectedDistrict = localStorage.getItem('user_district') || localStorage.getItem('cc_user_location');
        }
      } catch {}
    }

    if (detectedDistrict && detectedDistrict !== 'Tamil Nadu') {
      state.userDetectedDistrict = detectedDistrict;
      if (!state.userHasManuallyChangedDistrict) {
        state.district = detectedDistrict.toLowerCase();
      }
    } else {
      // Default to Coimbatore
      state.userDetectedDistrict = 'Coimbatore';
      state.district = 'coimbatore';
    }

    if (detectedCoords) {
      state.userCoordinates = detectedCoords;
      try {
        localStorage.setItem('cc_weather_coords', JSON.stringify(detectedCoords));
      } catch (e) {}
    }

    // Set initial region if detected coordinates exist
    if (detectedCoords) {
      state.selectedRegion = {
        name: detectedLocality || (detectedDistrict && detectedDistrict !== 'Tamil Nadu' ? detectedDistrict : 'Coimbatore'),
        locality: detectedLocality || null,
        district: state.userDetectedDistrict,
        lat: detectedCoords.lat,
        lon: detectedCoords.lon
      };
    }

    state.isDetectingLocation = false;
    updateLocationBanner();
    syncDistrictDropdown();
  }

  /**
   * Update the auto-detected location notification banner.
   */
  function updateLocationBanner() {
    const banner = document.getElementById('weather-location-banner');
    const label = document.getElementById('weather-user-district-label');
    const switchBtn = document.getElementById('btn-weather-all-districts');
    if (!banner) return;

    if (state.isDetectingLocation) {
      banner.classList.remove('hidden');
      if (label) label.textContent = 'Detecting your location...';
      if (switchBtn) switchBtn.style.display = 'none';
      return;
    }

    const selectedName = state.selectedRegion
      ? (state.selectedRegion.locality ? `${state.selectedRegion.locality} (${state.selectedRegion.district})` : state.selectedRegion.name)
      : getDistrictDisplayName(state.district);

    const contentEl = (banner && typeof banner.querySelector === 'function')
      ? banner.querySelector('.weather-location-banner-content')
      : null;

    if (state.userDetectedDistrict) {
      banner.classList.remove('hidden');
      const isViewingDetected = Boolean(
        state.district &&
        state.district.toLowerCase() === state.userDetectedDistrict.toLowerCase()
      );

      if (label) {
        label.textContent = state.userDetectedDistrict;
      }

      if (contentEl) {
        if (state.district === 'all') {
          contentEl.innerHTML = `
            <i class="fa-solid fa-globe"></i>
            <span>Showing all 38 districts across Tamil Nadu. Your detected location: <strong>${escapeHtml(state.userDetectedDistrict)}</strong></span>
          `;
        } else if (isViewingDetected) {
          contentEl.innerHTML = `
            <i class="fa-solid fa-location-dot"></i>
            <span>Showing live weather forecast for: <strong>${escapeHtml(selectedName)}</strong></span>
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
        if (state.district === 'all') {
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
      if (contentEl && (state.district !== 'all' || state.selectedRegion)) {
        banner.classList.remove('hidden');
        contentEl.innerHTML = `
          <i class="fa-solid fa-location-dot"></i>
          <span>Showing live weather forecast for: <strong>${escapeHtml(selectedName)}</strong></span>
        `;
      } else {
        banner.classList.add('hidden');
      }
    }
  }

  function getDistrictDisplayName(id) {
    if (!id || id === 'all') return 'Tamil Nadu';
    if (state.selectedRegion && state.selectedRegion.district) {
      return state.selectedRegion.district;
    }
    const found = TN_DISTRICTS_FALLBACK.find(d => d.toLowerCase() === id.toLowerCase());
    return found || (id.charAt(0).toUpperCase() + id.slice(1));
  }

  function syncDistrictDropdown() {
    const select = document.getElementById('weather-district-filter');
    if (select && state.district) {
      select.value = state.district;
    }
  }

  /**
   * Populate districts dropdown dynamically.
   */
  async function populateDistrictsDropdown() {
    const select = document.getElementById('weather-district-filter');
    if (!select || typeof document === 'undefined' || typeof document.createElement !== 'function') return;

    let districts = TN_DISTRICTS_FALLBACK;
    try {
      const res = await fetch('/api/locations/districts');
      if (res.ok) {
        const json = await res.json();
        if (json.data && Array.isArray(json.data) && json.data.length > 0) {
          districts = json.data.map(d => d.name || d.nameEn || d.id);
        }
      }
    } catch {
      // Fallback
    }

    districts = Array.from(new Set(districts)).sort();

    select.innerHTML = '<option value="all">All Districts (38)</option>';

    districts.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.toLowerCase();
      const isDetected = state.userDetectedDistrict && state.userDetectedDistrict.toLowerCase() === d.toLowerCase();
      opt.textContent = isDetected ? `${d} (Your Location)` : d;
      select.appendChild(opt);
    });

    if (state.district) {
      select.value = state.district;
    }
  }

  /**
   * Set Retry / Refresh loading state with spinner and disabled button.
   */
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
    if (retryIcon) retryIcon.style.display = isLoading ? 'inline-block' : 'none';
    if (retryText) retryText.textContent = isLoading ? 'Retrying...' : 'Retry';

    const retryErrBtn = document.getElementById('btn-retry-weather-err');
    const retryErrIcon = document.getElementById('retry-weather-err-icon');
    const retryErrText = document.getElementById('retry-weather-err-text');
    if (retryErrBtn) retryErrBtn.disabled = isLoading;
    if (retryErrIcon) retryErrIcon.style.display = isLoading ? 'inline-block' : 'none';
    if (retryErrText) retryErrText.textContent = isLoading ? 'Retrying...' : 'Retry';
  }

  /**
   * Main function: Fetch weather forecast for active region and district.
   */
  async function fetchWeatherForecast(forceRefresh = false) {
    state.isLoading = true;
    setRetryLoading(true);
    hideStateBoxes();

    try {
      // Determine query params for active region / district
      let weatherUrl = `${WEATHER_API_BASE}?district=${encodeURIComponent(state.district)}`;
      if (forceRefresh) weatherUrl += '&refresh=true';

      const activeLat = (state.selectedRegion && typeof state.selectedRegion.lat === 'number')
        ? state.selectedRegion.lat
        : (state.userCoordinates && typeof state.userCoordinates.lat === 'number' ? state.userCoordinates.lat : null);

      const activeLon = (state.selectedRegion && typeof state.selectedRegion.lon === 'number')
        ? state.selectedRegion.lon
        : (state.userCoordinates && typeof state.userCoordinates.lon === 'number' ? state.userCoordinates.lon : null);

      const activeLocality = (state.selectedRegion && state.selectedRegion.name) ? state.selectedRegion.name : null;

      if (typeof activeLat === 'number' && typeof activeLon === 'number' && !isNaN(activeLat) && !isNaN(activeLon)) {
        weatherUrl += `&lat=${activeLat}&lon=${activeLon}`;
        if (activeLocality) {
          weatherUrl += `&locality=${encodeURIComponent(activeLocality)}`;
        }
        weatherUrl += `&district=${encodeURIComponent(state.selectedRegion?.district || state.district)}`;
      }

      // Fetch region weather and district regions concurrently
      const regionsQuery = state.district !== 'all' ? state.district : (state.userDetectedDistrict || 'coimbatore');
      let regionsUrl = `${REGIONS_API_BASE}?district=${encodeURIComponent(regionsQuery)}`;
      if (state.userCoordinates && state.userCoordinates.lat && state.userCoordinates.lon) {
        regionsUrl += `&lat=${state.userCoordinates.lat}&lon=${state.userCoordinates.lon}`;
      }

      const [weatherRes, regionsRes] = await Promise.allSettled([
        fetch(weatherUrl),
        fetch(regionsUrl)
      ]);

      if (weatherRes.status !== 'fulfilled' || !weatherRes.value.ok) {
        throw new Error('Weather forecast service is currently unreachable.');
      }

      const weatherData = await weatherRes.value.json();

      if (!weatherData.success && weatherData.source_available === false) {
        showUnavailableBox(weatherData.error);
        return;
      }

      state.weatherData = weatherData;
      state.districtsForecast = weatherData.districts_forecast || [];

      // Process Regions
      if (regionsRes.status === 'fulfilled' && regionsRes.value.ok) {
        const regionsData = await regionsRes.value.json();
        if (regionsData.success && Array.isArray(regionsData.regions)) {
          state.districtRegions = regionsData.regions;
        } else {
          state.districtRegions = [];
        }
      }

      // If no specific region was selected yet, select the closest / first region
      if (!state.selectedRegion && state.districtRegions.length > 0) {
        state.selectedRegion = state.districtRegions[0];
      }

      // Update timestamp
      const tsEl = document.getElementById('weather-last-updated-text');
      if (tsEl) {
        tsEl.textContent = `Updated ${weatherData.last_updated_ist || 'Just now'}`;
      }

      renderView();
    } catch (err) {
      console.error('[WeatherAlerts] Fetch error:', err);
      showErrorBox(err.message);
    } finally {
      state.isLoading = false;
      setRetryLoading(false);
    }
  }

  /**
   * Switch the active region and load its weather.
   */
  window.selectRegion = async function (regionName, lat, lon) {
    if (!regionName) return;

    state.selectedRegion = {
      name: regionName,
      locality: regionName,
      district: getDistrictDisplayName(state.district),
      lat: parseFloat(lat),
      lon: parseFloat(lon)
    };

    saveRecentLocation(state.selectedRegion);

    // Re-render nearby regions immediately to update active highlight
    renderNearbyRegions();

    // Fetch weather for this exact region
    await fetchWeatherForecast(false);
  };

  /**
   * Main Render Coordinator.
   */
  function renderView() {
    renderHeroCard();
    renderNearbyRegions();
    renderHourlyTimeline();
    renderDailyForecast();
    renderAllDistrictsGrid();
    updateLocationBanner();
    syncDistrictDropdown();
  }

  /**
   * Render Minimal, Sophisticated, Apple Weather-inspired Hero Card.
   * Structure:
   * LIVE WEATHER
   * [Region Name]
   * [District], Tamil Nadu
   * [Temp]°
   * [Condition] · Feels like [FeelsLike]° · H: [Max]°  L: [Min]°
   * 4 Solid Metric Tiles: Humidity, Wind, Rain, Visibility
   */
  function renderHeroCard() {
    const container = document.getElementById('current-weather-container');
    if (!container) return;

    const data = state.weatherData;
    if (!data) {
      container.innerHTML = '';
      return;
    }

    // Resolve current weather values - prioritize exact coordinate current object
    const current = (data.current && typeof data.current.temperature_c === 'number')
      ? data.current
      : ((data.current_district && data.current_district.current) || {});

    const daily = (data.current_district && data.current_district.daily)
      ? data.current_district.daily
      : (data.daily || []);

    const today = daily && daily[0] ? daily[0] : {};

    // Determine location hierarchy (Detected Locality -> Subtitle)
    const currentDistName = getDistrictDisplayName(state.district);
    let rawLocality = state.selectedRegion ? state.selectedRegion.name : currentDistName;

    if (data.location && data.location.name) {
      rawLocality = data.location.name;
    }

    let primaryTitle = rawLocality;
    let secondarySubtitle = `${currentDistName}, Tamil Nadu`;

    if (rawLocality.includes(',')) {
      const parts = rawLocality.split(',').map(s => s.trim()).filter(Boolean);
      primaryTitle = parts[0];
      secondarySubtitle = `${parts.slice(1).join(', ')}, ${currentDistName}`;
    } else if (rawLocality.toLowerCase() !== currentDistName.toLowerCase()) {
      primaryTitle = rawLocality;
      secondarySubtitle = `${currentDistName}, Tamil Nadu`;
    }

    // Determine badge (CURRENT LOCATION vs LIVE WEATHER)
    const isDetected = Boolean(
      state.userDetectedDistrict &&
      state.district.toLowerCase() === state.userDetectedDistrict.toLowerCase() &&
      (!state.userHasManuallyChangedDistrict || (state.selectedRegion && state.selectedRegion.distance_km === 0))
    );
    const badgeLabel = isDetected ? 'CURRENT LOCATION' : 'LIVE WEATHER';

    const tempVal = typeof current.temperature_c === 'number' ? `${Math.round(current.temperature_c)}°` : '--°';
    const feelsLikeVal = typeof current.apparent_temperature_c === 'number' ? `${Math.round(current.apparent_temperature_c)}°` : '--°';
    const maxVal = typeof today.temperature_max_c === 'number' ? `${Math.round(today.temperature_max_c)}°` : '--°';
    const minVal = typeof today.temperature_min_c === 'number' ? `${Math.round(today.temperature_min_c)}°` : '--°';
    const conditionText = current.condition || 'Clear';
    const iconClass = current.icon_class || 'fa-sun';
    const humidityVal = typeof current.relative_humidity_pct === 'number' ? `${current.relative_humidity_pct}%` : '--';
    const windVal = typeof current.wind_speed_kmh === 'number' ? `${current.wind_speed_kmh} km/h` : '--';
    const rainVal = typeof current.precipitation_mm === 'number' ? `${current.precipitation_mm} mm` : '0 mm';
    const visibilityVal = typeof current.visibility_km === 'number' ? `${current.visibility_km} km` : '10 km';

    // Condition Scene Detection
    const wCode = current.weather_code || 0;
    const isDay = current.is_day !== undefined ? current.is_day : 1;
    let sceneClass = 'weather-scene-day-clear';
    let sceneType = 'clear_day';

    if (wCode >= 95) {
      sceneClass = 'weather-scene-thunderstorm';
      sceneType = 'thunderstorm';
    } else if (wCode >= 61 || wCode >= 80 || current.precipitation_mm > 0) {
      sceneClass = 'weather-scene-rain';
      sceneType = 'rain';
    } else if (wCode >= 3) {
      sceneClass = 'weather-scene-cloudy';
      sceneType = 'cloudy_day';
    } else if (isDay) {
      sceneClass = 'weather-scene-day-clear';
      sceneType = 'clear_day';
    } else {
      sceneClass = 'weather-scene-night-clear';
      sceneType = 'clear_night';
    }

    // Build Subtle Atmospheric FX Elements (Respects prefers-reduced-motion: reduce)
    let fxHtml = '';
    const prefersReducedMotion = Boolean(
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );

    if (prefersReducedMotion) {
      fxHtml = ''; // Keep background static for users who prefer reduced motion
    } else if (sceneType === 'rain') {
      fxHtml = Array.from({ length: 18 }).map((_, i) => {
        const left = Math.floor(Math.random() * 98) + 1;
        const delay = (Math.random() * 0.9).toFixed(2);
        const dur = (0.7 + Math.random() * 0.35).toFixed(2);
        return `<div class="rain-drop" style="left: ${left}%; animation-delay: ${delay}s; animation-duration: ${dur}s;"></div>`;
      }).join('');
    } else if (sceneType === 'thunderstorm') {
      fxHtml = `<div class="lightning-flash"></div>` + Array.from({ length: 22 }).map((_, i) => {
        const left = Math.floor(Math.random() * 98) + 1;
        const delay = (Math.random() * 0.8).toFixed(2);
        return `<div class="rain-drop" style="left: ${left}%; animation-delay: ${delay}s;"></div>`;
      }).join('');
    } else if (sceneType === 'cloudy_day') {
      fxHtml = `<div class="cloud-drifter" style="top: 15%; animation-duration: 40s;"></div><div class="cloud-drifter" style="top: 55%; width: 200px; animation-duration: 55s; animation-delay: 8s; opacity: 0.08;"></div>`;
    } else if (sceneType === 'clear_day') {
      fxHtml = `<div class="sun-glow-core"></div>`;
    } else {
      // Night stars
      fxHtml = Array.from({ length: 16 }).map((_, i) => {
        const top = Math.floor(Math.random() * 90) + 5;
        const left = Math.floor(Math.random() * 95) + 2;
        const op = (0.2 + Math.random() * 0.45).toFixed(2);
        return `<div class="star-particle" style="top: ${top}%; left: ${left}%; opacity: ${op};"></div>`;
      }).join('');
    }

    container.innerHTML = `
      <div class="weather-hero-card ${sceneClass}" id="weather-hero-card">
        <div class="weather-fx-layer" id="weather-fx-layer">
          ${fxHtml}
        </div>
        <div class="hero-content">
          <div class="hero-top-row">
            <div class="hero-location-block">
              <span class="hero-live-badge">
                <span class="hero-pulse-dot"></span>
                <span>${escapeHtml(badgeLabel)}</span>
              </span>
              <h2 class="hero-locality-name">${escapeHtml(primaryTitle)}</h2>
              <p class="hero-district-state">${escapeHtml(secondarySubtitle)}</p>
            </div>

            <div class="hero-temp-block">
              <div class="hero-huge-temp">${tempVal}</div>
              <div class="hero-condition-line">
                <i class="fa-solid ${escapeHtml(iconClass)}"></i>
                <span>${escapeHtml(conditionText)}</span>
              </div>
              <div class="hero-subtext-line">
                Feels like ${feelsLikeVal} &bull; H: ${maxVal} L: ${minVal}
              </div>
            </div>
          </div>

          <!-- Clean 4-Card Hero Metrics Row -->
          <div class="hero-metrics-row hero-glass-metrics">
            <div class="metric-card-tile">
              <div class="metric-card-header">
                <i class="fa-solid fa-droplets"></i>
                <span>Humidity</span>
              </div>
              <div class="metric-card-value">${humidityVal}</div>
              <div class="metric-card-sub">Relative moisture</div>
            </div>

            <div class="metric-card-tile">
              <div class="metric-card-header">
                <i class="fa-solid fa-wind"></i>
                <span>Wind</span>
              </div>
              <div class="metric-card-value">${windVal}</div>
              <div class="metric-card-sub">Surface flow</div>
            </div>

            <div class="metric-card-tile">
              <div class="metric-card-header">
                <i class="fa-solid fa-cloud-showers-heavy"></i>
                <span>Rainfall</span>
              </div>
              <div class="metric-card-value">${rainVal}</div>
              <div class="metric-card-sub">Current precipitation</div>
            </div>

            <div class="metric-card-tile">
              <div class="metric-card-header">
                <i class="fa-solid fa-eye"></i>
                <span>Visibility</span>
              </div>
              <div class="metric-card-value">${visibilityVal}</div>
              <div class="metric-card-sub">Optical range</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render Region-First "Regions near you" Section.
   * Shows legitimate regions in the active district with real temperatures.
   */
  function renderNearbyRegions() {
    const section = document.getElementById('nearby-regions-section');
    const container = document.getElementById('nearby-regions-container');
    const titleDist = document.getElementById('nearby-district-name');
    const countBadge = document.getElementById('nearby-regions-count');
    if (!section || !container) return;

    if (state.district === 'all') {
      section.classList.add('hidden');
      return;
    }

    section.classList.remove('hidden');

    const distName = getDistrictDisplayName(state.district);
    if (titleDist) titleDist.textContent = distName;

    const regions = state.districtRegions;
    if (countBadge) {
      countBadge.textContent = `${regions.length} areas`;
    }

    if (!regions || regions.length === 0) {
      container.innerHTML = `
        <div style="font-size: 0.8rem; color: var(--weather-text-muted); padding: 0.5rem;">
          No sub-district localities mapped yet for this area.
        </div>
      `;
      return;
    }

    const activeName = (state.selectedRegion ? state.selectedRegion.name : '').toLowerCase();

    container.innerHTML = regions.map(reg => {
      const isActive = activeName && reg.name.toLowerCase() === activeName;
      const tempDisplay = reg.current && typeof reg.current.temperature_c === 'number'
        ? `${Math.round(reg.current.temperature_c)}°`
        : '--°';
      const icon = reg.current ? reg.current.icon_class : 'fa-cloud';
      const condText = reg.current ? (reg.current.condition || 'Clear') : 'Clear';
      const distLabel = typeof reg.distance_km === 'number'
        ? (reg.distance_km === 0 ? 'Your area' : `${reg.distance_km} km`)
        : 'Area';

      return `
        <div class="region-card-chip ${isActive ? 'active' : ''}" 
             onclick="selectRegion('${escapeHtml(reg.name)}', ${reg.lat}, ${reg.lon})"
             title="Switch to ${escapeHtml(reg.name)} weather">
          <div class="region-chip-top">
            <span class="region-chip-name">${escapeHtml(reg.name)}</span>
            <span class="region-chip-dist">${distLabel}</span>
          </div>
          <div class="region-chip-bottom">
            <span class="region-chip-temp">${tempDisplay}</span>
            <div class="region-chip-cond">
              <i class="fa-solid ${escapeHtml(icon)} region-chip-icon"></i>
              <span>${escapeHtml(condText)}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  window.scrollRegions = function (amount) {
    const container = document.getElementById('nearby-regions-container');
    if (container) {
      container.scrollBy({ left: amount, behavior: 'smooth' });
    }
  };

  /**
   * Render 24-Hour Hourly Timeline.
   */
  function renderHourlyTimeline() {
    const track = document.getElementById('hourly-forecast-track');
    const section = document.getElementById('hourly-forecast-section');
    if (!track) return;

    const currentDist = state.weatherData?.current_district || state.weatherData || {};
    const hourly = currentDist.hourly || [];

    if (!Array.isArray(hourly) || hourly.length === 0) {
      if (section) section.classList.add('hidden');
      return;
    }

    if (section) section.classList.remove('hidden');

    track.innerHTML = hourly.slice(0, 24).map(h => {
      const isNow = h.is_now;
      const label = isNow ? 'NOW' : (h.hour_label || '--');
      const temp = typeof h.temperature_c === 'number' ? `${Math.round(h.temperature_c)}°` : '--°';
      const icon = h.icon_class || (h.is_day ? 'fa-sun' : 'fa-moon');
      const rainPct = h.precipitation_probability_pct || 0;

      return `
        <div class="hourly-card-pill ${isNow ? 'is-now' : ''}">
          <span class="hourly-time-label">${escapeHtml(label)}</span>
          <div class="hourly-condition-icon">
            <i class="fa-solid ${escapeHtml(icon)}"></i>
          </div>
          ${rainPct > 15 ? `
            <span class="hourly-precip-badge">
              <i class="fa-solid fa-droplet" style="font-size: 0.55rem;"></i>
              <span>${rainPct}%</span>
            </span>
          ` : '<span style="height: 14px;"></span>'}
          <span class="hourly-temp-value">${temp}</span>
        </div>
      `;
    }).join('');
  }

  window.scrollHourly = function (amount) {
    const container = document.getElementById('hourly-scroll-container');
    if (container) {
      container.scrollBy({ left: amount, behavior: 'smooth' });
    }
  };

  /**
   * Render 5-Day Daily Forecast.
   */
  function renderDailyForecast() {
    const container = document.getElementById('weather-forecast-container');
    const heading = document.getElementById('forecast-section-heading');
    if (!container) return;

    const currentDist = state.weatherData?.current_district || state.weatherData || {};
    const daily = currentDist.daily || [];

    if (!Array.isArray(daily) || daily.length === 0) {
      container.innerHTML = '<div style="color: var(--weather-text-muted); font-size: 0.85rem;">Daily forecast unavailable.</div>';
      return;
    }

    // Filter by activeTab if needed
    let filteredDaily = [...daily];
    if (state.activeTab === 'today') {
      filteredDaily = filteredDaily.filter(d => d.day_index === 1);
    } else if (state.activeTab === 'tomorrow') {
      filteredDaily = filteredDaily.filter(d => d.day_index === 2);
    } else if (state.activeTab === 'day3') {
      filteredDaily = filteredDaily.filter(d => d.day_index === 3);
    } else if (state.activeTab === 'day4') {
      filteredDaily = filteredDaily.filter(d => d.day_index === 4);
    } else if (state.activeTab === 'day5') {
      filteredDaily = filteredDaily.filter(d => d.day_index === 5);
    }

    if (heading) {
      heading.textContent = state.activeTab === 'all' ? '5-Day Meteorological Forecast' : `${state.activeTab.toUpperCase()} Forecast`;
    }

    container.innerHTML = filteredDaily.map(d => {
      const isToday = d.day_index === 1;
      const maxT = typeof d.temperature_max_c === 'number' ? `${Math.round(d.temperature_max_c)}°` : '--°';
      const minT = typeof d.temperature_min_c === 'number' ? `${Math.round(d.temperature_min_c)}°` : '--°';
      const icon = d.icon_class || 'fa-cloud-sun';
      const rainProb = d.precipitation_probability_pct || 0;

      return `
        <div class="daily-forecast-card ${isToday ? 'is-today' : ''}">
          <div class="daily-card-header">
            <span class="daily-day-label">${escapeHtml(d.day_label || `Day ${d.day_index}`)}</span>
            <span class="daily-date-label">${escapeHtml(d.date_formatted || d.date || '')}</span>
          </div>

          <div class="daily-condition-row">
            <i class="fa-solid ${escapeHtml(icon)} daily-icon"></i>
            <span class="daily-condition-text">${escapeHtml(d.condition || 'Clear')}</span>
          </div>

          <div class="daily-temp-range">
            <span>${maxT}</span>
            <span class="daily-temp-min">/ ${minT}</span>
          </div>

          ${rainProb > 0 ? `
            <div class="daily-rain-prob">
              <i class="fa-solid fa-umbrella" style="font-size: 0.65rem;"></i>
              <span>Rain ${rainProb}%</span>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  /**
   * Render 38 Districts Overview (Shown when All Districts is selected).
   */
  function renderAllDistrictsGrid() {
    const wrap = document.getElementById('all-districts-section-wrap');
    const container = document.getElementById('all-districts-grid-container');
    const emptyState = document.getElementById('weather-empty-state');
    if (!wrap || !container) return;

    if (state.district !== 'all') {
      wrap.classList.add('hidden');
      if (emptyState) emptyState.classList.add('hidden');
      return;
    }

    wrap.classList.remove('hidden');

    let list = state.districtsForecast;

    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      list = list.filter(d => 
        (d.district && d.district.name && d.district.name.toLowerCase().includes(q)) ||
        (d.district && d.district.id && d.district.id.toLowerCase().includes(q))
      );
    }

    if (list.length === 0) {
      container.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    container.innerHTML = list.map(item => {
      const dist = item.district || {};
      const curr = item.current || {};
      const isUserDist = state.userDetectedDistrict && state.userDetectedDistrict.toLowerCase() === dist.name?.toLowerCase();
      const tempDisplay = typeof curr.temperature_c === 'number' ? `${Math.round(curr.temperature_c)}°` : '--°';
      const icon = curr.icon_class || 'fa-cloud-sun';

      return `
        <div class="district-overview-card ${isUserDist ? 'user-district-highlight' : ''}"
             onclick="selectDistrictFromOverview('${escapeHtml(dist.id || dist.name)}')">
          <div class="dist-info-block">
            <span class="dist-name">${escapeHtml(dist.name || 'District')}</span>
            <span class="dist-cond">${escapeHtml(curr.condition || 'Clear')}</span>
          </div>
          <div class="dist-temp-block">
            <i class="fa-solid ${escapeHtml(icon)} dist-icon"></i>
            <span class="dist-temp">${tempDisplay}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  window.selectDistrictFromOverview = function (districtId) {
    if (!districtId) return;
    state.district = districtId.toLowerCase();
    state.selectedRegion = null;
    state.userHasManuallyChangedDistrict = true;
    updateLocationBanner();
    syncDistrictDropdown();
    fetchWeatherForecast();
  };

  /**
   * Set Timeframe tab (All, Today, Tomorrow, etc.)
   */
  window.setWeatherTimeframeTab = function (tab) {
    state.activeTab = tab;
    const tabBtns = (typeof document !== 'undefined' && typeof document.querySelectorAll === 'function')
      ? document.querySelectorAll('.weather-tab-btn')
      : [];
    tabBtns.forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tab);
    });
    renderDailyForecast();
  };

  /**
   * Reset filters to All Districts.
   */
  window.resetWeatherFilters = function () {
    state.district = 'all';
    state.selectedRegion = null;
    state.userHasManuallyChangedDistrict = true;
    const distSelect = document.getElementById('weather-district-filter');
    if (distSelect) distSelect.value = 'all';
    updateLocationBanner();
    fetchWeatherForecast();
  };

  /**
   * Switch back to user's detected district.
   */
  window.selectUserDetectedDistrict = function () {
    if (state.userDetectedDistrict) {
      state.district = state.userDetectedDistrict.toLowerCase();
      state.selectedRegion = null;
      state.userHasManuallyChangedDistrict = false;
      syncDistrictDropdown();
      updateLocationBanner();
      closeSearchPopover();
      fetchWeatherForecast();
    }
  };

  /**
   * Setup Event Listeners.
   */
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
        state.selectedRegion = null;
        state.userHasManuallyChangedDistrict = true;
        updateLocationBanner();
        fetchWeatherForecast();
      });
    }

    // Back navigation keyboard accessibility (Enter / Space)
    const backBtn = document.getElementById('btn-weather-back');
    if (backBtn) {
      backBtn.addEventListener('keydown', (e) => {
        if (e.key === ' ' || e.key === 'Spacebar') {
          e.preventDefault();
          window.handleWeatherBackNavigation(e);
        }
      });
    }

    // Dynamic Live Theme Event Listeners (zero page reload required)
    window.addEventListener('theme-change', () => {
      renderHeroCard();
    });
    window.addEventListener('storage', (e) => {
      if (e.key === 'crowdcity_theme' || e.key === 'cc_theme') {
        renderHeroCard();
      }
    });

    // Setup Location Search
    setupLocationSearch();
  }

  /**
   * Setup Location Search and Popover.
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
        if (q.length === 0 && state.district === 'all') {
          renderAllDistrictsGrid();
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
    const recentsSec = document.getElementById('popover-recents-section');
    const quickSec = document.getElementById('popover-quick-districts-section');
    const resultsSec = document.getElementById('popover-results-section');

    if (recentsSec) recentsSec.classList.toggle('hidden', state.recentLocations.length === 0);
    if (quickSec) quickSec.classList.remove('hidden');
    if (resultsSec) resultsSec.classList.add('hidden');
  }

  function renderQuickDistricts() {
    const container = document.getElementById('popover-district-chips');
    if (!container) return;

    container.innerHTML = QUICK_DISTRICTS.map(d => `
      <button type="button" class="popover-chip" onclick="handleQuickDistrictSelect('${escapeHtml(d)}')">
        <span>${escapeHtml(d)}</span>
      </button>
    `).join('');
  }

  window.handleQuickDistrictSelect = function (distName) {
    state.district = distName.toLowerCase();
    state.selectedRegion = null;
    state.userHasManuallyChangedDistrict = true;
    closeSearchPopover();
    syncDistrictDropdown();
    updateLocationBanner();
    fetchWeatherForecast();
  };

  function renderRecentLocations() {
    const sec = document.getElementById('popover-recents-section');
    const list = document.getElementById('popover-recents-list');
    if (!sec || !list) return;

    if (state.recentLocations.length === 0) {
      sec.classList.add('hidden');
      return;
    }

    sec.classList.remove('hidden');
    list.innerHTML = state.recentLocations.map(item => `
      <div class="popover-item" onclick="handleRecentLocationSelect('${escapeHtml(item.name)}', '${escapeHtml(item.district || '')}', ${item.lat || 'null'}, ${item.lon || 'null'})">
        <div class="popover-item-main">
          <span class="popover-item-name">${escapeHtml(item.name)}</span>
          <span class="popover-item-sub">${escapeHtml(item.displayName || (item.district ? `${item.district}, Tamil Nadu` : 'Tamil Nadu'))}</span>
        </div>
        <span class="popover-item-type">Recent</span>
      </div>
    `).join('');
  }

  window.handleRecentLocationSelect = function (name, district, lat, lon) {
    if (district) {
      state.district = district.toLowerCase();
    }
    if (lat !== null && lon !== null) {
      state.selectedRegion = {
        name,
        locality: name,
        district: district || getDistrictDisplayName(state.district),
        lat,
        lon
      };
    } else {
      state.selectedRegion = null;
    }
    state.userHasManuallyChangedDistrict = true;
    closeSearchPopover();
    syncDistrictDropdown();
    updateLocationBanner();
    fetchWeatherForecast();
  };

  async function performAsyncLocationSearch(query) {
    const spinner = document.getElementById('weather-search-spinner');
    const recentsSec = document.getElementById('popover-recents-section');
    const quickSec = document.getElementById('popover-quick-districts-section');
    const resultsSec = document.getElementById('popover-results-section');
    const resultsList = document.getElementById('popover-results-list');

    if (spinner) spinner.classList.remove('hidden');

    try {
      const res = await fetch(`${SEARCH_API_BASE}?q=${encodeURIComponent(query)}&district=${encodeURIComponent(state.district !== 'all' ? state.district : '')}`);
      const json = await res.json();

      if (spinner) spinner.classList.add('hidden');

      if (recentsSec) recentsSec.classList.add('hidden');
      if (quickSec) quickSec.classList.add('hidden');
      if (resultsSec) resultsSec.classList.remove('hidden');

      if (!json.success || !json.results || json.results.length === 0) {
        if (resultsList) {
          resultsList.innerHTML = `
            <div style="font-size: 0.78rem; color: var(--weather-text-muted); padding: 0.6rem 0.3rem;">
              No localities found in Tamil Nadu matching "${escapeHtml(query)}".
            </div>
          `;
        }
        return;
      }

      if (resultsList) {
        resultsList.innerHTML = json.results.map(item => `
          <div class="popover-item" onclick="handleSearchResultClick('${escapeHtml(item.name)}', '${escapeHtml(item.district || '')}', ${item.lat}, ${item.lon}, '${item.type}')">
            <div class="popover-item-main">
              <span class="popover-item-name">${escapeHtml(item.name)}</span>
              <span class="popover-item-sub">${escapeHtml(item.displayName || `${item.district}, Tamil Nadu`)}</span>
            </div>
            <span class="popover-item-type">${item.type === 'district' ? 'District' : 'Region'}</span>
          </div>
        `).join('');
      }
    } catch {
      if (spinner) spinner.classList.add('hidden');
    }
  }

  window.handleSearchResultClick = function (name, district, lat, lon, type) {
    const targetDistrict = district || name;
    state.district = targetDistrict.toLowerCase();

    if (type === 'district') {
      state.selectedRegion = null;
    } else {
      state.selectedRegion = {
        name,
        locality: name,
        district: targetDistrict,
        lat,
        lon
      };
      saveRecentLocation(state.selectedRegion);
    }

    state.userHasManuallyChangedDistrict = true;
    closeSearchPopover();
    syncDistrictDropdown();
    updateLocationBanner();
    fetchWeatherForecast();
  };

  /**
   * "Use My Current Location" Handler.
   */
  window.useCurrentLocation = async function () {
    state.isDetectingLocation = true;
    updateLocationBanner();
    closeSearchPopover();

    if (window.CrowdCityLocation && typeof window.CrowdCityLocation.detectSpecificLocation === 'function') {
      try {
        const spec = await window.CrowdCityLocation.detectSpecificLocation(true, 'en', 6000);
        if (spec && spec.district) {
          state.userDetectedDistrict = spec.district;
          state.district = spec.district.toLowerCase();
          if (spec.lat && (spec.lon || spec.lng)) {
            state.userCoordinates = { lat: spec.lat, lon: spec.lon || spec.lng };
            state.selectedRegion = {
              name: spec.specificName || spec.district,
              locality: spec.specificName || spec.district,
              district: spec.district,
              lat: spec.lat,
              lon: spec.lon || spec.lng
            };
          } else {
            state.selectedRegion = null;
          }
          state.userHasManuallyChangedDistrict = false;
        }
      } catch (e) {
        console.warn('[WeatherAlerts] detectSpecificLocation fallback:', e);
      }
    } else if (window.CrowdCityLocation && typeof window.CrowdCityLocation.detectUserDistrict === 'function') {
      try {
        const det = await window.CrowdCityLocation.detectUserDistrict({ timeoutMs: 5000, requestGps: true });
        if (det) {
          state.userDetectedDistrict = det;
          state.district = det.toLowerCase();
          state.selectedRegion = null;
          state.userHasManuallyChangedDistrict = false;
        }
      } catch {}
    }

    state.isDetectingLocation = false;
    updateLocationBanner();
    syncDistrictDropdown();
    fetchWeatherForecast();
  };

  // State Box Helpers
  function hideStateBoxes() {
    const emptyState = document.getElementById('weather-empty-state');
    const unavailBox = document.getElementById('weather-unavailable-box');
    const errBox = document.getElementById('weather-error-state');
    if (emptyState) emptyState.classList.add('hidden');
    if (unavailBox) unavailBox.classList.add('hidden');
    if (errBox) errBox.classList.add('hidden');
  }

  function showUnavailableBox(msg) {
    const box = document.getElementById('weather-unavailable-box');
    if (box) {
      box.classList.remove('hidden');
      const p = (typeof box.querySelector === 'function') ? box.querySelector('p') : null;
      if (p && msg) p.textContent = msg;
    }
  }

  function showErrorBox(msg) {
    const box = document.getElementById('weather-error-state');
    if (box) {
      box.classList.remove('hidden');
      const p = document.getElementById('weather-error-message');
      if (p && msg) p.textContent = msg;
    }
  }

  // Lifecycle Initialization
  async function init() {
    loadRecentLocations();
    await populateDistrictsDropdown();
    await initializeUserLocation();
    setupEventListeners();
    await fetchWeatherForecast();
  }

  // Global Exports for button bindings and tests
  window.fetchWeatherForecast = fetchWeatherForecast;
  window.useCurrentLocation = window.useCurrentLocation;
  window.selectUserDetectedDistrict = window.selectUserDetectedDistrict;
  window.selectRegion = window.selectRegion;
  window.setWeatherTimeframeTab = window.setWeatherTimeframeTab;
  window.resetWeatherFilters = window.resetWeatherFilters;
  window.scrollHourly = window.scrollHourly;
  window.clearRecentLocations = window.clearRecentLocations;
  window.handleWeatherBackNavigation = handleWeatherBackNavigation;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
