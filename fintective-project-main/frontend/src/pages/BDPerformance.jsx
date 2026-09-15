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

// Trailing MoM Area / Line Trend Chart for BD Portfolio
const BDMonthlyTrendChart = ({ trendData = [] }) => {
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
            Tracking BD conversion speed vs accumulation of outstanding & cancelled deals
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

const BDPerformance = () => {
  const { bdAgents, transactions, franchisees, addBdAgent, updateBdAgent, selectedMonth, selectedYear } = useContext(FinanceContext);
  
  // Navigation Sub-Tabs within BD tab: 'portfolio' | 'leaderboard'
  const [activeTab, setActiveTab] = useState('portfolio');

  // Selected BD Agent for Franchisee Portfolio breakdown view
  const [selectedBdId, setSelectedBdId] = useState('');
  const [lookbackMonths, setLookbackMonths] = useState(12);
  const [sortBy, setSortBy] = useState('risk'); // 'risk' | 'outstanding' | 'gross'

  // Click-Through Drilldown Filter from KPI cards
  const [kpiFilter, setKpiFilter] = useState('all'); // 'all' | 'received' | 'outstanding' | 'cancelled' | 'at_risk'

  // Portfolio data state
  const [portfolioData, setPortfolioData] = useState(null);
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [portfolioError, setPortfolioError] = useState(null);

  // Franchisee Detail Modal state
  const [selectedFranchiseeDetail, setSelectedFranchiseeDetail] = useState(null);
  const [franModalTab, setFranModalTab] = useState('received'); // 'received' | 'outstanding' | 'cancelled'
  const [isCreditNotesModalOpen, setIsCreditNotesModalOpen] = useState(false);

  // Pagination for Franchisees
  const [franPage, setFranPage] = useState(1);
  const FRAN_PER_PAGE = 8;

  // New Agent Registration Form States
  const [showAddForm, setShowAddForm] = useState(false);
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

  // Set default selected BD to top active agent
  useEffect(() => {
    if ((!selectedBdId || selectedBdId.toLowerCase() === 'prospect') && allAgentsList.length > 0) {
      setSelectedBdId(allAgentsList[0].name || allAgentsList[0].id);
    }
  }, [allAgentsList, selectedBdId]);

  // Fetch BD Franchisee Portfolio Breakdown using BD Tracking logic
  useEffect(() => {
    if (!selectedBdId) return;
    setPortfolioLoading(true);
    setPortfolioError(null);

    // Provide instant client-side synthesized portfolio so page is never empty
    const fallback = synthesizePortfolio({
      entityType: 'bd',
      entityName: selectedBdId,
      transactions,
      franchisees,
      agentsList: allAgentsList,
      lookbackMonths,
      sortBy
    });
    setPortfolioData(fallback);

    const { start, end } = getPeriodDates(selectedMonth, selectedYear);
    const url = `${API_BASE_URL}/bd-tracking/${encodeURIComponent(selectedBdId)}/portfolio?start_date=${start}&end_date=${end}&lookback_months=${lookbackMonths}&sort_by=${sortBy}`;

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
        console.warn("Using high-fidelity synthesized BD portfolio metrics (offline/coldstart mode):", err);
      })
      .finally(() => {
        setPortfolioLoading(false);
      });
  }, [selectedBdId, selectedMonth, selectedYear, lookbackMonths, sortBy, transactions, franchisees, allAgentsList]);

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
    if (kpiFilter === 'received') {
      return rawFranchisees.filter(f => (f.received || 0) > 0);
    }
    if (kpiFilter === 'outstanding') {
      return rawFranchisees.filter(f => (f.outstanding || 0) > 0);
    }
    if (kpiFilter === 'cancelled') {
      return rawFranchisees.filter(f => (f.cancelled || 0) > 0 || (f.credit_notes || 0) > 0);
    }
    if (kpiFilter === 'at_risk') {
      return rawFranchisees.filter(f => (f.outstanding || 0) > 0 && (f.collection_risk?.score < 70 || f.collection_risk?.band_key !== 'likely'));
    }
    return rawFranchisees;
  }, [rawFranchisees, kpiFilter]);

  // Proportional Stacked Bar segments
  const totalBarBase = Math.max(1, pTotals.received + pTotals.outstanding + pTotals.cancelled);
  const barReceivedPct = Math.min(100, Math.max(0, (pTotals.received / totalBarBase) * 100));
  const barOutstandingPct = Math.min(100 - barReceivedPct, Math.max(0, (pTotals.outstanding / totalBarBase) * 100));
  const barCancelledPct = Math.max(0, 100 - barReceivedPct - barOutstandingPct);

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

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${selectedBdId.replace(/\s+/g, '_')}_Franchisee_Portfolio_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
  }).sort((a, b) => b.grossRevenue - a.grossRevenue);

  // Aggregates
  const overallRevenue = agentSummaries.reduce((sum, a) => sum + a.grossRevenue, 0);
  const overallNetRevenue = agentSummaries.reduce((sum, a) => sum + a.netRevenue, 0);
  const overallLossAmount = agentSummaries.reduce((sum, a) => sum + a.lossAmount, 0);
  const totalCommissions = agentSummaries.reduce((sum, a) => sum + a.commissionsEarned, 0);
  const totalCalculatedSalaries = agentSummaries.reduce((sum, a) => sum + a.calculatedSalary, 0);
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
      
      {/* Top Navigation Sub-Tabs: Portfolio vs Leaderboard */}
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
            BD Leaderboard & Contract Directory
          </button>
        </div>

        {/* BD Selector & Lookback Control for Portfolio Tab */}
        {activeTab === 'portfolio' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>BD Specialist:</span>
              <select
                value={selectedBdId}
                onChange={(e) => { setSelectedBdId(e.target.value); setKpiFilter('all'); }}
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
                {allAgentsList.map(a => (
                  <option key={a.id || a.name} value={a.name || a.id}>
                    {a.name} ({a.leadsProgressed || 0} closed)
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
      {/* VIEW 1: FRANCHISEE PORTFOLIO BREAKDOWN & BD COLLECTION RISK FORECASTING  */}
      {/* ========================================================================= */}
      {activeTab === 'portfolio' && (
        <div className="animate-fade-in">
          
          {/* Quick BD Pills */}
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '16px' }}>
            {allAgentsList.slice(0, 8).map(agent => {
              const isSelected = selectedBdId === agent.name || selectedBdId === agent.id;
              return (
                <button
                  key={agent.id || agent.name}
                  onClick={() => { setSelectedBdId(agent.name || agent.id); setKpiFilter('all'); }}
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
                  <span>{agent.name}</span>
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
              onClick={() => setKpiFilter('received')}
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
              onClick={() => setKpiFilter('outstanding')}
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
              onClick={() => setKpiFilter('cancelled')}
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
              onClick={() => setKpiFilter('at_risk')}
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
                  onClick={() => setKpiFilter('cancelled')}
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
                  onClick={() => setKpiFilter('outstanding')}
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
                  onClick={() => setKpiFilter('received')}
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
            <BDMonthlyTrendChart trendData={monthlyTrend} />
          )}

          {/* Franchisee Portfolio Table with Collection Risk Scoring & Export */}
          <div className="dashboard-card">
            
            {/* Quick Segmented Filter Tabs: All, Received, Outstanding, Cancelled, High Risk */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <button
                onClick={() => setKpiFilter('all')}
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
                onClick={() => setKpiFilter('received')}
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
                onClick={() => setKpiFilter('outstanding')}
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
                onClick={() => setKpiFilter('cancelled')}
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
                onClick={() => setKpiFilter('at_risk')}
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
                <span>⚠️ High Risk ({rawFranchisees.filter(f => (f.outstanding || 0) > 0 && (f.collection_risk?.band_key !== 'likely')).length})</span>
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 className="card-title" style={{ margin: 0, fontSize: '1rem', fontWeight: '700' }}>
                  Franchisee Portfolio Breakdown ({filteredFranchisees.length} of {rawFranchisees.length} Accounts)
                </h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Prioritized by Collection Risk: Aging factor (45%) + BD Conversion (35%) + Franchisee Track Record (20%)
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

                {/* Sort Controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--bg-main)', padding: '3px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', paddingLeft: '6px' }}>Sort:</span>
                  <button
                    onClick={() => setSortBy('risk')}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      border: 'none',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      background: sortBy === 'risk' ? 'var(--accent-teal)' : 'transparent',
                      color: sortBy === 'risk' ? '#fff' : 'var(--text-muted)'
                    }}
                  >
                    Risk 🔴
                  </button>
                  <button
                    onClick={() => setSortBy('outstanding')}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      border: 'none',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      background: sortBy === 'outstanding' ? 'var(--accent-teal)' : 'transparent',
                      color: sortBy === 'outstanding' ? '#fff' : 'var(--text-muted)'
                    }}
                  >
                    Outstanding 🟡
                  </button>
                  <button
                    onClick={() => setSortBy('gross')}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      border: 'none',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      background: sortBy === 'gross' ? 'var(--accent-teal)' : 'transparent',
                      color: sortBy === 'gross' ? '#fff' : 'var(--text-muted)'
                    }}
                  >
                    Gross 🟢
                  </button>
                </div>
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
                                  title={`Aging Factor: ${cr.aging_factor}% (45%) | BD Conv: ${cr.conversion_rate}% (35%) | Fran Record: ${cr.franchisee_track_record}% (20%)`}
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
      {/* VIEW 2: BD LEADERBOARD & DIRECTORY (CONTRACT RECONCILIATION)              */}
      {/* ========================================================================= */}
      {activeTab === 'leaderboard' && (
        <div className="animate-fade-in">
          
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
                      <th style={{ textAlign: 'center' }}>Portfolio Audit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const safeAgentPage = Math.min(Math.max(1, agentPage), Math.max(1, Math.ceil(agentSummaries.length / AGENTS_PER_PAGE)));
                      const paginatedAgents = agentSummaries.slice((safeAgentPage - 1) * AGENTS_PER_PAGE, safeAgentPage * AGENTS_PER_PAGE);
                      
                      return paginatedAgents.map(agent => (
                        <tr 
                          key={agent.id}
                          onClick={() => { setSelectedBdId(agent.name); setActiveTab('portfolio'); setKpiFilter('all'); }}
                          className="clickable-row-item"
                          style={{ cursor: 'pointer' }}
                        >
                          <td className="font-bold">
                            <div>{agent.name}</div>
                            <span style={{ fontSize: '0.7rem', color: 'var(--accent-teal)', fontWeight: 'normal' }}>
                              Click to view Franchisee Portfolio →
                            </span>
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
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveAgentDetails(agent);
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
                              Contract Audit
                            </button>
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
        </div>
      )}

      {/* Credit Note Deductions Audit Modal for BD Portfolio */}
      {isCreditNotesModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsCreditNotesModalOpen(false)}>
          <div className="modal-content animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '840px', width: '90%' }}>
            <div className="modal-header">
              <div className="modal-header-title">
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#1B2321', fontWeight: '700' }}>
                  Credit Note Deductions Audit • {selectedBdId}
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
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px 0' }}>No credit note deduction records found for this business development executive.</p>
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

      {/* Franchisee Detail Item Audit Drawer / Modal with 3 Sub-Tabs */}
      {selectedFranchiseeDetail && (
        <div className="modal-backdrop" onClick={() => setSelectedFranchiseeDetail(null)}>
          <div className="modal-content animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '920px', width: '92%' }}>
            <div className="modal-header">
              <div className="modal-header-title">
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#1B2321', fontWeight: '700' }}>
                  Franchisee Financial Audit: {selectedFranchiseeDetail.name}
                </h3>
                <span className="modal-subtitle" style={{ color: '#6B7268', fontSize: '0.8rem', marginTop: '2px', display: 'block' }}>
                  BD Specialist: {selectedBdId} • Gross Billing: <strong style={{ color: 'var(--text-main)' }}>{formatCurrency(selectedFranchiseeDetail.gross)}</strong> • Received: <strong style={{ color: '#0F6E56' }}>{formatCurrency(selectedFranchiseeDetail.received)}</strong> ({selectedFranchiseeDetail.received_pct}%) • Outstanding: <strong style={{ color: '#B7791F' }}>{formatCurrency(selectedFranchiseeDetail.outstanding)}</strong>
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

      {/* BD Agent Detail Deal Audit Popup overlay (Contract Reconciliation) */}
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
                  const safeModalPage = Math.min(Math.max(1, modalPage), totalPages);
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

export default BDPerformance;
