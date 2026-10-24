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
  CheckCircle,
  Edit2,
  Download
} from 'lucide-react';
import { api } from '../services/api';
import { compressImageFile, processAndUploadChartImage } from '../utils/imageHelper';



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
    serverName: '',
    login: '',
    password: '',
    accountName: '',
    tradeMode: 'demo',
    initialBalance: '',
    currency: 'USD',
    leverage: 1000
  });
  const [connectingCloud, setConnectingCloud] = useState(false);
  const [cloudError, setCloudError] = useState('');

  // Connector Config Modal (Desktop MT5 Windows)
  const [connectorConfigModalOpen, setConnectorConfigModalOpen] = useState(false);
  const [connectorConfig, setConnectorConfig] = useState(null);
  const [copiedConfig, setCopiedConfig] = useState(false);

  // Edit Capital Modal
  const [isEditCapitalOpen, setIsEditCapitalOpen] = useState(false);
  const [editCapitalForm, setEditCapitalForm] = useState({ balance: 1000, currency: 'USD', leverage: 1000 });

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



  const handleOpenConnectorConfig = async () => {
    const target = activeAccount || accounts[0];
    if (target) {
      try {
        const res = await api.getMT5ConnectorConfig(target._id);
        if (res.success) {
          setConnectorConfig(res.config);
          setConnectorConfigModalOpen(true);
          return;
        }
      } catch (err) {
        console.warn('Could not fetch connector config:', err);
      }
    }
    // Reliable VPS / Desktop connector config
    const host = window.location.origin.includes('localhost') ? 'http://localhost:5000' : 'https://tradejourn.onrender.com';
    setConnectorConfig({
      backend_url: host,
      api_key_id: activeAccount?.apiKeyId || 'mt5_key_1fdced6694ef0ca4',
      api_secret: 'c127089160a2fe714baafd841a38fb621ad71c5d77201cd4bdcbd32f9824ed7a',
      polling_interval_sec: 5,
      history_backfill_days: 30,
      mt5: {
        login: activeAccount?.login ? Number(activeAccount.login) : 434413217,
        password: "YOUR_INVESTOR_PASSWORD",
        server: activeAccount?.server || "Exness-MT5Trial7"
      }
    });
    setConnectorConfigModalOpen(true);
  };

  const handleCopyConfig = () => {
    if (!connectorConfig) return;
    navigator.clipboard.writeText(JSON.stringify(connectorConfig, null, 2));
    setCopiedConfig(true);
    setTimeout(() => setCopiedConfig(false), 2000);
  };

  const handleDownloadConfigFile = () => {
    if (!connectorConfig) return;
    const blob = new Blob([JSON.stringify(connectorConfig, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'config.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleOpenEditCapital = () => {
    if (!activeAccount) return;
    setEditCapitalForm({
      balance: activeAccount.balance || 1000,
      currency: activeAccount.currency || 'USD',
      leverage: activeAccount.leverage || 1000
    });
    setIsEditCapitalOpen(true);
  };

  const handleSaveCapital = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!activeAccount) return;
    try {
      await api.updateMT5Account(activeAccount._id, {
        balance: Number(editCapitalForm.balance),
        currency: editCapitalForm.currency,
        leverage: Number(editCapitalForm.leverage)
      });
      setIsEditCapitalOpen(false);
      setToastMessage('Account balance updated to ' + editCapitalForm.currency + ' ' + Number(editCapitalForm.balance).toFixed(2));
      await fetchAccountsData();
    } catch (err) {
      alert('Failed to update balance: ' + err.message);
    }
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
        tradeMode: cloudForm.tradeMode,
        initialBalance: cloudForm.initialBalance ? Number(cloudForm.initialBalance) : undefined,
        currency: cloudForm.currency || 'USD',
        leverage: cloudForm.leverage ? Number(cloudForm.leverage) : 100
      });

      if (res.success) {
        setIsCloudModalOpen(false);
        setToastMessage(`Connected MT5 Account #${res.account?.login || cloudForm.login} (${res.account?.tradeMode?.toUpperCase() || 'LIVE'})!`);
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
              const cdnUrl = await processAndUploadChartImage(file);
              setJournalForm(prev => ({ ...prev, screenshotUrl: cdnUrl }));
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
            className="btn-cloud-connect"
            style={{ border: 'none' }}
          >
            <CloudLightning size={14} />
            <span>Connect MT5 Account</span>
          </button>

          <button
            onClick={handleOpenConnectorConfig}
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', fontSize: '0.8rem', fontWeight: '700' }}
            title="VPS & Windows MT5 Python Connector Setup (Windows / VPS 24/7)"
          >
            <Server size={14} color="var(--accent-cyan)" />
            <span>VPS / Desktop Setup</span>
          </button>

          {activeAccount && (
            <button
              onClick={handleOpenEditCapital}
              className="btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', fontSize: '0.8rem', fontWeight: '700' }}
              title="Edit Account Balance & Settings"
            >
              <DollarSign size={14} color="var(--accent-cyan)" />
              <span>Edit Balance</span>
            </button>
          )}

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
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: '700' }}>ACTIVE ACCOUNT:</span>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              style={{
                background: 'var(--bg-core)',
                border: '1px solid var(--border-medium)',
                color: 'var(--text-primary)',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '0.84rem',
                fontWeight: '700',
                outline: 'none'
              }}
            >
              {accounts.map(acc => (
                <option key={acc._id} value={acc._id} style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                  {acc.serverName} • #{acc.login} ({acc.tradeMode?.toUpperCase()})
                </option>
              ))}
            </select>

            {activeAccount && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '3px 10px',
                borderRadius: '6px',
                background: activeAccount.tradeMode === 'live' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(14, 165, 233, 0.12)',
                color: activeAccount.tradeMode === 'live' ? '#ef4444' : 'var(--accent-cyan)',
                border: activeAccount.tradeMode === 'live' ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(14, 165, 233, 0.3)',
                fontSize: '0.72rem',
                fontWeight: '800'
              }}>
                <span style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: activeAccount.tradeMode === 'live' ? '#ef4444' : 'var(--accent-cyan)',
                  boxShadow: activeAccount.tradeMode === 'live' ? '0 0 6px #ef4444' : 'none',
                  display: 'inline-block'
                }} />
                <span>{activeAccount.tradeMode === 'live' ? 'LIVE REAL ACCOUNT ACTIVE' : 'CLOUD MT5 DEMO ACTIVE'}</span>
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
        <div className="mt5-kpi-grid" style={{ marginBottom: '22px' }}>
          <div className="kpi-card neutral">
            <div className="kpi-top">
              <span>Account Balance</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  type="button"
                  onClick={handleOpenEditCapital}
                  title="Edit Account Balance"
                  style={{
                    background: 'rgba(14, 165, 233, 0.1)',
                    border: '1px solid rgba(14, 165, 233, 0.3)',
                    borderRadius: '5px',
                    padding: '2px 7px',
                    color: 'var(--accent-cyan)',
                    cursor: 'pointer',
                    fontSize: '0.7rem',
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Edit2 size={11} />
                  <span>Edit</span>
                </button>
                <DollarSign size={15} color="var(--accent-cyan)" />
              </div>
            </div>
            <div className="kpi-value">
              {activeAccount.currency === 'EUR' ? '€' : activeAccount.currency === 'GBP' ? '£' : activeAccount.currency === 'INR' ? '₹' : activeAccount.currency === 'JPY' ? '¥' : '$'}
              {(activeAccount.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
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
              {activeAccount.currency === 'EUR' ? '€' : activeAccount.currency === 'GBP' ? '£' : activeAccount.currency === 'INR' ? '₹' : activeAccount.currency === 'JPY' ? '¥' : '$'}
              {(activeAccount.equity || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
              {(activeAccount.floatingProfit || 0) >= 0 ? '+' : ''}
              {activeAccount.currency === 'EUR' ? '€' : activeAccount.currency === 'GBP' ? '£' : activeAccount.currency === 'INR' ? '₹' : activeAccount.currency === 'JPY' ? '¥' : '$'}
              {(activeAccount.floatingProfit || 0).toFixed(2)}
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
              {activeAccount.currency === 'EUR' ? '€' : activeAccount.currency === 'GBP' ? '£' : activeAccount.currency === 'INR' ? '₹' : activeAccount.currency === 'JPY' ? '¥' : '$'}
              {(activeAccount.freeMargin || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} Free
            </div>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Used: ${(activeAccount.margin || 0).toFixed(1)} • {Math.round(activeAccount.marginLevel || 0)}%
            </p>
          </div>
        </div>
      ) : (
        /* Zero State: Cloud MT5 Direct Web Login OR VPS/Desktop Connector */
        <div className="cloud-mt5-hero-card">
          <div className="cloud-mt5-hero-icon">
            <Server size={28} />
          </div>

          <span className="cloud-mt5-hero-badge">
            2 Integration Modes: Direct Cloud API &amp; 24/7 VPS / Desktop Bridge
          </span>

          <h3 className="cloud-mt5-hero-title">
            Connect MetaTrader 5 (Cloud Web or 24/7 VPS)
          </h3>
          <p className="cloud-mt5-hero-desc">
            Choose between instant direct Cloud Web login, or run the 100% Free Python Connector 24/7 on your Windows VPS or laptop for real-time trade ingestion.
          </p>

          <div className="cloud-mt5-hero-features">
            <div className="cloud-mt5-hero-feature-item">
              <CheckCircle size={15} color="var(--profit)" />
              <span>Direct Web Login</span>
            </div>
            <div className="cloud-mt5-hero-feature-item">
              <CheckCircle size={15} color="var(--profit)" />
              <span>24/7 VPS &amp; Desktop Bridge</span>
            </div>
            <div className="cloud-mt5-hero-feature-item">
              <CheckCircle size={15} color="var(--profit)" />
              <span>100% Free &amp; Read-Only</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '20px' }}>
            <button
              onClick={handleOpenCloudModal}
              className="cloud-mt5-hero-btn"
            >
              <CloudLightning size={18} />
              <span>Connect MT5 Cloud</span>
            </button>

            <button
              onClick={handleOpenConnectorConfig}
              className="cloud-mt5-hero-btn"
              style={{
                background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.25), rgba(59, 130, 246, 0.45))',
                border: '1px solid rgba(14, 165, 233, 0.6)',
                color: '#ffffff'
              }}
            >
              <Server size={18} color="var(--accent-cyan)" />
              <span>VPS / Desktop Setup (24/7 Free)</span>
            </button>
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
              {/* Field 1: Broker Server Name */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Broker Server Name *
                </label>
                <input
                  type="text"
                  value={cloudForm.serverName}
                  onChange={e => setCloudForm({ ...cloudForm, serverName: e.target.value })}
                  placeholder="Paste or type broker server (e.g. Exness-MT5Trial7 or Exness-MT5Real)"
                  required
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    borderRadius: '8px',
                    background: 'var(--bg-core)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-medium)',
                    fontSize: '0.92rem',
                    fontFamily: 'var(--font-mono)'
                  }}
                />
              </div>

              {/* Field 2 & 3: Account Number & Password */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                    Account Login Number *
                  </label>
                  <input
                    type="number"
                    value={cloudForm.login}
                    onChange={e => setCloudForm({ ...cloudForm, login: e.target.value })}
                    placeholder="e.g. 434413217"
                    required
                    style={{
                      width: '100%',
                      padding: '11px 14px',
                      borderRadius: '8px',
                      background: 'var(--bg-core)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-medium)',
                      fontSize: '0.92rem',
                      fontFamily: 'var(--font-mono)'
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                    Investor Password *
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
                        padding: '11px 38px 11px 14px',
                        borderRadius: '8px',
                        background: 'var(--bg-core)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-medium)',
                        fontSize: '0.92rem'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: 'absolute',
                        right: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '2px'
                      }}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Field 4: Account Type */}
              <div style={{ marginBottom: '22px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Account Type
                </label>
                <select
                  value={cloudForm.tradeMode}
                  onChange={e => setCloudForm({ ...cloudForm, tradeMode: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    borderRadius: '8px',
                    background: 'var(--bg-core)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-medium)',
                    fontSize: '0.9rem',
                    fontWeight: '600'
                  }}
                >
                  <option value="demo">Demo Account</option>
                  <option value="live">Live / Real Account</option>
                </select>
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
                  className="btn-cloud-connect"
                  style={{
                    padding: '9px 22px',
                    fontSize: '0.86rem',
                    border: 'none'
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
              background: 'var(--bg-core)',
              border: '1px solid var(--border-medium)',
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
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', background: 'var(--bg-core)', color: 'var(--text-primary)', border: '1px solid var(--border-medium)' }}
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
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', background: 'var(--bg-core)', color: 'var(--text-primary)', border: '1px solid var(--border-medium)' }}
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
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', background: 'var(--bg-core)', color: 'var(--text-primary)', border: '1px solid var(--border-medium)' }}
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
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', background: 'var(--bg-core)', color: 'var(--text-primary)', border: '1px solid var(--border-medium)' }}
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
                style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', background: 'var(--bg-core)', color: 'var(--text-primary)', border: '1px solid var(--border-medium)', fontSize: '0.82rem' }}
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
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', background: 'var(--bg-core)', color: 'var(--text-primary)', border: '1px solid var(--border-medium)', fontSize: '0.82rem' }}
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
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800' }}>Disconnect MT5 Account?</h3>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: '1.5', margin: '0 0 16px 0' }}>
              This will disconnect your cloud MT5 account and stop live sync.
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
                {disconnecting ? 'Disconnecting...' : 'Disconnect Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* MODAL 5: VPS & Desktop MT5 Connector Setup (Windows / VPS 24/7)         */}
      {/* ---------------------------------------------------------------------- */}
      {connectorConfigModalOpen && connectorConfig && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '620px', padding: '26px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Server size={22} color="var(--accent-cyan)" />
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-white)' }}>
                  VPS &amp; Windows MT5 Connector Setup (24/7 Free Sync)
                </h3>
              </div>
              <button onClick={() => setConnectorConfigModalOpen(false)} className="btn-ghost" style={{ padding: '4px' }}>
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: '1.5', margin: '0 0 16px 0' }}>
              Connect any MT5 account (Exness, FTMO, XM, etc.) from your <strong>Windows VPS or Personal PC</strong> with 100% Free 24/7 auto-sync.
            </p>

            {/* 1-Click Action Buttons for New Users */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginBottom: '16px' }}>
              <a
                href="/tradejourn-mt5-connector.zip"
                download="tradejourn-mt5-connector.zip"
                className="btn-primary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '10px 14px',
                  fontSize: '0.82rem',
                  textDecoration: 'none',
                  borderRadius: '9px',
                  fontWeight: '700',
                  background: 'linear-gradient(135deg, #0ea5e9, #2563eb)'
                }}
              >
                <Download size={15} />
                <span>1. Download Connector (.zip)</span>
              </a>

              <button
                type="button"
                onClick={handleDownloadConfigFile}
                className="btn-secondary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '10px 14px',
                  fontSize: '0.82rem',
                  borderRadius: '9px',
                  fontWeight: '700'
                }}
              >
                <Download size={15} />
                <span>2. Download config.json</span>
              </button>
            </div>

            {/* Quick Steps Guide */}
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-medium)', borderRadius: '10px', padding: '14px 16px', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              <strong style={{ color: 'var(--text-white)', display: 'block', marginBottom: '10px', fontSize: '0.85rem' }}>
                🚀 Simple 3-Step Setup for New Users:
              </strong>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <span style={{ background: 'rgba(14, 165, 233, 0.15)', color: 'var(--accent-cyan)', padding: '2px 8px', borderRadius: '6px', fontWeight: '800', fontSize: '0.74rem' }}>1</span>
                  <span><strong>Open MT5 Terminal:</strong> Keep your Exness / broker MT5 terminal running logged into account <strong style={{ color: 'var(--text-white)' }}>#{connectorConfig.mt5?.login}</strong>. <em>(MetaEditor open karne ki bilkul zaroorat nahi hai).</em></span>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <span style={{ background: 'rgba(14, 165, 233, 0.15)', color: 'var(--accent-cyan)', padding: '2px 8px', borderRadius: '6px', fontWeight: '800', fontSize: '0.74rem' }}>2</span>
                  <span><strong>Extract &amp; Paste Config:</strong> <code style={{ color: 'var(--accent-cyan)' }}>tradejourn-mt5-connector.zip</code> ko extract karein aur downloaded <code style={{ color: 'var(--profit)' }}>config.json</code> ko usi folder ke andar daal kar apna password likhein.</span>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--profit)', padding: '2px 8px', borderRadius: '6px', fontWeight: '800', fontSize: '0.74rem' }}>3</span>
                  <span><strong>Run Connector:</strong> Folder me <code style={{ color: 'var(--profit)', fontWeight: 'bold' }}>run_connector.bat</code> par double-click karein! Automatic connection ban jayega aur trades sync hone lagengi.</span>
                </div>
              </div>
            </div>

            {/* Config preview & copy */}
            <div style={{ position: 'relative', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Config Preview:</span>
                <button
                  type="button"
                  onClick={handleCopyConfig}
                  className="btn-secondary"
                  style={{ padding: '4px 10px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '5px' }}
                >
                  {copiedConfig ? <Check size={12} color="var(--profit)" /> : <Copy size={12} />}
                  <span>{copiedConfig ? 'Copied!' : 'Copy Code'}</span>
                </button>
              </div>
              <pre style={{
                background: 'var(--bg-core)',
                border: '1px solid var(--border-medium)',
                borderRadius: '10px',
                padding: '12px',
                fontSize: '0.78rem',
                color: 'var(--accent-cyan)',
                overflowX: 'auto',
                fontFamily: 'var(--font-mono)',
                maxHeight: '160px',
                margin: 0
              }}>
                {JSON.stringify(connectorConfig, null, 2)}
              </pre>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setConnectorConfigModalOpen(false)} className="btn-primary" style={{ padding: '8px 22px', fontSize: '0.84rem' }}>
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* MODAL 6: Edit Account Balance & Capital Settings                        */}
      {/* ---------------------------------------------------------------------- */}
      {isEditCapitalOpen && activeAccount && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '440px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <DollarSign size={20} color="var(--accent-cyan)" />
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800', color: 'var(--text-white)' }}>
                  Edit Account Capital
                </h3>
              </div>
              <button onClick={() => setIsEditCapitalOpen(false)} className="btn-ghost" style={{ padding: '4px' }}>
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: '1.5', margin: '0 0 16px 0' }}>
              Update the balance and leverage for account <strong style={{ color: 'var(--text-white)' }}>#{activeAccount.login}</strong> to match your Exness terminal.
            </p>

            <form onSubmit={handleSaveCapital}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Account Balance ({editCapitalForm.currency})
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={editCapitalForm.balance}
                    onChange={(e) => setEditCapitalForm({ ...editCapitalForm, balance: e.target.value })}
                    style={{
                      width: '100%',
                      background: 'var(--bg-core)',
                      border: '1px solid var(--border-medium)',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      color: 'var(--text-white)',
                      fontSize: '1rem',
                      fontWeight: '700'
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Currency
                    </label>
                    <select
                      value={editCapitalForm.currency}
                      onChange={(e) => setEditCapitalForm({ ...editCapitalForm, currency: e.target.value })}
                      style={{
                        width: '100%',
                        background: 'var(--bg-core)',
                        border: '1px solid var(--border-medium)',
                        borderRadius: '8px',
                        padding: '10px 12px',
                        color: 'var(--text-white)',
                        fontSize: '0.88rem'
                      }}
                    >
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                      <option value="INR">INR (₹)</option>
                      <option value="JPY">JPY (¥)</option>
                      <option value="USDT">USDT</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Leverage (1:X)
                    </label>
                    <input
                      type="number"
                      value={editCapitalForm.leverage}
                      onChange={(e) => setEditCapitalForm({ ...editCapitalForm, leverage: e.target.value })}
                      style={{
                        width: '100%',
                        background: 'var(--bg-core)',
                        border: '1px solid var(--border-medium)',
                        borderRadius: '8px',
                        padding: '10px 12px',
                        color: 'var(--text-white)',
                        fontSize: '0.88rem'
                      }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsEditCapitalOpen(false)}
                  className="btn-secondary"
                  style={{ padding: '8px 16px', fontSize: '0.84rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ padding: '8px 20px', fontSize: '0.84rem' }}
                >
                  Save Balance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
