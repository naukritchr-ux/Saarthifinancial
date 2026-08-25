import React, { useState } from 'react';
import { Upload, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { upload26as, uploadTally } from '../../api/tdsReconciliation';

export default function UploadPanel({ onUploadSuccess }) {
  const [as26File, setAs26File] = useState(null);
  const [tallyFile, setTallyFile] = useState(null);
  
  const [as26Status, setAs26Status] = useState({ loading: false, error: null, success: null });
  const [tallyStatus, setTallyStatus] = useState({ loading: false, error: null, success: null });

  const handleUpload26as = async () => {
    if (!as26File) return;
    setAs26Status({ loading: true, error: null, success: null });
    try {
      const res = await upload26as(as26File);
      if (res.success) {
        setAs26Status({ loading: false, error: null, success: `Imported ${res.records} rows. Batch ID: ${res.batchId}` });
        setAs26File(null);
        if (onUploadSuccess) onUploadSuccess();
      } else {
        setAs26Status({ loading: false, error: res.error || 'Upload failed', success: null });
      }
    } catch (err) {
      setAs26Status({ loading: false, error: err.message || 'API connection error', success: null });
    }
  };

  const handleUploadTally = async () => {
    if (!tallyFile) return;
    setTallyStatus({ loading: true, error: null, success: null });
    try {
      const res = await uploadTally(tallyFile);
      if (res.success) {
        setTallyStatus({ loading: false, error: null, success: `Imported ${res.records} rows. Batch ID: ${res.batchId}` });
        setTallyFile(null);
        if (onUploadSuccess) onUploadSuccess();
      } else {
        setTallyStatus({ loading: false, error: res.error || 'Upload failed', success: null });
      }
    } catch (err) {
      setTallyStatus({ loading: false, error: err.message || 'API connection error', success: null });
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
      {/* 26AS File Upload */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm transition hover:shadow-md">
        <h3 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
          Form 26AS (Government portal CSV)
        </h3>
        <p className="text-xs text-gray-500 mb-4">Upload Form 26AS CSV containing client tax deductions</p>
        
        <div className="flex flex-col gap-4">
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl p-6 cursor-pointer hover:bg-gray-50 hover:border-indigo-300 transition group">
            <Upload className="w-8 h-8 text-gray-400 group-hover:text-indigo-500 transition mb-2" />
            <span className="text-sm font-medium text-gray-600 group-hover:text-indigo-600">
              {as26File ? as26File.name : 'Select 26AS CSV File'}
            </span>
            <span className="text-xs text-gray-400 mt-1">Accepts .csv format</span>
            <input 
              type="file" 
              accept=".csv" 
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
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 px-4 rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {as26Status.loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Parsing CSV...
                </>
              ) : (
                'Upload & Match 26AS'
              )}
            </button>
          )}

          {as26Status.error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-xl flex items-start gap-2 text-xs border border-red-100">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{as26Status.error}</span>
            </div>
          )}

          {as26Status.success && (
            <div className="bg-green-50 text-green-700 p-3 rounded-xl flex items-start gap-2 text-xs border border-green-100">
              <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{as26Status.success}</span>
            </div>
          )}
        </div>
      </div>

      {/* Tally Ledger Upload */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm transition hover:shadow-md">
        <h3 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-teal-500"></span>
          Tally Sheet (Accountant CSV ledger)
        </h3>
        <p className="text-xs text-gray-500 mb-4">Upload Tally CSV exports to compare accountant ledgers</p>
        
        <div className="flex flex-col gap-4">
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl p-6 cursor-pointer hover:bg-gray-50 hover:border-teal-300 transition group">
            <Upload className="w-8 h-8 text-gray-400 group-hover:text-teal-500 transition mb-2" />
            <span className="text-sm font-medium text-gray-600 group-hover:text-teal-600">
              {tallyFile ? tallyFile.name : 'Select Tally CSV File'}
            </span>
            <span className="text-xs text-gray-400 mt-1">Accepts .csv format</span>
            <input 
              type="file" 
              accept=".csv" 
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
              className="w-full bg-teal-600 hover:bg-teal-700 text-white font-medium py-2.5 px-4 rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {tallyStatus.loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Parsing Tally...
                </>
              ) : (
                'Upload & Match Tally'
              )}
            </button>
          )}

          {tallyStatus.error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-xl flex items-start gap-2 text-xs border border-red-100">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{tallyStatus.error}</span>
            </div>
          )}

          {tallyStatus.success && (
            <div className="bg-green-50 text-green-700 p-3 rounded-xl flex items-start gap-2 text-xs border border-green-100">
              <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{tallyStatus.success}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
