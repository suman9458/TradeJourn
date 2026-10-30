/**
 * TradeJourn Trade Utility Helpers
 * ================================
 * Pure deterministic functions for financial metrics, profit extraction,
 * fee/swap deduction, holding duration, equity curve & drawdown calculations,
 * and streaks. Decoupled from database models to prevent circular dependency cycles.
 */

/**
 * Extract gross realized profit from a trade document (before fees and swaps)
 * @param {Object} t - Trade document or object
 * @returns {number} Gross profit in USD
 */
const getTradeGrossProfit = (t) => {
  if (!t) return 0;

  // If trade result is BE (Breakeven), gross price outcome is $0
  if (t.result === 'BE') return 0;

  // MT5 trades store takeProfitUSD as netProfit (gross + commission + swap)
  // If trade is from MT5 and has commissions/swaps, recover gross profit
  if (t.isFromMT5) {
    const rawTp = (t.takeProfitUSD !== undefined && t.takeProfitUSD !== null && t.takeProfitUSD !== '')
      ? Number(t.takeProfitUSD)
      : (t.takeProfit !== undefined && t.takeProfit !== null && t.takeProfit !== '' ? Number(t.takeProfit) : 0);
    const comm = Number(t.commission || 0);
    const swap = Number(t.swap || 0);
    // In MT5: netProfit = grossProfit + commission + swap (where commission is negative)
    // So grossProfit = netProfit - commission - swap
    const recoveredGross = Number((rawTp - comm - swap).toFixed(2));
    if (t.result === 'WIN') return Math.abs(recoveredGross);
    if (t.result === 'LOSS') return recoveredGross < 0 ? recoveredGross : -recoveredGross;
    return recoveredGross;
  }

  // 1. Explicit takeProfitUSD, profitUSD, takeProfit, or profit
  const rawTp = (t.takeProfitUSD !== undefined && t.takeProfitUSD !== null && t.takeProfitUSD !== '')
    ? t.takeProfitUSD
    : (t.profitUSD !== undefined && t.profitUSD !== null && t.profitUSD !== ''
      ? t.profitUSD
      : (t.takeProfit !== undefined && t.takeProfit !== null && t.takeProfit !== ''
        ? t.takeProfit
        : (t.profit !== undefined && t.profit !== null && t.profit !== '' ? t.profit : null)));

  if (rawTp !== null && rawTp !== undefined && rawTp !== '') {
    const tp = Number(rawTp);
    if (!isNaN(tp) && tp !== 0) {
      if (t.result === 'WIN') return Math.abs(tp);
      if (t.result === 'LOSS') return tp < 0 ? tp : -tp;
      return tp;
    }
  }

  // 2. Pips fallback
  const pips = Number(t.pips || 0);
  if (pips !== 0) {
    if (t.result === 'LOSS' && pips > 0) return -pips;
    if (t.result === 'WIN' && pips < 0) return Math.abs(pips);
    return pips;
  }

  // 3. R-Multiple fallback (1R = $100 baseline assumption)
  const rResult = Number(t.rResult !== undefined && t.rResult !== null
    ? t.rResult
    : (t.result === 'WIN' ? (t.rr || 1.5) : t.result === 'LOSS' ? -1 : 0));
  return Math.round(rResult * 100);
};

/**
 * Extract trading fees and commissions paid
 * MT5 commissions are typically negative (-3.50), manual journals might record positive (5.00).
 * Fee expense is always positive cost in accounting.
 * @param {Object} t - Trade document or object
 * @returns {number} Commission fee expense in USD (>= 0)
 */
const getTradeFees = (t) => {
  if (!t || t.commission === undefined || t.commission === null) return 0;
  const comm = Number(t.commission);
  if (isNaN(comm)) return 0;
  return Number(Math.abs(comm).toFixed(2));
};

/**
 * Extract swap financing cost or credit
 * Signed: negative = cost (interest paid), positive = credit (interest earned).
 * @param {Object} t - Trade document or object
 * @returns {number} Swap adjustment in USD
 */
const getTradeSwap = (t) => {
  if (!t || t.swap === undefined || t.swap === null) return 0;
  const swap = Number(t.swap);
  if (isNaN(swap)) return 0;
  return Number(swap.toFixed(2));
};

/**
 * Deterministic Net Realized P&L calculation (after commissions and swaps)
 * Net P&L = Gross P&L - Fees + Swap
 * @param {Object} t - Trade document or object
 * @returns {number} Net realized profit in USD
 */
