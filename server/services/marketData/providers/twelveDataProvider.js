/**
 * Twelve Data Market Data Provider
 * =================================
 * Verified institutional real-time API for Forex, Metals, Commodities, and Indices.
 * Requires TWELVE_DATA_API_KEY environment variable.
 */

const BaseMarketDataProvider = require('./baseProvider');

const TIMEOUT_MS = 6000;

class TwelveDataProvider extends BaseMarketDataProvider {
  constructor(apiKey = process.env.TWELVE_DATA_API_KEY) {
    super('Twelve Data API');
    this.apiKey = apiKey?.trim() || null;
  }

  isAvailable() {
    return Boolean(this.apiKey);
  }

  mapSymbol(symbol) {
    const map = {
      XAUUSD: 'XAU/USD',
      XAGUSD: 'XAG/USD',
      EURUSD: 'EUR/USD',
      GBPUSD: 'GBP/USD',
      USDJPY: 'USD/JPY',
      USDCAD: 'USD/CAD',
      AUDUSD: 'AUD/USD',
      NZDUSD: 'NZD/USD',
      USDCHF: 'USD/CHF',
      EURJPY: 'EUR/JPY',
      GBPJPY: 'GBP/JPY',
      US30: 'DJI',
      NAS100: 'IXIC',
      SPX500: 'SPX'
    };
    return map[symbol] || symbol;
  }

  mapInterval(timeframe) {
    const map = {
      '1m': '1min',
      '5m': '5min',
      '15m': '15min',
      '30m': '30min',
      '1h': '1h',
      '60m': '1h',
      '4h': '4h',
      '1d': '1day',
      'D': '1day'
    };
    return map[timeframe] || '1h';
  }

  async fetchQuoteAndCandles(symbol, timeframe = '1h', limit = 30) {
    if (!this.isAvailable()) {
      return null;
    }

    const tSymbol = this.mapSymbol(symbol);
    const interval = this.mapInterval(timeframe);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(tSymbol)}&interval=${interval}&outputsize=${limit}&apikey=${this.apiKey}`;
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) return null;

      const data = await response.json();
      if (data.status !== 'ok' || !Array.isArray(data.values) || data.values.length === 0) {
        return null;
      }

      // Twelve data returns newest first, so reverse to chronological order
      const rawValues = [...data.values].reverse();
      const candles = rawValues.map(v => ({
        time: new Date(v.datetime).toISOString(),
        open: parseFloat(v.open),
        high: parseFloat(v.high),
        low: parseFloat(v.low),
        close: parseFloat(v.close),
        volume: parseFloat(v.volume || 0)
      }));

      const latest = candles[candles.length - 1];
      const first = candles[0];
      const change24h = first ? Number((((latest.close - first.open) / first.open) * 100).toFixed(2)) : 0;
      const highs = candles.map(c => c.high);
      const lows = candles.map(c => c.low);

      return this.formatResponse({
        status: 'LIVE',
        source: 'Twelve Data Institutional Feed',
        symbol,
        price: latest.close,
        bid: latest.close,
        ask: latest.close,
        change24h,
        high24h: Math.max(...highs),
        low24h: Math.min(...lows),
        timeframe,
        timestamp: latest.time,
        candles,
        isVerifiedExternal: true,
        metadata: {
          exchange: data.meta?.exchange || 'OTC',
          providerStatus: 'LIVE'
        }
      });
    } catch (err) {
      clearTimeout(timeoutId);
      return null;
    }
  }
}

module.exports = TwelveDataProvider;

