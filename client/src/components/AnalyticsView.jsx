import React, { useMemo } from 'react';
import { BarChart3, Clock, Compass, Brain, AlertOctagon } from 'lucide-react';

const getTradeProfitUSD = (p) => {
  if (!p) return 0;

  let rawTp = (p.takeProfit !== undefined && p.takeProfit !== null && p.takeProfit !== '')
    ? p.takeProfit
    : (p.takeProfitUSD !== undefined && p.takeProfitUSD !== null && p.takeProfitUSD !== '' ? p.takeProfitUSD : null);

  if (rawTp === null || Number(rawTp) === 0) {
    try {
      const overrides = JSON.parse(localStorage.getItem('tradejourn_tp_overrides') || '{}');
      if (p._id && overrides[p._id] !== undefined) {
        rawTp = overrides[p._id];
      } else if (p.tradeName && p.date) {
        const sig = `${p.tradeName}_${p.date}_${p.time || '00:00'}`;
        if (overrides[sig] !== undefined) {
          rawTp = overrides[sig];
        }
      } else if (p.date) {
        const dateKey = `${p.date}_${p.time || '00:00'}`;
        if (overrides[dateKey] !== undefined) {
          rawTp = overrides[dateKey];
        }
      }
    } catch (e) {}
  }

  if (rawTp !== null && rawTp !== undefined && rawTp !== '') {
    const tp = Number(rawTp);
    if (!isNaN(tp) && tp !== 0) {
      if (p.result === 'WIN') return Math.abs(tp);
      if (p.result === 'LOSS') return tp < 0 ? tp : -tp;
      if (p.result === 'BE') return 0;
      return tp;
    }
  }

  const pips = Number(p.pips || 0);
  if (pips !== 0) {
    if (p.result === 'LOSS' && pips > 0) return -pips;
    if (p.result === 'WIN' && pips < 0) return Math.abs(pips);
    if (p.result === 'BE') return 0;
    return pips;
  }

  const rResult = Number(p.rResult !== undefined ? p.rResult : (p.result === 'WIN' ? (p.rr || 1.5) : p.result === 'LOSS' ? -1 : 0));
  return Math.round(rResult * 100);
};

