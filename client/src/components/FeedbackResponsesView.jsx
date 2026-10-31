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

export const FeedbackResponsesView = () => {
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
          background: 'linear-gradient(135deg, rgba(13, 23, 38, 0.8) 0%, rgba(9, 19, 31, 0.95) 100%)',
          border: '1px solid var(--border-medium)',
          borderRadius: 'var(--radius-lg)',
          padding: '22px 26px',
          boxShadow: 'var(--shadow-card)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: 'rgba(245, 158, 11, 0.15)',
              border: '1px solid rgba(245, 158, 11, 0.35)',
              display: 'grid',
              placeItems: 'center',
              color: '#f59e0b'
            }}
          >
            <Shield size={24} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
              <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-white)' }}>
                Feedback & Bug Responses
              </h2>
              <span
                style={{
                  fontSize: '0.62rem',
                  fontWeight: 900,
                  letterSpacing: '0.06em',
                  background: 'rgba(245, 158, 11, 0.2)',
                  color: '#f59e0b',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  padding: '2px 7px',
                  borderRadius: '4px'
                }}
              >
                ADMIN DESK
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Live submissions from traders across all devices, with instant status tracking and issue resolution
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchFeedbacks}
          disabled={loading}
          className="btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', padding: '8px 14px' }}
        >
          <RotateCcw size={14} className={loading ? 'spin' : ''} />
          <span>Refresh Desk</span>
        </button>
      </div>

      {/* KPI Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
        <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(0, 210, 255, 0.12)', border: '1px solid rgba(0, 210, 255, 0.3)', display: 'grid', placeItems: 'center', color: 'var(--accent-cyan)' }}>
            <MessageSquare size={20} />
          </div>
          <div>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Total Submissions</span>
            <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-white)' }}>{stats.total}</h3>
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', display: 'grid', placeItems: 'center', color: '#ff6685' }}>
            <Bug size={20} />
          </div>
          <div>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Bug Reports</span>
            <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#ff6685' }}>{stats.bugs}</h3>
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(0, 245, 155, 0.12)', border: '1px solid rgba(0, 245, 155, 0.3)', display: 'grid', placeItems: 'center', color: 'var(--profit)' }}>
            <Sparkles size={20} />
          </div>
          <div>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Feature Feedbacks</span>
            <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: 'var(--profit)' }}>{stats.feedback}</h3>
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.3)', display: 'grid', placeItems: 'center', color: '#f59e0b' }}>
            <Clock size={20} />
          </div>
          <div>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Needs Review / New</span>
            <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#f59e0b' }}>{stats.newCount}</h3>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        className="card"
        style={{
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
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterType(tab.id)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '0.78rem',
                fontWeight: 700,
                border: filterType === tab.id ? '1px solid var(--accent-cyan)' : '1px solid var(--border-medium)',
                background: filterType === tab.id ? 'var(--accent-cyan)' : 'rgba(255, 255, 255, 0.03)',
                color: filterType === tab.id ? '#060c14' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div style={{ position: 'relative', minWidth: '240px', flex: 1, maxWidth: '360px' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search by user, message, page..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '7px 12px 7px 32px',
              fontSize: '0.8rem',
              background: '#060c14',
              border: '1px solid var(--border-medium)',
              borderRadius: '6px',
              color: 'var(--text-white)',
              outline: 'none'
            }}
          />
        </div>
      </div>

      {/* Error Notice */}
      {error && (
        <div style={{ background: 'var(--loss-soft)', border: '1px solid var(--loss)', padding: '12px 16px', borderRadius: '8px', color: '#ff6685', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Feedbacks List */}
      {loading ? (
        <div className="card" style={{ padding: '60px 20px', textAlign: 'center' }}>
          <div className="spin" style={{ width: '32px', height: '32px', border: '3px solid rgba(0, 245, 155, 0.2)', borderTopColor: 'var(--profit)', borderRadius: '50%', margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.84rem' }}>Loading trader feedback desk...</p>
        </div>
      ) : filteredFeedbacks.length === 0 ? (
        <div className="card" style={{ padding: '60px 20px', textAlign: 'center' }}>
          <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.04)', display: 'grid', placeItems: 'center', margin: '0 auto 12px', color: 'var(--text-muted)' }}>
            <MessageSquare size={24} />
          </div>
          <h4 style={{ margin: '0 0 6px 0', fontSize: '1rem', color: 'var(--text-white)' }}>No Submissions Found</h4>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
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
                className="card"
                style={{
                  padding: '20px 22px',
                  borderLeft: `4px solid ${isBug ? '#ef4444' : 'var(--profit)'}`,
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
                        background: isBug ? 'rgba(239, 68, 68, 0.15)' : 'rgba(0, 245, 155, 0.15)',
                        border: `1px solid ${isBug ? 'rgba(239, 68, 68, 0.3)' : 'rgba(0, 245, 155, 0.3)'}`,
                        display: 'grid',
                        placeItems: 'center',
                        color: isBug ? '#ff6685' : 'var(--profit)',
                        fontWeight: 800,
                        fontSize: '0.85rem'
                      }}
                    >
                      {item.userName ? item.userName.charAt(0).toUpperCase() : <User size={14} />}
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-white)' }}>
                          {item.userName || 'Anonymous Trader'}
                        </span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--accent-cyan)' }}>
                          {item.userHandle || '@trader'}
                        </span>
                        {item.userEmail && (
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            • {item.userEmail}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        Submitted from: <span style={{ color: 'var(--text-white)', fontWeight: 600 }}>{item.page || 'Overview'}</span>
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
                        background: isBug ? 'rgba(239, 68, 68, 0.15)' : 'rgba(0, 245, 155, 0.15)',
                        border: `1px solid ${isBug ? 'rgba(239, 68, 68, 0.35)' : 'rgba(0, 245, 155, 0.35)'}`,
                        color: isBug ? '#ff6685' : 'var(--profit)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}
                    >
                      {isBug ? <Bug size={12} /> : <Sparkles size={12} />}
                      <span>{isBug ? 'Bug Report' : 'Feature Feedback'}</span>
                    </span>

                    {/* Timestamp */}
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      {formattedTime}
                    </span>
                  </div>
                </div>

                {/* Message Body */}
                <div
                  style={{
                    background: 'rgba(6, 12, 20, 0.7)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    padding: '14px 16px',
                    fontSize: '0.86rem',
                    lineHeight: 1.55,
                    color: '#e2e8f0',
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
                    borderTop: '1px solid var(--border-subtle)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
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
                            ? 'rgba(0, 245, 155, 0.12)'
                            : item.status === 'In Review'
                            ? 'rgba(0, 210, 255, 0.12)'
                            : 'rgba(245, 158, 11, 0.12)',
                        border:
                          item.status === 'Resolved'
                            ? '1px solid rgba(0, 245, 155, 0.4)'
                            : item.status === 'In Review'
                            ? '1px solid rgba(0, 210, 255, 0.4)'
                            : '1px solid rgba(245, 158, 11, 0.4)',
                        color:
                          item.status === 'Resolved'
                            ? 'var(--profit)'
                            : item.status === 'In Review'
                            ? 'var(--accent-cyan)'
                            : '#f59e0b',
                        cursor: 'pointer',
                        outline: 'none'
                      }}
                    >
                      <option value="New" style={{ background: '#09131f', color: '#f59e0b' }}>⏳ New (Pending)</option>
                      <option value="In Review" style={{ background: '#09131f', color: 'var(--accent-cyan)' }}>🔍 In Review</option>
                      <option value="Resolved" style={{ background: '#09131f', color: 'var(--profit)' }}>✓ Resolved</option>
                    </select>
                    {updatingId === item._id && (
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Saving...</span>
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
                      color: 'var(--loss)',
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

