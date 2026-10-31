import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Bug,
  Sparkles,
  RotateCcw,
  Search,
  Filter,
  Trash2,
  CheckCircle,
  Clock,
  AlertCircle,
  User,
  Shield,
  ExternalLink,
  ChevronDown
} from 'lucide-react';
import { api } from '../services/api';

export const FeedbackResponsesView = ({ theme }) => {
  const isLight = theme === 'light' || (typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light');
  const [feedbacks, setFeedbacks] = useState([]);
  const [stats, setStats] = useState({ total: 0, bugs: 0, feedback: 0, newCount: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterType, setFilterType] = useState('ALL'); // 'ALL' | 'Bug' | 'Feedback' | 'New' | 'Resolved'
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingId, setUpdatingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const fetchFeedbacks = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getFeedbacks();
      if (res?.success) {
        setFeedbacks(res.feedbacks || []);
        if (res.stats) {
          setStats(res.stats);
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to load feedback responses. Please verify admin privileges.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeedbacks();
  }, []);

  const handleStatusChange = async (id, newStatus) => {
    setUpdatingId(id);
    try {
      await api.updateFeedbackStatus(id, { status: newStatus });
      setFeedbacks(prev =>
        prev.map(f => (f._id === id ? { ...f, status: newStatus } : f))
      );
      // Update local stat counts
      setStats(prev => ({
        ...prev,
        newCount: feedbacks.filter(f => (f._id === id ? newStatus === 'New' : f.status === 'New')).length
      }));
    } catch (err) {
      alert('Failed to update status: ' + (err.message || 'Unknown error'));
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to permanently delete this feedback submission?')) {
      return;
    }
    setDeletingId(id);
    try {
      await api.deleteFeedback(id);
      setFeedbacks(prev => prev.filter(f => f._id !== id));
      setStats(prev => ({
        ...prev,
        total: Math.max(0, prev.total - 1)
      }));
    } catch (err) {
      alert('Failed to delete feedback: ' + (err.message || 'Unknown error'));
    } finally {
      setDeletingId(null);
    }
  };

  // Filter & Search Logic
  const filteredFeedbacks = feedbacks.filter((item) => {
    // Type/Status filter
    if (filterType === 'Bug' && item.type !== 'Bug') return false;
    if (filterType === 'Feedback' && item.type !== 'Feedback') return false;
    if (filterType === 'New' && item.status !== 'New') return false;
    if (filterType === 'Resolved' && item.status !== 'Resolved') return false;

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchMsg = item.message?.toLowerCase().includes(q);
      const matchUser = item.userName?.toLowerCase().includes(q);
      const matchHandle = item.userHandle?.toLowerCase().includes(q);
      const matchEmail = item.userEmail?.toLowerCase().includes(q);
      const matchPage = item.page?.toLowerCase().includes(q);
      return matchMsg || matchUser || matchHandle || matchEmail || matchPage;
    }
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '60px' }}>
      {/* Header Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px',
          background: isLight
            ? '#ffffff'
            : 'linear-gradient(135deg, rgba(13, 23, 38, 0.8) 0%, rgba(9, 19, 31, 0.95) 100%)',
          border: isLight ? '1px solid #cbd5e1' : '1px solid var(--border-medium)',
          borderRadius: '16px',
          padding: '22px 26px',
          boxShadow: isLight
            ? '0 4px 18px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.03)'
            : 'var(--shadow-card)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: isLight ? 'rgba(245, 158, 11, 0.12)' : 'rgba(245, 158, 11, 0.15)',
              border: isLight ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid rgba(245, 158, 11, 0.35)',
              display: 'grid',
              placeItems: 'center',
              color: isLight ? '#d97706' : '#f59e0b'
            }}
          >
            <Shield size={24} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
              <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: isLight ? '#0f172a' : 'var(--text-white)' }}>
                Feedback & Bug Responses
              </h2>
              <span
                style={{
                  fontSize: '0.62rem',
                  fontWeight: 900,
                  letterSpacing: '0.06em',
                  background: isLight ? 'rgba(245, 158, 11, 0.15)' : 'rgba(245, 158, 11, 0.2)',
                  color: isLight ? '#b45309' : '#f59e0b',
                  border: isLight ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid rgba(245, 158, 11, 0.4)',
                  padding: '2px 7px',
                  borderRadius: '4px'
                }}
              >
                ADMIN DESK
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '0.82rem', color: isLight ? '#64748b' : 'var(--text-secondary)' }}>
              Live submissions from traders across all devices, with instant status tracking and issue resolution
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchFeedbacks}
          disabled={loading}
          className="btn-secondary"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.82rem',
            padding: '8px 14px',
            borderRadius: '8px',
            cursor: 'pointer',
            background: isLight ? '#ffffff' : undefined,
            color: isLight ? '#0f172a' : undefined,
            border: isLight ? '1px solid #cbd5e1' : undefined
          }}
        >
          <RotateCcw size={14} className={loading ? 'spin' : ''} />
          <span>Refresh Desk</span>
        </button>
      </div>

      {/* KPI Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
        <div
          style={{
            background: isLight ? '#ffffff' : 'linear-gradient(180deg, rgba(16, 28, 44, 0.6) 0%, rgba(10, 18, 28, 0.85) 100%)',
            border: isLight ? '1px solid #cbd5e1' : '1px solid var(--border-subtle)',
            borderRadius: '12px',
            boxShadow: isLight ? '0 2px 10px rgba(15, 23, 42, 0.04)' : 'var(--shadow-card)',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px'
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: isLight ? 'rgba(2, 132, 199, 0.1)' : 'rgba(0, 210, 255, 0.12)',
              border: isLight ? '1px solid rgba(2, 132, 199, 0.25)' : '1px solid rgba(0, 210, 255, 0.3)',
              display: 'grid',
              placeItems: 'center',
              color: isLight ? '#0284c7' : 'var(--accent-cyan)'
            }}
          >
            <MessageSquare size={20} />
          </div>
          <div>
            <span style={{ fontSize: '0.74rem', color: isLight ? '#64748b' : 'var(--text-secondary)', fontWeight: 600 }}>Total Submissions</span>
            <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: isLight ? '#0f172a' : 'var(--text-white)' }}>{stats.total}</h3>
          </div>
        </div>

        <div
          style={{
            background: isLight ? '#ffffff' : 'linear-gradient(180deg, rgba(16, 28, 44, 0.6) 0%, rgba(10, 18, 28, 0.85) 100%)',
            border: isLight ? '1px solid #cbd5e1' : '1px solid var(--border-subtle)',
            borderRadius: '12px',
            boxShadow: isLight ? '0 2px 10px rgba(15, 23, 42, 0.04)' : 'var(--shadow-card)',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px'
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: isLight ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.12)',
              border: isLight ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid rgba(239, 68, 68, 0.3)',
              display: 'grid',
              placeItems: 'center',
              color: isLight ? '#dc2626' : '#ff6685'
            }}
          >
            <Bug size={20} />
          </div>
          <div>
            <span style={{ fontSize: '0.74rem', color: isLight ? '#64748b' : 'var(--text-secondary)', fontWeight: 600 }}>Bug Reports</span>
            <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: isLight ? '#dc2626' : '#ff6685' }}>{stats.bugs}</h3>
          </div>
        </div>

        <div
          style={{
            background: isLight ? '#ffffff' : 'linear-gradient(180deg, rgba(16, 28, 44, 0.6) 0%, rgba(10, 18, 28, 0.85) 100%)',
            border: isLight ? '1px solid #cbd5e1' : '1px solid var(--border-subtle)',
            borderRadius: '12px',
            boxShadow: isLight ? '0 2px 10px rgba(15, 23, 42, 0.04)' : 'var(--shadow-card)',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px'
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: isLight ? 'rgba(16, 185, 129, 0.1)' : 'rgba(0, 245, 155, 0.12)',
              border: isLight ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(0, 245, 155, 0.3)',
              display: 'grid',
              placeItems: 'center',
              color: isLight ? '#059669' : 'var(--profit)'
            }}
          >
            <Sparkles size={20} />
          </div>
          <div>
            <span style={{ fontSize: '0.74rem', color: isLight ? '#64748b' : 'var(--text-secondary)', fontWeight: 600 }}>Feature Feedbacks</span>
            <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: isLight ? '#059669' : 'var(--profit)' }}>{stats.feedback}</h3>
          </div>
        </div>

        <div
          style={{
            background: isLight ? '#ffffff' : 'linear-gradient(180deg, rgba(16, 28, 44, 0.6) 0%, rgba(10, 18, 28, 0.85) 100%)',
            border: isLight ? '1px solid #cbd5e1' : '1px solid var(--border-subtle)',
            borderRadius: '12px',
            boxShadow: isLight ? '0 2px 10px rgba(15, 23, 42, 0.04)' : 'var(--shadow-card)',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px'
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: isLight ? 'rgba(245, 158, 11, 0.1)' : 'rgba(245, 158, 11, 0.12)',
              border: isLight ? '1px solid rgba(245, 158, 11, 0.25)' : '1px solid rgba(245, 158, 11, 0.3)',
              display: 'grid',
              placeItems: 'center',
              color: isLight ? '#d97706' : '#f59e0b'
            }}
          >
            <Clock size={20} />
          </div>
          <div>
            <span style={{ fontSize: '0.74rem', color: isLight ? '#64748b' : 'var(--text-secondary)', fontWeight: 600 }}>Needs Review / New</span>
            <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: isLight ? '#d97706' : '#f59e0b' }}>{stats.newCount}</h3>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          background: isLight ? '#ffffff' : 'rgba(12, 22, 34, 0.72)',
          border: isLight ? '1px solid #cbd5e1' : '1px solid var(--border-medium)',
          borderRadius: '12px',
          boxShadow: isLight ? '0 2px 10px rgba(15, 23, 42, 0.04)' : 'var(--shadow-card)',
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {[
            { id: 'ALL', label: `All (${stats.total})` },
            { id: 'Bug', label: `🐛 Bugs (${stats.bugs})` },
            { id: 'Feedback', label: `💡 Feedback (${stats.feedback})` },
            { id: 'New', label: `⏳ New (${stats.newCount})` },
            { id: 'Resolved', label: `✓ Resolved` }
          ].map(tab => {
            const isActive = filterType === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterType(tab.id)}
                style={{
                  padding: '6px 13px',
                  borderRadius: '7px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  border: isActive
                    ? (isLight ? '1px solid #0284c7' : '1px solid var(--accent-cyan)')
                    : (isLight ? '1px solid #e2e8f0' : '1px solid var(--border-medium)'),
                  background: isActive
                    ? (isLight ? '#0284c7' : 'var(--accent-cyan)')
                    : (isLight ? '#f1f5f9' : 'rgba(255, 255, 255, 0.03)'),
                  color: isActive
                    ? (isLight ? '#ffffff' : '#060c14')
                    : (isLight ? '#475569' : 'var(--text-secondary)'),
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div style={{ position: 'relative', minWidth: '240px', flex: 1, maxWidth: '360px' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: isLight ? '#64748b' : 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search by user, message, page..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 32px',
              fontSize: '0.8rem',
              background: isLight ? '#f8fafc' : '#060c14',
              border: isLight ? '1px solid #cbd5e1' : '1px solid var(--border-medium)',
              borderRadius: '7px',
              color: isLight ? '#0f172a' : 'var(--text-white)',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>
      </div>

      {/* Error Notice */}
      {error && (
        <div style={{ background: 'var(--loss-soft)', border: '1px solid var(--loss)', padding: '12px 16px', borderRadius: '8px', color: isLight ? '#dc2626' : '#ff6685', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Feedbacks List */}
      {loading ? (
        <div
          style={{
            background: isLight ? '#ffffff' : 'rgba(12, 22, 34, 0.72)',
            border: isLight ? '1px solid #cbd5e1' : '1px solid var(--border-medium)',
            borderRadius: '12px',
            boxShadow: isLight ? '0 2px 10px rgba(15, 23, 42, 0.04)' : 'var(--shadow-card)',
            padding: '60px 20px',
            textAlign: 'center'
          }}
        >
          <div className="spin" style={{ width: '32px', height: '32px', border: '3px solid rgba(0, 245, 155, 0.2)', borderTopColor: isLight ? '#059669' : 'var(--profit)', borderRadius: '50%', margin: '0 auto 12px' }} />
          <p style={{ color: isLight ? '#64748b' : 'var(--text-muted)', fontSize: '0.84rem' }}>Loading trader feedback desk...</p>
        </div>
      ) : filteredFeedbacks.length === 0 ? (
        <div
          style={{
            background: isLight ? '#ffffff' : 'rgba(12, 22, 34, 0.72)',
            border: isLight ? '1px solid #cbd5e1' : '1px solid var(--border-medium)',
            borderRadius: '12px',
            boxShadow: isLight ? '0 2px 10px rgba(15, 23, 42, 0.04)' : 'var(--shadow-card)',
            padding: '60px 20px',
            textAlign: 'center'
          }}
        >
          <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: isLight ? '#f1f5f9' : 'rgba(255, 255, 255, 0.04)', display: 'grid', placeItems: 'center', margin: '0 auto 12px', color: isLight ? '#64748b' : 'var(--text-muted)' }}>
            <MessageSquare size={24} />
          </div>
          <h4 style={{ margin: '0 0 6px 0', fontSize: '1rem', color: isLight ? '#0f172a' : 'var(--text-white)' }}>No Submissions Found</h4>
          <p style={{ margin: 0, fontSize: '0.8rem', color: isLight ? '#64748b' : 'var(--text-secondary)' }}>
            {searchQuery ? 'No feedback matches your search criteria.' : 'No feedback or bug reports submitted in this category yet.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '14px' }}>
          {filteredFeedbacks.map((item) => {
            const isBug = item.type === 'Bug';
            const createdDate = new Date(item.createdAt);
            const formattedTime = createdDate.toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });

            return (
              <div
                key={item._id}
                style={{
                  background: isLight ? '#ffffff' : 'rgba(12, 22, 34, 0.72)',
                  border: isLight ? '1px solid #cbd5e1' : '1px solid var(--border-medium)',
                  borderLeft: `4px solid ${isBug ? (isLight ? '#ef4444' : '#ff4d6d') : (isLight ? '#059669' : 'var(--profit)')}`,
                  borderRadius: '12px',
                  boxShadow: isLight ? '0 2px 10px rgba(15, 23, 42, 0.04)' : 'var(--shadow-card)',
                  padding: '20px 22px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  transition: 'transform 0.15s ease'
                }}
              >
                {/* Top Row: User Meta + Type Badge + Timestamp */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '50%',
                        background: isBug
                          ? (isLight ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.15)')
                          : (isLight ? 'rgba(16, 185, 129, 0.1)' : 'rgba(0, 245, 155, 0.15)'),
                        border: `1px solid ${
                          isBug
                            ? (isLight ? 'rgba(239, 68, 68, 0.25)' : 'rgba(239, 68, 68, 0.3)')
                            : (isLight ? 'rgba(16, 185, 129, 0.25)' : 'rgba(0, 245, 155, 0.3)')
                        }`,
                        display: 'grid',
                        placeItems: 'center',
                        color: isBug ? (isLight ? '#dc2626' : '#ff6685') : (isLight ? '#059669' : 'var(--profit)'),
                        fontWeight: 800,
                        fontSize: '0.85rem'
                      }}
                    >
                      {item.userName ? item.userName.charAt(0).toUpperCase() : <User size={14} />}
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.9rem', color: isLight ? '#0f172a' : 'var(--text-white)' }}>
                          {item.userName || 'Anonymous Trader'}
                        </span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: isLight ? '#0284c7' : 'var(--accent-cyan)' }}>
                          {item.userHandle || '@trader'}
                        </span>
                        {item.userEmail && (
                          <span style={{ fontSize: '0.72rem', color: isLight ? '#64748b' : 'var(--text-muted)' }}>
                            • {item.userEmail}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: isLight ? '#64748b' : 'var(--text-secondary)', marginTop: '2px' }}>
                        Submitted from: <span style={{ color: isLight ? '#0f172a' : 'var(--text-white)', fontWeight: 600 }}>{item.page || 'Overview'}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {/* Type Badge */}
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        padding: '3px 9px',
                        borderRadius: '6px',
                        background: isBug
                          ? (isLight ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.15)')
                          : (isLight ? 'rgba(16, 185, 129, 0.1)' : 'rgba(0, 245, 155, 0.15)'),
                        border: `1px solid ${
                          isBug
                            ? (isLight ? 'rgba(239, 68, 68, 0.25)' : 'rgba(239, 68, 68, 0.35)')
                            : (isLight ? 'rgba(16, 185, 129, 0.25)' : 'rgba(0, 245, 155, 0.35)')
                        }`,
                        color: isBug ? (isLight ? '#b91c1c' : '#ff6685') : (isLight ? '#047857' : 'var(--profit)'),
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}
                    >
                      {isBug ? <Bug size={12} /> : <Sparkles size={12} />}
                      <span>{isBug ? 'Bug Report' : 'Feature Feedback'}</span>
                    </span>

                    {/* Timestamp */}
                    <span style={{ fontSize: '0.74rem', color: isLight ? '#64748b' : 'var(--text-muted)' }}>
                      {formattedTime}
                    </span>
                  </div>
                </div>

                {/* Message Body */}
                <div
                  style={{
                    background: isLight ? '#f8fafc' : 'rgba(6, 12, 20, 0.7)',
                    border: isLight ? '1px solid #e2e8f0' : '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    padding: '14px 16px',
                    fontSize: '0.86rem',
                    lineHeight: 1.55,
                    color: isLight ? '#1e293b' : '#e2e8f0',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}
                >
                  {item.message}
                </div>

                {/* Bottom Row: Status Selector & Admin Actions */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '10px',
                    paddingTop: '6px',
                    borderTop: isLight ? '1px solid #f1f5f9' : '1px solid var(--border-subtle)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '0.74rem', color: isLight ? '#64748b' : 'var(--text-secondary)', fontWeight: 600 }}>
                      Status:
                    </span>
                    <select
                      value={item.status}
                      disabled={updatingId === item._id}
                      onChange={(e) => handleStatusChange(item._id, e.target.value)}
                      style={{
                        padding: '4px 10px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        borderRadius: '6px',
                        background:
                          item.status === 'Resolved'
                            ? (isLight ? 'rgba(16, 185, 129, 0.1)' : 'rgba(0, 245, 155, 0.12)')
                            : item.status === 'In Review'
                            ? (isLight ? 'rgba(2, 132, 199, 0.1)' : 'rgba(0, 210, 255, 0.12)')
                            : (isLight ? 'rgba(245, 158, 11, 0.1)' : 'rgba(245, 158, 11, 0.12)'),
                        border:
                          item.status === 'Resolved'
                            ? `1px solid ${isLight ? 'rgba(16, 185, 129, 0.35)' : 'rgba(0, 245, 155, 0.4)'}`
                            : item.status === 'In Review'
                            ? `1px solid ${isLight ? 'rgba(2, 132, 199, 0.35)' : 'rgba(0, 210, 255, 0.4)'}`
                            : `1px solid ${isLight ? 'rgba(245, 158, 11, 0.35)' : 'rgba(245, 158, 11, 0.4)'}`,
                        color:
                          item.status === 'Resolved'
                            ? (isLight ? '#047857' : 'var(--profit)')
                            : item.status === 'In Review'
                            ? (isLight ? '#0284c7' : 'var(--accent-cyan)')
                            : (isLight ? '#b45309' : '#f59e0b'),
                        cursor: 'pointer',
                        outline: 'none'
                      }}
                    >
                      <option value="New" style={{ background: isLight ? '#ffffff' : '#09131f', color: isLight ? '#b45309' : '#f59e0b' }}>⏳ New (Pending)</option>
                      <option value="In Review" style={{ background: isLight ? '#ffffff' : '#09131f', color: isLight ? '#0284c7' : 'var(--accent-cyan)' }}>🔍 In Review</option>
                      <option value="Resolved" style={{ background: isLight ? '#ffffff' : '#09131f', color: isLight ? '#047857' : 'var(--profit)' }}>✓ Resolved</option>
                    </select>
                    {updatingId === item._id && (
                      <span style={{ fontSize: '0.72rem', color: isLight ? '#64748b' : 'var(--text-muted)' }}>Saving...</span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDelete(item._id)}
                    disabled={deletingId === item._id}
                    className="btn-ghost"
                    style={{
                      padding: '4px 8px',
                      fontSize: '0.74rem',
                      color: isLight ? '#dc2626' : 'var(--loss)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                    title="Delete submission"
                  >
                    <Trash2 size={13} />
                    <span>{deletingId === item._id ? 'Deleting...' : 'Delete'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
