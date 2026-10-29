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
  getTradeDetails,
  getPerformanceBySymbol,
  getPerformanceBySession,
  compareStrategies,
  getDrawdownAnalysis,
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

CORE PRINCIPLES & COMMUNICATION RULES:
1. BOTTOM LINE UP FRONT (BLUF): State the direct answer, verdict, or numerical figure in the very first sentence before providing reasoning, breakdown, or steps.
2. ZERO REPEATED GENERIC RESPONSES: Never output boilerplate lines such as "Analysis completed based on your verified journal ledger." or "I am actively monitoring your trading journal." Every reply must directly address the question with substance, data, or actionable guidance.
3. CONVERSATIONAL & NATURAL: Speak naturally, warmly, and authoritatively. Avoid robotic jargon.
4. LANGUAGE MIRRORING:
   - If the user addresses you in Hindi or Hinglish (Roman Hindi like "kya haal hai", "mera win rate kya hai", "batao bhai"), respond fluently and naturally in conversational Hinglish.
   - If the user addresses you in English, respond in crisp, professional English.
5. ANSWER LENGTH PROPORTIONAL TO COMPLEXITY:
   - Greetings & acknowledgments: 1-3 short, friendly lines. Zero journal stats.
   - Clarifications: 2-4 lines clearly stating the missing variables with an example.
   - Definitions & concepts: Direct 1-sentence definition -> Formula/Mechanics -> Real Example -> 1 Pro Tip (under 10 lines).
   - Audits, reviews & analytics: Structured, detailed breakdown with concrete verdicts.
6. NO IRRELEVANT JOURNAL STATS: Never mention or summarize the user's trading journal, win rate, or 0-trade ledger when the user is simply greeting you, chatting, or asking educational or general market questions.
7. MISSING INFORMATION & CLARIFICATION: If a calculation (e.g. position sizing) lacks critical variables like account balance, risk %, or stop-loss distance, politely request the missing parameters with a formula and an example.
8. CONTEXT-AWARE FOLLOW-UPS: At the end of every response, provide 1-2 sharp, context-aware follow-up question suggestions under:
💡 **Next Steps / Suggested Follow-ups:**
• [Follow-up question 1]
• [Follow-up question 2]
9. Verified Ground Truth: Base all journal advice strictly on actual trade records. Never invent statistics, win rates, or profits.
10. PERSONAL TRADING ANALYTICS RIGOR: All personal trading metrics (sample size N, date range, win rate, gross vs net P&L, fees/commissions, swaps, expectancy, profit factor, drawdown, holding duration, and session/strategy performance) must be grounded in verified backend calculations. Always report sample size (N) and date range. Differentiate Gross P&L from Net Realized P&L after fees. State win rate alongside breakeven rate and win rate excluding breakeven trades. Explain the evidence behind performance findings. Explicitly distinguish correlation from causation (e.g. remind traders that higher win rate in a session or setup tag correlates with adherence to confirmation and discipline, rather than the tag or session alone causing edge). Never fabricate unrecorded records or metrics.
11. VERIFIED EXTERNAL MARKET DATA & NON-PROMISSORY DISCLOSURE: When answering market-analysis requests, use fresh data for the requested symbol and timeframe. State the provider source and data timestamp clearly. Distinguish LIVE, DELAYED (~15m), CACHED, and UNAVAILABLE feeds honestly. Explain technical trend, market structure, key inflection levels, and formulate both bullish and bearish scenarios with exact invalidation levels. Never fabricate current prices or claim a live lookup occurred when data is unavailable. Never promise or guarantee a profitable outcome.`;

/**
 * Clean output text from excessive formatting quirks while preserving markdown bold and lists
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
function formatGroundedAnswer(intent, journalContext, marketContext, language = 'english') {
  const isHi = language === 'hinglish';

  if ((intent === 'MARKET_QUERY' || !journalContext) && marketContext) {
    return generateStructuredOutlook(marketContext);
  }

  // Handle Trade Review
  if (intent === 'TRADE_REVIEW') {
    if (!journalContext || !journalContext.found) {
      return isHi
        ? `🔍 **Trade Review Verdict**: Aapke journal me audit karne ke liye koi trade nahi mila.\n\nKripya 'Quick Add Trade' button se apni trade log karein taaki main aapke playbook rules, execution confirmation aur risk discipline ko audit kar sakoon.\n\n💡 **Suggested Next Steps:**\n• *"Quick Add Trade se pehla trade log karein"*\n• *"Entry confirmation rules follow karne ka tareeqa kya hai?"*`
        : `🔍 **Trade Review Verdict**: No matching trade was found in your journal to audit.\n\nPlease log your trade via the 'Quick Add Trade' button so I can verify your playbook rules, confirmation signals, and execution discipline.\n\n💡 **Suggested Next Steps:**\n• *"Log a new trade via Quick Add Trade"*\n• *"What entry confirmation rules should I follow?"*`;
    }

    return `🔍 **AUDITED TRADE REVIEW**: ${journalContext.tradeName}
