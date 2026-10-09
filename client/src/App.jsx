import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
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
import { QuickAddTradeModal } from './components/QuickAddTradeModal';
import { ResetDatasetModal } from './components/ResetDatasetModal';
import { ExportPDFModal } from './components/ExportPDFModal';
import { AuthModal } from './components/AuthModal';
import { AuthPage } from './components/AuthPage';
import { SettingsModal } from './components/SettingsModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { api } from './services/api';
import { exportTradeHistoryPDF } from './utils/exportPDF';

const DashboardContent = () => {
  const { user, token, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');

  // Modals & Navigation
  const [isAddTradeOpen, setIsAddTradeOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isExportPDFOpen, setIsExportPDFOpen] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
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
      if (allRes?.success) setAllTrades(allRes.trades);
    } catch (err) {
      console.error('Error fetching dashboard metrics:', err);
    }
  };

  useEffect(() => {
    document.title = 'TradeJourn';
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
    return <AuthPage onDemoAccess={fetchDashboardData} />;
  }

  return (
    <div className="app-container">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
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
            />
          )}

          {activeTab === 'charts' && (
            <EquityChart curve={equityCurve} />
          )}

          {activeTab === 'analytics' && (
            <AnalyticsView breakdowns={breakdowns} trades={allTrades} />
          )}

          {activeTab === 'ai-coach' && (
            <AICoachView />
          )}

          {activeTab === 'reviews' && (
            <ReviewsView reviews={reviews} />
          )}


          {activeTab === 'goals' && (
            <GoalsView stats={stats} trades={allTrades} />
          )}

          {activeTab === 'database' && (
            <TradesTableView onTradeDeleted={handleRefresh} title="Database Views & Complete Trade Ledger" />
          )}
        </ErrorBoundary>
      </main>

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
      <DashboardContent />
    </AuthProvider>
  );
}
