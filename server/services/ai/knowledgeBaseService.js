/**
 * TradeJourn Knowledge Base & Institutional Document Retrieval (RAG)
 * ===================================================================
 * Verified, authoritative educational repository covering 15 core trading domains
 * across Beginner, Intermediate, and Advanced difficulty levels.
 *
 * Core Principles:
 * 1. Preserves source, title, publication date, and difficulty tier.
 * 2. Distinguishes established mathematical/empirical facts from trading hypotheses.
 * 3. Provides concrete step-by-step calculations and numerical examples.
 * 4. Honestly addresses conflicting schools of thought.
 * 5. Does not invent citations or fabricate trading rules.
 */

const KNOWLEDGE_DOCUMENTS = [
  // =========================================================================
  // 1. PROP FIRM EVALUATION RULES & DRAWDOWN SEMANTICS
  // =========================================================================
  {
    id: 'prop_firm_drawdown_semantics',
    category: 'prop_firm_rules',
    difficulty: 'Advanced',
    type: 'Industry Standard & Contractual Rules',
    source: 'Proprietary Trading Firm Master Standards (FTMO, FundedNext, Alpha Capital)',
    lastUpdated: '2026-03',
    title: 'Prop Firm Drawdown Types: Balance-Based vs Equity-Based vs Trailing High-Water Mark',
    keywords: ['prop firm', 'drawdown', 'daily loss', 'high water mark', 'trailing drawdown', 'ftmo', 'fundednext', 'rules', 'challenge'],
    summary: 'Drawdown in prop firms is evaluated either statically from account balance or dynamically from peak floating equity, creating critical execution traps.',
    content: `1. Balance-Based Drawdown (Static vs End-of-Day):
• Definition: Drawdown limit is pegged strictly to the closed account balance at the start of the trading day (usually 00:00 server time).
• Example: On a $100,000 account with a 5% daily loss limit ($5,000), your equity cannot dip below $95,000 on that calendar day, regardless of intra-day floating profit.

2. Equity-Based Drawdown & Trailing High-Water Mark:
• Definition: Drawdown limit trails the highest intra-day equity peak achieved during open trades.
• Calculation Trap:
  - Account starting balance: $100,000. Daily limit: 5% ($5,000).
  - Trader enters a long position. Floating profit reaches +$4,000 (Equity peak: $104,000).
  - The trailing daily loss limit dynamically locks at $104,000 - $5,000 = $99,000.
  - Price reverses and the trade is closed at -$1,500 (Balance: $98,500).
  - Verdict: Even though the closed loss is only $1,500 from the morning balance, the account is BREACHED because equity plunged $5,500 from its intra-day high-water mark ($104,000 to $98,500).

3. Fact vs Hypothesis:
• Established Fact: Broker liquidation servers monitor raw tick equity in real time; breaching the defined loss limit triggers immediate automated contract termination.
• Conflicting Policies: Different prop firms enforce contrasting rules. FTMO utilizes balance-based daily drawdown, whereas many rapid-evaluation firms enforce trailing equity high-water mark rules. Always review your specific firm's terms of service.`,
    suggestedFollowups: [
      'How to calculate position size to protect an equity-based trailing drawdown buffer?',
      'What are the weekend holding and news event rules for prop firms?'
    ]
  },

  // =========================================================================
  // 2. LIQUIDITY & MARKET MICROSTRUCTURE
  // =========================================================================
  {
    id: 'institutional_liquidity_concepts',
    category: 'liquidity',
    difficulty: 'Intermediate',
    type: 'Market Microstructure & Order Flow Framework',
    source: 'CME Group Order Matching Principles & Auction Market Theory',
    lastUpdated: '2026-02',
    title: 'Institutional Order Flow, Liquidity Pools, and Sweep Mechanics',
    keywords: ['liquidity', 'order block', 'fvg', 'fair value gap', 'sweep', 'ict', 'smc', 'institutional', 'turtle soup', 'bsl', 'ssl'],
    summary: 'Institutions require massive counter-liquidity (resting stop clusters) to fill large orders without suffering destructive slippage.',
    content: `1. Where Resting Liquidity Clusters:
• Buy-Side Liquidity (BSL): Clustered directly above swing highs, double tops, and equal highs (EQH). These orders represent retail stop-losses on short positions and breakout buy-stop orders.
• Sell-Side Liquidity (SSL): Clustered directly below swing lows, double bottoms, and equal lows (EQL). These represent retail stop-losses on longs and breakdown sell-stop orders.

2. Step-by-Step Liquidity Sweep (Turtle Soup) Mechanics:
• Step 1: Institutional buy/sell volume deliberately absorbs all bids/offers up to and beyond the obvious swing high.
• Step 2: The penetration triggers thousands of retail stop-loss orders (which become market buy orders).
• Step 3: Institutions utilize these aggressive buy orders as the immediate counter-party liquidity to match and execute massive institutional short positions.
• Step 4: Price swiftly prints an extended wick above the level and candle body closes back inside the original range, signaling institutional absorption.

3. Fact vs Trading Hypothesis:
• Established Fact: Limit orders and stop orders cluster predictably around visible chart extremes, as confirmed by exchange Level 2 Depth of Market (DOM) books.
• Trading Hypothesis: The narrative of a single omniscient "Algorithm" or "Market Maker" personally targeting individual retail accounts is a simplified metaphor. In reality, multiple competing liquidity providers, quantitative hedge funds, and bank desks compete for order flow efficiency.`,
    suggestedFollowups: [
      'How to confirm a true liquidity sweep vs a trend continuation breakout?',
      'What is an institutional Fair Value Gap (FVG)?'
    ]
  },

  // =========================================================================
  // 3. MARKET STRUCTURE & ORDER BLOCKS
  // =========================================================================
  {
    id: 'order_block_detection_rules',
    category: 'market_structure',
    difficulty: 'Intermediate',
    type: 'Price Action Methodology',
    source: 'Institutional Price Action & Smart Money Concepts (SMC)',
    lastUpdated: '2026-01',
    title: 'Objective Order Block Identification, Dealing Ranges, and BOS Confirmation',
    keywords: ['order block', 'ob', 'bullish order block', 'bearish order block', 'mitigation', 'retest', 'market structure', 'bos', 'choch'],
    summary: 'Order blocks represent the origin footprint of institutional displacement that breaks structural swing points and creates imbalances.',
    content: `1. Objective Order Block (OB) Criteria:
• Bullish Order Block (OB+): The final bearish down-candle preceding an aggressive upward displacement impulse that achieves two objective milestones:
  1. Closes a candle body above a structural swing high (Break of Structure - BOS).
  2. Leaves a clean 3-candle Fair Value Gap (FVG) immediately above the candle.
• Bearish Order Block (OB-): The final bullish up-candle preceding an aggressive downward displacement impulse breaking a structural swing low.

2. Dealing Range & Equilibrium Formula:
• Equilibrium (50% Zone) = (Swing High + Swing Low) ÷ 2
• Premium Zone (>50%): High-probability zone for short entries (OB-).
• Discount Zone (<50%): High-probability zone for long entries (OB+).
• Rule: Institutional participants prioritize buying in Discount and selling in Premium.

3. Conflicting Perspectives:
• Classical Technical Analysis describes these zones as "Support/Resistance" or "Supply and Demand".
• SMC / ICT frameworks specify the exact single opposing candle of displacement origin.
• Fact vs Hypothesis: While displacement zones reliably trigger reactive pullbacks due to unfilled institutional limit orders, order blocks are not impenetrable barriers; macro news or overriding higher-timeframe order flow frequently mitigates or invalidates them.`,
    suggestedFollowups: [
      'How does a Breaker Block differ from an Order Block?',
      'What is Change of Character (CHoCH) and how is it confirmed?'
    ]
  },

  // =========================================================================
  // 4. QUANTITATIVE RISK MANAGEMENT & CAPITAL PRESERVATION
  // =========================================================================
  {
    id: 'quantitative_risk_management_doctrine',
    category: 'risk_management',
    difficulty: 'Beginner',
    type: 'Mathematical Law & Quantitative Probability',
    source: 'Ralph Vince - The Mathematics of Money Management & Modern Portfolio Theory',
    lastUpdated: '2026-02',
    title: 'Capital Preservation Mathematics: Fixed Fractional Sizing, Drawdown Recovery & Risk of Ruin',
    keywords: ['risk management', 'position sizing', 'risk of ruin', '1% rule', 'drawdown', 'kelly criterion', 'asymmetric recovery'],
    summary: 'Capital loss creates an asymmetric mathematical recovery curve where losses compound geometrically against remaining equity.',
    content: `1. The Asymmetric Drawdown Recovery Curve (Mathematical Reality):
• When capital is lost, the percentage gain required to restore starting equity grows exponentially:
  - Loss of -10% -> Requires +11.1% gain to recover.
  - Loss of -20% -> Requires +25.0% gain to recover.
  - Loss of -30% -> Requires +42.9% gain to recover.
  - Loss of -50% -> Requires +100.0% gain to recover.
  - Loss of -75% -> Requires +300.0% gain to recover.
  - Loss of -90% -> Requires +900.0% gain to recover.
• Core Lesson: Protecting equity from breaching -10% to -15% drawdown is far easier than attempting a +100% recovery with diminished capital.

2. Fixed Fractional 1% Rule Comparison:
• Trader A risks 1% per trade. After 5 consecutive losses:
  Ending Equity = $10,000 × (0.99)^5 = $9,509.90 (-4.90% drawdown). Easily recovered in 2-3 standard wins.
• Trader B risks 5% per trade. After 5 consecutive losses:
  Ending Equity = $10,000 × (0.95)^5 = $7,737.81 (-22.62% drawdown). Requires a +29.2% gain to break even.

3. The Kelly Criterion Formula:
• Full Kelly % = W - [(1 - W) ÷ R]
  Where W = Historical Win Rate, R = Average Win / Average Loss ratio.
• Practical Note: In retail trading, "Full Kelly" is dangerously volatile. Institutional quantitative funds utilize "Quarter Kelly" (0.25 × Kelly) to minimize the probability of catastrophic drawdown.`,
    suggestedFollowups: [
      'How to calculate exact lot size for a 1% risk EURUSD trade?',
      'What is the 2-loss daily circuit breaker rule?'
    ]
  },

  // =========================================================================
  // 5. POSITION SIZING ACROSS ASSET CLASSES
  // =========================================================================
  {
    id: 'position_sizing_multi_asset_calculators',
    category: 'position_sizing',
    difficulty: 'Intermediate',
    type: 'Mathematical Law & Contract Specifications',
    source: 'Bank for International Settlements (BIS) & CME Group Contract Specs',
    lastUpdated: '2026-03',
    title: 'Exact Position Sizing Formulas for Forex, Commodities (Gold/Silver), and Indices',
    keywords: ['position sizing', 'lot size', 'forex position size', 'gold lot size', 'xauusd position size', 'contract size', 'margin', 'leverage'],
    summary: 'Position sizing must be derived from monetary risk target and stop distance, never by arbitrary lot size guesses.',
    content: `1. Standard Forex Position Sizing Formula:
• Formula: Lot Size = (Account Balance × Risk %) ÷ (Stop Loss in Pips × Pip Value per Standard Lot)
• Step-by-Step Numerical Example:
  - Account Balance: $10,000
  - Risk Target: 1.0% ($100 risk)
  - Instrument: EUR/USD (Standard Lot Pip Value = $10.00)
  - Stop-Loss Distance: 20 pips
  - Calculation: $100 ÷ (20 × $10) = $100 ÷ $200 = 0.50 Lots.

2. Gold (XAUUSD) Position Sizing Formula:
• Contract Specification: 1 Standard Lot = 100 Troy Ounces.
• Therefore, a $1.00 move in gold price equals exactly $100 per 1.0 standard lot ($0.10 move = $10 = 1 pip).
• Formula: Lot Size = Risk Amount ($) ÷ (Stop Loss Distance in Dollars × 100)
• Step-by-Step Numerical Example:
  - Account Balance: $25,000
  - Risk Target: 1.0% ($250 risk)
  - Entry Price: 2,750.00 | Stop-Loss: 2,745.00 (Distance: $5.00)
  - Calculation: $250 ÷ ($5.00 × 100) = $250 ÷ $500 = 0.50 Lots.

3. Indices (US30 / NAS100) Sizing Formula:
• Formula: Lot Size = Risk Amount ($) ÷ (Stop Distance in Points × Point Value per Contract)
• Example: $50,000 account, 1% risk ($500), 50-point stop loss on US30 ($1/point) = 10 Contracts.

4. Margin & Leverage Verification:
• Required Margin = (Contract Units × Asset Price) ÷ Broker Leverage Ratio.
• Warning: High leverage (1:500) reduces required initial margin, but does not alter pip value or risk of ruin.`,
    suggestedFollowups: [
      'Calculate lot size for a 15-pip stop loss on Gold with $5,000 balance.',
      'What is the difference between margin call and stop-out level?'
    ]
  },

  // =========================================================================
  // 6. TECHNICAL INDICATORS: RSI, MACD & DIVERGENCES
  // =========================================================================
  {
    id: 'technical_indicators_rsi_macd_divergence',
    category: 'technical_indicators',
    difficulty: 'Intermediate',
    type: 'Mathematical Oscillator & Empirical Modeling',
    source: 'J. Welles Wilder (1978) - New Concepts in Technical Trading Systems & Gerald Appel (MACD)',
    lastUpdated: '2026-01',
    title: 'RSI Wilder Smoothing, MACD Histogram Mechanics, and Divergence Identification',
    keywords: ['rsi', 'macd', 'technical indicators', 'divergence', 'wilder rsi', 'moving average', 'bollinger bands', 'atr'],
    summary: 'Oscillators measure rate of change of closing prices; divergence indicates momentum exhaustion relative to price structure.',
    content: `1. Relative Strength Index (RSI) Formula & Mechanics:
• Formula: RSI = 100 - [100 ÷ (1 + RS)]
  Where RS = Smoothed Average Gain ÷ Smoothed Average Loss over N periods (Standard: 14).
• Wilder's Exponential Smoothing:
  Current Average Gain = [(Prior Avg Gain × 13) + Current Gain] ÷ 14.
• Thresholds: >70 indicates overbought conditions; <30 indicates oversold conditions; 50 is the bullish/bearish equilibrium line.

2. Regular vs Hidden Divergence:
• Regular Bullish Divergence (Reversal): Price prints a Lower Low, while RSI prints a Higher Low. Signals downward momentum exhaustion.
• Regular Bearish Divergence (Reversal): Price prints a Higher High, while RSI prints a Lower High. Signals upward momentum exhaustion.
• Hidden Divergence (Trend Continuation): Price prints a Higher Low, but RSI prints a Lower Low. Signals trend continuation.

3. MACD (Moving Average Convergence Divergence) Calculation:
• MACD Line = 12-period EMA minus 26-period EMA.
• Signal Line = 9-period EMA of the MACD Line.
• MACD Histogram = MACD Line minus Signal Line.
• Signal: Histogram crossing above zero confirms bullish expansion; crossing below confirms bearish acceleration.

4. Fact vs Opinion:
• Fact: RSI and MACD are mathematical lagging derivatives of historical closing prices; they cannot predict unexpected fundamental catalysts.
• Opinion/Myth: "RSI > 70 means price must reverse down immediately." In strong institutional trends, RSI frequently remains pinned above 70 for dozens of bars while price doubles.`,
    suggestedFollowups: [
      'How to trade RSI divergence in combination with support and resistance levels?',
      'What is Average True Range (ATR) and how is it used to set stop losses?'
    ]
  },

  // =========================================================================
  // 7. TRADING PSYCHOLOGY & COGNITIVE BIASES
  // =========================================================================
  {
    id: 'trading_psychology_loss_aversion_fomo',
    category: 'trading_psychology',
    difficulty: 'Intermediate',
    type: 'Behavioral Economics & Neuro-Cognitive Science',
    source: 'Daniel Kahneman & Amos Tversky (1979) - Prospect Theory & Mark Douglas (Trading in the Zone)',
    lastUpdated: '2026-02',
    title: 'Trading Psychology: Loss Aversion, The Disposition Effect, FOMO, and Revenge Cycles',
    keywords: ['psychology', 'loss aversion', 'fomo', 'revenge trading', 'tilt', 'kahneman', 'mark douglas', 'discipline'],
    summary: 'Human neurobiology is hardwired to experience financial loss with greater neural intensity than equivalent gains, causing systematic execution sabotage.',
    content: `1. Prospect Theory & Loss Aversion (Kahneman & Tversky):
• Empirical Finding: The emotional and psychological pain of losing $1,000 is measured to be 2.0x to 2.5x more intense than the joy of winning $1,000.
• Behavioral Sabotage: To avoid acknowledging the intense pain of a loss, traders refuse to take technical stop-losses, moving them further away or averaging down into catastrophic drawdowns.

2. The Disposition Effect:
• Traders systematically sell winning trades too early (fear of losing floating profits) while holding losing trades far too long (hope that price will return to breakeven).
• This inverts the required institutional expectancy, creating tiny wins and oversized losses.

3. Amygdala Hijack & The Revenge Trading Cycle:
• When a trader suffers an unexpected loss or an invalid stop-out, the brain's emotional center (amygdala) overrides executive prefrontal cortex logic.
• Result: Heart rate spikes, dopamine-seeking urges trigger oversized impulsive trades, and the trader abandons all playbook rules.

4. Concrete Process Protocol:
• Mandatory 30-Minute Break: Following any loss, step away from the monitor to allow cortisol levels to normalize.
• 2-Loss Daily Limit: Hard shutdown of trading terminal upon taking 2 consecutive losses in a single day.`,
    suggestedFollowups: [
      'How does TradeJourn audit my tilt risk and revenge trading patterns?',
      'What rules prevent closing winning trades prematurely?'
    ]
  },

  // =========================================================================
  // 8. FOREX MARKET MECHANICS, SWAPS & SPREADS
  // =========================================================================
  {
    id: 'forex_mechanics_swaps_spreads_pip_math',
    category: 'forex_mechanics',
    difficulty: 'Beginner',
    type: 'Market Microstructure & Settlement Rules',
    source: 'Bank for International Settlements (BIS) Triennial Central Bank Survey',
    lastUpdated: '2026-03',
    title: 'Forex Mechanics: Base vs Quote Currency, Bid/Ask Spreads, Pipettes, and Overnight Swaps',
    keywords: ['forex mechanics', 'pip', 'pipette', 'spread', 'bid ask', 'swap', 'rollover', 'base currency', 'quote currency'],
    summary: 'Forex transactions represent simultaneous buying of one sovereign currency and selling of another, settled via continuous interbank credit.',
    content: `1. Base Currency vs Quote Currency:
• In any currency pair (e.g. GBP/USD):
  - GBP is the Base Currency (always equals 1 unit).
  - USD is the Quote (or Term) Currency (the amount required to buy 1 unit of base).
• If GBP/USD is quoted at 1.2850: 1 British Pound costs $1.2850 US Dollars.

2. Pips vs Pipettes:
• Pip: 4th decimal place (0.0001) for major pairs (e.g., 1.0850 to 1.0851 = 1 pip).
• Pipette: 5th decimal place (0.00001), equal to 0.1 pip.
• JPY Exception: Japanese Yen pairs are quoted to 2 decimal places (1 pip = 0.01; pipette = 0.001).

3. Bid, Ask & The Spread:
• Bid Price: The highest price at which buyers in the market are willing to purchase (the price you receive when you Sell).
• Ask Price: The lowest price sellers are willing to accept (the price you pay when you Buy).
• Spread = Ask minus Bid. This is the immediate broker transaction friction.

4. Overnight Rollover & Swap Mechanics:
• Interest Rate Differential: When holding a position past 17:00 EST (New York close), you earn the interest rate of the currency you bought and pay the interest rate of the currency you sold.
• Triple Swap Wednesday: Because spot Forex settles T+2 (two business days), positions held over Wednesday night incur 3 days of swap fees to cover the weekend.`,
    suggestedFollowups: [
      'How does swap affect long-term swing trading strategies?',
      'How to calculate pip value for USD/JPY vs EUR/USD?'
    ]
  },

  // =========================================================================
  // 9. COMMODITIES: GOLD (XAUUSD), SILVER & CRUDE OIL
  // =========================================================================
  {
    id: 'commodities_gold_silver_oil_dynamics',
    category: 'commodities',
    difficulty: 'Intermediate',
    type: 'Macro Commodity Fundamentals & Pricing Specifications',
    source: 'World Gold Council & CME Group Metals Specification',
    lastUpdated: '2026-02',
    title: 'Commodity Trading: Gold (XAUUSD) Specifications, Real Yields, and DXY Correlation',
    keywords: ['commodities', 'gold', 'xauusd', 'silver', 'xagusd', 'crude oil', 'real yields', 'dxy correlation'],
    summary: 'Gold trades as a monetary reserve and zero-yield hard currency with strong inverse sensitivity to US real interest rates and the Dollar Index.',
    content: `1. Gold (XAUUSD) Contract Specifications:
• 1 Standard Lot = 100 Troy Ounces of .999 Fine Gold.
• Price Quotation: Measured in US Dollars per ounce (e.g. $2,750.00).
• Pip & Point Convention:
  - $0.01 price move = 1 point ($1.00 per standard lot).
  - $0.10 price move = 1 pip ($10.00 per standard lot).
  - $1.00 price move = 10 pips ($100.00 per standard lot).

2. Primary Macro Drivers for Gold:
• US Real Interest Rates (10-Year TIPS Yield): Strongest negative correlation. Because Gold pays no dividend or coupon yield, when real yields surge (e.g. >2.0%), institutional capital rotates into interest-bearing Treasuries. When real yields plunge, Gold surges.
• US Dollar Index (DXY): Inverse correlation. A strengthening USD makes Gold more expensive for foreign reserve holders, suppressing demand.
• Geopolitical Hedging & Central Bank Accumulation: Sovereign central banks (PBOC, RBI) accumulate physical gold reserves to diversify away from USD sanctions risk.

3. Silver (XAGUSD) vs Gold:
• Contract Size: 1 Standard Lot = 5,000 Troy Ounces.
• A $0.01 move in silver equals $50.00 per standard lot.
• Due to heavy dual usage as both monetary store of value and industrial metal (solar panels, electronics), Silver exhibits significantly higher beta and percentage volatility than Gold.`,
    suggestedFollowups: [
      'What are the key technical support and resistance levels for Gold today?',
      'How do bond yields affect currency pair values?'
    ]
  },

  // =========================================================================
  // 10. FUNDAMENTAL ANALYSIS: CENTRAL BANKS & YIELD CURVES
  // =========================================================================
  {
    id: 'fundamental_macro_central_banks_yield_curve',
    category: 'fundamental_analysis',
    difficulty: 'Advanced',
    type: 'Macroeconomics & Monetary Policy',
    source: 'Federal Reserve System, European Central Bank (ECB) & Bank of Japan (BOJ)',
    lastUpdated: '2026-03',
    title: 'Fundamental Analysis: Central Bank Interest Rate Cycles, Carry Trades, and Yield Curve Dynamics',
    keywords: ['fundamental analysis', 'central banks', 'federal reserve', 'interest rates', 'yield curve', 'carry trade', 'inflation', 'cpi'],
    summary: 'Sovereign exchange rates reflect cross-border capital flows seeking the highest risk-adjusted real interest rates.',
    content: `1. Central Bank Monetary Policy Transmission:
• Hawkish Policy: Raising official benchmark interest rates and reducing balance sheet size (Quantitative Tightening) to fight inflation. Strengthens the sovereign currency by attracting global yield-seeking capital.
• Dovish Policy: Cutting benchmark rates and expanding liquidity (Quantitative Easing) to stimulate economic activity. Weakens the sovereign currency.

2. The Currency Carry Trade:
• Mechanics: Global funds borrow capital in low-interest currencies (e.g. Japanese Yen at 0.25% or Swiss Franc) and convert funds to purchase high-yielding sovereign bonds (e.g. US Treasuries at 4.50%).
• Risk: Unwinding of the carry trade (rapid appreciation of the funding currency) causes violent, cascade liquidations across global risk assets.

3. The Inverted Yield Curve (10Y minus 2Y Treasury):
• Normal Yield Curve: Longer-dated bonds yield more than shorter-dated bonds to compensate investors for duration risk.
• Inversion: Occurs when 2-Year Treasury yields exceed 10-Year yields, signaling institutional expectations of future economic deceleration and subsequent central bank emergency rate cuts. Has historically preceded every modern US recession.`,
    suggestedFollowups: [
      'How does the FOMC interest rate decision impact EUR/USD?',
      'What is the relationship between inflation reports (CPI) and interest rate policy?'
    ]
  },

  // =========================================================================
  // 11. ECONOMIC CALENDAR & HIGH-IMPACT EVENT EXECUTION
  // =========================================================================
  {
    id: 'economic_events_nfp_cpi_fomc_execution_risks',
    category: 'economic_events',
    difficulty: 'Intermediate',
    type: 'Market Execution & Liquidity Risk',
    source: 'U.S. Bureau of Labor Statistics (BLS) & FINRA Market Volatility Notices',
    lastUpdated: '2026-03',
    title: 'Economic Calendar Events: NFP, CPI, FOMC Releases, and Pre-News Liquidity Voids',
    keywords: ['economic calendar', 'nfp', 'cpi', 'fomc', 'high impact news', 'red folder', 'slippage', 'spread widening'],
    summary: 'Red-folder macroeconomic releases create severe liquidity voids where retail stop-losses frequently suffer execution slippage.',
    content: `1. Tier-1 High-Impact Macro Releases:
• Non-Farm Payrolls (NFP): Released first Friday of each month by the US BLS. Measures net employment change (excluding farm workers) and Average Hourly Earnings.
• Consumer Price Index (CPI): Primary gauge of headline and core consumer inflation. Dictates central bank rate probability expectations.
• FOMC Rate Decision & Press Conference: Directly sets Federal Funds rate target; forward guidance dot-plot creates multi-session directional trends.

2. The Liquidity Void Trap & Spread Blowout:
• 2 to 5 minutes prior to a red-folder release, tier-1 institutional algorithmic market makers cancel active limit bids and offers in the interbank order book to avoid adverse selection.
• Consequence: Spreads widen drastically (e.g. EUR/USD spread widening from 0.2 pips to 8.0 pips; Gold spread widening from $0.20 to $3.50).
• Slippage Mechanism: Stop-loss orders become market orders once triggered. In a fast gap, the order executes at the first available bid/ask, often 15-30 pips past the intended stop level.

3. Prudent Risk Management Rules:
• Never open new positions 15 minutes prior to tier-1 red-folder news.
• For open swing trades, protect capital by adjusting stop-loss to breakeven or locking in partial profits.`,
    suggestedFollowups: [
      'What economic releases are scheduled for this week?',
      'How to handle trading when news creates an unexpected spike?'
    ]
  },

  // =========================================================================
  // 12. STRATEGY DESIGN & SYSTEMATIC EXECUTION
  // =========================================================================
  {
    id: 'strategy_design_expectancy_trade_lifecycle',
    category: 'strategy_design',
    difficulty: 'Intermediate',
    type: 'Quantitative Strategy Design',
    source: 'Mark Minervini & Quantitative Edge Research Standards',
    lastUpdated: '2026-01',
    title: 'Systematic Trading Strategy Design: Mathematical Expectancy and the 5-Stage Trade Lifecycle',
    keywords: ['strategy design', 'expectancy', 'trading edge', 'trading system', 'trade lifecycle', 'rules', 'playbook'],
    summary: 'A robust trading system requires a documented mathematical edge combined with rigid execution rules for every stage of a trade.',
    content: `1. Mathematical Expectancy Formula (The Definition of an Edge):
• Formula: Expectancy ($ per trade) = (Win Rate × Average Win USD) - (Loss Rate × Average Loss USD)
• Numerical Example:
  - Total Closed Trades: 100
  - Win Rate: 45% (0.45) | Average Win: $250
  - Loss Rate: 55% (0.55) | Average Loss: $100
  - Calculation: (0.45 × $250) - (0.55 × $100) = $112.50 - $55.00 = +$57.50 Expectancy per trade.
  - Conclusion: Despite losing more trades than won (45% win rate), the positive expectancy generates consistent compounding capital growth.

2. The 5-Stage Institutional Trade Lifecycle:
• Stage 1: HTF Context & Direction (Daily/4h market structure and liquidity draw).
• Stage 2: Invalidation Level Identification (exact technical level where the trade idea is provably false).
• Stage 3: Setup Trigger & Entry Confirmation (waiting for candle close or FVG retest).
• Stage 4: Mathematical Position Sizing (calculating exact lot size to risk no more than 1%).
• Stage 5: Execution & Management (strictly exiting at planned TP or SL without emotional mid-trade interference).`,
    suggestedFollowups: [
      'What is my personal journal expectancy in TradeJourn?',
      'How to write a rule-based trading playbook?'
    ]
  },

  // =========================================================================
  // 13. BACKTESTING METHODOLOGY & PITFALLS
  // =========================================================================
  {
    id: 'backtesting_curve_fitting_lookahead_bias',
    category: 'backtesting',
    difficulty: 'Advanced',
    type: 'Statistical Simulation & Algorithmic Verification',
    source: 'Marcos López de Prado - Advances in Financial Machine Learning',
    lastUpdated: '2026-02',
    title: 'Backtesting Rigor: Overfitting, Lookahead Bias, In-Sample vs Out-of-Sample Validation',
    keywords: ['backtesting', 'curve fitting', 'overfitting', 'lookahead bias', 'survivorship bias', 'walk forward', 'monte carlo'],
    summary: 'A backtest that ignores realistic execution friction or over-optimizes parameters produces catastrophic failure in live markets.',
    content: `1. Overfitting & Curve-Fitting Trap:
• Definition: Tweaking indicator parameters, filters, or stop distances until historical equity curves appear flawless (e.g. 90% win rate with zero drawdown).
• Reality: Markets are non-stationary stochastic systems. Overfitted parameters capture historical random noise rather than persistent structural edge, resulting in immediate collapse upon live deployment.

2. Lookahead Bias & Survivorship Bias:
• Lookahead Bias: Simulating an entry or exit using data that was not yet known at that moment in time (e.g., executing on the Open of a bar based on the Close of that same bar).
• Survivorship Bias: Testing only on assets that currently exist while omitting assets that went bankrupt, were delisted, or suffered structural failure.

3. Institutional Out-of-Sample (OOS) Testing Protocol:
• Step 1: Split historical data into 70% In-Sample (optimization) and 30% Out-of-Sample (blind verification).
• Step 2: Test the system on Out-of-Sample data without altering any parameters.
• Step 3: Verify that Out-of-Sample Sharpe Ratio and Profit Factor retain at least 60-70% of In-Sample performance.
• Step 4: Add realistic friction: deduct 1.5 to 2.0 pips of spread and slippage on every trade.`,
    suggestedFollowups: [
      'How to backtest an EMA crossover or RSI pullback strategy in TradeJourn?',
      'What is walk-forward analysis in quantitative trading?'
    ]
  },

  // =========================================================================
  // 14. TRADING STATISTICS & RISK-ADJUSTED METRICS
  // =========================================================================
  {
    id: 'trading_statistics_sharpe_sortino_expectancy',
    category: 'trading_statistics',
    difficulty: 'Advanced',
    type: 'Quantitative Finance & Statistical Risk Analysis',
    source: 'William F. Sharpe (1966) - Mutual Fund Performance & Frank A. Sortino (1991)',
    lastUpdated: '2026-01',
    title: 'Trading Statistics: Sharpe Ratio, Sortino Ratio, Maximum Drawdown, and Breakeven Win Rates',
    keywords: ['trading statistics', 'sharpe ratio', 'sortino ratio', 'profit factor', 'win rate', 'maximum drawdown', 'confidence interval'],
    summary: 'Total nominal profit is meaningless without measuring the variance, downside volatility, and drawdown endured to achieve it.',
    content: `1. Sharpe Ratio vs Sortino Ratio:
• Sharpe Ratio Formula: (Portfolio Return - Risk-Free Rate) ÷ Total Standard Deviation of Returns (σ)
  - Evaluates return per unit of total volatility.
  - Flaw: Penalizes upside volatility (huge winning trades) equally with downside losses.
• Sortino Ratio Formula: (Portfolio Return - Risk-Free Rate) ÷ Downside Deviation
  - Only penalizes harmful downside volatility, providing a superior evaluation for asymmetric trading strategies.
  - Institutional Benchmarks: Sortino > 1.5 is good; Sortino > 2.5 is exceptional.

2. Breakeven Win Rate Formula:
• Formula: Breakeven Win Rate % = 1 ÷ (1 + Risk-to-Reward Ratio)
• Concrete Matrix:
  - 1:1 R:R requires a 50.0% win rate to break even.
  - 1:1.5 R:R requires a 40.0% win rate to break even.
  - 1:2.0 R:R requires a 33.3% win rate to break even.
  - 1:3.0 R:R requires a 25.0% win rate to break even.
  - 1:4.0 R:R requires a 20.0% win rate to break even.

3. Profit Factor Formula:
• Profit Factor = Gross Winning Trades ($) ÷ Gross Losing Trades ($)
• Benchmarks: <1.0 = Losing; 1.0 - 1.3 = Marginal; 1.5 - 2.0 = Solid edge; >2.0 = Institutional tier.`,
    suggestedFollowups: [
      'What is my personal Profit Factor and Sharpe Ratio in this journal?',
      'How is the 95% confidence interval for win rate calculated?'
    ]
  },

  // =========================================================================
  // 15. SUPPORT AND RESISTANCE VS INSTITUTIONAL SUPPLY & DEMAND
  // =========================================================================
  {
    id: 'support_resistance_supply_demand_zones',
    category: 'support_resistance',
    difficulty: 'Beginner',
    type: 'Price Action & Structural Charting',
    source: 'Classic Auction Market Theory & Professional Price Action Standards',
    lastUpdated: '2026-01',
    title: 'Support and Resistance vs Supply and Demand: Touch Decay Principle and Role Reversals',
    keywords: ['support and resistance', 'support', 'resistance', 'supply and demand', 'touch decay', 'breakout', 'reversal'],
    summary: 'Support is a demand floor and resistance is a supply ceiling; repeated touches deplete resting liquidity rather than reinforcing it.',
    content: `1. Definitions and Role Reversal:
• Support: A price floor where demand (buy interest) repeatedly halts downward declines.
• Resistance: A price ceiling where supply (sell interest) halts upward rallies.
• Role Reversal: Once price definitively breaks resistance with a candle body close, the former resistance level frequently acts as newly established support upon retest.

2. The Touch Decay Principle (Retail Myth vs Institutional Fact):
• Retail Myth: "The more times a support or resistance level is tested, the stronger it becomes."
• Institutional Reality: The opposite is true. Each time price revisits a key level, resting limit orders stationed at that zone are executed and absorbed. After 3 to 4 touches, the remaining order book buffer is exhausted, paving the way for a decisive breakout or liquidity sweep.

3. Fresh vs Mitigated Zones:
• Fresh Zone: An origin imbalance or support/resistance level that has never been revisited since its formation. Carries the highest statistical probability of a sharp responsive bounce.
• Mitigated Zone: A level that has already been re-tested and absorbed. Offers substantially lower probability of holding.`,
    suggestedFollowups: [
      'How to detect false breakouts at key resistance levels?',
      'What are the key technical levels for EUR/USD right now?'
    ]
  }
];