• **Verdict**: Result **${journalContext.result}** (${journalContext.profitUSD} | Realized: **${journalContext.realizedR}R** vs Planned: **${journalContext.plannedRR}R**)
• **Discipline Score**: **${journalContext.disciplineScore}/100** | Grade: **${journalContext.tradeGrade}**
• **Instrument**: ${journalContext.instrument} (${journalContext.direction}) | Date: ${journalContext.date} ${journalContext.time}
• **Session**: ${journalContext.session} | Setup: ${journalContext.setupRating} (${journalContext.entryType})

📋 **PLAYBOOK RULE VERIFICATION**:
${journalContext.ruleChecks.map(r => `• ${r.rule}: [${r.status}] ${r.note}`).join('\n')}

${journalContext.missingFields && journalContext.missingFields.length ? `📝 **UNRECORDED EVIDENCE**:\n${journalContext.missingFields.map(m => `• Missing: ${m}`).join('\n')}\n\n` : ''}💡 **COACH TAKEAWAY**:
${journalContext.keyTakeaway}

💡 **Next Steps / Suggested Follow-ups:**
• *"Was my stop-loss placement technically sound on this trade?"*
• *"Audit my trading psychology and emotional discipline."*`;
  }

  // Handle Trading Psychology
  if (intent === 'TRADING_PSYCHOLOGY') {
    if (!journalContext || !journalContext.tiltRiskLevel) {
      return isHi
        ? `🧠 **Trading Psychology Audit**: Aapke journal me psychology pattern measure karne ke liye trades available nahi hain. Trade add karein aur har trade me emotion (Calm, FOMO, Revenge) log karein.\n\n💡 **Suggested Next Steps:**\n• *"Quick Add Trade se trade log karein"*\n• *"Loss ke baad revenge trading kaise rokein?"*`
        : `🧠 **Trading Psychology Audit**: Insufficient trade data to evaluate psychological tilt. Log trades along with your emotional states (Calm, Confident, Fear, FOMO) to unlock tilt analytics.\n\n💡 **Suggested Next Steps:**\n• *"Log trades with emotion tags"*\n• *"How to stop revenge trading after a loss?"*`;
    }

    return `🧠 **TRADING PSYCHOLOGY & TILT AUDIT**:
• **Tilt Risk Level**: **[${journalContext.tiltRiskLevel}]** (Analyzed: ${journalContext.totalTradesAnalyzed} closed trades)
• **Baseline Win Rate**: **${journalContext.baselineWinRate}**
• **Win Rate After a Loss**: **${journalContext.winRateAfterLoss}**
• **Win Rate After a Win**: **${journalContext.winRateAfterWin}**
• **Premature Exits**: **${journalContext.earlyExitRatio}**
• **Behavioral Evidence**: ${journalContext.tiltEvidence}

🛡️ **COACHING RULE**:
${journalContext.coachingRule}

💡 **Next Steps / Suggested Follow-ups:**
• *"What are my most common costly emotional mistakes?"*
• *"How do I enforce a mandatory cooling-off period after a loss?"*`;
  }

  // Handle Prop Firm
  if (intent === 'PROP_FIRM_QUERY' && journalContext && journalContext.accountSize) {
    return `🛡️ **PROP FIRM CHALLENGE STATUS**:
• **Status**: **[${journalContext.status}]** | Account Size: **${journalContext.accountSize}**
• **Profit Target**: **${journalContext.profitTarget}** (Progress: **${journalContext.targetProgressPct}**)
• **Total Realized P&L**: **${journalContext.totalRealizedPnl}** | Today's P&L: **${journalContext.todayPnl}**
• **Daily Loss Limit**: ${journalContext.maxDailyLossLimit} | Remaining Buffer Today: **${journalContext.dailyLossRemainingBuffer}**
• **Max Total Loss Limit**: ${journalContext.maxTotalLossLimit} | Remaining Buffer: **${journalContext.totalLossRemainingBuffer}**

