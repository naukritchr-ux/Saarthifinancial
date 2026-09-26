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
  AlertTriangle,
  CreditCard,
  Building2,
  Calendar,
  PlusCircle
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { toggleFollowupDone } from '../../api/tdsApi';

export default function ReconciliationTable({ 
  rows, 
  total, 
  page, 
  limit, 
  onPageChange, 
  onEditClick,
  onViewClick,
  onAddToCrmClick,
  onFollowupDoneToggle,
  onFollowupClick
}) {
  const { navigateTo } = useApp();
  const [expandedRow, setExpandedRow] = useState(null);

  const handleToggleFollowupDone = async (row, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (onFollowupDoneToggle) {
      onFollowupDoneToggle(row.id);
    } else {
      try {
        await toggleFollowupDone(row.id);
      } catch (err) {
        console.error('Failed to toggle followup:', err);
      }
    }
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
      minimumFractionDigits: 0
    }).format(Math.round(parseFloat(val || 0)));
  };

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

  const getFinancialStatusPill = (status) => {
    switch (status) {
      case 'Match':
      case 'Matched':
      case 'All Matched':
        return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-[#4ADE80]/15 text-[#2E8B57] border border-[#4ADE80]/30">Match</span>;
      case 'Less':
      case 'Less Paid':
      case 'Less Payment':
        return <span className="px-2.5 py-1 rounded-full text-xs font-black bg-[#FBBF77]/20 text-[#D97706] border border-[#FBBF77]/40">Less Paid</span>;
      case 'Excess':
      case 'Excess Paid':
      case 'Excess Payment':
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
    const hasCrm = Boolean(row?.tdsDuesId || row?.contactPersonName || (row?.companyName && !['Client Entity', 'Unknown Client', 'Unknown Company'].includes(String(row?.companyName).trim())));
    const saarthi = parseFloat(row?.saarthiTds || row?.booksTds || 0) > 0 || hasCrm;

    if (tally && as26 && saarthi) {
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-black border bg-[#4ADE80]/15 text-[#2E8B57] border-[#4ADE80]/30">
          3/3 · All 3
        </span>
      );
    } else if (tally && as26) {
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold border bg-[#B4A7F5]/20 text-[#8572E0] border-[#B4A7F5]/40">
          2/3 · Tally + 26AS
        </span>
      );
    } else if (saarthi && tally) {
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold border bg-[#9B87F5]/15 text-[#9B87F5] border-[#9B87F5]/30">
          2/3 · Saarthi + Tally
        </span>
      );
    } else if (as26 && saarthi) {
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold border bg-indigo-50 text-indigo-700 border-indigo-200">
          2/3 · 26AS + Saarthi
        </span>
      );
    } else {
      const activeName = tally ? 'Tally' : as26 ? '26AS' : saarthi ? 'Saarthi' : 'Single';
      return (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold border bg-[#FBBF77]/20 text-[#D97706] border-[#FBBF77]/40">
          1/3 · {activeName}
        </span>
      );
    }
  };

  const toggleRow = (id) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="bg-white rounded-3xl border border-[#E9E4FA] shadow-xs overflow-hidden mb-6 text-[#1F1B2E]">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-[#E8E4FF]/60 text-[#6B6580] border-b border-[#E9E4FA] font-black uppercase tracking-wider text-[11px]">
              <th className="px-3 py-3.5 text-center"></th>
              <th className="px-4 py-3.5">Company Name</th>
              <th className="px-4 py-3.5">TAN No.</th>
              <th className="px-4 py-3.5">PAN No.</th>
              <th className="px-4 py-3.5">FY</th>
              <th className="px-4 py-3.5 text-right">Tally TDS</th>
              <th className="px-4 py-3.5 text-right">26AS TDS</th>
              <th className="px-4 py-3.5 text-right">Saarthi 360 TDS</th>
              <th className="px-4 py-3.5 text-right">Balance</th>
              <th className="px-4 py-3.5 text-center">Financial Status</th>
              <th className="px-4 py-3.5 text-center">Coverage</th>
              <th className="px-4 py-3.5 text-center">Follow-up</th>
              <th className="px-4 py-3.5 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E9E4FA] font-medium text-[#1F1B2E]">
            {rows.length === 0 ? (
              <tr>
                <td colSpan="13" className="px-6 py-12 text-center text-[#6B6580]">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <AlertCircle className="w-8 h-8 text-[#B4A7F5]" />
                    <span className="font-bold text-[#1F1B2E]">No reconciliation records match the selected filters.</span>
                    <p className="text-xs text-[#6B6580]">Try clearing or adjusting the FY, Company, or PAN filters above.</p>
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const tallyVal = parseFloat(row.tallyTds || 0);
                const as26Val = parseFloat(row.as26Tds || 0);
                const saarthiVal = parseFloat(row.saarthiTds || row.booksTds || 0);
                const fy = row.financialYear || '';
                const isSaarthiEra = isSaarthiEraRow(fy);

                // User Rule:
                // FY 2019-20 to 2025-26: Balance = Tally - 26AS
                // FY 2026-27 onwards: Balance = Saarthi 360 - 26AS
                const baselineVal = isSaarthiEra ? (saarthiVal > 0 ? saarthiVal : tallyVal) : (tallyVal > 0 ? tallyVal : saarthiVal);
                const balance = row.balance !== undefined ? parseFloat(row.balance) : (baselineVal - as26Val);
                const baselineLabel = isSaarthiEra ? 'Saarthi 360' : 'Tally';

                const isShort = balance > 1.0;     // baseline > 26AS (under-deposited)
                const isExcess = balance < -1.0;   // 26AS > baseline (excess deposited)

                const validCompany = row.companyName && !['Client Entity', 'Unknown Client', 'Unknown Company', 'Unassigned Entity'].includes(row.companyName.trim());
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

                      {/* Company Name */}
                      <td className="px-4 py-3.5">
                        <div className="font-extrabold text-[#1F1B2E]">{displayName}</div>
                        <div className="text-[10px] text-[#6B6580] mt-0.5 flex items-center gap-1.5">
                          <span>Bill: {row.billNumber || 'N/A'}</span>
                        </div>
                      </td>

                      {/* TAN */}
                      <td className="px-4 py-3.5 font-mono font-bold text-[#1F1B2E]">
                        {(!row.tanNo || row.tanNo.startsWith('NO_TAN_') || row.tanNo === 'Pending TAN' || row.tanNo === 'Not Available' || row.tanNo.includes('UNKNOWN')) ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            Pending TAN
                          </span>
                        ) : (
                          row.tanNo
                        )}
                      </td>

                      {/* PAN Number */}
                      <td className="px-4 py-3.5 font-mono font-bold text-[#6B6580]">
                        {row.panNo && row.panNo !== 'N/A' && row.panNo !== '' ? (
                          <span className="inline-flex items-center gap-1 text-[#1F1B2E]">
                            <CreditCard className="w-3 h-3 text-[#9B87F5]" />
                            {row.panNo}
                          </span>
                        ) : (
                          <span className="text-gray-400">N/A</span>
                        )}
                      </td>
                      
                      {/* FY */}
                      <td className="px-4 py-3.5 text-[#1F1B2E] font-bold whitespace-nowrap">
                        <span className="px-2 py-0.5 bg-[#F6F8FA] border border-[#E9E4FA] rounded-md">
                          {row.financialYear || 'Unspecified'}
                        </span>
                      </td>

                      {/* Tally TDS */}
                      <td className="px-4 py-3.5 text-right font-bold text-[#9B87F5]">
                        {formatCurrency(row.tallyTds)}
                      </td>

                      {/* 26AS TDS */}
                      <td className="px-4 py-3.5 text-right font-bold text-[#8572E0]">
                        {formatCurrency(row.as26Tds)}
                      </td>

                      {/* Saarthi 360 TDS */}
                      <td className="px-4 py-3.5 text-right font-bold text-[#B4A7F5]">
                        {formatCurrency(row.saarthiTds || row.booksTds)}
                      </td>

                      {/* Dynamic Balance Column: Tally - 26AS (2019-2026) or Saarthi - 26AS (2026-2027+) */}
                      <td className="px-4 py-3.5 text-right font-black">
                        <div className={`inline-flex items-center gap-0.5 ${isShort ? 'text-[#D97706]' : isExcess ? 'text-[#E11D48]' : 'text-[#2E8B57]'}`}>
                          {isShort ? <ArrowUpRight className="w-3.5 h-3.5 flex-shrink-0" /> : isExcess ? <ArrowDownRight className="w-3.5 h-3.5 flex-shrink-0" /> : null}
                          <span>{formatCurrency(balance)}</span>
                        </div>
                        <div className="text-[9px] text-[#6B6580] font-semibold">
                          ({baselineLabel} − 26AS)
                        </div>
                      </td>

                      {/* Financial Status */}
                      <td className="px-4 py-3.5 text-center">
                        <div className="flex flex-col items-center gap-1">
                          {getFinancialStatusPill(row.financialStatus || row.overallStatus)}
                        </div>
                      </td>

                      {/* Source Coverage */}
                      <td className="px-4 py-3.5 text-center">
                        {getCoveragePill(row.sourceCoverage, row)}
                      </td>

                      {/* Follow-up Done Checkbox */}
                      <td className="px-4 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <label
                          onClick={(e) => e.stopPropagation()}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border font-bold transition text-[11px] cursor-pointer shadow-2xs select-none ${
                            Boolean(row.isFollowupDone)
                              ? 'bg-[#4ADE80]/20 text-[#2E8B57] border-[#4ADE80]/50 hover:bg-[#4ADE80]/30'
                              : 'bg-[#F6F8FA] text-[#6B6580] border-[#E9E4FA] hover:bg-[#E8E4FF]'
                          }`}
                          title={Boolean(row.isFollowupDone) ? 'Mark as Pending' : 'Mark Follow-up Done'}
                        >
                          <input
                            type="checkbox"
                            checked={Boolean(row.isFollowupDone)}
                            onChange={(e) => handleToggleFollowupDone(row, e)}
                            className="w-4 h-4 rounded text-[#2E8B57] focus:ring-[#2E8B57] border-gray-300 cursor-pointer accent-[#2E8B57]"
                          />
                          <span>{Boolean(row.isFollowupDone) ? 'Done' : 'Pending'}</span>
                        </label>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => onEditClick(row)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-[#9B87F5] bg-[#9B87F5] text-white hover:bg-[#8572E0] transition cursor-pointer font-bold text-[11px] shadow-xs"
                            title="Edit Record & Multi-entry Records for this Company"
                          >
                            <Wrench className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                          
                          <button
                            onClick={() => onAddToCrmClick && onAddToCrmClick(row)}
                            className="p-1.5 rounded-xl border border-[#E9E4FA] text-[#9B87F5] hover:bg-[#E8E4FF] transition cursor-pointer"
                            title="Book Entry into Saarthi 360 CRM"
                          >
                            <PlusCircle className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => onViewClick && onViewClick(row)}
                            className="p-1.5 rounded-xl border border-[#E9E4FA] text-[#6B6580] hover:bg-[#E8E4FF] transition cursor-pointer"
                            title="View Full Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded Rich Detail Panel */}
                    {isExpanded && (
                      <tr className="bg-[#E8E4FF]/30 border-b border-[#E9E4FA]">
                        <td colSpan="13" className="px-6 py-4">
                          <div className="bg-white p-5 rounded-2xl border border-[#E9E4FA] space-y-4 shadow-sm text-xs">
                            
                            {/* Contact Details Card */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-[10px] font-black uppercase text-[#9B87F5] tracking-wider">
                                <span className="flex items-center gap-1.5">
                                  <User className="w-3.5 h-3.5" />
                                  Client Contact Details
                                </span>
                                <span className="text-[#6B6580]">
                                  TAN: {row.tanNo || 'N/A'} · PAN: {row.panNo || 'N/A'}
                                </span>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="flex items-center gap-2 p-2.5 rounded-xl border border-[#E9E4FA] bg-[#F6F8FA]">
                                  <User className="w-4 h-4 text-[#6B6580] flex-shrink-0" />
                                  <div className="truncate">
                                    <div className="text-[9px] text-[#6B6580] uppercase font-bold">Contact Person</div>
                                    <div className="font-bold text-[#1F1B2E] text-xs truncate">
                                      {row.contactPersonName || 'Not recorded'}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 p-2.5 rounded-xl border border-[#E9E4FA] bg-[#F6F8FA]">
                                  <Phone className="w-4 h-4 text-[#6B6580] flex-shrink-0" />
                                  <div className="truncate">
                                    <div className="text-[9px] text-[#6B6580] uppercase font-bold">Phone Number</div>
                                    <div className="font-bold text-[#1F1B2E] text-xs truncate">
                                      {row.contactNumber || 'Not recorded'}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 p-2.5 rounded-xl border border-[#E9E4FA] bg-[#F6F8FA]">
                                  <Mail className="w-4 h-4 text-[#6B6580] flex-shrink-0" />
                                  <div className="truncate">
                                    <div className="text-[9px] text-[#6B6580] uppercase font-bold">Email ID</div>
                                    <div className="font-bold text-[#1F1B2E] text-xs truncate">
                                      {row.emailId || 'Not recorded'}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Financial Variance Assessment Box */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-1">
                              <div className="md:col-span-1 p-3.5 rounded-xl border flex flex-col justify-between space-y-2 bg-[#F6F8FA] border-[#E9E4FA]">
                                <span className="text-[10px] font-black uppercase text-[#6B6580] tracking-wider">
                                  TDS Balance Rule ({isSaarthiEra ? '2026-27+ Era' : '2019-2026 Era'})
                                </span>
                                <div className="space-y-1">
                                  <span className={`inline-flex items-center gap-1 font-black text-xs ${
                                    Math.abs(balance) <= 1.0 ? 'text-[#2E8B57]' : isShort ? 'text-[#D97706]' : 'text-[#E11D48]'
                                  }`}>
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

                            {/* Panel Footer */}
                            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#E9E4FA]">
                              <span className="text-[11px] text-[#6B6580] font-medium">
                                Last modified: <span className="font-bold text-[#1F1B2E]">{row.updatedAt ? new Date(row.updatedAt).toLocaleString('en-IN') : 'Recently'}</span>
                              </span>

                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => onEditClick(row)}
                                  className="inline-flex items-center gap-1.5 bg-[#9B87F5] hover:bg-[#8572E0] text-white font-extrabold text-xs px-3.5 py-1.5 rounded-xl transition cursor-pointer shadow-xs"
                                >
                                  <Wrench className="w-3.5 h-3.5" />
                                  <span>Edit / Multi-Entry Update</span>
                                </button>
                                
                                <button
                                  onClick={() => {
                                    const cleanTan = (!row.tanNo || row.tanNo.startsWith('NO_TAN_') || row.tanNo.includes('UNKNOWN')) ? '' : row.tanNo;
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

      {/* Pagination Bar */}
      <div className="p-4 border-t border-[#E9E4FA] bg-[#F6F8FA] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="text-[#6B6580] font-medium">
          Showing <span className="font-bold text-[#1F1B2E]">{total === 0 ? 0 : (page - 1) * limit + 1}</span> to{' '}
          <span className="font-bold text-[#1F1B2E]">{Math.min(page * limit, total)}</span> of{' '}
          <span className="font-bold text-[#1F1B2E]">{total}</span> records
        </div>

        <div className="flex items-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="px-3 py-1.5 rounded-xl border border-[#E9E4FA] bg-white text-[#1F1B2E] disabled:opacity-40 font-bold hover:bg-[#E8E4FF] transition cursor-pointer"
          >
            Previous
          </button>
          <span className="font-bold text-[#1F1B2E]">
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="px-3 py-1.5 rounded-xl border border-[#E9E4FA] bg-white text-[#1F1B2E] disabled:opacity-40 font-bold hover:bg-[#E8E4FF] transition cursor-pointer"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
