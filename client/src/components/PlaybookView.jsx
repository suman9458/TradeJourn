import React, { useState, useEffect } from 'react';
import { BookOpen, Plus, Trash2, CheckCircle2, Shield, AlertCircle, Sparkles, CheckSquare } from 'lucide-react';
import { api } from '../services/api';

export const PlaybookView = () => {
  const [playbook, setPlaybook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newRule, setNewRule] = useState({ category: 'entryRules', text: '' });
  const [checkedRules, setCheckedRules] = useState({});

  useEffect(() => {
    loadPlaybook();
  }, []);

  const loadPlaybook = async () => {
    try {
      setLoading(true);
      const res = await api.getPlaybook();
      if (res.success) {
        setPlaybook(res.playbook);
      }
    } catch (err) {
      console.error('Failed to load playbook:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddRule = async (e) => {
    e.preventDefault();
    if (!newRule.text.trim()) return;

    const category = newRule.category;
    const currentList = playbook[category] || [];
    const updated = {
      ...playbook,
      [category]: [...currentList, newRule.text.trim()]
    };

    setPlaybook(updated);
    setNewRule({ ...newRule, text: '' });
    await api.updatePlaybook(updated);
  };

  const handleDeleteRule = async (category, index) => {
    const currentList = playbook[category] || [];
    const updatedList = currentList.filter((_, i) => i !== index);
    const updated = {
      ...playbook,
      [category]: updatedList
    };

    setPlaybook(updated);
    await api.updatePlaybook(updated);
  };

  const toggleCheck = (category, index) => {
    const key = `${category}-${index}`;
    setCheckedRules(prev => ({ ...prev, [key]: !prev[key] }));
  };

  if (loading || !playbook) {
    return (
      <div className="dashboard-panel">
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '30px' }}>Loading playbook rules...</p>
      </div>
    );
  }

  const sections = [
    { key: 'entryRules', title: 'Entry & Confirmation Protocols', icon: CheckCircle2, color: 'var(--profit)' },
    { key: 'riskRules', title: 'Capital Protection & Risk Limits', icon: Shield, color: 'var(--loss)' },
    { key: 'exitRules', title: 'Take Profit & Invalidation Rules', icon: AlertCircle, color: 'var(--warning)' },
    { key: 'psychologyRules', title: 'Trader Discipline & Mindset Rules', icon: Sparkles, color: 'var(--accent-purple)' }
  ];

  const totalRules = sections.reduce((acc, s) => acc + (playbook[s.key]?.length || 0), 0);
  const checkedCount = Object.values(checkedRules).filter(Boolean).length;

  return (
    <div style={{ display: 'grid', gap: '22px' }}>
      <div className="dashboard-panel">
        <div className="panel-header" style={{ flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BookOpen size={22} color="var(--profit)" />
              <h3>TRADING PLAYBOOK & SYSTEM OPERATING RULES</h3>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: '3px' }}>
              Your defined operational edge. Check rules off in real-time during your trading session.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.3)', padding: '6px 14px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border-medium)' }}>
            <CheckSquare size={16} color="var(--profit)" />
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Session Checklist:</span>
            <strong style={{ fontSize: '0.88rem', fontFamily: 'var(--font-mono)', color: 'var(--profit)' }}>
              {checkedCount}/{totalRules} Rules Active
            </strong>
          </div>
        </div>

        {/* Add Rule Form */}
        <form onSubmit={handleAddRule} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', background: 'rgba(6,12,20,0.6)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-medium)', marginBottom: '24px' }}>
          <select
            value={newRule.category}
            onChange={e => setNewRule({ ...newRule, category: e.target.value })}
          >
            <option value="entryRules">Entry Rule</option>
            <option value="riskRules">Risk Rule</option>
            <option value="exitRules">Exit Rule</option>
            <option value="psychologyRules">Psychology Rule</option>
          </select>
          <input
            type="text"
            placeholder="Type a new strict operating rule for your trading playbook..."
            value={newRule.text}
            onChange={e => setNewRule({ ...newRule, text: e.target.value })}
          />
          <button type="submit" className="btn-primary" style={{ padding: '0 18px' }}>
            <Plus size={16} />
            <span>Add Rule</span>
          </button>
        </form>

        {/* Playbook Rules Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          {sections.map(section => {
            const Icon = section.icon;
            const rules = playbook[section.key] || [];

            return (
              <div
                key={section.key}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: 'var(--radius-md)',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', paddingBottom: '10px', borderBottom: '1px solid var(--border-subtle)' }}>
                  <Icon size={18} color={section.color} />
                  <h4 style={{ fontSize: '0.92rem', color: '#fff', fontWeight: '800' }}>
                    {section.title}
                  </h4>
                </div>

                <div style={{ display: 'grid', gap: '10px', flex: 1 }}>
                  {rules.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No rules configured yet.</p>
                  ) : (
                    rules.map((rule, idx) => {
                      const isChecked = !!checkedRules[`${section.key}-${idx}`];
                      return (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            background: isChecked ? 'rgba(0, 245, 155, 0.08)' : 'rgba(255,255,255,0.02)',
                            border: '1px solid',
                            borderColor: isChecked ? 'rgba(0, 245, 155, 0.35)' : 'transparent',
                            transition: 'var(--transition-fast)'
                          }}
                        >
                          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', flex: 1, flexDirection: 'row' }}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleCheck(section.key, idx)}
                              style={{ width: 'auto', accentColor: 'var(--profit)' }}
                            />
                            <span style={{ fontSize: '0.88rem', color: isChecked ? 'var(--profit)' : 'var(--text-primary)', textDecoration: isChecked ? 'line-through' : 'none', fontWeight: isChecked ? '600' : '400' }}>
                              {rule}
                            </span>
                          </label>

                          <button
                            className="btn-ghost"
                            onClick={() => handleDeleteRule(section.key, idx)}
                            style={{ padding: '4px', color: 'var(--text-muted)' }}
                            title="Delete Rule"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
