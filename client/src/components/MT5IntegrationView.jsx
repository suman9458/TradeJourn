import React, { useState, useEffect, useRef } from 'react';
import {
  Cpu,
  Radio,
  Zap,
  Activity,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Terminal,
  ShieldCheck,
  ArrowRight,
  ExternalLink,
  Layers,
  Settings,
  Sliders,
  Clock,
  Sparkles,
  Copy,
  Check,
  Trash2,
  X,
  Link as LinkIcon,
  BookOpen,
  DollarSign,
  TrendingUp,
  Camera,
  AlertOctagon,
  Cloud,
  CloudLightning,
  Lock,
  Globe,
  Server,
  Shield,
  Eye,
  EyeOff,
  CheckCircle
} from 'lucide-react';
import { api } from '../services/api';
import { compressImageFile } from '../utils/imageHelper';

// Popular broker presets for 1-click server selection
const BROKER_PRESETS = [
  { label: 'IC Markets Demo', server: 'ICMarketsSC-Demo', mode: 'demo' },
  { label: 'IC Markets Live', server: 'ICMarketsSC-Live', mode: 'live' },
  { label: 'Exness Real', server: 'Exness-MT5Real', mode: 'live' },
  { label: 'Exness Trial', server: 'Exness-MT5Trial', mode: 'demo' },
  { label: 'FTMO Challenge', server: 'FTMO-Demo', mode: 'demo' },
  { label: 'FundedNext', server: 'FundedNext-Server', mode: 'demo' },
  { label: 'Pepperstone', server: 'Pepperstone-Live', mode: 'live' },
  { label: 'MetaQuotes Demo', server: 'MetaQuotes-Demo', mode: 'demo' }
];

