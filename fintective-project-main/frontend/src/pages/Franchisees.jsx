import { useContext, useState, useEffect } from 'react';
import { FinanceContext, API_BASE_URL } from '../context/FinanceContext';
import { formatCurrency, formatLakhs, formatDate } from '../utils/formatters';
import { Users, Plus, ShieldCheck, MapPin, X, AlertTriangle, Award } from 'lucide-react';

const Franchisees = () => {
  const { franchisees, transactions, addFranchisee, selectedMonth, selectedYear } = useContext(FinanceContext);
  const [showAddForm, setShowAddForm] = useState(false);
  const [activeFranchiseeDetails, setActiveFranchiseeDetails] = useState(null); // Click detailed modal state
  
  // New franchisee form inputs
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [owner, setOwner] = useState('');

  const getFranchiseeFinancials = (franId) => {
    const relatedTxs = transactions.filter(t => {
      if (t.franchiseeId !== franId) return false;
      
      // 1. Month filter
      let monthMatch = true;
      if (selectedMonth !== 'All Months') {
        const date = new Date(t.date);
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const txMonthYear = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
        monthMatch = (txMonthYear === selectedMonth);
      }

      // 2. Year filter
      let yearMatch = true;
      if (selectedYear !== 'All Years') {
        if (t.financialYear && t.financialYear !== 'N/A') {
          yearMatch = (t.financialYear === selectedYear);
        } else {
          const d = new Date(t.date);
          if (!isNaN(d.getTime())) {
            const y = d.getFullYear();
            const m = d.getMonth();
            const fy = m >= 3 ? `${y}-${y+1}` : `${y-1}-${y}`;
            yearMatch = (fy === selectedYear);
          }
        }
      }
      return monthMatch && yearMatch;
    });
    const revenuePaid = relatedTxs.filter(t => t.type === 'income').reduce((sum, t) => sum + (t.franchiseeShare || t.amount || 0), 0);
    const costsIncurred = relatedTxs.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const netContribution = revenuePaid - costsIncurred;
    return {
      revenuePaid,
      costsIncurred,
      netContribution,
      txCount: relatedTxs.length
    };
  };

  // Summarize overall franchise metrics with MoM Trend
  const getFranchiseeTrend = (franId) => {
    const targetMonth = selectedMonth === 'All Months' ? 'June 2026' : selectedMonth;
    const parts = targetMonth.split(' ');
    const mName = parts[0];
    const yVal = parseInt(parts[1]);
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const currIdx = monthNames.indexOf(mName);
    
    let prevIdx = currIdx - 1;
    let prevYear = yVal;
    if (prevIdx < 0) {
      prevIdx = 11;
      prevYear -= 1;
    }
    const prevMonthLabel = `${monthNames[prevIdx]} ${prevYear}`;

    const getMonthNet = (mLabel) => {
      const monthTxs = transactions.filter(t => {
        const d = new Date(t.date);
        const txM = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
        return t.franchiseeId === franId && txM === mLabel;
      });
      const rev = monthTxs.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
      const exp = monthTxs.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
      return rev - exp;
    };

    const currNet = getMonthNet(targetMonth);
    const prevNet = getMonthNet(prevMonthLabel);

    if (prevNet === 0) return { text: 'Flat', positive: true };
    const diff = ((currNet - prevNet) / Math.abs(prevNet)) * 100;
    return {
      text: `${diff >= 0 ? '↑' : '↓'} ${Math.abs(diff).toFixed(0)}%`,
      positive: diff >= 0
    };
  };

  const [mlData, setMlData] = useState(null);
  const [summaryData, setSummaryData] = useState({
    franchise_inflow: 0.0,
    total_onboarding_fees: 0.0,
    ledger: []
  });
  const [loadingSummary, setLoadingSummary] = useState(true);

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
    fetch(`${API_BASE_URL}/ml/insights`)
      .then(res => {
        if (res.ok) return res.json();
      })
      .then(data => {
        if (data && data.franchise_clusters) {
          setMlData(data.franchise_clusters);
        }
      })
      .catch(err => console.log("ML load bypassed in Franchisees page:", err));
  }, []);

  useEffect(() => {
    setLoadingSummary(true);
    const { start, end } = getPeriodDates(selectedMonth, selectedYear);
    fetch(`${API_BASE_URL}/finance/franchisee-summary?start_date=${start}&end_date=${end}`)
      .then(res => {
        if (res.ok) return res.json();
      })
      .then(data => {
        if (data) {
          setSummaryData(data);
        }
      })
      .catch(err => console.error("Franchise summary load failed:", err))
      .finally(() => setLoadingSummary(false));
  }, [selectedMonth, selectedYear]);

  const franchiseSummaries = summaryData.ledger.map(fran => {
    const trend = getFranchiseeTrend(fran.id);
    
    // Look up ML segment
    const mlMatch = mlData ? mlData.find(item => item.franchise.trim().toLowerCase() === fran.name.trim().toLowerCase()) : null;
    const mlSegment = mlMatch ? mlMatch.segment : 'Steady Partners (Consistent Output)';
    const mlCluster = mlMatch ? mlMatch.cluster : 1;

    return {
      ...fran,
      trend,
      mlSegment,
      mlCluster
    };
  });

  const totalFranchiseRevenue = summaryData.franchise_inflow;
  const totalFranchiseCost = 0.0;
  const totalFranchiseNet = summaryData.franchise_inflow;


  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim() || !city.trim() || !owner.trim()) {
      alert('Please fill in all fields.');
      return;
    }

    addFranchisee({
      name,
      city,
      owner,
      onboardingDate: new Date().toISOString().split('T')[0]
    });

    setName('');
    setCity('');
    setOwner('');
    setShowAddForm(false);
    alert(`Franchise Hub "${name}" successfully registered!`);
  };

  return (
    <div className="franchisees-page animate-fade-in">
      
      {/* Metrics Row */}
      <section className="kpi-grid">
        <div className="kpi-card card-blue">
          <div className="kpi-header">
            <span className="kpi-title">Franchise Inflows (Revenue) • {selectedMonth}</span>
            <span className="kpi-icon"><Users size={18} /></span>
          </div>
          <h2 className="kpi-value">{formatLakhs(totalFranchiseRevenue)}</h2>
          <div className="kpi-change up">
            <span>Fees & Royalties Collected</span>
          </div>
        </div>

        <div className="kpi-card card-red">
          <div className="kpi-header">
            <span className="kpi-title">Local Franchise Support Costs</span>
            <span className="kpi-icon"><MapPin size={18} /></span>
          </div>
          <h2 className="kpi-value" style={{ fontSize: '1.15rem', color: '#94a3b8', padding: '6px 0' }}>Not tracked per-location</h2>
          <div className="kpi-change down">
            <span>Local Marketing & Lead Gen Ads</span>
          </div>
        </div>

        <div className="kpi-card card-green">
          <div className="kpi-header">
            <span className="kpi-title">Net Franchise Contribution</span>
            <span className="kpi-icon"><ShieldCheck size={18} /></span>
          </div>
          <h2 className="kpi-value">{formatLakhs(totalFranchiseNet)}</h2>
          <div className={`kpi-change ${totalFranchiseNet >= 0 ? 'up' : 'down'}`}>
            <span>Net network profitability</span>
          </div>
        </div>

        <div className="kpi-card card-purple" style={{ background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.05) 0%, rgba(168, 85, 247, 0.02) 100%)', border: '1px solid rgba(168, 85, 247, 0.1)' }}>
          <div className="kpi-header">
            <span className="kpi-title">Onboarding Fees Collected</span>
            <span className="kpi-icon"><Award size={18} style={{ color: '#a855f7' }} /></span>
          </div>
          <h2 className="kpi-value" style={{ color: '#a855f7' }}>{formatLakhs(summaryData.total_onboarding_fees)}</h2>
          <div className="kpi-change up" style={{ color: '#a855f7' }}>
            <span>One-time franchise fees</span>
          </div>
        </div>
      </section>

      {/* AI Operational Alert Banner for At-Risk Hubs */}
      {mlData && franchiseSummaries.filter(f => f.mlCluster === 2).length > 0 && (
        <div style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          background: 'rgba(239, 68, 68, 0.05)',
          padding: '16px',
          borderRadius: '12px',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          color: '#ef4444',
          marginBottom: '24px',
          fontWeight: 'bold',
          fontSize: '0.9rem'
        }}>
          <AlertTriangle size={18} />
          <span>
            AI Operational Alert: {franchiseSummaries.filter(f => f.mlCluster === 2).length} franchise hubs are currently flagged as At-Risk / Low-Activity by the machine learning algorithm. Audit local ad spends and conversion rates for these hubs.
          </span>
        </div>
      )}

      {/* Main Table section */}
      <div className="dashboard-card">
        <div className="card-header-flex">
          <h3 className="card-title">Franchise Locations Ledger</h3>
          <button 
            className="btn btn-primary"
            onClick={() => setShowAddForm(!showAddForm)}
          >
            <Plus size={16} />
            <span>Add Franchisee</span>
          </button>
        </div>

        {/* Dynamic Add Form */}
        {showAddForm && (
          <form onSubmit={handleSubmit} className="inline-add-form animate-fade-in">
            <h4>Onboard New Franchise Location</h4>
            <div className="form-row">
              <div className="form-group flex-1">
                <label>Hub Name</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  placeholder="e.g. Pune West Hub" 
                  required 
                />
              </div>
              <div className="form-group flex-1">
                <label>City</label>
                <input 
                  type="text" 
                  value={city} 
                  onChange={(e) => setCity(e.target.value)} 
                  placeholder="e.g. Pune" 
                  required 
                />
              </div>
              <div className="form-group flex-1">
                <label>Owner Name</label>
                <input 
                  type="text" 
                  value={owner} 
                  onChange={(e) => setOwner(e.target.value)} 
                  placeholder="e.g. Rahul Patil" 
                  required 
                />
              </div>
            </div>
            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowAddForm(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Create Hub</button>
            </div>
          </form>
        )}

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Location / Hub</th>
                <th>City</th>
                <th>Owner</th>
                <th>Candidates Placed</th>
                <th>Inflow (Revenue)</th>
                <th>Outflow (Local Ads)</th>
                <th>Net Contribution</th>
                <th>MoM Trend</th>
                <th>AI Segment</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {franchiseSummaries.map(fran => (
                <tr 
                  key={fran.id} 
                  onClick={() => setActiveFranchiseeDetails(fran)}
                  className="clickable-row-item"
                  style={{ cursor: 'pointer' }}
                >
                  <td className="font-bold">
                    <div>{fran.name}</div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--accent-teal)', fontWeight: 'normal' }}>Click to audit ledger</span>
                  </td>
                  <td>{fran.city}</td>
                  <td>{fran.owner}</td>
                  <td className="text-center">{fran.candidatesPlaced}</td>
                  <td className="font-bold text-teal text-right">{formatCurrency(fran.revenuePaid)}</td>
                  <td className="text-red text-right">
                    {fran.costsIncurred === 0 ? (
                      <span style={{ color: '#64748b', fontSize: '0.8rem' }}>Not tracked</span>
                    ) : (
                      formatCurrency(fran.costsIncurred, true)
                    )}
                  </td>
                  <td className={`font-bold text-right ${fran.netContribution >= 0 ? 'text-teal' : 'text-red'}`}>
                    {formatCurrency(fran.netContribution)}
                  </td>
                  <td>
                    <span className={`trend-badge-tag ${fran.trend.positive ? 'positive' : 'negative'}`} style={{ color: fran.trend.positive ? 'var(--accent-teal)' : '#ef4444', fontWeight: 'bold' }}>
                      {fran.trend.text}
                    </span>
                  </td>
                  <td>
                    <span className="status-badge" style={{
                      backgroundColor: fran.mlCluster === 0 ? 'rgba(16, 185, 129, 0.1)' : (fran.mlCluster === 1 ? 'rgba(37, 99, 235, 0.1)' : 'rgba(239, 68, 68, 0.1)'),
                      color: fran.mlCluster === 0 ? '#10b981' : (fran.mlCluster === 1 ? '#3b82f6' : '#ef4444')
                    }}>
                      {fran.mlSegment.split(' ')[0]}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge ${fran.status.toLowerCase()}`}>
                      {fran.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Franchise Detail Audit Modal Popup overlay */}
      {activeFranchiseeDetails && (() => {
        const detailTxs = transactions.filter(t => {
          if (t.franchiseeId !== activeFranchiseeDetails.id) return false;
          if (selectedMonth === 'All Months') return true;
          const date = new Date(t.date);
          const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
          const txMonthYear = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
          return txMonthYear === selectedMonth;
        });
        return (
          <div className="modal-backdrop" onClick={() => setActiveFranchiseeDetails(null)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="modal-container auditor-modal animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '750px', width: '90%', backgroundColor: '#0b132b', borderRadius: '16px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4)', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden', color: '#fff' }}>
              <div className="modal-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '20px 24px' }}>
                <div className="modal-header-title">
                  <h3 style={{ color: '#f8fafc', fontSize: '1.2rem', fontWeight: 'bold', fontFamily: "'Outfit', sans-serif" }}>Franchise Audit: {activeFranchiseeDetails.name}</h3>
                  <span className="modal-subtitle" style={{ color: '#94a3b8', fontSize: '0.8rem', display: 'block', marginTop: '2px' }}>{activeFranchiseeDetails.city} Hub â€¢ Owned by {activeFranchiseeDetails.owner}</span>
                </div>
                <button className="btn-close" onClick={() => setActiveFranchiseeDetails(null)} style={{ color: '#94a3b8' }}>
                  <X size={20} />
                </button>
              </div>
              
              <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto', padding: '1.5rem' }}>
                <div className="stats-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div className="stat-box" style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <span className="stat-label" style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Total Inflows (Revenue)</span>
                    <h4 style={{ color: 'var(--accent-teal)', margin: '0.5rem 0 0 0', fontSize: '1.25rem' }}>{formatCurrency(activeFranchiseeDetails.revenuePaid)}</h4>
                  </div>
                  <div className="stat-box" style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <span className="stat-label" style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Local Support Costs</span>
                    <h4 style={{ color: '#ef4444', margin: '0.5rem 0 0 0', fontSize: '1.25rem' }}>
                      {activeFranchiseeDetails.costsIncurred === 0 ? (
                        <span style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: 'normal' }}>Not tracked per-location</span>
                      ) : (
                        formatCurrency(activeFranchiseeDetails.costsIncurred, true)
                      )}
                    </h4>
                  </div>
                  <div className="stat-box" style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <span className="stat-label" style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Net Contribution</span>
                    <h4 style={{ color: activeFranchiseeDetails.netContribution >= 0 ? 'var(--accent-teal)' : '#ef4444', margin: '0.5rem 0 0 0', fontSize: '1.25rem' }}>{formatCurrency(activeFranchiseeDetails.netContribution)}</h4>
                  </div>
                </div>

                <h4 style={{ color: '#f8fafc', marginBottom: '0.75rem' }}>Transaction History ({detailTxs.length}) â€¢ {selectedMonth}</h4>
                {detailTxs.length === 0 ? (
                  <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>No transaction history found for this franchisee location.</p>
                ) : (
                  <div className="table-responsive">
                    <table className="data-table" style={{ fontSize: '0.85rem', width: '100%', background: 'transparent' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                          <th style={{ color: '#94a3b8', background: 'transparent', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '12px 16px', fontWeight: '600' }}>Date</th>
                          <th style={{ color: '#94a3b8', background: 'transparent', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '12px 16px', fontWeight: '600' }}>Title / Category</th>
                          <th style={{ color: '#94a3b8', background: 'transparent', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '12px 16px', fontWeight: '600' }}>Type</th>
                          <th style={{ color: '#94a3b8', background: 'transparent', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '12px 16px', fontWeight: '600' }} className="text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailTxs.map(t => (
                          <tr key={t.id} style={{ background: 'transparent' }}>
                            <td style={{ color: '#cbd5e1', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '12px 16px' }}>{formatDate(t.date)}</td>
                            <td style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '12px 16px' }}>
                              <div className="font-bold" style={{ color: '#f8fafc' }}>{t.title}</div>
                              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{t.category} â€¢ {t.subCategory || 'General'}</div>
                            </td>
                            <td style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '12px 16px' }}>
                              {t.type === 'income' && t.category === 'Recruitment' && t.info && t.info !== 'N/A' ? (
                                <span className={`type-badge info-${t.info.toLowerCase()}`} title="Status from Master CSV">
                                  {t.info}
                                </span>
                              ) : (
                                <span className={`type-badge ${t.type}`}>
                                  {t.type === 'income' ? 'Inflow' : 'Outflow'}
                                </span>
                              )}
                            </td>
                            <td className="font-bold text-right" style={{ color: t.type === 'income' ? 'var(--color-income)' : 'var(--color-expense)', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '12px 16px' }}>
                              {t.type === 'income' ? '' : '-'}{formatCurrency(t.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default Franchisees;
