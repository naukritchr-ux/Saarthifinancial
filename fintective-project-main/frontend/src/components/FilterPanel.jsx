import React, { useState, useRef, useEffect, useMemo } from 'react';
import '../pages/CostOfPerformance.css';
import { 
  Filter, X, Check, ChevronDown, ChevronUp, Search, 
  RotateCcw, Calendar, Sliders, Info
} from 'lucide-react';

const REPORT_VIEWS = [
  { id: 'bd', label: 'BD-wise' },
  { id: 'tl', label: 'Team Leader-wise' },
  { id: 'franchise', label: 'Franchise-wise' },
  { id: 'city', label: 'City-wise' },
  { id: 'industry', label: 'Industry-wise' }
];

const SORT_OPTIONS = [
  { id: 'net', label: 'Net Contribution' },
  { id: 'company_share', label: 'Company Share' },
  { id: 'credit_notes', label: 'Credit Notes' },
  { id: 'placements', label: 'Placements' },
  { id: 'net_enquiry', label: 'Net / Enquiry' }
];

const VIEW_AS_OPTIONS = [
  { id: 'this_fy', label: 'This FY' },
  { id: 'this_quarter', label: 'This Quarter' },
  { id: 'last_3_months', label: 'Last 3 Months' },
  { id: 'all_time', label: 'All Time' },
  { id: 'custom', label: 'Custom range' }
];

/**
 * Reusable Multi-Select Dropdown with internal search, checkboxes, and count tags
 */
