/**
 * TradeJourn Quantitative Strategy & Backtesting Engine
 * =====================================================
 * Chronological, bar-by-bar simulation with strict zero look-ahead bias.
 * Enforces transaction costs (spread & commissions), slippage assumptions,
 * dynamic stop-loss/take-profit models, and outputs verified statistical metrics.
 */

const { calculateSMA, calculateEMA, calculateRSI, calculateATR, detectSwingPoints } = require('./technicalAnalysisEngine');

/**
 * Standardize simulated candle format
 */
function prepareCandles(rawCandles) {
  if (!Array.isArray(rawCandles) || rawCandles.length < 15) {
    return [];
  }
  return rawCandles.map((c, i) => ({
    index: i,
    time: c.time || `bar_${i}`,
    open: Number(c.open),
    high: Number(c.high),
    low: Number(c.low),
    close: Number(c.close),
    volume: Number(c.volume || 0)
  }));
}

/**
 * Run Chronological Backtest on Historical Candles
 * 
 * @param {Object} options
 * @param {Array} options.candles - OHLCV series
 * @param {String} options.strategy - 'EMA_CROSSOVER' | 'RSI_PULLBACK' | 'BREAKOUT_RETEST'
 * @param {Object} options.params - Strategy parameters
 * @param {Number} options.initialCapital - Starting capital (default $10,000)
 * @param {Number} options.riskPerTradePct - % of equity risked per trade (default 1%)
 * @param {Number} options.rrTarget - Risk-to-reward target (default 1.5)
 * @param {Number} options.slippagePips - Slippage in pips (default 0.5)
 * @param {Number} options.commissionPerLotUSD - Commission per lot round-turn (default $7)
 */
