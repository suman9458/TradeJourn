const Trade = require('../models/Trade');

const formatR = (value) => {
  const numeric = Number(value || 0);
  return `${numeric >= 0 ? '+' : ''}${numeric.toFixed(2)}R`;
};

const getTradeProfitUSD = (t) => {
  if (!t) return 0;
  let rawTp = (t.takeProfit !== undefined && t.takeProfit !== null && t.takeProfit !== '')
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

  const pips = Number(t.pips || 0);
  if (pips !== 0) {
    if (t.result === 'LOSS' && pips > 0) return -pips;
    if (t.result === 'WIN' && pips < 0) return Math.abs(pips);
    if (t.result === 'BE') return 0;
    return pips;
  }

  const rResult = Number(t.rResult !== undefined ? t.rResult : (t.result === 'WIN' ? (t.rr || 1.5) : t.result === 'LOSS' ? -1 : 0));
  return Math.round(rResult * 100);
};

// @desc    Get Daily, Weekly, and Monthly reviews computed from recorded data
// @route   GET /api/reviews
// @access  Private
const getReviews = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const trades = await Trade.find({ userId }).sort({ date: -1, time: -1 }).lean();

    if (!trades.length) {
      return res.json({
        success: true,
        reviews: {
          daily: { hasData: false, message: 'No trades recorded yet for review.' },
          weekly: { hasData: false, message: 'No trades recorded yet for review.' },
          monthly: { hasData: false, message: 'No trades recorded yet for review.' },
          yearly: { hasData: false, message: 'No trades recorded yet for review.' }
        }
      });
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const past7Str = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const past30Str = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const past365Str = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const dailyTrades = trades.filter(t => t.date === todayStr);
    const weeklyTrades = trades.filter(t => t.date >= past7Str);
    const monthlyTrades = trades.filter(t => t.date >= past30Str);
    const yearlyTrades = trades.filter(t => t.date >= past365Str);

    const buildReviewStats = (items) => {
      if (!items.length) return null;
      const count = items.length;
      const wins = items.filter(t => t.result === 'WIN').length;
      const totalR = items.reduce((sum, t) => sum + (t.rResult || 0), 0);
      const avgR = totalR / count;
      const winRate = (wins / count) * 100;
      const earlyExits = items.filter(t => t.earlyExitFlag === 1).length;
      const avgDiscipline = items.reduce((sum, t) => sum + (t.disciplineScore || 0), 0) / count;

      // Dollar profit calculations using actual trade takeProfit/loss
      const totalProfitUSD = items.reduce((sum, t) => sum + getTradeProfitUSD(t), 0);
      const avgProfitUSD = count ? totalProfitUSD / count : 0;

      const mistakeMap = {};
      items.flatMap(t => t.mistakes || []).filter(m => m && m !== 'None').forEach(m => {
        mistakeMap[m] = (mistakeMap[m] || 0) + 1;
      });
      const topMistakes = Object.entries(mistakeMap).sort((a, b) => b[1] - a[1]).slice(0, 3);

      const emotionMap = {};
      items.forEach(t => {
        if (t.emotion) emotionMap[t.emotion] = (emotionMap[t.emotion] || 0) + 1;
      });
      const topEmotion = Object.entries(emotionMap).sort((a, b) => b[1] - a[1])[0];

      // Winning trades for best trade
      const winningTrades = items.filter(t => t.result === 'WIN' || getTradeProfitUSD(t) > 0);
      const bestTrade = winningTrades.length > 0
        ? [...winningTrades].sort((a, b) => getTradeProfitUSD(b) - getTradeProfitUSD(a))[0]
        : (items.length ? [...items].sort((a, b) => getTradeProfitUSD(b) - getTradeProfitUSD(a))[0] : null);

      // Only consider actual losing trades for worst trade
      const losingTrades = items.filter(t => t.result === 'LOSS' || getTradeProfitUSD(t) < 0 || (t.rResult !== undefined && t.rResult < 0));
      const worstTrade = losingTrades.length > 0
        ? [...losingTrades].sort((a, b) => getTradeProfitUSD(a) - getTradeProfitUSD(b))[0]
        : null;

      return {
        hasData: true,
        tradeCount: count,
        winRate,
        totalR,
        avgR,
        totalProfitUSD,
        avgProfitUSD,
        earlyExits,
        earlyExitPct: (earlyExits / count) * 100,
        avgDiscipline,
        bestTrade,
        worstTrade,
        hasLosses: losingTrades.length > 0,
        topMistakes,
        topEmotion: topEmotion ? topEmotion[0] : 'None'
      };
    };

    res.json({
      success: true,
      reviews: {
        daily: buildReviewStats(dailyTrades) || { hasData: false, message: 'No trades recorded today.' },
        weekly: buildReviewStats(weeklyTrades) || { hasData: false, message: 'No trades recorded in the past 7 days.' },
        monthly: buildReviewStats(monthlyTrades) || { hasData: false, message: 'No trades recorded in the past 30 days.' },
        yearly: buildReviewStats(yearlyTrades) || { hasData: false, message: 'No trades recorded in the past 365 days.' }
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getReviews };
