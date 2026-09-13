import React, { useContext, useState, useEffect, useMemo } from 'react';
import { FinanceContext, API_BASE_URL } from '../context/FinanceContext';
import { fetchWithApiKey } from '../utils/apiClient';
import { formatCurrency, formatLakhs, formatDate } from '../utils/formatters';
import { TrendingUp, Plus, Award, Briefcase, X, Percent, ChevronLeft, ChevronRight, Users } from 'lucide-react';

const TLPerformance = () => {
  const { teamLeaders, transactions, selectedMonth, selectedYear } = useContext(FinanceContext);
  const [activeTLDetails, setActiveTLDetails] = useState(null); // Detail modal state
  const [modalPage, setModalPage] = useState(1); // Modal table pagination page

  // Period filter checks both selectedMonth and selectedYear
  const isInFilteredPeriod = (tx) => {
    if (!tx || !tx.date) return false;
    
    // Month Match
    let monthMatch = true;
    if (selectedMonth !== 'All Months') {
      const date = new Date(tx.date);
      const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      const txMonthYear = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
      monthMatch = (txMonthYear === selectedMonth);
    }

    // Year Match
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

  const [leaderboard, setLeaderboard] = useState([]);

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
  }, [selectedMonth, selectedYear]);

  const effectiveLeaders = React.useMemo(() => {
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
        return {
          ...tl,
          grossRevenue: item.gross_revenue || 0,
          netRevenue: item.net_revenue || 0,
          lossAmount: item.potential_loss || 0,
          totalEnquiries: item.total_enquiries || tl.totalEnquiries || 0,
          enquiriesProgressed: item.invoices_closed ?? (tl.enquiriesProgressed || 0),
          enquiriesCancelled: item.potential_loss > 0 ? Math.ceil(item.potential_loss / 50000) : (tl.enquiriesCancelled || 0),
          enquiriesInternallyClosed: item.potential_loss > 0 ? Math.ceil(item.potential_loss / 75000) : (tl.enquiriesInternallyClosed || 0)
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

    // Also include any TL present in live transactions not yet in merged roster
    const existingNames = new Set(merged.map(t => (t.name || '').trim().toLowerCase()));
    if (Array.isArray(transactions)) {
      const tlCountMap = {};
      transactions.forEach((tx) => {
        const tlName = (tx.teamLeaderName || '').trim();
        if (tlName && tlName.toLowerCase() !== 'unknown') {
          tlCountMap[tlName] = (tlCountMap[tlName] || 0) + (tx.type === 'income' ? 1 : 0);
        }
      });
      Object.keys(tlCountMap).forEach((tlName, idx) => {
        if (!existingNames.has(tlName.toLowerCase())) {
          existingNames.add(tlName.toLowerCase());
          const closedCount = tlCountMap[tlName];
          merged.push({
            id: `tl-tx-${idx}`,
            name: tlName,
            role: 'Team Leader',
            target: 500000,
            grossRevenue: 0,
            netRevenue: 0,
            lossAmount: 0,
            totalEnquiries: Math.max(10, closedCount * 2),
            enquiriesProgressed: closedCount,
            enquiriesCancelled: 0,
            enquiriesInternallyClosed: 0
          });
        }
      });
    }

    return merged;
  }, [teamLeaders, leaderboard, transactions]);

  // Pre-index transactions by TL first name for fast O(1) lookup
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

  // Process data locally with useMemo
  const processedLeaders = useMemo(() => {
    return effectiveLeaders.map(tl => {
      // If stats already computed from leaderboard
      if (tl.grossRevenue !== undefined && tl.grossRevenue > 0) {
        return tl;
      }
      // Look up this TL's stats in the fetched leaderboard
      const lbMatch = (leaderboard || []).find(item => item.tl_name && item.tl_name.trim().toLowerCase() === tl.name.trim().toLowerCase());
      
      const tlClean = tl.name.trim().toLowerCase();
      const tlFirstName = tlClean.split(' ')[0];
      const tlTxs = tlTxsMap[tlClean] || tlTxsMap[tlFirstName] || [];
      const contextGross = tlTxs.filter(t => t.type === 'income').reduce((sum, t) => sum + (t.amount || 0), 0);
      const contextNet = contextGross * 0.4375;

      const grossRevenue = lbMatch ? lbMatch.gross_revenue : (contextGross > 0 ? contextGross : 0.0);
      const netRevenue = lbMatch ? lbMatch.net_revenue : (contextNet > 0 ? contextNet : 0.0);
      const lossAmount = lbMatch ? lbMatch.potential_loss : 0.0;
      const totalEnquiries = lbMatch ? lbMatch.total_enquiries : Math.max(1, tlTxs.length);
      const enquiriesProgressed = lbMatch ? lbMatch.invoices_closed : tlTxs.filter(t => t.type === 'income').length;
      
      // Estimate cancelled/internally closed mixes based on loss amount vs average fee
      const enquiriesCancelled = lossAmount > 0 ? Math.ceil(lossAmount / 50000) : 0;

      return {
        ...tl,
        grossRevenue,
        netRevenue,
        lossAmount,
        totalEnquiries,
        enquiriesProgressed,
        enquiriesCancelled,
        enquiriesInternallyClosed: lossAmount > 0 ? Math.ceil(lossAmount / 75000) : 0
      };
    }).sort((a, b) => b.grossRevenue - a.grossRevenue);
  }, [effectiveLeaders, leaderboard, tlTxsMap]);

  // Overall aggregates (memoized)
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

  return (
    <div className="bd-performance-page animate-fade-in">
      
      {/* Overview Cards */}
      <section className="kpi-grid">
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
                  <div className="leaderboard-item" key={tl.id}>
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
                        {(tl.enquiriesOnHold || 0) > 0 && <span style={{color:'#f59e0b'}}> / {tl.enquiriesOnHold} On Hold</span>}
                        {(tl.enquiriesReallocated || 0) > 0 && <span style={{color:'#a78bfa'}}> / {tl.enquiriesReallocated} Reallocated</span>}
                        {(tl.enquiriesCreditNotes || 0) > 0 && <span style={{color:'#f87171'}}> / {tl.enquiriesCreditNotes} Credit Notes</span>}
                        {' / '}{tl.totalEnquiries || 0} Total
                      </div>
                      <div style={{ color: '#cbd5e1' }}>Gross Billing: {formatCurrency(tl.grossRevenue)} | Net Share: {formatCurrency(tl.netRevenue)}{(tl.creditNoteReversals || 0) > 0 && <span style={{color:'#f87171'}}> | Reversals: -{formatCurrency(tl.creditNoteReversals)}</span>}</div>
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
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {processedLeaders.map(tl => (
                  <tr 
                    key={tl.id}
                    onClick={() => { setActiveTLDetails(tl); setModalPage(1); }}
                    className="clickable-row-item"
                    style={{ cursor: 'pointer' }}
                  >
                    <td className="font-bold">
                      <div>{tl.name}</div>
                      <span style={{ fontSize: '0.7rem', color: 'var(--accent-teal)', fontWeight: 'normal' }}>Click to view details</span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 'bold', fontSize: '0.8rem' }}>
                        <span style={{ color: '#10b981' }}>{tl.enquiriesProgressed}P</span> / <span style={{ color: '#ef4444' }}>{tl.enquiriesCancelled}C</span> / <span style={{ color: '#ea580c' }}>{tl.enquiriesInternallyClosed}I</span> / <span style={{ color: '#64748b' }}>{(tl.totalEnquiries || 0) - (tl.enquiriesProgressed || 0) - (tl.enquiriesCancelled || 0) - (tl.enquiriesInternallyClosed || 0)}Pnd</span>
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Total: {tl.totalEnquiries}</div>
                    </td>
                    <td className="font-bold text-teal text-right">{formatCurrency(tl.grossRevenue)}</td>
                    <td className="font-bold text-right text-blue" style={{ color: '#38bdf8' }}>{formatCurrency(tl.netRevenue)}</td>
                    <td className="text-red font-bold text-right">{formatCurrency(tl.lossAmount)}</td>
                    <td>
                      <span className="status-badge active">{tl.status || 'Active'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Drilldown Modal */}
      {activeTLDetails && (() => {
        const currentTL = activeTLDetails;
        const detailTxs = transactions.filter(t => 
          t.teamLeaderName && 
          t.teamLeaderName.trim().toLowerCase() === currentTL.name.trim().toLowerCase() &&
          isInFilteredPeriod(t)
        );

        const total = currentTL.totalEnquiries || 1;
        const progressedPct = ((currentTL.enquiriesProgressed || 0) / total) * 100;
        const cancelledPct = ((currentTL.enquiriesCancelled || 0) / total) * 100;
        const internallyClosedPct = ((currentTL.enquiriesInternallyClosed || 0) / total) * 100;
        const pendingPct = 100 - progressedPct - cancelledPct - internallyClosedPct;

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
                  <div style={{ display: 'flex', height: '22px', borderRadius: '6px', overflow: 'hidden', backgroundColor: '#E3E5E0' }}>
                    {progressedPct > 0 && (
                      <div style={{ width: `${progressedPct}%`, backgroundColor: '#0F6E56', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.72rem', fontWeight: '600' }} title={`${currentTL.enquiriesProgressed} Progressed`}>
                        {currentTL.enquiriesProgressed} Prog ({progressedPct.toFixed(0)}%)
                      </div>
                    )}
                    {cancelledPct > 0 && (
                      <div style={{ width: `${cancelledPct}%`, backgroundColor: '#A8402E', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.72rem', fontWeight: '600' }} title={`${currentTL.enquiriesCancelled} Cancelled`}>
                        {currentTL.enquiriesCancelled} Cancel ({cancelledPct.toFixed(0)}%)
                      </div>
                    )}
                    {internallyClosedPct > 0 && (
                      <div style={{ width: `${internallyClosedPct}%`, backgroundColor: '#B7791F', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.72rem', fontWeight: '600' }} title={`${currentTL.enquiriesInternallyClosed} Internally Closed`}>
                        {currentTL.enquiriesInternallyClosed} Int. ({internallyClosedPct.toFixed(0)}%)
                      </div>
                    )}
                    {pendingPct > 0 && (
                      <div style={{ width: `${pendingPct}%`, backgroundColor: '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.72rem', fontWeight: '600' }} title={`${currentTL.totalEnquiries - currentTL.enquiriesProgressed - currentTL.enquiriesCancelled - currentTL.enquiriesInternallyClosed} Pending`}>
                        Pending ({pendingPct.toFixed(0)}%)
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.75rem', color: '#6B7268', fontWeight: '500' }}>
                    <span>Total Enquiries: <strong style={{ color: '#1B2321' }}>{currentTL.totalEnquiries}</strong></span>
                    <span>Pipeline Realization: <strong style={{ color: '#0F6E56' }}>{(((currentTL.enquiriesProgressed || 0) + (currentTL.enquiriesCancelled || 0) + (currentTL.enquiriesInternallyClosed || 0)) / total * 100).toFixed(0)}%</strong></span>
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
                  const paginatedTxs = detailTxs.slice((modalPage - 1) * ITEMS_PER_PAGE, modalPage * ITEMS_PER_PAGE);

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

                      {totalPages > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', padding: '8px 0' }}>
                          <span style={{ fontSize: '0.78rem', color: '#6B7268' }}>
                            Showing {(modalPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(modalPage * ITEMS_PER_PAGE, detailTxs.length)} of {detailTxs.length} records
                          </span>
                          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                            <button
                              type="button"
                              disabled={modalPage === 1}
                              onClick={() => setModalPage(p => Math.max(1, p - 1))}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 10px',
                                fontSize: '0.75rem',
                                fontWeight: '500',
                                backgroundColor: '#FFFFFF',
                                color: modalPage === 1 ? '#94A3B8' : '#1B2321',
                                border: '1px solid #E3E5E0',
                                borderRadius: '6px',
                                cursor: modalPage === 1 ? 'not-allowed' : 'pointer'
                              }}
                            >
                              <ChevronLeft size={13} />
                              <span>Prev</span>
                            </button>
                            
                            {Array.from({ length: totalPages }, (_, i) => i + 1).slice(Math.max(0, modalPage - 3), Math.min(totalPages, modalPage + 2)).map(pageNum => (
                              <button
                                key={pageNum}
                                type="button"
                                onClick={() => setModalPage(pageNum)}
                                style={{
                                  padding: '3px 9px',
                                  fontSize: '0.75rem',
                                  backgroundColor: modalPage === pageNum ? '#0F6E56' : '#FFFFFF',
                                  color: modalPage === pageNum ? '#FFFFFF' : '#1B2321',
                                  border: '1px solid ' + (modalPage === pageNum ? '#0F6E56' : '#E3E5E0'),
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontWeight: modalPage === pageNum ? '700' : '500',
                                  minWidth: '26px'
                                }}
                              >
                                {pageNum}
                              </button>
                            ))}

                            <button
                              type="button"
                              disabled={modalPage === totalPages}
                              onClick={() => setModalPage(p => Math.min(totalPages, p + 1))}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 10px',
                                fontSize: '0.75rem',
                                fontWeight: '500',
                                backgroundColor: '#FFFFFF',
                                color: modalPage === totalPages ? '#94A3B8' : '#1B2321',
                                border: '1px solid #E3E5E0',
                                borderRadius: '6px',
                                cursor: modalPage === totalPages ? 'not-allowed' : 'pointer'
                              }}
                            >
                              <span>Next</span>
                              <ChevronRight size={13} />
                            </button>
                          </div>
                        </div>
                      )}
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
