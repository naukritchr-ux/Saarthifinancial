import React from 'react';
import Layout from './components/Layout';
import { useApp } from './context/AppContext';
import Dashboard from './pages/Dashboard';
import DataImport from './pages/DataImport';
import TdsReconciliation from './pages/TdsReconciliation';
import FollowUp from './pages/FollowUp';
import ImportHistory from './pages/ImportHistory';

function AppContent() {
  const { activePage } = useApp();

  switch (activePage) {
    case 'dashboard':
      return <Dashboard />;
    case 'import':
      return <DataImport />;
    case 'reconciliation':
      return <TdsReconciliation />;
    case 'follow-up':
      return <FollowUp />;
    case 'import-history':
      return <ImportHistory />;
    default:
      return <Dashboard />;
  }
}

export default function App() {
  return (
    <Layout>
      <AppContent />
    </Layout>
  );
}
