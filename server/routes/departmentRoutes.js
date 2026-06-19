import express from 'express';
import { getDepartments, createDepartment, updateDepartment, deleteDepartment } from '../controllers/departmentController.js';
import { requireAuth, requireRole } from '../middlewares/authMiddleware.js';

const router = express.Router();

// General authenticated endpoint
router.get('/', requireAuth, getDepartments);

// Admin-only endpoints
router.post('/', requireAuth, requireRole(['admin']), createDepartment);
router.put('/:id', requireAuth, requireRole(['admin']), updateDepartment);
router.delete('/:id', requireAuth, requireRole(['admin']), deleteDepartment);

export default router;
