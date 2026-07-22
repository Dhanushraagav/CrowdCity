// CrowdCity AI v2.3.1 - WhatsApp Integration Express Routes
// Routing mapping for administrative actions and monitoring queries.
// Strictly secured: Authenticated user with role admin is mandatory for all operations.

import express from 'express';
import { 
  getStatus, 
  triggerReconnect, 
  triggerDisconnect, 
  sendTestMessage, 
  triggerNotification,
  getLogs, 
  getQueue 
} from './whatsappController.js';
import { requireAuth, requireRole } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Apply auth middleware and strict admin role restrictions to all endpoints
router.use(requireAuth);
router.use(requireRole(['admin']));

router.get('/status', getStatus);
router.post('/reconnect', triggerReconnect);
router.post('/disconnect', triggerDisconnect);
router.post('/test', sendTestMessage);
router.post('/notify', triggerNotification);
router.get('/logs', getLogs);
router.get('/queue', getQueue);

export default router;
