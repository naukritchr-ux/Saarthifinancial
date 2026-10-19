import React, { useState, useRef, useEffect, useContext } from 'react';
import { useFilters } from '../context/FilterContext';
import { FinanceContext } from '../context/FinanceContext';
import {
  Filter,
  X,
  RotateCcw,
  Download,
  Bookmark,
  ChevronDown,
  ChevronUp,
  Search,
  Check,
  FileSpreadsheet,
  Printer,
  Trash2
} from 'lucide-react';
import InfoTip from './InfoTip';

// ─── Light theme token helpers ────────────────────────────────────────────────
const INPUT_STYLE = {
  background: '#ffffff',
  color: 'var(--text-main)',
  border: '1px solid var(--border-color)',
  borderRadius: '6px',
  padding: '5px 8px',
  fontSize: '12px',
  outline: 'none',
  cursor: 'pointer'
};

const PANEL_STYLE = {
  position: 'absolute',
  right: 0,
  top: 'calc(100% + 6px)',
  background: '#ffffff',
  border: '1px solid var(--border-color)',
  borderRadius: '8px',
  boxShadow: '0 8px 24px -4px rgba(0,0,0,0.10)',
  padding: '8px',
  zIndex: 999
};

export default function FilterBar({
  showGroupBy = true,
  groupByOptions = [
    { value: 'none', label: 'None' },
    { value: 'industry', label: 'Industry' },
    { value: 'city', label: 'City' },
    { value: 'bd', label: 'BD Specialist' },
    { value: 'tl', label: 'Team Leader' },
    { value: 'franchise', label: 'Franchisee' }
  ],
  showWho = true,
  showPeriod = true,
  showTime = true,
  showDealStage = true,
  showPayment = true,
  showRisk = true,
  showMoreFilters = true,
  onDownloadReport,
  className = ''
}) {
  const {
    filters,
    setFilterKey,
    toggleArrayItem,
    resetFilters,
    savedViews,
    saveCurrentView,
    applySavedView,
    deleteSavedView,
    availableBds,
    availableFranchisees,
    filterOptions,
    filteredTransactions,
    activeFilterTags,
    removeFilterTag,
    getFilterReportHeader
  } = useFilters();

  const { teamLeaders = [] } = useContext(FinanceContext);

  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isSavedViewsOpen, setIsSavedViewsOpen] = useState(false);
  const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);

  const downloadRef = useRef(null);
  const savedViewsRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (downloadRef.current && !downloadRef.current.contains(e.target)) setIsDownloadMenuOpen(false);
      if (savedViewsRef.current && !savedViewsRef.current.contains(e.target)) setIsSavedViewsOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleExportCsv = () => {
    setIsDownloadMenuOpen(false);
    if (onDownloadReport) { onDownloadReport('csv'); return; }
    const headerMeta = `# ${getFilterReportHeader()}\n`;
    const headers = ['Date', 'Bill No / Ref', 'Client Company', 'Position', 'BD Specialist', 'Team Leader', 'Franchisee', 'Gross Amount', 'Our Share', 'Status'];
    const rows = filteredTransactions.map(t => [
      `"${t.date || ''}"`,
      `"${t.referenceId || t.billNumber || ''}"`,
      `"${(t.companyName || '').replace(/"/g, '""')}"`,
      `"${(t.positionName || t.role || '').replace(/"/g, '""')}"`,
      `"${(t.bdAgentName || t.bdMemberName || '').replace(/"/g, '""')}"`,
      `"${(t.teamLeaderName || '').replace(/"/g, '""')}"`,
      `"${(t.franchiseeName || '').replace(/"/g, '""')}"`,
      t.amount || 0,
      t.rShare || 0,
      `"${t.status || t.info || 'Reconciled'}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(headerMeta + headers.join(',') + '\n' + rows.map(r => r.join(',')).join('\n'));
    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    link.setAttribute('download', `fintective-report-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintPdf = () => {
    setIsDownloadMenuOpen(false);
    if (onDownloadReport) { onDownloadReport('pdf'); return; }
    window.print();
  };

  const handleSaveViewSubmit = (e) => {
    e.preventDefault();
    if (newViewName.trim()) {
      saveCurrentView(newViewName);
      setNewViewName('');
      setShowSaveInput(false);
    }
  };

  const moreFilterActiveCount =
    (filters.tl?.length || 0) + (filters.bd?.length || 0) + (filters.franchise?.length || 0) +
    (filters.industry?.length || 0) + (filters.subIndustry?.length || 0) + (filters.city?.length || 0) +
    (filters.company?.length || 0) + (filters.category?.length || 0) + (filters.paymentMode?.length || 0) +
    (filters.search ? 1 : 0);

  // ─── Chip renderer ──────────────────────────────────────────────────────────
  const renderChip = (chip, filterKey, activeList) => {
    const isActive = activeList.includes(chip.id);
    return (
      <button
        key={chip.id}
        type="button"
        onClick={() => toggleArrayItem(filterKey, chip.id)}
        aria-pressed={isActive}
        style={{
          background: isActive ? chip.activeBg : '#ffffff',
          color: isActive ? '#ffffff' : 'var(--text-main)',
          border: `1px solid ${isActive ? chip.activeBg : 'var(--border-color)'}`,
          borderRadius: '16px',
          padding: '2px 10px',
          fontSize: '11.5px',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          fontWeight: isActive ? 600 : 400,
          transition: 'all 0.15s ease',
          whiteSpace: 'nowrap'
        }}
      >
        {isActive && <Check size={10} />}
        <span>{chip.label}</span>
        {chip.count !== undefined && (
          <span style={{ opacity: 0.65, fontSize: '10px' }}>({chip.count})</span>
        )}
      </button>
    );
  };

  return (
    <div
      className={`unified-filterbar ${className}`}
      role="search"
      aria-label="Filter controls"
      style={{
        background: '#ffffff',
        border: '1px solid var(--border-color)',
        borderRadius: '10px',
        padding: '12px 16px',
        marginBottom: '16px',
        boxShadow: 'var(--shadow-sm)'
      }}
    >
      {/* ── Row 1: Primary Controls ───────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>

          {/* Group by */}
          {showGroupBy && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label htmlFor="fb-groupby" style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                Group by
              </label>
              <select
                id="fb-groupby"
                value={filters.groupBy}
                onChange={(e) => setFilterKey('groupBy', e.target.value)}
                style={INPUT_STYLE}
              >
                {groupByOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
          )}

          {/* Who */}
          {showWho && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label htmlFor="fb-who-type" style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                Who
              </label>
              <select
                id="fb-who-type"
                value={filters.whoType}
                onChange={(e) => { setFilterKey('whoType', e.target.value); setFilterKey('whoId', 'all'); }}
                style={INPUT_STYLE}
              >
                <option value="all">All</option>
                <option value="bd">BD Specialist</option>
                <option value="tl">Team Leader</option>
                <option value="franchise">Franchisee</option>
              </select>
              {filters.whoType !== 'all' && (
                <select
                  id="fb-who-id"
                  value={filters.whoId}
                  onChange={(e) => setFilterKey('whoId', e.target.value)}
                  style={{ ...INPUT_STYLE, maxWidth: '180px' }}
                >
                  <option value="all">All {filters.whoType === 'bd' ? 'BDs' : filters.whoType === 'tl' ? 'TLs' : 'Franchisees'}</option>
                  {filters.whoType === 'bd' && availableBds.map(b => <option key={b.id || b.name} value={b.name}>{b.name}</option>)}
                  {filters.whoType === 'tl' && teamLeaders.map(t => <option key={t.id || t.name} value={t.name}>{t.name}</option>)}
                  {filters.whoType === 'franchise' && availableFranchisees.map(f => <option key={f.id || f.name} value={f.name}>{f.name} ({f.city})</option>)}
                </select>
              )}
            </div>
          )}

          {/* Period */}
          {showPeriod && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <label htmlFor="fb-period" style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                Period
              </label>
              <select
                id="fb-period"
                value={filters.period}
                onChange={(e) => setFilterKey('period', e.target.value)}
                style={INPUT_STYLE}
              >
                <option value="FY 2026-27">FY 2026-27 (Current)</option>
                <option value="FY 2025-26">FY 2025-26</option>
                <option value="last-6m">Last 6 months</option>
                <option value="last-12m">Last 12 months</option>
                <option value="last-24m">Last 24 months</option>
                <option value="all">All time</option>
              </select>
            </div>
          )}

          {/* Time perspective pill */}
          {showTime && (
            <div
              role="group"
              aria-label="Time perspective"
              style={{
                display: 'inline-flex',
                background: 'var(--bg-main)',
                borderRadius: '6px',
                padding: '2px',
                border: '1px solid var(--border-color)'
              }}
            >
              {['past', 'now', 'future', 'all'].map(t => {
                const active = filters.timePerspective === t;
                return (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setFilterKey('timePerspective', t)}
                    style={{
                      background: active ? 'var(--accent-teal)' : 'transparent',
                      color: active ? '#ffffff' : 'var(--text-muted)',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '3px 9px',
                      fontSize: '11.5px',
                      fontWeight: active ? 600 : 400,
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>

          {/* Saved views */}
          <div ref={savedViewsRef} style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setIsSavedViewsOpen(prev => !prev)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                background: '#ffffff', color: 'var(--text-main)',
                border: '1px solid var(--border-color)', borderRadius: '6px',
                padding: '5px 9px', fontSize: '12px', cursor: 'pointer'
              }}
            >
              <Bookmark size={13} />
              <span>Save view{savedViews.length > 0 ? ` (${savedViews.length})` : ''}</span>
              <ChevronDown size={12} />
            </button>
            {isSavedViewsOpen && (
              <div style={{ ...PANEL_STYLE, width: '240px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>Saved filter presets</div>
                {savedViews.length === 0 ? (
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '4px 0' }}>No saved views yet.</div>
                ) : (
                  <div style={{ maxHeight: '160px', overflowY: 'auto', marginBottom: '8px' }}>
                    {savedViews.map(view => (
                      <div key={view.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 4px' }}>
                        <button
                          type="button"
                          onClick={() => { applySavedView(view); setIsSavedViewsOpen(false); }}
                          style={{ background: 'none', border: 'none', color: 'var(--accent-teal)', fontSize: '12px', textAlign: 'left', cursor: 'pointer', flex: 1 }}
                        >{view.name}</button>
                        <button
                          type="button"
                          aria-label={`Delete view ${view.name}`}
                          onClick={() => deleteSavedView(view.id)}
                          style={{ background: 'none', border: 'none', color: 'var(--color-expense)', cursor: 'pointer', padding: '2px' }}
                        ><Trash2 size={12} /></button>
                      </div>
                    ))}
                  </div>
                )}
                {showSaveInput ? (
                  <form onSubmit={handleSaveViewSubmit} style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
                    <input
                      type="text"
                      placeholder="View name..."
                      value={newViewName}
                      onChange={(e) => setNewViewName(e.target.value)}
                      style={{ flex: 1, background: '#fff', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '3px 6px', fontSize: '11px', outline: 'none' }}
                      autoFocus
                    />
                    <button type="submit" style={{ background: 'var(--accent-teal)', color: '#fff', border: 'none', borderRadius: '4px', padding: '3px 8px', fontSize: '11px', cursor: 'pointer' }}>Save</button>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowSaveInput(true)}
                    style={{ width: '100%', background: '#f6f7f4', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: '4px', padding: '4px', fontSize: '11px', cursor: 'pointer', marginTop: '4px' }}
                  >+ Save current filters</button>
                )}
              </div>
            )}
          </div>

          {/* Download report */}
          <div ref={downloadRef} style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setIsDownloadMenuOpen(prev => !prev)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                background: 'var(--accent-teal)', color: '#ffffff',
                border: 'none', borderRadius: '6px',
                padding: '5px 10px', fontSize: '12px', fontWeight: 500, cursor: 'pointer'
              }}
            >
              <Download size={13} />
              <span>Download report</span>
              <ChevronDown size={12} />
            </button>
            {isDownloadMenuOpen && (
              <div style={{ ...PANEL_STYLE, width: '180px' }}>
                {[
                  { label: 'Download CSV', icon: <FileSpreadsheet size={14} color="#0f6e56" />, action: handleExportCsv },
                  { label: 'Print / PDF', icon: <Printer size={14} color="#1d4ed8" />, action: handlePrintPdf }
                ].map(item => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={item.action}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', background: 'none', border: 'none', padding: '6px 8px', color: 'var(--text-main)', fontSize: '12px', textAlign: 'left', cursor: 'pointer', borderRadius: '4px' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f6f7f4'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                  >
                    {item.icon}<span>{item.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Reset */}
          <button
            type="button"
            onClick={resetFilters}
            title="Reset all filters"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              background: 'transparent', color: 'var(--text-muted)',
              border: '1px solid var(--border-color)', borderRadius: '6px',
              padding: '5px 8px', fontSize: '12px', cursor: 'pointer'
            }}
          >
            <RotateCcw size={12} />
            <span>Reset</span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({filteredTransactions.length})</span>
          </button>
        </div>
      </div>

      {/* ── Row 2: Status chips ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>

        {/* Deal stage */}
        {showDealStage && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
              Deal status:
            </span>
            {[
              { id: 'Progressed', label: 'Progressed', activeBg: '#1E40AF', count: filterOptions.dealStages?.Progressed },
              { id: 'Closed', label: 'Closed', activeBg: '#0F6E56', count: filterOptions.dealStages?.Closed },
              { id: 'Cancelled', label: 'Cancelled', activeBg: '#B91C1C', count: filterOptions.dealStages?.Cancelled }
            ].map(chip => renderChip(chip, 'dealStages', filters.dealStages))}
          </div>
        )}

        {/* Payment state */}
        {showPayment && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
              Payment:
            </span>
            {[
              { id: 'Received', label: 'Received', activeBg: '#15803D', count: filterOptions.paymentStates?.Received },
              { id: 'Outstanding', label: 'Outstanding', activeBg: '#B45309', count: filterOptions.paymentStates?.Outstanding },
              { id: 'Credit note', label: 'Credit note', activeBg: '#B91C1C', count: filterOptions.paymentStates?.['Credit note'] }
            ].map(chip => renderChip(chip, 'paymentStates', filters.paymentStates))}
          </div>
        )}

        {/* Risk */}
        {showRisk && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
              Risk:
            </span>
            {[
              { id: 'highRisk', label: 'High risk only', activeBg: '#dc2626', count: filterOptions.risk?.highRisk },
              { id: 'stale', label: 'Stale >365d', activeBg: '#ea580c', count: filterOptions.risk?.stale }
            ].map(chip => renderChip(chip, 'riskFilters', filters.riskFilters))}
          </div>
        )}

        {/* More filters toggle */}
        {showMoreFilters && (
          <button
            type="button"
            onClick={() => setIsMoreOpen(prev => !prev)}
            style={{
              background: isMoreOpen || moreFilterActiveCount > 0 ? 'rgba(15,110,86,0.08)' : 'transparent',
              color: isMoreOpen || moreFilterActiveCount > 0 ? 'var(--accent-teal)' : 'var(--text-muted)',
              border: `1px solid ${isMoreOpen || moreFilterActiveCount > 0 ? 'var(--accent-teal)' : 'var(--border-color)'}`,
              borderRadius: '16px',
              padding: '2px 10px',
              fontSize: '11.5px',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              marginLeft: 'auto'
            }}
          >
            <Filter size={11} />
            <span>More filters{moreFilterActiveCount > 0 ? ` (${moreFilterActiveCount})` : ''}</span>
            {isMoreOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>
        )}
      </div>

      {/* ── Row 3: More filters tray ──────────────────────────────────────────── */}
      {isMoreOpen && (
        <div style={{
          marginTop: '12px', padding: '12px',
          background: '#f6f7f4',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px'
        }}>
          {/* Search */}
          <div>
            <label htmlFor="fb-search" style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
              Search
            </label>
            <div style={{ position: 'relative' }}>
              <Search size={12} style={{ position: 'absolute', left: '8px', top: '8px', color: 'var(--text-muted)' }} />
              <input
                id="fb-search"
                type="text"
                placeholder="Client, candidate, bill no..."
                value={filters.search}
                onChange={(e) => setFilterKey('search', e.target.value)}
                style={{ width: '100%', background: '#ffffff', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '5px 8px 5px 26px', fontSize: '11px', outline: 'none' }}
              />
            </div>
          </div>

          {/* Industry */}
          <div>
            <label htmlFor="fb-industry" style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>Industry</label>
            <select
              id="fb-industry"
              value={filters.industry[0] || ''}
              onChange={(e) => setFilterKey('industry', e.target.value ? [e.target.value] : [])}
              style={{ width: '100%', background: '#ffffff', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '5px 8px', fontSize: '11px', outline: 'none' }}
            >
              <option value="">All industries</option>
              {Object.entries(filterOptions.industries || {}).map(([ind, count]) => (
                <option key={ind} value={ind}>{ind} ({count})</option>
              ))}
            </select>
          </div>

          {/* City */}
          <div>
            <label htmlFor="fb-city" style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>City</label>
            <select
              id="fb-city"
              value={filters.city[0] || ''}
              onChange={(e) => setFilterKey('city', e.target.value ? [e.target.value] : [])}
              style={{ width: '100%', background: '#ffffff', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '5px 8px', fontSize: '11px', outline: 'none' }}
            >
              <option value="">All cities</option>
              {Object.entries(filterOptions.cities || {}).map(([city, count]) => (
                <option key={city} value={city}>{city} ({count})</option>
              ))}
            </select>
          </div>

          {/* Team Leader */}
          <div>
            <label htmlFor="fb-tl" style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>Team Leader</label>
            <select
              id="fb-tl"
              value={filters.tl[0] || ''}
              onChange={(e) => setFilterKey('tl', e.target.value ? [e.target.value] : [])}
              style={{ width: '100%', background: '#ffffff', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '5px 8px', fontSize: '11px', outline: 'none' }}
            >
              <option value="">All Team Leaders</option>
              {Object.entries(filterOptions.tls || {}).map(([tl, count]) => (
                <option key={tl} value={tl}>{tl} ({count})</option>
              ))}
            </select>
          </div>

          {/* BD Specialist */}
          <div>
            <label htmlFor="fb-bd" style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>BD Specialist</label>
            <select
              id="fb-bd"
              value={filters.bd[0] || ''}
              onChange={(e) => setFilterKey('bd', e.target.value ? [e.target.value] : [])}
              style={{ width: '100%', background: '#ffffff', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '5px 8px', fontSize: '11px', outline: 'none' }}
            >
              <option value="">All BD Specialists</option>
              {availableBds.map(bd => (
                <option key={bd.name} value={bd.name}>{bd.name} ({filterOptions.bds?.[bd.name] || 0})</option>
              ))}
            </select>
          </div>

          {/* Franchisee */}
          <div>
            <label htmlFor="fb-franchise" style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>Franchisee</label>
            <select
              id="fb-franchise"
              value={filters.franchise[0] || ''}
              onChange={(e) => setFilterKey('franchise', e.target.value ? [e.target.value] : [])}
              style={{ width: '100%', background: '#ffffff', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '5px 8px', fontSize: '11px', outline: 'none' }}
            >
              <option value="">All Franchisees</option>
              {availableFranchisees.map(f => (
                <option key={f.name} value={f.name}>{f.name} ({f.city})</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* ── Row 4: Active filter tag strip ───────────────────────────────────── */}
      {activeFilterTags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', marginTop: '10px', paddingTop: '8px', borderTop: '1px solid var(--border-color)' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>Active:</span>
          {activeFilterTags.map((tag, idx) => (
            <span
              key={`${tag.key}-${tag.item || idx}`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                background: 'rgba(15, 110, 86, 0.08)',
                color: 'var(--accent-teal)',
                border: '1px solid rgba(15, 110, 86, 0.25)',
                borderRadius: '12px',
                padding: '2px 8px',
                fontSize: '11px'
              }}
            >
              <span>{tag.label}</span>
              <button
                type="button"
                onClick={() => removeFilterTag(tag)}
                aria-label={`Remove filter: ${tag.label}`}
                style={{ background: 'none', border: 'none', color: 'var(--accent-teal)', cursor: 'pointer', padding: '0', lineHeight: 1, display: 'inline-flex', alignItems: 'center' }}
              >
                <X size={11} />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={resetFilters}
            style={{ fontSize: '11px', color: 'var(--color-expense)', background: 'none', border: 'none', cursor: 'pointer', marginLeft: '4px', textDecoration: 'underline' }}
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
