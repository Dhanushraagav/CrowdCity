/**
 * tourismRoutes.js
 * 
 * Express routes for Tamil Nadu Tourism (தமிழ்நாடு சுற்றுலாத் தலங்கள்) feature in Public Pulse.
 * Uses official TN_DISTRICTS configuration and verified Government of Tamil Nadu places data.
 */

import express from 'express';
import { TN_DISTRICTS } from '../config/districtsConfig.js';
import { TN_TOURISM_PLACES, TOURISM_CATEGORIES } from '../data/tnTourismPlaces.js';
import logger from '../config/logger.js';

const router = express.Router();

/**
 * GET /api/tourism/districts
 * Returns all 38 districts of Tamil Nadu from authoritative districtsConfig
 * along with verified place counts for each district.
 */
router.get('/districts', (req, res) => {
  try {
    const districtsWithStats = TN_DISTRICTS.map(district => {
      const placesInDistrict = TN_TOURISM_PLACES.filter(
        p => p.district_id === district.id && p.is_active
      );

      return {
        id: district.id,
        name: district.name,
        nameTa: district.nameTa,
        code: district.code,
        lat: district.lat,
        lng: district.lng,
        placeCount: placesInDistrict.length,
        hasVerifiedData: placesInDistrict.length > 0
      };
    });

    return res.status(200).json({
      success: true,
      totalDistricts: districtsWithStats.length,
      totalPlaces: TN_TOURISM_PLACES.filter(p => p.is_active).length,
      districts: districtsWithStats
    });
  } catch (err) {
    logger.error('[TourismRoutes] Error fetching districts: %O', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve Tamil Nadu tourism districts.'
    });
  }
});

/**
 * GET /api/tourism/categories
 * Returns official tourism categories with counts and localization
 */
router.get('/categories', (req, res) => {
  try {
    const categoriesWithCounts = TOURISM_CATEGORIES.map(cat => {
      if (cat.id === 'all') {
        return {
          ...cat,
          count: TN_TOURISM_PLACES.filter(p => p.is_active).length
        };
      }
      return {
        ...cat,
        count: TN_TOURISM_PLACES.filter(p => p.is_active && p.category.toLowerCase() === cat.id.toLowerCase()).length
      };
    });

    return res.status(200).json({
      success: true,
      categories: categoriesWithCounts
    });
  } catch (err) {
    logger.error('[TourismRoutes] Error fetching categories: %O', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve tourism categories.'
    });
  }
});

/**
 * GET /api/tourism/places
 * Fetch verified tourist places for a given district
 * Query params:
 * - district_id: District slug (required for district-first view)
 * - category: Optional category filter ('Heritage', 'Temple', etc.)
 */
router.get('/places', (req, res) => {
  try {
    const { district_id, category } = req.query;

    if (!district_id) {
      return res.status(400).json({
        success: false,
        error: 'district_id query parameter is required.'
      });
    }

    const cleanDistrictId = String(district_id).trim().toLowerCase();
    const district = TN_DISTRICTS.find(
      d => d.id === cleanDistrictId || 
           d.name.toLowerCase() === cleanDistrictId ||
           (Array.isArray(d.keywords) && d.keywords.includes(cleanDistrictId))
    );

    if (!district) {
      return res.status(404).json({
        success: false,
        error: `District '${district_id}' not recognized among the 38 Tamil Nadu districts.`
      });
    }

    let places = TN_TOURISM_PLACES.filter(
      p => p.district_id === district.id && p.is_active
    );

    if (category && category.toLowerCase() !== 'all') {
      const cleanCat = String(category).trim().toLowerCase();
      places = places.filter(p => p.category.toLowerCase() === cleanCat);
    }

    return res.status(200).json({
      success: true,
      district: {
        id: district.id,
        name: district.name,
        nameTa: district.nameTa,
        lat: district.lat,
        lng: district.lng
      },
      count: places.length,
      places
    });
  } catch (err) {
    logger.error('[TourismRoutes] Error fetching places: %O', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve tourist places.'
    });
  }
});

/**
 * GET /api/tourism/search
 * Search tourist places across a district or statewide
 * Query params:
 * - q: Search query (case-insensitive substring in English or Tamil)
 * - district_id: Optional district filter
 */
router.get('/search', (req, res) => {
  try {
    const { q, district_id } = req.query;
    const queryStr = (q || '').trim().toLowerCase();

    if (!queryStr) {
      return res.status(400).json({
        success: false,
        error: 'Search query parameter "q" is required.'
      });
    }

    let searchPool = TN_TOURISM_PLACES.filter(p => p.is_active);

    if (district_id && district_id.toLowerCase() !== 'all') {
      const cleanDistrictId = String(district_id).trim().toLowerCase();
      const matchedDist = TN_DISTRICTS.find(
        d => d.id === cleanDistrictId || 
             d.name.toLowerCase() === cleanDistrictId ||
             (Array.isArray(d.keywords) && d.keywords.includes(cleanDistrictId))
      );
      const targetId = matchedDist ? matchedDist.id : cleanDistrictId;
      searchPool = searchPool.filter(p => p.district_id === targetId);
    }

    const tokens = queryStr.split(/\s+/).filter(Boolean);

    const matches = searchPool.filter(place => {
      const combined = [
        place.name_en,
        place.name_ta,
        place.description_en,
        place.description_ta,
        place.short_desc_en,
        place.short_desc_ta,
        place.category,
        place.category_ta,
        place.address_en,
        place.address_ta,
        place.district_name_en,
        place.district_name_ta
      ].filter(Boolean).join(' ').toLowerCase();

      return tokens.every(token => combined.includes(token));
    });

    return res.status(200).json({
      success: true,
      query: q,
      district_id: district_id || 'all',
      count: matches.length,
      places: matches
    });
  } catch (err) {
    logger.error('[TourismRoutes] Error searching places: %O', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to execute tourism search.'
    });
  }
});

/**
 * GET /api/tourism/places/:id
 * Retrieve details for a specific tourist destination by ID
 */
router.get('/places/:id', (req, res) => {
  try {
    const { id } = req.params;
    const place = TN_TOURISM_PLACES.find(p => p.id === id && p.is_active);

    if (!place) {
      return res.status(404).json({
        success: false,
        error: `Tourist destination with ID '${id}' not found.`
      });
    }

    return res.status(200).json({
      success: true,
      place
    });
  } catch (err) {
    logger.error('[TourismRoutes] Error fetching place by ID: %O', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve place details.'
    });
  }
});

export default router;
