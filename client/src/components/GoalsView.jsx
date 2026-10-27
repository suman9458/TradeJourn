import React, { useState, useEffect, useMemo } from 'react';
import { Target, Edit3, Check, Trophy, ShieldCheck, DollarSign, Calendar, ShieldAlert, CheckCircle2, AlertTriangle, RotateCcw, Clock } from 'lucide-react';
import { useCurrency } from '../context/CurrencyContext';
import { api } from '../services/api';

const getTradeTakeProfitUSD = (t) => {
  if (!t) return 0;
  let rawTp = (t.takeProfit !== undefined && t.takeProfit !== null && t.takeProfit !== '')
    ? t.takeProfit
    : (t.takeProfitUSD !== undefined && t.takeProfitUSD !== null && t.takeProfitUSD !== '' ? t.takeProfitUSD : null);

  if (rawTp === null || Number(rawTp) === 0) {
    try {
      const overrides = JSON.parse(localStorage.getItem('tradejourn_tp_overrides') || '{}');
      if (t._id && overrides[t._id] !== undefined) {
        rawTp = overrides[t._id];
      } else if (t.tradeName && t.date) {
        const sig = `${t.tradeName}_${t.date}_${t.time || '00:00'}`;
        if (overrides[sig] !== undefined) {
          rawTp = overrides[sig];
        }
      } else if (t.date) {
        const dateKey = `${t.date}_${t.time || '00:00'}`;
        if (overrides[dateKey] !== undefined) {
          rawTp = overrides[dateKey];
        }
      }
    } catch (e) {}
  }

  if (rawTp !== null && rawTp !== undefined && rawTp !== '') {
    const tp = Number(rawTp);
    if (!isNaN(tp) && tp !== 0) {
      if (t.result === 'WIN') return Math.abs(tp);
      if (t.result === 'LOSS') return tp < 0 ? tp : -tp;
      if (t.result === 'BE') return 0;
      return tp;
    }
  }

  const pips = Number(t.pips || 0);
  if (pips !== 0) {
    if (t.result === 'LOSS' && pips > 0) return -pips;
    if (t.result === 'WIN' && pips < 0) return Math.abs(pips);
    if (t.result === 'BE') return 0;
    return pips;
  }
  return 0;
};