export const MT5IntegrationView = ({ trades = [], stats = null }) => {
  const [accounts, setAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [openPositions, setOpenPositions] = useState([]);
  const [pendingJournals, setPendingJournals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [secondsAgo, setSecondsAgo] = useState(0);

  // Cloud MT5 Direct Web Login State (No Download)
  const [isCloudModalOpen, setIsCloudModalOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [cloudForm, setCloudForm] = useState({
    serverName: 'ICMarketsSC-Demo',
    login: '',
    password: '',
    accountName: '',
    tradeMode: 'demo'
  });
  const [connectingCloud, setConnectingCloud] = useState(false);
  const [cloudError, setCloudError] = useState('');

  // Pairing State (VPS)
  const [isPairingModalOpen, setIsPairingModalOpen] = useState(false);
  const [pairingCode, setPairingCode] = useState('');
  const [pairingExpiresAt, setPairingExpiresAt] = useState(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [generatingCode, setGeneratingCode] = useState(false);

  // Disconnect Modal
  const [disconnectModalOpen, setDisconnectModalOpen] = useState(false);
  const [deleteDataOnDisconnect, setDeleteDataOnDisconnect] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  // Complete Journal Modal
  const [journalModalTrade, setJournalModalTrade] = useState(null);
  const [journalForm, setJournalForm] = useState({
    setupRating: 'A+',
    session: 'London',
    entryType: 'Confirmation',
    confirmation: 'Yes',
    emotion: 'Calm',
    marketCondition: 'Trending',
    reasonEarlyExit: 'None',
    mistakes: ['None'],
    notes: '',
    screenshotUrl: ''
  });
  const [savingJournal, setSavingJournal] = useState(false);

  // Link Manual Trade Modal
  const [linkModalTrade, setLinkModalTrade] = useState(null);
  const [selectedManualTradeId, setSelectedManualTradeId] = useState('');
  const [linkingTrade, setLinkingTrade] = useState(false);

  // Notification Toast state
  const [toastMessage, setToastMessage] = useState(null);

  const pollTimerRef = useRef(null);

  // 1. Fetch Accounts & Pending Journals
  const fetchAccountsData = async (silent = false) => {
    if (!silent) setIsRefreshing(true);
    try {
      const [accRes, pendingRes] = await Promise.all([
        api.getMT5Accounts().catch(() => ({ success: false, accounts: [] })),
        api.getMT5PendingJournals().catch(() => ({ success: false, trades: [] }))
      ]);

      if (accRes.success) {
        setAccounts(accRes.accounts || []);
        if (accRes.accounts.length > 0 && !selectedAccountId) {
          setSelectedAccountId(accRes.accounts[0]._id);
        }
      }

      if (pendingRes.success) {
        const newPending = pendingRes.trades || [];
        setPendingJournals(newPending);

        // In-app alert for newly closed trade
        if (newPending.length > 0 && (!pendingJournals || newPending.length > pendingJournals.length)) {
          setToastMessage(`Trade closed on MT5 (#${newPending[0].mt5PositionId || 'Ticket'}). Complete your journal entry.`);
        }
      }

      setLastSyncTime(Date.now());
    } catch (err) {
      console.warn('MT5 fetch error:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  // 2. Fetch Open Positions for Active Account
  const fetchOpenPositions = async () => {
    if (!selectedAccountId) return;
    try {
      const res = await api.getMT5OpenPositions(selectedAccountId);
      if (res.success) {
        setOpenPositions(res.positions || []);
        setLastSyncTime(Date.now());
      }
    } catch (err) {
      console.warn('Error fetching open positions:', err);
    }
  };

  // Initial load
  useEffect(() => {
    fetchAccountsData();
  }, []);

  // Polling loop (every 6 seconds)
  useEffect(() => {
    pollTimerRef.current = setInterval(() => {
      if (selectedAccountId) {
        fetchOpenPositions();
      }
      fetchAccountsData(true);
    }, 6000);

    return () => clearInterval(pollTimerRef.current);
  }, [selectedAccountId]);

  // "Updated X seconds ago" ticker
  useEffect(() => {
    const secTimer = setInterval(() => {
      if (lastSyncTime) {
        const elapsed = Math.max(1, Math.round((Date.now() - lastSyncTime) / 1000));
        setSecondsAgo(elapsed);
      }
    }, 1000);
    return () => clearInterval(secTimer);
  }, [lastSyncTime]);

  const activeAccount = accounts.find(a => a._id === selectedAccountId) || accounts[0] || null;

  // Cloud Direct Web Login Flow (No Download)
  const handleOpenCloudModal = () => {
    setCloudError('');
    setIsCloudModalOpen(true);
  };

  const handleConnectCloud = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setCloudError('');
    if (!cloudForm.serverName.trim()) {
      setCloudError('Please enter your broker server name (e.g. ICMarketsSC-Demo or Exness-MT5Real)');
      return;
    }
    if (!cloudForm.login.toString().trim()) {
      setCloudError('Please enter your MT5 account login number');
      return;
    }
    if (!cloudForm.password.trim()) {
      setCloudError('Please enter your MT5 Investor (read-only) Password');
      return;
    }

    setConnectingCloud(true);
    try {
      const res = await api.connectMT5CloudAccount({
        serverName: cloudForm.serverName.trim(),
        login: cloudForm.login.toString().trim(),
        password: cloudForm.password.trim(),
        accountName: cloudForm.accountName.trim() || undefined,
        tradeMode: cloudForm.tradeMode
      });

      if (res.success) {
        setIsCloudModalOpen(false);
        setToastMessage(`Connected MT5 Account #${res.account?.login || cloudForm.login} via Cloud API!`);
        await fetchAccountsData();
        if (res.account?._id) {
          setSelectedAccountId(res.account._id);
        }
      } else {
        setCloudError(res.message || 'Failed to connect MT5 cloud account.');
      }
    } catch (err) {
      setCloudError(err.message || 'Connection failed. Please check your broker server and credentials.');
    } finally {
      setConnectingCloud(false);
    }
  };

  // Generate Pairing Code Flow (VPS)
  const handleOpenPairing = async () => {
    setIsPairingModalOpen(true);
    setGeneratingCode(true);
    try {
      const res = await api.generateMT5PairingCode();
      if (res.success) {
        setPairingCode(res.pairingCode);
        setPairingExpiresAt(res.expiresAt);
      }
    } catch (err) {
      alert('Failed to generate pairing code: ' + err.message);
    } finally {
      setGeneratingCode(false);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(pairingCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Disconnect Flow
  const handleConfirmDisconnect = async () => {
    if (!activeAccount) return;
    try {
      setDisconnecting(true);
      await api.disconnectMT5Account(activeAccount._id, deleteDataOnDisconnect);
      setDisconnectModalOpen(false);
      setSelectedAccountId('');
      await fetchAccountsData();
    } catch (err) {
      alert('Disconnect failed: ' + err.message);
    } finally {
      setDisconnecting(false);
    }
  };

  // Open Journal Modal
  const handleOpenCompleteJournal = (trade) => {
    setJournalModalTrade(trade);
    setJournalForm({
      setupRating: trade.setupRating || 'A+',
      session: trade.session || 'London',
      entryType: trade.entryType || 'Confirmation',
      confirmation: trade.confirmation || 'Yes',
      emotion: trade.emotion || 'Calm',
      marketCondition: trade.marketCondition || 'Trending',
      reasonEarlyExit: trade.reasonEarlyExit || 'None',
      mistakes: Array.isArray(trade.mistakes) ? trade.mistakes : ['None'],
      notes: trade.notes || '',
      screenshotUrl: trade.screenshotUrl || trade.imageUrl || ''
    });
  };

  // Submit Journal
  const handleSaveJournal = async (status = 'completed') => {
    if (!journalModalTrade) return;
    try {
      setSavingJournal(true);
      await api.updateMT5Journal(journalModalTrade._id, {
        ...journalForm,
        journalStatus: status
      });
      setJournalModalTrade(null);
      await fetchAccountsData();
    } catch (err) {
      alert('Failed to save journal: ' + err.message);
    } finally {
      setSavingJournal(false);
    }
  };

  // Link Manual Trade Flow
  const handleOpenLinkModal = (trade) => {
    setLinkModalTrade(trade);
    setSelectedManualTradeId('');
  };

  const handleExecuteLink = async () => {
    if (!linkModalTrade || !selectedManualTradeId) return;
    try {
      setLinkingTrade(true);
      await api.linkMT5ManualTrade(linkModalTrade._id, {
        manualTradeId: selectedManualTradeId
      });
      setLinkModalTrade(null);
      await fetchAccountsData();
    } catch (err) {
      alert('Failed to link trade: ' + err.message);
    } finally {
      setLinkingTrade(false);
    }
  };

  // Clipboard paste for chart screenshot in Journal Modal
  useEffect(() => {
    if (!journalModalTrade) return;
    const handlePaste = async (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            try {
              const dataUrl = await compressImageFile(file);
              setJournalForm(prev => ({ ...prev, screenshotUrl: dataUrl }));
            } catch (err) {
              console.warn('Paste failed:', err);
            }
          }
          break;
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [journalModalTrade]);

  // Non-MT5 manual trades for linking dropdown
  const manualTrades = trades.filter(t => !t.isFromMT5);

  return (
    <div className="analytics-page-container">
      {/* Closed Trade In-App Notification Toast */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9999,
          background: 'linear-gradient(135deg, #0ea5e9, #2563eb)',
          color: '#ffffff',
          padding: '14px 20px',
          borderRadius: '12px',
          boxShadow: '0 8px 30px rgba(14, 165, 233, 0.4)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          animation: 'fadeIn 0.3s ease'
        }}>
          <Zap size={18} />
          <span style={{ fontSize: '0.86rem', fontWeight: '700' }}>{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: '2px' }}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* 1. Header Section */}
      <div className="dashboard-header" style={{ marginBottom: '18px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <h2 style={{ fontSize: '1.45rem', fontWeight: '800', margin: 0, color: 'var(--text-white)', letterSpacing: '-0.02em' }}>
              MetaTrader 5 Integration
            </h2>
            {activeAccount && (
              <span style={{
                fontSize: '0.64rem',
                fontWeight: '900',
                padding: '2px 8px',
                borderRadius: '6px',
                background: activeAccount.tradeMode === 'live' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(14, 165, 233, 0.15)',
                color: activeAccount.tradeMode === 'live' ? '#ef4444' : 'var(--accent-cyan)',
                border: activeAccount.tradeMode === 'live' ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(14, 165, 233, 0.4)',
                letterSpacing: '0.04em'
              }}>
                {activeAccount.tradeMode?.toUpperCase() || 'DEMO'} ACCOUNT
              </span>
            )}
          </div>
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            Institutional-grade read-only bridge streaming MT5 telemetry, open positions, and automatic trade journaling.
          </p>
        </div>

        {/* Header Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Sync indicator (Rule: Say "Updated X seconds ago", NEVER "real-time") */}
          <div style={{
            fontSize: '0.74rem',
            color: 'var(--text-muted)',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'var(--bg-card)',
            padding: '7px 12px',
            borderRadius: '8px',
            border: '1px solid var(--border-subtle)'
          }}>
            <Clock size={13} color="var(--accent-cyan)" />
            <span>Updated {secondsAgo}s ago</span>
          </div>

          <button
            onClick={() => fetchAccountsData(false)}
            disabled={isRefreshing}
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 13px', fontSize: '0.8rem', fontWeight: '700' }}
          >
            <RefreshCw size={13} className={isRefreshing ? 'spin' : ''} />
            <span>Sync</span>
          </button>

          <button
            onClick={handleOpenCloudModal}
            className="btn-primary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '7px',
              padding: '7px 15px',
              fontSize: '0.8rem',
              fontWeight: '800',
              background: 'linear-gradient(135deg, #0284c7 0%, #06b6d4 100%)',
              boxShadow: '0 2px 10px rgba(6, 182, 212, 0.35)',
              border: 'none'
            }}
          >
            <CloudLightning size={14} />
            <span>Connect Cloud MT5</span>
          </button>

          <button
            onClick={handleOpenPairing}
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 13px', fontSize: '0.8rem', fontWeight: '700' }}
            title="Self-Hosted VPS Connector"
          >
            <Terminal size={13} />
            <span>VPS Pairing</span>
          </button>

          {activeAccount && (
            <button
              onClick={() => setDisconnectModalOpen(true)}
              className="btn-ghost"
              style={{ color: 'var(--loss)', display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', fontSize: '0.8rem' }}
              title="Disconnect account"
            >
              <Trash2 size={14} />
              <span>Disconnect</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Account Selector & Connection Health Strip */}
      {accounts.length > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '12px 18px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '12px',
          marginBottom: '18px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: '700' }}>ACTIVE TERMINAL:</span>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-white)',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '0.84rem',
                fontWeight: '700',
                outline: 'none'
              }}
            >
              {accounts.map(acc => (
                <option key={acc._id} value={acc._id} style={{ background: '#111a2e', color: '#fff' }}>
                  {acc.connectionMethod === 'cloud' ? '☁️ Cloud' : '🖥️ VPS'} • {acc.serverName} • #{acc.login} ({acc.tradeMode?.toUpperCase()})
                </option>
              ))}
            </select>

            {activeAccount && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '3px 8px',
                borderRadius: '6px',
                background: activeAccount.connectionMethod === 'cloud' ? 'rgba(14, 165, 233, 0.12)' : 'rgba(168, 85, 247, 0.12)',
                color: activeAccount.connectionMethod === 'cloud' ? 'var(--accent-cyan)' : 'var(--accent-purple)',
                border: activeAccount.connectionMethod === 'cloud' ? '1px solid rgba(14, 165, 233, 0.3)' : '1px solid rgba(168, 85, 247, 0.3)',
                fontSize: '0.72rem',
                fontWeight: '800'
              }}>
                {activeAccount.connectionMethod === 'cloud' ? <Cloud size={12} /> : <Server size={12} />}
                <span>{activeAccount.connectionMethod === 'cloud' ? 'Cloud API' : 'VPS Connector'}</span>
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: activeAccount?.status === 'connected' ? 'var(--profit)' : activeAccount?.status === 'stale' ? 'var(--warning)' : 'var(--loss)'
              }} />
              <span style={{ fontSize: '0.76rem', fontWeight: '800', color: 'var(--text-white)', textTransform: 'uppercase' }}>
                Status: {activeAccount?.status || 'Standby'}
              </span>
            </div>

            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
              Server: <strong style={{ color: 'var(--text-white)' }}>{activeAccount?.serverName || 'None'}</strong>
            </span>
          </div>
        </div>
      )}

      {/* 3. Account Capital & Margin Metrics Cards */}
      {activeAccount ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px', marginBottom: '22px' }}>
          <div className="kpi-card neutral">
            <div className="kpi-top">
              <span>Account Balance</span>
              <DollarSign size={15} color="var(--accent-cyan)" />
            </div>
            <div className="kpi-value">${(activeAccount.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Base: {activeAccount.currency || 'USD'} • 1:{activeAccount.leverage || 100}
            </p>
          </div>

          <div className="kpi-card positive">
            <div className="kpi-top">
              <span>Realized Equity</span>
              <TrendingUp size={15} color="var(--profit)" />
            </div>
            <div className="kpi-value" style={{ color: (activeAccount.equity || 0) >= (activeAccount.balance || 0) ? 'var(--profit)' : 'var(--loss)' }}>
              ${(activeAccount.equity || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Live floating margin
            </p>
          </div>

          <div className={`kpi-card ${(activeAccount.floatingProfit || 0) >= 0 ? 'positive' : 'negative'}`}>
            <div className="kpi-top">
              <span>Floating P&amp;L</span>
              <Activity size={15} color={(activeAccount.floatingProfit || 0) >= 0 ? 'var(--profit)' : 'var(--loss)'} />
            </div>
            <div className="kpi-value">
              {(activeAccount.floatingProfit || 0) >= 0 ? '+' : ''}${(activeAccount.floatingProfit || 0).toFixed(2)}
            </div>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              {openPositions.length} active positions
            </p>
          </div>

          <div className="kpi-card neutral">
            <div className="kpi-top">
              <span>Margin Metrics</span>
              <ShieldCheck size={15} color="var(--accent-purple)" />
            </div>
            <div className="kpi-value" style={{ fontSize: '1.2rem' }}>
              ${(activeAccount.freeMargin || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} Free
            </div>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Used: ${(activeAccount.margin || 0).toFixed(1)} • {Math.round(activeAccount.marginLevel || 0)}%
            </p>
          </div>
        </div>
      ) : (
        /* Zero State: Choose Connection Method */
        <div style={{
          marginBottom: '26px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '16px',
          padding: '28px 24px'
        }}>
          <div style={{ textAlign: 'center', maxWidth: '620px', margin: '0 auto 24px' }}>
            <span style={{
              fontSize: '0.72rem',
              fontWeight: '900',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--accent-cyan)',
              background: 'rgba(14, 165, 233, 0.12)',
              padding: '4px 12px',
              borderRadius: '20px',
              border: '1px solid rgba(14, 165, 233, 0.3)'
            }}>
              Zero Software Download Required
            </span>
            <h3 style={{ margin: '12px 0 6px 0', fontSize: '1.45rem', fontWeight: '800', color: 'var(--text-white)' }}>
              Connect Your MetaTrader 5 Account
            </h3>
            <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              Choose how you want to bridge your MT5 broker to TradeJourn. We recommend Cloud Direct Web Login for instant 30-second connection without downloading any files or setting up a server.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: '16px' }}>
            {/* Card 1: Cloud MT5 Direct Web Login (Primary / Recommended) */}
            <div style={{
              background: 'linear-gradient(145deg, rgba(14, 165, 233, 0.08) 0%, rgba(30, 41, 59, 0.7) 100%)',
              border: '2px solid rgba(14, 165, 233, 0.4)',
              borderRadius: '14px',
              padding: '22px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative',
              boxShadow: '0 8px 24px rgba(14, 165, 233, 0.1)'
            }}>
              <div style={{
                position: 'absolute',
                top: '-10px',
                right: '18px',
                background: 'linear-gradient(135deg, #0284c7, #06b6d4)',
                color: '#fff',
                fontSize: '0.66rem',
                fontWeight: '900',
                padding: '2px 10px',
                borderRadius: '10px',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                boxShadow: '0 2px 8px rgba(6, 182, 212, 0.4)'
              }}>
                ⭐ Recommended
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                  <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(14, 165, 233, 0.18)', display: 'grid', placeItems: 'center', color: 'var(--accent-cyan)' }}>
                    <CloudLightning size={22} />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '800', color: 'var(--text-white)' }}>
                      Cloud MT5 Web Login
                    </h4>
                    <span style={{ fontSize: '0.72rem', color: 'var(--accent-cyan)', fontWeight: '700' }}>
                      No Download • Direct Browser Login
                    </span>
                  </div>
                </div>

                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: '1.45', margin: '0 0 14px 0' }}>
                  Enter your Broker Server &amp; Read-Only Investor Password. Your account connects instantly through our cloud bridge without installing any software or extensions.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', marginBottom: '18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '0.78rem', color: 'var(--text-white)' }}>
                    <CheckCircle size={14} color="var(--profit)" />
                    <span>0 software downloads or extensions needed</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '0.78rem', color: 'var(--text-white)' }}>
                    <CheckCircle size={14} color="var(--profit)" />
                    <span>100% Read-only investor password safety</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '0.78rem', color: 'var(--profit)' }}>
                    <CheckCircle size={14} color="var(--profit)" />
                    <span>Instant telemetry &amp; live positions streaming</span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleOpenCloudModal}
                className="btn-primary"
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  padding: '10px',
                  fontWeight: '800',
                  fontSize: '0.86rem',
                  background: 'linear-gradient(135deg, #0284c7 0%, #06b6d4 100%)',
                  boxShadow: '0 4px 14px rgba(6, 182, 212, 0.35)'
                }}
              >
                <CloudLightning size={16} />
                <span>Connect Cloud MT5 (Instant)</span>
              </button>
            </div>

            {/* Card 2: Self-Hosted Windows VPS Connector */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '14px',
              padding: '22px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                  <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(168, 85, 247, 0.15)', display: 'grid', placeItems: 'center', color: 'var(--accent-purple)' }}>
                    <Server size={22} />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '800', color: 'var(--text-white)' }}>
                      Self-Hosted VPS Connector
                    </h4>
                    <span style={{ fontSize: '0.72rem', color: 'var(--accent-purple)', fontWeight: '700' }}>
                      For Algo &amp; EA Dedicated Servers
                    </span>
                  </div>
                </div>

                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: '1.45', margin: '0 0 14px 0' }}>
                  Run our open-source Python daemon directly inside your Windows VPS alongside your MT5 terminal using cryptographically signed HMAC pairing.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', marginBottom: '18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '0.78rem', color: 'var(--text-white)' }}>
                    <CheckCircle size={14} color="var(--accent-cyan)" />
                    <span>Runs locally next to custom EAs &amp; scripts</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '0.78rem', color: 'var(--accent-cyan)"' }}>
                    <CheckCircle size={14} color="var(--accent-cyan)" />
                    <span>Cryptographic HMAC-SHA256 signature</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '0.78rem', color: 'var(--accent-cyan)' }}>
                    <CheckCircle size={14} color="var(--accent-cyan)" />
                    <span>Zero open inbound firewall ports</span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleOpenPairing}
                className="btn-secondary"
                style={{ width: '100%', justifyContent: 'center', padding: '10px', fontWeight: '800', fontSize: '0.86rem' }}
              >
                <Terminal size={15} />
                <span>Pair VPS Terminal</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Pending Journals Drawer / Section */}
      {pendingJournals.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BookOpen size={18} color="var(--accent-cyan)" />
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '800', color: 'var(--text-white)' }}>
                Pending Trade Journals ({pendingJournals.length})
              </h3>
            </div>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              Trades closed on MT5 awaiting qualitative review &amp; setup rating
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '14px' }}>
            {pendingJournals.map(trade => (
              <div
                key={trade._id}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid rgba(14, 165, 233, 0.35)',
                  borderRadius: '12px',
                  padding: '16px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '12px',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontWeight: '800', fontSize: '0.94rem', color: 'var(--text-white)' }}>
                        {trade.instrument}
                      </span>
                      <span className={`badge ${trade.direction === 'Sell' ? 'badge-loss' : 'badge-win'}`} style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
                        {trade.direction?.toUpperCase()}
                      </span>
                    </div>
                    <span style={{
                      fontSize: '0.88rem',
                      fontWeight: '800',
                      fontFamily: 'var(--font-mono)',
                      color: trade.takeProfitUSD >= 0 ? 'var(--profit)' : 'var(--loss)'
                    }}>
                      {trade.takeProfitUSD >= 0 ? '+' : ''}${Number(trade.takeProfitUSD || 0).toFixed(2)}
                    </span>
                  </div>

                  <p style={{ margin: '0 0 6px 0', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                    {trade.date} {trade.time} • MT5 Ticket: #{trade.mt5PositionId || 'N/A'} • {trade.lotSize || 0.1} Lots
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    <span>Entry: {trade.entryPrice || '-'}</span>
                    <span>Exit: {trade.exitPrice || '-'}</span>
                    <span>Pips: {trade.pips || 0}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }}>
                  <button
                    onClick={() => handleOpenCompleteJournal(trade)}
                    className="btn-primary"
                    style={{ flex: 1, padding: '6px 12px', fontSize: '0.78rem', justifyContent: 'center' }}
                  >
                    <span>Complete Journal</span>
                    <ArrowRight size={13} />
                  </button>

                  <button
                    onClick={() => handleOpenLinkModal(trade)}
                    className="btn-secondary"
                    style={{ padding: '6px 10px', fontSize: '0.78rem', title: 'Link to manual trade' }}
                    title="Link to manual trade to avoid duplicate"
                  >
                    <LinkIcon size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. Live Open Positions Table */}
      <div className="dashboard-panel" style={{ padding: '20px', borderRadius: '14px', background: 'var(--bg-card)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={18} color="var(--profit)" />
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '800', color: 'var(--text-white)' }}>
              Live Open Positions ({openPositions.length})
            </h3>
          </div>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
            Polled from MT5 terminal • Read-only snapshot
          </span>
        </div>

        <div className="table-responsive">
          <table className="trades-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Symbol</th>
                <th>Type</th>
                <th>Lots</th>
                <th>Open Price</th>
                <th>Current</th>
                <th>SL</th>
                <th>TP</th>
                <th>Swap</th>
                <th>Floating P&amp;L</th>
                <th>Open Time</th>
              </tr>
            </thead>
            <tbody>
              {openPositions.length === 0 ? (
                <tr>
                  <td colSpan="11" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                    {activeAccount?.status === 'connected'
                      ? 'No open positions on MT5 terminal right now. Waiting for next execution.'
                      : 'Terminal is currently disconnected or in standby. Check connector status.'}
                  </td>
                </tr>
              ) : (
                openPositions.map(pos => (
                  <tr key={pos.ticket}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      #{pos.ticket}
                    </td>
                    <td>
                      <span style={{ fontWeight: '800', color: 'var(--accent-cyan)' }}>{pos.symbol}</span>
                    </td>
                    <td>
                      <span className={`badge ${pos.direction === 'Sell' ? 'badge-loss' : 'badge-win'}`} style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
                        {pos.direction?.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{pos.volume}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{pos.price}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', color: 'var(--text-white)' }}>{pos.currentPrice}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', color: pos.sl ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                      {pos.sl || 'None'}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', color: pos.tp ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                      {pos.tp || 'None'}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>${(pos.swap || 0).toFixed(2)}</td>
                    <td style={{
                      fontFamily: 'var(--font-mono)',
                      fontWeight: '800',
                      color: (pos.profit || 0) >= 0 ? 'var(--profit)' : 'var(--loss)'
                    }}>
                      {(pos.profit || 0) >= 0 ? '+' : ''}${(pos.profit || 0).toFixed(2)}
                    </td>
                    <td style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                      {pos.openTimeUTC ? new Date(pos.openTimeUTC).toLocaleTimeString() : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* MODAL 0: Direct Cloud MT5 Web Login (No Download / No VPS)             */}
      {/* ---------------------------------------------------------------------- */}
      {isCloudModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '540px', padding: '26px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(14, 165, 233, 0.15)', display: 'grid', placeItems: 'center', color: 'var(--accent-cyan)' }}>
                  <CloudLightning size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-white)' }}>
                    Connect MT5 Cloud API
                  </h3>
                  <span style={{ fontSize: '0.74rem', color: 'var(--accent-cyan)', fontWeight: '700' }}>
                    Direct Web Login • No Download • No VPS
                  </span>
                </div>
              </div>
              <button onClick={() => setIsCloudModalOpen(false)} className="btn-ghost" style={{ padding: '4px' }}>
                <X size={18} />
              </button>
            </div>

            {/* Fund Safety Guarantee Callout */}
            <div style={{
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '10px',
              padding: '12px 14px',
              marginBottom: '18px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px'
            }}>
              <ShieldCheck size={18} color="var(--profit)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: '1.45' }}>
                <strong style={{ color: 'var(--profit)' }}>100% Fund Safety Guarantee:</strong>
                <p style={{ margin: '3px 0 0 0' }}>
                  Please enter your <strong>Investor (Read-Only) Password</strong>. TradeJourn can only read account balance and closed trade records. It is mathematically impossible to place trades or execute withdrawals.
                </p>
              </div>
            </div>

            {cloudError && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                color: '#f87171',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '0.8rem',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AlertTriangle size={15} />
                <span>{cloudError}</span>
              </div>
            )}

            <form onSubmit={handleConnectCloud}>
              {/* Field 1: Broker Server */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Broker Server Name
                </label>
                <input
                  type="text"
                  value={cloudForm.serverName}
                  onChange={e => setCloudForm({ ...cloudForm, serverName: e.target.value })}
                  placeholder="e.g. ICMarketsSC-Demo or Exness-MT5Real"
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: 'var(--bg-core)',
                    color: '#fff',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '0.86rem',
                    fontFamily: 'var(--font-mono)'
                  }}
                />

                {/* Quick Server Select Badges */}
                <div style={{ marginTop: '8px' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                    Popular Broker Presets:
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {BROKER_PRESETS.map((bp) => (
                      <button
                        key={bp.server}
                        type="button"
                        onClick={() => setCloudForm({ ...cloudForm, serverName: bp.server, tradeMode: bp.mode })}
                        style={{
                          background: cloudForm.serverName === bp.server ? 'rgba(14, 165, 233, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                          border: cloudForm.serverName === bp.server ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
                          color: cloudForm.serverName === bp.server ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                          fontSize: '0.7rem',
                          fontWeight: '700',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          cursor: 'pointer'
                        }}
                      >
                        {bp.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Field 2 & 3: Account Number & Password */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                    Account Login Number
                  </label>
                  <input
                    type="number"
                    value={cloudForm.login}
                    onChange={e => setCloudForm({ ...cloudForm, login: e.target.value })}
                    placeholder="e.g. 50123984"
                    required
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: 'var(--bg-core)',
                      color: '#fff',
                      border: '1px solid var(--border-subtle)',
                      fontSize: '0.86rem',
                      fontFamily: 'var(--font-mono)'
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                    Investor Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={cloudForm.password}
                      onChange={e => setCloudForm({ ...cloudForm, password: e.target.value })}
                      placeholder="Read-only password"
                      required
                      style={{
                        width: '100%',
                        padding: '10px 36px 10px 12px',
                        borderRadius: '8px',
                        background: 'var(--bg-core)',
                        color: '#fff',
                        border: '1px solid var(--border-subtle)',
                        fontSize: '0.86rem'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '2px'
                      }}
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Field 4 & 5: Trade Mode & Nickname */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                    Account Type
                  </label>
                  <select
                    value={cloudForm.tradeMode}
                    onChange={e => setCloudForm({ ...cloudForm, tradeMode: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: 'var(--bg-core)',
                      color: '#fff',
                      border: '1px solid var(--border-subtle)',
                      fontSize: '0.86rem'
                    }}
                  >
                    <option value="demo">Demo Account</option>
                    <option value="live">Live / Real Account</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                    Account Nickname (Optional)
                  </label>
                  <input
                    type="text"
                    value={cloudForm.accountName}
                    onChange={e => setCloudForm({ ...cloudForm, accountName: e.target.value })}
                    placeholder="e.g. FTMO Challenge 100k"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: 'var(--bg-core)',
                      color: '#fff',
                      border: '1px solid var(--border-subtle)',
                      fontSize: '0.86rem'
                    }}
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsCloudModalOpen(false)}
                  className="btn-secondary"
                  style={{ padding: '9px 16px', fontSize: '0.84rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={connectingCloud}
                  className="btn-primary"
                  style={{
                    padding: '9px 22px',
                    fontSize: '0.86rem',
                    fontWeight: '800',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'linear-gradient(135deg, #0284c7 0%, #06b6d4 100%)',
                    boxShadow: '0 4px 16px rgba(6, 182, 212, 0.35)'
                  }}
                >
                  {connectingCloud ? (
                    <>
                      <RefreshCw size={15} className="spin" />
                      <span>Connecting to MT5 Cloud...</span>
                    </>
                  ) : (
                    <>
                      <CloudLightning size={16} />
                      <span>Connect MT5 Account</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* MODAL 1: Pair MT5 Terminal Code Modal                                  */}
      {/* ---------------------------------------------------------------------- */}
      {isPairingModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '520px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Zap size={18} color="var(--accent-cyan)" />
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800', color: 'var(--text-white)' }}>
                  Pair Windows VPS MT5 Connector
                </h3>
              </div>
              <button onClick={() => setIsPairingModalOpen(false)} className="btn-ghost" style={{ padding: '4px' }}>
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: '1.5', margin: '0 0 16px 0' }}>
              Enter this one-time pairing code into your Windows VPS connector's <code>config.json</code> under <code>"pairing_code"</code>. The connector will automatically exchange it for cryptographically signed HMAC keys.
            </p>

            {generatingCode ? (
              <div style={{ textAlign: 'center', padding: '24px' }}>
                <RefreshCw size={24} className="spin" color="var(--accent-cyan)" />
                <p style={{ marginTop: '8px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>Generating cryptographic pairing code...</p>
              </div>
            ) : (
              <div style={{
                background: 'rgba(14, 165, 233, 0.08)',
                border: '1px dashed rgba(14, 165, 233, 0.4)',
                borderRadius: '12px',
                padding: '16px',
                textAlign: 'center',
                marginBottom: '18px'
              }}>
                <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontWeight: '700' }}>
                  One-Time Pairing Code (Valid for 10 minutes)
                </span>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', margin: '10px 0' }}>
                  <span style={{ fontSize: '2rem', fontWeight: '900', letterSpacing: '0.15em', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
                    {pairingCode || '------'}
                  </span>
                  <button
                    onClick={handleCopyCode}
                    className="btn-secondary"
                    style={{ padding: '6px 10px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    {copiedCode ? <Check size={14} color="var(--profit)" /> : <Copy size={14} />}
                    <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>
            )}

            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', background: 'var(--bg-core)', padding: '12px', borderRadius: '8px', marginBottom: '18px' }}>
              <strong>Setup Steps on your VPS:</strong>
              <ol style={{ margin: '6px 0 0 18px', padding: 0 }}>
                <li>Copy <code>connectors/mt5-python</code> to your Windows VPS</li>
                <li>Set <code>"pairing_code": "{pairingCode}"</code> in <code>config.json</code></li>
                <li>Run <code>python connector.py</code> to connect!</li>
              </ol>
            </div>

            <button onClick={() => setIsPairingModalOpen(false)} className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
              Done
            </button>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* MODAL 2: Complete MT5 Trade Journal Modal                              */}
      {/* ---------------------------------------------------------------------- */}
      {journalModalTrade && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '640px', padding: '24px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BookOpen size={18} color="var(--accent-cyan)" />
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800', color: 'var(--text-white)' }}>
                  Complete MT5 Trade Journal
                </h3>
              </div>
              <button onClick={() => setJournalModalTrade(null)} className="btn-ghost" style={{ padding: '4px' }}>
                <X size={18} />
              </button>
            </div>

            {/* Read-Only Verified MT5 Broker Data Strip */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '10px',
              padding: '12px 14px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: '8px',
              marginBottom: '16px'
            }}>
              <div>
                <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Instrument</span>
                <p style={{ margin: 0, fontWeight: '800', color: 'var(--accent-cyan)' }}>{journalModalTrade.instrument} ({journalModalTrade.direction})</p>
              </div>
              <div>
                <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Realized Net P&amp;L</span>
                <p style={{ margin: 0, fontWeight: '800', color: journalModalTrade.takeProfitUSD >= 0 ? 'var(--profit)' : 'var(--loss)' }}>
                  {journalModalTrade.takeProfitUSD >= 0 ? '+' : ''}${journalModalTrade.takeProfitUSD}
                </p>
              </div>
              <div>
                <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Volume / Lots</span>
                <p style={{ margin: 0, fontWeight: '800', color: 'var(--text-white)' }}>{journalModalTrade.lotSize || 0.1} Lots</p>
              </div>
              <div>
                <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Broker Ticket</span>
                <p style={{ margin: 0, fontWeight: '700', color: 'var(--text-secondary)' }}>#{journalModalTrade.mt5PositionId}</p>
              </div>
            </div>

            {/* Qualitative Trader Inputs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Setup Grade
                </label>
                <select
                  value={journalForm.setupRating}
                  onChange={e => setJournalForm({ ...journalForm, setupRating: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', background: 'var(--bg-core)', color: '#fff', border: '1px solid var(--border-subtle)' }}
                >
                  <option value="A+">A+ (Highest Conviction)</option>
                  <option value="A">A (Standard Edge)</option>
                  <option value="B+">B+ (Moderate)</option>
                  <option value="B">B (Acceptable)</option>
                  <option value="C">C (Sub-Optimal)</option>
                  <option value="D">D (Rule Breach)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Trading Session
                </label>
                <select
                  value={journalForm.session}
                  onChange={e => setJournalForm({ ...journalForm, session: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', background: 'var(--bg-core)', color: '#fff', border: '1px solid var(--border-subtle)' }}
                >
                  <option value="London">London Session</option>
                  <option value="New York">New York Session</option>
                  <option value="Asian">Asian Session</option>
                  <option value="London + New York">London + NY Overlap</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Emotional State
                </label>
                <select
                  value={journalForm.emotion}
                  onChange={e => setJournalForm({ ...journalForm, emotion: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', background: 'var(--bg-core)', color: '#fff', border: '1px solid var(--border-subtle)' }}
                >
                  <option value="Calm">Calm &amp; Objective</option>
                  <option value="Confident">Confident</option>
                  <option value="FOMO">FOMO (Chasing)</option>
                  <option value="Revenge">Revenge / Frustrated</option>
                  <option value="Impatient">Impatient</option>
                  <option value="Fear">Fearful / Hesitant</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Market Condition
                </label>
                <select
                  value={journalForm.marketCondition}
                  onChange={e => setJournalForm({ ...journalForm, marketCondition: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', background: 'var(--bg-core)', color: '#fff', border: '1px solid var(--border-subtle)' }}
                >
                  <option value="Trending">Trending Cleanly</option>
                  <option value="Ranging">Ranging / Consolidating</option>
                  <option value="Choppy">Choppy / High Spread</option>
                  <option value="Volatile">News Volatility</option>
                </select>
              </div>
            </div>

            {/* Notes */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Trade Execution Notes &amp; Post-Mortem
              </label>
              <textarea
                rows={3}
                value={journalForm.notes}
                onChange={e => setJournalForm({ ...journalForm, notes: e.target.value })}
                placeholder="What was the entry trigger? Why did you enter or exit at this level?"
                style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', background: 'var(--bg-core)', color: '#fff', border: '1px solid var(--border-subtle)', fontSize: '0.82rem' }}
              />
            </div>

            {/* Screenshot Drag/Paste Area */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Chart Screenshot (Press Ctrl+V to paste or click to upload)
              </label>
              {journalForm.screenshotUrl ? (
                <div style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', maxHeight: '180px', border: '1px solid var(--border-subtle)' }}>
                  <img src={journalForm.screenshotUrl} alt="Chart" style={{ width: '100%', height: 'auto', display: 'block' }} />
                  <button
                    onClick={() => setJournalForm({ ...journalForm, screenshotUrl: '' })}
                    className="btn-ghost"
                    style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.6)', color: '#fff', padding: '4px' }}
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div style={{
                  border: '1px dashed var(--border-subtle)',
                  borderRadius: '8px',
                  padding: '16px',
                  textAlign: 'center',
                  background: 'rgba(255, 255, 255, 0.02)',
                  color: 'var(--text-muted)',
                  fontSize: '0.78rem'
                }}>
                  <Camera size={20} style={{ margin: '0 auto 6px', display: 'block' }} />
                  <span>Paste screenshot directly with Ctrl+V from TradingView or Snipping Tool</span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => handleSaveJournal('draft')}
                disabled={savingJournal}
                className="btn-secondary"
                style={{ padding: '8px 16px', fontSize: '0.82rem' }}
              >
                Save Draft
              </button>

              <button
                type="button"
                onClick={() => handleSaveJournal('completed')}
                disabled={savingJournal}
                className="btn-primary"
                style={{ padding: '8px 18px', fontSize: '0.82rem', fontWeight: '800' }}
              >
                <CheckCircle2 size={15} />
                <span>Submit &amp; Audit Journal</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* MODAL 3: Link MT5 Position to Existing Manual Trade                     */}
      {/* ---------------------------------------------------------------------- */}
      {linkModalTrade && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '480px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <LinkIcon size={18} color="var(--accent-cyan)" />
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800', color: 'var(--text-white)' }}>
                  Link MT5 Trade to Existing Record
                </h3>
              </div>
              <button onClick={() => setLinkModalTrade(null)} className="btn-ghost" style={{ padding: '4px' }}>
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: '1.5', margin: '0 0 16px 0' }}>
              If you already manually journaled this trade, select it below to merge MT5 broker verification data without creating duplicate trade records.
            </p>

            <div style={{ marginBottom: '18px' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                Select Manual Trade
              </label>
              <select
                value={selectedManualTradeId}
                onChange={e => setSelectedManualTradeId(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', background: 'var(--bg-core)', color: '#fff', border: '1px solid var(--border-subtle)', fontSize: '0.82rem' }}
              >
                <option value="">-- Choose matching trade --</option>
                {manualTrades.map(t => (
                  <option key={t._id} value={t._id}>
                    {t.date} • {t.instrument} ({t.direction}) • PnL: ${t.takeProfitUSD || t.takeProfit}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setLinkModalTrade(null)} className="btn-secondary" style={{ padding: '7px 14px', fontSize: '0.82rem' }}>
                Cancel
              </button>
              <button
                onClick={handleExecuteLink}
                disabled={!selectedManualTradeId || linkingTrade}
                className="btn-primary"
                style={{ padding: '7px 16px', fontSize: '0.82rem' }}
              >
                Confirm Link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* MODAL 4: Disconnect Account Modal                                      */}
      {/* ---------------------------------------------------------------------- */}
      {disconnectModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '440px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--loss)', marginBottom: '12px' }}>
              <AlertOctagon size={22} />
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800' }}>Disconnect MT5 Terminal?</h3>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: '1.5', margin: '0 0 16px 0' }}>
              This will revoke the connector's API keys and stop live sync.
            </p>

            <div style={{
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              padding: '12px',
              borderRadius: '8px',
              marginBottom: '18px'
            }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--text-white)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={deleteDataOnDisconnect}
                  onChange={e => setDeleteDataOnDisconnect(e.target.checked)}
                />
                <span>Also permanently purge all imported MT5 trade history</span>
              </label>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setDisconnectModalOpen(false)} className="btn-secondary" style={{ padding: '7px 14px', fontSize: '0.82rem' }}>
                Cancel
              </button>
              <button
                onClick={handleConfirmDisconnect}
                disabled={disconnecting}
                className="btn-danger"
                style={{ padding: '7px 16px', fontSize: '0.82rem', background: 'var(--loss)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '800' }}
              >
                {disconnecting ? 'Disconnecting...' : 'Disconnect Terminal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
