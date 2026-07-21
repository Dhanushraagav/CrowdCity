import express from 'express';
import { analyzeIssue, chatWithAi, analyzeComplaintController, testGroqConnectivity, explainSchemeController, assistantChatController, verifyDocumentController } from '../controllers/aiController.js';
import { requireAuth } from '../middlewares/authMiddleware.js';
import { validateAnalyzeIssue, validateChatPayload } from '../middlewares/validationMiddleware.js';

const router = express.Router();

// Require user authentication for AI calls
router.post('/analyze', requireAuth, validateAnalyzeIssue, analyzeIssue);
router.post('/analyze-complaint', requireAuth, validateAnalyzeIssue, analyzeComplaintController);
router.post('/explain-scheme', explainSchemeController);
router.post('/assistant-chat', assistantChatController);
router.post('/verify-document', verifyDocumentController);
router.post('/chat', requireAuth, validateChatPayload, chatWithAi);
router.get('/test-groq', testGroqConnectivity);

export default router;
