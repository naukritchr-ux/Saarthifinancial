
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

import {
  getFollowups,
  getFollowupSummary,
  getPendingTdsFollowups,
  deleteFollowup,
  purgeFollowups
} from '../../api/tdsApi';

import { triggerCsvDownload } from '../../utils/exportUtils';
import AddFollowupModal from './AddFollowupModal';

export default function FollowUp() {
  const {
    followupPreFill,
    setFollowupPreFill,
    refreshKey,
    fyFilter
  } = useApp();

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

  // Pending TDS filters
  const [pendingPage, setPendingPage] = useState(1);
  const [pendingFyFilter, setPendingFyFilter] = useState('');
  const [pendingCompanyFilter, setPendingCompanyFilter] = useState('');
  const [pendingStatusFilter, setPendingStatusFilter] = useState('');

  const PENDING_PAGE_SIZE = 10;

  const [pendingLoading, setPendingLoading] = useState(false);
  const [pendingError, setPendingError] = useState('');
  const [pendingModalData, setPendingModalData] = useState(null);

  const [loading, setLoading] = useState(true);

  // Follow-up history filters
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [dateRange, setDateRange] = useState('all');
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
      .map(item => item?.status)
      .filter(status =>
        status && !standardStatusOptions.includes(status)
      );

    return [
      ...standardStatusOptions,
      ...Array.from(new Set(customList))
    ];
  }, [items]);

  // Handle pre-fill from Reconciliation table
  useEffect(() => {
    if (followupPreFill) {
      if (followupPreFill.company || followupPreFill.tan) {
        setSearch(
          followupPreFill.company || followupPreFill.tan
        );

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
      const timer = setTimeout(
        () => setFeedbackToast(null),
        4000
      );

      return () => clearTimeout(timer);
    }
  }, [feedbackToast]);

  // Load follow-up history
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
          fy:
            fyFilter && fyFilter !== 'All Financial Years'
              ? fyFilter
              : ''
        })
      ]);

      if (sumRes?.success && sumRes.data) {
        setSummary(sumRes.data);
      }

      if (
        listRes?.success &&
        Array.isArray(listRes.data)
      ) {
        setItems(listRes.data);
      } else if (Array.isArray(listRes)) {
        setItems(listRes);
      } else {
        setItems([]);
      }
    } catch (error) {
      console.error(
        'Failed to load follow-up report:',
        error
      );

      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  // Load pending TDS reconciliation records
  const loadPendingTds = async () => {
    setPendingLoading(true);
    setPendingError('');

    try {
      const selectedFy =
        fyFilter && fyFilter !== 'All Financial Years'
          ? fyFilter
          : '';

      const res = await getPendingTdsFollowups(selectedFy);

      if (
        res?.success &&
        Array.isArray(res.data)
      ) {
        setPendingTds(
          res.data.filter(row =>
            ['Less Paid', 'Not Received'].includes(row.status)
          )
        );

        setPendingPage(1);
      } else {
        setPendingTds([]);

        setPendingError(
          res?.error ||
          'Unable to load pending TDS reconciliation records.'
        );
      }
    } catch (error) {
      console.error(
        'Failed to load pending TDS follow-up queue:',
        error
      );

      setPendingTds([]);

      setPendingError(
        error.message ||
        'Network error while loading pending TDS records.'
      );
    } finally {
      setPendingLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    loadPendingTds();
  }, [
    selectedStatuses,
    dateRange,
    customStart,
    customEnd,
    search,
    dueOnly,
    responseFilter,
    refreshKey,
    fyFilter
  ]);

  const handleStatusToggle = (status) => {
    if (selectedStatuses.includes(status)) {
      setSelectedStatuses(
        selectedStatuses.filter(
          item => item !== status
        )
      );
    } else {
      setSelectedStatuses([
        ...selectedStatuses,
        status
      ]);
    }
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    loadData();
  };

  // Delete follow-up
  const handleDeleteConfirmed = async () => {
    if (!deleteConfirmItem) return;

    const { id, companyName } = deleteConfirmItem;

    setIsDeleting(true);

    try {
      setItems(prev =>
        prev.filter(item => item.id !== id)
      );

      const res = await deleteFollowup(id);

      if (!res || res.success === false) {
        setFeedbackToast({
          type: 'error',
          text:
            res?.error ||
            'Failed to delete follow-up log entry'
        });

        loadData();
      } else {
        setFeedbackToast({
          type: 'success',
          text: `Deleted follow-up log for ${
            companyName || 'client'
          }`
        });

        setDeleteConfirmItem(null);
        loadData();
      }
    } catch (error) {
      console.error(
        'Failed to delete follow-up:',
        error
      );

      setFeedbackToast({
        type: 'error',
        text: 'Network error deleting follow-up entry.'
      });

      loadData();
    } finally {
      setIsDeleting(false);
      setDeleteConfirmItem(null);
    }
  };

  // Clear follow-up history
  const handlePurgeConfirmed = async () => {
    setIsDeleting(true);

    try {
      setItems([]);

      const res = await purgeFollowups();

      if (res && res.success) {
        setFeedbackToast({
          type: 'success',
          text: 'All follow-up logs have been cleared successfully.'
        });

        setPurgeConfirmOpen(false);
        loadData();
      } else {
        setFeedbackToast({
          type: 'error',
          text: res?.error || 'Failed to clear follow-ups'
        });

        loadData();
      }
    } catch (error) {
      console.error(
        'Failed to purge follow-ups:',
        error
      );

      setFeedbackToast({
        type: 'error',
        text: 'Network error clearing follow-up logs.'
      });

      loadData();
    } finally {
      setIsDeleting(false);
      setPurgeConfirmOpen(false);
    }
  };

  // Export follow-up history
  const handleExportCSV = () => {
    if (filteredEntries.length === 0) {
      return alert(
        'No follow-up items to export (check your active filters)'
      );
    }

    const headers = [
      'Company',
      'TAN',
      'Contact Person',
      'Department',
      'Contact Number',
      'Method',
      'Status',
      'Notes',
      'Last Followup',
      'Next Followup'
    ];

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

    const csvContent =
      '\uFEFF' + csvLines.join('\n');

    const filename =
      `tds_followup_report_${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;

    triggerCsvDownload(filename, csvContent);
  };

  // Follow-up history status badge
  const getStatusBadge = (status) => {
    switch (status) {
      case 'TDS Paid':
      case 'Form Received':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#4ADE80]/15 text-[#2E8B57] border border-[#4ADE80]/30">
            {status}
          </span>
        );

      case 'Check & Revert':
      case 'Mail Reply':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#9B87F5]/15 text-[#9B87F5] border border-[#9B87F5]/30">
            {status}
          </span>
        );

      case 'Call Tomorrow':
      case 'Mailed':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#FBBF77]/15 text-[#D97706] border border-[#FBBF77]/30">
            {status}
          </span>
        );

      case 'Call Not Picked Up':
      case 'HR Left':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#F87A9E]/15 text-[#E11D48] border border-[#F87A9E]/30">
            {status}
          </span>
        );

      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#E8E4FF] text-[#1F1B2E] border border-[#E9E4FA]">
            {status}
          </span>
        );
    }
  };

  // Filter saved follow-up history
  const filteredEntries = (
    Array.isArray(items) ? items : []
  ).filter(row => {
    if (!row) return false;

    if (
      selectedStatuses.length > 0 &&
      !selectedStatuses.includes(row.status)
    ) {
      return false;
    }

    if (search.trim()) {
      const query = search.toLowerCase().trim();

      const matchCompany =
        (row.companyName || '').toLowerCase().includes(query);

      const matchTan =
        (row.tanNo || '').toLowerCase().includes(query);

      const matchPerson =
        (row.contactPerson || '').toLowerCase().includes(query);

      const matchDept =
        (row.department || '').toLowerCase().includes(query);

      if (
        !matchCompany &&
        !matchTan &&
        !matchPerson &&
        !matchDept
      ) {
        return false;
      }
    }

    if (responseFilter === 'responded') {
      if (
        ![
          'TDS Paid',
          'Form Received',
          'Check & Revert',
          'Mail Reply'
        ].includes(row.status)
      ) {
        return false;
      }
    } else if (responseFilter === 'no_response') {
      if (
        ![
          'Call Not Picked Up',
          'Call Tomorrow',
          'HR Left',
          'Mailed'
        ].includes(row.status)
      ) {
        return false;
      }
    }

    if (dueOnly) {
      if (
        ['TDS Paid', 'Form Received'].includes(row.status)
      ) {
        return false;
      }
    }

    return true;
  });

  const money = (value) =>
    `₹${Number(value || 0).toLocaleString('en-IN', {
      maximumFractionDigits: 2
    })}`;

  // Pending TDS counts
  const pendingLessPaid = pendingTds.filter(
    row => row.status === 'Less Paid'
  ).length;

  const pendingNotReceived = pendingTds.filter(
    row => row.status === 'Not Received'
  ).length;

  // Dropdown options
  const pendingFinancialYears = [
    ...new Set(
      pendingTds
        .map(row => row.financialYear)
        .filter(Boolean)
    )
  ].sort();

  const pendingCompanies = [
    ...new Set(
      pendingTds
        .map(row => row.companyName)
        .filter(Boolean)
    )
  ].sort((a, b) => a.localeCompare(b));

  // Pending TDS filtering
  const visiblePendingTds = pendingTds.filter(row => {
    if (
      pendingFyFilter &&
      String(row.financialYear || '') !== pendingFyFilter
    ) {
      return false;
    }

    if (
      pendingCompanyFilter &&
      String(row.companyName || '') !== pendingCompanyFilter
    ) {
      return false;
    }

    if (
      pendingStatusFilter &&
      row.status !== pendingStatusFilter
    ) {
      return false;
    }

    if (!search.trim()) return true;

    const query = search.trim().toLowerCase();

    return [
      row.companyName,
      row.tanNo,
      row.panNo,
      row.contactPerson,
      row.contactNumber
    ].some(value =>
      String(value || '').toLowerCase().includes(query)
    );
  });

  // Pagination
  const pendingTotalPages = Math.max(
    1,
    Math.ceil(
      visiblePendingTds.length / PENDING_PAGE_SIZE
    )
  );

  const safePendingPage = Math.min(
    pendingPage,
    pendingTotalPages
  );

  const paginatedPendingTds = visiblePendingTds.slice(
    (safePendingPage - 1) * PENDING_PAGE_SIZE,
    safePendingPage * PENDING_PAGE_SIZE
  );

  const pendingStart = visiblePendingTds.length
    ? (safePendingPage - 1) * PENDING_PAGE_SIZE + 1
    : 0;

  const pendingEnd = Math.min(
    safePendingPage * PENDING_PAGE_SIZE,
    visiblePendingTds.length
  );

  return (
    <div className="space-y-5 animate-fade-in min-w-0">

      {/* Follow-up page heading */}
      <section className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 rounded-[24px] border border-violet-100 bg-white px-6 py-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <PhoneCall className="h-6 w-6 text-violet-600" />

            <h1 className="text-2xl font-black tracking-tight text-slate-900">
              Follow-up Report
            </h1>
          </div>

          <p className="mt-1 text-sm text-slate-500">
            Track pending TDS discrepancies and manage client follow-ups efficiently.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              loadData();
              loadPendingTds();
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-white px-4 py-2.5 text-sm font-bold text-violet-700 hover:bg-violet-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${
                pendingLoading || loading ? 'animate-spin' : ''
              }`}
            />
            Refresh Data
          </button>

          <button
            onClick={() => {
              setItemToEdit(null);
              setPendingModalData(null);
              setShowAddModal(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-violet-800"
          >
            <Plus className="h-4 w-4" />
            Log New Follow-up
          </button>
        </div>
      </section>

      {/* Pending reconciliation summary */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">

        <button
          onClick={() => {
            setPendingStatusFilter('Less Paid');
            setPendingPage(1);
          }}
          className="rounded-[22px] border border-amber-200 bg-[#FFF9ED] p-6 text-left shadow-sm transition hover:-translate-y-0.5"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-amber-800">
              Less Paid
            </span>
            <AlertCircle className="h-6 w-6 text-amber-600" />
          </div>

          <div className="mt-2 text-3xl font-black text-amber-950">
            {pendingLessPaid}
          </div>

          <p className="mt-1 text-xs text-amber-800">
            Primary TDS is higher than 26AS TDS
          </p>
        </button>

        <button
          onClick={() => {
            setPendingStatusFilter('Not Received');
            setPendingPage(1);
          }}
          className="rounded-[22px] border border-rose-200 bg-[#FFF2F3] p-6 text-left shadow-sm transition hover:-translate-y-0.5"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-rose-800">
              Not Received
            </span>
            <AlertCircle className="h-6 w-6 text-rose-600" />
          </div>

          <div className="mt-2 text-3xl font-black text-rose-950">
            {pendingNotReceived}
          </div>

          <p className="mt-1 text-xs text-rose-800">
            Primary TDS exists but no 26AS credit is found
          </p>
        </button>

        <div className="rounded-[22px] border border-emerald-200 bg-[#EFFBF5] p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-emerald-800">
              Follow-up Logs
            </span>
            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
          </div>

          <div className="mt-2 text-3xl font-black text-emerald-950">
            {Number(summary.totalFollowedUp || 0)}
          </div>

          <p className="mt-1 text-xs text-emerald-800">
            Client communication entries recorded
          </p>
        </div>
      </section>

      {/* Pending TDS table */}
      <section className="overflow-hidden rounded-[24px] border border-violet-100 bg-white shadow-sm">

        <div className="flex flex-col gap-2 border-b border-violet-100 bg-gradient-to-r from-violet-700 to-indigo-600 px-6 py-5 text-white sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-extrabold">
              Pending TDS Follow-up
            </h2>

            <p className="mt-0.5 text-xs text-violet-100">
              Automatically loaded from reconciliation results · {visiblePendingTds.length} records
            </p>
          </div>

          <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold">
            Less Paid + Not Received only
          </span>
        </div>

        {/* Search and filters */}
        <div className="space-y-4 border-b border-violet-100 bg-white px-5 py-5">

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-xl">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />

              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPendingPage(1);
                }}
                placeholder="Search across Company Name, TAN, PAN or contact..."
                className="w-full rounded-xl border border-violet-100 bg-[#F7F7FA] py-3 pl-10 pr-3 text-sm text-slate-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
              <span className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-amber-800">
                Less Paid: {pendingLessPaid}
              </span>

              <span className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-rose-800">
                Not Received: {pendingNotReceived}
              </span>
            </div>
          </div>

          {/* Financial Year, Company Name and Status filters */}
          <div className="grid grid-cols-1 gap-3 border-t border-violet-100 pt-4 md:grid-cols-3">

            <label className="block min-w-0">
              <span className="mb-2 flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wide text-slate-600">
                <Calendar className="h-3.5 w-3.5 text-violet-500" />
                Financial Year
              </span>

              <select
                value={pendingFyFilter}
                onChange={(event) => {
                  setPendingFyFilter(event.target.value);
                  setPendingPage(1);
                }}
                className="w-full rounded-xl border border-violet-100 bg-[#F7F7FA] px-3 py-3 text-sm text-slate-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
              >
                <option value="">All Financial Years</option>

                {pendingFinancialYears.map(fy => (
                  <option key={fy} value={fy}>
                    {fy}
                  </option>
                ))}
              </select>
            </label>

            <label className="block min-w-0">
              <span className="mb-2 flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wide text-slate-600">
                <Filter className="h-3.5 w-3.5 text-violet-500" />
                Company Name
              </span>

              <select
                value={pendingCompanyFilter}
                onChange={(event) => {
                  setPendingCompanyFilter(event.target.value);
                  setPendingPage(1);
                }}
                className="w-full rounded-xl border border-violet-100 bg-[#F7F7FA] px-3 py-3 text-sm text-slate-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
              >
                <option value="">All Companies</option>

                {pendingCompanies.map(company => (
                  <option key={company} value={company}>
                    {company}
                  </option>
                ))}
              </select>
            </label>

            <label className="block min-w-0">
              <span className="mb-2 flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wide text-slate-600">
                <AlertCircle className="h-3.5 w-3.5 text-violet-500" />
                Status
              </span>

              <select
                value={pendingStatusFilter}
                onChange={(event) => {
                  setPendingStatusFilter(event.target.value);
                  setPendingPage(1);
                }}
                className="w-full rounded-xl border border-violet-100 bg-[#F7F7FA] px-3 py-3 text-sm text-slate-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
              >
                <option value="">All Pending Statuses</option>
                <option value="Less Paid">Less Paid</option>
                <option value="Not Received">Not Received</option>
              </select>
            </label>
          </div>

          {(pendingFyFilter ||
            pendingCompanyFilter ||
            pendingStatusFilter ||
            search) && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setPendingFyFilter('');
                  setPendingCompanyFilter('');
                  setPendingStatusFilter('');
                  setSearch('');
                  setPendingPage(1);
                }}
                className="text-xs font-bold text-violet-700 hover:text-violet-900"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>

        {/* Pending records */}
        {pendingLoading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin text-violet-600" />
            Loading reconciliation records...
          </div>
        ) : pendingError ? (
          <div className="px-4 py-10 text-center">
            <AlertCircle className="mx-auto h-8 w-8 text-rose-500" />

            <p className="mt-2 font-bold text-rose-700">
              Could not load pending TDS records
            </p>

            <p className="mt-1 text-xs text-slate-500">
              {pendingError}
            </p>

            <button
              onClick={loadPendingTds}
              className="mt-3 rounded-lg bg-violet-700 px-4 py-2 text-xs font-bold text-white hover:bg-violet-800"
            >
              Try Again
            </button>
          </div>
        ) : visiblePendingTds.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-500" />

            <p className="mt-2 font-bold text-slate-800">
              {pendingTds.length === 0
                ? 'No Less Paid or Not Received records found'
                : 'No records match your filters'}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Try changing the financial year, company or status filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1080px] w-full text-left text-xs">
              <thead className="bg-[#F7F7FA] text-[10px] uppercase tracking-wide text-slate-600">
                <tr>
                  {[
                    'Company Name',
                    'TAN',
                    'PAN',
                    'Financial Year',
                    'Tally TDS',
                    '26AS TDS',
                    'Saarthi 360 TDS',
                    'Difference',
                    'Status',
                    'Contact Person',
                    'Contact No.',
                    'Action'
                  ].map(heading => (
                    <th
                      key={heading}
                      className="whitespace-nowrap px-3 py-3 font-extrabold"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {paginatedPendingTds.map((row, index) => (
                  <tr
                    key={`${row.tanNo || 'tan'}-${row.financialYear || 'fy'}-${index}`}
                    className="hover:bg-[#F7F4FF]"
                  >
                    <td className="whitespace-nowrap px-3 py-3 font-bold text-slate-800">
                      {row.companyName || '—'}
                    </td>

                    <td className="whitespace-nowrap px-3 py-3 font-mono">
                      {row.tanNo || '—'}
                    </td>

                    <td className="whitespace-nowrap px-3 py-3 font-mono">
                      {row.panNo || '—'}
                    </td>

                    <td className="whitespace-nowrap px-3 py-3">
                      {row.financialYear || '—'}
                    </td>

                    <td className="whitespace-nowrap px-3 py-3">
                      {money(row.tallyTds)}
                    </td>

                    <td className="whitespace-nowrap px-3 py-3">
                      {money(row.as26Tds)}
                    </td>

                    <td className="whitespace-nowrap px-3 py-3 font-semibold text-violet-700">
                      {money(row.saarthiTds)}
                    </td>

                    <td className="whitespace-nowrap px-3 py-3 font-extrabold text-rose-700">
                      {money(row.difference)}
                    </td>

                    <td className="px-3 py-3">
                      <span
                        className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-extrabold ${
                          row.status === 'Not Received'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>

                    <td className="whitespace-nowrap px-3 py-3">
                      {row.contactPerson || '—'}
                    </td>

                    <td className="whitespace-nowrap px-3 py-3">
                      {row.contactNumber || '—'}
                    </td>

                    <td className="px-3 py-3">
                      <button
                        onClick={() => {
                          setItemToEdit(null);

                          setPendingModalData({
                            company: row.companyName || '',
                            tan: row.tanNo || '',
                            contactPerson: row.contactPerson || '',
                            contactNumber: row.contactNumber || ''
                          });

                          setShowAddModal(true);
                        }}
                        className="whitespace-nowrap rounded-lg bg-violet-700 px-3 py-2 font-bold text-white hover:bg-violet-800"
                      >
                        <PhoneCall className="mr-1 inline h-3.5 w-3.5" />
                        Log Follow-up
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!pendingLoading &&
          !pendingError &&
          visiblePendingTds.length > 0 && (
            <div className="flex flex-col gap-3 border-t border-violet-100 bg-[#F7F7FA] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs font-medium text-slate-600">
                Showing {pendingStart}–{pendingEnd} of {visiblePendingTds.length} records
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={safePendingPage <= 1}
                  onClick={() =>
                    setPendingPage(page =>
                      Math.max(1, page - 1)
                    )
                  }
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>

                <span className="min-w-[90px] text-center text-xs font-bold text-slate-700">
                  Page {safePendingPage} of {pendingTotalPages}
                </span>

                <button
                  type="button"
                  disabled={safePendingPage >= pendingTotalPages}
                  onClick={() =>
                    setPendingPage(page =>
                      Math.min(pendingTotalPages, page + 1)
                    )
                  }
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
      </section>

      {/* Follow-up communication metrics */}
      <section>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-base font-extrabold text-slate-900">
            Follow-up Summary
          </h2>

          <span className="text-xs text-slate-500">
            Based on saved communication logs
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {[
            {
              label: 'Total Logs',
              value: summary.totalFollowedUp,
              color: 'blue'
            },
            {
              label: 'Pending Call',
              value: summary.pendingResponse,
              color: 'violet'
            },
            {
              label: 'Call Not Picked Up',
              value: summary.callNotPickedUp,
              color: 'amber'
            },
            {
              label: 'Check & Revert',
              value: summary.checkAndRevert,
              color: 'indigo'
            },
            {
              label: 'TDS Paid',
              value: summary.tdsPaid,
              color: 'emerald'
            },
            {
              label: 'Form Received',
              value: summary.formReceived,
              color: 'sky'
            }
          ].map(card => (
            <div
              key={card.label}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500">
                {card.label}
              </p>

              <p className="mt-1 text-2xl font-black text-slate-900">
                {Number(card.value || 0)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Follow-up history */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">
              Follow-up History
            </h2>

            <p className="mt-0.5 text-xs text-slate-500">
              View and manage previous communication with clients
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
              {[
                { id: 'all', label: 'All Time' },
                { id: 'year', label: 'Current Year' },
                { id: 'quarter', label: 'Current Quarter' },
                { id: 'month', label: 'Current Month' },
                { id: 'custom', label: 'Custom' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setDateRange(tab.id)}
                  className={`rounded-lg px-2.5 py-1.5 text-[10px] font-bold ${
                    dateRange === tab.id
                      ? 'bg-white text-violet-700 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => setPurgeConfirmOpen(true)}
              className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear Logs
            </button>

            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </button>
          </div>
        </div>

        {dateRange === 'custom' && (
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3 text-xs">
            <Calendar className="h-4 w-4 text-slate-500" />

            <input
              type="date"
              value={customStart}
              onChange={event => setCustomStart(event.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5"
            />

            <span className="text-slate-400">to</span>

            <input
              type="date"
              value={customEnd}
              onChange={event => setCustomEnd(event.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5"
            />
          </div>
        )}

        <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/70 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {statusOptions.map(status => (
              <button
                key={status}
                onClick={() => handleStatusToggle(status)}
                className={`rounded-full border px-3 py-1.5 text-[10px] font-bold ${
                  selectedStatuses.includes(status)
                    ? 'border-violet-700 bg-violet-700 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-violet-300'
                }`}
              >
                {status}
              </button>
            ))}

            {selectedStatuses.length > 0 && (
              <button
                onClick={() => setSelectedStatuses([])}
                className="px-2 text-[10px] font-bold text-rose-600"
              >
                Clear status
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />

              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Search logs..."
                className="w-48 rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-xs outline-none focus:border-violet-400"
              />
            </label>

            <button
              onClick={() => setDueOnly(!dueOnly)}
              className={`inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-bold ${
                dueOnly
                  ? 'border-violet-700 bg-violet-700 text-white'
                  : 'border-slate-200 bg-white text-slate-700'
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              Due Only
            </button>

            <span className="text-[10px] font-semibold text-slate-500">
              {filteredEntries.length} of {items.length} logs
            </span>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-slate-500">
            <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-violet-600" />
            Loading follow-up history...
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <CheckCircle2 className="mx-auto h-9 w-9 text-slate-300" />

            <p className="mt-2 font-bold text-slate-800">
              No Follow-up Entries Found
            </p>

            <p className="mt-1 text-xs text-slate-500">
              No saved communication logs match the selected filters.
            </p>

            <button
              onClick={() => {
                setSelectedStatuses([]);
                setDateRange('all');
                setDueOnly(false);
                setSearch('');
                loadData();
              }}
              className="mt-3 rounded-lg bg-violet-700 px-4 py-2 text-xs font-bold text-white hover:bg-violet-800"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[950px] w-full text-left text-xs">
              <thead className="bg-[#F7F7FA] text-[10px] uppercase tracking-wide text-slate-600">
                <tr>
                  {[
                    'Company',
                    'TAN',
                    'Contact Person',
                    'Department',
                    'Last Follow-up',
                    'Method',
                    'Status',
                    'Next Follow-up',
                    'Action'
                  ].map(heading => (
                    <th
                      key={heading}
                      className="whitespace-nowrap px-3 py-3 font-extrabold"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredEntries.map(row => (
                  <tr
                    key={row.id}
                    className="hover:bg-[#F7F4FF]"
                  >
                    <td className="px-3 py-3 font-bold text-slate-800">
                      {row.companyName || '—'}
                    </td>

                    <td className="whitespace-nowrap px-3 py-3 font-mono">
                      {row.tanNo || '—'}
                    </td>

                    <td className="whitespace-nowrap px-3 py-3">
                      {row.contactPerson || '—'}

                      {row.contactNumber ? (
                        <div className="text-[10px] text-slate-400">
                          {row.contactNumber}
                        </div>
                      ) : null}
                    </td>

                    <td className="whitespace-nowrap px-3 py-3">
                      {row.department || 'Accounts'}
                    </td>

                    <td className="whitespace-nowrap px-3 py-3">
                      {row.followupDate
                        ? new Date(row.followupDate).toLocaleDateString('en-IN')
                        : '—'}
                    </td>

                    <td className="whitespace-nowrap px-3 py-3">
                      {row.method || '—'}
                    </td>

                    <td className="whitespace-nowrap px-3 py-3">
                      {getStatusBadge(row.status || '—')}
                    </td>

                    <td className="whitespace-nowrap px-3 py-3">
                      {row.nextFollowupDate
                        ? new Date(row.nextFollowupDate).toLocaleDateString('en-IN')
                        : '—'}
                    </td>

                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setItemToEdit(row);
                            setPendingModalData(null);
                            setShowAddModal(true);
                          }}
                          title="Edit"
                          className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>

                        <button
                          onClick={() =>
                            setDeleteConfirmItem({
                              id: row.id,
                              companyName: row.companyName
                            })
                          }
                          title="Delete"
                          className="rounded-lg border border-rose-200 p-2 text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Feedback toast */}
      {feedbackToast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold shadow-xl ${
            feedbackToast.type === 'error'
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800'
          }`}
        >
          {feedbackToast.type === 'error' ? (
            <AlertCircle className="h-4 w-4" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}

          <span>{feedbackToast.text}</span>

          <button onClick={() => setFeedbackToast(null)}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteConfirmItem && (
        <div
          onClick={() =>
            !isDeleting && setDeleteConfirmItem(null)
          }
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
        >
          <div
            onClick={event => event.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <h3 className="font-extrabold text-slate-900">
              Delete Follow-up Log?
            </h3>

            <p className="my-4 text-sm text-slate-600">
              Permanently delete the follow-up log for{' '}
              <strong>
                {deleteConfirmItem.companyName || 'this client'}
              </strong>?
            </p>

            <div className="flex justify-end gap-2">
              <button
                disabled={isDeleting}
                onClick={() => setDeleteConfirmItem(null)}
                className="rounded-lg px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>

              <button
                disabled={isDeleting}
                onClick={handleDeleteConfirmed}
                className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete Log'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear history confirmation */}
      {purgeConfirmOpen && (
        <div
          onClick={() =>
            !isDeleting && setPurgeConfirmOpen(false)
          }
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
        >
          <div
            onClick={event => event.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <h3 className="font-extrabold text-rose-700">
              Clear All Follow-up History?
            </h3>

            <p className="my-4 rounded-xl bg-rose-50 p-3 text-sm text-slate-700">
              This will permanently delete all saved client follow-up logs.
              Pending TDS reconciliation records will not be deleted.
            </p>

            <div className="flex justify-end gap-2">
              <button
                disabled={isDeleting}
                onClick={() => setPurgeConfirmOpen(false)}
                className="rounded-lg px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>

              <button
                disabled={isDeleting}
                onClick={handlePurgeConfirmed}
                className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
              >
                {isDeleting ? 'Clearing...' : 'Clear All Logs'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit follow-up modal */}
      {showAddModal && (
        <AddFollowupModal
          itemToEdit={itemToEdit}
          initialData={pendingModalData || followupPreFill}
          onClose={() => {
            setShowAddModal(false);
            setFollowupPreFill(null);
            setPendingModalData(null);
            setItemToEdit(null);
          }}
          onSaveSuccess={() => {
            loadData();
            loadPendingTds();
            setFollowupPreFill(null);
            setPendingModalData(null);
            setItemToEdit(null);
          }}
        />
      )}
    </div>
  );
}
