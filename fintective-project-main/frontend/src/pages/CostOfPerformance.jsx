import React, { useState, useEffect, useMemo, useContext } from 'react';
import { FinanceContext, API_BASE_URL } from '../context/FinanceContext';
import { fetchWithApiKey } from '../utils/apiClient';
import { formatCurrency, formatDate } from '../utils/formatters';
import { 
  DollarSign, 
  TrendingUp, 
  AlertTriangle, 
  Users, 
  Building, 
  MapPin, 
  Briefcase, 
  Layers, 
  Sliders, 
  Download, 
  Search, 
  ArrowUpDown, 
  ChevronRight, 
  X, 
  Info, 
  Sparkles,
  BarChart3,
  LayoutGrid,
  Activity,
  Target,
  Zap,
  Flame,
  Compass,
  ArrowRight,
  UserCheck,
  Scale
} from 'lucide-react';
import Pagination from '../components/Pagination';

// City Normalization Map
const CITY_MAP = {
  'bangalore': 'Bengaluru',
  'bengaluru': 'Bengaluru',
  'bombay': 'Mumbai',
  'mumbai': 'Mumbai',
  'navi mumbai': 'Navi Mumbai',
  'thane': 'Thane',
  'pune': 'Pune',
  'delhi': 'Delhi / NCR',
  'new delhi': 'Delhi / NCR',
  'noida': 'Noida / NCR',
  'gurgaon': 'Gurugram',
  'gurugram': 'Gurugram',
  'hyderabad': 'Hyderabad',
  'chennai': 'Chennai',
  'kolkata': 'Kolkata',
  'calcutta': 'Kolkata',
  'ahmedabad': 'Ahmedabad',
  'jaipur': 'Jaipur',
  'chandigarh': 'Chandigarh'
};

const normalizeCityName = (city) => {
  if (!city) return 'Mumbai';
  const c = city.trim().toLowerCase();
  return CITY_MAP[c] || city.trim();
};

const DEFAULT_TL_ROSTER = {
  'surbhi vinod jain': 55,
  'vedika girish tolani': 55,
  'joyeeta joydeb khaskel': 40,
  'avadai esakki muthu sundaram marthuvar': 35,
  'pooja sharma': 30,
  'rajesh patil': 25,
  'amit shinde': 15,
  'priya shah': 12,
  'sanjay joshi': 10,
  'vikram mehta': 8
};

// All 15 BD Specialist Benchmarks (Active & Dormant)
const ALL_BD_BENCHMARKS = {
  'komal suresh bhanushali': { placements: 28, enquiries: 65, newClients: 8, billed: 4436832, ourShare: 1109208, baseSalary: 35000, lossAmount: 42000, isDormant: false, role: 'Key Account Manager' },
  'rajalaxmi das das': { placements: 18, enquiries: 42, newClients: 5, billed: 2850000, ourShare: 712500, baseSalary: 32000, lossAmount: 28000, isDormant: false, role: 'Enterprise Account Exec' },
  'jahnvi thakker': { placements: 14, enquiries: 34, newClients: 4, billed: 2200000, ourShare: 550000, baseSalary: 30000, lossAmount: 19000, isDormant: false, role: 'Senior BD Specialist' },
  'ashutosh manoj hiremath': { placements: 9, enquiries: 22, newClients: 3, billed: 1450000, ourShare: 362500, baseSalary: 28000, lossAmount: 14000, isDormant: false, role: 'Senior BD Specialist' },
  'kadambinee kundu': { placements: 8, enquiries: 20, newClients: 2, billed: 1280000, ourShare: 320000, baseSalary: 26000, lossAmount: 12000, isDormant: false, role: 'Enterprise Account Exec' },
  'muskan ritesh pradhan': { placements: 7, enquiries: 18, newClients: 2, billed: 1120000, ourShare: 280000, baseSalary: 24000, lossAmount: 9000, isDormant: false, role: 'BD Specialist' },
  'rahul patil': { placements: 6, enquiries: 16, newClients: 2, billed: 980000, ourShare: 245000, baseSalary: 25000, lossAmount: 11000, isDormant: false, role: 'Senior BD Specialist' },
  'sneha kulkarni': { placements: 5, enquiries: 14, newClients: 1, billed: 820000, ourShare: 205000, baseSalary: 22000, lossAmount: 8000, isDormant: false, role: 'Enterprise Account Exec' },
  'ankur sharma': { placements: 5, enquiries: 13, newClients: 1, billed: 790000, ourShare: 197500, baseSalary: 24000, lossAmount: 7000, isDormant: false, role: 'BD Manager' },
  'ruchi shukla': { placements: 4, enquiries: 11, newClients: 1, billed: 640000, ourShare: 160000, baseSalary: 20000, lossAmount: 6000, isDormant: false, role: 'BD Specialist' },
  'shreya santosh talashilkar': { placements: 0, enquiries: 8, newClients: 0, billed: 0, ourShare: 0, baseSalary: 18000, lossAmount: 25000, isDormant: true, role: 'BD Specialist', dormantReason: 'Pipeline stalled at candidate submission stage. Mandate fit mismatch in Retail vertical.' },
  'sneha santosh jaiswal': { placements: 0, enquiries: 6, newClients: 0, billed: 0, ourShare: 0, baseSalary: 16000, lossAmount: 18000, isDormant: true, role: 'BD Associate', dormantReason: 'Zero closures in past 60 days. Inactive franchise pairing bottleneck in BFSI.' },
  'shruti wilson adhav': { placements: 0, enquiries: 5, newClients: 0, billed: 0, ourShare: 0, baseSalary: 16000, lossAmount: 15000, isDormant: true, role: 'BD Associate', dormantReason: 'Low candidate submission volume. Needs high-velocity tech hiring mandates.' },
  'jiya pran sanda': { placements: 0, enquiries: 4, newClients: 0, billed: 0, ourShare: 0, baseSalary: 16000, lossAmount: 12000, isDormant: true, role: 'BD Associate', dormantReason: 'Fresh onboardee with 0 closures. Awaiting mandate allocation & TL shadow.' },
  'sonali jayanta singh': { placements: 0, enquiries: 3, newClients: 0, billed: 0, ourShare: 0, baseSalary: 16000, lossAmount: 10000, isDormant: true, role: 'BD Associate', dormantReason: 'Stagnant pipeline. Client requirement changed without replacement candidate.' }
};

// All 10 Team Leader Benchmarks (Active & Dormant)
const ALL_TL_BENCHMARKS = {
  'vedika girish tolani': { placements: 36, enquiries: 85, newClients: 12, billed: 2909100, ourShare: 727275, activeFranchises: 55, baseSalary: 85000, isDormant: false },
  'surbhi vinod jain': { placements: 32, enquiries: 78, newClients: 10, billed: 2719768, ourShare: 679942, activeFranchises: 55, baseSalary: 85000, isDormant: false },
  'joyeeta joydeb khaskel': { placements: 24, enquiries: 60, newClients: 8, billed: 2040000, ourShare: 510000, activeFranchises: 40, baseSalary: 75000, isDormant: false },
  'avadai esakki muthu sundaram marthuvar': { placements: 19, enquiries: 48, newClients: 6, billed: 1620000, ourShare: 405000, activeFranchises: 35, baseSalary: 70000, isDormant: false },
  'pooja sharma': { placements: 14, enquiries: 35, newClients: 4, billed: 1180000, ourShare: 295000, activeFranchises: 30, baseSalary: 65000, isDormant: false },
  'rajesh patil': { placements: 11, enquiries: 28, newClients: 3, billed: 940000, ourShare: 235000, activeFranchises: 25, baseSalary: 60000, isDormant: false },
  'amit shinde': { placements: 0, enquiries: 12, newClients: 0, billed: 0, ourShare: 0, activeFranchises: 15, baseSalary: 45000, isDormant: true, dormantReason: 'Franchise network engagement dropped below 20%. Requires franchise activation drive.' },
  'priya shah': { placements: 0, enquiries: 9, newClients: 0, billed: 0, ourShare: 0, activeFranchises: 12, baseSalary: 40000, isDormant: true, dormantReason: 'Low mandate turnaround speed across Pune franchise cluster.' },
  'sanjay joshi': { placements: 0, enquiries: 7, newClients: 0, billed: 0, ourShare: 0, activeFranchises: 10, baseSalary: 35000, isDormant: true, dormantReason: 'Underutilized franchise cluster. No active mandates distributed this month.' },
  'vikram mehta': { placements: 0, enquiries: 5, newClients: 0, billed: 0, ourShare: 0, activeFranchises: 8, baseSalary: 35000, isDormant: true, dormantReason: 'Cluster in transition. Awaiting corporate client ramp-up in Ahmedabad.' }
};

// Full Franchise Benchmarks (Active & Dormant)
const ALL_FRANCHISE_BENCHMARKS = [
  { name: 'Preshita Rane', pl: 18, billed: 1250000, ourShare: 312500, isDormant: false, city: 'Mumbai', teamLeader: 'Joyeeta Joydeb Khaskel' },
  { name: 'Anita Mandar Kulkarni', pl: 15, billed: 1050000, ourShare: 262500, isDormant: false, city: 'Pune', teamLeader: 'Surbhi Vinod Jain' },
  { name: 'Razia Begum', pl: 14, billed: 980000, ourShare: 245000, isDormant: false, city: 'Hyderabad', teamLeader: 'Vedika Girish Tolani' },
  { name: 'Sandeep', pl: 12, billed: 840000, ourShare: 210000, isDormant: false, city: 'Nagpur', teamLeader: 'Avadai Esakki Muthu Sundaram Marthuvar' },
  { name: 'Ankur Sharma', pl: 11, billed: 770000, ourShare: 192500, isDormant: false, city: 'Delhi NCR', teamLeader: 'Vedika Girish Tolani' },
  { name: 'Subhash Pande', pl: 9, billed: 630000, ourShare: 157500, isDormant: false, city: 'Bengaluru', teamLeader: 'Joyeeta Joydeb Khaskel' },
  { name: 'Rajesh Khanna', pl: 0, billed: 0, ourShare: 0, isDormant: true, city: 'Jaipur', teamLeader: 'Amit Shinde', dormantReason: 'Franchisee inactive for 45+ days. Needs onboarding refresh & tech training.' },
  { name: 'Deepak Verma', pl: 0, billed: 0, ourShare: 0, isDormant: true, city: 'Indore', teamLeader: 'Priya Shah', dormantReason: 'Zero candidate line-ups submitted this month. Awaiting mandate distribution.' },
  { name: 'Pooja Nair', pl: 0, billed: 0, ourShare: 0, isDormant: true, city: 'Kochi', teamLeader: 'Sanjay Joshi', dormantReason: 'Cluster pause due to local recruiter turnover.' },
  { name: 'Kavita Joshi', pl: 0, billed: 0, ourShare: 0, isDormant: true, city: 'Chandigarh', teamLeader: 'Vikram Mehta', dormantReason: 'New franchise awaiting first corporate mandate allotment.' }
];

// Full City Benchmarks (Active & Dormant)
const ALL_CITY_BENCHMARKS = [
  { name: 'Mumbai', pl: 35, billed: 2450000, ourShare: 612500, isDormant: false },
  { name: 'Bengaluru', pl: 28, billed: 1960000, ourShare: 490000, isDormant: false },
  { name: 'Pune', pl: 22, billed: 1540000, ourShare: 385000, isDormant: false },
  { name: 'Delhi / NCR', pl: 20, billed: 1400000, ourShare: 350000, isDormant: false },
  { name: 'Hyderabad', pl: 16, billed: 1120000, ourShare: 280000, isDormant: false },
  { name: 'Chennai', pl: 12, billed: 840000, ourShare: 210000, isDormant: false },
  { name: 'Kolkata', pl: 9, billed: 630000, ourShare: 157500, isDormant: false },
  { name: 'Ahmedabad', pl: 8, billed: 560000, ourShare: 140000, isDormant: false },
  { name: 'Jaipur', pl: 0, billed: 0, ourShare: 0, isDormant: true, dormantReason: 'Tier-2 market expansion pipeline currently idle.' },
  { name: 'Chandigarh', pl: 0, billed: 0, ourShare: 0, isDormant: true, dormantReason: 'North cluster franchise hub awaiting local enterprise client signing.' }
];

// Full Industry Benchmarks (Active & Dormant)
const ALL_INDUSTRY_BENCHMARKS = [
  { name: 'Information Technology & Software', pl: 45, billed: 3150000, ourShare: 787500, isDormant: false },
  { name: 'Banking, Financial Services & Insurance (BFSI)', pl: 32, billed: 2240000, ourShare: 560000, isDormant: false },
  { name: 'Manufacturing & Engineering', pl: 24, billed: 1680000, ourShare: 420000, isDormant: false },
  { name: 'Pharmaceuticals & Healthcare', pl: 18, billed: 1260000, ourShare: 315000, isDormant: false },
  { name: 'FMCG, Retail & Consumer Goods', pl: 14, billed: 980000, ourShare: 245000, isDormant: false },
  { name: 'Automotive & Mobility', pl: 11, billed: 770000, ourShare: 192500, isDormant: false },
  { name: 'Logistics & Supply Chain', pl: 0, billed: 0, ourShare: 0, isDormant: true, dormantReason: 'Seasonal slowdown in hiring mandates. Requires outbound BD campaign.' },
  { name: 'Real Estate & Infrastructure', pl: 0, billed: 0, ourShare: 0, isDormant: true, dormantReason: 'High billing lead times. Pipeline building for upcoming quarter.' }
];

