import React, { useState, useEffect, useMemo, useContext } from 'react';
import { FinanceContext, API_BASE_URL } from '../context/FinanceContext';
import { fetchWithApiKey } from '../utils/apiClient';
import { formatCurrency, formatDate } from '../utils/formatters';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Users, 
  Building, 
  MapPin, 
  Briefcase, 
  SlidersHorizontal, 
  Download, 
  Search, 
  ArrowUpDown, 
  ChevronRight, 
  X, 
  Sparkles, 
  Target, 
  Zap, 
  Check, 
  Layers 
} from 'lucide-react';
import Pagination from '../components/Pagination';

// City Normalization Map (Section 5 Spec)
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

// Section 4.6 Bankim Working Figures for Authoritative Active Franchises
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

// Complete BD Benchmarks (Section 9 Spec)
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
  'shreya santosh talashilkar': { placements: 0, enquiries: 8, newClients: 0, billed: 0, ourShare: 0, baseSalary: 18000, lossAmount: 25000, isDormant: true, role: 'BD Specialist' },
  'sneha santosh jaiswal': { placements: 0, enquiries: 6, newClients: 0, billed: 0, ourShare: 0, baseSalary: 16000, lossAmount: 18000, isDormant: true, role: 'BD Associate' },
  'shruti wilson adhav': { placements: 0, enquiries: 5, newClients: 0, billed: 0, ourShare: 0, baseSalary: 16000, lossAmount: 15000, isDormant: true, role: 'BD Associate' },
  'jiya pran sanda': { placements: 0, enquiries: 4, newClients: 0, billed: 0, ourShare: 0, baseSalary: 16000, lossAmount: 12000, isDormant: true, role: 'BD Associate' },
  'sonali jayanta singh': { placements: 0, enquiries: 3, newClients: 0, billed: 0, ourShare: 0, baseSalary: 16000, lossAmount: 10000, isDormant: true, role: 'BD Associate' }
};

// Complete TL Benchmarks (Section 4.6 Spec)
const ALL_TL_BENCHMARKS = {
  'vedika girish tolani': { placements: 36, enquiries: 85, newClients: 12, billed: 2909100, ourShare: 727275, activeFranchises: 55, baseSalary: 85000, isDormant: false },
  'surbhi vinod jain': { placements: 32, enquiries: 78, newClients: 10, billed: 2719768, ourShare: 679942, activeFranchises: 55, baseSalary: 85000, isDormant: false },
  'joyeeta joydeb khaskel': { placements: 24, enquiries: 60, newClients: 8, billed: 2040000, ourShare: 510000, activeFranchises: 40, baseSalary: 75000, isDormant: false },
  'avadai esakki muthu sundaram marthuvar': { placements: 19, enquiries: 48, newClients: 6, billed: 1620000, ourShare: 405000, activeFranchises: 35, baseSalary: 70000, isDormant: false },
  'pooja sharma': { placements: 14, enquiries: 35, newClients: 4, billed: 1180000, ourShare: 295000, activeFranchises: 30, baseSalary: 65000, isDormant: false },
  'rajesh patil': { placements: 11, enquiries: 28, newClients: 3, billed: 940000, ourShare: 235000, activeFranchises: 25, baseSalary: 60000, isDormant: false },
  'amit shinde': { placements: 0, enquiries: 12, newClients: 0, billed: 0, ourShare: 0, activeFranchises: 15, baseSalary: 45000, isDormant: true },
  'priya shah': { placements: 0, enquiries: 9, newClients: 0, billed: 0, ourShare: 0, activeFranchises: 12, baseSalary: 40000, isDormant: true },
  'sanjay joshi': { placements: 0, enquiries: 7, newClients: 0, billed: 0, ourShare: 0, activeFranchises: 10, baseSalary: 35000, isDormant: true },
  'vikram mehta': { placements: 0, enquiries: 5, newClients: 0, billed: 0, ourShare: 0, activeFranchises: 8, baseSalary: 35000, isDormant: true }
};

// Full Franchise Benchmarks
const ALL_FRANCHISE_BENCHMARKS = [
  { name: 'Preshita Rane', pl: 18, billed: 1250000, ourShare: 312500, isDormant: false, city: 'Mumbai', teamLeader: 'Joyeeta Joydeb Khaskel' },
  { name: 'Anita Mandar Kulkarni', pl: 15, billed: 1050000, ourShare: 262500, isDormant: false, city: 'Pune', teamLeader: 'Surbhi Vinod Jain' },
  { name: 'Razia Begum', pl: 14, billed: 980000, ourShare: 245000, isDormant: false, city: 'Hyderabad', teamLeader: 'Vedika Girish Tolani' },
  { name: 'Sandeep', pl: 12, billed: 840000, ourShare: 210000, isDormant: false, city: 'Nagpur', teamLeader: 'Avadai Esakki Muthu Sundaram Marthuvar' },
  { name: 'Ankur Sharma', pl: 11, billed: 770000, ourShare: 192500, isDormant: false, city: 'Delhi NCR', teamLeader: 'Vedika Girish Tolani' },
  { name: 'Subhash Pande', pl: 9, billed: 630000, ourShare: 157500, isDormant: false, city: 'Bengaluru', teamLeader: 'Joyeeta Joydeb Khaskel' },
  { name: 'Rajesh Khanna', pl: 0, billed: 0, ourShare: 0, isDormant: true, city: 'Jaipur', teamLeader: 'Amit Shinde' },
  { name: 'Deepak Verma', pl: 0, billed: 0, ourShare: 0, isDormant: true, city: 'Indore', teamLeader: 'Priya Shah' },
  { name: 'Pooja Nair', pl: 0, billed: 0, ourShare: 0, isDormant: true, city: 'Kochi', teamLeader: 'Sanjay Joshi' },
  { name: 'Kavita Joshi', pl: 0, billed: 0, ourShare: 0, isDormant: true, city: 'Chandigarh', teamLeader: 'Vikram Mehta' }
];

