/**
 * Yahoo Finance Delayed Market Data Provider
 * ===========================================
 * Public fallback feed for Forex, Commodities (Gold, Silver), and Indices.
 * Status: Always explicitly flagged as DELAYED (~15m).
 * Never misrepresents delayed public quotes as real-time institutional exchange data.
 */

const BaseMarketDataProvider = require('./baseProvider');

const TIMEOUT_MS = 6000;

class YahooProvider extends BaseMarketDataProvider {
  constructor() {
    super('Yahoo Public Feed');
  }

  isAvailable() {
    return true; // Public web endpoint
  }

  mapSymbol(symbol) {
    const yahooSymbolMap = {
      XAUUSD: 'GC=F',     // Gold Futures / Spot proxy
      XAGUSD: 'SI=F',     // Silver Futures
      EURUSD: 'EURUSD=X',
      GBPUSD: 'GBPUSD=X',
      USDJPY: 'JPY=X',
      USDCAD: 'CAD=X',
      AUDUSD: 'AUDUSD=X',
      NZDUSD: 'NZDUSD=X',
      USDCHF: 'CHF=X',
      EURJPY: 'EURJPY=X',
      GBPJPY: 'GBPJPY=X',
      US30: '^DJI',
      NAS100: '^IXIC',
      SPX500: '^GSPC'
    };
    return yahooSymbolMap[symbol] || `${symbol}=X`;
  }

  mapIntervalAndRange(timeframe) {
    if (timeframe === '15m') return { interval: '15m', range: '5d' };
    if (timeframe === '1d' || timeframe === 'D') return { interval: '1d', range: '3mo' };
    if (timeframe === '4h') return { interval: '60m', range: '1mo' };
    return { interval: '60m', range: '1mo' };
  }

  async fetchQuoteAndCandles(symbol, timeframe = '1h', limit = 30) {
    const ySymbol = this.mapSymbol(symbol);
    const { interval, range } = this.mapIntervalAndRange(timeframe);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ySymbol)}?interval=${interval}&range=${range}`;
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

      const rawCandles = [];
      const precision = symbol.includes('JPY') ? 3 : (symbol === 'XAUUSD' || symbol.includes('30') || symbol.includes('100') ? 2 : 5);

      for (let i = 0; i < timestamps.length; i++) {
        if (opens[i] !== null && closes[i] !== null && highs[i] !== null && lows[i] !== null) {
          rawCandles.push({
            time: new Date(timestamps[i] * 1000).toISOString(),
            open: Number(Number(opens[i]).toFixed(precision)),
            high: Number(Number(highs[i]).toFixed(precision)),
            low: Number(Number(lows[i]).toFixed(precision)),
            close: Number(Number(closes[i]).toFixed(precision)),
            volume: Number(volumes[i] || 0)
          });
        }
      }

      if (rawCandles.length === 0) return null;

      // If 4h requested, aggregate 4 1-hour candles into 1 4-hour candle
      let finalCandles = rawCandles;
      if (timeframe === '4h' && rawCandles.length >= 4) {
        const agg = [];
        for (let i = 0; i < rawCandles.length; i += 4) {
          const chunk = rawCandles.slice(i, i + 4);
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
      const latestPrice = Number(price.toFixed(precision));

      return this.formatResponse({
        status: 'DELAYED',
        source: 'Global Market Feed (Delayed ~15m)',
        symbol,
        price: latestPrice,
        bid: latestPrice,
        ask: latestPrice,
        change24h: meta.chartPreviousClose ? Number((((price - meta.chartPreviousClose) / meta.chartPreviousClose) * 100).toFixed(2)) : 0,
        high24h: meta.regularMarketDayHigh || price,
        low24h: meta.regularMarketDayLow || price,
        timeframe,
        timestamp: new Date().toISOString(),
        candles: trimmedCandles,
        isVerifiedExternal: true,
        metadata: {
          feedType: 'delayed-public',
          delayEstimatedMinutes: 15,
          notice: 'Quotes are delayed by approx. 15 minutes. For sub-second institutional direct feeds, activate TWELVE_DATA_API_KEY.'
        }
      });
    } catch (err) {
      clearTimeout(timeoutId);
      return null;
    }
  }
}

module.exports = YahooProvider;
