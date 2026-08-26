import React, { useState, useEffect } from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';
import { applyStatusOverride } from '../../api/tdsReconciliation';

export default function EditModal({ row, onClose, onSaveSuccess }) {
  const [field, setField] = useState('overall_status');
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const statusOptions = {
    overall_status: ['All Matched', 'Partial Mismatch', 'Major Mismatch'],
    books_vs_26as_status: ['Excess', 'Less Paid', 'Not Received', 'Matched'],
    books_vs_tally_status: ['Excess', 'Less Paid', 'Not Received', 'Matched'],
    as26_vs_tally_status: ['Excess', 'Less Paid', 'Not Received', 'Matched']
  };

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!value) {
      setError('Please select a status value');
      return;
    }
    if (!note.trim()) {
      setError('Justification note is required for the audit trail');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await applyStatusOverride({
        reconciliationId: row.id,
        overrideField: field,
        newValue: value,
        note: note.trim()
      });

      if (res && res.success) {
        onSaveSuccess();
        onClose();
      } else {
        setError(res?.error || 'Failed to update status');
      }
    } catch (err) {
      setError(err.message || 'Connection error');
    } finally {
      setLoading(false);
    }
  };

  // Adjust default selection when switching fields
  const handleFieldChange = (newField) => {
    setField(newField);
    setValue(statusOptions[newField][0]);
  };

  // Set initial default value
  useEffect(() => {
    setValue(statusOptions[field][0]);
  }, [field]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 z-50 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden my-auto animate-scale-up"
      >
        {/* Header */}
        <div className="flex-none flex justify-between items-center bg-slate-900 border-b border-slate-800 px-6 py-4 text-white">
          <div>
            <h3 className="font-bold text-gray-100 text-base">Manual Status Override</h3>
            <p className="text-xs text-slate-400 mt-0.5">{row.companyName} ({row.tanNo})</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs custom-scrollbar">
            {error && (
              <div className="bg-red-50 text-red-700 border border-red-200 rounded-xl p-3 flex items-start gap-2 text-xs font-semibold">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Select Target Status Field */}
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                Select Comparison Target
              </label>
              <select
                value={field}
                onChange={(e) => handleFieldChange(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
              >
                <option value="overall_status">Overall Status</option>
                <option value="books_vs_26as_status">Books vs Form 26AS</option>
                <option value="books_vs_tally_status">Books vs Tally Ledger</option>
                <option value="as26_vs_tally_status">Form 26AS vs Tally Ledger</option>
              </select>
            </div>

            {/* Select Override Value */}
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                New Status Value
              </label>
              <select
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
              >
                {statusOptions[field].map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            {/* Required Justification Note */}
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                Justification Note <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Provide a brief explanation for auditing purposes (e.g., Client confirmed offline credit mismatch resolved)..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium resize-none"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex-none flex gap-3 justify-end px-6 py-4 border-t border-slate-100 bg-slate-50/50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-700 border border-slate-200 hover:bg-slate-100 text-xs font-bold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2 rounded-xl transition text-xs flex items-center gap-2 disabled:opacity-50 cursor-pointer shadow-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Override'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
