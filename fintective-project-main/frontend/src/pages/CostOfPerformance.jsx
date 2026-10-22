import React, { useState, useEffect, useContext, useMemo, useCallback, useRef } from 'react';
import { FinanceContext, API_BASE_URL } from '../context/FinanceContext';
import { fetchWithApiKey } from '../utils/apiClient';
import FilterPanel from '../components/FilterPanel';
import AuditDrawer from '../components/AuditDrawer';
import './CostOfPerformance.css';
import { 
  Filter, Search, X, Check, ChevronDown, ChevronUp, Download, 
  RotateCcw, Calendar, Sliders, AlertCircle, TrendingUp, TrendingDown, 
  Shield, Users, DollarSign, Activity, FileText, Settings, Layers, 
  ArrowUp, ArrowDown, ExternalLink
} from 'lucide-react';

const DEFAULT_FILTER_OPTIONS = {
  team_leaders: [
    'Avadai Esakki Muthu Sundaram Marthuvar', 'Surbhi Vinod Jain', 'Joyeeta Joydeb Khaskel', 
    'Vedika Girish Tolani', 'Pooja Sharma', 'Rajesh Patil', 'Amit Shinde', 'Priya Shah'
  ],
  bd_members: [
    'Komal Suresh Bhanushali', 'Rajalaxmi Das Das', 'Jahnvi Thakker', 'Ashutosh Manoj Hiremath',
    'Kadambinee Kundu', 'Muskan Ritesh Pradhan', 'Rahul Patil', 'Sneha Kulkarni', 'Ankur Sharma'
  ],
  franchises: [
    'Sandeep', 'Preshita Rane', 'Razia Begum', 'Anita Mandar Kulkarni', 'Subhash Pande', 'Ankur Sharma'
  ],
  industries: [
    'Information Technology & Software', 'Banking, Financial Services & Insurance (BFSI)',
    'Engineering, Manufacturing & Industrial', 'Healthcare, Pharmaceuticals & Life Sciences',
    'Retail, FMCG & E-Commerce', 'Infrastructure, Construction & Real Estate',
    'Human Resources & Staffing Services', 'Digital Marketing, Media & Creative Services'
  ],
  sub_industries: [
    'Software Development & Engineering', 'Digital Marketing & Content Strategy',
    'Banking, Wealth & Asset Management', 'Precision Machining & Plant Operations',
    'Clinical Healthcare, Pharma & Wellness', 'Technical Sales & Engineering',
    'Accounting, Taxation & Audit', 'Talent Acquisition & HR Operations'
  ],
  cities: [
    'Mumbai', 'Pune', 'Bengaluru', 'Delhi NCR', 'Hyderabad', 'Ahmedabad', 
    'Chennai', 'Kolkata', 'Surat', 'Vadodara', 'Indore', 'Nagpur', 'Coimbatore', 'Other / Unassigned'
  ],
  client_statuses: [
    'Active', 'Inactive', 'Prospect', 'Dormant', 'Lost'
  ],
  enquiry_statuses: [
    'Open', 'In Progress', 'Closed', 'Rejected', 'Pending', 'Cancelled'
  ]
};

const TABS = [
  { id: 'bd', label: 'BD-wise', entitySingular: 'BD Member' },
  { id: 'tl', label: 'Team Leader-wise', entitySingular: 'Team Leader' },
  { id: 'franchise', label: 'Franchise-wise', entitySingular: 'Franchise Partner' },
  { id: 'city', label: 'City-wise', entitySingular: 'Operational City' },
  { id: 'industry', label: 'Industry-wise', entitySingular: 'Industry Domain' }
];

