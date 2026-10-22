import React, { useContext, useState, useEffect, useMemo } from 'react';
import { FinanceContext, API_BASE_URL } from '../context/FinanceContext';
import { fetchWithApiKey } from '../utils/apiClient';
import { formatCurrency, formatLakhs } from '../utils/formatters';
import { classifyIndustry } from '../utils/industryPredictor';
import {
  Search,
  Download,
  Filter,
  RotateCcw,
  ChevronRight,
  SlidersHorizontal
} from 'lucide-react';
import Pagination from '../components/Pagination';
import AuditDrawer from '../components/AuditDrawer';
import './BDPerformance.css';

// Comprehensive Industry to Sub-Industry Taxonomy
const INDUSTRY_SUB_MAP = {
  'IT & Software': ['Enterprise Software', 'Web & Cloud Applications', 'Frontend & Backend Engineering', 'Data Analytics & AI', 'QA, Testing & DevOps'],
  'Banking & Financial Services (BFSI)': ['Retail & Commercial Banking', 'FinTech & Digital Payments', 'Wealth Management & Investment', 'Insurance & Actuarial', 'NBFC & Lending'],
  'Engineering & Manufacturing': ['Automotive & EV', 'Industrial Equipment & Machinery', 'Electronics & Semiconductor', 'Chemical & Process Plants'],
  'Healthcare & Pharmaceuticals': ['Hospitals & Healthcare Clinics', 'Pharmaceutical Formulations & R&D', 'Medical Devices & Diagnostics', 'Biotechnology'],
  'Retail, Fashion & E-commerce': ['E-commerce & D2C', 'Apparel & Lifestyle Retail', 'FMCG & Consumer Goods', 'Luxury Goods'],
  'Infrastructure & Real Estate': ['Commercial Real Estate', 'Residential Construction', 'Architecture & Engineering', 'Facility Management'],
  'Human Resources & Staffing': ['Executive Search', 'Contingent Staffing', 'Recruitment Process Outsourcing (RPO)'],
  'Sales, Marketing & Consulting': ['Digital Marketing & Growth', 'Strategy & Management Consulting', 'B2B Corporate Sales'],
  'Corporate Enterprise Services': ['Legal & Compliance', 'Operations & Logistics', 'General Administration']
};

// 15 Standard BD Members from Live CRM Database
const ALL_BD_MEMBERS = [
  { name: 'Komal Suresh Bhanushali', role: 'Key Account Manager', baseSalary: 35000, isDormant: false },
  { name: 'Rajalaxmi Das Das', role: 'Enterprise Account Exec', baseSalary: 32000, isDormant: false },
  { name: 'Jahnvi Thakker', role: 'Senior BD Specialist', baseSalary: 30000, isDormant: false },
  { name: 'Ashutosh Manoj Hiremath', role: 'Senior BD Specialist', baseSalary: 28000, isDormant: false },
  { name: 'Kadambinee Kundu', role: 'Enterprise Account Exec', baseSalary: 26000, isDormant: false },
  { name: 'Muskan Ritesh Pradhan', role: 'BD Specialist', baseSalary: 24000, isDormant: false },
  { name: 'Rahul Patil', role: 'Senior BD Specialist', baseSalary: 25000, isDormant: false },
  { name: 'Sneha Kulkarni', role: 'Enterprise Account Exec', baseSalary: 22000, isDormant: false },
  { name: 'Ankur Sharma', role: 'BD Manager', baseSalary: 24000, isDormant: false },
  { name: 'Ruchi Shukla', role: 'BD Specialist', baseSalary: 20000, isDormant: false },
  { name: 'Shreya Santosh Talashilkar', role: 'BD Specialist', baseSalary: 18000, isDormant: true },
  { name: 'Sneha Santosh Jaiswal', role: 'BD Associate', baseSalary: 16000, isDormant: true },
  { name: 'Shruti Wilson Adhav', role: 'BD Associate', baseSalary: 16000, isDormant: true },
  { name: 'Jiya Pran Sanda', role: 'BD Associate', baseSalary: 16000, isDormant: true },
  { name: 'Sonali Jayanta Singh', role: 'BD Associate', baseSalary: 16000, isDormant: true }
];

