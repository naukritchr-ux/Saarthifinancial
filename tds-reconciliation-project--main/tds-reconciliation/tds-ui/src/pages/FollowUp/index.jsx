import React, { useState, useEffect } from 'react';
import { 
  PhoneCall, 
  Plus, 
  Search, 
  Download, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Filter, 
  Calendar,
  Edit2,
  Trash2,
  RefreshCw,
  X,
  Loader2
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getFollowups, getFollowupSummary, getPendingTdsFollowups, getDashboardSummary, deleteFollowup, purgeFollowups } from '../../api/tdsApi';
import { triggerCsvDownload } from '../../utils/exportUtils';
import AddFollowupModal from './AddFollowupModal';

export default function FollowUp() {
  const { followupPreFill, setFollowupPreFill, refreshKey, fyFilter } = useApp();

  const [summary, setSummary] = useState({
    totalFollowedUp: 0,
    pendingResponse: 0,
    callNotPickedUp: 0,
    checkAndRevert: 0,
    tdsPaid: 0,
    formReceived: 0,
    dueForFollowup: 0
  });

  const [items, setItems] = useState([]);
  const [pendingTds, setPendingTds] = useState([]);
  const [financialTotals, setFinancialTotals] = useState({ tally: 0, as26: 0, saarthi: 0, netGap: 0 });
  const [pendingPage, setPendingPage] = useState(1);
  const PENDING_PAGE_SIZE = 10;
  const [pendingLoading, setPendingLoading] = useState(false);
  const [pendingError, setPendingError] = useState('');
  const [pendingModalData, setPendingModalData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [dateRange, setDateRange] = useState('all'); // 'all', 'year', 'quarter', 'month', 'custom'
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [search, setSearch] = useState('');
  const [responseFilter, setResponseFilter] = useState('');
  const [dueOnly, setDueOnly] = useState(false);

  // Modal controls
  const [showAddModal, setShowAddModal] = useState(false);
  const [itemToEdit, setItemToEdit] = useState(null);

  const standardStatusOptions = [
    'Call Not Picked Up',
    'Call Tomorrow',
    'HR Left',
    'Form Received',
    'TDS Paid',
    'Check & Revert',
    'Mailed',
    'Mail Reply'
  ];

  const statusOptions = React.useMemo(() => {
    const list = Array.isArray(items) ? items : [];
    const customList = list
      .map(i => i?.status)
      .filter(st => st && !standardStatusOptions.includes(st));
    return [...standardStatusOptions, ...Array.from(new Set(customList))];
  }, [items]);

  // Handle pre-fill from Reconciliation table
  useEffect(() => {
    if (followupPreFill) {
      if (followupPreFill.company || followupPreFill.tan) {
        setSearch(followupPreFill.company || followupPreFill.tan);
        setShowAddModal(true);
      }
    }
  }, [followupPreFill]);

  // Delete / Purge confirmation states
  const [deleteConfirmItem, setDeleteConfirmItem] = useState(null);
  const [purgeConfirmOpen, setPurgeConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState(null);

  // Auto-dismiss toast
  useEffect(() => {
    if (feedbackToast) {
      const timer = setTimeout(() => setFeedbackToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [feedbackToast]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sumRes, listRes] = await Promise.all([
        getFollowupSummary(),
        getFollowups({
          status: selectedStatuses,
          dateRange,
          startDate: customStart,
          endDate: customEnd,
          search,
          dueOnly: dueOnly ? 'true' : 'false',
          responseFilter,
          fy: fyFilter && fyFilter !== 'All Financial Years' ? fyFilter : ''
        })
      ]);

      if (sumRes && sumRes.success && sumRes.data) setSummary(sumRes.data);
      if (listRes && listRes.success && Array.isArray(listRes.data)) {
        setItems(listRes.data);
      } else if (Array.isArray(listRes)) {
        setItems(listRes);
      } else {
        setItems([]);
      }
    } catch (err) {
      console.error('Failed to load follow-up report:', err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const loadPendingTds = async () => {
    setPendingLoading(true);
    setPendingError('');
    try {
      const selectedFy = fyFilter && fyFilter !== 'All Financial Years' ? fyFilter : '';
      const [res, dashboardRes] = await Promise.all([
        getPendingTdsFollowups(selectedFy),
        getDashboardSummary(selectedFy)
      ]);
      if (dashboardRes?.success && dashboardRes.totals) setFinancialTotals(dashboardRes.totals);
      if (res?.success && Array.isArray(res.data)) {
        setPendingTds(res.data.filter((row) => ['Less Paid', 'Not Received'].includes(row.status)));
        setPendingPage(1);
      } else {
        setPendingTds([]);
        setPendingError(res?.error || 'Unable to load pending TDS reconciliation records.');
      }
    } catch (err) {
      console.error('Failed to load pending TDS follow-up queue:', err);
      setPendingTds([]);
      setPendingError(err.message || 'Network error while loading pending TDS records.');
    } finally {
      setPendingLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    loadPendingTds();
  }, [selectedStatuses, dateRange, customStart, customEnd, search, dueOnly, responseFilter, refreshKey, fyFilter]);

  const handleStatusToggle = (st) => {
    if (selectedStatuses.includes(st)) {
      setSelectedStatuses(selectedStatuses.filter(s => s !== st));
    } else {
      setSelectedStatuses([...selectedStatuses, st]);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadData();
  };

  const handleDeleteConfirmed = async () => {
    if (!deleteConfirmItem) return;
    const { id, companyName } = deleteConfirmItem;
    setIsDeleting(true);
    try {
      // Optimistic UI update
      setItems(prev => prev.filter(item => item.id !== id));
      const res = await deleteFollowup(id);
      if (!res || res.success === false) {
        setFeedbackToast({ type: 'error', text: res?.error || 'Failed to delete follow-up log entry' });
        loadData();
      } else {
        setFeedbackToast({ type: 'success', text: `Deleted follow-up log for ${companyName || 'client'}` });
        setDeleteConfirmItem(null);
        loadData();
      }
    } catch (err) {
      console.error('Failed to delete follow-up:', err);
      setFeedbackToast({ type: 'error', text: 'Network error deleting follow-up entry.' });
      loadData();
    } finally {
      setIsDeleting(false);
      setDeleteConfirmItem(null);
    }
  };

  const handlePurgeConfirmed = async () => {
    setIsDeleting(true);
    try {
      setItems([]);
      const res = await purgeFollowups();
      if (res && res.success) {
        setFeedbackToast({ type: 'success', text: 'All follow-up logs have been cleared successfully.' });
        setPurgeConfirmOpen(false);
        loadData();
      } else {
        setFeedbackToast({ type: 'error', text: res?.error || 'Failed to clear follow-ups' });
        loadData();
      }
    } catch (err) {
      console.error('Failed to purge follow-ups:', err);
      setFeedbackToast({ type: 'error', text: 'Network error clearing follow-up logs.' });
      loadData();
    } finally {
      setIsDeleting(false);
      setPurgeConfirmOpen(false);
    }
  };

  const handleExportCSV = () => {
    if (filteredEntries.length === 0) return alert('No follow-up items to export (check your active filters)');
    const headers = ['Company', 'TAN', 'Contact Person', 'Department', 'Contact Number', 'Method', 'Status', 'Notes', 'Last Followup', 'Next Followup'];
    const csvLines = [headers.join(',')];

    filteredEntries.forEach(row => {
      csvLines.push([
        `"${(row.companyName || '').replace(/"/g, '""')}"`,
        `"${row.tanNo || ''}"`,
        `"${row.contactPerson || ''}"`,
        `"${row.department || ''}"`,
        `"${row.contactNumber || ''}"`,
        `"${row.method || ''}"`,
        `"${row.status || ''}"`,
        `"${(row.notes || '').replace(/"/g, '""')}"`,
        `"${row.followupDate || ''}"`,
        `"${row.nextFollowupDate || ''}"`
      ].join(','));
    });

    const csvContent = '\uFEFF' + csvLines.join('\n');
    const filename = `tds_followup_report_${new Date().toISOString().slice(0, 10)}.csv`;
    triggerCsvDownload(filename, csvContent);
  };

  const getStatusBadge = (st) => {
    switch (st) {
      case 'TDS Paid':
      case 'Form Received':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#4ADE80]/15 text-[#2E8B57] border border-[#4ADE80]/30">{st}</span>;
      case 'Check & Revert':
      case 'Mail Reply':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#9B87F5]/15 text-[#9B87F5] border border-[#9B87F5]/30">{st}</span>;
      case 'Call Tomorrow':
      case 'Mailed':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#FBBF77]/15 text-[#D97706] border border-[#FBBF77]/30">{st}</span>;
      case 'Call Not Picked Up':
      case 'HR Left':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#F87A9E]/15 text-[#E11D48] border border-[#F87A9E]/30">{st}</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#E8E4FF] text-[#1F1B2E] border border-[#E9E4FA]">{st}</span>;
    }
  };

  const filteredEntries = (Array.isArray(items) ? items : []).filter(row => {
    if (!row) return false;
    if (selectedStatuses.length > 0 && !selectedStatuses.includes(row.status)) return false;
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      const matchCompany = (row.companyName || '').toLowerCase().includes(q);
      const matchTan = (row.tanNo || '').toLowerCase().includes(q);
      const matchPerson = (row.contactPerson || '').toLowerCase().includes(q);
      const matchDept = (row.department || '').toLowerCase().includes(q);
      if (!matchCompany && !matchTan && !matchPerson && !matchDept) return false;
    }
    if (responseFilter === 'responded') {
      if (!['TDS Paid', 'Form Received', 'Check & Revert', 'Mail Reply'].includes(row.status)) return false;
    } else if (responseFilter === 'no_response') {
      if (!['Call Not Picked Up', 'Call Tomorrow', 'HR Left', 'Mailed'].includes(row.status)) return false;
    }
    if (dueOnly) {
      if (['TDS Paid', 'Form Received'].includes(row.status)) return false;
    }
    return true;
  });

  const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  const pendingLessPaid = pendingTds.filter((row) => row.status === 'Less Paid').length;
  const pendingNotReceived = pendingTds.filter((row) => row.status === 'Not Received').length;
  const visiblePendingTds = pendingTds.filter((row) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return [row.companyName, row.tanNo, row.panNo, row.contactPerson, row.contactNumber]
      .some((value) => String(value || '').toLowerCase().includes(q));
  });
  const pendingTotalPages = Math.max(1, Math.ceil(visiblePendingTds.length / PENDING_PAGE_SIZE));
  const safePendingPage = Math.min(pendingPage, pendingTotalPages);
  const paginatedPendingTds = visiblePendingTds.slice((safePendingPage - 1) * PENDING_PAGE_SIZE, safePendingPage * PENDING_PAGE_SIZE);
  const pendingStart = visiblePendingTds.length ? (safePendingPage - 1) * PENDING_PAGE_SIZE + 1 : 0;
  const pendingEnd = Math.min(safePendingPage * PENDING_PAGE_SIZE, visiblePendingTds.length);

  return (
    <div className="space-y-5 animate-fade-in min-w-0">
      {/* The application's existing global header and navigation are rendered by the parent layout. */}

      <section className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 rounded-2xl border border-violet-100 bg-white p-5 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <PhoneCall className="h-6 w-6 text-violet-600" />
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900">Follow-up Report</h1>
          </div>
          <p className="mt-1 text-sm text-slate-500">Track pending TDS discrepancies and manage client follow-ups efficiently.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => { loadData(); loadPendingTds(); }} className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-white px-4 py-2.5 text-sm font-bold text-violet-700 hover:bg-violet-50">
            <RefreshCw className={`h-4 w-4 ${pendingLoading || loading ? 'animate-spin' : ''}`} /> Refresh Data
          </button>
          <button onClick={() => { setItemToEdit(null); setPendingModalData(null); setShowAddModal(true); }} className="inline-flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-violet-800">
            <Plus className="h-4 w-4" /> Log New Follow-up
          </button>
        </div>
      </section>

      {/* Same three-source financial summary used on Reconciliation page */}
      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {[
          { label: 'Tally Ledger TDS', value: financialTotals.tally, icon: 'T' },
          { label: 'Form 26AS Portal TDS', value: financialTotals.as26, icon: '26AS' },
          { label: 'Saarthi 360 CRM TDS', value: financialTotals.saarthi, icon: 'S' }
        ].map((card) => (
          <div key={card.label} className="rounded-2xl border border-violet-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">{card.label}</p>
              <span className="rounded-lg bg-violet-50 px-2.5 py-1 text-xs font-black text-violet-700">{card.icon}</span>
            </div>
            <p className="mt-2 text-2xl font-black tracking-tight text-slate-900">{money(card.value)}</p>
          </div>
        ))}
      </section>

      {/* Pending reconciliation summary */}
      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <button onClick={() => setResponseFilter('')} className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-5 text-left shadow-sm transition hover:-translate-y-0.5">
          <div className="flex items-center justify-between"><span className="text-sm font-bold text-amber-800">Less Paid</span><AlertCircle className="h-6 w-6 text-amber-600" /></div>
          <div className="mt-2 text-3xl font-black text-amber-950">{pendingLessPaid}</div>
          <p className="mt-1 text-xs text-amber-800">Primary TDS is higher than 26AS TDS</p>
        </button>
        <button onClick={() => setResponseFilter('')} className="rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50 to-red-50 p-5 text-left shadow-sm transition hover:-translate-y-0.5">
          <div className="flex items-center justify-between"><span className="text-sm font-bold text-rose-800">Not Received</span><AlertCircle className="h-6 w-6 text-rose-600" /></div>
          <div className="mt-2 text-3xl font-black text-rose-950">{pendingNotReceived}</div>
          <p className="mt-1 text-xs text-rose-800">Primary TDS exists but no 26AS credit is found</p>
        </button>
        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50 p-5 shadow-sm">
          <div className="flex items-center justify-between"><span className="text-sm font-bold text-emerald-800">Follow-up Logs</span><CheckCircle2 className="h-6 w-6 text-emerald-600" /></div>
          <div className="mt-2 text-3xl font-black text-emerald-950">{Number(summary.totalFollowedUp || 0)}</div>
          <p className="mt-1 text-xs text-emerald-800">Client communication entries recorded</p>
        </div>
      </section>

      {/* Pending TDS records */}
      <section className="overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-violet-100 bg-gradient-to-r from-violet-700 to-indigo-600 px-5 py-4 text-white sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-extrabold">Pending TDS Follow-up</h2>
            <p className="mt-0.5 text-xs text-violet-100">Automatically loaded from reconciliation results · {visiblePendingTds.length} records</p>
          </div>
          <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold">Less Paid + Not Received only</span>
        </div>

        <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/70 p-4 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPendingPage(1); }} placeholder="Search company, TAN, PAN or contact..." className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
            <span className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">Less Paid: {pendingLessPaid}</span>
            <span className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-800">Not Received: {pendingNotReceived}</span>
          </div>
        </div>

        {pendingLoading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin text-violet-600" /> Loading reconciliation records...</div>
        ) : pendingError ? (
          <div className="px-4 py-10 text-center">
            <AlertCircle className="mx-auto h-8 w-8 text-rose-500" />
            <p className="mt-2 font-bold text-rose-700">Could not load pending TDS records</p>
            <p className="mt-1 text-xs text-slate-500">{pendingError}</p>
            <button onClick={loadPendingTds} className="mt-3 rounded-lg bg-violet-700 px-4 py-2 text-xs font-bold text-white hover:bg-violet-800">Try Again</button>
          </div>
        ) : visiblePendingTds.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-500" />
            <p className="mt-2 font-bold text-slate-800">{pendingTds.length === 0 ? 'No Less Paid or Not Received records found' : 'No records match your search'}</p>
            <p className="mt-1 text-xs text-slate-500">{pendingTds.length === 0 ? 'The selected financial year currently has no outstanding TDS discrepancies.' : 'Try searching with another company name, TAN or PAN.'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1120px] w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                <tr>{['Company Name','TAN','PAN','Financial Year','Tally TDS','26AS TDS','Saarthi 360 TDS','Primary TDS','Difference','Status','Contact Person','Contact No.','Action'].map((heading) => <th key={heading} className="whitespace-nowrap px-3 py-3 font-extrabold">{heading}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedPendingTds.map((row, index) => (
                  <tr key={`${row.tanNo || 'tan'}-${row.financialYear || 'fy'}-${index}`} className="hover:bg-violet-50/40">
                    <td className="whitespace-nowrap px-3 py-3 font-bold text-slate-800">{row.companyName || '—'}</td>
                    <td className="whitespace-nowrap px-3 py-3 font-mono">{row.tanNo || '—'}</td>
                    <td className="whitespace-nowrap px-3 py-3 font-mono">{row.panNo || '—'}</td>
                    <td className="whitespace-nowrap px-3 py-3">{row.financialYear || '—'}</td>
                    <td className="whitespace-nowrap px-3 py-3">{money(row.tallyTds)}</td>
                    <td className="whitespace-nowrap px-3 py-3">{money(row.as26Tds)}</td>
                    <td className="whitespace-nowrap px-3 py-3 font-semibold text-violet-700">{money(row.saarthiTds)}</td>
                    <td className="whitespace-nowrap px-3 py-3">{money(row.primaryTds)}</td>
                    <td className="whitespace-nowrap px-3 py-3 font-extrabold text-rose-700">{money(row.difference)}</td>
                    <td className="px-3 py-3"><span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-extrabold ${row.status === 'Not Received' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'}`}>{row.status}</span></td>
                    <td className="whitespace-nowrap px-3 py-3">{row.contactPerson || '—'}</td>
                    <td className="whitespace-nowrap px-3 py-3">{row.contactNumber || '—'}</td>
                    <td className="px-3 py-3"><button onClick={() => { setItemToEdit(null); setPendingModalData({ company: row.companyName || '', tan: row.tanNo || '', contactPerson: row.contactPerson || '', contactNumber: row.contactNumber || '' }); setShowAddModal(true); }} className="whitespace-nowrap rounded-lg bg-violet-700 px-3 py-2 font-bold text-white hover:bg-violet-800"><PhoneCall className="mr-1 inline h-3.5 w-3.5" /> Log Follow-up</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!pendingLoading && !pendingError && visiblePendingTds.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-medium text-slate-600">Showing {pendingStart}–{pendingEnd} of {visiblePendingTds.length} records</p>
            <div className="flex items-center gap-2">
              <button type="button" disabled={safePendingPage <= 1} onClick={() => setPendingPage((page) => Math.max(1, page - 1))} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
              <span className="min-w-[90px] text-center text-xs font-bold text-slate-700">Page {safePendingPage} of {pendingTotalPages}</span>
              <button type="button" disabled={safePendingPage >= pendingTotalPages} onClick={() => setPendingPage((page) => Math.min(pendingTotalPages, page + 1))} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </section>

      {/* Follow-up communication metrics */}
      <section>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-base font-extrabold text-slate-900">Follow-up Summary</h2>
          <span className="text-xs text-slate-500">Based on saved communication logs</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {[
            { label: 'Total Logs', value: summary.totalFollowedUp, color: 'blue' },
            { label: 'Pending Call', value: summary.pendingResponse, color: 'violet' },
            { label: 'Call Not Picked Up', value: summary.callNotPickedUp, color: 'amber' },
            { label: 'Check & Revert', value: summary.checkAndRevert, color: 'indigo' },
            { label: 'TDS Paid', value: summary.tdsPaid, color: 'emerald' },
            { label: 'Form Received', value: summary.formReceived, color: 'sky' }
          ].map((card) => (
            <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500">{card.label}</p>
              <p className="mt-1 text-2xl font-black text-slate-900">{Number(card.value || 0)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Follow-up history */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">Follow-up History</h2>
            <p className="mt-0.5 text-xs text-slate-500">View and manage previous communication with clients</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
              {[{ id: 'all', label: 'All Time' },{ id: 'year', label: 'Current Year' },{ id: 'quarter', label: 'Current Quarter' },{ id: 'month', label: 'Current Month' },{ id: 'custom', label: 'Custom' }].map((tab) => (
                <button key={tab.id} onClick={() => setDateRange(tab.id)} className={`rounded-lg px-2.5 py-1.5 text-[10px] font-bold ${dateRange === tab.id ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>{tab.label}</button>
              ))}
            </div>
            <button onClick={() => setPurgeConfirmOpen(true)} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50"><Trash2 className="h-3.5 w-3.5" /> Clear Logs</button>
            <button onClick={handleExportCSV} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"><Download className="h-3.5 w-3.5" /> Export</button>
          </div>
        </div>

        {dateRange === 'custom' && (
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3 text-xs">
            <Calendar className="h-4 w-4 text-slate-500" />
            <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5" />
            <span className="text-slate-400">to</span>
            <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5" />
          </div>
        )}

        <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/70 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {statusOptions.map((status) => (
              <button key={status} onClick={() => handleStatusToggle(status)} className={`rounded-full border px-3 py-1.5 text-[10px] font-bold ${selectedStatuses.includes(status) ? 'border-violet-700 bg-violet-700 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-violet-300'}`}>{status}</button>
            ))}
            {selectedStatuses.length > 0 && <button onClick={() => setSelectedStatuses([])} className="px-2 text-[10px] font-bold text-rose-600">Clear status</button>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search logs..." className="w-48 rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-xs outline-none focus:border-violet-400" />
            </label>
            <button onClick={() => setDueOnly(!dueOnly)} className={`inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-bold ${dueOnly ? 'border-violet-700 bg-violet-700 text-white' : 'border-slate-200 bg-white text-slate-700'}`}><Clock className="h-3.5 w-3.5" /> Due Only</button>
            <span className="text-[10px] font-semibold text-slate-500">{filteredEntries.length} of {items.length} logs</span>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-slate-500"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-violet-600" />Loading follow-up history...</div>
        ) : filteredEntries.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <CheckCircle2 className="mx-auto h-9 w-9 text-slate-300" />
            <p className="mt-2 font-bold text-slate-800">No Follow-up Entries Found</p>
            <p className="mt-1 text-xs text-slate-500">No saved communication logs match the selected filters.</p>
            <button onClick={() => { setSelectedStatuses([]); setDateRange('all'); setDueOnly(false); setSearch(''); loadData(); }} className="mt-3 rounded-lg bg-violet-700 px-4 py-2 text-xs font-bold text-white hover:bg-violet-800">Reset Filters</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[950px] w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                <tr>{['Company','TAN','Contact Person','Department','Last Follow-up','Method','Status','Next Follow-up','Action'].map((heading) => <th key={heading} className="whitespace-nowrap px-3 py-3 font-extrabold">{heading}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEntries.map((row) => (
                  <tr key={row.id} className="hover:bg-violet-50/40">
                    <td className="px-3 py-3 font-bold text-slate-800">{row.companyName || '—'}</td>
                    <td className="whitespace-nowrap px-3 py-3 font-mono">{row.tanNo || '—'}</td>
                    <td className="whitespace-nowrap px-3 py-3">{row.contactPerson || '—'}{row.contactNumber ? <div className="text-[10px] text-slate-400">{row.contactNumber}</div> : null}</td>
                    <td className="whitespace-nowrap px-3 py-3">{row.department || 'Accounts'}</td>
                    <td className="whitespace-nowrap px-3 py-3">{row.followupDate ? new Date(row.followupDate).toLocaleDateString('en-IN') : '—'}</td>
                    <td className="whitespace-nowrap px-3 py-3">{row.method || '—'}</td>
                    <td className="whitespace-nowrap px-3 py-3"><span className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-bold text-violet-700">{row.status || '—'}</span></td>
                    <td className="whitespace-nowrap px-3 py-3">{row.nextFollowupDate ? new Date(row.nextFollowupDate).toLocaleDateString('en-IN') : '—'}</td>
                    <td className="px-3 py-3"><div className="flex items-center gap-1"><button onClick={() => { setItemToEdit(row); setPendingModalData(null); setShowAddModal(true); }} title="Edit" className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100"><Edit2 className="h-3.5 w-3.5" /></button><button onClick={() => setDeleteConfirmItem({ id: row.id, companyName: row.companyName })} title="Delete" className="rounded-lg border border-rose-200 p-2 text-rose-600 hover:bg-rose-50"><Trash2 className="h-3.5 w-3.5" /></button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {feedbackToast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold shadow-xl ${feedbackToast.type === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
          {feedbackToast.type === 'error' ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
          <span>{feedbackToast.text}</span><button onClick={() => setFeedbackToast(null)}><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {deleteConfirmItem && (
        <div onClick={() => !isDeleting && setDeleteConfirmItem(null)} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="font-extrabold text-slate-900">Delete Follow-up Log?</h3>
            <p className="my-4 text-sm text-slate-600">Permanently delete the follow-up log for <strong>{deleteConfirmItem.companyName || 'this client'}</strong>?</p>
            <div className="flex justify-end gap-2"><button disabled={isDeleting} onClick={() => setDeleteConfirmItem(null)} className="rounded-lg px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100">Cancel</button><button disabled={isDeleting} onClick={handleDeleteConfirmed} className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{isDeleting ? 'Deleting...' : 'Delete Log'}</button></div>
          </div>
        </div>
      )}

      {purgeConfirmOpen && (
        <div onClick={() => !isDeleting && setPurgeConfirmOpen(false)} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="font-extrabold text-rose-700">Clear All Follow-up History?</h3>
            <p className="my-4 rounded-xl bg-rose-50 p-3 text-sm text-slate-700">This will permanently delete all saved client follow-up logs. Pending TDS reconciliation records will not be deleted.</p>
            <div className="flex justify-end gap-2"><button disabled={isDeleting} onClick={() => setPurgeConfirmOpen(false)} className="rounded-lg px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100">Cancel</button><button disabled={isDeleting} onClick={handlePurgeConfirmed} className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{isDeleting ? 'Clearing...' : 'Clear All Logs'}</button></div>
          </div>
        </div>
      )}

      {showAddModal && (
        <AddFollowupModal
          itemToEdit={itemToEdit}
          initialData={pendingModalData || followupPreFill}
          onClose={() => { setShowAddModal(false); setFollowupPreFill(null); setPendingModalData(null); setItemToEdit(null); }}
          onSaveSuccess={() => { loadData(); loadPendingTds(); setFollowupPreFill(null); setPendingModalData(null); setItemToEdit(null); }}
        />
      )}
    </div>
  );
}
