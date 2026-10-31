const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const {
  registerUser,
  loginUser,
  getMe,
  updateSettings,
  demoLogin,
  socialLogin,
  logoutUser,
  forgotPasswordSendOtp,
  forgotPasswordVerifyOtp,
  forgotPasswordReset,
  forgotPasswordResetWithPin
} = require('../controllers/authController');
const { protect, preventDemoModification } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const {
  registerSchema,
  loginSchema,
  socialSchema,
  forgotPasswordSendSchema,
  forgotPasswordVerifySchema,
  forgotPasswordResetSchema,
  forgotPasswordPinResetSchema
} = require('../validators/authValidators');

// Dedicated rate limiting for authentication endpoints to prevent brute-force
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts from this IP. Please try again after 15 minutes.'
  }
});

// Strict per-IP rate limiter for OTP dispatch to prevent toll fraud & spamming
const sendOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many OTP requests from this IP address. Please try again after 15 minutes.'
  }
});

router.post('/register', authLimiter, validateBody(registerSchema), registerUser);
router.post('/login', authLimiter, validateBody(loginSchema), loginUser);
router.post('/demo', authLimiter, demoLogin);
router.post('/social', authLimiter, validateBody(socialSchema), socialLogin);
router.post('/forgot-password/send-otp', sendOtpLimiter, validateBody(forgotPasswordSendSchema), forgotPasswordSendOtp);
router.post('/forgot-password/verify-otp', authLimiter, validateBody(forgotPasswordVerifySchema), forgotPasswordVerifyOtp);
router.post('/forgot-password/reset-password', authLimiter, validateBody(forgotPasswordResetSchema), forgotPasswordReset);
router.post('/forgot-password/reset-with-pin', authLimiter, validateBody(forgotPasswordPinResetSchema), forgotPasswordResetWithPin);
router.get('/me', protect, getMe);
router.put('/settings', protect, preventDemoModification, updateSettings);
router.post('/logout', protect, logoutUser);

module.exports = router;
