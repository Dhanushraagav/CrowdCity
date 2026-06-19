import express from 'express';
import { 
  getProfile, 
  updateUserRole, 
  getAllUsers, 
  toggleUserSuspension, 
  toggleAuthorityVerification, 
  assignUserDepartment,
  sendWelcomeEmailAfterSignup,
  sendOtpCode,
  verifyOtpCode,
  registerVerifiedUser,
  requestPasswordRecovery,
  resetPasswordOverride
} from '../controllers/authController.js';
import { requireAuth, requireRole } from '../middlewares/authMiddleware.js';
import { validateUserId } from '../middlewares/validationMiddleware.js';

const router = express.Router();

// Public auth and verification routes
router.post('/send-welcome', sendWelcomeEmailAfterSignup);
router.post('/send-otp', sendOtpCode);
router.post('/verify-otp', verifyOtpCode);
router.post('/register-otp', registerVerifiedUser);
router.post('/request-reset', requestPasswordRecovery);
router.post('/reset-password', resetPasswordOverride);

// All auth routes below this line require authentication
router.use(requireAuth);

router.get('/profile', getProfile);

// Admin-only endpoints
router.get('/users', requireRole(['admin']), getAllUsers);
router.post('/role', requireRole(['admin']), validateUserId, updateUserRole);
router.patch('/users/:id/suspend', requireRole(['admin']), toggleUserSuspension);
router.patch('/users/:id/verify-authority', requireRole(['admin']), toggleAuthorityVerification);
router.patch('/users/:id/assign-department', requireRole(['admin']), assignUserDepartment);

export default router;
