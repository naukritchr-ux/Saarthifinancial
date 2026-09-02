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
        {renderPage()}
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
