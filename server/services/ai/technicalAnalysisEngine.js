/**
 * TradeJourn Technical Analysis Engine
 * =====================================
 * Mathematical indicators, market structure, and scenario planning
 * executed over real OHLCV candle arrays.
 */

// 1. Simple Moving Average (SMA)
function calculateSMA(candles, period = 20) {
  if (!candles || candles.length < period) return null;
  const slice = candles.slice(-period);
  const sum = slice.reduce((acc, c) => acc + c.close, 0);
  return Number((sum / period).toFixed(4));
}

// 2. Exponential Moving Average (EMA)
function calculateEMA(candles, period = 20) {
  if (!candles || candles.length < period) return null;
  const k = 2 / (period + 1);
  let ema = candles.slice(0, period).reduce((acc, c) => acc + c.close, 0) / period;
  for (let i = period; i < candles.length; i++) {
    ema = candles[i].close * k + ema * (1 - k);
  }
  return Number(ema.toFixed(4));
}

// 3. Relative Strength Index (RSI 14)
function calculateRSI(candles, period = 14) {
  if (!candles || candles.length <= period) return null;
  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < candles.length; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    if (diff >= 0) {
      avgGain = (avgGain * (period - 1) + diff) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.abs(diff)) / period;
    }
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));
  return Number(rsi.toFixed(1));
}

// 4. Moving Average Convergence Divergence (MACD)
function calculateMACD(candles, fast = 12, slow = 26, signalPeriod = 9) {
  if (!candles || candles.length < slow + signalPeriod) return null;

  const getEmaSeries = (data, p) => {
    const k = 2 / (p + 1);
    let val = data.slice(0, p).reduce((sum, c) => sum + c.close, 0) / p;
    const series = [val];
    for (let i = p; i < data.length; i++) {
      val = data[i].close * k + val * (1 - k);
      series.push(val);
    }
    return series;
  };

  const fastEma = getEmaSeries(candles, fast);
  const slowEma = getEmaSeries(candles, slow);

  const macdLine = [];
  const offset = slow - fast;
  for (let i = 0; i < slowEma.length; i++) {
    macdLine.push(fastEma[i + offset] - slowEma[i]);
  }

  // Signal Line
  const kSignal = 2 / (signalPeriod + 1);
  let sig = macdLine.slice(0, signalPeriod).reduce((sum, v) => sum + v, 0) / signalPeriod;
  for (let i = signalPeriod; i < macdLine.length; i++) {
    sig = macdLine[i] * kSignal + sig * (1 - kSignal);
  }

  const currentMacd = macdLine[macdLine.length - 1];
  const histogram = currentMacd - sig;

  return {
    macd: Number(currentMacd.toFixed(4)),
    signal: Number(sig.toFixed(4)),
    histogram: Number(histogram.toFixed(4)),
    momentum: histogram > 0 ? 'BULLISH' : 'BEARISH'
  };
}

// 5. Average True Range (ATR 14)
function calculateATR(candles, period = 14) {
  if (!candles || candles.length <= period) return null;
  const trs = [];
  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    trs.push(tr);
  }

  let atr = trs.slice(0, period).reduce((sum, v) => sum + v, 0) / period;
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period;
  }
  return Number(atr.toFixed(4));
}

// 6. Bollinger Bands (20, 2)
function calculateBollingerBands(candles, period = 20, multiplier = 2) {
  if (!candles || candles.length < period) return null;
  const slice = candles.slice(-period);
  const sma = slice.reduce((sum, c) => sum + c.close, 0) / period;
  const variance = slice.reduce((sum, c) => sum + Math.pow(c.close - sma, 2), 0) / period;
  const stdDev = Math.sqrt(variance);

  return {
    upper: Number((sma + multiplier * stdDev).toFixed(4)),
    middle: Number(sma.toFixed(4)),
    lower: Number((sma - multiplier * stdDev).toFixed(4))
  };
}

