/**
 * TradeJourn Journal Intelligence Tools
 * =====================================
 * Verified, deterministic financial analytics and database tools.
 * All queries are strictly isolated to the authenticated user (userId).
 */

const mongoose = require('mongoose');
const Trade = require('../../models/Trade');
const Playbook = require('../../models/Playbook');
const Goal = require('../../models/Goal');
const { getUpcomingEconomicEvents, getMacroDrivers } = require('../marketData/economicCalendarService');
const { calculatePositionSize, calculateStatisticalDistribution } = require('./statisticalAnalyticsService');
const { retrieveKnowledgeDocuments } = require('./knowledgeBaseService');

function isDbReady() {
  return mongoose.connection.readyState === 1;
}

function isValidUserId(userId) {
  return userId && mongoose.Types.ObjectId.isValid(userId);
}

/**
 * Robust extraction of realized profit from a trade document
 */
const getTradeProfit = (t) => {
  if (!t) return 0;

  // 1. Explicit takeProfit or takeProfitUSD
  const rawTp = (t.takeProfit !== undefined && t.takeProfit !== null && t.takeProfit !== '')
    ? t.takeProfit
    : (t.takeProfitUSD !== undefined && t.takeProfitUSD !== null && t.takeProfitUSD !== '' ? t.takeProfitUSD : null);

  if (rawTp !== null && rawTp !== undefined && rawTp !== '') {
    const tp = Number(rawTp);
    if (!isNaN(tp) && tp !== 0) {
      if (t.result === 'WIN') return Math.abs(tp);
      if (t.result === 'LOSS') return tp < 0 ? tp : -tp;
      if (t.result === 'BE') return 0;
      return tp;
    }
  }

  // 2. Pips fallback
  const pips = Number(t.pips || 0);
  if (pips !== 0) {
    if (t.result === 'LOSS' && pips > 0) return -pips;
    if (t.result === 'WIN' && pips < 0) return Math.abs(pips);
    if (t.result === 'BE') return 0;
    return pips;
  }

  // 3. R-Multiple fallback (1R = $100 baseline assumption)
  const rResult = Number(t.rResult !== undefined && t.rResult !== null ? t.rResult : (t.result === 'WIN' ? (t.rr || 1.5) : t.result === 'LOSS' ? -1 : 0));
  return Math.round(rResult * 100);
};

/**
 * Compute streaks chronologically
 */
const computeStreaks = (trades) => {
  if (!trades.length) return { currentWinStreak: 0, currentLossStreak: 0, maxWinStreak: 0, maxLossStreak: 0 };

  const sorted = [...trades].sort((a, b) => new Date(`${a.date}T${a.time || '00:00'}`) - new Date(`${b.date}T${b.time || '00:00'}`));

  let maxWin = 0, maxLoss = 0, currentWin = 0, currentLoss = 0;

  for (const t of sorted) {
    if (t.result === 'WIN') {
      currentWin++;
      currentLoss = 0;
      if (currentWin > maxWin) maxWin = currentWin;
    } else if (t.result === 'LOSS') {
      currentLoss++;
      currentWin = 0;
      if (currentLoss > maxLoss) maxLoss = currentLoss;
    } else {
      currentWin = 0;
      currentLoss = 0;
    }
  }

  let lastWin = 0, lastLoss = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].result === 'WIN') lastWin++;
    else break;
  }
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].result === 'LOSS') lastLoss++;
    else break;
  }

  return {
    currentWinStreak: lastWin,
    currentLossStreak: lastLoss,
    maxWinStreak: maxWin,
    maxLossStreak: maxLoss
  };
};

/**
 * Tool 1: get_trade_stats
 */
