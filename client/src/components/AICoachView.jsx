import React, { useState, useEffect } from 'react';
import { Bot, Send, Sparkles, CheckCircle2, AlertOctagon, RefreshCw, Key, Copy, Check } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

export const AICoachView = () => {
  const { user, updateUserSettings } = useAuth();
  const [ruleCoach, setRuleCoach] = useState(null);
  const [loadingRule, setLoadingRule] = useState(true);

  // Live chat state
  const [question, setQuestion] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [isAsking, setIsAsking] = useState(false);
  const [apiKey, setApiKey] = useState(user?.settings?.aiApiKey || '');
  const [model, setModel] = useState(user?.settings?.aiModel || 'gpt-4o-mini');
  const [saveKeyNotice, setSaveKeyNotice] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);

  useEffect(() => {
    loadRuleCoach();
  }, []);

  const loadRuleCoach = async () => {
    try {
      setLoadingRule(true);
      const res = await api.getRuleBasedCoach();
      if (res.success && res.hasData) {
        setRuleCoach(res.data);
      }
    } catch (err) {
      console.error('Failed to load rule coach:', err);
    } finally {
      setLoadingRule(false);
    }
  };

  const handleAsk = async (e) => {
    e?.preventDefault();
    if (!question.trim() || isAsking) return;

    const userQ = question.trim();
    setQuestion('');
    setChatHistory(prev => [...prev, { sender: 'user', text: userQ }]);
    setIsAsking(true);

    try {
      const res = await api.askAiCoach({
        question: userQ,
        userApiKey: apiKey,
        userModel: model
      });

      setChatHistory(prev => [
        ...prev,
        { sender: 'ai', text: res.answer || 'No response returned.' }
      ]);
    } catch (err) {
      setChatHistory(prev => [
        ...prev,
        { sender: 'ai', text: `Error: ${err.message}` }
      ]);
    } finally {
      setIsAsking(false);
    }
  };

  const handleCopy = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const saveSettings = async () => {
    await updateUserSettings({ aiApiKey: apiKey, aiModel: model });
    setSaveKeyNotice(true);
    setTimeout(() => setSaveKeyNotice(false), 2500);
  };

  const quickPrompts = [
    'What is my single most costly mistake so far?',
    'Analyze my execution in the London vs New York session.',
    'How do I eliminate premature early exits based on my data?',
    'Give me a personalized pre-market checklist for tomorrow.'
  ];

  return (
    <div style={{ display: 'grid', gap: '24px' }}>
      {/* Grounded Rule-Based Institutional AI Audit */}
      <div className="dashboard-panel">
        {loadingRule ? (
          <p style={{ color: 'var(--text-muted)', padding: '24px', textAlign: 'center' }}>Auditing trading records...</p>
        ) : !ruleCoach ? (
          <p style={{ color: 'var(--text-muted)', padding: '24px', textAlign: 'center' }}>Not enough data yet. Log more trades to unlock the audit.</p>
        ) : (
          <div style={{ display: 'grid', gap: '18px' }}>
            {/* Quoted Stylish Performance Summary & Suggestion Box */}
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(0, 210, 255, 0.05) 0%, rgba(10, 18, 28, 0.7) 100%)',
                padding: '20px 22px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid rgba(0, 210, 255, 0.25)',
                borderLeft: '4px solid var(--accent-cyan)',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)'
              }}
            >
              <h4 style={{ fontSize: '0.78rem', color: 'var(--accent-cyan)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px', fontWeight: '800' }}>
                Statistical Expectation & Edge Diagnosis
              </h4>
              <p style={{ fontSize: '0.94rem', color: 'var(--text-white)', lineHeight: '1.65', fontStyle: 'italic', margin: 0 }}>
                “<strong>FACT:</strong> {ruleCoach.summary.totalTrades} trades audited, achieving a <strong>{ruleCoach.summary.winRate}% win rate</strong> with <strong>{ruleCoach.summary.totalR} total R</strong> (mean expectancy of {ruleCoach.summary.avgR}/trade).<br />
                <strong>PATTERN:</strong> {ruleCoach.summary.tone === 'positive' ? 'Positive mathematical expectancy demonstrated across trade sequence.' : 'Expectancy is currently negative due to risk drag or low win rate.'}”
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '18px' }}>
              {/* Strengths */}
              <div style={{ background: 'var(--bg-card)', padding: '18px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <h4 style={{ fontSize: '0.84rem', color: 'var(--profit)', textTransform: 'uppercase', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '800' }}>
                  <CheckCircle2 size={16} />
                  Verified Trading Strengths
                </h4>
                <ul style={{ paddingLeft: '18px', display: 'grid', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                  {ruleCoach.strengths.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>

              {/* Mistakes */}
              <div style={{ background: 'var(--bg-card)', padding: '18px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <h4 style={{ fontSize: '0.84rem', color: 'var(--loss)', textTransform: 'uppercase', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '800' }}>
                  <AlertOctagon size={16} />
                  Mistakes
                </h4>
                <ul style={{ paddingLeft: '18px', display: 'grid', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                  {ruleCoach.repeatedMistakes.length === 0 ? (
                    <li style={{ color: 'var(--profit)' }}>Zero repeated mistakes logged. Excellent discipline adherence!</li>
                  ) : (
                    ruleCoach.repeatedMistakes.map((m, i) => (
                      <li key={i}><strong>{m.name}:</strong> {m.count} logged occurrences</li>
                    ))
                  )}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Live AI Coach Chat (OpenAI GPT-4o Integration) */}
      <div className="dashboard-panel">
        <div className="panel-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={20} color="var(--accent-cyan)" />
              <h3>Conversational Institutional AI Coach (GPT-4o)</h3>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: '3px' }}>
              Direct conversational interrogation of your recent trades with anti-hallucination guardrails
            </p>
          </div>
        </div>

        {/* API Settings Config Toggle */}
        <div style={{ background: 'rgba(6, 12, 20, 0.7)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-md)', padding: '16px', marginBottom: '18px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px auto', gap: '14px', alignItems: 'end' }}>
            <label>
              <span>OpenAI API Key (Optional)</span>
              <input
                type="password"
                placeholder="sk-proj-... (Leave blank to use grounded offline coach)"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
              />
            </label>
            <label>
              <span>Selected AI Model</span>
              <select value={model} onChange={e => setModel(e.target.value)}>
                <option value="gpt-4o-mini">gpt-4o-mini (Fast & efficient)</option>
                <option value="gpt-4o">gpt-4o (Deep hedge-fund reasoning)</option>
                <option value="gpt-4.1-mini">gpt-4.1-mini</option>
              </select>
            </label>
            <button className="btn-secondary" onClick={saveSettings} style={{ height: '42px' }}>
              <Key size={14} />
              <span>{saveKeyNotice ? 'Key Saved!' : 'Save Key'}</span>
            </button>
          </div>
        </div>

        {/* Quick Prompt Chips */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '18px' }}>
          {quickPrompts.map((p, idx) => (
            <button
              key={idx}
              className="btn-secondary"
              style={{ fontSize: '0.78rem', padding: '6px 14px', borderRadius: 'var(--radius-pill)' }}
              onClick={() => { setQuestion(p); }}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Chat History Container */}
        <div style={{ maxHeight: '380px', overflowY: 'auto', display: 'grid', gap: '14px', marginBottom: '18px', paddingRight: '6px' }}>
          {chatHistory.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)', fontSize: '0.9rem', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-subtle)' }}>
              Ask any specific question about your trading execution, discipline, session timing, or setup statistics.
            </div>
          ) : (
            chatHistory.map((msg, i) => (
              <div
                key={i}
                style={{
                  alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                  background: msg.sender === 'user' ? 'linear-gradient(135deg, rgba(0, 245, 155, 0.15) 0%, rgba(0, 210, 255, 0.12) 100%)' : 'var(--bg-card)',
                  border: '1px solid',
                  borderColor: msg.sender === 'user' ? 'rgba(0, 245, 155, 0.35)' : 'var(--border-medium)',
                  borderRadius: '14px',
                  padding: '14px 18px',
                  maxWidth: '85%',
                  fontSize: '0.92rem',
                  lineHeight: '1.6',
                  whiteSpace: 'pre-wrap',
                  position: 'relative'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.72rem', color: msg.sender === 'user' ? 'var(--profit)' : 'var(--accent-cyan)', textTransform: 'uppercase', fontWeight: '800' }}>
                    {msg.sender === 'user' ? 'You (Trader)' : 'AI Institutional Coach'}
                  </span>
                  {msg.sender === 'ai' && (
                    <button
                      className="btn-ghost"
                      style={{ padding: '2px 6px', fontSize: '0.7rem' }}
                      onClick={() => handleCopy(msg.text, i)}
                      title="Copy advice"
                    >
                      {copiedIndex === i ? <Check size={12} color="var(--profit)" /> : <Copy size={12} />}
                    </button>
                  )}
                </div>
                {msg.text}
              </div>
            ))
          )}
          {isAsking && (
            <div style={{ color: 'var(--accent-cyan)', fontSize: '0.86rem', fontStyle: 'italic', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <RefreshCw size={14} className="spin" />
              AI Trading Coach is auditing your latest trades and formulating feedback...
            </div>
          )}
        </div>

        {/* Input Form */}
        <form onSubmit={handleAsk} style={{ display: 'flex', gap: '12px' }}>
          <input
            type="text"
            placeholder="Type your question for the AI Coach (e.g., What was my most disciplined setup?)..."
            value={question}
            onChange={e => setQuestion(e.target.value)}
            disabled={isAsking}
            style={{ borderRadius: 'var(--radius-sm)' }}
          />
          <button type="submit" className="btn-primary" disabled={isAsking || !question.trim()}>
            <Send size={16} />
            <span>Ask Coach</span>
          </button>
        </form>
      </div>
    </div>
  );
};
