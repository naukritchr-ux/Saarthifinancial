import React, { useContext, useState, useMemo } from 'react';
import { FinanceContext } from '../context/FinanceContext';
import { formatLakhs } from '../utils/formatters';
import { 
  CloudDownload, 
  RefreshCw, 
  AlertTriangle, 
  AlertCircle, 
  Clock, 
  ServerOff, 
  KeyRound, 
  Info, 
  CheckCircle2, 
  X,
  Database,
  Activity,
  HelpCircle
} from 'lucide-react';
import SyncModal from './SyncModal';

const Topbar = ({ activePage, setActivePage, setIsGlossaryOpen }) => {
  const { 
    moduleFilteredTransactions, 
    selectedMonth, 
    setSelectedMonth, 
    availableMonths,
    selectedYear,
    setSelectedYear,
    availableYears,
    userRole,
    currentUser,
    activeModule,
    isBackgroundSyncing,
    lastSyncedAt,
    fetchAllData,
    dataState,
    dataSource,
    authError,
    backendHealth,
    connectionProgress,
    endpointStatus,
    timeAgo,
    currentCashBalance
  } = useContext(FinanceContext);

  const [isSyncOpen, setIsSyncOpen] = useState(false);
  const [showHealthModal, setShowHealthModal] = useState(false);

  // Calculate quick metrics for the top badge using module-filtered data (memoized)
  const roleFilteredTxs = useMemo(() => {
    if (!Array.isArray(moduleFilteredTransactions)) return [];
    return moduleFilteredTransactions.filter(tx => {
      if (!tx) return false;
      if (userRole === 'admin') return true;
      if (userRole.startsWith('franchise_')) {
        const fId = userRole.split('_')[1];
        return tx.franchiseeId === fId;
      }
      if (userRole.startsWith('bd_')) {
        const bdId = userRole.split('_')[1];
        return tx.bdAgentId === bdId;
      }
      return true;
    });
  }, [moduleFilteredTransactions, userRole]);

  // Clearly scoped P&L calculation (strictly scoped to selectedYear, or All Time if selected)
  const { periodLabel, periodNet } = useMemo(() => {
    let txsToUse = roleFilteredTxs;
    if (selectedYear !== 'All Years') {
      txsToUse = roleFilteredTxs.filter(tx => {
        if (tx.financialYear && tx.financialYear !== 'N/A') {
          return tx.financialYear === selectedYear;
        }
        const d = new Date(tx.date);
        if (!isNaN(d.getTime())) {
          const y = d.getFullYear();
          const m = d.getMonth();
          const fy = m >= 3 ? `${y}-${y+1}` : `${y-1}-${y}`;
          return fy === selectedYear;
        }
        return false;
      });
    }

    const inc = txsToUse.filter(t => t.type === 'income').reduce((sum, t) => sum + (t.amount || 0), 0);
    const exp = txsToUse.filter(t => t.type === 'expense').reduce((sum, t) => sum + (t.amount || 0), 0);
    const net = inc - exp;

    const label = selectedYear !== 'All Years' ? `P&L (${selectedYear}):` : 'P&L (All Time):';
    return { periodLabel: label, periodNet: net };
  }, [roleFilteredTxs, selectedYear]);

  const getPageTitle = () => {
    switch (activePage) {
      case 'dashboard': return 'Dashboard';
      case 'cost-performance': return 'Cost of Performance';
      case 'franchisees': return 'Franchisees Analytics';
      case 'bd-performance': return 'BD Performance';
      case 'tl-performance': return 'TL Performance';
      case 'portal-analytics': return 'Job Portal Analytics';
      case 'cash-outflow': return 'Cash Outflow Breakdown';
      case 'reports': return 'Financial Reports';
      case 'roi-tracker': return 'Runway & ROI Tracker';
      case 'growth-tracking': return 'Growth Tracking';
      case 'industry-analysis': return 'Industry & Potential';
      default: return 'Finance Overview';
    }
  };

  const getPageSubtitle = () => {
    switch (activePage) {
      case 'dashboard': 
        return `Financial overview • ${selectedMonth} (${activeModule === 'job_portal' ? 'Job Portal' : 'Franchise & BD'})`;
      case 'cost-performance':
        return 'Team productivity, commissions, and performance costs';
      case 'franchisees': 
        return 'Franchise profitability and recruitment conversions';
      case 'bd-performance': 
        return 'Sales commission and conversions by BD agents';
      case 'tl-performance': 
        return 'Team leader revenue targets and payouts';
      case 'portal-analytics': 
        return 'Job portal sales conversion, recruiter accounts and packages';
      case 'cash-outflow': 
        return 'Detailed expense distribution analysis';
      case 'reports': 
        return 'Filter and audit transaction ledger logs';
      case 'roi-tracker': 
        return 'Analyze company profitability, BD sales commission ROI, and cash runway projections';
      case 'growth-tracking': 
        return 'Growth scenarios and financial targets';
      case 'industry-analysis': 
        return 'Sector breakdown and expansion potential';
      default: 
        return '';
    }
  };

  // Helper to render the required persistent data status indicator
  const renderDataStatusIndicator = () => {
    switch (dataState) {
      case 'live':
        return {
          bg: '#ecfdf5',
          border: '1.5px solid #10b981',
          textColor: '#065f46',
          icon: (
            <span style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: '#10b981',
              display: 'inline-block',
              boxShadow: '0 0 0 2px rgba(16, 185, 129, 0.25)'
            }} />
          ),
          text: `Live · updated ${timeAgo}`,
          tooltip: `Live data from MySQL backend. Last synced at ${lastSyncedAt || 'just now'}. Click to refresh.`
        };

      case 'connecting':
        return {
          bg: '#f0f9ff',
          border: '1.5px solid #0284c7',
          textColor: '#0369a1',
          icon: <RefreshCw size={12} className="animate-spin" color="#0284c7" />,
          text: `Connecting (${connectionProgress?.elapsedSec || 0}s)...`,
          tooltip: 'Connecting to backend on Render (waking cold instance)...'
        };

      case 'cached':
        return {
          bg: '#fffbeb',
          border: '1.5px solid #f59e0b',
          textColor: '#92400e',
          icon: <Clock size={12} color="#d97706" />,
          text: `Showing saved data from ${lastSyncedAt || 'earlier'}`,
          tooltip: `Backend unreachable. Showing cached data from ${lastSyncedAt || 'earlier'}. Click to retry.`
        };

      case 'crm_limited':
        return {
          bg: '#fff7ed',
          border: '1.5px solid #ea580c',
          textColor: '#9a3412',
          icon: <AlertCircle size={12} color="#ea580c" />,
          text: 'Limited CRM data',
          tooltip: 'Saarthi backend offline. Viewing raw data from api.sarthi360.in. Click to retry.'
        };

      case 'auth_error':
        return {
          bg: '#fef2f2',
          border: '1.5px solid #ef4444',
          textColor: '#991b1b',
          icon: <KeyRound size={12} color="#dc2626" />,
          text: 'API Key Error',
          tooltip: 'Authentication failed (401). Verify VITE_API_KEY. Click to retry.'
        };

      case 'sample':
      default:
        return {
          bg: '#fef2f2',
          border: '1.5px solid #dc2626',
          textColor: '#991b1b',
          icon: <ServerOff size={12} color="#dc2626" />,
          text: 'Sample data. Not real numbers',
          tooltip: 'Live servers unreachable. Viewing sample figures. Click to retry.'
        };
    }
  };

  const statusConfig = renderDataStatusIndicator();
  const accentColor = activeModule === 'job_portal' ? '#ea580c' : 'var(--accent-teal)';

  return (
    <header className="topbar">
      <div className="topbar-header-info">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <h1 style={{ margin: 0 }}>{getPageTitle()}</h1>
          
          {/* Module Header Badge */}
          <div style={{ display: 'flex', background: activeModule === 'job_portal' ? 'rgba(234, 88, 12, 0.1)' : 'rgba(13, 148, 136, 0.1)', padding: '3px 12px', borderRadius: '10px', border: activeModule === 'job_portal' ? '1px solid rgba(234, 88, 12, 0.25)' : '1px solid rgba(13, 148, 136, 0.25)' }}>
            <span 
              style={{ color: activeModule === 'job_portal' ? '#c2410c' : '#0f766e', fontSize: '11px', fontWeight: '800', letterSpacing: '0.04em', textTransform: 'uppercase' }}
            >
              Finance App
            </span>
          </div>
        </div>
        <p className="subtitle" style={{ color: '#475569', fontWeight: '500', marginTop: '4px', fontSize: '14px' }}>{getPageSubtitle()}</p>
      </div>

      <div className="topbar-actions">
        {/* Persistent, Visible Data Status Indicator & Refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            onClick={() => fetchAllData(true)}
            disabled={isBackgroundSyncing}
            className="topbar-badge"
            style={{
              background: statusConfig.bg,
              border: statusConfig.border,
              cursor: isBackgroundSyncing ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 12px',
              borderRadius: '8px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              transition: 'all 0.15s ease'
            }}
            title={statusConfig.tooltip}
            aria-label={statusConfig.text}
          >
            {isBackgroundSyncing ? (
              <RefreshCw size={12} className="animate-spin" color="#0284c7" />
            ) : (
              statusConfig.icon
            )}
            <span style={{ fontSize: '11px', fontWeight: '700', color: statusConfig.textColor }}>
              {isBackgroundSyncing ? 'Syncing...' : statusConfig.text}
            </span>
          </button>

          {/* Quick Health Diagnostic Trigger */}
          <button
            onClick={() => setShowHealthModal(true)}
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '5px 8px',
              cursor: 'pointer',
              color: '#64748b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Inspect backend & database health details"
            aria-label="Server health diagnostic"
          >
            <Info size={13} />
          </button>

          {/* Plain-Language Financial Guide Trigger */}
          <button
            onClick={() => setIsGlossaryOpen && setIsGlossaryOpen(true)}
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '5px 10px',
              cursor: 'pointer',
              color: '#0f6e56',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '12px',
              fontWeight: 600
            }}
            title="Open Plain-Language Financial Guide"
            aria-label="Financial glossary and guide"
          >
            <HelpCircle size={13} color="#0f6e56" />
            <span>Guide</span>
          </button>
        </div>

        <div className="topbar-badge" style={{ background: '#ffffff', border: '1.5px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <span className="badge-label" style={{ color: '#475569', fontWeight: '600' }}>{periodLabel}</span>
          <span className={`badge-value ${periodNet >= 0 ? 'positive' : 'negative'}`} style={{ fontWeight: '800' }}>
            {formatLakhs(periodNet)}
          </span>
        </div>

        {currentUser && (
          <div className="topbar-badge" style={{ background: '#ffffff', border: `1.5px solid ${accentColor}`, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <span className="badge-label" style={{ color: '#475569', fontWeight: '600' }}>Active:</span>
            <span className="badge-value" style={{ color: accentColor, fontWeight: '800' }}>
              {currentUser.name}
            </span>
          </div>
        )}

        <div className="filter-dropdown-wrapper" style={{ display: 'flex', gap: '8px' }}>
          <select 
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="month-select"
            style={{ width: '120px' }}
          >
            {availableYears.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          <select 
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="month-select"
            style={{ width: '130px' }}
          >
            {availableMonths.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

      </div>

      {/* Sync modal portal */}
      <SyncModal isOpen={isSyncOpen} onClose={() => setIsSyncOpen(false)} />

      {/* Health Diagnostic Popover / Modal */}
      {showHealthModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.4)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999
          }}
          onClick={() => setShowHealthModal(false)}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              padding: '24px',
              width: '90%',
              maxWidth: '460px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              border: '1px solid #e2e8f0'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={18} color="#0f766e" />
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>Live System Diagnostics</h3>
              </div>
              <button 
                onClick={() => setShowHealthModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#f8fafc', borderRadius: '6px' }}>
                <span style={{ color: '#64748b' }}>Data State:</span>
                <strong style={{ color: statusConfig.textColor }}>{statusConfig.text}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#f8fafc', borderRadius: '6px' }}>
                <span style={{ color: '#64748b' }}>Database Status:</span>
                <strong style={{ color: backendHealth.isDbConnected ? '#059669' : '#dc2626' }}>
                  {backendHealth.isDbConnected ? 'Connected (Aiven MySQL)' : 'Disconnected'}
                </strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#f8fafc', borderRadius: '6px' }}>
                <span style={{ color: '#64748b' }}>Database Host:</span>
                <span style={{ color: '#1e293b', fontFamily: 'monospace', fontSize: '11px' }}>
                  {backendHealth.host || 'Aiven Cloud MySQL'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#f8fafc', borderRadius: '6px' }}>
                <span style={{ color: '#64748b' }}>Backend Cache:</span>
                <strong style={{ color: backendHealth.cacheWarm ? '#059669' : '#d97706' }}>
                  {backendHealth.cacheWarm ? 'Warm (High Speed)' : 'Cold'}
                </strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#f8fafc', borderRadius: '6px' }}>
                <span style={{ color: '#64748b' }}>Last Successful Sync:</span>
                <strong style={{ color: '#1e293b' }}>{lastSyncedAt || 'Not yet'}</strong>
              </div>

              <div style={{ marginTop: '8px', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#475569', display: 'block', marginBottom: '8px' }}>
                  Endpoint Health:
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '11px' }}>
                  <div style={{ padding: '6px 8px', background: '#f8fafc', borderRadius: '4px' }}>
                    Transactions: <strong style={{ color: endpointStatus.transactions.status === 'ok' ? '#059669' : (endpointStatus.transactions.status === 'empty' ? '#0284c7' : '#dc2626') }}>{endpointStatus.transactions.status} ({endpointStatus.transactions.count})</strong>
                  </div>
                  <div style={{ padding: '6px 8px', background: '#f8fafc', borderRadius: '4px' }}>
                    Franchisees: <strong style={{ color: endpointStatus.franchisees.status === 'ok' ? '#059669' : '#dc2626' }}>{endpointStatus.franchisees.status}</strong>
                  </div>
                  <div style={{ padding: '6px 8px', background: '#f8fafc', borderRadius: '4px' }}>
                    BD Agents: <strong style={{ color: endpointStatus.bdAgents.status === 'ok' ? '#059669' : '#dc2626' }}>{endpointStatus.bdAgents.status}</strong>
                  </div>
                  <div style={{ padding: '6px 8px', background: '#f8fafc', borderRadius: '4px' }}>
                    Team Leaders: <strong style={{ color: endpointStatus.teamLeaders.status === 'ok' ? '#059669' : '#dc2626' }}>{endpointStatus.teamLeaders.status}</strong>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                onClick={() => {
                  setShowHealthModal(false);
                  setIsSyncOpen(true);
                }}
                className="btn btn-secondary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '8px 14px', border: '1.5px solid #0284c7', color: '#0369a1', background: '#f0f9ff', fontWeight: '700' }}
              >
                <CloudDownload size={14} />
                Sync Saarthi CRM
              </button>
              <button
                onClick={() => {
                  setShowHealthModal(false);
                  fetchAllData(true);
                }}
                disabled={isBackgroundSyncing}
                className="btn btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '8px 16px' }}
              >
                <RefreshCw size={13} className={isBackgroundSyncing ? 'animate-spin' : ''} />
                Refresh Live Data
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Topbar;
