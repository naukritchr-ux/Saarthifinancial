import React, { useState, useEffect } from 'react';
import { Clock, Search, FileText, CheckCircle2, AlertCircle, RefreshCw, Database, Filter, Trash2 } from 'lucide-react';
import { getUploadHistory, deleteUploadBatch } from '../../api/tdsApi';
import { useApp } from '../../context/AppContext';

export default function ImportHistory() {
  const { refreshKey, triggerRefresh } = useApp();
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [deleteConfirmItem, setDeleteConfirmItem] = useState(null);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await getUploadHistory();
      if (res && res.success && Array.isArray(res.data)) {
        setBatches(res.data);
      } else {
        setBatches([]);
      }
    } catch (err) {
      console.error('Failed to fetch import history:', err);
      setBatches([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [refreshKey]);

  const executeDeleteBatch = async (batchItem) => {
    setDeleteConfirmItem(null);
    const targetId = String(batchItem.id);
    const meta = typeof batchItem.metadata === 'string' ? JSON.parse(batchItem.metadata || '{}') : (batchItem.metadata || {});
    const batchId = meta.upload_batch_id || batchItem.upload_batch_id || batchItem.batchId;

    try {
      const res = await deleteUploadBatch(batchItem.id, batchId);
      if (res && res.success !== false) {
        setBatches(prev => prev.filter(b => String(b.id) !== targetId && String(b.upload_batch_id || '') !== String(batchId || '')));
        triggerRefresh();
        await fetchHistory();
      } else {
        alert(`Delete failed: ${res?.error || 'Failed to delete file from database'}`);
      }
    } catch (err) {
      alert(`Delete failed: ${err.message || 'Error connecting to database server'}`);
    }
  };

  const handleDeleteBatch = (batchItem) => {
    setDeleteConfirmItem(batchItem);
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#F6F8FA] p-6 rounded-2xl border border-[#DCE2E8] shadow-2xs">
        <div>
          <h1 className="text-2xl font-black text-[#3A4048] tracking-tight flex items-center gap-2">
            <Clock className="w-7 h-7 text-[#6E8CA0]" />
            File Import History & Audit Trail
          </h1>
          <p className="text-xs text-[#7A8794] mt-1">
            Complete historical log of all Form 26AS reports, Tally ledger CSVs, and bulk excel uploads processed.
          </p>
        </div>

        <button
          onClick={fetchHistory}
          className="inline-flex items-center gap-2 bg-[#6E8CA0] hover:bg-[#5B788C] text-white font-bold px-4 py-2 rounded-xl transition text-xs shadow-2xs cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Log
        </button>
      </div>

      {/* Query Bar */}
      <div className="bg-[#F6F8FA] p-5 rounded-2xl border border-[#DCE2E8] shadow-2xs flex flex-col sm:flex-row justify-between items-center gap-4 text-xs">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-[#7A8794] absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by file name or uploader..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border border-[#DCE2E8] text-[#3A4048] rounded-xl pl-9 pr-3 py-2 text-xs font-medium focus:outline-none focus:border-[#6E8CA0]"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-3.5 h-3.5 text-[#7A8794]" />
          <span className="font-bold text-[#7A8794] uppercase text-[10px]">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white border border-[#DCE2E8] text-[#3A4048] rounded-xl px-3 py-2 font-semibold focus:outline-none focus:border-[#6E8CA0] cursor-pointer"
          >
            <option value="All">All Statuses</option>
            <option value="Completed">Completed</option>
            <option value="Failed">Failed</option>
            <option value="Processing">Processing</option>
          </select>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-[#F6F8FA] rounded-2xl border border-[#DCE2E8] shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#EEF1F4] border-b border-[#DCE2E8] text-[#7A8794] font-bold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4">File Name & Source</th>
                <th className="py-3 px-4">Uploaded By</th>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DCE2E8] bg-white">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-[#7A8794]">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#6E8CA0]" />
                    <span>Loading import history log...</span>
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-[#7A8794]">
                    <Clock className="w-8 h-8 mx-auto mb-2 text-[#8FA3BF]" />
                    <span className="font-bold text-[#3A4048] block text-sm">No Import Log Records Found</span>
                    <p className="text-xs text-[#7A8794] mt-1">Upload a Form 26AS or Tally ledger file to see it logged here.</p>
                  </td>
                </tr>
              ) : (
                filteredItems.map((row) => (
                  <tr key={row.id || row.upload_time} className="hover:bg-[#EEF1F4]/50 transition">
                    <td className="py-3.5 px-4 font-bold text-[#3A4048] flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#6E8CA0]" />
                      <span>{row.fileName || row.file_name || 'Dataset Upload'}</span>
                    </td>
                    <td className="py-3.5 px-4 text-[#3A4048] font-medium">{row.uploadedBy || row.uploaded_by || 'System'}</td>
                    <td className="py-3.5 px-4 text-[#7A8794] font-semibold">{row.uploadTime ? new Date(row.uploadTime).toLocaleString('en-IN') : 'Recently'}</td>
                    <td className="py-3.5 px-4">{getStatusBadge(row.status)}</td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => setDeleteConfirmItem(row)}
                        className="inline-flex items-center gap-1 bg-[#C08585]/15 hover:bg-[#C08585]/30 text-[#703535] font-bold px-2.5 py-1 rounded-lg transition text-[11px] cursor-pointer"
                        title="Delete batch upload record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Custom Confirmation Modal overlay */}
      {deleteConfirmItem && (
        <div className="fixed inset-0 bg-[#3E4A5C]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#F6F8FA] border border-[#DCE2E8] text-[#3A4048] rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 border-b border-[#DCE2E8] pb-3">
              <div className="p-2.5 rounded-xl bg-[#C08585]/20 border border-[#C08585]/30 text-[#C08585]">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-[#3A4048]">Delete File Batch</h3>
                <p className="text-xs text-[#7A8794] font-medium">This action will delete dataset entries.</p>
              </div>
            </div>

            <p className="text-xs text-[#3A4048] leading-relaxed font-semibold">
              Are you sure you want to delete{' '}
              <span className="text-[#6E8CA0] font-black underline">
                "{deleteConfirmItem.fileName || deleteConfirmItem.file_name || 'this file'}"
              </span>
              {' '}and its associated dataset records from the database?
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirmItem(null)}
                className="px-4 py-2 text-xs font-bold text-[#3A4048] bg-[#EEF1F4] hover:bg-[#DCE2E8] rounded-xl border border-[#DCE2E8] transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => executeDeleteBatch(deleteConfirmItem)}
                className="px-4 py-2 text-xs font-black text-white bg-[#C08585] hover:bg-[#B07474] rounded-xl transition shadow-2xs cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Yes, Delete Batch
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