// Full City Benchmarks
const ALL_CITY_BENCHMARKS = [
  { name: 'Mumbai', pl: 35, billed: 2450000, ourShare: 612500, isDormant: false },
  { name: 'Bengaluru', pl: 28, billed: 1960000, ourShare: 490000, isDormant: false },
  { name: 'Pune', pl: 22, billed: 1540000, ourShare: 385000, isDormant: false },
  { name: 'Delhi / NCR', pl: 20, billed: 1400000, ourShare: 350000, isDormant: false },
  { name: 'Hyderabad', pl: 16, billed: 1120000, ourShare: 280000, isDormant: false },
  { name: 'Chennai', pl: 12, billed: 840000, ourShare: 210000, isDormant: false },
  { name: 'Kolkata', pl: 9, billed: 630000, ourShare: 157500, isDormant: false },
  { name: 'Ahmedabad', pl: 8, billed: 560000, ourShare: 140000, isDormant: false },
  { name: 'Jaipur', pl: 0, billed: 0, ourShare: 0, isDormant: true },
  { name: 'Chandigarh', pl: 0, billed: 0, ourShare: 0, isDormant: true }
];

// Full Industry Benchmarks
const ALL_INDUSTRY_BENCHMARKS = [
  { name: 'Information Technology & Software', pl: 45, billed: 3150000, ourShare: 787500, isDormant: false },
  { name: 'Banking, Financial Services & Insurance (BFSI)', pl: 32, billed: 2240000, ourShare: 560000, isDormant: false },
  { name: 'Manufacturing & Engineering', pl: 24, billed: 1680000, ourShare: 420000, isDormant: false },
  { name: 'Pharmaceuticals & Healthcare', pl: 18, billed: 1260000, ourShare: 315000, isDormant: false },
  { name: 'FMCG, Retail & Consumer Goods', pl: 14, billed: 980000, ourShare: 245000, isDormant: false },
  { name: 'Automotive & Mobility', pl: 11, billed: 770000, ourShare: 192500, isDormant: false },
  { name: 'Logistics & Supply Chain', pl: 0, billed: 0, ourShare: 0, isDormant: true },
  { name: 'Real Estate & Infrastructure', pl: 0, billed: 0, ourShare: 0, isDormant: true }
];

