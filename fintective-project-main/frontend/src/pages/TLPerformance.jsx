import { useContext, useState, useEffect } from 'react';
import { FinanceContext } from '../context/FinanceContext';
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
    fetch(`http://localhost:5000/api/tl-revenue-leaderboard?start_date=${start}&end_date=${end}`)
      .then(res => {
        if (res.ok) return res.json();
      })
      .then(data => {
        if (data) setLeaderboard(data);
      })
      .catch(err => console.error("TL Leaderboard load failed:", err));
  }, [selectedMonth, selectedYear]);

  // Process data locally if filters change
  const processedLeaders = teamLeaders.map(tl => {
    // Look up this TL's stats in the fetched leaderboard
    const lbMatch = leaderboard.find(item => item.tl_name.trim().toLowerCase() === tl.name.trim().toLowerCase());
    
    const grossRevenue = lbMatch ? lbMatch.gross_revenue : 0.0;
    const netRevenue = lbMatch ? lbMatch.net_revenue : 0.0;
    const lossAmount = lbMatch ? lbMatch.potential_loss : 0.0;
    const totalEnquiries = lbMatch ? lbMatch.total_enquiries : 0;
    const enquiriesProgressed = lbMatch ? lbMatch.invoices_closed : 0;
    
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

  // Overall aggregates
  const overallGross = processedLeaders.reduce((sum, tl) => sum + tl.grossRevenue, 0);
  const overallNet = processedLeaders.reduce((sum, tl) => sum + tl.netRevenue, 0);
  const overallLoss = processedLeaders.reduce((sum, tl) => sum + tl.lossAmount, 0);
  const overallEnquiries = processedLeaders.reduce((sum, tl) => sum + tl.totalEnquiries, 0);

  const activePeriodLabel = selectedMonth !== 'All Months' 
    ? selectedMonth 
    : (selectedYear !== 'All Years' ? selectedYear : 'All Years');

  return (
    <div className="bd-performance-page animate-fade-in">
      
      {/* Overview Cards */}
      <section className="kpi-grid">
        <div className="kpi-card card-blue">
          <div className="kpi-header">
            <span className="kpi-title">Gross Revenue (Service Amt) â€¢ {activePeriodLabel}</span>
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
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '900px', width: '90%' }}>
              <div className="modal-header">
                <h3>Performance Audit: {currentTL.name}</h3>
                <button className="close-btn" onClick={() => setActiveTLDetails(null)}><X size={18} /></button>
              </div>
              <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
                <h4 style={{ color: '#f8fafc', margin: '0 0 0.75rem 0' }}>Enquiry Pipeline & Realization</h4>
                
                {/* Progress Bar */}
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', height: '24px', borderRadius: '6px', overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.05)' }}>
                    {progressedPct > 0 && (
                      <div style={{ width: `${progressedPct}%`, backgroundColor: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.75rem', fontWeight: 'bold' }} title={`${currentTL.enquiriesProgressed} Progressed`}>
                        {currentTL.enquiriesProgressed} Prog ({progressedPct.toFixed(0)}%)
                      </div>
                    )}
                    {cancelledPct > 0 && (
                      <div style={{ width: `${cancelledPct}%`, backgroundColor: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.75rem', fontWeight: 'bold' }} title={`${currentTL.enquiriesCancelled} Cancelled`}>
                        {currentTL.enquiriesCancelled} Cancel ({cancelledPct.toFixed(0)}%)
                      </div>
                    )}
                    {internallyClosedPct > 0 && (
                      <div style={{ width: `${internallyClosedPct}%`, backgroundColor: '#ea580c', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.75rem', fontWeight: 'bold' }} title={`${currentTL.enquiriesInternallyClosed} Internally Closed`}>
                        {currentTL.enquiriesInternallyClosed} Int. Close ({internallyClosedPct.toFixed(0)}%)
                      </div>
                    )}
                    {pendingPct > 0 && (
                      <div style={{ width: `${pendingPct}%`, backgroundColor: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.75rem', fontWeight: 'bold' }} title={`${currentTL.totalEnquiries - currentTL.enquiriesProgressed - currentTL.enquiriesCancelled - currentTL.enquiriesInternallyClosed} Pending`}>
                        Pending ({pendingPct.toFixed(0)}%)
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.75rem', color: '#94a3b8' }}>
                    <span>Total Enquiries: {currentTL.totalEnquiries}</span>
                    <span>Pipeline Realization: {(((currentTL.enquiriesProgressed || 0) + (currentTL.enquiriesCancelled || 0) + (currentTL.enquiriesInternallyClosed || 0)) / total * 100).toFixed(0)}%</span>
                  </div>
                </div>

                <div className="stats-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div className="stat-box" style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <span className="stat-label" style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Gross Revenue (Service Amt)</span>
                    <h4 style={{ color: 'var(--accent-teal)', margin: '0.5rem 0 0 0', fontSize: '1.25rem' }}>{formatCurrency(currentTL.grossRevenue)}</h4>
                  </div>
                  <div className="stat-box" style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <span className="stat-label" style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Net Revenue (R Share)</span>
                    <h4 style={{ color: '#38bdf8', margin: '0.5rem 0 0 0', fontSize: '1.25rem' }}>{formatCurrency(currentTL.netRevenue)}</h4>
                  </div>
                  <div className="stat-box" style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <span className="stat-label" style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Potential Revenue Loss</span>
                    <h4 style={{ color: '#ef4444', margin: '0.5rem 0 0 0', fontSize: '1.25rem' }}>{formatCurrency(currentTL.lossAmount)}</h4>
                  </div>
                </div>

                <h4 style={{ color: '#f8fafc', marginBottom: '0.75rem', marginTop: '1.5rem' }}>Closed Placement Inflows ({detailTxs.length}) â€¢ {activePeriodLabel}</h4>
                {detailTxs.length === 0 ? (
                  <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>No closed placement income transactions linked to this team leader for this period.</p>
                ) : (() => {
                  const ITEMS_PER_PAGE = 10;
                  const totalPages = Math.ceil(detailTxs.length / ITEMS_PER_PAGE);
                  const paginatedTxs = detailTxs.slice((modalPage - 1) * ITEMS_PER_PAGE, modalPage * ITEMS_PER_PAGE);

                  return (
                    <div>
                      <div className="table-responsive">
                        <table className="data-table" style={{ fontSize: '0.85rem', width: '100%', background: 'transparent' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                              <th style={{ color: '#94a3b8', background: 'transparent', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '12px 16px', fontWeight: '600' }}>Date</th>
                              <th style={{ color: '#94a3b8', background: 'transparent', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '12px 16px', fontWeight: '600' }}>Inflow Detail / Position</th>
                              <th style={{ color: '#94a3b8', background: 'transparent', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '12px 16px', fontWeight: '600' }}>Status</th>
                              <th style={{ color: '#94a3b8', background: 'transparent', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '12px 16px', fontWeight: '600' }} className="text-right">Service Amt</th>
                              <th style={{ color: '#94a3b8', background: 'transparent', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '12px 16px', fontWeight: '600' }} className="text-right">R Share</th>
                            </tr>
                          </thead>
                          <tbody>
                            {paginatedTxs.map(t => (
                              <tr key={t.id} style={{ background: 'transparent' }}>
                                <td style={{ color: '#cbd5e1', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '12px 16px' }}>{formatDate(t.date)}</td>
                                <td style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '12px 16px' }}>
                                  <div className="font-bold" style={{ color: '#f8fafc' }}>{t.title}</div>
                                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Category: {t.category} â€¢ {t.subCategory || 'General'}</div>
                                </td>
                                <td style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '12px 16px' }}>
                                  {t.category === 'Recruitment' && t.info && t.info !== 'N/A' ? (
                                    <span className={`type-badge info-${t.info.toLowerCase()}`} title="Status from Master CSV">
                                      {t.info}
                                    </span>
                                  ) : (
                                    <span className={`type-badge income`} style={{ textTransform: 'capitalize' }}>
                                      {t.enquiryStatus || 'closed'}
                                    </span>
                                  )}
                                </td>
                                <td className="font-bold text-right text-teal" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '12px 16px' }}>
                                  {formatCurrency(t.serviceAmt || t.amount)}
                                </td>
                                <td className="font-bold text-right text-blue" style={{ color: '#38bdf8', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '12px 16px' }}>
                                  {formatCurrency(t.rShare)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {totalPages > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', padding: '10px 0', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                            Showing {(modalPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(modalPage * ITEMS_PER_PAGE, detailTxs.length)} of {detailTxs.length}
                          </span>
                          <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
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
                                backgroundColor: modalPage === 1 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.08)',
                                color: modalPage === 1 ? '#475569' : '#f8fafc',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '6px',
                                cursor: modalPage === 1 ? 'not-allowed' : 'pointer',
                                marginRight: '0.5rem'
                              }}
                            >
                              <ChevronLeft size={12} />
                              <span>Prev</span>
                            </button>
                            
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
                              <button
                                key={pageNum}
                                type="button"
                                onClick={() => setModalPage(pageNum)}
                                style={{
                                  padding: '3px 8px',
                                  fontSize: '0.75rem',
                                  backgroundColor: modalPage === pageNum ? 'var(--color-purple, #8b5cf6)' : 'transparent',
                                  color: modalPage === pageNum ? '#fff' : '#94a3b8',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontWeight: modalPage === pageNum ? 'bold' : 'normal',
                                  minWidth: '24px'
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
                                backgroundColor: modalPage === totalPages ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.08)',
                                color: modalPage === totalPages ? '#475569' : '#f8fafc',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '6px',
                                cursor: modalPage === totalPages ? 'not-allowed' : 'pointer',
                                marginLeft: '0.5rem'
                              }}
                            >
                              <span>Next</span>
                              <ChevronRight size={12} />
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