💡 **Next Steps / Suggested Follow-ups:**
• *"Calculate safe position size to protect my daily loss buffer."*
• *"What are the trailing drawdown rules?"*`;
  }

  // Handle Playbook
  if (intent === 'PLAYBOOK_QUERY') {
    if (!journalContext || journalContext.totalTrades === 0 || !journalContext.hasClosedTrades) {
      return isHi
        ? `📖 **Playbook Execution Audit**: Aapke journal me filhaal 0 closed trades hain. 'Quick Add Trade' se trade log karein taaki main aapke entry aur risk rules ko audit kar sakoon!\n\n💡 **Suggested Follow-ups:**\n• *"Quick Add Trade se pehla trade add karein"*\n• *"Playbook entry rules kaise banayein?"*`
        : `📖 **Playbook Execution Audit**: You currently have 0 closed trades logged in your journal. Please log your trade via 'Quick Add Trade' so I can audit your execution against your trading rules!\n\n💡 **Suggested Follow-ups:**\n• *"Log a trade via Quick Add Trade"*\n• *"How should I define my entry rules?"*`;
    }
    if (journalContext.lastTrade) {
      const lt = journalContext.lastTrade;
      return `📖 **PLAYBOOK EXECUTION AUDIT** (${lt.instrument || 'Trade'} on ${lt.date}):
• **Rule Compliance**: ${lt.confirmation === 'Yes' ? '✅ **Rules Followed**' : '⚠️ **Lacked Confirmation**'}
• **Discipline Score**: **${lt.disciplineScore ? `${lt.disciplineScore}/100` : 'Not scored'}**
• **Result**: **${lt.result}** (${lt.pips || 0} pips, ${lt.rResult || 0}R) | Setup: **${lt.setupRating || 'N/A'}**

💡 **Rule Takeaway**: Always wait for full setup confirmation before entering to protect your capital.

💡 **Next Steps / Suggested Follow-ups:**
• *"Show my documented risk and entry rules."*
• *"Review my last trade in detail."*`;
    }
  }

  // Handle Session Comparison
  if (intent === 'JOURNAL_COMPARISON' && journalContext && journalContext.period1) {
    return `⚖️ **TRADING SESSION COMPARISON**:
• **${journalContext.period1.label}**: ${journalContext.period1.trades} trades | Win Rate: **${journalContext.period1.winRate}** | Net P&L: **${journalContext.period1.netProfit}** | Profit Factor: ${journalContext.period1.profitFactor} | Avg R: ${journalContext.period1.avgR}
• **${journalContext.period2.label}**: ${journalContext.period2.trades} trades | Win Rate: **${journalContext.period2.winRate}** | Net P&L: **${journalContext.period2.netProfit}** | Profit Factor: ${journalContext.period2.profitFactor} | Avg R: ${journalContext.period2.avgR}

💡 **Takeaway**: ${journalContext.takeaway}

💡 **Next Steps / Suggested Follow-ups:**
• *"Why is my performance different between London and New York?"*
• *"Show my top setups traded in ${journalContext.period1.label}."*`;
  }

  // Handle Position Sizing
  if (intent === 'POSITION_SIZING' && journalContext && journalContext.calculatedPositionSize) {
    return `📐 **INSTITUTIONAL POSITION SIZING AUDIT**:
• **Recommended Position Size**: **${journalContext.calculatedPositionSize}**
• **Instrument**: ${journalContext.instrument}
• **Account Balance**: ${journalContext.accountBalance}
• **Risk Target**: ${journalContext.riskPercent} (**${journalContext.riskAmountUSD}** maximum risk)
• **Stop-Loss Distance**: ${journalContext.stopLossDistance}

• **Formula**: ${journalContext.formulaNote}
${journalContext.maxDailyLossWarning ? `\n⚠️ ${journalContext.maxDailyLossWarning}` : ''}

💡 **Next Steps / Suggested Follow-ups:**
• *"How to calculate stop loss beyond the recent liquidity sweep?"*
• *"What is the 1% risk rule?"*`;
  }

  // Handle Economic Calendar
  if (intent === 'ECONOMIC_CALENDAR' && journalContext && journalContext.events) {
    return `📅 **HIGH-IMPACT MACROECONOMIC SCHEDULE**:
${journalContext.events.map(e => `• **[${e.impact}] ${e.event} (${e.currency})**
  - Schedule: ${e.frequency} at ${e.timeUTC}
  - Volatility Impact: ${e.typicalVolatility}
  - Guidance: ${e.guidance}`).join('\n\n')}

⚠️ **Risk Policy**: Spreads widen sharply 5-10 minutes prior to red-folder news. Protect existing profits with break-even stops or remain flat.

💡 **Next Steps / Suggested Follow-ups:**
• *"What macro drivers are affecting Gold right now?"*
• *"How does NFP impact EURUSD?"*`;
  }

  // Handle Backtest
  if (intent === 'BACKTEST_QUERY' && journalContext && journalContext.performance) {
    return `🧪 **QUANTITATIVE STRATEGY BACKTEST**: ${journalContext.strategy}
