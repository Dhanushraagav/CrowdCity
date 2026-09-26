/**
 * officeRoutes.js
 * 
 * Routes for Tamil Nadu Government Offices & E-Sevai Locator.
 */

import express from 'express';
import { getOffices, getOfficeById, getDistricts } from '../controllers/officeController.js';

const router = express.Router();

// List offices with filters, search, proximity sorting
router.get('/', getOffices);

// List districts and taluks
router.get('/districts', getDistricts);

// Specific office by ID
router.get('/:id', getOfficeById);

export default router;
