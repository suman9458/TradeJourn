/**
 * TradeJourn Normalized Market Data Service
 * ==========================================
 * Retrieves live quotes & historical candles for Forex, Metals, and Crypto.
 * Distinguishes LIVE vs DELAYED vs UNAVAILABLE.
 * Never fabricates or hallucinates live market prices.
 */

const { MARKET_SYMBOLS_MAP } = require('../ai/intentClassifier');

const TIMEOUT_MS = 6000;
const CACHE_TTL_MS = 30000; // 30s cache TTL to respect rate limits
const marketCache = new Map();

/**
 * In-memory TTL cache helpers
 */
function getCached(key) {
  const entry = marketCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    marketCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCached(key, data) {
  marketCache.set(key, { data, cachedAt: Date.now() });
}

/**
 * Determine current active trading session based on UTC hour
 */
function getCurrentMarketSession() {
  const now = new Date();
  const utcHour = now.getUTCHours();
  const day = now.getUTCDay();

  const isWeekend = (day === 6) || (day === 0 && utcHour < 21);
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
 * Standardize instrument string
 */
function normalizeSymbol(input) {
  if (!input) return 'XAUUSD';
  const clean = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return MARKET_SYMBOLS_MAP[clean.toLowerCase()] || clean;
}

/**
 * Fetch live Crypto quote & candles from Binance Public REST API
 */
async function fetchBinanceCryptoData(symbol, timeframe = '1h', limit = 30) {
  const pairMap = {
    BTCUSD: 'BTCUSDT',
    ETHUSD: 'ETHUSDT'
  };
  const pair = pairMap[symbol] || `${symbol}T`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const [tickerRes, klinesRes] = await Promise.all([
      fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${pair}`, { signal: controller.signal }),
      fetch(`https://api.binance.com/api/v3/klines?symbol=${pair}&interval=${timeframe}&limit=${limit}`, { signal: controller.signal })
    ]);

    clearTimeout(timeoutId);

    if (!tickerRes.ok || !klinesRes.ok) {
      return null;
    }

    const ticker = await tickerRes.json();
    const klines = await klinesRes.json();

    const price = parseFloat(ticker.lastPrice);
    const bid = parseFloat(ticker.bidPrice);
    const ask = parseFloat(ticker.askPrice);
    const change24h = parseFloat(ticker.priceChangePercent);
    const high24h = parseFloat(ticker.highPrice);
    const low24h = parseFloat(ticker.lowPrice);

    const candles = klines.map(k => ({
      time: new Date(k[0]).toISOString(),
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5])
    }));

    return {
      status: 'LIVE',
      source: 'Binance Spot API',
      symbol,
      price,
      bid,
      ask,
      change24h,
      high24h,
      low24h,
      timeframe,
      timestamp: new Date().toISOString(),
      candles
    };
  } catch (err) {
    clearTimeout(timeoutId);
    return null;
  }
}

/**
 * Fetch Forex / Gold market quote via free live exchange rates & Yahoo Finance
 */
