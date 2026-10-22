import React, { useContext, useMemo } from 'react';
import { FinanceContext } from '../../context/FinanceContext';
import { useLedgerFilters } from './hooks/useLedgerFilters';
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
    franchisees = [],
    teamLeaders = []
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
  } = useLedgerFilters({
    transactions,
    selectedMonth,
    selectedYear,
    bdAgents,
    franchisees,
    teamLeaders
  });

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
