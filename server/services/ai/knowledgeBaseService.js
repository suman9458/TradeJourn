/**
 * TradeJourn Knowledge Base & Institutional Document Retrieval (RAG)
 * ===================================================================
 * Curated knowledge repository covering:
 * 1. Prop Firm Evaluation Rules & Drawdown Semantics (FTMO, FundedNext, etc.)
 * 2. Institutional Price Action & Liquidity Principles (ICT / SMC / Wyckoff)
 * 3. Capital Preservation & Quantitative Risk Doctrines
 * 4. Macro Inter-market Dynamics
 */

const KNOWLEDGE_DOCUMENTS = [
  {
    id: 'prop_firm_drawdown_semantics',
    category: 'prop_firm_rules',
    title: 'Prop Firm Drawdown Types: Balance-Based vs Equity-Based vs Trailing High-Water Mark',
    keywords: ['prop firm', 'drawdown', 'daily loss', 'high water mark', 'trailing drawdown', 'ftmo', 'fundednext', 'rules'],
    content: `1. Daily Loss Limit (Typically 5%):
- Usually calculated based on the previous day's end-of-day balance or equity (whichever is higher at 00:00 server time).
- Critical Trap: If you have an open floating profit that reverses into a loss, the drawdown from the intra-day peak may breach the daily loss rule on equity-based firms.

2. Maximum Overall Loss Limit (Typically 10%):
- Static Drawdown: Initial account size - 10% (e.g., $100k account hard stop at $90,000). Never moves up with profits.
- Trailing High-Water Mark Drawdown: The stop-loss trails your highest achieved equity until it locks at the initial balance. More restrictive because trailing drawdown eats into profits.

3. Consistency Rules:
- Many prop firms require that no single trade accounts for more than 40% to 50% of your total profit target.
- Holding over the weekend or through high-impact news (red folder) may require specific account permissions.`
  },
  {
    id: 'institutional_liquidity_concepts',
    category: 'market_mechanics',
    title: 'Institutional Order Flow, Liquidity Sweeps, and Dealing Ranges',
    keywords: ['liquidity', 'order block', 'fvg', 'fair value gap', 'sweep', 'ict', 'smc', 'institutional'],
    content: `1. Where Liquidity Resides:
- Buy-Side Liquidity (BSL): Clustered above obvious double tops, swing highs, and key resistance levels. These are retail stop-loss orders on shorts and breakout buy stops.
- Sell-Side Liquidity (SSL): Clustered below double bottoms, equal lows, and major support levels. These are retail stop-loss orders on longs and breakdown sell stops.

2. Liquidity Sweep (Turtle Soup):
- Smart money pushes price beyond an obvious swing high to activate retail buy-stop liquidity, which provides the counterpart volume necessary to fill large institutional short positions.
- Confirmation: Price wicks through the level but candle body closes back inside the range, followed by displacement.

3. Fair Value Gap (FVG):
- A 3-candle sequence where the wicks of candle 1 and candle 3 do not overlap across candle 2.
- Represents one-sided market inefficiency. Institutions frequently re-test these imbalances to re-balance order books before continuing the dominant trend.`
  },
  {
    id: 'quantitative_risk_management_doctrine',
    category: 'risk_management',
    title: 'Institutional Capital Preservation: Fixed Fractional 1% Rule and Risk of Ruin',
    keywords: ['risk management', 'position sizing', 'risk of ruin', '1% rule', 'drawdown', 'kelly criterion'],
    content: `1. The Fixed Fractional 1% Rule:
- Never risk more than 1.0% to 2.0% of your current liquid equity on any single trade idea.
- If you have 3 consecutive losses at 1% risk, your account is down -2.97% (easily recoverable). At 5% risk per trade, 3 consecutive losses reduces your equity by -14.26%.

2. Asymmetric Recovery Curve:
- A -10% drawdown requires a +11.1% gain to break even.
- A -20% drawdown requires a +25.0% gain to break even.
- A -50% drawdown requires a +100.0% gain just to restore starting capital.

3. The 2-Loss Daily Circuit Breaker:
- Hard rule: If you suffer 2 consecutive stop-outs in a single trading session, stop trading immediately for that day.
- Human psychology deteriorates after back-to-back losses; dopamine seeking triggers over-leveraged revenge trading.`
  },
  {
    id: 'order_block_detection_rules',
    category: 'technical_analysis',
    title: 'Objective Order Block Identification and Validation Criteria',
    keywords: ['order block', 'ob', 'bullish order block', 'bearish order block', 'mitigation', 'retest'],
    content: `1. Bullish Order Block (OB+):
- Objective Definition: The last bearish (down) candle before an impulsive, explosive upward move that breaks market structure (BOS) and creates a Fair Value Gap (FVG).
- High-Probability Location: Must reside in a Discount Zone (<50% of the dealing range).
- Retest Entry: Enter when price pulls back to the open or 50% mean threshold of the down candle with stop-loss placed below the candle's low.

2. Bearish Order Block (OB-):
- Objective Definition: The last bullish (up) candle before an impulsive downward displacement that breaks market structure to the downside and leaves an FVG.
- High-Probability Location: Must reside in a Premium Zone (>50% of the dealing range).
- Retest Entry: Enter when price rallies back into the candle body with stop-loss placed above the candle's high.`
  }
];

/**
 * Search and retrieve relevant knowledge passages
 */
function retrieveKnowledgeDocuments(query = '', category = null, limit = 2) {
  if (!query || typeof query !== 'string') {
    return { retrieved: 0, passages: [] };
  }

  const queryTerms = query.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(w => w.length > 2);
  const scored = [];

  for (const doc of KNOWLEDGE_DOCUMENTS) {
    if (category && doc.category !== category) continue;

    let score = 0;
    // Check keyword matches
    for (const kw of doc.keywords) {
      if (queryTerms.some(term => kw.includes(term) || term.includes(kw))) {
        score += 3;
      }
    }

    // Check title matches
    const titleLower = doc.title.toLowerCase();
    for (const term of queryTerms) {
      if (titleLower.includes(term)) {
        score += 2;
      }
    }

    if (score > 0) {
      scored.push({ doc, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  const selected = scored.slice(0, limit).map(item => ({
    id: item.doc.id,
    title: item.doc.title,
    category: item.doc.category,
    content: item.doc.content
  }));

  return {
    query,
    retrieved: selected.length,
    passages: selected
  };
}

module.exports = {
  KNOWLEDGE_DOCUMENTS,
  retrieveKnowledgeDocuments
};

