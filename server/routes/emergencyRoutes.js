/**
 * emergencyRoutes.js
 * 
 * Express routes for location-first emergency services discovery across Tamil Nadu.
 */

import express from 'express';
import { getNearbyEmergencyServices, getOfficialSourceStatus } from '../services/emergencyService.js';
import logger from '../config/logger.js';

const router = express.Router();

/**
 * GET /api/emergency-services/nearby
 * Discovers nearby hospitals, ambulances, police stations, and fire stations
 * Query params:
 * - lat, lng: User's GPS coordinates
 * - districtId: Optional manual district fallback
 * - type: Optional service type filter ('hospital', 'ambulance', 'police_station', 'fire_station')
 * - radius: Optional search radius in km (default: 35)
 * - limit: Optional result limit per category (default: 5)
 */
router.get('/nearby', async (req, res) => {
  try {
    const { lat, lng, latitude, longitude, districtId, type, serviceType, radius, radiusKm, limit } = req.query;

    const userLat = latitude || lat;
    const userLng = longitude || lng;
    const selectedType = serviceType || type;
    const searchRadius = radius || radiusKm ? parseFloat(radius || radiusKm) : 35;
    const resultLimit = limit ? parseInt(limit, 10) : 5;

    const results = await getNearbyEmergencyServices({
      latitude: userLat,
      longitude: userLng,
      districtId,
      serviceType: selectedType,
      radiusKm: searchRadius,
      limit: resultLimit
    });

    if (!results.success && !results.location) {
      return res.status(400).json(results);
    }

    return res.status(200).json(results);
  } catch (err) {
    logger.error('[EmergencyRoutes] Error in /api/emergency-services/nearby: %O', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to discover nearby emergency services.'
    });
  }
});

/**
 * GET /api/emergency-services/status
 * Returns official verification status and source attributions
 */
router.get('/status', (req, res) => {
  try {
    const status = getOfficialSourceStatus();
    return res.status(200).json({
      success: true,
      ...status
    });
  } catch (err) {
    logger.error('[EmergencyRoutes] Error in /api/emergency-services/status: %O', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch emergency service status.'
    });
  }
});

export default router;