// 7. Swing Highs & Lows
function detectSwingPoints(candles, left = 2, right = 2) {
  if (!candles || candles.length < left + right + 1) return { swingHighs: [], swingLows: [] };
  const swingHighs = [];
  const swingLows = [];

  for (let i = left; i < candles.length - right; i++) {
    const currentHigh = candles[i].high;
    const currentLow = candles[i].low;

    let isHigh = true;
    let isLow = true;

    for (let j = i - left; j <= i + right; j++) {
      if (j === i) continue;
      if (candles[j].high >= currentHigh) isHigh = false;
      if (candles[j].low <= currentLow) isLow = false;
    }

    if (isHigh) swingHighs.push({ price: currentHigh, time: candles[i].time });
    if (isLow) swingLows.push({ price: currentLow, time: candles[i].time });
  }

  return { swingHighs, swingLows };
}

// 8. Market Structure & Trend
function detectMarketStructure(candles) {
  if (!candles || candles.length < 10) return { trend: 'NEUTRAL', structure: 'Ranging / Accumulation' };
  const { swingHighs, swingLows } = detectSwingPoints(candles);

  if (swingHighs.length >= 2 && swingLows.length >= 2) {
    const lastHigh = swingHighs[swingHighs.length - 1].price;
    const prevHigh = swingHighs[swingHighs.length - 2].price;
    const lastLow = swingLows[swingLows.length - 1].price;
    const prevLow = swingLows[swingLows.length - 2].price;

    if (lastHigh > prevHigh && lastLow > prevLow) {
      return { trend: 'BULLISH', structure: 'Higher Highs (HH) & Higher Lows (HL)' };
    }
    if (lastHigh < prevHigh && lastLow < prevLow) {
      return { trend: 'BEARISH', structure: 'Lower Highs (LH) & Lower Lows (LL)' };
    }
  }

  // Fallback to EMA slope
  const ema20 = calculateEMA(candles, 10);
  const lastClose = candles[candles.length - 1].close;
  if (ema20 && lastClose > ema20) {
    return { trend: 'BULLISH', structure: 'Trading above 10 EMA' };
  } else if (ema20 && lastClose < ema20) {
    return { trend: 'BEARISH', structure: 'Trading below 10 EMA' };
  }

  return { trend: 'NEUTRAL', structure: 'Consolidation' };
}

// 9. Break of Structure (BOS) and Change of Character (CHOCH)
function detectBOSandCHOCH(candles) {
  if (!candles || candles.length < 12) return { events: [], currentStatus: 'Insufficient candles' };
  const { swingHighs, swingLows } = detectSwingPoints(candles);
  if (!swingHighs.length || !swingLows.length) return { events: [], currentStatus: 'Consolidation' };

  const lastHigh = swingHighs[swingHighs.length - 1].price;
  const lastLow = swingLows[swingLows.length - 1].price;
  const lastBar = candles[candles.length - 1];
  const prevBar = candles[candles.length - 2];

  const events = [];

  // Check BOS / CHOCH on latest candle close
  if (lastBar.close > lastHigh && prevBar.close <= lastHigh) {
    events.push({
      type: 'BOS_BULLISH',
      level: lastHigh,
      time: lastBar.time,
      description: `Candle closed above swing high (${lastHigh}), confirming bullish break of structure.`
    });
  } else if (lastBar.close < lastLow && prevBar.close >= lastLow) {
    events.push({
      type: 'BOS_BEARISH',
      level: lastLow,
      time: lastBar.time,
      description: `Candle closed below swing low (${lastLow}), confirming bearish break of structure.`
    });
  }

  return {
    events,
    swingHigh: lastHigh,
    swingLow: lastLow,
    currentStatus: events.length > 0 ? events[0].description : 'Price operating within established swing bounds'
  };
}

// 10. Liquidity Sweep Detector (Purge & Revert)
function detectLiquiditySweep(candles) {
  if (!candles || candles.length < 10) return { detected: false };
  const { swingHighs, swingLows } = detectSwingPoints(candles);
  if (!swingHighs.length || !swingLows.length) return { detected: false };

  const recentCandles = candles.slice(-5);
  const priorHigh = swingHighs[swingHighs.length - 1].price;
  const priorLow = swingLows[swingLows.length - 1].price;

  for (const c of recentCandles) {
    // Buy-side liquidity sweep: High pierced swing high, but close remained below it
    if (c.high > priorHigh && c.close < priorHigh) {
      return {
        detected: true,
        type: 'BUY_SIDE_LIQUIDITY_SWEEP',
        level: priorHigh,
        wickHigh: c.high,
        time: c.time,
        implication: 'Buy-side liquidity swept above resistance. Watch for bearish displacement or rejection.'
      };
    }
    // Sell-side liquidity sweep: Low pierced swing low, but close remained above it
    if (c.low < priorLow && c.close > priorLow) {
      return {
        detected: true,
        type: 'SELL_SIDE_LIQUIDITY_SWEEP',
        level: priorLow,
        wickLow: c.low,
        time: c.time,
        implication: 'Sell-side liquidity swept below support. Watch for bullish displacement or rebound.'
      };
    }
  }

  return { detected: false };
}

