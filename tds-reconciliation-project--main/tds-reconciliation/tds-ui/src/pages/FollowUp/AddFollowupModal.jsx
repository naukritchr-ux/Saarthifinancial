import React, { useState } from 'react';
import { X, Loader2, AlertCircle, PhoneCall } from 'lucide-react';
import { createFollowup, updateFollowup } from '../../api/tdsApi';

export default function AddFollowupModal({ itemToEdit, initialData, onClose, onSaveSuccess }) {
  const isEditing = !!itemToEdit;

  const [tanNo, setTanNo] = useState(isEditing ? itemToEdit.tanNo : (initialData?.tan || ''));
  const [companyName, setCompanyName] = useState(isEditing ? itemToEdit.companyName : (initialData?.company || ''));
  const [contactPerson, setContactPerson] = useState(isEditing ? itemToEdit.contactPerson : '');
  const [department, setDepartment] = useState(isEditing ? itemToEdit.department : 'Accounts');
  const [contactNumber, setContactNumber] = useState(isEditing ? itemToEdit.contactNumber : '');
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
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center bg-slate-950 text-white px-6 py-4 border-b border-slate-800">
          <div>
            <h3 className="font-bold text-base text-amber-400 flex items-center gap-2">
              <PhoneCall className="w-4 h-4 text-amber-400" />
              {isEditing ? 'Edit Client Follow-up Log' : 'Log New Client Follow-up'}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {isEditing ? `Entry #${itemToEdit.id}` : 'Record communication attempt and next action date'}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-xl flex items-start gap-2 text-xs border border-red-200 font-semibold">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-gray-500 uppercase tracking-wider mb-1 text-[10px]">
                TAN Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={tanNo}
                onChange={(e) => setTanNo(e.target.value.toUpperCase())}
                placeholder="e.g. MUMK12345F"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-mono uppercase focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block font-bold text-gray-500 uppercase tracking-wider mb-1 text-[10px]">
                Company Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Acme Tech Solutions"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-gray-500 uppercase tracking-wider mb-1 text-[10px]">
                Contact Person
              </label>
              <input
                type="text"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                placeholder="Name"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block font-bold text-gray-500 uppercase tracking-wider mb-1 text-[10px]">
                Department
              </label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Accounts/HR"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block font-bold text-gray-500 uppercase tracking-wider mb-1 text-[10px]">
                Contact Number
              </label>
              <input
                type="text"
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                placeholder="+91..."
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-gray-500 uppercase tracking-wider mb-1 text-[10px]">
                Communication Method
              </label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-amber-500"
              >
                <option value="Call">Call</option>
                <option value="Mail">Mail</option>
                <option value="WhatsApp">WhatsApp</option>
                <option value="In Person">In Person</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-gray-500 uppercase tracking-wider mb-1 text-[10px]">
                Follow-up Status <span className="text-red-500">*</span>
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-amber-500"
              >
                {statusOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-gray-500 uppercase tracking-wider mb-1 text-[10px]">
                Follow-up Date
              </label>
              <input
                type="date"
                value={followupDate}
                onChange={(e) => setFollowupDate(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block font-bold text-gray-500 uppercase tracking-wider mb-1 text-[10px]">
                Next Follow-up Date (Optional)
              </label>
              <input
                type="date"
                value={nextFollowupDate}
                onChange={(e) => setNextFollowupDate(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-gray-500 uppercase tracking-wider mb-1 text-[10px]">
              Notes / Conversation Response
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Record details of conversation, email response, or promised payment date..."
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-gray-700 border border-gray-200 hover:bg-gray-50 text-xs font-bold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-5 py-2 rounded-xl transition text-xs flex items-center gap-2 disabled:opacity-50 cursor-pointer shadow"
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
