import React, { useEffect, useMemo, useState } from 'react';
import {
  User,
  Mail,
  Phone,
  Hash,
  Save,
  Wrench,
  PhoneCall,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  getReconciliationReport,
  getCompanyTransactions,
  saveRecordIdentity
} from '../../api/tdsApi';

// ── Same TAN / PAN helpers as the Reconciliation page ───────────────────────────────
const TAN_RE = /^[A-Z]{4}[0-9]{5}[A-Z]$/;
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

const isPlaceholderTan = (tan) =>
  !tan ||
  String(tan).startsWith('NO_TAN_') ||
  tan === 'Pending TAN' ||
  tan === 'Not Available' ||
  String(tan).includes('UNKNOWN');

const tanForInput = (rec) => (isPlaceholderTan(rec.tanNo) ? '' : String(rec.tanNo).toUpperCase());
const panForInput = (rec) =>
  rec.panNo && rec.panNo !== 'N/A' ? String(rec.panNo).toUpperCase() : '';

const isSaarthiEraRow = (fy = '') => {
  if (!fy) return false;
  const match = String(fy).match(/(\d{4})/);
  if (match) return parseInt(match[1], 10) >= 2026;
  const shortMatch = String(fy).match(/(\d{2})[-/](\d{2})/);
  if (shortMatch) {
    const yr = parseInt(shortMatch[1], 10);
    return yr >= 26 && yr < 90;
  }
  return false;
};

const formatCurrency = (val) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
    minimumFractionDigits: 0
  }).format(Math.round(parseFloat(val || 0)));

// Build a Reconciliation-shaped record from a Reports row (used only if the
// Reconciliation record cannot be loaded).
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
    billNumber: row.bill_number || '',
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