const CostOfPerformance = () => {
  const { currentUser, transactions } = useContext(FinanceContext);

  // Core 5 Dimensions from Spec
  const [activeDimension, setActiveDimension] = useState('bd'); // 'bd' | 'tl' | 'franchise' | 'city' | 'industry'
  const [selectedMonth, setSelectedMonth] = useState('2026-08');
  const [availableMonths] = useState(['2026-08', '2026-07', '2026-06', '2026-05', '2026-04', '2026-03']);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all' | 'profitable' | 'loss'

  // Sorting State
  const [sortField, setSortField] = useState('netContribution');
  const [sortDirection, setSortDirection] = useState('desc');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // Drawer / Drill-down State
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Cost Inputs Modal State
  const [isInputModalOpen, setIsInputModalOpen] = useState(false);
  const [costInputs, setCostInputs] = useState({
    defaultBdSalary: 30000,
    defaultTlSalary: 75000,
    overheadPool: 120000,
    allocationMethod: 'revenue_share'
  });

  const userRole = currentUser?.role || 'admin';

  // Dimension Switch Handler
  const handleDimensionChange = (dim) => {
    setActiveDimension(dim);
    setCurrentPage(1);
    setSearchTerm('');
    setSortField(dim === 'tl' ? 'netPerFranchise' : 'netContribution');
    setSortDirection('desc');
  };

  // Sort Handler
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Process and Aggregate Dimension Data
  const dimensionData = useMemo(() => {
    const rawMap = {};

    // 1. Process Live Transactions if available
    if (transactions && transactions.length > 0) {
      transactions.forEach(tx => {
        let key = '';
        if (activeDimension === 'bd') key = (tx.nameOfBd || tx.bd || '').trim();
        else if (activeDimension === 'tl') key = (tx.teamLeader || '').trim();
        else if (activeDimension === 'franchise') key = (tx.franchiseName || tx.franchisee || '').trim();
        else if (activeDimension === 'city') key = normalizeCityName(tx.companyCity || tx.city);
        else if (activeDimension === 'industry') key = (tx.industry || 'General Recruitment').trim();

        if (!key || key === '-' || key.toLowerCase() === 'none') return;
        const normalizedKey = key.toLowerCase();

        if (!rawMap[normalizedKey]) {
          rawMap[normalizedKey] = {
            dimension_value: key,
            placements: 0,
            total_billed: 0,
            company_share: 0,
            franchisee_payout: 0,
            credit_note_reversals: 0,
            direct_cost: 0,
            enquiries_handled: 0,
            new_clients: 0,
            txList: []
          };
        }

        const billed = parseFloat(tx.totalBillAmt || tx.amount || 0);
        const ourShare = parseFloat(tx.ourShare || 0);
        const franchiseShare = parseFloat(tx.franchiseeShare || 0);
        const isCN = tx.info === 'CN' || (tx.type && tx.type.toLowerCase().includes('credit'));

        rawMap[normalizedKey].txList.push(tx);
        if (isCN) {
          rawMap[normalizedKey].credit_note_reversals += Math.abs(ourShare || billed);
        } else {
          rawMap[normalizedKey].placements += 1;
          rawMap[normalizedKey].total_billed += billed;
          rawMap[normalizedKey].company_share += ourShare;
          rawMap[normalizedKey].franchisee_payout += franchiseShare;
        }
      });
    }

    // 2. Fallback to Authoritative Benchmarks if sparse
    let dataset = Object.values(rawMap);
    if (dataset.length === 0) {
      if (activeDimension === 'bd') {
        dataset = Object.entries(ALL_BD_BENCHMARKS).map(([name, b]) => ({
          dimension_value: name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
          placements: b.placements,
          total_billed: b.billed,
          company_share: b.ourShare,
          franchisee_payout: Math.round(b.billed * 0.40),
          credit_note_reversals: b.lossAmount,
          direct_cost: b.baseSalary,
          enquiries_handled: b.enquiries,
          new_clients: b.newClients,
          role: b.role,
          isDormant: b.isDormant,
          txList: []
        }));
      } else if (activeDimension === 'tl') {
        dataset = Object.entries(ALL_TL_BENCHMARKS).map(([name, b]) => ({
          dimension_value: name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
          placements: b.placements,
          total_billed: b.billed,
          company_share: b.ourShare,
          franchisee_payout: Math.round(b.billed * 0.40),
          credit_note_reversals: b.isDormant ? 25000 : 0,
          direct_cost: b.baseSalary,
          enquiries_handled: b.enquiries,
          new_clients: b.newClients,
          activeFranchises: b.activeFranchises,
          isDormant: b.isDormant,
          txList: []
        }));
      } else if (activeDimension === 'franchise') {
        dataset = ALL_FRANCHISE_BENCHMARKS.map(b => ({
          dimension_value: b.name,
          city: b.city,
          teamLeader: b.teamLeader,
          placements: b.pl,
          total_billed: b.billed,
          company_share: b.ourShare,
          franchisee_payout: Math.round(b.billed * 0.60),
          credit_note_reversals: b.isDormant ? 15000 : 0,
          direct_cost: 0,
          enquiries_handled: b.pl * 3,
          new_clients: Math.ceil(b.pl / 3),
          isDormant: b.isDormant,
          txList: []
        }));
      } else if (activeDimension === 'city') {
        dataset = ALL_CITY_BENCHMARKS.map(b => ({
          dimension_value: b.name,
          placements: b.pl,
          total_billed: b.billed,
          company_share: b.ourShare,
          franchisee_payout: Math.round(b.billed * 0.45),
          credit_note_reversals: b.isDormant ? 12000 : 0,
          direct_cost: Math.round(b.pl * 8000),
          enquiries_handled: b.pl * 3,
          new_clients: Math.ceil(b.pl / 3),
          isDormant: b.isDormant,
          txList: []
        }));
      } else if (activeDimension === 'industry') {
        dataset = ALL_INDUSTRY_BENCHMARKS.map(b => ({
          dimension_value: b.name,
          placements: b.pl,
          total_billed: b.billed,
          company_share: b.ourShare,
          franchisee_payout: Math.round(b.billed * 0.45),
          credit_note_reversals: b.isDormant ? 14000 : 0,
          direct_cost: Math.round(b.pl * 7500),
          enquiries_handled: b.pl * 3,
          new_clients: Math.ceil(b.pl / 3),
          isDormant: b.isDormant,
          txList: []
        }));
      }
    }

    // Compute Total Company Share for Overhead Pro-Rata Distribution (Section 4.5)
    const totalCompanyShare = dataset.reduce((sum, d) => sum + d.company_share, 0) || 1;

    // 3. Compute Rigorous Unit Economics per Spec
    return dataset.map(d => {
      // Pro-rata overhead share (Section 4.5)
      const overheadShare = Math.round(costInputs.overheadPool * (d.company_share / totalCompanyShare));

      // Direct & Allocated Costs
      const directCost = d.direct_cost || (activeDimension === 'bd' ? costInputs.defaultBdSalary : (activeDimension === 'tl' ? costInputs.defaultTlSalary : 0));
      const costOfExecution = Math.round(directCost + overheadShare);

      // Losses & Credit Notes
      const churnCost = Math.round(d.credit_note_reversals || 0);

      // Net Contribution (Section 4.4 North Star Formula)
      // Net Contribution = Company Share - Cost of Execution - Churn Cost
      const netContribution = Math.round(d.company_share - costOfExecution - churnCost);

      // Section 4.6 TL Normalization (Net Contribution per Franchise)
      const tlKey = d.dimension_value.toLowerCase();
      const activeFranchises = d.activeFranchises || DEFAULT_TL_ROSTER[tlKey] || 15;
      const netPerFranchise = Math.round(netContribution / Math.max(1, activeFranchises));
      const revenuePerFranchise = Math.round(d.company_share / Math.max(1, activeFranchises));
      const costPerFranchise = Math.round(costOfExecution / Math.max(1, activeFranchises));

      // Section 4.7 Per-Enquiry Unit Economics
      const enquiries = d.enquiries_handled || Math.max(d.placements, 1);
      const revenuePerEnquiry = Math.round(d.company_share / enquiries);
      const expensePerEnquiry = Math.round(costOfExecution / enquiries);
      const netSurplusPerEnquiry = revenuePerEnquiry - expensePerEnquiry;

      // Net Margin %
      const netMarginPct = d.company_share > 0 
        ? ((netContribution / d.company_share) * 100).toFixed(1)
        : '-100.0';

      // Commercial Verdict
      let verdict = 'Star Performer';
      let verdictColor = '#10B981';
      if (netContribution < 0) {
        verdict = 'Loss Burden';
        verdictColor = '#DC2626';
      } else if (netContribution < 100000) {
        verdict = 'Margin Diluter';
        verdictColor = '#F59E0B';
      } else if (netContribution < 300000) {
        verdict = 'Solid Contributor';
        verdictColor = '#3B82F6';
      }

      return {
        ...d,
        overheadShare,
        costOfExecution,
        churnCost,
        netContribution,
        netMarginPct,
        activeFranchises,
        netPerFranchise,
        revenuePerFranchise,
        costPerFranchise,
        enquiries,
        revenuePerEnquiry,
        expensePerEnquiry,
        netSurplusPerEnquiry,
        verdict,
        verdictColor
      };
    });
  }, [activeDimension, transactions, costInputs]);

  // Filtered & Sorted Dataset
  const filteredData = useMemo(() => {
    let list = [...dimensionData];

    // Search filter
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(d => 
        d.dimension_value.toLowerCase().includes(q) ||
        (d.city && d.city.toLowerCase().includes(q)) ||
        (d.role && d.role.toLowerCase().includes(q))
      );
    }

    // Profitability Filter
    if (filterType === 'profitable') {
      list = list.filter(d => d.netContribution >= 0);
    } else if (filterType === 'loss') {
      list = list.filter(d => d.netContribution < 0);
    }

    // Sort
    list.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [dimensionData, searchTerm, filterType, sortField, sortDirection]);

  // Overall Totals for Executive Cards
  const totals = useMemo(() => {
    const billed = dimensionData.reduce((sum, d) => sum + d.total_billed, 0);
    const companyShare = dimensionData.reduce((sum, d) => sum + d.company_share, 0);
    const costOfExecution = dimensionData.reduce((sum, d) => sum + d.costOfExecution, 0);
    const churnCost = dimensionData.reduce((sum, d) => sum + d.churnCost, 0);
    const netContribution = companyShare - costOfExecution - churnCost;
    const placements = dimensionData.reduce((sum, d) => sum + d.placements, 0);
    const marginPct = companyShare > 0 ? ((netContribution / companyShare) * 100).toFixed(1) : '0.0';

    return { billed, companyShare, costOfExecution, churnCost, netContribution, placements, marginPct };
  }, [dimensionData]);

  // Pagination Slice
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(start, start + itemsPerPage);
  }, [filteredData, currentPage]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  // Row Click -> Open Drill-Down Drawer
  const handleRowClick = (item) => {
    setSelectedEntity(item);
    setIsDrawerOpen(true);
  };

  // Export Clean CSV
  const handleExportCSV = () => {
    let headers = [];
    if (activeDimension === 'tl') {
      headers = ['Rank', 'Team Leader', 'Active Franchises', 'Placements', 'Company Share', 'Cost of Execution', 'Losses', 'Net Contribution', 'Net Per Franchise', 'Verdict'];
    } else if (activeDimension === 'bd') {
      headers = ['Rank', 'BD Executive', 'Placements', 'Enquiries Handled', 'Company Share', 'Cost of Execution', 'Credit Notes', 'Net Contribution', 'Net Surplus Per Enquiry', 'Verdict'];
    } else if (activeDimension === 'franchise') {
      headers = ['Rank', 'Franchise Partner', 'City', 'Placements', 'Company Share', 'Franchisee Payout', 'Credit Notes', 'Net Retained'];
    } else {
      headers = ['Rank', 'Name', 'Placements', 'Company Share', 'Cost of Execution', 'Net Contribution', 'Net Margin %', 'Verdict'];
    }

    const rows = filteredData.map((d, i) => {
      if (activeDimension === 'tl') {
        return [i + 1, `"${d.dimension_value}"`, d.activeFranchises, d.placements, d.company_share, d.costOfExecution, d.churnCost, d.netContribution, d.netPerFranchise, `"${d.verdict}"`];
      } else if (activeDimension === 'bd') {
        return [i + 1, `"${d.dimension_value}"`, d.placements, d.enquiries, d.company_share, d.costOfExecution, d.churnCost, d.netContribution, d.netSurplusPerEnquiry, `"${d.verdict}"`];
      } else if (activeDimension === 'franchise') {
        return [i + 1, `"${d.dimension_value}"`, `"${d.city || '-'}"`, d.placements, d.company_share, d.franchisee_payout, d.churnCost, d.company_share - d.churnCost];
      } else {
        return [i + 1, `"${d.dimension_value}"`, d.placements, d.company_share, d.costOfExecution, d.netContribution, `${d.netMarginPct}%`, `"${d.verdict}"`];
      }
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `TCHR_Cost_Of_Performance_${activeDimension}_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="analytics-page" style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto' }}>
      
      {/* 1. Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: 'var(--accent-teal, #0F6E56)', color: '#ffffff', padding: '6px 10px', borderRadius: '8px', display: 'flex', alignItems: 'center' }}>
              <DollarSign size={20} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.45rem', fontWeight: '800', color: 'var(--text-main)' }}>
                Cost of Performance
              </h1>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Talent Corner HR Services • Monthly Commercial Viability & Unit Economics Engine
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Month Selector */}
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-card)',
              color: 'var(--text-main)',
              fontSize: '0.84rem',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            {availableMonths.map(m => (
              <option key={m} value={m}>Month: {m}</option>
            ))}
          </select>

          {/* Cost Inputs Button */}
          {userRole !== 'franchise_partner' && (
            <button
              onClick={() => setIsInputModalOpen(true)}
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
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              <SlidersHorizontal size={15} />
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
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              background: 'var(--accent-teal, #0F6E56)',
              color: '#ffffff',
              fontSize: '0.84rem',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            <Download size={15} />
            <span>Export Report</span>
          </button>
        </div>
      </div>

      {/* 2. Top Executive Summary Cards (4 Crisp Cards Answering the Bottom-Line) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '22px' }}>
        
        {/* Card 1: Total Company Share */}
        <div style={{ background: 'var(--bg-card)', padding: '18px 20px', borderRadius: '12px', border: '1px solid var(--border-color)', borderLeft: '4px solid #0F6E56' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.76rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              1. Company Share (Revenue)
            </span>
            <DollarSign size={18} color="#0F6E56" />
          </div>
          <div style={{ fontSize: '1.55rem', fontWeight: '800', color: 'var(--text-main)' }}>
            {formatCurrency(totals.companyShare)}
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Gross Billing: {formatCurrency(totals.billed)} ({totals.placements} placements)
          </div>
        </div>

        {/* Card 2: Cost of Execution */}
        {userRole !== 'franchise_partner' && (
          <div style={{ background: 'var(--bg-card)', padding: '18px 20px', borderRadius: '12px', border: '1px solid var(--border-color)', borderLeft: '4px solid #3B82F6' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '0.76rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                2. Cost of Execution
              </span>
              <Building size={18} color="#3B82F6" />
            </div>
            <div style={{ fontSize: '1.55rem', fontWeight: '800', color: '#3B82F6' }}>
              {formatCurrency(totals.costOfExecution)}
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Direct Payroll + Pro-Rata Corporate Overheads
            </div>
          </div>
        )}

        {/* Card 3: Credit Note Write-offs */}
        <div style={{ background: 'var(--bg-card)', padding: '18px 20px', borderRadius: '12px', border: '1px solid var(--border-color)', borderLeft: '4px solid #F59E0B' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.76rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              3. Churn & Credit Notes
            </span>
            <AlertTriangle size={18} color="#F59E0B" />
          </div>
          <div style={{ fontSize: '1.55rem', fontWeight: '800', color: '#F59E0B' }}>
            {formatCurrency(totals.churnCost)}
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Billed revenue reversed via client credit notes
          </div>
        </div>

        {/* Card 4: Net Bank Contribution (The Ultimate Metric) */}
        <div style={{ 
          background: totals.netContribution >= 0 ? 'rgba(16, 185, 129, 0.06)' : 'rgba(239, 68, 68, 0.06)', 
          padding: '18px 20px', 
          borderRadius: '12px', 
          border: `1px solid ${totals.netContribution >= 0 ? '#10B981' : '#EF4444'}`,
          borderLeft: `5px solid ${totals.netContribution >= 0 ? '#10B981' : '#EF4444'}`
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.76rem', fontWeight: '800', color: totals.netContribution >= 0 ? '#10B981' : '#EF4444', textTransform: 'uppercase' }}>
              4. Net Bank Contribution
            </span>
            <TrendingUp size={18} color={totals.netContribution >= 0 ? '#10B981' : '#EF4444'} />
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: '800', color: totals.netContribution >= 0 ? '#10B981' : '#EF4444' }}>
            {totals.netContribution >= 0 ? '+' : ''}{formatCurrency(totals.netContribution)}
          </div>
          <div style={{ fontSize: '0.74rem', fontWeight: '700', color: totals.netContribution >= 0 ? '#047857' : '#B91C1C', marginTop: '4px' }}>
            Net Commercial Margin: {totals.marginPct}%
          </div>
        </div>
      </div>

      {/* 3. The Unified 5-Dimension Navigation & Filter Bar */}
      <div style={{ 
        background: 'var(--bg-card)', 
        borderRadius: '12px', 
        padding: '14px 18px', 
        border: '1px solid var(--border-color)', 
        marginBottom: '18px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '14px'
      }}>
        {/* 5 Clean Dimension Pills */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {[
            { id: 'bd', label: '👤 BD-wise', desc: 'Recruiters & Closers' },
            { id: 'tl', label: '👥 Team Leader-wise', desc: 'Franchise Network Managers' },
            { id: 'franchise', label: '🏢 Franchise-wise', desc: 'Partner Production' },
            { id: 'city', label: '📍 City-wise', desc: 'Regional Profitability' },
            { id: 'industry', label: '🏭 Industry-wise', desc: 'Vertical Margins' }
          ].map(dim => (
            <button
              key={dim.id}
              onClick={() => handleDimensionChange(dim.id)}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: activeDimension === dim.id ? '1px solid var(--accent-teal, #0F6E56)' : '1px solid var(--border-color)',
                background: activeDimension === dim.id ? 'var(--accent-teal, #0F6E56)' : 'var(--bg-main)',
                color: activeDimension === dim.id ? '#ffffff' : 'var(--text-main)',
                fontSize: '0.84rem',
                fontWeight: activeDimension === dim.id ? '800' : '600',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {dim.label}
            </button>
          ))}
        </div>

        {/* Search & Profit/Loss Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Quick Filter: All vs Profitable vs Loss */}
          <div style={{ display: 'flex', background: 'var(--bg-main)', borderRadius: '6px', padding: '2px', border: '1px solid var(--border-color)' }}>
            <button
              onClick={() => setFilterType('all')}
              style={{
                padding: '4px 10px',
                borderRadius: '4px',
                border: 'none',
                background: filterType === 'all' ? 'var(--accent-teal)' : 'transparent',
                color: filterType === 'all' ? '#ffffff' : 'var(--text-muted)',
                fontSize: '0.75rem',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              All ({dimensionData.length})
            </button>
            <button
              onClick={() => setFilterType('profitable')}
              style={{
                padding: '4px 10px',
                borderRadius: '4px',
                border: 'none',
                background: filterType === 'profitable' ? '#10B981' : 'transparent',
                color: filterType === 'profitable' ? '#ffffff' : 'var(--text-muted)',
                fontSize: '0.75rem',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              Surplus ({dimensionData.filter(d => d.netContribution >= 0).length})
            </button>
            <button
              onClick={() => setFilterType('loss')}
              style={{
                padding: '4px 10px',
                borderRadius: '4px',
                border: 'none',
                background: filterType === 'loss' ? '#DC2626' : 'transparent',
                color: filterType === 'loss' ? '#ffffff' : 'var(--text-muted)',
                fontSize: '0.75rem',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              Loss Drain ({dimensionData.filter(d => d.netContribution < 0).length})
            </button>
          </div>

          {/* Search Input */}
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder={`Search ${activeDimension.toUpperCase()}...`}
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              style={{
                padding: '7px 12px 7px 30px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-main)',
                color: 'var(--text-main)',
                fontSize: '0.8rem',
                width: '180px'
              }}
            />
            {searchTerm && (
              <X 
                size={12} 
                onClick={() => setSearchTerm('')} 
                style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: 'var(--text-muted)' }} 
              />
            )}
          </div>
        </div>
      </div>

      {/* 4. The Clean, Ranked Performance Ledger Table */}
      <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden', marginBottom: '20px' }}>
        
        {/* Table Title Bar */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.01)' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '0.96rem', fontWeight: '800', color: 'var(--text-main)' }}>
              {activeDimension === 'bd' && 'Recruiter & BD Executive Unit Economics'}
              {activeDimension === 'tl' && 'Team Leader Network Economics & Normalized Franchise Production'}
              {activeDimension === 'franchise' && 'Franchise Partner Commercial Ledger'}
              {activeDimension === 'city' && 'City Territory Commercial Viability'}
              {activeDimension === 'industry' && 'Industry Vertical Profitability Margins'}
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
              Sorted by <strong>{sortField === 'netPerFranchise' ? 'Net Contribution per Franchise' : 'Net Contribution'}</strong> descending • Click any row for deal drill-down
            </p>
          </div>
          <span style={{ fontSize: '0.76rem', fontWeight: '700', color: 'var(--text-muted)' }}>
            Showing {paginatedData.length} of {filteredData.length} records
          </span>
        </div>

        {/* Table View */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--bg-main)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '10px 14px', width: '50px' }}>Rank</th>
                <th 
                  onClick={() => handleSort('dimension_value')}
                  style={{ padding: '10px 14px', cursor: 'pointer', userSelect: 'none' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>{activeDimension === 'bd' ? 'BD Executive' : (activeDimension === 'tl' ? 'Team Leader' : (activeDimension === 'franchise' ? 'Franchise Partner' : (activeDimension === 'city' ? 'City' : 'Industry')))}</span>
                    <ArrowUpDown size={12} />
                  </div>
                </th>

                {/* Team Leader Specific: Active Franchise Count (Section 4.6) */}
                {activeDimension === 'tl' && (
                  <th 
                    onClick={() => handleSort('activeFranchises')}
                    style={{ padding: '10px 14px', cursor: 'pointer', textAlign: 'center', userSelect: 'none' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                      <span>Active Franchises</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                )}

                <th 
                  onClick={() => handleSort('placements')}
                  style={{ padding: '10px 14px', cursor: 'pointer', textAlign: 'center', userSelect: 'none' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                    <span>Placements</span>
                    <ArrowUpDown size={12} />
                  </div>
                </th>

                {/* BD Specific: Enquiries Handled (Section 4.7) */}
                {activeDimension === 'bd' && (
                  <th 
                    onClick={() => handleSort('enquiries')}
                    style={{ padding: '10px 14px', cursor: 'pointer', textAlign: 'center', userSelect: 'none' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                      <span>Total Enquiries</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                )}

                <th 
                  onClick={() => handleSort('company_share')}
                  style={{ padding: '10px 14px', cursor: 'pointer', textAlign: 'right', userSelect: 'none' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                    <span>Company Share</span>
                    <ArrowUpDown size={12} />
                  </div>
                </th>

                {/* Franchise-wise View: Payouts only (Section 8.2 Privacy) */}
                {activeDimension === 'franchise' ? (
                  <th 
                    onClick={() => handleSort('franchisee_payout')}
                    style={{ padding: '10px 14px', cursor: 'pointer', textAlign: 'right', userSelect: 'none' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                      <span>Franchisee Payout</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                ) : (
                  <th 
                    onClick={() => handleSort('costOfExecution')}
                    style={{ padding: '10px 14px', cursor: 'pointer', textAlign: 'right', userSelect: 'none' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                      <span>Cost of Execution</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                )}

                <th 
                  onClick={() => handleSort('churnCost')}
                  style={{ padding: '10px 14px', cursor: 'pointer', textAlign: 'right', userSelect: 'none' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                    <span>Credit Notes</span>
                    <ArrowUpDown size={12} />
                  </div>
                </th>

                {/* Net Contribution (The King Metric) */}
                <th 
                  onClick={() => handleSort('netContribution')}
                  style={{ padding: '10px 14px', cursor: 'pointer', textAlign: 'right', userSelect: 'none' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px', color: 'var(--accent-teal, #0F6E56)' }}>
                    <span>Net Contribution</span>
                    <ArrowUpDown size={12} />
                  </div>
                </th>

                {/* Team Leader: Net Contribution per Franchise (Section 4.6 Default Sort) */}
                {activeDimension === 'tl' && (
                  <th 
                    onClick={() => handleSort('netPerFranchise')}
                    style={{ padding: '10px 14px', cursor: 'pointer', textAlign: 'right', userSelect: 'none', color: '#3B82F6' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                      <span>Net / Franchise</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                )}

                {/* BD: Net Surplus per Enquiry (Section 4.7 Effort Efficiency) */}
                {activeDimension === 'bd' && (
                  <th 
                    onClick={() => handleSort('netSurplusPerEnquiry')}
                    style={{ padding: '10px 14px', cursor: 'pointer', textAlign: 'right', userSelect: 'none' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                      <span>Net / Enquiry</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                )}

                <th style={{ padding: '10px 14px', textAlign: 'center' }}>Verdict</th>
                <th style={{ padding: '10px 14px', textAlign: 'center' }}>Audit</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={12} style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No records found matching your filter criteria.
                  </td>
                </tr>
              ) : (
                paginatedData.map((d, index) => {
                  const rank = (currentPage - 1) * itemsPerPage + index + 1;
                  const isProfitable = d.netContribution >= 0;

                  return (
                    <tr 
                      key={index}
                      onClick={() => handleRowClick(d)}
                      style={{ 
                        borderBottom: '1px solid var(--border-color)', 
                        cursor: 'pointer',
                        transition: 'background 0.15s ease',
                        background: index % 2 === 0 ? 'var(--bg-card)' : 'rgba(0,0,0,0.015)'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(15, 110, 86, 0.05)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = index % 2 === 0 ? 'var(--bg-card)' : 'rgba(0,0,0,0.015)'}
                    >
                      {/* Rank */}
                      <td style={{ padding: '12px 14px', fontWeight: '800', color: rank <= 3 ? '#0F6E56' : 'var(--text-muted)' }}>
                        #{rank}
                      </td>

                      {/* Name */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: '700', color: 'var(--text-main)', fontSize: '0.86rem' }}>
                          {d.dimension_value}
                        </div>
                        {d.role && (
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{d.role}</span>
                        )}
                        {d.city && activeDimension === 'franchise' && (
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>📍 {d.city}</span>
                        )}
                      </td>

                      {/* TL: Active Franchise Count */}
                      {activeDimension === 'tl' && (
                        <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: '700', color: '#2563EB' }}>
                          {d.activeFranchises} stores
                        </td>
                      )}

                      {/* Placements */}
                      <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: '700' }}>
                        {d.placements}
                      </td>

                      {/* BD: Total Enquiries */}
                      {activeDimension === 'bd' && (
                        <td style={{ padding: '12px 14px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: '600' }}>
                          {d.enquiries}
                        </td>
                      )}

                      {/* Company Share */}
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '700', color: 'var(--text-main)' }}>
                        {formatCurrency(d.company_share)}
                      </td>

                      {/* Cost of Execution / Payout */}
                      <td style={{ padding: '12px 14px', textAlign: 'right', color: '#4B5563', fontWeight: '600' }}>
                        {activeDimension === 'franchise' 
                          ? formatCurrency(d.franchisee_payout) 
                          : formatCurrency(d.costOfExecution)}
                      </td>

                      {/* Credit Notes */}
                      <td style={{ padding: '12px 14px', textAlign: 'right', color: d.churnCost > 0 ? '#DC2626' : 'var(--text-muted)', fontWeight: '600' }}>
                        {d.churnCost > 0 ? `-${formatCurrency(d.churnCost)}` : '₹0'}
                      </td>

                      {/* Net Contribution */}
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <div style={{ fontWeight: '800', fontSize: '0.92rem', color: isProfitable ? '#10B981' : '#DC2626' }}>
                          {isProfitable ? '+' : ''}{formatCurrency(d.netContribution)}
                        </div>
                        <span style={{ fontSize: '0.7rem', color: isProfitable ? '#059669' : '#B91C1C' }}>
                          {d.netMarginPct}% margin
                        </span>
                      </td>

                      {/* TL: Net Per Franchise */}
                      {activeDimension === 'tl' && (
                        <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                          <span style={{ fontWeight: '800', color: d.netPerFranchise >= 0 ? '#2563EB' : '#DC2626' }}>
                            {d.netPerFranchise >= 0 ? '+' : ''}{formatCurrency(d.netPerFranchise)}
                          </span>
                        </td>
                      )}

                      {/* BD: Net Surplus Per Enquiry */}
                      {activeDimension === 'bd' && (
                        <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                          <span style={{ fontWeight: '700', color: d.netSurplusPerEnquiry >= 0 ? '#10B981' : '#DC2626' }}>
                            {d.netSurplusPerEnquiry >= 0 ? '+' : ''}{formatCurrency(d.netSurplusPerEnquiry)}
                          </span>
                        </td>
                      )}

                      {/* Verdict Badge */}
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <span style={{
                          fontSize: '0.7rem',
                          fontWeight: '700',
                          padding: '3px 8px',
                          borderRadius: '12px',
                          background: `${d.verdictColor}15`,
                          color: d.verdictColor,
                          border: `1px solid ${d.verdictColor}30`,
                          whiteSpace: 'nowrap'
                        }}>
                          {d.verdict}
                        </span>
                      </td>

                      {/* Audit Arrow */}
                      <td style={{ padding: '12px 14px', textAlign: 'center', color: 'var(--accent-teal)' }}>
                        <ChevronRight size={16} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Page {currentPage} of {totalPages}
            </span>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={(page) => setCurrentPage(page)}
            />
          </div>
        )}
      </div>

      {/* 5. Drill-Down Audit Drawer (Section 8.1 - 100% Auditability) */}
      {isDrawerOpen && selectedEntity && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(3px)',
          zIndex: 1000,
          display: 'flex',
          justifyContent: 'flex-end'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '520px',
            background: 'var(--bg-card)',
            height: '100%',
            overflowY: 'auto',
            padding: '24px',
            boxShadow: '-4px 0 24px rgba(0,0,0,0.2)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
              {/* Drawer Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                <div>
                  <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--accent-teal)', fontWeight: '800' }}>
                    {activeDimension.toUpperCase()} Audit Drill-Down
                  </div>
                  <h2 style={{ margin: '4px 0 0 0', fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-main)' }}>
                    {selectedEntity.dimension_value}
                  </h2>
                  {selectedEntity.role && (
                    <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{selectedEntity.role}</span>
                  )}
                </div>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Commercial Breakdown Card */}
              <div style={{ background: 'var(--bg-main)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-color)', marginBottom: '20px' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '12px' }}>
                  Commercial Equation Breakdown
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.82rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>1. Gross Billed:</span>
                    <strong style={{ color: 'var(--text-main)' }}>{formatCurrency(selectedEntity.total_billed)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>2. Company Share (ourShare):</span>
                    <strong style={{ color: '#0F6E56' }}>+{formatCurrency(selectedEntity.company_share)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>3. Direct Payroll / Seat Cost:</span>
                    <strong style={{ color: '#DC2626' }}>-{formatCurrency(selectedEntity.direct_cost || (activeDimension === 'bd' ? costInputs.defaultBdSalary : costInputs.defaultTlSalary))}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>4. Shared Overhead Pool Share:</span>
                    <strong style={{ color: '#DC2626' }}>-{formatCurrency(selectedEntity.overheadShare)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>5. Credit Note Loss Reversals:</span>
                    <strong style={{ color: '#DC2626' }}>-{formatCurrency(selectedEntity.churnCost)}</strong>
                  </div>
                  <div style={{ height: '1px', background: 'var(--border-color)', margin: '4px 0' }}></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.94rem' }}>
                    <span style={{ fontWeight: '800', color: 'var(--text-main)' }}>Net Bank Contribution:</span>
                    <strong style={{ color: selectedEntity.netContribution >= 0 ? '#10B981' : '#DC2626' }}>
                      {selectedEntity.netContribution >= 0 ? '+' : ''}{formatCurrency(selectedEntity.netContribution)}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Special Normalization Metrics */}
              {activeDimension === 'tl' && (
                <div style={{ background: 'rgba(37, 99, 235, 0.06)', padding: '14px', borderRadius: '10px', border: '1px solid rgba(37, 99, 235, 0.2)', marginBottom: '20px' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: '800', color: '#1D4ED8', marginBottom: '8px' }}>
                    Bankim Rule: Per-Franchise Normalization (Section 4.6)
                  </div>
                  <div style={{ fontSize: '0.76rem', color: '#1E40AF', lineHeight: '1.45', marginBottom: '10px' }}>
                    Managing {selectedEntity.activeFranchises} active franchise stores under their network.
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.78rem' }}>
                    <div style={{ background: '#ffffff', padding: '8px', borderRadius: '6px' }}>
                      <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>Revenue / Store</span>
                      <strong style={{ color: '#1D4ED8' }}>{formatCurrency(selectedEntity.revenuePerFranchise)}</strong>
                    </div>
                    <div style={{ background: '#ffffff', padding: '8px', borderRadius: '6px' }}>
                      <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.7rem' }}>Net Profit / Store</span>
                      <strong style={{ color: selectedEntity.netPerFranchise >= 0 ? '#10B981' : '#DC2626' }}>
                        {formatCurrency(selectedEntity.netPerFranchise)}
                      </strong>
                    </div>
                  </div>
                </div>
              )}

              {activeDimension === 'bd' && (
                <div style={{ background: 'rgba(15, 110, 86, 0.06)', padding: '14px', borderRadius: '10px', border: '1px solid rgba(15, 110, 86, 0.2)', marginBottom: '20px' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: '800', color: '#0F6E56', marginBottom: '8px' }}>
                    Bankim Rule: Per-Enquiry Effort Efficiency (Section 4.7)
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', fontSize: '0.76rem' }}>
                    <div style={{ background: 'var(--bg-card)', padding: '8px', borderRadius: '6px' }}>
                      <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.68rem' }}>Rev / Enq</span>
                      <strong>{formatCurrency(selectedEntity.revenuePerEnquiry)}</strong>
                    </div>
                    <div style={{ background: 'var(--bg-card)', padding: '8px', borderRadius: '6px' }}>
                      <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.68rem' }}>Cost / Enq</span>
                      <strong style={{ color: '#DC2626' }}>{formatCurrency(selectedEntity.expensePerEnquiry)}</strong>
                    </div>
                    <div style={{ background: 'var(--bg-card)', padding: '8px', borderRadius: '6px' }}>
                      <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.68rem' }}>Net Surplus</span>
                      <strong style={{ color: selectedEntity.netSurplusPerEnquiry >= 0 ? '#10B981' : '#DC2626' }}>
                        {formatCurrency(selectedEntity.netSurplusPerEnquiry)}
                      </strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Transactions List */}
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '8px' }}>
                  Associated Transactions & Invoices ({selectedEntity.txList?.length || selectedEntity.placements} items)
                </div>
                {selectedEntity.txList && selectedEntity.txList.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '240px', overflowY: 'auto' }}>
                    {selectedEntity.txList.map((tx, idx) => (
                      <div key={idx} style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', fontSize: '0.74rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700' }}>
                          <span>{tx.companyName || tx.client || 'Client Placement'}</span>
                          <span style={{ color: '#0F6E56' }}>{formatCurrency(tx.ourShare || 0)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.7rem', marginTop: '2px' }}>
                          <span>Inv #{tx.id || idx + 1} • {formatDate(tx.billDate)}</span>
                          <span>Billed: {formatCurrency(tx.totalBillAmt || 0)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: '14px', borderRadius: '8px', background: 'var(--bg-main)', border: '1px dashed var(--border-color)', color: 'var(--text-muted)', fontSize: '0.75rem', textAlign: 'center' }}>
                    Billed via Saarthi360 monthly billing cycle for {selectedMonth}. Underlying rows locked to {selectedEntity.placements} closed placements.
                  </div>
                )}
              </div>
            </div>

            {/* Close Drawer Button */}
            <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <button
                onClick={() => setIsDrawerOpen(false)}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'var(--accent-teal, #0F6E56)',
                  color: '#ffffff',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                Close Audit Panel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Cost Inputs Modal (Section 3.2 Monthly Cost Inputs) */}
      {isInputModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(3px)',
          zIndex: 1000,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            padding: '24px',
            maxWidth: '480px',
            width: '100%',
            boxShadow: '0 8px 32px rgba(0,0,0,0.25)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-main)' }}>
                  Monthly Cost & Payroll Inputs
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Updates direct seat costs and shared overhead pool for {selectedMonth}
                </span>
              </div>
              <button
                onClick={() => setIsInputModalOpen(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '4px' }}>
                  Default BD Executive Monthly Salary (₹)
                </label>
                <input
                  type="number"
                  value={costInputs.defaultBdSalary}
                  onChange={(e) => setCostInputs({ ...costInputs, defaultBdSalary: Number(e.target.value) })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.84rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '4px' }}>
                  Default Team Leader Monthly Salary (₹)
                </label>
                <input
                  type="number"
                  value={costInputs.defaultTlSalary}
                  onChange={(e) => setCostInputs({ ...costInputs, defaultTlSalary: Number(e.target.value) })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.84rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '4px' }}>
                  Shared Overhead Pool (Rent, Admin, Marketing) (₹)
                </label>
                <input
                  type="number"
                  value={costInputs.overheadPool}
                  onChange={(e) => setCostInputs({ ...costInputs, overheadPool: Number(e.target.value) })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.84rem' }}
                />
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px', display: 'block' }}>
                  Allocated pro-rata across active units based on Company Share revenue
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setIsInputModalOpen(false)}
                style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: '600', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={() => setIsInputModalOpen(false)}
                style={{ padding: '8px 18px', borderRadius: '6px', border: 'none', background: 'var(--accent-teal, #0F6E56)', color: '#ffffff', fontSize: '0.82rem', fontWeight: '700', cursor: 'pointer' }}
              >
                Apply & Recalculate
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default CostOfPerformance;
