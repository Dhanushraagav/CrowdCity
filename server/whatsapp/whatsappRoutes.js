// CrowdCity AI v2.3 - WhatsApp Integration Express Routes
// Routing mapping for administrative actions and monitoring queries.

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
import { requireAuth } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Public/Admin route mapping for project demonstration purposes
router.get('/status', requireAuth, getStatus);
router.post('/reconnect', requireAuth, triggerReconnect);
router.post('/disconnect', requireAuth, triggerDisconnect);
router.post('/test', requireAuth, sendTestMessage);
router.post('/notify', requireAuth, triggerNotification);
router.get('/logs', requireAuth, getLogs);
router.get('/queue', requireAuth, getQueue);

export default router;
