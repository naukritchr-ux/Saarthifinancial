import React, { useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { FinanceContext } from '../../context/FinanceContext';
import { FilterContext } from '../../context/FilterContext';
import {
  filterLedgerTransactions,
  sortLedgerTransactions,
  computeLedgerSummary,
  buildLedgerFilterOptions,
  getTodayISO
} from './utils/ledgerFilter';
import LedgerFilters from './components/LedgerFilters';
import ActiveFilterChips from './components/ActiveFilterChips';
import LedgerSummary from './components/LedgerSummary';
import LedgerTable from './components/LedgerTable';
import { exportLedgerToCsv } from './utils/ledgerExport';

export default function LedgerTab() {
  const {
    moduleFilteredTransactions: transactions = [],
    deleteTransaction,
    selectedMonth = 'All Months',
    selectedYear = 'All Years',
    bdAgents = [],
    franchisees = []
  } = useContext(FinanceContext);

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


  // BD agent & Franchisee maps for O(1) table lookups
  const bdAgentMap = useMemo(() => {
    const map = new Map();
    if (Array.isArray(bdAgents)) {
      bdAgents.forEach(a => { if (a?.id) map.set(a.id, a); });
    }
    return map;
  }, [bdAgents]);

  const franchiseeMap = useMemo(() => {
    const map = new Map();
    if (Array.isArray(franchisees)) {
      franchisees.forEach(f => { if (f?.id) map.set(f.id, f); });
    }
    return map;
  }, [franchisees]);

  // Export all filtered rows (not just the page)
  const handleExportCsv = () => {
    exportLedgerToCsv({
      transactions: filteredTransactions,
      bdAgents,
      franchisees,
      selectedMonth,
      selectedYear,
      activeFilterCount
    });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="rep-ledger-tab animate-fade-in">
      {/* 1. Filter Toolbar */}
      <LedgerFilters
        filters={filters}
        setFilterKey={setFilterKey}
        toggleArrayItem={toggleArrayItem}
        resetFilters={resetFilters}
        searchInput={searchInput}
        onSearchChange={handleSearchChange}
        filterDropdownOptions={filterDropdownOptions}
        savedViews={savedViews}
        onSaveView={saveCurrentView}
        onApplyView={applySavedView}
        onDeleteView={deleteSavedView}
        onExportCsv={handleExportCsv}
        onPrint={handlePrint}
      />

      {/* 2. Active Filter Chips & Results Count */}
      <ActiveFilterChips
        filters={filters}
        toggleArrayItem={toggleArrayItem}
        setFilterKey={setFilterKey}
        resetFilters={resetFilters}
        totalResults={filteredTransactions.length}
      />

      {/* 3. Summary Cards, Top 5 Breakdown, and Projected Alert */}
      <LedgerSummary
        summary={summary}
        timingFilter={filters.actualProjected || 'all'}
        onSetTiming={timing => setFilterKey('actualProjected', timing)}
      />

      {/* 4. Transaction Ledger Table */}
      <LedgerTable
        transactions={filteredTransactions}
        paginatedTransactions={paginatedTransactions}
        totalItems={filteredTransactions.length}
        currentPage={currentPage}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={setPageSize}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSort={toggleSort}
        onDeleteTransaction={deleteTransaction}
        bdAgentMap={bdAgentMap}
        franchiseeMap={franchiseeMap}
        selectedMonth={selectedMonth}
        onResetFilters={resetFilters}
        todayStr={todayStr}
      />
    </div>
  );
}
