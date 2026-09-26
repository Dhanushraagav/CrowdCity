import express from 'express';
import { getAllSchemes, getSchemeById } from '../controllers/schemeController.js';

const router = express.Router();

// GET /api/schemes - List all active schemes
router.get('/', getAllSchemes);

// GET /api/schemes/:id - Get scheme details by ID, code, or slug
router.get('/:id', getSchemeById);

export default router;
