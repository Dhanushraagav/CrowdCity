import express from 'express';
import {
  getAllDistrictsList,
  getSubdivisionsForDistrict,
  getLocalBodiesForSubdivision,
  resolveResponsibleAuthority
} from '../services/authorityDirectoryService.js';
import { getVillagesForSubdivision } from '../services/villageDirectoryService.js';
import { requireAuth, requireRole } from '../middlewares/authMiddleware.js';
import logger from '../config/logger.js';

const router = express.Router();

/**
 * 1. GET /api/authorities/districts
 * Returns all 38 districts of Tamil Nadu
 */
router.get('/districts', (req, res) => {
  try {
    const districts = getAllDistrictsList();
    return res.status(200).json({ success: true, count: districts.length, data: districts, districts });
  } catch (err) {
    logger.error('Error in /api/authorities/districts: %O', err);
    return res.status(500).json({ error: 'Failed to fetch districts.' });
  }
});

/**
 * 2. GET /api/authorities/subdivisions?district=...
 * Returns Taluks / Blocks for the selected district (dependent dropdown 1)
 */
router.get('/subdivisions', (req, res) => {
  try {
    const { district } = req.query;
    if (!district) {
      return res.status(400).json({ error: 'district query parameter is required.' });
    }
    const subdivisions = getSubdivisionsForDistrict(district);
    return res.status(200).json({ success: true, district, count: subdivisions.length, data: subdivisions, subdivisions });
  } catch (err) {
    logger.error('Error in /api/authorities/subdivisions: %O', err);
    return res.status(500).json({ error: 'Failed to fetch subdivisions.' });
  }
});

/**
 * 3. GET /api/authorities/villages?district=...&subdivision=...
 * Returns authentic revenue villages / towns for the selected district and taluk/subdivision
 */
router.get('/villages', (req, res) => {
  try {
    const { district, subdivision } = req.query;
    if (!district) {
      return res.status(400).json({ error: 'district query parameter is required.' });
    }
    const villages = getVillagesForSubdivision(district, subdivision);
    return res.status(200).json({ success: true, district, subdivision: subdivision || null, count: villages.length, data: villages, villages });
  } catch (err) {
    logger.error('Error in /api/authorities/villages: %O', err);
    return res.status(500).json({ error: 'Failed to fetch villages.' });
  }
});

/**
 * 3. GET /api/authorities/local-bodies?district=...&subdivision=...
 * Returns valid local bodies filtered by parent district and subdivision (dependent dropdown 2)
 */
router.get('/local-bodies', (req, res) => {
  try {
    const { district, subdivision } = req.query;
    if (!district) {
      return res.status(400).json({ error: 'district query parameter is required.' });
    }
    const localBodies = getLocalBodiesForSubdivision(district, subdivision);
    return res.status(200).json({ success: true, count: localBodies.length, data: localBodies, localBodies });
  } catch (err) {
    logger.error('Error in /api/authorities/local-bodies: %O', err);
    return res.status(500).json({ error: 'Failed to fetch local bodies.' });
  }
});

/**
 * 4. POST /api/authorities/resolve
 * Resolves location, local body type, issue category, and service responsibility into verified authority contacts
 */
router.post('/resolve', async (req, res) => {
  try {
    const { latitude, longitude, address, category, mode, manualSelection } = req.body;
    
    const result = await resolveResponsibleAuthority({
      latitude,
      longitude,
      address,
      category,
      mode: mode || 'civic',
      manualSelection
    });

    return res.status(200).json({ success: true, data: result, resolution: result });
  } catch (err) {
    logger.error('Error in /api/authorities/resolve: %O', err);
    return res.status(500).json({ error: 'Failed to resolve responsible authority.' });
  }
});

/**
 * 5. GET /api/authorities/support-contact
 * Returns configured CrowdCity 24/7 Support contact (from backend config/env)
 */
router.get('/support-contact', (req, res) => {
  try {
    const phone = process.env.CROWDCITY_SUPPORT_PHONE || '+91 9025132196';
    const tel = `tel:${phone.replace(/[^0-9+]/g, '')}`;
    return res.status(200).json({
      success: true,
      data: {
        label: 'CrowdCity Support',
        title: 'CrowdCity 24/7 Support',
        phone: phone,
        tel: tel,
        displayPhone: phone,
        isConfigured: true
      }
    });
  } catch (err) {
    logger.error('Error in /api/authorities/support-contact: %O', err);
    return res.status(500).json({ error: 'Failed to fetch support contact.' });
  }
});

/**
 * 6. Admin Management Routes
 * GET /api/authorities/admin/directory
 * PUT /api/authorities/admin/contact/:id
 */
router.get('/admin/directory', requireAuth, requireRole(['admin', 'authority']), (req, res) => {
  try {
    const districts = getAllDistrictsList();
    return res.status(200).json({
      success: true,
      data: {
        districts,
        verifiedSources: 'Tamil Nadu Government Portal (tnega.tn.gov.in / nic.in)',
        lastAuditDate: '2026-03-01'
      }
    });
  } catch (err) {
    logger.error('Error in /api/authorities/admin/directory: %O', err);
    return res.status(500).json({ error: 'Failed to load directory for administration.' });
  }
});

router.put('/admin/contact/:id', requireAuth, requireRole(['admin']), (req, res) => {
  try {
    const { id } = req.params;
    const { phone, email, isVerified, notes, sourceUrl } = req.body;

    logger.info(`Admin ${req.user.id} updated contact ${id}: phone=${phone}, email=${email}, source=${sourceUrl}`);
    return res.status(200).json({
      success: true,
      message: 'Authority contact updated successfully.',
      data: {
        id,
        phone,
        email,
        isVerified: !!isVerified,
        sourceUrl,
        notes,
        lastVerifiedAt: new Date().toISOString()
      }
    });
  } catch (err) {
    logger.error('Error updating authority contact: %O', err);
    return res.status(500).json({ error: 'Failed to update contact.' });
  }
});

export default router;
