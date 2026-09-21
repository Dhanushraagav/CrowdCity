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
        p => p.district_id === district.id && p.is_active && p.verification_status !== 'image_verification_pending'
      );

      return {
        id: district.id,
        name: district.name,
        nameTa: district.nameTa,
        code: district.code,
        lat: district.lat,
        lng: district.lng,
        keywords: district.keywords || [],
        placeCount: placesInDistrict.length,
        hasVerifiedData: placesInDistrict.length > 0
      };
    });

    return res.status(200).json({
      success: true,
      totalDistricts: districtsWithStats.length,
      totalPlaces: TN_TOURISM_PLACES.filter(p => p.is_active && p.verification_status !== 'image_verification_pending').length,
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
 * GET /api/tourism/hero-banners
 * Returns a curated, balanced pool of cinematic destination hero banners from across Tamil Nadu.
 * Supports optional user detected ?district_id=... to prioritize a local landmark as slide #0.
 */
router.get('/hero-banners', (req, res) => {
  try {
    const { district_id } = req.query;

    function getHighRes(url) {
      if (!url) return '';
      if (url.includes('upload.wikimedia.org') || url.includes('thumb.wikimedia.org')) {
        return url.replace(/\/(\d+)px-/, '/1920px-');
      }
      return url;
    }

    // Curated balanced pool representing diverse regions & landscapes across Tamil Nadu
    const curatedHeroIds = [
      'tjr-brihadisvara-big-temple',
      'mdu-meenakshi-amman-temple',
      'cbe-valparai-hill-station',
      'cpt-mahabalipuram-monuments',
      'nil-botanical-gardens-ooty',
      'kkm-vivekananda-rock-thiruvalluvar',
      'dpi-hogenakkal-falls',
      'dgl-kodaikanal-lake',
      'chn-marina-beach',
      'tks-courtallam-waterfalls',
      'cud-pichavaram-mangrove-forest',
      'ram-pamban-bridge',
      'try-rockfort-temple',
      'ari-gangaikonda-cholapuram'
    ];

    let bannerPool = curatedHeroIds
      .map(id => TN_TOURISM_PLACES.find(p => p.id === id && p.is_active))
      .filter(Boolean);

    // If user's district is detected, prioritize a destination from that district as Slide #0
    if (district_id && district_id.toLowerCase() !== 'all') {
      const cleanDistId = String(district_id).trim().toLowerCase();
      const userDistrictPlaces = TN_TOURISM_PLACES.filter(
        p => p.district_id === cleanDistId && p.is_active && p.image_url
      );

      if (userDistrictPlaces.length > 0) {
        // Find if one is already in the pool
        const existingIdx = bannerPool.findIndex(p => p.district_id === cleanDistId);
        if (existingIdx > 0) {
          // Move to front
          const [promoted] = bannerPool.splice(existingIdx, 1);
          bannerPool.unshift(promoted);
        } else if (existingIdx === -1) {
          // Add the premier place from user's district to the front
          bannerPool.unshift(userDistrictPlaces[0]);
        }
      }
    }

    const banners = bannerPool.map(place => ({
      id: place.id,
      district_id: place.district_id,
      district_name_en: place.district_name_en,
      district_name_ta: place.district_name_ta,
      name_en: place.name_en,
      name_ta: place.name_ta,
      short_description_en: place.short_desc_en || place.description_en,
      short_description_ta: place.short_desc_ta || place.description_ta,
      category: place.category,
      category_ta: place.category_ta,
      hero_image_url: getHighRes(place.image_url),
      hero_image_source: place.image_source_name || place.source_name,
      hero_image_source_url: place.image_source_url || place.source_url,
      latitude: place.latitude,
      longitude: place.longitude,
      source_name: place.source_name,
      source_url: place.source_url,
      images: place.images || [],
      timings_en: place.timings_en,
      timings_ta: place.timings_ta,
      entry_fee_en: place.entry_fee_en,
      entry_fee_ta: place.entry_fee_ta,
      best_time_to_visit_en: place.best_time_to_visit_en,
      best_time_to_visit_ta: place.best_time_to_visit_ta,
      address_en: place.address_en,
      address_ta: place.address_ta,
      nearest_station: place.nearest_station,
      nearest_airport: place.nearest_airport
    }));

    return res.status(200).json({
      success: true,
      count: banners.length,
      banners
    });
  } catch (err) {
    logger.error('[TourismRoutes] Error fetching hero banners: %O', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve hero banners.'
    });
  }
});

/**
 * GET /api/tourism/categories
 * Returns official tourism categories with counts and localization
 */
router.get('/categories', (req, res) => {
  try {
    const verifiedActive = TN_TOURISM_PLACES.filter(
      p => p.is_active && p.verification_status !== 'image_verification_pending'
    );
    const categoriesWithCounts = TOURISM_CATEGORIES.map(cat => {
      if (cat.id === 'all') {
        return {
          ...cat,
          count: verifiedActive.length
        };
      }
      return {
        ...cat,
        count: verifiedActive.filter(p => p.category.toLowerCase() === cat.id.toLowerCase()).length
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
      p => p.district_id === district.id && p.is_active && p.verification_status !== 'image_verification_pending'
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

    let searchPool = TN_TOURISM_PLACES.filter(
      p => p.is_active && p.verification_status !== 'image_verification_pending'
    );

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
