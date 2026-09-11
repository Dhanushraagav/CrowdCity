import express from 'express';
import {
  getDistricts,
  getTaluksForDistrict,
  getLocationsForTaluk,
  getLocalBodiesForLocation
} from '../services/locationHierarchyService.js';
import logger from '../config/logger.js';

const router = express.Router();

/**
 * 1. GET /api/locations/districts
 * Returns all 38 districts of Tamil Nadu
 */
router.get('/districts', async (req, res) => {
  try {
    const districts = await getDistricts();
    return res.status(200).json({
      success: true,
      count: districts.length,
      data: districts,
      districts
    });
  } catch (err) {
    logger.error('Error in GET /api/locations/districts: %O', err);
    return res.status(500).json({ error: 'Failed to fetch districts.' });
  }
});

/**
 * 2. GET /api/locations/districts/:districtId/taluks
 * Returns Taluks strictly belonging to the requested district
 */
router.get('/districts/:districtId/taluks', async (req, res) => {
  try {
    const { districtId } = req.params;
    if (!districtId) {
      return res.status(400).json({ error: 'districtId parameter is required.' });
    }
    const taluks = await getTaluksForDistrict(districtId);
    return res.status(200).json({
      success: true,
      districtId,
      count: taluks.length,
      data: taluks,
      taluks
    });
  } catch (err) {
    logger.error('Error in GET /api/locations/districts/:districtId/taluks: %O', err);
    return res.status(500).json({ error: 'Failed to fetch taluks for district.' });
  }
});

/**
 * 3. GET /api/locations/taluks/:talukId/locations
 * Returns ALL valid villages/towns associated with that Taluk
 * Supports optional ?search= query parameter for instant filtering
 */
router.get('/taluks/:talukId/locations', async (req, res) => {
  try {
    const { talukId } = req.params;
    const { search } = req.query;
    if (!talukId) {
      return res.status(400).json({ error: 'talukId parameter is required.' });
    }
    const locations = await getLocationsForTaluk(talukId, search || '');
    return res.status(200).json({
      success: true,
      talukId,
      count: locations.length,
      data: locations,
      locations
    });
  } catch (err) {
    logger.error('Error in GET /api/locations/taluks/:talukId/locations: %O', err);
    return res.status(500).json({ error: 'Failed to fetch locations for taluk.' });
  }
});

/**
 * 4. GET /api/locations/local-bodies
 * Query params: ?district=...&taluk=...&village=...
 * Returns applicable local bodies for the selected hierarchy
 */
router.get('/local-bodies', async (req, res) => {
  try {
    const { district, taluk, village } = req.query;
    if (!district && !taluk) {
      return res.status(400).json({ error: 'At least district or taluk query parameter is required.' });
    }
    const localBodies = await getLocalBodiesForLocation({
      districtId: district,
      talukId: taluk,
      villageName: village
    });
    return res.status(200).json({
      success: true,
      count: localBodies.length,
      data: localBodies,
      localBodies
    });
  } catch (err) {
    logger.error('Error in GET /api/locations/local-bodies: %O', err);
    return res.status(500).json({ error: 'Failed to fetch local bodies.' });
  }
});

/**
 * 5. GET /api/locations/locations/:locationId/local-bodies
 * Returns applicable local bodies for a specific location
 */
router.get('/locations/:locationId/local-bodies', async (req, res) => {
  try {
    const { locationId } = req.params;
    const { district, taluk } = req.query;
    const localBodies = await getLocalBodiesForLocation({
      districtId: district,
      talukId: taluk,
      locationId
    });
    return res.status(200).json({
      success: true,
      locationId,
      count: localBodies.length,
      data: localBodies,
      localBodies
    });
  } catch (err) {
    logger.error('Error in GET /api/locations/locations/:locationId/local-bodies: %O', err);
    return res.status(500).json({ error: 'Failed to fetch local bodies for location.' });
  }
});

export default router;
