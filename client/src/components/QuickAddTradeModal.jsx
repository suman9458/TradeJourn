import React, { useState } from 'react';
import { Plus, X, Shield, Sparkles, CheckCircle2, AlertTriangle, Calculator, FileText } from 'lucide-react';
import { api } from '../services/api';

const emotionalRiskList = ['Fear', 'Greed', 'Impatient', 'Revenge', 'FOMO', 'Frustrated', 'Anxious', 'Overconfident'];

export const QuickAddTradeModal = ({ isOpen, onClose, onTradeSaved }) => {
  const todayStr = new Date().toISOString().slice(0, 10);
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(Math.round(now.getMinutes() / 15) * 15 % 60).padStart(2, '0')}`;

  const [form, setForm] = useState({
    tradeName: '',
    date: todayStr,
    time: timeStr,
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
    notes: ''
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'var(--profit-soft)', border: '1px solid rgba(0, 245, 155, 0.3)', display: 'grid', placeItems: 'center', color: 'var(--profit)' }}>
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
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                background: 'rgba(10, 18, 28, 0.8)',
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

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Recording to MongoDB...' : 'Save Trade to Journal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
