import React, { useContext, useState, useMemo, useEffect } from 'react';
import { FinanceContext } from '../context/FinanceContext';
import { formatCurrency, formatLakhs } from '../utils/formatters';
import { Search } from 'lucide-react';
import Pagination from '../components/Pagination';
import './CashOutflow.css';

const CATEGORY_COLORS = {
  'Salaries': '#6366f1',
  'BD commissions': '#3b82f6',
  'Marketing': '#f59e0b',
  'Office & infra': '#ef4444',
  'Portal subscriptions': '#10b981',
  'Legal & professional': '#8b5cf6',
  'Travel & conveyance': '#ec4899',
  'Other': '#94a3b8'
};

const formatShortDate = (dateStr) => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr).slice(0, 10);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  } catch {
    return String(dateStr).slice(0, 10);
  }
};

const CashOutflow = () => {
  const { transactions, selectedMonth } = useContext(FinanceContext);

  // Pagination state
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  const [vendorFilter, setVendorFilter] = useState('all');
  const [groupAccruals, setGroupAccruals] = useState(false);

  // Filter current expenses for the selected month
  const currentExpenses = useMemo(() => {
    if (!Array.isArray(transactions)) return [];
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    return transactions.filter(tx => {
      if (!tx || tx.type !== 'expense') return false;
      if (selectedMonth === 'All Months') return true;

      const date = new Date(tx.date);
      const txMonthYear = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
      return txMonthYear === selectedMonth;
    });
  }, [transactions, selectedMonth]);

  // Totals & Allocation calculations
  const { totalExpense, directCost, overheadCost, directPct, overheadPct, topCategories, allCategoryNames } = useMemo(() => {
    const tot = currentExpenses.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
    const dir = currentExpenses.filter(tx => tx.franchiseeId || tx.bdAgentId).reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
    const ovh = currentExpenses.filter(tx => !tx.franchiseeId && !tx.bdAgentId).reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

    const dPct = tot > 0 ? (dir / tot) * 100 : 0;
    const oPct = tot > 0 ? (ovh / tot) * 100 : 0;

    // Group by category
    const catTotals = {};
    currentExpenses.forEach(tx => {
      const cat = tx.category || 'Other';
      catTotals[cat] = (catTotals[cat] || 0) + (Number(tx.amount) || 0);
    });

    const sortedCats = Object.keys(catTotals)
      .map(cat => ({
        label: cat,
        value: catTotals[cat],
        color: CATEGORY_COLORS[cat] || '#8b5cf6'
      }))
      .sort((a, b) => b.value - a.value);

    // Top 5 categories + aggregate rest into "Other"
    let displayList = [];
    if (sortedCats.length <= 5) {
      displayList = sortedCats;
    } else {
      const top5 = sortedCats.slice(0, 5);
      const remaining = sortedCats.slice(5);
      const otherVal = remaining.reduce((sum, c) => sum + c.value, 0);

      // Check if "Other" is already in top 5
      const existingOtherIdx = top5.findIndex(c => c.label.toLowerCase() === 'other');
      if (existingOtherIdx !== -1) {
        top5[existingOtherIdx].value += otherVal;
        displayList = top5;
      } else {
        displayList = [
          ...top5,
          {
            label: 'Other',
            value: otherVal,
            color: CATEGORY_COLORS['Other']
          }
        ];
      }
    }

    return {
      totalExpense: tot,
      directCost: dir,
      overheadCost: ovh,
      directPct: dPct,
      overheadPct: oPct,
      topCategories: displayList,
      allCategoryNames: Object.keys(catTotals).sort()
    };
  }, [currentExpenses]);

  // Unique companies / vendors for filter dropdown
  const companyList = useMemo(() => {
    const companies = new Set();
    currentExpenses.forEach(tx => {
      if (tx.companyName && tx.companyName !== 'N/A' && tx.companyName.trim() !== '') {
        companies.add(tx.companyName.trim());
      }
    });
    return Array.from(companies).sort();
  }, [currentExpenses]);

  // Process and filter expenses for the log
  const filteredExpenses = useMemo(() => {
    let list = [...currentExpenses];

    // Optional Accruals Grouping: Collapse "Accrued BD/TL Commission" entries into one summary row
    if (groupAccruals) {
      const accruedList = [];
      const nonAccrued = [];

      list.forEach(tx => {
        const title = (tx.title || '').toLowerCase();
        const refId = (tx.referenceId || '').toLowerCase();
        const isAccrued = title.includes('accrued') || refId.startsWith('comm-tl-') || refId.startsWith('comm-bd-');

        if (isAccrued) {
          accruedList.push(tx);
        } else {
          nonAccrued.push(tx);
        }
      });

      if (accruedList.length > 0) {
        const sumAccrued = accruedList.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
        // Find latest date among accruals
        const latestDate = accruedList.reduce((latest, tx) => {
          if (!latest) return tx.date;
          return tx.date > latest ? tx.date : latest;
        }, null);

        const summaryRow = {
          id: 'accrued-summary-row',
          title: `Accrued BD/TL Commissions (${accruedList.length} deals)`,
          companyName: 'Internal Commission Accruals',
          category: 'BD commissions',
          date: latestDate || '2026-10-01',
          amount: sumAccrued,
          isAccrualSummary: true
        };

        list = [summaryRow, ...nonAccrued];
      } else {
        list = nonAccrued;
      }
    }

    // Filter by Vendor
    if (vendorFilter !== 'all') {
      list = list.filter(tx => tx.companyName === vendorFilter);
    }

    // Filter by Category (synced with allocation row click or dropdown)
    if (selectedCategoryFilter !== 'all') {
      list = list.filter(tx => {
        const cat = tx.category || 'Other';
        if (selectedCategoryFilter === 'Other') {
          // If "Other" selected, match 'Other' or any category outside top 5
          const top5Labels = topCategories.filter(c => c.label !== 'Other').map(c => c.label);
          return !top5Labels.includes(cat);
        }
        return cat.toLowerCase() === selectedCategoryFilter.toLowerCase();
      });
    }

    // Search query filter (title, companyName, description, referenceId)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(tx =>
        (tx.title && tx.title.toLowerCase().includes(q)) ||
        (tx.companyName && tx.companyName.toLowerCase().includes(q)) ||
        (tx.description && tx.description.toLowerCase().includes(q)) ||
        (tx.referenceId && String(tx.referenceId).toLowerCase().includes(q))
      );
    }

    // Sort by date, newest first
    list.sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return dateB - dateA;
    });

    return list;
  }, [currentExpenses, groupAccruals, vendorFilter, selectedCategoryFilter, searchQuery, topCategories]);

  // Safe pagination
  const totalPages = Math.max(1, Math.ceil(filteredExpenses.length / ITEMS_PER_PAGE));
  const safePage = Math.min(Math.max(1, page), totalPages);

  const paginatedExpenses = useMemo(() => {
    const start = (safePage - 1) * ITEMS_PER_PAGE;
    return filteredExpenses.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredExpenses, safePage]);

  // Reset page on filter changes
  useEffect(() => {
    setPage(1);
  }, [vendorFilter, selectedCategoryFilter, searchQuery, groupAccruals, selectedMonth]);

  return (
    <div className="cash-outflow-page animate-fade-in">

      {/* 1. SINGLE SUMMARY CARD (Replacing the 3 old KPI cards) */}
      <div className="co-summary-card">
        <div className="co-summary-header">
          <div className="co-summary-title-group">
            <span className="co-summary-label">Total Outflow</span>
            <h2 className="co-summary-big-num" title={formatCurrency(totalExpense)}>
              {formatLakhs(totalExpense)}
            </h2>
          </div>
          <span className="co-summary-period-tag">{selectedMonth}</span>
        </div>

        {/* Thin Stacked Progress Bar: Direct vs Overhead */}
        <div className="co-stacked-bar-container">
          <div className="co-stacked-bar">
            <div
              className="co-stacked-segment"
              style={{ width: `${directPct}%`, background: '#2563eb' }}
              title={`Direct: ${formatLakhs(directCost)} (${directPct.toFixed(0)}%)`}
            />
            <div
              className="co-stacked-segment"
              style={{ width: `${overheadPct}%`, background: '#7c3aed' }}
              title={`Overhead: ${formatLakhs(overheadCost)} (${overheadPct.toFixed(0)}%)`}
            />
          </div>
        </div>

        {/* 2 Small Sub-Stats under the bar */}
        <div className="co-summary-sub-stats">
          <div className="co-sub-stat">
            <div className="co-sub-stat-top">
              <span className="co-sub-stat-dot" style={{ background: '#2563eb' }} />
              <span className="co-sub-stat-label">Direct Cost</span>
            </div>
            <span className="co-sub-stat-value" title={formatCurrency(directCost)}>
              {formatLakhs(directCost)}
            </span>
            <span className="co-sub-stat-sub">
              {directPct.toFixed(0)}% of total · Tied to franchisee & BD agent deals
            </span>
          </div>

          <div className="co-sub-stat">
            <div className="co-sub-stat-top">
              <span className="co-sub-stat-dot" style={{ background: '#7c3aed' }} />
              <span className="co-sub-stat-label">Operating Overhead</span>
            </div>
            <span className="co-sub-stat-value" title={formatCurrency(overheadCost)}>
              {formatLakhs(overheadCost)}
            </span>
            <span className="co-sub-stat-sub">
              {overheadPct.toFixed(0)}% of total · Fixed & general operational costs
            </span>
          </div>
        </div>
      </div>

      {/* 2. TWO COLUMNS: ALLOCATION (5/12) & EXPENSE LOG (7/12) */}
      <div className="co-columns-grid">

        {/* Outflow Allocation (5/12) */}
        <div className="co-card">
          <div className="co-card-header">
            <h3 className="co-card-title">Outflow Allocation</h3>
            <span className="co-card-subtitle">Top 5 categories + Other</span>
          </div>

          <div className="co-allocation-list">
            {topCategories.length === 0 ? (
              <p className="co-empty">No expenses recorded for this period.</p>
            ) : (
              topCategories.map(cat => {
                const percent = totalExpense > 0 ? (cat.value / totalExpense) * 100 : 0;
                const isActive = selectedCategoryFilter === cat.label;

                return (
                  <div
                    key={cat.label}
                    className={`co-allocation-row ${isActive ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedCategoryFilter(prev => prev === cat.label ? 'all' : cat.label);
                    }}
                    title={`Click to filter log by ${cat.label}`}
                  >
                    <div className="co-allocation-row-top">
                      <div className="co-allocation-row-left">
                        <span className="co-allocation-dot" style={{ background: cat.color }} />
                        <span className="co-allocation-name">{cat.label}</span>
                      </div>
                      <div className="co-allocation-row-right">
                        <span className="co-allocation-amount" title={formatCurrency(cat.value)}>
                          {formatLakhs(cat.value)}
                        </span>
                        <span className="co-allocation-pct">({percent.toFixed(0)}%)</span>
                      </div>
                    </div>
                    <div className="co-allocation-bar-track">
                      <div
                        className="co-allocation-bar-fill"
                        style={{ width: `${percent}%`, background: cat.color }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <p className="co-allocation-hint">
            {selectedCategoryFilter !== 'all'
              ? `Filtered by "${selectedCategoryFilter}" • Click row again to clear`
              : 'Click any category row above to filter the expense log'}
          </p>
        </div>

        {/* Expense Log (7/12) */}
        <div className="co-card">
          {/* Toolbar */}
          <div className="co-log-toolbar">
            <h3 className="co-card-title">Expense Log</h3>

            <div className="co-toolbar-filters">
              {/* Search Box */}
              <div className="co-search-box">
                <Search size={12} color="var(--text-muted)" />
                <input
                  type="text"
                  className="co-search-input"
                  placeholder="Search log..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Category Dropdown */}
              <select
                className="co-select"
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              >
                <option value="all">All Categories</option>
                {allCategoryNames.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              {/* Vendor / Company Filter */}
              {companyList.length > 0 && (
                <select
                  className="co-select"
                  value={vendorFilter}
                  onChange={(e) => setVendorFilter(e.target.value)}
                >
                  <option value="all">All Vendors</option>
                  {companyList.map(comp => (
                    <option key={comp} value={comp}>{comp}</option>
                  ))}
                </select>
              )}

              {/* Group Accruals Toggle */}
              <label className="co-toggle-label" title="Collapse individual accrued commissions into a single summary row">
                <input
                  type="checkbox"
                  className="co-toggle-checkbox"
                  checked={groupAccruals}
                  onChange={(e) => setGroupAccruals(e.target.checked)}
                />
                <span>Group accruals</span>
              </label>
            </div>
          </div>

          {/* Table */}
          <div className="co-table-wrapper">
            <table className="co-table">
              <thead>
                <tr>
                  <th className="co-th">Title</th>
                  <th className="co-th">Category</th>
                  <th className="co-th">Date</th>
                  <th className="co-th text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {paginatedExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="co-empty">
                      No expense entries found matching filters.
                    </td>
                  </tr>
                ) : (
                  paginatedExpenses.map(tx => {
                    const amt = Number(tx.amount || 0);
                    const isReversal = amt < 0 || tx.type === 'credit_note' || tx.isReversal;

                    return (
                      <tr key={tx.id || `${tx.title}-${tx.date}`}>
                        {/* 1. Title (Ellipsis single-line + vendor second line) */}
                        <td className="co-td co-title-cell">
                          <span className="co-title-text" title={tx.title}>
                            {tx.title}
                          </span>
                          <span className="co-vendor-sub" title={tx.companyName || 'No vendor recorded'}>
                            {tx.companyName && tx.companyName !== 'N/A' ? tx.companyName : '—'}
                          </span>
                        </td>

                        {/* 2. Category */}
                        <td className="co-td">
                          <span className="co-category-pill">
                            {tx.category || 'Other'}
                          </span>
                        </td>

                        {/* 3. Date ("22 Oct") */}
                        <td className="co-td co-date-cell">
                          {formatShortDate(tx.date)}
                        </td>

                        {/* 4. Amount */}
                        <td className={`co-td co-amount-cell ${isReversal ? 'reversal' : ''}`}>
                          {isReversal ? (
                            <>
                              <span className="co-reversal-tag">Reversal</span>
                              +{formatCurrency(Math.abs(amt))}
                            </>
                          ) : (
                            `-${formatCurrency(amt)}`
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <Pagination
            currentPage={safePage}
            totalItems={filteredExpenses.length}
            pageSize={ITEMS_PER_PAGE}
            onPageChange={setPage}
            itemName="expenses"
          />
        </div>

      </div>

    </div>
  );
};

export default CashOutflow;
