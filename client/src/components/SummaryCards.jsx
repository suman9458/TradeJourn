import React from 'react';
import { Activity, ShieldAlert, Award, Brain } from 'lucide-react';

const formatUSD = (val) => {
  const num = Number(val || 0);
  const sign = num > 0 ? '+' : num < 0 ? '-' : '';
  const abs = Math.abs(num);
  return `${sign}$${abs.toLocaleString('en-US')}`;
};

export const SummaryCards = ({ stats, trades = [] }) => {
  if (!stats) return null;

  const totalProfit = Math.round(stats.totalProfit !== undefined ? stats.totalProfit : (stats.totalR || 0) * 100);
  const avgProfit = Math.round(stats.avgProfit !== undefined ? stats.avgProfit : (stats.avgR || 0) * 100);
  const avgWinUSD = Math.round((stats.avgWin || 0) * 100);
  const avgLossUSD = Math.round((stats.avgLoss || 0) * 100);
  const bestTradeUSD = Math.round((stats.bestTrade || 0) * 100);
  const worstTradeUSD = Math.round((stats.worstTrade || 0) * 100);

  const performance = [
    ['Total Trades Audited', stats.totalTrades],
    ['Realized Win Rate', `${(stats.winRate || 0).toFixed(1)}%`],
    ['Normalized Loss Rate', `${(stats.lossRate || 0).toFixed(1)}%`],
    ['Total Net Profit ($)', formatUSD(totalProfit)],
    ['Mean Expectancy ($)', formatUSD(avgProfit)],
    ['Average Winner ($)', formatUSD(avgWinUSD)],
    ['Average Loser ($)', formatUSD(avgLossUSD)],
    ['Profit Factor', (stats.profitFactor || 0).toFixed(2)],
    ['Gross Pips Captured', Math.round(stats.totalPips || 0)],
    ['Average Pips / Trade', Math.round(stats.avgPips || 0)]
  ];

  const risk = [
    ['Best Trade (Peak $)', formatUSD(bestTradeUSD)],
    ['Worst Trade (Max Loss $)', formatUSD(worstTradeUSD)],
    ['Active Win Streak', stats.currentWinStreak],
    ['Active Loss Streak', stats.currentLossStreak],
    ['Historical Max Win Streak', stats.maxWinStreak],
    ['Historical Max Loss Streak', stats.maxLossStreak],
    ['A+ Setup Hit Rate', `${(stats.aPlusWinRate || 0).toFixed(1)}%`],
    ['Early Exits Recorded', stats.earlyExitCount],
    ['Emotional Frictions', stats.emotionalTradeCount]
  ];

  const noSetupCount = trades.filter(t => t.setupRating === 'No Setup').length;
  const confirmedCount = trades.filter(t => t.confirmation === 'Yes').length;
  const lowEmotionCount = trades.filter(t => t.emotionalTradeFlag === 0).length;

  const discipline = [
    ['Discipline Score Average', `${Math.round(stats.disciplineScoreAverage || 0)}/100`],
    ['Highest Yield Setup', stats.bestSetup || '-'],
    ['Dominant Session', stats.bestSession || '-'],
    ['Unplanned / No Setup', noSetupCount],
    ['Confirmed Entries', confirmedCount],
    ['Emotion-Controlled Trades', lowEmotionCount]
  ];

  const emotionList = ['Calm', 'Confident', 'Focused', 'Fear', 'FOMO', 'Revenge', 'Impatient', 'Overconfident'];
  const psychology = emotionList.map(em => [
    em,
    trades.filter(t => t.emotion === em).length
  ]);

  return (
    <section className="summary-grid">
      <div className="summary-col">
        <h4>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Activity size={15} color="var(--profit)" />
            <span>Performance</span>
          </span>
          <span style={{ fontSize: '0.68rem', color: 'var(--profit)', fontWeight: '800' }}>ALPHA</span>
        </h4>
        <ul className="summary-list">
          {performance.map(([k, v], i) => (
            <li key={i}>
              <span>{k}</span>
              <strong>{v}</strong>
            </li>
          ))}
        </ul>
      </div>

      <div className="summary-col">
        <h4>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <ShieldAlert size={15} color="var(--loss)" />
            <span>Risk & Probability</span>
          </span>
          <span style={{ fontSize: '0.68rem', color: 'var(--loss)', fontWeight: '800' }}>SAFETY</span>
        </h4>
        <ul className="summary-list">
          {risk.map(([k, v], i) => (
            <li key={i}>
              <span>{k}</span>
              <strong>{v}</strong>
            </li>
          ))}
        </ul>
      </div>

      <div className="summary-col">
        <h4>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Award size={15} color="var(--accent-cyan)" />
            <span>Process Discipline</span>
          </span>
          <span style={{ fontSize: '0.68rem', color: 'var(--accent-cyan)', fontWeight: '800' }}>QUALITY</span>
        </h4>
        <ul className="summary-list">
          {discipline.map(([k, v], i) => (
            <li key={i}>
              <span>{k}</span>
              <strong>{v}</strong>
            </li>
          ))}
        </ul>
      </div>

      <div className="summary-col">
        <h4>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Brain size={15} color="var(--accent-purple)" />
            <span>Psychology Ledger</span>
          </span>
          <span style={{ fontSize: '0.68rem', color: 'var(--accent-purple)', fontWeight: '800' }}>MINDSET</span>
        </h4>
        <ul className="summary-list">
          {psychology.map(([k, v], i) => (
            <li key={i}>
              <span>{k}</span>
              <strong style={{ color: ['Fear', 'FOMO', 'Revenge'].includes(k) && v > 0 ? '#ff6685' : 'inherit' }}>
                {v}
              </strong>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};
