import express from 'express';
import { analyzeIssue, chatWithAi, analyzeComplaintController, testGroqConnectivity, explainSchemeController, assistantChatController, verifyDocumentController, formGuidanceController, recommendationController, translateVoiceController, analyzeImageController } from '../controllers/aiController.js';
import { requireAuth } from '../middlewares/authMiddleware.js';
import { validateAnalyzeIssue, validateChatPayload } from '../middlewares/validationMiddleware.js';

const router = express.Router();

// AI Categorization & Analysis Endpoints
router.post('/analyze', validateAnalyzeIssue, analyzeIssue);
router.post('/analyze-complaint', validateAnalyzeIssue, analyzeComplaintController);
router.post('/explain-scheme', explainSchemeController);
router.post('/assistant-chat', assistantChatController);
router.post('/verify-document', verifyDocumentController);
router.post('/form-guidance', formGuidanceController);
router.post('/recommendations', recommendationController);
router.post('/translate-voice', translateVoiceController);
router.post('/analyze-image', analyzeImageController);
router.post('/chat', validateChatPayload, chatWithAi);
router.get('/test-groq', testGroqConnectivity);

export default router;
