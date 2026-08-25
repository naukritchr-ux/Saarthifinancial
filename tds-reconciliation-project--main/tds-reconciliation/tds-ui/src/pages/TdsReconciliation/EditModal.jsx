import React, { useState } from 'react';
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

      if (res.success) {
        onSaveSuccess();
        onClose();
      } else {
        setError(res.error || 'Failed to update status');
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
  React.useEffect(() => {
    setValue(statusOptions[field][0]);
  }, []);

  return (
    <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 max-w-md w-full overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="flex justify-between items-center bg-gray-50 border-b border-gray-100 px-6 py-4">
          <div>
            <h3 className="font-bold text-gray-800 text-lg">Manual Status Override</h3>
            <p className="text-xs text-gray-500 mt-0.5">{row.companyName} ({row.tanNo})</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-200 transition text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 flex flex-col gap-4">
          {error && (
            <div className="bg-red-50 text-red-700 border border-red-100 rounded-xl p-3 flex items-start gap-2 text-xs">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Select Target Status Field */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              Select Comparison Target
            </label>
            <select
              value={field}
              onChange={(e) => handleFieldChange(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
            >
              <option value="overall_status">Overall Status</option>
              <option value="books_vs_26as_status">Books vs Form 26AS</option>
              <option value="books_vs_tally_status">Books vs Tally Ledger</option>
              <option value="as26_vs_tally_status">Form 26AS vs Tally Ledger</option>
            </select>
          </div>

          {/* Select Override Value */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              New Status Value
            </label>
            <select
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
            >
              {statusOptions[field].map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          {/* Required Justification Note */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              Justification Note <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Provide a brief explanation for auditing purposes (e.g., Client confirmed offline credit mismatch resolved)..."
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end mt-4 border-t border-gray-50 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-gray-700 border border-gray-200 hover:bg-gray-50 text-sm font-medium transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-5 py-2 rounded-xl transition text-sm flex items-center gap-2 disabled:opacity-50"
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
