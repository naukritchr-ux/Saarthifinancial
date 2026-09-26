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
  Save,
  IndianRupee,
  Receipt,
  CheckCheck,
  Clock,
  CheckSquare,
  Square,
  Search,
  Filter,
  ArrowRight,
  ShieldCheck,
  FileSpreadsheet
} from 'lucide-react';
import { 
  getCompanyEntries, 
  updateReconciliationEntry, 
  getCompanyTransactions, 
  updateBillStatus 
} from '../../api/tdsApi';

export default function EditModal({ row, onClose, onSaveSuccess }) {
  const [entries, setEntries] = useState([row]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [activeTab, setActiveTab] = useState('transactions'); // Default to 'transactions' as requested by user

  // Form state for currently active entry
  const [formData, setFormData] = useState({
    id: row.id,
    companyName: row.companyName || row.partyName || row.deductorName || '',
    tanNo: row.tanNo || row.rawTanNo || '',
    panNo: row.panNo || '',
    financialYear: row.financialYear || '',
    tallyTds: Math.round(parseFloat(row.tallyTds || 0)),
    as26Tds: Math.round(parseFloat(row.as26Tds || 0)),
    saarthiTds: Math.round(parseFloat(row.saarthiTds || row.booksTds || 0)),
    contactPersonName: row.contactPersonName || '',
    contactNumber: row.contactNumber || '',
    emailId: row.emailId || '',
    note: ''
  });

  // Transactions state
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [transactionsData, setTransactionsData] = useState({
    bills: [],
    tallyEntries: [],
    as26Entries: [],
    summary: {
      totalBillsCount: 0,
      totalBillAmount: 0,
      totalBillTds: 0,
      totalAmountReceived: 0,
      paidBillsCount: 0,
      pendingBillsCount: 0,
      totalTallyCount: 0,
      totalTallyTds: 0,
      total26asCount: 0,
      total26asTds: 0
    }
  });
  const [txSubTab, setTxSubTab] = useState('bills'); // 'bills' | 'tally' | '26as'
  const [billSearch, setBillSearch] = useState('');
  const [billFilter, setBillFilter] = useState('all'); // 'all' | 'paid' | 'pending'
  const [updatingBillId, setUpdatingBillId] = useState(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(null);

  // Fetch transactions for current entry
  const fetchTransactions = async (entry) => {
    if (!entry) return;
    setTransactionsLoading(true);
    try {
      const res = await getCompanyTransactions({
        id: entry.id,
        tan: (entry.tanNo && !entry.tanNo.startsWith('NO_TAN_') && !entry.tanNo.includes('UNKNOWN') && entry.tanNo !== 'Pending TAN') ? entry.tanNo : '',
        company: entry.companyName && !['Client Entity', 'Unknown Client', 'Unknown Company', 'Unassigned Entity'].includes(entry.companyName.trim()) ? entry.companyName : '',
        pan: (entry.panNo && entry.panNo !== 'N/A') ? entry.panNo : '',
        fy: entry.financialYear || ''
      });

      if (res && res.success && res.data) {
        setTransactionsData({
          bills: res.data.bills || [],
          tallyEntries: res.data.tallyEntries || [],
          as26Entries: res.data.as26Entries || [],
          summary: res.data.summary || {}
        });
      }
    } catch (err) {
      console.warn('Could not load company transactions:', err);
    } finally {
      setTransactionsLoading(false);
    }
  };

  // Fetch all entries for this company / TAN on mount
  useEffect(() => {
    let isMounted = true;
    const fetchAllCompanyEntries = async () => {
      setLoadingEntries(true);
      try {
        const res = await getCompanyEntries({
          id: row.id,
          company: row.companyName && !['Client Entity', 'Unknown Client', 'Unknown Company', 'Unassigned Entity'].includes(row.companyName.trim()) ? row.companyName : '',
          tan: (row.tanNo && !row.tanNo.startsWith('NO_TAN_') && !row.tanNo.includes('UNKNOWN') && row.tanNo !== 'Pending TAN') ? row.tanNo : '',
          pan: (row.panNo && row.panNo !== 'N/A') ? row.panNo : ''
        });

        if (isMounted && res && res.success && Array.isArray(res.data) && res.data.length > 0) {
          setEntries(res.data);
          const matchIdx = res.data.findIndex(e => e.id === row.id);
          const initialIdx = matchIdx >= 0 ? matchIdx : 0;
          setCurrentIndex(initialIdx);
          loadEntryIntoForm(res.data[initialIdx]);
          fetchTransactions(res.data[initialIdx]);
        } else if (isMounted) {
          loadEntryIntoForm(row);
          fetchTransactions(row);
        }
      } catch (err) {
        if (isMounted) {
          console.warn('Could not fetch multi-entries, defaulting to single row:', err);
          loadEntryIntoForm(row);
          fetchTransactions(row);
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
      tallyTds: Math.round(parseFloat(entry.tallyTds || 0)),
      as26Tds: Math.round(parseFloat(entry.as26Tds || 0)),
      saarthiTds: Math.round(parseFloat(entry.saarthiTds || entry.booksTds || 0)),
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
      fetchTransactions(entries[idx]);
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

  // Real-time calculation preview (rounded full integers, no decimals)
  const tallyNum = Math.round(parseFloat(formData.tallyTds || 0));
  const as26Num = Math.round(parseFloat(formData.as26Tds || 0));
  const saarthiNum = Math.round(parseFloat(formData.saarthiTds || 0));

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
  const calculatedBalance = Math.round(baselineVal - as26Num);

  // Format currency helper: STRICTLY 0 decimals, full integer figures
  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
      minimumFractionDigits: 0
    }).format(Math.round(parseFloat(val || 0)));
  };

  // Toggle bill confirmation / payment status
  const handleToggleBillStatus = async (bill) => {
    const isCurrentlyPaid = (bill.status || '').toLowerCase() === 'paid' || 
                            (bill.status || '').toLowerCase() === 'settled' ||
                            (parseFloat(bill.amountReceived || 0) >= parseFloat(bill.totalBillAmount || 0) && parseFloat(bill.totalBillAmount || 0) > 0);
    
    const nextStatus = isCurrentlyPaid ? 'Pending' : 'Paid';
    const nextReceived = isCurrentlyPaid ? 0 : parseFloat(bill.totalBillAmount || 0);

    setUpdatingBillId(bill.id);
    try {
      const res = await updateBillStatus(bill.id, {
        status: nextStatus,
        amountReceived: nextReceived
      });

      if (res && res.success) {
        // Update local bills list immediately
        setTransactionsData(prev => {
          const updatedBills = prev.bills.map(b => b.id === bill.id ? {
            ...b,
            status: nextStatus,
            amountReceived: nextReceived
          } : b);

          const paidBills = updatedBills.filter(b => {
            const s = (b.status || '').toLowerCase();
            return s === 'paid' || s === 'settled' || s === 'completed' || (parseFloat(b.amountReceived || 0) >= parseFloat(b.totalBillAmount || 0) && parseFloat(b.totalBillAmount || 0) > 0);
          });
          const paidBillsCount = paidBills.length;
          const pendingBillsCount = updatedBills.length - paidBillsCount;

          return {
            ...prev,
            bills: updatedBills,
            summary: {
              ...prev.summary,
              paidBillsCount,
              pendingBillsCount,
              totalAmountReceived: Math.round(updatedBills.reduce((acc, b) => acc + parseFloat(b.amountReceived || 0), 0))
            }
          };
        });
      }
    } catch (err) {
      console.error('Failed to update bill status:', err);
    } finally {
      setUpdatingBillId(null);
    }
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
        const newStatus = (Math.abs(calculatedBalance) <= 1.0) ? 'Matched' : (calculatedBalance > 1.0 ? 'Less Paid' : 'Excess');
        // Update local entries list
        setEntries(prev => prev.map((e, idx) => idx === currentIndex ? {
          ...e,
          ...formData,
          tallyTds: tallyNum,
          as26Tds: as26Num,
          saarthiTds: saarthiNum,
          balance: calculatedBalance,
          financialStatus: newStatus,
          overallStatus: newStatus
        } : e));

        if (onSaveSuccess) onSaveSuccess();

        if (advanceToNext && currentIndex + 1 < entries.length) {
          setTimeout(() => {
            handleSelectEntry(currentIndex + 1);
          }, 400);
        } else {
          setSaveSuccessMsg('Reconciliation details updated successfully!');
          setTimeout(() => setSaveSuccessMsg(null), 3000);
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

  // Filtered bills
  const filteredBills = transactionsData.bills.filter(b => {
    const isPaid = (b.status || '').toLowerCase() === 'paid' || 
                   (b.status || '').toLowerCase() === 'settled' ||
                   (parseFloat(b.amountReceived || 0) >= parseFloat(b.totalBillAmount || 0) && parseFloat(b.totalBillAmount || 0) > 0);
    
    if (billFilter === 'paid' && !isPaid) return false;
    if (billFilter === 'pending' && isPaid) return false;

    if (billSearch.trim()) {
      const q = billSearch.toLowerCase();
      const numMatch = (b.billNumber || b.invoiceId || '').toLowerCase().includes(q);
      const dateMatch = (b.billDate || '').toLowerCase().includes(q);
      const noteMatch = (b.note || '').toLowerCase().includes(q);
      return numMatch || dateMatch || noteMatch;
    }
    return true;
  });

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-[#1F1B2E]/65 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 z-50 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl shadow-2xl border border-[#E9E4FA] max-w-4xl w-full max-h-[94vh] flex flex-col overflow-hidden my-auto animate-scale-up text-[#1F1B2E]"
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
                ? `Company has ${entries.length} records. Update and verify entries & bills.`
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

        {/* Multi-Entry Stepper (if > 1 entry) */}
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

            {/* Stepper bubbles */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {entries.map((entry, idx) => (
                <button
                  key={entry.id || idx}
                  type="button"
                  onClick={() => handleSelectEntry(idx)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    currentIndex === idx
                      ? 'bg-[#9B87F5] text-white shadow-xs'
                      : 'bg-white border border-[#E9E4FA] text-[#6B6580] hover:bg-[#E8E4FF]'
                  }`}
                >
                  <span>{entry.financialYear || `Entry #${idx + 1}`}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                    currentIndex === idx 
                      ? 'bg-white/20 text-white' 
                      : 'bg-[#F6F8FA] text-[#6B6580]'
                  }`}>
                    {formatCurrency(entry.balance !== undefined ? Math.abs(entry.balance) : 0)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tab Navigation (Transactions vs General Form) */}
        <div className="flex-none border-b border-[#E9E4FA] bg-[#FAF9FF] px-6 pt-3 flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('transactions')}
            className={`flex items-center gap-2 px-4 py-2.5 font-black text-xs rounded-t-xl transition cursor-pointer border-b-2 ${
              activeTab === 'transactions'
                ? 'bg-white text-[#9B87F5] border-[#9B87F5] shadow-xs'
                : 'text-[#6B6580] hover:text-[#1F1B2E] border-transparent'
            }`}
          >
            <Receipt className="w-4 h-4 text-[#9B87F5]" />
            <span>Client Invoices & Bills Breakdown</span>
            {transactionsData.bills.length > 0 && (
              <span className="bg-[#9B87F5]/15 text-[#9B87F5] text-[10px] px-2 py-0.5 rounded-full font-bold">
                {transactionsData.summary.paidBillsCount || 0}/{transactionsData.bills.length} Paid
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('company')}
            className={`flex items-center gap-2 px-4 py-2.5 font-black text-xs rounded-t-xl transition cursor-pointer border-b-2 ${
              activeTab === 'company'
                ? 'bg-white text-[#9B87F5] border-[#9B87F5] shadow-xs'
                : 'text-[#6B6580] hover:text-[#1F1B2E] border-transparent'
            }`}
          >
            <Calculator className="w-4 h-4 text-[#9B87F5]" />
            <span>Company Details & TDS Totals</span>
          </button>
        </div>

        {/* Alerts */}
        {error && (
          <div className="m-4 mb-0 p-3 bg-[#F87A9E]/10 border border-[#F87A9E]/30 rounded-2xl flex items-center gap-2 text-xs text-[#E11D48] font-bold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {saveSuccessMsg && (
          <div className="m-4 mb-0 p-3 bg-[#4ADE80]/15 border border-[#4ADE80]/30 rounded-2xl flex items-center gap-2 text-xs text-[#2E8B57] font-bold animate-fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* ══════════════ TAB 1: TRANSACTIONS & BILLS BREAKDOWN ══════════════ */}
          {activeTab === 'transactions' && (
            <div className="space-y-4">
              {/* Summary KPIs Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-[#FAF9FF] p-3 rounded-2xl border border-[#E9E4FA]">
                  <div className="text-[10px] font-bold text-[#6B6580] uppercase">Total Bills</div>
                  <div className="text-lg font-black text-[#1F1B2E] mt-0.5">
                    {transactionsData.summary.totalBillsCount || transactionsData.bills.length} Bills
                  </div>
                  <div className="text-[10px] text-[#6B6580] font-medium">
                    Gross: {formatCurrency(transactionsData.summary.totalBillAmount || 0)}
                  </div>
                </div>

                <div className="bg-[#4ADE80]/10 p-3 rounded-2xl border border-[#4ADE80]/20">
                  <div className="text-[10px] font-bold text-[#2E8B57] uppercase flex items-center gap-1">
                    <CheckCheck className="w-3.5 h-3.5" />
                    Paid / Confirmed
                  </div>
                  <div className="text-lg font-black text-[#2E8B57] mt-0.5">
                    {transactionsData.summary.paidBillsCount || 0} Bills
                  </div>
                  <div className="text-[10px] text-[#2E8B57] font-semibold">
                    Received: {formatCurrency(transactionsData.summary.totalAmountReceived || 0)}
                  </div>
                </div>

                <div className="bg-[#F87A9E]/10 p-3 rounded-2xl border border-[#F87A9E]/20">
                  <div className="text-[10px] font-bold text-[#E11D48] uppercase flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    Unpaid / Pending
                  </div>
                  <div className="text-lg font-black text-[#E11D48] mt-0.5">
                    {transactionsData.summary.pendingBillsCount || 0} Bills
                  </div>
                  <div className="text-[10px] text-[#E11D48] font-semibold">
                    Action required
                  </div>
                </div>

                <div className="bg-[#9B87F5]/10 p-3 rounded-2xl border border-[#9B87F5]/20">
                  <div className="text-[10px] font-bold text-[#9B87F5] uppercase">Total Bill TDS</div>
                  <div className="text-lg font-black text-[#9B87F5] mt-0.5">
                    {formatCurrency(transactionsData.summary.totalBillTds || 0)}
                  </div>
                  <div className="text-[10px] text-[#6B6580] font-medium">
                    Cumulative TDS
                  </div>
                </div>
              </div>

              {/* Sub-Tabs: Bills vs Tally vs 26AS */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-2">
                <div className="flex items-center gap-1.5 bg-[#F6F8FA] p-1 rounded-xl border border-[#E9E4FA]">
                  <button
                    type="button"
                    onClick={() => setTxSubTab('bills')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      txSubTab === 'bills'
                        ? 'bg-white text-[#9B87F5] shadow-xs'
                        : 'text-[#6B6580] hover:text-[#1F1B2E]'
                    }`}
                  >
                    Client Bills ({transactionsData.bills.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTxSubTab('tally')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      txSubTab === 'tally'
                        ? 'bg-white text-[#9B87F5] shadow-xs'
                        : 'text-[#6B6580] hover:text-[#1F1B2E]'
                    }`}
                  >
                    Tally Vouchers ({transactionsData.tallyEntries.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTxSubTab('26as')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      txSubTab === '26as'
                        ? 'bg-white text-[#9B87F5] shadow-xs'
                        : 'text-[#6B6580] hover:text-[#1F1B2E]'
                    }`}
                  >
                    26AS Records ({transactionsData.as26Entries.length})
                  </button>
                </div>

                {/* Search and Filters for Bills */}
                {txSubTab === 'bills' && (
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-44">
                      <Search className="w-3.5 h-3.5 text-[#6B6580] absolute left-2.5 top-2.5" />
                      <input
                        type="text"
                        value={billSearch}
                        onChange={(e) => setBillSearch(e.target.value)}
                        placeholder="Search bill # or date..."
                        className="w-full bg-[#F6F8FA] border border-[#E9E4FA] text-[#1F1B2E] rounded-xl pl-8 pr-3 py-1.5 text-xs font-medium focus:outline-none focus:border-[#9B87F5]"
                      />
                    </div>
                    <select
                      value={billFilter}
                      onChange={(e) => setBillFilter(e.target.value)}
                      className="bg-[#F6F8FA] border border-[#E9E4FA] text-[#1F1B2E] rounded-xl px-2.5 py-1.5 text-xs font-bold focus:outline-none focus:border-[#9B87F5] cursor-pointer"
                    >
                      <option value="all">All Bills</option>
                      <option value="paid">Paid Only</option>
                      <option value="pending">Unpaid Only</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Transactions List Table */}
              {transactionsLoading ? (
                <div className="p-12 text-center text-[#6B6580] flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-[#9B87F5]" />
                  <span className="text-xs font-semibold">Loading transaction records...</span>
                </div>
              ) : txSubTab === 'bills' ? (
                filteredBills.length === 0 ? (
                  <div className="p-8 text-center bg-[#FAF9FF] rounded-2xl border border-dashed border-[#E9E4FA]">
                    <Receipt className="w-8 h-8 text-[#B4A7F5] mx-auto mb-2 opacity-60" />
                    <div className="text-xs font-bold text-[#1F1B2E]">No client bills found for this record</div>
                    <p className="text-[11px] text-[#6B6580] mt-1">
                      {billSearch ? 'Try clearing your search query.' : 'Bills will appear here once linked with this company or TAN.'}
                    </p>
                  </div>
                ) : (
                  <div className="border border-[#E9E4FA] rounded-2xl overflow-hidden shadow-2xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#FAF9FF] border-b border-[#E9E4FA] text-[#6B6580] font-bold uppercase text-[10px]">
                          <tr>
                            <th className="px-3 py-2.5 text-center">Paid / Confirm</th>
                            <th className="px-3 py-2.5">Bill Number</th>
                            <th className="px-3 py-2.5">Date</th>
                            <th className="px-3 py-2.5 text-right">Bill Gross</th>
                            <th className="px-3 py-2.5 text-right">TDS (₹)</th>
                            <th className="px-3 py-2.5 text-right">Received</th>
                            <th className="px-3 py-2.5 text-center">Status</th>
                            <th className="px-3 py-2.5 text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E9E4FA]">
                          {filteredBills.map((b) => {
                            const isPaid = (b.status || '').toLowerCase() === 'paid' || 
                                           (b.status || '').toLowerCase() === 'settled' ||
                                           (parseFloat(b.amountReceived || 0) >= parseFloat(b.totalBillAmount || 0) && parseFloat(b.totalBillAmount || 0) > 0);
                            const isUpdating = updatingBillId === b.id;

                            return (
                              <tr 
                                key={b.id} 
                                className={`hover:bg-[#FAF9FF] transition ${isPaid ? 'bg-white' : 'bg-[#FFF5F7]/30'}`}
                              >
                                {/* Checkbox / Confirm Toggle */}
                                <td className="px-3 py-2.5 text-center">
                                  <button
                                    type="button"
                                    disabled={isUpdating}
                                    onClick={() => handleToggleBillStatus(b)}
                                    className="p-1 rounded-lg hover:bg-[#E8E4FF] transition cursor-pointer"
                                    title={isPaid ? 'Mark as Unpaid / Pending' : 'Mark as Paid / Confirmed'}
                                  >
                                    {isUpdating ? (
                                      <Loader2 className="w-4 h-4 animate-spin text-[#9B87F5]" />
                                    ) : isPaid ? (
                                      <CheckSquare className="w-4 h-4 text-[#2E8B57]" />
                                    ) : (
                                      <Square className="w-4 h-4 text-[#6B6580]" />
                                    )}
                                  </button>
                                </td>

                                {/* Bill Number */}
                                <td className="px-3 py-2.5 font-bold text-[#1F1B2E]">
                                  {b.billNumber || b.invoiceId || 'N/A'}
                                </td>

                                {/* Bill Date */}
                                <td className="px-3 py-2.5 text-[#6B6580] font-medium whitespace-nowrap">
                                  {b.billDate || '—'}
                                </td>

                                {/* Gross Amount */}
                                <td className="px-3 py-2.5 text-right font-bold text-[#1F1B2E]">
                                  {formatCurrency(b.totalBillAmount)}
                                </td>

                                {/* TDS Amount */}
                                <td className="px-3 py-2.5 text-right font-black text-[#9B87F5]">
                                  {formatCurrency(b.tds)}
                                </td>

                                {/* Received Amount */}
                                <td className="px-3 py-2.5 text-right font-semibold text-[#6B6580]">
                                  {formatCurrency(b.amountReceived)}
                                </td>

                                {/* Status Badge */}
                                <td className="px-3 py-2.5 text-center whitespace-nowrap">
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    isPaid 
                                      ? 'bg-[#4ADE80]/15 text-[#2E8B57] border border-[#4ADE80]/30' 
                                      : 'bg-[#F87A9E]/15 text-[#E11D48] border border-[#F87A9E]/30'
                                  }`}>
                                    {isPaid ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                                    <span>{isPaid ? 'Paid' : 'Unpaid / Due'}</span>
                                  </span>
                                </td>

                                {/* Quick Action */}
                                <td className="px-3 py-2.5 text-center whitespace-nowrap">
                                  <button
                                    type="button"
                                    disabled={isUpdating}
                                    onClick={() => handleToggleBillStatus(b)}
                                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer border ${
                                      isPaid
                                        ? 'bg-[#F6F8FA] hover:bg-[#E9E4FA] text-[#6B6580] border-[#E9E4FA]'
                                        : 'bg-[#9B87F5] hover:bg-[#8572E0] text-white border-[#9B87F5] shadow-2xs'
                                    }`}
                                  >
                                    {isPaid ? 'Mark Unpaid' : 'Confirm Paid'}
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              ) : txSubTab === 'tally' ? (
                /* Tally Vouchers View */
                transactionsData.tallyEntries.length === 0 ? (
                  <div className="p-8 text-center bg-[#FAF9FF] rounded-2xl border border-dashed border-[#E9E4FA]">
                    <FileSpreadsheet className="w-8 h-8 text-[#B4A7F5] mx-auto mb-2 opacity-60" />
                    <div className="text-xs font-bold text-[#1F1B2E]">No Tally ledger vouchers for this company</div>
                  </div>
                ) : (
                  <div className="border border-[#E9E4FA] rounded-2xl overflow-hidden shadow-2xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#FAF9FF] border-b border-[#E9E4FA] text-[#6B6580] font-bold uppercase text-[10px]">
                          <tr>
                            <th className="px-3 py-2.5">Party / Ledger</th>
                            <th className="px-3 py-2.5">Voucher Date</th>
                            <th className="px-3 py-2.5">FY</th>
                            <th className="px-3 py-2.5 text-right">Gross Amount</th>
                            <th className="px-3 py-2.5 text-right">TDS Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E9E4FA]">
                          {transactionsData.tallyEntries.map((t) => (
                            <tr key={t.id} className="hover:bg-[#FAF9FF]">
                              <td className="px-3 py-2.5 font-bold text-[#1F1B2E]">
                                {t.ledgerName || t.partyName || 'Tally Entry'}
                              </td>
                              <td className="px-3 py-2.5 text-[#6B6580] font-medium whitespace-nowrap">
                                {t.voucherDate || '—'}
                              </td>
                              <td className="px-3 py-2.5 text-[#6B6580] font-bold">
                                {t.financialYear || '—'}
                              </td>
                              <td className="px-3 py-2.5 text-right font-bold text-[#1F1B2E]">
                                {formatCurrency(t.amount)}
                              </td>
                              <td className="px-3 py-2.5 text-right font-black text-[#9B87F5]">
                                {formatCurrency(t.tdsAmount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              ) : (
                /* Form 26AS Records View */
                transactionsData.as26Entries.length === 0 ? (
                  <div className="p-8 text-center bg-[#FAF9FF] rounded-2xl border border-dashed border-[#E9E4FA]">
                    <ShieldCheck className="w-8 h-8 text-[#B4A7F5] mx-auto mb-2 opacity-60" />
                    <div className="text-xs font-bold text-[#1F1B2E]">No Form 26AS records for this company</div>
                  </div>
                ) : (
                  <div className="border border-[#E9E4FA] rounded-2xl overflow-hidden shadow-2xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#FAF9FF] border-b border-[#E9E4FA] text-[#6B6580] font-bold uppercase text-[10px]">
                          <tr>
                            <th className="px-3 py-2.5">Deductor Name</th>
                            <th className="px-3 py-2.5">Section</th>
                            <th className="px-3 py-2.5">Quarter</th>
                            <th className="px-3 py-2.5">FY</th>
                            <th className="px-3 py-2.5 text-right">Amount Paid</th>
                            <th className="px-3 py-2.5 text-right">TDS Deducted</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E9E4FA]">
                          {transactionsData.as26Entries.map((a) => (
                            <tr key={a.id} className="hover:bg-[#FAF9FF]">
                              <td className="px-3 py-2.5 font-bold text-[#1F1B2E]">
                                {a.deductorName || '26AS Portal Deductor'}
                              </td>
                              <td className="px-3 py-2.5 text-[#6B6580] font-bold">
                                {a.section || '194J'}
                              </td>
                              <td className="px-3 py-2.5 text-[#6B6580] font-bold">
                                {a.quarter || 'Q1'}
                              </td>
                              <td className="px-3 py-2.5 text-[#6B6580] font-bold">
                                {a.financialYear || '—'}
                              </td>
                              <td className="px-3 py-2.5 text-right font-bold text-[#1F1B2E]">
                                {formatCurrency(a.amountPaid)}
                              </td>
                              <td className="px-3 py-2.5 text-right font-black text-[#8572E0]">
                                {formatCurrency(a.tdsDeducted)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              )}
            </div>
          )}

          {/* ══════════════ TAB 2: COMPANY DETAILS & TDS TOTALS ══════════════ */}
          {activeTab === 'company' && (
            <div className="space-y-4">
              {/* Company & Identifiers Section */}
              <div className="bg-[#FAF9FF] p-4 rounded-2xl border border-[#E9E4FA] space-y-3">
                <span className="text-[10px] font-black uppercase text-[#6B6580] tracking-wider flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-[#9B87F5]" />
                  Company & Tax Identification
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-[#6B6580] uppercase tracking-wider mb-1">
                      Company / Party Name *
                    </label>
                    <input
                      type="text"
                      value={formData.companyName}
                      onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                      placeholder="e.g. INFOSYS TECHNOLOGIES LTD"
                      className="w-full bg-white border border-[#E9E4FA] text-[#1F1B2E] rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-[#9B87F5]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-[#6B6580] uppercase tracking-wider mb-1">
                      Financial Year *
                    </label>
                    <div className="relative">
                      <Calendar className="w-3.5 h-3.5 text-[#6B6580] absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={formData.financialYear}
                        onChange={(e) => setFormData({ ...formData, financialYear: e.target.value })}
                        placeholder="e.g. FY 2024-25"
                        className="w-full bg-white border border-[#E9E4FA] text-[#1F1B2E] rounded-xl pl-9 pr-3 py-2 text-xs font-semibold focus:outline-none focus:border-[#9B87F5]"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-[#6B6580] uppercase tracking-wider mb-1">
                      TAN Number (10 Characters)
                    </label>
                    <div className="relative">
                      <Hash className="w-3.5 h-3.5 text-[#6B6580] absolute left-3 top-2.5" />
                      <input
                        type="text"
                        maxLength={10}
                        value={formData.tanNo}
                        onChange={(e) => setFormData({ ...formData, tanNo: e.target.value.toUpperCase() })}
                        placeholder="e.g. BLRR12345C"
                        className="w-full bg-white border border-[#E9E4FA] text-[#1F1B2E] rounded-xl pl-9 pr-3 py-2 text-xs font-mono font-bold uppercase focus:outline-none focus:border-[#9B87F5]"
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
                        maxLength={10}
                        value={formData.panNo}
                        onChange={(e) => setFormData({ ...formData, panNo: e.target.value.toUpperCase() })}
                        placeholder="e.g. ABCDE1234F"
                        className="w-full bg-white border border-[#E9E4FA] text-[#1F1B2E] rounded-xl pl-9 pr-3 py-2 text-xs font-mono font-bold uppercase focus:outline-none focus:border-[#9B87F5]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* TDS Deduction Figures Section */}
              <div className="bg-[#FAF9FF] p-4 rounded-2xl border border-[#E9E4FA] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-[#6B6580] tracking-wider flex items-center gap-1">
                    <IndianRupee className="w-3.5 h-3.5 text-[#9B87F5]" />
                    TDS Deduction Figures (₹ Full Figures)
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#9B87F5]/10 text-[#9B87F5]">
                    {baselineLabel} vs 26AS
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-[#6B6580] uppercase tracking-wider mb-1">
                      Tally TDS Amount
                    </label>
                    <input
                      type="number"
                      step="1"
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
                      step="1"
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
                      step="1"
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
                      Math.abs(calculatedBalance) <= 1 
                        ? 'text-[#2E8B57]' 
                        : calculatedBalance > 1 
                          ? 'text-[#D97706]' 
                          : 'text-[#E11D48]'
                    }`}>
                      {formatCurrency(calculatedBalance)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Contact Details Section */}
              <div className="bg-[#FAF9FF] p-4 rounded-2xl border border-[#E9E4FA] space-y-3">
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
                        className="w-full bg-white border border-[#E9E4FA] text-[#1F1B2E] rounded-xl pl-9 pr-3 py-2 text-xs font-semibold focus:outline-none focus:border-[#9B87F5]"
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
                        className="w-full bg-white border border-[#E9E4FA] text-[#1F1B2E] rounded-xl pl-9 pr-3 py-2 text-xs font-semibold focus:outline-none focus:border-[#9B87F5]"
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
                        className="w-full bg-white border border-[#E9E4FA] text-[#1F1B2E] rounded-xl pl-9 pr-3 py-2 text-xs font-semibold focus:outline-none focus:border-[#9B87F5]"
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
                  placeholder="e.g. Corrected TAN/PAN number and verified bills after client communication..."
                  className="w-full bg-[#FAF9FF] border border-[#E9E4FA] text-[#1F1B2E] rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:border-[#9B87F5] resize-none"
                />
              </div>
            </div>
          )}
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
