/**
 * Base Market Data Provider Interface
 * =====================================
 * Standard contract for TradeJourn market data adapters.
 */

class BaseMarketDataProvider {
  constructor(name) {
    this.name = name;
  }

  isAvailable() {
    return true;
  }

  async fetchQuoteAndCandles(symbol, timeframe = '1h', limit = 30) {
    throw new Error(`fetchQuoteAndCandles must be implemented by provider [${this.name}]`);
  }

  formatResponse({
    status,
    source,
    symbol,
    price,
    bid,
    ask,
    change24h = 0,
    high24h = 0,
    low24h = 0,
    timeframe,
    timestamp,
    candles = [],
    isVerifiedExternal = true,
    metadata = {}
  }) {
    return {
      status,
      provider: this.name,
      source: source || this.name,
      symbol,
      price: Number(price),
      bid: Number(bid || price),
      ask: Number(ask || price),
      change24h: Number(change24h),
      high24h: Number(high24h || price),
      low24h: Number(low24h || price),
      timeframe,
      timestamp: timestamp || new Date().toISOString(),
      candles,
      isVerifiedExternal,
      metadata
    };
  }
}

module.exports = BaseMarketDataProvider;