export const GoalsView = ({ stats, trades = [] }) => {
  const { currency, symbol, convert, format } = useCurrency();
  const [goals, setGoals] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    isChallengeActive: false,
    challengeStartedAt: null,
    accountSize: 50000,
    profitTarget: 5000,
    maxLoss: 5000,
    maxDailyLoss: 2500,
    hasConsistencyRule: true,
    consistencyPct: 50,
    minTradingDays: 5
  });

  useEffect(() => {
    loadGoals();
  }, []);

  const loadGoals = async () => {
    try {
      const res = await api.getGoals();
      if (res.success && res.goal) {
        setGoals(res.goal);
        const hasRule = res.goal.hasConsistencyRule !== undefined
          ? Boolean(res.goal.hasConsistencyRule)
          : (res.goal.consistencyPct > 0);
        const storedStartTime = res.goal.challengeStartedAt || localStorage.getItem('tradejourn_challenge_started_at');
        setEditForm({
          isChallengeActive: res.goal.isChallengeActive !== undefined ? Boolean(res.goal.isChallengeActive) : false,
          challengeStartedAt: storedStartTime || null,
          accountSize: res.goal.accountSize || 50000,
          profitTarget: res.goal.profitTarget || 5000,
          maxLoss: res.goal.maxLoss || 5000,
          maxDailyLoss: res.goal.maxDailyLoss || 2500,
          hasConsistencyRule: hasRule,
          consistencyPct: res.goal.consistencyPct !== undefined ? res.goal.consistencyPct : 50,
          minTradingDays: res.goal.minTradingDays || 5
        });
      }
    } catch (err) {
      console.error('Failed to load goals:', err);
    }
  };

  const handleFormChange = (field, value) => {
    let cleanVal = value;
    if (typeof cleanVal === 'string' && /^0[0-9]+/.test(cleanVal)) {
      cleanVal = cleanVal.replace(/^0+/, '');
    }
    setEditForm(prev => ({ ...prev, [field]: cleanVal }));
  };

  const toggleChallengeActive = async () => {
    const currentActive = Boolean(goals?.isChallengeActive ?? editForm.isChallengeActive);
    const nextState = !currentActive;

    // When turning ON, record timestamp so only trades added AFTER turning ON are tracked
    let nextStartTime = goals?.challengeStartedAt || editForm.challengeStartedAt;
    if (nextState) {
      nextStartTime = new Date().toISOString();
      try {
        localStorage.setItem('tradejourn_challenge_started_at', nextStartTime);
      } catch (e) {}
    }

    setGoals(prev => prev ? { ...prev, isChallengeActive: nextState, challengeStartedAt: nextStartTime } : { isChallengeActive: nextState, challengeStartedAt: nextStartTime });
    setEditForm(prev => ({ ...prev, isChallengeActive: nextState, challengeStartedAt: nextStartTime }));
    try {
      const payload = {
        accountSize: Number(editForm.accountSize) || 50000,
        profitTarget: Number(editForm.profitTarget) || 5000,
        maxLoss: Number(editForm.maxLoss) || 5000,
        maxDailyLoss: Number(editForm.maxDailyLoss) || 2500,
        hasConsistencyRule: Boolean(editForm.hasConsistencyRule),
        consistencyPct: editForm.hasConsistencyRule
          ? (editForm.consistencyPct !== '' && editForm.consistencyPct !== undefined ? Number(editForm.consistencyPct) : 50)
          : 0,
        minTradingDays: Number(editForm.minTradingDays) || 5,
        isChallengeActive: nextState,
        challengeStartedAt: nextStartTime
      };
      const res = await api.updateGoals(payload);
      if (res.success && res.goal) {
        setGoals(res.goal);
      }
    } catch (err) {
      console.error('Failed to toggle challenge active state:', err);
    }
  };

  const handleResetChallenge = async () => {
    if (!window.confirm('Reset prop firm challenge tracking? This will start a fresh challenge cycle from right now.')) {
      return;
    }
    const newStartTime = new Date().toISOString();
    try {
      localStorage.setItem('tradejourn_challenge_started_at', newStartTime);
    } catch (e) {}

    setGoals(prev => ({ ...(prev || {}), isChallengeActive: true, challengeStartedAt: newStartTime }));
    setEditForm(prev => ({ ...prev, isChallengeActive: true, challengeStartedAt: newStartTime }));
    try {
      const payload = {
        accountSize: Number(editForm.accountSize) || 50000,
        profitTarget: Number(editForm.profitTarget) || 5000,
        maxLoss: Number(editForm.maxLoss) || 5000,
        maxDailyLoss: Number(editForm.maxDailyLoss) || 2500,
        hasConsistencyRule: Boolean(editForm.hasConsistencyRule),
        consistencyPct: editForm.hasConsistencyRule
          ? (editForm.consistencyPct !== '' && editForm.consistencyPct !== undefined ? Number(editForm.consistencyPct) : 50)
          : 0,
        minTradingDays: Number(editForm.minTradingDays) || 5,
        isChallengeActive: true,
        challengeStartedAt: newStartTime
      };
      const res = await api.updateGoals(payload);
      if (res.success && res.goal) {
        setGoals(res.goal);
      }
    } catch (err) {
      console.error('Failed to reset challenge:', err);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const payload = {
      isChallengeActive: Boolean(editForm.isChallengeActive),
      challengeStartedAt: editForm.challengeStartedAt || goals?.challengeStartedAt || null,
      accountSize: Number(editForm.accountSize) || 50000,
      profitTarget: Number(editForm.profitTarget) || 5000,
      maxLoss: Number(editForm.maxLoss) || 5000,
      maxDailyLoss: Number(editForm.maxDailyLoss) || 2500,
      hasConsistencyRule: Boolean(editForm.hasConsistencyRule),
      consistencyPct: editForm.hasConsistencyRule
        ? (editForm.consistencyPct !== '' && editForm.consistencyPct !== undefined ? Number(editForm.consistencyPct) : 50)
        : 0,
      minTradingDays: Number(editForm.minTradingDays) || 5
    };
    try {
      const res = await api.updateGoals(payload);
      if (res.success) {
        setGoals(res.goal);
        setIsEditing(false);
      }
    } catch (err) {
      console.error('Failed to update goals:', err);
    }
  };

  const applyPreset = (size) => {
    setEditForm(prev => ({
      ...prev,
      accountSize: size,
      profitTarget: Math.round(size * 0.10), // 10%
      maxLoss: Math.round(size * 0.10),       // 10%
      maxDailyLoss: Math.round(size * 0.05),   // 5%
      consistencyPct: prev.consistencyPct || 50,
      minTradingDays: prev.minTradingDays || 5
    }));
  };

  // Calculations for Prop Firm Challenge Rules
  const challengeMetrics = useMemo(() => {
    const isChallengeActive = goals?.isChallengeActive !== undefined
      ? Boolean(goals.isChallengeActive)
      : Boolean(editForm.isChallengeActive);

    const challengeStartedAt = goals?.challengeStartedAt || editForm.challengeStartedAt || localStorage.getItem('tradejourn_challenge_started_at');

    const accountSize = goals?.accountSize || editForm.accountSize || 50000;
    const profitTarget = goals?.profitTarget || editForm.profitTarget || 5000;
    const maxLoss = goals?.maxLoss || editForm.maxLoss || 5000;
    const maxDailyLoss = goals?.maxDailyLoss || editForm.maxDailyLoss || 2500;
    const hasConsistencyRule = goals?.hasConsistencyRule !== undefined
      ? Boolean(goals.hasConsistencyRule)
      : Boolean(editForm.hasConsistencyRule);
    const consistencyPct = goals?.consistencyPct !== undefined ? goals.consistencyPct : (editForm.consistencyPct || 50);
    const minTradingDays = goals?.minTradingDays || editForm.minTradingDays || 5;

    // Rule: Only trades added AFTER turning ON the challenge button are counted!
    // When Challenge is OFF, no trades are counted.
    let challengeTrades = [];
    if (isChallengeActive) {
      // 2000ms buffer to ensure trades logged right at start timestamp are captured
      const startTimeMs = challengeStartedAt ? (new Date(challengeStartedAt).getTime() - 2000) : 0;
      challengeTrades = trades.filter(t => {
        if (t.isPropTrade === false) return false;
        if (!startTimeMs) return true;

        if (t.createdAt) {
          const cTime = new Date(t.createdAt).getTime();
          if (!isNaN(cTime)) return cTime >= startTimeMs;
        }

        if (t.date) {
          const timeStr = t.time || '00:00';
          const pDate = new Date(`${t.date}T${timeStr}:00`).getTime();
          if (!isNaN(pDate)) return pDate >= startTimeMs;
          const dayStr = t.date.slice(0, 10);
          const startDayStr = new Date(startTimeMs).toISOString().slice(0, 10);
          return dayStr >= startDayStr;
        }

        return false;
      });
    }

    let totalNetProfitUSD = 0;
    let totalGrossProfit = 0;
    let bestSingleTradeProfit = 0;
    const dailyProfitsMap = {};
    const dailyTradesCountMap = {};

    const sortedTrades = [...challengeTrades].sort((a, b) => new Date(a.date || a.createdAt || 0) - new Date(b.date || b.createdAt || 0));

    sortedTrades.forEach(t => {
      const pnl = getTradeTakeProfitUSD(t);
      totalNetProfitUSD += pnl;

      if (pnl > 0) {
        totalGrossProfit += pnl;
        if (pnl > bestSingleTradeProfit) {
          bestSingleTradeProfit = pnl;
        }
      }

      // Group by daily date (YYYY-MM-DD)
      let dateKey = t.date;
      if (!dateKey && t.createdAt) {
        dateKey = new Date(t.createdAt).toISOString().slice(0, 10);
      }
      if (!dateKey) dateKey = 'unknown';
      else dateKey = dateKey.slice(0, 10);

      if (dateKey !== 'unknown') {
        dailyProfitsMap[dateKey] = (dailyProfitsMap[dateKey] || 0) + pnl;
        dailyTradesCountMap[dateKey] = (dailyTradesCountMap[dateKey] || 0) + 1;
      }
    });

    // 1. Target Profit ($)
    const currentTargetProfit = totalNetProfitUSD;

    // 2. Maximum Overall Loss ($)
    // Rule: Minus krte rehna agar profits ho to, and 0 pe ruk jana aur wapis loss ho to badhana
    // When totalNetProfitUSD is negative, overall loss is |totalNetProfitUSD|.
    // When totalNetProfitUSD >= 0, overall loss is 0.00.
    const currentOverallLoss = Math.max(0, -totalNetProfitUSD);

    // 3. Max Daily Loss ($)
    // Rule: 1 day me jo bhi profits yani 1 day ka +,- krna, aur profits aane pr daily loss kmm krna
    // For each calendar day, net PnL is sum of all profits (+) and losses (-).
    // If a day's net is negative, day loss is |dayPnl|. If day is positive, day loss is 0.
    let worstDailyLossUSD = 0;
    let worstDailyLossDate = null;
    Object.entries(dailyProfitsMap).forEach(([dateKey, dayPnl]) => {
      const dayLoss = dayPnl < 0 ? Math.abs(dayPnl) : 0;
      if (dayLoss > worstDailyLossUSD) {
        worstDailyLossUSD = dayLoss;
        worstDailyLossDate = dateKey;
      }
    });

    const todayStr = new Date().toISOString().slice(0, 10);
    const todayNetPnL = dailyProfitsMap[todayStr] ?? 0;
    const todayDailyLossUSD = todayNetPnL < 0 ? Math.abs(todayNetPnL) : 0;

    // 4. Consistency (%): (best single trade profit / total gross profit) < % consistency
    const consistencyCurrentPct = totalGrossProfit > 0 ? (bestSingleTradeProfit / totalGrossProfit) * 100 : 0;

    // 5. Minimum Trading Days
    // Rule: On ho aur trade journal add ho to count krna, jis din add na ho us din no day count
    // Only unique dates where at least one trade was journaled AFTER challenge started
    const uniqueTradingDays = isChallengeActive
      ? Object.keys(dailyTradesCountMap).filter(d => d !== 'unknown' && dailyTradesCountMap[d] > 0).length
      : 0;

    // Challenge Evaluation
    const targetMet = isChallengeActive && totalNetProfitUSD >= profitTarget;
    const maxLossBreached = isChallengeActive && currentOverallLoss > maxLoss;
    const dailyLossBreached = isChallengeActive && worstDailyLossUSD > maxDailyLoss;
    const consistencyBreached = isChallengeActive && hasConsistencyRule && (consistencyCurrentPct > consistencyPct && totalGrossProfit > 0);
    const minDaysMet = isChallengeActive && uniqueTradingDays >= minTradingDays;

    const isPassed = isChallengeActive && targetMet && !maxLossBreached && !dailyLossBreached && !consistencyBreached && minDaysMet;
    const isFailed = isChallengeActive && (maxLossBreached || dailyLossBreached);

    return {
      isChallengeActive,
      challengeStartedAt,
      accountSize,
      profitTarget,
      maxLoss,
      maxDailyLoss,
      hasConsistencyRule,
      consistencyPct,
      minTradingDays,
      totalNetProfitUSD,
      currentOverallLoss,
      worstDailyLossUSD,
      worstDailyLossDate,
      todayNetPnL,
      todayDailyLossUSD,
      bestSingleTradeProfit,
      totalGrossProfit,
      consistencyCurrentPct,
      uniqueTradingDays,
      challengeTradesCount: challengeTrades.length,
      targetMet,
      maxLossBreached,
      dailyLossBreached,
      consistencyBreached,
      minDaysMet,
      isPassed,
      isFailed
    };
  }, [goals, editForm, trades]);

  if (!goals && !editForm) {
    return (
      <div className="dashboard-panel">
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '30px' }}>Loading Prop Firm Challenge Rules...</p>
      </div>
    );
  }

  const {
    isChallengeActive,
    challengeStartedAt,
    accountSize,
    profitTarget,
    maxLoss,
    maxDailyLoss,
    hasConsistencyRule,
    consistencyPct,
    minTradingDays,
    totalNetProfitUSD,
    currentOverallLoss,
    worstDailyLossUSD,
    todayNetPnL,
    bestSingleTradeProfit,
    consistencyCurrentPct,
    uniqueTradingDays,
    challengeTradesCount,
    targetMet,
    maxLossBreached,
    dailyLossBreached,
    consistencyBreached,
    minDaysMet,
    isPassed,
    isFailed
  } = challengeMetrics;

  const challengeItems = [
    {
      id: 'account_size',
      label: 'Challenge Account Size',
      currentDisplay: `$${accountSize.toLocaleString()}`,
      targetDisplay: 'Base Account',
      pct: 100,
      isPassed: true,
      sub: 'Initial starting capital allocated for challenge',
      badge: 'ACCOUNT BASELINE',
      badgeColor: 'var(--accent-cyan)'
    },
    {
      id: 'profit_target',
      label: `1. Target Profit (${symbol})`,
      currentDisplay: format(totalNetProfitUSD, { showSign: true, decimals: 2 }),
      targetDisplay: format(profitTarget, { showSign: false, decimals: 0 }),
      pct: Math.min(100, Math.max(0, (totalNetProfitUSD / (profitTarget || 1)) * 100)),
      isPassed: targetMet,
      sub: 'Required net profit milestone to pass challenge stage',
      badge: targetMet ? 'TARGET ACHIEVED' : `${format(Math.max(0, profitTarget - totalNetProfitUSD), { showSign: false, decimals: 2 })} REMAINING`,
      badgeColor: targetMet ? 'var(--profit)' : 'var(--accent-cyan)'
    },
    {
      id: 'max_loss',
      label: `2. Maximum Overall Loss (${symbol})`,
      currentDisplay: `-${format(currentOverallLoss, { showSign: false, decimals: 2 })}`,
      targetDisplay: `-${format(maxLoss, { showSign: false, decimals: 0 })} Limit`,
      pct: Math.min(100, Math.max(0, (currentOverallLoss / (maxLoss || 1)) * 100)),
      isPassed: !maxLossBreached,
      sub: `Net account loss (recovers with profits, stops at ${symbol}0.00)`,
      badge: maxLossBreached ? 'MAX LOSS BREACHED' : 'DRAWDOWN WITHIN LIMIT',
      badgeColor: maxLossBreached ? '#ff4d4d' : 'var(--profit)'
    },
    {
      id: 'max_daily_loss',
      label: `3. Max Daily Loss (${symbol})`,
      currentDisplay: `-${format(worstDailyLossUSD, { showSign: false, decimals: 2 })}`,
      targetDisplay: `-${format(maxDailyLoss, { showSign: false, decimals: 0 })} Daily Limit`,
      pct: Math.min(100, Math.max(0, (worstDailyLossUSD / (maxDailyLoss || 1)) * 100)),
      isPassed: !dailyLossBreached,
      sub: `Worst single-day net loss (Today's Net: ${format(todayNetPnL, { showSign: true, decimals: 2 })})`,
      badge: dailyLossBreached ? 'DAILY LOSS BREACHED' : 'DAILY LOSS WITHIN LIMIT',
      badgeColor: dailyLossBreached ? '#ff4d4d' : 'var(--profit)'
    },
    {
      id: 'consistency',
      label: '4. Consistency Rule (%)',
      currentDisplay: hasConsistencyRule ? `${consistencyCurrentPct.toFixed(1)}%` : 'N/A',
      targetDisplay: hasConsistencyRule ? `< ${consistencyPct}% Target` : 'No Rule',
      pct: hasConsistencyRule ? Math.min(100, Math.max(0, (consistencyCurrentPct / (consistencyPct || 1)) * 100)) : 100,
      isPassed: !consistencyBreached,
      sub: hasConsistencyRule
        ? `Formula: (Best single trade profit ${format(bestSingleTradeProfit, { decimals: 0 })} / Total gross profit) < ${consistencyPct}%`
        : 'Prop firm challenge has no consistency rule requirement',
      badge: !hasConsistencyRule ? 'RULE NOT REQUIRED' : (consistencyBreached ? 'CONSISTENCY BREACHED' : 'COMPLIANT CONSISTENCY'),
      badgeColor: !hasConsistencyRule ? 'var(--accent-cyan)' : (consistencyBreached ? '#ff9900' : 'var(--profit)')
    },
    {
      id: 'min_days',
      label: '5. Minimum Trading Days',
      currentDisplay: `${uniqueTradingDays} Days`,
      targetDisplay: `${minTradingDays} Days Required`,
      pct: Math.min(100, Math.max(0, (uniqueTradingDays / (minTradingDays || 1)) * 100)),
      isPassed: minDaysMet,
      sub: `Days with trade entries logged since challenge started (${challengeTradesCount} trades logged)`,
      badge: minDaysMet ? 'DAYS REQUIREMENT MET' : `${Math.max(0, minTradingDays - uniqueTradingDays)} DAYS REMAINING`,
      badgeColor: minDaysMet ? 'var(--profit)' : 'var(--accent-cyan)'
    }
  ];

  return (
    <div style={{ display: 'grid', gap: '22px' }}>
      <div className="dashboard-panel">
        <div className="panel-header prop-tracker-header" style={{ flexWrap: 'wrap', gap: '14px', marginBottom: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Target size={24} color={isChallengeActive ? 'var(--profit)' : 'var(--text-muted)'} />
              <h3 style={{ fontSize: '1.2rem', fontWeight: '800', letterSpacing: '0.04em' }}>
                PROP FIRM CHALLENGE TRACKER
              </h3>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>
              Real-time monitoring of account size, profit targets, max loss limits, consistency rules & trading days
            </p>
          </div>

          <div className="prop-tracker-actions" style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            {/* ON / OFF Toggle Switch */}
            <div className="prop-toggle-wrap" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 14px', borderRadius: 'var(--radius-pill)' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: '800', color: isChallengeActive ? 'var(--profit)' : 'var(--text-muted)', letterSpacing: '0.04em' }}>
                CHALLENGE TRACKING: {isChallengeActive ? 'ON' : 'OFF'}
              </span>
              <button
                type="button"
                onClick={toggleChallengeActive}
                title={isChallengeActive ? 'Click to Disable Prop Challenge Tracking' : 'Click to Enable Prop Challenge Tracking'}
                style={{
                  width: '54px',
                  height: '28px',
                  borderRadius: '14px',
                  background: isChallengeActive ? 'linear-gradient(90deg, #00f59b, #00d2ff)' : 'rgba(255, 255, 255, 0.15)',
                  border: isChallengeActive ? '1px solid #00f59b' : '1px solid var(--border-medium)',
                  position: 'relative',
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  padding: 0,
                  outline: 'none',
                  boxShadow: isChallengeActive ? '0 0 12px rgba(0, 245, 155, 0.4)' : 'none'
                }}
              >
                <div
                  style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '50%',
                    background: '#fff',
                    position: 'absolute',
                    top: '2px',
                    left: isChallengeActive ? '28px' : '3px',
                    transition: 'left 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.3)'
                  }}
                />
              </button>
            </div>

            {isChallengeActive && (
              <button
                type="button"
                className="btn-secondary"
                onClick={handleResetChallenge}
                title="Restart challenge with a fresh timestamp from right now"
                style={{ fontSize: '0.84rem', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <RotateCcw size={14} />
                <span>Reset Challenge</span>
              </button>
            )}

            <button
              className="btn-secondary"
              onClick={() => setIsEditing(!isEditing)}
              style={{ fontSize: '0.84rem', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Edit3 size={15} />
              <span>{isEditing ? 'Cancel Edit' : 'Configure Challenge Rules'}</span>
            </button>
          </div>
        </div>

        {/* Challenge Overview Banner */}
        <div
          className={`prop-status-banner ${!isChallengeActive ? 'inactive' : isFailed ? 'failed' : isPassed ? 'passed' : 'active'}`}
          style={{
            borderRadius: 'var(--radius-md)',
            padding: '20px 24px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {!isChallengeActive ? (
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--border-medium)', display: 'grid', placeItems: 'center' }}>
                <Target size={26} color="var(--text-muted)" />
              </div>
            ) : isFailed ? (
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(255, 77, 77, 0.2)', border: '1px solid rgba(255, 77, 77, 0.5)', display: 'grid', placeItems: 'center' }}>
                <ShieldAlert size={26} color="#ff4d4d" />
              </div>
            ) : isPassed ? (
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(0, 245, 155, 0.2)', border: '1px solid rgba(0, 245, 155, 0.5)', display: 'grid', placeItems: 'center' }}>
                <Trophy size={26} color="var(--profit)" />
              </div>
            ) : (
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(0, 210, 255, 0.2)', border: '1px solid rgba(0, 210, 255, 0.5)', display: 'grid', placeItems: 'center' }}>
                <ShieldCheck size={26} color="var(--accent-cyan)" />
              </div>
            )}

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-white)' }}>
                  {format(accountSize, { decimals: 0 })} Challenge Status:
                </span>
                <span
                  style={{
                    fontSize: '0.8rem',
                    fontWeight: '800',
                    padding: '3px 10px',
                    borderRadius: 'var(--radius-pill)',
                    background: !isChallengeActive
                      ? 'rgba(255,255,255,0.08)'
                      : isFailed
                      ? 'rgba(255,77,77,0.2)'
                      : isPassed
                      ? 'rgba(0,245,155,0.2)'
                      : 'rgba(0,210,255,0.2)',
                    color: !isChallengeActive
                      ? 'var(--text-muted)'
                      : isFailed
                      ? '#ff4d4d'
                      : isPassed
                      ? 'var(--profit)'
                      : 'var(--accent-cyan)',
                    border: `1px solid ${!isChallengeActive ? 'var(--border-medium)' : isFailed ? 'rgba(255,77,77,0.4)' : isPassed ? 'rgba(0,245,155,0.4)' : 'rgba(0,210,255,0.4)'}`
                  }}
                >
                  {!isChallengeActive
                    ? 'TRACKING OFF'
                    : isFailed
                    ? 'CHALLENGE FAILED / BREACHED'
                    : isPassed
                    ? 'CHALLENGE PASSED'
                    : 'IN PROGRESS (ACTIVE)'}
                </span>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.84rem', marginTop: '4px' }}>
                {!isChallengeActive
                  ? 'Prop Firm Challenge Tracking is OFF. Turn ON to automatically evaluate all new journal trades against rules.'
                  : isFailed
                  ? 'One or more risk limits (Max Loss or Daily Loss) have been breached.'
                  : isPassed
                  ? 'Congratulations! All profit, risk, consistency, and trading day rules are satisfied.'
                  : `Challenge Active • Evaluating only trades logged after turning ON • Net PnL: ${format(totalNetProfitUSD, { showSign: true, decimals: 2 })} (${((totalNetProfitUSD / accountSize) * 100).toFixed(2)}%)`}
              </p>
            </div>
          </div>

          <div className="prop-hud-pill-bar" style={{ display: 'flex', gap: '20px', padding: '12px 18px', borderRadius: 'var(--radius-md)', flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Account Size</div>
              <div style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-white)', marginTop: '2px' }}>{format(accountSize, { compact: true })}</div>
            </div>
            <div style={{ width: '1px', background: 'var(--border-medium)' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Net PnL</div>
              <div style={{ fontSize: '1rem', fontWeight: '800', color: totalNetProfitUSD >= 0 ? 'var(--profit)' : '#ff4d4d', marginTop: '2px' }}>
                {format(totalNetProfitUSD, { showSign: true, decimals: 0 })}
              </div>
            </div>
            <div style={{ width: '1px', background: 'var(--border-medium)' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Max Loss Used</div>
              <div style={{ fontSize: '1rem', fontWeight: '800', color: maxLossBreached ? '#ff4d4d' : 'var(--text-primary)', marginTop: '2px' }}>
                {format(currentOverallLoss, { decimals: 0 })} / {format(maxLoss, { decimals: 0 })}
              </div>
            </div>
            <div style={{ width: '1px', background: 'var(--border-medium)' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Trading Days</div>
              <div style={{ fontSize: '1rem', fontWeight: '800', color: minDaysMet ? 'var(--profit)' : 'var(--text-primary)', marginTop: '2px' }}>
                {uniqueTradingDays} / {minTradingDays}
              </div>
            </div>
          </div>
        </div>

        {/* Configure Form Section */}
        {isEditing && (
          <form onSubmit={handleSave} className="prop-config-form">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h4 style={{ fontSize: '0.92rem', color: 'var(--accent-cyan)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Configure Target Milestones
              </h4>
              <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Prop Firm Challenge Parameters</span>
            </div>

            {/* Quick Presets & Account Size Selector */}
            <div className="prop-preset-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: '800', color: 'var(--accent-cyan)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  CHALLENGE ACCOUNT SIZE PRESET:
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Selected Capital: <strong style={{ color: 'var(--text-white)', fontSize: '0.9rem' }}>${Number(editForm.accountSize || 0).toLocaleString()}</strong>
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
                {[5000, 10000, 25000, 50000, 100000, 200000].map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => applyPreset(size)}
                    className={`prop-preset-btn ${Number(editForm.accountSize) === size ? 'active' : ''}`}
                  >
                    ${size >= 1000 ? `${size / 1000}k` : size}
                  </button>
                ))}
              </div>
            </div>

            {/* Input Grid for Challenge Parameters */}
            <div className="form-grid-3" style={{ marginBottom: '20px' }}>
              <label>
                <span style={{ fontWeight: '700' }}>1. Target in Amount ($)</span>
                <input
                  type="number"
                  step="100"
                  min="0"
                  value={editForm.profitTarget ?? ''}
                  onFocus={(e) => e.target.select()}
                  onChange={e => handleFormChange('profitTarget', e.target.value)}
                  placeholder="5000"
                  required
                />
              </label>

              <label>
                <span style={{ fontWeight: '700' }}>2. Max Loss ($)</span>
                <input
                  type="number"
                  step="100"
                  min="0"
                  value={editForm.maxLoss ?? ''}
                  onFocus={(e) => e.target.select()}
                  onChange={e => handleFormChange('maxLoss', e.target.value)}
                  placeholder="5000"
                  required
                />
              </label>

              <label>
                <span style={{ fontWeight: '700' }}>3. Max Daily Loss ($)</span>
                <input
                  type="number"
                  step="100"
                  min="0"
                  value={editForm.maxDailyLoss ?? ''}
                  onFocus={(e) => e.target.select()}
                  onChange={e => handleFormChange('maxDailyLoss', e.target.value)}
                  placeholder="2500"
                  required
                />
              </label>

              <label>
                <span style={{ fontWeight: '700' }}>4. Is Consistency Rule Applicable?</span>
                <select
                  value={editForm.hasConsistencyRule ? 'Yes' : 'No'}
                  onChange={e => {
                    const isYes = e.target.value === 'Yes';
                    setEditForm(prev => ({
                      ...prev,
                      hasConsistencyRule: isYes,
                      consistencyPct: isYes ? (prev.consistencyPct || 50) : 50
                    }));
                  }}
                  style={{
                    fontWeight: '700',
                    color: editForm.hasConsistencyRule ? 'var(--profit)' : 'var(--text-muted)'
                  }}
                >
                  <option value="Yes">Yes (Consistency Rule Applicable)</option>
                  <option value="No">No (No Consistency Rule)</option>
                </select>
              </label>

              {editForm.hasConsistencyRule && (
                <label>
                  <span style={{ fontWeight: '700', color: 'var(--accent-cyan)' }}>Consistency Target (%) *</span>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    max="100"
                    value={editForm.consistencyPct ?? ''}
                    onFocus={(e) => e.target.select()}
                    onChange={e => handleFormChange('consistencyPct', e.target.value)}
                    placeholder="50"
                    required
                  />
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    (Max 1 trade profit / Total profit &lt; % consistency)
                  </span>
                </label>
              )}

              <label>
                <span style={{ fontWeight: '700' }}>5. Min Trading Days</span>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={editForm.minTradingDays ?? ''}
                  onFocus={(e) => e.target.select()}
                  onChange={e => handleFormChange('minTradingDays', e.target.value)}
                  placeholder="5"
                  required
                />
              </label>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button type="submit" className="btn-primary" style={{ padding: '10px 24px', fontSize: '0.88rem' }}>
                <Check size={16} />
                <span>Save Milestones</span>
              </button>
              <button type="button" className="btn-secondary" onClick={() => setIsEditing(false)} style={{ padding: '10px 18px', fontSize: '0.88rem' }}>
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Prop Firm Milestone Progress Cards */}
        <div style={{ display: 'grid', gap: '16px' }}>
          {challengeItems.map((item) => {
            const isOK = item.isPassed;

            return (
              <div
                key={item.id}
                className={`prop-milestone-card ${!isOK ? 'failed' : ''}`}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '0.98rem', fontWeight: '800', color: 'var(--text-white)' }}>{item.label}</span>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.7rem',
                          color: item.badgeColor,
                          background: `${item.badgeColor}18`,
                          padding: '3px 10px',
                          borderRadius: 'var(--radius-pill)',
                          fontWeight: '800',
                          border: `1px solid ${item.badgeColor}40`
                        }}
                      >
                        {isOK ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                        {item.badge}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                      {item.sub}
                    </div>
                  </div>

                  <div style={{ fontSize: '1rem', fontFamily: 'var(--font-mono)', fontWeight: '700' }}>
                    <strong style={{ color: isOK ? (item.id === 'account_size' ? 'var(--accent-cyan)' : 'var(--profit)') : '#ff4d4d' }}>
                      {item.currentDisplay}
                    </strong>
                    <span style={{ color: 'var(--text-dim)', margin: '0 6px' }}>/</span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                      {item.targetDisplay}
                    </span>
                  </div>
                </div>

                {/* Progress Bar Track */}
                <div className="prop-progress-track">
                  <div
                    style={{
                      height: '100%',
                      width: `${item.pct}%`,
                      background: !isOK
                        ? 'linear-gradient(90deg, #ff4d4d 0%, #ff8000 100%)'
                        : item.id === 'account_size'
                        ? 'linear-gradient(90deg, #00d2ff 0%, #818cf8 100%)'
                        : 'linear-gradient(90deg, #00f59b 0%, #00d2ff 100%)',
                      borderRadius: 'inherit',
                      boxShadow: isOK ? '0 0 10px rgba(0, 245, 155, 0.4)' : '0 0 10px rgba(255, 77, 77, 0.4)',
                      transition: 'width 0.5s cubic-bezier(0.16, 1, 0.3, 1)'
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
