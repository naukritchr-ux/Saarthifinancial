import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingDown, 
  Layers, 
  PieChart as PieIcon, 
  BarChart3,
  RefreshCw,
  Clock,
  CheckCheck
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getDashboardSummary } from '../../api/tdsApi';

const formatCurrency = (val) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(val || 0);
};

export default function Dashboard() {
  const { fyFilter, refreshKey } = useApp();
  const [data, setData] = useState({
    totals: { tally: 0, as26: 0, saarthi: 0, netGap: 0 },
    recordCount: 0,
    sourceCoverage: { threeOfThree: 0, twoOfThree: 0, oneOfThree: 0, noMatch: 0 },
    financialStatus: { match: 0, less: 0, excess: 0, missing: 0, pendingReview: 0, resolved: 0 }
  });
  const [loading, setLoading] = useState(true);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const res = await getDashboardSummary(fyFilter);
      if (res && res.success && res.totals) {
        setData({
          totals: res.totals || { tally: 0, as26: 0, saarthi: 0, netGap: 0 },
          recordCount: res.recordCount || 0,
          sourceCoverage: res.sourceCoverage || { threeOfThree: 0, twoOfThree: 0, oneOfThree: 0, noMatch: 0 },
          financialStatus: res.financialStatus || { match: 0, less: 0, excess: 0, missing: 0, pendingReview: 0, resolved: 0 }
        });
      }
    } catch (err) {
      console.error('Failed to load dashboard summary:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [fyFilter, refreshKey]);

  // Max value for bar chart height scaling
  const maxBarValue = Math.max(data.totals.tally, data.totals.as26, data.totals.saarthi, 1);

  // Coverage Donut Chart Calculation
  const totalCoverageRecords = (data.sourceCoverage.threeOfThree + data.sourceCoverage.twoOfThree + data.sourceCoverage.oneOfThree + data.sourceCoverage.noMatch) || 1;
  const c3Pct = (data.sourceCoverage.threeOfThree / totalCoverageRecords) * 100;
  const c2Pct = (data.sourceCoverage.twoOfThree / totalCoverageRecords) * 100;
  const c1Pct = (data.sourceCoverage.oneOfThree / totalCoverageRecords) * 100;
  const c0Pct = (data.sourceCoverage.noMatch / totalCoverageRecords) * 100;

  // SVG Donut calculation helpers
  const radius = 65;
  const circumference = 2 * Math.PI * radius;
  const stroke3 = (c3Pct / 100) * circumference;
  const stroke2 = (c2Pct / 100) * circumference;
  const stroke1 = (c1Pct / 100) * circumference;
  const stroke0 = (c0Pct / 100) * circumference;

  const offset3 = 0;
  const offset2 = -stroke3;
  const offset1 = -(stroke3 + stroke2);
  const offset0 = -(stroke3 + stroke2 + stroke1);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl text-[#1F1B2E] shadow-sm border border-[#E9E4FA]">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-[#1F1B2E] flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-[#9B87F5]" />
            Executive TDS Reconciliation Dashboard
          </h1>
          <p className="text-xs text-[#6B6580] mt-1">
            Real-time aggregate snapshot of Form 26AS, Tally Ledgers, and Saarthi 360 Books ({fyFilter})
          </p>
        </div>
        <button
          onClick={fetchSummary}
          className="inline-flex items-center gap-2 bg-[#9B87F5] hover:bg-[#8572E0] text-white font-semibold px-4 py-2 rounded-xl transition text-xs border border-[#9B87F5]/30 cursor-pointer shadow-2xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Data
        </button>
      </div>

      {/* Row 1: Totals Stat Cards (4 Columns) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Tally TDS */}
        <div className="bg-white p-5 rounded-2xl border border-[#E9E4FA] shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-[#6B6580] uppercase tracking-wider">Total TDS — Tally</div>
            <div className="text-2xl font-black text-[#1F1B2E] mt-1">{formatCurrency(data.totals.tally)}</div>
            <div className="text-[11px] text-[#9B87F5] font-medium mt-1">Accountant Ledger Export</div>
          </div>
          <div className="p-3 bg-[#9B87F5]/15 text-[#9B87F5] rounded-xl">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        {/* 26AS TDS */}
        <div className="bg-white p-5 rounded-2xl border border-[#E9E4FA] shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-[#6B6580] uppercase tracking-wider">Total TDS — 26AS</div>
            <div className="text-2xl font-black text-[#1F1B2E] mt-1">{formatCurrency(data.totals.as26)}</div>
            <div className="text-[11px] text-[#B4A7F5] font-medium mt-1">Government Portal Traces</div>
          </div>
          <div className="p-3 bg-[#B4A7F5]/20 text-[#9B87F5] rounded-xl">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        {/* Saarthi 360 TDS */}
        <div className="bg-white p-5 rounded-2xl border border-[#E9E4FA] shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-[#6B6580] uppercase tracking-wider">Total TDS — Saarthi 360</div>
            <div className="text-2xl font-black text-[#1F1B2E] mt-1">{formatCurrency(data.totals.saarthi)}</div>
            <div className="text-[11px] text-[#9B87F5] font-medium mt-1">CRM Platform Invoices</div>
          </div>
          <div className="p-3 bg-[#9B87F5]/15 text-[#9B87F5] rounded-xl">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        {/* Net Gap */}
        <div className="bg-white p-5 rounded-2xl border border-[#E9E4FA] shadow-2xs flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-[#6B6580] uppercase tracking-wider">Net Tally − 26AS</div>
            <div className={`text-2xl font-black mt-1 ${data.totals.netGap < 0 ? 'text-[#F87A9E]' : 'text-[#4ADE80]'}`}>
              {formatCurrency(data.totals.netGap)}
            </div>
            <div className="text-[11px] text-[#6B6580] font-medium mt-1 flex items-center gap-1">
              {data.totals.netGap < 0 ? (
                <span className="text-[#F87A9E] font-bold flex items-center gap-0.5">
                  <AlertTriangle className="w-3 h-3" /> 26AS Exceeds Tally
                </span>
              ) : (
                <span className="text-[#4ADE80] font-bold">Matched / Surplus</span>
              )}
            </div>
          </div>
          <div className={`p-3 rounded-xl ${data.totals.netGap < 0 ? 'bg-[#F87A9E]/15 text-[#F87A9E]' : 'bg-[#4ADE80]/15 text-[#4ADE80]'}`}>
            <TrendingDown className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Row 2: Source Coverage (4 Cards) */}
      <div>
        <h2 className="text-xs font-extrabold text-[#6B6580] uppercase tracking-wider mb-3 flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#9B87F5]" />
          Source Coverage Distribution
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-[#4ADE80]/40 shadow-2xs text-center">
            <div className="text-3xl font-black text-[#2E8B57]">{data.sourceCoverage.threeOfThree}</div>
            <div className="text-xs font-bold text-[#1F1B2E] mt-1">3 of 3 Match</div>
            <div className="text-[10px] text-[#6B6580] mt-0.5">Tally + 26AS + Saarthi</div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-[#9B87F5]/40 shadow-2xs text-center">
            <div className="text-3xl font-black text-[#9B87F5]">{data.sourceCoverage.twoOfThree}</div>
            <div className="text-xs font-bold text-[#1F1B2E] mt-1">2 of 3 Match</div>
            <div className="text-[10px] text-[#6B6580] mt-0.5">Any 2 sources present</div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-[#FBBF77]/40 shadow-2xs text-center">
            <div className="text-3xl font-black text-[#D97706]">{data.sourceCoverage.oneOfThree}</div>
            <div className="text-xs font-bold text-[#1F1B2E] mt-1">1 of 3 Match</div>
            <div className="text-[10px] text-[#6B6580] mt-0.5">Single source record</div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-[#F87A9E]/40 shadow-2xs text-center">
            <div className="text-3xl font-black text-[#E11D48]">{data.sourceCoverage.noMatch}</div>
            <div className="text-xs font-bold text-[#1F1B2E] mt-1">No Match</div>
            <div className="text-[10px] text-[#6B6580] mt-0.5">Unlinked or 0 values</div>
          </div>
        </div>
      </div>

      {/* Row 3: Financial Reconciliation Status (6 Cards) */}
      <div>
        <h2 className="text-xs font-extrabold text-[#6B6580] uppercase tracking-wider mb-3 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#B4A7F5]" />
          Financial Reconciliation Breakdown
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-white p-4 rounded-2xl border border-[#E9E4FA] shadow-2xs">
            <div className="flex justify-between items-center text-xs font-bold text-[#6B6580]">
              <span>Match</span>
              <span className="w-2 h-2 rounded-full bg-[#4ADE80]"></span>
            </div>
            <div className="text-2xl font-black text-[#2E8B57] mt-2">{data.financialStatus.match}</div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-[#E9E4FA] shadow-2xs">
            <div className="flex justify-between items-center text-xs font-bold text-[#6B6580]">
              <span>Less</span>
              <span className="w-2 h-2 rounded-full bg-[#F87A9E]"></span>
            </div>
            <div className="text-2xl font-black text-[#E11D48] mt-2">{data.financialStatus.less}</div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-[#E9E4FA] shadow-2xs">
            <div className="flex justify-between items-center text-xs font-bold text-[#6B6580]">
              <span>Excess</span>
              <span className="w-2 h-2 rounded-full bg-[#FBBF77]"></span>
            </div>
            <div className="text-2xl font-black text-[#D97706] mt-2">{data.financialStatus.excess}</div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-[#E9E4FA] shadow-2xs">
            <div className="flex justify-between items-center text-xs font-bold text-[#6B6580]">
              <span>Missing</span>
              <span className="w-2 h-2 rounded-full bg-[#6B6580]"></span>
            </div>
            <div className="text-2xl font-black text-[#6B6580] mt-2">{data.financialStatus.missing}</div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-[#E9E4FA] shadow-2xs">
            <div className="flex justify-between items-center text-xs font-bold text-[#6B6580]">
              <span>Pending Review</span>
              <span className="w-2 h-2 rounded-full bg-[#FBBF77]"></span>
            </div>
            <div className="text-2xl font-black text-[#D97706] mt-2">{data.financialStatus.pendingReview}</div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-[#E9E4FA] shadow-2xs">
            <div className="flex justify-between items-center text-xs font-bold text-[#6B6580]">
              <span>Resolved</span>
              <span className="w-2 h-2 rounded-full bg-[#9B87F5]"></span>
            </div>
            <div className="text-2xl font-black text-[#9B87F5] mt-2">{data.financialStatus.resolved}</div>
          </div>
        </div>
      </div>

      {/* Row 4: Two Side-by-Side SVG Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Panel 1: Bar Chart — TDS by Source */}
        <div className="bg-white p-6 rounded-2xl border border-[#E9E4FA] shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-[#1F1B2E] flex items-center gap-2 mb-1">
              <BarChart3 className="w-5 h-5 text-[#9B87F5]" />
              TDS Amount by Source
            </h3>
            <p className="text-xs text-[#6B6580] mb-6">Compare aggregate TDS values recorded across all three systems</p>

            <div className="space-y-5">
              {/* Tally Bar */}
              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="text-[#9B87F5] flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#9B87F5]"></span>
                    Tally Ledger (C)
                  </span>
                  <span className="text-[#1F1B2E]">{formatCurrency(data.totals.tally)}</span>
                </div>
                <div className="w-full h-4 bg-[#E8E4FF] rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-[#9B87F5] rounded-full transition-all duration-700"
                    style={{ width: `${Math.max(5, (data.totals.tally / maxBarValue) * 100)}%` }}
                  ></div>
                </div>
              </div>

              {/* 26AS Bar */}
              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="text-[#B4A7F5] flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#B4A7F5]"></span>
                    Form 26AS (B)
                  </span>
                  <span className="text-[#1F1B2E]">{formatCurrency(data.totals.as26)}</span>
                </div>
                <div className="w-full h-4 bg-[#E8E4FF] rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-[#B4A7F5] rounded-full transition-all duration-700"
                    style={{ width: `${Math.max(5, (data.totals.as26 / maxBarValue) * 100)}%` }}
                  ></div>
                </div>
              </div>

              {/* Saarthi 360 Bar */}
              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="text-[#C084FC] flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#C084FC]"></span>
                    Saarthi 360 Books (A)
                  </span>
                  <span className="text-[#1F1B2E]">{formatCurrency(data.totals.saarthi)}</span>
                </div>
                <div className="w-full h-4 bg-[#E8E4FF] rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-[#C084FC] rounded-full transition-all duration-700"
                    style={{ width: `${Math.max(5, (data.totals.saarthi / maxBarValue) * 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-[#E9E4FA] text-[11px] text-[#6B6580] flex justify-between">
            <span>Aggregated across {data.recordCount} reconciliation records</span>
            <span className="font-semibold text-[#9B87F5]">3-Way Comparison</span>
          </div>
        </div>

        {/* Panel 2: SVG Donut Chart — Coverage Breakdown */}
        <div className="bg-white p-6 rounded-2xl border border-[#E9E4FA] shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-[#1F1B2E] flex items-center gap-2 mb-1">
              <PieIcon className="w-5 h-5 text-[#FBBF77]" />
              Source Coverage Breakdown
            </h3>
            <p className="text-xs text-[#6B6580] mb-4">Proportion of records with data present across 3, 2, 1, or 0 sources</p>

            <div className="flex flex-col sm:flex-row items-center justify-around gap-6">
              {/* Dynamic SVG Donut */}
              <div className="relative w-44 h-44 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 160 160">
                  {/* Background Ring */}
                  <circle cx="80" cy="80" r={radius} stroke="#E8E4FF" strokeWidth="20" fill="transparent" />
                  
                  {/* 3 of 3 slice */}
                  {c3Pct > 0 && (
                    <circle
                      cx="80" cy="80" r={radius}
                      stroke="#4ADE80" strokeWidth="20" fill="transparent"
                      strokeDasharray={`${stroke3} ${circumference}`}
                      strokeDashoffset={offset3}
                      className="transition-all duration-700"
                    />
                  )}
                  {/* 2 of 3 slice */}
                  {c2Pct > 0 && (
                    <circle
                      cx="80" cy="80" r={radius}
                      stroke="#9B87F5" strokeWidth="20" fill="transparent"
                      strokeDasharray={`${stroke2} ${circumference}`}
                      strokeDashoffset={offset2}
                      className="transition-all duration-700"
                    />
                  )}
                  {/* 1 of 3 slice */}
                  {c1Pct > 0 && (
                    <circle
                      cx="80" cy="80" r={radius}
                      stroke="#FBBF77" strokeWidth="20" fill="transparent"
                      strokeDasharray={`${stroke1} ${circumference}`}
                      strokeDashoffset={offset1}
                      className="transition-all duration-700"
                    />
                  )}
                  {/* No Match slice */}
                  {c0Pct > 0 && (
                    <circle
                      cx="80" cy="80" r={radius}
                      stroke="#F87A9E" strokeWidth="20" fill="transparent"
                      strokeDasharray={`${stroke0} ${circumference}`}
                      strokeDashoffset={offset0}
                      className="transition-all duration-700"
                    />
                  )}
                </svg>
                {/* Center Badge */}
                <div className="absolute flex flex-col items-center justify-center text-center">
                  <span className="text-2xl font-black text-[#1F1B2E]">{data.recordCount}</span>
                  <span className="text-[10px] font-bold text-[#6B6580] uppercase">Records</span>
                </div>
              </div>

              {/* Side Legend */}
              <div className="space-y-2 text-xs w-full sm:w-auto">
                <div className="flex items-center justify-between gap-4 p-2 rounded-lg bg-[#4ADE80]/15">
                  <span className="flex items-center gap-2 font-semibold text-[#1F1B2E]">
                    <span className="w-3 h-3 rounded bg-[#4ADE80]"></span>
                    3/3 Complete Match
                  </span>
                  <span className="font-bold text-[#2E8B57]">{data.sourceCoverage.threeOfThree} ({c3Pct.toFixed(0)}%)</span>
                </div>

                <div className="flex items-center justify-between gap-4 p-2 rounded-lg bg-[#9B87F5]/15">
                  <span className="flex items-center gap-2 font-semibold text-[#1F1B2E]">
                    <span className="w-3 h-3 rounded bg-[#9B87F5]"></span>
                    2/3 Dual Coverage
                  </span>
                  <span className="font-bold text-[#9B87F5]">{data.sourceCoverage.twoOfThree} ({c2Pct.toFixed(0)}%)</span>
                </div>

                <div className="flex items-center justify-between gap-4 p-2 rounded-lg bg-[#FBBF77]/15">
                  <span className="flex items-center gap-2 font-semibold text-[#1F1B2E]">
                    <span className="w-3 h-3 rounded bg-[#FBBF77]"></span>
                    1/3 Single Source
                  </span>
                  <span className="font-bold text-[#D97706]">{data.sourceCoverage.oneOfThree} ({c1Pct.toFixed(0)}%)</span>
                </div>

                <div className="flex items-center justify-between gap-4 p-2 rounded-lg bg-[#F87A9E]/15">
                  <span className="flex items-center gap-2 font-semibold text-[#1F1B2E]">
                    <span className="w-3 h-3 rounded bg-[#F87A9E]"></span>
                    No Match / Missing
                  </span>
                  <span className="font-bold text-[#E11D48]">{data.sourceCoverage.noMatch} ({c0Pct.toFixed(0)}%)</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-[#E9E4FA] text-[11px] text-[#6B6580] flex justify-between">
            <span>Source Presence Matrix</span>
            <span className="font-semibold text-[#FBBF77] font-mono">Tally + 26AS + Saarthi</span>
          </div>
        </div>

      </div>
    </div>
  );
}
