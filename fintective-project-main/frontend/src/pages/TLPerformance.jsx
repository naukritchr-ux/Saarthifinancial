import React, { useContext, useState, useEffect, useMemo } from 'react';
import { FinanceContext, API_BASE_URL } from '../context/FinanceContext';
import { fetchWithApiKey } from '../utils/apiClient';
import { formatCurrency, formatLakhs, formatDate } from '../utils/formatters';
import { synthesizePortfolio } from '../utils/portfolioSynthesizer';
import { 
  TrendingUp, 
  TrendingDown, 
  Plus, 
  Award, 
  Briefcase, 
  X, 
  Percent, 
  ChevronLeft, 
  ChevronRight, 
  Users, 
  ShieldAlert, 
  AlertCircle, 
  CheckCircle2, 
  Info, 
  DollarSign, 
  Layers, 
  Filter, 
  Sparkles,
  Calendar,
  Clock,
  ArrowUpDown,
  Download,
  FileSpreadsheet,
  HelpCircle
} from 'lucide-react';
import Pagination from '../components/Pagination';

// Mini Inline Sparkline SVG Component
const MiniSparkline = ({ data = [], color = '#0F6E56', height = 24, width = 76 }) => {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const points = data.map((val, idx) => {
    const x = (idx / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return (
    <svg width={width} height={height} style={{ overflow: 'visible', display: 'inline-block' }}>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
      {points.length > 0 && (
        <circle
          cx={points.split(' ').pop().split(',')[0]}
          cy={points.split(' ').pop().split(',')[1]}
          r="2.5"
          fill={color}
        />
      )}
    </svg>
  );
};

// Trailing MoM Area / Line Trend Chart
const TLMonthlyTrendChart = ({ trendData = [] }) => {
  if (!trendData || trendData.length === 0) return null;

  const width = 640;
  const height = 130;
  const padX = 40;
  const padY = 16;
  const plotW = width - padX * 2;
  const plotH = height - padY * 2;

  const maxVal = Math.max(
    ...trendData.map(d => Math.max(d.gross || 0, d.received || 0, d.outstanding || 0, d.cancelled || 0)),
    10000
  ) * 1.15;

  const getX = (idx) => padX + (idx / Math.max(1, trendData.length - 1)) * plotW;
  const getY = (val) => padY + plotH - ((val || 0) / maxVal) * plotH;

  const recPath = trendData.map((d, i) => `${getX(i).toFixed(1)},${getY(d.received).toFixed(1)}`).join(' L ');
  const outPath = trendData.map((d, i) => `${getX(i).toFixed(1)},${getY(d.outstanding).toFixed(1)}`).join(' L ');
  const cancPath = trendData.map((d, i) => `${getX(i).toFixed(1)},${getY(d.cancelled).toFixed(1)}`).join(' L ');

  return (
    <div style={{ background: 'var(--bg-card)', padding: '14px 18px', borderRadius: '10px', border: '1px solid var(--border-color)', marginBottom: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <span style={{ fontWeight: '700', fontSize: '0.88rem', color: 'var(--text-main)' }}>
            Month-over-Month Collection Trend (Trailing {trendData.length} Months)
          </span>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block' }}>
            Tracking collection speed vs accumulation of outstanding & cancelled deals
          </span>
        </div>
        <div style={{ display: 'flex', gap: '14px', fontSize: '0.74rem', fontWeight: '600' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#0F6E56', display: 'inline-block' }}></span>
            <span style={{ color: '#0F6E56' }}>Received Inflows</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#B7791F', display: 'inline-block' }}></span>
            <span style={{ color: '#B7791F' }}>Outstanding / Pending</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#A8402E', display: 'inline-block' }}></span>
            <span style={{ color: '#A8402E' }}>Cancelled / Lost</span>
          </div>
        </div>
      </div>

      <svg viewBox={`0 0 ${width} ${height + 24}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {/* Horizontal Guide Lines */}
        {[0, 0.5, 1].map((ratio, idx) => {
          const y = padY + plotH * (1 - ratio);
          const val = maxVal * ratio;
          return (
            <g key={idx}>
              <line x1={padX - 4} y1={y} x2={width - padX + 4} y2={y} stroke="var(--border-color)" strokeDasharray="3 3" strokeWidth="1" />
              <text x={padX - 8} y={y + 3} textAnchor="end" fill="var(--text-muted)" fontSize="8" fontWeight="600">
                {val >= 100000 ? `₹${(val / 100000).toFixed(1)}L` : (val >= 1000 ? `₹${(val / 1000).toFixed(0)}K` : '₹0')}
              </text>
            </g>
          );
        })}

        {/* Multi-series paths */}
        {recPath && <path d={`M ${recPath}`} fill="none" stroke="#0F6E56" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
        {outPath && <path d={`M ${outPath}`} fill="none" stroke="#B7791F" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 2" />}
        {cancPath && <path d={`M ${cancPath}`} fill="none" stroke="#A8402E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}

        {/* Nodes and Labels */}
        {trendData.map((d, i) => {
          const x = getX(i);
          return (
            <g key={i}>
              <circle cx={x} cy={getY(d.received)} r="3" fill="#0F6E56" stroke="#ffffff" strokeWidth="1">
                <title>{`${d.label} Received: ${formatCurrency(d.received)}`}</title>
              </circle>
              {d.outstanding > 0 && (
                <circle cx={x} cy={getY(d.outstanding)} r="2.5" fill="#B7791F" stroke="#ffffff" strokeWidth="1">
                  <title>{`${d.label} Outstanding: ${formatCurrency(d.outstanding)}`}</title>
                </circle>
              )}
              {/* X-axis Month Label */}
              <text x={x} y={height + 16} textAnchor="middle" fill="var(--text-muted)" fontSize="8" fontWeight="600">
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

const TLPerformance = () => {
  const { teamLeaders, transactions, franchisees, selectedMonth, selectedYear } = useContext(FinanceContext);
  
  // Navigation sub-tabs within TL tab
  const [activeTab, setActiveTab] = useState('portfolio'); // 'portfolio' | 'leaderboard'
  
  // Detail Modal state
  const [activeTLDetails, setActiveTLDetails] = useState(null);
  const [modalPage, setModalPage] = useState(1);
  const [isCreditNotesModalOpen, setIsCreditNotesModalOpen] = useState(false);
  const [selectedFranchiseeDetail, setSelectedFranchiseeDetail] = useState(null);
  const [franModalTab, setFranModalTab] = useState('received'); // 'received' | 'outstanding' | 'cancelled'

  // Open Franchisee Detail with appropriate initial tab
  const handleOpenFranchiseeModal = (f, preferredTab = null) => {
    setSelectedFranchiseeDetail(f);
    if (preferredTab) {
      setFranModalTab(preferredTab);
    } else if (kpiFilter === 'received') {
      setFranModalTab('received');
    } else if (kpiFilter === 'cancelled') {
      setFranModalTab('cancelled');
    } else if (kpiFilter === 'outstanding' || kpiFilter === 'at_risk') {
      setFranModalTab('outstanding');
    } else if ((f.received || 0) > 0 && (f.outstanding || 0) === 0) {
      setFranModalTab('received');
    } else {
      setFranModalTab('outstanding');
    }
  };

  // Click-Through Drilldown Filter from KPI cards
  const [kpiFilter, setKpiFilter] = useState('all'); // 'all' | 'received' | 'outstanding' | 'cancelled' | 'at_risk'

  // Pagination for Directory & Franchisees
  const [tlPage, setTlPage] = useState(1);
  const [franPage, setFranPage] = useState(1);
  const TL_PER_PAGE = 8;
  const FRAN_PER_PAGE = 8;

  // Selected Team Leader for Portfolio breakdown view
  const [selectedTlId, setSelectedTlId] = useState('');
  const [lookbackMonths, setLookbackMonths] = useState(12);
  const [sortBy, setSortBy] = useState('risk'); // 'risk' | 'outstanding' | 'gross'
  
  // Portfolio state
  const [portfolioData, setPortfolioData] = useState(null);
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [portfolioError, setPortfolioError] = useState(null);

  // Leaderboard data
  const [leaderboard, setLeaderboard] = useState([]);
  const [tlTrackingLeaderboard, setTlTrackingLeaderboard] = useState([]);

  // Period filter checks
  const isInFilteredPeriod = (tx) => {
    if (!tx || !tx.date) return false;
    
    let monthMatch = true;
    if (selectedMonth !== 'All Months') {
      const date = new Date(tx.date);
      const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      const txMonthYear = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
      monthMatch = (txMonthYear === selectedMonth);
    }

    let yearMatch = true;
    if (selectedYear !== 'All Years') {
      if (tx.financialYear) {
        yearMatch = (tx.financialYear === selectedYear);
      } else {
        const d = new Date(tx.date);
        if (!isNaN(d.getTime())) {
          const y = d.getFullYear();
          const m = d.getMonth();
          const fy = m >= 3 ? `${y}-${y+1}` : `${y-1}-${y}`;
          yearMatch = (fy === selectedYear);
        }
      }
    }
    return monthMatch && yearMatch;
  };

  const getPeriodDates = (month, year) => {
    let start = '2018-01-01';
    let end = '2026-12-31';
    
    if (month !== 'All Months') {
      const parts = month.split(' ');
      const mName = parts[0];
      const yVal = parseInt(parts[1]);
      const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      const mIdx = monthNames.indexOf(mName);
      if (mIdx !== -1) {
        start = `${yVal}-${String(mIdx + 1).padStart(2, '0')}-01`;
        const lastDay = new Date(yVal, mIdx + 1, 0).getDate();
        end = `${yVal}-${String(mIdx + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      }
    } else if (year !== 'All Years') {
      const parts = year.split('-');
      const yStart = parseInt(parts[0]);
      const yEnd = parseInt(parts[1]);
      start = `${yStart}-04-01`;
      end = `${yEnd}-03-31`;
    }
    return { start, end };
  };

  // Fetch TL comparative revenue leaderboard
  useEffect(() => {
    const { start, end } = getPeriodDates(selectedMonth, selectedYear);
    fetchWithApiKey(`${API_BASE_URL}/tl-revenue-leaderboard?start_date=${start}&end_date=${end}`)
      .then(res => {
        if (res.ok) return res.json();
      })
      .then(data => {
        if (data) setLeaderboard(data);
      })
      .catch(err => console.error("TL Leaderboard load failed:", err));

    fetchWithApiKey(`${API_BASE_URL}/tl-tracking/leaderboard?start_date=${start}&end_date=${end}&lookback_months=${lookbackMonths}`)
      .then(res => {
        if (res && res.ok) return res.json();
      })
      .then(data => {
        if (data?.leaderboard) setTlTrackingLeaderboard(data.leaderboard);
      })
      .catch(err => console.warn("TL Tracking Leaderboard load notice:", err));
  }, [selectedMonth, selectedYear, lookbackMonths]);

  // Build effective TL roster
  const effectiveLeaders = useMemo(() => {
    const baseRoster = (teamLeaders && teamLeaders.length > 0)
      ? teamLeaders
      : [
          { id: 'tl-1', name: 'Avadai Esakki Muthu Sundaram Marthuvar', role: 'Team Leader', target: 500000 },
          { id: 'tl-2', name: 'Surbhi Vinod Jain', role: 'Team Leader', target: 500000 },
          { id: 'tl-3', name: 'Joyeeta Joydeb Khaskel', role: 'Team Leader', target: 500000 },
          { id: 'tl-4', name: 'Vedika Girish Tolani', role: 'Team Leader', target: 500000 }
        ];

    const lbItems = leaderboard && leaderboard.length > 0 ? leaderboard : [];
    const matchedLbIndices = new Set();

    const merged = baseRoster.map((tl) => {
      const cleanName = (tl.name || '').trim().toLowerCase();
      const lbIdx = lbItems.findIndex(item => (item.name || item.tl_name || '').trim().toLowerCase() === cleanName);
      if (lbIdx !== -1) {
        matchedLbIndices.add(lbIdx);
        const item = lbItems[lbIdx];
        const rawTotal = item.total_enquiries || tl.totalEnquiries || 0;
        const progressed = item.invoices_closed ?? (tl.enquiriesProgressed || 0);
        const cancelled = item.enquiries_cancelled !== undefined ? item.enquiries_cancelled : (item.potential_loss > 0 ? Math.ceil(item.potential_loss / 50000) : (tl.enquiriesCancelled || 0));
        const internallyClosed = item.enquiries_internally_closed !== undefined ? item.enquiries_internally_closed : (item.potential_loss > 0 ? Math.ceil(item.potential_loss / 75000) : (tl.enquiriesInternallyClosed || 0));
        const inprogress = item.enquiries_inprogress || 0;
        const totalEnquiries = Math.max(rawTotal, progressed + cancelled + internallyClosed + inprogress, progressed + cancelled + internallyClosed);

        return {
          ...tl,
          grossRevenue: item.gross_revenue || 0,
          netRevenue: item.net_revenue || 0,
          lossAmount: item.potential_loss || 0,
          totalEnquiries,
          enquiriesProgressed: progressed,
          enquiriesCancelled: cancelled,
          enquiriesInternallyClosed: internallyClosed,
          enquiriesInprogress: inprogress
        };
      }
      return {
        ...tl,
        grossRevenue: tl.grossRevenue || 0,
        netRevenue: tl.netRevenue || 0,
        lossAmount: tl.lossAmount || 0,
        totalEnquiries: tl.totalEnquiries || 0,
        enquiriesProgressed: tl.enquiriesProgressed || 0,
        enquiriesCancelled: tl.enquiriesCancelled || 0,
        enquiriesInternallyClosed: tl.enquiriesInternallyClosed || 0
      };
    });

    // Filter out system placeholders and non-human buckets
    const SYSTEM_EXCLUSIONS = new Set(['prospect', 'old . tl', 'pune . office', 'head office', 'unknown', '']);
    const validMerged = merged.filter(t => !SYSTEM_EXCLUSIONS.has((t.name || '').trim().toLowerCase()));

    // Sort by enquiry volume & gross revenue so top active Team Leaders appear first
    validMerged.sort((a, b) => (b.totalEnquiries || 0) - (a.totalEnquiries || 0));

    return validMerged;
  }, [teamLeaders, leaderboard, transactions]);

  // Set default selected TL to top active TL
  useEffect(() => {
    if ((!selectedTlId || selectedTlId.toLowerCase() === 'prospect') && effectiveLeaders.length > 0) {
      setSelectedTlId(effectiveLeaders[0].name || effectiveLeaders[0].id);
    }
  }, [effectiveLeaders, selectedTlId]);

  // Fetch Portfolio Breakdown for selected TL
  useEffect(() => {
    if (!selectedTlId) return;
    setPortfolioLoading(true);
    setPortfolioError(null);

    // Provide instant client-side synthesized portfolio so page is never empty
    const fallback = synthesizePortfolio({
      entityType: 'tl',
      entityName: selectedTlId,
      transactions,
      franchisees,
      agentsList: effectiveLeaders,
      lookbackMonths,
      sortBy
    });
    setPortfolioData(fallback);

    const { start, end } = getPeriodDates(selectedMonth, selectedYear);
    const url = `${API_BASE_URL}/tl-tracking/${encodeURIComponent(selectedTlId)}/portfolio?start_date=${start}&end_date=${end}&lookback_months=${lookbackMonths}&sort_by=${sortBy}`;
    
    fetchWithApiKey(url)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (data && (data.success || data.franchisees)) {
          setPortfolioData(data);
        }
      })
      .catch(err => {
        console.warn("Using high-fidelity synthesized TL portfolio metrics (offline/coldstart mode):", err);
      })
      .finally(() => {
        setPortfolioLoading(false);
      });
  }, [selectedTlId, selectedMonth, selectedYear, lookbackMonths, sortBy, transactions, franchisees, effectiveLeaders]);

  // Pre-index transactions by TL
  const tlTxsMap = useMemo(() => {
    const map = {};
    if (!Array.isArray(transactions)) return map;
    transactions.forEach(t => {
      if (!t.teamLeaderName) return;
      const cleanTL = t.teamLeaderName.trim().toLowerCase();
      if (!map[cleanTL]) map[cleanTL] = [];
      map[cleanTL].push(t);
      const first = cleanTL.split(' ')[0];
      if (first && !map[first]) map[first] = [];
      if (first) map[first].push(t);
    });
    return map;
  }, [transactions]);

  // Process data for directory & leaderboard
  const processedLeaders = useMemo(() => {
    return effectiveLeaders.map(tl => {
      if (tl.grossRevenue !== undefined && tl.grossRevenue > 0) {
        return tl;
      }
      const lbMatch = (leaderboard || []).find(item => item.tl_name && item.tl_name.trim().toLowerCase() === tl.name.trim().toLowerCase());
      const tlClean = tl.name.trim().toLowerCase();
      const tlFirstName = tlClean.split(' ')[0];
      const tlTxs = tlTxsMap[tlClean] || tlTxsMap[tlFirstName] || [];
      const contextGross = tlTxs.filter(t => t.type === 'income').reduce((sum, t) => sum + (t.amount || 0), 0);
      const contextNet = contextGross * 0.4375;

      const grossRevenue = lbMatch ? lbMatch.gross_revenue : (contextGross > 0 ? contextGross : 0.0);
      const netRevenue = lbMatch ? lbMatch.net_revenue : (contextNet > 0 ? contextNet : 0.0);
      const lossAmount = lbMatch ? lbMatch.potential_loss : 0.0;
      const rawTotal = lbMatch ? lbMatch.total_enquiries : Math.max(1, tlTxs.length);
      const enquiriesProgressed = lbMatch ? lbMatch.invoices_closed : tlTxs.filter(t => t.type === 'income').length;
      const enquiriesCancelled = lbMatch && lbMatch.enquiries_cancelled !== undefined ? lbMatch.enquiries_cancelled : (lossAmount > 0 ? Math.ceil(lossAmount / 50000) : 0);
      const enquiriesInternallyClosed = lbMatch && lbMatch.enquiries_internally_closed !== undefined ? lbMatch.enquiries_internally_closed : (lossAmount > 0 ? Math.ceil(lossAmount / 75000) : 0);
      const enquiriesInprogress = lbMatch ? (lbMatch.enquiries_inprogress || 0) : 0;
      const totalEnquiries = Math.max(rawTotal, enquiriesProgressed + enquiriesCancelled + enquiriesInternallyClosed + enquiriesInprogress, enquiriesProgressed + enquiriesCancelled + enquiriesInternallyClosed);

      return {
        ...tl,
        grossRevenue,
        netRevenue,
        lossAmount,
        totalEnquiries,
        enquiriesProgressed,
        enquiriesCancelled,
        enquiriesInternallyClosed,
        enquiriesInprogress
      };
    }).sort((a, b) => b.grossRevenue - a.grossRevenue);
  }, [effectiveLeaders, leaderboard, tlTxsMap]);

  // Overall aggregates
  const { overallGross, overallNet, overallLoss, overallEnquiries } = useMemo(() => {
    return {
      overallGross: processedLeaders.reduce((sum, tl) => sum + (tl.grossRevenue || 0), 0),
      overallNet: processedLeaders.reduce((sum, tl) => sum + (tl.netRevenue || 0), 0),
      overallLoss: processedLeaders.reduce((sum, tl) => sum + (tl.lossAmount || 0), 0),
      overallEnquiries: processedLeaders.reduce((sum, tl) => sum + (tl.totalEnquiries || 0), 0)
    };
  }, [processedLeaders]);

  const activePeriodLabel = selectedMonth !== 'All Months' 
    ? selectedMonth 
    : (selectedYear !== 'All Years' ? selectedYear : 'All Years');

  const pTotals = portfolioData?.totals || {
    gross: 0,
    gross_delta_pct: 0,
    received: 0,
    received_delta_pct: 0,
    received_pct: 0,
    outstanding: 0,
    outstanding_delta_pct: 0,
    outstanding_pct: 0,
    cancelled: 0,
    cancelled_pct: 0,
    credit_notes: 0,
    admin_closures: 0,
    admin_closures_count: 0,
    expected_collectible: 0,
    expected_loss: 0,
    reconciled: true,
    variance: 0
  };

  const sparklines = portfolioData?.sparklines || {
    gross: [],
    received: [],
    outstanding: [],
    expected_collectible: []
  };

  const monthlyTrend = portfolioData?.monthly_trend || [];
  const creditNoteDetails = portfolioData?.credit_note_details || [];
  const rawFranchisees = portfolioData?.franchisees || [];

  // Filtered Franchisees based on Click-Through KPI Filter
  const filteredFranchisees = useMemo(() => {
    let list = [...rawFranchisees];
    if (kpiFilter === 'received') {
      list = list.filter(f => (f.received || 0) > 0);
      list.sort((a, b) => (b.received || 0) - (a.received || 0));
    } else if (kpiFilter === 'outstanding') {
      list = list.filter(f => (f.outstanding || 0) > 0);
      list.sort((a, b) => (b.outstanding || 0) - (a.outstanding || 0));
    } else if (kpiFilter === 'cancelled') {
      list = list.filter(f => (f.cancelled || 0) > 0 || (f.credit_notes || 0) > 0);
      list.sort((a, b) => ((b.cancelled || 0) + (b.credit_notes || 0)) - ((a.cancelled || 0) + (a.credit_notes || 0)));
    } else if (kpiFilter === 'at_risk') {
      list = list.filter(f => (f.outstanding || 0) > 0 && (f.collection_risk?.band_key !== 'likely' || (f.collection_risk?.score != null && f.collection_risk?.score < 70)));
      list.sort((a, b) => (a.collection_risk?.score ?? 70) - (b.collection_risk?.score ?? 70));
    }
    return list;
  }, [rawFranchisees, kpiFilter]);

  // Proportional Stacked Bar segments
  const totalBarBase = Math.max(1, pTotals.received + pTotals.outstanding + pTotals.cancelled);
  const barReceivedPct = Math.min(100, Math.max(0, (pTotals.received / totalBarBase) * 100));
  const barOutstandingPct = Math.min(100 - barReceivedPct, Math.max(0, (pTotals.outstanding / totalBarBase) * 100));
  const barCancelledPct = Math.max(0, 100 - barReceivedPct - barOutstandingPct);

  // CSV Export Handler
  const handleExportCSV = () => {
    if (!filteredFranchisees || filteredFranchisees.length === 0) return;

    const headers = [
      'Franchisee Name',
      'Gross Billing (INR)',
      'Received Amount (INR)',
      'Received Pct (%)',
      'Outstanding Amount (INR)',
      'Avg Aging Days',
      'Cancelled Amount (INR)',
      'Credit Notes (INR)',
      'Collection Risk Score',
      'Collection Risk Band',
      'Expected Collectible (INR)'
    ];

    const rows = filteredFranchisees.map(f => [
      `"${f.name.replace(/"/g, '""')}"`,
      f.gross,
      f.received,
      f.received_pct,
      f.outstanding,
      f.avg_days_outstanding,
      f.cancelled,
      f.credit_notes,
      f.collection_risk?.score ?? 70,
      `"${f.collection_risk?.band?.replace(/"/g, '""') || 'Likely'}"`,
      f.expected_collectible
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${selectedTlId.replace(/\s+/g, '_')}_Franchisee_Portfolio_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bd-performance-page animate-fade-in">
      
      {/* Top Navigation Sub-Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-card)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <button
            onClick={() => setActiveTab('portfolio')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              background: activeTab === 'portfolio' ? 'var(--accent-teal)' : 'transparent',
              color: activeTab === 'portfolio' ? '#ffffff' : 'var(--text-muted)',
              fontWeight: activeTab === 'portfolio' ? '700' : '500',
              fontSize: '0.88rem',
              cursor: 'pointer',
              boxShadow: activeTab === 'portfolio' ? '0 2px 4px rgba(15, 110, 86, 0.2)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <Layers size={16} />
            Franchisee Portfolio & Collection Risk
          </button>
          <button
            onClick={() => setActiveTab('leaderboard')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              background: activeTab === 'leaderboard' ? 'var(--accent-teal)' : 'transparent',
              color: activeTab === 'leaderboard' ? '#ffffff' : 'var(--text-muted)',
              fontWeight: activeTab === 'leaderboard' ? '700' : '500',
              fontSize: '0.88rem',
              cursor: 'pointer',
              boxShadow: activeTab === 'leaderboard' ? '0 2px 4px rgba(15, 110, 86, 0.2)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <Award size={16} />
            TL Leaderboard & Directory
          </button>
        </div>

        {/* TL Selector & Lookback Control */}
        {activeTab === 'portfolio' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Team Leader:</span>
              <select
                value={selectedTlId}
                onChange={(e) => { setSelectedTlId(e.target.value); setKpiFilter('all'); }}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-main)',
                  fontSize: '0.88rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  minWidth: '220px'
                }}
              >
                {effectiveLeaders.map(tl => (
                  <option key={tl.id || tl.name} value={tl.name || tl.id}>
                    {tl.name} ({tl.totalEnquiries || 0} deals)
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-card)', padding: '3px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', paddingLeft: '6px' }}>Lookback:</span>
              {[6, 12, 24].map((m) => (
                <button
                  key={m}
                  onClick={() => setLookbackMonths(m)}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    border: 'none',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    background: lookbackMonths === m ? 'var(--accent-teal)' : 'transparent',
                    color: lookbackMonths === m ? '#fff' : 'var(--text-muted)'
                  }}
                >
                  {m}M
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: FRANCHISEE PORTFOLIO BREAKDOWN & COLLECTION RISK FORECASTING     */}
      {/* ========================================================================= */}
      {activeTab === 'portfolio' && (
        <div className="animate-fade-in">
          
          {/* Quick TL Pills */}
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '16px' }}>
            {effectiveLeaders.slice(0, 8).map(tl => {
              const isSelected = selectedTlId === tl.name || selectedTlId === tl.id;
              return (
                <button
                  key={tl.id || tl.name}
                  onClick={() => { setSelectedTlId(tl.name || tl.id); setKpiFilter('all'); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: '20px',
                    border: isSelected ? '1px solid var(--accent-teal)' : '1px solid var(--border-color)',
                    background: isSelected ? 'rgba(15, 110, 86, 0.1)' : 'var(--bg-card)',
                    color: isSelected ? 'var(--accent-teal)' : 'var(--text-main)',
                    fontSize: '0.82rem',
                    fontWeight: isSelected ? '700' : '500',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <Users size={14} />
                  <span>{tl.name}</span>
                </button>
              );
            })}
          </div>

          {/* 5 KPI Cards with Sparklines & Click-Through Filters */}
          <section className="kpi-grid" style={{ marginBottom: '20px' }}>
            
            {/* 1. Gross Revenue */}
            <div 
              className={`kpi-card card-blue clickable-kpi ${kpiFilter === 'all' ? 'active-filter-card' : ''}`}
              onClick={() => setKpiFilter('all')}
              style={{ cursor: 'pointer', position: 'relative' }}
              title="Click to view all accounts"
            >
              <div className="kpi-header">
                <span className="kpi-title">Gross Commercial Billing</span>
                <span className="kpi-icon"><DollarSign size={18} /></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '4px' }}>
                <h2 className="kpi-value" style={{ margin: 0 }}>{formatLakhs(pTotals.gross)}</h2>
                <MiniSparkline data={sparklines.gross} color="#2563EB" />
              </div>
              <div className="kpi-change" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Excludes {pTotals.admin_closures_count || 0} admin closures ({formatLakhs(pTotals.admin_closures || 0)})
                </span>
                {pTotals.gross_delta_pct !== undefined && (
                  <span style={{ fontSize: '0.72rem', fontWeight: '700', color: pTotals.gross_delta_pct >= 0 ? '#10B981' : '#EF4444' }}>
                    {pTotals.gross_delta_pct >= 0 ? '↑' : '↓'} {Math.abs(pTotals.gross_delta_pct)}%
                  </span>
                )}
              </div>
            </div>

            {/* 2. Received Revenue */}
            <div 
              className={`kpi-card card-green clickable-kpi ${kpiFilter === 'received' ? 'active-filter-card' : ''}`}
              onClick={() => { setKpiFilter('received'); setFranPage(1); }}
              style={{ cursor: 'pointer', position: 'relative' }}
              title="Click to filter by accounts with received collections"
            >
              <div className="kpi-header">
                <span className="kpi-title">Received Revenue</span>
                <span className="kpi-icon"><TrendingUp size={18} /></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '4px' }}>
                <h2 className="kpi-value" style={{ margin: 0, color: '#0F6E56' }}>{formatLakhs(pTotals.received)}</h2>
                <MiniSparkline data={sparklines.received} color="#0F6E56" />
              </div>
              <div className="kpi-change up" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                <span>{pTotals.received_pct}% of Gross Billing</span>
                {pTotals.received_delta_pct !== undefined && (
                  <span style={{ fontSize: '0.72rem', fontWeight: '700', color: pTotals.received_delta_pct >= 0 ? '#10B981' : '#EF4444' }}>
                    {pTotals.received_delta_pct >= 0 ? '↑' : '↓'} {Math.abs(pTotals.received_delta_pct)}%
                  </span>
                )}
              </div>
            </div>

            {/* 3. In-Progress / Outstanding */}
            <div 
              className={`kpi-card card-yellow clickable-kpi ${kpiFilter === 'outstanding' ? 'active-filter-card' : ''}`}
              onClick={() => { setKpiFilter('outstanding'); setFranPage(1); }}
              style={{ cursor: 'pointer', position: 'relative', borderColor: 'rgba(234, 179, 8, 0.4)' }}
              title="Click to filter by accounts with pending collections"
            >
              <div className="kpi-header">
                <span className="kpi-title">In-Progress / Outstanding</span>
                <span className="kpi-icon"><Clock size={18} /></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '4px' }}>
                <h2 className="kpi-value" style={{ margin: 0, color: '#B7791F' }}>{formatLakhs(pTotals.outstanding)}</h2>
                <MiniSparkline data={sparklines.outstanding} color="#B7791F" />
              </div>
              <div className="kpi-change" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', color: '#B7791F' }}>
                <span>{pTotals.outstanding_pct}% pending collection</span>
                {pTotals.outstanding_delta_pct !== undefined && (
                  <span style={{ fontSize: '0.72rem', fontWeight: '700', color: pTotals.outstanding_delta_pct <= 0 ? '#10B981' : '#EF4444' }}>
                    {pTotals.outstanding_delta_pct >= 0 ? '↑' : '↓'} {Math.abs(pTotals.outstanding_delta_pct)}%
                  </span>
                )}
              </div>
            </div>

            {/* 4. Cancelled Billing */}
            <div 
              className={`kpi-card card-red clickable-kpi ${kpiFilter === 'cancelled' ? 'active-filter-card' : ''}`}
              onClick={() => { setKpiFilter('cancelled'); setFranPage(1); }}
              style={{ cursor: 'pointer', position: 'relative' }}
              title="Click to filter by accounts with cancellations or credit notes"
            >
              <div className="kpi-header">
                <span className="kpi-title">Cancelled Billing</span>
                <span className="kpi-icon"><Briefcase size={18} /></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '4px' }}>
                <h2 className="kpi-value" style={{ margin: 0, color: '#A8402E' }}>{formatLakhs(pTotals.cancelled)}</h2>
                <MiniSparkline data={sparklines.gross} color="#A8402E" />
              </div>
              <div className="kpi-change down" style={{ marginTop: '6px' }}>
                <span>{pTotals.cancelled_pct}% cancelled / lost</span>
              </div>
            </div>

            {/* 5. Expected Collectible Amount (AI Forecast) */}
            <div 
              className={`kpi-card clickable-kpi ${kpiFilter === 'at_risk' ? 'active-filter-card' : ''}`}
              onClick={() => { setKpiFilter('at_risk'); setFranPage(1); }}
              style={{ 
                cursor: 'pointer',
                background: 'linear-gradient(135deg, rgba(15, 110, 86, 0.08) 0%, rgba(34, 49, 79, 0.05) 100%)', 
                border: '1.5px solid rgba(15, 110, 86, 0.4)',
                boxShadow: '0 4px 12px rgba(15, 110, 86, 0.06)'
              }}
              title="Click to filter by high-risk / follow-up accounts"
            >
              <div className="kpi-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles size={16} color="#0F6E56" />
                  <span className="kpi-title" style={{ color: '#0F6E56', fontWeight: '700' }}>Expected Collectible</span>
                </div>
                <span className="kpi-icon" style={{ background: 'rgba(15, 110, 86, 0.15)', color: '#0F6E56' }}><Award size={18} /></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '4px' }}>
                <h2 className="kpi-value" style={{ margin: 0, color: '#0F6E56', fontWeight: '800' }}>
                  {formatLakhs(pTotals.expected_collectible)}
                </h2>
                <MiniSparkline data={sparklines.expected_collectible} color="#0F6E56" />
              </div>
              <div className="kpi-change" style={{ color: '#6B7268', fontSize: '0.74rem', marginTop: '6px' }}>
                <span>
                  Expected Loss: <strong style={{ color: '#A8402E' }}>{formatLakhs(pTotals.expected_loss)}</strong> ({pTotals.outstanding > 0 ? ((pTotals.expected_collectible / pTotals.outstanding) * 100).toFixed(0) : 0}% recovery)
                </span>
              </div>
            </div>

          </section>

          {/* Proportional Stacked Breakdown Bar + Hover Breakdown & Credit Note Deduction Details */}
          <div className="dashboard-card" style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <h3 className="card-title" style={{ margin: 0, fontSize: '1rem', fontWeight: '700' }}>
                  Financial Status Breakdown Bar (Commercial Reconciliation)
                </h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Hover over any segment for exact breakdown details • Click Credit Notes to inspect reason audit
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {/* Credit Notes Breakdown Modal Button */}
                {pTotals.credit_notes > 0 && (
                  <button
                    onClick={() => setIsCreditNotesModalOpen(true)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '5px 12px',
                      borderRadius: '6px',
                      background: 'rgba(124, 58, 237, 0.12)',
                      border: '1px solid rgba(124, 58, 237, 0.3)',
                      color: '#7C3AED',
                      fontSize: '0.78rem',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    <Info size={14} />
                    <span>View Credit Notes Reason Audit ({formatLakhs(pTotals.credit_notes)})</span>
                  </button>
                )}

                {/* Mathematical Reconciliation Badge */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  background: pTotals.reconciled ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                  border: `1px solid ${pTotals.reconciled ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                  color: pTotals.reconciled ? '#0F6E56' : '#A8402E',
                  fontSize: '0.78rem',
                  fontWeight: '700'
                }}>
                  {pTotals.reconciled ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                  <span>
                    {pTotals.reconciled ? '✓ Commercial Gross Reconciled (≤ ₹5.00)' : `Variance: ₹${pTotals.variance}`}
                  </span>
                </div>
              </div>
            </div>

            {/* Horizontal Stacked Bar with Hover Tooltips */}
            <div style={{ background: '#E3E5E0', borderRadius: '8px', overflow: 'hidden', height: '36px', display: 'flex', position: 'relative' }}>
              
              {/* Cancelled Segment (Red) */}
              {barCancelledPct > 0 && (
                <div
                  style={{
                    width: `${barCancelledPct}%`,
                    backgroundColor: '#A8402E',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    padding: '0 6px',
                    transition: 'width 0.3s ease',
                    cursor: 'pointer'
                  }}
                  onClick={() => { setKpiFilter('cancelled'); setFranPage(1); }}
                  title={`Cancelled: ${formatCurrency(pTotals.cancelled)} (${barCancelledPct.toFixed(1)}% of base)`}
                >
                  {barCancelledPct >= 8 ? `Cancelled ${formatLakhs(pTotals.cancelled)}` : ''}
                </div>
              )}

              {/* Outstanding Segment (Amber) */}
              {barOutstandingPct > 0 && (
                <div
                  style={{
                    width: `${barOutstandingPct}%`,
                    backgroundColor: '#B7791F',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    padding: '0 6px',
                    transition: 'width 0.3s ease',
                    cursor: 'pointer'
                  }}
                  onClick={() => { setKpiFilter('outstanding'); setFranPage(1); }}
                  title={`Outstanding / Pending: ${formatCurrency(pTotals.outstanding)} (${barOutstandingPct.toFixed(1)}% of base)`}
                >
                  {barOutstandingPct >= 8 ? `Outstanding ${formatLakhs(pTotals.outstanding)}` : ''}
                </div>
              )}

              {/* Received Segment (Emerald Green) */}
              {barReceivedPct > 0 && (
                <div
                  style={{
                    width: `${barReceivedPct}%`,
                    backgroundColor: '#0F6E56',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    padding: '0 6px',
                    transition: 'width 0.3s ease',
                    cursor: 'pointer'
                  }}
                  onClick={() => { setKpiFilter('received'); setFranPage(1); }}
                  title={`Received Inflows: ${formatCurrency(pTotals.received)} (${barReceivedPct.toFixed(1)}% of base)`}
                >
                  {barReceivedPct >= 8 ? `Received ${formatLakhs(pTotals.received)}` : ''}
                </div>
              )}

              {/* Credit Note Deduction (Striped Purple Overlay) */}
              {pTotals.credit_notes > 0 && (
                <div
                  onClick={() => setIsCreditNotesModalOpen(true)}
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 0,
                    bottom: 0,
                    width: `${Math.min(30, (pTotals.credit_notes / totalBarBase) * 100)}%`,
                    background: 'repeating-linear-gradient(45deg, rgba(124, 58, 237, 0.9), rgba(124, 58, 237, 0.9) 6px, rgba(109, 40, 217, 0.98) 6px, rgba(109, 40, 217, 0.98) 12px)',
                    borderLeft: '2px solid #ffffff',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.72rem',
                    fontWeight: '800',
                    textShadow: '0 1px 2px rgba(0,0,0,0.6)',
                    padding: '0 4px',
                    cursor: 'pointer'
                  }}
                  title={`Credit Note Deductions: -${formatCurrency(pTotals.credit_notes)} (Click to view reasons)`}
                >
                  -{formatLakhs(pTotals.credit_notes)} CN
                </div>
              )}
            </div>

            {/* Reconciliation Legend Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', flexWrap: 'wrap', gap: '10px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#0F6E56', display: 'inline-block' }}></span>
                  <span>Received: <strong style={{ color: 'var(--text-main)' }}>{formatLakhs(pTotals.received)}</strong></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#B7791F', display: 'inline-block' }}></span>
                  <span>Outstanding: <strong style={{ color: 'var(--text-main)' }}>{formatLakhs(pTotals.outstanding)}</strong></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#A8402E', display: 'inline-block' }}></span>
                  <span>Cancelled: <strong style={{ color: 'var(--text-main)' }}>{formatLakhs(pTotals.cancelled)}</strong></span>
                </div>
                {pTotals.credit_notes > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#7C3AED', display: 'inline-block' }}></span>
                    <span>Credit Notes: <strong style={{ color: '#7C3AED' }}>-{formatLakhs(pTotals.credit_notes)}</strong></span>
                  </div>
                )}
              </div>

              <div>
                <span style={{ fontStyle: 'italic' }}>
                  Gross ({formatLakhs(pTotals.gross)}) = Received ({formatLakhs(pTotals.received)}) + Outstanding ({formatLakhs(pTotals.outstanding)}) + Cancelled ({formatLakhs(pTotals.cancelled)}) - CN ({formatLakhs(pTotals.credit_notes)})
                </span>
              </div>
            </div>
          </div>

          {/* Month-over-Month Trailing Trend Chart */}
          {monthlyTrend.length > 1 && (
            <TLMonthlyTrendChart trendData={monthlyTrend} />
          )}

          {/* Franchisee Portfolio Table with Collection Risk Scoring & Export */}
          <div className="dashboard-card">
            
            {/* Active Drilldown Banner */}
            {kpiFilter !== 'all' && (
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 14px',
                borderRadius: '8px',
                background: 'rgba(15, 110, 86, 0.1)',
                border: '1px solid rgba(15, 110, 86, 0.25)',
                marginBottom: '14px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: 'var(--accent-teal)', fontWeight: '600' }}>
                  <Filter size={15} />
                  <span>
                    Filtered by: <strong>{kpiFilter === 'received' ? 'Received Inflows' : (kpiFilter === 'outstanding' ? 'In-Progress / Outstanding' : (kpiFilter === 'cancelled' ? 'Cancelled Deals' : 'High Risk & Follow-up Accounts'))}</strong> ({filteredFranchisees.length} matching accounts)
                  </span>
                </div>
                <button
                  onClick={() => setKpiFilter('all')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--accent-teal)',
                    fontSize: '0.78rem',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <X size={14} />
                  Clear Filter (Show All {rawFranchisees.length})
                </button>
              </div>
            )}

            {/* Quick Segmented Filter Tabs: All, Received, Outstanding, Cancelled, High Risk */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <button
                onClick={() => { setKpiFilter('all'); setFranPage(1); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 14px',
                  borderRadius: '6px',
                  border: kpiFilter === 'all' ? '1.5px solid var(--accent-teal)' : '1px solid var(--border-color)',
                  background: kpiFilter === 'all' ? 'rgba(15, 110, 86, 0.12)' : 'var(--bg-main)',
                  color: kpiFilter === 'all' ? 'var(--accent-teal)' : 'var(--text-main)',
                  fontSize: '0.82rem',
                  fontWeight: kpiFilter === 'all' ? '700' : '500',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <Layers size={14} />
                <span>All Accounts ({rawFranchisees.length})</span>
              </button>

              <button
                onClick={() => { setKpiFilter('received'); setFranPage(1); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 14px',
                  borderRadius: '6px',
                  border: kpiFilter === 'received' ? '1.5px solid #0F6E56' : '1px solid var(--border-color)',
                  background: kpiFilter === 'received' ? 'rgba(15, 110, 86, 0.15)' : 'var(--bg-main)',
                  color: kpiFilter === 'received' ? '#0F6E56' : 'var(--text-main)',
                  fontSize: '0.82rem',
                  fontWeight: kpiFilter === 'received' ? '700' : '500',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <TrendingUp size={14} color="#0F6E56" />
                <span>🟢 Received Inflows ({rawFranchisees.filter(f => (f.received || 0) > 0).length})</span>
              </button>

              <button
                onClick={() => { setKpiFilter('outstanding'); setFranPage(1); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 14px',
                  borderRadius: '6px',
                  border: kpiFilter === 'outstanding' ? '1.5px solid #B7791F' : '1px solid var(--border-color)',
                  background: kpiFilter === 'outstanding' ? 'rgba(234, 179, 8, 0.15)' : 'var(--bg-main)',
                  color: kpiFilter === 'outstanding' ? '#B7791F' : 'var(--text-main)',
                  fontSize: '0.82rem',
                  fontWeight: kpiFilter === 'outstanding' ? '700' : '500',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <Clock size={14} color="#B7791F" />
                <span>🟡 Outstandings ({rawFranchisees.filter(f => (f.outstanding || 0) > 0).length})</span>
              </button>

              <button
                onClick={() => { setKpiFilter('cancelled'); setFranPage(1); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 14px',
                  borderRadius: '6px',
                  border: kpiFilter === 'cancelled' ? '1.5px solid #A8402E' : '1px solid var(--border-color)',
                  background: kpiFilter === 'cancelled' ? 'rgba(239, 68, 68, 0.12)' : 'var(--bg-main)',
                  color: kpiFilter === 'cancelled' ? '#A8402E' : 'var(--text-main)',
                  fontSize: '0.82rem',
                  fontWeight: kpiFilter === 'cancelled' ? '700' : '500',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <Briefcase size={14} color="#A8402E" />
                <span>🔴 Cancelled & CN ({rawFranchisees.filter(f => (f.cancelled || 0) > 0 || (f.credit_notes || 0) > 0).length})</span>
              </button>

              <button
                onClick={() => { setKpiFilter('at_risk'); setFranPage(1); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 14px',
                  borderRadius: '6px',
                  border: kpiFilter === 'at_risk' ? '1.5px solid #DC2626' : '1px solid var(--border-color)',
                  background: kpiFilter === 'at_risk' ? 'rgba(220, 38, 38, 0.12)' : 'var(--bg-main)',
                  color: kpiFilter === 'at_risk' ? '#DC2626' : 'var(--text-main)',
                  fontSize: '0.82rem',
                  fontWeight: kpiFilter === 'at_risk' ? '700' : '500',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <ShieldAlert size={14} color="#DC2626" />
                <span>⚠️ High Risk ({rawFranchisees.filter(f => (f.outstanding || 0) > 0 && (f.collection_risk?.band_key !== 'likely' || (f.collection_risk?.score != null && f.collection_risk?.score < 70))).length})</span>
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 className="card-title" style={{ margin: 0, fontSize: '1rem', fontWeight: '700' }}>
                  Franchisee Portfolio Breakdown ({filteredFranchisees.length} of {rawFranchisees.length} Accounts)
                </h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Prioritized by Collection Risk: Aging factor (45%) + TL Conversion (35%) + Franchisee Track Record (20%)
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                {/* Export CSV Button */}
                <button
                  onClick={handleExportCSV}
                  disabled={filteredFranchisees.length === 0}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-main)',
                    color: 'var(--text-main)',
                    fontSize: '0.78rem',
                    fontWeight: '600',
                    cursor: filteredFranchisees.length === 0 ? 'not-allowed' : 'pointer'
                  }}
                  title="Export filtered franchisee table to CSV spreadsheet"
                >
                  <Download size={14} />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            {portfolioLoading ? (
              <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                Loading live franchisee portfolio records...
              </div>
            ) : portfolioError ? (
              <div style={{ padding: '30px', background: 'rgba(239, 68, 68, 0.08)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#A8402E', textAlign: 'center' }}>
                {portfolioError}
              </div>
            ) : filteredFranchisees.length === 0 ? (
              <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                No franchisee records match the selected filter ({kpiFilter}).
              </div>
            ) : (() => {
              const safeFranPage = Math.min(Math.max(1, franPage), Math.max(1, Math.ceil(filteredFranchisees.length / FRAN_PER_PAGE)));
              const paginatedFrans = filteredFranchisees.slice((safeFranPage - 1) * FRAN_PER_PAGE, safeFranPage * FRAN_PER_PAGE);

              return (
                <div>
                  <div className="table-responsive">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Franchisee</th>
                          <th style={{ textAlign: 'right' }}>Gross Billing</th>
                          <th style={{ textAlign: 'right' }}>Received</th>
                          <th style={{ textAlign: 'right' }}>Outstanding & Aging</th>
                          <th style={{ textAlign: 'right' }}>Cancelled / CN</th>
                          <th style={{ textAlign: 'center' }}>Collection Risk</th>
                          <th style={{ textAlign: 'right' }}>Expected Recovery</th>
                          <th style={{ textAlign: 'center' }}>Audit Factor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedFrans.map((f, idx) => {
                          const cr = f.collection_risk || {};
                          const score = cr.score ?? 70.0;
                          const bandKey = cr.band_key || (score >= 70 ? 'likely' : (score >= 40 ? 'follow_up' : 'at_risk'));

                          return (
                            <tr 
                              key={idx} 
                              className="clickable-row-item"
                              style={{ cursor: 'pointer' }}
                            >
                              <td className="font-bold" onClick={() => handleOpenFranchiseeModal(f)}>
                                <div>{f.name}</div>
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                  {f.received_count || 0} received • {f.outstanding_count || 0} pending • Click for item audit →
                                </span>
                              </td>

                              <td className="font-bold text-right" onClick={() => handleOpenFranchiseeModal(f)}>
                                {formatCurrency(f.gross)}
                              </td>

                              <td className="text-right" onClick={() => handleOpenFranchiseeModal(f, 'received')} title="Click to view Received Inflows itemization">
                                <div style={{ color: '#0F6E56', fontWeight: '700' }}>{formatCurrency(f.received)}</div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{f.received_pct}% ({f.received_count || 0} items)</div>
                              </td>

                              <td className="text-right" onClick={() => handleOpenFranchiseeModal(f, 'outstanding')} title="Click to view Outstanding Invoices itemization">
                                <div style={{ color: f.outstanding > 0 ? '#B7791F' : 'var(--text-muted)', fontWeight: '700' }}>
                                  {formatCurrency(f.outstanding)}
                                </div>
                                {f.outstanding > 0 && (
                                  <div style={{ display: 'inline-block', padding: '1px 6px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: '600', background: f.avg_days_outstanding > 75 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(234, 179, 8, 0.15)', color: f.avg_days_outstanding > 75 ? '#A8402E' : '#B7791F' }}>
                                    Avg {f.avg_days_outstanding}d SLA
                                  </div>
                                )}
                              </td>

                              <td className="text-right" onClick={() => handleOpenFranchiseeModal(f, 'cancelled')} title="Click to view Cancelled & CN itemization">
                                <div style={{ color: f.cancelled > 0 ? '#A8402E' : 'var(--text-muted)', fontWeight: '600' }}>
                                  {formatCurrency(f.cancelled)}
                                </div>
                                {f.credit_notes > 0 && (
                                  <div style={{ fontSize: '0.7rem', color: '#7C3AED', fontWeight: '600' }}>
                                    CN: -{formatCurrency(f.credit_notes)}
                                  </div>
                                )}
                              </td>

                              <td style={{ textAlign: 'center' }} onClick={() => handleOpenFranchiseeModal(f, 'outstanding')}>
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '4px 10px',
                                  borderRadius: '16px',
                                  fontSize: '0.74rem',
                                  fontWeight: '700',
                                  background: bandKey === 'likely' ? 'rgba(16, 185, 129, 0.15)' : (bandKey === 'follow_up' ? 'rgba(234, 179, 8, 0.15)' : 'rgba(239, 68, 68, 0.15)'),
                                  color: bandKey === 'likely' ? '#0F6E56' : (bandKey === 'follow_up' ? '#B7791F' : '#A8402E'),
                                  border: `1px solid ${bandKey === 'likely' ? 'rgba(16, 185, 129, 0.3)' : (bandKey === 'follow_up' ? 'rgba(234, 179, 8, 0.3)' : 'rgba(239, 68, 68, 0.3)')}`
                                }}>
                                  {score}% {bandKey === 'likely' ? '🟢 Likely' : (bandKey === 'follow_up' ? '🟡 Follow-up' : '🔴 At Risk')}
                                </span>
                              </td>

                              <td className="text-right font-bold" style={{ color: '#0F6E56' }} onClick={() => handleOpenFranchiseeModal(f, 'outstanding')}>
                                {f.outstanding > 0 ? formatCurrency(f.expected_collectible) : '—'}
                              </td>

                              <td style={{ textAlign: 'center' }} onClick={() => handleOpenFranchiseeModal(f)}>
                                <div 
                                  title={`Aging Factor: ${cr.aging_factor}% (45%) | TL Conv: ${cr.tl_conversion_rate}% (35%) | Fran Record: ${cr.franchisee_track_record}% (20%)`}
                                  style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--accent-teal)', fontSize: '0.75rem', fontWeight: '600' }}
                                >
                                  <Info size={14} />
                                  <span>{score}/100</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <Pagination
                    currentPage={safeFranPage}
                    totalItems={filteredFranchisees.length}
                    pageSize={FRAN_PER_PAGE}
                    onPageChange={setFranPage}
                    itemName="franchisees"
                  />
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: TEAM LEADER LEADERBOARD & DIRECTORY                             */}
      {/* ========================================================================= */}
      {activeTab === 'leaderboard' && (
        <div className="animate-fade-in">
          
          {/* Overview Cards */}
          <section className="kpi-grid" style={{ marginBottom: '24px' }}>
            <div className="kpi-card card-blue">
              <div className="kpi-header">
                <span className="kpi-title">Gross Revenue (Service Amt) • {activePeriodLabel}</span>
                <span className="kpi-icon"><TrendingUp size={18} /></span>
              </div>
              <h2 className="kpi-value">{formatLakhs(overallGross)}</h2>
              <div className="kpi-change up">
                <span>Aggregated client billing fees generated by TL teams</span>
              </div>
            </div>

            <div className="kpi-card card-purple">
              <div className="kpi-header">
                <span className="kpi-title">Net Revenue (R Share)</span>
                <span className="kpi-icon"><Percent size={18} /></span>
              </div>
              <h2 className="kpi-value">{formatLakhs(overallNet)}</h2>
              <div className="kpi-change up">
                <span>Company net share after franchise share payouts</span>
              </div>
            </div>

            <div className="kpi-card card-red">
              <div className="kpi-header">
                <span className="kpi-title">Total Potential Revenue Loss</span>
                <span className="kpi-icon"><Briefcase size={18} /></span>
              </div>
              <h2 className="kpi-value">{formatLakhs(overallLoss)}</h2>
              <div className="kpi-change down">
                <span>Billing loss from cancelled & internally closed enquiries</span>
              </div>
            </div>

            <div className="kpi-card card-green">
              <div className="kpi-header">
                <span className="kpi-title">Total Enquiries Managed</span>
                <span className="kpi-icon"><Users size={18} /></span>
              </div>
              <h2 className="kpi-value">{overallEnquiries}</h2>
              <div className="kpi-change up">
                <span>Volume of job allocation pipelines audited</span>
              </div>
            </div>
          </section>

          <div className="charts-grid-row">
            {/* Leaderboard Chart */}
            <div className="dashboard-card flex-1">
              <h3 className="card-title">Team Leader Revenue Leaderboard (Gross)</h3>
              <div className="card-content">
                <div className="leaderboard-bars">
                  {processedLeaders.map((tl, index) => {
                    const maxRevenue = Math.max(...processedLeaders.map(a => a.grossRevenue), 10000);
                    const percentage = (tl.grossRevenue / maxRevenue) * 100;
                    const colors = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6'];
                    const barColor = colors[index % colors.length];

                    return (
                      <div className="leaderboard-item" key={tl.id || index}>
                        <div className="leaderboard-item-header">
                          <div className="agent-rank-name">
                            <span className="rank-num">#{index + 1}</span>
                            <span className="agent-name font-bold">{tl.name}</span>
                          </div>
                          <span className="agent-revenue-value">{formatCurrency(tl.grossRevenue)}</span>
                        </div>
                        
                        <div className="leaderboard-bar-track">
                          <div 
                            className="leaderboard-bar-fill" 
                            style={{ width: `${percentage}%`, backgroundColor: barColor }}
                          ></div>
                        </div>
                        
                        <div className="leaderboard-item-footer" style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'flex-start', fontSize: '0.7rem' }}>
                          <div>
                            Enquiries: {tl.enquiriesProgressed || 0} Prog
                            {' / '}{tl.enquiriesCancelled || 0} Cancel
                            {' / '}{tl.enquiriesInternallyClosed || 0} Int. Close
                            {(tl.enquiriesInprogress || 0) > 0 && <span style={{color:'#60a5fa'}}> / {tl.enquiriesInprogress} Active</span>}
                            {' / '}{tl.totalEnquiries || 0} Total
                          </div>
                          <div style={{ color: 'var(--text-muted)' }}>Gross: {formatCurrency(tl.grossRevenue)} | Net Share: {formatCurrency(tl.netRevenue)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Directory Table */}
            <div className="dashboard-card flex-1">
              <div className="card-header-flex">
                <h3 className="card-title">Team Leaders Directory</h3>
              </div>

              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Team Leader</th>
                      <th>Enquiries Realization</th>
                      <th>Gross Revenue</th>
                      <th>Net Revenue</th>
                      <th>Revenue Loss</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const safeTlPage = Math.min(Math.max(1, tlPage), Math.max(1, Math.ceil(processedLeaders.length / TL_PER_PAGE)));
                      const paginatedLeaders = processedLeaders.slice((safeTlPage - 1) * TL_PER_PAGE, safeTlPage * TL_PER_PAGE);

                      return paginatedLeaders.map(tl => (
                        <tr 
                          key={tl.id || tl.name}
                          onClick={() => { setSelectedTlId(tl.name); setActiveTab('portfolio'); setKpiFilter('all'); }}
                          className="clickable-row-item"
                          style={{ cursor: 'pointer' }}
                        >
                          <td className="font-bold">
                            <div>{tl.name}</div>
                            <span style={{ fontSize: '0.7rem', color: 'var(--accent-teal)', fontWeight: 'normal' }}>
                              Click to view Franchisee Portfolio →
                            </span>
                          </td>
                          <td>
                            <div style={{ fontWeight: 'bold', fontSize: '0.8rem' }}>
                              <span style={{ color: '#10b981' }}>{tl.enquiriesProgressed || 0}P</span> / <span style={{ color: '#ef4444' }}>{tl.enquiriesCancelled || 0}C</span> / <span style={{ color: '#ea580c' }}>{tl.enquiriesInternallyClosed || 0}I</span>
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Total: {tl.totalEnquiries || 0}</div>
                          </td>
                          <td className="font-bold text-teal text-right">{formatCurrency(tl.grossRevenue)}</td>
                          <td className="font-bold text-right text-blue" style={{ color: 'var(--color-link)' }}>{formatCurrency(tl.netRevenue)}</td>
                          <td className="text-red font-bold text-right">{formatCurrency(tl.lossAmount)}</td>
                          <td>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveTLDetails(tl);
                                setModalPage(1);
                              }}
                              style={{
                                padding: '4px 8px',
                                borderRadius: '4px',
                                border: '1px solid var(--border-color)',
                                background: 'var(--bg-main)',
                                color: 'var(--text-main)',
                                fontSize: '0.72rem',
                                fontWeight: '600',
                                cursor: 'pointer'
                              }}
                            >
                              Audit Inflows
                            </button>
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>

              <Pagination
                currentPage={tlPage}
                totalItems={processedLeaders.length}
                pageSize={TL_PER_PAGE}
                onPageChange={setTlPage}
                itemName="team leaders"
              />
            </div>
          </div>
        </div>
      )}

      {/* Credit Note Deductions Audit Modal */}
      {isCreditNotesModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsCreditNotesModalOpen(false)}>
          <div className="modal-content animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '840px', width: '90%' }}>
            <div className="modal-header">
              <div className="modal-header-title">
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#1B2321', fontWeight: '700' }}>
                  Credit Note Deductions Audit • {selectedTlId}
                </h3>
                <span className="modal-subtitle" style={{ color: '#6B7268', fontSize: '0.8rem', marginTop: '2px', display: 'block' }}>
                  Total Deductions: <strong style={{ color: '#7C3AED' }}>-{formatCurrency(pTotals.credit_notes)}</strong> ({creditNoteDetails.length} Reversal Records)
                </span>
              </div>
              <button className="close-btn" onClick={() => setIsCreditNotesModalOpen(false)} aria-label="Close modal">
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto', padding: '20px' }}>
              <div style={{ padding: '12px', background: 'rgba(124, 58, 237, 0.08)', borderRadius: '8px', border: '1px solid rgba(124, 58, 237, 0.2)', marginBottom: '16px', fontSize: '0.82rem', color: '#5B21B6' }}>
                ℹ️ Credit notes represent billed revenue that was subsequently reversed (e.g. client replacement terms or negotiated invoice adjustments). They are deducted from Gross to ensure commercial revenue reconciles accurately.
              </div>

              {creditNoteDetails.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px 0' }}>No credit note deduction records found for this team leader.</p>
              ) : (
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Bill Reference</th>
                        <th>Franchisee</th>
                        <th>Client Entity</th>
                        <th style={{ textAlign: 'right' }}>Reversal Amount</th>
                        <th>Audit Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {creditNoteDetails.map((cn, i) => (
                        <tr key={i}>
                          <td style={{ whiteSpace: 'nowrap', fontSize: '0.78rem' }}>{cn.bill_date || '—'}</td>
                          <td className="font-mono font-bold" style={{ color: '#7C3AED' }}>{cn.bill_number}</td>
                          <td className="font-bold">{cn.franchisee}</td>
                          <td>{cn.company_name}</td>
                          <td className="font-bold text-right" style={{ color: '#7C3AED' }}>-{formatCurrency(cn.amount)}</td>
                          <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{cn.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Franchisee Detail Item Audit Drawer / Modal */}
      {selectedFranchiseeDetail && (
        <div className="modal-backdrop" onClick={() => setSelectedFranchiseeDetail(null)}>
          <div className="modal-content animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '920px', width: '92%' }}>
            <div className="modal-header">
              <div className="modal-header-title">
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#1B2321', fontWeight: '700' }}>
                  Franchisee Financial Audit: {selectedFranchiseeDetail.name}
                </h3>
                <span className="modal-subtitle" style={{ color: '#6B7268', fontSize: '0.8rem', marginTop: '2px', display: 'block' }}>
                  Team Leader: {selectedTlId} • Gross Billing: <strong style={{ color: 'var(--text-main)' }}>{formatCurrency(selectedFranchiseeDetail.gross)}</strong> • Received: <strong style={{ color: '#0F6E56' }}>{formatCurrency(selectedFranchiseeDetail.received)}</strong> ({selectedFranchiseeDetail.received_pct}%) • Outstanding: <strong style={{ color: '#B7791F' }}>{formatCurrency(selectedFranchiseeDetail.outstanding)}</strong>
                </span>
              </div>
              <button className="close-btn" onClick={() => setSelectedFranchiseeDetail(null)} aria-label="Close modal">
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ maxHeight: '74vh', overflowY: 'auto', padding: '20px' }}>
              
              {/* 4 Stat Overview Cards */}
              <div className="stats-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '16px' }}>
                <div className="stat-box" style={{ background: 'var(--bg-main)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '0.70rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>Gross Commercial</span>
                  <h4 style={{ margin: '4px 0 0 0', color: 'var(--text-main)', fontSize: '1.05rem', fontWeight: '800' }}>
                    {formatCurrency(selectedFranchiseeDetail.gross)}
                  </h4>
                </div>

                <div className="stat-box" style={{ background: 'rgba(15, 110, 86, 0.06)', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(15, 110, 86, 0.2)' }}>
                  <span style={{ fontSize: '0.70rem', color: '#0F6E56', fontWeight: '600', textTransform: 'uppercase' }}>Received Collections</span>
                  <h4 style={{ margin: '4px 0 0 0', color: '#0F6E56', fontSize: '1.05rem', fontWeight: '800' }}>
                    {formatCurrency(selectedFranchiseeDetail.received)}
                  </h4>
                  <span style={{ fontSize: '0.68rem', color: '#0F6E56', display: 'block', marginTop: '2px' }}>
                    {selectedFranchiseeDetail.received_pct}% of Gross Billing
                  </span>
                </div>

                <div className="stat-box" style={{ background: 'rgba(234, 179, 8, 0.08)', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(234, 179, 8, 0.25)' }}>
                  <span style={{ fontSize: '0.70rem', color: '#B7791F', fontWeight: '600', textTransform: 'uppercase' }}>Outstanding Pending</span>
                  <h4 style={{ margin: '4px 0 0 0', color: '#B7791F', fontSize: '1.05rem', fontWeight: '800' }}>
                    {formatCurrency(selectedFranchiseeDetail.outstanding)}
                  </h4>
                  <span style={{ fontSize: '0.68rem', color: '#B7791F', display: 'block', marginTop: '2px' }}>
                    Avg {selectedFranchiseeDetail.avg_days_outstanding}d SLA
                  </span>
                </div>

                <div className="stat-box" style={{ background: 'var(--bg-main)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '0.70rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>AI Recovery Forecast</span>
                  <h4 style={{ margin: '4px 0 0 0', color: '#0F6E56', fontSize: '1.05rem', fontWeight: '800' }}>
                    {formatCurrency(selectedFranchiseeDetail.expected_collectible)}
                  </h4>
                  <span style={{ fontSize: '0.68rem', color: selectedFranchiseeDetail.collection_risk?.band_key === 'likely' ? '#0F6E56' : '#B7791F', display: 'block', marginTop: '2px' }}>
                    {selectedFranchiseeDetail.collection_risk?.score}% ({selectedFranchiseeDetail.collection_risk?.band})
                  </span>
                </div>
              </div>

              {/* Sub-Tab Navigation Bar within Franchisee Modal */}
              <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '14px' }}>
                <button
                  onClick={() => setFranModalTab('received')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    borderRadius: '6px',
                    border: 'none',
                    background: franModalTab === 'received' ? '#0F6E56' : 'transparent',
                    color: franModalTab === 'received' ? '#ffffff' : 'var(--text-muted)',
                    fontWeight: franModalTab === 'received' ? '700' : '500',
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <TrendingUp size={15} />
                  <span>🟢 Received Inflows ({selectedFranchiseeDetail.received_items?.length || selectedFranchiseeDetail.received_count || 0})</span>
                </button>

                <button
                  onClick={() => setFranModalTab('outstanding')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    borderRadius: '6px',
                    border: 'none',
                    background: franModalTab === 'outstanding' ? '#B7791F' : 'transparent',
                    color: franModalTab === 'outstanding' ? '#ffffff' : 'var(--text-muted)',
                    fontWeight: franModalTab === 'outstanding' ? '700' : '500',
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Clock size={15} />
                  <span>🟡 Outstanding & In-Progress ({selectedFranchiseeDetail.outstanding_items?.length || selectedFranchiseeDetail.outstanding_count || 0})</span>
                </button>

                <button
                  onClick={() => setFranModalTab('cancelled')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    borderRadius: '6px',
                    border: 'none',
                    background: franModalTab === 'cancelled' ? '#A8402E' : 'transparent',
                    color: franModalTab === 'cancelled' ? '#ffffff' : 'var(--text-muted)',
                    fontWeight: franModalTab === 'cancelled' ? '700' : '500',
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Briefcase size={15} />
                  <span>🔴 Cancelled & Credit Notes ({(selectedFranchiseeDetail.cancelled_items?.length || 0) + (selectedFranchiseeDetail.credit_note_items?.length || 0)})</span>
                </button>
              </div>

              {/* TAB 1: RECEIVED INFLOWS */}
              {franModalTab === 'received' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '0.84rem', fontWeight: '700', color: '#0F6E56' }}>
                      Settled Inflows & Closed Placements ({selectedFranchiseeDetail.received_items?.length || 0} Records • Total: {formatCurrency(selectedFranchiseeDetail.received)})
                    </span>
                  </div>

                  {(!selectedFranchiseeDetail.received_items || selectedFranchiseeDetail.received_items.length === 0) ? (
                    <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px 0' }}>
                      No closed placement or settled invoice records found for this franchisee.
                    </p>
                  ) : (
                    <div className="table-responsive">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Bill Date</th>
                            <th>Bill / Invoice #</th>
                            <th>Client / Corporate</th>
                            <th>Position Name</th>
                            <th>Status</th>
                            <th style={{ textAlign: 'right' }}>Received Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedFranchiseeDetail.received_items.map((item, idx) => (
                            <tr key={idx}>
                              <td style={{ whiteSpace: 'nowrap', fontSize: '0.78rem' }}>{item.bill_date || '—'}</td>
                              <td className="font-mono font-bold" style={{ color: '#0F6E56' }}>{item.bill_number}</td>
                              <td className="font-bold">{item.company_name}</td>
                              <td>{item.position_name}</td>
                              <td>
                                <span style={{
                                  display: 'inline-block',
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  fontSize: '0.72rem',
                                  fontWeight: '700',
                                  background: 'rgba(16, 185, 129, 0.15)',
                                  color: '#0F6E56'
                                }}>
                                  {item.status || 'Invoiced'}
                                </span>
                              </td>
                              <td className="font-bold text-right" style={{ color: '#0F6E56' }}>
                                {formatCurrency(item.amount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: OUTSTANDING & COLLECTION RISK */}
              {franModalTab === 'outstanding' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '0.84rem', fontWeight: '700', color: '#B7791F' }}>
                      Open In-Progress Pipelines & Outstanding Invoices ({selectedFranchiseeDetail.outstanding_items?.length || 0} Records • Total: {formatCurrency(selectedFranchiseeDetail.outstanding)})
                    </span>
                  </div>

                  {(!selectedFranchiseeDetail.outstanding_items || selectedFranchiseeDetail.outstanding_items.length === 0) ? (
                    <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px 0' }}>
                      No open outstanding invoice or pipeline items for this franchisee.
                    </p>
                  ) : (
                    <div className="table-responsive">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Enquiry ID</th>
                            <th>Client / Company</th>
                            <th>Position</th>
                            <th>Pipeline Status</th>
                            <th style={{ textAlign: 'right' }}>Amount</th>
                            <th style={{ textAlign: 'center' }}>Days Aged</th>
                            <th style={{ textAlign: 'center' }}>Aging Factor</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedFranchiseeDetail.outstanding_items.map((item, idx) => {
                            const isRevised = String(item.status).toLowerCase() === 'revised';
                            return (
                              <tr key={idx}>
                                <td className="font-mono">#{item.enquiry_id}</td>
                                <td className="font-bold">{item.company_name}</td>
                                <td>{item.position_name}</td>
                                <td>
                                  <span style={{
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    fontSize: '0.72rem',
                                    fontWeight: '700',
                                    background: isRevised ? 'rgba(234, 179, 8, 0.2)' : 'rgba(59, 130, 246, 0.15)',
                                    color: isRevised ? '#B7791F' : '#2563EB'
                                  }}>
                                    {item.status}
                                  </span>
                                </td>
                                <td className="font-bold text-right" style={{ color: '#B7791F' }}>
                                  {formatCurrency(item.amount)}
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <span style={{
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    fontSize: '0.72rem',
                                    fontWeight: '600',
                                    background: item.days_outstanding > 75 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                                    color: item.days_outstanding > 75 ? '#A8402E' : '#B7791F'
                                  }}>
                                    {item.days_outstanding}d
                                  </span>
                                </td>
                                <td style={{ textAlign: 'center', fontSize: '0.75rem', fontWeight: '700', color: isRevised ? '#B7791F' : 'var(--text-muted)' }}>
                                  {isRevised ? '0.70x (Revised Pipeline)' : '1.00x'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: CANCELLED & CREDIT NOTES */}
              {franModalTab === 'cancelled' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '0.84rem', fontWeight: '700', color: '#A8402E' }}>
                      Cancelled Enquiries & Credit Note Deductions (Cancelled: {formatCurrency(selectedFranchiseeDetail.cancelled)} • Credit Notes: -{formatCurrency(selectedFranchiseeDetail.credit_notes)})
                    </span>
                  </div>

                  {((!selectedFranchiseeDetail.cancelled_items || selectedFranchiseeDetail.cancelled_items.length === 0) &&
                    (!selectedFranchiseeDetail.credit_note_items || selectedFranchiseeDetail.credit_note_items.length === 0)) ? (
                    <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px 0' }}>
                      No cancelled enquiries or credit note reversals recorded for this franchisee.
                    </p>
                  ) : (
                    <div className="table-responsive">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Ref / ID</th>
                            <th>Client Entity</th>
                            <th>Position / Details</th>
                            <th>Classification</th>
                            <th style={{ textAlign: 'right' }}>Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {/* Cancelled Enquiries */}
                          {(selectedFranchiseeDetail.cancelled_items || []).map((item, idx) => (
                            <tr key={`canc-${idx}`}>
                              <td style={{ whiteSpace: 'nowrap', fontSize: '0.78rem' }}>{item.date || '—'}</td>
                              <td className="font-mono">#{item.enquiry_id}</td>
                              <td className="font-bold">{item.company_name}</td>
                              <td>{item.position_name}</td>
                              <td>
                                <span style={{
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  fontSize: '0.72rem',
                                  fontWeight: '700',
                                  background: 'rgba(239, 68, 68, 0.15)',
                                  color: '#A8402E'
                                }}>
                                  {item.status || 'Cancelled'}
                                </span>
                              </td>
                              <td className="font-bold text-right" style={{ color: '#A8402E' }}>
                                {formatCurrency(item.amount)}
                              </td>
                            </tr>
                          ))}

                          {/* Credit Notes */}
                          {(selectedFranchiseeDetail.credit_note_items || []).map((item, idx) => (
                            <tr key={`cn-${idx}`}>
                              <td style={{ whiteSpace: 'nowrap', fontSize: '0.78rem' }}>{item.bill_date || '—'}</td>
                              <td className="font-mono font-bold" style={{ color: '#7C3AED' }}>{item.bill_number}</td>
                              <td className="font-bold">{item.company_name}</td>
                              <td>{item.position_name || item.reason}</td>
                              <td>
                                <span style={{
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  fontSize: '0.72rem',
                                  fontWeight: '700',
                                  background: 'rgba(124, 58, 237, 0.15)',
                                  color: '#7C3AED'
                                }}>
                                  Credit Note
                                </span>
                              </td>
                              <td className="font-bold text-right" style={{ color: '#7C3AED' }}>
                                -{formatCurrency(item.amount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* Drilldown Modal for Closed Placements Audit */}
      {activeTLDetails && (() => {
        const currentTL = activeTLDetails;
        const detailTxs = transactions.filter(t => 
          t.teamLeaderName && 
          t.teamLeaderName.trim().toLowerCase() === currentTL.name.trim().toLowerCase() &&
          isInFilteredPeriod(t)
        );

        const progressed = currentTL.enquiriesProgressed || 0;
        const cancelled = currentTL.enquiriesCancelled || 0;
        const internallyClosed = currentTL.enquiriesInternallyClosed || 0;
        const total = Math.max(1, currentTL.totalEnquiries || 0, progressed + cancelled + internallyClosed);

        const progressedPct = Math.min(100, Math.max(0, (progressed / total) * 100));
        const cancelledPct = Math.min(100 - progressedPct, Math.max(0, (cancelled / total) * 100));
        const internallyClosedPct = Math.min(100 - progressedPct - cancelledPct, Math.max(0, (internallyClosed / total) * 100));
        const pendingPct = Math.max(0, 100 - progressedPct - cancelledPct - internallyClosedPct);
        const realizationPct = Math.min(100, Math.round(((progressed + cancelled + internallyClosed) / total) * 100));

        return (
          <div className="modal-backdrop" onClick={() => setActiveTLDetails(null)}>
            <div className="modal-content animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '960px', width: '92%' }}>
              <div className="modal-header">
                <div className="modal-header-title">
                  <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#1B2321', fontWeight: '700' }}>
                    Performance Audit: {currentTL.name}
                  </h3>
                  <span className="modal-subtitle" style={{ color: '#6B7268', fontSize: '0.8rem', marginTop: '2px', display: 'block' }}>
                    Team Leader Pipeline & Placement Realization • {activePeriodLabel}
                  </span>
                </div>
                <button className="close-btn" onClick={() => setActiveTLDetails(null)} aria-label="Close modal">
                  <X size={18} />
                </button>
              </div>

              <div className="modal-body" style={{ maxHeight: '76vh', overflowY: 'auto', padding: '20px 24px', backgroundColor: '#FFFFFF' }}>
                <h4 style={{ color: '#1B2321', margin: '0 0 0.75rem 0', fontWeight: '700', fontSize: '0.92rem' }}>
                  Enquiry Pipeline & Realization
                </h4>
                
                {/* Progress Bar */}
                <div style={{ background: '#F6F7F4', padding: '14px', borderRadius: '10px', border: '1px solid #E3E5E0', marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', height: '24px', borderRadius: '6px', overflow: 'hidden', backgroundColor: '#E3E5E0' }}>
                    {progressedPct > 0 && (
                      <div 
                        style={{ 
                          width: `${progressedPct}%`, 
                          backgroundColor: '#0F6E56', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          color: '#fff', 
                          fontSize: '0.72rem', 
                          fontWeight: '600',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          padding: '0 4px',
                          boxSizing: 'border-box'
                        }} 
                        title={`${progressed} Progressed (${progressedPct.toFixed(1)}%)`}
                      >
                        {progressedPct >= 14 ? `${progressed} Prog (${progressedPct.toFixed(0)}%)` : (progressedPct >= 7 ? `${progressed}` : '')}
                      </div>
                    )}
                    {cancelledPct > 0 && (
                      <div 
                        style={{ 
                          width: `${cancelledPct}%`, 
                          backgroundColor: '#A8402E', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          color: '#fff', 
                          fontSize: '0.72rem', 
                          fontWeight: '600',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          padding: '0 4px',
                          boxSizing: 'border-box'
                        }} 
                        title={`${cancelled} Cancelled (${cancelledPct.toFixed(1)}%)`}
                      >
                        {cancelledPct >= 14 ? `${cancelled} Cancel (${cancelledPct.toFixed(0)}%)` : (cancelledPct >= 7 ? `${cancelled}` : '')}
                      </div>
                    )}
                    {internallyClosedPct > 0 && (
                      <div 
                        style={{ 
                          width: `${internallyClosedPct}%`, 
                          backgroundColor: '#B7791F', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          color: '#fff', 
                          fontSize: '0.72rem', 
                          fontWeight: '600',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          padding: '0 4px',
                          boxSizing: 'border-box'
                        }} 
                        title={`${internallyClosed} Internally Closed (${internallyClosedPct.toFixed(1)}%)`}
                      >
                        {internallyClosedPct >= 14 ? `${internallyClosed} Int. (${internallyClosedPct.toFixed(0)}%)` : (internallyClosedPct >= 7 ? `${internallyClosed}` : '')}
                      </div>
                    )}
                    {pendingPct > 0 && (
                      <div 
                        style={{ 
                          width: `${pendingPct}%`, 
                          backgroundColor: '#94A3B8', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          color: '#fff', 
                          fontSize: '0.72rem', 
                          fontWeight: '600',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          padding: '0 4px',
                          boxSizing: 'border-box'
                        }} 
                        title={`${Math.max(0, total - progressed - cancelled - internallyClosed)} Pending (${pendingPct.toFixed(1)}%)`}
                      >
                        {pendingPct >= 14 ? `Pending (${pendingPct.toFixed(0)}%)` : ''}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.75rem', color: '#6B7268', fontWeight: '500' }}>
                    <span>Total Enquiries: <strong style={{ color: '#1B2321' }}>{total}</strong></span>
                    <span>Pipeline Realization: <strong style={{ color: '#0F6E56' }}>{realizationPct}%</strong></span>
                  </div>
                </div>

                {/* KPI Metrics */}
                <div className="stats-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '1.5rem' }}>
                  <div className="stat-box" style={{ background: '#F6F7F4', padding: '14px', borderRadius: '10px', border: '1px solid #E3E5E0' }}>
                    <span className="stat-label" style={{ fontSize: '0.75rem', color: '#6B7268', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Gross Revenue (Service Amt)</span>
                    <h4 style={{ color: '#0F6E56', margin: '6px 0 0 0', fontSize: '1.25rem', fontWeight: '700' }}>{formatCurrency(currentTL.grossRevenue)}</h4>
                  </div>
                  <div className="stat-box" style={{ background: '#F6F7F4', padding: '14px', borderRadius: '10px', border: '1px solid #E3E5E0' }}>
                    <span className="stat-label" style={{ fontSize: '0.75rem', color: '#6B7268', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Net Revenue (R Share)</span>
                    <h4 style={{ color: '#22314F', margin: '6px 0 0 0', fontSize: '1.25rem', fontWeight: '700' }}>{formatCurrency(currentTL.netRevenue)}</h4>
                  </div>
                  <div className="stat-box" style={{ background: '#F6F7F4', padding: '14px', borderRadius: '10px', border: '1px solid #E3E5E0' }}>
                    <span className="stat-label" style={{ fontSize: '0.75rem', color: '#6B7268', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Potential Revenue Loss</span>
                    <h4 style={{ color: '#A8402E', margin: '6px 0 0 0', fontSize: '1.25rem', fontWeight: '700' }}>{formatCurrency(currentTL.lossAmount)}</h4>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', marginTop: '1.25rem' }}>
                  <h4 style={{ color: '#1B2321', margin: 0, fontWeight: '700', fontSize: '0.92rem' }}>
                    Closed Placement Inflows ({detailTxs.length}) • {activePeriodLabel}
                  </h4>
                </div>

                {detailTxs.length === 0 ? (
                  <p style={{ color: '#6B7268', fontSize: '0.85rem', padding: '20px 0', textAlign: 'center' }}>No closed placement income transactions linked to this team leader for this period.</p>
                ) : (() => {
                  const ITEMS_PER_PAGE = 10;
                  const totalPages = Math.ceil(detailTxs.length / ITEMS_PER_PAGE);
                  const safeModalPage = Math.min(Math.max(1, modalPage), totalPages);
                  const paginatedTxs = detailTxs.slice((safeModalPage - 1) * ITEMS_PER_PAGE, safeModalPage * ITEMS_PER_PAGE);

                  return (
                    <div>
                      <div className="table-responsive" style={{ border: '1px solid #E3E5E0', borderRadius: '8px', overflow: 'hidden' }}>
                        <table className="data-table" style={{ fontSize: '0.82rem', width: '100%', margin: 0 }}>
                          <thead>
                            <tr style={{ background: '#FAFAF8', borderBottom: '1px solid #E3E5E0' }}>
                              <th style={{ color: '#6B7268', background: '#FAFAF8', padding: '10px 14px', fontWeight: '600', width: '110px' }}>Date</th>
                              <th style={{ color: '#6B7268', background: '#FAFAF8', padding: '10px 14px', fontWeight: '600' }}>Inflow Detail / Position</th>
                              <th style={{ color: '#6B7268', background: '#FAFAF8', padding: '10px 14px', fontWeight: '600', width: '100px' }}>Status</th>
                              <th style={{ color: '#6B7268', background: '#FAFAF8', padding: '10px 14px', fontWeight: '600', textAlign: 'right', width: '120px' }}>Service Amt</th>
                              <th style={{ color: '#6B7268', background: '#FAFAF8', padding: '10px 14px', fontWeight: '600', textAlign: 'right', width: '120px' }}>R Share</th>
                            </tr>
                          </thead>
                          <tbody>
                            {paginatedTxs.map(t => (
                              <tr key={t.id} style={{ borderBottom: '1px solid #E3E5E0' }}>
                                <td style={{ color: '#6B7268', padding: '10px 14px', whiteSpace: 'nowrap' }}>{formatDate(t.date)}</td>
                                <td style={{ padding: '10px 14px' }}>
                                  <div style={{ fontWeight: '600', color: '#1B2321', fontSize: '0.84rem' }}>{t.title}</div>
                                  <div style={{ fontSize: '0.72rem', color: '#6B7268', marginTop: '2px' }}>Category: {t.category} • {t.subCategory || 'General'}</div>
                                </td>
                                <td style={{ padding: '10px 14px' }}>
                                  <span style={{
                                    display: 'inline-block',
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    fontSize: '0.72rem',
                                    fontWeight: '600',
                                    backgroundColor: '#E6F4EA',
                                    color: '#0F6E56'
                                  }}>
                                    {t.enquiryStatus || 'Closed'}
                                  </span>
                                </td>
                                <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '700', color: '#1B2321' }}>
                                  {formatCurrency(t.serviceAmt || t.amount)}
                                </td>
                                <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '700', color: '#0F6E56' }}>
                                  {formatCurrency(t.rShare)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <Pagination
                        currentPage={safeModalPage}
                        totalItems={detailTxs.length}
                        pageSize={ITEMS_PER_PAGE}
                        onPageChange={setModalPage}
                        itemName="records"
                        style={{ marginTop: '8px', padding: '10px 4px' }}
                      />
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default TLPerformance;
