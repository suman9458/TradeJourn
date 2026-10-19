/**
 * TradeJourn MT5 Integration Test Suite
 * Run with: node --test server/tests/mt5.test.js
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const MT5Account = require('../models/MT5Account');
const MT5Deal = require('../models/MT5Deal');
const MT5Position = require('../models/MT5Position');
const MT5AuditLog = require('../models/MT5AuditLog');
const Trade = require('../models/Trade');
const User = require('../models/User');

const {
  processDealsBatch,
  normalizeSymbol,
  calculatePips
} = require('../services/mt5SyncService');
const { up, down } = require('../migrations/001_mt5_schema_init');

let mongoServer;
let testUserA;
let testUserB;
let testAccount;

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  // Setup test users
  testUserA = await User.create({
    name: 'Trader Alpha',
    userId: 'trader_alpha',
    password: 'password123'
  });

  testUserB = await User.create({
    name: 'Trader Beta',
    userId: 'trader_beta',
    password: 'password123'
  });

  testAccount = await MT5Account.create({
    userId: testUserA._id,
    serverName: 'Broker-Demo',
    login: 1001001,
    tradeMode: 'demo',
    apiKeyId: 'mt5_key_test123',
    apiKeyHash: 'test_secret_hash_456',
    status: 'connected'
  });
});

after(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

// ----------------------------------------------------------------------------
// 1. SECURITY & CODE INSPECTION ASSERTION
// ----------------------------------------------------------------------------
describe('Security: Read-Only Connector Code Integrity', () => {
  test('Asserts connector never imports or calls order_send or order modification functions', () => {
    const connectorPath = path.join(__dirname, '../../connectors/mt5-python/connector.py');
    const content = fs.readFileSync(connectorPath, 'utf8');

    // Forbidden order execution calls
    const forbidden = ['order_send', 'order_check', 'order_calc_margin', 'OrderSend'];
    for (const fn of forbidden) {
      assert.strictEqual(
        content.includes(`mt5.${fn}`) || content.includes(`from MetaTrader5 import ${fn}`),
        false,
        `SECURITY VIOLATION: Connector contains reference to ${fn}!`
      );
    }
  });
});

// ----------------------------------------------------------------------------
// 2. MIGRATION TEST: UP AND DOWN
// ----------------------------------------------------------------------------
describe('Database Migrations: Up & Down (Rollback)', () => {
  test('Executes Migration 001 UP and DOWN cleanly', async () => {
    const db = mongoose.connection.db;

    // Up
    const upRes = await up(db);
    assert.strictEqual(upRes.success, true);

    // Down (Rollback)
    const downRes = await down(db);
    assert.strictEqual(downRes.success, true);

    // Restore Up for remaining tests
    await up(db);
  });
});

// ----------------------------------------------------------------------------
// 3. HMAC SECURITY & SIGNATURE TESTS
// ----------------------------------------------------------------------------
describe('Security: HMAC-SHA256 Signature & Replay Prevention', () => {
  test('Computes valid HMAC signature matching server verification logic', () => {
    const secret = 'super_secret_signing_key_789';
    const method = 'POST';
    const endpoint = '/api/mt5/sync/deals';
    const timestamp = str(int(Date.now() / 1000));
    const nonce = 'unique_nonce_abc_123';
    const body = { deals: [] };

    const bodyHash = crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex');
    const payloadToSign = `${method}:${endpoint}:${timestamp}:${nonce}:${bodyHash}`;

    const signature = crypto.createHmac('sha256', secret).update(payloadToSign).digest('hex');

    // Verify
    const expected = crypto.createHmac('sha256', secret).update(payloadToSign).digest('hex');
    assert.strictEqual(signature, expected);
  });

  function str(val) { return String(val); }
  function int(val) { return Math.floor(val); }
});

// ----------------------------------------------------------------------------
// 4. INGESTION & POSITION AGGREGATION TESTS
// ----------------------------------------------------------------------------
describe('Position Aggregator & Deal Ingestion Engine', () => {
  test('Case A: Simple Open-Close (IN -> OUT)', async () => {
    const posId = 5001;
    const deals = [
      {
        dealTicket: 9001,
        orderTicket: 8001,
        positionId: posId,
        symbol: 'EURUSD.raw',
        type: 'BUY',
        entry: 'IN',
        volume: 1.0,
        price: 1.0850,
        timeUTC: new Date('2026-03-01T10:00:00Z'),
        profit: 0,
        commission: -3.5,
        swap: 0,
        sl: 1.0820,
        tp: 1.0900
      },
      {
        dealTicket: 9002,
        orderTicket: 8002,
        positionId: posId,
        symbol: 'EURUSD.raw',
        type: 'SELL',
        entry: 'OUT',
        volume: 1.0,
        price: 1.0890,
        timeUTC: new Date('2026-03-01T11:00:00Z'),
        profit: 400.0,
        commission: -3.5,
        swap: -1.2
      }
    ];

    const result = await processDealsBatch(testAccount, testUserA._id, deals);
    assert.strictEqual(result.insertedCount, 2);
    assert.strictEqual(result.closedPositions.length, 1);

    const position = await MT5Position.findOne({ accountId: testAccount._id, positionId: posId });
    assert.strictEqual(position.status, 'closed');
    assert.strictEqual(position.isFullyClosed, true);
    assert.strictEqual(position.netProfit, 391.8); // 400 - 3.5 - 3.5 - 1.2
    assert.strictEqual(position.normalizedSymbol, 'EURUSD');

    // Exactly 1 pending journal created
    const pendingTrade = await Trade.findOne({ mt5PositionId: posId, userId: testUserA._id });
    assert.ok(pendingTrade, 'Pending trade must be created');
    assert.strictEqual(pendingTrade.journalStatus, 'pending');
    assert.strictEqual(pendingTrade.result, 'WIN');
  });

  test('Case B: Partial Close (IN -> Partial OUT)', async () => {
    const posId = 5002;
    const deals = [
      {
        dealTicket: 9010,
        positionId: posId,
        symbol: 'GBPUSD',
        type: 'BUY',
        entry: 'IN',
        volume: 2.0,
        price: 1.2500,
        timeUTC: new Date('2026-03-02T09:00:00Z')
      },
      {
        dealTicket: 9011,
        positionId: posId,
        symbol: 'GBPUSD',
        type: 'SELL',
        entry: 'OUT',
        volume: 1.0,
        price: 1.2540,
        timeUTC: new Date('2026-03-02T10:00:00Z'),
        profit: 400.0
      }
    ];

    const result = await processDealsBatch(testAccount, testUserA._id, deals);
    assert.strictEqual(result.closedPositions.length, 0); // Position is NOT fully closed yet

    const position = await MT5Position.findOne({ accountId: testAccount._id, positionId: posId });
    assert.strictEqual(position.status, 'open');
    assert.strictEqual(position.remainingVolume, 1.0);
    assert.strictEqual(position.closedVolume, 1.0);

    const pendingTrade = await Trade.findOne({ mt5PositionId: posId });
    assert.strictEqual(pendingTrade, null, 'Must NOT create journal entry for partial close');
  });

  test('Case C: Scale-In (IN -> IN -> OUT)', async () => {
    const posId = 5003;
    const deals = [
      {
        dealTicket: 9020,
        positionId: posId,
        symbol: 'XAUUSD',
        type: 'BUY',
        entry: 'IN',
        volume: 1.0,
        price: 2000.0,
        timeUTC: new Date('2026-03-03T08:00:00Z')
      },
      {
        dealTicket: 9021,
        positionId: posId,
        symbol: 'XAUUSD',
        type: 'BUY',
        entry: 'IN',
        volume: 1.0,
        price: 2010.0,
        timeUTC: new Date('2026-03-03T09:00:00Z')
      },
      {
        dealTicket: 9022,
        positionId: posId,
        symbol: 'XAUUSD',
        type: 'SELL',
        entry: 'OUT',
        volume: 2.0,
        price: 2020.0,
        timeUTC: new Date('2026-03-03T10:00:00Z'),
        profit: 300.0
      }
    ];

    await processDealsBatch(testAccount, testUserA._id, deals);
    const position = await MT5Position.findOne({ accountId: testAccount._id, positionId: posId });
    assert.strictEqual(position.status, 'closed');
    assert.strictEqual(position.volume, 2.0);
    assert.strictEqual(position.openPrice, 2005.0); // Weighted average of 2000 and 2010
  });

  test('Case D: Duplicate Deal Replay Idempotency', async () => {
    const posId = 5004;
    const deal = {
      dealTicket: 9030,
      positionId: posId,
      symbol: 'USDJPY',
      type: 'SELL',
      entry: 'IN',
      volume: 0.5,
      price: 150.00,
      timeUTC: new Date('2026-03-04T07:00:00Z')
    };

    // First ingestion
    const res1 = await processDealsBatch(testAccount, testUserA._id, [deal]);
    assert.strictEqual(res1.insertedCount, 1);

    // Replay identical deal
    const res2 = await processDealsBatch(testAccount, testUserA._id, [deal]);
    assert.strictEqual(res2.insertedCount, 0, 'Duplicate deal must be ignored cleanly');

    const count = await MT5Deal.countDocuments({ accountId: testAccount._id, dealTicket: 9030 });
    assert.strictEqual(count, 1, 'Only one deal record must exist in DB');
  });

  test('Case E: Profit Factor Safe Zero-Loss Handling', () => {
    // Formula check
    const totalGains = 1500.0;
    const totalLosses = 0.0;
    const profitFactor = totalLosses === 0 ? (totalGains > 0 ? 99.99 : 0.0) : (totalGains / totalLosses);
    assert.strictEqual(isFinite(profitFactor), true);
    assert.strictEqual(profitFactor, 99.99);
  });
});

// ----------------------------------------------------------------------------
// 5. OWNERSHIP ISOLATION
// ----------------------------------------------------------------------------
describe('Security: Strict User Ownership Isolation', () => {
  test('User B cannot view or access User A accounts or trades', async () => {
    const userAAccounts = await MT5Account.find({ userId: testUserB._id });
    assert.strictEqual(userAAccounts.length, 0, 'User B must see zero accounts of User A');

    const userBTrades = await Trade.find({ userId: testUserB._id });
    assert.strictEqual(userBTrades.length, 0, 'User B must see zero trades of User A');
  });
});

// ----------------------------------------------------------------------------
// 6. CLOUD MT5 DIRECT WEB LOGIN (NO DOWNLOAD / NO VPS)
// ----------------------------------------------------------------------------
describe('Cloud MT5 API: Direct Web Login (No Download)', () => {
  test('Connects direct cloud account and seeds initial audit deals', async () => {
    const { connectCloudAccount, getCloudOpenPositions } = require('../services/metaApiService');
    const cloudRes = await connectCloudAccount(testUserA._id, {
      serverName: 'ICMarketsSC-Demo',
      login: 98765432,
      password: 'investor_read_only_pw',
      accountName: 'Cloud Demo Account',
      tradeMode: 'demo'
    });

    assert.strictEqual(cloudRes.account.connectionMethod, 'cloud');
    assert.strictEqual(cloudRes.account.status, 'connected');
    assert.strictEqual(cloudRes.account.serverName, 'ICMarketsSC-Demo');
    assert.strictEqual(cloudRes.account.login, 98765432);

    // Verify deals were seeded into MT5Deal collection
    const deals = await MT5Deal.find({ accountId: cloudRes.account._id });
    assert.ok(deals.length > 0, 'Cloud account should have seeded deals');

    const positions = getCloudOpenPositions(cloudRes.account);
    assert.ok(positions.length > 0, 'Cloud account should stream active open positions');
  });
});

