import express from 'express';
import { getTamilNaduUpdates } from '../services/tnInfoService.js';
import logger from '../config/logger.js';

const router = express.Router();

/**
 * @route   GET /api/tamilnadu-updates
 * @desc    Get dynamic live Tamil Nadu government, civic, and welfare updates
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const result = await getTamilNaduUpdates(forceRefresh);
    
    // Set short cache headers for browser & CDN (5 min client cache, stale-while-revalidate)
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    return res.status(200).json(result);
  } catch (error) {
    logger.error(`[TN-Info Routes] Error fetching Tamil Nadu updates: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve Tamil Nadu updates',
      updates: []
    });
  }
});

export default router;
