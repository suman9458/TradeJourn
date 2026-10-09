import React, { useState, useEffect, useMemo } from 'react';
import { Target, Edit3, Check, Trophy, ShieldCheck, DollarSign, Calendar, ShieldAlert, CheckCircle2, AlertTriangle } from 'lucide-react';
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
  const [goals, setGoals] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    isChallengeActive: false,
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
        setEditForm({
          isChallengeActive: res.goal.isChallengeActive !== undefined ? Boolean(res.goal.isChallengeActive) : false,
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
    const nextState = !(goals?.isChallengeActive ?? editForm.isChallengeActive);
    setGoals(prev => prev ? { ...prev, isChallengeActive: nextState } : { isChallengeActive: nextState });
    setEditForm(prev => ({ ...prev, isChallengeActive: nextState }));
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
        isChallengeActive: nextState
      };
      const res = await api.updateGoals(payload);
      if (res.success && res.goal) {
        setGoals(res.goal);
      }
    } catch (err) {
      console.error('Failed to toggle challenge active state:', err);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const payload = {
      isChallengeActive: Boolean(editForm.isChallengeActive),
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

    const accountSize = goals?.accountSize || editForm.accountSize || 50000;
    const profitTarget = goals?.profitTarget || editForm.profitTarget || 5000;
    const maxLoss = goals?.maxLoss || editForm.maxLoss || 5000;
    const maxDailyLoss = goals?.maxDailyLoss || editForm.maxDailyLoss || 2500;
    const hasConsistencyRule = goals?.hasConsistencyRule !== undefined
      ? Boolean(goals.hasConsistencyRule)
      : Boolean(editForm.hasConsistencyRule);
    const consistencyPct = goals?.consistencyPct !== undefined ? goals.consistencyPct : (editForm.consistencyPct || 50);
    const minTradingDays = goals?.minTradingDays || editForm.minTradingDays || 5;

    // Trade calculations - When ON, include ALL trades added to the journal!
    // When OFF, no trades are included.
    let totalNetProfitUSD = 0;
    let totalGrossProfit = 0;
    let bestSingleTradeProfit = 0;
    const dailyProfitsMap = {};
    const challengeTrades = isChallengeActive ? trades : [];
    const sortedTrades = [...challengeTrades].sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));

    let currentBalance = accountSize;
    let peakBalance = accountSize;
    let maxDrawdownUSD = 0;

    sortedTrades.forEach(t => {
      const pnl = getTradeTakeProfitUSD(t);
      totalNetProfitUSD += pnl;

      if (pnl > 0) {
        totalGrossProfit += pnl;
        if (pnl > bestSingleTradeProfit) {
          bestSingleTradeProfit = pnl;
        }
      }

      // Equity curve drawdown calculation
      currentBalance += pnl;
      if (currentBalance > peakBalance) {
        peakBalance = currentBalance;
      }
      const dd = peakBalance - currentBalance;
      if (dd > maxDrawdownUSD) {
        maxDrawdownUSD = dd;
      }

      // Group by daily date
      const dateKey = t.date ? t.date.slice(0, 10) : 'unknown';
      dailyProfitsMap[dateKey] = (dailyProfitsMap[dateKey] || 0) + pnl;
    });

    // 1. Target Profit ($)
    const currentTargetProfit = totalNetProfitUSD;

    // 2. Max Loss ($)
    const currentMaxLoss = maxDrawdownUSD;

    // 3. Max Daily Loss ($)
    let worstDailyLossUSD = 0;
    Object.values(dailyProfitsMap).forEach(dayPnl => {
      if (dayPnl < 0) {
        const loss = Math.abs(dayPnl);
        if (loss > worstDailyLossUSD) {
          worstDailyLossUSD = loss;
        }
      }
    });

    // 4. Consistency (%): (total 1 trade profit / total profit) < % consistency
    const consistencyCurrentPct = totalGrossProfit > 0 ? (bestSingleTradeProfit / totalGrossProfit) * 100 : 0;

    // 5. Min Trading Days
    const uniqueTradingDays = Object.keys(dailyProfitsMap).filter(d => d !== 'unknown').length;

    // Challenge Evaluation
    const targetMet = isChallengeActive && totalNetProfitUSD >= profitTarget;
    const maxLossBreached = isChallengeActive && currentMaxLoss > maxLoss;
    const dailyLossBreached = isChallengeActive && worstDailyLossUSD > maxDailyLoss;
    const consistencyBreached = isChallengeActive && hasConsistencyRule && (consistencyCurrentPct > consistencyPct && totalGrossProfit > 0);
    const minDaysMet = isChallengeActive && uniqueTradingDays >= minTradingDays;

    const isPassed = isChallengeActive && targetMet && !maxLossBreached && !dailyLossBreached && !consistencyBreached && minDaysMet;
    const isFailed = isChallengeActive && (maxLossBreached || dailyLossBreached);

    return {
      isChallengeActive,
      accountSize,
      profitTarget,
      maxLoss,
      maxDailyLoss,
      hasConsistencyRule,
      consistencyPct,
      minTradingDays,
      totalNetProfitUSD,
      currentMaxLoss,
      worstDailyLossUSD,
      bestSingleTradeProfit,
      totalGrossProfit,
      consistencyCurrentPct,
      uniqueTradingDays,
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
    accountSize,
    profitTarget,
    maxLoss,
    maxDailyLoss,
    hasConsistencyRule,
    consistencyPct,
    minTradingDays,
    totalNetProfitUSD,
    currentMaxLoss,
    worstDailyLossUSD,
    bestSingleTradeProfit,
    consistencyCurrentPct,
    uniqueTradingDays,
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
      label: '1. Target Profit ($)',
      currentDisplay: `${totalNetProfitUSD >= 0 ? '+' : ''}$${totalNetProfitUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      targetDisplay: `$${profitTarget.toLocaleString()}`,
      pct: Math.min(100, Math.max(0, (totalNetProfitUSD / (profitTarget || 1)) * 100)),
      isPassed: targetMet,
      sub: 'Required net profit milestone to pass challenge stage',
      badge: targetMet ? 'TARGET ACHIEVED' : `${Math.max(0, profitTarget - totalNetProfitUSD).toLocaleString('en-US', { style: 'currency', currency: 'USD' })} REMAINING`,
      badgeColor: targetMet ? 'var(--profit)' : 'var(--accent-cyan)'
    },
    {
      id: 'max_loss',
      label: '2. Maximum Overall Loss ($)',
      currentDisplay: `-$${currentMaxLoss.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      targetDisplay: `-$${maxLoss.toLocaleString()} Limit`,
      pct: Math.min(100, Math.max(0, (currentMaxLoss / (maxLoss || 1)) * 100)),
      isPassed: !maxLossBreached,
      sub: 'Maximum peak-to-trough account drawdown limit allowed',
      badge: maxLossBreached ? 'MAX LOSS BREACHED' : 'DRAWDOWN WITHIN LIMIT',
      badgeColor: maxLossBreached ? '#ff4d4d' : 'var(--profit)'
    },
    {
      id: 'max_daily_loss',
      label: '3. Max Daily Loss ($)',
      currentDisplay: `-$${worstDailyLossUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      targetDisplay: `-$${maxDailyLoss.toLocaleString()} Daily Limit`,
      pct: Math.min(100, Math.max(0, (worstDailyLossUSD / (maxDailyLoss || 1)) * 100)),
      isPassed: !dailyLossBreached,
      sub: 'Worst single-day net loss incurred across trading history',
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
        ? `Formula: (Best single trade profit $${bestSingleTradeProfit.toFixed(0)} / Total gross profit) < ${consistencyPct}%`
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
      sub: 'Total unique active trading days logged in history',
      badge: minDaysMet ? 'DAYS REQUIREMENT MET' : `${Math.max(0, minTradingDays - uniqueTradingDays)} DAYS REMAINING`,
      badgeColor: minDaysMet ? 'var(--profit)' : 'var(--accent-cyan)'
    }
  ];

  return (
    <div style={{ display: 'grid', gap: '22px' }}>
      <div className="dashboard-panel">
        <div className="panel-header" style={{ flexWrap: 'wrap', gap: '14px', marginBottom: '20px' }}>
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            {/* ON / OFF Toggle Switch */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.03)', padding: '6px 14px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border-medium)' }}>
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
          style={{
            background: !isChallengeActive
              ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(15, 23, 36, 0.9) 100%)'
              : isFailed
              ? 'linear-gradient(135deg, rgba(255, 77, 77, 0.15) 0%, rgba(20, 10, 15, 0.9) 100%)'
              : isPassed
              ? 'linear-gradient(135deg, rgba(0, 245, 155, 0.15) 0%, rgba(10, 25, 20, 0.9) 100%)'
              : 'linear-gradient(135deg, rgba(0, 210, 255, 0.1) 0%, rgba(10, 18, 30, 0.9) 100%)',
            border: `1px solid ${!isChallengeActive ? 'var(--border-medium)' : isFailed ? 'rgba(255, 77, 77, 0.4)' : isPassed ? 'rgba(0, 245, 155, 0.4)' : 'var(--border-bright)'}`,
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
                <span style={{ fontSize: '1.1rem', fontWeight: '800', color: '#fff' }}>
                  ${accountSize.toLocaleString()} Challenge Status:
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
                  : `Current Net PnL: ${totalNetProfitUSD >= 0 ? '+' : ''}$${totalNetProfitUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${((totalNetProfitUSD / accountSize) * 100).toFixed(2)}%)`}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '20px', background: 'rgba(0,0,0,0.3)', padding: '12px 18px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-medium)' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Account Size</div>
              <div style={{ fontSize: '1rem', fontWeight: '800', color: '#fff', marginTop: '2px' }}>${(accountSize / 1000).toFixed(0)}k</div>
            </div>
            <div style={{ width: '1px', background: 'var(--border-medium)' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Net PnL</div>
              <div style={{ fontSize: '1rem', fontWeight: '800', color: totalNetProfitUSD >= 0 ? 'var(--profit)' : '#ff4d4d', marginTop: '2px' }}>
                {totalNetProfitUSD >= 0 ? '+' : ''}${Math.round(totalNetProfitUSD).toLocaleString()}
              </div>
            </div>
            <div style={{ width: '1px', background: 'var(--border-medium)' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Max Loss Used</div>
              <div style={{ fontSize: '1rem', fontWeight: '800', color: maxLossBreached ? '#ff4d4d' : 'var(--text-primary)', marginTop: '2px' }}>
                ${Math.round(currentMaxLoss).toLocaleString()} / ${Math.round(maxLoss).toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        {/* Configure Form Section */}
        {isEditing && (
          <form onSubmit={handleSave} style={{ background: 'rgba(6,12,20,0.95)', padding: '24px', borderRadius: 'var(--radius-md)', border: '1px solid var(--accent-cyan)', marginBottom: '28px', boxShadow: '0 8px 32px rgba(0,210,255,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h4 style={{ fontSize: '0.92rem', color: 'var(--accent-cyan)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Configure Target Milestones
              </h4>
              <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Prop Firm Challenge Parameters</span>
            </div>

            {/* Quick Presets & Account Size Selector */}
            <div style={{ marginBottom: '20px', background: 'rgba(255,255,255,0.03)', padding: '14px 18px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-medium)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: '800', color: 'var(--accent-cyan)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  CHALLENGE ACCOUNT SIZE PRESET:
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Selected Capital: <strong style={{ color: '#fff', fontSize: '0.9rem' }}>${Number(editForm.accountSize || 0).toLocaleString()}</strong>
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
                {[5000, 10000, 25000, 50000, 100000, 200000].map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => applyPreset(size)}
                    style={{
                      padding: '8px 16px',
                      fontSize: '0.84rem',
                      fontWeight: '800',
                      borderRadius: 'var(--radius-pill)',
                      border: Number(editForm.accountSize) === size ? '1px solid var(--accent-cyan)' : '1px solid var(--border-medium)',
                      background: Number(editForm.accountSize) === size ? 'rgba(0, 210, 255, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                      color: Number(editForm.accountSize) === size ? 'var(--accent-cyan)' : 'var(--text-primary)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: Number(editForm.accountSize) === size ? '0 0 12px rgba(0,210,255,0.3)' : 'none'
                    }}
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
                style={{
                  background: 'var(--bg-card)',
                  padding: '20px 24px',
                  borderRadius: 'var(--radius-md)',
                  border: `1px solid ${!isOK ? 'rgba(255,77,77,0.3)' : 'var(--border-medium)'}`,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
                  transition: 'all 0.25s ease'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '0.98rem', fontWeight: '800', color: '#fff' }}>{item.label}</span>
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
                <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: 'var(--radius-pill)', overflow: 'hidden' }}>
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
