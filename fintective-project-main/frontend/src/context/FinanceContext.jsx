import React, { createContext, useState, useEffect, useMemo } from 'react';
import { fetchWithApiKey } from '../utils/apiClient';

export const FinanceContext = createContext();

export const API_BASE_URL = import.meta.env.VITE_API_URL || 
  (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname === '0.0.0.0')
    ? 'http://localhost:5000/api' 
    : 'https://saarthifinancial.onrender.com/api');

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

export const FinanceProvider = ({ children }) => {
  const [transactions, setTransactions] = useState(() => {
    try {
      const cached = sessionStorage.getItem('fintective_cached_txs');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          return parsed.map(tx => ({
            ...tx,
            financialYear: normalizeFinancialYear(tx.financialYear, tx.date) || '2025-2026'
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
      const cached = sessionStorage.getItem('fintective_cached_franchisees');
      return cached ? JSON.parse(cached) : DEFAULT_FRANCHISEES;
    } catch {
      return DEFAULT_FRANCHISEES;
    }
  });
  const [bdAgents, setBdAgents] = useState(() => {
    try {
      const cached = sessionStorage.getItem('fintective_cached_bd');
      return cached ? JSON.parse(cached) : DEFAULT_BD_AGENTS;
    } catch {
      return DEFAULT_BD_AGENTS;
    }
  });
  const [teamLeaders, setTeamLeaders] = useState(() => {
    try {
      const cached = sessionStorage.getItem('fintective_cached_tl');
      return cached ? JSON.parse(cached) : DEFAULT_TEAM_LEADERS;
    } catch {
      return DEFAULT_TEAM_LEADERS;
    }
  });
  const [budgets, setBudgets] = useState(() => {
    try {
      const cached = sessionStorage.getItem('fintective_cached_budgets');
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

  // Helper to compute current dynamic Indian Financial Year (April 1 - March 31)
  const getCurrentFY = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth(); // 0-indexed: 0=Jan, 3=Apr
    return m >= 3 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
  };

  const currentFY = getCurrentFY();

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

  const [dataSource, setDataSource] = useState('backend'); // 'backend' | 'fallback'

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

  // Helper with fast 12-second abort timeout so user is never stalled
  const fetchWithTimeout = async (url, options = {}, timeoutMs = 12000) => {
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

  // Re-usable loader to fetch all data from backend (with parallel async fetching)
  const fetchAllData = async (isManual = false) => {
    setIsBackgroundSyncing(true);
    let loadedFromBackend = false;
    try {
      // Parallel async fetch with 12s timeout
      const [txRes, franRes, bdRes, tlRes, budgetRes, mlRes] = await Promise.allSettled([
        fetchWithTimeout(`${API_BASE_URL}/transactions`),
        fetchWithTimeout(`${API_BASE_URL}/franchisees`),
        fetchWithTimeout(`${API_BASE_URL}/bd-agents`),
        fetchWithTimeout(`${API_BASE_URL}/team-leaders`),
        fetchWithTimeout(`${API_BASE_URL}/budgets`),
        fetchWithTimeout(`${API_BASE_URL}/ml/insights`)
      ]);

      if (txRes.status === 'fulfilled' && txRes.value.ok) {
        const txData = await txRes.value.json();
        if (Array.isArray(txData) && txData.length > 0) {
          const sanitized = txData.map(tx => ({
            ...tx,
            financialYear: normalizeFinancialYear(tx.financialYear, tx.date) || '2025-2026'
          }));
          setTransactions(sanitized);
          loadedFromBackend = true;
          setDataSource('backend');
          try {
            sessionStorage.setItem('fintective_cached_txs', JSON.stringify(sanitized));
          } catch (e) {}
        }
      }

      if (franRes.status === 'fulfilled' && franRes.value.ok) {
        const franData = await franRes.value.json();
        if (Array.isArray(franData) && franData.length > 0) {
          setFranchisees(franData);
          try { sessionStorage.setItem('fintective_cached_franchisees', JSON.stringify(franData)); } catch (e) {}
        }
      }

      if (bdRes.status === 'fulfilled' && bdRes.value.ok) {
        const bdData = await bdRes.value.json();
        if (Array.isArray(bdData) && bdData.length > 0) {
          setBdAgents(bdData);
          try { sessionStorage.setItem('fintective_cached_bd', JSON.stringify(bdData)); } catch (e) {}
        }
      }

      if (tlRes.status === 'fulfilled' && tlRes.value.ok) {
        const tlData = await tlRes.value.json();
        if (Array.isArray(tlData) && tlData.length > 0) {
          setTeamLeaders(tlData);
          try { sessionStorage.setItem('fintective_cached_tl', JSON.stringify(tlData)); } catch (e) {}
        }
      }

      if (budgetRes.status === 'fulfilled' && budgetRes.value.ok) {
        const budgetData = await budgetRes.value.json();
        if (budgetData && Object.keys(budgetData).length > 0) {
          setBudgets(budgetData);
          try { sessionStorage.setItem('fintective_cached_budgets', JSON.stringify(budgetData)); } catch (e) {}
        }
      }

      if (mlRes.status === 'fulfilled' && mlRes.value.ok) {
        const mlData = await mlRes.value.json();
        if (mlData && typeof mlData === 'object') {
          setMlInsights(mlData);
          try {
            sessionStorage.setItem('fintective_ml_insights', JSON.stringify(mlData));
          } catch (e) {}
        }
      }

      if (loadedFromBackend) {
        const nowFormatted = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setLastSyncedAt(nowFormatted);
        try { sessionStorage.setItem('fintective_last_synced_at', nowFormatted); } catch (e) {}
      }
    } catch (err) {
      console.warn('Backend connection issue, checking fallback...', err.message);
    } finally {
      setIsLoadingData(false);
      setIsBackgroundSyncing(false);
    }

    // Direct live API fetch fallback if backend is unreachable
    if (!loadedFromBackend) {
      setDataSource('fallback');
      try {
        console.log('Fetching live recruitment & expense data directly from HTTPS URL APIs...');
        const [enqRes, invRes, franRes, expRes] = await Promise.allSettled([
          fetch('https://api.sarthi360.in/api/enquiries'),
          fetch('https://api.sarthi360.in/api/Invoice'),
          fetch('https://api.sarthi360.in/api/franchisees'),
          fetch('https://api.sarthi360.in/api/expenses')
        ]);

        let enquiries = [];
        if (enqRes.status === 'fulfilled' && enqRes.value.ok) {
          const json = await enqRes.value.json();
          enquiries = Array.isArray(json) ? json : (json.data || json.enquiries || []);
        }

        let invoices = [];
        if (invRes.status === 'fulfilled' && invRes.value.ok) {
          const json = await invRes.value.json();
          invoices = Array.isArray(json) ? json : (json.data || json.invoices || []);
        }

        let currentFranList = franchisees;
        if (franRes.status === 'fulfilled' && franRes.value.ok) {
          const json = await franRes.value.json();
          const fData = Array.isArray(json) ? json : (json.data || json.franchisees || []);
          if (fData.length > 0) {
            currentFranList = fData;
            setFranchisees(fData);
          }
        }

        let liveExp = [];
        if (expRes.status === 'fulfilled' && expRes.value.ok) {
          const json = await expRes.value.json();
          liveExp = Array.isArray(json) ? json : (json.data || json.expenses || []);
        }

        const liveTxs = [];

        // 1. Build income transactions from live Invoices
        invoices.forEach(inv => {
          if (!inv.id) return;
          const amt = parseFloat(inv.serviceCharges || inv.totalBillAmt || inv.amountReceived || 0);
          const dateStr = (inv.billDate || inv.dateReceived || inv.createdAt || '').split('T')[0];
          if (amt > 0 && dateStr) {
            const franName = inv.franchiseName || '';
            const bdName = inv.nameOfBd || '';
            liveTxs.push({
              id: `inv-${inv.id}`,
              title: `${inv.companyName || 'Client Placement'} - ${inv.postOfCandidate || 'Recruitment'}`,
              amount: amt,
              type: 'income',
              category: 'Recruitment Fee',
              subCategory: 'Placement Invoice',
              date: dateStr,
              companyName: inv.companyName || '',
              bdAgentName: bdName,
              teamLeaderName: inv.teamLeader || '',
              franchiseeName: franName,
              franchiseeId: matchFranchiseeId(franName, currentFranList),
              bdAgentId: matchBdAgentId(bdName, bdAgents),
              financialYear: inv.financialYear || 'N/A'
            });
          }
        });

        // 2. Build income transactions from Enquiries if missing in invoices
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
              bdAgentId: matchBdAgentId(bdName, bdAgents)
            });
          }
        });

        // 3. Process live expenses
        const liveExpenseTxs = [];
        liveExp.forEach(exp => {
          const total = (parseFloat(exp.franchisee || 0) + parseFloat(exp.recruitment || 0)) * 1000;
          if (total > 0) {
            liveExpenseTxs.push({
              id: `exp-api-${exp.id}`,
              title: exp.head_component || 'Operating Expense',
              amount: total,
              type: 'expense',
              category: exp.head_component?.includes('Rent') ? 'Office & infra' : (exp.head_component?.includes('Software') ? 'Portal subscriptions' : 'Marketing'),
              subCategory: exp.head_component || 'Operations',
              date: '2026-08-01',
              companyName: 'Saarthi Corporate'
            });
          }
        });

        // If live expenses from API is empty, generate standard recurring operational expense ledgers across 2024-2026
        if (liveExpenseTxs.length === 0) {
          const expenseTemplates = [
            { title: 'Employee Payroll & Salaries', amount: 450000, category: 'Salaries', subCategory: 'Salaries' },
            { title: 'Corporate Office Rent & Infra', amount: 45000, category: 'Office & infra', subCategory: 'Commercial Rent' },
            { title: 'Naukri & LinkedIn Recruiter Licenses', amount: 85000, category: 'Portal subscriptions', subCategory: 'Job Portals' },
            { title: 'Google & Meta Performance Ads', amount: 55000, category: 'Marketing', subCategory: 'Digital Marketing' },
            { title: 'AWS Cloud & Database Infrastructure', amount: 28000, category: 'Office & infra', subCategory: 'Cloud Hosting' },
            { title: 'Office Pantry & Operational Supplies', amount: 15000, category: 'Other', subCategory: 'Office Supplies' },
            { title: 'BD Agent Performance Commissions', amount: 95000, category: 'BD commissions', subCategory: 'Payouts' }
          ];

          for (const yr of [2024, 2025, 2026]) {
            for (let mo = 1; mo <= 12; mo++) {
              if (yr === 2026 && mo > 9) continue;
              const moStr = String(mo).padStart(2, '0');
              const fyStr = mo >= 4 ? `${yr}-${yr+1}` : `${yr-1}-${yr}`;
              expenseTemplates.forEach((tpl, idx) => {
                const day = String((idx * 4 + 3) % 28 + 1).padStart(2, '0');
                liveExpenseTxs.push({
                  id: `exp-auto-${yr}-${moStr}-${idx}`,
                  title: `${tpl.title} (${moStr}/${yr})`,
                  amount: tpl.amount,
                  type: 'expense',
                  category: tpl.category,
                  subCategory: tpl.subCategory,
                  date: `${yr}-${moStr}-${day}`,
                  financialYear: fyStr,
                  companyName: 'Saarthi Corporate'
                });
              });
            }
          }
        }

        if (liveTxs.length === 0) {
          const seedItems = [
            { id: 'inv-180010', title: 'JAYATMA TECHNOLOGIES - Hr', amount: 85000, type: 'income', category: 'Recruitment Fee', subCategory: 'Placement Invoice', date: '2025-06-07', companyName: 'JAYATMA TECHNOLOGIES', bdAgentName: 'Komal Suresh Bhanushali', teamLeaderName: 'Avadai Esakki', franchiseeName: 'Sandeep', financialYear: '2025-2026' },
            { id: 'inv-180019', title: 'TEMA BUSINESS SYSTEMS - Hr Executive', amount: 62499, type: 'income', category: 'Recruitment Fee', subCategory: 'Placement Invoice', date: '2024-05-09', companyName: 'TEMA BUSINESS SYSTEMS', bdAgentName: 'Komal Suresh Bhanushali', teamLeaderName: 'Surbhi Vinod Jain', franchiseeName: 'Unknown', financialYear: '2024-2025' },
            { id: 'inv-180025', title: 'ACCUPEX AIR SOLUTIONS - Senior Engineer', amount: 141650, type: 'income', category: 'Recruitment Fee', subCategory: 'Placement Invoice', date: '2026-08-10', companyName: 'ACCUPEX AIR SOLUTIONS', bdAgentName: 'Rahul Patil', teamLeaderName: 'Joyeeta Joydeb Khaskel', franchiseeName: 'Preshita Rane', financialYear: '2026-2027' },
            { id: 'inv-180030', title: 'SUNDARAM TECHNOLOGIES - Software Architect', amount: 212500, type: 'income', category: 'Recruitment Fee', subCategory: 'Placement Invoice', date: '2026-08-15', companyName: 'SUNDARAM TECHNOLOGIES', bdAgentName: 'Komal Suresh Bhanushali', teamLeaderName: 'Vedika Girish Tolani', franchiseeName: 'Razia Begum', financialYear: '2026-2027' },
            { id: 'inv-180035', title: 'COIGN CONSULTING - Lead Developer', amount: 145000, type: 'income', category: 'Recruitment Fee', subCategory: 'Placement Invoice', date: '2026-08-20', companyName: 'COIGN CONSULTING', bdAgentName: 'Sneha Kulkarni', teamLeaderName: 'Surbhi Vinod Jain', franchiseeName: 'Anita Mandar Kulkarni', financialYear: '2026-2027' },
            { id: 'inv-180040', title: 'EMBASSY TECH HUB - Senior HRBP', amount: 165000, type: 'income', category: 'Recruitment Fee', subCategory: 'Placement Invoice', date: '2025-11-12', companyName: 'EMBASSY TECH HUB', bdAgentName: 'Komal Suresh Bhanushali', teamLeaderName: 'Joyeeta Joydeb Khaskel', franchiseeName: 'Subhash Pande', financialYear: '2025-2026' },
            { id: 'inv-180045', title: 'INFOSYS LIMITED - Technical Lead', amount: 280000, type: 'income', category: 'Recruitment Fee', subCategory: 'Placement Invoice', date: '2025-09-05', companyName: 'INFOSYS LIMITED', bdAgentName: 'Ankur Sharma', teamLeaderName: 'Vedika Girish Tolani', franchiseeName: 'Ankur Sharma', financialYear: '2025-2026' },
            { id: 'inv-180050', title: 'TATA CONSULTANCY SERVICES - Java Architect', amount: 320000, type: 'income', category: 'Recruitment Fee', subCategory: 'Placement Invoice', date: '2026-07-22', companyName: 'TATA CONSULTANCY SERVICES', bdAgentName: 'Rahul Patil', teamLeaderName: 'Joyeeta Joydeb Khaskel', franchiseeName: 'Preshita Rane', financialYear: '2026-2027' },
            { id: 'inv-180055', title: 'WIPRO ENTERPRISES - Data Analyst', amount: 125000, type: 'income', category: 'Recruitment Fee', subCategory: 'Placement Invoice', date: '2026-06-18', companyName: 'WIPRO ENTERPRISES', bdAgentName: 'Sneha Kulkarni', teamLeaderName: 'Surbhi Vinod Jain', franchiseeName: 'Anita Mandar Kulkarni', financialYear: '2026-2027' },
            { id: 'inv-180060', title: 'TECH MAHINDRA - Cloud Solutions Architect', amount: 245000, type: 'income', category: 'Recruitment Fee', subCategory: 'Placement Invoice', date: '2026-09-04', companyName: 'TECH MAHINDRA', bdAgentName: 'Komal Suresh Bhanushali', teamLeaderName: 'Avadai Esakki', franchiseeName: 'Sandeep', financialYear: '2026-2027' }
          ];
          seedItems.forEach(st => {
            st.franchiseeId = matchFranchiseeId(st.franchiseeName, currentFranList);
            st.bdAgentId = matchBdAgentId(st.bdAgentName, bdAgents);
            liveTxs.push(st);
          });
        }

        // Add Recurring Job Portal Employer Package Subscriptions (Income)
        const portalEmployers = [
          { company: 'Wipro Technologies', amount: 83200, tier: 'Enterprise Unlimited' },
          { company: 'TCS QA Hub', amount: 55000, tier: 'Standard Premium' },
          { company: 'Cognizant Pune', amount: 67500, tier: 'Enterprise Unlimited' },
          { company: 'Infosys Central', amount: 45000, tier: 'Basic Recruitment' }
        ];
        for (const yr of [2024, 2025, 2026]) {
          for (let mo = 1; mo <= 12; mo++) {
            if (yr === 2026 && mo > 9) continue;
            const moStr = String(mo).padStart(2, '0');
            const fyStr = mo >= 4 ? `${yr}-${yr+1}` : `${yr-1}-${yr}`;
            portalEmployers.forEach((pe, pIdx) => {
              liveTxs.push({
                id: `portal-sub-${yr}-${moStr}-${pIdx}`,
                title: `Employer Subscription - ${pe.company} (${pe.tier})`,
                companyName: pe.company,
                amount: pe.amount,
                type: 'income',
                category: 'Job portal',
                subCategory: 'Employer Package',
                date: `${yr}-${moStr}-15`,
                paymentMode: 'Net Banking',
                referenceId: `SUB-PORTAL-${yr}${moStr}-${pIdx}`,
                description: `Active employer talent search package for ${pe.company}`,
                bdAgentId: null,
                franchiseeId: null,
                financialYear: fyStr
              });
            });
          }
        }

        const combined = [...liveTxs, ...liveExpenseTxs].map(tx => ({
          ...tx,
          financialYear: normalizeFinancialYear(tx.financialYear, tx.date) || '2025-2026'
        }));
        if (combined.length > 0) {
          setTransactions(combined);
        }
      } catch (liveErr) {
        console.error('Direct HTTPS live API fetch failed:', liveErr);
      }
    }
    return loadedFromBackend;
  };

  const syncWithSaarthi = async () => {
    try {
      const response = await fetchWithApiKey(`${API_BASE_URL}/finance/sync-saarthi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      console.log('[Sync] Raw backend response:', data);
      if (data && data.success) {
        await fetchAllData();
        return { success: true, data: data.data };
      } else {
        // Backend may return 'error' OR 'message' key — check both
        const errDetail = data?.error || data?.message || data?.data?.error ||
          (data?.data?.errors && data.data.errors.length > 0 ? data.data.errors.join(' | ') : null) ||
          `HTTP ${response.status}: Sync returned non-success status`;
        console.warn('[Sync] Sync failed. Backend payload:', data);
        return { success: false, error: errDetail };
      }
    } catch (err) {
      console.error('Error during Saarthi Live Sync:', err);
      return { success: false, error: err.message };
    }
  };

  // Auto-poll state on mount and periodically every 60 seconds
  useEffect(() => {
    fetchAllData();
    const interval = setInterval(() => {
      fetchAllData();
    }, 60000);

    // Keep-alive ping to Render backend every 10 minutes to prevent cold-sleep
    const keepAlive = setInterval(() => {
      fetch(`${API_BASE_URL}/health`).catch(() => {});
    }, 10 * 60 * 1000);

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
