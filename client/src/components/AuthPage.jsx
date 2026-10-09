import React, { useState, useEffect } from 'react';
import {
  User,
  AtSign,
  Calendar,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  Zap,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Play,
  Sparkles,
  Award,
  TrendingUp,
  BarChart2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const AuthPage = ({ onDemoAccess }) => {
  const { login, register, demoLogin } = useAuth();

  useEffect(() => {
    document.title = 'TradeJourn';
  }, []);

  const [mode, setMode] = useState('login'); // 'login' | 'register'
  
  // Login State
  const [loginId, setLoginId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Register State
  const [regName, setRegName] = useState('');
  const [regUserId, setRegUserId] = useState('');
  const [regDob, setRegDob] = useState('');
  const [regExperience, setRegExperience] = useState('Intermediate');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);

  // Status & Feedback
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Format user ID handle automatically
  const handleUserIdChange = (e) => {
    let val = e.target.value.trim();
    // Allow typing with or without @
    if (val && !val.startsWith('@')) {
      val = '@' + val;
    }
    setRegUserId(val);
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!loginId.trim() || !loginPassword) return;
    setError('');
    setLoading(true);

    try {
      await login({ userId: loginId.trim(), password: loginPassword });
    } catch (err) {
      setError(err.message || 'Invalid User ID or Password');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!regName.trim()) {
      setError('Please provide your Full Name');
      return;
    }

    if (!regUserId.trim()) {
      setError('Please provide a unique User ID (e.g. @suman9458)');
      return;
    }

    // Verify format (contains english letters + numbers)
    const cleanHandle = regUserId.replace(/^@/, '');
    if (!/^[a-zA-Z0-9_]{3,24}$/.test(cleanHandle)) {
      setError('User ID must contain 3-24 English letters and numbers (e.g. @suman9458)');
      return;
    }

    if (!regDob) {
      setError('Please enter your Date of Birth (DOB)');
      return;
    }

    if (regPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setLoading(true);

    try {
      await register({
        name: regName.trim(),
        userId: regUserId.trim(),
        dob: regDob,
        tradingExperience: regExperience,
        email: regEmail.trim(),
        password: regPassword
      });
    } catch (err) {
      setError(err.message || 'Registration failed. Please try a different User ID.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = async () => {
    setError('');
    setLoading(true);
    try {
      await demoLogin();
      if (onDemoAccess) onDemoAccess();
    } catch (err) {
      setError('Demo login failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const experienceTiers = [
    {
      id: 'Beginner',
      title: 'Beginner',
      timeline: '0 - 1 Years',
      desc: 'Learning price action, risk mechanics & basic market structure',
      color: 'var(--accent-cyan)'
    },
    {
      id: 'Intermediate',
      title: 'Intermediate',
      timeline: '1 - 3 Years',
      desc: 'Disciplined playbook setups, strict R-multiple & emotional control',
      color: 'var(--accent-purple)'
    },
    {
      id: 'Expert',
      title: 'Expert',
      timeline: '3+ Years',
      desc: 'Full-time execution, prop firm funded trader & statistical alpha',
      color: 'var(--profit)'
    }
  ];

  return (
    <div className="auth-gateway-container">
      {/* Dynamic Background Glow Elements */}
      <div className="auth-glow-top" />
      <div className="auth-glow-bottom" />

      {/* Main Authentication Card */}
      <div className="auth-card-wrapper">
        {/* Brand Header */}
        <div className="auth-brand-header">
          <div className="brand-badge-large">TJ</div>
          <div>
            <div className="auth-institutional-tag">
              <Zap size={12} color="var(--profit)" />
              <span>INSTITUTIONAL TRADER PORTAL</span>
            </div>
            <h1 className="auth-title">TradeJourn</h1>
            <p className="auth-subtitle">
              Proprietary execution analytics, psychology auditing & encrypted journal ledger
            </p>
          </div>
        </div>

        {/* Auth Mode Tabs */}
        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab-btn ${mode === 'login' ? 'active' : ''}`}
            onClick={() => { setMode('login'); setError(''); }}
          >
            <User size={15} />
            <span>Existing Trader Sign In</span>
          </button>
          <button
            type="button"
            className={`auth-tab-btn ${mode === 'register' ? 'active' : ''}`}
            onClick={() => { setMode('register'); setError(''); }}
          >
            <Sparkles size={15} />
            <span>Create New Account</span>
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="auth-error-banner">
            <AlertTriangle size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* LOGIN FORM (Existing Customer) */}
        {mode === 'login' && (
          <form onSubmit={handleLoginSubmit} className="auth-form">
            <div className="auth-field">
              <label>
                <span className="field-label">Trader User ID or Email *</span>
                <div className="input-with-icon">
                  <AtSign size={17} className="field-icon" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. @suman9458 or trader@domain.com"
                    value={loginId}
                    onChange={e => setLoginId(e.target.value)}
                    autoComplete="username"
                  />
                </div>
              </label>
              <span className="field-help">Use your unique User ID handle (e.g. @suman9458)</span>
            </div>

            <div className="auth-field">
              <label>
                <span className="field-label">Password *</span>
                <div className="input-with-icon">
                  <Lock size={17} className="field-icon" />
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    required
                    placeholder="Enter your security password"
                    value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                  >
                    {showLoginPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>
            </div>

            <button type="submit" className="auth-submit-btn" disabled={loading}>
              <span>{loading ? 'Authenticating Ledger...' : 'Access Trading Terminal'}</span>
              <ArrowRight size={17} />
            </button>
          </form>
        )}

        {/* REGISTER FORM (New Account) */}
        {mode === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="auth-form">
            {/* Full Name & User ID (Grid) */}
            <div className="auth-grid-2">
              <div className="auth-field">
                <label>
                  <span className="field-label">Full Name *</span>
                  <div className="input-with-icon">
                    <User size={17} className="field-icon" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Suman Sharma"
                      value={regName}
                      onChange={e => setRegName(e.target.value)}
                    />
                  </div>
                </label>
              </div>

              <div className="auth-field">
                <label>
                  <span className="field-label">
                    Unique User ID *
                    {regUserId && (
                      <span className="handle-tag">
                        {regUserId.startsWith('@') ? regUserId : `@${regUserId}`}
                      </span>
                    )}
                  </span>
                  <div className="input-with-icon">
                    <AtSign size={17} className="field-icon" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. @suman9458"
                      value={regUserId}
                      onChange={handleUserIdChange}
                    />
                  </div>
                </label>
                <span className="field-help">English letters + numbers (e.g. @suman9458)</span>
              </div>
            </div>

            {/* Date of Birth & Email */}
            <div className="auth-grid-2">
              <div className="auth-field">
                <label>
                  <span className="field-label">Date of Birth (DOB) *</span>
                  <div className="input-with-icon">
                    <Calendar size={17} className="field-icon" />
                    <input
                      type="date"
                      required
                      max={new Date().toISOString().slice(0, 10)}
                      value={regDob}
                      onChange={e => setRegDob(e.target.value)}
                    />
                  </div>
                </label>
                <span className="field-help">For trader verification & journal profile</span>
              </div>

              <div className="auth-field">
                <label>
                  <span className="field-label">Email Address (Optional)</span>
                  <div className="input-with-icon">
                    <AtSign size={17} className="field-icon" />
                    <input
                      type="email"
                      placeholder="e.g. suman@example.com"
                      value={regEmail}
                      onChange={e => setRegEmail(e.target.value)}
                    />
                  </div>
                </label>
                <span className="field-help">Optional — leave blank to use @tradejourn ID</span>
              </div>
            </div>

            {/* Trading Experience Selector */}
            <div className="auth-field">
              <span className="field-label">Trading Experience Level *</span>
              <div className="experience-cards-grid">
                {experienceTiers.map(tier => {
                  const isSelected = regExperience === tier.id;
                  return (
                    <div
                      key={tier.id}
                      className={`experience-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => setRegExperience(tier.id)}
                    >
                      <div className="exp-top">
                        <span className="exp-title" style={{ color: isSelected ? tier.color : '#fff' }}>
                          {tier.title}
                        </span>
                        <span className="exp-timeline">{tier.timeline}</span>
                      </div>
                      <p className="exp-desc">{tier.desc}</p>
                      {isSelected && (
                        <div className="exp-active-indicator" style={{ background: tier.color }}>
                          <CheckCircle2 size={13} color="#04080e" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Password */}
            <div className="auth-field">
              <label>
                <span className="field-label">Password *</span>
                <div className="input-with-icon">
                  <Lock size={17} className="field-icon" />
                  <input
                    type={showRegPassword ? 'text' : 'password'}
                    required
                    placeholder="Create secure password (min. 6 characters)"
                    value={regPassword}
                    onChange={e => setRegPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowRegPassword(!showRegPassword)}
                  >
                    {showRegPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>
              <span className="field-help">Minimum 6 alphanumeric characters</span>
            </div>

            <button type="submit" className="auth-submit-btn" disabled={loading}>
              <span>{loading ? 'Creating Institutional Account...' : 'Register Account & Initialize Ledger'}</span>
              <ArrowRight size={17} />
            </button>
          </form>
        )}

        {/* Divider */}
        <div className="auth-divider">
          <span>OR QUICK EXPLORATION</span>
        </div>

        {/* Demo Access Button */}
        <button
          type="button"
          className="auth-demo-btn"
          onClick={handleQuickDemo}
          disabled={loading}
        >
          <Play size={16} />
          <span>Launch Instant Demo Terminal (@protrader)</span>
        </button>

        {/* Footer Security Badges */}
        <div className="auth-security-footer">
          <div className="security-item">
            <ShieldCheck size={14} color="var(--profit)" />
            <span>256-Bit Encrypted Data</span>
          </div>
          <div className="security-item">
            <CheckCircle2 size={14} color="var(--accent-cyan)" />
            <span>MongoDB Enterprise Isolation</span>
          </div>
          <div className="security-item">
            <Award size={14} color="var(--accent-purple)" />
            <span>Prop Firm Audit Ready</span>
          </div>
        </div>
      </div>
    </div>
  );
};
