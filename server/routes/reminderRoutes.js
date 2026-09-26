import express from 'express';
import { requireAuth } from '../middlewares/authMiddleware.js';
import {
  getReminders,
  createReminder,
  updateReminder,
  deleteReminder
} from '../controllers/reminderController.js';

const router = express.Router();

// All reminder endpoints require authenticated citizen/user token
router.use(requireAuth);

router.get('/', getReminders);
router.post('/', createReminder);
router.patch('/:id', updateReminder);
router.delete('/:id', deleteReminder);

export default router;
