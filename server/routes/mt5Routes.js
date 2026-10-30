const express = require('express');
const router = express.Router();
const { protect, preventDemoModification } = require('../middleware/auth');
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
  getConnectorConfig,
  updateAccount
} = require('../controllers/mt5Controller');

// Global Feature Flag Middleware for MT5 Routes (Enabled by default unless explicitly set to 'false')
router.use((req, res, next) => {
  if (process.env.MT5_INTEGRATION_ENABLED === 'false') {
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
router.post('/cloud/connect', protect, preventDemoModification, connectDirectCloudAccount);
router.get('/accounts', protect, getAccounts);
router.get('/accounts/:id/positions', protect, getOpenPositions);
router.get('/accounts/:id/connector-config', protect, getConnectorConfig);
router.get('/connector/config', protect, getConnectorConfig);
router.get('/connector-config', protect, getConnectorConfig);
router.put('/accounts/:id', protect, preventDemoModification, updateAccount);
router.get('/pending-journals', protect, getPendingJournals);
router.post('/positions/:id/journal', protect, preventDemoModification, updateJournal);
router.post('/positions/:id/link-trade', protect, preventDemoModification, linkManualTrade);
router.delete('/accounts/:id', protect, preventDemoModification, disconnectAccount);

module.exports = router;
