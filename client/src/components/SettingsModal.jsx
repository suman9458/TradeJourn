import React, { useState, useEffect } from 'react';
import { X, Settings, Check, User, Calendar, Mail, AtSign, Sparkles, Sliders, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const SettingsModal = ({ isOpen, onClose }) => {
  const { user, updateUserSettings } = useAuth();

  // Profile Fields
  const [name, setName] = useState('');
  const [userId, setUserId] = useState('');
  const [dob, setDob] = useState('');
  const [email, setEmail] = useState('');
  const [tradingExperience, setTradingExperience] = useState('Intermediate');

  // Trading & System Settings
  const [currency, setCurrency] = useState('USD');
  const [riskPerTrade, setRiskPerTrade] = useState(1);
  const [defaultInstrument, setDefaultInstrument] = useState('EURUSD');
  const [aiApiKey, setAiApiKey] = useState('');
  const [aiModel, setAiModel] = useState('gpt-4o-mini');

  const [activeTab, setActiveTab] = useState('profile'); // 'profile' | 'trading' | 'ai'
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Sync state whenever modal opens or user data changes
  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setUserId(user.userId || '');
      setDob(user.dob || '');
      setEmail(user.email || '');
      setTradingExperience(user.tradingExperience || 'Intermediate');
      setCurrency(user.settings?.currency || 'USD');
      setRiskPerTrade(user.settings?.riskPerTrade ?? 1);
      setDefaultInstrument(user.settings?.defaultInstrument || 'EURUSD');
      setAiApiKey(user.settings?.aiApiKey || '');
      setAiModel(user.settings?.aiModel || 'gpt-4o-mini');
      setErrorMsg('');
    }
  }, [user, isOpen]);

  if (!isOpen) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg('');

    try {
      await updateUserSettings({
        name: name.trim(),
        userId: userId.trim(),
        dob: dob.trim(),
        email: email.trim(),
        tradingExperience,
        settings: {
          currency,
          riskPerTrade: Number(riskPerTrade),
          defaultInstrument,
          aiApiKey,
          aiModel
        }
      });

      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        onClose();
      }, 1000);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '580px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header" style={{ paddingBottom: '14px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(0, 210, 255, 0.15)', border: '1px solid rgba(0, 210, 255, 0.3)', display: 'grid', placeItems: 'center' }}>
              <Settings size={18} color="var(--accent-cyan)" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '800' }}>Trader Profile & Account Settings</h3>
              <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--text-secondary)' }}>Manage your personal identity, risk parameters, and AI coach configuration</p>
            </div>
          </div>
          <button className="btn-close" onClick={onClose}><X size={20} /></button>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: '6px', padding: '12px 0 6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            style={{
              padding: '8px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.82rem',
              fontWeight: '700',
              border: 'none',
              background: activeTab === 'profile' ? 'var(--accent-cyan)' : 'transparent',
              color: activeTab === 'profile' ? '#060c14' : 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            <User size={14} />
            <span>Profile & Identity</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('trading')}
            style={{
              padding: '8px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.82rem',
              fontWeight: '700',
              border: 'none',
              background: activeTab === 'trading' ? 'var(--accent-cyan)' : 'transparent',
              color: activeTab === 'trading' ? '#060c14' : 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            <Sliders size={14} />
            <span>Trading & Risk</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ai')}
            style={{
              padding: '8px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.82rem',
              fontWeight: '700',
              border: 'none',
              background: activeTab === 'ai' ? 'var(--accent-cyan)' : 'transparent',
              color: activeTab === 'ai' ? '#060c14' : 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            <Sparkles size={14} />
            <span>AI Coach</span>
          </button>
        </div>

        {errorMsg && (
          <div style={{ padding: '10px 14px', background: 'rgba(255, 77, 77, 0.15)', border: '1px solid rgba(255, 77, 77, 0.4)', borderRadius: 'var(--radius-sm)', color: '#ff7373', fontSize: '0.84rem', marginTop: '12px' }}>
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSave} style={{ display: 'grid', gap: '16px', overflowY: 'auto', padding: '16px 2px 4px 2px' }}>
          {/* TAB 1: Profile & Personal Details */}
          {activeTab === 'profile' && (
            <div style={{ display: 'grid', gap: '14px' }}>
              <div className="form-grid-2">
                <label>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <User size={13} color="var(--accent-cyan)" />
                    <span>Trader Full Name</span>
                  </span>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Suman Sharma"
                  />
                </label>

                <label>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AtSign size={13} color="var(--accent-cyan)" />
                    <span>Trader Handle / User ID</span>
                  </span>
                  <input
                    type="text"
                    required
                    value={userId}
                    onChange={e => setUserId(e.target.value)}
                    placeholder="@suman9458"
                  />
                </label>
              </div>

              <div className="form-grid-2">
                <label>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Calendar size={13} color="var(--accent-cyan)" />
                    <span>Date of Birth (DOB)</span>
                  </span>
                  <input
                    type="date"
                    value={dob}
                    onChange={e => setDob(e.target.value)}
                  />
                </label>

                <label>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Mail size={13} color="var(--accent-cyan)" />
                    <span>Email Address</span>
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="trader@tradejourn.com"
                  />
                </label>
              </div>

              <label>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ShieldCheck size={13} color="var(--profit)" />
                  <span>Trading Experience Level</span>
                </span>
                <select
                  value={tradingExperience}
                  onChange={e => setTradingExperience(e.target.value)}
                >
                  <option value="Beginner">Beginner (0 - 1 years, mastering risk & setups)</option>
                  <option value="Intermediate">Intermediate (1 - 3 years, prop challenge scaling)</option>
                  <option value="Expert">Expert (3+ years, funded institutional management)</option>
                </select>
              </label>
            </div>
          )}

          {/* TAB 2: Trading & Risk Parameters */}
          {activeTab === 'trading' && (
            <div style={{ display: 'grid', gap: '14px' }}>
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
                <span>Default / Primary Instrument</span>
                <input
                  type="text"
                  value={defaultInstrument}
                  onChange={e => setDefaultInstrument(e.target.value)}
                  placeholder="EURUSD, XAUUSD, BTCUSD..."
                />
              </label>
            </div>
          )}

          {/* TAB 3: AI Coach Settings */}
          {activeTab === 'ai' && (
            <div style={{ display: 'grid', gap: '14px' }}>
              <label>
                <span>OpenAI API Key (Optional)</span>
                <input
                  type="password"
                  placeholder="sk-proj-... (Leave blank to use grounded offline coach)"
                  value={aiApiKey}
                  onChange={e => setAiApiKey(e.target.value)}
                />
              </label>

              <label>
                <span>Selected AI Model</span>
                <select value={aiModel} onChange={e => setAiModel(e.target.value)}>
                  <option value="gpt-4o-mini">gpt-4o-mini (Faster, cost-effective)</option>
                  <option value="gpt-4o">gpt-4o (Deep hedge-fund reasoning)</option>
                  <option value="gpt-4.1-mini">gpt-4.1-mini</option>
                </select>
              </label>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Logged in as <strong style={{ color: 'var(--text-white)' }}>{user?.userId || user?.name}</strong>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saved ? <><Check size={16} /> Saved Successfully</> : saving ? 'Saving Profile...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
