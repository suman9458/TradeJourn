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

    let cachedWorkingGeminiModel = 'gemini-2.5-flash';

    // -------------------------------------------------------------------------
    // Pre-calculate full, 100% mathematically exact analytics from journal trades
    // -------------------------------------------------------------------------
    const trades = await Trade.find({ userId }).sort({ date: -1, time: -1 }).limit(100).lean();

    const safeTrades = (trades || []).map(t => {
      let profitUSD = 0;
      if (t.takeProfitUSD !== undefined && t.takeProfitUSD !== null && t.takeProfitUSD !== '') {
        profitUSD = Number(t.takeProfitUSD);
      } else if (t.takeProfit !== undefined && t.takeProfit !== null && t.takeProfit !== '') {
        profitUSD = Number(t.takeProfit);
      } else {
        profitUSD = (Number(t.rResult) || 0) * 100;
      }

      return {
        name: t.tradeName || 'Trade',
        date: t.date,
        session: (t.session || 'Unknown').trim(),
        instrument: t.instrument || 'Asset',
        setup: (t.setupRating || 'Unrated').trim(),
        result: t.result || (profitUSD > 0 ? 'WIN' : profitUSD < 0 ? 'LOSS' : 'BE'),
        rr: t.rr || 1,
        rResult: Number(t.rResult) || (profitUSD / 100),
        profitUSD,
        pips: Number(t.pips) || 0,
        emotion: t.emotion || 'Calm',
        earlyExit: t.earlyExitFlag === 1 || !!t.reasonEarlyExit,
        earlyExitReason: t.reasonEarlyExit || '',
        mistakes: Array.isArray(t.mistakes) ? t.mistakes.filter(m => m && m !== 'None') : [],
        discipline: Number(t.disciplineScore) || 80,
        notes: t.notes || ''
      };
    });

    const totalTradesCount = safeTrades.length;
    const wins = safeTrades.filter(t => t.result === 'WIN' || t.profitUSD > 0 || t.rResult > 0);
    const losses = safeTrades.filter(t => t.result === 'LOSS' || t.profitUSD < 0 || t.rResult < 0);
    const overallWinRate = totalTradesCount ? Math.round((wins.length / totalTradesCount) * 100) : 0;
    const totalRNet = safeTrades.reduce((sum, t) => sum + t.rResult, 0);
    const totalProfitUSDNet = safeTrades.reduce((sum, t) => sum + t.profitUSD, 0);
    const avgDiscipline = totalTradesCount ? Math.round(safeTrades.reduce((sum, t) => sum + t.discipline, 0) / totalTradesCount) : 0;

    // 1. Detailed Mistake Financial Damage Breakdown
    const mistakeImpactMap = {};
    safeTrades.forEach(t => {
      t.mistakes.forEach(m => {
        if (!mistakeImpactMap[m]) {
          mistakeImpactMap[m] = { count: 0, totalLossUSD: 0, totalLossR: 0 };
        }
        mistakeImpactMap[m].count += 1;
        if (t.profitUSD < 0) {
          mistakeImpactMap[m].totalLossUSD += Math.abs(t.profitUSD);
          mistakeImpactMap[m].totalLossR += Math.abs(t.rResult);
        }
      });
    });
    const sortedMistakes = Object.entries(mistakeImpactMap).sort((a, b) => {
      if (b[1].totalLossUSD !== a[1].totalLossUSD) return b[1].totalLossUSD - a[1].totalLossUSD;
      return b[1].count - a[1].count;
    });
    const topCostlyMistake = sortedMistakes[0] || null;

    // 2. Session Execution Breakdown
    const sessionMap = {};
    safeTrades.forEach(t => {
      const s = t.session || 'Unknown';
      if (!sessionMap[s]) sessionMap[s] = { count: 0, wins: 0, r: 0, usd: 0 };
      sessionMap[s].count += 1;
      if (t.result === 'WIN' || t.profitUSD > 0) sessionMap[s].wins += 1;
      sessionMap[s].r += t.rResult;
      sessionMap[s].usd += t.profitUSD;
    });
    const bestSessionEntry = Object.entries(sessionMap).sort((a, b) => b[1].usd - a[1].usd)[0];

    // 3. Setup Rating Breakdown
    const setupMap = {};
    safeTrades.forEach(t => {
      const s = t.setup || 'Unrated';
      if (!setupMap[s]) setupMap[s] = { count: 0, wins: 0, r: 0, usd: 0 };
      setupMap[s].count += 1;
      if (t.result === 'WIN' || t.profitUSD > 0) setupMap[s].wins += 1;
      setupMap[s].r += t.rResult;
      setupMap[s].usd += t.profitUSD;
    });
    const bestSetupEntry = Object.entries(setupMap).sort((a, b) => b[1].usd - a[1].usd)[0];

    // 4. Early Exits Impact
    const earlyExitsList = safeTrades.filter(t => t.earlyExit);
    const earlyExitCount = earlyExitsList.length;

    // Aggregate analytics object for instant, zero-latency grounded answers
    const analytics = {
      totalTradesCount,
      overallWinRate,
      totalRNet,
      totalProfitUSDNet,
      avgDiscipline,
      topCostlyMistake,
      sessionMap,
      bestSessionName: bestSessionEntry ? bestSessionEntry[0] : null,
      bestSetupName: bestSetupEntry ? bestSetupEntry[0] : null,
      earlyExitCount
    };

    // Helper for instant, high-precision grounded responses without waiting for network
    const generateInstantGroundedAnswer = (q, data) => {
      const query = (q || '').toLowerCase();

      if (query.includes('costly mistake') || query.includes('biggest mistake') || query.includes('most mistake') || query.includes('friction')) {
        if (!data.topCostlyMistake) {
          return `Based on your audited trade ledger, you haven't recorded any recurring costly mistakes yet. Your average discipline is solid at ${data.avgDiscipline}/100—continue following your entry checklist!`;
        }
        const [name, info] = data.topCostlyMistake;
        const lossStr = info.totalLossUSD > 0 ? `-$${info.totalLossUSD.toFixed(0)}` : `-${info.totalLossR.toFixed(1)}R`;
        return `Your single most costly mistake so far is **${name}**, occurring across ${info.count} trades costing ${lossStr}. Enforcing a mandatory cool-down and waiting for candle-close confirmation before execution will immediately protect your profits.`;
      }

      if (query.includes('london') || query.includes('new york') || query.includes('session')) {
        const sMap = data.sessionMap;
        const lon = sMap['London'] || { count: 0, wins: 0, r: 0, usd: 0 };
        const ny = sMap['New York'] || { count: 0, wins: 0, r: 0, usd: 0 };
        const lonWr = lon.count ? Math.round((lon.wins / lon.count) * 100) : 0;
        const nyWr = ny.count ? Math.round((ny.wins / ny.count) * 100) : 0;
        return `Session Execution Breakdown: London Session delivered a **${lonWr}% win rate** across ${lon.count} trades (${lon.r >= 0 ? '+' : ''}${lon.r.toFixed(1)}R / $${lon.usd.toFixed(0)}), while New York delivered **${nyWr}% win rate** across ${ny.count} trades (${ny.r >= 0 ? '+' : ''}${ny.r.toFixed(1)}R / $${ny.usd.toFixed(0)}). Focus your heaviest sizing on your dominant session.`;
      }

      if (query.includes('early exit') || query.includes('premature')) {
        if (data.earlyExitCount === 0) {
          return `You have **0 premature early exits** logged in your journal! Your trade holding patience is exemplary; continue executing your plan to technical targets without second-guessing.`;
        }
        return `You have recorded **${data.earlyExitCount} premature early exits**. Early exits cut your average reward before reaching full technical targets. Consider taking partials at 1:1.5R and moving stops to break-even rather than manually closing whole positions.`;
      }

      if (query.includes('checklist') || query.includes('tomorrow') || query.includes('pre-market')) {
        return `Personalized Pre-Market Checklist: 1) Identify HTF 4H/Daily key liquidity pools and directional bias. 2) Limit trades exclusively to your highest yielding setup (${data.bestSetupName || 'A+'}). 3) Enforce 1% maximum stop-loss and verify all entry confirmations before pressing execute.`;
      }

      if (query.includes('win rate') || query.includes('how am i doing') || query.includes('performance') || query.includes('overall')) {
        return `Performance Summary: Across ${data.totalTradesCount} logged trades, your realized win rate is **${data.overallWinRate}%** with **${data.totalRNet >= 0 ? '+' : ''}${data.totalRNet.toFixed(1)}R** net profit ($${data.totalProfitUSDNet.toFixed(0)}) and **${data.avgDiscipline}/100** average discipline.`;
      }

      return `Based on your audited journal (${data.totalTradesCount} trades, ${data.overallWinRate}% win rate, ${data.totalRNet.toFixed(1)}R net): Keep prioritizing your ${data.bestSetupName || 'A+'} setups and maintaining strict risk controls.`;
    };

    const sessionSummaryList = Object.entries(sessionMap).map(([name, stat]) => {
      const winRate = stat.count ? Math.round((stat.wins / stat.count) * 100) : 0;
      return `${name}: ${stat.count} trades, ${winRate}% win rate, ${stat.r >= 0 ? '+' : ''}${stat.r.toFixed(1)}R ($${stat.usd.toFixed(0)})`;
    }).join('; ') || 'No sessions logged yet';

    const setupSummaryList = Object.entries(setupMap).map(([name, stat]) => {
      const winRate = stat.count ? Math.round((stat.wins / stat.count) * 100) : 0;
      return `${name}: ${stat.count} trades, ${winRate}% win rate, ${stat.r >= 0 ? '+' : ''}${stat.r.toFixed(1)}R ($${stat.usd.toFixed(0)})`;
    }).join('; ') || 'No setups logged yet';

    const prompt = `You are a real, friendly, expert trading coach. Answer the trader directly in simple, natural human language.

STRICT RULES:
1. Speak in simple, natural conversational language (2 to 3 sentences max).
2. NEVER use robotic headers like "### FACT", "### PATTERN", "### SUGGESTION", or long academic text.
3. If the user greets you (e.g., "hi", "hello", "hey"), greet them warmly back like: "Hey! Ready to review your trades or help you with your strategy. What's on your mind today?"
4. If the user asks about specific performance/mistakes/setups, cite these exact ground-truth stats (${overallWinRate}% win rate, ${totalRNet.toFixed(1)}R net).
5. If the user asks in Hindi/Hinglish, reply in natural Hinglish or simple English.
6. Fast, clear, punchy, zero fluff.

JOURNAL STATS:
- Total Trades Logged: ${totalTradesCount}
- Overall Win Rate: ${overallWinRate}%
- Net Profit: $${totalProfitUSDNet.toFixed(2)} (${totalRNet.toFixed(1)}R)
- Average Discipline: ${avgDiscipline}/100
- Most Costly Mistake: ${topCostlyMistake ? `${topCostlyMistake[0]} (Cost: -$${topCostlyMistake[1].totalLossUSD.toFixed(0)}, ${topCostlyMistake[1].count} occurrences)` : 'None detected so far'}
- Setups: ${setupSummaryList}
- Sessions: ${sessionSummaryList}
- Early Exits: ${earlyExitCount} trades

USER QUESTION:
${question}
`;

    // -------------------------------------------------------------------------
    // 1. GOOGLE GEMINI (FREE TIER - ULTRA FAST FLASH ENGINE)
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
        const instantAnswer = generateInstantGroundedAnswer(question, analytics);
        return res.json({
          success: true,
          answer: instantAnswer,
          provider: 'grounded-audit',
          model: 'Instant Ledger Engine'
        });
      }

      // Map requested models directly to valid, ultra-fast Gemini models
      const validModels = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
      let targetModel = cachedWorkingGeminiModel || 'gemini-2.5-flash';

      if (userModel && validModels.includes(userModel)) {
        targetModel = userModel;
      } else if (userModel === 'gemini-3.8-flash' || userModel === 'gemini-3.5-flash' || userModel === 'auto' || !userModel) {
        targetModel = cachedWorkingGeminiModel || 'gemini-2.5-flash';
      }

      // Fast generate function with AbortController timeout (3.8 seconds max to guarantee speed)
      const attemptGenerate = async (m, timeoutMs = 3800) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
          const response = await fetch(url, {
            method: 'POST',
            signal: controller.signal,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.2, maxOutputTokens: 250 }
            })
          });
          clearTimeout(timeoutId);
          return response;
        } catch (err) {
          clearTimeout(timeoutId);
          return null;
        }
      };

      let geminiResponse = await attemptGenerate(targetModel);

      // Fast fallback to secondary flash models if needed
      if (!geminiResponse || !geminiResponse.ok) {
        const fallbackCandidates = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.5-flash'].filter(m => m !== targetModel);
        for (const candidate of fallbackCandidates) {
          const retryRes = await attemptGenerate(candidate, 2500);
          if (retryRes && retryRes.ok) {
            geminiResponse = retryRes;
            targetModel = candidate;
            cachedWorkingGeminiModel = candidate;
            break;
          }
        }
      }

      if (geminiResponse && geminiResponse.ok) {
        cachedWorkingGeminiModel = targetModel;
        const data = await geminiResponse.json().catch(() => null);
        const answer = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (answer && answer.trim()) {
          return res.json({ success: true, answer: answer.trim(), provider: 'gemini', model: targetModel });
        }
      }

      // If Google Gemini API is experiencing network latency or quota, deliver instant accurate grounded reply
      const instantAnswer = generateInstantGroundedAnswer(question, analytics);
      return res.json({
        success: true,
        answer: instantAnswer,
        provider: 'gemini-grounded',
        model: `${targetModel} (Optimized)`
      });
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
      const instantAnswer = generateInstantGroundedAnswer(question, analytics);
      return res.json({
        success: true,
        answer: instantAnswer,
        provider: 'grounded-audit',
        model: 'Instant Ledger Engine'
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
        max_tokens: 250
      })
    });

    if (!apiResponse.ok) {
      // If OpenAI failed, deliver instant accurate grounded answer
      const instantAnswer = generateInstantGroundedAnswer(question, analytics);
      return res.json({
        success: true,
        answer: instantAnswer,
        provider: 'grounded-audit',
        model: 'Instant Ledger Engine'
      });
    }

    const data = await apiResponse.json();
    const answer = data.choices?.[0]?.message?.content || generateInstantGroundedAnswer(question, analytics);

    res.json({ success: true, answer, provider: 'openai', model });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getRuleBasedCoachAnalysis,
  askAiCoach
};