const formatUSD = (val) => {
  const num = Number(val || 0);
  const sign = num > 0 ? '+' : num < 0 ? '-' : '';
  const abs = Math.abs(num);
  if (abs >= 1000000) return `${sign}$${(abs / 1000000).toFixed(2).replace(/\.00$/, '')}M`;
  if (abs >= 10000) return `${sign}$${(abs / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return `${sign}$${abs.toLocaleString('en-US')}`;
};

const sortByBestPerformance = (a, b) => {
  const wrA = Number(a.winRate || 0);
  const wrB = Number(b.winRate || 0);
  if (wrB !== wrA) return wrB - wrA;

  const profA = Number(a.totalProfit || 0);
  const profB = Number(b.totalProfit || 0);
  if (profB !== profA) return profB - profA;

  return (b.count || 0) - (a.count || 0);
};

export const AnalyticsView = ({ breakdowns, trades = [] }) => {
  const { setups: bkSetups = [], sessions: bkSessions = [], biases: bkBiases = [], emotions: bkEmotions = [], mistakes: bkMistakes = [] } = breakdowns || {};

  // 1. Setup Stats Breakdown (Ranked Best Performance on Top)
  const setupStats = useMemo(() => {
    if (trades && trades.length > 0) {
      const map = {};
      for (const t of trades) {
        const key = t.setupRating || 'Unassigned';
        if (!map[key]) {
          map[key] = { setup: key, count: 0, wins: 0, totalPips: 0, totalProfit: 0 };
        }
        map[key].count += 1;
        if (t.result === 'WIN') map[key].wins += 1;

        let pips = Number(t.pips || 0);
        if (t.result === 'LOSS' && pips > 0) pips = -pips;
        else if (t.result === 'WIN' && pips < 0) pips = Math.abs(pips);
        else if (t.result === 'BE') pips = 0;
        map[key].totalPips += pips;

        map[key].totalProfit += getTradeProfitUSD(t);
      }

      return Object.values(map).map(s => ({
        setup: s.setup,
        count: s.count,
        winRate: (s.wins / s.count) * 100,
        avgPips: Math.round(s.totalPips / s.count),
        avgProfit: Math.round(s.totalProfit / s.count),
        totalProfit: Math.round(s.totalProfit)
      })).sort(sortByBestPerformance);
    }

    return bkSetups.map(s => {
      const totProf = Math.round((s.totalR || 0) * 100);
      const cnt = s.count || 1;
      return {
        setup: s.setup,
        count: s.count,
        winRate: s.winRate || 0,
        avgPips: Math.round(s.avgPips || 0),
        avgProfit: Math.round(totProf / cnt),
        totalProfit: totProf
      };
    }).sort(sortByBestPerformance);
  }, [trades, bkSetups]);

  // 2. Session Stats Breakdown (Ranked Best Performance on Top)
  const sessionStats = useMemo(() => {
    if (trades && trades.length > 0) {
      const map = {};
      for (const t of trades) {
        const key = t.session || 'Other';
        if (!map[key]) {
          map[key] = { session: key, count: 0, wins: 0, totalPips: 0, totalProfit: 0 };
        }
        map[key].count += 1;
        if (t.result === 'WIN') map[key].wins += 1;

        let pips = Number(t.pips || 0);
        if (t.result === 'LOSS' && pips > 0) pips = -pips;
        else if (t.result === 'WIN' && pips < 0) pips = Math.abs(pips);
        else if (t.result === 'BE') pips = 0;
        map[key].totalPips += pips;

        map[key].totalProfit += getTradeProfitUSD(t);
      }

      return Object.values(map).map(s => ({
        session: s.session,
        count: s.count,
        winRate: (s.wins / s.count) * 100,
        avgPips: Math.round(s.totalPips / s.count),
        avgProfit: Math.round(s.totalProfit / s.count),
        totalProfit: Math.round(s.totalProfit)
      })).sort(sortByBestPerformance);
    }

    return bkSessions.map(s => {
      const totProf = Math.round((s.totalR || 0) * 100);
      const cnt = s.count || 1;
      return {
        session: s.session,
        count: s.count,
        winRate: s.winRate || 0,
        avgPips: 0,
        avgProfit: Math.round(totProf / cnt),
        totalProfit: totProf
      };
    }).sort(sortByBestPerformance);
  }, [trades, bkSessions]);

  // 3. Market Bias Stats Breakdown (Ranked Best Performance on Top)
  const biasStats = useMemo(() => {
    if (trades && trades.length > 0) {
      const map = {};
      for (const t of trades) {
        const key = t.bias || 'Neutral';
        if (!map[key]) {
          map[key] = { bias: key, count: 0, wins: 0, totalPips: 0, totalProfit: 0 };
        }
        map[key].count += 1;
        if (t.result === 'WIN') map[key].wins += 1;

        let pips = Number(t.pips || 0);
        if (t.result === 'LOSS' && pips > 0) pips = -pips;
        else if (t.result === 'WIN' && pips < 0) pips = Math.abs(pips);
        else if (t.result === 'BE') pips = 0;
        map[key].totalPips += pips;

        map[key].totalProfit += getTradeProfitUSD(t);
      }

      return Object.values(map).map(b => ({
        bias: b.bias,
        count: b.count,
        winRate: (b.wins / b.count) * 100,
        avgPips: Math.round(b.totalPips / b.count),
        avgProfit: Math.round(b.totalProfit / b.count),
        totalProfit: Math.round(b.totalProfit)
      })).sort(sortByBestPerformance);
    }

    return bkBiases.map(b => {
      const totProf = Math.round((b.totalR || 0) * 100);
      const cnt = b.count || 1;
      return {
        bias: b.bias,
        count: b.count,
        winRate: b.winRate || 0,
        avgPips: 0,
        avgProfit: Math.round(totProf / cnt),
        totalProfit: totProf
      };
    }).sort(sortByBestPerformance);
  }, [trades, bkBiases]);

  // 4. Emotional State Matrix Breakdown (Ranked Best Performance on Top)
  const emotionStats = useMemo(() => {
    if (trades && trades.length > 0) {
      const map = {};
      for (const t of trades) {
        const key = t.emotion || 'Calm';
        if (!map[key]) {
          map[key] = { emotion: key, count: 0, wins: 0, totalPips: 0, totalProfit: 0 };
        }
        map[key].count += 1;
        if (t.result === 'WIN') map[key].wins += 1;

        let pips = Number(t.pips || 0);
        if (t.result === 'LOSS' && pips > 0) pips = -pips;
        else if (t.result === 'WIN' && pips < 0) pips = Math.abs(pips);
        else if (t.result === 'BE') pips = 0;
        map[key].totalPips += pips;

        map[key].totalProfit += getTradeProfitUSD(t);
      }

      return Object.values(map).map(e => ({
        emotion: e.emotion,
        count: e.count,
        winRate: (e.wins / e.count) * 100,
        avgPips: Math.round(e.totalPips / e.count),
        avgProfit: Math.round(e.totalProfit / e.count),
        totalProfit: Math.round(e.totalProfit)
      })).sort(sortByBestPerformance);
    }

    return bkEmotions.map(e => {
      const totProf = Math.round((e.totalR || 0) * 100);
      const cnt = e.count || 1;
      return {
        emotion: e.emotion,
        count: e.count,
        winRate: e.winRate || 0,
        avgPips: 0,
        avgProfit: Math.round(totProf / cnt),
        totalProfit: totProf
      };
    }).sort(sortByBestPerformance);
  }, [trades, bkEmotions]);

  // 5. Execution Mistakes Breakdown
  const mistakeStats = useMemo(() => {
    if (trades && trades.length > 0) {
      const map = {};
      for (const t of trades) {
        const list = Array.isArray(t.mistakes) ? t.mistakes : (t.mistakes ? [t.mistakes] : []);
        for (const m of list) {
          if (!m || m === 'None') continue;
          if (!map[m]) {
            map[m] = { mistake: m, count: 0, wins: 0, totalPips: 0, totalProfit: 0 };
          }
          map[m].count += 1;
          if (t.result === 'WIN') map[m].wins += 1;

          let pips = Number(t.pips || 0);
          if (t.result === 'LOSS' && pips > 0) pips = -pips;
          else if (t.result === 'WIN' && pips < 0) pips = Math.abs(pips);
          else if (t.result === 'BE') pips = 0;
          map[m].totalPips += pips;

          map[m].totalProfit += getTradeProfitUSD(t);
        }
      }

      return Object.values(map).map(m => ({
        mistake: m.mistake,
        count: m.count,
        winRate: (m.wins / m.count) * 100,
        avgPips: Math.round(m.totalPips / m.count),
        avgProfit: Math.round(m.totalProfit / m.count),
        totalProfit: Math.round(m.totalProfit)
      })).sort((a, b) => a.totalProfit - b.totalProfit);
    }

    return bkMistakes.map(m => {
      const totProf = Math.round((m.totalR || 0) * 100);
      const cnt = m.count || 1;
      return {
        mistake: m.mistake,
        count: m.count,
        winRate: m.winRate || 0,
        avgPips: 0,
        avgProfit: Math.round(totProf / cnt),
        totalProfit: totProf
      };
    });
  }, [trades, bkMistakes]);

  if (!breakdowns && (!trades || trades.length === 0)) {
    return (
      <div className="dashboard-panel">
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '30px' }}>Loading analytics...</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: '22px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '22px' }}>
        
        {/* Setup Analysis */}
        <div className="dashboard-panel" style={{ marginBottom: 0 }}>
          <div className="panel-header">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BarChart3 size={18} color="var(--profit)" />
              Setup Quality & Expectancy
            </h3>
          </div>
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Setup Rating</th>
                  <th>Trades</th>
                  <th>Win Rate</th>
                  <th>Avg Pips</th>
                  <th>Avg Profit ($)</th>
                  <th>Net Profit ($)</th>
                </tr>
              </thead>
              <tbody>
                {setupStats.map((s, idx) => (
                  <tr key={idx}>
                    <td>
                      <span className={`pill-grade ${s.setup.toLowerCase().replace(/[^a-z]/g, '')}`}>
                        {s.setup}
                      </span>
                    </td>
                    <td style={{ fontWeight: '600' }}>{s.count}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '50px', height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${s.winRate}%`, background: s.winRate >= 50 ? 'var(--profit)' : 'var(--loss)' }}></div>
                        </div>
                        <span style={{ fontWeight: '700', color: s.winRate >= 50 ? 'var(--profit)' : 'var(--loss)' }}>
                          {s.winRate.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td style={{ fontWeight: '700', fontFamily: 'var(--font-mono)' }}>
                      {s.avgPips >= 0 ? '+' : ''}{s.avgPips}
                    </td>
                    <td style={{ fontWeight: '700', fontFamily: 'var(--font-mono)', color: s.avgProfit >= 0 ? 'var(--profit)' : 'var(--loss)' }}>
                      {formatUSD(s.avgProfit)}
                    </td>
                    <td style={{ fontWeight: '800', fontFamily: 'var(--font-mono)', color: s.totalProfit >= 0 ? 'var(--profit)' : 'var(--loss)' }}>
                      {formatUSD(s.totalProfit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Session Analysis */}
        <div className="dashboard-panel" style={{ marginBottom: 0 }}>
          <div className="panel-header">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={18} color="var(--accent-cyan)" />
              Session Liquidity & Performance
            </h3>
          </div>
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Session</th>
                  <th>Trades</th>
                  <th>Win Rate</th>
                  <th>Avg Pips</th>
                  <th>Avg Profit ($)</th>
                  <th>Net Profit ($)</th>
                </tr>
              </thead>
              <tbody>
                {sessionStats.map((s, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: '700', color: 'var(--text-white)' }}>{s.session}</td>
                    <td style={{ fontWeight: '600' }}>{s.count}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '50px', height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${s.winRate}%`, background: s.winRate >= 50 ? 'var(--profit)' : 'var(--loss)' }}></div>
                        </div>
                        <span style={{ fontWeight: '700', color: s.winRate >= 50 ? 'var(--profit)' : 'var(--loss)' }}>
                          {s.winRate.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td style={{ fontWeight: '700', fontFamily: 'var(--font-mono)' }}>
                      {s.avgPips >= 0 ? '+' : ''}{s.avgPips}
                    </td>
                    <td style={{ fontWeight: '700', fontFamily: 'var(--font-mono)', color: s.avgProfit >= 0 ? 'var(--profit)' : 'var(--loss)' }}>
                      {formatUSD(s.avgProfit)}
                    </td>
                    <td style={{ fontWeight: '800', fontFamily: 'var(--font-mono)', color: s.totalProfit >= 0 ? 'var(--profit)' : 'var(--loss)' }}>
                      {formatUSD(s.totalProfit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '22px' }}>
        {/* Bias Alignment */}
        <div className="dashboard-panel" style={{ marginBottom: 0 }}>
          <div className="panel-header">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Compass size={18} color="var(--warning)" />
              Market Bias Execution
            </h3>
          </div>
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Bias</th>
                  <th>Trades</th>
                  <th>Win Rate</th>
                  <th>Avg Pips</th>
                  <th>Avg Profit ($)</th>
                  <th>Net Profit ($)</th>
                </tr>
              </thead>
              <tbody>
                {biasStats.map((b, idx) => (
                  <tr key={idx}>
                    <td>
                      <span className={`badge ${b.bias === 'Bullish' ? 'badge-win' : b.bias === 'Bearish' ? 'badge-loss' : 'badge-be'}`}>
                        {b.bias}
                      </span>
                    </td>
                    <td style={{ fontWeight: '600' }}>{b.count}</td>
                    <td style={{ color: b.winRate >= 50 ? 'var(--profit)' : 'var(--loss)', fontWeight: '700' }}>
                      {b.winRate.toFixed(1)}%
                    </td>
                    <td style={{ fontWeight: '700', fontFamily: 'var(--font-mono)' }}>
                      {b.avgPips >= 0 ? '+' : ''}{b.avgPips}
                    </td>
                    <td style={{ fontWeight: '700', fontFamily: 'var(--font-mono)', color: b.avgProfit >= 0 ? 'var(--profit)' : 'var(--loss)' }}>
                      {formatUSD(b.avgProfit)}
                    </td>
                    <td style={{ fontWeight: '800', fontFamily: 'var(--font-mono)', color: b.totalProfit >= 0 ? 'var(--profit)' : 'var(--loss)' }}>
                      {formatUSD(b.totalProfit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Emotion Matrix */}
        <div className="dashboard-panel" style={{ marginBottom: 0 }}>
          <div className="panel-header">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Brain size={18} color="var(--accent-purple)" />
              Trader Emotional State Matrix
            </h3>
          </div>
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Emotion</th>
                  <th>Count</th>
                  <th>Win Rate</th>
                  <th>Avg Pips</th>
                  <th>Avg Profit ($)</th>
                  <th>Net Profit ($)</th>
                </tr>
              </thead>
              <tbody>
                {emotionStats.map((e, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: '600', color: ['Fear', 'FOMO', 'Revenge', 'Greed'].includes(e.emotion) ? '#ff6685' : 'var(--text-white)' }}>
                      {e.emotion}
                    </td>
                    <td>{e.count}</td>
                    <td style={{ color: e.winRate >= 50 ? 'var(--profit)' : 'var(--loss)', fontWeight: '700' }}>
                      {e.winRate.toFixed(1)}%
                    </td>
                    <td style={{ fontWeight: '700', fontFamily: 'var(--font-mono)' }}>
                      {e.avgPips >= 0 ? '+' : ''}{e.avgPips}
                    </td>
                    <td style={{ fontWeight: '700', fontFamily: 'var(--font-mono)', color: e.avgProfit >= 0 ? 'var(--profit)' : 'var(--loss)' }}>
                      {formatUSD(e.avgProfit)}
                    </td>
                    <td style={{ fontWeight: '800', fontFamily: 'var(--font-mono)', color: e.totalProfit >= 0 ? 'var(--profit)' : 'var(--loss)' }}>
                      {formatUSD(e.totalProfit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Mistake Frequency & Negative Profit Drain */}
      <div className="dashboard-panel">
        <div className="panel-header">
          <div>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ff6685' }}>
              <AlertOctagon size={20} />
              Capital Drain Analysis: Execution Mistakes
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: '4px' }}>
              Ranked breakdown of behavioral friction and cumulative USD profit/loss impact
            </p>
          </div>
        </div>
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Mistake Category</th>
                <th>Frequency</th>
                <th>Win Rate</th>
                <th>Avg Pips</th>
                <th>Avg Drain ($)</th>
                <th>Cumulative P&L Drain ($)</th>
              </tr>
            </thead>
            <tbody>
              {mistakeStats.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '28px' }}>
                    No execution mistakes logged yet. Flawless process adherence!
                  </td>
                </tr>
              ) : (
                mistakeStats.map((m, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: '700', color: '#ff6685' }}>{m.mistake}</td>
                    <td style={{ fontWeight: '600' }}>{m.count}</td>
                    <td style={{ color: m.winRate >= 50 ? 'var(--profit)' : 'var(--loss)', fontWeight: '700' }}>
                      {m.winRate.toFixed(1)}%
                    </td>
                    <td style={{ fontWeight: '700', fontFamily: 'var(--font-mono)' }}>
                      {m.avgPips >= 0 ? '+' : ''}{m.avgPips}
                    </td>
                    <td style={{ fontWeight: '700', fontFamily: 'var(--font-mono)', color: m.avgProfit <= 0 ? 'var(--loss)' : 'var(--profit)' }}>
                      {formatUSD(m.avgProfit)}
                    </td>
                    <td style={{ fontWeight: '800', fontFamily: 'var(--font-mono)', color: m.totalProfit <= 0 ? 'var(--loss)' : 'var(--profit)' }}>
                      {formatUSD(m.totalProfit)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
