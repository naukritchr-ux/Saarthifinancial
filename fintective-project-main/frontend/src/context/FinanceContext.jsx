import React, { createContext, useState, useEffect, useMemo } from 'react';
import { 
  API_BASE_URL, 
  API_KEY, 
  isApiKeyConfigured, 
  fetchWithApiKey, 
  fetchJsonWithApiKey,
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

export const FinanceProvider = ({ children }) => {
  const currentFY = getCurrentFY();

  const [cacheTimestamp, setCacheTimestamp] = useState(() => {
    return localStorage.getItem('fintective_cache_timestamp') || sessionStorage.getItem('fintective_cache_timestamp') || null;
  });

  const [transactions, setTransactions] = useState(() => {
    try {
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
      return cached ? JSON.parse(cached) : DEFAULT_FRANCHISEES;
    } catch {
      return DEFAULT_FRANCHISEES;
    }
  });
  const [bdAgents, setBdAgents] = useState(() => {
    try {
      const cached = localStorage.getItem('fintective_cached_bd') || sessionStorage.getItem('fintective_cached_bd');
      return cached ? JSON.parse(cached) : DEFAULT_BD_AGENTS;
    } catch {
      return DEFAULT_BD_AGENTS;
    }
  });
  const [teamLeaders, setTeamLeaders] = useState(() => {
    try {
      const cached = localStorage.getItem('fintective_cached_tl') || sessionStorage.getItem('fintective_cached_tl');
      return cached ? JSON.parse(cached) : DEFAULT_TEAM_LEADERS;
    } catch {
      return DEFAULT_TEAM_LEADERS;
    }
  });
  const [budgets, setBudgets] = useState(() => {
    try {
      const cached = localStorage.getItem('fintective_cached_budgets') || sessionStorage.getItem('fintective_cached_budgets');
      return cached ? JSON.parse(cached) : {
        'Salaries': 800000,
        'BD commissions': 120000,
        'Marketing': 50000,
        'Office & infra': 55000,
        'Portal subscriptions': 85000,
        'Other': 50000
      };
    } catch {
      return {
        'Salaries': 800000,
        'BD commissions': 120000,
        'Marketing': 50000,
        'Office & infra': 55000,
        'Portal subscriptions': 85000,
        'Other': 50000
      };
    }
  });

  const [lastSyncedAt, setLastSyncedAt] = useState(() => {
    return sessionStorage.getItem('fintective_last_synced_at') || null;
  });

  const [selectedMonth, setSelectedMonth] = useState('All Months');
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
      const cached = sessionStorage.getItem('fintective_cached_txs');
      return cached ? 'cached' : 'sample';
    } catch {
      return 'sample';
    }
  });

  const [dataState, setDataState] = useState(() => {
    try {
      const cached = sessionStorage.getItem('fintective_cached_txs');
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

  // Helper functions for matching stable IDs in fallback path (Phase 2)
  const getStableStringHash = (str) => {
    if (!str) return 0;
    const clean = str.trim().toLowerCase();
    let hash = 0;
    for (let i = 0; i < clean.length; i++) {
      hash = ((hash << 5) - hash) + clean.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash) % 100000;
  };

  const matchFranchiseeId = (franName, franList = []) => {
    if (!franName) return null;
    const clean = franName.trim().toLowerCase();
    if (!clean) return null;
    const found = franList.find(f => {
      const fn = (f.nameAsPerAgreement || f.name || '').trim().toLowerCase();
      return fn === clean || (clean && fn.includes(clean)) || (fn && clean.includes(fn));
    });
    if (found && found.id) return found.id;
    return `f-${getStableStringHash(clean)}`;
  };

  const matchBdAgentId = (bdName, bdList = []) => {
    if (!bdName) return null;
    const clean = bdName.trim().toLowerCase();
    if (!clean) return null;
    const found = bdList.find(b => {
      const bn = (b.name || b.bd_name || b.bdMemberName || '').trim().toLowerCase();
      return bn === clean || (clean && bn.includes(clean)) || (bn && clean.includes(bn));
    });
    if (found && found.id) return found.id;
    return `bd-${getStableStringHash(clean)}`;
  };

  const [mlInsights, setMlInsights] = useState(() => {
    try {
      const cached = sessionStorage.getItem('fintective_ml_insights');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [isMlInsightsLoading, setIsMlInsightsLoading] = useState(false);

  // Standalone ML insights fetcher with optional force refresh
  const fetchMlInsights = async (force = false) => {
    setIsMlInsightsLoading(true);
    try {
      const res = await fetchWithApiKey(`${API_BASE_URL}/ml/insights${force ? '?force=true' : ''}`);
      if (res.ok) {
        const data = await res.json();
        setMlInsights(data);
        try {
          sessionStorage.setItem('fintective_ml_insights', JSON.stringify(data));
        } catch (e) {}
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
      const cached = sessionStorage.getItem('fintective_cached_txs');
      return !cached;
    } catch {
      return true;
    }
  });
  const [isBackgroundSyncing, setIsBackgroundSyncing] = useState(false);

  // Poll /api/health with backoff up to 50s for cold Render instance warm-up
  const pollServerHealth = async (maxWaitSeconds = 50) => {
    const startTime = Date.now();
    let delayMs = 1200;
    while ((Date.now() - startTime) < maxWaitSeconds * 1000) {
      const elapsedSec = Math.max(1, Math.round((Date.now() - startTime) / 1000));
      setConnectionProgress({
        isConnecting: true,
        elapsedSec,
        message: elapsedSec > 2 ? `Waking up backend server (${elapsedSec}s)...` : 'Connecting to server...'
      });

      try {
        const res = await fetch(`${API_BASE_URL}/health`, {
          signal: AbortSignal.timeout(6000)
        });
        if (res.ok) {
          const json = await res.json();
          const isDbConnected = json.database?.status === 'connected';
          setBackendHealth({
            isDbConnected,
            cacheWarm: Boolean(json.cache?.warm),
            host: json.database?.host || '',
            lastChecked: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            raw: json
          });
          setConnectionProgress({ isConnecting: false, elapsedSec, message: 'Connected' });
          return { ok: true, isDbConnected, data: json };
        }
      } catch {
        // Cold start in progress or network delay, retry
      }
      await new Promise(r => setTimeout(r, delayMs));
      delayMs = Math.min(delayMs * 1.3, 4000);
    }

    setConnectionProgress({ isConnecting: false, elapsedSec: maxWaitSeconds, message: 'Server unreachable' });
    return { ok: false, error: `Connection timed out after ${maxWaitSeconds}s` };
  };

  // Helper with 60-second abort timeout — accounts for Render cold-start / heavy transactions endpoint
  const fetchWithTimeout = async (url, options = {}, timeoutMs = 60000) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchWithApiKey(url, { ...options, signal: controller.signal });
      clearTimeout(timer);
      return res;
    } catch (e) {
      clearTimeout(timer);
      throw e;
    }
  };

  // Retry wrapper: 3 attempts, 2s → 4s → 8s gaps.
  // 4xx errors (especially 401 Unauthorized) or HTML responses are definitive: do NOT retry
  // 429 Too Many Requests is retried with backoff to protect against Render burst throttling
  const fetchWithRetry = async (url, options = {}, maxAttempts = 3, baseDelayMs = 2000) => {
    let lastErr;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const res = await fetchWithTimeout(url, options);
        if (res.ok) return res;
        if (res.status === 429) {
          const delay = baseDelayMs * Math.pow(2, attempt);
          console.warn(`[Fetch] Rate limit 429 on ${url}. Retrying in ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        if (res.status < 500) return res;
        lastErr = new Error(`HTTP ${res.status}`);
      } catch (e) {
        lastErr = e;
        if (e.isAuthError || e.status === 401 || e.isHtml) {
          throw e; // Definitive failure, do not retry
        }
      }
      if (attempt < maxAttempts) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        console.warn(`[Fetch] Attempt ${attempt}/${maxAttempts} failed for ${url}. Retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
    throw lastErr;
  };

  // Re-usable loader to fetch all data from backend with cold-start polling, auth checking, and resilient fallbacks
  const fetchAllData = async (isManual = false) => {
    setIsBackgroundSyncing(true);
    let loadedFromBackend = false;

    // 1. Verify API Key is configured in environment
    if (!isApiKeyConfigured()) {
      const errMsg = 'Missing VITE_API_KEY environment variable. Backend API requests require a valid key.';
      logApiDiagnostic('error', { url: `${API_BASE_URL}/*`, status: 401, isHtml: false, message: errMsg });
      setAuthError(errMsg);
      setDataState('auth_error');
      setIsBackgroundSyncing(false);
      setIsLoadingData(false);
      return false;
    }

    setAuthError(null);
    setDataState(prev => (prev === 'live' ? 'live' : 'connecting'));

    try {
      // 2. Poll server health first — wakes up Render cold-instance (up to 40s) with visible countdown
      const health = await pollServerHealth(40);

      if (health.ok) {
        // 3. Parallel async fetch of endpoints with retry
        const [txRes, franRes, bdRes, tlRes, budgetRes, mlRes] = await Promise.allSettled([
          fetchWithRetry(`${API_BASE_URL}/transactions`),
          fetchWithRetry(`${API_BASE_URL}/franchisees`),
          fetchWithRetry(`${API_BASE_URL}/bd-agents`),
          fetchWithRetry(`${API_BASE_URL}/team-leaders`),
          fetchWithRetry(`${API_BASE_URL}/budgets`),
          fetchWithRetry(`${API_BASE_URL}/ml/insights`)
        ]);

        // Check for 401 Unauthorized across all endpoint responses
        const any401 = [txRes, franRes, bdRes, tlRes, budgetRes, mlRes].some(
          r => (r.status === 'rejected' && (r.reason?.status === 401 || r.reason?.isAuthError)) ||
               (r.status === 'fulfilled' && r.value?.status === 401)
        );

        if (any401) {
          const authMsg = 'Unauthorized (401): Backend rejected API key. Verify VITE_API_KEY matches the backend API_KEY.';
          logApiDiagnostic('error', { url: `${API_BASE_URL}/transactions`, status: 401, isHtml: false, message: authMsg });
          setAuthError(authMsg);
          setDataState('auth_error');
          setIsBackgroundSyncing(false);
          setIsLoadingData(false);
          return false;
        }

        // Check for HTML response (misrouted proxy / catch-all rewrite)
        const anyHtml = [txRes, franRes, bdRes, tlRes, budgetRes, mlRes].some(
          r => (r.status === 'rejected' && r.reason?.isHtml) ||
               (r.status === 'fulfilled' && (r.value?.headers?.get('content-type') || '').includes('text/html'))
        );

        if (anyHtml) {
          const htmlMsg = 'API call returned HTML instead of JSON. Ensure VITE_API_URL points to the backend server and Vercel proxy rewrites are configured.';
          setAuthError(htmlMsg);
          setDataState('routing_error');
          setIsBackgroundSyncing(false);
          setIsLoadingData(false);
          return false;
        }

        // Process /transactions (A valid empty array [] is a SUCCESSFUL empty result, NOT a failure)
        if (txRes.status === 'fulfilled' && txRes.value.ok) {
          try {
            const txData = await txRes.value.json();
            if (Array.isArray(txData)) {
              const sanitized = txData.map(tx => ({
                ...tx,
                financialYear: normalizeFinancialYear(tx.financialYear, tx.date) || currentFY
              }));
              setTransactions(sanitized);
              loadedFromBackend = true;
              setDataSource('backend');
              setDataState('live');
              setEndpointStatus(prev => ({
                ...prev,
                transactions: { status: sanitized.length > 0 ? 'ok' : 'empty', count: sanitized.length, error: null }
              }));
              try {
                sessionStorage.setItem('fintective_cached_txs', JSON.stringify(sanitized));
                localStorage.setItem('fintective_cached_txs', JSON.stringify(sanitized));
              } catch (e) {}
            }
          } catch (jsonErr) {
            logApiDiagnostic('error', { url: `${API_BASE_URL}/transactions`, status: 200, isHtml: false, message: jsonErr.message });
            setEndpointStatus(prev => ({ ...prev, transactions: { status: 'failed', count: 0, error: jsonErr.message } }));
          }
        } else {
          const err = txRes.status === 'rejected' ? txRes.reason?.message : `HTTP ${txRes.value?.status}`;
          setEndpointStatus(prev => ({ ...prev, transactions: { status: 'failed', count: 0, error: err } }));
        }

        // Process /franchisees
        if (franRes.status === 'fulfilled' && franRes.value.ok) {
          try {
            const franData = await franRes.value.json();
            if (Array.isArray(franData)) {
              setFranchisees(franData);
              setEndpointStatus(prev => ({ ...prev, franchisees: { status: franData.length > 0 ? 'ok' : 'empty', count: franData.length, error: null } }));
              try {
                sessionStorage.setItem('fintective_cached_franchisees', JSON.stringify(franData));
                localStorage.setItem('fintective_cached_franchisees', JSON.stringify(franData));
              } catch (e) {}
            }
          } catch (e) {
            setEndpointStatus(prev => ({ ...prev, franchisees: { status: 'failed', error: e.message } }));
          }
        } else {
          setEndpointStatus(prev => ({ ...prev, franchisees: { status: 'failed', error: franRes.reason?.message || 'Request failed' } }));
        }

        // Process /bd-agents
        if (bdRes.status === 'fulfilled' && bdRes.value.ok) {
          try {
            const bdData = await bdRes.value.json();
            if (Array.isArray(bdData)) {
              setBdAgents(bdData);
              setEndpointStatus(prev => ({ ...prev, bdAgents: { status: bdData.length > 0 ? 'ok' : 'empty', count: bdData.length, error: null } }));
              try { sessionStorage.setItem('fintective_cached_bd', JSON.stringify(bdData)); } catch (e) {}
            }
          } catch (e) {
            setEndpointStatus(prev => ({ ...prev, bdAgents: { status: 'failed', error: e.message } }));
          }
        } else {
          setEndpointStatus(prev => ({ ...prev, bdAgents: { status: 'failed', error: bdRes.reason?.message || 'Request failed' } }));
        }

        // Process /team-leaders
        if (tlRes.status === 'fulfilled' && tlRes.value.ok) {
          try {
            const tlData = await tlRes.value.json();
            if (Array.isArray(tlData)) {
              setTeamLeaders(tlData);
              setEndpointStatus(prev => ({ ...prev, teamLeaders: { status: tlData.length > 0 ? 'ok' : 'empty', count: tlData.length, error: null } }));
              try { sessionStorage.setItem('fintective_cached_tl', JSON.stringify(tlData)); } catch (e) {}
            }
          } catch (e) {
            setEndpointStatus(prev => ({ ...prev, teamLeaders: { status: 'failed', error: e.message } }));
          }
        } else {
          setEndpointStatus(prev => ({ ...prev, teamLeaders: { status: 'failed', error: tlRes.reason?.message || 'Request failed' } }));
        }

        // Process /budgets
        if (budgetRes.status === 'fulfilled' && budgetRes.value.ok) {
          try {
            const budgetData = await budgetRes.value.json();
            if (budgetData && typeof budgetData === 'object') {
              setBudgets(budgetData);
              setEndpointStatus(prev => ({ ...prev, budgets: { status: 'ok', error: null } }));
              try { sessionStorage.setItem('fintective_cached_budgets', JSON.stringify(budgetData)); } catch (e) {}
            }
          } catch (e) {
            setEndpointStatus(prev => ({ ...prev, budgets: { status: 'failed', error: e.message } }));
          }
        } else {
          setEndpointStatus(prev => ({ ...prev, budgets: { status: 'failed', error: budgetRes.reason?.message || 'Request failed' } }));
        }

        // Process /ml/insights
        if (mlRes.status === 'fulfilled' && mlRes.value.ok) {
          try {
            const mlData = await mlRes.value.json();
            if (mlData && typeof mlData === 'object') {
              setMlInsights(mlData);
              setEndpointStatus(prev => ({ ...prev, mlInsights: { status: 'ok', error: null } }));
              try { sessionStorage.setItem('fintective_ml_insights', JSON.stringify(mlData)); } catch (e) {}
            }
          } catch (e) {
            setEndpointStatus(prev => ({ ...prev, mlInsights: { status: 'failed', error: e.message } }));
          }
        } else {
          setEndpointStatus(prev => ({ ...prev, mlInsights: { status: 'failed', error: mlRes.reason?.message || 'Request failed' } }));
        }
      }
    } catch (err) {
      logApiDiagnostic('error', { url: `${API_BASE_URL}/*`, status: 0, isHtml: false, message: err.message });
    }

    // 4. If backend was reached and transactions were loaded:
    if (loadedFromBackend) {
      const now = Date.now();
      setLastSyncTimestamp(now);
      const nowFormatted = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setLastSyncedAt(nowFormatted);
      try {
        sessionStorage.setItem('fintective_last_synced_at', nowFormatted);
        sessionStorage.setItem('fintective_last_synced_ts', String(now));
      } catch (e) {}
      setIsLoadingData(false);
      setIsBackgroundSyncing(false);
      return true;
    }

    // 5. Backend offline or failed: check if valid cached transactions exist in sessionStorage
    const cachedTxsStr = sessionStorage.getItem('fintective_cached_txs');
    if (cachedTxsStr) {
      try {
        const cachedTxs = JSON.parse(cachedTxsStr);
        if (Array.isArray(cachedTxs) && cachedTxs.length > 0) {
          console.log('[Fintective Data State] Backend offline. Using cached transactions from sessionStorage.');
          setTransactions(cachedTxs);
          setDataSource('cached');
          setDataState('cached');
          setIsLoadingData(false);
          setIsBackgroundSyncing(false);
          return false;
        }
      } catch (e) {}
    }

    // 6. Resilient Fallback: Directly pull latest from Saarthi 360 CRM endpoints when backend is waking up / offline
    let crmFallbackSuccess = false;
    try {
      console.log('[Fintective Data State] Backend waking up or offline. Connecting directly to Saarthi CRM API for live data...');
      const [enqRes, invRes, franRes, expRes, expendRes] = await Promise.allSettled([
        fetch('https://api.sarthi360.in/api/enquiries', { signal: AbortSignal.timeout(12000) }),
        fetch('https://api.sarthi360.in/api/Invoice', { signal: AbortSignal.timeout(12000) }),
        fetch('https://api.sarthi360.in/api/franchisees', { signal: AbortSignal.timeout(12000) }),
        fetch('https://api.sarthi360.in/api/expenses', { signal: AbortSignal.timeout(12000) }),
        fetch('https://api.sarthi360.in/api/expenditures/expenditures/all', { signal: AbortSignal.timeout(12000) }).catch(() => null)
      ]);

      let enquiries = [];
      if (enqRes.status === 'fulfilled' && enqRes.value?.ok) {
        const json = await enqRes.value.json();
        enquiries = Array.isArray(json) ? json : (json.data || json.enquiries || []);
      }

      let invoices = [];
      if (invRes.status === 'fulfilled' && invRes.value?.ok) {
        const json = await invRes.value.json();
        invoices = Array.isArray(json) ? json : (json.data || json.invoices || []);
      }

      let currentFranList = franchisees;
      if (franRes.status === 'fulfilled' && franRes.value?.ok) {
        const json = await franRes.value.json();
        const fData = Array.isArray(json) ? json : (json.data || json.franchisees || []);
        if (fData.length > 0) {
          currentFranList = fData;
          setFranchisees(fData);
        }
      }

      let liveExp = [];
      if (expRes.status === 'fulfilled' && expRes.value?.ok) {
        const json = await expRes.value.json();
        liveExp = Array.isArray(json) ? json : (json.data || json.expenses || []);
      }

      let liveExpenditures = [];
      if (expendRes && expendRes.status === 'fulfilled' && expendRes.value?.ok) {
        const json = await expendRes.value.json();
        liveExpenditures = Array.isArray(json) ? json : (json.data || []);
      }

      const liveTxs = [];

      invoices.forEach(inv => {
        if (!inv.id) return;
        const amt = parseFloat(inv.serviceCharges || inv.totalBillAmt || inv.amountReceived || 0);
        const dateStr = (inv.billDate || inv.dateReceived || inv.createdAt || '').split('T')[0];
        if (amt > 0 && dateStr) {
          const franName = inv.franchiseName || '';
          const bdName = inv.nameOfBd || '';
          const infoType = (inv.info || '').toUpperCase();
          const isRev = !['CN', 'LEGAL-CN', 'LEGAL', 'RV', 'C'].includes(infoType);

          // Calculate tenure-aware shares: 70-30 for >= 3 years, 75-25 for < 3 years
          const matchedFran = currentFranList.find(f => 
            (f.nameAsPerAgreement && f.nameAsPerAgreement.toLowerCase().trim() === franName.toLowerCase().trim()) ||
            (f.name && f.name.toLowerCase().trim() === franName.toLowerCase().trim())
          );
          let compRate = 0.25;
          let franRate = 0.75;
          if (matchedFran && matchedFran.onboardingDate) {
            const onb = new Date(matchedFran.onboardingDate);
            const bill = new Date(dateStr);
            if (!isNaN(onb.getTime()) && !isNaN(bill.getTime())) {
              const diffY = (bill - onb) / (365.25 * 24 * 3600 * 1000);
              if (diffY >= 3) {
                compRate = 0.30;
                franRate = 0.70;
              }
            }
          }

          const rawOurShare = parseFloat(inv.ourShare);
          const rawFranShare = parseFloat(inv.franchiseeShare);
          const finalOurShare = (!isNaN(rawOurShare) && rawOurShare > 0) ? rawOurShare : (amt * compRate);
          const finalFranShare = (!isNaN(rawFranShare) && rawFranShare > 0) ? rawFranShare : (amt * franRate);

          liveTxs.push({
            id: `inv-${inv.id}`,
            title: `${inv.companyName || 'Client Placement'} - ${inv.postOfCandidate || 'Recruitment'}`,
            amount: amt,
            type: (!isRev || inv.enquiryStatus === 'credit_note') ? 'credit_note' : 'income',
            category: 'Recruitment Fee',
            subCategory: 'Placement Invoice',
            date: dateStr,
            companyName: inv.companyName || '',
            bdAgentName: bdName,
            teamLeaderName: inv.teamLeader || '',
            franchiseeName: franName,
            franchiseeId: matchFranchiseeId(franName, currentFranList),
            bdAgentId: matchBdAgentId(bdName, bdAgents),
            financialYear: normalizeFinancialYear(inv.financialYear, dateStr) || currentFY,
            city: inv.companyCity || inv.city || 'Mumbai',
            industry: inv.industry || 'Information Technology & Software',
            ourShare: finalOurShare,
            franchiseeShare: finalFranShare,
            info: inv.info || 'R',
            is_revenue: isRev
          });
        }
      });

      enquiries.forEach(enq => {
        if (!enq.id) return;
        const amt = parseFloat(enq.bill_amount || enq.placementFees || 0);
        const dateStr = (enq.bill_date || enq.dateOfAllocation || enq.created_at || '').split('T')[0];
        if (amt > 0 && dateStr && !invoices.some(i => i.enquiry_id === enq.id)) {
          const franName = enq.franchiseeName || '';
          const bdName = enq.bdMemberName || '';
          liveTxs.push({
            id: `enq-${enq.id}`,
            title: `${enq.companyName || 'Client Placement'} - ${enq.positionName || 'Role'}`,
            amount: amt,
            type: 'income',
            category: 'Recruitment Fee',
            subCategory: 'Placement',
            date: dateStr,
            companyName: enq.companyName || '',
            bdAgentName: bdName,
            teamLeaderName: enq.teamLeaderName || '',
            franchiseeName: franName,
            franchiseeId: matchFranchiseeId(franName, currentFranList),
            bdAgentId: matchBdAgentId(bdName, bdAgents),
            financialYear: normalizeFinancialYear(enq.financialYear, dateStr) || currentFY,
            ourShare: amt * 0.25,
            franchiseeShare: amt * 0.75,
            is_revenue: true
          });
        }
      });

      const liveExpenseTxs = [];

      // 1. Transactional Expenditures
      if (liveExpenditures.length > 0) {
        liveExpenditures.forEach(exp => {
          const amt = parseFloat(exp.amount || exp.net || 0);
          const dStr = (exp.billDate || exp.date || exp.createdAt || '').split('T')[0];
          if (amt > 0 && dStr) {
            liveExpenseTxs.push({
              id: `expend-${exp.id || exp.srNo || Math.random()}`,
              title: exp.particulars || exp.expenses || 'Operating Expense',
              amount: amt,
              type: 'expense',
              category: mapCategory(exp.expenses || exp.expenseType || 'Operations', 'expense'),
              subCategory: exp.expenseType || 'Operations',
              date: dStr,
              financialYear: normalizeFinancialYear(exp.financialYear, dStr) || currentFY,
              companyName: 'Saarthi Corporate'
            });
          }
        });
      }

      // 2. Monthly Expense Heads (multiplied by 1000 as per CRM format)
      liveExp.forEach(exp => {
        const franPart = parseFloat(exp.franchisee || 0);
        const recPart = parseFloat(exp.recruitment || 0);
        const total = (franPart + recPart) > 0 ? (franPart + recPart) * 1000 : parseFloat(exp.amount || 0);
        const dStr = (exp.date || exp.billDate || '2026-08-01').split('T')[0];
        if (total > 0) {
          liveExpenseTxs.push({
            id: `exp-api-${exp.id}`,
            title: exp.head_component || exp.particulars || 'Operating Expense',
            amount: total,
            type: 'expense',
            category: exp.head_component?.includes('Rent') ? 'Office & infra' : (exp.head_component?.includes('Software') ? 'Portal subscriptions' : 'Marketing'),
            subCategory: exp.head_component || 'Operations',
            date: dStr,
            financialYear: normalizeFinancialYear(exp.financialYear, dStr) || currentFY,
            companyName: 'Saarthi Corporate'
          });
        }
      });

      const combined = [...liveTxs, ...liveExpenseTxs];

      if (combined.length > 0) {
        setTransactions(combined);
        crmFallbackSuccess = true;
        setDataSource('crm_live_fallback');
        setDataState('live');
        try {
          sessionStorage.setItem('fintective_cached_txs', JSON.stringify(combined));
          localStorage.setItem('fintective_cached_txs', JSON.stringify(combined));
        } catch (e) {}
      }
    } catch (crmErr) {
      console.error('[Fintective] Direct CRM live fallback note:', crmErr);
    }

    if (!crmFallbackSuccess) {
      console.warn('[Fintective Data State] Backend offline and CRM fallback returned no rows.');
      setDataSource('empty');
      setDataState('offline');
      setTransactions([]);
    }

    // Always release loading and sync state
    setIsLoadingData(false);
    setIsBackgroundSyncing(false);
    return false;
  };

  const syncWithSaarthi = async () => {
    try {
      // 1. Capture baselineLogId before the POST request
      let baselineLogId = null;
      try {
        const initStatusRes = await fetchWithApiKey(`${API_BASE_URL}/sync/status`, { timeoutMs: 10000 });
        if (initStatusRes && initStatusRes.ok) {
          const initData = await initStatusRes.json();
          const latestInit = initData.latest || (initData.logs && initData.logs[0]);
          if (latestInit?.id) {
            baselineLogId = latestInit.id;
          }
        }
      } catch (e) {
        console.warn('[Sync] Baseline log fetch notice:', e);
      }

      const response = await fetchWithApiKey(`${API_BASE_URL}/finance/sync-saarthi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        timeoutMs: 60000
      });
      if (response && response.ok) {
        const data = await response.json();
        console.log('[Sync] Raw backend response:', data);

        // If backend started asynchronous sync or reports one in progress, poll /sync/status
        if (data && (data.status === 'started' || data.status === 'in_progress' || data.is_running)) {
          const maxPolls = 60; // 60 * 2.5s = 150 seconds max
          for (let i = 0; i < maxPolls; i++) {
            await new Promise((r) => setTimeout(r, 2500));
            try {
              const statusRes = await fetchWithApiKey(`${API_BASE_URL}/sync/status`, { timeoutMs: 15000 });
              if (statusRes && statusRes.ok) {
                const sData = await statusRes.json();

                // Treat trigger_error as a failure immediately
                if (sData.trigger_error) {
                  return { success: false, error: sData.trigger_error };
                }

                const latest = sData.latest || (sData.logs && sData.logs[0]);
                if (latest) {
                  // In the poll loop, ignore any log whose id equals baselineLogId unless trigger_error is set
                  if (baselineLogId && latest.id === baselineLogId && !sData.trigger_error) {
                    continue;
                  }

                  // If still running, keep waiting
                  if (latest.status === 'in_progress') {
                    continue;
                  }

                  if (latest.status === 'completed' || latest.status === 'completed_with_warnings') {
                    const totalCounts = (latest.enquiries_count || 0) + (latest.invoices_count || 0);
                    const isZeroCountWarning = latest.status === 'completed_with_warnings' && totalCounts === 0;

                    if (isZeroCountWarning) {
                      // Treat 'completed_with_warnings' as a warning/failure when counts are 0, passing message through as errors[]
                      return {
                        success: false,
                        error: latest.message || 'Sync completed with warnings (0 records synced)',
                        data: {
                          ok: false,
                          franchisees: latest.franchisees_count || 0,
                          enquiries: latest.enquiries_count || 0,
                          invoices: latest.invoices_count || 0,
                          expenses: latest.expenses_count || 0,
                          clients: latest.clients_count || 0,
                          legals: latest.legals_count || 0,
                          duration_seconds: latest.duration_seconds || 0,
                          errors: latest.message ? [latest.message] : ['Completed with warnings: 0 records synced']
                        }
                      };
                    }

                    await fetchAllData();
                    return {
                      success: true,
                      data: {
                        ok: true,
                        franchisees: latest.franchisees_count || 0,
                        enquiries: latest.enquiries_count || 0,
                        invoices: latest.invoices_count || 0,
                        expenses: latest.expenses_count || 0,
                        clients: latest.clients_count || 0,
                        legals: latest.legals_count || 0,
                        duration_seconds: latest.duration_seconds || 0,
                        notes: latest.message ? [latest.message] : [],
                        errors: latest.status === 'completed_with_warnings' && latest.message ? [latest.message] : []
                      }
                    };
                  }
                  if (latest.status === 'failed') {
                    return { success: false, error: latest.message || 'Saarthi CRM sync failed on backend.' };
                  }
                }
              }
            } catch (pollErr) {
              console.warn('[Sync] Poll attempt error:', pollErr);
            }
          }
          return { success: false, error: 'Live sync timed out waiting for backend worker.' };
        }

        // Direct synchronous response fallback
        if (data && data.success) {
          await fetchAllData();
          return { success: true, data: data.data || data };
        }
      } else if (response) {
        const errJson = await response.json().catch(() => ({}));
        return { success: false, error: errJson.error || errJson.message || `HTTP ${response.status} error from server.` };
      }
    } catch (backendErr) {
      console.error('[Sync] Backend sync endpoint unreachable:', backendErr);
      return { success: false, error: backendErr.message || 'Backend sync endpoint unreachable. Please verify backend server is running.' };
    }
    return { success: false, error: 'Sync failed on server.' };
  };

  // Auto-poll on mount and every 90s; keep-alive every 8 min to prevent Render cold-sleep
  useEffect(() => {
    // First attempt — server may be cold-starting, warmup fires inside fetchAllData
    fetchAllData();

    // Periodic background refresh (90s — balanced between freshness and server load)
    const interval = setInterval(() => {
      fetchAllData();
    }, 90000);

    // Keep-alive ping every 8 minutes so Render never hits its 15-min inactivity sleep
    const keepAlive = setInterval(() => {
      fetch(`${API_BASE_URL}/warmup`).catch(() => {});
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

  const [currentCashBalance, setCurrentCashBalance] = useState(0);
  const [movingAvgBurn, setMovingAvgBurn] = useState(0);

  const getAsOfDate = (month, year) => {
    let end = '2026-12-31';
    if (month !== 'All Months') {
      const parts = month.split(' ');
      const mName = parts[0];
      const yVal = parseInt(parts[1]);
      const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      const mIdx = monthNames.indexOf(mName);
      if (mIdx !== -1) {
        const lastDay = new Date(yVal, mIdx + 1, 0).getDate();
        end = `${yVal}-${String(mIdx + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      }
    } else if (year !== 'All Years') {
      const parts = year.split('-');
      const yEnd = parts[1] ? parseInt(parts[1]) : parseInt(parts[0]);
      end = `${yEnd}-03-31`;
    }
    return end;
  };

  useEffect(() => {
    const asOf = getAsOfDate(selectedMonth, selectedYear);
    fetchWithApiKey(`${API_BASE_URL}/finance/cash-balance?as_of=${asOf}`)
      .then(res => { if (res.ok) return res.json(); })
      .then(data => {
        if (data && data.cash_balance != null) {
          setCurrentCashBalance(data.cash_balance);
        }
      })
      .catch(err => console.error("Failed to load cash balance:", err));
  }, [selectedMonth, selectedYear, transactions.length]);

  useEffect(() => {
    if (transactions.length === 0) return;
    fetchWithApiKey(`${API_BASE_URL}/finance/moving-avg-burn`)
      .then(res => { if (res.ok) return res.json(); })
      .then(data => {
        if (data && data.burn != null) {
          setMovingAvgBurn(data.burn);
        }
      })
      .catch(err => console.error("Failed to load moving average burn:", err));
  }, [transactions.length]);



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
    const newTx = {
      ...transaction,
      id: `t-${Date.now()}`,
      amount: parseFloat(transaction.amount) || 0,
      subCategory: transaction.subCategory || 'General',
      paymentMode: transaction.paymentMode || 'Cash',
      referenceId: transaction.referenceId || `TXN-${Date.now().toString().slice(-8).toUpperCase()}`
    };
    setTransactions((prev) => [newTx, ...prev]);

    try {
      const res = await fetchWithApiKey(`${API_BASE_URL}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTx)
      });
      if (!res.ok) {
        setTransactions((prev) => prev.filter((tx) => tx.id !== newTx.id));
        const errorData = await res.json().catch(() => ({}));
        showToast(`Failed to save transaction: ${errorData.error || `Server responded with ${res.status}`}`, 'error');
      }
    } catch (err) {
      setTransactions((prev) => prev.filter((tx) => tx.id !== newTx.id));
      showToast(`Network error saving transaction: ${err.message}`, 'error');
      console.error('Failed to sync transaction with server:', err.message);
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