• **Net Return**: **${journalContext.performance.netReturnPct}** (${journalContext.performance.netProfitUSD})
• **Win Rate**: **${journalContext.performance.winRate}** | Profit Factor: **${journalContext.performance.profitFactor}**
• **Total Trades**: ${journalContext.performance.totalTrades} (${journalContext.performance.winningTrades}W / ${journalContext.performance.losingTrades}L)
• **Expectancy**: **${journalContext.performance.expectancyUSD}** (${journalContext.performance.expectancyR})
• **Max Drawdown**: **${journalContext.performance.maxDrawdownPct}** (${journalContext.performance.maxDrawdownUSD})
• **Sharpe Ratio**: ${journalContext.performance.sharpeRatio}

⚠️ **Material Limitations**:
${journalContext.disclosures.map(d => `• ${d}`).join('\n')}

💡 **Next Steps / Suggested Follow-ups:**
• *"How does this backtest perform on a higher timeframe?"*
• *"What are the entry rules for this strategy?"*`;
  }

  // Handle Statistical Analysis
  if (intent === 'STATISTICAL_ANALYSIS' && journalContext && journalContext.meanOutcomeUSD) {
    return `📊 **STATISTICAL DISTRIBUTION & CONFIDENCE INTERVALS**:
• **Sample Size**: ${journalContext.sampleSize} trades
• **Mean Outcome**: **${journalContext.meanOutcomeUSD}** | Median: **${journalContext.medianOutcomeUSD}**
• **Standard Deviation (σ)**: ${journalContext.standardDeviationUSD}
• **Win Rate**: **${journalContext.winRate}** (95% CI: ${journalContext.winRate95CI})
• **Distribution Skew**: ${journalContext.distributionSkew}

🔬 **OUTLIER EDGE AUDIT**:
• Largest Winner: **${journalContext.outlierAnalysis.largestWinnerUSD}**
• Assessment: ${journalContext.outlierAnalysis.isEdgeDependentOnOutlier}

💡 **Sample Validity**: ${journalContext.sampleSizeAssessment}

💡 **Next Steps / Suggested Follow-ups:**
• *"What does distribution skew mean for my trading edge?"*
• *"Audit my overall expectancy."*`;
  }

  // Handle Knowledge Retrieval
  if (intent === 'KNOWLEDGE_RETRIEVAL' && journalContext && journalContext.passages && journalContext.passages.length > 0) {
    const p = journalContext.passages[0];
    const followups = (p.suggestedFollowups && p.suggestedFollowups.length > 0)
      ? p.suggestedFollowups
      : [
          'How do I apply this concept to my trading journal?',
          'Show me an example calculation for this setup.'
        ];

    return `📚 **RETRIEVED INSTITUTIONAL KNOWLEDGE DOCTRINE**:
### ${p.title} [Category: ${p.category}]
• **Classification**: ${p.type || 'Institutional Doctrine'} | **Difficulty**: ${p.difficulty || 'Intermediate'}
• **Source Reference**: ${p.source} (Updated: ${p.lastUpdated})

${p.content}

Source: TradeJourn Verified Knowledge Base

💡 **Next Steps / Suggested Follow-ups:**
${followups.map(f => `• *${f.startsWith('"') ? f : `"${f}"`}*`).join('\n')}`;
  }

  // Handle Macro Analysis
  if (intent === 'MACRO_ANALYSIS' && journalContext && journalContext.primaryDrivers) {
    return `🌐 **MACROECONOMIC DRIVERS & INTER-MARKET ANALYSIS**: ${journalContext.instrument || journalContext.symbol}
• **Primary Drivers**:
${journalContext.primaryDrivers.map(d => `  - ${d}`).join('\n')}

🛡️ **Macro Risk Rule**:
${journalContext.riskRule}

