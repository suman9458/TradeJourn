import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Scale,
  Award,
  Zap,
  Target,
  Flame,
  Clock,
  Brain,
  CheckCircle2,
  XCircle,
  Percent,
  Activity,
  Layers,
  AlertTriangle
} from 'lucide-react';
import { useCurrency } from '../context/CurrencyContext';

export const KPICards = ({ stats }) => {
  const { currency, symbol, format } = useCurrency();
  if (!stats) return null;

  const totalProfit = Math.round(stats.totalProfit !== undefined ? stats.totalProfit : (stats.totalR || 0) * 100);
  const avgProfit = Math.round(stats.avgProfit !== undefined ? stats.avgProfit : (stats.avgR || 0) * 100);
  const avgWinUSD = Math.round(stats.avgWinUSD !== undefined ? stats.avgWinUSD : (stats.avgWin || 0) * 100);
  const avgLossUSD = Math.round(stats.avgLossUSD !== undefined ? stats.avgLossUSD : (stats.avgLoss || 0) * 100);
  const bestTradeUSD = Math.round(stats.bestTradeUSD !== undefined ? stats.bestTradeUSD : (stats.bestTrade || 0) * 100);
  const worstTradeUSD = Math.round(stats.worstTradeUSD !== undefined ? stats.worstTradeUSD : (stats.worstTrade || 0) * 100);

  const cards = [
    { label: 'Total Trades', value: stats.totalTrades, tone: 'neutral', icon: Layers, sub: 'Logged & Audited' },
    { label: 'Winning Trades', value: stats.winningTrades, tone: 'positive', icon: CheckCircle2, sub: `${(stats.winRate || 0).toFixed(0)}% Execution Rate` },
    { label: 'Losing Trades', value: stats.losingTrades, tone: 'negative', icon: XCircle, sub: `${(stats.lossRate || 0).toFixed(0)}% Loss Rate` },
    { label: 'Overall Win Rate', value: `${(stats.winRate || 0).toFixed(1)}%`, tone: 'positive', icon: Percent, sub: 'Statistical Probability' },
    { label: `Total Net PnL (${symbol})`, value: format(totalProfit, { showSign: true, decimals: 0 }), tone: totalProfit >= 0 ? 'positive' : 'negative', icon: DollarSign, sub: 'Realized Cumulative PnL' },
    { label: `Average Expectancy (${symbol})`, value: format(avgProfit, { showSign: true, decimals: 0 }), tone: avgProfit >= 0 ? 'positive' : 'negative', icon: Scale, sub: 'Expected Value / Trade' },
    { label: `Average Win (${symbol})`, value: format(avgWinUSD, { showSign: true, decimals: 0 }), tone: 'positive', icon: TrendingUp, sub: 'Mean Target Reward' },
    { label: `Average Loss (${symbol})`, value: format(avgLossUSD, { showSign: true, decimals: 0 }), tone: 'negative', icon: TrendingDown, sub: 'Controlled Risk Limit' },
    { label: 'Profit Factor', value: (stats.profitFactor || 0).toFixed(2), tone: (stats.profitFactor || 0) >= 1.5 ? 'positive' : 'warning', icon: Activity, sub: (stats.profitFactor >= 2 ? 'Elite Edge' : 'Profitable') },
    { label: `Best Trade (${symbol})`, value: format(bestTradeUSD, { showSign: true, decimals: 0 }), tone: 'positive', icon: Award, sub: 'Maximum Runner' },
    { label: `Worst Trade (${symbol})`, value: format(worstTradeUSD, { showSign: true, decimals: 0 }), tone: 'negative', icon: XCircle, sub: 'Worst Drawdown' },
    { label: 'Current Win Streak', value: stats.currentWinStreak, tone: 'positive', icon: Flame, sub: 'Consecutive Wins' },
    { label: 'Current Loss Streak', value: stats.currentLossStreak, tone: 'negative', icon: TrendingDown, sub: 'Consecutive Losses' },
    { label: 'Peak Win Streak', value: stats.maxWinStreak, tone: 'positive', icon: Zap, sub: 'Historical Best' },
    { label: 'Max Loss Streak', value: stats.maxLossStreak, tone: 'negative', icon: AlertTriangle, sub: 'Historical Stress' },
    { label: 'Total Pips Captured', value: Math.round(stats.totalPips || 0), tone: 'neutral', icon: Target, sub: 'Market Movement' },
    { label: 'Average Pips / Trade', value: Math.round(stats.avgPips || 0), tone: 'neutral', icon: Target, sub: 'Average Range' },
    { label: 'A+ Setup Win Rate', value: `${(stats.aPlusWinRate || 0).toFixed(1)}%`, tone: 'positive', icon: Award, sub: 'High Conviction Edge' },
    { label: 'Early Exit Count', value: stats.earlyExitCount, tone: 'warning', icon: Clock, sub: 'Premature Profit Takes' },
    { label: 'Emotional Trades', value: stats.emotionalTradeCount, tone: 'warning', icon: Brain, sub: 'Psychological Friction' }
  ];

  return (
    <section className="kpi-grid">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <div key={idx} className={`kpi-card ${card.tone}`}>
            <div className="kpi-top">
              <span>{card.label}</span>
              <div className="kpi-icon">
                <Icon size={16} />
              </div>
            </div>
            <div className="kpi-value">{card.value}</div>
            {card.sub && (
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px', fontWeight: '500' }}>
                {card.sub}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
};
