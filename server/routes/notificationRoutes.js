import express from 'express';
import { 
  getNotifications, 
  markAsRead, 
  markAllAsRead
} from '../controllers/notificationController.js';
import { requireAuth } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Require user authentication for all notification routes
router.use(requireAuth);

router.get('/', getNotifications);
router.patch('/:id/read', markAsRead);
router.patch('/read-all', markAllAsRead);

export default router;
