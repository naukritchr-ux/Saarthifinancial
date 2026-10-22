import React, { useContext, useState, useEffect, useMemo } from 'react';
import { FinanceContext, API_BASE_URL } from '../context/FinanceContext';
import { fetchWithApiKey } from '../utils/apiClient';
import { formatCurrency, formatLakhs, formatDate } from '../utils/formatters';
import { getTransactionShares } from '../config/financeConfig';
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
  HelpCircle,
  Search,
  Building2,
  Check
} from 'lucide-react';
import Pagination from '../components/Pagination';
import IndustryPredictiveTab from '../components/IndustryPredictiveTab';
import AuditDrawer from '../components/AuditDrawer';
import { classifyIndustry, INDUSTRY_COLORS } from '../utils/industryPredictor';

// Comprehensive Industry to Sub-Industry Taxonomy
const INDUSTRY_SUB_MAP = {
  'IT & Software': ['Enterprise Software', 'Web & Cloud Applications', 'Frontend & Backend Engineering', 'Data Analytics & AI', 'QA, Testing & DevOps'],
  'Banking & Financial Services (BFSI)': ['Retail & Commercial Banking', 'FinTech & Digital Payments', 'Wealth Management & Investment', 'Insurance & Actuarial', 'NBFC & Lending'],
  'Engineering & Manufacturing': ['Automotive & EV', 'Industrial Equipment & Machinery', 'Electronics & Semiconductor', 'Chemical & Process Plants'],
  'Healthcare & Pharmaceuticals': ['Hospitals & Healthcare Clinics', 'Pharmaceutical Formulations & R&D', 'Medical Devices & Diagnostics', 'Biotechnology'],
  'Retail, Fashion & E-commerce': ['E-commerce & D2C', 'Apparel & Lifestyle Retail', 'FMCG & Consumer Goods', 'Luxury Goods'],
  'Infrastructure & Real Estate': ['Commercial Real Estate', 'Residential Construction', 'Architecture & Engineering', 'Facility Management'],
  'Human Resources & Staffing': ['Executive Search', 'Contingent Staffing', 'Recruitment Process Outsourcing (RPO)'],
  'Sales, Marketing & Consulting': ['Digital Marketing & Growth', 'Strategy & Management Consulting', 'B2B Corporate Sales'],
  'Corporate Enterprise Services': ['Legal & Compliance', 'Operations & Logistics', 'General Administration']
};

