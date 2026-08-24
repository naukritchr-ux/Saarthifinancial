import React, { useContext, useState } from 'react';
import { FinanceContext } from '../context/FinanceContext';
import { formatLakhs } from '../utils/formatters';
import { Plus, Minus, CloudDownload } from 'lucide-react';
import SyncModal from './SyncModal';

const Topbar = ({ activePage, setActivePage }) => {
  const { 
    moduleFilteredTransactions, 
    selectedMonth, 
    setSelectedMonth, 
    availableMonths,
    selectedYear,
    setSelectedYear,
    availableYears,
    userRole,
    setUserRole,
    currentUser,
    activeModule
  } = useContext(FinanceContext);

  const [isSyncOpen, setIsSyncOpen] = useState(false);

  // Calculate quick metrics for the top badge using module-filtered data
  const roleFilteredTxs = moduleFilteredTransactions.filter(tx => {
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

  const filteredTransactions = roleFilteredTxs.filter(tx => {
    // 1. Month filter
    let monthMatch = true;
    if (selectedMonth !== 'All Months') {
      const date = new Date(tx.date);
      const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      const txMonthYear = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
      monthMatch = (txMonthYear === selectedMonth);
    }

    // 2. Year filter
    let yearMatch = true;
    if (selectedYear !== 'All Years') {
      if (tx.financialYear) {
        yearMatch = (tx.financialYear === selectedYear);
      } else {
        const d = new Date(tx.date);
        if (!isNaN(d.getTime())) {
          const y = d.getFullYear();
          const m = d.getMonth();
          const fy = m >= 3 ? `${y}-${y+1}` : `${y-1}-${y}`;
          yearMatch = (fy === selectedYear);
        }
      }
    }
    return monthMatch && yearMatch;
  });

  const totalIncome = roleFilteredTxs
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = roleFilteredTxs
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const netBalance = totalIncome - totalExpense;

  const getPageTitle = () => {
    switch (activePage) {
      case 'dashboard': return 'Dashboard';
      case 'log-income': return 'Log Income';
      case 'log-expense': return 'Log Expense';
      case 'franchisees': return 'Franchisees Analytics';
      case 'bd-performance': return 'BD Performance';
      case 'portal-analytics': return 'Job Portal Analytics';
      case 'cash-outflow': return 'Cash Outflow Breakdown';
      case 'reports': return 'Financial Reports';
      case 'roi-tracker': return 'Runway & ROI Tracker';
      default: return 'Finance Overview';
    }
  };

  const getPageSubtitle = () => {
    switch (activePage) {
      case 'dashboard': 
        return `Financial overview • ${selectedMonth} (${activeModule === 'job_portal' ? 'Job Portal' : 'Franchise & BD'})`;
      case 'log-income': 
        return 'Record incoming revenue or franchisee fees';
      case 'log-expense': 
        return 'Record operational costs, commissions, or salaries';
      case 'franchisees': 
        return 'Franchise profitability and recruitment conversions';
      case 'bd-performance': 
        return 'Sales commission and conversions by BD agents';
      case 'portal-analytics': 
        return 'Job portal sales conversion, recruiter accounts and packages';
      case 'cash-outflow': 
        return 'Detailed expense distribution analysis';
      case 'reports': 
        return 'Filter and audit transaction ledger logs';
      case 'roi-tracker': 
        return 'Analyze company profitability, BD sales commission ROI, and cash runway projections';
      default: 
        return '';
    }
  };

  // Border and text styling based on selected module
  const accentColor = activeModule === 'job_portal' ? '#ea580c' : 'var(--accent-teal)';

  return (
    <header className="topbar">
      <div className="topbar-header-info">
        <h1>{getPageTitle()}</h1>
        <p className="subtitle">{getPageSubtitle()}</p>
      </div>

      <div className="topbar-actions">
        {/* Sync Data from site trigger */}
        <button 
          className="btn btn-secondary"
          onClick={() => setIsSyncOpen(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid rgba(255,255,255,0.08)' }}
          title="Fetch transaction data from main site"
        >
          <CloudDownload size={16} />
          <span>Sync Site</span>
        </button>

        <div className="topbar-badge">
          <span className="badge-label">In hand:</span>
          <span className={`badge-value ${netBalance >= 0 ? 'positive' : 'negative'}`}>
            {formatLakhs(netBalance)}
          </span>
        </div>

        {currentUser && (
          <div className="topbar-badge" style={{ borderColor: accentColor }}>
            <span className="badge-label">Active:</span>
            <span className="badge-value" style={{ color: accentColor }}>
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
    </header>
  );
};

export default Topbar;
