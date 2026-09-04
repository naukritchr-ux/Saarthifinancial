import React, { useState, useEffect } from 'react';
import { X, Loader2, AlertCircle, PhoneCall } from 'lucide-react';
import { createFollowup, updateFollowup } from '../../api/tdsApi';

export default function AddFollowupModal({ itemToEdit, initialData, onClose, onSaveSuccess }) {
  const isEditing = !!itemToEdit;

  const [tanNo, setTanNo] = useState(isEditing ? itemToEdit.tanNo : (initialData?.tan || ''));
  const [companyName, setCompanyName] = useState(isEditing ? itemToEdit.companyName : (initialData?.company || ''));
  const [contactPerson, setContactPerson] = useState(isEditing ? (itemToEdit.contactPerson || '') : '');
  const [department, setDepartment] = useState(isEditing ? (itemToEdit.department || 'Accounts') : 'Accounts');
  const [contactNumber, setContactNumber] = useState(isEditing ? (itemToEdit.contactNumber || '') : '');
  const [accountantPerson, setAccountantPerson] = useState(isEditing ? (itemToEdit.accountantPerson || '') : '');
  const [accountantNumber, setAccountantNumber] = useState(isEditing ? (itemToEdit.accountantNumber || '') : '');
  const [method, setMethod] = useState(isEditing ? itemToEdit.method : 'Call');
  const [status, setStatus] = useState(isEditing ? itemToEdit.status : 'Call Tomorrow');
  const [notes, setNotes] = useState(isEditing ? itemToEdit.notes : '');
  const [followupDate, setFollowupDate] = useState(
    isEditing ? (itemToEdit.followupDate ? itemToEdit.followupDate.split('T')[0] : new Date().toISOString().split('T')[0]) : new Date().toISOString().split('T')[0]
  );
  const [nextFollowupDate, setNextFollowupDate] = useState(
    isEditing && itemToEdit.nextFollowupDate ? itemToEdit.nextFollowupDate.split('T')[0] : ''
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const statusOptions = [
    'Call Not Picked Up',
    'Call Tomorrow',
    'HR Left',
    'Form Received',
    'TDS Paid',
    'Check & Revert',
    'Mailed',
    'Mail Reply'
  ];

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!tanNo.trim() || !companyName.trim()) {
      setError('TAN Number and Company Name are required');
      return;
    }

    setLoading(true);
    setError(null);

    const payload = {
      tanNo: tanNo.trim().toUpperCase(),
      companyName: companyName.trim(),
      contactPerson: contactPerson.trim(),
      department: department.trim(),
      contactNumber: contactNumber.trim(),
      accountantPerson: accountantPerson.trim(),
      accountantNumber: accountantNumber.trim(),
      method,
      status,
      notes: notes.trim(),
      followupDate,
      nextFollowupDate: nextFollowupDate || null
    };

    try {
      let res;
      if (isEditing) {
        res = await updateFollowup(itemToEdit.id, payload);
      } else {
        res = await createFollowup(payload);
      }

      if (res && res.success) {
        onSaveSuccess();
        onClose();
      } else {
        setError(res.error || 'Failed to save follow-up entry');
      }
    } catch (err) {
      setError(err.message || 'Connection error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 z-50 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden my-auto animate-scale-up"
      >
        {/* Header - Crisp Light Theme */}
        <div className="flex-none flex justify-between items-center bg-[#3E4A5C] text-white px-6 py-4 border-b border-[#DCE2E8]">
          <div>
            <h3 className="font-bold text-base text-white flex items-center gap-2">
              <PhoneCall className="w-4 h-4 text-[#8FA3BF]" />
              {isEditing ? 'Edit Client Follow-up Log' : 'Log New Client Follow-up'}
            </h3>
            <p className="text-xs text-[#8FA3BF] mt-0.5">
              {isEditing ? `Entry #${itemToEdit.id}` : 'Record communication attempt and next action date'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-[#8FA3BF] hover:text-white hover:bg-slate-700 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden bg-white">
          {/* Scrollable Form Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs custom-scrollbar">
            {error && (
              <div className="bg-[#C08585]/15 text-[#C08585] p-3 rounded-xl flex items-start gap-2 text-xs border border-[#C08585]/30 font-semibold">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-[#7A8794] uppercase tracking-wider mb-1 text-[10px]">
                  TAN Number <span className="text-[#C08585]">*</span>
                </label>
                <input
                  type="text"
                  value={tanNo}
                  onChange={(e) => setTanNo(e.target.value.toUpperCase())}
                  placeholder="e.g. MUMK12345F"
                  className="w-full bg-[#F6F8FA] border border-[#DCE2E8] text-[#3A4048] rounded-xl px-3 py-2 text-xs font-mono uppercase focus:outline-none focus:border-[#6E8CA0] transition-all"
                />
              </div>

              <div>
                <label className="block font-bold text-[#7A8794] uppercase tracking-wider mb-1 text-[10px]">
                  Company Name <span className="text-[#C08585]">*</span>
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Acme Tech Solutions"
                  className="w-full bg-[#F6F8FA] border border-[#DCE2E8] text-[#3A4048] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#6E8CA0] transition-all font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block font-bold text-[#7A8794] uppercase tracking-wider mb-1 text-[10px]">
                  HR / Contact Person
                </label>
                <input
                  type="text"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="HR Name"
                  className="w-full bg-[#F6F8FA] border border-[#DCE2E8] text-[#3A4048] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#6E8CA0] transition-all font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-[#7A8794] uppercase tracking-wider mb-1 text-[10px]">
                  Department
                </label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="Accounts/HR"
                  className="w-full bg-[#F6F8FA] border border-[#DCE2E8] text-[#3A4048] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#6E8CA0] transition-all font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-[#7A8794] uppercase tracking-wider mb-1 text-[10px]">
                  HR Contact Number
                </label>
                <input
                  type="text"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  placeholder="+91 98..."
                  className="w-full bg-[#F6F8FA] border border-[#DCE2E8] text-[#3A4048] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#6E8CA0] transition-all font-medium"
                />
              </div>
            </div>

            {/* Accountant Contact Details Given by HR */}
            <div className="p-3 bg-[#EEF1F4] rounded-xl border border-[#DCE2E8] space-y-2">
              <div className="text-[10px] font-black text-[#3E4A5C] uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#6E8CA0]"></span>
                Accountant / Accounts Lead Contact (Given by HR)
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#7A8794] text-[10px] mb-1">
                    Accountant Person Name
                  </label>
                  <input
                    type="text"
                    value={accountantPerson}
                    onChange={(e) => setAccountantPerson(e.target.value)}
                    placeholder="e.g. Ramesh Accounts Lead"
                    className="w-full bg-white border border-[#DCE2E8] text-[#3A4048] rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-[#6E8CA0] font-medium"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#7A8794] text-[10px] mb-1">
                    Accountant Phone / Mobile
                  </label>
                  <input
                    type="text"
                    value={accountantNumber}
                    onChange={(e) => setAccountantNumber(e.target.value)}
                    placeholder="e.g. +91 98190 12345"
                    className="w-full bg-white border border-[#DCE2E8] text-[#3A4048] rounded-xl px-3 py-1.5 text-xs font-medium focus:outline-none focus:border-[#6E8CA0]"
                  />
                </div>
              </div>
            </div>

            {/* Row 4: Method & Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-[#7A8794] uppercase tracking-wider mb-1.5">
                  Communication Method
                </label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="w-full bg-white border border-[#DCE2E8] text-[#3A4048] rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-[#6E8CA0] transition-all cursor-pointer"
                >
                  <option value="Call">Call</option>
                  <option value="Mail">Mail</option>
                  <option value="Meeting">Meeting</option>
                  <option value="WhatsApp">WhatsApp</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#7A8794] uppercase tracking-wider mb-1.5">
                  Follow-up Action Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full bg-white border border-[#DCE2E8] text-[#3A4048] rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-[#6E8CA0] transition-all cursor-pointer"
                >
                  {statusOptions.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 5: Log Date & Next Followup Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-[#7A8794] uppercase tracking-wider mb-1.5">
                  Log Record Date
                </label>
                <input
                  type="date"
                  value={followupDate}
                  onChange={(e) => setFollowupDate(e.target.value)}
                  className="w-full bg-white border border-[#DCE2E8] text-[#3A4048] rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-[#6E8CA0] cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#7A8794] uppercase tracking-wider mb-1.5">
                  Next Follow-up Action Date
                </label>
                <input
                  type="date"
                  value={nextFollowupDate}
                  onChange={(e) => setNextFollowupDate(e.target.value)}
                  className="w-full bg-white border border-[#DCE2E8] text-[#3A4048] rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-[#6E8CA0] cursor-pointer"
                />
              </div>
            </div>

            {/* Row 6: Detailed Conversation Notes */}
            <div>
              <label className="block text-[10px] font-bold text-[#7A8794] uppercase tracking-wider mb-1.5">
                Conversation Notes & Remarks
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Record details of conversation, email response, or promised payment date..."
                className="w-full bg-white border border-[#DCE2E8] text-[#3A4048] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#6E8CA0] transition-all font-medium resize-none"
              />
            </div>
          </div>

          {/* Fixed Footer Actions */}
          <div className="flex-none px-6 py-4 border-t border-[#DCE2E8] bg-[#F6F8FA] flex gap-3 justify-end items-center">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-[#3A4048] border border-[#DCE2E8] hover:bg-[#EEF1F4] text-xs font-bold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-[#6E8CA0] hover:bg-[#5B788C] text-white font-bold px-5 py-2 rounded-xl transition text-xs flex items-center gap-2 disabled:opacity-50 cursor-pointer shadow-2xs"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                isEditing ? 'Update Follow-up' : 'Save Follow-up'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

