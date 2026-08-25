import React, { useState } from 'react';
import { Edit2, ChevronDown, ChevronUp, AlertCircle, FileSpreadsheet } from 'lucide-react';

export default function ReconciliationTable({ 
  rows, 
  total, 
  page, 
  limit, 
  onPageChange, 
  onEditClick 
}) {
  const [expandedRow, setExpandedRow] = useState(null);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'All Matched':
      case 'Matched':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-200">Matched</span>;
      case 'Partial Mismatch':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">Partial Mismatch</span>;
      case 'Major Mismatch':
      case 'Not Received':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">{status}</span>;
      case 'Less Paid':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-orange-50 text-orange-700 border border-orange-200">Less Paid</span>;
      case 'Excess':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">Excess</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-gray-50 text-gray-600 border border-gray-200">{status || 'Pending'}</span>;
    }
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(parseFloat(val || 0));
  };

  const toggleRow = (id) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider">
              <th className="px-6 py-4"></th>
              <th className="px-6 py-4">Company / Bill Details</th>
              <th className="px-6 py-4">TAN Number</th>
              <th className="px-6 py-4 text-right">Books TDS (Platform)</th>
              <th className="px-6 py-4 text-right">26AS TDS (Govt)</th>
              <th className="px-6 py-4 text-right">Tally TDS (Accountant)</th>
              <th className="px-6 py-4 text-center">Books vs 26AS</th>
              <th className="px-6 py-4 text-center">Books vs Tally</th>
              <th className="px-6 py-4 text-center">26AS vs Tally</th>
              <th className="px-6 py-4 text-center">Overall Status</th>
              <th className="px-6 py-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 text-sm text-gray-700">
            {rows.length === 0 ? (
              <tr>
                <td colSpan="11" className="px-6 py-12 text-center text-gray-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <AlertCircle className="w-8 h-8 text-gray-300" />
                    <span>No reconciliation records match the selected filters.</span>
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <React.Fragment key={row.id}>
                  {/* Master Row */}
                  <tr 
                    onClick={() => toggleRow(row.id)}
                    className={`cursor-pointer hover:bg-gray-50/50 transition ${expandedRow === row.id ? 'bg-indigo-50/20' : ''}`}
                  >
                    <td className="px-6 py-4 text-center">
                      {expandedRow === row.id ? (
                        <ChevronUp className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900">{row.companyName || 'Unknown Company'}</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        Bill: {row.billNumber || 'N/A'} | Date: {row.billDate ? new Date(row.billDate).toLocaleDateString('en-IN') : 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono font-medium text-xs tracking-wider text-gray-600">{row.tanNo}</td>
                    <td className="px-6 py-4 text-right font-semibold text-gray-900">{formatCurrency(row.booksTds)}</td>
                    <td className="px-6 py-4 text-right font-semibold text-indigo-700">{formatCurrency(row.as26Tds)}</td>
                    <td className="px-6 py-4 text-right font-semibold text-teal-700">{formatCurrency(row.tallyTds)}</td>
                    <td className="px-6 py-4 text-center">{getStatusBadge(row.booksVs26asStatus)}</td>
                    <td className="px-6 py-4 text-center">{getStatusBadge(row.booksVsTallyStatus)}</td>
                    <td className="px-6 py-4 text-center">{getStatusBadge(row.as26VsTallyStatus)}</td>
                    <td className="px-6 py-4 text-center">{getStatusBadge(row.overallStatus)}</td>
                    <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => onEditClick(row)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold hover:bg-gray-50 hover:text-indigo-600 transition"
                      >
                        <Edit2 className="w-3 h-3" />
                        Override
                      </button>
                    </td>
                  </tr>

                  {/* Expanded Detail Panel */}
                  {expandedRow === row.id && (
                    <tr className="bg-gray-50/30">
                      <td colSpan="11" className="px-8 py-4 border-b border-gray-100">
                        <div className="bg-white p-4 rounded-xl border border-gray-100 grid grid-cols-1 md:grid-cols-3 gap-6 shadow-inner">
                          {/* Books vs 26AS */}
                          <div className="flex flex-col gap-2">
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Books vs Form 26AS</span>
                            <div className="flex justify-between items-center bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                              <span className="text-xs font-medium text-gray-600">Comparison Result:</span>
                              {getStatusBadge(row.booksVs26asStatus)}
                            </div>
                            <span className="text-[10px] text-gray-400">
                              Match between Platform Book amount and Government Traces credit.
                            </span>
                          </div>

                          {/* Books vs Tally */}
                          <div className="flex flex-col gap-2">
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Books vs Tally Ledger</span>
                            <div className="flex justify-between items-center bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                              <span className="text-xs font-medium text-gray-600">Comparison Result:</span>
                              {getStatusBadge(row.booksVsTallyStatus)}
                            </div>
                            <span className="text-[10px] text-gray-400">
                              Match between Platform Book amount and Tally system ledger export.
                            </span>
                          </div>

                          {/* 26AS vs Tally */}
                          <div className="flex flex-col gap-2">
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Form 26AS vs Tally Ledger</span>
                            <div className="flex justify-between items-center bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                              <span className="text-xs font-medium text-gray-600">Comparison Result:</span>
                              {getStatusBadge(row.as26VsTallyStatus)}
                            </div>
                            <span className="text-[10px] text-gray-400">
                              Match between Government Traces credits and Tally system ledger.
                            </span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center border-t border-gray-100 bg-gray-50/50 px-6 py-4 text-sm font-medium text-gray-600">
          <div>
            Showing <span className="font-bold text-gray-800">{(page - 1) * limit + 1}</span> to{' '}
            <span className="font-bold text-gray-800">{Math.min(page * limit, total)}</span> of{' '}
            <span className="font-bold text-gray-800">{total}</span> records
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page === 1}
              className="px-3.5 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page === totalPages}
              className="px-3.5 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
