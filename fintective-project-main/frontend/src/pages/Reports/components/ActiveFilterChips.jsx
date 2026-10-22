import React from 'react';
import { X, RotateCcw, Filter } from 'lucide-react';
import { normalizePaymentMode, formatDateDisplay } from '../utils/ledgerFilter';

export default function ActiveFilterChips({
  filters,
  toggleArrayItem,
  setFilterKey,
  resetFilters,
  totalResults = 0
}) {
  const chips = [];

  // 1. Search Query
  if (filters.search) {
    chips.push({
      id: 'search',
      label: `Search: "${filters.search}"`,
      onRemove: () => setFilterKey('search', '')
    });
  }

  // 2. Timing (Actual vs Projected)
  if (filters.actualProjected && filters.actualProjected !== 'all') {
    chips.push({
      id: 'timing',
      label: filters.actualProjected === 'actual' ? 'Only Actual (<= Today)' : 'Only Projected (> Today)',
      onRemove: () => setFilterKey('actualProjected', 'all')
    });
  }

  // 3. Date From / To
  if (filters.dateFrom) {
    chips.push({
      id: 'dateFrom',
      label: `From: ${formatDateDisplay(filters.dateFrom)}`,
      onRemove: () => setFilterKey('dateFrom', '')
    });
  }
  if (filters.dateTo) {
    chips.push({
      id: 'dateTo',
      label: `To: ${formatDateDisplay(filters.dateTo)}`,
      onRemove: () => setFilterKey('dateTo', '')
    });
  }

  // 4. Amount Range
  if (filters.amountMin !== '' && filters.amountMin !== undefined) {
    chips.push({
      id: 'amountMin',
      label: `Min: ₹${Number(filters.amountMin).toLocaleString()}`,
      onRemove: () => setFilterKey('amountMin', '')
    });
  }
  if (filters.amountMax !== '' && filters.amountMax !== undefined) {
    chips.push({
      id: 'amountMax',
      label: `Max: ₹${Number(filters.amountMax).toLocaleString()}`,
      onRemove: () => setFilterKey('amountMax', '')
    });
  }

  // 5. Types
  (filters.types || []).forEach(type => {
    chips.push({
      id: `type-${type}`,
      label: `Type: ${type.toUpperCase()}`,
      onRemove: () => toggleArrayItem('types', type)
    });
  });

  // 6. Categories
  (filters.category || []).forEach(cat => {
    chips.push({
      id: `cat-${cat}`,
      label: `Category: ${cat}`,
      onRemove: () => toggleArrayItem('category', cat)
    });
  });

  // 7. Sub-Categories
  (filters.subCategory || []).forEach(sub => {
    chips.push({
      id: `sub-${sub}`,
      label: `Sub-cat: ${sub}`,
      onRemove: () => toggleArrayItem('subCategory', sub)
    });
  });

  // 8. Payment Modes
  (filters.paymentMode || []).forEach(mode => {
    chips.push({
      id: `mode-${mode}`,
      label: `Mode: ${normalizePaymentMode(mode)}`,
      onRemove: () => toggleArrayItem('paymentMode', mode)
    });
  });

  // 9. Companies
  (filters.company || []).forEach(comp => {
    chips.push({
      id: `comp-${comp}`,
      label: `Client: ${comp}`,
      onRemove: () => toggleArrayItem('company', comp)
    });
  });

  // 10. BD Agents
  (filters.bd || []).forEach(bd => {
    chips.push({
      id: `bd-${bd}`,
      label: `BD: ${bd}`,
      onRemove: () => toggleArrayItem('bd', bd)
    });
  });

  // 11. Franchisees
  (filters.franchise || []).forEach(fran => {
    chips.push({
      id: `fran-${fran}`,
      label: `Franchise: ${fran}`,
      onRemove: () => toggleArrayItem('franchise', fran)
    });
  });

  // 12. Team Leaders
  (filters.tl || []).forEach(tl => {
    chips.push({
      id: `tl-${tl}`,
      label: `TL: ${tl}`,
      onRemove: () => toggleArrayItem('tl', tl)
    });
  });

  if (chips.length === 0) {
    return null;
  }

  return (
    <div className="rep-chips-bar animate-fade-in no-print">
      <div className="rep-chips-header">
        <span className="rep-chips-title">
          <Filter size={13} /> Active Filters ({chips.length}):
        </span>
        <span className="rep-chips-count">
          Showing <strong>{totalResults.toLocaleString()}</strong> matching records
        </span>
      </div>

      <div className="rep-chips-list">
        {chips.map(chip => (
          <span key={chip.id} className="rep-chip">
            <span className="rep-chip-label">{chip.label}</span>
            <button
              type="button"
              className="rep-chip-remove"
              onClick={chip.onRemove}
              title={`Remove filter: ${chip.label}`}
              aria-label={`Remove filter: ${chip.label}`}
            >
              <X size={12} />
            </button>
          </span>
        ))}

        <button
          type="button"
          className="rep-chips-clear-btn"
          onClick={resetFilters}
          title="Clear all active filters"
        >
          <RotateCcw size={12} /> Clear all
        </button>
      </div>
    </div>
  );
}