const getTradeNetProfit = (t) => {
  if (!t) return 0;

  // MT5 trades store position.netProfit directly in takeProfitUSD
  if (t.isFromMT5) {
    const rawTp = (t.takeProfitUSD !== undefined && t.takeProfitUSD !== null && t.takeProfitUSD !== '')
      ? Number(t.takeProfitUSD)
      : (t.takeProfit !== undefined && t.takeProfit !== null && t.takeProfit !== '' ? Number(t.takeProfit) : 0);
    return Number(rawTp.toFixed(2));
  }

  const gross = getTradeGrossProfit(t);
  const fees = getTradeFees(t);
  const swap = getTradeSwap(t);

  const net = gross - fees + swap;
  return Number(net.toFixed(2));
};

/**
 * Backward compatible profit getter (returns net realized P&L)
 */
const getTradeProfit = (t) => {
  return getTradeNetProfit(t);
};

/**
 * Deterministically extract trade holding duration in minutes
 * Checks explicit holdingDurationMinutes, MT5 open/close timestamps, entry/exit timestamps,
 * or notes containing duration keywords. Never fabricates missing values.
 * @param {Object} t - Trade document or object
 * @returns {number|null} Duration in minutes, or null if unrecorded
 */
const calculateTradeDurationMinutes = (t) => {
  if (!t) return null;

  // 1. Explicit duration fields
  if (typeof t.holdingDurationMinutes === 'number' && !isNaN(t.holdingDurationMinutes) && t.holdingDurationMinutes >= 0) {
    return Math.round(t.holdingDurationMinutes);
  }
  if (typeof t.durationMinutes === 'number' && !isNaN(t.durationMinutes) && t.durationMinutes >= 0) {
    return Math.round(t.durationMinutes);
  }

  // 2. MT5 UTC Timestamps
  if (t.openTimeUTC && t.closeTimeUTC) {
    const openDate = new Date(t.openTimeUTC);
    const closeDate = new Date(t.closeTimeUTC);
    const diffMs = closeDate - openDate;
    if (!isNaN(diffMs) && diffMs >= 0) {
      return Math.round(diffMs / 60000);
    }
  }

  // 3. Entry and Exit timestamps (e.g. entryTime: '08:30', exitTime: '10:15')
  if (t.date && t.entryTime && t.exitTime) {
    const exitDateStr = t.exitDate || t.date;
    const openDate = new Date(`${t.date}T${t.entryTime}`);
    const closeDate = new Date(`${exitDateStr}T${t.exitTime}`);
    const diffMs = closeDate - openDate;
    if (!isNaN(diffMs) && diffMs >= 0) {
      return Math.round(diffMs / 60000);
    }
  }

  // 4. Notes regex parsing (e.g. "Duration: 45m", "Held for 2 hours", "Holding time: 90 mins")
  if (typeof t.notes === 'string' && t.notes.trim()) {
    const match = t.notes.match(/(?:duration|held for|holding time|hold time)[:\s]+(\d+(?:\.\d+)?)\s*(m|min|mins|minutes|h|hr|hrs|hours)/i);
    if (match) {
      const val = parseFloat(match[1]);
      const unit = match[2].toLowerCase();
      if (!isNaN(val) && val >= 0) {
        if (unit.startsWith('h')) return Math.round(val * 60);
        return Math.round(val);
      }
    }
  }

  return null;
};

/**
 * Format duration minutes into a clean human-readable string
 * @param {number|null} minutes
 * @returns {string} Formatted duration (e.g. "45m", "2h 15m", "Not recorded")
 */
const formatDuration = (minutes) => {
  if (minutes === null || minutes === undefined || isNaN(minutes)) {
    return 'Not recorded';
  }
  const m = Math.round(minutes);
  if (m < 60) return `${m}m`;
  const hours = Math.floor(m / 60);
  const remMinutes = m % 60;
  if (remMinutes === 0) return `${hours}h`;
  return `${hours}h ${remMinutes}m`;
};

/**
 * Compute streaks chronologically
 * @param {Array} trades
 * @returns {Object}
 */
const computeStreaks = (trades) => {
  if (!Array.isArray(trades) || !trades.length) {
    return { currentWinStreak: 0, currentLossStreak: 0, maxWinStreak: 0, maxLossStreak: 0 };
  }

  const sorted = [...trades].sort((a, b) => {
    const dateA = `${a.date || '1970-01-01'}T${a.time || '00:00'}`;
    const dateB = `${b.date || '1970-01-01'}T${b.time || '00:00'}`;
    return new Date(dateA) - new Date(dateB);
  });

  let maxWin = 0, maxLoss = 0, currentWin = 0, currentLoss = 0;

  for (const t of sorted) {
    if (t.result === 'WIN') {
      currentWin++;
      currentLoss = 0;
      if (currentWin > maxWin) maxWin = currentWin;
    } else if (t.result === 'LOSS') {
      currentLoss++;
      currentWin = 0;
      if (currentLoss > maxLoss) maxLoss = currentLoss;
    } else {
      // Breakeven pauses streaks without resetting max
      currentWin = 0;
      currentLoss = 0;
    }
  }

  let lastWin = 0, lastLoss = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].result === 'WIN') lastWin++;
    else break;
  }
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].result === 'LOSS') lastLoss++;
    else break;
  }

  return {
    currentWinStreak: lastWin,
    currentLossStreak: lastLoss,
    maxWinStreak: maxWin,
    maxLossStreak: maxLoss
  };
};