💡 **Next Steps / Suggested Follow-ups:**
• *"What is the DXY dollar index correlation with Gold?"*
• *"Analyse Gold on 1h chart"*`;
  }

  // Handle General Conversation
  if (intent === 'GENERAL_CONVERSATION') {
    return isHi
      ? `Theek hai bhai! Jab bhi ready ho bataiye—chahe trade audit karna ho, market levels analyse karne hon ya risk management discuss karna ho.\n\n💡 **Suggestions:**\n• *"Was my last trade according to my rules?"*\n• *"Analyse Gold on 1h chart"*`
      : `Understood! Whenever you're ready, let me know what you'd like to work on next—trade audits, strategy rules, or live market structure.\n\n💡 **Suggestions:**\n• *"Was my last trade according to my rules?"*\n• *"Analyse EURUSD on 1h chart"*`;
  }

  // Handle Empty Trade Journal (strictly for journal queries)
  if (intent === 'JOURNAL_QUERY' && (!journalContext || journalContext.totalTrades === 0 || journalContext.hasData === false)) {
    return isHi
      ? `📊 **Audited Trade Ledger**: Aapke journal me filhaal 0 closed trades logged hain.\n\n'Quick Add Trade' button se apni trades log karein taaki main aapka real-time win rate, profit factor, session edge, aur costly mistakes audit kar sakoon!\n\n💡 **Suggested Next Steps:**\n• *"Quick Add Trade se pehla trade log karein"*\n• *"Win rate aur expectancy kaise calculate hoti hai?"*`
      : `📊 **Audited Trade Ledger**: Your journal currently has 0 closed trades logged.\n\nTo get tailored performance audits, log your first trade via the 'Quick Add Trade' button! Once logged, I will calculate your real-time win rate, profit factor, session edge, and costly mistakes.\n\n💡 **Suggested Next Steps:**\n• *"Click Quick Add Trade to log your first trade"*\n• *"What is win rate and how is expectancy calculated?"*`;
  }

  // Handle Strategy Comparison
  if (intent === 'STRATEGY_COMPARISON' && journalContext && journalContext.comparison) {
    if (!journalContext.comparison.length) {
      return isHi
        ? `⚖️ **Strategy Audit**: Setup compare karne ke liye journal me trades nahi hain. 'Quick Add Trade' se trades log karein aur setup rating (A+, A, B) tag karein.\n\n💡 **Suggested Follow-ups:**\n• *"Quick Add Trade se pehla trade add karein"*\n• *"A+ setup kaise define karein?"*`
        : `⚖️ **Strategy Audit**: Insufficient trade records to compare strategies. Log trades and tag their setup rating (A+, A, B) or entry type to unlock comparative audits.\n\n💡 **Suggested Follow-ups:**\n• *"Log trades with setup ratings"*\n• *"How should I define my A+ setup criteria?"*`;
    }

    return `⚖️ **STRATEGY & SETUP PERFORMANCE AUDIT** (${journalContext.dimension === 'entryType' ? 'Entry Types' : 'Setup Ratings'} | N=${journalContext.totalTradesAnalyzed} trades):
${journalContext.comparison.map(c => `• **${c.strategyName}** (N=${c.sampleSize} trades | ${c.sampleSizeReliability}):
  - Win Rate: **${c.winRate}** (Excl. BE: ${c.winRateExcludingBE}) | Profit Factor: **${c.profitFactor}**
  - Net P&L: **${c.netProfitUSD}** (Gross: ${c.grossProfitUSD}) | Expectancy: **${c.expectancyUSD}**
  - Avg R: ${c.avgR} | Discipline: ${c.avgDisciplineScore} | Avg Hold: ${c.avgHoldingDuration}`).join('\n\n')}

🏆 **Best Performing Strategy**: **${journalContext.bestStrategy?.name || 'N/A'}** (${journalContext.bestStrategy?.netProfit || '$0'} net profit | ${journalContext.bestStrategy?.expectancy || '$0'} expectancy)
${journalContext.worstStrategy && journalContext.worstStrategy.name !== journalContext.bestStrategy?.name ? `⚠️ **Underperforming Strategy**: **${journalContext.worstStrategy.name}** (${journalContext.worstStrategy.netProfit} net profit | ${journalContext.worstStrategy.expectancy} expectancy)\n` : ''}
💡 **Correlation vs Causation Insight**:
${journalContext.correlationVsCausationSynthesis}

💡 **Next Steps / Suggested Follow-ups:**
• *"How do I eliminate low-expectancy B and C setups?"*
• *"What are my most costly execution mistakes on ${journalContext.worstStrategy?.name || 'losing setups'}?"*`;
  }

  // Handle Drawdown Analysis
  if (intent === 'DRAWDOWN_ANALYSIS' && journalContext && journalContext.hasData) {
    return `📉 **EQUITY CURVE & DRAWDOWN AUDIT** (Analyzed N=${journalContext.sampleSize} trades):
• **Current Status**: **[${journalContext.inDrawdown ? 'IN DRAWDOWN' : 'AT PEAK EQUITY'}]** (${journalContext.status})
• **Peak Equity**: **${journalContext.peakEquityUSD}** | Total Realized Net P&L: **${journalContext.currentRealizedNetProfitUSD}**
• **Maximum Drawdown**: **${journalContext.maxDrawdownUSD}**
• **Current Drawdown**: **${journalContext.currentDrawdownUSD}** (${journalContext.currentDrawdownTrades} trades below peak)
• **Max Drawdown Duration**: **${journalContext.maxDrawdownDurationTrades} trades** (${journalContext.maxDrawdownDurationDays} calendar days)
• **Recovery Factor**: **${journalContext.recoveryFactor}**

