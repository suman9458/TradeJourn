/**
 * TradeJourn AI Coach Intelligence Audit & Verification Suite (70 Representative Questions)
 * =========================================================================================
 * Evaluates:
 * 1. Intent routing accuracy (greetings, education, journal, review, psychology, market, clarifications)
 * 2. Strict journal isolation (no irrelevant journal stats during greetings or education)
 * 3. Bottom Line Up Front (BLUF) direct answers before explanations
 * 4. Context-aware follow-up question presence
 * 5. Fluent Hindi, Hinglish, and English interpretation and response formulation
 * 6. Appropriate answer length based on question complexity
 * 7. Missing parameter detection & clarification requests (position sizing, etc.)
 * 8. Zero repeated generic responses (e.g. no "Analysis completed based on your verified journal ledger")
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { classifyIntent } = require('../services/ai/intentClassifier');
const { formatGroundedAnswer, processAiCoachChat } = require('../services/ai/aiCoachService');
const { calculatePositionSize } = require('../services/ai/statisticalAnalyticsService');

// Synthetic user objects
const mockUser = {
  _id: 'user_audit_test_01',
  name: 'Suman Singh',
  username: 'suman9458',
  role: 'trader',
  settings: {
    accountBalance: 10000,
    riskPerTrade: 1.0,
    aiModel: 'gemini-2.0-flash'
  }
};

describe('TradeJourn AI Coach - 70 Representative Question Audit Suite', () => {

  // =========================================================================
  // 1. GREETINGS & PLEASANTRIES (English & Hindi/Hinglish)
  // =========================================================================
  const greetingQuestions = [
    { q: 'Hi', lang: 'english' },
    { q: 'Hello coach!', lang: 'english' },
    { q: 'Good morning there', lang: 'english' },
    { q: 'Namaste sir', lang: 'hinglish' },
    { q: 'Kya haal hai bhai', lang: 'hinglish' },
    { q: 'Radhe Radhe ji', lang: 'hinglish' },
    { q: 'How are you doing today?', lang: 'english' }
  ];

  test('Suite 1: Greetings & Pleasantries return warm greetings without journal stats', async () => {
    for (const item of greetingQuestions) {
      const res = classifyIntent(item.q);
      assert.equal(res.intent, 'GREETING', `Expected GREETING for: "${item.q}"`);
      assert.equal(res.needsJournal, false, `needsJournal must be false for: "${item.q}"`);
      assert.equal(res.language, item.lang, `Language mismatch for: "${item.q}"`);

      // Test processAiCoachChat output for greetings
      const chatRes = await processAiCoachChat({
        question: item.q,
        user: mockUser
      });

      assert.equal(chatRes.success, true);
      assert.ok(chatRes.answer, 'Greeting answer must be present');
      // Verify no irrelevant journal statistics leaked
      assert.doesNotMatch(chatRes.answer, /win\s*rate|profit|\b\$|\bloss|closed\s+trades/i, `Greeting leaked journal stats: "${item.q}"`);
      // Verify personalized greeting or warm opening
      assert.match(chatRes.answer, /(Hi|Hello|Namaste|Welcome)/i, `Greeting missing friendly greeting token: "${item.q}"`);
      // Verify presence of suggested next steps/follow-ups
      assert.match(chatRes.answer, /💡|\b(quick|next|suggested)\b/i, `Greeting must provide suggested quick actions: "${item.q}"`);
    }
  });

  // =========================================================================
  // 2. IDENTITY & CAPABILITIES (English & Hindi/Hinglish)
  // =========================================================================
  const identityQuestions = [
    { q: 'Who are you?', lang: 'english' },
    { q: 'What can you do for me?', lang: 'english' },
    { q: 'Tum kaun ho aur kya kar sakte ho?', lang: 'hinglish' },
    { q: 'Aap kya karte ho?', lang: 'hinglish' }
  ];

  test('Suite 2: Identity & Capability questions explain institutional capabilities without journal stats', async () => {
    for (const item of identityQuestions) {
      const res = classifyIntent(item.q);
      assert.equal(res.intent, 'IDENTITY', `Expected IDENTITY for: "${item.q}"`);
      assert.equal(res.needsJournal, false, `needsJournal must be false for: "${item.q}"`);
      assert.equal(res.language, item.lang, `Language mismatch for: "${item.q}"`);

      const chatRes = await processAiCoachChat({
        question: item.q,
        user: mockUser
      });

      assert.equal(chatRes.success, true);
      assert.doesNotMatch(chatRes.answer, /closed\s+trades\s+logged/i, `Identity response leaked 0-trade ledger: "${item.q}"`);
      assert.match(chatRes.answer, /(TradeJourn|Copilot|Trading|mentor|analytics)/i, `Identity response lacks core description: "${item.q}"`);
    }
  });

  // =========================================================================
  // 3. CONVERSATIONAL ACKNOWLEDGMENTS & CASUAL CHAT (English & Hindi/Hinglish)
  // =========================================================================
  const conversationQuestions = [
    { q: 'Ok', lang: 'english' },
    { q: 'Theek hai bhai', lang: 'hinglish' },
    { q: 'Got it, understood', lang: 'english' },
    { q: 'Samajh gaya', lang: 'hinglish' },
    { q: 'Cool, talk to you later', lang: 'english' }
  ];

  test('Suite 3: Conversational acknowledgments respond naturally without repeated generic one-liners', async () => {
    for (const item of conversationQuestions) {
      const res = classifyIntent(item.q);
      assert.equal(res.intent, 'GENERAL_CONVERSATION', `Expected GENERAL_CONVERSATION for: "${item.q}"`);
      assert.equal(res.needsJournal, false, `needsJournal must be false for: "${item.q}"`);

      const chatRes = await processAiCoachChat({
        question: item.q,
        user: mockUser
      });

      assert.equal(chatRes.success, true);
      assert.doesNotMatch(chatRes.answer, /Analysis completed based on your verified journal ledger/i, `Generic one-liner emitted: "${item.q}"`);
      assert.doesNotMatch(chatRes.answer, /0 closed trades logged/i, `Conversational acknowledgment leaked 0-trade notice: "${item.q}"`);
      assert.match(chatRes.answer, /💡|\b(ready|suggestions|next)\b/i, `Acknowledgment must invite next actions: "${item.q}"`);
    }
  });

  // =========================================================================
  // 4. TRADING EDUCATION & CONCEPT CLARITY (English & Hindi/Hinglish)
  // =========================================================================
  const educationQuestions = [
    { q: 'What is win rate?', concept: 'win_rate', lang: 'english' },
    { q: 'Win rate kya hota hai?', concept: 'win_rate', lang: 'hinglish' },
    { q: 'What is risk to reward ratio?', concept: 'risk_reward', lang: 'english' },
    { q: 'RR ratio kya hota hai?', concept: 'risk_reward', lang: 'hinglish' },
    { q: 'What is a pip in forex?', concept: 'pips', lang: 'english' },
    { q: 'Explain liquidity sweep', concept: 'liquidity_sweep', lang: 'english' },
    { q: 'Liquidity sweep kya hai?', concept: 'liquidity_sweep', lang: 'hinglish' },
    { q: 'What is an order block?', concept: 'order_block', lang: 'english' },
    { q: 'Order block kya hota hai?', concept: 'order_block', lang: 'hinglish' },
    { q: 'What is a Fair Value Gap (FVG)?', concept: 'fair_value_gap', lang: 'english' },
    { q: 'What is Break of Structure (BOS)?', concept: 'bos', lang: 'english' },
    { q: 'What is Change of Character (CHoCH)?', concept: 'choch', lang: 'english' },
    { q: 'What is RSI indicator?', concept: 'rsi', lang: 'english' },
    { q: 'RSI indicator kya hota hai?', concept: 'rsi', lang: 'hinglish' },
    { q: 'What is MACD?', concept: 'macd', lang: 'english' },
    { q: 'What is exponential moving average (EMA)?', concept: 'moving_averages', lang: 'english' },
    { q: 'Support and resistance kya hota hai?', concept: 'support_resistance', lang: 'hinglish' },
    { q: 'What is Smart Money Concepts (SMC)?', concept: 'smc', lang: 'english' },
    { q: 'What are ICT killzones?', concept: 'killzones', lang: 'english' },
    { q: 'What is the ICT Silver Bullet?', concept: 'silver_bullet', lang: 'english' },
    { q: 'What is a trailing stop loss?', concept: 'trailing_stop', lang: 'english' },
    { q: 'What is drawdown in trading?', concept: 'drawdown', lang: 'english' },
    { q: 'What is slippage in trading?', concept: 'slippage', lang: 'english' },
    { q: 'Leverage kya hota hai?', concept: 'leverage', lang: 'hinglish' },
    { q: 'What is FOMO in trading?', concept: 'fomo', lang: 'english' },
    { q: 'What is revenge trading?', concept: 'revenge_trading', lang: 'english' }
  ];

  test('Suite 4: Trading Education questions provide direct definitions, formulas, and follow-ups without journal stats', async () => {
    for (const item of educationQuestions) {
      const res = classifyIntent(item.q);
      assert.equal(res.intent, 'TRADING_EDUCATION', `Expected TRADING_EDUCATION for: "${item.q}"`);
      assert.equal(res.needsJournal, false, `Educational query must NOT query personal journal: "${item.q}"`);
      assert.equal(res.concept, item.concept, `Concept mismatch for: "${item.q}"`);
      assert.equal(res.language, item.lang, `Language mismatch for: "${item.q}"`);

      const chatRes = await processAiCoachChat({
        question: item.q,
        user: mockUser
      });

      assert.equal(chatRes.success, true);
      assert.doesNotMatch(chatRes.answer, /0 closed trades logged/i, `Educational response leaked 0-trade notice: "${item.q}"`);
      assert.doesNotMatch(chatRes.answer, /Analysis completed based on your verified journal ledger/i, `Generic one-liner emitted: "${item.q}"`);
      // Verify Bottom Line Up Front (first line has substantive definition)
      const firstLine = chatRes.answer.split('\n')[0];
      assert.ok(firstLine.length > 20, `BLUF missing or too brief: "${firstLine}"`);
      // Verify presence of context-aware follow-up suggestions
      assert.match(chatRes.answer, /💡|\bSuggested Follow-ups\b/i, `Educational response missing suggested follow-ups: "${item.q}"`);
    }
  });

  // =========================================================================
  // 5. CLARIFICATIONS & MISSING INFORMATION DETECTION
  // =========================================================================
  test('Suite 5: Missing parameters trigger polite clarification requests with formulas', async () => {
    const missingParamQuestions = [
      { q: 'Calculate my lot size', lang: 'english' },
      { q: 'Mujhe kitne lot lene chahiye?', lang: 'hinglish' },
      { q: 'What position size should I use?', lang: 'english' },
      { q: 'Kitne lot buy karu?', lang: 'hinglish' }
    ];

    for (const item of missingParamQuestions) {
      const res = classifyIntent(item.q);
      assert.equal(res.intent, 'CLARIFICATION_NEEDED', `Expected CLARIFICATION_NEEDED for: "${item.q}"`);
      assert.equal(res.needsJournal, false, `Clarification must not query journal: "${item.q}"`);
      assert.equal(res.clarificationNeeded, true);

      const chatRes = await processAiCoachChat({
        question: item.q,
        user: mockUser
      });

      assert.equal(chatRes.success, true);
      assert.match(chatRes.answer, /(Account Balance|Balance|Stop-Loss|Risk Percentage|Formula)/i, `Clarification lacks missing parameters list: "${item.q}"`);
      assert.match(chatRes.answer, /💡|\bSuggested Next Step\b/i, `Clarification lacks suggested follow-up: "${item.q}"`);
    }

    // When parameters ARE provided, position size must be calculated directly without clarification
    const completeParamQ = 'Calculate lot size for $10,000 balance with 20 pips stop loss and 1% risk on EURUSD';
    const completeRes = classifyIntent(completeParamQ);
    assert.equal(completeRes.intent, 'POSITION_SIZING');

    const calculated = calculatePositionSize({
      balance: 10000,
      riskPct: 1.0,
      stopLossDistance: 20,
      instrument: 'EURUSD'
    });
    assert.match(calculated.calculatedPositionSize, /^0\.50?\s*Lots$/);
  });

  // =========================================================================
  // 6. JOURNAL ANALYTICS & PERSONAL STATS (English & Hindi/Hinglish)
  // =========================================================================
  test('Suite 6: Personal journal queries route to JOURNAL_QUERY and deliver BLUF data', () => {
    const journalQuestions = [
      { q: 'What is my win rate and expectancy?', lang: 'english' },
      { q: 'Mera current win rate kya hai?', lang: 'hinglish' },
      { q: 'Show my recent trades', lang: 'english' },
      { q: 'What are my biggest costly mistakes?', lang: 'english' },
      { q: 'Meri trading mistakes kya hain?', lang: 'hinglish' },
      { q: 'Calculate statistical distribution for my trades', intent: 'STATISTICAL_ANALYSIS' },
      { q: 'Compare my London and New York sessions', intent: 'JOURNAL_COMPARISON' },
      { q: 'What is my prop firm challenge status and drawdown buffer?', intent: 'PROP_FIRM_QUERY' }
    ];

    for (const item of journalQuestions) {
      const res = classifyIntent(item.q);
      const expectedIntent = item.intent || 'JOURNAL_QUERY';
      assert.equal(res.intent, expectedIntent, `Expected ${expectedIntent} for: "${item.q}"`);
      assert.equal(res.needsJournal, true, `Personal journal query must flag needsJournal: "${item.q}"`);
    }

    // Verify formatGroundedAnswer returns direct BLUF for 0-trade ledger
    const zeroTradeAnswer = formatGroundedAnswer('JOURNAL_QUERY', { totalTrades: 0, hasData: false }, null, 'english');
    assert.match(zeroTradeAnswer, /0 closed trades logged/i);
    assert.match(zeroTradeAnswer, /Quick Add Trade/i);
    assert.match(zeroTradeAnswer, /💡|\bSuggested Next Steps\b/i);

    // Verify formatGroundedAnswer returns direct BLUF for populated trade ledger
    const populatedAnswer = formatGroundedAnswer('JOURNAL_QUERY', {
      totalTrades: 6,
      winRate: '66.7%',
      winningTrades: 4,
      losingTrades: 2,
      breakEvenTrades: 0,
      netProfitUSD: '+$680',
      totalR: '+4.50R',
      expectancyUSD: '+$113.33',
      profitFactor: '2.84',
      averageDiscipline: '82/100',
      currentStreak: '2 Wins'
    }, null, 'english');

    assert.match(populatedAnswer, /Win Rate.*?66\.7%/i, 'BLUF win rate must be in the first section');
    assert.match(populatedAnswer, /\+\$680/, 'Net profit must be clearly displayed');
    assert.match(populatedAnswer, /💡.*?Suggested Follow-ups/i, 'Follow-ups must be attached');
  });

  // =========================================================================
  // 7. TRADE REVIEW & EXECUTION AUDIT (English & Hindi/Hinglish)
  // =========================================================================
  test('Suite 7: Trade reviews deliver direct BLUF verdicts and verify playbook rules without generic placeholders', () => {
    const reviewQuestions = [
      { q: 'Was my last trade according to my rules?', lang: 'english' },
      { q: 'Review my last trade', lang: 'english' },
      { q: 'Meri last trade check karo', lang: 'hinglish' },
      { q: 'Did I follow my entry rules on my last trade?', lang: 'english' },
      { q: 'Audit my trade execution', lang: 'english' },
      { q: 'Was my last trade an early exit?', lang: 'english' }
    ];

    for (const item of reviewQuestions) {
      const res = classifyIntent(item.q);
      assert.equal(res.intent, 'TRADE_REVIEW', `Expected TRADE_REVIEW for: "${item.q}"`);
      assert.equal(res.needsJournal, true, `Trade review requires journal context: "${item.q}"`);
    }

    // Verify review when no trade is found in journal
    const notFoundAnswer = formatGroundedAnswer('TRADE_REVIEW', { found: false }, null, 'english');
    assert.doesNotMatch(notFoundAnswer, /Analysis completed based on your verified journal ledger/i, 'Must not return canned placeholder');
    assert.match(notFoundAnswer, /No matching trade was found/i, 'Must give honest direct verdict');
    assert.match(notFoundAnswer, /Quick Add Trade/i, 'Must guide user to log trade');
    assert.match(notFoundAnswer, /💡|\bSuggested Next Steps\b/i);

    // Verify review when trade IS found
    const auditedTradeAnswer = formatGroundedAnswer('TRADE_REVIEW', {
      found: true,
      tradeName: 'EURUSD Buy London',
      instrument: 'EURUSD',
      direction: 'Buy',
      date: '2026-10-25',
      time: '08:30',
      session: 'London',
      setupRating: 'A+',
      entryType: 'Confirmation',
      result: 'WIN',
      profitUSD: '+$350',
      realizedR: '+2.50',
      plannedRR: '1:2.0',
      disciplineScore: 90,
      tradeGrade: 'A',
      ruleChecks: [
        { rule: 'Entry Confirmation', status: 'PASSED', note: 'Waited for 15m candle close.' },
        { rule: 'Risk-to-Reward', status: 'PASSED', note: 'Planned 1:2.0 achieved.' }
      ],
      missingFields: [],
      keyTakeaway: 'High-discipline execution adhering to London liquidity sweep model.'
    }, null, 'english');

    assert.match(auditedTradeAnswer, /EURUSD Buy London/);
    assert.match(auditedTradeAnswer, /Result.*?WIN/i);
    assert.match(auditedTradeAnswer, /Discipline Score.*?90\/100/);
    assert.match(auditedTradeAnswer, /PLAYBOOK RULE VERIFICATION/);
    assert.match(auditedTradeAnswer, /💡.*?Suggested Follow-ups/i);
  });

  // =========================================================================
  // 8. TRADING PSYCHOLOGY & TILT (English & Hindi/Hinglish)
  // =========================================================================
  test('Suite 8: Trading Psychology audits detect tilt patterns and prescribe process rules', () => {
    const psychQuestions = [
      { q: 'Audit my trading psychology and tilt', lang: 'english' },
      { q: 'How can I stop revenge trading?', lang: 'english' },
      { q: 'Loss ke baad revenge trading kaise rokein?', lang: 'hinglish' },
      { q: 'I am feeling FOMO on Gold', lang: 'english' },
      { q: 'Mujhe trading me dar lag raha hai', lang: 'hinglish' }
    ];

    for (const item of psychQuestions) {
      const res = classifyIntent(item.q);
      assert.equal(res.intent, 'TRADING_PSYCHOLOGY', `Expected TRADING_PSYCHOLOGY for: "${item.q}"`);
    }

    const psychAnswer = formatGroundedAnswer('TRADING_PSYCHOLOGY', {
      tiltRiskLevel: 'ELEVATED',
      totalTradesAnalyzed: 8,
      baselineWinRate: '62.5%',
      winRateAfterLoss: '25.0%',
      winRateAfterWin: '75.0%',
      earlyExitRatio: '37.5%',
      tiltEvidence: 'Sharp 37.5% drop in win rate following a losing trade with larger lots.',
      coachingRule: 'MANDATORY RULE: Step away for 30 minutes following any loss.'
    }, null, 'english');

    assert.match(psychAnswer, /Tilt Risk Level.*?\[ELEVATED\]/i);
    assert.match(psychAnswer, /Win Rate After a Loss.*?25\.0%/);
    assert.match(psychAnswer, /MANDATORY RULE/);
    assert.match(psychAnswer, /💡.*?Suggested Follow-ups/i);
  });

  // =========================================================================
  // 9. LIVE MARKET ANALYSIS & TECHNICAL OUTLOOKS (English & Hindi/Hinglish)
  // =========================================================================
  test('Suite 9: Live Market Analysis routes instruments and timeframes accurately', () => {
    const marketQuestions = [
      { q: 'Analyse Gold using technicals', symbol: 'XAUUSD', lang: 'english' },
      { q: 'Sona (Gold) ka chart analysis karo', symbol: 'XAUUSD', lang: 'hinglish' },
      { q: 'EURUSD on 1h chart', symbol: 'EURUSD', tf: '1h', lang: 'english' },
      { q: 'What is the technical outlook for Bitcoin?', symbol: 'BTCUSD', lang: 'english' },
      { q: 'Analyse GBPUSD', symbol: 'GBPUSD', lang: 'english' },
      { q: 'US30 daily chart review', symbol: 'US30', tf: '1d', lang: 'english' }
    ];

    for (const item of marketQuestions) {
      const res = classifyIntent(item.q);
      assert.equal(res.intent, 'MARKET_QUERY', `Expected MARKET_QUERY for: "${item.q}"`);
      assert.equal(res.extractedSymbol, item.symbol, `Symbol extraction failed for: "${item.q}"`);
      if (item.tf) {
        assert.equal(res.extractedTimeframe, item.tf, `Timeframe extraction failed for: "${item.q}"`);
      }
      assert.equal(res.needsMarket, true);
    }
  });

  // =========================================================================
  // 10. OVERALL STATISTICAL COVERAGE VERIFICATION
  // =========================================================================
  test('Suite 10: Verified at least 50 representative questions across all categories', () => {
    const totalQuestionsTested =
      greetingQuestions.length +
      identityQuestions.length +
      conversationQuestions.length +
      educationQuestions.length +
      4 + // missingParamQuestions
      8 + // journalQuestions
      6 + // reviewQuestions
      5 + // psychQuestions
      6;  // marketQuestions

    assert.ok(totalQuestionsTested >= 50, `Expected at least 50 questions tested, found: ${totalQuestionsTested}`);
  });
});
