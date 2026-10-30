const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const {
  getRuleBasedCoachAnalysis,
  askAiCoach,
  getConversations,
  getConversationById,
  deleteConversationById
} = require('../controllers/aiController');
const { protect, preventDemoModification } = require('../middleware/auth');

// SEC-AI: Multi-Tier rate limiter for AI generation and coach analysis
// - Shared demo users are keyed strictly per IP (10 queries/15m) to prevent one visitor from locking out others or draining API quotas
// - Authenticated regular users are keyed by User ID (30 queries/15m)
const aiPerUserLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15-minute sliding window
  max: (req) => {
    const isDemo = Boolean(req.user?.role === 'demo' || req.user?.isDemo || req.user?.email === 'protrader@tradejourn.com');
    return isDemo ? 10 : 30;
  },
  keyGenerator: (req) => {
    const isDemo = Boolean(req.user?.role === 'demo' || req.user?.isDemo || req.user?.email === 'protrader@tradejourn.com');
    if (isDemo) {
      return `ai_demo_${req.ip || 'ip'}`;
    }
    return req.user?._id?.toString() || req.ip;
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    code: 'AI_RATE_LIMIT_EXCEEDED',
    message: 'AI Coach rate limit reached for this session. Please allow your analysis to settle before asking further questions.'
  }
});

router.use(protect);
router.use(aiPerUserLimiter);
router.get('/coach', getRuleBasedCoachAnalysis);
router.post('/chat', preventDemoModification, askAiCoach);
router.get('/conversations', getConversations);
router.get('/conversations/:id', getConversationById);
router.delete('/conversations/:id', preventDemoModification, deleteConversationById);

module.exports = router;
