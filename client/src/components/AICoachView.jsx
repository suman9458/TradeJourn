import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  Send,
  Trash2,
  Plus,
  MoreHorizontal,
  Copy,
  Check,
  Image as ImageIcon,
  X,
  Sparkles,
  CheckCircle2,
  AlertOctagon,
  RefreshCw,
  Key,
  ExternalLink,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

const cleanAiMessage = (text) => {
  if (!text) return '';
  return text
    .replace(/\(\s*([+-]?\d+(?:\.\d+)?R)\s*\/\s*\$0\s*\)/gi, '')
    .trim();
};

const parseInlineFormatting = (text) => {
  if (!text) return '';
  // Split on **bold** tokens and `code`
  const parts = text.split(/(\*\*[^*]+?\*\*|`[^`]+?`)/g);
  return parts.map((part, pIdx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={pIdx} className="ai-msg-bold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={pIdx} className="ai-msg-code">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
};

const renderFormattedMessage = (rawText, onSelectFollowup) => {
  if (!rawText) return null;
  const text = cleanAiMessage(rawText);
  const lines = text.split('\n');
  const elements = [];
  const followups = [];
  let inFollowupSection = false;

  lines.forEach((line, idx) => {
    const trimmed = line.trim();

    if (
      trimmed.includes('Suggested Follow-ups') ||
      trimmed.includes('Suggested Next Steps') ||
      trimmed.includes('Next Steps / Suggested Follow-ups') ||
      trimmed.includes('Quick Actions') ||
      trimmed.includes('Quick Prompts') ||
      trimmed.includes('Next Steps')
    ) {
      inFollowupSection = true;
      elements.push(
        <div key={`header-${idx}`} className="ai-followup-header">
          <span>💡</span>
          <span>{trimmed.replace(/^[💡\s*#]+/, '').replace(/\*\*/g, '')}</span>
        </div>
      );
      return;
    }

    if (inFollowupSection && (trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*'))) {
      const match = trimmed.match(/[•\-*]\s*[*"]*(.+?)[*"]*$/);
      if (match && match[1]) {
        const cleanPrompt = match[1].replace(/^["'*]+|["'*]+$/g, '').trim();
        if (cleanPrompt.length > 3) {
          followups.push(cleanPrompt);
        }
      }
    }

    elements.push(
      <div key={`line-${idx}`} className={`ai-msg-line ${!trimmed ? 'ai-msg-empty' : ''}`}>
        {parseInlineFormatting(line)}
      </div>
    );
  });

  return (
    <>
      <div className="ai-formatted-content">{elements}</div>
      {followups.length > 0 && onSelectFollowup && (
        <div className="ai-followup-container">
          {followups.map((prompt, fIdx) => (
            <button
              key={`fu-${fIdx}`}
              type="button"
              className="ai-followup-chip"
              onClick={() => onSelectFollowup(prompt)}
              title="Click to ask this question"
            >
              <span>💬</span>
              <span>{prompt}</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
};

const formatCurrentTime = () => {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(new Date());
};

export const AICoachView = ({ trades = [] }) => {
  const { user, updateUserSettings } = useAuth();
  const isAdmin = user?.role === 'admin';

  // Dynamic user-scoped identity without hardcoded personal name fallback
  const isGuest = !user || user.isGuest || user.role === 'guest';
  const displayName = user?.name || user?.username || (isGuest ? 'Guest Trader' : 'Trader');
  const firstName = isGuest ? 'Guest' : displayName.split(' ')[0];
  const userInitial = (isGuest ? 'G' : firstName).charAt(0).toUpperCase();

  // Dynamic storage key strictly isolated by user ID (prevents any cross-user or guest chat leakage)
  const userStorageKey = user?._id || user?.userId || user?.email
    ? `tradejourn_ai_chat_${user._id || user.userId || user.email}`
    : 'tradejourn_ai_chat_guest';

  const convStorageKey = user?._id || user?.userId || user?.email
    ? `tradejourn_ai_conv_${user._id || user.userId || user.email}`
    : 'tradejourn_ai_conv_guest';

  const [conversationId, setConversationId] = useState(() => {
    try {
      return localStorage.getItem(convStorageKey) || null;
    } catch {
      return null;
    }
  });

  // Chat conversation state isolated per user session
  const [chatHistory, setChatHistory] = useState(() => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('tradejourn_ai_chat_v3');
      }
      const saved = localStorage.getItem(userStorageKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Re-sync chat history when active user switches (login, logout, account switch)
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('tradejourn_ai_chat_v3');
      }
      const saved = localStorage.getItem(userStorageKey);
      setChatHistory(saved ? JSON.parse(saved) : []);
      const savedConv = localStorage.getItem(convStorageKey);
      setConversationId(savedConv || null);
    } catch {
      setChatHistory([]);
      setConversationId(null);
    }
  }, [userStorageKey, convStorageKey]);

  useEffect(() => {
    try {
      if (conversationId) {
        localStorage.setItem(convStorageKey, conversationId);
      } else {
        localStorage.removeItem(convStorageKey);
      }
    } catch {}
  }, [conversationId, convStorageKey]);

  const [question, setQuestion] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [attachedImage, setAttachedImage] = useState(null);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showAuditPanel, setShowAuditPanel] = useState(false);

  // Model & Provider settings
  const [provider, setProvider] = useState(isAdmin ? (user?.settings?.aiProvider || 'gemini') : 'gemini');
  const [geminiKey, setGeminiKey] = useState(user?.settings?.geminiApiKey || '');
  const [openAiKey, setOpenAiKey] = useState(user?.settings?.aiApiKey || '');
  const [model, setModel] = useState(
    (!isAdmin || !user?.settings?.aiModel || user?.settings?.aiModel?.startsWith('gpt') || user?.settings?.aiModel.includes('3.8') || user?.settings?.aiModel.includes('2.5'))
      ? 'gemini-2.0-flash'
      : (user?.settings?.aiModel || 'gemini-2.0-flash')
  );
  const [saveKeyNotice, setSaveKeyNotice] = useState(false);

  // Rule-based diagnostic audit state
  const [ruleCoach, setRuleCoach] = useState(null);
  const [loadingRule, setLoadingRule] = useState(false);

  const fileInputRef = useRef(null);
  const chatBottomRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem(userStorageKey, JSON.stringify(chatHistory));
    } catch (e) {
      console.warn('Failed to persist chat history:', e);
    }
  }, [chatHistory, userStorageKey]);

  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, isAsking]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (showAuditPanel && !ruleCoach) {
      loadRuleCoach();
    }
  }, [showAuditPanel]);

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

  const handleNewChat = async () => {
    if (chatHistory.length === 0 && !question.trim() && !attachedImage) return;
    if (chatHistory.length > 0) {
      if (!window.confirm('Start a new chat conversation?')) return;
    }
    if (conversationId) {
      try {
        await api.deleteAiConversation(conversationId);
      } catch {}
    }
    setConversationId(null);
    setChatHistory([]);
    setQuestion('');
    setAttachedImage(null);
    try {
      localStorage.removeItem(userStorageKey);
      localStorage.removeItem(convStorageKey);
    } catch {}
  };

  const handleClearChat = async () => {
    if (chatHistory.length === 0) return;
    if (window.confirm('Clear conversation history?')) {
      if (conversationId) {
        try {
          await api.deleteAiConversation(conversationId);
        } catch {}
      }
      setConversationId(null);
      setChatHistory([]);
      setQuestion('');
      setAttachedImage(null);
      try {
        localStorage.removeItem(userStorageKey);
        localStorage.removeItem(convStorageKey);
      } catch {}
    }
  };

  const handleAsk = async (e) => {
    e?.preventDefault();
    if ((!question.trim() && !attachedImage) || isAsking) return;

    const userQ = question.trim() || 'Analyze this chart screenshot.';
    const imagePayload = attachedImage;
    const timeNow = formatCurrentTime();

    setQuestion('');
    setAttachedImage(null);
    setChatHistory(prev => [
      ...prev,
      { sender: 'user', text: userQ, image: imagePayload, timestamp: timeNow }
    ]);
    setIsAsking(true);

    const activeProvider = !isAdmin ? 'gemini' : (model.startsWith('gemini') ? 'gemini' : provider);
    const activeModel = (!isAdmin && model.startsWith('gpt')) ? 'gemini-2.0-flash' : model;

    try {
      const res = await api.askAiCoach({
        question: userQ,
        messages: chatHistory.slice(-8),
        image: imagePayload,
        userProvider: activeProvider,
        userApiKey: isAdmin ? (activeProvider === 'gemini' ? geminiKey : openAiKey) : undefined,
        userModel: activeModel,
        conversationId: conversationId || undefined
      });

      if (res.conversationId) {
        setConversationId(res.conversationId);
      }

      setChatHistory(prev => [
        ...prev,
        {
          sender: 'ai',
          text: res.answer || 'Analysis complete.',
          model: res.model,
          provider: res.provider,
          timestamp: formatCurrentTime()
        }
      ]);
    } catch (err) {
      setChatHistory(prev => [
        ...prev,
        {
          sender: 'ai',
          text: `Notice: ${err.message}`,
          timestamp: formatCurrentTime()
        }
      ]);
    } finally {
      setIsAsking(false);
    }
  };

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Image file size must be under 5MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAttachedImage(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleCopy = (text, index) => {
    navigator.clipboard.writeText(cleanAiMessage(text));
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
    'What is my win rate and expectancy?',
    'Was my last trade according to my rules?',
    'Audit my trading psychology & tilt',
    'Compare my London and New York sessions',
    'Analyse Gold using the latest 15-minute candles',
    'When is the next high-impact news?',
    'Calculate lot size for $50k account',
    'Explain liquidity sweep with an example'
  ];

  return (
    <div style={{ display: 'grid', gap: '20px' }}>
      {/* Optional Performance Audit Accordion (Toggled from Menu or Pill) */}
      {showAuditPanel && (
        <div className="dashboard-panel" style={{ borderRadius: '18px', padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={18} color="var(--accent-cyan)" />
              1-Year Trade Expectancy & Behavioral Audit
            </h4>
            <button
              className="btn-ghost"
              onClick={() => setShowAuditPanel(false)}
              style={{ padding: '4px 8px', fontSize: '0.8rem' }}
            >
              <ChevronUp size={16} /> Hide Audit
            </button>
          </div>

          {loadingRule ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '16px' }}>Auditing trade records...</p>
          ) : !ruleCoach ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '16px' }}>Log more closed trades to unlock full statistical audit.</p>
          ) : (
            <div style={{ display: 'grid', gap: '14px' }}>
              <div className="ai-coach-diagnosis-banner" style={{ margin: 0 }}>
                <h4 className="ai-coach-diagnosis-title">Statistical Expectation & Edge Diagnosis</h4>
                <p className="ai-coach-diagnosis-text">
                  “<strong>FACT:</strong> {ruleCoach.summary.totalTrades} trades audited, achieving a <strong>{ruleCoach.summary.winRate}% win rate</strong> with <strong>{ruleCoach.summary.totalProfitUSD !== undefined ? `${ruleCoach.summary.totalProfitUSD >= 0 ? '+' : ''}$${Math.round(ruleCoach.summary.totalProfitUSD).toLocaleString()} profit` : ruleCoach.summary.totalR}</strong>.<br />
                  <strong>PATTERN:</strong> {ruleCoach.summary.tone === 'positive' ? 'Positive mathematical expectancy demonstrated across trade sequence.' : 'Expectancy is currently negative due to risk drag or low win rate.'}”
                </p>
              </div>

              <div className="ai-audit-grid">
                <div className="ai-audit-card strengths">
                  <h4><CheckCircle2 size={16} /> Verified Trading Strengths</h4>
                  <ul>
                    {ruleCoach.strengths.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>

                <div className="ai-audit-card mistakes">
                  <h4><AlertOctagon size={16} /> Repeated Mistakes</h4>
                  <ul>
                    {ruleCoach.repeatedMistakes.length === 0 ? (
                      <li style={{ color: 'var(--profit)' }}>Zero repeated mistakes logged. Excellent discipline!</li>
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

      {/* Main AI Coach Card (Exact Replica of Desired Design) */}
      <div className="ai-coach-main-card">
        {/* Top Header Bar */}
        <div className="ai-coach-navbar">
          <div className="ai-coach-brand">
            <div className="ai-coach-avatar-box">
              <Bot size={22} color="#10b981" />
            </div>
            <div>
              <h3 className="ai-coach-brand-title">AI Coach</h3>
              <p className="ai-coach-brand-subtitle">Your Personal Trading Assistant</p>
            </div>
          </div>

          <div className="ai-coach-nav-actions" ref={menuRef}>
            <button
              type="button"
              className="ai-coach-new-chat-btn"
              onClick={handleNewChat}
              title="Start a new chat conversation"
              aria-label="New Chat"
            >
              <Plus size={16} strokeWidth={2.5} />
              <span>New Chat</span>
            </button>

            <button
              type="button"
              className="ai-coach-action-btn"
              onClick={() => setShowMenu(prev => !prev)}
              title="More options & settings"
              aria-label="More options & settings"
            >
              <MoreHorizontal size={20} />
            </button>

            {/* Popover Settings Dropdown Menu */}
            {showMenu && (
              <div className="ai-coach-popover-menu">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    AI Reasoning Model
                  </span>
                  <select
                    value={model}
                    onChange={async (e) => {
                      const newModel = e.target.value;
                      setModel(newModel);
                      try {
                        await updateUserSettings({ aiModel: newModel });
                      } catch {}
                    }}
                    style={{
                      background: '#1f2937',
                      color: '#ffffff',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: '8px',
                      padding: '8px 10px',
                      fontSize: '0.82rem',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="gemini-2.0-flash">⚡ Gemini 2.0 Flash (Fast & Multimodal)</option>
                    <option value="gemini-1.5-flash">🛡️ Gemini 1.5 Flash (Production Standard)</option>
                    <option value="gemini-1.5-pro">🧠 Gemini 1.5 Pro (Deep Quantitative)</option>
                  </select>
                </div>

                <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '4px 0' }} />

                <button
                  type="button"
                  onClick={() => {
                    setShowAuditPanel(prev => !prev);
                    setShowMenu(false);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#94a3b8',
                    padding: '6px 8px',
                    fontSize: '0.82rem',
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    borderRadius: '6px'
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = '#ffffff'}
                  onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
                >
                  <Sparkles size={14} color="var(--accent-cyan)" />
                  {showAuditPanel ? 'Hide Performance Audit' : 'View Performance Audit'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    handleClearChat();
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#f87171',
                    padding: '6px 8px',
                    fontSize: '0.82rem',
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    borderRadius: '6px'
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                  onMouseLeave={e => e.currentTarget.style.color = '#f87171'}
                  title="Clear conversation history"
                >
                  <Trash2 size={14} />
                  <span>Clear Conversation</span>
                </button>

                {isAdmin && (
                  <>
                    <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '4px 0' }} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <span style={{ fontSize: '0.74rem', color: '#f59e0b', fontWeight: '800' }}>👑 ADMIN API KEY</span>
                      <input
                        type="password"
                        placeholder="Paste Gemini API Key..."
                        value={geminiKey}
                        onChange={e => setGeminiKey(e.target.value)}
                        style={{
                          background: '#1f2937',
                          color: '#ffffff',
                          border: '1px solid rgba(255,255,255,0.12)',
                          borderRadius: '8px',
                          padding: '6px 10px',
                          fontSize: '0.8rem'
                        }}
                      />
                      <button
                        type="button"
                        onClick={saveSettings}
                        className="btn-secondary"
                        style={{ padding: '6px 10px', fontSize: '0.78rem', justifyContent: 'center' }}
                      >
                        <Key size={12} /> {saveKeyNotice ? 'Saved!' : 'Save Key'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Chat Stream Area */}
        <div className="ai-coach-chat-stream">
          {chatHistory.length === 0 && (
            <div className="ai-msg-group ai">
              <div className="ai-avatar-bot">
                <Bot size={20} color="#10b981" />
              </div>
              <div className="ai-bubble-bot">
                <div>
                  {renderFormattedMessage(
                    user
                      ? `Hi ${firstName}! 👋\nWelcome to TradeJourn AI Coach!\n\nI can help you audit your trades, calculate position sizes, explain price action concepts, and improve your execution discipline.\n\n💡 **Suggested Next Steps:**\n• *"What is my win rate and expectancy?"*\n• *"Was my last trade according to my rules?"*\n• *"Analyse Gold on 1h chart"*`
                      : `Hi Guest! 👋\nWelcome to TradeJourn AI Coach!\n\nYou are currently in Guest mode. You can explore trading education, calculate position sizes, or analyze market setups. Log in anytime to sync your personal trade journal!\n\n💡 **Suggested Next Steps:**\n• *"What is win rate and how is expectancy calculated?"*\n• *"Explain liquidity sweeps and order blocks"*\n• *"Analyse Gold on 1h chart"*`,
                    (fu) => setQuestion(fu)
                  )}
                </div>
                <div className="ai-bubble-bot-time">
                  <span>{formatCurrentTime()}</span>
                </div>
              </div>
            </div>
          )}

          {chatHistory.map((msg, i) => (
            <div
              key={i}
              className={`ai-msg-group ${msg.sender === 'user' ? 'user' : 'ai'}`}
            >
              {msg.sender === 'ai' && (
                <div className="ai-avatar-bot">
                  <Bot size={20} color="#10b981" />
                </div>
              )}

              <div className={msg.sender === 'user' ? 'ai-bubble-user' : 'ai-bubble-bot'}>
                {msg.image && (
                  <div style={{ marginBottom: '8px' }}>
                    <img
                      src={msg.image}
                      alt="Uploaded Chart"
                      style={{ maxWidth: '280px', maxHeight: '180px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)', display: 'block' }}
                    />
                  </div>
                )}

                <div>
                  {msg.sender === 'ai'
                    ? renderFormattedMessage(msg.text, (fu) => setQuestion(fu))
                    : cleanAiMessage(msg.text)}
                </div>

                <div className={msg.sender === 'user' ? 'ai-bubble-user-time' : 'ai-bubble-bot-time'}>
                  <span>{msg.timestamp || 'Just now'}</span>
                  {msg.sender === 'ai' && (
                    <button
                      type="button"
                      className="btn-ghost"
                      style={{ padding: '2px 4px', fontSize: '0.7rem', color: '#64748b' }}
                      onClick={() => handleCopy(msg.text, i)}
                      title="Copy message"
                    >
                      {copiedIndex === i ? <Check size={12} color="var(--profit)" /> : <Copy size={12} />}
                    </button>
                  )}
                </div>
              </div>

              {msg.sender === 'user' && (
                <div className="ai-avatar-user">
                  {userInitial}
                </div>
              )}
            </div>
          ))}

          {isAsking && (
            <div className="ai-msg-group ai">
              <div className="ai-avatar-bot">
                <Bot size={20} color="#10b981" />
              </div>
              <div className="ai-bubble-bot" style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#a7f3d0' }}>
                <RefreshCw size={14} className="spin" />
                <span>AI Trading Coach is formulating your analysis...</span>
              </div>
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>

        {/* Quick Suggestion Pills */}
        <div className="ai-quick-carousel">
          {quickPrompts.map((p, idx) => (
            <button
              key={idx}
              type="button"
              className="ai-quick-pill"
              onClick={() => setQuestion(p)}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Attached Image Preview */}
        {attachedImage && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px', margin: '0 24px 8px 24px', width: 'fit-content' }}>
            <span style={{ fontSize: '0.78rem', color: '#10b981', fontWeight: '600' }}>Chart Screenshot Attached</span>
            <button
              type="button"
              onClick={() => setAttachedImage(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'inline-flex', alignItems: 'center' }}
              title="Remove attached image"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Bottom Input Dock */}
        <div className="ai-input-dock">
          <form onSubmit={handleAsk} className="ai-input-box">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageSelect}
              accept="image/*"
              style={{ display: 'none' }}
            />
            <button
              type="button"
              className="ai-attach-btn"
              onClick={() => fileInputRef.current?.click()}
              title="Attach Chart Screenshot"
              aria-label="Attach Chart Screenshot"
            >
              <ImageIcon size={20} />
            </button>

            <input
              type="text"
              placeholder="Ask anything about trading, strategy, rules or performance..."
              value={question}
              onChange={e => setQuestion(e.target.value)}
              disabled={isAsking}
            />

            <button
              type="submit"
              className="ai-send-btn"
              disabled={isAsking || (!question.trim() && !attachedImage)}
              title="Send message"
              aria-label="Send message"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
export default AICoachView;
