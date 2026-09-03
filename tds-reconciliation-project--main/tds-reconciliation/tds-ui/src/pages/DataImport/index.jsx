import React, { useState, useEffect } from 'react';
import { 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Wrench, 
  RefreshCw, 
  X, 
  ShieldAlert,
  AlertTriangle,
  Check,
  Edit3,
  Link as LinkIcon,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import UploadPanel from '../TdsReconciliation/UploadPanel';
import { getCleaningQueue, resolveCleaningItem } from '../../api/tdsApi';
import { useApp } from '../../context/AppContext';

export default function DataImport() {
  const { setCleaningQueueCount, refreshKey, triggerRefresh } = useApp();

  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Clean & Correct Data Modal state
  const [activeEditItem, setActiveEditItem] = useState(null);
  
  // Form fields for modal
  const [tallyRawName, setTallyRawName] = useState('');
  const [as26RawName, setAs26RawName] = useState('');
  const [saarthiName, setSaarthiName] = useState('');
  const [canonicalName, setCanonicalName] = useState('');
  
  const [entityTan, setEntityTan] = useState('');
  const [saarthiTan, setSaarthiTan] = useState('');
  const [saarthiPan, setSaarthiPan] = useState('');
  const [saarthiGstin, setSaarthiGstin] = useState('');
  
  const [matchDecision, setMatchDecision] = useState(null); // 'confirm' | 'reject' | null
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState(null);

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const res = await getCleaningQueue();
      if (res && res.success && Array.isArray(res.data)) {
        setQueue(res.data || []);
        setCleaningQueueCount(res.count || (res.data ? res.data.length : 0));
      } else {
        setQueue([]);
        setCleaningQueueCount(0);
      }
    } catch (err) {
      console.error('Failed to load cleaning queue:', err);
      setQueue([]);
      setCleaningQueueCount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, [refreshKey]);

  const openCleanModal = (item) => {
    setActiveEditItem(item);
    setTallyRawName(item.tallyCompanyName || item.companyName || '');
    setAs26RawName(item.as26CompanyName || item.saarthiSuggestion || item.companyName || '');
    setSaarthiName(item.saarthiSuggestion || item.companyName || '');
    setCanonicalName(item.saarthiSuggestion || item.companyName || '');
    
    setEntityTan(item.tallyTan || item.tanNo || '');
    setSaarthiTan(item.as26Tan || item.saarthiTan || item.tanNo || '');
    setSaarthiPan(item.pan || 'RHMCT2664N');
    setSaarthiGstin(item.gstin || '24RHMCT2664N3Z6');
    
    setMatchDecision(null);
    setResolveError(null);
  };

  const handleQuickDecision = async (item, decision) => {
    setResolving(true);
    try {
      const res = await resolveCleaningItem(item.id, {
        tanNo: decision === 'confirm' ? (item.saarthiTan || item.tanNo) : item.tanNo,
        companyName: item.saarthiSuggestion || item.companyName,
        status: decision === 'confirm' ? 'Cleaned' : 'Rejected'
      });
      if (res && res.success) {
        triggerRefresh();
        fetchQueue();
      }
    } catch (err) {
      console.error('Failed to resolve item:', err);
    } finally {
      setResolving(false);
    }
  };

  const handleSaveModal = async (markClean = false) => {
    if (!activeEditItem) return;
    
    const finalTan = saarthiTan.trim() || entityTan.trim();
    const finalCompany = canonicalName.trim() || saarthiName.trim() || tallyRawName.trim();
    
    if (!finalTan || finalTan.length < 10) {
      setResolveError('Valid 10-character TAN number is required');
      return;
    }

    setResolving(true);
    setResolveError(null);
    try {
      const res = await resolveCleaningItem(activeEditItem.id, {
        tanNo: finalTan.toUpperCase(),
        companyName: finalCompany,
        status: markClean ? 'Cleaned' : 'Updated'
      });

      if (res && res.success) {
        setActiveEditItem(null);
        triggerRefresh();
        fetchQueue();
      } else {
        setResolveError(res?.error || 'Failed to save clean data');
      }
    } catch (err) {
      setResolveError(err.message || 'Connection error saving data');
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 rounded-2xl border border-slate-700/60 shadow-md text-white">
        <div>
          <h1 className="text-2xl font-black text-amber-400 tracking-tight flex items-center gap-2">
            <Upload className="w-7 h-7 text-amber-400" />
            Data Import & Cleaning Workbench
          </h1>
          <p className="text-xs text-slate-300 font-medium mt-1">
            Upload Form 26AS portal reports, Tally ledger CSVs, resolve conflicting TAN format flags, and standardize deductor records.
          </p>
        </div>

        <button
          onClick={fetchQueue}
          className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 font-bold px-4 py-2.5 rounded-xl transition text-xs shadow-sm cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Queue
        </button>
      </div>

      {/* Upload Panel Section */}
      <UploadPanel onUploadSuccess={fetchQueue} />

      {/* SECTION 2: Requires Attention (Cards & TAN Mismatch Tables) */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-gray-200 pb-3">
          <div>
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-amber-500" />
              Requires Attention ({queue.length})
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Similar names with conflicting TANs, low-confidence name matches, and rejected matches. A fuzzy name match never overrides a conflicting TAN — resolve manually.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="bg-white p-12 rounded-2xl border border-gray-200 shadow-sm text-center text-gray-400 space-y-2">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-amber-500" />
            <p className="text-xs font-bold text-slate-600">Loading flagged entries for manual review...</p>
          </div>
        ) : queue.length === 0 ? (
          <div className="bg-white p-10 rounded-2xl border border-emerald-200 shadow-sm text-center text-slate-700 space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
            <h3 className="text-base font-black text-slate-900">Cleaning Queue Clean!</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              All uploaded datasets are cleanly reconciled with non-conflicting TAN identifiers. No manual attention required.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {queue.map((item, idx) => {
              if (!item) return null;
              const isTanMismatch = item.isTanMismatch || (item.as26Tan && item.tallyTan && item.as26Tan !== item.tallyTan);
              const confidenceScore = item.confidence ?? 100;
              const tallyName = item.tallyCompanyName || item.companyName;
              const as26Name = item.as26CompanyName || '—';
              const saarthiName = item.saarthiSuggestion || item.companyName;
              const tallyTan = item.tallyTan || item.tanNo;
              const as26Tan = item.as26Tan || '—';
              const saarthiTan = item.saarthiTan || item.tanNo;

              return (
                <div
                  key={item.id || idx}
                  className="bg-white rounded-2xl border border-red-200/90 shadow-sm hover:shadow-md transition p-5 space-y-4"
                >
                  {/* Card Header Tag */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
                    <div className="flex items-center gap-2">
                      {isTanMismatch ? (
                        <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 border border-red-200 px-3 py-1 rounded-full text-xs font-black">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                          TAN Mismatch — Manual Review Required
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-900 border border-amber-200 px-3 py-1 rounded-full text-xs font-black">
                          {confidenceScore < 100 ? `Match Confidence — ${confidenceScore}%` : 'Verification Required'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Summary Descriptions */}
                  <div className="space-y-1 text-xs">
                    <div className="font-extrabold text-slate-900">
                      Tally/26AS entity:{' '}
                      <span className="font-black text-slate-950 uppercase">{tallyName}</span>{' '}
                      <span className="font-mono text-gray-500">(TAN {tallyTan})</span>
                    </div>

                    {saarthiName && (
                      <div className="font-bold text-slate-700">
                        Saarthi suggestion:{' '}
                        <span className="font-extrabold text-slate-900">{saarthiName}</span>{' '}
                        <span className="font-mono text-gray-500">(TAN {saarthiTan})</span>
                      </div>
                    )}

                    {isTanMismatch ? (
                      <p className="text-[11px] text-red-600 font-semibold pt-0.5">
                        Names look alike but TANs differ ({tallyTan} vs {as26Tan !== '—' ? as26Tan : saarthiTan}). Correct a TAN via Edit, or reject the suggestion.
                      </p>
                    ) : (
                      <p className="text-[11px] text-amber-700 font-semibold pt-0.5">
                        Multi-source entity record ({confidenceScore}% name match score across datasets). Standardize entity name below.
                      </p>
                    )}
                  </div>

                  {/* Field Comparison Grid */}
                  <div className="overflow-x-auto rounded-xl border border-gray-200 bg-slate-50/50">
                    <table className="w-full text-left text-xs font-medium border-collapse">
                      <thead>
                        <tr className="border-b border-gray-200 bg-slate-100/70 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                          <th className="px-4 py-2.5 w-24">FIELD</th>
                          <th className="px-4 py-2.5">TALLY</th>
                          <th className="px-4 py-2.5">FORM 26AS</th>
                          <th className="px-4 py-2.5">SAARTHI 360</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200/60 bg-white">
                        <tr>
                          <td className="px-4 py-2.5 font-bold text-slate-500">Company</td>
                          <td className="px-4 py-2.5 font-black text-slate-900 uppercase">{tallyName}</td>
                          <td className="px-4 py-2.5 font-black text-slate-800 uppercase">{as26Name}</td>
                          <td className="px-4 py-2.5 font-bold text-slate-800">{saarthiName}</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-2.5 font-bold text-slate-500">TAN</td>
                          <td className="px-4 py-2.5 font-mono font-black text-red-600">{tallyTan}</td>
                          <td className="px-4 py-2.5 font-mono font-black text-red-600">{as26Tan}</td>
                          <td className="px-4 py-2.5 font-mono font-black text-emerald-700">{saarthiTan}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Action Buttons Row */}
                  <div className="flex flex-wrap items-center gap-2.5 pt-1">
                    <button
                      onClick={() => handleQuickDecision(item, 'confirm')}
                      disabled={resolving}
                      className="inline-flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs px-4 py-2 rounded-xl transition cursor-pointer shadow-sm disabled:opacity-50"
                    >
                      <Check className="w-4 h-4" />
                      Confirm Match
                    </button>

                    <button
                      onClick={() => handleQuickDecision(item, 'reject')}
                      disabled={resolving}
                      className="inline-flex items-center gap-1.5 bg-white hover:bg-red-50 text-red-700 border border-red-200 font-bold text-xs px-3.5 py-2 rounded-xl transition cursor-pointer disabled:opacity-50"
                    >
                      <X className="w-3.5 h-3.5 text-red-500" />
                      Reject Match
                    </button>

                    <button
                      onClick={() => openCleanModal(item)}
                      className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold text-xs px-3.5 py-2 rounded-xl transition cursor-pointer"
                    >
                      <LinkIcon className="w-3.5 h-3.5 text-slate-500" />
                      Manually Map
                    </button>

                    <button
                      onClick={() => openCleanModal(item)}
                      className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-bold text-xs px-3.5 py-2 rounded-xl transition cursor-pointer shadow-2xs"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                      Edit / Clean Data
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CLEAN & CORRECT DATA MODAL */}
      {activeEditItem && (
        <div
          onClick={() => setActiveEditItem(null)}
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-50 rounded-2xl shadow-2xl border border-slate-300 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden my-auto animate-scale-up text-slate-900"
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center bg-white px-6 py-4 border-b border-slate-200">
              <div>
                <h3 className="font-black text-lg text-slate-900 flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-amber-500" />
                  Clean & Correct Data
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  {activeEditItem.companyName} · FY FY 2021-22
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveEditItem(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs custom-scrollbar bg-slate-50">
              {/* Alert Notification Box */}
              <div className="bg-amber-50 border border-amber-200/90 text-amber-900 p-3.5 rounded-xl flex items-start gap-2 text-xs font-semibold">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <span>
                  TAN mismatch flagged. If the Saarthi TAN is wrong, correct it below; if the entity TAN is wrong, fix that. Aligning the two TANs clears the flag automatically.
                </span>
              </div>

              {resolveError && (
                <div className="bg-red-50 text-red-700 p-3 rounded-xl flex items-start gap-2 text-xs border border-red-200 font-semibold">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{resolveError}</span>
                </div>
              )}

              {/* SECTION 1: COMPANY NAMES */}
              <div className="space-y-3">
                <div>
                  <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider">
                    COMPANY NAMES
                  </h4>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Correct the imported names. Standardized names are recomputed automatically for matching.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">
                      Tally company name (raw)
                    </label>
                    <input
                      type="text"
                      value={tallyRawName}
                      onChange={(e) => setTallyRawName(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono uppercase text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">
                      Form 26AS company name (raw)
                    </label>
                    <input
                      type="text"
                      value={as26RawName}
                      onChange={(e) => setAs26RawName(e.target.value)}
                      className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">
                      Saarthi 360 company name
                    </label>
                    <input
                      type="text"
                      value={saarthiName}
                      onChange={(e) => setSaarthiName(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">
                      Canonical (display) name
                    </label>
                    <input
                      type="text"
                      value={canonicalName}
                      onChange={(e) => setCanonicalName(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 2: TAX IDENTIFIERS */}
              <div className="space-y-3">
                <div>
                  <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider">
                    TAX IDENTIFIERS
                  </h4>
                  <p className="text-[11px] text-slate-500 font-medium">
                    TAN is the primary match key. Tally and 26AS share one entity TAN; Saarthi has its own.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">
                      Entity TAN (Tally / 26AS)
                    </label>
                    <input
                      type="text"
                      maxLength={10}
                      value={entityTan}
                      onChange={(e) => setEntityTan(e.target.value.toUpperCase())}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold uppercase text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">
                      Saarthi 360 TAN
                    </label>
                    <input
                      type="text"
                      maxLength={10}
                      value={saarthiTan}
                      onChange={(e) => setSaarthiTan(e.target.value.toUpperCase())}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold uppercase text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">
                      PAN (Saarthi)
                    </label>
                    <input
                      type="text"
                      maxLength={10}
                      value={saarthiPan}
                      onChange={(e) => setSaarthiPan(e.target.value.toUpperCase())}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono uppercase text-slate-800 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">
                      GSTIN (Saarthi)
                    </label>
                    <input
                      type="text"
                      maxLength={15}
                      value={saarthiGstin}
                      onChange={(e) => setSaarthiGstin(e.target.value.toUpperCase())}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono uppercase text-slate-800 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Match Decision Toggle */}
              <div className="bg-slate-200/60 p-3.5 rounded-xl border border-slate-300/80 flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-700">Match decision:</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setMatchDecision('confirm')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                      matchDecision === 'confirm'
                        ? 'bg-emerald-700 text-white shadow-sm'
                        : 'bg-emerald-800/90 text-white hover:bg-emerald-700'
                    }`}
                  >
                    Confirm Match
                  </button>
                  <button
                    type="button"
                    onClick={() => setMatchDecision('reject')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                      matchDecision === 'reject'
                        ? 'bg-red-50 text-red-700 border-red-300 font-extrabold'
                        : 'bg-white text-red-700 border-red-200 hover:bg-red-50'
                    }`}
                  >
                    Reject Match
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-200 bg-white flex flex-wrap gap-3 justify-between items-center">
              <button
                type="button"
                onClick={() => {
                  setEntityTan(activeEditItem.tanNo || '');
                  setSaarthiTan(activeEditItem.saarthiTan || activeEditItem.tanNo || '');
                  setCanonicalName(activeEditItem.saarthiSuggestion || activeEditItem.companyName || '');
                }}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSaveModal(true)}
                  disabled={resolving}
                  className="bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 font-black px-4 py-2 rounded-xl transition text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Check className="w-4 h-4 text-emerald-600" />
                  Save & Mark Clean
                </button>

                <button
                  type="button"
                  onClick={() => handleSaveModal(false)}
                  disabled={resolving}
                  className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-5 py-2 rounded-xl transition text-xs shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {resolving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
