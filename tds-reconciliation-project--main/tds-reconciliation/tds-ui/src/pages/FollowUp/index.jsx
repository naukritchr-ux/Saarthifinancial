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
  RefreshCw
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getFollowups, getFollowupSummary, deleteFollowup, purgeFollowups } from '../../api/tdsApi';
import AddFollowupModal from './AddFollowupModal';

export default function FollowUp() {
  const { followupPreFill, setFollowupPreFill, refreshKey } = useApp();

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

  // Handle pre-fill from Reconciliation table
  useEffect(() => {
    if (followupPreFill) {
      if (followupPreFill.company || followupPreFill.tan) {
        setSearch(followupPreFill.company || followupPreFill.tan);
        setShowAddModal(true);
      }
    }
  }, [followupPreFill]);

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
          responseFilter
        })
      ]);

      if (sumRes && sumRes.success) setSummary(sumRes.data);
      if (listRes && listRes.success) setItems(listRes.data || []);
    } catch (err) {
      console.error('Failed to load follow-up report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedStatuses, dateRange, customStart, customEnd, search, dueOnly, responseFilter, refreshKey]);

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

  const handleDeleteSingle = async (id, companyName) => {
    if (window.confirm(`Are you sure you want to delete follow-up log for "${companyName || 'this client'}"?`)) {
      try {
        const res = await deleteFollowup(id);
        if (res && res.success) {
          loadData();
        }
      } catch (err) {
        console.error('Failed to delete follow-up:', err);
      }
    }
  };

  const handlePurgeAllFollowups = async () => {
    if (window.confirm('Are you sure you want to clear/delete ALL Client Follow-up Call Logs? This will remove previous client call updates.')) {
      try {
        const res = await purgeFollowups();
        if (res && res.success) {
          loadData();
        }
      } catch (err) {
        console.error('Failed to purge follow-ups:', err);
      }
    }
  };

  const handleExportCSV = () => {
    if (items.length === 0) return alert('No follow-up items to export');
    const headers = ['Company', 'TAN', 'Contact Person', 'Department', 'Contact Number', 'Method', 'Status', 'Notes', 'Last Followup', 'Next Followup'];
    const csvLines = [headers.join(',')];

    items.forEach(row => {
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

    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tds_followup_report.csv`;
    link.click();
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

  const filteredEntries = items.filter(row => {
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

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-[#E9E4FA] shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-[#1F1B2E] tracking-tight flex items-center gap-2">
            <PhoneCall className="w-7 h-7 text-[#9B87F5]" />
            Client TDS Follow-up Tracker
          </h1>
          <p className="text-xs text-[#6B6580] mt-1">
            Log client outreach, track missing Form 26AS certificate statuses, and manage follow-up schedules.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              loadData();
            }}
            className="inline-flex items-center gap-2 bg-[#E8E4FF] hover:bg-[#E9E4FA] text-[#1F1B2E] font-bold px-3.5 py-2.5 rounded-xl transition text-xs border border-[#E9E4FA] cursor-pointer shadow-2xs"
            title="Refresh follow-up entries from database"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#9B87F5]" />
            Refresh Data
          </button>

          <button
            onClick={() => { setItemToEdit(null); setShowAddModal(true); }}
            className="inline-flex items-center gap-2 bg-[#9B87F5] hover:bg-[#8572E0] text-white font-bold px-4 py-2.5 rounded-xl transition text-xs shadow-2xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            + Log New Follow-up
          </button>
        </div>
      </div>

      {/* Row 1: Summary Statistics Cards (6 Columns) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-[#F6F8FA] p-3.5 rounded-2xl border border-[#DCE2E8] shadow-2xs text-center">
          <div className="font-bold text-[#3A4048] text-[10px] uppercase">Total Logs</div>
          <div className="text-2xl font-black text-[#3A4048] mt-1">{summary.totalFollowedUp}</div>
        </div>

        <div className="bg-[#F6F8FA] p-3.5 rounded-2xl border border-[#DCE2E8] shadow-2xs text-center">
          <div className="font-bold text-[#C9A778] text-[10px] uppercase">Pending Call</div>
          <div className="text-2xl font-black text-[#735427] mt-1">{summary.pendingResponse}</div>
        </div>

        <div className="bg-[#F6F8FA] p-3.5 rounded-2xl border border-[#DCE2E8] shadow-2xs text-center">
          <div className="font-bold text-[#C08585] text-[10px] uppercase">Call Not Picked Up</div>
          <div className="text-2xl font-black text-[#703535] mt-1">{summary.callNotPickedUp}</div>
        </div>

        <div className="bg-[#F6F8FA] p-3.5 rounded-2xl border border-[#DCE2E8] shadow-2xs text-center">
          <div className="font-bold text-[#6E8CA0] text-[10px] uppercase">Check & Revert</div>
          <div className="text-2xl font-black text-[#6E8CA0] mt-1">{summary.checkAndRevert}</div>
        </div>

        <div className="bg-[#F6F8FA] p-3.5 rounded-2xl border border-[#DCE2E8] shadow-2xs text-center">
          <div className="font-bold text-[#7FA88A] text-[10px] uppercase">TDS Paid</div>
          <div className="text-2xl font-black text-[#3D6348] mt-1">{summary.tdsPaid}</div>
        </div>

        <div className="bg-[#F6F8FA] p-3.5 rounded-2xl border border-[#DCE2E8] shadow-2xs text-center">
          <div className="font-bold text-[#8FA3BF] text-[10px] uppercase">Form Received</div>
          <div className="text-2xl font-black text-[#3E4A5C] mt-1">{summary.formReceived}</div>
        </div>
      </div>

      {/* Filter Row: Status Badges Toggle */}
      <div className="bg-[#F6F8FA] p-4 rounded-2xl border border-[#DCE2E8] shadow-2xs space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-xs font-extrabold text-[#7A8794] uppercase tracking-wider flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-[#6E8CA0]" />
            Filter Log Entries by Status
          </span>
          <span className="text-xs text-[#7A8794] font-semibold">
            Showing <strong className="text-[#3A4048]">{filteredEntries.length}</strong> of {items.length} logs
          </span>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          {statusOptions.map((st) => {
            const isChecked = selectedStatuses.includes(st);
            return (
              <label
                key={st}
                onClick={() => handleStatusToggle(st)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition select-none ${
                  isChecked
                    ? 'bg-[#6E8CA0] text-white border-[#6E8CA0] shadow-xs'
                    : 'bg-white text-[#3A4048] border-[#DCE2E8] hover:bg-[#EEF1F4]'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => {}}
                  className="hidden"
                />
                <span>{st}</span>
              </label>
            );
          })}
          {selectedStatuses.length > 0 && (
            <button
              onClick={() => setSelectedStatuses([])}
              className="text-[11px] font-bold text-red-600 hover:underline ml-2"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Row 3: Search, Date Range Tabs & Controls */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row justify-between items-center gap-4">
          
          {/* Date Range Tabs */}
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-full lg:w-auto text-xs font-bold">
            {[
              { id: 'all', label: 'All Time' },
              { id: 'year', label: 'Current Year' },
              { id: 'quarter', label: 'Current Quarter' },
              { id: 'month', label: 'Current Month' },
              { id: 'custom', label: 'Custom' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setDateRange(tab.id)}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  dateRange === tab.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Custom Date Inputs */}
          {dateRange === 'custom' && (
            <div className="flex items-center gap-2 text-xs">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 font-semibold focus:outline-none focus:border-amber-500"
              />
              <span className="text-gray-400">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 font-semibold focus:outline-none focus:border-amber-500"
              />
            </div>
          )}

          {/* Search & Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-2 w-full lg:w-auto text-xs">
            <form onSubmit={handleSearchSubmit} className="relative flex-grow sm:flex-grow-0 w-full sm:w-60">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search company, TAN, contact..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-3 py-2 text-xs font-medium focus:outline-none focus:border-amber-500"
              />
            </form>

            <button
              onClick={() => setDueOnly(!dueOnly)}
              className={`px-3 py-2 rounded-xl border text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                dueOnly
                  ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-sm'
                  : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              Due Only
            </button>

            <button
              onClick={handleExportCSV}
              className="bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 font-bold px-3.5 py-2 rounded-xl transition text-xs cursor-pointer flex items-center gap-1.5 shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Row 4: Data Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold uppercase tracking-wider text-[11px]">
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">TAN</th>
                <th className="px-4 py-3">Contact Person</th>
                <th className="px-4 py-3">Dept</th>
                <th className="px-4 py-3">Last Follow-up</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3">Next Follow-up</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium text-gray-800">
              {loading ? (
                <tr>
                  <td colSpan="9" className="px-4 py-8 text-center text-gray-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-500" />
                    <span>Loading follow-up records...</span>
                  </td>
                </tr>
              ) : (() => {
                const displayItems = items.filter(row => {
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

                if (displayItems.length === 0) {
                  return (
                    <tr>
                      <td colSpan="9" className="px-4 py-12 text-center text-gray-400">
                        <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                        <span className="font-bold text-gray-700 block text-base">No Follow-up Entries Found</span>
                        <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                          No items match the selected filters. You can log a new outreach entry or restore the default follow-up tracker entries.
                        </p>
                        <div className="flex justify-center items-center gap-3 mt-4">
                          <button
                            onClick={() => {
                              loadData();
                            }}
                            className="inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold px-3.5 py-2 rounded-xl text-xs transition cursor-pointer shadow-sm"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            Refresh Follow-ups
                          </button>
                          <button
                            onClick={() => { setItemToEdit(null); setShowAddModal(true); }}
                            className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-3.5 py-2 rounded-xl text-xs transition cursor-pointer shadow-sm"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            + Log New Follow-up
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                return displayItems.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-gray-900">{row.companyName}</div>
                      {row.notes && <div className="text-[10px] text-gray-400 truncate max-w-xs">{row.notes}</div>}
                    </td>

                    <td className="px-4 py-3.5 font-mono font-bold text-slate-700">{row.tanNo}</td>

                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-gray-800">{row.contactPerson || '—'}</div>
                      {row.contactNumber && <div className="text-[10px] text-gray-400">{row.contactNumber}</div>}
                    </td>

                    <td className="px-4 py-3.5 text-gray-500">{row.department || 'Accounts'}</td>

                    <td className="px-4 py-3.5 text-gray-600">
                      {row.followupDate ? new Date(row.followupDate).toLocaleDateString('en-IN') : '—'}
                    </td>

                    <td className="px-4 py-3.5">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold border border-slate-200">
                        {row.method || 'Call'}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 text-center">{getStatusBadge(row.status)}</td>

                    <td className="px-4 py-3.5">
                      {row.nextFollowupDate ? (
                        <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-[11px]">
                          {new Date(row.nextFollowupDate).toLocaleDateString('en-IN')}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => { setItemToEdit(row); setShowAddModal(true); }}
                          className="p-1.5 rounded-lg border border-gray-200 text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                          title="Edit Follow-up Log"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteSingle(row.id, row.companyName)}
                          className="p-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition cursor-pointer"
                          title="Delete Follow-up Log Entry"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              })()}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {showAddModal && (
        <AddFollowupModal
          itemToEdit={itemToEdit}
          initialData={followupPreFill}
          onClose={() => { setShowAddModal(false); setFollowupPreFill(null); }}
          onSaveSuccess={() => { loadData(); setFollowupPreFill(null); }}
        />
      )}
    </div>
  );
}
