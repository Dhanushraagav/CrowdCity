import crypto from 'crypto';
import logger from '../config/logger.js';

// In-memory registries
const otps = new Map();
const resetTokens = new Map();

/**
 * Clean up expired OTPs and reset tokens periodically to prevent memory leaks
 */
setInterval(() => {
  const now = Date.now();
  
  for (const [key, value] of otps.entries()) {
    if (now > value.expiresAt) {
      otps.delete(key);
      logger.debug(`[OTP Service] Garbage collected expired OTP for ${key.split(':')[0]}`);
    }
  }

  for (const [token, value] of resetTokens.entries()) {
    if (now > value.expiresAt || value.used) {
      resetTokens.delete(token);
      logger.debug(`[OTP Service] Garbage collected expired/used reset token for ${value.email}`);
    }
  }
}, 5 * 60 * 1000); // run every 5 minutes

export const otpService = {
  /**
   * Check if a new OTP can be sent to the email (resend rate limit: 60 seconds)
   */
  canResendOTP: (email, type) => {
    const key = `${email.toLowerCase()}:${type}`;
    const existing = otps.get(key);
    
    if (existing && Date.now() - existing.lastSentAt < 30 * 1000) {
      return false;
    }
    return true;
  },

  /**
   * Generate a fresh 6-digit OTP code
   */
  generateOTP: (email, type) => {
    const key = `${email.toLowerCase()}:${type}`;
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes expiration
    
    otps.set(key, {
      code,
      expiresAt,
      attempts: 0,
      lastSentAt: Date.now()
    });

    logger.info(`[OTP Service] Generated OTP ${code} for ${email} (Type: ${type})`);
    return code;
  },

  /**
   * Verify an OTP code
   */
  verifyOTP: (email, code, type) => {
    const key = `${email.toLowerCase()}:${type}`;
    const existing = otps.get(key);

    if (!existing) {
      return { valid: false, error: 'Verification code not found or expired. Please request a new one.' };
    }

    // Check expiration
    if (Date.now() > existing.expiresAt) {
      otps.delete(key);
      return { valid: false, error: 'Verification code has expired. Please request a new one.' };
    }

    // Increment attempts for rate-limiting
    existing.attempts += 1;
    if (existing.attempts > 5) {
      otps.delete(key);
      return { valid: false, error: 'Too many incorrect attempts. This code has been invalidated. Please request a new code.' };
    }

    // Validate code
    if (existing.code !== code.trim()) {
      return { valid: false, error: `Invalid verification code. Attempts remaining: ${5 - existing.attempts}` };
    }

    // Delete OTP on successful verification to prevent reuse
    otps.delete(key);
    logger.info(`[OTP Service] Successfully verified OTP for ${email} (Type: ${type})`);
    return { valid: true };
  },

  /**
   * Generate a secure token for password recovery (expires in 15 minutes)
   */
  generateResetToken: (email) => {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes expiration

    resetTokens.set(token, {
      email: email.toLowerCase(),
      expiresAt,
      used: false
    });

    logger.info(`[OTP Service] Generated secure reset token for ${email}`);
    return token;
  },

  /**
   * Verify a password recovery token
   */
  verifyResetToken: (token, email) => {
    const entry = resetTokens.get(token);

    if (!entry) {
      return false;
    }

    if (entry.used || Date.now() > entry.expiresAt) {
      resetTokens.delete(token);
      return false;
    }

    if (entry.email !== email.toLowerCase()) {
      return false;
    }

    return true;
  },

  /**
   * Invalidate a password recovery token after it has been used
   */
  invalidateResetToken: (token) => {
    const entry = resetTokens.get(token);
    if (entry) {
      entry.used = true;
      resetTokens.delete(token); // delete instantly to prevent reuse
      logger.info(`[OTP Service] Invalidated reset token for ${entry.email}`);
    }
  }
};
