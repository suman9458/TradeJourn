import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CurrencyProvider } from './context/CurrencyContext';
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { TopTradingHero } from './components/TopTradingHero';
import { ModernPipsDashboard } from './components/ModernPipsDashboard';
import { KPICards } from './components/KPICards';
import { SummaryCards } from './components/SummaryCards';
import { EquityChart } from './components/EquityChart';
import { AnalyticsView } from './components/AnalyticsView';
import { AICoachView } from './components/AICoachView';
import { ReviewsView } from './components/ReviewsView';
import { GoalsView } from './components/GoalsView';
import { TradesTableView } from './components/TradesTableView';
import { MT5IntegrationView } from './components/MT5IntegrationView';
import { QuickAddTradeModal } from './components/QuickAddTradeModal';
import { ResetDatasetModal } from './components/ResetDatasetModal';
import { ExportPDFModal } from './components/ExportPDFModal';
import { AuthModal } from './components/AuthModal';
import { AuthPage } from './components/AuthPage';
import { SettingsModal } from './components/SettingsModal';
import { SetupPinModal } from './components/SetupPinModal';
import { FeedbackResponsesView } from './components/FeedbackResponsesView';
import { FloatingFeedbackWidget } from './components/FloatingFeedbackWidget';
import { ErrorBoundary } from './components/ErrorBoundary';
import { api } from './services/api';
import { exportTradeHistoryPDF } from './utils/exportPDF';

const VALID_TABS = ['overview', 'charts', 'analytics', 'ai-coach', 'reviews', 'goals', 'database', 'mt5', 'feedback-responses'];

const TAB_TITLES = {
  overview: 'TradeJourn - Command Overview',
  charts: 'TradeJourn - Pips & Profit Trajectory',
  analytics: 'TradeJourn - Deep Analytics',
  'ai-coach': 'TradeJourn - AI Trading Coach',
  reviews: 'TradeJourn - Performance Reviews',
  goals: 'TradeJourn - Prop Goals & Milestones',
  database: 'TradeJourn - Database Ledger',
  mt5: 'TradeJourn - MT5 Integration',
  'feedback-responses': 'TradeJourn - Feedback Responses'
};

