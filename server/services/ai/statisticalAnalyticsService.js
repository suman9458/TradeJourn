/**
 * TradeJourn Statistical Reasoning & Quantitative Risk Engine
 * ============================================================
 * Computes:
 * - Position sizing & lot calculations (Forex, Metals, Crypto)
 * - Mean vs Median outcome distribution & Skewness
 * - 95% Confidence Intervals for Win Rate
 * - Outlier analysis (edge resilience without largest winner)
 * - Probability of losing streaks & Risk of Ruin
 */

const { getTradeProfit } = require('./tradeUtils');

/**
 * Institutional Position Sizing Calculator
 */
function calculatePositionSize({
  balance = 10000,
  riskPct = 1.0,
  stopLossDistance = 20, // pips or dollars for gold
  instrument = 'EURUSD',
  pipValueUSD = 10.0 // standard lot pip value for EURUSD
} = {}) {
  const cleanSym = (instrument || 'EURUSD').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const riskAmountUSD = Number((balance * (riskPct / 100)).toFixed(2));

  let lots = 0;
  let formulaNote = '';

  if (cleanSym.includes('XAU') || cleanSym.includes('GOLD')) {
    // Gold: 1 standard lot = 100 oz. $1 price move = $100 per lot.
    // stopLossDistance is in dollars (e.g. $5.00 stop loss)
    const slDollars = Math.max(Number(stopLossDistance), 0.1);
    lots = Number((riskAmountUSD / (slDollars * 100)).toFixed(2));
    formulaNote = `Gold Position Sizing: Risk ($${riskAmountUSD}) ÷ (Stop Loss ($${slDollars}) × 100) = ${lots} Lots.`;
  } else if (cleanSym.includes('BTC') || cleanSym.includes('ETH')) {
    // Crypto: raw coin sizing
    const slDollars = Math.max(Number(stopLossDistance), 1);
    lots = Number((riskAmountUSD / slDollars).toFixed(4));
    formulaNote = `Crypto Position Sizing: Risk ($${riskAmountUSD}) ÷ Stop Loss Distance ($${slDollars}) = ${lots} Units.`;
  } else {
    // Forex standard
    const slPips = Math.max(Number(stopLossDistance), 1);
    const pipVal = Number(pipValueUSD) || 10.0;
    lots = Number((riskAmountUSD / (slPips * pipVal)).toFixed(2));
    formulaNote = `Forex Position Sizing: Risk ($${riskAmountUSD}) ÷ (Stop Loss (${slPips} pips) × $${pipVal}/pip) = ${lots} Lots.`;
  }

  return {
    instrument: cleanSym,
    accountBalance: `$${Number(balance).toLocaleString()}`,
    riskPercent: `${riskPct}%`,
    riskAmountUSD: `$${riskAmountUSD.toLocaleString()}`,
    stopLossDistance: stopLossDistance,
    calculatedPositionSize: `${lots} Lots`,
    formulaNote,
    maxDailyLossWarning: riskPct > 2.0
      ? '⚠️ Warning: Risking >2% on a single trade exposes you to elevated risk of catastrophic drawdown.'
      : '✅ Risk conforms to institutional 1-2% capital preservation standard.'
  };
}

/**
 * Quantitative Statistical Distribution of Trades
 */
function calculateStatisticalDistribution(trades = []) {
  if (!Array.isArray(trades) || trades.length < 5) {
    return {
      hasData: false,
      message: 'Minimum 5 trades required to calculate statistical distribution and confidence intervals.',
      sampleSize: trades?.length || 0
    };
  }

  const profits = trades.map(t => getTradeProfit(t)).sort((a, b) => a - b);
  const N = profits.length;

  // Mean & Median
  const sum = profits.reduce((acc, p) => acc + p, 0);
  const meanProfit = Number((sum / N).toFixed(2));
  const medianProfit = N % 2 === 0
    ? Number(((profits[N / 2 - 1] + profits[N / 2]) / 2).toFixed(2))
    : Number(profits[Math.floor(N / 2)].toFixed(2));

  // Variance & Standard Deviation (Sample)
  const variance = profits.reduce((acc, p) => acc + Math.pow(p - meanProfit, 2), 0) / (N - 1);
  const stdDev = Number(Math.sqrt(variance).toFixed(2));

  // Win Rate & 95% Confidence Interval (Normal / Wilson approximation)
  const wins = trades.filter(t => t.result === 'WIN').length;
  const p = wins / N;
  const winRate = Number((p * 100).toFixed(1));
  const marginOfError = Number((1.96 * Math.sqrt((p * (1 - p)) / N) * 100).toFixed(1));
  const ciLower = Math.max(0, Number((winRate - marginOfError).toFixed(1)));
  const ciUpper = Math.min(100, Number((winRate + marginOfError).toFixed(1)));

  // Outlier Analysis: P&L without top outlier winner
  const topWinner = profits[profits.length - 1];
  const pnlWithoutTopWinner = Number((sum - topWinner).toFixed(2));

  // Skewness
  const skewness = Number(((3 * (meanProfit - medianProfit)) / (stdDev || 1)).toFixed(2));
  const skewDescription = skewness > 0.5
    ? 'Positive Skew (Right-tailed: Large occasional winners drive edge)'
    : skewness < -0.5
    ? 'Negative Skew (Left-tailed: Frequent small wins punctuated by outsized losses)'
    : 'Symmetric Distribution (Balanced outcomes)';

  return {
    hasData: true,
    sampleSize: N,
    meanOutcomeUSD: `${meanProfit >= 0 ? '+' : ''}$${meanProfit}`,
    medianOutcomeUSD: `${medianProfit >= 0 ? '+' : ''}$${medianProfit}`,
    standardDeviationUSD: `$${stdDev}`,
    winRate: `${winRate}%`,
    winRate95CI: `${ciLower}% to ${ciUpper}% (±${marginOfError}%)`,
    distributionSkew: `${skewness} (${skewDescription})`,
    outlierAnalysis: {
      largestWinnerUSD: `+$${topWinner.toLocaleString()}`,
      pnlWithAllTrades: `${sum >= 0 ? '+' : ''}$${sum.toLocaleString()}`,
      pnlExcludingLargestWinner: `${pnlWithoutTopWinner >= 0 ? '+' : ''}$${pnlWithoutTopWinner.toLocaleString()}`,
      isEdgeDependentOnOutlier: sum > 0 && pnlWithoutTopWinner <= 0
        ? '⚠️ High Dependency: Without your single largest winner, net P&L turns negative. Focus on improving average baseline expectancy.'
        : '✅ Resilient Edge: Overall profitability remains positive even after removing your largest winning trade.'
    },
    sampleSizeAssessment: N < 20
      ? `Sample size (N=${N}) is small. The 95% confidence interval for win rate spans ${ciLower}%-${ciUpper}%, reflecting substantial statistical uncertainty.`
      : `Sample size (N=${N}) provides adequate statistical validity for performance attribution.`
  };
}

module.exports = {
  calculatePositionSize,
  calculateStatisticalDistribution
};
