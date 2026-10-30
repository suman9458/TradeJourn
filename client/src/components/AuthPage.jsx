import React, { useState, useEffect } from 'react';
import {
  User,
  AtSign,
  Calendar,
  Lock,
  Unlock,
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
  BarChart2,
  LayoutGrid,
  Sun,
  Moon,
  Flame,
  Check,
  HelpCircle,
  X,
  Key,
  Mail,
  Phone,
  RefreshCw,
  ArrowLeft
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { isFirebaseConfigured, sendFirebasePhoneOtp, confirmFirebaseOtp } from '../services/firebase';
import authHeroImg1 from '../assets/auth-trading-hero.jpg';
import authHeroImg2 from '../assets/auth-trading-hero-2.jpg';
import authHeroImg3 from '../assets/auth-trading-hero-3.jpg';

export const AuthPage = ({ onDemoAccess, theme: propTheme, onToggleTheme: propToggleTheme }) => {
  const { login, register, demoLogin } = useAuth();

  const [localTheme, setLocalTheme] = useState(() => {
    return propTheme || localStorage.getItem('tradejourn_theme') || 'dark';
  });

  useEffect(() => {
    if (propTheme) {
      setLocalTheme(propTheme);
    }
  }, [propTheme]);

  const activeTheme = propTheme || localTheme;

  const handleToggleTheme = () => {
    if (propToggleTheme) {
      propToggleTheme();
    } else {
      const next = activeTheme === 'dark' ? 'light' : 'dark';
      setLocalTheme(next);
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('tradejourn_theme', next);
    }
  };

  useEffect(() => {
    document.title = 'TradeJourn | Institutional Trading Journal';
  }, []);

  // Mode: 'register' | 'login'
  const [mode, setMode] = useState('register');

  // Carousel Slide & Auto-Slide (pauses on hover)
  const [activeSlide, setActiveSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Login State
  const [loginId, setLoginId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Register State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [regUserId, setRegUserId] = useState('');
  const [regDob, setRegDob] = useState('');
  const [regExperience, setRegExperience] = useState('Intermediate');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);

  // Modals & Feedback
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Forgot Password & OTP State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState(1); // 1: identify, 2: otp & new pass, 3: success
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [showForgotNewPassword, setShowForgotNewPassword] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [maskedDestination, setMaskedDestination] = useState('');
  const [devOtpHint, setDevOtpHint] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [confirmationResult, setConfirmationResult] = useState(null);

  // Resend OTP countdown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const openForgotPassword = () => {
    setForgotIdentifier(loginId || '');
    setForgotStep(1);
    setForgotOtp('');
    setForgotNewPassword('');
    setForgotConfirmPassword('');
    setForgotError('');
    setForgotSuccess('');
    setDevOtpHint('');
    setConfirmationResult(null);
    setShowForgotModal(true);
  };

  const handleSendOtp = async (e) => {
    if (e) e.preventDefault();
    setForgotError('');
    setForgotSuccess('');
    const ident = forgotIdentifier.trim();
    if (!ident) {
      setForgotError('Please enter your registered User ID, Email, or Mobile Number');
      return;
    }

    const isPhone = !ident.includes('@') && /[0-9]{7,}/.test(ident.replace(/[^0-9]/g, ''));

    setForgotLoading(true);
    try {
      if (isPhone && isFirebaseConfigured()) {
        const { confirmationResult: confRes, formattedPhone } = await sendFirebasePhoneOtp(
          ident,
          'firebase-recaptcha-container'
        );
        setConfirmationResult(confRes);
        setMaskedDestination(formattedPhone.slice(0, 3) + '****' + formattedPhone.slice(-4));
        setForgotSuccess(`Google SMS verification code sent to ${formattedPhone}`);
        setForgotStep(2);
        setResendCooldown(600); // 10-minute cooldown
      } else {
        const data = await api.forgotPasswordSendOtp({ identifier: ident });
        setConfirmationResult(null);
        setMaskedDestination(data.destination || 'your registered contact');
        if (data.devOtp) {
          setDevOtpHint(data.devOtp);
        }
        setForgotSuccess(data.message || 'Verification code sent!');
        setForgotStep(2);
        setResendCooldown(600); // 10-minute cooldown
      }
    } catch (err) {
      setForgotError(err.message || 'Failed to send OTP code. Please verify your User ID, Email, or Mobile.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || forgotLoading) return;
    setForgotError('');
    setForgotSuccess('');
    const ident = forgotIdentifier.trim();
    const isPhone = !ident.includes('@') && /[0-9]{7,}/.test(ident.replace(/[^0-9]/g, ''));

    setForgotLoading(true);
    try {
      if (isPhone && isFirebaseConfigured()) {
        const { confirmationResult: confRes, formattedPhone } = await sendFirebasePhoneOtp(
          ident,
          'firebase-recaptcha-container'
        );
        setConfirmationResult(confRes);
        setForgotSuccess(`New Google SMS verification code sent to ${formattedPhone}`);
        setResendCooldown(600); // 10-minute cooldown
      } else {
        const data = await api.forgotPasswordSendOtp({ identifier: ident });
        if (data.devOtp) {
          setDevOtpHint(data.devOtp);
        }
        setForgotSuccess('New verification code sent!');
        setResendCooldown(600); // 10-minute cooldown
      }
    } catch (err) {
      setForgotError(err.message || 'Failed to resend code');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleVerifyAndResetPassword = async (e) => {
    if (e) e.preventDefault();
    setForgotError('');
    setForgotSuccess('');

    const cleanOtp = forgotOtp.trim();
    if (cleanOtp.length !== 6) {
      setForgotError('Please enter the full 6-digit verification code');
      return;
    }

    if (forgotNewPassword.length < 8) {
      setForgotError('New password must be at least 8 characters long');
      return;
    }

    if (forgotNewPassword !== forgotConfirmPassword) {
      setForgotError('Passwords do not match. Please re-enter both carefully.');
      return;
    }

    setForgotLoading(true);
    try {
      if (confirmationResult) {
        // Step A: Verify OTP via Google Firebase client SDK
        const { idToken } = await confirmFirebaseOtp(confirmationResult, cleanOtp);

        // Step B: Reset password via server-verified Firebase ID Token
        const resetData = await api.forgotPasswordFirebaseReset({
          idToken,
          newPassword: forgotNewPassword,
          identifier: forgotIdentifier.trim()
        });

        setForgotSuccess(resetData.message || 'Password reset successfully via Firebase!');
        setForgotStep(3);
      } else {
        // Step A: Verify OTP and obtain verified resetToken
        const verifyData = await api.forgotPasswordVerifyOtp({
          identifier: forgotIdentifier.trim(),
          otp: cleanOtp
        });

        // Step B: Reset password with the verified resetToken
        const resetData = await api.forgotPasswordReset({
          resetToken: verifyData.resetToken,
          newPassword: forgotNewPassword
        });

        setForgotSuccess(resetData.message || 'Password reset successfully!');
        setForgotStep(3);
      }
    } catch (err) {
      setForgotError(err.message || 'Verification failed. Please check the OTP code and try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  // Auto-slide carousel every 6 seconds
  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(() => {
      setActiveSlide(prev => (prev + 1) % 3);
    }, 6000);
    return () => clearInterval(timer);
  }, [isPaused]);

  // Auto-generate suggested handle if user types first/last name
  const handleNameBlur = () => {
    if (!regUserId && (firstName || lastName)) {
      const base = (firstName + (lastName ? lastName.charAt(0) : ''))
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
      if (base) {
        setRegUserId(`@${base}${Math.floor(100 + Math.random() * 900)}`);
      }
    }
  };

  const handleUserIdChange = (e) => {
    let val = e.target.value.trim();
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
      setError(err.message || 'Invalid Trader ID or Password');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    if (!fullName) {
      setError('Please provide your First and Last Name');
      return;
    }

    if (!regUserId.trim()) {
      setError('Please provide a unique User ID handle (e.g. @abc123)');
      return;
    }

    const cleanHandle = regUserId.replace(/^@/, '');
    if (!/^[a-zA-Z0-9_]{3,24}$/.test(cleanHandle)) {
      setError('User ID must contain 3-24 English letters and numbers (e.g. @abc123)');
      return;
    }

    if (!regDob) {
      setError('Please specify your Date of Birth (DOB)');
      return;
    }

    if (regPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    if (!agreeTerms) {
      setError('Please agree to the Terms & Conditions to create an account');
      return;
    }

    setLoading(true);

    try {
      await register({
        name: fullName,
        userId: regUserId.trim(),
        dob: regDob,
        tradingExperience: regExperience,
        email: regEmail.trim(),
        phoneNumber: regPhone.trim(),
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

  const slides = [
    {
      image: authHeroImg1,
      sloganLine1: 'Trade',
      sloganHighlight: 'Smarter',
      sloganLine2: 'Everyday',
      subtext: 'PLAN  |  EXECUTE  |  REVIEW  |  GROW',
      features: [
        { icon: BarChart2, label: 'Advanced Charting' },
        { icon: LayoutGrid, label: 'Track Performance' },
        { icon: TrendingUp, label: 'Build Better Habits' }
      ]
    },
    {
      image: authHeroImg2,
      sloganLine1: 'Master',
      sloganHighlight: 'Your Edge',
      sloganLine2: 'With Rules',
      subtext: 'DISCIPLINE  |  RISK-MANAGED  |  ALPHA',
      features: [
        { icon: Sparkles, label: 'AI Trade Coach' },
        { icon: ShieldCheck, label: 'Drawdown Shield' },
        { icon: Award, label: 'Prop Firm Ready' }
      ]
    },
    {
      image: authHeroImg3,
      sloganLine1: 'Compound',
      sloganHighlight: 'Consistency',
      sloganLine2: 'No FOMO',
      subtext: 'DATA-DRIVEN  |  R-MULTIPLE  |  PROFIT',
      features: [
        { icon: Zap, label: 'Instant Analytics' },
        { icon: CheckCircle2, label: 'Encrypted Ledger' },
        { icon: Flame, label: 'Streak Tracking' }
      ]
    }
  ];

  const experienceTiers = [
    { id: 'Beginner', title: 'Beginner (0-1y)' },
    { id: 'Intermediate', title: 'Intermediate (1-3y)' },
    { id: 'Expert', title: 'Expert (3y+)' }
  ];

  const curSlide = slides[activeSlide];

  return (
    <div className="auth-ultra-container">
      {/* Background ambient lighting */}
      <div className="auth-ambient-blur-1" />
      <div className="auth-ambient-blur-2" />

      {/* Main Split Card */}
      <div className="auth-split-card">
        {/* LEFT COLUMN: Visual Hero Showcase with Smooth Image Transitions */}
        <div
          className="auth-hero-showcase"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          {/* Layered background images for smooth crossfade & Ken Burns effect */}
          <div className="hero-background-layers" aria-hidden="true">
            {slides.map((s, idx) => (
              <div
                key={idx}
                className={`hero-bg-layer ${activeSlide === idx ? 'active' : ''}`}
                style={{ backgroundImage: `url(${s.image})` }}
              />
            ))}
          </div>

          {/* Dark gradient overlay for contrast */}
          <div className="auth-hero-overlay" />

          {/* Top Branding */}
          <div className="auth-hero-header">
            <div className="auth-hero-logo">
              <span className="hero-logo-badge">
                <img src="/logo.png" alt="TradeJourn Logo" />
              </span>
              <div className="hero-logo-info">
                <span className="hero-logo-title">TRADEJOURN</span>
                <span className="hero-logo-subtitle">TRADE  |  ANALYZE  |  IMPROVE</span>
              </div>
            </div>
          </div>

          {/* Big Stylized Slogan with smooth transition */}
          <div className="auth-hero-body">
            <div key={activeSlide} className="hero-slogan-wrapper hero-slide-fade">
              <h2 className="hero-slogan-heading">
                <span className="slogan-word-1">{curSlide.sloganLine1}</span>{' '}
                <span className="slogan-script-glow">{curSlide.sloganHighlight}</span>
                <br />
                <span className="slogan-word-2">{curSlide.sloganLine2}</span>
              </h2>
              <div className="hero-slogan-sub">{curSlide.subtext}</div>
            </div>
          </div>

          {/* Bottom Features & Carousel Dots */}
          <div className="auth-hero-footer">
            <div key={activeSlide} className="hero-features-row hero-features-fade">
              {curSlide.features.map((feat, idx) => {
                const IconComponent = feat.icon;
                return (
                  <div
                    key={idx}
                    className="hero-feature-item"
                    style={{ animationDelay: `${idx * 70}ms` }}
                  >
                    <div className="hero-feature-icon-box">
                      <IconComponent size={17} />
                    </div>
                    <span className="hero-feature-label">{feat.label}</span>
                  </div>
                );
              })}
            </div>

            {/* Pagination Indicators */}
            <div className="hero-pagination-dots" role="tablist" aria-label="Feature slides">
              {slides.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={`pagination-dot ${activeSlide === idx ? 'active' : ''}`}
                  onClick={() => setActiveSlide(idx)}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Authentication Form */}
        <div className="auth-form-column">
          {/* Top Actions: Theme toggle & Mode toggle */}
          <div className="auth-top-bar">
            <div className="auth-mode-pill-toggle">
              <button
                type="button"
                className={`mode-toggle-btn ${mode === 'register' ? 'active' : ''}`}
                onClick={() => { setMode('register'); setError(''); }}
              >
                Sign Up
              </button>
              <button
                type="button"
                className={`mode-toggle-btn ${mode === 'login' ? 'active' : ''}`}
                onClick={() => { setMode('login'); setError(''); }}
              >
                Log In
              </button>
            </div>

            <button
              type="button"
              className="auth-theme-icon-btn"
              onClick={handleToggleTheme}
              title={activeTheme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label="Toggle theme"
            >
              {activeTheme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>
          </div>

          {/* Form Header */}
          <div className="auth-column-header">
            <h1 className="auth-main-heading">
              {mode === 'register' ? 'Create an account' : 'Welcome back'}
            </h1>
            <p className="auth-main-subheading">
              {mode === 'register'
                ? 'Start your trading journey today.'
                : 'Enter your credentials to access your trading ledger.'}
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="auth-alert-error" role="alert">
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* REGISTER FORM */}
          {mode === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="auth-modern-form">
              {/* Row 1: First Name & Last Name */}
              <div className="form-row-2">
                <div className="modern-input-group">
                  <input
                    type="text"
                    required
                    placeholder="First Name"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    onBlur={handleNameBlur}
                    className="modern-input"
                  />
                </div>
                <div className="modern-input-group">
                  <input
                    type="text"
                    placeholder="Last Name"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    onBlur={handleNameBlur}
                    className="modern-input"
                  />
                </div>
              </div>

              {/* Row 2: Unique User ID Handle */}
              <div className="modern-input-group has-icon-left">
                <AtSign size={17} className="input-leading-icon" />
                <input
                  type="text"
                  required
                  placeholder="Unique User ID (e.g. @abc123)"
                  value={regUserId}
                  onChange={handleUserIdChange}
                  className="modern-input"
                />
              </div>

              {/* Row 3: Email */}
              <div className="modern-input-group has-icon-left">
                <Mail size={17} className="input-leading-icon" />
                <input
                  type="email"
                  placeholder="Email"
                  value={regEmail}
                  onChange={e => setRegEmail(e.target.value)}
                  className="modern-input"
                />
              </div>

              {/* Row 3b: Mobile Number */}
              <div className="modern-input-group has-icon-left">
                <Phone size={17} className="input-leading-icon" />
                <input
                  type="tel"
                  placeholder="Mobile / Phone (e.g. +911234****** for OTP recovery)"
                  value={regPhone}
                  onChange={e => setRegPhone(e.target.value)}
                  className="modern-input"
                />
              </div>

              {/* Row 4: Date of Birth & Experience Grid */}
              <div className="form-row-2" style={{ marginTop: '6px' }}>
                <div className="modern-input-group has-icon-left" style={{ position: 'relative' }}>
                  <span
                    style={{
                      position: 'absolute',
                      top: '-9px',
                      left: '12px',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      color: 'var(--accent-cyan, #00f59b)',
                      backgroundColor: 'var(--bg-card, #0f172a)',
                      padding: '0 6px',
                      borderRadius: '4px',
                      zIndex: 3,
                      letterSpacing: '0.4px',
                      pointerEvents: 'none'
                    }}
                  >
                    Date of Birth (DOB)
                  </span>
                  <Calendar size={17} className="input-leading-icon" />
                  <input
                    type="date"
                    required
                    max={new Date().toISOString().slice(0, 10)}
                    value={regDob}
                    onChange={e => setRegDob(e.target.value)}
                    className="modern-input date-picker-input"
                    title="Date of Birth (DOB)"
                  />
                </div>
                <div className="modern-input-group select-wrapper" style={{ position: 'relative' }}>
                  <span
                    style={{
                      position: 'absolute',
                      top: '-9px',
                      left: '12px',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      color: 'var(--text-secondary, #94a3b8)',
                      backgroundColor: 'var(--bg-card, #0f172a)',
                      padding: '0 6px',
                      borderRadius: '4px',
                      zIndex: 3,
                      letterSpacing: '0.4px',
                      pointerEvents: 'none'
                    }}
                  >
                    Trading Experience
                  </span>
                  <select
                    value={regExperience}
                    onChange={e => setRegExperience(e.target.value)}
                    className="modern-input modern-select"
                  >
                    {experienceTiers.map(tier => (
                      <option key={tier.id} value={tier.id}>
                        {tier.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 5: Password */}
              <div className="modern-input-group has-icon-left has-icon-right">
                <button
                  type="button"
                  className="input-leading-action"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowRegPassword(prev => !prev);
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                  title={showRegPassword ? "Lock / Hide password" : "Unlock / Show password"}
                  aria-label={showRegPassword ? "Lock / Hide password" : "Unlock / Show password"}
                >
                  {showRegPassword ? (
                    <Unlock size={17} className="input-action-icon active" />
                  ) : (
                    <Lock size={17} className="input-action-icon" />
                  )}
                </button>
                <input
                  type={showRegPassword ? 'text' : 'password'}
                  required
                  placeholder="Password"
                  value={regPassword}
                  onChange={e => setRegPassword(e.target.value)}
                  className="modern-input"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="input-trailing-action"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowRegPassword(prev => !prev);
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                  title={showRegPassword ? "Hide password" : "Show password"}
                  aria-label={showRegPassword ? "Hide password" : "Show password"}
                >
                  {showRegPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {/* Terms & Conditions Checkbox */}
              <div className="terms-checkbox-row">
                <label className="custom-checkbox-label" htmlFor="terms-agreement-checkbox">
                  <input
                    id="terms-agreement-checkbox"
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={e => setAgreeTerms(e.target.checked)}
                    className="custom-checkbox-input"
                  />
                  <span className="checkbox-visual" aria-hidden="true">
                    {agreeTerms && <Check size={14} strokeWidth={3} />}
                  </span>
                  <span className="checkbox-text">
                    I agree to the{' '}
                    <button
                      type="button"
                      className="terms-link-btn"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowTermsModal(true);
                      }}
                    >
                      Terms & Conditions
                    </button>
                  </span>
                </label>
              </div>

              {/* Submit CTA Button */}
              <button
                type="submit"
                className="auth-primary-btn"
                disabled={loading || !agreeTerms}
                title={!agreeTerms ? 'You must agree to the Terms & Conditions before creating an account' : ''}
              >
                {loading ? (
                  <span className="btn-spinner-row">
                    <span className="btn-spinner" />
                    <span>Creating account...</span>
                  </span>
                ) : (
                  <span>Create account</span>
                )}
              </button>
            </form>
          )}

          {/* LOGIN FORM */}
          {mode === 'login' && (
            <form onSubmit={handleLoginSubmit} className="auth-modern-form">
              {/* User ID or Email */}
              <div className="modern-input-group has-icon-left">
                <AtSign size={17} className="input-leading-icon" />
                <input
                  type="text"
                  required
                  placeholder="Trader User ID or Email (e.g. @abc123)"
                  value={loginId}
                  onChange={e => setLoginId(e.target.value)}
                  className="modern-input"
                  autoComplete="username"
                />
              </div>

              {/* Password */}
              <div className="modern-input-group has-icon-left has-icon-right">
                <button
                  type="button"
                  className="input-leading-action"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowLoginPassword(prev => !prev);
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                  title={showLoginPassword ? "Lock / Hide password" : "Unlock / Show password"}
                  aria-label={showLoginPassword ? "Lock / Hide password" : "Unlock / Show password"}
                >
                  {showLoginPassword ? (
                    <Unlock size={17} className="input-action-icon active" />
                  ) : (
                    <Lock size={17} className="input-action-icon" />
                  )}
                </button>
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  required
                  placeholder="Password"
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  className="modern-input"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="input-trailing-action"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowLoginPassword(prev => !prev);
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                  title={showLoginPassword ? "Hide password" : "Show password"}
                  aria-label={showLoginPassword ? "Hide password" : "Show password"}
                >
                  {showLoginPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {/* Options Row */}
              <div className="login-options-row">
                <label className="custom-checkbox-label" htmlFor="login-remember-me">
                  <input
                    id="login-remember-me"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={e => setRememberMe(e.target.checked)}
                    className="custom-checkbox-input"
                  />
                  <span className="checkbox-visual" aria-hidden="true">
                    {rememberMe && <Check size={14} strokeWidth={3} />}
                  </span>
                  <span className="checkbox-text">Remember me</span>
                </label>

                <button
                  type="button"
                  className="forgot-link-btn"
                  onClick={openForgotPassword}
                >
                  Forgot password?
                </button>
              </div>

              {/* Submit CTA Button */}
              <button
                type="submit"
                className="auth-primary-btn"
                disabled={loading}
              >
                {loading ? (
                  <span className="btn-spinner-row">
                    <span className="btn-spinner" />
                    <span>Signing in...</span>
                  </span>
                ) : (
                  <span>Sign In</span>
                )}
              </button>
            </form>
          )}

          {/* Quick Demo Access (Preserving current feature) */}
          <div className="auth-demo-action-box">
            <button
              type="button"
              className="demo-terminal-launch-btn"
              onClick={handleQuickDemo}
              disabled={loading}
            >
              <Play size={15} fill="currentColor" />
              <span>Launch Instant Demo Terminal (@protrader)</span>
            </button>
          </div>


        </div>
      </div>

      {/* Comprehensive Terms & Conditions Modal */}
      {showTermsModal && (
        <div className="modal-overlay" onClick={() => setShowTermsModal(false)}>
          <div className="terms-modal-wrapper" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="terms-header-box">
              <div className="terms-header-info">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--profit)', fontSize: '0.74rem', fontWeight: '800', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  <ShieldCheck size={15} />
                  <span>LEGAL & TRADING DISCLOSURES</span>
                </div>
                <h3 className="terms-modal-title">Terms and Conditions</h3>
                <div className="terms-meta-row">
                  <span className="terms-meta-tag">Effective Date: October 18, 2026</span>
                  <span className="terms-meta-tag">Last Updated: October 18, 2026</span>
                  <span className="terms-meta-tag">Platform: TradeJourn</span>
                  <span className="terms-meta-tag">Contact: support@tradejourn.com</span>
                </div>
              </div>
              <button
                type="button"
                className="btn-close"
                onClick={() => setShowTermsModal(false)}
                title="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Body with All 13 Sections */}
            <div className="terms-scroll-body">
              {/* Section 1 */}
              <div className="terms-section-block">
                <div className="terms-section-header">
                  <div className="terms-section-num">1</div>
                  <h4 className="terms-section-heading">Acceptance of Terms</h4>
                </div>
                <ol className="terms-points-list">
                  <li>By accessing, registering for, or using this website, you agree to these Terms and Conditions.</li>
                  <li>If you do not agree with any part of these terms, you must stop using the website.</li>
                  <li>These terms apply to all users, including visitors, registered users, free-plan users, and paid subscribers.</li>
                  <li>You confirm that you have the legal capacity to enter into a binding agreement under the laws applicable to you.</li>
                  <li>If you use the website on behalf of an organization, you confirm that you have the authority to bind that organization to these terms.</li>
                </ol>
              </div>

              {/* Section 2 */}
              <div className="terms-section-block">
                <div className="terms-section-header">
                  <div className="terms-section-num">2</div>
                  <h4 className="terms-section-heading">Purpose of the Platform</h4>
                </div>
                <ol className="terms-points-list">
                  <li>The website provides tools for recording, organizing, reviewing, and analyzing trading activities.</li>
                  <li>Features may include trade journals, trading statistics, performance analytics, risk-reward calculations, chart screenshots, trading notes, trading psychology tracking, and historical trade reviews.</li>
                  <li>Additional features may include AI-assisted analysis, trading reports, chart integrations, replay functionality, or third-party integrations.</li>
                  <li>Features may vary depending on the user's subscription plan, region, or technical availability.</li>
                  <li>The website is intended to support trading discipline, recordkeeping, and self-evaluation.</li>
                </ol>
              </div>

              {/* Section 3 */}
              <div className="terms-section-block">
                <div className="terms-section-header">
                  <div className="terms-section-num">3</div>
                  <h4 className="terms-section-heading">No Financial or Investment Advice</h4>
                </div>
                <ol className="terms-points-list">
                  <li>The website is a trading recordkeeping and analytical tool and is not intended to provide personalized investment advice.</li>
                  <li>Information, statistics, reports, AI-generated insights, and educational materials available on the platform are provided for informational and educational purposes only.</li>
                  <li>Nothing on the website constitutes a recommendation to buy, sell, hold, or trade any financial instrument.</li>
                  <li>The platform does not guarantee that any trading strategy, setup, indicator, analysis, or trading method will be profitable.</li>
                  <li>Users are solely responsible for their trading decisions and should independently evaluate their financial circumstances and risk tolerance.</li>
                  <li>Users should consult an appropriately qualified and authorized financial professional when professional investment advice is required.</li>
                  <li>The platform must not be used as a substitute for professional financial, legal, tax, or investment advice.</li>
                  <li>If any service offered by the platform constitutes regulated financial or investment advice in a relevant jurisdiction, it will be offered only as permitted by applicable law and subject to any required authorization or registration.</li>
                </ol>
              </div>

              {/* Section 4 */}
              <div className="terms-section-block">
                <div className="terms-section-header">
                  <div className="terms-section-num">4</div>
                  <h4 className="terms-section-heading">Trading Risk Disclaimer</h4>
                </div>
                <ol className="terms-points-list">
                  <li>Trading in forex, commodities, stocks, cryptocurrencies, derivatives, futures, and other financial instruments involves risk.</li>
                  <li>Leveraged trading and margin trading can result in substantial losses, including the loss of all or more than the amount initially committed, depending on the instrument and applicable arrangements.</li>
                  <li>Historical trading performance does not guarantee future results.</li>
                  <li>Win rates, profit factors, drawdowns, risk-reward ratios, and other statistics are not guarantees of future profitability.</li>
                  <li>Any backtesting, simulation, paper trading, or replay results may differ significantly from actual live-market results.</li>
                  <li>Users acknowledge that market conditions can change rapidly and that slippage, spreads, liquidity, execution delays, and broker restrictions may affect trading outcomes.</li>
                  <li>The platform is not responsible for losses arising from trading decisions made using information or calculations displayed on the website, to the extent permitted by applicable law.</li>
                </ol>
              </div>

              {/* Section 5 */}
              <div className="terms-section-block">
                <div className="terms-section-header">
                  <div className="terms-section-num">5</div>
                  <h4 className="terms-section-heading">User Accounts and Registration</h4>
                </div>
                <ol className="terms-points-list">
                  <li>Users must provide accurate, current, and complete information when creating an account.</li>
                  <li>Users must keep their account information updated.</li>
                  <li>Users must not impersonate another person or create an account using false information.</li>
                  <li>Users are responsible for maintaining the confidentiality of their passwords and authentication credentials.</li>
                  <li>Users must promptly notify the website operator if they suspect unauthorized access to their account.</li>
                  <li>Users must not share, sell, rent, or transfer their accounts without written permission.</li>
                  <li>The website operator may restrict or suspend accounts where there is reasonable evidence of fraud, unauthorized access, abuse, or violation of these terms.</li>
                  <li>Users must not create multiple accounts to abuse promotions, free trials, referral benefits, or subscription restrictions.</li>
                </ol>
              </div>

              {/* Section 6 */}
              <div className="terms-section-block">
                <div className="terms-section-header">
                  <div className="terms-section-num">6</div>
                  <h4 className="terms-section-heading">Age and Legal Eligibility</h4>
                </div>
                <ol className="terms-points-list">
                  <li>Users must meet the minimum age and legal-capacity requirements applicable in their jurisdiction.</li>
                  <li>Where applicable law requires parental or guardian consent for certain online services, users must satisfy those requirements.</li>
                  <li>The website must not be used by anyone who is legally prohibited from accessing the service.</li>
                  <li>Users are responsible for ensuring that their use of the website complies with the laws applicable to them.</li>
                </ol>
              </div>

              {/* Section 7 */}
              <div className="terms-section-block">
                <div className="terms-section-header">
                  <div className="terms-section-num">7</div>
                  <h4 className="terms-section-heading">User-Submitted Content and Trading Records</h4>
                </div>
                <ol className="terms-points-list">
                  <li>Users may be able to upload or enter trade records, screenshots, charts, notes, strategies, journal entries, and other content.</li>
                  <li>Users retain ownership of their original content, subject to any rights they grant to the platform under these terms.</li>
                  <li>Users confirm that they own or have permission to upload, store, and use the content they submit.</li>
                  <li>Users must not upload content that infringes copyright, trademarks, privacy rights, or other third-party rights.</li>
                  <li>Users must not upload illegal, fraudulent, threatening, abusive, or malicious content.</li>
                  <li>Users are responsible for the accuracy and completeness of their trading records.</li>
                  <li>Users should avoid uploading broker passwords, API secrets, payment credentials, identity documents, or other sensitive information unless the platform expressly supports the relevant data securely.</li>
                  <li>The platform may remove or restrict content where reasonably necessary to comply with law, protect users, or enforce these terms.</li>
                </ol>
              </div>

              {/* Section 8 */}
              <div className="terms-section-block">
                <div className="terms-section-header">
                  <div className="terms-section-num">8</div>
                  <h4 className="terms-section-heading">Ownership and License to User Content</h4>
                </div>
                <ol className="terms-points-list">
                  <li>Users grant the platform a limited, non-exclusive license to host, store, reproduce, process, and display submitted content as reasonably necessary to operate the services requested by the user.</li>
                  <li>This license includes processing content to generate user-requested statistics, reports, analytics, and other platform features.</li>
                  <li>The license continues only for as long as reasonably necessary to provide the service, comply with legal obligations, resolve disputes, or enforce legitimate rights.</li>
                  <li>The platform will handle personal data according to its Privacy Policy and applicable law.</li>
                  <li>User content will not be publicly displayed or used for unrelated promotional purposes without an appropriate legal basis or permission where required.</li>
                  <li>Users must not assume that content entered into a journal is automatically public or automatically private in every circumstance; the platform's actual sharing settings and Privacy Policy govern its handling.</li>
                </ol>
              </div>

              {/* Section 9 */}
              <div className="terms-section-block">
                <div className="terms-section-header">
                  <div className="terms-section-num">9</div>
                  <h4 className="terms-section-heading">AI-Generated Analysis and Automated Calculations</h4>
                </div>
                <ol className="terms-points-list">
                  <li>The platform may use artificial intelligence, algorithms, statistical models, or automated calculations to analyze trading records and generate insights.</li>
                  <li>AI-generated outputs may contain errors, omissions, inaccurate assumptions, or incomplete interpretations.</li>
                  <li>Automated calculations may be affected by incorrect inputs, missing data, rounding, time-zone differences, or technical issues.</li>
                  <li>AI-generated suggestions are informational only and must not be treated as guaranteed trading signals or personalized investment recommendations.</li>
                  <li>Users should independently verify important calculations, trading records, and analytical outputs.</li>
                  <li>The platform does not guarantee the accuracy, completeness, reliability, or suitability of AI-generated content.</li>
                  <li>Users must not rely exclusively on AI-generated analysis when making financial decisions.</li>
                </ol>
              </div>

              {/* Section 10 */}
              <div className="terms-section-block">
                <div className="terms-section-header">
                  <div className="terms-section-num">10</div>
                  <h4 className="terms-section-heading">Third-Party Services and Integrations</h4>
                </div>
                <ol className="terms-points-list">
                  <li>The website may integrate with third-party services such as TradingView, brokers, market-data providers, cloud-storage services, authentication providers, or payment processors.</li>
                  <li>Third-party services may have separate terms, privacy policies, subscription fees, and usage restrictions.</li>
                  <li>The platform does not control the availability, accuracy, security, or operation of independent third-party services.</li>
                  <li>Users are responsible for reviewing the applicable third-party terms before connecting an external account.</li>
                  <li>Users must not share third-party credentials with the platform unless a supported integration explicitly requires and securely handles the relevant authorization.</li>
                  <li>Unless expressly disclosed, the platform does not execute trades, hold customer funds, or act as a broker or custodian.</li>
                  <li>Integration availability may change without notice where permitted by law.</li>
                  <li>Use of third-party names, trademarks, or logos does not necessarily imply sponsorship, endorsement, or affiliation.</li>
                </ol>
              </div>

              {/* Section 11 */}
              <div className="terms-section-block">
                <div className="terms-section-header">
                  <div className="terms-section-num">11</div>
                  <h4 className="terms-section-heading">Market Data and Chart Information</h4>
                </div>
                <ol className="terms-points-list">
                  <li>Any market prices, charts, historical data, indicators, or financial information displayed on the website may be delayed, incomplete, estimated, or supplied by third parties.</li>
                  <li>The website does not guarantee real-time data availability unless expressly stated for a particular feature.</li>
                  <li>Data displayed by the platform may differ from prices or records shown by a broker or exchange.</li>
                  <li>Users must verify prices, contract specifications, trading sessions, and execution details with their relevant broker or data provider.</li>
                  <li>Chart screenshots and historical chart replays may not represent actual executable market prices or live trading conditions.</li>
                  <li>Users must not rely on the website as the sole source for time-sensitive trading decisions.</li>
                </ol>
              </div>

              {/* Section 12 */}
              <div className="terms-section-block">
                <div className="terms-section-header">
                  <div className="terms-section-num">12</div>
                  <h4 className="terms-section-heading">Acceptable Use</h4>
                </div>
                <p style={{ margin: '0 0 10px 0', fontSize: '0.84rem', color: '#94a3b8', fontWeight: '600' }}>
                  Users agree not to:
                </p>
                <ol className="terms-points-list">
                  <li>Use the website for illegal activities, fraud, scams, or unauthorized financial services.</li>
                  <li>Hack, disrupt, overload, or interfere with the website, its servers, or other users.</li>
                  <li>Attempt to bypass authentication, access controls, subscription restrictions, or security measures.</li>
                  <li>Introduce malware, viruses, malicious code, or harmful scripts.</li>
                  <li>Scrape, copy, extract, or harvest platform data through unauthorized automated means.</li>
                  <li>Reverse engineer, decompile, or attempt to obtain source code except where applicable law expressly permits it.</li>
                  <li>Use the platform to infringe another person's intellectual property or privacy rights.</li>
                  <li>Resell, redistribute, or commercially exploit platform services without written permission.</li>
                  <li>Manipulate analytics, fabricate performance data, or misrepresent generated reports as independently verified results.</li>
                  <li>Use the platform to distribute spam, deceptive advertisements, or unauthorized promotional material.</li>
                </ol>
              </div>

              {/* Section 13 */}
              <div className="terms-section-block">
                <div className="terms-section-header">
                  <div className="terms-section-num">13</div>
                  <h4 className="terms-section-heading">Intellectual Property Rights</h4>
                </div>
                <ol className="terms-points-list">
                  <li>The website's software, source code, design, layout, branding, logos, original text, graphics, and proprietary features are owned by or licensed to the website operator.</li>
                  <li>These materials are protected by applicable intellectual property laws.</li>
                  <li>Users receive a limited, revocable, non-exclusive, non-transferable right to use the website for its intended purpose.</li>
                  <li>Users must not copy, reproduce, modify, distribute, publish, or commercially exploit protected platform materials without authorization.</li>
                  <li>Nothing in these terms transfers ownership of the platform's intellectual property to users.</li>
                </ol>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="terms-modal-footer-box">
              <button
                type="button"
                className="btn-secondary"
                style={{ width: 'auto', padding: '10px 20px', borderRadius: '10px' }}
                onClick={() => setShowTermsModal(false)}
              >
                Close
              </button>
              <button
                type="button"
                className="auth-primary-btn"
                style={{ width: 'auto', padding: '10px 24px', margin: 0 }}
                onClick={() => {
                  setAgreeTerms(true);
                  setShowTermsModal(false);
                }}
              >
                I Understand & Agree to Terms
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Forgot Password OTP Modal */}
      {showForgotModal && (
        <div className="modal-overlay" onClick={() => setShowForgotModal(false)}>
          <div
            className="forgot-modal-card"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="terms-header-box" style={{ padding: '18px 22px 14px' }}>
              <div className="terms-header-info">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div className="forgot-header-icon-box">
                    <Key size={17} />
                  </div>
                  <div>
                    <h3 className="terms-modal-title" style={{ fontSize: '1.15rem' }}>
                      Reset Password
                    </h3>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                      2-Factor OTP Security Verification
                    </div>
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="terms-close-btn"
                onClick={() => setShowForgotModal(false)}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="forgot-modal-body" style={{ padding: '20px 22px' }}>
              {/* Invisible Google reCAPTCHA Container for Firebase Phone Auth */}
              <div id="firebase-recaptcha-container"></div>

              {/* Error Banner */}
              {forgotError && (
                <div className="auth-feedback-banner error" style={{ margin: '0 0 16px' }}>
                  <AlertTriangle size={15} />
                  <span>{forgotError}</span>
                </div>
              )}

              {/* Success Banner */}
              {forgotSuccess && forgotStep !== 3 && (
                <div className="auth-feedback-banner success" style={{ margin: '0 0 16px' }}>
                  <CheckCircle2 size={15} />
                  <span>{forgotSuccess}</span>
                </div>
              )}

              {/* STEP 1: Enter User ID, Email or Phone Number */}
              {forgotStep === 1 && (
                <form onSubmit={handleSendOtp}>
                  <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: '0 0 18px', lineHeight: 1.5 }}>
                    Enter your registered User ID, Email address, or Mobile Number
                  </p>

                  <div className="modern-input-group has-icon-left" style={{ marginBottom: '18px' }}>
                    <AtSign size={17} className="input-leading-icon" />
                    <input
                      type="text"
                      required
                      placeholder="User ID (@handle), Email, or Mobile (+91...)"
                      value={forgotIdentifier}
                      onChange={e => setForgotIdentifier(e.target.value)}
                      className="modern-input"
                      autoFocus
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                    <button
                      type="button"
                      className="terms-dismiss-btn"
                      style={{ flex: 1, padding: '11px', fontSize: '0.84rem' }}
                      onClick={() => setShowForgotModal(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="auth-primary-btn"
                      style={{ flex: 1.8, margin: 0, padding: '11px', fontSize: '0.84rem' }}
                      disabled={forgotLoading || !forgotIdentifier.trim()}
                    >
                      {forgotLoading ? (
                        <>
                          <div className="auth-spinner" />
                          <span>Sending OTP...</span>
                        </>
                      ) : (
                        <>
                          <span>Send Verification OTP</span>
                          <ArrowRight size={15} />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}

              {/* STEP 2: Enter OTP & New Password */}
              {forgotStep === 2 && (
                <form onSubmit={handleVerifyAndResetPassword}>
                  <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                    Verification code dispatched to <strong style={{ color: 'var(--text-primary)' }}>{maskedDestination}</strong>.
                  </div>

                  {/* Dev Mode Instant Auto-Fill Helper if devOtp available */}
                  {devOtpHint && (
                    <div className="otp-dev-helper-box">
                      <div className="otp-dev-helper-badge">Dev Mode Preview</div>
                      <div style={{ fontSize: '0.82rem', color: '#c084fc' }}>
                        OTP Code: <strong style={{ fontFamily: 'monospace', fontSize: '1rem', letterSpacing: '2px' }}>{devOtpHint}</strong>
                      </div>
                      <button
                        type="button"
                        className="otp-autofill-btn"
                        onClick={() => setForgotOtp(devOtpHint)}
                      >
                        Auto-fill
                      </button>
                    </div>
                  )}

                  {/* 6-Digit OTP Input */}
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      6-Digit Security OTP
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      pattern="[0-9]{6}"
                      inputMode="numeric"
                      placeholder="• • • • • •"
                      value={forgotOtp}
                      onChange={e => setForgotOtp(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                      className="modern-input otp-digit-input"
                      autoFocus
                    />
                  </div>

                  {/* New Password */}
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      New Password
                    </label>
                    <div className="modern-input-group has-icon-left has-icon-right">
                      <Lock size={17} className="input-leading-icon" />
                      <input
                        type={showForgotNewPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        placeholder="At least 6 characters"
                        value={forgotNewPassword}
                        onChange={e => setForgotNewPassword(e.target.value)}
                        className="modern-input"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        className="input-trailing-action"
                        onClick={() => setShowForgotNewPassword(prev => !prev)}
                        title={showForgotNewPassword ? "Hide password" : "Show password"}
                      >
                        {showForgotNewPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm New Password */}
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Confirm New Password
                    </label>
                    <div className="modern-input-group has-icon-left">
                      <Lock size={17} className="input-leading-icon" />
                      <input
                        type={showForgotNewPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        placeholder="Re-enter new password"
                        value={forgotConfirmPassword}
                        onChange={e => setForgotConfirmPassword(e.target.value)}
                        className="modern-input"
                        autoComplete="new-password"
                      />
                    </div>
                  </div>

                  {/* Resend OTP Row */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', fontSize: '0.8rem' }}>
                    <button
                      type="button"
                      className="terms-link-btn"
                      style={{ fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      onClick={() => setForgotStep(1)}
                    >
                      <ArrowLeft size={13} />
                      <span>Change identifier</span>
                    </button>

                    {resendCooldown > 0 ? (
                      <span style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                        Resend code in {Math.floor(resendCooldown / 60)}:{(resendCooldown % 60).toString().padStart(2, '0')}
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="terms-link-btn"
                        style={{ fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        onClick={handleResendOtp}
                        disabled={forgotLoading}
                      >
                        <RefreshCw size={13} className={forgotLoading ? 'spin-icon' : ''} />
                        <span>Resend OTP</span>
                      </button>
                    )}
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    className="auth-primary-btn"
                    style={{ width: '100%', margin: 0, padding: '13px' }}
                    disabled={forgotLoading || forgotOtp.length !== 6 || forgotNewPassword.length < 6}
                  >
                    {forgotLoading ? (
                      <>
                        <div className="auth-spinner" />
                        <span>Verifying & Resetting...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck size={16} />
                        <span>Reset Password</span>
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* STEP 3: Success Screen */}
              {forgotStep === 3 && (
                <div style={{ textAlign: 'center', padding: '16px 8px 8px' }}>
                  <div className="forgot-success-icon-badge">
                    <CheckCircle2 size={42} strokeWidth={2.5} />
                  </div>
                  <h4 className="forgot-success-heading" style={{ fontSize: '1.25rem', margin: '16px 0 8px', fontWeight: 800 }}>
                    Password Reset Complete
                  </h4>
                  <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 24px' }}>
                    Your password has been successfully updated. You can now log into TradeJourn using your new password.
                  </p>
                  <button
                    type="button"
                    className="auth-primary-btn"
                    style={{ width: '100%', margin: 0, padding: '13px' }}
                    onClick={() => {
                      setShowForgotModal(false);
                      setMode('login');
                      if (forgotIdentifier.startsWith('@')) {
                        setLoginId(forgotIdentifier);
                      }
                      setLoginPassword('');
                    }}
                  >
                    Proceed to Sign In
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
