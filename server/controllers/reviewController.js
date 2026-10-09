const Trade = require('../models/Trade');

const formatR = (value) => {
  const numeric = Number(value || 0);
  return `${numeric >= 0 ? '+' : ''}${numeric.toFixed(2)}R`;
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
          monthly: { hasData: false, message: 'No trades recorded yet for review.' }
        }
      });
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const past7Str = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const past30Str = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const dailyTrades = trades.filter(t => t.date === todayStr);
    const weeklyTrades = trades.filter(t => t.date >= past7Str);
    const monthlyTrades = trades.filter(t => t.date >= past30Str);

    const buildReviewStats = (items) => {
      if (!items.length) return null;
      const count = items.length;
      const wins = items.filter(t => t.result === 'WIN').length;
      const totalR = items.reduce((sum, t) => sum + (t.rResult || 0), 0);
      const avgR = totalR / count;
      const winRate = (wins / count) * 100;
      const earlyExits = items.filter(t => t.earlyExitFlag === 1).length;
      const avgDiscipline = items.reduce((sum, t) => sum + (t.disciplineScore || 0), 0) / count;

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

      const bestTrade = [...items].sort((a, b) => b.rResult - a.rResult)[0];
      const worstTrade = [...items].sort((a, b) => a.rResult - b.rResult)[0];

      return {
        hasData: true,
        tradeCount: count,
        winRate,
        totalR,
        avgR,
        earlyExits,
        earlyExitPct: (earlyExits / count) * 100,
        avgDiscipline,
        bestTrade,
        worstTrade,
        topMistakes,
        topEmotion: topEmotion ? topEmotion[0] : 'None'
      };
    };

    res.json({
      success: true,
      reviews: {
        daily: buildReviewStats(dailyTrades) || { hasData: false, message: 'No trades recorded today.' },
        weekly: buildReviewStats(weeklyTrades) || { hasData: false, message: 'No trades recorded in the past 7 days.' },
        monthly: buildReviewStats(monthlyTrades) || { hasData: false, message: 'No trades recorded in the past 30 days.' }
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getReviews };
