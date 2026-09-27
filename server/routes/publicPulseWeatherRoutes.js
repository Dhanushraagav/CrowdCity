/**
 * publicPulseWeatherRoutes.js
 * 
 * Express routes for Weather Forecast under Public Pulse.
 * Powered by Open-Meteo API (https://api.open-meteo.com/v1/forecast).
 * 
 * Primary Endpoints:
 * - GET /api/public-pulse/weather
 * - GET /api/public-pulse/weather/status
 */

import express from 'express';
import { getWeatherForecast, OPEN_METEO_SOURCE } from '../services/weatherService.js';
import { searchLocations, getTopLocalitiesForDistrict } from '../services/locationSearchService.js';
import logger from '../config/logger.js';

const router = express.Router();

/**
 * @route   GET /api/public-pulse/weather/search
 * @desc    Search Tamil Nadu districts and localities with authentic coordinates
 * @access  Public
 */
const handleLocationSearch = async (req, res) => {
  try {
    const { q, query, district, limit } = req.query;
    const searchTerm = q || query || '';
    const results = await searchLocations(searchTerm, {
      district,
      limit: limit ? parseInt(limit, 10) : 8
    });
    res.setHeader('Cache-Control', 'public, max-age=600, stale-while-revalidate=1200');
    return res.status(200).json(results);
  } catch (err) {
    logger.error(`[PublicPulseWeatherRoutes] Search error: ${err.message}`);
    return res.status(500).json({ success: false, error: 'Location search failed', results: [] });
  }
};

/**
 * @route   GET /api/public-pulse/weather/localities
 * @desc    Get top curated localities for a selected district
 * @access  Public
 */
const handleTopLocalities = (req, res) => {
  try {
    const { district } = req.query;
    const localities = getTopLocalitiesForDistrict(district);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).json({ success: true, district, localities });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message, localities: [] });
  }
};

/**
 * @route   GET /api/public-pulse/weather
 * @desc    Get Open-Meteo weather forecast for Tamil Nadu districts or specific localities
 * @access  Public
 */
const handleWeatherForecast = async (req, res) => {
  try {
    const { district, lat, lon, latitude, longitude, days, refresh, locality, displayName, name } = req.query;
    const resolvedLat = lat || latitude;
    const resolvedLon = lon || longitude;
    const resolvedLocality = locality || name;

    const result = await getWeatherForecast({
      district,
      locality: resolvedLocality,
      displayName,
      lat: resolvedLat !== undefined ? parseFloat(resolvedLat) : undefined,
      lon: resolvedLon !== undefined ? parseFloat(resolvedLon) : undefined,
      days: days ? parseInt(days, 10) : 5,
      refresh
    });

    // Cache control: 5 minutes browser cache, 10 minutes stale-while-revalidate
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    return res.status(200).json(result);
  } catch (error) {
    logger.error(`[PublicPulseWeatherRoutes] Error retrieving weather forecast: ${error.message}`);
    return res.status(500).json({
      success: false,
      source_available: false,
      error: 'Weather forecast data is temporarily unavailable.',
      districts_forecast: [],
      source: OPEN_METEO_SOURCE
    });
  }
};

// Location Search Endpoints
router.get('/search', handleLocationSearch);
router.get('/locations', handleLocationSearch);
router.get('/localities', handleTopLocalities);

// Weather Forecast Endpoints
router.get('/', handleWeatherForecast);
router.get('/weather', handleWeatherForecast);

// Backward-compatibility alias for legacy callers
router.get('/weather-alerts', handleWeatherForecast);

/**
 * @route   GET /api/public-pulse/weather/status
 * @desc    Get Open-Meteo source metadata, attribution, and status
 * @access  Public
 */
const handleStatus = (req, res) => {
  return res.status(200).json({
    success: true,
    source: OPEN_METEO_SOURCE,
    coverage: 'Tamil Nadu (38 Districts + Regional Localities)',
    endpoints: {
      forecast_api: 'https://api.open-meteo.com/v1/forecast',
      official_portal: 'https://open-meteo.com/',
      documentation: 'https://open-meteo.com/en/docs',
      geocoding_api: 'https://geocoding-api.open-meteo.com/v1/search'
    }
  });
};

router.get('/status', handleStatus);
router.get('/weather/status', handleStatus);

export default router;
