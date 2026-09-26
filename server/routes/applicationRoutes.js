import express from 'express';
import { requireAuth } from '../middlewares/authMiddleware.js';
import {
  getApplications,
  createApplication,
  updateApplication,
  deleteApplication
} from '../controllers/applicationController.js';

const router = express.Router();

// All application tracker endpoints strictly require authenticated citizen/user token
router.use(requireAuth);

router.get('/', getApplications);
router.post('/', createApplication);
router.patch('/:id', updateApplication);
router.delete('/:id', deleteApplication);

export default router;
