import { runCrmSync } from '../utils/crmSync';
import { loadFinanceCollections } from '../utils/financeDataLoader.js';
import React, { createContext, useState, useEffect, useMemo, useRef } from 'react';
import {
  API_BASE_URL,
  isApiKeyConfigured,
  fetchWithApiKey,
  logApiDiagnostic
} from '../utils/apiClient';

export const FinanceContext = createContext();
export { API_BASE_URL };

const DEFAULT_FRANCHISEES = [
  { id: 'f-1', name: 'Sandeep', owner: 'Avadai Esakki', city: 'Nagpur', teamLeaderName: 'Avadai Esakki Muthu Sundaram Marthuvar', onboardingDate: '2024-04-01', status: 'Active', candidatesPlaced: 12 },
  { id: 'f-2', name: 'Preshita Rane', owner: 'Joyeeta Joydeb Khaskel', city: 'Mumbai', teamLeaderName: 'Joyeeta Joydeb Khaskel', onboardingDate: '2024-05-15', status: 'Active', candidatesPlaced: 18 },
  { id: 'f-3', name: 'Razia Begum', owner: 'Vedika Girish Tolani', city: 'Hyderabad', teamLeaderName: 'Vedika Girish Tolani', onboardingDate: '2024-06-10', status: 'Active', candidatesPlaced: 15 },
  { id: 'f-4', name: 'Anita Mandar Kulkarni', owner: 'Surbhi Vinod Jain', city: 'Pune', teamLeaderName: 'Surbhi Vinod Jain', onboardingDate: '2024-04-20', status: 'Active', candidatesPlaced: 14 },
  { id: 'f-5', name: 'Subhash Pande', owner: 'Joyeeta Joydeb Khaskel', city: 'Bengaluru', teamLeaderName: 'Joyeeta Joydeb Khaskel', onboardingDate: '2024-07-01', status: 'Active', candidatesPlaced: 9 },
  { id: 'f-6', name: 'Ankur Sharma', owner: 'Vedika Girish Tolani', city: 'Delhi NCR', teamLeaderName: 'Vedika Girish Tolani', onboardingDate: '2024-05-01', status: 'Active', candidatesPlaced: 11 }
];

const DEFAULT_BD_AGENTS = [
  { id: 'bd-1', name: 'Komal Suresh Bhanushali', role: 'Key Account Manager', baseSalary: 20000, commissionRate: 0.03, payPerProgressed: 2500, payPerCancelled: 500, leadsBought: 3923, leadsProgressed: 1840, leadsCancelled: 420, status: 'Active' },
  { id: 'bd-2', name: 'Rajalaxmi Das Das', role: 'Enterprise Account Exec', baseSalary: 22000, commissionRate: 0.04, payPerProgressed: 2500, payPerCancelled: 500, leadsBought: 1588, leadsProgressed: 742, leadsCancelled: 180, status: 'Active' },
  { id: 'bd-3', name: 'Jahnvi Thakker', role: 'Senior BD Specialist', baseSalary: 25000, commissionRate: 0.05, payPerProgressed: 2500, payPerCancelled: 500, leadsBought: 720, leadsProgressed: 380, leadsCancelled: 95, status: 'Active' },
  { id: 'bd-4', name: 'Ashutosh Manoj Hiremath', role: 'Senior BD Specialist', baseSalary: 22000, commissionRate: 0.04, payPerProgressed: 2500, payPerCancelled: 500, leadsBought: 82, leadsProgressed: 42, leadsCancelled: 10, status: 'Active' },
  { id: 'bd-5', name: 'Kadambinee Kundu', role: 'Enterprise Account Exec', baseSalary: 20000, commissionRate: 0.03, payPerProgressed: 2500, payPerCancelled: 500, leadsBought: 79, leadsProgressed: 25, leadsCancelled: 33, status: 'Active' },
  { id: 'bd-6', name: 'Muskan Ritesh Pradhan', role: 'BD Specialist', baseSalary: 18000, commissionRate: 0.03, payPerProgressed: 2500, payPerCancelled: 500, leadsBought: 18, leadsProgressed: 15, leadsCancelled: 2, status: 'Active' },
  { id: 'bd-7', name: 'Rahul Patil', role: 'Senior BD Specialist', baseSalary: 25000, commissionRate: 0.05, payPerProgressed: 2500, payPerCancelled: 500, leadsBought: 35, leadsProgressed: 16, leadsCancelled: 8, status: 'Active' },
  { id: 'bd-8', name: 'Sneha Kulkarni', role: 'Enterprise Account Exec', baseSalary: 22000, commissionRate: 0.04, payPerProgressed: 2500, payPerCancelled: 500, leadsBought: 30, leadsProgressed: 14, leadsCancelled: 6, status: 'Active' },
  { id: 'bd-9', name: 'Ankur Sharma', role: 'BD Manager', baseSalary: 24000, commissionRate: 0.04, payPerProgressed: 2500, payPerCancelled: 500, leadsBought: 32, leadsProgressed: 15, leadsCancelled: 5, status: 'Active' },
  { id: 'bd-10', name: 'Ruchi Shukla', role: 'BD Specialist', baseSalary: 18000, commissionRate: 0.03, payPerProgressed: 2500, payPerCancelled: 500, leadsBought: 24, leadsProgressed: 7, leadsCancelled: 0, status: 'Active' },
  { id: 'bd-11', name: 'Shreya Santosh Talashilkar', role: 'BD Specialist', baseSalary: 18000, commissionRate: 0.03, payPerProgressed: 2500, payPerCancelled: 500, leadsBought: 17, leadsProgressed: 8, leadsCancelled: 9, status: 'Active' },
  { id: 'bd-12', name: 'Sneha Santosh Jaiswal', role: 'BD Associate', baseSalary: 16000, commissionRate: 0.02, payPerProgressed: 2500, payPerCancelled: 500, leadsBought: 89, leadsProgressed: 3, leadsCancelled: 1, status: 'Active' },
  { id: 'bd-13', name: 'Shruti Wilson Adhav', role: 'BD Associate', baseSalary: 16000, commissionRate: 0.02, payPerProgressed: 2500, payPerCancelled: 500, leadsBought: 9, leadsProgressed: 3, leadsCancelled: 1, status: 'Active' },
  { id: 'bd-14', name: 'Jiya Pran Sanda', role: 'BD Associate', baseSalary: 16000, commissionRate: 0.02, payPerProgressed: 2500, payPerCancelled: 500, leadsBought: 14, leadsProgressed: 2, leadsCancelled: 0, status: 'Active' },
  { id: 'bd-15', name: 'Sonali Jayanta Singh', role: 'BD Associate', baseSalary: 16000, commissionRate: 0.02, payPerProgressed: 2500, payPerCancelled: 500, leadsBought: 6, leadsProgressed: 1, leadsCancelled: 0, status: 'Active' }
];

