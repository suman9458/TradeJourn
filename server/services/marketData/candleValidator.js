/**
 * TradeJourn Candlestick Validator & Freshness Classification Engine
 * ===================================================================
 * Deterministic validation for external market data feeds.
 * Validates OHLC integrity, strictly ascending timestamps, missing candle gaps,
 * and classifies data status (LIVE, DELAYED, CACHED, STALE, MARKET_CLOSED).
 */

const TIMEFRAME_MS_MAP = {
  '1m': 1 * 60 * 1000,
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '30m': 30 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '60m': 60 * 60 * 1000,
  '4h': 4 * 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
  'D': 24 * 60 * 60 * 1000
};

/**
 * Validate an individual candle's geometric and mathematical integrity
 */
function validateSingleCandle(c, index = 0) {
  const errors = [];
  if (!c || typeof c !== 'object') {
    return { valid: false, errors: [`Candle at index ${index} is not an object`] };
  }

  const { open, high, low, close, time, volume } = c;

  if (typeof open !== 'number' || !Number.isFinite(open) || open <= 0) {
    errors.push(`Candle [${index}]: Invalid open price (${open})`);
  }
  if (typeof high !== 'number' || !Number.isFinite(high) || high <= 0) {
    errors.push(`Candle [${index}]: Invalid high price (${high})`);
  }
  if (typeof low !== 'number' || !Number.isFinite(low) || low <= 0) {
    errors.push(`Candle [${index}]: Invalid low price (${low})`);
  }
  if (typeof close !== 'number' || !Number.isFinite(close) || close <= 0) {
    errors.push(`Candle [${index}]: Invalid close price (${close})`);
  }

  // Geometric OHLC consistency checks
  if (high < low) {
    errors.push(`Candle [${index}]: High (${high}) is less than Low (${low})`);
  }
  if (high < open) {
    errors.push(`Candle [${index}]: High (${high}) is less than Open (${open})`);
  }
  if (high < close) {
    errors.push(`Candle [${index}]: High (${high}) is less than Close (${close})`);
  }
  if (low > open) {
    errors.push(`Candle [${index}]: Low (${low}) is greater than Open (${open})`);
  }
  if (low > close) {
    errors.push(`Candle [${index}]: Low (${low}) is greater than Close (${close})`);
  }

  // Timestamp check
  if (!time) {
    errors.push(`Candle [${index}]: Missing timestamp`);
  } else {
    const parsedTime = new Date(time).getTime();
    if (Number.isNaN(parsedTime)) {
      errors.push(`Candle [${index}]: Unparseable timestamp (${time})`);
    }
  }

  // Volume (optional, but if present must be >= 0)
  if (volume !== undefined && volume !== null && (typeof volume !== 'number' || !Number.isFinite(volume) || volume < 0)) {
    errors.push(`Candle [${index}]: Invalid volume (${volume})`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Check if a timestamp occurs during weekend forex/metals market closure
 * Standard closure: Friday 21:00 UTC to Sunday 21:00 UTC
 */
function isMarketWeekend(dateInput = new Date()) {
  const d = new Date(dateInput);
  const day = d.getUTCDay(); // 0 is Sunday, 6 is Saturday
  const hour = d.getUTCHours();

  // Saturday: full day closed
  if (day === 6) return true;
  // Friday after 21:00 UTC
  if (day === 5 && hour >= 21) return true;
  // Sunday before 21:00 UTC
  if (day === 0 && hour < 21) return true;

  return false;
}

/**
 * Validate array of candles, sort chronologically, eliminate duplicates, and detect gaps
 */
function validateCandles(rawCandles, timeframe = '1h', assetClass = 'forex') {
  if (!Array.isArray(rawCandles) || rawCandles.length === 0) {
    return {
      valid: false,
      totalCount: 0,
      validCount: 0,
      cleanCandles: [],
      errors: ['Candle array is empty or not an array'],
      hasGaps: false,
      gaps: []
    };
  }

  const allErrors = [];
  const cleanCandles = [];

  for (let i = 0; i < rawCandles.length; i++) {
    const single = validateSingleCandle(rawCandles[i], i);
    if (single.valid) {
      cleanCandles.push({
        time: new Date(rawCandles[i].time).toISOString(),
        open: Number(rawCandles[i].open),
        high: Number(rawCandles[i].high),
        low: Number(rawCandles[i].low),
        close: Number(rawCandles[i].close),
        volume: Number(rawCandles[i].volume || 0)
      });
    } else {
      allErrors.push(...single.errors);
    }
  }

  if (cleanCandles.length === 0) {
    return {
      valid: false,
      totalCount: rawCandles.length,
      validCount: 0,
      cleanCandles: [],
      errors: allErrors,
      hasGaps: false,
      gaps: []
    };
  }

  // Sort strictly ascending by time
  cleanCandles.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  // Deduplicate identical timestamps (keep latest occurrence)
  const deduped = [];
  for (let i = 0; i < cleanCandles.length; i++) {
    if (i === 0 || cleanCandles[i].time !== cleanCandles[i - 1].time) {
      deduped.push(cleanCandles[i]);
    }
  }

  // Gap detection
  const expectedMs = TIMEFRAME_MS_MAP[timeframe] || (60 * 60 * 1000);
  const gaps = [];

  for (let i = 1; i < deduped.length; i++) {
    const prevTime = new Date(deduped[i - 1].time).getTime();
    const currTime = new Date(deduped[i].time).getTime();
    const diffMs = currTime - prevTime;

    // A gap exists if interval is greater than 2.5x the expected interval
    if (diffMs > expectedMs * 2.5) {
      const isWeekendGap = (assetClass !== 'crypto') && (isMarketWeekend(prevTime) || isMarketWeekend(currTime));
      if (!isWeekendGap) {
        gaps.push({
          from: deduped[i - 1].time,
          to: deduped[i].time,
          durationMinutes: Math.round(diffMs / 60000),
          missingCandlesEstimate: Math.max(1, Math.round(diffMs / expectedMs) - 1)
        });
      }
    }
  }

  return {
    valid: deduped.length >= 5 && allErrors.length === 0,
    totalCount: rawCandles.length,
    validCount: deduped.length,
    cleanCandles: deduped,
    errors: allErrors,
    hasGaps: gaps.length > 0,
    gaps
  };
}

/**
 * Classify Freshness Status of market data
 */
function classifyFreshness({
  timestamp,
  provider,
  isCached = false,
  assetClass = 'forex',
  knownDelayed = false
}) {
  const now = Date.now();
  const dataTime = timestamp ? new Date(timestamp).getTime() : 0;
  const ageSeconds = dataTime > 0 ? Math.max(0, Math.floor((now - dataTime) / 1000)) : 999999;
  const isWeekend = isMarketWeekend(now);

  // If market is closed for weekend on non-crypto assets
  if (assetClass !== 'crypto' && isWeekend) {
    return {
      status: 'MARKET_CLOSED',
      ageSeconds,
      isWeekend: true,
      label: 'Market Closed (Weekend)',
      note: 'Forex, Metals, and Indices markets are closed. Quotes reflect the Friday closing price.'
    };
  }

  // If served from cache
  if (isCached) {
    return {
      status: 'CACHED',
      ageSeconds,
      isWeekend: false,
      label: 'Cached Snapshot',
      note: `Served from local cache (${ageSeconds}s ago).`
    };
  }

  // If provider is known delayed (like free Yahoo Finance endpoint)
  if (knownDelayed || provider === 'Yahoo Finance' || provider === 'Global Market Feed') {
    return {
      status: 'DELAYED',
      ageSeconds,
      isWeekend: false,
      label: 'Delayed Feed (~15m)',
      note: 'Public market feed is delayed by approximately 15 minutes. For institutional real-time quotes, configure TWELVE_DATA_API_KEY.'
    };
  }

  // For Crypto or Authorized Live Providers
  if (ageSeconds <= 180) {
    return {
      status: 'LIVE',
      ageSeconds,
      isWeekend: false,
      label: 'Live Direct',
      note: 'Real-time verified exchange market feed.'
    };
  }

  if (ageSeconds <= 900) {
    return {
      status: 'RECENT',
      ageSeconds,
      isWeekend: false,
      label: 'Recent Snapshot',
      note: `Data retrieved ${Math.round(ageSeconds / 60)} minutes ago.`
    };
  }

  return {
    status: 'STALE',
    ageSeconds,
    isWeekend: false,
    label: 'Stale Data Feed',
    note: `Data is older than standard threshold (${Math.round(ageSeconds / 60)}m ago). Verify quotes prior to live execution.`
  };
}

module.exports = {
  TIMEFRAME_MS_MAP,
  validateSingleCandle,
  validateCandles,
  isMarketWeekend,
  classifyFreshness
};
