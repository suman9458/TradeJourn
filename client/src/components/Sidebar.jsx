import React from 'react';
import {
  LayoutDashboard,
  TrendingUp,
  BarChart3,
  Bot,
  CalendarCheck,
  Target,
  Database,
  User,
  LogOut,
  Settings,
  ShieldCheck,
  Zap,
  Cpu,
  X,
  Camera
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Sidebar = ({ activeTab, setActiveTab, stats, onOpenAuth, onOpenSettings, isOpen, onClose }) => {
  const { user, logout } = useAuth();

  const navItems = [
    { id: 'overview', label: 'Command Overview', icon: LayoutDashboard },
    { id: 'charts', label: 'Pips and Profit Trajectory', icon: TrendingUp },
    { id: 'analytics', label: 'Deep Analytics', icon: BarChart3 },
    { id: 'ai-coach', label: 'AI Trading Coach', icon: Bot, badge: 'PRO' },
    { id: 'reviews', label: 'Performance Reviews', icon: CalendarCheck },
    { id: 'goals', label: 'Prop Goals & Milestones', icon: Target },
    { id: 'database', label: 'Database Ledger', icon: Database },
    { id: 'mt5', label: 'MT5 Integration', icon: Cpu, badge: 'LIVE' }
  ];

  const discipline = Math.round(stats?.disciplineScoreAverage || 0);

  return (
    <>
      {isOpen && <div className="sidebar-backdrop" onClick={onClose} />}
      <aside className={`sidebar ${isOpen ? 'mobile-open' : ''}`}>
        <div className="brand-section">
          <div className="brand-badge">
            <img src="/logo.png" alt="TradeJourn Logo" className="brand-badge-img" />
          </div>
          <div className="brand-info">
            <div className="brand-tag">
              <Zap size={11} />
              <span>INSTITUTIONAL TIER</span>
            </div>
            <h1>TradeJourn</h1>
          </div>
          <button className="mobile-sidebar-close" onClick={onClose} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>

        <div className="sidebar-scrollable-body">
          <nav className="nav-links">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  className={`nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    setActiveTab(item.id);
                    if (onClose) onClose();
                  }}
                >
                <Icon size={17} />
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.badge && (
                  <span style={{
                    fontSize: '0.62rem',
                    fontWeight: '800',
                    color: item.badge === 'LIVE' ? 'var(--profit)' : 'var(--accent-cyan)',
                    background: item.badge === 'LIVE' ? 'rgba(0, 245, 155, 0.12)' : 'var(--accent-cyan-soft)',
                    padding: '2px 7px',
                    borderRadius: '4px',
                    border: item.badge === 'LIVE' ? '1px solid rgba(0, 245, 155, 0.35)' : '1px solid rgba(0, 210, 255, 0.3)',
                    whiteSpace: 'nowrap',
                    letterSpacing: '0.04em',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    {item.badge === 'LIVE' && (
                      <span style={{
                        width: '5px',
                        height: '5px',
                        borderRadius: '50%',
                        background: 'var(--profit)',
                        display: 'inline-block',
                        boxShadow: '0 0 6px var(--profit)'
                      }} />
                    )}
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Quick Lens Card */}
        <div className="quick-lens-card">
          <div className="quick-lens-header">
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldCheck size={14} color="var(--profit)" />
              <span>Live Audit Lens</span>
            </span>
            <span style={{ fontSize: '0.62rem', color: 'var(--profit)', background: 'var(--profit-soft)', padding: '2px 6px', borderRadius: '4px', fontWeight: '800' }}>
              ACTIVE
            </span>
          </div>

          <div className="quick-metric">
            <span>Discipline Score</span>
            <strong style={{ color: discipline >= 75 ? 'var(--profit)' : 'var(--warning)', fontVariantNumeric: 'tabular-nums', fontWeight: '700' }}>
              {discipline}/100
            </strong>
          </div>

          <div className="quick-metric">
            <span>Win Rate</span>
            <strong style={{ color: 'var(--text-white)', fontVariantNumeric: 'tabular-nums', fontWeight: '700' }}>
              {(stats?.winRate || 0).toFixed(1)}%
            </strong>
          </div>

          <div className="quick-metric">
            <span>Top Setup</span>
            <strong style={{ color: 'var(--profit)', fontSize: '0.8rem', fontWeight: '700', whiteSpace: 'nowrap' }}>
              {stats?.bestSetup || '-'}
            </strong>
          </div>

          <div className="quick-metric">
            <span>Dominant Session</span>
            <strong style={{ color: 'var(--accent-cyan)', fontSize: '0.8rem', fontWeight: '700', whiteSpace: 'nowrap' }}>
              {stats?.bestSession || '-'}
            </strong>
          </div>
        </div>
      </div>

      {/* Trader Profile Footer (Always Pinned & Accessible) */}
      <div className="sidebar-profile-footer">
        <div
          onClick={onOpenSettings}
          style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden', cursor: 'pointer', flex: 1, minWidth: 0 }}
          title="Click to view profile & change photo"
        >
          <div
            className="sidebar-avatar-container"
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(0, 245, 155, 0.2), rgba(0, 210, 255, 0.2))',
              border: '1px solid var(--border-medium)',
              display: 'grid',
              placeItems: 'center',
              color: 'var(--profit)',
              fontWeight: '800',
              fontSize: '0.88rem',
              flexShrink: 0,
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={user?.name || 'Trader'}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : user?.name ? (
              user.name.charAt(0).toUpperCase()
            ) : (
              <User size={16} />
            )}
            <div className="sidebar-avatar-hover-badge" title="Change profile photo">
              <Camera size={10} color="#ffffff" strokeWidth={2.5} />
            </div>
          </div>
          <div style={{ overflow: 'hidden', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <p style={{ fontSize: '0.84rem', fontWeight: '700', color: 'var(--text-white)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {user?.name || 'Guest Trader'}
              </p>
              {user?.role === 'admin' ? (
                <span style={{
                  fontSize: '0.58rem',
                  fontWeight: '900',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  letterSpacing: '0.06em',
                  background: 'rgba(245, 158, 11, 0.2)',
                  color: '#f59e0b',
                  border: '1px solid rgba(245, 158, 11, 0.4)'
                }}>
                  ADMIN
                </span>
              ) : user?.tradingExperience ? (
                <span style={{
                  fontSize: '0.58rem',
                  fontWeight: '800',
                  padding: '1px 5px',
                  borderRadius: '4px',
                  letterSpacing: '0.04em',
                  background: user.tradingExperience === 'Expert' ? 'rgba(0, 245, 155, 0.15)' : user.tradingExperience === 'Beginner' ? 'rgba(0, 210, 255, 0.15)' : 'rgba(168, 85, 247, 0.15)',
                  color: user.tradingExperience === 'Expert' ? 'var(--profit)' : user.tradingExperience === 'Beginner' ? 'var(--accent-cyan)' : 'var(--accent-purple)',
                  border: `1px solid ${user.tradingExperience === 'Expert' ? 'rgba(0, 245, 155, 0.3)' : user.tradingExperience === 'Beginner' ? 'rgba(0, 210, 255, 0.3)' : 'rgba(168, 85, 247, 0.3)'}`
                }}>
                  {user.tradingExperience.toUpperCase()}
                </span>
              ) : null}
            </div>
            <p style={{ fontSize: '0.72rem', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)', fontWeight: '600', whiteSpace: 'nowrap' }}>
              {user?.userId || (user?.email ? `@${user.email.split('@')[0]}` : '@trader')}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '3px', flexShrink: 0 }}>
          <button className="btn-ghost" style={{ padding: '7px' }} title="Trader Settings" onClick={onOpenSettings} aria-label="Trader Settings">
            <Settings size={16} />
          </button>
          <button className="btn-ghost" style={{ padding: '7px', color: 'var(--accent-cyan)' }} title="Sign In or Switch Account" onClick={onOpenAuth} aria-label="Account">
            <User size={16} />
          </button>
          <button className="btn-ghost" style={{ padding: '7px', color: 'var(--loss)' }} title="Sign Out" onClick={logout} aria-label="Sign Out">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  </>
);
};
