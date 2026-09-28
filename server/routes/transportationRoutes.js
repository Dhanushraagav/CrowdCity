import express from 'express';
import {
  createReport,
  getReports,
  getReportById,
  updateReportStatus,
  analyzeReportAI,
  checkTransportationDuplicate
} from '../controllers/transportationController.js';
import { upload, handleUploadError } from '../middlewares/uploadMiddleware.js';

const router = express.Router();

// 1. Analyze Draft Transportation Issue with Groq AI
router.post('/analyze', analyzeReportAI);

// New endpoint: Check for duplicates before creating
router.post('/reports/check-duplicate', checkTransportationDuplicate);

// 2. Submit New Transportation Report
router.post('/reports', upload.array('image', 5), handleUploadError, createReport);

// 3. Get All Transportation Reports (With Search & Filter Query Params)
router.get('/reports', getReports);

// 4. Get Single Transportation Report Details & History Log
router.get('/reports/:id', getReportById);

// 5. Update Status, Assign Engineer, & Attach Completion Photo (Authority Endpoint)
router.put('/reports/:id/status', updateReportStatus);

export default router;
