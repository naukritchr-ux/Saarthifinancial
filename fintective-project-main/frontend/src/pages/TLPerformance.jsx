import React, { useContext, useState, useEffect, useMemo } from 'react';
import { FinanceContext, API_BASE_URL } from '../context/FinanceContext';
import { fetchWithApiKey } from '../utils/apiClient';
import { formatCurrency, formatLakhs, formatDate } from '../utils/formatters';
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
  ArrowUpDown
} from 'lucide-react';
import Pagination from '../components/Pagination';

const TLPerformance = () => {
  const { teamLeaders, transactions, selectedMonth, selectedYear } = useContext(FinanceContext);
  
  // Navigation sub-tabs within TL tab
  const [activeTab, setActiveTab] = useState('portfolio'); // 'portfolio' | 'leaderboard'
  
  // Detail Modal state
  const [activeTLDetails, setActiveTLDetails] = useState(null);
  const [modalPage, setModalPage] = useState(1);
  const [selectedFranchiseeDetail, setSelectedFranchiseeDetail] = useState(null);

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

    const { start, end } = getPeriodDates(selectedMonth, selectedYear);
    const url = `${API_BASE_URL}/tl-tracking/${encodeURIComponent(selectedTlId)}/portfolio?start_date=${start}&end_date=${end}&lookback_months=${lookbackMonths}&sort_by=${sortBy}`;
    
    fetchWithApiKey(url)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        setPortfolioData(data);
      })
      .catch(err => {
        console.error("Failed to load TL portfolio:", err);
        setPortfolioError("Unable to load live franchisee portfolio for this team leader.");
      })
      .finally(() => {
        setPortfolioLoading(false);
      });
  }, [selectedTlId, selectedMonth, selectedYear, lookbackMonths, sortBy]);

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
    received: 0,
    received_pct: 0,
    outstanding: 0,
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

  const franchisees = portfolioData?.franchisees || [];

  // Proportional Stacked Bar segments
  const totalBarBase = Math.max(1, pTotals.received + pTotals.outstanding + pTotals.cancelled);
  const barReceivedPct = Math.min(100, Math.max(0, (pTotals.received / totalBarBase) * 100));
  const barOutstandingPct = Math.min(100 - barReceivedPct, Math.max(0, (pTotals.outstanding / totalBarBase) * 100));
  const barCancelledPct = Math.max(0, 100 - barReceivedPct - barOutstandingPct);

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

        {/* TL Selector & Quick Lookback Control when in Portfolio mode */}
        {activeTab === 'portfolio' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Team Leader:</span>
              <select
                value={selectedTlId}
                onChange={(e) => setSelectedTlId(e.target.value)}
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
                    {tl.name}
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
            {effectiveLeaders.slice(0, 6).map(tl => {
              const isSelected = selectedTlId === tl.name || selectedTlId === tl.id;
              return (
                <button
                  key={tl.id || tl.name}
                  onClick={() => setSelectedTlId(tl.name || tl.id)}
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

          {/* 5 KPI Cards: 4 Commercial Buckets + AI Expected Collectible Forecast */}
          <section className="kpi-grid" style={{ marginBottom: '24px' }}>
            
            {/* 1. Gross Revenue */}
            <div className="kpi-card card-blue">
              <div className="kpi-header">
                <span className="kpi-title">Gross Commercial Billing</span>
                <span className="kpi-icon"><DollarSign size={18} /></span>
              </div>
              <h2 className="kpi-value">{formatLakhs(pTotals.gross)}</h2>
              <div className="kpi-change" style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                <span>
                  ℹ️ Excludes {pTotals.admin_closures_count || 0} admin closures ({formatLakhs(pTotals.admin_closures || 0)})
                </span>
              </div>
            </div>

            {/* 2. Received Revenue */}
            <div className="kpi-card card-green">
              <div className="kpi-header">
                <span className="kpi-title">Received Revenue</span>
                <span className="kpi-icon"><TrendingUp size={18} /></span>
              </div>
              <h2 className="kpi-value" style={{ color: '#0F6E56' }}>{formatLakhs(pTotals.received)}</h2>
              <div className="kpi-change up">
                <span>{pTotals.received_pct}% of Gross Billing</span>
              </div>
            </div>

            {/* 3. In-Progress / Outstanding */}
            <div className="kpi-card card-yellow" style={{ borderColor: 'rgba(234, 179, 8, 0.3)' }}>
              <div className="kpi-header">
                <span className="kpi-title">In-Progress / Outstanding</span>
                <span className="kpi-icon"><Clock size={18} /></span>
              </div>
              <h2 className="kpi-value" style={{ color: '#B7791F' }}>{formatLakhs(pTotals.outstanding)}</h2>
              <div className="kpi-change" style={{ color: '#B7791F' }}>
                <span>{pTotals.outstanding_pct}% pending collection</span>
              </div>
            </div>

            {/* 4. Cancelled Billing */}
            <div className="kpi-card card-red">
              <div className="kpi-header">
                <span className="kpi-title">Cancelled Billing</span>
                <span className="kpi-icon"><Briefcase size={18} /></span>
              </div>
              <h2 className="kpi-value" style={{ color: '#A8402E' }}>{formatLakhs(pTotals.cancelled)}</h2>
              <div className="kpi-change down">
                <span>{pTotals.cancelled_pct}% cancelled / lost</span>
              </div>
            </div>

            {/* 5. Expected Collectible Amount (AI Forecast) */}
            <div className="kpi-card" style={{ 
              background: 'linear-gradient(135deg, rgba(15, 110, 86, 0.08) 0%, rgba(34, 49, 79, 0.05) 100%)', 
              border: '1.5px solid rgba(15, 110, 86, 0.4)',
              boxShadow: '0 4px 12px rgba(15, 110, 86, 0.06)'
            }}>
              <div className="kpi-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles size={16} color="#0F6E56" />
                  <span className="kpi-title" style={{ color: '#0F6E56', fontWeight: '700' }}>Expected Collectible</span>
                </div>
                <span className="kpi-icon" style={{ background: 'rgba(15, 110, 86, 0.15)', color: '#0F6E56' }}><Award size={18} /></span>
              </div>
              <h2 className="kpi-value" style={{ color: '#0F6E56', fontWeight: '800' }}>
                {formatLakhs(pTotals.expected_collectible)}
              </h2>
              <div className="kpi-change" style={{ color: '#6B7268', fontSize: '0.74rem' }}>
                <span>
                  Expected Loss: <strong style={{ color: '#A8402E' }}>{formatLakhs(pTotals.expected_loss)}</strong> ({pTotals.outstanding > 0 ? ((pTotals.expected_collectible / pTotals.outstanding) * 100).toFixed(0) : 0}% recovery)
                </span>
              </div>
            </div>

          </section>

          {/* Proportional Stacked Breakdown Bar + Credit Note Deduction Segment */}
          <div className="dashboard-card" style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <h3 className="card-title" style={{ margin: 0, fontSize: '1rem', fontWeight: '700' }}>
                  Financial Status Breakdown Bar (Commercial Reconciliation)
                </h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Cancelled (🔴) → Outstanding (🟡) → Received (🟢) with Striped Credit Note Deductions (🟣)
                </span>
              </div>

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

            {/* Horizontal Stacked Bar */}
            <div style={{ background: '#E3E5E0', borderRadius: '8px', overflow: 'hidden', height: '34px', display: 'flex', position: 'relative' }}>
              
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
                    transition: 'width 0.3s ease'
                  }}
                  title={`Cancelled: ${formatLakhs(pTotals.cancelled)} (${barCancelledPct.toFixed(1)}%)`}
                >
                  {barCancelledPct >= 10 ? `Cancelled ${formatLakhs(pTotals.cancelled)} (${barCancelledPct.toFixed(0)}%)` : ''}
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
                    transition: 'width 0.3s ease'
                  }}
                  title={`Outstanding / In-Progress: ${formatLakhs(pTotals.outstanding)} (${barOutstandingPct.toFixed(1)}%)`}
                >
                  {barOutstandingPct >= 10 ? `Outstanding ${formatLakhs(pTotals.outstanding)} (${barOutstandingPct.toFixed(0)}%)` : ''}
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
                    transition: 'width 0.3s ease'
                  }}
                  title={`Received: ${formatLakhs(pTotals.received)} (${barReceivedPct.toFixed(1)}%)`}
                >
                  {barReceivedPct >= 10 ? `Received ${formatLakhs(pTotals.received)} (${barReceivedPct.toFixed(0)}%)` : ''}
                </div>
              )}

              {/* Credit Note Deduction (Striped Purple Overlay) */}
              {pTotals.credit_notes > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 0,
                    bottom: 0,
                    width: `${Math.min(30, (pTotals.credit_notes / totalBarBase) * 100)}%`,
                    background: 'repeating-linear-gradient(45deg, rgba(124, 58, 237, 0.85), rgba(124, 58, 237, 0.85) 6px, rgba(109, 40, 217, 0.95) 6px, rgba(109, 40, 217, 0.95) 12px)',
                    borderLeft: '2px solid #ffffff',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.7rem',
                    fontWeight: '700',
                    textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                    padding: '0 4px'
                  }}
                  title={`Credit Note Deductions: -${formatLakhs(pTotals.credit_notes)}`}
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
                    <span>Credit Note Deductions: <strong style={{ color: '#7C3AED' }}>-{formatLakhs(pTotals.credit_notes)}</strong></span>
                  </div>
                )}
              </div>

              <div>
                <span style={{ fontStyle: 'italic' }}>
                  Reconciliation: Gross = Received ({formatLakhs(pTotals.received)}) + Outstanding ({formatLakhs(pTotals.outstanding)}) + Cancelled ({formatLakhs(pTotals.cancelled)}) - CN ({formatLakhs(pTotals.credit_notes)})
                </span>
              </div>
            </div>
          </div>

          {/* Franchisee Portfolio Table with Collection Risk Scoring */}
          <div className="dashboard-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 className="card-title" style={{ margin: 0, fontSize: '1rem', fontWeight: '700' }}>
                  Franchisee Portfolio Breakdown & Collection Risk ({franchisees.length} Franchisees)
                </h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Prioritized by Collection Risk: Aging factor (45%) + TL Conversion (35%) + Franchisee Track Record (20%)
                </span>
              </div>

              {/* Sort Controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-main)', padding: '3px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', paddingLeft: '6px' }}>Sort By:</span>
                <button
                  onClick={() => setSortBy('risk')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '4px',
                    border: 'none',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    background: sortBy === 'risk' ? 'var(--accent-teal)' : 'transparent',
                    color: sortBy === 'risk' ? '#fff' : 'var(--text-muted)'
                  }}
                >
                  Highest Risk Outstanding 🔴
                </button>
                <button
                  onClick={() => setSortBy('outstanding')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '4px',
                    border: 'none',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    background: sortBy === 'outstanding' ? 'var(--accent-teal)' : 'transparent',
                    color: sortBy === 'outstanding' ? '#fff' : 'var(--text-muted)'
                  }}
                >
                  Largest Outstanding 🟡
                </button>
                <button
                  onClick={() => setSortBy('gross')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '4px',
                    border: 'none',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    background: sortBy === 'gross' ? 'var(--accent-teal)' : 'transparent',
                    color: sortBy === 'gross' ? '#fff' : 'var(--text-muted)'
                  }}
                >
                  Highest Gross 🟢
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
            ) : franchisees.length === 0 ? (
              <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                No active franchisee pipeline records attributed to {selectedTlId} in this period.
              </div>
            ) : (() => {
              const safeFranPage = Math.min(Math.max(1, franPage), Math.max(1, Math.ceil(franchisees.length / FRAN_PER_PAGE)));
              const paginatedFrans = franchisees.slice((safeFranPage - 1) * FRAN_PER_PAGE, safeFranPage * FRAN_PER_PAGE);

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
                            <tr key={idx} className="clickable-row-item">
                              <td className="font-bold">
                                <div>{f.name}</div>
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                  {f.received_count} closed • {f.outstanding_count} pending
                                </span>
                              </td>

                              <td className="font-bold text-right">
                                {formatCurrency(f.gross)}
                              </td>

                              <td className="text-right">
                                <div style={{ color: '#0F6E56', fontWeight: '700' }}>{formatCurrency(f.received)}</div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{f.received_pct}%</div>
                              </td>

                              <td className="text-right">
                                <div style={{ color: f.outstanding > 0 ? '#B7791F' : 'var(--text-muted)', fontWeight: '700' }}>
                                  {formatCurrency(f.outstanding)}
                                </div>
                                {f.outstanding > 0 && (
                                  <div style={{ display: 'inline-block', padding: '1px 6px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: '600', background: f.avg_days_outstanding > 75 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(234, 179, 8, 0.15)', color: f.avg_days_outstanding > 75 ? '#A8402E' : '#B7791F' }}>
                                    Avg {f.avg_days_outstanding}d SLA
                                  </div>
                                )}
                              </td>

                              <td className="text-right">
                                <div style={{ color: f.cancelled > 0 ? '#A8402E' : 'var(--text-muted)', fontWeight: '600' }}>
                                  {formatCurrency(f.cancelled)}
                                </div>
                                {f.credit_notes > 0 && (
                                  <div style={{ fontSize: '0.7rem', color: '#7C3AED', fontWeight: '600' }}>
                                    CN: -{formatCurrency(f.credit_notes)}
                                  </div>
                                )}
                              </td>

                              <td style={{ textAlign: 'center' }}>
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

                              <td className="text-right font-bold" style={{ color: '#0F6E56' }}>
                                {f.outstanding > 0 ? formatCurrency(f.expected_collectible) : '—'}
                              </td>

                              <td style={{ textAlign: 'center' }}>
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
                    totalItems={franchisees.length}
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
                          onClick={() => { setSelectedTlId(tl.name); setActiveTab('portfolio'); }}
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
