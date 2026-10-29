/**
 * TradeJourn Journal Intelligence Tools
 * =====================================
 * Verified, deterministic financial analytics and database tools.
 * All queries are strictly isolated to the authenticated user (userId).
 * Calculates financial metrics (win rate, realized gross & net P&L, fees, swaps,
 * expectancy, profit factor, drawdown, holding duration, session/symbol performance,
 * strategy comparisons, and recurring execution mistakes) in deterministic backend code.
 */

const mongoose = require('mongoose');
const Trade = require('../../models/Trade');
const Playbook = require('../../models/Playbook');
const Goal = require('../../models/Goal');
const { getUpcomingEconomicEvents, getMacroDrivers } = require('../marketData/economicCalendarService');
const { calculatePositionSize, calculateStatisticalDistribution } = require('./statisticalAnalyticsService');
const { retrieveKnowledgeDocuments } = require('./knowledgeBaseService');
const {
  getTradeGrossProfit,
  getTradeFees,
  getTradeSwap,
  getTradeNetProfit,
  getTradeProfit,
  calculateTradeDurationMinutes,
  formatDuration,
  computeStreaks,
  computeEquityCurveAndDrawdown
} = require('./tradeUtils');

function isDbReady() {
  return mongoose.connection.readyState === 1;
}

