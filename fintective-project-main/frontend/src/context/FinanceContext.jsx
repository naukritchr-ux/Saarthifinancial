import React, { createContext, useState, useEffect } from 'react';

export const FinanceContext = createContext();

export const FinanceProvider = ({ children }) => {
  // Change this URL to your main site's API endpoint when deploying or fetching directly!
  const API_BASE_URL = 'http://localhost:5000/api';

  const [transactions, setTransactions] = useState([]);
  const [franchisees, setFranchisees] = useState([]);
  const [bdAgents, setBdAgents] = useState([]);
  const [teamLeaders, setTeamLeaders] = useState([]);
  const [budgets, setBudgets] = useState({
    'Salaries': 0,
    'BD commissions': 0,
    'Marketing': 0,
    'Office & infra': 0,
    'Portal subscriptions': 0,
    'Other': 0
  });

  const [selectedMonth, setSelectedMonth] = useState(() => {
    return localStorage.getItem('saarthi_selected_month') || 'All Months';
  });

  const [selectedYear, setSelectedYear] = useState(() => {
    return localStorage.getItem('saarthi_selected_year') || 'All Years';
  });

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

  // Sync state with backend server on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const txRes = await fetch(`${API_BASE_URL}/transactions`);
        if (txRes.ok) {
          const txData = await txRes.json();
          if (txData.length > 0) setTransactions(txData);
        }
        
        const franRes = await fetch(`${API_BASE_URL}/franchisees`);
        if (franRes.ok) {
          const franData = await franRes.json();
          if (franData.length > 0) setFranchisees(franData);
        }
        
        const bdRes = await fetch(`${API_BASE_URL}/bd-agents`);
        if (bdRes.ok) {
          const bdData = await bdRes.json();
          if (bdData.length > 0) setBdAgents(bdData);
        }

        const tlRes = await fetch(`${API_BASE_URL}/team-leaders`);
        if (tlRes.ok) {
          const tlData = await tlRes.json();
          if (tlData.length > 0) setTeamLeaders(tlData);
        }

        const budgetRes = await fetch(`${API_BASE_URL}/budgets`);
        if (budgetRes.ok) {
          const budgetData = await budgetRes.json();
          if (Object.keys(budgetData).length > 0) setBudgets(budgetData);
        }
      } catch (err) {
        console.warn('Backend server offline.', err.message);
      }
    };
    fetchData();
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
    fetch(`${API_BASE_URL}/finance/cash-balance?as_of=${asOf}`)
      .then(res => { if (res.ok) return res.json(); })
      .then(data => {
        if (data) {
          setCurrentCashBalance(data.cash_balance);
        }
      })
      .catch(err => console.error("Failed to load cash balance:", err));
  }, [selectedMonth, selectedYear, transactions]);

  useEffect(() => {
    fetch(`${API_BASE_URL}/finance/moving-avg-burn`)
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
    if (activeModule === 'franchise_bd_revenue') {
      return tx.category !== 'Job portal' && tx.category !== 'Portal subscriptions';
    } else {
      return tx.category === 'Job portal' || tx.category === 'Portal subscriptions';
    }
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
      await fetch(`${API_BASE_URL}/transactions`, {
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
      await fetch(`${API_BASE_URL}/transactions/${id}`, {
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
      await fetch(`${API_BASE_URL}/budgets`, {
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
      await fetch(`${API_BASE_URL}/franchisees`, {
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
      await fetch(`${API_BASE_URL}/bd-agents`, {
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
      await fetch(`${API_BASE_URL}/bd-agents/${id}`, {
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
        addTransaction,
        deleteTransaction,
        updateBudget,
        addFranchisee,
        addBdAgent,
        updateBdAgent,
        currentCashBalance,
        movingAvgBurn
      }}
    >
      {children}
    </FinanceContext.Provider>
  );
};
