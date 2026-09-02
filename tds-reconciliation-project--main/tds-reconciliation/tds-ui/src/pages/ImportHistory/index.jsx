import React, { useState, useEffect } from 'react';
import { Clock, Search, FileText, CheckCircle2, AlertCircle, RefreshCw, Database, Filter, Trash2 } from 'lucide-react';
import { getUploadHistory, deleteUploadBatch } from '../../api/tdsApi';

const DEFAULT_BATCHES = [
  { id: 101, file_name: 'TDS_Mearge_Data_2019-2024.xlsx', uploaded_by: 'Accounts Manager', import_type: '26AS & Tally Ledger', status: 'Completed', rows_processed: 1420, upload_time: '2026-03-18 14:32:00' },
  { id: 102, file_name: 'Form26AS_FY2024-25_Q4.csv', uploaded_by: 'Senior Auditor', import_type: '26AS TDS Report', status: 'Completed', rows_processed: 385, upload_time: '2026-03-17 11:15:00' },
];

export default function ImportHistory() {
  const getInitialBatches = () => {
    try {
      if (localStorage.getItem('tds_purged_all') === 'true') return [];
      const localLogs = JSON.parse(localStorage.getItem('tds_upload_history') || '[]');
      const deletedIds = JSON.parse(localStorage.getItem('tds_deleted_batches') || '[]');
      const combined = [...localLogs, ...DEFAULT_BATCHES];
      return combined.filter(b => !deletedIds.includes(String(b.id)) && !deletedIds.includes(String(b.upload_batch_id)));
    } catch (e) {
      return DEFAULT_BATCHES;
    }
  };

  const [batches, setBatches] = useState(getInitialBatches);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const fetchHistory = async () => {
    try {
      const res = await getUploadHistory();
      if (res && res.success && Array.isArray(res.data)) {
        setBatches(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch import history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleDeleteBatch = async (batchItem) => {
    const fileName = batchItem.fileName || batchItem.file_name || 'this file';
    if (!window.confirm(`Are you sure you want to delete "${fileName}" and its associated dataset records?`)) {
      return;
    }

    try {
      const meta = typeof batchItem.metadata === 'string' ? JSON.parse(batchItem.metadata || '{}') : (batchItem.metadata || {});
      const batchId = meta.upload_batch_id || batchItem.upload_batch_id || batchItem.batchId;
      await deleteUploadBatch(batchItem.id, batchId);
      
      // Update UI list
      setBatches(prev => prev.filter(b => String(b.id) !== String(batchItem.id) && String(b.upload_batch_id || '') !== String(batchId || '')));
      await fetchHistory();
    } catch (err) {
      console.error('Failed to delete batch:', err);
    }
  };

  const filteredBatches = batches.filter((b) => {
    const fileName = b.fileName || b.file_name || '';
    const uploadedBy = b.uploadedBy || b.uploaded_by || '';
    const matchesSearch = !search || fileName.toLowerCase().includes(search.toLowerCase()) || uploadedBy.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'All' || (b.status || '').toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Clock className="w-7 h-7 text-amber-500" />
            File Import History & Audit Audit Trail
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Complete historical log of all Form 26AS reports, Tally ledger CSVs, and bulk excel uploads processed.
          </p>
        </div>

        <button
          onClick={fetchHistory}
          className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold px-4 py-2 rounded-xl transition text-xs shadow cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Log
        </button>
      </div>

      {/* Query Bar */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4 text-xs">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by file name or uploader..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-3 py-2 text-xs font-medium focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-3.5 h-3.5 text-gray-400" />
          <span className="font-bold text-gray-500 uppercase text-[10px]">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 font-semibold focus:outline-none focus:border-amber-500 cursor-pointer"
          >
            <option value="All">All Statuses</option>
            <option value="Completed">Completed</option>
            <option value="Failed">Failed</option>
            <option value="Processing">Processing</option>
          </select>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-900 text-white border-b border-slate-800 font-bold uppercase tracking-wider">
                <th className="px-4 py-3">File Name</th>
                <th className="px-4 py-3">Uploaded By</th>
                <th className="px-4 py-3">Import Type</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Rows Processed</th>
                <th className="px-4 py-3 text-right">Upload Time</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium text-gray-800">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-4 py-8 text-center text-gray-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-500" />
                    <span>Loading import logs...</span>
                  </td>
                </tr>
              ) : filteredBatches.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 py-12 text-center text-gray-400">
                    <Clock className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <span className="font-bold text-gray-700 block">No Import History Found</span>
                    <span className="text-[11px]">Uploads from Form 26AS or Tally will appear here.</span>
                  </td>
                </tr>
              ) : (
                filteredBatches.map((b) => {
                  const fileName = b.fileName || b.file_name || 'Import File';
                  const uploadedBy = b.uploadedBy || b.uploaded_by || 'System';
                  const status = b.status || 'Completed';
                  const meta = b.metadata || {};
                  
                  let importType = 'Form 26AS';
                  if (meta.upload_type === 'TALLY_TDS' || fileName.toLowerCase().includes('tally')) {
                    importType = 'Tally Ledger';
                  } else if (meta.upload_type === '26AS_TDS' || fileName.toLowerCase().includes('26as')) {
                    importType = 'Form 26AS';
                  } else {
                    importType = 'Master Data';
                  }

                  const rowCount = meta.total_rows || meta.records || '—';
                  const uploadTime = b.uploadTime || b.upload_time || b.created_at;

                  return (
                    <tr key={b.id} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-3.5 font-bold text-gray-900 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-amber-500 flex-shrink-0" />
                        <span>{fileName}</span>
                      </td>

                      <td className="px-4 py-3.5 text-gray-600 font-semibold">{uploadedBy}</td>

                      <td className="px-4 py-3.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          importType === 'Tally Ledger'
                            ? 'bg-teal-50 text-teal-700 border-teal-200'
                            : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                        }`}>
                          {importType}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          status === 'Completed'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}>
                          {status}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-800">
                        {rowCount}
                      </td>

                      <td className="px-4 py-3.5 text-right text-gray-500">
                        {uploadTime ? new Date(uploadTime).toLocaleString('en-IN') : '—'}
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        <button
                          onClick={() => handleDeleteBatch(b)}
                          title="Delete file & associated records"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