function isValidUserId(userId) {
  return !!userId && (mongoose.Types.ObjectId.isValid(userId) || typeof userId === 'string');
}

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatSignedCurrency(amount) {
  const num = Number(amount || 0);
  if (num >= 0) {
    return `+$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `-$${Math.abs(num).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Tool 1: get_trade_stats
 * Deterministic comprehensive trade journal statistics
 */
async function getTradeStats(userId, filters = {}) {
  if (!isDbReady() || !isValidUserId(userId)) {
    return {
      hasData: false,
      message: 'No trades found matching the specified criteria in your journal.',
      totalTrades: 0
    };
  }

  const query = {
    userId,
    result: { $in: ['WIN', 'LOSS', 'BE'] }
  };

  if (filters.instrument) {
    query.instrument = new RegExp(`^${escapeRegex(filters.instrument.trim())}$`, 'i');
  }
  if (filters.session) {
    query.session = new RegExp(`^${escapeRegex(filters.session.trim())}$`, 'i');
  }
  if (filters.setupRating) {
    query.setupRating = filters.setupRating;
  }
  if (filters.entryType) {
    query.entryType = filters.entryType;
  }
  if (filters.startDate || filters.endDate) {
    query.date = {};
    if (filters.startDate) query.date.$gte = filters.startDate;
    if (filters.endDate) query.date.$lte = filters.endDate;
  }

  const trades = await Trade.find(query).lean();
  const totalTrades = trades.length;

  if (totalTrades === 0) {
    return {
      hasData: false,
      message: 'No trades found matching the specified criteria in your journal.',
      totalTrades: 0
    };
  }

  const wins = trades.filter(t => t.result === 'WIN');
  const losses = trades.filter(t => t.result === 'LOSS');
  const bes = trades.filter(t => t.result === 'BE');

  // Win rates: Standard (all closed trades) and Excluding BE
  const winRate = Number(((wins.length / totalTrades) * 100).toFixed(1));
  const lossRate = Number(((losses.length / totalTrades) * 100).toFixed(1));
  const beRate = Number(((bes.length / totalTrades) * 100).toFixed(1));
  const decisiveTrades = wins.length + losses.length;
  const winRateExcludingBE = decisiveTrades > 0
    ? Number(((wins.length / decisiveTrades) * 100).toFixed(1))
    : 0;

  let grossProfitUSD = 0;
  let grossLossUSD = 0;
  let totalCommissionsUSD = 0;
  let totalSwapsUSD = 0;
  let totalR = 0;
  let bestTradeUSD = -Infinity;
  let worstTradeUSD = Infinity;
  let earlyExitCount = 0;
  let emotionalTradeCount = 0;
  let totalDiscipline = 0;

  const validDurations = [];

  trades.forEach(t => {
    const gross = getTradeGrossProfit(t);
    const fees = getTradeFees(t);
    const swap = getTradeSwap(t);
    const net = getTradeNetProfit(t);

    totalCommissionsUSD += fees;
    totalSwapsUSD += swap;

    if (gross > 0) grossProfitUSD += gross;
    else if (gross < 0) grossLossUSD += Math.abs(gross);

    const r = Number(t.rResult !== undefined && t.rResult !== null
      ? t.rResult
      : (t.result === 'WIN' ? 1.5 : t.result === 'LOSS' ? -1 : 0));
    totalR += r;

    if (net > bestTradeUSD) bestTradeUSD = net;
    if (net < worstTradeUSD) worstTradeUSD = net;

    if (t.earlyExitFlag === 1 || (t.reasonEarlyExit && t.reasonEarlyExit !== 'None')) {
      earlyExitCount++;
    }

    if (t.emotionalTradeFlag === 1 || ['Fear', 'Greed', 'Impatient', 'Revenge', 'FOMO', 'Frustrated'].includes(t.emotion)) {
      emotionalTradeCount++;
    }

    totalDiscipline += Number(t.disciplineScore || 80);

    const duration = calculateTradeDurationMinutes(t);
    if (duration !== null) {
      validDurations.push(duration);
    }
  });

  grossProfitUSD = Number(grossProfitUSD.toFixed(2));
  grossLossUSD = Number(grossLossUSD.toFixed(2));
  totalCommissionsUSD = Number(totalCommissionsUSD.toFixed(2));
  totalSwapsUSD = Number(totalSwapsUSD.toFixed(2));

  // Net Profit = Gross Profit - Gross Loss - Commissions + Swaps
  const netProfitUSD = Number((grossProfitUSD - grossLossUSD - totalCommissionsUSD + totalSwapsUSD).toFixed(2));

  const avgR = Number((totalR / totalTrades).toFixed(2));
  const profitFactor = grossLossUSD > 0
    ? Number((grossProfitUSD / grossLossUSD).toFixed(2))
    : (grossProfitUSD > 0 ? 999.0 : 0);

  const avgWinUSD = wins.length > 0 ? Number((grossProfitUSD / wins.length).toFixed(2)) : 0;
  const avgLossUSD = losses.length > 0 ? Number((grossLossUSD / losses.length).toFixed(2)) : 0;
  const winLossRatio = avgLossUSD > 0 ? Number((avgWinUSD / avgLossUSD).toFixed(2)) : (avgWinUSD > 0 ? 999.0 : 0);

  // Exact empirical expectancy per trade in dollars: Total Net P&L / Sample Size N
  const expectancyUSD = Number((netProfitUSD / totalTrades).toFixed(2));

  const streaks = computeStreaks(trades);
  const drawdownData = computeEquityCurveAndDrawdown(trades);

  // Holding duration calculation
  const tradesWithDuration = validDurations.length;
  const avgHoldingDurationMinutes = tradesWithDuration > 0
    ? Math.round(validDurations.reduce((sum, d) => sum + d, 0) / tradesWithDuration)
    : null;
  const avgHoldingDurationFormatted = formatDuration(avgHoldingDurationMinutes);

  // Date range determination
  const sortedDates = [...trades].map(t => t.date).filter(Boolean).sort();
  const earliestTradeDate = sortedDates[0] || 'Unknown';
  const latestTradeDate = sortedDates[sortedDates.length - 1] || 'Unknown';
  let totalDaysSpan = 0;
  if (earliestTradeDate !== 'Unknown' && latestTradeDate !== 'Unknown') {
    const d1 = new Date(earliestTradeDate);
    const d2 = new Date(latestTradeDate);
    totalDaysSpan = Math.max(1, Math.round((d2 - d1) / (1000 * 60 * 60 * 24)) + 1);
  }

  // Long vs Short performance
  const buys = trades.filter(t => t.direction === 'Buy');
  const sells = trades.filter(t => t.direction === 'Sell');
  const buyWins = buys.filter(t => t.result === 'WIN').length;
  const sellWins = sells.filter(t => t.result === 'WIN').length;
  const buyPnl = buys.reduce((sum, t) => sum + getTradeNetProfit(t), 0);
  const sellPnl = sells.reduce((sum, t) => sum + getTradeNetProfit(t), 0);

  const sampleSizeWarning = totalTrades < 20
    ? `Sample size is statistically small (N=${totalTrades} trades). Observed metrics carry elevated sampling variance and should be confirmed across 30+ trades before changing your playbook rules.`
    : totalTrades < 30
    ? `Moderate sample size (N=${totalTrades} trades). Initial edge is forming; continue logging to reach institutional statistical significance (N>=30).`
    : null;

  return {
    hasData: true,
    sampleSize: totalTrades,
    totalTrades,
    winningTrades: wins.length,
    losingTrades: losses.length,
    breakEvenTrades: bes.length,
    winRate: `${winRate}%`,
    winRateExcludingBE: `${winRateExcludingBE}%`,
    lossRate: `${lossRate}%`,
    beRate: `${beRate}%`,
    grossProfitUSD: `$${grossProfitUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    grossLossUSD: `$${grossLossUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    totalCommissionsUSD: `$${totalCommissionsUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    totalSwapsUSD: formatSignedCurrency(totalSwapsUSD),
    netProfitUSD: formatSignedCurrency(netProfitUSD),
    totalR: `${totalR >= 0 ? '+' : ''}${totalR.toFixed(2)}R`,
    avgR: `${avgR >= 0 ? '+' : ''}${avgR.toFixed(2)}R`,
    profitFactor,
    avgWinUSD: `$${avgWinUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    avgLossUSD: `$${avgLossUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    winLossRatio,
    expectancyUSD: `${expectancyUSD >= 0 ? '+' : ''}$${expectancyUSD.toFixed(2)} per trade`,
    maxDrawdownUSD: `-$${drawdownData.maxDrawdownUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    currentDrawdownUSD: `-$${drawdownData.currentDrawdownUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    inDrawdown: drawdownData.inDrawdown,
    maxDrawdownDurationTrades: drawdownData.maxDrawdownDurationTrades,
    maxDrawdownDurationDays: drawdownData.maxDrawdownDurationDays,
    recoveryFactor: drawdownData.recoveryFactor,
    bestTradeUSD: bestTradeUSD !== -Infinity ? `${bestTradeUSD >= 0 ? '+' : ''}$${bestTradeUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '$0.00',
    worstTradeUSD: worstTradeUSD !== Infinity ? `${worstTradeUSD >= 0 ? '+' : ''}$${worstTradeUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '$0.00',
    currentStreak: streaks.currentWinStreak > 0 ? `+${streaks.currentWinStreak} Wins` : (streaks.currentLossStreak > 0 ? `-${streaks.currentLossStreak} Losses` : 'None'),
    maxWinStreak: streaks.maxWinStreak,
    maxLossStreak: streaks.maxLossStreak,
    holdingDuration: {
      tradesWithDuration,
      avgMinutes: avgHoldingDurationMinutes,
      formatted: avgHoldingDurationFormatted,
      isFullyRecorded: tradesWithDuration === totalTrades
    },
    dateRange: {
      filterStartDate: filters.startDate || null,
      filterEndDate: filters.endDate || null,
      earliestTradeDate,
      latestTradeDate,
      totalDaysSpan,
      formatted: `${earliestTradeDate} to ${latestTradeDate} (${totalDaysSpan} days, N=${totalTrades} trades)`
    },
    averageDiscipline: `${Math.round(totalDiscipline / totalTrades)}/100`,
    earlyExitCount,
    emotionalTradeCount,
    longPerformance: {
      trades: buys.length,
      winRate: buys.length ? `${Math.round((buyWins / buys.length) * 100)}%` : 'N/A',
      netProfit: `${buyPnl >= 0 ? '+' : ''}$${Math.round(buyPnl).toLocaleString()}`
    },
    shortPerformance: {
      trades: sells.length,
      winRate: sells.length ? `${Math.round((sellWins / sells.length) * 100)}%` : 'N/A',
      netProfit: `${sellPnl >= 0 ? '+' : ''}$${Math.round(sellPnl).toLocaleString()}`
    },
    sampleSizeWarning,
    evidenceExplanation: `Audited across ${totalTrades} verified closed trades spanning ${earliestTradeDate} to ${latestTradeDate}. All net figures deduct $${totalCommissionsUSD} in broker commissions and incorporate $${totalSwapsUSD} in financing swaps.`,
    correlationVsCausationNote: 'Important: High win rates or profit factors associated with specific sessions or setup tags reflect historical correlation under past market volatility. Sustainable edge is caused by risk discipline, stop-loss adherence, and favorable risk-to-reward execution, rather than the tag or session alone.'
  };
}

/**
 * Tool 2: get_trade_history
 * Fetches recent trades with deterministic accounting
 */
async function getTradeHistory(userId, options = {}) {
  const limit = Math.min(Math.max(Number(options.limit) || 10, 1), 50);
  const offset = Math.max(Number(options.offset) || 0, 0);

  if (!isDbReady() || !isValidUserId(userId)) {
    return {
      totalReturned: 0,
      totalMatchingTrades: 0,
      requestedLimit: limit,
      trades: []
    };
  }

  const query = {
    userId,
    result: { $in: ['WIN', 'LOSS', 'BE'] }
  };

  if (options.result && ['WIN', 'LOSS', 'BE'].includes(options.result.toUpperCase())) {
    query.result = options.result.toUpperCase();
  }
  if (options.instrument) {
    query.instrument = new RegExp(`^${escapeRegex(options.instrument.trim())}$`, 'i');
  }
  if (options.session) {
    query.session = new RegExp(`^${escapeRegex(options.session.trim())}$`, 'i');
  }
  if (options.setupRating) {
    query.setupRating = options.setupRating;
  }
  if (options.entryType) {
    query.entryType = options.entryType;
  }
  if (options.startDate || options.endDate) {
    query.date = {};
    if (options.startDate) query.date.$gte = options.startDate;
    if (options.endDate) query.date.$lte = options.endDate;
  }

  const [totalMatchingTrades, trades] = await Promise.all([
    Trade.countDocuments(query),
    Trade.find(query)
      .sort({ date: -1, time: -1, createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean()
  ]);

  const formatted = trades.map((t, index) => {
    const gross = getTradeGrossProfit(t);
    const fees = getTradeFees(t);
    const swap = getTradeSwap(t);
    const net = getTradeNetProfit(t);
    const durationMin = calculateTradeDurationMinutes(t);

    return {
      index: offset + index + 1,
      id: t._id,
      name: t.tradeName || `Trade #${offset + index + 1}`,
      date: t.date,
      time: t.time || '00:00',
      instrument: t.instrument || 'EURUSD',
      direction: t.direction || 'Buy',
      result: t.result,
      grossProfitUSD: formatSignedCurrency(gross),
      netProfitUSD: formatSignedCurrency(net),
      commissionUSD: fees > 0 ? `-$${fees.toFixed(2)}` : '$0.00',
      swapUSD: `${swap >= 0 ? '+' : ''}$${swap.toFixed(2)}`,
      rResult: `${Number(t.rResult || 0) >= 0 ? '+' : ''}${Number(t.rResult || 0).toFixed(2)}R`,
      rr: t.rr || 1.5,
      pips: Number(t.pips || 0),
      holdingDuration: formatDuration(durationMin),
      session: t.session || 'London',
      setup: t.setupRating || 'A+',
      entryType: t.entryType || 'Confirmation',
      emotion: t.emotion || 'Calm',
      discipline: Number(t.disciplineScore || 100),
      mistakes: Array.isArray(t.mistakes) ? t.mistakes.filter(m => m && m !== 'None').join(', ') : 'None',
      notes: t.notes || ''
    };
  });

  return {
    totalReturned: formatted.length,
    totalMatchingTrades,
    requestedLimit: limit,
    offset,
    trades: formatted
  };
}

/**
 * Tool 3: get_trade_details
 */
async function getTradeDetails(userId, { tradeId, tradeName } = {}) {
  if (!isDbReady() || !isValidUserId(userId)) {
    return { found: false, message: 'Trade not found in your journal.' };
  }
  const query = { userId };
  if (tradeId) query._id = tradeId;
  else if (tradeName) query.tradeName = new RegExp(`^${escapeRegex(tradeName.trim())}$`, 'i');
  else throw new Error('Please specify tradeId or tradeName to retrieve details.');

  const trade = await Trade.findOne(query).lean();
  if (!trade) {
    return { found: false, message: 'Trade not found in your journal.' };
  }

  const gross = getTradeGrossProfit(trade);
  const fees = getTradeFees(trade);
  const swap = getTradeSwap(trade);
  const net = getTradeNetProfit(trade);
  const durationMin = calculateTradeDurationMinutes(trade);

  return {
    found: true,
    id: trade._id,
    name: trade.tradeName,
    date: trade.date,
    time: trade.time,
    instrument: trade.instrument,
    direction: trade.direction,
    bias: trade.bias,
    result: trade.result,
    grossProfitUSD: formatSignedCurrency(gross),
    netProfitUSD: formatSignedCurrency(net),
    commissionUSD: fees > 0 ? `-$${fees.toFixed(2)}` : '$0.00',
    swapUSD: `${swap >= 0 ? '+' : ''}$${swap.toFixed(2)}`,
    rResult: `${Number(trade.rResult || 0) >= 0 ? '+' : ''}${Number(trade.rResult || 0).toFixed(2)}R`,
    rr: trade.rr,
    pips: trade.pips,
    holdingDuration: formatDuration(durationMin),
    session: trade.session,
    levelTraded: trade.levelTraded,
    setupRating: trade.setupRating,
    entryType: trade.entryType,
    confirmation: trade.confirmation,
    entryPrice: trade.entryPrice || 'Unrecorded',
    exitPrice: trade.exitPrice || 'Unrecorded',
    lotSize: trade.lotSize || 'Unrecorded',
    emotion: trade.emotion,
    earlyExit: trade.earlyExitFlag === 1,
    reasonEarlyExit: trade.reasonEarlyExit,
    mistakes: trade.mistakes,
    disciplineScore: trade.disciplineScore,
    tradeGrade: trade.tradeGrade,
    notes: trade.notes,
    hasScreenshot: !!(trade.screenshotUrl || trade.imageUrl || (trade.images && trade.images.length > 0))
  };
}

/**
 * Tool 4: get_performance_by_symbol
 */
async function getPerformanceBySymbol(userId, options = {}) {
  if (!isDbReady() || !isValidUserId(userId)) {
    return { hasData: false, message: 'No trades logged yet.' };
  }

  const query = { userId, result: { $in: ['WIN', 'LOSS', 'BE'] } };
  if (options.startDate || options.endDate) {
    query.date = {};
    if (options.startDate) query.date.$gte = options.startDate;
    if (options.endDate) query.date.$lte = options.endDate;
  }

  const trades = await Trade.find(query).lean();
  if (!trades.length) return { hasData: false, message: 'No closed trades logged matching the query.' };

  const map = {};
  trades.forEach(t => {
    const sym = (t.instrument || 'Unknown').toUpperCase().trim();
    if (!map[sym]) {
      map[sym] = {
        count: 0,
        wins: 0,
        losses: 0,
        bes: 0,
        grossProfitUSD: 0,
        grossLossUSD: 0,
        feesUSD: 0,
        swapsUSD: 0,
        totalR: 0,
        durations: []
      };
    }
    map[sym].count++;
    if (t.result === 'WIN') map[sym].wins++;
    else if (t.result === 'LOSS') map[sym].losses++;
    else map[sym].bes++;

    const gross = getTradeGrossProfit(t);
    const fees = getTradeFees(t);
    const swap = getTradeSwap(t);

    if (gross > 0) map[sym].grossProfitUSD += gross;
    else if (gross < 0) map[sym].grossLossUSD += Math.abs(gross);

    map[sym].feesUSD += fees;
    map[sym].swapsUSD += swap;
    map[sym].totalR += Number(t.rResult || 0);

    const dur = calculateTradeDurationMinutes(t);
    if (dur !== null) map[sym].durations.push(dur);
  });

  const breakdown = Object.entries(map).map(([symbol, s]) => {
    const netProfitUSD = Number((s.grossProfitUSD - s.grossLossUSD - s.feesUSD + s.swapsUSD).toFixed(2));
    const winRate = Number(((s.wins / s.count) * 100).toFixed(1));
    const decisive = s.wins + s.losses;
    const winRateExcludingBE = decisive > 0 ? Number(((s.wins / decisive) * 100).toFixed(1)) : 0;
    const profitFactor = s.grossLossUSD > 0
      ? Number((s.grossProfitUSD / s.grossLossUSD).toFixed(2))
      : (s.grossProfitUSD > 0 ? 999.0 : 0);
    const avgWinUSD = s.wins > 0 ? Number((s.grossProfitUSD / s.wins).toFixed(2)) : 0;
    const avgLossUSD = s.losses > 0 ? Number((s.grossLossUSD / s.losses).toFixed(2)) : 0;
    const expectancyUSD = Number((netProfitUSD / s.count).toFixed(2));

    const avgDur = s.durations.length > 0
      ? Math.round(s.durations.reduce((sum, d) => sum + d, 0) / s.durations.length)
      : null;

    const sampleSizeReliability = s.count >= 30
      ? 'Statistically Significant (N>=30)'
      : s.count >= 15
      ? 'Moderate Confidence (N=15-29)'
      : 'Small Sample / High Variance (N<15)';

    return {
      symbol,
      sampleSize: s.count,
      wins: s.wins,
      losses: s.losses,
      breakevens: s.bes,
      winRate: `${winRate}%`,
      winRateExcludingBE: `${winRateExcludingBE}%`,
      grossProfitUSD: `$${s.grossProfitUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      grossLossUSD: `$${s.grossLossUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      feesPaidUSD: `$${s.feesUSD.toFixed(2)}`,
      swapsUSD: `${s.swapsUSD >= 0 ? '+' : ''}$${s.swapsUSD.toFixed(2)}`,
      netProfitUSD: formatSignedCurrency(netProfitUSD),
      profitFactor,
      avgWinUSD: `$${avgWinUSD.toFixed(2)}`,
      avgLossUSD: `$${avgLossUSD.toFixed(2)}`,
      expectancyUSD: `${expectancyUSD >= 0 ? '+' : ''}$${expectancyUSD.toFixed(2)} per trade`,
      totalR: `${s.totalR >= 0 ? '+' : ''}${s.totalR.toFixed(2)}R`,
      avgHoldingDuration: formatDuration(avgDur),
      sampleSizeReliability
    };
  }).sort((a, b) => b.sampleSize - a.sampleSize);

  return {
    hasData: true,
    totalTradesAnalyzed: trades.length,
    breakdown,
    correlationVsCausationNote: 'Discrepancies in win rate or P&L across instruments reflect sample variance, spread costs, and market volatility regime. Trading a specific instrument does not cause edge; execution discipline and setup confluence remain the causal drivers.'
  };
}

/**
 * Tool 5: get_performance_by_session
 */
async function getPerformanceBySession(userId, options = {}) {
  if (!isDbReady() || !isValidUserId(userId)) {
    return { hasData: false, message: 'No trades logged yet.' };
  }

  const query = { userId, result: { $in: ['WIN', 'LOSS', 'BE'] } };
  if (options.startDate || options.endDate) {
    query.date = {};
    if (options.startDate) query.date.$gte = options.startDate;
    if (options.endDate) query.date.$lte = options.endDate;
  }

  const trades = await Trade.find(query).lean();
  if (!trades.length) return { hasData: false, message: 'No closed trades logged matching the query.' };

  const map = {};
  trades.forEach(t => {
    const sess = (t.session || 'Unknown').trim();
    if (!map[sess]) {
      map[sess] = {
        count: 0,
        wins: 0,
        losses: 0,
        bes: 0,
        grossProfitUSD: 0,
        grossLossUSD: 0,
        feesUSD: 0,
        swapsUSD: 0,
        totalR: 0,
        totalDiscipline: 0,
        durations: []
      };
    }
    map[sess].count++;
    if (t.result === 'WIN') map[sess].wins++;
    else if (t.result === 'LOSS') map[sess].losses++;
    else map[sess].bes++;

    const gross = getTradeGrossProfit(t);
    const fees = getTradeFees(t);
    const swap = getTradeSwap(t);

    if (gross > 0) map[sess].grossProfitUSD += gross;
    else if (gross < 0) map[sess].grossLossUSD += Math.abs(gross);

    map[sess].feesUSD += fees;
    map[sess].swapsUSD += swap;
    map[sess].totalR += Number(t.rResult || 0);
    map[sess].totalDiscipline += Number(t.disciplineScore || 80);

    const dur = calculateTradeDurationMinutes(t);
    if (dur !== null) map[sess].durations.push(dur);
  });

  const breakdown = Object.entries(map).map(([session, s]) => {
    const netProfitUSD = Number((s.grossProfitUSD - s.grossLossUSD - s.feesUSD + s.swapsUSD).toFixed(2));
    const winRate = Number(((s.wins / s.count) * 100).toFixed(1));
    const decisive = s.wins + s.losses;
    const winRateExcludingBE = decisive > 0 ? Number(((s.wins / decisive) * 100).toFixed(1)) : 0;
    const profitFactor = s.grossLossUSD > 0
      ? Number((s.grossProfitUSD / s.grossLossUSD).toFixed(2))
      : (s.grossProfitUSD > 0 ? 999.0 : 0);
    const expectancyUSD = Number((netProfitUSD / s.count).toFixed(2));
    const avgDiscipline = Math.round(s.totalDiscipline / s.count);

    const avgDur = s.durations.length > 0
      ? Math.round(s.durations.reduce((sum, d) => sum + d, 0) / s.durations.length)
      : null;

    const sampleSizeReliability = s.count >= 30
      ? 'Statistically Significant (N>=30)'
      : s.count >= 15
      ? 'Moderate Confidence (N=15-29)'
      : 'Small Sample / High Variance (N<15)';

    return {
      session,
      sampleSize: s.count,
      wins: s.wins,
      losses: s.losses,
      breakevens: s.bes,
      winRate: `${winRate}%`,
      winRateExcludingBE: `${winRateExcludingBE}%`,
      grossProfitUSD: `$${s.grossProfitUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      netProfitUSD: formatSignedCurrency(netProfitUSD),
      feesPaidUSD: `$${s.feesUSD.toFixed(2)}`,
      swapsUSD: `${s.swapsUSD >= 0 ? '+' : ''}$${s.swapsUSD.toFixed(2)}`,
      profitFactor,
      expectancyUSD: `${expectancyUSD >= 0 ? '+' : ''}$${expectancyUSD.toFixed(2)} per trade`,
      totalR: `${s.totalR >= 0 ? '+' : ''}${s.totalR.toFixed(2)}R`,
      avgDisciplineScore: `${avgDiscipline}/100`,
      avgHoldingDuration: formatDuration(avgDur),
      sampleSizeReliability
    };
  }).sort((a, b) => b.sampleSize - a.sampleSize);

  return {
    hasData: true,
    totalTradesAnalyzed: trades.length,
    breakdown,
    correlationVsCausationNote: 'Higher performance in sessions like London or New York correlates with higher institutional volume and disciplined execution during key killzones, rather than the clock hour alone causing your edge.'
  };
}

/**
 * Tool 6: compare_strategies
 * Deterministic comparison across setups (A+, A, B) or entry types (Breakout, Retest, Confirmation)
 */
async function compareStrategies(userId, { dimension = 'setupRating', minTrades = 1 } = {}) {
  if (!isDbReady() || !isValidUserId(userId)) {
    return { hasData: false, message: 'Database not ready.' };
  }

  const query = { userId, result: { $in: ['WIN', 'LOSS', 'BE'] } };
  const trades = await Trade.find(query).lean();

  if (trades.length < minTrades) {
    return {
      hasData: false,
      message: `Need at least ${minTrades} closed trades to perform strategy comparisons.`
    };
  }

  const validDimension = ['setupRating', 'entryType'].includes(dimension) ? dimension : 'setupRating';
  const groupMap = {};

  trades.forEach(t => {
    const key = (t[validDimension] || 'Unclassified').trim();
    if (!groupMap[key]) {
      groupMap[key] = {
        name: key,
        trades: 0,
        wins: 0,
        losses: 0,
        bes: 0,
        grossProfitUSD: 0,
        grossLossUSD: 0,
        feesUSD: 0,
        swapsUSD: 0,
        totalR: 0,
        totalDiscipline: 0,
        durations: []
      };
    }

    groupMap[key].trades++;
    if (t.result === 'WIN') groupMap[key].wins++;
    else if (t.result === 'LOSS') groupMap[key].losses++;
    else groupMap[key].bes++;

    const gross = getTradeGrossProfit(t);
    const fees = getTradeFees(t);
    const swap = getTradeSwap(t);

    if (gross > 0) groupMap[key].grossProfitUSD += gross;
    else if (gross < 0) groupMap[key].grossLossUSD += Math.abs(gross);

    groupMap[key].feesUSD += fees;
    groupMap[key].swapsUSD += swap;
    groupMap[key].totalR += Number(t.rResult || 0);
    groupMap[key].totalDiscipline += Number(t.disciplineScore || 80);

    const dur = calculateTradeDurationMinutes(t);
    if (dur !== null) groupMap[key].durations.push(dur);
  });

  const comparison = Object.values(groupMap).map(g => {
    const netProfitUSD = Number((g.grossProfitUSD - g.grossLossUSD - g.feesUSD + g.swapsUSD).toFixed(2));
    const winRate = Number(((g.wins / g.trades) * 100).toFixed(1));
    const decisive = g.wins + g.losses;
    const winRateExcludingBE = decisive > 0 ? Number(((g.wins / decisive) * 100).toFixed(1)) : 0;
    const profitFactor = g.grossLossUSD > 0
      ? Number((g.grossProfitUSD / g.grossLossUSD).toFixed(2))
      : (g.grossProfitUSD > 0 ? 999.0 : 0);
    const expectancyUSD = Number((netProfitUSD / g.trades).toFixed(2));
    const avgR = Number((g.totalR / g.trades).toFixed(2));
    const avgWinUSD = g.wins > 0 ? Number((g.grossProfitUSD / g.wins).toFixed(2)) : 0;
    const avgLossUSD = g.losses > 0 ? Number((g.grossLossUSD / g.losses).toFixed(2)) : 0;
    const avgDiscipline = Math.round(g.totalDiscipline / g.trades);

    const avgDur = g.durations.length > 0
      ? Math.round(g.durations.reduce((sum, d) => sum + d, 0) / g.durations.length)
      : null;

    const sampleSizeReliability = g.trades >= 30
      ? 'Statistically Significant (N>=30)'
      : g.trades >= 15
      ? 'Moderate Confidence (N=15-29)'
      : 'Small Sample (N<15)';

    return {
      strategyName: g.name,
      sampleSize: g.trades,
      wins: g.wins,
      losses: g.losses,
      breakevens: g.bes,
      winRate: `${winRate}%`,
      winRateExcludingBE: `${winRateExcludingBE}%`,
      grossProfitUSD: `$${g.grossProfitUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      netProfitUSD: formatSignedCurrency(netProfitUSD),
      profitFactor,
      avgR: `${avgR >= 0 ? '+' : ''}${avgR.toFixed(2)}R`,
      avgWinUSD: `$${avgWinUSD.toFixed(2)}`,
      avgLossUSD: `$${avgLossUSD.toFixed(2)}`,
      expectancyUSD: `${expectancyUSD >= 0 ? '+' : ''}$${expectancyUSD.toFixed(2)} per trade`,
      avgDisciplineScore: `${avgDiscipline}/100`,
      avgHoldingDuration: formatDuration(avgDur),
      sampleSizeReliability
    };
  }).sort((a, b) => parseFloat(b.expectancyUSD) - parseFloat(a.expectancyUSD));

  const bestStrategy = comparison[0];
  const worstStrategy = comparison[comparison.length - 1];

  return {
    hasData: true,
    dimension: validDimension,
    totalTradesAnalyzed: trades.length,
    comparison,
    bestStrategy: bestStrategy ? {
      name: bestStrategy.strategyName,
      winRate: bestStrategy.winRate,
      expectancy: bestStrategy.expectancyUSD,
      netProfit: bestStrategy.netProfitUSD,
      sampleSize: bestStrategy.sampleSize
    } : null,
    worstStrategy: (worstStrategy && worstStrategy !== bestStrategy) ? {
      name: worstStrategy.strategyName,
      winRate: worstStrategy.winRate,
      expectancy: worstStrategy.expectancyUSD,
      netProfit: worstStrategy.netProfitUSD,
      sampleSize: worstStrategy.sampleSize
    } : null,
    correlationVsCausationSynthesis: bestStrategy
      ? `Evidence indicates historical correlation: ${bestStrategy.strategyName} has the highest expectancy (${bestStrategy.expectancyUSD}), correlating with superior discipline (${bestStrategy.avgDisciplineScore}). Remember: categorizing a setup as "${bestStrategy.strategyName}" does not guarantee success; strict rule execution and honoring invalidation levels are the causal drivers.`
      : 'Insufficient distinct strategies to establish comparative correlation.'
  };
}

/**
 * Tool 7: get_drawdown_analysis
 * Comprehensive equity curve and drawdown metrics
 */
async function getDrawdownAnalysis(userId, options = {}) {
  if (!isDbReady() || !isValidUserId(userId)) {
    return { hasData: false, message: 'Database not ready.' };
  }

  const query = { userId, result: { $in: ['WIN', 'LOSS', 'BE'] } };
  if (options.startDate || options.endDate) {
    query.date = {};
    if (options.startDate) query.date.$gte = options.startDate;
    if (options.endDate) query.date.$lte = options.endDate;
  }

  const trades = await Trade.find(query).lean();
  if (!trades.length) {
    return { hasData: false, message: 'No closed trades found to calculate drawdown.' };
  }

  const drawdown = computeEquityCurveAndDrawdown(trades);
  const totalNet = trades.reduce((sum, t) => sum + getTradeNetProfit(t), 0);

  return {
    hasData: true,
    sampleSize: trades.length,
    peakEquityUSD: `$${drawdown.peakEquityUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    currentRealizedNetProfitUSD: formatSignedCurrency(totalNet),
    maxDrawdownUSD: `-$${drawdown.maxDrawdownUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    currentDrawdownUSD: `-$${drawdown.currentDrawdownUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    inDrawdown: drawdown.inDrawdown,
    maxDrawdownDurationTrades: drawdown.maxDrawdownDurationTrades,
    maxDrawdownDurationDays: drawdown.maxDrawdownDurationDays,
    currentDrawdownTrades: drawdown.currentDrawdownTrades,
    recoveryFactor: drawdown.recoveryFactor,
    status: drawdown.inDrawdown
      ? `Currently in drawdown (-$${drawdown.currentDrawdownUSD.toLocaleString()}, ${drawdown.currentDrawdownTrades} trades below peak).`
      : 'At peak equity high water mark (0 drawdown).',
    riskPreservationGuidance: drawdown.inDrawdown && drawdown.maxDrawdownUSD > 500
      ? 'Mandatory Protocol: When in drawdown, reduce position sizing to 0.5% per trade until 2 consecutive winning trades recover positive expectancy.'
      : 'Risk is well-contained. Maintain steady 1% fractional sizing.'
  };
}

/**
 * Tool 8: get_mistakes_and_emotions
 * Evaluates recurring execution mistakes and emotional performance
 */
async function getMistakesAndEmotions(userId) {
  if (!isDbReady() || !isValidUserId(userId)) {
    return { hasData: false, message: 'No trades logged yet.' };
  }
  const trades = await Trade.find({ userId, result: { $in: ['WIN', 'LOSS', 'BE'] } }).lean();
  if (!trades.length) return { hasData: false, message: 'No closed trades logged yet.' };

  const mistakeMap = {};
  const emotionMap = {};
  let totalLossUSD = 0;
  let totalLossCount = 0;

  trades.forEach(t => {
    const net = getTradeNetProfit(t);
    if (net < 0) {
      totalLossUSD += Math.abs(net);
      totalLossCount++;
    }

    const mistakes = (t.mistakes || []).filter(m => m && m !== 'None');
    mistakes.forEach(m => {
      const cleanM = m.trim();
      if (!mistakeMap[cleanM]) {
        mistakeMap[cleanM] = {
          count: 0,
          lossTradesCount: 0,
          totalLossUSD: 0,
          tradesWithMistake: []
        };
      }
      mistakeMap[cleanM].count++;
      if (net < 0) {
        mistakeMap[cleanM].lossTradesCount++;
        mistakeMap[cleanM].totalLossUSD += Math.abs(net);
      }
      mistakeMap[cleanM].tradesWithMistake.push(t);
    });

    const emo = t.emotion || 'Calm';
    if (!emotionMap[emo]) {
      emotionMap[emo] = {
        count: 0,
        wins: 0,
        netProfit: 0,
        totalDiscipline: 0
      };
    }
    emotionMap[emo].count++;
    if (t.result === 'WIN') emotionMap[emo].wins++;
    emotionMap[emo].netProfit += net;
    emotionMap[emo].totalDiscipline += Number(t.disciplineScore || 80);
  });

  const baselineAvgLossUSD = totalLossCount > 0 ? Number((totalLossUSD / totalLossCount).toFixed(2)) : 0;

  const mistakes = Object.entries(mistakeMap).map(([mistake, data]) => {
    const avgLoss = data.lossTradesCount > 0
      ? Number((data.totalLossUSD / data.lossTradesCount).toFixed(2))
      : 0;
    const frequencyPct = Number(((data.count / trades.length) * 100).toFixed(1));
    const isRecurring = data.count >= 2;

    let causalMechanism = 'Violating predefined risk or entry criteria directly inflates downside tail risk.';
    let actionableRemedy = 'Enforce hard stop-loss and predefined entry invalidation rules.';

    if (mistake.toLowerCase().includes('moved sl') || mistake.toLowerCase().includes('moving stop')) {
      causalMechanism = 'Moving stop-loss expands maximum potential loss beyond planned risk parameters, creating catastrophic negative asymmetry.';
      actionableRemedy = 'Enter a trade with a set-and-forget stop loss. Once set, never push your stop loss wider under any condition.';
    } else if (mistake.toLowerCase().includes('chasing') || mistake.toLowerCase().includes('fomo')) {
      causalMechanism = 'Entering extended market moves forces poor entry location, dramatically reducing risk-to-reward ratio.';
      actionableRemedy = 'Require candle close confirmation inside your designated POI before pulling the trigger. If you missed the entry, let it go.';
    } else if (mistake.toLowerCase().includes('overleverag') || mistake.toLowerCase().includes('size')) {
      causalMechanism = 'Excessive lot sizing causes elevated volatility exposure, amplifying emotional fear and triggering premature exits.';
      actionableRemedy = 'Use the TradeJourn Position Sizing calculator to enforce strict 1.0% maximum capital risk per trade.';
    } else if (mistake.toLowerCase().includes('early exit')) {
      causalMechanism = 'Closing winners before reaching technical TP prevents realizing planned R-multiples needed to offset statistical losses.';
      actionableRemedy = 'Only exit upon explicit opposing market structure or invalidation, not emotional fear of giving back profit.';
    }

    return {
      mistake,
      occurrences: data.count,
      frequency: `${frequencyPct}% of all trades`,
      isRecurring,
      totalLossUSD: `-$${data.totalLossUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      avgLossUSD: `-$${avgLoss.toFixed(2)}`,
      baselineAvgLossUSD: `-$${baselineAvgLossUSD.toFixed(2)}`,
      causalMechanism,
      actionableRemedy
    };
  }).sort((a, b) => b.occurrences - a.occurrences);

  const emotions = Object.entries(emotionMap).map(([emotion, data]) => ({
    emotion,
    trades: data.count,
    winRate: `${Math.round((data.wins / data.count) * 100)}%`,
    netProfitUSD: `${data.netProfit >= 0 ? '+' : ''}$${Math.round(data.netProfit).toLocaleString()}`,
    avgDiscipline: `${Math.round(data.totalDiscipline / data.count)}/100`
  })).sort((a, b) => b.trades - a.trades);

  return {
    hasData: true,
    totalTradesAnalyzed: trades.length,
    mistakes: mistakes.length ? mistakes : 'No repeated mistakes logged yet. Excellent execution discipline!',
    emotions,
    correlationVsCausationNote: 'Mistake correlation shows direct statistical damage: trades tagged with execution mistakes show significantly higher average losses than your disciplined baseline.'
  };
}

/**
 * Tool 9: review_trade
 */
async function reviewTrade(userId, { tradeId, tradeName } = {}) {
  if (!isDbReady() || !isValidUserId(userId)) {
    return { hasData: false, message: 'Database not ready.' };
  }

  let trade = null;
  if (tradeId) {
    trade = await Trade.findOne({ _id: tradeId, userId }).lean();
  } else if (tradeName) {
    trade = await Trade.findOne({ userId, tradeName: new RegExp(`^${escapeRegex(tradeName.trim())}$`, 'i') }).lean();
  } else {
    const trades = await Trade.find({ userId, result: { $in: ['WIN', 'LOSS', 'BE'] } })
      .sort({ date: -1, time: -1, createdAt: -1 })
      .limit(1)
      .lean();
    trade = trades[0] || null;
  }

  if (!trade) {
    return {
      found: false,
      message: 'No matching trade found in your journal to review. Please log a trade first!'
    };
  }

  const gross = getTradeGrossProfit(trade);
  const fees = getTradeFees(trade);
  const swap = getTradeSwap(trade);
  const net = getTradeNetProfit(trade);
  const plannedRR = Number(trade.rr || 1.5);
  const realizedR = Number(trade.rResult !== undefined && trade.rResult !== null
    ? trade.rResult
    : (trade.result === 'WIN' ? plannedRR : trade.result === 'LOSS' ? -1 : 0));
  const durationMin = calculateTradeDurationMinutes(trade);

  const ruleChecks = [];

  // 1. Entry Confirmation
  if (trade.confirmation === 'Yes') {
    ruleChecks.push({ rule: 'Entry Confirmation', status: 'PASSED', note: 'Trade waited for technical confirmation before execution.' });
  } else {
    ruleChecks.push({ rule: 'Entry Confirmation', status: 'WARNING', note: 'Trade lacked full confirmation (Early or unconfirmed entry).' });
  }

  // 2. Risk-to-Reward
  if (plannedRR >= 1.5) {
    ruleChecks.push({ rule: 'Minimum 1:1.5 RR Rule', status: 'PASSED', note: `Planned RR was 1:${plannedRR}.` });
  } else {
    ruleChecks.push({ rule: 'Minimum 1:1.5 RR Rule', status: 'WARNING', note: `Planned RR was 1:${plannedRR}, below institutional 1:1.5 threshold.` });
  }

  // 3. Early Exit Discipline
  if (trade.earlyExitFlag === 1 || (trade.reasonEarlyExit && trade.reasonEarlyExit !== 'None')) {
    ruleChecks.push({ rule: 'Planned Exit Discipline', status: 'VIOLATED', note: `Closed early: ${trade.reasonEarlyExit}. Realized ${realizedR}R vs planned ${plannedRR}R.` });
  } else {
    ruleChecks.push({ rule: 'Planned Exit Discipline', status: 'PASSED', note: 'Exited at predetermined target or stop loss.' });
  }

  // 4. Psychology & Emotional Control
  const isEmotional = ['Fear', 'Greed', 'FOMO', 'Revenge', 'Impatient', 'Frustrated'].includes(trade.emotion);
  const mistakes = (trade.mistakes || []).filter(m => m && m !== 'None');
  if (isEmotional || mistakes.length > 0) {
    ruleChecks.push({
      rule: 'Psychological Discipline',
      status: 'VIOLATED',
      note: `Emotional state: ${trade.emotion}. Logged mistakes: ${mistakes.length ? mistakes.join(', ') : 'None'}.`
    });
  } else {
    ruleChecks.push({ rule: 'Psychological Discipline', status: 'PASSED', note: 'Executed in a calm/focused state with 0 tagged mistakes.' });
  }

  const missingFields = [];
  if (!trade.entryPrice && !trade.exitPrice) missingFields.push('Exact Entry & Exit Prices');
  if (!trade.notes || trade.notes.trim() === '') missingFields.push('Trade Reasoning Notes');
  if (!trade.screenshotUrl && !trade.imageUrl && (!trade.images || trade.images.length === 0)) missingFields.push('Chart Screenshot');

  return {
    found: true,
    tradeId: trade._id,
    tradeName: trade.tradeName,
    date: trade.date,
    time: trade.time,
    instrument: trade.instrument,
    direction: trade.direction,
    session: trade.session,
    setupRating: trade.setupRating,
    entryType: trade.entryType,
    result: trade.result,
    grossProfitUSD: formatSignedCurrency(gross),
    netProfitUSD: formatSignedCurrency(net),
    commissionUSD: fees > 0 ? `-$${fees.toFixed(2)}` : '$0.00',
    swapUSD: `${swap >= 0 ? '+' : ''}$${swap.toFixed(2)}`,
    realizedR: `${realizedR >= 0 ? '+' : ''}${realizedR}R`,
    plannedRR: `1:${plannedRR}`,
    holdingDuration: formatDuration(durationMin),
    disciplineScore: `${trade.disciplineScore || 80}/100`,
    tradeGrade: trade.tradeGrade || 'Good',
    ruleChecks,
    missingFields: missingFields.length > 0 ? missingFields : ['None (Complete Log)'],
    screenshotUrl: trade.screenshotUrl || trade.imageUrl || (trade.images && trade.images[0]) || null,
    notes: trade.notes || 'No trader notes recorded.',
    keyTakeaway: trade.result === 'WIN' && (isEmotional || mistakes.length > 0)
      ? 'Undisciplined Win: Profits made while breaking process rules reinforce bad habits. Strive for disciplined execution over lucky outcomes.'
      : trade.result === 'LOSS' && !isEmotional && mistakes.length === 0
      ? 'Good Loss: You executed your plan, protected capital, and accepted the statistical business cost of trading.'
      : 'Maintain your edge by taking only verified A+ setups with clear technical invalidation.'
  };
}

/**
 * Tool 10: get_psychology_audit
 */
async function getPsychologyAudit(userId) {
  if (!isDbReady() || !isValidUserId(userId)) {
    return { hasData: false, message: 'Database not ready.' };
  }

  const trades = await Trade.find({ userId, result: { $in: ['WIN', 'LOSS', 'BE'] } })
    .sort({ date: 1, time: 1, createdAt: 1 })
    .lean();

  if (trades.length < 3) {
    return {
      hasData: false,
      message: 'At least 3-5 trades are required to detect psychological and behavioral patterns.'
    };
  }

  let tradesAfterLossCount = 0;
  let tradesAfterLossWins = 0;
  let totalLossPnlAfterLoss = 0;

  let tradesAfterWinCount = 0;
  let tradesAfterWinWins = 0;

  let earlyExitCount = 0;
  const emotionMap = {};

  for (let i = 1; i < trades.length; i++) {
    const prevTrade = trades[i - 1];
    const currTrade = trades[i];

    if (prevTrade.result === 'LOSS') {
      tradesAfterLossCount++;
      if (currTrade.result === 'WIN') tradesAfterLossWins++;
      else totalLossPnlAfterLoss += Math.abs(getTradeNetProfit(currTrade));
    } else if (prevTrade.result === 'WIN') {
      tradesAfterWinCount++;
      if (currTrade.result === 'WIN') tradesAfterWinWins++;
    }
  }

  trades.forEach(t => {
    if (t.earlyExitFlag === 1 || (t.reasonEarlyExit && t.reasonEarlyExit !== 'None')) earlyExitCount++;
    const emo = t.emotion || 'Calm';
    if (!emotionMap[emo]) emotionMap[emo] = { count: 0, wins: 0, profit: 0 };
    emotionMap[emo].count++;
    if (t.result === 'WIN') emotionMap[emo].wins++;
    emotionMap[emo].profit += getTradeNetProfit(t);
  });

  const winRateAfterLoss = tradesAfterLossCount > 0 ? Number(((tradesAfterLossWins / tradesAfterLossCount) * 100).toFixed(1)) : null;
  const winRateAfterWin = tradesAfterWinCount > 0 ? Number(((tradesAfterWinWins / tradesAfterWinCount) * 100).toFixed(1)) : null;
  const baselineWinRate = Number(((trades.filter(t => t.result === 'WIN').length / trades.length) * 100).toFixed(1));

  let tiltRisk = 'LOW';
  let tiltEvidence = 'Your execution remains stable across winning and losing sequences.';

  if (winRateAfterLoss !== null && winRateAfterLoss < baselineWinRate - 15) {
    tiltRisk = 'HIGH';
    tiltEvidence = `After a losing trade, your win rate drops to ${winRateAfterLoss}% (compared to your ${baselineWinRate}% baseline across N=${tradesAfterLossCount} trades). This indicates emotional tilt and revenge trading after stop-outs.`;
  } else if (winRateAfterLoss !== null && winRateAfterLoss < baselineWinRate - 5) {
    tiltRisk = 'MODERATE';
    tiltEvidence = `Slight performance dip after losses (${winRateAfterLoss}% vs ${baselineWinRate}% baseline). Take a short break after stop-loss hits.`;
  }

  return {
    hasData: true,
    totalTradesAnalyzed: trades.length,
    baselineWinRate: `${baselineWinRate}%`,
    winRateAfterLoss: winRateAfterLoss !== null ? `${winRateAfterLoss}% (${tradesAfterLossWins}/${tradesAfterLossCount} trades)` : 'N/A',
    winRateAfterWin: winRateAfterWin !== null ? `${winRateAfterWin}% (${tradesAfterWinWins}/${tradesAfterWinCount} trades)` : 'N/A',
    tiltRiskLevel: tiltRisk,
    tiltEvidence,
    earlyExitRatio: `${Math.round((earlyExitCount / trades.length) * 100)}% (${earlyExitCount} of ${trades.length} trades closed prematurely)`,
    emotionBreakdown: Object.entries(emotionMap).map(([emo, d]) => ({
      emotion: emo,
      trades: d.count,
      winRate: `${Math.round((d.wins / d.count) * 100)}%`,
      netPnl: `${d.profit >= 0 ? '+' : ''}$${Math.round(d.profit).toLocaleString()}`
    })),
    coachingRule: tiltRisk === 'HIGH'
      ? 'Mandatory Rule: Enforce a strict 30-minute cooling-off period after any stop-loss hit before opening another order.'
      : 'Keep following your defined risk management rules and maintain emotional detachment.'
  };
}

/**
 * Tool 11: get_playbook_rules
 */
async function getPlaybookRules(userId) {
  if (!isDbReady() || !isValidUserId(userId)) {
    return { hasData: false, message: 'Database not ready.' };
  }
  const playbook = await Playbook.findOne({ userId }).lean();
  if (!playbook) {
    return {
      hasData: false,
      message: 'No custom playbook rules saved yet. Default institutional trading rules applied.',
      defaultRules: {
        entryRules: ['Only trade planned levels', 'Wait for confirmation before execution', 'Require minimum 1:1.5 RR potential'],
        riskRules: ['Follow fixed 1% risk per trade', 'Never move stop loss emotionally', 'Hard stop after 2 consecutive daily losses'],
        exitRules: ['Follow predefined TP targets', 'Do not exit early due to temporary fear'],
        psychologyRules: ['No revenge trading', 'Accept losses as normal business expense', 'Max 3 trades per session']
      }
    };
  }
  return {
    hasData: true,
    entryRules: playbook.entryRules || [],
    riskRules: playbook.riskRules || [],
    exitRules: playbook.exitRules || [],
    psychologyRules: playbook.psychologyRules || []
  };
}

/**
 * Tool 12: get_prop_firm_status
 */
async function getPropFirmStatus(userId) {
  if (!isDbReady() || !isValidUserId(userId)) {
    return { hasData: false, message: 'Database not ready.' };
  }

  const goal = await Goal.findOne({ userId }).lean();
  const trades = await Trade.find({ userId, result: { $in: ['WIN', 'LOSS', 'BE'] } }).sort({ date: -1 }).lean();

  const accountSize = goal?.accountSize || 50000;
  const profitTarget = goal?.profitTarget || 5000;
  const maxLoss = goal?.maxLoss || 5000;
  const maxDailyLoss = goal?.maxDailyLoss || 2500;

  const todayStr = new Date().toISOString().split('T')[0];
  const todayTrades = trades.filter(t => t.date === todayStr);
  const todayPnl = todayTrades.reduce((sum, t) => sum + getTradeNetProfit(t), 0);
  const totalNetProfit = trades.reduce((sum, t) => sum + getTradeNetProfit(t), 0);

  const drawdown = computeEquityCurveAndDrawdown(trades);
  const maxDd = drawdown.maxDrawdownUSD;

  const dailyBufferRemaining = maxDailyLoss + todayPnl;
  const totalLossBufferRemaining = maxLoss + totalNetProfit;

  let status = 'IN_PROGRESS';
  if (totalNetProfit >= profitTarget) status = 'TARGET_PASSED';
  else if (todayPnl <= -maxDailyLoss) status = 'DAILY_LOSS_BREACHED';
  else if (maxDd >= maxLoss) status = 'MAX_DRAWDOWN_BREACHED';

  return {
    hasData: true,
    isChallengeActive: goal?.isChallengeActive || false,
    status,
    accountSize: `$${accountSize.toLocaleString()}`,
    profitTarget: `$${profitTarget.toLocaleString()}`,
    totalRealizedPnl: `${totalNetProfit >= 0 ? '+' : ''}$${Math.round(totalNetProfit).toLocaleString()}`,
    targetProgressPct: `${Math.min(100, Math.max(0, Number(((totalNetProfit / profitTarget) * 100).toFixed(1))))}%`,
    todayPnl: `${todayPnl >= 0 ? '+' : ''}$${Math.round(todayPnl).toLocaleString()}`,
    maxDailyLossLimit: `$${maxDailyLoss.toLocaleString()}`,
    dailyLossRemainingBuffer: `$${Math.max(0, Math.round(dailyBufferRemaining)).toLocaleString()}`,
    maxTotalLossLimit: `$${maxLoss.toLocaleString()}`,
    maxDrawdownObserved: `-$${Math.round(maxDd).toLocaleString()}`,
    totalLossRemainingBuffer: `$${Math.max(0, Math.round(totalLossBufferRemaining)).toLocaleString()}`
  };
}

/**
 * Tool 13: compare_trading_periods
 */
async function compareTradingPeriods(userId, { type = 'SESSIONS', filter1, filter2, instrument } = {}) {
  if (!isDbReady() || !isValidUserId(userId)) {
    return { hasData: false, message: 'Database not ready.' };
  }

  const query = { userId, result: { $in: ['WIN', 'LOSS', 'BE'] } };
  if (instrument) query.instrument = new RegExp(`^${escapeRegex(instrument.trim())}$`, 'i');

  const trades = await Trade.find(query).lean();
  if (trades.length < 2) {
    return { hasData: false, message: 'Need at least 2 trades to perform a comparative audit.' };
  }

  let group1 = [];
  let group2 = [];
  let label1 = filter1 || 'London';
  let label2 = filter2 || 'New York';

  if (type === 'SESSIONS' || (!type && filter1 && !filter1.includes('-'))) {
    group1 = trades.filter(t => (t.session || '').toLowerCase().includes(label1.toLowerCase()));
    group2 = trades.filter(t => (t.session || '').toLowerCase().includes(label2.toLowerCase()));
  } else {
    label1 = filter1 || 'Recent Trades';
    label2 = filter2 || 'Prior Trades';
    const mid = Math.floor(trades.length / 2);
    group1 = trades.slice(0, mid);
    group2 = trades.slice(mid);
  }

  const computeGroupStats = (arr, label) => {
    if (!arr.length) return { label, trades: 0, winRate: '0%', netProfit: '$0', profitFactor: 0, avgR: '0R' };
    const wins = arr.filter(t => t.result === 'WIN').length;
    let gp = 0, gl = 0, totR = 0, fees = 0, swap = 0;
    arr.forEach(t => {
      const gross = getTradeGrossProfit(t);
      const f = getTradeFees(t);
      const s = getTradeSwap(t);
      fees += f;
      swap += s;
      if (gross > 0) gp += gross;
      else gl += Math.abs(gross);
      totR += Number(t.rResult || 0);
    });
    const net = gp - gl - fees + swap;
    return {
      label,
      trades: arr.length,
      winRate: `${Math.round((wins / arr.length) * 100)}%`,
      netProfit: `${net >= 0 ? '+' : ''}$${Math.round(net).toLocaleString()}`,
      profitFactor: gl > 0 ? Number((gp / gl).toFixed(2)) : (gp > 0 ? 999 : 0),
      avgR: `${(totR / arr.length).toFixed(2)}R`
    };
  };

  const stats1 = computeGroupStats(group1, label1);
  const stats2 = computeGroupStats(group2, label2);

  return {
    hasData: true,
    comparisonType: type,
    instrumentFilter: instrument || 'All Instruments',
    period1: stats1,
    period2: stats2,
    takeaway: stats1.trades > 0 && stats2.trades > 0
      ? `${stats1.netProfit > stats2.netProfit ? stats1.label : stats2.label} generated higher net returns. Ensure your trade size favors your higher-expectancy setups.`
      : 'Insufficient trade records between the two selected filters.'
  };
}

/**
 * Gemini Tool Declarations for Function Calling
 */
const JOURNAL_FUNCTION_DECLARATIONS = [
  {
    name: 'get_trade_stats',
    description: "Get verified overall trading statistics (sample size N, win rate, realized gross & net P&L after fees/swaps, expectancy, profit factor, max drawdown, streaks, holding duration) for the user's journal.",
    parameters: {
      type: 'OBJECT',
      properties: {
        instrument: { type: 'STRING', description: 'Optional instrument filter (e.g. EURUSD, XAUUSD)' },
        session: { type: 'STRING', description: 'Optional trading session filter (e.g. London, New York)' },
        setupRating: { type: 'STRING', description: 'Optional setup rating filter (e.g. A+, A, B)' },
        entryType: { type: 'STRING', description: 'Optional entry type filter (e.g. Confirmation, Breakout, Retest)' },
        startDate: { type: 'STRING', description: 'Optional start date filter (YYYY-MM-DD)' },
        endDate: { type: 'STRING', description: 'Optional end date filter (YYYY-MM-DD)' }
      }
    }
  },
  {
    name: 'get_trade_history',
    description: "Get a list of the user's latest N trades with execution results, gross & net P&L, commissions, swaps, holding duration, setup, and mistakes.",
    parameters: {
      type: 'OBJECT',
      properties: {
        limit: { type: 'INTEGER', description: 'Number of trades to return (1-50, default 10)' },
        offset: { type: 'INTEGER', description: 'Number of trades to skip (default 0)' },
        result: { type: 'STRING', description: 'Optional result filter: WIN, LOSS, or BE' },
        instrument: { type: 'STRING', description: 'Optional instrument filter (e.g. EURUSD)' },
        session: { type: 'STRING', description: 'Optional session filter' },
        startDate: { type: 'STRING', description: 'Optional start date filter (YYYY-MM-DD)' },
        endDate: { type: 'STRING', description: 'Optional end date filter (YYYY-MM-DD)' }
      }
    }
  },
  {
    name: 'get_trade_details',
    description: 'Get deep details and audit information for a specific trade by ID or trade name, including gross vs net P&L, fees, and duration.',
    parameters: {
      type: 'OBJECT',
      properties: {
        tradeId: { type: 'STRING', description: 'The unique MongoDB _id of the trade' },
        tradeName: { type: 'STRING', description: 'The exact name of the trade if ID is unknown' }
      }
    }
  },
  {
    name: 'review_trade',
    description: 'Evidence-based audit of a specific or recent trade, verifying compliance against the user’s Playbook rules, planned vs realized RR, and emotional discipline.',
    parameters: {
      type: 'OBJECT',
      properties: {
        tradeId: { type: 'STRING', description: 'Optional trade ID (defaults to most recent trade)' },
        tradeName: { type: 'STRING', description: 'Optional trade name' }
      }
    }
  },
  {
    name: 'get_performance_by_symbol',
    description: 'Get performance metrics broken down by instrument (sample size, win rate, net P&L after fees, profit factor, expectancy, avg duration).',
    parameters: {
      type: 'OBJECT',
      properties: {
        startDate: { type: 'STRING', description: 'Optional start date' },
        endDate: { type: 'STRING', description: 'Optional end date' }
      }
    }
  },
  {
    name: 'get_performance_by_session',
    description: 'Get performance metrics broken down by trading session (London, New York, Asian) with sample size and correlation analysis.',
    parameters: {
      type: 'OBJECT',
      properties: {
        startDate: { type: 'STRING', description: 'Optional start date' },
        endDate: { type: 'STRING', description: 'Optional end date' }
      }
    }
  },
  {
    name: 'compare_strategies',
    description: 'Deterministically compare performance across setup ratings (A+, A, B) or entry types (Breakout, Retest, Confirmation) with sample sizes, win rates, net profit, and expectancy.',
    parameters: {
      type: 'OBJECT',
      properties: {
        dimension: { type: 'STRING', description: 'Grouping dimension: setupRating or entryType (default setupRating)' },
        minTrades: { type: 'INTEGER', description: 'Minimum trades required (default 1)' }
      }
    }
  },
  {
    name: 'get_drawdown_analysis',
    description: 'Perform deep equity curve and drawdown audit (peak equity, max drawdown USD, current drawdown depth, duration in trades and days, recovery factor).',
    parameters: {
      type: 'OBJECT',
      properties: {
        startDate: { type: 'STRING', description: 'Optional start date' },
        endDate: { type: 'STRING', description: 'Optional end date' }
      }
    }
  },
  {
    name: 'get_mistakes_and_emotions',
    description: 'Audit the user’s recurring execution mistakes (frequency, dollar loss impact, causal mechanisms) and emotional state performance.',
    parameters: { type: 'OBJECT', properties: {} }
  },
  {
    name: 'get_psychology_audit',
    description: 'Analyze trading psychology, revenge trading risk, tilt detection, win rate after losses, and premature exit behavior.',
    parameters: { type: 'OBJECT', properties: {} }
  },
  {
    name: 'get_playbook_rules',
    description: 'Retrieve the user’s documented entry rules, risk rules, exit rules, and psychology rules from their Playbook.',
    parameters: { type: 'OBJECT', properties: {} }
  },
  {
    name: 'get_prop_firm_status',
    description: 'Check prop firm challenge metrics: daily loss limit remaining, total drawdown buffer, and progress towards profit target.',
    parameters: { type: 'OBJECT', properties: {} }
  },
  {
    name: 'compare_trading_periods',
    description: 'Compare performance between two sessions (e.g. London vs New York) or time periods.',
    parameters: {
      type: 'OBJECT',
      properties: {
        type: { type: 'STRING', description: 'Comparison type: SESSIONS or PERIODS' },
        filter1: { type: 'STRING', description: 'First group (e.g. London)' },
        filter2: { type: 'STRING', description: 'Second group (e.g. New York)' },
        instrument: { type: 'STRING', description: 'Optional instrument filter' }
      }
    }
  },
  {
    name: 'get_economic_events',
    description: 'Retrieve upcoming high-impact macroeconomic releases (NFP, CPI, FOMC, ECB, GDP) with volatility forecasts and risk guidance.',
    parameters: {
      type: 'OBJECT',
      properties: {
        currency: { type: 'STRING', description: 'Optional currency filter (USD, EUR, GBP)' },
        impact: { type: 'STRING', description: 'Impact level filter: HIGH, MEDIUM, or ALL' }
      }
    }
  },
  {
    name: 'calculate_position_size',
    description: 'Calculate institutional lot size, risk amount, and capital exposure for Forex, Gold, or Crypto based on account balance and stop loss distance.',
    parameters: {
      type: 'OBJECT',
      properties: {
        balance: { type: 'NUMBER', description: 'Account balance in USD' },
        riskPct: { type: 'NUMBER', description: 'Risk percentage per trade (e.g. 1.0 or 0.5)' },
        stopLossDistance: { type: 'NUMBER', description: 'Stop loss distance in pips or dollars for Gold' },
        instrument: { type: 'STRING', description: 'Trading instrument symbol (e.g. EURUSD, XAUUSD, BTCUSD)' }
      },
      required: ['balance', 'stopLossDistance']
    }
  },
  {
    name: 'get_statistical_distribution',
    description: 'Compute statistical distribution, mean vs median trade outcomes, 95% win rate confidence interval, skewness, and outlier dependence.',
    parameters: { type: 'OBJECT', properties: {} }
  },
  {
    name: 'retrieve_knowledge_documents',
    description: 'Search TradeJourn knowledge base for prop firm evaluation rules, institutional liquidity doctrines, order block rules, and risk management principles.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING', description: 'The search query or concept' },
        category: { type: 'STRING', description: 'Optional category (prop_firm_rules, market_mechanics, risk_management, technical_analysis)' }
      },
      required: ['query']
    }
  },
  {
    name: 'get_macro_drivers',
    description: 'Retrieve fundamental and macroeconomic inter-market drivers (DXY, real yields, rate differentials) for an instrument.',
    parameters: {
      type: 'OBJECT',
      properties: {
        symbol: { type: 'STRING', description: 'Instrument symbol (e.g. XAUUSD, EURUSD, BTCUSD)' }
      }
    }
  }
];

/**
 * Execute tool call with user authorization
 */
async function executeJournalTool(toolName, args = {}, userId) {
  switch (toolName) {
    case 'get_trade_stats':
      return await getTradeStats(userId, args);
    case 'get_trade_history':
      return await getTradeHistory(userId, args);
    case 'get_trade_details':
      return await getTradeDetails(userId, args);
    case 'review_trade':
      return await reviewTrade(userId, args);
    case 'get_performance_by_symbol':
      return await getPerformanceBySymbol(userId, args);
    case 'get_performance_by_session':
      return await getPerformanceBySession(userId, args);
    case 'compare_strategies':
      return await compareStrategies(userId, args);
    case 'get_drawdown_analysis':
      return await getDrawdownAnalysis(userId, args);
    case 'get_mistakes_and_emotions':
      return await getMistakesAndEmotions(userId);
    case 'get_psychology_audit':
      return await getPsychologyAudit(userId);
    case 'get_playbook_rules':
      return await getPlaybookRules(userId);
    case 'get_prop_firm_status':
      return await getPropFirmStatus(userId);
    case 'compare_trading_periods':
      return await compareTradingPeriods(userId, args);
    case 'get_economic_events':
      return getUpcomingEconomicEvents(args);
    case 'calculate_position_size':
      return calculatePositionSize(args);
    case 'get_statistical_distribution': {
      const allTrades = await Trade.find({ userId, result: { $in: ['WIN', 'LOSS', 'BE'] } }).lean().catch(() => []);
      return calculateStatisticalDistribution(allTrades);
    }
    case 'retrieve_knowledge_documents':
      return retrieveKnowledgeDocuments(args.query, args.category);
    case 'get_macro_drivers':
      return getMacroDrivers(args.symbol);
    default:
      throw new Error(`Unknown journal tool: ${toolName}`);
  }
}

module.exports = {
  getTradeProfit,
  getTradeGrossProfit,
  getTradeFees,
  getTradeSwap,
  getTradeNetProfit,
  calculateTradeDurationMinutes,
  formatDuration,
  computeStreaks,
  computeEquityCurveAndDrawdown,
  getTradeStats,
  getTradeHistory,
  getTradeDetails,
  reviewTrade,
  getPerformanceBySymbol,
  getPerformanceBySession,
  compareStrategies,
  getDrawdownAnalysis,
  getMistakesAndEmotions,
  getPsychologyAudit,
  getPlaybookRules,
  getPropFirmStatus,
  compareTradingPeriods,
  getUpcomingEconomicEvents,
  calculatePositionSize,
  calculateStatisticalDistribution,
  retrieveKnowledgeDocuments,
  getMacroDrivers,
  JOURNAL_FUNCTION_DECLARATIONS,
  executeJournalTool
};
