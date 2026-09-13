import React, { useState, useContext } from 'react';
import { FinanceProvider, FinanceContext } from './context/FinanceContext';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import BudgetSettingsModal from './components/BudgetSettingsModal';

// Page Views
import Dashboard from './pages/Dashboard';
import Franchisees from './pages/Franchisees';
import BDPerformance from './pages/BDPerformance';
import TLPerformance from './pages/TLPerformance';
import JobPortalAnalytics from './pages/JobPortalAnalytics';
import CashOutflow from './pages/CashOutflow';
import Reports from './pages/Reports';
import RunwayRoiTracker from './pages/RunwayRoiTracker';
import Login from './pages/Login';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px', color: '#fff', background: 'rgba(15, 23, 42, 0.9)', borderRadius: '12px', margin: '20px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
          <h2 style={{ color: '#ef4444', marginBottom: '12px' }}>Something went wrong loading this view</h2>
          <p style={{ color: '#94a3b8', marginBottom: '20px' }}>{this.state.error?.message || 'An unexpected error occurred.'}</p>
          <button 
            className="btn btn-primary"
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
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

  if (!currentUser) {
    return <Login />;
  }

  // Render the selected page component
  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return <Dashboard setActivePage={setActivePage} />;
      case 'franchisees':
        return <Franchisees />;
      case 'bd-performance':
        return <BDPerformance />;
      case 'tl-performance':
        return <TLPerformance />;
      case 'portal-analytics':
        return <JobPortalAnalytics />;
      case 'cash-outflow':
        return <CashOutflow />;
      case 'reports':
        return <Reports />;
      case 'roi-tracker':
        return <RunwayRoiTracker />;
      default:
        return <Dashboard setActivePage={setActivePage} />;
    }
  };

  return (
    <div className={`app-container ${!isSidebarOpen ? 'sidebar-collapsed' : ''}`}>
      
      {/* Navigation Sidebar */}
      <Sidebar activePage={activePage} setActivePage={setActivePage} setIsSettingsOpen={setIsSettingsOpen} />

      {/* Primary Page Layout */}
      <main className="main-content">
        <Topbar activePage={activePage} setActivePage={setActivePage} />
        <ErrorBoundary>
          {renderPage()}
        </ErrorBoundary>
      </main>

      {/* Budget Settings modal */}
      <BudgetSettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      
    </div>
  );
}

function App() {
  return (
    <FinanceProvider>
      <AppContent />
    </FinanceProvider>
  );
}

export default App;
