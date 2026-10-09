import React from 'react';
import { AlertTriangle, RotateCcw, X, Trash2 } from 'lucide-react';

export const ResetDatasetModal = ({ isOpen, onClose, onConfirm, loading = false }) => {
  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(5, 10, 20, 0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        animation: 'fadeIn 0.2s ease-out'
      }}
    >
      <div
        className="modal-card"
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '460px',
          background: '#0d1726',
          border: '1px solid rgba(239, 68, 68, 0.35)',
          borderRadius: '16px',
          padding: '28px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6), 0 0 30px rgba(239, 68, 68, 0.15)',
          position: 'relative',
          color: '#f8fafc',
          animation: 'scaleIn 0.2s ease-out'
        }}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          aria-label="Close modal"
        >
          <X size={18} />
        </button>

        {/* Warning Icon Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '18px' }}>
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '14px',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ef4444',
              flexShrink: 0
            }}
          >
            <AlertTriangle size={26} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800', color: '#fff', letterSpacing: '-0.01em' }}>
              Reset Dataset Entries
            </h3>
            <span style={{ fontSize: '0.78rem', color: '#ef4444', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Irreversible Action
            </span>
          </div>
        </div>

        {/* Question and Prompt Text */}
        <div style={{ marginBottom: '24px', lineHeight: '1.55' }}>
          <p style={{ margin: '0 0 10px 0', fontSize: '0.98rem', fontWeight: '700', color: '#f1f5f9' }}>
            Are you sure you want to reset all entries in your dataset?
          </p>
          <p style={{ margin: 0, fontSize: '0.84rem', color: '#94a3b8' }}>
            This execution will delete all recorded trades you entered in the ledger. All journal KPIs, analytics, win rate charts, and breakdown statistics will be reset to 0.
          </p>
        </div>

        {/* Confirmation Buttons: Yes / No */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', alignItems: 'center' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            disabled={loading}
            style={{
              padding: '10px 20px',
              fontSize: '0.88rem',
              borderRadius: '10px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            No, Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            style={{
              padding: '10px 22px',
              fontSize: '0.88rem',
              borderRadius: '10px',
              fontWeight: '800',
              background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
              color: '#ffffff',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 18px rgba(239, 68, 68, 0.4)',
              transition: 'all 0.15s ease'
            }}
          >
            {loading ? (
              <>
                <RotateCcw size={16} className="spin" />
                <span>Resetting Dataset...</span>
              </>
            ) : (
              <>
                <Trash2 size={16} />
                <span>Yes, Reset All Entries</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
