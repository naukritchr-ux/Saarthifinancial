import React, { useState, useEffect } from 'react';
import { 
  RefreshCw, 
  Search, 
  Download, 
  Database, 
  CheckCircle, 
  AlertTriangle, 
  X, 
  Building2, 
  CreditCard, 
  Calendar, 
  Filter, 
  RotateCcw,
  PlusCircle,
  FileText,
  Layers
} from 'lucide-react';
import ReconciliationTable from './ReconciliationTable';
import EditModal from './EditModal';
import AddToCrmModal from './AddToCrmModal';
import AddFollowupModal from '../FollowUp/AddFollowupModal';
import { 
  getReconciliationReport, 
  getCsvExportUrl, 
  toggleFollowupDone,
  getFilterOptions 
} from '../../api/tdsApi';
import { triggerCsvDownload } from '../../utils/exportUtils';
import { useApp } from '../../context/AppContext';

export default function TdsReconciliation() {
  const { fyFilter, setFyFilter, refreshKey } = useApp();

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  
  // Filtering & Search states
  const [search, setSearch] = useState('');
  const [companyFilter, setCompanyFilter] = useState('All');
  const [panFilter, setPanFilter] = useState('All');
  const [overallStatus, setOverallStatus] = useState('All');
  const [coverageFilter, setCoverageFilter] = useState('All');
  const [sortBy, setSortBy] = useState('updated_at');
  const [responseFilter, setResponseFilter] = useState('All');  // 'All' | 'done' | 'pending'

  // Dynamic filter options lists
  const [filterOptions, setFilterOptions] = useState({
    financialYears: [],
    companies: [],
    pans: []
  });

  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [activeEditRow, setActiveEditRow] = useState(null);
  const [activeViewRow, setActiveViewRow] = useState(null);
  const [activeCrmRow, setActiveCrmRow] = useState(null);
  const [followupRow, setFollowupRow] = useState(null);

  // Statistics counters and amount aggregations
  const [stats, setStats] = useState({ 
    total: 0, 
    matched: 0, 
    less: 0, 
    excess: 0, 
    notReceived: 0,
    totalTally: 0,
    totalAs26: 0,
    totalSaarthi: 0,
    totalBalance: 0
  });

  // Format currency helper
  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(parseFloat(val || 0));
  };

  // Load distinct filter options once and on refresh
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const res = await getFilterOptions();
        if (res && res.success) {
          setFilterOptions({
            financialYears: res.financialYears || [],
            companies: res.companies || [],
            pans: res.pans || []
          });
        }
      } catch (err) {
        console.warn('Could not load filter options:', err);
      }
    };
    fetchOptions();
  }, [refreshTrigger, refreshKey]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      let res = await getReconciliationReport({
        page,
        limit,
        search,
        company: companyFilter === 'All' ? '' : companyFilter,
        pan: panFilter === 'All' ? '' : panFilter,
        overallStatus: overallStatus === 'All' ? '' : overallStatus,
        coverageFilter: coverageFilter === 'All' ? '' : coverageFilter,
        fy: fyFilter,
        sortBy,
        followupStatus: responseFilter === 'All' ? '' : responseFilter
      });

      if (res && res.success && Array.isArray(res.data)) {
        setRows(res.data);
        setTotal(res.total ?? res.data.length);
        
        if (res.stats && typeof res.stats.total === 'number') {
          setStats({
            total: res.stats.total,
            matched: res.stats.matched || 0,
            less: res.stats.less || 0,
            excess: res.stats.excess || 0,
            notReceived: res.stats.notReceived || 0,
            totalTally: parseFloat(res.stats.totalTally || 0),
            totalAs26: parseFloat(res.stats.totalAs26 || 0),
            totalSaarthi: parseFloat(res.stats.totalSaarthi || 0),
            totalBalance: parseFloat(res.stats.totalBalance || 0)
          });
        } else {
          let totalT = 0;
          let totalA = 0;
          let totalS = 0;
          let totalB = 0;
          const tempStats = { total: res.total ?? res.data.length, matched: 0, less: 0, excess: 0, notReceived: 0, totalTally: 0, totalAs26: 0, totalSaarthi: 0, totalBalance: 0 };
          res.data.forEach(r => {
            const as26 = parseFloat(r.as26Tds || 0);
            const tally = parseFloat(r.tallyTds || 0);
            const saarthi = parseFloat(r.saarthiTds || r.booksTds || 0);
            const bal = parseFloat(r.balance !== undefined ? r.balance : (tally > 0 ? tally - as26 : saarthi - as26));
            totalT += tally;
            totalA += as26;
            totalS += saarthi;
            totalB += bal;
            const effectiveStatus = (tally === 0 && saarthi === 0 && as26 > 0) ? 'Excess' : r.financialStatus;

            if (as26 === 0 || effectiveStatus === 'Not Received') {
              tempStats.notReceived++;
            } else if (effectiveStatus === 'Match' || effectiveStatus === 'Matched') {
              tempStats.matched++;
            } else if (effectiveStatus === 'Less Paid' || effectiveStatus === 'Less') {
              tempStats.less++;
            } else if (effectiveStatus === 'Excess') {
              tempStats.excess++;
            } else {
              tempStats.notReceived++;
            }
          });
          tempStats.totalTally = totalT;
          tempStats.totalAs26 = totalA;
          tempStats.totalSaarthi = totalS;
          tempStats.totalBalance = totalB;
          setStats(tempStats);
        }
      }
    } catch (err) {
      console.error('Failed to load reconciliation report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [
    page, 
    companyFilter, 
    panFilter, 
    overallStatus, 
    coverageFilter, 
    sortBy, 
    refreshTrigger, 
    refreshKey, 
    fyFilter, 
    responseFilter
  ]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchReport();
  };

  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleResetFilters = () => {
    setSearch('');
    setCompanyFilter('All');
    setPanFilter('All');
    setOverallStatus('All');
    setCoverageFilter('All');
    setResponseFilter('All');
    setFyFilter('All Financial Years');
    setPage(1);
  };

  const [exporting, setExporting] = useState(false);

  const handleCsvExport = async () => {
    try {
      setExporting(true);
      let exportRows = rows;
      try {
        const res = await getReconciliationReport({
          page: 1,
          limit: 10000,
          search,
          company: companyFilter === 'All' ? '' : companyFilter,
          pan: panFilter === 'All' ? '' : panFilter,
          overallStatus: overallStatus === 'All' ? '' : overallStatus,
          coverageFilter: coverageFilter === 'All' ? '' : coverageFilter,
          fy: fyFilter,
          sortBy,
          followupStatus: responseFilter === 'All' ? '' : responseFilter
        });
        if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
          exportRows = res.data;
        }
      } catch (err) {
        console.warn('Fallback to current page rows for export:', err);
      }

      if (!exportRows || exportRows.length === 0) {
        alert('No data available to export with current filters.');
        return;
      }

      const headers = [
        'Company Name',
        'TAN No.',
        'PAN No.',
        'Financial Year',
        'Tally TDS (INR)',
        '26AS TDS (INR)',
        'Saarthi TDS (INR)',
        'Balance (INR)',
        'Financial Status',
        'Books vs 26AS Status',
        'Books vs Tally Status',
        '26AS vs Tally Status',
        'Follow-up Status'
      ];

      const csvRows = exportRows.map(r => {
        const tally = parseFloat(r.tallyTds || 0);
        const as26 = parseFloat(r.as26Tds || 0);
        const saarthi = parseFloat(r.saarthiTds || r.booksTds || 0);
        const bal = parseFloat(r.balance !== undefined ? r.balance : (tally > 0 ? tally - as26 : saarthi - as26));
        const cleanName = (r.companyName || r.partyName || r.deductorName || 'Unassigned Entity').replace(/"/g, '""');
        const cleanTan = (!r.tanNo || r.tanNo.startsWith('NO_TAN_') || r.tanNo.includes('UNKNOWN')) ? 'Pending TAN' : r.tanNo;

        return [
          `"${cleanName}"`,
          `"${cleanTan}"`,
          `"${r.panNo || 'N/A'}"`,
          `"${r.financialYear || fyFilter || 'All'}"`,
          tally.toFixed(2),
          as26.toFixed(2),
          saarthi.toFixed(2),
          bal.toFixed(2),
          `"${r.financialStatus || r.overallStatus || 'Unknown'}"`,
          `"${r.booksVs26asStatus || ''}"`,
          `"${r.booksVsTallyStatus || ''}"`,
          `"${r.as26VsTallyStatus || ''}"`,
          `"${r.isFollowupDone ? 'Resolved / Done' : 'Pending'}"`
        ];
      });

      const csvContent = '\uFEFF' + [headers.join(','), ...csvRows.map(r => r.join(','))].join('\n');
      const cleanFy = (fyFilter || 'All').replace(/\s+/g, '_');
      const filename = `tds_reconciliation_${cleanFy}_${new Date().toISOString().slice(0, 10)}.csv`;
      
      triggerCsvDownload(filename, csvContent);
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to generate export file: ' + error.message);
    } finally {
      setExporting(false);
    }
  };

  const handleToggleFollowup = async (rowId) => {
    setRows(prevRows => prevRows.map(r => 
      r.id === rowId ? { ...r, isFollowupDone: r.isFollowupDone ? 0 : 1 } : r
    ));
    try {
      const res = await toggleFollowupDone(rowId);
      if (!res || !res.success) {
        setRows(prevRows => prevRows.map(r => 
          r.id === rowId ? { ...r, isFollowupDone: r.isFollowupDone ? 0 : 1 } : r
        ));
      } else if (res.hasOwnProperty('isFollowupDone')) {
        setRows(prevRows => prevRows.map(r => 
          r.id === rowId ? { ...r, isFollowupDone: res.isFollowupDone ? 1 : 0 } : r
        ));
      }
    } catch (err) {
      console.error('Failed to toggle followup:', err);
      setRows(prevRows => prevRows.map(r => 
        r.id === rowId ? { ...r, isFollowupDone: r.isFollowupDone ? 0 : 1 } : r
      ));
    }
  };

  const hasActiveFilters = search || companyFilter !== 'All' || panFilter !== 'All' || overallStatus !== 'All' || coverageFilter !== 'All' || (fyFilter && fyFilter !== 'All Financial Years') || responseFilter !== 'All';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl border border-[#E9E4FA] shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-[#1F1B2E] tracking-tight flex items-center gap-2">
            <Database className="w-7 h-7 text-[#9B87F5]" />
            3-Way TDS Reconciliation Workbench
          </h1>
          <p className="text-xs text-[#6B6580] mt-1">
            Reconcile client TDS across Tally Ledgers, Form 26AS, and Saarthi 360 CRM with year-based balance rules.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveCrmRow({})}
            className="inline-flex items-center gap-2 bg-[#9B87F5] hover:bg-[#8572E0] text-white font-extrabold px-4 py-2 rounded-xl transition text-xs cursor-pointer shadow-md"
            title="Add a missing TDS/Invoice entry into Saarthi 360 CRM Books"
          >
            <PlusCircle className="w-4 h-4" />
            <span>➕ Book Missing in CRM</span>
          </button>
          <button
            onClick={handleRefresh}
            className="inline-flex items-center gap-2 bg-white hover:bg-[#E8E4FF] text-[#1F1B2E] border border-[#E9E4FA] font-extrabold px-4 py-2 rounded-xl transition text-xs cursor-pointer shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Amount KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Tally Total */}
        <div className="bg-white rounded-3xl p-5 border border-[#E9E4FA] shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#6B6580] font-bold mb-1">
            <span>Tally Ledger TDS</span>
            <Building2 className="w-4 h-4 text-[#9B87F5]" />
          </div>
          <div className="text-xl font-black text-[#1F1B2E]">
            {formatCurrency(stats.totalTally)}
          </div>
          <div className="text-[11px] text-[#6B6580] font-medium mt-1">
            2019-2026 Primary Baseline
          </div>
        </div>

        {/* 26AS Total */}
        <div className="bg-white rounded-3xl p-5 border border-[#E9E4FA] shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#6B6580] font-bold mb-1">
            <span>Form 26AS Portal TDS</span>
            <FileText className="w-4 h-4 text-[#8572E0]" />
          </div>
          <div className="text-xl font-black text-[#1F1B2E]">
            {formatCurrency(stats.totalAs26)}
          </div>
          <div className="text-[11px] text-[#6B6580] font-medium mt-1">
            TRACES Portal Credit
          </div>
        </div>

        {/* Saarthi 360 Total */}
        <div className="bg-white rounded-3xl p-5 border border-[#E9E4FA] shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#6B6580] font-bold mb-1">
            <span>Saarthi 360 CRM TDS</span>
            <Database className="w-4 h-4 text-[#B4A7F5]" />
          </div>
          <div className="text-xl font-black text-[#1F1B2E]">
            {formatCurrency(stats.totalSaarthi)}
          </div>
          <div className="text-[11px] text-[#6B6580] font-medium mt-1">
            2026-2027+ Primary Baseline
          </div>
        </div>

        {/* Net Balance / Variance */}
        <div className="bg-white rounded-3xl p-5 border border-[#E9E4FA] shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#6B6580] font-bold mb-1">
            <span>Calculated Net Balance</span>
            <Layers className="w-4 h-4 text-[#9B87F5]" />
          </div>
          <div className={`text-xl font-black ${
            Math.abs(stats.totalBalance) <= 1.0 
              ? 'text-[#2E8B57]' 
              : stats.totalBalance > 0 
                ? 'text-[#D97706]' 
                : 'text-[#E11D48]'
          }`}>
            {stats.totalBalance > 0 ? `+${formatCurrency(stats.totalBalance)}` : formatCurrency(stats.totalBalance)}
          </div>
          <div className="text-[11px] text-[#6B6580] font-medium mt-1">
            {stats.totalBalance > 0 ? 'Pending TDS credit from clients' : stats.totalBalance < 0 ? 'Excess TDS in 26AS' : 'Balanced across sources'}
          </div>
        </div>
      </div>

      {/* Status Breakdown Count Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-[#E9E4FA] shadow-sm flex items-center gap-4">
          <div className="p-3 bg-[#E8E4FF] text-[#9B87F5] rounded-xl">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-[#6B6580] uppercase tracking-wider">Total Records</div>
            <div className="text-xl font-extrabold text-[#1F1B2E] mt-0.5">{total}</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#E9E4FA] shadow-sm flex items-center gap-4">
          <div className="p-3 bg-[#4ADE80]/15 text-[#2E8B57] rounded-xl">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-[#6B6580] uppercase tracking-wider">Match</div>
            <div className="text-xl font-extrabold text-[#2E8B57] mt-0.5">{stats.matched}</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#E9E4FA] shadow-sm flex items-center gap-4">
          <div className="p-3 bg-[#FBBF77]/15 text-[#D97706] rounded-xl">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-[#6B6580] uppercase tracking-wider">Less Paid</div>
            <div className="text-xl font-extrabold text-[#D97706] mt-0.5">{stats.less}</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#E9E4FA] shadow-sm flex items-center gap-4">
          <div className="p-3 bg-[#F87A9E]/15 text-[#E11D48] rounded-xl">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-[#6B6580] uppercase tracking-wider">Excess Paid</div>
            <div className="text-xl font-extrabold text-[#E11D48] mt-0.5">{stats.excess}</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#E9E4FA] shadow-sm flex items-center gap-4">
          <div className="p-3 bg-gray-100 text-gray-600 rounded-xl">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-[#6B6580] uppercase tracking-wider">Not Received</div>
            <div className="text-xl font-extrabold text-gray-700 mt-0.5">{stats.notReceived}</div>
          </div>
        </div>
      </div>

      {/* Advanced Filter Toolbar: Year-wise + Company-wise + PAN-wise + Search */}
      <div className="bg-white rounded-3xl border border-[#E9E4FA] p-5 shadow-sm space-y-4">
        
        {/* Top Search Bar & CSV Action */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <form onSubmit={handleSearchSubmit} className="flex w-full md:max-w-md gap-2">
            <div className="relative flex-grow">
              <Search className="w-4 h-4 text-[#6B6580] absolute left-3.5 top-3" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search across Company Name, TAN, or PAN..."
                className="w-full bg-[#F6F8FA] border border-[#E9E4FA] text-[#1F1B2E] rounded-xl pl-10 pr-4 py-2 text-xs focus:outline-none focus:border-[#9B87F5] font-medium"
              />
            </div>
            <button
              type="submit"
              className="bg-[#9B87F5] hover:bg-[#8572E0] text-white font-extrabold py-2 px-4 rounded-xl transition text-xs cursor-pointer shadow-2xs"
            >
              Search
            </button>
          </form>

          <div className="flex items-center gap-2 w-full md:w-auto">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-[#E11D48] bg-[#F87A9E]/10 hover:bg-[#F87A9E]/20 border border-[#F87A9E]/30 transition cursor-pointer"
                title="Reset all applied filters"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Filters
              </button>
            )}

            <button
              onClick={handleCsvExport}
              disabled={exporting}
              className="w-full md:w-auto inline-flex items-center justify-center gap-2 bg-[#9B87F5] hover:bg-[#8572E0] disabled:opacity-50 text-white font-bold py-2 px-4 rounded-xl transition text-xs cursor-pointer shadow-2xs"
            >
              {exporting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {exporting ? 'Exporting...' : 'Export CSV'}
            </button>
          </div>
        </div>

        {/* 3 Core Requested Filters Row: Year-Wise, Company-Wise, PAN-Wise */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-[#E9E4FA] text-xs">
          
          {/* 1. Year-Wise Filter */}
          <div>
            <label className="block text-[10px] font-bold text-[#6B6580] uppercase tracking-wider mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-[#9B87F5]" />
              Filter 1: Financial Year
            </label>
            <select
              value={fyFilter}
              onChange={(e) => { setPage(1); setFyFilter(e.target.value); }}
              className="w-full bg-[#F6F8FA] border border-[#E9E4FA] text-[#1F1B2E] rounded-xl px-3 py-2 font-bold focus:outline-none focus:border-[#9B87F5] cursor-pointer"
            >
              <option value="All Financial Years">All Financial Years</option>
              <option value="FY 2026-27">FY 2026-27 (Saarthi 360 Era)</option>
              <option value="FY 2025-26">FY 2025-26</option>
              <option value="FY 2024-25">FY 2024-25</option>
              <option value="FY 2023-24">FY 2023-24</option>
              <option value="FY 2022-23">FY 2022-23</option>
              <option value="FY 2021-22">FY 2021-22</option>
              <option value="FY 2020-21">FY 2020-21</option>
              <option value="FY 2019-20">FY 2019-20</option>
              {filterOptions.financialYears.filter(fy => !['FY 2026-27', 'FY 2025-26', 'FY 2024-25', 'FY 2023-24', 'FY 2022-23', 'FY 2021-22', 'FY 2020-21', 'FY 2019-20'].includes(fy)).map(fy => (
                <option key={fy} value={fy}>{fy}</option>
              ))}
            </select>
          </div>

          {/* 2. Company-Wise Filter */}
          <div>
            <label className="block text-[10px] font-bold text-[#6B6580] uppercase tracking-wider mb-1 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-[#9B87F5]" />
              Filter 2: Company Name
            </label>
            <select
              value={companyFilter}
              onChange={(e) => { setPage(1); setCompanyFilter(e.target.value); }}
              className="w-full bg-[#F6F8FA] border border-[#E9E4FA] text-[#1F1B2E] rounded-xl px-3 py-2 font-semibold focus:outline-none focus:border-[#9B87F5] cursor-pointer"
            >
              <option value="All">All Companies ({filterOptions.companies.length})</option>
              {filterOptions.companies.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* 3. PAN-Wise Filter */}
          <div>
            <label className="block text-[10px] font-bold text-[#6B6580] uppercase tracking-wider mb-1 flex items-center gap-1">
              <CreditCard className="w-3.5 h-3.5 text-[#9B87F5]" />
              Filter 3: PAN Number
            </label>
            <select
              value={panFilter}
              onChange={(e) => { setPage(1); setPanFilter(e.target.value); }}
              className="w-full bg-[#F6F8FA] border border-[#E9E4FA] text-[#1F1B2E] rounded-xl px-3 py-2 font-mono font-bold focus:outline-none focus:border-[#9B87F5] cursor-pointer"
            >
              <option value="All">All PAN Numbers ({filterOptions.pans.length})</option>
              {filterOptions.pans.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Secondary Filters Row: Coverage, Sort, Follow-up status */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-[#E9E4FA] text-xs">
          <div>
            <label className="block text-[10px] font-bold text-[#6B6580] uppercase tracking-wider mb-1">
              Source Coverage Filter
            </label>
            <select
              value={coverageFilter}
              onChange={(e) => { setPage(1); setCoverageFilter(e.target.value); }}
              className="w-full bg-[#F6F8FA] border border-[#E9E4FA] text-[#1F1B2E] rounded-xl px-3 py-2 font-semibold focus:outline-none focus:border-[#9B87F5] cursor-pointer"
            >
              <option value="All">Coverage: All Records</option>
              <option value="3/3">All 3 (Saarthi + Tally + 26AS)</option>
              <option value="2/3">Any 2 Sources (2/3)</option>
              <option value="saarthi_tally">Saarthi + Tally</option>
              <option value="tally_26as">Tally + 26AS</option>
              <option value="as26_saarthi">26AS + Saarthi</option>
              <option value="1/3">Single Source Only</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-[#6B6580] uppercase tracking-wider mb-1">
              Sort Order
            </label>
            <select
              value={sortBy}
              onChange={(e) => { setPage(1); setSortBy(e.target.value); }}
              className="w-full bg-[#F6F8FA] border border-[#E9E4FA] text-[#1F1B2E] rounded-xl px-3 py-2 font-semibold focus:outline-none focus:border-[#9B87F5] cursor-pointer"
            >
              <option value="updated_at">Recently Updated</option>
              <option value="difference_desc">Difference (High → Low)</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-[#6B6580] uppercase tracking-wider mb-1">
              Follow-up Action Status
            </label>
            <select
              value={responseFilter}
              onChange={(e) => { setPage(1); setResponseFilter(e.target.value); }}
              className="w-full bg-[#F6F8FA] border border-[#E9E4FA] text-[#1F1B2E] rounded-xl px-3 py-2 font-semibold focus:outline-none focus:border-[#9B87F5] cursor-pointer"
            >
              <option value="All">All Follow-up Statuses</option>
              <option value="done">✅ Follow-up Completed</option>
              <option value="pending">⏳ Follow-up Pending</option>
            </select>
          </div>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-2 border-b border-[#E9E4FA] pb-px overflow-x-auto text-xs">
        {['All', 'Match', 'Less Paid', 'Excess', 'Not Received'].map((tab) => (
          <button
            key={tab}
            onClick={() => { setPage(1); setOverallStatus(tab); }}
            className={`px-4 py-2 font-bold border-b-2 transition cursor-pointer whitespace-nowrap ${
              overallStatus === tab
                ? 'border-[#9B87F5] text-[#9B87F5] bg-[#9B87F5]/10'
                : 'border-transparent text-[#6B6580] hover:text-[#1F1B2E]'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Reconciliation Table Component */}
      <ReconciliationTable
        rows={rows}
        loading={loading}
        total={total}
        page={page}
        limit={limit}
        onPageChange={(newPage) => setPage(newPage)}
        onEditClick={(row) => setActiveEditRow(row)}
        onViewClick={(row) => setActiveViewRow(row)}
        onAddToCrmClick={(row) => setActiveCrmRow(row)}
        onFollowupClick={(row) => setFollowupRow(row)}
        onFollowupDoneToggle={handleToggleFollowup}
      />

      {/* Direct Follow-up Modal on Reconciliation Table */}
      {followupRow && (
        <AddFollowupModal
          initialData={{
            tan: followupRow.tanNo,
            company: followupRow.companyName && !['Client Entity', 'Unknown Client', 'Unknown Company', 'Unassigned Entity'].includes(followupRow.companyName.trim()) 
              ? followupRow.companyName 
              : (followupRow.tallyPartyName || followupRow.as26DeductorName || followupRow.deductorName || followupRow.partyName || ''),
            contactPerson: followupRow.contactPersonName || '',
            contactNumber: followupRow.contactNumber || ''
          }}
          onClose={() => setFollowupRow(null)}
          onSaveSuccess={() => {
            setFollowupRow(null);
            fetchReport();
          }}
        />
      )}

      {/* Manual Data Edit & Multi-Entry Sequential Modal */}
      {activeEditRow && (
        <EditModal
          row={activeEditRow}
          onClose={() => setActiveEditRow(null)}
          onSaveSuccess={handleRefresh}
        />
      )}

      {/* Read-Only Detail Modal */}
      {activeViewRow && (
        <div
          onClick={() => setActiveViewRow(null)}
          className="fixed inset-0 bg-[#1F1B2E]/50 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 z-50 overflow-y-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl border border-[#E9E4FA] max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden my-auto animate-scale-up"
          >
            <div className="flex-none flex justify-between items-center bg-[#9B87F5] text-white px-6 py-4 border-b border-[#8572E0]">
              <div>
                <h3 className="font-bold text-base text-white">Reconciliation Detail Record</h3>
                <p className="text-xs text-[#E8E4FF] mt-0.5">
                  {activeViewRow.companyName} {activeViewRow.tanNo ? `(${activeViewRow.tanNo})` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveViewRow(null)}
                className="p-1 rounded-lg text-[#E8E4FF] hover:text-white hover:bg-[#8572E0] transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs custom-scrollbar">
              <div className="grid grid-cols-2 gap-4 bg-[#F6F8FA] p-4 rounded-xl border border-[#E9E4FA]">
                <div>
                  <span className="text-[10px] font-bold text-[#6B6580] uppercase">Tally TDS</span>
                  <div className="font-black text-[#9B87F5] text-base">₹{Number(activeViewRow.tallyTds || 0).toLocaleString('en-IN')}</div>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-[#6B6580] uppercase">Form 26AS TDS</span>
                  <div className="font-black text-[#B4A7F5] text-base">₹{Number(activeViewRow.as26Tds || 0).toLocaleString('en-IN')}</div>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-[#6B6580] uppercase">Saarthi 360 TDS</span>
                  <div className="font-black text-[#9B87F5] text-base">₹{Number(activeViewRow.saarthiTds || activeViewRow.booksTds || 0).toLocaleString('en-IN')}</div>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-[#6B6580] uppercase">Calculated Balance</span>
                  <div className="font-black text-[#1F1B2E] text-base">
                    ₹{Number(activeViewRow.balance !== undefined ? activeViewRow.balance : activeViewRow.difference || 0).toLocaleString('en-IN')}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between py-1 border-b border-[#E9E4FA]">
                  <span className="text-[#6B6580] font-semibold">PAN Number:</span>
                  <span className="font-mono font-bold text-[#1F1B2E]">{activeViewRow.panNo || 'N/A'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#E9E4FA]">
                  <span className="text-[#6B6580] font-semibold">Financial Year:</span>
                  <span className="font-bold text-[#1F1B2E]">{activeViewRow.financialYear || 'Unspecified'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#E9E4FA]">
                  <span className="text-[#6B6580] font-semibold">Source Coverage:</span>
                  <span className="font-bold text-[#1F1B2E]">{activeViewRow.sourceCoverage?.label || '3/3 Match'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#E9E4FA]">
                  <span className="text-[#6B6580] font-semibold">Is Manually Overridden:</span>
                  <span className="font-bold text-[#9B87F5]">{activeViewRow.isManuallyEdited ? 'Yes' : 'No'}</span>
                </div>
              </div>
            </div>

            <div className="flex-none px-6 py-4 border-t border-[#E9E4FA] bg-[#F6F8FA] flex justify-end">
              <button
                type="button"
                onClick={() => setActiveViewRow(null)}
                className="bg-[#9B87F5] hover:bg-[#8572E0] text-white font-bold px-4 py-2 rounded-xl text-xs transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add To CRM Books Modal */}
      {activeCrmRow && (
        <AddToCrmModal
          row={activeCrmRow}
          onClose={() => setActiveCrmRow(null)}
          onSuccess={() => {
            setRefreshTrigger(prev => prev + 1);
          }}
        />
      )}
    </div>
  );
}
