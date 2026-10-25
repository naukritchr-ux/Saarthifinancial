import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { FinanceContext } from './FinanceContext';
import { classifyEnquiryStatus, classifyPaymentState } from '../utils/statusMapping';
import { getTransactionShares } from '../config/financeConfig';

export const FilterContext = createContext();

const STORAGE_SAVED_VIEWS_KEY = 'fintective_saved_filter_views_v1';

export function FilterProvider({ children }) {
  const { 
    transactions = [], 
    franchisees = [], 
    bdAgents = [], 
    teamLeaders = [],
    selectedYear
  } = useContext(FinanceContext);

  // Parse initial state from URL query parameters or fallback to defaults
  const getInitialStateFromUrl = () => {
    try {
      const params = new URLSearchParams(window.location.search);
      return {
        groupBy: params.get('groupBy') || 'none',
        whoType: params.get('whoType') || 'all',
        whoId: params.get('whoId') || 'all',
        period: params.get('period') || 'FY 2026-27',
        timePerspective: params.get('time') || 'all', // 'past' | 'now' | 'future' | 'all'
        dealStages: params.get('stage') ? params.get('stage').split(',') : [],
        paymentStates: params.get('payment') ? params.get('payment').split(',') : [],
        riskFilters: params.get('risk') ? params.get('risk').split(',') : [],
        tl: params.get('tl') ? params.get('tl').split(',') : [],
        bd: params.get('bd') ? params.get('bd').split(',') : [],
        franchise: params.get('franchise') ? params.get('franchise').split(',') : [],
        industry: params.get('industry') ? params.get('industry').split(',') : [],
        subIndustry: params.get('subIndustry') ? params.get('subIndustry').split(',') : [],
        city: params.get('city') ? params.get('city').split(',') : [],
        company: params.get('company') ? params.get('company').split(',') : [],
        category: params.get('category') ? params.get('category').split(',') : [],
        paymentMode: params.get('mode') ? params.get('mode').split(',') : [],
        search: params.get('q') || '',
        types: params.get('types') ? params.get('types').split(',') : [],
        subCategory: params.get('subCat') ? params.get('subCat').split(',') : [],
        amountMin: params.get('min') || '',
        amountMax: params.get('max') || '',
        dateFrom: params.get('from') || '',
        dateTo: params.get('to') || '',
        actualProjected: params.get('timing') || 'all',
        status: params.get('status') ? params.get('status').split(',') : []
      };
    } catch (e) {
      return {
        groupBy: 'none',
        whoType: 'all',
        whoId: 'all',
        period: 'FY 2026-27',
        timePerspective: 'all',
        dealStages: [],
        paymentStates: [],
        riskFilters: [],
        tl: [],
        bd: [],
        franchise: [],
        industry: [],
        subIndustry: [],
        city: [],
        company: [],
        category: [],
        paymentMode: [],
        search: '',
        types: [],
        subCategory: [],
        amountMin: '',
        amountMax: '',
        dateFrom: '',
        dateTo: '',
        actualProjected: 'all',
        status: []
      };
    }
  };

  const [filters, setFilters] = useState(getInitialStateFromUrl);
  const [savedViews, setSavedViews] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_SAVED_VIEWS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Sync state to URL query parameters
  useEffect(() => {
    try {
      const params = new URLSearchParams();
      if (filters.groupBy && filters.groupBy !== 'none') params.set('groupBy', filters.groupBy);
      if (filters.whoType && filters.whoType !== 'all') params.set('whoType', filters.whoType);
      if (filters.whoId && filters.whoId !== 'all') params.set('whoId', filters.whoId);
      if (filters.period && filters.period !== 'FY 2026-27') params.set('period', filters.period);
      if (filters.timePerspective && filters.timePerspective !== 'all') params.set('time', filters.timePerspective);
      if (filters.dealStages?.length) params.set('stage', filters.dealStages.join(','));
      if (filters.paymentStates?.length) params.set('payment', filters.paymentStates.join(','));
      if (filters.riskFilters?.length) params.set('risk', filters.riskFilters.join(','));
      if (filters.tl?.length) params.set('tl', filters.tl.join(','));
      if (filters.bd?.length) params.set('bd', filters.bd.join(','));
      if (filters.franchise?.length) params.set('franchise', filters.franchise.join(','));
      if (filters.industry?.length) params.set('industry', filters.industry.join(','));
      if (filters.subIndustry?.length) params.set('subIndustry', filters.subIndustry.join(','));
      if (filters.city?.length) params.set('city', filters.city.join(','));
      if (filters.company?.length) params.set('company', filters.company.join(','));
      if (filters.category?.length) params.set('category', filters.category.join(','));
      if (filters.paymentMode?.length) params.set('mode', filters.paymentMode.join(','));
      if (filters.search) params.set('q', filters.search);
      if (filters.types?.length) params.set('types', filters.types.join(','));
      if (filters.subCategory?.length) params.set('subCat', filters.subCategory.join(','));
      if (filters.amountMin) params.set('min', filters.amountMin);
      if (filters.amountMax) params.set('max', filters.amountMax);
      if (filters.dateFrom) params.set('from', filters.dateFrom);
      if (filters.dateTo) params.set('to', filters.dateTo);
      if (filters.actualProjected && filters.actualProjected !== 'all') params.set('timing', filters.actualProjected);
      if (filters.status?.length) params.set('status', filters.status.join(','));

      const queryString = params.toString();
      const newUrl = `${window.location.pathname}${queryString ? '?' + queryString : ''}`;
      window.history.replaceState({}, '', newUrl);
    } catch (e) {
      console.warn('Could not update URL query params:', e);
    }
  }, [filters]);

  // Setters for individual filter keys
  const setFilterKey = useCallback((key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  // Toggle multi-select array chip
  const toggleArrayItem = useCallback((key, item) => {
    setFilters(prev => {
      const current = prev[key] || [];
      const exists = current.includes(item);
      const updated = exists ? current.filter(x => x !== item) : [...current, item];
      return { ...prev, [key]: updated };
    });
  }, []);

  // Reset all filters to defaults
  const resetFilters = useCallback(() => {
    setFilters({
      groupBy: 'none',
      whoType: 'all',
      whoId: 'all',
      period: 'FY 2026-27',
      timePerspective: 'all',
      dealStages: [],
      paymentStates: [],
      riskFilters: [],
      tl: [],
      bd: [],
      franchise: [],
      industry: [],
      subIndustry: [],
      city: [],
      company: [],
      category: [],
      paymentMode: [],
      search: '',
      types: [],
      subCategory: [],
      amountMin: '',
      amountMax: '',
      dateFrom: '',
      dateTo: '',
      actualProjected: 'all',
      status: []
    });
  }, []);

  // Save current view
  const saveCurrentView = useCallback((name) => {
    if (!name || !name.trim()) return;
    const newView = {
      id: `view-${Date.now()}`,
      name: name.trim(),
      createdAt: new Date().toISOString(),
      filters: { ...filters }
    };
    setSavedViews(prev => {
      const updated = [newView, ...prev.filter(v => v.name !== name.trim())];
      try {
        localStorage.setItem(STORAGE_SAVED_VIEWS_KEY, JSON.stringify(updated));
      } catch (err) {
        console.error('Failed to save view to localStorage:', err);
      }
      return updated;
    });
  }, [filters]);

  // Apply saved view
  const applySavedView = useCallback((view) => {
    if (view && view.filters) {
      setFilters({ ...view.filters });
    }
  }, []);

  // Delete saved view
  const deleteSavedView = useCallback((id) => {
    setSavedViews(prev => {
      const updated = prev.filter(v => v.id !== id);
      try {
        localStorage.setItem(STORAGE_SAVED_VIEWS_KEY, JSON.stringify(updated));
      } catch (err) {
        console.error('Failed to update saved views in localStorage:', err);
      }
      return updated;
    });
  }, []);

  // Dependent Filtering Options:
  // 1. TL narrows BD
  const availableBds = useMemo(() => {
    if (!filters.tl || filters.tl.length === 0) {
      return bdAgents;
    }
    // Filter BDs belonging to selected TLs
    return bdAgents.filter(bd => {
      const bdName = (bd.name || '').toLowerCase();
      // Match from transactions or teamLeader mappings
      const hasMatch = transactions.some(t => {
        const matchesTl = filters.tl.some(selTl => (t.teamLeaderName || '').toLowerCase() === selTl.toLowerCase());
        const matchesBd = (t.bdAgentName || t.bdMemberName || '').toLowerCase() === bdName;
        return matchesTl && matchesBd;
      });
      return hasMatch;
    });
  }, [bdAgents, filters.tl, transactions]);

  // 2. City narrows Franchise
  const availableFranchisees = useMemo(() => {
    if (!filters.city || filters.city.length === 0) {
      return franchisees;
    }
    return franchisees.filter(f => filters.city.some(c => (f.city || '').toLowerCase() === c.toLowerCase()));
  }, [franchisees, filters.city]);

  // 3. Compute distinct options and counts across transactions
  const filterOptions = useMemo(() => {
    const counts = {
      industries: {},
      cities: {},
      companies: {},
      categories: {},
      paymentModes: {},
      tls: {},
      bds: {},
      franchises: {},
      dealStages: { Progressed: 0, Closed: 0, Cancelled: 0 },
      paymentStates: { Received: 0, Outstanding: 0, 'Credit note': 0 },
      risk: { highRisk: 0, stale: 0 }
    };

    transactions.forEach(t => {
      const ind = t.industry || 'Other Services';
      counts.industries[ind] = (counts.industries[ind] || 0) + 1;

      const city = t.city || 'Unassigned';
      counts.cities[city] = (counts.cities[city] || 0) + 1;

      const comp = t.companyName || 'Standard Client';
      counts.companies[comp] = (counts.companies[comp] || 0) + 1;

      const cat = t.category || 'General';
      counts.categories[cat] = (counts.categories[cat] || 0) + 1;

      const mode = t.paymentMethod || t.paymentMode || 'Bank Transfer';
      counts.paymentModes[mode] = (counts.paymentModes[mode] || 0) + 1;

      if (t.teamLeaderName) {
        counts.tls[t.teamLeaderName] = (counts.tls[t.teamLeaderName] || 0) + 1;
      }
      const bd = t.bdAgentName || t.bdMemberName;
      if (bd && !bd.toLowerCase().includes('head - office')) {
        counts.bds[bd] = (counts.bds[bd] || 0) + 1;
      }
      if (t.franchiseeName) {
        counts.franchises[t.franchiseeName] = (counts.franchises[t.franchiseeName] || 0) + 1;
      }

      // Deal stages
      const stage = classifyEnquiryStatus(t.status || t.info);
      if (stage === 'INVOICED') counts.dealStages.Closed += 1;
      else if (stage === 'PROGRESSED') counts.dealStages.Progressed += 1;
      else if (stage === 'CANCELLED') counts.dealStages.Cancelled += 1;

      // Payment states
      const pay = classifyPaymentState(t);
      if (pay === 'RECEIVED') counts.paymentStates.Received += 1;
      else if (pay === 'OUTSTANDING') counts.paymentStates.Outstanding += 1;
      else if (pay === 'CREDIT_NOTE') counts.paymentStates['Credit note'] += 1;

      // Risk
      if (t.isRisk || t.risk_score > 70) counts.risk.highRisk += 1;
      if (t.days_outstanding > 365 || t.age_days > 365) counts.risk.stale += 1;
    });

    return counts;
  }, [transactions]);

  // Master Transaction Filter Function:
  // Takes any transaction array and applies all active filters
  const applyAllFilters = useCallback((rawTxs = transactions) => {
    if (!Array.isArray(rawTxs)) return [];

    return rawTxs.filter(t => {
      // 1. Search Query
      if (filters.search) {
        const q = filters.search.toLowerCase().trim();
        const matchesSearch = 
          (t.title && t.title.toLowerCase().includes(q)) ||
          (t.companyName && t.companyName.toLowerCase().includes(q)) ||
          (t.candidateName && t.candidateName.toLowerCase().includes(q)) ||
          (t.referenceId && String(t.referenceId).toLowerCase().includes(q)) ||
          (t.bdAgentName && t.bdAgentName.toLowerCase().includes(q)) ||
          (t.franchiseeName && t.franchiseeName.toLowerCase().includes(q));
        if (!matchesSearch) return false;
      }

      // 2. Who Filter
      if (filters.whoType === 'bd' && filters.whoId !== 'all') {
        const bdMatch = (t.bdAgentName || t.bdMemberName || '').toLowerCase() === filters.whoId.toLowerCase();
        if (!bdMatch) return false;
      } else if (filters.whoType === 'tl' && filters.whoId !== 'all') {
        const tlMatch = (t.teamLeaderName || '').toLowerCase() === filters.whoId.toLowerCase();
        if (!tlMatch) return false;
      } else if (filters.whoType === 'franchise' && filters.whoId !== 'all') {
        const franMatch = (t.franchiseeName || '').toLowerCase() === filters.whoId.toLowerCase();
        if (!franMatch) return false;
      }

      // 3. Period Filter
      if (filters.period && filters.period !== 'all') {
        const txDate = t.date ? new Date(t.date) : null;
        if (filters.period.startsWith('FY')) {
          // Standard FY check (April 1 to March 31)
          if (txDate && !isNaN(txDate.getTime())) {
            const year = txDate.getFullYear();
            const month = txDate.getMonth() + 1; // 1-12
            const txFyStart = month >= 4 ? year : year - 1;
            const targetFyStart = parseInt(filters.period.split(' ')[1]?.substring(0, 4) || '2026', 10);
            if (txFyStart !== targetFyStart) return false;
          }
        } else if (filters.period === 'last-6m') {
          const sixMonthsAgo = new Date();
          sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
          if (txDate && txDate < sixMonthsAgo) return false;
        } else if (filters.period === 'last-12m') {
          const twelveMonthsAgo = new Date();
          twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
          if (txDate && txDate < twelveMonthsAgo) return false;
        } else if (filters.period === 'last-24m') {
          const twentyFourMonthsAgo = new Date();
          twentyFourMonthsAgo.setMonth(twentyFourMonthsAgo.getMonth() - 24);
          if (txDate && txDate < twentyFourMonthsAgo) return false;
        }
      }

      // 4. Time Perspective [Past | Now | Future | All]
      if (filters.timePerspective && filters.timePerspective !== 'all') {
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const txMonth = (t.date || '').substring(0, 7);

        if (filters.timePerspective === 'past' && txMonth >= currentMonth) return false;
        if (filters.timePerspective === 'now' && txMonth !== currentMonth) return false;
        if (filters.timePerspective === 'future' && txMonth <= currentMonth) return false;
      }

      // 5. Deal Stages (Progressed, Closed, Cancelled)
      if (filters.dealStages?.length > 0) {
        const stage = classifyEnquiryStatus(t.status || t.info);
        const matchesStage = filters.dealStages.some(s => {
          if (s === 'Closed' && stage === 'INVOICED') return true;
          if (s === 'Progressed' && stage === 'PROGRESSED') return true;
          if (s === 'Cancelled' && stage === 'CANCELLED') return true;
          return false;
        });
        if (!matchesStage) return false;
      }

      // 6. Payment States (Received, Outstanding, Credit note)
      if (filters.paymentStates?.length > 0) {
        const pay = classifyPaymentState(t);
        const matchesPay = filters.paymentStates.some(p => {
          if (p === 'Received' && pay === 'RECEIVED') return true;
          if (p === 'Outstanding' && pay === 'OUTSTANDING') return true;
          if (p === 'Credit note' && pay === 'CREDIT_NOTE') return true;
          return false;
        });
        if (!matchesPay) return false;
      }

      // 7. Risk Filters
      if (filters.riskFilters?.length > 0) {
        const matchesRisk = filters.riskFilters.every(r => {
          if (r === 'highRisk') return t.isRisk || t.risk_score > 70;
          if (r === 'stale') return t.days_outstanding > 365 || t.age_days > 365;
          return true;
        });
        if (!matchesRisk) return false;
      }

      // 8. Multi-select Specific Filters
      if (filters.tl?.length && !filters.tl.includes(t.teamLeaderName)) return false;
      if (filters.bd?.length && !filters.bd.includes(t.bdAgentName || t.bdMemberName)) return false;
      if (filters.franchise?.length && !filters.franchise.includes(t.franchiseeName)) return false;
      if (filters.industry?.length && !filters.industry.includes(t.industry)) return false;
      if (filters.city?.length && !filters.city.includes(t.city)) return false;
      if (filters.company?.length && !filters.company.includes(t.companyName)) return false;
      if (filters.category?.length && !filters.category.includes(t.category)) return false;
      if (filters.paymentMode?.length && !filters.paymentMode.includes(t.paymentMethod || t.paymentMode)) return false;

      return true;
    });
  }, [filters, transactions]);

  // Filtered transactions memoized
  const filteredTransactions = useMemo(() => {
    return applyAllFilters(transactions);
  }, [applyAllFilters, transactions]);

  // Active filter count and tag list for easy chips and ✕ dismissal
  const activeFilterTags = useMemo(() => {
    const tags = [];
    if (filters.whoType !== 'all') tags.push({ key: 'whoType', label: `Type: ${filters.whoType.toUpperCase()}` });
    if (filters.whoId !== 'all') tags.push({ key: 'whoId', label: `Who: ${filters.whoId}` });
    if (filters.period !== 'FY 2026-27' && filters.period !== 'all') tags.push({ key: 'period', label: `Period: ${filters.period}` });
    if (filters.timePerspective !== 'all') tags.push({ key: 'timePerspective', label: `Time: ${filters.timePerspective}` });
    
    filters.dealStages.forEach(s => tags.push({ key: 'dealStages', item: s, label: `Stage: ${s}` }));
    filters.paymentStates.forEach(p => tags.push({ key: 'paymentStates', item: p, label: `Payment: ${p}` }));
    filters.riskFilters.forEach(r => tags.push({ key: 'riskFilters', item: r, label: `Risk: ${r === 'highRisk' ? 'High Risk' : 'Stale >365d'}` }));
    filters.tl.forEach(v => tags.push({ key: 'tl', item: v, label: `TL: ${v}` }));
    filters.bd.forEach(v => tags.push({ key: 'bd', item: v, label: `BD: ${v}` }));
    filters.franchise.forEach(v => tags.push({ key: 'franchise', item: v, label: `Franchise: ${v}` }));
    filters.industry.forEach(v => tags.push({ key: 'industry', item: v, label: `Industry: ${v}` }));
    filters.city.forEach(v => tags.push({ key: 'city', item: v, label: `City: ${v}` }));
    filters.company.forEach(v => tags.push({ key: 'company', item: v, label: `Client: ${v}` }));
    filters.category.forEach(v => tags.push({ key: 'category', item: v, label: `Category: ${v}` }));
    filters.paymentMode.forEach(v => tags.push({ key: 'paymentMode', item: v, label: `Mode: ${v}` }));
    if (filters.types?.length) filters.types.forEach(v => tags.push({ key: 'types', item: v, label: `Type: ${v}` }));
    if (filters.subCategory?.length) filters.subCategory.forEach(v => tags.push({ key: 'subCategory', item: v, label: `Sub-cat: ${v}` }));
    if (filters.amountMin) tags.push({ key: 'amountMin', label: `Min ₹${Number(filters.amountMin).toLocaleString()}` });
    if (filters.amountMax) tags.push({ key: 'amountMax', label: `Max ₹${Number(filters.amountMax).toLocaleString()}` });
    if (filters.dateFrom) tags.push({ key: 'dateFrom', label: `From: ${filters.dateFrom}` });
    if (filters.dateTo) tags.push({ key: 'dateTo', label: `To: ${filters.dateTo}` });
    if (filters.actualProjected && filters.actualProjected !== 'all') tags.push({ key: 'actualProjected', label: `Timing: ${filters.actualProjected === 'actual' ? 'Actual' : 'Projected'}` });
    if (filters.status?.length) filters.status.forEach(v => tags.push({ key: 'status', item: v, label: `Status: ${v}` }));
    if (filters.search) tags.push({ key: 'search', label: `Search: "${filters.search}"` });

    return tags;
  }, [filters]);

  const removeFilterTag = useCallback((tag) => {
    if (tag.item) {
      toggleArrayItem(tag.key, tag.item);
    } else if (tag.key === 'whoType' || tag.key === 'whoId') {
      setFilters(prev => ({ ...prev, [tag.key]: 'all' }));
    } else if (tag.key === 'period') {
      setFilters(prev => ({ ...prev, period: 'FY 2026-27' }));
    } else if (tag.key === 'timePerspective') {
      setFilters(prev => ({ ...prev, timePerspective: 'all' }));
    } else if (tag.key === 'search') {
      setFilters(prev => ({ ...prev, search: '' }));
    } else if (tag.key === 'amountMin' || tag.key === 'amountMax' || tag.key === 'dateFrom' || tag.key === 'dateTo') {
      setFilters(prev => ({ ...prev, [tag.key]: '' }));
    } else if (tag.key === 'actualProjected') {
      setFilters(prev => ({ ...prev, actualProjected: 'all' }));
    }
  }, [toggleArrayItem]);

  // Generate metadata header string for report exports
  const getFilterReportHeader = useCallback(() => {
    const parts = [];
    if (filters.whoId !== 'all') parts.push(`Who: ${filters.whoId}`);
    if (filters.period) parts.push(`Period: ${filters.period}`);
    if (filters.industry?.length) parts.push(`Industry: ${filters.industry.join(', ')}`);
    if (filters.city?.length) parts.push(`City: ${filters.city.join(', ')}`);
    if (filters.dealStages?.length) parts.push(`Stage: ${filters.dealStages.join(', ')}`);
    if (filters.paymentStates?.length) parts.push(`Payment: ${filters.paymentStates.join(', ')}`);
    const dateStr = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${parts.join(' · ')} · Generated on ${dateStr}`;
  }, [filters]);

  return (
    <FilterContext.Provider value={{
      filters,
      setFilters,
      setFilterKey,
      toggleArrayItem,
      resetFilters,
      savedViews,
      saveCurrentView,
      applySavedView,
      deleteSavedView,
      availableBds,
      availableFranchisees,
      filterOptions,
      filteredTransactions,
      applyAllFilters,
      activeFilterTags,
      removeFilterTag,
      getFilterReportHeader
    }}>
      {children}
    </FilterContext.Provider>
  );
}

export function useFilters() {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error('useFilters must be used within a FilterProvider');
  }
  return context;
}
