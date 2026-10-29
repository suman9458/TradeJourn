/**
 * TradeJourn Normalized Market Data Service
 * ==========================================
 * Modular Market Data Architecture with Verified External Adapters:
 * - BinanceProvider (Live 24/7 Crypto REST Feed)
 * - TwelveDataProvider (Verified Institutional Multi-Asset Feed when key configured)
 * - YahooProvider (Public Delayed Feed Fallback - transparently flagged as DELAYED)
 * - TestStubProvider (Dedicated Isolated Test Interface for deterministic testing)
 *
 * Rules:
 * 1. Clearly distinguish LIVE vs DELAYED vs CACHED vs UNAVAILABLE.
 * 2. Validate candle integrity (high >= low, positive prices, ascending timestamps, gap detection).
 * 3. Never fabricate or hallucinate live market prices.
 * 4. Never promise or guarantee profitable trading outcomes.
 */

const { MARKET_SYMBOLS_MAP } = require('../ai/intentClassifier');
const BinanceProvider = require('./providers/binanceProvider');
const TwelveDataProvider = require('./providers/twelveDataProvider');
const YahooProvider = require('./providers/yahooProvider');
const TestStubProvider = require('./providers/testStubProvider');
const { validateCandles, classifyFreshness, isMarketWeekend } = require('./candleValidator');

const CACHE_TTL_MS = 30000; // 30-second cache TTL to respect external rate limits
const marketCache = new Map();

// Active provider instances
const binanceProvider = new BinanceProvider();
const twelveDataProvider = new TwelveDataProvider();
const yahooProvider = new YahooProvider();

// Test harness provider override (strictly for testing; null in production)
let activeTestProvider = null;

function setTestProvider(provider) {
  activeTestProvider = provider;
}

function resetTestProvider() {
  activeTestProvider = null;
}

function clearMarketCache() {
  marketCache.clear();
}

/**
 * Cache getters and setters with TTL validation
 */
function getCached(key) {
  const entry = marketCache.get(key);
  if (!entry) return null;
  const age = Date.now() - entry.cachedAt;
  if (age > CACHE_TTL_MS) {
    marketCache.delete(key);
    return null;
  }
  // Return cached snapshot with status marked as CACHED
  return {
    ...entry.data,
    status: 'CACHED',
    isCached: true,
    cachedAt: new Date(entry.cachedAt).toISOString(),
    cacheAgeSeconds: Math.floor(age / 1000)
  };
}

function setCached(key, data) {
  marketCache.set(key, { data, cachedAt: Date.now() });
}

/**
 * Determine active global trading session based on UTC time
 */
function getCurrentMarketSession() {
  const now = new Date();
  const utcHour = now.getUTCHours();
  const isWeekend = isMarketWeekend(now);

  if (isWeekend) {
    return 'Weekend (Forex/Metals Markets Closed; Crypto Active 24/7)';
  }

  if (utcHour >= 12 && utcHour < 16) {
    return 'London & New York Overlap (Peak Liquidity & High Volatility)';
  }
  if (utcHour >= 7 && utcHour < 16) {
    return 'London Session (High Liquidity)';
  }
  if (utcHour >= 12 && utcHour < 21) {
    return 'New York Session (High Liquidity)';
  }
  if (utcHour >= 0 && utcHour < 9) {
    return 'Asian / Tokyo Session (Lower Volatility / Range Trading)';
  }
  return 'Sydney / Off-Peak Transition';
}

/**
 * Identify asset class
 */
function detectAssetClass(symbol) {
  const upper = (symbol || '').toUpperCase();
  if (['BTCUSD', 'ETHUSD', 'SOLUSD', 'XRPUSD', 'ADAUSD'].includes(upper)) {
    return 'crypto';
  }
  if (['XAUUSD', 'XAGUSD'].includes(upper)) {
    return 'metals';
  }
  if (['US30', 'NAS100', 'SPX500', 'NIFTY50'].includes(upper)) {
    return 'indices';
  }
  return 'forex';
}

/**
 * Standardize instrument string
 */
function normalizeSymbol(input) {
  if (!input) return 'XAUUSD';
  const clean = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return MARKET_SYMBOLS_MAP[clean.toLowerCase()] || clean;
}

