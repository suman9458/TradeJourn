const express = require('express');
const router = express.Router();
const {
  getKPIs,
  getBreakdowns,
  getEarlyExitAnalytics,
  getEquityCurve
} = require('../controllers/analyticsController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/kpis', getKPIs);
router.get('/breakdowns', getBreakdowns);
router.get('/early-exits', getEarlyExitAnalytics);
router.get('/equity-curve', getEquityCurve);

module.exports = router;
