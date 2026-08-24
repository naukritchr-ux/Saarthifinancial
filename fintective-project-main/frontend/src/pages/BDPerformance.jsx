import { useContext, useState, useEffect } from 'react';
import { FinanceContext } from '../context/FinanceContext';
import { formatCurrency, formatLakhs, formatDate } from '../utils/formatters';
import { TrendingUp, Plus, Award, Briefcase, X, Percent, ChevronLeft, ChevronRight } from 'lucide-react';

const BDPerformance = () => {
  const { bdAgents, transactions, addBdAgent, updateBdAgent, selectedMonth, selectedYear } = useContext(FinanceContext);
  const [showAddForm, setShowAddForm] = useState(false);
  
  // New Agent Registration Form States
  const [name, setName] = useState('');
  const [commissionRate, setCommissionRate] = useState('2'); // in %
  const [baseSalary, setBaseSalary] = useState('12000');
  const [payPerProgressed, setPayPerProgressed] = useState('2500');
  const [payPerCancelled, setPayPerCancelled] = useState('500');
  const [leadsBought, setLeadsBought] = useState('30');
  const [leadsProgressed, setLeadsProgressed] = useState('14');
  const [leadsCancelled, setLeadsCancelled] = useState('10');

  // Edit Agent Form States
  const [editAgentId, setEditAgentId] = useState(null);
  const [editBase, setEditBase] = useState('');
  const [editProgressedRate, setEditProgressedRate] = useState('');
  const [editCancelledRate, setEditCancelledRate] = useState('');
  const [editTotalLeads, setEditTotalLeads] = useState('');
  const [editProgressedLeads, setEditProgressedLeads] = useState('');
  const [editCancelledLeads, setEditCancelledLeads] = useState('');

  const [activeAgentDetails, setActiveAgentDetails] = useState(null); // Detail modal state
  const [modalPage, setModalPage] = useState(1); // Modal table pagination page

  const getSafeAgent = (agent) => {
    if (!agent) return {};
    
    let defaultBase = 12000;
    let defaultPayProgressed = 2500;
    let defaultPayCancelled = 500;
    let defaultLeadsBought = 30;
    let defaultLeadsProgressed = agent.leadsConverted || 14;
    let defaultLeadsCancelled = 10;

    if (agent.id === 'bd-2') {
      defaultBase = 10000;
      defaultPayProgressed = 2200;
      defaultPayCancelled = 400;
      defaultLeadsBought = 25;
      defaultLeadsProgressed = agent.leadsConverted || 9;
      defaultLeadsCancelled = 12;
    } else if (agent.id === 'bd-3') {
      defaultBase = 15000;
      defaultPayProgressed = 3000;
      defaultPayCancelled = 600;
      defaultLeadsBought = 35;
      defaultLeadsProgressed = agent.leadsConverted || 18;
      defaultLeadsCancelled = 14;
    } else if (agent.id === 'bd-4') {
      defaultBase = 9000;
      defaultPayProgressed = 2000;
      defaultPayCancelled = 300;
      defaultLeadsBought = 15;
      defaultLeadsProgressed = agent.leadsConverted || 5;
      defaultLeadsCancelled = 8;
    }

    const isValidNum = (v) => v !== undefined && v !== null && !isNaN(Number(v));

    return {
      ...agent,
      baseSalary: isValidNum(agent.baseSalary) ? Number(agent.baseSalary) : defaultBase,
      payPerProgressed: isValidNum(agent.payPerProgressed) ? Number(agent.payPerProgressed) : defaultPayProgressed,
      payPerCancelled: isValidNum(agent.payPerCancelled) ? Number(agent.payPerCancelled) : defaultPayCancelled,
      leadsBought: isValidNum(agent.leadsBought) ? Number(agent.leadsBought) : defaultLeadsBought,
      leadsProgressed: isValidNum(agent.leadsProgressed) ? Number(agent.leadsProgressed) : defaultLeadsProgressed,
      leadsCancelled: isValidNum(agent.leadsCancelled) ? Number(agent.leadsCancelled) : defaultLeadsCancelled,
      leadsInternallyClosed: isValidNum(agent.leadsInternallyClosed) ? Number(agent.leadsInternallyClosed) : 0,
      lossAmount: isValidNum(agent.lossAmount) ? Number(agent.lossAmount) : 0
    };
  };

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
    fetch(`http://localhost:5000/api/bd-revenue-leaderboard?start_date=${start}&end_date=${end}`)
      .then(res => {
        if (res.ok) return res.json();
      })
      .then(data => {
        if (data) setLeaderboard(data);
      })
      .catch(err => console.error("Leaderboard load failed:", err));
  }, [selectedMonth, selectedYear]);

  const getAgentMetrics = (agent) => {
    const safeAgent = getSafeAgent(agent);
    
    // Look up this agent's period-specific stats in the fetched leaderboard
    const lbMatch = leaderboard.find(item => item.bd_name.trim().toLowerCase() === safeAgent.name.trim().toLowerCase());
    
    const grossRevenue = lbMatch ? lbMatch.gross_revenue : 0.0;
    const netRevenue = lbMatch ? lbMatch.net_revenue : 0.0;
    const lossAmount = lbMatch ? lbMatch.potential_loss : 0.0;
    const unverifiedAmount = lbMatch ? (lbMatch.unverified_amount || 0.0) : 0.0;
    
    // Revenue generated = net revenue (Our Share)
    const revenueGenerated = netRevenue;
    
    // Actual payout is the sum of expense payments under 'BD commissions' or 'Salaries' linked to this agent
    const commissionsEarned = transactions
      .filter(t => t.type === 'expense' && (t.category === 'BD commissions' || t.category === 'Salaries') && t.bdAgentId === safeAgent.id && isInFilteredPeriod(t))
      .reduce((sum, t) => sum + t.amount, 0);

    const commissionBonus = revenueGenerated * (safeAgent.commissionRate || 0.02);
    
    // Calculate performance-based salary using period-specific closed/cancelled deal counts
    const closedCount = lbMatch ? lbMatch.invoices_closed : 0;
    
    // Estimate period-specific cancelled deals count based on period lossAmount vs default fees
    const periodCancelled = lossAmount > 0 ? Math.ceil(lossAmount / 50000) : 0;
    
    const calculatedSalary = safeAgent.baseSalary + 
      (closedCount * safeAgent.payPerProgressed) + 
      (periodCancelled * safeAgent.payPerCancelled) +
      commissionBonus;

    const variance = commissionsEarned - calculatedSalary;
    const netContribution = revenueGenerated - commissionsEarned;
    const commissionMarginPct = revenueGenerated > 0 ? (commissionsEarned / revenueGenerated) * 100 : 0;

    return {
      revenueGenerated,
      commissionsEarned,
      calculatedSalary,
      variance,
      netContribution,
      commissionMarginPct,
      grossRevenue,
      netRevenue,
      leadsInternallyClosed: lbMatch ? Math.ceil(lossAmount / 75000) : 0,
      lossAmount,
      unverifiedAmount
    };
  };

  // Calculate MoM trend performance for each BD agent
  const getAgentTrend = (agentId) => {
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
        return t.bdAgentId === agentId && txM === mLabel;
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

  const agentSummaries = bdAgents.map(agent => {
    const safeAgent = getSafeAgent(agent);
    const metrics = getAgentMetrics(safeAgent);
    const trend = getAgentTrend(safeAgent.id);
    return {
      ...safeAgent,
      revenueGenerated: metrics.revenueGenerated,
      commissionsEarned: metrics.commissionsEarned,
      calculatedSalary: metrics.calculatedSalary,
      variance: metrics.variance,
      netContribution: metrics.netContribution,
      commissionMarginPct: metrics.commissionMarginPct,
      grossRevenue: metrics.grossRevenue,
      netRevenue: metrics.netRevenue,
      leadsInternallyClosed: metrics.leadsInternallyClosed,
      lossAmount: metrics.lossAmount,
      unverifiedAmount: metrics.unverifiedAmount,
      trend
    };
  }).sort((a, b) => b.grossRevenue - a.grossRevenue); // Sorted for leaderboard by gross revenue

  // Aggregates
  const overallRevenue = agentSummaries.reduce((sum, a) => sum + a.grossRevenue, 0); // Gross revenue
  const overallNetRevenue = agentSummaries.reduce((sum, a) => sum + a.netRevenue, 0); // Net r share
  const overallLossAmount = agentSummaries.reduce((sum, a) => sum + a.lossAmount, 0); // Overall potential loss
  const totalCommissions = agentSummaries.reduce((sum, a) => sum + a.commissionsEarned, 0); // Actual disbursements paid
  const totalCalculatedSalaries = agentSummaries.reduce((sum, a) => sum + a.calculatedSalary, 0); // Calculated Performance Earnings
  const overallVariance = totalCommissions - totalCalculatedSalaries;
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Please fill out all fields.');
      return;
    }

    addBdAgent({
      name,
      commissionRate: parseFloat(commissionRate) / 100,
      baseSalary: parseFloat(baseSalary) || 0,
      payPerProgressed: parseFloat(payPerProgressed) || 0,
      payPerCancelled: parseFloat(payPerCancelled) || 0,
      leadsBought: parseInt(leadsBought) || 0,
      leadsProgressed: parseInt(leadsProgressed) || 0,
      leadsCancelled: parseInt(leadsCancelled) || 0
    });

    setName('');
    setCommissionRate('2');
    setBaseSalary('12000');
    setPayPerProgressed('2500');
    setPayPerCancelled('500');
    setLeadsBought('30');
    setLeadsProgressed('14');
    setLeadsCancelled('10');
    setShowAddForm(false);
    alert(`BD Agent "${name}" successfully registered!`);
  };

  const handleStartEdit = (agent) => {
    setEditAgentId(agent.id);
    setEditBase((agent.baseSalary || 0).toString());
    setEditProgressedRate((agent.payPerProgressed || 0).toString());
    setEditCancelledRate((agent.payPerCancelled || 0).toString());
    setEditTotalLeads((agent.leadsBought || 0).toString());
    setEditProgressedLeads((agent.leadsProgressed || 0).toString());
    setEditCancelledLeads((agent.leadsCancelled || 0).toString());
  };

  const handleSaveEdit = (e) => {
    e.preventDefault();
    const updated = {
      baseSalary: parseFloat(editBase) || 0,
      payPerProgressed: parseFloat(editProgressedRate) || 0,
      payPerCancelled: parseFloat(editCancelledRate) || 0,
      leadsBought: parseInt(editTotalLeads) || 0,
      leadsProgressed: parseInt(editProgressedLeads) || 0,
      leadsCancelled: parseInt(editCancelledLeads) || 0,
      leadsConverted: parseInt(editProgressedLeads) || 0
    };
    updateBdAgent(editAgentId, updated);
    setEditAgentId(null);
    alert('Agent performance settings successfully updated!');
  };

  return (
    <div className="bd-performance-page animate-fade-in">
      
      {/* Overview Cards */}
      <section className="kpi-grid">
        <div className="kpi-card card-blue">
          <div className="kpi-header">
            <span className="kpi-title">Gross Revenue (Service Amt) â€¢ {selectedMonth !== 'All Months' ? selectedMonth : (selectedYear !== 'All Years' ? selectedYear : 'All Years')}</span>
            <span className="kpi-icon"><TrendingUp size={18} /></span>
          </div>
          <h2 className="kpi-value">{formatLakhs(overallRevenue)}</h2>
          <div className="kpi-change up">
            <span>Aggregated billing charges generated by BD team</span>
          </div>
        </div>

        <div className="kpi-card card-purple">
          <div className="kpi-header">
            <span className="kpi-title">Net Revenue (R Share)</span>
            <span className="kpi-icon"><Percent size={18} /></span>
          </div>
          <h2 className="kpi-value">{formatLakhs(overallNetRevenue)}</h2>
          <div className="kpi-change up">
            <span>Company net share from closures</span>
          </div>
        </div>

        <div className="kpi-card card-red">
          <div className="kpi-header">
            <span className="kpi-title">Total Potential Revenue Loss</span>
            <span className="kpi-icon"><Briefcase size={18} /></span>
          </div>
          <h2 className="kpi-value">{formatLakhs(overallLossAmount)}</h2>
          <div className="kpi-change down">
            <span>From cancelled & internally closed enquiries</span>
          </div>
        </div>

        <div className={`kpi-card ${Math.abs(overallVariance) < 1 ? 'card-green' : (overallVariance > 0 ? 'card-red' : 'card-blue')}`}>
          <div className="kpi-header">
            <span className="kpi-title">Net Payout Variance</span>
            <span className="kpi-icon"><Award size={18} /></span>
          </div>
          <h2 className="kpi-value">
            {overallVariance > 0 ? '+' : ''}{formatCurrency(overallVariance)}
          </h2>
          <div className={`kpi-change ${Math.abs(overallVariance) < 1 ? 'up' : 'down'}`}>
            <span>
              {Math.abs(overallVariance) < 1 
                ? 'Accounts fully reconciled' 
                : (overallVariance > 0 ? 'Ledger payouts exceed contract formula' : 'Outstanding pending payouts')}
            </span>
          </div>
        </div>
      </section>

      <div className="charts-grid-row">
        {/* Leaderboard Chart */}
        <div className="dashboard-card flex-1">
          <h3 className="card-title">BD Revenue Leaderboard (Gross)</h3>
          <div className="card-content">
            <div className="leaderboard-bars">
              {agentSummaries.map((agent, index) => {
                const maxRevenue = Math.max(...agentSummaries.map(a => a.grossRevenue), 10000);
                const percentage = (agent.grossRevenue / maxRevenue) * 100;
                const colors = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6'];
                const barColor = colors[index % colors.length];

                return (
                  <div className="leaderboard-item" key={agent.id}>
                    <div className="leaderboard-item-header">
                      <div className="agent-rank-name">
                        <span className="rank-num">#{index + 1}</span>
                        <span className="agent-name font-bold">{agent.name}</span>
                      </div>
                      <span className="agent-revenue-value">{formatCurrency(agent.grossRevenue)}</span>
                    </div>
                    
                    <div className="leaderboard-bar-track">
                      <div 
                        className="leaderboard-bar-fill" 
                        style={{ width: `${percentage}%`, backgroundColor: barColor }}
                      ></div>
                    </div>
                    
                    <div className="leaderboard-item-footer" style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'flex-start', fontSize: '0.7rem' }}>
                      <div>
                        Enquiries: {agent.leadsProgressed || 0} Prog
                        {' / '}{agent.leadsCancelled || 0} Cancel
                        {' / '}{agent.leadsInternallyClosed || 0} Int. Close
                        {(agent.leadsInprogress || 0) > 0 && <span style={{color:'#60a5fa'}}> / {agent.leadsInprogress} Active</span>}
                        {(agent.leadsOnHold || 0) > 0 && <span style={{color:'#f59e0b'}}> / {agent.leadsOnHold} On Hold</span>}
                        {(agent.leadsReallocated || 0) > 0 && <span style={{color:'#a78bfa'}}> / {agent.leadsReallocated} Reallocated</span>}
                        {(agent.leadsCreditNotes || 0) > 0 && <span style={{color:'#f87171'}}> / {agent.leadsCreditNotes} Credit Notes</span>}
                        {' / '}{agent.leadsBought || 0} Total
                      </div>
                      <div style={{ color: '#cbd5e1' }}>
                        Gross: {formatCurrency(agent.grossRevenue)} 
                        {' | '}Net Share: {formatCurrency(agent.netRevenue)} 
                        {' | '}Loss: {formatCurrency(agent.lossAmount)}
                        {agent.unverifiedAmount > 0 && (
                          <span style={{ color: '#fbbf24', marginLeft: '6px', fontWeight: 'bold' }}>
                            ⚠️ Unverified: {formatCurrency(agent.unverifiedAmount)}
                          </span>
                        )}
                        {(agent.creditNoteReversals || 0) > 0 && (
                          <span style={{ color: '#f87171' }}>
                            {' | '}Reversals: -{formatCurrency(agent.creditNoteReversals)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Ledger and Add Form */}
        <div className="dashboard-card flex-1">
          <div className="card-header-flex">
            <h3 className="card-title">BD Team Directory</h3>
            <button 
              className="btn btn-primary"
              onClick={() => setShowAddForm(!showAddForm)}
            >
              <Plus size={16} />
              <span>Add BD Agent</span>
            </button>
          </div>

          {showAddForm && (
            <form onSubmit={handleSubmit} className="inline-add-form animate-fade-in" style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '20px', marginBottom: '24px' }}>
              <h4 style={{ marginBottom: '16px', color: 'var(--text-main)' }}>Register New BD Agent & Define Contract Rules</h4>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '6px' }}>Agent Name</label>
                  <input 
                    type="text" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    placeholder="e.g. Sameer Dixit" 
                    required 
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'transparent', color: 'inherit' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '6px' }}>Base Salary (â‚¹)</label>
                  <input 
                    type="number" 
                    value={baseSalary} 
                    onChange={(e) => setBaseSalary(e.target.value)} 
                    placeholder="12000" 
                    required 
                    min="0"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'transparent', color: 'inherit' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '6px' }}>Comm. Rate (%) [Legacy]</label>
                  <input 
                    type="number" 
                    value={commissionRate} 
                    onChange={(e) => setCommissionRate(e.target.value)} 
                    placeholder="10" 
                    required 
                    min="1"
                    max="50"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'transparent', color: 'inherit' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '6px' }}>Pay per Progressed Enquiry (â‚¹)</label>
                  <input 
                    type="number" 
                    value={payPerProgressed} 
                    onChange={(e) => setPayPerProgressed(e.target.value)} 
                    placeholder="2500" 
                    required 
                    min="0"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'transparent', color: 'inherit' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '6px' }}>Pay per Cancelled Enquiry (â‚¹)</label>
                  <input 
                    type="number" 
                    value={payPerCancelled} 
                    onChange={(e) => setPayPerCancelled(e.target.value)} 
                    placeholder="500" 
                    required 
                    min="0"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'transparent', color: 'inherit' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '6px' }}>Total Enquiries Allocated</label>
                  <input 
                    type="number" 
                    value={leadsBought} 
                    onChange={(e) => setLeadsBought(e.target.value)} 
                    placeholder="30" 
                    required 
                    min="0"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'transparent', color: 'inherit' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '6px' }}>Enquiries Progressed</label>
                  <input 
                    type="number" 
                    value={leadsProgressed} 
                    onChange={(e) => setLeadsProgressed(e.target.value)} 
                    placeholder="14" 
                    required 
                    min="0"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'transparent', color: 'inherit' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '6px' }}>Enquiries Cancelled</label>
                  <input 
                    type="number" 
                    value={leadsCancelled} 
                    onChange={(e) => setLeadsCancelled(e.target.value)} 
                    placeholder="10" 
                    required 
                    min="0"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'transparent', color: 'inherit' }}
                  />
                </div>
              </div>

              <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Add Agent</button>
              </div>
            </form>
          )}

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Agent Name</th>
                  <th>Enquiries Realization</th>
                  <th>Base & Rates</th>
                  <th>Gross Revenue (Service Amt)</th>
                  <th>Net Revenue (R Share)</th>
                  <th style={{ textAlign: 'center' }}>Cost Audit Status</th>
                </tr>
              </thead>
              <tbody>
                {agentSummaries.map(agent => (
                  <tr 
                    key={agent.id}
                    onClick={() => { setActiveAgentDetails(agent); setModalPage(1); }}
                    className="clickable-row-item"
                    style={{ cursor: 'pointer' }}
                  >
                    <td className="font-bold">
                      <div>{agent.name}</div>
                      <span style={{ fontSize: '0.7rem', color: 'var(--accent-teal)', fontWeight: 'normal' }}>Click to audit & edit</span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 'bold', fontSize: '0.8rem' }}>
                        <span style={{ color: '#10b981' }}>{agent.leadsProgressed}P</span> / <span style={{ color: '#ef4444' }}>{agent.leadsCancelled}C</span> / <span style={{ color: '#ea580c' }}>{agent.leadsInternallyClosed}I</span> / <span style={{ color: '#64748b' }}>{(agent.leadsBought || 0) - (agent.leadsProgressed || 0) - (agent.leadsCancelled || 0) - (agent.leadsInternallyClosed || 0)}Pnd</span>
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Total: {agent.leadsBought}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Base: {formatCurrency(agent.baseSalary)}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>+{formatCurrency(agent.payPerProgressed)}/P | +{formatCurrency(agent.payPerCancelled)}/C</div>
                    </td>
                    <td className="font-bold text-teal text-right">{formatCurrency(agent.grossRevenue)}</td>
                    <td className="font-bold text-right text-blue" style={{ color: '#38bdf8' }}>{formatCurrency(agent.netRevenue)}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="status-badge inactive" style={{ backgroundColor: 'rgba(255,255,255,0.02)', color: '#64748b', fontSize: '0.8rem' }}>
                        Cost Audit Pending (Task 1)
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      </div>

      {/* BD Agent Detail Deal Audit Popup overlay */}
      {activeAgentDetails && (() => {
        const currentAgent = agentSummaries.find(a => a.id === activeAgentDetails.id) || getSafeAgent(activeAgentDetails);
        const detailTxs = transactions.filter(t => t.bdAgentId === currentAgent.id && isInFilteredPeriod(t));
        
        const total = currentAgent.leadsBought || 1;
        const progressedPct = ((currentAgent.leadsProgressed || 0) / total) * 100;
        const cancelledPct = ((currentAgent.leadsCancelled || 0) / total) * 100;
        const pendingPct = Math.max(0, 100 - progressedPct - cancelledPct);
        
        const commissionBonus = (currentAgent.revenueGenerated || 0) * (currentAgent.commissionRate || 0.02);
        const expectedCommission = (currentAgent.leadsProgressed || 0) * (currentAgent.payPerProgressed || 0) + (currentAgent.leadsCancelled || 0) * (currentAgent.payPerCancelled || 0) + commissionBonus;
        const totalCalculatedSalary = (currentAgent.baseSalary || 0) + expectedCommission;
        const variance = (currentAgent.commissionsEarned || 0) - totalCalculatedSalary;

        return (
          <div className="modal-backdrop" onClick={() => { setActiveAgentDetails(null); setEditAgentId(null); setModalPage(1); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="modal-container auditor-modal animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px', width: '95%', backgroundColor: '#0b132b', borderRadius: '16px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4)', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden', color: '#fff' }}>
              <div className="modal-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '20px 24px' }}>
                <div className="modal-header-title">
                  <h3 style={{ color: '#f8fafc', fontSize: '1.2rem', fontWeight: 'bold', fontFamily: "'Outfit', sans-serif" }}>Agent Performance Audit & Contract: {currentAgent.name}</h3>
                  <span className="modal-subtitle" style={{ color: '#94a3b8', fontSize: '0.8rem', display: 'block', marginTop: '2px' }}>Status: {currentAgent.status}</span>
                </div>
                <button className="btn-close" onClick={() => { setActiveAgentDetails(null); setEditAgentId(null); setModalPage(1); }} style={{ color: '#94a3b8' }}>
                  <X size={20} />
                </button>
              </div>
              
              <div className="modal-body" style={{ maxHeight: '80vh', overflowY: 'auto', padding: '1.5rem' }}>
                
                {editAgentId === currentAgent.id ? (
                  /* Edit Settings Panel */
                  <form onSubmit={handleSaveEdit} style={{ background: 'rgba(255,255,255,0.02)', padding: '1.5rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', marginBottom: '1.5rem' }}>
                    <h4 style={{ color: '#f8fafc', marginBottom: '1.25rem' }}>Update Contract Settings & Active Lead Counts</h4>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Base Salary (â‚¹)</label>
                        <input 
                          type="number" 
                          value={editBase} 
                  onChange={e => setEditBase(e.target.value)} 
                          style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: '#fff' }}
                          required
                          min="0"
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Pay per Progressed Enquiry (â‚¹)</label>
                        <input 
                          type="number" 
                          value={editProgressedRate} 
                          onChange={e => setEditProgressedRate(e.target.value)} 
                          style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: '#fff' }}
                          required
                          min="0"
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Pay per Cancelled Enquiry (â‚¹)</label>
                        <input 
                          type="number" 
                          value={editCancelledRate} 
                          onChange={e => setEditCancelledRate(e.target.value)} 
                          style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: '#fff' }}
                          required
                          min="0"
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Total Enquiries Allocated</label>
                        <input 
                          type="number" 
                          value={editTotalLeads} 
                          onChange={e => setEditTotalLeads(e.target.value)} 
                          style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: '#fff' }}
                          required
                          min="0"
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Progressed Enquiries</label>
                        <input 
                          type="number" 
                          value={editProgressedLeads} 
                          onChange={e => setEditProgressedLeads(e.target.value)} 
                          style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: '#fff' }}
                          required
                          min="0"
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Cancelled Enquiries</label>
                        <input 
                          type="number" 
                          value={editCancelledLeads} 
                          onChange={e => setEditCancelledLeads(e.target.value)} 
                          style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: '#fff' }}
                          required
                          min="0"
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                      <button type="button" className="btn btn-secondary" onClick={() => setEditAgentId(null)}>Cancel</button>
                      <button type="submit" className="btn btn-primary">Save Changes</button>
                    </div>
                  </form>
                ) : (
                  /* Standard Auditor Panels */
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <h4 style={{ color: '#f8fafc', margin: 0 }}>Active Performance & Enquiry Funnel</h4>
                      <button 
                        className="btn btn-primary" 
                        onClick={() => handleStartEdit(currentAgent)}
                        style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                      >
                        Edit Contract & Enquiries
                      </button>
                    </div>

                    {/* Progress Bar */}
                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '1.5rem' }}>
                      <div style={{ display: 'flex', height: '24px', borderRadius: '6px', overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.05)' }}>
                        {progressedPct > 0 && (
                          <div style={{ width: `${progressedPct}%`, backgroundColor: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.75rem', fontWeight: 'bold' }} title={`${currentAgent.leadsProgressed} Progressed`}>
                            {currentAgent.leadsProgressed} Prog ({progressedPct.toFixed(0)}%)
                          </div>
                        )}
                        {cancelledPct > 0 && (
                          <div style={{ width: `${cancelledPct}%`, backgroundColor: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.75rem', fontWeight: 'bold' }} title={`${currentAgent.leadsCancelled} Cancelled`}>
                            {currentAgent.leadsCancelled} Cancel ({cancelledPct.toFixed(0)}%)
                          </div>
                        )}
                        {(() => {
                          const intClosedPct = total > 0 ? ((currentAgent.leadsInternallyClosed || 0) / total) * 100 : 0;
                          return intClosedPct > 0 && (
                            <div style={{ width: `${intClosedPct}%`, backgroundColor: '#ea580c', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.75rem', fontWeight: 'bold' }} title={`${currentAgent.leadsInternallyClosed} Internally Closed`}>
                              {currentAgent.leadsInternallyClosed} Int. Close ({intClosedPct.toFixed(0)}%)
                            </div>
                          );
                        })()}
                        {pendingPct > 0 && (
                          <div style={{ width: `${pendingPct}%`, backgroundColor: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.75rem', fontWeight: 'bold' }} title={`${currentAgent.leadsBought - currentAgent.leadsProgressed - currentAgent.leadsCancelled - (currentAgent.leadsInternallyClosed || 0)} Pending`}>
                            {currentAgent.leadsBought - currentAgent.leadsProgressed - currentAgent.leadsCancelled - (currentAgent.leadsInternallyClosed || 0)} Pending ({pendingPct.toFixed(0)}%)
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.75rem', color: '#94a3b8' }}>
                        <span>Total Allocated Enquiries: {currentAgent.leadsBought}</span>
                        <span>Pending Realization: {currentAgent.leadsBought - currentAgent.leadsProgressed - currentAgent.leadsCancelled - (currentAgent.leadsInternallyClosed || 0)} Enquiries</span>
                        <span>Realization rate: {(((currentAgent.leadsProgressed || 0) + (currentAgent.leadsCancelled || 0) + (currentAgent.leadsInternallyClosed || 0)) / total * 100).toFixed(0)}%</span>
                      </div>
                    </div>

                    <div className="stats-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem', marginTop: '1rem' }}>
                      <div className="stat-box" style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <span className="stat-label" style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Calculated Pay</span>
                        <h4 style={{ color: '#64748b', margin: '0.5rem 0 0 0', fontSize: '1.15rem' }}>Pending</h4>
                      </div>
                      <div className="stat-box" style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <span className="stat-label" style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Actual Paid</span>
                        <h4 style={{ color: '#64748b', margin: '0.5rem 0 0 0', fontSize: '1.15rem' }}>Pending</h4>
                      </div>
                      <div className="stat-box" style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <span className="stat-label" style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Variance</span>
                        <h4 style={{ color: '#64748b', margin: '0.5rem 0 0 0', fontSize: '1.15rem' }}>Pending</h4>
                      </div>
                      <div className="stat-box" style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <span className="stat-label" style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Potential Loss</span>
                        <h4 style={{ color: '#f43f5e', margin: '0.5rem 0 0 0', fontSize: '1.15rem' }}>{formatCurrency(currentAgent.lossAmount || 0)}</h4>
                      </div>
                    </div>

                    {/* Audit Reconciliation Board */}
                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1.25rem', borderRadius: '8px', borderLeft: '4px solid #64748b', marginBottom: '1.5rem', borderRight: '1px solid rgba(255,255,255,0.05)', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <h4 style={{ margin: '0 0 0.75rem 0', color: '#f8fafc', fontSize: '0.95rem' }}>Performance-Based Salary Calculation (Audit Status)</h4>
                      <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0, lineHeight: '1.5' }}>
                        Cost reconciliation and variable pay audits are currently pending the synchronization of the expenditure cost ledger (Task 1). 
                        Please review the deal flow details below, but note that salary rules, contractual payouts, and variance checks will remain disabled until cost ledger data is certified reliable.
                      </p>
                    </div>
                  </>
                )}

                <h4 style={{ color: '#f8fafc', marginBottom: '0.75rem', marginTop: '1.5rem' }}>Disbursed Payments & Transactions ({detailTxs.length}) â€¢ {selectedMonth}</h4>
                {detailTxs.length === 0 ? (
                  <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>No ledger expense payments found for this business development agent for this month selection.</p>
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
                              <th style={{ color: '#94a3b8', background: 'transparent', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '12px 16px', fontWeight: '600' }}>Title / Category</th>
                              <th style={{ color: '#94a3b8', background: 'transparent', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '12px 16px', fontWeight: '600' }}>Type</th>
                              <th style={{ color: '#94a3b8', background: 'transparent', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '12px 16px', fontWeight: '600' }} className="text-right">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {paginatedTxs.map(t => (
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
                                transition: 'all 0.2s',
                                marginRight: '0.5rem'
                              }}
                            >
                              <ChevronLeft size={12} />
                              <span>Prev</span>
                            </button>
                            
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => {
                              if (totalPages > 6 && pageNum !== 1 && pageNum !== totalPages && Math.abs(pageNum - modalPage) > 1) {
                                if (pageNum === 2 && modalPage > 3) return <span key="dots-start" style={{ color: '#475569', padding: '0 4px', fontSize: '0.75rem' }}>...</span>;
                                if (pageNum === totalPages - 1 && modalPage < totalPages - 2) return <span key="dots-end" style={{ color: '#475569', padding: '0 4px', fontSize: '0.75rem' }}>...</span>;
                                return null;
                              }
                              return (
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
                              );
                            })}

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
                                transition: 'all 0.2s',
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

export default BDPerformance;
