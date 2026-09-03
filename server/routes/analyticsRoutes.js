import express from 'express';
import { getTamilNaduAnalytics, getDistrictAnalytics } from '../controllers/analyticsController.js';

const router = express.Router();

/**
 * @route   GET /api/analytics/tamilnadu
 * @desc    Get dynamic 38-District Tamil Nadu Civic Intelligence
 * @access  Public / Authenticated
 */
router.get('/tamilnadu', getTamilNaduAnalytics);

/**
 * @route   GET /api/analytics/district/:districtId
 * @desc    Get dynamic single district civic intelligence
 * @access  Public / Authenticated
 */
router.get('/district/:districtId', getDistrictAnalytics);

export default router;
