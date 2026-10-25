const crypto = require('crypto');
const MT5Account = require('../models/MT5Account');
const MT5Deal = require('../models/MT5Deal');
const MT5Position = require('../models/MT5Position');
const MT5AuditLog = require('../models/MT5AuditLog');
const Trade = require('../models/Trade');
const { processDealsBatch } = require('../services/mt5SyncService');
const {
  connectCloudAccount,
  syncCloudAccount,
  getCloudOpenPositions
} = require('../services/metaApiService');

/**
 * In-memory store for currently active open positions snapshot per account
 * (Allows sub-second rendering without database write fatigue on every tick)
 */
const activeOpenPositionsCache = new Map();

// ----------------------------------------------------------------------------
// 1. CLOUD MT5 DIRECT WEB LOGIN
// ----------------------------------------------------------------------------

/**
 * Direct Cloud Web Login (No download, no VPS, no EA needed)
 * POST /api/mt5/cloud/connect
 */
exports.connectDirectCloudAccount = async (req, res) => {
  try {
    const userId = req.user._id;
    const { serverName, login, password, accountName, tradeMode, initialBalance, currency, leverage } = req.body;

    if (!serverName || !login || !password) {
      return res.status(400).json({
        success: false,
        message: 'Broker Server, Login number, and Investor Password are required.'
      });
    }

    const result = await connectCloudAccount(userId, {
      serverName,
      login,
      password,
      accountName,
      tradeMode,
      initialBalance,
      currency,
      leverage
    });

    await MT5AuditLog.create({
      userId,
      accountId: result.account._id,
      event: 'cloud_account_connected',
      details: {
        serverName: result.account.serverName,
        login: result.account.login,
        method: 'cloud'
      },
      ipAddress: req.ip
    });

    res.status(200).json({
      success: true,
      account: result.account,
      message: result.message
    });
  } catch (err) {
    console.error('Error connecting Cloud MT5 account:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};




// ----------------------------------------------------------------------------
// 2. CONNECTOR INGESTION & TELEMETRY (HMAC AUTHENTICATED)
// ----------------------------------------------------------------------------

/**
 * Connector Heartbeat (Every 5-10s)
 * POST /api/mt5/telemetry/heartbeat
 */
exports.receiveHeartbeat = async (req, res) => {
  try {
    const account = req.mt5Account;
    const { balance, equity, margin, freeMargin, marginLevel, floatingProfit } = req.body;

    account.balance = Number(balance) || account.balance;
    account.equity = Number(equity) || account.equity;
    account.margin = Number(margin) || account.margin;
    account.freeMargin = Number(freeMargin) || account.freeMargin;
    account.marginLevel = Number(marginLevel) || account.marginLevel;
    account.floatingProfit = Number(floatingProfit) || account.floatingProfit;
    account.status = 'connected';
    account.lastHeartbeat = new Date();
    await account.save();

    res.status(200).json({ success: true, status: 'ok', serverTimeUTC: new Date().toISOString() });
  } catch (err) {
    console.error('Error receiving heartbeat:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Connector Open Positions Snapshot
 * POST /api/mt5/sync/positions
 */
exports.receiveOpenPositions = async (req, res) => {
  try {
    const account = req.mt5Account;
    const { positions } = req.body;

    const positionsList = Array.isArray(positions) ? positions : [];
    activeOpenPositionsCache.set(account._id.toString(), {
      updatedAt: new Date(),
      positions: positionsList
    });

    res.status(200).json({
      success: true,
      receivedCount: positionsList.length,
      serverTimeUTC: new Date().toISOString()
    });
  } catch (err) {
    console.error('Error receiving open positions:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Connector Deals Batch Ingestion
 * POST /api/mt5/sync/deals
 */
exports.receiveDeals = async (req, res) => {
  try {
    const account = req.mt5Account;
    const { deals } = req.body;

    if (!Array.isArray(deals) || deals.length === 0) {
      return res.status(200).json({ success: true, processedCount: 0 });
    }

    const result = await processDealsBatch(account, req.user._id, deals);

    await MT5AuditLog.create({
      userId: req.user._id,
      accountId: account._id,
      event: 'sync_deals',
      details: {
        receivedCount: deals.length,
        insertedCount: result.insertedCount,
        positionsUpdated: result.positionsUpdated,
        closedPositionsCount: result.closedPositions.length
      },
      ipAddress: req.ip
    });

    res.status(200).json({
      success: true,
      insertedCount: result.insertedCount,
      positionsUpdated: result.positionsUpdated,
      closedPositionsCount: result.closedPositions.length
    });
  } catch (err) {
    console.error('Error receiving deals batch:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Periodic History Reconciliation
 * POST /api/mt5/sync/reconciliation
 */
exports.reconcileHistory = async (req, res) => {
  try {
    const account = req.mt5Account;
    const { dealTickets } = req.body;

    if (!Array.isArray(dealTickets)) {
      return res.status(400).json({ success: false, message: 'dealTickets array is required' });
    }

    // Find which deal tickets are already in the database
    const existingDeals = await MT5Deal.find({
      accountId: account._id,
      dealTicket: { $in: dealTickets }
    }).select('dealTicket');

    const existingSet = new Set(existingDeals.map(d => d.dealTicket));
    const missingTickets = dealTickets.filter(ticket => !existingSet.has(ticket));

    res.status(200).json({
      success: true,
      totalChecked: dealTickets.length,
      matchedCount: existingSet.size,
      missingCount: missingTickets.length,
      missingTickets
    });
  } catch (err) {
    console.error('Error during reconciliation:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ----------------------------------------------------------------------------
// 3. TRADER WEB CLIENT ENDPOINTS (USER JWT AUTHENTICATED)
// ----------------------------------------------------------------------------

/**
 * Get all linked MT5 accounts for trader
 * GET /api/mt5/accounts
 */
exports.getAccounts = async (req, res) => {
  try {
    const userId = req.user._id;
    let accounts = await MT5Account.find({ userId, isActive: true }).sort({ createdAt: -1 });

    if (accounts.length === 0) {
      // Check if default desktop connector account exists and link to current user
      let defaultAcc = await MT5Account.findOne({ apiKeyId: 'mt5_key_1fdced6694ef0ca4' });
      if (defaultAcc) {
        defaultAcc.userId = userId;
        defaultAcc.isActive = true;
        await defaultAcc.save();
        accounts = [defaultAcc];
      } else {
        defaultAcc = await MT5Account.create({
          userId,
          serverName: 'Exness-MT5Trial7',
          login: 434413217,
          accountName: 'Exness MT5 Real/Trial',
          tradeMode: 'demo',
          currency: 'USD',
          leverage: 1000,
          balance: 10000,
          equity: 10000,
          status: 'standby',
          connectionMethod: 'vps',
          apiKeyId: 'mt5_key_1fdced6694ef0ca4',
          apiKeyHash: 'c127089160a2fe714baafd841a38fb621ad71c5d77201cd4bdcbd32f9824ed7a',
          isActive: true
        });
        accounts = [defaultAcc];
      }
    }

    // Check heartbeat stale status
    const timeoutSec = Number(process.env.MT5_HEARTBEAT_TIMEOUT_SEC) || 30;
    const now = Date.now();

    const accountsWithLiveStatus = await Promise.all(accounts.map(async acc => {
      // Sync cloud account state if direct cloud connection
      if (acc.connectionMethod === 'cloud' && acc.status === 'connected') {
        try {
          await syncCloudAccount(acc);
        } catch (e) {}
      }

      const accObj = acc.toObject();
      if (acc.lastHeartbeat) {
        const diffSec = (now - new Date(acc.lastHeartbeat).getTime()) / 1000;
        if (diffSec > timeoutSec) {
          accObj.status = diffSec > (timeoutSec * 3) ? 'disconnected' : 'stale';
        }
        accObj.secondsSinceHeartbeat = Math.round(diffSec);
      } else {
        accObj.status = accObj.status || 'standby';
        accObj.secondsSinceHeartbeat = null;
      }
      return accObj;
    }));

    res.status(200).json({ success: true, accounts: accountsWithLiveStatus });
  } catch (err) {
    console.error('Error getting MT5 accounts:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Get open positions snapshot for an account
 * GET /api/mt5/accounts/:id/positions
 */
exports.getOpenPositions = async (req, res) => {
  try {
    const userId = req.user._id;
    const account = await MT5Account.findOne({ _id: req.params.id, userId });
    if (!account) {
      return res.status(404).json({ success: false, message: 'Account not found' });
    }

    const cached = activeOpenPositionsCache.get(account._id.toString());
    let positions = cached ? cached.positions : [];
    let updatedAt = cached ? cached.updatedAt : null;

    if (positions.length === 0 && account.connectionMethod === 'cloud' && account.status === 'connected') {
      positions = getCloudOpenPositions(account);
      updatedAt = new Date();
    }

    res.status(200).json({
      success: true,
      account: {
        serverName: account.serverName,
        login: account.login,
        balance: account.balance,
        equity: account.equity,
        floatingProfit: account.floatingProfit,
        margin: account.margin,
        freeMargin: account.freeMargin,
        status: account.status
      },
      updatedAt,
      positions
    });
  } catch (err) {
    console.error('Error getting open positions:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Get pending trade journals (closed positions awaiting user review)
 * GET /api/mt5/pending-journals
 */
exports.getPendingJournals = async (req, res) => {
  try {
    const userId = req.user._id;

    const pendingTrades = await Trade.find({
      userId,
      isFromMT5: true,
      journalStatus: { $in: ['pending', 'draft'] }
    }).sort({ date: -1, time: -1 });

    res.status(200).json({
      success: true,
      count: pendingTrades.length,
      trades: pendingTrades
    });
  } catch (err) {
    console.error('Error getting pending journals:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Complete or save draft of an MT5 journal entry
 * POST /api/mt5/positions/:id/journal
 */
exports.updateJournal = async (req, res) => {
  try {
    const userId = req.user._id;
    const trade = await Trade.findOne({ _id: req.params.id, userId });
    if (!trade) {
      return res.status(404).json({ success: false, message: 'Trade record not found' });
    }

    const {
      strategy,
      setupRating,
      session,
      entryType,
      confirmation,
      emotion,
      reasonEarlyExit,
      marketCondition,
      mistakes,
      notes,
      screenshotUrl,
      journalStatus
    } = req.body;

    if (setupRating) trade.setupRating = setupRating;
    if (session) trade.session = session;
    if (entryType) trade.entryType = entryType;
    if (confirmation) trade.confirmation = confirmation;
    if (emotion) trade.emotion = emotion;
    if (reasonEarlyExit !== undefined) trade.reasonEarlyExit = reasonEarlyExit;
    if (marketCondition) trade.marketCondition = marketCondition;
    if (Array.isArray(mistakes)) trade.mistakes = mistakes;
    if (notes !== undefined) trade.notes = notes;
    if (screenshotUrl) trade.screenshotUrl = screenshotUrl;
    if (journalStatus) trade.journalStatus = journalStatus;

    await trade.save();

    // If trade completed, sync position record
    if (trade.mt5PositionId && trade.mt5AccountId) {
      await MT5Position.findOneAndUpdate(
        { accountId: trade.mt5AccountId, positionId: trade.mt5PositionId },
        { journalStatus: trade.journalStatus }
      );
    }

    res.status(200).json({
      success: true,
      trade,
      message: trade.journalStatus === 'completed' ? 'Trade journal completed successfully' : 'Draft saved'
    });
  } catch (err) {
    console.error('Error updating MT5 journal entry:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Link an imported MT5 position to an existing manual trade record
 * POST /api/mt5/positions/:id/link-trade
 */
exports.linkManualTrade = async (req, res) => {
  try {
    const userId = req.user._id;
    const { manualTradeId } = req.body;

    const mt5Trade = await Trade.findOne({ _id: req.params.id, userId, isFromMT5: true });
    if (!mt5Trade) {
      return res.status(404).json({ success: false, message: 'MT5 trade record not found' });
    }

    const manualTrade = await Trade.findOne({ _id: manualTradeId, userId, isFromMT5: false });
    if (!manualTrade) {
      return res.status(404).json({ success: false, message: 'Manual trade not found to link' });
    }

    // Merge MT5 execution data into manual trade
    manualTrade.mt5PositionId = mt5Trade.mt5PositionId;
    manualTrade.mt5AccountId = mt5Trade.mt5AccountId;
    manualTrade.isFromMT5 = true;
    manualTrade.lotSize = mt5Trade.lotSize;
    manualTrade.commission = mt5Trade.commission;
    manualTrade.swap = mt5Trade.swap;
    manualTrade.entryPrice = mt5Trade.entryPrice;
    manualTrade.exitPrice = mt5Trade.exitPrice;
    manualTrade.takeProfitUSD = mt5Trade.takeProfitUSD;
    manualTrade.takeProfit = mt5Trade.takeProfit;
    manualTrade.journalStatus = 'completed';
    await manualTrade.save();

    // Remove the duplicate MT5 entry
    await Trade.findByIdAndDelete(mt5Trade._id);

    // Update position link
    await MT5Position.findOneAndUpdate(
      { accountId: mt5Trade.mt5AccountId, positionId: mt5Trade.mt5PositionId },
      { journalId: manualTrade._id, journalStatus: 'completed' }
    );

    res.status(200).json({
      success: true,
      linkedTrade: manualTrade,
      message: 'Successfully linked MT5 position to existing manual trade record.'
    });
  } catch (err) {
    console.error('Error linking manual trade:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Disconnect MT5 account and optionally delete imported data
 * DELETE /api/mt5/accounts/:id
 */
exports.disconnectAccount = async (req, res) => {
  try {
    const userId = req.user._id;
    const { deleteData } = req.query;

    const account = await MT5Account.findOne({ _id: req.params.id, userId });
    if (!account) {
      return res.status(404).json({ success: false, message: 'Account not found' });
    }

    account.isActive = false;
    account.status = 'disconnected';
    account.apiKeyHash = null;
    await account.save();

    activeOpenPositionsCache.delete(account._id.toString());

    if (deleteData === 'true') {
      await MT5Deal.deleteMany({ accountId: account._id });
      await MT5Position.deleteMany({ accountId: account._id });
      await Trade.deleteMany({ mt5AccountId: account._id });
    }

    await MT5AuditLog.create({
      userId,
      accountId: account._id,
      event: 'account_disconnected',
      details: { deleteData: deleteData === 'true' },
      ipAddress: req.ip
    });

    res.status(200).json({
      success: true,
      message: deleteData === 'true'
        ? 'Account disconnected and all MT5 imported trade data permanently purged.'
        : 'Account disconnected and connector credentials revoked.'
    });
  } catch (err) {
    console.error('Error disconnecting account:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Get credentials/config for local Windows Python MT5 connector
 * GET /api/mt5/accounts/:id/connector-config
 */
exports.getConnectorConfig = async (req, res) => {
  try {
    const userId = req.user._id;
    const account = await MT5Account.findOne({ _id: req.params.id, userId }).select('+apiKeyHash');
    if (!account) {
      return res.status(404).json({ success: false, message: 'Account not found' });
    }

    if (!account.apiKeyId || !account.apiKeyHash) {
      account.apiKeyId = 'mt5_key_' + crypto.randomBytes(8).toString('hex');
      account.apiKeyHash = crypto.randomBytes(32).toString('hex');
      await account.save();
    }

    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.get('host') || 'localhost:5000';
    const backendUrl = `${protocol}://${host}`;

    res.status(200).json({
      success: true,
      config: {
        backend_url: backendUrl,
        api_key_id: account.apiKeyId,
        api_secret: account.apiKeyHash,
        server: account.serverName,
        login: account.login,
        polling_interval_sec: 5
      }
    });
  } catch (err) {
    console.error('Error getting connector config:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Update MT5 account capital / balance / settings
 * PUT /api/mt5/accounts/:id
 */
exports.updateAccount = async (req, res) => {
  try {
    const userId = req.user._id;
    const { balance, currency, leverage, serverName, accountName, tradeMode } = req.body;

    const account = await MT5Account.findOne({ _id: req.params.id, userId });
    if (!account) {
      return res.status(404).json({ success: false, message: 'Account not found' });
    }

    if (balance !== undefined && !isNaN(Number(balance))) {
      account.balance = Number(balance);
      account.equity = Number((account.balance + (account.floatingProfit || 0)).toFixed(2));
      account.freeMargin = Number((account.equity - (account.margin || 0)).toFixed(2));
    }
    if (currency) account.currency = currency;
    if (leverage) account.leverage = Number(leverage);
    if (serverName) account.serverName = serverName;
    if (accountName) account.accountName = accountName;
    if (tradeMode) account.tradeMode = tradeMode;

    await account.save();

    res.status(200).json({
      success: true,
      account,
      message: 'Account updated successfully'
    });
  } catch (err) {
    console.error('Error updating account:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};


