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
import logger from '../config/logger.js';

// Official Open-Meteo Source Attribution
export const OPEN_METEO_SOURCE = {
  name: 'Open-Meteo',
  url: 'https://open-meteo.com/',
  documentation: 'https://open-meteo.com/en/docs',
  attribution: 'Weather data provided by Open-Meteo'
};

const OPEN_METEO_BASE_URL = 'https://api.open-meteo.com/v1/forecast';
const REQUEST_TIMEOUT_MS = 6500;
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

/**
 * Fetch raw forecast data from Open-Meteo for specified coordinates.
 */
async function fetchFromOpenMeteo(lats, lngs) {
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
    'precipitation',
    'rain',
    'showers',
    'weather_code',
    'wind_speed_10m',
    'wind_gusts_10m'
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

  const url = `${OPEN_METEO_BASE_URL}?latitude=${lats}&longitude=${lngs}` +
    `&current=${currentParams}` +
    `&daily=${dailyParams}` +
    `&timezone=Asia/Kolkata` +
    `&forecast_days=5`;

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
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Normalize Open-Meteo raw payload for a single district.
 */
export function normalizeDistrictForecast(district, rawForecast) {
  if (!district || !rawForecast) return null;

  const currentRaw = rawForecast.current || {};
  const dailyRaw = rawForecast.daily || {};

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
    wind_gusts_kmh: typeof currentRaw.wind_gusts_10m === 'number' ? Math.round(currentRaw.wind_gusts_10m * 10) / 10 : 0
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

  return {
    district: {
      id: district.id,
      name: district.name,
      nameTa: district.nameTa || district.name,
      code: district.code,
      lat: district.lat,
      lng: district.lng
    },
    current,
    daily
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

export default {
  getWeatherForecast,
  getWMOInterpretation,
  OPEN_METEO_SOURCE,
  WMO_WEATHER_CODES,
  setMockFixtures,
  clearCache,
  getCurrentISTTimestamp,
  normalizeDistrictForecast
};
