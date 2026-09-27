/**
 * weatherService.js
 * 
 * Open-Meteo Weather Forecast Service for CrowdCity.
 * Provides live 5-day weather forecasts and current meteorological conditions
 * across all 38 districts of Tamil Nadu.
 * 
 * Data Source: Open-Meteo Weather Forecast API (https://api.open-meteo.com/v1/forecast)
 * - Free, documented, no API key required
 * - Server-side only (frontend never calls Open-Meteo directly)
 * - 15-minute memory cache with stale fallback
 * - WMO weather interpretation code mapping (0 to 99)
 * - Asia/Kolkata (IST) timezone
 * - STRICTLY NO EMOJIS and NO DUMMY DATA
 */

import { TN_DISTRICTS, getDistrictById } from '../config/districtsConfig.js';
import { getRegionsForDistrict, calculateDistanceKm } from './locationSearchService.js';
import logger from '../config/logger.js';

// Official Open-Meteo Source Attribution
export const OPEN_METEO_SOURCE = {
  name: 'Open-Meteo',
  url: 'https://open-meteo.com/',
  documentation: 'https://open-meteo.com/en/docs',
  attribution: 'Weather data provided by Open-Meteo'
};

const OPEN_METEO_BASE_URL = 'https://api.open-meteo.com/v1/forecast';
const REQUEST_TIMEOUT_MS = 12000;
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

// WMO Weather Interpretation Codes (WMO Code -> Description & FontAwesome Icon)
export const WMO_WEATHER_CODES = {
  0: { label: 'Clear sky', icon: 'fa-sun' },
  1: { label: 'Mainly clear', icon: 'fa-cloud-sun' },
  2: { label: 'Partly cloudy', icon: 'fa-cloud-sun' },
  3: { label: 'Overcast', icon: 'fa-cloud' },
  45: { label: 'Fog', icon: 'fa-smog' },
  48: { label: 'Depositing rime fog', icon: 'fa-smog' },
  51: { label: 'Light drizzle', icon: 'fa-cloud-rain' },
  53: { label: 'Moderate drizzle', icon: 'fa-cloud-rain' },
  55: { label: 'Dense drizzle', icon: 'fa-cloud-rain' },
  56: { label: 'Light freezing drizzle', icon: 'fa-snowflake' },
  57: { label: 'Dense freezing drizzle', icon: 'fa-snowflake' },
  61: { label: 'Slight rain', icon: 'fa-cloud-rain' },
  63: { label: 'Moderate rain', icon: 'fa-cloud-showers-heavy' },
  65: { label: 'Heavy rain', icon: 'fa-cloud-showers-heavy' },
  66: { label: 'Light freezing rain', icon: 'fa-snowflake' },
  67: { label: 'Heavy freezing rain', icon: 'fa-snowflake' },
  71: { label: 'Slight snow fall', icon: 'fa-snowflake' },
  73: { label: 'Moderate snow fall', icon: 'fa-snowflake' },
  75: { label: 'Heavy snow fall', icon: 'fa-snowflake' },
  77: { label: 'Snow grains', icon: 'fa-snowflake' },
  80: { label: 'Slight rain showers', icon: 'fa-cloud-showers-heavy' },
  81: { label: 'Moderate rain showers', icon: 'fa-cloud-showers-heavy' },
  82: { label: 'Violent rain showers', icon: 'fa-cloud-showers-heavy' },
  85: { label: 'Slight snow showers', icon: 'fa-snowflake' },
  86: { label: 'Heavy snow showers', icon: 'fa-snowflake' },
  95: { label: 'Thunderstorm', icon: 'fa-cloud-bolt' },
  96: { label: 'Thunderstorm with slight hail', icon: 'fa-cloud-bolt' },
  99: { label: 'Thunderstorm with heavy hail', icon: 'fa-cloud-bolt' }
};

/**
 * Resolve WMO code to human-readable condition & FontAwesome icon class.
 */
export function getWMOInterpretation(code) {
  const num = typeof code === 'number' ? code : parseInt(code, 10);
  if (!isNaN(num) && WMO_WEATHER_CODES[num]) {
    return WMO_WEATHER_CODES[num];
  }
  return { label: 'Partly cloudy', icon: 'fa-cloud-sun' };
}

