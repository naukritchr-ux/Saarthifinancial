import React, { useState } from 'react';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Trash2,
  Lock,
  Clock,
  Building,
  User,
  ShieldAlert
} from 'lucide-react';
import { formatCurrency } from '../../../utils/formatters';
import { formatDateDisplay, normalizePaymentMode, isProjectedTransaction } from '../utils/ledgerFilter';
import Pagination from '../../../components/Pagination';
import DeleteConfirmModal from './DeleteConfirmModal';

export default function LedgerTable({
  transactions = [],
  paginatedTransactions = [],
  totalItems = 0,
  currentPage = 1,
  pageSize = 20,
  onPageChange,
  onPageSizeChange,
  sortKey = 'date',
  sortDirection = 'desc',
  onSort,
  onDeleteTransaction,
  bdAgentMap,
  franchiseeMap,
  selectedMonth = 'All Months',
  onResetFilters,
  todayStr
}) {
  const [deletingTx, setDeletingTx] = useState(null);

  // Checks whether a transaction was manually added by a user vs ingested/synthesized
  const isManualTransaction = (tx) => {
    if (!tx || !tx.id) return false;
    const sId = String(tx.id);
    const sRef = String(tx.referenceId || '');
    return sId.startsWith('manual-') || sId.startsWith('t-') ||
      (sId.startsWith('exp-') && sRef === 'TX') || sRef.startsWith('TXN-');
  };

  const renderSortIndicator = (key) => {
    if (sortKey !== key) {
      return <ArrowUpDown size={12} className="rep-sort-icon rep-sort-inactive" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp size={12} className="rep-sort-icon rep-sort-active text-teal" />
    ) : (
      <ArrowDown size={12} className="rep-sort-icon rep-sort-active text-teal" />
    );
  };

  const handleDeleteConfirm = (id) => {
    if (onDeleteTransaction) {
      onDeleteTransaction(id);
    }
    setDeletingTx(null);
  };

  return (
    <div className="rep-table-card dashboard-card print-section">
      {/* Table Header Bar */}
      <div className="rep-table-toolbar no-print">
        <div className="rep-table-title-area">
          <h3 className="rep-table-title">General Transaction Ledger</h3>
          <span className="rep-table-subtitle">
            {selectedMonth !== 'All Months' ? `Period: ${selectedMonth}` : 'All Financial Periods'}
          </span>
        </div>

        <div className="rep-page-size-selector">
          <span className="rep-page-size-label">Rows per page:</span>
          {[20, 50, 100].map(size => (
            <button
              key={size}
              type="button"
              className={`rep-page-size-btn ${pageSize === size ? 'active' : ''}`}
              onClick={() => onPageSizeChange(size)}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      {totalItems === 0 ? (
        <div className="rep-no-data-wrapper">
          <div className="rep-no-data-icon-box">
            <ShieldAlert size={28} className="text-muted" />
          </div>
          <p className="rep-no-data-msg">No transactions match your current filter settings.</p>
          <button type="button" className="btn btn-secondary" onClick={onResetFilters}>
            Reset Filters
          </button>
        </div>
      ) : (
        <>
          <div className="table-responsive rep-table-container">
            <table className="data-table rep-ledger-table">
              <thead className="rep-sticky-header">
                <tr>
                  <th
                    className="rep-th-sortable rep-col-date"
                    onClick={() => onSort('date')}
                    title="Sort by Date"
                  >
                    <div className="rep-th-content">
                      <span>Date</span>
                      {renderSortIndicator('date')}
                    </div>
                  </th>

                  <th
                    className="rep-th-sortable rep-col-title"
                    onClick={() => onSort('title')}
                    title="Sort by Title"
                  >
                    <div className="rep-th-content">
                      <span>Item Title & Details</span>
                      {renderSortIndicator('title')}
                    </div>
                  </th>

                  <th
                    className="rep-th-sortable rep-col-company"
                    onClick={() => onSort('company')}
                    title="Sort by Client Company"
                  >
                    <div className="rep-th-content">
                      <span>Client Company</span>
                      {renderSortIndicator('company')}
                    </div>
                  </th>

                  <th
                    className="rep-th-sortable rep-col-category"
                    onClick={() => onSort('category')}
                    title="Sort by Category"
                  >
                    <div className="rep-th-content">
                      <span>Category</span>
                      {renderSortIndicator('category')}
                    </div>
                  </th>

                  <th className="rep-col-payment">Payment Mode</th>
                  <th className="rep-col-ref">Reference ID</th>

                  <th
                    className="rep-th-sortable rep-col-amount text-right"
                    onClick={() => onSort('amount')}
                    title="Sort by Amount"
                  >
                    <div className="rep-th-content rep-th-right">
                      <span>Amount</span>
                      {renderSortIndicator('amount')}
                    </div>
                  </th>

                  <th className="rep-col-actions text-center no-print">Actions</th>
                </tr>
              </thead>

              <tbody>
                {paginatedTransactions.map(tx => {
                  const agent = tx.bdAgentId && bdAgentMap ? bdAgentMap.get(tx.bdAgentId) : null;
                  const franchisee = tx.franchiseeId && franchiseeMap ? franchiseeMap.get(tx.franchiseeId) : null;
                  const isProj = isProjectedTransaction(tx.date, todayStr);
                  const isManual = isManualTransaction(tx);
                  const displayDate = formatDateDisplay(tx.date);
                  const mode = normalizePaymentMode(tx.paymentMode);

                  return (
                    <tr key={tx.id} className={isProj ? 'rep-row-projected' : ''}>
                      {/* Date */}
                      <td className="rep-col-date">
                        <div className="rep-date-cell">
                          <span className="rep-date-formatted">{displayDate}</span>
                          {isProj && (
                            <span className="rep-badge-proj" title="Forward projected date">
                              <Clock size={10} /> Projected
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Title & Details */}
                      <td className="rep-col-title">
                        <div className="rep-tx-title font-bold">{tx.title}</div>
                        <div className="rep-tx-meta-row">
                          <span className="rep-tx-subcat">{tx.subCategory || 'General'}</span>
                          {agent && (
                            <span className="rep-tx-agent-tag">
                              BD: {agent.name || agent.title}
                            </span>
                          )}
                          {franchisee && (
                            <span className="rep-tx-fran-tag">
                              Hub: {franchisee.name || franchisee.city}
                            </span>
                          )}
                          {tx.teamLeaderName && (
                            <span className="rep-tx-tl-tag">
                              TL: {tx.teamLeaderName}
                            </span>
                          )}
                        </div>
                        {tx.description && (
                          <div className="rep-tx-desc">{tx.description}</div>
                        )}
                      </td>

                      {/* Company Name */}
                      <td className="rep-col-company">
                        {tx.companyName && tx.companyName !== 'N/A' && !tx.companyName.toLowerCase().startsWith('payroll') ? (
                          <span className="rep-company-badge">
                            {tx.companyName}
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>

                      {/* Category & Status */}
                      <td className="rep-col-category">
                        {tx.type === 'income' && tx.category === 'Recruitment' && tx.info && tx.info !== 'N/A' ? (
                          <span className={`type-badge info-${String(tx.info).toLowerCase()}`} title="Status from CRM">
                            {tx.info}
                          </span>
                        ) : (
                          <span className={`type-badge ${tx.type}`}>
                            {tx.category || (tx.type === 'income' ? 'Revenue' : 'Expense')}
                          </span>
                        )}
                      </td>

                      {/* Payment Mode */}
                      <td className="rep-col-payment font-semibold">
                        <span className={`rep-mode-text ${mode === 'Unspecified' ? 'text-muted' : ''}`}>
                          {mode}
                        </span>
                      </td>

                      {/* Reference ID */}
                      <td className="rep-col-ref">
                        {tx.referenceId ? (
                          <code className="ref-code">{tx.referenceId}</code>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>

                      {/* Amount */}
                      <td className={`rep-col-amount text-right font-bold ${tx.type === 'income' ? 'text-teal' : 'text-red'}`}>
                        {formatCurrency(tx.amount, tx.type === 'expense')}
                      </td>

                      {/* Actions */}
                      <td className="rep-col-actions text-center no-print">
                        {isManual ? (
                          <button
                            type="button"
                            className="btn-delete rep-btn-delete"
                            title="Delete manual entry"
                            onClick={() => setDeletingTx(tx)}
                          >
                            <Trash2 size={15} />
                          </button>
                        ) : (
                          <span
                            className="rep-action-locked"
                            title="System record synced from live CRM / Payroll. Cannot be deleted manually."
                          >
                            <Lock size={13} className="text-muted" />
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <Pagination
            currentPage={currentPage}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={onPageChange}
            pageSizeOptions={[20, 50, 100]}
            onPageSizeChange={onPageSizeChange}
            itemName="transactions"
            className="no-print rep-pagination-bar"
          />
        </>
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={Boolean(deletingTx)}
        transaction={deletingTx}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeletingTx(null)}
      />
    </div>
  );
}
