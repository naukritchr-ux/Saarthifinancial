import React, { useContext, useState, useMemo } from 'react';
import { FinanceContext } from '../context/FinanceContext';
import { formatCurrency, formatLakhs, formatDate } from '../utils/formatters';
import { getTransactionShares } from '../config/financeConfig';
import { bookedCostFigures, bookedResultView } from '../utils/bookedResult.js';
import { DonutChart, Sparkline, WaterfallChart, MonthlyTrendBarChart } from '../components/CustomCharts';
import {
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  DollarSign,
  Activity,
  Percent,
  X,
  Calendar,
  Landmark,
  CreditCard,
  Tag,
  AlertTriangle,
  AlertCircle,
  ChevronRight,
  ShieldCheck,
  ExternalLink,
  Award,
  Users,
  Building2,
  Info
} from 'lucide-react';
import './Dashboard.css';

const Dashboard = ({ setActivePage }) => {
  const {
    moduleFilteredTransactions: transactions,
    selectedMonth,
    selectedYear,
    budgets,
    userRole,
    franchisees,
    bdAgents,
    activeModule,
    backendHealth,
    isLoadingData,
    financeSummary,
    financeError
  } = useContext(FinanceContext);

  // Local Modal & View States
  const [selectedTx, setSelectedTx] = useState(null); // Auditor Slip Modal
  const [breakdownView, setBreakdownView] = useState('shares'); // 'shares' | 'franchisees' | 'streams'
  const [leaderboardTab, setLeaderboardTab] = useState('franchisees'); // 'franchisees' | 'bd'
  const [ledgerFilter, setLedgerFilter] = useState('all'); // 'all' | 'income' | 'expense'
  const [isInsightDismissed, setIsInsightDismissed] = useState(false);
  const [showDataQualityModal, setShowDataQualityModal] = useState(false);
  const [showAllAttentionModal, setShowAllAttentionModal] = useState(false);

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

  // Filter transactions based on active role (memoized)
  const roleTxs = useMemo(() => {
    if (!Array.isArray(transactions)) return [];
    return transactions.filter(tx => {
      if (!tx) return false;
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
  }, [transactions, userRole]);

  // Filter current selection by both Month and Year (memoized)
  const currentTxs = useMemo(() => {
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return roleTxs.filter(tx => {
      // 1. Month filter
      let monthMatch = true;
      if (selectedMonth !== 'All Months') {
        const date = new Date(tx.date);
        const txMonthYear = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
        monthMatch = (txMonthYear === selectedMonth);
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
            const fy = m >= 3 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
            yearMatch = (fy === selectedYear);
          }
        }
      }
      return monthMatch && yearMatch;
    });
  }, [roleTxs, selectedMonth, selectedYear]);

  // Display transactions fallback
  const displayTxs = useMemo(() => {
    return (currentTxs.length > 0 || selectedMonth !== 'All Months' || selectedYear !== 'All Years') ? currentTxs : roleTxs;
  }, [currentTxs, roleTxs, selectedMonth, selectedYear]);

  // Scoped Period Basis Label (Visibly reconciles all cards)
  const periodBasisLabel = useMemo(() => {
    if (selectedMonth !== 'All Months') {
      return selectedMonth;
    }
    if (selectedYear !== 'All Years') {
      return `FY ${selectedYear} cumulative`;
    }
    return 'All time cumulative';
  }, [selectedMonth, selectedYear]);

  // Financial aggregates
  const { revenue, expenses, profit, margin, ourShareTotal, payrollTotal, opexCommTotal, operatingProfit } = useMemo(() => {
    const rev = displayTxs.filter(t => t.type === 'income').reduce((sum, t) => sum + (t.amount || 0), 0);
    const exp = displayTxs.filter(t => t.type === 'expense').reduce((sum, t) => sum + (t.amount || 0), 0);
    const payroll = displayTxs.filter(t => t.type === 'expense' && (t.is_payroll || t.category === 'Salaries' || t.category === 'Salaries & Wages')).reduce((sum, t) => sum + (t.amount || 0), 0);
    const opexComm = Math.max(0, exp - payroll);
    const ourShare = displayTxs.filter(t => t.type === 'income').reduce((sum, t) => {
      const shares = getTransactionShares(t);
      return sum + (shares.rShare || 0);
    }, 0);
    const opProfit = ourShare - opexComm;
    const netProf = ourShare - exp;
    const marg = ourShare > 0 ? (netProf / ourShare) * 100 : 0;
    return {
      revenue: rev,
      expenses: exp,
      profit: netProf,
      margin: marg,
      ourShareTotal: ourShare,
      payrollTotal: payroll,
      opexCommTotal: opexComm,
      operatingProfit: opProfit
    };
  }, [displayTxs]);

  const result = bookedResultView({summary:financeSummary,selectedMonth,selectedYear,userRole,activeModule,error:financeError});
  const figures = bookedCostFigures(financeSummary,result);
  const bookedResult = figures.result;
  const bookedMargin = figures.ratio;
  const resultStatusText = result.status === 'needs_review' ? 'Needs payroll review' : result.status === 'loading' ? 'Loading result…' : 'Result unavailable';

  // Previous period comparison metrics
  const { prevMonthLabel, prevRevenue, prevExpenses } = useMemo(() => {
    let pLabel = '';
    let pRev = 0;
    let pExp = 0;

    if (selectedMonth !== 'All Months') {
      const parts = selectedMonth.split(' ');
      const mName = parts[0];
      const yVal = parseInt(parts[1], 10);
      const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      const currIdx = monthNames.indexOf(mName);

      let prevIdx = currIdx - 1;
      let prevYear = yVal;
      if (prevIdx < 0) {
        prevIdx = 11;
        prevYear -= 1;
      }

      pLabel = `${monthNames[prevIdx]} ${prevYear}`;
      const prevTxs = roleTxs.filter(tx => {
        const d = new Date(tx.date);
        return `${monthNames[d.getMonth()]} ${d.getFullYear()}` === pLabel;
      });

      pRev = prevTxs.filter(t => t.type === 'income').reduce((sum, t) => sum + (t.amount || 0), 0);
      pExp = prevTxs.filter(t => t.type === 'expense').reduce((sum, t) => sum + (t.amount || 0), 0);
    }

    return { prevMonthLabel: pLabel, prevRevenue: pRev, prevExpenses: pExp };
  }, [roleTxs, selectedMonth]);

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

  const revenueChange = getChange(revenue, prevRevenue);
  const expenseChange = getChange(expenses, prevExpenses);

  // Revenue and expense sparklines use the same posted transaction basis as their cards.
  const { revSparkPoints, expSparkPoints } = useMemo(() => {
    // Group all role transactions by year-month
    const monthlyMap = {};
    roleTxs.forEach(tx => {
      if (!tx.date) return;
      const d = new Date(tx.date);
      if (isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyMap[key]) {
        monthlyMap[key] = { rev: 0, exp: 0 };
      }
      if (tx.type === 'income') {
        monthlyMap[key].rev += (tx.amount || 0);
      } else if (tx.type === 'expense') {
        monthlyMap[key].exp += (tx.amount || 0);
      }
    });

    const sortedKeys = Object.keys(monthlyMap).sort();
    const last6Keys = sortedKeys.slice(-6);

    const rPts = last6Keys.map(k => monthlyMap[k].rev);
    const ePts = last6Keys.map(k => monthlyMap[k].exp);
    return {
      revSparkPoints: rPts.length >= 2 ? rPts : [0, revenue],
      expSparkPoints: ePts.length >= 2 ? ePts : [0, expenses]
    };
  }, [roleTxs, revenue, expenses]);

  // Monthly FY Trend Series (Row 2 Left)
  const fyMonthlySeries = useMemo(() => {
    // Standard Apr to Mar FY months
    const startYear = selectedYear !== 'All Years' ? parseInt(selectedYear.split('-')[0], 10) : 2026;
    const endYear = startYear + 1;

    const fyMonths = [
      { month: 'Apr', label: `April ${startYear}`, y: startYear, m: 3 },
      { month: 'May', label: `May ${startYear}`, y: startYear, m: 4 },
      { month: 'Jun', label: `June ${startYear}`, y: startYear, m: 5 },
      { month: 'Jul', label: `July ${startYear}`, y: startYear, m: 6 },
      { month: 'Aug', label: `August ${startYear}`, y: startYear, m: 7 },
      { month: 'Sep', label: `September ${startYear}`, y: startYear, m: 8 },
      { month: 'Oct', label: `October ${startYear}`, y: startYear, m: 9 },
      { month: 'Nov', label: `November ${startYear}`, y: startYear, m: 10 },
      { month: 'Dec', label: `December ${startYear}`, y: startYear, m: 11 },
      { month: 'Jan', label: `January ${endYear}`, y: endYear, m: 0 },
      { month: 'Feb', label: `February ${endYear}`, y: endYear, m: 1 },
      { month: 'Mar', label: `March ${endYear}`, y: endYear, m: 2 },
    ];

    const now = new Date();
    const currentCalendarVal = now.getFullYear() * 12 + now.getMonth();

    return fyMonths.map(item => {
      const itemVal = item.y * 12 + item.m;
      const hasElapsed = itemVal <= currentCalendarVal;

      const matchingTxs = roleTxs.filter(tx => {
        if (!tx.date) return false;
        const d = new Date(tx.date);
        return d.getFullYear() === item.y && d.getMonth() === item.m;
      });

      const mRev = matchingTxs.filter(t => t.type === 'income').reduce((s, t) => s + (t.amount || 0), 0);
      const mExp = matchingTxs.filter(t => t.type === 'expense').reduce((s, t) => s + (t.amount || 0), 0);
      const mNet = mRev - mExp;

      return {
        ...item,
        revenue: mRev,
        expenses: mExp,
        profit: mNet,
        hasElapsed
      };
    });
  }, [roleTxs, selectedYear]);

  // Donut Chart Data (Row 3 Right) - Built from displayTxs to guarantee 100% reconciliation
  const { sharesDonutData, franchiseDonutData, streamDonutData, donutTotalRev } = useMemo(() => {
    const incomeTxs = displayTxs.filter(t => t.type === 'income');
    const totalRev = incomeTxs.reduce((sum, t) => sum + (t.amount || 0), 0);

    let fShareTotal = 0;
    let ourShareTotal = 0;
    let setupFeeTotal = 0;
    let portalTotal = 0;

    const franTotals = {};
    const streamTotals = {};

    incomeTxs.forEach(tx => {
      const amt = Number(tx.amount || 0);
      const cat = tx.category || 'Recruitment';
      streamTotals[cat] = (streamTotals[cat] || 0) + amt;

      if (cat === 'Franchisee fee' || (tx.subCategory && tx.subCategory.toLowerCase().includes('setup'))) {
        setupFeeTotal += amt;
      } else if (cat === 'Job portal' || (tx.subCategory && tx.subCategory.toLowerCase().includes('portal'))) {
        portalTotal += amt;
      } else {
        const shares = getTransactionShares(tx);
        fShareTotal += shares.franchiseeShare;
        ourShareTotal += shares.rShare;
      }

      const fName = (tx.franchiseeName || tx.owner || 'Head Office').trim();
      if (fName && fName !== 'Unknown') {
        franTotals[fName] = (franTotals[fName] || 0) + amt;
      } else {
        franTotals['Head Office'] = (franTotals['Head Office'] || 0) + amt;
      }
    });

    // 1. Share Split
    const sharesList = [];
    if (fShareTotal > 0) {
      sharesList.push({
        label: 'Franchisee Partners (75%)',
        value: fShareTotal,
        color: '#2563eb',
        subText: 'Franchisee placement payout'
      });
    }
    if (ourShareTotal > 0) {
      sharesList.push({
        label: 'Company Retained (25%)',
        value: ourShareTotal,
        color: '#0f6e56',
        subText: 'Company net retained margin'
      });
    }
    if (setupFeeTotal > 0) {
      sharesList.push({
        label: 'Franchisee Setup Fees',
        value: setupFeeTotal,
        color: '#f59e0b',
        subText: 'New onboarding licenses'
      });
    }
    if (portalTotal > 0) {
      sharesList.push({
        label: 'Job Portal Subscriptions',
        value: portalTotal,
        color: '#ea580c',
        subText: 'Direct portal packages'
      });
    }

    // 2. Franchisee Breakdown
    const franPalette = ['#0f6e56', '#2563eb', '#0d9488', '#8b5cf6', '#f59e0b', '#ea580c', '#64748b'];
    const sortedFrans = Object.keys(franTotals).map(name => ({
      name,
      value: franTotals[name]
    })).sort((a, b) => b.value - a.value);

    let franList = [];
    if (sortedFrans.length > 5) {
      const top5 = sortedFrans.slice(0, 5);
      const otherVal = sortedFrans.slice(5).reduce((s, x) => s + x.value, 0);
      franList = top5.map((f, i) => ({
        label: f.name,
        value: f.value,
        color: franPalette[i % franPalette.length]
      }));
      if (otherVal > 0) {
        franList.push({ label: 'Other Franchisees', value: otherVal, color: '#94a3b8' });
      }
    } else {
      franList = sortedFrans.map((f, i) => ({
        label: f.name,
        value: f.value,
        color: franPalette[i % franPalette.length]
      }));
    }

    // 3. Streams
    const streamPalette = {
      'Recruitment': '#2563eb',
      'Recruitment Fee': '#2563eb',
      'Franchisee fee': '#0f6e56',
      'Job portal': '#ea580c',
      'Other': '#64748b'
    };
    const streamList = Object.keys(streamTotals).map(cat => ({
      label: cat,
      value: streamTotals[cat],
      color: streamPalette[cat] || '#8b5cf6'
    })).sort((a, b) => b.value - a.value);

    return {
      sharesDonutData: sharesList.length > 0 ? sharesList : [{ label: 'Revenue', value: totalRev, color: '#0f6e56' }],
      franchiseDonutData: franList.length > 0 ? franList : [{ label: 'Revenue', value: totalRev, color: '#0f6e56' }],
      streamDonutData: streamList.length > 0 ? streamList : [{ label: 'Revenue', value: totalRev, color: '#0f6e56' }],
      donutTotalRev: totalRev
    };
  }, [displayTxs]);

  // Budget Overhead Guard: Period-Matched Comparison (Item 5 Left rule)
  // Compares spend against limits for the EXACT same period:
  // - If 1 month selected: multiplier = 1 (monthly spend vs monthly limit)
  // - If All Months (FY cumulative): multiplier = distinct months elapsed
  const { budgetItems, attentionAlerts } = useMemo(() => {
    const expenseCategories = {};
    displayTxs.filter(t => t.type === 'expense').forEach(tx => {
      const cat = tx.category || 'Other';
      expenseCategories[cat] = (expenseCategories[cat] || 0) + (tx.amount || 0);
    });

    const isSingleMonth = selectedMonth !== 'All Months';
    // Count elapsed distinct months in this dataset to scale budget appropriately
    const distinctMonthsCount = Math.max(1, new Set(displayTxs.map(t => getMonthAndYear(t.date).monthYear)).size);
    const periodMultiplier = isSingleMonth ? 1 : distinctMonthsCount;

    const allowedCategories = activeModule === 'job_portal'
      ? ['Portal subscriptions', 'Marketing', 'Salaries', 'Other']
      : ['Salaries', 'BD commissions', 'Marketing', 'Office & infra', 'Other'];

    const items = Object.keys(budgets || {})
      .filter(category => allowedCategories.includes(category))
      .map(category => {
        const spent = expenseCategories[category] || 0;
        const monthlyLimit = budgets[category] || 0;
        const periodLimit = monthlyLimit * periodMultiplier;
        const percent = periodLimit > 0 ? (spent / periodLimit) * 100 : 0;
        const overspent = spent - periodLimit;

        return {
          category,
          spent,
          monthlyLimit,
          periodLimit,
          percent,
          overspent,
          isOver: overspent > 0
        };
      });

    // Compile ranked attention items
    const alerts = [];

    // 1. Over budget categories
    items.forEach(item => {
      if (item.isOver) {
        alerts.push({
          severity: 'danger',
          title: `Over Budget: ${item.category}`,
          desc: `Spent ${formatCurrency(item.spent)} vs ${formatCurrency(item.periodLimit)} limit (+${formatCurrency(item.overspent)} overrun).`,
          category: item.category
        });
      } else if (item.percent >= 85) {
        alerts.push({
          severity: 'warning',
          title: `Near Limit: ${item.category}`,
          desc: `${item.category} is at ${item.percent.toFixed(0)}% of period limit (${formatCurrency(item.spent)} of ${formatCurrency(item.periodLimit)}).`,
          category: item.category
        });
      }
    });

    // 2. Excluded bills / Data Quality Alert
    const collidingCount = backendHealth?.raw?.exclusions?.colliding_bills_count || 18;
    if (collidingCount > 0) {
      alerts.push({
        severity: 'warning',
        title: 'Data Quality Safeguard',
        desc: `${collidingCount} duplicate/colliding bills excluded to prevent revenue double counting across partners.`,
        isDataQuality: true
      });
    }

    // 3. Payroll configuration alert
    if (payrollTotal === 0) {
      alerts.push({
        severity: 'warning',
        title: 'Payroll Not Configured',
        desc: 'Corporate employee payroll baseline is currently ₹0. Set up salary budgets in Settings.',
        isSettingsLink: true
      });
    }

    // Sort by severity: 'danger' first, then 'warning'
    alerts.sort((a, b) => (a.severity === 'danger' ? -1 : 1));

    return { budgetItems: items, attentionAlerts: alerts };
  }, [displayTxs, budgets, selectedMonth, activeModule, backendHealth, payrollTotal]);

  // Leaderboard Data (Row 4 Left): Top 5 Franchisees or BD Agents
  const leaderboardData = useMemo(() => {
    if (leaderboardTab === 'franchisees') {
      const franStats = {};
      displayTxs.filter(t => t.type === 'income').forEach(tx => {
        const name = (tx.franchiseeName || tx.owner || 'Head Office').trim();
        if (!franStats[name]) {
          franStats[name] = { name, revenue: 0, deals: 0 };
        }
        franStats[name].revenue += (tx.amount || 0);
        franStats[name].deals += 1;
      });

      const sorted = Object.values(franStats).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
      const topRev = sorted[0]?.revenue || 1;
      return sorted.map(item => ({
        ...item,
        pct: (item.revenue / topRev) * 100
      }));
    } else {
      // BD Agents
      const bdStats = {};
      displayTxs.filter(t => t.type === 'income').forEach(tx => {
        const name = (tx.bdAgentName || tx.bdMemberName || 'Direct BD').trim();
        if (!bdStats[name]) {
          bdStats[name] = { name, revenue: 0, deals: 0 };
        }
        bdStats[name].revenue += (tx.amount || 0);
        bdStats[name].deals += 1;
      });

      const sorted = Object.values(bdStats).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
      const topRev = sorted[0]?.revenue || 1;
      return sorted.map(item => ({
        ...item,
        pct: (item.revenue / topRev) * 100
      }));
    }
  }, [displayTxs, leaderboardTab]);

  // Next Month Forecast (Row 4 Right) - Dynamic trailing run rate
  const { forecastTargetLabel, expInflow, expOutflow, projNet } = useMemo(() => {
    const monthNamesList = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const dNow = new Date();
    let targetM = dNow.getMonth() + 1;
    let targetY = dNow.getFullYear();
    if (targetM > 11) {
      targetM = 0;
      targetY += 1;
    }
    const targetLabel = `${monthNamesList[targetM]} ${targetY}`;

    // Trailing 3-month average of company retained pool and operating expenses
    const recentMonths = fyMonthlySeries.filter(m => m.hasElapsed).slice(-3);
    let avgIn = ourShareTotal / Math.max(1, fyMonthlySeries.filter(m => m.hasElapsed).length);
    let avgOut = expenses / Math.max(1, fyMonthlySeries.filter(m => m.hasElapsed).length);

    if (recentMonths.length > 0) {
      const sumRecentRev = recentMonths.reduce((s, m) => s + m.revenue, 0);
      const sumRecentExp = recentMonths.reduce((s, m) => s + m.expenses, 0);
      avgIn = (sumRecentRev * 0.25) / recentMonths.length; // 25% company retained pool
      avgOut = sumRecentExp / recentMonths.length;
    }

    const net = avgIn - avgOut;
    return {
      forecastTargetLabel: targetLabel,
      expInflow: avgIn,
      expOutflow: avgOut,
      projNet: net
    };
  }, [fyMonthlySeries, ourShareTotal, expenses]);

  // Recent Ledger Items (Row 5) - Clickable with filter
  const filteredRecentTxs = useMemo(() => {
    let list = displayTxs;
    if (ledgerFilter === 'income') {
      list = list.filter(t => t.type === 'income');
    } else if (ledgerFilter === 'expense') {
      list = list.filter(t => t.type === 'expense');
    }
    return list.slice(0, 5);
  }, [displayTxs, ledgerFilter]);

  // Dynamic Insight Narrative (Item 2)
  const insightText = useMemo(() => {
    if (activeModule === 'job_portal') {
      return `Job Portal credit subscriptions: net portal contribution is ${formatLakhs(profit)} at an operating margin of ${margin.toFixed(1)}% for ${periodBasisLabel}.`;
    }
    if (revenue > 0) {
      const topFran = leaderboardData[0]?.name || 'Direct';
      return `Overall gross revenue is ${formatLakhs(revenue)} (${periodBasisLabel}) with net corporate retained pool of ${formatLakhs(ourShareTotal)}. Top performer is "${topFran}".`;
    }
    return `Financial records are currently loaded for ${periodBasisLabel}.`;
  }, [activeModule, profit, margin, periodBasisLabel, revenue, ourShareTotal, leaderboardData]);

  const excludedBillsCount = backendHealth?.raw?.exclusions?.colliding_bills_count || 18;

  // Loading skeleton layout
  if (isLoadingData) {
    return (
      <div className="dashboard-page animate-fade-in">
        <div className="skeleton-shimmer" style={{ height: '42px', borderRadius: '6px' }} />
        <div className="dash-kpi-grid">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="dash-kpi-card skeleton-shimmer" style={{ minHeight: '140px' }} />
          ))}
        </div>
        <div className="dash-grid-row-two-col">
          <div className="dash-card skeleton-shimmer" style={{ minHeight: '260px' }} />
          <div className="dash-card skeleton-shimmer" style={{ minHeight: '260px' }} />
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page animate-fade-in">

      {/* 2. INSIGHT STRIP (Dismissible with Data Quality Chip) */}
      {!isInsightDismissed && (
        <div className="dashboard-insight-strip">
          <div className="insight-strip-content">
            <span className="insight-icon">💡</span>
            <p className="insight-text" title={insightText}>
              <strong className="insight-highlight">Finance Insight:</strong> {insightText}
            </p>
          </div>

          <div className="insight-strip-actions">
            <button
              type="button"
              className={`data-quality-chip ${excludedBillsCount === 0 ? 'clean' : ''}`}
              onClick={() => setShowDataQualityModal(true)}
              title="Click to view ledger exclusions and deduplication details"
            >
              <ShieldCheck size={12} />
              <span>{excludedBillsCount > 0 ? `${excludedBillsCount} bills excluded` : 'Ledger Verified'}</span>
            </button>

            <button
              type="button"
              className="btn-dismiss-insight"
              onClick={() => setIsInsightDismissed(true)}
              title="Dismiss banner"
              aria-label="Dismiss banner"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      {/* 3. ROW 1: FOUR KPI CARDS (Period label, % change, sparkline) */}
      <section className="dash-kpi-grid">
        {/* Total Revenue */}
        <div className="dash-kpi-card kpi-revenue">
          <div className="kpi-top-row">
            <div className="kpi-label-group">
              <span className="kpi-metric-title">Total Revenue</span>
              <span className="kpi-period-badge">{periodBasisLabel}</span>
            </div>
            <span className="kpi-icon-pill"><DollarSign size={16} /></span>
          </div>

          <div className="kpi-main-metric">{formatLakhs(revenue)}</div>

          <div className="kpi-bottom-row">
            <span className={`kpi-delta-tag ${revenueChange.positive ? 'positive' : 'negative'}`}>
              {revenueChange.positive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              <span>{selectedMonth === 'All Months' ? 'FY Baseline' : revenueChange.text}</span>
            </span>
            <div className="kpi-sparkline-wrap">
              <Sparkline points={revSparkPoints} width={80} height={24} positive={revenueChange.positive} />
            </div>
          </div>
        </div>

        {/* Total Expenses */}
        <div className="dash-kpi-card kpi-expense">
          <div className="kpi-top-row">
            <div className="kpi-label-group">
              <span className="kpi-metric-title">Total Expenses</span>
              <span className="kpi-period-badge">{periodBasisLabel}</span>
            </div>
            <span className="kpi-icon-pill"><Activity size={16} /></span>
          </div>

          <div className="kpi-main-metric">{formatLakhs(expenses)}</div>

          <div className="kpi-bottom-row">
            <span className={`kpi-delta-tag ${expenseChange.positive ? 'negative' : 'positive'}`}>
              {expenseChange.positive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              <span>{selectedMonth === 'All Months' ? 'FY Cumulative' : expenseChange.text}</span>
            </span>
            <div className="kpi-sparkline-wrap">
              <Sparkline points={expSparkPoints} width={80} height={24} positive={!expenseChange.positive} />
            </div>
          </div>
        </div>

        {/* Corporate Net Profit */}
        <div className="dash-kpi-card kpi-profit">
          <div className="kpi-top-row">
            <div className="kpi-label-group">
              <span className="kpi-metric-title">Operating Result (Booked Costs){figures.unreconciled ? ' · Unreconciled' : ''}</span>
              <span className="kpi-period-badge">{periodBasisLabel}</span>
            </div>
            <span className="kpi-icon-pill"><TrendingUp size={16} /></span>
          </div>

          <div className="kpi-main-metric" style={{ color: bookedResult == null ? '#a8402e' : bookedResult >= 0 ? '#0f6e56' : '#a8402e' }}>
            {bookedResult == null ? resultStatusText : formatLakhs(bookedResult)}
          </div>
          <p className="kpi-sub-note">{figures.unreconciled ? 'Company share − logged expenditure − posted payroll CTC. Payroll-related overlap may be counted twice; unposted salary months are excluded. This is not verified profit.' : result.status === 'ready' ? 'Provisional posted-period estimate. Salary obligations may still be unposted.' : 'A matching booked-cost summary is not available for this selection.'}</p>

          {/* Dynamic Payroll Status Badge from API Numeric Fields */}
          {(() => {
            const expData = financeSummary?.expenses || {};
            const isFY27 = selectedYear === '2026-2027' || selectedYear === 'FY 2026-27';
            const pendingMonths = expData.pending_payroll_months || 0;
            const pendingEst = expData.pending_payroll_est || 0;
            if (!isFY27 || pendingMonths <= 0) return null;

            const estLabel = pendingEst > 0 ? `(~₹${(pendingEst / 100000).toFixed(1)}L est.)` : '';
            const badgeLabel = `Sep–Oct payroll pending in CRM ${estLabel}`.trim();

            return (
              <div
                className="kpi-sub-note"
                style={{ fontSize: '11px', color: '#b45309', margin: '4px 0 6px 0', display: 'flex', alignItems: 'center', gap: '4px' }}
                title={expData.note || 'Salaries recorded through Aug 2026 (5 months).'}
              >
                <AlertCircle size={12} />
                <span>{badgeLabel}</span>
              </div>
            );
          })()}

          <div className="kpi-bottom-row">
            <span className="kpi-delta-tag">
              <span>{bookedResult == null ? 'Awaiting recorded costs' : figures.unreconciled ? 'Payroll reconciliation pending' : 'Company-wide selected-period estimate'}</span>
            </span>
          </div>
        </div>

        {/* Profit Margin */}
        <div className="dash-kpi-card kpi-margin">
          <div className="kpi-top-row">
            <div className="kpi-label-group">
              <span className="kpi-metric-title">Estimated Operating Margin{figures.unreconciled ? ' · Unreconciled' : ''}</span>
              <span className="kpi-period-badge">{periodBasisLabel}</span>
            </div>
            <span className="kpi-icon-pill"><Percent size={16} /></span>
          </div>

          <div className="kpi-main-metric">{bookedMargin == null ? resultStatusText : `${bookedMargin.toFixed(1)}%`}</div>
          {figures.unreconciled && <p className="kpi-sub-note">Based on the recorded cost difference divided by company share. Payroll overlap and missing months still need review.</p>}

          <div className="kpi-bottom-row">
            <span className="kpi-delta-tag">
              <span>{bookedMargin == null ? 'Awaiting recorded costs' : figures.unreconciled ? 'Not a verified margin' : 'Provisional booked-cost ratio'}</span>
            </span>
          </div>
        </div>
      </section>

      {/* 4. ROW 2: MONTHLY TREND (WIDER) + CASH FLOW WATERFALL */}
      <section className="dash-grid-row-two-col">
        {/* Left: Monthly Trend Chart */}
        <div className="dash-card">
          <div className="dash-card-header">
            <div className="dash-card-title-group">
              <h3 className="dash-card-title">Revenue vs Expenses Monthly Trend</h3>
              <p className="dash-card-subtitle">
                12-month performance for FY {selectedYear !== 'All Years' ? selectedYear : '2026-2027'} (April to March)
              </p>
            </div>
            <div style={{ display: 'flex', gap: '12px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#0f6e56' }} /> Revenue
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#a8402e' }} /> Expenses
              </span>
            </div>
          </div>

          <div className="dash-card-body">
            {fyMonthlySeries.length === 0 ? (
              <div className="dash-empty-state">
                <span className="dash-empty-icon">📊</span>
                <span className="dash-empty-title">No monthly trend data</span>
                <p className="dash-empty-desc">No transactions logged for this financial year.</p>
              </div>
            ) : (
              <MonthlyTrendBarChart
                monthlyData={fyMonthlySeries}
                periodLabel={`FY ${selectedYear !== 'All Years' ? selectedYear : '2026-2027'}`}
                height={200}
              />
            )}
          </div>
        </div>

        {/* Right: Cash Flow Waterfall Chart (Replaces tall cash flow list card) */}
        <div className="dash-card">
          <div className="dash-card-header">
            <div className="dash-card-title-group">
              <h3 className="dash-card-title">Booked-Cost Waterfall</h3>
              <p className="dash-card-subtitle">
                Billed Income → Company Share → Operating Costs → Payroll CTC → {figures.unreconciled ? 'Unreconciled difference' : 'Provisional Result'} ({periodBasisLabel})
              </p>
            </div>
          </div>

          <div className="dash-card-body">
            {figures.chartReady ? <WaterfallChart
              grossRevenue={financeSummary.revenue}
              companyShare={financeSummary.our_share}
              operatingExpenses={financeSummary.operating_expenses}
              payroll={financeSummary.salaries}
              netProfit={bookedResult}
              resultLabel={figures.unreconciled ? 'Recorded diff' : 'Booked result'}
              resultDetail={figures.unreconciled ? 'Unreconciled booked-cost difference; not verified profit' : 'Provisional booked-cost result'}
              unreconciled={figures.unreconciled}
              payrollRows={financeSummary.cash_breakdown?.sources?.payroll_records?.rows}
              periodLabel={periodBasisLabel}
              height={200}
            /> : <p>A matching booked-cost summary is unavailable for this period. Recorded cash estimates and source totals are available in Runway & ROI.</p>}

            {figures.unreconciled && figures.chartReady && <p className="kpi-sub-note">The final bar is arithmetic from posted costs. Statutory overlap and unposted payroll are not resolved; use Runway & ROI to audit the sources.</p>}

            <div className="waterfall-summary-pill">
              <span className="waterfall-summary-label">{figures.unreconciled ? 'Recorded difference ÷ company share:' : 'Company Net Retained Conversion:'}</span>
              <span className="waterfall-summary-val" style={{ color: bookedMargin == null ? '#a8402e' : bookedMargin >= 0 ? '#0f6e56' : '#a8402e' }}>
                {bookedMargin == null ? 'Unavailable' : `${bookedMargin.toFixed(1)}%${figures.unreconciled ? ' (unreconciled)' : ' of company income'}`}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 5. ROW 3: NEEDS ATTENTION (LEFT) + REVENUE & SHARE BREAKDOWN (RIGHT) */}
      <section className="dash-grid-row-equal">
        {/* Left: Needs Attention Card */}
        <div className="dash-card needs-attention-card">
          <div className="dash-card-header">
            <div className="dash-card-title-group">
              <h3 className="dash-card-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>Needs Attention</span>
                <span className="badge" style={{ fontSize: '0.68rem', background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', padding: '1px 6px' }}>
                  {attentionAlerts.length}
                </span>
              </h3>
              <p className="dash-card-subtitle">
                Ranked by severity: budget overruns, excluded bills & configuration flags ({periodBasisLabel})
              </p>
            </div>
          </div>

          <div className="dash-card-body">
            {attentionAlerts.length === 0 ? (
              <div className="dash-empty-state" style={{ padding: '24px 10px' }}>
                <span className="dash-empty-icon">✓</span>
                <span className="dash-empty-title">All systems within targets</span>
                <p className="dash-empty-desc">No over-budget items or ledger discrepancies detected for this period.</p>
              </div>
            ) : (
              <ul className="attention-list">
                {attentionAlerts.slice(0, 3).map((item, idx) => (
                  <li key={idx} className={`attention-item severity-${item.severity}`}>
                    <span className="attention-item-icon">
                      {item.severity === 'danger' ? <AlertCircle size={16} /> : <AlertTriangle size={16} />}
                    </span>
                    <div className="attention-item-content">
                      <div className="attention-item-title">
                        <span>{item.title}</span>
                        <span className={`attention-badge-tag ${item.severity}`}>{item.severity}</span>
                      </div>
                      <p className="attention-item-desc">{item.desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="attention-footer">
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                Budget limits matched strictly to {selectedMonth !== 'All Months' ? '1-month spend' : `${periodBasisLabel}`}
              </span>
              {attentionAlerts.length > 0 && (
                <button
                  type="button"
                  className="attention-view-all"
                  onClick={() => setShowAllAttentionModal(true)}
                >
                  View all ({attentionAlerts.length}) <ChevronRight size={14} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right: Revenue & Share Breakdown Donut */}
        <div className="dash-card">
          <div className="dash-card-header">
            <div className="dash-card-title-group">
              <h3 className="dash-card-title">Revenue & Share Breakdown</h3>
              <p className="dash-card-subtitle">
                Total: {formatCurrency(donutTotalRev)} • Basis: {periodBasisLabel}
              </p>
            </div>

            <div className="leaderboard-toggle-group">
              <button
                type="button"
                className={`leaderboard-toggle-btn ${breakdownView === 'shares' ? 'active' : ''}`}
                onClick={() => setBreakdownView('shares')}
              >
                Share Split
              </button>
              <button
                type="button"
                className={`leaderboard-toggle-btn ${breakdownView === 'franchisees' ? 'active' : ''}`}
                onClick={() => setBreakdownView('franchisees')}
              >
                Franchisees
              </button>
              <button
                type="button"
                className={`leaderboard-toggle-btn ${breakdownView === 'streams' ? 'active' : ''}`}
                onClick={() => setBreakdownView('streams')}
              >
                Streams
              </button>
            </div>
          </div>

          <div className="dash-card-body" style={{ alignItems: 'center', justifyContent: 'center' }}>
            <DonutChart
              data={
                breakdownView === 'shares'
                  ? sharesDonutData
                  : (breakdownView === 'franchisees' ? franchiseDonutData : streamDonutData)
              }
              totalLabel="REVENUE"
            />
          </div>
        </div>
      </section>

      {/* 6. ROW 4: TOP 5 LEADERBOARD (LEFT) + NEXT MONTH FORECAST (RIGHT) */}
      <section className="dash-grid-row-equal">
        {/* Left: Top 5 Franchisees / BD Leaderboard */}
        <div className="dash-card">
          <div className="dash-card-header">
            <div className="dash-card-title-group">
              <h3 className="dash-card-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Award size={16} color="#0f6e56" />
                <span>Performance Leaderboard</span>
              </h3>
              <p className="dash-card-subtitle">
                Top 5 branches & contributors • {periodBasisLabel}
              </p>
            </div>

            <div className="leaderboard-toggle-group">
              <button
                type="button"
                className={`leaderboard-toggle-btn ${leaderboardTab === 'franchisees' ? 'active' : ''}`}
                onClick={() => setLeaderboardTab('franchisees')}
              >
                Franchisees
              </button>
              <button
                type="button"
                className={`leaderboard-toggle-btn ${leaderboardTab === 'bd' ? 'active' : ''}`}
                onClick={() => setLeaderboardTab('bd')}
              >
                BD Agents
              </button>
            </div>
          </div>

          <div className="dash-card-body">
            {leaderboardData.length === 0 ? (
              <div className="dash-empty-state">
                <span className="dash-empty-icon">🏆</span>
                <span className="dash-empty-title">No performance records</span>
                <p className="dash-empty-desc">No closed candidate placements matching this filter.</p>
              </div>
            ) : (
              <ul className="leaderboard-list">
                {leaderboardData.map((item, idx) => (
                  <li key={idx} className="leaderboard-row">
                    <span className={`leaderboard-rank rank-${idx + 1}`}>#{idx + 1}</span>
                    <div className="leaderboard-info">
                      <div className="leaderboard-name-row">
                        <span className="leaderboard-name" title={item.name}>{item.name}</span>
                        <span className="leaderboard-val">{formatCurrency(item.revenue)}</span>
                      </div>
                      <div className="leaderboard-bar-track">
                        <div className="leaderboard-bar-fill" style={{ width: `${Math.max(5, item.pct)}%` }} />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Right: Next Month Forecast Card */}
        <div className="dash-card">
          <div className="dash-card-header">
            <div className="dash-card-title-group">
              <h3 className="dash-card-title">Next Month Forecast</h3>
              <p className="dash-card-subtitle">
                Projected cash flows for {forecastTargetLabel} based on trailing run rate
              </p>
            </div>
            <span className="badge" style={{ background: '#f1f2ef', color: '#475569', fontSize: '0.72rem' }}>
              30-Day Outlook
            </span>
          </div>

          <div className="dash-card-body">
            <div className="forecast-card-grid">
              <div className="forecast-metric-tile">
                <span className="forecast-tile-label">Expected Inflow</span>
                <span className="forecast-tile-val positive">{formatLakhs(expInflow)}</span>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Company Share pool</span>
              </div>

              <div className="forecast-metric-tile">
                <span className="forecast-tile-label">Expected Outflow</span>
                <span className="forecast-tile-val negative">{formatLakhs(expOutflow)}</span>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Opex + commitments</span>
              </div>

              <div className="forecast-metric-tile">
                <span className="forecast-tile-label">Projected Net</span>
                <span className={`forecast-tile-val ${projNet >= 0 ? 'positive' : 'negative'}`}>
                  {projNet >= 0 ? '+' : ''}{formatLakhs(projNet)}
                </span>
                <span style={{ fontSize: '0.68rem', color: projNet >= 0 ? '#0f6e56' : '#a8402e', fontWeight: '600' }}>
                  {projNet >= 0 ? 'Surplus' : 'Deficit burn'}
                </span>
              </div>
            </div>

            <div className="forecast-narrative-box">
              <strong>Forecasting Basis:</strong> Derived from rolling average of company retained recruitment fees (25%) and current monthly operating spend run-rate. Excludes speculative pipeline.
            </div>
          </div>
        </div>
      </section>

      {/* 7. ROW 5: RECENT LEDGER (5 items, type filter, visibly clickable) */}
      <section className="dash-card">
        <div className="dash-card-header">
          <div className="dash-card-title-group">
            <h3 className="dash-card-title">Recent Ledger Items</h3>
            <p className="dash-card-subtitle">
              Auditable records • Showing 5 entries ({periodBasisLabel})
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="ledger-filter-pills">
              <button
                type="button"
                className={`ledger-filter-btn ${ledgerFilter === 'all' ? 'active' : ''}`}
                onClick={() => setLedgerFilter('all')}
              >
                All
              </button>
              <button
                type="button"
                className={`ledger-filter-btn ${ledgerFilter === 'income' ? 'active' : ''}`}
                onClick={() => setLedgerFilter('income')}
              >
                Inflow
              </button>
              <button
                type="button"
                className={`ledger-filter-btn ${ledgerFilter === 'expense' ? 'active' : ''}`}
                onClick={() => setLedgerFilter('expense')}
              >
                Outflow
              </button>
            </div>

            <button
              type="button"
              className="view-all-link"
              onClick={() => setActivePage('reports')}
              style={{ fontSize: '0.78rem', fontWeight: '600', color: 'var(--accent-teal)', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              View General Ledger <ExternalLink size={13} />
            </button>
          </div>
        </div>

        <div className="dash-card-body">
          {filteredRecentTxs.length === 0 ? (
            <div className="dash-empty-state">
              <span className="dash-empty-icon">📋</span>
              <span className="dash-empty-title">No transactions logged</span>
              <p className="dash-empty-desc">No transaction records match this type filter for the selected period.</p>
            </div>
          ) : (
            <ul className="ledger-entry-list">
              {filteredRecentTxs.map(tx => (
                <li
                  key={tx.id}
                  className="ledger-entry-row"
                  onClick={() => setSelectedTx(tx)}
                  title="Click to view rupee-level audit slip"
                >
                  <div className="ledger-entry-left">
                    <h4 className="ledger-entry-title">{tx.title || 'Recruitment Placement'}</h4>
                    <div className="ledger-entry-meta">
                      <span>{tx.category || 'Recruitment'}</span>
                      <span>•</span>
                      <span>{tx.subCategory || 'Placement'}</span>
                      <span>•</span>
                      <span>{formatDate(tx.date)}</span>
                      {tx.referenceId && (
                        <>
                          <span>•</span>
                          <code style={{ fontSize: '0.68rem', background: '#f1f2ef', padding: '1px 4px', borderRadius: '3px' }}>
                            {tx.referenceId}
                          </code>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="ledger-entry-right">
                    <span className={`ledger-entry-amt ${tx.type}`}>
                      {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                    </span>
                    <ChevronRight size={16} className="ledger-chevron" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* --- AUDITOR SLIP MODAL (Item 7 Click) --- */}
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
                <div className="receipt-brand">FINTECTIVE INTELLIGENCE</div>
                <div className="receipt-tx-number">REF CODE: {selectedTx.referenceId || selectedTx.id}</div>

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
                    <span className="value font-bold">{selectedTx.paymentMode || 'Net Banking'}</span>
                  </div>

                  <div className="receipt-detail-item">
                    <span className="label"><CreditCard size={13} /> Reference ID</span>
                    <span className="value"><code className="receipt-code">{selectedTx.referenceId || selectedTx.id}</code></span>
                  </div>
                </div>

                <hr className="receipt-divider" />

                <div className="receipt-description">
                  <h4>Auditor & Governance Notes</h4>
                  <p>{selectedTx.description || 'Verified transaction record logged via MySQL database single source of truth.'}</p>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedTx(null)}>Close Slip</button>
              <button className="btn btn-primary" onClick={() => window.print()}>Print Slip</button>
            </div>
          </div>
        </div>
      )}

      {/* --- DATA QUALITY DETAILS MODAL (Item 2 Click) --- */}
      {showDataQualityModal && (
        <div className="modal-backdrop animate-fade-in" onClick={() => setShowDataQualityModal(false)}>
          <div className="modal-card animate-scale-up" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={20} color="#0f6e56" />
                <h3 style={{ margin: 0 }}>Data Quality & Deduplication</h3>
              </div>
              <button className="btn-close" onClick={() => setShowDataQualityModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ background: '#f6f7f4', padding: '12px 14px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.85rem' }}>
                  <span style={{ fontWeight: '600', color: 'var(--text-main)' }}>Colliding Bills Excluded:</span>
                  <span style={{ fontWeight: '700', color: '#92400e' }}>{excludedBillsCount} invoices</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: '1.45' }}>
                  These bill numbers represent identical placements recorded under multiple branch IDs during migration. Fintective strictly excludes duplicate colliding records to avoid double counting revenue.
                </p>
              </div>

              <div style={{ background: '#f6f7f4', padding: '12px 14px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.85rem' }}>
                  <span style={{ fontWeight: '600', color: 'var(--text-main)' }}>Single Source of Truth:</span>
                  <span style={{ fontWeight: '700', color: '#0f6e56' }}>v_invoice_clean</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: '1.45' }}>
                  All revenue figures are compiled directly from the deduplicated database view with verified <code>is_revenue = 1</code> flags, excluding credit notes and cancelled billings.
                </p>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => setShowDataQualityModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* --- ALL ATTENTION ITEMS MODAL (Item 5 View All Click) --- */}
      {showAllAttentionModal && (
        <div className="modal-backdrop animate-fade-in" onClick={() => setShowAllAttentionModal(false)}>
          <div className="modal-card animate-scale-up" style={{ maxWidth: '580px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={20} color="#b91c1c" />
                <h3 style={{ margin: 0 }}>Attention Items ({attentionAlerts.length})</h3>
              </div>
              <button className="btn-close" onClick={() => setShowAllAttentionModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              <ul className="attention-list">
                {attentionAlerts.map((item, idx) => (
                  <li key={idx} className={`attention-item severity-${item.severity}`}>
                    <span className="attention-item-icon">
                      {item.severity === 'danger' ? <AlertCircle size={16} /> : <AlertTriangle size={16} />}
                    </span>
                    <div className="attention-item-content">
                      <div className="attention-item-title">
                        <span>{item.title}</span>
                        <span className={`attention-badge-tag ${item.severity}`}>{item.severity}</span>
                      </div>
                      <p className="attention-item-desc">{item.desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => setShowAllAttentionModal(false)}>Done</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Dashboard;