async function getTradeStats(userId, filters = {}) {
  if (!isDbReady() || !isValidUserId(userId)) {
    return {
      hasData: false,
      message: 'No trades found matching the specified criteria in your journal.',
      totalTrades: 0
    };
  }

  const query = { userId };

  if (filters.instrument) {
    query.instrument = new RegExp(`^${filters.instrument.trim()}$`, 'i');
  }
  if (filters.session) {
    query.session = new RegExp(`^${filters.session.trim()}$`, 'i');
  }
  if (filters.setupRating) {
    query.setupRating = filters.setupRating;
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

  const winRate = Number(((wins.length / totalTrades) * 100).toFixed(1));
  const lossRate = Number(((losses.length / totalTrades) * 100).toFixed(1));
  const beRate = Number(((bes.length / totalTrades) * 100).toFixed(1));

  let grossProfitUSD = 0;
  let grossLossUSD = 0;
  let totalR = 0;
  let bestTradeUSD = -Infinity;
  let worstTradeUSD = Infinity;
  let earlyExitCount = 0;
  let emotionalTradeCount = 0;
  let totalDiscipline = 0;

  trades.forEach(t => {
    const profit = getTradeProfit(t);
    const r = Number(t.rResult !== undefined && t.rResult !== null ? t.rResult : (t.result === 'WIN' ? 1.5 : t.result === 'LOSS' ? -1 : 0));
    totalR += r;

    if (profit > 0) grossProfitUSD += profit;
    else if (profit < 0) grossLossUSD += Math.abs(profit);

    if (profit > bestTradeUSD) bestTradeUSD = profit;
    if (profit < worstTradeUSD) worstTradeUSD = profit;

    if (t.earlyExitFlag === 1 || (t.reasonEarlyExit && t.reasonEarlyExit !== 'None')) {
      earlyExitCount++;
    }

    if (t.emotionalTradeFlag === 1 || ['Fear', 'Greed', 'Impatient', 'Revenge', 'FOMO', 'Frustrated'].includes(t.emotion)) {
      emotionalTradeCount++;
    }

    totalDiscipline += Number(t.disciplineScore || 80);
  });

  const netProfitUSD = Number((grossProfitUSD - grossLossUSD).toFixed(2));
  const avgR = Number((totalR / totalTrades).toFixed(2));
  const profitFactor = grossLossUSD > 0
    ? Number((grossProfitUSD / grossLossUSD).toFixed(2))
    : (grossProfitUSD > 0 ? 999.0 : 0);

  const avgWinUSD = wins.length > 0 ? Number((grossProfitUSD / wins.length).toFixed(2)) : 0;
  const avgLossUSD = losses.length > 0 ? Number((grossLossUSD / losses.length).toFixed(2)) : 0;

  // Expected value per trade ($ expectancy)
  const expectancyUSD = Number(((winRate / 100 * avgWinUSD) - (lossRate / 100 * avgLossUSD)).toFixed(2));

  const streaks = computeStreaks(trades);

  // Maximum Drawdown & Equity Curve
  const chronological = [...trades].sort((a, b) => new Date(`${a.date}T${a.time || '00:00'}`) - new Date(`${b.date}T${b.time || '00:00'}`));
  let cumulative = 0;
  let peak = 0;
  let maxDrawdownUSD = 0;
  chronological.forEach(t => {
    cumulative += getTradeProfit(t);
    if (cumulative > peak) peak = cumulative;
    const dd = peak - cumulative;
    if (dd > maxDrawdownUSD) maxDrawdownUSD = dd;
  });

  // Long vs Short performance
  const buys = trades.filter(t => t.direction === 'Buy');
  const sells = trades.filter(t => t.direction === 'Sell');
  const buyWins = buys.filter(t => t.result === 'WIN').length;
  const sellWins = sells.filter(t => t.result === 'WIN').length;
  const buyPnl = buys.reduce((sum, t) => sum + getTradeProfit(t), 0);
  const sellPnl = sells.reduce((sum, t) => sum + getTradeProfit(t), 0);

  // Weekday distribution
  const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const weekdayMap = {};
  trades.forEach(t => {
    const d = new Date(t.date);
    const dayName = isNaN(d.getDay()) ? 'Unknown' : weekdayNames[d.getDay()];
    if (!weekdayMap[dayName]) weekdayMap[dayName] = { trades: 0, wins: 0, pnl: 0 };
    weekdayMap[dayName].trades++;
    if (t.result === 'WIN') weekdayMap[dayName].wins++;
    weekdayMap[dayName].pnl += getTradeProfit(t);
  });

  const sampleSizeWarning = totalTrades < 20
    ? `Sample size is statistically small (N=${totalTrades} trades). Observed metrics have higher variance and should be confirmed across 30+ trades before modifying your baseline rules.`
    : null;

  return {
    hasData: true,
    totalTrades,
    winningTrades: wins.length,
    losingTrades: losses.length,
    breakEvenTrades: bes.length,
    winRate: `${winRate}%`,
    lossRate: `${lossRate}%`,
    beRate: `${beRate}%`,
    netProfitUSD: `$${netProfitUSD.toLocaleString()}`,
    grossProfitUSD: `$${grossProfitUSD.toLocaleString()}`,
    grossLossUSD: `$${grossLossUSD.toLocaleString()}`,
    totalR: `${totalR >= 0 ? '+' : ''}${totalR.toFixed(2)}R`,
    avgR: `${avgR >= 0 ? '+' : ''}${avgR.toFixed(2)}R`,
    profitFactor,
    avgWinUSD: `$${avgWinUSD.toLocaleString()}`,
    avgLossUSD: `$${avgLossUSD.toLocaleString()}`,
    expectancyUSD: `${expectancyUSD >= 0 ? '+' : ''}$${expectancyUSD.toFixed(2)} per trade`,
    maxDrawdownUSD: `-$${Math.round(maxDrawdownUSD).toLocaleString()}`,
    bestTradeUSD: bestTradeUSD !== -Infinity ? `$${bestTradeUSD.toLocaleString()}` : '$0',
    worstTradeUSD: worstTradeUSD !== Infinity ? `$${worstTradeUSD.toLocaleString()}` : '$0',
    currentStreak: streaks.currentWinStreak > 0 ? `+${streaks.currentWinStreak} Wins` : (streaks.currentLossStreak > 0 ? `-${streaks.currentLossStreak} Losses` : 'None'),
    maxWinStreak: streaks.maxWinStreak,
    maxLossStreak: streaks.maxLossStreak,
    averageDiscipline: `${Math.round(totalDiscipline / totalTrades)}/100`,
    earlyExitCount,
    emotionalTradeCount,
    longPerformance: {
      trades: buys.length,
      winRate: buys.length ? `${Math.round((buyWins / buys.length) * 100)}%` : 'N/A',
      netProfit: `$${Math.round(buyPnl).toLocaleString()}`
    },
    shortPerformance: {
      trades: sells.length,
      winRate: sells.length ? `${Math.round((sellWins / sells.length) * 100)}%` : 'N/A',
      netProfit: `$${Math.round(sellPnl).toLocaleString()}`
    },
    sampleSizeWarning
  };
}

/**
 * Tool 2: get_trade_history
 */
async function getTradeHistory(userId, options = {}) {
  const limit = Math.min(Math.max(Number(options.limit) || 10, 1), 50);
  const offset = Math.max(Number(options.offset) || 0, 0);

  if (!isDbReady() || !isValidUserId(userId)) {
    return {
      totalReturned: 0,
      requestedLimit: limit,
      trades: []
    };
  }

  const query = { userId };
  if (options.result && ['WIN', 'LOSS', 'BE'].includes(options.result.toUpperCase())) {
    query.result = options.result.toUpperCase();
  }
  if (options.instrument) {
    query.instrument = new RegExp(`^${options.instrument.trim()}$`, 'i');
  }

  const trades = await Trade.find(query)
    .sort({ date: -1, time: -1 })
    .skip(offset)
    .limit(limit)
    .lean();

  const formatted = trades.map((t, index) => {
    const profit = getTradeProfit(t);
    return {
      index: offset + index + 1,
      id: t._id,
      name: t.tradeName || `Trade #${offset + index + 1}`,
      date: t.date,
      time: t.time || '00:00',
      instrument: t.instrument || 'EURUSD',
      direction: t.direction || 'Buy',
      result: t.result,
      profitUSD: profit >= 0 ? `+$${profit.toLocaleString()}` : `-$${Math.abs(profit).toLocaleString()}`,
      rResult: `${Number(t.rResult || 0) >= 0 ? '+' : ''}${Number(t.rResult || 0).toFixed(2)}R`,
      pips: Number(t.pips || 0),
      session: t.session || 'London',
      setup: t.setupRating || 'A+',
      emotion: t.emotion || 'Calm',
      discipline: Number(t.disciplineScore || 100),
      mistakes: Array.isArray(t.mistakes) ? t.mistakes.filter(m => m && m !== 'None').join(', ') : 'None',
      notes: t.notes || ''
    };
  });

  return {
    totalReturned: formatted.length,
    requestedLimit: limit,
    trades: formatted
  };
}

/**
 * Tool 3: get_trade_details
 */
async function getTradeDetails(userId, { tradeId, tradeName }) {
  if (!isDbReady() || !isValidUserId(userId)) {
    return { found: false, message: 'Trade not found in your journal.' };
  }
  const query = { userId };
  if (tradeId) query._id = tradeId;
  else if (tradeName) query.tradeName = new RegExp(`^${tradeName.trim()}$`, 'i');
  else throw new Error('Please specify tradeId or tradeName to retrieve details.');

  const trade = await Trade.findOne(query).lean();
  if (!trade) {
    return { found: false, message: 'Trade not found in your journal.' };
  }

  const profit = getTradeProfit(trade);
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
    profitUSD: profit >= 0 ? `+$${profit.toLocaleString()}` : `-$${Math.abs(profit).toLocaleString()}`,
    rResult: `${Number(trade.rResult || 0) >= 0 ? '+' : ''}${Number(trade.rResult || 0).toFixed(2)}R`,
    rr: trade.rr,
    pips: trade.pips,
    session: trade.session,
    levelTraded: trade.levelTraded,
    setupRating: trade.setupRating,
    entryType: trade.entryType,
    confirmation: trade.confirmation,
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
async function getPerformanceBySymbol(userId) {
  if (!isDbReady() || !isValidUserId(userId)) {
    return { hasData: false, message: 'No trades logged yet.' };
  }
  const trades = await Trade.find({ userId }).lean();
  if (!trades.length) return { hasData: false, message: 'No trades logged yet.' };

  const map = {};
  trades.forEach(t => {
    const sym = (t.instrument || 'Unknown').toUpperCase().trim();
    if (!map[sym]) map[sym] = { count: 0, wins: 0, losses: 0, profitUSD: 0, totalR: 0 };
    map[sym].count++;
    if (t.result === 'WIN') map[sym].wins++;
    if (t.result === 'LOSS') map[sym].losses++;
    map[sym].profitUSD += getTradeProfit(t);
    map[sym].totalR += Number(t.rResult || 0);
  });

  const breakdown = Object.entries(map).map(([symbol, s]) => ({
    symbol,
    trades: s.count,
    winRate: `${Math.round((s.wins / s.count) * 100)}%`,
    netProfitUSD: `${s.profitUSD >= 0 ? '+' : ''}$${Math.round(s.profitUSD).toLocaleString()}`,
    totalR: `${s.totalR >= 0 ? '+' : ''}${s.totalR.toFixed(2)}R`
  })).sort((a, b) => b.trades - a.trades);

  return { hasData: true, breakdown };
}

/**
 * Tool 5: get_performance_by_session
 */
async function getPerformanceBySession(userId) {
  if (!isDbReady() || !isValidUserId(userId)) {
    return { hasData: false, message: 'No trades logged yet.' };
  }
  const trades = await Trade.find({ userId }).lean();
  if (!trades.length) return { hasData: false, message: 'No trades logged yet.' };

  const map = {};
  trades.forEach(t => {
    const sess = (t.session || 'Unknown').trim();
    if (!map[sess]) map[sess] = { count: 0, wins: 0, losses: 0, profitUSD: 0, totalR: 0 };
    map[sess].count++;
    if (t.result === 'WIN') map[sess].wins++;
    if (t.result === 'LOSS') map[sess].losses++;
    map[sess].profitUSD += getTradeProfit(t);
    map[sess].totalR += Number(t.rResult || 0);
  });

  const breakdown = Object.entries(map).map(([session, s]) => ({
    session,
    trades: s.count,
    winRate: `${Math.round((s.wins / s.count) * 100)}%`,
    netProfitUSD: `${s.profitUSD >= 0 ? '+' : ''}$${Math.round(s.profitUSD).toLocaleString()}`,
    totalR: `${s.totalR >= 0 ? '+' : ''}${s.totalR.toFixed(2)}R`
  })).sort((a, b) => b.trades - a.trades);

  return { hasData: true, breakdown };
}

/**
 * Tool 6: get_mistakes_and_emotions
 */
async function getMistakesAndEmotions(userId) {
  if (!isDbReady() || !isValidUserId(userId)) {
    return { hasData: false, message: 'No trades logged yet.' };
  }
  const trades = await Trade.find({ userId }).lean();
  if (!trades.length) return { hasData: false, message: 'No trades logged yet.' };

  const mistakeMap = {};
  const emotionMap = {};

  trades.forEach(t => {
    const profit = getTradeProfit(t);

    (t.mistakes || []).filter(m => m && m !== 'None').forEach(m => {
      if (!mistakeMap[m]) mistakeMap[m] = { count: 0, totalLossUSD: 0 };
      mistakeMap[m].count++;
      if (profit < 0) mistakeMap[m].totalLossUSD += Math.abs(profit);
    });

    const emo = t.emotion || 'Calm';
    if (!emotionMap[emo]) emotionMap[emo] = { count: 0, wins: 0, profitUSD: 0 };
    emotionMap[emo].count++;
    if (t.result === 'WIN') emotionMap[emo].wins++;
    emotionMap[emo].profitUSD += profit;
  });

  const mistakes = Object.entries(mistakeMap).map(([mistake, data]) => ({
    mistake,
    occurrences: data.count,
    totalLossUSD: `-$${Math.round(data.totalLossUSD).toLocaleString()}`
  })).sort((a, b) => b.occurrences - a.occurrences);

  const emotions = Object.entries(emotionMap).map(([emotion, data]) => ({
    emotion,
    trades: data.count,
    winRate: `${Math.round((data.wins / data.count) * 100)}%`,
    netProfitUSD: `${data.profitUSD >= 0 ? '+' : ''}$${Math.round(data.profitUSD).toLocaleString()}`
  })).sort((a, b) => b.trades - a.trades);

  return {
    hasData: true,
    mistakes: mistakes.length ? mistakes : 'No repeated mistakes logged yet. Excellent discipline!',
    emotions
  };
}

/**
 * Tool 7: review_trade
 * Evidence-based single trade review comparing execution to user's Playbook rules
 */
async function reviewTrade(userId, { tradeId, tradeName } = {}) {
  if (!isDbReady() || !isValidUserId(userId)) {
    return { hasData: false, message: 'Database not ready.' };
  }

  let trade = null;
  if (tradeId) {
    trade = await Trade.findOne({ _id: tradeId, userId }).lean();
  } else if (tradeName) {
    trade = await Trade.findOne({ userId, tradeName: new RegExp(`^${tradeName.trim()}$`, 'i') }).lean();
  } else {
    // If not specified, get the most recent trade
    const trades = await Trade.find({ userId }).sort({ date: -1, time: -1 }).limit(1).lean();
    trade = trades[0] || null;
  }

  if (!trade) {
    return {
      found: false,
      message: 'No matching trade found in your journal to review. Please log a trade first!'
    };
  }

  const playbook = await Playbook.findOne({ userId }).lean().catch(() => null);
  const profit = getTradeProfit(trade);
  const plannedRR = Number(trade.rr || 1.5);
  const realizedR = Number(trade.rResult !== undefined && trade.rResult !== null ? trade.rResult : (trade.result === 'WIN' ? plannedRR : trade.result === 'LOSS' ? -1 : 0));

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
    profitUSD: profit >= 0 ? `+$${profit.toLocaleString()}` : `-$${Math.abs(profit).toLocaleString()}`,
    realizedR: `${realizedR >= 0 ? '+' : ''}${realizedR}R`,
    plannedRR: `1:${plannedRR}`,
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
 * Tool 8: get_psychology_audit
 * Quantifies tilt, revenge trading, sequencing after losses, and emotional correlations
 */
async function getPsychologyAudit(userId) {
  if (!isDbReady() || !isValidUserId(userId)) {
    return { hasData: false, message: 'Database not ready.' };
  }

  const trades = await Trade.find({ userId }).sort({ date: 1, time: 1 }).lean();
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
      else totalLossPnlAfterLoss += Math.abs(getTradeProfit(currTrade));
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
    emotionMap[emo].profit += getTradeProfit(t);
  });

  const winRateAfterLoss = tradesAfterLossCount > 0 ? Number(((tradesAfterLossWins / tradesAfterLossCount) * 100).toFixed(1)) : null;
  const winRateAfterWin = tradesAfterWinCount > 0 ? Number(((tradesAfterWinWins / tradesAfterWinCount) * 100).toFixed(1)) : null;
  const baselineWinRate = Number(((trades.filter(t => t.result === 'WIN').length / trades.length) * 100).toFixed(1));

  let tiltRisk = 'LOW';
  let tiltEvidence = 'Your execution remains stable across winning and losing sequences.';

  if (winRateAfterLoss !== null && winRateAfterLoss < baselineWinRate - 15) {
    tiltRisk = 'HIGH';
    tiltEvidence = `After a losing trade, your win rate drops to ${winRateAfterLoss}% (compared to your ${baselineWinRate}% baseline). This measured drop indicates emotional impatience or revenge trading after taking a loss.`;
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
 * Tool 9: get_playbook_rules
 * Retrieves user's documented entry, risk, exit, and psychology rules
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
 * Tool 10: get_prop_firm_status
 * Checks prop firm challenge rules, daily loss buffers, and max drawdown limits
 */
async function getPropFirmStatus(userId) {
  if (!isDbReady() || !isValidUserId(userId)) {
    return { hasData: false, message: 'Database not ready.' };
  }

  const goal = await Goal.findOne({ userId }).lean();
  const trades = await Trade.find({ userId }).sort({ date: -1 }).lean();

  const accountSize = goal?.accountSize || 50000;
  const profitTarget = goal?.profitTarget || 5000;
  const maxLoss = goal?.maxLoss || 5000;
  const maxDailyLoss = goal?.maxDailyLoss || 2500;

  const todayStr = new Date().toISOString().split('T')[0];
  const todayTrades = trades.filter(t => t.date === todayStr);
  const todayPnl = todayTrades.reduce((sum, t) => sum + getTradeProfit(t), 0);
  const totalNetProfit = trades.reduce((sum, t) => sum + getTradeProfit(t), 0);

  let cumulative = 0;
  let peak = 0;
  let maxDd = 0;
  const chronological = [...trades].sort((a, b) => new Date(`${a.date}T${a.time || '00:00'}`) - new Date(`${b.date}T${b.time || '00:00'}`));
  chronological.forEach(t => {
    cumulative += getTradeProfit(t);
    if (cumulative > peak) peak = cumulative;
    const dd = peak - cumulative;
    if (dd > maxDd) maxDd = dd;
  });

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
 * Tool 11: compare_trading_periods
 * Compares two sessions (e.g. London vs New York) or periods
 */
async function compareTradingPeriods(userId, { type = 'SESSIONS', filter1, filter2, instrument } = {}) {
  if (!isDbReady() || !isValidUserId(userId)) {
    return { hasData: false, message: 'Database not ready.' };
  }

  const query = { userId };
  if (instrument) query.instrument = new RegExp(`^${instrument.trim()}$`, 'i');

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
    let gp = 0, gl = 0, totR = 0;
    arr.forEach(t => {
      const p = getTradeProfit(t);
      if (p > 0) gp += p;
      else gl += Math.abs(p);
      totR += Number(t.rResult || 0);
    });
    return {
      label,
      trades: arr.length,
      winRate: `${Math.round((wins / arr.length) * 100)}%`,
      netProfit: `${gp - gl >= 0 ? '+' : ''}$${Math.round(gp - gl).toLocaleString()}`,
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
    description: "Get verified overall trading statistics (win rate, gross/net profit, expectancy, max drawdown, long vs short, streaks, average discipline) for the authenticated user's journal.",
    parameters: {
      type: 'OBJECT',
      properties: {
        instrument: { type: 'STRING', description: 'Optional instrument filter (e.g. EURUSD, XAUUSD)' },
        session: { type: 'STRING', description: 'Optional trading session filter (e.g. London, New York)' },
        setupRating: { type: 'STRING', description: 'Optional setup rating filter (e.g. A+, A, B)' },
        startDate: { type: 'STRING', description: 'Optional start date filter (YYYY-MM-DD)' },
        endDate: { type: 'STRING', description: 'Optional end date filter (YYYY-MM-DD)' }
      }
    }
  },
  {
    name: 'get_trade_history',
    description: "Get a list of the user's latest N trades with execution results, direction, profit, setup, and mistakes.",
    parameters: {
      type: 'OBJECT',
      properties: {
        limit: { type: 'INTEGER', description: 'Number of trades to return (1-50, default 10)' },
        result: { type: 'STRING', description: 'Optional result filter: WIN, LOSS, or BE' },
        instrument: { type: 'STRING', description: 'Optional instrument filter (e.g. EURUSD)' }
      }
    }
  },
  {
    name: 'get_trade_details',
    description: 'Get deep details and audit information for a specific trade by ID or trade name.',
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
    description: 'Get performance metrics broken down by instrument (EURUSD, XAUUSD, BTCUSD, etc.).',
    parameters: { type: 'OBJECT', properties: {} }
  },
  {
    name: 'get_performance_by_session',
    description: 'Get performance metrics broken down by trading session (London, New York, Asian).',
    parameters: { type: 'OBJECT', properties: {} }
  },
  {
    name: 'get_mistakes_and_emotions',
    description: 'Get the user’s most costly repeated mistakes and performance breakdown across emotional states (FOMO, Revenge, Calm, etc.).',
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
async function executeJournalTool(toolName, args, userId) {
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
      return await getPerformanceBySymbol(userId);
    case 'get_performance_by_session':
      return await getPerformanceBySession(userId);
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
      const allTrades = await Trade.find({ userId }).lean().catch(() => []);
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
  getTradeStats,
  getTradeHistory,
  getTradeDetails,
  reviewTrade,
  getPerformanceBySymbol,
  getPerformanceBySession,
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
