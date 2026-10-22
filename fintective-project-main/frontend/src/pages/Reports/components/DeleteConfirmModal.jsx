import React, { useEffect } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { formatCurrency, formatDate } from '../../../utils/formatters';

export default function DeleteConfirmModal({
  isOpen,
  transaction,
  onConfirm,
  onCancel
}) {
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isOpen) {
        onCancel();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen || !transaction) return null;

  return (
    <div className="rep-modal-backdrop" onClick={onCancel}>
      <div className="rep-modal-card animate-scale-up" onClick={e => e.stopPropagation()}>
        <div className="rep-modal-header">
          <div className="rep-modal-icon-badge">
            <Trash2 size={20} className="text-red" />
          </div>
          <div className="rep-modal-titles">
            <h4 className="rep-modal-title">Delete Manual Transaction</h4>
            <p className="rep-modal-sub">This action cannot be undone.</p>
          </div>
          <button type="button" className="rep-modal-close" onClick={onCancel} aria-label="Close dialog">
            <X size={16} />
          </button>
        </div>

        <div className="rep-modal-body">
          <div className="rep-modal-details-card">
            <div className="rep-detail-row">
              <span className="rep-detail-key">Title</span>
              <span className="rep-detail-val font-bold">{transaction.title}</span>
            </div>
            <div className="rep-detail-row">
              <span className="rep-detail-key">Amount</span>
              <span className="rep-detail-val text-red font-bold">
                {formatCurrency(transaction.amount, transaction.type === 'expense')}
              </span>
            </div>
            <div className="rep-detail-row">
              <span className="rep-detail-key">Date</span>
              <span className="rep-detail-val">{transaction.date}</span>
            </div>
            {transaction.referenceId && (
              <div className="rep-detail-row">
                <span className="rep-detail-key">Reference</span>
                <span className="rep-detail-val"><code className="ref-code">{transaction.referenceId}</code></span>
              </div>
            )}
          </div>
        </div>

        <div className="rep-modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => onConfirm(transaction.id)}
            style={{ backgroundColor: '#ef4444', color: '#ffffff', borderColor: '#ef4444' }}
          >
            Yes, Delete Entry
          </button>
        </div>
      </div>
    </div>
  );
}