// In-Memory Cache Store
let memoryCache = {
  districtsData: null, // Map of districtId -> normalized weather object
  lastUpdatedTimestamp: null,
  lastUpdatedIST: null,
  isStale: false
};

// Test fixture hook for automated unit tests
let mockFetchFixture = null;

export function setMockFixtures(fixtureOrFn) {
  mockFetchFixture = fixtureOrFn;
}

export function clearCache() {
  memoryCache = {
    districtsData: null,
    lastUpdatedTimestamp: null,
    lastUpdatedIST: null,
    isStale: false
  };
}

/**
 * Format timestamp in Asia/Kolkata (IST).
 */
export function getCurrentISTTimestamp(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }).format(d) + ' IST';
}

/**
 * Format an ISO date or time string into display format.
 */
export function formatTimeIST(isoTimeStr) {
  if (!isoTimeStr) return '--';
  try {
    const d = new Date(isoTimeStr);
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(d);
  } catch {
    return isoTimeStr;
  }
}

export function formatDateIST(isoDateStr) {
  if (!isoDateStr) return '--';
  try {
    const [year, month, day] = isoDateStr.split('-').map(Number);
    const d = new Date(Date.UTC(year, month - 1, day));
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(d);
  } catch {
    return isoDateStr;
  }
}

export function formatHourLabel(isoTimeStr) {
  if (!isoTimeStr) return '--';
  try {
    const d = new Date(isoTimeStr);
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      hour12: true
    }).format(d).toUpperCase();
  } catch {
    return isoTimeStr;
  }
}

/**
 * Generate truthful, condition-based insights strictly from real weather values.
 */
export function generateWeatherInsights(current, hourly = [], daily = []) {
  const insights = [];
  if (!current) return insights;

  const today = daily && daily[0] ? daily[0] : null;

  // 1. Precipitation & Storm Insights
  if (current.weather_code >= 95) {
    insights.push({
      type: 'thunderstorm',
      icon: 'fa-cloud-bolt',
      title: 'Thunderstorm Advisory',
      desc: 'Active convective activity with possible lightning and sudden wind gusts.'
    });
  } else if (current.precipitation_mm > 0) {
    insights.push({
      type: 'rain',
      icon: 'fa-cloud-showers-heavy',
      title: 'Active Rainfall',
      desc: `Currently experiencing ${current.precipitation_mm} mm of precipitation.`
    });
  } else if (today && today.precipitation_probability_pct >= 55) {
    insights.push({
      type: 'rain',
      icon: 'fa-cloud-rain',
      title: 'Rain Expected Today',
      desc: `Elevated precipitation chance (${today.precipitation_probability_pct}%) during the day.`
    });
  } else if (today && today.precipitation_probability_pct >= 25) {
    insights.push({
      type: 'rain',
      icon: 'fa-cloud-sun-rain',
      title: 'Scattered Showers Possible',
      desc: `${today.precipitation_probability_pct}% chance of isolated or passing showers.`
    });
  } else {
    insights.push({
      type: 'clear',
      icon: current.is_day ? 'fa-sun' : 'fa-moon',
      title: current.is_day ? 'Dry Weather Prevailing' : 'Clear Night Atmosphere',
      desc: 'Low rain likelihood anticipated for the region today.'
    });
  }

  // 2. Temperature Insights
  if (today && typeof today.temperature_max_c === 'number') {
    const maxT = today.temperature_max_c;
    const minT = today.temperature_min_c;
    const title = maxT >= 36 ? 'High Heat Advisory' : (maxT >= 32 ? 'Warm Daytime Peak' : 'Mild & Comfortable');
    insights.push({
      type: 'temperature',
      icon: 'fa-temperature-half',
      title,
      desc: `Daytime peak expected to reach ${maxT}°C with an overnight low around ${minT}°C.`
    });
  }

  // 3. Humidity or Wind or Visibility Insight
  if (current.relative_humidity_pct && current.relative_humidity_pct >= 80) {
    insights.push({
      type: 'humidity',
      icon: 'fa-droplets',
      title: 'Elevated Humidity',
      desc: `Relative humidity at ${current.relative_humidity_pct}%. Air feels moist and heavy.`
    });
  } else if (current.wind_speed_kmh && current.wind_speed_kmh >= 18) {
    insights.push({
      type: 'wind',
      icon: 'fa-wind',
      title: 'Breezy Conditions',
      desc: `Sustained wind speed of ${current.wind_speed_kmh} km/h with gusts up to ${current.wind_gusts_kmh || current.wind_speed_kmh} km/h.`
    });
  } else if (typeof current.visibility_km === 'number' && current.visibility_km >= 8) {
    insights.push({
      type: 'visibility',
      icon: 'fa-eye',
      title: 'Optimal Visibility',
      desc: `Clear optical visibility of approximately ${current.visibility_km} km across the area.`
    });
  }

  return insights;
}

