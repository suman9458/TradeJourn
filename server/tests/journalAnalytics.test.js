/**
 * TradeJourn Personal Trading Analytics - Verification & Audit Test Suite
 * =======================================================================
 * Validates deterministic financial calculations against an independent
 * ground-truth dataset with known values:
 * 1. Financial metrics (win rate, gross & net P&L, fees, swaps, expectancy, profit factor, drawdown, holding duration)
 * 2. Breakeven trades and win rate excluding BE
 * 3. User ownership, multi-tenant isolation, and data security
 * 4. Date range, instrument, and session filtering
 * 5. Strategy comparison (A+ vs B vs C setups) with correlation vs causation
 * 6. Recurring execution mistakes with causal mechanisms and remedies
 * 7. Equity curve and drawdown tracking
 * 8. AI Coach natural language formatting and offline fallback verification
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const Trade = require('../models/Trade');
const {
  getTradeGrossProfit,
  getTradeFees,
  getTradeSwap,
  getTradeNetProfit,
  getTradeProfit,
  calculateTradeDurationMinutes,
  formatDuration,
  computeStreaks,
  computeEquityCurveAndDrawdown
} = require('../services/ai/tradeUtils');

const {
  getTradeStats,
  getTradeHistory,
  getTradeDetails,
  getPerformanceBySymbol,
  getPerformanceBySession,
  compareStrategies,
  getDrawdownAnalysis,
  getMistakesAndEmotions,
  JOURNAL_FUNCTION_DECLARATIONS,
  executeJournalTool
} = require('../services/ai/journalTools');

const { processAiCoachChat, formatGroundedAnswer } = require('../services/ai/aiCoachService');
const { classifyIntent } = require('../services/ai/intentClassifier');

// Synthetic In-Memory Master Dataset with Known Ground Truth
const userA_Id = new mongoose.Types.ObjectId().toString();
const userB_Id = new mongoose.Types.ObjectId().toString();

const mockTradesUserA = [
  {
    _id: new mongoose.Types.ObjectId().toString(),
    userId: userA_Id,
    tradeName: 'EURUSD Breakout London',
    date: '2026-10-01',
    time: '08:30',
    instrument: 'EURUSD',
    session: 'London',
    direction: 'Buy',
    result: 'WIN',
    takeProfitUSD: 300,
    commission: 5,
    swap: -2,
    rResult: 2.0,
    rr: 2.0,
    pips: 30,
    setupRating: 'A+',
    entryType: 'Breakout',
    emotion: 'Calm',
    disciplineScore: 95,
    mistakes: ['None'],
    holdingDurationMinutes: 45
  },
  {
    _id: new mongoose.Types.ObjectId().toString(),
    userId: userA_Id,
    tradeName: 'EURUSD Retest London',
    date: '2026-10-03',
    time: '09:00',
    instrument: 'EURUSD',
    session: 'London',
    direction: 'Buy',
    result: 'WIN',
    takeProfitUSD: 200,
    commission: 5,
    swap: 0,
    rResult: 1.5,
    rr: 1.5,
    pips: 20,
    setupRating: 'A+',
    entryType: 'Retest',
    emotion: 'Calm',
    disciplineScore: 90,
    mistakes: ['None'],
    holdingDurationMinutes: 60
  },
  {
    _id: new mongoose.Types.ObjectId().toString(),
    userId: userA_Id,
    tradeName: 'GBPUSD Early NY',
    date: '2026-10-05',
    time: '14:00',
    instrument: 'GBPUSD',
    session: 'New York',
    direction: 'Sell',
    result: 'LOSS',
    takeProfitUSD: -100,
    commission: 4,
    swap: -1,
    rResult: -1.0,
    rr: 2.0,
    pips: -10,
    setupRating: 'B',
    entryType: 'Early Entry',
    emotion: 'Fear',
    disciplineScore: 65,
    mistakes: ['Moved SL', 'Chasing Price'],
    holdingDurationMinutes: 30
  },
  {
    _id: new mongoose.Types.ObjectId().toString(),
    userId: userA_Id,
    tradeName: 'XAUUSD Confirm NY',
    date: '2026-10-08',
    time: '15:15',
    instrument: 'XAUUSD',
    session: 'New York',
    direction: 'Buy',
    result: 'WIN',
    takeProfitUSD: 500,
    commission: 8,
    swap: -3,
    rResult: 2.5,
    rr: 2.5,
    pips: 50,
    setupRating: 'A',
    entryType: 'Confirmation',
    emotion: 'Confident',
    disciplineScore: 90,
    mistakes: ['None'],
    holdingDurationMinutes: 120
  },
  {
    _id: new mongoose.Types.ObjectId().toString(),
    userId: userA_Id,
    tradeName: 'EURUSD BE London',
    date: '2026-10-10',
    time: '08:45',
    instrument: 'EURUSD',
    session: 'London',
    direction: 'Buy',
    result: 'BE',
    takeProfitUSD: 0,
    commission: 5,
    swap: 0,
    rResult: 0.0,
    rr: 2.0,
    pips: 0,
    setupRating: 'A+',
    entryType: 'Confirmation',
    emotion: 'Calm',
    disciplineScore: 90,
    mistakes: ['None'],
    holdingDurationMinutes: 40
  },
  {
    _id: new mongoose.Types.ObjectId().toString(),
    userId: userA_Id,
    tradeName: 'XAUUSD Breakout NY',
    date: '2026-10-12',
    time: '16:00',
    instrument: 'XAUUSD',
    session: 'New York',
    direction: 'Sell',
    result: 'LOSS',
    takeProfitUSD: -150,
    commission: 8,
    swap: 0,
    rResult: -1.0,
    rr: 2.0,
    pips: -15,
    setupRating: 'B',
    entryType: 'Breakout',
    emotion: 'FOMO',
    disciplineScore: 60,
    mistakes: ['Moved SL'],
    holdingDurationMinutes: 15
  },
  {
    _id: new mongoose.Types.ObjectId().toString(),
    userId: userA_Id,
    tradeName: 'EURUSD Retest Asian',
    date: '2026-10-15',
    time: '02:30',
    instrument: 'EURUSD',
    session: 'Asian',
    direction: 'Buy',
    result: 'LOSS',
    takeProfitUSD: -80,
    commission: 4,
    swap: -1,
    rResult: -1.0,
    rr: 1.5,
    pips: -8,
    setupRating: 'C',
    entryType: 'Retest',
    emotion: 'Impatient',
    disciplineScore: 70,
    mistakes: ['Chasing Price'],
    holdingDurationMinutes: null // Intentionally unrecorded to test missing value resilience
  },
  {
    _id: new mongoose.Types.ObjectId().toString(),
    userId: userA_Id,
    tradeName: 'GBPUSD Confirm London',
    date: '2026-10-18',
    time: '09:30',
    instrument: 'GBPUSD',
    session: 'London',
    direction: 'Buy',
    result: 'WIN',
    takeProfitUSD: 250,
    commission: 4,
    swap: 1,
    rResult: 2.0,
    rr: 2.0,
    pips: 25,
    setupRating: 'A',
    entryType: 'Confirmation',
    emotion: 'Calm',
    disciplineScore: 90,
    mistakes: ['None'],
    holdingDurationMinutes: 75
  },
  {
    _id: new mongoose.Types.ObjectId().toString(),
    userId: userA_Id,
    tradeName: 'EURUSD Confirm London',
    date: '2026-10-22',
    time: '10:00',
    instrument: 'EURUSD',
    session: 'London',
    direction: 'Sell',
    result: 'WIN',
    takeProfitUSD: 400,
    commission: 5,
    swap: 0,
    rResult: 2.0,
    rr: 2.0,
    pips: 40,
    setupRating: 'A+',
    entryType: 'Confirmation',
    emotion: 'Calm',
    disciplineScore: 95,
    mistakes: ['None'],
    holdingDurationMinutes: 90
  },
  {
    _id: new mongoose.Types.ObjectId().toString(),
    userId: userA_Id,
    tradeName: 'GBPUSD Confirm NY BE',
    date: '2026-10-25',
    time: '14:30',
    instrument: 'GBPUSD',
    session: 'New York',
    direction: 'Sell',
    result: 'BE',
    takeProfitUSD: 0,
    commission: 4,
    swap: 0,
    rResult: 0.0,
    rr: 2.0,
    pips: 0,
    setupRating: 'A',
    entryType: 'Confirmation',
    emotion: 'Calm',
    disciplineScore: 85,
    mistakes: ['None'],
    holdingDurationMinutes: 50
  }
];

const mockTradesUserB = [
  {
    _id: new mongoose.Types.ObjectId().toString(),
    userId: userB_Id,
    tradeName: 'Private BTCUSD Whale Trade',
    date: '2026-10-20',
    time: '12:00',
    instrument: 'BTCUSD',
    session: 'London',
    direction: 'Buy',
    result: 'WIN',
    takeProfitUSD: 50000,
    commission: 20,
    swap: 0,
    rResult: 5.0,
    setupRating: 'A+',
    emotion: 'Calm'
  }
];

const allMockTrades = [...mockTradesUserA, ...mockTradesUserB];

// In-Memory Query Filtering Engine mimicking Mongoose
function filterMockTrades(query = {}) {
  return allMockTrades.filter(t => {
    if (query.userId && String(t.userId) !== String(query.userId)) return false;
    if (query.result && query.result.$in && !query.result.$in.includes(t.result)) return false;
    if (query.result && typeof query.result === 'string' && t.result !== query.result) return false;
    if (query.instrument instanceof RegExp && !query.instrument.test(t.instrument)) return false;
    if (query.session instanceof RegExp && !query.session.test(t.session)) return false;
    if (query.setupRating && t.setupRating !== query.setupRating) return false;
    if (query.entryType && t.entryType !== query.entryType) return false;
    if (query.date) {
      if (query.date.$gte && t.date < query.date.$gte) return false;
      if (query.date.$lte && t.date > query.date.$lte) return false;
    }
    return true;
  });
}

// Intercept Trade Mongoose operations for deterministic test isolation
let originalFind;
let originalFindOne;
let originalCount;
let originalReadyState;

describe('TradeJourn Personal Trading Analytics - Deterministic Verification Suite', () => {

  before(() => {
    originalReadyState = mongoose.connection.readyState;
    Object.defineProperty(mongoose.connection, 'readyState', { value: 1, configurable: true });

    originalFind = Trade.find;
    originalFindOne = Trade.findOne;
    originalCount = Trade.countDocuments;

    Trade.find = function (query = {}) {
      const results = filterMockTrades(query);
      return {
        sort: (sortOpts) => ({
          skip: (offset = 0) => ({
            limit: (limit = 10) => ({
              lean: async () => results.slice(offset, offset + limit)
            }),
            lean: async () => results.slice(offset)
          }),
          limit: (limit = 10) => ({
            lean: async () => results.slice(0, limit)
          }),
          lean: async () => results
        }),
        lean: async () => results
      };
    };

    Trade.findOne = function (query = {}) {
      const results = filterMockTrades(query);
      return {
        lean: async () => results[0] || null
      };
    };

    Trade.countDocuments = async function (query = {}) {
      return filterMockTrades(query).length;
    };
  });

  after(() => {
    Object.defineProperty(mongoose.connection, 'readyState', { value: originalReadyState, configurable: true });
    Trade.find = originalFind;
    Trade.findOne = originalFindOne;
    Trade.countDocuments = originalCount;
  });

  test('1. Deterministic pure financial calculations in tradeUtils', () => {
    const sampleTrade = {
      result: 'WIN',
      takeProfitUSD: 300,
      commission: 5,
      swap: -2,
      holdingDurationMinutes: 90
    };

    assert.equal(getTradeGrossProfit(sampleTrade), 300);
    assert.equal(getTradeFees(sampleTrade), 5);
    assert.equal(getTradeSwap(sampleTrade), -2);
    // Net = 300 - 5 + (-2) = 293
    assert.equal(getTradeNetProfit(sampleTrade), 293);
    assert.equal(calculateTradeDurationMinutes(sampleTrade), 90);
    assert.equal(formatDuration(90), '1h 30m');

    // MT5 trade handling
    const mt5Trade = {
      isFromMT5: true,
      takeProfitUSD: 92, // stored net profit
      commission: -7,
      swap: -1,
      result: 'WIN'
    };
    // In MT5: gross = 92 - (-7) - (-1) = 100
    assert.equal(getTradeGrossProfit(mt5Trade), 100);
    assert.equal(getTradeFees(mt5Trade), 7);
    assert.equal(getTradeSwap(mt5Trade), -1);
    assert.equal(getTradeNetProfit(mt5Trade), 92);

    // Breakeven trade handling
    const beTrade = {
      result: 'BE',
      takeProfitUSD: 0,
      commission: 5,
      swap: 0
    };
    assert.equal(getTradeGrossProfit(beTrade), 0);
    assert.equal(getTradeFees(beTrade), 5);
    // Net on BE with $5 commission = -$5.00
    assert.equal(getTradeNetProfit(beTrade), -5);
  });

  test('2. Independent mathematical verification of User A overall statistics', async () => {
    const stats = await getTradeStats(userA_Id);

    // Ground truth: 10 trades, 5 WIN, 3 LOSS, 2 BE
    assert.equal(stats.hasData, true);
    assert.equal(stats.sampleSize, 10);
    assert.equal(stats.totalTrades, 10);
    assert.equal(stats.winningTrades, 5);
    assert.equal(stats.losingTrades, 3);
    assert.equal(stats.breakEvenTrades, 2);

    // Win Rate: 5/10 = 50.0%
    assert.equal(stats.winRate, '50%');
    // Win Rate Excl. BE: 5/(5+3) = 62.5%
    assert.equal(stats.winRateExcludingBE, '62.5%');
    assert.equal(stats.lossRate, '30%');
    assert.equal(stats.beRate, '20%');

    // Gross P&L: Wins (300+200+500+250+400 = 1650), Losses (100+150+80 = 330)
    assert.equal(stats.grossProfitUSD, '$1,650.00');
    assert.equal(stats.grossLossUSD, '$330.00');

    // Commissions ($52.00) and Swaps (-$6.00)
    assert.equal(stats.totalCommissionsUSD, '$52.00');
    assert.equal(stats.totalSwapsUSD, '-$6.00');

    // Net P&L: 1650 - 330 - 52 + (-6) = $1262.00
    assert.equal(stats.netProfitUSD, '+$1,262.00');

    // Mathematical Expectancy per trade: 1262.00 / 10 = $126.20 per trade
    assert.equal(stats.expectancyUSD, '+$126.20 per trade');

    // Profit Factor: 1650 / 330 = 5.00
    assert.equal(stats.profitFactor, 5.0);

    // Win/Loss Ratio: 330 (avg win) / 110 (avg loss) = 3.00
    assert.equal(stats.avgWinUSD, '$330.00');
    assert.equal(stats.avgLossUSD, '$110.00');
    assert.equal(stats.winLossRatio, 3.0);

    // Total R: 2.0 + 1.5 - 1.0 + 2.5 + 0.0 - 1.0 - 1.0 + 2.0 + 2.0 + 0.0 = +7.00R
    assert.equal(stats.totalR, '+7.00R');
    assert.equal(stats.avgR, '+0.70R');

    // Holding Duration: 9 of 10 recorded. Sum = 525 min. Avg = 58 min ('58m')
    assert.equal(stats.holdingDuration.tradesWithDuration, 9);
    assert.equal(stats.holdingDuration.avgMinutes, 58);
    assert.equal(stats.holdingDuration.formatted, '58m');

    // Date range
    assert.equal(stats.dateRange.earliestTradeDate, '2026-10-01');
    assert.equal(stats.dateRange.latestTradeDate, '2026-10-25');
    assert.equal(stats.dateRange.totalDaysSpan, 25);

    // Max Drawdown: $248.00 (from peak 872 down to 624 between T4 and T7)
    assert.equal(stats.maxDrawdownUSD, '-$248.00');
    // Current Drawdown: $4.00 (T10 closed at 1262 vs peak 1266)
    assert.equal(stats.currentDrawdownUSD, '-$4.00');
    assert.equal(stats.inDrawdown, true);

    // Correlation vs causation note must be explicitly articulated
    assert.ok(stats.correlationVsCausationNote.includes('correlation'));
  });

  test('3. Multi-tenant user ownership and isolation security', async () => {
    // User A should only see User A's data ($1,262.00 net)
    const statsA = await getTradeStats(userA_Id);
    assert.equal(statsA.totalTrades, 10);
    assert.equal(statsA.netProfitUSD, '+$1,262.00');

    // User B should only see User B's data ($49,980.00 net after $20 fee)
    const statsB = await getTradeStats(userB_Id);
    assert.equal(statsB.totalTrades, 1);
    assert.equal(statsB.winningTrades, 1);
    assert.equal(statsB.netProfitUSD, '+$49,980.00');

    // Random non-existent user should receive hasData: false with 0 trades
    const randomUserId = new mongoose.Types.ObjectId().toString();
    const statsEmpty = await getTradeStats(randomUserId);
    assert.equal(statsEmpty.hasData, false);
    assert.equal(statsEmpty.totalTrades, 0);

    // Unauthenticated/null userId must return hasData: false safely
    const statsNull = await getTradeStats(null);
    assert.equal(statsNull.hasData, false);
    assert.equal(statsNull.totalTrades, 0);
  });

  test('4. Date range, instrument, and session filtering precision', async () => {
    // Filter instrument: EURUSD (5 trades: T1, T2, T5, T7, T9)
    const eurusdStats = await getTradeStats(userA_Id, { instrument: 'EURUSD' });
    assert.equal(eurusdStats.totalTrades, 5);
    assert.equal(eurusdStats.winningTrades, 3);
    assert.equal(eurusdStats.losingTrades, 1);
    assert.equal(eurusdStats.breakEvenTrades, 1);
    assert.equal(eurusdStats.winRate, '60%');
    assert.equal(eurusdStats.winRateExcludingBE, '75%');

    // Filter date range: 2026-10-01 to 2026-10-08 (4 trades: T1, T2, T3, T4)
    const dateRangeStats = await getTradeStats(userA_Id, {
      startDate: '2026-10-01',
      endDate: '2026-10-08'
    });
    assert.equal(dateRangeStats.totalTrades, 4);
    assert.equal(dateRangeStats.winningTrades, 3);
    assert.equal(dateRangeStats.losingTrades, 1);
    // Net: 293 + 195 - 105 + 489 = 872.00
    assert.equal(dateRangeStats.netProfitUSD, '+$872.00');

    // Filter session: London (5 trades: T1, T2, T5, T8, T9)
    const londonStats = await getTradeStats(userA_Id, { session: 'London' });
    assert.equal(londonStats.totalTrades, 5);
    assert.equal(londonStats.winningTrades, 4);
    assert.equal(londonStats.losingTrades, 0);
    assert.equal(londonStats.breakEvenTrades, 1);
    assert.equal(londonStats.winRate, '80%');
    assert.equal(londonStats.winRateExcludingBE, '100%');
  });

  test('5. compareStrategies deterministically contrasts setup tiers', async () => {
    const comparison = await compareStrategies(userA_Id, { dimension: 'setupRating' });
    assert.equal(comparison.hasData, true);
    assert.equal(comparison.totalTradesAnalyzed, 10);

    // Should classify A+, A, B, C
    const aPlus = comparison.comparison.find(c => c.strategyName === 'A+');
    const bTier = comparison.comparison.find(c => c.strategyName === 'B');

    assert.ok(aPlus, 'A+ setup must exist');
    assert.ok(bTier, 'B setup must exist');

    // A+: 4 trades (T1, T2, T5, T9) -> 3W / 0L / 1BE -> Net: 293+195-5+395 = $878.00
    assert.equal(aPlus.sampleSize, 4);
    assert.equal(aPlus.wins, 3);
    assert.equal(aPlus.losses, 0);
    assert.equal(aPlus.breakevens, 1);
    assert.equal(aPlus.winRate, '75%');
    assert.equal(aPlus.winRateExcludingBE, '100%');
    assert.equal(aPlus.netProfitUSD, '+$878.00');
    assert.equal(aPlus.expectancyUSD, '+$219.50 per trade');

    // B: 2 trades (T3, T6) -> 0W / 2L / 0BE -> Net: -105 - 158 = -$263.00
    assert.equal(bTier.sampleSize, 2);
    assert.equal(bTier.wins, 0);
    assert.equal(bTier.losses, 2);
    assert.equal(bTier.netProfitUSD, '-$263.00');

    // Best strategy must be A+
    assert.equal(comparison.bestStrategy.name, 'A+');
    assert.ok(comparison.correlationVsCausationSynthesis.includes('correlation'));
  });

  test('6. getDrawdownAnalysis tracks peaks, valley, duration, and recovery factor', async () => {
    const dd = await getDrawdownAnalysis(userA_Id);
    assert.equal(dd.hasData, true);
    assert.equal(dd.sampleSize, 10);
    assert.equal(dd.peakEquityUSD, '$1,266.00');
    assert.equal(dd.currentRealizedNetProfitUSD, '+$1,262.00');
    assert.equal(dd.maxDrawdownUSD, '-$248.00');
    assert.equal(dd.currentDrawdownUSD, '-$4.00');
    assert.equal(dd.inDrawdown, true);
    assert.equal(dd.maxDrawdownDurationTrades, 4);
    // Recovery Factor = 1262 / 248 = 5.09
    assert.equal(dd.recoveryFactor, 5.09);
    assert.ok(dd.riskPreservationGuidance, 'Capital preservation guidance must be present');
  });

  test('7. getMistakesAndEmotions flags recurring mistakes with causal mechanisms', async () => {
    const audit = await getMistakesAndEmotions(userA_Id);
    assert.equal(audit.hasData, true);
    assert.equal(audit.totalTradesAnalyzed, 10);

    const movedSL = audit.mistakes.find(m => m.mistake === 'Moved SL');
    const chasing = audit.mistakes.find(m => m.mistake === 'Chasing Price');

    assert.ok(movedSL, "'Moved SL' must be tracked");
    assert.ok(chasing, "'Chasing Price' must be tracked");

    // Both occurred twice -> isRecurring = true
    assert.equal(movedSL.occurrences, 2);
    assert.equal(movedSL.isRecurring, true);
    // Losses on T3 ($105) + T6 ($158) = $263.00
    assert.equal(movedSL.totalLossUSD, '-$263.00');
    assert.ok(movedSL.causalMechanism.includes('stop-loss') || movedSL.causalMechanism.includes('loss'));
    assert.ok(movedSL.actionableRemedy.length > 20);

    assert.equal(chasing.occurrences, 2);
    assert.equal(chasing.isRecurring, true);
    // Losses on T3 ($105) + T7 ($85) = $190.00
    assert.equal(chasing.totalLossUSD, '-$190.00');
  });

  test('8. getTradeHistory returns formatted records with fees, duration, and limit', async () => {
    const history = await getTradeHistory(userA_Id, { limit: 5 });
    assert.equal(history.totalReturned, 5);
    assert.equal(history.totalMatchingTrades, 10);
    assert.equal(history.requestedLimit, 5);

    const first = history.trades[0];
    assert.ok(first.grossProfitUSD);
    assert.ok(first.netProfitUSD);
    assert.ok(first.commissionUSD);
    assert.ok(first.holdingDuration);
  });

  test('9. Function calling declarations include all 18 tools and execute properly', async () => {
    assert.equal(JOURNAL_FUNCTION_DECLARATIONS.length, 18);
    const declaredNames = JOURNAL_FUNCTION_DECLARATIONS.map(d => d.name);
    assert.ok(declaredNames.includes('get_trade_stats'));
    assert.ok(declaredNames.includes('compare_strategies'));
    assert.ok(declaredNames.includes('get_drawdown_analysis'));
    assert.ok(declaredNames.includes('get_performance_by_symbol'));
    assert.ok(declaredNames.includes('get_performance_by_session'));
    assert.ok(declaredNames.includes('get_mistakes_and_emotions'));

    // Test executeJournalTool for compare_strategies
    const compTool = await executeJournalTool('compare_strategies', { dimension: 'setupRating' }, userA_Id);
    assert.equal(compTool.hasData, true);
    assert.equal(compTool.totalTradesAnalyzed, 10);

    // Test executeJournalTool for get_drawdown_analysis
    const ddTool = await executeJournalTool('get_drawdown_analysis', {}, userA_Id);
    assert.equal(ddTool.hasData, true);
    assert.equal(ddTool.maxDrawdownUSD, '-$248.00');
  });

  test('10. AI Coach chat delivers BLUF numbers matching backend results exactly', async () => {
    const response = await processAiCoachChat({
      question: 'What is my win rate and expectancy?',
      userApiKey: 'offline',
      user: { _id: userA_Id }
    });

    assert.equal(response.success, true);
    // Must contain exact calculated ground truth numbers
    assert.ok(response.answer.includes('50%'), 'Must report 50% win rate');
    assert.ok(response.answer.includes('+$1,262.00') || response.answer.includes('$1,262'), 'Must report realized net profit');
    assert.ok(response.answer.includes('+$126.20 per trade') || response.answer.includes('$126.20'), 'Must report expectancy per trade');
    assert.ok(response.answer.includes('Profit Factor') && response.answer.includes('**5**'), 'Must report profit factor 5');
    assert.ok(response.answer.includes('58m'), 'Must report average holding duration 58m');
    assert.ok(response.answer.includes('Correlation vs Causation'), 'Must explain correlation vs causation');
  });

  test('11. AI Coach handles Hinglish query with natural mirroring and ground truth', async () => {
    const response = await processAiCoachChat({
      question: 'Mera win rate aur expectancy kya hai bhai?',
      userApiKey: 'offline',
      user: { _id: userA_Id }
    });

    assert.equal(response.success, true);
    assert.ok(response.answer.includes('50%'));
    assert.ok(response.answer.includes('$1,262'));
    assert.ok(response.answer.includes('Suggested Follow-ups') || response.answer.includes('Next Steps'));
  });

  test('12. Strategy comparison query routes and formats comparative synthesis', async () => {
    const intentRes = classifyIntent('Compare my setups and tell me which strategy is best');
    assert.equal(intentRes.intent, 'STRATEGY_COMPARISON');
    assert.equal(intentRes.needsJournal, true);

    const response = await processAiCoachChat({
      question: 'Compare my setups and tell me which strategy is best',
      userApiKey: 'offline',
      user: { _id: userA_Id }
    });

    assert.equal(response.success, true);
    assert.ok(response.answer.includes('A+'));
    assert.ok(response.answer.includes('Best Performing Strategy'));
    assert.ok(response.answer.includes('Correlation vs Causation'));
  });

  test('13. Drawdown query routes and returns capital preservation protocol', async () => {
    const intentRes = classifyIntent('What is my maximum drawdown?');
    assert.equal(intentRes.intent, 'DRAWDOWN_ANALYSIS');
    assert.equal(intentRes.needsJournal, true);

    const response = await processAiCoachChat({
      question: 'What is my maximum drawdown?',
      userApiKey: 'offline',
      user: { _id: userA_Id }
    });

    assert.equal(response.success, true);
    assert.ok(response.answer.includes('-$248.00'));
    assert.ok(response.answer.includes('Recovery Factor'));
  });

  test('14. Recurring mistakes query returns frequencies and remedies', async () => {
    const response = await processAiCoachChat({
      question: 'What are my top recurring mistakes?',
      userApiKey: 'offline',
      user: { _id: userA_Id }
    });

    assert.equal(response.success, true);
    assert.ok(response.answer.includes('Moved SL') || response.answer.includes('Chasing Price'));
    assert.ok(response.answer.includes('Causal Mechanism'));
    assert.ok(response.answer.includes('Actionable Remedy'));
  });

});