const DEFAULT_TEAM_LEADERS = [
  { id: 'tl-1', name: 'Avadai Esakki Muthu Sundaram Marthuvar', role: 'Senior Team Leader', target: 500000 },
  { id: 'tl-2', name: 'Surbhi Vinod Jain', role: 'Team Leader', target: 500000 },
  { id: 'tl-3', name: 'Joyeeta Joydeb Khaskel', role: 'Team Leader', target: 500000 },
  { id: 'tl-4', name: 'Vedika Girish Tolani', role: 'Team Leader', target: 500000 },
  { id: 'tl-5', name: 'Pooja Sharma', role: 'Team Leader', target: 450000 },
  { id: 'tl-6', name: 'Rajesh Patil', role: 'Team Leader', target: 450000 },
  { id: 'tl-7', name: 'Amit Shinde', role: 'Team Leader', target: 400000 },
  { id: 'tl-8', name: 'Priya Shah', role: 'Team Leader', target: 400000 },
  { id: 'tl-9', name: 'Sanjay Joshi', role: 'Team Leader', target: 350000 },
  { id: 'tl-10', name: 'Vikram Mehta', role: 'Team Leader', target: 350000 }
];

// Helper to standardize Financial Year format to standard YYYY-YYYY (e.g. '2024-2025', '2025-2026')
// Also converts short formats like '2025-26' -> '2025-2026' and fixes invalid ones like '2025-2025'
export const normalizeFinancialYear = (fy, dateStr = null) => {
  if (typeof fy === 'string') {
    const clean = fy.trim();
    // 1. Standard 4-digit consecutive format: YYYY-YYYY (e.g. 2025-2026)
    const match4 = clean.match(/^(\d{4})-(\d{4})$/);
    if (match4) {
      const y1 = parseInt(match4[1], 10);
      const y2 = parseInt(match4[2], 10);
      if (y2 === y1 + 1) {
        return `${y1}-${y2}`;
      }
    }
    // 2. Short 2-digit format: YYYY-YY (e.g. 2025-26 -> 2025-2026)
    const match2 = clean.match(/^(\d{4})-(\d{2})$/);
    if (match2) {
      const y1 = parseInt(match2[1], 10);
      const y2Suffix = parseInt(match2[2], 10);
      const century = Math.floor(y1 / 100) * 100;
      const y2 = century + y2Suffix;
      if (y2 === y1 + 1) {
        return `${y1}-${y2}`;
      }
    }
  }

  // 3. Fallback: derive strictly valid consecutive FY from date (e.g. invalid '2025-2025' gets corrected)
  if (dateStr) {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = d.getMonth(); // 0=Jan, 3=Apr
      return m >= 3 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
    }
  }
  return null;
};

