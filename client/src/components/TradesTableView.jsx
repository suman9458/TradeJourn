import React, { useState, useEffect, useMemo } from 'react';
import { Search, ChevronLeft, ChevronRight, Trash2, Filter, Eye, ArrowUpDown, X, FileText, Sparkles } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { exportTradeHistoryPDF } from '../utils/exportPDF';

import { getTradeTakeProfitUSD } from './ModernPipsDashboard';

const formatR = (val) => {
  const num = Number(val || 0);
  return `${num >= 0 ? '+' : ''}${num.toFixed(2)}R`;
};

const formatPnL = (trade) => {
  const pnlVal = getTradeTakeProfitUSD(trade);
  if (pnlVal > 0) return `+$${pnlVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (pnlVal < 0) return `-$${Math.abs(pnlVal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return '$0.00';
};

const matchesViewFilter = (trade, view) => {
  if (!trade) return false;
  if (!view || view === 'All Trades') return true;

  const now = new Date();
  const todayUtc = now.toISOString().slice(0, 10);
  const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const tradeDate = (trade.date || '').slice(0, 10);

  if (view === 'Today') {
    return tradeDate === todayUtc || tradeDate === todayLocal;
  }
  if (view === 'This Week') {
    const past7 = new Date();
    past7.setDate(now.getDate() - 7);
    return tradeDate >= past7.toISOString().slice(0, 10);
  }
  if (view === 'This Month') {
    const past30 = new Date();
    past30.setDate(now.getDate() - 30);
    return tradeDate >= past30.toISOString().slice(0, 10);
  }
  if (view === 'Winning Trades') {
    return trade.result === 'WIN' || Number(trade.rResult || trade.rr || 0) > 0 || Number(trade.pips || 0) > 0;
  }
  if (view === 'Losing Trades') {
    return trade.result === 'LOSS' || Number(trade.rResult || 0) < 0 || Number(trade.pips || 0) < 0;
  }
  if (view === 'A+ Trades') {
    return trade.setupRating === 'A+' || trade.tradeGrade === 'A+';
  }
  if (view === 'Early Exits') {
    const reason = trade.reasonEarlyExit || '';
    const hasReason = reason && !['None', '', 'TP Hit', 'SL Hit'].includes(reason);
    const hasMistake = Array.isArray(trade.mistakes) && trade.mistakes.some(m => ['Early Exit', 'Moved SL', 'Cut Winner Early'].includes(m));
    return Boolean(hasReason || hasMistake);
  }
  if (view === 'Emotional Trades') {
    const emotions = ['Fear', 'Greed', 'Impatient', 'Revenge', 'FOMO', 'Overconfident', 'Frustrated', 'Anxious', 'Hesitant', 'Bored'];
    const isEmo = emotions.includes(trade.emotion);
    const hasMistake = Array.isArray(trade.mistakes) && trade.mistakes.some(m => ['FOMO', 'Revenge Trading', 'Emotional Execution', 'Greed'].includes(m));
    return Boolean(isEmo || hasMistake);
  }
  if (view === 'Mistake Trades') {
    return Array.isArray(trade.mistakes) && trade.mistakes.some(m => m && m !== 'None' && m !== '');
  }
  if (view === 'London Session') {
    return (trade.session || '').includes('London');
  }
  if (view === 'New York Session') {
    return (trade.session || '').includes('New York');
  }
  if (view === 'Asian Session') {
    return (trade.session || '').includes('Asian') || (trade.session || '').includes('Tokyo');
  }
  return true;
};

export const TradesTableView = ({
  initialTrades = [],
  onTradeDeleted,
  title = 'Database Ledger & Trade History',
  onClose,
  isFullScreen = false
}) => {
  const { user } = useAuth();
  const [masterTrades, setMasterTrades] = useState(() => Array.isArray(initialTrades) && initialTrades.length > 0 ? initialTrades : []);
  const [trades, setTrades] = useState(() => Array.isArray(initialTrades) && initialTrades.length > 0 ? initialTrades : []);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(() => Array.isArray(initialTrades) ? initialTrades.length : 0);
  const [search, setSearch] = useState('');
  const [viewFilter, setViewFilter] = useState('All Trades');
  const [sortBy, setSortBy] = useState('date');
  const [order, setOrder] = useState('desc');
  const [selectedTrade, setSelectedTrade] = useState(null);
  const [seeding, setSeeding] = useState(false);

  const views = [
    'All Trades',
    'Today',
    'This Week',
    'This Month',
    'Winning Trades',
    'Losing Trades',
    'A+ Trades',
    'Early Exits',
    'Emotional Trades',
    'Mistake Trades',
    'London Session',
    'New York Session',
    'Asian Session'
  ];

  // Sync initialTrades when passed or updated from parent
  useEffect(() => {
    if (Array.isArray(initialTrades) && initialTrades.length > 0) {
      setMasterTrades(initialTrades);
    }
  }, [initialTrades]);

  // Load master pool once if initialTrades is empty
  useEffect(() => {
    const loadMasterList = async () => {
      try {
        if (!initialTrades || initialTrades.length === 0) {
          const res = await api.getTrades({ limit: 1000 });
          if (res?.success && Array.isArray(res.trades)) {
            setMasterTrades(res.trades);
          }
        }
      } catch (err) {
        console.warn('Could not load master trades pool:', err.message);
      }
    };
    loadMasterList();
  }, []);

  const pool = useMemo(() => {
    if (Array.isArray(masterTrades) && masterTrades.length > 0) return masterTrades;
    if (Array.isArray(initialTrades) && initialTrades.length > 0) return initialTrades;
    return [];
  }, [masterTrades, initialTrades]);

  // Compute dynamic badge counts for each view chip
  const viewCounts = useMemo(() => {
    const counts = {};
    for (const v of views) {
      if (v === 'All Trades') {
        counts[v] = pool.length;
      } else {
        counts[v] = pool.filter(t => matchesViewFilter(t, v)).length;
      }
    }
    return counts;
  }, [pool]);

  useEffect(() => {
    fetchTrades();
  }, [page, viewFilter, search, sortBy, order]);

  const handleSeedSampleTrades = async () => {
    try {
      setSeeding(true);
      const res = await api.seedSampleTrades();
      if (res?.success) {
        if (Array.isArray(res.trades)) {
          setMasterTrades(res.trades);
        }
        await fetchTrades();
        if (onTradeDeleted) onTradeDeleted();
      }
    } catch (err) {
      console.error('Failed to seed trades:', err);
    } finally {
      setSeeding(false);
    }
  };

  const fetchTrades = async () => {
    try {
      setLoading(true);
      const params = {
        page,
        limit: isFullScreen ? 20 : 15,
        sortBy,
        order,
        search: search.trim() || undefined,
        view: viewFilter !== 'All Trades' ? viewFilter : undefined
      };

      const res = await api.getTrades(params);
      if (res && res.success) {
        if (res.trades && res.trades.length > 0) {
          setTrades(res.trades);
          setTotalPages(res.totalPages || 1);
          setTotalCount(res.totalCount || res.trades.length);
          if (viewFilter === 'All Trades' && !search && res.trades.length > masterTrades.length) {
            setMasterTrades(res.trades);
          }
        } else {
          // If server returned 0 results or filter has local pool matches, fallback cleanly
          const localFiltered = pool.filter(t => {
            const matchesV = matchesViewFilter(t, viewFilter);
            if (!matchesV) return false;
            if (search.trim()) {
              const q = search.toLowerCase();
              return (
                (t.tradeName || '').toLowerCase().includes(q) ||
                (t.instrument || '').toLowerCase().includes(q) ||
                (t.notes || '').toLowerCase().includes(q)
              );
            }
            return true;
          });

          if (localFiltered.length > 0) {
            const pageSize = isFullScreen ? 20 : 15;
            const start = (page - 1) * pageSize;
            setTrades(localFiltered.slice(start, start + pageSize));
            setTotalCount(localFiltered.length);
            setTotalPages(Math.ceil(localFiltered.length / pageSize));
          } else {
            setTrades([]);
            setTotalCount(0);
            setTotalPages(1);
          }
        }
      } else if (pool.length > 0) {
        const localFiltered = pool.filter(t => matchesViewFilter(t, viewFilter));
        const pageSize = isFullScreen ? 20 : 15;
        const start = (page - 1) * pageSize;
        setTrades(localFiltered.slice(start, start + pageSize));
        setTotalCount(localFiltered.length);
        setTotalPages(Math.ceil(localFiltered.length / pageSize));
      }
    } catch (err) {
      console.error('Failed to fetch trades:', err);
      if (pool.length > 0) {
        const localFiltered = pool.filter(t => matchesViewFilter(t, viewFilter));
        const pageSize = isFullScreen ? 20 : 15;
        const start = (page - 1) * pageSize;
        setTrades(localFiltered.slice(start, start + pageSize));
        setTotalCount(localFiltered.length);
        setTotalPages(Math.ceil(localFiltered.length / pageSize));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setOrder(order === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setOrder('desc');
    }
    setPage(1);
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (confirm('Delete this trade record permanently from MongoDB?')) {
      await api.deleteTrade(id);
      setMasterTrades(prev => prev.filter(t => (t._id || t.id) !== id));
      fetchTrades();
      if (onTradeDeleted) onTradeDeleted();
    }
  };

  const handleExportPDF = async () => {
    try {
      let tradesToExport = [];
      try {
        const res = await api.getTrades({
          limit: 5000,
          sortBy,
          order,
          search: search.trim() || undefined,
          view: viewFilter !== 'All Trades' ? viewFilter : undefined
        });
        if (res?.success && Array.isArray(res.trades) && res.trades.length > 0) {
          tradesToExport = res.trades;
        }
      } catch (e) {
        console.warn('API fetch for PDF export failed:', e);
      }

      // Robust Fallbacks if API query returned 0 trades or failed
      if (!tradesToExport || tradesToExport.length === 0) {
        if (pool && pool.length > 0) {
          tradesToExport = pool.filter(t => matchesViewFilter(t, viewFilter));
        }
      }
      if (!tradesToExport || tradesToExport.length === 0) {
        tradesToExport = pool.length > 0 ? pool : masterTrades.length > 0 ? masterTrades : trades;
      }

      exportTradeHistoryPDF({
        trades: tradesToExport || [],
        user
      });
    } catch (err) {
      alert('Failed to generate PDF: ' + err.message);
    }
  };

  return (
    <div className="dashboard-panel">
      {/* Header & Search Bar */}
      <div className="panel-header" style={{ flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h3>{title}</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: '3px' }}>
            {totalCount} total audited executions in database
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', minWidth: '240px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search ticker, level, notes..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              style={{ paddingLeft: '38px', paddingRight: search ? '32px' : '14px' }}
            />
            {search && (
              <button
                className="btn-ghost"
                onClick={() => setSearch('')}
                style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', padding: '4px' }}
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleExportPDF}
            style={{ fontSize: '0.82rem', padding: '7px 14px', whiteSpace: 'nowrap' }}
            title="Download full audited trade history as PDF with proper columns & rows"
          >
            <FileText size={15} />
            <span>Download PDF</span>
          </button>
        </div>
      </div>

      {/* Filter Quick Chips */}
      <div style={{
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap',
        marginBottom: '20px',
        paddingBottom: '16px',
        borderBottom: '1px solid var(--border-subtle)',
        alignItems: 'center'
      }}>
        {views.map(v => {
          const isActive = viewFilter === v;
          const count = viewCounts[v] ?? 0;
          return (
            <button
              key={v}
              className={isActive ? 'btn-primary' : 'btn-secondary'}
              style={{
                fontSize: '0.8rem',
                padding: '6px 14px',
                borderRadius: 'var(--radius-pill)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                fontWeight: isActive ? '700' : '500',
                transition: 'all 0.15s ease',
                cursor: 'pointer'
              }}
              onClick={() => { setViewFilter(v); setPage(1); }}
            >
              <span>{v}</span>
              <span style={{
                fontSize: '0.72rem',
                padding: '1px 7px',
                borderRadius: '10px',
                background: isActive ? 'rgba(0, 0, 0, 0.22)' : 'rgba(255, 255, 255, 0.08)',
                color: isActive ? '#03130d' : 'var(--text-secondary)',
                fontWeight: '700',
                letterSpacing: '0.01em'
              }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="table-responsive">
        <table>
          <thead>
            <tr>
              <th onClick={() => handleSort('tradeName')} style={{ cursor: 'pointer' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  Trade Identifier <ArrowUpDown size={12} />
                </span>
              </th>
              <th onClick={() => handleSort('date')} style={{ cursor: 'pointer' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  Timestamp <ArrowUpDown size={12} />
                </span>
              </th>
              <th onClick={() => handleSort('instrument')} style={{ cursor: 'pointer' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  Ticker <ArrowUpDown size={12} />
                </span>
              </th>
              <th>Session</th>
              <th>Setup Quality</th>
              <th onClick={() => handleSort('result')} style={{ cursor: 'pointer' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  Outcome <ArrowUpDown size={12} />
                </span>
              </th>
              <th onClick={() => handleSort('rResult')} style={{ cursor: 'pointer' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  Net R <ArrowUpDown size={12} />
                </span>
              </th>
              <th>Pips</th>
              <th>P&L ($)</th>
              <th>Discipline</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="10" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>Querying MongoDB ledger...</td></tr>
            ) : trades.length === 0 ? (
              <tr>
                <td colSpan="10" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                    <p style={{ margin: 0, fontSize: '0.92rem', color: '#94a3b8' }}>No trade records match your filter criteria.</p>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={handleSeedSampleTrades}
                      disabled={seeding}
                      style={{ fontSize: '0.82rem', padding: '8px 18px', display: 'inline-flex', alignItems: 'center', gap: '8px', borderRadius: 'var(--radius-sm)' }}
                    >
                      <Sparkles size={15} />
                      <span>{seeding ? 'Seeding Trades...' : 'Seed Realistic Institutional Trades'}</span>
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              trades.map(trade => (
                <tr
                  key={trade._id}
                  onClick={() => setSelectedTrade(trade)}
                  style={{ cursor: 'pointer' }}
                >
                  <td style={{ fontWeight: '700', color: 'var(--text-white)' }}>{trade.tradeName}</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{trade.date} {trade.time}</td>
                  <td>
                    <span style={{ fontWeight: '800', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
                      {trade.instrument}
                    </span>
                  </td>
                  <td>{trade.session}</td>
                  <td>
                    <span className={`pill-grade ${(trade.setupRating || '').toLowerCase().replace(/[^a-z]/g, '')}`}>
                      {trade.setupRating}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${trade.result === 'WIN' ? 'badge-win' : trade.result === 'LOSS' ? 'badge-loss' : 'badge-be'}`}>
                      {trade.result}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: '800', color: trade.rResult >= 0 ? 'var(--profit)' : 'var(--loss)' }}>
                    {formatR(trade.rResult)}
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{trade.pips}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: '800', color: trade.result === 'WIN' ? 'var(--profit)' : trade.result === 'LOSS' ? 'var(--loss)' : 'var(--text-muted)' }}>
                    {formatPnL(trade)}
                  </td>
                  <td>
                    <span style={{ fontSize: '0.82rem', fontWeight: '800', fontFamily: 'var(--font-mono)', color: trade.disciplineScore >= 75 ? 'var(--profit)' : 'var(--warning)' }}>
                      {trade.disciplineScore}/100
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="btn-ghost"
                      onClick={(e) => handleDelete(trade._id, e)}
                      style={{ padding: '6px', color: 'var(--text-muted)' }}
                      title="Delete Trade"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '18px', paddingTop: '14px', borderTop: '1px solid var(--border-subtle)' }}>
        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          Displaying page {page} of {totalPages} ({totalCount} verified records)
        </span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn-secondary"
            disabled={page <= 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
            style={{ padding: '6px 14px', fontSize: '0.8rem' }}
          >
            <ChevronLeft size={16} />
            <span>Previous</span>
          </button>
          <button
            className="btn-secondary"
            disabled={page >= totalPages}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            style={{ padding: '6px 14px', fontSize: '0.8rem' }}
          >
            <span>Next</span>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Trade Detail Slide-Over Modal */}
      {selectedTrade && (
        <div className="modal-overlay" onClick={() => setSelectedTrade(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '680px' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: '1.25rem' }}>{selectedTrade.tradeName}</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: '3px' }}>
                  {selectedTrade.date} at {selectedTrade.time} • {selectedTrade.instrument} ({selectedTrade.session})
                </p>
              </div>
              <button className="btn-close" onClick={() => setSelectedTrade(null)}>
                <X size={20} />
              </button>
            </div>

            {/* Quick Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '20px' }}>
              <div style={{ background: 'var(--bg-card)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>PnL Return</span>
                <p style={{ fontSize: '1.15rem', fontWeight: '800', color: selectedTrade.result === 'WIN' ? 'var(--profit)' : selectedTrade.result === 'LOSS' ? 'var(--loss)' : 'var(--text-muted)' }}>
                  {selectedTrade.result} ({formatR(selectedTrade.rResult)}) • {formatPnL(selectedTrade)}
                </p>
              </div>

              <div style={{ background: 'var(--bg-card)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>Discipline Audit</span>
                <p style={{ fontSize: '1.3rem', fontWeight: '800', color: selectedTrade.disciplineScore >= 75 ? 'var(--profit)' : 'var(--warning)' }}>
                  {selectedTrade.disciplineScore}/100 ({selectedTrade.tradeGrade})
                </p>
              </div>

              <div style={{ background: 'var(--bg-card)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>Setup & Emotion</span>
                <p style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--text-white)' }}>
                  {selectedTrade.setupRating} • {selectedTrade.emotion}
                </p>
              </div>
            </div>

            {/* Comprehensive Execution Breakdown */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.88rem', background: 'rgba(6,12,20,0.6)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
              <p><strong>Session:</strong> <span style={{ color: 'var(--text-secondary)' }}>{selectedTrade.session}</span></p>
              <p><strong>Technical Level:</strong> <span style={{ color: 'var(--text-secondary)' }}>{selectedTrade.levelTraded || '-'}</span></p>
              <p><strong>Entry Trigger:</strong> <span style={{ color: 'var(--text-secondary)' }}>{selectedTrade.entryType}</span></p>
              <p><strong>Take Profit (USD):</strong> <span style={{ color: 'var(--profit)', fontFamily: 'var(--font-mono)', fontWeight: '700' }}>
                ${(() => {
                  let tp = selectedTrade.takeProfit ?? selectedTrade.takeProfitUSD;
                  if (!tp) {
                    try {
                      const overrides = JSON.parse(localStorage.getItem('tradejourn_tp_overrides') || '{}');
                      tp = overrides[selectedTrade._id] || overrides[`${selectedTrade.tradeName}_${selectedTrade.date}_${selectedTrade.time || '00:00'}`] || overrides[`${selectedTrade.date}_${selectedTrade.time || '00:00'}`];
                    } catch (e) {}
                  }
                  return tp || 0;
                })()}
              </span></p>
              <p><strong>Market Regime:</strong> <span style={{ color: 'var(--text-secondary)' }}>{selectedTrade.marketCondition}</span></p>
              <p><strong>Prop Firm Challenge:</strong> <span style={{ color: selectedTrade.isPropTrade === true ? 'var(--profit)' : 'var(--text-muted)', fontWeight: '700' }}>{selectedTrade.isPropTrade === true ? 'Yes (Counted)' : 'No (Excluded)'}</span></p>
              <p><strong>Early Exit Catalyst:</strong> <span style={{ color: 'var(--text-secondary)' }}>{selectedTrade.reasonEarlyExit}</span></p>
              <p className="span-full"><strong>Mistakes Recorded:</strong> <span style={{ color: '#ff6685' }}>{(selectedTrade.mistakes || []).join(', ') || 'None (Clean Execution)'}</span></p>
            </div>

            {/* Notes Section */}
            <div style={{ marginTop: '16px', background: 'rgba(4,9,15,0.7)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
              <p style={{ color: 'var(--accent-cyan)', fontSize: '0.74rem', textTransform: 'uppercase', fontWeight: '800', marginBottom: '6px' }}>
                Trader Execution Notes
              </p>
              <p style={{ color: 'var(--text-primary)', lineHeight: '1.5', fontSize: '0.9rem' }}>
                {selectedTrade.notes || 'No execution notes entered for this trade.'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
