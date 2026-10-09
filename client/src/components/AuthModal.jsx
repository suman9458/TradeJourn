import React, { useState } from 'react';
import { X, LogIn, UserPlus, Play, User, AtSign, Calendar, Lock, AlertTriangle, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

export const AuthModal = ({ isOpen, onClose }) => {
  const { login, register, demoLogin } = useAuth();
  const [isRegister, setIsRegister] = useState(false);

  // Form states
  const [loginId, setLoginId] = useState('');
  const [name, setName] = useState('');
  const [userId, setUserId] = useState('');
  const [dob, setDob] = useState('');
  const [tradingExperience, setTradingExperience] = useState('Intermediate');
  const [password, setPassword] = useState('');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleUserIdChange = (e) => {
    let val = e.target.value.trim();
    if (val && !val.startsWith('@')) {
      val = '@' + val;
    }
    setUserId(val);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegister) {
        if (!name.trim()) throw new Error('Please provide your name');
        if (!userId.trim()) throw new Error('Please provide a unique User ID (e.g. @suman9458)');
        const cleanHandle = userId.replace(/^@/, '');
        if (!/^[a-zA-Z0-9_]{3,24}$/.test(cleanHandle)) {
          throw new Error('User ID must contain 3-24 English letters and numbers (e.g. @suman9458)');
        }
        if (!dob) throw new Error('Please provide your Date of Birth');
        if (password.length < 6) throw new Error('Password must be at least 6 characters');

        await register({
          name: name.trim(),
          userId: userId.trim(),
          dob,
          tradingExperience,
          password
        });
      } else {
        if (!loginId.trim()) throw new Error('Please provide your User ID');
        if (!password) throw new Error('Please provide your password');
        await login({ userId: loginId.trim(), password });
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = async () => {
    setLoading(true);
    try {
      await demoLogin();
      onClose();
    } catch (err) {
      setError(err.message || 'Demo login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminQuickLogin = async () => {
    setLoading(true);
    setError('');
    try {
      await login({ userId: '@suman9458', password: 'Skumar9458@' });
      onClose();
    } catch (err) {
      setError(err.message || 'Admin login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
        <div className="modal-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--profit)', fontSize: '0.72rem', fontWeight: '800', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '4px' }}>
              <ShieldCheck size={14} />
              <span>TradeJourn Trader Portal</span>
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '800' }}>
              {isRegister ? 'Create Trader Account' : 'Trader Sign In'}
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
              {isRegister ? 'Register your private encrypted trading journal' : 'Enter your unique User ID and password to access'}
            </p>
          </div>
          <button className="btn-close" onClick={onClose}><X size={20} /></button>
        </div>

        {error && (
          <div style={{ background: 'var(--loss-soft)', border: '1px solid var(--loss)', padding: '12px 14px', borderRadius: '8px', color: '#ff6685', fontSize: '0.85rem', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600' }}>
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
            {(error.includes('unreachable') || error.includes('5000')) && (
              <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,102,133,0.2)', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                <p style={{ margin: '0 0 6px 0' }}>
                  💡 <strong>To start the backend:</strong> Run <code style={{ color: 'var(--profit)', background: 'rgba(0,0,0,0.3)', padding: '2px 5px', borderRadius: '4px' }}>npm run dev</code> in the project root or double-click <code style={{ color: 'var(--profit)', background: 'rgba(0,0,0,0.3)', padding: '2px 5px', borderRadius: '4px' }}>start-dev.bat</code>.
                </p>
                <button
                  type="button"
                  onClick={async () => {
                    setError('');
                    setLoading(true);
                    try {
                      await api.checkHealth();
                      setError('');
                    } catch (e) {
                      setError('Backend server is still unreachable on port 5000.');
                    } finally {
                      setLoading(false);
                    }
                  }}
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: '#fff',
                    borderRadius: '5px',
                    padding: '4px 10px',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    marginTop: '4px'
                  }}
                >
                  🔄 Retry Backend Connection
                </button>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '14px' }}>
          {isRegister ? (
            <>
              <label>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: '600' }}>Full Name *</span>
                <input
                  type="text"
                  required
                  placeholder="e.g. Suman Sharma"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </label>

              <label>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: '600' }}>
                  Unique User ID * (e.g. @suman9458)
                </span>
                <input
                  type="text"
                  required
                  placeholder="@suman9458"
                  value={userId}
                  onChange={handleUserIdChange}
                />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: '600' }}>Date of Birth (DOB) *</span>
                  <input
                    type="date"
                    required
                    max={new Date().toISOString().slice(0, 10)}
                    value={dob}
                    onChange={e => setDob(e.target.value)}
                  />
                </label>

                <label>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: '600' }}>Trading Experience *</span>
                  <select
                    value={tradingExperience}
                    onChange={e => setTradingExperience(e.target.value)}
                  >
                    <option value="Beginner">Beginner (0-1 yrs)</option>
                    <option value="Intermediate">Intermediate (1-3 yrs)</option>
                    <option value="Expert">Expert (3+ yrs)</option>
                  </select>
                </label>
              </div>
            </>
          ) : (
            <label>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: '600' }}>User ID or Email *</span>
              <input
                type="text"
                required
                placeholder="e.g. @suman9458"
                value={loginId}
                onChange={e => setLoginId(e.target.value)}
                autoComplete="username"
              />
            </label>
          )}

          <label>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: '600' }}>Password *</span>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
            />
          </label>

          <button type="submit" className="btn-primary" style={{ marginTop: '6px' }} disabled={loading}>
            {isRegister ? <UserPlus size={16} /> : <LogIn size={16} />}
            <span>{loading ? 'Processing...' : isRegister ? 'Register Account' : 'Sign In'}</span>
          </button>
        </form>

        <div style={{ margin: '18px 0', textAlign: 'center', position: 'relative' }}>
          <hr style={{ border: 'none', borderTop: '1px solid var(--border-medium)' }} />
          <span style={{ position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)', background: '#0c1622', padding: '0 12px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            OR
          </span>
        </div>

        <div style={{ display: 'grid', gap: '8px' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleDemo}
            style={{ width: '100%', borderColor: 'var(--profit)', color: 'var(--profit)' }}
            disabled={loading}
          >
            <Play size={16} />
            <span>Instant 1-Click Demo Access (@protrader)</span>
          </button>

          <button
            type="button"
            className="btn-secondary"
            onClick={handleAdminQuickLogin}
            style={{ width: '100%', borderColor: '#f59e0b', color: '#f59e0b', background: 'rgba(245, 158, 11, 0.08)' }}
            disabled={loading}
          >
            <ShieldCheck size={16} />
            <span>1-Click Admin Access (@suman9458)</span>
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          {isRegister ? 'Already registered?' : "Need a new trader account?"}{' '}
          <button
            type="button"
            className="btn-ghost"
            style={{ padding: '2px 4px', color: 'var(--accent-cyan)', textDecoration: 'underline' }}
            onClick={() => { setIsRegister(!isRegister); setError(''); }}
          >
            {isRegister ? 'Sign In with User ID' : 'Create New Account'}
          </button>
        </div>
      </div>
    </div>
  );
};