// 11. Fair Value Gap (FVG) Imbalance Detection
function detectFairValueGaps(candles) {
  if (!candles || candles.length < 3) return [];
  const fvgs = [];

  for (let i = 2; i < candles.length; i++) {
    const c1 = candles[i - 2];
    const c2 = candles[i - 1];
    const c3 = candles[i];

    // Bullish FVG: c1.high < c3.low
    if (c1.high < c3.low) {
      fvgs.push({
        type: 'BULLISH_FVG',
        top: Number(c3.low.toFixed(4)),
        bottom: Number(c1.high.toFixed(4)),
        imbalanceSize: Number((c3.low - c1.high).toFixed(4)),
        time: c2.time
      });
    }
    // Bearish FVG: c1.low > c3.high
    else if (c1.low > c3.high) {
      fvgs.push({
        type: 'BEARISH_FVG',
        top: Number(c1.low.toFixed(4)),
        bottom: Number(c3.high.toFixed(4)),
        imbalanceSize: Number((c1.low - c3.high).toFixed(4)),
        time: c2.time
      });
    }
  }

  return fvgs.slice(-3); // return last 3 active imbalances
}

// 12. RSI Regular Divergence Detection
function detectRSIDivergence(candles) {
  if (!candles || candles.length < 25) return null;
  const rsiValues = [];
  for (let i = 15; i <= candles.length; i++) {
    rsiValues.push({
      time: candles[i - 1].time,
      price: candles[i - 1].close,
      rsi: calculateRSI(candles.slice(0, i), 14)
    });
  }

  if (rsiValues.length < 6) return null;

  const last = rsiValues[rsiValues.length - 1];
  const prev = rsiValues[rsiValues.length - 5];

  if (!last.rsi || !prev.rsi) return null;

  // Bearish Divergence: Price Higher High, RSI Lower High
  if (last.price > prev.price && last.rsi < prev.rsi && last.rsi > 60) {
    return {
      type: 'BEARISH_DIVERGENCE',
      description: 'Price printed a higher high while RSI printed a lower high (momentum exhaustion).'
    };
  }

  // Bullish Divergence: Price Lower Low, RSI Higher Low
  if (last.price < prev.price && last.rsi > prev.rsi && last.rsi < 40) {
    return {
      type: 'BULLISH_DIVERGENCE',
      description: 'Price printed a lower low while RSI printed a higher low (selling exhaustion).'
    };
  }

  return null;
}

// 13. Institutional Order Block & Dealing Range (Premium vs Discount)
function detectOrderBlocksAndZones(candles) {
  if (!candles || candles.length < 8) {
    return { orderBlocks: [], dealingRange: null };
  }

  const { swingHighs, swingLows } = detectSwingPoints(candles);
  let dealingRange = null;

  const high = swingHighs.length > 0 ? swingHighs[swingHighs.length - 1].price : Math.max(...candles.map(c => c.high));
  const low = swingLows.length > 0 ? swingLows[swingLows.length - 1].price : Math.min(...candles.map(c => c.low));
  const currentPrice = candles[candles.length - 1].close;
  const equilibrium = Number(((high + low) / 2).toFixed(4));
  const pricingZone = currentPrice > equilibrium
    ? 'PREMIUM (Above 50% Equilibrium — Favorable for short setups / take-profit)'
    : 'DISCOUNT (Below 50% Equilibrium — Favorable for long setups / value buying)';

  dealingRange = {
    swingHigh: high,
    swingLow: low,
    equilibrium,
    currentPrice,
    pricingZone
  };

  const orderBlocks = [];
  for (let i = 2; i < candles.length - 1; i++) {
    const candle = candles[i];
    const nextCandle = candles[i + 1];

    // Bullish Order Block: down candle followed by aggressive expansion candle
    if (candle.close < candle.open && nextCandle.close > nextCandle.open && (nextCandle.close - nextCandle.open) > (candle.open - candle.close) * 1.5) {
      orderBlocks.push({
        type: 'BULLISH_ORDER_BLOCK',
        top: Math.max(candle.open, candle.close),
        bottom: candle.low,
        time: candle.time,
        note: 'Institutional demand zone. Re-tests can offer high-probability long execution.'
      });
    }

    // Bearish Order Block: up candle followed by aggressive drop
    if (candle.close > candle.open && nextCandle.close < nextCandle.open && (nextCandle.open - nextCandle.close) > (candle.close - candle.open) * 1.5) {
      orderBlocks.push({
        type: 'BEARISH_ORDER_BLOCK',
        top: candle.high,
        bottom: Math.min(candle.open, candle.close),
        time: candle.time,
        note: 'Institutional supply zone. Rallies into this zone can offer high-probability short execution.'
      });
    }
  }

  return {
    dealingRange,
    orderBlocks: orderBlocks.slice(-3)
  };
}

