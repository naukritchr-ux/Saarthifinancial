import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileText, 
  Download, 
  Search, 
  RefreshCw, 
  Filter, 
  Calendar, 
  Building2, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowUpRight, 
  ArrowDownRight,
  User,
  Phone,
  Layers,
  CreditCard,
  Hash,
  Database,
  PlusCircle,
  RotateCcw
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { 
  getTallyReport,
  getAs26Report,
  getSaarthi360Report,
  getFyWiseReport, 
  getTanWiseReport,
  getFilterOptions
} from '../../api/tdsApi';
import { triggerCsvDownload } from '../../utils/exportUtils';
import AddToCrmModal from '../TdsReconciliation/AddToCrmModal';

export default function Reports() {
  const { fyFilter, setFyFilter, refreshKey } = useApp();

  // Active Primary Option: 'tally' | '26as' | 'saarthi360' | 'fy-wise' | 'tan-wise'
  const [activeTab, setActiveTab] = useState('tally');

  // Filter within sub-tab: 'all' | 'excess' | 'less' | 'matched'
  const [viewFilter, setViewFilter] = useState('all');

  // Search & Specific Filters
  const [search, setSearch] = useState('');
  const [companyFilter, setCompanyFilter] = useState('All');
  const [panFilter, setPanFilter] = useState('All');
  const [tabFyFilter, setTabFyFilter] = useState(fyFilter || 'All Financial Years');

  // Filter options
  const [filterOptions, setFilterOptions] = useState({
    financialYears: [],
    companies: [],
    pans: []
  });

  // Data & Loading state
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [localRefresh, setLocalRefresh] = useState(0);

  // Selected row for Booking in CRM Books
  const [selectedCrmRow, setSelectedCrmRow] = useState(null);

  // Pagination state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  // Load distinct filter options
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
  }, [refreshKey, localRefresh]);

  // Reset page to 1 whenever filters change
  useEffect(() => {
    setPage(1);
  }, [activeTab, viewFilter, search, companyFilter, panFilter, tabFyFilter, limit]);

  // Sync tabFyFilter if global fyFilter changes
  useEffect(() => {
    if (fyFilter) {
      setTabFyFilter(fyFilter);
    }
  }, [fyFilter]);

  // Fetch report data
  useEffect(() => {
    let isCancelled = false;

    const fetchReportData = async () => {
      setLoading(true);
      setError(null);
      try {
        let res;
        const filterParams = {
          fy: tabFyFilter === 'All Financial Years' ? '' : tabFyFilter,
          company: companyFilter === 'All' ? '' : companyFilter,
          pan: panFilter === 'All' ? '' : panFilter,
          view: viewFilter,
          search
        };

        if (activeTab === 'tally') {
          res = await getTallyReport(filterParams);
        } else if (activeTab === '26as') {
          res = await getAs26Report(filterParams);
        } else if (activeTab === 'saarthi360') {
          res = await getSaarthi360Report(filterParams);
        } else if (activeTab === 'fy-wise') {
          res = await getFyWiseReport(viewFilter, filterParams.fy);
        } else if (activeTab === 'tan-wise') {
          res = await getTanWiseReport(viewFilter, search, filterParams.fy);
        }

        if (!isCancelled) {
          if (res && res.success !== false) {
            setData(Array.isArray(res.data) ? res.data : []);
          } else {
            setError(res?.error || 'Failed to load report data');
            setData([]);
          }
        }
      } catch (err) {
        if (!isCancelled) {
          setError(err.message || 'Error fetching report');
          setData([]);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    const timer = setTimeout(fetchReportData, 200);
    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [activeTab, viewFilter, search, companyFilter, panFilter, tabFyFilter, refreshKey, localRefresh]);

  // Format currency helper
  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
      minimumFractionDigits: 0
    }).format(Math.round(parseFloat(val || 0)));
  };

  // Status badge pill
  const getStatusBadge = (status) => {
    switch (status) {
      case 'Matched':
      case 'Match':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-[#4ADE80]/15 text-[#2E8B57] border border-[#4ADE80]/30">
            <CheckCircle2 className="w-3 h-3" />
            Matched
          </span>
        );
      case 'Less Payment':
      case 'Less Paid':
      case 'Less':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-[#FBBF77]/20 text-[#D97706] border border-[#FBBF77]/40">
            <ArrowDownRight className="w-3 h-3" />
            Less Paid
          </span>
        );
      case 'Excess Payment':
      case 'Excess Paid':
      case 'Excess':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-[#F87A9E]/15 text-[#E11D48] border border-[#F87A9E]/30">
            <ArrowUpRight className="w-3 h-3" />
            Excess
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-700 border border-gray-300">
            {status || 'Unknown'}
          </span>
        );
    }
  };

  // Aggregated calculations for summary cards
  const summary = useMemo(() => {
    let totalTally = 0;
    let totalAs26 = 0;
    let totalSaarthi = 0;
    let totalBalance = 0;
    let matchedCount = 0;
    let lessCount = 0;
    let excessCount = 0;

    data.forEach(item => {
      const tally = parseFloat(item.tally_tds || item.tally_total || 0);
      const as26 = parseFloat(item.as26_tds || item.as26_total || 0);
      const saarthi = parseFloat(item.saarthi_tds || item.saarthi_total || 0);
      const bal = parseFloat(item.balance !== undefined ? item.balance : item.difference || 0);

      totalTally += tally;
      totalAs26 += as26;
      totalSaarthi += saarthi;
      totalBalance += bal;

      const st = item.status || item.financialStatus;
      if (st === 'Matched' || st === 'Match') matchedCount++;
      else if (st === 'Less Payment' || st === 'Less Paid' || st === 'Less') lessCount++;
      else if (st === 'Excess Payment' || st === 'Excess Paid' || st === 'Excess') excessCount++;
    });

    return {
      totalTally,
      totalAs26,
      totalSaarthi,
      totalBalance,
      rowCount: data.length,
      matchedCount,
      lessCount,
      excessCount
    };
  }, [data]);

  // Paginated slice of current data
  const total = data.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const paginatedData = useMemo(() => {
    const start = (page - 1) * limit;
    return data.slice(start, start + limit);
  }, [data, page, limit]);

  // Check if current tab is in Saarthi era
  const isSaarthiTabEra = tabFyFilter.includes('2026') || tabFyFilter.includes('2027') || tabFyFilter.includes('2028');

  // CSV Export handler
  const handleExportCSV = () => {
    if (!data || data.length === 0) {
      alert('No data available to export.');
      return;
    }

    let headers = [];
    if (activeTab === 'tally') {
      headers = ['TAN No.', 'Company / Party Name', 'PAN No.', 'Financial Year', 'Tally TDS (INR)', '26AS TDS (INR)', 'Saarthi TDS (INR)', 'Balance (INR)', 'Status'];
    } else if (activeTab === '26as') {
      headers = ['TAN No.', 'Deductor Name', 'PAN No.', 'Financial Year', 'Section', '26AS TDS (INR)', 'Tally TDS (INR)', 'Saarthi TDS (INR)', 'Balance (INR)', 'Status'];
    } else if (activeTab === 'saarthi360') {
      headers = ['TAN No.', 'Company Name', 'PAN No.', 'Financial Year', 'Bill No.', 'Bill Amount (INR)', 'Saarthi TDS (INR)', '26AS TDS (INR)', 'Tally TDS (INR)', 'Balance (INR)', 'Status'];
    } else if (activeTab === 'fy-wise') {
      headers = ['Financial Year', 'Tally TDS Total (INR)', '26AS TDS Total (INR)', 'Saarthi TDS Total (INR)', 'Balance (INR)', 'Status'];
    } else {
      headers = ['TAN No.', 'Company Name', 'PAN No.', 'Tally TDS Total (INR)', '26AS TDS Total (INR)', 'Saarthi TDS Total (INR)', 'Balance (INR)', 'Status'];
    }

    const rows = data.map(item => {
      if (activeTab === 'tally') {
        return [
          item.tan_no || '',
          `"${(item.company_name || '').replace(/"/g, '""')}"`,
          item.pan_no || 'N/A',
          item.financial_year || '',
          item.tally_tds || 0,
          item.as26_tds || 0,
          item.saarthi_tds || 0,
          item.balance || 0,
          item.status || ''
        ];
      } else if (activeTab === '26as') {
        return [
          item.tan_no || '',
          `"${(item.company_name || '').replace(/"/g, '""')}"`,
          item.pan_no || 'N/A',
          item.financial_year || '',
          item.section || '194J',
          item.as26_tds || 0,
          item.tally_tds || 0,
          item.saarthi_tds || 0,
          item.balance || 0,
          item.status || ''
        ];
      } else if (activeTab === 'saarthi360') {
        return [
          item.tan_no || '',
          `"${(item.company_name || '').replace(/"/g, '""')}"`,
          item.pan_no || 'N/A',
          item.financial_year || '',
          item.bill_number || 'N/A',
          item.total_bill_amount || 0,
          item.saarthi_tds || 0,
          item.as26_tds || 0,
          item.tally_tds || 0,
          item.balance || 0,
          item.status || ''
        ];
      } else if (activeTab === 'fy-wise') {
        return [
          item.financial_year || '',
          item.tally_total || 0,
          item.as26_total || 0,
          item.saarthi_total || 0,
          item.balance || 0,
          item.status || ''
        ];
      } else {
        return [
          item.tan_no || '',
          `"${(item.company_name || '').replace(/"/g, '""')}"`,
          item.pan_no || 'N/A',
          item.tally_total || 0,
          item.as26_total || 0,
          item.saarthi_total || 0,
          item.balance || 0,
          item.status || ''
        ];
      }
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const filename = `tds_report_${activeTab}_${tabFyFilter}_${new Date().toISOString().slice(0,10)}.csv`;
    triggerCsvDownload(filename, csvContent);
  };

  const handleResetFilters = () => {
    setSearch('');
    setCompanyFilter('All');
    setPanFilter('All');
    setViewFilter('all');
    setTabFyFilter('All Financial Years');
    setPage(1);
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      
      {/* Top Header Card */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-[#E9E4FA] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#9B87F5]/15 border border-[#9B87F5]/30 text-[#9B87F5] flex items-center justify-center text-2xl shadow-inner">
            <FileText className="w-6 h-6 text-[#9B87F5]" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-[#1F1B2E]">
              Financial TDS Reconciliation Reports
            </h1>
            <p className="text-xs text-[#6B6580] font-medium">
              3-Way Datasets: Tally Data, 26AS Data, and Saarthi 360. Balance calculated as Tally − 26AS (2019-2026) and Saarthi 360 − 26AS (2026-2027+).
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setSelectedCrmRow({})}
            className="flex items-center gap-2 bg-[#9B87F5] hover:bg-[#8572E0] text-white font-extrabold px-4 py-2 rounded-xl text-xs transition cursor-pointer shadow-sm"
            title="Book a missing TDS/Invoice entry directly into Saarthi 360 CRM"
          >
            <PlusCircle className="w-4 h-4" />
            <span>➕ Book Missing in CRM</span>
          </button>
          
          <button
            onClick={handleExportCSV}
            disabled={loading || data.length === 0}
            className="flex items-center gap-2 bg-white hover:bg-[#E8E4FF] text-[#1F1B2E] border border-[#E9E4FA] disabled:opacity-50 font-extrabold px-4 py-2 rounded-xl text-xs transition cursor-pointer shadow-xs"
            title="Export currently filtered report to CSV"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Tally Total */}
        <div className="bg-white rounded-3xl p-5 border border-[#E9E4FA] shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#6B6580] font-bold mb-1">
            <span>Tally Ledger TDS</span>
            <Building2 className="w-4 h-4 text-[#9B87F5]" />
          </div>
          <div className="text-xl font-black text-[#1F1B2E]">
            {formatCurrency(summary.totalTally)}
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
            {formatCurrency(summary.totalAs26)}
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
            {formatCurrency(summary.totalSaarthi)}
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
            Math.abs(summary.totalBalance) <= 1.0 
              ? 'text-[#2E8B57]' 
              : summary.totalBalance > 1.0 
                ? 'text-[#D97706]' 
                : 'text-[#E11D48]'
          }`}>
            {formatCurrency(summary.totalBalance)}
          </div>
          <div className="text-[11px] text-[#6B6580] font-medium mt-1">
            {summary.matchedCount} Matched · {summary.lessCount} Less · {summary.excessCount} Excess
          </div>
        </div>
      </div>

      {/* Main Tabs: 3 Options (Tally, 26AS, Saarthi 360) + Summary Views */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-[#E9E4FA] space-y-4">
        
        {/* Navigation Tabs Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E9E4FA] pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => { setActiveTab('tally'); }}
              className={`px-4 py-2 text-xs font-black rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'tally'
                  ? 'bg-[#9B87F5] text-white shadow-xs'
                  : 'bg-[#F6F8FA] text-[#6B6580] hover:text-[#1F1B2E] hover:bg-[#E8E4FF]'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              1. Tally Data Report
            </button>

            <button
              onClick={() => { setActiveTab('26as'); }}
              className={`px-4 py-2 text-xs font-black rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === '26as'
                  ? 'bg-[#9B87F5] text-white shadow-xs'
                  : 'bg-[#F6F8FA] text-[#6B6580] hover:text-[#1F1B2E] hover:bg-[#E8E4FF]'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              2. 26AS Data Report
            </button>

            <button
              onClick={() => { setActiveTab('saarthi360'); }}
              className={`px-4 py-2 text-xs font-black rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'saarthi360'
                  ? 'bg-[#9B87F5] text-white shadow-xs'
                  : 'bg-[#F6F8FA] text-[#6B6580] hover:text-[#1F1B2E] hover:bg-[#E8E4FF]'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              3. Saarthi 360 Data Report
            </button>

            <button
              onClick={() => { setActiveTab('fy-wise'); }}
              className={`px-3 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
                activeTab === 'fy-wise'
                  ? 'bg-[#8572E0] text-white shadow-xs'
                  : 'bg-[#F6F8FA] text-[#6B6580] hover:text-[#1F1B2E]'
              }`}
            >
              FY-Wise Summary
            </button>

            <button
              onClick={() => { setActiveTab('tan-wise'); }}
              className={`px-3 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
                activeTab === 'tan-wise'
                  ? 'bg-[#8572E0] text-white shadow-xs'
                  : 'bg-[#F6F8FA] text-[#6B6580] hover:text-[#1F1B2E]'
              }`}
            >
              TAN-Wise Summary
            </button>
          </div>

          {/* Status View Filter Pills */}
          <div className="flex items-center gap-1 bg-[#F6F8FA] p-1 rounded-2xl border border-[#E9E4FA]">
            <button
              onClick={() => setViewFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                viewFilter === 'all'
                  ? 'bg-white text-[#1F1B2E] shadow-2xs font-extrabold'
                  : 'text-[#6B6580] hover:text-[#1F1B2E]'
              }`}
            >
              All Records
            </button>
            <button
              onClick={() => setViewFilter('matched')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                viewFilter === 'matched'
                  ? 'bg-[#4ADE80]/20 text-[#2E8B57] shadow-2xs font-extrabold'
                  : 'text-[#6B6580] hover:text-[#2E8B57]'
              }`}
            >
              Matched
            </button>
            <button
              onClick={() => setViewFilter('less')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                viewFilter === 'less'
                  ? 'bg-[#FBBF77]/30 text-[#D97706] shadow-2xs font-extrabold'
                  : 'text-[#6B6580] hover:text-[#D97706]'
              }`}
            >
              Less Paid
            </button>
            <button
              onClick={() => setViewFilter('excess')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                viewFilter === 'excess'
                  ? 'bg-[#F87A9E]/20 text-[#E11D48] shadow-2xs font-extrabold'
                  : 'text-[#6B6580] hover:text-[#E11D48]'
              }`}
            >
              Excess
            </button>
          </div>
        </div>

        {/* 3 Core Filter Dropdowns: Year-Wise, Company-Wise, PAN-Wise + Search */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 text-xs">
          
          {/* Year-Wise Selector */}
          <div>
            <label className="block text-[10px] font-bold text-[#6B6580] uppercase tracking-wider mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-[#9B87F5]" />
              Financial Year
            </label>
            <select
              value={tabFyFilter}
              onChange={(e) => setTabFyFilter(e.target.value)}
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
            </select>
          </div>

          {/* Company-Wise Selector */}
          <div>
            <label className="block text-[10px] font-bold text-[#6B6580] uppercase tracking-wider mb-1 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-[#9B87F5]" />
              Company Name
            </label>
            <select
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="w-full bg-[#F6F8FA] border border-[#E9E4FA] text-[#1F1B2E] rounded-xl px-3 py-2 font-semibold focus:outline-none focus:border-[#9B87F5] cursor-pointer"
            >
              <option value="All">All Companies</option>
              {filterOptions.companies.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* PAN-Wise Selector */}
          <div>
            <label className="block text-[10px] font-bold text-[#6B6580] uppercase tracking-wider mb-1 flex items-center gap-1">
              <CreditCard className="w-3.5 h-3.5 text-[#9B87F5]" />
              PAN Number
            </label>
            <select
              value={panFilter}
              onChange={(e) => setPanFilter(e.target.value)}
              className="w-full bg-[#F6F8FA] border border-[#E9E4FA] text-[#1F1B2E] rounded-xl px-3 py-2 font-mono font-bold focus:outline-none focus:border-[#9B87F5] cursor-pointer"
            >
              <option value="All">All PAN Numbers</option>
              {filterOptions.pans.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* Keyword Search */}
          <div>
            <label className="block text-[10px] font-bold text-[#6B6580] uppercase tracking-wider mb-1 flex items-center gap-1">
              <Search className="w-3.5 h-3.5 text-[#6B6580]" />
              Search Text
            </label>
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search TAN, Company..."
                className="w-full bg-[#F6F8FA] border border-[#E9E4FA] text-[#1F1B2E] rounded-xl pl-3 pr-8 py-2 text-xs font-medium focus:outline-none focus:border-[#9B87F5]"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-2.5 text-[#6B6580] hover:text-[#1F1B2E]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Balance Rule Notification Pill */}
        <div className="bg-[#E8E4FF]/40 border border-[#E9E4FA] px-4 py-2.5 rounded-2xl flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-[#1F1B2E]">Balance Formula:</span>
            <span className="text-[#9B87F5] font-black">
              {isSaarthiTabEra 
                ? 'FY 2026-27 onwards: Balance = Saarthi 360 TDS − Form 26AS TDS'
                : 'FY 2019-20 to 2025-26: Balance = Tally TDS − Form 26AS TDS'}
            </span>
          </div>
          <span className="text-[#6B6580] text-[11px] font-medium">
            ₹1.0 Tolerance Applied · {data.length} Records Found
          </span>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto border border-[#E9E4FA] rounded-2xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#E8E4FF]/60 text-[#6B6580] border-b border-[#E9E4FA] font-black uppercase tracking-wider text-[11px]">
                {activeTab === 'fy-wise' ? (
                  <>
                    <th className="px-4 py-3.5">Financial Year</th>
                    <th className="px-4 py-3.5 text-right">Tally Total</th>
                    <th className="px-4 py-3.5 text-right">26AS Total</th>
                    <th className="px-4 py-3.5 text-right">Saarthi 360 Total</th>
                    <th className="px-4 py-3.5 text-right">Balance</th>
                    <th className="px-4 py-3.5 text-center">Status</th>
                  </>
                ) : activeTab === 'tan-wise' ? (
                  <>
                    <th className="px-4 py-3.5">TAN No.</th>
                    <th className="px-4 py-3.5">Company Name</th>
                    <th className="px-4 py-3.5">PAN No.</th>
                    <th className="px-4 py-3.5 text-right">Tally Total</th>
                    <th className="px-4 py-3.5 text-right">26AS Total</th>
                    <th className="px-4 py-3.5 text-right">Saarthi Total</th>
                    <th className="px-4 py-3.5 text-right">Balance</th>
                    <th className="px-4 py-3.5 text-center">Status</th>
                  </>
                ) : (
                  <>
                    <th className="px-4 py-3.5">Company / Entity</th>
                    <th className="px-4 py-3.5">TAN No.</th>
                    <th className="px-4 py-3.5">PAN No.</th>
                    <th className="px-4 py-3.5">FY</th>
                    <th className="px-4 py-3.5 text-right">Tally TDS</th>
                    <th className="px-4 py-3.5 text-right">26AS TDS</th>
                    <th className="px-4 py-3.5 text-right">Saarthi 360 TDS</th>
                    <th className="px-4 py-3.5 text-right">Calculated Balance</th>
                    <th className="px-4 py-3.5 text-center">Status</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E9E4FA] font-medium text-[#1F1B2E]">
              {loading ? (
                <tr>
                  <td colSpan="10" className="px-6 py-12 text-center text-[#6B6580]">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-7 h-7 text-[#9B87F5] animate-spin" />
                      <span className="font-bold text-[#1F1B2E]">Loading report records...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan="10" className="px-6 py-12 text-center text-[#6B6580]">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AlertCircle className="w-8 h-8 text-[#B4A7F5]" />
                      <span className="font-bold text-[#1F1B2E]">No records found for the selected criteria.</span>
                      <p className="text-xs text-[#6B6580]">Try clearing or adjusting the FY, Company, or Status filters.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedData.map((row, idx) => {
                  const bal = parseFloat(row.balance !== undefined ? row.balance : row.difference || 0);
                  const isShort = bal > 1.0;
                  const isExcess = bal < -1.0;

                  return (
                    <tr key={row.id || row.tan_no || idx} className="hover:bg-[#E8E4FF]/25 transition">
                      {activeTab === 'fy-wise' ? (
                        <>
                          <td className="px-4 py-3.5 font-bold text-[#1F1B2E]">{row.financial_year}</td>
                          <td className="px-4 py-3.5 text-right font-bold text-[#9B87F5]">{formatCurrency(row.tally_total)}</td>
                          <td className="px-4 py-3.5 text-right font-bold text-[#8572E0]">{formatCurrency(row.as26_total)}</td>
                          <td className="px-4 py-3.5 text-right font-bold text-[#B4A7F5]">{formatCurrency(row.saarthi_total)}</td>
                          <td className={`px-4 py-3.5 text-right font-black ${isShort ? 'text-[#D97706]' : isExcess ? 'text-[#E11D48]' : 'text-[#2E8B57]'}`}>
                            {formatCurrency(bal)}
                          </td>
                          <td className="px-4 py-3.5 text-center">{getStatusBadge(row.status)}</td>
                        </>
                      ) : activeTab === 'tan-wise' ? (
                        <>
                          <td className="px-4 py-3.5 font-mono font-bold text-[#1F1B2E]">{row.tan_no}</td>
                          <td className="px-4 py-3.5 font-bold text-[#1F1B2E]">{row.company_name}</td>
                          <td className="px-4 py-3.5 font-mono text-[#6B6580]">{row.pan_no || 'N/A'}</td>
                          <td className="px-4 py-3.5 text-right font-bold text-[#9B87F5]">{formatCurrency(row.tally_total)}</td>
                          <td className="px-4 py-3.5 text-right font-bold text-[#8572E0]">{formatCurrency(row.as26_total)}</td>
                          <td className="px-4 py-3.5 text-right font-bold text-[#B4A7F5]">{formatCurrency(row.saarthi_total)}</td>
                          <td className={`px-4 py-3.5 text-right font-black ${isShort ? 'text-[#D97706]' : isExcess ? 'text-[#E11D48]' : 'text-[#2E8B57]'}`}>
                            {formatCurrency(bal)}
                          </td>
                          <td className="px-4 py-3.5 text-center">{getStatusBadge(row.status)}</td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-3.5">
                            <div className="font-extrabold text-[#1F1B2E]">{row.company_name || 'Entity'}</div>
                            {row.bill_number && row.bill_number !== 'N/A' && (
                              <div className="text-[10px] text-[#6B6580]">Bill #{row.bill_number}</div>
                            )}
                          </td>
                          <td className="px-4 py-3.5 font-mono font-bold text-[#1F1B2E]">{row.tan_no}</td>
                          <td className="px-4 py-3.5 font-mono text-[#6B6580]">{row.pan_no || 'N/A'}</td>
                          <td className="px-4 py-3.5 font-bold text-[#1F1B2E] whitespace-nowrap">
                            <span className="px-2 py-0.5 bg-[#F6F8FA] border border-[#E9E4FA] rounded-md">
                              {row.financial_year || 'Unspecified'}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-right font-bold text-[#9B87F5]">{formatCurrency(row.tally_tds)}</td>
                          <td className="px-4 py-3.5 text-right font-bold text-[#8572E0]">{formatCurrency(row.as26_tds)}</td>
                          <td className="px-4 py-3.5 text-right font-bold text-[#B4A7F5]">{formatCurrency(row.saarthi_tds)}</td>
                          <td className={`px-4 py-3.5 text-right font-black ${isShort ? 'text-[#D97706]' : isExcess ? 'text-[#E11D48]' : 'text-[#2E8B57]'}`}>
                            <div className="inline-flex items-center gap-0.5">
                              {isShort ? <ArrowUpRight className="w-3.5 h-3.5" /> : isExcess ? <ArrowDownRight className="w-3.5 h-3.5" /> : null}
                              <span>{formatCurrency(bal)}</span>
                            </div>
                            <div className="text-[9px] text-[#6B6580] font-normal">
                              ({row.baselineSource || 'Baseline'} − 26AS)
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-center">{getStatusBadge(row.status || row.financialStatus)}</td>
                        </>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="p-4 border-t border-[#E9E4FA] bg-[#F6F8FA] rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="text-[#6B6580] font-medium">
            Showing <span className="font-bold text-[#1F1B2E]">{total === 0 ? 0 : (page - 1) * limit + 1}</span> to{' '}
            <span className="font-bold text-[#1F1B2E]">{Math.min(page * limit, total)}</span> of{' '}
            <span className="font-bold text-[#1F1B2E]">{total}</span> records
          </div>

          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="px-3 py-1.5 rounded-xl border border-[#E9E4FA] bg-white text-[#1F1B2E] disabled:opacity-40 font-bold hover:bg-[#E8E4FF] transition cursor-pointer"
            >
              Previous
            </button>
            <span className="font-bold text-[#1F1B2E]">
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="px-3 py-1.5 rounded-xl border border-[#E9E4FA] bg-white text-[#1F1B2E] disabled:opacity-40 font-bold hover:bg-[#E8E4FF] transition cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>

      </div>

      {/* CRM Booking Modal */}
      {selectedCrmRow && (
        <AddToCrmModal
          row={selectedCrmRow}
          onClose={() => setSelectedCrmRow(null)}
          onSuccess={() => setLocalRefresh(prev => prev + 1)}
        />
      )}
    </div>
  );
}
