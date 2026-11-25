import React from 'react';
import { Building2, Hash, User, Phone, FileText } from 'lucide-react';

const isPlaceholder = (v) =>
  !v ||
  v === 'N/A' ||
  String(v).startsWith('NO_TAN_') ||
  v === 'Pending TAN' ||
  v === 'Not Available' ||
  String(v).includes('UNKNOWN');

// Build a Reconciliation-shaped record from a Reports row.
export const adaptReportRow = (row) => {
  const num = (v) => parseFloat(v || 0);
  const tally = num(row.tally_tds ?? row.tally_total);
  const as26 = num(row.as26_tds ?? row.as26_total);
  const saarthi = num(row.saarthi_tds ?? row.saarthi_total);
  const pair = (a, b) => (Math.abs(a - b) <= 1 ? 'Matched' : a > b ? 'Less Paid' : 'Excess');
  return {
    id: row.id,
    tanNo: row.tan_no,
    panNo: row.pan_no,
    companyName: row.company_name,
    financialYear: row.financial_year || '',
    tallyTds: tally,
    as26Tds: as26,
    saarthiTds: saarthi,
    balance: row.balance,
    contactPersonName: row.hr_name || row.contact_person_name || '',
    contactNumber: row.contact_no || row.contact_number || '',
    emailId: row.email_id || '',
    overallStatus: row.status || row.financialStatus || '',
    financialStatus: row.financialStatus || row.status || '',
    isFollowupDone: row.is_followup_done ? 1 : 0,
    booksVs26asStatus: pair(saarthi, as26),
    booksVsTallyStatus: pair(saarthi, tally),
    as26VsTallyStatus: pair(as26, tally),
    updatedAt: null,
    _fromReport: true
  };
};

// Details view: Company Name, TAN No., HR Name, Mobile No.
export default function RecordDetailPanel({ row }) {
  // Works for both report rows (snake_case) and Reconciliation-shaped rows (camelCase)
  const company = row.company_name || row.companyName || '';
  const tan = row.tan_no || row.tanNo || '';
  const pan = row.pan_no || row.panNo || '';
  const hrName = row.hr_name || row.contact_person_name || row.contactPersonName || '';
  const mobile = row.contact_no || row.contact_number || row.contactNumber || '';

  const card = (Icon, label, value, mono = false) => (
    <div className="flex items-center gap-2 p-2.5 rounded-xl border border-[#E9E4FA] bg-[#F6F8FA]">
      <Icon className="w-4 h-4 text-[#6B6580] flex-shrink-0" />
      <div className="truncate">
        <div className="text-[9px] text-[#6B6580] uppercase font-bold">{label}</div>
        <div className={`font-bold text-[#1F1B2E] text-xs truncate ${mono ? 'font-mono' : ''}`}>
          {value || 'Not recorded'}
        </div>
      </div>
    </div>
  );

  return (
    <div className="bg-white p-5 rounded-2xl border border-[#E9E4FA] space-y-4 shadow-sm text-xs">
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-[#9B87F5] tracking-wider">
          <FileText className="w-3.5 h-3.5" />
          Client Details
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {card(Building2, 'Company Name', company)}
          {card(Hash, 'TAN No.', isPlaceholder(tan) ? '' : tan, true)}
          {card(User, 'HR Name', hrName)}
          {card(Phone, 'Mobile No.', mobile, true)}
        </div>
      </div>
    </div>
  );
}