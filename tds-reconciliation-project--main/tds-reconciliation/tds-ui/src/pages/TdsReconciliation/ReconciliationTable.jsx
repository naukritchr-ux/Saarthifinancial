import React, { useState } from 'react';
import { 
  ChevronDown, 
  ChevronUp, 
  AlertCircle, 
  PhoneCall, 
  Edit2, 
  Eye, 
  Wrench,
  ArrowDownRight,
  ArrowUpRight
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function ReconciliationTable({ 
  rows, 
  total, 
  page, 
  limit, 
  onPageChange, 
  onEditClick,
  onViewClick
}) {
  const { navigateTo } = useApp();
  const [expandedRow, setExpandedRow] = useState(null);

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(parseFloat(val || 0));
  };

  const getFinancialStatusPill = (status) => {
    switch (status) {
      case 'Match':
      case 'Matched':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Match</span>;
      case 'Less':
      case 'Less Paid':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">Less</span>;
      case 'Excess':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-orange-50 text-orange-700 border border-orange-200">Excess</span>;
      case 'Missing':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600 border border-gray-200">Missing</span>;
      case 'Pending Review':
      case 'Partial Mismatch':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">Pending Review</span>;
      case 'Resolved':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">Resolved</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-gray-50 text-gray-600 border border-gray-200">{status || 'Pending'}</span>;
    }
  };

  const getCoveragePill = (coverage, row) => {
    const tally = parseFloat(row?.tallyTds || 0) > 0;
    const as26 = parseFloat(row?.as26Tds || 0) > 0;
    const saarthi = parseFloat(row?.saarthiTds || row?.booksTds || 0) > 0 || (row?.tdsDuesId ? true : false);

    if (tally && as26 && saarthi) {
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold border bg-emerald-50 text-emerald-700 border-emerald-200">
          3/3 · All 3 (Saarthi + Tally + 26AS)
        </span>
      );
    } else if (saarthi && tally) {
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold border bg-blue-50 text-blue-700 border-blue-200">
          2/3 · Saarthi + Tally
        </span>
      );
    } else if (tally && as26) {
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold border bg-teal-50 text-teal-700 border-teal-200">
          2/3 · Tally + 26AS
        </span>
      );
    } else if (as26 && saarthi) {
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold border bg-indigo-50 text-indigo-700 border-indigo-200">
          2/3 · 26AS + Saarthi
        </span>
      );
    } else {
      const activeName = saarthi ? 'Saarthi' : tally ? 'Tally' : as26 ? '26AS' : 'Single';
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold border bg-orange-50 text-orange-700 border-orange-200">
          1/3 · {activeName} Only
        </span>
      );
    }
  };

  const toggleRow = (id) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-6">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-900 text-white border-b border-slate-800 font-bold uppercase tracking-wider">
              <th className="px-4 py-3 text-center"></th>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">TAN</th>
              <th className="px-4 py-3">FY</th>
              <th className="px-4 py-3 text-right">Tally TDS</th>
              <th className="px-4 py-3 text-right">26AS TDS</th>
              <th className="px-4 py-3 text-right">Saarthi TDS</th>
              <th className="px-4 py-3 text-right">Difference (Tally - 26AS)</th>
              <th className="px-4 py-3 text-center">Financial Status</th>
              <th className="px-4 py-3 text-center">Source Coverage</th>
              <th className="px-4 py-3 text-center">Follow-up</th>
              <th className="px-4 py-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 font-medium text-gray-800">
            {rows.length === 0 ? (
              <tr>
                <td colSpan="12" className="px-6 py-12 text-center text-gray-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <AlertCircle className="w-8 h-8 text-gray-300" />
                    <span>No reconciliation records match the selected filters.</span>
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                // Difference: Strictly (Tally TDS - 26AS TDS)
                const tallyVal = parseFloat(row.tallyTds || 0);
                const as26Val = parseFloat(row.as26Tds || 0);
                const diff = tallyVal - as26Val;
                const isShort = diff < 0;

                // Company Name Fallback: NEVER show "Client Entity" or "Unknown Client"
                const validCompany = row.companyName && !['Client Entity', 'Unknown Client', 'Unknown Company'].includes(row.companyName.trim());
                const displayName = validCompany 
                  ? row.companyName 
                  : (row.tallyPartyName || row.as26DeductorName || row.deductorName || row.partyName || 'Company Name Not Specified');

                return (
                  <React.Fragment key={row.id}>
                    {/* Master Row */}
                    <tr 
                      onClick={() => toggleRow(row.id)}
                      className={`cursor-pointer hover:bg-slate-50 transition ${expandedRow === row.id ? 'bg-amber-50/20' : ''}`}
                    >
                      <td className="px-3 py-3.5 text-center">
                        {expandedRow === row.id ? (
                          <ChevronUp className="w-4 h-4 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="font-bold text-gray-900">{displayName}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5">
                          Bill: {row.billNumber || 'N/A'}
                        </div>
                      </td>

                      <td className="px-4 py-3.5 font-mono font-bold text-slate-700">{row.tanNo}</td>
                      
                      <td className="px-4 py-3.5 text-gray-500 font-semibold">{row.financialYear || '2024-25'}</td>

                      <td className="px-4 py-3.5 text-right font-semibold text-teal-700">{formatCurrency(row.tallyTds)}</td>

                      <td className="px-4 py-3.5 text-right font-semibold text-indigo-700">{formatCurrency(row.as26Tds)}</td>

                      <td className="px-4 py-3.5 text-right font-semibold text-purple-700">{formatCurrency(row.saarthiTds || row.booksTds)}</td>

                      {/* Difference: (Tally - 26AS) */}
                      <td className="px-4 py-3.5 text-right font-bold">
                        <div className={`inline-flex items-center gap-0.5 ${isShort ? 'text-red-600' : diff > 0 ? 'text-emerald-600' : 'text-gray-500'}`}>
                          {isShort ? <ArrowDownRight className="w-3.5 h-3.5 flex-shrink-0" /> : diff > 0 ? <ArrowUpRight className="w-3.5 h-3.5 flex-shrink-0" /> : null}
                          <span>{formatCurrency(diff)}</span>
                        </div>
                      </td>

                      {/* Financial Status */}
                      <td className="px-4 py-3.5 text-center">
                        <div className="flex flex-col items-center gap-1">
                          {getFinancialStatusPill(row.financialStatus || row.overallStatus)}
                          {(row.isManuallyEdited === 1 || row.isManuallyEdited === true || row.is_manually_edited === 1) && (
                            <span className="text-[10px] font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                              Resolved
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Source Coverage */}
                      <td className="px-4 py-3.5 text-center">{getCoveragePill(row.sourceCoverage, row)}</td>

                      {/* Follow-up button */}
                      <td className="px-4 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => navigateTo('follow-up', { tan: row.tanNo, company: row.companyName })}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 font-bold hover:bg-amber-100 transition text-[11px] cursor-pointer"
                        >
                          <PhoneCall className="w-3 h-3" />
                          Follow Up
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => onViewClick && onViewClick(row)}
                            className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition cursor-pointer"
                            title="View Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onEditClick(row)}
                            className="p-1.5 rounded-lg border border-gray-200 text-amber-600 hover:bg-amber-50 transition cursor-pointer"
                            title="Clean / Manual Override"
                          >
                            <Wrench className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded Detail Panel */}
                    {expandedRow === row.id && (
                      <tr className="bg-slate-50/40">
                        <td colSpan="12" className="px-8 py-4 border-b border-gray-100">
                          <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-4 shadow-inner text-xs">
                            {/* HR Contact Person & Team Info */}
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 p-3 bg-amber-50/40 rounded-xl border border-amber-200/60 text-slate-800 font-semibold">
                              <div>
                                <span className="block text-[10px] font-bold text-amber-700 uppercase">HR / Contact Person</span>
                                <span className="font-extrabold text-slate-900">{row.contactPersonName || row.contactPerson || 'N/A'}</span>
                              </div>
                              <div>
                                <span className="block text-[10px] font-bold text-amber-700 uppercase">Designation</span>
                                <span>{row.designation || 'HR Manager'}</span>
                              </div>
                              <div>
                                <span className="block text-[10px] font-bold text-amber-700 uppercase">Contact Number</span>
                                <span>{row.contactNumber || 'N/A'}</span>
                              </div>
                              <div>
                                <span className="block text-[10px] font-bold text-amber-700 uppercase">Email / Team Leader</span>
                                <span>{row.emailId || row.teamleader || 'N/A'}</span>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                              <div className="flex flex-col gap-1">
                                <span className="font-bold text-gray-400 uppercase text-[10px]">Saarthi 360 vs 26AS</span>
                                <div className="flex justify-between items-center bg-gray-50 p-2 rounded-lg border border-gray-100">
                                  <span>Status:</span>
                                  <span className="font-bold text-indigo-700">{row.booksVs26asStatus || 'Matched'}</span>
                                </div>
                              </div>

                              <div className="flex flex-col gap-1">
                                <span className="font-bold text-gray-400 uppercase text-[10px]">Saarthi 360 vs Tally</span>
                                <div className="flex justify-between items-center bg-gray-50 p-2 rounded-lg border border-gray-100">
                                  <span>Status:</span>
                                  <span className="font-bold text-teal-700">{row.booksVsTallyStatus || 'Matched'}</span>
                                </div>
                              </div>

                              <div className="flex flex-col gap-1">
                                <span className="font-bold text-gray-400 uppercase text-[10px]">26AS vs Tally</span>
                                <div className="flex justify-between items-center bg-gray-50 p-2 rounded-lg border border-gray-100">
                                  <span>Status:</span>
                                  <span className="font-bold text-purple-700">{row.as26VsTallyStatus || 'Matched'}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center border-t border-gray-100 bg-gray-50/50 px-6 py-4 text-xs font-medium text-gray-600">
          <div>
            Showing <span className="font-bold text-gray-800">{(page - 1) * limit + 1}</span> to{' '}
            <span className="font-bold text-gray-800">{Math.min(page * limit, total)}</span> of{' '}
            <span className="font-bold text-gray-800">{total}</span> records
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page === 1}
              className="px-3.5 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed font-bold cursor-pointer"
            >
              Previous
            </button>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page === totalPages}
              className="px-3.5 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed font-bold cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