/**
 * Fetch raw forecast data from Open-Meteo for specified coordinates.
 */
async function fetchFromOpenMeteo(lats, lngs, includeHourly = false) {
  if (mockFetchFixture) {
    if (typeof mockFetchFixture === 'function') {
      return await mockFetchFixture({ lats, lngs });
    }
    return mockFetchFixture;
  }

  const currentParams = [
    'temperature_2m',
    'relative_humidity_2m',
    'apparent_temperature',
    'is_day',
    'precipitation',
    'rain',
    'showers',
    'weather_code',
    'wind_speed_10m',
    'wind_gusts_10m',
    'visibility'
  ].join(',');

  const dailyParams = [
    'weather_code',
    'temperature_2m_max',
    'temperature_2m_min',
    'apparent_temperature_max',
    'apparent_temperature_min',
    'precipitation_sum',
    'rain_sum',
    'precipitation_probability_max',
    'wind_speed_10m_max',
    'wind_gusts_10m_max',
    'sunrise',
    'sunset'
  ].join(',');

  const hourlyParams = [
    'temperature_2m',
    'relative_humidity_2m',
    'precipitation_probability',
    'weather_code',
    'is_day'
  ].join(',');

  let url = `${OPEN_METEO_BASE_URL}?latitude=${lats}&longitude=${lngs}` +
    `&current=${currentParams}` +
    `&daily=${dailyParams}` +
    `&timezone=Asia/Kolkata` +
    `&forecast_days=5`;

  if (includeHourly) {
    url += `&hourly=${hourlyParams}`;
  }

  let lastErr = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'CrowdCity-CivicTech/2.0'
        }
      });

      if (!res.ok) {
        throw new Error(`Open-Meteo returned HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      return data;
    } catch (err) {
      lastErr = err;
      if (attempt === 0) {
        await new Promise(r => setTimeout(r, 400));
      }
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastErr;
}

/**
 * Normalize Open-Meteo raw payload for a single district or locality.
 */
export function normalizeDistrictForecast(district, rawForecast) {
  if (!district || !rawForecast) return null;

  const currentRaw = rawForecast.current || {};
  const dailyRaw = rawForecast.daily || {};
  const hourlyRaw = rawForecast.hourly || {};

  const currentWmo = getWMOInterpretation(currentRaw.weather_code);

  const current = {
    time: currentRaw.time || null,
    time_ist: formatTimeIST(currentRaw.time),
    temperature_c: typeof currentRaw.temperature_2m === 'number' ? Math.round(currentRaw.temperature_2m * 10) / 10 : null,
    apparent_temperature_c: typeof currentRaw.apparent_temperature === 'number' ? Math.round(currentRaw.apparent_temperature * 10) / 10 : null,
    relative_humidity_pct: typeof currentRaw.relative_humidity_2m === 'number' ? currentRaw.relative_humidity_2m : null,
    precipitation_mm: typeof currentRaw.precipitation === 'number' ? currentRaw.precipitation : 0,
    rain_mm: typeof currentRaw.rain === 'number' ? currentRaw.rain : 0,
    showers_mm: typeof currentRaw.showers === 'number' ? currentRaw.showers : 0,
    weather_code: typeof currentRaw.weather_code === 'number' ? currentRaw.weather_code : 0,
    condition: currentWmo.label,
    icon_class: currentWmo.icon,
    wind_speed_kmh: typeof currentRaw.wind_speed_10m === 'number' ? Math.round(currentRaw.wind_speed_10m * 10) / 10 : 0,
    wind_gusts_kmh: typeof currentRaw.wind_gusts_10m === 'number' ? Math.round(currentRaw.wind_gusts_10m * 10) / 10 : 0,
    is_day: typeof currentRaw.is_day === 'number' ? currentRaw.is_day : 1,
    visibility_km: typeof currentRaw.visibility === 'number' ? Math.round((currentRaw.visibility / 1000) * 10) / 10 : (typeof currentRaw.visibility_km === 'number' ? currentRaw.visibility_km : 10.0)
  };

  const dailyTimes = Array.isArray(dailyRaw.time) ? dailyRaw.time : [];
  const dayLabels = ['Today', 'Tomorrow', 'Day 3', 'Day 4', 'Day 5'];

  const daily = dailyTimes.slice(0, 5).map((dateStr, idx) => {
    const code = dailyRaw.weather_code ? dailyRaw.weather_code[idx] : 0;
    const wmo = getWMOInterpretation(code);

    const sunriseRaw = Array.isArray(dailyRaw.sunrise) ? dailyRaw.sunrise[idx] : null;
    const sunsetRaw = Array.isArray(dailyRaw.sunset) ? dailyRaw.sunset[idx] : null;

    return {
      day_index: idx + 1,
      day_label: dayLabels[idx] || `Day ${idx + 1}`,
      date: dateStr,
      date_formatted: formatDateIST(dateStr),
      weather_code: typeof code === 'number' ? code : 0,
      condition: wmo.label,
      icon_class: wmo.icon,
      temperature_max_c: Array.isArray(dailyRaw.temperature_2m_max) ? Math.round(dailyRaw.temperature_2m_max[idx] * 10) / 10 : null,
      temperature_min_c: Array.isArray(dailyRaw.temperature_2m_min) ? Math.round(dailyRaw.temperature_2m_min[idx] * 10) / 10 : null,
      apparent_temperature_max_c: Array.isArray(dailyRaw.apparent_temperature_max) ? Math.round(dailyRaw.apparent_temperature_max[idx] * 10) / 10 : null,
      apparent_temperature_min_c: Array.isArray(dailyRaw.apparent_temperature_min) ? Math.round(dailyRaw.apparent_temperature_min[idx] * 10) / 10 : null,
      precipitation_sum_mm: Array.isArray(dailyRaw.precipitation_sum) ? Math.round(dailyRaw.precipitation_sum[idx] * 10) / 10 : 0,
      rain_sum_mm: Array.isArray(dailyRaw.rain_sum) ? Math.round(dailyRaw.rain_sum[idx] * 10) / 10 : 0,
      precipitation_probability_pct: Array.isArray(dailyRaw.precipitation_probability_max) ? dailyRaw.precipitation_probability_max[idx] : 0,
      wind_speed_max_kmh: Array.isArray(dailyRaw.wind_speed_10m_max) ? Math.round(dailyRaw.wind_speed_10m_max[idx] * 10) / 10 : 0,
      wind_gusts_max_kmh: Array.isArray(dailyRaw.wind_gusts_10m_max) ? Math.round(dailyRaw.wind_gusts_10m_max[idx] * 10) / 10 : 0,
      sunrise: formatTimeIST(sunriseRaw),
      sunset: formatTimeIST(sunsetRaw)
    };
  });

  // Hourly Forecast Normalization (next 24 hours)
  let hourly = [];
  if (Array.isArray(hourlyRaw.time) && hourlyRaw.time.length > 0) {
    const nowMs = Date.now();
    let startIdx = 0;
    for (let i = 0; i < hourlyRaw.time.length; i++) {
      const t = new Date(hourlyRaw.time[i]).getTime();
      if (t >= nowMs - 45 * 60 * 1000) {
        startIdx = i;
        break;
      }
    }

    const next24 = hourlyRaw.time.slice(startIdx, startIdx + 24);
    hourly = next24.map((timeStr, offset) => {
      const idx = startIdx + offset;
      const code = hourlyRaw.weather_code ? hourlyRaw.weather_code[idx] : 0;
      const wmo = getWMOInterpretation(code);
      const temp = hourlyRaw.temperature_2m ? Math.round(hourlyRaw.temperature_2m[idx] * 10) / 10 : null;
      const precipProb = hourlyRaw.precipitation_probability ? hourlyRaw.precipitation_probability[idx] : 0;
      const isDay = hourlyRaw.is_day ? hourlyRaw.is_day[idx] : 1;

      return {
        time: timeStr,
        time_ist: formatTimeIST(timeStr),
        hour_label: formatHourLabel(timeStr),
        is_now: offset === 0,
        temperature_c: temp,
        precipitation_probability_pct: precipProb,
        weather_code: typeof code === 'number' ? code : 0,
        condition: wmo.label,
        icon_class: wmo.icon,
        is_day: isDay
      };
    });
  }

  const insights = generateWeatherInsights(current, hourly, daily);

  return {
    district: {
      id: district.id,
      name: district.name,
      nameTa: district.nameTa || district.name,
      locality: district.locality || null,
      displayName: district.displayName || (district.locality ? `${district.locality}, ${district.name}` : district.name),
      code: district.code || 'TN',
      lat: district.lat,
      lng: district.lng || district.lon
    },
    current,
    daily,
    hourly,
    insights
  };
}

/**
 * Fetch and populate cache for all 38 Tamil Nadu districts.
 */
async function refreshAllDistrictsCache() {
  const validDistricts = TN_DISTRICTS.filter(d => typeof d.lat === 'number' && typeof d.lng === 'number');

  if (validDistricts.length === 0) {
    throw new Error('No valid district coordinates found in master location data.');
  }

  const lats = validDistricts.map(d => d.lat).join(',');
  const lngs = validDistricts.map(d => d.lng).join(',');

  const rawResponses = await fetchFromOpenMeteo(lats, lngs);

  // When querying multiple locations, Open-Meteo returns an array of response objects
  const responseList = Array.isArray(rawResponses) ? rawResponses : [rawResponses];

  const map = new Map();
  validDistricts.forEach((dist, idx) => {
    const raw = responseList[idx];
    if (raw) {
      const normalized = normalizeDistrictForecast(dist, raw);
      if (normalized) {
        map.set(dist.id.toLowerCase(), normalized);
      }
    }
  });

  memoryCache.districtsData = map;
  memoryCache.lastUpdatedTimestamp = Date.now();
  memoryCache.lastUpdatedIST = getCurrentISTTimestamp();
  memoryCache.isStale = false;

  logger.info(`[WeatherService] Cached Open-Meteo forecast for ${map.size} districts.`);
  return map;
}

/**
 * Main function to retrieve Weather Forecast data.
 * Supports:
 * - Specific district: ?district=coimbatore
 * - All districts: ?district=all (or omitted)
 * - Cache bypass: ?refresh=true
 */
export async function getWeatherForecast(options = {}) {
  const { district: reqDistrict, refresh = false } = options;
  const now = Date.now();
  const isCacheValid = memoryCache.districtsData &&
    memoryCache.lastUpdatedTimestamp &&
    (now - memoryCache.lastUpdatedTimestamp) < CACHE_TTL_MS;

  const forceRefresh = refresh === true || refresh === 'true';

  let districtsMap = memoryCache.districtsData;

  if (!isCacheValid || forceRefresh || !districtsMap) {
    try {
      districtsMap = await refreshAllDistrictsCache();
    } catch (err) {
      logger.error(`[WeatherService] Failed to fetch live Open-Meteo data: ${err.message}`);

      // If we have stale cache, preserve and serve it
      if (memoryCache.districtsData && memoryCache.districtsData.size > 0) {
        districtsMap = memoryCache.districtsData;
        memoryCache.isStale = true;
      } else {
        // No cache and API failed: return controlled error (NO FAKE DATA)
        return {
          success: false,
          source_available: false,
          error: 'Weather forecast data is temporarily unavailable.',
          last_updated_ist: null,
          source: OPEN_METEO_SOURCE,
          districts_forecast: [],
          total_districts: 0
        };
      }
    }
  }

  // If specific district requested
  let targetDistrictId = null;
  let singleDistrictResult = null;

  if (reqDistrict && reqDistrict !== 'all' && typeof reqDistrict === 'string') {
    const resolved = getDistrictById(reqDistrict);
    if (!resolved) {
      return {
        success: false,
        source_available: true,
        error: `District "${reqDistrict}" not found in Tamil Nadu master data.`,
        district: reqDistrict,
        source: OPEN_METEO_SOURCE,
        districts_forecast: []
      };
    }
    targetDistrictId = resolved.id.toLowerCase();
    singleDistrictResult = districtsMap.get(targetDistrictId);

    if (!singleDistrictResult) {
      return {
        success: false,
        source_available: false,
        error: `Weather forecast unavailable for district "${resolved.name}". Coordinates missing.`,
        district: reqDistrict,
        source: OPEN_METEO_SOURCE,
        districts_forecast: []
      };
    }
  }

  const allForecasts = Array.from(districtsMap.values());

  // Default selected district: Chennai or the first available if not explicitly filtered
  const primaryDistrict = singleDistrictResult || districtsMap.get('chennai') || allForecasts[0] || null;

  // If a primary/requested district has no hourly data cached yet, fetch hourly on-demand (live authentic data)
  if (!mockFetchFixture && primaryDistrict && (!primaryDistrict.hourly || primaryDistrict.hourly.length === 0) && primaryDistrict.district && typeof primaryDistrict.district.lat === 'number') {
    try {
      const raw = await fetchFromOpenMeteo(primaryDistrict.district.lat, primaryDistrict.district.lng, true);
      if (raw && raw.hourly) {
        const full = normalizeDistrictForecast(primaryDistrict.district, raw);
        primaryDistrict.hourly = full.hourly;
        primaryDistrict.insights = full.insights;
        if (targetDistrictId && districtsMap.has(targetDistrictId)) {
          districtsMap.set(targetDistrictId, primaryDistrict);
        }
      }
    } catch (hourlyErr) {
      logger.warn(`[WeatherService] Hourly forecast fetch fallback for ${primaryDistrict.district.name}: ${hourlyErr.message}`);
    }
  }

  // If specific coordinates (lat, lon) provided, fetch full live weather (current + 5-day daily + 24-hr hourly + insights) for exact location
  if (typeof options.lat === 'number' && typeof options.lon === 'number' && !isNaN(options.lat) && !isNaN(options.lon)) {
    try {
      const raw = await fetchFromOpenMeteo(options.lat, options.lon, true);
      if (raw && raw.current) {
        const localityName = options.locality || null;
        const districtName = options.district || (primaryDistrict ? primaryDistrict.district.name : 'Tamil Nadu');
        const displayName = options.displayName || (localityName ? `${localityName}, ${districtName}` : `${districtName}, Tamil Nadu`);

        const locDistrict = {
          id: localityName ? localityName.toLowerCase().replace(/[^a-z0-9]/g, '-') : (districtName.toLowerCase().replace(/[^a-z0-9]/g, '-')),
          name: localityName || districtName,
          locality: localityName,
          district: districtName,
          displayName: displayName,
          nameTa: localityName || (primaryDistrict ? primaryDistrict.district.nameTa : 'தமிழ்நாடு'),
          code: districtName.slice(0, 3).toUpperCase(),
          lat: options.lat,
          lng: options.lon
        };

        const normalized = normalizeDistrictForecast(locDistrict, raw);

        return {
          success: true,
          source_available: true,
          is_stale: false,
          last_updated_ist: getCurrentISTTimestamp(),
          source: OPEN_METEO_SOURCE,
          coordinates: { lat: options.lat, lon: options.lon },
          location: locDistrict,
          current: normalized.current,
          hourly: normalized.hourly,
          daily: normalized.daily,
          insights: normalized.insights,
          current_district: normalized,
          districts_forecast: allForecasts,
          total_districts: allForecasts.length
        };
      }
    } catch (coordErr) {
      logger.warn(`[WeatherService] Coordinate weather fetch fallback: ${coordErr.message}`);
    }
  }

  return {
    success: true,
    source_available: true,
    is_stale: Boolean(memoryCache.isStale),
    last_updated_ist: memoryCache.lastUpdatedIST || getCurrentISTTimestamp(),
    source: OPEN_METEO_SOURCE,
    district: targetDistrictId || 'all',
    current_district: primaryDistrict,
    districts_forecast: allForecasts,
    total_districts: allForecasts.length
  };
}

const regionsWeatherCache = new Map();

/**
 * Batch-fetch live weather for all legitimate regions of a district.
 * Uses a single multi-coordinate request to Open-Meteo for speed and efficiency.
 */
export async function getDistrictRegionsWeather(districtId, userCoords = null) {
  if (!districtId || districtId === 'all') {
    return { success: false, error: 'District is required', regions: [] };
  }

  const regions = getRegionsForDistrict(districtId, userCoords);
  if (!regions || regions.length === 0) {
    return { success: false, error: 'No regions found for district', regions: [] };
  }

  const dKey = districtId.toLowerCase().replace(/[^a-z0-9]/g, '');
  const now = Date.now();
  const cached = regionsWeatherCache.get(dKey);

  if (cached && (now - cached.timestamp < 10 * 60 * 1000)) {
    let list = cached.data.map(r => ({
      ...r,
      distance_km: (userCoords && typeof userCoords.lat === 'number' && typeof userCoords.lon === 'number')
        ? calculateDistanceKm(userCoords.lat, userCoords.lon, r.lat, r.lon)
        : r.distance_km
    }));
    if (userCoords && typeof userCoords.lat === 'number' && typeof userCoords.lon === 'number') {
      list.sort((a, b) => (a.distance_km ?? 9999) - (b.distance_km ?? 9999));
    }
    return {
      success: true,
      district: districtId,
      last_updated_ist: cached.last_updated_ist || getCurrentISTTimestamp(),
      regions: list
    };
  }

  // Batch up to 16 top regions
  const topRegions = regions.slice(0, 16);
  const lats = topRegions.map(r => r.lat).join(',');
  const lngs = topRegions.map(r => r.lon).join(',');

  try {
    const rawResponses = await fetchFromOpenMeteo(lats, lngs, false);
    const respList = Array.isArray(rawResponses) ? rawResponses : [rawResponses];

    const results = topRegions.map((reg, idx) => {
      const raw = respList[idx];
      let current = null;
      if (raw && raw.current) {
        const wmo = getWMOInterpretation(raw.current.weather_code);
        current = {
          temperature_c: typeof raw.current.temperature_2m === 'number' ? Math.round(raw.current.temperature_2m * 10) / 10 : null,
          apparent_temperature_c: typeof raw.current.apparent_temperature === 'number' ? Math.round(raw.current.apparent_temperature * 10) / 10 : null,
          relative_humidity_pct: raw.current.relative_humidity_2m || 0,
          precipitation_mm: typeof raw.current.precipitation === 'number' ? raw.current.precipitation : 0,
          weather_code: raw.current.weather_code || 0,
          condition: wmo.label,
          icon_class: wmo.icon,
          wind_speed_kmh: typeof raw.current.wind_speed_10m === 'number' ? Math.round(raw.current.wind_speed_10m * 10) / 10 : 0,
          is_day: typeof raw.current.is_day === 'number' ? raw.current.is_day : 1
        };
      }
      return {
        ...reg,
        current
      };
    });

    const timestamp = getCurrentISTTimestamp();
    regionsWeatherCache.set(dKey, { timestamp: now, last_updated_ist: timestamp, data: results });

    return {
      success: true,
      district: districtId,
      last_updated_ist: timestamp,
      regions: results
    };
  } catch (err) {
    logger.warn(`[WeatherService] Failed to batch fetch regions weather: ${err.message}`);
    return {
      success: true,
      district: districtId,
      last_updated_ist: getCurrentISTTimestamp(),
      regions: topRegions.map(r => ({ ...r, current: null }))
    };
  }
}

export default {
  getWeatherForecast,
  getDistrictRegionsWeather,
  getWMOInterpretation,
  OPEN_METEO_SOURCE,
  WMO_WEATHER_CODES,
  setMockFixtures,
  clearCache,
  getCurrentISTTimestamp,
  normalizeDistrictForecast,
  generateWeatherInsights,
  formatHourLabel
};