/**
 * Master Market Data Gateway
 * Retrieves fresh quote and OHLC candles from authorized providers
 */
async function getMarketData(rawSymbol, timeframe = '1h', limit = 30) {
  const symbol = normalizeSymbol(rawSymbol);
  const assetClass = detectAssetClass(symbol);
  const cacheKey = `${symbol}_${timeframe}_${limit}`;

  // 1. Check in-memory TTL cache
  const cached = getCached(cacheKey);
  if (cached && !activeTestProvider) {
    return cached;
  }

  let result = null;

  // 2. If test stub provider is injected by test harness, use it
  if (activeTestProvider) {
    result = await activeTestProvider.fetchQuoteAndCandles(symbol, timeframe, limit);
  }
  // 3. For Crypto: Binance public REST API is the primary live exchange feed
  else if (assetClass === 'crypto') {
    result = await binanceProvider.fetchQuoteAndCandles(symbol, timeframe, limit);
  }
  // 4. For Forex, Metals, Indices:
  //    Try Twelve Data if configured, otherwise fallback to Yahoo public delayed feed
  else {
    if (twelveDataProvider.isAvailable()) {
      result = await twelveDataProvider.fetchQuoteAndCandles(symbol, timeframe, limit);
    }

    if (!result || !result.candles || result.candles.length === 0) {
      result = await yahooProvider.fetchQuoteAndCandles(symbol, timeframe, limit);
    }
  }

  // 5. Candle Validation & Freshness Classification
  if (result && Array.isArray(result.candles) && result.candles.length > 0) {
    const candleValidation = validateCandles(result.candles, timeframe, assetClass);

    if (candleValidation.cleanCandles.length > 0) {
      const freshness = classifyFreshness({
        timestamp: result.timestamp,
        provider: result.provider,
        isCached: false,
        assetClass,
        knownDelayed: result.status === 'DELAYED'
      });

      const validatedResult = {
        ...result,
        status: freshness.status,
        session: getCurrentMarketSession(),
        retrievedAt: new Date().toISOString(),
        candles: candleValidation.cleanCandles,
        candleIntegrity: {
          valid: candleValidation.valid,
          totalReceived: candleValidation.totalCount,
          validCount: candleValidation.validCount,
          hasGaps: candleValidation.hasGaps,
          gaps: candleValidation.gaps,
          errors: candleValidation.errors
        },
        freshness
      };

      setCached(cacheKey, validatedResult);
      return validatedResult;
    }
  }

  // 6. Transparent Fallback: Data unavailable (Never fabricate live prices!)
  const isWeekend = isMarketWeekend();
  const session = getCurrentMarketSession();

  let message = `Live external market data feed for ${symbol} is currently unreachable. Technical analysis can be structured using playbook templates or verified journal history.`;
  if (isWeekend && assetClass !== 'crypto') {
    message = `Forex & Commodity markets are closed for the weekend (Friday 21:00 UTC - Sunday 21:00 UTC). Live quote feed for ${symbol} will resume upon market open.`;
  }

  return {
    status: 'UNAVAILABLE',
    symbol,
    timeframe,
    session,
    timestamp: new Date().toISOString(),
    isVerifiedExternal: false,
    message,
    candles: []
  };
}

/**
 * Multi-Timeframe Market Data Aggregator
 */
async function getMultiTimeframeMarketData(rawSymbol, timeframes = ['15m', '1h', '4h']) {
  const symbol = normalizeSymbol(rawSymbol);
  const results = {};
  for (const tf of timeframes) {
    results[tf] = await getMarketData(symbol, tf, 30);
  }
  return {
    symbol,
    session: getCurrentMarketSession(),
    timeframes: results
  };
}

module.exports = {
  normalizeSymbol,
  getCurrentMarketSession,
  detectAssetClass,
  getMarketData,
  getMultiTimeframeMarketData,
  setTestProvider,
  resetTestProvider,
  clearMarketCache,
  BinanceProvider,
  TwelveDataProvider,
  YahooProvider,
  TestStubProvider,
  validateCandles,
  classifyFreshness,
  isMarketWeekend
};
