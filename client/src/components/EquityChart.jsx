import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  DollarSign,
  Layers,
  Sparkles,
  Calendar,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { createSmoothPathD, createSmoothAreaPathD } from '../utils/smoothPath';

const formatUSDMetric = (num, forceSign = true) => {
  if (num === null || num === undefined || isNaN(num)) return '$0';
  const n = Number(num);
  const sign = forceSign ? (n > 0 ? '+' : n < 0 ? '-' : '') : (n < 0 ? '-' : '');
  const abs = Math.abs(n);
  if (abs >= 1000000) {
    return `${sign}$${(abs / 1000000).toFixed(2).replace(/\.00$/, '')}M`;
  }
  if (abs >= 10000) {
    return `${sign}$${(abs / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  }
  return `${sign}$${abs.toLocaleString('en-US')}`;
};

const getPointTakeProfitUSD = (p) => {
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

export const EquityChart = ({ curve = [] }) => {
  const [hoveredPipsPoint, setHoveredPipsPoint] = useState(null);
  const [hoveredProfitPoint, setHoveredProfitPoint] = useState(null);
  const [pipsTimeframe, setPipsTimeframe] = useState('ALL');
  const [profitTimeframe, setProfitTimeframe] = useState('ALL');
  const [isSmooth, setIsSmooth] = useState(true);

  // Mouse / Touch Dragging State for Panning
  const [isPipsDragging, setIsPipsDragging] = useState(false);
  const pipsDragRef = useRef(null);

  const [isProfitDragging, setIsProfitDragging] = useState(false);
  const profitDragRef = useRef(null);

  // SVG Refs for Non-Passive Wheel Event Listeners (stops page scroll during chart wheel zoom)
  const pipsSvgRef = useRef(null);
  const profitSvgRef = useRef(null);

  // Zoom range indices states
  const [pipsZoom, setPipsZoom] = useState({ start: 0, end: 0 });
  const [profitZoom, setProfitZoom] = useState({ start: 0, end: 0 });

  // Helper to parse trade timestamps consistently
  const getTradeTimestamp = (p) => {
    if (!p?.date) return 0;
    try {
      const timePart = p.time && /^\d{1,2}:\d{2}/.test(p.time) ? p.time : '12:00';
      const parsed = new Date(`${p.date}T${timePart}:00`).getTime();
      if (!isNaN(parsed) && parsed > 0) return parsed;
      const fallback = new Date(p.date).getTime();
      return !isNaN(fallback) && fallback > 0 ? fallback : 0;
    } catch {
      return 0;
    }
  };

  // Dynamic timeframes based on real-time current date
  const dynamicTimeframes = useMemo(() => {
    if (!curve || curve.length === 0) {
      return [{ id: 'ALL', label: 'ALL', count: 0, disabled: false }];
    }

    const now = Date.now();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfTodayTs = startOfToday.getTime();

    const timestamps = curve.map(getTradeTimestamp).filter(t => t > 0);
    const countAll = timestamps.length;

    const count1D = timestamps.filter(t => t >= startOfTodayTs).length;
    const count7D = timestamps.filter(t => t >= now - 7 * 86400000).length;
    const count30D = timestamps.filter(t => t >= now - 30 * 86400000).length;
    const count90D = timestamps.filter(t => t >= now - 90 * 86400000).length;

    return [
      { id: '1D', label: '1D', count: count1D, disabled: false },
      { id: '7D', label: '7D', count: count7D, disabled: false },
      { id: '30D', label: '30D', count: count30D, disabled: false },
      { id: '90D', label: '90D', count: count90D, disabled: false },
      { id: 'ALL', label: 'ALL', count: countAll, disabled: false }
    ];
  }, [curve]);

  useEffect(() => {
    const currentTf = dynamicTimeframes.find(t => t.id === pipsTimeframe);
    if (!currentTf) {
      setPipsTimeframe('ALL');
    }
  }, [dynamicTimeframes, pipsTimeframe]);

  useEffect(() => {
    const currentTf = dynamicTimeframes.find(t => t.id === profitTimeframe);
    if (!currentTf) {
      setProfitTimeframe('ALL');
    }
  }, [dynamicTimeframes, profitTimeframe]);

  // Process data for a given timeframe
  const processCurveForTimeframe = (rawCurve, tf) => {
    if (!rawCurve.length) return [];

    let filtered = [...rawCurve];

    if (tf !== 'ALL') {
      const now = Date.now();
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const startOfTodayTs = startOfToday.getTime();

      let cutoff = 0;
      if (tf === '1D') cutoff = startOfTodayTs;
      else if (tf === '7D') cutoff = now - 7 * 86400000;
      else if (tf === '30D') cutoff = now - 30 * 86400000;
      else if (tf === '90D') cutoff = now - 90 * 86400000;

      filtered = rawCurve.filter(p => getTradeTimestamp(p) >= cutoff);
    }

    if (filtered.length === 0) return [];

    let runningPips = 0;
    let runningProfit = 0;

    return filtered.map((p, idx) => {
      let rawPips = Number(p.pips !== undefined && p.pips !== null ? p.pips : 0);
      if (isNaN(rawPips)) rawPips = 0;
      if (p.result === 'LOSS' && rawPips > 0) rawPips = -rawPips;
      else if (p.result === 'WIN' && rawPips < 0) rawPips = Math.abs(rawPips);
      else if (p.result === 'BE') rawPips = 0;

      const rawProfit = getPointTakeProfitUSD(p);

      runningPips += rawPips;
      runningProfit += rawProfit;

      return {
        ...p,
        tradeIndex: idx + 1,
        pips: Number(rawPips.toFixed(1)),
        pipsGain: rawPips > 0 ? Number(rawPips.toFixed(1)) : 0,
        loosePips: rawPips < 0 ? Number(Math.abs(rawPips).toFixed(1)) : 0,
        cumulativePips: Number(runningPips.toFixed(1)),

        profitUSD: Math.round(rawProfit),
        profitGainUSD: rawProfit > 0 ? Math.round(rawProfit) : 0,
        looseProfitUSD: rawProfit < 0 ? Math.abs(Math.round(rawProfit)) : 0,
        cumulativeProfitUSD: Math.round(runningProfit)
      };
    });
  };

  const processedPipsData = useMemo(() => processCurveForTimeframe(curve, pipsTimeframe), [curve, pipsTimeframe]);
  const processedProfitData = useMemo(() => processCurveForTimeframe(curve, profitTimeframe), [curve, profitTimeframe]);

  // Baseline data points starting at 0 Pips / $0
  const pipsDataPoints = useMemo(() => [
    {
      tradeIndex: 0,
      date: processedPipsData[0]?.date || 'Start',
      tradeName: 'Starting Balance',
      instrument: 'Baseline',
      result: 'BE',
      pips: 0,
      pipsGain: 0,
      loosePips: 0,
      cumulativePips: 0,
      profitUSD: 0,
      profitGainUSD: 0,
      looseProfitUSD: 0,
      cumulativeProfitUSD: 0
    },
    ...processedPipsData
  ], [processedPipsData]);

  const profitDataPoints = useMemo(() => [
    {
      tradeIndex: 0,
      date: processedProfitData[0]?.date || 'Start',
      tradeName: 'Starting Balance',
      instrument: 'Baseline',
      result: 'BE',
      pips: 0,
      pipsGain: 0,
      loosePips: 0,
      cumulativePips: 0,
      profitUSD: 0,
      profitGainUSD: 0,
      looseProfitUSD: 0,
      cumulativeProfitUSD: 0
    },
    ...processedProfitData
  ], [processedProfitData]);

  // Reset zoom indices when underlying dataset changes
  useEffect(() => {
    if (pipsDataPoints.length > 0) {
      setPipsZoom({ start: 0, end: pipsDataPoints.length - 1 });
    }
  }, [pipsDataPoints.length, pipsTimeframe]);

  useEffect(() => {
    if (profitDataPoints.length > 0) {
      setProfitZoom({ start: 0, end: profitDataPoints.length - 1 });
    }
  }, [profitDataPoints.length, profitTimeframe]);

  // Visible sliced data points according to zoom state
  const visiblePipsDataPoints = useMemo(() => {
    if (!pipsDataPoints.length) return [];
    const s = Math.max(0, Math.min(pipsZoom.start, pipsDataPoints.length - 1));
    const e = Math.max(s, Math.min(pipsZoom.end, pipsDataPoints.length - 1));
    return pipsDataPoints.slice(s, e + 1);
  }, [pipsDataPoints, pipsZoom]);

  const visibleProfitDataPoints = useMemo(() => {
    if (!profitDataPoints.length) return [];
    const s = Math.max(0, Math.min(profitZoom.start, profitDataPoints.length - 1));
    const e = Math.max(s, Math.min(profitZoom.end, profitDataPoints.length - 1));
    return profitDataPoints.slice(s, e + 1);
  }, [profitDataPoints, profitZoom]);

  // Pips Zoom Handlers
  const handlePipsZoomIn = useCallback(() => {
    setPipsZoom(prev => {
      const len = prev.end - prev.start + 1;
      if (len <= 4) return prev;
      const step = Math.max(1, Math.floor(len * 0.2));
      const ns = Math.min(prev.start + step, prev.end - 3);
      const ne = Math.max(prev.end - step, ns + 3);
      return { start: ns, end: ne };
    });
  }, []);

  const handlePipsZoomOut = useCallback(() => {
    setPipsZoom(prev => {
      const maxEnd = pipsDataPoints.length - 1;
      const len = prev.end - prev.start + 1;
      if (prev.start === 0 && prev.end === maxEnd) return prev;
      const step = Math.max(1, Math.floor(len * 0.25));
      const ns = Math.max(0, prev.start - step);
      const ne = Math.min(maxEnd, prev.end + step);
      return { start: ns, end: ne };
    });
  }, [pipsDataPoints.length]);

  const handlePipsResetZoom = useCallback(() => {
    setPipsZoom({ start: 0, end: pipsDataPoints.length - 1 });
  }, [pipsDataPoints.length]);

  const handlePipsPanBy = useCallback((indexDelta) => {
    setPipsZoom(prev => {
      const maxIndex = pipsDataPoints.length - 1;
      if (maxIndex <= 0) return prev;
      const winSize = prev.end - prev.start;
      if (winSize >= maxIndex) return prev;

      let newStart = prev.start + indexDelta;
      let newEnd = prev.end + indexDelta;

      if (newStart < 0) {
        newStart = 0;
        newEnd = winSize;
      }
      if (newEnd > maxIndex) {
        newEnd = maxIndex;
        newStart = Math.max(0, maxIndex - winSize);
      }

      return { start: newStart, end: newEnd };
    });
  }, [pipsDataPoints.length]);

  // Profit Zoom Handlers
  const handleProfitZoomIn = useCallback(() => {
    setProfitZoom(prev => {
      const len = prev.end - prev.start + 1;
      if (len <= 4) return prev;
      const step = Math.max(1, Math.floor(len * 0.2));
      const ns = Math.min(prev.start + step, prev.end - 3);
      const ne = Math.max(prev.end - step, ns + 3);
      return { start: ns, end: ne };
    });
  }, []);

  const handleProfitZoomOut = useCallback(() => {
    setProfitZoom(prev => {
      const maxEnd = profitDataPoints.length - 1;
      const len = prev.end - prev.start + 1;
      if (prev.start === 0 && prev.end === maxEnd) return prev;
      const step = Math.max(1, Math.floor(len * 0.25));
      const ns = Math.max(0, prev.start - step);
      const ne = Math.min(maxEnd, prev.end + step);
      return { start: ns, end: ne };
    });
  }, [profitDataPoints.length]);

  const handleProfitResetZoom = useCallback(() => {
    setProfitZoom({ start: 0, end: profitDataPoints.length - 1 });
  }, [profitDataPoints.length]);

  const handleProfitPanBy = useCallback((indexDelta) => {
    setProfitZoom(prev => {
      const maxIndex = profitDataPoints.length - 1;
      if (maxIndex <= 0) return prev;
      const winSize = prev.end - prev.start;
      if (winSize >= maxIndex) return prev;

      let newStart = prev.start + indexDelta;
      let newEnd = prev.end + indexDelta;

      if (newStart < 0) {
        newStart = 0;
        newEnd = winSize;
      }
      if (newEnd > maxIndex) {
        newEnd = maxIndex;
        newStart = Math.max(0, maxIndex - winSize);
      }

      return { start: newStart, end: newEnd };
    });
  }, [profitDataPoints.length]);

  // Interactive Drag Panning Handlers for Pips Chart
  const handlePipsPointerDown = useCallback((e) => {
    if (pipsZoom.start === 0 && pipsZoom.end === pipsDataPoints.length - 1) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    setIsPipsDragging(true);
    pipsDragRef.current = {
      startX: clientX,
      startZoom: { ...pipsZoom }
    };
  }, [pipsZoom, pipsDataPoints.length]);

  const handlePipsPointerMove = useCallback((e) => {
    if (!isPipsDragging || !pipsDragRef.current) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const dx = clientX - pipsDragRef.current.startX;

    const graphW = 880 - 64 * 2;
    const winSize = pipsDragRef.current.startZoom.end - pipsDragRef.current.startZoom.start;
    if (winSize <= 0) return;

    const pixelsPerTrade = graphW / winSize;
    const tradeOffset = Math.round(-dx / pixelsPerTrade);

    const maxIndex = pipsDataPoints.length - 1;
    let newStart = pipsDragRef.current.startZoom.start + tradeOffset;
    let newEnd = pipsDragRef.current.startZoom.end + tradeOffset;

    if (newStart < 0) {
      newStart = 0;
      newEnd = winSize;
    }
    if (newEnd > maxIndex) {
      newEnd = maxIndex;
      newStart = Math.max(0, maxIndex - winSize);
    }

    setPipsZoom({ start: newStart, end: newEnd });
  }, [isPipsDragging, pipsDataPoints.length]);

  const handlePipsPointerUp = useCallback(() => {
    setIsPipsDragging(false);
    pipsDragRef.current = null;
  }, []);

  // Interactive Drag Panning Handlers for Profit Chart
  const handleProfitPointerDown = useCallback((e) => {
    if (profitZoom.start === 0 && profitZoom.end === profitDataPoints.length - 1) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    setIsProfitDragging(true);
    profitDragRef.current = {
      startX: clientX,
      startZoom: { ...profitZoom }
    };
  }, [profitZoom, profitDataPoints.length]);

  const handleProfitPointerMove = useCallback((e) => {
    if (!isProfitDragging || !profitDragRef.current) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const dx = clientX - profitDragRef.current.startX;

    const graphW = 880 - 64 * 2;
    const winSize = profitDragRef.current.startZoom.end - profitDragRef.current.startZoom.start;
    if (winSize <= 0) return;

    const pixelsPerTrade = graphW / winSize;
    const tradeOffset = Math.round(-dx / pixelsPerTrade);

    const maxIndex = profitDataPoints.length - 1;
    let newStart = profitDragRef.current.startZoom.start + tradeOffset;
    let newEnd = profitDragRef.current.startZoom.end + tradeOffset;

    if (newStart < 0) {
      newStart = 0;
      newEnd = winSize;
    }
    if (newEnd > maxIndex) {
      newEnd = maxIndex;
      newStart = Math.max(0, maxIndex - winSize);
    }

    setProfitZoom({ start: newStart, end: newEnd });
  }, [isProfitDragging, profitDataPoints.length]);

  const handleProfitPointerUp = useCallback(() => {
    setIsProfitDragging(false);
    profitDragRef.current = null;
  }, []);

  // Global mouse release safety
  useEffect(() => {
    const handleGlobalRelease = () => {
      setIsPipsDragging(false);
      pipsDragRef.current = null;
      setIsProfitDragging(false);
      profitDragRef.current = null;
    };
    window.addEventListener('mouseup', handleGlobalRelease);
    window.addEventListener('touchend', handleGlobalRelease);
    return () => {
      window.removeEventListener('mouseup', handleGlobalRelease);
      window.removeEventListener('touchend', handleGlobalRelease);
    };
  }, []);

  // Wheel event listener (Zoom in/out + Pan Left/Right with Shift/Trackpad)
  useEffect(() => {
    const el = pipsSvgRef.current;
    if (!el) return;

    const onWheel = (e) => {
      e.preventDefault();
      e.stopPropagation();

      const absX = Math.abs(e.deltaX);
      const absY = Math.abs(e.deltaY);

      if (e.shiftKey || absX > absY) {
        const delta = (e.deltaX || e.deltaY) > 0 ? 1 : -1;
        handlePipsPanBy(delta);
      } else {
        if (e.deltaY < 0) {
          handlePipsZoomIn();
        } else if (e.deltaY > 0) {
          handlePipsZoomOut();
        }
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [handlePipsZoomIn, handlePipsZoomOut, handlePipsPanBy]);

  useEffect(() => {
    const el = profitSvgRef.current;
    if (!el) return;

    const onWheel = (e) => {
      e.preventDefault();
      e.stopPropagation();

      const absX = Math.abs(e.deltaX);
      const absY = Math.abs(e.deltaY);

      if (e.shiftKey || absX > absY) {
        const delta = (e.deltaX || e.deltaY) > 0 ? 1 : -1;
        handleProfitPanBy(delta);
      } else {
        if (e.deltaY < 0) {
          handleProfitZoomIn();
        } else if (e.deltaY > 0) {
          handleProfitZoomOut();
        }
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [handleProfitZoomIn, handleProfitZoomOut, handleProfitPanBy]);

  if (!curve || curve.length === 0) {
    return (
      <div className="dashboard-panel">
        <div className="panel-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={20} color="var(--profit)" />
            <h3>Pips and Profit Trajectory</h3>
          </div>
        </div>
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '50px 0' }}>
          No closed trades yet to generate trajectory curves. Add trades to track cumulative pips and USD profit performance.
        </p>
      </div>
    );
  }

  // 1. Pips HUD statistics
  const totalPipsGain = Number(processedPipsData.reduce((sum, p) => sum + (p.pipsGain || 0), 0).toFixed(1));
  const totalLoosePips = Number(processedPipsData.reduce((sum, p) => sum + (p.loosePips || 0), 0).toFixed(1));
  const netPips = Number((processedPipsData[processedPipsData.length - 1]?.cumulativePips ?? 0).toFixed(1));
  const isPipsProfitable = netPips >= 0;
  const validCumPipsValsFull = pipsDataPoints.map(p => Number(p.cumulativePips) || 0);
  const peakPips = Math.max(0, ...validCumPipsValsFull);

  let maxPipsDD = 0;
  let runningPeakPips = 0;
  for (const p of pipsDataPoints) {
    const val = Number(p.cumulativePips) || 0;
    if (val > runningPeakPips) runningPeakPips = val;
    const dd = runningPeakPips - val;
    if (dd > maxPipsDD) maxPipsDD = dd;
  }

  // 2. Profit USD HUD statistics
  const totalGrossProfitUSD = processedProfitData.reduce((sum, p) => sum + (p.profitGainUSD || 0), 0);
  const totalGrossLossUSD = processedProfitData.reduce((sum, p) => sum + (p.looseProfitUSD || 0), 0);
  const netProfitUSD = processedProfitData[processedProfitData.length - 1]?.cumulativeProfitUSD ?? 0;
  const isProfitUSDProfitable = netProfitUSD >= 0;
  const validCumProfitValsFull = profitDataPoints.map(p => Number(p.cumulativeProfitUSD) || 0);
  const peakProfitUSD = Math.max(0, ...validCumProfitValsFull);

  let maxProfitDD = 0;
  let runningPeakProfit = 0;
  for (const p of profitDataPoints) {
    const val = Number(p.cumulativeProfitUSD) || 0;
    if (val > runningPeakProfit) runningPeakProfit = val;
    const dd = runningPeakProfit - val;
    if (dd > maxProfitDD) maxProfitDD = dd;
  }

  // Chart Canvas Dimensions
  const width = 880;
  const height = 340;
  const paddingX = 64;
  const paddingY = 44;
  const graphWidth = width - paddingX * 2;
  const graphHeight = height - paddingY * 2;

  // Dynamic X-Scales based on visible dataset
  const getXPips = (index) => paddingX + (index / (visiblePipsDataPoints.length - 1 || 1)) * graphWidth;
  const getXProfit = (index) => paddingX + (index / (visibleProfitDataPoints.length - 1 || 1)) * graphWidth;

  // Pips Y-Scale Math (Autoscaled over visible points)
  const validCumPipsVals = visiblePipsDataPoints.map(p => Number(p.cumulativePips) || 0);
  const allPipsVals = [...validCumPipsVals, ...visiblePipsDataPoints.map(p => Number(p.pips) || 0)];
  const minPipsVal = Math.min(0, ...allPipsVals);
  const maxPipsVal = Math.max(10, ...allPipsVals);
  const pipsPadding = Math.max(10, (maxPipsVal - minPipsVal) * 0.12);
  const chartMinPips = minPipsVal - pipsPadding;
  const chartMaxPips = maxPipsVal + pipsPadding;
  const rangePips = (chartMaxPips - chartMinPips) || 1;

  const getPipsY = (val) => {
    const safeVal = Number(val) || 0;
    return paddingY + graphHeight - ((safeVal - chartMinPips) / rangePips) * graphHeight;
  };

  const pipsZeroY = getPipsY(0);
  const pipsCoordPoints = useMemo(() => {
    return visiblePipsDataPoints.map((p, i) => ({
      x: getXPips(i),
      y: getPipsY(p.cumulativePips)
    }));
  }, [visiblePipsDataPoints, getXPips, getPipsY]);

  const pipsPathD = useMemo(() => createSmoothPathD(pipsCoordPoints, isSmooth ? 0.22 : 0), [pipsCoordPoints, isSmooth]);
  const pipsAreaPathD = useMemo(() => createSmoothAreaPathD(pipsCoordPoints, pipsZeroY, isSmooth ? 0.22 : 0), [pipsCoordPoints, pipsZeroY, isSmooth]);

  // Intermediate Horizontal Grid Ticks for Pips Chart
  const pipsGridTicks = useMemo(() => {
    const count = 5;
    const step = (chartMaxPips - chartMinPips) / count;
    return Array.from({ length: count + 1 }, (_, i) => chartMinPips + i * step);
  }, [chartMinPips, chartMaxPips]);

  // Profit USD Y-Scale Math (Autoscaled over visible points)
  const validCumProfitVals = visibleProfitDataPoints.map(p => Number(p.cumulativeProfitUSD) || 0);
  const allProfitVals = [...validCumProfitVals, ...visibleProfitDataPoints.map(p => Number(p.profitUSD) || 0)];
  const minProfitVal = Math.min(0, ...allProfitVals);
  const maxProfitVal = Math.max(100, ...allProfitVals);
  const profitPadding = Math.max(50, (maxProfitVal - minProfitVal) * 0.12);
  const chartMinProfit = minProfitVal - profitPadding;
  const chartMaxProfit = maxProfitVal + profitPadding;
  const rangeProfit = (chartMaxProfit - chartMinProfit) || 1;

  const getProfitY = (val) => {
    const safeVal = Number(val) || 0;
    return paddingY + graphHeight - ((safeVal - chartMinProfit) / rangeProfit) * graphHeight;
  };

  const profitZeroY = getProfitY(0);
  const profitCoordPoints = useMemo(() => {
    return visibleProfitDataPoints.map((p, i) => ({
      x: getXProfit(i),
      y: getProfitY(p.cumulativeProfitUSD)
    }));
  }, [visibleProfitDataPoints, getXProfit, getProfitY]);

  const profitPathD = useMemo(() => createSmoothPathD(profitCoordPoints, isSmooth ? 0.22 : 0), [profitCoordPoints, isSmooth]);
  const profitAreaPathD = useMemo(() => createSmoothAreaPathD(profitCoordPoints, profitZeroY, isSmooth ? 0.22 : 0), [profitCoordPoints, profitZeroY, isSmooth]);

  // Intermediate Horizontal Grid Ticks for Profit Chart
  const profitGridTicks = useMemo(() => {
    const count = 5;
    const step = (chartMaxProfit - chartMinProfit) / count;
    return Array.from({ length: count + 1 }, (_, i) => chartMinProfit + i * step);
  }, [chartMinProfit, chartMaxProfit]);

  // Zoom badges calculations
  const isPipsZoomed = pipsZoom.start > 0 || pipsZoom.end < pipsDataPoints.length - 1;
  const pipsZoomRatio = pipsDataPoints.length > 0 ? Math.round((pipsDataPoints.length / (visiblePipsDataPoints.length || 1)) * 100) : 100;

  const isProfitZoomed = profitZoom.start > 0 || profitZoom.end < profitDataPoints.length - 1;
  const profitZoomRatio = profitDataPoints.length > 0 ? Math.round((profitDataPoints.length / (visibleProfitDataPoints.length || 1)) * 100) : 100;

  const renderPipsChart = () => (
    /* =========================================================================
        CHART: PIPS GROWTH & TRAJECTORY CURVE
        ========================================================================= */
    <div className="dashboard-panel" style={{ position: 'relative', overflow: 'hidden' }}>
        {/* Top Header & Metrics HUD */}
        <div className="panel-header" style={{ flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={20} color="var(--profit)" />
              <h3 style={{ fontSize: '1.25rem', fontWeight: '800' }}>
                Pips Growth & Trajectory Curve
              </h3>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: '3px' }}>
              Real-time execution performance tracking cumulative pips gained vs. loose pips
              {processedPipsData.length > 0 && (
                <span style={{ marginLeft: '8px', color: 'var(--accent-cyan)', fontSize: '0.74rem', fontWeight: '700' }}>
                  • Showing {processedPipsData.length} {processedPipsData.length === 1 ? 'trade' : 'trades'} ({pipsTimeframe})
                </span>
              )}
            </p>
          </div>

          {/* Timeframe picker, Zoom Controls, and Pips Stats HUD */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            {/* Timeframe picker */}
            <div className="pips-timeframe-picker">
              {dynamicTimeframes.map(tf => {
                const isActive = pipsTimeframe === tf.id;
                return (
                  <button
                    key={tf.id}
                    type="button"
                    disabled={tf.disabled}
                    className={`pips-tf-btn ${isActive ? 'active' : ''}`}
                    title={tf.disabled ? 'No trades in this timeframe' : `${tf.count} trades in ${tf.label}`}
                    onClick={() => !tf.disabled && setPipsTimeframe(tf.id)}
                  >
                    <span>{tf.label}</span>
                    {tf.count !== undefined && tf.count > 0 && (
                      <span className="pips-tf-count">{tf.count}</span>
                    )}
                  </button>
                );
              })}

              <button
                type="button"
                className={`pips-tf-btn ${isSmooth ? 'active' : ''}`}
                onClick={() => setIsSmooth(!isSmooth)}
                title={isSmooth ? "Switch to Straight Linear Graph" : "Switch to Smooth Curved Graph"}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', marginLeft: '6px' }}
              >
                <Sparkles size={12} color={isSmooth ? 'var(--accent-cyan)' : 'var(--text-muted)'} />
                <span>{isSmooth ? 'Smooth' : 'Straight'}</span>
              </button>
            </div>



          </div>
        </div>

        {/* Super Box HUD Container - Full Row Width */}
        <div
          className="hud-super-box"
          style={{
            width: '100%',
            marginTop: '16px',
            background: 'rgba(10, 18, 30, 0.75)',
            border: '1px solid rgba(0, 245, 155, 0.2)',
            borderRadius: '16px',
            padding: '14px',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.05)'
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: '12px',
              width: '100%'
            }}
          >
            {/* Box 1: NET PIPS */}
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center'
              }}
            >
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '0.05em' }}>
                Net Pips
              </span>
              <p style={{ fontSize: '1.25rem', fontWeight: '800', fontFamily: 'var(--font-mono)', color: isPipsProfitable ? 'var(--profit)' : 'var(--loss)', margin: '4px 0 0' }}>
                {netPips >= 0 ? '+' : ''}{netPips.toFixed(1)} <span style={{ fontSize: '0.74rem', fontWeight: '600' }}>PIPS</span>
              </p>
            </div>

            {/* Box 2: PIPS GAIN */}
            <div
              style={{
                background: 'rgba(0, 245, 155, 0.05)',
                border: '1px solid rgba(0, 245, 155, 0.22)',
                borderRadius: '12px',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <ArrowUpRight size={13} color="var(--profit)" />
                <span style={{ fontSize: '0.68rem', color: 'var(--profit)', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '0.05em' }}>
                  Pips Gain
                </span>
              </div>
              <p style={{ fontSize: '1.25rem', fontWeight: '800', fontFamily: 'var(--font-mono)', color: 'var(--profit)', margin: '4px 0 0' }}>
                +{totalPipsGain.toFixed(1)}
              </p>
            </div>

            {/* Box 3: LOOSE PIPS */}
            <div
              style={{
                background: 'rgba(255, 51, 102, 0.05)',
                border: '1px solid rgba(255, 51, 102, 0.22)',
                borderRadius: '12px',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <ArrowDownRight size={13} color="var(--loss)" />
                <span style={{ fontSize: '0.68rem', color: 'var(--loss)', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '0.05em' }}>
                  Loose Pips
                </span>
              </div>
              <p style={{ fontSize: '1.25rem', fontWeight: '800', fontFamily: 'var(--font-mono)', color: 'var(--loss)', margin: '4px 0 0' }}>
                -{totalLoosePips.toFixed(1)}
              </p>
            </div>

            {/* Box 4: PEAK HIGH */}
            <div
              style={{
                background: 'rgba(0, 210, 255, 0.05)',
                border: '1px solid rgba(0, 210, 255, 0.22)',
                borderRadius: '12px',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center'
              }}
            >
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '0.05em' }}>
                Peak High
              </span>
              <p style={{ fontSize: '1.25rem', fontWeight: '800', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', margin: '4px 0 0' }}>
                +{peakPips.toFixed(1)}
              </p>
            </div>

            {/* Box 5: MAX DRAWDOWN */}
            <div
              style={{
                background: 'rgba(255, 51, 102, 0.04)',
                border: '1px solid rgba(255, 51, 102, 0.18)',
                borderRadius: '12px',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center'
              }}
            >
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '0.05em' }}>
                Max Drawdown
              </span>
              <p style={{ fontSize: '1.25rem', fontWeight: '800', fontFamily: 'var(--font-mono)', color: 'var(--loss)', margin: '4px 0 0' }}>
                -{maxPipsDD.toFixed(1)}
              </p>
            </div>
          </div>
        </div>

        {/* Visual Legend Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginTop: '10px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#00f59b', boxShadow: '0 0 8px rgba(0,245,155,0.6)' }} />
            <span><strong>Pips Gain</strong> (Winning Trades)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ff3366', boxShadow: '0 0 8px rgba(255,51,102,0.6)' }} />
            <span><strong>Loose Pips</strong> (Losing Trades)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '18px', height: '1px', background: isPipsProfitable ? '#00f59b' : '#ff3366', borderRadius: '1px' }} />
            <span><strong>Cumulative Net Pips</strong> Trajectory</span>
          </div>
          <div style={{ marginLeft: 'auto', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            💡 Tip: Scroll wheel to Zoom • Click & Drag graph left/right to Pan • Shift+Wheel to Scroll
          </div>
        </div>

        {/* Interactive SVG Pips Chart Canvas */}
        <div style={{ width: '100%', position: 'relative', marginTop: '16px' }}>
          {processedPipsData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
              <Calendar size={32} style={{ margin: '0 auto 10px', opacity: 0.5, display: 'block' }} color="var(--accent-cyan)" />
              <p style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-white)', margin: '0 0 6px' }}>
                No trades recorded for {pipsTimeframe} timeframe
              </p>
              <p style={{ fontSize: '0.82rem', margin: 0 }}>
                Select another timeframe (7D, 30D, ALL) or click <strong>+ Quick Add Trade</strong> to record execution.
              </p>
            </div>
          ) : (
            <>
              <svg
                ref={pipsSvgRef}
                viewBox={`0 0 ${width} ${height}`}
                style={{
                  width: '100%',
                  height: 'auto',
                  overflow: 'visible',
                  cursor: isPipsDragging ? 'grabbing' : isPipsZoomed ? 'grab' : 'crosshair',
                  touchAction: 'none',
                  userSelect: 'none'
                }}
                onMouseDown={handlePipsPointerDown}
                onMouseMove={handlePipsPointerMove}
                onMouseUp={handlePipsPointerUp}
                onTouchStart={handlePipsPointerDown}
                onTouchMove={handlePipsPointerMove}
                onTouchEnd={handlePipsPointerUp}
                onMouseLeave={() => {
                  handlePipsPointerUp();
                  setHoveredPipsPoint(null);
                }}
              >
            <defs>
              <linearGradient id="pipsEquityFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00d2ff" stopOpacity="0.28" />
                <stop offset="60%" stopColor="#00d2ff" stopOpacity="0.06" />
                <stop offset="100%" stopColor="#00d2ff" stopOpacity="0.0" />
              </linearGradient>

              <linearGradient id="gainBarGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00f59b" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#00f59b" stopOpacity="0.1" />
              </linearGradient>

              <linearGradient id="lossBarGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ff3366" stopOpacity="0.1" />
                <stop offset="100%" stopColor="#ff3366" stopOpacity="0.8" />
              </linearGradient>
            </defs>

            {/* Faded Horizontal Grid Lines */}
            {pipsGridTicks.map((val, i) => {
              const y = getPipsY(val);
              if (y < paddingY - 5 || y > height - paddingY + 5) return null;

              const topY = maxPipsVal > 0 ? getPipsY(maxPipsVal) : -999;
              const botY = minPipsVal < 0 ? getPipsY(minPipsVal) : -999;

              const isTooCloseToZero = Math.abs(y - pipsZeroY) < 16;
              const isTooCloseToTop = Math.abs(y - topY) < 16;
              const isTooCloseToBot = Math.abs(y - botY) < 16;
              const hideText = isTooCloseToZero || isTooCloseToTop || isTooCloseToBot;

              return (
                <g key={`pips-hgrid-${i}`}>
                  <line
                    x1={paddingX}
                    y1={y}
                    x2={width - paddingX}
                    y2={y}
                    stroke="rgba(255, 255, 255, 0.05)"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                  />
                  {!hideText && (
                    <text
                      x={paddingX - 10}
                      y={y + 3}
                      fill="rgba(255, 255, 255, 0.35)"
                      fontSize="10"
                      textAnchor="end"
                      fontFamily="var(--font-mono)"
                    >
                      {Math.round(val)}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Faded Vertical Grid Lines */}
            {visiblePipsDataPoints.map((p, i) => {
              const cx = getXPips(i);
              const isHovered = hoveredPipsPoint === p;
              return (
                <line
                  key={`pips-vgrid-${i}`}
                  x1={cx}
                  y1={paddingY}
                  x2={cx}
                  y2={height - paddingY}
                  stroke={isHovered ? "rgba(0, 210, 255, 0.4)" : "rgba(255, 255, 255, 0.05)"}
                  strokeWidth={isHovered ? "1.5" : "1"}
                  strokeDasharray={isHovered ? "none" : "3 3"}
                />
              );
            })}

            {/* Zero Pips Reference Baseline */}
            <line
              x1={paddingX}
              y1={pipsZeroY}
              x2={width - paddingX}
              y2={pipsZeroY}
              stroke="rgba(0, 210, 255, 0.35)"
              strokeDasharray="4 4"
              strokeWidth="1.2"
            />
            <text
              x={paddingX - 10}
              y={pipsZeroY + 4}
              fill="var(--accent-cyan)"
              fontSize="11"
              textAnchor="end"
              fontFamily="var(--font-mono)"
              fontWeight="800"
            >
              0 Pips
            </text>

            {/* Top Maximum Reference Line */}
            {maxPipsVal > 0 && (
              <>
                <line
                  x1={paddingX}
                  y1={getPipsY(maxPipsVal)}
                  x2={width - paddingX}
                  y2={getPipsY(maxPipsVal)}
                  stroke="rgba(0, 245, 155, 0.25)"
                  strokeWidth="1"
                  strokeDasharray="2 3"
                />
                <text
                  x={paddingX - 10}
                  y={getPipsY(maxPipsVal) + 4}
                  fill="var(--profit)"
                  fontSize="11"
                  textAnchor="end"
                  fontFamily="var(--font-mono)"
                  fontWeight="800"
                >
                  +{Math.round(maxPipsVal)} Pips
                </text>
              </>
            )}

            {/* Bottom Negative Reference Line */}
            {minPipsVal < 0 && (
              <>
                <line
                  x1={paddingX}
                  y1={getPipsY(minPipsVal)}
                  x2={width - paddingX}
                  y2={getPipsY(minPipsVal)}
                  stroke="rgba(255, 51, 102, 0.25)"
                  strokeWidth="1"
                  strokeDasharray="2 3"
                />
                <text
                  x={paddingX - 10}
                  y={getPipsY(minPipsVal) + 4}
                  fill="var(--loss)"
                  fontSize="11"
                  textAnchor="end"
                  fontFamily="var(--font-mono)"
                  fontWeight="800"
                >
                  {Math.round(minPipsVal)} Pips
                </text>
              </>
            )}

            {/* Per-Trade Pips Pillars */}
            {visiblePipsDataPoints.map((p, i) => {
              const cx = getXPips(i);
              const isGain = p.pips > 0;
              const barHeight = Math.min(graphHeight * 0.45, (Math.abs(p.pips) / rangePips) * graphHeight);

              if (p.pips === 0) return null;

              return (
                <g key={`pips-pillar-${i}`} opacity={hoveredPipsPoint === p ? 0.9 : 0.45}>
                  {isGain ? (
                    <rect
                      x={cx - 5}
                      y={pipsZeroY - barHeight}
                      width={10}
                      height={barHeight}
                      rx={3}
                      fill="url(#gainBarGrad)"
                    />
                  ) : (
                    <rect
                      x={cx - 5}
                      y={pipsZeroY}
                      width={10}
                      height={barHeight}
                      rx={3}
                      fill="url(#lossBarGrad)"
                    />
                  )}
                </g>
              );
            })}

            {/* Shaded Area under Cumulative Pips Curve */}
            <path d={pipsAreaPathD} fill="url(#pipsEquityFill)" />

            {/* Cumulative Pips Smooth Thin Blue Curve */}
            <path
              d={pipsPathD}
              fill="none"
              stroke="#00d2ff"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Data Point Dots & Hover Interactivity */}
            {visiblePipsDataPoints.map((p, i) => {
              const cx = getXPips(i);
              const cy = getPipsY(p.cumulativePips);
              const isWin = p.result === 'WIN';
              const isLoss = p.result === 'LOSS';
              const isHovered = hoveredPipsPoint === p;
              const isBaseline = p.tradeIndex === 0;

              return (
                <g
                  key={`pips-dot-${i}`}
                  onMouseEnter={() => !isBaseline && setHoveredPipsPoint(p)}
                  style={{ cursor: !isBaseline ? 'pointer' : 'default' }}
                >
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isHovered ? 6.5 : isBaseline ? 3 : 4}
                    fill={isBaseline ? '#00d2ff' : isWin ? '#00f59b' : isLoss ? '#ff3366' : '#f59e0b'}
                    stroke="#060c14"
                    strokeWidth={isHovered ? 2 : 1.2}
                    style={{ transition: 'all 0.15s ease' }}
                  />
                </g>
              );
            })}

            {/* Dynamic Date X-Axis Labels */}
            {visiblePipsDataPoints.map((p, i) => {
              if (visiblePipsDataPoints.length > 15 && i % Math.ceil(visiblePipsDataPoints.length / 10) !== 0 && i !== visiblePipsDataPoints.length - 1) {
                return null;
              }
              const cx = getXPips(i);
              return (
                <text
                  key={`pips-xlabel-${i}`}
                  x={cx}
                  y={height - 10}
                  fill="var(--text-muted)"
                  fontSize="10"
                  textAnchor="middle"
                  fontFamily="var(--font-mono)"
                >
                  {p.date ? (p.date.length > 5 ? p.date.slice(5).replace('-', '/') : p.date) : ''}
                </text>
              );
            })}
          </svg>

          {/* Floating Hover Tooltip for Pips Chart */}
          {hoveredPipsPoint && (
            <div
              className="chart-floating-tooltip"
              style={{
                top: `${Math.max(10, getPipsY(hoveredPipsPoint.cumulativePips) - 70)}px`,
                left: `${Math.min(width - 220, Math.max(20, getXPips(visiblePipsDataPoints.indexOf(hoveredPipsPoint)) - 90))}px`
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontWeight: '800', color: '#fff' }}>{hoveredPipsPoint.tradeName}</span>
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: '800',
                    padding: '1px 6px',
                    borderRadius: '4px',
                    background: hoveredPipsPoint.result === 'WIN' ? 'rgba(0,245,155,0.18)' : hoveredPipsPoint.result === 'LOSS' ? 'rgba(255,51,102,0.18)' : 'rgba(245,158,11,0.18)',
                    color: hoveredPipsPoint.result === 'WIN' ? '#00f59b' : hoveredPipsPoint.result === 'LOSS' ? '#ff3366' : '#f59e0b'
                  }}
                >
                  {hoveredPipsPoint.result}
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
                {hoveredPipsPoint.date} • {hoveredPipsPoint.instrument}
              </div>
              <div style={{ marginTop: '4px', fontSize: '0.78rem', fontWeight: '700', fontFamily: 'var(--font-mono)' }}>
                Outcome Pips: <span style={{ color: hoveredPipsPoint.pips >= 0 ? '#00f59b' : '#ff3366' }}>{hoveredPipsPoint.pips >= 0 ? '+' : ''}{hoveredPipsPoint.pips}</span>
              </div>
              <div style={{ fontSize: '0.78rem', fontWeight: '700', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
                Cumulative Pips: {hoveredPipsPoint.cumulativePips >= 0 ? '+' : ''}{hoveredPipsPoint.cumulativePips}
              </div>
            </div>
          )}
          </>
        )}
        </div>


      </div>
  );

  const renderProfitChart = () => (
      /* =========================================================================
          CHART: PROFIT GROWTH & TRAJECTORY CURVE (USD)
          ========================================================================= */
      <div className="dashboard-panel" style={{ position: 'relative', overflow: 'hidden' }}>
        {/* Top Header & USD Metrics HUD */}
        <div className="panel-header" style={{ flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <DollarSign size={20} color="var(--profit)" />
              <h3 style={{ fontSize: '1.25rem', fontWeight: '800' }}>
                Profit Growth & Trajectory Curve (USD)
              </h3>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: '3px' }}>
              Real-time execution performance tracking cumulative USD net profit, total gross profit vs. total gross loss
              {processedProfitData.length > 0 && (
                <span style={{ marginLeft: '8px', color: 'var(--accent-cyan)', fontSize: '0.74rem', fontWeight: '700' }}>
                  • Showing {processedProfitData.length} {processedProfitData.length === 1 ? 'trade' : 'trades'} ({profitTimeframe})
                </span>
              )}
            </p>
          </div>

          {/* Timeframe picker, Zoom Controls, and Profit Stats HUD */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            {/* Timeframe picker */}
            <div className="pips-timeframe-picker">
              {dynamicTimeframes.map(tf => {
                const isActive = profitTimeframe === tf.id;
                return (
                  <button
                    key={tf.id}
                    type="button"
                    disabled={tf.disabled}
                    className={`pips-tf-btn ${isActive ? 'active' : ''}`}
                    title={tf.disabled ? 'No trades in this timeframe' : `${tf.count} trades in ${tf.label}`}
                    onClick={() => !tf.disabled && setProfitTimeframe(tf.id)}
                  >
                    <span>{tf.label}</span>
                    {tf.count !== undefined && tf.count > 0 && (
                      <span className="pips-tf-count">{tf.count}</span>
                    )}
                  </button>
                );
              })}

              <button
                type="button"
                className={`pips-tf-btn ${isSmooth ? 'active' : ''}`}
                onClick={() => setIsSmooth(!isSmooth)}
                title={isSmooth ? "Switch to Straight Linear Graph" : "Switch to Smooth Curved Graph"}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', marginLeft: '6px' }}
              >
                <Sparkles size={12} color={isSmooth ? 'var(--accent-cyan)' : 'var(--text-muted)'} />
                <span>{isSmooth ? 'Smooth' : 'Straight'}</span>
              </button>
            </div>



          </div>
        </div>

        {/* Super Box HUD Container - Full Row Width */}
        <div
          className="hud-super-box"
          style={{
            width: '100%',
            marginTop: '16px',
            background: 'rgba(10, 18, 30, 0.75)',
            border: '1px solid rgba(0, 245, 155, 0.2)',
            borderRadius: '16px',
            padding: '14px',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.05)'
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: '12px',
              width: '100%'
            }}
          >
            {/* Box 1: NET LOSS / PROFIT */}
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center'
              }}
            >
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '0.05em' }}>
                Net Loss / Profit
              </span>
              <p style={{ fontSize: '1.25rem', fontWeight: '800', fontFamily: 'var(--font-mono)', color: isProfitUSDProfitable ? 'var(--profit)' : 'var(--loss)', margin: '4px 0 0' }}>
                {formatUSDMetric(netProfitUSD, true)}
              </p>
            </div>

            {/* Box 2: TOTAL PROFIT */}
            <div
              style={{
                background: 'rgba(0, 245, 155, 0.05)',
                border: '1px solid rgba(0, 245, 155, 0.22)',
                borderRadius: '12px',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <ArrowUpRight size={13} color="var(--profit)" />
                <span style={{ fontSize: '0.68rem', color: 'var(--profit)', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '0.05em' }}>
                  Total Profit
                </span>
              </div>
              <p style={{ fontSize: '1.25rem', fontWeight: '800', fontFamily: 'var(--font-mono)', color: 'var(--profit)', margin: '4px 0 0' }}>
                +{formatUSDMetric(totalGrossProfitUSD, false)}
              </p>
            </div>

            {/* Box 3: TOTAL LOSS */}
            <div
              style={{
                background: 'rgba(255, 51, 102, 0.05)',
                border: '1px solid rgba(255, 51, 102, 0.22)',
                borderRadius: '12px',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <ArrowDownRight size={13} color="var(--loss)" />
                <span style={{ fontSize: '0.68rem', color: 'var(--loss)', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '0.05em' }}>
                  Total Loss
                </span>
              </div>
              <p style={{ fontSize: '1.25rem', fontWeight: '800', fontFamily: 'var(--font-mono)', color: 'var(--loss)', margin: '4px 0 0' }}>
                -{formatUSDMetric(totalGrossLossUSD, false)}
              </p>
            </div>

            {/* Box 4: MAX PROFIT */}
            <div
              style={{
                background: 'rgba(0, 210, 255, 0.05)',
                border: '1px solid rgba(0, 210, 255, 0.22)',
                borderRadius: '12px',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center'
              }}
            >
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '0.05em' }}>
                Max Profit
              </span>
              <p style={{ fontSize: '1.25rem', fontWeight: '800', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', margin: '4px 0 0' }}>
                +{formatUSDMetric(peakProfitUSD, false)}
              </p>
            </div>

            {/* Box 5: MAX LOSS */}
            <div
              style={{
                background: 'rgba(255, 51, 102, 0.04)',
                border: '1px solid rgba(255, 51, 102, 0.18)',
                borderRadius: '12px',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center'
              }}
            >
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '0.05em' }}>
                Max Loss
              </span>
              <p style={{ fontSize: '1.25rem', fontWeight: '800', fontFamily: 'var(--font-mono)', color: 'var(--loss)', margin: '4px 0 0' }}>
                -{formatUSDMetric(maxProfitDD, false)}
              </p>
            </div>
          </div>
        </div>

        {/* Visual Legend Bar for Profit Curve */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginTop: '10px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#00f59b', boxShadow: '0 0 8px rgba(0,245,155,0.6)' }} />
            <span><strong>Profit Gain ($)</strong> (Winning Trades)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ff3366', boxShadow: '0 0 8px rgba(255,51,102,0.6)' }} />
            <span><strong>Loss Drag ($)</strong> (Losing Trades)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '18px', height: '1px', background: isProfitUSDProfitable ? '#00f59b' : '#ff3366', borderRadius: '1px' }} />
            <span><strong>Cumulative Net Profit (USD)</strong> Trajectory</span>
          </div>
          <div style={{ marginLeft: 'auto', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            💡 Tip: Scroll wheel to Zoom • Click & Drag graph left/right to Pan • Shift+Wheel to Scroll
          </div>
        </div>

        {/* Interactive SVG Profit Chart Canvas */}
        <div style={{ width: '100%', position: 'relative', marginTop: '16px' }}>
          <svg
            ref={profitSvgRef}
            viewBox={`0 0 ${width} ${height}`}
            style={{
              width: '100%',
              height: 'auto',
              overflow: 'visible',
              cursor: isProfitDragging ? 'grabbing' : isProfitZoomed ? 'grab' : 'crosshair',
              touchAction: 'none',
              userSelect: 'none'
            }}
            onMouseDown={handleProfitPointerDown}
            onMouseMove={handleProfitPointerMove}
            onMouseUp={handleProfitPointerUp}
            onTouchStart={handleProfitPointerDown}
            onTouchMove={handleProfitPointerMove}
            onTouchEnd={handleProfitPointerUp}
            onMouseLeave={() => {
              handleProfitPointerUp();
              setHoveredProfitPoint(null);
            }}
          >
            <defs>
              <linearGradient id="profitEquityFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00d2ff" stopOpacity="0.28" />
                <stop offset="60%" stopColor="#00d2ff" stopOpacity="0.06" />
                <stop offset="100%" stopColor="#00d2ff" stopOpacity="0.0" />
              </linearGradient>

              <linearGradient id="profitGainBarGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00f59b" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#00f59b" stopOpacity="0.1" />
              </linearGradient>

              <linearGradient id="profitLossBarGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ff3366" stopOpacity="0.1" />
                <stop offset="100%" stopColor="#ff3366" stopOpacity="0.8" />
              </linearGradient>
            </defs>

            {/* Faded Horizontal Grid Lines */}
            {profitGridTicks.map((val, i) => {
              const y = getProfitY(val);
              if (y < paddingY - 5 || y > height - paddingY + 5) return null;

              const topY = maxProfitVal > 0 ? getProfitY(maxProfitVal) : -999;
              const botY = minProfitVal < 0 ? getProfitY(minProfitVal) : -999;

              const isTooCloseToZero = Math.abs(y - profitZeroY) < 16;
              const isTooCloseToTop = Math.abs(y - topY) < 16;
              const isTooCloseToBot = Math.abs(y - botY) < 16;
              const hideText = isTooCloseToZero || isTooCloseToTop || isTooCloseToBot;

              return (
                <g key={`profit-hgrid-${i}`}>
                  <line
                    x1={paddingX}
                    y1={y}
                    x2={width - paddingX}
                    y2={y}
                    stroke="rgba(255, 255, 255, 0.05)"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                  />
                  {!hideText && (
                    <text
                      x={paddingX - 10}
                      y={y + 3}
                      fill="rgba(255, 255, 255, 0.35)"
                      fontSize="10"
                      textAnchor="end"
                      fontFamily="var(--font-mono)"
                    >
                      {formatUSDMetric(val, false)}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Faded Vertical Grid Lines */}
            {visibleProfitDataPoints.map((p, i) => {
              const cx = getXProfit(i);
              const isHovered = hoveredProfitPoint === p;
              return (
                <line
                  key={`profit-vgrid-${i}`}
                  x1={cx}
                  y1={paddingY}
                  x2={cx}
                  y2={height - paddingY}
                  stroke={isHovered ? "rgba(0, 210, 255, 0.4)" : "rgba(255, 255, 255, 0.05)"}
                  strokeWidth={isHovered ? "1.5" : "1"}
                  strokeDasharray={isHovered ? "none" : "3 3"}
                />
              );
            })}

            {/* Zero USD Reference Baseline */}
            <line
              x1={paddingX}
              y1={profitZeroY}
              x2={width - paddingX}
              y2={profitZeroY}
              stroke="rgba(0, 210, 255, 0.35)"
              strokeDasharray="4 4"
              strokeWidth="1.2"
            />
            <text
              x={paddingX - 10}
              y={profitZeroY + 4}
              fill="var(--accent-cyan)"
              fontSize="11"
              textAnchor="end"
              fontFamily="var(--font-mono)"
              fontWeight="800"
            >
              $0
            </text>

            {/* Top Maximum Reference Line */}
            {maxProfitVal > 0 && (
              <>
                <line
                  x1={paddingX}
                  y1={getProfitY(maxProfitVal)}
                  x2={width - paddingX}
                  y2={getProfitY(maxProfitVal)}
                  stroke="rgba(0, 245, 155, 0.25)"
                  strokeWidth="1"
                  strokeDasharray="2 3"
                />
                <text
                  x={paddingX - 10}
                  y={getProfitY(maxProfitVal) + 4}
                  fill="var(--profit)"
                  fontSize="11"
                  textAnchor="end"
                  fontFamily="var(--font-mono)"
                  fontWeight="800"
                >
                  +{formatUSDMetric(maxProfitVal, false)}
                </text>
              </>
            )}

            {/* Bottom Negative Reference Line */}
            {minProfitVal < 0 && (
              <>
                <line
                  x1={paddingX}
                  y1={getProfitY(minProfitVal)}
                  x2={width - paddingX}
                  y2={getProfitY(minProfitVal)}
                  stroke="rgba(255, 51, 102, 0.25)"
                  strokeWidth="1"
                  strokeDasharray="2 3"
                />
                <text
                  x={paddingX - 10}
                  y={getProfitY(minProfitVal) + 4}
                  fill="var(--loss)"
                  fontSize="11"
                  textAnchor="end"
                  fontFamily="var(--font-mono)"
                  fontWeight="800"
                >
                  -{formatUSDMetric(Math.abs(minProfitVal), false)}
                </text>
              </>
            )}

            {/* Per-Trade USD Pillars */}
            {visibleProfitDataPoints.map((p, i) => {
              const cx = getXProfit(i);
              const isGain = p.profitUSD > 0;
              const barHeight = Math.min(graphHeight * 0.45, (Math.abs(p.profitUSD) / rangeProfit) * graphHeight);

              if (p.profitUSD === 0) return null;

              return (
                <g key={`profit-pillar-${i}`} opacity={hoveredProfitPoint === p ? 0.9 : 0.45}>
                  {isGain ? (
                    <rect
                      x={cx - 5}
                      y={profitZeroY - barHeight}
                      width={10}
                      height={barHeight}
                      rx={3}
                      fill="url(#profitGainBarGrad)"
                    />
                  ) : (
                    <rect
                      x={cx - 5}
                      y={profitZeroY}
                      width={10}
                      height={barHeight}
                      rx={3}
                      fill="url(#profitLossBarGrad)"
                    />
                  )}
                </g>
              );
            })}

            {/* Shaded Area under Cumulative USD Profit Curve */}
            <path d={profitAreaPathD} fill="url(#profitEquityFill)" />

            {/* Cumulative USD Profit Smooth Thin Blue Curve */}
            <path
              d={profitPathD}
              fill="none"
              stroke="#00d2ff"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Data Point Dots & Hover Interactivity */}
            {visibleProfitDataPoints.map((p, i) => {
              const cx = getXProfit(i);
              const cy = getProfitY(p.cumulativeProfitUSD);
              const isWin = p.result === 'WIN';
              const isLoss = p.result === 'LOSS';
              const isHovered = hoveredProfitPoint === p;
              const isBaseline = p.tradeIndex === 0;

              return (
                <g
                  key={`profit-dot-${i}`}
                  onMouseEnter={() => !isBaseline && setHoveredProfitPoint(p)}
                  style={{ cursor: !isBaseline ? 'pointer' : 'default' }}
                >
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isHovered ? 6.5 : isBaseline ? 3 : 4}
                    fill={isBaseline ? '#00d2ff' : isWin ? '#00f59b' : isLoss ? '#ff3366' : '#f59e0b'}
                    stroke="#060c14"
                    strokeWidth={isHovered ? 2 : 1.2}
                    style={{ transition: 'all 0.15s ease' }}
                  />
                </g>
              );
            })}

            {/* Dynamic Date X-Axis Labels */}
            {visibleProfitDataPoints.map((p, i) => {
              if (visibleProfitDataPoints.length > 15 && i % Math.ceil(visibleProfitDataPoints.length / 10) !== 0 && i !== visibleProfitDataPoints.length - 1) {
                return null;
              }
              const cx = getXProfit(i);
              return (
                <text
                  key={`profit-xlabel-${i}`}
                  x={cx}
                  y={height - 10}
                  fill="var(--text-muted)"
                  fontSize="10"
                  textAnchor="middle"
                  fontFamily="var(--font-mono)"
                >
                  {p.date ? (p.date.length > 5 ? p.date.slice(5).replace('-', '/') : p.date) : ''}
                </text>
              );
            })}
          </svg>

          {/* Floating Hover Tooltip for Profit Chart */}
          {hoveredProfitPoint && (
            <div
              className="chart-floating-tooltip"
              style={{
                top: `${Math.max(10, getProfitY(hoveredProfitPoint.cumulativeProfitUSD) - 70)}px`,
                left: `${Math.min(width - 220, Math.max(20, getXProfit(visibleProfitDataPoints.indexOf(hoveredProfitPoint)) - 90))}px`
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontWeight: '800', color: '#fff' }}>{hoveredProfitPoint.tradeName}</span>
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: '800',
                    padding: '1px 6px',
                    borderRadius: '4px',
                    background: hoveredProfitPoint.result === 'WIN' ? 'rgba(0,245,155,0.18)' : hoveredProfitPoint.result === 'LOSS' ? 'rgba(255,51,102,0.18)' : 'rgba(245,158,11,0.18)',
                    color: hoveredProfitPoint.result === 'WIN' ? '#00f59b' : hoveredProfitPoint.result === 'LOSS' ? '#ff3366' : '#f59e0b'
                  }}
                >
                  {hoveredProfitPoint.result}
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
                {hoveredProfitPoint.date} • {hoveredProfitPoint.instrument}
              </div>
              <div style={{ marginTop: '4px', fontSize: '0.78rem', fontWeight: '700', fontFamily: 'var(--font-mono)' }}>
                Trade Profit: <span style={{ color: hoveredProfitPoint.profitUSD >= 0 ? '#00f59b' : '#ff3366' }}>{formatUSDMetric(hoveredProfitPoint.profitUSD, true)}</span>
              </div>
              <div style={{ fontSize: '0.78rem', fontWeight: '700', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
                Cumulative Profit: {formatUSDMetric(hoveredProfitPoint.cumulativeProfitUSD, true)}
              </div>
            </div>
          )}
        </div>


      </div>
  );

  return (
    <div style={{ display: 'grid', gap: '24px' }}>
      {renderProfitChart()}
      {renderPipsChart()}
    </div>
  );
};
