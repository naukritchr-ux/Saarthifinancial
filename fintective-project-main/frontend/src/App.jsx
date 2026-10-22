import React, { useState, useContext } from 'react';
import { FinanceProvider, FinanceContext } from './context/FinanceContext';
import { FilterProvider } from './context/FilterContext';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import DataStateBanner from './components/DataStateBanner';
import BudgetSettingsModal from './components/BudgetSettingsModal';
import GlossaryModal from './components/GlossaryModal';

// Page Views
import Dashboard from './pages/Dashboard';
import Franchisees from './pages/Franchisees';
import BDPerformance from './pages/BDPerformance';
import TLPerformance from './pages/TLPerformance';
import JobPortalAnalytics from './pages/JobPortalAnalytics';
import CashOutflow from './pages/CashOutflow';
import Reports from './pages/Reports';
import RunwayRoiTracker from './pages/RunwayRoiTracker';
import GrowthTracking from './pages/GrowthTracking';
import IndustryAnalysis from './pages/IndustryAnalysis';
import CostOfPerformance from './pages/CostOfPerformance';
import Login from './pages/Login';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({ errorInfo });
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px', color: '#fff', background: 'rgba(15, 23, 42, 0.9)', borderRadius: '12px', margin: '20px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
          <h2 style={{ color: '#ef4444', marginBottom: '12px' }}>Something went wrong loading this view</h2>
          <p style={{ color: '#94a3b8', marginBottom: '12px' }}>{this.state.error?.message || 'An unexpected error occurred.'}</p>
          {this.state.errorInfo?.componentStack && (
            <pre style={{ fontSize: '11px', color: '#fca5a5', background: 'rgba(0,0,0,0.4)', padding: '10px', borderRadius: '6px', marginBottom: '16px', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
              {this.state.errorInfo.componentStack}
            </pre>
          )}
          <button 
            className="btn btn-primary"
            onClick={() => { this.setState({ hasError: false, error: null, errorInfo: null }); window.location.reload(); }}
          >
            Reload Application
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppContent() {
  const { currentUser, isSidebarOpen } = useContext(FinanceContext);
  const [activePage, setActivePage] = useState('dashboard');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isGlossaryOpen, setIsGlossaryOpen] = useState(false);

  if (!currentUser) {
    return <Login />;
  }

  // Render the selected page component
  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return <Dashboard setActivePage={setActivePage} setIsSettingsOpen={setIsSettingsOpen} />;
      case 'cost-performance':
        return <CostOfPerformance setActivePage={setActivePage} />;
      case 'franchisees':
        return <Franchisees setActivePage={setActivePage} />;
      case 'bd-performance':
        return <BDPerformance />;
      case 'industry-analysis':
        return <IndustryAnalysis />;
      case 'tl-performance':
        return <TLPerformance setActivePage={setActivePage} />;
      case 'portal-analytics':
        return <JobPortalAnalytics />;
      case 'cash-outflow':
        return <CashOutflow />;
      case 'reports':
        return <Reports />;
      case 'roi-tracker':
        return <RunwayRoiTracker />;
      case 'growth-tracking':
        return <GrowthTracking />;
      default:
        return <Dashboard setActivePage={setActivePage} setIsSettingsOpen={setIsSettingsOpen} />;
    }
  };

  return (
    <div className={`app-container ${!isSidebarOpen ? 'sidebar-collapsed' : ''}`}>
      
      {/* Navigation Sidebar */}
      <Sidebar activePage={activePage} setActivePage={setActivePage} setIsSettingsOpen={setIsSettingsOpen} setIsGlossaryOpen={setIsGlossaryOpen} />

      {/* Primary Page Layout */}
      <main className="main-content">
        <Topbar activePage={activePage} setActivePage={setActivePage} setIsGlossaryOpen={setIsGlossaryOpen} />
        <DataStateBanner />
        <ErrorBoundary>
          {renderPage()}
        </ErrorBoundary>
      </main>

      {/* Budget Settings modal */}
      {isSettingsOpen && (
        <ErrorBoundary>
          <BudgetSettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
        </ErrorBoundary>
      )}

      {/* Glossary & Plain-Language Guide modal */}
      {isGlossaryOpen && (
        <ErrorBoundary>
          <GlossaryModal isOpen={isGlossaryOpen} onClose={() => setIsGlossaryOpen(false)} />
        </ErrorBoundary>
      )}
      
    </div>
  );
}

function App() {
  return (
    <FinanceProvider>
      <FilterProvider>
        <AppContent />
      </FilterProvider>
    </FinanceProvider>
  );
}

export default App;
