/**
 * TradeJourn AI Intent Classifier & Conversational Router
 * ========================================================
 * Differentiates casual greetings, acknowledgments, educational concepts,
 * personal journal stats, trading psychology, market analysis, and missing parameters.
 * Supports natural English, Hindi, and Hinglish.
 */

// 1. Common greeting tokens (exact match or phrase match)
const GREETING_PATTERNS = [
  /^(hi|hello|hey|heyy|heya|yo|sup|hlo|hii|hiii)(\s+(there|bro|bhai|coach|mate|friend|sir|team|tradejourn))?[!.]*$/i,
  /^(good\s+(morning|afternoon|evening|day))(\s+(there|bro|bhai|coach|sir|team|friend))?[!.]*$/i,
  /^(namaste|namaskar|pranam|ram\s*ram|radhe\s*radhe)(\s+(ji|bhai|sir))?([,\s]+(kaise\s+ho|kya\s+haal\s+hai|kaisa\s+hai|kaisa\s+chal\s+raha\s+hai))?[?!.]*$/i,
  /^(hi|hello|hey)[,\s]+(how\s+are\s+you|how's\s+it\s+going|how\s+r\s+u)[?!.]*$/i,
  /^(namaste|namaskar)[,\s]+(kaise\s+ho|kya\s+haal\s+hai)[?!.]*$/i,
  /^(kya\s+haal\s+hai|kaisa\s+hai|kaise\s+ho|sab\s+badhiya)(\s+(bhai|bro|sir|ji|mate|coach|friend|aap))?[?!.]*$/i,
  /^(how\s+are\s+you|how's\s+it\s+going|how\s+r\s+u|how\s+do\s+you\s+do)(\s+(doing\s+)?today)?[?!.]*$/i
];

// 2. Identity / capability patterns
const IDENTITY_PATTERNS = [
  /\b(who\s+are\s+you|what\s+can\s+you\s+do|introduce\s+yourself|tell\s+me\s+about\s+yourself|what\s+features\s+do\s+you\s+have|tum\s+kaun\s+ho|kya\s+kar\s+sakte\s+ho|aap\s+kaun\s+h(ai|o)|aap\s+kya\s+kar(te|te\s+ho|te\s+hain))\b/i,
  /^(help|commands|features)[?!.]*$/i
];

// 3. Gratitude patterns
const GRATITUDE_PATTERNS = [
  /^(thanks|thank\s+you|thx|ty|many\s+thanks|shukriya|dhanyawad|bahut\s+shukriya|bahut\s+dhanyawad)[!.]*$/i
];

// 4. Conversational acknowledgments & closings
const CONVERSATION_PATTERNS = [
  /^(ok|okay|theek\s+hai|theek\s+hai\s+bhai|samajh\s+gaya|samjh\s+gaya|got\s+it|understood|cool|nice|awesome|great|accha|achha|badhiya|shabash)([,\s]+(understood|got\s+it|thanks|bhai|ji|bro|ok|okay|cool|nice|talk\s+to\s+you\s+later|see\s+you))?[!.]*$/i,
  /^(bye|goodbye|see\s+you|alvida|good\s+night|gn|take\s+care|talk\s+(to\s+you\s+)?later)(\s+(bro|bhai|coach|mate|friend))?[!.]*$/i,
  /^cool[,\s]+(talk\s+(to\s+you\s+)?later|see\s+you|bye)[!.]*$/i
];

// 5. General trading education concepts (definition & mechanics queries without personal journal intent)
const CONCEPT_EDUCATION_MAP = [
  {
    regex: /\b(what\s+is|explain|define)?\s*win\s*rate\b|\bwin\s*rate\s+kya\s+(hota\s+)?hai\b|\bdefine\s+win\s*rate\b/i,
    concept: 'win_rate',
    en: "Win Rate is the percentage of your trades that close in profit out of your total closed trades.\n\n• Formula: Win Rate = (Winning Trades ÷ Total Trades) × 100\n• Example: 6 wins out of 10 trades = 60% Win Rate.\n• Pro Tip: High win rate is not strictly required for profitability if your Risk-to-Reward (R:R) is favorable (e.g. 40% win rate with 1:3 R:R is consistently profitable).\n\n💡 **Suggested Follow-ups:**\n• \"What is my personal win rate in this journal?\"\n• \"What is the difference between win rate and expectancy?\"",
    hi: "Win Rate ka matlab hai aapke total trades me se kitne percent trades profit me close hue.\n\n• Formula: Win Rate = (Winning Trades ÷ Total Trades) × 100\n• Udaharan: 10 me se 6 profitable trades = 60% Win Rate.\n• Pro Tip: Profit banane ke liye 80-90% win rate zaroori nahi hai—agar aapka Risk-to-Reward 1:2 ya 1:3 hai, toh 45% win rate par bhi bada edge banta hai.\n\n💡 **Suggested Follow-ups:**\n• \"Mera current win rate kitna hai?\"\n• \"Risk-to-reward ratio kya hota hai?\""
  },
  {
    regex: /\b(what\s+is|explain|define)?\s*(risk\s+to\s+reward|risk\s+reward|rr|r:r)\b|\brr\s+(ratio\s+)?kya\s+(hota\s+)?hai\b/i,
    concept: 'risk_reward',
    en: "Risk-to-Reward (R:R) measures how much money you risk on a trade compared to the potential profit target.\n\n• Formula: R:R = Potential Profit (Take-Profit Distance) ÷ Potential Loss (Stop-Loss Distance)\n• Example: Risking $50 stop-loss to make $150 take-profit = 1:3 R:R (+3R).\n• Key Rule: Maintain at least 1:1.5 to 1:2 R:R so a single loss never wipes out multiple winners.\n\n💡 **Suggested Follow-ups:**\n• \"How do I calculate position size for a 1:2 setup?\"\n• \"What is my average realized R in my journal?\"",
    hi: "Risk-to-Reward (R:R) ratio batata hai ki aap ek trade me kitna risk le rahe hain aur uske badle kitna profit target kar rahe hain.\n\n• Formula: R:R = Potential Profit (Target) ÷ Potential Loss (Stop-Loss)\n• Udaharan: Agar aap $50 risk karke $150 ka target set karte hain, toh R:R 1:3 (+3R) hai.\n• Golden Rule: Hamesha minimum 1:1.5 ya 1:2 R:R plan karein taaki ek loss aapke pichhle profits ko khatam na kare.\n\n💡 **Suggested Follow-ups:**\n• \"Mera journal me average R:R kaisa hai?\"\n• \"Position size kaise calculate karein?\""
  },
  {
    regex: /\b(what\s+(are|is)|explain|define)\s+(a\s+)?pips?\b|\bpips?\s+kya\s+(hota\s+)?hai\b|\bpips?\s+explained\b/i,
    concept: 'pips',
    en: "A Pip (Percentage in Point) is the standard unit measuring price movements in Forex.\n\n• Major FX Pairs: 1 pip = 0.0001 (4th decimal place). E.g., EUR/USD moves 1.0850 to 1.0870 = +20 pips.\n• JPY Pairs: 1 pip = 0.01 (2nd decimal place). E.g., USD/JPY moves 154.20 to 154.70 = +50 pips.\n• Gold (XAUUSD): $0.10 price move = 1 pip ($1.00 move = 10 pips).\n\n💡 **Suggested Follow-ups:**\n• \"How is pip value calculated for EURUSD and Gold?\"\n• \"Calculate lot size for a 20-pip stop loss.\"",
    hi: "Pip (Percentage in Point) Forex aur Commodities me price ke movement ko napne ki standard unit hai.\n\n• Major FX Pairs: 1 pip = 0.0001 (4th decimal). Jaise EUR/USD 1.0820 se 1.0840 gaya toh +20 pips move hua.\n• JPY Pairs: 1 pip = 0.01 (2nd decimal place).\n• Gold (XAUUSD): $0.10 ka move = 1 pip ($1.00 ka price change = 10 pips).\n\n💡 **Suggested Follow-ups:**\n• \"Gold me 1 standard lot par 1 pip ki value kya hoti hai?\"\n• \"Lot size formula kya hai?\""
  },
  {
    regex: /\b(what\s+is|explain|define)?\s*(liquidity\s+sweep|liquidity\s+grab)\b|\bliquidity\s+sweep\s+kya\s+(hota\s+)?hai\b/i,
    concept: 'liquidity_sweep',
    en: "A Liquidity Sweep occurs when price briefly pierces a swing high or swing low to trigger retail stop losses and breakout orders, then sharply rejects in the opposite direction.\n\n• Mechanism: Institutional participants require large counter-liquidity to fill sizable orders. Retail stop clusters provide that volume.\n• Confirmation: Look for a wick penetration beyond equal highs/lows with candle close back inside the range.\n\n💡 **Suggested Follow-ups:**\n• \"How to combine liquidity sweeps with Fair Value Gaps?\"\n• \"What is the difference between a liquidity sweep and a Break of Structure?\"",
    hi: "Liquidity Sweep tab hota hai jab price kisi swing high ya swing low ko cross karke retail traders ke stop-losses aur breakout orders trigger karta hai, aur turant reverse ho jata hai.\n\n• Kyun hota hai: Bade institutional traders ko bade orders execute karne ke liye liquidity (volume) chahiye hoti hai jo stop-loss clustering se milti hai.\n• Confirmation: Candle wick swing level ko cross kare lekin candle body wapas range ke andar close ho.\n\n💡 **Suggested Follow-ups:**\n• \"Liquidity sweep ke baad safe entry kaise lein?\"\n• \"Fair Value Gap (FVG) kya hota hai?\""
  },
  {
    regex: /\b(what\s+is|explain|define)?\s*(order\s+block|ob)\b|\border\s+block\s+kya\s+(hota\s+)?hai\b/i,
    concept: 'order_block',
    en: "An Order Block (OB) is the last opposing candle before an aggressive, market-shifting displacement move that breaks market structure.\n\n• Bullish OB: The last down candle before a violent surge that creates an imbalance (FVG) and breaks resistance.\n• Bearish OB: The last up candle before a violent drop breaking structural support.\n• Entry Strategy: Traders wait for price to retrace into the 50% equilibrium of the order block for high-R:R entries.\n\n💡 **Suggested Follow-ups:**\n• \"What makes a high-probability order block valid?\"\n• \"Explain Breaker Block vs Order Block.\"",
    hi: "Order Block (OB) wo aakhri opposing candle hoti hai jiske turant baad institutional displacement aati hai jo market structure ko break karti hai.\n\n• Bullish OB: Badi upward rally se pehle ki last down candle.\n• Bearish OB: Badi downward fall se pehle ki last up candle.\n• Entry Rule: Jab price wapas order block ke 50% zone me aati hai, tab confirmation ke sath entry li jaati hai.\n\n💡 **Suggested Follow-ups:**\n• \"Order block aur Support/Resistance me kya farak hai?\"\n• \"Break of Structure (BOS) kya hota hai?\""
  },
  {
    regex: /\b(what\s+is|explain|define)?\s*(fair\s+value\s+gap|fvg|imbalance)\b|\bfvg\s+kya\s+(hota\s+)?hai\b/i,
    concept: 'fair_value_gap',
    en: "A Fair Value Gap (FVG) is a 3-candle price imbalance created when violent one-sided momentum leaves price inefficiently delivered.\n\n• Detection: In a bullish FVG, the high of Candle 1 does not overlap with the low of Candle 3. The open space on Candle 2 is the FVG.\n• Market Behavior: Price frequently pulls back to rebalance this gap before resuming the prevailing trend.\n\n💡 **Suggested Follow-ups:**\n• \"How do you enter using an FVG during London or New York sessions?\"\n• \"What is the difference between FVG and Volume Imbalance?\"",
    hi: "Fair Value Gap (FVG) 3-candle price pattern hota hai jisme aggressive buying ya selling ki wajah se market imbalance create hota hai.\n\n• Kaise dekhein: Bullish FVG me Candle 1 ka high Candle 3 ke low se overlap nahi karta. Beech ki space FVG hoti hai.\n• Tendency: Market aksar is gap ko fill (rebalance) karne aati hai aur fir original trend me continue karti hai.\n\n💡 **Suggested Follow-ups:**\n• \"FVG ke andar entry lene ka sahi tareeqa kya hai?\"\n• \"BOS aur CHoCH me kya difference hai?\""
  },
  {
    regex: /\b(what\s+is|explain|define)?\s*(break\s+of\s+structure|bos)\b|\bbos\s+kya\s+(hota\s+)?hai\b/i,
    concept: 'bos',
    en: "Break of Structure (BOS) confirms the continuation of an established market trend.\n\n• Bullish BOS: Price makes a higher high by closing a candle body above the prior swing high.\n• Bearish BOS: Price makes a lower low by closing a candle body below the prior swing low.\n• Strict Rule: Always demand a candle body close to confirm BOS. A wick-only break is typically a liquidity sweep, not a true break.\n\n💡 **Suggested Follow-ups:**\n• \"What is the difference between BOS and CHoCH?\"\n• \"How do I avoid entering on fakeout BOS?\"",
    hi: "Break of Structure (BOS) trend continuation ko confirm karta hai.\n\n• Bullish BOS: Candle body pichhle swing high ke upar close ho.\n• Bearish BOS: Candle body pichhle swing low ke neeche close ho.\n• Zaroori Rule: Hamesha candle body close ka wait karein. Agar sirf wick cross kare, toh wo liquidity sweep ya fakeout hota hai.\n\n💡 **Suggested Follow-ups:**\n• \"BOS aur CHoCH (Change of Character) me kya difference hai?\"\n• \"SMC trading methodology kya hai?\""
  },
  {
    regex: /\b(what\s+is|explain|define)?\s*(choch|change\s+of\s+character)\b|\bchoch\s+kya\s+(hota\s+)?hai\b/i,
    concept: 'choch',
    en: "Change of Character (CHoCH) signals the initial shift in trend direction or the transition from bullish to bearish order flow (or vice-versa).\n\n• Bullish CHoCH: In a downtrend, price closes a candle body above the last lower high that created the recent low.\n• Bearish CHoCH: In an uptrend, price closes a candle body below the last higher low that created the recent high.\n• Practical Use: Often represents the very first warning sign that the previous trend is terminating.\n\n💡 **Suggested Follow-ups:**\n• \"How to take an entry right after a CHoCH?\"\n• \"What timeframe is best for CHoCH confirmation?\"",
    hi: "Change of Character (CHoCH) trend reversal ka pehla signal hota hai.\n\n• Bullish CHoCH: Downtrend me price jab pichhle Lower High ke upar candle body close kar deta hai.\n• Bearish CHoCH: Uptrend me price jab pichhle Higher Low ke neeche close ho jata hai.\n• Use: Ye pehla signal deta hai ki market ka direction badalne wala hai.\n\n💡 **Suggested Follow-ups:**\n• \"CHoCH ke baad entry lene ka safest rule kya hai?\"\n• \"Order block confirm kaise karein?\""
  },
  {
    regex: /\b(what\s+is|explain|define)?\s*(rsi|relative\s+strength\s+index)\b|\brsi\s+(indicator\s+)?kya\s+(hota\s+)?hai\b/i,
    concept: 'rsi',
    en: "Relative Strength Index (RSI) is a momentum oscillator measuring the speed and change of price moves on a 0 to 100 scale.\n\n• Traditional Levels: Above 70 indicates overbought conditions; below 30 indicates oversold conditions.\n• Institutional Usage: Look for RSI Divergence (price makes a higher high while RSI makes a lower high) as an early warning of momentum exhaustion.\n• Baseline: The 50 centerline indicates bull vs bear territory.\n\n💡 **Suggested Follow-ups:**\n• \"How to trade RSI divergence with market structure?\"\n• \"What is MACD and how does it compare to RSI?\"",
    hi: "RSI (Relative Strength Index) ek momentum indicator hai jo 0 se 100 ke scale par price speed aur momentum measure karta hai.\n\n• Levels: 70 ke upar Overbought maana jata hai aur 30 ke neeche Oversold.\n• Divergence: Agar price naya high banaye lekin RSI lower high banaye (bearish divergence), toh reversal ka strong signal banta hai.\n• Centerline: 50 ke upar bullish zone, 50 ke neeche bearish zone.\n\n💡 **Suggested Follow-ups:**\n• \"RSI Divergence ko chart par kaise spot karein?\"\n• \"MACD indicator kya hota hai?\""
  },
  {
    regex: /\b(what\s+is|explain|define)?\s*(macd|moving\s+average\s+convergence\s+divergence)\b|\bmacd\s+(indicator\s+)?kya\s+(hota\s+)?hai\b/i,
    concept: 'macd',
    en: "MACD (Moving Average Convergence Divergence) is a trend-following momentum indicator displaying the relationship between two moving averages of price.\n\n• Components: MACD Line (12 EMA minus 26 EMA), Signal Line (9 EMA of MACD Line), and the Histogram.\n• Signals: Bullish cross occurs when MACD line crosses above Signal line; Bearish cross occurs when it crosses below.\n• Pro Tip: Histogram expansion shows accelerating momentum; contraction warns of impending slowdown.\n\n💡 **Suggested Follow-ups:**\n• \"How to combine MACD with support and resistance levels?\"\n• \"What is the best EMA combination for intraday trading?\"",
    hi: "MACD (Moving Average Convergence Divergence) ek trend-following momentum indicator hai jo moving averages ke difference ko track karta hai.\n\n• Components: MACD Line (12 EMA - 26 EMA), Signal Line (9 EMA), aur Histogram.\n• Signals: Jab MACD line Signal line ke upar cross karti hai toh Bullish signal, neeche cross karti hai toh Bearish signal.\n• Tip: Histogram ka shrink hona batata hai ki current move ka momentum weak ho raha hai.\n\n💡 **Suggested Follow-ups:**\n• \"EMA aur SMA me kya antar hai?\"\n• \"Trading me moving averages kaise use karein?\""
  },
  {
    regex: /\b(how\s+to\s+calculate\s+position\s+size|what\s+is\s+position\s+sizing|position\s+sizing\s+formula|lot\s+size\s+kaise\s+calculate)\b/i,
    concept: 'position_sizing',
    en: "Position Sizing Formula:\nLot Size = (Account Balance × Risk %) ÷ (Stop Loss in Pips × Pip Value)\n\n• Example:\n- Account: $10,000\n- Risk: 1% ($100 risk)\n- Stop-loss: 20 pips on EUR/USD ($10 per standard lot per pip)\n- Calculation: $100 ÷ (20 × $10) = 0.50 Lots.\n\n• Golden Rule: Never adjust your stop-loss distance to fit your desired lot size. Fix your stop loss at technical invalidation first, then calculate lot size to risk no more than 1% to 2%.\n\n💡 **Suggested Follow-ups:**\n• \"Calculate lot size for $10,000 balance with 20 pips stop loss on EURUSD\"\n• \"What is the 1% risk rule?\"",
    hi: "Position Sizing Formula:\nLot Size = (Account Balance × Risk %) ÷ (Stop Loss Pips × Pip Value)\n\n• Udaharan:\n- Account: $10,000\n- Risk: 1% ($100 risk)\n- Stop-loss: 20 pips on EUR/USD ($10 per standard lot per pip)\n- Calculation: $100 ÷ (20 × $10) = 0.50 Lots.\n\n• Golden Rule: Apne stop-loss ko desired lot size ke hisaab se mat badlein. Technical invalidation par stop-loss fix karein aur lot size calculate karein.\n\n💡 **Suggested Follow-ups:**\n• \"EURUSD par 20 pips SL ke liye lot size calculate karein\"\n• \"1% risk rule kya hota hai?\""
  },
  {
    regex: /\b(what\s+is|explain|define)\s+(a\s+)?(ema|sma|moving\s+average|exponential\s+moving\s+average)\b|\b(ema|moving\s+average)\s+kya\s+(hota\s+)?hai\b/i,
    concept: 'moving_averages',
    en: "A Moving Average smooths price data to identify trend direction without market noise.\n\n• EMA (Exponential): Assigns greater weight to the most recent price data, reacting faster to reversals (e.g. 20 EMA, 50 EMA).\n• SMA (Simple): Calculates the arithmetic mean across the entire lookback window (e.g. 200 SMA for institutional macro trend).\n• Key Rule: Trade in the direction of the slope; do not buy when price is trapped below descending EMAs.\n\n💡 **Suggested Follow-ups:**\n• \"What are the best moving averages for swing vs intraday trading?\"\n• \"How to backtest an EMA crossover strategy?\"",
    hi: "Moving Average price noise ko filter karke clear trend direction dikhata hai.\n\n• EMA (Exponential): Recent prices ko zyada importance deta hai, isliye jaldi react karta hai (jaise 20 EMA, 50 EMA).\n• SMA (Simple): Puraani aur nayi prices ko equal weight deta hai (jaise 200 SMA macro trend ke liye).\n• Golden Rule: Slope ke direction me trade karein—agar 50 EMA neeche jhuka hua hai toh aggressive buys avoid karein.\n\n💡 **Suggested Follow-ups:**\n• \"Golden Cross aur Death Cross kya hote hain?\"\n• \"Support aur resistance kaise draw karein?\""
  },
  {
    regex: /\b(what\s+is|explain|define)?\s*(support\s+and\s+resistance|support\s+resistance)\b|\bsupport\s+resistance\s+kya\s+(hota\s+)?hai\b/i,
    concept: 'support_resistance',
    en: "Support and Resistance are key price levels where buying or selling pressure repeatedly pauses or reverses market moves.\n\n• Support: A price floor where demand exceeds supply, causing price to bounce upwards.\n• Resistance: A price ceiling where supply exceeds demand, causing price to halt or drop.\n• Role Reversal: Once a strong resistance level is broken, it frequently turns into future support.\n\n💡 **Suggested Follow-ups:**\n• \"How do institutional supply & demand zones differ from retail support & resistance?\"\n• \"How to detect false breakouts at key resistance?\"",
    hi: "Support aur Resistance wo key levels hote hain jahan price aane par buyers ya sellers active ho jaate hain.\n\n• Support (Floor): Aisa level jahan demand zyada hoti hai aur price neeche girne se ruk kar upar bounce karti hai.\n• Resistance (Ceiling): Aisa level jahan supply zyada hoti hai aur price upar badhne se ruk kar drop karti hai.\n• Role Reversal: Jab strong resistance break hota hai, toh wahi level baad me support ban jata hai.\n\n💡 **Suggested Follow-ups:**\n• \"Support aur resistance par fakeout kaise pehchanein?\"\n• \"Supply and demand zones kaise draw karein?\""
  },
  {
    regex: /\b(what\s+is|explain|define)?\s*(smart\s+money\s+concepts|smc|ict\s+trading)\b|\bsmc\s+(trading\s+)?kya\s+(hota\s+)?hai\b/i,
    concept: 'smc',
    en: "Smart Money Concepts (SMC) is an institutional price action framework focused on how major market makers, banks, and institutions engineer liquidity.\n\n• Core Pillars: Liquidity Sweeps, Order Blocks (OB), Fair Value Gaps (FVG), Break of Structure (BOS), and Premium/Discount pricing.\n• Philosophy: Markets exist to deliver liquidity efficiently. Retail stop-loss clusters are engineered targets rather than accidental levels.\n\n💡 **Suggested Follow-ups:**\n• \"What are the three most important SMC entry models?\"\n• \"What are ICT Killzones?\"",
    hi: "Smart Money Concepts (SMC) institutional price action trading ka tareeqa hai jisme institutional players (banks, market makers) ke footprint ko track kiya jata hai.\n\n• Main Elements: Liquidity Sweeps, Order Blocks, Fair Value Gaps (FVG), aur Market Structure (BOS & CHoCH).\n• Philosophy: Market retail traders ke stop-losses lene ke baad hi apna asli move start karti hai.\n\n💡 **Suggested Follow-ups:**\n• \"SMC me ICT Killzones kya hote hain?\"\n• \"Liquidity grab ke baad entry kaise banayein?\""
  },
  {
    regex: /\b(what\s+are|explain|define)?\s*(ict\s+)?killzones?\b|\bkillzones?\s+kya\s+(hote\s+)?hai\b/i,
    concept: 'killzones',
    en: "ICT Killzones are specific high-probability daily trading windows with heavy institutional trading volume and volatility.\n\n• Asian Killzone: 20:00 – 00:00 EST (sets the initial range / baseline).\n• London Open Killzone: 02:00 – 05:00 EST (often creates the High or Low of the day through Judah swings).\n• New York Open Killzone: 07:00 – 10:00 EST (major macro releases, trend continuation or London reversal).\n• London Close Killzone: 10:00 – 12:00 EST (profit-taking and daily retracement).\n\n💡 **Suggested Follow-ups:**\n• \"How to trade the London Open Judah swing?\"\n• \"What is the ICT Silver Bullet setup?\"",
    hi: "ICT Killzones wo specific time windows hote hain jinme sabse zyada institutional volume aur volatility dekhne ko milti hai.\n\n• Asian Session: 20:00 – 00:00 EST (Consolidation range set karta hai).\n• London Open: 02:00 – 05:00 EST (Day ka High ya Low create karta hai fakeout move ke sath).\n• New York Open: 07:00 – 10:00 EST (High impact news aur institutional continuation).\n• London Close: 10:00 – 12:00 EST (Retracement aur profit-taking).\n\n💡 **Suggested Follow-ups:**\n• \"New York session me konsi pairs best hain?\"\n• \"ICT Silver Bullet strategy kya hai?\""
  },
  {
    regex: /\b(what\s+is|explain|define)?\s*(silver\s+bullet|ict\s+silver\s+bullet)\b|\bsilver\s+bullet\s+kya\s+(hota\s+)?hai\b/i,
    concept: 'silver_bullet',
    en: "The ICT Silver Bullet is a time-specific setup that occurs during three 1-hour daily windows:\n\n• Windows (EST): 03:00–04:00 AM (London), 10:00–11:00 AM (NY AM), and 02:00–03:00 PM (NY PM).\n• Setup Rules: 1. Liquidity pool swept. 2. Market structure shifts with displacement. 3. Enter on the newly formed Fair Value Gap (FVG).\n• Target: Minimum 10 to 15 pips / points with 1:2 R:R.\n\n💡 **Suggested Follow-ups:**\n• \"Can Silver Bullet be traded on Gold or Nasdaq?\"\n• \"How to identify the displacement candle accurately?\"",
    hi: "ICT Silver Bullet ek high-probability mechanical setup hai jo din ke 3 specific 1-hour windows me banta hai:\n\n• Time Windows (EST): 03:00–04:00 AM (London), 10:00–11:00 AM (NY AM), 02:00–03:00 PM (NY PM).\n• Rules: 1. Pichhla liquidity high/low sweep ho. 2. Structure shift ho displacement ke sath. 3. FVG ke retracement par entry.\n• Target: 10 se 15 pips ka quick target with 1:2 R:R.\n\n💡 **Suggested Follow-ups:**\n• \"Silver Bullet setup Gold par kaise kaam karta hai?\"\n• \"Displacement candle ki pehchan kya hai?\""
  },
  {
    regex: /\b(what\s+is|explain|define)?\s*(trailing\s+stop|trailing\s+sl)\b|\btrailing\s+stop\s+loss\s+kya\s+(hota\s+)?hai\b/i,
    concept: 'trailing_stop',
    en: "A Trailing Stop-Loss is a dynamic order that automatically adjusts in your trade's favor as price moves deeper into profit.\n\n• Mechanics: Stays a fixed pip/point distance behind current price. If price moves in your direction, the stop ratchets up; if price reverses, the stop stays fixed.\n• Benefit: Locks in guaranteed profit on winning trades while giving the trade breathing room to capture large runners.\n\n💡 **Suggested Follow-ups:**\n• \"Should I trail my stop loss to structural swing points or fixed pips?\"\n• \"When is the ideal time to move a stop loss to breakeven?\"",
    hi: "Trailing Stop-Loss ek aisa dynamic order hota hai jo jaise-jaise aapka trade profit me aage badhta hai, stop-loss ko bhi profit me shift karta rehta hai.\n\n• Kaise kaam karta hai: Price se ek fixed distance (pips) maintain karta hai. Price favorable move kare toh SL upar aayega, lekin reverse ho toh SL apni jagah lock rahega.\n• Faayda: Trade ko risk-free banata hai aur runners ko ride karte hue profits protect karta hai.\n\n💡 **Suggested Follow-ups:**\n• \"Break-even par SL kab move karna chahiye?\"\n• \"Market structure ke hisaab se trail kaise karein?\""
  },
  {
    regex: /\b(what\s+is|define)\s+(a\s+)?(drawdown|max\s+drawdown)\b|\bdrawdown\s+kya\s+(hota\s+)?hai\b/i,
    concept: 'drawdown',
    en: "Drawdown measures the percentage decline in account equity or balance from its historical peak to its lowest trough.\n\n• Formula: Drawdown % = ((Peak Equity - Trough Equity) ÷ Peak Equity) × 100\n• Max Drawdown: The largest cumulative percentage loss experienced before reaching a new high-water mark.\n• Prop Firm Note: Trailing drawdown trails your peak equity in real-time and remains the #1 failure reason for retail traders.\n\n💡 **Suggested Follow-ups:**\n• \"What is my maximum drawdown in this journal?\"\n• \"How to manage risk during a 5-trade drawdown streak?\"",
    hi: "Drawdown ka matlab hai aapke account ke peak (highest equity) se lowest point tak hone wala total percentage drop.\n\n• Formula: Drawdown % = ((Peak Balance - Lowest Balance) ÷ Peak Balance) × 100\n• Max Drawdown: Aapke ledger ka sabse bada cumulative loss phase.\n• Prop Firm Alert: Trailing drawdown live equity ke high ke sath upar trail hota hai, isliye ise protect karna top priority honi chahiye.\n\n💡 **Suggested Follow-ups:**\n• \"Mera journal me current drawdown buffer kya hai?\"\n• \"Losing streak me tilt hone se kaise bachein?\""
  },
  {
    regex: /\b(what\s+is|explain|define)?\s*(slippage|spread)\b|\bslippage\s+kya\s+(hota\s+)?hai\b/i,
    concept: 'slippage',
    en: "Slippage is the difference between the expected execution price of an order and the actual price at which it gets filled by the broker.\n\n• Causes: Rapid market volatility (e.g. CPI/NFP news releases) or illiquid market conditions where orders cannot be matched at the requested price.\n• Spread: The difference between the Bid and Ask prices charged by your broker on entry and exit.\n\n💡 **Suggested Follow-ups:**\n• \"How do high-impact economic news events affect slippage?\"\n• \"What are the best trading hours with lowest spread?\"",
    hi: "Slippage ka matlab hai aapke order place karne ke time ki price aur broker dwara actual execute hui price ke beech ka difference.\n\n• Kab hota hai: Fast news events (CPI, NFP, FOMC) ya low liquidity sessions me jab price instant jump kar jaati hai.\n• Spread: Broker ki buying (Ask) aur selling (Bid) price ke beech ka gap.\n\n💡 **Suggested Follow-ups:**\n• \"News release ke time trading kyu avoid karni chahiye?\"\n• \"Economic calendar kaise check karein?\""
  },
  {
    regex: /\b(what\s+is|explain|define)?\s*(leverage|margin)\b|\bleverage\s+kya\s+(hota\s+)?hai\b/i,
    concept: 'leverage',
    en: "Leverage allows a trader to control a large market position using a comparatively small amount of their own capital (margin).\n\n• Ratio: 1:100 leverage means $1,000 margin allows you to control a $100,000 position size.\n• Double-Edged Sword: Leverage magnifies both percentage gains and losses equally. Excessive leverage is the primary cause of blown trading accounts.\n\n💡 **Suggested Follow-ups:**\n• \"How does position sizing protect against high leverage risk?\"\n• \"What is the ideal leverage for prop firm challenges?\"",
    hi: "Leverage broker dwara di jaane wali borrowing power hai, jisse aap kam capital (margin) se bada trade position control kar sakte hain.\n\n• Ratio: 1:100 leverage ka matlab hai $1,000 capital se aap $100,000 ki trading volume control kar sakte hain.\n• Warning: Leverage dono taraf kaam karta hai—profit bhi bada hoga aur loss bhi utna hi tezi se hoga. Over-leverage account blow karne ka sabse bada reason hai.\n\n💡 **Suggested Follow-ups:**\n• \"Safe position size formula kya hai?\"\n• \"Daily loss limit kaise set karein?\""
  },
  {
    regex: /\b(what\s+is|explain|define)\s*(a\s+)?(fomo|fear\s+of\s+missing\s+out)\b|\bfomo\s+kya\s+(hota\s+|hoti\s+)?hai\b/i,
    concept: 'fomo',
    en: "FOMO (Fear Of Missing Out) is the emotional urge to enter an in-progress trade without a valid setup, driven by anxiety that others are profiting while you are left behind.\n\n• Symptom: Chasing a massive green or red candle right into key resistance or support.\n• Antidote: Remember that the market provides dozens of new setups every single week. If you missed the origin move, let it go; wait for the pullback or the next day.\n\n💡 **Suggested Follow-ups:**\n• \"Audit my journal for FOMO mistakes.\"\n• \"What process rule prevents chasing fast moves?\"",
    hi: "FOMO (Fear Of Missing Out) ek psychological state hai jisme trader ko lagta hai ki market bhag rahi hai aur wo profit miss kar dega, isliye wo bina setup ke beech me jump kar deta hai.\n\n• Asar: Badi candle ke high par buy karna ya low par sell karna, jahan se price reverse ho jati hai.\n• Solution: Market hamesha naye setups deti hai. Agar entry miss ho gayi, toh chase mat karein; pullback ya agle setup ka intezar karein.\n\n💡 **Suggested Follow-ups:**\n• \"Mera journal check karke batayein FOMO se kitna loss hua?\"\n• \"Trading me discipline aur patience kaise badhayein?\""
  },
  {
    regex: /\b(what\s+is|explain|define)\s*(a\s+)?(revenge\s+trading)\b|\brevenge\s+trading\s+kya\s+(hoti\s+|hota\s+)?hai\b/i,
    concept: 'revenge_trading',
    en: "Revenge Trading is the destructive urge to instantly jump into oversized, unplanned trades immediately after suffering a loss, attempting to win the money back right away.\n\n• Why it fails: You are trading from anger and bruised ego rather than technical probability, leading to compounding catastrophic drawdowns.\n• Rule of Thumb: Enforce a mandatory 30-minute cooling off period after any loss, or stop for the day after 2 consecutive losses.\n\n💡 **Suggested Follow-ups:**\n• \"Audit my journal for revenge trading patterns.\"\n• \"What is my win rate following a losing trade?\"",
    hi: "Revenge Trading ka matlab hai loss hone ke turant baad gusse me aakar bina rule ke bada trade lena taaki khoya hua paisa jaldi wapas aa jaye.\n\n• Danger: Is state me trader analysis nahi balki emotions se trade karta hai, jisse 1 loss 5 bade losses me badal jata hai.\n• Safe Rule: Har loss ke baad 30 minutes screen se dur rahein, aur din me 2 losses ke baad system shut down kar dein.\n\n💡 **Suggested Follow-ups:**\n• \"Mera loss streak audit dikhayein.\"\n• \"Mera psychological tilt risk level kya hai?\""
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

  // 1. Detect language flavour (English vs Hindi/Hinglish)
  const isHindi = /\b(kya|kaise|kaisa|mera|meri|mere|mujhe|bhai|karo|batao|karta|hai|hote|hoti|kyun|kyu|nahi|shukriya|dhanyawad|sona|chandi|theek|samajh|accha|achha|badhiya|namaste|namaskar|pranam|ram|radhe|ji|bataiye|dikhaye|kariye|dekh|dekho|sikhao|rokein|dar|gussa|hota)\b/i.test(lower);
  const language = isHindi ? 'hinglish' : 'english';

  // 2. Check Greetings
  for (const pattern of GREETING_PATTERNS) {
    if (pattern.test(lower)) {
      const greetingEnglish = "Hi! 👋\nWelcome back to TradeJourn AI Coach!\n\nWhat would you like to work on today? You can ask me to audit your journal execution, explain price action concepts, calculate risk, or analyze live market structure.\n\n💡 **Quick Actions:**\n• *\"How does TradeJourn track my execution?\"*\n• *\"Explain liquidity sweeps and order blocks\"*\n• *\"Analyse Gold on 1h chart\"*";
      const greetingHindi = "Namaste! 👋\nTradeJourn AI Coach mein aapka swagat hai!\n\nAaj aap kis cheez par focus karna chahte hain? Aap mujhse journal audit, trading concepts, risk management, ya market levels ke baare mein poochh sakte hain.\n\n💡 **Quick Actions:**\n• *\"TradeJourn mere trades kaise track karta hai?\"*\n• *\"Liquidity sweeps aur order blocks explain karo\"*\n• *\"Analyse Gold using technicals\"*";
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
      const idEnglish = "I am your TradeJourn AI Trading Copilot—an institutional trading mentor and quantitative analyst built into your journal. Here is how I assist you:\n\n1. 📊 Journal Analytics: Audit your actual win rate, expectancy, session edge, and costly mistakes.\n2. 🔍 Trade Reviews: Audit individual trades against your playbook rules and execution discipline.\n3. 🧠 Trading Psychology: Analyze tilt patterns, revenge trading triggers, and drawdown habits.\n4. 📚 Trading Education: Explain price action, liquidity sweeps, SMC, order blocks, and risk math.\n5. 🌐 Market Analysis: Provide structured technical outlooks on Gold, Forex pairs, and Indices.\n\nAsk me anything to get started!";
      const idHindi = "Main aapka TradeJourn AI Trading Copilot hoon—ek institutional trading mentor jo aapke journal se direct connected hai. Main aapki inme madad karta hoon:\n\n1. 📊 Journal Analytics: Aapka real win rate, profit factor, aur session edge track karna.\n2. 🔍 Trade Review: Har trade ko aapke playbook rules aur discipline ke hisaab se audit karna.\n3. 🧠 Psychology Audit: Revenge trading, FOMO, aur emotional tilt ko detect karna.\n4. 📚 Trading Education: Price action, liquidity sweeps, SMC, aur risk calculation samjhana.\n5. 🌐 Market Analysis: Gold, Forex, aur Crypto par key technical levels evaluate karna.\n\nAap koi bhi trading question poochh sakte hain!";
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
          ? "Aapka bahut swagat hai! Apne trading rules par strictly disciplined rahiye. Koi aur sawaal ho toh zaroor batayein.\n\n💡 **Suggested Follow-ups:**\n• \"Mera next trade session plan kya hona chahiye?\"\n• \"Analyse Gold on 1h chart\""
          : "You're very welcome! Protect your capital, wait for your A+ setups, and let me know whenever you want to review another trade or concept.\n\n💡 **Suggested Follow-ups:**\n• \"What should my pre-session checklist include?\"\n• \"Analyse EURUSD on 1h chart\""
      };
    }
  }

  // 5. Check Conversational Acknowledgments & Closings (e.g., "ok", "got it", "theek hai")
  for (const pattern of CONVERSATION_PATTERNS) {
    if (pattern.test(lower)) {
      return {
        intent: 'GENERAL_CONVERSATION',
        language,
        needsJournal: false,
        needsMarket: false,
        fastAnswer: isHindi
          ? "Theek hai bhai! Jab bhi ready ho bataiye—chahe trade audit karna ho, win rate dekhna ho, ya market levels analyse karne hon.\n\n💡 **Suggestions:**\n• \"Mera current win rate kya hai?\"\n• \"Analyse Gold using technicals\""
          : "Understood! Whenever you're ready, let me know what you'd like to work on next—trade audits, strategy rules, or live market structure.\n\n💡 **Suggestions:**\n• \"What is my win rate and expectancy?\"\n• \"Analyse EURUSD on 1h chart\""
      };
    }
  }

  // 6. Check Standalone Concept Education (e.g. "What is win rate?" vs "What is my win rate?")
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
          fastAnswer: isHindi ? item.hi : item.en
        };
      }
    }
  }

  // 7. Check Specific Market Request & Symbol Detection
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

  // 8. Check Psychology Request
  const isPsychologyQuery = /\b(revenge|fomo|overtrade|overtrading|fear|greed|anxious|anxiety|emotions?|discipline|rules|gussa|dar|loss\s+streak|tilt)\b/i.test(lower);

  // 9. Check Specific Trade Review Request
  const isTradeReview = /\b(review\s+(my\s+)?(last\s+)?trade|was\s+my\s+(last\s+)?trade\s+according\s+to\s+(my\s+)?rules|audit\s+(my\s+)?(last\s+)?trade|meri\s+last\s+trade\s+check\s+karo|did\s+i\s+follow\s+(my\s+)?(entry\s+|risk\s+|playbook\s+)?rules|meri\s+aakhri\s+trade|last\s+trade\s+an\s+early\s+exit|audit\s+my\s+trade\s+execution)\b/i.test(lower);

  // 10. Check Comparison Request
  const isComparisonQuery = /\b(compare|comparison|versus|\bvs\b)\b/i.test(lower) && (isPersonalQuery || /\b(london|new\s*york|session|month|week)\b/i.test(lower));

  // 11. Check Prop Firm Challenge Request
  const isPropFirmQuery = /\b(prop\s*firm|challenge|daily\s+loss(\s+limit)?|drawdown\s+buffer|profit\s+target)\b/i.test(lower);

  // 12. Check Playbook Request
  const isPlaybookQuery = /\b(my\s+rules|my\s+playbook|trading\s+plan|entry\s+rules|risk\s+rules|exit\s+rules|mere\s+rules)\b/i.test(lower);

  // 13. Check Backtest Request
  const isBacktestQuery = /\b(backtest|backtesting|test\s+strategy|test\s+ema|test\s+rsi)\b/i.test(lower);

  // 14. Check Economic Calendar & Macro News
  const isEconomicCalendar = /\b(economic\s+calendar|high\s+impact\s+news|macro\s+events?|\bnfp\b|\bcpi\b|\bfomc\b|ecb\s+rate|upcoming\s+news|economic\s+events|news\s+calendar)\b/i.test(lower);

  // 15. Check Position Sizing Calculator & Missing Information Detection
  const isPositionSizing = /\b(position\s*size|lot\s*size|calculate\s+lots?|how\s+many\s+lots|risk\s+calculator|lot\s+calculator|kitne\s+lot)\b/i.test(lower);
  if (isPositionSizing) {
    const hasBalance = /\$?\s*(\d[\d,]*(\.\d+)?)\s*(balance|account|equity|k\b)/i.test(lower) || /\b(balance|account|equity)\s*(is|hai|=)?\s*\$?\s*(\d+)/i.test(lower);
    const hasStopLoss = /(\d+(\.\d+)?)\s*(pip|pips|sl|stop|point|points)/i.test(lower) || /\b(sl|stop\s*loss)\s*(is|hai|=)?\s*(\d+)/i.test(lower);

    // If critical parameters are missing, require clarification rather than assuming $10,000 / 20 pips
    if (!hasBalance && !hasStopLoss) {
      const clarificationEn = "To calculate your exact recommended lot size, please provide:\n1. **Account Balance** (e.g. $10,000)\n2. **Stop-Loss Distance** (e.g. 20 pips)\n3. **Risk Percentage** per trade (e.g. 1% or 2%)\n4. **Instrument** (e.g. EURUSD or Gold)\n\n• **Formula:** Lot Size = (Balance × Risk %) ÷ (Stop Loss in Pips × Pip Value)\n• **Example:** $10,000 account, 1% risk ($100), 20 pips SL on EURUSD ($10/pip) = **0.50 Lots**.\n\n💡 **Suggested Next Step:**\n• *Reply with: \"$10,000 balance, 20 pip SL, 1% risk on EURUSD\"*";
      const clarificationHi = "Exact lot size calculate karne ke liye mujhe ye details bataiye:\n1. **Account Balance** (jaise $10,000)\n2. **Stop-Loss Distance** pips me (jaise 20 pips)\n3. **Risk Percentage** (jaise 1% ya 2%)\n4. **Instrument** (jaise EURUSD ya Gold)\n\n• **Formula:** Lot Size = (Balance × Risk %) ÷ (Stop Loss Pips × Pip Value)\n• **Udaharan:** $10,000 balance par 1% risk ($100) aur 20 pips SL ke sath EURUSD me **0.50 Lots** banta hai.\n\n💡 **Suggested Next Step:**\n• *Aise reply karein: \"$5,000 balance, 15 pips SL, 1% risk Gold par\"*";

      return {
        intent: 'CLARIFICATION_NEEDED',
        language,
        needsJournal: false,
        needsMarket: false,
        clarificationNeeded: true,
        fastAnswer: isHindi ? clarificationHi : clarificationEn
      };
    }
  }

  // 16. Check Statistical Distribution & Confidence Intervals
  const isStatisticalAnalysis = /\b(statistical\s+distribution|confidence\s+interval|mean\s+vs\s+median|outlier\s+analysis|skewness|trade\s+distribution)\b/i.test(lower);

  // 17. Check Knowledge Retrieval / Doctrine
  const isKnowledgeRetrieval = /\b(prop\s+firm\s+rules|trailing\s+drawdown\s+rule|ict\s+order\s+block\s+rules|1%\s+risk\s+rule|drawdown\s+semantics|knowledge\s+doc)\b/i.test(lower);

  // 18. Check Macro Analysis
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
  else if (isPsychologyQuery) finalIntent = 'TRADING_PSYCHOLOGY';
  else if (isPersonalQuery) finalIntent = 'JOURNAL_QUERY';
  else if (isMarketQuery) finalIntent = 'MARKET_QUERY';

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
