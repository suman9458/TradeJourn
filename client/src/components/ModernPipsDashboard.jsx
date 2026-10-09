import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import richRiskImg from '../assets/rich-risk.jpg';
import { TradesTableView } from './TradesTableView';
import {
  BarChart2,
  TrendingUp,
  Award,
  Scale,
  Calendar,
  Layers,
  CheckCircle2,
  XCircle,
  Percent,
  Flame,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Compass,
  Zap,
  Target,
  Plus,
  Sparkles,
  X,
  DollarSign
} from 'lucide-react';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const formatProfitShort = (num) => {
  if (num === null || num === undefined) return null;
  const n = Number(num);
  if (isNaN(n)) return null;
  const sign = n > 0 ? '+' : n < 0 ? '-' : '';
  const abs = Math.abs(n);

  let formatted;
  if (abs >= 1000000) {
    const m = (abs / 1000000).toFixed(1).replace(/\.0$/, '');
    formatted = `${m}M`;
  } else if (abs >= 1000) {
    const k = (abs / 1000).toFixed(abs >= 10000 || abs % 1000 === 0 ? 0 : 1).replace(/\.0$/, '');
    formatted = `${k}k`;
  } else {
    formatted = Math.round(abs);
  }

  return `${sign}$${formatted}`;
};