const VERDICTS = [
  { id: 'all', label: 'All', badgeClass: 'bg-gray-100 text-gray-700 hover:bg-gray-200' },
  { id: 'star', label: 'Star Performer', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' },
  { id: 'healthy', label: 'Healthy', badgeClass: 'bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100' },
  { id: 'breakeven', label: 'Break-even', badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' },
  { id: 'at_risk', label: 'At Risk', badgeClass: 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100' },
  { id: 'loss', label: 'Loss Drain', badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100' }
];

export default function CostOfPerformance({ setActivePage }) {
  const { 
    selectedMonth, 
    setSelectedMonth, 
    selectedYear, 
    setSelectedYear, 
    availableMonths = [], 
    availableYears = [],
    userRole 
  } = useContext(FinanceContext);

  // 1. URL State Initialization using native window.location.search
  const getInitialParam = (key, defaultVal = '') => {
    if (typeof window === 'undefined') return defaultVal;
    return new URLSearchParams(window.location.search).get(key) || defaultVal;
  };

  const parseArrayParam = (key) => {
    if (typeof window === 'undefined') return [];
    const val = new URLSearchParams(window.location.search).get(key);
    return val ? val.split(',').filter(Boolean) : [];
  };

  const initialTab = getInitialParam('tab', 'bd');
  const initialVerdict = getInitialParam('verdict', 'all');
  const initialSearch = getInitialParam('search', '');

  // 2. Active Tab & Instant Controls
  const [activeTab, setActiveTab] = useState(initialTab);
  const [activeVerdict, setActiveVerdict] = useState(initialVerdict);
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);

  // 3. Staged Filters in FilterPanel (Applied ONLY on "Apply Filters" click)
  const [stagedSortBy, setStagedSortBy] = useState(() => getInitialParam('sort', 'net'));
  const [stagedSortDir, setStagedSortDir] = useState(() => getInitialParam('sort_dir', 'desc'));
  const [stagedViewReportAs, setStagedViewReportAs] = useState(() => getInitialParam('view_as', 'this_fy'));
  const [stagedCustomStartDate, setStagedCustomStartDate] = useState(() => getInitialParam('start_date', ''));
  const [stagedCustomEndDate, setStagedCustomEndDate] = useState(() => getInitialParam('end_date', ''));

  const [stagedTLs, setStagedTLs] = useState(() => parseArrayParam('tl'));
  const [stagedBDs, setStagedBDs] = useState(() => parseArrayParam('bd'));
  const [stagedFranchises, setStagedFranchises] = useState(() => parseArrayParam('franchise'));
  const [stagedIndustries, setStagedIndustries] = useState(() => parseArrayParam('industry'));
  const [stagedSubIndustries, setStagedSubIndustries] = useState(() => parseArrayParam('sub_industry'));
  const [stagedCities, setStagedCities] = useState(() => parseArrayParam('city'));
  const [stagedClientStatuses, setStagedClientStatuses] = useState(() => parseArrayParam('client_status'));
  const [stagedEnquiryStatuses, setStagedEnquiryStatuses] = useState(() => parseArrayParam('enquiry_status'));

  // 4. Committed / Applied Filters (drive server data fetching)
  const [appliedFilters, setAppliedFilters] = useState(() => ({
    sortBy: getInitialParam('sort', 'net'),
    sortDir: getInitialParam('sort_dir', 'desc'),
    viewReportAs: getInitialParam('view_as', 'this_fy'),
    customStartDate: getInitialParam('start_date', ''),
    customEndDate: getInitialParam('end_date', ''),
    tls: parseArrayParam('tl'),
    bds: parseArrayParam('bd'),
    franchises: parseArrayParam('franchise'),
    industries: parseArrayParam('industry'),
    subIndustries: parseArrayParam('sub_industry'),
    cities: parseArrayParam('city'),
    clientStatuses: parseArrayParam('client_status'),
    enquiryStatuses: parseArrayParam('enquiry_status')
  }));

  // 5. FilterPanel Open/Close State (Persisted in localStorage, default open)
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(() => {
    const saved = localStorage.getItem('fintective_filter_panel_open');
    return saved !== null ? saved === 'true' : true;
  });

  const toggleFilterPanel = () => {
    setIsFilterPanelOpen(prev => {
      const next = !prev;
      localStorage.setItem('fintective_filter_panel_open', String(next));
      return next;
    });
  };

  // 6. Pagination & Audit Modal
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25); // Default 25 records so full datasets are immediately visible
  const [auditTarget, setAuditTarget] = useState(null);
  const [isCostModalOpen, setIsCostModalOpen] = useState(false);

  // 7. Server State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState({
    billed: 0,
    companyShare: 0,
    costOfExecution: 0,
    churnCost: 0,
    netContribution: 0,
    placements: 0,
    marginPct: 0,
    is_filtered: false
  });
  const [verdictCounts, setVerdictCounts] = useState({
    all: 0,
    star: 0,
    healthy: 0,
    breakeven: 0,
    at_risk: 0,
    loss: 0
  });

  // Cascading Dynamic Filter Options (Initialized with full CRM defaults so options are never blank)
  const [filterOptions, setFilterOptions] = useState(DEFAULT_FILTER_OPTIONS);

  // Debounce search input (300ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Count active applied filters
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (appliedFilters.tls.length > 0) count += appliedFilters.tls.length;
    if (appliedFilters.bds.length > 0) count += appliedFilters.bds.length;
    if (appliedFilters.franchises.length > 0) count += appliedFilters.franchises.length;
    if (appliedFilters.industries.length > 0) count += appliedFilters.industries.length;
    if (appliedFilters.subIndustries.length > 0) count += appliedFilters.subIndustries.length;
    if (appliedFilters.cities.length > 0) count += appliedFilters.cities.length;
    if (appliedFilters.clientStatuses.length > 0) count += appliedFilters.clientStatuses.length;
    if (appliedFilters.enquiryStatuses.length > 0) count += appliedFilters.enquiryStatuses.length;
    if (activeVerdict !== 'all') count++;
    if (debouncedSearch) count++;
    return count;
  }, [appliedFilters, activeVerdict, debouncedSearch]);

  const hasAnyFilterActive = activeFiltersCount > 0 || totals.is_filtered;

  // Format month string for backend query
  const cleanMonthParam = useMemo(() => {
    if (!selectedMonth) return '2026-08';
    const lower = selectedMonth.toLowerCase().trim();
    if (lower === 'all months' || lower === 'all' || lower === 'full year') return 'all';
    if (selectedMonth.includes(' ')) {
      const parts = selectedMonth.split(' ');
      const mNames = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
      const mIdx = mNames.indexOf(parts[0].toLowerCase());
      if (mIdx !== -1 && parts[1]) {
        return `${parts[1]}-${String(mIdx + 1).padStart(2, '0')}`;
      }
    }
    return selectedMonth;
  }, [selectedMonth]);

  // Synchronize applied filters with URL query parameters using window.history.replaceState
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams();
    params.set('tab', activeTab);
    if (activeVerdict !== 'all') params.set('verdict', activeVerdict);
    if (debouncedSearch) params.set('search', debouncedSearch);

    if (appliedFilters.sortBy) params.set('sort', appliedFilters.sortBy);
    if (appliedFilters.sortDir) params.set('sort_dir', appliedFilters.sortDir);
    if (appliedFilters.viewReportAs) params.set('view_as', appliedFilters.viewReportAs);
    if (appliedFilters.customStartDate) params.set('start_date', appliedFilters.customStartDate);
    if (appliedFilters.customEndDate) params.set('end_date', appliedFilters.customEndDate);

    if (appliedFilters.tls.length) params.set('tl', appliedFilters.tls.join(','));
    if (appliedFilters.bds.length) params.set('bd', appliedFilters.bds.join(','));
    if (appliedFilters.franchises.length) params.set('franchise', appliedFilters.franchises.join(','));
    if (appliedFilters.industries.length) params.set('industry', appliedFilters.industries.join(','));
    if (appliedFilters.subIndustries.length) params.set('sub_industry', appliedFilters.subIndustries.join(','));
    if (appliedFilters.cities.length) params.set('city', appliedFilters.cities.join(','));
    if (appliedFilters.clientStatuses.length) params.set('client_status', appliedFilters.clientStatuses.join(','));
    if (appliedFilters.enquiryStatuses.length) params.set('enquiry_status', appliedFilters.enquiryStatuses.join(','));

    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);
  }, [activeTab, activeVerdict, debouncedSearch, appliedFilters]);

  // Safe API endpoint resolver
  const getApiEndpoint = (path) => {
    const base = (API_BASE_URL || '/api').replace(/\/+$/, '');
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    if (base.endsWith('/api') && cleanPath.startsWith('/api/')) {
      return `${base}${cleanPath.substring(4)}`;
    }
    if (!base.endsWith('/api') && !cleanPath.startsWith('/api/')) {
      return `${base}/api${cleanPath}`;
    }
    return `${base}${cleanPath}`;
  };

  // Fetch Cascading Dynamic Filter Options from Backend
  const fetchFilterOptions = useCallback(async () => {
    try {
      const q = new URLSearchParams({
        entity: activeTab,
        month: cleanMonthParam,
        fy: selectedYear || '2026-2027',
        view_as: appliedFilters.viewReportAs || 'this_fy',
        start_date: appliedFilters.customStartDate || '',
        end_date: appliedFilters.customEndDate || '',
        tl: stagedTLs.join(','),
        industry: stagedIndustries.join(',')
      });

      const url = getApiEndpoint(`/cost-performance/filter-options?${q.toString()}`);
      const res = await fetchWithApiKey(url);
      if (!res.ok) return;
      const data = await res.json();
      if (data.success) {
        setFilterOptions(prev => ({
          team_leaders: data.team_leaders && data.team_leaders.length > 0 ? data.team_leaders : prev.team_leaders,
          bd_members: data.bd_members && data.bd_members.length > 0 ? data.bd_members : prev.bd_members,
          franchises: data.franchises && data.franchises.length > 0 ? data.franchises : prev.franchises,
          industries: data.industries && data.industries.length > 0 ? data.industries : prev.industries,
          sub_industries: data.sub_industries && data.sub_industries.length > 0 ? data.sub_industries : prev.sub_industries,
          cities: data.cities && data.cities.length > 0 ? data.cities : prev.cities,
          client_statuses: data.client_statuses && data.client_statuses.length > 0 ? data.client_statuses : prev.client_statuses,
          enquiry_statuses: data.enquiry_statuses && data.enquiry_statuses.length > 0 ? data.enquiry_statuses : prev.enquiry_statuses
        }));
      }
    } catch (err) {
      console.error('Error fetching filter options:', err);
    }
  }, [activeTab, cleanMonthParam, selectedYear, appliedFilters.viewReportAs, appliedFilters.customStartDate, appliedFilters.customEndDate, stagedTLs, stagedIndustries]);

  useEffect(() => {
    fetchFilterOptions();
  }, [fetchFilterOptions]);

  // Fetch Authoritative Cost Performance Ledger Records
  const fetchReportData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({
        entity: activeTab,
        month: cleanMonthParam,
        fy: selectedYear || '2026-2027',
        verdict: activeVerdict !== 'all' ? activeVerdict : '',
        search: debouncedSearch || '',
        sort: appliedFilters.sortBy || 'net',
        sort_dir: appliedFilters.sortDir || 'desc',
        view_as: appliedFilters.viewReportAs || 'this_fy',
        start_date: appliedFilters.customStartDate || '',
        end_date: appliedFilters.customEndDate || '',
        tl: appliedFilters.tls.join(','),
        bd: appliedFilters.bds.join(','),
        franchise: appliedFilters.franchises.join(','),
        city: appliedFilters.cities.join(','),
        industry: appliedFilters.industries.join(','),
        sub_industry: appliedFilters.subIndustries.join(','),
        client_status: appliedFilters.clientStatuses.join(','),
        enquiry_status: appliedFilters.enquiryStatuses.join(',')
      });

      const url = getApiEndpoint(`/cost-performance?${q.toString()}`);
      const res = await fetchWithApiKey(url);
      if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
      const data = await res.json();

      if (data.success) {
        setRows(data.rows || []);
        setTotals(data.totals || {
          billed: 0,
          companyShare: 0,
          costOfExecution: 0,
          churnCost: 0,
          netContribution: 0,
          placements: 0,
          marginPct: 0,
          is_filtered: false
        });
        setVerdictCounts(data.verdict_counts || {
          all: 0, star: 0, healthy: 0, breakeven: 0, at_risk: 0, loss: 0
        });
      } else {
        throw new Error(data.error || 'Failed to fetch cost ledger data');
      }
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [activeTab, cleanMonthParam, selectedYear, activeVerdict, debouncedSearch, appliedFilters]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  // Handle Tab Switch & Reset Tab-Irrelevant Filters
  const handleTabChange = (newTab) => {
    if (newTab === activeTab) return;
    setActiveTab(newTab);
    setCurrentPage(1);

    // Reset filters that don't apply to the newly selected tab
    if (newTab === 'bd') {
      setStagedBDs([]);
      setAppliedFilters(prev => ({ ...prev, bds: [] }));
    } else if (newTab === 'tl') {
      setStagedTLs([]);
      setAppliedFilters(prev => ({ ...prev, tls: [] }));
    } else if (newTab === 'franchise') {
      setStagedFranchises([]);
      setAppliedFilters(prev => ({ ...prev, franchises: [] }));
    } else if (newTab === 'city') {
      setStagedCities([]);
      setAppliedFilters(prev => ({ ...prev, cities: [] }));
    } else if (newTab === 'industry') {
      setStagedIndustries([]);
      setStagedSubIndustries([]);
      setAppliedFilters(prev => ({ ...prev, industries: [], subIndustries: [] }));
    }
  };

  // "Apply Filters" button handler (dark primary button in panel)
  const handleApplyFilters = () => {
    setAppliedFilters({
      sortBy: stagedSortBy,
      sortDir: stagedSortDir,
      viewReportAs: stagedViewReportAs,
      customStartDate: stagedCustomStartDate,
      customEndDate: stagedCustomEndDate,
      tls: [...stagedTLs],
      bds: [...stagedBDs],
      franchises: [...stagedFranchises],
      industries: [...stagedIndustries],
      subIndustries: [...stagedSubIndustries],
      cities: [...stagedCities],
      clientStatuses: [...stagedClientStatuses],
      enquiryStatuses: [...stagedEnquiryStatuses]
    });
    setCurrentPage(1);
  };

  // "Clear Filters" button handler
  const handleClearFilters = () => {
    setActiveVerdict('all');
    setSearchTerm('');
    setDebouncedSearch('');
    setStagedSortBy('net');
    setStagedSortDir('desc');
    setStagedViewReportAs('this_fy');
    setStagedCustomStartDate('');
    setStagedCustomEndDate('');
    setStagedTLs([]);
    setStagedBDs([]);
    setStagedFranchises([]);
    setStagedIndustries([]);
    setStagedSubIndustries([]);
    setStagedCities([]);
    setStagedClientStatuses([]);
    setStagedEnquiryStatuses([]);

    setAppliedFilters({
      sortBy: 'net',
      sortDir: 'desc',
      viewReportAs: 'this_fy',
      customStartDate: '',
      customEndDate: '',
      tls: [],
      bds: [],
      franchises: [],
      industries: [],
      subIndustries: [],
      cities: [],
      clientStatuses: [],
      enquiryStatuses: []
    });
    setCurrentPage(1);
  };

  // Helper to remove an individual applied filter chip
  const removeAppliedFilter = (type, val) => {
    if (type === 'verdict') {
      setActiveVerdict('all');
    } else if (type === 'search') {
      setSearchTerm('');
      setDebouncedSearch('');
    } else if (type === 'tl') {
      const next = appliedFilters.tls.filter(x => x !== val);
      setStagedTLs(next);
      setAppliedFilters(p => ({ ...p, tls: next }));
    } else if (type === 'bd') {
      const next = appliedFilters.bds.filter(x => x !== val);
      setStagedBDs(next);
      setAppliedFilters(p => ({ ...p, bds: next }));
    } else if (type === 'franchise') {
      const next = appliedFilters.franchises.filter(x => x !== val);
      setStagedFranchises(next);
      setAppliedFilters(p => ({ ...p, franchises: next }));
    } else if (type === 'industry') {
      const next = appliedFilters.industries.filter(x => x !== val);
      setStagedIndustries(next);
      setAppliedFilters(p => ({ ...p, industries: next }));
    } else if (type === 'sub_industry') {
      const next = appliedFilters.subIndustries.filter(x => x !== val);
      setStagedSubIndustries(next);
      setAppliedFilters(p => ({ ...p, subIndustries: next }));
    } else if (type === 'city') {
      const next = appliedFilters.cities.filter(x => x !== val);
      setStagedCities(next);
      setAppliedFilters(p => ({ ...p, cities: next }));
    } else if (type === 'client_status') {
      const next = appliedFilters.clientStatuses.filter(x => x !== val);
      setStagedClientStatuses(next);
      setAppliedFilters(p => ({ ...p, clientStatuses: next }));
    } else if (type === 'enquiry_status') {
      const next = appliedFilters.enquiryStatuses.filter(x => x !== val);
      setStagedEnquiryStatuses(next);
      setAppliedFilters(p => ({ ...p, enquiryStatuses: next }));
    }
    setCurrentPage(1);
  };

  // CSV Report Export Handler
  const handleExport = () => {
    const q = new URLSearchParams({
      entity: activeTab,
      month: cleanMonthParam,
      fy: selectedYear || '2026-2027',
      verdict: activeVerdict !== 'all' ? activeVerdict : '',
      search: debouncedSearch || '',
      sort: appliedFilters.sortBy || 'net',
      sort_dir: appliedFilters.sortDir || 'desc',
      view_as: appliedFilters.viewReportAs || 'this_fy',
      start_date: appliedFilters.customStartDate || '',
      end_date: appliedFilters.customEndDate || '',
      tl: appliedFilters.tls.join(','),
      bd: appliedFilters.bds.join(','),
      franchise: appliedFilters.franchises.join(','),
      city: appliedFilters.cities.join(','),
      industry: appliedFilters.industries.join(','),
      sub_industry: appliedFilters.subIndustries.join(','),
      client_status: appliedFilters.clientStatuses.join(','),
      enquiry_status: appliedFilters.enquiryStatuses.join(',')
    });

    try {
      const res = await fetchWithApiKey(url);
      if (!res.ok) throw new Error(`Export failed with HTTP ${res.status}`);
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `cost_of_performance_${appliedFilters.financialYear || 'report'}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('Failed to export CSV report:', err);
    }
  };

  // Format currency in Indian Lakhs / Rupees
  const formatINR = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val || 0);
  };

  // Pagination calculation
  const totalRows = rows.length;
  const paginatedRows = useMemo(() => {
    if (itemsPerPage === 'all') return rows;
    const start = (currentPage - 1) * itemsPerPage;
    return rows.slice(start, start + itemsPerPage);
  }, [rows, currentPage, itemsPerPage]);

  const totalPages = itemsPerPage === 'all' ? 1 : Math.ceil(totalRows / itemsPerPage) || 1;
  const startRowIndex = totalRows === 0 ? 0 : itemsPerPage === 'all' ? 1 : (currentPage - 1) * itemsPerPage + 1;
  const endRowIndex = itemsPerPage === 'all' ? totalRows : Math.min(currentPage * itemsPerPage, totalRows);

  return (
    <div className="space-y-6 pb-20">
      {/* 1. Header with Title & Export Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <span>Cost of Performance</span>
            <span className="text-xs font-semibold text-teal-800 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200">
              {TABS.find(t => t.id === activeTab)?.label || 'BD-wise'}
            </span>
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Unit economics, execution costs, churn leakages & net margin audit across all business dimensions
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg shadow-sm transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Report</span>
          </button>
        </div>
      </div>

      {/* 2. Top 4 KPI Cards with "Filtered" indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Company Share */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Company Share</span>
            <div className="flex items-center gap-1.5">
              {hasAnyFilterActive && (
                <span className="text-[10px] font-semibold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">
                  ● Filtered
                </span>
              )}
              <DollarSign className="w-4 h-4 text-teal-600" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-gray-900">
            {formatINR(totals.companyShare)}
          </div>
          <p className="text-[11px] text-gray-400 mt-1">
            Aggregated revenue share ({totals.placements} placements)
          </p>
        </div>

        {/* KPI 2: Cost of Execution */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Cost of Execution</span>
            <div className="flex items-center gap-1.5">
              {hasAnyFilterActive && (
                <span className="text-[10px] font-semibold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">
                  ● Filtered
                </span>
              )}
              <Users className="w-4 h-4 text-blue-600" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-gray-900">
            {formatINR(totals.costOfExecution)}
          </div>
          <p className="text-[11px] text-gray-400 mt-1">
            Direct payroll & allocated overhead share
          </p>
        </div>

        {/* KPI 3: Churn & Credit Notes */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Churn & Credit Notes</span>
            <div className="flex items-center gap-1.5">
              {hasAnyFilterActive && (
                <span className="text-[10px] font-semibold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">
                  ● Filtered
                </span>
              )}
              <AlertCircle className="w-4 h-4 text-rose-500" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-rose-600">
            {formatINR(totals.churnCost)}
          </div>
          <p className="text-[11px] text-gray-400 mt-1">
            Credit note reversals & billed write-downs
          </p>
        </div>

        {/* KPI 4: Net Bank Contribution */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Net Bank Contribution</span>
            <div className="flex items-center gap-1.5">
              {hasAnyFilterActive && (
                <span className="text-[10px] font-semibold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">
                  ● Filtered
                </span>
              )}
              <Shield className="w-4 h-4 text-teal-600" />
            </div>
          </div>
          <div className={`text-2xl font-extrabold ${totals.netContribution >= 0 ? 'text-teal-700' : 'text-rose-600'}`}>
            {formatINR(totals.netContribution)}
          </div>
          <p className="text-[11px] text-gray-400 mt-1">
            Margin: {totals.marginPct}% net margin
          </p>
        </div>
      </div>

      {/* 3. PERFORMANCE FILTERS PANEL (Card layout, collapsible) */}
      <FilterPanel
        isOpen={isFilterPanelOpen}
        onToggle={toggleFilterPanel}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        sortBy={stagedSortBy}
        onSortChange={setStagedSortBy}
        financialYear={selectedYear}
        onFinancialYearChange={setSelectedYear}
        availableYears={availableYears}
        month={selectedMonth}
        onMonthChange={setSelectedMonth}
        availableMonths={availableMonths}
        viewReportAs={stagedViewReportAs}
        onViewReportAsChange={setStagedViewReportAs}
        customStartDate={stagedCustomStartDate}
        onCustomStartDateChange={setStagedCustomStartDate}
        customEndDate={stagedCustomEndDate}
        onCustomEndDateChange={setStagedCustomEndDate}
        filterOptions={filterOptions}
        selectedTLs={stagedTLs}
        onTLsChange={setStagedTLs}
        selectedBDs={stagedBDs}
        onBDsChange={setStagedBDs}
        selectedFranchises={stagedFranchises}
        onFranchisesChange={setStagedFranchises}
        selectedIndustries={stagedIndustries}
        onIndustriesChange={setStagedIndustries}
        selectedSubIndustries={stagedSubIndustries}
        onSubIndustriesChange={setStagedSubIndustries}
        selectedCities={stagedCities}
        onCitiesChange={setStagedCities}
        selectedClientStatuses={stagedClientStatuses}
        onClientStatusesChange={setStagedClientStatuses}
        selectedEnquiryStatuses={stagedEnquiryStatuses}
        onEnquiryStatusesChange={setStagedEnquiryStatuses}
        onApplyFilters={handleApplyFilters}
        onClearFilters={handleClearFilters}
        activeFiltersCount={activeFiltersCount}
      />

      {/* 4. One-Row Quick Filter Bar: Filters Toggle, Dynamic Verdict Chips & Debounced Search */}
      <div className="space-y-3">
        <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Quick Toggle for Filters Panel */}
            <button
              type="button"
              onClick={toggleFilterPanel}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-all ${
                isFilterPanelOpen
                  ? 'bg-teal-50 border-teal-500 text-teal-800 font-semibold'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Filters</span>
              {activeFiltersCount > 0 && (
                <span className="px-1.5 py-0.2 text-[10px] bg-teal-700 text-white rounded-full font-bold">
                  {activeFiltersCount}
                </span>
              )}
            </button>

            <span className="text-gray-300">|</span>

            {/* Verdict Chips with Counts (Hide count 0 chips) */}
            <div className="flex flex-wrap items-center gap-1.5">
            {VERDICTS.map(v => {
              const count = verdictCounts[v.id] || 0;
              if (v.id !== 'all' && count === 0) return null; // Hide 0 count chips
              const isActive = activeVerdict === v.id;

              return (
                <button
                  key={v.id}
                  onClick={() => setActiveVerdict(v.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all border ${
                    isActive
                      ? 'bg-teal-700 text-white border-teal-700 shadow-xs'
                      : v.badgeClass
                  }`}
                >
                  <span>{v.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isActive ? 'bg-teal-800 text-white' : 'bg-white/80 text-gray-700 border border-gray-200'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
            </div>
          </div>

          {/* Search Box & Page Size */}
          <div className="flex items-center gap-3">
            <div className="relative min-w-[200px] max-w-[260px]">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-400" />
              <input
                type="text"
                placeholder={`Search ${activeTab.toUpperCase()} name or role...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Items Per Page Selector */}
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <span>Show:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10));
                  setCurrentPage(1);
                }}
                className="px-2 py-1 text-xs border border-gray-200 rounded-md bg-white text-gray-700 focus:ring-1 focus:ring-teal-500"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value="all">All</option>
              </select>
            </div>
          </div>
        </div>

        {/* 6. Active Filter Chips & Record Count Summary */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-gray-500 font-medium text-[11px]">
              Showing {startRowIndex} to {endRowIndex} of {totalRows} records
            </span>

            {hasAnyFilterActive && (
              <>
                <span className="text-gray-300">|</span>
                <span className="text-gray-400 text-[11px] font-medium">Applied:</span>

                {activeVerdict !== 'all' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-teal-50 text-teal-800 text-[11px] border border-teal-200">
                    Verdict: {VERDICTS.find(v => v.id === activeVerdict)?.label || activeVerdict}
                    <button onClick={() => removeAppliedFilter('verdict')}><X className="w-2.5 h-2.5" /></button>
                  </span>
                )}

                {debouncedSearch && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100 text-gray-800 text-[11px] border border-gray-200">
                    Search: "{debouncedSearch}"
                    <button onClick={() => removeAppliedFilter('search')}><X className="w-2.5 h-2.5" /></button>
                  </span>
                )}

                {appliedFilters.tls.map(t => (
                  <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-800 text-[11px] border border-blue-200">
                    TL: {t}
                    <button onClick={() => removeAppliedFilter('tl', t)}><X className="w-2.5 h-2.5" /></button>
                  </span>
                ))}

                {appliedFilters.bds.map(b => (
                  <span key={b} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 text-[11px] border border-indigo-200">
                    BD: {b}
                    <button onClick={() => removeAppliedFilter('bd', b)}><X className="w-2.5 h-2.5" /></button>
                  </span>
                ))}

                {appliedFilters.franchises.map(f => (
                  <span key={f} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-50 text-purple-800 text-[11px] border border-purple-200">
                    Franchise: {f}
                    <button onClick={() => removeAppliedFilter('franchise', f)}><X className="w-2.5 h-2.5" /></button>
                  </span>
                ))}

                {appliedFilters.industries.map(i => (
                  <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 text-[11px] border border-emerald-200">
                    Industry: {i}
                    <button onClick={() => removeAppliedFilter('industry', i)}><X className="w-2.5 h-2.5" /></button>
                  </span>
                ))}

                {appliedFilters.subIndustries.map(s => (
                  <span key={s} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-teal-50 text-teal-800 text-[11px] border border-teal-200">
                    Sub Industry: {s}
                    <button onClick={() => removeAppliedFilter('sub_industry', s)}><X className="w-2.5 h-2.5" /></button>
                  </span>
                ))}

                {appliedFilters.cities.map(c => (
                  <span key={c} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-800 text-[11px] border border-amber-200">
                    City: {c}
                    <button onClick={() => removeAppliedFilter('city', c)}><X className="w-2.5 h-2.5" /></button>
                  </span>
                ))}

                {appliedFilters.clientStatuses.map(cs => (
                  <span key={cs} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-50 text-rose-800 text-[11px] border border-rose-200">
                    Client: {cs.title || cs}
                    <button onClick={() => removeAppliedFilter('client_status', cs)}><X className="w-2.5 h-2.5" /></button>
                  </span>
                ))}

                {appliedFilters.enquiryStatuses.map(es => (
                  <span key={es} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-50 text-cyan-800 text-[11px] border border-cyan-200">
                    Enquiry: {es.title || es}
                    <button onClick={() => removeAppliedFilter('enquiry_status', es)}><X className="w-2.5 h-2.5" /></button>
                  </span>
                ))}

                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="text-teal-700 hover:text-teal-900 underline font-semibold text-[11px] ml-1"
                >
                  Clear all
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 7. Unit-Economics Data Table */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
            <thead className="bg-gray-50 text-gray-600 font-semibold uppercase tracking-wider">
              <tr>
                <th scope="col" className="px-4 py-3 w-12 text-center">Rank</th>
                <th scope="col" className="px-4 py-3">
                  {TABS.find(t => t.id === activeTab)?.entitySingular || 'Executive / Entity'}
                </th>
                <th scope="col" className="px-4 py-3 text-right">Placements</th>
                <th scope="col" className="px-4 py-3 text-right">Total Enquiries</th>
                <th scope="col" className="px-4 py-3 text-right">Company Share</th>
                <th scope="col" className="px-4 py-3 text-right">Cost of Execution</th>
                <th scope="col" className="px-4 py-3 text-right">Credit Notes</th>
                <th scope="col" className="px-4 py-3 text-right">Net Contribution</th>
                <th scope="col" className="px-4 py-3 text-right">Net / Enquiry</th>
                <th scope="col" className="px-4 py-3 text-center">Verdict</th>
                <th scope="col" className="px-4 py-3 text-center w-20">Audit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {loading ? (
                // Skeleton loading rows
                [...Array(6)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-4 py-3 text-center"><div className="h-4 w-6 bg-gray-200 rounded mx-auto" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-36 bg-gray-200 rounded" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-12 bg-gray-200 rounded ml-auto" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-12 bg-gray-200 rounded ml-auto" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-20 bg-gray-200 rounded ml-auto" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-20 bg-gray-200 rounded ml-auto" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-16 bg-gray-200 rounded ml-auto" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-20 bg-gray-200 rounded ml-auto" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-16 bg-gray-200 rounded ml-auto" /></td>
                    <td className="px-4 py-3 text-center"><div className="h-4 w-20 bg-gray-200 rounded mx-auto" /></td>
                    <td className="px-4 py-3 text-center"><div className="h-4 w-12 bg-gray-200 rounded mx-auto" /></td>
                  </tr>
                ))
              ) : paginatedRows.length === 0 ? (
                // Clean empty state
                <tr>
                  <td colSpan={11} className="py-12 text-center">
                    <div className="max-w-sm mx-auto space-y-2">
                      <AlertCircle className="w-8 h-8 text-gray-400 mx-auto" />
                      <h4 className="text-sm font-bold text-gray-800">No results for these filters</h4>
                      <p className="text-xs text-gray-500">
                        Try adjusting your filters, clearing search keywords, or selecting a broader reporting period.
                      </p>
                      <button
                        type="button"
                        onClick={handleClearFilters}
                        className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Clear All Filters</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedRows.map((r) => {
                  const isLoss = r.netContribution < 0;
                  return (
                    <tr
                      key={r.dimension_value}
                      onClick={() => setAuditTarget(r)}
                      className="hover:bg-gray-50/80 cursor-pointer transition-colors"
                    >
                      {/* Rank */}
                      <td className="px-4 py-3 text-center font-bold text-gray-500">
                        #{r.rank}
                      </td>

                      {/* Executive / Entity Name & Role */}
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-900 flex items-center gap-2">
                          <span>{r.dimension_value}</span>
                          {r.segment && r.segment !== 'Regular' && (
                            <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 border border-purple-200">
                              {r.segment}
                            </span>
                          )}
                        </div>
                        {r.role && (
                          <div className="text-[11px] text-gray-400">{r.role}</div>
                        )}
                      </td>

                      {/* Placements */}
                      <td className="px-4 py-3 text-right font-medium text-gray-700">
                        {r.placements}
                      </td>

                      {/* Enquiries */}
                      <td className="px-4 py-3 text-right text-gray-600">
                        {r.enquiries}
                      </td>

                      {/* Company Share */}
                      <td className="px-4 py-3 text-right font-bold text-gray-900">
                        {formatINR(r.company_share)}
                      </td>

                      {/* Cost of Execution with estimated badge if applicable */}
                      <td className="px-4 py-3 text-right text-gray-700">
                        <div className="flex items-center justify-end gap-1">
                          <span>{formatINR(r.costOfExecution)}</span>
                          {r.cost_is_estimated && (
                            <span className="text-[9px] text-amber-600 bg-amber-50 px-1 rounded border border-amber-200" title="Cost derived from standard baseline">
                              est
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Credit Notes */}
                      <td className="px-4 py-3 text-right font-semibold text-rose-600">
                        {r.churnCost > 0 ? formatINR(r.churnCost) : '₹0'}
                      </td>

                      {/* Net Contribution */}
                      <td className={`px-4 py-3 text-right font-extrabold ${isLoss ? 'text-rose-600' : 'text-teal-700'}`}>
                        {formatINR(r.netContribution)}
                      </td>

                      {/* Net / Enquiry */}
                      <td className={`px-4 py-3 text-right font-medium ${r.netSurplusPerEnquiry < 0 ? 'text-rose-600' : 'text-gray-700'}`}>
                        {formatINR(r.netSurplusPerEnquiry)}
                      </td>

                      {/* Verdict Badge */}
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          r.verdict === 'star' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          r.verdict === 'healthy' ? 'bg-teal-50 text-teal-700 border-teal-200' :
                          r.verdict === 'breakeven' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          r.verdict === 'at_risk' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                          'bg-rose-50 text-rose-700 border-rose-200'
                        }`}>
                          {r.verdict_label || r.verdict}
                        </span>
                      </td>

                      {/* Audit & Collections Action */}
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setAuditTarget(r);
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-700 hover:text-teal-900 bg-teal-50/60 hover:bg-teal-100/60 px-2 py-1 rounded border border-teal-200 transition-colors"
                          >
                            <span>Audit</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </button>
                          {activeTab === 'tl' && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                sessionStorage.setItem('fintective_selected_tl', r.dimension_value);
                                if (typeof setActivePage === 'function') {
                                  setActivePage('tl-performance');
                                } else {
                                  window.dispatchEvent(new CustomEvent('navigate-to-page', { detail: { page: 'tl-performance', tl: r.dimension_value } }));
                                }
                              }}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 hover:text-blue-900 bg-blue-50/60 hover:bg-blue-100/60 px-2 py-1 rounded border border-blue-200 transition-colors"
                              title={`View collections worklist for ${r.dimension_value}`}
                            >
                              <span>Collections</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 8. True-Count Pagination Controls */}
        {!loading && totalRows > 0 && (
          <div className="px-4 py-3 bg-gray-50/50 border-t border-gray-200 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-600">
            <div>
              Showing <span className="font-semibold text-gray-900">{startRowIndex}</span> to{' '}
              <span className="font-semibold text-gray-900">{endRowIndex}</span> of{' '}
              <span className="font-semibold text-gray-900">{totalRows}</span> records
            </div>

            {itemsPerPage !== 'all' && totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  className="px-2.5 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  Previous
                </button>
                <span className="px-2 font-medium">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  className="px-2.5 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 9. Universal Audit Drawer */}
      {auditTarget && (
        <AuditDrawer
          isOpen={!!auditTarget}
          onClose={() => setAuditTarget(null)}
          entityType={activeTab}
          entityId={auditTarget.dimension_value}
          entityName={auditTarget.dimension_value}
          month={cleanMonthParam}
          fy={selectedYear || '2026-2027'}
        />
      )}
    </div>
  );
}
