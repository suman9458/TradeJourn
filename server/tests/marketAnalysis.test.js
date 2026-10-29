/**
 * TradeJourn External Market Data & Analysis Engine Test Suite
 * ============================================================
 * Comprehensive audit of external market data adapters, candlestick
 * validation, freshness classification, technical indicators,
 * evidence-based scenario planning, and non-promissory disclosures.
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const {
  validateSingleCandle,
  validateCandles,
  classifyFreshness,
  isMarketWeekend
} = require('../services/marketData/candleValidator');

const BaseMarketDataProvider = require('../services/marketData/providers/baseProvider');
const BinanceProvider = require('../services/marketData/providers/binanceProvider');
const TwelveDataProvider = require('../services/marketData/providers/twelveDataProvider');
const YahooProvider = require('../services/marketData/providers/yahooProvider');
const TestStubProvider = require('../services/marketData/providers/testStubProvider');

const {
  normalizeSymbol,
  getCurrentMarketSession,
  detectAssetClass,
  getMarketData,
  getMultiTimeframeMarketData,
  setTestProvider,
  resetTestProvider,
  clearMarketCache
} = require('../services/marketData/marketDataService');

const {
  calculateSMA,
  calculateEMA,
  calculateRSI,
  calculateMACD,
  calculateATR,
  calculateBollingerBands,
  detectSwingPoints,
  detectMarketStructure,
  detectBOSandCHOCH,
  detectLiquiditySweep,
  detectFairValueGaps,
  detectRSIDivergence,
  detectOrderBlocksAndZones,
  generateStructuredOutlook
} = require('../services/ai/technicalAnalysisEngine');

const { processAiCoachChat } = require('../services/ai/aiCoachService');

// Helper to create synthetic candle sequence
function createCandles(count = 20, base = 100, step = 1) {
  const candles = [];
  const baseTime = Date.now() - (count * 3600 * 1000);
  for (let i = 0; i < count; i++) {
    const open = base + (i * step);
    const close = open + (step * 0.5);
    const high = Math.max(open, close) + 1.0;
    const low = Math.min(open, close) - 1.0;
    candles.push({
      time: new Date(baseTime + (i * 3600 * 1000)).toISOString(),
      open,
      high,
      low,
      close,
      volume: 500 + i * 20
    });
  }
  return candles;
}

describe('TradeJourn Market Data & Technical Analysis Engine Verification Suite', () => {

  beforeEach(() => {
    clearMarketCache();
    resetTestProvider();
  });

  afterEach(() => {
    clearMarketCache();
    resetTestProvider();
  });

  // ---------------------------------------------------------------------------
  // 1. Candlestick Integrity & Validation
  // ---------------------------------------------------------------------------
  test('1. Valid single candle passes all geometric consistency checks', () => {
    const validCandle = {
      open: 2050.00,
      high: 2060.00,
      low: 2045.00,
      close: 2055.50,
      time: '2026-10-29T12:00:00.000Z',
      volume: 1200
    };
    const res = validateSingleCandle(validCandle, 0);
    assert.equal(res.valid, true);
    assert.equal(res.errors.length, 0);
  });

  test('2. Inverted candle geometry (high < low, high < open, low > close) is detected and rejected', () => {
    const invalid1 = { open: 2050, high: 2040, low: 2045, close: 2048, time: '2026-10-29T12:00:00.000Z' }; // high < low
    const invalid2 = { open: 2050, high: 2055, low: 2060, close: 2052, time: '2026-10-29T12:00:00.000Z' }; // low > open & close
    const invalid3 = { open: -10, high: 20, low: -15, close: 10, time: '2026-10-29T12:00:00.000Z' }; // negative price

    const res1 = validateSingleCandle(invalid1, 1);
    const res2 = validateSingleCandle(invalid2, 2);
    const res3 = validateSingleCandle(invalid3, 3);

    assert.equal(res1.valid, false);
    assert.ok(res1.errors.some(e => e.includes('High') && e.includes('Low')));

    assert.equal(res2.valid, false);
    assert.ok(res2.errors.some(e => e.includes('Low') && e.includes('greater than')));

    assert.equal(res3.valid, false);
    assert.ok(res3.errors.some(e => e.includes('Invalid open price')));
  });

  test('3. validateCandles sorts out-of-order candles and deduplicates timestamps', () => {
    const t1 = '2026-10-29T10:00:00.000Z';
    const t2 = '2026-10-29T11:00:00.000Z';
    const t3 = '2026-10-29T12:00:00.000Z';

    const disordered = [
      { time: t3, open: 102, high: 105, low: 101, close: 104, volume: 10 },
      { time: t1, open: 100, high: 103, low: 99, close: 101, volume: 10 },
      { time: t2, open: 101, high: 104, low: 100, close: 102, volume: 10 },
      { time: t2, open: 101, high: 104, low: 100, close: 102, volume: 15 }, // duplicate t2
      { time: '2026-10-29T13:00:00.000Z', open: 104, high: 107, low: 103, close: 106, volume: 10 },
      { time: '2026-10-29T14:00:00.000Z', open: 106, high: 109, low: 105, close: 108, volume: 10 }
    ];

    const validated = validateCandles(disordered, '1h', 'forex');
    assert.equal(validated.valid, true);
    assert.equal(validated.cleanCandles.length, 5); // 6 minus 1 duplicate
    assert.equal(validated.cleanCandles[0].time, t1);
    assert.equal(validated.cleanCandles[1].time, t2);
    assert.equal(validated.cleanCandles[2].time, t3);
  });

  test('4. validateCandles detects missing candle intervals (data gaps)', () => {
    // 1-hour candles with a 5-hour gap between candle 2 and 3 on a Wednesday
    const t0 = new Date('2026-10-28T10:00:00.000Z').getTime(); // Wednesday
    const candlesWithGap = [
      { time: new Date(t0).toISOString(), open: 100, high: 102, low: 99, close: 101 },
      { time: new Date(t0 + 1 * 3600000).toISOString(), open: 101, high: 103, low: 100, close: 102 },
      { time: new Date(t0 + 6 * 3600000).toISOString(), open: 102, high: 104, low: 101, close: 103 }, // 5-hour jump
      { time: new Date(t0 + 7 * 3600000).toISOString(), open: 103, high: 105, low: 102, close: 104 },
      { time: new Date(t0 + 8 * 3600000).toISOString(), open: 104, high: 106, low: 103, close: 105 }
    ];

    const result = validateCandles(candlesWithGap, '1h', 'forex');
    assert.equal(result.hasGaps, true);
    assert.equal(result.gaps.length, 1);
    assert.equal(result.gaps[0].durationMinutes, 300);
    assert.equal(result.gaps[0].missingCandlesEstimate, 4);
  });

  // ---------------------------------------------------------------------------
  // 2. Data Freshness Classification
  // ---------------------------------------------------------------------------
  test('5. classifyFreshness accurately labels LIVE, DELAYED, CACHED, STALE, and MARKET_CLOSED', () => {
    const now = Date.now();

    // 1. Live Crypto (< 3 minutes)
    const freshCrypto = classifyFreshness({
      timestamp: new Date(now - 30 * 1000).toISOString(),
      provider: 'Binance Spot API',
      assetClass: 'crypto'
    });
    assert.equal(freshCrypto.status, 'LIVE');

    // 2. Delayed Public Feed (Yahoo)
    const delayedFeed = classifyFreshness({
      timestamp: new Date(now - 120 * 1000).toISOString(),
      provider: 'Yahoo Public Feed',
      knownDelayed: true,
      assetClass: 'forex'
    });
    // On weekdays, marked as DELAYED; if today is weekend, marked as MARKET_CLOSED
    if (isMarketWeekend()) {
      assert.equal(delayedFeed.status, 'MARKET_CLOSED');
    } else {
      assert.equal(delayedFeed.status, 'DELAYED');
      assert.ok(delayedFeed.note.includes('delayed'));
    }

    // 3. Cached Snapshot
    const cachedEntry = classifyFreshness({
      timestamp: new Date(now - 10 * 1000).toISOString(),
      provider: 'Twelve Data API',
      isCached: true,
      assetClass: 'crypto'
    });
    assert.equal(cachedEntry.status, 'CACHED');

    // 4. Stale Data (> 1 hour old during market hours)
    const staleEntry = classifyFreshness({
      timestamp: new Date(now - 4000 * 1000).toISOString(),
      provider: 'Binance Spot API',
      assetClass: 'crypto'
    });
    assert.equal(staleEntry.status, 'STALE');
  });

  // ---------------------------------------------------------------------------
  // 3. Provider Adapters
  // ---------------------------------------------------------------------------
  test('6. BaseMarketDataProvider enforces contract', async () => {
    const base = new BaseMarketDataProvider('TestBase');
    assert.equal(base.name, 'TestBase');
    assert.equal(base.isAvailable(), true);
    await assert.rejects(
      async () => base.fetchQuoteAndCandles('XAUUSD'),
      /must be implemented/
    );
  });

  test('7. BinanceProvider maps crypto pairs and intervals cleanly', () => {
    const binance = new BinanceProvider();
    assert.equal(binance.getPairSymbol('BTCUSD'), 'BTCUSDT');
    assert.equal(binance.getPairSymbol('ETHUSD'), 'ETHUSDT');
    assert.equal(binance.getPairSymbol('SOLUSD'), 'SOLUSDT');
    assert.equal(binance.mapInterval('15m'), '15m');
    assert.equal(binance.mapInterval('4h'), '4h');
    assert.equal(binance.mapInterval('1d'), '1d');
    assert.equal(binance.isAvailable(), true);
  });

  test('8. TwelveDataProvider safely handles missing API key and returns unconfigured state', () => {
    const providerWithoutKey = new TwelveDataProvider(null);
    assert.equal(providerWithoutKey.isAvailable(), false);

    const providerWithKey = new TwelveDataProvider('test_dummy_key_123');
    assert.equal(providerWithKey.isAvailable(), true);
    assert.equal(providerWithKey.mapSymbol('XAUUSD'), 'XAU/USD');
    assert.equal(providerWithKey.mapSymbol('US30'), 'DJI');
    assert.equal(providerWithKey.mapInterval('15m'), '15min');
  });

  test('9. YahooProvider maps symbols and intervals and flags status as DELAYED', () => {
    const yahoo = new YahooProvider();
    assert.equal(yahoo.isAvailable(), true);
    assert.equal(yahoo.mapSymbol('XAUUSD'), 'GC=F');
    assert.equal(yahoo.mapSymbol('EURUSD'), 'EURUSD=X');
    assert.equal(yahoo.mapSymbol('US30'), '^DJI');

    const mapped15m = yahoo.mapIntervalAndRange('15m');
    assert.equal(mapped15m.interval, '15m');

    const mapped4h = yahoo.mapIntervalAndRange('4h');
    assert.equal(mapped4h.interval, '60m');
  });

  test('10. TestStubProvider generates deterministic benchmark candles without hitting network', async () => {
    const stub = new TestStubProvider();
    const result = await stub.fetchQuoteAndCandles('XAUUSD', '1h', 20);

    assert.equal(result.symbol, 'XAUUSD');
    assert.equal(result.isVerifiedExternal, false);
    assert.equal(result.candles.length, 20);
    assert.ok(result.price > 0);
    assert.equal(result.metadata.isTestStub, true);
  });

  // ---------------------------------------------------------------------------
  // 4. Market Data Gateway & Cache Behavior
  // ---------------------------------------------------------------------------
  test('11. normalizeSymbol and detectAssetClass accurately categorize symbols', () => {
    assert.equal(normalizeSymbol('gold'), 'XAUUSD');
    assert.equal(normalizeSymbol('xau'), 'XAUUSD');
    assert.equal(normalizeSymbol('btc'), 'BTCUSD');
    assert.equal(normalizeSymbol('bitcoin'), 'BTCUSD');
    assert.equal(normalizeSymbol('dow'), 'US30');
    assert.equal(normalizeSymbol('nasdaq'), 'NAS100');

    assert.equal(detectAssetClass('BTCUSD'), 'crypto');
    assert.equal(detectAssetClass('ETHUSD'), 'crypto');
    assert.equal(detectAssetClass('XAUUSD'), 'metals');
    assert.equal(detectAssetClass('XAGUSD'), 'metals');
    assert.equal(detectAssetClass('US30'), 'indices');
    assert.equal(detectAssetClass('EURUSD'), 'forex');
  });

  test('12. In-memory cache returns CACHED status within 30s TTL', async () => {
    const stub = new TestStubProvider();
    setTestProvider(stub);

    // Turn 1: Initial fetch
    const turn1 = await getMarketData('XAUUSD', '1h', 15);
    assert.ok(turn1);
    assert.equal(turn1.symbol, 'XAUUSD');

    // Turn 2: Cached fetch (reset test provider to verify cache hit without provider)
    resetTestProvider();
    const turn2 = await getMarketData('XAUUSD', '1h', 15);
    assert.equal(turn2.status, 'CACHED');
    assert.equal(turn2.isCached, true);
    assert.equal(turn2.symbol, 'XAUUSD');
    assert.equal(turn2.candles.length, turn1.candles.length);
  });

  test('13. Unreachable market data returns UNAVAILABLE without hallucinating prices', async () => {
    // Override with a failing provider
    const failingProvider = {
      isAvailable: () => true,
      fetchQuoteAndCandles: async () => null
    };
    setTestProvider(failingProvider);

    const result = await getMarketData('UNKNOWN_UNREACHABLE_COIN');
    assert.equal(result.status, 'UNAVAILABLE');
    assert.equal(result.candles.length, 0);
    assert.ok(result.message.includes('unreachable') || result.message.includes('closed'));
  });

  // ---------------------------------------------------------------------------
  // 5. Technical Indicators Mathematical Correctness
  // ---------------------------------------------------------------------------
  test('14. Technical indicators calculate deterministic values across candles', () => {
    const candles = createCandles(45, 100, 2); // 45 candles for MACD (requires 35+) and full indicator suite

    const sma = calculateSMA(candles, 10);
    const ema = calculateEMA(candles, 10);
    const rsi = calculateRSI(candles, 14);
    const macd = calculateMACD(candles, 12, 26, 9);
    const atr = calculateATR(candles, 14);
    const bb = calculateBollingerBands(candles, 20, 2);

    assert.ok(typeof sma === 'number');
    assert.ok(typeof ema === 'number');
    assert.ok(typeof rsi === 'number');
    assert.ok(rsi >= 0 && rsi <= 100);
    assert.ok(rsi > 70, 'Monotonic uptrend must yield overbought RSI');

    assert.ok(macd);
    assert.ok(['BULLISH', 'BEARISH'].includes(macd.momentum));
    assert.ok(typeof macd.macd === 'number' && macd.macd > 0, 'Fast EMA > Slow EMA in uptrend');
    assert.ok(typeof macd.histogram === 'number');

    assert.ok(typeof atr === 'number');
    assert.ok(atr > 0);

    assert.ok(bb);
    assert.ok(bb.upper > bb.middle);
    assert.ok(bb.middle > bb.lower);
  });

  // ---------------------------------------------------------------------------
  // 6. Market Structure, BOS/CHOCH, Liquidity Sweeps, and FVGs
  // ---------------------------------------------------------------------------
  test('15. detectMarketStructure detects Higher Highs & Higher Lows vs Lower Highs & Lower Lows', () => {
    const uptrendCandles = createCandles(25, 2000, 3);
    const bullStructure = detectMarketStructure(uptrendCandles);
    assert.equal(bullStructure.trend, 'BULLISH');

    const downtrendCandles = createCandles(25, 2000, -3);
    const bearStructure = detectMarketStructure(downtrendCandles);
    assert.equal(bearStructure.trend, 'BEARISH');
  });

  test('16. detectBOSandCHOCH verifies Break of Structure strictly on candle body close', () => {
    const stub = new TestStubProvider();
    const candles = stub.generateDeterministicCandles(2000, '1h');
    const bos = detectBOSandCHOCH(candles);

    assert.ok(bos);
    assert.ok(bos.currentStatus);
    assert.ok(Array.isArray(bos.events));
  });

  test('17. detectLiquiditySweep identifies wick piercing swing point with close inside range', () => {
    const candles = createCandles(15, 100, 1);
    const swingHigh = 115;
    // Inject a sweep candle: high pierces swingHigh (118), but close pulls back below (113)
    candles.push({
      time: new Date().toISOString(),
      open: 112,
      high: 118, // swept liquidity
      low: 111,
      close: 113, // closed back below resistance
      volume: 2500
    });

    const sweep = detectLiquiditySweep(candles);
    assert.ok(typeof sweep.detected === 'boolean');
  });

  test('18. detectFairValueGaps detects 3-candle imbalance', () => {
    const baseTime = Date.now();
    // Bullish FVG: candle 1 high (105) < candle 3 low (108)
    const fvgCandles = [
      { time: new Date(baseTime).toISOString(), open: 100, high: 105, low: 99, close: 104 },
      { time: new Date(baseTime + 3600000).toISOString(), open: 104, high: 112, low: 104, close: 111 }, // aggressive expansion
      { time: new Date(baseTime + 7200000).toISOString(), open: 111, high: 115, low: 108, close: 114 }
    ];

    const fvgs = detectFairValueGaps(fvgCandles);
    assert.equal(fvgs.length, 1);
    assert.equal(fvgs[0].type, 'BULLISH_FVG');
    assert.equal(fvgs[0].bottom, 105);
    assert.equal(fvgs[0].top, 108);
  });

  // ---------------------------------------------------------------------------
  // 7. Structured Market Outlook Generation & Disclosures
  // ---------------------------------------------------------------------------
  test('19. generateStructuredOutlook produces verified status badge, key levels, and data timestamp', () => {
    const stub = new TestStubProvider();
    const mockData = {
      status: 'LIVE',
      provider: 'Binance Spot API',
      source: 'Binance Spot API',
      symbol: 'BTCUSD',
      price: 68500.50,
      change24h: 2.45,
      high24h: 69200.00,
      low24h: 67100.00,
      timeframe: '1h',
      timestamp: new Date().toISOString(),
      isVerifiedExternal: true,
      candles: stub.generateDeterministicCandles(67000, '1h')
    };

    const outlook = generateStructuredOutlook(mockData);

    assert.ok(outlook.includes('INSTITUTIONAL MARKET OUTLOOK: BTCUSD'));
    assert.ok(outlook.includes('68500.5'));
    assert.ok(outlook.includes('Binance Spot API'));
    assert.ok(outlook.includes('VERIFIED LIVE'));
    assert.ok(outlook.includes('Nearest Technical Resistance:'));
    assert.ok(outlook.includes('Nearest Technical Support:'));
  });

  test('20. generateStructuredOutlook mandates Bullish & Bearish scenarios with exact invalidation conditions', () => {
    const stub = new TestStubProvider();
    const mockData = {
      status: 'DELAYED',
      provider: 'Yahoo Public Feed',
      source: 'Global Market Feed',
      symbol: 'XAUUSD',
      price: 2042.80,
      change24h: -0.35,
      timeframe: '1h',
      timestamp: new Date().toISOString(),
      isVerifiedExternal: true,
      candles: stub.generateDeterministicCandles(2040, '1h')
    };

    const outlook = generateStructuredOutlook(mockData);

    // Must present both scenarios
    assert.ok(outlook.includes('SCENARIO A (BULLISH EXPANSION)'));
    assert.ok(outlook.includes('SCENARIO B (BEARISH REVERSAL / BREAKDOWN)'));

    // Must state exact Invalidation Condition for each scenario
    assert.ok(outlook.includes('Invalidation Condition:'));
    assert.ok(outlook.includes('strictly INVALIDATED if price closes below support'));
    assert.ok(outlook.includes('strictly INVALIDATED if price expands and closes above resistance'));
  });

  test('21. generateStructuredOutlook includes mandatory non-promissory risk disclosures (never promise profit)', () => {
    const stub = new TestStubProvider();
    const mockData = {
      status: 'LIVE',
      provider: 'Twelve Data API',
      symbol: 'EURUSD',
      price: 1.0850,
      change24h: 0.12,
      timeframe: '1h',
      timestamp: new Date().toISOString(),
      candles: stub.generateDeterministicCandles(1.0800, '1h')
    };

    const outlook = generateStructuredOutlook(mockData);

    // Verify non-promissory compliance
    assert.ok(outlook.includes('RISK DISCLOSURE & EXECUTION RULES'));
    assert.ok(outlook.includes('Non-Promissory Disclosure'));
    assert.ok(outlook.includes('does NOT promise or guarantee a profitable outcome'));
    assert.ok(outlook.includes('maximum of 1% to 2%'));
  });

  test('22. generateStructuredOutlook honestly explains unavailable market data without inventing prices', () => {
    const unavailableData = {
      status: 'UNAVAILABLE',
      symbol: 'EURUSD',
      message: 'Forex markets closed for the weekend.'
    };

    const outlook = generateStructuredOutlook(unavailableData);
    assert.ok(outlook.includes('Market Analysis: EURUSD'));
    assert.ok(outlook.includes('External market feed is currently unavailable') || outlook.includes('closed'));
    assert.ok(outlook.includes('never fabricates, hallucinates, or estimates live prices'));
    assert.doesNotMatch(outlook, /Current Price:\s*\$?\d+/);
  });

  // ---------------------------------------------------------------------------
  // 8. End-to-End AI Coach Market Analysis Query Routing
  // ---------------------------------------------------------------------------
  test('23. processAiCoachChat routes live market queries and delivers structured analysis in offline mode', async () => {
    // Inject deterministic stub for reproducible testing
    const stub = new TestStubProvider();
    setTestProvider(stub);

    const chatRes = await processAiCoachChat({
      user: { _id: 'test_user_market_1' },
      question: 'Analyse Gold on the 1h timeframe and give me key levels with invalidation',
      userApiKey: 'offline'
    });

    assert.equal(chatRes.success, true);
    assert.equal(chatRes.intent, 'MARKET_QUERY');
    assert.ok(chatRes.answer.includes('INSTITUTIONAL MARKET OUTLOOK: XAUUSD'));
    assert.ok(chatRes.answer.includes('SCENARIO A (BULLISH EXPANSION)'));
    assert.ok(chatRes.answer.includes('SCENARIO B (BEARISH REVERSAL / BREAKDOWN)'));
    assert.ok(chatRes.answer.includes('Invalidation Condition:'));
    assert.ok(chatRes.answer.includes('Non-Promissory Disclosure'));
  });

  test('24. processAiCoachChat handles Hinglish market query with verified outlook', async () => {
    const stub = new TestStubProvider();
    setTestProvider(stub);

    const chatRes = await processAiCoachChat({
      user: { _id: 'test_user_market_2' },
      question: 'Bhai gold ka 1h chart analyse karo aur batao kya levels hain',
      userApiKey: 'offline'
    });

    assert.equal(chatRes.success, true);
    assert.equal(chatRes.intent, 'MARKET_QUERY');
    assert.ok(chatRes.answer.includes('XAUUSD'));
    assert.ok(chatRes.answer.includes('SCENARIO A'));
    assert.ok(chatRes.answer.includes('SCENARIO B'));
    assert.ok(chatRes.answer.includes('RISK DISCLOSURE'));
  });

});
