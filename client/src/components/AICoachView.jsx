import React, { useState, useEffect } from 'react';
import { Bot, Send, Sparkles, CheckCircle2, AlertOctagon, RefreshCw, Key, Copy, Check, ExternalLink } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

export const AICoachView = () => {
  const { user, updateUserSettings } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [ruleCoach, setRuleCoach] = useState(null);
  const [loadingRule, setLoadingRule] = useState(true);

  // Live chat state
  const [question, setQuestion] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [isAsking, setIsAsking] = useState(false);
  const [provider, setProvider] = useState(isAdmin ? (user?.settings?.aiProvider || 'gemini') : 'gemini');
  const [geminiKey, setGeminiKey] = useState(user?.settings?.geminiApiKey || '');
  const [openAiKey, setOpenAiKey] = useState(user?.settings?.aiApiKey || '');
  const [model, setModel] = useState(
    (!isAdmin || !user?.settings?.aiModel || user?.settings?.aiModel?.startsWith('gpt'))
      ? 'gemini-3.8-flash'
      : (user?.settings?.aiModel || 'gemini-3.8-flash')
  );
  const [saveKeyNotice, setSaveKeyNotice] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);

  useEffect(() => {
    loadRuleCoach();
  }, []);

  useEffect(() => {
    if (user?.settings) {
      if (isAdmin && user.settings.aiProvider) {
        setProvider(user.settings.aiProvider);
      } else {
        setProvider('gemini');
      }

      if (user.settings.geminiApiKey !== undefined) setGeminiKey(user.settings.geminiApiKey);
      if (user.settings.aiApiKey !== undefined) setOpenAiKey(user.settings.aiApiKey);

      if (user.settings.aiModel) {
        if (!isAdmin && user.settings.aiModel.startsWith('gpt')) {
          setModel('gemini-3.8-flash');
        } else {
          setModel(user.settings.aiModel);
        }
      }
    }
  }, [user, isAdmin]);

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

    const activeProvider = !isAdmin ? 'gemini' : (model.startsWith('gemini') ? 'gemini' : provider);
    const activeModel = (!isAdmin && model.startsWith('gpt')) ? 'gemini-3.8-flash' : model;

    try {
      const res = await api.askAiCoach({
        question: userQ,
        userProvider: activeProvider,
        userApiKey: isAdmin ? (activeProvider === 'gemini' ? geminiKey : openAiKey) : undefined,
        userModel: activeModel
      });

      setChatHistory(prev => [
        ...prev,
        {
          sender: 'ai',
          text: res.answer || 'No response returned.',
          model: res.model,
          provider: res.provider
        }
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
    await updateUserSettings({
      aiProvider: provider,
      geminiApiKey: geminiKey,
      aiApiKey: openAiKey,
      aiModel: model
    });
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
      {/* Grounded Rule-Based Institutional AI Audit (Admin only) */}
      {isAdmin && (
        <div className="dashboard-panel">
          {loadingRule ? (
            <p style={{ color: 'var(--text-muted)', padding: '24px', textAlign: 'center' }}>Auditing trading records...</p>
          ) : !ruleCoach ? (
            <p style={{ color: 'var(--text-muted)', padding: '24px', textAlign: 'center' }}>Not enough data yet. Log more trades to unlock the audit.</p>
          ) : (
            <div style={{ display: 'grid', gap: '18px' }}>
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
      )}

      {/* Live AI Coach Chat */}
      <div className="dashboard-panel">
        <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={20} color="var(--accent-cyan)" />
            <h3 style={{ margin: 0 }}>AI Coach</h3>
            {isAdmin && (
              <span className={`badge ${provider === 'gemini' ? 'badge-win' : 'badge-be'}`} style={{ fontSize: '0.72rem' }}>
                {provider === 'gemini' ? '👑 Admin (Gemini)' : '👑 Admin (OpenAI)'}
              </span>
            )}
          </div>

          {/* Model Choose Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: '700', whiteSpace: 'nowrap' }}>Choose Model:</span>
            <select
              value={model}
              onChange={async (e) => {
                const newModel = e.target.value;
                setModel(newModel);
                try {
                  await updateUserSettings({ aiModel: newModel });
                } catch (err) {}
              }}
              style={{
                minWidth: '220px',
                padding: '7px 12px',
                fontSize: '0.82rem',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-input)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-medium)',
                cursor: 'pointer'
              }}
            >
              <option value="gemini-3.8-flash">⚡ gemini-3.8-flash (Recommended)</option>
              <option value="gemini-3.8-pro">🧠 gemini-3.8-pro (Deep Reasoning)</option>
              <option value="gemini-3.5-flash">⚡ gemini-3.5-flash (High Speed)</option>
              <option value="auto">🔄 Auto-Detect</option>
              {isAdmin && provider === 'openai' && (
                <>
                  <option value="gpt-4o-mini">gpt-4o-mini</option>
                  <option value="gpt-4o">gpt-4o</option>
                </>
              )}
            </select>
          </div>
        </div>

        {/* ADMIN ONLY: Global API Key & Engine Config */}
        {isAdmin && (
          <div style={{ background: 'rgba(6, 12, 20, 0.75)', border: '1px solid rgba(245, 158, 11, 0.35)', borderRadius: 'var(--radius-md)', padding: '16px', marginBottom: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: '0.62rem',
                  fontWeight: '900',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  letterSpacing: '0.06em',
                  background: 'rgba(245, 158, 11, 0.2)',
                  color: '#f59e0b',
                  border: '1px solid rgba(245, 158, 11, 0.45)'
                }}>
                  ADMIN SETTINGS
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: '700' }}>AI ENGINE:</span>
                <button
                  type="button"
                  className={provider === 'gemini' ? 'btn-primary' : 'btn-secondary'}
                  onClick={() => {
                    setProvider('gemini');
                    if (!model.startsWith('gemini') && model !== 'auto') setModel('gemini-3.8-flash');
                  }}
                  style={{ fontSize: '0.78rem', padding: '5px 12px', borderRadius: 'var(--radius-pill)', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                >
                  <Sparkles size={12} /> Google Gemini (Free)
                </button>
                <button
                  type="button"
                  className={provider === 'openai' ? 'btn-primary' : 'btn-secondary'}
                  onClick={() => {
                    setProvider('openai');
                    if (model.startsWith('gemini')) setModel('gpt-4o-mini');
                  }}
                  style={{ fontSize: '0.78rem', padding: '5px 12px', borderRadius: 'var(--radius-pill)' }}
                >
                  OpenAI (GPT-4o)
                </button>
              </div>

              {provider === 'gemini' && (
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    fontSize: '0.78rem',
                    color: 'var(--accent-cyan)',
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontWeight: '600',
                    background: 'rgba(0, 210, 255, 0.08)',
                    padding: '5px 11px',
                    borderRadius: '6px',
                    border: '1px solid rgba(0, 210, 255, 0.25)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  ✨ Get 100% Free Gemini API Key <ExternalLink size={12} />
                </a>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '14px', alignItems: 'end' }}>
              <label>
                <span>{provider === 'gemini' ? 'Google Gemini API Key (Global for all users)' : 'OpenAI API Key (Global for all users)'}</span>
                <input
                  type="password"
                  placeholder={provider === 'gemini' ? 'AIzaSy... (Paste free Gemini key)' : 'sk-proj-...'}
                  value={provider === 'gemini' ? geminiKey : openAiKey}
                  onChange={e => provider === 'gemini' ? setGeminiKey(e.target.value) : setOpenAiKey(e.target.value)}
                />
              </label>
              <button className="btn-secondary" onClick={saveSettings} style={{ height: '42px', whiteSpace: 'nowrap' }}>
                <Key size={14} />
                <span>{saveKeyNotice ? 'Key Saved!' : 'Save Key'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Chat History Container */}
        <div style={{ maxHeight: '420px', minHeight: chatHistory.length > 0 ? '120px' : 'auto', overflowY: 'auto', display: 'grid', gap: '14px', marginBottom: '18px', paddingRight: '6px' }}>
          {chatHistory.length === 0 ? null : (
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
