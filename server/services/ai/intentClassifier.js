/**
 * TradeJourn AI Intent Classifier & Conversational Router
 * ========================================================
 * Differentiates casual greetings, identity questions, educational queries,
 * personal journal stats, trading psychology, and live market requests.
 * Supports natural English, Hindi, and Hinglish.
 */

// Common greeting tokens (exact match or phrase match)
const GREETING_PATTERNS = [
  /^(hi|hello|hey|heyy|heya|yo|sup|hlo|hii|hiii)(\s+(there|bro|bhai|coach|mate|friend|sir|team|tradejourn))?[!.]*$/i,
  /^(good\s+(morning|afternoon|evening|day))(\s+(there|bro|bhai|coach|sir|team))?[!.]*$/i,
  /^(namaste|namaskar|pranam|ram\s*ram|radhe\s*radhe)(\s+(ji|bhai|sir))?([,\s]+(kaise\s+ho|kya\s+haal\s+hai|kaisa\s+hai|kaisa\s+chal\s+raha\s+hai))?[?!.]*$/i,
  /^(hi|hello|hey)[,\s]+(how\s+are\s+you|how's\s+it\s+going|how\s+r\s+u)[?!.]*$/i,
  /^(namaste|namaskar)[,\s]+(kaise\s+ho|kya\s+haal\s+hai)[?!.]*$/i,
  /^(kya\s+haal\s+hai|kaisa\s+hai|kaise\s+ho|kaise\s+ho\s+bhai|sab\s+badhiya)[?!.]*$/i,
  /^(how\s+are\s+you|how's\s+it\s+going|how\s+r\s+u|how\s+do\s+you\s+do)[?!.]*$/i
];

// Identity / capability patterns
const IDENTITY_PATTERNS = [
  /^(who\s+are\s+you|what\s+are\s+you|what\s+can\s+you\s+do|introduce\s+yourself)[?!.]*$/i,
  /^(tum\s+kaun\s+ho|kya\s+kar\s+sakte\s+ho|aap\s+kaun\s+hai|aap\s+kya\s+karte\s+ho)[?!.]*$/i,
  /^(help|commands|features)[?!.]*$/i
];

// Gratitude patterns
const GRATITUDE_PATTERNS = [
  /^(thanks|thank\s+you|thx|ty|shukriya|dhanyawad|bahut\s+badhiya)[!.]*$/i
];

// General trading education concepts (definition / explanation queries without personal journal intent)
const CONCEPT_EDUCATION_MAP = [
  {
    regex: /\b(what\s+is|explain|define)?\s*win\s*rate\b|\bwin\s*rate\s+kya\s+hota\s+hai\b|\bdefine\s+win\s*rate\b/i,
    concept: 'win_rate',
    answer: "Win Rate is the percentage of your trades that result in a profit out of total closed trades.\n\nFormula:\nWin Rate = (Winning Trades ÷ Total Trades) × 100\n\nExample:\nIf you take 10 trades and 6 are winners, your win rate is 60%.\n\nTip: A high win rate is not required to be profitable if your average reward is higher than your average risk (e.g. a 40% win rate with 1:3 Risk-to-Reward generates consistent profit)."
  },
  {
    regex: /\b(what\s+is|explain|define)?\s*(risk\s+to\s+reward|risk\s+reward|rr|r:r)\b|\brr\s+kya\s+hota\s+hai\b/i,
    concept: 'risk_reward',
    answer: "Risk-to-Reward Ratio (R:R) compares how much capital you risk on a trade against the profit target you aim to achieve.\n\nExample:\nIf you risk $50 (stop-loss) to target $150 (take-profit), your R:R is 1:3 (or +3R).\n\nKey Rule: Always define your risk before entering. Consistently aiming for 1:2R or higher allows you to stay profitable even with a 40-50% win rate."
  },
  {
    regex: /\b(what\s+(are|is)|explain|define)\s+(a\s+)?pips?\b|\bpip\s+kya\s+hota\s+hai\b|\bpips?\s+explained\b/i,
    concept: 'pips',
    answer: "A Pip (Percentage in Point) is the standardized unit of price measurement in Forex. For most major currency pairs (like EUR/USD), 1 pip equals 0.0001 (the 4th decimal place). For JPY pairs, 1 pip equals 0.01 (the 2nd decimal place).\n\nExample:\nIf EUR/USD moves from 1.0850 to 1.0870, price moved +20 pips.\nFor Gold (XAU/USD), a $0.10 price move is often measured as 1 pip ($1.00 move = 10 pips)."
  },
  {
    regex: /\b(what\s+is|explain|define)?\s*(liquidity\s+sweep|liquidity\s+grab)\b|\bliquidity\s+sweep\s+kya\s+hai\b/i,
    concept: 'liquidity_sweep',
    answer: "A Liquidity Sweep occurs when price briefly breaches a significant swing high or swing low to trigger retail stop-loss orders and breakout buy/sell stops, before aggressively reversing in the opposite direction.\n\nWhy it happens:\nInstitutions need massive volume (liquidity) to fill large orders. They push price where retail stops cluster (above double tops or below equal lows), absorb that liquidity, and immediately drive the true move."
  },
  {
    regex: /\b(what\s+is|explain|define)?\s*(order\s+block|ob)\b|\border\s+block\s+kya\s+hota\s+hai\b/i,
    concept: 'order_block',
    answer: "An Order Block (OB) represents the last opposing candle before an aggressive, market-shifting displacement move that breaks structure.\n\n- Bullish Order Block: The last down candle before an explosive upward expansion that creates an imbalance (FVG) and breaks resistance.\n- Bearish Order Block: The last up candle before an explosive drop breaking support.\n\nTraders watch for price to retrace back into the order block to enter in the direction of institutional momentum."
  },
  {
    regex: /\b(what\s+is|explain|define)?\s*(fair\s+value\s+gap|fvg|imbalance)\b|\bfvg\s+kya\s+hota\s+hai\b/i,
    concept: 'fair_value_gap',
    answer: "A Fair Value Gap (FVG) is a 3-candle price imbalance created when one side of the market moves so aggressively that price does not efficiently trade on both sides.\n\nDetection:\n- Bullish FVG: The high of Candle 1 does not overlap with the low of Candle 3. The empty space across Candle 2 is the imbalance.\n- Market tendency: Price frequently pulls back to rebalance this gap before continuing in the original trend direction."
  },
  {
    regex: /\b(what\s+is|explain|define)?\s*(break\s+of\s+structure|bos)\b|\bbos\s+kya\s+hota\s+hai\b/i,
    concept: 'bos',
    answer: "Break of Structure (BOS) confirms the continuation of an established trend.\n\n- Bullish BOS: Price creates a higher high by closing a candle above the previous swing high.\n- Bearish BOS: Price creates a lower low by closing a candle below the previous swing low.\n\nAlways wait for a candle body close to confirm a genuine BOS, as a wick-only break often indicates a liquidity sweep or rejection."
  },
  {
    regex: /\b(how\s+to\s+calculate\s+position\s+size|what\s+is\s+position\s+sizing|position\s+sizing\s+formula|lot\s+size\s+kaise\s+calculate)\b/i,
    concept: 'position_sizing',
    answer: "Position Sizing Formula:\nLot Size = (Account Balance × Risk %) ÷ (Stop Loss in Pips × Pip Value)\n\nExample:\n- Account: $10,000\n- Risk: 1% ($100 risk)\n- Stop-loss: 20 pips on EUR/USD ($10 per standard lot per pip)\n- Calculation: $100 ÷ (20 × $10) = 0.50 Lots.\n\nGolden Rule: Never adjust your stop-loss distance to fit your desired lot size. Fix your stop loss at technical invalidation first, then calculate lot size to risk no more than 1% to 2%."
  }
];

// Market analysis symbols detection
const MARKET_SYMBOLS_MAP = {
  xauusd: 'XAUUSD',
  xau: 'XAUUSD',
  gold: 'XAUUSD',
  sona: 'XAUUSD',
  xagusd: 'XAGUSD',
  xag: 'XAGUSD',
  silver: 'XAGUSD',
  chandi: 'XAGUSD',
  eurusd: 'EURUSD',
  eur: 'EURUSD',
  euro: 'EURUSD',
  gbpusd: 'GBPUSD',
  gbp: 'GBPUSD',
  pound: 'GBPUSD',
  usdjpy: 'USDJPY',
  jpy: 'USDJPY',
  yen: 'USDJPY',
  usdcad: 'USDCAD',
  cad: 'USDCAD',
  audusd: 'AUDUSD',
  aud: 'AUDUSD',
  btcusd: 'BTCUSD',
  btc: 'BTCUSD',
  bitcoin: 'BTCUSD',
  ethusd: 'ETHUSD',
  eth: 'ETHUSD',
  ethereum: 'ETHUSD',
  us30: 'US30',
  dow: 'US30',
  nas100: 'NAS100',
  nasdaq: 'NAS100'
};

// Journal query keywords (implies user is asking about THEIR personal trades)
const JOURNAL_QUERY_REGEX = /\b(my|mine|mera|meri|mere|mujhe|my\s+trades|my\s+win\s*rate|my\s+performance|my\s+mistakes|last\s+\d+\s+trades|last\s+trade|recent\s+trades|logged\s+trades|journal|stats|expectancy|discipline\s+score)\b/i;

// Market analysis request keywords
const MARKET_QUERY_REGEX = /\b(market|live\s+price|analyse|analyze|outlook|chart|current\s+price|technical\s+analysis|gold|xauusd|eurusd|gbpusd|btc|bitcoin|silver|us30|nasdaq|resistance|support)\b/i;

/**
 * Classify user intent and return fast answers where applicable
 */
function classifyIntent(rawText) {
  const text = (rawText || '').trim();
  const lower = text.toLowerCase();

  // 1. Detect language flavour
  const isHindi = /\b(kya|kaise|kaisa|mera|meri|mere|mujhe|bhai|karo|batao|karta|hai|hote|kyun|kyu|nahi|shukriya|dhanyawad|sona|chandi)\b/i.test(lower);
  const language = isHindi ? 'hinglish' : 'english';

  // 2. Check Greetings
  for (const pattern of GREETING_PATTERNS) {
    if (pattern.test(lower)) {
      const greetingEnglish = "Hi! 👋\nWelcome back to TradeJourn!\n\nWhat would you like to work on today? You can ask me anything about your trades, strategies, risk management, trading concepts or general questions.";
      const greetingHindi = "Namaste! 👋\nTradeJourn mein aapka swagat hai!\n\nAaj aap kis par kaam karna chahte hain? Aap mujhse trades, strategies, risk management, trading concepts ya general market questions poochh sakte hain.";
      return {
        intent: 'GREETING',
        language,
        needsJournal: false,
        needsMarket: false,
        fastAnswer: isHindi ? greetingHindi : greetingEnglish
      };
    }
  }

  // 3. Check Identity / Help
  for (const pattern of IDENTITY_PATTERNS) {
    if (pattern.test(lower)) {
      const idEnglish = "I am your TradeJourn AI Trading Copilot—an institutional trading mentor built into your journal. Here is what I can do for you:\n\n1. Journal Analytics: Audit your win rate, expectancy, session performance, and costly mistakes.\n2. Trading Education: Explain price action, market structure, liquidity sweeps, and risk management.\n3. Trading Psychology: Help you tackle revenge trading, FOMO, and discipline hurdles.\n4. Market Intelligence: Provide technical analysis, key levels, and outlooks on Gold, Forex, and Crypto.\n5. Screenshot Analysis: Analyze your chart images and setup confirmations.\n\nAsk me anything to get started!";
      const idHindi = "Main aapka TradeJourn AI Trading Copilot hoon. Main aapki in cheezon mein madad kar sakta hoon:\n\n1. Journal Analytics: Aapka real win rate, profit factor, aur repeated mistakes track karna.\n2. Trading Education: Price action, liquidity sweeps, aur risk management explain karna.\n3. Trading Psychology: Revenge trading aur FOMO ko control karne ke process rules banana.\n4. Market Analysis: Gold, Forex, aur Crypto par technical levels aur scenarios evaluate karna.\n5. Chart Screenshots: Aapke charts inspect karke feedback dena.\n\nAap koi bhi sawaal poochh sakte hain!";
      return {
        intent: 'IDENTITY',
        language,
        needsJournal: false,
        needsMarket: false,
        fastAnswer: isHindi ? idHindi : idEnglish
      };
    }
  }

  // 4. Check Gratitude
  for (const pattern of GRATITUDE_PATTERNS) {
    if (pattern.test(lower)) {
      return {
        intent: 'GRATITUDE',
        language,
        needsJournal: false,
        needsMarket: false,
        fastAnswer: isHindi
          ? "Aapka swagat hai! Disciplined rahiye aur apne rules follow karte rahiye. Koi aur sawaal ho toh zaroor batayein."
          : "You're very welcome! Stay disciplined, protect your capital, and let me know if you need to review anything else."
      };
    }
  }

  // 5. Check Standalone Concept Education (e.g., "What is win rate?" vs "What is my win rate?")
  const isPersonalQuery = JOURNAL_QUERY_REGEX.test(lower);
  if (!isPersonalQuery) {
    for (const item of CONCEPT_EDUCATION_MAP) {
      if (item.regex.test(lower)) {
        return {
          intent: 'TRADING_EDUCATION',
          concept: item.concept,
          language,
          needsJournal: false,
          needsMarket: false,
          fastAnswer: item.answer
        };
      }
    }
  }

  // 6. Check Specific Market Request
  let detectedSymbol = null;
  const words = lower.replace(/[^a-z0-9]/g, ' ').split(/\s+/);
  for (const w of words) {
    if (MARKET_SYMBOLS_MAP[w]) {
      detectedSymbol = MARKET_SYMBOLS_MAP[w];
      break;
    }
  }

  // Detect requested timeframe
  let detectedTimeframe = null;
  if (/\b(15\s*m(in|inutes?)?|15m)\b/i.test(lower)) detectedTimeframe = '15m';
  else if (/\b(4\s*h(ours?)?|4h)\b/i.test(lower)) detectedTimeframe = '4h';
  else if (/\b(1\s*d(ay)?|1d|daily)\b/i.test(lower)) detectedTimeframe = '1d';
  else if (/\b(1\s*h(our)?|1h|60\s*m(in)?)\b/i.test(lower)) detectedTimeframe = '1h';

  const isMarketQuery = (MARKET_QUERY_REGEX.test(lower) && detectedSymbol) || (detectedTimeframe && (detectedSymbol || /\b(timeframe|chart|candle|candles)\b/i.test(lower)));

  // 7. Check Psychology Request
  const isPsychologyQuery = /\b(revenge|fomo|overtrade|overtrading|fear|greed|anxious|anxiety|emotions?|discipline|rules|gussa|dar|loss\s+streak|tilt)\b/i.test(lower);

  // 8. Check Specific Trade Review Request
  const isTradeReview = /\b(review\s+(my\s+)?(last\s+)?trade|was\s+my\s+(last\s+)?trade\s+according\s+to\s+(my\s+)?rules|audit\s+(my\s+)?(last\s+)?trade|meri\s+last\s+trade\s+check\s+karo)\b/i.test(lower);

  // 9. Check Comparison Request
  const isComparisonQuery = /\b(compare|comparison|versus|\bvs\b)\b/i.test(lower) && (isPersonalQuery || /\b(london|new\s*york|session|month|week)\b/i.test(lower));

  // 10. Check Prop Firm Challenge Request
  const isPropFirmQuery = /\b(prop\s*firm|challenge|daily\s+loss(\s+limit)?|drawdown\s+buffer|profit\s+target)\b/i.test(lower);

  // 11. Check Playbook Request
  const isPlaybookQuery = /\b(my\s+rules|my\s+playbook|trading\s+plan|entry\s+rules|risk\s+rules|exit\s+rules|mere\s+rules)\b/i.test(lower);

  // 12. Check Backtest Request
  const isBacktestQuery = /\b(backtest|backtesting|test\s+strategy|test\s+ema|test\s+rsi)\b/i.test(lower);

  // 13. Check Economic Calendar & Macro News
  const isEconomicCalendar = /\b(economic\s+calendar|high\s+impact\s+news|macro\s+events?|\bnfp\b|\bcpi\b|\bfomc\b|ecb\s+rate|upcoming\s+news|economic\s+events|news\s+calendar)\b/i.test(lower);

  // 14. Check Position Sizing Calculator
  const isPositionSizing = /\b(position\s*size|lot\s*size|calculate\s+lots?|how\s+many\s+lots|risk\s+calculator|lot\s+calculator)\b/i.test(lower);

  // 15. Check Statistical Distribution & Confidence Intervals
  const isStatisticalAnalysis = /\b(statistical\s+distribution|confidence\s+interval|mean\s+vs\s+median|outlier\s+analysis|skewness|trade\s+distribution)\b/i.test(lower);

  // 16. Check Knowledge Retrieval / Doctrine
  const isKnowledgeRetrieval = /\b(prop\s+firm\s+rules|trailing\s+drawdown\s+rule|ict\s+order\s+block\s+rules|1%\s+risk\s+rule|drawdown\s+semantics|knowledge\s+doc)\b/i.test(lower);

  // 17. Check Macro Analysis
  const isMacroAnalysis = /\b(macro\s+drivers?|dxy\s+correlation|real\s+yields|fundamental\s+analysis|interest\s+rate\s+impact)\b/i.test(lower);

  let finalIntent = 'GENERAL_CONVERSATION';
  if (isTradeReview) finalIntent = 'TRADE_REVIEW';
  else if (isEconomicCalendar) finalIntent = 'ECONOMIC_CALENDAR';
  else if (isPositionSizing) finalIntent = 'POSITION_SIZING';
  else if (isStatisticalAnalysis) finalIntent = 'STATISTICAL_ANALYSIS';
  else if (isKnowledgeRetrieval) finalIntent = 'KNOWLEDGE_RETRIEVAL';
  else if (isMacroAnalysis) finalIntent = 'MACRO_ANALYSIS';
  else if (isPropFirmQuery) finalIntent = 'PROP_FIRM_QUERY';
  else if (isPlaybookQuery) finalIntent = 'PLAYBOOK_QUERY';
  else if (isComparisonQuery) finalIntent = 'JOURNAL_COMPARISON';
  else if (isBacktestQuery) finalIntent = 'BACKTEST_QUERY';
  else if (isPersonalQuery) finalIntent = 'JOURNAL_QUERY';
  else if (isMarketQuery) finalIntent = 'MARKET_QUERY';
  else if (isPsychologyQuery) finalIntent = 'TRADING_PSYCHOLOGY';

  const needsJournal = isPersonalQuery || isTradeReview || isComparisonQuery || isPropFirmQuery || isPlaybookQuery || isStatisticalAnalysis || (isPsychologyQuery && !detectedSymbol);

  return {
    intent: finalIntent,
    language,
    needsJournal,
    needsMarket: !!detectedSymbol || isMarketQuery || isMacroAnalysis,
    extractedSymbol: detectedSymbol,
    extractedTimeframe: detectedTimeframe,
    fastAnswer: null
  };
}

module.exports = {
  classifyIntent,
  GREETING_PATTERNS,
  CONCEPT_EDUCATION_MAP,
  MARKET_SYMBOLS_MAP
};
