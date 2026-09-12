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
  Layers
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { 
  getFyWiseReport, 
  getTanWiseReport, 
  getTanWiseByFyReport 
} from '../../api/tdsApi';

export default function Reports() {
  const { fyFilter, refreshKey } = useApp();

  // Active sub-tab: 'year-wise' | 'tan-wise' | 'tan-wise-fy'
  const [activeTab, setActiveTab] = useState('year-wise');

  // Filter within sub-tab: 'all' | 'excess' | 'less'
  const [viewFilter, setViewFilter] = useState('all');

  // Search filter for TAN tabs
  const [search, setSearch] = useState('');

  // Selected FY filter for TAN-wise by FY tab (defaults to global fyFilter or 'All')
  const [tabFyFilter, setTabFyFilter] = useState(fyFilter || 'All Financial Years');

  // Data & Loading state
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Sync tabFyFilter if global fyFilter changes
  useEffect(() => {
    if (fyFilter) {
      setTabFyFilter(fyFilter);
    }
  }, [fyFilter]);

  // Fetch report data whenever tab, viewFilter, search, tabFyFilter, or refreshKey changes
  useEffect(() => {
    let isCancelled = false;

    const fetchReportData = async () => {
      setLoading(true);
      setError(null);
      try {
        let res;
        if (activeTab === 'year-wise') {
          res = await getFyWiseReport(viewFilter);
        } else if (activeTab === 'tan-wise') {
          res = await getTanWiseReport(viewFilter, search);
        } else if (activeTab === 'tan-wise-fy') {
          res = await getTanWiseByFyReport(viewFilter, tabFyFilter, search);
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

    const timer = setTimeout(fetchReportData, activeTab === 'year-wise' ? 0 : 250);
    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [activeTab, viewFilter, search, tabFyFilter, refreshKey]);

  // Format currency helper
  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(parseFloat(val || 0));
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
            Less Payment
          </span>
        );
      case 'Excess Payment':
      case 'Excess Paid':
      case 'Excess':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-[#F87A9E]/15 text-[#E11D48] border border-[#F87A9E]/30">
            <ArrowUpRight className="w-3 h-3" />
            Excess Payment
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
    let totalDifference = 0;
    let matchedCount = 0;
    let lessCount = 0;
    let excessCount = 0;

    data.forEach(item => {
      const tally = parseFloat(item.tally_total || 0);
      const as26 = parseFloat(item.as26_total || 0);
      const diff = parseFloat(item.difference || 0);
      totalTally += tally;
      totalAs26 += as26;
      totalDifference += diff;

      if (item.status === 'Matched') matchedCount++;
      else if (item.status === 'Less Payment') lessCount++;
      else if (item.status === 'Excess Payment') excessCount++;
    });

    return {
      totalTally,
      totalAs26,
      totalDifference,
      rowCount: data.length,
      matchedCount,
      lessCount,
      excessCount
    };
  }, [data]);

  // Determine if Contact columns should show on TAN-wise by FY
  const showContactColumns = useMemo(() => {
    if (activeTab !== 'tan-wise-fy') return false;
    if (viewFilter === 'less') return true;
    return data.some(r => r.hr_name || r.contact_no);
  }, [activeTab, viewFilter, data]);

  // CSV Export handler
  const handleExportCSV = () => {
    if (!data || data.length === 0) {
      alert('No data available to export.');
      return;
    }

    let headers = [];
    if (activeTab === 'year-wise') {
      headers = ['Financial Year', 'Total as per Tally (INR)', 'Total as per 26AS (INR)', 'Difference (Tally - 26AS)', 'Status'];
    } else if (activeTab === 'tan-wise') {
      headers = ['TAN No.', 'Client Name', 'Total as per Tally (INR)', 'Total as per 26AS (INR)', 'Difference (Tally - 26AS)', 'Status'];
    } else {
      headers = ['TAN No.', 'Client Name', 'Financial Year', 'Total as per Tally (INR)', 'Total as per 26AS (INR)', 'Difference (Tally - 26AS)', 'Status'];
      if (showContactColumns) {
        headers.push('HR Name', 'Contact No.');
      }
    }

    const rows = data.map(item => {
      if (activeTab === 'year-wise') {
        return [
          item.financial_year || '',
          item.tally_total || 0,
          item.as26_total || 0,
          item.difference || 0,
          item.status || ''
        ];
      } else if (activeTab === 'tan-wise') {
        return [
          item.tan_no || '',
          `"${(item.company_name || '').replace(/"/g, '""')}"`,
          item.tally_total || 0,
          item.as26_total || 0,
          item.difference || 0,
          item.status || ''
        ];
      } else {
        const base = [
          item.tan_no || '',
          `"${(item.company_name || '').replace(/"/g, '""')}"`,
          item.financial_year || '',
          item.tally_total || 0,
          item.as26_total || 0,
          item.difference || 0,
          item.status || ''
        ];
        if (showContactColumns) {
          base.push(
            `"${(item.hr_name || '').replace(/"/g, '""')}"`,
            `"${(item.contact_no || '').replace(/"/g, '""')}"`
          );
        }
        return base;
      }
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `tds_report_${activeTab}_${viewFilter}_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
              Aggregated TDS Reports
            </h1>
            <p className="text-xs text-[#6B6580] font-medium">
              Multi-dimensional analysis across Financial Years, TAN accounts, and Tally vs. 26AS variances (₹1.0 Tolerance applied)
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            disabled={loading || data.length === 0}
            className="flex items-center gap-2 bg-[#9B87F5] hover:bg-[#8572E0] disabled:opacity-50 text-white font-extrabold px-4 py-2 rounded-xl text-xs transition cursor-pointer shadow-xs"
            title="Export currently filtered report to CSV"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total as per Tally */}
        <div className="bg-white rounded-2xl p-4 border border-[#E9E4FA] shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#6B6580] font-bold mb-1">
            <span>Total as per Tally</span>
            <Building2 className="w-4 h-4 text-[#9B87F5]" />
          </div>
          <div className="text-lg font-black text-[#1F1B2E]">
            {formatCurrency(summary.totalTally)}
          </div>
          <div className="text-[11px] text-[#6B6580] font-medium mt-1">
            {summary.rowCount} {activeTab === 'year-wise' ? 'Financial Years' : 'Entity Groups'}
          </div>
        </div>

        {/* Total as per 26AS */}
        <div className="bg-white rounded-2xl p-4 border border-[#E9E4FA] shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#6B6580] font-bold mb-1">
            <span>Total as per 26AS</span>
            <FileText className="w-4 h-4 text-[#9B87F5]" />
          </div>
          <div className="text-lg font-black text-[#1F1B2E]">
            {formatCurrency(summary.totalAs26)}
          </div>
          <div className="text-[11px] text-[#6B6580] font-medium mt-1">
            Deposited TDS in TRACES
          </div>
        </div>

        {/* Net Difference */}
        <div className="bg-white rounded-2xl p-4 border border-[#E9E4FA] shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#6B6580] font-bold mb-1">
            <span>Net Variance (Tally - 26AS)</span>
            <Layers className="w-4 h-4 text-[#9B87F5]" />
          </div>
          <div className={`text-lg font-black ${
            Math.abs(summary.totalDifference) <= 1.0 
              ? 'text-[#2E8B57]' 
              : summary.totalDifference > 0 
                ? 'text-[#D97706]' 
                : 'text-[#E11D48]'
          }`}>
            {formatCurrency(summary.totalDifference)}
          </div>
          <div className="text-[11px] text-[#6B6580] font-medium mt-1">
            {summary.totalDifference > 1.0 ? 'Shortfall in 26AS' : summary.totalDifference < -1.0 ? 'Excess in 26AS' : 'Balanced within ₹1.0'}
          </div>
        </div>

        {/* Matched vs Variance Counts */}
        <div className="bg-white rounded-2xl p-4 border border-[#E9E4FA] shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#6B6580] font-bold mb-1">
            <span>Breakdown Status</span>
            <CheckCircle2 className="w-4 h-4 text-[#4ADE80]" />
          </div>
          <div className="flex items-center gap-2 text-xs font-black mt-1">
            <span className="text-[#2E8B57] bg-[#4ADE80]/15 px-2 py-0.5 rounded-md">
              {summary.matchedCount} Matched
            </span>
            <span className="text-[#D97706] bg-[#FBBF77]/20 px-2 py-0.5 rounded-md">
              {summary.lessCount} Less
            </span>
            <span className="text-[#E11D48] bg-[#F87A9E]/15 px-2 py-0.5 rounded-md">
              {summary.excessCount} Excess
            </span>
          </div>
          <div className="text-[11px] text-[#6B6580] font-medium mt-1">
            Based on active view filter
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs & Filter Controls */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-[#E9E4FA] space-y-4">
        
        {/* Main Sub-Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E9E4FA] pb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setActiveTab('year-wise'); setSearch(''); }}
              className={`px-4 py-2 text-xs font-extrabold rounded-xl transition cursor-pointer ${
                activeTab === 'year-wise'
                  ? 'bg-[#9B87F5] text-white shadow-xs'
                  : 'bg-[#F6F8FA] text-[#6B6580] hover:text-[#1F1B2E] hover:bg-[#E8E4FF]'
              }`}
            >
              1. Year-Wise
            </button>
            <button
              onClick={() => { setActiveTab('tan-wise'); }}
              className={`px-4 py-2 text-xs font-extrabold rounded-xl transition cursor-pointer ${
                activeTab === 'tan-wise'
                  ? 'bg-[#9B87F5] text-white shadow-xs'
                  : 'bg-[#F6F8FA] text-[#6B6580] hover:text-[#1F1B2E] hover:bg-[#E8E4FF]'
              }`}
            >
              2. TAN No.-Wise
            </button>
            <button
              onClick={() => { setActiveTab('tan-wise-fy'); }}
              className={`px-4 py-2 text-xs font-extrabold rounded-xl transition cursor-pointer ${
                activeTab === 'tan-wise-fy'
                  ? 'bg-[#9B87F5] text-white shadow-xs'
                  : 'bg-[#F6F8FA] text-[#6B6580] hover:text-[#1F1B2E] hover:bg-[#E8E4FF]'
              }`}
            >
              3. TAN-Wise by FY
            </button>
          </div>

          {/* View Filter Pill Switcher (All / Excess Payment / Less Payment) */}
          <div className="flex items-center gap-1.5 bg-[#F6F8FA] p-1 rounded-2xl border border-[#E9E4FA]">
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
              onClick={() => setViewFilter('excess')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                viewFilter === 'excess'
                  ? 'bg-[#F87A9E]/20 text-[#E11D48] shadow-2xs font-extrabold'
                  : 'text-[#6B6580] hover:text-[#E11D48]'
              }`}
            >
              Excess Payment
            </button>
            <button
              onClick={() => setViewFilter('less')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                viewFilter === 'less'
                  ? 'bg-[#FBBF77]/30 text-[#D97706] shadow-2xs font-extrabold'
                  : 'text-[#6B6580] hover:text-[#D97706]'
              }`}
            >
              Less Payment
            </button>
          </div>
        </div>

        {/* Secondary Filters: Search & Financial Year dropdown for TAN tabs */}
        {(activeTab === 'tan-wise' || activeTab === 'tan-wise-fy') && (
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
            {/* Search Input */}
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-[#6B6580] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by TAN number or Client Company name..."
                className="w-full bg-[#F6F8FA] border border-[#E9E4FA] rounded-xl pl-9 pr-4 py-2 text-xs font-medium text-[#1F1B2E] placeholder-[#6B6580] focus:outline-none focus:border-[#9B87F5] focus:bg-white transition"
              />
            </div>

            {/* FY Filter for TAN-Wise by FY */}
            {activeTab === 'tan-wise-fy' && (
              <div className="flex items-center gap-2 bg-[#F6F8FA] border border-[#E9E4FA] rounded-xl px-3 py-2 text-xs font-bold text-[#1F1B2E] w-full sm:w-auto">
                <span className="text-[#6B6580]">FY:</span>
                <select
                  value={tabFyFilter}
                  onChange={(e) => setTabFyFilter(e.target.value)}
                  className="bg-transparent text-[#1F1B2E] font-bold focus:outline-none cursor-pointer"
                >
                  <option value="All Financial Years">All Financial Years</option>
                  <option value="FY 2026-27">FY 2026-27</option>
                  <option value="FY 2025-26">FY 2025-26</option>
                  <option value="FY 2024-25">FY 2024-25</option>
                  <option value="FY 2023-24">FY 2023-24</option>
                  <option value="FY 2022-23">FY 2022-23</option>
                  <option value="FY 2021-22">FY 2021-22</option>
                  <option value="FY 2020-21">FY 2020-21</option>
                  <option value="FY 2019-20">FY 2019-20</option>
                  <option value="FY 2018-19">FY 2018-19</option>
                  <option value="FY 2017-18">FY 2017-18</option>
                </select>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Main Data Table */}
      <div className="bg-white rounded-3xl shadow-sm border border-[#E9E4FA] overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-[#6B6580]">
            <RefreshCw className="w-8 h-8 text-[#9B87F5] animate-spin" />
            <p className="text-xs font-bold">Calculating aggregated report metrics...</p>
          </div>
        ) : error ? (
          <div className="py-16 px-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-[#F87A9E]/15 text-[#E11D48] flex items-center justify-center mx-auto mb-3 text-xl">
              ⚠️
            </div>
            <h3 className="text-sm font-black text-[#1F1B2E]">Failed to load report</h3>
            <p className="text-xs text-[#6B6580] mt-1">{error}</p>
          </div>
        ) : data.length === 0 ? (
          <div className="py-20 px-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-[#E8E4FF] text-[#9B87F5] flex items-center justify-center mx-auto mb-3 text-xl">
              📊
            </div>
            <h3 className="text-sm font-black text-[#1F1B2E]">No records found</h3>
            <p className="text-xs text-[#6B6580] mt-1">
              No matching data found for the selected view and filter criteria.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#F6F8FA] border-b border-[#E9E4FA] text-[#6B6580] font-extrabold uppercase tracking-wider text-[11px]">
                  {/* Columns for Year-Wise */}
                  {activeTab === 'year-wise' && (
                    <>
                      <th className="py-3.5 px-4">Financial Year</th>
                      <th className="py-3.5 px-4 text-right">Total as per Tally</th>
                      <th className="py-3.5 px-4 text-right">Total as per 26AS</th>
                      <th className="py-3.5 px-4 text-right">Difference (Tally - 26AS)</th>
                      <th className="py-3.5 px-4 text-center">Status</th>
                    </>
                  )}

                  {/* Columns for TAN No.-Wise */}
                  {activeTab === 'tan-wise' && (
                    <>
                      <th className="py-3.5 px-4">TAN Number</th>
                      <th className="py-3.5 px-4">Client Company Name</th>
                      <th className="py-3.5 px-4 text-right">Total as per Tally</th>
                      <th className="py-3.5 px-4 text-right">Total as per 26AS</th>
                      <th className="py-3.5 px-4 text-right">Difference (Tally - 26AS)</th>
                      <th className="py-3.5 px-4 text-center">Status</th>
                    </>
                  )}

                  {/* Columns for TAN-Wise by FY */}
                  {activeTab === 'tan-wise-fy' && (
                    <>
                      <th className="py-3.5 px-4">TAN Number</th>
                      <th className="py-3.5 px-4">Client Company Name</th>
                      <th className="py-3.5 px-4">Financial Year</th>
                      <th className="py-3.5 px-4 text-right">Total as per Tally</th>
                      <th className="py-3.5 px-4 text-right">Total as per 26AS</th>
                      <th className="py-3.5 px-4 text-right">Difference (Tally - 26AS)</th>
                      <th className="py-3.5 px-4 text-center">Status</th>
                      {showContactColumns && (
                        <>
                          <th className="py-3.5 px-4">HR Name</th>
                          <th className="py-3.5 px-4">Contact No.</th>
                        </>
                      )}
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E9E4FA]">
                {data.map((row, idx) => {
                  const diff = parseFloat(row.difference || 0);
                  const isMatch = Math.abs(diff) <= 1.0;
                  const isLess = diff > 1.0;

                  return (
                    <tr 
                      key={`${row.tan_no || ''}-${row.financial_year || ''}-${idx}`}
                      className="hover:bg-[#E8E4FF]/30 transition-colors"
                    >
                      {/* Year-Wise Row */}
                      {activeTab === 'year-wise' && (
                        <>
                          <td className="py-3.5 px-4 font-black text-[#1F1B2E]">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#E8E4FF] text-[#9B87F5] font-extrabold text-xs border border-[#9B87F5]/30">
                              <Calendar className="w-3.5 h-3.5" />
                              {row.financial_year}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right font-black text-[#1F1B2E]">
                            {formatCurrency(row.tally_total)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-black text-[#1F1B2E]">
                            {formatCurrency(row.as26_total)}
                          </td>
                          <td className={`py-3.5 px-4 text-right font-black ${
                            isMatch ? 'text-[#2E8B57]' : isLess ? 'text-[#D97706]' : 'text-[#E11D48]'
                          }`}>
                            {formatCurrency(row.difference)}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            {getStatusBadge(row.status)}
                          </td>
                        </>
                      )}

                      {/* TAN No.-Wise Row */}
                      {activeTab === 'tan-wise' && (
                        <>
                          <td className="py-3.5 px-4 font-mono font-black text-[#9B87F5]">
                            {row.tan_no}
                          </td>
                          <td className="py-3.5 px-4 font-bold text-[#1F1B2E] max-w-xs truncate" title={row.company_name}>
                            {row.company_name}
                          </td>
                          <td className="py-3.5 px-4 text-right font-black text-[#1F1B2E]">
                            {formatCurrency(row.tally_total)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-black text-[#1F1B2E]">
                            {formatCurrency(row.as26_total)}
                          </td>
                          <td className={`py-3.5 px-4 text-right font-black ${
                            isMatch ? 'text-[#2E8B57]' : isLess ? 'text-[#D97706]' : 'text-[#E11D48]'
                          }`}>
                            {formatCurrency(row.difference)}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            {getStatusBadge(row.status)}
                          </td>
                        </>
                      )}

                      {/* TAN-Wise by FY Row */}
                      {activeTab === 'tan-wise-fy' && (
                        <>
                          <td className="py-3.5 px-4 font-mono font-black text-[#9B87F5]">
                            {row.tan_no}
                          </td>
                          <td className="py-3.5 px-4 font-bold text-[#1F1B2E] max-w-xs truncate" title={row.company_name}>
                            {row.company_name}
                          </td>
                          <td className="py-3.5 px-4 font-extrabold text-[#6B6580]">
                            <span className="px-2 py-0.5 rounded-lg bg-[#F6F8FA] border border-[#E9E4FA]">
                              {row.financial_year}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right font-black text-[#1F1B2E]">
                            {formatCurrency(row.tally_total)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-black text-[#1F1B2E]">
                            {formatCurrency(row.as26_total)}
                          </td>
                          <td className={`py-3.5 px-4 text-right font-black ${
                            isMatch ? 'text-[#2E8B57]' : isLess ? 'text-[#D97706]' : 'text-[#E11D48]'
                          }`}>
                            {formatCurrency(row.difference)}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            {getStatusBadge(row.status)}
                          </td>
                          {showContactColumns && (
                            <>
                              <td className="py-3.5 px-4 text-[#1F1B2E] font-medium">
                                {row.hr_name ? (
                                  <span className="inline-flex items-center gap-1">
                                    <User className="w-3.5 h-3.5 text-[#9B87F5]" />
                                    {row.hr_name}
                                  </span>
                                ) : (
                                  <span className="text-[#6B6580] italic">—</span>
                                )}
                              </td>
                              <td className="py-3.5 px-4 text-[#1F1B2E] font-medium">
                                {row.contact_no ? (
                                  <span className="inline-flex items-center gap-1 font-mono text-xs">
                                    <Phone className="w-3.5 h-3.5 text-[#9B87F5]" />
                                    {row.contact_no}
                                  </span>
                                ) : (
                                  <span className="text-[#6B6580] italic">—</span>
                                )}
                              </td>
                            </>
                          )}
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
