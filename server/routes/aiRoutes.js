const express = require('express');
const router = express.Router();
const { getRuleBasedCoachAnalysis, askAiCoach } = require('../controllers/aiController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/coach', getRuleBasedCoachAnalysis);
router.post('/chat', askAiCoach);

module.exports = router;