const DashboardContent = () => {
  const { user, token, loading } = useAuth();
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab && VALID_TABS.includes(tab)) {
        return tab;
      }
    }
    return 'overview';
  });

  // Modals & Navigation
  const [isAddTradeOpen, setIsAddTradeOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isExportPDFOpen, setIsExportPDFOpen] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSetupPinOpen, setIsSetupPinOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  // Data state
  const [stats, setStats] = useState(null);
  const [breakdowns, setBreakdowns] = useState(null);
  const [earlyExits, setEarlyExits] = useState(null);
  const [equityCurve, setEquityCurve] = useState([]);
  const [reviews, setReviews] = useState(null);
  const [recentTrades, setRecentTrades] = useState([]);
  const [allTrades, setAllTrades] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);

  // Global Theme State: dark | light
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('theme')) return params.get('theme');
    }
    return localStorage.getItem('tradejourn_theme') || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('tradejourn_theme', theme);
  }, [theme]);

  // Auto-prompt to set 4-digit Security PIN on login or restart if not yet configured
  useEffect(() => {
    if (!loading && token && user) {
      const isDemo = user.role === 'demo' || user.isDemo || user.email === 'protrader@tradejourn.com';
      const isDismissed = sessionStorage.getItem('tradejourn_dismissed_pin_prompt') === 'true';
      if (!isDemo && !user.hasSecurityPin && !isDismissed) {
        const timer = setTimeout(() => {
          setIsSetupPinOpen(true);
        }, 700);
        return () => clearTimeout(timer);
      }
    }
  }, [loading, token, user?.hasSecurityPin]);

  const handleCloseSetupPin = () => {
    sessionStorage.setItem('tradejourn_dismissed_pin_prompt', 'true');
    setIsSetupPinOpen(false);
  };

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const fetchDashboardData = async () => {
    if (!token) return;
    try {
      const [kpiRes, breakdownRes, earlyRes, curveRes, reviewRes, recentRes, allRes] = await Promise.all([
        api.getKPIs().catch(() => null),
        api.getBreakdowns().catch(() => null),
        api.getEarlyExits().catch(() => null),
        api.getEquityCurve().catch(() => null),
        api.getReviews().catch(() => null),
        api.getTrades({ limit: 8, sortBy: 'date', order: 'desc' }).catch(() => null),
        api.getTrades({ limit: 1000, sortBy: 'date', order: 'desc' }).catch(() => null)
      ]);

      if (kpiRes?.success) setStats(kpiRes.stats);
      if (breakdownRes?.success) setBreakdowns(breakdownRes.data);
      if (earlyRes?.success) setEarlyExits(earlyRes.data);
      if (curveRes?.success) setEquityCurve(curveRes.curve);
      if (reviewRes?.success) setReviews(reviewRes.reviews);
      if (recentRes?.success) setRecentTrades(recentRes.trades);
      if (allRes?.success && Array.isArray(allRes.trades) && allRes.trades.length > 0) {
        setAllTrades(allRes.trades);
      } else if (recentRes?.success && Array.isArray(recentRes.trades) && recentRes.trades.length > 0) {
        setAllTrades(recentRes.trades);
      }
    } catch (err) {
      console.error('Error fetching dashboard metrics:', err);
    }
  };

  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  // History-aware navigation handler (supports browser Back / Forward on a single click)
  const handleTabChange = useCallback((nextTab, pushHistory = true) => {
    const valid = VALID_TABS.includes(nextTab) ? nextTab : 'overview';
    if (valid === activeTabRef.current) return;

    activeTabRef.current = valid;
    setActiveTab(valid);

    const url = new URL(window.location.href);
    url.searchParams.set('tab', valid);

    // Prevent duplicate consecutive entries in history
    const currentHistoryTab = window.history.state?.tab;
    if (pushHistory && currentHistoryTab !== valid) {
      window.history.pushState({ tab: valid }, '', url.toString());
    } else {
      window.history.replaceState({ tab: valid }, '', url.toString());
    }

    document.title = TAB_TITLES[valid] || 'TradeJourn';
  }, []);

  // Synchronize browser history and listen for Back / Forward (popstate) events
  useEffect(() => {
    // 1. Sync initial history entry on first load so Back button has an anchor state
    const params = new URLSearchParams(window.location.search);
    const initialTabFromUrl = params.get('tab');
    const initialTab = (initialTabFromUrl && VALID_TABS.includes(initialTabFromUrl)) ? initialTabFromUrl : activeTab;
    const url = new URL(window.location.href);
    url.searchParams.set('tab', initialTab);
    window.history.replaceState({ tab: initialTab }, '', url.toString());
    document.title = TAB_TITLES[initialTab] || 'TradeJourn';

    // 2. Handle popstate when user clicks browser Back / Forward or mouse Back button
    const handlePopState = (event) => {
      // Dismiss any open modal overlays
      setIsAddTradeOpen(false);
      setIsResetModalOpen(false);
      setIsExportPDFOpen(false);
      setIsSettingsOpen(false);
      setIsAuthOpen(false);
      setIsMobileNavOpen(false);

      const urlParams = new URLSearchParams(window.location.search);
      const targetTab = event.state?.tab || urlParams.get('tab') || 'overview';
      const valid = VALID_TABS.includes(targetTab) ? targetTab : 'overview';

      activeTabRef.current = valid;
      setActiveTab(valid);
      document.title = TAB_TITLES[valid] || 'TradeJourn';
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [token, refreshKey]);

  const handleRefresh = () => {
    setRefreshKey(k => k + 1);
  };



  const handleConfirmReset = async () => {
    try {
      setIsResetting(true);
      await api.clearAllTrades();

      // Immediately reset client-side dataset state to 0
      setAllTrades([]);
      setRecentTrades([]);
      setEquityCurve([]);
      setStats({
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        breakEvenTrades: 0,
        winRate: 0,
        lossRate: 0,
        totalR: 0,
        avgR: 0,
        avgWin: 0,
        avgLoss: 0,
        profitFactor: 0,
        totalPips: 0,
        pipsGain: 0,
        loosePips: 0,
        avgPips: 0,
        bestTrade: 0,
        worstTrade: 0,
        currentWinStreak: 0,
        currentLossStreak: 0,
        maxWinStreak: 0,
        maxLossStreak: 0,
        aPlusWinRate: 0,
        earlyExitCount: 0,
        emotionalTradeCount: 0,
        disciplineScoreAverage: 0
      });
      setBreakdowns({ setups: [], sessions: [], biases: [], emotions: [], mistakes: [] });
      setEarlyExits({ earlyExits: [], breakdown: [] });
      setReviews({
        daily: { hasData: false, message: 'No trades recorded yet for review.' },
        weekly: { hasData: false, message: 'No trades recorded yet for review.' },
        monthly: { hasData: false, message: 'No trades recorded yet for review.' }
      });

      // Sync across dashboard
      setRefreshKey(k => k + 1);
      setIsResetModalOpen(false);
    } catch (err) {
      console.error('Failed to reset dataset:', err);
      alert('Failed to reset dataset: ' + (err.message || 'Unknown error'));
    } finally {
      setIsResetting(false);
    }
  };

  const handleExecuteExportPDF = async (options) => {
    try {
      setIsGeneratingPDF(true);
      let tradesToExport = Array.isArray(allTrades) && allTrades.length > 0 ? allTrades : [];
      if (tradesToExport.length === 0) {
        try {
          const res = await api.getTrades({ limit: 5000, sortBy: 'date', order: 'desc' });
          if (res?.success && Array.isArray(res.trades) && res.trades.length > 0) {
            tradesToExport = res.trades;
          }
        } catch (e) {
          console.warn('API getTrades failed for PDF export:', e);
        }
      }
      if (tradesToExport.length === 0 && Array.isArray(recentTrades) && recentTrades.length > 0) {
        tradesToExport = recentTrades;
      }

      exportTradeHistoryPDF({
        trades: tradesToExport || [],
        user,
        stats,
        options
      });
      setIsExportPDFOpen(false);
    } catch (err) {
      alert('PDF export error: ' + err.message);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg-core)' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spin" style={{ width: '40px', height: '40px', border: '3px solid rgba(0, 245, 155, 0.15)', borderTopColor: 'var(--profit)', borderRadius: '50%', margin: '0 auto 16px' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', letterSpacing: '0.1em', fontWeight: '700' }}>
            CONNECTING TO INSTITUTIONAL LEDGER...
          </p>
        </div>
      </div>
    );
  }

  if (!token) {
    return <AuthPage onDemoAccess={fetchDashboardData} theme={theme} onToggleTheme={toggleTheme} />;
  }

  return (
    <div className="app-container">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        stats={stats}
        onOpenAuth={() => setIsAuthOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isOpen={isMobileNavOpen}
        onClose={() => setIsMobileNavOpen(false)}
      />

      <main className="main-wrapper">
        <Navbar
          onOpenAddTrade={() => setIsAddTradeOpen(true)}
          onExportPDF={() => setIsExportPDFOpen(true)}
          onRefresh={() => setIsResetModalOpen(true)}
          onResetDataset={() => setIsResetModalOpen(true)}
          onToggleSidebar={() => setIsMobileNavOpen(prev => !prev)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenAuth={() => setIsAuthOpen(true)}
          theme={theme}
          onToggleTheme={toggleTheme}
        />

        <ErrorBoundary key={activeTab}>
          {activeTab === 'overview' && (
            <ModernPipsDashboard
              stats={stats}
              trades={allTrades}
              recentTrades={recentTrades}
              breakdowns={breakdowns}
              curve={equityCurve}
              onOpenAddTrade={() => setIsAddTradeOpen(true)}
              onTradeUpdated={handleRefresh}
              onNavigateTab={handleTabChange}
            />
          )}

          {activeTab === 'charts' && (
            <EquityChart curve={equityCurve} />
          )}

          {activeTab === 'analytics' && (
            <AnalyticsView breakdowns={breakdowns} trades={allTrades} />
          )}

          {activeTab === 'ai-coach' && (
            <AICoachView trades={allTrades} />
          )}

          {activeTab === 'reviews' && (
            <ReviewsView reviews={reviews} trades={allTrades} />
          )}


          {activeTab === 'goals' && (
            <GoalsView stats={stats} trades={allTrades} />
          )}

          {activeTab === 'database' && (
            <TradesTableView
              initialTrades={allTrades}
              onTradeDeleted={handleRefresh}
              onTradeUpdated={handleRefresh}
              title="Database Views & Complete Trade Ledger"
            />
          )}

          {activeTab === 'mt5' && (
            <MT5IntegrationView trades={allTrades} stats={stats} />
          )}

          {activeTab === 'feedback-responses' && (
            <FeedbackResponsesView theme={theme} />
          )}
        </ErrorBoundary>
      </main>

      <FloatingFeedbackWidget
        activeTab={activeTab}
        onNavigateTab={handleTabChange}
        theme={theme}
      />

      <QuickAddTradeModal
        isOpen={isAddTradeOpen}
        onClose={() => setIsAddTradeOpen(false)}
        onTradeSaved={handleRefresh}
      />

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      <SetupPinModal
        isOpen={isSetupPinOpen}
        onClose={handleCloseSetupPin}
      />

      <ResetDatasetModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        onConfirm={handleConfirmReset}
        loading={isResetting}
      />

      <ExportPDFModal
        isOpen={isExportPDFOpen}
        onClose={() => setIsExportPDFOpen(false)}
        onExport={handleExecuteExportPDF}
        loading={isGeneratingPDF}
        totalTradesCount={allTrades.length}
      />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <CurrencyProvider>
        <DashboardContent />
      </CurrencyProvider>
    </AuthProvider>
  );
}