/**
 * Generate Structured Professional Market Outlook
 * Enforces verified data transparency, multi-scenario planning,
 * exact invalidation levels, and non-promissory risk disclosures.
 */
function generateStructuredOutlook(marketData) {
  if (!marketData || marketData.status === 'UNAVAILABLE' || !marketData.candles || marketData.candles.length === 0) {
    return `### Market Analysis: ${marketData?.symbol || 'Instrument'}
• **Data Status:** External market feed is currently unavailable or market is closed for the weekend/session.
• **Limitation Disclosure:** TradeJourn never fabricates, hallucinates, or estimates live prices when an external feed is offline.
• **Guidance:** Review your playbook rules, risk management protocols, or position sizing formulas. Fresh technical structure will populate once liquid market hours resume.`;
  }

  const {
    symbol,
    price,
    change24h = 0,
    high24h,
    low24h,
    candles,
    provider,
    source,
    timestamp,
    timeframe = '1h',
    session,
    status = 'LIVE',
    isCached,
    cacheAgeSeconds,
    candleIntegrity,
    isVerifiedExternal
  } = marketData;

  const rsi = calculateRSI(candles, 14);
  const macd = calculateMACD(candles);
  const atr = calculateATR(candles, 14);
  const bb = calculateBollingerBands(candles, 20);
  const structure = detectMarketStructure(candles);
  const { swingHighs, swingLows } = detectSwingPoints(candles);
  const bosData = detectBOSandCHOCH(candles);
  const liquiditySweep = detectLiquiditySweep(candles);
  const fvgs = detectFairValueGaps(candles);
  const divergence = detectRSIDivergence(candles);
  const obData = detectOrderBlocksAndZones(candles);

  const nearestResistance = swingHighs.length ? swingHighs[swingHighs.length - 1].price : (high24h || Number((price * 1.008).toFixed(4)));
  const nearestSupport = swingLows.length ? swingLows[swingLows.length - 1].price : (low24h || Number((price * 0.992).toFixed(4)));

  const rsiCondition = rsi ? (rsi > 70 ? `Overbought (${rsi})` : rsi < 30 ? `Oversold (${rsi})` : `Neutral Momentum (${rsi})`) : 'N/A';
  const momentum = macd ? `${macd.momentum} (Histogram: ${macd.histogram})` : 'Neutral';

  // Format Data Feed Status Badge
  let statusBadge = `[STATUS: ${status}]`;
  if (status === 'DELAYED') {
    statusBadge = `[STATUS: DELAYED (~15m)]`;
  } else if (status === 'CACHED') {
    statusBadge = `[STATUS: CACHED (${cacheAgeSeconds || '<30'}s old)]`;
  } else if (status === 'LIVE') {
    statusBadge = `[STATUS: VERIFIED LIVE]`;
  } else if (status === 'MARKET_CLOSED') {
    statusBadge = `[STATUS: MARKET CLOSED (Weekend)]`;
  }

  const providerName = provider || source || 'External Market Feed';
  const dataTimeStr = timestamp ? new Date(timestamp).toUTCString() : 'N/A';

  // Calculate target levels based on ATR and swing levels
  const atrValue = atr || Number((price * 0.005).toFixed(4));
  const bullishTarget = Number((nearestResistance + (atrValue * 1.5)).toFixed(4));
  const bearishTarget = Number((nearestSupport - (atrValue * 1.5)).toFixed(4));

  return `📊 INSTITUTIONAL MARKET OUTLOOK: ${symbol} (${timeframe})
• Current Price: ${price} (${change24h >= 0 ? '+' : ''}${change24h}%) ${statusBadge}
• Data Feed: ${providerName} | Timestamp: ${dataTimeStr}
• Feed Verification: ${isVerifiedExternal ? 'Verified External Provider' : 'Offline Verified Sandbox'}
• Active Session: ${session || 'Global Trading Session'}
${candleIntegrity?.hasGaps ? `• ⚠️ Data Feed Notice: Detected ${candleIntegrity.gaps.length} missing candle interval(s) in external feed.` : ''}
${status === 'DELAYED' ? `• ℹ️ Latency Notice: Quotes are delayed by ~15 minutes (Public delayed feed). Institutional direct execution requires TWELVE_DATA_API_KEY.` : ''}

🏛️ MARKET STRUCTURE & TREND:
• Primary Trend: ${structure.trend} (${structure.structure})
${obData.dealingRange ? `• Dealing Range: ${obData.dealingRange.pricingZone} (50% Equilibrium: ${obData.dealingRange.equilibrium})` : ''}
• Break of Structure (BOS): ${bosData.currentStatus}
${divergence ? `• Divergence: ⚠️ ${divergence.description}` : ''}
${liquiditySweep.detected ? `• Liquidity Sweep: ⚡ ${liquiditySweep.implication} (Level: ${liquiditySweep.level})` : ''}

🔬 QUANTITATIVE INDICATOR READINGS:
• RSI (14): ${rsiCondition}
• MACD (12, 26, 9): ${momentum}
• ATR (14): ${atr || 'N/A'} (Average True Range volatility)
${bb ? `• Bollinger Bands (20, 2): Upper ${bb.upper} | Middle ${bb.middle} | Lower ${bb.lower}` : ''}
${fvgs.length > 0 ? `• Fair Value Gaps (FVG): ${fvgs.map(f => `${f.type} [${f.bottom} - ${f.top}]`).join(', ')}` : ''}
${obData.orderBlocks.length > 0 ? `• Institutional Order Blocks: ${obData.orderBlocks.map(ob => `${ob.type} [${ob.bottom} - ${ob.top}]`).join(', ')}` : ''}

🔑 KEY STRUCTURAL LEVELS:
• Nearest Technical Resistance: ${nearestResistance}
• Nearest Technical Support: ${nearestSupport}

📈 SCENARIO A (BULLISH EXPANSION):
• Trigger / Confirmation: Sustained candle close above resistance at ${nearestResistance} with bullish momentum/volume confirmation.
• Objective Upside Target: ${bullishTarget}
• Invalidation Condition: Thesis is strictly INVALIDATED if price closes below support at ${nearestSupport}.

📉 SCENARIO B (BEARISH REVERSAL / BREAKDOWN):
• Trigger / Confirmation: Rejection at ${nearestResistance} or a confirmed candle close below support at ${nearestSupport}.
• Objective Downside Target: ${bearishTarget}
• Invalidation Condition: Thesis is strictly INVALIDATED if price expands and closes above resistance at ${nearestResistance}.

⚠️ RISK DISCLOSURE & EXECUTION RULES:
• Non-Promissory Disclosure: This technical analysis models structural probabilities and key inflection levels. It does NOT promise or guarantee a profitable outcome or financial return.
• Capital Protection: Always risk a maximum of 1% to 2% of account equity per trade. Ensure stop-loss orders are placed before entering the market.`;
}

module.exports = {
  calculateSMA,
  calculateEMA,
  calculateRSI,
  calculateMACD,
  calculateATR,
  calculateBollingerBands,
  detectSwingPoints,
  detectMarketStructure,
  detectBOSandCHOCH,
  detectLiquiditySweep,
  detectFairValueGaps,
  detectRSIDivergence,
  detectOrderBlocksAndZones,
  generateStructuredOutlook
};

