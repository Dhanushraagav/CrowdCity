/**
 * powerShutdownRoutes.js
 * 
 * Express routes for Tamil Nadu planned electricity shutdown updates.
 */

import express from 'express';
import { getPowerShutdowns, getOfficialSourceStatus } from '../services/powerShutdownService.js';
import logger from '../config/logger.js';

const router = express.Router();

/**
 * @route   GET /api/power-updates
 * @desc    Query planned power outages with filters (district, area, date, tab, status)
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    const { district, area, date, tab, status, refresh } = req.query;
    const result = await getPowerShutdowns({
      district,
      area,
      date,
      tab,
      status,
      refresh: refresh === 'true'
    });

    // Client cache: 5 minutes, stale-while-revalidate 10 minutes
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    return res.status(200).json(result);
  } catch (error) {
    logger.error(`[PowerShutdownRoutes] Error retrieving power updates: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve power shutdown updates',
      shutdowns: [],
      official_source: {
        name: 'TNPDCL',
        url: 'https://www.tnebltd.gov.in/outages/viewshutdown.xhtml'
      }
    });
  }
});

/**
 * @route   GET /api/power-updates/status
 * @desc    Get official TNPDCL source accessibility status and transparency info
 * @access  Public
 */
router.get('/status', async (req, res) => {
  try {
    const statusInfo = await getOfficialSourceStatus();
    return res.status(200).json({
      success: true,
      ...statusInfo,
      data: statusInfo
    });
  } catch (error) {
    logger.error(`[PowerShutdownRoutes] Error checking source status: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve official source status'
    });
  }
});

export default router;