🛡️ **CAPITAL PRESERVATION GUIDANCE**:
${journalContext.riskPreservationGuidance}

💡 **Next Steps / Suggested Follow-ups:**
• *"What position size should I trade while in drawdown?"*
• *"Audit my psychological tilt after losing trades."*`;
  }

  // Handle Journal Win Rate & Stats
  if (journalContext.winRate) {
    const dateRangeStr = journalContext.dateRange?.formatted
      ? `• **Audit Window**: ${journalContext.dateRange.formatted}\n`
      : '';
    const holdingStr = journalContext.holdingDuration?.formatted && journalContext.holdingDuration.formatted !== 'Not recorded'
      ? `• **Average Holding Duration**: **${journalContext.holdingDuration.formatted}** (${journalContext.holdingDuration.tradesWithDuration} of ${journalContext.totalTrades} trades recorded)\n`
      : '';

    return `📊 **AUDITED WIN RATE & PERFORMANCE**:
${dateRangeStr}• **Win Rate**: **${journalContext.winRate}** (${journalContext.winningTrades}W / ${journalContext.losingTrades}L / ${journalContext.breakEvenTrades}BE across ${journalContext.totalTrades} closed trades | Excl. BE: **${journalContext.winRateExcludingBE || journalContext.winRate}**)
• **Realized Net P&L**: **${journalContext.netProfitUSD}** (Gross Profit: ${journalContext.grossProfitUSD || '$0'} | Gross Loss: ${journalContext.grossLossUSD || '$0'} | Commissions: -${journalContext.totalCommissionsUSD || '$0.00'} | Swaps: ${journalContext.totalSwapsUSD || '$0.00'})
• **Mathematical Expectancy**: **${journalContext.expectancyUSD}** per trade (${journalContext.totalR} total, Avg: ${journalContext.avgR})
• **Profit Factor**: **${journalContext.profitFactor}** | Win/Loss Ratio: **${journalContext.winLossRatio || 'N/A'}** (Avg Win: ${journalContext.avgWinUSD || '$0'} vs Avg Loss: ${journalContext.avgLossUSD || '$0'})
• **Drawdown Status**: Max Drawdown: **${journalContext.maxDrawdownUSD || 'N/A'}** | Current: **${journalContext.currentDrawdownUSD || '$0.00'}** (${journalContext.inDrawdown ? 'In Drawdown' : 'At High Water Mark'})
• **Execution Discipline**: **${journalContext.averageDiscipline}** | Current Streak: **${journalContext.currentStreak}** (Max Win: ${journalContext.maxWinStreak} | Max Loss: ${journalContext.maxLossStreak})
${holdingStr}${journalContext.sampleSizeWarning ? `\n⚠️ ${journalContext.sampleSizeWarning}\n` : ''}
💡 **Correlation vs Causation**:
${journalContext.correlationVsCausationNote || 'Historical edge reflects discipline and risk-to-reward consistency rather than circumstance alone.'}

💡 **Next Steps / Suggested Follow-ups:**
• *"What are my top recurring costly mistakes?"*
• *"Compare my setups to see which entry type has the highest expectancy."*`;
  }

  // Handle Recent Trades
  if (journalContext.trades) {
    return `📜 **RECENT AUDITED TRADE HISTORY** (${journalContext.trades.length} trades):\n\n` +
      journalContext.trades.map(t => `• **${t.date}**: ${t.instrument} (${t.direction}) — Result: **${t.result}** (Net: ${t.netProfitUSD || t.profitUSD}, ${t.rResult}) | Setup: ${t.setup}${t.holdingDuration && t.holdingDuration !== 'Not recorded' ? ` | Hold: ${t.holdingDuration}` : ''}`).join('\n') +
      `\n\n💡 **Next Steps / Suggested Follow-ups:**
• *"Was my last trade according to my rules?"*
• *"What is my overall win rate and expectancy?"*`;
  }

  // Handle Mistakes
  if (journalContext.mistakes) {
    if (Array.isArray(journalContext.mistakes)) {
      return `⚠️ **AUDITED RECURRING EXECUTION MISTAKES** (Analyzed N=${journalContext.totalTradesAnalyzed || journalContext.mistakes.length} trades):
