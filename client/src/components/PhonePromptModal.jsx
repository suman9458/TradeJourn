import React, { useState, useEffect } from 'react';
import { Phone, CheckCircle2, AlertTriangle, ArrowRight, ArrowLeft, RefreshCw, Key, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { isFirebaseConfigured, sendFirebasePhoneOtp, confirmFirebaseOtp, formatPhoneNumberE164 } from '../services/firebase';

export const PhonePromptModal = () => {
  const { user, updateUserSettings } = useAuth();
  const [step, setStep] = useState(1); // 1 = Enter Phone, 2 = Enter OTP
  const [phoneNumber, setPhoneNumber] = useState('');
  const [formattedPhone, setFormattedPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  // Reset dismissed state whenever user changes or re-logs in
  useEffect(() => {
    setDismissed(false);
  }, [user?.id]);

  // Resend OTP countdown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Show only if logged in, NOT a demo account, and phone number is missing
  const isDemo = Boolean(
    user?.isDemo ||
    user?.role === 'demo' ||
    user?.email?.toLowerCase().includes('demo') ||
    user?.email?.toLowerCase() === 'protrader@tradejourn.com' ||
    user?.userId?.toLowerCase().includes('protrader') ||
    user?.userId?.toLowerCase().includes('demo') ||
    user?.name?.toLowerCase().includes('demo') ||
    user?.name?.toLowerCase().includes('pro trader')
  );
  const hasPhone = Boolean(user?.phoneNumber && user.phoneNumber.trim().length >= 7);

  if (!user || isDemo || (hasPhone && !success) || dismissed) {
    return null;
  }

  // STEP 1: Send OTP to Phone
  const handleSendOtp = async (e) => {
    if (e) e.preventDefault();
    setError('');

    const clean = phoneNumber.trim();
    const digitsOnly = clean.replace(/[^0-9]/g, '');

    if (digitsOnly.length < 10) {
      setError('Please enter a valid 10-digit mobile number with country code (e.g. +911234******).');
      return;
    }

    setLoading(true);
    try {
      const e164 = formatPhoneNumberE164(clean);
      setFormattedPhone(e164);

      if (!isFirebaseConfigured()) {
        throw new Error('Google Firebase is not configured on client. Unable to dispatch SMS.');
      }

      const { confirmationResult: confRes } = await sendFirebasePhoneOtp(e164, 'phone-prompt-recaptcha');
      if (!confRes) {
        throw new Error('Failed to initiate verification session with Firebase.');
      }

      setConfirmationResult(confRes);
      setStep(2);
      setResendCooldown(600); // 10-minute cooldown
    } catch (err) {
      console.error('Send OTP error:', err);
      let msg = err.message || 'Failed to send OTP code. Please check your number.';
      if (err.code === 'auth/invalid-phone-number') {
        msg = 'Invalid phone number format. Please include your country code (e.g. +911234******).';
      } else if (
        err.code === 'auth/operation-not-allowed' ||
        err.message?.includes('region enabled') ||
        err.message?.includes('OPERATION_NOT_ALLOWED')
      ) {
        msg = 'Firebase SMS Region Policy: Please allow India (+91) in Firebase Console > Authentication > Settings > SMS region policy.';
      } else if (err.code === 'auth/quota-exceeded') {
        msg = 'Daily SMS quota exceeded. Please try again tomorrow or contact support.';
      } else if (err.code === 'auth/too-many-requests') {
        msg = 'Too many requests sent. Please wait a few minutes before trying again.';
      } else if (err.code === 'auth/captcha-check-failed') {
        msg = 'reCAPTCHA verification failed. Please try again.';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || loading) return;
    setError('');
    setLoading(true);
    try {
      const { confirmationResult: confRes } = await sendFirebasePhoneOtp(formattedPhone, 'phone-prompt-recaptcha');
      if (!confRes) {
        throw new Error('Failed to resend verification session.');
      }
      setConfirmationResult(confRes);
      setResendCooldown(600); // 10-minute cooldown
    } catch (err) {
      console.error('Resend OTP error:', err);
      let msg = err.message || 'Failed to resend OTP.';
      if (err.code === 'auth/too-many-requests') {
        msg = 'Too many requests. Please wait a few minutes before requesting another OTP.';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // STEP 2: Verify OTP & Save Phone Number
  const handleVerifyOtp = async (e) => {
    if (e) e.preventDefault();
    setError('');

    const cleanOtp = otp.trim();
    if (cleanOtp.length !== 6) {
      setError('Please enter the full 6-digit OTP code.');
      return;
    }

    if (!confirmationResult) {
      setError('No active verification session found. Please click "Change Number" and request an OTP first.');
      return;
    }

    setLoading(true);
    try {
      // STRICT: Must cryptographically verify with Google Firebase!
      await confirmFirebaseOtp(confirmationResult, cleanOtp);

      // Successfully verified with Google Firebase!
      setSuccess(true);
      await updateUserSettings({ phoneNumber: formattedPhone });
      setTimeout(() => {
        setDismissed(true);
      }, 1400);
    } catch (err) {
      console.error('Firebase OTP verification failed:', err);
      let msg = err.message || 'Invalid verification code. Please try again.';
      if (err.code === 'auth/invalid-verification-code') {
        msg = 'Incorrect OTP code! Please enter the 6-digit code received on your phone.';
      } else if (err.code === 'auth/code-expired') {
        msg = 'This verification code has expired. Please click "Resend OTP".';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        backgroundColor: 'rgba(3, 7, 18, 0.85)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '380px',
          background: 'var(--bg-card, #111827)',
          border: '1px solid var(--border-medium, rgba(255, 255, 255, 0.1))',
          borderRadius: '16px',
          padding: '22px 24px',
          color: 'var(--text-primary, #ffffff)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
          position: 'relative'
        }}
      >
        {/* Invisible Google reCAPTCHA container for Phone Auth */}
        <div id="phone-prompt-recaptcha"></div>

        {/* Title, Subtitle & Cut Button */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(0, 245, 155, 0.12)',
                border: '1px solid rgba(0, 245, 155, 0.25)',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0
              }}
            >
              {step === 1 ? (
                <Phone size={17} color="var(--accent-cyan, #00f59b)" />
              ) : (
                <Key size={17} color="var(--accent-cyan, #00f59b)" />
              )}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary, #ffffff)' }}>
                {step === 1 ? 'Verify Mobile Number' : 'Enter 6-Digit OTP'}
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary, #94a3b8)', lineHeight: 1.35 }}>
                {step === 1
                  ? 'Enter your mobile number to receive a verification OTP.'
                  : `Enter the code sent to ${formattedPhone}`}
              </p>
            </div>
          </div>

          {/* Cut / Close Button */}
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Close"
            title="Close"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted, #94a3b8)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = 'var(--text-primary, #ffffff)';
              e.currentTarget.style.backgroundColor = 'rgba(148, 163, 184, 0.15)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = 'var(--text-muted, #94a3b8)';
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Error Banner */}
        {error && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 10px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '8px',
              color: '#f87171',
              fontSize: '0.8rem',
              marginBottom: '14px'
            }}
          >
            <AlertTriangle size={14} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Success Banner */}
        {success && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 10px',
              backgroundColor: 'rgba(0, 245, 155, 0.15)',
              border: '1px solid rgba(0, 245, 155, 0.3)',
              borderRadius: '8px',
              color: '#00f59b',
              fontSize: '0.8rem',
              marginBottom: '14px'
            }}
          >
            <CheckCircle2 size={14} style={{ flexShrink: 0 }} />
            <span>Number verified & saved successfully!</span>
          </div>
        )}

        {/* STEP 1: Enter Phone Number */}
        {step === 1 && (
          <form onSubmit={handleSendOtp}>
            <div style={{ marginBottom: '16px' }}>
              <input
                type="tel"
                required
                autoFocus
                disabled={loading || success}
                placeholder="+911234******"
                value={phoneNumber}
                onChange={e => setPhoneNumber(e.target.value)}
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  backgroundColor: 'var(--bg-surface, rgba(15, 23, 42, 0.9))',
                  border: '1px solid var(--border-medium, rgba(148, 163, 184, 0.25))',
                  borderRadius: '10px',
                  color: 'var(--text-primary, #ffffff)',
                  fontSize: '0.95rem',
                  fontFamily: 'monospace',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading || !phoneNumber.trim()}
              style={{
                width: '100%',
                padding: '11px',
                background: 'var(--profit, #00f59b)',
                border: 'none',
                borderRadius: '10px',
                color: '#04080e',
                fontSize: '0.88rem',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'opacity 0.15s ease'
              }}
            >
              {loading ? (
                <span>Sending OTP...</span>
              ) : (
                <>
                  <span>Send OTP</span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </form>
        )}

        {/* STEP 2: Enter OTP & Verify */}
        {step === 2 && (
          <form onSubmit={handleVerifyOtp}>
            <div style={{ marginBottom: '14px' }}>
              <input
                type="text"
                required
                autoFocus
                maxLength={6}
                inputMode="numeric"
                disabled={loading || success}
                placeholder="• • • • • •"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  backgroundColor: 'var(--bg-surface, rgba(15, 23, 42, 0.9))',
                  border: '1px solid var(--border-medium, rgba(148, 163, 184, 0.25))',
                  borderRadius: '10px',
                  color: 'var(--text-primary, #ffffff)',
                  fontSize: '1.1rem',
                  fontFamily: 'monospace',
                  textAlign: 'center',
                  letterSpacing: '6px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', fontSize: '0.78rem' }}>
              <button
                type="button"
                onClick={() => { setStep(1); setError(''); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted, #94a3b8)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: 0
                }}
              >
                <ArrowLeft size={12} />
                <span>Change Number</span>
              </button>

              {resendCooldown > 0 ? (
                <span style={{ color: 'var(--text-muted, #94a3b8)', fontFamily: 'monospace' }}>
                  Resend in {Math.floor(resendCooldown / 60)}:{(resendCooldown % 60).toString().padStart(2, '0')}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={loading}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent-cyan, #00f59b)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: 0
                  }}
                >
                  <RefreshCw size={12} />
                  <span>Resend OTP</span>
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || otp.trim().length !== 6 || success}
              style={{
                width: '100%',
                padding: '11px',
                background: success ? '#00f59b' : 'var(--profit, #00f59b)',
                border: 'none',
                borderRadius: '10px',
                color: '#04080e',
                fontSize: '0.88rem',
                fontWeight: 700,
                cursor: loading || success ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'opacity 0.15s ease'
              }}
            >
              {loading ? (
                <span>Verifying...</span>
              ) : success ? (
                <>
                  <CheckCircle2 size={16} />
                  <span>Verified & Saved!</span>
                </>
              ) : (
                <>
                  <span>Verify & Save</span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