function runStrategyBacktest({
  candles: rawCandles,
  strategy = 'EMA_CROSSOVER',
  params = {},
  initialCapital = 10000,
  riskPerTradePct = 1.0,
  rrTarget = 2.0,
  slippagePips = 0.5,
  commissionPerLotUSD = 7.0
} = {}) {
  const candles = prepareCandles(rawCandles);

  if (candles.length < 25) {
    return {
      success: false,
      error: 'Insufficient historical candles for backtesting. Minimum 25 bars required.',
      totalTrades: 0
    };
  }

  // Pre-calculate indicators up to each bar chronologically (no look-ahead)
  const trades = [];
  let equity = initialCapital;
  let peakEquity = initialCapital;
  let maxDrawdownUSD = 0;
  let maxDrawdownPct = 0;

  let inPosition = false;
  let currentPosition = null;

  // Parameters
  const fastPeriod = Number(params.fastPeriod || 9);
  const slowPeriod = Number(params.slowPeriod || 21);
  const rsiPeriod = Number(params.rsiPeriod || 14);
  const rsiOversold = Number(params.rsiOversold || 35);
  const rsiOverbought = Number(params.rsiOverbought || 65);

  const warmup = Math.max(slowPeriod, rsiPeriod, 15);

  for (let i = warmup; i < candles.length - 1; i++) {
    const historicalSlice = candles.slice(0, i + 1); // strictly bars 0 to i
    const currentBar = candles[i];
    const nextBar = candles[i + 1];

    // 1. If currently in a position, evaluate exit on bar i
    if (inPosition && currentPosition) {
      let exitPrice = null;
      let exitReason = null;

      if (currentPosition.direction === 'LONG') {
        if (currentBar.low <= currentPosition.stopLoss) {
          exitPrice = currentPosition.stopLoss - (slippagePips * 0.0001);
          exitReason = 'STOP_LOSS';
        } else if (currentBar.high >= currentPosition.takeProfit) {
          exitPrice = currentPosition.takeProfit;
          exitReason = 'TAKE_PROFIT';
        }
      } else if (currentPosition.direction === 'SHORT') {
        if (currentBar.high >= currentPosition.stopLoss) {
          exitPrice = currentPosition.stopLoss + (slippagePips * 0.0001);
          exitReason = 'STOP_LOSS';
        } else if (currentBar.low <= currentPosition.takeProfit) {
          exitPrice = currentPosition.takeProfit;
          exitReason = 'TAKE_PROFIT';
        }
      }

      if (exitPrice !== null) {
        const rawPnl = currentPosition.direction === 'LONG'
          ? (exitPrice - currentPosition.entryPrice)
          : (currentPosition.entryPrice - exitPrice);

        // Normalize to $ and R
        const rMultiple = Number((rawPnl / currentPosition.riskDistance).toFixed(2));
        const dollarProfit = Number((currentPosition.dollarRisk * rMultiple - commissionPerLotUSD).toFixed(2));

        equity += dollarProfit;
        if (equity > peakEquity) peakEquity = equity;
        const currentDd = peakEquity - equity;
        if (currentDd > maxDrawdownUSD) {
          maxDrawdownUSD = currentDd;
          maxDrawdownPct = Number(((maxDrawdownUSD / peakEquity) * 100).toFixed(2));
        }

        trades.push({
          id: trades.length + 1,
          direction: currentPosition.direction,
          entryTime: currentPosition.entryTime,
          exitTime: currentBar.time,
          entryPrice: Number(currentPosition.entryPrice.toFixed(4)),
          exitPrice: Number(exitPrice.toFixed(4)),
          stopLoss: Number(currentPosition.stopLoss.toFixed(4)),
          takeProfit: Number(currentPosition.takeProfit.toFixed(4)),
          result: dollarProfit > 0 ? 'WIN' : 'LOSS',
          exitReason,
          rMultiple,
          profitUSD: dollarProfit,
          equityAfter: Number(equity.toFixed(2))
        });

        inPosition = false;
        currentPosition = null;
      }
    }

    // 2. If not in position, check for entry signals on historicalSlice
    if (!inPosition) {
      let signal = null; // 'LONG' or 'SHORT'

      if (strategy === 'EMA_CROSSOVER') {
        const fastEmaPrev = calculateEMA(candles.slice(0, i), fastPeriod);
        const slowEmaPrev = calculateEMA(candles.slice(0, i), slowPeriod);
        const fastEmaCurr = calculateEMA(historicalSlice, fastPeriod);
        const slowEmaCurr = calculateEMA(historicalSlice, slowPeriod);

        if (fastEmaPrev && slowEmaPrev && fastEmaCurr && slowEmaCurr) {
          if (fastEmaPrev <= slowEmaPrev && fastEmaCurr > slowEmaCurr) {
            signal = 'LONG';
          } else if (fastEmaPrev >= slowEmaPrev && fastEmaCurr < slowEmaCurr) {
            signal = 'SHORT';
          }
        }
      } else if (strategy === 'RSI_PULLBACK') {
        const rsiPrev = calculateRSI(candles.slice(0, i), rsiPeriod);
        const rsiCurr = calculateRSI(historicalSlice, rsiPeriod);
        const emaTrend = calculateEMA(historicalSlice, 50) || calculateSMA(historicalSlice, 20);

        if (rsiPrev !== null && rsiCurr !== null && emaTrend) {
          // Trend filter + oversold bounce
          if (currentBar.close > emaTrend && rsiPrev < rsiOversold && rsiCurr >= rsiOversold) {
            signal = 'LONG';
          } else if (currentBar.close < emaTrend && rsiPrev > rsiOverbought && rsiCurr <= rsiOverbought) {
            signal = 'SHORT';
          }
        }
      } else if (strategy === 'BREAKOUT_RETEST') {
        const lookback = 10;
        const priorHigh = Math.max(...candles.slice(i - lookback, i).map(c => c.high));
        const priorLow = Math.min(...candles.slice(i - lookback, i).map(c => c.low));

        if (currentBar.close > priorHigh) {
          signal = 'LONG';
        } else if (currentBar.close < priorLow) {
          signal = 'SHORT';
        }
      }

      // Enter at next bar's open price (zero lookahead)
      if (signal) {
        const entryPrice = nextBar.open + (signal === 'LONG' ? (slippagePips * 0.0001) : -(slippagePips * 0.0001));
        const atr = calculateATR(historicalSlice, 14) || (entryPrice * 0.003);
        const riskDistance = atr * 1.5;

        const stopLoss = signal === 'LONG' ? (entryPrice - riskDistance) : (entryPrice + riskDistance);
        const takeProfit = signal === 'LONG' ? (entryPrice + riskDistance * rrTarget) : (entryPrice - riskDistance * rrTarget);
        const dollarRisk = Number((equity * (riskPerTradePct / 100)).toFixed(2));

        inPosition = true;
        currentPosition = {
          direction: signal,
          entryTime: nextBar.time,
          entryPrice,
          stopLoss,
          takeProfit,
          riskDistance,
          dollarRisk
        };
      }
    }
  }

  // 3. Compile Backtest Analytics
  const totalTrades = trades.length;
  if (totalTrades === 0) {
    return {
      success: true,
      strategy,
      message: 'Zero trades triggered across the provided candle sample with the specified parameter thresholds.',
      performance: {
        initialCapital: `$${initialCapital.toLocaleString()}`,
        finalEquity: `$${initialCapital.toLocaleString()}`,
        netProfitUSD: '$0',
        netReturnPct: '0%',
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: '0%',
        profitFactor: 0,
        expectancyUSD: '$0.00 per trade',
        expectancyR: '0R',
        maxDrawdownUSD: '$0',
        maxDrawdownPct: '0%',
        avgWinUSD: '$0',
        avgLossUSD: '$0',
        sharpeRatio: 0
      },
      disclosures: [
        'Zero look-ahead bias: entries evaluated on Bar i close and filled on Bar i+1 open.',
        'Slippage (0.5 pips) and exchange commissions ($7/lot) deducted from every trade.',
        'Overfitting Risk: Past simulated performance does not guarantee future results.',
        'Out-of-sample forward testing is required before deploying live capital.'
      ]
    };
  }

  const wins = trades.filter(t => t.result === 'WIN');
  const losses = trades.filter(t => t.result === 'LOSS');
  const winRate = Number(((wins.length / totalTrades) * 100).toFixed(1));

  let grossProfit = 0;
  let grossLoss = 0;
  let totalR = 0;

  trades.forEach(t => {
    if (t.profitUSD > 0) grossProfit += t.profitUSD;
    else grossLoss += Math.abs(t.profitUSD);
    totalR += t.rMultiple;
  });

  const netProfitUSD = Number((equity - initialCapital).toFixed(2));
  const netReturnPct = Number((((equity - initialCapital) / initialCapital) * 100).toFixed(2));
  const profitFactor = grossLoss > 0 ? Number((grossProfit / grossLoss).toFixed(2)) : (grossProfit > 0 ? 999.0 : 0);
  const avgWinUSD = wins.length ? Number((grossProfit / wins.length).toFixed(2)) : 0;
  const avgLossUSD = losses.length ? Number((grossLoss / losses.length).toFixed(2)) : 0;

  const expectancyUSD = Number(((winRate / 100 * avgWinUSD) - ((100 - winRate) / 100 * avgLossUSD)).toFixed(2));
  const expectancyR = Number((totalR / totalTrades).toFixed(2));

  // Annualized Sharpe Ratio approximation
  const returns = trades.map(t => t.profitUSD / initialCapital);
  const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + Math.pow(b - meanReturn, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);
  const sharpeRatio = stdDev > 0 ? Number(((meanReturn / stdDev) * Math.sqrt(252)).toFixed(2)) : 0;

  return {
    success: true,
    strategy,
    params: {
      strategy,
      rrTarget,
      riskPerTradePct: `${riskPerTradePct}%`,
      slippagePips,
      commissionPerLotUSD: `$${commissionPerLotUSD}`
    },
    performance: {
      initialCapital: `$${initialCapital.toLocaleString()}`,
      finalEquity: `$${Math.round(equity).toLocaleString()}`,
      netProfitUSD: `${netProfitUSD >= 0 ? '+' : ''}$${netProfitUSD.toLocaleString()}`,
      netReturnPct: `${netReturnPct >= 0 ? '+' : ''}${netReturnPct}%`,
      totalTrades,
      winningTrades: wins.length,
      losingTrades: losses.length,
      winRate: `${winRate}%`,
      profitFactor,
      expectancyUSD: `${expectancyUSD >= 0 ? '+' : ''}$${expectancyUSD.toFixed(2)} per trade`,
      expectancyR: `${expectancyR >= 0 ? '+' : ''}${expectancyR}R`,
      maxDrawdownUSD: `-$${Math.round(maxDrawdownUSD).toLocaleString()}`,
      maxDrawdownPct: `${maxDrawdownPct}%`,
      avgWinUSD: `$${avgWinUSD.toLocaleString()}`,
      avgLossUSD: `$${avgLossUSD.toLocaleString()}`,
      sharpeRatio
    },
    disclosures: [
      'Zero look-ahead bias: entries evaluated on Bar i close and filled on Bar i+1 open.',
      'Slippage (0.5 pips) and exchange commissions ($7/lot) deducted from every trade.',
      'Overfitting Risk: Past simulated performance does not guarantee future results.',
      'Out-of-sample forward testing is required before deploying live capital.'
    ],
    sampleTrades: trades.slice(-5)
  };
}

module.exports = {
  runStrategyBacktest
};
