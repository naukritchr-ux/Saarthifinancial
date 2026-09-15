import React, { useState, useEffect } from 'react';
import { X, Building2, CheckCircle2, AlertCircle, PlusCircle, DollarSign, Calendar, FileText, User, Phone, Mail } from 'lucide-react';
import { createCrmBookEntry } from '../../api/tdsApi';

export default function AddToCrmModal({ row, onClose, onSuccess }) {
  const [companyName, setCompanyName] = useState(row?.companyName || row?.company_name || row?.tanNo || row?.tan_no || '');
  const [tanNo, setTanNo] = useState(row?.tanNo || row?.tan_no || '');
  const [financialYear, setFinancialYear] = useState(row?.financialYear || row?.financial_year || 'FY 2025-26');
  
  // Suggested TDS from 26AS or difference
  const defaultTds = row?.as26Tds || row?.as26_total || Math.abs(parseFloat(row?.difference || 0)) || '';
  const [tdsAmount, setTdsAmount] = useState(defaultTds ? String(defaultTds) : '');
  const [totalBillAmount, setTotalBillAmount] = useState(defaultTds ? String(parseFloat(defaultTds) * 10) : '');
  const [billNumber, setBillNumber] = useState(`INV-26AS-${(row?.tanNo || row?.tan_no || 'TDS').slice(-4)}-${Date.now().toString(36).slice(-4).toUpperCase()}`);
  const [billDate, setBillDate] = useState(new Date().toISOString().slice(0, 10));

  // Contact person & notes
  const [contactPerson, setContactPerson] = useState(row?.contactPersonName || row?.dues_contact_person || row?.hr_name || '');
  const [contactNumber, setContactNumber] = useState(row?.contactNumber || row?.dues_contact_number || row?.contact_no || '');
  const [emailId, setEmailId] = useState(row?.emailId || '');
  const [note, setNote] = useState('Added from Form 26AS verified payment');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Update total bill when TDS amount changes
  const handleTdsChange = (val) => {
    setTdsAmount(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) {
      setTotalBillAmount(String(num * 10)); // standard 10% TDS estimation
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!tanNo.trim()) {
      setError('TAN number is required');
      return;
    }
    if (!financialYear.trim()) {
      setError('Financial Year is required');
      return;
    }
    if (!tdsAmount || isNaN(parseFloat(tdsAmount)) || parseFloat(tdsAmount) <= 0) {
      setError('Please enter a valid positive TDS amount');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await createCrmBookEntry({
        tan_no: tanNo.trim().toUpperCase(),
        company_name: companyName.trim(),
        financial_year: financialYear.trim(),
        tds_amount: parseFloat(tdsAmount),
        total_bill_amount: parseFloat(totalBillAmount) || (parseFloat(tdsAmount) * 10),
        bill_number: billNumber.trim(),
        bill_date: billDate,
        contact_person_name: contactPerson.trim() || null,
        contact_number: contactNumber.trim() || null,
        email_id: emailId.trim() || null,
        reconciliation_id: row?.id || 0,
        note: note.trim()
      });

      if (res && res.success) {
        setSuccessMsg(res.message || 'Successfully created in CRM Books & matched!');
        setTimeout(() => {
          if (onSuccess) onSuccess(res.data);
          onClose();
        }, 1200);
      } else {
        setError(res?.error || 'Failed to create CRM record');
      }
    } catch (err) {
      setError(err.message || 'Connection error creating CRM record');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-[#1F1B2E]/50 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 z-50 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl shadow-2xl border border-[#E9E4FA] max-w-lg w-full max-h-[92vh] flex flex-col overflow-hidden my-auto animate-in zoom-in-95 duration-200 text-[#1F1B2E]"
      >
        {/* Header */}
        <div className="flex justify-between items-center bg-[#9B87F5] text-white px-6 py-4.5 border-b border-[#8572E0]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base text-white">
                Book Missing TDS in CRM
              </h3>
              <p className="text-xs text-[#E8E4FF] font-medium">
                Create official CRM billing record for {tanNo || 'selected client'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#E8E4FF] hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
          {error && (
            <div className="bg-[#F87A9E]/15 text-[#E11D48] border border-[#F87A9E]/30 rounded-2xl p-3.5 flex items-start gap-2 text-xs font-bold animate-in fade-in">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="bg-[#4ADE80]/20 text-[#2E8B57] border border-[#4ADE80]/40 rounded-2xl p-3.5 flex items-start gap-2 text-xs font-black animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Client & TAN row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-black text-[#6B6580] uppercase tracking-wider mb-1">
                Client / Company Name:
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Corporate Client Name"
                className="w-full bg-[#F6F8FA] border border-[#E9E4FA] rounded-xl px-3 py-2 text-xs font-bold text-[#1F1B2E] focus:outline-none focus:border-[#9B87F5] focus:bg-white"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-[#6B6580] uppercase tracking-wider mb-1">
                TAN Number:
              </label>
              <input
                type="text"
                value={tanNo}
                onChange={(e) => setTanNo(e.target.value.toUpperCase())}
                placeholder="e.g. MUMK12345E"
                maxLength={10}
                className="w-full bg-[#F6F8FA] border border-[#E9E4FA] rounded-xl px-3 py-2 text-xs font-black text-[#1F1B2E] focus:outline-none focus:border-[#9B87F5] focus:bg-white uppercase tracking-wider"
                required
              />
            </div>
          </div>

          {/* FY & TDS Amount */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-black text-[#6B6580] uppercase tracking-wider mb-1">
                Financial Year:
              </label>
              <select
                value={financialYear}
                onChange={(e) => setFinancialYear(e.target.value)}
                className="w-full bg-[#F6F8FA] border border-[#E9E4FA] rounded-xl px-3 py-2 text-xs font-bold text-[#1F1B2E] focus:outline-none focus:border-[#9B87F5] focus:bg-white cursor-pointer"
              >
                <option value="FY 2026-27">FY 2026-27</option>
                <option value="FY 2025-26">FY 2025-26</option>
                <option value="FY 2024-25">FY 2024-25</option>
                <option value="FY 2023-24">FY 2023-24</option>
                <option value="FY 2022-23">FY 2022-23</option>
                <option value="FY 2021-22">FY 2021-22</option>
                <option value="FY 2020-21">FY 2020-21</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-black text-[#9B87F5] uppercase tracking-wider mb-1 flex items-center justify-between">
                <span>Books TDS Amount (₹):</span>
                <span className="text-[10px] text-[#2E8B57] font-black">Matches 26AS</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={tdsAmount}
                onChange={(e) => handleTdsChange(e.target.value)}
                placeholder="50000.00"
                className="w-full bg-[#E8E4FF]/30 border border-[#9B87F5]/40 rounded-xl px-3 py-2 text-xs font-black text-[#1F1B2E] focus:outline-none focus:border-[#9B87F5] focus:bg-white"
                required
              />
            </div>
          </div>

          {/* Bill Number & Total Bill Amount */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-black text-[#6B6580] uppercase tracking-wider mb-1">
                Invoice / Bill Number:
              </label>
              <input
                type="text"
                value={billNumber}
                onChange={(e) => setBillNumber(e.target.value)}
                placeholder="INV-2025-..."
                className="w-full bg-[#F6F8FA] border border-[#E9E4FA] rounded-xl px-3 py-2 text-xs font-bold text-[#1F1B2E] focus:outline-none focus:border-[#9B87F5] focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-[#6B6580] uppercase tracking-wider mb-1">
                Total Gross Bill Amount (₹):
              </label>
              <input
                type="number"
                step="0.01"
                value={totalBillAmount}
                onChange={(e) => setTotalBillAmount(e.target.value)}
                placeholder="500000.00"
                className="w-full bg-[#F6F8FA] border border-[#E9E4FA] rounded-xl px-3 py-2 text-xs font-bold text-[#1F1B2E] focus:outline-none focus:border-[#9B87F5] focus:bg-white"
              />
            </div>
          </div>

          {/* Contact Person Details */}
          <div className="bg-[#F6F8FA] p-3.5 rounded-2xl border border-[#E9E4FA] space-y-2.5">
            <div className="text-[10px] font-black text-[#6B6580] uppercase tracking-wider">
              Client Contact Information:
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <input
                type="text"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                placeholder="HR / Contact Person Name"
                className="w-full bg-white border border-[#E9E4FA] rounded-xl px-3 py-1.5 text-xs font-medium text-[#1F1B2E] focus:outline-none focus:border-[#9B87F5]"
              />
              <input
                type="text"
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                placeholder="Phone / Mobile Number"
                className="w-full bg-white border border-[#E9E4FA] rounded-xl px-3 py-1.5 text-xs font-medium text-[#1F1B2E] focus:outline-none focus:border-[#9B87F5]"
              />
            </div>
          </div>

          {/* Justification Note */}
          <div>
            <label className="block text-[10px] font-black text-[#6B6580] uppercase tracking-wider mb-1">
              Internal Audit Note:
            </label>
            <textarea
              rows="2"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Paid in Form 26AS; added to CRM Books master"
              className="w-full bg-[#F6F8FA] border border-[#E9E4FA] rounded-xl p-2.5 text-xs font-medium text-[#1F1B2E] focus:outline-none focus:border-[#9B87F5] focus:bg-white resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#E9E4FA]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-[#6B6580] hover:text-[#1F1B2E] hover:bg-[#F6F8FA] rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 bg-[#9B87F5] hover:bg-[#8572E0] disabled:opacity-50 text-white font-black px-5 py-2.5 rounded-xl text-xs transition cursor-pointer shadow-sm"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{loading ? 'Booking in CRM...' : 'Save & Reconcile in CRM'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
