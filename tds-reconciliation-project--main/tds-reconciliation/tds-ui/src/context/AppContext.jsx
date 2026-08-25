import React, { createContext, useContext, useState, useEffect } from 'react';
import { getCleaningQueue } from '../api/tdsApi';

const AppContext = createContext();

export function AppProvider({ children }) {
  // Parse initial route from location hash or pathname
  const getInitialPage = () => {
    const hash = window.location.hash.replace('#', '').split('?')[0];
    if (['dashboard', 'import', 'reconciliation', 'follow-up', 'import-history'].includes(hash)) {
      return hash;
    }
    return 'dashboard';
  };

  const [activePage, setActivePage] = useState(getInitialPage);
  const [fyFilter, setFyFilter] = useState('All Financial Years');
  const [role, setRole] = useState('Accounts Manager');
  const [cleaningQueueCount, setCleaningQueueCount] = useState(11);
  const [followupPreFill, setFollowupPreFill] = useState(null);

  // Sync state with URL hash changes
  useEffect(() => {
    const handleHashChange = () => {
      const hashPart = window.location.hash.replace('#', '');
      const [page, queryString] = hashPart.split('?');
      if (['dashboard', 'import', 'reconciliation', 'follow-up', 'import-history'].includes(page)) {
        setActivePage(page);
      }
      if (queryString) {
        const params = new URLSearchParams(queryString);
        const tan = params.get('tan');
        const company = params.get('company');
        if (tan || company) {
          setFollowupPreFill({ tan: tan || '', company: company || '' });
        }
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange(); // initial check
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Fetch initial cleaning queue count on load
  useEffect(() => {
    const fetchQueueCount = async () => {
      try {
        const res = await getCleaningQueue();
        if (res && res.success && typeof res.count === 'number') {
          setCleaningQueueCount(res.count);
        }
      } catch (err) {
        // keep fallback default
      }
    };
    fetchQueueCount();
  }, []);

  const navigateTo = (page, queryParams = {}) => {
    let hash = `#${page}`;
    const params = new URLSearchParams();
    Object.keys(queryParams).forEach(k => {
      if (queryParams[k]) params.append(k, queryParams[k]);
    });
    const qStr = params.toString();
    if (qStr) hash += `?${qStr}`;
    
    window.location.hash = hash;
    setActivePage(page);
    if (queryParams.tan || queryParams.company) {
      setFollowupPreFill({ tan: queryParams.tan || '', company: queryParams.company || '' });
    }
  };

  return (
    <AppContext.Provider
      value={{
        activePage,
        setActivePage: (page) => navigateTo(page),
        navigateTo,
        fyFilter,
        setFyFilter,
        role,
        setRole,
        cleaningQueueCount,
        setCleaningQueueCount,
        followupPreFill,
        setFollowupPreFill
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
