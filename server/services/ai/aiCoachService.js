/**
 * TradeJourn AI Coach Service
 * ============================
 * Master orchestrator connecting:
 * - Intent Routing (English, Hindi, Hinglish)
 * - Personal Journal Intelligence (isolated per user)
 * - Live Market Intelligence & Technical Analysis
 * - Google Gemini REST Engine with Function Calling & Multimodal Vision
 * - Bulletproof Deterministic Grounded Fallback
 */

const mongoose = require('mongoose');
const User = require('../../models/User');
const { classifyIntent, MARKET_SYMBOLS_MAP } = require('./intentClassifier');
const {
  JOURNAL_FUNCTION_DECLARATIONS,
  executeJournalTool,
  getTradeStats,
  getTradeHistory,
  getMistakesAndEmotions,
  reviewTrade,
  getPsychologyAudit,
  getPlaybookRules,
  getPropFirmStatus,
  compareTradingPeriods
} = require('./journalTools');
const { getMarketData, getMultiTimeframeMarketData } = require('../marketData/marketDataService');
const { getUpcomingEconomicEvents, getMacroDrivers } = require('../marketData/economicCalendarService');
const { calculatePositionSize, calculateStatisticalDistribution } = require('./statisticalAnalyticsService');
const { retrieveKnowledgeDocuments } = require('./knowledgeBaseService');
const Trade = require('../../models/Trade');
const { generateStructuredOutlook } = require('./technicalAnalysisEngine');
const { runStrategyBacktest } = require('./backtestEngine');
const { generateGeminiContent, normalizeModelName } = require('./geminiClient');

const SYSTEM_INSTRUCTION = `You are the TradeJourn AI Trading Copilot—an institutional trading mentor, quantitative analyst, and performance coach built into TradeJourn.

CORE PRINCIPLES:
1. Natural & Conversational: Speak naturally, warmly, and directly. Avoid robotic canned responses. Support English, Hindi, and Hinglish fluidly depending on how the trader addresses you.
2. Verified Ground Truth: Always base journal advice on actual trade records. Never invent statistics, win rates, or profits.
3. Live Market Discipline: Base market outlooks on real observed price action, market structure, and key support/resistance levels. Never claim a delayed or estimated price is a guaranteed live tick.
4. Risk & Psychology First: Prioritize capital preservation (1-2% risk rule), technical invalidation levels, and disciplined execution over emotional impulse.
5. Formatting: Use clean markdown with clear bullet points. Avoid walls of repetitive disclaimers. Give the direct answer first, followed by reasoning and action steps.`;

/**
 * Clean output text from excessive asterisks or formatting quirks
 */
function cleanAiText(text) {
  if (!text) return '';
  return text
    .replace(/\(\s*([+-]?\d+(?:\.\d+)?R)\s*\/\s*\$0\s*\)/gi, '')
    .trim();
}

/**
 * Format Grounded Deterministic Responses for all Intents
 */
