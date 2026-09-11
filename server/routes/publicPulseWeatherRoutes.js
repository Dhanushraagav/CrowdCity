/**
 * publicPulseWeatherRoutes.js
 * 
 * Express routes for Official IMD Weather Alerts under Public Pulse.
 * Endpoint: GET /api/public-pulse/weather-alerts
 */

import express from 'express';
import { getWeatherAlerts, IMD_OFFICIAL_SOURCE } from '../services/weatherAlertService.js';
import logger from '../config/logger.js';

const router = express.Router();

/**
 * @route   GET /api/public-pulse/weather-alerts
 * @desc    Get official IMD weather alerts for Tamil Nadu with filters
 * @access  Public
 */
const handleWeatherAlerts = async (req, res) => {
  try {
    const { district, date, severity, refresh } = req.query;
    const result = await getWeatherAlerts({
      district,
      date,
      severity,
      refresh
    });

    // Cache control: 5 minutes browser cache, 10 minutes stale-while-revalidate
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    return res.status(200).json(result);
  } catch (error) {
    logger.error(`[PublicPulseWeatherRoutes] Error retrieving weather alerts: ${error.message}`);
    return res.status(500).json({
      success: false,
      source_available: false,
      error: 'Failed to retrieve weather alerts',
      alerts: [],
      source: IMD_OFFICIAL_SOURCE
    });
  }
};

// Mount handler for both base and explicit paths
router.get('/', handleWeatherAlerts);
router.get('/weather-alerts', handleWeatherAlerts);

/**
 * @route   GET /api/public-pulse/weather-alerts/status
 * @desc    Get official IMD source metadata, attribution, and status
 * @access  Public
 */
router.get('/status', (req, res) => {
  return res.status(200).json({
    success: true,
    source: IMD_OFFICIAL_SOURCE,
    coverage: 'Tamil Nadu (38 Districts)',
    endpoints: {
      official_portal: 'https://mausam.imd.gov.in/',
      api_portal: 'https://api.imd.gov.in/public/index.php',
      district_warning_api: 'https://mausam.imd.gov.in/api/warnings_district_api.php'
    },
    documentation: 'https://mausam.imd.gov.in/imd_latest/contents/api.pdf'
  });
});

export default router;
