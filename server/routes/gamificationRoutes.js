import express from 'express';
import { getUserBadges } from '../controllers/gamificationController.js';
import { requireAuth } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Require authorization for all gamification routes
router.use(requireAuth);

router.get('/badges', getUserBadges);

export default router;
