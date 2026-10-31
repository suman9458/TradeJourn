const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const { protect, authorize, getJwtSecret } = require('../middleware/auth');
const {
  submitFeedback,
  getFeedbacks,
  updateFeedbackStatus,
  deleteFeedback
} = require('../controllers/feedbackController');

// Rate limiter for feedback submissions to prevent spamming
const feedbackLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many feedback submissions from this IP. Please try again after a few minutes.'
  }
});

// Middleware to extract user if token is present, without strictly blocking unauthenticated users
const optionalAuth = async (req, res, next) => {
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      const token = req.headers.authorization.split(' ')[1];
      if (token && token !== 'null' && token !== 'undefined') {
        const decoded = jwt.verify(token, getJwtSecret());
        const user = await User.findById(decoded.id).select('-password');
        if (user) {
          req.user = user;
        }
      }
    } catch {
      // Gracefully ignore token parse failures for public submission
    }
  }
  next();
};

// Public submission route
router.post('/', feedbackLimiter, optionalAuth, submitFeedback);

// Admin-only management routes
router.get('/', protect, authorize('admin'), getFeedbacks);
router.patch('/:id', protect, authorize('admin'), updateFeedbackStatus);
router.delete('/:id', protect, authorize('admin'), deleteFeedback);

module.exports = router;

