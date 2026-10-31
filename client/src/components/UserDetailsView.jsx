import React, { useState, useEffect } from 'react';
import {
  Users,
  ShieldCheck,
  User,
  Search,
  RotateCcw,
  Trash2,
  Calendar,
  Mail,
  Phone,
  Lock,
  CheckCircle2,
  TrendingUp,
  Award,
  AlertCircle,
  Eye,
  X,
  Target,
  BookOpen,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Copy,
  Check,
  DollarSign
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

export const UserDetailsView = ({ theme }) => {
  const isLight = theme === 'light' || (typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light');
  const { user: currentAdmin } = useAuth();

  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    adminCount: 0,
    proCount: 0,
    userCount: 0,
    demoCount: 0,
    activeTradersCount: 0,
    totalTradesAcrossAll: 0,
    totalPlatformPnL: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL'); // 'ALL' | 'admin' | 'pro' | 'user' | 'demo'
  const [updatingId, setUpdatingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [actionSuccess, setActionSuccess] = useState('');

  // Deep Trader Inspection State
  const [selectedTrader, setSelectedTrader] = useState(null);
  const [deepLoading, setDeepLoading] = useState(false);
  const [deepError, setDeepError] = useState('');
  const [deepData, setDeepData] = useState(null);
  const [modalTab, setModalTab] = useState('profile'); // 'profile' | 'trades' | 'analytics' | 'assets'
  const [copiedField, setCopiedField] = useState(null);

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getAdminUsers();
      if (res?.success) {
        setUsers(res.users || []);
        if (res.stats) {
          setStats(res.stats);
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to load user directory. Please ensure you are signed in as administrator.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleOpenDeepDetails = async (targetUser) => {
    setSelectedTrader(targetUser);
    setModalTab('profile');
    setDeepLoading(true);
    setDeepError('');
    setDeepData(null);
    try {
      const res = await api.getAdminUserDetails(targetUser.id);
      if (res?.success) {
        setDeepData(res);
      } else {
        setDeepError(res?.message || 'Failed to retrieve deep trader records');
      }
    } catch (err) {
      setDeepError(err.message || 'Failed to retrieve deep trader records');
    } finally {
      setDeepLoading(false);
    }
  };

  const handleCloseModal = () => {
    setSelectedTrader(null);
    setDeepData(null);
    setDeepError('');
  };

  const handleCopyText = (text, fieldName) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleRoleChange = async (targetId, newRole) => {
    setUpdatingId(targetId);
    setActionSuccess('');
    try {
      const res = await api.updateAdminUserRole(targetId, newRole);
      if (res?.success) {
        setUsers(prev =>
          prev.map(u => (u.id === targetId ? { ...u, role: newRole } : u))
        );
        if (deepData?.user?.id === targetId) {
          setDeepData(prev => ({
            ...prev,
            user: { ...prev.user, role: newRole }
          }));
        }
        setActionSuccess(`Updated @${users.find(u => u.id === targetId)?.userId?.replace(/^@/, '')} role to ${newRole.toUpperCase()}`);
        setTimeout(() => setActionSuccess(''), 3500);
      }
    } catch (err) {
      alert('Failed to update role: ' + (err.message || 'Unknown error'));
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteUser = async (targetUser) => {
    const isSelf = targetUser.id === currentAdmin?.id || targetUser.userId === currentAdmin?.userId;
    if (isSelf) {
      alert('You cannot delete your own admin account while logged in.');
      return;
    }
    if (targetUser.userId === '@sumansingh9458') {
      alert('The primary system admin account (@sumansingh9458) cannot be deleted.');
      return;
    }

    const confirmMsg = `Are you sure you want to permanently delete trader "${targetUser.name}" (${targetUser.userId})?\n\nThis will permanently purge their account, trades, playbooks, and goals.`;
    if (!window.confirm(confirmMsg)) return;

    setDeletingId(targetUser.id);
    setActionSuccess('');
    try {
      const res = await api.deleteAdminUser(targetUser.id);
      if (res?.success) {
        setUsers(prev => prev.filter(u => u.id !== targetUser.id));
        setStats(prev => ({
          ...prev,
          totalUsers: Math.max(0, prev.totalUsers - 1),
          adminCount: targetUser.role === 'admin' ? Math.max(0, prev.adminCount - 1) : prev.adminCount,
          proCount: targetUser.role === 'pro' ? Math.max(0, prev.proCount - 1) : prev.proCount,
          userCount: targetUser.role === 'user' ? Math.max(0, prev.userCount - 1) : prev.userCount,
          demoCount: targetUser.role === 'demo' ? Math.max(0, prev.demoCount - 1) : prev.demoCount
        }));
        if (selectedTrader?.id === targetUser.id) {
          handleCloseModal();
        }
        setActionSuccess(`User ${targetUser.userId} purged successfully.`);
        setTimeout(() => setActionSuccess(''), 3500);
      }
    } catch (err) {
      alert('Failed to delete user: ' + (err.message || 'Unknown error'));
    } finally {
      setDeletingId(null);
    }
  };

  // Filtered & Searched List
  const filteredUsers = users.filter((u) => {
    if (roleFilter !== 'ALL' && u.role !== roleFilter) {
      return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = u.name?.toLowerCase().includes(q);
      const matchHandle = u.userId?.toLowerCase().includes(q);
      const matchEmail = u.email?.toLowerCase().includes(q);
      const matchPhone = u.phoneNumber?.toLowerCase().includes(q);
      const matchExp = u.tradingExperience?.toLowerCase().includes(q);
      if (!matchName && !matchHandle && !matchEmail && !matchPhone && !matchExp) {
        return false;
      }
    }

    return true;
  });

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', paddingBottom: '60px' }}>
      {/* 1. Header Banner */}
      <div style={{
        background: isLight
          ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(240, 249, 255, 0.9))'
          : 'linear-gradient(135deg, rgba(16, 24, 38, 0.95), rgba(11, 19, 32, 0.98))',
        border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '16px',
        padding: '24px 28px',
        marginBottom: '24px',
        boxShadow: isLight ? '0 4px 16px rgba(0,0,0,0.04)' : '0 10px 30px rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, rgba(0, 210, 255, 0.2), rgba(0, 245, 155, 0.2))',
            border: '1px solid rgba(0, 210, 255, 0.4)',
            display: 'grid',
            placeItems: 'center',
            color: 'var(--accent-cyan)'
          }}>
            <Users size={24} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <h2 style={{
                fontSize: '1.45rem',
                fontWeight: '800',
                color: isLight ? '#0f172a' : '#ffffff',
                margin: 0,
                letterSpacing: '-0.02em'
              }}>
                Trader Directory & User Details
              </h2>
              <span style={{
                fontSize: '0.65rem',
                fontWeight: '900',
                padding: '2px 8px',
                borderRadius: '6px',
                background: 'rgba(245, 158, 11, 0.2)',
                color: '#f59e0b',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                letterSpacing: '0.06em'
              }}>
                ADMIN DESK
              </span>
            </div>
            <p style={{
              fontSize: '0.84rem',
              color: isLight ? '#64748b' : '#94a3b8',
              margin: 0
            }}>
              Live real-time records from MongoDB. Click any trader row to inspect complete live trading stats, journal history, and account parameters.
            </p>
          </div>
        </div>

        <button
          onClick={fetchUsers}
          disabled={loading}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '9px 16px',
            borderRadius: '10px',
            background: isLight ? '#ffffff' : 'rgba(255, 255, 255, 0.05)',
            border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255, 255, 255, 0.12)',
            color: isLight ? '#1e293b' : '#f8fafc',
            fontSize: '0.84rem',
            fontWeight: '700',
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          <RotateCcw size={15} className={loading ? 'spin-animation' : ''} />
          <span>Refresh Live Directory</span>
        </button>
      </div>

      {actionSuccess && (
        <div style={{
          padding: '12px 18px',
          borderRadius: '10px',
          background: 'rgba(0, 245, 155, 0.12)',
          border: '1px solid rgba(0, 245, 155, 0.35)',
          color: 'var(--profit)',
          fontSize: '0.86rem',
          fontWeight: '700',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <CheckCircle2 size={16} />
          <span>{actionSuccess}</span>
        </div>
      )}

      {error && (
        <div style={{
          padding: '14px 20px',
          borderRadius: '12px',
          background: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid rgba(239, 68, 68, 0.35)',
          color: '#f87171',
          fontSize: '0.88rem',
          fontWeight: '600',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* 2. KPI Summary Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        {/* Total Traders */}
        <div style={{
          background: isLight ? '#ffffff' : 'rgba(16, 24, 38, 0.7)',
          border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.07)',
          borderRadius: '14px',
          padding: '18px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px'
        }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: 'rgba(0, 210, 255, 0.15)',
            border: '1px solid rgba(0, 210, 255, 0.3)',
            display: 'grid',
            placeItems: 'center',
            color: 'var(--accent-cyan)'
          }}>
            <Users size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.74rem', color: isLight ? '#64748b' : '#94a3b8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Traders
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: '800', color: isLight ? '#0f172a' : '#ffffff', fontVariantNumeric: 'tabular-nums' }}>
              {stats.totalUsers}
            </div>
          </div>
        </div>

        {/* Pro Tier Traders */}
        <div style={{
          background: isLight ? '#ffffff' : 'rgba(16, 24, 38, 0.7)',
          border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.07)',
          borderRadius: '14px',
          padding: '18px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px'
        }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: 'rgba(0, 245, 155, 0.15)',
            border: '1px solid rgba(0, 245, 155, 0.3)',
            display: 'grid',
            placeItems: 'center',
            color: 'var(--profit)'
          }}>
            <Award size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.74rem', color: isLight ? '#64748b' : '#94a3b8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Pro & Active Traders
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: '800', color: 'var(--profit)', fontVariantNumeric: 'tabular-nums' }}>
              {stats.proCount} <span style={{ fontSize: '0.82rem', fontWeight: '600', color: isLight ? '#64748b' : '#94a3b8' }}>({stats.activeTradersCount} active)</span>
            </div>
          </div>
        </div>

        {/* Administrators */}
        <div style={{
          background: isLight ? '#ffffff' : 'rgba(16, 24, 38, 0.7)',
          border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.07)',
          borderRadius: '14px',
          padding: '18px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px'
        }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: 'rgba(245, 158, 11, 0.15)',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            display: 'grid',
            placeItems: 'center',
            color: '#f59e0b'
          }}>
            <ShieldCheck size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.74rem', color: isLight ? '#64748b' : '#94a3b8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Administrators
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: '800', color: '#f59e0b', fontVariantNumeric: 'tabular-nums' }}>
              {stats.adminCount}
            </div>
          </div>
        </div>

        {/* Total Platform Trades */}
        <div style={{
          background: isLight ? '#ffffff' : 'rgba(16, 24, 38, 0.7)',
          border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.07)',
          borderRadius: '14px',
          padding: '18px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px'
        }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: 'rgba(168, 85, 247, 0.15)',
            border: '1px solid rgba(168, 85, 247, 0.3)',
            display: 'grid',
            placeItems: 'center',
            color: 'var(--accent-purple)'
          }}>
            <TrendingUp size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.74rem', color: isLight ? '#64748b' : '#94a3b8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Trades Logged
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: '800', color: isLight ? '#0f172a' : '#ffffff', fontVariantNumeric: 'tabular-nums' }}>
              {stats.totalTradesAcrossAll}
            </div>
          </div>
        </div>

        {/* Total Platform Realized PnL */}
        <div style={{
          background: isLight ? '#ffffff' : 'rgba(16, 24, 38, 0.7)',
          border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.07)',
          borderRadius: '14px',
          padding: '18px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px'
        }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: stats.totalPlatformPnL >= 0 ? 'rgba(0, 245, 155, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${stats.totalPlatformPnL >= 0 ? 'rgba(0, 245, 155, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            display: 'grid',
            placeItems: 'center',
            color: stats.totalPlatformPnL >= 0 ? 'var(--profit)' : '#ef4444'
          }}>
            <DollarSign size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.74rem', color: isLight ? '#64748b' : '#94a3b8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Platform Realized PnL
            </div>
            <div style={{
              fontSize: '1.45rem',
              fontWeight: '800',
              color: stats.totalPlatformPnL >= 0 ? 'var(--profit)' : '#ef4444',
              fontVariantNumeric: 'tabular-nums'
            }}>
              {stats.totalPlatformPnL >= 0 ? '+' : ''}${stats.totalPlatformPnL.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Filter & Search Controls */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '14px',
        marginBottom: '20px'
      }}>
        {/* Role Filter Chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { id: 'ALL', label: `All (${stats.totalUsers})` },
            { id: 'admin', label: `Admins (${stats.adminCount})` },
            { id: 'pro', label: `Pro (${stats.proCount})` },
            { id: 'user', label: `Standard (${stats.userCount})` },
            { id: 'demo', label: `Demo (${stats.demoCount})` }
          ].map((chip) => {
            const active = roleFilter === chip.id;
            return (
              <button
                key={chip.id}
                onClick={() => setRoleFilter(chip.id)}
                style={{
                  padding: '7px 14px',
                  borderRadius: '8px',
                  fontSize: '0.78rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  border: active
                    ? '1px solid var(--accent-cyan)'
                    : isLight
                    ? '1px solid #cbd5e1'
                    : '1px solid rgba(255, 255, 255, 0.1)',
                  background: active
                    ? 'rgba(0, 210, 255, 0.15)'
                    : isLight
                    ? '#ffffff'
                    : 'rgba(255, 255, 255, 0.04)',
                  color: active
                    ? 'var(--accent-cyan)'
                    : isLight
                    ? '#475569'
                    : '#94a3b8',
                  transition: 'all 0.15s ease'
                }}
              >
                {chip.label}
              </button>
            );
          })}
        </div>

        {/* Search Bar */}
        <div style={{
          position: 'relative',
          minWidth: '280px',
          flex: '1',
          maxWidth: '420px'
        }}>
          <Search size={16} style={{
            position: 'absolute',
            left: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: isLight ? '#94a3b8' : '#64748b'
          }} />
          <input
            type="text"
            placeholder="Search by name, handle (@suman), email, phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '9px 12px 9px 36px',
              borderRadius: '10px',
              border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255, 255, 255, 0.12)',
              background: isLight ? '#ffffff' : 'rgba(15, 23, 42, 0.6)',
              color: isLight ? '#0f172a' : '#ffffff',
              fontSize: '0.84rem',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>
      </div>

      {/* 4. Main Users Directory Table */}
      <div style={{
        background: isLight ? '#ffffff' : 'rgba(16, 24, 38, 0.6)',
        border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: isLight ? '0 4px 16px rgba(0,0,0,0.03)' : '0 10px 30px rgba(0,0,0,0.25)'
      }}>
        {loading ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: isLight ? '#64748b' : '#94a3b8' }}>
            <div className="spin-animation" style={{
              width: '32px',
              height: '32px',
              border: '3px solid rgba(0, 210, 255, 0.2)',
              borderTopColor: 'var(--accent-cyan)',
              borderRadius: '50%',
              margin: '0 auto 16px'
            }} />
            <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: '600' }}>Fetching live traders directory from database...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: isLight ? '#64748b' : '#94a3b8' }}>
            <Users size={40} style={{ opacity: 0.35, marginBottom: '12px' }} />
            <h4 style={{ margin: '0 0 6px', color: isLight ? '#0f172a' : '#ffffff' }}>No matching traders found</h4>
            <p style={{ margin: 0, fontSize: '0.84rem' }}>Try clearing your search query or choosing another role filter.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{
                  borderBottom: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.08)',
                  background: isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.02)'
                }}>
                  <th style={{ padding: '14px 20px', fontSize: '0.74rem', color: isLight ? '#64748b' : '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Trader Profile</th>
                  <th style={{ padding: '14px 20px', fontSize: '0.74rem', color: isLight ? '#64748b' : '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Contact & Identity</th>
                  <th style={{ padding: '14px 20px', fontSize: '0.74rem', color: isLight ? '#64748b' : '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tier & Role</th>
                  <th style={{ padding: '14px 20px', fontSize: '0.74rem', color: isLight ? '#64748b' : '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Experience</th>
                  <th style={{ padding: '14px 20px', fontSize: '0.74rem', color: isLight ? '#64748b' : '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Live Trade Activity</th>
                  <th style={{ padding: '14px 20px', fontSize: '0.74rem', color: isLight ? '#64748b' : '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Joined Date</th>
                  <th style={{ padding: '14px 20px', fontSize: '0.74rem', color: isLight ? '#64748b' : '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => {
                  const isCurrentAdmin = u.id === currentAdmin?.id || u.userId === currentAdmin?.userId;
                  const isPrimaryAdmin = u.userId === '@sumansingh9458';

                  return (
                    <tr
                      key={u.id}
                      onClick={() => handleOpenDeepDetails(u)}
                      style={{
                        borderBottom: isLight ? '1px solid #f1f5f9' : '1px solid rgba(255, 255, 255, 0.05)',
                        transition: 'background 0.15s ease',
                        cursor: 'pointer'
                      }}
                      className="table-row-hover"
                    >
                      {/* 1. Trader Profile */}
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            background: isLight ? '#e2e8f0' : 'linear-gradient(135deg, rgba(0, 245, 155, 0.2), rgba(0, 210, 255, 0.2))',
                            border: '1px solid var(--border-medium)',
                            display: 'grid',
                            placeItems: 'center',
                            fontWeight: '800',
                            color: 'var(--profit)',
                            fontSize: '0.9rem',
                            overflow: 'hidden',
                            flexShrink: 0
                          }}>
                            {u.avatar ? (
                              <img src={u.avatar} alt={u.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : u.name ? (
                              u.name.charAt(0).toUpperCase()
                            ) : (
                              <User size={16} />
                            )}
                          </div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{
                                fontWeight: '700',
                                fontSize: '0.92rem',
                                color: isLight ? '#0f172a' : '#ffffff'
                              }}>
                                {u.name || 'Unnamed Trader'}
                              </span>
                              {isCurrentAdmin && (
                                <span style={{
                                  fontSize: '0.6rem',
                                  fontWeight: '800',
                                  padding: '1px 5px',
                                  borderRadius: '4px',
                                  background: 'rgba(0, 210, 255, 0.15)',
                                  color: 'var(--accent-cyan)'
                                }}>
                                  YOU
                                </span>
                              )}
                            </div>
                            <div style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '0.78rem',
                              color: 'var(--accent-cyan)',
                              fontWeight: '600'
                            }}>
                              {u.userId}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 2. Contact & Identity */}
                      <td style={{ padding: '16px 20px' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: isLight ? '#334155' : '#cbd5e1' }}>
                            <Mail size={12} color={isLight ? '#64748b' : '#94a3b8'} />
                            <span>{u.email || <em style={{ color: '#94a3b8' }}>No email</em>}</span>
                          </div>
                          {u.phoneNumber ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: isLight ? '#64748b' : '#94a3b8' }}>
                              <Phone size={12} />
                              <span>{u.phoneNumber}</span>
                            </div>
                          ) : null}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                            <span style={{
                              fontSize: '0.68rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 7px',
                              borderRadius: '4px',
                              background: u.hasSecurityPin ? 'rgba(0, 245, 155, 0.12)' : 'rgba(255, 255, 255, 0.05)',
                              color: u.hasSecurityPin ? 'var(--profit)' : '#94a3b8',
                              border: u.hasSecurityPin ? '1px solid rgba(0, 245, 155, 0.35)' : '1px solid rgba(255, 255, 255, 0.1)'
                            }}>
                              <Lock size={10} />
                              {u.hasSecurityPin ? '4-Digit PIN Active' : 'PIN Not Set'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 3. Tier & Role Selector */}
                      <td style={{ padding: '16px 20px' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'inline-block' }}>
                          <select
                            value={u.role}
                            disabled={updatingId === u.id || isPrimaryAdmin || (isCurrentAdmin && u.role === 'admin')}
                            onChange={(e) => handleRoleChange(u.id, e.target.value)}
                            style={{
                              padding: '4px 10px',
                              borderRadius: '6px',
                              fontSize: '0.74rem',
                              fontWeight: '800',
                              letterSpacing: '0.04em',
                              cursor: (isPrimaryAdmin || isCurrentAdmin) ? 'default' : 'pointer',
                              border: u.role === 'admin'
                                ? '1px solid rgba(245, 158, 11, 0.5)'
                                : u.role === 'pro'
                                ? '1px solid rgba(0, 245, 155, 0.4)'
                                : '1px solid rgba(0, 210, 255, 0.4)',
                              background: u.role === 'admin'
                                ? 'rgba(245, 158, 11, 0.18)'
                                : u.role === 'pro'
                                ? 'rgba(0, 245, 155, 0.15)'
                                : 'rgba(0, 210, 255, 0.12)',
                              color: u.role === 'admin'
                                ? '#f59e0b'
                                : u.role === 'pro'
                                ? 'var(--profit)'
                                : 'var(--accent-cyan)',
                              outline: 'none'
                            }}
                          >
                            <option value="admin">ADMIN</option>
                            <option value="pro">PRO TIER</option>
                            <option value="user">STANDARD</option>
                            <option value="demo">DEMO</option>
                          </select>
                        </div>
                      </td>

                      {/* 4. Trading Experience */}
                      <td style={{ padding: '16px 20px' }}>
                        <span style={{
                          fontSize: '0.72rem',
                          fontWeight: '800',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          background: u.tradingExperience === 'Expert'
                            ? 'rgba(0, 245, 155, 0.12)'
                            : u.tradingExperience === 'Beginner'
                            ? 'rgba(0, 210, 255, 0.12)'
                            : 'rgba(168, 85, 247, 0.12)',
                          color: u.tradingExperience === 'Expert'
                            ? 'var(--profit)'
                            : u.tradingExperience === 'Beginner'
                            ? 'var(--accent-cyan)'
                            : 'var(--accent-purple)',
                          border: `1px solid ${
                            u.tradingExperience === 'Expert'
                              ? 'rgba(0, 245, 155, 0.3)'
                              : u.tradingExperience === 'Beginner'
                              ? 'rgba(0, 210, 255, 0.3)'
                              : 'rgba(168, 85, 247, 0.3)'
                          }`
                        }}>
                          {u.tradingExperience?.toUpperCase() || 'INTERMEDIATE'}
                        </span>
                      </td>

                      {/* 5. Live Trade Activity & Performance */}
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <TrendingUp size={14} color="var(--profit)" />
                            <span style={{
                              fontWeight: '700',
                              fontSize: '0.86rem',
                              color: isLight ? '#0f172a' : '#ffffff',
                              fontVariantNumeric: 'tabular-nums'
                            }}>
                              {u.totalTrades}
                            </span>
                            <span style={{ fontSize: '0.74rem', color: isLight ? '#64748b' : '#94a3b8' }}>
                              trades
                            </span>

                            {u.totalTrades > 0 && (
                              <span style={{
                                fontSize: '0.68rem',
                                fontWeight: '800',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                background: u.totalPnL >= 0 ? 'rgba(0, 245, 155, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                color: u.totalPnL >= 0 ? 'var(--profit)' : '#ef4444'
                              }}>
                                {u.totalPnL >= 0 ? '+' : ''}${u.totalPnL.toLocaleString()}
                              </span>
                            )}
                          </div>

                          {u.totalTrades > 0 ? (
                            <div style={{ fontSize: '0.72rem', color: isLight ? '#64748b' : '#94a3b8' }}>
                              Win Rate: <strong style={{ color: u.winRate >= 50 ? 'var(--profit)' : '#ef4444' }}>{u.winRate}%</strong> ({u.wins}W / {u.losses}L)
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.72rem', color: isLight ? '#94a3b8' : '#64748b' }}>No trades logged</span>
                          )}
                        </div>
                      </td>

                      {/* 6. Joined Date */}
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: isLight ? '#64748b' : '#94a3b8' }}>
                          <Calendar size={13} />
                          <span>
                            {u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            }) : '-'}
                          </span>
                        </div>
                      </td>

                      {/* 7. Actions */}
                      <td style={{ padding: '16px 20px', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            onClick={() => handleOpenDeepDetails(u)}
                            title="Inspect full trader profile, trades, and performance"
                            style={{
                              padding: '6px 12px',
                              borderRadius: '8px',
                              border: '1px solid rgba(0, 210, 255, 0.35)',
                              background: 'rgba(0, 210, 255, 0.1)',
                              color: 'var(--accent-cyan)',
                              fontSize: '0.74rem',
                              fontWeight: '700',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <Eye size={13} />
                            <span>Inspect</span>
                          </button>

                          <button
                            onClick={() => handleDeleteUser(u)}
                            disabled={deletingId === u.id || isCurrentAdmin || isPrimaryAdmin}
                            title={isCurrentAdmin || isPrimaryAdmin ? 'Cannot delete this admin account' : 'Delete user account and purge records'}
                            style={{
                              padding: '6px 10px',
                              borderRadius: '8px',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              background: 'rgba(239, 68, 68, 0.08)',
                              color: (isCurrentAdmin || isPrimaryAdmin) ? '#64748b' : '#ef4444',
                              fontSize: '0.74rem',
                              fontWeight: '700',
                              cursor: (isCurrentAdmin || isPrimaryAdmin) ? 'not-allowed' : 'pointer',
                              opacity: (isCurrentAdmin || isPrimaryAdmin) ? 0.4 : 1,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <Trash2 size={13} />
                            <span>{deletingId === u.id ? '...' : ''}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. DEEP TRADER INSPECTION MODAL */}
      {selectedTrader && (
        <div
          className="modal-overlay"
          onClick={handleCloseModal}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(3, 7, 18, 0.75)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '920px',
              maxHeight: '90vh',
              background: isLight ? '#ffffff' : '#0c1322',
              border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '20px',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.5)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            {/* Modal Header */}
            <div style={{
              padding: '24px 28px',
              borderBottom: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.08)',
              background: isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.02)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, rgba(0, 245, 155, 0.25), rgba(0, 210, 255, 0.25))',
                  border: '2px solid var(--accent-cyan)',
                  display: 'grid',
                  placeItems: 'center',
                  color: 'var(--profit)',
                  fontSize: '1.25rem',
                  fontWeight: '800',
                  overflow: 'hidden',
                  flexShrink: 0
                }}>
                  {selectedTrader.avatar ? (
                    <img src={selectedTrader.avatar} alt={selectedTrader.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    (selectedTrader.name || 'T').charAt(0).toUpperCase()
                  )}
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: '800', color: isLight ? '#0f172a' : '#ffffff' }}>
                      {selectedTrader.name || 'Unnamed Trader'}
                    </h3>
                    <span style={{
                      fontSize: '0.7rem',
                      fontWeight: '800',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      background: selectedTrader.role === 'admin'
                        ? 'rgba(245, 158, 11, 0.2)'
                        : selectedTrader.role === 'pro'
                        ? 'rgba(0, 245, 155, 0.2)'
                        : 'rgba(0, 210, 255, 0.2)',
                      color: selectedTrader.role === 'admin'
                        ? '#f59e0b'
                        : selectedTrader.role === 'pro'
                        ? 'var(--profit)'
                        : 'var(--accent-cyan)',
                      border: `1px solid ${
                        selectedTrader.role === 'admin'
                          ? 'rgba(245, 158, 11, 0.4)'
                          : selectedTrader.role === 'pro'
                          ? 'rgba(0, 245, 155, 0.4)'
                          : 'rgba(0, 210, 255, 0.4)'
                      }`
                    }}>
                      {selectedTrader.role?.toUpperCase()}
                    </span>
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginTop: '4px',
                    fontSize: '0.82rem',
                    color: isLight ? '#64748b' : '#94a3b8'
                  }}>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', fontWeight: '700' }}>
                      {selectedTrader.userId}
                    </span>
                    <span>•</span>
                    <span>Joined {new Date(selectedTrader.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleCloseModal}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255, 255, 255, 0.1)',
                  background: isLight ? '#ffffff' : 'rgba(255, 255, 255, 0.05)',
                  color: isLight ? '#64748b' : '#94a3b8',
                  display: 'grid',
                  placeItems: 'center',
                  cursor: 'pointer'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Navigation Tabs */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '12px 28px',
              borderBottom: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.08)',
              background: isLight ? '#ffffff' : 'rgba(15, 23, 42, 0.4)',
              overflowX: 'auto'
            }}>
              {[
                { id: 'profile', label: 'Identity & Details', icon: User },
                { id: 'trades', label: `Logged Trades (${deepData?.performance?.totalTrades ?? selectedTrader.totalTrades})`, icon: TrendingUp },
                { id: 'analytics', label: 'Performance Breakdown', icon: Activity },
                { id: 'assets', label: 'Platform Assets & MT5', icon: Target }
              ].map(t => {
                const Icon = t.icon;
                const active = modalTab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setModalTab(t.id)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '7px',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: 'none',
                      background: active ? 'rgba(0, 210, 255, 0.15)' : 'transparent',
                      color: active ? 'var(--accent-cyan)' : isLight ? '#64748b' : '#94a3b8',
                      fontSize: '0.82rem',
                      fontWeight: active ? '800' : '600',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <Icon size={14} />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Modal Body / Scrollable Content */}
            <div style={{ padding: '24px 28px', overflowY: 'auto', flex: 1 }}>
              {deepLoading ? (
                <div style={{ padding: '60px 0', textAlign: 'center', color: isLight ? '#64748b' : '#94a3b8' }}>
                  <div className="spin-animation" style={{
                    width: '32px',
                    height: '32px',
                    border: '3px solid rgba(0, 210, 255, 0.2)',
                    borderTopColor: 'var(--accent-cyan)',
                    borderRadius: '50%',
                    margin: '0 auto 16px'
                  }} />
                  <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: '600' }}>Fetching live trader metrics from database...</p>
                </div>
              ) : deepError ? (
                <div style={{
                  padding: '16px',
                  borderRadius: '12px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#f87171'
                }}>
                  {deepError}
                </div>
              ) : (
                <>
                  {/* Top 4 Performance Cards (Always Visible in Modal) */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '14px',
                    marginBottom: '24px'
                  }}>
                    {/* Trades Count */}
                    <div style={{
                      background: isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.03)',
                      border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: '12px',
                      padding: '14px 16px'
                    }}>
                      <div style={{ fontSize: '0.72rem', color: isLight ? '#64748b' : '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>
                        Total Trades
                      </div>
                      <div style={{ fontSize: '1.35rem', fontWeight: '800', color: isLight ? '#0f172a' : '#ffffff', marginTop: '2px' }}>
                        {deepData?.performance?.totalTrades ?? selectedTrader.totalTrades}
                      </div>
                    </div>

                    {/* Net PnL */}
                    <div style={{
                      background: isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.03)',
                      border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: '12px',
                      padding: '14px 16px'
                    }}>
                      <div style={{ fontSize: '0.72rem', color: isLight ? '#64748b' : '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>
                        Net Realized PnL
                      </div>
                      <div style={{
                        fontSize: '1.35rem',
                        fontWeight: '800',
                        color: (deepData?.performance?.totalPnL ?? selectedTrader.totalPnL) >= 0 ? 'var(--profit)' : '#ef4444',
                        marginTop: '2px'
                      }}>
                        {(deepData?.performance?.totalPnL ?? selectedTrader.totalPnL) >= 0 ? '+' : ''}
                        ${(deepData?.performance?.totalPnL ?? selectedTrader.totalPnL)?.toLocaleString()}
                      </div>
                    </div>

                    {/* Win Rate */}
                    <div style={{
                      background: isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.03)',
                      border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: '12px',
                      padding: '14px 16px'
                    }}>
                      <div style={{ fontSize: '0.72rem', color: isLight ? '#64748b' : '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>
                        Win Rate %
                      </div>
                      <div style={{ fontSize: '1.35rem', fontWeight: '800', color: 'var(--profit)', marginTop: '2px' }}>
                        {deepData?.performance?.winRate ?? selectedTrader.winRate}%
                        <span style={{ fontSize: '0.78rem', color: isLight ? '#64748b' : '#94a3b8', fontWeight: '600', marginLeft: '6px' }}>
                          ({deepData?.performance?.wins ?? selectedTrader.wins}W / {deepData?.performance?.losses ?? selectedTrader.losses}L)
                        </span>
                      </div>
                    </div>

                    {/* Total Pips */}
                    <div style={{
                      background: isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.03)',
                      border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: '12px',
                      padding: '14px 16px'
                    }}>
                      <div style={{ fontSize: '0.72rem', color: isLight ? '#64748b' : '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>
                        Total Pips Captured
                      </div>
                      <div style={{ fontSize: '1.35rem', fontWeight: '800', color: 'var(--accent-cyan)', marginTop: '2px' }}>
                        {(deepData?.performance?.totalPips ?? selectedTrader.totalPips) >= 0 ? '+' : ''}
                        {(deepData?.performance?.totalPips ?? selectedTrader.totalPips)?.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* TAB 1: Profile & Identity */}
                  {modalTab === 'profile' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      <div style={{
                        background: isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.02)',
                        border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.06)',
                        borderRadius: '14px',
                        padding: '20px'
                      }}>
                        <h4 style={{ margin: '0 0 16px', fontSize: '0.94rem', fontWeight: '800', color: isLight ? '#0f172a' : '#ffffff' }}>
                          Personal Identity & Security Information
                        </h4>

                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                          gap: '16px'
                        }}>
                          {/* Full Name */}
                          <div>
                            <div style={{ fontSize: '0.72rem', color: isLight ? '#64748b' : '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>Trader Full Name</div>
                            <div style={{ fontSize: '0.9rem', fontWeight: '700', color: isLight ? '#0f172a' : '#ffffff', marginTop: '4px' }}>
                              {deepData?.user?.name || selectedTrader.name || 'Not provided'}
                            </div>
                          </div>

                          {/* User ID Handle */}
                          <div>
                            <div style={{ fontSize: '0.72rem', color: isLight ? '#64748b' : '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>User ID / Handle</div>
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              fontSize: '0.9rem',
                              fontWeight: '700',
                              color: 'var(--accent-cyan)',
                              fontFamily: 'var(--font-mono)',
                              marginTop: '4px'
                            }}>
                              <span>{deepData?.user?.userId || selectedTrader.userId}</span>
                              <button
                                onClick={() => handleCopyText(deepData?.user?.userId || selectedTrader.userId, 'userId')}
                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0 }}
                                title="Copy Handle"
                              >
                                {copiedField === 'userId' ? <Check size={14} color="var(--profit)" /> : <Copy size={14} />}
                              </button>
                            </div>
                          </div>

                          {/* Email Address */}
                          <div>
                            <div style={{ fontSize: '0.72rem', color: isLight ? '#64748b' : '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>Email Address</div>
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              fontSize: '0.88rem',
                              fontWeight: '600',
                              color: isLight ? '#0f172a' : '#ffffff',
                              marginTop: '4px'
                            }}>
                              <span>{deepData?.user?.email || selectedTrader.email || 'No email attached'}</span>
                              {(deepData?.user?.email || selectedTrader.email) && (
                                <button
                                  onClick={() => handleCopyText(deepData?.user?.email || selectedTrader.email, 'email')}
                                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0 }}
                                  title="Copy Email"
                                >
                                  {copiedField === 'email' ? <Check size={14} color="var(--profit)" /> : <Copy size={14} />}
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Phone Number */}
                          <div>
                            <div style={{ fontSize: '0.72rem', color: isLight ? '#64748b' : '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>Mobile No. (Optional)</div>
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              fontSize: '0.88rem',
                              fontWeight: '600',
                              color: isLight ? '#0f172a' : '#ffffff',
                              marginTop: '4px'
                            }}>
                              <span>{deepData?.user?.phoneNumber || selectedTrader.phoneNumber || 'Not configured'}</span>
                              {(deepData?.user?.phoneNumber || selectedTrader.phoneNumber) && (
                                <button
                                  onClick={() => handleCopyText(deepData?.user?.phoneNumber || selectedTrader.phoneNumber, 'phone')}
                                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0 }}
                                  title="Copy Phone"
                                >
                                  {copiedField === 'phone' ? <Check size={14} color="var(--profit)" /> : <Copy size={14} />}
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Date of Birth */}
                          <div>
                            <div style={{ fontSize: '0.72rem', color: isLight ? '#64748b' : '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>Date of Birth (DOB)</div>
                            <div style={{ fontSize: '0.88rem', fontWeight: '600', color: isLight ? '#0f172a' : '#ffffff', marginTop: '4px' }}>
                              {deepData?.user?.dob || selectedTrader.dob || 'Not set'}
                            </div>
                          </div>

                          {/* 4-Digit Security PIN */}
                          <div>
                            <div style={{ fontSize: '0.72rem', color: isLight ? '#64748b' : '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>4-Digit Security PIN</div>
                            <div style={{ marginTop: '4px' }}>
                              <span style={{
                                fontSize: '0.74rem',
                                fontWeight: '800',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '3px 10px',
                                borderRadius: '6px',
                                background: (deepData?.user?.hasSecurityPin ?? selectedTrader.hasSecurityPin) ? 'rgba(0, 245, 155, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                                color: (deepData?.user?.hasSecurityPin ?? selectedTrader.hasSecurityPin) ? 'var(--profit)' : '#94a3b8',
                                border: (deepData?.user?.hasSecurityPin ?? selectedTrader.hasSecurityPin) ? '1px solid rgba(0, 245, 155, 0.35)' : '1px solid rgba(255, 255, 255, 0.1)'
                              }}>
                                <Lock size={12} />
                                {(deepData?.user?.hasSecurityPin ?? selectedTrader.hasSecurityPin) ? '4-Digit PIN Active & Configured' : 'PIN Not Set'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Trading Settings & System Preferences */}
                      <div style={{
                        background: isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.02)',
                        border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.06)',
                        borderRadius: '14px',
                        padding: '20px'
                      }}>
                        <h4 style={{ margin: '0 0 16px', fontSize: '0.94rem', fontWeight: '800', color: isLight ? '#0f172a' : '#ffffff' }}>
                          Trading Parameters & Platform Footprint
                        </h4>

                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                          gap: '16px'
                        }}>
                          <div>
                            <div style={{ fontSize: '0.72rem', color: isLight ? '#64748b' : '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>Experience Level</div>
                            <div style={{ fontSize: '0.88rem', fontWeight: '700', color: 'var(--accent-purple)', marginTop: '4px' }}>
                              {deepData?.user?.tradingExperience || selectedTrader.tradingExperience}
                            </div>
                          </div>

                          <div>
                            <div style={{ fontSize: '0.72rem', color: isLight ? '#64748b' : '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>Default Currency</div>
                            <div style={{ fontSize: '0.88rem', fontWeight: '700', color: isLight ? '#0f172a' : '#ffffff', marginTop: '4px' }}>
                              {deepData?.user?.settings?.currency || 'USD'}
                            </div>
                          </div>

                          <div>
                            <div style={{ fontSize: '0.72rem', color: isLight ? '#64748b' : '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>Risk Per Trade</div>
                            <div style={{ fontSize: '0.88rem', fontWeight: '700', color: isLight ? '#0f172a' : '#ffffff', marginTop: '4px' }}>
                              {deepData?.user?.settings?.riskPerTrade ?? 1}%
                            </div>
                          </div>

                          <div>
                            <div style={{ fontSize: '0.72rem', color: isLight ? '#64748b' : '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>Default Instrument</div>
                            <div style={{ fontSize: '0.88rem', fontWeight: '700', color: 'var(--accent-cyan)', marginTop: '4px' }}>
                              {deepData?.user?.settings?.defaultInstrument || 'EURUSD'}
                            </div>
                          </div>

                          <div>
                            <div style={{ fontSize: '0.72rem', color: isLight ? '#64748b' : '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>AI Trading Model</div>
                            <div style={{ fontSize: '0.88rem', fontWeight: '700', color: isLight ? '#0f172a' : '#ffffff', marginTop: '4px' }}>
                              {deepData?.user?.settings?.aiModel || 'gemini-2.0-flash'}
                            </div>
                          </div>

                          <div>
                            <div style={{ fontSize: '0.72rem', color: isLight ? '#64748b' : '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>MT5 Accounts Connected</div>
                            <div style={{ fontSize: '0.88rem', fontWeight: '700', color: isLight ? '#0f172a' : '#ffffff', marginTop: '4px' }}>
                              {deepData?.mt5Accounts?.length || 0} Accounts
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: Logged Trades */}
                  {modalTab === 'trades' && (
                    <div>
                      {!deepData?.recentTrades || deepData.recentTrades.length === 0 ? (
                        <div style={{ padding: '40px 20px', textAlign: 'center', color: isLight ? '#64748b' : '#94a3b8' }}>
                          <TrendingUp size={36} style={{ opacity: 0.35, marginBottom: '10px' }} />
                          <h4 style={{ margin: '0 0 6px', color: isLight ? '#0f172a' : '#ffffff' }}>No logged trades</h4>
                          <p style={{ margin: 0, fontSize: '0.84rem' }}>This trader has not recorded any trades in their TradeJourn ledger yet.</p>
                        </div>
                      ) : (
                        <div style={{
                          border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.08)',
                          borderRadius: '12px',
                          overflow: 'hidden'
                        }}>
                          <div style={{ overflowX: 'auto', maxHeight: '420px' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
                              <thead style={{
                                position: 'sticky',
                                top: 0,
                                background: isLight ? '#f1f5f9' : '#0f172a',
                                zIndex: 2
                              }}>
                                <tr>
                                  <th style={{ padding: '10px 14px', fontWeight: '700' }}>Date & Time</th>
                                  <th style={{ padding: '10px 14px', fontWeight: '700' }}>Trade Name</th>
                                  <th style={{ padding: '10px 14px', fontWeight: '700' }}>Pair</th>
                                  <th style={{ padding: '10px 14px', fontWeight: '700' }}>Type</th>
                                  <th style={{ padding: '10px 14px', fontWeight: '700' }}>Setup</th>
                                  <th style={{ padding: '10px 14px', fontWeight: '700' }}>Result</th>
                                  <th style={{ padding: '10px 14px', fontWeight: '700' }}>Pips</th>
                                  <th style={{ padding: '10px 14px', fontWeight: '700', textAlign: 'right' }}>PnL ($)</th>
                                </tr>
                              </thead>
                              <tbody>
                                {deepData.recentTrades.map((t) => (
                                  <tr
                                    key={t._id}
                                    style={{
                                      borderBottom: isLight ? '1px solid #f1f5f9' : '1px solid rgba(255, 255, 255, 0.04)'
                                    }}
                                  >
                                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                                      {t.date} <span style={{ color: '#94a3b8', fontSize: '0.74rem' }}>{t.time}</span>
                                    </td>
                                    <td style={{ padding: '10px 14px', fontWeight: '600' }}>
                                      {t.tradeName}
                                    </td>
                                    <td style={{ padding: '10px 14px', fontWeight: '700', color: 'var(--accent-cyan)' }}>
                                      {t.instrument}
                                    </td>
                                    <td style={{ padding: '10px 14px' }}>
                                      <span style={{
                                        fontWeight: '800',
                                        fontSize: '0.72rem',
                                        color: t.direction === 'Buy' ? 'var(--profit)' : '#ef4444'
                                      }}>
                                        {t.direction?.toUpperCase()}
                                      </span>
                                    </td>
                                    <td style={{ padding: '10px 14px' }}>
                                      <span style={{
                                        fontSize: '0.7rem',
                                        fontWeight: '800',
                                        padding: '1px 6px',
                                        borderRadius: '4px',
                                        background: 'rgba(255, 255, 255, 0.05)',
                                        border: '1px solid rgba(255, 255, 255, 0.1)'
                                      }}>
                                        {t.setupRating || '-'}
                                      </span>
                                    </td>
                                    <td style={{ padding: '10px 14px' }}>
                                      <span style={{
                                        fontSize: '0.72rem',
                                        fontWeight: '800',
                                        padding: '2px 7px',
                                        borderRadius: '4px',
                                        background: t.result === 'WIN' ? 'rgba(0, 245, 155, 0.15)' : t.result === 'LOSS' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                                        color: t.result === 'WIN' ? 'var(--profit)' : t.result === 'LOSS' ? '#ef4444' : '#94a3b8'
                                      }}>
                                        {t.result}
                                      </span>
                                    </td>
                                    <td style={{ padding: '10px 14px', fontWeight: '600' }}>
                                      {t.pips >= 0 ? '+' : ''}{t.pips}
                                    </td>
                                    <td style={{
                                      padding: '10px 14px',
                                      textAlign: 'right',
                                      fontWeight: '800',
                                      color: t.takeProfitUSD >= 0 ? 'var(--profit)' : '#ef4444'
                                    }}>
                                      {t.takeProfitUSD >= 0 ? '+' : ''}${t.takeProfitUSD?.toLocaleString()}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 3: Performance & Instruments */}
                  {modalTab === 'analytics' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      {/* Top Instruments */}
                      <div style={{
                        background: isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.02)',
                        border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.06)',
                        borderRadius: '14px',
                        padding: '20px'
                      }}>
                        <h4 style={{ margin: '0 0 14px', fontSize: '0.94rem', fontWeight: '800', color: isLight ? '#0f172a' : '#ffffff' }}>
                          Traded Instruments Breakdown
                        </h4>

                        {!deepData?.performance?.instruments || deepData.performance.instruments.length === 0 ? (
                          <p style={{ margin: 0, fontSize: '0.84rem', color: '#94a3b8' }}>No trade data to analyze.</p>
                        ) : (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                            {deepData.performance.instruments.map((ins) => (
                              <div
                                key={ins.instrument}
                                style={{
                                  padding: '12px 14px',
                                  borderRadius: '10px',
                                  background: isLight ? '#ffffff' : 'rgba(255, 255, 255, 0.03)',
                                  border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255, 255, 255, 0.06)'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                                  <strong style={{ color: 'var(--accent-cyan)', fontSize: '0.92rem' }}>{ins.instrument}</strong>
                                  <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>{ins.tradesCount} trades</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                                  <span>Win Rate: <strong>{ins.winRate}%</strong></span>
                                  <span style={{ color: ins.totalPnL >= 0 ? 'var(--profit)' : '#ef4444', fontWeight: '700' }}>
                                    {ins.totalPnL >= 0 ? '+' : ''}${ins.totalPnL.toLocaleString()}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Sessions Breakdown */}
                      <div style={{
                        background: isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.02)',
                        border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.06)',
                        borderRadius: '14px',
                        padding: '20px'
                      }}>
                        <h4 style={{ margin: '0 0 14px', fontSize: '0.94rem', fontWeight: '800', color: isLight ? '#0f172a' : '#ffffff' }}>
                          Trading Sessions Activity
                        </h4>

                        {!deepData?.performance?.sessions || deepData.performance.sessions.length === 0 ? (
                          <p style={{ margin: 0, fontSize: '0.84rem', color: '#94a3b8' }}>No session data logged.</p>
                        ) : (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                            {deepData.performance.sessions.map((ses) => (
                              <div
                                key={ses.session}
                                style={{
                                  padding: '12px 14px',
                                  borderRadius: '10px',
                                  background: isLight ? '#ffffff' : 'rgba(255, 255, 255, 0.03)',
                                  border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255, 255, 255, 0.06)'
                                }}
                              >
                                <div style={{ fontWeight: '700', fontSize: '0.86rem', color: isLight ? '#0f172a' : '#ffffff' }}>
                                  {ses.session}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem', marginTop: '4px' }}>
                                  <span style={{ color: '#94a3b8' }}>{ses.tradesCount} trades</span>
                                  <span style={{ color: ses.totalPnL >= 0 ? 'var(--profit)' : '#ef4444', fontWeight: '700' }}>
                                    {ses.totalPnL >= 0 ? '+' : ''}${ses.totalPnL.toLocaleString()}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB 4: Platform Assets & MT5 */}
                  {modalTab === 'assets' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      {/* MT5 Accounts */}
                      <div style={{
                        background: isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.02)',
                        border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.06)',
                        borderRadius: '14px',
                        padding: '20px'
                      }}>
                        <h4 style={{ margin: '0 0 14px', fontSize: '0.94rem', fontWeight: '800', color: isLight ? '#0f172a' : '#ffffff' }}>
                          Connected MetaTrader 5 (MT5) Accounts
                        </h4>

                        {!deepData?.mt5Accounts || deepData.mt5Accounts.length === 0 ? (
                          <p style={{ margin: 0, fontSize: '0.84rem', color: '#94a3b8' }}>No MT5 accounts linked by this trader.</p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {deepData.mt5Accounts.map((mt) => (
                              <div
                                key={mt._id}
                                style={{
                                  padding: '12px 16px',
                                  borderRadius: '10px',
                                  background: isLight ? '#ffffff' : 'rgba(255, 255, 255, 0.03)',
                                  border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255, 255, 255, 0.06)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  flexWrap: 'wrap',
                                  gap: '10px'
                                }}
                              >
                                <div>
                                  <div style={{ fontWeight: '700', fontSize: '0.9rem', color: isLight ? '#0f172a' : '#ffffff' }}>
                                    {mt.serverName} • Login: {mt.login}
                                  </div>
                                  <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '2px' }}>
                                    Mode: <strong style={{ color: mt.tradeMode === 'live' ? 'var(--profit)' : 'var(--accent-cyan)' }}>{mt.tradeMode?.toUpperCase()}</strong> | Type: {mt.accountType} | Currency: {mt.currency}
                                  </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                  <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase' }}>Balance / Equity</div>
                                  <div style={{ fontWeight: '800', fontSize: '0.92rem', color: 'var(--profit)' }}>
                                    ${mt.balance?.toLocaleString()} / ${mt.equity?.toLocaleString()}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Goals & Challenge */}
                      <div style={{
                        background: isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.02)',
                        border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.06)',
                        borderRadius: '14px',
                        padding: '20px'
                      }}>
                        <h4 style={{ margin: '0 0 14px', fontSize: '0.94rem', fontWeight: '800', color: isLight ? '#0f172a' : '#ffffff' }}>
                          Prop Firm Challenge & Milestones
                        </h4>

                        {!deepData?.goal ? (
                          <p style={{ margin: 0, fontSize: '0.84rem', color: '#94a3b8' }}>Default milestone settings in use.</p>
                        ) : (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                            <div>
                              <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase' }}>Challenge Active</div>
                              <div style={{ fontWeight: '800', color: deepData.goal.isChallengeActive ? 'var(--profit)' : '#94a3b8', marginTop: '2px' }}>
                                {deepData.goal.isChallengeActive ? 'ACTIVE PROP CHALLENGE' : 'STANDARD GOAL'}
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase' }}>Account Size</div>
                              <div style={{ fontWeight: '800', marginTop: '2px' }}>${deepData.goal.accountSize?.toLocaleString()}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase' }}>Profit Target</div>
                              <div style={{ fontWeight: '800', color: 'var(--profit)', marginTop: '2px' }}>${deepData.goal.profitTarget?.toLocaleString()}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase' }}>Max Loss Limit</div>
                              <div style={{ fontWeight: '800', color: '#ef4444', marginTop: '2px' }}>${deepData.goal.maxLoss?.toLocaleString()}</div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer / Actions */}
            <div style={{
              padding: '18px 28px',
              borderTop: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.08)',
              background: isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.02)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.78rem', color: isLight ? '#64748b' : '#94a3b8', fontWeight: '700' }}>Change Role:</span>
                <select
                  value={deepData?.user?.role || selectedTrader.role}
                  disabled={updatingId === selectedTrader.id || selectedTrader.userId === '@sumansingh9458'}
                  onChange={(e) => handleRoleChange(selectedTrader.id, e.target.value)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '0.78rem',
                    fontWeight: '800',
                    border: '1px solid var(--border-medium)',
                    background: isLight ? '#ffffff' : '#1e293b',
                    color: isLight ? '#0f172a' : '#ffffff',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="admin">ADMIN</option>
                  <option value="pro">PRO TIER</option>
                  <option value="user">STANDARD</option>
                  <option value="demo">DEMO</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '8px',
                    border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255, 255, 255, 0.15)',
                    background: isLight ? '#ffffff' : 'rgba(255, 255, 255, 0.05)',
                    color: isLight ? '#1e293b' : '#ffffff',
                    fontSize: '0.82rem',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
