const Trade = require('../models/Trade');

const formatR = (value) => {
  const numeric = Number(value || 0);
  return `${numeric >= 0 ? '+' : ''}${numeric.toFixed(2)}R`;
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
    const winRate = (wins.length / totalTrades) * 100;
    const avgR = totalR / totalTrades;

    // Strengths
    const strengths = [];
    const aPlus = trades.filter(t => t.setupRating === 'A+');
    if (aPlus.length) {
      const aPlusWinRate = (aPlus.filter(t => t.result === 'WIN').length / aPlus.length) * 100;
      strengths.push(`A+ setups demonstrate a ${aPlusWinRate.toFixed(1)}% win rate across ${aPlus.length} trades.`);
    }

    const sessionMap = {};
    for (const t of trades) {
      if (!sessionMap[t.session]) sessionMap[t.session] = { count: 0, r: 0 };
      sessionMap[t.session].count++;
      sessionMap[t.session].r += (t.rResult || 0);
    }
    const bestSession = Object.entries(sessionMap).sort((a, b) => b[1].r - a[1].r)[0];
    if (bestSession && bestSession[1].r > 0) {
      strengths.push(`${bestSession[0]} session is your highest generator, delivering ${formatR(bestSession[1].r)}.`);
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
          avgR: formatR(avgR),
          tone: avgR >= 0 ? 'positive' : 'negative'
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

// @desc    Ask Live AI Coach (OpenAI integration) grounded strictly in user's trade history
// @route   POST /api/ai/chat
// @access  Private
const askAiCoach = async (req, res, next) => {
  try {
    const { question, userApiKey, userModel } = req.body;
    const userId = req.user._id;

    if (!question || !question.trim()) {
      return res.status(400).json({ success: false, message: 'Please provide a question' });
    }

    const apiKey = userApiKey?.trim() || req.user.settings?.aiApiKey || process.env.OPENAI_API_KEY;
    const model = userModel || req.user.settings?.aiModel || 'gpt-4o-mini';

    const trades = await Trade.find({ userId }).sort({ date: -1, time: -1 }).limit(25).lean();

    if (!trades.length) {
      return res.json({
        success: true,
        answer: 'Not enough data yet. Add at least a few trades to receive personalized AI coaching.'
      });
    }

    if (!apiKey) {
      // Grounded deterministic fallback response when no API key is provided
      const totalR = trades.reduce((sum, t) => sum + (t.rResult || 0), 0);
      const earlyExits = trades.filter(t => t.earlyExitFlag === 1).length;
      return res.json({
        success: true,
        answer: `[Grounded Offline AI Mode]\n\nBased on your last ${trades.length} recorded trades:\n- Total R: ${formatR(totalR)}\n- Early exits: ${earlyExits}\n- Highest friction mistake: ${(trades.flatMap(t => t.mistakes || []).filter(m => m !== 'None')[0]) || 'None'}\n\nTo unlock live GPT-4o conversational coaching, provide an OpenAI API key in your AI Settings.`
      });
    }

    const safeTrades = trades.map(t => ({
      name: t.tradeName,
      date: t.date,
      session: t.session,
      instrument: t.instrument,
      setup: t.setupRating,
      result: t.result,
      rr: t.rr,
      rResult: t.rResult,
      emotion: t.emotion,
      earlyExit: t.reasonEarlyExit,
      mistakes: t.mistakes,
      notes: t.notes
    }));

    const prompt = `
You are an expert trading psychology and execution coach. Analyze the user's recorded journal data only.

STRICT CONSTRAINTS:
1. Never invent or hallucinate trades.
2. If there is not enough evidence for an assertion, explicitly state "Not enough data yet."
3. Distinguish FACT, PATTERN, POSSIBLE EXPLANATION, and SUGGESTION.
4. Do not predict future market prices.
5. Provide actionable, concise advice.

RECENT TRADES (${safeTrades.length}):
${JSON.stringify(safeTrades, null, 2)}

USER QUESTION:
${question}
`;

    const apiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: 'You are a disciplined, professional trading coach specializing in forex/CFDs. Provide advice strictly grounded in the user journal facts.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.4
      })
    });

    if (!apiResponse.ok) {
      const errText = await apiResponse.text();
      return res.status(apiResponse.status).json({
        success: false,
        message: `OpenAI API Error: ${errText}`
      });
    }

    const data = await apiResponse.json();
    const answer = data.choices?.[0]?.message?.content || 'No response returned from AI.';

    res.json({ success: true, answer });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getRuleBasedCoachAnalysis,
  askAiCoach
};
