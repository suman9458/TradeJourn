const Trade = require('../models/Trade');
const User = require('../models/User');


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
    const { question, userApiKey, userModel, userProvider } = req.body;
    const userId = req.user._id;

    if (!question || !question.trim()) {
      return res.status(400).json({ success: false, message: 'Please provide a question' });
    }

    // Determine provider: 'gemini' or 'openai'
    const isAdmin = req.user.role === 'admin';
    let provider = userProvider || req.user.settings?.aiProvider || 'gemini';

    // Non-admin users or requests with a gemini model ALWAYS use Gemini
    if (!isAdmin || !userModel || userModel.startsWith('gemini')) {
      provider = 'gemini';
    } else if (userModel?.startsWith('gpt')) {
      provider = 'openai';
    } else if (userApiKey?.startsWith('AIza')) {
      provider = 'gemini';
    } else if (userApiKey?.startsWith('sk-')) {
      provider = 'openai';
    }

    const trades = await Trade.find({ userId }).sort({ date: -1, time: -1 }).limit(25).lean();

    const safeTrades = (trades || []).map(t => ({
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

    // Pre-calculate aggregate metrics for instantaneous, accurate answers
    const totalTradesCount = safeTrades.length;
    const winsCount = safeTrades.filter(t => t.result === 'WIN' || Number(t.rResult || 0) > 0).length;
    const overallWinRate = totalTradesCount ? Math.round((winsCount / totalTradesCount) * 100) : 0;
    const totalRNet = safeTrades.reduce((sum, t) => sum + Number(t.rResult || 0), 0);

    const setupBreakdown = {};
    safeTrades.forEach(t => {
      const s = (t.setup || 'Unrated').trim();
      if (!setupBreakdown[s]) setupBreakdown[s] = { total: 0, wins: 0, r: 0 };
      setupBreakdown[s].total += 1;
      if (t.result === 'WIN' || Number(t.rResult || 0) > 0) setupBreakdown[s].wins += 1;
      setupBreakdown[s].r += Number(t.rResult || 0);
    });

    const setupSummaryList = Object.entries(setupBreakdown).map(([name, stat]) => {
      const winRate = Math.round((stat.wins / stat.total) * 100);
      return `${name}: ${stat.total} trades, ${winRate}% win rate, ${stat.r >= 0 ? '+' : ''}${stat.r.toFixed(1)}R`;
    }).join('; ') || 'No trades logged yet';

    const sessionBreakdown = {};
    safeTrades.forEach(t => {
      const s = t.session || 'Unknown';
      if (!sessionBreakdown[s]) sessionBreakdown[s] = { total: 0, wins: 0, r: 0 };
      sessionBreakdown[s].total += 1;
      if (t.result === 'WIN' || Number(t.rResult || 0) > 0) sessionBreakdown[s].wins += 1;
      sessionBreakdown[s].r += Number(t.rResult || 0);
    });

    const sessionSummaryList = Object.entries(sessionBreakdown).map(([name, stat]) => {
      const winRate = Math.round((stat.wins / stat.total) * 100);
      return `${name}: ${stat.total} trades, ${winRate}% win rate, ${stat.r >= 0 ? '+' : ''}${stat.r.toFixed(1)}R`;
    }).join('; ') || 'No sessions logged yet';

    const mistakeCounts = {};
    safeTrades.forEach(t => {
      (t.mistakes || []).forEach(m => {
        if (m && m !== 'None') mistakeCounts[m] = (mistakeCounts[m] || 0) + 1;
      });
    });
    const topMistake = Object.entries(mistakeCounts).sort((a,b) => b[1] - a[1])[0];

    const prompt = `You are a real, friendly, expert trading coach. Answer the trader directly in simple, natural human language.

STRICT RULES:
1. Speak in simple, natural conversational language (2 to 4 sentences max).
2. NEVER use robotic headers like "### FACT", "### PATTERN", "### SUGGESTION", or long academic text.
3. If the user greets you (e.g., "hi", "hello", "hey"), greet them warmly back like: "Hey! Ready to review your trades or help you with your strategy. What's on your mind today?"
4. If the user asks general trading, technical, risk management, or psychological questions, answer clearly and helpfully.
5. If the user asks about their specific performance/setups:
   - If they have logged trades (${totalTradesCount} trades logged), cite their exact stats (${overallWinRate}% win rate, ${totalRNet.toFixed(1)}R net).
   - If they have not logged trades yet (0 trades), let them know in a friendly way that once they log their first trades you'll analyze their setups, but still give them great trading advice.
6. If the user asks in Hindi/Hinglish, reply in natural Hinglish or simple English.
7. Fast, clear, punchy, zero fluff.

JOURNAL STATS:
- Total Trades Logged: ${totalTradesCount}
- Overall Win Rate: ${overallWinRate}%
- Net Profit: ${totalRNet.toFixed(1)}R
- Setups: ${setupSummaryList}
- Sessions: ${sessionSummaryList}
- Top Mistake: ${topMistake ? `${topMistake[0]} (${topMistake[1]} times)` : 'None'}

USER QUESTION:
${question}
`;

    // -------------------------------------------------------------------------
    // 1. GOOGLE GEMINI (FREE TIER RECOMMENDED)
    // -------------------------------------------------------------------------
    if (provider === 'gemini') {
      let apiKey = userApiKey?.trim() || req.user.settings?.geminiApiKey || process.env.GEMINI_API_KEY;

      // If user has no key, automatically fallback to Admin's configured Gemini key
      if (!apiKey) {
        const adminUser = await User.findOne({
          role: 'admin',
          'settings.geminiApiKey': { $exists: true, $ne: '' }
        }).lean();
        if (adminUser?.settings?.geminiApiKey) {
          apiKey = adminUser.settings.geminiApiKey.trim();
        }
      }

      if (!apiKey) {
        const totalR = trades.reduce((sum, t) => sum + (t.rResult || 0), 0);
        const isAdminUser = req.user?.role === 'admin';
        return res.json({
          success: true,
          answer: isAdminUser
            ? `Based on your recent trades, your win rate is ${overallWinRate}% with ${formatR(totalR)} total profit. Top setup is ${Object.keys(setupBreakdown)[0] || 'A+'}.\n\n💡 Admin setup: Paste and save your free Gemini API key in the admin panel above to enable AI chat for yourself and all users!`
            : `Based on your recent trades, your win rate is ${overallWinRate}% with ${formatR(totalR)} total profit. Top setup is ${Object.keys(setupBreakdown)[0] || 'A+'}.\n\nAI Coach live engine is currently pending activation by the administrator.`
        });
      }

      // Helper function to query available models supported for this key
      const fetchAvailableGeminiModels = async (key) => {
        try {
          const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
          if (listRes.ok) {
            const listData = await listRes.json();
            return (listData.models || [])
              .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
              .map(m => m.name.replace(/^models\//, ''));
          }
        } catch (e) {
          // ignore error
        }
        return [];
      };

      let requestedModel = (userModel && (userModel.startsWith('gemini') || userModel === 'auto'))
        ? userModel
        : (req.user.settings?.aiModel?.startsWith('gemini') ? req.user.settings.aiModel : 'auto');

      // Primary modern model recommended by Google AI Studio
      let targetModel = (requestedModel === 'auto' || requestedModel === 'gemini-1.5-flash' || requestedModel === 'gemini-2.5-flash')
        ? 'gemini-3.8-flash'
        : requestedModel;

      // Function to attempt generateContent with a specific model
      const attemptGenerate = async (m) => {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
        return fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 300 }
          })
        });
      };

      let geminiResponse = await attemptGenerate(targetModel);

      // If the model was not found (404) or retired (400), dynamically fallback
      if (!geminiResponse.ok) {
        const available = await fetchAvailableGeminiModels(apiKey);
        const preferredList = [
          'gemini-3.8-flash',
          'gemini-3.5-flash',
          'gemini-3.8-pro',
          'gemini-3.5-pro',
          'gemini-2.5-flash',
          'gemini-2.0-flash'
        ];

        let alternate = preferredList.find(p => p !== targetModel && (available.length === 0 || available.includes(p)));
        if (!alternate && available.length > 0) {
          alternate = available.find(a => a !== targetModel && a.includes('flash')) ||
                      available.find(a => a !== targetModel && a.includes('gemini')) ||
                      available[0];
        }

        if (alternate && alternate !== targetModel) {
          targetModel = alternate;
          const retryResponse = await attemptGenerate(targetModel);
          if (retryResponse.ok) {
            geminiResponse = retryResponse;
          }
        }
      }

      if (!geminiResponse.ok) {
        const errJson = await geminiResponse.json().catch(() => null);
        const errMessage = errJson?.error?.message || (await geminiResponse.text().catch(() => 'Gemini error'));
        return res.status(geminiResponse.status).json({
          success: false,
          message: `Google Gemini API Error: ${errMessage}`
        });
      }

      const data = await geminiResponse.json();
      const answer = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated by Gemini.';
      return res.json({ success: true, answer, provider: 'gemini', model: targetModel });
    }

    // -------------------------------------------------------------------------
    // 2. OPENAI (GPT-4o)
    // -------------------------------------------------------------------------
    let apiKey = userApiKey?.trim() || req.user.settings?.aiApiKey || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      const adminUser = await User.findOne({
        role: 'admin',
        'settings.aiApiKey': { $exists: true, $ne: '' }
      }).lean();
      if (adminUser?.settings?.aiApiKey) {
        apiKey = adminUser.settings.aiApiKey.trim();
      }
    }

    const model = (userModel && !userModel.startsWith('gemini'))
      ? userModel
      : (req.user.settings?.aiModel && !req.user.settings?.aiModel.startsWith('gemini') ? req.user.settings.aiModel : 'gpt-4o-mini');

    if (!apiKey) {
      const totalR = trades.reduce((sum, t) => sum + (t.rResult || 0), 0);
      const earlyExits = trades.filter(t => t.earlyExitFlag === 1).length;
      const isAdminUser = req.user?.role === 'admin';
      return res.json({
        success: true,
        answer: isAdminUser
          ? `[Grounded Offline AI Mode]\n\nBased on your last ${trades.length} recorded trades:\n- Total R: ${formatR(totalR)}\n- Early exits: ${earlyExits}\n- Highest friction mistake: ${(trades.flatMap(t => t.mistakes || []).filter(m => m !== 'None')[0]) || 'None'}\n\n💡 Admin setup: Provide an OpenAI API key or switch to Google Gemini (Free) in the admin panel above.`
          : `[Offline AI Mode]\n\nBased on your last ${trades.length} recorded trades:\n- Total R: ${formatR(totalR)}\n- Early exits: ${earlyExits}\n\nAI Coach is pending key activation by the administrator.`
      });
    }

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
            content: 'You are a real, friendly trading mentor. Answer directly in natural, simple human language without robotic headers or fluff.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2,
        max_tokens: 300
      })
    });

    if (!apiResponse.ok) {
      const errText = await apiResponse.text();

      // If OpenAI failed (e.g. quota exceeded / no credits), seamlessly fallback to Gemini
      let fallbackGeminiKey = req.user.settings?.geminiApiKey || process.env.GEMINI_API_KEY;
      if (!fallbackGeminiKey) {
        const adminUser = await User.findOne({
          role: 'admin',
          'settings.geminiApiKey': { $exists: true, $ne: '' }
        }).lean();
        fallbackGeminiKey = adminUser?.settings?.geminiApiKey?.trim();
      }

      if (fallbackGeminiKey) {
        try {
          const gemRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${fallbackGeminiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.2, maxOutputTokens: 300 }
            })
          });
          if (gemRes.ok) {
            const gemData = await gemRes.json();
            const fallbackAnswer = gemData.candidates?.[0]?.content?.parts?.[0]?.text;
            if (fallbackAnswer) {
              return res.json({ success: true, answer: fallbackAnswer, provider: 'gemini', model: 'gemini-3.8-flash' });
            }
          }
        } catch (e) {
          // ignore error
        }
      }

      return res.status(apiResponse.status).json({
        success: false,
        message: `OpenAI API Error: ${errText}`
      });
    }

    const data = await apiResponse.json();
    const answer = data.choices?.[0]?.message?.content || 'No response returned from AI.';

    res.json({ success: true, answer, provider: 'openai', model });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getRuleBasedCoachAnalysis,
  askAiCoach
};