export const getTradeTakeProfitUSD = (t) => {
  if (!t) return 0;

  // 1. Direct field on trade object
  let rawTp = (t.takeProfit !== undefined && t.takeProfit !== null && t.takeProfit !== '')
    ? t.takeProfit
    : (t.takeProfitUSD !== undefined && t.takeProfitUSD !== null && t.takeProfitUSD !== '' ? t.takeProfitUSD : null);

  // 2. Check client-side overrides if backend dropped field or returned 0
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

  // Fallback for existing trades where takeProfit was not populated
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

export const ModernPipsDashboard = ({
  stats,
  trades = [],
  recentTrades = [],
  breakdowns = null,
  curve = [],
  onOpenAddTrade,
  onTradeUpdated
}) => {
  const { user } = useAuth();
  const displayName = user?.name || user?.userId || 'Trader';
  const [isFullScreenOpen, setIsFullScreenOpen] = useState(false);
  const [hoveredWinSlice, setHoveredWinSlice] = useState(null); // 'win' | 'loss' | 'be'

  // Close full screen on ESC key and lock body scroll while modal is active
  useEffect(() => {
    if (!isFullScreenOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsFullScreenOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isFullScreenOpen]);

  // All trade records for dynamic auditing
  const allTrades = useMemo(() => {
    return Array.isArray(trades) ? trades : [];
  }, [trades]);

  // Extract all available years from user trades (defaults to current year)
  const availableYears = useMemo(() => {
    const years = new Set(
      allTrades
        .map(t => (t.date ? String(t.date).slice(0, 4) : ''))
        .filter(y => y && /^\d{4}$/.test(y))
    );
    const currentYear = String(new Date().getFullYear());
    years.add(currentYear);
    return Array.from(years).sort().reverse();
  }, [allTrades]);

  const [selectedYear, setSelectedYear] = useState(() => availableYears[0] || '2026');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;
  });

  // Extract all available months (all 12 calendar months for active years + user trade months)
  const availableMonths = useMemo(() => {
    const monthsSet = new Set();
    const now = new Date();
    const curYear = String(now.getFullYear());
    const years = new Set(availableYears && availableYears.length > 0 ? availableYears : [curYear]);

    if (selectedMonth) {
      const parts = selectedMonth.split(' ');
      if (parts[1]) years.add(parts[1]);
    }

    allTrades.forEach(t => {
      if (t.date && /^\d{4}/.test(t.date)) {
        years.add(t.date.slice(0, 4));
      }
    });

    Array.from(years).sort().reverse().forEach(yr => {
      MONTH_NAMES.forEach(m => {
        monthsSet.add(`${m} ${yr}`);
      });
    });

    return Array.from(monthsSet);
  }, [availableYears, allTrades, selectedMonth]);

  const handlePrevMonth = () => {
    const [mName, yStr] = selectedMonth.split(' ');
    let mIdx = MONTH_NAMES.indexOf(mName);
    let y = parseInt(yStr, 10);
    if (mIdx === -1 || isNaN(y)) return;

    if (mIdx === 0) {
      mIdx = 11;
      y -= 1;
    } else {
      mIdx -= 1;
    }
    setSelectedMonth(`${MONTH_NAMES[mIdx]} ${y}`);
  };

  const handleNextMonth = () => {
    const [mName, yStr] = selectedMonth.split(' ');
    let mIdx = MONTH_NAMES.indexOf(mName);
    let y = parseInt(yStr, 10);
    if (mIdx === -1 || isNaN(y)) return;

    if (mIdx === 11) {
      mIdx = 0;
      y += 1;
    } else {
      mIdx += 1;
    }
    setSelectedMonth(`${MONTH_NAMES[mIdx]} ${y}`);
  };
  const [performancePeriod, setPerformancePeriod] = useState('monthly'); // 'daily' | 'weekly' | 'monthly' | 'yearly'
  const [hoveredPerfItem, setHoveredPerfItem] = useState(null);
  const [hoveredAsset, setHoveredAsset] = useState(null);

  // Core metrics calculated dynamically from user trades & API stats
  const totalTradesCount = stats?.totalTrades !== undefined ? stats.totalTrades : allTrades.length;
  const winningTrades = useMemo(() => allTrades.filter(t => t.result === 'WIN'), [allTrades]);
  const losingTrades = useMemo(() => allTrades.filter(t => t.result === 'LOSS'), [allTrades]);
  const beTrades = useMemo(() => allTrades.filter(t => t.result === 'BE'), [allTrades]);

  const winCount = stats?.winningTrades !== undefined ? stats.winningTrades : winningTrades.length;
  const lossCount = stats?.losingTrades !== undefined ? stats.losingTrades : losingTrades.length;
  const beCount = stats?.breakEvenTrades !== undefined ? stats.breakEvenTrades : beTrades.length;

  const winRateVal = totalTradesCount > 0
    ? (stats?.winRate !== undefined ? Number(stats.winRate.toFixed(1)) : Number(((winCount / totalTradesCount) * 100).toFixed(1)))
    : 0;

  const totalPipsVal = stats?.totalPips !== undefined
    ? Math.round(stats.totalPips)
    : allTrades.reduce((sum, t) => sum + (Number(t.pips) || 0), 0);

  // Dynamic Risk:Reward Ratio (Avg RR for user)
  const riskRewardRatio = useMemo(() => {
    if (stats?.avgRR !== undefined && stats.avgRR !== null && !isNaN(stats.avgRR)) {
      return `1 : ${Number(stats.avgRR).toFixed(1)}`;
    }
    const validTrades = allTrades.filter(t => {
      const val = Number(t.rr !== undefined && t.rr !== null ? t.rr : t.rResult);
      return !isNaN(val) && val > 0;
    });

    if (validTrades.length > 0) {
      const avgRR = validTrades.reduce((acc, t) => {
        const val = Number(t.rr !== undefined && t.rr !== null ? t.rr : t.rResult);
        return acc + val;
      }, 0) / validTrades.length;
      return `1 : ${avgRR.toFixed(1)}`;
    }

    if (winningTrades.length > 0) {
      const avgWinRR = winningTrades.reduce((acc, t) => acc + (Number(t.rr) || Number(t.rResult) || 1.5), 0) / winningTrades.length;
      return `1 : ${avgWinRR.toFixed(1)}`;
    }
    if (allTrades.length > 0) {
      const avgRR = allTrades.reduce((acc, t) => acc + (Number(t.rr) || 1.5), 0) / allTrades.length;
      return `1 : ${avgRR.toFixed(1)}`;
    }
    return '1 : 0.0';
  }, [stats, winningTrades, allTrades]);

  // Dynamic Total Net Profit (USD) calculation across all trades
  const totalProfitVal = useMemo(() => {
    if (stats?.totalProfit !== undefined && stats?.totalProfit !== null && !isNaN(Number(stats.totalProfit))) {
      return Math.round(Number(stats.totalProfit));
    }
    if (!allTrades || allTrades.length === 0) return 0;
    return Math.round(allTrades.reduce((sum, t) => sum + getTradeTakeProfitUSD(t), 0));
  }, [stats, allTrades]);

  // Dynamic Month-over-Month Comparisons
  const trends = useMemo(() => {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth() + 1;
    let curMonthKey = `${curYear}-${String(curMonth).padStart(2, '0')}`;

    const prevDate = new Date(curYear, curMonth - 2, 1);
    let lastMonthKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

    let curTrades = allTrades.filter(t => t.date && t.date.startsWith(curMonthKey));
    let prevTrades = allTrades.filter(t => t.date && t.date.startsWith(lastMonthKey));

    // Fallback: If current calendar month has no trades yet, compare latest 2 active trade months
    if (curTrades.length === 0 && allTrades.length > 0) {
      const activeMonths = Array.from(new Set(
        allTrades.map(t => t.date ? String(t.date).slice(0, 7) : null).filter(m => m && /^\d{4}-\d{2}$/.test(m))
      )).sort().reverse();

      if (activeMonths.length >= 1) {
        curTrades = allTrades.filter(t => t.date && t.date.startsWith(activeMonths[0]));
        if (activeMonths.length >= 2) {
          prevTrades = allTrades.filter(t => t.date && t.date.startsWith(activeMonths[1]));
        }
      }
    }

    let tradesTrend = '+0.0%';
    let tradesTrendUp = true;
    if (prevTrades.length > 0) {
      const pct = ((curTrades.length - prevTrades.length) / prevTrades.length) * 100;
      tradesTrend = `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
      tradesTrendUp = pct >= 0;
    } else if (curTrades.length > 0) {
      tradesTrend = `+${curTrades.length} new`;
      tradesTrendUp = true;
    } else {
      tradesTrend = '0.0%';
    }

    const curWins = curTrades.filter(t => t.result === 'WIN').length;
    const prevWins = prevTrades.filter(t => t.result === 'WIN').length;
    const curWR = curTrades.length > 0 ? (curWins / curTrades.length) * 100 : 0;
    const prevWR = prevTrades.length > 0 ? (prevWins / prevTrades.length) * 100 : 0;
    const wrDiff = curWR - prevWR;
    const wrTrend = prevTrades.length > 0
      ? `${wrDiff >= 0 ? '+' : ''}${wrDiff.toFixed(1)}%`
      : `${curWR.toFixed(1)}%`;
    const wrTrendUp = wrDiff >= 0;

    const curPips = curTrades.reduce((s, t) => s + (Number(t.pips) || 0), 0);
    const prevPips = prevTrades.reduce((s, t) => s + (Number(t.pips) || 0), 0);
    let pipsTrend = '+0.0%';
    let pipsTrendUp = true;
    if (prevPips !== 0) {
      const pDiff = ((curPips - prevPips) / Math.abs(prevPips)) * 100;
      pipsTrend = `${pDiff >= 0 ? '+' : ''}${pDiff.toFixed(1)}%`;
      pipsTrendUp = pDiff >= 0;
    } else if (curPips !== 0) {
      pipsTrend = `${curPips >= 0 ? '+' : ''}${curPips} pips`;
      pipsTrendUp = curPips >= 0;
    }

    const curProfit = curTrades.reduce((s, t) => s + getTradeTakeProfitUSD(t), 0);
    const prevProfit = prevTrades.reduce((s, t) => s + getTradeTakeProfitUSD(t), 0);
    let profitTrend = '+0.0%';
    let profitTrendUp = true;
    if (prevProfit !== 0) {
      const prDiff = ((curProfit - prevProfit) / Math.abs(prevProfit)) * 100;
      profitTrend = `${prDiff >= 0 ? '+' : ''}${prDiff.toFixed(1)}%`;
      profitTrendUp = prDiff >= 0;
    } else if (curProfit !== 0) {
      profitTrend = `${curProfit >= 0 ? '+' : ''}$${Math.abs(curProfit)}`;
      profitTrendUp = curProfit >= 0;
    }

    // Average RR Month-over-Month calculation
    const getAvgRRForTrades = (tradesList) => {
      if (!tradesList || tradesList.length === 0) return 0;
      const valid = tradesList.filter(t => {
        const val = Number(t.rr !== undefined && t.rr !== null ? t.rr : t.rResult);
        return !isNaN(val) && val > 0;
      });
      if (valid.length > 0) {
        return valid.reduce((sum, t) => {
          const val = Number(t.rr !== undefined && t.rr !== null ? t.rr : t.rResult);
          return sum + val;
        }, 0) / valid.length;
      }
      const wins = tradesList.filter(t => t.result === 'WIN');
      if (wins.length > 0) {
        return wins.reduce((sum, t) => sum + (Number(t.rr) || Number(t.rResult) || 1.5), 0) / wins.length;
      }
      return 0;
    };

    const curAvgRR = getAvgRRForTrades(curTrades);
    const prevAvgRR = getAvgRRForTrades(prevTrades);

    let rrTrend = '+0.0%';
    let rrTrendUp = true;
    if (prevAvgRR > 0 && curAvgRR > 0) {
      const diff = ((curAvgRR - prevAvgRR) / prevAvgRR) * 100;
      rrTrend = `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%`;
      rrTrendUp = diff >= 0;
    } else if (curAvgRR > 0) {
      rrTrend = `+0.0%`;
      rrTrendUp = true;
    } else {
      rrTrend = '+0.0%';
      rrTrendUp = true;
    }

    return {
      tradesTrend,
      tradesTrendUp,
      wrTrend,
      wrTrendUp,
      profitTrend,
      profitTrendUp,
      pipsTrend,
      pipsTrendUp,
      rrTrend,
      rrTrendUp
    };
  }, [allTrades]);

  // Helper for ISO week calculations
  const getISOWeekDetails = (dateStr) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return null;
      d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
      const week1 = new Date(d.getFullYear(), 0, 4);
      const weekNo = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
      return { week: weekNo, year: d.getFullYear() };
    } catch {
      return null;
    }
  };

  // 1A. DYNAMIC DAILY PERFORMANCE (Audited per trading day)
  const dailyPipsData = useMemo(() => {
    const yearTrades = allTrades.filter(t => t.date && t.date.startsWith(selectedYear));
    const dayMap = {};

    yearTrades.forEach(t => {
      const d = t.date;
      if (!dayMap[d]) {
        dayMap[d] = {
          date: d,
          pips: 0,
          rTotal: 0,
          profitUSD: 0,
          tradesCount: 0,
          wins: 0,
          losses: 0
        };
      }
      dayMap[d].pips += Number(t.pips || 0);
      dayMap[d].rTotal += Number(t.rResult || 0);
      dayMap[d].profitUSD += getTradeTakeProfitUSD(t);
      dayMap[d].tradesCount += 1;
      if (t.result === 'WIN') dayMap[d].wins += 1;
      if (t.result === 'LOSS') dayMap[d].losses += 1;
    });

    const dates = Object.keys(dayMap).sort();

    if (dates.length > 0) {
      const displayDates = dates.length > 14 ? dates.slice(-14) : dates;
      return displayDates.map(dStr => {
        const item = dayMap[dStr];
        const parts = dStr.split('-');
        const monthNum = parseInt(parts[1], 10) - 1;
        const monthName = MONTH_NAMES[monthNum] || parts[1];
        const dayNum = parseInt(parts[2], 10);
        return {
          id: dStr,
          label: `${dayNum}`,
          fullTitle: `${dayNum} ${monthName} ${parts[0]}`,
          date: dStr,
          pips: Math.round(item.pips),
          profitUSD: Math.round(item.profitUSD || 0),
          profitText: formatProfitShort(item.profitUSD || 0),
          rTotal: Number(item.rTotal.toFixed(1)),
          tradesCount: item.tradesCount,
          wins: item.wins,
          losses: item.losses
        };
      });
    }

    const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return daysOfWeek.map((d, i) => ({
      id: `day-${i}`,
      label: d,
      fullTitle: `${d} (No Trades)`,
      pips: 0,
      profitUSD: 0,
      profitText: null,
      rTotal: 0,
      tradesCount: 0,
      wins: 0,
      losses: 0
    }));
  }, [allTrades, selectedYear]);

  // 1B. DYNAMIC WEEKLY PERFORMANCE (Audited per calendar week)
  const weeklyPipsData = useMemo(() => {
    const yearTrades = allTrades.filter(t => t.date && t.date.startsWith(selectedYear));
    const weekMap = {};

    yearTrades.forEach(t => {
      const wk = getISOWeekDetails(t.date);
      if (!wk) return;
      const key = `W${String(wk.week).padStart(2, '0')}`;
      if (!weekMap[key]) {
        weekMap[key] = {
          key,
          weekNum: wk.week,
          pips: 0,
          rTotal: 0,
          profitUSD: 0,
          tradesCount: 0,
          wins: 0,
          losses: 0,
          dates: []
        };
      }
      weekMap[key].pips += Number(t.pips || 0);
      weekMap[key].rTotal += Number(t.rResult || 0);
      weekMap[key].profitUSD += getTradeTakeProfitUSD(t);
      weekMap[key].tradesCount += 1;
      if (t.result === 'WIN') weekMap[key].wins += 1;
      if (t.result === 'LOSS') weekMap[key].losses += 1;
      weekMap[key].dates.push(t.date);
    });

    const weekKeys = Object.keys(weekMap).sort((a, b) => weekMap[a].weekNum - weekMap[b].weekNum);

    if (weekKeys.length > 0) {
      const displayWeeks = weekKeys.length > 12 ? weekKeys.slice(-12) : weekKeys;
      return displayWeeks.map(k => {
        const item = weekMap[k];
        const minDate = item.dates.slice().sort()[0];
        let subStr = '';
        if (minDate) {
          const parts = minDate.split('-');
          const mIdx = parseInt(parts[1], 10) - 1;
          subStr = ` (${MONTH_NAMES[mIdx] || ''})`;
        }
        return {
          id: k,
          label: `${item.weekNum}`,
          fullTitle: `Week ${item.weekNum}${subStr} ${selectedYear}`,
          pips: Math.round(item.pips),
          profitUSD: Math.round(item.profitUSD || 0),
          profitText: formatProfitShort(item.profitUSD || 0),
          rTotal: Number(item.rTotal.toFixed(1)),
          tradesCount: item.tradesCount,
          wins: item.wins,
          losses: item.losses
        };
      });
    }

    return [
      { id: 'W1', label: '1', fullTitle: 'Week 1', pips: 0, profitUSD: 0, profitText: null, rTotal: 0, tradesCount: 0, wins: 0, losses: 0 },
      { id: 'W2', label: '2', fullTitle: 'Week 2', pips: 0, profitUSD: 0, profitText: null, rTotal: 0, tradesCount: 0, wins: 0, losses: 0 },
      { id: 'W3', label: '3', fullTitle: 'Week 3', pips: 0, profitUSD: 0, profitText: null, rTotal: 0, tradesCount: 0, wins: 0, losses: 0 },
      { id: 'W4', label: '4', fullTitle: 'Week 4', pips: 0, profitUSD: 0, profitText: null, rTotal: 0, tradesCount: 0, wins: 0, losses: 0 },
      { id: 'W5', label: '5', fullTitle: 'Week 5', pips: 0, profitUSD: 0, profitText: null, rTotal: 0, tradesCount: 0, wins: 0, losses: 0 }
    ];
  }, [allTrades, selectedYear]);

  // 1C. DYNAMIC MONTHLY PERFORMANCE (Jan - Dec for selectedYear)
  const monthlyPipsData = useMemo(() => {
    return MONTH_NAMES.map((monthName, idx) => {
      const mStr = String(idx + 1).padStart(2, '0');
      const prefix = `${selectedYear}-${mStr}`;
      const monthTrades = allTrades.filter(t => t.date && t.date.startsWith(prefix));
      const pips = monthTrades.reduce((sum, t) => sum + (Number(t.pips) || 0), 0);
      const profitUSD = monthTrades.reduce((sum, t) => sum + getTradeTakeProfitUSD(t), 0);
      const rTotal = monthTrades.reduce((sum, t) => sum + (Number(t.rResult) || 0), 0);
      const wins = monthTrades.filter(t => t.result === 'WIN').length;
      const losses = monthTrades.filter(t => t.result === 'LOSS').length;

      return {
        id: monthName,
        label: monthName,
        fullTitle: `${monthName} ${selectedYear}`,
        month: monthName,
        monthNum: idx + 1,
        pips: Math.round(pips),
        profitUSD: Math.round(profitUSD),
        profitText: monthTrades.length > 0 ? formatProfitShort(profitUSD) : null,
        rTotal: Number(rTotal.toFixed(1)),
        tradesCount: monthTrades.length,
        wins,
        losses
      };
    });
  }, [allTrades, selectedYear]);

  // 1D. DYNAMIC YEARLY PERFORMANCE (Audited across all available years)
  const yearlyPipsData = useMemo(() => {
    const sortedYears = [...availableYears].sort();
    return sortedYears.map(y => {
      const yearTrades = allTrades.filter(t => t.date && t.date.startsWith(y));
      const pips = yearTrades.reduce((sum, t) => sum + (Number(t.pips) || 0), 0);
      const profitUSD = yearTrades.reduce((sum, t) => sum + getTradeTakeProfitUSD(t), 0);
      const rTotal = yearTrades.reduce((sum, t) => sum + (Number(t.rResult) || 0), 0);
      const wins = yearTrades.filter(t => t.result === 'WIN').length;
      const losses = yearTrades.filter(t => t.result === 'LOSS').length;

      return {
        id: y,
        label: y,
        fullTitle: `Year ${y}`,
        year: y,
        pips: Math.round(pips),
        profitUSD: Math.round(profitUSD),
        profitText: yearTrades.length > 0 ? formatProfitShort(profitUSD) : null,
        rTotal: Number(rTotal.toFixed(1)),
        tradesCount: yearTrades.length,
        wins,
        losses
      };
    });
  }, [allTrades, availableYears]);

  // Active dataset based on selected performance period
  const activePerformanceData = useMemo(() => {
    if (performancePeriod === 'daily') return dailyPipsData;
    if (performancePeriod === 'weekly') return weeklyPipsData;
    if (performancePeriod === 'yearly') return yearlyPipsData;
    return monthlyPipsData;
  }, [performancePeriod, dailyPipsData, weeklyPipsData, monthlyPipsData, yearlyPipsData]);

  // Dynamic Chart Y-Scale calculations based on P&L ($)
  const activeScaleMax = useMemo(() => {
    const maxVal = Math.max(...activePerformanceData.map(m => Math.abs(m.profitUSD || 0)), 0);
    if (maxVal === 0) return 100;
    if (maxVal <= 50) return 50;
    if (maxVal <= 100) return 100;
    if (maxVal <= 250) return 250;
    if (maxVal <= 500) return 500;
    if (maxVal <= 1000) return 1000;
    return Math.ceil(maxVal / 500) * 500;
  }, [activePerformanceData]);

  const formatYAxisUSD = (val) => {
    if (val === 0) return '$0';
    const abs = Math.abs(val);
    const sign = val > 0 ? '+' : '-';
    if (abs >= 1000) {
      const k = (abs / 1000).toFixed(abs % 1000 === 0 ? 0 : 1);
      return `${sign}$${k}k`;
    }
    return `${sign}$${abs}`;
  };

  const monthlyScaleMax = activeScaleMax;

  // 2. DYNAMIC TRADES BY ASSET (Donut)
  const assetData = useMemo(() => {
    if (allTrades.length === 0) {
      return [{ name: 'No Data', pct: 100, color: '#64748b', count: 0 }];
    }

    const counts = {};
    allTrades.forEach(t => {
      const sym = (t.instrument || 'EURUSD').trim().toUpperCase();
      counts[sym] = (counts[sym] || 0) + 1;
    });

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const palette = ['#f59e0b', '#00a8ff', '#8c52ff', '#00f59b', '#ff7b00', '#ec4899', '#14b8a6', '#94a3b8'];

    if (sorted.length <= 5) {
      return sorted.map(([name, count], i) => ({
        name,
        count,
        pct: Number(((count / allTrades.length) * 100).toFixed(1)),
        color: palette[i % palette.length]
      }));
    }

    // Top 4 + Others
    const top4 = sorted.slice(0, 4).map(([name, count], i) => ({
      name,
      count,
      pct: Number(((count / allTrades.length) * 100).toFixed(1)),
      color: palette[i]
    }));

    const otherCount = sorted.slice(4).reduce((sum, item) => sum + item[1], 0);
    top4.push({
      name: 'Others',
      count: otherCount,
      pct: Number(((otherCount / allTrades.length) * 100).toFixed(1)),
      color: '#94a3b8'
    });

    return top4;
  }, [allTrades]);

  // 4. DYNAMIC TRADE DIRECTION (Donut: Buy vs Sell)
  const directionData = useMemo(() => {
    if (allTrades.length === 0) {
      return [
        { name: 'Buy', pct: 50, color: '#00f59b', count: 0 },
        { name: 'Sell', pct: 50, color: '#ff3366', count: 0 }
      ];
    }

    let buyCount = 0;
    let sellCount = 0;

    allTrades.forEach(t => {
      const bias = String(t.bias || '').toLowerCase();
      const entryType = String(t.entryType || '').toLowerCase();
      const name = String(t.tradeName || '').toLowerCase();

      if (bias === 'bullish' || bias === 'buy' || entryType.includes('buy') || name.includes('buy')) {
        buyCount++;
      } else {
        sellCount++;
      }
    });

    const buyPct = Number(((buyCount / allTrades.length) * 100).toFixed(1));
    const sellPct = Number(((sellCount / allTrades.length) * 100).toFixed(1));

    return [
      { name: 'Buy', pct: buyPct, color: '#00f59b', count: buyCount },
      { name: 'Sell', pct: sellPct, color: '#ff3366', count: sellCount }
    ];
  }, [allTrades]);


  // 6. DYNAMIC RISK PER TRADE (Horizontal Bars by R:R distribution)
  const riskData = useMemo(() => {
    if (allTrades.length === 0) {
      return [
        { label: '< 1.0 R', pct: 0, color: '#ff7b00', count: 0 },
        { label: '1.0 - 1.5 R', pct: 0, color: '#00a8ff', count: 0 },
        { label: '1.5 - 2.5 R', pct: 0, color: '#00f59b', count: 0 },
        { label: '> 2.5 R', pct: 0, color: '#8c52ff', count: 0 }
      ];
    }

    let under1 = 0;
    let r1to15 = 0;
    let r15to25 = 0;
    let over25 = 0;

    allTrades.forEach(t => {
      const rr = Number(t.rr || t.rResult || 1.5);
      if (rr < 1.0) under1++;
      else if (rr <= 1.5) r1to15++;
      else if (rr <= 2.5) r15to25++;
      else over25++;
    });

    const total = allTrades.length;
    return [
      { label: '< 1.0 R', pct: Number(((under1 / total) * 100).toFixed(1)), color: '#ff7b00', count: under1 },
      { label: '1.0 - 1.5 R', pct: Number(((r1to15 / total) * 100).toFixed(1)), color: '#00a8ff', count: r1to15 },
      { label: '1.5 - 2.5 R', pct: Number(((r15to25 / total) * 100).toFixed(1)), color: '#00f59b', count: r15to25 },
      { label: '> 2.5 R', pct: Number(((over25 / total) * 100).toFixed(1)), color: '#8c52ff', count: over25 }
    ];
  }, [allTrades]);

  // 7. DYNAMIC RECENT TRADES (Sorted descending)
  const recentTradesList = useMemo(() => {
    const list = recentTrades && recentTrades.length > 0 ? recentTrades : allTrades.slice(0, 6);
    return list.map(t => {
      const isWin = t.result === 'WIN';
      const isLoss = t.result === 'LOSS';
      const bias = String(t.bias || '').toLowerCase();
      const type = bias === 'bearish' || bias === 'sell' ? 'Sell' : 'Buy';
      const pipsVal = Number(t.pips || 0);

      const pnlVal = getTradeTakeProfitUSD(t);
      const pnlUSD = pnlVal > 0 
        ? `+$${pnlVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
        : pnlVal < 0 
          ? `-$${Math.abs(pnlVal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
          : '$0.00';

      return {
        ...t,
        date: t.date || 'Today',
        asset: t.instrument || 'EURUSD',
        type,
        entry: t.levelTraded || 'Market',
        exit: t.result || 'BE',
        pips: `${pipsVal >= 0 ? '+' : ''}${pipsVal.toFixed(1)} Pips`,
        pnl: `${t.rResult >= 0 ? '+' : ''}${(t.rResult || 0).toFixed(1)}R`,
        pnlUSD,
        pnlVal,
        rr: t.rr ? `${t.rr.toFixed(1)}` : '1.5',
        isWin,
        isLoss
      };
    });
  }, [recentTrades, allTrades]);

  // 8. DYNAMIC DAILY CALENDAR DAYS FOR SELECTED MONTH
  const calendarDays = useMemo(() => {
    const [monthName, yearStr] = selectedMonth.split(' ');
    const mIdx = MONTH_NAMES.indexOf(monthName);
    const yearNum = parseInt(yearStr, 10) || 2026;
    const daysInMonth = new Date(yearNum, (mIdx >= 0 ? mIdx : 8) + 1, 0).getDate();

    const mPrefix = `${yearNum}-${String((mIdx >= 0 ? mIdx : 8) + 1).padStart(2, '0')}`;

    const days = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = String(day).padStart(2, '0');
      const dateKey = `${mPrefix}-${dayStr}`;
      const dayTrades = allTrades.filter(t => t.date === dateKey);

      let status = 'none';
      let pips = 0;
      let dayProfit = 0;
      let profitText = null;

      if (dayTrades.length > 0) {
        pips = dayTrades.reduce((sum, t) => sum + (Number(t.pips) || 0), 0);
        dayProfit = dayTrades.reduce((sum, t) => sum + getTradeTakeProfitUSD(t), 0);

        if (dayProfit > 0 || (dayProfit === 0 && pips > 0)) status = 'win';
        else if (dayProfit < 0 || (dayProfit === 0 && pips < 0)) status = 'loss';
        else status = 'be';

        profitText = formatProfitShort(dayProfit);
      }

      days.push({
        day,
        status,
        pips: `${pips >= 0 ? '+' : ''}${Math.round(pips)}`,
        profitUSD: dayProfit,
        profitText,
        tradesCount: dayTrades.length
      });
    }

    return days;
  }, [allTrades, selectedMonth]);

  // 9. DYNAMIC KEY METRICS (Avg Win, Avg Loss, Largest Win, Largest Loss in P&L $ and Pips)
  const keyMetrics = useMemo(() => {
    const winPips = winningTrades.map(t => Number(t.pips || 0));
    const lossPips = losingTrades.map(t => Number(t.pips || 0));

    const winProfits = winningTrades.map(t => getTradeTakeProfitUSD(t));
    const lossProfits = losingTrades.map(t => getTradeTakeProfitUSD(t));

    const avgWinPips = winPips.length > 0
      ? (winPips.reduce((s, p) => s + p, 0) / winPips.length).toFixed(1)
      : '0.0';

    const avgLossPips = lossPips.length > 0
      ? (lossPips.reduce((s, p) => s + p, 0) / lossPips.length).toFixed(1)
      : '0.0';

    const largestWinPips = winPips.length > 0 ? Math.max(...winPips).toFixed(1) : '0.0';
    const largestLossPips = lossPips.length > 0 ? Math.min(...lossPips).toFixed(1) : '0.0';

    // USD P&L Calculations
    const avgWinUSDVal = winProfits.length > 0
      ? (winProfits.reduce((s, p) => s + p, 0) / winProfits.length)
      : 0;

    const avgLossUSDVal = lossProfits.length > 0
      ? (lossProfits.reduce((s, p) => s + p, 0) / lossProfits.length)
      : 0;

    const largestWinUSDVal = winProfits.length > 0 ? Math.max(...winProfits) : 0;
    const largestLossUSDVal = lossProfits.length > 0 ? Math.min(...lossProfits) : 0;

    const fmtUSD = (num) => {
      const n = Number(num || 0);
      if (n > 0) return `+$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
      if (n < 0) return `-$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
      return '$0.00';
    };

    return {
      avgWin: `+${avgWinPips} Pips`,
      avgWinUSD: fmtUSD(avgWinUSDVal),
      avgLoss: `${avgLossPips} Pips`,
      avgLossUSD: fmtUSD(avgLossUSDVal),
      largestWin: `+${largestWinPips} Pips`,
      largestWinUSD: fmtUSD(largestWinUSDVal),
      largestLoss: `${largestLossPips} Pips`,
      largestLossUSD: fmtUSD(largestLossUSDVal)
    };
  }, [winningTrades, losingTrades]);

  // Donut SVG generator helper
  const createDonutArcs = (items, total, radius = 52, strokeWidth = 18) => {
    let cumulativeAngle = -90; // Start at top
    return items.map((item) => {
      const sliceAngle = ((item.pct || 0) / 100) * 360;
      const startAngle = cumulativeAngle;
      const endAngle = cumulativeAngle + Math.max(0.1, sliceAngle);
      cumulativeAngle += sliceAngle;

      const startRad = (startAngle * Math.PI) / 180;
      const endRad = (endAngle * Math.PI) / 180;

      const cx = 85;
      const cy = 85;

      const x1 = cx + radius * Math.cos(startRad);
      const y1 = cy + radius * Math.sin(startRad);
      const x2 = cx + radius * Math.cos(endRad);
      const y2 = cy + radius * Math.sin(endRad);

      const largeArc = sliceAngle > 180 ? 1 : 0;
      const pathData = sliceAngle >= 359.9
        ? `M ${cx} ${cy - radius} A ${radius} ${radius} 0 1 1 ${cx - 0.01} ${cy - radius}`
        : `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;

      return {
        ...item,
        pathData,
        strokeWidth
      };
    });
  };

  const assetArcs = useMemo(() => createDonutArcs(assetData, 100, 52, 18), [assetData]);
  const directionArcs = useMemo(() => createDonutArcs(directionData, 100, 52, 18), [directionData]);

  // Win rate donut calculations (Enlarged)
  const winRadius = 76;
  const winCircumference = 2 * Math.PI * winRadius;
  const winStrokeOffset = totalTradesCount > 0
    ? Math.max(0, winCircumference - (winRateVal / 100) * winCircumference)
    : winCircumference;

  return (
    <div className="modern-pips-dashboard">
      
      {/* =========================================================================
          TOP BANNER: BRANDING & INSPIRATIONAL SUNSET ARTWORK
          ========================================================================= */}
      <div className="modern-hero-banner">
        <div className="banner-left-content">
          <h1 className="modern-brand-title">{displayName}</h1>
          <p className="modern-brand-tagline">DISCIPLINE • DATA • BETTER TRADES</p>
        </div>

        {/* Rich / Risk Mindset Photo */}
        <div className="banner-art-wrap">
          <img
            src={richRiskImg}
            alt="Rich / Risk Trading Mindset"
            className="banner-rich-risk-img"
          />
        </div>
      </div>

      {/* Zero State Quick Starter Alert if no trades exist yet */}
      {totalTradesCount === 0 && (
        <div style={{
          background: 'rgba(0, 245, 155, 0.05)',
          border: '1px solid rgba(0, 245, 155, 0.25)',
          borderRadius: '12px',
          padding: '16px 20px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Sparkles size={22} color="var(--profit)" />
            <div>
              <div style={{ color: '#fff', fontWeight: '700', fontSize: '0.9rem' }}>
                Dynamic Ledger Active • 0 Closed Trades Recorded
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                All charts and KPIs below form dynamically from your logged trades. Add your first execution to start tracking.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            {onOpenAddTrade && (
              <button
                type="button"
                className="btn-primary"
                onClick={onOpenAddTrade}
                style={{ fontSize: '0.78rem', padding: '6px 14px' }}
              >
                <Plus size={14} />
                <span>Quick Add Trade</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          TOP 5 KPI CARDS (Completely Dynamic)
          ========================================================================= */}
      <div className="modern-kpi-row">
        
        {/* 1. Total Trades */}
        <div className="modern-kpi-card">
          <div className="kpi-icon-box blue">
            <BarChart2 size={18} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Total Trades</span>
            <div className="kpi-val">{totalTradesCount}</div>
            <div className={`kpi-trend ${trends.tradesTrendUp ? 'positive' : 'negative'}`}>
              {trends.tradesTrendUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              <span>{trends.tradesTrend}</span>
              <span className="kpi-sub-txt">vs last month</span>
            </div>
          </div>
        </div>

        {/* 2. Win Rate */}
        <div className="modern-kpi-card">
          <div className="kpi-icon-box teal">
            <Target size={18} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Win Rate</span>
            <div className="kpi-val">{winRateVal}%</div>
            <div className={`kpi-trend ${trends.wrTrendUp ? 'positive' : 'negative'}`}>
              {trends.wrTrendUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              <span>{trends.wrTrend}</span>
              <span className="kpi-sub-txt">vs last month</span>
            </div>
          </div>
        </div>

        {/* 3. Net Profit / PnL */}
        <div className="modern-kpi-card">
          <div className="kpi-icon-box gold">
            <DollarSign size={18} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Net Profit</span>
            <div className={`kpi-val ${totalProfitVal >= 0 ? 'text-profit' : 'text-loss'}`}>
              {totalProfitVal >= 0 ? `+$${totalProfitVal.toLocaleString()}` : `-$${Math.abs(totalProfitVal).toLocaleString()}`}
            </div>
            <div className={`kpi-trend ${trends.profitTrendUp ? 'positive' : 'negative'}`}>
              {trends.profitTrendUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              <span>{trends.profitTrend}</span>
              <span className="kpi-sub-txt">vs last month</span>
            </div>
          </div>
        </div>

        {/* 4. Total Pips */}
        <div className="modern-kpi-card">
          <div className="kpi-icon-box green">
            <TrendingUp size={18} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Total Pips</span>
            <div className={`kpi-val ${totalPipsVal >= 0 ? 'text-profit' : 'text-loss'}`}>
              {totalPipsVal >= 0 ? '+' : ''}{totalPipsVal.toLocaleString()}
              <span className="kpi-unit">Pips</span>
            </div>
            <div className={`kpi-trend ${trends.pipsTrendUp ? 'positive' : 'negative'}`}>
              {trends.pipsTrendUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              <span>{trends.pipsTrend}</span>
              <span className="kpi-sub-txt">vs last month</span>
            </div>
          </div>
        </div>

        {/* 5. Risk : Reward */}
        <div className="modern-kpi-card">
          <div className="kpi-icon-box indigo">
            <Scale size={18} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Avg Risk : Reward</span>
            <div className="kpi-val">{riskRewardRatio}</div>
            <div className={`kpi-trend ${trends.rrTrendUp ? 'positive' : 'negative'}`}>
              {trends.rrTrendUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              <span>{trends.rrTrend}</span>
              <span className="kpi-sub-txt">vs last month</span>
            </div>
          </div>
        </div>

      </div>

      {/* =========================================================================
          ROW 1: MONTHLY PERFORMANCE (PIPS) | WIN RATE
          ========================================================================= */}
      <div className="modern-charts-grid-row1">
        
        {/* A. Dynamic Multi-Period Performance in Pips (Daily, Weekly, Monthly, Yearly) */}
        <div className="modern-panel monthly-pips-panel">
          <div className="panel-top-bar" style={{ flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3>
                {performancePeriod === 'daily' && 'Daily Performance'}
                {performancePeriod === 'weekly' && 'Weekly Performance'}
                {performancePeriod === 'monthly' && 'Monthly Performance'}
                {performancePeriod === 'yearly' && 'Yearly Performance'}
              </h3>
              <p className="panel-sub">
                {performancePeriod === 'daily' && 'Net profit/loss audited per trading day'}
                {performancePeriod === 'weekly' && 'Net profit/loss audited per calendar week'}
                {performancePeriod === 'monthly' && 'Net profit/loss audited per calendar month'}
                {performancePeriod === 'yearly' && 'Net profit/loss audited per calendar year'}
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {/* Period Switcher: Daily | Weekly | Monthly | Yearly */}
              <div className="pips-timeframe-picker" style={{ padding: '3px 4px', gap: '3px' }}>
                {[
                  { id: 'daily', label: 'Daily' },
                  { id: 'weekly', label: 'Weekly' },
                  { id: 'monthly', label: 'Monthly' },
                  { id: 'yearly', label: 'Yearly' }
                ].map(p => {
                  const isActive = performancePeriod === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className={`pips-tf-btn ${isActive ? 'active' : ''}`}
                      onClick={() => {
                        setPerformancePeriod(p.id);
                        setHoveredPerfItem(null);
                      }}
                      style={{ padding: '4px 9px', fontSize: '0.72rem' }}
                    >
                      <span>{p.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Year Dropdown (for Daily, Weekly, Monthly) */}
              {performancePeriod !== 'yearly' && (
                <div className="panel-select-wrap">
                  <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
                    {availableYears.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="select-arrow" />
                </div>
              )}
            </div>
          </div>

          {/* SVG Bar Chart for Multi-Period Pips */}
          <div className="chart-canvas-wrap">
            <svg viewBox="0 0 520 220" className="chart-svg">
              {/* Zero baseline */}
              <line x1="45" y1="110" x2="510" y2="110" stroke="rgba(255,255,255,0.18)" strokeWidth="1.2" />

              {/* Dynamic Y-Axis Grid & Labels (in P&L $) */}
              {[
                { val: formatYAxisUSD(activeScaleMax), y: 25 },
                { val: formatYAxisUSD(Math.round(activeScaleMax / 2)), y: 68 },
                { val: '$0', y: 110 },
                { val: formatYAxisUSD(-Math.round(activeScaleMax / 2)), y: 152 },
                { val: formatYAxisUSD(-activeScaleMax), y: 195 }
              ].map((g, idx) => (
                <g key={idx}>
                  <line x1="45" y1={g.y} x2="510" y2={g.y} stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
                  <text x="38" y={g.y + 4} fill="#64748b" fontSize="10" fontFamily="var(--font-mono)" textAnchor="end">
                    {g.val}
                  </text>
                </g>
              ))}

              {/* Dynamic Multi-Period Bars */}
              {(() => {
                const numBars = activePerformanceData.length || 1;
                const plotLeft = 45;
                const plotRight = 510;
                const availableWidth = plotRight - plotLeft;
                const colWidth = availableWidth / numBars;
                const barWidth = Math.min(26, Math.max(10, colWidth * 0.52));

                return activePerformanceData.map((d, i) => {
                  const x = plotLeft + i * colWidth + (colWidth - barWidth) / 2;
                  const centerX = plotLeft + i * colWidth + colWidth / 2;
                  const isPositive = d.profitUSD >= 0;
                  const heightAvailable = 85;
                  const barHeight = Math.abs(d.profitUSD) > 0
                    ? Math.max(3, (Math.abs(d.profitUSD) / activeScaleMax) * heightAvailable)
                    : (d.tradesCount > 0 ? 2 : 0);
                  const y = isPositive ? (110 - barHeight) : 110;

                  const rawXPercent = (centerX / 520) * 100;
                  const leftPercent = Math.max(16, Math.min(84, rawXPercent));
                  const barTopY = isPositive ? (110 - barHeight) : 110;
                  const topPercent = Math.max(8, (barTopY / 220) * 100);

                  const perfItemWithPos = {
                    ...d,
                    leftPercent,
                    topPercent
                  };

                  return (
                    <g
                      key={d.id || i}
                      className="monthly-bar-item"
                      onMouseEnter={() => setHoveredPerfItem(perfItemWithPos)}
                      onMouseLeave={() => setHoveredPerfItem(null)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setHoveredPerfItem(hoveredPerfItem?.id === d.id ? null : perfItemWithPos);
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      {/* Hover highlight bar track */}
                      <rect
                        x={x - 4}
                        y="15"
                        width={barWidth + 8}
                        height="185"
                        fill="transparent"
                      />
                      {barHeight > 0 ? (
                        <rect
                          x={x}
                          y={y}
                          width={barWidth}
                          height={barHeight}
                          rx="3"
                          fill={isPositive ? '#00f59b' : '#ff3366'}
                          opacity={hoveredPerfItem?.id === d.id ? '1' : '0.85'}
                          style={{ transition: 'opacity 0.2s, height 0.3s' }}
                        />
                      ) : (
                        // Subtle baseline marker for periods with 0 trades
                        <line
                          x1={x}
                          y1="110"
                          x2={x + barWidth}
                          y2="110"
                          stroke="rgba(255,255,255,0.12)"
                          strokeWidth="2"
                        />
                      )}
                      <text
                        x={plotLeft + i * colWidth + colWidth / 2}
                        y="212"
                        fill={d.tradesCount > 0 ? '#cbd5e1' : '#64748b'}
                        fontSize={numBars > 10 ? '9.5' : '10.5'}
                        fontFamily="var(--font-sans)"
                        fontWeight={d.tradesCount > 0 ? '700' : '400'}
                        textAnchor="middle"
                      >
                        {d.label}
                      </text>
                    </g>
                  );
                });
              })()}
            </svg>
            {hoveredPerfItem && (
              <div
                className="chart-floating-tooltip"
                style={{
                  position: 'absolute',
                  left: `${hoveredPerfItem.leftPercent ?? 50}%`,
                  top: `${hoveredPerfItem.topPercent ?? 20}%`,
                  transform: 'translate(-50%, calc(-100% - 10px))',
                  pointerEvents: 'none',
                  transition: 'left 0.15s ease, top 0.15s ease',
                  zIndex: 25
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <strong>{hoveredPerfItem.fullTitle || hoveredPerfItem.label}:</strong>
                  <span
                    style={{
                      color: hoveredPerfItem.profitUSD >= 0 ? 'var(--profit)' : 'var(--loss)',
                      fontWeight: '800',
                      fontSize: '0.85rem',
                      fontFamily: 'var(--font-mono)',
                      background: hoveredPerfItem.profitUSD >= 0 ? 'rgba(0, 245, 155, 0.14)' : 'rgba(255, 51, 102, 0.14)',
                      padding: '2px 7px',
                      borderRadius: '5px',
                      border: `1px solid ${hoveredPerfItem.profitUSD >= 0 ? 'rgba(0, 245, 155, 0.3)' : 'rgba(255, 51, 102, 0.3)'}`
                    }}
                  >
                    {hoveredPerfItem.profitUSD >= 0 ? `+$${hoveredPerfItem.profitUSD.toLocaleString()}` : `-$${Math.abs(hoveredPerfItem.profitUSD).toLocaleString()}`}
                  </span>
                  <span style={{ color: hoveredPerfItem.pips >= 0 ? 'var(--profit)' : 'var(--loss)', fontWeight: '700', fontSize: '0.78rem' }}>
                    {hoveredPerfItem.pips >= 0 ? '+' : ''}{hoveredPerfItem.pips} Pips
                  </span>
                </div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '4px' }}>
                  {hoveredPerfItem.tradesCount} {hoveredPerfItem.tradesCount === 1 ? 'trade' : 'trades'} ({hoveredPerfItem.wins}W / {hoveredPerfItem.losses}L)
                </div>
              </div>
            )}
          </div>
        </div>

        {/* B. Win Rate (Circular Donut Chart with Dynamic Count) */}
        <div className="modern-panel winrate-panel">
          <div className="panel-top-bar">
            <h3>Win Rate</h3>
          </div>

          <div className="winrate-donut-stage">
            {/* Enlarged Donut SVG */}
            <div className="donut-canvas">
              <svg width="220" height="220" viewBox="0 0 220 220" className="donut-svg">
                <defs>
                  <filter id="winGlowModern" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3.5" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>

                {/* Loss Background Ring (Red) */}
                <circle
                  cx="110"
                  cy="110"
                  r={winRadius}
                  stroke={totalTradesCount > 0 ? '#ff3366' : 'rgba(255,255,255,0.08)'}
                  strokeWidth="26"
                  fill="transparent"
                  opacity={totalTradesCount > 0 ? '0.85' : '0.3'}
                />

                {/* Win Foreground Ring (Emerald Green) */}
                {totalTradesCount > 0 && winRateVal > 0 && (
                  <circle
                    cx="110"
                    cy="110"
                    r={winRadius}
                    stroke="#00f59b"
                    strokeWidth="26"
                    strokeDasharray={winCircumference}
                    strokeDashoffset={winStrokeOffset}
                    strokeLinecap="butt"
                    fill="transparent"
                    filter="url(#winGlowModern)"
                    transform="rotate(-90 110 110)"
                    style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                  />
                )}

                {/* Center Percentage - Enlarged */}
                <text x="110" y="113" textAnchor="middle" fill="#ffffff" fontSize="32" fontWeight="800" fontFamily="var(--font-sans)">
                  {winRateVal}%
                </text>
                <text x="110" y="136" textAnchor="middle" fill="#94a3b8" fontSize="13" fontWeight="700">
                  {winCount}W / {lossCount}L
                </text>
              </svg>
            </div>

            {/* Legend on Right */}
            <div className="donut-legend-col">
              <div className="legend-row">
                <span className="legend-dot green" />
                <div>
                  <span className="legend-name">Winning Trades</span>
                  <div className="legend-val">{winCount}</div>
                </div>
              </div>

              <div className="legend-row">
                <span className="legend-dot red" />
                <div>
                  <span className="legend-name">Losing Trades</span>
                  <div className="legend-val">{lossCount}</div>
                </div>
              </div>

              {beCount > 0 && (
                <div className="legend-row">
                  <span className="legend-dot" style={{ background: '#94a3b8' }} />
                  <div>
                    <span className="legend-name">Break-Even</span>
                    <div className="legend-val">{beCount}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* =========================================================================
          ROW 2: TRADES BY ASSET | TRADE DIRECTION | RISK PER TRADE
          ========================================================================= */}
      <div className="modern-charts-grid-row2">
        
        {/* 1. Trades by Asset */}
        <div className="modern-panel asset-panel">
          <div className="panel-top-bar">
            <h3>Trades by Asset</h3>
          </div>
          <div className="donut-stage-layout">
            <div className="donut-canvas-asset">
              <svg width="170" height="170" viewBox="0 0 170 170">
                {assetArcs.map((arc, i) => (
                  <path
                    key={i}
                    d={arc.pathData}
                    fill="none"
                    stroke={arc.color}
                    strokeWidth={arc.strokeWidth}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-width 0.2s', cursor: 'pointer' }}
                    onMouseEnter={() => setHoveredAsset(arc)}
                    onMouseLeave={() => setHoveredAsset(null)}
                  />
                ))}
                <text x="85" y="80" textAnchor="middle" fill="#ffffff" fontSize="20" fontWeight="800" fontFamily="var(--font-sans)">
                  {totalTradesCount}
                </text>
                <text x="85" y="96" textAnchor="middle" fill="#64748b" fontSize="10" fontWeight="700">
                  Trades
                </text>
              </svg>
            </div>

            <div className="asset-legend-list">
              {assetData.map((item, i) => (
                <div key={i} className="asset-legend-item">
                  <div className="asset-legend-left">
                    <span className="legend-square" style={{ background: item.color }} />
                    <span className="asset-name">{item.name}</span>
                  </div>
                  <span className="asset-pct">{item.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 2. Trade Direction */}
        <div className="modern-panel direction-panel">
          <div className="panel-top-bar">
            <h3>Trade Direction</h3>
          </div>
          <div className="donut-stage-layout">
            <div className="donut-canvas-asset">
              <svg width="170" height="170" viewBox="0 0 170 170">
                {directionArcs.map((arc, i) => (
                  <path
                    key={i}
                    d={arc.pathData}
                    fill="none"
                    stroke={arc.color}
                    strokeWidth={arc.strokeWidth}
                    strokeLinecap="round"
                  />
                ))}
                <text x="85" y="80" textAnchor="middle" fill="#ffffff" fontSize="20" fontWeight="800" fontFamily="var(--font-sans)">
                  {totalTradesCount}
                </text>
                <text x="85" y="96" textAnchor="middle" fill="#64748b" fontSize="10" fontWeight="700">
                  Trades
                </text>
              </svg>
            </div>

            <div className="asset-legend-list">
              {directionData.map((item, i) => (
                <div key={i} className="asset-legend-item">
                  <div className="asset-legend-left">
                    <span className="legend-square" style={{ background: item.color }} />
                    <span className="asset-name">{item.name}</span>
                  </div>
                  <span className="asset-pct">{item.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 3. Risk Per Trade */}
        <div className="modern-panel risk-panel">
          <div className="panel-top-bar">
            <h3>Risk Per Trade</h3>
          </div>
          <div className="horizontal-bars-stage">
            {riskData.map((r, i) => (
              <div key={i} className="hbar-row">
                <span className="hbar-label">{r.label}</span>
                <div className="hbar-track">
                  <div
                    className="hbar-fill"
                    style={{ width: `${Math.min(100, r.pct * 1.5)}%`, background: r.color }}
                  />
                </div>
                <span className="hbar-val">{r.pct}%</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* =========================================================================
          ROW 3: RECENT TRADES | DAILY PERFORMANCE (PIPS) CALENDAR | KEY METRICS
          ========================================================================= */}
      <div className="modern-charts-grid-row3">
        
        {/* 1. Recent Trades Table */}
        <div className="modern-panel recent-trades-panel">
          <div className="panel-top-bar">
            <div>
              <h3>Recent Trades</h3>
              <p className="panel-sub">Execution journal records</p>
            </div>
            <button
              type="button"
              className="panel-view-all"
              onClick={() => setIsFullScreenOpen(true)}
              title="Open all trades in full screen ledger (Esc to close)"
            >
              View All →
            </button>
          </div>

          <div className="modern-table-wrap">
            {recentTradesList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)' }}>
                <p style={{ fontSize: '0.82rem', marginBottom: '10px' }}>No recorded trades found in ledger.</p>
                {onOpenAddTrade && (
                  <button type="button" className="btn-primary" onClick={onOpenAddTrade} style={{ fontSize: '0.75rem', padding: '6px 12px' }}>
                    <Plus size={14} /> Add First Trade
                  </button>
                )}
              </div>
            ) : (
              <table className="modern-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Asset</th>
                    <th>Type</th>
                    <th>Entry</th>
                    <th>Exit</th>
                    <th>Pips</th>
                    <th>P&L ($)</th>
                    <th>R:R</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTradesList.map((t, i) => (
                    <tr key={i}>
                      <td className="cell-date">{t.date}</td>
                      <td className="cell-asset">{t.asset}</td>
                      <td>
                        <span className={`cell-type-badge ${t.type.toLowerCase()}`}>
                          {t.type}
                        </span>
                      </td>
                      <td className="cell-price">{t.entry}</td>
                      <td className="cell-price">{t.exit}</td>
                      <td className={`cell-pips ${t.isWin ? 'profit' : t.isLoss ? 'loss' : ''}`}>
                        {t.pips}
                      </td>
                      <td className={`cell-pnl ${t.isWin ? 'profit' : t.isLoss ? 'loss' : 'be'}`}>
                        {t.pnlUSD}
                      </td>
                      <td className="cell-rr">{t.rr}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* 2. Daily Performance (Pips) Calendar Heatmap */}
        <div className="modern-panel daily-pips-panel">
          <div className="panel-top-bar">
            <div>
              <h3>Daily Pips</h3>
              <p className="panel-sub">Day-by-day distribution</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                className="btn-month-nav"
                onClick={handlePrevMonth}
                title="Previous Month"
                aria-label="Previous Month"
              >
                <ChevronLeft size={15} />
              </button>

              <div className="panel-select-wrap">
                <select
                  style={{ colorScheme: 'dark' }}
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(e.target.value)}
                >
                  {availableMonths.map(m => (
                    <option key={m} value={m} style={{ backgroundColor: '#0d1726', color: '#ffffff' }}>
                      {m}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="select-arrow" />
              </div>

              <button
                type="button"
                className="btn-month-nav"
                onClick={handleNextMonth}
                title="Next Month"
                aria-label="Next Month"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>

          {/* Calendar Heatmap Grid */}
          <div className="calendar-heatmap-container">
            <div className="calendar-weekdays-header">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(w => (
                <span key={w} className="weekday-col-title">{w}</span>
              ))}
            </div>

            <div className="calendar-days-grid">
              {calendarDays.map((c) => (
                <div
                  key={c.day}
                  className={`calendar-day-cell ${c.status}`}
                  title={`${selectedMonth} ${c.day}: ${c.profitText ? c.profitText + ' Take Profit • ' : ''}${c.pips} Pips (${c.tradesCount} trade${c.tradesCount !== 1 ? 's' : ''})`}
                >
                  <span className="day-number">{c.day}</span>
                  {c.profitText && (
                    <span className="day-profit-text">{c.profitText}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 3. Key Metrics Card (Dynamic with P&L $ and Pips) */}
        <div className="modern-panel key-metrics-panel">
          <div className="panel-top-bar">
            <h3>Key Metrics</h3>
          </div>

          <div className="metrics-list-stack">
            {/* Avg Win */}
            <div className="metric-row-box">
              <div className="metric-row-left">
                <div className="metric-icon-wrap blue">
                  <Award size={18} />
                </div>
                <span className="metric-title">Avg Win</span>
              </div>
              <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                <span className="metric-num profit" style={{ fontSize: '0.98rem', fontWeight: '800' }}>{keyMetrics.avgWinUSD}</span>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: '700', fontFamily: 'var(--font-mono)' }}>{keyMetrics.avgWin}</span>
              </div>
            </div>

            {/* Avg Loss */}
            <div className="metric-row-box">
              <div className="metric-row-left">
                <div className="metric-icon-wrap purple">
                  <ArrowDownRight size={18} />
                </div>
                <span className="metric-title">Avg Loss</span>
              </div>
              <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                <span className="metric-num loss" style={{ fontSize: '0.98rem', fontWeight: '800' }}>{keyMetrics.avgLossUSD}</span>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: '700', fontFamily: 'var(--font-mono)' }}>{keyMetrics.avgLoss}</span>
              </div>
            </div>

            {/* Largest Win */}
            <div className="metric-row-box">
              <div className="metric-row-left">
                <div className="metric-icon-wrap teal">
                  <TrendingUp size={18} />
                </div>
                <span className="metric-title">Largest Win</span>
              </div>
              <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                <span className="metric-num teal" style={{ fontSize: '0.98rem', fontWeight: '800' }}>{keyMetrics.largestWinUSD}</span>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: '700', fontFamily: 'var(--font-mono)' }}>{keyMetrics.largestWin}</span>
              </div>
            </div>

            {/* Largest Loss */}
            <div className="metric-row-box">
              <div className="metric-row-left">
                <div className="metric-icon-wrap red">
                  <XCircle size={18} />
                </div>
                <span className="metric-title">Largest Loss</span>
              </div>
              <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                <span className="metric-num loss" style={{ fontSize: '0.98rem', fontWeight: '800' }}>{keyMetrics.largestLossUSD}</span>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: '700', fontFamily: 'var(--font-mono)' }}>{keyMetrics.largestLoss}</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Full-Screen Trades Ledger Modal with Cross Button */}
      {isFullScreenOpen && (
        <div
          className="fullscreen-trades-overlay"
          onClick={() => setIsFullScreenOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="fullscreen-trades-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="fullscreen-modal-header">
              <div className="fullscreen-header-left">
                <div className="fullscreen-badge">
                  <Layers size={13} />
                  <span>FULL SCREEN AUDIT LEDGER</span>
                </div>
                <h2>All Executed Trades</h2>
                <p>Complete verified ledger with search, filtering, and deep trade breakdown</p>
              </div>

              <div className="fullscreen-header-right">
                <button
                  type="button"
                  className="fullscreen-cross-close"
                  onClick={() => setIsFullScreenOpen(false)}
                  aria-label="Close full screen view"
                  title="Close (Esc)"
                >
                  <X size={22} />
                </button>
              </div>
            </div>

            <div className="fullscreen-modal-body">
              <TradesTableView
                initialTrades={allTrades}
                onTradeDeleted={onTradeUpdated}
                onClose={() => setIsFullScreenOpen(false)}
                isFullScreen={true}
                title="Complete Institutional Trade Journal"
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
