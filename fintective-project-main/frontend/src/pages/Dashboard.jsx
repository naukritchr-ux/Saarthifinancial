import React, { useContext, useState } from 'react';
import { FinanceContext } from '../context/FinanceContext';
import { formatCurrency, formatLakhs, formatDate } from '../utils/formatters';
import { DonutChart, BarChart } from '../components/CustomCharts';
import { ArrowUpRight, ArrowDownRight, TrendingUp, DollarSign, Activity, Percent, X, Calendar, Landmark, CreditCard, Tag } from 'lucide-react';

const Dashboard = ({ setActivePage }) => {
  const { moduleFilteredTransactions: transactions, selectedMonth, selectedYear, budgets, userRole, franchisees, bdAgents, activeModule } = useContext(FinanceContext);
  const [selectedTx, setSelectedTx] = useState(null); // Auditor Modal state

  // Month parse helper
  const getMonthAndYear = (dateStr) => {
    const date = new Date(dateStr);
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return {
      monthYear: `${monthNames[date.getMonth()]} ${date.getFullYear()}`,
      monthName: monthNames[date.getMonth()],
      year: date.getFullYear()
    };
  };

  // Filter transactions based on active role
  const roleTxs = transactions.filter(tx => {
    if (userRole === 'admin') return true;
    if (userRole.startsWith('franchise_')) {
      const fId = userRole.split('_')[1];
      return tx.franchiseeId === fId;
    }
    if (userRole.startsWith('bd_')) {
      const bdId = userRole.split('_')[1];
      return tx.bdAgentId === bdId;
    }
    return true;
  });

  // Filter current selection by both Month and Year
  const currentTxs = roleTxs.filter(tx => {
    // 1. Month filter
    let monthMatch = true;
    if (selectedMonth !== 'All Months') {
      monthMatch = getMonthAndYear(tx.date).monthYear === selectedMonth;
    }

    // 2. Year filter
    let yearMatch = true;
    if (selectedYear !== 'All Years') {
      if (tx.financialYear && tx.financialYear !== 'N/A') {
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
  });

  const displayTxs = (currentTxs.length > 0 || selectedMonth !== 'All Months' || selectedYear !== 'All Years') ? currentTxs : roleTxs;

  const revenue = (displayTxs.length > 0 ? displayTxs : roleTxs).filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const expenses = (displayTxs.length > 0 ? displayTxs : roleTxs).filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const profit = revenue - expenses;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

  // Comparison metrics with previous month
  let prevMonthLabel = '';
  let prevRevenue = 0;
  let prevExpenses = 0;
  let prevProfit = 0;
  let prevMargin = 0;

  if (selectedMonth !== 'All Months') {
    const parts = selectedMonth.split(' ');
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

    prevMonthLabel = `${monthNames[prevIdx]} ${prevYear}`;
    const prevTxs = roleTxs.filter(tx => getMonthAndYear(tx.date).monthYear === prevMonthLabel);

    prevRevenue = prevTxs.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    prevExpenses = prevTxs.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    prevProfit = prevRevenue - prevExpenses;
    prevMargin = prevRevenue > 0 ? (prevProfit / prevRevenue) * 100 : 0;
  }

  const getChange = (curr, prev) => {
    if (prev === 0) return { val: 0, text: 'No prior data', positive: true };
    const diff = ((curr - prev) / prev) * 100;
    const isPositive = diff >= 0;
    return {
      val: Math.abs(diff).toFixed(0),
      text: `${isPositive ? '↑' : '↓'} ${Math.abs(diff).toFixed(0)}% vs ${prevMonthLabel.split(' ')[0]}`,
      positive: isPositive
    };
  };

  const getMarginChange = (curr, prev) => {
    if (prev === 0) return { val: 0, text: 'No prior data', positive: true };
    const diff = curr - prev;
    const isPositive = diff >= 0;
    return {
      val: Math.abs(diff).toFixed(1),
      text: `${isPositive ? '↑' : '↓'} ${Math.abs(diff).toFixed(1)}pp vs ${prevMonthLabel.split(' ')[0]}`,
      positive: isPositive
    };
  };

  const revenueChange = getChange(revenue, prevRevenue);
  const expenseChange = getChange(expenses, prevExpenses);
  const profitChange = getChange(profit, prevProfit);
  const marginChange = getMarginChange(margin, prevMargin);

  // Income Donut Chart
  const incomeCategories = {};
  currentTxs.filter(t => t.type === 'income').forEach(tx => {
    const cat = tx.category || 'Other';
    incomeCategories[cat] = (incomeCategories[cat] || 0) + tx.amount;
  });

  const donutColors = {
    'Recruitment': '#2563eb',
    'Franchisee fee': '#0d9488',
    'Job portal': '#ea580c',
    'Other': '#64748b'
  };

  const donutData = Object.keys(incomeCategories).map(cat => ({
    label: cat,
    value: incomeCategories[cat],
    color: donutColors[cat] || '#8b5cf6'
  })).sort((a, b) => b.value - a.value);

  const finalDonutData = donutData.length > 0 ? donutData : (
    activeModule === 'job_portal' ? [
      { label: 'Job portal sales', value: 112000, color: '#ea580c' },
      { label: 'Portal Subscriptions', value: 19000, color: '#10b981' }
    ] : [
      { label: 'Recruitment', value: 249600, color: '#2563eb' },
      { label: 'Franchisee fee', value: 187200, color: '#0d9488' }
    ]
  );

  // Budget vs Actual Spend Calculations
  const expenseCategories = {};
  currentTxs.filter(t => t.type === 'expense').forEach(tx => {
    const cat = tx.category || 'Other';
    expenseCategories[cat] = (expenseCategories[cat] || 0) + tx.amount;
  });

  const allowedBudgetCategories = activeModule === 'job_portal' 
    ? ['Portal subscriptions', 'Marketing', 'Salaries', 'Other']
    : ['Salaries', 'BD commissions', 'Marketing', 'Office & infra', 'Other'];

  const budgetSummary = Object.keys(budgets)
    .filter(category => allowedBudgetCategories.includes(category))
    .map(category => {
      const spent = expenseCategories[category] || 0;
      const limit = budgets[category] || 0;
      const percent = limit > 0 ? (spent / limit) * 100 : 0;
      const overspent = spent - limit;

      return {
        category,
        spent,
        limit,
        percent,
        overspent
      };
    });

  // --- DYNAMIC ALERTS BOARD ---
  const alertsList = [];

  // 1. Check budget limits (only relevant for admin in single-month views)
  if (selectedMonth !== 'All Months') {
    budgetSummary.forEach(item => {
      if (item.spent > item.limit) {
        alertsList.push({
          type: 'danger',
          text: `Over Budget: ${item.category} has exceeded its monthly limit by ${formatCurrency(item.overspent)}.`
        });
      } else if (item.percent >= 90) {
        alertsList.push({
          type: 'warning',
          text: `Budget Warning: ${item.category} is at ${item.percent.toFixed(0)}% of its limit.`
        });
      }
    });
  }

  // 2. Check franchisee negative margin hubs (skip inactive locations)
  franchisees.filter(f => f.status === 'Active').forEach(fran => {
    const franTxs = currentTxs.filter(t => t.franchiseeId === fran.id);
    const rev = franTxs.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const exp = franTxs.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    if (exp > rev && rev > 0) {
      alertsList.push({
        type: 'danger',
        text: `Negative Margin: Franchisee "${fran.name}" has local costs exceeding royalties by ${formatCurrency(exp - rev)}.`,
        franchiseeId: fran.id
      });
    }
  });

  // 3. Check BD agent commission overrun alerts (month-scoped)
  const activeAgentStats = currentTxs.reduce((acc, tx) => {
    if (tx.bdAgentId) {
      if (!acc[tx.bdAgentId]) acc[tx.bdAgentId] = { revenue: 0, commission: 0 };
      if (tx.type === 'income') acc[tx.bdAgentId].revenue += tx.amount;
      if (tx.type === 'expense') acc[tx.bdAgentId].commission += tx.amount;
    }
    return acc;
  }, {});

  Object.keys(activeAgentStats).forEach(bdId => {
    const stats = activeAgentStats[bdId];
    if (stats.revenue > 0) {
      const agent = bdAgents.find(a => a.id === bdId);
      if (stats.commission > stats.revenue) {
        alertsList.push({
          type: 'danger',
          text: `Commission Alert: BD Agent "${agent?.name || bdId}" payout exceeds closed revenue by ${formatCurrency(stats.commission - stats.revenue)}.`,
          bdAgentId: bdId
        });
      } else if (stats.commission >= stats.revenue * 0.85) {
        const percentage = ((stats.commission / stats.revenue) * 100).toFixed(0);
        alertsList.push({
          type: 'warning',
          text: `Commission Warning: BD Agent "${agent?.name || bdId}" payout is at ${percentage}% of closed revenue (${formatCurrency(stats.commission)} of ${formatCurrency(stats.revenue)}).`,
          bdAgentId: bdId
        });
      }
    }
  });

  // Filter alerts by active permission scope (robust ID-based match)
  const filteredAlerts = alertsList.filter(alert => {
    if (userRole === 'admin') return true;
    if (userRole.startsWith('franchise_')) {
      const fId = userRole.split('_')[1];
      return alert.franchiseeId === fId;
    }
    if (userRole.startsWith('bd_')) {
      const bdId = userRole.split('_')[1];
      return alert.bdAgentId === bdId;
    }
    return false;
  });

  // Dynamic Narrative Insight Generator
  const getNarrativeSummary = () => {
    let currentMonthRevenue = revenue;
    let comparisonRevenue = prevRevenue;
    let targetMonthLabel = selectedMonth;

    if (selectedMonth === 'All Months') {
      const monthlyRevenues = {};
      roleTxs.filter(t => t.type === 'income').forEach(t => {
        const my = getMonthAndYear(t.date).monthYear;
        monthlyRevenues[my] = (monthlyRevenues[my] || 0) + t.amount;
      });

      const sortedMonths = Object.keys(monthlyRevenues)
        .filter(myStr => {
          const year = parseInt(myStr.split(' ')[1]);
          return year <= 2026;
        })
        .sort((a, b) => {
          const parseMonthYear = (myStr) => {
            const parts = myStr.split(' ');
            const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
            return new Date(parseInt(parts[1]), monthNames.indexOf(parts[0]), 1);
          };
          return parseMonthYear(a) - parseMonthYear(b);
        });

      if (sortedMonths.length >= 2) {
        targetMonthLabel = sortedMonths[sortedMonths.length - 1];
        currentMonthRevenue = monthlyRevenues[targetMonthLabel];
        comparisonRevenue = monthlyRevenues[sortedMonths[sortedMonths.length - 2]];
      } else if (sortedMonths.length === 1) {
        targetMonthLabel = sortedMonths[0];
        currentMonthRevenue = monthlyRevenues[targetMonthLabel];
        comparisonRevenue = 0;
      } else {
        targetMonthLabel = 'June 2026'; // fallback
        currentMonthRevenue = 0;
        comparisonRevenue = 0;
      }
    }

    const momGrowth = comparisonRevenue > 0 ? ((currentMonthRevenue - comparisonRevenue) / comparisonRevenue) * 100 : 0;
    const growthText = momGrowth >= 0 ? `up ${momGrowth.toFixed(0)}%` : `down ${Math.abs(momGrowth).toFixed(0)}%`;

    if (activeModule === 'job_portal') {
      const displayPeriod = selectedMonth === 'All Months' ? `all months (latest month ${growthText} MoM)` : selectedMonth;
      return `Job Portal credit subscriptions are ${growthText} MoM. Net portal contribution is ${formatCurrency(profit)} at an operating margin of ${margin.toFixed(1)}% for ${displayPeriod}.`;
    }

    if (userRole === 'admin') {
      let topFranName = 'N/A';
      let maxFranNet = -999999;
      franchisees.forEach(f => {
        const fTxs = transactions.filter(t => t.franchiseeId === f.id && getMonthAndYear(t.date).monthYear === targetMonthLabel);
        const rev = fTxs.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
        const exp = fTxs.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
        const net = rev - exp;
        if (net > maxFranNet) {
          maxFranNet = net;
          topFranName = f.name;
        }
      });

      const monthDisplay = selectedMonth === 'All Months' ? `in ${targetMonthLabel.split(' ')[0]}` : 'this month';
      return `Overall revenue is ${growthText} MoM, driven primarily by Recruitment. Franchisee "${topFranName}" is your most profitable branch ${monthDisplay} with a net contribution of ${formatCurrency(Math.max(maxFranNet, 0))}.`;
    } else if (userRole.startsWith('franchise_')) {
      const fId = userRole.split('_')[1];
      const f = franchisees.find(item => item.id === fId);
      const totalPlacements = f ? f.candidatesPlaced : 0;
      const marginPercent = revenue > 0 ? (profit / revenue) * 100 : 0;
      return `${f?.name || 'Franchise'} Hub net profitability is at ${marginPercent.toFixed(1)}% margin for this period, supporting ${totalPlacements} candidate placement records.`;
    } else if (userRole.startsWith('bd_')) {
      const bdId = userRole.split('_')[1];
      const agent = bdAgents.find(item => item.id === bdId);
      const closedDeals = currentTxs.filter(t => t.type === 'income').length;
      const actualComm = currentTxs.filter(t => t.type === 'expense' && t.category === 'BD commissions').reduce((sum, t) => sum + t.amount, 0);
      return `BD Agent ${agent?.name || 'This agent'} closed ${closedDeals} recruitment placement accounts, drawing ${formatCurrency(actualComm)} in payouts.`;
    }
    return 'Welcome to Saarthi Finance Audit Board.';
  };

  // Moving Average Projections (Forecast)
  const allMonthsList = ['April 2026', 'May 2026', 'June 2026', 'July 2026'];
  let avgInflow = 0;
  let avgOutflow = 0;

  allMonthsList.forEach(m => {
    const monthTxs = roleTxs.filter(tx => getMonthAndYear(tx.date).monthYear === m);
    avgInflow += monthTxs.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    avgOutflow += monthTxs.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  });

  avgInflow /= allMonthsList.length;
  avgOutflow /= allMonthsList.length;
  const avgNet = avgInflow - avgOutflow;

  // Monthly trend historical data calculation
  const monthsList = ['April 2026', 'May 2026', 'June 2026', 'July 2026'];
  const barChartData = monthsList.map(m => {
    const monthTxs = roleTxs.filter(tx => getMonthAndYear(tx.date).monthYear === m);
    return {
      label: m.split(' ')[0],
      revenue: monthTxs.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0),
      expense: monthTxs.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)
    };
  });

  // Daily Cash Flow timeline data
  const isAllMonths = selectedMonth === 'All Months';
  const timelineTargetMonth = isAllMonths ? 'July 2026' : selectedMonth;

  // Calculate dynamic days count for the target month
  const getDaysInMonth = (monthLabel) => {
    const parts = monthLabel.split(' ');
    const mName = parts[0];
    const yVal = parseInt(parts[1]);
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const mIdx = monthNames.indexOf(mName);
    return new Date(yVal, mIdx + 1, 0).getDate();
  };

  const daysCount = getDaysInMonth(timelineTargetMonth);

  // Filter transactions for timeline month
  const timelineTxs = roleTxs.filter(tx => {
    return getMonthAndYear(tx.date).monthYear === timelineTargetMonth;
  });

  const dailyFlows = Array.from({ length: daysCount }, (_, index) => {
    const dayNum = index + 1;
    const dayTxs = timelineTxs.filter(tx => {
      const parts = tx.date.split('-');
      return parseInt(parts[2]) === dayNum;
    });

    const inc = dayTxs.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const exp = dayTxs.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);

    return {
      day: dayNum,
      income: inc,
      expense: exp
    };
  });

  return (
    <div className="dashboard-page animate-fade-in">

      {/* Narrative AI Insight Sentence */}
      <div className="dashboard-insight-banner" style={{ background: 'rgba(37, 99, 235, 0.08)', border: '1px solid rgba(37, 99, 235, 0.15)', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <span style={{ fontSize: '1.25rem' }}>💡</span>
        <p style={{ margin: 0, fontSize: '0.9rem', color: '#1e3a8a', lineHeight: '1.4' }}>
          <strong>Finance Insight:</strong> {getNarrativeSummary()}
        </p>
      </div>

      {/* HERO BALANCE SECTION */}
      <section className="hero-balance-section">
        <div className="hero-container">
          <div className="hero-left">
            <h3 className="hero-label">CASH FLOW SUMMARY</h3>
            <div className="hero-ledger-statement">
              <div className="ledger-statement-row inflow">
                <span className="row-symbol">(+)</span>
                <span className="row-label">Came in (Revenue)</span>
                <span className="row-amount font-bold">{formatCurrency(revenue)}</span>
              </div>

              <div className="ledger-statement-row outflow">
                <span className="row-symbol">(-)</span>
                <span className="row-label">Went out (Expenses)</span>
                <span className="row-amount font-bold">{formatCurrency(expenses)}</span>
              </div>

              <hr className="ledger-statement-line" />

              <div className={`ledger-statement-row net ${profit >= 0 ? 'positive' : 'negative'}`}>
                <span className="row-symbol">(=)</span>
                <span className="row-label font-bold">In Hand (Liquidity)</span>
                <span className="row-amount font-bold highlight">{formatCurrency(profit)}</span>
              </div>
            </div>

            {/* Dynamic Moving Average Trend Forecast */}
            <div className="forecast-mini-card" style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
              <span className="hero-label" style={{ display: 'block', fontSize: '0.65rem', color: 'var(--accent-teal)', letterSpacing: '0.05em' }}>NEXT MONTH FORECAST (AUGUST 2026)</span>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.85rem', color: '#475569' }}>
                <span>Exp. Inflow: <strong style={{ color: '#0f172a' }}>{formatLakhs(avgInflow)}</strong></span>
                <span>Exp. Outflow: <strong style={{ color: '#0f172a' }}>{formatLakhs(avgOutflow)}</strong></span>
                <span>Projected Net: <strong style={{ color: avgNet >= 0 ? 'var(--accent-teal)' : '#ef4444' }}>{formatLakhs(avgNet)}</strong></span>
              </div>
            </div>
          </div>

          <div className="hero-right">
            <div className="daily-flow-title-wrapper">
              <h4 className="flow-title">
                {isAllMonths ? 'Daily Operations (July 2026)' : 'Daily Cash Operations'}
              </h4>
              <span className="flow-subtitle" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span>Green spikes = Income, Red = Expense</span>
                {isAllMonths && <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontStyle: 'italic', marginTop: '2px' }}>*Showing July 2026 (the most recent period) for All Months view</span>}
              </span>
            </div>

            <div className="daily-spikes-timeline">
              {dailyFlows.map((flow, i) => {
                const maxAmount = 120000;
                let incPercent = Math.min((flow.income / maxAmount) * 100, 100);
                let expPercent = Math.min((flow.expense / maxAmount) * 100, 100);

                if (flow.income > 0 && incPercent < 15) incPercent = 15;
                if (flow.expense > 0 && expPercent < 15) expPercent = 15;

                return (
                  <div className="spike-column" key={i} title={`Day ${flow.day}: +â‚¹${flow.income.toLocaleString()} | -â‚¹${flow.expense.toLocaleString()}`}>
                    <div className="spike-upper">
                      {flow.income > 0 && (
                        <div className="spike-bar positive" style={{ height: `${incPercent}%` }}></div>
                      )}
                    </div>
                    <div className="spike-axis"></div>
                    <div className="spike-lower">
                      {flow.expense > 0 && (
                        <div className="spike-bar negative" style={{ height: `${expPercent}%` }}></div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="daily-spikes-labels">
              <span>Day 1</span>
              <span>Day {Math.floor(daysCount / 2)}</span>
              <span>Day {daysCount}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ATTENTION NEEDED ALERTS BOARD - Surface critical issues instantly */}
      {filteredAlerts.length > 0 && (
        <section className="alerts-dashboard-section animate-fade-in" style={{ marginBottom: '1.5rem' }}>
          <div className="dashboard-card alerts-card" style={{ borderColor: '#ef4444', background: '#fdf2f2' }}>
            <h3 className="card-title flex-items-center gap-2" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#b91c1c' }}>
              <span className="alerts-title-dot blinking"></span>
              <span>Attention Required ({filteredAlerts.length})</span>
            </h3>
            <ul className="dashboard-alerts-list" style={{ listStyle: 'none', padding: 0, margin: '1rem 0 0 0', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {filteredAlerts.map((alert, i) => (
                <li className={`alert-list-item alert-${alert.type}`} key={i} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem 1rem', borderRadius: '6px', borderLeft: '4px solid', background: '#ffffff', borderLeftColor: alert.type === 'danger' ? '#ef4444' : '#f59e0b', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                  <span className="alert-badge font-bold" style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', background: alert.type === 'danger' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)', color: alert.type === 'danger' ? '#b91c1c' : '#b45309', textTransform: 'uppercase' }}>{alert.type}</span>
                  <span className="alert-text" style={{ fontSize: '0.9rem', color: '#334155' }}>{alert.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* KPI GRID SECTION */}
      <section className="kpi-grid">
        <div className="kpi-card card-blue">
          <div className="kpi-header">
            <span className="kpi-title">Total revenue</span>
            <span className="kpi-icon"><DollarSign size={18} /></span>
          </div>
          <h2 className="kpi-value">{formatLakhs(revenue)}</h2>
          <div className={`kpi-change ${revenueChange.positive ? 'up' : 'down'}`}>
            {revenueChange.positive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            <span>{selectedMonth === 'All Months' ? 'Overall cumulative' : revenueChange.text}</span>
          </div>
        </div>

        <div className="kpi-card card-red">
          <div className="kpi-header">
            <span className="kpi-title">Total expenses</span>
            <span className="kpi-icon"><Activity size={18} /></span>
          </div>
          <h2 className="kpi-value">{formatLakhs(expenses)}</h2>
          <div className={`kpi-change ${expenseChange.positive ? 'up' : 'down'}`}>
            {expenseChange.positive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            <span>{selectedMonth === 'All Months' ? 'Overall cumulative' : expenseChange.text}</span>
          </div>
        </div>

        <div className="kpi-card card-green">
          <div className="kpi-header">
            <span className="kpi-title">Net profit</span>
            <span className="kpi-icon"><TrendingUp size={18} /></span>
          </div>
          <h2 className="kpi-value">{formatLakhs(profit)}</h2>
          <div className={`kpi-change ${profitChange.positive ? 'up' : 'down'}`}>
            {profitChange.positive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            <span>{selectedMonth === 'All Months' ? 'Overall cumulative' : profitChange.text}</span>
          </div>
        </div>

        <div className="kpi-card card-purple">
          <div className="kpi-header">
            <span className="kpi-title">Profit margin</span>
            <span className="kpi-icon"><Percent size={18} /></span>
          </div>
          <h2 className="kpi-value">{margin.toFixed(1)}%</h2>
          <div className={`kpi-change ${marginChange.positive ? 'up' : 'down'}`}>
            {marginChange.positive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            <span>{selectedMonth === 'All Months' ? 'Overall cumulative' : marginChange.text}</span>
          </div>
        </div>
      </section>

      {/* BUDGET OVERHEAD GUARD & DONUT ROW */}
      {userRole === 'admin' && (
        <section className="charts-grid-row">

          {/* Left: Spend Budgets Audit */}
          <div className="dashboard-card flex-1">
            <div className="card-header-flex">
              <h3 className="card-title">Budget Overhead Guard</h3>
              <span className="info-badge">Rupee-Level Alerts</span>
            </div>
            <div className="card-content">
              <div className="budget-progress-list">
                {budgetSummary.map((item, index) => {
                  const isOver = item.overspent > 0;
                  return (
                    <div className="budget-progress-item" key={index}>
                      <div className="budget-item-header">
                        <span className="budget-category-label font-bold">{item.category}</span>
                        <span className={`budget-values ${isOver ? 'danger-text' : ''}`}>
                          {formatCurrency(item.spent)} / <span className="limit-text">{formatCurrency(item.limit)}</span>
                        </span>
                      </div>

                      <div className="budget-bar-track">
                        <div
                          className={`budget-bar-fill ${isOver ? 'exceeded' : ''}`}
                          style={{ width: `${Math.min(item.percent, 100)}%` }}
                        ></div>
                      </div>

                      <div className="budget-item-footer">
                        {isOver ? (
                          <span className="budget-alert danger font-bold">
                            LIMIT EXCEEDED BY {formatCurrency(item.overspent)}!
                          </span>
                        ) : (
                          <span className="budget-alert safe">
                            {formatCurrency(item.limit - item.spent)} Safe Remaining
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: Income Sources */}
          <div className="dashboard-card chart-card flex-1">
            <h3 className="card-title">Income Sources Breakdown</h3>
            <div className="card-content-center">
              <DonutChart data={finalDonutData} />
            </div>
          </div>

        </section>
      )}

      {/* BOTTOM HISTORICAL TREND AND RECENT ENTRIES ROW */}
      <section className="charts-grid-row">
        <div className="dashboard-card flex-1">
          <h3 className="card-title">Historical Outflows</h3>
          <div className="card-content">
            <BarChart data={barChartData} />
          </div>
        </div>

        {/* Recent logs - Clickable for detailed Auditor Card */}
        <div className="dashboard-card flex-1">
          <div className="card-header-flex">
            <h3 className="card-title">Recent Ledger Items</h3>
            <button className="view-all-link" onClick={() => setActivePage('reports')}>View General Ledger</button>
          </div>
          <div className="card-content">
            {currentTxs.length === 0 ? (
              <p className="no-data-text">No transaction logs matching this month.</p>
            ) : (
              <ul className="recent-entries-list">
                {currentTxs.slice(0, 5).map(tx => (
                  <li
                    className="entry-item clickable"
                    key={tx.id}
                    onClick={() => setSelectedTx(tx)}
                    title="Click to audit transaction details"
                  >
                    <div className="entry-left">
                      <h4 className="entry-title">{tx.title}</h4>
                      <span className="entry-meta">
                        {tx.category} â€¢ {tx.subCategory || 'General'} â€¢ {formatDate(tx.date)}
                      </span>
                    </div>
                    <div className={`entry-right ${tx.type}`}>
                      <span className="entry-amount font-bold">
                        {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                      </span>
                      <span className="entry-indicator"></span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* AUDITOR SLIP MODAL (Rupee-level investigation) */}
      {selectedTx && (
        <div className="modal-backdrop animate-fade-in" onClick={() => setSelectedTx(null)}>
          <div className="modal-card animate-scale-up" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Rupee Audit Slip</h3>
              <button className="btn-close" onClick={() => setSelectedTx(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div className="audit-ledger-receipt">
                <div className="receipt-brand">SAARTHI FINANCE</div>
                <div className="receipt-tx-number">REF CODE: {selectedTx.referenceId}</div>

                <hr className="receipt-divider" />

                <div className="receipt-row main-amount">
                  <span>Audit Flow</span>
                  <h1 className={selectedTx.type}>
                    {selectedTx.type === 'income' ? '+' : '-'}{formatCurrency(selectedTx.amount)}
                  </h1>
                </div>

                <hr className="receipt-divider" />

                <div className="receipt-details">
                  <div className="receipt-detail-item">
                    <span className="label"><Calendar size={13} /> Logged Date</span>
                    <span className="value font-bold">{selectedTx.date}</span>
                  </div>

                  <div className="receipt-detail-item">
                    <span className="label"><Tag size={13} /> Allocation</span>
                    <span className="value">{selectedTx.category} ({selectedTx.subCategory || 'General'})</span>
                  </div>

                  <div className="receipt-detail-item">
                    <span className="label"><Landmark size={13} /> Payment Mode</span>
                    <span className="value font-bold">{selectedTx.paymentMode || 'Cash'}</span>
                  </div>

                  <div className="receipt-detail-item">
                    <span className="label"><CreditCard size={13} /> Reference ID</span>
                    <span className="value"><code className="receipt-code">{selectedTx.referenceId}</code></span>
                  </div>
                </div>

                <hr className="receipt-divider" />

                <div className="receipt-description">
                  <h4>Auditor / Operational Comments</h4>
                  <p>{selectedTx.description || 'No descriptive comments logged for this transaction.'}</p>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedTx(null)}>Close Slip</button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  window.print();
                }}
              >
                Print Slip
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Dashboard;
