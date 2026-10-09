import React, { useState } from 'react';
import { Calendar, CalendarDays, CalendarRange, Award, ThumbsUp, ThumbsDown, ShieldAlert, Sparkles, TrendingUp } from 'lucide-react';

const getTradeProfitUSD = (t) => {
  if (!t) return 0;
  let rawTp = (t.takeProfit !== undefined && t.takeProfit !== null && t.takeProfit !== '')
    ? t.takeProfit
    : (t.takeProfitUSD !== undefined && t.takeProfitUSD !== null && t.takeProfitUSD !== '' ? t.takeProfitUSD : null);

  if (rawTp === null || Number(rawTp) === 0) {
    try {
      const overrides = JSON.parse(localStorage.getItem('tradejourn_tp_overrides') || '{}');
      if (t._id && overrides[t._id] !== undefined) {
        rawTp = overrides[t._id];
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

  const rResult = Number(t.rResult !== undefined ? t.rResult : (t.result === 'WIN' ? (t.rr || 1.5) : t.result === 'LOSS' ? -1 : 0));
  return Math.round(rResult * 100);
};

const formatUSD = (val) => {
  const num = Number(val || 0);
  const sign = num > 0 ? '+' : num < 0 ? '-' : '';
  const abs = Math.abs(num);
  return `${sign}$${abs.toLocaleString('en-US')}`;
};

const formatPipsStr = (t) => {
  if (!t) return '0 Pips';
  let pipsVal = Number(t.pips || 0);
  if (t.result === 'LOSS' && pipsVal > 0) pipsVal = -pipsVal;
  else if (t.result === 'WIN' && pipsVal < 0) pipsVal = Math.abs(pipsVal);
  else if (t.result === 'BE') pipsVal = 0;

  const sign = pipsVal > 0 ? '+' : pipsVal < 0 ? '-' : '';
  return `${sign}${Math.abs(pipsVal).toFixed(1)} Pips`;
};

export const ReviewsView = ({ reviews }) => {
  const [subTab, setSubTab] = useState('daily');

  if (!reviews) {
    return (
      <div className="dashboard-panel">
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '30px' }}>Loading reviews...</p>
      </div>
    );
  }

  const reviewData = reviews[subTab];

  return (
    <div style={{ display: 'grid', gap: '22px' }}>
      {/* Review Timeframe Switcher */}
      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          className={subTab === 'daily' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => setSubTab('daily')}
        >
          <Calendar size={16} />
          <span>Daily Performance Review</span>
        </button>
        <button
          className={subTab === 'weekly' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => setSubTab('weekly')}
        >
          <CalendarDays size={16} />
          <span>Weekly Rolling Audit (7 Days)</span>
        </button>
        <button
          className={subTab === 'monthly' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => setSubTab('monthly')}
        >
          <CalendarRange size={16} />
          <span>Monthly Macro Audit (30 Days)</span>
        </button>
      </div>

      {!reviewData || !reviewData.hasData ? (
        <div className="dashboard-panel">
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '48px' }}>
            {reviewData?.message || 'No trades recorded in this timeframe to generate a review.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '22px' }}>
          {/* Snapshot Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
            <div className="kpi-card neutral">
              <div className="kpi-top"><span>Period Volume</span><span>📊</span></div>
              <div className="kpi-value">{reviewData.tradeCount}</div>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>Completed executions</p>
            </div>
            <div className="kpi-card positive">
              <div className="kpi-top"><span>Realized Win Rate</span><span>📈</span></div>
              <div className="kpi-value">{reviewData.winRate.toFixed(1)}%</div>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>Target hit consistency</p>
            </div>
            <div className={`kpi-card ${reviewData.totalR >= 0 ? 'positive' : 'negative'}`}>
              <div className="kpi-top"><span>Net Period Profit</span><span>💰</span></div>
              <div className="kpi-value">{formatUSD(reviewData.totalR * 100)}</div>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>{formatUSD(reviewData.avgR * 100)} avg / trade</p>
            </div>
            <div className="kpi-card positive">
              <div className="kpi-top"><span>Discipline Rating</span><span>⭐</span></div>
              <div className="kpi-value">{Math.round(reviewData.avgDiscipline)}/100</div>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>Process compliance</p>
            </div>
            <div className="kpi-card warning">
              <div className="kpi-top"><span>Early Exit Drag</span><span>⏱️</span></div>
              <div className="kpi-value">{reviewData.earlyExits} ({reviewData.earlyExitPct.toFixed(0)}%)</div>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>Unrealized edge</p>
            </div>
          </div>

          {/* Trade Highlights: Best vs Worst */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '18px' }}>
            <div className="dashboard-panel" style={{ marginBottom: 0, borderLeft: '4px solid var(--profit)', background: 'linear-gradient(135deg, rgba(0, 245, 155, 0.04) 0%, rgba(10, 18, 28, 0.8) 100%)' }}>
              <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--profit)', fontSize: '0.95rem', marginBottom: '14px', fontWeight: '800' }}>
                <ThumbsUp size={18} />
                Highlight: Best Trade of Period
              </h4>
              {reviewData.bestTrade ? (
                <div>
                  <p style={{ fontWeight: '800', fontSize: '1.2rem', color: '#fff' }}>{reviewData.bestTrade.tradeName}</p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '4px 0 10px' }}>
                    {reviewData.bestTrade.date} • {reviewData.bestTrade.instrument} • {reviewData.bestTrade.session}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '800', color: 'var(--profit)', fontSize: '1.4rem' }}>
                      {formatUSD(getTradeProfitUSD(reviewData.bestTrade))}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', color: 'var(--accent-cyan)', fontSize: '0.95rem' }}>
                      ({formatPipsStr(reviewData.bestTrade)})
                    </span>
                  </div>
                </div>
              ) : <p style={{ color: 'var(--text-muted)' }}>None</p>}
            </div>

            <div className="dashboard-panel" style={{ marginBottom: 0, borderLeft: '4px solid var(--loss)', background: 'linear-gradient(135deg, rgba(255, 51, 102, 0.04) 0%, rgba(10, 18, 28, 0.8) 100%)' }}>
              <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--loss)', fontSize: '0.95rem', marginBottom: '14px', fontWeight: '800' }}>
                <ThumbsDown size={18} />
                Friction: Worst Trade of Period
              </h4>
              {reviewData.worstTrade ? (
                <div>
                  <p style={{ fontWeight: '800', fontSize: '1.2rem', color: '#fff' }}>{reviewData.worstTrade.tradeName}</p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '4px 0 10px' }}>
                    {reviewData.worstTrade.date} • {reviewData.worstTrade.instrument} • {reviewData.worstTrade.session}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '800', color: 'var(--loss)', fontSize: '1.4rem' }}>
                      {formatUSD(getTradeProfitUSD(reviewData.worstTrade))}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', color: '#ff6685', opacity: 0.9, fontSize: '0.95rem' }}>
                      ({formatPipsStr(reviewData.worstTrade)})
                    </span>
                  </div>
                </div>
              ) : <p style={{ color: 'var(--text-muted)' }}>None</p>}
            </div>
          </div>

          {/* Psychology & Mistake Breakdown for the Period */}
          <div className="dashboard-panel">
            <div className="panel-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={18} color="var(--accent-cyan)" />
                Behavioral Edge & Psychological Audit
              </h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '18px' }}>
              <div style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', fontWeight: '700' }}>
                  Dominant Emotional State
                </p>
                <p style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--accent-cyan)' }}>
                  {reviewData.topEmotion}
                </p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Most frequent psychological condition during live entries
                </p>
              </div>

              <div style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', fontWeight: '700' }}>
                  Primary Execution Friction
                </p>
                <p style={{ fontSize: '1.2rem', fontWeight: '800', color: '#ff6685' }}>
                  {reviewData.topMistakes.length ? `${reviewData.topMistakes[0][0]} (${reviewData.topMistakes[0][1]}x)` : 'None'}
                </p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Most damaging rule breach logged
                </p>
              </div>

              <div style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', fontWeight: '700' }}>
                  Actionable Period Focus
                </p>
                <p style={{ fontSize: '0.94rem', color: 'var(--text-white)', fontWeight: '600', lineHeight: '1.4' }}>
                  {reviewData.earlyExits > 0
                    ? 'Wait for planned structure breaks before touching stop-loss or exiting.'
                    : 'Maintain routine and stay disciplined on position sizing.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
