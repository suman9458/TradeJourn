import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Layers,
  Percent,
  Activity,
  Flame,
  Zap,
  BarChart2,
  Calendar,
  ChevronDown,
  Sparkles,
  ShieldCheck,
  Eye,
  Crosshair
} from 'lucide-react';
import { createSmoothPathD, createSmoothAreaPathD } from '../utils/smoothPath';

export const TopTradingHero = ({ stats, curve = [], trades = [] }) => {
  const [chartMode, setChartMode] = useState('candlestick'); // 'candlestick' | 'equity'
  const [timeframe, setTimeframe] = useState('ALL'); // '1D' | '1W' | '1M' | 'ALL'
  const [hoveredCandle, setHoveredCandle] = useState(null);
  const [hoveredPoint, setHoveredPoint] = useState(null);

  // Core metrics with safe defaults
  const totalTrades = stats?.totalTrades || (trades?.length || 0);
  const winTrades = stats?.winningTrades || 0;
  const looseTrades = stats?.losingTrades || 0;
  const beTrades = stats?.breakEvenTrades || 0;
  const winRate = Number(stats?.winRate || (totalTrades > 0 ? (winTrades / totalTrades) * 100 : 0));
  const lossRate = Number(stats?.lossRate || (totalTrades > 0 ? (looseTrades / totalTrades) * 100 : 0));
  const totalR = Number(stats?.totalR || 0);
  const totalPipsVal = stats?.totalPips !== undefined
    ? Math.round(stats.totalPips)
    : trades.reduce((sum, t) => sum + (Number(t.pips) || 0), 0);
  const pipsGainVal = stats?.pipsGain !== undefined
    ? Math.round(stats.pipsGain)
    : trades.filter(t => t.result === 'WIN').reduce((sum, t) => sum + Math.abs(Number(t.pips) || 0), 0);
  const loosePipsVal = stats?.loosePips !== undefined
    ? Math.round(stats.loosePips)
    : trades.filter(t => t.result === 'LOSS').reduce((sum, t) => sum + Math.abs(Number(t.pips) || 0), 0);
  const avgWin = Number(stats?.avgWin || 0);
  const avgLoss = Number(stats?.avgLoss || 0);
  const profitFactor = Number(stats?.profitFactor || 0);

  // SVG Circular Gauge calculations for Win Rate Graph
  const gaugeRadius = 36;
  const gaugeCircumference = 2 * Math.PI * gaugeRadius;
  const winOffset = gaugeCircumference - (winRate / 100) * gaugeCircumference;

  // Generate realistic aesthetic candlestick simulation aligned with recent trade history or high-frequency FX price action
  const candles = useMemo(() => {
    const count = 28;
    const list = [];
    let currentClose = 1.08450;
    
    // Seed with realistic EURUSD or trading session price bars
    for (let i = 0; i < count; i++) {
      const isUp = i % 3 !== 0 || (i % 5 === 0);
      const change = (Math.sin(i * 0.7) * 0.0018 + (isUp ? 0.0012 : -0.0010));
      const open = currentClose;
      const close = parseFloat((open + change).toFixed(5));
      const high = parseFloat((Math.max(open, close) + Math.abs(Math.sin(i * 1.3)) * 0.0010 + 0.0004).toFixed(5));
      const low = parseFloat((Math.min(open, close) - Math.abs(Math.cos(i * 0.9)) * 0.0009 - 0.0003).toFixed(5));
      const volume = Math.floor(4500 + Math.abs(Math.sin(i)) * 6200);
      const isBull = close >= open;

      currentClose = close;
      list.push({
        id: i,
        index: i,
        time: `${String(8 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 === 0 ? '00' : '30'}`,
        open,
        high,
        low,
        close,
        volume,
        isBull
      });
    }
    return list;
  }, []);

  // Helper to parse trade timestamps consistently
  const getHeroTimestamp = (p) => {
    if (!p?.date) return 0;
    const timePart = p.time && /^\d{1,2}:\d{2}/.test(p.time) ? p.time : '12:00';
    const parsed = new Date(`${p.date}T${timePart}:00`).getTime();
    return isNaN(parsed) ? new Date(p.date).getTime() : parsed;
  };

  // Dynamically analyze curve data to generate available timeframes
  const dynamicHeroTimeframes = useMemo(() => {
    if (!curve || curve.length === 0) {
      return [{ id: 'ALL', label: 'ALL', count: 0, disabled: false }];
    }
    const timestamps = curve.map(getHeroTimestamp).filter(t => t > 0);
    if (!timestamps.length) {
      return [{ id: 'ALL', label: 'ALL', count: curve.length, disabled: false }];
    }
    const latestTs = Math.max(...timestamps);
    const earliestTs = Math.min(...timestamps);
    const daySpan = Math.max(1, Math.ceil((latestTs - earliestTs) / 86400000));
    const anchor = latestTs;

    const count1D = timestamps.filter(t => t >= anchor - 1 * 86400000).length;
    const count7D = timestamps.filter(t => t >= anchor - 7 * 86400000).length;
    const count30D = timestamps.filter(t => t >= anchor - 30 * 86400000).length;
    const countAll = timestamps.length;

    const list = [];
    if (daySpan > 1 && count1D > 0 && count1D < countAll) {
      list.push({ id: '1D', label: '1D', count: count1D, disabled: false });
    }
    list.push({ id: '7D', label: '7D', count: count7D, disabled: count7D === 0 });
    list.push({ id: '30D', label: '30D', count: count30D, disabled: count30D === 0 });
    if (daySpan > 30) {
      const count90D = timestamps.filter(t => t >= anchor - 90 * 86400000).length;
      list.push({ id: '90D', label: '90D', count: count90D, disabled: count90D === 0 });
    }
    list.push({ id: 'ALL', label: 'ALL', count: countAll, disabled: false });
    return list;
  }, [curve]);

  // Filter pips curve dynamically by calendar dates
  let filteredCurve = curve.length ? [...curve] : [];
  if (timeframe !== 'ALL') {
    const timestamps = curve.map(getHeroTimestamp).filter(t => t > 0);
    if (timestamps.length > 0) {
      const latestTs = Math.max(...timestamps);
      const anchor = latestTs;
      let cutoff = 0;
      if (timeframe === '1D') cutoff = anchor - 1 * 86400000;
      else if (timeframe === '7D' || timeframe === '1W') cutoff = anchor - 7 * 86400000;
      else if (timeframe === '30D' || timeframe === '1M') cutoff = anchor - 30 * 86400000;
      else if (timeframe === '90D') cutoff = anchor - 90 * 86400000;

      const subset = curve.filter(p => getHeroTimestamp(p) >= cutoff);
      if (subset.length > 0) filteredCurve = subset;
    }
  }

  let runHeroPips = 0;
  const processedHeroCurve = filteredCurve.map(p => {
    let pVal = Number(p.pips !== undefined && p.pips !== null ? p.pips : 0);
    if (p.result === 'LOSS' && pVal > 0) pVal = -pVal;
    else if (p.result === 'WIN' && pVal < 0) pVal = Math.abs(pVal);
    else if (p.result === 'BE') pVal = 0;
    runHeroPips += pVal;
    return {
      ...p,
      pips: pVal,
      pipsGain: pVal > 0 ? pVal : 0,
      loosePips: pVal < 0 ? Math.abs(pVal) : 0,
      cumulativePips: p.cumulativePips !== undefined && p.cumulativePips !== null ? Number(p.cumulativePips) : runHeroPips
    };
  });

  const pipsPoints = [
    { tradeIndex: 0, date: 'Start', result: 'BE', pips: 0, cumulativePips: 0 },
    ...processedHeroCurve
  ];

  const minPips = Math.min(0, ...pipsPoints.map(p => p.cumulativePips));
  const maxPips = Math.max(10, ...pipsPoints.map(p => p.cumulativePips));
  const rangePips = (maxPips - minPips) || 1;

  // Pips Chart dimensions
  const cWidth = 900;
  const cHeight = 280;
  const padX = 50;
  const padY = 30;
  const gWidth = cWidth - padX * 2;
  const gHeight = cHeight - padY * 2;

  const getEqX = (i) => padX + (i / (pipsPoints.length - 1 || 1)) * gWidth;
  const getEqY = (val) => padY + gHeight - ((val - minPips) / rangePips) * gHeight;

  const zeroLineY = getEqY(0);
  const heroPipsCoords = useMemo(() => {
    return pipsPoints.map((p, i) => ({
      x: getEqX(i),
      y: getEqY(p.cumulativePips)
    }));
  }, [pipsPoints, getEqX, getEqY]);

  const heroPipsPathD = useMemo(() => createSmoothPathD(heroPipsCoords, 0.22), [heroPipsCoords]);
  const heroPipsAreaPathD = useMemo(() => createSmoothAreaPathD(heroPipsCoords, zeroLineY, 0.22), [heroPipsCoords, zeroLineY]);

  // Candlestick Chart SVG dimensions
  const candleChartWidth = 900;
  const candleChartHeight = 280;
  const candlePadX = 40;
  const candlePadY = 25;
  const candleGWidth = candleChartWidth - candlePadX * 2;
  const candleGHeight = candleChartHeight - candlePadY * 2 - 40; // reserve bottom 40px for volume

  const minPrice = Math.min(...candles.map(c => c.low));
  const maxPrice = Math.max(...candles.map(c => c.high));
  const priceRange = (maxPrice - minPrice) || 0.001;

  const getPriceY = (price) => candlePadY + candleGHeight - ((price - minPrice) / priceRange) * candleGHeight;
  const candleStep = candleGWidth / candles.length;
  const candleBarWidth = Math.max(8, candleStep * 0.62);

  // Moving averages (9 EMA and 21 EMA) for aesthetic overlay
  const ema9 = useMemo(() => {
    let k = 2 / (9 + 1);
    let ema = candles[0].close;
    return candles.map((c, i) => {
      ema = c.close * k + ema * (1 - k);
      return { x: candlePadX + i * candleStep + candleStep / 2, y: getPriceY(ema) };
    });
  }, [candles, priceRange]);

  const ema21 = useMemo(() => {
    let k = 2 / (21 + 1);
    let ema = candles[0].close;
    return candles.map((c, i) => {
      ema = c.close * k + ema * (1 - k);
      return { x: candlePadX + i * candleStep + candleStep / 2, y: getPriceY(ema) };
    });
  }, [candles, priceRange]);

  const ema9Path = ema9.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const ema21Path = ema21.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  const scrollToAnalytics = () => {
    const target = document.getElementById('detailed-analytics-section');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="trading-hero-wrapper">
      {/* Background ambient lighting */}
      <div className="hero-ambient-glow-cyan" />
      <div className="hero-ambient-glow-green" />

      {/* Hero Header Toolbar */}
      <div className="hero-header-toolbar">
        <div className="hero-title-group">
          <div className="hero-status-pill">
            <span className="hero-pulse-dot" />
            <span>INSTITUTIONAL MARKET HUD</span>
          </div>
          <span className="hero-symbol-tag">EUR/USD • 1H VOLATILITY REGIME</span>
          <span className="hero-live-badge hide-on-mobile">TRADING ENGINE ONLINE</span>
        </div>

        {/* View Mode & Timeframe Controls */}
        <div className="hero-controls-group">
          <div className="chart-mode-toggle">
            <button
              type="button"
              className={`mode-btn ${chartMode === 'candlestick' ? 'active' : ''}`}
              onClick={() => setChartMode('candlestick')}
            >
              <BarChart2 size={14} />
              <span>Aesthetic Candlestick</span>
            </button>
            <button
              type="button"
              className={`mode-btn ${chartMode === 'equity' ? 'active' : ''}`}
              onClick={() => setChartMode('equity')}
            >
              <TrendingUp size={14} />
              <span>Pips Curve ({totalPipsVal >= 0 ? '+' : ''}{totalPipsVal} Pips)</span>
            </button>
          </div>

          <div className="pips-timeframe-picker hide-on-mobile">
            {dynamicHeroTimeframes.map(tf => {
              const isActive = timeframe === tf.id;
              return (
                <button
                  key={tf.id}
                  type="button"
                  disabled={tf.disabled}
                  className={`pips-tf-btn ${isActive ? 'active' : ''}`}
                  title={tf.disabled ? 'No trades in this window' : `${tf.count} trades in ${tf.label}`}
                  onClick={() => !tf.disabled && setTimeframe(tf.id)}
                >
                  <span>{tf.label}</span>
                  {tf.count !== undefined && tf.count > 0 && (
                    <span className="pips-tf-count">
                      {tf.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* CORE 4 FOCUSED HERO METRIC CARDS (Total Trades, Win Rate, Loose Trades, Net Profit) */}
      <div className="hero-metrics-deck">
        
        {/* 1. TOTAL TRADES CARD */}
        <div className="hero-card hero-card-trades">
          <div className="hero-card-header">
            <div className="hero-card-icon-wrap neutral">
              <Layers size={18} />
            </div>
            <div>
              <span className="hero-card-label">TOTAL TRADES</span>
              <p className="hero-card-sublabel">Execution Sample Size</p>
            </div>
          </div>
          
          <div className="hero-card-body">
            <div className="hero-metric-huge">{totalTrades}</div>
            <div className="hero-trades-badge">
              <Activity size={12} color="var(--accent-cyan)" />
              <span>{trades.length > 0 ? `${trades.length} Closed in Ledger` : 'Active Journal Session'}</span>
            </div>
          </div>

          {/* Mini Sparkline Bar Chart for Total Trades Volume */}
          <div className="hero-card-chart-footer">
            <div className="hero-spark-bars">
              {[4, 7, 5, 9, 6, 8, 10, 7, 11, 9, 12, 10].map((h, i) => (
                <div
                  key={i}
                  className="spark-bar"
                  style={{ height: `${h * 2.2}px`, opacity: 0.4 + (i / 12) * 0.6 }}
                />
              ))}
            </div>
            <span className="hero-card-foot-txt">Verified Mathematical Edge</span>
          </div>
        </div>

        {/* 2. OVERALL WIN RATE CARD (WITH CIRCULAR GAUGE GRAPH) */}
        <div className="hero-card hero-card-winrate">
          <div className="hero-card-header">
            <div className="hero-card-icon-wrap positive">
              <Percent size={18} />
            </div>
            <div>
              <span className="hero-card-label">OVERALL WIN RATE</span>
              <p className="hero-card-sublabel">Statistical Probability</p>
            </div>
          </div>

          <div className="hero-card-body-flex">
            <div>
              <div className="hero-metric-huge text-profit">
                {winRate.toFixed(1)}%
              </div>
              <div className="hero-winrate-status">
                {winRate >= 60 ? (
                  <span className="status-pill-profit">
                    <Sparkles size={11} /> High Edge Performance
                  </span>
                ) : winRate >= 45 ? (
                  <span className="status-pill-cyan">
                    <ShieldCheck size={11} /> Profitable Expectancy
                  </span>
                ) : (
                  <span className="status-pill-warning">
                    Risk-Management Dependent
                  </span>
                )}
              </div>
            </div>

            {/* Circular Win Rate Donut Graph */}
            <div className="winrate-gauge-wrap" title={`${winRate.toFixed(1)}% Win Rate`}>
              <svg width="86" height="86" viewBox="0 0 86 86" className="winrate-svg">
                <defs>
                  <linearGradient id="winGaugeGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#00f59b" />
                    <stop offset="100%" stopColor="#00c878" />
                  </linearGradient>
                  <filter id="winGaugeGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="2.5" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>
                {/* Background Ring (Loss slice representation) */}
                <circle
                  cx="43"
                  cy="43"
                  r={gaugeRadius}
                  stroke="rgba(255, 51, 102, 0.22)"
                  strokeWidth="7"
                  fill="transparent"
                />
                {/* Foreground Win Ring with glow */}
                <circle
                  cx="43"
                  cy="43"
                  r={gaugeRadius}
                  stroke="url(#winGaugeGrad)"
                  strokeWidth="7"
                  strokeDasharray={gaugeCircumference}
                  strokeDashoffset={winOffset}
                  strokeLinecap="round"
                  fill="transparent"
                  filter="url(#winGaugeGlow)"
                  transform="rotate(-90 43 43)"
                  style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                />
                {/* Center Percentage Display */}
                <text
                  x="43"
                  y="40"
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="14"
                  fontWeight="800"
                  fontFamily="var(--font-mono)"
                >
                  {Math.round(winRate)}%
                </text>
                <text
                  x="43"
                  y="53"
                  textAnchor="middle"
                  fill="var(--text-muted)"
                  fontSize="8.5"
                  fontWeight="700"
                  style={{ textTransform: 'uppercase' }}
                >
                  WIN
                </text>
              </svg>
            </div>
          </div>

          <div className="hero-card-chart-footer">
            <span className="hero-card-foot-txt">
              <strong>{winTrades}</strong> Wins vs <strong>{looseTrades}</strong> Losses
            </span>
          </div>
        </div>

        {/* 3. WINNING VS LOOSE TRADES CARD (WITH SPLIT BAR GRAPH) */}
        <div className="hero-card hero-card-ratio">
          <div className="hero-card-header">
            <div className="hero-card-icon-wrap split">
              <Flame size={18} />
            </div>
            <div>
              <span className="hero-card-label">WINNING VS LOOSE TRADES</span>
              <p className="hero-card-sublabel">Trade Distribution Ratio</p>
            </div>
          </div>

          <div className="hero-card-body">
            <div className="hero-split-numbers">
              <div className="split-num-block profit">
                <span className="split-count">{winTrades}</span>
                <span className="split-label">Wins</span>
              </div>
              <div className="split-divider">:</div>
              <div className="split-num-block loss">
                <span className="split-count">{looseTrades}</span>
                <span className="split-label">Loose Trades</span>
              </div>
              {beTrades > 0 && (
                <>
                  <div className="split-divider">:</div>
                  <div className="split-num-block neutral">
                    <span className="split-count">{beTrades}</span>
                    <span className="split-label">BE</span>
                  </div>
                </>
              )}
            </div>

            {/* Visual Ratio Segmented Graph */}
            <div className="hero-ratio-graph-wrap">
              <div className="ratio-bar-track">
                <div
                  className="ratio-segment win"
                  style={{ width: `${Math.max(6, winRate)}%` }}
                  title={`${winTrades} Winning Trades (${winRate.toFixed(1)}%)`}
                >
                  <span className="ratio-segment-text">{winTrades}W</span>
                </div>
                <div
                  className="ratio-segment loss"
                  style={{ width: `${Math.max(6, lossRate)}%` }}
                  title={`${looseTrades} Loose Trades (${lossRate.toFixed(1)}%)`}
                >
                  <span className="ratio-segment-text">{looseTrades}L</span>
                </div>
              </div>

              <div className="ratio-labels-row">
                <span className="ratio-badge green">{(winRate).toFixed(0)}% Win Rate</span>
                <span className="ratio-badge red">{(lossRate).toFixed(0)}% Loose Rate</span>
              </div>
            </div>
          </div>

          <div className="hero-card-chart-footer">
            <span className="hero-card-foot-txt">
              Win/Loss Ratio: <strong>{looseTrades > 0 ? (winTrades / looseTrades).toFixed(2) : winTrades} : 1.00</strong>
            </span>
          </div>
        </div>

        {/* 4. NET PIPS & PERFORMANCE CARD */}
        <div className="hero-card hero-card-pnl">
          <div className="hero-card-header">
            <div className={`hero-card-icon-wrap ${totalPipsVal >= 0 ? 'positive' : 'negative'}`}>
              <TrendingUp size={18} />
            </div>
            <div>
              <span className="hero-card-label">NET PIPS PERFORMANCE</span>
              <p className="hero-card-sublabel">Pips Gain vs Loose Pips</p>
            </div>
          </div>

          <div className="hero-card-body">
            <div className={`hero-metric-huge ${totalPipsVal >= 0 ? 'text-profit' : 'text-loss'}`}>
              {totalPipsVal >= 0 ? '+' : ''}{totalPipsVal} <span style={{ fontSize: '0.82rem', fontWeight: '700' }}>PIPS</span>
            </div>
            <div className="hero-pnl-breakdown">
              <span className="pnl-pill win" title="Total Pips Gained on Winning Trades">
                Gain: +{pipsGainVal} pips
              </span>
              <span className="pnl-pill loss" title="Total Loose Pips on Losing Trades">
                Loose: -{loosePipsVal} pips
              </span>
            </div>
          </div>

          <div className="hero-card-chart-footer">
            <span className="hero-card-foot-txt">
              Avg/Trade: <strong>{totalTrades > 0 ? (totalPipsVal / totalTrades).toFixed(1) : 0} pips</strong> • Total Alpha: <strong>{totalR >= 0 ? '+' : ''}{totalR.toFixed(1)}R</strong>
            </span>
          </div>
        </div>

      </div>

      {/* AESTHETIC TRADING CHART BACKGROUND / DISPLAY CANVAS */}
      <div className="hero-chart-stage">
        
        {/* Live HUD ticker row above chart */}
        <div className="chart-hud-overlay">
          <div className="hud-data-items">
            <div className="hud-item">
              <span className="hud-k">PAIR</span>
              <span className="hud-v cyan">EURUSD</span>
            </div>
            <div className="hud-item">
              <span className="hud-k">TF</span>
              <span className="hud-v">1H</span>
            </div>
            <div className="hud-item hide-on-mobile">
              <span className="hud-k">EMA 9</span>
              <span className="hud-v cyan">{candles[candles.length - 1]?.close}</span>
            </div>
            <div className="hud-item hide-on-mobile">
              <span className="hud-k">EMA 21</span>
              <span className="hud-v purple">{candles[candles.length - 4]?.open}</span>
            </div>
            {hoveredCandle && (
              <div className="hud-hovered-item">
                <span className="hud-k">HOVER:</span>
                <span className="hud-v">
                  O: {hoveredCandle.open} | H: {hoveredCandle.high} | L: {hoveredCandle.low} | C: {hoveredCandle.close}
                </span>
              </div>
            )}
            {hoveredPoint && (
              <div className="hud-hovered-item">
                <span className="hud-k">TRADE {hoveredPoint.tradeIndex}:</span>
                <span className={`hud-v ${hoveredPoint.cumulativeR >= 0 ? 'text-profit' : 'text-loss'}`}>
                  {hoveredPoint.tradeName} ({hoveredPoint.cumulativeR >= 0 ? '+' : ''}{hoveredPoint.cumulativeR.toFixed(2)}R)
                </span>
              </div>
            )}
          </div>

          <div className="chart-hud-tag">
            <Crosshair size={12} />
            <span>INSTITUTIONAL LIQUIDITY FEED</span>
          </div>
        </div>

        {/* 1. CANDLESTICK VIEW MODE */}
        {chartMode === 'candlestick' ? (
          <div className="svg-chart-container">
            <svg
              viewBox={`0 0 ${candleChartWidth} ${candleChartHeight}`}
              className="aesthetic-trading-svg"
              onMouseLeave={() => setHoveredCandle(null)}
            >
              <defs>
                {/* Candle Gradients */}
                <linearGradient id="bullGlow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00f59b" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#00c878" stopOpacity="0.7" />
                </linearGradient>
                <linearGradient id="bearGlow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ff3366" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#d61f4d" stopOpacity="0.7" />
                </linearGradient>

                <linearGradient id="volBullGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00f59b" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#00f59b" stopOpacity="0.05" />
                </linearGradient>
                <linearGradient id="volBearGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ff3366" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#ff3366" stopOpacity="0.05" />
                </linearGradient>

                <filter id="candleNeon" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Horizontal Price Grid Lines */}
              {[0, 0.25, 0.5, 0.75, 1.0].map((frac, idx) => {
                const y = candlePadY + candleGHeight * frac;
                const priceVal = (maxPrice - frac * priceRange).toFixed(5);
                return (
                  <g key={idx}>
                    <line
                      x1={candlePadX}
                      y1={y}
                      x2={candleChartWidth - candlePadX}
                      y2={y}
                      stroke="rgba(255, 255, 255, 0.05)"
                      strokeDasharray="4 4"
                      strokeWidth="1"
                    />
                    <text
                      x={candleChartWidth - candlePadX + 8}
                      y={y + 4}
                      fill="var(--text-dim)"
                      fontSize="9.5"
                      fontFamily="var(--font-mono)"
                    >
                      {priceVal}
                    </text>
                  </g>
                );
              })}

              {/* Vertical Time Grid Lines */}
              {[4, 10, 16, 22].map((ci) => {
                const x = candlePadX + ci * candleStep + candleStep / 2;
                return (
                  <line
                    key={ci}
                    x1={x}
                    y1={candlePadY}
                    x2={x}
                    y2={candlePadY + candleGHeight + 35}
                    stroke="rgba(255, 255, 255, 0.04)"
                    strokeWidth="1"
                  />
                );
              })}

              {/* Bottom Volume Bars */}
              {candles.map((c, i) => {
                const x = candlePadX + i * candleStep + (candleStep - candleBarWidth) / 2;
                const maxVol = 12000;
                const volHeight = Math.min(32, (c.volume / maxVol) * 32);
                const volY = candleChartHeight - 8 - volHeight;
                return (
                  <rect
                    key={`vol-${c.id}`}
                    x={x}
                    y={volY}
                    width={candleBarWidth}
                    height={volHeight}
                    fill={c.isBull ? 'url(#volBullGrad)' : 'url(#volBearGrad)'}
                    rx="1"
                  />
                );
              })}

              {/* 9 EMA and 21 EMA Spline Curves */}
              <path
                d={ema21Path}
                fill="none"
                stroke="rgba(157, 78, 221, 0.55)"
                strokeWidth="1.6"
              />
              <path
                d={ema9Path}
                fill="none"
                stroke="rgba(0, 210, 255, 0.75)"
                strokeWidth="1.8"
                filter="url(#candleNeon)"
              />

              {/* Candlesticks (Wicks + Bodies) */}
              {candles.map((c, i) => {
                const centerX = candlePadX + i * candleStep + candleStep / 2;
                const barX = centerX - candleBarWidth / 2;
                const highY = getPriceY(c.high);
                const lowY = getPriceY(c.low);
                const openY = getPriceY(c.open);
                const closeY = getPriceY(c.close);
                const bodyY = Math.min(openY, closeY);
                const bodyHeight = Math.max(3, Math.abs(openY - closeY));
                const isBull = c.isBull;

                return (
                  <g
                    key={`candle-${c.id}`}
                    className="candle-group"
                    onMouseEnter={() => setHoveredCandle(c)}
                  >
                    {/* Wick Line */}
                    <line
                      x1={centerX}
                      y1={highY}
                      x2={centerX}
                      y2={lowY}
                      stroke={isBull ? '#00f59b' : '#ff3366'}
                      strokeWidth="1.2"
                      opacity="0.85"
                    />

                    {/* Candle Body */}
                    <rect
                      x={barX}
                      y={bodyY}
                      width={candleBarWidth}
                      height={bodyHeight}
                      fill={isBull ? 'url(#bullGlow)' : 'url(#bearGlow)'}
                      rx="1.5"
                      stroke={isBull ? '#00f59b' : '#ff3366'}
                      strokeWidth="0.8"
                    />
                  </g>
                );
              })}
            </svg>
          </div>
        ) : (
          /* 2. PIPS TRAJECTORY VIEW MODE */
          <div className="svg-chart-container" style={{ position: 'relative' }}>
            <svg
              viewBox={`0 0 ${cWidth} ${cHeight}`}
              className="aesthetic-trading-svg"
              onMouseLeave={() => setHoveredPoint(null)}
            >
              <defs>
                <linearGradient id="heroEquityFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00d2ff" stopOpacity="0.28" />
                  <stop offset="60%" stopColor="#00d2ff" stopOpacity="0.06" />
                  <stop offset="100%" stopColor="#00d2ff" stopOpacity="0.0" />
                </linearGradient>

                <filter id="equityLineGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="1" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Zero Reference Line */}
              <line
                x1={padX}
                y1={zeroLineY}
                x2={cWidth - padX}
                y2={zeroLineY}
                stroke="rgba(255, 255, 255, 0.18)"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
              <text
                x={padX - 10}
                y={zeroLineY + 4}
                fill="var(--text-muted)"
                fontSize="10"
                fontFamily="var(--font-mono)"
                textAnchor="end"
              >
                0 Pips
              </text>

              {/* Top Reference Line */}
              {maxPips > 0 && (
                <>
                  <line
                    x1={padX}
                    y1={getEqY(maxPips)}
                    x2={cWidth - padX}
                    y2={getEqY(maxPips)}
                    stroke="rgba(0, 245, 155, 0.12)"
                    strokeWidth="1"
                  />
                  <text
                    x={padX - 10}
                    y={getEqY(maxPips) + 4}
                    fill="var(--profit)"
                    fontSize="10"
                    fontFamily="var(--font-mono)"
                    textAnchor="end"
                  >
                    +{Math.round(maxPips)} Pips
                  </text>
                </>
              )}

              {/* Bottom Reference Line */}
              {minPips < 0 && (
                <>
                  <line
                    x1={padX}
                    y1={getEqY(minPips)}
                    x2={cWidth - padX}
                    y2={getEqY(minPips)}
                    stroke="rgba(255, 51, 102, 0.12)"
                    strokeWidth="1"
                  />
                  <text
                    x={padX - 10}
                    y={getEqY(minPips) + 4}
                    fill="var(--loss)"
                    fontSize="10"
                    fontFamily="var(--font-mono)"
                    textAnchor="end"
                  >
                    {Math.round(minPips)} Pips
                  </text>
                </>
              )}

              {/* Area Gradient Fill */}
              <path
                d={heroPipsAreaPathD}
                fill="url(#heroEquityFill)"
              />

              {/* Thin Blue Smooth Line */}
              <path
                d={heroPipsPathD}
                fill="none"
                stroke="#00d2ff"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="url(#equityLineGlow)"
              />

              {/* Trade Points */}
              {pipsPoints.map((p, i) => {
                const cx = getEqX(i);
                const cy = getEqY(p.cumulativePips);
                const isGain = p.pips > 0;
                const isLoss = p.pips < 0;
                return (
                  <circle
                    key={i}
                    cx={cx}
                    cy={cy}
                    r={hoveredPoint === p ? 6 : 3.8}
                    fill={isGain ? '#00f59b' : isLoss ? '#ff3366' : '#00d2ff'}
                    stroke="#04080e"
                    strokeWidth="2"
                    style={{ cursor: 'pointer', transition: 'r 0.2s' }}
                    onMouseEnter={() => setHoveredPoint(p)}
                  />
                );
              })}
            </svg>

            {/* Hover Tooltip Overlay for Hero Pips Curve */}
            {hoveredPoint && (
              <div
                style={{
                  position: 'absolute',
                  top: '12px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'rgba(8, 15, 24, 0.95)',
                  border: '1px solid var(--border-bright)',
                  borderRadius: '10px',
                  padding: '8px 16px',
                  boxShadow: '0 8px 30px rgba(0,0,0,0.6)',
                  pointerEvents: 'none',
                  display: 'flex',
                  gap: '16px',
                  alignItems: 'center',
                  backdropFilter: 'blur(10px)',
                  zIndex: 20
                }}
              >
                <div>
                  <span style={{ fontSize: '0.82rem', fontWeight: '800', color: '#fff' }}>
                    {hoveredPoint.tradeName || 'Trade'}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '6px' }}>
                    {hoveredPoint.date}
                  </span>
                </div>
                <div style={{ borderLeft: '1px solid var(--border-medium)', paddingLeft: '12px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: '800', fontFamily: 'var(--font-mono)', color: hoveredPoint.pips > 0 ? 'var(--profit)' : hoveredPoint.pips < 0 ? 'var(--loss)' : 'var(--text-muted)' }}>
                    {hoveredPoint.pips > 0 ? `+${hoveredPoint.pips} Pips (Gain)` : hoveredPoint.pips < 0 ? `${hoveredPoint.pips} Pips (Loose)` : '0 Pips'}
                  </span>
                </div>
                <div style={{ borderLeft: '1px solid var(--border-medium)', paddingLeft: '12px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: '800', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
                    Total: {hoveredPoint.cumulativePips >= 0 ? '+' : ''}{hoveredPoint.cumulativePips} Pips
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* PROMPT TO SCROLL DOWN TO REMAINING DETAILED DASHBOARD */}
      <div className="hero-scroll-prompt" onClick={scrollToAnalytics}>
        <div className="scroll-pill">
          <span>Scroll to explore 20+ Statistical KPIs, Performance Reviews & Complete Trade Ledger</span>
          <ChevronDown size={14} className="bounce-arrow" />
        </div>
      </div>
    </div>
  );
};