export default function RecordDetailPanel({ row, tabFy = '', refreshToken = 0, onEdit, onChanged }) {
  const { navigateTo } = useApp();

  const [record, setRecord] = useState(null); // Reconciliation record (same data as the Reconciliation page)
  const [recordLoading, setRecordLoading] = useState(true);
  const [bills, setBills] = useState([]);
  const [billsLoading, setBillsLoading] = useState(true);
  const [billsError, setBillsError] = useState('');

  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  // Load the Reconciliation record for this row
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setRecordLoading(true);
      try {
        const tanSearch = !isPlaceholderTan(row.tan_no) ? row.tan_no : (row.company_name || '');
        const res = await getReconciliationReport({
          search: tanSearch,
          fy: row.financial_year || (tabFy && tabFy !== 'All Financial Years' ? tabFy : ''),
          limit: 200
        });
        const list = res && Array.isArray(res.data) ? res.data : [];
        let found = null;
        if (row.id !== undefined && row.id !== null && row.id !== '') {
          found = list.find((r) => String(r.id) === String(row.id)) || null;
        }
        if (!found) {
          found = list.find((r) => r.tanNo && r.tanNo === row.tan_no) || null;
        }
        if (!cancelled) setRecord(found);
      } catch {
        if (!cancelled) setRecord(null);
      } finally {
        if (!cancelled) setRecordLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [row, tabFy, refreshToken]);

  // Load billing details for this company / TAN
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setBillsLoading(true);
      setBillsError('');
      try {
        const res = await getCompanyTransactions({
          id: row.id || '',
          tan: row.tan_no,
          company: row.company_name,
          pan: row.pan_no && row.pan_no !== 'N/A' ? row.pan_no : '',
          fy: '' // all years
        });
        if (cancelled) return;
        setBills(res?.success && res.data?.bills ? res.data.bills : []);
        if (!res?.success) setBillsError(res?.error || 'Could not load bills');
      } catch (err) {
        if (!cancelled) { setBills([]); setBillsError(err.message || 'Could not load bills'); }
      } finally {
        if (!cancelled) setBillsLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [row, refreshToken]);

  const rec = useMemo(() => record || adaptReportRow(row), [record, row]);

  // Fall back to the row's own bill if the bills lookup returned nothing
  const rowBill = row.bill_number && row.bill_number !== 'N/A' ? row.bill_number : '';
  const billRows = bills.length > 0
    ? bills
    : (rowBill
        ? [{ id: 'row', billNumber: rowBill, billDate: row.bill_date, totalBillAmount: row.total_bill_amount || row.gross_amount || 0 }]
        : []);

  // ── Variance logic (identical to the Reconciliation page) ──
  const tallyVal = parseFloat(rec.tallyTds || 0);
  const as26Val = parseFloat(rec.as26Tds || 0);
  const saarthiVal = parseFloat(rec.saarthiTds || rec.booksTds || 0);
  const isSaarthiEra = isSaarthiEraRow(rec.financialYear || '');
  const baselineVal = isSaarthiEra
    ? saarthiVal
    : (tallyVal > 0 ? tallyVal : saarthiVal);
  const balance = rec.balance !== undefined && rec.balance !== null
    ? parseFloat(rec.balance)
    : baselineVal - as26Val;
  const isShort = balance > 1.0;

  const validCompany =
    rec.companyName &&
    !['Client Entity', 'Unknown Client', 'Unknown Company', 'Unassigned Entity'].includes(String(rec.companyName).trim());
  const displayName = validCompany ? rec.companyName : (row.company_name || 'Company Name Not Specified');

  // ── Editable TAN / PAN ──
  const tan = String(draft.tanNo ?? tanForInput(rec)).replace(/\s+/g, '').toUpperCase();
  const pan = String(draft.panNo ?? panForInput(rec)).replace(/\s+/g, '').toUpperCase();
  const tanChanged = tan !== '' && tan !== tanForInput(rec);
  const panChanged = pan !== '' && pan !== panForInput(rec);
  const identityDirty = tanChanged || panChanged;

  const updateDraft = (field, value) => {
    setDraft((d) => ({ ...d, [field]: value.replace(/\s+/g, '').toUpperCase() }));
    setMsg(null);
  };

  const saveIdentity = async () => {
    if (!tanChanged && !panChanged) return;
    if (tanChanged && !TAN_RE.test(tan)) {
      setMsg({ type: 'error', text: 'TAN must be 4 letters + 5 digits + 1 letter (e.g. MUMA12345B).' });
      return;
    }
    if (panChanged && !PAN_RE.test(pan)) {
      setMsg({ type: 'error', text: 'PAN must be 5 letters + 4 digits + 1 letter (e.g. ABCDE1234F).' });
      return;
    }
    setSaving(true);
    setMsg(null);
    const res = await saveRecordIdentity(rec.id, {
      tanNo: tanChanged ? tan : undefined,
      panNo: panChanged ? pan : undefined
    });
    setSaving(false);
    if (res && res.success) {
      setMsg({ type: 'ok', text: 'Saved to Saarthi 360, Tally and 26AS data.' });
      setDraft({});
      if (onChanged) onChanged();
    } else {
      setMsg({ type: 'error', text: res?.error || 'Could not save. Please try again.' });
    }
  };

  const infoCard = (Icon, label, value) => (
    <div className="flex items-center gap-2 p-2.5 rounded-xl border border-[#E9E4FA] bg-[#F6F8FA]">
      <Icon className="w-4 h-4 text-[#6B6580] flex-shrink-0" />
      <div className="truncate">
        <div className="text-[9px] text-[#6B6580] uppercase font-bold">{label}</div>
        <div className="font-bold text-[#1F1B2E] text-xs truncate">{value || 'Not recorded'}</div>
      </div>
    </div>
  );

  return (
    <div className="bg-white p-5 rounded-2xl border border-[#E9E4FA] space-y-4 shadow-sm text-xs">
      {/* Contact Details Card */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-black uppercase text-[#9B87F5] tracking-wider">
          <span className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5" />
            Client Contact Details
          </span>

          {/* Editable TAN / PAN — saved permanently to Saarthi 360, Tally and 26AS data */}
          <div className="flex flex-wrap items-center gap-3 text-[#6B6580] normal-case tracking-normal">
            <label className="flex items-center gap-2">
              <span className="font-bold">TAN:</span>
              <input
                type="text"
                value={draft.tanNo ?? tanForInput(rec)}
                onChange={(e) => updateDraft('tanNo', e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveIdentity(); }}
                placeholder="Enter TAN"
                maxLength={10}
                className="w-36 px-2 py-1 rounded-md border border-[#E9E4FA] bg-white text-[#1F1B2E] font-mono font-bold outline-none focus:border-[#9B87F5] focus:ring-1 focus:ring-[#9B87F5]"
              />
            </label>

            <label className="flex items-center gap-2">
              <span className="font-bold">PAN:</span>
              <input
                type="text"
                value={draft.panNo ?? panForInput(rec)}
                onChange={(e) => updateDraft('panNo', e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveIdentity(); }}
                placeholder="Enter PAN"
                maxLength={10}
                className="w-36 px-2 py-1 rounded-md border border-[#E9E4FA] bg-white text-[#1F1B2E] font-mono font-bold outline-none focus:border-[#9B87F5] focus:ring-1 focus:ring-[#9B87F5]"
              />
            </label>

            <button
              type="button"
              onClick={saveIdentity}
              disabled={!identityDirty || saving}
              className="inline-flex items-center gap-1.5 bg-[#9B87F5] hover:bg-[#8572E0] disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold text-xs px-3 py-1.5 rounded-xl transition cursor-pointer"
              title="Save TAN/PAN permanently to Saarthi 360, Tally and Form 26AS data"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Saving…' : 'Save TAN / PAN'}
            </button>

            {msg?.text && (
              <span className={`text-[11px] font-bold ${msg.type === 'ok' ? 'text-[#2E8B57]' : 'text-[#E11D48]'}`}>
                {msg.text}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {infoCard(User, 'Contact Person', rec.contactPersonName)}
          {infoCard(Phone, 'Phone Number', rec.contactNumber)}
          {infoCard(Mail, 'Email ID', rec.emailId)}
        </div>
      </div>

      {/* Billing Details */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-[#9B87F5] tracking-wider">
          <Hash className="w-3.5 h-3.5" />
          Billing Details
        </div>
        <div className="border border-[#E9E4FA] rounded-xl overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-[#E8E4FF]/60 text-[#6B6580] font-black uppercase tracking-wider text-[10px]">
                <th className="px-3 py-2">Bill No.</th>
                <th className="px-3 py-2">Bill Date</th>
                <th className="px-3 py-2 text-right">Bill Amount</th>
                <th className="px-3 py-2 text-right">TDS</th>
                <th className="px-3 py-2 text-right">Received</th>
                <th className="px-3 py-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E9E4FA]">
              {billsLoading && billRows.length === 0 ? (
                <tr><td colSpan="6" className="px-3 py-4 text-center text-[#6B6580]">Loading billing details...</td></tr>
              ) : billRows.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-3 py-4 text-center text-[#6B6580]">
                    {billsError ? `Could not load bills: ${billsError}` : 'No bill found in Saarthi 360 for this company / TAN.'}
                  </td>
                </tr>
              ) : (
                billRows.map((b, i) => (
                  <tr key={b.id || i}>
                    <td className="px-3 py-2.5 font-bold text-[#1F1B2E]">{b.billNumber || '—'}</td>
                    <td className="px-3 py-2.5 text-[#6B6580]">{b.billDate || '—'}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-[#1F1B2E]">
                      {parseFloat(b.totalBillAmount || 0) ? formatCurrency(b.totalBillAmount) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-[#B4A7F5]">
                      {b.tds !== undefined ? formatCurrency(b.tds) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-[#2E8B57]">
                      {b.amountReceived !== undefined ? formatCurrency(b.amountReceived) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-center text-[#6B6580] font-bold">{b.status || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Financial Variance Assessment Box */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-1">
        <div className="md:col-span-1 p-3.5 rounded-xl border flex flex-col justify-between space-y-2 bg-[#F6F8FA] border-[#E9E4FA]">
          <span className="text-[10px] font-black uppercase text-[#6B6580] tracking-wider">
            TDS Balance Rule ({isSaarthiEra ? '2026-27+ Era' : '2019-2026 Era'})
          </span>

          <div className="space-y-1">
            <span
              className={`inline-flex items-center gap-1 font-black text-xs ${
                Math.abs(balance) <= 1.0
                  ? 'text-[#2E8B57]'
                  : isShort
                    ? 'text-[#D97706]'
                    : 'text-[#E11D48]'
              }`}
            >
              {Math.abs(balance) <= 1.0 ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-[#4ADE80]" />
                  Fully Matched (₹0 Variance)
                </>
              ) : isShort ? (
                <>
                  <AlertTriangle className="w-4 h-4 text-[#FBBF77]" />
                  Less Paid: {formatCurrency(Math.abs(balance))}
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 text-[#F87A9E]" />
                  Excess: {formatCurrency(Math.abs(balance))}
                </>
              )}
            </span>

            <p className="text-[11px] text-[#6B6580] font-medium leading-tight">
              {isSaarthiEra
                ? 'Calculated as Saarthi 360 CRM TDS − Form 26AS TDS.'
                : 'Calculated as Tally Ledger TDS − Form 26AS TDS.'}
            </p>
          </div>
        </div>

        {/* 3-Way Breakdown Cards */}
        <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 rounded-xl border border-[#E9E4FA] bg-white flex flex-col justify-between">
            <span className="text-[10px] font-bold text-[#6B6580] uppercase">Saarthi 360 vs 26AS</span>
            <div className="font-extrabold text-[#9B87F5] text-xs mt-1">{rec.booksVs26asStatus || 'Matched'}</div>
          </div>
          <div className="p-3 rounded-xl border border-[#E9E4FA] bg-white flex flex-col justify-between">
            <span className="text-[10px] font-bold text-[#6B6580] uppercase">Saarthi 360 vs Tally</span>
            <div className="font-extrabold text-[#9B87F5] text-xs mt-1">{rec.booksVsTallyStatus || 'Matched'}</div>
          </div>
          <div className="p-3 rounded-xl border border-[#E9E4FA] bg-white flex flex-col justify-between">
            <span className="text-[10px] font-bold text-[#6B6580] uppercase">26AS vs Tally</span>
            <div className="font-extrabold text-[#8572E0] text-xs mt-1">{rec.as26VsTallyStatus || 'Matched'}</div>
          </div>
        </div>
      </div>

      {/* Panel Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#E9E4FA]">
        <span className="text-[11px] text-[#6B6580] font-medium">
          Last modified:{' '}
          <span className="font-bold text-[#1F1B2E]">
            {recordLoading
              ? 'Loading…'
              : rec.updatedAt
                ? new Date(rec.updatedAt).toLocaleString('en-IN')
                : 'Recently'}
          </span>
        </span>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onEdit && onEdit(rec)}
            disabled={recordLoading || rec._fromReport}
            title={rec._fromReport ? 'Reconciliation record could not be loaded' : undefined}
            className="inline-flex items-center gap-1.5 bg-[#9B87F5] hover:bg-[#8572E0] disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold text-xs px-3.5 py-1.5 rounded-xl transition cursor-pointer shadow-xs"
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>Edit / Multi-Entry Update</span>
          </button>

          <button
            onClick={() => {
              const cleanTan = isPlaceholderTan(rec.tanNo) ? '' : rec.tanNo;
              navigateTo('follow-up', { tan: cleanTan, company: displayName });
            }}
            className="inline-flex items-center gap-1.5 bg-white border border-[#E9E4FA] hover:bg-[#E8E4FF] text-[#1F1B2E] font-extrabold text-xs px-3 py-1.5 rounded-xl transition cursor-pointer"
          >
            <PhoneCall className="w-3.5 h-3.5 text-[#D97706]" />
            <span>Open Follow-up</span>
          </button>
        </div>
      </div>
    </div>
  );
}