/**
 * Compute deterministic equity curve and drawdown analysis
 * Tracks running cumulative P&L, running peak, drawdown depth, and drawdown duration.
 * @param {Array} trades
 * @returns {Object}
 */
const computeEquityCurveAndDrawdown = (trades = []) => {
  if (!Array.isArray(trades) || !trades.length) {
    return {
      peakEquityUSD: 0,
      maxDrawdownUSD: 0,
      maxDrawdownPct: 0,
      currentDrawdownUSD: 0,
      inDrawdown: false,
      maxDrawdownDurationTrades: 0,
      maxDrawdownDurationDays: 0,
      currentDrawdownTrades: 0,
      recoveryFactor: 0,
      equityCurve: []
    };
  }

  const sorted = [...trades].sort((a, b) => {
    const dateA = `${a.date || '1970-01-01'}T${a.time || '00:00'}`;
    const dateB = `${b.date || '1970-01-01'}T${b.time || '00:00'}`;
    return new Date(dateA) - new Date(dateB);
  });

  let cumulativeNet = 0;
  let peak = 0;
  let peakDate = sorted[0]?.date ? new Date(sorted[0].date) : new Date();
  let maxDrawdownUSD = 0;

  let currentDrawdownTrades = 0;
  let maxDrawdownDurationTrades = 0;

  let currentDrawdownStartDate = null;
  let maxDrawdownDurationDays = 0;

  const equityCurve = [];

  for (let i = 0; i < sorted.length; i++) {
    const t = sorted[i];
    const net = getTradeNetProfit(t);
    cumulativeNet = Number((cumulativeNet + net).toFixed(2));
    const currentDate = t.date ? new Date(t.date) : new Date();

    if (cumulativeNet >= peak) {
      peak = cumulativeNet;
      peakDate = currentDate;
      currentDrawdownTrades = 0;
      currentDrawdownStartDate = null;
    } else {
      currentDrawdownTrades++;
      if (!currentDrawdownStartDate) {
        currentDrawdownStartDate = currentDate;
      }
      const ddUSD = Number((peak - cumulativeNet).toFixed(2));
      if (ddUSD > maxDrawdownUSD) {
        maxDrawdownUSD = ddUSD;
      }
      if (currentDrawdownTrades > maxDrawdownDurationTrades) {
        maxDrawdownDurationTrades = currentDrawdownTrades;
      }
      const daysDiff = Math.max(0, Math.round((currentDate - peakDate) / (1000 * 60 * 60 * 24)));
      if (daysDiff > maxDrawdownDurationDays) {
        maxDrawdownDurationDays = daysDiff;
      }
    }

    equityCurve.push({
      tradeIndex: i + 1,
      date: t.date,
      time: t.time || '00:00',
      tradeName: t.tradeName || `Trade #${i + 1}`,
      instrument: t.instrument,
      result: t.result,
      netPnlUSD: net,
      cumulativeNetUSD: cumulativeNet,
      drawdownUSD: Number((peak - cumulativeNet).toFixed(2))
    });
  }

  const currentDrawdownUSD = Number((peak - cumulativeNet).toFixed(2));
  const inDrawdown = currentDrawdownUSD > 0.01;
  const recoveryFactor = maxDrawdownUSD > 0
    ? Number((cumulativeNet / maxDrawdownUSD).toFixed(2))
    : (cumulativeNet > 0 ? 999.0 : 0);

  return {
    peakEquityUSD: peak,
    maxDrawdownUSD,
    currentDrawdownUSD,
    inDrawdown,
    maxDrawdownDurationTrades,
    maxDrawdownDurationDays,
    currentDrawdownTrades: inDrawdown ? currentDrawdownTrades : 0,
    recoveryFactor,
    equityCurve
  };
};

module.exports = {
  getTradeGrossProfit,
  getTradeFees,
  getTradeSwap,
  getTradeNetProfit,
  getTradeProfit,
  calculateTradeDurationMinutes,
  formatDuration,
  computeStreaks,
  computeEquityCurveAndDrawdown
};
