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

  const totalProfitUSD = reviewData?.totalProfitUSD !== undefined
    ? reviewData.totalProfitUSD
    : (reviewData?.bestTrade && !reviewData?.worstTrade && reviewData?.tradeCount === 1
        ? getTradeProfitUSD(reviewData.bestTrade)
        : (reviewData?.totalR || 0) * 100);

  const avgProfitUSD = reviewData?.avgProfitUSD !== undefined
    ? reviewData.avgProfitUSD
    : (reviewData?.tradeCount ? totalProfitUSD / reviewData.tradeCount : 0);

  const hasLosingTrade = Boolean(
    reviewData?.worstTrade && (
      reviewData.worstTrade.result === 'LOSS' ||
      getTradeProfitUSD(reviewData.worstTrade) < 0 ||
      (reviewData.worstTrade.rResult !== undefined && reviewData.worstTrade.rResult < 0)
    )
  );

  const hasWinningTrade = Boolean(
    reviewData?.bestTrade && (
      reviewData.bestTrade.result === 'WIN' ||
      getTradeProfitUSD(reviewData.bestTrade) > 0 ||
      (reviewData.bestTrade.rResult !== undefined && reviewData.bestTrade.rResult > 0)
    )
  );

  return (
    <div style={{ display: 'grid', gap: '22px' }}>
      {/* Review Timeframe Switcher */}
      <div className="reviews-timeframe-bar">
        <button
          className={subTab === 'daily' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => setSubTab('daily')}
        >
          <Calendar size={15} />
          <span className="review-btn-full">Daily Performance Review</span>
          <span className="review-btn-short">Daily</span>
        </button>
        <button
          className={subTab === 'weekly' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => setSubTab('weekly')}
        >
          <CalendarDays size={15} />
          <span className="review-btn-full">Weekly Rolling Audit (7 Days)</span>
          <span className="review-btn-short">Weekly (7D)</span>
        </button>
        <button
          className={subTab === 'monthly' ? 'btn-primary' : 'btn-secondary'}
          onClick={() => setSubTab('monthly')}
        >
          <CalendarRange size={15} />
          <span className="review-btn-full">Monthly Macro Audit (30 Days)</span>
          <span className="review-btn-short">Monthly (30D)</span>
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
            <div className={`kpi-card ${totalProfitUSD >= 0 ? 'positive' : 'negative'}`}>
              <div className="kpi-top"><span>Net Period Profit</span><span>💰</span></div>
              <div className="kpi-value">{formatUSD(totalProfitUSD)}</div>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>{formatUSD(avgProfitUSD)} avg / trade</p>
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
            <div className="dashboard-panel review-highlight-card best" style={{ marginBottom: 0 }}>
              <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--profit)', fontSize: '0.95rem', marginBottom: '14px', fontWeight: '800' }}>
                <ThumbsUp size={18} />
                Highlight: Best Trade of Period
              </h4>
              {hasWinningTrade ? (
                <div>
                  <p style={{ fontWeight: '800', fontSize: '1.2rem', color: 'var(--text-white)' }}>{reviewData.bestTrade.tradeName}</p>
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
              ) : (
                <div style={{ padding: '6px 0' }}>
                  <p style={{ fontWeight: '700', fontSize: '1.05rem', color: 'var(--text-white)' }}>No Winning Trades</p>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    No profitable executions logged in this period.
                  </p>
                </div>
              )}
            </div>

            <div className={`dashboard-panel review-highlight-card ${hasLosingTrade ? 'worst' : 'clean'}`} style={{ marginBottom: 0 }}>
              {hasLosingTrade ? (
                <>
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--loss)', fontSize: '0.95rem', marginBottom: '14px', fontWeight: '800' }}>
                    <ThumbsDown size={18} />
                    Friction: Worst Trade of Period
                  </h4>
                  <div>
                    <p style={{ fontWeight: '800', fontSize: '1.2rem', color: 'var(--text-white)' }}>{reviewData.worstTrade.tradeName}</p>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '4px 0 10px' }}>
                      {reviewData.worstTrade.date} • {reviewData.worstTrade.instrument} • {reviewData.worstTrade.session}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '800', color: 'var(--loss)', fontSize: '1.4rem' }}>
                        {formatUSD(getTradeProfitUSD(reviewData.worstTrade))}
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', color: 'var(--loss)', opacity: 0.9, fontSize: '0.95rem' }}>
                        ({formatPipsStr(reviewData.worstTrade)})
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--profit)', fontSize: '0.95rem', marginBottom: '14px', fontWeight: '800' }}>
                    <Sparkles size={18} />
                    Zero Friction: No Losses Logged
                  </h4>
                  <div>
                    <p style={{ fontWeight: '800', fontSize: '1.15rem', color: 'var(--text-white)' }}>100% Capital Preservation</p>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '4px 0 10px' }}>
                      Zero losing trades recorded in this period. Every execution closed in profit or breakeven!
                    </p>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(0, 245, 155, 0.1)', border: '1px solid rgba(0, 245, 155, 0.25)', padding: '5px 12px', borderRadius: '6px', color: 'var(--profit)', fontSize: '0.82rem', fontWeight: '700' }}>
                      🛡️ Zero Negative Friction
                    </div>
                  </div>
                </>
              )}
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
              <div className="behavioral-audit-card" style={{ padding: '16px', borderRadius: 'var(--radius-md)' }}>
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

              <div className="behavioral-audit-card" style={{ padding: '16px', borderRadius: 'var(--radius-md)' }}>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px', fontWeight: '700' }}>
                  Primary Execution Friction
                </p>
                <p style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--loss)' }}>
                  {reviewData.topMistakes.length ? `${reviewData.topMistakes[0][0]} (${reviewData.topMistakes[0][1]}x)` : 'None'}
                </p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Most damaging rule breach logged
                </p>
              </div>

              <div className="behavioral-audit-card" style={{ padding: '16px', borderRadius: 'var(--radius-md)' }}>
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
