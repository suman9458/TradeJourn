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
  X
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
    { id: 'database', label: 'Database Ledger', icon: Database }
  ];

  const discipline = Math.round(stats?.disciplineScoreAverage || 0);

  return (
    <>
      {isOpen && <div className="sidebar-backdrop" onClick={onClose} />}
      <aside className={`sidebar ${isOpen ? 'mobile-open' : ''}`}>
        <div className="brand-section">
          <div className="brand-badge">TJ</div>
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
                <span style={{ fontSize: '0.62rem', fontWeight: '800', color: 'var(--accent-cyan)', background: 'var(--accent-cyan-soft)', padding: '1px 6px', borderRadius: '4px', border: '1px solid rgba(0, 210, 255, 0.3)' }}>
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
          <strong style={{ color: discipline >= 75 ? 'var(--profit)' : 'var(--warning)', fontFamily: 'var(--font-mono)' }}>
            {discipline}/100
          </strong>
        </div>

        <div className="quick-metric">
          <span>Win Rate</span>
          <strong style={{ color: 'var(--text-white)', fontFamily: 'var(--font-mono)' }}>
            {(stats?.winRate || 0).toFixed(1)}%
          </strong>
        </div>

        <div className="quick-metric">
          <span>Highest Yield Setup</span>
          <strong style={{ color: 'var(--profit)', fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
            {stats?.bestSetup || '-'}
          </strong>
        </div>

        <div className="quick-metric">
          <span>Dominant Session</span>
          <strong style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
            {stats?.bestSession || '-'}
          </strong>
        </div>
      </div>

      {/* Trader Profile Footer */}
      <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, rgba(0, 245, 155, 0.2), rgba(0, 210, 255, 0.2))', border: '1px solid var(--border-medium)', display: 'grid', placeItems: 'center', color: 'var(--profit)', fontWeight: '800', fontSize: '0.88rem' }}>
            {user?.name ? user.name.charAt(0).toUpperCase() : <User size={16} />}
          </div>
          <div style={{ overflow: 'hidden' }}>
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

        <div style={{ display: 'flex', gap: '2px' }}>
          <button className="btn-ghost" style={{ padding: '6px' }} title="Trader Settings" onClick={onOpenSettings}>
            <Settings size={15} />
          </button>
          <button className="btn-ghost" style={{ padding: '6px', color: 'var(--accent-cyan)' }} title="Sign In or Switch Account" onClick={onOpenAuth}>
            <User size={15} />
          </button>
          <button className="btn-ghost" style={{ padding: '6px', color: 'var(--loss)' }} title="Sign Out" onClick={logout}>
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  </>
);
};