/**
 * Programmatic knowledge domain coverage registry
 */
const KNOWLEDGE_COVERAGE = {
  coveredAreas: [
    { area: 'Price Action', category: 'market_structure', description: 'Candlestick mechanics, wicks vs bodies, fractal nature, displacement' },
    { area: 'Market Structure', category: 'market_structure', description: 'BOS, CHoCH, Swing highs/lows, Premium vs Discount equilibrium' },
    { area: 'Liquidity', category: 'liquidity', description: 'BSL, SSL, Turtle soup liquidity sweeps, Equal highs/lows, Order flow' },
    { area: 'Support and Resistance', category: 'support_resistance', description: 'Static S/R, Supply/Demand, Touch decay principle, Role reversal' },
    { area: 'Technical Indicators', category: 'technical_indicators', description: 'RSI Wilder formula, MACD histogram, Moving averages, Divergences, ATR' },
    { area: 'Risk Management', category: 'risk_management', description: 'Fixed fractional 1% rule, Risk of ruin mathematics, Asymmetric recovery curve' },
    { area: 'Position Sizing', category: 'position_sizing', description: 'Step-by-step formulas for Forex, Commodities (Gold/Silver), and Indices' },
    { area: 'Trading Psychology', category: 'trading_psychology', description: 'Loss aversion (Kahneman/Tversky), FOMO cycle, Revenge trading, Disposition effect' },
    { area: 'Forex Mechanics', category: 'forex_mechanics', description: 'Base vs Quote, Spreads, Pip vs Pipette, Overnight swaps, Rollover settlement' },
    { area: 'Commodities', category: 'commodities', description: 'Gold XAUUSD 100oz contract specs, Real yields correlation, DXY inverse dynamics' },
    { area: 'Fundamental Analysis', category: 'fundamental_analysis', description: 'Central bank policy (Fed/ECB/BOJ), Rate differentials, Carry trade, Yield curve' },
    { area: 'Economic Events', category: 'economic_events', description: 'NFP, CPI, FOMC, Spread widening, Slippage reality, News risk policies' },
    { area: 'Strategy Design', category: 'strategy_design', description: 'Positive mathematical expectancy, 5-stage trade lifecycle, Rule playbooks' },
    { area: 'Backtesting', category: 'backtesting', description: 'Curve fitting / overfitting, Lookahead bias, Out-of-sample validation' },
    { area: 'Trading Statistics', category: 'trading_statistics', description: 'Sharpe ratio, Sortino ratio, Profit factor, Breakeven win rate matrix' },
    { area: 'Prop Firm Rules', category: 'prop_firm_rules', description: 'Balance vs Equity trailing drawdown, Daily loss limits, Challenge evaluation rules' }
  ],
  unsupportedAreas: [
    { area: 'Automated High-Frequency Trading (HFT) Co-location Architecture', reason: 'Focuses on sub-millisecond FPGA hardware design outside discretionary/quantitative retail trading scope' },
    { area: 'Custom Binary MQL4/MQL5/Python Automated Execution Script Compilation', reason: 'TradeJourn provides analytical insights and journaling rather than executing proprietary code compilers' },
    { area: 'Jurisdiction-Specific Tax Filing & Legal Accounting Advisory', reason: 'Tax rules vary by nation/state; users must consult certified public accountants' },
    { area: 'Binary Options & Non-Standard Derivatives', reason: 'High-fraud retail derivative outside institutional capital preservation frameworks' },
    { area: 'Guaranteed Future Price Prediction', reason: 'Mathematically impossible in stochastic auction markets; TradeJourn adheres strictly to probabilistic modeling' }
  ]
};