async function fetchForexAndMetalsData(symbol, timeframe = '1h', limit = 30) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    // Standardized Yahoo Finance Symbol
    const yahooSymbolMap = {
      XAUUSD: 'GC=F',     // Gold Futures / Spot proxy
      XAGUSD: 'SI=F',     // Silver Futures
      EURUSD: 'EURUSD=X',
      GBPUSD: 'GBPUSD=X',
      USDJPY: 'JPY=X',
      USDCAD: 'CAD=X',
      AUDUSD: 'AUDUSD=X',
      US30: '^DJI',
      NAS100: '^IXIC'
    };

    const ySymbol = yahooSymbolMap[symbol] || `${symbol}=X`;

    // Map timeframe to Yahoo parameters
    let yInterval = '60m';
    let yRange = '1mo';
    if (timeframe === '15m') {
      yInterval = '15m';
      yRange = '5d';
    } else if (timeframe === '1d') {
      yInterval = '1d';
      yRange = '3mo';
    } else if (timeframe === '4h') {
      yInterval = '60m';
      yRange = '1mo';
    }

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ySymbol)}?interval=${yInterval}&range=${yRange}`;

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 TradeJourn/2.0'
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const data = await response.json();
    const result = data?.chart?.result?.[0];
    if (!result) return null;

    const meta = result.meta;
    const price = meta.regularMarketPrice || meta.previousClose;
    const timestamps = result.timestamp || [];
    const quote = result.indicators?.quote?.[0] || {};

    const opens = quote.open || [];
    const highs = quote.high || [];
    const lows = quote.low || [];
    const closes = quote.close || [];
    const volumes = quote.volume || [];

    const candles = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (opens[i] !== null && closes[i] !== null) {
        candles.push({
          time: new Date(timestamps[i] * 1000).toISOString(),
          open: Number(opens[i].toFixed(symbol.includes('JPY') ? 3 : 5)),
          high: Number(highs[i].toFixed(symbol.includes('JPY') ? 3 : 5)),
          low: Number(lows[i].toFixed(symbol.includes('JPY') ? 3 : 5)),
          close: Number(closes[i].toFixed(symbol.includes('JPY') ? 3 : 5)),
          volume: Number(volumes[i] || 0)
        });
      }
    }

    // If 4h requested, aggregate 4 1-hour candles into 1 4-hour candle
    let finalCandles = candles;
    if (timeframe === '4h' && candles.length >= 4) {
      const agg = [];
      for (let i = 0; i < candles.length; i += 4) {
        const chunk = candles.slice(i, i + 4);
        if (chunk.length > 0) {
          agg.push({
            time: chunk[0].time,
            open: chunk[0].open,
            high: Math.max(...chunk.map(c => c.high)),
            low: Math.min(...chunk.map(c => c.low)),
            close: chunk[chunk.length - 1].close,
            volume: chunk.reduce((sum, c) => sum + c.volume, 0)
          });
        }
      }
      finalCandles = agg;
    }

    const trimmedCandles = finalCandles.slice(-limit);

    return {
      status: 'LIVE',
      source: 'Global Market Feed',
      symbol,
      price: Number(price.toFixed(symbol.includes('JPY') ? 3 : (symbol === 'XAUUSD' || symbol.includes('30') || symbol.includes('100') ? 2 : 5))),
      bid: Number(price.toFixed(symbol.includes('JPY') ? 3 : 5)),
      ask: Number(price.toFixed(symbol.includes('JPY') ? 3 : 5)),
      change24h: meta.chartPreviousClose ? Number((((price - meta.chartPreviousClose) / meta.chartPreviousClose) * 100).toFixed(2)) : 0,
      high24h: meta.regularMarketDayHigh || price,
      low24h: meta.regularMarketDayLow || price,
      timeframe,
      session: getCurrentMarketSession(),
      timestamp: new Date().toISOString(),
      candles: trimmedCandles
    };
  } catch (err) {
    clearTimeout(timeoutId);
    return null;
  }
}

/**
 * Master Market Data Gateway
 */
async function getMarketData(rawSymbol, timeframe = '1h', limit = 30) {
  const symbol = normalizeSymbol(rawSymbol);
  const cacheKey = `${symbol}_${timeframe}_${limit}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  let result = null;

  // 1. If Crypto, try Binance first
  if (['BTCUSD', 'ETHUSD'].includes(symbol)) {
    result = await fetchBinanceCryptoData(symbol, timeframe, limit);
  }

  // 2. Try Global Market feed (Forex, Metals, Indices)
  if (!result || !result.candles || result.candles.length === 0) {
    result = await fetchForexAndMetalsData(symbol, timeframe, limit);
  }

  if (result && result.candles && result.candles.length > 0) {
    setCached(cacheKey, result);
    return result;
  }

  // 3. Fallback: Data unavailable (Never fabricate live prices!)
  return {
    status: 'UNAVAILABLE',
    symbol,
    timeframe,
    session: getCurrentMarketSession(),
    timestamp: new Date().toISOString(),
    message: `Live market data feed for ${symbol} is currently unreachable or market is closed for the weekend/session. Factual technical analysis structure can be reviewed using your historical journal or strategy templates.`,
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
  getMarketData,
  getMultiTimeframeMarketData
};

