import React, { useState, useEffect } from 'react';
import { RefreshCw, Search, Download, Database, CheckCircle, AlertTriangle, X, ShieldCheck } from 'lucide-react';
import ReconciliationTable from './ReconciliationTable';
import EditModal from './EditModal';
import { getReconciliationReport, getCsvExportUrl, triggerSeed } from '../../api/tdsApi';
import { useApp } from '../../context/AppContext';

export default function TdsReconciliation() {
  const { fyFilter, setFyFilter, refreshKey } = useApp();

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  
  const [search, setSearch] = useState('');
  const [overallStatus, setOverallStatus] = useState('All');
  const [coverageFilter, setCoverageFilter] = useState('All');
  const [sortBy, setSortBy] = useState('updated_at');

  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [activeEditRow, setActiveEditRow] = useState(null);
  const [activeViewRow, setActiveViewRow] = useState(null);

  // Statistics counters
  const [stats, setStats] = useState({ total: 0, matched: 0, less: 0, excess: 0, notReceived: 0 });

  const fetchReport = async () => {
    setLoading(true);
    try {
      let res = await getReconciliationReport({
        page,
        limit,
        search,
        overallStatus: overallStatus === 'All' ? '' : overallStatus,
        coverageFilter: coverageFilter === 'All' ? '' : coverageFilter,
        fy: fyFilter,
        sortBy
      });

      if (res && res.success && Array.isArray(res.data)) {
        setRows(res.data);
        setTotal(res.total ?? res.data.length);
        
        const tempStats = { total: res.total ?? res.data.length, matched: 0, less: 0, excess: 0, notReceived: 0 };
        res.data.forEach(r => {
          const as26 = parseFloat(r.as26Tds || 0);
          if (as26 === 0 || r.financialStatus === 'Not Received') {
            tempStats.notReceived++;
          } else if (r.financialStatus === 'Match') {
            tempStats.matched++;
          } else if (r.financialStatus === 'Less Paid') {
            tempStats.less++;
          } else if (r.financialStatus === 'Excess') {
            tempStats.excess++;
          } else {
            tempStats.notReceived++;
          }
        });
        setStats(tempStats);
      }
    } catch (err) {
      console.error('Failed to load reconciliation report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [page, overallStatus, coverageFilter, sortBy, refreshTrigger, refreshKey, fyFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchReport();
  };

  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleCsvExport = () => {
    const exportUrl = getCsvExportUrl({
      search,
      overallStatus: overallStatus === 'All' ? '' : overallStatus,
      coverageFilter: coverageFilter === 'All' ? '' : coverageFilter,
      fy: fyFilter
    });
    window.open(exportUrl, '_blank');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-[#E9E4FA] shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-[#1F1B2E] tracking-tight flex items-center gap-2">
            <Database className="w-7 h-7 text-[#9B87F5]" />
            3-Way TDS Reconciliation Workbench
          </h1>
          <p className="text-xs text-[#6B6580] mt-1">
            Reconcile client TDS entries across Tally Ledgers, Form 26AS portal, and Saarthi 360 CRM.
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="inline-flex items-center gap-2 bg-[#9B87F5] hover:bg-[#8572E0] text-white font-extrabold px-4 py-2 rounded-xl transition text-xs cursor-pointer shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Report
        </button>
      </div>

      {/* Statistics Cards */}
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

      {/* Query Bar */}
      <div className="bg-white rounded-2xl border border-[#E9E4FA] p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          {/* Search Form */}
          <form onSubmit={handleSearchSubmit} className="flex w-full md:max-w-md gap-2">
            <div className="relative flex-grow">
              <Search className="w-4 h-4 text-[#6B6580] absolute left-3.5 top-3" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by Company Name or TAN..."
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

          {/* CSV Export Button */}
          <button
            onClick={handleCsvExport}
            className="w-full md:w-auto inline-flex items-center justify-center gap-2 bg-[#9B87F5] hover:bg-[#8572E0] text-white font-bold py-2 px-4 rounded-xl transition text-xs cursor-pointer shadow-2xs"
          >
            <Download className="w-4 h-4" />
            Export Selected to CSV
          </button>
        </div>

        {/* Filter & Sort Controls Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-[#E9E4FA] text-xs">

          {/* Coverage Filter */}
          <div>
            <label className="block text-[10px] font-bold text-[#6B6580] uppercase tracking-wider mb-1">
              Source Coverage Filter
            </label>
            <select
              value={coverageFilter}
              onChange={(e) => { setPage(1); setCoverageFilter(e.target.value); }}
              className="w-full bg-[#F6F8FA] border border-[#E9E4FA] text-[#1F1B2E] rounded-xl px-3 py-2 font-semibold focus:outline-none focus:border-[#9B87F5] cursor-pointer"
            >
              <option value="All">Coverage: All Coverage</option>
              <option value="3/3">All 3 (Saarthi + Tally + 26AS)</option>
              <option value="2/3">Any 2 Sources (2/3)</option>
              <option value="saarthi_tally">Saarthi + Tally</option>
              <option value="tally_26as">Tally + 26AS</option>
              <option value="as26_saarthi">26AS + Saarthi</option>
              <option value="1/3">Single Source Only</option>
            </select>
          </div>

          {/* Sort By */}
          <div>
            <label className="block text-[10px] font-bold text-[#6B6580] uppercase tracking-wider mb-1">
              Sort Order
            </label>
            <select
              value={sortBy}
              onChange={(e) => { setPage(1); setSortBy(e.target.value); }}
              className="w-full bg-[#F6F8FA] border border-[#E9E4FA] text-[#1F1B2E] rounded-xl px-3 py-2 font-semibold focus:outline-none focus:border-[#9B87F5] cursor-pointer"
            >
              <option value="updated_at">Sort: Recently Updated</option>
              <option value="difference_desc">Sort: Difference (High → Low)</option>
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

      {/* Data Table */}
      <ReconciliationTable
        rows={rows}
        total={total}
        page={page}
        limit={limit}
        onPageChange={setPage}
        onEditClick={setActiveEditRow}
        onViewClick={setActiveViewRow}
      />

      {/* Manual Edit Modal */}
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
                <p className="text-xs text-[#E8E4FF] mt-0.5">{activeViewRow.companyName} ({activeViewRow.tanNo})</p>
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
                  <span className="text-[10px] font-bold text-[#6B6580] uppercase">Financial Status</span>
                  <div className="font-extrabold text-[#1F1B2E] mt-1">{activeViewRow.financialStatus || activeViewRow.overallStatus}</div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between py-1 border-b border-[#E9E4FA]">
                  <span className="text-[#6B6580] font-semibold">Source Coverage:</span>
                  <span className="font-bold text-[#1F1B2E]">{activeViewRow.sourceCoverage?.label || '3/3 Match'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#E9E4FA]">
                  <span className="text-[#6B6580] font-semibold">Bill Number:</span>
                  <span className="font-bold text-[#1F1B2E]">{activeViewRow.billNumber || 'N/A'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#E9E4FA]">
                  <span className="text-[#6B6580] font-semibold">Financial Year:</span>
                  <span className="font-bold text-[#1F1B2E]">{activeViewRow.financialYear || '2024-25'}</span>
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
    </div>
  );
}