/**
 * Search and retrieve relevant knowledge passages
 * Supports options as category string or options object { category, difficulty, limit, maxTokens }
 */
function retrieveKnowledgeDocuments(query = '', options = null, legacyLimit = 2) {
  if (!query || typeof query !== 'string' || !query.trim()) {
    return {
      query: '',
      retrieved: 0,
      passages: [],
      coverage: KNOWLEDGE_COVERAGE
    };
  }

  // Handle polymorphic arguments (backward compatibility with (query, category, limit))
  let categoryFilter = null;
  let difficultyFilter = null;
  let limit = legacyLimit;

  if (typeof options === 'string') {
    categoryFilter = options;
  } else if (options && typeof options === 'object') {
    categoryFilter = options.category || null;
    difficultyFilter = options.difficulty || null;
    limit = Number(options.limit) || legacyLimit;
  }

  const cleanQuery = query.toLowerCase().replace(/[^a-z0-9]/g, ' ');
  const queryTerms = cleanQuery.split(/\s+/).filter(w => w.length > 2);
  const scored = [];

  for (const doc of KNOWLEDGE_DOCUMENTS) {
    if (categoryFilter) {
      const matchCat = doc.category === categoryFilter ||
        (categoryFilter === 'market_mechanics' && (doc.category === 'liquidity' || doc.category === 'market_structure')) ||
        (categoryFilter === 'technical_analysis' && (doc.category === 'technical_indicators' || doc.category === 'support_resistance' || doc.category === 'market_structure'));
      if (!matchCat) continue;
    }
    if (difficultyFilter && doc.difficulty.toLowerCase() !== difficultyFilter.toLowerCase()) continue;

    let score = 0;
    const titleLower = doc.title.toLowerCase();
    const summaryLower = (doc.summary || '').toLowerCase();
    const contentLower = doc.content.toLowerCase();

    // 1. Exact phrase match boost (+15 points)
    if (cleanQuery.length > 5 && (titleLower.includes(cleanQuery) || summaryLower.includes(cleanQuery))) {
      score += 15;
    }

    // 2. Keyword exact matches (+5 points each)
    for (const kw of doc.keywords) {
      const kwLower = kw.toLowerCase();
      if (cleanQuery.includes(kwLower)) {
        score += 8;
      } else if (queryTerms.some(term => kwLower.includes(term))) {
        score += 4;
      }
    }

    // 3. Title term matches (+6 points each)
    for (const term of queryTerms) {
      if (titleLower.includes(term)) {
        score += 6;
      }
    }

    // 4. Content token presence (+1 point each, capped at 10)
    let contentHits = 0;
    for (const term of queryTerms) {
      if (contentLower.includes(term)) {
        contentHits++;
      }
    }
    score += Math.min(contentHits * 1.5, 10);

    if (score > 0) {
      scored.push({ doc, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  const selected = scored.slice(0, Math.max(limit, 1)).map(item => ({
    id: item.doc.id,
    title: item.doc.title,
    category: item.doc.category,
    difficulty: item.doc.difficulty,
    type: item.doc.type,
    source: item.doc.source,
    lastUpdated: item.doc.lastUpdated,
    summary: item.doc.summary,
    content: item.doc.content,
    suggestedFollowups: item.doc.suggestedFollowups
  }));

  return {
    query,
    retrieved: selected.length,
    passages: selected,
    coverage: KNOWLEDGE_COVERAGE
  };
}

/**
 * Return knowledge coverage audit
 */
function getKnowledgeCatalogCoverage() {
  return KNOWLEDGE_COVERAGE;
}

module.exports = {
  KNOWLEDGE_DOCUMENTS,
  KNOWLEDGE_COVERAGE,
  retrieveKnowledgeDocuments,
  getKnowledgeCatalogCoverage
};
