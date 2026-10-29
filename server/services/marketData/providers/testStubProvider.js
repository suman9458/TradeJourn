/**
 * Testable Market Data Stub Provider
 * ===================================
 * Dedicated test interface for offline testing, deterministic assertions,
 * and regression testing of indicators, candle validators, and scenario planning.
 * NOTE: strictly used in test environments; NEVER silently substituted in production.
 */

const BaseMarketDataProvider = require('./baseProvider');

class TestStubProvider extends BaseMarketDataProvider {
  constructor(customDataset = null) {
    super('Test Stub Provider (Isolated)');
    this.customDataset = customDataset;
  }

  isAvailable() {
    return true;
  }

  /**
   * Generates a deterministic sequence of 30 clean candles with known swing points
   */
  generateDeterministicCandles(basePrice = 2000, timeframe = '1h') {
    const candles = [];
    const now = Date.now();
    const intervalMs = timeframe === '15m' ? 15 * 60 * 1000 : 60 * 60 * 1000;
    const startTime = now - (30 * intervalMs);

    let current = basePrice;
    // Predictable path: uptrend with defined Higher Highs & Higher Lows
    const deltas = [
      0, 2, -1, 3, 1, -2, 4, 2, -1, 3,
      5, -2, 4, 3, -1, 6, 2, -3, 5, 4,
      -2, 6, 3, -1, 5, 4, -2, 7, 3, 5
    ];

    for (let i = 0; i < 30; i++) {
      const open = Number(current.toFixed(2));
      const close = Number((current + deltas[i]).toFixed(2));
      const high = Number((Math.max(open, close) + 1.5).toFixed(2));
      const low = Number((Math.min(open, close) - 1.5).toFixed(2));
      const time = new Date(startTime + (i * intervalMs)).toISOString();

      candles.push({
        time,
        open,
        high,
        low,
        close,
        volume: 1000 + i * 50
      });

      current = close;
    }

    return candles;
  }

  async fetchQuoteAndCandles(symbol = 'XAUUSD', timeframe = '1h', limit = 30) {
    if (this.customDataset) {
      return this.formatResponse({
        status: this.customDataset.status || 'CACHED',
        source: 'Verified Offline Test Dataset',
        symbol: this.customDataset.symbol || symbol,
        price: this.customDataset.price || 2050.50,
        bid: this.customDataset.bid || 2050.40,
        ask: this.customDataset.ask || 2050.60,
        change24h: this.customDataset.change24h || 1.25,
        high24h: this.customDataset.high24h || 2060.00,
        low24h: this.customDataset.low24h || 2035.00,
        timeframe,
        timestamp: this.customDataset.timestamp || new Date().toISOString(),
        candles: this.customDataset.candles || this.generateDeterministicCandles(2000, timeframe),
        isVerifiedExternal: false,
        metadata: { isTestStub: true }
      });
    }

    const candles = this.generateDeterministicCandles(symbol === 'EURUSD' ? 1.0850 : 2000, timeframe);
    const latest = candles[candles.length - 1];

    return this.formatResponse({
      status: 'CACHED',
      source: 'Verified Offline Test Dataset',
      symbol,
      price: latest.close,
      bid: latest.close - 0.1,
      ask: latest.close + 0.1,
      change24h: 1.5,
      high24h: Math.max(...candles.map(c => c.high)),
      low24h: Math.min(...candles.map(c => c.low)),
      timeframe,
      timestamp: latest.time,
      candles: candles.slice(-limit),
      isVerifiedExternal: false,
      metadata: { isTestStub: true }
    });
  }
}

module.exports = TestStubProvider;

