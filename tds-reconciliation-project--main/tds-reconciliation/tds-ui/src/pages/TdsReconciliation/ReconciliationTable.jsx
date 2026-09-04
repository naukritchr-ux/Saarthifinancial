import React, { useState } from 'react';
import { 
  ChevronDown, 
  ChevronUp, 
  AlertCircle, 
  PhoneCall, 
  Eye, 
  Wrench,
  ArrowDownRight,
  ArrowUpRight,
  User,
  Mail,
  Phone,
  Briefcase,
  Layers,
  CheckCircle2,
  AlertTriangle
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
      case 'All Matched':
        return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-[#4ADE80]/15 text-[#2E8B57] border border-[#4ADE80]/30">Match</span>;
      case 'Less':
      case 'Less Paid':
        return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-[#FBBF77]/20 text-[#D97706] border border-[#FBBF77]/40">Less Paid</span>;
      case 'Excess':
      case 'Excess Paid':
        return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-[#F87A9E]/15 text-[#E11D48] border border-[#F87A9E]/30">Excess</span>;
      case 'Missing':
      case 'Not Received':
      case 'No Match':
        return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-gray-100 text-gray-700 border border-gray-300">Not Received</span>;
      case 'Pending Review':
      case 'Partial Mismatch':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-[#FBBF77]/20 text-[#D97706] border border-[#FBBF77]/40">Partial Mismatch</span>;
      case 'Resolved':
        return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-[#9B87F5]/20 text-[#9B87F5] border border-[#9B87F5]/30">Resolved</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-gray-50 text-gray-600 border border-gray-200">{status || 'Pending'}</span>;
    }
  };

  const getCoveragePill = (coverage, row) => {
    const tally = parseFloat(row?.tallyTds || 0) > 0;
    const as26 = parseFloat(row?.as26Tds || 0) > 0;
    const saarthi = parseFloat(row?.saarthiTds || row?.booksTds || 0) > 0;

    if (tally && as26 && saarthi) {
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-black border bg-[#4ADE80]/15 text-[#2E8B57] border-[#4ADE80]/30">
          3/3 · All 3 (Saarthi + Tally + 26AS)
        </span>
      );
    } else if (saarthi && tally) {
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold border bg-[#9B87F5]/15 text-[#9B87F5] border-[#9B87F5]/30">
          2/3 · Saarthi + Tally
        </span>
      );
    } else if (tally && as26) {
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold border bg-[#B4A7F5]/20 text-[#8572E0] border-[#B4A7F5]/40">
          2/3 · Tally + 26AS
        </span>
      );
    } else if (as26 && saarthi) {
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold border bg-indigo-50 text-indigo-700 border-indigo-200">
          2/3 · 26AS + Saarthi
        </span>
      );
    } else {
      const activeName = saarthi ? 'Saarthi' : tally ? 'Tally' : as26 ? '26AS' : 'Single';
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold border bg-[#FBBF77]/20 text-[#D97706] border-[#FBBF77]/40">
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
    <div className="bg-white rounded-2xl border border-[#E9E4FA] shadow-xs overflow-hidden mb-6 text-[#1F1B2E]">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-[#E8E4FF]/50 text-[#6B6580] border-b border-[#E9E4FA] font-black uppercase tracking-wider text-[11px]">
              <th className="px-3 py-3 text-center"></th>
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
          <tbody className="divide-y divide-[#E9E4FA] font-medium text-[#1F1B2E]">
            {rows.length === 0 ? (
              <tr>
                <td colSpan="12" className="px-6 py-12 text-center text-[#6B6580]">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <AlertCircle className="w-8 h-8 text-[#B4A7F5]" />
                    <span className="font-bold text-[#1F1B2E]">No reconciliation records match the selected filters.</span>
                    <p className="text-xs text-[#6B6580]">Try clearing the FY or Source Coverage filters.</p>
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const tallyVal = parseFloat(row.tallyTds || 0);
                const as26Val = parseFloat(row.as26Tds || 0);
                const diff = tallyVal - as26Val;
                const isShort = diff < -1.0;
                const isExcess = diff > 1.0;

                const validCompany = row.companyName && !['Client Entity', 'Unknown Client', 'Unknown Company'].includes(row.companyName.trim());
                const displayName = validCompany 
                  ? row.companyName 
                  : (row.tallyPartyName || row.as26DeductorName || row.deductorName || row.partyName || 'Company Name Not Specified');

                const isExpanded = expandedRow === row.id;

                return (
                  <React.Fragment key={row.id}>
                    {/* Master Row */}
                    <tr 
                      onClick={() => toggleRow(row.id)}
                      className={`cursor-pointer hover:bg-[#E8E4FF]/25 transition ${isExpanded ? 'bg-[#E8E4FF]/40 border-l-4 border-l-[#9B87F5]' : ''}`}
                    >
                      <td className="px-3 py-3.5 text-center">
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-[#9B87F5]" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-[#6B6580]" />
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="font-extrabold text-[#1F1B2E]">{displayName}</div>
                        <div className="text-[10px] text-[#6B6580] mt-0.5">
                          Bill: {row.billNumber || 'N/A'}
                        </div>
                      </td>

                      <td className="px-4 py-3.5 font-mono font-bold text-[#1F1B2E]">{row.tanNo}</td>
                      
                      <td className="px-4 py-3.5 text-[#6B6580] font-semibold">{row.financialYear || 'FY 2024-25'}</td>

                      <td className="px-4 py-3.5 text-right font-bold text-[#9B87F5]">{formatCurrency(row.tallyTds)}</td>

                      <td className="px-4 py-3.5 text-right font-bold text-[#8572E0]">{formatCurrency(row.as26Tds)}</td>

                      <td className="px-4 py-3.5 text-right font-bold text-[#B4A7F5]">{formatCurrency(row.saarthiTds || row.booksTds)}</td>

                      {/* Difference: (Tally - 26AS) */}
                      <td className="px-4 py-3.5 text-right font-black">
                        <div className={`inline-flex items-center gap-0.5 ${isShort ? 'text-[#E11D48]' : isExcess ? 'text-[#D97706]' : 'text-[#2E8B57]'}`}>
                          {isShort ? <ArrowDownRight className="w-3.5 h-3.5 flex-shrink-0" /> : isExcess ? <ArrowUpRight className="w-3.5 h-3.5 flex-shrink-0" /> : null}
                          <span>{formatCurrency(diff)}</span>
                        </div>
                      </td>

                      {/* Financial Status */}
                      <td className="px-4 py-3.5 text-center">
                        <div className="flex flex-col items-center gap-1">
                          {getFinancialStatusPill(row.financialStatus || row.overallStatus)}
                          {(row.isManuallyEdited === 1 || row.isManuallyEdited === true || row.is_manually_edited === 1) && (
                            <span className="text-[10px] font-black text-[#9B87F5] bg-[#9B87F5]/10 border border-[#9B87F5]/30 px-2 py-0.5 rounded-full">
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
                          onClick={() => navigateTo('follow-up', { tan: row.tanNo, company: displayName })}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#FBBF77]/20 text-[#D97706] border border-[#FBBF77]/40 font-black hover:bg-[#FBBF77]/30 transition text-[11px] cursor-pointer shadow-2xs"
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
                            className="p-1.5 rounded-lg border border-[#E9E4FA] text-[#6B6580] hover:bg-[#E8E4FF] transition cursor-pointer"
                            title="View Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onEditClick(row)}
                            className="p-1.5 rounded-lg border border-[#E9E4FA] text-[#9B87F5] hover:bg-[#9B87F5]/10 transition cursor-pointer"
                            title="Clean / Manual Override"
                          >
                            <Wrench className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded Rich Detail Panel */}
                    {isExpanded && (
                      <tr className="bg-[#E8E4FF]/30 border-b border-[#E9E4FA]">
                        <td colSpan="12" className="px-6 py-4">
                          <div className="bg-white p-5 rounded-2xl border border-[#E9E4FA] space-y-4 shadow-sm text-xs">
                            
                            {/* HR Contact & Designation Card */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-[10px] font-black uppercase text-[#9B87F5] tracking-wider">
                                <span className="flex items-center gap-1.5">
                                  <User className="w-3.5 h-3.5" />
                                  Client HR & Accounts Leadership Contact Details
                                </span>
                                <span className="text-[#6B6580]">TAN: {row.tanNo}</span>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-4 bg-[#E8E4FF]/30 rounded-xl border border-[#E9E4FA] text-[#1F1B2E]">
                                <div>
                                  <span className="block text-[10px] font-black text-[#6B6580] uppercase tracking-wider mb-0.5">HR / Contact Person</span>
                                  <span className="font-black text-[#1F1B2E] text-xs flex items-center gap-1">
                                    <User className="w-3 h-3 text-[#9B87F5]" />
                                    {row.contactPersonName || 'Not Available'}
                                  </span>
                                </div>
                                <div>
                                  <span className="block text-[10px] font-black text-[#6B6580] uppercase tracking-wider mb-0.5">Designation</span>
                                  <span className="font-bold text-[#1F1B2E] text-xs flex items-center gap-1">
                                    <Briefcase className="w-3 h-3 text-[#9B87F5]" />
                                    {row.designation || 'N/A'}
                                  </span>
                                </div>
                                <div>
                                  <span className="block text-[10px] font-black text-[#6B6580] uppercase tracking-wider mb-0.5">Direct Phone / Mobile</span>
                                  <span className="font-mono font-black text-[#1F1B2E] text-xs flex items-center gap-1">
                                    <Phone className="w-3 h-3 text-[#4ADE80]" />
                                    {row.contactNumber || 'N/A'}
                                  </span>
                                </div>
                                <div>
                                  <span className="block text-[10px] font-black text-[#6B6580] uppercase tracking-wider mb-0.5">Email / Manager</span>
                                  <span className="font-semibold text-[#1F1B2E] text-xs flex items-center gap-1 truncate">
                                    <Mail className="w-3 h-3 text-[#9B87F5]" />
                                    {row.emailId || (row.teamleader || 'N/A')}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Financial Variance Analysis & Sub-statuses */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-1">
                              
                              {/* Excess / Less / Match Summary Box */}
                              <div className="md:col-span-1 p-3.5 rounded-xl border flex flex-col justify-between space-y-2 bg-[#F6F8FA] border-[#E9E4FA]">
                                <span className="text-[10px] font-black uppercase text-[#6B6580] tracking-wider">
                                  TDS Variance Assessment
                                </span>
                                {isShort ? (
                                  <div className="space-y-1">
                                    <span className="inline-flex items-center gap-1 text-[#E11D48] font-black text-xs">
                                      <AlertTriangle className="w-4 h-4 text-[#F87A9E]" />
                                      Less Paid: {formatCurrency(Math.abs(diff))}
                                    </span>
                                    <p className="text-[11px] text-[#6B6580] font-medium leading-tight">
                                      26AS portal deduction is lower than Tally ledger. Client deductor under-deposited tax.
                                    </p>
                                  </div>
                                ) : isExcess ? (
                                  <div className="space-y-1">
                                    <span className="inline-flex items-center gap-1 text-[#D97706] font-black text-xs">
                                      <AlertTriangle className="w-4 h-4 text-[#FBBF77]" />
                                      Excess Deducted: {formatCurrency(diff)}
                                    </span>
                                    <p className="text-[11px] text-[#6B6580] font-medium leading-tight">
                                      26AS portal reflects higher deduction than recorded in Tally ledger.
                                    </p>
                                  </div>
                                ) : (
                                  <div className="space-y-1">
                                    <span className="inline-flex items-center gap-1 text-[#2E8B57] font-black text-xs">
                                      <CheckCircle2 className="w-4 h-4 text-[#4ADE80]" />
                                      Fully Matched (Zero Gap)
                                    </span>
                                    <p className="text-[11px] text-[#6B6580] font-medium leading-tight">
                                      Tally ledger and 26AS portal TDS figures align perfectly.
                                    </p>
                                  </div>
                                )}
                              </div>

                              {/* 3-Way Sub Status Cards */}
                              <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="p-3 rounded-xl border border-[#E9E4FA] bg-white flex flex-col justify-between">
                                  <span className="text-[10px] font-bold text-[#6B6580] uppercase">Saarthi 360 vs 26AS</span>
                                  <div className="font-extrabold text-[#9B87F5] text-xs mt-1">
                                    {row.booksVs26asStatus || 'Matched'}
                                  </div>
                                </div>

                                <div className="p-3 rounded-xl border border-[#E9E4FA] bg-white flex flex-col justify-between">
                                  <span className="text-[10px] font-bold text-[#6B6580] uppercase">Saarthi 360 vs Tally</span>
                                  <div className="font-extrabold text-[#9B87F5] text-xs mt-1">
                                    {row.booksVsTallyStatus || 'Matched'}
                                  </div>
                                </div>

                                <div className="p-3 rounded-xl border border-[#E9E4FA] bg-white flex flex-col justify-between">
                                  <span className="text-[10px] font-bold text-[#6B6580] uppercase">26AS vs Tally</span>
                                  <div className="font-extrabold text-[#8572E0] text-xs mt-1">
                                    {row.as26VsTallyStatus || 'Matched'}
                                  </div>
                                </div>
                              </div>

                            </div>

                            {/* Quick Action Footer inside Expanded Panel */}
                            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#E9E4FA]">
                              <span className="text-[11px] text-[#6B6580] font-medium">
                                Last updated: <span className="font-bold text-[#1F1B2E]">{row.updatedAt ? new Date(row.updatedAt).toLocaleString('en-IN') : 'Recently'}</span>
                              </span>

                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => navigateTo('follow-up', { tan: row.tanNo, company: displayName })}
                                  className="inline-flex items-center gap-1.5 bg-[#9B87F5] hover:bg-[#8572E0] text-white font-bold text-xs px-3.5 py-1.5 rounded-xl transition cursor-pointer shadow-2xs"
                                >
                                  <PhoneCall className="w-3.5 h-3.5" />
                                  Log Follow-up Call
                                </button>
                                <button
                                  onClick={() => onEditClick(row)}
                                  className="inline-flex items-center gap-1.5 bg-white hover:bg-[#E8E4FF] text-[#1F1B2E] border border-[#E9E4FA] font-bold text-xs px-3.5 py-1.5 rounded-xl transition cursor-pointer"
                                >
                                  <Wrench className="w-3.5 h-3.5 text-[#9B87F5]" />
                                  Override / Clean Status
                                </button>
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
        <div className="flex justify-between items-center border-t border-[#E9E4FA] bg-[#E8E4FF]/30 px-6 py-4 text-xs font-medium text-[#6B6580]">
          <div>
            Showing <span className="font-bold text-[#1F1B2E]">{(page - 1) * limit + 1}</span> to{' '}
            <span className="font-bold text-[#1F1B2E]">{Math.min(page * limit, total)}</span> of{' '}
            <span className="font-bold text-[#1F1B2E]">{total}</span> records
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page === 1}
              className="px-3.5 py-1.5 rounded-xl border border-[#E9E4FA] bg-white hover:bg-[#E8E4FF] transition disabled:opacity-50 disabled:cursor-not-allowed font-bold cursor-pointer text-[#1F1B2E]"
            >
              Previous
            </button>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page === totalPages}
              className="px-3.5 py-1.5 rounded-xl border border-[#E9E4FA] bg-white hover:bg-[#E8E4FF] transition disabled:opacity-50 disabled:cursor-not-allowed font-bold cursor-pointer text-[#1F1B2E]"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
