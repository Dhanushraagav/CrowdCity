import express from 'express';
import {
  getDistricts,
  getTaluksForDistrict,
  getBlocksForDistrict,
  getLocationsForTaluk,
  getLocalBodiesForLocation,
  searchLocations
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
 * 3. GET /api/locations/districts/:districtId/blocks
 * Returns Rural Development Blocks belonging to the requested district
 */
router.get('/districts/:districtId/blocks', async (req, res) => {
  try {
    const { districtId } = req.params;
    if (!districtId) {
      return res.status(400).json({ error: 'districtId parameter is required.' });
    }
    const blocks = await getBlocksForDistrict(districtId);
    return res.status(200).json({
      success: true,
      districtId,
      count: blocks.length,
      data: blocks,
      blocks
    });
  } catch (err) {
    logger.error('Error in GET /api/locations/districts/:districtId/blocks: %O', err);
    return res.status(500).json({ error: 'Failed to fetch blocks for district.' });
  }
});

/**
 * 4. GET /api/locations/taluks/:talukId/locations
 * Returns ALL valid villages/towns associated with that Taluk
 * Supports optional ?search= query parameter for instant filtering
 */
router.get('/taluks/:talukId/locations', async (req, res) => {
  try {
    const { talukId } = req.params;
    const { search, include_quarantined } = req.query;
    if (!talukId) {
      return res.status(400).json({ error: 'talukId parameter is required.' });
    }
    const locations = await getLocationsForTaluk(talukId, search || '', {
      includeQuarantined: include_quarantined === 'true'
    });
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
 * 5. GET /api/locations/search
 * High-performance search-first typeahead endpoint
 * Query params: ?q=...&district=...&type=...&limit=25
 */
router.get('/search', async (req, res) => {
  try {
    const { q, district, type, limit, include_quarantined } = req.query;
    const results = await searchLocations({
      query: q || '',
      districtId: district || '',
      adminType: type || '',
      limit: limit || 25,
      includeQuarantined: include_quarantined === 'true'
    });

    return res.status(200).json({
      success: true,
      query: q || '',
      district: district || null,
      type: type || null,
      count: results.length,
      data: results
    });
  } catch (err) {
    logger.error('Error in GET /api/locations/search: %O', err);
    return res.status(500).json({ error: 'Failed to execute location search.' });
  }
});

/**
 * 6. GET /api/locations/local-bodies
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
 * 7. GET /api/locations/locations/:locationId/local-bodies
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
