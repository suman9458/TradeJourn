const mongoose = require('mongoose');
const Trade = require('../models/Trade');

// Helper to compute consecutive streaks
const computeStreaks = (trades) => {
  if (!trades.length) {
    return { currentWinStreak: 0, currentLossStreak: 0, maxWinStreak: 0, maxLossStreak: 0 };
  }

  // Sort chronological
  const sorted = [...trades].sort((a, b) => new Date(`${a.date}T${a.time || '00:00'}`) - new Date(`${b.date}T${b.time || '00:00'}`));

  let maxWin = 0;
  let maxLoss = 0;
  let currentWin = 0;
  let currentLoss = 0;

  for (const t of sorted) {
    if (t.result === 'WIN') {
      currentWin += 1;
      currentLoss = 0;
      if (currentWin > maxWin) maxWin = currentWin;
    } else if (t.result === 'LOSS') {
      currentLoss += 1;
      currentWin = 0;
      if (currentLoss > maxLoss) maxLoss = currentLoss;
    } else {
      currentWin = 0;
      currentLoss = 0;
    }
  }

  // Streaks at the very end
  let lastWinStreak = 0;
  let lastLossStreak = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].result === 'WIN') {
      lastWinStreak++;
    } else {
      break;
    }
  }
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].result === 'LOSS') {
      lastLossStreak++;
    } else {
      break;
    }
  }

  return {
    currentWinStreak: lastWinStreak,
    currentLossStreak: lastLossStreak,
    maxWinStreak: maxWin,
    maxLossStreak: maxLoss
  };
};

