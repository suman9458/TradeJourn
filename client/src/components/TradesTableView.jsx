import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, ChevronLeft, ChevronRight, Trash2, Filter, Eye, ArrowUpDown, X, FileText, Sparkles, Camera, Image as ImageIcon, UploadCloud, Maximize2, LayoutGrid, List, Plus, Download } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { exportTradeHistoryPDF } from '../utils/exportPDF';
import { compressImageFile } from '../utils/imageHelper';

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
  const [detailZoom, setDetailZoom] = useState(false);
  const [updatingImage, setUpdatingImage] = useState(false);
  const [layoutMode, setLayoutMode] = useState('table'); // 'table' | 'gallery'
  const [lightboxImage, setLightboxImage] = useState(null);
  const [activeChartTrade, setActiveChartTrade] = useState(null);
  const [uploadingChart, setUploadingChart] = useState(false);
  const [chartUrlInput, setChartUrlInput] = useState('');
  const [isChartDragging, setIsChartDragging] = useState(false);
  const chartUploadInputRef = useRef(null);
  const detailFileInputRef = useRef(null);
  const [seeding, setSeeding] = useState(false);

  // Clipboard paste support while Chart Modal is open
  useEffect(() => {
    if (!activeChartTrade) return;

    const handleWindowPaste = async (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            handleSaveChartForTrade(activeChartTrade, file);
          }
          break;
        }
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setActiveChartTrade(null);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('paste', handleWindowPaste);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('paste', handleWindowPaste);
    };
  }, [activeChartTrade]);

  const handleSaveChartForTrade = async (targetTrade, fileOrUrl) => {
    if (!targetTrade) return;
    try {
      setUploadingChart(true);
      let dataUrl = fileOrUrl;
      if (typeof fileOrUrl !== 'string') {
        dataUrl = await compressImageFile(fileOrUrl);
      }
      const updated = { ...targetTrade, screenshotUrl: dataUrl, imageUrl: dataUrl };
      await api.updateTrade(targetTrade._id, { screenshotUrl: dataUrl, imageUrl: dataUrl });
      setActiveChartTrade(updated);
      setTrades(prev => prev.map(t => t._id === targetTrade._id ? updated : t));
      setMasterTrades(prev => prev.map(t => t._id === targetTrade._id ? updated : t));
    } catch (err) {
      alert('Failed to save chart image: ' + err.message);
    } finally {
      setUploadingChart(false);
      if (chartUploadInputRef.current) chartUploadInputRef.current.value = '';
    }
  };

  const handleRemoveActiveChart = async () => {
    if (!activeChartTrade) return;
    try {
      setUploadingChart(true);
      const updated = { ...activeChartTrade, screenshotUrl: '', imageUrl: '' };
      await api.updateTrade(activeChartTrade._id, { screenshotUrl: '', imageUrl: '' });
      setActiveChartTrade(updated);
      setTrades(prev => prev.map(t => t._id === activeChartTrade._id ? updated : t));
      setMasterTrades(prev => prev.map(t => t._id === activeChartTrade._id ? updated : t));
    } catch (err) {
      alert('Failed to remove chart image: ' + err.message);
    } finally {
      setUploadingChart(false);
    }
  };

  const handleUpdateTradeImage = async (file) => {
    if (!file || !selectedTrade) return;
    try {
      setUpdatingImage(true);
      const dataUrl = await compressImageFile(file);
      const updated = { ...selectedTrade, screenshotUrl: dataUrl, imageUrl: dataUrl };
      await api.updateTrade(selectedTrade._id, { screenshotUrl: dataUrl, imageUrl: dataUrl });
      setSelectedTrade(updated);
      setTrades(prev => prev.map(t => t._id === selectedTrade._id ? updated : t));
      setMasterTrades(prev => prev.map(t => t._id === selectedTrade._id ? updated : t));
    } catch (err) {
      alert('Failed to update trade image: ' + err.message);
    } finally {
      setUpdatingImage(false);
      if (detailFileInputRef.current) detailFileInputRef.current.value = '';
    }
  };

  const handleRemoveTradeImage = async () => {
    if (!selectedTrade) return;
    try {
      setUpdatingImage(true);
      const updated = { ...selectedTrade, screenshotUrl: '', imageUrl: '' };
      await api.updateTrade(selectedTrade._id, { screenshotUrl: '', imageUrl: '' });
      setSelectedTrade(updated);
      setTrades(prev => prev.map(t => t._id === selectedTrade._id ? updated : t));
      setMasterTrades(prev => prev.map(t => t._id === selectedTrade._id ? updated : t));
    } catch (err) {
      alert('Failed to remove trade image: ' + err.message);
    } finally {
      setUpdatingImage(false);
    }
  };

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
      setTrades(prev => (prev.length === 0 && viewFilter === 'All Trades' && !search) ? initialTrades.slice(0, isFullScreen ? 20 : 15) : prev);
      setTotalCount(prev => prev === 0 ? initialTrades.length : prev);
      setTotalPages(prev => prev <= 1 ? Math.ceil(initialTrades.length / (isFullScreen ? 20 : 15)) : prev);
    }
  }, [initialTrades, isFullScreen, viewFilter, search]);

  // Load master pool once if initialTrades is empty
  useEffect(() => {
    let isSubscribed = true;
    const loadMasterList = async () => {
      try {
        if (!initialTrades || initialTrades.length === 0) {
          const res = await api.getTrades({ limit: 1000 });
          if (isSubscribed && res?.success && Array.isArray(res.trades)) {
            setMasterTrades(res.trades);
            setTrades(prev => (prev.length === 0 && viewFilter === 'All Trades' && !search) ? res.trades.slice(0, isFullScreen ? 20 : 15) : prev);
            setTotalCount(prev => prev === 0 ? res.trades.length : prev);
            setTotalPages(prev => prev <= 1 ? Math.ceil(res.trades.length / (isFullScreen ? 20 : 15)) : prev);
          }
        }
      } catch (err) {
        console.warn('Could not load master trades pool:', err.message);
      }
    };
    loadMasterList();
    return () => { isSubscribed = false; };
  }, [initialTrades, isFullScreen]);

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
        order
      };
      if (search && search.trim()) {
        params.search = search.trim();
      }
      if (viewFilter && viewFilter !== 'All Trades') {
        params.view = viewFilter;
      }

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
          const availablePool = (Array.isArray(masterTrades) && masterTrades.length > 0) ? masterTrades : pool;
          const localFiltered = availablePool.filter(t => {
            const matchesV = matchesViewFilter(t, viewFilter);
            if (!matchesV) return false;
            if (search.trim()) {
              const q = search.toLowerCase();
              return (
                (t.tradeName || '').toLowerCase().includes(q) ||
                (t.instrument || '').toLowerCase().includes(q) ||
                (t.notes || '').toLowerCase().includes(q) ||
                (t.levelTraded || '').toLowerCase().includes(q)
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

        <div className="ledger-header-controls">
          <div className="ledger-search-box">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Search ticker, level, notes..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
            {search && (
              <button
                className="btn-ghost search-clear-btn"
                onClick={() => setSearch('')}
              >
                <X size={14} />
              </button>
            )}
          </div>
          <div className="ledger-view-switcher">
            <button
              type="button"
              className={layoutMode === 'table' ? 'btn-primary' : 'btn-ghost'}
              onClick={() => setLayoutMode('table')}
              style={{
                padding: '6px 12px',
                fontSize: '0.78rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                borderRadius: '6px',
                fontWeight: layoutMode === 'table' ? '700' : '500'
              }}
              title="Table Ledger View"
            >
              <List size={14} />
              <span>Ledger</span>
            </button>
            <button
              type="button"
              className={layoutMode === 'gallery' ? 'btn-primary' : 'btn-ghost'}
              onClick={() => setLayoutMode('gallery')}
              style={{
                padding: '6px 12px',
                fontSize: '0.78rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                borderRadius: '6px',
                fontWeight: layoutMode === 'gallery' ? '700' : '500'
              }}
              title="Visual Chart Gallery View"
            >
              <LayoutGrid size={14} />
              <span>Visual Gallery</span>
            </button>
          </div>

          <button
            type="button"
            className="btn-secondary ledger-pdf-btn"
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
      <div className="ledger-filter-chips-container">
        {views.map(v => {
          const isActive = viewFilter === v;
          const count = viewCounts[v] ?? 0;
          return (
            <button
              key={v}
              type="button"
              className={`ledger-filter-pill ${isActive ? 'active' : ''}`}
              onClick={() => { setViewFilter(v); setPage(1); }}
            >
              <span>{v}</span>
              <span className={`ledger-pill-count ${isActive ? 'active' : ''}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Visual Presentation: Table Ledger OR Visual Gallery */}
      {layoutMode === 'gallery' ? (
        <div style={{ marginBottom: '24px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Querying MongoDB ledger...</div>
          ) : trades.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
              <p style={{ margin: 0, fontSize: '0.92rem', color: '#94a3b8', marginBottom: '12px' }}>No trade records match your filter criteria.</p>
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
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '16px' }}>
              {trades.map(trade => {
                const hasImg = Boolean(trade.screenshotUrl || trade.imageUrl);
                const isWin = trade.result === 'WIN';
                const isLoss = trade.result === 'LOSS';
                return (
                  <div
                    key={trade._id}
                    onClick={() => setSelectedTrade(trade)}
                    style={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      flexDirection: 'column'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = 'var(--border-bright)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = 'var(--border-subtle)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    {/* Chart Banner */}
                    <div
                      style={{
                        height: '170px',
                        position: 'relative',
                        background: '#04080e',
                        borderBottom: '1px solid var(--border-subtle)',
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      {hasImg ? (
                        <>
                          <img
                            src={trade.screenshotUrl || trade.imageUrl}
                            alt={trade.tradeName}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveChartTrade(trade);
                            }}
                            title="Click to view chart (only chart)"
                            style={{
                              position: 'absolute',
                              bottom: '8px',
                              right: '8px',
                              background: 'rgba(3, 6, 11, 0.85)',
                              border: '1px solid rgba(255, 255, 255, 0.2)',
                              borderRadius: '6px',
                              color: '#ffffff',
                              padding: '4px 8px',
                              fontSize: '0.72rem',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              backdropFilter: 'blur(4px)'
                            }}
                          >
                            <Maximize2 size={12} /> View Chart
                          </button>
                        </>
                      ) : (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveChartTrade(trade);
                          }}
                          style={{ textAlign: 'center', color: 'var(--accent-cyan)', padding: '20px', cursor: 'pointer' }}
                        >
                          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '3px', width: '42px', height: '42px', borderRadius: '50%', background: 'rgba(0, 210, 255, 0.1)', border: '1px dashed var(--accent-cyan)', margin: '0 auto 8px' }}>
                            <Camera size={16} />
                            <Plus size={12} strokeWidth={3} />
                          </div>
                          <span style={{ fontSize: '0.78rem', display: 'block', fontWeight: '600' }}>+ Add Chart Image</span>
                        </div>
                      )}

                      {/* Result Badge */}
                      <div style={{ position: 'absolute', top: '10px', left: '10px' }}>
                        <span className={`badge ${isWin ? 'badge-win' : isLoss ? 'badge-loss' : 'badge-be'}`}>
                          {trade.result} {formatR(trade.rResult)}
                        </span>
                      </div>

                      {/* Setup Quality Pill */}
                      <div style={{ position: 'absolute', top: '10px', right: '10px' }}>
                        <span className={`pill-grade ${(trade.setupRating || '').toLowerCase().replace(/[^a-z]/g, '')}`}>
                          {trade.setupRating}
                        </span>
                      </div>
                    </div>

                    {/* Card Content */}
                    <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <strong style={{ fontSize: '1rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
                            {trade.instrument}
                          </strong>
                          <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                            {trade.date} {trade.time}
                          </span>
                        </div>
                        <p style={{ fontSize: '0.86rem', fontWeight: '600', color: 'var(--text-white)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {trade.tradeName}
                        </p>
                      </div>

                      {/* Metrics Bar */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', background: 'rgba(6, 12, 20, 0.6)', padding: '8px', borderRadius: '8px', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
                        <div>
                          <span style={{ fontSize: '0.64rem', color: 'var(--text-muted)', display: 'block' }}>P&L</span>
                          <strong style={{ fontSize: '0.84rem', fontFamily: 'var(--font-mono)', color: isWin ? 'var(--profit)' : isLoss ? 'var(--loss)' : 'var(--text-muted)' }}>
                            {formatPnL(trade)}
                          </strong>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.64rem', color: 'var(--text-muted)', display: 'block' }}>PIPS</span>
                          <strong style={{ fontSize: '0.84rem', fontFamily: 'var(--font-mono)' }}>
                            {trade.pips || 0}
                          </strong>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.64rem', color: 'var(--text-muted)', display: 'block' }}>DISCIPLINE</span>
                          <strong style={{ fontSize: '0.84rem', fontFamily: 'var(--font-mono)', color: trade.disciplineScore >= 75 ? 'var(--profit)' : 'var(--warning)' }}>
                            {trade.disciplineScore}/100
                          </strong>
                        </div>
                      </div>

                      {/* Notes snippet */}
                      {trade.notes && (
                        <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: '1.4' }}>
                          {trade.notes}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Table View */
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th style={{ width: '58px', textAlign: 'center' }}>Chart</th>
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
                <th>Side</th>
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
                <tr><td colSpan="13" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>Querying MongoDB ledger...</td></tr>
              ) : trades.length === 0 ? (
                <tr>
                  <td colSpan="13" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
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
                    {/* Dedicated Chart Column: Only chart view or add icon */}
                    <td style={{ width: '58px', padding: '6px 8px', textAlign: 'center' }}>
                      {(trade.screenshotUrl || trade.imageUrl) ? (
                        <div
                          className="table-chart-thumb"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveChartTrade(trade);
                          }}
                          title="Click to view chart (only chart)"
                        >
                          <img
                            src={trade.screenshotUrl || trade.imageUrl}
                            alt="Trade Chart"
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                          />
                        </div>
                      ) : (
                        <div
                          className="table-chart-add-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveChartTrade(trade);
                          }}
                          title="Add chart image"
                        >
                          <Camera size={13} />
                          <Plus size={10} strokeWidth={3} />
                        </div>
                      )}
                    </td>

                    <td style={{ fontWeight: '700', color: 'var(--text-white)' }}>
                      {trade.tradeName}
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{trade.date} {trade.time}</td>
                    <td>
                      <span style={{ fontWeight: '800', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
                        {trade.instrument}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`badge ${trade.direction === 'Sell' || (!trade.direction && trade.bias === 'Bearish') ? 'badge-loss' : 'badge-win'}`}
                        style={{ fontSize: '0.72rem', padding: '2px 7px', fontWeight: '800', letterSpacing: '0.02em' }}
                      >
                        {trade.direction === 'Sell' || (!trade.direction && trade.bias === 'Bearish') ? '▼ SELL' : '▲ BUY'}
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
      )}

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
              <div className="detail-stat-card">
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>PnL Return</span>
                <p style={{ fontSize: '1.15rem', fontWeight: '800', color: selectedTrade.result === 'WIN' ? 'var(--profit)' : selectedTrade.result === 'LOSS' ? 'var(--loss)' : 'var(--text-muted)' }}>
                  {selectedTrade.result} ({formatR(selectedTrade.rResult)}) • {formatPnL(selectedTrade)}
                </p>
              </div>

              <div className="detail-stat-card">
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>Discipline Audit</span>
                <p style={{ fontSize: '1.3rem', fontWeight: '800', color: selectedTrade.disciplineScore >= 75 ? 'var(--profit)' : 'var(--warning)' }}>
                  {selectedTrade.disciplineScore}/100 ({selectedTrade.tradeGrade})
                </p>
              </div>

              <div className="detail-stat-card">
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>Setup & Emotion</span>
                <p style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--text-white)' }}>
                  {selectedTrade.setupRating} • {selectedTrade.emotion}
                </p>
              </div>
            </div>

            {/* Comprehensive Execution Breakdown */}
            <div className="detail-breakdown-card" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.88rem', padding: '16px', borderRadius: '10px' }}>
              <p>
                <strong>Trade Side:</strong>{' '}
                <button
                  type="button"
                  onClick={async () => {
                    const isCurrentlySell = selectedTrade.direction === 'Sell' || (!selectedTrade.direction && selectedTrade.bias === 'Bearish');
                    const newDir = isCurrentlySell ? 'Buy' : 'Sell';
                    const newBias = isCurrentlySell ? 'Bullish' : 'Bearish';
                    try {
                      await api.updateTrade(selectedTrade._id, { direction: newDir, bias: newBias });
                      const updated = { ...selectedTrade, direction: newDir, bias: newBias };
                      setSelectedTrade(updated);
                      setTrades(prev => prev.map(t => t._id === selectedTrade._id ? updated : t));
                      setMasterTrades(prev => prev.map(t => t._id === selectedTrade._id ? updated : t));
                    } catch (e) {
                      alert('Failed to update direction: ' + e.message);
                    }
                  }}
                  title="Click to toggle BUY / SELL"
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    marginLeft: '4px'
                  }}
                >
                  <span className={`badge ${selectedTrade.direction === 'Sell' || (!selectedTrade.direction && selectedTrade.bias === 'Bearish') ? 'badge-loss' : 'badge-win'}`} style={{ cursor: 'pointer', padding: '3px 8px' }}>
                    {selectedTrade.direction === 'Sell' || (!selectedTrade.direction && selectedTrade.bias === 'Bearish') ? '▼ SELL (Click to switch)' : '▲ BUY (Click to switch)'}
                  </span>
                </button>
              </p>
              <p><strong>Macro Bias:</strong> <span style={{ color: 'var(--text-secondary)' }}>{selectedTrade.bias || 'Bullish'}</span></p>
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
            <div className="detail-notes-card" style={{ marginTop: '16px', padding: '14px', borderRadius: '10px' }}>
              <p style={{ color: 'var(--accent-cyan)', fontSize: '0.74rem', textTransform: 'uppercase', fontWeight: '800', marginBottom: '6px' }}>
                Trader Execution Notes
              </p>
              <p style={{ color: 'var(--text-primary)', lineHeight: '1.5', fontSize: '0.9rem' }}>
                {selectedTrade.notes || 'No execution notes entered for this trade.'}
              </p>
            </div>

            {/* Chart Screenshot & Technical Execution Card */}
            <div className="detail-chart-card" style={{ marginTop: '16px', padding: '16px', borderRadius: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Camera size={16} style={{ color: 'var(--accent-cyan)' }} />
                  <span style={{ fontSize: '0.78rem', color: 'var(--accent-cyan)', textTransform: 'uppercase', fontWeight: '800' }}>
                    Chart Screenshot & Technical Execution
                  </span>
                  <span style={{ fontSize: '0.68rem', background: 'rgba(148, 163, 184, 0.14)', color: 'var(--text-secondary)', padding: '2px 6px', borderRadius: 'var(--radius-pill)', fontWeight: '600' }}>
                    Optional
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="file"
                    ref={detailFileInputRef}
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={e => e.target.files?.[0] && handleUpdateTradeImage(e.target.files[0])}
                  />
                  {(selectedTrade.screenshotUrl || selectedTrade.imageUrl) ? (
                    <>
                      <button
                        type="button"
                        className="btn-ghost"
                        style={{ fontSize: '0.74rem', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                        onClick={() => setDetailZoom(true)}
                      >
                        <Maximize2 size={13} /> Fullscreen
                      </button>
                      <button
                        type="button"
                        className="btn-ghost"
                        style={{ fontSize: '0.74rem', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-cyan)' }}
                        onClick={() => detailFileInputRef.current?.click()}
                        disabled={updatingImage}
                      >
                        <UploadCloud size={13} /> Replace
                      </button>
                      <button
                        type="button"
                        className="btn-ghost"
                        style={{ fontSize: '0.74rem', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--loss)' }}
                        onClick={handleRemoveTradeImage}
                        disabled={updatingImage}
                      >
                        <Trash2 size={13} /> Remove
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ fontSize: '0.74rem', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-cyan)' }}
                      onClick={() => detailFileInputRef.current?.click()}
                      disabled={updatingImage}
                    >
                      <UploadCloud size={13} /> {updatingImage ? 'Attaching...' : '+ Attach Chart Image'}
                    </button>
                  )}
                </div>
              </div>

              {(selectedTrade.screenshotUrl || selectedTrade.imageUrl) ? (
                <div
                  style={{
                    position: 'relative',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    border: '1px solid var(--border-bright)',
                    cursor: 'pointer',
                    background: '#04080e',
                    textAlign: 'center'
                  }}
                  onClick={() => setDetailZoom(true)}
                >
                  <img
                    src={selectedTrade.screenshotUrl || selectedTrade.imageUrl}
                    alt="Trade Chart Setup"
                    style={{
                      width: '100%',
                      maxHeight: '320px',
                      objectFit: 'contain',
                      display: 'block'
                    }}
                  />
                  <div style={{ position: 'absolute', bottom: '8px', right: '8px', background: 'rgba(0,0,0,0.7)', padding: '3px 8px', borderRadius: '4px', fontSize: '0.7rem', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Maximize2 size={11} /> Click to expand
                  </div>
                </div>
              ) : (
                <div
                  className="detail-chart-empty"
                  onClick={() => detailFileInputRef.current?.click()}
                  style={{
                    borderRadius: '8px',
                    padding: '20px',
                    textAlign: 'center',
                    cursor: 'pointer'
                  }}
                >
                  <Camera size={22} style={{ color: 'var(--text-muted)', margin: '0 auto 6px', display: 'block' }} />
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
                    No chart image attached yet. Click to attach an optional screenshot.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Modal for Detail Zoom */}
      {detailZoom && selectedTrade && (selectedTrade.screenshotUrl || selectedTrade.imageUrl) && (
        <div className="modal-overlay" style={{ zIndex: 120000 }} onClick={() => setDetailZoom(false)}>
          <div
            style={{
              maxWidth: '92vw',
              maxHeight: '92vh',
              position: 'relative',
              background: '#04080e',
              padding: '12px',
              borderRadius: '12px',
              border: '1px solid var(--border-bright)',
              boxShadow: '0 20px 50px rgba(0,0,0,0.9)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <button
              type="button"
              className="btn-close"
              onClick={() => setDetailZoom(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                zIndex: 2,
                background: 'rgba(0,0,0,0.7)',
                borderRadius: '50%'
              }}
            >
              <X size={20} />
            </button>
            <img
              src={selectedTrade.screenshotUrl || selectedTrade.imageUrl}
              alt="Trade Chart Setup Enlarged"
              style={{
                maxWidth: '90vw',
                maxHeight: '88vh',
                objectFit: 'contain',
                display: 'block',
                borderRadius: '8px'
              }}
            />
          </div>
        </div>
      )}

      {/* =========================================================================
          DEDICATED CHART MODAL - SHOWS ONLY CHART (NO OTHER TRADE DATA)
          OR CLEAN "ADD CHART" INTERFACE IF NO IMAGE IS ATTACHED
          ========================================================================= */}
      {activeChartTrade && (
        <div className="modal-overlay" style={{ zIndex: 125000 }} onClick={() => setActiveChartTrade(null)}>
          <div
            className="chart-preview-modal-card"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: (activeChartTrade.screenshotUrl || activeChartTrade.imageUrl) ? '95vw' : '520px',
              width: '100%',
              maxHeight: '94vh',
              position: 'relative',
              padding: (activeChartTrade.screenshotUrl || activeChartTrade.imageUrl) ? '14px 18px' : '22px 24px',
              borderRadius: '16px',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Hidden file input for this trade */}
            <input
              type="file"
              ref={chartUploadInputRef}
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => e.target.files?.[0] && handleSaveChartForTrade(activeChartTrade, e.target.files[0])}
            />

            {(activeChartTrade.screenshotUrl || activeChartTrade.imageUrl) ? (
              /* SHOW ONLY CHART IMAGE - ZERO OTHER TRADE DATA */
              <>
                {/* Minimal Top Control Bar (No Trade Metadata) */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '10px'
                  }}
                >
                  <a
                    href={activeChartTrade.screenshotUrl || activeChartTrade.imageUrl}
                    download={`trade-chart-${Date.now()}.png`}
                    className="btn-ghost"
                    title="Download Chart Screenshot"
                    style={{ fontSize: '0.76rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '5px', textDecoration: 'none' }}
                  >
                    <Download size={13} /> Download
                  </a>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => chartUploadInputRef.current?.click()}
                    disabled={uploadingChart}
                    title="Replace Chart Image"
                    style={{ fontSize: '0.76rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '5px' }}
                  >
                    <UploadCloud size={13} /> {uploadingChart ? 'Uploading...' : 'Replace'}
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={handleRemoveActiveChart}
                    disabled={uploadingChart}
                    title="Remove Chart Image"
                    style={{ fontSize: '0.76rem', padding: '6px 12px', color: 'var(--loss)', display: 'flex', alignItems: 'center', gap: '5px' }}
                  >
                    <Trash2 size={13} /> Remove
                  </button>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setActiveChartTrade(null)}
                    title="Close"
                    style={{ marginLeft: '4px' }}
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Pure Chart Viewport */}
                <div
                  className="chart-preview-viewport"
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'auto',
                    borderRadius: '10px',
                    padding: '8px'
                  }}
                >
                  <img
                    src={activeChartTrade.screenshotUrl || activeChartTrade.imageUrl}
                    alt="Trade Chart"
                    style={{
                      maxWidth: '92vw',
                      maxHeight: '82vh',
                      objectFit: 'contain',
                      borderRadius: '6px',
                      display: 'block'
                    }}
                  />
                </div>
              </>
            ) : (
              /* SHOW CLEAN ADD CHART INTERFACE (NO OTHER TRADE DATA) */
              <>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '16px',
                    paddingBottom: '10px',
                    borderBottom: '1px solid var(--border-subtle)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        background: 'rgba(0, 210, 255, 0.12)',
                        color: 'var(--accent-cyan)',
                        display: 'grid',
                        placeItems: 'center'
                      }}
                    >
                      <Camera size={16} />
                    </div>
                    <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-white)', fontWeight: '700' }}>
                      Add Chart Image
                    </h4>
                  </div>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setActiveChartTrade(null)}
                  >
                    <X size={18} />
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Drag & Drop Upload Zone */}
                  <div
                    className="chart-upload-dropzone"
                    onDragOver={(e) => { e.preventDefault(); setIsChartDragging(true); }}
                    onDragLeave={(e) => { e.preventDefault(); setIsChartDragging(false); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsChartDragging(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) handleSaveChartForTrade(activeChartTrade, file);
                    }}
                    onClick={() => chartUploadInputRef.current?.click()}
                    style={{
                      borderRadius: '12px',
                      padding: '36px 20px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div
                      style={{
                        width: '52px',
                        height: '52px',
                        borderRadius: '50%',
                        background: 'rgba(0, 210, 255, 0.12)',
                        color: 'var(--accent-cyan)',
                        display: 'grid',
                        placeItems: 'center',
                        margin: '0 auto 12px'
                      }}
                    >
                      <UploadCloud size={26} />
                    </div>
                    <strong style={{ display: 'block', fontSize: '1rem', color: 'var(--text-white)', marginBottom: '6px' }}>
                      {uploadingChart ? 'Uploading chart screenshot...' : 'Click to Upload or Drag & Drop Chart'}
                    </strong>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      PNG, JPG, WebP • Or press <kbd style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 5px', borderRadius: '4px', fontFamily: 'var(--font-mono)' }}>Ctrl+V</kbd> to paste
                    </p>
                  </div>

                  {/* Direct Image URL Option */}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="url"
                      placeholder="Or paste chart image URL (TradingView, Imgur link)..."
                      value={chartUrlInput}
                      onChange={e => setChartUrlInput(e.target.value)}
                      style={{ flex: 1, fontSize: '0.84rem' }}
                    />
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={!chartUrlInput.trim() || uploadingChart}
                      onClick={() => {
                        if (chartUrlInput.trim()) {
                          handleSaveChartForTrade(activeChartTrade, chartUrlInput.trim());
                          setChartUrlInput('');
                        }
                      }}
                      style={{ padding: '0 16px', fontSize: '0.82rem', whiteSpace: 'nowrap' }}
                    >
                      Attach URL
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
