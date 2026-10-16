import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  X,
  Shield,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Calculator,
  FileText,
  Camera,
  Image as ImageIcon,
  UploadCloud,
  Link as LinkIcon,
  Trash2,
  Maximize2,
  Eye
} from 'lucide-react';
import { api } from '../services/api';
import { compressImageFile } from '../utils/imageHelper';

const emotionalRiskList = ['Fear', 'Greed', 'Impatient', 'Revenge', 'FOMO', 'Frustrated', 'Anxious', 'Overconfident'];

export const QuickAddTradeModal = ({ isOpen, onClose, onTradeSaved }) => {
  const todayStr = new Date().toISOString().slice(0, 10);
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(Math.round(now.getMinutes() / 15) * 15 % 60).padStart(2, '0')}`;

  const [form, setForm] = useState({
    tradeName: '',
    date: todayStr,
    time: timeStr,
    direction: 'Buy',
    instrument: 'EURUSD',
    levelTraded: 'Support',
    session: 'London',
    bias: 'Bullish',
    result: 'WIN',
    rr: 1.5,
    pips: 20,
    takeProfit: 150,
    setupRating: 'A+',
    entryType: 'Confirmation',
    confirmation: 'Yes',
    emotion: 'Calm',
    reasonEarlyExit: 'None',
    marketCondition: 'Trending',
    mistakes: ['None'],
    notes: '',
    screenshotUrl: ''
  });

  const [imageMode, setImageMode] = useState('upload'); // 'upload' | 'url'
  const [urlInput, setUrlInput] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isPreviewZoomOpen, setIsPreviewZoomOpen] = useState(false);
  const fileInputRef = useRef(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Paste image directly from clipboard (e.g. TradingView copy screenshot / Snipping tool)
  useEffect(() => {
    if (!isOpen) return;

    const handleWindowPaste = async (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            try {
              setIsCompressing(true);
              const dataUrl = await compressImageFile(file);
              setForm(prev => ({ ...prev, screenshotUrl: dataUrl }));
            } catch (err) {
              console.warn('Clipboard image compression failed:', err);
            } finally {
              setIsCompressing(false);
            }
          }
          break;
        }
      }
    };

    window.addEventListener('paste', handleWindowPaste);
    return () => window.removeEventListener('paste', handleWindowPaste);
  }, [isOpen]);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsCompressing(true);
      const dataUrl = await compressImageFile(file);
      setForm(prev => ({ ...prev, screenshotUrl: dataUrl }));
    } catch (err) {
      setError(err.message || 'Failed to process image');
    } finally {
      setIsCompressing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    try {
      setIsCompressing(true);
      const dataUrl = await compressImageFile(file);
      setForm(prev => ({ ...prev, screenshotUrl: dataUrl }));
    } catch (err) {
      setError(err.message || 'Failed to process dropped image');
    } finally {
      setIsCompressing(false);
    }
  };

  const handleApplyUrl = () => {
    if (!urlInput.trim()) return;
    setForm(prev => ({ ...prev, screenshotUrl: urlInput.trim() }));
    setUrlInput('');
  };

  const handleRemoveImage = () => {
    setForm(prev => ({ ...prev, screenshotUrl: '' }));
    setUrlInput('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (!isOpen) return null;

  // Real-time discipline score preview
  const calculateDisciplinePreview = () => {
    const setupScore = ['A+', 'A', 'B+', 'B'].includes(form.setupRating) ? 25 : 0;
    const confirmationScore = form.confirmation === 'Yes' ? 25 : form.confirmation === 'Partial' ? 12.5 : 0;
    const emotionalScore = emotionalRiskList.includes(form.emotion) ? 0 : 25;
    const mistakeScore = form.mistakes.length === 0 || form.mistakes.includes('None') ? 25 : 0;
    const score = Math.min(100, setupScore + confirmationScore + emotionalScore + mistakeScore);

    let grade = 'Needs Improvement';
    let toneColor = 'var(--loss)';
    if (score >= 90) {
      grade = 'Elite';
      toneColor = 'var(--profit)';
    } else if (score >= 75) {
      grade = 'Good';
      toneColor = 'var(--accent-cyan)';
    } else if (score >= 60) {
      grade = 'Average';
      toneColor = 'var(--warning)';
    }

    return { score, grade, toneColor };
  };

  const { score: liveScore, grade: liveGrade, toneColor } = calculateDisciplinePreview();

  const handleMistakeToggle = (val) => {
    if (val === 'None') {
      setForm({ ...form, mistakes: ['None'] });
      return;
    }

    let updated = form.mistakes.filter(m => m !== 'None');
    if (updated.includes(val)) {
      updated = updated.filter(m => m !== val);
    } else {
      updated.push(val);
    }

    if (updated.length === 0) updated = ['None'];
    setForm({ ...form, mistakes: updated });
  };

  const handleNumberChange = (field, value) => {
    let cleanVal = value;
    if (typeof cleanVal === 'string' && /^0[0-9]+/.test(cleanVal)) {
      cleanVal = cleanVal.replace(/^0+/, '');
    }
    setForm(prev => ({ ...prev, [field]: cleanVal }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.tradeName.trim()) return;
    setError('');

    const rrVal = form.rr === '' || form.rr === undefined || isNaN(Number(form.rr)) ? 0 : Number(form.rr);
    const pipsVal = form.pips === '' || form.pips === undefined || isNaN(Number(form.pips)) ? 0 : Number(form.pips);
    const tpVal = form.takeProfit === '' || form.takeProfit === undefined || isNaN(Number(form.takeProfit)) ? 0 : Number(form.takeProfit);

    const payload = {
      ...form,
      isPropTrade: Boolean(form.isPropTrade),
      rr: rrVal,
      pips: pipsVal,
      takeProfit: tpVal,
      takeProfitUSD: tpVal
    };

    const persistLocalOverride = (resTrade) => {
      try {
        const overrides = JSON.parse(localStorage.getItem('tradejourn_tp_overrides') || '{}');
        if (resTrade && resTrade._id) {
          overrides[resTrade._id] = tpVal;
        }
        const sig = `${payload.tradeName}_${payload.date}_${payload.time || '00:00'}`;
        overrides[sig] = tpVal;
        const dateKey = `${payload.date}_${payload.time || '00:00'}`;
        overrides[dateKey] = tpVal;
        localStorage.setItem('tradejourn_tp_overrides', JSON.stringify(overrides));
      } catch (err) {
        console.warn('Local storage override error:', err);
      }
    };

    try {
      setSaving(true);
      const res = await api.createTrade(payload);
      persistLocalOverride(res?.trade);
      onTradeSaved();
      onClose();
    } catch (err) {
      console.warn('Initial save attempt failed, retrying with fresh session:', err.message);
      try {
        await api.demoLogin();
        const res = await api.createTrade(payload);
        persistLocalOverride(res?.trade);
        onTradeSaved();
        onClose();
      } catch (retryErr) {
        setError(retryErr.message || 'Failed to record trade. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  const mistakesOptions = [
    'Early Entry',
    'Late Entry',
    'Early Exit',
    'Late Exit',
    'Overtrading',
    'Revenge Trading',
    'FOMO',
    'Moved SL',
    'Moved TP',
    'Ignored Bias',
    'Ignored Confirmation',
    'Poor RR',
    'Entered Without Setup',
    'Traded During News',
    'Emotional Decision',
    'Overleveraged',
    'None'
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        {/* Header with Live Discipline Meter */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div className="modal-title-icon" style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'var(--profit-soft)', border: '1px solid rgba(0, 245, 155, 0.3)', display: 'grid', placeItems: 'center', color: 'var(--profit)' }}>
              <Plus size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '800' }}>Execute & Log Trade</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                Capture comprehensive execution, psychological, and market context
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Live Animated Discipline Score Badge */}
            <div
              className="modal-discipline-badge"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 16px',
                borderRadius: 'var(--radius-pill)',
                border: '1px solid var(--border-medium)',
                boxShadow: `0 0 20px -5px ${toneColor}40`
              }}
            >
              <Shield size={18} color={toneColor} />
              <div>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', fontWeight: '700' }}>
                  Live Discipline
                </span>
                <strong style={{ fontSize: '1rem', fontFamily: 'var(--font-mono)', color: toneColor }}>
                  {liveScore}/100 • {liveGrade}
                </strong>
              </div>
            </div>

            <button className="btn-close" onClick={onClose}>
              <X size={20} />
            </button>
          </div>
        </div>

        {error && (
          <div style={{ background: 'var(--loss-soft)', border: '1px solid var(--loss)', padding: '12px 16px', borderRadius: '10px', color: '#ff6685', fontSize: '0.85rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '20px' }}>
          {/* Section 1: Identification & Market */}
          <div className="form-grid-4">
            <label className="span-full">
              <span>Trade Identifier / Rationale *</span>
              <input
                type="text"
                required
                placeholder="e.g. EURUSD London Liquidity Sweep + 5m MSS"
                value={form.tradeName}
                onChange={e => setForm({ ...form, tradeName: e.target.value })}
              />
            </label>

            <label>
              <span>Date *</span>
              <input
                type="date"
                required
                value={form.date}
                onChange={e => setForm({ ...form, date: e.target.value })}
              />
            </label>

            <label>
              <span>Time *</span>
              <input
                type="time"
                required
                value={form.time}
                onChange={e => setForm({ ...form, time: e.target.value })}
              />
            </label>

            <label>
              <span>Instrument *</span>
              <select value={form.instrument} onChange={e => setForm({ ...form, instrument: e.target.value })}>
                <option>EURUSD</option>
                <option>GBPUSD</option>
                <option>XAUUSD</option>
                <option>USDJPY</option>
                <option>NAS100</option>
                <option>US30</option>
                <option>XAGUSD</option>
                <option>AUDUSD</option>
                <option>BTCUSD</option>
                <option>Other</option>
              </select>
            </label>

            <label>
              <span>Session</span>
              <select value={form.session} onChange={e => setForm({ ...form, session: e.target.value })}>
                <option>London</option>
                <option>New York</option>
                <option>Asian</option>
                <option>London + New York</option>
                <option>Other</option>
              </select>
            </label>

            <label>
              <span>Technical Level</span>
              <input
                type="text"
                placeholder="e.g. Previous Day High, Support"
                value={form.levelTraded}
                onChange={e => setForm({ ...form, levelTraded: e.target.value })}
              />
            </label>

            <label>
              <span>Trade Direction *</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={() => setForm(prev => ({
                    ...prev,
                    direction: 'Buy',
                    bias: prev.bias === 'Bearish' ? 'Bullish' : prev.bias
                  }))}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    border: (form.direction === 'Buy' || !form.direction) ? '2px solid var(--profit)' : '1px solid var(--border-medium)',
                    background: (form.direction === 'Buy' || !form.direction) ? 'rgba(0, 245, 155, 0.15)' : 'var(--bg-input)',
                    color: (form.direction === 'Buy' || !form.direction) ? 'var(--profit)' : 'var(--text-secondary)',
                    fontWeight: '800',
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  ▲ BUY (Long)
                </button>
                <button
                  type="button"
                  onClick={() => setForm(prev => ({
                    ...prev,
                    direction: 'Sell',
                    bias: prev.bias === 'Bullish' ? 'Bearish' : prev.bias
                  }))}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    border: form.direction === 'Sell' ? '2px solid var(--loss)' : '1px solid var(--border-medium)',
                    background: form.direction === 'Sell' ? 'rgba(255, 51, 102, 0.15)' : 'var(--bg-input)',
                    color: form.direction === 'Sell' ? 'var(--loss)' : 'var(--text-secondary)',
                    fontWeight: '800',
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  ▼ SELL (Short)
                </button>
              </div>
            </label>

            <label>
              <span>Macro / HTF Bias</span>
              <select value={form.bias} onChange={e => setForm({ ...form, bias: e.target.value })}>
                <option>Bullish</option>
                <option>Bearish</option>
                <option>Neutral</option>
              </select>
            </label>

            <label>
              <span>Execution Result *</span>
              <select
                value={form.result}
                onChange={e => setForm({ ...form, result: e.target.value })}
                style={{
                  color: form.result === 'WIN' ? 'var(--profit)' : form.result === 'LOSS' ? 'var(--loss)' : 'var(--warning)',
                  fontWeight: '700'
                }}
              >
                <option value="WIN">WIN (Profit Target)</option>
                <option value="LOSS">LOSS (Stop Hit)</option>
                <option value="BE">BE (Breakeven)</option>
              </select>
            </label>

            <label>
              <span>Planned / Realized RR</span>
              <input
                type="number"
                step="0.1"
                min="-10"
                max="20"
                value={form.rr ?? ''}
                onFocus={(e) => e.target.select()}
                onChange={e => handleNumberChange('rr', e.target.value)}
              />
            </label>

            <label>
              <span>Pips Captured</span>
              <input
                type="number"
                step="1"
                value={form.pips ?? ''}
                onFocus={(e) => e.target.select()}
                onChange={e => handleNumberChange('pips', e.target.value)}
              />
            </label>

            <label>
              <span>Take Profit (USD)</span>
              <input
                type="number"
                step="any"
                placeholder="e.g. 150"
                value={form.takeProfit ?? ''}
                onFocus={(e) => e.target.select()}
                onChange={e => handleNumberChange('takeProfit', e.target.value)}
              />
            </label>

            <label>
              <span>Setup Rating</span>
              <select value={form.setupRating} onChange={e => setForm({ ...form, setupRating: e.target.value })}>
                <option value="A+">A+ (Highest Conviction)</option>
                <option value="A">A (Standard Playbook)</option>
                <option value="B+">B+ (Solid Setup)</option>
                <option value="B">B (Acceptable)</option>
                <option value="C">C (Marginal Edge)</option>
                <option value="D">D (Low Edge)</option>
                <option value="No Setup">No Setup (Impulse)</option>
              </select>
            </label>

            <label>
              <span>Entry Trigger</span>
              <select value={form.entryType} onChange={e => setForm({ ...form, entryType: e.target.value })}>
                <option>Confirmation</option>
                <option>Early Entry</option>
                <option>Retest</option>
                <option>Breakout</option>
                <option>Liquidity Sweep</option>
                <option>Other</option>
              </select>
            </label>

            <label>
              <span>Emotion During Trade</span>
              <select value={form.emotion} onChange={e => setForm({ ...form, emotion: e.target.value })}>
                <option>Calm</option>
                <option>Confident</option>
                <option>Focused</option>
                <option>Fear</option>
                <option>Greed</option>
                <option>Impatient</option>
                <option>Revenge</option>
                <option>FOMO</option>
                <option>Overconfident</option>
                <option>Frustrated</option>
                <option>Anxious</option>
                <option>Hesitant</option>
                <option>Bored</option>
                <option>Other</option>
              </select>
            </label>

            <label>
              <span>Reason For Early Exit</span>
              <select value={form.reasonEarlyExit} onChange={e => setForm({ ...form, reasonEarlyExit: e.target.value })}>
                <option value="None">None (Followed Plan to Target/Stop)</option>
                <option value="TP Hit">TP Hit</option>
                <option value="SL Hit">SL Hit</option>
                <option value="Fear">Fear (Panic Closed)</option>
                <option value="Greed">Greed (Secured Pennies)</option>
                <option value="Impatience">Impatience</option>
                <option value="News Event">News Event Approaching</option>
                <option value="Market Structure Changed">Market Structure Changed</option>
                <option value="Moved SL">Moved SL Too Soon</option>
                <option value="Moved TP">Moved TP Greedily</option>
                <option value="Other">Other</option>
              </select>
            </label>

            <label>
              <span>Market Regime</span>
              <select value={form.marketCondition} onChange={e => setForm({ ...form, marketCondition: e.target.value })}>
                <option>Trending</option>
                <option>Ranging</option>
                <option>Choppy</option>
                <option>Volatile</option>
                <option>Low Volatility</option>
              </select>
            </label>
          </div>

          {/* Section 2: Mistakes Checklist */}
          <div>
            <label style={{ marginBottom: '8px' }}>
              <span>Psychological & Execution Mistakes (Check all that occurred)</span>
            </label>
            <div className="checkbox-grid">
              {mistakesOptions.map(m => {
                const isSelected = form.mistakes.includes(m);
                return (
                  <label key={m} className="checkbox-pill">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleMistakeToggle(m)}
                    />
                    <span style={{ color: isSelected && m !== 'None' ? '#ff6685' : 'inherit', fontWeight: isSelected && m !== 'None' ? '700' : '500' }}>
                      {m}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Section 3: Notes */}
          <div>
            <label>
              <span>Execution Notes & Post-Trade Review</span>
              <textarea
                rows="3"
                placeholder="What was the technical setup? Did you follow your risk parameters? What was your mindset?"
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
              />
            </label>
          </div>

          {/* Section 4: Trade Chart Screenshot & Setup Image (Optional) */}
          <div
            className="modal-section-card"
            style={{
              borderRadius: '12px',
              padding: '16px'
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px',
                flexWrap: 'wrap',
                gap: '8px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Camera size={18} style={{ color: 'var(--accent-cyan)' }} />
                <span style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-white)' }}>
                  Chart Screenshot & Technical Setup
                </span>
                <span
                  style={{
                    fontSize: '0.7rem',
                    background: 'rgba(148, 163, 184, 0.14)',
                    color: 'var(--text-secondary)',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-pill)',
                    fontWeight: '700',
                    letterSpacing: '0.04em'
                  }}
                >
                  OPTIONAL
                </span>
              </div>

              {/* Upload vs URL Toggle */}
              <div
                className="modal-toggle-tabs"
                style={{
                  display: 'flex',
                  padding: '3px',
                  borderRadius: '8px'
                }}
              >
                <button
                  type="button"
                  onClick={() => setImageMode('upload')}
                  style={{
                    border: 'none',
                    background: imageMode === 'upload' ? 'var(--accent-cyan-soft)' : 'transparent',
                    color: imageMode === 'upload' ? 'var(--accent-cyan)' : 'var(--text-muted)',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <UploadCloud size={13} /> Upload / Paste
                </button>
                <button
                  type="button"
                  onClick={() => setImageMode('url')}
                  style={{
                    border: 'none',
                    background: imageMode === 'url' ? 'var(--accent-cyan-soft)' : 'transparent',
                    color: imageMode === 'url' ? 'var(--accent-cyan)' : 'var(--text-muted)',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <LinkIcon size={13} /> Image URL
                </button>
              </div>
            </div>

            {/* Hidden file input */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileSelect}
            />

            {/* Image Preview or Drop Area */}
            {form.screenshotUrl ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div
                  className="modal-image-preview-box"
                  style={{
                    position: 'relative',
                    borderRadius: '10px',
                    overflow: 'hidden',
                    border: '1px solid var(--border-bright)',
                    maxHeight: '260px',
                    background: '#04080e',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <img
                    src={form.screenshotUrl}
                    alt="Trade Setup Preview"
                    style={{
                      width: '100%',
                      maxHeight: '260px',
                      objectFit: 'contain',
                      display: 'block'
                    }}
                  />

                  {/* Overlay Controls */}
                  <div
                    className="modal-image-controls"
                    style={{
                      position: 'absolute',
                      top: '10px',
                      right: '10px',
                      display: 'flex',
                      gap: '6px',
                      background: 'rgba(3, 6, 11, 0.85)',
                      padding: '4px 8px',
                      borderRadius: '8px',
                      backdropFilter: 'blur(8px)',
                      border: '1px solid var(--border-subtle)'
                    }}
                  >
                    <button
                      type="button"
                      title="View Full Size"
                      onClick={() => setIsPreviewZoomOpen(true)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'grid',
                        placeItems: 'center'
                      }}
                    >
                      <Maximize2 size={15} />
                    </button>
                    <button
                      type="button"
                      title="Change Image"
                      onClick={() => {
                        if (imageMode === 'upload' && fileInputRef.current) {
                          fileInputRef.current.click();
                        } else {
                          setImageMode('url');
                        }
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--accent-cyan)',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'grid',
                        placeItems: 'center'
                      }}
                    >
                      <UploadCloud size={15} />
                    </button>
                    <button
                      type="button"
                      title="Remove Image"
                      onClick={handleRemoveImage}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--loss)',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'grid',
                        placeItems: 'center'
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.78rem',
                    color: 'var(--text-muted)'
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--profit)', fontWeight: '600' }}>
                    <CheckCircle2 size={14} /> Chart image ready to save with trade
                  </span>
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#ff6685',
                      cursor: 'pointer',
                      fontSize: '0.76rem',
                      textDecoration: 'underline'
                    }}
                  >
                    Remove Image
                  </button>
                </div>
              </div>
            ) : imageMode === 'upload' ? (
              /* Drag & Drop Upload Zone */
              <div
                className={`modal-dropzone ${isDragging ? 'dragging' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current && fileInputRef.current.click()}
                style={{
                  borderRadius: '10px',
                  padding: '24px 16px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'var(--transition-fast)'
                }}
              >
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    background: 'rgba(0, 210, 255, 0.1)',
                    color: 'var(--accent-cyan)',
                    display: 'grid',
                    placeItems: 'center',
                    margin: '0 auto 10px'
                  }}
                >
                  <UploadCloud size={20} />
                </div>
                <p style={{ fontSize: '0.86rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '4px' }}>
                  {isCompressing ? 'Optimizing Chart Image...' : 'Click to upload or drag & drop trade screenshot'}
                </p>
                <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                  PNG, JPG, WebP, GIF • Or paste directly anywhere with <kbd className="modal-kbd">Ctrl+V</kbd>
                </p>
              </div>
            ) : (
              /* URL Input Tab */
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="url"
                  placeholder="Paste chart image URL (e.g. TradingView, Imgur, Discord link)"
                  value={urlInput}
                  onChange={e => setUrlInput(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleApplyUrl}
                  style={{ padding: '0 16px', whiteSpace: 'nowrap' }}
                >
                  Attach
                </button>
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving || isCompressing}>
              {saving ? 'Recording to MongoDB...' : 'Save Trade to Journal'}
            </button>
          </div>
        </form>

        {/* Full Image Lightbox Preview Modal */}
        {isPreviewZoomOpen && form.screenshotUrl && (
          <div
            className="modal-overlay"
            style={{ zIndex: 110000 }}
            onClick={() => setIsPreviewZoomOpen(false)}
          >
            <div
              className="modal-lightbox-card"
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
                onClick={() => setIsPreviewZoomOpen(false)}
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
                src={form.screenshotUrl}
                alt="Trade Setup Enlarged"
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
      </div>
    </div>
  );
};