// @desc    Get comprehensive KPI statistics & dashboard summary
// @route   GET /api/analytics/kpis
// @access  Private
const getKPIs = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // Fetch all user trades with only required projection fields for performance
    const trades = await Trade.find({ userId })
      .select('date time result rr rResult pips takeProfit takeProfitUSD setupRating session emotion reasonEarlyExit earlyExitFlag emotionalTradeFlag disciplineScore')
      .lean();

    const totalTrades = trades.length;
    if (totalTrades === 0) {
      return res.json({
        success: true,
        stats: {
          totalTrades: 0,
          winningTrades: 0,
          losingTrades: 0,
          breakEvenTrades: 0,
          winRate: 0,
          lossRate: 0,
          totalR: 0,
          avgR: 0,
          avgWin: 0,
          avgLoss: 0,
          profitFactor: 0,
          totalPips: 0,
          pipsGain: 0,
          loosePips: 0,
          avgPips: 0,
          bestTrade: 0,
          worstTrade: 0,
          currentWinStreak: 0,
          currentLossStreak: 0,
          maxWinStreak: 0,
          maxLossStreak: 0,
          aPlusWinRate: 0,
          earlyExitCount: 0,
          emotionalTradeCount: 0,
          disciplineScoreAverage: 0,
          bestSetup: 'None',
          bestSession: 'None'
        }
      });
    }

    const winningTrades = trades.filter(t => t.result === 'WIN');
    const losingTrades = trades.filter(t => t.result === 'LOSS');
    const breakEvenTrades = trades.filter(t => t.result === 'BE');

    const totalR = trades.reduce((sum, t) => sum + (t.rResult || 0), 0);
    const avgR = totalR / totalTrades;
    const totalPipsGain = winningTrades.reduce((sum, t) => sum + Math.abs(t.pips || 0), 0);
    const totalLoosePips = losingTrades.reduce((sum, t) => sum + Math.abs(t.pips || 0), 0);
    const totalPips = totalPipsGain - totalLoosePips;
    const avgPips = totalTrades ? totalPips / totalTrades : 0;

    const totalWinR = winningTrades.reduce((sum, t) => sum + (t.rResult || 0), 0);
    const totalLossR = Math.abs(losingTrades.reduce((sum, t) => sum + (t.rResult || 0), 0));

    const avgWin = winningTrades.length ? totalWinR / winningTrades.length : 0;
    const avgLoss = losingTrades.length ? -totalLossR / losingTrades.length : 0;
    const profitFactor = totalLossR > 0 ? totalWinR / totalLossR : totalWinR > 0 ? 99.99 : 0;

    const bestTrade = Math.max(...trades.map(t => t.rResult || 0));
    const worstTrade = Math.min(...trades.map(t => t.rResult || 0));

    const streaks = computeStreaks(trades);

    const aPlusTrades = trades.filter(t => t.setupRating === 'A+');
    const aPlusWins = aPlusTrades.filter(t => t.result === 'WIN').length;
    const aPlusWinRate = aPlusTrades.length ? (aPlusWins / aPlusTrades.length) * 100 : 0;

    const earlyExitCount = trades.filter(t => t.earlyExitFlag === 1).length;
    const emotionalTradeCount = trades.filter(t => t.emotionalTradeFlag === 1).length;
    const disciplineScoreAverage = trades.reduce((sum, t) => sum + (t.disciplineScore || 0), 0) / totalTrades;

    // Helper to extract dollar profit for each trade
    const getTradeTakeProfitUSD = (t) => {
      if (t.takeProfitUSD !== undefined && t.takeProfitUSD !== null && t.takeProfitUSD !== '') {
        return Number(t.takeProfitUSD);
      }
      if (t.takeProfit !== undefined && t.takeProfit !== null && t.takeProfit !== '') {
        return Number(t.takeProfit);
      }
      return (t.rResult || 0) * 100;
    };

    // Best setup and best session by total dollar Profit
    const setupProfitMap = {};
    for (const t of trades) {
      const pnl = getTradeTakeProfitUSD(t);
      setupProfitMap[t.setupRating] = (setupProfitMap[t.setupRating] || 0) + pnl;
    }
    const bestSetupEntry = Object.entries(setupProfitMap).sort((a, b) => b[1] - a[1])[0];

    const sessionProfitMap = {};
    for (const t of trades) {
      const pnl = getTradeTakeProfitUSD(t);
      sessionProfitMap[t.session] = (sessionProfitMap[t.session] || 0) + pnl;
    }
    const bestSessionEntry = Object.entries(sessionProfitMap).sort((a, b) => b[1] - a[1])[0];

    const formatPnlDisplay = (entry) => {
      if (!entry) return 'None';
      const name = entry[0];
      const pnl = entry[1];
      const formatted = Math.abs(pnl).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
      return `${name} (${pnl >= 0 ? '+' : '-'}$${formatted})`;
    };

    res.json({
      success: true,
      stats: {
        totalTrades,
        winningTrades: winningTrades.length,
        losingTrades: losingTrades.length,
        breakEvenTrades: breakEvenTrades.length,
        winRate: (winningTrades.length / totalTrades) * 100,
        lossRate: (losingTrades.length / totalTrades) * 100,
        totalR,
        avgR,
        avgWin,
        avgLoss,
        profitFactor,
        totalPips,
        pipsGain: totalPipsGain,
        loosePips: totalLoosePips,
        avgPips,
        bestTrade,
        worstTrade,
        ...streaks,
        aPlusWinRate,
        earlyExitCount,
        emotionalTradeCount,
        disciplineScoreAverage,
        bestSetup: formatPnlDisplay(bestSetupEntry),
        bestSession: formatPnlDisplay(bestSessionEntry)
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get breakdown analytics (Setup, Session, Bias, Emotion, Mistake)
// @route   GET /api/analytics/breakdowns
// @access  Private
const getBreakdowns = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // Aggregate Setups
    const setups = await Trade.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: '$setupRating',
          count: { $sum: 1 },
          wins: { $sum: { $cond: [{ $eq: ['$result', 'WIN'] }, 1, 0] } },
          totalR: { $sum: '$rResult' },
          totalPips: { $sum: '$pips' }
        }
      },
      {
        $project: {
          setup: '$_id',
          count: 1,
          winRate: { $multiply: [{ $divide: ['$wins', '$count'] }, 100] },
          avgR: { $divide: ['$totalR', '$count'] },
          totalR: 1,
          avgPips: { $divide: ['$totalPips', '$count'] }
        }
      },
      { $sort: { winRate: -1, totalR: -1, count: -1 } }
    ]);

    // Aggregate Sessions
    const sessions = await Trade.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: '$session',
          count: { $sum: 1 },
          wins: { $sum: { $cond: [{ $eq: ['$result', 'WIN'] }, 1, 0] } },
          totalR: { $sum: '$rResult' }
        }
      },
      {
        $project: {
          session: '$_id',
          count: 1,
          winRate: { $multiply: [{ $divide: ['$wins', '$count'] }, 100] },
          totalR: 1,
          avgR: { $divide: ['$totalR', '$count'] }
        }
      },
      { $sort: { winRate: -1, totalR: -1, count: -1 } }
    ]);

    // Aggregate Biases
    const biases = await Trade.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: '$bias',
          count: { $sum: 1 },
          wins: { $sum: { $cond: [{ $eq: ['$result', 'WIN'] }, 1, 0] } },
          totalR: { $sum: '$rResult' }
        }
      },
      {
        $project: {
          bias: '$_id',
          count: 1,
          winRate: { $multiply: [{ $divide: ['$wins', '$count'] }, 100] },
          totalR: 1
        }
      },
      { $sort: { winRate: -1, totalR: -1, count: -1 } }
    ]);

    // Aggregate Emotions
    const emotions = await Trade.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: '$emotion',
          count: { $sum: 1 },
          wins: { $sum: { $cond: [{ $eq: ['$result', 'WIN'] }, 1, 0] } },
          totalR: { $sum: '$rResult' }
        }
      },
      {
        $project: {
          emotion: '$_id',
          count: 1,
          winRate: { $multiply: [{ $divide: ['$wins', '$count'] }, 100] },
          avgR: { $divide: ['$totalR', '$count'] },
          totalR: 1
        }
      },
      { $sort: { winRate: -1, totalR: -1, count: -1 } }
    ]);

    // Aggregate Mistakes
    const mistakes = await Trade.aggregate([
      { $match: { userId } },
      { $unwind: '$mistakes' },
      { $match: { mistakes: { $nin: ['None', '', null] } } },
      {
        $group: {
          _id: '$mistakes',
          count: { $sum: 1 },
          wins: { $sum: { $cond: [{ $eq: ['$result', 'WIN'] }, 1, 0] } },
          totalR: { $sum: '$rResult' }
        }
      },
      {
        $project: {
          mistake: '$_id',
          count: 1,
          winRate: { $multiply: [{ $divide: ['$wins', '$count'] }, 100] },
          totalR: 1,
          avgR: { $divide: ['$totalR', '$count'] }
        }
      },
      { $sort: { totalR: 1, count: -1 } }
    ]);

    // Aggregate Instruments / Assets
    const instruments = await Trade.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: '$instrument',
          count: { $sum: 1 },
          wins: { $sum: { $cond: [{ $eq: ['$result', 'WIN'] }, 1, 0] } },
          totalPips: { $sum: '$pips' },
          totalR: { $sum: '$rResult' }
        }
      },
      {
        $project: {
          instrument: '$_id',
          count: 1,
          winRate: { $multiply: [{ $divide: ['$wins', '$count'] }, 100] },
          totalPips: 1,
          totalR: 1
        }
      },
      { $sort: { winRate: -1, totalR: -1, count: -1 } }
    ]);

    // Aggregate Monthly Performance
    const monthly = await Trade.aggregate([
      { $match: { userId } },
      {
        $project: {
          yearMonth: { $substr: ['$date', 0, 7] },
          pips: 1,
          rResult: 1,
          result: 1
        }
      },
      {
        $group: {
          _id: '$yearMonth',
          count: { $sum: 1 },
          wins: { $sum: { $cond: [{ $eq: ['$result', 'WIN'] }, 1, 0] } },
          losses: { $sum: { $cond: [{ $eq: ['$result', 'LOSS'] }, 1, 0] } },
          totalPips: { $sum: '$pips' },
          totalR: { $sum: '$rResult' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      data: {
        setups,
        sessions,
        biases,
        emotions,
        mistakes,
        instruments,
        monthly
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get Early Exit Analyzer data and detected patterns
// @route   GET /api/analytics/early-exits
// @access  Private
const getEarlyExitAnalytics = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const [totalTrades, earlyTrades] = await Promise.all([
      Trade.countDocuments({ userId }),
      Trade.find({
        userId,
        reasonEarlyExit: { $exists: true, $nin: ['None', '', null] }
      }).lean()
    ]);

    if (totalTrades === 0 || earlyTrades.length === 0) {
      return res.json({
        success: true,
        data: {
          totalTrades,
          earlyExitCount: 0,
          pct: 0,
          totalR: 0,
          avgR: 0,
          reasons: [],
          emotions: [],
          setups: [],
          patterns: []
        }
      });
    }

    const earlyExitCount = earlyTrades.length;
    const pct = (earlyExitCount / totalTrades) * 100;
    const totalR = earlyTrades.reduce((sum, t) => sum + (t.rResult || 0), 0);
    const avgR = totalR / earlyExitCount;

    // Reason frequency
    const reasonMap = {};
    const emotionMap = {};
    const setupMap = {};
    let losingEarlyCount = 0;

    for (const t of earlyTrades) {
      const reason = t.reasonEarlyExit || 'Unknown';
      reasonMap[reason] = (reasonMap[reason] || 0) + 1;

      const emotion = t.emotion || 'Calm';
      emotionMap[emotion] = (emotionMap[emotion] || 0) + 1;

      const setup = t.setupRating || 'No Setup';
      setupMap[setup] = (setupMap[setup] || 0) + 1;

      if (t.result === 'LOSS') losingEarlyCount++;
    }

    const reasons = Object.entries(reasonMap).map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count);
    const emotions = Object.entries(emotionMap).map(([emotion, count]) => ({ emotion, count })).sort((a, b) => b.count - a.count);
    const setups = Object.entries(setupMap).map(([setup, count]) => ({ setup, count })).sort((a, b) => b.count - a.count);

    const patterns = [];
    if (emotions.length) patterns.push(`Most early exits happen when emotion = ${emotions[0].emotion} (${emotions[0].count} trades).`);
    if (setups.length) patterns.push(`Most early exits occur on ${setups[0].setup} setups (${setups[0].count} trades).`);
    if (losingEarlyCount > earlyExitCount / 2) {
      patterns.push(`Majority of early exits happen on losing trades (${losingEarlyCount} of ${earlyExitCount}).`);
    }

    res.json({
      success: true,
      data: {
        totalTrades,
        earlyExitCount,
        pct,
        totalR,
        avgR,
        reasons,
        emotions,
        setups,
        patterns
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get Equity Curve points (Chronological cumulative R and Pips)
// @route   GET /api/analytics/equity-curve
// @access  Private
const getEquityCurve = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const trades = await Trade.find({ userId })
      .select('date time rResult pips takeProfit takeProfitUSD tradeName result instrument rr')
      .sort({ date: 1, time: 1 })
      .lean();

    let cumulativeR = 0;
    let cumulativePips = 0;
    const curve = trades.map((t, idx) => {
      let rawPips = Number(t.pips !== undefined && t.pips !== null ? t.pips : 0);
      if (t.result === 'LOSS' && rawPips > 0) rawPips = -rawPips;
      else if (t.result === 'WIN' && rawPips < 0) rawPips = Math.abs(rawPips);
      else if (t.result === 'BE') rawPips = 0;

      cumulativeR += Number(t.rResult || 0);
      cumulativePips += rawPips;

      const rawTp = t.takeProfit !== undefined && t.takeProfit !== null && t.takeProfit !== ''
        ? t.takeProfit
        : (t.takeProfitUSD !== undefined && t.takeProfitUSD !== null && t.takeProfitUSD !== '' ? t.takeProfitUSD : 0);

      return {
        _id: t._id,
        tradeIndex: idx + 1,
        date: t.date,
        time: t.time,
        tradeName: t.tradeName,
        instrument: t.instrument,
        result: t.result,
        rr: t.rr,
        pips: rawPips,
        pipsGain: rawPips > 0 ? rawPips : 0,
        loosePips: rawPips < 0 ? Math.abs(rawPips) : 0,
        takeProfit: rawTp,
        takeProfitUSD: rawTp,
        rResult: t.rResult,
        cumulativeR: Number(cumulativeR.toFixed(2)),
        cumulativePips: Math.round(cumulativePips)
      };
    });

    res.json({
      success: true,
      curve
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getKPIs,
  getBreakdowns,
  getEarlyExitAnalytics,
  getEquityCurve
};