function formatGroundedAnswer(intent, journalContext, marketContext) {
  if ((intent === 'MARKET_QUERY' || !journalContext) && marketContext) {
    return generateStructuredOutlook(marketContext);
  }
  if (!journalContext) {
    return "I am actively monitoring your trading journal. How can I help you improve your execution today?";
  }

  if (intent === 'TRADE_REVIEW' && journalContext.found) {
    return `🔍 AUDITED TRADE REVIEW: ${journalContext.tradeName}
• Instrument: ${journalContext.instrument} (${journalContext.direction}) | Date: ${journalContext.date} ${journalContext.time}
• Session: ${journalContext.session} | Setup: ${journalContext.setupRating} (${journalContext.entryType})
• Result: ${journalContext.result} (${journalContext.profitUSD} | Realized: ${journalContext.realizedR} vs Planned: ${journalContext.plannedRR})
• Discipline Score: ${journalContext.disciplineScore} | Grade: ${journalContext.tradeGrade}

📋 PLAYBOOK RULE VERIFICATION:
${journalContext.ruleChecks.map(r => `• ${r.rule}: [${r.status}] ${r.note}`).join('\n')}

📝 UNRECORDED EVIDENCE:
${journalContext.missingFields.map(m => `• Missing: ${m}`).join('\n')}

💡 COACH TAKEAWAY:
${journalContext.keyTakeaway}`;
  }

  if (intent === 'TRADING_PSYCHOLOGY' && journalContext.tiltRiskLevel) {
    return `🧠 TRADING PSYCHOLOGY & TILT AUDIT:
• Analyzed: ${journalContext.totalTradesAnalyzed} closed trades
• Baseline Win Rate: ${journalContext.baselineWinRate}
• Win Rate Following a Loss: ${journalContext.winRateAfterLoss}
• Win Rate Following a Win: ${journalContext.winRateAfterWin}
• Tilt Risk Assessment: [${journalContext.tiltRiskLevel}]
• Measured Behavioral Evidence: ${journalContext.tiltEvidence}
• Premature Exits: ${journalContext.earlyExitRatio}

${journalContext.coachingRule}`;
  }

  if (intent === 'PROP_FIRM_QUERY' && journalContext.accountSize) {
    return `🛡️ PROP FIRM CHALLENGE STATUS:
• Status: [${journalContext.status}]
• Account Size: ${journalContext.accountSize} | Target: ${journalContext.profitTarget}
• Total Realized P&L: ${journalContext.totalRealizedPnl} (${journalContext.targetProgressPct} of target)
• Today's P&L: ${journalContext.todayPnl}
• Daily Loss Limit: ${journalContext.maxDailyLossLimit} | Remaining Buffer Today: ${journalContext.dailyLossRemainingBuffer}
• Max Total Loss Limit: ${journalContext.maxTotalLossLimit} | Max Drawdown Observed: ${journalContext.maxDrawdownObserved} (Buffer: ${journalContext.totalLossRemainingBuffer})`;
  }

  if (intent === 'PLAYBOOK_QUERY' && journalContext.entryRules) {
    return `📖 DOCUMENTED PLAYBOOK RULES:
• Entry Rules:
${journalContext.entryRules.map(r => `  - ${r}`).join('\n')}
• Risk Rules:
${journalContext.riskRules.map(r => `  - ${r}`).join('\n')}
• Exit Rules:
${journalContext.exitRules.map(r => `  - ${r}`).join('\n')}
• Psychology Rules:
${journalContext.psychologyRules.map(r => `  - ${r}`).join('\n')}`;
  }

  if (intent === 'JOURNAL_COMPARISON' && journalContext.period1) {
    return `⚖️ TRADING SESSION COMPARISON:
• ${journalContext.period1.label}: ${journalContext.period1.trades} trades | Win Rate: ${journalContext.period1.winRate} | Net P&L: ${journalContext.period1.netProfit} | Profit Factor: ${journalContext.period1.profitFactor} | Avg R: ${journalContext.period1.avgR}
• ${journalContext.period2.label}: ${journalContext.period2.trades} trades | Win Rate: ${journalContext.period2.winRate} | Net P&L: ${journalContext.period2.netProfit} | Profit Factor: ${journalContext.period2.profitFactor} | Avg R: ${journalContext.period2.avgR}

💡 Takeaway: ${journalContext.takeaway}`;
  }

  if (intent === 'BACKTEST_QUERY' && journalContext.performance) {
    return `🧪 QUANTITATIVE STRATEGY BACKTEST: ${journalContext.strategy}
• Initial Capital: ${journalContext.performance.initialCapital} | Final Equity: ${journalContext.performance.finalEquity}
• Net Return: ${journalContext.performance.netReturnPct} (${journalContext.performance.netProfitUSD})
• Total Trades: ${journalContext.performance.totalTrades} (${journalContext.performance.winningTrades}W / ${journalContext.performance.losingTrades}L)
• Win Rate: ${journalContext.performance.winRate} | Profit Factor: ${journalContext.performance.profitFactor}
• Expectancy: ${journalContext.performance.expectancyUSD} (${journalContext.performance.expectancyR})
• Max Drawdown: ${journalContext.performance.maxDrawdownPct} (${journalContext.performance.maxDrawdownUSD})
• Sharpe Ratio: ${journalContext.performance.sharpeRatio}

⚠️ Material Limitations & Disclosures:
${journalContext.disclosures.map(d => `• ${d}`).join('\n')}`;
  }

  if (intent === 'ECONOMIC_CALENDAR' && journalContext.events) {
    return `📅 HIGH-IMPACT MACROECONOMIC SCHEDULE:
${journalContext.events.map(e => `• [${e.impact}] ${e.event} (${e.currency})
  - Schedule: ${e.frequency} at ${e.timeUTC}
  - Volatility Impact: ${e.typicalVolatility}
  - Risk Guidance: ${e.guidance}`).join('\n\n')}

⚠️ General Policy: Spreads widen sharply 5-10 minutes prior to red-folder news. Protect existing profits with break-even stops or remain flat.`;
  }

  if (intent === 'POSITION_SIZING' && journalContext.calculatedPositionSize) {
    return `📐 INSTITUTIONAL POSITION SIZING AUDIT:
• Instrument: ${journalContext.instrument}
• Account Balance: ${journalContext.accountBalance}
• Risk Target: ${journalContext.riskPercent} (${journalContext.riskAmountUSD} maximum risk)
• Stop-Loss Distance: ${journalContext.stopLossDistance}
• Recommended Position Size: ${journalContext.calculatedPositionSize}

Formula: ${journalContext.formulaNote}
${journalContext.maxDailyLossWarning}`;
  }

  if (intent === 'STATISTICAL_ANALYSIS' && journalContext.meanOutcomeUSD) {
    return `📊 STATISTICAL DISTRIBUTION & CONFIDENCE INTERVALS:
• Sample Size: ${journalContext.sampleSize} trades
• Mean Trade Outcome: ${journalContext.meanOutcomeUSD}
• Median Trade Outcome: ${journalContext.medianOutcomeUSD}
• Standard Deviation (σ): ${journalContext.standardDeviationUSD}
• Win Rate: ${journalContext.winRate}
• 95% Confidence Interval for Win Rate: ${journalContext.winRate95CI}
• Distribution Skew: ${journalContext.distributionSkew}

🔬 OUTLIER EDGE AUDIT:
• Largest Winning Trade: ${journalContext.outlierAnalysis.largestWinnerUSD}
• Total P&L (All Trades): ${journalContext.outlierAnalysis.pnlWithAllTrades}
• Total P&L (Excluding Largest Winner): ${journalContext.outlierAnalysis.pnlExcludingLargestWinner}
• Assessment: ${journalContext.outlierAnalysis.isEdgeDependentOnOutlier}

💡 Sample Validity: ${journalContext.sampleSizeAssessment}`;
  }

  if (intent === 'KNOWLEDGE_RETRIEVAL' && journalContext.passages) {
    return `📚 RETRIEVED INSTITUTIONAL KNOWLEDGE DOCTRINE:
${journalContext.passages.map(p => `### ${p.title} [Category: ${p.category}]\n${p.content}`).join('\n\n')}

Source: TradeJourn Verified Knowledge Base`;
  }

  if (intent === 'MACRO_ANALYSIS' && journalContext.primaryDrivers) {
    return `🌐 MACROECONOMIC DRIVERS & INTER-MARKET ANALYSIS: ${journalContext.instrument || journalContext.symbol}
• Primary Drivers:
${journalContext.primaryDrivers.map(d => `  - ${d}`).join('\n')}

🛡️ Macro Risk Rule:
${journalContext.riskRule}`;
  }

  if (journalContext.totalTrades === 0 || journalContext.hasData === false) {
    return "Your journal currently has 0 closed trades logged. To get tailored performance audits, log your first trade via the 'Quick Add Trade' button!";
  }

  if (journalContext.winRate) {
    return `Based on your audited trade ledger (${journalContext.totalTrades} closed trades):
• Win Rate: ${journalContext.winRate} (${journalContext.winningTrades}W / ${journalContext.losingTrades}L / ${journalContext.breakEvenTrades}BE)
• Realized Net P&L: ${journalContext.netProfitUSD} (${journalContext.totalR})
• Expectancy: ${journalContext.expectancyUSD}
• Profit Factor: ${journalContext.profitFactor}
• Max Drawdown: ${journalContext.maxDrawdownUSD || 'N/A'}
• Average Discipline: ${journalContext.averageDiscipline}
• Current Streak: ${journalContext.currentStreak}
${journalContext.sampleSizeWarning ? `\n⚠️ ${journalContext.sampleSizeWarning}` : ''}

Tip: Focus on taking only your highest quality setups and maintain your risk discipline.`;
  }

  if (journalContext.trades) {
    return `Here is your recent trade history (${journalContext.trades.length} trades returned):\n\n` +
      journalContext.trades.map(t => `• ${t.date}: ${t.instrument} (${t.direction}) — Result: ${t.result} (${t.profitUSD}, ${t.rResult}) | Setup: ${t.setup}`).join('\n');
  }

  if (journalContext.mistakes) {
    return Array.isArray(journalContext.mistakes)
      ? `Top Costly Mistakes in your Journal:\n\n` + journalContext.mistakes.map(m => `• ${m.mistake}: ${m.occurrences} times (${m.totalLossUSD})`).join('\n')
      : String(journalContext.mistakes);
  }

  return "Analysis completed based on your verified journal ledger.";
}

/**
 * Handle incoming chat interaction
 */
async function processAiCoachChat({
  question,
  messages = [],
  image = null,
  userModel = 'gemini-2.0-flash',
  userApiKey = null,
  user
}) {
  if (!question || typeof question !== 'string' || !question.trim()) {
    throw new Error('Please provide a valid question or prompt for the AI Coach.');
  }

  const cleanQuestion = question.trim();
  const userId = user._id;

  // 1. Fast Intent Classification
  const intentResult = classifyIntent(cleanQuestion);

  // If simple greeting, identity query, or standalone trading concept with no image, return fast verified answer
  if (!image && intentResult.fastAnswer && (intentResult.intent === 'GREETING' || intentResult.intent === 'IDENTITY' || intentResult.intent === 'GRATITUDE' || intentResult.intent === 'TRADING_EDUCATION')) {
    let fastAnswer = intentResult.fastAnswer;
    if (intentResult.intent === 'GREETING' && user) {
      const firstName = user?.name ? user.name.split(' ')[0] : (user?.username ? user.username.split(' ')[0] : '');
      if (firstName) {
        if (intentResult.language === 'hinglish') {
          fastAnswer = `Namaste ${firstName}! 👋\nTradeJourn mein aapka swagat hai!\n\nAaj aap kis par kaam karna chahte hain? Aap mujhse trades, strategies, risk management, trading concepts ya general market questions poochh sakte hain.`;
        } else {
          fastAnswer = `Hi ${firstName}! 👋\nWelcome back to TradeJourn!\n\nWhat would you like to work on today? You can ask me anything about your trades, strategies, risk management, trading concepts or general questions.`;
        }
      }
    }
    return {
      success: true,
      answer: fastAnswer,
      intent: intentResult.intent,
      provider: 'intent-engine',
      model: 'TradeJourn Conversational Router'
    };
  }

  // 2. Resolve Active Context with Multi-Turn Memory
  let activeSymbol = intentResult.extractedSymbol;
  let activeTimeframe = intentResult.extractedTimeframe || '1h';

  if (!activeSymbol && Array.isArray(messages) && messages.length > 0) {
    for (let i = messages.length - 1; i >= 0; i--) {
      const pastText = (messages[i].text || '').toLowerCase();
      const words = pastText.replace(/[^a-z0-9]/g, ' ').split(/\s+/);
      for (const w of words) {
        if (MARKET_SYMBOLS_MAP[w]) {
          activeSymbol = MARKET_SYMBOLS_MAP[w];
          break;
        }
      }
      if (activeSymbol) break;
    }
  }

  if (!activeSymbol && (intentResult.intent === 'MARKET_QUERY' || cleanQuestion.toLowerCase().includes('invalidation') || cleanQuestion.toLowerCase().includes('level'))) {
    activeSymbol = 'XAUUSD';
  }

  // 3. Pre-fetch Context if relevant
  let journalContext = null;
  let marketContext = null;

  if (intentResult.intent === 'TRADE_REVIEW') {
    try {
      journalContext = await reviewTrade(userId);
    } catch (e) {
      console.warn('Trade review prefetch notice:', e.message);
    }
  } else if (intentResult.intent === 'TRADING_PSYCHOLOGY' || cleanQuestion.toLowerCase().includes('tilt')) {
    try {
      journalContext = await getPsychologyAudit(userId);
    } catch (e) {
      console.warn('Psychology audit prefetch notice:', e.message);
    }
  } else if (intentResult.intent === 'PLAYBOOK_QUERY') {
    try {
      journalContext = await getPlaybookRules(userId);
    } catch (e) {
      console.warn('Playbook prefetch notice:', e.message);
    }
  } else if (intentResult.intent === 'PROP_FIRM_QUERY') {
    try {
      journalContext = await getPropFirmStatus(userId);
    } catch (e) {
      console.warn('Prop firm prefetch notice:', e.message);
    }
  } else if (intentResult.intent === 'JOURNAL_COMPARISON') {
    try {
      journalContext = await compareTradingPeriods(userId, { type: 'SESSIONS', filter1: 'London', filter2: 'New York' });
    } catch (e) {
      console.warn('Comparison prefetch notice:', e.message);
    }
  } else if (intentResult.intent === 'ECONOMIC_CALENDAR') {
    journalContext = getUpcomingEconomicEvents();
  } else if (intentResult.intent === 'POSITION_SIZING') {
    const balanceMatch = cleanQuestion.match(/\$?\s*(\d[\d,]*(\.\d+)?)\s*(balance|account|equity|k\b)?/i);
    const slMatch = cleanQuestion.match(/(\d+(\.\d+)?)\s*(pip|pips|sl|stop|dollars?|\$)/i);
    const riskMatch = cleanQuestion.match(/(\d+(\.\d+)?)\s*%\s*(risk)?/i);

    const balance = balanceMatch ? Number(balanceMatch[1].replace(/,/g, '')) * (balanceMatch[3]?.toLowerCase() === 'k' ? 1000 : 1) : (user?.settings?.accountBalance || 10000);
    const slDistance = slMatch ? Number(slMatch[1]) : 20;
    const riskPct = riskMatch ? Number(riskMatch[1]) : (user?.settings?.riskPerTrade || 1.0);

    journalContext = calculatePositionSize({
      balance,
      riskPct,
      stopLossDistance: slDistance,
      instrument: activeSymbol || 'EURUSD'
    });
  } else if (intentResult.intent === 'STATISTICAL_ANALYSIS') {
    try {
      const allTrades = await Trade.find({ userId }).lean().catch(() => []);
      journalContext = calculateStatisticalDistribution(allTrades);
    } catch (e) {
      journalContext = calculateStatisticalDistribution([]);
    }
  } else if (intentResult.intent === 'KNOWLEDGE_RETRIEVAL') {
    journalContext = retrieveKnowledgeDocuments(cleanQuestion);
  } else if (intentResult.intent === 'MACRO_ANALYSIS') {
    journalContext = getMacroDrivers(activeSymbol || 'XAUUSD');
  } else if (intentResult.intent === 'BACKTEST_QUERY') {
    try {
      const bData = await getMarketData(activeSymbol || 'EURUSD', activeTimeframe, 60);
      journalContext = runStrategyBacktest({
        candles: bData.candles,
        strategy: cleanQuestion.toLowerCase().includes('rsi') ? 'RSI_PULLBACK' : 'EMA_CROSSOVER'
      });
    } catch (e) {
      console.warn('Backtest prefetch notice:', e.message);
    }
  } else if (intentResult.needsJournal || intentResult.intent === 'JOURNAL_QUERY') {
    try {
      if (cleanQuestion.toLowerCase().includes('last') || cleanQuestion.toLowerCase().includes('recent') || cleanQuestion.toLowerCase().includes('history')) {
        journalContext = await getTradeHistory(userId, { limit: 10 });
      } else if (cleanQuestion.toLowerCase().includes('mistake') || cleanQuestion.toLowerCase().includes('emotion') || cleanQuestion.toLowerCase().includes('fomo') || cleanQuestion.toLowerCase().includes('revenge')) {
        journalContext = await getMistakesAndEmotions(userId);
      } else {
        journalContext = await getTradeStats(userId);
      }
    } catch (e) {
      console.warn('Journal prefetch notice:', e.message);
    }
  }

  const isSpecialIntent = [
    'POSITION_SIZING',
    'MACRO_ANALYSIS',
    'ECONOMIC_CALENDAR',
    'STATISTICAL_ANALYSIS',
    'KNOWLEDGE_RETRIEVAL',
    'BACKTEST_QUERY',
    'TRADE_REVIEW',
    'TRADING_PSYCHOLOGY',
    'PLAYBOOK_QUERY',
    'PROP_FIRM_QUERY',
    'JOURNAL_COMPARISON'
  ].includes(intentResult.intent);

  if (!isSpecialIntent && activeSymbol && (intentResult.needsMarket || intentResult.intent === 'MARKET_QUERY' || intentResult.extractedTimeframe || cleanQuestion.toLowerCase().includes('invalidation') || cleanQuestion.toLowerCase().includes('level') || cleanQuestion.toLowerCase().includes('timeframe'))) {
    intentResult.intent = 'MARKET_QUERY';
    intentResult.needsMarket = true;
    try {
      marketContext = await getMarketData(activeSymbol, activeTimeframe);
    } catch (e) {
      console.warn('Market data prefetch notice:', e.message);
    }
  }

  // 4. Resolve API Key
  let apiKey = userApiKey?.trim() || user?.settings?.geminiApiKey || process.env.GEMINI_API_KEY;

  if (!apiKey && mongoose.connection.readyState === 1) {
    const adminUser = await User.findOne({
      role: 'admin',
      'settings.geminiApiKey': { $exists: true, $ne: '' }
    }).lean().catch(() => null);

    if (adminUser?.settings?.geminiApiKey) {
      apiKey = adminUser.settings.geminiApiKey.trim();
    }
  }

  // 5. If No API Key Available -> Deterministic Grounded Engine
  if (!apiKey) {
    const groundedAnswer = formatGroundedAnswer(intentResult.intent, journalContext, marketContext);
    return {
      success: true,
      answer: groundedAnswer,
      intent: intentResult.intent,
      provider: intentResult.intent === 'MARKET_QUERY' ? 'technical-engine' : 'grounded-audit',
      model: intentResult.intent === 'MARKET_QUERY' ? 'TradeJourn Market Intelligence' : 'Institutional Ledger Engine'
    };
  }

  // 5. Build Multi-turn Contents for Gemini
  const contents = [];

  // Append recent chat history (up to last 6 turns for context budget)
  if (Array.isArray(messages) && messages.length > 0) {
    const trimmed = messages.slice(-6);
    for (const msg of trimmed) {
      if (msg.sender && msg.text) {
        contents.push({
          role: msg.sender === 'user' ? 'user' : 'model',
          parts: [{ text: String(msg.text) }]
        });
      }
    }
  }

  // Prepare current turn parts
  const currentTurnParts = [];

  // Inject grounded context as verified factual evidence for Gemini
  if (journalContext) {
    currentTurnParts.push({
      text: `[VERIFIED REAL JOURNAL DATA FOR THIS USER]:\n${JSON.stringify(journalContext, null, 2)}`
    });
  }

  if (marketContext) {
    currentTurnParts.push({
      text: `[FACTUAL REAL-TIME MARKET DATA]:\n${JSON.stringify({
        symbol: marketContext.symbol,
        price: marketContext.price,
        status: marketContext.status,
        source: marketContext.source,
        change24h: marketContext.change24h,
        high24h: marketContext.high24h,
        low24h: marketContext.low24h,
        timeframe: marketContext.timeframe
      }, null, 2)}`
    });
  }

  // Multimodal image attachment
  if (image) {
    let base64Data = null;
    let mimeType = 'image/jpeg';

    if (image.startsWith('data:')) {
      const match = image.match(/^data:([a-zA-Z0-9/+-]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        base64Data = match[2];
      }
    }

    if (base64Data) {
      currentTurnParts.push({
        inline_data: {
          mime_type: mimeType,
          data: base64Data
        }
      });
      currentTurnParts.push({
        text: "Please inspect this chart screenshot carefully. Identify the instrument and timeframe if visible, describe key market structure (support, resistance, trends, imbalances), and provide constructive technical feedback."
      });
    }
  }

  currentTurnParts.push({
    text: cleanQuestion
  });

  contents.push({
    role: 'user',
    parts: currentTurnParts
  });

  // 6. Execute Gemini Call with Tool Calling
  const targetModel = normalizeModelName(userModel);

  try {
    const geminiResult = await generateGeminiContent({
      apiKey,
      model: targetModel,
      systemInstruction: SYSTEM_INSTRUCTION,
      contents,
      tools: [{ function_declarations: JOURNAL_FUNCTION_DECLARATIONS }]
    });

    // Check if Gemini invoked a function call
    if (geminiResult.functionCalls && geminiResult.functionCalls.length > 0) {
      const call = geminiResult.functionCalls[0];
      let toolResult;
      try {
        toolResult = await executeJournalTool(call.name, call.args || {}, userId);
      } catch (err) {
        toolResult = { error: err.message };
      }

      // Feed function call result back to Gemini for final natural formulation
      contents.push({
        role: 'model',
        parts: [{
          functionCall: {
            name: call.name,
            args: call.args
          }
        }]
      });

      contents.push({
        role: 'user',
        parts: [{
          functionResponse: {
            name: call.name,
            response: toolResult
          }
        }]
      });

      const secondResult = await generateGeminiContent({
        apiKey,
        model: targetModel,
        systemInstruction: SYSTEM_INSTRUCTION,
        contents
      });

      return {
        success: true,
        answer: cleanAiText(secondResult.text) || 'Analysis complete.',
        intent: intentResult.intent,
        provider: 'gemini',
        model: targetModel,
        toolExecuted: call.name
      };
    }

    if (geminiResult.text && geminiResult.text.trim()) {
      return {
        success: true,
        answer: cleanAiText(geminiResult.text),
        intent: intentResult.intent,
        provider: 'gemini',
        model: targetModel
      };
    }

    throw new Error('Gemini returned an empty candidate text.');
  } catch (err) {
    console.warn(`Gemini API execution error (${err.message}). Falling back to deterministic engine.`);

    const groundedAnswer = formatGroundedAnswer(intentResult.intent, journalContext, marketContext);
    return {
      success: true,
      answer: groundedAnswer,
      intent: intentResult.intent,
      provider: intentResult.intent === 'MARKET_QUERY' ? 'technical-engine' : 'grounded-audit',
      model: intentResult.intent === 'MARKET_QUERY' ? 'TradeJourn Market Intelligence' : 'Institutional Ledger Engine'
    };
  }
}

module.exports = {
  processAiCoachChat,
  SYSTEM_INSTRUCTION,
  cleanAiText
};
