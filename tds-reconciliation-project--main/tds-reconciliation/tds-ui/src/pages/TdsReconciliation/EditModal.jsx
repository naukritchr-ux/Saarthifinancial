import React, { useState, useEffect } from 'react';
import { 
  X, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  ChevronLeft, 
  ChevronRight, 
  Building2, 
  CreditCard, 
  Hash, 
  Calendar, 
  Calculator, 
  User, 
  Phone, 
  Mail, 
  FileText,
  Layers,
  Save
} from 'lucide-react';
import { getCompanyEntries, updateReconciliationEntry } from '../../api/tdsApi';

export default function EditModal({ row, onClose, onSaveSuccess }) {
  const [entries, setEntries] = useState([row]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loadingEntries, setLoadingEntries] = useState(true);

  // Form state for currently active entry
  const [formData, setFormData] = useState({
    id: row.id,
    companyName: row.companyName || row.partyName || row.deductorName || '',
    tanNo: row.tanNo || row.rawTanNo || '',
    panNo: row.panNo || '',
    financialYear: row.financialYear || '',
    tallyTds: row.tallyTds || 0,
    as26Tds: row.as26Tds || 0,
    saarthiTds: row.saarthiTds || row.booksTds || 0,
    contactPersonName: row.contactPersonName || '',
    contactNumber: row.contactNumber || '',
    emailId: row.emailId || '',
    note: ''
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(null);

  // Fetch all entries for this company / TAN on mount
  useEffect(() => {
    let isMounted = true;
    const fetchAllCompanyEntries = async () => {
      setLoadingEntries(true);
      try {
        const res = await getCompanyEntries({
          company: row.companyName && !['Client Entity', 'Unknown Client', 'Unknown Company'].includes(row.companyName.trim()) ? row.companyName : '',
          tan: (row.tanNo && !row.tanNo.startsWith('NO_TAN_') && !row.tanNo.includes('UNKNOWN')) ? row.tanNo : '',
          pan: (row.panNo && row.panNo !== 'N/A') ? row.panNo : ''
        });

        if (isMounted && res && res.success && Array.isArray(res.data) && res.data.length > 0) {
          setEntries(res.data);
          // Find index of the clicked row
          const matchIdx = res.data.findIndex(e => e.id === row.id);
          const initialIdx = matchIdx >= 0 ? matchIdx : 0;
          setCurrentIndex(initialIdx);
          loadEntryIntoForm(res.data[initialIdx]);
        } else if (isMounted) {
          loadEntryIntoForm(row);
        }
      } catch (err) {
        if (isMounted) {
          console.warn('Could not fetch multi-entries, defaulting to single row:', err);
          loadEntryIntoForm(row);
        }
      } finally {
        if (isMounted) setLoadingEntries(false);
      }
    };

    fetchAllCompanyEntries();
    return () => { isMounted = false; };
  }, [row]);

  // Load a specific entry into form
  const loadEntryIntoForm = (entry) => {
    setFormData({
      id: entry.id,
      companyName: entry.companyName || entry.partyName || entry.deductorName || '',
      tanNo: entry.tanNo || entry.rawTanNo || '',
      panNo: entry.panNo || '',
      financialYear: entry.financialYear || '',
      tallyTds: parseFloat(entry.tallyTds || 0),
      as26Tds: parseFloat(entry.as26Tds || 0),
      saarthiTds: parseFloat(entry.saarthiTds || entry.booksTds || 0),
      contactPersonName: entry.contactPersonName || '',
      contactNumber: entry.contactNumber || '',
      emailId: entry.emailId || '',
      note: ''
    });
    setError(null);
    setSaveSuccessMsg(null);
  };

  // Switch active entry index
  const handleSelectEntry = (idx) => {
    if (idx >= 0 && idx < entries.length) {
      setCurrentIndex(idx);
      loadEntryIntoForm(entries[idx]);
    }
  };

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Real-time calculation preview
  const tallyNum = parseFloat(formData.tallyTds || 0);
  const as26Num = parseFloat(formData.as26Tds || 0);
  const saarthiNum = parseFloat(formData.saarthiTds || 0);

  // Check if year is 2026-27 onwards
  const isSaarthiMode = () => {
    const fy = formData.financialYear || '';
    const match = fy.match(/(\d{4})/);
    if (match) return parseInt(match[1], 10) >= 2026;
    const shortMatch = fy.match(/(\d{2})[-/](\d{2})/);
    if (shortMatch) {
      const yr = parseInt(shortMatch[1], 10);
      return yr >= 26 && yr < 90;
    }
    return false;
  };

  const isSaarthi = isSaarthiMode();
  const baselineLabel = isSaarthi ? 'Saarthi 360 TDS' : 'Tally TDS';
  const baselineVal = isSaarthi ? (saarthiNum > 0 ? saarthiNum : tallyNum) : (tallyNum > 0 ? tallyNum : saarthiNum);
  const calculatedBalance = baselineVal - as26Num; // Tally - 26AS or Saarthi - 26AS

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(parseFloat(val || 0));
  };

  // Save current entry and optionally advance to next
  const handleSave = async (advanceToNext = false) => {
    setSaving(true);
    setError(null);
    setSaveSuccessMsg(null);

    try {
      const res = await updateReconciliationEntry(formData.id, {
        companyName: formData.companyName.trim(),
        tanNo: formData.tanNo.trim().toUpperCase(),
        panNo: formData.panNo.trim().toUpperCase(),
        financialYear: formData.financialYear.trim(),
        tallyTds: tallyNum,
        as26Tds: as26Num,
        saarthiTds: saarthiNum,
        contactPersonName: formData.contactPersonName.trim(),
        contactNumber: formData.contactNumber.trim(),
        emailId: formData.emailId.trim(),
        note: formData.note.trim()
      });

      if (res && res.success) {
        setSaveSuccessMsg(`Entry #${formData.id} (${formData.financialYear || 'FY'}) updated successfully!`);
        
        // Update local entries list
        setEntries(prev => prev.map((e, idx) => idx === currentIndex ? {
          ...e,
          ...formData,
          tallyTds: tallyNum,
          as26Tds: as26Num,
          saarthiTds: saarthiNum,
          balance: calculatedBalance
        } : e));

        if (onSaveSuccess) onSaveSuccess();

        if (advanceToNext && currentIndex + 1 < entries.length) {
          setTimeout(() => {
            handleSelectEntry(currentIndex + 1);
          }, 400);
        }
      } else {
        setError(res?.error || 'Failed to update entry');
      }
    } catch (err) {
      setError(err.message || 'Connection error while saving');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-[#1F1B2E]/60 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 z-50 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl shadow-2xl border border-[#E9E4FA] max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden my-auto animate-scale-up text-[#1F1B2E]"
      >
        {/* Header */}
        <div className="flex-none flex justify-between items-center bg-[#9B87F5] text-white px-6 py-4 border-b border-[#8572E0]">
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-white" />
              <h3 className="font-black text-base text-white">
                Edit Reconciliation Data & Company Entries
              </h3>
            </div>
            <p className="text-xs text-[#E8E4FF] mt-0.5">
              {entries.length > 1 
                ? `Company has ${entries.length} records. Update entries one after another.`
                : `Editing record #${formData.id} — ${formData.companyName || 'Entity'}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#E8E4FF] hover:text-white hover:bg-[#8572E0] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Multi-Entry Navigation Stepper (if > 1 entry) */}
        {entries.length > 1 && (
          <div className="flex-none bg-[#F6F8FA] border-b border-[#E9E4FA] px-6 py-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-black uppercase text-[#6B6580] tracking-wider flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-[#9B87F5]" />
                Company Entries ({currentIndex + 1} of {entries.length})
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={currentIndex === 0}
                  onClick={() => handleSelectEntry(currentIndex - 1)}
                  className="p-1 rounded-lg border border-[#E9E4FA] bg-white text-[#1F1B2E] disabled:opacity-30 hover:bg-[#E8E4FF] transition cursor-pointer"
                  title="Previous Entry"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={currentIndex === entries.length - 1}
                  onClick={() => handleSelectEntry(currentIndex + 1)}
                  className="p-1 rounded-lg border border-[#E9E4FA] bg-white text-[#1F1B2E] disabled:opacity-30 hover:bg-[#E8E4FF] transition cursor-pointer"
                  title="Next Entry"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Quick entry tab chips */}
            <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
              {entries.map((ent, idx) => (
                <button
                  key={ent.id || idx}
                  type="button"
                  onClick={() => handleSelectEntry(idx)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 border ${
                    idx === currentIndex
                      ? 'bg-[#9B87F5] text-white border-[#8572E0] shadow-xs'
                      : 'bg-white text-[#6B6580] border-[#E9E4FA] hover:text-[#1F1B2E] hover:bg-[#E8E4FF]'
                  }`}
                >
                  <span>Entry {idx + 1}:</span>
                  <span className="font-extrabold">{ent.financialYear || 'Unspecified FY'}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs custom-scrollbar">
          {error && (
            <div className="bg-[#F87A9E]/15 text-[#E11D48] border border-[#F87A9E]/30 rounded-2xl p-3 flex items-start gap-2 text-xs font-bold">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {saveSuccessMsg && (
            <div className="bg-[#4ADE80]/15 text-[#2E8B57] border border-[#4ADE80]/30 rounded-2xl p-3 flex items-start gap-2 text-xs font-bold">
              <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{saveSuccessMsg}</span>
            </div>
          )}

          {/* Core Identifiers: Company, TAN, PAN, FY */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-[#6B6580] uppercase tracking-wider mb-1">
                Company / Party Name <span className="text-[#F87A9E]">*</span>
              </label>
              <div className="relative">
                <Building2 className="w-3.5 h-3.5 text-[#6B6580] absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  placeholder="e.g. Acme Corporation Pvt Ltd"
                  className="w-full bg-[#F6F8FA] border border-[#E9E4FA] text-[#1F1B2E] rounded-xl pl-9 pr-3 py-2 text-xs font-bold focus:outline-none focus:border-[#9B87F5]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-[#6B6580] uppercase tracking-wider mb-1">
                Financial Year <span className="text-[#F87A9E]">*</span>
              </label>
              <div className="relative">
                <Calendar className="w-3.5 h-3.5 text-[#6B6580] absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={formData.financialYear}
                  onChange={(e) => setFormData({ ...formData, financialYear: e.target.value })}
                  placeholder="e.g. FY 2024-25 or FY 2026-27"
                  className="w-full bg-[#F6F8FA] border border-[#E9E4FA] text-[#1F1B2E] rounded-xl pl-9 pr-3 py-2 text-xs font-bold focus:outline-none focus:border-[#9B87F5]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-[#6B6580] uppercase tracking-wider mb-1">
                TAN Number (10 Characters)
              </label>
              <div className="relative">
                <Hash className="w-3.5 h-3.5 text-[#6B6580] absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={formData.tanNo}
                  onChange={(e) => setFormData({ ...formData, tanNo: e.target.value.toUpperCase() })}
                  placeholder="e.g. BLRP12345A"
                  maxLength={10}
                  className="w-full bg-[#F6F8FA] border border-[#E9E4FA] text-[#1F1B2E] rounded-xl pl-9 pr-3 py-2 text-xs font-mono font-bold focus:outline-none focus:border-[#9B87F5]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-[#6B6580] uppercase tracking-wider mb-1">
                PAN Number (10 Characters)
              </label>
              <div className="relative">
                <CreditCard className="w-3.5 h-3.5 text-[#6B6580] absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={formData.panNo}
                  onChange={(e) => setFormData({ ...formData, panNo: e.target.value.toUpperCase() })}
                  placeholder="e.g. ABCDE1234F"
                  maxLength={10}
                  className="w-full bg-[#F6F8FA] border border-[#E9E4FA] text-[#1F1B2E] rounded-xl pl-9 pr-3 py-2 text-xs font-mono font-bold focus:outline-none focus:border-[#9B87F5]"
                />
              </div>
            </div>
          </div>

          {/* TDS Figures: Tally, 26AS, Saarthi 360 */}
          <div className="bg-[#F6F8FA] border border-[#E9E4FA] p-4 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-[#9B87F5] tracking-wider flex items-center gap-1.5">
                <Calculator className="w-3.5 h-3.5" />
                TDS Deduction Figures (₹ INR)
              </span>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#9B87F5]/15 text-[#8572E0]">
                {isSaarthi ? '2026-27+ Rule: Saarthi 360 vs 26AS' : '2019-2026 Rule: Tally vs 26AS'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-[#6B6580] uppercase tracking-wider mb-1">
                  Tally TDS Amount
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.tallyTds}
                  onChange={(e) => setFormData({ ...formData, tallyTds: e.target.value })}
                  className="w-full bg-white border border-[#E9E4FA] text-[#1F1B2E] rounded-xl px-3 py-2 text-xs font-black text-right focus:outline-none focus:border-[#9B87F5]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#6B6580] uppercase tracking-wider mb-1">
                  26AS TDS Amount
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.as26Tds}
                  onChange={(e) => setFormData({ ...formData, as26Tds: e.target.value })}
                  className="w-full bg-white border border-[#E9E4FA] text-[#1F1B2E] rounded-xl px-3 py-2 text-xs font-black text-right focus:outline-none focus:border-[#9B87F5]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#6B6580] uppercase tracking-wider mb-1">
                  Saarthi 360 TDS
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.saarthiTds}
                  onChange={(e) => setFormData({ ...formData, saarthiTds: e.target.value })}
                  className="w-full bg-white border border-[#E9E4FA] text-[#1F1B2E] rounded-xl px-3 py-2 text-xs font-black text-right focus:outline-none focus:border-[#9B87F5]"
                />
              </div>
            </div>

            {/* Live Calculation Preview Banner */}
            <div className="bg-white p-3 rounded-xl border border-[#E9E4FA] flex items-center justify-between">
              <div>
                <div className="text-[10px] text-[#6B6580] font-bold uppercase">
                  Balance Formula ({baselineLabel} − 26AS TDS)
                </div>
                <div className="text-xs font-semibold text-[#6B6580]">
                  {formatCurrency(baselineVal)} − {formatCurrency(as26Num)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-[#6B6580] font-bold uppercase">Calculated Balance</div>
                <div className={`text-sm font-black ${
                  Math.abs(calculatedBalance) <= 1.0 
                    ? 'text-[#2E8B57]' 
                    : calculatedBalance > 1.0 
                      ? 'text-[#D97706]' 
                      : 'text-[#E11D48]'
                }`}>
                  {formatCurrency(calculatedBalance)}
                </div>
              </div>
            </div>
          </div>

          {/* Contact Details Section */}
          <div className="space-y-2">
            <span className="text-[10px] font-black uppercase text-[#6B6580] tracking-wider flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-[#9B87F5]" />
              Client Contact Information
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-[#6B6580] uppercase tracking-wider mb-1">
                  Contact Person
                </label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 text-[#6B6580] absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={formData.contactPersonName}
                    onChange={(e) => setFormData({ ...formData, contactPersonName: e.target.value })}
                    placeholder="Contact Name"
                    className="w-full bg-[#F6F8FA] border border-[#E9E4FA] text-[#1F1B2E] rounded-xl pl-9 pr-3 py-2 text-xs font-semibold focus:outline-none focus:border-[#9B87F5]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#6B6580] uppercase tracking-wider mb-1">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-[#6B6580] absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={formData.contactNumber}
                    onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })}
                    placeholder="Phone"
                    className="w-full bg-[#F6F8FA] border border-[#E9E4FA] text-[#1F1B2E] rounded-xl pl-9 pr-3 py-2 text-xs font-semibold focus:outline-none focus:border-[#9B87F5]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#6B6580] uppercase tracking-wider mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-[#6B6580] absolute left-3 top-2.5" />
                  <input
                    type="email"
                    value={formData.emailId}
                    onChange={(e) => setFormData({ ...formData, emailId: e.target.value })}
                    placeholder="Email"
                    className="w-full bg-[#F6F8FA] border border-[#E9E4FA] text-[#1F1B2E] rounded-xl pl-9 pr-3 py-2 text-xs font-semibold focus:outline-none focus:border-[#9B87F5]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Audit Note */}
          <div>
            <label className="block text-[10px] font-bold text-[#6B6580] uppercase tracking-wider mb-1">
              Audit Note / Correction Reason
            </label>
            <textarea
              rows={2}
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              placeholder="e.g. Corrected TAN/PAN number and updated 26AS credit amount after client verification..."
              className="w-full bg-[#F6F8FA] border border-[#E9E4FA] text-[#1F1B2E] rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:border-[#9B87F5] resize-none"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex-none flex flex-wrap gap-2 justify-between items-center px-6 py-4 border-t border-[#E9E4FA] bg-[#F6F8FA]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-[#1F1B2E] border border-[#E9E4FA] hover:bg-[#E8E4FF] text-xs font-bold transition cursor-pointer"
          >
            Close
          </button>

          <div className="flex items-center gap-2">
            {/* If there are more entries, show Save & Next button */}
            {entries.length > 1 && currentIndex + 1 < entries.length && (
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSave(true)}
                className="bg-white hover:bg-[#E8E4FF] text-[#9B87F5] border border-[#9B87F5] font-extrabold px-4 py-2 rounded-xl transition text-xs flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ChevronRight className="w-3.5 h-3.5" />}
                <span>Save & Next Entry ({currentIndex + 2}/{entries.length})</span>
              </button>
            )}

            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave(false)}
              className="bg-[#9B87F5] hover:bg-[#8572E0] text-white font-extrabold px-5 py-2 rounded-xl transition text-xs flex items-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving Entry...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