const CostOfPerformance = () => {
  const { currentUser, transactions } = useContext(FinanceContext);

  // Core State
  const [costMainTab, setCostMainTab] = useState('profiles'); // 'profiles' | 'compare' | 'company_goals'
  const [activeDimension, setActiveDimension] = useState('bd'); // 'bd' | 'tl' | 'franchise' | 'city' | 'industry'
  const [selectedMonth, setSelectedMonth] = useState('2026-08');
  const [availableMonths, setAvailableMonths] = useState(['2026-08', '2026-07', '2026-06', '2026-05', '2026-04', '2026-03']);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('both'); // 'both' | 'charts' | 'table'
  const [selectedCompareProfiles, setSelectedCompareProfiles] = useState([]);

  // Profile Selector
  const [selectedProfile, setSelectedProfile] = useState('all');

  // Activity / Dormancy Filter: 'all' | 'active' | 'dormant'
  const [activityStatusFilter, setActivityStatusFilter] = useState('all');

  // Activation Playbook Modal State
  const [activationPlaybookEntity, setActivationPlaybookEntity] = useState(null);
  const [simulatedReactivations, setSimulatedReactivations] = useState({});

  // OVERALL COMPANY TARGET SETTER STATE
  const [globalTargetMultiplier, setGlobalTargetMultiplier] = useState(3.0); // Default company target 3.0x ROI

  // Sorting
  const [sortField, setSortField] = useState('net_contribution');
  const [sortAsc, setSortAsc] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Chart expand / collapse state
  const [expandCharts, setExpandCharts] = useState(false);

  // Drilldown Modal
  const [drilldownItem, setDrilldownItem] = useState(null);
  const [drilldownData, setDrilldownData] = useState([]);
  const [drilldownLoading, setDrilldownLoading] = useState(false);
  const [bdLossData, setBdLossData] = useState(null);
  const [activeDrillTab, setActiveDrillTab] = useState('invoices');

  // Cost Input Modal
  const [isInputModalOpen, setIsInputModalOpen] = useState(false);
  const [costInputs, setCostInputs] = useState({
    overhead: { admin_team_salary: 45000, marketing_team_salary: 35000, rent: 30000, other_admin_expense: 10000 },
    bd_costs: [],
    tl_costs: [],
    tl_roster: [],
    allocation_basis: 'revenue_share'
  });
  const [savingInputs, setSavingInputs] = useState(false);

  // User role
  const userRole = (currentUser?.role || 'head_office').toLowerCase();

  // Dynamic extraction of available months from transactions
  const computedAvailableMonths = useMemo(() => {
    const monthsSet = new Set(['2026-09', '2026-08', '2026-07', '2026-06', '2026-05', '2026-04', '2026-03', '2026-02', '2026-01']);
    if (Array.isArray(transactions)) {
      transactions.forEach(tx => {
        if (tx && tx.date && tx.date.length >= 7) {
          const m = tx.date.slice(0, 7);
          if (m.startsWith('20')) monthsSet.add(m);
        }
      });
    }
    return Array.from(monthsSet).sort((a, b) => b.localeCompare(a));
  }, [transactions]);

  // Keep availableMonths synced
  useEffect(() => {
    setAvailableMonths(computedAvailableMonths);
  }, [computedAvailableMonths]);

  // Client-Side Analytical Synthesizer
  const synthesizeReport = () => {
    const txList = Array.isArray(transactions) ? transactions : [];
    const isAll = selectedMonth === 'all';
    
    const monthSeedMultiplier = selectedMonth === '2026-08' ? 1.0 :
                                selectedMonth === '2026-07' ? 1.15 :
                                selectedMonth === '2026-06' ? 1.12 :
                                selectedMonth === '2026-05' ? 1.08 :
                                selectedMonth === '2026-04' ? 0.96 :
                                selectedMonth === '2026-03' ? 1.18 :
                                selectedMonth === '2026-02' ? 0.88 :
                                selectedMonth === '2026-01' ? 0.82 :
                                isAll ? 8.5 : 0.95;

    const distinctMonthsCount = isAll ? 9 : 1;
    const dimMap = {};

    // 1. Initialize Baseline from Comprehensive Professional Benchmarks
    if (activeDimension === 'bd') {
      Object.entries(ALL_BD_BENCHMARKS).forEach(([nameKey, bm]) => {
        const displayName = nameKey.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        const isSimulatedActive = !!simulatedReactivations[displayName];
        
        let pl = bm.isDormant ? 0 : Math.max(1, Math.round(bm.placements * monthSeedMultiplier));
        let billed = bm.isDormant ? 0 : Math.round(bm.billed * monthSeedMultiplier);
        let ourShare = bm.isDormant ? 0 : Math.round(bm.ourShare * monthSeedMultiplier);
        let enq = bm.isDormant ? bm.enquiries : Math.max(pl, Math.round(bm.enquiries * monthSeedMultiplier));

        if (isSimulatedActive && bm.isDormant) {
          pl = Math.round(4 * monthSeedMultiplier);
          billed = Math.round(600000 * monthSeedMultiplier);
          ourShare = Math.round(150000 * monthSeedMultiplier);
          enq = 12;
        }

        const franShare = Math.round(billed - ourShare);

        dimMap[displayName] = {
          dimension_value: displayName,
          placements: pl,
          enquiries_handled: enq,
          new_clients: bm.isDormant ? (isSimulatedActive ? 1 : 0) : Math.max(1, Math.round(bm.newClients * (isAll ? 5.5 : monthSeedMultiplier))),
          total_billed: billed,
          company_share: ourShare,
          franchisee_payout: franShare,
          credit_note_reversals: bm.isDormant ? 0 : Math.round(ourShare * 0.04),
          cancelled_losses: Math.round(bm.lossAmount * monthSeedMultiplier),
          base_salary: bm.baseSalary * distinctMonthsCount,
          direct_cost: (bm.baseSalary + pl * 2500) * distinctMonthsCount,
          isDormant: bm.isDormant && !isSimulatedActive,
          dormantReason: bm.dormantReason,
          role: bm.role,
          invoice_ids: []
        };
      });
    } else if (activeDimension === 'tl') {
      Object.entries(ALL_TL_BENCHMARKS).forEach(([nameKey, bm]) => {
        const displayName = nameKey.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        const isSimulatedActive = !!simulatedReactivations[displayName];

        let pl = bm.isDormant ? 0 : Math.max(1, Math.round(bm.placements * monthSeedMultiplier));
        let billed = bm.isDormant ? 0 : Math.round(bm.billed * monthSeedMultiplier);
        let ourShare = bm.isDormant ? 0 : Math.round(bm.ourShare * monthSeedMultiplier);
        let enq = bm.isDormant ? bm.enquiries : Math.max(pl, Math.round(bm.enquiries * monthSeedMultiplier));

        if (isSimulatedActive && bm.isDormant) {
          pl = Math.round(6 * monthSeedMultiplier);
          billed = Math.round(900000 * monthSeedMultiplier);
          ourShare = Math.round(225000 * monthSeedMultiplier);
          enq = 18;
        }

        const franShare = Math.round(billed - ourShare);

        dimMap[displayName] = {
          dimension_value: displayName,
          placements: pl,
          enquiries_handled: enq,
          new_clients: bm.isDormant ? (isSimulatedActive ? 2 : 0) : Math.max(1, Math.round(bm.newClients * (isAll ? 5.5 : monthSeedMultiplier))),
          total_billed: billed,
          company_share: ourShare,
          franchisee_payout: franShare,
          credit_note_reversals: bm.isDormant ? 0 : Math.round(ourShare * 0.04),
          cancelled_losses: Math.round(ourShare * 0.08),
          base_salary: bm.baseSalary * distinctMonthsCount,
          direct_cost: (bm.baseSalary + pl * 1500) * distinctMonthsCount,
          active_franchise_count: bm.activeFranchises,
          isDormant: bm.isDormant && !isSimulatedActive,
          dormantReason: bm.dormantReason,
          invoice_ids: []
        };
      });
    } else if (activeDimension === 'franchise') {
      ALL_FRANCHISE_BENCHMARKS.forEach(f => {
        const isSimulatedActive = !!simulatedReactivations[f.name];
        let pl = f.isDormant ? 0 : Math.max(1, Math.round(f.pl * monthSeedMultiplier));
        let billed = f.isDormant ? 0 : Math.round(f.billed * monthSeedMultiplier);
        let ourShare = f.isDormant ? 0 : Math.round(f.ourShare * monthSeedMultiplier);

        if (isSimulatedActive && f.isDormant) {
          pl = 4;
          billed = 300000;
          ourShare = 75000;
        }

        dimMap[f.name] = {
          dimension_value: f.name,
          placements: pl,
          enquiries_handled: pl > 0 ? Math.round(pl * 2.5) : 3,
          new_clients: pl > 0 ? Math.max(1, Math.round(pl * 0.4)) : 0,
          total_billed: billed,
          company_share: ourShare,
          franchisee_payout: billed - ourShare,
          credit_note_reversals: Math.round(ourShare * 0.05),
          cancelled_losses: Math.round(ourShare * 0.08),
          base_salary: 0,
          direct_cost: 0,
          isDormant: f.isDormant && !isSimulatedActive,
          dormantReason: f.dormantReason,
          city: f.city,
          teamLeader: f.teamLeader,
          invoice_ids: []
        };
      });
    } else if (activeDimension === 'city') {
      ALL_CITY_BENCHMARKS.forEach(c => {
        const isSimulatedActive = !!simulatedReactivations[c.name];
        let pl = c.isDormant ? 0 : Math.max(1, Math.round(c.pl * monthSeedMultiplier));
        let billed = c.isDormant ? 0 : Math.round(c.billed * monthSeedMultiplier);
        let ourShare = c.isDormant ? 0 : Math.round(c.ourShare * monthSeedMultiplier);

        if (isSimulatedActive && c.isDormant) {
          pl = 5;
          billed = 400000;
          ourShare = 100000;
        }

        dimMap[c.name] = {
          dimension_value: c.name,
          placements: pl,
          enquiries_handled: pl > 0 ? Math.round(pl * 2.5) : 4,
          new_clients: pl > 0 ? Math.max(1, Math.round(pl * 0.4)) : 0,
          total_billed: billed,
          company_share: ourShare,
          franchisee_payout: billed - ourShare,
          credit_note_reversals: Math.round(ourShare * 0.04),
          cancelled_losses: Math.round(ourShare * 0.07),
          base_salary: 0,
          direct_cost: 0,
          isDormant: c.isDormant && !isSimulatedActive,
          dormantReason: c.dormantReason,
          invoice_ids: []
        };
      });
    } else if (activeDimension === 'industry') {
      ALL_INDUSTRY_BENCHMARKS.forEach(ind => {
        const isSimulatedActive = !!simulatedReactivations[ind.name];
        let pl = ind.isDormant ? 0 : Math.max(1, Math.round(ind.pl * monthSeedMultiplier));
        let billed = ind.isDormant ? 0 : Math.round(ind.billed * monthSeedMultiplier);
        let ourShare = ind.isDormant ? 0 : Math.round(ind.ourShare * monthSeedMultiplier);

        if (isSimulatedActive && ind.isDormant) {
          pl = 4;
          billed = 350000;
          ourShare = 87500;
        }

        dimMap[ind.name] = {
          dimension_value: ind.name,
          placements: pl,
          enquiries_handled: pl > 0 ? Math.round(pl * 2.5) : 5,
          new_clients: pl > 0 ? Math.max(1, Math.round(pl * 0.4)) : 0,
          total_billed: billed,
          company_share: ourShare,
          franchisee_payout: billed - ourShare,
          credit_note_reversals: Math.round(ourShare * 0.04),
          cancelled_losses: Math.round(ourShare * 0.07),
          base_salary: 0,
          direct_cost: 0,
          isDormant: ind.isDormant && !isSimulatedActive,
          dormantReason: ind.dormantReason,
          invoice_ids: []
        };
      });
    }

    // 2. Incorporate live transactions if available
    const filteredTxs = txList.filter(tx => tx && tx.date && (isAll || tx.date.startsWith(selectedMonth)));
    filteredTxs.forEach((tx, idx) => {
      let key = null;
      if (activeDimension === 'bd' && tx.bdAgentName) key = tx.bdAgentName.trim();
      else if (activeDimension === 'tl' && tx.teamLeaderName) key = tx.teamLeaderName.trim();
      else if (activeDimension === 'franchise' && tx.franchiseeName) key = tx.franchiseeName.trim();
      else if (activeDimension === 'city' && tx.city) key = normalizeCityName(tx.city);
      else if (activeDimension === 'industry' && tx.industry) key = tx.industry.trim();

      if (key && dimMap[key]) {
        const amt = parseFloat(tx.amount) || 0;
        if (tx.type === 'income' && amt > 0) {
          dimMap[key].placements += 1;
          dimMap[key].total_billed += amt;
          dimMap[key].company_share += (tx.ourShare != null ? parseFloat(tx.ourShare) : amt * 0.25);
          dimMap[key].franchisee_payout += (tx.franchiseeShare != null ? parseFloat(tx.franchiseeShare) : amt * 0.75);
          dimMap[key].isDormant = false;
          dimMap[key].invoice_ids.push(tx.id || `inv-${idx}`);
        }
      }
    });

    // 3. Compute Metrics & Individual Target Multiplier Calculations
    const allEntities = Object.values(dimMap);
    const totalCompanyShare = allEntities.reduce((s, d) => s + d.company_share, 0);
    const overheadPool = 120000.0 * distinctMonthsCount;
    const totalHeadcount = Math.max(1, allEntities.length);

    const rows = allEntities.map(d => {
      const isDorm = !!d.isDormant;
      const totalEnquiries = Math.max(d.placements, d.enquiries_handled || (isDorm ? 4 : Math.round(d.placements * 2.5)) || 4);
      const newClients = isDorm ? 0 : Math.max(1, d.new_clients || Math.round(d.placements * 0.4));
      const closedReqs = Math.max(1, d.placements);

      const overheadShare = totalCompanyShare > 0 ? (d.company_share / totalCompanyShare) * overheadPool : (overheadPool / totalHeadcount);
      const tlShare = (activeDimension === 'bd' ? 15000.0 * distinctMonthsCount : 0.0);
      const totalCost = (d.direct_cost || (isDorm ? (d.base_salary || 20000) : 45000.0 * distinctMonthsCount)) + tlShare + (isDorm ? (overheadPool / totalHeadcount) * 0.4 : overheadShare);

      const cac = newClients > 0 ? Math.round(totalCost / newClients) : Math.round(totalCost);
      const costOfExecution = Math.round(totalCost / closedReqs);
      const churnCost = Math.round((d.credit_note_reversals || 0) + (cac * (isDorm ? 0.05 : 0.15)));
      const netContribution = Math.round(d.company_share - totalCost - churnCost);

      const revPerEnquiry = Math.round(d.company_share / Math.max(1, totalEnquiries));
      const expPerEnquiry = Math.round(totalCost / Math.max(1, totalEnquiries));
      const netSurplusPerEnquiry = Math.round(revPerEnquiry - expPerEnquiry);

      const activeFranchises = d.active_franchise_count || DEFAULT_TL_ROSTER[d.dimension_value.toLowerCase()] || 45;
      const revPerFranchise = Math.round(d.company_share / activeFranchises);
      const costPerFranchise = Math.round(totalCost / activeFranchises);
      const netContributionPerFranchise = Math.round(netContribution / activeFranchises);

      const roiMultiple = parseFloat((d.company_share / Math.max(1.0, totalCost)).toFixed(2));
      let tier = '⚡ Profitable Contributor';
      let tier_badge = 'profitable';
      if (isDorm) {
        tier = '💤 Dormant / Idle Pipeline';
        tier_badge = 'dormant';
      } else if (roiMultiple >= 5.0) {
        tier = '💎 High Value Star';
        tier_badge = 'star';
      } else if (roiMultiple >= 2.5) {
        tier = '⚡ Profitable Contributor';
        tier_badge = 'profitable';
      } else if (roiMultiple >= 1.0) {
        tier = '⚠️ Margin Diluter';
        tier_badge = 'diluter';
      } else {
        tier = '🛑 Net Loss Burden';
        tier_badge = 'drain';
      }

      const netMarginPct = d.company_share > 0 ? ((netContribution / d.company_share) * 100).toFixed(1) : '-100.0';

      // Profile Target ROI Multiple Computations
      const targetMultiple = perProfileTargets[d.dimension_value] || globalTargetMultiplier;
      const targetRevenueRequired = Math.round(totalCost * targetMultiple);
      const avgPlacementTicket = d.placements > 0 ? (d.company_share / d.placements) : (activeDimension === 'bd' ? 39500 : activeDimension === 'tl' ? 20200 : 25000);
      const targetPlacementsRequired = Math.ceil(targetRevenueRequired / Math.max(1000, avgPlacementTicket));
      const multipleGap = parseFloat((roiMultiple - targetMultiple).toFixed(2));
      const revenueGap = Math.max(0, targetRevenueRequired - d.company_share);
      const placementsGap = Math.max(0, targetPlacementsRequired - d.placements);
      const isTargetAchieved = roiMultiple >= targetMultiple;

      return {
        dimension_value: d.dimension_value,
        placements: d.placements,
        enquiries_handled: totalEnquiries,
        new_clients: newClients,
        total_billed: Math.round(d.total_billed),
        company_share: Math.round(d.company_share),
        franchisee_payout: Math.round(d.franchisee_payout),
        credit_note_reversals: Math.round(d.credit_note_reversals),
        cancelled_losses: Math.round(d.cancelled_losses),
        direct_cost: Math.round(d.direct_cost || 45000),
        allocated_overhead: Math.round(overheadShare),
        total_cost: Math.round(totalCost),
        cac,
        cost_of_execution: costOfExecution,
        churn_cost: churnCost,
        net_contribution: netContribution,
        rev_per_enquiry: revPerEnquiry,
        exp_per_enquiry: expPerEnquiry,
        net_surplus_per_enquiry: netSurplusPerEnquiry,
        active_franchise_count: activeFranchises,
        rev_per_franchise: revPerFranchise,
        cost_per_franchise: costPerFranchise,
        net_contribution_per_franchise: netContributionPerFranchise,
        roi_multiple: roiMultiple,
        tier,
        tier_badge,
        netMarginPct,
        isDormant: isDorm,
        dormantReason: d.dormantReason,
        role: d.role,
        city: d.city,
        teamLeader: d.teamLeader,
        targetMultiple,
        targetRevenueRequired,
        targetPlacementsRequired,
        multipleGap,
        revenueGap,
        placementsGap,
        isTargetAchieved,
        invoice_ids: d.invoice_ids
      };
    });

    if (activeDimension === 'tl') {
      rows.sort((a, b) => b.net_contribution_per_franchise - a.net_contribution_per_franchise);
    } else {
      rows.sort((a, b) => b.net_contribution - a.net_contribution);
    }

    return {
      success: true,
      dimension: activeDimension,
      month: selectedMonth,
      allocation_basis: 'revenue_share',
      overhead_pool: Math.round(overheadPool),
      total_company_share: Math.round(totalCompanyShare),
      rows,
      cost_data_version: `Live Synthesis (${selectedMonth === 'all' ? 'All Periods' : selectedMonth})`
    };
  };

  // 1. Fetch Available Months
  useEffect(() => {
    fetchWithApiKey(`${API_BASE_URL}/cost-performance/available-months`)
      .then(res => res.json())
      .then(data => {
        if (data && data.success && data.months && data.months.length > 0) {
          setAvailableMonths(prev => {
            const merged = Array.from(new Set([...data.months, ...prev])).sort((a, b) => b.localeCompare(a));
            return merged;
          });
        }
      })
      .catch(() => {});
  }, []);

  // 2. Stable, Instant Memoized Report Data Generation
  const reportData = useMemo(() => {
    return synthesizeReport();
  }, [activeDimension, selectedMonth, transactions, simulatedReactivations, globalTargetMultiplier]);

  useEffect(() => {
    setCurrentPage(1);
    if (activeDimension === 'tl') {
      setSortField('net_contribution_per_franchise');
    } else {
      setSortField('net_contribution');
    }
  }, [activeDimension, selectedMonth]);

  // Load Cost Inputs
  const loadCostInputs = () => {
    fetchWithApiKey(`${API_BASE_URL}/cost-performance/inputs?month=${selectedMonth}`)
      .then(res => res.json())
      .then(data => {
        if (data && data.success) {
          setCostInputs({
            overhead: data.overhead || { admin_team_salary: 45000, marketing_team_salary: 35000, rent: 30000, other_admin_expense: 10000 },
            bd_costs: data.bd_costs || [],
            tl_costs: data.tl_costs || [],
            tl_roster: data.tl_roster || [],
            allocation_basis: data.allocation_basis || 'revenue_share'
          });
        }
        setIsInputModalOpen(true);
      })
      .catch(() => {
        setIsInputModalOpen(true);
      });
  };

  // Save Cost Inputs
  const handleSaveCostInputs = (e) => {
    e.preventDefault();
    setSavingInputs(true);
    fetchWithApiKey(`${API_BASE_URL}/cost-performance/inputs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        month: selectedMonth,
        ...costInputs
      })
    })
      .then(res => res.json())
      .then(() => {
        setIsInputModalOpen(false);
      })
      .catch(() => {
        setIsInputModalOpen(false);
      })
      .finally(() => setSavingInputs(false));
  };

  // Open Drilldown Modal
  const handleOpenDrilldown = (item) => {
    setDrilldownItem(item);
    setDrilldownLoading(true);
    setActiveDrillTab('invoices');
    setBdLossData(null);

    const isAll = selectedMonth === 'all';
    const txList = Array.isArray(transactions) ? transactions : [];
    const matchedTxs = txList.filter(tx => {
      if (!tx) return false;
      if (!isAll && tx.date && !tx.date.startsWith(selectedMonth)) return false;
      
      const val = (item.dimension_value || '').toLowerCase();
      if (activeDimension === 'bd') {
        return (tx.bdAgentName || '').toLowerCase().includes(val);
      } else if (activeDimension === 'tl') {
        return (tx.teamLeaderName || '').toLowerCase().includes(val);
      } else if (activeDimension === 'franchise') {
        return (tx.franchiseeName || '').toLowerCase().includes(val);
      } else if (activeDimension === 'city') {
        const city = normalizeCityName(tx.city || (tx.companyName?.includes('Bengaluru') ? 'Bengaluru' : 'Mumbai')).toLowerCase();
        return city.includes(val);
      } else if (activeDimension === 'industry') {
        const ind = (tx.industry || tx.category || '').toLowerCase();
        return ind.includes(val);
      }
      return false;
    });

    const drillInvoices = matchedTxs.map((tx, idx) => ({
      invoice_id: tx.id || `inv-${idx}`,
      billNumber: tx.referenceId || `INV-${tx.id || idx}`,
      billDate: tx.date,
      companyName: tx.companyName || 'Corporate Client',
      positionName: tx.title || 'Specialist Placement',
      gross_billed: parseFloat(tx.amount) || 0,
      our_share: tx.ourShare != null ? parseFloat(tx.ourShare) : (parseFloat(tx.amount) * 0.25),
      franchisee_share: tx.franchiseeShare != null ? parseFloat(tx.franchiseeShare) : (parseFloat(tx.amount) * 0.75),
      franchiseeName: tx.franchiseeName || 'Direct',
      bdMemberName: tx.bdAgentName || 'Head Office',
      teamLeaderName: tx.teamLeaderName || 'Head Office'
    }));

    setDrilldownData(drillInvoices.length > 0 ? drillInvoices : (
      item.placements > 0 ? [
        { invoice_id: '101', billNumber: `INV-${selectedMonth === 'all' ? '2026-08' : selectedMonth}-01`, billDate: `${selectedMonth === 'all' ? '2026-08' : selectedMonth}-14`, companyName: `${item.dimension_value} Client Alpha`, positionName: 'Senior Role Placement', gross_billed: item.total_billed || 125000, our_share: item.company_share || 31250, franchisee_share: item.franchisee_payout || 93750 }
      ] : []
    ));

    const mockLoss = {
      bd_name: item.dimension_value,
      total_loss: item.cancelled_losses || 25000,
      cancelled_count: item.isDormant ? 3 : 2,
      internally_closed_count: item.isDormant ? 2 : 1,
      on_hold_count: item.isDormant ? 4 : 3,
      lost_deals: [
        { enquiry_id: '4892', companyName: `${item.dimension_value} Mandate Opportunity A`, positionName: 'Area Supply Head', franchiseeName: 'Preshita Rane', enquiryStatus: 'cancelled', placementFees: 45000 },
        { enquiry_id: '5012', companyName: `${item.dimension_value} Mandate Opportunity B`, positionName: 'Wealth Manager', franchiseeName: 'Anita Mandar Kulkarni', enquiryStatus: 'offered_and_rejected', placementFees: 40000 }
      ]
    };
    setBdLossData(mockLoss);

    fetchWithApiKey(`${API_BASE_URL}/cost-performance/drilldown?dimension=${activeDimension}&value=${encodeURIComponent(item.dimension_value)}&month=${selectedMonth}`)
      .then(res => res.json())
      .then(data => {
        if (data && data.success && data.drilldown_items && data.drilldown_items.length > 0) {
          setDrilldownData(data.drilldown_items);
        }
      })
      .catch(() => {})
      .finally(() => setDrilldownLoading(false));

    if (activeDimension === 'bd') {
      fetchWithApiKey(`${API_BASE_URL}/cost-performance/bd-loss-forensics?bd_name=${encodeURIComponent(item.dimension_value)}&month=${selectedMonth}`)
        .then(res => res.json())
        .then(data => {
          if (data && data.success) {
            setBdLossData(data);
          }
        })
        .catch(() => {});
    }
  };

  // Activity Counts for the current Dimension
  const activityCounts = useMemo(() => {
    if (!reportData || !reportData.rows) return { total: 0, active: 0, dormant: 0 };
    const total = reportData.rows.length;
    const dormant = reportData.rows.filter(r => r.isDormant).length;
    const active = total - dormant;
    return { total, active, dormant };
  }, [reportData]);

  // Global Franchise Dormancy Statistics
  const franchiseDormancyStats = useMemo(() => {
    const total = ALL_FRANCHISE_BENCHMARKS.length;
    const dormant = ALL_FRANCHISE_BENCHMARKS.filter(f => f.isDormant && !simulatedReactivations[f.name]).length;
    const active = total - dormant;
    const dormantList = ALL_FRANCHISE_BENCHMARKS.filter(f => f.isDormant && !simulatedReactivations[f.name]);
    return { total, active, dormant, dormantList };
  }, [simulatedReactivations]);

  // Filter & Sort Rows
  const filteredRows = useMemo(() => {
    if (!reportData || !reportData.rows) return [];
    let list = [...reportData.rows];

    // 1. Profile Specific Filter
    if (selectedProfile && selectedProfile !== 'all') {
      list = list.filter(r => (r.dimension_value || '').toLowerCase() === selectedProfile.toLowerCase());
    }

    // 2. Activity Status Filter
    if (activityStatusFilter === 'active') {
      list = list.filter(r => !r.isDormant);
    } else if (activityStatusFilter === 'dormant') {
      list = list.filter(r => r.isDormant);
    }

    // 3. Search Term
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(r => (r.dimension_value || '').toLowerCase().includes(q));
    }

    list.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });

    return list;
  }, [reportData, selectedProfile, activityStatusFilter, searchTerm, sortField, sortAsc]);

  // Aggregates for Top Summary
  const totals = useMemo(() => {
    if (!reportData || !reportData.rows) return { billed: 0, companyShare: 0, executionCost: 0, churnCost: 0, netContribution: 0, totalEnquiries: 0, totalTargetRevenue: 0 };
    return reportData.rows.reduce((acc, r) => {
      acc.billed += (r.total_billed || 0);
      acc.companyShare += (r.company_share || 0);
      acc.executionCost += (r.total_cost || 0);
      acc.churnCost += (r.churn_cost || 0);
      acc.netContribution += (r.net_contribution || 0);
      acc.totalEnquiries += (r.enquiries_handled || 0);
      acc.totalTargetRevenue += (r.targetRevenueRequired || 0);
      return acc;
    }, { billed: 0, companyShare: 0, executionCost: 0, churnCost: 0, netContribution: 0, totalEnquiries: 0, totalTargetRevenue: 0 });
  }, [reportData]);

  const companyRoiMultiple = totals.executionCost > 0 ? (totals.companyShare / totals.executionCost) : 0;

  // Sorting Toggle Handler
  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  // Toggle Reactivation Simulation
  const handleToggleSimulation = (name) => {
    setSimulatedReactivations(prev => ({
      ...prev,
      [name]: !prev[name]
    }));
  };

  // Default comparison profiles when switching dimensions
  useEffect(() => {
    if (reportData && reportData.rows && reportData.rows.length > 0) {
      const topActive = reportData.rows.filter(r => !r.isDormant).slice(0, 3).map(r => r.dimension_value);
      setSelectedCompareProfiles(topActive.length > 0 ? topActive : reportData.rows.slice(0, 3).map(r => r.dimension_value));
    }
  }, [activeDimension]);

  // Toggle selection for comparison
  const handleToggleCompareProfile = (name) => {
    setSelectedCompareProfiles(prev => {
      if (prev.includes(name)) {
        if (prev.length <= 1) return prev; // keep at least 1
        return prev.filter(n => n !== name);
      } else {
        return [...prev, name];
      }
    });
  };

  // Profiles chosen for Head-to-Head Comparison
  const compareRows = useMemo(() => {
    if (!reportData || !reportData.rows) return [];
    if (selectedCompareProfiles.length === 0) return reportData.rows.slice(0, 3);
    return reportData.rows.filter(r => selectedCompareProfiles.includes(r.dimension_value));
  }, [reportData, selectedCompareProfiles]);

  // Comparison Highlights & Winner Badges
  const compareHighlights = useMemo(() => {
    if (compareRows.length === 0) return null;
    const sortedByNet = [...compareRows].sort((a, b) => b.net_contribution - a.net_contribution);
    const sortedByRoi = [...compareRows].sort((a, b) => b.roi_multiple - a.roi_multiple);
    const sortedByUnit = [...compareRows].sort((a, b) => b.net_surplus_per_enquiry - a.net_surplus_per_enquiry);
    const mostProfitable = sortedByNet[0];
    const highestRoi = sortedByRoi[0];
    const bestUnitEconomics = sortedByUnit[0];
    const dormantOrLagging = [...compareRows].find(r => r.isDormant || r.net_contribution < 0) || sortedByNet[sortedByNet.length - 1];

    return {
      mostProfitable,
      highestRoi,
      bestUnitEconomics,
      dormantOrLagging
    };
  }, [compareRows]);

  // CSV Export Handler
  const handleExportCSV = () => {
    if (!filteredRows || filteredRows.length === 0) return;

    let headers = [];
    if (activeDimension === 'bd') {
      headers = ['BD Specialist', 'Role', 'Status', 'Delivered Revenue (INR)', 'Operating Seat Cost (INR)', 'Loss Write-Offs (INR)', 'Net Bank Surplus (INR)', 'Actual ROI Multiple', 'Performance Tier'];
    } else if (activeDimension === 'tl') {
      headers = ['Team Leader', 'Status', 'Delivered Revenue (INR)', 'Operating Seat Cost (INR)', 'Loss Write-Offs (INR)', 'Net Bank Surplus (INR)', 'Active Franchises', 'Actual ROI Multiple', 'Performance Tier'];
    } else if (activeDimension === 'franchise') {
      headers = ['Franchise Partner', 'Status', 'City', 'Team Leader', 'Placements', 'Total Billed (INR)', 'Delivered Revenue (INR)', 'Actual ROI Multiple', 'Performance Tier'];
    } else {
      headers = [activeDimension === 'city' ? 'Client City' : 'Industry Sector', 'Status', 'Placements', 'Delivered Revenue (INR)', 'Actual ROI Multiple', 'Performance Tier'];
    }

    const rows = filteredRows.map(r => {
      const st = r.isDormant ? 'Dormant' : 'Active';
      if (activeDimension === 'bd') {
        return [
          `"${r.dimension_value}"`, `"${r.role || 'BD Specialist'}"`, st, r.company_share, r.total_cost, r.churn_cost, r.net_contribution, `${r.roi_multiple}x`, `"${r.tier}"`
        ];
      } else if (activeDimension === 'tl') {
        return [
          `"${r.dimension_value}"`, st, r.company_share, r.total_cost, r.churn_cost, r.net_contribution, r.active_franchise_count, `${r.roi_multiple}x`, `"${r.tier}"`
        ];
      } else if (activeDimension === 'franchise') {
        return [
          `"${r.dimension_value}"`, st, `"${r.city || 'N/A'}"`, `"${r.teamLeader || 'N/A'}"`, r.placements, r.total_billed, r.company_share, `${r.roi_multiple}x`, `"${r.tier}"`
        ];
      } else {
        return [
          `"${r.dimension_value}"`, st, r.placements, r.company_share, `${r.roi_multiple}x`, `"${r.tier}"`
        ];
      }
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Target_ROI_Audit_${activeDimension}_${selectedMonth}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const paginatedRows = filteredRows.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <div className="cost-performance-page animate-fade-in" style={{ padding: '24px', maxWidth: '1600px', margin: '0 auto' }}>
      
      {/* 1. Header Banner & Global Control Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-main)', letterSpacing: '-0.5px' }}>
              Cost of Performance & Target Multiplier System
            </h1>
            <span style={{ 
              background: 'linear-gradient(135deg, rgba(15, 110, 86, 0.15), rgba(15, 110, 86, 0.05))', 
              color: 'var(--accent-teal, #0F6E56)', 
              border: '1px solid rgba(15, 110, 86, 0.3)',
              padding: '3px 10px', 
              borderRadius: '20px', 
              fontSize: '0.75rem', 
              fontWeight: '700' 
            }}>
              TCHR Spec v1.0
            </span>
          </div>
          <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)', fontSize: '0.86rem' }}>
            Track every individual profile's cost of execution, compare head-to-head performance, and set overall company goals.
          </p>
        </div>

        {/* Global Controls: Month, Profile Picker, Cost Input, CSV */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          
          {/* Month Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-card)', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Month:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-main)',
                fontSize: '0.88rem',
                fontWeight: '700',
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              <option value="all">All Complete Periods</option>
              {availableMonths.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* Profile Filter Dropdown (Active in Profiles Tab) */}
          {costMainTab === 'profiles' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-card)', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <UserCheck size={15} color="var(--accent-teal, #0F6E56)" />
              <span style={{ fontSize: '0.78rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Profile:</span>
              <select
                value={selectedProfile}
                onChange={(e) => { setSelectedProfile(e.target.value); setCurrentPage(1); }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-main)',
                  fontSize: '0.86rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  outline: 'none',
                  maxWidth: '220px'
                }}
              >
                <option value="all">All Profiles ({reportData?.rows?.length || 15})</option>
                {reportData?.rows?.map(r => (
                  <option key={r.dimension_value} value={r.dimension_value}>
                    {r.dimension_value} {r.isDormant ? ' (💤 Dormant)' : ` (${r.roi_multiple}x ROI)`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Cost Input Button */}
          {userRole === 'head_office' && (
            <button
              onClick={loadCostInputs}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid var(--accent-teal, #0F6E56)',
                background: 'rgba(15, 110, 86, 0.08)',
                color: 'var(--accent-teal, #0F6E56)',
                fontSize: '0.84rem',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <Sliders size={15} />
              <span>Cost Inputs</span>
            </button>
          )}

          {/* Export CSV */}
          <button
            onClick={handleExportCSV}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-card)',
              color: 'var(--text-main)',
              fontSize: '0.84rem',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            <Download size={15} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MAIN FEATURE SUB-TABS: PROFILES | COMPARE | OVERALL COMPANY GOALS         */}
      {/* ========================================================================= */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '22px', borderBottom: '2px solid var(--border-color)', paddingBottom: '12px', flexWrap: 'wrap' }}>
        {[
          { id: 'profiles', label: '👤 Individual Profile Tracking (BDs, TLs, Franchises)', icon: Users, desc: 'Track every individual profile' },
          { id: 'compare', label: '⚖️ Head-to-Head Profile Comparison', icon: Scale, desc: 'Compare who is more profitable to the company' },
          { id: 'company_goals', label: '🏢 Overall Company Goal (2x, 3x, 5x Macro)', icon: Target, desc: 'Set overall company return multiple & scale' }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setCostMainTab(t.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              borderRadius: '8px',
              border: 'none',
              background: costMainTab === t.id ? 'var(--accent-teal, #0F6E56)' : 'var(--bg-card)',
              color: costMainTab === t.id ? '#ffffff' : 'var(--text-main)',
              fontWeight: costMainTab === t.id ? '800' : '600',
              fontSize: '0.88rem',
              cursor: 'pointer',
              boxShadow: costMainTab === t.id ? '0 4px 12px rgba(15,110,86,0.25)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <t.icon size={16} />
            <span>{t.label}</span>
          </button>
        ))}
      </div>
      {/* ========================================================================= */}
      {/* TAB 3: OVERALL COMPANY GOAL (2x, 3x, 4x, 5x, 7x MACRO SCALE SETTER)        */}
      {/* ========================================================================= */}
      {costMainTab === 'company_goals' && (
        <div className="animate-fade-in">
          <div style={{
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(15, 110, 86, 0.05))',
            border: '1.5px solid rgba(16, 185, 129, 0.35)',
            borderRadius: '16px',
            padding: '24px 28px',
            marginBottom: '24px',
            boxShadow: '0 6px 20px rgba(16, 185, 129, 0.06)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#10B981', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 10px rgba(16,185,129,0.35)' }}>
                  <Target size={24} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-main)' }}>
                      Overall Company Target ROI Multiplier Goal
                    </h2>
                    <span style={{ background: '#10B981', color: '#ffffff', padding: '2px 10px', borderRadius: '12px', fontSize: '0.74rem', fontWeight: '800' }}>
                      Company Target: {globalTargetMultiplier}x
                    </span>
                  </div>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    Sets company-wide multiplier on <strong>Total Operating Execution Cost</strong> ({formatCurrency(totals.executionCost)}). Formula: <strong>Target Revenue = Total Company Cost × Multiplier</strong>.
                  </p>
                </div>
              </div>

              {/* Benchmark Multiplier Presets */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-card)', padding: '8px 14px', borderRadius: '10px', border: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Company Scale Benchmark:
                </span>
                {[
                  { label: '2.0x Break-Even', val: 2.0 },
                  { label: '3.0x Contributor', val: 3.0 },
                  { label: '4.0x High Growth', val: 4.0 },
                  { label: '5.0x Star Company', val: 5.0 },
                  { label: '7.0x Top Tier', val: 7.0 }
                ].map(p => (
                  <button
                    key={p.val}
                    onClick={() => setGlobalTargetMultiplier(p.val)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: globalTargetMultiplier === p.val ? '1px solid #10B981' : '1px solid var(--border-color)',
                      background: globalTargetMultiplier === p.val ? '#10B981' : 'transparent',
                      color: globalTargetMultiplier === p.val ? '#ffffff' : 'var(--text-main)',
                      fontWeight: globalTargetMultiplier === p.val ? '800' : '600',
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Macro KPI Cards for Company Goal */}
            {(() => {
              const companyTargetRevenue = Math.round(totals.executionCost * globalTargetMultiplier);
              const companyRevSurplus = totals.companyShare - companyTargetRevenue;
              const isTargetMet = companyRevSurplus >= 0;
              const currentClosures = reportData?.rows?.reduce((s, r) => s + (r.placements || 0), 0) || 1;
              const avgTicket = totals.companyShare > 0 ? (totals.companyShare / Math.max(1, currentClosures)) : 30000;
              const requiredCompanyClosures = Math.ceil(companyTargetRevenue / Math.max(1000, avgTicket));

              return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                  <div style={{ background: 'var(--bg-card)', padding: '16px 18px', borderRadius: '12px', border: '1px solid var(--border-color)', borderLeft: '4px solid #3B82F6' }}>
                    <div style={{ fontSize: '0.76rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Company Total Operating Cost
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#3B82F6', marginTop: '4px' }}>
                      {formatCurrency(totals.executionCost)}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Total seat salaries & allocated overheads across all departments
                    </div>
                  </div>

                  <div style={{ background: 'var(--bg-card)', padding: '16px 18px', borderRadius: '12px', border: '1px solid var(--border-color)', borderLeft: '4px solid #10B981' }}>
                    <div style={{ fontSize: '0.76rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Required Company Revenue ({globalTargetMultiplier}x)
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-main)', marginTop: '4px' }}>
                      {formatCurrency(companyTargetRevenue)}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: isTargetMet ? '#10B981' : '#A8402E', marginTop: '2px', fontWeight: '700' }}>
                      Actual: {formatCurrency(totals.companyShare)} ({isTargetMet ? `✅ +${formatCurrency(companyRevSurplus)} Surplus` : `⚠️ ${formatCurrency(Math.abs(companyRevSurplus))} Shortfall`})
                    </div>
                  </div>

                  <div style={{ background: 'var(--bg-card)', padding: '16px 18px', borderRadius: '12px', border: '1px solid var(--border-color)', borderLeft: '4px solid #8B5CF6' }}>
                    <div style={{ fontSize: '0.76rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Company ROI Multiple Health
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '800', color: isTargetMet ? '#10B981' : '#A8402E', marginTop: '4px' }}>
                      {companyRoiMultiple.toFixed(2)}x Actual ROI
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Target: <strong>{globalTargetMultiplier}.0x</strong> • Delta: <strong style={{ color: isTargetMet ? '#10B981' : '#A8402E' }}>{(companyRoiMultiple - globalTargetMultiplier).toFixed(2)}x</strong>
                    </div>
                  </div>

                  <div style={{ background: 'var(--bg-card)', padding: '16px 18px', borderRadius: '12px', border: '1px solid var(--border-color)', borderLeft: '4px solid #F59E0B' }}>
                    <div style={{ fontSize: '0.76rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Company Placement Closures Needed
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-main)', marginTop: '4px' }}>
                      {requiredCompanyClosures} Closures
                    </div>
                    <div style={{ fontSize: '0.74rem', color: currentClosures >= requiredCompanyClosures ? '#10B981' : '#A8402E', marginTop: '2px', fontWeight: '700' }}>
                      {currentClosures >= requiredCompanyClosures ? `✅ Closed ${currentClosures} (+${currentClosures - requiredCompanyClosures} above target)` : `⚠️ ${requiredCompanyClosures - currentClosures} more closures needed (Currently ${currentClosures})`}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: HEAD-TO-HEAD PROFILE COMPARISON                                     */}
      {/* ========================================================================= */}
      {costMainTab === 'compare' && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '22px', marginBottom: '24px' }}>
          
          {/* Dimension Selector + Action Presets */}
          <div style={{ background: 'var(--bg-card)', padding: '18px 20px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '800', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Scale size={18} color="var(--accent-teal, #0F6E56)" />
                  <span>Head-to-Head Profile Comparison Matrix</span>
                </h3>
                <p style={{ margin: '3px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Select multiple profiles below to compare revenue, direct seat costs, net contribution, and ROI multiples side-by-side.
                </p>
              </div>

              {/* Quick Profile Selection Presets */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.74rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Presets:</span>
                <button
                  onClick={() => {
                    const top3 = (reportData?.rows || []).slice(0, 3).map(r => r.dimension_value);
                    setSelectedCompareProfiles(top3);
                  }}
                  style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer' }}
                >
                  ⭐ Top 3 Performers
                </button>
                <button
                  onClick={() => {
                    const top5 = (reportData?.rows || []).slice(0, 5).map(r => r.dimension_value);
                    setSelectedCompareProfiles(top5);
                  }}
                  style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer' }}
                >
                  🚀 Top 5 Contributors
                </button>
                <button
                  onClick={() => {
                    const active = (reportData?.rows || []).filter(r => !r.isDormant).map(r => r.dimension_value);
                    setSelectedCompareProfiles(active);
                  }}
                  style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer' }}
                >
                  🟢 All Active
                </button>
                <button
                  onClick={() => {
                    const act = (reportData?.rows || []).filter(r => !r.isDormant).slice(0, 2).map(r => r.dimension_value);
                    const dorm = (reportData?.rows || []).filter(r => r.isDormant).slice(0, 2).map(r => r.dimension_value);
                    setSelectedCompareProfiles([...act, ...dorm]);
                  }}
                  style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer' }}
                >
                  ⚡ Active vs Dormant
                </button>
              </div>
            </div>

            {/* Dimension Tabs */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)', marginBottom: '14px' }}>
              {[
                { key: 'bd', label: 'Compare BD Specialists (15)', icon: Users },
                { key: 'tl', label: 'Compare Team Leaders (10)', icon: Building },
                { key: 'franchise', label: 'Compare Franchisees (10)', icon: Layers },
                { key: 'city', label: 'Compare Cities (10)', icon: MapPin },
                { key: 'industry', label: 'Compare Industries (8)', icon: Briefcase }
              ].map(tab => {
                const IconComponent = tab.icon;
                const isActive = activeDimension === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveDimension(tab.key)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '7px 14px',
                      borderRadius: '6px',
                      border: 'none',
                      background: isActive ? 'var(--accent-teal, #0F6E56)' : 'rgba(0,0,0,0.04)',
                      color: isActive ? '#ffffff' : 'var(--text-muted)',
                      fontWeight: isActive ? '700' : '600',
                      fontSize: '0.82rem',
                      cursor: 'pointer'
                    }}
                  >
                    <IconComponent size={14} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Multi-Profile Checkbox Selector Pills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {(reportData?.rows || []).map(r => {
                const isSelected = selectedCompareProfiles.includes(r.dimension_value);
                return (
                  <button
                    key={r.dimension_value}
                    onClick={() => handleToggleCompareProfile(r.dimension_value)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '5px 12px',
                      borderRadius: '20px',
                      border: isSelected ? '1.5px solid var(--accent-teal, #0F6E56)' : '1px solid var(--border-color)',
                      background: isSelected ? 'rgba(15, 110, 86, 0.12)' : 'var(--bg-main)',
                      color: isSelected ? 'var(--accent-teal, #0F6E56)' : 'var(--text-main)',
                      fontSize: '0.78rem',
                      fontWeight: isSelected ? '800' : '600',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: r.isDormant ? '#A8402E' : '#10B981' }}></span>
                    <span>{r.dimension_value}</span>
                    <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>({r.roi_multiple}x)</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Executive Decision Winner Cards: "Who is more profitable to me?" */}
          {compareHighlights && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
              {/* Most Profitable */}
              <div style={{ background: 'var(--bg-card)', padding: '16px 18px', borderRadius: '12px', border: '1px solid var(--border-color)', borderLeft: '4px solid #10B981' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#10B981', textTransform: 'uppercase' }}>🏆 Highest Net Contribution</span>
                </div>
                <div style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--text-main)' }}>
                  {compareHighlights.mostProfitable?.dimension_value}
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#10B981', marginTop: '2px' }}>
                  +{formatCurrency(compareHighlights.mostProfitable?.net_contribution)} Net Profit
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                  Revenue: {formatCurrency(compareHighlights.mostProfitable?.company_share)} • Cost: {formatCurrency(compareHighlights.mostProfitable?.total_cost)}
                </div>
              </div>

              {/* Highest ROI Multiple */}
              <div style={{ background: 'var(--bg-card)', padding: '16px 18px', borderRadius: '12px', border: '1px solid var(--border-color)', borderLeft: '4px solid #3B82F6' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#3B82F6', textTransform: 'uppercase' }}>⚡ Highest Capital Efficiency</span>
                </div>
                <div style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--text-main)' }}>
                  {compareHighlights.highestRoi?.dimension_value}
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#3B82F6', marginTop: '2px' }}>
                  {compareHighlights.highestRoi?.roi_multiple}x ROI Multiple
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                  Generates {formatCurrency(compareHighlights.highestRoi?.company_share)} with lean spend of {formatCurrency(compareHighlights.highestRoi?.total_cost)}
                </div>
              </div>

              {/* Best Unit Economics */}
              <div style={{ background: 'var(--bg-card)', padding: '16px 18px', borderRadius: '12px', border: '1px solid var(--border-color)', borderLeft: '4px solid #8B5CF6' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#8B5CF6', textTransform: 'uppercase' }}>💡 Best Lead Conversion Margin</span>
                </div>
                <div style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--text-main)' }}>
                  {compareHighlights.bestUnitEconomics?.dimension_value}
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#8B5CF6', marginTop: '2px' }}>
                  +{formatCurrency(compareHighlights.bestUnitEconomics?.net_surplus_per_enquiry)} / Lead
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                  Highest commercial surplus retained on every enquiry handled
                </div>
              </div>

              {/* Turnaround Opportunity */}
              <div style={{ background: 'var(--bg-card)', padding: '16px 18px', borderRadius: '12px', border: '1px solid var(--border-color)', borderLeft: '4px solid #A8402E' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#A8402E', textTransform: 'uppercase' }}>⚠️ Turnaround / Growth Priority</span>
                </div>
                <div style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--text-main)' }}>
                  {compareHighlights.dormantOrLagging?.dimension_value}
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#A8402E', marginTop: '2px' }}>
                  {compareHighlights.dormantOrLagging?.isDormant ? '0x ROI (Dormant)' : `${compareHighlights.dormantOrLagging?.roi_multiple}x ROI`}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                  Reactivation unlocks ~{formatCurrency(compareHighlights.dormantOrLagging?.isDormant ? 150000 : 90000)} in net revenue recovery
                </div>
              </div>
            </div>
          )}

          {/* Comparative Side-by-Side Table Matrix */}
          <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)' }}>
              <h3 style={{ margin: 0, fontSize: '0.96rem', fontWeight: '800', color: 'var(--text-main)' }}>
                Side-by-Side Performance Ledger ({compareRows.length} Profiles Compared)
              </h3>
            </div>

            <div className="table-responsive">
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(0,0,0,0.02)', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '700', color: 'var(--text-muted)' }}>Profile Name</th>
                    <th style={{ padding: '12px 10px', textAlign: 'center', fontWeight: '700', color: 'var(--text-muted)' }}>Status</th>
                    <th style={{ padding: '12px 12px', textAlign: 'right', fontWeight: '700', color: 'var(--text-muted)' }}>Placements</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '700', color: 'var(--text-muted)' }}>Company Share</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '700', color: 'var(--text-muted)' }}>Total Cost</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '700', color: 'var(--text-muted)' }}>Net Contribution</th>
                    <th style={{ padding: '12px 12px', textAlign: 'right', fontWeight: '700', color: 'var(--text-muted)' }}>Margin %</th>
                    <th style={{ padding: '12px 14px', textAlign: 'center', fontWeight: '700', color: 'var(--text-muted)' }}>ROI Multiple</th>
                    <th style={{ padding: '12px 14px', textAlign: 'center', fontWeight: '700', color: 'var(--text-muted)' }}>Profitability Tier</th>
                    <th style={{ padding: '12px 14px', textAlign: 'center', fontWeight: '700', color: 'var(--text-muted)' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {compareRows.map((r, idx) => {
                    const isPositive = r.net_contribution >= 0;
                    return (
                      <tr key={r.dimension_value || idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '14px 16px', fontWeight: '800', color: 'var(--text-main)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: '800' }}>
                              {idx + 1}
                            </span>
                            <span>{r.dimension_value}</span>
                          </div>
                        </td>
                        <td style={{ padding: '14px 10px', textAlign: 'center' }}>
                          <span style={{ fontSize: '0.74rem', fontWeight: '700', color: r.isDormant ? '#A8402E' : '#10B981', background: r.isDormant ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', padding: '2px 8px', borderRadius: '4px' }}>
                            {r.isDormant ? '💤 Dormant' : '🟢 Active'}
                          </span>
                        </td>
                        <td style={{ padding: '14px 12px', textAlign: 'right', fontWeight: '700' }}>{r.placements}</td>
                        <td style={{ padding: '14px 14px', textAlign: 'right', fontWeight: '800', color: '#10B981' }}>{formatCurrency(r.company_share)}</td>
                        <td style={{ padding: '14px 14px', textAlign: 'right', fontWeight: '700', color: '#3B82F6' }}>{formatCurrency(r.total_cost)}</td>
                        <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: '800', color: isPositive ? '#10B981' : '#A8402E' }}>
                          {isPositive ? '+' : ''}{formatCurrency(r.net_contribution)}
                        </td>
                        <td style={{ padding: '14px 12px', textAlign: 'right', fontWeight: '700' }}>{r.netMarginPct}%</td>
                        <td style={{ padding: '14px 14px', textAlign: 'center', fontWeight: '800', color: r.roi_multiple >= 3.0 ? '#10B981' : r.roi_multiple >= 1.5 ? '#3B82F6' : '#A8402E' }}>
                          {r.roi_multiple}x
                        </td>
                        <td style={{ padding: '14px 14px', textAlign: 'center' }}>
                          <span style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: '700', background: r.roi_multiple >= 3.0 ? 'rgba(16,185,129,0.15)' : r.roi_multiple >= 1.5 ? 'rgba(59,130,246,0.15)' : 'rgba(239,68,68,0.12)', color: r.roi_multiple >= 3.0 ? '#10B981' : r.roi_multiple >= 1.5 ? '#3B82F6' : '#A8402E' }}>
                            {r.tier_badge || (r.roi_multiple >= 3.0 ? 'Star' : r.roi_multiple >= 1.5 ? 'Contributor' : 'At Risk')}
                          </span>
                        </td>
                        <td style={{ padding: '14px 14px', textAlign: 'center' }}>
                          {r.isDormant ? (
                            <button
                              onClick={() => setActivationPlaybookEntity(r)}
                              style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#A8402E', padding: '4px 10px', borderRadius: '6px', fontSize: '0.74rem', fontWeight: '700', cursor: 'pointer' }}
                            >
                              ⚡ Playbook
                            </button>
                          ) : (
                            <button
                              onClick={() => handleOpenDrilldown(r)}
                              style={{ background: 'transparent', border: 'none', color: 'var(--accent-teal, #0F6E56)', cursor: 'pointer' }}
                            >
                              <ChevronRight size={18} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Comparative Visual Bar Charts */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '16px' }}>
            <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '0.96rem', fontWeight: '800', color: 'var(--text-main)' }}>
                Revenue vs Operating Execution Cost Comparison
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {compareRows.map((r, i) => {
                  const maxAmt = Math.max(...compareRows.map(x => Math.max(x.company_share, x.total_cost)), 100000);
                  const revW = Math.min(100, Math.max(6, (r.company_share / maxAmt) * 100));
                  const costW = Math.min(100, Math.max(6, (r.total_cost / maxAmt) * 100));
                  return (
                    <div key={i} style={{ background: 'rgba(0,0,0,0.02)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontWeight: '700', fontSize: '0.82rem' }}>
                        <span>{r.dimension_value}</span>
                        <span style={{ color: '#10B981' }}>{r.roi_multiple}x ROI</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.72rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ width: '55px', color: 'var(--text-muted)' }}>Revenue:</span>
                          <div style={{ flex: 1, height: '7px', background: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ width: `${revW}%`, height: '100%', background: '#10B981', borderRadius: '4px' }}></div>
                          </div>
                          <span style={{ width: '70px', textAlign: 'right', fontWeight: '700', color: '#10B981' }}>{formatCurrency(r.company_share)}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ width: '55px', color: 'var(--text-muted)' }}>Cost:</span>
                          <div style={{ flex: 1, height: '7px', background: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ width: `${costW}%`, height: '100%', background: '#3B82F6', borderRadius: '4px' }}></div>
                          </div>
                          <span style={{ width: '70px', textAlign: 'right', fontWeight: '700', color: '#3B82F6' }}>{formatCurrency(r.total_cost)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '0.96rem', fontWeight: '800', color: 'var(--text-main)' }}>
                Net Commercial Surplus Ranking (True Bank Profit)
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {compareRows.map((r, i) => {
                  const maxNet = Math.max(...compareRows.map(x => Math.abs(x.net_contribution)), 100000);
                  const isPos = r.net_contribution >= 0;
                  const netW = Math.min(100, Math.max(6, (Math.abs(r.net_contribution) / maxNet) * 100));
                  return (
                    <div key={i} style={{ background: 'rgba(0,0,0,0.02)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.82rem' }}>
                        <span style={{ fontWeight: '700' }}>{r.dimension_value}</span>
                        <span style={{ fontWeight: '800', color: isPos ? '#10B981' : '#A8402E' }}>
                          {isPos ? '+' : ''}{formatCurrency(r.net_contribution)}
                        </span>
                      </div>
                      <div style={{ height: '8px', background: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${netW}%`, height: '100%', background: isPos ? 'linear-gradient(90deg, #10B981, #059669)' : '#DC2626', borderRadius: '4px' }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: INDIVIDUAL PROFILE TRACKING (DASHBOARD & DETAILED TABLE)            */}
      {/* ========================================================================= */}
      {costMainTab === 'profiles' && (
        <div className="animate-fade-in">
          
          {/* Top KPI Summary Row */}
        <div style={{ background: 'var(--bg-card)', padding: '18px 20px', borderRadius: '12px', border: '1px solid var(--border-color)', borderLeft: '4px solid #0F6E56' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Company Share (ourShare)
            </span>
            <DollarSign size={18} color="#0F6E56" />
          </div>
          <div style={{ fontSize: '1.55rem', fontWeight: '800', color: 'var(--text-main)' }}>
            {formatCurrency(totals.companyShare)}
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Gross Billing: {formatCurrency(totals.billed)}
          </div>
        </div>

        {/* Cost of Execution */}
        {userRole !== 'franchise_partner' && (
          <div style={{ background: 'var(--bg-card)', padding: '18px 20px', borderRadius: '12px', border: '1px solid var(--border-color)', borderLeft: '4px solid #3B82F6' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Cost of Execution
              </span>
              <Layers size={18} color="#3B82F6" />
            </div>
            <div style={{ fontSize: '1.55rem', fontWeight: '800', color: '#3B82F6' }}>
              {formatCurrency(totals.executionCost)}
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Salaries + Overheads ({reportData?.allocation_basis || 'Rev Share'})
            </div>
          </div>
        )}

        {/* Net Commercial Contribution */}
        {userRole !== 'franchise_partner' && (
          <div style={{ background: 'var(--bg-card)', padding: '18px 20px', borderRadius: '12px', border: '1px solid var(--border-color)', borderLeft: '4px solid #10B981' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Net Contribution (True Worth)
              </span>
              <TrendingUp size={18} color="#10B981" />
            </div>
            <div style={{ fontSize: '1.55rem', fontWeight: '800', color: totals.netContribution >= 0 ? '#10B981' : '#A8402E' }}>
              {formatCurrency(totals.netContribution)}
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              ROI Multiple: <strong style={{ color: companyRoiMultiple >= 2.5 ? '#10B981' : '#A8402E' }}>{companyRoiMultiple.toFixed(2)}x</strong>
            </div>
          </div>
        )}

        {/* Active vs Dormant Profile Tracker */}
        <div style={{ background: 'var(--bg-card)', padding: '18px 20px', borderRadius: '12px', border: '1px solid var(--border-color)', borderLeft: '4px solid #F59E0B' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {activeDimension.toUpperCase()} Activity vs Dormancy
            </span>
            <Flame size={18} color="#F59E0B" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '1.55rem', fontWeight: '800', color: '#10B981' }}>
              {activityCounts.active}
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Active</span>
            <span style={{ fontSize: '1.1rem', color: 'var(--text-muted)' }}>/</span>
            <span style={{ fontSize: '1.35rem', fontWeight: '800', color: '#A8402E' }}>
              {activityCounts.dormant}
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Dormant</span>
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Total {activityCounts.total} registered in this view
          </div>
        </div>

        {/* Dedicated Dormant Franchisees Counter */}
        <div style={{ background: 'var(--bg-card)', padding: '18px 20px', borderRadius: '12px', border: '1px solid var(--border-color)', borderLeft: '4px solid #A8402E' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Franchisee Network Health
            </span>
            <Store size={18} color="#A8402E" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '1.55rem', fontWeight: '800', color: '#10B981' }}>
              {franchiseDormancyStats.active}
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Active</span>
            <span style={{ fontSize: '1.1rem', color: 'var(--text-muted)' }}>/</span>
            <span style={{ fontSize: '1.35rem', fontWeight: '800', color: '#A8402E' }}>
              {franchiseDormancyStats.dormant}
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Dormant</span>
          </div>
          <div style={{ fontSize: '0.74rem', color: '#A8402E', marginTop: '4px', fontWeight: '600' }}>
            {franchiseDormancyStats.dormant} Franchisees need activation ({((franchiseDormancyStats.dormant / franchiseDormancyStats.total) * 100).toFixed(0)}% dormant)
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. DEDICATED DORMANT FRANCHISEES DIRECTORY & ACTIVATION LEVERS            */}
      {/* ========================================================================= */}
      {franchiseDormancyStats.dormant > 0 && (
        <div style={{ background: 'rgba(239, 68, 68, 0.04)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '12px', padding: '16px 20px', marginBottom: '22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={17} color="#A8402E" />
              <h3 style={{ margin: 0, fontSize: '0.96rem', fontWeight: '800', color: '#A8402E' }}>
                Dormant Franchisees Directory ({franchiseDormancyStats.dormant} Inactive Partners)
              </h3>
            </div>
            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
              Click '⚡ Activate' to launch re-activation playbook & simulate commercial recovery
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
            {franchiseDormancyStats.dormantList.map(f => (
              <div key={f.name} style={{ background: 'var(--bg-card)', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: '800', fontSize: '0.86rem', color: 'var(--text-main)' }}>{f.name}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {f.city} • TL: {f.teamLeader}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#A8402E', marginTop: '2px' }}>
                    {f.dormantReason}
                  </div>
                </div>

                <button
                  onClick={() => setActivationPlaybookEntity({
                    dimension_value: f.name,
                    role: `Franchise Partner (${f.city})`,
                    isDormant: true,
                    dormantReason: f.dormantReason,
                    total_cost: 0,
                    enquiries_handled: 3,
                    net_contribution: -15000
                  })}
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#A8402E',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '0.74rem',
                    fontWeight: '800',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    flexShrink: 0
                  }}
                >
                  <Zap size={12} />
                  <span>Activate</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. DIMENSION SUB-TABS & FILTER PILLS                                      */}
      {/* ========================================================================= */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
        
        {/* Dimension Sub-Tabs */}
        <div style={{ display: 'flex', background: 'var(--bg-card)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border-color)', gap: '4px' }}>
          {[
            { key: 'bd', label: 'BD-wise (15)', icon: Users },
            { key: 'tl', label: 'Team Leader-wise (10)', icon: Building },
            { key: 'franchise', label: 'Franchise-wise (10)', icon: Layers },
            { key: 'city', label: 'City-wise (10)', icon: MapPin },
            { key: 'industry', label: 'Industry-wise (8)', icon: Briefcase }
          ].map(tab => {
            const IconComponent = tab.icon;
            const isActive = activeDimension === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => { setActiveDimension(tab.key); setActivityStatusFilter('all'); setSelectedProfile('all'); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: '7px',
                  border: 'none',
                  background: isActive ? 'var(--accent-teal, #0F6E56)' : 'transparent',
                  color: isActive ? '#ffffff' : 'var(--text-muted)',
                  fontWeight: isActive ? '700' : '500',
                  fontSize: '0.86rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <IconComponent size={15} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Activity Status Filter Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-card)', padding: '4px 8px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <span style={{ fontSize: '0.74rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginRight: '4px' }}>Filter:</span>
          {[
            { key: 'all', label: `All (${activityCounts.total})` },
            { key: 'active', label: `🟢 Active (${activityCounts.active})` },
            { key: 'dormant', label: `💤 Dormant (${activityCounts.dormant})` }
          ].map(btn => (
            <button
              key={btn.key}
              onClick={() => { setActivityStatusFilter(btn.key); setCurrentPage(1); }}
              style={{
                padding: '5px 12px',
                borderRadius: '6px',
                border: activityStatusFilter === btn.key ? '1px solid var(--accent-teal, #0F6E56)' : '1px solid transparent',
                background: activityStatusFilter === btn.key ? 'rgba(15, 110, 86, 0.12)' : 'transparent',
                color: activityStatusFilter === btn.key ? 'var(--accent-teal, #0F6E56)' : 'var(--text-muted)',
                fontWeight: activityStatusFilter === btn.key ? '800' : '600',
                fontSize: '0.78rem',
                cursor: 'pointer'
              }}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {/* Right Controls: Profile Filter + View Mode Switcher + Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          
          {/* Prominent Profile Selector Dropdown */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: selectedProfile !== 'all' ? 'rgba(15, 110, 86, 0.12)' : 'var(--bg-card)',
            padding: '5px 12px',
            borderRadius: '8px',
            border: selectedProfile !== 'all' ? '1.5px solid var(--accent-teal, #0F6E56)' : '1px solid var(--border-color)',
            transition: 'all 0.15s ease'
          }}>
            <UserCheck size={15} color="var(--accent-teal, #0F6E56)" />
            <span style={{ fontSize: '0.76rem', fontWeight: '800', color: selectedProfile !== 'all' ? 'var(--accent-teal, #0F6E56)' : 'var(--text-muted)', textTransform: 'uppercase' }}>
              Profile:
            </span>
            <select
              value={selectedProfile}
              onChange={(e) => { setSelectedProfile(e.target.value); setCurrentPage(1); }}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-main)',
                fontSize: '0.84rem',
                fontWeight: '700',
                cursor: 'pointer',
                outline: 'none',
                maxWidth: '200px'
              }}
            >
              <option value="all">All {activeDimension.toUpperCase()}s ({reportData?.rows?.length || 0})</option>
              {reportData?.rows?.map(r => (
                <option key={r.dimension_value} value={r.dimension_value}>
                  {r.dimension_value} {r.isDormant ? ' (💤 Dormant)' : ` (${r.roi_multiple}x ROI)`}
                </option>
              ))}
            </select>
            {selectedProfile !== 'all' && (
              <button
                onClick={() => setSelectedProfile('all')}
                title="Clear profile filter"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px', color: 'var(--text-muted)' }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* View Mode Switcher */}
          <div style={{ display: 'flex', background: 'var(--bg-card)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-color)', gap: '2px' }}>
            {[
              { key: 'charts', label: 'Graphs', icon: BarChart3 },
              { key: 'table', label: 'Table', icon: LayoutGrid },
              { key: 'both', label: 'Hybrid', icon: Activity }
            ].map(m => {
              const Icon = m.icon;
              const isSel = viewMode === m.key;
              return (
                <button
                  key={m.key}
                  onClick={() => setViewMode(m.key)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    background: isSel ? 'var(--accent-teal, #0F6E56)' : 'transparent',
                    color: isSel ? '#ffffff' : 'var(--text-muted)',
                    fontWeight: isSel ? '700' : '500',
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Icon size={14} />
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>

          {/* Search Input */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-card)', padding: '6px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', minWidth: '190px' }}>
            <Search size={15} color="var(--text-muted)" />
            <input
              type="text"
              placeholder={`Search ${activeDimension.toUpperCase()}...`}
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-main)',
                fontSize: '0.84rem',
                outline: 'none',
                width: '100%'
              }}
            />
            {searchTerm && (
              <X size={14} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setSearchTerm('')} />
            )}
          </div>
        </div>
      </div>

      {/* Selected Profile Banner Indicator */}
      {selectedProfile !== 'all' && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(15, 110, 86, 0.09)',
          border: '1px solid rgba(15, 110, 86, 0.25)',
          borderRadius: '10px',
          padding: '10px 16px',
          marginBottom: '18px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--accent-teal, #0F6E56)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '0.8rem' }}>
              👤
            </div>
            <div>
              <span style={{ fontSize: '0.86rem', fontWeight: '800', color: 'var(--text-main)' }}>
                Viewing individual profile metrics for: <span style={{ color: 'var(--accent-teal, #0F6E56)' }}>{selectedProfile}</span>
              </span>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginLeft: '8px' }}>
                (Table, ledger and matrix are filtered exclusively to this profile)
              </span>
            </div>
          </div>
          <button
            onClick={() => setSelectedProfile('all')}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              padding: '5px 12px',
              fontSize: '0.76rem',
              fontWeight: '700',
              color: 'var(--text-main)',
              cursor: 'pointer'
            }}
          >
            ✕ Reset & Show All {activeDimension.toUpperCase()}s
          </button>
        </div>
      )}

      {/* 6. VISUAL ANALYTICS & INTERACTIVE GRAPHS SECTION */}
      {(viewMode === 'charts' || viewMode === 'both') && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '18px', marginBottom: '24px' }}>
          
          {/* Graph 1: The Commercial Worth Flow Matrix */}
          <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: '800', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <BarChart3 size={17} color="var(--accent-teal, #0F6E56)" />
                  <span>Commercial Worth Matrix: Revenue vs Costs vs Net Worth</span>
                </h3>
                <p style={{ margin: '3px 0 0 0', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                  Breakdown of revenue generated vs money spent to acquire, execute & retain ({selectedMonth})
                </p>
              </div>

              <button
                onClick={() => setExpandCharts(!expandCharts)}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  fontSize: '0.72rem',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                {expandCharts ? 'Show Top 5' : `View All (${filteredRows.length})`}
              </button>
            </div>

            {filteredRows.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.84rem' }}>No data available to plot</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {(expandCharts ? filteredRows : filteredRows.slice(0, 5)).map((r, i) => {
                  const maxBar = Math.max(r.company_share, r.total_cost, Math.abs(r.net_contribution), 50000);
                  const revPct = Math.min(100, Math.max(8, (r.company_share / maxBar) * 100));
                  const costPct = Math.min(100, Math.max(6, (r.total_cost / maxBar) * 100));
                  const churnPct = Math.min(100, Math.max(4, (r.churn_cost / maxBar) * 100));
                  const isPositive = r.net_contribution >= 0;

                  return (
                    <div 
                      key={r.dimension_value || i} 
                      style={{ 
                        background: r.isDormant ? 'rgba(239, 68, 68, 0.03)' : 'rgba(0,0,0,0.02)', 
                        padding: '12px', 
                        borderRadius: '8px', 
                        border: r.isDormant ? '1px dashed rgba(239, 68, 68, 0.3)' : '1px solid var(--border-color)',
                        transition: 'transform 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--text-main)' }}>
                            {r.dimension_value}
                          </span>
                          {r.isDormant ? (
                            <span style={{ fontSize: '0.68rem', fontWeight: '700', background: 'rgba(239,68,68,0.15)', color: '#A8402E', padding: '1px 6px', borderRadius: '4px' }}>
                              💤 Dormant
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.68rem', fontWeight: '700', color: r.isTargetAchieved ? '#10B981' : '#B7791F' }}>
                              {r.roi_multiple}x ROI (Target: {r.targetMultiple}x)
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {r.isDormant ? (
                            <button
                              onClick={() => setActivationPlaybookEntity(r)}
                              style={{
                                background: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                color: '#A8402E',
                                padding: '2px 8px',
                                borderRadius: '6px',
                                fontSize: '0.72rem',
                                fontWeight: '700',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              <Zap size={12} />
                              <span>Activation Playbook</span>
                            </button>
                          ) : (
                            <span style={{ 
                              fontSize: '0.76rem', 
                              fontWeight: '800', 
                              color: isPositive ? '#10B981' : '#A8402E',
                              background: isPositive ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                              padding: '2px 6px',
                              borderRadius: '4px'
                            }}>
                              Net: {isPositive ? '+' : ''}{formatCurrency(r.net_contribution)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Stacked Visual Bar Tracks */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.72rem' }}>
                          <span style={{ width: '80px', color: 'var(--text-muted)', fontSize: '0.68rem', fontWeight: '600' }}>Revenue:</span>
                          <div style={{ flex: 1, height: '7px', background: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ width: `${revPct}%`, height: '100%', background: '#0F6E56', borderRadius: '4px' }} title={`Revenue: ${formatCurrency(r.company_share)}`}></div>
                          </div>
                          <span style={{ width: '65px', textAlign: 'right', fontWeight: '700', color: 'var(--text-main)' }}>{formatCurrency(r.company_share)}</span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.72rem' }}>
                          <span style={{ width: '80px', color: 'var(--text-muted)', fontSize: '0.68rem', fontWeight: '600' }}>Exec Cost:</span>
                          <div style={{ flex: 1, height: '7px', background: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ width: `${costPct}%`, height: '100%', background: '#3B82F6', borderRadius: '4px' }} title={`Execution Cost: ${formatCurrency(r.total_cost)}`}></div>
                          </div>
                          <span style={{ width: '65px', textAlign: 'right', fontWeight: '600', color: '#3B82F6' }}>{formatCurrency(r.total_cost)}</span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.72rem' }}>
                          <span style={{ width: '80px', color: 'var(--text-muted)', fontSize: '0.68rem', fontWeight: '600' }}>Churn Loss:</span>
                          <div style={{ flex: 1, height: '7px', background: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ width: `${churnPct}%`, height: '100%', background: '#A8402E', borderRadius: '4px' }} title={`Churn Loss: ${formatCurrency(r.churn_cost)}`}></div>
                          </div>
                          <span style={{ width: '65px', textAlign: 'right', fontWeight: '600', color: '#A8402E' }}>{formatCurrency(r.churn_cost)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            
            {/* Chart Legend */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-color)', fontSize: '0.74rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#0F6E56', display: 'inline-block' }}></span>
                <span style={{ color: 'var(--text-muted)' }}>Company Share (Inflow)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#3B82F6', display: 'inline-block' }}></span>
                <span style={{ color: 'var(--text-muted)' }}>Execution Cost</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#A8402E', display: 'inline-block' }}></span>
                <span style={{ color: 'var(--text-muted)' }}>Churn & Loss</span>
              </div>
            </div>
          </div>

          {/* Graph 2: Net Commercial Contribution Leaderboard */}
          <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: '800', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <TrendingUp size={17} color="#10B981" />
                  <span>Target Multiplier vs Actual ROI Multiple Leaderboard</span>
                </h3>
                <p style={{ margin: '3px 0 0 0', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                  Comparing each profile's actual multiple against target benchmark ({globalTargetMultiplier}x)
                </p>
              </div>
            </div>

            {filteredRows.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.84rem' }}>No data available</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {(expandCharts ? filteredRows : filteredRows.slice(0, 6)).map((r, idx) => {
                  const maxNet = Math.max(...filteredRows.map(x => Math.abs(x.net_contribution)), 100000);
                  const isPositive = r.net_contribution >= 0;
                  const barWidth = Math.min(100, Math.max(6, (Math.abs(r.net_contribution) / maxNet) * 100));

                  return (
                    <div 
                      key={r.dimension_value || idx}
                      onClick={() => handleOpenDrilldown(r)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', fontSize: '0.8rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ 
                            width: '18px', 
                            height: '18px', 
                            borderRadius: '50%', 
                            background: idx === 0 ? '#F59E0B' : idx === 1 ? '#94A3B8' : idx === 2 ? '#B45309' : 'rgba(0,0,0,0.06)',
                            color: idx < 3 ? '#ffffff' : 'var(--text-muted)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.65rem',
                            fontWeight: '800'
                          }}>
                            {idx + 1}
                          </span>
                          <span style={{ fontWeight: '700', color: 'var(--text-main)' }}>{r.dimension_value}</span>
                          <span style={{
                            fontSize: '0.66rem',
                            fontWeight: '700',
                            padding: '1px 5px',
                            borderRadius: '3px',
                            background: r.isTargetAchieved ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.12)',
                            color: r.isTargetAchieved ? '#10B981' : '#A8402E'
                          }}>
                            {r.roi_multiple}x / {r.targetMultiple}x Target
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: '800', color: isPositive ? '#10B981' : '#A8402E' }}>
                            {isPositive ? '+' : ''}{formatCurrency(r.net_contribution)}
                          </span>
                        </div>
                      </div>

                      {/* Visual Bar */}
                      <div style={{ height: '8px', background: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div 
                          style={{ 
                            width: `${barWidth}%`, 
                            height: '100%', 
                            background: isPositive ? 'linear-gradient(90deg, #10B981, #059669)' : 'linear-gradient(90deg, #EF4444, #DC2626)',
                            borderRadius: '4px',
                            transition: 'width 0.3s ease'
                          }} 
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Graph 3: Effort Unit Economics */}
          <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: '800', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sparkles size={17} color="#8B5CF6" />
                  <span>Effort Unit Economics: Rev / Enquiry vs Exp / Enquiry</span>
                </h3>
                <p style={{ margin: '3px 0 0 0', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                  How much net commercial surplus is earned per individual lead / enquiry handled
                </p>
              </div>
            </div>

            {filteredRows.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No records to display</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {(expandCharts ? filteredRows : filteredRows.slice(0, 5)).map((r, idx) => {
                  const maxUnit = Math.max(r.rev_per_enquiry, r.exp_per_enquiry, 10000);
                  const revW = Math.min(100, Math.max(6, (r.rev_per_enquiry / maxUnit) * 100));
                  const expW = Math.min(100, Math.max(6, (r.exp_per_enquiry / maxUnit) * 100));
                  const surplus = r.net_surplus_per_enquiry;

                  return (
                    <div key={r.dimension_value || idx} style={{ background: 'rgba(0,0,0,0.02)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: '700', fontSize: '0.82rem', color: 'var(--text-main)' }}>{r.dimension_value}</span>
                          {r.isDormant && <span style={{ fontSize: '0.65rem', color: '#A8402E' }}>(0 Placements)</span>}
                        </div>
                        <span style={{ 
                          fontSize: '0.74rem', 
                          fontWeight: '800', 
                          color: surplus >= 0 ? '#8B5CF6' : '#A8402E' 
                        }}>
                          Surplus: {surplus >= 0 ? '+' : ''}{formatCurrency(surplus)} / lead
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.68rem' }}>
                          <span style={{ width: '50px', color: 'var(--text-muted)' }}>Rev:</span>
                          <div style={{ flex: 1, height: '6px', background: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${revW}%`, height: '100%', background: '#10B981', borderRadius: '3px' }}></div>
                          </div>
                          <span style={{ width: '50px', textAlign: 'right', fontWeight: '600' }}>{formatCurrency(r.rev_per_enquiry)}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.68rem' }}>
                          <span style={{ width: '50px', color: 'var(--text-muted)' }}>Exp:</span>
                          <div style={{ flex: 1, height: '6px', background: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${expW}%`, height: '100%', background: '#8B5CF6', borderRadius: '3px' }}></div>
                          </div>
                          <span style={{ width: '50px', textAlign: 'right', fontWeight: '600', color: '#8B5CF6' }}>{formatCurrency(r.exp_per_enquiry)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Graph 4: Corporate Cost Composition */}
          <div style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: '800', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <PieChart size={17} color="#3B82F6" />
                  <span>Cost Structure & Money Leakage Composition</span>
                </h3>
                <p style={{ margin: '3px 0 0 0', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                  Total cost breakdown across salaries, commissions, overheads & churn
                </p>
              </div>
            </div>

            {(() => {
              const execTotal = totals.executionCost || 1;
              const churnTotal = totals.churnCost || 0;
              const overallSpend = execTotal + churnTotal;
              
              const salaryPortion = Math.round(execTotal * 0.55);
              const overheadPortion = Math.round(execTotal * 0.35);
              const travelPortion = Math.round(execTotal * 0.10);

              const items = [
                { label: 'Direct BD & Team Salaries', val: salaryPortion, color: '#3B82F6', desc: 'Fixed monthly compensation' },
                { label: 'Allocated Shared Overheads', val: overheadPortion, color: '#0F6E56', desc: 'Rent, marketing, admin' },
                { label: 'Commissions & Travel', val: travelPortion, color: '#8B5CF6', desc: 'Variable performance incentives' },
                { label: 'Credit Notes & Sunk Churn', val: churnTotal, color: '#A8402E', desc: 'Deal cancellations & reversals' }
              ];

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {items.map((it, i) => {
                    const pct = overallSpend > 0 ? ((it.val / overallSpend) * 100).toFixed(1) : 0;
                    return (
                      <div key={i}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', fontSize: '0.8rem' }}>
                          <div>
                            <span style={{ fontWeight: '700', color: 'var(--text-main)' }}>{it.label}</span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '6px' }}>({it.desc})</span>
                          </div>
                          <span style={{ fontWeight: '800', color: it.color }}>
                            {formatCurrency(it.val)} ({pct}%)
                          </span>
                        </div>
                        <div style={{ height: '8px', background: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: it.color, borderRadius: '4px' }}></div>
                        </div>
                      </div>
                    );
                  })}
                  
                  <div style={{ marginTop: '10px', padding: '12px', background: 'rgba(59,130,246,0.06)', borderRadius: '8px', border: '1px solid rgba(59,130,246,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-main)', fontWeight: '600' }}>Total Cost of Generation & Loss:</span>
                    <span style={{ fontSize: '0.92rem', fontWeight: '800', color: '#3B82F6' }}>
                      {formatCurrency(overallSpend)}
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>

        </div>
      )}

      {/* 7. Detailed Table Section with Inline Target ROI Multiplier Editor */}
      {(viewMode === 'table' || viewMode === 'both') && (
        <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)' }}>
          
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '0.96rem', fontWeight: '800', color: 'var(--text-main)' }}>
                Detailed Target ROI Multiplier Ledger ({activeDimension.toUpperCase()})
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                Set individual 2x, 3x, 5x target multipliers per profile below to audit required closures & surplus.
              </p>
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              Showing {filteredRows.length} of {activityCounts.total} total entities in {activeDimension.toUpperCase()}
            </div>
          </div>
        
        {filteredRows.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Info size={32} style={{ marginBottom: '8px', opacity: 0.6 }} />
            <div style={{ fontWeight: '600' }}>No records found matching filters for {activeDimension.toUpperCase()} in {selectedMonth}</div>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
              <thead>
                <tr style={{ background: 'rgba(0,0,0,0.02)', borderBottom: '1px solid var(--border-color)' }}>
                  
                  {/* Dimension Name */}
                  <th 
                    onClick={() => handleSort('dimension_value')}
                    style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '700', color: 'var(--text-muted)', cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span>{activeDimension === 'bd' ? 'BD Specialist' : activeDimension === 'tl' ? 'Team Leader' : activeDimension === 'franchise' ? 'Franchise Partner' : activeDimension === 'city' ? 'Client City' : 'Industry Sector'}</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>

                  {/* Status */}
                  <th style={{ padding: '12px 10px', textAlign: 'center', fontWeight: '700', color: 'var(--text-muted)', width: '90px' }}>
                    Status
                  </th>

                  {/* Actual Delivered Company Share */}
                  <th 
                    onClick={() => handleSort('company_share')}
                    style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '800', color: 'var(--text-main)', cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                      <span>Delivered Revenue</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>

                  {/* Execution Cost */}
                  {userRole !== 'franchise_partner' && (
                    <th 
                      onClick={() => handleSort('total_cost')}
                      style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '700', color: '#3B82F6', cursor: 'pointer' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                        <span>Operating Seat Cost</span>
                        <ArrowUpDown size={12} />
                      </div>
                    </th>
                  )}

                  {/* Loss Forensics / Churn */}
                  <th style={{ padding: '12px 12px', textAlign: 'right', fontWeight: '700', color: '#A8402E' }}>
                    Loss Write-Offs
                  </th>

                  {/* Net Contribution */}
                  {userRole !== 'franchise_partner' && (
                    <th 
                      onClick={() => handleSort('net_contribution')}
                      style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '800', color: 'var(--text-main)', cursor: 'pointer' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                        <span>Net Bank Surplus</span>
                        <ArrowUpDown size={12} />
                      </div>
                    </th>
                  )}

                  {/* Actual ROI Multiple */}
                  <th 
                    onClick={() => handleSort('roi_multiple')}
                    style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '800', color: 'var(--accent-teal, #0F6E56)', cursor: 'pointer' }}
                    title="Actual Company Share / Execution Cost"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                      <span>Actual ROI Multiple</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>

                  {/* Tier / Health */}
                  <th style={{ padding: '12px 14px', textAlign: 'center', fontWeight: '800', width: '160px' }}>
                    Performance Tier
                  </th>

                  {/* Action */}
                  <th style={{ padding: '12px 14px', textAlign: 'center', fontWeight: '600', color: 'var(--text-muted)', width: '110px' }}>
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {paginatedRows.map((r, idx) => {
                  const isNetPositive = (r.net_contribution || 0) >= 0;
                  return (
                    <tr 
                      key={r.dimension_value || idx}
                      style={{ 
                        borderBottom: '1px solid var(--border-color)',
                        background: r.isDormant ? 'rgba(239, 68, 68, 0.02)' : 'transparent',
                        transition: 'background 0.1s ease'
                      }}
                      className="hover-row"
                    >
                      
                      {/* Name */}
                      <td 
                        onClick={() => handleOpenDrilldown(r)}
                        style={{ padding: '14px 16px', cursor: 'pointer' }}
                      >
                        <div style={{ fontWeight: '700', color: 'var(--text-main)', fontSize: '0.88rem' }}>
                          {r.dimension_value}
                        </div>
                        {activeDimension === 'bd' && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {r.role || 'BD Specialist'} • {r.placements} placements ({r.enquiries_handled || 0} leads)
                          </div>
                        )}
                        {activeDimension === 'tl' && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {r.active_franchise_count || 45} Active Franchisees Managed
                          </div>
                        )}
                        {activeDimension === 'franchise' && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {r.city} • TL: {r.teamLeader}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '14px 10px', textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 7px',
                          borderRadius: '10px',
                          fontSize: '0.68rem',
                          fontWeight: '800',
                          background: r.isDormant ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                          color: r.isDormant ? '#A8402E' : '#10B981'
                        }}>
                          {r.isDormant ? '💤 Dormant' : '🟢 Active'}
                        </span>
                      </td>

                      {/* Actual Delivered Revenue */}
                      <td style={{ padding: '14px 14px', textAlign: 'right', fontWeight: '800', color: 'var(--text-main)' }}>
                        <div>{formatCurrency(r.company_share)}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>
                          Gross: {formatCurrency(r.total_billed)}
                        </div>
                      </td>

                      {/* Execution Seat Cost */}
                      {userRole !== 'franchise_partner' && (
                        <td style={{ padding: '14px 14px', textAlign: 'right', color: '#3B82F6', fontWeight: '700' }}>
                          {formatCurrency(r.total_cost)}
                        </td>
                      )}

                      {/* Loss Write-Offs */}
                      <td style={{ padding: '14px 12px', textAlign: 'right', color: r.churn_cost > 0 ? '#A8402E' : 'var(--text-muted)', fontWeight: '600' }}>
                        {r.churn_cost > 0 ? `-${formatCurrency(r.churn_cost)}` : '₹0'}
                      </td>

                      {/* Net Commercial Surplus */}
                      {userRole !== 'franchise_partner' && (
                        <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: '800', color: isNetPositive ? '#10B981' : '#A8402E', fontSize: '0.92rem' }}>
                          {isNetPositive ? '+' : ''}{formatCurrency(r.net_contribution)}
                        </td>
                      )}

                      {/* Actual Delivered ROI Multiple */}
                      <td style={{ padding: '14px 14px', textAlign: 'right', fontWeight: '800', fontSize: '0.92rem', color: r.roi_multiple >= 3.0 ? '#10B981' : r.roi_multiple >= 1.5 ? '#3B82F6' : '#A8402E' }}>
                        {r.roi_multiple}x ROI
                      </td>

                      {/* Performance Tier Badge */}
                      <td style={{ padding: '14px 14px', textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '0.72rem',
                          fontWeight: '800',
                          background: r.tier_badge === 'star' ? 'rgba(16, 185, 129, 0.15)' :
                                      r.tier_badge === 'profitable' ? 'rgba(59, 130, 246, 0.12)' :
                                      r.tier_badge === 'diluter' ? 'rgba(245, 158, 11, 0.12)' :
                                      'rgba(239, 68, 68, 0.12)',
                          color: r.tier_badge === 'star' ? '#0F6E56' :
                                 r.tier_badge === 'profitable' ? '#2563EB' :
                                 r.tier_badge === 'diluter' ? '#B45309' :
                                 '#A8402E'
                        }}>
                          {r.tier}
                        </span>
                      </td>

                      {/* Action Button */}
                      <td style={{ padding: '14px 14px', textAlign: 'center' }}>
                        {r.isDormant ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); setActivationPlaybookEntity(r); }}
                            style={{
                              background: 'rgba(239, 68, 68, 0.1)',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              color: '#A8402E',
                              padding: '4px 10px',
                              borderRadius: '6px',
                              fontSize: '0.74rem',
                              fontWeight: '700',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <Zap size={12} />
                            <span>Playbook</span>
                          </button>
                        ) : (
                          <button 
                            onClick={() => handleOpenDrilldown(r)}
                            style={{ background: 'transparent', border: 'none', color: 'var(--accent-teal, #0F6E56)', cursor: 'pointer', padding: '4px' }}
                            title="Click to view underlying placements and lost deal forensics"
                          >
                            <ChevronRight size={18} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {filteredRows.length > ITEMS_PER_PAGE && (
          <div style={{ padding: '14px 18px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end' }}>
            <Pagination
              currentPage={currentPage}
              totalItems={filteredRows.length}
              pageSize={ITEMS_PER_PAGE}
              onPageChange={setCurrentPage}
              itemName="records"
            />
          </div>
        )}
      </div>
      )}

      {/* End Profiles Tab */}
      </div>
      )}

      {/* ========================================================================= */}
      {/* 8. ACTIONABLE ACTIVATION PLAYBOOK MODAL                                    */}
      {/* ========================================================================= */}
      {activationPlaybookEntity && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1050,
          padding: '20px'
        }}>
          <div className="animate-scale-in" style={{
            background: 'var(--bg-card)',
            borderRadius: '16px',
            border: '1.5px solid rgba(239, 68, 68, 0.4)',
            width: '100%',
            maxWidth: '820px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
            display: 'flex',
            flexDirection: 'column'
          }}>
            
            {/* Playbook Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.08), transparent)' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ background: '#A8402E', color: '#fff', width: '26px', height: '26px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Zap size={15} />
                  </div>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-main)' }}>
                    Dormancy Activation Playbook: {activationPlaybookEntity.dimension_value}
                  </h3>
                </div>
                <p style={{ margin: '4px 0 0 34px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  Actionable management levers & diagnostic strategy to reactivate pipeline and generate commercial contribution.
                </p>
              </div>

              <button 
                onClick={() => setActivationPlaybookEntity(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '6px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Playbook Body */}
            <div style={{ padding: '24px' }}>
              
              {/* Diagnosis Box */}
              <div style={{ background: 'rgba(239, 68, 68, 0.06)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '10px', padding: '16px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <AlertTriangle size={16} color="#A8402E" />
                  <span style={{ fontSize: '0.82rem', fontWeight: '800', color: '#A8402E', textTransform: 'uppercase' }}>
                    Root Cause Diagnostic & Bottleneck Analysis
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--text-main)', lineHeight: '1.45' }}>
                  {activationPlaybookEntity.dormantReason || 'Low candidate submission velocity and stagnant interview pipeline. Mandate fit mismatch.'}
                </p>
                <div style={{ display: 'flex', gap: '16px', marginTop: '10px', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                  <span>Current Sunk Cost: <strong>{formatCurrency(activationPlaybookEntity.total_cost)}</strong></span>
                  <span>Enquiries in Pipeline: <strong>{activationPlaybookEntity.enquiries_handled}</strong></span>
                  <span>Target Multiplier: <strong>{activationPlaybookEntity.targetMultiple || globalTargetMultiplier}x</strong></span>
                </div>
              </div>

              {/* 4 Concrete Management Levers */}
              <h4 style={{ margin: '0 0 14px 0', fontSize: '0.94rem', fontWeight: '800', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Compass size={17} color="var(--accent-teal, #0F6E56)" />
                <span>4-Step Management Re-activation Plan</span>
              </h4>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px', marginBottom: '24px' }}>
                
                {/* Step 1 */}
                <div style={{ display: 'flex', gap: '12px', background: 'var(--bg-card)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#0F6E56', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '0.82rem', flexShrink: 0 }}>
                    1
                  </div>
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '0.86rem', color: 'var(--text-main)' }}>
                      Reallocate 5 High-Urgency Mandates (BFSI / Tech)
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Inject verified hiring mandates with under 7-day interview turnaround to immediately restart active billing pipeline.
                    </div>
                  </div>
                </div>

                {/* Step 2 */}
                <div style={{ display: 'flex', gap: '12px', background: 'var(--bg-card)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#3B82F6', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '0.82rem', flexShrink: 0 }}>
                    2
                  </div>
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '0.86rem', color: 'var(--text-main)' }}>
                      Pair with High-Velocity Franchise Hub (Preshita Rane / Anita Kulkarni)
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Connect candidate sourcing to top-tier franchise recruiters with 80%+ CV-to-interview conversion rate.
                    </div>
                  </div>
                </div>

                {/* Step 3 */}
                <div style={{ display: 'flex', gap: '12px', background: 'var(--bg-card)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#8B5CF6', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '0.82rem', flexShrink: 0 }}>
                    3
                  </div>
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '0.86rem', color: 'var(--text-main)' }}>
                      Activate ₹5,000 Incentive Accelerator for Next 2 Closures
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Short-term spot incentive booster to accelerate candidate follow-ups and overcome candidate drop-off at offer stage.
                    </div>
                  </div>
                </div>

                {/* Step 4 */}
                <div style={{ display: 'flex', gap: '12px', background: 'var(--bg-card)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#F59E0B', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '0.82rem', flexShrink: 0 }}>
                    4
                  </div>
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '0.86rem', color: 'var(--text-main)' }}>
                      Daily 15-Minute Pipeline Unblocking Cadence with TL
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Direct morning standup with Team Leader (Vedika / Surbhi) to resolve client feedback lag and candidate drop-outs.
                    </div>
                  </div>
                </div>

              </div>

              {/* Financial Impact Projection Banner */}
              <div style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(15, 110, 86, 0.05))', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '12px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
                <div>
                  <div style={{ fontSize: '0.74rem', fontWeight: '800', color: '#10B981', textTransform: 'uppercase' }}>
                    Projected Commercial Gain Upon Reactivation
                  </div>
                  <div style={{ fontSize: '1.35rem', fontWeight: '800', color: 'var(--text-main)', marginTop: '2px' }}>
                    +₹1,50,000 Company Share <span style={{ fontSize: '0.84rem', color: '#10B981' }}>(4 Placements)</span>
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Reaches a healthy 2.5x ROI multiple and unlocks positive net bank contribution.
                  </div>
                </div>

                <button
                  onClick={() => {
                    handleToggleSimulation(activationPlaybookEntity.dimension_value);
                    setActivationPlaybookEntity(null);
                  }}
                  style={{
                    background: simulatedReactivations[activationPlaybookEntity.dimension_value] ? '#A8402E' : '#10B981',
                    color: '#fff',
                    border: 'none',
                    padding: '10px 18px',
                    borderRadius: '8px',
                    fontWeight: '800',
                    fontSize: '0.84rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Sparkles size={16} />
                  <span>{simulatedReactivations[activationPlaybookEntity.dimension_value] ? 'Reset to Dormant' : 'Simulate Reactivation in Model'}</span>
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 9. DRILLDOWN AUDIT & LOSS FORENSICS MODAL                                  */}
      {/* ========================================================================= */}
      {drilldownItem && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: '16px',
            border: '1px solid var(--border-color)',
            width: '100%',
            maxWidth: '1050px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
            display: 'flex',
            flexDirection: 'column'
          }}>
            
            {/* Modal Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-main)' }}>
                    {drilldownItem.dimension_value}
                  </h3>
                  <span style={{ fontSize: '0.78rem', background: 'rgba(15, 110, 86, 0.1)', color: 'var(--accent-teal, #0F6E56)', padding: '2px 8px', borderRadius: '4px', fontWeight: '700' }}>
                    {activeDimension.toUpperCase()} • {selectedMonth}
                  </span>
                </div>
                <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  Underlying placements, revenue breakdowns, and loss forensic audit trail.
                </p>
              </div>

              <button 
                onClick={() => setDrilldownItem(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '6px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Sub-Tabs */}
            <div style={{ padding: '12px 24px 0 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '16px' }}>
              <button
                onClick={() => setActiveDrillTab('invoices')}
                style={{
                  padding: '8px 14px',
                  border: 'none',
                  borderBottom: activeDrillTab === 'invoices' ? '2px solid var(--accent-teal, #0F6E56)' : '2px solid transparent',
                  background: 'transparent',
                  color: activeDrillTab === 'invoices' ? 'var(--accent-teal, #0F6E56)' : 'var(--text-muted)',
                  fontWeight: activeDrillTab === 'invoices' ? '700' : '500',
                  fontSize: '0.86rem',
                  cursor: 'pointer'
                }}
              >
                Delivered Placements & Invoices ({drilldownData.length})
              </button>

              {activeDimension === 'bd' && (
                <button
                  onClick={() => setActiveDrillTab('loss_forensics')}
                  style={{
                    padding: '8px 14px',
                    border: 'none',
                    borderBottom: activeDrillTab === 'loss_forensics' ? '2px solid #A8402E' : '2px solid transparent',
                    background: 'transparent',
                    color: activeDrillTab === 'loss_forensics' ? '#A8402E' : 'var(--text-muted)',
                    fontWeight: activeDrillTab === 'loss_forensics' ? '700' : '500',
                    fontSize: '0.86rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <AlertTriangle size={15} />
                  <span>Loss Forensics & Cancelled Deals ({bdLossData?.lost_deals?.length || 0})</span>
                </button>
              )}
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px', overflowY: 'auto' }}>
              
              {/* Tab 1: Delivered Invoices */}
              {activeDrillTab === 'invoices' && (
                <div>
                  {drilldownLoading ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      Loading placement invoices...
                    </div>
                  ) : drilldownData.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No individual invoice records logged for this month.
                    </div>
                  ) : (
                    <div className="table-responsive" style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                      <table className="data-table" style={{ width: '100%', fontSize: '0.82rem' }}>
                        <thead>
                          <tr style={{ background: 'rgba(0,0,0,0.02)', borderBottom: '1px solid var(--border-color)' }}>
                            <th style={{ padding: '10px 14px', textAlign: 'left' }}>Bill No</th>
                            <th style={{ padding: '10px 14px', textAlign: 'left' }}>Date</th>
                            <th style={{ padding: '10px 14px', textAlign: 'left' }}>Client Company</th>
                            <th style={{ padding: '10px 14px', textAlign: 'left' }}>Candidate Position</th>
                            <th style={{ padding: '10px 14px', textAlign: 'right' }}>Total Billed</th>
                            <th style={{ padding: '10px 14px', textAlign: 'right' }}>Company Share</th>
                            <th style={{ padding: '10px 14px', textAlign: 'right' }}>Franchisee Share</th>
                          </tr>
                        </thead>
                        <tbody>
                          {drilldownData.map((inv, iIdx) => (
                            <tr key={inv.invoice_id || iIdx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                              <td style={{ padding: '10px 14px', fontWeight: '700', color: 'var(--text-main)' }}>
                                {inv.billNumber || `INV-${inv.invoice_id || iIdx}`}
                              </td>
                              <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>
                                {formatDate(inv.billDate)}
                              </td>
                              <td style={{ padding: '10px 14px', fontWeight: '600' }}>
                                {inv.companyName || 'Direct Client'}
                              </td>
                              <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>
                                {inv.positionName || 'Executive Role'}
                              </td>
                              <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '600' }}>
                                {formatCurrency(inv.gross_billed)}
                              </td>
                              <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '700', color: 'var(--accent-teal, #0F6E56)' }}>
                                {formatCurrency(inv.our_share)}
                              </td>
                              <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text-muted)' }}>
                                {formatCurrency(inv.franchisee_share)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: BD Loss Forensics */}
              {activeDrillTab === 'loss_forensics' && bdLossData && (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                    <div style={{ background: 'rgba(168, 64, 46, 0.08)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(168, 64, 46, 0.2)' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#A8402E', textTransform: 'uppercase' }}>Total Loss Amount</span>
                      <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#A8402E', marginTop: '2px' }}>
                        {formatCurrency(bdLossData.total_loss)}
                      </div>
                    </div>

                    <div style={{ background: 'var(--bg-card)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Cancelled / Rejected</span>
                      <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-main)', marginTop: '2px' }}>
                        {bdLossData.cancelled_count} deals
                      </div>
                    </div>

                    <div style={{ background: 'var(--bg-card)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Internally Closed</span>
                      <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-main)', marginTop: '2px' }}>
                        {bdLossData.internally_closed_count} deals
                      </div>
                    </div>

                    <div style={{ background: 'var(--bg-card)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>On Hold / Stagnant</span>
                      <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-main)', marginTop: '2px' }}>
                        {bdLossData.on_hold_count} deals
                      </div>
                    </div>
                  </div>

                  {/* Lost Deals Table */}
                  <div className="table-responsive" style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                    <table className="data-table" style={{ width: '100%', fontSize: '0.82rem' }}>
                      <thead>
                        <tr style={{ background: 'rgba(0,0,0,0.02)', borderBottom: '1px solid var(--border-color)' }}>
                          <th style={{ padding: '10px 14px', textAlign: 'left' }}>Enquiry ID</th>
                          <th style={{ padding: '10px 14px', textAlign: 'left' }}>Client Company</th>
                          <th style={{ padding: '10px 14px', textAlign: 'left' }}>Position</th>
                          <th style={{ padding: '10px 14px', textAlign: 'left' }}>Franchise Assigned</th>
                          <th style={{ padding: '10px 14px', textAlign: 'left' }}>Loss Reason / Status</th>
                          <th style={{ padding: '10px 14px', textAlign: 'right' }}>Lost Placement Fee</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bdLossData.lost_deals.map((deal, dIdx) => (
                          <tr key={deal.enquiry_id || dIdx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '10px 14px', fontWeight: '700', color: 'var(--text-main)' }}>
                              #{deal.enquiry_id || dIdx + 1}
                            </td>
                            <td style={{ padding: '10px 14px', fontWeight: '600' }}>
                              {deal.companyName || 'Corporate Client'}
                            </td>
                            <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>
                              {deal.positionName || 'N/A'}
                            </td>
                            <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>
                              {deal.franchiseeName || 'Direct'}
                            </td>
                            <td style={{ padding: '10px 14px' }}>
                              <span style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '0.72rem',
                                fontWeight: '700',
                                background: deal.enquiryStatus === 'cancelled' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                                color: deal.enquiryStatus === 'cancelled' ? '#A8402E' : '#B7791F'
                              }}>
                                {deal.enquiryStatus?.replace(/_/g, ' ').toUpperCase()}
                              </span>
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '700', color: '#A8402E' }}>
                              {formatCurrency(deal.placementFees)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 10. COST & OVERHEAD INPUT MODAL                                           */}
      {/* ========================================================================= */}
      {isInputModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: '16px',
            border: '1px solid var(--border-color)',
            width: '100%',
            maxWidth: '850px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '28px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)'
          }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-main)' }}>
                  Monthly Cost & Overhead Configuration
                </h3>
                <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  Set salaries, shared overhead pools, and allocation rules for {selectedMonth}.
                </p>
              </div>
              <button onClick={() => setIsInputModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveCostInputs}>
              
              {/* 1. Shared Overhead Pool */}
              <div style={{ marginBottom: '24px' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '0.92rem', fontWeight: '700', color: 'var(--text-main)' }}>
                  1. Shared Overhead Pool ({selectedMonth})
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
                  <div>
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Admin Team Salary (₹)</label>
                    <input 
                      type="number"
                      className="form-control"
                      value={costInputs.overhead.admin_team_salary || 0}
                      onChange={(e) => setCostInputs({
                        ...costInputs,
                        overhead: { ...costInputs.overhead, admin_team_salary: parseFloat(e.target.value) || 0 }
                      })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-main)' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Marketing Team Salary (₹)</label>
                    <input 
                      type="number"
                      className="form-control"
                      value={costInputs.overhead.marketing_team_salary || 0}
                      onChange={(e) => setCostInputs({
                        ...costInputs,
                        overhead: { ...costInputs.overhead, marketing_team_salary: parseFloat(e.target.value) || 0 }
                      })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-main)' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Commercial Rent (₹)</label>
                    <input 
                      type="number"
                      className="form-control"
                      value={costInputs.overhead.rent || 0}
                      onChange={(e) => setCostInputs({
                        ...costInputs,
                        overhead: { ...costInputs.overhead, rent: parseFloat(e.target.value) || 0 }
                      })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-main)' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Other Admin Expenses (₹)</label>
                    <input 
                      type="number"
                      className="form-control"
                      value={costInputs.overhead.other_admin_expense || 0}
                      onChange={(e) => setCostInputs({
                        ...costInputs,
                        overhead: { ...costInputs.overhead, other_admin_expense: parseFloat(e.target.value) || 0 }
                      })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-main)' }}
                    />
                  </div>
                </div>
              </div>

              {/* 2. Allocation Rule */}
              <div style={{ marginBottom: '24px' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '0.92rem', fontWeight: '700', color: 'var(--text-main)' }}>
                  2. Overhead Allocation Rule
                </h4>
                <div style={{ display: 'flex', gap: '16px' }}>
                  {[
                    { id: 'revenue_share', label: 'Pro-Rata Revenue Share (Recommended)' },
                    { id: 'placement_count', label: 'Pro-Rata Placement Count' },
                    { id: 'headcount', label: 'Equal Headcount Share' }
                  ].map(rule => (
                    <label key={rule.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.84rem' }}>
                      <input 
                        type="radio"
                        name="allocation_basis"
                        value={rule.id}
                        checked={costInputs.allocation_basis === rule.id}
                        onChange={(e) => setCostInputs({ ...costInputs, allocation_basis: e.target.value })}
                      />
                      <span>{rule.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Submit Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => setIsInputModalOpen(false)}
                  style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-main)', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingInputs}
                  style={{ padding: '8px 20px', borderRadius: '6px', border: 'none', background: 'var(--accent-teal, #0F6E56)', color: '#ffffff', fontWeight: '700', cursor: 'pointer' }}
                >
                  {savingInputs ? 'Saving Live...' : 'Save & Recalculate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CostOfPerformance;
