import express from 'express';
import {
  createReport,
  getReports,
  getReportById,
  updateReportStatus,
  analyzeReportAI
} from '../controllers/transportationController.js';

const router = express.Router();

// 1. Analyze Draft Transportation Issue with Groq AI
router.post('/analyze', analyzeReportAI);

// 2. Submit New Transportation Report
router.post('/reports', createReport);

// 3. Get All Transportation Reports (With Search & Filter Query Params)
router.get('/reports', getReports);

// 4. Get Single Transportation Report Details & History Log
router.get('/reports/:id', getReportById);

// 5. Update Status, Assign Engineer, & Attach Completion Photo (Authority Endpoint)
router.put('/reports/:id/status', updateReportStatus);

export default router;
