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
import logger from '../config/logger.js';

const router = express.Router();

/**
 * @route   GET /api/public-pulse/weather
 * @desc    Get Open-Meteo weather forecast for Tamil Nadu districts
 * @access  Public
 */
const handleWeatherForecast = async (req, res) => {
  try {
    const { district, days, refresh } = req.query;
    const result = await getWeatherForecast({
      district,
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

// Mount handler for primary paths
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
    coverage: 'Tamil Nadu (38 Districts)',
    endpoints: {
      forecast_api: 'https://api.open-meteo.com/v1/forecast',
      official_portal: 'https://open-meteo.com/',
      documentation: 'https://open-meteo.com/en/docs'
    }
  });
};

router.get('/status', handleStatus);
router.get('/weather/status', handleStatus);

export default router;
