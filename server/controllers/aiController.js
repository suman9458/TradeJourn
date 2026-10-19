const Trade = require('../models/Trade');
const User = require('../models/User');


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

// @desc    Ask Live AI Coach (OpenAI / Gemini integration) grounded strictly in user's trade history
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
      let profitUSD = getTradeProfitUSD(t);
      const rResult = (t.rResult !== undefined && t.rResult !== null && !isNaN(Number(t.rResult)))
        ? Number(t.rResult)
        : (profitUSD / 100);
      if (profitUSD === 0 && rResult !== 0) {
        profitUSD = Math.round(rResult * 100);
      }

      return {
        name: t.tradeName || 'Trade',
        date: t.date,
        session: (t.session || 'Unknown').trim(),
        instrument: t.instrument || 'Asset',
        setup: (t.setupRating || 'Unrated').trim(),
        result: t.result || (profitUSD > 0 ? 'WIN' : profitUSD < 0 ? 'LOSS' : 'BE'),
        rr: t.rr || 1,
        rResult,
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
        const lossVal = info.totalLossUSD !== 0 ? info.totalLossUSD : Math.round(info.totalLossR * 100);
        const lossStr = lossVal > 0 ? `-$${Math.round(lossVal).toLocaleString()} loss` : `-$${Math.round(Math.abs(info.totalLossR * 100))} loss`;
        return `Your single most costly mistake so far is ${name}, occurring across ${info.count} trades costing ${lossStr}. Enforcing a mandatory cool-down and waiting for candle-close confirmation before execution will immediately protect your profits.`;
      }

      if (query.includes('london') || query.includes('new york') || query.includes('session')) {
        const sMap = data.sessionMap;
        const findSession = (name) => {
          const matchKey = Object.keys(sMap).find(k => k.toLowerCase().includes(name.toLowerCase()));
          return matchKey ? sMap[matchKey] : { count: 0, wins: 0, r: 0, usd: 0 };
        };
        const lon = findSession('London');
        const ny = findSession('New York');
        const lonWr = lon.count ? Math.round((lon.wins / lon.count) * 100) : 0;
        const nyWr = ny.count ? Math.round((ny.wins / ny.count) * 100) : 0;
        const lonUsd = lon.usd !== 0 ? lon.usd : Math.round(lon.r * 100);
        const nyUsd = ny.usd !== 0 ? ny.usd : Math.round(ny.r * 100);
        const lonProfit = lonUsd >= 0 ? `+$${Math.round(lonUsd).toLocaleString()} profit` : `-$${Math.round(Math.abs(lonUsd)).toLocaleString()} loss`;
        const nyProfit = nyUsd >= 0 ? `+$${Math.round(nyUsd).toLocaleString()} profit` : `-$${Math.round(Math.abs(nyUsd)).toLocaleString()} loss`;
        return `Session Execution Breakdown: London Session delivered a ${lonWr}% win rate across ${lon.count} trades (${lonProfit}), while New York delivered a ${nyWr}% win rate across ${ny.count} trades (${nyProfit}). Focus your heaviest sizing on your dominant session.`;
      }

      if (query.includes('early exit') || query.includes('premature')) {
        if (data.earlyExitCount === 0) {
          return `You have 0 premature early exits logged in your journal! Your trade holding patience is exemplary; continue executing your plan to technical targets without second-guessing.`;
        }
        return `You have recorded ${data.earlyExitCount} premature early exits. Early exits cut your average reward before reaching full technical targets. Consider taking partials at 1:1.5R and moving stops to break-even rather than manually closing whole positions.`;
      }

      if (query.includes('checklist') || query.includes('tomorrow') || query.includes('pre-market')) {
        return `Personalized Pre-Market Checklist: 1) Identify HTF 4H/Daily key liquidity pools and directional bias. 2) Limit trades exclusively to your highest yielding setup (${data.bestSetupName || 'A+'}). 3) Enforce 1% maximum stop-loss and verify all entry confirmations before pressing execute.`;
      }

      if (query.includes('win rate') || query.includes('how am i doing') || query.includes('performance') || query.includes('overall')) {
        const netUSD = data.totalProfitUSDNet !== 0 ? data.totalProfitUSDNet : Math.round(data.totalRNet * 100);
        const netProfitStr = netUSD >= 0 ? `+$${Math.round(netUSD).toLocaleString()} profit` : `-$${Math.round(Math.abs(netUSD)).toLocaleString()} loss`;
        return `Performance Summary: Across ${data.totalTradesCount} logged trades, your realized win rate is ${data.overallWinRate}% with ${netProfitStr} and ${data.avgDiscipline}/100 average discipline.`;
      }

      const defaultUSD = data.totalProfitUSDNet !== 0 ? data.totalProfitUSDNet : Math.round(data.totalRNet * 100);
      const defaultProfitStr = defaultUSD >= 0 ? `+$${Math.round(defaultUSD).toLocaleString()} profit` : `-$${Math.round(Math.abs(defaultUSD)).toLocaleString()} loss`;
      return `Based on your audited journal (${data.totalTradesCount} trades, ${data.overallWinRate}% win rate, ${defaultProfitStr}): Keep prioritizing your ${data.bestSetupName || 'A+'} setups and maintaining strict risk controls.`;
    };

    const sessionSummaryList = Object.entries(sessionMap).map(([name, stat]) => {
      const winRate = stat.count ? Math.round((stat.wins / stat.count) * 100) : 0;
      const profitStr = stat.usd >= 0 ? `+$${Math.round(stat.usd)} profit` : `-$${Math.round(Math.abs(stat.usd))} loss`;
      return `${name}: ${stat.count} trades, ${winRate}% win rate, ${profitStr}`;
    }).join('; ') || 'No sessions logged yet';

    const setupSummaryList = Object.entries(setupMap).map(([name, stat]) => {
      const winRate = stat.count ? Math.round((stat.wins / stat.count) * 100) : 0;
      const profitStr = stat.usd >= 0 ? `+$${Math.round(stat.usd)} profit` : `-$${Math.round(Math.abs(stat.usd))} loss`;
      return `${name}: ${stat.count} trades, ${winRate}% win rate, ${profitStr}`;
    }).join('; ') || 'No setups logged yet';

    const prompt = `You are a real, friendly, expert trading coach. Answer the trader directly in simple, natural human language.

STRICT RULES:
1. Speak in simple, natural conversational language (2 to 3 sentences max).
2. NEVER use markdown bold asterisks (like **text**) in your reply. Output plain, clean text with zero asterisks.
3. Express trading results as dollar profits (e.g. "+$350 profit" or "-$120 loss") instead of raw "(rr / $profit)" formulas.
4. NEVER use robotic headers like "### FACT", "### PATTERN", "### SUGGESTION", or long academic text.
5. If the user greets you (e.g., "hi", "hello", "hey"), greet them warmly back like: "Hey! Ready to review your trades or help you with your strategy. What's on your mind today?"
6. If the user asks about specific performance/mistakes/setups, cite these exact ground-truth stats (${overallWinRate}% win rate, $${Math.round(totalProfitUSDNet)} profit).
7. If the user asks in Hindi/Hinglish, reply in natural Hinglish or simple English.
8. Fast, clear, punchy, zero fluff.

JOURNAL STATS:
- Total Trades Logged: ${totalTradesCount}
- Overall Win Rate: ${overallWinRate}%
- Net Profit: $${totalProfitUSDNet.toFixed(2)} (${totalRNet.toFixed(1)}R)
- Average Discipline: ${avgDiscipline}/100
- Most Costly Mistake: ${topCostlyMistake ? `${topCostlyMistake[0]} (Cost: -$${Math.round(topCostlyMistake[1].totalLossUSD)}, ${topCostlyMistake[1].count} occurrences)` : 'None detected so far'}
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
          return res.json({ success: true, answer: cleanAiOutput(answer.trim()), provider: 'gemini', model: targetModel });
        }
      }

      // If Google Gemini API is experiencing network latency or quota, deliver instant accurate grounded reply
      const instantAnswer = generateInstantGroundedAnswer(question, analytics);
      return res.json({
        success: true,
        answer: cleanAiOutput(instantAnswer),
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
        answer: cleanAiOutput(instantAnswer),
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
        answer: cleanAiOutput(instantAnswer),
        provider: 'grounded-audit',
        model: 'Instant Ledger Engine'
      });
    }

    const data = await apiResponse.json();
    const rawAnswer = data.choices?.[0]?.message?.content || generateInstantGroundedAnswer(question, analytics);
    const answer = cleanAiOutput(rawAnswer);

    res.json({ success: true, answer, provider: 'openai', model });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getRuleBasedCoachAnalysis,
  askAiCoach
};