function MultiSelectDropdown({ 
  label, 
  options = [], 
  selected = [], 
  onChange, 
  disabled = false, 
  disabledReason = '',
  placeholder = 'Select options...' 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef(null);

  // Close when clicked outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return options;
    const term = searchTerm.toLowerCase();
    return options.filter(opt => 
      (opt.label || opt.value || '').toLowerCase().includes(term)
    );
  }, [options, searchTerm]);

  const toggleOption = (val) => {
    if (selected.includes(val)) {
      onChange(selected.filter(item => item !== val));
    } else {
      onChange([...selected, val]);
    }
  };

  const handleSelectAll = () => {
    const allVals = options.map(o => o.value);
    onChange(allVals);
  };

  const handleClear = () => {
    onChange([]);
  };

  return (
    <div className="relative" ref={containerRef}>
      <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center justify-between">
        <span>{label}</span>
        {selected.length > 0 && !disabled && (
          <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-1.5 py-0.2 rounded-full border border-teal-200">
            {selected.length} selected
          </span>
        )}
      </label>

      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        title={disabled ? disabledReason : ''}
        className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg border text-left transition-all ${
          disabled
            ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
            : selected.length > 0
            ? 'bg-teal-50/50 border-teal-500 text-gray-900 font-medium'
            : 'bg-white border-gray-300 text-gray-600 hover:border-gray-400'
        }`}
      >
        <span className="truncate">
          {disabled
            ? (disabledReason || 'Not applicable on this tab')
            : selected.length === 0
            ? placeholder
            : selected.length === 1
            ? (options.find(o => o.value === selected[0])?.label || selected[0])
            : `${selected.length} selected`}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 ml-1 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Popover */}
      {isOpen && !disabled && (
        <div className="absolute left-0 mt-1 w-64 max-w-[90vw] bg-white border border-gray-200 rounded-xl shadow-xl z-50 p-2 text-xs">
          {/* Search bar inside */}
          <div className="relative mb-2">
            <Search className="w-3.5 h-3.5 absolute left-2 top-2.5 text-gray-400" />
            <input
              type="text"
              placeholder={`Search ${label}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-7 pr-7 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500 focus:bg-white"
            />
            {searchTerm && (
              <button 
                type="button"
                onClick={() => setSearchTerm('')} 
                className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Actions: Select all / Clear */}
          <div className="flex items-center justify-between px-1 py-1 mb-1 border-b border-gray-100 text-[11px] text-gray-500">
            <span>{filteredOptions.length} options</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-teal-700 hover:underline font-medium"
              >
                Select all
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={handleClear}
                className="text-rose-600 hover:underline"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Options list */}
          <div className="max-h-48 overflow-y-auto space-y-0.5">
            {filteredOptions.length === 0 ? (
              <div className="py-3 text-center text-gray-400 text-xs">
                No matching options
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isChecked = selected.includes(opt.value);
                return (
                  <label
                    key={opt.value}
                    className={`flex items-center justify-between px-2 py-1.5 rounded cursor-pointer transition-colors ${
                      isChecked ? 'bg-teal-50 text-teal-900 font-medium' : 'hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate pr-2">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleOption(opt.value)}
                        className="rounded border-gray-300 text-teal-600 focus:ring-teal-500 h-3.5 w-3.5"
                      />
                      <span className="truncate">{opt.label}</span>
                    </div>
                    {typeof opt.count === 'number' && (
                      <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.2 rounded-full">
                        {opt.count}
                      </span>
                    )}
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Authoritative Collapsible "Performance Filters" Component
 */
export default function FilterPanel({
  isOpen,
  onToggle,
  activeTab,
  onTabChange,
  sortBy,
  onSortChange,
  financialYear,
  onFinancialYearChange,
  availableYears = [],
  month,
  onMonthChange,
  availableMonths = [],
  viewReportAs,
  onViewReportAsChange,
  customStartDate,
  onCustomStartDateChange,
  customEndDate,
  onCustomEndDateChange,
  filterOptions = {},
  selectedTLs = [],
  onTLsChange,
  selectedBDs = [],
  onBDsChange,
  selectedFranchises = [],
  onFranchisesChange,
  selectedIndustries = [],
  onIndustriesChange,
  selectedSubIndustries = [],
  onSubIndustriesChange,
  selectedCities = [],
  onCitiesChange,
  selectedClientStatuses = [],
  onClientStatusesChange,
  selectedEnquiryStatuses = [],
  onEnquiryStatusesChange,
  onApplyFilters,
  onClearFilters,
  activeFiltersCount = 0
}) {
  // Rule: Month takes precedence over "View Report As".
  // If Month is selected (e.g. 'all' or a specific month), View Report As is disabled.
  const isMonthActive = month && month.toLowerCase() !== 'custom';

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden transition-all">
      {/* Panel Header */}
      <div className="px-5 py-3.5 bg-gray-50/70 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-teal-50 rounded-lg border border-teal-200 text-teal-700">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <span>Performance Filters</span>
              {activeFiltersCount > 0 && (
                <span className="text-[11px] font-semibold text-teal-700 bg-teal-100/80 px-2 py-0.5 rounded-full border border-teal-200">
                  {activeFiltersCount} active
                </span>
              )}
            </h3>
            <p className="text-[11px] text-gray-500">
              Cross-dimensional unit-economics ledger filters & scope controllers
            </p>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClearFilters}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 shadow-xs transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5 text-gray-500" />
            <span>Clear Filters</span>
          </button>
          <button
            type="button"
            onClick={onApplyFilters}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg shadow-sm transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Apply Filters</span>
          </button>
          <button
            type="button"
            onClick={onToggle}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors ml-1"
            title={isOpen ? 'Collapse panel' : 'Expand panel'}
          >
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Collapsible Panel Body */}
      {isOpen && (
        <div className="p-5 space-y-6">
          {/* BASE FILTERS SECTION */}
          <div>
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-gray-100">
              <span className="text-xs font-bold uppercase tracking-wider text-teal-800 flex items-center gap-1.5">
                <span>Base Filters</span>
              </span>
              <span className="text-[11px] text-gray-400">
                Primary reporting dimension, sort order & accounting period
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 1. Reports View (in sync with top tabs) */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Reports View
                </label>
                <select
                  value={activeTab}
                  onChange={(e) => onTabChange(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 font-medium text-gray-800"
                >
                  {REPORT_VIEWS.map(tab => (
                    <option key={tab.id} value={tab.id}>{tab.label}</option>
                  ))}
                </select>
              </div>

              {/* 2. Sort By */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Sort By
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => onSortChange(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 text-gray-800"
                >
                  {SORT_OPTIONS.map(opt => (
                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* 3. Financial Year */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Financial Year
                </label>
                <select
                  value={financialYear}
                  onChange={(e) => onFinancialYearChange(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 text-gray-800 font-medium"
                >
                  {availableYears.map(y => (
                    <option key={y} value={y}>{y === 'All Years' ? 'All Years (All Time)' : `FY ${y}`}</option>
                  ))}
                </select>
              </div>

              {/* 4. Month */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Month
                </label>
                <select
                  value={month}
                  onChange={(e) => onMonthChange(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 text-gray-800 font-medium"
                >
                  {availableMonths.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                  <option value="custom">Custom Range (Date Picker)</option>
                </select>
              </div>
            </div>

            {/* View Report As & Custom Range Sub-Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-3">
              {/* 5. View Report As (Disabled when Month is explicitly active) */}
              <div className="lg:col-span-2">
                <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center justify-between">
                  <span>View Report As</span>
                  {isMonthActive && (
                    <span className="text-[10px] text-gray-400 font-normal italic flex items-center gap-1">
                      <Info className="w-3 h-3 text-gray-400" />
                      Month selection takes precedence
                    </span>
                  )}
                </label>
                <select
                  disabled={isMonthActive}
                  value={viewReportAs}
                  onChange={(e) => onViewReportAsChange(e.target.value)}
                  className={`w-full px-3 py-2 text-xs rounded-lg border transition-colors ${
                    isMonthActive
                      ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-white border-gray-300 text-gray-800 focus:outline-none focus:ring-1 focus:ring-teal-500'
                  }`}
                >
                  {VIEW_AS_OPTIONS.map(opt => (
                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Custom Date Pickers (Visible when custom is selected) */}
              {(!isMonthActive && viewReportAs === 'custom') && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => onCustomStartDateChange(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => onCustomEndDateChange(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ADDITIONAL FILTERS SECTION */}
          <div>
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-gray-100">
              <span className="text-xs font-bold uppercase tracking-wider text-teal-800 flex items-center gap-1.5">
                <span>Additional Filters</span>
              </span>
              <span className="text-[11px] text-gray-400">
                Multi-select cross-filtering with cascading dependencies
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 1. Team Leader (Disabled on TL-wise tab) */}
              <MultiSelectDropdown
                label="Team Leader"
                options={filterOptions.team_leaders || []}
                selected={selectedTLs}
                onChange={onTLsChange}
                disabled={activeTab === 'tl'}
                disabledReason="Hidden: This tab aggregates by Team Leader"
                placeholder="All Team Leaders"
              />

              {/* 2. BD Member (Disabled on BD-wise tab) */}
              <MultiSelectDropdown
                label="BD Member"
                options={filterOptions.bd_members || []}
                selected={selectedBDs}
                onChange={onBDsChange}
                disabled={activeTab === 'bd'}
                disabledReason="Hidden: This tab aggregates by BD Member"
                placeholder="All BD Members"
              />

              {/* 3. Franchise (Disabled on Franchise-wise tab) */}
              <MultiSelectDropdown
                label="Franchise"
                options={filterOptions.franchises || []}
                selected={selectedFranchises}
                onChange={onFranchisesChange}
                disabled={activeTab === 'franchise'}
                disabledReason="Hidden: This tab aggregates by Franchise"
                placeholder="All Franchises"
              />

              {/* 4. Industry (Disabled on Industry-wise tab) */}
              <MultiSelectDropdown
                label="Industry"
                options={filterOptions.industries || []}
                selected={selectedIndustries}
                onChange={onIndustriesChange}
                disabled={activeTab === 'industry'}
                disabledReason="Hidden: This tab aggregates by Industry"
                placeholder="All Industries"
              />

              {/* 5. Sub Industry (Cascaded by selected Industry, disabled on Industry tab) */}
              <MultiSelectDropdown
                label="Sub Industry"
                options={filterOptions.sub_industries || []}
                selected={selectedSubIndustries}
                onChange={onSubIndustriesChange}
                disabled={activeTab === 'industry'}
                disabledReason="Hidden: This tab aggregates by Industry"
                placeholder="All Sub Industries"
              />

              {/* 6. City (Disabled on City-wise tab) */}
              <MultiSelectDropdown
                label="City"
                options={filterOptions.cities || []}
                selected={selectedCities}
                onChange={onCitiesChange}
                disabled={activeTab === 'city'}
                disabledReason="Hidden: This tab aggregates by City"
                placeholder="All Cities"
              />

              {/* 7. Client Status */}
              <MultiSelectDropdown
                label="Client Status"
                options={filterOptions.client_statuses || []}
                selected={selectedClientStatuses}
                onChange={onClientStatusesChange}
                placeholder="All Client Statuses"
              />

              {/* 8. Enquiry Status */}
              <MultiSelectDropdown
                label="Enquiry Status"
                options={filterOptions.enquiry_statuses || []}
                selected={selectedEnquiryStatuses}
                onChange={onEnquiryStatusesChange}
                placeholder="All Enquiry Statuses"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
