import express from 'express';
import { 
  getAllIssues, 
  getIssueById, 
  createIssue, 
  upvoteIssue, 
  addComment,
  editComment,
  deleteComment,
  updateIssueStatus,
  deleteIssue,
  assignIssue,
  getAuthorityStats,
  getAdminAnalytics,
  getAdvancedAnalytics,
  verifyIssue,
  reopenIssue,
  getAiDecisions,
  overrideAiDecision,
  exportReport
} from '../controllers/issueController.js';
import { requireAuth, requireRole } from '../middlewares/authMiddleware.js';
import { upload, handleUploadError } from '../middlewares/uploadMiddleware.js';
import {
  validateCreateIssue,
  validateAddComment,
  validateEditComment,
  validateUpdateStatus,
  validateIdParam
} from '../middlewares/validationMiddleware.js';

const router = express.Router();

// Public routes
router.get('/', getAllIssues);
router.get('/analytics', requireAuth, getAdvancedAnalytics);
router.get('/:id', validateIdParam('id'), getIssueById);

// Authenticated routes (All citizens/roles)
router.post('/', requireAuth, upload.single('image'), handleUploadError, validateCreateIssue, createIssue);
router.post('/:id/upvote', requireAuth, validateIdParam('id'), upvoteIssue);
router.post('/:id/comments', requireAuth, validateAddComment, addComment);
router.patch('/comments/:commentId', requireAuth, validateEditComment, editComment);
router.delete('/comments/:commentId', requireAuth, validateIdParam('commentId'), deleteComment);
router.post('/:id/verify', requireAuth, validateIdParam('id'), verifyIssue);
router.post('/:id/reopen', requireAuth, validateIdParam('id'), reopenIssue);

// Admin-only analytics route (registered before parameterized ID routes to avoid routing conflicts)
router.get('/admin/analytics', requireAuth, requireRole(['admin']), getAdminAnalytics);
router.get('/admin/ai-decisions', requireAuth, requireRole(['admin']), getAiDecisions);
router.post('/admin/ai-decisions/:id/override', requireAuth, requireRole(['admin']), overrideAiDecision);
router.get('/admin/reports/export', requireAuth, requireRole(['admin']), exportReport);

// Authority & Admin protected routes
// Injects multipart upload handler for resolving proof images
router.patch('/:id/status', requireAuth, requireRole(['authority', 'admin']), upload.single('proof'), handleUploadError, validateUpdateStatus, updateIssueStatus);
router.post('/:id/assign', requireAuth, requireRole(['authority', 'admin']), validateIdParam('id'), assignIssue);
router.get('/authority/stats', requireAuth, requireRole(['authority', 'admin']), getAuthorityStats);

// Admin-only route
router.delete('/:id', requireAuth, requireRole(['admin']), validateIdParam('id'), deleteIssue);

export default router;
