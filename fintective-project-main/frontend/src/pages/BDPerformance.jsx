import React, { useContext, useState, useEffect, useMemo } from 'react';
import { FinanceContext, API_BASE_URL } from '../context/FinanceContext';
import { fetchWithApiKey } from '../utils/apiClient';
import { formatCurrency, formatLakhs, formatDate } from '../utils/formatters';
import { TrendingUp, Plus, Award, Briefcase, X, Percent, ChevronLeft, ChevronRight } from 'lucide-react';
import Pagination from '../components/Pagination';

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
  const [agentPage, setAgentPage] = useState(1);
  const AGENTS_PER_PAGE = 8;

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
    fetchWithApiKey(`${API_BASE_URL}/bd-revenue-leaderboard?start_date=${start}&end_date=${end}`)
      .then(res => {
        if (res.ok) return res.json();
      })
      .then(data => {
        if (data) setLeaderboard(data);
      })
      .catch(err => console.error("Leaderboard load failed:", err));
  }, [selectedMonth, selectedYear]);

  // Pre-indexed transaction map for instant O(1) agent metric calculation
  const agentTxsMap = useMemo(() => {
    const map = {};
    if (!Array.isArray(transactions)) return map;
    transactions.forEach(t => {
      if (!isInFilteredPeriod(t)) return;
      if (t.bdAgentId) {
        if (!map[t.bdAgentId]) map[t.bdAgentId] = [];
        map[t.bdAgentId].push(t);
      }
      if (t.bdAgentName) {
        const nameKey = t.bdAgentName.trim().toLowerCase();
        if (!map[nameKey]) map[nameKey] = [];
        map[nameKey].push(t);
      }
    });
    return map;
  }, [transactions, selectedMonth, selectedYear]);

  const getAgentMetrics = (agent) => {
    const safeAgent = getSafeAgent(agent);
    
    // Look up this agent's period-specific stats in the fetched leaderboard
    const lbMatch = leaderboard.find(item => item.bd_name.trim().toLowerCase() === safeAgent.name.trim().toLowerCase());
    
    const nameKey = safeAgent.name.trim().toLowerCase();
    const agentTxs = agentTxsMap[safeAgent.id] || agentTxsMap[nameKey] || [];
    
    const contextGross = agentTxs.filter(t => t.type === 'income').reduce((sum, t) => sum + (t.amount || 0), 0);
    const contextNet = agentTxs.filter(t => t.type === 'income').reduce((sum, t) => sum + (t.rShare || t.amount * 0.4375 || t.amount), 0);

    const grossRevenue = lbMatch ? lbMatch.gross_revenue : (contextGross > 0 ? contextGross : 0.0);
    const netRevenue = lbMatch ? lbMatch.net_revenue : (contextNet > 0 ? contextNet : (contextGross * 0.4375));
    const lossAmount = lbMatch ? lbMatch.potential_loss : 0.0;
    const unverifiedAmount = lbMatch ? (lbMatch.unverified_amount || 0.0) : 0.0;
    
    // Revenue generated = net revenue (Our Share)
    const revenueGenerated = netRevenue > 0 ? netRevenue : grossRevenue;
    
    // Actual payout is the sum of expense payments under 'BD commissions' or 'Salaries' linked to this agent
    const commissionsEarned = agentTxs
      .filter(t => t.type === 'expense' && (t.category === 'BD commissions' || t.category === 'Salaries'))
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    const commissionBonus = revenueGenerated * (safeAgent.commissionRate || 0.02);
    
    // Calculate performance-based salary using period-specific closed/cancelled deal counts
    const closedCount = lbMatch ? lbMatch.invoices_closed : agentTxs.filter(t => t.type === 'income').length;
    
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

  const allAgentsList = React.useMemo(() => {
    const baseRoster = bdAgents && bdAgents.length > 0 ? bdAgents : [];
    const lbItems = leaderboard && leaderboard.length > 0 ? leaderboard : [];
    const matchedLbIndices = new Set();

    const merged = baseRoster.map((agent) => {
      const cleanName = (agent.name || '').trim().toLowerCase();
      const lbIdx = lbItems.findIndex(item => (item.bd_name || '').trim().toLowerCase() === cleanName);
      if (lbIdx !== -1) {
        matchedLbIndices.add(lbIdx);
        const item = lbItems[lbIdx];
        return {
          ...agent,
          leadsProgressed: item.invoices_closed ?? (agent.leadsProgressed || 0),
          leadsCancelled: item.potential_loss > 0 ? Math.ceil(item.potential_loss / 50000) : (agent.leadsCancelled || 0),
        };
      }
      return {
        ...agent,
      };
    });

    // Also include any BD present in live transactions not yet in merged roster
    const existingNames = new Set(merged.map(a => (a.name || '').trim().toLowerCase()));
    if (Array.isArray(transactions)) {
      transactions.forEach((t, idx) => {
        const bName = (t.bdAgentName || '').trim();
        if (bName && bName.toLowerCase() !== 'unknown' && bName.toLowerCase() !== 'head office' && !existingNames.has(bName.toLowerCase())) {
          existingNames.add(bName.toLowerCase());
          const agentTxs = transactions.filter(x => (x.bdAgentName || '').trim().toLowerCase() === bName.toLowerCase());
          const closedCount = agentTxs.filter(x => x.type === 'income').length;
          merged.push({
            id: t.bdAgentId || `bd-tx-${idx}`,
            name: bName,
            role: 'BD Specialist',
            baseSalary: 12000,
            commissionRate: 0.02,
            payPerProgressed: 2500,
            payPerCancelled: 500,
            leadsBought: Math.max(10, closedCount * 2),
            leadsProgressed: closedCount,
            leadsCancelled: 0,
            status: 'Active'
          });
        }
      });
    }

    return merged;
  }, [bdAgents, leaderboard, transactions]);

  const agentSummaries = allAgentsList.map(agent => {
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
            <span className="kpi-title">Gross Revenue (Service Amt) • {selectedMonth !== 'All Months' ? selectedMonth : (selectedYear !== 'All Years' ? selectedYear : 'All Years')}</span>
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
                      <div style={{ color: 'var(--text-muted)' }}>
                        Gross: {formatCurrency(agent.grossRevenue)} 
                        {' | '}Net Share: {formatCurrency(agent.netRevenue)} 
                        {' | '}Loss: {formatCurrency(agent.lossAmount)}
                        {agent.unverifiedAmount > 0 && (
                          <span style={{ color: 'var(--color-pending)', marginLeft: '6px', fontWeight: 'bold' }}>
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
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '6px' }}>Base Salary (₹)</label>
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
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '6px' }}>Pay per Progressed Enquiry (₹)</label>
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
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '6px' }}>Pay per Cancelled Enquiry (₹)</label>
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
                {(() => {
                  const safeAgentPage = Math.min(Math.max(1, agentPage), Math.max(1, Math.ceil(agentSummaries.length / AGENTS_PER_PAGE)));
                  const paginatedAgents = agentSummaries.slice((safeAgentPage - 1) * AGENTS_PER_PAGE, safeAgentPage * AGENTS_PER_PAGE);
                  
                  return paginatedAgents.map(agent => (
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
                      <td className="font-bold text-right text-blue" style={{ color: 'var(--color-link)' }}>{formatCurrency(agent.netRevenue)}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="status-badge inactive" style={{ backgroundColor: 'var(--bg-main)', color: 'var(--text-muted)', border: '1px solid var(--border-color)', fontSize: '0.8rem' }}>
                          Cost Audit Pending (Task 1)
                        </span>
                      </td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={agentPage}
            totalItems={agentSummaries.length}
            pageSize={AGENTS_PER_PAGE}
            onPageChange={setAgentPage}
            itemName="agents"
          />

        </div>
      </div>

      {/* BD Agent Detail Deal Audit Popup overlay */}
      {activeAgentDetails && (() => {
        const currentAgent = agentSummaries.find(a => a.id === activeAgentDetails.id) || getSafeAgent(activeAgentDetails);
        const detailTxs = transactions.filter(t => t.bdAgentId === currentAgent.id && isInFilteredPeriod(t));
        
        const progressed = currentAgent.leadsProgressed || 0;
        const cancelled = currentAgent.leadsCancelled || 0;
        const internallyClosed = currentAgent.leadsInternallyClosed || 0;
        const rawBought = currentAgent.leadsBought || 0;
        const total = Math.max(1, rawBought, progressed + cancelled + internallyClosed);
        
        const progressedPct = Math.min(100, Math.max(0, (progressed / total) * 100));
        const cancelledPct = Math.min(100 - progressedPct, Math.max(0, (cancelled / total) * 100));
        const internallyClosedPct = Math.min(100 - progressedPct - cancelledPct, Math.max(0, (internallyClosed / total) * 100));
        const pendingPct = Math.max(0, 100 - progressedPct - cancelledPct - internallyClosedPct);
        const pendingCount = Math.max(0, total - progressed - cancelled - internallyClosed);
        const realizationPct = Math.min(100, Math.round(((progressed + cancelled + internallyClosed) / total) * 100));
        
        const commissionBonus = (currentAgent.revenueGenerated || 0) * (currentAgent.commissionRate || 0.02);
        const expectedCommission = (progressed * (currentAgent.payPerProgressed || 0)) + (cancelled * (currentAgent.payPerCancelled || 0)) + commissionBonus;
        const totalCalculatedSalary = (currentAgent.baseSalary || 0) + expectedCommission;
        const variance = (currentAgent.commissionsEarned || 0) - totalCalculatedSalary;

        return (
          <div className="modal-backdrop" onClick={() => { setActiveAgentDetails(null); setEditAgentId(null); setModalPage(1); }}>
            <div className="modal-container auditor-modal animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '880px', width: '92%' }}>
              <div className="modal-header">
                <div className="modal-header-title">
                  <h3>Agent Performance Audit & Contract: {currentAgent.name}</h3>
                  <span className="modal-subtitle">Status: {currentAgent.status || 'Active'}</span>
                </div>
                <button className="close-btn" onClick={() => { setActiveAgentDetails(null); setEditAgentId(null); setModalPage(1); }} aria-label="Close modal">
                  <X size={18} />
                </button>
              </div>
              
              <div className="modal-body" style={{ maxHeight: '76vh', overflowY: 'auto', padding: '20px 24px' }}>
                
                {editAgentId === currentAgent.id ? (
                  /* Edit Settings Panel */
                  <form onSubmit={handleSaveEdit} style={{ background: '#F6F7F4', padding: '20px', borderRadius: '12px', border: '1px solid #E3E5E0', marginBottom: '1.5rem' }}>
                    <h4 style={{ color: '#1B2321', marginBottom: '1.25rem', fontWeight: '700' }}>Update Contract Settings & Active Lead Counts</h4>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#6B7268', fontWeight: '600', marginBottom: '0.25rem' }}>Base Salary (₹)</label>
                        <input 
                          type="number" 
                          value={editBase} 
                          onChange={e => setEditBase(e.target.value)} 
                          style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #D1D5DB', background: '#FFFFFF', color: '#1B2321', fontSize: '0.88rem' }}
                          required
                          min="0"
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#6B7268', fontWeight: '600', marginBottom: '0.25rem' }}>Pay per Progressed Enquiry (₹)</label>
                        <input 
                          type="number" 
                          value={editProgressedRate} 
                          onChange={e => setEditProgressedRate(e.target.value)} 
                          style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #D1D5DB', background: '#FFFFFF', color: '#1B2321', fontSize: '0.88rem' }}
                          required
                          min="0"
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#6B7268', fontWeight: '600', marginBottom: '0.25rem' }}>Pay per Cancelled Enquiry (₹)</label>
                        <input 
                          type="number" 
                          value={editCancelledRate} 
                          onChange={e => setEditCancelledRate(e.target.value)} 
                          style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #D1D5DB', background: '#FFFFFF', color: '#1B2321', fontSize: '0.88rem' }}
                          required
                          min="0"
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#6B7268', fontWeight: '600', marginBottom: '0.25rem' }}>Total Enquiries Allocated</label>
                        <input 
                          type="number" 
                          value={editTotalLeads} 
                          onChange={e => setEditTotalLeads(e.target.value)} 
                          style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #D1D5DB', background: '#FFFFFF', color: '#1B2321', fontSize: '0.88rem' }}
                          required
                          min="0"
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#6B7268', fontWeight: '600', marginBottom: '0.25rem' }}>Progressed Enquiries</label>
                        <input 
                          type="number" 
                          value={editProgressedLeads} 
                          onChange={e => setEditProgressedLeads(e.target.value)} 
                          style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #D1D5DB', background: '#FFFFFF', color: '#1B2321', fontSize: '0.88rem' }}
                          required
                          min="0"
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#6B7268', fontWeight: '600', marginBottom: '0.25rem' }}>Cancelled Enquiries</label>
                        <input 
                          type="number" 
                          value={editCancelledLeads} 
                          onChange={e => setEditCancelledLeads(e.target.value)} 
                          style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #D1D5DB', background: '#FFFFFF', color: '#1B2321', fontSize: '0.88rem' }}
                          required
                          min="0"
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                      <button type="button" className="btn btn-secondary" onClick={() => setEditAgentId(null)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #D1D5DB', backgroundColor: '#FFFFFF', color: '#374151', fontWeight: '500', cursor: 'pointer' }}>Cancel</button>
                      <button type="submit" className="btn btn-primary" style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', backgroundColor: '#0F6E56', color: '#FFFFFF', fontWeight: '600', cursor: 'pointer' }}>Save Changes</button>
                    </div>
                  </form>
                ) : (
                  /* Standard Auditor Panels */
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <h4 style={{ color: '#1B2321', margin: 0, fontWeight: '700' }}>Active Performance & Enquiry Funnel</h4>
                      <button 
                        className="btn btn-primary" 
                        onClick={() => handleStartEdit(currentAgent)}
                        style={{ padding: '6px 12px', fontSize: '0.78rem', backgroundColor: '#0F6E56', color: '#FFFFFF', borderRadius: '6px', border: 'none', fontWeight: '600', cursor: 'pointer' }}
                      >
                        Edit Contract & Enquiries
                      </button>
                    </div>

                    {/* Progress Bar */}
                    <div style={{ background: '#F6F7F4', padding: '14px', borderRadius: '10px', border: '1px solid #E3E5E0', marginBottom: '1.25rem' }}>
                      <div style={{ display: 'flex', height: '26px', borderRadius: '6px', overflow: 'hidden', backgroundColor: '#E3E5E0' }}>
                        {progressedPct > 0 && (
                          <div 
                            style={{ 
                              width: `${progressedPct}%`, 
                              backgroundColor: '#0F6E56', 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center', 
                              color: '#FFFFFF', 
                              fontSize: '0.75rem', 
                              fontWeight: '700',
                              overflow: 'hidden',
                              whiteSpace: 'nowrap',
                              textOverflow: 'ellipsis',
                              padding: '0 4px',
                              boxSizing: 'border-box',
                              minWidth: 0
                            }} 
                            title={`${progressed} Progressed (${progressedPct.toFixed(1)}%)`}
                          >
                            {progressedPct >= 18 ? `${progressed} Prog (${progressedPct.toFixed(0)}%)` : (progressedPct >= 8 ? `${progressedPct.toFixed(0)}%` : '')}
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
                              color: '#FFFFFF', 
                              fontSize: '0.75rem', 
                              fontWeight: '700',
                              overflow: 'hidden',
                              whiteSpace: 'nowrap',
                              textOverflow: 'ellipsis',
                              padding: '0 4px',
                              boxSizing: 'border-box',
                              minWidth: 0
                            }} 
                            title={`${cancelled} Cancelled (${cancelledPct.toFixed(1)}%)`}
                          >
                            {cancelledPct >= 18 ? `${cancelled} Cancel (${cancelledPct.toFixed(0)}%)` : (cancelledPct >= 8 ? `${cancelledPct.toFixed(0)}%` : '')}
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
                              color: '#FFFFFF', 
                              fontSize: '0.75rem', 
                              fontWeight: '700',
                              overflow: 'hidden',
                              whiteSpace: 'nowrap',
                              textOverflow: 'ellipsis',
                              padding: '0 4px',
                              boxSizing: 'border-box',
                              minWidth: 0
                            }} 
                            title={`${internallyClosed} Internally Closed (${internallyClosedPct.toFixed(1)}%)`}
                          >
                            {internallyClosedPct >= 18 ? `${internallyClosed} Int. Close (${internallyClosedPct.toFixed(0)}%)` : (internallyClosedPct >= 8 ? `${internallyClosedPct.toFixed(0)}%` : '')}
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
                              color: '#FFFFFF', 
                              fontSize: '0.75rem', 
                              fontWeight: '700',
                              overflow: 'hidden',
                              whiteSpace: 'nowrap',
                              textOverflow: 'ellipsis',
                              padding: '0 4px',
                              boxSizing: 'border-box',
                              minWidth: 0
                            }} 
                            title={`${pendingCount} Pending (${pendingPct.toFixed(1)}%)`}
                          >
                            {pendingPct >= 18 ? `${pendingCount} Pending (${pendingPct.toFixed(0)}%)` : (pendingPct >= 8 ? `${pendingPct.toFixed(0)}%` : '')}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.75rem', color: '#6B7268' }}>
                        <span>Total Allocated Enquiries: <strong>{total}</strong></span>
                        <span>Pending Realization: <strong>{pendingCount} Enquiries</strong></span>
                        <span>Realization rate: <strong>{realizationPct}%</strong></span>
                      </div>
                    </div>

                    <div className="stats-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '1.25rem' }}>
                      <div className="stat-box" style={{ background: '#F6F7F4', padding: '14px', borderRadius: '10px', border: '1px solid #E3E5E0' }}>
                        <span className="stat-label" style={{ fontSize: '0.75rem', color: '#6B7268', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Calculated Pay</span>
                        <h4 style={{ color: '#22314F', margin: '6px 0 0 0', fontSize: '1.2rem', fontWeight: '700' }}>{formatCurrency(totalCalculatedSalary)}</h4>
                      </div>
                      <div className="stat-box" style={{ background: '#F6F7F4', padding: '14px', borderRadius: '10px', border: '1px solid #E3E5E0' }}>
                        <span className="stat-label" style={{ fontSize: '0.75rem', color: '#6B7268', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Actual Paid</span>
                        <h4 style={{ color: '#0F6E56', margin: '6px 0 0 0', fontSize: '1.2rem', fontWeight: '700' }}>{formatCurrency(currentAgent.commissionsEarned || 0)}</h4>
                      </div>
                      <div className="stat-box" style={{ background: '#F6F7F4', padding: '14px', borderRadius: '10px', border: '1px solid #E3E5E0' }}>
                        <span className="stat-label" style={{ fontSize: '0.75rem', color: '#6B7268', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Variance</span>
                        <h4 style={{ color: Math.abs(variance) < 1 ? '#0F6E56' : (variance > 0 ? '#A8402E' : '#22314F'), margin: '6px 0 0 0', fontSize: '1.2rem', fontWeight: '700' }}>
                          {variance > 0 ? '+' : ''}{formatCurrency(variance)}
                        </h4>
                      </div>
                      <div className="stat-box" style={{ background: '#F6F7F4', padding: '14px', borderRadius: '10px', border: '1px solid #E3E5E0' }}>
                        <span className="stat-label" style={{ fontSize: '0.75rem', color: '#6B7268', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Potential Loss</span>
                        <h4 style={{ color: '#A8402E', margin: '6px 0 0 0', fontSize: '1.2rem', fontWeight: '700' }}>{formatCurrency(currentAgent.lossAmount || 0)}</h4>
                      </div>
                    </div>

                    {/* Audit Reconciliation Board */}
                    <div style={{ background: '#FAFAF8', padding: '14px 18px', borderRadius: '10px', borderLeft: '4px solid #0F6E56', marginBottom: '1.25rem', border: '1px solid #E3E5E0' }}>
                      <h4 style={{ margin: '0 0 0.4rem 0', color: '#1B2321', fontSize: '0.9rem', fontWeight: '700' }}>Performance-Based Contract Reconciliation</h4>
                      <p style={{ color: '#6B7268', fontSize: '0.8rem', margin: 0, lineHeight: '1.5' }}>
                        Calculated Pay reflects Base Salary ({formatCurrency(currentAgent.baseSalary || 0)}) + Progressed Incentives ({currentAgent.leadsProgressed || 0} × {formatCurrency(currentAgent.payPerProgressed || 0)}) + Commission Bonus ({((currentAgent.commissionRate || 0.02)*100).toFixed(1)}%).
                      </p>
                    </div>
                  </>
                )}

                <h4 style={{ color: '#1B2321', marginBottom: '0.75rem', marginTop: '1.25rem', fontWeight: '700', fontSize: '0.92rem' }}>
                  Disbursed Payments & Transactions ({detailTxs.length}) • {selectedMonth}
                </h4>
                {detailTxs.length === 0 ? (
                  <p style={{ color: '#6B7268', fontSize: '0.85rem', padding: '20px 0', textAlign: 'center' }}>No ledger expense payments found for this business development agent for this month selection.</p>
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
                              <th style={{ color: '#6B7268', background: '#FAFAF8', padding: '10px 14px', fontWeight: '600' }}>Title / Category</th>
                              <th style={{ color: '#6B7268', background: '#FAFAF8', padding: '10px 14px', fontWeight: '600', width: '100px' }}>Type</th>
                              <th style={{ color: '#6B7268', background: '#FAFAF8', padding: '10px 14px', fontWeight: '600', textAlign: 'right', width: '120px' }}>Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {paginatedTxs.map(t => (
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
                        currentPage={modalPage}
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

export default BDPerformance;
