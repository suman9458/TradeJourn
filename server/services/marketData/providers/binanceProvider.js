/**
 * Binance Spot Market Data Provider
 * ==================================
 * Direct public REST feed for Crypto assets (BTCUSD, ETHUSD, SOLUSD, etc.).
 * Status: Genuine LIVE exchange prices (24/7 liquidity).
 */

const BaseMarketDataProvider = require('./baseProvider');

const TIMEOUT_MS = 6000;

class BinanceProvider extends BaseMarketDataProvider {
  constructor() {
    super('Binance Spot API');
  }

  isAvailable() {
    return true; // Public free API, no key required
  }

  getPairSymbol(symbol) {
    const pairMap = {
      BTCUSD: 'BTCUSDT',
      ETHUSD: 'ETHUSDT',
      SOLUSD: 'SOLUSDT',
      XRPUSD: 'XRPUSDT',
      ADAUSD: 'ADAUSDT'
    };
    return pairMap[symbol] || (symbol.endsWith('USD') ? `${symbol}T` : `${symbol}USDT`);
  }

  mapInterval(timeframe) {
    const tfMap = {
      '1m': '1m',
      '5m': '5m',
      '15m': '15m',
      '30m': '30m',
      '1h': '1h',
      '60m': '1h',
      '4h': '4h',
      '1d': '1d',
      'D': '1d'
    };
    return tfMap[timeframe] || '1h';
  }

  async fetchQuoteAndCandles(symbol, timeframe = '1h', limit = 30) {
    const pair = this.getPairSymbol(symbol);
    const interval = this.mapInterval(timeframe);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const [tickerRes, klinesRes] = await Promise.all([
        fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${pair}`, { signal: controller.signal }),
        fetch(`https://api.binance.com/api/v3/klines?symbol=${pair}&interval=${interval}&limit=${limit}`, { signal: controller.signal })
      ]);

      clearTimeout(timeoutId);

      if (!tickerRes.ok || !klinesRes.ok) {
        return null;
      }

      const ticker = await tickerRes.json();
      const klines = await klinesRes.json();

      if (!Array.isArray(klines) || klines.length === 0) {
        return null;
      }

      const price = parseFloat(ticker.lastPrice);
      const bid = parseFloat(ticker.bidPrice || ticker.lastPrice);
      const ask = parseFloat(ticker.askPrice || ticker.lastPrice);
      const change24h = parseFloat(ticker.priceChangePercent || 0);
      const high24h = parseFloat(ticker.highPrice || price);
      const low24h = parseFloat(ticker.lowPrice || price);

      const candles = klines.map(k => ({
        time: new Date(k[0]).toISOString(),
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5])
      }));

      return this.formatResponse({
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
        candles,
        isVerifiedExternal: true,
        metadata: {
          pair,
          assetClass: 'crypto',
          latency: 'real-time'
        }
      });
    } catch (err) {
      clearTimeout(timeoutId);
      return null;
    }
  }
}

module.exports = BinanceProvider;

