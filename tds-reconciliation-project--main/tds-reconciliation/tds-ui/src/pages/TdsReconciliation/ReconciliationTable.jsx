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

  const getCoveragePill = (coverage) => {
    if (!coverage) return <span className="text-gray-400 text-xs">—</span>;
    const count = coverage.count || `${coverage.sourcesCount || 0}/3`;
    const is3 = count.startsWith('3');
    const is2 = count.startsWith('2');
    const is1 = count.startsWith('1');

    let bgClass = 'bg-gray-100 text-gray-600 border-gray-200';
    if (is3) bgClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    else if (is2) bgClass = 'bg-blue-50 text-blue-700 border-blue-200';
    else if (is1) bgClass = 'bg-orange-50 text-orange-700 border-orange-200';

    return (
      <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${bgClass}`}>
        {coverage.label || `${count} Match`}
      </span>
    );
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
              <th className="px-4 py-3 text-right">Difference</th>
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
                const diff = row.difference !== undefined ? row.difference : ((parseFloat(row.saarthiTds || row.booksTds || 0) || parseFloat(row.tallyTds || 0)) - parseFloat(row.as26Tds || 0));
                const isShort = diff < 0;

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
                        <div className="font-bold text-gray-900">{row.companyName || 'Unknown Company'}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5">
                          Bill: {row.billNumber || 'N/A'}
                        </div>
                      </td>

                      <td className="px-4 py-3.5 font-mono font-bold text-slate-700">{row.tanNo}</td>
                      
                      <td className="px-4 py-3.5 text-gray-500 font-semibold">{row.financialYear || '2024-25'}</td>

                      <td className="px-4 py-3.5 text-right font-semibold text-teal-700">{formatCurrency(row.tallyTds)}</td>

                      <td className="px-4 py-3.5 text-right font-semibold text-indigo-700">{formatCurrency(row.as26Tds)}</td>

                      <td className="px-4 py-3.5 text-right font-semibold text-purple-700">{formatCurrency(row.saarthiTds || row.booksTds)}</td>

                      {/* Difference */}
                      <td className="px-4 py-3.5 text-right font-bold">
                        <div className={`inline-flex items-center gap-0.5 ${isShort ? 'text-red-600' : diff > 0 ? 'text-emerald-600' : 'text-gray-500'}`}>
                          {isShort ? <ArrowDownRight className="w-3.5 h-3.5 flex-shrink-0" /> : diff > 0 ? <ArrowUpRight className="w-3.5 h-3.5 flex-shrink-0" /> : null}
                          <span>{formatCurrency(diff)}</span>
                        </div>
                      </td>

                      {/* Financial Status */}
                      <td className="px-4 py-3.5 text-center">{getFinancialStatusPill(row.financialStatus || row.overallStatus)}</td>

                      {/* Source Coverage */}
                      <td className="px-4 py-3.5 text-center">{getCoveragePill(row.sourceCoverage)}</td>

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
                          <div className="bg-white p-4 rounded-xl border border-gray-200 grid grid-cols-1 md:grid-cols-3 gap-6 shadow-inner text-xs">
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
