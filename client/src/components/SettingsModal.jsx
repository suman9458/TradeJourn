import React, { useState } from 'react';
import { X, Settings, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const SettingsModal = ({ isOpen, onClose }) => {
  const { user, updateUserSettings } = useAuth();
  const [currency, setCurrency] = useState(user?.settings?.currency || 'USD');
  const [riskPerTrade, setRiskPerTrade] = useState(user?.settings?.riskPerTrade || 1);
  const [defaultInstrument, setDefaultInstrument] = useState(user?.settings?.defaultInstrument || 'EURUSD');
  const [aiApiKey, setAiApiKey] = useState(user?.settings?.aiApiKey || '');
  const [aiModel, setAiModel] = useState(user?.settings?.aiModel || 'gpt-4o-mini');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!isOpen) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateUserSettings({
        currency,
        riskPerTrade: Number(riskPerTrade),
        defaultInstrument,
        aiApiKey,
        aiModel
      });
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        onClose();
      }, 1000);
    } catch (err) {
      alert(`Failed to save settings: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Settings size={20} color="var(--blue)" />
            <h3>TradeJourn Settings</h3>
          </div>
          <button className="btn-close" onClick={onClose}><X size={20} /></button>
        </div>

        <form onSubmit={handleSave} style={{ display: 'grid', gap: '16px' }}>
          <div className="form-grid-2">
            <label>
              <span>Account Currency</span>
              <select value={currency} onChange={e => setCurrency(e.target.value)}>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="JPY">JPY (¥)</option>
                <option value="AUD">AUD ($)</option>
              </select>
            </label>

            <label>
              <span>Default Risk % Per Trade</span>
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="10"
                value={riskPerTrade ?? ''}
                onFocus={(e) => e.target.select()}
                onChange={e => {
                  let val = e.target.value;
                  if (typeof val === 'string' && /^0[0-9]+/.test(val)) {
                    val = val.replace(/^0+/, '');
                  }
                  setRiskPerTrade(val);
                }}
              />
            </label>
          </div>

          <label>
            <span>Primary Instrument</span>
            <input
              type="text"
              value={defaultInstrument}
              onChange={e => setDefaultInstrument(e.target.value)}
              placeholder="EURUSD, XAUUSD..."
            />
          </label>

          <label>
            <span>OpenAI API Key (Optional)</span>
            <input
              type="password"
              placeholder="sk-..."
              value={aiApiKey}
              onChange={e => setAiApiKey(e.target.value)}
            />
          </label>

          <label>
            <span>AI Model</span>
            <select value={aiModel} onChange={e => setAiModel(e.target.value)}>
              <option value="gpt-4o-mini">gpt-4o-mini (Faster, cost-effective)</option>
              <option value="gpt-4o">gpt-4o (Deep institutional analysis)</option>
              <option value="gpt-4.1-mini">gpt-4.1-mini</option>
            </select>
          </label>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saved ? <><Check size={16} /> Saved</> : saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
