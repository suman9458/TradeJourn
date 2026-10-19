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
  forgotPasswordSendOtp,
  forgotPasswordVerifyOtp,
  forgotPasswordReset
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

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

router.post('/register', authLimiter, registerUser);
router.post('/login', authLimiter, loginUser);
router.post('/demo', demoLogin);
router.post('/social', authLimiter, socialLogin);
router.post('/forgot-password/send-otp', authLimiter, forgotPasswordSendOtp);
router.post('/forgot-password/verify-otp', authLimiter, forgotPasswordVerifyOtp);
router.post('/forgot-password/reset-password', authLimiter, forgotPasswordReset);
router.get('/me', protect, getMe);
router.put('/settings', protect, updateSettings);

module.exports = router;
