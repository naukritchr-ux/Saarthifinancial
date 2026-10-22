import React, { useState, useEffect, useMemo, useContext, useCallback, useRef } from 'react';
import { FinanceContext, API_BASE_URL } from '../context/FinanceContext';
import { fetchWithApiKey } from '../utils/apiClient';
import { formatCurrency, formatDate } from '../utils/formatters';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Users, 
  Building, 
  MapPin, 
  Briefcase, 
  SlidersHorizontal, 
  Download, 
  Search, 
  ArrowUpDown, 
  ChevronRight, 
  X, 
  Sparkles, 
  Target, 
  Zap, 
  Check, 
  Layers,
  Filter,
  ChevronDown,
  CheckCircle2,
  Calendar,
  RotateCcw
} from 'lucide-react';
import Pagination from '../components/Pagination';
import AuditDrawer from '../components/AuditDrawer';

/**
 * Universal Cost of Performance Page
 * Answers unit-economics, cost drag, and profitability across:
 * BD-wise, Team Leader-wise, Franchise-wise, City-wise, and Industry-wise.
 */
const CostOfPerformance = () => {
  const { currentUser, userRole, selectedMonth: globalMonth, selectedYear: globalYear } = useContext(FinanceContext);

  // Normalize global period
  const cleanMonth = useMemo(() => {
    const raw = (globalMonth || '2026-08').trim();
    const lower = raw.toLowerCase();
    if (lower === 'all months' || lower === 'all') return 'all';
    if (raw.includes(' ')) {
      const parts = raw.split(' ');
      const mNames = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
      const mIdx = mNames.indexOf(parts[0].toLowerCase());
      if (mIdx !== -1 && parts[1]) {
        return `${parts[1]}-${String(mIdx + 1).padStart(2, '0')}`;
      }
    }
    return raw;
  }, [globalMonth]);

  const cleanFy = useMemo(() => {
    return (globalYear || '2026-2027').trim();
  }, [globalYear]);

  // Read initial state from URL search params
  const urlParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const initialTab = urlParams.get('tab') || 'bd';
  const initialVerdict = urlParams.get('verdict') || 'all';

  // Core Dimension State: 'bd' | 'tl' | 'franchise' | 'city' | 'industry'
  const [activeDimension, setActiveDimension] = useState(initialTab);

  // Filter States
  const [activeVerdict, setActiveVerdict] = useState(initialVerdict);
  const [selectedTls, setSelectedTls] = useState(() => urlParams.get('tl') ? urlParams.get('tl').split(',') : []);
  const [selectedFranchises, setSelectedFranchises] = useState(() => urlParams.get('franchise') ? urlParams.get('franchise').split(',') : []);
  const [selectedCities, setSelectedCities] = useState(() => urlParams.get('city') ? urlParams.get('city').split(',') : []);
  const [selectedIndustries, setSelectedIndustries] = useState(() => urlParams.get('industry') ? urlParams.get('industry').split(',') : []);

  // More Filters
  const [hasCreditNotes, setHasCreditNotes] = useState(() => urlParams.get('has_cn') === '1' ? true : (urlParams.get('has_cn') === '0' ? false : null));
  const [minCreditNotes, setMinCreditNotes] = useState(() => urlParams.get('min_cn') || '');
  const [minPlacements, setMinPlacements] = useState(() => urlParams.get('min_placements') || '');
  const [minNet, setMinNet] = useState(() => urlParams.get('min_net') || '');
  const [maxNet, setMaxNet] = useState(() => urlParams.get('max_net') || '');
  const [selectedSegment, setSelectedSegment] = useState(() => urlParams.get('segment') || 'all');

  // Search & Debounce
  const [searchTerm, setSearchTerm] = useState(() => urlParams.get('search') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(searchTerm);

  // Sorting State
  const [sortField, setSortField] = useState(() => urlParams.get('sort') || 'net');
  const [sortDirection, setSortDirection] = useState(() => urlParams.get('sort_dir') || 'desc');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25); // Default 25 so all 15 BDs are directly visible

  // UI Popovers / Dropdowns
  const [activeDropdown, setActiveDropdown] = useState(null); // 'tl' | 'franchise' | 'city' | 'industry' | null
  const [isMoreFiltersOpen, setIsMoreFiltersOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Audit Drawer State
  const [selectedAuditEntity, setSelectedAuditEntity] = useState(null);
  const [isAuditDrawerOpen, setIsAuditDrawerOpen] = useState(false);

  // Cost Inputs Modal State
  const [isInputModalOpen, setIsInputModalOpen] = useState(false);
  const [costInputs, setCostInputs] = useState({
    defaultBdSalary: 30000,
    defaultTlSalary: 75000,
    overheadPool: 120000,
    allocationMethod: 'revenue_share'
  });

  // Backend Data State
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 300ms Debounce on Search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Click outside to close open dropdown popovers
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setActiveDropdown(null);
        setIsMoreFiltersOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch from Flask Backend
  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qParams = new URLSearchParams({
        entity: activeDimension,
        month: cleanMonth,
        fy: cleanFy,
        verdict: activeVerdict !== 'all' ? activeVerdict : '',
        tl: selectedTls.join(','),
        franchise: selectedFranchises.join(','),
        city: selectedCities.join(','),
        industry: selectedIndustries.join(','),
        has_cn: hasCreditNotes !== null ? (hasCreditNotes ? '1' : '0') : '',
        min_cn: minCreditNotes || '',
        min_placements: minPlacements || '',
        min_net: minNet || '',
        max_net: maxNet || '',
        segment: selectedSegment !== 'all' ? selectedSegment : '',
        search: debouncedSearch,
        sort: sortField,
        sort_dir: sortDirection
      });

      const endpoint = `${API_BASE_URL}/cost-performance?${qParams.toString()}`;
      const res = await fetchWithApiKey(endpoint);
      if (res && res.success) {
        setReportData(res);
      } else {
        throw new Error(res?.error || 'Failed to fetch cost of performance data');
      }
    } catch (err) {
      console.error("[CostOfPerformance] Fetch Error:", err);
      setError(err.message || 'Error connecting to cost engine');
    } finally {
      setLoading(false);
    }
  }, [
    activeDimension,
    cleanMonth,
    cleanFy,
    activeVerdict,
    selectedTls,
    selectedFranchises,
    selectedCities,
    selectedIndustries,
    hasCreditNotes,
    minCreditNotes,
    minPlacements,
    minNet,
    maxNet,
    selectedSegment,
    debouncedSearch,
    sortField,
    sortDirection
  ]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // Synchronize URL query params
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', activeDimension);
    if (activeVerdict && activeVerdict !== 'all') url.searchParams.set('verdict', activeVerdict);
    else url.searchParams.delete('verdict');

    if (selectedTls.length > 0) url.searchParams.set('tl', selectedTls.join(','));
    else url.searchParams.delete('tl');

    if (selectedFranchises.length > 0) url.searchParams.set('franchise', selectedFranchises.join(','));
    else url.searchParams.delete('franchise');

    if (selectedCities.length > 0) url.searchParams.set('city', selectedCities.join(','));
    else url.searchParams.delete('city');

    if (selectedIndustries.length > 0) url.searchParams.set('industry', selectedIndustries.join(','));
    else url.searchParams.delete('industry');

    if (hasCreditNotes !== null) url.searchParams.set('has_cn', hasCreditNotes ? '1' : '0');
    else url.searchParams.delete('has_cn');

    if (minCreditNotes) url.searchParams.set('min_cn', minCreditNotes);
    else url.searchParams.delete('min_cn');

    if (minPlacements) url.searchParams.set('min_placements', minPlacements);
    else url.searchParams.delete('min_placements');

    if (minNet) url.searchParams.set('min_net', minNet);
    else url.searchParams.delete('min_net');

    if (maxNet) url.searchParams.set('max_net', maxNet);
    else url.searchParams.delete('max_net');

    if (selectedSegment && selectedSegment !== 'all') url.searchParams.set('segment', selectedSegment);
    else url.searchParams.delete('segment');

    if (debouncedSearch) url.searchParams.set('search', debouncedSearch);
    else url.searchParams.delete('search');

    url.searchParams.set('sort', sortField);
    url.searchParams.set('sort_dir', sortDirection);

    window.history.replaceState({}, '', url.toString());
  }, [
    activeDimension,
    activeVerdict,
    selectedTls,
    selectedFranchises,
    selectedCities,
    selectedIndustries,
    hasCreditNotes,
    minCreditNotes,
    minPlacements,
    minNet,
    maxNet,
    selectedSegment,
    debouncedSearch,
    sortField,
    sortDirection
  ]);

  // Tab Change Handler: Resets dimension-specific filters that no longer apply
  const handleDimensionChange = (dim) => {
    setActiveDimension(dim);
    setCurrentPage(1);
    // Reset filters that don't apply to the new tab
    if (dim === 'tl') setSelectedTls([]);
    if (dim === 'franchise') setSelectedFranchises([]);
    if (dim === 'city') setSelectedCities([]);
    if (dim === 'industry') setSelectedIndustries([]);
  };

  // Sort Handler
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    setCurrentPage(1);
  };

  // Clear All Filters Handler
  const handleClearAllFilters = () => {
    setActiveVerdict('all');
    setSelectedTls([]);
    setSelectedFranchises([]);
    setSelectedCities([]);
    setSelectedIndustries([]);
    setHasCreditNotes(null);
    setMinCreditNotes('');
    setMinPlacements('');
    setMinNet('');
    setMaxNet('');
    setSelectedSegment('all');
    setSearchTerm('');
    setDebouncedSearch('');
    setCurrentPage(1);
  };

  // More Filters Active Counter
  const activeMoreFiltersCount = useMemo(() => {
    let count = 0;
    if (hasCreditNotes !== null) count++;
    if (minCreditNotes) count++;
    if (minPlacements) count++;
    if (minNet) count++;
    if (maxNet) count++;
    if (selectedSegment && selectedSegment !== 'all') count++;
    return count;
  }, [hasCreditNotes, minCreditNotes, minPlacements, minNet, maxNet, selectedSegment]);

  // Total Active Filters Boolean
  const isAnyFilterActive = useMemo(() => {
    return (
      activeVerdict !== 'all' ||
      selectedTls.length > 0 ||
      selectedFranchises.length > 0 ||
      selectedCities.length > 0 ||
      selectedIndustries.length > 0 ||
      activeMoreFiltersCount > 0 ||
      Boolean(debouncedSearch)
    );
  }, [
    activeVerdict,
    selectedTls,
    selectedFranchises,
    selectedCities,
    selectedIndustries,
    activeMoreFiltersCount,
    debouncedSearch
  ]);

  // Data Extraction
  const allRows = reportData?.rows || [];
  const totals = reportData?.totals || {
    billed: 0,
    companyShare: 0,
    costOfExecution: 0,
    churnCost: 0,
    netContribution: 0,
    placements: 0,
    marginPct: 0,
    is_filtered: false
  };

  const verdictCounts = reportData?.verdict_counts || {
    all: 0,
    star: 0,
    healthy: 0,
    breakeven: 0,
    at_risk: 0,
    loss: 0
  };

  const filterOptions = reportData?.filter_options || {
    team_leaders: [],
    franchises: [],
    cities: [],
    industries: []
  };

  // Pagination Slice
  const paginatedData = useMemo(() => {
    if (itemsPerPage === 'all') return allRows;
    const start = (currentPage - 1) * itemsPerPage;
    return allRows.slice(start, start + itemsPerPage);
  }, [allRows, currentPage, itemsPerPage]);

  const totalPages = itemsPerPage === 'all' ? 1 : Math.ceil(allRows.length / itemsPerPage);

  // Row Click -> Open Universal Audit Drawer
  const handleRowClick = (item) => {
    setSelectedAuditEntity(item);
    setIsAuditDrawerOpen(true);
  };

  // CSV Export for Filtered Rows
  const handleExportCSV = () => {
    if (allRows.length === 0) return;
    const headers = [
      'Rank',
      'Entity Name',
      'Role / Segment',
      'Placements',
      'Enquiries Handled',
      'Gross Billed (INR)',
      'Company Share (INR)',
      'Cost of Execution (INR)',
      'Direct Payroll (INR)',
      'Credit Notes (INR)',
      'Net Bank Contribution (INR)',
      'Net Margin (%)',
      'Verdict'
    ];

    const csvRows = allRows.map((r, i) => [
      r.rank || (i + 1),
      `"${r.dimension_value || ''}"`,
      `"${r.role || r.segment || ''}"`,
      r.placements || 0,
      r.enquiries || 0,
      r.total_billed || 0,
      r.company_share || 0,
      r.costOfExecution || 0,
      r.direct_cost || 0,
      r.churnCost || 0,
      r.netContribution || 0,
      `${r.netMarginPct || 0}%`,
      `"${r.verdict_label || ''}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...csvRows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Fintective_Cost_Of_Performance_${activeDimension}_${cleanMonth}_${cleanFy}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="analytics-page" style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto', minHeight: '100vh' }}>
      
      {/* 1. Header Bar with Global Period Sync & Clean Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: 'var(--accent-teal, #0F6E56)', color: '#ffffff', padding: '6px 10px', borderRadius: '8px', display: 'flex', alignItems: 'center' }}>
              <DollarSign size={20} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.45rem', fontWeight: '800', color: 'var(--text-main)' }}>
                Cost of Performance
              </h1>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Talent Corner HR Services • Commercial Viability & Unit Economics Engine
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Synchronized Global Period Indicator Badge */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 14px',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-card)',
            color: 'var(--text-main)',
            fontSize: '0.82rem',
            fontWeight: '700'
          }}>
            <Calendar size={14} style={{ color: 'var(--accent-teal, #0F6E56)' }} />
            <span>
              {cleanMonth === 'all' 
                ? `FY ${cleanFy} (Full Year)` 
                : `${cleanMonth} • FY ${cleanFy}`}
            </span>
          </div>

          {/* Cost Inputs Button */}
          {userRole !== 'franchise_partner' && (
            <button
              onClick={() => setIsInputModalOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-card)',
                color: 'var(--text-main)',
                fontSize: '0.82rem',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              <SlidersHorizontal size={14} />
              <span>Cost Inputs</span>
            </button>
          )}

          {/* Export Filtered CSV */}
          <button
            onClick={handleExportCSV}
            disabled={allRows.length === 0}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              background: allRows.length === 0 ? 'var(--text-muted)' : 'var(--accent-teal, #0F6E56)',
              color: '#ffffff',
              fontSize: '0.82rem',
              fontWeight: '700',
              cursor: allRows.length === 0 ? 'not-allowed' : 'pointer'
            }}
          >
            <Download size={14} />
            <span>Export Report</span>
          </button>
        </div>
      </div>

      {/* 2. Top Executive KPI Cards (Reflects Active Filters with Filtered Tag) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '22px' }}>
        
        {/* Card 1: Total Company Share */}
        <div style={{ background: 'var(--bg-card)', padding: '18px 20px', borderRadius: '12px', border: '1px solid var(--border-color)', borderLeft: '4px solid #0F6E56', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              1. Company Share (Revenue)
            </span>
            <DollarSign size={16} color="#0F6E56" />
          </div>
          <div style={{ fontSize: '1.55rem', fontWeight: '800', color: 'var(--text-main)' }}>
            {formatCurrency(totals.companyShare)}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Gross: {formatCurrency(totals.billed)} ({totals.placements} deals)
            </span>
            {totals.is_filtered && (
              <span style={{ fontSize: '0.66rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(15, 110, 86, 0.1)', color: '#0F6E56', fontWeight: '800' }}>
                ● Filtered
              </span>
            )}
          </div>
        </div>

        {/* Card 2: Cost of Execution */}
        {userRole !== 'franchise_partner' && (
          <div style={{ background: 'var(--bg-card)', padding: '18px 20px', borderRadius: '12px', border: '1px solid var(--border-color)', borderLeft: '4px solid #3B82F6', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '0.74rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                2. Cost of Execution
              </span>
              <Building size={16} color="#3B82F6" />
            </div>
            <div style={{ fontSize: '1.55rem', fontWeight: '800', color: '#3B82F6' }}>
              {formatCurrency(totals.costOfExecution)}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Direct Payroll + Overhead Pool
              </span>
              {totals.is_filtered && (
                <span style={{ fontSize: '0.66rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(59, 130, 246, 0.1)', color: '#2563EB', fontWeight: '800' }}>
                  ● Filtered
                </span>
              )}
            </div>
          </div>
        )}

        {/* Card 3: Credit Note Write-offs */}
        <div style={{ background: 'var(--bg-card)', padding: '18px 20px', borderRadius: '12px', border: '1px solid var(--border-color)', borderLeft: '4px solid #F59E0B', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              3. Churn & Credit Notes
            </span>
            <AlertTriangle size={16} color="#F59E0B" />
          </div>
          <div style={{ fontSize: '1.55rem', fontWeight: '800', color: '#F59E0B' }}>
            {formatCurrency(totals.churnCost)}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Reversed client billings
            </span>
            {totals.is_filtered && (
              <span style={{ fontSize: '0.66rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.1)', color: '#D97706', fontWeight: '800' }}>
                ● Filtered
              </span>
            )}
          </div>
        </div>

        {/* Card 4: Net Bank Contribution */}
        <div style={{ 
          background: totals.netContribution >= 0 ? 'rgba(16, 185, 129, 0.06)' : 'rgba(239, 68, 68, 0.06)', 
          padding: '18px 20px', 
          borderRadius: '12px', 
          border: `1px solid ${totals.netContribution >= 0 ? '#10B981' : '#EF4444'}`,
          borderLeft: `5px solid ${totals.netContribution >= 0 ? '#10B981' : '#EF4444'}`,
          position: 'relative'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: '800', color: totals.netContribution >= 0 ? '#059669' : '#DC2626', textTransform: 'uppercase' }}>
              4. Net Bank Contribution
            </span>
            <TrendingUp size={16} color={totals.netContribution >= 0 ? '#10B981' : '#EF4444'} />
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: '800', color: totals.netContribution >= 0 ? '#10B981' : '#EF4444' }}>
            {totals.netContribution >= 0 ? '+' : ''}{formatCurrency(totals.netContribution)}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: '700', color: totals.netContribution >= 0 ? '#047857' : '#B91C1C' }}>
              Margin: {totals.marginPct}%
            </span>
            {totals.is_filtered && (
              <span style={{ fontSize: '0.66rem', padding: '1px 6px', borderRadius: '4px', background: totals.netContribution >= 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: totals.netContribution >= 0 ? '#047857' : '#B91C1C', fontWeight: '800' }}>
                ● Filtered
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 3. Five Primary Navigation Tabs */}
      <div style={{ 
        background: 'var(--bg-card)', 
        borderRadius: '12px', 
        padding: '12px 16px', 
        border: '1px solid var(--border-color)', 
        marginBottom: '14px',
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap'
      }}>
        {[
          { id: 'bd', label: '👤 BD-wise', desc: 'Recruiters & Closers' },
          { id: 'tl', label: '👥 Team Leader-wise', desc: 'Franchise Network Managers' },
          { id: 'franchise', label: '🏢 Franchise-wise', desc: 'Partner Production' },
          { id: 'city', label: '📍 City-wise', desc: 'Regional Profitability' },
          { id: 'industry', label: '🏭 Industry-wise', desc: 'Vertical Margins' }
        ].map(dim => {
          const isActive = activeDimension === dim.id;
          return (
            <button
              key={dim.id}
              onClick={() => handleDimensionChange(dim.id)}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: isActive ? '1px solid var(--accent-teal, #0F6E56)' : '1px solid var(--border-color)',
                background: isActive ? 'var(--accent-teal, #0F6E56)' : 'var(--bg-main)',
                color: isActive ? '#ffffff' : 'var(--text-main)',
                fontSize: '0.82rem',
                fontWeight: isActive ? '800' : '600',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>{dim.label}</span>
            </button>
          );
        })}
      </div>

      {/* 4. Single-Row Filter Bar (Verdict Chips + Contextual Dropdowns + More Filters + Search) */}
      <div ref={dropdownRef} style={{ 
        background: 'var(--bg-card)', 
        borderRadius: '12px', 
        padding: '14px 18px', 
        border: '1px solid var(--border-color)', 
        marginBottom: '14px',
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
        position: 'relative'
      }}>
        
        {/* A. Verdict Chips with Counts (Hiding 0 counts) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: 'All', count: verdictCounts.all, color: 'var(--accent-teal, #0F6E56)' },
            { id: 'star', label: 'Star Performer', count: verdictCounts.star, color: '#10B981' },
            { id: 'healthy', label: 'Healthy', count: verdictCounts.healthy, color: '#059669' },
            { id: 'breakeven', label: 'Break-even', count: verdictCounts.breakeven, color: '#F59E0B' },
            { id: 'at_risk', label: 'At Risk', count: verdictCounts.at_risk, color: '#EA580C' },
            { id: 'loss', label: 'Loss Drain', count: verdictCounts.loss, color: '#DC2626' }
          ].map(chip => {
            // Hide chips with 0 rows, except 'all'
            if (chip.id !== 'all' && chip.count === 0) return null;
            const isSelected = activeVerdict === chip.id;

            return (
              <button
                key={chip.id}
                onClick={() => { setActiveVerdict(chip.id); setCurrentPage(1); }}
                style={{
                  padding: '5px 12px',
                  borderRadius: '20px',
                  border: isSelected ? `1.5px solid ${chip.color}` : '1px solid var(--border-color)',
                  background: isSelected ? chip.color : 'var(--bg-main)',
                  color: isSelected ? '#ffffff' : 'var(--text-main)',
                  fontSize: '0.74rem',
                  fontWeight: isSelected ? '800' : '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>{chip.label}</span>
                <span style={{
                  padding: '1px 6px',
                  borderRadius: '10px',
                  background: isSelected ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.06)',
                  color: isSelected ? '#ffffff' : 'var(--text-muted)',
                  fontSize: '0.68rem',
                  fontWeight: '700'
                }}>
                  {chip.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Divider */}
        <div style={{ width: '1px', height: '24px', background: 'var(--border-color)' }} />

        {/* B. Contextual Cross-Filter Dropdowns */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          
          {/* 1. Team Leader Dropdown (On BD, Franchise, City, Industry tabs) */}
          {activeDimension !== 'tl' && filterOptions.team_leaders.length > 0 && (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => { setActiveDropdown(activeDropdown === 'tl' ? null : 'tl'); setIsMoreFiltersOpen(false); }}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: selectedTls.length > 0 ? '1px solid var(--accent-teal, #0F6E56)' : '1px solid var(--border-color)',
                  background: selectedTls.length > 0 ? 'rgba(15, 110, 86, 0.08)' : 'var(--bg-main)',
                  color: selectedTls.length > 0 ? 'var(--accent-teal, #0F6E56)' : 'var(--text-main)',
                  fontSize: '0.75rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>Team Leader {selectedTls.length > 0 && `(${selectedTls.length})`}</span>
                <ChevronDown size={13} />
              </button>

              {activeDropdown === 'tl' && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: '6px',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                  padding: '10px',
                  minWidth: '220px',
                  zIndex: 200,
                  maxHeight: '260px',
                  overflowY: 'auto'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--text-muted)' }}>SELECT TEAM LEADER</span>
                    {selectedTls.length > 0 && (
                      <button onClick={() => setSelectedTls([])} style={{ border: 'none', background: 'transparent', color: '#DC2626', fontSize: '0.7rem', fontWeight: '700', cursor: 'pointer' }}>
                        Clear
                      </button>
                    )}
                  </div>
                  {filterOptions.team_leaders.map(tl => {
                    const isChecked = selectedTls.includes(tl);
                    return (
                      <label key={tl} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 4px', fontSize: '0.75rem', color: 'var(--text-main)', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            setSelectedTls(prev => isChecked ? prev.filter(x => x !== tl) : [...prev, tl]);
                            setCurrentPage(1);
                          }}
                        />
                        <span>{tl}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 2. Franchise Dropdown (On BD, TL, City, Industry tabs) */}
          {activeDimension !== 'franchise' && filterOptions.franchises.length > 0 && (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => { setActiveDropdown(activeDropdown === 'franchise' ? null : 'franchise'); setIsMoreFiltersOpen(false); }}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: selectedFranchises.length > 0 ? '1px solid var(--accent-teal, #0F6E56)' : '1px solid var(--border-color)',
                  background: selectedFranchises.length > 0 ? 'rgba(15, 110, 86, 0.08)' : 'var(--bg-main)',
                  color: selectedFranchises.length > 0 ? 'var(--accent-teal, #0F6E56)' : 'var(--text-main)',
                  fontSize: '0.75rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>Franchise {selectedFranchises.length > 0 && `(${selectedFranchises.length})`}</span>
                <ChevronDown size={13} />
              </button>

              {activeDropdown === 'franchise' && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: '6px',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                  padding: '10px',
                  minWidth: '220px',
                  zIndex: 200,
                  maxHeight: '260px',
                  overflowY: 'auto'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--text-muted)' }}>SELECT FRANCHISE</span>
                    {selectedFranchises.length > 0 && (
                      <button onClick={() => setSelectedFranchises([])} style={{ border: 'none', background: 'transparent', color: '#DC2626', fontSize: '0.7rem', fontWeight: '700', cursor: 'pointer' }}>
                        Clear
                      </button>
                    )}
                  </div>
                  {filterOptions.franchises.slice(0, 30).map(f => {
                    const isChecked = selectedFranchises.includes(f);
                    return (
                      <label key={f} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 4px', fontSize: '0.75rem', color: 'var(--text-main)', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            setSelectedFranchises(prev => isChecked ? prev.filter(x => x !== f) : [...prev, f]);
                            setCurrentPage(1);
                          }}
                        />
                        <span>{f}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 3. City Dropdown (On BD, TL, Franchise, Industry tabs) */}
          {activeDimension !== 'city' && filterOptions.cities.length > 0 && (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => { setActiveDropdown(activeDropdown === 'city' ? null : 'city'); setIsMoreFiltersOpen(false); }}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: selectedCities.length > 0 ? '1px solid var(--accent-teal, #0F6E56)' : '1px solid var(--border-color)',
                  background: selectedCities.length > 0 ? 'rgba(15, 110, 86, 0.08)' : 'var(--bg-main)',
                  color: selectedCities.length > 0 ? 'var(--accent-teal, #0F6E56)' : 'var(--text-main)',
                  fontSize: '0.75rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>City {selectedCities.length > 0 && `(${selectedCities.length})`}</span>
                <ChevronDown size={13} />
              </button>

              {activeDropdown === 'city' && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: '6px',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                  padding: '10px',
                  minWidth: '200px',
                  zIndex: 200,
                  maxHeight: '260px',
                  overflowY: 'auto'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--text-muted)' }}>SELECT CITY</span>
                    {selectedCities.length > 0 && (
                      <button onClick={() => setSelectedCities([])} style={{ border: 'none', background: 'transparent', color: '#DC2626', fontSize: '0.7rem', fontWeight: '700', cursor: 'pointer' }}>
                        Clear
                      </button>
                    )}
                  </div>
                  {filterOptions.cities.map(c => {
                    const isChecked = selectedCities.includes(c);
                    return (
                      <label key={c} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 4px', fontSize: '0.75rem', color: 'var(--text-main)', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            setSelectedCities(prev => isChecked ? prev.filter(x => x !== c) : [...prev, c]);
                            setCurrentPage(1);
                          }}
                        />
                        <span>{c}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 4. Industry Dropdown (On BD, TL, Franchise, City tabs) */}
          {activeDimension !== 'industry' && filterOptions.industries.length > 0 && (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => { setActiveDropdown(activeDropdown === 'industry' ? null : 'industry'); setIsMoreFiltersOpen(false); }}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: selectedIndustries.length > 0 ? '1px solid var(--accent-teal, #0F6E56)' : '1px solid var(--border-color)',
                  background: selectedIndustries.length > 0 ? 'rgba(15, 110, 86, 0.08)' : 'var(--bg-main)',
                  color: selectedIndustries.length > 0 ? 'var(--accent-teal, #0F6E56)' : 'var(--text-main)',
                  fontSize: '0.75rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>Industry {selectedIndustries.length > 0 && `(${selectedIndustries.length})`}</span>
                <ChevronDown size={13} />
              </button>

              {activeDropdown === 'industry' && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: '6px',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                  padding: '10px',
                  minWidth: '240px',
                  zIndex: 200,
                  maxHeight: '260px',
                  overflowY: 'auto'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: '800', color: 'var(--text-muted)' }}>SELECT INDUSTRY</span>
                    {selectedIndustries.length > 0 && (
                      <button onClick={() => setSelectedIndustries([])} style={{ border: 'none', background: 'transparent', color: '#DC2626', fontSize: '0.7rem', fontWeight: '700', cursor: 'pointer' }}>
                        Clear
                      </button>
                    )}
                  </div>
                  {filterOptions.industries.map(ind => {
                    const isChecked = selectedIndustries.includes(ind);
                    return (
                      <label key={ind} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 4px', fontSize: '0.75rem', color: 'var(--text-main)', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            setSelectedIndustries(prev => isChecked ? prev.filter(x => x !== ind) : [...prev, ind]);
                            setCurrentPage(1);
                          }}
                        />
                        <span>{ind}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* C. "More Filters" Popover Trigger */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => { setIsMoreFiltersOpen(!isMoreFiltersOpen); setActiveDropdown(null); }}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: activeMoreFiltersCount > 0 ? '1px solid var(--accent-teal, #0F6E56)' : '1px solid var(--border-color)',
                background: activeMoreFiltersCount > 0 ? 'rgba(15, 110, 86, 0.08)' : 'var(--bg-main)',
                color: activeMoreFiltersCount > 0 ? 'var(--accent-teal, #0F6E56)' : 'var(--text-main)',
                fontSize: '0.75rem',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Filter size={13} />
              <span>More Filters</span>
              {activeMoreFiltersCount > 0 && (
                <span style={{
                  padding: '1px 6px',
                  borderRadius: '10px',
                  background: 'var(--accent-teal, #0F6E56)',
                  color: '#ffffff',
                  fontSize: '0.66rem',
                  fontWeight: '800'
                }}>
                  {activeMoreFiltersCount}
                </span>
              )}
            </button>

            {/* More Filters Popover Content */}
            {isMoreFiltersOpen && (
              <div style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '6px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                boxShadow: '0 8px 28px rgba(0,0,0,0.22)',
                padding: '16px',
                width: '300px',
                zIndex: 250,
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: '800', color: 'var(--text-main)' }}>ADDITIONAL FILTERS</span>
                  <button
                    onClick={() => {
                      setHasCreditNotes(null);
                      setMinCreditNotes('');
                      setMinPlacements('');
                      setMinNet('');
                      setMaxNet('');
                      setSelectedSegment('all');
                    }}
                    style={{ border: 'none', background: 'transparent', color: '#DC2626', fontSize: '0.7rem', fontWeight: '700', cursor: 'pointer' }}
                  >
                    Reset
                  </button>
                </div>

                {/* Has Credit Notes Toggle */}
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.76rem', color: 'var(--text-main)', cursor: 'pointer' }}>
                    <span>Has Credit Notes / Reversals</span>
                    <input
                      type="checkbox"
                      checked={hasCreditNotes === true}
                      onChange={(e) => setHasCreditNotes(e.target.checked ? true : null)}
                    />
                  </label>
                  {hasCreditNotes && (
                    <input
                      type="number"
                      placeholder="Min CN Amount (₹)"
                      value={minCreditNotes}
                      onChange={(e) => setMinCreditNotes(e.target.value)}
                      style={{
                        marginTop: '6px',
                        width: '100%',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-main)',
                        color: 'var(--text-main)',
                        fontSize: '0.75rem'
                      }}
                    />
                  )}
                </div>

                {/* Min Placements */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Min Placements (Deals)
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 5 deals"
                    value={minPlacements}
                    onChange={(e) => setMinPlacements(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-main)',
                      color: 'var(--text-main)',
                      fontSize: '0.75rem'
                    }}
                  />
                </div>

                {/* Net Contribution Min/Max */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Net Contribution Range (₹)
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="number"
                      placeholder="Min ₹"
                      value={minNet}
                      onChange={(e) => setMinNet(e.target.value)}
                      style={{
                        width: '50%',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-main)',
                        color: 'var(--text-main)',
                        fontSize: '0.74rem'
                      }}
                    />
                    <input
                      type="number"
                      placeholder="Max ₹"
                      value={maxNet}
                      onChange={(e) => setMaxNet(e.target.value)}
                      style={{
                        width: '50%',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-main)',
                        color: 'var(--text-main)',
                        fontSize: '0.74rem'
                      }}
                    />
                  </div>
                </div>

                {/* Segment Filter (if BD tab) */}
                {activeDimension === 'bd' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                      Segment / Tier
                    </label>
                    <select
                      value={selectedSegment}
                      onChange={(e) => setSelectedSegment(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-main)',
                        color: 'var(--text-main)',
                        fontSize: '0.75rem'
                      }}
                    >
                      <option value="all">All Segments</option>
                      <option value="key account">Key Account</option>
                      <option value="enterprise">Enterprise</option>
                      <option value="regular">Regular</option>
                    </select>
                  </div>
                )}

                <button
                  onClick={() => setIsMoreFiltersOpen(false)}
                  style={{
                    padding: '8px',
                    borderRadius: '6px',
                    border: 'none',
                    background: 'var(--accent-teal, #0F6E56)',
                    color: '#ffffff',
                    fontSize: '0.76rem',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  Apply Filters
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Divider */}
        <div style={{ width: '1px', height: '24px', background: 'var(--border-color)' }} />

        {/* D. Sort Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <select
            value={sortField}
            onChange={(e) => { setSortField(e.target.value); setCurrentPage(1); }}
            style={{
              padding: '6px 10px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-main)',
              color: 'var(--text-main)',
              fontSize: '0.75rem',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            <option value="net">Sort: Net Contribution</option>
            <option value="cn">Sort: Credit Notes</option>
            <option value="placements">Sort: Placements</option>
            {activeDimension === 'bd' && <option value="net_per_enquiry">Sort: Net / Enquiry</option>}
            {activeDimension === 'tl' && <option value="net_per_franchise">Sort: Net / Store</option>}
            <option value="company_share">Sort: Company Share</option>
          </select>

          <button
            onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
            title={`Direction: ${sortDirection.toUpperCase()}`}
            style={{
              padding: '6px 8px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-main)',
              color: 'var(--text-main)',
              fontSize: '0.75rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <ArrowUpDown size={14} />
          </button>
        </div>

        {/* E. Debounced Search Box */}
        <div style={{ position: 'relative', marginLeft: 'auto' }}>
          <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder={`Search ${activeDimension.toUpperCase()}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              padding: '6px 28px 6px 28px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-main)',
              color: 'var(--text-main)',
              fontSize: '0.78rem',
              width: '180px'
            }}
          />
          {searchTerm && (
            <X 
              size={12} 
              onClick={() => { setSearchTerm(''); setDebouncedSearch(''); }} 
              style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: 'var(--text-muted)' }} 
            />
          )}
        </div>
      </div>

      {/* 5. Active Filters Removable Chips Bar */}
      {isAnyFilterActive && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '14px', fontSize: '0.74rem' }}>
          <span style={{ color: 'var(--text-muted)', fontWeight: '700' }}>Active Filters:</span>

          {activeVerdict !== 'all' && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '4px', background: 'rgba(15,110,86,0.1)', color: '#0F6E56', fontWeight: '700' }}>
              Verdict: {activeVerdict}
              <X size={12} style={{ cursor: 'pointer' }} onClick={() => setActiveVerdict('all')} />
            </span>
          )}

          {selectedTls.map(tl => (
            <span key={tl} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '4px', background: 'rgba(59,130,246,0.1)', color: '#2563EB', fontWeight: '700' }}>
              TL: {tl}
              <X size={12} style={{ cursor: 'pointer' }} onClick={() => setSelectedTls(prev => prev.filter(x => x !== tl))} />
            </span>
          ))}

          {selectedFranchises.map(f => (
            <span key={f} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '4px', background: 'rgba(139,92,246,0.1)', color: '#7C3AED', fontWeight: '700' }}>
              Franchise: {f}
              <X size={12} style={{ cursor: 'pointer' }} onClick={() => setSelectedFranchises(prev => prev.filter(x => x !== f))} />
            </span>
          ))}

          {selectedCities.map(c => (
            <span key={c} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '4px', background: 'rgba(245,158,11,0.1)', color: '#D97706', fontWeight: '700' }}>
              City: {c}
              <X size={12} style={{ cursor: 'pointer' }} onClick={() => setSelectedCities(prev => prev.filter(x => x !== c))} />
            </span>
          ))}

          {selectedIndustries.map(ind => (
            <span key={ind} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '4px', background: 'rgba(16,185,129,0.1)', color: '#059669', fontWeight: '700' }}>
              Industry: {ind}
              <X size={12} style={{ cursor: 'pointer' }} onClick={() => setSelectedIndustries(prev => prev.filter(x => x !== ind))} />
            </span>
          ))}

          {hasCreditNotes !== null && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '4px', background: 'rgba(239,68,68,0.1)', color: '#DC2626', fontWeight: '700' }}>
              {hasCreditNotes ? 'Has Credit Notes' : 'No Credit Notes'}
              <X size={12} style={{ cursor: 'pointer' }} onClick={() => setHasCreditNotes(null)} />
            </span>
          )}

          {minPlacements && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '4px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-main)', fontWeight: '700' }}>
              Min Deals: {minPlacements}
              <X size={12} style={{ cursor: 'pointer' }} onClick={() => setMinPlacements('')} />
            </span>
          )}

          {debouncedSearch && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '4px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-main)', fontWeight: '700' }}>
              Search: "{debouncedSearch}"
              <X size={12} style={{ cursor: 'pointer' }} onClick={() => { setSearchTerm(''); setDebouncedSearch(''); }} />
            </span>
          )}

          <button
            onClick={handleClearAllFilters}
            style={{ border: 'none', background: 'transparent', color: 'var(--accent-teal, #0F6E56)', fontWeight: '800', cursor: 'pointer', textDecoration: 'underline', padding: '2px 6px' }}
          >
            Clear all filters
          </button>
        </div>
      )}

      {/* 6. Main Unit Economics Table */}
      <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden', marginBottom: '20px' }}>
        
        {/* Table Title Bar */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.01)' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '0.96rem', fontWeight: '800', color: 'var(--text-main)' }}>
              {activeDimension === 'bd' && 'BD Executive & Recruiter Unit Economics'}
              {activeDimension === 'tl' && 'Team Leader Network Economics & Normalized Franchise Production'}
              {activeDimension === 'franchise' && 'Franchise Partner Commercial Ledger'}
              {activeDimension === 'city' && 'City Regional Viability Ledger'}
              {activeDimension === 'industry' && 'Industry Vertical Profitability Margins'}
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              Sorted by <strong>{sortField === 'net' ? 'Net Contribution' : sortField}</strong> {sortDirection.toUpperCase()} • Click any row for deal-level drill-down
            </p>
          </div>
          <span style={{ fontSize: '0.76rem', fontWeight: '700', color: 'var(--text-muted)' }}>
            Showing {paginatedData.length} of {allRows.length} records
          </span>
        </div>

        {/* Table Content */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--bg-main)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '10px 14px', width: '50px' }}>Rank</th>
                <th 
                  onClick={() => handleSort('dimension_value')}
                  style={{ padding: '10px 14px', cursor: 'pointer', userSelect: 'none' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>{activeDimension === 'bd' ? 'BD Executive' : (activeDimension === 'tl' ? 'Team Leader' : (activeDimension === 'franchise' ? 'Franchise Partner' : (activeDimension === 'city' ? 'City' : 'Industry')))}</span>
                    <ArrowUpDown size={12} />
                  </div>
                </th>

                {/* Team Leader: Stores Count */}
                {activeDimension === 'tl' && (
                  <th 
                    onClick={() => handleSort('activeFranchises')}
                    style={{ padding: '10px 14px', cursor: 'pointer', textAlign: 'center', userSelect: 'none' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                      <span>Active Stores</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                )}

                <th 
                  onClick={() => handleSort('placements')}
                  style={{ padding: '10px 14px', cursor: 'pointer', textAlign: 'center', userSelect: 'none' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                    <span>Placements</span>
                    <ArrowUpDown size={12} />
                  </div>
                </th>

                {/* BD: Total Enquiries */}
                {activeDimension === 'bd' && (
                  <th 
                    onClick={() => handleSort('enquiries')}
                    style={{ padding: '10px 14px', cursor: 'pointer', textAlign: 'center', userSelect: 'none' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                      <span>Enquiries</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                )}

                <th 
                  onClick={() => handleSort('company_share')}
                  style={{ padding: '10px 14px', cursor: 'pointer', textAlign: 'right', userSelect: 'none' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                    <span>Company Share</span>
                    <ArrowUpDown size={12} />
                  </div>
                </th>

                {/* Franchise-wise View: Payouts */}
                {activeDimension === 'franchise' ? (
                  <th 
                    onClick={() => handleSort('franchisee_payout')}
                    style={{ padding: '10px 14px', cursor: 'pointer', textAlign: 'right', userSelect: 'none' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                      <span>Franchisee Payout</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                ) : (
                  <th 
                    onClick={() => handleSort('costOfExecution')}
                    style={{ padding: '10px 14px', cursor: 'pointer', textAlign: 'right', userSelect: 'none' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                      <span>Cost of Execution</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                )}

                <th 
                  onClick={() => handleSort('churnCost')}
                  style={{ padding: '10px 14px', cursor: 'pointer', textAlign: 'right', userSelect: 'none' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                    <span>Credit Notes</span>
                    <ArrowUpDown size={12} />
                  </div>
                </th>

                <th 
                  onClick={() => handleSort('netContribution')}
                  style={{ padding: '10px 14px', cursor: 'pointer', textAlign: 'right', userSelect: 'none' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                    <span>Net Contribution</span>
                    <ArrowUpDown size={12} />
                  </div>
                </th>

                {/* BD Specific: Net Surplus per Enquiry */}
                {activeDimension === 'bd' && (
                  <th 
                    onClick={() => handleSort('netSurplusPerEnquiry')}
                    style={{ padding: '10px 14px', cursor: 'pointer', textAlign: 'right', userSelect: 'none' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                      <span>Net / Enquiry</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                )}

                {/* TL Specific: Net Per Franchise */}
                {activeDimension === 'tl' && (
                  <th 
                    onClick={() => handleSort('netPerFranchise')}
                    style={{ padding: '10px 14px', cursor: 'pointer', textAlign: 'right', userSelect: 'none' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                      <span>Net / Store</span>
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                )}

                <th style={{ padding: '10px 14px', textAlign: 'center' }}>Verdict</th>
                <th style={{ padding: '10px 14px', textAlign: 'center' }}>Audit</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                // Skeleton Rows while Loading
                [...Array(6)].map((_, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '16px 14px' }}><div style={{ height: '14px', background: 'var(--bg-main)', borderRadius: '4px', width: '24px' }}></div></td>
                    <td style={{ padding: '16px 14px' }}><div style={{ height: '14px', background: 'var(--bg-main)', borderRadius: '4px', width: '160px' }}></div></td>
                    <td style={{ padding: '16px 14px' }}><div style={{ height: '14px', background: 'var(--bg-main)', borderRadius: '4px', width: '40px', margin: '0 auto' }}></div></td>
                    <td style={{ padding: '16px 14px' }}><div style={{ height: '14px', background: 'var(--bg-main)', borderRadius: '4px', width: '80px', marginLeft: 'auto' }}></div></td>
                    <td style={{ padding: '16px 14px' }}><div style={{ height: '14px', background: 'var(--bg-main)', borderRadius: '4px', width: '80px', marginLeft: 'auto' }}></div></td>
                    <td style={{ padding: '16px 14px' }}><div style={{ height: '14px', background: 'var(--bg-main)', borderRadius: '4px', width: '60px', marginLeft: 'auto' }}></div></td>
                    <td style={{ padding: '16px 14px' }}><div style={{ height: '14px', background: 'var(--bg-main)', borderRadius: '4px', width: '90px', marginLeft: 'auto' }}></div></td>
                    <td style={{ padding: '16px 14px' }}><div style={{ height: '14px', background: 'var(--bg-main)', borderRadius: '4px', width: '80px', margin: '0 auto' }}></div></td>
                    <td style={{ padding: '16px 14px' }}><div style={{ height: '14px', background: 'var(--bg-main)', borderRadius: '4px', width: '50px', margin: '0 auto' }}></div></td>
                  </tr>
                ))
              ) : paginatedData.length === 0 ? (
                // Empty State
                <tr>
                  <td colSpan={12} style={{ padding: '40px 20px', textAlign: 'center' }}>
                    <div style={{ maxWidth: '400px', margin: '0 auto', color: 'var(--text-muted)' }}>
                      <AlertTriangle size={32} style={{ margin: '0 auto 12px auto', color: '#F59E0B' }} />
                      <div style={{ fontSize: '0.96rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '6px' }}>
                        No results for these filters
                      </div>
                      <p style={{ fontSize: '0.78rem', lineHeight: '1.4', marginBottom: '16px' }}>
                        No records match the active combination of verdict, cross-filters, and search for this reporting period.
                      </p>
                      <button
                        onClick={handleClearAllFilters}
                        style={{
                          padding: '8px 18px',
                          borderRadius: '8px',
                          border: 'none',
                          background: 'var(--accent-teal, #0F6E56)',
                          color: '#ffffff',
                          fontSize: '0.78rem',
                          fontWeight: '700',
                          cursor: 'pointer'
                        }}
                      >
                        Clear All Filters
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedData.map((d, index) => {
                  const rank = d.rank || ((currentPage - 1) * itemsPerPage + index + 1);
                  const isProfitable = d.netContribution >= 0;

                  // Verdict Badge Colors
                  let verdictBg = 'rgba(15,110,86,0.1)';
                  let verdictColor = '#0F6E56';
                  if (d.verdict === 'star') { verdictBg = 'rgba(16,185,129,0.12)'; verdictColor = '#059669'; }
                  else if (d.verdict === 'healthy') { verdictBg = 'rgba(5,150,105,0.1)'; verdictColor = '#059669'; }
                  else if (d.verdict === 'breakeven') { verdictBg = 'rgba(245,158,11,0.12)'; verdictColor = '#D97706'; }
                  else if (d.verdict === 'at_risk') { verdictBg = 'rgba(234,88,12,0.12)'; verdictColor = '#EA580C'; }
                  else if (d.verdict === 'loss') { verdictBg = 'rgba(220,38,38,0.12)'; verdictColor = '#DC2626'; }

                  return (
                    <tr 
                      key={d.dimension_value || index}
                      onClick={() => handleRowClick(d)}
                      style={{ 
                        borderBottom: '1px solid var(--border-color)', 
                        cursor: 'pointer',
                        transition: 'background 0.15s ease',
                        background: index % 2 === 0 ? 'var(--bg-card)' : 'rgba(0,0,0,0.012)'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(15, 110, 86, 0.04)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = index % 2 === 0 ? 'var(--bg-card)' : 'rgba(0,0,0,0.012)'}
                    >
                      {/* Rank */}
                      <td style={{ padding: '12px 14px', fontWeight: '800', color: rank <= 3 ? '#0F6E56' : 'var(--text-muted)' }}>
                        #{rank}
                      </td>

                      {/* Entity Name */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: '700', color: 'var(--text-main)', fontSize: '0.84rem' }}>
                          {d.dimension_value}
                        </div>
                        {d.role && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{d.role}</span>
                        )}
                        {d.city && activeDimension === 'franchise' && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>📍 {d.city}</span>
                        )}
                      </td>

                      {/* TL: Active Franchise Count */}
                      {activeDimension === 'tl' && (
                        <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: '700', color: '#2563EB' }}>
                          {d.activeFranchises} stores
                        </td>
                      )}

                      {/* Placements */}
                      <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: '700' }}>
                        {d.placements}
                      </td>

                      {/* BD: Total Enquiries */}
                      {activeDimension === 'bd' && (
                        <td style={{ padding: '12px 14px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: '600' }}>
                          {d.enquiries || 0}
                        </td>
                      )}

                      {/* Company Share */}
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '700', color: 'var(--text-main)' }}>
                        {formatCurrency(d.company_share)}
                      </td>

                      {/* Cost of Execution / Payout */}
                      <td style={{ padding: '12px 14px', textAlign: 'right', color: '#4B5563', fontWeight: '600' }}>
                        {activeDimension === 'franchise' 
                          ? formatCurrency(d.franchisee_payout) 
                          : formatCurrency(d.costOfExecution)}
                      </td>

                      {/* Credit Notes */}
                      <td style={{ padding: '12px 14px', textAlign: 'right', color: d.churnCost > 0 ? '#DC2626' : 'var(--text-muted)', fontWeight: '600' }}>
                        {d.churnCost > 0 ? `-${formatCurrency(d.churnCost)}` : '₹0'}
                      </td>

                      {/* Net Contribution */}
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <div style={{ fontWeight: '800', fontSize: '0.88rem', color: isProfitable ? '#10B981' : '#DC2626' }}>
                          {isProfitable ? '+' : ''}{formatCurrency(d.netContribution)}
                        </div>
                        <span style={{ fontSize: '0.68rem', color: isProfitable ? '#059669' : '#B91C1C' }}>
                          {d.netMarginPct}% margin
                        </span>
                      </td>

                      {/* BD: Net Surplus per Enquiry */}
                      {activeDimension === 'bd' && (
                        <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                          <span style={{ fontWeight: '700', color: d.netSurplusPerEnquiry >= 0 ? '#10B981' : '#DC2626' }}>
                            {d.netSurplusPerEnquiry >= 0 ? '+' : ''}{formatCurrency(d.netSurplusPerEnquiry)}
                          </span>
                        </td>
                      )}

                      {/* TL: Net Per Franchise */}
                      {activeDimension === 'tl' && (
                        <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                          <span style={{ fontWeight: '800', color: d.netPerFranchise >= 0 ? '#2563EB' : '#DC2626' }}>
                            {d.netPerFranchise >= 0 ? '+' : ''}{formatCurrency(d.netPerFranchise)}
                          </span>
                        </td>
                      )}

                      {/* Verdict Pill */}
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '12px',
                          fontSize: '0.7rem',
                          fontWeight: '800',
                          background: verdictBg,
                          color: verdictColor,
                          display: 'inline-block'
                        }}>
                          {d.verdict_label}
                        </span>
                      </td>

                      {/* Audit Action Button */}
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRowClick(d); }}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '6px',
                            border: '1px solid var(--border-color)',
                            background: 'var(--bg-main)',
                            color: 'var(--accent-teal, #0F6E56)',
                            fontSize: '0.72rem',
                            fontWeight: '700',
                            cursor: 'pointer'
                          }}
                        >
                          Audit →
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Clean True-Count Pagination Controls */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          
          {/* Entries summary */}
          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
            {allRows.length > 0 ? (
              <span>
                Showing <strong>{itemsPerPage === 'all' ? 1 : (currentPage - 1) * itemsPerPage + 1}</strong> to <strong>{itemsPerPage === 'all' ? allRows.length : Math.min(currentPage * itemsPerPage, allRows.length)}</strong> of <strong>{allRows.length}</strong> records
              </span>
            ) : (
              <span>0 records</span>
            )}
          </div>

          {/* Rows per page selector & page buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              <span>Rows:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(e.target.value === 'all' ? 'all' : Number(e.target.value));
                  setCurrentPage(1);
                }}
                style={{
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-main)',
                  color: 'var(--text-main)',
                  fontSize: '0.74rem',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value="all">All</option>
              </select>
            </div>

            {itemsPerPage !== 'all' && totalPages > 1 && (
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-main)',
                    color: currentPage === 1 ? 'var(--text-muted)' : 'var(--text-main)',
                    fontSize: '0.74rem',
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                  }}
                >
                  Prev
                </button>
                {[...Array(totalPages)].map((_, i) => (
                  <button
                    key={i + 1}
                    onClick={() => setCurrentPage(i + 1)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: currentPage === i + 1 ? '1px solid var(--accent-teal, #0F6E56)' : '1px solid var(--border-color)',
                      background: currentPage === i + 1 ? 'var(--accent-teal, #0F6E56)' : 'var(--bg-main)',
                      color: currentPage === i + 1 ? '#ffffff' : 'var(--text-main)',
                      fontSize: '0.74rem',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    {i + 1}
                  </button>
                ))}
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-main)',
                    color: currentPage === totalPages ? 'var(--text-muted)' : 'var(--text-main)',
                    fontSize: '0.74rem',
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
                  }}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 7. Universal Audit Drawer Drill-Down */}
      <AuditDrawer
        isOpen={isAuditDrawerOpen}
        onClose={() => setIsAuditDrawerOpen(false)}
        entityType={activeDimension === 'franchise' ? 'franchisee' : activeDimension}
        entityId={selectedAuditEntity?.dimension_value || ''}
        entityName={selectedAuditEntity?.dimension_value || ''}
        entityRole={selectedAuditEntity?.role || ''}
        month={cleanMonth}
        financialYear={cleanFy}
      />

      {/* 8. Monthly Cost Inputs Modal */}
      {isInputModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(3px)',
          zIndex: 1000,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            padding: '24px',
            maxWidth: '480px',
            width: '100%',
            boxShadow: '0 8px 32px rgba(0,0,0,0.25)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-main)' }}>
                  Monthly Cost & Payroll Inputs
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Configures direct seat costs and shared overhead pool for {cleanMonth}
                </span>
              </div>
              <button
                onClick={() => setIsInputModalOpen(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '4px' }}>
                  Default BD Executive Monthly Salary (₹)
                </label>
                <input
                  type="number"
                  value={costInputs.defaultBdSalary}
                  onChange={(e) => setCostInputs({ ...costInputs, defaultBdSalary: Number(e.target.value) })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.84rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '4px' }}>
                  Default Team Leader Monthly Salary (₹)
                </label>
                <input
                  type="number"
                  value={costInputs.defaultTlSalary}
                  onChange={(e) => setCostInputs({ ...costInputs, defaultTlSalary: Number(e.target.value) })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.84rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '4px' }}>
                  Shared Overhead Pool (Rent, Admin, Marketing) (₹)
                </label>
                <input
                  type="number"
                  value={costInputs.overheadPool}
                  onChange={(e) => setCostInputs({ ...costInputs, overheadPool: Number(e.target.value) })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.84rem' }}
                />
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px', display: 'block' }}>
                  Allocated pro-rata across active units based on Company Share revenue
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setIsInputModalOpen(false)}
                style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-main)', color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: '600', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={() => { setIsInputModalOpen(false); fetchReport(); }}
                style={{ padding: '8px 18px', borderRadius: '6px', border: 'none', background: 'var(--accent-teal, #0F6E56)', color: '#ffffff', fontSize: '0.82rem', fontWeight: '700', cursor: 'pointer' }}
              >
                Apply & Recalculate
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default CostOfPerformance;