${journalContext.mistakes.map(m => `• **${m.mistake}** [${m.isRecurring ? 'RECURRING MISTAKE' : 'OCCURRENCE'}]:
  - Frequency: ${m.occurrences} times (${m.frequency || `${m.occurrences} trades`})
  - Total Loss Impact: **${m.totalLossUSD}** (Avg Loss: ${m.avgLossUSD || 'N/A'} vs Baseline Loss: ${m.baselineAvgLossUSD || 'N/A'})
  - Causal Mechanism: ${m.causalMechanism || 'Violating trading rules directly increases negative skewness.'}
  - Actionable Remedy: ${m.actionableRemedy || 'Follow strict execution plan.'}`).join('\n\n')}

💡 **Correlation vs Causation**:
Trades tagged with rule violations mechanically increase downside volatility and reduce your mathematical expectancy. Adhering to predefined invalidation stops prevents negative tail outcomes.

💡 **Next Steps / Suggested Follow-ups:**
• *"How do I enforce a rule against moving stop-losses?"*
• *"Audit my trading psychology and emotional tilt."*`;
    }
    return String(journalContext.mistakes);
  }

  return isHi
    ? "Main aapka TradeJourn AI Trading Copilot hoon. Aap mujhse journal analytics, trading concepts, risk management ya live market structure ke baare me poochh sakte hain!\n\n💡 **Quick Prompts:**\n• *\"Mera win rate aur expectancy kya hai?\"*\n• *\"Was my last trade according to my rules?\"*\n• *\"Analyse Gold using technicals\"*"
    : "I am your TradeJourn AI Trading Copilot. Ask me anything about your trade journal, trading education, technical analysis, or risk management!\n\n💡 **Quick Prompts:**\n• *\"What is my win rate and expectancy?\"*\n• *\"Was my last trade according to my rules?\"*\n• *\"Analyse Gold on 1h chart\"*";
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
  const userId = user?._id || user?.id || 'anonymous';

  // 1. Fast Intent Classification
  const intentResult = classifyIntent(cleanQuestion);

  // If fast answer exists and no image attached, return verified fast answer immediately
  const fastAnswerIntents = [
    'GREETING',
    'IDENTITY',
    'GRATITUDE',
    'GENERAL_CONVERSATION',
    'TRADING_EDUCATION',
    'CLARIFICATION_NEEDED'
  ];

  if (!image && intentResult.fastAnswer && fastAnswerIntents.includes(intentResult.intent)) {
    let fastAnswer = intentResult.fastAnswer;
    if (intentResult.intent === 'GREETING' && user) {
      const firstName = user?.name ? user.name.split(' ')[0] : (user?.username ? user.username.split(' ')[0] : '');
      if (firstName) {
        if (intentResult.language === 'hinglish') {
          fastAnswer = `Namaste ${firstName}! 👋\nTradeJourn AI Coach mein aapka swagat hai!\n\nAaj aap kis cheez par focus karna chahte hain? Aap mujhse journal audit, trading concepts, risk management, ya market levels ke baare mein poochh sakte hain.\n\n💡 **Quick Actions:**\n• *"TradeJourn mere trades kaise track karta hai?"*\n• *"Liquidity sweeps aur order blocks explain karo"*\n• *"Analyse Gold using technicals"*`;
        } else {
          fastAnswer = `Hi ${firstName}! 👋\nWelcome back to TradeJourn AI Coach!\n\nWhat would you like to work on today? You can ask me to audit your journal execution, explain price action concepts, calculate risk, or analyze live market structure.\n\n💡 **Quick Actions:**\n• *"How does TradeJourn track my execution?"*\n• *"Explain liquidity sweeps and order blocks"*\n• *"Analyse Gold on 1h chart"*`;
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

  // 3. Pre-fetch Context if relevant (ONLY when needed!)
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
      const recentTrades = await Trade.find({ userId }).sort({ date: -1, time: -1 }).limit(1).lean().catch(() => []);
      const playbook = await getPlaybookRules(userId);
      journalContext = {
        ...playbook,
        totalTrades: recentTrades.length,
        hasClosedTrades: recentTrades.length > 0,
        lastTrade: recentTrades[0] || null
      };
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
  } else if (intentResult.intent === 'STRATEGY_COMPARISON') {
    try {
      journalContext = await compareStrategies(userId);
    } catch (e) {
      console.warn('Strategy comparison prefetch notice:', e.message);
    }
  } else if (intentResult.intent === 'DRAWDOWN_ANALYSIS') {
    try {
      journalContext = await getDrawdownAnalysis(userId);
    } catch (e) {
      console.warn('Drawdown prefetch notice:', e.message);
    }
  } else if (intentResult.needsJournal || intentResult.intent === 'JOURNAL_QUERY') {
    try {
      if (cleanQuestion.toLowerCase().includes('last') || cleanQuestion.toLowerCase().includes('recent') || cleanQuestion.toLowerCase().includes('history')) {
        journalContext = await getTradeHistory(userId, { limit: 10 });
      } else if (cleanQuestion.toLowerCase().includes('mistake') || cleanQuestion.toLowerCase().includes('emotion') || cleanQuestion.toLowerCase().includes('fomo') || cleanQuestion.toLowerCase().includes('revenge')) {
        journalContext = await getMistakesAndEmotions(userId);
      } else if (cleanQuestion.toLowerCase().includes('drawdown')) {
        journalContext = await getDrawdownAnalysis(userId);
      } else if (cleanQuestion.toLowerCase().includes('compare') && (cleanQuestion.toLowerCase().includes('setup') || cleanQuestion.toLowerCase().includes('strateg'))) {
        journalContext = await compareStrategies(userId);
      } else if (cleanQuestion.toLowerCase().includes('symbol') || cleanQuestion.toLowerCase().includes('instrument')) {
        journalContext = await getPerformanceBySymbol(userId);
      } else if (cleanQuestion.toLowerCase().includes('session')) {
        journalContext = await getPerformanceBySession(userId);
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
    'JOURNAL_COMPARISON',
    'STRATEGY_COMPARISON',
    'DRAWDOWN_ANALYSIS'
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

  // 4. Resolve API Key & Execution Mode
  if (userApiKey === 'offline') {
    const groundedAnswer = formatGroundedAnswer(intentResult.intent, journalContext, marketContext, intentResult.language);
    return {
      success: true,
      answer: groundedAnswer,
      intent: intentResult.intent,
      provider: intentResult.intent === 'MARKET_QUERY' ? 'technical-engine' : 'grounded-audit',
      model: intentResult.intent === 'MARKET_QUERY' ? 'TradeJourn Market Intelligence' : 'Institutional Ledger Engine'
    };
  }

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
    const groundedAnswer = formatGroundedAnswer(intentResult.intent, journalContext, marketContext, intentResult.language);
    return {
      success: true,
      answer: groundedAnswer,
      intent: intentResult.intent,
      provider: intentResult.intent === 'MARKET_QUERY' ? 'technical-engine' : 'grounded-audit',
      model: intentResult.intent === 'MARKET_QUERY' ? 'TradeJourn Market Intelligence' : 'Institutional Ledger Engine'
    };
  }

  // 6. Build Multi-turn Contents for Gemini
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

  // Inject verified grounded context ONLY if intent needs journal (prevents 0-trade warnings on greetings/education!)
  if (journalContext && intentResult.needsJournal) {
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
        provider: marketContext.provider || marketContext.source,
        source: marketContext.source,
        timestamp: marketContext.timestamp,
        change24h: marketContext.change24h,
        high24h: marketContext.high24h,
        low24h: marketContext.low24h,
        timeframe: marketContext.timeframe,
        isVerifiedExternal: marketContext.isVerifiedExternal,
        candleCount: marketContext.candles?.length || 0,
        hasGaps: marketContext.candleIntegrity?.hasGaps || false
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

  // 7. Execute Gemini Call with Tool Calling
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

      const candidateAnswer = cleanAiText(secondResult.text);
      // Guard against Gemini repeating canned one-liners
      const finalAnswer = (candidateAnswer && candidateAnswer.length > 20 && !candidateAnswer.includes('Analysis completed based on your verified journal ledger'))
        ? candidateAnswer
        : formatGroundedAnswer(intentResult.intent, toolResult, marketContext, intentResult.language);

      return {
        success: true,
        answer: finalAnswer,
        intent: intentResult.intent,
        provider: 'gemini',
        model: targetModel,
        toolExecuted: call.name
      };
    }

    if (geminiResult.text && geminiResult.text.trim()) {
      const candidateAnswer = cleanAiText(geminiResult.text);
      const finalAnswer = (!candidateAnswer.includes('Analysis completed based on your verified journal ledger'))
        ? candidateAnswer
        : formatGroundedAnswer(intentResult.intent, journalContext, marketContext, intentResult.language);

      return {
        success: true,
        answer: finalAnswer,
        intent: intentResult.intent,
        provider: 'gemini',
        model: targetModel
      };
    }

    throw new Error('Gemini returned an empty candidate text.');
  } catch (err) {
    console.warn(`Gemini API execution note (${err.message}). Using verified grounded engine.`);

    const groundedAnswer = formatGroundedAnswer(intentResult.intent, journalContext, marketContext, intentResult.language);
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
  cleanAiText,
  formatGroundedAnswer
};