const BDPerformance = () => {
  const { transactions, selectedMonth, selectedYear } = useContext(FinanceContext);

  // 3 Primary Filter States
  const [selectedBdFilter, setSelectedBdFilter] = useState('All BD Members');
  const [selectedFinancialYear, setSelectedFinancialYear] = useState('All Financial Years');
  const [selectedInfoStatus, setSelectedInfoStatus] = useState('All'); // 'All' | 'R' | 'PR' | 'O' | 'C'

  // Advanced Filters
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [selectedIndustry, setSelectedIndustry] = useState('All Industries');
  const [selectedSubIndustry, setSelectedSubIndustry] = useState('All Sub-Industries');
  const [bdExpenditurePct, setBdExpenditurePct] = useState('0'); // % overhead

  // Directory Search & Sort & Pagination
  const [memberSearchTerm, setMemberSearchTerm] = useState('');
  const [memberSortField, setMemberSortField] = useState('gross'); // 'gross' | 'roi' | 'cost' | 'waste' | 'name'
  const [memberPage, setMemberPage] = useState(1);
  const MEMBERS_PER_PAGE = 8;

  // Audit Drawer State
  const [selectedMemberForAudit, setSelectedMemberForAudit] = useState(null);

  // Leaderboard data from backend
  const [leaderboard, setLeaderboard] = useState([]);

  const getPeriodDates = (month, year) => {
    let start = '2018-01-01';
    let end = '2026-12-31';

    if (month && month !== 'All Months') {
      const parts = month.split(' ');
      const mName = parts[0];
      const yVal = parseInt(parts[1], 10);
      const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      const mIdx = monthNames.indexOf(mName);
      if (mIdx !== -1) {
        start = `${yVal}-${String(mIdx + 1).padStart(2, '0')}-01`;
        const lastDay = new Date(yVal, mIdx + 1, 0).getDate();
        end = `${yVal}-${String(mIdx + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      }
    } else if (year && year !== 'All Years') {
      const parts = year.split('-');
      const yStart = parseInt(parts[0], 10);
      const yEnd = parseInt(parts[1], 10);
      start = `${yStart}-04-01`;
      end = `${yEnd}-03-31`;
    }
    return { start, end };
  };

  useEffect(() => {
    const { start, end } = getPeriodDates(selectedMonth, selectedYear);
    fetchWithApiKey(`${API_BASE_URL}/bd-revenue-leaderboard?start_date=${start}&end_date=${end}`)
      .then(res => {
        if (res && res.ok) return res.json();
        return null;
      })
      .then(data => {
        if (data) setLeaderboard(data);
      })
      .catch(err => console.error("Leaderboard load failed:", err));
  }, [selectedMonth, selectedYear]);

  // Sub-Industries for selected Industry
  const availableSubIndustries = useMemo(() => {
    if (selectedIndustry === 'All Industries') {
      const set = new Set();
      Object.values(INDUSTRY_SUB_MAP).forEach(subs => subs.forEach(s => set.add(s)));
      return Array.from(set);
    }
    return INDUSTRY_SUB_MAP[selectedIndustry] || [];
  }, [selectedIndustry]);

  // Active Advanced Filters Count
  const activeAdvancedCount = useMemo(() => {
    let count = 0;
    if (selectedIndustry !== 'All Industries') count++;
    if (selectedSubIndustry !== 'All Sub-Industries') count++;
    if (bdExpenditurePct !== '0') count++;
    return count;
  }, [selectedIndustry, selectedSubIndustry, bdExpenditurePct]);

  // Any Filter Active (controls Reset button visibility)
  const isAnyFilterActive = useMemo(() => {
    return (
      selectedBdFilter !== 'All BD Members' ||
      selectedFinancialYear !== 'All Financial Years' ||
      selectedInfoStatus !== 'All' ||
      selectedIndustry !== 'All Industries' ||
      selectedSubIndustry !== 'All Sub-Industries' ||
      bdExpenditurePct !== '0' ||
      memberSearchTerm.trim() !== ''
    );
  }, [selectedBdFilter, selectedFinancialYear, selectedInfoStatus, selectedIndustry, selectedSubIndustry, bdExpenditurePct, memberSearchTerm]);

  const handleResetFilters = () => {
    setSelectedBdFilter('All BD Members');
    setSelectedFinancialYear('All Financial Years');
    setSelectedInfoStatus('All');
    setSelectedIndustry('All Industries');
    setSelectedSubIndustry('All Sub-Industries');
    setBdExpenditurePct('0');
    setMemberSearchTerm('');
    setMemberPage(1);
  };

  // BD Performance Calculations (unchanged maths)
  const bdPerformanceData = useMemo(() => {
    const txList = Array.isArray(transactions) ? transactions : [];
    const expRate = (parseFloat(bdExpenditurePct) || 0) / 100;

    return ALL_BD_MEMBERS.map(member => {
      const cleanName = member.name.trim().toLowerCase();
      const firstName = cleanName.split(' ')[0];

      // Match transactions
      const matchingTxs = txList.filter(t => {
        const tBd = (t.bdAgentName || '').trim().toLowerCase();
        if (!tBd) return false;
        const matchesName = tBd === cleanName || tBd.includes(firstName);
        if (!matchesName) return false;

        // Financial Year filter
        if (selectedFinancialYear !== 'All Financial Years') {
          if (t.financialYear && t.financialYear !== selectedFinancialYear) return false;
        }

        // Info Status filter (R, PR, O, C)
        if (selectedInfoStatus !== 'All') {
          const tInfo = (t.info || 'R').toUpperCase();
          if (tInfo !== selectedInfoStatus.toUpperCase()) return false;
        }

        // Industry filter
        const ind = classifyIndustry(t);
        if (selectedIndustry !== 'All Industries') {
          if (ind !== selectedIndustry) return false;
        }

        // Sub Industry filter
        if (selectedSubIndustry !== 'All Sub-Industries') {
          const subText = `${t.subCategory || ''} ${t.title || ''} ${t.positionName || ''}`.toLowerCase();
          if (!subText.includes(selectedSubIndustry.toLowerCase())) return false;
        }

        return true;
      });

      // Leaderboard fallback when member has no matching transactions
      const lbMatch = (leaderboard || []).find(item => {
        const lbName = (item.bd_name || '').trim().toLowerCase();
        return lbName === cleanName || lbName.includes(firstName);
      });

      let grossBilling = 0;
      let receivedRevenue = 0;
      let outstandingRevenue = 0;
      let cancelledRevenue = 0;
      let ourShare = 0;
      let invoicesClosed = 0;
      let invoicesCancelled = 0;
      let invoicesOutstanding = 0;

      if (matchingTxs.length > 0) {
        matchingTxs.forEach(t => {
          const amt = Number(t.amount || 0);
          const info = (t.info || 'R').toUpperCase();
          const isCancelledTx = info === 'C' || t.status === 'cancelled' || t.type === 'credit_note';
          const isReceivedTx = info === 'R';
          const isPartReceived = info === 'PR';
          const isOutstandingTx = info === 'O';

          grossBilling += amt;

          if (isCancelledTx) {
            cancelledRevenue += amt;
            invoicesCancelled++;
          } else if (isReceivedTx) {
            receivedRevenue += amt;
            ourShare += Number(t.ourShare || amt * 0.25);
            invoicesClosed++;
          } else if (isPartReceived) {
            receivedRevenue += amt * 0.5;
            outstandingRevenue += amt * 0.5;
            ourShare += Number(t.ourShare ? t.ourShare * 0.5 : amt * 0.125);
            invoicesClosed++;
          } else if (isOutstandingTx) {
            outstandingRevenue += amt;
            invoicesOutstanding++;
          } else {
            receivedRevenue += amt;
            ourShare += Number(t.ourShare || amt * 0.25);
            invoicesClosed++;
          }
        });
      } else if (lbMatch && selectedInfoStatus === 'All' && selectedIndustry === 'All Industries' && selectedSubIndustry === 'All Sub-Industries') {
        grossBilling = Number(lbMatch.gross_revenue || 0);
        ourShare = Number(lbMatch.net_revenue || 0);
        invoicesClosed = Number(lbMatch.invoices_closed || 0);
        cancelledRevenue = Number(lbMatch.potential_loss || 0);
        invoicesCancelled = cancelledRevenue > 0 ? Math.ceil(cancelledRevenue / 50000) : 0;
        receivedRevenue = Math.max(0, grossBilling - cancelledRevenue);
      }

      // Cost to company calculations
      const baseSalary = member.baseSalary;
      const annualSalary = baseSalary * 12;
      const allocatedExp = grossBilling * expRate;
      const totalCost = annualSalary + allocatedExp;

      // Net ROI / Contribution
      const netROI = ourShare - totalCost;
      const roiMultiple = totalCost > 0 ? (ourShare / totalCost) : 0;

      // Leakage / Waste audit rules & Status pill mapping
      let wasteReason = '';
      let statusKey = 'profitable';
      let statusLabel = 'Profitable';

      if (member.isDormant && grossBilling === 0) {
        statusKey = 'dormant';
        statusLabel = 'Dormant';
        wasteReason = `Dormant: ${formatCurrency(annualSalary)} salary burn (0 closed deals)`;
      } else if (cancelledRevenue > 100000) {
        statusKey = 'cancellation';
        statusLabel = 'High cancellation';
        wasteReason = `High cancellation: ${formatCurrency(cancelledRevenue)} lost (${invoicesCancelled} deals)`;
      } else if (netROI < 0) {
        statusKey = 'negative';
        statusLabel = 'Negative return';
        wasteReason = `Negative return: Costs exceed revenue by ${formatCurrency(Math.abs(netROI))}`;
      } else if (outstandingRevenue > 200000) {
        statusKey = 'lag';
        statusLabel = 'Collection lag';
        wasteReason = `Collection lag: ${formatCurrency(outstandingRevenue)} outstanding pending`;
      } else {
        statusKey = 'profitable';
        statusLabel = 'Profitable';
        wasteReason = `Profitable (${roiMultiple.toFixed(1)}x ROI return on salary)`;
      }

      return {
        ...member,
        grossBilling,
        receivedRevenue,
        outstandingRevenue,
        cancelledRevenue,
        ourShare,
        invoicesClosed,
        invoicesCancelled,
        invoicesOutstanding,
        totalDeals: matchingTxs.length || invoicesClosed + invoicesCancelled + invoicesOutstanding,
        annualSalary,
        allocatedExp,
        totalCost,
        netROI,
        roiMultiple,
        wasteReason,
        statusKey,
        statusLabel,
        matchingTxs
      };
    });
  }, [transactions, leaderboard, selectedFinancialYear, selectedInfoStatus, selectedIndustry, selectedSubIndustry, bdExpenditurePct]);

  // Aggregate Summary for 2 Header Cards
  const filteredSummary = useMemo(() => {
    let list = bdPerformanceData;
    if (selectedBdFilter !== 'All BD Members') {
      list = list.filter(m => m.name.toLowerCase() === selectedBdFilter.toLowerCase());
    }

    const gross = list.reduce((sum, m) => sum + m.grossBilling, 0);
    const received = list.reduce((sum, m) => sum + m.receivedRevenue, 0);
    const outstanding = list.reduce((sum, m) => sum + m.outstandingRevenue, 0);
    const cancelled = list.reduce((sum, m) => sum + m.cancelledRevenue, 0);
    const baseSal = list.reduce((sum, m) => sum + m.annualSalary, 0);
    const allocExp = list.reduce((sum, m) => sum + m.allocatedExp, 0);
    const totalCost = list.reduce((sum, m) => sum + m.totalCost, 0);
    const ourShare = list.reduce((sum, m) => sum + m.ourShare, 0);
    const netROI = ourShare - totalCost;
    const roiMultiple = totalCost > 0 ? (ourShare / totalCost) : 0;
    const totalDeals = list.reduce((sum, m) => sum + m.totalDeals, 0);

    const receivedPct = gross > 0 ? Math.round((received / gross) * 100) : 0;
    const outstandingPct = gross > 0 ? Math.round((outstanding / gross) * 100) : 0;
    const cancelledPct = gross > 0 ? Math.round((cancelled / gross) * 100) : 0;

    return {
      gross,
      received,
      outstanding,
      cancelled,
      baseSal,
      allocExp,
      totalCost,
      ourShare,
      netROI,
      roiMultiple,
      totalDeals,
      receivedPct,
      outstandingPct,
      cancelledPct
    };
  }, [bdPerformanceData, selectedBdFilter]);

  // Filtered and Sorted Directory List
  const displayedMembers = useMemo(() => {
    let list = [...bdPerformanceData];

    if (selectedBdFilter !== 'All BD Members') {
      list = list.filter(m => m.name.toLowerCase() === selectedBdFilter.toLowerCase());
    }

    if (memberSearchTerm.trim()) {
      const q = memberSearchTerm.toLowerCase();
      list = list.filter(m =>
        m.name.toLowerCase().includes(q) ||
        m.role.toLowerCase().includes(q)
      );
    }

    // Sort
    list.sort((a, b) => {
      if (memberSortField === 'gross') return b.grossBilling - a.grossBilling;
      if (memberSortField === 'roi') return b.netROI - a.netROI;
      if (memberSortField === 'cost') return b.totalCost - a.totalCost;
      if (memberSortField === 'waste') return b.cancelledRevenue - a.cancelledRevenue;
      if (memberSortField === 'name') return a.name.localeCompare(b.name);
      return 0;
    });

    return list;
  }, [bdPerformanceData, selectedBdFilter, memberSearchTerm, memberSortField]);

  // Paginated slice
  const paginatedMembers = useMemo(() => {
    const startIndex = (memberPage - 1) * MEMBERS_PER_PAGE;
    return displayedMembers.slice(startIndex, startIndex + MEMBERS_PER_PAGE);
  }, [displayedMembers, memberPage]);

  // CSV Export
  const handleExportDirectoryCSV = () => {
    const headers = ['BD Member', 'Role', 'Status', 'Closed Deals', 'Cancelled Deals', 'Gross Billing', 'Received Revenue', 'Outstanding', 'Cancelled Billing', 'Total Cost to Company', 'Net ROI', 'ROI Multiple', 'Waste Risk Note'];
    const rows = displayedMembers.map(m => [
      `"${m.name}"`,
      `"${m.role}"`,
      m.isDormant ? 'Dormant' : 'Active',
      m.invoicesClosed,
      m.invoicesCancelled,
      m.grossBilling.toFixed(2),
      m.receivedRevenue.toFixed(2),
      m.outstandingRevenue.toFixed(2),
      m.cancelledRevenue.toFixed(2),
      m.totalCost.toFixed(2),
      m.netROI.toFixed(2),
      `${m.roiMultiple.toFixed(2)}x`,
      `"${m.wasteReason}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `BD_Member_Performance_Directory_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bd-performance-page animate-fade-in">

      {/* 1. HEADER CARD WITH FILTERS */}
      <div className="bdp-header-card">
        <div className="bdp-header-top">
          <div className="bdp-header-title-group">
            <h2 className="bdp-title">BD Member Performance</h2>
            <p className="bdp-subtitle">
              Monitor BD member acquisition, billing, cost to company and financial ROI performance.
            </p>
          </div>
          <div className="bdp-count-chip">
            <span className="bdp-count-num">{ALL_BD_MEMBERS.length}</span>
            <span className="bdp-count-label">BD Members</span>
          </div>
        </div>

        {/* 3 Main Filters Row */}
        <div className="bdp-filters-row">
          {/* Filter 1: BD Specialist */}
          <div className="bdp-filter-group">
            <label className="bdp-filter-label">BD Specialist</label>
            <select
              className="bdp-filter-select"
              value={selectedBdFilter}
              onChange={(e) => { setSelectedBdFilter(e.target.value); setMemberPage(1); }}
            >
              <option value="All BD Members">All BD Members</option>
              {ALL_BD_MEMBERS.map(m => (
                <option key={m.name} value={m.name}>{m.name}</option>
              ))}
            </select>
          </div>

          {/* Filter 2: Financial Year */}
          <div className="bdp-filter-group">
            <label className="bdp-filter-label">Financial Year</label>
            <select
              className="bdp-filter-select"
              value={selectedFinancialYear}
              onChange={(e) => { setSelectedFinancialYear(e.target.value); setMemberPage(1); }}
            >
              <option value="All Financial Years">All Financial Years</option>
              <option value="2026-2027">2026-2027 (FY27)</option>
              <option value="2025-2026">2025-2026 (FY26)</option>
              <option value="2024-2025">2024-2025 (FY25)</option>
            </select>
          </div>

          {/* Filter 3: Info Status */}
          <div className="bdp-filter-group">
            <label className="bdp-filter-label">Info Status</label>
            <select
              className="bdp-filter-select"
              value={selectedInfoStatus}
              onChange={(e) => { setSelectedInfoStatus(e.target.value); setMemberPage(1); }}
            >
              <option value="All">All</option>
              <option value="R">R (Received / Paid)</option>
              <option value="PR">PR (Part Received)</option>
              <option value="O">O (Outstanding / Unpaid)</option>
              <option value="C">C (Cancelled / Void)</option>
            </select>
          </div>

          {/* Filter Actions: More Filters Toggle & Reset Button */}
          <div className="bdp-filter-actions">
            <button
              type="button"
              className={`bdp-btn-toggle-filters ${showMoreFilters || activeAdvancedCount > 0 ? 'active' : ''}`}
              onClick={() => setShowMoreFilters(prev => !prev)}
            >
              <SlidersHorizontal size={14} />
              <span>More filters</span>
              {activeAdvancedCount > 0 && (
                <span className="bdp-badge-count">{activeAdvancedCount}</span>
              )}
            </button>

            {isAnyFilterActive && (
              <button
                type="button"
                className="bdp-btn-reset"
                onClick={handleResetFilters}
                title="Reset all filters to defaults"
              >
                <RotateCcw size={13} />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Collapsible Advanced Filters (Industry, Sub-Industry, Expenditure %) */}
        {showMoreFilters && (
          <div className="bdp-advanced-filters-grid">
            <div className="bdp-filter-group">
              <label className="bdp-filter-label">Industry</label>
              <select
                className="bdp-filter-select"
                value={selectedIndustry}
                onChange={(e) => {
                  setSelectedIndustry(e.target.value);
                  setSelectedSubIndustry('All Sub-Industries');
                  setMemberPage(1);
                }}
              >
                <option value="All Industries">All Industries</option>
                {Object.keys(INDUSTRY_SUB_MAP).map(ind => (
                  <option key={ind} value={ind}>{ind}</option>
                ))}
              </select>
            </div>

            <div className="bdp-filter-group">
              <label className="bdp-filter-label">Sub Industry</label>
              <select
                className="bdp-filter-select"
                value={selectedSubIndustry}
                onChange={(e) => { setSelectedSubIndustry(e.target.value); setMemberPage(1); }}
              >
                <option value="All Sub-Industries">All Sub-Industries</option>
                {availableSubIndustries.map(sub => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
            </div>

            <div className="bdp-filter-group">
              <label className="bdp-filter-label">BD Expenditure %</label>
              <select
                className="bdp-filter-select"
                value={bdExpenditurePct}
                onChange={(e) => { setBdExpenditurePct(e.target.value); setMemberPage(1); }}
              >
                <option value="0">0% (Pure Salary Base)</option>
                <option value="2">2% Gross Overhead</option>
                <option value="5">5% Standard Corporate</option>
                <option value="8">8% High Overhead</option>
                <option value="10">10% Full Allocation</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* 2. SUMMARY ROW (2 CARDS) */}
      <div className="bdp-summary-grid">
        {/* Revenue Card (Wide) */}
        <div className="bdp-summary-card bdp-revenue-card">
          <div className="bdp-card-header">
            <h3 className="bdp-card-title">Commercial Revenue & Collections</h3>
          </div>

          <div className="bdp-stats-row">
            {/* Stat 1: Gross */}
            <div className="bdp-stat-item">
              <div className="bdp-stat-top">
                <span className="bdp-stat-dot" style={{ background: '#2563eb' }} />
                <span className="bdp-stat-label">Gross Billing</span>
              </div>
              <span className="bdp-stat-value" title={formatCurrency(filteredSummary.gross)}>
                {formatLakhs(filteredSummary.gross)}
              </span>
              <span className="bdp-stat-sub">
                {filteredSummary.totalDeals} deals total
              </span>
            </div>

            {/* Stat 2: Received */}
            <div className="bdp-stat-item">
              <div className="bdp-stat-top">
                <span className="bdp-stat-dot" style={{ background: '#0F6E56' }} />
                <span className="bdp-stat-label">Received</span>
              </div>
              <span className="bdp-stat-value" title={formatCurrency(filteredSummary.received)}>
                {formatLakhs(filteredSummary.received)}
              </span>
              <span className="bdp-stat-sub">
                {filteredSummary.receivedPct}% of gross
              </span>
            </div>

            {/* Stat 3: Outstanding */}
            <div className="bdp-stat-item">
              <div className="bdp-stat-top">
                <span className="bdp-stat-dot" style={{ background: '#B7791F' }} />
                <span className="bdp-stat-label">Outstanding</span>
              </div>
              <span className="bdp-stat-value" title={formatCurrency(filteredSummary.outstanding)}>
                {formatLakhs(filteredSummary.outstanding)}
              </span>
              <span className="bdp-stat-sub">
                {filteredSummary.outstandingPct}% pending
              </span>
            </div>

            {/* Stat 4: Cancelled */}
            <div className="bdp-stat-item">
              <div className="bdp-stat-top">
                <span className="bdp-stat-dot" style={{ background: '#A8402E' }} />
                <span className="bdp-stat-label">Cancelled</span>
              </div>
              <span className="bdp-stat-value" title={formatCurrency(filteredSummary.cancelled)}>
                {formatLakhs(filteredSummary.cancelled)}
              </span>
              <span className="bdp-stat-sub">
                {filteredSummary.cancelledPct}% lost
              </span>
            </div>
          </div>

          {/* Thin Stacked Progress Bar */}
          <div className="bdp-stacked-bar-wrapper">
            <div className="bdp-stacked-bar">
              <div
                className="bdp-bar-segment"
                style={{ width: `${filteredSummary.receivedPct}%`, background: '#0F6E56' }}
                title={`Received: ${filteredSummary.receivedPct}%`}
              />
              <div
                className="bdp-bar-segment"
                style={{ width: `${filteredSummary.outstandingPct}%`, background: '#B7791F' }}
                title={`Outstanding: ${filteredSummary.outstandingPct}%`}
              />
              <div
                className="bdp-bar-segment"
                style={{ width: `${filteredSummary.cancelledPct}%`, background: '#A8402E' }}
                title={`Cancelled: ${filteredSummary.cancelledPct}%`}
              />
            </div>
          </div>
        </div>

        {/* Cost & Return Card (Narrow) */}
        <div className="bdp-summary-card bdp-cost-return-card">
          <div className="bdp-card-header">
            <h3 className="bdp-card-title">Cost & Return</h3>
            <span className={`bdp-card-pill ${filteredSummary.netROI >= 0 ? 'profitable' : 'loss'}`}>
              {filteredSummary.netROI >= 0 ? 'Net profitable' : 'Loss-making'}
            </span>
          </div>

          <div className="bdp-cost-stats-grid">
            {/* Stat 1: Cost to Company */}
            <div className="bdp-stat-item">
              <span className="bdp-stat-label">Cost to Company</span>
              <span className="bdp-stat-value" title={formatCurrency(filteredSummary.totalCost)}>
                {formatLakhs(filteredSummary.totalCost)}
              </span>
              <span className="bdp-stat-sub">
                Salary {formatLakhs(filteredSummary.baseSal)} + Exp {formatLakhs(filteredSummary.allocExp)}
              </span>
            </div>

            {/* Stat 2: Net ROI */}
            <div className="bdp-stat-item">
              <span className="bdp-stat-label">Net Corporate ROI</span>
              <span
                className="bdp-stat-value"
                style={{ color: filteredSummary.netROI >= 0 ? '#0F6E56' : '#dc2626' }}
                title={formatCurrency(filteredSummary.netROI)}
              >
                {filteredSummary.netROI >= 0 ? '+' : ''}{formatLakhs(filteredSummary.netROI)}
              </span>
              <span className="bdp-stat-sub" style={{ color: filteredSummary.netROI >= 0 ? '#0F6E56' : '#dc2626', fontWeight: '600' }}>
                {filteredSummary.roiMultiple.toFixed(1)}× return on cost
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. MEMBER DIRECTORY CARD */}
      <div className="bdp-directory-card">
        {/* Toolbar */}
        <div className="bdp-toolbar">
          <div className="bdp-toolbar-left">
            <h3 className="bdp-toolbar-title">Member Directory</h3>
            <p className="bdp-toolbar-hint">Click a row to open its invoice audit</p>
          </div>

          <div className="bdp-toolbar-right">
            {/* Search */}
            <div className="bdp-search-box">
              <Search size={13} color="var(--text-muted)" />
              <input
                type="text"
                className="bdp-search-input"
                placeholder="Search member or role..."
                value={memberSearchTerm}
                onChange={(e) => { setMemberSearchTerm(e.target.value); setMemberPage(1); }}
              />
            </div>

            {/* Sort */}
            <select
              className="bdp-sort-select"
              value={memberSortField}
              onChange={(e) => setMemberSortField(e.target.value)}
            >
              <option value="gross">Sort by Gross Billing</option>
              <option value="roi">Sort by Net ROI</option>
              <option value="cost">Sort by Total Cost</option>
              <option value="waste">Sort by Losses & Risk</option>
              <option value="name">Sort by Member Name</option>
            </select>

            {/* CSV Export */}
            <button
              type="button"
              className="bdp-btn-export"
              onClick={handleExportDirectoryCSV}
              title="Export filtered directory to CSV"
            >
              <Download size={13} />
              <span>Export</span>
            </button>
          </div>
        </div>

        {/* 7-Column Table */}
        <div className="bdp-table-wrapper">
          <table className="bdp-table">
            <thead>
              <tr>
                <th className="bdp-th">BD Member</th>
                <th className="bdp-th text-right">Gross Billing</th>
                <th className="bdp-th text-right">Collected</th>
                <th className="bdp-th text-right">At Risk</th>
                <th className="bdp-th text-right">Cost to Company</th>
                <th className="bdp-th text-right">Net ROI</th>
                <th className="bdp-th text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {paginatedMembers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="bdp-empty-row">
                    No BD members match the selected filters.
                  </td>
                </tr>
              ) : (
                paginatedMembers.map(member => {
                  const colPct = member.grossBilling > 0 ? Math.round((member.receivedRevenue / member.grossBilling) * 100) : 0;

                  return (
                    <tr
                      key={member.name}
                      className="bdp-tr"
                      tabIndex={0}
                      onClick={() => setSelectedMemberForAudit(member)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedMemberForAudit(member);
                        }
                      }}
                    >
                      {/* 1. Member Column */}
                      <td className="bdp-td">
                        <div className="bdp-member-cell">
                          <span className="bdp-member-name">{member.name}</span>
                          <span className="bdp-member-sub">{member.role} · {member.totalDeals} deals</span>
                        </div>
                      </td>

                      {/* 2. Gross Billing */}
                      <td className="bdp-td text-right">
                        <span className="bdp-num-val" title={formatCurrency(member.grossBilling)}>
                          {formatLakhs(member.grossBilling)}
                        </span>
                      </td>

                      {/* 3. Collected (Amount, thin bar, %) */}
                      <td className="bdp-td text-right">
                        <div>
                          <span className="bdp-num-val" title={formatCurrency(member.receivedRevenue)}>
                            {formatLakhs(member.receivedRevenue)}
                          </span>
                          <div className="bdp-mini-bar-track">
                            <div className="bdp-mini-bar-fill" style={{ width: `${colPct}%` }} />
                          </div>
                          <span className="bdp-pct-sub">{colPct}%</span>
                        </div>
                      </td>

                      {/* 4. At Risk (2 lines: pending & lost) */}
                      <td className="bdp-td text-right">
                        <div>
                          <div className="bdp-risk-pending" title={`Pending: ${formatCurrency(member.outstandingRevenue)}`}>
                            {member.outstandingRevenue > 0 ? `${formatLakhs(member.outstandingRevenue)} pending` : '₹0 pending'}
                          </div>
                          <div className="bdp-risk-lost" title={`Lost: ${formatCurrency(member.cancelledRevenue)}`}>
                            {member.cancelledRevenue > 0 ? `${formatLakhs(member.cancelledRevenue)} lost` : '₹0 lost'}
                          </div>
                        </div>
                      </td>

                      {/* 5. Cost to Company */}
                      <td className="bdp-td text-right">
                        <div>
                          <span
                            className="bdp-num-val"
                            title={`Annual salary ${formatCurrency(member.annualSalary)} + Expenses ${formatCurrency(member.allocatedExp)}`}
                          >
                            {formatLakhs(member.totalCost)}
                          </span>
                          <div className="bdp-cost-base">
                            {formatCurrency(member.baseSalary)}/mo base
                          </div>
                        </div>
                      </td>

                      {/* 6. Net ROI */}
                      <td className="bdp-td text-right">
                        <div>
                          <div
                            className={`bdp-roi-val ${member.netROI >= 0 ? 'positive' : 'negative'}`}
                            title={formatCurrency(member.netROI)}
                          >
                            {member.netROI >= 0 ? '+' : ''}{formatLakhs(member.netROI)}
                          </div>
                          <div className="bdp-roi-sub">
                            {member.roiMultiple.toFixed(1)}×
                          </div>
                        </div>
                      </td>

                      {/* 7. Status Pill */}
                      <td className="bdp-td text-center">
                        <span className={`bdp-pill-tag ${member.statusKey}`} title={member.wasteReason}>
                          <span>{member.statusLabel}</span>
                          <ChevronRight size={12} />
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <Pagination
          currentPage={memberPage}
          totalItems={displayedMembers.length}
          pageSize={MEMBERS_PER_PAGE}
          onPageChange={setMemberPage}
          itemName="BD members"
        />
      </div>

      {/* Audit Drawer (Same props as before) */}
      <AuditDrawer
        isOpen={Boolean(selectedMemberForAudit)}
        onClose={() => setSelectedMemberForAudit(null)}
        entityType="bd"
        entityName={selectedMemberForAudit?.name || ''}
        entityRole={selectedMemberForAudit?.role || 'BD Specialist'}
        month={selectedMonth === 'All Months' ? 'all' : selectedMonth}
        financialYear={selectedYear}
      />
    </div>
  );
};

export default BDPerformance;
