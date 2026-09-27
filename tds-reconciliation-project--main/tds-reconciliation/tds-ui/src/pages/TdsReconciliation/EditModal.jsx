import React, { useState, useEffect, useMemo } from 'react';
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
  CheckCheck,
  Clock,
  CheckSquare,
  Square,
  Search,
  ShieldCheck,
  FileSpreadsheet,
  Plus,
  Trash2,
  Table2,
  RefreshCw,
  ArrowRightLeft
} from 'lucide-react';
import { 
  getCompanyEntries, 
  updateReconciliationEntry, 
  getCompanyTransactions, 
  updateBillStatus,
  getFilterOptions
} from '../../api/tdsApi';

export default function EditModal({ row, onClose, onSaveSuccess }) {
  const [entries, setEntries] = useState(row ? [row] : []);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [activeTab, setActiveTab] = useState('recoTable'); // 'recoTable' | 'bills' | 'company'

  // Available companies list for dropdown / selector
  const [allCompanies, setAllCompanies] = useState([]);
  const [selectedCompanySearch, setSelectedCompanySearch] = useState('');
  const [isCompanyDropdownOpen, setIsCompanyDropdownOpen] = useState(false);

  // Form state for currently active entry
  const [formData, setFormData] = useState({
    id: row?.id || null,
    companyName: row?.companyName || row?.partyName || row?.deductorName || '',
    tanNo: row?.tanNo || row?.rawTanNo || '',
    panNo: row?.panNo || '',
    financialYear: row?.financialYear || '',
    tallyTds: Math.round(parseFloat(row?.tallyTds || 0)),
    as26Tds: Math.round(parseFloat(row?.as26Tds || 0)),
    saarthiTds: Math.round(parseFloat(row?.saarthiTds || row?.booksTds || 0)),
    contactPersonName: row?.contactPersonName || '',
    contactNumber: row?.contactNumber || '',
    emailId: row?.emailId || '',
    note: ''
  });

  // Multi-source transaction entries state (Tally, 26AS, Saarth360)
  const [transactionRows, setTransactionRows] = useState([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [rawTransactionsData, setRawTransactionsData] = useState({
    bills: [],
    tallyEntries: [],
    as26Entries: [],
    summary: {}
  });

  // Invoices tab state
  const [billSearch, setBillSearch] = useState('');
  const [billFilter, setBillFilter] = useState('all'); // 'all' | 'paid' | 'pending'
  const [updatingBillId, setUpdatingBillId] = useState(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(null);

  // Currency helper
  const formatCurrency = (val) => {
    if (val === null || val === undefined || isNaN(val)) return '₹0';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
      minimumFractionDigits: 0
    }).format(Math.round(parseFloat(val || 0)));
  };

  // Load distinct companies for company switcher
  useEffect(() => {
    let isMounted = true;
    const fetchCompanies = async () => {
      try {
        const res = await getFilterOptions();
        if (isMounted && res && res.companies) {
          setAllCompanies(res.companies.filter(c => c && typeof c === 'string' && c.trim() !== ''));
        }
      } catch (e) {
        console.warn('Could not fetch companies list for selector:', e);
      }
    };
    fetchCompanies();
    return () => { isMounted = false; };
  }, []);

  // Fetch transactions and align into side-by-side rows matching user structure
  const fetchAndAlignTransactions = async (targetEntry) => {
    if (!targetEntry) return;
    setTransactionsLoading(true);
    try {
      const res = await getCompanyTransactions({
        id: targetEntry.id,
        tan: (targetEntry.tanNo && !targetEntry.tanNo.startsWith('NO_TAN_') && !targetEntry.tanNo.includes('UNKNOWN') && targetEntry.tanNo !== 'Pending TAN') ? targetEntry.tanNo : '',
        company: targetEntry.companyName && !['Client Entity', 'Unknown Client', 'Unknown Company', 'Unassigned Entity'].includes(targetEntry.companyName.trim()) ? targetEntry.companyName : '',
        pan: (targetEntry.panNo && targetEntry.panNo !== 'N/A') ? targetEntry.panNo : '',
        fy: '' // Fetch all FY transactions so user can see all company entries
      });

      if (res && res.success && res.data) {
        const rawData = {
          bills: res.data.bills || [],
          tallyEntries: res.data.tallyEntries || [],
          as26Entries: res.data.as26Entries || [],
          summary: res.data.summary || {}
        };
        setRawTransactionsData(rawData);

        // Build side-by-side aligned comparison rows:
        // [ Tally (Date, Year, TDS) | 26AS (Date, Year, TDS) | Saarth360 (Date, Year, TDS) | Final Reco (Tally, 26AS, Saarthi) ]
        const bills = rawData.bills;
        const tally = rawData.tallyEntries;
        const as26 = rawData.as26Entries;

        const maxCount = Math.max(bills.length, tally.length, as26.length);

        if (maxCount === 0) {
          // Fallback to single row from current entry form data
          setTransactionRows([{
            id: 'row-1',
            tallyDate: '',
            tallyYear: targetEntry.financialYear || '',
            tallyTds: Math.round(parseFloat(targetEntry.tallyTds || 0)),
            as26Date: '',
            as26Year: targetEntry.financialYear || '',
            as26Tds: Math.round(parseFloat(targetEntry.as26Tds || 0)),
            saarthiDate: '',
            saarthiYear: targetEntry.financialYear || '',
            saarthiTds: Math.round(parseFloat(targetEntry.saarthiTds || targetEntry.booksTds || 0))
          }]);
        } else {
          const alignedRows = [];
          for (let i = 0; i < maxCount; i++) {
            const b = bills[i] || null;
            const t = tally[i] || null;
            const a = as26[i] || null;

            alignedRows.push({
              id: `row-${i + 1}`,
              tallyDate: t?.voucherDate || '',
              tallyYear: t?.financialYear || targetEntry.financialYear || '',
              tallyTds: t ? Math.round(parseFloat(t.tdsAmount || 0)) : (i === 0 && tally.length === 0 ? Math.round(parseFloat(targetEntry.tallyTds || 0)) : 0),
              as26Date: a?.quarter ? `Q${a.quarter.replace(/Q/i, '')}` : (a?.section || ''),
              as26Year: a?.financialYear || targetEntry.financialYear || '',
              as26Tds: a ? Math.round(parseFloat(a.tdsDeducted || 0)) : (i === 0 && as26.length === 0 ? Math.round(parseFloat(targetEntry.as26Tds || 0)) : 0),
              saarthiDate: b?.billDate || (b?.billNumber ? `Bill #${b.billNumber}` : ''),
              saarthiYear: b?.financialYear || targetEntry.financialYear || '',
              saarthiTds: b ? Math.round(parseFloat(b.tds || 0)) : (i === 0 && bills.length === 0 ? Math.round(parseFloat(targetEntry.saarthiTds || targetEntry.booksTds || 0)) : 0)
            });
          }
          setTransactionRows(alignedRows);
        }
      }
    } catch (err) {
      console.warn('Could not load company transactions:', err);
      // Initialize with single fallback row
      setTransactionRows([{
        id: 'row-1',
        tallyDate: '',
        tallyYear: targetEntry.financialYear || '',
        tallyTds: Math.round(parseFloat(targetEntry.tallyTds || 0)),
        as26Date: '',
        as26Year: targetEntry.financialYear || '',
        as26Tds: Math.round(parseFloat(targetEntry.as26Tds || 0)),
        saarthiDate: '',
        saarthiYear: targetEntry.financialYear || '',
        saarthiTds: Math.round(parseFloat(targetEntry.saarthiTds || targetEntry.booksTds || 0))
      }]);
    } finally {
      setTransactionsLoading(false);
    }
  };

  // Fetch all multi-entries when target row or company changes
  const loadCompanyData = async (target) => {
    if (!target) return;
    setLoadingEntries(true);
    try {
      const res = await getCompanyEntries({
        id: target.id,
        company: target.companyName && !['Client Entity', 'Unknown Client', 'Unknown Company', 'Unassigned Entity'].includes(target.companyName.trim()) ? target.companyName : '',
        tan: (target.tanNo && !target.tanNo.startsWith('NO_TAN_') && !target.tanNo.includes('UNKNOWN') && target.tanNo !== 'Pending TAN') ? target.tanNo : '',
        pan: (target.panNo && target.panNo !== 'N/A') ? target.panNo : ''
      });

      if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
        const seen = new Set();
        const uniqueList = [];
        for (const item of res.data) {
          if (!seen.has(item.id)) {
            seen.add(item.id);
            let cleanFy = item.financialYear ? String(item.financialYear).trim() : 'Unspecified';
            if (/2025[-/]?25/i.test(cleanFy)) {
              cleanFy = 'FY 2024-25';
            } else if (!cleanFy.toUpperCase().startsWith('FY') && /\d{4}/.test(cleanFy)) {
              cleanFy = `FY ${cleanFy}`;
            }
            uniqueList.push({ ...item, financialYear: cleanFy });
          }
        }

        setEntries(uniqueList);
        const matchIdx = target.id ? uniqueList.findIndex(e => e.id === target.id) : 0;
        const initialIdx = matchIdx >= 0 ? matchIdx : 0;
        setCurrentIndex(initialIdx);
        loadEntryIntoForm(uniqueList[initialIdx]);
        fetchAndAlignTransactions(uniqueList[initialIdx]);
      } else {
        setEntries([target]);
        setCurrentIndex(0);
        loadEntryIntoForm(target);
        fetchAndAlignTransactions(target);
      }
    } catch (err) {
      console.warn('Could not fetch company entries:', err);
      setEntries([target]);
      setCurrentIndex(0);
      loadEntryIntoForm(target);
      fetchAndAlignTransactions(target);
    } finally {
      setLoadingEntries(false);
    }
  };

  useEffect(() => {
    if (row) {
      loadCompanyData(row);
    }
  }, [row]);

  // Load entry into form state
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
      fetchAndAlignTransactions(entries[idx]);
    }
  };

  // Select a company from the dropdown / search
  const handleSelectCompanyFromDropdown = (companyName) => {
    setIsCompanyDropdownOpen(false);
    setSelectedCompanySearch('');
    const newTarget = {
      companyName,
      tanNo: '',
      panNo: '',
      financialYear: ''
    };
    loadCompanyData(newTarget);
  };

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Compute live sums from the side-by-side transaction rows
  const totals = useMemo(() => {
    let tallySum = 0;
    let as26Sum = 0;
    let saarthiSum = 0;

    transactionRows.forEach(r => {
      tallySum += parseFloat(r.tallyTds || 0);
      as26Sum += parseFloat(r.as26Tds || 0);
      saarthiSum += parseFloat(r.saarthiTds || 0);
    });

    tallySum = Math.round(tallySum);
    as26Sum = Math.round(as26Sum);
    saarthiSum = Math.round(saarthiSum);

    // Difference between baseline (Saarthi or Tally) and 26AS
    const baseline = saarthiSum > 0 ? saarthiSum : tallySum;
    const finalBalance = baseline - as26Sum;
    const isMatched = Math.abs(finalBalance) <= 1;

    return {
      tallySum,
      as26Sum,
      saarthiSum,
      finalBalance,
      isMatched,
      status: isMatched ? 'Matched' : (finalBalance > 1 ? 'Less Paid' : 'Excess')
    };
  }, [transactionRows]);

  // Update a cell in transaction rows
  const handleCellChange = (rowIndex, field, value) => {
    setTransactionRows(prev => {
      const next = [...prev];
      next[rowIndex] = {
        ...next[rowIndex],
        [field]: value
      };
      return next;
    });

    // Also sync to main formData totals if TDS field changed
    if (field === 'tallyTds' || field === 'as26Tds' || field === 'saarthiTds') {
      setTimeout(() => {
        setFormData(curr => {
          let tSum = 0, aSum = 0, sSum = 0;
          transactionRows.forEach((r, idx) => {
            const rowVal = (k) => idx === rowIndex && field === k ? parseFloat(value || 0) : parseFloat(r[k] || 0);
            tSum += rowVal('tallyTds');
            aSum += rowVal('as26Tds');
            sSum += rowVal('saarthiTds');
          });
          return {
            ...curr,
            tallyTds: Math.round(tSum),
            as26Tds: Math.round(aSum),
            saarthiTds: Math.round(sSum)
          };
        });
      }, 0);
    }
  };

  // Add a new empty transaction row
  const handleAddTransactionRow = () => {
    setTransactionRows(prev => [
      ...prev,
      {
        id: `row-${prev.length + 1}-${Date.now()}`,
        tallyDate: '',
        tallyYear: formData.financialYear || '',
        tallyTds: 0,
        as26Date: '',
        as26Year: formData.financialYear || '',
        as26Tds: 0,
        saarthiDate: '',
        saarthiYear: formData.financialYear || '',
        saarthiTds: 0
      }
    ]);
  };

  // Remove a transaction row
  const handleRemoveTransactionRow = (rowIndex) => {
    if (transactionRows.length <= 1) {
      // Keep at least one row, reset values
      setTransactionRows([{
        id: 'row-1',
        tallyDate: '',
        tallyYear: formData.financialYear || '',
        tallyTds: 0,
        as26Date: '',
        as26Year: formData.financialYear || '',
        as26Tds: 0,
        saarthiDate: '',
        saarthiYear: formData.financialYear || '',
        saarthiTds: 0
      }]);
      return;
    }
    setTransactionRows(prev => prev.filter((_, idx) => idx !== rowIndex));
  };

  // Toggle bill payment status in the Bills subtab
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
        setRawTransactionsData(prev => {
          const updatedBills = prev.bills.map(b => b.id === bill.id ? {
            ...b,
            status: nextStatus,
            amountReceived: nextReceived
          } : b);

          const paidBills = updatedBills.filter(b => {
            const s = (b.status || '').toLowerCase();
            return s === 'paid' || s === 'settled' || (parseFloat(b.amountReceived || 0) >= parseFloat(b.totalBillAmount || 0) && parseFloat(b.totalBillAmount || 0) > 0);
          });

          return {
            ...prev,
            bills: updatedBills,
            summary: {
              ...prev.summary,
              paidBillsCount: paidBills.length,
              pendingBillsCount: updatedBills.length - paidBills.length,
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

  // Save full reconciliation entry
  const handleSave = async (advanceToNext = false) => {
    if (!formData.id && (!entries || entries.length === 0 || !entries[0]?.id)) {
      setError('Cannot save: Record ID is missing');
      return;
    }

    setSaving(true);
    setError(null);
    setSaveSuccessMsg(null);

    const targetId = formData.id || entries[0]?.id;
    const finalTally = totals.tallySum || formData.tallyTds;
    const finalAs26 = totals.as26Sum || formData.as26Tds;
    const finalSaarthi = totals.saarthiSum || formData.saarthiTds;

    try {
      const res = await updateReconciliationEntry(targetId, {
        companyName: formData.companyName.trim(),
        tanNo: formData.tanNo.trim().toUpperCase(),
        panNo: formData.panNo.trim().toUpperCase(),
        financialYear: formData.financialYear.trim(),
        tallyTds: finalTally,
        as26Tds: finalAs26,
        saarthiTds: finalSaarthi,
        contactPersonName: formData.contactPersonName.trim(),
        contactNumber: formData.contactNumber.trim(),
        emailId: formData.emailId.trim(),
        note: formData.note.trim()
      });

      if (res && res.success) {
        setEntries(prev => prev.map((e, idx) => idx === currentIndex ? {
          ...e,
          ...formData,
          tallyTds: finalTally,
          as26Tds: finalAs26,
          saarthiTds: finalSaarthi,
          balance: totals.finalBalance,
          financialStatus: totals.status,
          overallStatus: totals.status
        } : e));

        if (onSaveSuccess) onSaveSuccess();

        if (advanceToNext && currentIndex + 1 < entries.length) {
          setTimeout(() => {
            handleSelectEntry(currentIndex + 1);
          }, 350);
        } else {
          setSaveSuccessMsg('Reconciliation entries and transactions saved successfully!');
          setTimeout(() => setSaveSuccessMsg(null), 3500);
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

  // Filtered companies for search
  const filteredCompanyDropdown = allCompanies.filter(c => 
    !selectedCompanySearch.trim() || c.toLowerCase().includes(selectedCompanySearch.toLowerCase())
  ).slice(0, 30);

  // Filtered bills for Invoices tab
  const filteredBills = rawTransactionsData.bills.filter(b => {
    const isPaid = (b.status || '').toLowerCase() === 'paid' || 
                   (b.status || '').toLowerCase() === 'settled' ||
                   (parseFloat(b.amountReceived || 0) >= parseFloat(b.totalBillAmount || 0) && parseFloat(b.totalBillAmount || 0) > 0);
    
    if (billFilter === 'paid' && !isPaid) return false;
    if (billFilter === 'pending' && isPaid) return false;

    if (billSearch.trim()) {
      const q = billSearch.toLowerCase();
      return (b.billNumber || b.invoiceId || '').toLowerCase().includes(q) ||
             (b.billDate || '').toLowerCase().includes(q) ||
             (b.note || '').toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-[#1F1B2E]/70 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 z-50 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl shadow-2xl border border-[#E9E4FA] max-w-6xl w-full max-h-[96vh] flex flex-col overflow-hidden my-auto animate-scale-up text-[#1F1B2E]"
      >
        {/* ══════════════ MODAL TOP BAR ══════════════ */}
        <div className="flex-none flex justify-between items-center bg-[#9B87F5] text-white px-6 py-4 border-b border-[#8572E0]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-2xl bg-white/15 backdrop-blur-xs">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base text-white tracking-wide">
                  TDS Reconciliation & Transaction Verification
                </h3>
                <span className="bg-white/20 text-white text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                  Live Reco Matrix
                </span>
              </div>
              <p className="text-xs text-[#E8E4FF] mt-0.5 font-medium">
                {formData.companyName ? `Company: ${formData.companyName}` : 'Select a company to reconcile each transaction'}
                {formData.tanNo ? ` • TAN: ${formData.tanNo}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Refresh */}
            <button
              type="button"
              onClick={() => {
                if (entries[currentIndex]) {
                  loadEntryIntoForm(entries[currentIndex]);
                  fetchAndAlignTransactions(entries[currentIndex]);
                }
              }}
              className="p-2 rounded-xl text-[#E8E4FF] hover:text-white hover:bg-white/15 transition cursor-pointer"
              title="Reload transactions"
            >
              <RefreshCw className={`w-4 h-4 ${transactionsLoading ? 'animate-spin' : ''}`} />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-[#E8E4FF] hover:text-white hover:bg-[#8572E0] transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ══════════════ COMPANY SELECTOR & MULTI-ENTRY BAR ══════════════ */}
        <div className="flex-none bg-[#FAF9FF] border-b border-[#E9E4FA] px-6 py-3">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            {/* Company Switcher Dropdown */}
            <div className="relative flex-1 max-w-md w-full">
              <label className="block text-[9px] font-black uppercase text-[#6B6580] tracking-wider mb-1">
                Choose / Switch Company
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsCompanyDropdownOpen(!isCompanyDropdownOpen)}
                  className="w-full bg-white border border-[#E9E4FA] hover:border-[#9B87F5] text-[#1F1B2E] rounded-xl px-3 py-2 text-xs font-bold flex items-center justify-between shadow-2xs transition cursor-pointer"
                >
                  <span className="truncate">
                    {formData.companyName || 'Search & Choose Company...'}
                  </span>
                  <ChevronRight className={`w-4 h-4 text-[#6B6580] transition-transform ${isCompanyDropdownOpen ? 'rotate-90' : ''}`} />
                </button>

                {isCompanyDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-[#E9E4FA] rounded-2xl shadow-xl z-50 overflow-hidden animate-fade-in max-h-64 flex flex-col">
                    <div className="p-2 border-b border-[#E9E4FA] bg-[#FAF9FF]">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-[#6B6580] absolute left-2.5 top-2.5" />
                        <input
                          type="text"
                          autoFocus
                          value={selectedCompanySearch}
                          onChange={(e) => setSelectedCompanySearch(e.target.value)}
                          placeholder="Search company name..."
                          className="w-full bg-white border border-[#E9E4FA] text-[#1F1B2E] rounded-xl pl-8 pr-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-[#9B87F5]"
                        />
                      </div>
                    </div>
                    <div className="overflow-y-auto divide-y divide-[#F6F8FA] p-1">
                      {filteredCompanyDropdown.length === 0 ? (
                        <div className="p-3 text-center text-xs text-[#6B6580]">No matching companies found</div>
                      ) : (
                        filteredCompanyDropdown.map((comp) => (
                          <button
                            key={comp}
                            type="button"
                            onClick={() => handleSelectCompanyFromDropdown(comp)}
                            className="w-full text-left px-3 py-2 text-xs font-bold text-[#1F1B2E] hover:bg-[#E8E4FF] rounded-xl transition cursor-pointer flex items-center justify-between"
                          >
                            <span className="truncate">{comp}</span>
                            {comp === formData.companyName && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-[#9B87F5] shrink-0" />
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Multi-Financial Year / Record Stepper for Company */}
            {entries.length > 1 && (
              <div className="flex flex-col items-start md:items-end w-full md:w-auto">
                <div className="flex items-center justify-between w-full gap-2 mb-1">
                  <span className="text-[9px] font-black uppercase text-[#6B6580] tracking-wider flex items-center gap-1">
                    <Layers className="w-3 h-3 text-[#9B87F5]" />
                    Company FY Entries ({currentIndex + 1} of {entries.length})
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={currentIndex === 0}
                      onClick={() => handleSelectEntry(currentIndex - 1)}
                      className="p-1 rounded-lg border border-[#E9E4FA] bg-white text-[#1F1B2E] disabled:opacity-30 hover:bg-[#E8E4FF] transition cursor-pointer"
                      title="Previous FY"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={currentIndex === entries.length - 1}
                      onClick={() => handleSelectEntry(currentIndex + 1)}
                      className="p-1 rounded-lg border border-[#E9E4FA] bg-white text-[#1F1B2E] disabled:opacity-30 hover:bg-[#E8E4FF] transition cursor-pointer"
                      title="Next FY"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-0.5">
                  {entries.map((entry, idx) => {
                    const label = entry.financialYear || `Entry #${idx + 1}`;
                    const isSelected = currentIndex === idx;
                    return (
                      <button
                        key={entry.id || idx}
                        type="button"
                        onClick={() => handleSelectEntry(idx)}
                        className={`px-2.5 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                          isSelected
                            ? 'bg-[#9B87F5] text-white shadow-2xs'
                            : 'bg-white border border-[#E9E4FA] text-[#6B6580] hover:bg-[#E8E4FF]'
                        }`}
                      >
                        <span>{label}</span>
                        <span className={`text-[9px] px-1 py-0.2 rounded-md ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-[#F6F8FA] text-[#6B6580]'
                        }`}>
                          {formatCurrency(entry.balance !== undefined ? Math.abs(entry.balance) : 0)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ══════════════ TAB HEADERS ══════════════ */}
        <div className="flex-none border-b border-[#E9E4FA] bg-white px-6 pt-2.5 flex gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('recoTable')}
            className={`flex items-center gap-2 px-4 py-2.5 font-black text-xs rounded-t-2xl transition cursor-pointer border-b-2 whitespace-nowrap ${
              activeTab === 'recoTable'
                ? 'bg-[#FAF9FF] text-[#9B87F5] border-[#9B87F5] shadow-2xs'
                : 'text-[#6B6580] hover:text-[#1F1B2E] border-transparent'
            }`}
          >
            <Table2 className="w-4 h-4 text-[#9B87F5]" />
            <span>Multi-Source Transaction Reconciliation Table</span>
            <span className="bg-[#9B87F5]/15 text-[#9B87F5] text-[10px] px-2 py-0.5 rounded-full font-bold">
              {transactionRows.length} {transactionRows.length === 1 ? 'Entry' : 'Entries'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('bills')}
            className={`flex items-center gap-2 px-4 py-2.5 font-black text-xs rounded-t-2xl transition cursor-pointer border-b-2 whitespace-nowrap ${
              activeTab === 'bills'
                ? 'bg-[#FAF9FF] text-[#9B87F5] border-[#9B87F5] shadow-2xs'
                : 'text-[#6B6580] hover:text-[#1F1B2E] border-transparent'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-[#9B87F5]" />
            <span>Client Invoices & Bills Breakdown</span>
            {rawTransactionsData.bills.length > 0 && (
              <span className="bg-[#4ADE80]/20 text-[#2E8B57] text-[10px] px-2 py-0.5 rounded-full font-bold">
                {rawTransactionsData.summary?.paidBillsCount || 0}/{rawTransactionsData.bills.length} Paid
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('company')}
            className={`flex items-center gap-2 px-4 py-2.5 font-black text-xs rounded-t-2xl transition cursor-pointer border-b-2 whitespace-nowrap ${
              activeTab === 'company'
                ? 'bg-[#FAF9FF] text-[#9B87F5] border-[#9B87F5] shadow-2xs'
                : 'text-[#6B6580] hover:text-[#1F1B2E] border-transparent'
            }`}
          >
            <Calculator className="w-4 h-4 text-[#9B87F5]" />
            <span>Company Particulars & Tax Info</span>
          </button>
        </div>

        {/* ══════════════ NOTIFICATIONS ══════════════ */}
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

        {/* ══════════════ SCROLLABLE MAIN CONTENT BODY ══════════════ */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* ═══════════════════════════════════════════════════════════════
              TAB 1: EXACT MULTI-SOURCE SIDE-BY-SIDE RECONCILIATION TABLE
              Columns: Tally [Date, Year, TDS] | 26AS [Date, Year, TDS] | Saarth360 [Date, Year, TDS] | Final Reco [Tally, 26AS, Saarthi]
          ═══════════════════════════════════════════════════════════════ */}
          {activeTab === 'recoTable' && (
            <div className="space-y-4">
              {/* Context Banner */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-[#FAF9FF] p-3.5 rounded-2xl border border-[#E9E4FA] gap-3">
                <div>
                  <div className="text-xs font-black text-[#1F1B2E] flex items-center gap-1.5">
                    <ArrowRightLeft className="w-4 h-4 text-[#9B87F5]" />
                    <span>Transaction-by-Transaction Multi-Source Reconciliation</span>
                  </div>
                  <p className="text-[11px] text-[#6B6580] mt-0.5">
                    Reconcile each individual transaction entry across Tally, 26AS portal, and Saarth360. TDS figures are editable directly.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAddTransactionRow}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-[#9B87F5] text-[#9B87F5] hover:bg-[#E8E4FF] transition font-bold text-xs cursor-pointer shadow-2xs"
                    title="Add another transaction row for reconciliation"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Entry Row</span>
                  </button>
                </div>
              </div>

              {/* Transactions Loading State */}
              {transactionsLoading && (
                <div className="p-12 text-center text-[#6B6580] flex flex-col items-center justify-center gap-2 bg-[#FAF9FF] rounded-2xl border border-[#E9E4FA]">
                  <Loader2 className="w-6 h-6 animate-spin text-[#9B87F5]" />
                  <span className="text-xs font-semibold">Loading and matching company transactions...</span>
                </div>
              )}

              {/* The 4-Group Table */}
              {!transactionsLoading && (
                <div className="border border-[#E9E4FA] rounded-2xl overflow-hidden shadow-xs bg-white">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse min-w-[900px]">
                      {/* Top Group Headers */}
                      <thead>
                        <tr className="text-white text-xs font-black text-center divide-x divide-white/20">
                          <th colSpan={3} className="bg-[#9B87F5] py-2.5 px-3 uppercase tracking-wider">
                            Tally
                          </th>
                          <th colSpan={3} className="bg-[#8572E0] py-2.5 px-3 uppercase tracking-wider">
                            26AS
                          </th>
                          <th colSpan={3} className="bg-[#6E59CF] py-2.5 px-3 uppercase tracking-wider">
                            Saarth360
                          </th>
                          <th colSpan={3} className="bg-[#4E3FB4] py-2.5 px-3 uppercase tracking-wider">
                            Final Reco
                          </th>
                          <th rowSpan={2} className="bg-[#3D2E99] py-2.5 px-2 uppercase tracking-wider text-[10px] w-12">
                            Action
                          </th>
                        </tr>
                        {/* Sub Headers */}
                        <tr className="bg-[#FAF9FF] text-[#6B6580] font-bold text-[10px] uppercase border-b border-[#E9E4FA] divide-x divide-[#E9E4FA]">
                          {/* Tally */}
                          <th className="px-3 py-2">Date</th>
                          <th className="px-2.5 py-2">Year</th>
                          <th className="px-3 py-2 text-right">TDS (₹)</th>

                          {/* 26AS */}
                          <th className="px-3 py-2">Date</th>
                          <th className="px-2.5 py-2">Year</th>
                          <th className="px-3 py-2 text-right">TDS (₹)</th>

                          {/* Saarth360 */}
                          <th className="px-3 py-2">Date</th>
                          <th className="px-2.5 py-2">Year</th>
                          <th className="px-3 py-2 text-right">TDS (₹)</th>

                          {/* Final Reco */}
                          <th className="px-3 py-2 text-right">Tally</th>
                          <th className="px-3 py-2 text-right">26AS</th>
                          <th className="px-3 py-2 text-right">Saarthi</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-[#E9E4FA]">
                        {transactionRows.map((rowItem, idx) => {
                          const tTds = parseFloat(rowItem.tallyTds || 0);
                          const aTds = parseFloat(rowItem.as26Tds || 0);
                          const sTds = parseFloat(rowItem.saarthiTds || 0);

                          // Comparison logic for this specific transaction row
                          const rowBaseline = sTds > 0 ? sTds : tTds;
                          const rowDiff = Math.round(rowBaseline - aTds);
                          const rowMatched = Math.abs(rowDiff) <= 1 && (rowBaseline > 0 || aTds > 0);

                          return (
                            <tr key={rowItem.id || idx} className="hover:bg-[#FAF9FF] transition divide-x divide-[#E9E4FA]">
                              {/* ══ TALLY GROUP ══ */}
                              <td className="px-2 py-2">
                                <input
                                  type="text"
                                  value={rowItem.tallyDate}
                                  onChange={(e) => handleCellChange(idx, 'tallyDate', e.target.value)}
                                  placeholder="YYYY-MM-DD"
                                  className="w-full bg-[#F6F8FA] focus:bg-white border border-transparent focus:border-[#9B87F5] rounded-lg px-2 py-1 text-xs font-medium text-[#1F1B2E] focus:outline-none"
                                />
                              </td>
                              <td className="px-2 py-2 w-24">
                                <input
                                  type="text"
                                  value={rowItem.tallyYear}
                                  onChange={(e) => handleCellChange(idx, 'tallyYear', e.target.value)}
                                  placeholder="FY 24-25"
                                  className="w-full bg-[#F6F8FA] focus:bg-white border border-transparent focus:border-[#9B87F5] rounded-lg px-2 py-1 text-xs font-medium text-[#1F1B2E] focus:outline-none"
                                />
                              </td>
                              <td className="px-2 py-2">
                                <input
                                  type="number"
                                  step="1"
                                  value={rowItem.tallyTds}
                                  onChange={(e) => handleCellChange(idx, 'tallyTds', e.target.value)}
                                  className="w-full bg-[#F6F8FA] focus:bg-white border border-transparent focus:border-[#9B87F5] rounded-lg px-2 py-1 text-xs font-bold text-right text-[#1F1B2E] focus:outline-none"
                                />
                              </td>

                              {/* ══ 26AS GROUP ══ */}
                              <td className="px-2 py-2">
                                <input
                                  type="text"
                                  value={rowItem.as26Date}
                                  onChange={(e) => handleCellChange(idx, 'as26Date', e.target.value)}
                                  placeholder="Q1 / Date"
                                  className="w-full bg-[#F6F8FA] focus:bg-white border border-transparent focus:border-[#9B87F5] rounded-lg px-2 py-1 text-xs font-medium text-[#1F1B2E] focus:outline-none"
                                />
                              </td>
                              <td className="px-2 py-2 w-24">
                                <input
                                  type="text"
                                  value={rowItem.as26Year}
                                  onChange={(e) => handleCellChange(idx, 'as26Year', e.target.value)}
                                  placeholder="FY 24-25"
                                  className="w-full bg-[#F6F8FA] focus:bg-white border border-transparent focus:border-[#9B87F5] rounded-lg px-2 py-1 text-xs font-medium text-[#1F1B2E] focus:outline-none"
                                />
                              </td>
                              <td className="px-2 py-2">
                                <input
                                  type="number"
                                  step="1"
                                  value={rowItem.as26Tds}
                                  onChange={(e) => handleCellChange(idx, 'as26Tds', e.target.value)}
                                  className="w-full bg-[#F6F8FA] focus:bg-white border border-transparent focus:border-[#9B87F5] rounded-lg px-2 py-1 text-xs font-bold text-right text-[#8572E0] focus:outline-none"
                                />
                              </td>

                              {/* ══ SAARTH360 GROUP ══ */}
                              <td className="px-2 py-2">
                                <input
                                  type="text"
                                  value={rowItem.saarthiDate}
                                  onChange={(e) => handleCellChange(idx, 'saarthiDate', e.target.value)}
                                  placeholder="Bill # / Date"
                                  className="w-full bg-[#F6F8FA] focus:bg-white border border-transparent focus:border-[#9B87F5] rounded-lg px-2 py-1 text-xs font-medium text-[#1F1B2E] focus:outline-none"
                                />
                              </td>
                              <td className="px-2 py-2 w-24">
                                <input
                                  type="text"
                                  value={rowItem.saarthiYear}
                                  onChange={(e) => handleCellChange(idx, 'saarthiYear', e.target.value)}
                                  placeholder="FY 24-25"
                                  className="w-full bg-[#F6F8FA] focus:bg-white border border-transparent focus:border-[#9B87F5] rounded-lg px-2 py-1 text-xs font-medium text-[#1F1B2E] focus:outline-none"
                                />
                              </td>
                              <td className="px-2 py-2">
                                <input
                                  type="number"
                                  step="1"
                                  value={rowItem.saarthiTds}
                                  onChange={(e) => handleCellChange(idx, 'saarthiTds', e.target.value)}
                                  className="w-full bg-[#F6F8FA] focus:bg-white border border-transparent focus:border-[#9B87F5] rounded-lg px-2 py-1 text-xs font-bold text-right text-[#6E59CF] focus:outline-none"
                                />
                              </td>

                              {/* ══ FINAL RECO GROUP ══ */}
                              <td className="px-3 py-2 text-right font-semibold text-[#1F1B2E]">
                                {formatCurrency(tTds)}
                              </td>
                              <td className="px-3 py-2 text-right font-semibold text-[#8572E0]">
                                {formatCurrency(aTds)}
                              </td>
                              <td className="px-3 py-2 text-right font-black">
                                <span className={`inline-flex items-center gap-1 font-bold ${
                                  rowMatched 
                                    ? 'text-[#2E8B57]' 
                                    : rowDiff > 0 
                                      ? 'text-[#D97706]' 
                                      : 'text-[#E11D48]'
                                }`}>
                                  {formatCurrency(sTds)}
                                </span>
                              </td>

                              {/* Action: Delete entry row */}
                              <td className="px-2 py-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveTransactionRow(idx)}
                                  className="p-1 rounded-lg text-[#6B6580] hover:text-[#E11D48] hover:bg-[#FFF5F7] transition cursor-pointer"
                                  title="Remove this transaction row"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>

                      {/* ══ TOTALS FOOTER ROW ══ */}
                      <tfoot>
                        <tr className="bg-[#FAF9FF] border-t-2 border-[#E9E4FA] font-black text-xs divide-x divide-[#E9E4FA]">
                          <td colSpan={2} className="px-3 py-3 text-[#1F1B2E] uppercase text-[10px]">
                            Tally TDS Total
                          </td>
                          <td className="px-3 py-3 text-right text-[#1F1B2E] font-black">
                            {formatCurrency(totals.tallySum)}
                          </td>

                          <td colSpan={2} className="px-3 py-3 text-[#8572E0] uppercase text-[10px]">
                            26AS TDS Total
                          </td>
                          <td className="px-3 py-3 text-right text-[#8572E0] font-black">
                            {formatCurrency(totals.as26Sum)}
                          </td>

                          <td colSpan={2} className="px-3 py-3 text-[#6E59CF] uppercase text-[10px]">
                            Saarthi TDS Total
                          </td>
                          <td className="px-3 py-3 text-right text-[#6E59CF] font-black">
                            {formatCurrency(totals.saarthiSum)}
                          </td>

                          {/* Final Reco Result */}
                          <td colSpan={3} className="px-3 py-3 text-center">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] font-bold text-[#6B6580] uppercase">
                                Balance ({totals.status}):
                              </span>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-black ${
                                totals.isMatched 
                                  ? 'bg-[#4ADE80]/20 text-[#2E8B57]' 
                                  : totals.finalBalance > 0 
                                    ? 'bg-[#F59E0B]/20 text-[#D97706]' 
                                    : 'bg-[#F87A9E]/20 text-[#E11D48]'
                              }`}>
                                {formatCurrency(totals.finalBalance)}
                              </span>
                            </div>
                          </td>

                          <td className="px-2 py-3 bg-[#FAF9FF]"></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* Status Summary Card */}
              <div className="bg-[#FAF9FF] p-4 rounded-2xl border border-[#E9E4FA] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-2xl ${
                    totals.isMatched ? 'bg-[#4ADE80]/20 text-[#2E8B57]' : 'bg-[#F59E0B]/20 text-[#D97706]'
                  }`}>
                    {totals.isMatched ? <CheckCheck className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="text-xs font-black text-[#1F1B2E]">
                      Reconciliation State: <span className={totals.isMatched ? 'text-[#2E8B57]' : 'text-[#D97706]'}>{totals.status}</span>
                    </div>
                    <div className="text-[11px] text-[#6B6580] mt-0.5">
                      {totals.isMatched 
                        ? 'All transactions perfectly balanced between books and TRACES 26AS.' 
                        : `Variance of ${formatCurrency(Math.abs(totals.finalBalance))} detected across sources.`}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <input
                    type="text"
                    value={formData.note}
                    onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                    placeholder="Add audit note or reason for edit..."
                    className="flex-1 sm:w-64 bg-white border border-[#E9E4FA] rounded-xl px-3 py-1.5 text-xs text-[#1F1B2E] focus:outline-none focus:border-[#9B87F5]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              TAB 2: CLIENT INVOICES & BILLS BREAKDOWN
          ═══════════════════════════════════════════════════════════════ */}
          {activeTab === 'bills' && (
            <div className="space-y-4">
              {/* Summary KPIs Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-[#FAF9FF] p-3 rounded-2xl border border-[#E9E4FA]">
                  <div className="text-[10px] font-bold text-[#6B6580] uppercase">Total Invoices</div>
                  <div className="text-lg font-black text-[#1F1B2E] mt-0.5">
                    {rawTransactionsData.summary?.totalBillsCount || rawTransactionsData.bills.length} Bills
                  </div>
                  <div className="text-[10px] text-[#6B6580] font-medium">
                    Gross: {formatCurrency(rawTransactionsData.summary?.totalBillAmount || 0)}
                  </div>
                </div>

                <div className="bg-[#4ADE80]/10 p-3 rounded-2xl border border-[#4ADE80]/20">
                  <div className="text-[10px] font-bold text-[#2E8B57] uppercase flex items-center gap-1">
                    <CheckCheck className="w-3.5 h-3.5" />
                    Paid / Settled
                  </div>
                  <div className="text-lg font-black text-[#2E8B57] mt-0.5">
                    {rawTransactionsData.summary?.paidBillsCount || 0} Bills
                  </div>
                  <div className="text-[10px] text-[#2E8B57] font-semibold">
                    Received: {formatCurrency(rawTransactionsData.summary?.totalAmountReceived || 0)}
                  </div>
                </div>

                <div className="bg-[#F87A9E]/10 p-3 rounded-2xl border border-[#F87A9E]/20">
                  <div className="text-[10px] font-bold text-[#E11D48] uppercase flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    Pending Payment
                  </div>
                  <div className="text-lg font-black text-[#E11D48] mt-0.5">
                    {rawTransactionsData.summary?.pendingBillsCount || 0} Bills
                  </div>
                  <div className="text-[10px] text-[#E11D48] font-semibold">
                    Action required
                  </div>
                </div>

                <div className="bg-[#9B87F5]/10 p-3 rounded-2xl border border-[#9B87F5]/20">
                  <div className="text-[10px] font-bold text-[#9B87F5] uppercase">Total Bill TDS</div>
                  <div className="text-lg font-black text-[#9B87F5] mt-0.5">
                    {formatCurrency(rawTransactionsData.summary?.totalBillTds || 0)}
                  </div>
                  <div className="text-[10px] text-[#6B6580] font-medium">
                    Cumulative TDS
                  </div>
                </div>
              </div>

              {/* Filters */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-3.5 h-3.5 text-[#6B6580] absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={billSearch}
                    onChange={(e) => setBillSearch(e.target.value)}
                    placeholder="Search bill number or date..."
                    className="w-full bg-[#F6F8FA] border border-[#E9E4FA] text-[#1F1B2E] rounded-xl pl-8 pr-3 py-1.5 text-xs font-medium focus:outline-none focus:border-[#9B87F5]"
                  />
                </div>
                <select
                  value={billFilter}
                  onChange={(e) => setBillFilter(e.target.value)}
                  className="bg-[#F6F8FA] border border-[#E9E4FA] text-[#1F1B2E] rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-none focus:border-[#9B87F5] cursor-pointer"
                >
                  <option value="all">All Invoices</option>
                  <option value="paid">Paid / Settled Only</option>
                  <option value="pending">Pending Only</option>
                </select>
              </div>

              {/* Invoices List Table */}
              {filteredBills.length === 0 ? (
                <div className="p-8 text-center bg-[#FAF9FF] rounded-2xl border border-dashed border-[#E9E4FA]">
                  <FileSpreadsheet className="w-8 h-8 text-[#B4A7F5] mx-auto mb-2 opacity-60" />
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
                          <th className="px-3 py-2.5 text-center">Confirm</th>
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
                              <td className="px-3 py-2.5 text-center">
                                <button
                                  type="button"
                                  disabled={isUpdating}
                                  onClick={() => handleToggleBillStatus(b)}
                                  className="p-1 rounded-lg hover:bg-[#E8E4FF] transition cursor-pointer"
                                  title={isPaid ? 'Mark as Pending' : 'Mark as Paid'}
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
                              <td className="px-3 py-2.5 font-bold text-[#1F1B2E]">
                                {b.billNumber || b.invoiceId || 'N/A'}
                              </td>
                              <td className="px-3 py-2.5 text-[#6B6580] font-medium whitespace-nowrap">
                                {b.billDate || '—'}
                              </td>
                              <td className="px-3 py-2.5 text-right font-bold text-[#1F1B2E]">
                                {formatCurrency(b.totalBillAmount)}
                              </td>
                              <td className="px-3 py-2.5 text-right font-black text-[#9B87F5]">
                                {formatCurrency(b.tds)}
                              </td>
                              <td className="px-3 py-2.5 text-right font-semibold text-[#6B6580]">
                                {formatCurrency(b.amountReceived)}
                              </td>
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
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              TAB 3: COMPANY MASTER & TAX INFO
          ═══════════════════════════════════════════════════════════════ */}
          {activeTab === 'company' && (
            <div className="space-y-4">
              {/* Company & Tax Identifiers */}
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

              {/* Client Contact Info */}
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
            </div>
          )}
        </div>

        {/* ══════════════ MODAL FOOTER ══════════════ */}
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
              className="bg-[#9B87F5] hover:bg-[#8572E0] text-white font-extrabold px-6 py-2 rounded-xl transition text-xs flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving Entries...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Reconciliation Changes</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
