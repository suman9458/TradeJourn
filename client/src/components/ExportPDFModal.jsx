import React, { useState } from 'react';
import { FileText, X, CheckSquare, Square, Download, Sparkles } from 'lucide-react';

const AVAILABLE_COLUMNS = [
  { id: 'dateTime', label: 'Date & Time', category: 'General' },
  { id: 'instrument', label: 'Ticker / Instrument', category: 'General' },
  { id: 'tradeName', label: 'Trade Name / Setup', category: 'General' },
  { id: 'session', label: 'Session', category: 'Market' },
  { id: 'bias', label: 'Market Bias', category: 'Market' },
  { id: 'result', label: 'Outcome (WIN/LOSS/BE)', category: 'Performance' },
  { id: 'rr', label: 'Net R-Multiple', category: 'Performance' },
  { id: 'pips', label: 'Pips Gained / Lost', category: 'Performance' },
  { id: 'pnl', label: 'P&L ($ USD Profit)', category: 'Performance' },
  { id: 'grade', label: 'Setup Grade', category: 'Review' },
  { id: 'emotion', label: 'Emotional State', category: 'Review' },
  { id: 'notes', label: 'Mistakes & Review Notes', category: 'Review' }
];

const DEFAULT_SELECTED = AVAILABLE_COLUMNS.map(c => c.id);

export const ExportPDFModal = ({ isOpen, onClose, onExport, loading = false, totalTradesCount = 0 }) => {
  const [selectedColumns, setSelectedColumns] = useState(DEFAULT_SELECTED);
  const [includeSummary, setIncludeSummary] = useState(true);
  const [timeframe, setTimeframe] = useState('ALL');

  if (!isOpen) return null;

  const toggleColumn = (id) => {
    setSelectedColumns(prev =>
      prev.includes(id)
        ? prev.filter(c => c !== id)
        : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    setSelectedColumns(AVAILABLE_COLUMNS.map(c => c.id));
  };

  const handleDeselectAll = () => {
    setSelectedColumns(['dateTime', 'instrument', 'result', 'pnl']);
  };

  const handleExportSubmit = () => {
    if (selectedColumns.length === 0) {
      alert('Please select at least one data column to include in the PDF export.');
      return;
    }
    onExport({
      selectedColumns,
      includeSummary,
      timeframe
    });
  };

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
          maxWidth: '620px',
          maxHeight: '90vh',
          background: '#0d1726',
          border: '1px solid rgba(0, 245, 155, 0.3)',
          borderRadius: '16px',
          padding: '28px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7), 0 0 30px rgba(0, 245, 155, 0.12)',
          position: 'relative',
          color: '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
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
            top: '18px',
            right: '18px',
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

        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '14px',
              background: 'rgba(0, 245, 155, 0.12)',
              border: '1px solid rgba(0, 245, 155, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--profit)',
              flexShrink: 0
            }}
          >
            <FileText size={24} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', color: '#fff', letterSpacing: '-0.01em' }}>
              Export PDF Configuration
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Select the exact data columns and metrics you want to download in your PDF report.
            </p>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div style={{ overflowY: 'auto', paddingRight: '4px', flex: 1, margin: '8px 0 20px' }}>
          {/* Timeframe Filter Section */}
          <div style={{ marginBottom: '20px', background: 'rgba(255, 255, 255, 0.03)', padding: '14px 16px', borderRadius: '12px', border: '1px solid var(--border-medium)' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {[
                { id: 'ALL', label: 'All Trades' },
                { id: '7D', label: 'Last 7 Days' },
                { id: '30D', label: 'Last 30 Days' },
                { id: '90D', label: 'Last 90 Days' }
              ].map(tf => (
                <button
                  key={tf.id}
                  type="button"
                  onClick={() => setTimeframe(tf.id)}
                  style={{
                    padding: '6px 14px',
                    fontSize: '0.78rem',
                    borderRadius: '8px',
                    fontWeight: '700',
                    border: timeframe === tf.id ? '1px solid var(--profit)' : '1px solid var(--border-medium)',
                    background: timeframe === tf.id ? 'rgba(0, 245, 155, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                    color: timeframe === tf.id ? 'var(--profit)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {tf.label}
                </button>
              ))}
            </div>
          </div>

          {/* Data Columns Selection Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={15} color="var(--profit)" />
              <span style={{ fontSize: '0.88rem', fontWeight: '700', color: '#fff' }}>
                Select Table Columns to Include ({selectedColumns.length} of {AVAILABLE_COLUMNS.length})
              </span>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={handleSelectAll}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-cyan)',
                  fontSize: '0.78rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                Select All
              </button>
              <span style={{ color: 'var(--border-medium)' }}>•</span>
              <button
                type="button"
                onClick={handleDeselectAll}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '0.78rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                Essential Only
              </button>
            </div>
          </div>

          {/* Checkboxes Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '10px', marginBottom: '20px' }}>
            {AVAILABLE_COLUMNS.map(col => {
              const isChecked = selectedColumns.includes(col.id);
              return (
                <div
                  key={col.id}
                  onClick={() => toggleColumn(col.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    background: isChecked ? 'rgba(0, 245, 155, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                    border: isChecked ? '1px solid rgba(0, 245, 155, 0.35)' : '1px solid rgba(255, 255, 255, 0.07)',
                    cursor: 'pointer',
                    userSelect: 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ color: isChecked ? 'var(--profit)' : 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                    {isChecked ? <CheckSquare size={18} /> : <Square size={18} />}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.84rem', fontWeight: '700', color: isChecked ? '#fff' : 'var(--text-secondary)' }}>
                      {col.label}
                    </div>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{col.category}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Executive Summary Checkbox Option */}
          <div
            onClick={() => setIncludeSummary(!includeSummary)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 16px',
              borderRadius: '12px',
              background: includeSummary ? 'rgba(0, 210, 255, 0.08)' : 'rgba(255, 255, 255, 0.02)',
              border: includeSummary ? '1px solid rgba(0, 210, 255, 0.35)' : '1px solid rgba(255, 255, 255, 0.07)',
              cursor: 'pointer',
              userSelect: 'none'
            }}
          >
            <div style={{ color: includeSummary ? 'var(--accent-cyan)' : 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
              {includeSummary ? <CheckSquare size={20} /> : <Square size={20} />}
            </div>
            <div>
              <div style={{ fontSize: '0.88rem', fontWeight: '700', color: '#fff' }}>
                Include Executive Performance Summary HUD
              </div>
              <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                Adds top metrics summary cards (Total Trades, Win Rate, Net Profit $, Net Pips, Net R) at the top of the PDF.
              </p>
            </div>
          </div>
        </div>

        {/* Modal Action Buttons */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', alignItems: 'center', paddingTop: '14px', borderTop: '1px solid var(--border-medium)' }}>
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
            Cancel
          </button>

          <button
            type="button"
            onClick={handleExportSubmit}
            disabled={loading}
            style={{
              padding: '10px 24px',
              fontSize: '0.88rem',
              borderRadius: '10px',
              fontWeight: '800',
              background: 'linear-gradient(135deg, #00f59b 0%, #00d2ff 100%)',
              color: '#060c14',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 18px rgba(0, 245, 155, 0.4)',
              transition: 'all 0.15s ease'
            }}
          >
            <Download size={16} />
            <span>Generate & Download PDF</span>
          </button>
        </div>
      </div>
    </div>
  );
};
