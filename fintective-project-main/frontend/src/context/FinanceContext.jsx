import React, { createContext, useState, useEffect } from 'react';
import { fetchWithApiKey } from '../utils/apiClient';

export const FinanceContext = createContext();

export const API_BASE_URL = import.meta.env.VITE_API_URL || 
  (typeof window !== 'undefined' && window.location.hostname === 'localhost' ? 'http://localhost:5000/api' : 'https://saarthifinancial-1.onrender.com/api');

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

export const FinanceProvider = ({ children }) => {
  const [transactions, setTransactions] = useState([]);
  const [franchisees, setFranchisees] = useState(DEFAULT_FRANCHISEES);
  const [bdAgents, setBdAgents] = useState(DEFAULT_BD_AGENTS);
  const [teamLeaders, setTeamLeaders] = useState(DEFAULT_TEAM_LEADERS);
  const [budgets, setBudgets] = useState({
    'Salaries': 800000,
    'BD commissions': 120000,
    'Marketing': 50000,
    'Office & infra': 55000,
    'Portal subscriptions': 85000,
    'Other': 50000
  });

  const [selectedMonth, setSelectedMonth] = useState('All Months');
  const [selectedYear, setSelectedYear] = useState('All Years');
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
    if (!Array.isArray(transactions)) return ['All Years'];
    const years = new Set();
    transactions.forEach(tx => {
      if (tx && tx.financialYear && tx.financialYear !== 'N/A') {
        years.add(tx.financialYear);
      } else if (tx && tx.date) {
        const d = new Date(tx.date);
        if (!isNaN(d.getTime())) {
          const y = d.getFullYear();
          const m = d.getMonth();
          if (m >= 3) {
            years.add(`${y}-${y+1}`);
          } else {
            years.add(`${y-1}-${y}`);
          }
        }
      }
    });
    const sortedYears = Array.from(years).sort((a, b) => b.localeCompare(a));
    return ['All Years', ...sortedYears];
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

  // Re-usable loader to fetch all data from backend (with live API fallback)
  const fetchAllData = async () => {
    let loadedFromBackend = false;
    try {
      const txRes = await fetchWithApiKey(`${API_BASE_URL}/transactions`);
      if (txRes.ok) {
        const txData = await txRes.json();
        if (Array.isArray(txData) && txData.length > 0) {
          setTransactions(txData);
          loadedFromBackend = true;
          setDataSource('backend');
        }
      }
      
      const franRes = await fetchWithApiKey(`${API_BASE_URL}/franchisees`);
      if (franRes.ok) {
        const franData = await franRes.json();
        if (Array.isArray(franData) && franData.length > 0) setFranchisees(franData);
      }
      
      const bdRes = await fetchWithApiKey(`${API_BASE_URL}/bd-agents`);
      if (bdRes.ok) {
        const bdData = await bdRes.json();
        if (Array.isArray(bdData) && bdData.length > 0) setBdAgents(bdData);
      }

      const tlRes = await fetchWithApiKey(`${API_BASE_URL}/team-leaders`);
      if (tlRes.ok) {
        const tlData = await tlRes.json();
        if (Array.isArray(tlData) && tlData.length > 0) setTeamLeaders(tlData);
      }

      const budgetRes = await fetchWithApiKey(`${API_BASE_URL}/budgets`);
      if (budgetRes.ok) {
        const budgetData = await budgetRes.json();
        if (Object.keys(budgetData).length > 0) setBudgets(budgetData);
      }
    } catch (err) {
      console.warn('Backend server connection issue, attempting direct live API fetch fallback...', err.message);
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
              if (yr === 2026 && mo > 8) continue;
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
            { id: 'inv-180055', title: 'WIPRO ENTERPRISES - Data Analyst', amount: 125000, type: 'income', category: 'Recruitment Fee', subCategory: 'Placement Invoice', date: '2026-06-18', companyName: 'WIPRO ENTERPRISES', bdAgentName: 'Sneha Kulkarni', teamLeaderName: 'Surbhi Vinod Jain', franchiseeName: 'Anita Mandar Kulkarni', financialYear: '2026-2027' }
          ];
          seedItems.forEach(st => {
            st.franchiseeId = matchFranchiseeId(st.franchiseeName, currentFranList);
            st.bdAgentId = matchBdAgentId(st.bdAgentName, bdAgents);
            liveTxs.push(st);
          });
        }

        const combined = [...liveTxs, ...liveExpenseTxs];
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
      if (data && data.success) {
        await fetchAllData();
        return { success: true, data: data.data };
      } else {
        return { success: false, error: data?.error || 'Sync returned non-success status' };
      }
    } catch (err) {
      console.error('Error during Saarthi Live Sync:', err);
      return { success: false, error: err.message };
    }
  };

  // Auto-pool state on mount and periodically every 60 seconds (no manual button click needed)
  useEffect(() => {
    fetchAllData();
    const interval = setInterval(() => {
      fetchAllData();
    }, 60000);
    return () => clearInterval(interval);
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
        if (data) {
          setCurrentCashBalance(data.cash_balance);
        }
      })
      .catch(err => console.error("Failed to load cash balance:", err));
  }, [selectedMonth, selectedYear, transactions]);

  useEffect(() => {
    fetchWithApiKey(`${API_BASE_URL}/finance/moving-avg-burn`)
      .then(res => { if (res.ok) return res.json(); })
      .then(data => {
        if (data) {
          setMovingAvgBurn(data.burn);
        }
      })
      .catch(err => console.error("Failed to load moving average burn:", err));
  }, [transactions]);



  // Derived filtered transactions based on active module
  const moduleFilteredTransactions = Array.isArray(transactions) ? transactions.filter(tx => {
    if (!tx) return false;
    if (activeModule === 'job_portal') {
      return tx.category === 'Job portal' || tx.category === 'Portal subscriptions';
    }
    return tx.category !== 'Job portal' && tx.category !== 'Portal subscriptions';
  }) : [];

  // Actions
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
      await fetchWithApiKey(`${API_BASE_URL}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTx)
      });
    } catch (err) {
      console.error('Failed to sync transaction with server:', err.message);
    }
  };

  const deleteTransaction = async (id) => {
    setTransactions((prev) => prev.filter((tx) => tx.id !== id));
    try {
      await fetchWithApiKey(`${API_BASE_URL}/transactions/${id}`, {
        method: 'DELETE'
      });
    } catch (err) {
      console.error('Failed to delete transaction from server:', err.message);
    }
  };

  const updateBudget = async (category, value) => {
    const updatedVal = parseFloat(value) || 0;
    setBudgets((prev) => ({
      ...prev,
      [category]: updatedVal
    }));
    try {
      await fetchWithApiKey(`${API_BASE_URL}/budgets`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [category]: updatedVal })
      });
    } catch (err) {
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
      await fetchWithApiKey(`${API_BASE_URL}/franchisees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newFran)
      });
    } catch (err) {
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
      await fetchWithApiKey(`${API_BASE_URL}/bd-agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBd)
      });
    } catch (err) {
      console.error('Failed to save BD agent to server:', err.message);
    }
  };

  const updateBdAgent = async (id, updatedFields) => {
    setBdAgents((prev) =>
      prev.map((agent) => (agent.id === id ? { ...agent, ...updatedFields } : agent))
    );
    try {
      await fetchWithApiKey(`${API_BASE_URL}/bd-agents/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedFields)
      });
    } catch (err) {
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

  return (
    <FinanceContext.Provider
      value={{
        transactions,
        moduleFilteredTransactions,
        franchisees,
        bdAgents,
        teamLeaders,
        budgets,
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
        toggleSidebar
      }}
    >
      {children}
    </FinanceContext.Provider>
  );
};
