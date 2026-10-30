const express = require('express');
const router = express.Router();
const {
  getRuleBasedCoachAnalysis,
  askAiCoach,
  getConversations,
  getConversationById,
  deleteConversationById
} = require('../controllers/aiController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/coach', getRuleBasedCoachAnalysis);
router.post('/chat', askAiCoach);
router.get('/conversations', getConversations);
router.get('/conversations/:id', getConversationById);
router.delete('/conversations/:id', deleteConversationById);

module.exports = router;
