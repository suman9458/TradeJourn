import React, { useState } from 'react';
import { X, KeyRound, ShieldCheck, Check, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const SetupPinModal = ({ isOpen, onClose }) => {
  const { user, updateUserSettings } = useAuth();
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const cleanPin = pin.trim();
    const cleanConfirm = confirmPin.trim();

    if (!cleanPin || cleanPin.length !== 4 || !/^\d{4}$/.test(cleanPin)) {
      setError('Please enter a valid 4-digit numeric PIN (e.g. 1234)');
      return;
    }

    if (cleanPin !== cleanConfirm) {
      setError('PINs do not match. Please re-enter.');
      return;
    }

    setSaving(true);
    try {
      await updateUserSettings({ securityPin: cleanPin });
      if (user) {
        const userKey = user._id || user.id || user.userId || 'current_user';
        localStorage.setItem(`tradejourn_pin_set_${userKey}`, 'true');
        sessionStorage.setItem('tradejourn_dismissed_pin_prompt', 'true');
      }
      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
        onClose();
      }, 1200);
    } catch (err) {
      setError(err.message || 'Failed to save security PIN');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 105000,
        background: 'rgba(3, 6, 11, 0.85)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        animation: 'modalFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#09131f',
          border: '1px solid rgba(0, 245, 155, 0.3)',
          borderRadius: '16px',
          maxWidth: '420px',
          width: '100%',
          padding: '24px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.7), 0 0 30px rgba(0, 245, 155, 0.1)',
          position: 'relative'
        }}
      >
        {/* Cross (X) Close Button */}
        <button
          type="button"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: 'var(--text-muted, #94a3b8)',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease'
          }}
          aria-label="Close"
          title="Close (remind me later)"
        >
          <X size={18} />
        </button>

        {/* Modal Header Icon + Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'rgba(0, 245, 155, 0.12)',
              border: '1px solid rgba(0, 245, 155, 0.3)',
              display: 'grid',
              placeItems: 'center',
              color: 'var(--profit, #00f59b)'
            }}
          >
            <KeyRound size={22} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#f8fafc' }}>
              Set 4-Digit Security PIN
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--profit, #00f59b)', fontWeight: 600 }}>
              Password Reset Protection
            </span>
          </div>
        </div>

        <p style={{ margin: '0 0 18px 0', fontSize: '0.84rem', color: 'var(--text-secondary, #94a3b8)', lineHeight: 1.5 }}>
          Set a 4-digit PIN for your account so you can easily reset your password if you ever forget it.
        </p>

        {error && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '8px',
              padding: '10px 12px',
              fontSize: '0.8rem',
              color: '#ff6685',
              marginBottom: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <AlertCircle size={15} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {savedSuccess ? (
          <div
            style={{
              background: 'rgba(0, 245, 155, 0.12)',
              border: '1px solid rgba(0, 245, 155, 0.35)',
              borderRadius: '10px',
              padding: '16px',
              textAlign: 'center',
              color: 'var(--profit, #00f59b)',
              fontWeight: 700,
              fontSize: '0.9rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Check size={28} />
            <span>4-Digit PIN Saved Successfully!</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)', marginBottom: '6px' }}>
                Create 4-Digit PIN
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPin ? 'text' : 'password'}
                  required
                  maxLength={4}
                  inputMode="numeric"
                  pattern="[0-9]{4}"
                  placeholder="• • • •"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  style={{
                    width: '100%',
                    padding: '12px 42px 12px 14px',
                    background: '#060c14',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '1.1rem',
                    letterSpacing: '8px',
                    textAlign: 'center',
                    fontFamily: 'monospace',
                    outline: 'none'
                  }}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted, #94a3b8)',
                    cursor: 'pointer',
                    padding: '4px'
                  }}
                  title={showPin ? 'Hide PIN' : 'Show PIN'}
                >
                  {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)', marginBottom: '6px' }}>
                Confirm 4-Digit PIN
              </label>
              <input
                type={showPin ? 'text' : 'password'}
                required
                maxLength={4}
                inputMode="numeric"
                pattern="[0-9]{4}"
                placeholder="• • • •"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  background: '#060c14',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '1.1rem',
                  letterSpacing: '8px',
                  textAlign: 'center',
                  fontFamily: 'monospace',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  flex: 1,
                  padding: '11px',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  color: 'var(--text-secondary, #94a3b8)',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Later
              </button>
              <button
                type="submit"
                disabled={saving || pin.length !== 4 || confirmPin.length !== 4}
                style={{
                  flex: 2,
                  padding: '11px',
                  background: 'var(--profit, #00f59b)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#060c14',
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  cursor: (saving || pin.length !== 4 || confirmPin.length !== 4) ? 'not-allowed' : 'pointer',
                  opacity: (saving || pin.length !== 4 || confirmPin.length !== 4) ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <ShieldCheck size={16} />
                <span>{saving ? 'Saving...' : 'Save 4-Digit PIN'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

