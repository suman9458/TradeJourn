const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { verifyMT5Hmac } = require('../middleware/mt5HmacAuth');
const {
  generatePairingCode,
  exchangePairingCode,
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
  connectDirectCloudAccount
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
// A. Connector Authentication & Pairing
// ----------------------------------------------------------------------------
router.post('/pair/generate', protect, generatePairingCode);
router.post('/pair/exchange', exchangePairingCode);

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
router.get('/pending-journals', protect, getPendingJournals);
router.post('/positions/:id/journal', protect, updateJournal);
router.post('/positions/:id/link-trade', protect, linkManualTrade);
router.delete('/accounts/:id', protect, disconnectAccount);

module.exports = router;
