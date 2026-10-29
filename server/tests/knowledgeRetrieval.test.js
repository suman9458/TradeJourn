/**
 * TradeJourn Trading Knowledge & Retrieval-Augmented Generation (RAG) Test Suite
 * ==============================================================================
 * Validates:
 * 1. Comprehensive coverage across all 15 required trading knowledge areas + prop firm rules.
 * 2. Proper preservation of metadata: Source, Title, Date, Type, Difficulty.
 * 3. Differentiation between established facts and trading opinions/hypotheses.
 * 4. Step-by-step mathematical calculations and numerical examples.
 * 5. Honest handling of conflicting broker, prop-firm, and methodological sources.
 * 6. Difficulty-based retrieval (Beginner, Intermediate, Advanced).
 * 7. Transparent documentation of covered vs unsupported knowledge domains.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  KNOWLEDGE_DOCUMENTS,
  KNOWLEDGE_COVERAGE,
  retrieveKnowledgeDocuments,
  getKnowledgeCatalogCoverage
} = require('../services/ai/knowledgeBaseService');
const { processAiCoachChat } = require('../services/ai/aiCoachService');

describe('TradeJourn Knowledge & Retrieval Engine - Comprehensive Audit Suite', () => {

  // =========================================================================
  // 1. KNOWLEDGE CATALOG INTEGRITY & AUDIT REPORTING
  // =========================================================================
  test('1. Document catalog integrity and metadata compliance', () => {
    assert.ok(KNOWLEDGE_DOCUMENTS.length >= 15, `Expected at least 15 comprehensive documents, found ${KNOWLEDGE_DOCUMENTS.length}`);

    for (const doc of KNOWLEDGE_DOCUMENTS) {
      assert.ok(doc.id, `Document missing ID: ${JSON.stringify(doc)}`);
      assert.ok(doc.title, `Document missing Title: ${doc.id}`);
      assert.ok(doc.category, `Document missing Category: ${doc.id}`);
      assert.ok(['Beginner', 'Intermediate', 'Advanced'].includes(doc.difficulty), `Invalid difficulty '${doc.difficulty}' in ${doc.id}`);
      assert.ok(doc.type, `Document missing Type/Classification: ${doc.id}`);
      assert.ok(doc.source, `Document missing Source Attribution: ${doc.id}`);
      assert.ok(doc.lastUpdated, `Document missing LastUpdated date: ${doc.id}`);
      assert.ok(doc.summary, `Document missing Summary: ${doc.id}`);
      assert.ok(doc.content && doc.content.length > 100, `Content too brief in ${doc.id}`);
      assert.ok(Array.isArray(doc.keywords) && doc.keywords.length >= 4, `Keywords insufficient in ${doc.id}`);
      assert.ok(Array.isArray(doc.suggestedFollowups) && doc.suggestedFollowups.length >= 2, `Follow-ups missing in ${doc.id}`);
    }
  });

  test('2. Knowledge coverage audit documents covered and unsupported areas', () => {
    const coverage = getKnowledgeCatalogCoverage();
    assert.ok(coverage.coveredAreas.length >= 15, 'Must cover at least 15 core trading areas');
    assert.ok(coverage.unsupportedAreas.length >= 3, 'Must explicitly state unsupported areas');

    const coveredNames = coverage.coveredAreas.map(c => c.area.toLowerCase());
    const expectedAreas = [
      'price action',
      'market structure',
      'liquidity',
      'support and resistance',
      'technical indicators',
      'risk management',
      'position sizing',
      'trading psychology',
      'forex mechanics',
      'commodities',
      'fundamental analysis',
      'economic events',
      'strategy design',
      'backtesting',
      'trading statistics',
      'prop firm rules'
    ];

    for (const expected of expectedAreas) {
      assert.ok(coveredNames.includes(expected), `Expected covered area missing: ${expected}`);
    }

    // Verify unsupported areas contain justifications
    for (const unsup of coverage.unsupportedAreas) {
      assert.ok(unsup.area, 'Unsupported area must have title');
      assert.ok(unsup.reason, 'Unsupported area must have transparent reason');
    }
  });

  // =========================================================================
  // 2. BEGINNER LEVEL KNOWLEDGE RETRIEVAL
  // =========================================================================
  test('3. Beginner level: Forex mechanics, spreads, and pip calculations', () => {
    const res = retrieveKnowledgeDocuments('base currency quote currency pipettes bid ask spread', { difficulty: 'Beginner' });
    assert.ok(res.retrieved > 0);
    const doc = res.passages.find(p => p.id === 'forex_mechanics_swaps_spreads_pip_math');
    assert.ok(doc, 'Must retrieve forex mechanics document');
    assert.equal(doc.difficulty, 'Beginner');
    assert.ok(doc.content.includes('Base Currency'));
    assert.ok(doc.content.includes('Spread'));
    assert.ok(doc.content.includes('Triple Swap'));
  });

  test('4. Beginner level: Support & resistance touch decay and role reversals', () => {
    const res = retrieveKnowledgeDocuments('support resistance touch decay role reversal', { difficulty: 'Beginner' });
    assert.ok(res.retrieved > 0);
    const doc = res.passages.find(p => p.id === 'support_resistance_supply_demand_zones');
    assert.ok(doc, 'Must retrieve support & resistance document');
    assert.equal(doc.difficulty, 'Beginner');
    assert.ok(doc.content.includes('Touch Decay Principle'));
    assert.ok(doc.content.includes('Role Reversal'));
  });

  test('5. Beginner level: Capital preservation and fixed fractional 1% rule', () => {
    const res = retrieveKnowledgeDocuments('fixed fractional 1% rule asymmetric recovery', { difficulty: 'Beginner' });
    assert.ok(res.retrieved > 0);
    const doc = res.passages.find(p => p.id === 'quantitative_risk_management_doctrine');
    assert.ok(doc, 'Must retrieve risk management doctrine');
    assert.equal(doc.difficulty, 'Beginner');
    assert.ok(doc.content.includes('-50% -> Requires +100.0% gain'));
  });

  // =========================================================================
  // 3. INTERMEDIATE LEVEL KNOWLEDGE RETRIEVAL
  // =========================================================================
  test('6. Intermediate level: Gold contract specifications and real yields', () => {
    const res = retrieveKnowledgeDocuments('gold contract specifications real yields XAUUSD troy ounces', { difficulty: 'Intermediate' });
    assert.ok(res.retrieved > 0);
    const doc = res.passages.find(p => p.id === 'commodities_gold_silver_oil_dynamics');
    assert.ok(doc, 'Must retrieve commodities gold document');
    assert.equal(doc.difficulty, 'Intermediate');
    assert.ok(doc.content.includes('100 Troy Ounces'));
    assert.ok(doc.content.includes('US Real Interest Rates'));
    assert.ok(doc.content.includes('DXY'));
  });

  test('7. Intermediate level: Multi-asset position sizing step-by-step math', () => {
    const res = retrieveKnowledgeDocuments('gold lot size position sizing formula stop loss distance');
    assert.ok(res.retrieved > 0);
    const doc = res.passages.find(p => p.id === 'position_sizing_multi_asset_calculators');
    assert.ok(doc, 'Must retrieve position sizing document');
    assert.ok(doc.content.includes('0.50 Lots'));
    assert.ok(doc.content.includes('$100 per 1.0 standard lot'));
  });

  test('8. Intermediate level: RSI Wilder smoothing, MACD and divergences', () => {
    const res = retrieveKnowledgeDocuments('rsi wilder smoothing formula macd histogram divergence');
    assert.ok(res.retrieved > 0);
    const doc = res.passages.find(p => p.id === 'technical_indicators_rsi_macd_divergence');
    assert.ok(doc, 'Must retrieve technical indicators document');
    assert.ok(doc.content.includes('Wilder'));
    assert.ok(doc.content.includes('Regular Bullish Divergence'));
    assert.ok(doc.content.includes('Hidden Divergence'));
  });

  test('9. Intermediate level: Trading psychology, loss aversion and disposition effect', () => {
    const res = retrieveKnowledgeDocuments('kahneman loss aversion disposition effect revenge trading');
    assert.ok(res.retrieved > 0);
    const doc = res.passages.find(p => p.id === 'trading_psychology_loss_aversion_fomo');
    assert.ok(doc, 'Must retrieve psychology document');
    assert.ok(doc.content.includes('2.0x to 2.5x'));
    assert.ok(doc.content.includes('Disposition Effect'));
    assert.ok(doc.content.includes('Amygdala Hijack'));
  });

  test('10. Intermediate level: Economic events, NFP, CPI, and pre-news spread widening', () => {
    const res = retrieveKnowledgeDocuments('nfp cpi fomc liquidity void spread blowout slippage');
    assert.ok(res.retrieved > 0);
    const doc = res.passages.find(p => p.id === 'economic_events_nfp_cpi_fomc_execution_risks');
    assert.ok(doc, 'Must retrieve economic events document');
    assert.ok(doc.content.includes('Liquidity Void Trap'));
    assert.ok(doc.content.includes('Non-Farm Payrolls'));
  });

  test('11. Intermediate level: Mathematical expectancy and the 5-stage trade lifecycle', () => {
    const res = retrieveKnowledgeDocuments('mathematical expectancy formula edge trade lifecycle');
    assert.ok(res.retrieved > 0);
    const doc = res.passages.find(p => p.id === 'strategy_design_expectancy_trade_lifecycle');
    assert.ok(doc, 'Must retrieve strategy design document');
    assert.ok(doc.content.includes('(Win Rate × Average Win USD)'));
    assert.ok(doc.content.includes('5-Stage Institutional Trade Lifecycle'));
  });

  // =========================================================================
  // 4. ADVANCED LEVEL KNOWLEDGE RETRIEVAL
  // =========================================================================
  test('12. Advanced level: Prop firm trailing high-water mark drawdown vs balance drawdown', () => {
    const res = retrieveKnowledgeDocuments('trailing high water mark drawdown prop firm challenge ftmo', { difficulty: 'Advanced' });
    assert.ok(res.retrieved > 0);
    const doc = res.passages.find(p => p.id === 'prop_firm_drawdown_semantics');
    assert.ok(doc, 'Must retrieve prop firm drawdown document');
    assert.equal(doc.difficulty, 'Advanced');
    assert.ok(doc.content.includes('$104,000'));
    assert.ok(doc.content.includes('BREACHED'));
    assert.ok(doc.content.includes('Balance-Based Drawdown'));
  });

  test('13. Advanced level: Central bank policy, carry trades, and inverted yield curve', () => {
    const res = retrieveKnowledgeDocuments('central bank carry trade inverted yield curve 10y 2y treasury', { difficulty: 'Advanced' });
    assert.ok(res.retrieved > 0);
    const doc = res.passages.find(p => p.id === 'fundamental_macro_central_banks_yield_curve');
    assert.ok(doc, 'Must retrieve fundamental macro document');
    assert.equal(doc.difficulty, 'Advanced');
    assert.ok(doc.content.includes('Carry Trade'));
    assert.ok(doc.content.includes('Inverted Yield Curve'));
  });

  test('14. Advanced level: Backtesting rigor, overfitting, and lookahead bias', () => {
    const res = retrieveKnowledgeDocuments('overfitting curve fitting lookahead bias out of sample backtesting', { difficulty: 'Advanced' });
    assert.ok(res.retrieved > 0);
    const doc = res.passages.find(p => p.id === 'backtesting_curve_fitting_lookahead_bias');
    assert.ok(doc, 'Must retrieve backtesting document');
    assert.equal(doc.difficulty, 'Advanced');
    assert.ok(doc.content.includes('Lookahead Bias'));
    assert.ok(doc.content.includes('Out-of-Sample'));
  });

  test('15. Advanced level: Sharpe ratio, Sortino ratio, and breakeven win rate matrix', () => {
    const res = retrieveKnowledgeDocuments('sharpe ratio sortino ratio profit factor breakeven win rate', { difficulty: 'Advanced' });
    assert.ok(res.retrieved > 0);
    const doc = res.passages.find(p => p.id === 'trading_statistics_sharpe_sortino_expectancy');
    assert.ok(doc, 'Must retrieve trading statistics document');
    assert.equal(doc.difficulty, 'Advanced');
    assert.ok(doc.content.includes('Sharpe Ratio Formula'));
    assert.ok(doc.content.includes('Sortino Ratio Formula'));
    assert.ok(doc.content.includes('1:2.0 R:R requires a 33.3% win rate'));
  });

  // =========================================================================
  // 5. FACT VS HYPOTHESIS & CONFLICTING SOURCES
  // =========================================================================
  test('16. Distinguishes established mathematical facts from trading hypotheses', () => {
    const res = retrieveKnowledgeDocuments('liquidity sweep order flow smart money');
    const doc = res.passages[0];
    assert.ok(doc.content.includes('Fact vs Trading Hypothesis') || doc.content.includes('Fact vs Hypothesis') || doc.content.includes('Established Fact'));
    assert.ok(doc.content.includes('Established Fact: Limit orders and stop orders cluster predictably'));
    assert.ok(doc.content.includes('Trading Hypothesis:'));
  });

  test('17. Honestly handles conflicting sources and varying broker/firm requirements', () => {
    const res = retrieveKnowledgeDocuments('trailing drawdown prop firm rules');
    const doc = res.passages[0];
    assert.ok(doc.content.includes('Conflicting Policies') || doc.content.includes('Conflicting'));
    assert.ok(doc.content.includes('FTMO utilizes balance-based'));
  });

  // =========================================================================
  // 6. END-TO-END CHAT GROUNDED RETRIEVAL INTEGRATION
  // =========================================================================
  test('18. processAiCoachChat outputs formatted knowledge with citations, math, and follow-ups in offline fallback', async () => {
    const chatRes = await processAiCoachChat({
      question: 'Explain trailing drawdown rule for prop firm challenges',
      user: { _id: 'test_user_knowledge_01' }
    });

    assert.equal(chatRes.success, true);
    assert.equal(chatRes.intent, 'KNOWLEDGE_RETRIEVAL');
    assert.ok(chatRes.answer.includes('RETRIEVED INSTITUTIONAL KNOWLEDGE DOCTRINE'));
    assert.ok(chatRes.answer.includes('Proprietary Trading Firm Master Standards'));
    assert.ok(chatRes.answer.includes('Source: TradeJourn Verified Knowledge Base'));
    assert.ok(chatRes.answer.includes('Next Steps / Suggested Follow-ups'));
  });

  test('19. Multi-turn knowledge retrieval handles contract specs and calculations', async () => {
    const chatRes = await processAiCoachChat({
      question: 'What are the contract specifications for Gold and real yields correlation?',
      user: { _id: 'test_user_knowledge_02' }
    });

    assert.equal(chatRes.success, true);
    assert.ok(chatRes.answer.includes('Gold') || chatRes.answer.includes('XAUUSD'));
    assert.ok(chatRes.answer.includes('Troy Ounces') || chatRes.answer.includes('Real'));
  });
});

