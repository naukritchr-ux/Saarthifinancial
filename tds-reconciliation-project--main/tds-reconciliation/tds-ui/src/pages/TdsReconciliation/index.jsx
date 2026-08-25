import React, { useState, useEffect } from 'react';
import { RefreshCw, Search, Download, Database, CheckCircle, AlertTriangle, HelpCircle } from 'lucide-react';
import UploadPanel from './UploadPanel';
import ReconciliationTable from './ReconciliationTable';
import EditModal from './EditModal';
import { getReconciliationReport, getCsvExportUrl } from '../../api/tdsReconciliation';

export default function TdsReconciliation() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  
  const [search, setSearch] = useState('');
  const [overallStatus, setOverallStatus] = useState('All');
  
  // Pairwise filter dropdowns
  const [books26asFilter, setBooks26asFilter] = useState('All');
  const [booksTallyFilter, setBooksTallyFilter] = useState('All');
  const [as26TallyFilter, setAs26TallyFilter] = useState('All');

  const [loading, setLoading] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [activeEditRow, setActiveEditRow] = useState(null);

  // Statistics counters
  const [stats, setStats] = useState({ total: 0, matched: 0, partial: 0, major: 0 });

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await getReconciliationReport({
        page,
        limit,
        search,
        overallStatus: overallStatus === 'All' ? '' : overallStatus,
        booksVs26asStatus: books26asFilter === 'All' ? '' : books26asFilter,
        booksVsTallyStatus: booksTallyFilter === 'All' ? '' : booksTallyFilter,
        as26VsTallyStatus: as26TallyFilter === 'All' ? '' : as26TallyFilter
      });

      if (res.success) {
        setRows(res.data);
        setTotal(res.total);
        
        // Compute statistics for display based on returned overall statuses
        // In production, you would fetch these from a dedicated stats endpoint
        const tempStats = { total: res.total, matched: 0, partial: 0, major: 0 };
        res.data.forEach(r => {
          if (r.overallStatus === 'All Matched') tempStats.matched++;
          else if (r.overallStatus === 'Partial Mismatch') tempStats.partial++;
          else if (r.overallStatus === 'Major Mismatch') tempStats.major++;
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
  }, [page, overallStatus, books26asFilter, booksTallyFilter, as26TallyFilter, refreshTrigger]);

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
      overallStatus: overallStatus === 'All' ? '' : overallStatus
    });
    // Trigger download
    window.open(exportUrl, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
            <Database className="w-7 h-7 text-indigo-600" />
            3-Way TDS Reconciliation
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Compare CRM books, Form 26AS credits, and Tally ledger reports.
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="inline-flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-100 font-semibold px-4 py-2 rounded-xl transition text-sm"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Report
        </button>
      </div>

      {/* Upload Panel */}
      <UploadPanel onUploadSuccess={handleRefresh} />

      {/* Summary Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Invoices</div>
            <div className="text-xl font-extrabold text-gray-900 mt-0.5">{total}</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-green-50 text-green-600 rounded-xl">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">All Matched</div>
            <div className="text-xl font-extrabold text-gray-900 mt-0.5">{stats.matched}</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Partial Mismatches</div>
            <div className="text-xl font-extrabold text-gray-900 mt-0.5">{stats.partial}</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-red-50 text-red-600 rounded-xl">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Major Mismatches</div>
            <div className="text-xl font-extrabold text-gray-900 mt-0.5">{stats.major}</div>
          </div>
        </div>
      </div>

      {/* Query Bar */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          {/* Search Form */}
          <form onSubmit={handleSearchSubmit} className="flex w-full md:max-w-md gap-2">
            <div className="relative flex-grow">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by Company Name or TAN Number..."
                className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition"
              />
            </div>
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-5 rounded-xl transition text-sm"
            >
              Search
            </button>
          </form>

          {/* CSV Export Button */}
          <button
            onClick={handleCsvExport}
            className="w-full md:w-auto inline-flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 text-white font-semibold py-2.5 px-5 rounded-xl transition text-sm"
          >
            <Download className="w-4 h-4" />
            Export Selected to CSV
          </button>
        </div>

        {/* Pairwise filters row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-gray-50">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Books vs 26AS Status</label>
            <select
              value={books26asFilter}
              onChange={(e) => { setPage(1); setBooks26asFilter(e.target.value); }}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-xs font-medium focus:outline-none focus:border-indigo-500"
            >
              <option value="All">All</option>
              <option value="Matched">Matched</option>
              <option value="Less Paid">Less Paid</option>
              <option value="Excess">Excess</option>
              <option value="Not Received">Not Received</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Books vs Tally Status</label>
            <select
              value={booksTallyFilter}
              onChange={(e) => { setPage(1); setBooksTallyFilter(e.target.value); }}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-xs font-medium focus:outline-none focus:border-indigo-500"
            >
              <option value="All">All</option>
              <option value="Matched">Matched</option>
              <option value="Less Paid">Less Paid</option>
              <option value="Excess">Excess</option>
              <option value="Not Received">Not Received</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">26AS vs Tally Status</label>
            <select
              value={as26TallyFilter}
              onChange={(e) => { setPage(1); setAs26TallyFilter(e.target.value); }}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-xs font-medium focus:outline-none focus:border-indigo-500"
            >
              <option value="All">All</option>
              <option value="Matched">Matched</option>
              <option value="Less Paid">Less Paid</option>
              <option value="Excess">Excess</option>
              <option value="Not Received">Not Received</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabs list filtering by overall status */}
      <div className="flex gap-2 border-b border-gray-200 pb-px">
        {['All', 'All Matched', 'Partial Mismatch', 'Major Mismatch'].map((tab) => (
          <button
            key={tab}
            onClick={() => { setPage(1); setOverallStatus(tab); }}
            className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition ${
              overallStatus === tab
                ? 'border-indigo-600 text-indigo-600 font-bold'
                : 'border-transparent text-gray-500 hover:text-gray-800'
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
      />

      {/* Manual Edit Modal */}
      {activeEditRow && (
        <EditModal
          row={activeEditRow}
          onClose={() => setActiveEditRow(null)}
          onSaveSuccess={handleRefresh}
        />
      )}
    </div>
  );
}
