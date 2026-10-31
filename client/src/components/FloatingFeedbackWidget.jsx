import React, { useState } from 'react';
import {
  MessageSquare,
  MessageSquarePlus,
  Bug,
  Send,
  X,
  Check,
  AlertCircle,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

export const FloatingFeedbackWidget = ({ activeTab, onNavigateTab }) => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState('Feedback'); // 'Feedback' | 'Bug'
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const isAdmin = user?.role === 'admin';

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanMsg = message.trim();
    if (!cleanMsg) {
      setError('Please write a brief feedback or bug description.');
      return;
    }
    if (cleanMsg.length < 3) {
      setError('Please provide at least 3 characters.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await api.sendFeedback({
        type,
        message: cleanMsg,
        page: activeTab ? `${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Tab` : 'Dashboard'
      });

      setSuccess(true);
      setMessage('');
      setTimeout(() => {
        setSuccess(false);
        setIsOpen(false);
      }, 2000);
    } catch (err) {
      setError(err.message || 'Failed to submit. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminViewClick = () => {
    setIsOpen(false);
    if (onNavigateTab) {
      onNavigateTab('feedback-responses');
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '22px',
        right: '22px',
        zIndex: 9990,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end'
      }}
    >
      {/* Expanded Floating Popup Window */}
      {isOpen && (
        <div
          style={{
            width: '350px',
            maxWidth: 'calc(100vw - 36px)',
            background: '#09131f',
            border: '1px solid rgba(0, 245, 155, 0.3)',
            borderRadius: '14px',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.65), 0 0 25px rgba(0, 245, 155, 0.12)',
            padding: '18px',
            marginBottom: '12px',
            color: '#f8fafc',
            animation: 'modalScaleUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)'
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '8px',
                  background: type === 'Bug' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(0, 245, 155, 0.15)',
                  border: `1px solid ${type === 'Bug' ? 'rgba(239, 68, 68, 0.35)' : 'rgba(0, 245, 155, 0.35)'}`,
                  display: 'grid',
                  placeItems: 'center',
                  color: type === 'Bug' ? '#ff6685' : 'var(--profit, #00f59b)'
                }}
              >
                {type === 'Bug' ? <Bug size={16} /> : <MessageSquare size={16} />}
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.94rem', fontWeight: 800 }}>
                  {type === 'Bug' ? 'Report a Bug' : 'Share Feedback'}
                </h4>
                <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-secondary, #94a3b8)' }}>
                  Help us refine TradeJourn
                </p>
              </div>
            </div>

            {/* Cross (X) Button */}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: 'var(--text-muted, #94a3b8)',
                cursor: 'pointer',
                padding: '5px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease'
              }}
              title="Close window"
              aria-label="Close feedback window"
            >
              <X size={15} />
            </button>
          </div>

          {success ? (
            <div
              style={{
                background: 'rgba(0, 245, 155, 0.12)',
                border: '1px solid rgba(0, 245, 155, 0.3)',
                borderRadius: '10px',
                padding: '22px 14px',
                textAlign: 'center',
                color: 'var(--profit, #00f59b)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Check size={28} />
              <span style={{ fontSize: '0.88rem', fontWeight: 700 }}>
                {type === 'Bug' ? 'Bug Report Submitted!' : 'Feedback Received!'}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)' }}>
                Thank you for helping us improve TradeJourn.
              </span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '12px' }}>
              {/* Type Switcher Pills */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '6px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  padding: '3px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.08)'
                }}
              >
                <button
                  type="button"
                  onClick={() => setType('Feedback')}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: 'none',
                    background: type === 'Feedback' ? 'var(--accent-cyan, #00d2ff)' : 'transparent',
                    color: type === 'Feedback' ? '#060c14' : 'var(--text-secondary, #94a3b8)',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '5px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Sparkles size={13} />
                  <span>Feedback</span>
                </button>

                <button
                  type="button"
                  onClick={() => setType('Bug')}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: 'none',
                    background: type === 'Bug' ? '#ef4444' : 'transparent',
                    color: type === 'Bug' ? '#ffffff' : 'var(--text-secondary, #94a3b8)',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '5px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Bug size={13} />
                  <span>Bug Report</span>
                </button>
              </div>

              {/* Message Textarea */}
              <div>
                <textarea
                  rows={4}
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={
                    type === 'Bug'
                      ? 'Describe what went wrong and what you were doing when it happened...'
                      : 'Share your thoughts, feature requests, or suggestions to make TradeJourn better...'
                  }
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: '#060c14',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '8px',
                    color: '#f8fafc',
                    fontSize: '0.82rem',
                    lineHeight: 1.45,
                    resize: 'none',
                    outline: 'none',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box'
                  }}
                  autoFocus
                />
              </div>

              {/* Error Banner */}
              {error && (
                <div
                  style={{
                    background: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '6px',
                    padding: '8px 10px',
                    fontSize: '0.75rem',
                    color: '#ff6685',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <AlertCircle size={14} style={{ flexShrink: 0 }} />
                  <span>{error}</span>
                </div>
              )}

              {/* User Identity Note */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted, #94a3b8)' }}>
                <span>
                  Sending as: <strong style={{ color: 'var(--text-white, #fff)' }}>{user?.userId || user?.name || 'Trader'}</strong>
                </span>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={handleAdminViewClick}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#f59e0b',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '3px',
                      padding: 0
                    }}
                  >
                    <span>View Responses</span>
                    <ExternalLink size={11} />
                  </button>
                )}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    color: 'var(--text-secondary, #94a3b8)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !message.trim()}
                  style={{
                    flex: 2,
                    padding: '8px 14px',
                    background: type === 'Bug' ? '#ef4444' : 'var(--profit, #00f59b)',
                    border: 'none',
                    borderRadius: '8px',
                    color: type === 'Bug' ? '#ffffff' : '#060c14',
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    cursor: (loading || !message.trim()) ? 'not-allowed' : 'pointer',
                    opacity: (loading || !message.trim()) ? 0.6 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {loading ? (
                    <span>Sending...</span>
                  ) : (
                    <>
                      <Send size={14} />
                      <span>{type === 'Bug' ? 'Send Bug Report' : 'Send Feedback'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Floating Button Icon (Lower Right Side) */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        style={{
          width: '50px',
          height: '50px',
          borderRadius: '50%',
          background: isOpen ? '#0b1626' : 'linear-gradient(135deg, #09131f 0%, #0d2035 100%)',
          border: `2px solid ${isOpen ? 'var(--accent-cyan, #00d2ff)' : 'rgba(0, 245, 155, 0.45)'}`,
          boxShadow: isOpen
            ? '0 0 25px rgba(0, 210, 255, 0.4), 0 8px 20px rgba(0, 0, 0, 0.6)'
            : '0 0 20px rgba(0, 245, 155, 0.3), 0 8px 20px rgba(0, 0, 0, 0.6)',
          display: 'grid',
          placeItems: 'center',
          cursor: 'pointer',
          color: isOpen ? 'var(--accent-cyan, #00d2ff)' : 'var(--profit, #00f59b)',
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          outline: 'none',
          position: 'relative'
        }}
        title="Give Feedback or Report a Bug"
        aria-label="Feedback and Bug Report"
      >
        {isOpen ? (
          <X size={22} strokeWidth={2.5} />
        ) : (
          <MessageSquarePlus size={22} strokeWidth={2.2} />
        )}
      </button>
    </div>
  );
};

