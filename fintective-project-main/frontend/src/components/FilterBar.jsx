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
  Calendar, 
  User, 
  Layers, 
  Building2, 
  FileSpreadsheet,
  Printer,
  Trash2
} from 'lucide-react';
import InfoTip from './InfoTip';

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

  // References for outside click dismissal
  const downloadRef = useRef(null);
  const savedViewsRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (downloadRef.current && !downloadRef.current.contains(e.target)) {
        setIsDownloadMenuOpen(false);
      }
      if (savedViewsRef.current && !savedViewsRef.current.contains(e.target)) {
        setIsSavedViewsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle CSV export with active filter metadata header
  const handleExportCsv = () => {
    setIsDownloadMenuOpen(false);
    if (onDownloadReport) {
      onDownloadReport('csv');
      return;
    }

    // Default CSV generation
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

  // Handle PDF / Print
  const handlePrintPdf = () => {
    setIsDownloadMenuOpen(false);
    if (onDownloadReport) {
      onDownloadReport('pdf');
      return;
    }
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

  const moreFilterActiveCount = (filters.tl?.length || 0) +
    (filters.bd?.length || 0) +
    (filters.franchise?.length || 0) +
    (filters.industry?.length || 0) +
    (filters.subIndustry?.length || 0) +
    (filters.city?.length || 0) +
    (filters.company?.length || 0) +
    (filters.category?.length || 0) +
    (filters.paymentMode?.length || 0) +
    (filters.search ? 1 : 0);

  return (
    <div className={`unified-filterbar ${className}`} style={{
      background: 'var(--card-bg, #1e293b)',
      border: '1px solid var(--border-color, #334155)',
      borderRadius: '10px',
      padding: '12px 16px',
      marginBottom: '16px',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.05)'
    }}>
      {/* Row 1: Primary Controls */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
          
          {/* Group By Selector */}
          {showGroupBy && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #94a3b8)' }}>Group by:</span>
              <select
                value={filters.groupBy}
                onChange={(e) => setFilterKey('groupBy', e.target.value)}
                style={{
                  background: 'var(--bg-input, #0f172a)',
                  color: 'var(--text-main, #f8fafc)',
                  border: '1px solid var(--border-color, #475569)',
                  borderRadius: '6px',
                  padding: '5px 8px',
                  fontSize: '12px',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                {groupByOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Who Selector (Type + Name) */}
          {showWho && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #94a3b8)' }}>Who:</span>
              <select
                value={filters.whoType}
                onChange={(e) => {
                  setFilterKey('whoType', e.target.value);
                  setFilterKey('whoId', 'all');
                }}
                style={{
                  background: 'var(--bg-input, #0f172a)',
                  color: 'var(--text-main, #f8fafc)',
                  border: '1px solid var(--border-color, #475569)',
                  borderRadius: '6px',
                  padding: '5px 8px',
                  fontSize: '12px',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="all">All Entities</option>
                <option value="bd">BD Specialist</option>
                <option value="tl">Team Leader</option>
                <option value="franchise">Franchisee</option>
              </select>

              {filters.whoType !== 'all' && (
                <select
                  value={filters.whoId}
                  onChange={(e) => setFilterKey('whoId', e.target.value)}
                  style={{
                    background: 'var(--bg-input, #0f172a)',
                    color: 'var(--text-main, #f8fafc)',
                    border: '1px solid var(--border-color, #475569)',
                    borderRadius: '6px',
                    padding: '5px 8px',
                    fontSize: '12px',
                    maxWidth: '180px',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="all">All {filters.whoType.toUpperCase()}s</option>
                  {filters.whoType === 'bd' && availableBds.map(b => (
                    <option key={b.id || b.name} value={b.name}>{b.name}</option>
                  ))}
                  {filters.whoType === 'tl' && teamLeaders.map(t => (
                    <option key={t.id || t.name} value={t.name}>{t.name}</option>
                  ))}
                  {filters.whoType === 'franchise' && availableFranchisees.map(f => (
                    <option key={f.id || f.name} value={f.name}>{f.name} ({f.city})</option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Unified Period Selector */}
          {showPeriod && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #94a3b8)' }}>Period:</span>
              <select
                value={filters.period}
                onChange={(e) => setFilterKey('period', e.target.value)}
                style={{
                  background: 'var(--bg-input, #0f172a)',
                  color: 'var(--text-main, #f8fafc)',
                  border: '1px solid var(--border-color, #475569)',
                  borderRadius: '6px',
                  padding: '5px 8px',
                  fontSize: '12px',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="FY 2026-27">FY 2026-27 (Current)</option>
                <option value="FY 2025-26">FY 2025-26</option>
                <option value="last-6m">Last 6 Months</option>
                <option value="last-12m">Last 12 Months</option>
                <option value="last-24m">Last 24 Months</option>
                <option value="all">All Time</option>
              </select>
            </div>
          )}

          {/* Time Perspective Tabs [Past | Now | Future | All] */}
          {showTime && (
            <div style={{
              display: 'inline-flex',
              background: 'var(--bg-input, #0f172a)',
              borderRadius: '6px',
              padding: '2px',
              border: '1px solid var(--border-color, #334155)',
              marginLeft: '4px'
            }}>
              {['past', 'now', 'future', 'all'].map(t => {
                const active = filters.timePerspective === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setFilterKey('timePerspective', t)}
                    style={{
                      background: active ? '#0F6E56' : 'transparent',
                      color: active ? '#ffffff' : 'var(--text-muted, #94a3b8)',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '3px 8px',
                      fontSize: '11px',
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

        {/* Action Controls: Reset, Saved Views, Download Report */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          
          {/* Saved Views Dropdown */}
          <div ref={savedViewsRef} style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setIsSavedViewsOpen(prev => !prev)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                background: 'rgba(255,255,255,0.05)',
                color: 'var(--text-main, #f1f5f9)',
                border: '1px solid var(--border-color, #475569)',
                borderRadius: '6px',
                padding: '5px 9px',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              <Bookmark size={13} />
              <span>Saved views {savedViews.length > 0 ? `(${savedViews.length})` : ''}</span>
              <ChevronDown size={12} />
            </button>

            {isSavedViewsOpen && (
              <div style={{
                position: 'absolute',
                right: 0,
                top: 'calc(100% + 6px)',
                width: '240px',
                background: 'var(--card-bg, #1a2234)',
                border: '1px solid var(--border-color, #334155)',
                borderRadius: '8px',
                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)',
                padding: '8px',
                zIndex: 999
              }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted, #94a3b8)', marginBottom: '6px', textTransform: 'uppercase' }}>
                  Saved Filter Presets
                </div>
                {savedViews.length === 0 ? (
                  <div style={{ fontSize: '12px', color: 'var(--text-muted, #64748b)', padding: '6px 0' }}>
                    No saved views yet.
                  </div>
                ) : (
                  <div style={{ maxHeight: '160px', overflowY: 'auto', marginBottom: '8px' }}>
                    {savedViews.map(view => (
                      <div key={view.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 6px', borderRadius: '4px', hover: { background: 'rgba(255,255,255,0.05)' } }}>
                        <button
                          type="button"
                          onClick={() => {
                            applySavedView(view);
                            setIsSavedViewsOpen(false);
                          }}
                          style={{ background: 'none', border: 'none', color: '#38bdf8', fontSize: '12px', textAlign: 'left', cursor: 'pointer', flex: 1 }}
                        >
                          {view.name}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteSavedView(view.id)}
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }}
                        >
                          <Trash2 size={12} />
                        </button>
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
                      style={{
                        flex: 1,
                        background: 'var(--bg-input, #0f172a)',
                        color: '#f8fafc',
                        border: '1px solid #475569',
                        borderRadius: '4px',
                        padding: '3px 6px',
                        fontSize: '11px',
                        outline: 'none'
                      }}
                      autoFocus
                    />
                    <button type="submit" style={{ background: '#0F6E56', color: '#fff', border: 'none', borderRadius: '4px', padding: '3px 8px', fontSize: '11px', cursor: 'pointer' }}>
                      Save
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowSaveInput(true)}
                    style={{
                      width: '100%',
                      background: 'rgba(255,255,255,0.05)',
                      color: 'var(--text-main, #f1f5f9)',
                      border: '1px dashed var(--border-color, #475569)',
                      borderRadius: '4px',
                      padding: '4px',
                      fontSize: '11px',
                      cursor: 'pointer',
                      marginTop: '4px'
                    }}
                  >
                    + Save Current Filters
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Download Report Menu */}
          <div ref={downloadRef} style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setIsDownloadMenuOpen(prev => !prev)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                background: '#0F6E56',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '5px 10px',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              <Download size={13} />
              <span>Download report</span>
              <ChevronDown size={12} />
            </button>

            {isDownloadMenuOpen && (
              <div style={{
                position: 'absolute',
                right: 0,
                top: 'calc(100% + 6px)',
                width: '180px',
                background: 'var(--card-bg, #1a2234)',
                border: '1px solid var(--border-color, #334155)',
                borderRadius: '8px',
                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)',
                padding: '6px',
                zIndex: 999
              }}>
                <button
                  type="button"
                  onClick={handleExportCsv}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    width: '100%',
                    background: 'none',
                    border: 'none',
                    padding: '6px 8px',
                    color: 'var(--text-main, #f1f5f9)',
                    fontSize: '12px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    borderRadius: '4px'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                >
                  <FileSpreadsheet size={14} color="#10b981" />
                  <span>Download CSV</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrintPdf}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    width: '100%',
                    background: 'none',
                    border: 'none',
                    padding: '6px 8px',
                    color: 'var(--text-main, #f1f5f9)',
                    fontSize: '12px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    borderRadius: '4px'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                >
                  <Printer size={14} color="#38bdf8" />
                  <span>Print / PDF View</span>
                </button>
              </div>
            )}
          </div>

          {/* Reset All Filters Button */}
          <button
            type="button"
            onClick={resetFilters}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              background: 'transparent',
              color: 'var(--text-muted, #94a3b8)',
              border: '1px solid var(--border-color, #475569)',
              borderRadius: '6px',
              padding: '5px 8px',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            <RotateCcw size={12} />
            <span>Reset</span>
            <span style={{ fontSize: '11px', color: '#64748b' }}>({filteredTransactions.length})</span>
          </button>
        </div>
      </div>

      {/* Row 2: Status & Metric Chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        
        {/* Deal Stage Chips */}
        {showDealStage && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted, #94a3b8)', textTransform: 'uppercase' }}>Deal stage:</span>
            {[
              { id: 'Progressed', label: 'Progressed', color: '#1E40AF', activeBg: '#2563eb', count: filterOptions.dealStages?.Progressed },
              { id: 'Closed', label: 'Closed', color: '#0F6E56', activeBg: '#0F6E56', count: filterOptions.dealStages?.Closed },
              { id: 'Cancelled', label: 'Cancelled', color: '#B91C1C', activeBg: '#dc2626', count: filterOptions.dealStages?.Cancelled }
            ].map(chip => {
              const isActive = filters.dealStages.includes(chip.id);
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => toggleArrayItem('dealStages', chip.id)}
                  style={{
                    background: isActive ? chip.activeBg : 'rgba(255,255,255,0.04)',
                    color: isActive ? '#ffffff' : 'var(--text-main, #e2e8f0)',
                    border: `1px solid ${isActive ? chip.activeBg : 'var(--border-color, #475569)'}`,
                    borderRadius: '16px',
                    padding: '2px 9px',
                    fontSize: '11px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {isActive && <Check size={10} />}
                  <span>{chip.label}</span>
                  {chip.count !== undefined && <span style={{ opacity: 0.7, fontSize: '10px' }}>({chip.count})</span>}
                </button>
              );
            })}
          </div>
        )}

        {/* Payment State Chips */}
        {showPayment && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted, #94a3b8)', textTransform: 'uppercase' }}>Payment:</span>
            {[
              { id: 'Received', label: 'Received', activeBg: '#15803D', count: filterOptions.paymentStates?.Received },
              { id: 'Outstanding', label: 'Outstanding', activeBg: '#B45309', count: filterOptions.paymentStates?.Outstanding },
              { id: 'Credit note', label: 'Credit note', activeBg: '#B91C1C', count: filterOptions.paymentStates?.['Credit note'] }
            ].map(chip => {
              const isActive = filters.paymentStates.includes(chip.id);
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => toggleArrayItem('paymentStates', chip.id)}
                  style={{
                    background: isActive ? chip.activeBg : 'rgba(255,255,255,0.04)',
                    color: isActive ? '#ffffff' : 'var(--text-main, #e2e8f0)',
                    border: `1px solid ${isActive ? chip.activeBg : 'var(--border-color, #475569)'}`,
                    borderRadius: '16px',
                    padding: '2px 9px',
                    fontSize: '11px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {isActive && <Check size={10} />}
                  <span>{chip.label}</span>
                  {chip.count !== undefined && <span style={{ opacity: 0.7, fontSize: '10px' }}>({chip.count})</span>}
                </button>
              );
            })}
          </div>
        )}

        {/* Risk Chips */}
        {showRisk && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted, #94a3b8)', textTransform: 'uppercase' }}>Risk:</span>
            {[
              { id: 'highRisk', label: 'High risk only', activeBg: '#dc2626', count: filterOptions.risk?.highRisk },
              { id: 'stale', label: 'Stale >365d', activeBg: '#ea580c', count: filterOptions.risk?.stale }
            ].map(chip => {
              const isActive = filters.riskFilters.includes(chip.id);
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => toggleArrayItem('riskFilters', chip.id)}
                  style={{
                    background: isActive ? chip.activeBg : 'rgba(255,255,255,0.04)',
                    color: isActive ? '#ffffff' : 'var(--text-main, #e2e8f0)',
                    border: `1px solid ${isActive ? chip.activeBg : 'var(--border-color, #475569)'}`,
                    borderRadius: '16px',
                    padding: '2px 9px',
                    fontSize: '11px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {isActive && <Check size={10} />}
                  <span>{chip.label}</span>
                  {chip.count !== undefined && <span style={{ opacity: 0.7, fontSize: '10px' }}>({chip.count})</span>}
                </button>
              );
            })}
          </div>
        )}

        {/* More Filters Toggle */}
        {showMoreFilters && (
          <button
            type="button"
            onClick={() => setIsMoreOpen(prev => !prev)}
            style={{
              background: isMoreOpen || moreFilterActiveCount > 0 ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255,255,255,0.04)',
              color: isMoreOpen || moreFilterActiveCount > 0 ? '#38bdf8' : 'var(--text-muted, #94a3b8)',
              border: `1px solid ${isMoreOpen || moreFilterActiveCount > 0 ? '#38bdf8' : 'var(--border-color, #475569)'}`,
              borderRadius: '16px',
              padding: '2px 10px',
              fontSize: '11px',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              marginLeft: 'auto'
            }}
          >
            <Filter size={11} />
            <span>More filters {moreFilterActiveCount > 0 ? `(${moreFilterActiveCount})` : ''}</span>
            {isMoreOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>
        )}
      </div>

      {/* Row 3: Collapsible "More Filters" Tray */}
      {isMoreOpen && (
        <div style={{
          marginTop: '12px',
          padding: '12px',
          background: 'var(--bg-input, #0f172a)',
          borderRadius: '8px',
          border: '1px solid var(--border-color, #334155)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px'
        }}>
          {/* Quick Search */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted, #94a3b8)', marginBottom: '4px' }}>
              Search Any Record:
            </label>
            <div style={{ position: 'relative' }}>
              <Search size={12} style={{ position: 'absolute', left: '8px', top: '8px', color: '#64748b' }} />
              <input
                type="text"
                placeholder="Client, candidate, bill no..."
                value={filters.search}
                onChange={(e) => setFilterKey('search', e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--card-bg, #1e293b)',
                  color: '#f8fafc',
                  border: '1px solid #475569',
                  borderRadius: '6px',
                  padding: '5px 8px 5px 26px',
                  fontSize: '11px',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          {/* Industry Filter */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted, #94a3b8)', marginBottom: '4px' }}>
              Industry:
            </label>
            <select
              value={filters.industry[0] || ''}
              onChange={(e) => setFilterKey('industry', e.target.value ? [e.target.value] : [])}
              style={{
                width: '100%',
                background: 'var(--card-bg, #1e293b)',
                color: '#f8fafc',
                border: '1px solid #475569',
                borderRadius: '6px',
                padding: '5px 8px',
                fontSize: '11px',
                outline: 'none'
              }}
            >
              <option value="">All Industries</option>
              {Object.entries(filterOptions.industries || {}).map(([ind, count]) => (
                <option key={ind} value={ind}>{ind} ({count})</option>
              ))}
            </select>
          </div>

          {/* City Filter */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted, #94a3b8)', marginBottom: '4px' }}>
              City:
            </label>
            <select
              value={filters.city[0] || ''}
              onChange={(e) => setFilterKey('city', e.target.value ? [e.target.value] : [])}
              style={{
                width: '100%',
                background: 'var(--card-bg, #1e293b)',
                color: '#f8fafc',
                border: '1px solid #475569',
                borderRadius: '6px',
                padding: '5px 8px',
                fontSize: '11px',
                outline: 'none'
              }}
            >
              <option value="">All Cities</option>
              {Object.entries(filterOptions.cities || {}).map(([city, count]) => (
                <option key={city} value={city}>{city} ({count})</option>
              ))}
            </select>
          </div>

          {/* Team Leader Filter */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted, #94a3b8)', marginBottom: '4px' }}>
              Team Leader:
            </label>
            <select
              value={filters.tl[0] || ''}
              onChange={(e) => setFilterKey('tl', e.target.value ? [e.target.value] : [])}
              style={{
                width: '100%',
                background: 'var(--card-bg, #1e293b)',
                color: '#f8fafc',
                border: '1px solid #475569',
                borderRadius: '6px',
                padding: '5px 8px',
                fontSize: '11px',
                outline: 'none'
              }}
            >
              <option value="">All Team Leaders</option>
              {Object.entries(filterOptions.tls || {}).map(([tl, count]) => (
                <option key={tl} value={tl}>{tl} ({count})</option>
              ))}
            </select>
          </div>

          {/* BD Specialist Filter */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted, #94a3b8)', marginBottom: '4px' }}>
              BD Specialist:
            </label>
            <select
              value={filters.bd[0] || ''}
              onChange={(e) => setFilterKey('bd', e.target.value ? [e.target.value] : [])}
              style={{
                width: '100%',
                background: 'var(--card-bg, #1e293b)',
                color: '#f8fafc',
                border: '1px solid #475569',
                borderRadius: '6px',
                padding: '5px 8px',
                fontSize: '11px',
                outline: 'none'
              }}
            >
              <option value="">All BD Specialists</option>
              {availableBds.map(bd => (
                <option key={bd.name} value={bd.name}>{bd.name} ({filterOptions.bds?.[bd.name] || 0})</option>
              ))}
            </select>
          </div>

          {/* Franchisee Filter */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted, #94a3b8)', marginBottom: '4px' }}>
              Franchisee Network:
            </label>
            <select
              value={filters.franchise[0] || ''}
              onChange={(e) => setFilterKey('franchise', e.target.value ? [e.target.value] : [])}
              style={{
                width: '100%',
                background: 'var(--card-bg, #1e293b)',
                color: '#f8fafc',
                border: '1px solid #475569',
                borderRadius: '6px',
                padding: '5px 8px',
                fontSize: '11px',
                outline: 'none'
              }}
            >
              <option value="">All Franchisees</option>
              {availableFranchisees.map(f => (
                <option key={f.name} value={f.name}>{f.name} ({f.city})</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Row 4: Active Filter Tags Strip */}
      {activeFilterTags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', marginTop: '10px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted, #94a3b8)' }}>Active:</span>
          {activeFilterTags.map((tag, idx) => (
            <span
              key={`${tag.key}-${tag.item || idx}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                background: 'rgba(56, 189, 248, 0.12)',
                color: '#38bdf8',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                borderRadius: '12px',
                padding: '2px 8px',
                fontSize: '11px'
              }}
            >
              <span>{tag.label}</span>
              <button
                type="button"
                onClick={() => removeFilterTag(tag)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#38bdf8',
                  cursor: 'pointer',
                  padding: '1px',
                  display: 'inline-flex',
                  alignItems: 'center'
                }}
                aria-label={`Remove filter ${tag.label}`}
              >
                <X size={10} />
              </button>
            </span>
          ))}

          <button
            type="button"
            onClick={resetFilters}
            style={{
              background: 'none',
              border: 'none',
              color: '#ef4444',
              fontSize: '11px',
              textDecoration: 'underline',
              cursor: 'pointer',
              marginLeft: '6px'
            }}
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
