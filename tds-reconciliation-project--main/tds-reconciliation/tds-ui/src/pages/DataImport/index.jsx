import React, { useState, useEffect } from 'react';
import { Upload, CheckCircle2, AlertCircle, Loader2, Wrench, RefreshCw, X, ShieldAlert } from 'lucide-react';
import UploadPanel from '../TdsReconciliation/UploadPanel';
import { getCleaningQueue, resolveCleaningItem } from '../../api/tdsApi';
import { useApp } from '../../context/AppContext';

export default function DataImport() {
  const { setCleaningQueueCount } = useApp();
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeResolveItem, setActiveResolveItem] = useState(null);

  // Modal resolution form state
  const [resolveTan, setResolveTan] = useState('');
  const [resolveCompany, setResolveCompany] = useState('');
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState(null);

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const res = await getCleaningQueue();
      if (res && res.success) {
        setQueue(res.data || []);
        setCleaningQueueCount(res.count || 0);
      }
    } catch (err) {
      console.error('Failed to load cleaning queue:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  const openResolveModal = (item) => {
    setActiveResolveItem(item);
    setResolveTan(item.tanNo === 'UNKNOWN_TAN' ? '' : item.tanNo);
    setResolveCompany(item.companyName === 'Unknown Client' ? '' : item.companyName);
    setResolveError(null);
  };

  const handleResolveSubmit = async (e) => {
    e.preventDefault();
    if (!resolveTan.trim() || resolveTan.trim().length < 10) {
      setResolveError('Valid 10-character TAN number is required');
      return;
    }
    if (!resolveCompany.trim()) {
      setResolveError('Canonical company name is required');
      return;
    }

    setResolving(true);
    setResolveError(null);
    try {
      const res = await resolveCleaningItem(activeResolveItem.id, {
        tanNo: resolveTan.trim(),
        companyName: resolveCompany.trim()
      });

      if (res && res.success) {
        setActiveResolveItem(null);
        fetchQueue();
      } else {
        setResolveError(res.error || 'Failed to resolve cleaning item');
      }
    } catch (err) {
      setResolveError(err.message || 'Connection error');
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Upload className="w-7 h-7 text-amber-500" />
            Data Import & Cleaning Workbench
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Upload raw Form 26AS portal reports, Tally ledger CSVs, and resolve deductor metadata discrepancies.
          </p>
        </div>
      </div>

      {/* Existing Upload Panel */}
      <UploadPanel onUploadSuccess={fetchQueue} />

      {/* Cleaning Queue Section */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden space-y-4 p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-100 pb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Wrench className="w-5 h-5 text-amber-500" />
              Data Cleaning Queue
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-500 text-slate-950">
                {queue.length} Flagged
              </span>
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Entries flagged for missing TAN format, deductor name discrepancies, or multi-source unlinked records
            </p>
          </div>

          <button
            onClick={fetchQueue}
            className="inline-flex items-center gap-2 bg-gray-50 hover:bg-gray-100 text-gray-700 font-semibold px-3.5 py-2 rounded-xl transition text-xs border border-gray-200 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Queue
          </button>
        </div>

        {/* Cleaning Queue Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-gray-200 text-slate-500 font-bold uppercase tracking-wider">
                <th className="px-4 py-3">Flagged Record / Company</th>
                <th className="px-4 py-3">Current TAN</th>
                <th className="px-4 py-3">Sources Reporting Data</th>
                <th className="px-4 py-3">Issue Reason</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-4 py-8 text-center text-gray-400">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-500" />
                    <span>Loading data cleaning queue...</span>
                  </td>
                </tr>
              ) : queue.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-4 py-8 text-center text-gray-400">
                    <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
                    <span className="font-bold text-gray-700 block">Cleaning Queue Clear!</span>
                    <span className="text-[11px]">All uploaded rows have verified TAN numbers and consistent deductor names.</span>
                  </td>
                </tr>
              ) : (
                queue.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition">
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-gray-900">{item.companyName}</div>
                      <div className="text-[10px] text-gray-400">Record ID: #{item.id}</div>
                    </td>

                    <td className="px-4 py-3.5 font-mono font-bold text-slate-700">
                      {item.tanNo}
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        {item.sources.map((s) => (
                          <span key={s} className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold text-[10px] border border-slate-200">
                            {s}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full text-[11px] font-bold border border-amber-200">
                        <ShieldAlert className="w-3 h-3" />
                        {item.issueReason}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 text-center">
                      <button
                        onClick={() => openResolveModal(item)}
                        className="bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold px-3 py-1.5 rounded-lg transition text-xs cursor-pointer shadow-sm"
                      >
                        Resolve
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Resolve Cleaning Modal */}
      {activeResolveItem && (
        <div
          onClick={() => setActiveResolveItem(null)}
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 z-50 overflow-y-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden my-auto animate-scale-up"
          >
            <div className="flex-none flex justify-between items-center bg-slate-950 text-white px-6 py-4 border-b border-slate-800">
              <div>
                <h3 className="font-bold text-base text-amber-400">Resolve Data Discrepancy</h3>
                <p className="text-xs text-slate-400 mt-0.5">Record ID #{activeResolveItem.id}</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveResolveItem(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleResolveSubmit} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs custom-scrollbar">
                {resolveError && (
                  <div className="bg-red-50 text-red-700 p-3 rounded-xl flex items-start gap-2 text-xs border border-red-200 font-semibold">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{resolveError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Canonical TAN Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={resolveTan}
                    onChange={(e) => setResolveTan(e.target.value.toUpperCase())}
                    placeholder="e.g. ABCD12345E"
                    maxLength={10}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono uppercase focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Canonical Company Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={resolveCompany}
                    onChange={(e) => setResolveCompany(e.target.value)}
                    placeholder="e.g. Acme Financial Services Pvt Ltd"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                  />
                </div>
              </div>

              <div className="flex-none px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex gap-3 justify-end items-center">
                <button
                  type="button"
                  onClick={() => setActiveResolveItem(null)}
                  className="px-4 py-2 rounded-xl text-slate-700 border border-slate-200 hover:bg-slate-100 text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resolving}
                  className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-5 py-2 rounded-xl transition text-xs flex items-center gap-2 disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  {resolving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Confirm & Update'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
