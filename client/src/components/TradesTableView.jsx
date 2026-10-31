import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, ChevronLeft, ChevronRight, Trash2, Filter, Eye, ArrowUpDown, X, FileText, Sparkles, Camera, Image as ImageIcon, UploadCloud, Maximize2, LayoutGrid, List, Plus, Download, Edit3, Check, ZoomIn, ZoomOut } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { exportTradeHistoryPDF } from '../utils/exportPDF';
import { compressImageFile, processAndUploadChartImage, getTradeImages, processAndUploadMultipleImages } from '../utils/imageHelper';

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
  onTradeUpdated,
  title = 'Database Ledger & Trade History',
  onClose,
  isFullScreen = false
}) => {
  const { user } = useAuth();
  const { currency, symbol, convert, format } = useCurrency();

  const formatPnL = (trade) => {
    const pnlVal = getTradeTakeProfitUSD(trade);
    return format(pnlVal, { showSign: true, decimals: currency === 'JPY' ? 0 : 2 });
  };
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
  const [selectedTrade, setSelectedTrade] = useState(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('openDetail=true')) {
      return (Array.isArray(initialTrades) && initialTrades[0]) ? initialTrades[0] : null;
    }
    return null;
  });
  const [isEditingNotes, setIsEditingNotes] = useState(() => {
    return typeof window !== 'undefined' && window.location.search.includes('editNotes=true');
  });
  const [editedNotes, setEditedNotes] = useState(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('openDetail=true')) {
      const trade = (Array.isArray(initialTrades) && initialTrades[0]) ? initialTrades[0] : null;
      return trade?.notes || '';
    }
    return '';
  });
  const [savingNotes, setSavingNotes] = useState(false);
  const [detailZoom, setDetailZoom] = useState(false);
  const [detailZoomIndex, setDetailZoomIndex] = useState(0);
  const [updatingImage, setUpdatingImage] = useState(false);
  const [layoutMode, setLayoutMode] = useState('table'); // 'table' | 'gallery'
  const [lightboxImage, setLightboxImage] = useState(null);
  const [activeChartTrade, setActiveChartTrade] = useState(null);
  const [activeChartImageIndex, setActiveChartImageIndex] = useState(0);
  const [uploadingChart, setUploadingChart] = useState(false);
  const [chartUrlInput, setChartUrlInput] = useState('');
  const [isChartDragging, setIsChartDragging] = useState(false);
  const chartUploadInputRef = useRef(null);
  const detailFileInputRef = useRef(null);
  const [seeding, setSeeding] = useState(false);
  const [chartZoomScale, setChartZoomScale] = useState(1);
  const [detailZoomScale, setDetailZoomScale] = useState(1);

  useEffect(() => {
    setChartZoomScale(1);
  }, [activeChartTrade, activeChartImageIndex]);

  useEffect(() => {
    setDetailZoomScale(1);
  }, [detailZoom, detailZoomIndex]);

  // Keyboard navigation & Clipboard paste support while Chart Modal is open
  useEffect(() => {
    if (!activeChartTrade) return;

    const handleWindowPaste = async (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const currentImgs = getTradeImages(activeChartTrade);
      if (currentImgs.length >= 3) return;

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
      if (e.key === 'Escape') {
        setActiveChartTrade(null);
      } else if (e.key === 'ArrowLeft') {
        const currentImgs = getTradeImages(activeChartTrade);
        if (currentImgs.length > 1) {
          setActiveChartImageIndex(prev => (prev - 1 + currentImgs.length) % currentImgs.length);
        }
      } else if (e.key === 'ArrowRight') {
        const currentImgs = getTradeImages(activeChartTrade);
        if (currentImgs.length > 1) {
          setActiveChartImageIndex(prev => (prev + 1) % currentImgs.length);
        }
      }
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
    const currentImgs = getTradeImages(targetTrade);
    if (currentImgs.length >= 3) {
      alert('Maximum 3 images allowed per trade. Please remove an existing image first.');
      return;
    }
    try {
      setUploadingChart(true);
      const cdnUrl = await processAndUploadChartImage(fileOrUrl);
      if (!cdnUrl) return;
      const updatedImages = [...currentImgs, cdnUrl].slice(0, 3);
      const updatePayload = {
        images: updatedImages,
        screenshotUrl: updatedImages[0] || '',
        imageUrl: updatedImages[0] || ''
      };
      await api.updateTrade(targetTrade._id, updatePayload);
      const updated = { ...targetTrade, ...updatePayload };
      setActiveChartTrade(updated);
      setActiveChartImageIndex(updatedImages.length - 1);
      setTrades(prev => prev.map(t => t._id === targetTrade._id ? updated : t));
      setMasterTrades(prev => prev.map(t => t._id === targetTrade._id ? updated : t));
      if (selectedTrade && selectedTrade._id === targetTrade._id) {
        setSelectedTrade(updated);
      }
      if (onTradeUpdated) onTradeUpdated(updated);
    } catch (err) {
      alert('Failed to save chart image: ' + err.message);
    } finally {
      setUploadingChart(false);
      if (chartUploadInputRef.current) chartUploadInputRef.current.value = '';
    }
  };

  const handleRemoveActiveChart = async (indexToRemove = activeChartImageIndex) => {
    if (!activeChartTrade) return;
    const currentImgs = getTradeImages(activeChartTrade);
    const updatedImages = currentImgs.filter((_, idx) => idx !== indexToRemove);
    try {
      setUploadingChart(true);
      const updatePayload = {
        images: updatedImages,
        screenshotUrl: updatedImages[0] || '',
        imageUrl: updatedImages[0] || ''
      };
      await api.updateTrade(activeChartTrade._id, updatePayload);
      const updated = { ...activeChartTrade, ...updatePayload };
      setActiveChartTrade(updated);
      setActiveChartImageIndex(prev => Math.min(prev, Math.max(0, updatedImages.length - 1)));
      setTrades(prev => prev.map(t => t._id === activeChartTrade._id ? updated : t));
      setMasterTrades(prev => prev.map(t => t._id === activeChartTrade._id ? updated : t));
      if (selectedTrade && selectedTrade._id === activeChartTrade._id) {
        setSelectedTrade(updated);
      }
      if (onTradeUpdated) onTradeUpdated(updated);
    } catch (err) {
      alert('Failed to remove chart image: ' + err.message);
    } finally {
      setUploadingChart(false);
    }
  };

  const handleUpdateTradeImage = async (file) => {
    if (!file || !selectedTrade) return;
    const currentImgs = getTradeImages(selectedTrade);
    if (currentImgs.length >= 3) {
      alert('Maximum 3 images allowed per trade. Please remove an existing image first.');
      return;
    }
    try {
      setUpdatingImage(true);
      const cdnUrl = await processAndUploadChartImage(file);
      if (!cdnUrl) return;
      const updatedImages = [...currentImgs, cdnUrl].slice(0, 3);
      const updatePayload = {
        images: updatedImages,
        screenshotUrl: updatedImages[0] || '',
        imageUrl: updatedImages[0] || ''
      };
      await api.updateTrade(selectedTrade._id, updatePayload);
      const updated = { ...selectedTrade, ...updatePayload };
      setSelectedTrade(updated);
      setTrades(prev => prev.map(t => t._id === selectedTrade._id ? updated : t));
      setMasterTrades(prev => prev.map(t => t._id === selectedTrade._id ? updated : t));
      if (activeChartTrade && activeChartTrade._id === selectedTrade._id) {
        setActiveChartTrade(updated);
      }
      if (onTradeUpdated) onTradeUpdated(updated);
    } catch (err) {
      alert('Failed to update trade image: ' + err.message);
    } finally {
      setUpdatingImage(false);
      if (detailFileInputRef.current) detailFileInputRef.current.value = '';
    }
  };

  const handleRemoveTradeImageAt = async (indexToRemove) => {
    if (!selectedTrade) return;
    const currentImgs = getTradeImages(selectedTrade);
    const updatedImages = currentImgs.filter((_, idx) => idx !== indexToRemove);
    try {
      setUpdatingImage(true);
      const updatePayload = {
        images: updatedImages,
        screenshotUrl: updatedImages[0] || '',
        imageUrl: updatedImages[0] || ''
      };
      await api.updateTrade(selectedTrade._id, updatePayload);
      const updated = { ...selectedTrade, ...updatePayload };
      setSelectedTrade(updated);
      setTrades(prev => prev.map(t => t._id === selectedTrade._id ? updated : t));
      setMasterTrades(prev => prev.map(t => t._id === selectedTrade._id ? updated : t));
      if (activeChartTrade && activeChartTrade._id === selectedTrade._id) {
        setActiveChartTrade(updated);
      }
      if (onTradeUpdated) onTradeUpdated(updated);
    } catch (err) {
      alert('Failed to remove trade image: ' + err.message);
    } finally {
      setUpdatingImage(false);
    }
  };

  const openTradeDetails = (trade) => {
    setSelectedTrade(trade);
    setIsEditingNotes(false);
    setEditedNotes(trade?.notes || '');
  };

  const handleSaveNotes = async () => {
    if (!selectedTrade) return;
    try {
      setSavingNotes(true);
      const updatedNotes = editedNotes.trim();
      await api.updateTrade(selectedTrade._id, { notes: updatedNotes });
      const updated = { ...selectedTrade, notes: updatedNotes };
      setSelectedTrade(updated);
      setTrades(prev => prev.map(t => t._id === selectedTrade._id ? updated : t));
      setMasterTrades(prev => prev.map(t => t._id === selectedTrade._id ? updated : t));
      setIsEditingNotes(false);
      if (onTradeUpdated) onTradeUpdated(updated);
    } catch (err) {
      alert('Failed to save execution notes: ' + err.message);
    } finally {
      setSavingNotes(false);
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
      if (window.location.search.includes('openDetail=true')) {
        setSelectedTrade(prev => prev || initialTrades[0]);
      }
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
        user,
        options: {
          currency
        }
      });
    } catch (err) {
      alert('Failed to generate PDF: ' + err.message);
    }
  };

  return (
    <div className={`dashboard-panel ${isFullScreen ? 'fullscreen-ledger-panel' : ''}`}>
      {/* Header & Search Bar */}
      <div className="panel-header ledger-panel-header">
        <div className="ledger-title-group">
          <h3 className="ledger-main-title">{title}</h3>
          <p className="ledger-subtitle">
            {totalCount} total audited executions in database
          </p>
        </div>

        <div className="ledger-header-controls">
          <div className="ledger-search-box">
            <Search size={15} className="search-icon" />
            <input
              type="text"
              placeholder="Search ticker, level, notes..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
            {search && (
              <button
                type="button"
                className="btn-ghost search-clear-btn"
                onClick={() => setSearch('')}
                aria-label="Clear search input"
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
              title="Table Ledger View"
            >
              <List size={14} />
              <span>Ledger</span>
            </button>
            <button
              type="button"
              className={layoutMode === 'gallery' ? 'btn-primary' : 'btn-ghost'}
              onClick={() => setLayoutMode('gallery')}
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
            <div className="gallery-grid">
              {trades.map(trade => {
                const tradeImages = getTradeImages(trade);
                const hasImg = tradeImages.length > 0;
                const isWin = trade.result === 'WIN';
                const isLoss = trade.result === 'LOSS';
                return (
                  <div
                    key={trade._id}
                    onClick={() => openTradeDetails(trade)}
                    className="gallery-trade-card"
                  >
                    {/* Chart Banner */}
                    <div className="gallery-chart-box">
                      {hasImg ? (
                        <>
                          <img
                            src={tradeImages[0]}
                            alt={trade.tradeName}
                            className="gallery-chart-img"
                          />
                          {tradeImages.length > 1 && (
                            <span style={{
                              position: 'absolute',
                              bottom: '8px',
                              left: '8px',
                              background: 'rgba(3, 6, 11, 0.85)',
                              border: '1px solid var(--border-bright)',
                              color: 'var(--accent-cyan)',
                              fontSize: '0.68rem',
                              fontWeight: '800',
                              padding: '2px 8px',
                              borderRadius: 'var(--radius-pill)',
                              backdropFilter: 'blur(6px)',
                              zIndex: 2,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              <Camera size={11} /> {tradeImages.length} Charts
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveChartTrade(trade);
                              setActiveChartImageIndex(0);
                            }}
                            title="Click to view charts"
                            className="gallery-view-chart-btn"
                          >
                            <Maximize2 size={12} /> View {tradeImages.length > 1 ? `${tradeImages.length} Charts` : 'Chart'}
                          </button>
                        </>
                      ) : (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveChartTrade(trade);
                            setActiveChartImageIndex(0);
                          }}
                          className="gallery-chart-empty"
                        >
                          <div className="gallery-empty-icon-wrap">
                            <Camera size={16} />
                            <Plus size={12} strokeWidth={3} />
                          </div>
                          <span className="gallery-empty-label">+ Add Chart (up to 3)</span>
                        </div>
                      )}

                      {/* Result Badge */}
                      <div className="gallery-badge-result">
                        <span className={`badge ${isWin ? 'badge-win' : isLoss ? 'badge-loss' : 'badge-be'}`}>
                          {trade.result} {formatR(trade.rResult)}
                        </span>
                      </div>

                      {/* Setup Quality Pill */}
                      <div className="gallery-badge-grade">
                        <span className={`pill-grade ${(trade.setupRating || '').toLowerCase().replace(/[^a-z]/g, '')}`}>
                          {trade.setupRating}
                        </span>
                      </div>
                    </div>

                    {/* Card Content */}
                    <div className="gallery-card-content">
                      <div>
                        <div className="gallery-card-header">
                          <strong className="gallery-instrument">
                            {trade.instrument}
                          </strong>
                          <span className="gallery-datetime">
                            {trade.date} {trade.time}
                          </span>
                        </div>
                        <p className="gallery-trade-title" title={trade.tradeName}>
                          {trade.tradeName}
                        </p>
                      </div>

                      {/* Metrics Bar */}
                      <div className="gallery-metrics-bar">
                        <div className="gallery-metric-cell">
                          <span className="gallery-metric-label">P&L</span>
                          <strong className={`gallery-metric-value ${isWin ? 'metric-win' : isLoss ? 'metric-loss' : 'metric-muted'}`}>
                            {formatPnL(trade)}
                          </strong>
                        </div>
                        <div className="gallery-metric-cell">
                          <span className="gallery-metric-label">PIPS</span>
                          <strong className="gallery-metric-value metric-pips">
                            {trade.pips || 0}
                          </strong>
                        </div>
                        <div className="gallery-metric-cell">
                          <span className="gallery-metric-label">DISCIPLINE</span>
                          <strong className={`gallery-metric-value ${trade.disciplineScore >= 75 ? 'metric-win' : 'metric-warn'}`}>
                            {trade.disciplineScore}/100
                          </strong>
                        </div>
                      </div>

                      {/* Notes snippet */}
                      {trade.notes && (
                        <p className="gallery-trade-notes">
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
                <th>P&L ({symbol})</th>
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
                    onClick={() => openTradeDetails(trade)}
                    style={{ cursor: 'pointer' }}
                  >
                    {/* Dedicated Chart Column: Only chart view or add icon */}
                    <td style={{ width: '58px', padding: '6px 8px', textAlign: 'center' }}>
                      {(() => {
                        const tradeImages = getTradeImages(trade);
                        if (tradeImages.length > 0) {
                          return (
                            <div
                              className="table-chart-thumb"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveChartTrade(trade);
                                setActiveChartImageIndex(0);
                              }}
                              title={tradeImages.length > 1 ? `${tradeImages.length} chart images attached • Click to view all` : 'Click to view chart'}
                            >
                              <img
                                src={tradeImages[0]}
                                alt="Trade Chart"
                                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                              />
                              {tradeImages.length > 1 && (
                                <span className="table-chart-count-badge">
                                  {tradeImages.length}
                                </span>
                              )}
                            </div>
                          );
                        }
                        return (
                          <div
                            className="table-chart-add-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveChartTrade(trade);
                              setActiveChartImageIndex(0);
                            }}
                            title="Add chart image (up to 3)"
                          >
                            <Camera size={13} />
                            <Plus size={10} strokeWidth={3} />
                          </div>
                        );
                      })()}
                    </td>

                    <td style={{ fontWeight: '700', color: 'var(--text-white)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                        <span>{trade.tradeName}</span>
                        {trade.isFromMT5 && (
                          <span style={{
                            fontSize: '0.62rem',
                            fontWeight: '800',
                            padding: '1px 5px',
                            borderRadius: '4px',
                            background: 'rgba(14, 165, 233, 0.15)',
                            color: 'var(--accent-cyan)',
                            border: '1px solid rgba(14, 165, 233, 0.3)'
                          }}>
                            MT5 #{trade.mt5PositionId || ''}
                          </span>
                        )}
                        {trade.mt5DataChanged && (
                          <span style={{
                            fontSize: '0.60rem',
                            fontWeight: '800',
                            padding: '1px 4px',
                            borderRadius: '4px',
                            background: 'rgba(245, 158, 11, 0.15)',
                            color: 'var(--warning)',
                            border: '1px solid rgba(245, 158, 11, 0.3)'
                          }}>
                            Adjusted
                          </span>
                        )}
                      </div>
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
                <p className="detail-stat-white-text" style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--text-white)' }}>
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
              <p><strong>Take Profit ({currency}):</strong> <span style={{ color: 'var(--profit)', fontFamily: 'var(--font-mono)', fontWeight: '700' }}>
                {(() => {
                  let tp = selectedTrade.takeProfit ?? selectedTrade.takeProfitUSD;
                  if (!tp) {
                    try {
                      const overrides = JSON.parse(localStorage.getItem('tradejourn_tp_overrides') || '{}');
                      tp = overrides[selectedTrade._id] || overrides[`${selectedTrade.tradeName}_${selectedTrade.date}_${selectedTrade.time || '00:00'}`] || overrides[`${selectedTrade.date}_${selectedTrade.time || '00:00'}`];
                    } catch (e) {}
                  }
                  return format(tp || 0, { showSign: false, decimals: currency === 'JPY' ? 0 : 2 });
                })()}
              </span></p>
              <p><strong>Market Regime:</strong> <span style={{ color: 'var(--text-secondary)' }}>{selectedTrade.marketCondition}</span></p>
              <p><strong>Prop Firm Challenge:</strong> <span style={{ color: selectedTrade.isPropTrade === true ? 'var(--profit)' : 'var(--text-muted)', fontWeight: '700' }}>{selectedTrade.isPropTrade === true ? 'Yes (Counted)' : 'No (Excluded)'}</span></p>
              <p><strong>Early Exit Catalyst:</strong> <span style={{ color: 'var(--text-secondary)' }}>{selectedTrade.reasonEarlyExit}</span></p>
              <p className="span-full"><strong>Mistakes Recorded:</strong> <span style={{ color: '#ff6685' }}>{(selectedTrade.mistakes || []).join(', ') || 'None (Clean Execution)'}</span></p>
            </div>

            {/* Notes Section */}
            <div className="detail-notes-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <p className="detail-notes-title">
                    Trader Execution Notes
                  </p>
                  {selectedTrade.notes && (
                    <span className="detail-notes-badge">
                      Logged
                    </span>
                  )}
                </div>

                {!isEditingNotes && (
                  <button
                    type="button"
                    className="detail-notes-action-btn"
                    onClick={() => {
                      setEditedNotes(selectedTrade.notes || '');
                      setIsEditingNotes(true);
                    }}
                  >
                    <Edit3 size={13} /> {selectedTrade.notes ? 'Edit Notes' : '+ Add Note'}
                  </button>
                )}
              </div>

              {isEditingNotes ? (
                <div style={{ marginTop: '8px' }}>
                  <textarea
                    className="detail-notes-textarea"
                    value={editedNotes}
                    onChange={(e) => setEditedNotes(e.target.value)}
                    placeholder="Enter your post-trade execution analysis, emotional state, psychology notes, or lessons learned..."
                    rows={4}
                    autoFocus
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                    <button
                      type="button"
                      className="detail-notes-cancel-btn"
                      onClick={() => setIsEditingNotes(false)}
                      disabled={savingNotes}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="detail-notes-save-btn"
                      onClick={handleSaveNotes}
                      disabled={savingNotes}
                    >
                      <Check size={14} /> {savingNotes ? 'Saving...' : 'Save Notes'}
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  {selectedTrade.notes ? (
                    <p className="detail-notes-content-text">
                      {selectedTrade.notes}
                    </p>
                  ) : (
                    <div
                      className="detail-notes-empty-box"
                      onClick={() => {
                        setEditedNotes('');
                        setIsEditingNotes(true);
                      }}
                    >
                      <p className="detail-notes-empty-text">
                        No execution notes entered for this trade.
                      </p>
                      <span className="detail-notes-empty-action">
                        <Plus size={13} /> Click here to add post-trade execution notes
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Chart Screenshot & Technical Execution Card */}
            <div className="detail-chart-card" style={{ marginTop: '16px', padding: '16px', borderRadius: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Camera size={16} className="detail-chart-icon" style={{ color: 'var(--accent-cyan)' }} />
                  <span className="detail-chart-title" style={{ fontSize: '0.78rem', color: 'var(--accent-cyan)', textTransform: 'uppercase', fontWeight: '800' }}>
                    Technical Charts & Screenshots
                  </span>
                  <span style={{
                    fontSize: '0.68rem',
                    background: getTradeImages(selectedTrade).length === 3 ? 'rgba(0, 245, 155, 0.15)' : 'rgba(0, 210, 255, 0.15)',
                    color: getTradeImages(selectedTrade).length === 3 ? 'var(--profit)' : 'var(--accent-cyan)',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-pill)',
                    fontWeight: '700'
                  }}>
                    {getTradeImages(selectedTrade).length}/3 IMAGES
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
                  {getTradeImages(selectedTrade).length < 3 && (
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ fontSize: '0.74rem', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-cyan)' }}
                      onClick={() => detailFileInputRef.current?.click()}
                      disabled={updatingImage}
                    >
                      <UploadCloud size={13} /> {updatingImage ? 'Attaching...' : `+ Attach Chart (${3 - getTradeImages(selectedTrade).length} left)`}
                    </button>
                  )}
                </div>
              </div>

              {(() => {
                const detailImages = getTradeImages(selectedTrade);
                if (detailImages.length > 0) {
                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
                      {detailImages.map((imgUrl, idx) => (
                        <div
                          key={idx}
                          style={{
                            position: 'relative',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            border: '1px solid var(--border-bright)',
                            background: '#04080e',
                            display: 'flex',
                            flexDirection: 'column'
                          }}
                        >
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '5px 8px',
                            background: 'rgba(3, 6, 11, 0.9)',
                            borderBottom: '1px solid var(--border-subtle)',
                            fontSize: '0.7rem',
                            color: 'var(--accent-cyan)',
                            fontWeight: '700'
                          }}>
                            <span>Chart {idx + 1}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveTradeImageAt(idx)}
                              disabled={updatingImage}
                              title="Remove this image"
                              style={{ background: 'none', border: 'none', color: 'var(--loss)', cursor: 'pointer', padding: '2px' }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>

                          <div
                            style={{
                              height: '130px',
                              position: 'relative',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              background: '#020509'
                            }}
                            onClick={() => {
                              setDetailZoomIndex(idx);
                              setDetailZoom(true);
                            }}
                          >
                            <img
                              src={imgUrl}
                              alt={`Trade Chart ${idx + 1}`}
                              crossOrigin="anonymous"
                              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                            />
                            <div style={{ position: 'absolute', bottom: '6px', right: '6px', background: 'rgba(0,0,0,0.75)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.65rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <Maximize2 size={11} /> Expand
                            </div>
                          </div>
                        </div>
                      ))}

                      {detailImages.length < 3 && (
                        <div
                          onClick={() => detailFileInputRef.current?.click()}
                          style={{
                            borderRadius: '8px',
                            border: '1.5px dashed var(--border-medium)',
                            background: 'rgba(0, 210, 255, 0.02)',
                            padding: '16px',
                            textAlign: 'center',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minHeight: '150px',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <Camera size={20} style={{ color: 'var(--accent-cyan)', marginBottom: '6px' }} />
                          <strong style={{ fontSize: '0.8rem', color: 'var(--text-white)', marginBottom: '2px' }}>
                            + Add Chart {detailImages.length + 1} of 3
                          </strong>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Click to upload</span>
                        </div>
                      )}
                    </div>
                  );
                }
                return (
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
                      No chart image attached yet. Click to attach up to 3 screenshots.
                    </p>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Modal for Detail Zoom with Multi-Image Navigation */}
      {detailZoom && selectedTrade && (
        <div
          className="modal-overlay"
          style={{
            zIndex: 130000,
            padding: 'clamp(8px, 1.5vh, 16px)',
            overflowY: 'auto',
            display: 'flex',
            alignItems: 'safe center',
            justifyContent: 'center',
            boxSizing: 'border-box'
          }}
          onClick={() => {
            setDetailZoom(false);
            setDetailZoomScale(1);
          }}
        >
          {(() => {
            const zoomImages = getTradeImages(selectedTrade);
            const activeImg = zoomImages[detailZoomIndex] || zoomImages[0];
            return (
              <div
                className="chart-preview-modal-card"
                style={{
                  maxWidth: 'min(96vw, 1400px)',
                  maxHeight: 'calc(100dvh - 20px)',
                  height: 'calc(100dvh - 20px)',
                  position: 'relative',
                  background: 'var(--bg-card, #04080e)',
                  padding: '10px 14px',
                  borderRadius: '14px',
                  border: '1px solid var(--border-bright)',
                  boxShadow: '0 20px 50px rgba(0,0,0,0.95)',
                  display: 'flex',
                  flexDirection: 'column',
                  boxSizing: 'border-box',
                  margin: 'auto',
                  overflow: 'hidden'
                }}
                onClick={e => e.stopPropagation()}
              >
                <div style={{ flex: '0 0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', minHeight: '32px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-white)' }}>
                      Chart {detailZoomIndex + 1} of {zoomImages.length}
                    </span>
                    {zoomImages.length > 1 && (
                      <div style={{ display: 'flex', gap: '5px' }}>
                        {zoomImages.map((_, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setDetailZoomIndex(idx);
                              setDetailZoomScale(1);
                            }}
                            style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '6px',
                              border: '1px solid',
                              borderColor: detailZoomIndex === idx ? 'var(--accent-cyan)' : 'var(--border-subtle)',
                              background: detailZoomIndex === idx ? 'var(--accent-cyan-soft)' : 'rgba(255,255,255,0.05)',
                              color: detailZoomIndex === idx ? 'var(--accent-cyan)' : 'var(--text-muted)',
                              fontSize: '0.72rem',
                              fontWeight: '700',
                              cursor: 'pointer'
                            }}
                          >
                            {idx + 1}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {/* Zoom In / Out Pill */}
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '6px',
                        padding: '2px 4px',
                        gap: '2px'
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setDetailZoomScale(prev => Math.max(0.6, +(prev - 0.2).toFixed(1)))}
                        disabled={detailZoomScale <= 0.6}
                        title="Zoom Out (-)"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: detailZoomScale <= 0.6 ? 'var(--text-dim)' : 'var(--text-secondary)',
                          cursor: detailZoomScale <= 0.6 ? 'not-allowed' : 'pointer',
                          padding: '3px 5px',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                      >
                        <ZoomOut size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDetailZoomScale(1)}
                        title="Reset to Fit (100%)"
                        style={{
                          background: detailZoomScale === 1 ? 'transparent' : 'var(--accent-cyan-soft)',
                          border: 'none',
                          color: detailZoomScale === 1 ? 'var(--text-muted)' : 'var(--accent-cyan)',
                          fontWeight: '700',
                          fontSize: '0.72rem',
                          cursor: 'pointer',
                          padding: '2px 6px',
                          borderRadius: '4px'
                        }}
                      >
                        {Math.round(detailZoomScale * 100)}%
                      </button>
                      <button
                        type="button"
                        onClick={() => setDetailZoomScale(prev => Math.min(3, +(prev + 0.2).toFixed(1)))}
                        disabled={detailZoomScale >= 3}
                        title="Zoom In (+)"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: detailZoomScale >= 3 ? 'var(--text-dim)' : 'var(--text-secondary)',
                          cursor: detailZoomScale >= 3 ? 'not-allowed' : 'pointer',
                          padding: '3px 5px',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                      >
                        <ZoomIn size={13} />
                      </button>
                    </div>

                    <button
                      type="button"
                      className="btn-close"
                      onClick={() => {
                        setDetailZoom(false);
                        setDetailZoomScale(1);
                      }}
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>

                <div
                  className="chart-preview-viewport"
                  style={{
                    flex: '1 1 auto',
                    minHeight: 0,
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: detailZoomScale > 1 ? 'auto' : 'hidden',
                    borderRadius: '10px',
                    padding: '4px',
                    background: '#020509',
                    boxSizing: 'border-box'
                  }}
                >
                  {zoomImages.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        setDetailZoomIndex(prev => (prev - 1 + zoomImages.length) % zoomImages.length);
                        setDetailZoomScale(1);
                      }}
                      style={{
                        position: 'absolute',
                        left: '12px',
                        zIndex: 3,
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        background: 'rgba(3, 6, 11, 0.8)',
                        border: '1px solid var(--border-bright)',
                        color: 'var(--text-white)',
                        display: 'grid',
                        placeItems: 'center',
                        cursor: 'pointer'
                      }}
                    >
                      <ChevronLeft size={20} />
                    </button>
                  )}

                  <img
                    src={activeImg}
                    alt={`Trade Chart Setup ${detailZoomIndex + 1}`}
                    crossOrigin="anonymous"
                    style={{
                      maxWidth: detailZoomScale > 1 ? 'none' : '100%',
                      maxHeight: detailZoomScale > 1 ? 'none' : '100%',
                      width: detailZoomScale > 1 ? `${detailZoomScale * 100}%` : 'auto',
                      height: detailZoomScale > 1 ? 'auto' : '100%',
                      objectFit: 'contain',
                      display: 'block',
                      margin: 'auto',
                      borderRadius: '6px',
                      transition: 'width 0.15s ease'
                    }}
                  />

                  {zoomImages.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        setDetailZoomIndex(prev => (prev + 1) % zoomImages.length);
                        setDetailZoomScale(1);
                      }}
                      style={{
                        position: 'absolute',
                        right: '12px',
                        zIndex: 3,
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        background: 'rgba(3, 6, 11, 0.8)',
                        border: '1px solid var(--border-bright)',
                        color: 'var(--text-white)',
                        display: 'grid',
                        placeItems: 'center',
                        cursor: 'pointer'
                      }}
                    >
                      <ChevronRight size={20} />
                    </button>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* =========================================================================
          DEDICATED CHART MODAL - SHOWS UP TO 3 CHARTS WITH TAB/SELECTOR NAVIGATION,
          DOWNLOAD, REMOVE, AND DIRECT ADD/ATTACH FLOW FOR RECORDED TRADES
          ========================================================================= */}
      {activeChartTrade && (
        <div
          className="modal-overlay"
          style={{
            zIndex: 125000,
            padding: 'clamp(8px, 1.5vh, 16px)',
            overflowY: 'auto',
            display: 'flex',
            alignItems: 'safe center',
            justifyContent: 'center',
            boxSizing: 'border-box'
          }}
          onClick={() => {
            setActiveChartTrade(null);
            setChartZoomScale(1);
          }}
        >
          {(() => {
            const chartImages = getTradeImages(activeChartTrade);
            const currentImg = chartImages[activeChartImageIndex] || chartImages[0];
            return (
              <div
                className="chart-preview-modal-card"
                onClick={e => e.stopPropagation()}
                style={{
                  maxWidth: chartImages.length > 0 ? 'min(96vw, 1440px)' : '520px',
                  width: '100%',
                  maxHeight: 'calc(100dvh - 20px)',
                  height: chartImages.length > 0 ? 'calc(100dvh - 20px)' : 'auto',
                  position: 'relative',
                  padding: chartImages.length > 0 ? '10px 14px' : '20px 22px',
                  borderRadius: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  boxSizing: 'border-box',
                  margin: 'auto',
                  overflow: 'hidden'
                }}
              >
                {/* Hidden file input for this trade */}
                <input
                  type="file"
                  ref={chartUploadInputRef}
                  accept="image/*"
                  multiple
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    if (files.length > 0) handleSaveChartForTrade(activeChartTrade, files[0]);
                  }}
                />

                {chartImages.length > 0 ? (
                  /* SHOW CHARTS WITH MULTI-IMAGE CAROUSEL & ACTIONS */
                  <>
                    {/* Top Control Bar with Image Switcher Tabs & Controls */}
                    <div
                      style={{
                        flex: '0 0 auto',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '8px',
                        flexWrap: 'wrap',
                        minHeight: '34px'
                      }}
                    >
                      {/* Left: Image Tabs */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {chartImages.map((_, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                setActiveChartImageIndex(idx);
                                setChartZoomScale(1);
                              }}
                              style={{
                                border: '1px solid',
                                borderColor: activeChartImageIndex === idx ? 'var(--accent-cyan)' : 'var(--border-subtle)',
                                background: activeChartImageIndex === idx ? 'var(--accent-cyan-soft)' : 'rgba(255, 255, 255, 0.04)',
                                color: activeChartImageIndex === idx ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                                fontSize: '0.75rem',
                                fontWeight: '700',
                                padding: '4px 10px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <Camera size={13} />
                              Chart {idx + 1}
                            </button>
                          ))}
                        </div>

                        {chartImages.length < 3 && (
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => chartUploadInputRef.current?.click()}
                            disabled={uploadingChart}
                            style={{ fontSize: '0.74rem', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--profit)' }}
                            title="Add up to 3 chart images to this recorded trade"
                          >
                            <Plus size={13} /> Add Chart ({chartImages.length}/3)
                          </button>
                        )}
                      </div>

                      {/* Right: Actions + Interactive Zoom Controls */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        {/* Zoom Controls Pill */}
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: '6px',
                            padding: '2px 4px',
                            gap: '2px'
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => setChartZoomScale(prev => Math.max(0.6, +(prev - 0.2).toFixed(1)))}
                            disabled={chartZoomScale <= 0.6}
                            title="Zoom Out (-)"
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: chartZoomScale <= 0.6 ? 'var(--text-dim)' : 'var(--text-secondary)',
                              cursor: chartZoomScale <= 0.6 ? 'not-allowed' : 'pointer',
                              padding: '3px 5px',
                              borderRadius: '4px',
                              display: 'flex',
                              alignItems: 'center'
                            }}
                          >
                            <ZoomOut size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setChartZoomScale(1)}
                            title="Reset to Fit (100%)"
                            style={{
                              background: chartZoomScale === 1 ? 'transparent' : 'var(--accent-cyan-soft)',
                              border: 'none',
                              color: chartZoomScale === 1 ? 'var(--text-muted)' : 'var(--accent-cyan)',
                              fontWeight: '700',
                              fontSize: '0.72rem',
                              cursor: 'pointer',
                              padding: '2px 6px',
                              borderRadius: '4px'
                            }}
                          >
                            {Math.round(chartZoomScale * 100)}%
                          </button>
                          <button
                            type="button"
                            onClick={() => setChartZoomScale(prev => Math.min(3, +(prev + 0.2).toFixed(1)))}
                            disabled={chartZoomScale >= 3}
                            title="Zoom In (+)"
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: chartZoomScale >= 3 ? 'var(--text-dim)' : 'var(--text-secondary)',
                              cursor: chartZoomScale >= 3 ? 'not-allowed' : 'pointer',
                              padding: '3px 5px',
                              borderRadius: '4px',
                              display: 'flex',
                              alignItems: 'center'
                            }}
                          >
                            <ZoomIn size={13} />
                          </button>
                        </div>

                        <a
                          href={currentImg}
                          download={`trade-chart-${activeChartTrade.tradeName || 'chart'}-${activeChartImageIndex + 1}.png`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-ghost"
                          title="Download Chart Screenshot"
                          style={{ fontSize: '0.75rem', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
                        >
                          <Download size={13} /> Download
                        </a>
                        <button
                          type="button"
                          className="btn-ghost"
                          onClick={() => handleRemoveActiveChart(activeChartImageIndex)}
                          disabled={uploadingChart}
                          title="Remove this Chart Screenshot"
                          style={{ fontSize: '0.75rem', padding: '5px 10px', color: 'var(--loss)', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Trash2 size={13} /> Remove
                        </button>
                        <button
                          type="button"
                          className="btn-close"
                          onClick={() => {
                            setActiveChartTrade(null);
                            setChartZoomScale(1);
                          }}
                          title="Close"
                          style={{ marginLeft: '2px' }}
                        >
                          <X size={18} />
                        </button>
                      </div>
                    </div>

                    {/* Viewport with Keyboard & Arrow Navigation */}
                    <div
                      className="chart-preview-viewport"
                      style={{
                        flex: '1 1 auto',
                        minHeight: 0,
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: chartZoomScale > 1 ? 'auto' : 'hidden',
                        borderRadius: '10px',
                        padding: '4px',
                        background: '#020509',
                        boxSizing: 'border-box'
                      }}
                    >
                      {chartImages.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveChartImageIndex(prev => (prev - 1 + chartImages.length) % chartImages.length);
                            setChartZoomScale(1);
                          }}
                          style={{
                            position: 'absolute',
                            left: '12px',
                            zIndex: 4,
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            background: 'rgba(3, 6, 11, 0.85)',
                            border: '1px solid var(--border-bright)',
                            color: 'var(--text-white)',
                            display: 'grid',
                            placeItems: 'center',
                            cursor: 'pointer'
                          }}
                          title="Previous Chart"
                        >
                          <ChevronLeft size={20} />
                        </button>
                      )}

                      <img
                        src={currentImg}
                        alt={`Trade Chart ${activeChartImageIndex + 1}`}
                        crossOrigin="anonymous"
                        style={{
                          maxWidth: chartZoomScale > 1 ? 'none' : '100%',
                          maxHeight: chartZoomScale > 1 ? 'none' : '100%',
                          width: chartZoomScale > 1 ? `${chartZoomScale * 100}%` : 'auto',
                          height: chartZoomScale > 1 ? 'auto' : '100%',
                          objectFit: 'contain',
                          borderRadius: '6px',
                          display: 'block',
                          margin: 'auto',
                          transition: 'width 0.15s ease'
                        }}
                      />

                      {chartImages.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveChartImageIndex(prev => (prev + 1) % chartImages.length);
                            setChartZoomScale(1);
                          }}
                          style={{
                            position: 'absolute',
                            right: '12px',
                            zIndex: 4,
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            background: 'rgba(3, 6, 11, 0.85)',
                            border: '1px solid var(--border-bright)',
                            color: 'var(--text-white)',
                            display: 'grid',
                            placeItems: 'center',
                            cursor: 'pointer'
                          }}
                          title="Next Chart"
                        >
                          <ChevronRight size={20} />
                        </button>
                      )}
                    </div>

                    {/* Bottom Mini Thumbnails Bar */}
                    <div
                      style={{
                        flex: '0 0 auto',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        marginTop: '8px',
                        minHeight: '36px'
                      }}
                    >
                      {chartImages.map((img, idx) => (
                        <div
                          key={idx}
                          onClick={() => {
                            setActiveChartImageIndex(idx);
                            setChartZoomScale(1);
                          }}
                          style={{
                            width: '52px',
                            height: '34px',
                            borderRadius: '6px',
                            overflow: 'hidden',
                            border: '2px solid',
                            borderColor: activeChartImageIndex === idx ? 'var(--accent-cyan)' : 'transparent',
                            cursor: 'pointer',
                            opacity: activeChartImageIndex === idx ? 1 : 0.6,
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                      ))}

                      {chartImages.length < 3 && (
                        <button
                          type="button"
                          onClick={() => chartUploadInputRef.current?.click()}
                          disabled={uploadingChart}
                          style={{
                            width: '52px',
                            height: '34px',
                            borderRadius: '6px',
                            border: '1px dashed var(--border-medium)',
                            background: 'rgba(0, 210, 255, 0.05)',
                            color: 'var(--accent-cyan)',
                            display: 'grid',
                            placeItems: 'center',
                            cursor: 'pointer'
                          }}
                          title="Add another chart image"
                        >
                          <Plus size={15} />
                        </button>
                      )}
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
                          Add Chart Images (Up to 3)
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
            );
          })()}
        </div>
      )}
    </div>
  );
};
