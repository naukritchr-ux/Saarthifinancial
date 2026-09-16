import React, { useContext, useState, useEffect, useMemo } from 'react';
import { FinanceContext, API_BASE_URL } from '../context/FinanceContext';
import { fetchWithApiKey } from '../utils/apiClient';
import { formatCurrency, formatLakhs, formatDate } from '../utils/formatters';
import { Users, Plus, ShieldCheck, MapPin, X, AlertTriangle, Award, Layers, Briefcase, Sparkles, TrendingUp } from 'lucide-react';
import Pagination from '../components/Pagination';
import { IndustryPredictiveTab } from '../components/IndustryPredictiveTab';

const Franchisees = () => {
  const { franchisees, transactions, addFranchisee, selectedMonth, selectedYear } = useContext(FinanceContext);
  const [showAddForm, setShowAddForm] = useState(false);
  const [activeFranchiseeDetails, setActiveFranchiseeDetails] = useState(null); // Click detailed modal state
  const [pageTab, setPageTab] = useState('ledger'); // 'ledger' | 'industry_potential'
  const [selectedFranForIndustry, setSelectedFranForIndustry] = useState('all');
  const [modalSubTab, setModalSubTab] = useState('ledger'); // 'ledger' | 'industry'
  const [page, setPage] = useState(1);
  const [modalPage, setModalPage] = useState(1);
  const ITEMS_PER_PAGE = 8;
  const MODAL_ITEMS_PER_PAGE = 8;
  
  // New franchisee form inputs
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [owner, setOwner] = useState('');

  // Pre-indexed map of transactions per franchisee for instant zero-latency rendering
  const franTxsMap = useMemo(() => {
    const map = {};
    if (!Array.isArray(transactions)) return map;
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    transactions.forEach(t => {
      if (!t || !t.franchiseeId) return;

      // 1. Month filter
      if (selectedMonth !== 'All Months') {
        const date = new Date(t.date);
        const txMonthYear = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
        if (txMonthYear !== selectedMonth) return false;
      }

      // 2. Year filter
      if (selectedYear !== 'All Years') {
        if (t.financialYear && t.financialYear !== 'N/A') {
          if (t.financialYear !== selectedYear) return false;
        } else {
          const d = new Date(t.date);
          if (!isNaN(d.getTime())) {
            const y = d.getFullYear();
            const m = d.getMonth();
            const fy = m >= 3 ? `${y}-${y+1}` : `${y-1}-${y}`;
            if (fy !== selectedYear) return false;
          }
        }
      }

      if (!map[t.franchiseeId]) map[t.franchiseeId] = [];
      map[t.franchiseeId].push(t);
    });
    return map;
  }, [transactions, selectedMonth, selectedYear]);

  const getFranchiseeFinancials = (franId) => {
    const relatedTxs = franTxsMap[franId] || [];
    const revenuePaid = relatedTxs.filter(t => t.type === 'income').reduce((sum, t) => sum + (t.franchiseeShare || t.amount || 0), 0);
    const costsIncurred = relatedTxs.filter(t => t.type === 'expense').reduce((sum, t) => sum + (t.amount || 0), 0);
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
    const cached = sessionStorage.getItem('fintective_ml_insights');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed?.franchise_clusters) {
          setMlData(parsed.franchise_clusters);
          return;
        }
      } catch (e) {}
    }
    fetchWithApiKey(`${API_BASE_URL}/ml/insights`)
      .then(res => {
        if (res.ok) return res.json();
      })
      .then(data => {
        if (data && data.franchise_clusters) {
          setMlData(data.franchise_clusters);
          try { sessionStorage.setItem('fintective_ml_insights', JSON.stringify(data)); } catch(e){}
        }
      })
      .catch(err => console.log("ML load bypassed in Franchisees page:", err));
  }, []);

  useEffect(() => {
    setLoadingSummary(true);
    const { start, end } = getPeriodDates(selectedMonth, selectedYear);
    fetchWithApiKey(`${API_BASE_URL}/finance/franchisee-summary?start_date=${start}&end_date=${end}`)
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

  const effectiveLedger = React.useMemo(() => {
    const list = [];
    const seen = new Set();

    // 1. Add all from summaryData.ledger (live backend summary)
    if (summaryData.ledger && summaryData.ledger.length > 0) {
      summaryData.ledger.forEach(item => {
        const clean = (item.name || '').trim().toLowerCase();
        if (clean && !seen.has(clean)) {
          seen.add(clean);
          list.push(item);
        }
      });
    }

    // 2. Add all from franchisees roster
    (franchisees || []).forEach((f, idx) => {
      const fName = (f.name || f.nameAsPerAgreement || f.franchiseName || '').trim();
      const clean = fName.toLowerCase();
      if (clean && !seen.has(clean)) {
        seen.add(clean);
        const fId = f.id || `f-${idx}`;
        const fTxs = (transactions || []).filter(t =>
          (t.franchiseeId === fId || (t.franchiseeName && t.franchiseeName.toLowerCase() === clean))
        );
        const rev = fTxs.filter(t => t.type === 'income').reduce((sum, t) => sum + (t.franchiseeShare || t.amount || 0), 0);
        const cost = fTxs.filter(t => t.type === 'expense').reduce((sum, t) => sum + (t.amount || 0), 0);
        list.push({
          id: fId,
          name: fName,
          owner: f.teamLeaderName || f.owner || 'Franchise Lead',
          city: f.city || 'India Hub',
          candidatesPlaced: f.candidatesPlaced || fTxs.filter(t => t.type === 'income').length,
          revenuePaid: rev,
          costsIncurred: cost,
          netContribution: rev - cost,
          costsTracked: cost > 0,
          status: f.status || 'Active'
        });
      }
    });

    // 3. Add any franchisee from live transactions not yet seen
    (transactions || []).forEach((t, idx) => {
      const fName = (t.franchiseeName || '').trim();
      const clean = fName.toLowerCase();
      if (clean && clean !== 'unknown' && !seen.has(clean)) {
        seen.add(clean);
        const fTxs = (transactions || []).filter(x => (x.franchiseeName || '').trim().toLowerCase() === clean);
        const rev = fTxs.filter(x => x.type === 'income').reduce((sum, x) => sum + (x.franchiseeShare || x.amount || 0), 0);
        const cost = fTxs.filter(x => x.type === 'expense').reduce((sum, x) => sum + (x.amount || 0), 0);
        list.push({
          id: t.franchiseeId || `f-tx-${idx}`,
          name: fName,
          owner: t.teamLeaderName || 'Franchise Lead',
          city: 'India Hub',
          candidatesPlaced: fTxs.filter(x => x.type === 'income').length,
          revenuePaid: rev,
          costsIncurred: cost,
          netContribution: rev - cost,
          costsTracked: cost > 0,
          status: 'Active'
        });
      }
    });

    return list;
  }, [summaryData.ledger, franchisees, transactions]);

  const franchiseSummaries = effectiveLedger.map(fran => {
    const trend = getFranchiseeTrend(fran.id);
    const fin = getFranchiseeFinancials(fran.id);
    
    // Look up ML segment
    const mlMatch = mlData ? mlData.find(item => item.franchise.trim().toLowerCase() === fran.name.trim().toLowerCase()) : null;
    const mlSegment = mlMatch ? mlMatch.segment : 'Steady Partners (Consistent Output)';
    const mlCluster = mlMatch ? mlMatch.cluster : 1;

    const costsIncurred = fran.costsTracked ? fran.costsIncurred : (fin.costsIncurred > 0 ? fin.costsIncurred : null);
    const revenuePaid = (fran.revenuePaid && fran.revenuePaid > 0) ? fran.revenuePaid : (fin.revenuePaid > 0 ? fin.revenuePaid : 0);
    const netContribution = costsIncurred !== null ? (revenuePaid - costsIncurred) : revenuePaid;

    return {
      ...fran,
      revenuePaid,
      costsIncurred,
      netContribution,
      costsTracked: costsIncurred !== null,
      trend,
      mlSegment,
      mlCluster
    };
  });

  const totalFranchiseRevenue = summaryData.franchise_inflow > 0
    ? summaryData.franchise_inflow
    : franchiseSummaries.reduce((sum, f) => sum + (f.revenuePaid || 0), 0);
  const totalFranchiseCost = franchiseSummaries.reduce((sum, f) => sum + (f.costsIncurred || 0), 0);
  const totalFranchiseNet = totalFranchiseRevenue - totalFranchiseCost;


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

      {/* View Switcher: Locations Ledger vs Industry Predictive Potential */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-card)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <button
            onClick={() => setPageTab('ledger')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              background: pageTab === 'ledger' ? 'var(--accent-teal, #0f766e)' : 'transparent',
              color: pageTab === 'ledger' ? '#ffffff' : 'var(--text-muted)',
              fontWeight: pageTab === 'ledger' ? '700' : '500',
              fontSize: '0.88rem',
              cursor: 'pointer',
              boxShadow: pageTab === 'ledger' ? '0 2px 4px rgba(15, 110, 86, 0.2)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <Layers size={16} />
            Franchise Locations Ledger
          </button>
          <button
            onClick={() => setPageTab('industry_potential')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              background: pageTab === 'industry_potential' ? 'var(--accent-teal, #0f766e)' : 'transparent',
              color: pageTab === 'industry_potential' ? '#ffffff' : 'var(--text-muted)',
              fontWeight: pageTab === 'industry_potential' ? '700' : '500',
              fontSize: '0.88rem',
              cursor: 'pointer',
              boxShadow: pageTab === 'industry_potential' ? '0 2px 4px rgba(15, 110, 86, 0.2)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <Briefcase size={16} />
            Industry Analysis & Predictive Potential
          </button>
        </div>

        {pageTab === 'industry_potential' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Filter Franchisee:</span>
            <select
              value={selectedFranForIndustry}
              onChange={(e) => setSelectedFranForIndustry(e.target.value)}
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
              <option value="all">Network-wide (All Franchisees)</option>
              {franchiseSummaries.map(f => (
                <option key={f.id || f.name} value={f.name}>
                  {f.name} ({f.candidatesPlaced || 0} placed)
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {pageTab === 'industry_potential' ? (
        <div className="dashboard-card animate-fade-in" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={18} color="var(--accent-teal, #0f766e)" /> 
                {selectedFranForIndustry === 'all' ? 'Network-Wide Industry Analysis & Growth Projections' : `Industry Breakdown: ${selectedFranForIndustry}`}
              </h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Sector revenue share, conversion velocity, and forward potential modeling based on historical placement metrics
              </span>
            </div>
          </div>
          <IndustryPredictiveTab 
            transactions={transactions}
            entityType="franchisee"
            entityName={selectedFranForIndustry === 'all' ? '' : selectedFranForIndustry}
            onboardingDate={franchisees.find(f => f.name?.toLowerCase() === selectedFranForIndustry?.toLowerCase())?.onboardingDate}
          />
        </div>
      ) : (
        /* Main Table section */
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
                {(() => {
                  const totalPages = Math.max(1, Math.ceil(franchiseSummaries.length / ITEMS_PER_PAGE));
                  const safePage = Math.min(Math.max(1, page), totalPages);
                  const paginatedFrans = franchiseSummaries.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

                  return paginatedFrans.map(fran => (
                    <tr 
                      key={fran.id} 
                      onClick={() => { setActiveFranchiseeDetails(fran); setModalPage(1); setModalSubTab('ledger'); }}
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
                  ));
                })()}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={page}
            totalItems={franchiseSummaries.length}
            pageSize={ITEMS_PER_PAGE}
            onPageChange={setPage}
            itemName="franchise hubs"
          />
        </div>
      )}

      {/* Franchise Detail Audit Modal Popup overlay */}
      {activeFranchiseeDetails && (() => {
        const detailTxs = transactions.filter(t => {
          if (t.franchiseeId !== activeFranchiseeDetails.id && (t.franchiseeName || '').toLowerCase() !== (activeFranchiseeDetails.name || '').toLowerCase()) return false;
          if (selectedMonth === 'All Months') return true;
          const date = new Date(t.date);
          const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
          const txMonthYear = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
          return txMonthYear === selectedMonth;
        });

        const totalModalPages = Math.max(1, Math.ceil(detailTxs.length / MODAL_ITEMS_PER_PAGE));
        const safeModalPage = Math.min(Math.max(1, modalPage), totalModalPages);
        const paginatedDetailTxs = detailTxs.slice((safeModalPage - 1) * MODAL_ITEMS_PER_PAGE, safeModalPage * MODAL_ITEMS_PER_PAGE);

        return (
          <div className="modal-backdrop" onClick={() => setActiveFranchiseeDetails(null)}>
            <div className="modal-container auditor-modal animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '860px', width: '92%' }}>
              <div className="modal-header">
                <div className="modal-header-title">
                  <h3>Franchise Audit: {activeFranchiseeDetails.name}</h3>
                  <span className="modal-subtitle">{activeFranchiseeDetails.city} Hub • Owned by {activeFranchiseeDetails.owner}</span>
                </div>
                <button className="close-btn" onClick={() => setActiveFranchiseeDetails(null)} aria-label="Close modal">
                  <X size={18} />
                </button>
              </div>
              
              <div className="modal-body" style={{ maxHeight: '76vh', overflowY: 'auto', padding: '20px 24px' }}>
                {/* Modal Sub-Tab Selector */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '18px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                  <button
                    type="button"
                    style={{
                      padding: '6px 14px',
                      fontSize: '0.8rem',
                      fontWeight: '600',
                      borderRadius: '6px',
                      border: 'none',
                      cursor: 'pointer',
                      background: modalSubTab === 'ledger' ? 'var(--accent-teal, #0f766e)' : 'var(--bg-card)',
                      color: modalSubTab === 'ledger' ? '#ffffff' : 'var(--text-muted)'
                    }}
                    onClick={() => setModalSubTab('ledger')}
                  >
                    Ledger & Financials
                  </button>
                  <button
                    type="button"
                    style={{
                      padding: '6px 14px',
                      fontSize: '0.8rem',
                      fontWeight: '600',
                      borderRadius: '6px',
                      border: 'none',
                      cursor: 'pointer',
                      background: modalSubTab === 'industry' ? 'var(--accent-teal, #0f766e)' : 'var(--bg-card)',
                      color: modalSubTab === 'industry' ? '#ffffff' : 'var(--text-muted)'
                    }}
                    onClick={() => setModalSubTab('industry')}
                  >
                    Industry Potential & Predictions
                  </button>
                </div>

                {modalSubTab === 'industry' ? (
                  <IndustryPredictiveTab 
                    transactions={transactions}
                    entityType="franchisee"
                    entityName={activeFranchiseeDetails.name}
                    onboardingDate={activeFranchiseeDetails.onboardingDate}
                  />
                ) : (
                  <div>
                    <div className="table-responsive">
                      <table className="data-table" style={{ width: '100%', fontSize: '0.82rem' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid #E3E5E0', textAlign: 'left' }}>
                            <th style={{ color: '#6B7268', background: '#FAFAF8', padding: '10px 14px', fontWeight: '600' }}>Date</th>
                            <th style={{ color: '#6B7268', background: '#FAFAF8', padding: '10px 14px', fontWeight: '600' }}>Description</th>
                            <th style={{ color: '#6B7268', background: '#FAFAF8', padding: '10px 14px', fontWeight: '600' }}>Type</th>
                            <th style={{ color: '#6B7268', background: '#FAFAF8', padding: '10px 14px', fontWeight: '600', textAlign: 'right', width: '120px' }}>Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedDetailTxs.map(t => (
                            <tr key={t.id} style={{ borderBottom: '1px solid #E3E5E0' }}>
                              <td style={{ color: '#6B7268', padding: '10px 14px', whiteSpace: 'nowrap' }}>{formatDate(t.date)}</td>
                              <td style={{ padding: '10px 14px' }}>
                                <div style={{ fontWeight: '600', color: '#1B2321', fontSize: '0.84rem' }}>{t.title}</div>
                                <div style={{ fontSize: '0.72rem', color: '#6B7268', marginTop: '2px' }}>{t.category} • {t.subCategory || 'General'}</div>
                              </td>
                              <td style={{ padding: '10px 14px' }}>
                                {t.type === 'income' ? (
                                  <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: '600', backgroundColor: '#E6F4EA', color: '#0F6E56' }}>
                                    Inflow
                                  </span>
                                ) : (
                                  <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: '600', backgroundColor: '#FCE8E6', color: '#A8402E' }}>
                                    Outflow
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '700', color: t.type === 'income' ? '#0F6E56' : '#A8402E' }}>
                                {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <Pagination
                      currentPage={safeModalPage}
                      totalItems={detailTxs.length}
                      pageSize={MODAL_ITEMS_PER_PAGE}
                      onPageChange={setModalPage}
                      itemName="records"
                      style={{ marginTop: '8px', padding: '10px 4px' }}
                    />
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