export const getCurrentFY = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-indexed: 0=Jan, 3=Apr
  return m >= 3 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
};

const DEFAULT_TRANSACTIONS = [];

const TX_CACHE_VERSION = 'v4_accounting_sources';

export const FinanceProvider = ({ children }) => {
  const currentFY = getCurrentFY();

  const [cacheTimestamp, setCacheTimestamp] = useState(() => {
    return localStorage.getItem('fintective_cache_timestamp') || sessionStorage.getItem('fintective_cache_timestamp') || null;
  });

  const [transactions, setTransactions] = useState(() => {
    try {
      const storedVersion = localStorage.getItem('fintective_tx_cache_version');
      if (storedVersion !== TX_CACHE_VERSION) {
        localStorage.removeItem('fintective_cached_txs');
        sessionStorage.removeItem('fintective_cached_txs');
        return [];
      }
      const cached = localStorage.getItem('fintective_cached_txs') || sessionStorage.getItem('fintective_cached_txs');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map(tx => ({
            ...tx,
            financialYear: normalizeFinancialYear(tx.financialYear, tx.date) || currentFY
          }));
        }
      }
      return [];
    } catch {
      return [];
    }
  });
  const [franchisees, setFranchisees] = useState(() => {
    try {
      const cached = localStorage.getItem('fintective_cached_franchisees') || sessionStorage.getItem('fintective_cached_franchisees');
      const parsed = cached ? JSON.parse(cached) : null;
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_FRANCHISEES;
    } catch {
      return DEFAULT_FRANCHISEES;
    }
  });
  const [bdAgents, setBdAgents] = useState(() => {
    try {
      const cached = localStorage.getItem('fintective_cached_bd') || sessionStorage.getItem('fintective_cached_bd');
      const parsed = cached ? JSON.parse(cached) : null;
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_BD_AGENTS;
    } catch {
      return DEFAULT_BD_AGENTS;
    }
  });
  const [teamLeaders, setTeamLeaders] = useState(() => {
    try {
      const cached = localStorage.getItem('fintective_cached_tl') || sessionStorage.getItem('fintective_cached_tl');
      const parsed = cached ? JSON.parse(cached) : null;
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_TEAM_LEADERS;
    } catch {
      return DEFAULT_TEAM_LEADERS;
    }
  });
  const [budgets, setBudgets] = useState(() => {
    try {
      const cached = localStorage.getItem('fintective_cached_budgets') || sessionStorage.getItem('fintective_cached_budgets');
      return cached ? JSON.parse(cached) : {};
    } catch { return {}; }
  });

  const [lastSyncedAt, setLastSyncedAt] = useState(() => {
    return sessionStorage.getItem('fintective_last_synced_at') || null;
  });

  const [selectedMonth, setSelectedMonth] = useState('All Months');
  const [financeSummary, setFinanceSummary] = useState(null);
  const [selectedYear, setSelectedYear] = useState(() => {
    const saved = localStorage.getItem('saarthi_selected_year');
    const normalized = saved ? normalizeFinancialYear(saved) : null;
    return (normalized && normalized !== 'All Years') ? normalized : currentFY;
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const toggleSidebar = () => setIsSidebarOpen(prev => !prev);

  const availableMonths = React.useMemo(() => {
    if (!Array.isArray(transactions)) return ['All Months'];
    const months = new Set();
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    transactions.forEach(tx => {
      if (tx && tx.date) {
        const d = new Date(tx.date);
        if (!isNaN(d.getTime())) {
          months.add(`${monthNames[d.getMonth()]} ${d.getFullYear()}`);
        }
      }
    });
    const sortedMonths = Array.from(months).sort((a, b) => {
      const partsA = a.split(' ');
      const partsB = b.split(' ');
      const dateA = new Date(parseInt(partsA[1]), monthNames.indexOf(partsA[0]));
      const dateB = new Date(parseInt(partsB[1]), monthNames.indexOf(partsB[0]));
      return dateB - dateA;
    });
    return ['All Months', ...sortedMonths];
  }, [transactions]);

  const availableYears = React.useMemo(() => {
    const years = new Set();
    // Standard consecutive financial years only
    years.add('2026-2027');
    years.add('2025-2026');
    years.add('2024-2025');
    years.add('2023-2024');

    if (Array.isArray(transactions)) {
      transactions.forEach(tx => {
        const norm = normalizeFinancialYear(tx?.financialYear, tx?.date);
        if (norm) {
          years.add(norm);
        }
      });
    }

    const sortedYears = Array.from(years)
      .filter(y => {
        if (!y || y === 'All Years') return false;
        // Strictly only allow valid consecutive 4-digit years YYYY-(YYYY+1)
        const m = y.match(/^(\d{4})-(\d{4})$/);
        if (!m) return false;
        const y1 = parseInt(m[1], 10);
        const y2 = parseInt(m[2], 10);
        return y2 === y1 + 1; // Rejects 2025-2025, 2025-26, etc.
      })
      .sort((a, b) => b.localeCompare(a));

    return [...sortedYears, 'All Years'];
  }, [transactions]);

  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('saarthi_current_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [userRole, setUserRole] = useState(() => {
    const saved = localStorage.getItem('saarthi_current_user');
    if (saved) {
      const parsed = JSON.parse(saved);
      return parsed.role;
    }
    return 'admin';
  });

  // Module state
  const [activeModule, setActiveModule] = useState(() => {
    const saved = localStorage.getItem('saarthi_active_module');
    return saved || 'franchise_bd_revenue';
  });

  const [dataSource, setDataSource] = useState(() => {
    try {
      const cached = localStorage.getItem('fintective_cached_txs') || sessionStorage.getItem('fintective_cached_txs');
      return cached ? 'cached' : 'empty';
    } catch {
      return 'empty';
    }
  });

  const [dataState, setDataState] = useState(() => {
    try {
      const cached = localStorage.getItem('fintective_cached_txs') || sessionStorage.getItem('fintective_cached_txs');
      return cached ? 'cached' : 'connecting';
    } catch {
      return 'connecting';
    }
  });

  const [authError, setAuthError] = useState(null);

  const [backendHealth, setBackendHealth] = useState({
    isDbConnected: false,
    cacheWarm: false,
    host: '',
    lastChecked: null,
    raw: null
  });

  const [connectionProgress, setConnectionProgress] = useState({
    isConnecting: false,
    elapsedSec: 0,
    message: ''
  });

  const [endpointStatus, setEndpointStatus] = useState({
    transactions: { status: 'idle', count: 0, error: null },
    franchisees: { status: 'idle', count: 0, error: null },
    bdAgents: { status: 'idle', count: 0, error: null },
    teamLeaders: { status: 'idle', count: 0, error: null },
    budgets: { status: 'idle', count: 0, error: null },
    mlInsights: { status: 'idle', error: null }
  });

  const [lastSyncTimestamp, setLastSyncTimestamp] = useState(() => {
    try {
      const ts = sessionStorage.getItem('fintective_last_synced_ts');
      return ts ? parseInt(ts, 10) : null;
    } catch {
      return null;
    }
  });

  const [timeAgo, setTimeAgo] = useState('just now');

  // Dynamically update 'Live · updated X min ago' text every 15 seconds
  useEffect(() => {
    const updateAge = () => {
      if (!lastSyncTimestamp) {
        setTimeAgo('never');
        return;
      }
      const diffSec = Math.max(0, Math.floor((Date.now() - lastSyncTimestamp) / 1000));
      if (diffSec < 60) {
        setTimeAgo('just now');
      } else if (diffSec < 120) {
        setTimeAgo('1 min ago');
      } else if (diffSec < 3600) {
        setTimeAgo(`${Math.floor(diffSec / 60)} min ago`);
      } else {
        const hrs = Math.floor(diffSec / 3600);
        setTimeAgo(`${hrs}h ago`);
      }
    };

    updateAge();
    const interval = setInterval(updateAge, 15000);
    return () => clearInterval(interval);
  }, [lastSyncTimestamp]);

  const [mlInsights, setMlInsights] = useState(() => {
    try {
      const cached = sessionStorage.getItem('fintective_ml_insights');
      return cached ? JSON.parse(cached) : null;
    } catch { return null; }
  });
  const [isMlInsightsLoading, setIsMlInsightsLoading] = useState(false);

  // Standalone ML insights fetcher with optional force refresh
  const fetchMlInsights = async (force = false) => {
    setIsMlInsightsLoading(true);
    try {
      const res = await fetchWithApiKey(`${API_BASE_URL}/ml/insights${force ? '?force=true&refresh=1' : ''}`, { timeoutMs: 60000 });
      if (res.ok) {
        const data = await res.json();
        setMlInsights(data);
        try {
          sessionStorage.setItem('fintective_ml_insights', JSON.stringify(data));
        } catch (e) { }
        return data;
      }
    } catch (err) {
      console.warn('Failed to load ML insights:', err.message);
    } finally {
      setIsMlInsightsLoading(false);
    }
    return null;
  };

  const [isLoadingData, setIsLoadingData] = useState(() => {
    try {
      const cached = localStorage.getItem('fintective_cached_txs') || sessionStorage.getItem('fintective_cached_txs');
      return !cached;
    } catch {
      return true;
    }
  });
  const [isBackgroundSyncing, setIsBackgroundSyncing] = useState(false);

  const loadInFlight = useRef(null);
  const storageKeys = {
    transactions: 'fintective_cached_txs', franchisees: 'fintective_cached_franchisees',
    bdAgents: 'fintective_cached_bd', teamLeaders: 'fintective_cached_tl', budgets: 'fintective_cached_budgets'
  };

  const loadCoreData = async (isManual) => {
    setIsBackgroundSyncing(true);
    setAuthError(null);
    setDataState(previous => ['live', 'cached', 'partial'].includes(previous) ? previous : 'connecting');
    setConnectionProgress({ isConnecting: true, elapsedSec: 0, message: 'Loading finance data...' });
    try {
      if (!isApiKeyConfigured()) {
        setAuthError('Finance API key is missing from the deployed frontend configuration.');
        setDataState('auth_error');
        return false;
      }
      // Health is informational and never delays real data requests.
      fetchWithApiKey(`${API_BASE_URL}/health`, { retries: 1, timeoutMs: 5000 })
        .then(response => response.ok ? response.json() : null)
        .then(data => {
          if (data) setBackendHealth({
            isDbConnected: data.database?.status === 'connected',
            cacheWarm: Boolean(data.cache?.warm), host: '', lastChecked: new Date().toLocaleTimeString(), raw: data
          });
        })
        .catch(() => { });

      const results = await loadFinanceCollections({
        base: API_BASE_URL, request: fetchWithApiKey, refresh: isManual,
        onData: (key, data) => {
          const value = key === 'transactions' ? data.map(tx => ({
            ...tx,
            financialYear: normalizeFinancialYear(tx.financialYear, tx.date) || currentFY
          })) : data;
          ({
            transactions: setTransactions, franchisees: setFranchisees, bdAgents: setBdAgents,
            teamLeaders: setTeamLeaders, budgets: setBudgets
          })[key](value);
          setEndpointStatus(previous => ({
            ...previous, [key]: {
              status: Array.isArray(value) && !value.length ? 'empty' : 'ok',
              count: Array.isArray(value) ? value.length : undefined, error: null
            }
          }));
          try {
            let toStore = value;
            if (key === 'transactions' && Array.isArray(value) && value.length > 2500) {
              toStore = value.slice(-2500);
            }
            const serialized = JSON.stringify(toStore);
            try { sessionStorage.setItem(storageKeys[key], serialized); } catch {}
            try { localStorage.setItem(storageKeys[key], serialized); } catch {}
            if (key === 'transactions') {
              try { localStorage.setItem('fintective_tx_cache_version', TX_CACHE_VERSION); } catch {}
            }
          } catch { /* Storage limits must not discard a successful network result. */ }
          if (key === 'transactions') {
            setDataSource('backend');
            setDataState('live');
            setIsLoadingData(false);
            const timestamp = Date.now();
            const label = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            setLastSyncTimestamp(timestamp);
            setLastSyncedAt(label);
            try {
              sessionStorage.setItem('fintective_last_synced_at', label);
              sessionStorage.setItem('fintective_last_synced_ts', String(timestamp));
            } catch { /* The displayed data is still fresh without persistent storage. */ }
          }
        },
        onError: (key, error) => {
          setEndpointStatus(previous => ({ ...previous, [key]: { status: 'failed', error: error.message } }));
          logApiDiagnostic('error', { url: `${API_BASE_URL}/${key}`, status: error.status, message: error.message });
        }
      });
      const failed = results.filter(result => !result.ok);
      const fatal = failed.find(result => result.error.isAuthError || [401, 403].includes(result.error.status));
      const routing = failed.find(result => result.error.isHtml || result.error.isConfigError || result.error.status === 404);
      if (fatal || routing) {
        setAuthError((fatal || routing).error.message);
        setDataState(fatal ? 'auth_error' : 'routing_error');
        return false;
      }
      if (results.find(result => result.key === 'transactions')?.ok) {
        setDataState(failed.length ? 'partial' : 'live');
        if (failed.length) setAuthError(failed.map(result => `${result.key}: ${result.error.message}`).join(' | '));
        // ML work starts after publishing core data, never before the transaction view.
        void fetchMlInsights(isManual);
        return failed.length === 0;
      }
      setAuthError(failed.map(result => `${result.key}: ${result.error.message}`).join(' | '));
      // Keep previously fetched records with an explicit stale-data label. Never
      // fabricate alternate financial totals by calling the CRM from the browser.
      try {
        const saved = localStorage.getItem('fintective_cached_txs') || sessionStorage.getItem('fintective_cached_txs');
        const cached = saved === null ? null : JSON.parse(saved);
        if (Array.isArray(cached) && cached.length > 0) {
          setTransactions(cached);
          setDataSource('cached');
          setDataState('cached');
          return false;
        }
      } catch { /* Invalid browser cache is not a finance record source. */ }
      if (transactions && transactions.length > 0) {
        setDataState('cached');
        return false;
      }
      setDataSource('empty');
      setDataState('offline');
      return false;
    } catch (error) {
      setAuthError(error.message || 'Unable to load finance data.');
      if (transactions && transactions.length > 0) {
        setDataState('cached');
      } else {
        setDataState('offline');
      }
      return false;
    } finally {
      setIsLoadingData(false);
      setIsBackgroundSyncing(false);
      setConnectionProgress({ isConnecting: false, elapsedSec: 0, message: '' });
    }
  };

  const fetchAllData = (isManual = false) => {
    const current = loadInFlight.current;
    if (current) {
      // A post-sync manual refresh must run after any older background request.
      if (isManual && !current.manual) return current.promise.then(() => fetchAllData(true));
      return current.promise;
    }
    const promise = loadCoreData(isManual).finally(() => { loadInFlight.current = null; });
    loadInFlight.current = { promise, manual: isManual };
    return promise;
  };

  const syncWithSaarthi = async (options = {}) => runCrmSync({
    apiBaseUrl: API_BASE_URL,
    request: fetchWithApiKey,
    onRefresh: () => fetchAllData(true),
    ...options
  });

  // Refresh in the background; shared in-flight requests prevent overlapping loads.
  useEffect(() => {
    // Publish each collection immediately as it arrives.
    fetchAllData();

    // Periodic background refresh (90s — balanced between freshness and server load)
    const interval = setInterval(() => {
      fetchAllData();
    }, 90000);

    // Keep-alive ping every 8 minutes so Render never hits its 15-min inactivity sleep
    const keepAlive = setInterval(() => {
      fetch(`${API_BASE_URL}/warmup`).catch(() => { });
    }, 8 * 60 * 1000);

    return () => {
      clearInterval(interval);
      clearInterval(keepAlive);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('saarthi_active_module', activeModule);
  }, [activeModule]);

  useEffect(() => {
    localStorage.setItem('saarthi_selected_month', selectedMonth);
  }, [selectedMonth]);

  useEffect(() => {
    localStorage.setItem('saarthi_selected_year', selectedYear);
  }, [selectedYear]);

  useEffect(() => {
    if (availableYears && availableYears.length > 0 && !availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears.includes(currentFY) ? currentFY : availableYears[0]);
    }
  }, [availableYears, selectedYear, currentFY]);

  useEffect(() => {
    if (availableMonths && availableMonths.length > 0 && !availableMonths.includes(selectedMonth)) {
      setSelectedMonth(availableMonths[0]);
    }
  }, [availableMonths, selectedMonth]);

  const [currentCashBalance, setCurrentCashBalance] = useState(null);
  const [movingAvgBurn, setMovingAvgBurn] = useState(null);
  const [cashLedgerHistory, setCashLedgerHistory] = useState([]);
  const [cashBreakdown, setCashBreakdown] = useState(null);
  const [financeError, setFinanceError] = useState(null);
  const getFinancePeriod = () => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const names = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    if (selectedMonth !== 'All Months') {
      const [name, rawYear] = selectedMonth.split(' ');
      const month = names.indexOf(name);
      const year = Number(rawYear);
      if (month >= 0 && Number.isFinite(year)) {
        const first = `${year}-${String(month + 1).padStart(2, '0')}-01`;
        const last = `${year}-${String(month + 1).padStart(2, '0')}-${new Date(year, month + 1, 0).getDate()}`;
        return { asOf: last < today ? last : today, query: `start=${first}&as_of=${last < today ? last : today}` };
      }
    }
    const match = String(selectedYear).match(/(\d{4})[-/](\d{2,4})/);
    if (match) {
      const endYear = Number(match[1]) + 1;
      const end = `${endYear}-03-31`;
      return { asOf: end < today ? end : today, query: `fy=${encodeURIComponent(selectedYear)}&as_of=${end < today ? end : today}` };
    }
    return { asOf: today, query: `period=all&as_of=${today}` };
  };

  useEffect(() => {
    let active = true;
    const period = getFinancePeriod();
    setCurrentCashBalance(null);
    setCashLedgerHistory([]);
    setFinanceSummary(null);
    setCashBreakdown(null);
    setFinanceError(null);
    const load = async () => {
      try {
        const [cashRes, summaryRes] = await Promise.all([
          fetchWithApiKey(`${API_BASE_URL}/finance/cash-balance?as_of=${period.asOf}`),
          fetchWithApiKey(`${API_BASE_URL}/finance/summary?${period.query}`)
        ]);
        const [cash, summary] = await Promise.all([cashRes.json(), summaryRes.json()]);
        if (!cashRes.ok || !summaryRes.ok) throw new Error(cash.error || summary.error || 'Unable to load financial sources');
        if (!active) return;
        setCurrentCashBalance(cash.cash_balance ?? null);
        setCashLedgerHistory(cash.history || []);
        setCashBreakdown(cash.breakdown || null);
        setFinanceSummary(summary);
      } catch (err) {
        if (active) setFinanceError(err.message);
      }
    };
    load();
    return () => { active = false; };
  }, [selectedMonth, selectedYear, transactions]);

  useEffect(() => {
    let active = true;
    setMovingAvgBurn(null);
    fetchWithApiKey(`${API_BASE_URL}/finance/moving-avg-burn?as_of=${getFinancePeriod().asOf}`)
      .then(async res => { const data = await res.json(); if (!res.ok) throw new Error(data.error || 'Burn calculation failed'); return data; })
      .then(data => { if (active) setMovingAvgBurn(data.burn ?? null); })
      .catch(err => { if (active) console.error('Recorded burn unavailable:', err.message); });
    return () => { active = false; };
  }, [transactions, selectedMonth, selectedYear]);


  // Derived filtered transactions based on active module (memoized for peak UI performance)
  const moduleFilteredTransactions = useMemo(() => {
    if (!Array.isArray(transactions)) return [];
    if (activeModule === 'job_portal') {
      return transactions.filter(tx => tx && (tx.category === 'Job portal' || tx.category === 'Portal subscriptions'));
    }
    return transactions.filter(tx => tx && tx.category !== 'Job portal' && tx.category !== 'Portal subscriptions');
  }, [transactions, activeModule]);

  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'error') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  };

  // Actions with optimistic updates, response verification, and automatic rollback on failure
  const addTransaction = async (transaction) => {
    try {
      const res = await fetchWithApiKey(`${API_BASE_URL}/transactions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transaction)
      });
      const saved = await res.json();
      if (!res.ok) throw new Error(saved.error || `Server responded with ${res.status}`);
      // Use the persisted ID, so deletion works immediately without reloading.
      setTransactions(prev => [{ ...transaction, ...saved }, ...prev]);
      return saved;
    } catch (err) {
      showToast(`Failed to save transaction: ${err.message}`, 'error');
      throw err;
    }
  };

  const deleteTransaction = async (id) => {
    let deletedTx = null;
    setTransactions((prev) => {
      deletedTx = prev.find((tx) => tx.id === id);
      return prev.filter((tx) => tx.id !== id);
    });
    try {
      const res = await fetchWithApiKey(`${API_BASE_URL}/transactions/${id}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        if (deletedTx) {
          setTransactions((prev) => [deletedTx, ...prev]);
        }
        const errorData = await res.json().catch(() => ({}));
        showToast(`Failed to delete transaction: ${errorData.error || `Server responded with ${res.status}`}`, 'error');
      }
    } catch (err) {
      if (deletedTx) {
        setTransactions((prev) => [deletedTx, ...prev]);
      }
      showToast(`Network error deleting transaction: ${err.message}`, 'error');
      console.error('Failed to delete transaction from server:', err.message);
    }
  };

  const updateBudget = async (category, value) => {
    const updatedVal = parseFloat(value) || 0;
    const oldVal = budgets[category];
    setBudgets((prev) => ({
      ...prev,
      [category]: updatedVal
    }));
    try {
      const res = await fetchWithApiKey(`${API_BASE_URL}/budgets`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [category]: updatedVal })
      });
      if (!res.ok) {
        setBudgets((prev) => ({
          ...prev,
          [category]: oldVal
        }));
        const errorData = await res.json().catch(() => ({}));
        showToast(`Failed to update budget: ${errorData.error || `Server responded with ${res.status}`}`, 'error');
      }
    } catch (err) {
      setBudgets((prev) => ({
        ...prev,
        [category]: oldVal
      }));
      showToast(`Network error updating budget: ${err.message}`, 'error');
      console.error('Failed to update budget on server:', err.message);
    }
  };

  const addFranchisee = async (fran) => {
    const newFran = {
      ...fran,
      id: `f-${Date.now()}`,
      candidatesPlaced: 0,
      status: 'Active'
    };
    setFranchisees((prev) => [...prev, newFran]);
    try {
      const res = await fetchWithApiKey(`${API_BASE_URL}/franchisees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newFran)
      });
      if (!res.ok) {
        setFranchisees((prev) => prev.filter((f) => f.id !== newFran.id));
        const errorData = await res.json().catch(() => ({}));
        showToast(`Failed to save franchisee: ${errorData.error || `Server responded with ${res.status}`}`, 'error');
      }
    } catch (err) {
      setFranchisees((prev) => prev.filter((f) => f.id !== newFran.id));
      showToast(`Network error saving franchisee: ${err.message}`, 'error');
      console.error('Failed to save franchisee to server:', err.message);
    }
  };

  const addBdAgent = async (bd) => {
    const newBd = {
      ...bd,
      id: `bd-${Date.now()}`,
      leadsConverted: bd.leadsProgressed || 0,
      status: 'Active'
    };
    setBdAgents((prev) => [...prev, newBd]);
    try {
      const res = await fetchWithApiKey(`${API_BASE_URL}/bd-agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBd)
      });
      if (!res.ok) {
        setBdAgents((prev) => prev.filter((b) => b.id !== newBd.id));
        const errorData = await res.json().catch(() => ({}));
        showToast(`Failed to save BD agent: ${errorData.error || `Server responded with ${res.status}`}`, 'error');
      }
    } catch (err) {
      setBdAgents((prev) => prev.filter((b) => b.id !== newBd.id));
      showToast(`Network error saving BD agent: ${err.message}`, 'error');
      console.error('Failed to save BD agent to server:', err.message);
    }
  };

  const updateBdAgent = async (id, updatedFields) => {
    let oldAgent = null;
    setBdAgents((prev) => {
      oldAgent = prev.find((agent) => agent.id === id);
      return prev.map((agent) => (agent.id === id ? { ...agent, ...updatedFields } : agent));
    });
    try {
      const res = await fetchWithApiKey(`${API_BASE_URL}/bd-agents/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedFields)
      });
      if (!res.ok) {
        if (oldAgent) {
          setBdAgents((prev) => prev.map((agent) => (agent.id === id ? oldAgent : agent)));
        }
        const errorData = await res.json().catch(() => ({}));
        showToast(`Failed to update BD agent: ${errorData.error || `Server responded with ${res.status}`}`, 'error');
      }
    } catch (err) {
      if (oldAgent) {
        setBdAgents((prev) => prev.map((agent) => (agent.id === id ? oldAgent : agent)));
      }
      showToast(`Network error updating BD agent: ${err.message}`, 'error');
      console.error('Failed to update BD agent on server:', err.message);
    }
  };

  const login = (role, userObj) => {
    const session = { role, name: userObj?.name || 'User', details: userObj || {} };
    setCurrentUser(session);
    setUserRole(role);
    localStorage.setItem('saarthi_current_user', JSON.stringify(session));
  };

  const logout = () => {
    setCurrentUser(null);
    setUserRole('admin');
    localStorage.removeItem('saarthi_current_user');
  };

  const contextValue = useMemo(() => ({
    transactions,
    moduleFilteredTransactions,
    franchisees,
    bdAgents,
    teamLeaders,
    budgets,
    setBudgets,
    selectedMonth,
    setSelectedMonth,
    selectedYear,
    setSelectedYear,
    userRole,
    setUserRole,
    currentUser,
    login,
    logout,
    availableMonths,
    availableYears,
    activeModule,
    setActiveModule,
    dataSource,
    dataState,
    authError,
    backendHealth,
    connectionProgress,
    endpointStatus,
    lastSyncTimestamp,
    timeAgo,
    addTransaction,
    deleteTransaction,
    updateBudget,
    addFranchisee,
    addBdAgent,
    updateBdAgent,
    syncWithSaarthi,
    fetchAllData,
    currentCashBalance,
    movingAvgBurn,
    cashLedgerHistory,
    cashBreakdown,
    financeError,
    financeSummary,
    setFinanceSummary,
    isSidebarOpen,
    setIsSidebarOpen,
    toggleSidebar,
    isLoadingData,
    isBackgroundSyncing,
    lastSyncedAt,
    mlInsights,
    setMlInsights,
    isMlInsightsLoading,
    fetchMlInsights,
    showToast
  }), [
    transactions,
    moduleFilteredTransactions,
    franchisees,
    bdAgents,
    teamLeaders,
    budgets,
    financeSummary,
    selectedMonth,
    selectedYear,
    userRole,
    currentUser,
    availableMonths,
    availableYears,
    activeModule,
    dataSource,
    dataState,
    authError,
    backendHealth,
    connectionProgress,
    endpointStatus,
    lastSyncTimestamp,
    timeAgo,
    currentCashBalance,
    movingAvgBurn,
    cashLedgerHistory,
    cashBreakdown,
    financeError,
    isSidebarOpen,
    isLoadingData,
    isBackgroundSyncing,
    lastSyncedAt,
    mlInsights,
    isMlInsightsLoading,
    toast
  ]);

  return (
    <FinanceContext.Provider value={contextValue}>
      {children}
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            backgroundColor: toast.type === 'error' ? '#1e1b1b' : '#13231b',
            border: toast.type === 'error' ? '1.5px solid rgba(239, 68, 68, 0.4)' : '1.5px solid rgba(16, 185, 129, 0.4)',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
            borderRadius: '8px',
            padding: '14px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            zIndex: 9999,
            color: toast.type === 'error' ? '#fca5a5' : '#86efac',
            fontSize: '0.875rem',
            fontWeight: '500',
            animation: 'fadeIn 0.2s ease-in-out'
          }}
        >
          <span>{toast.message}</span>
        </div>
      )}
    </FinanceContext.Provider>
  );
};