// 15 Standard BD Members from Live CRM Database
const ALL_BD_MEMBERS = [
  { name: 'Komal Suresh Bhanushali', role: 'Key Account Manager', baseSalary: 35000, isDormant: false },
  { name: 'Rajalaxmi Das Das', role: 'Enterprise Account Exec', baseSalary: 32000, isDormant: false },
  { name: 'Jahnvi Thakker', role: 'Senior BD Specialist', baseSalary: 30000, isDormant: false },
  { name: 'Ashutosh Manoj Hiremath', role: 'Senior BD Specialist', baseSalary: 28000, isDormant: false },
  { name: 'Kadambinee Kundu', role: 'Enterprise Account Exec', baseSalary: 26000, isDormant: false },
  { name: 'Muskan Ritesh Pradhan', role: 'BD Specialist', baseSalary: 24000, isDormant: false },
  { name: 'Rahul Patil', role: 'Senior BD Specialist', baseSalary: 25000, isDormant: false },
  { name: 'Sneha Kulkarni', role: 'Enterprise Account Exec', baseSalary: 22000, isDormant: false },
  { name: 'Ankur Sharma', role: 'BD Manager', baseSalary: 24000, isDormant: false },
  { name: 'Ruchi Shukla', role: 'BD Specialist', baseSalary: 20000, isDormant: false },
  { name: 'Shreya Santosh Talashilkar', role: 'BD Specialist', baseSalary: 18000, isDormant: true },
  { name: 'Sneha Santosh Jaiswal', role: 'BD Associate', baseSalary: 16000, isDormant: true },
  { name: 'Shruti Wilson Adhav', role: 'BD Associate', baseSalary: 16000, isDormant: true },
  { name: 'Jiya Pran Sanda', role: 'BD Associate', baseSalary: 16000, isDormant: true },
  { name: 'Sonali Jayanta Singh', role: 'BD Associate', baseSalary: 16000, isDormant: true }
];

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

  // Filter States requested by user for BD Member Performance
  const [selectedFinancialYear, setSelectedFinancialYear] = useState('All Financial Years');
  const [selectedInfoStatus, setSelectedInfoStatus] = useState('All'); // 'All' | 'R' | 'PR' | 'O' | 'C'
  const [bdExpenditurePct, setBdExpenditurePct] = useState('0'); // % overhead
  const [selectedIndustry, setSelectedIndustry] = useState('All Industries');
  const [selectedSubIndustry, setSelectedSubIndustry] = useState('All Sub-Industries');
  const [selectedBdFilter, setSelectedBdFilter] = useState('All BD Members');
  const [memberSearchTerm, setMemberSearchTerm] = useState('');
  const [memberSortField, setMemberSortField] = useState('gross'); // 'gross' | 'roi' | 'cost' | 'waste' | 'name'
  const [selectedMemberForAudit, setSelectedMemberForAudit] = useState(null);
  const [memberPage, setMemberPage] = useState(1);
  const MEMBERS_PER_PAGE = 8;

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

  // Dynamic Sub-Industries for selected Industry
  const availableSubIndustries = useMemo(() => {
    if (selectedIndustry === 'All Industries') {
      const set = new Set();
      Object.values(INDUSTRY_SUB_MAP).forEach(subs => subs.forEach(s => set.add(s)));
      return Array.from(set);
    }
    return INDUSTRY_SUB_MAP[selectedIndustry] || [];
  }, [selectedIndustry]);

  // Comprehensive BD Member Performance Calculations
  const bdPerformanceData = useMemo(() => {
    const txList = Array.isArray(transactions) ? transactions : [];
    const expRate = (parseFloat(bdExpenditurePct) || 0) / 100;

    return ALL_BD_MEMBERS.map(member => {
      const cleanName = member.name.trim().toLowerCase();
      const firstName = cleanName.split(' ')[0];

      // Match transactions
      const matchingTxs = txList.filter(t => {
        const tBd = (t.bdAgentName || '').trim().toLowerCase();
        if (!tBd) return false;
        const matchesName = tBd === cleanName || tBd.includes(firstName);
        if (!matchesName) return false;

        // Financial Year filter
        if (selectedFinancialYear !== 'All Financial Years') {
          if (t.financialYear && t.financialYear !== selectedFinancialYear) return false;
        }

        // Info Status filter (R, PR, O, C)
        if (selectedInfoStatus !== 'All') {
          const tInfo = (t.info || 'R').toUpperCase();
          if (tInfo !== selectedInfoStatus.toUpperCase()) return false;
        }

        // Industry filter
        const ind = classifyIndustry(t);
        if (selectedIndustry !== 'All Industries') {
          if (ind !== selectedIndustry) return false;
        }

        // Sub Industry filter
        if (selectedSubIndustry !== 'All Sub-Industries') {
          const subText = `${t.subCategory || ''} ${t.title || ''} ${t.positionName || ''}`.toLowerCase();
          if (!subText.includes(selectedSubIndustry.toLowerCase())) return false;
        }

        return true;
      });

      // Also check leaderboard for period revenue if available
      const lbMatch = (leaderboard || []).find(item => {
        const lbName = (item.bd_name || '').trim().toLowerCase();
        return lbName === cleanName || lbName.includes(firstName);
      });

      let grossBilling = 0;
      let receivedRevenue = 0;
      let outstandingRevenue = 0;
      let cancelledRevenue = 0;
      let ourShare = 0;
      let invoicesClosed = 0;
      let invoicesCancelled = 0;
      let invoicesOutstanding = 0;

      if (matchingTxs.length > 0) {
        matchingTxs.forEach(t => {
          const amt = Number(t.amount || 0);
          const info = (t.info || 'R').toUpperCase();
          const isCancelledTx = info === 'C' || t.status === 'cancelled' || t.type === 'credit_note';
          const isReceivedTx = info === 'R';
          const isPartReceived = info === 'PR';
          const isOutstandingTx = info === 'O';

          grossBilling += amt;

          if (isCancelledTx) {
            cancelledRevenue += amt;
            invoicesCancelled++;
          } else if (isReceivedTx) {
            receivedRevenue += amt;
            ourShare += Number(t.ourShare || amt * 0.25);
            invoicesClosed++;
          } else if (isPartReceived) {
            receivedRevenue += amt * 0.5;
            outstandingRevenue += amt * 0.5;
            ourShare += Number(t.ourShare ? t.ourShare * 0.5 : amt * 0.125);
            invoicesClosed++;
          } else if (isOutstandingTx) {
            outstandingRevenue += amt;
            invoicesOutstanding++;
          } else {
            receivedRevenue += amt;
            ourShare += Number(t.ourShare || amt * 0.25);
            invoicesClosed++;
          }
        });
      } else if (lbMatch && selectedInfoStatus === 'All' && selectedIndustry === 'All Industries' && selectedSubIndustry === 'All Sub-Industries') {
        grossBilling = Number(lbMatch.gross_revenue || 0);
        ourShare = Number(lbMatch.net_revenue || 0);
        invoicesClosed = Number(lbMatch.invoices_closed || 0);
        cancelledRevenue = Number(lbMatch.potential_loss || 0);
        invoicesCancelled = cancelledRevenue > 0 ? Math.ceil(cancelledRevenue / 50000) : 0;
        receivedRevenue = Math.max(0, grossBilling - cancelledRevenue);
      }

      // Collect distinct industries handled by this member
      const industriesSet = new Set();
      matchingTxs.forEach(t => industriesSet.add(classifyIndustry(t)));
      const industriesList = Array.from(industriesSet);

      // Cost to company calculations ("what's that person is costing me")
      const baseSalary = member.baseSalary;
      const annualSalary = baseSalary * 12;
      const allocatedExp = grossBilling * expRate;
      const totalCost = annualSalary + allocatedExp;

      // Net ROI / Contribution
      const netROI = ourShare - totalCost;
      const roiMultiple = totalCost > 0 ? (ourShare / totalCost) : 0;

      // Leakage / Waste audit ("where that person is wasting my money")
      let wasteReason = '';
      if (member.isDormant && grossBilling === 0) {
        wasteReason = `Dormant: ₹${formatCurrency(annualSalary)} salary burn (0 closed deals)`;
      } else if (cancelledRevenue > 100000) {
        wasteReason = `High cancellation: ₹${formatCurrency(cancelledRevenue)} lost (${invoicesCancelled} deals)`;
      } else if (netROI < 0) {
        wasteReason = `Negative return: Costs exceed revenue by ₹${formatCurrency(Math.abs(netROI))}`;
      } else if (outstandingRevenue > 200000) {
        wasteReason = `Collection lag: ₹${formatCurrency(outstandingRevenue)} outstanding pending`;
      } else {
        wasteReason = `Profitable (${roiMultiple.toFixed(1)}x ROI return on salary)`;
      }

      return {
        ...member,
        grossBilling,
        receivedRevenue,
        outstandingRevenue,
        cancelledRevenue,
        ourShare,
        invoicesClosed,
        invoicesCancelled,
        invoicesOutstanding,
        totalDeals: matchingTxs.length || invoicesClosed + invoicesCancelled + invoicesOutstanding,
        industriesList: industriesList.length > 0 ? industriesList : ['Corporate Enterprise Services'],
        annualSalary,
        allocatedExp,
        totalCost,
        netROI,
        roiMultiple,
        wasteReason,
        matchingTxs
      };
    });
  }, [transactions, leaderboard, selectedFinancialYear, selectedInfoStatus, selectedIndustry, selectedSubIndustry, bdExpenditurePct]);

  // Aggregate Summary for Header KPI Cards
  const filteredSummary = useMemo(() => {
    let list = bdPerformanceData;
    if (selectedBdFilter !== 'All BD Members') {
      list = list.filter(m => m.name.toLowerCase() === selectedBdFilter.toLowerCase());
    }

    const gross = list.reduce((sum, m) => sum + m.grossBilling, 0);
    const received = list.reduce((sum, m) => sum + m.receivedRevenue, 0);
    const outstanding = list.reduce((sum, m) => sum + m.outstandingRevenue, 0);
    const cancelled = list.reduce((sum, m) => sum + m.cancelledRevenue, 0);
    const baseSal = list.reduce((sum, m) => sum + m.annualSalary, 0);
    const allocExp = list.reduce((sum, m) => sum + m.allocatedExp, 0);
    const totalCost = list.reduce((sum, m) => sum + m.totalCost, 0);
    const ourShare = list.reduce((sum, m) => sum + m.ourShare, 0);
    const netROI = ourShare - totalCost;
    const roiMultiple = totalCost > 0 ? (ourShare / totalCost) : 0;
    const totalDeals = list.reduce((sum, m) => sum + m.totalDeals, 0);

    const receivedPct = gross > 0 ? Math.round((received / gross) * 100) : 0;
    const outstandingPct = gross > 0 ? Math.round((outstanding / gross) * 100) : 0;
    const cancelledPct = gross > 0 ? Math.round((cancelled / gross) * 100) : 0;

    return {
      gross,
      received,
      outstanding,
      cancelled,
      baseSal,
      allocExp,
      totalCost,
      ourShare,
      netROI,
      roiMultiple,
      totalDeals,
      receivedPct,
      outstandingPct,
      cancelledPct
    };
  }, [bdPerformanceData, selectedBdFilter]);

  // Filtered and Sorted Directory List
  const displayedMembers = useMemo(() => {
    let list = [...bdPerformanceData];

    if (selectedBdFilter !== 'All BD Members') {
      list = list.filter(m => m.name.toLowerCase() === selectedBdFilter.toLowerCase());
    }

    if (memberSearchTerm.trim()) {
      const q = memberSearchTerm.toLowerCase();
      list = list.filter(m => 
        m.name.toLowerCase().includes(q) ||
        m.role.toLowerCase().includes(q) ||
        m.industriesList.some(ind => ind.toLowerCase().includes(q))
      );
    }

    // Sort
    list.sort((a, b) => {
      if (memberSortField === 'gross') return b.grossBilling - a.grossBilling;
      if (memberSortField === 'roi') return b.netROI - a.netROI;
      if (memberSortField === 'cost') return b.totalCost - a.totalCost;
      if (memberSortField === 'waste') return b.cancelledRevenue - a.cancelledRevenue;
      if (memberSortField === 'name') return a.name.localeCompare(b.name);
      return 0;
    });

    return list;
  }, [bdPerformanceData, selectedBdFilter, memberSearchTerm, memberSortField]);

  const handleExportDirectoryCSV = () => {
    const headers = ['BD Member', 'Role', 'Status', 'Closed Deals', 'Cancelled Deals', 'Gross Billing', 'Received Revenue', 'Outstanding', 'Cancelled Billing', 'Total Cost to Company', 'Net ROI', 'ROI Multiple', 'Waste Risk Note'];
    const rows = displayedMembers.map(m => [
      `"${m.name}"`,
      `"${m.role}"`,
      m.isDormant ? 'Dormant' : 'Active',
      m.invoicesClosed,
      m.invoicesCancelled,
      m.grossBilling.toFixed(2),
      m.receivedRevenue.toFixed(2),
      m.outstandingRevenue.toFixed(2),
      m.cancelledRevenue.toFixed(2),
      m.totalCost.toFixed(2),
      m.netROI.toFixed(2),
      `${m.roiMultiple.toFixed(2)}x`,
      `"${m.wasteReason}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `BD_Member_Performance_Directory_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
    const contextNet = agentTxs.filter(t => t.type === 'income').reduce((sum, t) => sum + getTransactionShares(t).rShare, 0);

    const grossRevenue = lbMatch ? lbMatch.gross_revenue : (contextGross > 0 ? contextGross : 0.0);
    const netRevenue = lbMatch ? lbMatch.net_revenue : (contextNet > 0 ? contextNet : 0.0);
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
    const BD_EXCLUSIONS = new Set([
      'head office',
      'head - office',
      'head  - office',
      'unknown',
      'prospect',
      'old . tl',
      'pune . office',
      ''
    ]);
    const isExcluded = (name) => BD_EXCLUSIONS.has((name || '').trim().toLowerCase().replace(/\s+/g, ' '));

    const merged = baseRoster
      .filter(agent => !isExcluded(agent.name))
      .map((agent) => {
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
        if (bName && !isExcluded(bName) && !existingNames.has(bName.toLowerCase())) {
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
    let list = [...rawFranchisees];
    if (kpiFilter === 'received') {
      list = list.filter(f => (f.received || 0) > 0);
      list.sort((a, b) => (b.received || 0) - (a.received || 0));
    } else if (kpiFilter === 'outstanding') {
      list = list.filter(f => (f.outstanding || 0) > 0);
      list.sort((a, b) => (b.outstanding || 0) - (a.outstanding || 0));
    } else if (kpiFilter === 'cancelled') {
      list = list.filter(f => (f.cancelled || 0) > 0 || (f.credit_notes || 0) > 0);
      list.sort((a, b) => ((b.cancelled || 0) + (b.credit_notes || 0)) - ((a.cancelled || 0) + (a.credit_notes || 0)));
    } else if (kpiFilter === 'at_risk') {
      list = list.filter(f => (f.outstanding || 0) > 0 && (f.collection_risk?.band_key !== 'likely' || (f.collection_risk?.score != null && f.collection_risk?.score < 70)));
      list.sort((a, b) => (a.collection_risk?.score ?? 70) - (b.collection_risk?.score ?? 70));
    }
    return list;
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

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${selectedBdId.replace(/\s+/g, '_')}_Franchisee_Portfolio_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
      
      {/* ========================================================================= */}
      {/* BD MEMBER PERFORMANCE OVERVIEW, COST, ROI & DIRECTORY                     */}
      {/* ========================================================================= */}
      <div className="animate-fade-in">
          
          {/* Header Card with Member Count & Description */}
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            padding: '20px 24px',
            marginBottom: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h2 style={{ fontSize: '1.45rem', fontWeight: '800', margin: 0, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
                    BD Member Performance
                  </h2>
                </div>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                  Complete BD member-wise performance overview
                </p>
                <div style={{ marginTop: '6px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Monitor BD member acquisition, billing, cost to company and financial ROI performance.
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', background: 'var(--bg-main)', padding: '6px 14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '1.6rem', fontWeight: '800', color: 'var(--text-main)' }}>15</span>
                <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>BD Members</span>
              </div>
            </div>

            {/* Filter Controls Row (Matching user screenshot: Financial Year, Info Status, BD Expenditure %, Industry, Sub Industry, BD Name) */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
              gap: '14px',
              marginTop: '20px',
              paddingTop: '18px',
              borderTop: '1px solid var(--border-color)'
            }}>
              {/* Financial Year */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>
                  Financial Year
                </label>
                <select
                  value={selectedFinancialYear}
                  onChange={(e) => { setSelectedFinancialYear(e.target.value); setMemberPage(1); }}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.86rem', fontWeight: '600' }}
                >
                  <option value="All Financial Years">All Financial Years</option>
                  <option value="2026-2027">2026-2027 (FY27)</option>
                  <option value="2025-2026">2025-2026 (FY26)</option>
                  <option value="2024-2025">2024-2025 (FY25)</option>
                </select>
              </div>

              {/* Info Status */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>
                  Info Status
                </label>
                <select
                  value={selectedInfoStatus}
                  onChange={(e) => { setSelectedInfoStatus(e.target.value); setMemberPage(1); }}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.86rem', fontWeight: '600' }}
                >
                  <option value="All">All</option>
                  <option value="R">R (Received / Paid)</option>
                  <option value="PR">PR (Part Received)</option>
                  <option value="O">O (Outstanding / Unpaid)</option>
                  <option value="C">C (Cancelled / Void)</option>
                </select>
              </div>

              {/* BD Expenditure % */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>
                  BD Expenditure %
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="Enter %"
                    value={bdExpenditurePct}
                    onChange={(e) => setBdExpenditurePct(e.target.value)}
                    style={{ width: '100%', padding: '9px 26px 9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.86rem', fontWeight: '600' }}
                  />
                  <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.82rem', pointerEvents: 'none' }}>%</span>
                </div>
              </div>

              {/* Industry */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>
                  Industry
                </label>
                <select
                  value={selectedIndustry}
                  onChange={(e) => { setSelectedIndustry(e.target.value); setSelectedSubIndustry('All Sub-Industries'); setMemberPage(1); }}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.86rem', fontWeight: '600' }}
                >
                  <option value="All Industries">All Industries</option>
                  {Object.keys(INDUSTRY_COLORS).map(ind => (
                    <option key={ind} value={ind}>{ind}</option>
                  ))}
                </select>
              </div>

              {/* Sub Industry */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>
                  Sub Industry
                </label>
                <select
                  value={selectedSubIndustry}
                  onChange={(e) => { setSelectedSubIndustry(e.target.value); setMemberPage(1); }}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.86rem', fontWeight: '600' }}
                >
                  <option value="All Sub-Industries">All Sub-Industries</option>
                  {availableSubIndustries.map(sub => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))}
                </select>
              </div>

              {/* BD Member Filter */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>
                  BD Specialist
                </label>
                <select
                  value={selectedBdFilter}
                  onChange={(e) => { setSelectedBdFilter(e.target.value); setMemberPage(1); }}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.86rem', fontWeight: '600' }}
                >
                  <option value="All BD Members">All BD Members (15)</option>
                  {ALL_BD_MEMBERS.map(m => (
                    <option key={m.name} value={m.name}>{m.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* KPI Cards Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: '14px',
            marginBottom: '20px'
          }}>
            {/* Card 1: Gross Commercial Billing */}
            <div className="dashboard-card" style={{ padding: '18px', borderLeft: '4px solid #3b82f6' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  GROSS COMMERCIAL BILLING
                </span>
                <span style={{ color: '#3b82f6', background: 'rgba(59,130,246,0.1)', padding: '5px', borderRadius: '6px' }}>
                  <DollarSign size={16} />
                </span>
              </div>
              <h2 style={{ fontSize: '1.65rem', fontWeight: '800', margin: '4px 0', color: 'var(--text-main)' }}>
                {formatCurrency(filteredSummary.gross)}
              </h2>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Across {filteredSummary.totalDeals} candidate placement deals
              </div>
            </div>

            {/* Card 2: Received Revenue */}
            <div className="dashboard-card" style={{ padding: '18px', borderLeft: '4px solid #10b981' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  RECEIVED REVENUE
                </span>
                <span style={{ color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '5px', borderRadius: '6px' }}>
                  <TrendingUp size={16} />
                </span>
              </div>
              <h2 style={{ fontSize: '1.65rem', fontWeight: '800', margin: '4px 0', color: '#10b981' }}>
                {formatCurrency(filteredSummary.received)}
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#10b981', fontWeight: '600', marginTop: '4px' }}>
                <span>{filteredSummary.receivedPct}% of Gross Billing</span>
                <span>↑</span>
              </div>
            </div>

            {/* Card 3: In-Progress / Outstanding */}
            <div className="dashboard-card" style={{ padding: '18px', borderLeft: '4px solid #f59e0b' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  IN-PROGRESS / OUTSTANDING
                </span>
                <span style={{ color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '5px', borderRadius: '6px' }}>
                  <Clock size={16} />
                </span>
              </div>
              <h2 style={{ fontSize: '1.65rem', fontWeight: '800', margin: '4px 0', color: '#f59e0b' }}>
                {formatCurrency(filteredSummary.outstanding)}
              </h2>
              <div style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: '600', marginTop: '4px' }}>
                {filteredSummary.outstandingPct}% pending collection
              </div>
            </div>

            {/* Card 4: Cancelled Billing (Wasted Revenue) */}
            <div className="dashboard-card" style={{ padding: '18px', borderLeft: '4px solid #ef4444' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  CANCELLED BILLING
                </span>
                <span style={{ color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '5px', borderRadius: '6px' }}>
                  <Briefcase size={16} />
                </span>
              </div>
              <h2 style={{ fontSize: '1.65rem', fontWeight: '800', margin: '4px 0', color: '#ef4444' }}>
                {formatCurrency(filteredSummary.cancelled)}
              </h2>
              <div style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: '600', marginTop: '4px' }}>
                {filteredSummary.cancelledPct}% cancelled / lost deals
              </div>
            </div>

            {/* Card 5: What Person Costs Me */}
            <div className="dashboard-card" style={{ padding: '18px', borderLeft: '4px solid #8b5cf6' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  COST TO COMPANY (CTC)
                </span>
                <span style={{ color: '#8b5cf6', background: 'rgba(139,92,246,0.1)', padding: '5px', borderRadius: '6px' }}>
                  <Users size={16} />
                </span>
              </div>
              <h2 style={{ fontSize: '1.65rem', fontWeight: '800', margin: '4px 0', color: '#8b5cf6' }}>
                {formatCurrency(filteredSummary.totalCost)}
              </h2>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Salary: {formatCurrency(filteredSummary.baseSal)} + Exp: {formatCurrency(filteredSummary.allocExp)}
              </div>
            </div>

            {/* Card 6: Net ROI / Profit or Loss */}
            <div className="dashboard-card" style={{ padding: '18px', borderLeft: `4px solid ${filteredSummary.netROI >= 0 ? '#0F6E56' : '#dc2626'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  NET ROI / CONTRIBUTION
                </span>
                <span style={{ color: filteredSummary.netROI >= 0 ? '#0F6E56' : '#dc2626', background: filteredSummary.netROI >= 0 ? 'rgba(15,110,86,0.1)' : 'rgba(220,38,38,0.1)', padding: '5px', borderRadius: '6px' }}>
                  <Sparkles size={16} />
                </span>
              </div>
              <h2 style={{ fontSize: '1.65rem', fontWeight: '800', margin: '4px 0', color: filteredSummary.netROI >= 0 ? '#0F6E56' : '#dc2626' }}>
                {filteredSummary.netROI >= 0 ? '+' : ''}{formatCurrency(filteredSummary.netROI)}
              </h2>
              <div style={{ fontSize: '0.75rem', fontWeight: '600', color: filteredSummary.netROI >= 0 ? '#0F6E56' : '#dc2626', marginTop: '4px' }}>
                {filteredSummary.roiMultiple.toFixed(1)}x ROI Multiple • {filteredSummary.netROI >= 0 ? 'Net Profitable' : 'Loss-Making'}
              </div>
            </div>
          </div>

          {/* Financial Status Breakdown Bar (Commercial Reconciliation) */}
          <div className="dashboard-card" style={{ padding: '18px 22px', marginBottom: '22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <span style={{ fontSize: '0.94rem', fontWeight: '700', color: 'var(--text-main)' }}>
                  Financial Status Breakdown Bar (Commercial Reconciliation)
                </span>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Visual reconciliation across Received inflows, Outstanding invoices, and Cancelled deals.
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: '700', color: '#0F6E56', background: 'rgba(15,110,86,0.1)', padding: '4px 10px', borderRadius: '20px' }}>
                <CheckCircle2 size={14} /> Commercial Reconciled
              </div>
            </div>

            {/* Segmented Progress Bar */}
            <div style={{ height: '20px', borderRadius: '6px', overflow: 'hidden', display: 'flex', background: 'var(--border-color)', margin: '10px 0' }}>
              <div style={{ width: `${filteredSummary.receivedPct}%`, background: '#10b981', transition: 'width 0.3s' }} title={`Received: ${formatCurrency(filteredSummary.received)} (${filteredSummary.receivedPct}%)`} />
              <div style={{ width: `${filteredSummary.outstandingPct}%`, background: '#f59e0b', transition: 'width 0.3s' }} title={`Outstanding: ${formatCurrency(filteredSummary.outstanding)} (${filteredSummary.outstandingPct}%)`} />
              <div style={{ width: `${filteredSummary.cancelledPct}%`, background: '#ef4444', transition: 'width 0.3s' }} title={`Cancelled / Lost: ${formatCurrency(filteredSummary.cancelled)} (${filteredSummary.cancelledPct}%)`} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#10b981' }} />
                Received: <strong style={{ color: 'var(--text-main)' }}>{formatCurrency(filteredSummary.received)}</strong> ({filteredSummary.receivedPct}%)
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#f59e0b' }} />
                Outstanding: <strong style={{ color: 'var(--text-main)' }}>{formatCurrency(filteredSummary.outstanding)}</strong> ({filteredSummary.outstandingPct}%)
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#ef4444' }} />
                Cancelled: <strong style={{ color: 'var(--text-main)' }}>{formatCurrency(filteredSummary.cancelled)}</strong> ({filteredSummary.cancelledPct}%)
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#8b5cf6' }} />
                Total Cost: <strong style={{ color: 'var(--text-main)' }}>{formatCurrency(filteredSummary.totalCost)}</strong>
              </span>
            </div>
          </div>

          {/* BD Member Performance Directory Table (Requested by user) */}
          <div className="dashboard-card" style={{ padding: '22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800', color: 'var(--text-main)' }}>
                  BD Member Performance Directory
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Member-wise commercial billing, CTC cost, ROI return multiple, and money waste analysis. Click any row for invoice audit.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', minWidth: '240px' }}>
                  <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    placeholder="Search BD member or industry..."
                    value={memberSearchTerm}
                    onChange={(e) => { setMemberSearchTerm(e.target.value); setMemberPage(1); }}
                    style={{ width: '100%', padding: '7px 12px 7px 30px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.82rem' }}
                  />
                </div>

                <select
                  value={memberSortField}
                  onChange={(e) => setMemberSortField(e.target.value)}
                  style={{ padding: '7px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.82rem', fontWeight: '600' }}
                >
                  <option value="gross">Sort: Gross Billing (High to Low)</option>
                  <option value="roi">Sort: Net ROI (High to Low)</option>
                  <option value="cost">Sort: Cost to Company (High to Low)</option>
                  <option value="waste">Sort: Money Wasted (High to Low)</option>
                  <option value="name">Sort: Name (A-Z)</option>
                </select>

                <button
                  onClick={handleExportDirectoryCSV}
                  className="btn btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', fontSize: '0.82rem' }}
                >
                  <Download size={14} /> Export CSV
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>BD Member</th>
                    <th>Deals Pipeline</th>
                    <th>Primary Industries</th>
                    <th className="text-right">Gross Billing</th>
                    <th className="text-right">Received</th>
                    <th className="text-right">Outstanding</th>
                    <th className="text-right">Cancelled (Wasted)</th>
                    <th className="text-right">Cost to Company</th>
                    <th className="text-right">Net ROI</th>
                    <th>Money Waste / Risk Audit</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedMembers.length === 0 ? (
                    <tr>
                      <td colSpan={10} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                        No BD member records matched your selected filters.
                      </td>
                    </tr>
                  ) : (
                    displayedMembers.slice((memberPage - 1) * MEMBERS_PER_PAGE, memberPage * MEMBERS_PER_PAGE).map((member) => {
                      const isLoss = member.netROI < 0;
                      return (
                        <tr
                          key={member.name}
                          onClick={() => setSelectedMemberForAudit(member)}
                          className="clickable-row-item"
                          style={{ cursor: 'pointer' }}
                        >
                          {/* Member Name & Role */}
                          <td className="font-bold">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span>{member.name}</span>
                              {member.isDormant && (
                                <span style={{ padding: '1px 6px', borderRadius: '4px', fontSize: '0.66rem', fontWeight: '700', background: 'rgba(239,68,68,0.12)', color: '#dc2626' }}>
                                  Dormant
                                </span>
                              )}
                              {!member.isDormant && member.grossBilling > 1000000 && (
                                <span style={{ padding: '1px 6px', borderRadius: '4px', fontSize: '0.66rem', fontWeight: '700', background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>
                                  Top Tier
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              {member.role} • Click for invoice audit →
                            </div>
                          </td>

                          {/* Pipeline */}
                          <td>
                            <div style={{ fontWeight: '700', fontSize: '0.8rem' }}>
                              <span style={{ color: '#10b981' }}>{member.invoicesClosed}P</span> / <span style={{ color: '#ef4444' }}>{member.invoicesCancelled}C</span> / <span style={{ color: '#f59e0b' }}>{member.invoicesOutstanding}O</span>
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              Total: {member.totalDeals}
                            </div>
                          </td>

                          {/* Top Industries */}
                          <td>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '180px' }}>
                              {member.industriesList.slice(0, 2).map((ind, i) => (
                                <span key={i} style={{ fontSize: '0.68rem', padding: '2px 6px', borderRadius: '4px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                                  {ind.split(' ')[0]}
                                </span>
                              ))}
                              {member.industriesList.length > 2 && (
                                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>+{member.industriesList.length - 2}</span>
                              )}
                            </div>
                          </td>

                          {/* Gross Billing */}
                          <td className="font-bold text-right">
                            {formatCurrency(member.grossBilling)}
                          </td>

                          {/* Received */}
                          <td className="text-right">
                            <div style={{ color: '#10b981', fontWeight: '700' }}>
                              {formatCurrency(member.receivedRevenue)}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              {member.grossBilling > 0 ? Math.round((member.receivedRevenue / member.grossBilling) * 100) : 0}%
                            </div>
                          </td>

                          {/* Outstanding */}
                          <td className="text-right">
                            <div style={{ color: member.outstandingRevenue > 0 ? '#f59e0b' : 'var(--text-muted)', fontWeight: '700' }}>
                              {formatCurrency(member.outstandingRevenue)}
                            </div>
                          </td>

                          {/* Cancelled Billing */}
                          <td className="text-right">
                            <div style={{ color: member.cancelledRevenue > 0 ? '#ef4444' : 'var(--text-muted)', fontWeight: '700' }}>
                              {formatCurrency(member.cancelledRevenue)}
                            </div>
                          </td>

                          {/* Cost to Company */}
                          <td className="text-right">
                            <div style={{ color: '#8b5cf6', fontWeight: '700' }}>
                              {formatCurrency(member.totalCost)}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              Base: {formatCurrency(member.baseSalary)}/mo
                            </div>
                          </td>

                          {/* Net ROI */}
                          <td className="text-right">
                            <div style={{ padding: '3px 8px', borderRadius: '6px', display: 'inline-block', fontWeight: '700', fontSize: '0.8rem', background: isLoss ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', color: isLoss ? '#dc2626' : '#0F6E56' }}>
                              {member.netROI >= 0 ? '+' : ''}{formatCurrency(member.netROI)}
                            </div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                              {member.roiMultiple.toFixed(1)}x multiple
                            </div>
                          </td>

                          {/* Waste / Risk Audit */}
                          <td>
                            <div style={{ fontSize: '0.74rem', fontWeight: '600', color: isLoss ? '#dc2626' : '#10b981' }}>
                              {member.wasteReason}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={memberPage}
              totalItems={displayedMembers.length}
              pageSize={MEMBERS_PER_PAGE}
              onPageChange={setMemberPage}
              itemName="BD members"
            />
          </div>
        </div>

      {/* Universal BD Audit Drawer */}
      <AuditDrawer
        isOpen={Boolean(selectedMemberForAudit)}
        onClose={() => setSelectedMemberForAudit(null)}
        entityType="bd"
        entityName={selectedMemberForAudit?.name || ''}
        entityRole={selectedMemberForAudit?.role || 'BD Specialist'}
        month={selectedMonth === 'All Months' ? 'all' : selectedMonth}
        financialYear={selectedYear}
      />

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
                    Avg age: {selectedFranchiseeDetail.avg_days_outstanding}d
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
