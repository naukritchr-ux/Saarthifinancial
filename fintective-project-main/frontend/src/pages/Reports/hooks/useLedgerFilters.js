import { useState, useEffect, useMemo, useCallback, useRef, useContext } from 'react';
import { FilterContext } from '../../../context/FilterContext';
import {
  filterLedgerTransactions,
  sortLedgerTransactions,
  computeLedgerSummary,
  buildLedgerFilterOptions,
  getTodayISO
} from '../utils/ledgerFilter';

export function useLedgerFilters({
  transactions = [],
  selectedMonth = 'All Months',
  selectedYear = 'All Years',
  bdAgents = [],
  franchisees = [],
  teamLeaders = []
}) {
  const {
    filters,
    setFilters,
    setFilterKey,
    toggleArrayItem,
    resetFilters,
    savedViews,
    saveCurrentView,
    applySavedView,
    deleteSavedView
  } = useContext(FilterContext);

  // Search input state with 250ms debounce
  const [searchInput, setSearchInput] = useState(filters.search || '');
  const debounceTimerRef = useRef(null);

  // Sync internal search input if URL/filter search changes externally (e.g. Apply View or Reset)
  useEffect(() => {
    setSearchInput(filters.search || '');
  }, [filters.search]);

  const handleSearchChange = useCallback((value) => {
    setSearchInput(value);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      setFilterKey('search', value);
    }, 250);
  }, [setFilterKey]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Sorting state (default: date descending)
  const [sortKey, setSortKey] = useState('date');
  const [sortDirection, setSortDirection] = useState('desc');

  const toggleSort = useCallback((key) => {
    if (sortKey === key) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection(key === 'amount' || key === 'date' ? 'desc' : 'asc');
    }
  }, [sortKey]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [
    filters.search,
    filters.types,
    filters.category,
    filters.subCategory,
    filters.paymentMode,
    filters.company,
    filters.bd,
    filters.franchise,
    filters.tl,
    filters.amountMin,
    filters.amountMax,
    filters.dateFrom,
    filters.dateTo,
    filters.actualProjected,
    selectedMonth,
    selectedYear,
    pageSize
  ]);

  // Stable today reference YYYY-MM-DD
  const todayStr = useMemo(() => getTodayISO(), []);

  // 1. Data-driven options built STRICTLY from all transactions (cached, never recomputed on search keystrokes)
  const rawOptions = useMemo(() => {
    return buildLedgerFilterOptions(transactions);
  }, [transactions]);

  // Format options for dropdown components
  const filterDropdownOptions = useMemo(() => {
    const formatEntries = (obj) => {
      return Object.entries(obj)
        .map(([value, count]) => ({ value, label: value, count }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
    };

    return {
      types: formatEntries(rawOptions.types),
      categories: formatEntries(rawOptions.categories),
      subCategories: formatEntries(rawOptions.subCategories),
      paymentModes: formatEntries(rawOptions.paymentModes),
      companies: formatEntries(rawOptions.companies),
      bds: formatEntries(rawOptions.bds),
      franchises: formatEntries(rawOptions.franchises),
      tls: formatEntries(rawOptions.tls)
    };
  }, [rawOptions]);

  // 2. Filter transactions based on all active criteria
  const filteredTransactions = useMemo(() => {
    return filterLedgerTransactions(
      transactions,
      filters,
      selectedMonth,
      selectedYear,
      todayStr
    );
  }, [transactions, filters, selectedMonth, selectedYear, todayStr]);

  // 3. Sort filtered transactions
  const sortedTransactions = useMemo(() => {
    return sortLedgerTransactions(filteredTransactions, sortKey, sortDirection);
  }, [filteredTransactions, sortKey, sortDirection]);

  // 4. Paginated slice
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedTransactions.slice(start, start + pageSize);
  }, [sortedTransactions, currentPage, pageSize]);

  // 5. Dynamic Summary Metrics
  const summary = useMemo(() => {
    return computeLedgerSummary(filteredTransactions, todayStr);
  }, [filteredTransactions, todayStr]);

  // Active filter count for badges
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.types?.length) count += filters.types.length;
    if (filters.category?.length) count += filters.category.length;
    if (filters.subCategory?.length) count += filters.subCategory.length;
    if (filters.paymentMode?.length) count += filters.paymentMode.length;
    if (filters.company?.length) count += filters.company.length;
    if (filters.bd?.length) count += filters.bd.length;
    if (filters.franchise?.length) count += filters.franchise.length;
    if (filters.tl?.length) count += filters.tl.length;
    if (filters.amountMin) count++;
    if (filters.amountMax) count++;
    if (filters.dateFrom) count++;
    if (filters.dateTo) count++;
    if (filters.actualProjected && filters.actualProjected !== 'all') count++;
    if (filters.search) count++;
    return count;
  }, [filters]);

  return {
    filters,
    setFilters,
    setFilterKey,
    toggleArrayItem,
    resetFilters,
    savedViews,
    saveCurrentView,
    applySavedView,
    deleteSavedView,

    searchInput,
    handleSearchChange,

    sortKey,
    sortDirection,
    toggleSort,

    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,

    filterDropdownOptions,
    filteredTransactions,
    sortedTransactions,
    paginatedTransactions,
    summary,
    activeFilterCount,
    todayStr
  };
}
