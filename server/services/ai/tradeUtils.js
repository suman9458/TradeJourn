/**
 * TradeJourn Trade Utility Helpers
 * ================================
 * Pure deterministic functions for profit calculation and streaks,
 * decoupled from database models to prevent circular dependency cycles.
 */

/**
 * Robust extraction of realized profit from a trade document
 * @param {Object} t - Trade document or object
 * @returns {number} Realized profit in USD
 */
const getTradeProfit = (t) => {
  if (!t) return 0;

  // 1. Explicit takeProfit or takeProfitUSD
  const rawTp = (t.takeProfit !== undefined && t.takeProfit !== null && t.takeProfit !== '')
    ? t.takeProfit
    : (t.takeProfitUSD !== undefined && t.takeProfitUSD !== null && t.takeProfitUSD !== '' ? t.takeProfitUSD : null);

  if (rawTp !== null && rawTp !== undefined && rawTp !== '') {
    const tp = Number(rawTp);
    if (!isNaN(tp) && tp !== 0) {
      if (t.result === 'WIN') return Math.abs(tp);
      if (t.result === 'LOSS') return tp < 0 ? tp : -tp;
      if (t.result === 'BE') return 0;
      return tp;
    }
  }

  // 2. Pips fallback
  const pips = Number(t.pips || 0);
  if (pips !== 0) {
    if (t.result === 'LOSS' && pips > 0) return -pips;
    if (t.result === 'WIN' && pips < 0) return Math.abs(pips);
    if (t.result === 'BE') return 0;
    return pips;
  }

  // 3. R-Multiple fallback (1R = $100 baseline assumption)
  const rResult = Number(t.rResult !== undefined && t.rResult !== null ? t.rResult : (t.result === 'WIN' ? (t.rr || 1.5) : t.result === 'LOSS' ? -1 : 0));
  return Math.round(rResult * 100);
};

module.exports = {
  getTradeProfit
};

