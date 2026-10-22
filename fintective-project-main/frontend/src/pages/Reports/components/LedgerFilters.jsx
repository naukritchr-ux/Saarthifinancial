import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  Filter,
  Calendar,
  DollarSign,
  Download,
  Printer,
  ChevronDown,
  ChevronUp,
  X,
  Check,
  Bookmark,
  Plus,
  Trash2,
  Clock
} from 'lucide-react';

/**
 * Reusable searchable multi-select dropdown for filter options
 */
function MultiSelectFilter({
  label,
  options = [],
  selected = [],
  onChange,
  placeholder = 'All',
  enableSearch = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const filteredOptions = query.trim()
    ? options.filter(opt => opt.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  const toggleOption = (val) => {
    if (selected.includes(val)) {
      onChange(selected.filter(item => item !== val));
    } else {
      onChange([...selected, val]);
    }
  };

  const handleSelectAll = () => {
    onChange(options.map(o => o.value));
  };

  const handleClear = () => {
    onChange([]);
  };

  return (
    <div className="rep-filter-group" ref={containerRef}>
      <label className="rep-filter-label">{label}</label>
      <div
        className={`rep-dropdown-trigger ${isOpen ? 'active' : ''} ${selected.length > 0 ? 'has-selection' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        tabIndex={0}
        role="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="rep-dropdown-trigger-text">
          {selected.length === 0 ? (
            <span className="rep-placeholder">{placeholder}</span>
          ) : selected.length === 1 ? (
            <span className="rep-selected-single">{selected[0]}</span>
          ) : (
            <span className="rep-selected-badge">{selected.length} selected</span>
          )}
        </span>
        <span className="rep-dropdown-arrow">
          {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </div>

      {isOpen && (
        <div className="rep-dropdown-menu animate-slide-down">
          {enableSearch && (
            <div className="rep-dropdown-search">
              <Search size={13} className="rep-search-icon" />
              <input
                type="text"
                placeholder={`Search ${label}...`}
                value={query}
                onChange={e => setQuery(e.target.value)}
                autoFocus
              />
              {query && (
                <button type="button" onClick={() => setQuery('')} className="rep-search-clear">
                  <X size={12} />
                </button>
              )}
            </div>
          )}

          <div className="rep-dropdown-actions">
            <button type="button" onClick={handleSelectAll} className="rep-dropdown-action-btn">
              Select all
            </button>
            <button type="button" onClick={handleClear} className="rep-dropdown-action-btn">
              Clear
            </button>
          </div>

          <div className="rep-dropdown-list">
            {filteredOptions.length === 0 ? (
              <div className="rep-dropdown-empty">No options found</div>
            ) : (
              filteredOptions.map(opt => {
                const isChecked = selected.includes(opt.value);
                return (
                  <div
                    key={opt.value}
                    className={`rep-dropdown-item ${isChecked ? 'checked' : ''}`}
                    onClick={() => toggleOption(opt.value)}
                  >
                    <span className="rep-checkbox">
                      {isChecked && <Check size={12} />}
                    </span>
                    <span className="rep-item-label">{opt.label}</span>
                    {opt.count !== undefined && (
                      <span className="rep-item-count">{opt.count}</span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function LedgerFilters({
  filters,
  setFilterKey,
  toggleArrayItem,
  resetFilters,
  searchInput,
  onSearchChange,
  filterDropdownOptions,
  savedViews = [],
  onSaveView,
  onApplyView,
  onDeleteView,
  onExportCsv,
  onPrint
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isSavingView, setIsSavingView] = useState(false);
  const [newViewName, setNewViewName] = useState('');

  const handleSaveViewSubmit = (e) => {
    e.preventDefault();
    if (!newViewName.trim()) return;
    onSaveView(newViewName.trim());
    setNewViewName('');
    setIsSavingView(false);
  };

  return (
    <div className="rep-filters-panel dashboard-card no-print">
      {/* Top Row: Search Input + Primary Dropdowns + Actions */}
      <div className="rep-filters-top-bar">
        {/* Search Box */}
        <div className="rep-search-wrapper">
          <label className="rep-filter-label">Search Ledger</label>
          <div className="rep-search-input-box">
            <Search size={15} className="rep-search-icon" />
            <input
              type="text"
              placeholder="Search title, subcategory, reference #, client..."
              value={searchInput}
              onChange={e => onSearchChange(e.target.value)}
              className="rep-search-input"
            />
            {searchInput && (
              <button
                type="button"
                className="rep-search-clear-btn"
                onClick={() => onSearchChange('')}
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Type Multi-select */}
        <MultiSelectFilter
          label="Transaction Type"
          options={filterDropdownOptions.types}
          selected={filters.types || []}
          onChange={vals => setFilterKey('types', vals)}
          placeholder="All Types"
        />

        {/* Category Multi-select */}
        <MultiSelectFilter
          label="Category"
          options={filterDropdownOptions.categories}
          selected={filters.category || []}
          onChange={vals => setFilterKey('category', vals)}
          placeholder="All Categories"
        />

        {/* Payment Mode Multi-select */}
        <MultiSelectFilter
          label="Payment Mode"
          options={filterDropdownOptions.paymentModes}
          selected={filters.paymentMode || []}
          onChange={vals => setFilterKey('paymentMode', vals)}
          placeholder="All Modes"
        />

        {/* Company Multi-select with Search */}
        <MultiSelectFilter
          label="Corporate Client"
          options={filterDropdownOptions.companies}
          selected={filters.company || []}
          onChange={vals => setFilterKey('company', vals)}
          placeholder="All Clients"
          enableSearch={true}
        />

        {/* Action Buttons */}
        <div className="rep-filter-actions-group">
          <button
            type="button"
            className={`btn btn-secondary rep-advanced-toggle-btn ${showAdvanced ? 'active' : ''}`}
            onClick={() => setShowAdvanced(!showAdvanced)}
            title="Toggle Date Ranges, Amount Bounds, BD Agents & Saved Views"
          >
            <Filter size={15} />
            <span>More Filters</span>
            {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={onExportCsv}
            title="Export all matching transactions to Excel CSV"
          >
            <Download size={15} />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={onPrint}
            title="Print entire transaction ledger"
          >
            <Printer size={15} />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* Advanced Filter Drawer */}
      {showAdvanced && (
        <div className="rep-advanced-drawer animate-slide-down">
          <div className="rep-advanced-grid">
            {/* Timing Toggle (Actual vs Projected) */}
            <div className="rep-filter-group">
              <label className="rep-filter-label">Timing Horizon</label>
              <div className="rep-timing-toggle">
                <button
                  type="button"
                  className={`rep-timing-btn ${(!filters.actualProjected || filters.actualProjected === 'all') ? 'active' : ''}`}
                  onClick={() => setFilterKey('actualProjected', 'all')}
                >
                  All (Actual & Proj)
                </button>
                <button
                  type="button"
                  className={`rep-timing-btn ${filters.actualProjected === 'actual' ? 'active' : ''}`}
                  onClick={() => setFilterKey('actualProjected', 'actual')}
                >
                  Actual Only
                </button>
                <button
                  type="button"
                  className={`rep-timing-btn ${filters.actualProjected === 'projected' ? 'active' : ''}`}
                  onClick={() => setFilterKey('actualProjected', 'projected')}
                >
                  Projected Only
                </button>
              </div>
            </div>

            {/* Date From */}
            <div className="rep-filter-group">
              <label className="rep-filter-label">Custom Date From</label>
              <input
                type="date"
                value={filters.dateFrom || ''}
                onChange={e => setFilterKey('dateFrom', e.target.value)}
                className="rep-input-control"
              />
            </div>

            {/* Date To */}
            <div className="rep-filter-group">
              <label className="rep-filter-label">Custom Date To</label>
              <input
                type="date"
                value={filters.dateTo || ''}
                onChange={e => setFilterKey('dateTo', e.target.value)}
                className="rep-input-control"
              />
            </div>

            {/* Amount Min */}
            <div className="rep-filter-group">
              <label className="rep-filter-label">Min Amount (₹)</label>
              <input
                type="number"
                placeholder="0"
                min="0"
                value={filters.amountMin || ''}
                onChange={e => setFilterKey('amountMin', e.target.value)}
                className="rep-input-control"
              />
            </div>

            {/* Amount Max */}
            <div className="rep-filter-group">
              <label className="rep-filter-label">Max Amount (₹)</label>
              <input
                type="number"
                placeholder="No max"
                min="0"
                value={filters.amountMax || ''}
                onChange={e => setFilterKey('amountMax', e.target.value)}
                className="rep-input-control"
              />
            </div>

            {/* BD Specialist Multi-select */}
            <MultiSelectFilter
              label="BD Specialist"
              options={filterDropdownOptions.bds}
              selected={filters.bd || []}
              onChange={vals => setFilterKey('bd', vals)}
              placeholder="All BD Specialists"
              enableSearch={true}
            />

            {/* Franchisee Hub Multi-select */}
            <MultiSelectFilter
              label="Franchisee Hub"
              options={filterDropdownOptions.franchises}
              selected={filters.franchise || []}
              onChange={vals => setFilterKey('franchise', vals)}
              placeholder="All Hubs"
              enableSearch={true}
            />

            {/* Team Leader Multi-select */}
            <MultiSelectFilter
              label="Team Leader"
              options={filterDropdownOptions.tls}
              selected={filters.tl || []}
              onChange={vals => setFilterKey('tl', vals)}
              placeholder="All Leaders"
            />

            {/* Sub-Category Multi-select */}
            <MultiSelectFilter
              label="Sub-Category"
              options={filterDropdownOptions.subCategories}
              selected={filters.subCategory || []}
              onChange={vals => setFilterKey('subCategory', vals)}
              placeholder="All Sub-categories"
              enableSearch={true}
            />
          </div>

          {/* Saved Views Toolbar */}
          <div className="rep-saved-views-bar">
            <div className="rep-saved-views-left">
              <Bookmark size={15} className="rep-bookmark-icon" />
              <span className="rep-saved-views-label">Saved Filter Views:</span>
              
              {savedViews && savedViews.length > 0 ? (
                <div className="rep-saved-views-chips">
                  {savedViews.map(view => (
                    <div key={view.id} className="rep-saved-view-chip">
                      <button
                        type="button"
                        className="rep-saved-view-apply"
                        onClick={() => onApplyView(view)}
                        title={`Apply view saved on ${new Date(view.createdAt).toLocaleDateString()}`}
                      >
                        {view.name}
                      </button>
                      <button
                        type="button"
                        className="rep-saved-view-delete"
                        onClick={() => onDeleteView(view.id)}
                        title="Delete saved view"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="rep-no-saved-views">No saved views yet</span>
              )}
            </div>

            <div className="rep-saved-views-right">
              {isSavingView ? (
                <form onSubmit={handleSaveViewSubmit} className="rep-save-view-form">
                  <input
                    type="text"
                    placeholder="Name this view..."
                    value={newViewName}
                    onChange={e => setNewViewName(e.target.value)}
                    className="rep-save-view-input"
                    autoFocus
                  />
                  <button type="submit" className="btn btn-primary rep-save-btn">
                    Save
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary rep-cancel-btn"
                    onClick={() => { setIsSavingView(false); setNewViewName(''); }}
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  className="btn btn-secondary rep-save-view-trigger"
                  onClick={() => setIsSavingView(true)}
                >
                  <Plus size={13} /> Save Current View
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
