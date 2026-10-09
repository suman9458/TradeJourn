import React, { useState, useEffect } from 'react';
import { Plus, FileText, RefreshCw, Menu, Clock } from 'lucide-react';

const LiveClock = () => {
  const [timeStr, setTimeStr] = useState(() => {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="live-clock-badge">
      <Clock size={14} className="clock-icon" />
      <span>{timeStr}</span>
    </div>
  );
};

export const Navbar = ({ onOpenAddTrade, onExportPDF, onRefresh, onResetDataset, onToggleSidebar }) => {
  return (
    <header className="topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        {onToggleSidebar && (
          <button
            type="button"
            className="mobile-menu-trigger"
            onClick={onToggleSidebar}
            aria-label="Open Navigation Menu"
          >
            <Menu size={20} />
          </button>
        )}
        <div className="topbar-title">
          <h2>TradeJourn</h2>
        </div>
      </div>

      <div className="topbar-actions">
        <LiveClock />
        {(onResetDataset || onRefresh) && (
          <button
            type="button"
            className="btn-secondary"
            onClick={onResetDataset || onRefresh}
            title="Reset All Dataset Entries"
            aria-label="Reset All Dataset Entries"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '8px 12px',
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={15} />
          </button>
        )}
        <button className="btn-secondary" onClick={onExportPDF} title="Download Trade History PDF with proper columns & rows">
          <FileText size={15} />
          <span>Export PDF</span>
        </button>
        <button className="btn-primary" onClick={onOpenAddTrade}>
          <Plus size={18} />
          <span>Quick Add Trade</span>
        </button>
      </div>
    </header>
  );
};
