import React, { useState, useEffect } from 'react';
import { 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  FileText, 
  Trash2, 
  Sparkles, 
  Info, 
  Download, 
  RefreshCcw,
  Check,
  Table,
  Layers,
  ChevronDown
} from 'lucide-react';
import { upload26as, uploadTally, purgeData, purgeFollowups, getUploadHistory, deleteUploadBatch } from '../../api/tdsReconciliation';
import { useApp } from '../../context/AppContext';

export default function UploadPanel({ onUploadSuccess }) {
  const { triggerRefresh, fyFilter } = useApp();
  const [as26File, setAs26File] = useState(null);
  const [tallyFile, setTallyFile] = useState(null);

  const [as26Fy, setAs26Fy] = useState(fyFilter && fyFilter !== 'All Financial Years' ? fyFilter : 'FY 2024-25');
  const [tallyFy, setTallyFy] = useState(fyFilter && fyFilter !== 'All Financial Years' ? fyFilter : 'FY 2024-25');

  // Sync with global FY if user changed navbar dropdown
  useEffect(() => {
    if (fyFilter && fyFilter !== 'All Financial Years') {
      setAs26Fy(fyFilter);
      setTallyFy(fyFilter);
    }
  }, [fyFilter]);
  
  // Import mode selector: 'update' (upsert/merge), 'clean' (wipe past & import fresh)
  const [as26ImportMode, setAs26ImportMode] = useState('update');
  const [tallyImportMode, setTallyImportMode] = useState('update');

  const [as26Status, setAs26Status] = useState({ loading: false, error: null, success: null });
  const [tallyStatus, setTallyStatus] = useState({ loading: false, error: null, success: null });
  const [purgeStatus, setPurgeStatus] = useState({ loading: false, message: null, error: null });
  const [purgeConfirmTarget, setPurgeConfirmTarget] = useState(null);

  // File Batch Management State (for choosing which file to delete)
  const [uploadedBatches, setUploadedBatches] = useState([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [selected26asToDelete, setSelected26asToDelete] = useState('');
  const [selectedTallyToDelete, setSelectedTallyToDelete] = useState('');
  const [deleteFileConfirm, setDeleteFileConfirm] = useState(null);
  const [deletingFile, setDeletingFile] = useState(false);

  const [showExpectedHeaders, setShowExpectedHeaders] = useState(true);

  // Helper to trigger sample CSV downloads for user reference
  const downloadSampleCsv = (type) => {
    let content = '';
    let filename = '';
    if (type === '26as') {
      filename = 'sample_form_26as.csv';
      content = `Name of the Company,TAN No,Invoice Amount,TDS Amt,Section,Quarter\n` +
        `MUMBAI TECH LABS PVT LTD,MUMK12345F,500000.00,50000.00,194J,Q4\n` +
        `GARIMA SYSTEM SOLUTIONS,DELG03106F,250000.00,25000.00,194C,Q4\n` +
        `ALPHA CONSULTING SERVICES,BLRN98765A,120000.00,12000.00,194J,Q4`;
    } else {
      filename = 'sample_tally_ledger.csv';
      content = `Name of the Company,GST Num,PAN No,Gross Total,TDS Amt,TAN No,Voucher Date\n` +
        `MUMBAI TECH LABS PVT LTD,27AAAAA0000A1Z5,AAAAA0000A,500000.00,50000.00,MUMK12345F,2026-03-15\n` +
        `GARIMA SYSTEM SOLUTIONS,07BBBBB1111B1Z2,BBBBB1111B,250000.00,25000.00,DELG03106F,2026-03-18\n` +
        `ALPHA CONSULTING SERVICES,29CCCCC2222C1Z9,CCCCC2222C,120000.00,12000.00,BLRN98765A,2026-03-20`;
    }

    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Helper to parse CSV text in browser if API connection fails
  const parseCsvText = (text) => {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length <= 1) return [];
    return lines.slice(1);
  };

  const fetchBatches = async () => {
    setLoadingBatches(true);
    try {
      const res = await getUploadHistory();
      if (res && res.success && Array.isArray(res.data)) {
        setUploadedBatches(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch upload batches:', err);
    } finally {
      setLoadingBatches(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  const as26Files = uploadedBatches.filter(b => {
    const meta = b.metadata || {};
    const type = meta.upload_type || '';
    const batchId = meta.upload_batch_id || b.upload_batch_id || '';
    const name = (b.fileName || b.file_name || '').toLowerCase();
    return type === '26AS_TDS' || batchId.startsWith('batch_26as') || name.includes('26as');
  });

  const tallyFiles = uploadedBatches.filter(b => {
    const meta = b.metadata || {};
    const type = meta.upload_type || '';
    const batchId = meta.upload_batch_id || b.upload_batch_id || '';
    const name = (b.fileName || b.file_name || '').toLowerCase();
    return type === 'TALLY_TDS' || batchId.startsWith('batch_tally') || name.includes('tally');
  });

  const executeDeleteSingleFile = async (fileItem) => {
    if (!fileItem) return;
    setDeletingFile(true);
    const batchId = fileItem.metadata?.upload_batch_id || fileItem.upload_batch_id || fileItem.batchId;

    try {
      const res = await deleteUploadBatch(fileItem.id, batchId);
      if (res && res.success !== false) {
        setDeleteFileConfirm(null);
        setSelected26asToDelete('');
        setSelectedTallyToDelete('');
        await fetchBatches();
        triggerRefresh();
        if (onUploadSuccess) onUploadSuccess();
      } else {
        alert(`Delete failed: ${res?.error || 'Failed to delete file'}`);
      }
    } catch (err) {
      alert(`Delete failed: ${err.message || 'Error connecting to database server'}`);
    } finally {
      setDeletingFile(false);
    }
  };

  const handleUpload26as = async () => {
    if (!as26File) return;
    setAs26Status({ loading: true, error: null, success: null });
    
    try {
      const res = await upload26as(as26File, as26Fy || 'FY 2024-25', as26ImportMode);
      if (res && res.success) {
        const rowCount = (typeof res.records === 'number') ? res.records : 1;
        setAs26Status({
          loading: false,
          error: null,
          success: `${as26ImportMode === 'clean' ? 'Past 26AS data cleared & imported ' : 'Imported '}${rowCount} rows successfully for ${as26Fy}!`
        });
        setAs26File(null);
        fetchBatches();
        triggerRefresh();
        if (onUploadSuccess) onUploadSuccess();
      } else {
        setAs26Status({
          loading: false,
          error: res?.error || res?.details || 'Failed to parse 26AS file. Please check column format.',
          success: null
        });
      }
    } catch (err) {
      setAs26Status({
        loading: false,
        error: err.message || 'Error connecting to upload service.',
        success: null
      });
    }
  };

  const handleUploadTally = async () => {
    if (!tallyFile) return;
    setTallyStatus({ loading: true, error: null, success: null });

    try {
      const res = await uploadTally(tallyFile, tallyFy || 'FY 2024-25', tallyImportMode);
      if (res && res.success) {
        const rowCount = (typeof res.records === 'number') ? res.records : 1;
        setTallyStatus({
          loading: false,
          error: null,
          success: `${tallyImportMode === 'clean' ? 'Past Tally data cleared & imported ' : 'Imported '}${rowCount} rows successfully for ${tallyFy}!`
        });
        setTallyFile(null);
        fetchBatches();
        triggerRefresh();
        if (onUploadSuccess) onUploadSuccess();
      } else {
        setTallyStatus({
          loading: false,
          error: res?.error || res?.details || 'Failed to parse Tally file. Please check column format.',
          success: null
        });
      }
    } catch (err) {
      setTallyStatus({
        loading: false,
        error: err.message || 'Error connecting to upload service.',
        success: null
      });
    }
  };

  const executePurge = async (target) => {
    const labelMap = { 
      '26as': 'Form 26AS data', 
      'tally': 'Tally Ledger data', 
      'followups': 'Follow-up Call Logs', 
      'all': 'ALL uploaded datasets' 
    };
    setPurgeConfirmTarget(null);
    setPurgeStatus({ loading: true, message: null, error: null });

    try {
      let res;
      if (target === 'followups') {
        res = await purgeFollowups();
      } else {
        res = await purgeData(target);
      }

      if (res && res.success) {
        setPurgeStatus({ loading: false, message: res.message || `${labelMap[target]} cleared successfully`, error: null });
        fetchBatches();
        triggerRefresh();
        if (onUploadSuccess) onUploadSuccess();
        return;
      }
      setPurgeStatus({
        loading: false,
        message: null,
        error: res?.error || `Failed to clear ${labelMap[target]} on the server. Please try again.`
      });
    } catch (err) {
      setPurgeStatus({
        loading: false,
        message: null,
        error: err.message || `Failed to clear ${labelMap[target]} on the server. Please try again.`
      });
    }
  };

  const handlePurge = (target) => {
    setPurgeConfirmTarget(target);
  };

  return (
    <div className="space-y-6">
      
      {/* SECTION 1: Expected Headers Reference Bar */}
      <div className="bg-white rounded-2xl p-6 text-[#1F1B2E] shadow-sm border border-[#E9E4FA]">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#E9E4FA] pb-4">
          <div>
            <h2 className="text-xl font-black tracking-tight text-[#1F1B2E] flex items-center gap-2">
              <Table className="w-5 h-5 text-[#9B87F5]" />
              Expected CSV & Tally Header Specification
            </h2>
            <p className="text-xs text-[#6B6580] mt-1">
              Verify column names in your CSV or Excel file before uploading. Autodetects TAN/PAN numbers, GST, and TDS amounts.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => downloadSampleCsv('26as')}
              className="inline-flex items-center gap-1.5 bg-[#9B87F5] hover:bg-[#8572E0] text-white text-xs font-bold px-3 py-2 rounded-xl transition cursor-pointer shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              26AS Sample CSV
            </button>
            <button
              onClick={() => downloadSampleCsv('tally')}
              className="inline-flex items-center gap-1.5 bg-[#9B87F5] hover:bg-[#8572E0] text-white text-xs font-bold px-3 py-2 rounded-xl transition cursor-pointer shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              Tally Sample CSV
            </button>
          </div>
        </div>

        {/* Expected Header Badges */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
          {/* 26AS Headers */}
          <div className="bg-[#E8E4FF]/40 p-4 rounded-xl border border-[#E9E4FA] space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-[#9B87F5] uppercase tracking-wider">
              <span>Form 26AS CSV Headers</span>
              <span className="text-[10px] bg-[#9B87F5]/20 text-[#9B87F5] px-2 py-0.5 rounded border border-[#9B87F5]/30 font-extrabold">Govt Portal Format</span>
            </div>
            <div className="flex flex-wrap gap-1.5 text-xs font-mono">
              <span className="bg-white text-[#1F1B2E] px-2 py-1 rounded border border-[#E9E4FA] font-semibold">Name of the Company</span>
              <span className="bg-white text-[#FBBF77] px-2 py-1 rounded border border-[#E9E4FA] font-bold">TAN No *</span>
              <span className="bg-white text-[#1F1B2E] px-2 py-1 rounded border border-[#E9E4FA] font-semibold">Invoice Amount</span>
              <span className="bg-white text-[#FBBF77] px-2 py-1 rounded border border-[#E9E4FA] font-bold">TDS Amt *</span>
            </div>
          </div>

          {/* Tally Headers */}
          <div className="bg-[#E8E4FF]/40 p-4 rounded-xl border border-[#E9E4FA] space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-[#9B87F5] uppercase tracking-wider">
              <span>Tally Ledger CSV Headers</span>
              <span className="text-[10px] bg-[#9B87F5]/20 text-[#9B87F5] px-2 py-0.5 rounded border border-[#9B87F5]/30 font-extrabold">Accountant Sheet</span>
            </div>
            <div className="flex flex-wrap gap-1.5 text-xs font-mono">
              <span className="bg-white text-[#1F1B2E] px-2 py-1 rounded border border-[#E9E4FA] font-semibold">Name of the Company</span>
              <span className="bg-white text-[#4ADE80] px-2 py-1 rounded border border-[#E9E4FA] font-semibold">GST Num (pull)</span>
              <span className="bg-white text-[#1F1B2E] px-2 py-1 rounded border border-[#E9E4FA] font-semibold">PAN No</span>
              <span className="bg-white text-[#1F1B2E] px-2 py-1 rounded border border-[#E9E4FA] font-semibold">Gross Total</span>
              <span className="bg-white text-[#FBBF77] px-2 py-1 rounded border border-[#E9E4FA] font-bold">TDS Amt *</span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: White Upload Cards with Import Mode Selector */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* 26AS File Upload Card */}
        <div className="bg-white p-6 rounded-2xl border border-[#E9E4FA] shadow-xs space-y-4">
          <div className="flex justify-between items-start border-b border-[#E9E4FA] pb-3">
            <div>
              <h3 className="text-lg font-black text-[#1F1B2E] flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#9B87F5]"></span>
                Form 26AS Import (Govt CSV)
              </h3>
              <p className="text-xs text-[#6B6580] mt-0.5 font-medium">Upload Form 26AS portal export to parse client TDS deductions</p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-[#C084FC]/20 text-[#9B87F5] border border-[#C084FC]/30">
              Step 1
            </span>
          </div>

          {/* Import Action Mode Choice */}
          <div className="bg-[#E8E4FF]/40 p-3 rounded-xl border border-[#E9E4FA] space-y-1.5">
            <label className="block text-[10px] font-black text-[#6B6580] uppercase tracking-wider">
              Import Option / Cleaning Strategy:
            </label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <label
                onClick={() => setAs26ImportMode('update')}
                className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer font-bold transition select-none ${
                  as26ImportMode === 'update'
                    ? 'bg-[#9B87F5] text-white border-[#9B87F5] shadow-xs'
                    : 'bg-white text-[#1F1B2E] border-[#E9E4FA] hover:bg-[#E8E4FF]'
                }`}
              >
                <RefreshCcw className="w-3.5 h-3.5" />
                <span>Update & Merge</span>
              </label>

              <label
                onClick={() => setAs26ImportMode('clean')}
                className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer font-bold transition select-none ${
                  as26ImportMode === 'clean'
                    ? 'bg-[#FBBF77] text-[#1F1B2E] border-[#FBBF77] shadow-xs'
                    : 'bg-white text-[#1F1B2E] border-[#E9E4FA] hover:bg-[#E8E4FF]'
                }`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clean Past Data First</span>
              </label>
            </div>
          </div>

          {/* Target Financial Year Selector */}
          <div className="bg-[#E8E4FF]/40 p-3 rounded-xl border border-[#E9E4FA] space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black text-[#6B6580] uppercase tracking-wider">
                Financial Year for this File:
              </label>
              <span className="text-[10px] bg-[#9B87F5]/20 text-[#9B87F5] px-2 py-0.5 rounded font-extrabold">Required</span>
            </div>
            <select
              value={as26Fy}
              onChange={(e) => setAs26Fy(e.target.value)}
              className="w-full bg-white border border-[#E9E4FA] text-[#1F1B2E] font-bold text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#9B87F5] cursor-pointer"
            >
              <option value="FY 2026-27">FY 2026-27</option>
              <option value="FY 2025-26">FY 2025-26</option>
              <option value="FY 2024-25">FY 2024-25 (Current)</option>
              <option value="FY 2023-24">FY 2023-24</option>
              <option value="FY 2022-23">FY 2022-23</option>
              <option value="FY 2021-22">FY 2021-22</option>
            </select>
          </div>

          {/* File Picker */}
          <div className="flex flex-col gap-3">
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-[#B4A7F5] rounded-xl p-5 cursor-pointer bg-white hover:bg-[#E8E4FF]/50 transition group">
              <Upload className="w-7 h-7 text-[#9B87F5] group-hover:scale-110 transition mb-1.5" />
              <span className="text-xs font-bold text-[#1F1B2E] group-hover:text-[#9B87F5]">
                {as26File ? as26File.name : 'Click to select or drag 26AS CSV file'}
              </span>
              <span className="text-[10px] text-[#6B6580] mt-0.5 font-semibold">Supports .csv, .xlsx, .xls</span>
              <input 
                type="file" 
                accept=".csv,.xlsx,.xls" 
                className="hidden" 
                onChange={(e) => {
                  if (e.target.files.length) {
                    setAs26File(e.target.files[0]);
                    setAs26Status({ loading: false, error: null, success: null });
                  }
                }} 
              />
            </label>

            {as26File && (
              <button
                onClick={handleUpload26as}
                disabled={as26Status.loading}
                className="w-full bg-[#9B87F5] hover:bg-[#8572E0] text-white font-black py-2.5 px-4 rounded-xl transition flex items-center justify-center gap-2 text-xs disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {as26Status.loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing 26AS File...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    {as26ImportMode === 'clean' ? 'Clean Past Data & Import 26AS' : 'Upload & Update 26AS Records'}
                  </>
                )}
              </button>
            )}

            {as26Status.error && (
              <div className="bg-[#F87A9E]/15 text-[#F87A9E] p-3 rounded-xl flex items-start gap-2 text-xs border border-[#F87A9E]/30 font-semibold">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{as26Status.error}</span>
              </div>
            )}

            {as26Status.success && (
              <div className="bg-[#4ADE80]/15 text-[#2E8B57] p-3 rounded-xl flex items-start gap-2 text-xs border border-[#4ADE80]/30 font-bold">
                <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{as26Status.success}</span>
              </div>
            )}

            {/* Manage Uploaded 26AS Files - Choose which file to delete */}
            <div className="pt-4 border-t border-[#E9E4FA] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-[#1F1B2E] flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-[#9B87F5]" />
                  Uploaded 26AS Files ({as26Files.length})
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E8E4FF] text-[#9B87F5]">
                  {as26Files.length} {as26Files.length === 1 ? 'file active' : 'files active'}
                </span>
              </div>

              {as26Files.length > 0 ? (
                <div className="space-y-2.5">
                  {/* Dropdown to pick which file to delete */}
                  <div className="bg-[#E8E4FF]/30 p-2.5 rounded-xl border border-[#E9E4FA] space-y-1.5">
                    <label className="block text-[10px] font-black text-[#6B6580] uppercase tracking-wider">
                      Choose 26AS File to Delete:
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={selected26asToDelete}
                        onChange={(e) => setSelected26asToDelete(e.target.value)}
                        className="flex-1 bg-white border border-[#E9E4FA] text-[#1F1B2E] rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:border-[#9B87F5] cursor-pointer truncate"
                      >
                        <option value="">-- Select 26AS file to delete --</option>
                        {as26Files.map((file) => (
                          <option key={file.id} value={file.id}>
                            {file.fileName || file.file_name} ({file.metadata?.total_rows ? `${file.metadata.total_rows.toLocaleString()} rows` : 'Uploaded file'})
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => {
                          const target = as26Files.find(f => String(f.id) === String(selected26asToDelete));
                          if (target) setDeleteFileConfirm(target);
                        }}
                        disabled={!selected26asToDelete || deletingFile}
                        className="bg-[#F87A9E] hover:bg-[#E11D48] text-white font-bold px-3 py-1.5 rounded-lg transition text-xs flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs flex-shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* List of uploaded files with individual quick trash button */}
                  <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                    {as26Files.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center justify-between p-2 rounded-xl bg-white border border-[#E9E4FA] hover:border-[#9B87F5]/50 transition group"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-bold text-xs text-[#1F1B2E] truncate group-hover:text-[#9B87F5] transition">
                              {file.fileName || file.file_name}
                            </p>
                            <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-extrabold text-[9px] border border-indigo-200">
                              {file.metadata?.financial_year || 'FY 2024-25'}
                            </span>
                          </div>
                          <p className="text-[10px] text-[#6B6580] mt-0.5">
                            {file.uploadTime ? new Date(file.uploadTime).toLocaleString('en-IN') : 'Uploaded'}
                            {file.metadata?.total_rows ? ` · ${file.metadata.total_rows.toLocaleString()} entries` : ''}
                          </p>
                        </div>
                        <button
                          onClick={() => setDeleteFileConfirm(file)}
                          className="p-1.5 rounded-lg bg-[#F87A9E]/15 hover:bg-[#F87A9E] text-[#E11D48] hover:text-white transition cursor-pointer flex-shrink-0"
                          title="Delete this specific file"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-[#6B6580] italic bg-[#E8E4FF]/20 p-2.5 rounded-xl border border-dashed border-[#E9E4FA] text-center">
                  No 26AS files currently uploaded.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Tally Sheet Upload Card */}
        <div className="bg-white p-6 rounded-2xl border border-[#E9E4FA] shadow-xs space-y-4">
          <div className="flex justify-between items-start border-b border-[#E9E4FA] pb-3">
            <div>
              <h3 className="text-lg font-black text-[#1F1B2E] flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#9B87F5]"></span>
                Tally Ledger Import (Accountant CSV)
              </h3>
              <p className="text-xs text-[#6B6580] mt-0.5 font-medium">Upload Tally CSV ledgers to reconcile accountant entries</p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-[#C084FC]/20 text-[#9B87F5] border border-[#C084FC]/30">
              Step 2
            </span>
          </div>

          {/* Import Action Mode Choice */}
          <div className="bg-[#E8E4FF]/40 p-3 rounded-xl border border-[#E9E4FA] space-y-1.5">
            <label className="block text-[10px] font-black text-[#6B6580] uppercase tracking-wider">
              Import Option / Cleaning Strategy:
            </label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <label
                onClick={() => setTallyImportMode('update')}
                className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer font-bold transition select-none ${
                  tallyImportMode === 'update'
                    ? 'bg-[#9B87F5] text-white border-[#9B87F5] shadow-xs'
                    : 'bg-white text-[#1F1B2E] border-[#E9E4FA] hover:bg-[#E8E4FF]'
                }`}
              >
                <RefreshCcw className="w-3.5 h-3.5" />
                <span>Update & Merge</span>
              </label>

              <label
                onClick={() => setTallyImportMode('clean')}
                className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer font-bold transition select-none ${
                  tallyImportMode === 'clean'
                    ? 'bg-[#FBBF77] text-[#1F1B2E] border-[#FBBF77] shadow-xs'
                    : 'bg-white text-[#1F1B2E] border-[#E9E4FA] hover:bg-[#E8E4FF]'
                }`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clean Past Data First</span>
              </label>
            </div>
          </div>

          {/* Target Financial Year Selector */}
          <div className="bg-[#E8E4FF]/40 p-3 rounded-xl border border-[#E9E4FA] space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black text-[#6B6580] uppercase tracking-wider">
                Financial Year for this File:
              </label>
              <span className="text-[10px] bg-[#9B87F5]/20 text-[#9B87F5] px-2 py-0.5 rounded font-extrabold">Required</span>
            </div>
            <select
              value={tallyFy}
              onChange={(e) => setTallyFy(e.target.value)}
              className="w-full bg-white border border-[#E9E4FA] text-[#1F1B2E] font-bold text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#9B87F5] cursor-pointer"
            >
              <option value="FY 2026-27">FY 2026-27</option>
              <option value="FY 2025-26">FY 2025-26</option>
              <option value="FY 2024-25">FY 2024-25 (Current)</option>
              <option value="FY 2023-24">FY 2023-24</option>
              <option value="FY 2022-23">FY 2022-23</option>
              <option value="FY 2021-22">FY 2021-22</option>
            </select>
          </div>

          {/* File Picker */}
          <div className="flex flex-col gap-3">
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-[#B4A7F5] rounded-xl p-5 cursor-pointer bg-white hover:bg-[#E8E4FF]/50 transition group">
              <Upload className="w-7 h-7 text-[#9B87F5] group-hover:scale-110 transition mb-1.5" />
              <span className="text-xs font-bold text-[#1F1B2E] group-hover:text-[#9B87F5]">
                {tallyFile ? tallyFile.name : 'Click to select or drag Tally CSV file'}
              </span>
              <span className="text-[10px] text-[#6B6580] mt-0.5 font-semibold">Supports .csv, .xlsx, .xls</span>
              <input 
                type="file" 
                accept=".csv,.xlsx,.xls" 
                className="hidden" 
                onChange={(e) => {
                  if (e.target.files.length) {
                    setTallyFile(e.target.files[0]);
                    setTallyStatus({ loading: false, error: null, success: null });
                  }
                }} 
              />
            </label>

            {tallyFile && (
              <button
                onClick={handleUploadTally}
                disabled={tallyStatus.loading}
                className="w-full bg-[#9B87F5] hover:bg-[#8572E0] text-white font-black py-2.5 px-4 rounded-xl transition flex items-center justify-center gap-2 text-xs disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {tallyStatus.loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing Tally File...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    {tallyImportMode === 'clean' ? 'Clean Past Data & Import Tally' : 'Upload & Update Tally Records'}
                  </>
                )}
              </button>
            )}

            {tallyStatus.error && (
              <div className="bg-[#F87A9E]/15 text-[#F87A9E] p-3 rounded-xl flex items-start gap-2 text-xs border border-[#F87A9E]/30 font-semibold">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{tallyStatus.error}</span>
              </div>
            )}

            {tallyStatus.success && (
              <div className="bg-[#4ADE80]/15 text-[#2E8B57] p-3 rounded-xl flex items-start gap-2 text-xs border border-[#4ADE80]/30 font-bold">
                <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{tallyStatus.success}</span>
              </div>
            )}

            {/* Manage Uploaded Tally Sheets - Choose which sheet to delete */}
            <div className="pt-4 border-t border-[#E9E4FA] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-[#1F1B2E] flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-[#9B87F5]" />
                  Uploaded Tally Sheets ({tallyFiles.length})
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E8E4FF] text-[#9B87F5]">
                  {tallyFiles.length} {tallyFiles.length === 1 ? 'sheet active' : 'sheets active'}
                </span>
              </div>

              {tallyFiles.length > 0 ? (
                <div className="space-y-2.5">
                  {/* Dropdown to pick which Tally sheet to delete */}
                  <div className="bg-[#E8E4FF]/30 p-2.5 rounded-xl border border-[#E9E4FA] space-y-1.5">
                    <label className="block text-[10px] font-black text-[#6B6580] uppercase tracking-wider">
                      Choose Tally Sheet to Delete:
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={selectedTallyToDelete}
                        onChange={(e) => setSelectedTallyToDelete(e.target.value)}
                        className="flex-1 bg-white border border-[#E9E4FA] text-[#1F1B2E] rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:border-[#9B87F5] cursor-pointer truncate"
                      >
                        <option value="">-- Select Tally sheet to delete --</option>
                        {tallyFiles.map((file) => (
                          <option key={file.id} value={file.id}>
                            {file.fileName || file.file_name} ({file.metadata?.total_rows ? `${file.metadata.total_rows.toLocaleString()} rows` : 'Uploaded sheet'})
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => {
                          const target = tallyFiles.find(f => String(f.id) === String(selectedTallyToDelete));
                          if (target) setDeleteFileConfirm(target);
                        }}
                        disabled={!selectedTallyToDelete || deletingFile}
                        className="bg-[#F87A9E] hover:bg-[#E11D48] text-white font-bold px-3 py-1.5 rounded-lg transition text-xs flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs flex-shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* List of uploaded Tally sheets with individual quick trash button */}
                  <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                    {tallyFiles.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center justify-between p-2 rounded-xl bg-white border border-[#E9E4FA] hover:border-[#9B87F5]/50 transition group"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-bold text-xs text-[#1F1B2E] truncate group-hover:text-[#9B87F5] transition">
                              {file.fileName || file.file_name}
                            </p>
                            <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-extrabold text-[9px] border border-indigo-200">
                              {file.metadata?.financial_year || 'FY 2024-25'}
                            </span>
                          </div>
                          <p className="text-[10px] text-[#6B6580] mt-0.5">
                            {file.uploadTime ? new Date(file.uploadTime).toLocaleString('en-IN') : 'Uploaded'}
                            {file.metadata?.total_rows ? ` · ${file.metadata.total_rows.toLocaleString()} entries` : ''}
                          </p>
                        </div>
                        <button
                          onClick={() => setDeleteFileConfirm(file)}
                          className="p-1.5 rounded-lg bg-[#F87A9E]/15 hover:bg-[#F87A9E] text-[#E11D48] hover:text-white transition cursor-pointer flex-shrink-0"
                          title="Delete this specific Tally sheet"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-[#6B6580] italic bg-[#E8E4FF]/20 p-2.5 rounded-xl border border-dashed border-[#E9E4FA] text-center">
                  No Tally sheets currently uploaded.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 3: Dedicated Data Cleanup & Purge Tools Bar */}
      <div className="bg-white rounded-2xl p-5 text-[#1F1B2E] border border-[#E9E4FA] shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <h4 className="text-sm font-black text-[#1F1B2E] flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-[#9B87F5]" />
            Data Cleanup & Dataset Management Tools
          </h4>
          <p className="text-xs text-[#6B6580] mt-0.5">
            Manually purge previous upload batches or clear existing entries to start a clean reconciliation cycle.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handlePurge('26as')}
            disabled={purgeStatus.loading}
            className="bg-[#E8E4FF] hover:bg-[#E9E4FA] text-[#9B87F5] text-xs font-bold px-3 py-2 rounded-xl transition cursor-pointer border border-[#E9E4FA]"
          >
            Clear 26AS Data
          </button>
          <button
            onClick={() => handlePurge('tally')}
            disabled={purgeStatus.loading}
            className="bg-[#E8E4FF] hover:bg-[#E9E4FA] text-[#9B87F5] text-xs font-bold px-3 py-2 rounded-xl transition cursor-pointer border border-[#E9E4FA]"
          >
            Clear Tally Data
          </button>
          <button
            onClick={() => handlePurge('followups')}
            disabled={purgeStatus.loading}
            className="bg-[#E8E4FF] hover:bg-[#E9E4FA] text-[#9B87F5] text-xs font-bold px-3 py-2 rounded-xl transition cursor-pointer border border-[#E9E4FA]"
          >
            Clear Follow-up Logs Only
          </button>
          <button
            onClick={() => handlePurge('all')}
            disabled={purgeStatus.loading}
            className="bg-[#F87A9E] hover:bg-[#E11D48] text-white text-xs font-black px-3 py-2 rounded-xl transition cursor-pointer shadow-xs flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Purge All Uploaded Datasets
          </button>
        </div>
      </div>

      {purgeStatus.message && (
        <div className="bg-[#7FA88A]/15 text-[#3D6348] p-3.5 rounded-xl border border-[#7FA88A]/30 text-xs font-bold flex items-center justify-between">
          <span>{purgeStatus.message}</span>
          <button onClick={() => setPurgeStatus({ loading: false, message: null, error: null })} className="text-[#3D6348] hover:text-[#2A4732] font-extrabold cursor-pointer">✕</button>
        </div>
      )}

      {purgeStatus.error && (
        <div className="bg-[#C08585]/15 text-[#703535] p-3.5 rounded-xl border border-[#C08585]/30 text-xs font-bold flex items-center justify-between">
          <span>{purgeStatus.error}</span>
          <button onClick={() => setPurgeStatus({ loading: false, message: null, error: null })} className="text-[#703535] hover:text-[#4A2020] font-extrabold cursor-pointer">✕</button>
        </div>
      )}

      {/* Confirmation Modal overlay to guarantee pop-up works across all browsers */}
      {purgeConfirmTarget && (
        <div className="fixed inset-0 bg-[#3E4A5C]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#F6F8FA] border border-[#DCE2E8] text-[#3A4048] rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-scale-up">
            <div className="flex items-center gap-3 border-b border-[#DCE2E8] pb-3">
              <div className="p-2.5 rounded-xl bg-[#C08585]/20 border border-[#C08585]/30 text-[#C08585]">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-[#3A4048]">Confirm Purge Action</h3>
                <p className="text-xs text-[#7A8794] font-medium">This operation cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-[#3A4048] leading-relaxed font-semibold">
              Are you sure you want to clear/remove{' '}
              <span className="text-[#6E8CA0] font-black underline">
                {purgeConfirmTarget === '26as' 
                  ? 'Form 26AS data' 
                  : purgeConfirmTarget === 'tally' 
                  ? 'Tally Ledger data' 
                  : purgeConfirmTarget === 'followups'
                  ? 'Follow-up Call Logs'
                  : 'ALL uploaded datasets'}
              </span>
              ? {purgeConfirmTarget === 'all' 
                  ? 'Uploaded 26AS and Tally datasets will be cleared. Your client Follow-up call logs will stay completely safe and preserved.' 
                  : purgeConfirmTarget === 'followups'
                  ? 'This will clear client call updates and notes from previous communications.'
                  : 'This action will reset past reconciliation calculations.'}
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setPurgeConfirmTarget(null)}
                className="px-4 py-2 text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => executePurge(purgeConfirmTarget)}
                className="px-4 py-2 text-xs font-black text-white bg-red-600 hover:bg-red-500 rounded-xl transition shadow-md cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Yes, Purge Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Specific Single File Delete Confirmation Modal */}
      {deleteFileConfirm && (
        <div className="fixed inset-0 bg-[#1F1B2E]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E9E4FA] text-[#1F1B2E] rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-scale-up">
            <div className="flex items-center gap-3 border-b border-[#E9E4FA] pb-3">
              <div className="p-2.5 rounded-xl bg-[#F87A9E]/15 text-[#E11D48]">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-[#1F1B2E]">Delete Uploaded File</h3>
                <p className="text-xs text-[#6B6580] font-medium">Remove this specific dataset file</p>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <p className="text-[#1F1B2E] leading-relaxed font-semibold">
                Are you sure you want to delete file{' '}
                <span className="text-[#9B87F5] font-black underline">
                  "{deleteFileConfirm.fileName || deleteFileConfirm.file_name}"
                </span>
                ?
              </p>
              <div className="p-3 bg-[#E8E4FF]/30 rounded-xl border border-[#E9E4FA] space-y-1.5">
                <p className="font-bold text-[#1F1B2E]">
                  Type:{' '}
                  <span className="font-semibold text-[#6B6580]">
                    {deleteFileConfirm.metadata?.upload_type === '26AS_TDS' || (deleteFileConfirm.fileName || deleteFileConfirm.file_name || '').toLowerCase().includes('26as')
                      ? 'Form 26AS (Govt Tax Deductions)' 
                      : 'Tally Ledger (Accountant CSV)'}
                  </span>
                </p>
                {deleteFileConfirm.metadata?.total_rows && (
                  <p className="font-bold text-[#1F1B2E]">
                    Entries:{' '}
                    <span className="font-semibold text-[#6B6580]">
                      {deleteFileConfirm.metadata.total_rows.toLocaleString()} records
                    </span>
                  </p>
                )}
                <p className="text-[11px] text-[#2E8B57] font-bold pt-1 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Only this file's records will be removed. All other uploaded files of this year will remain safe and intact.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteFileConfirm(null)}
                disabled={deletingFile}
                className="px-4 py-2 text-xs font-bold text-[#6B6580] bg-[#E8E4FF]/50 hover:bg-[#E8E4FF] rounded-xl border border-[#E9E4FA] transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => executeDeleteSingleFile(deleteFileConfirm)}
                disabled={deletingFile}
                className="px-4 py-2 text-xs font-black text-white bg-[#F87A9E] hover:bg-[#E11D48] rounded-xl transition shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {deletingFile ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Deleting File...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    Yes, Delete This File
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
