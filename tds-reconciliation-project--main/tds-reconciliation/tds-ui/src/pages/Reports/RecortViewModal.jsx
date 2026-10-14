import React from 'react';
import { X } from 'lucide-react';

// Read-only "Reconciliation Detail Record" popup (same as the Reconciliation page)
export default function RecordViewModal({ row, onClose }) {
  if (!row) return null;
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-[#1F1B2E]/50 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 z-50 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl border border-[#E9E4FA] max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden my-auto"
      >
        <div className="flex-none flex justify-between items-center bg-[#9B87F5] text-white px-6 py-4 border-b border-[#8572E0]">
          <div>
            <h3 className="font-bold text-base text-white">Reconciliation Detail Record</h3>
            <p className="text-xs text-[#E8E4FF] mt-0.5">
              {row.companyName} {row.tanNo ? `(${row.tanNo})` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-[#E8E4FF] hover:text-white hover:bg-[#8572E0] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-4 bg-[#F6F8FA] p-4 rounded-xl border border-[#E9E4FA]">
            <div>
              <span className="text-[10px] font-bold text-[#6B6580] uppercase">Tally TDS</span>
              <div className="font-black text-[#9B87F5] text-base">₹{Number(row.tallyTds || 0).toLocaleString('en-IN')}</div>
            </div>
            <div>
              <span className="text-[10px] font-bold text-[#6B6580] uppercase">Form 26AS TDS</span>
              <div className="font-black text-[#B4A7F5] text-base">₹{Number(row.as26Tds || 0).toLocaleString('en-IN')}</div>
            </div>
            <div>
              <span className="text-[10px] font-bold text-[#6B6580] uppercase">Saarthi 360 TDS</span>
              <div className="font-black text-[#9B87F5] text-base">₹{Number(row.saarthiTds || row.booksTds || 0).toLocaleString('en-IN')}</div>
            </div>
            <div>
              <span className="text-[10px] font-bold text-[#6B6580] uppercase">Calculated Balance</span>
              <div className="font-black text-[#1F1B2E] text-base">
                ₹{Number(row.balance !== undefined ? row.balance : row.difference || 0).toLocaleString('en-IN')}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between py-1 border-b border-[#E9E4FA]">
              <span className="text-[#6B6580] font-semibold">PAN Number:</span>
              <span className="font-mono font-bold text-[#1F1B2E]">{row.panNo || 'N/A'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#E9E4FA]">
              <span className="text-[#6B6580] font-semibold">Financial Year:</span>
              <span className="font-bold text-[#1F1B2E]">{row.financialYear || 'Unspecified'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#E9E4FA]">
              <span className="text-[#6B6580] font-semibold">Source Coverage:</span>
              <span className="font-bold text-[#1F1B2E]">{row.sourceCoverage?.label || '3/3 Match'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#E9E4FA]">
              <span className="text-[#6B6580] font-semibold">Is Manually Overridden:</span>
              <span className="font-bold text-[#9B87F5]">{row.isManuallyEdited ? 'Yes' : 'No'}</span>
            </div>
          </div>
        </div>

        <div className="flex-none px-6 py-4 border-t border-[#E9E4FA] bg-[#F6F8FA] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="bg-[#9B87F5] hover:bg-[#8572E0] text-white font-bold px-4 py-2 rounded-xl text-xs transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
