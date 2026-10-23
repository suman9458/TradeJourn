import React, { useState, useEffect } from 'react';
import { Plus, FileText, RefreshCw, Menu, Clock, Sun, Moon, Settings, User } from 'lucide-react';

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

export const Navbar = ({ onOpenAddTrade, onExportPDF, onRefresh, onResetDataset, onToggleSidebar, onOpenSettings, onOpenAuth, theme = 'dark', onToggleTheme }) => {
  return (
    <header className="topbar">
      <div className="topbar-main-row">
        <div className="topbar-left">
          {onToggleSidebar && (
            <button
              type="button"
              className="mobile-menu-trigger"
              onClick={onToggleSidebar}
              aria-label="Open Navigation Menu"
              title="Open Navigation Menu"
            >
              <Menu size={22} strokeWidth={2.5} />
            </button>
          )}
          <div className="topbar-title">
            <h2>TradeJourn</h2>
          </div>
        </div>

        <div className="topbar-utility-actions">
          {onToggleTheme && (
            <button
              type="button"
              className="theme-toggle-btn navbar-theme-btn"
              onClick={onToggleTheme}
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label="Toggle Dark and Light Mode"
            >
              {theme === 'dark' ? (
                <>
                  <Sun size={15} className="theme-icon sun" />
                  <span className="theme-text">Light</span>
                </>
              ) : (
                <>
                  <Moon size={15} className="theme-icon moon" />
                  <span className="theme-text">Dark</span>
                </>
              )}
            </button>
          )}

          {/* Desktop-only Live Clock - completely hidden on phone view */}
          <div className="clock-wrapper-desktop">
            <LiveClock />
          </div>

          {(onResetDataset || onRefresh) && (
            <button
              type="button"
              className="btn-secondary topbar-icon-btn"
              onClick={onResetDataset || onRefresh}
              title="Reset All Dataset Entries"
              aria-label="Reset All Dataset Entries"
            >
              <RefreshCw size={15} />
            </button>
          )}

          <button
            type="button"
            className="btn-secondary topbar-pdf-btn"
            onClick={onExportPDF}
            title="Download Trade History PDF with proper columns & rows"
          >
            <FileText size={15} />
            <span className="pdf-btn-label">Export PDF</span>
          </button>

          {(onOpenSettings || onOpenAuth) && (
            <button
              type="button"
              className="btn-secondary topbar-icon-btn topbar-user-btn"
              onClick={onOpenSettings || onOpenAuth}
              title="Trader Settings & Profile"
              aria-label="Trader Settings & Profile"
            >
              <Settings size={15} />
            </button>
          )}
        </div>
      </div>

      <div className="topbar-cta-row">
        <button type="button" className="btn-primary topbar-add-trade-btn" onClick={onOpenAddTrade}>
          <Plus size={18} />
          <span>Quick Add Trade</span>
        </button>
      </div>
    </header>
  );
};
