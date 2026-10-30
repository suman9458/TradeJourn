const Trade = require('../models/Trade');
const User = require('../models/User');
const { processAiCoachChat, cleanAiText } = require('../services/ai/aiCoachService');
const {
  listUserConversations,
  getOrCreateConversation,
  deleteConversation
} = require('../services/ai/conversationContextManager');


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

// @desc    Deterministic rule-based AI coach analysis grounded strictly in journal data
// @route   GET /api/ai/coach
// @access  Private
const getRuleBasedCoachAnalysis = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const trades = await Trade.find({ userId }).sort({ date: -1, time: -1 }).lean();

    if (!trades.length) {
      return res.json({
        success: true,
        hasData: false,
        message: 'No trades yet. Add trades to unlock the AI review.'
      });
    }

    const totalTrades = trades.length;
    const wins = trades.filter(t => t.result === 'WIN');
    const totalR = trades.reduce((sum, t) => sum + (t.rResult || 0), 0);
    const totalProfitUSD = trades.reduce((sum, t) => {
      let p = getTradeProfitUSD(t);
      if (p === 0 && t.rResult) p = Math.round(t.rResult * 100);
      return sum + p;
    }, 0);
    const winRate = (wins.length / totalTrades) * 100;
    const avgR = totalR / totalTrades;
    const avgProfitUSD = totalTrades ? totalProfitUSD / totalTrades : 0;

    // Strengths
    const strengths = [];
    const aPlus = trades.filter(t => t.setupRating === 'A+');
    if (aPlus.length) {
      const aPlusWinRate = (aPlus.filter(t => t.result === 'WIN').length / aPlus.length) * 100;
      strengths.push(`A+ setups demonstrate a ${aPlusWinRate.toFixed(1)}% win rate across ${aPlus.length} trades.`);
    }

    const sessionMap = {};
    for (const t of trades) {
      const sess = t.session || 'Unknown';
      if (!sessionMap[sess]) sessionMap[sess] = { count: 0, r: 0, usd: 0 };
      sessionMap[sess].count++;
      sessionMap[sess].r += (t.rResult || 0);
      let p = getTradeProfitUSD(t);
      if (p === 0 && t.rResult) p = Math.round(t.rResult * 100);
      sessionMap[sess].usd += p;
    }
    const bestSession = Object.entries(sessionMap).sort((a, b) => b[1].usd - a[1].usd)[0];
    if (bestSession && (bestSession[1].usd > 0 || bestSession[1].r > 0)) {
      const pUsd = bestSession[1].usd !== 0 ? bestSession[1].usd : Math.round(bestSession[1].r * 100);
      const profitStr = pUsd >= 0 ? `+$${Math.round(pUsd).toLocaleString()} profit` : `-$${Math.round(Math.abs(pUsd)).toLocaleString()} loss`;
      strengths.push(`${bestSession[0]} session is your highest generator, delivering ${profitStr}.`);
    }

    const highDiscipline = trades.filter(t => t.disciplineScore >= 75).length;
    if (highDiscipline) {
      strengths.push(`${highDiscipline} trades (${((highDiscipline / totalTrades) * 100).toFixed(0)}%) maintained a discipline score >= 75.`);
    }

    // Repeated mistakes
    const mistakeMap = {};
    trades.forEach(t => {
      (t.mistakes || []).filter(m => m && m !== 'None').forEach(m => {
        mistakeMap[m] = (mistakeMap[m] || 0) + 1;
      });
    });
    const repeatedMistakes = Object.entries(mistakeMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    // Emotions
    const emotionEffects = [];
    const emotions = ['Calm', 'Fear', 'FOMO', 'Revenge', 'Impatient', 'Overconfident'];
    for (const emotion of emotions) {
      const items = trades.filter(t => t.emotion === emotion);
      if (!items.length) continue;
      const avg = items.reduce((sum, t) => sum + (t.rResult || 0), 0) / items.length;
      emotionEffects.push({ emotion, count: items.length, avgR: formatR(avg) });
    }

    // Suggestions
    const suggestions = [];
    const earlyExits = trades.filter(t => t.earlyExitFlag === 1).length;
    if (earlyExits > 0) {
      suggestions.push(`Reduce premature exits (${earlyExits} recorded). Let winners develop to technical take-profit.`);
    }
    if (repeatedMistakes.some(m => ['FOMO', 'Revenge Trading', 'Moved SL'].includes(m.name))) {
      suggestions.push('Enforce strict psychological cool-downs after losing trades to prevent impulse entries.');
    }
    if (trades.filter(t => t.confirmation === 'No').length > 0) {
      suggestions.push('Eliminate unconfirmed market entries; ensure multi-timeframe alignment before entering.');
    }
    if (!suggestions.length) {
      suggestions.push('Process execution is solid. Continue respecting risk limits and journaling notes.');
    }

    res.json({
      success: true,
      hasData: true,
      data: {
        summary: {
          totalTrades,
          winRate: Number(winRate.toFixed(1)),
          totalR: formatR(totalR),
          totalProfitUSD: Math.round(totalProfitUSD),
          avgR: formatR(avgR),
          avgProfitUSD: Math.round(avgProfitUSD),
          tone: totalProfitUSD >= 0 ? 'positive' : 'negative'
        },
        strengths,
        repeatedMistakes,
        emotionEffects,
        suggestions,
        nextSessionPlan: {
          beforeTrading: 'Review HTF bias, key liquidity pools, and max daily risk limits.',
          duringTrading: 'Wait for candle close confirmation. Do not touch stop-loss emotionally.',
          afterTrading: 'Log notes, screenshot the chart, record emotional state, and score discipline.'
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

const cleanAiOutput = (text) => {
  if (!text) return '';
  return text
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/\(\s*([+-]?\d+(?:\.\d+)?R)\s*\/\s*\$0\s*\)/gi, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
};

// @desc    Ask Live AI Coach (Gemini integration with Tool Calling, Grounded Analytics & Multimodal Vision)
// @route   POST /api/ai/chat
// @access  Private
const askAiCoach = async (req, res, next) => {
  try {
    const { question, messages, image, userApiKey, userModel, userProvider, conversationId } = req.body;

    if (!question || !question.trim()) {
      return res.status(400).json({ success: false, message: 'Please provide a valid question' });
    }

    const isAdmin = req.user.role === 'admin';
    const effectiveModel = userModel || req.user.settings?.aiModel || 'gemini-2.0-flash';
    const effectiveApiKey = isAdmin ? (userApiKey || req.user.settings?.geminiApiKey) : undefined;

    const result = await processAiCoachChat({
      question: question.trim(),
      messages: Array.isArray(messages) ? messages : [],
      image: image || null,
      userModel: effectiveModel,
      userApiKey: effectiveApiKey,
      user: req.user,
      conversationId: conversationId || null
    });

    if (result && result.code === 'FORBIDDEN') {
      return res.status(403).json(result);
    }

    res.json(result);
  } catch (error) {
    next(error);
  }
};

// @desc    List all active conversations for the authenticated user
// @route   GET /api/ai/conversations
// @access  Private
const getConversations = async (req, res, next) => {
  try {
    const conversations = await listUserConversations(req.user._id);
    res.json({ success: true, conversations });
  } catch (error) {
    next(error);
  }
};

// @desc    Get a single conversation by ID (strictly isolated to authenticated user)
// @route   GET /api/ai/conversations/:id
// @access  Private
const getConversationById = async (req, res, next) => {
  try {
    const convLookup = await getOrCreateConversation(req.user._id, req.params.id);
    if (convLookup.forbidden) {
      return res.status(403).json({ success: false, message: 'Access denied: Conversation belongs to another user.' });
    }
    if (convLookup.deleted || convLookup.expired || convLookup.notFound) {
      return res.status(404).json({ success: false, message: 'Conversation not found or expired.' });
    }
    res.json({ success: true, conversation: convLookup.conversation });
  } catch (error) {
    next(error);
  }
};

// @desc    Soft-delete conversation history
// @route   DELETE /api/ai/conversations/:id
// @access  Private
const deleteConversationById = async (req, res, next) => {
  try {
    const success = await deleteConversation(req.user._id, req.params.id);
    if (!success) {
      return res.status(404).json({ success: false, message: 'Conversation not found or already deleted.' });
    }
    res.json({ success: true, message: 'Conversation deleted successfully.' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getRuleBasedCoachAnalysis,
  askAiCoach,
  getConversations,
  getConversationById,
  deleteConversationById
};
