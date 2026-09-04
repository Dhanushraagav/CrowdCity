import express from 'express';
import { getTamilNaduAnalytics, getDistrictAnalytics, getAuthorityCivicIntelligenceController } from '../controllers/analyticsController.js';
import { requireAuth, requireRole } from '../middlewares/authMiddleware.js';

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

/**
 * @route   GET /api/analytics/authority/civic-intelligence
 * @desc    Get dynamic Civic Intelligence tailored for Municipal Authorities and Admins
 * @access  Private (Authority & Admin only)
 */
router.get(
  '/authority/civic-intelligence',
  requireAuth,
  requireRole(['authority', 'admin']),
  getAuthorityCivicIntelligenceController
);

export default router;
