const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { verifyMT5Hmac } = require('../middleware/mt5HmacAuth');
const {
  receiveHeartbeat,
  receiveOpenPositions,
  receiveDeals,
  reconcileHistory,
  getAccounts,
  getOpenPositions,
  getPendingJournals,
  updateJournal,
  linkManualTrade,
  disconnectAccount,
  connectDirectCloudAccount,
  getConnectorConfig
} = require('../controllers/mt5Controller');

// Global Feature Flag Middleware for MT5 Routes
router.use((req, res, next) => {
  if (process.env.MT5_INTEGRATION_ENABLED !== 'true') {
    return res.status(403).json({
      success: false,
      message: 'MetaTrader 5 integration is currently disabled by system administrator'
    });
  }
  next();
});

// ----------------------------------------------------------------------------
// B. Connector Ingestion & Telemetry (HMAC-SHA256 Authenticated)
// ----------------------------------------------------------------------------
router.post('/telemetry/heartbeat', verifyMT5Hmac, receiveHeartbeat);
router.post('/sync/positions', verifyMT5Hmac, receiveOpenPositions);
router.post('/sync/deals', verifyMT5Hmac, receiveDeals);
router.post('/sync/reconciliation', verifyMT5Hmac, reconcileHistory);

// ----------------------------------------------------------------------------
// C. Trader Web Client Endpoints (User JWT Authenticated)
// ----------------------------------------------------------------------------
router.post('/cloud/connect', protect, connectDirectCloudAccount);
router.get('/accounts', protect, getAccounts);
router.get('/accounts/:id/positions', protect, getOpenPositions);
router.get('/accounts/:id/connector-config', protect, getConnectorConfig);
router.get('/pending-journals', protect, getPendingJournals);
router.post('/positions/:id/journal', protect, updateJournal);
router.post('/positions/:id/link-trade', protect, linkManualTrade);
router.delete('/accounts/:id', protect, disconnectAccount);

module.exports = router;
