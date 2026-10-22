import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  X, 
  AlertTriangle, 
  TrendingDown, 
  TrendingUp, 
  CheckCircle2, 
  ChevronDown, 
  ChevronUp, 
  Filter, 
  Sparkles, 
  Building2, 
  User, 
  Briefcase, 
  Calendar,
  AlertCircle,
  HelpCircle,
  Clock,
  ArrowUpDown
} from 'lucide-react';
import { formatCurrency, formatLakhs } from '../utils/formatters';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Universal Audit Drawer Component
 * Answers: "WHERE exactly is this entity causing loss?"
 * Reusable across CostOfPerformance (BD, TL, Franchise, City, Industry) and BDPerformance.
 */
export const AuditDrawer = ({
  isOpen = false,
  onClose,
  entityType = 'bd', // 'bd' | 'tl' | 'franchisee' | 'city' | 'industry'
  entityId = '',
  entityName = '',
  entityRole = '',
  month = '2026-08',
  financialYear = '2026-2027'
}) => {
  // Active Filters State
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'loss' | 'low_margin' | 'credit_note_hit' | 'healthy'
  const [causeFilter, setCauseFilter] = useState(''); // '' | 'credit_notes' | 'cost_drag' | 'no_conversion'
  const [clientFilter, setClientFilter] = useState('');
  const [sortBy, setSortBy] = useState('worst_first'); // 'worst_first' | 'highest_billed' | 'latest'
  
  // UI Expansion States
  const [isExpandedAll, setIsExpandedAll] = useState(false);
  const [expandedRowId, setExpandedRowId] = useState(null);
  
  // Data States
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Synchronize URL query params
  useEffect(() => {
    if (!isOpen || !entityId) return;
    const url = new URL(window.location.href);
    url.searchParams.set('audit_entity', entityId);
    url.searchParams.set('audit_type', entityType);
    if (statusFilter && statusFilter !== 'all') url.searchParams.set('audit_status', statusFilter);
    else url.searchParams.delete('audit_status');
    if (causeFilter) url.searchParams.set('audit_cause', causeFilter);
    else url.searchParams.delete('audit_cause');
    if (clientFilter) url.searchParams.set('audit_client', clientFilter);
    else url.searchParams.delete('audit_client');
    window.history.replaceState({}, '', url.toString());
  }, [isOpen, entityId, entityType, statusFilter, causeFilter, clientFilter]);

  // Clean URL on drawer close
  const handleClose = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('audit_entity');
    url.searchParams.delete('audit_type');
    url.searchParams.delete('audit_status');
    url.searchParams.delete('audit_cause');
    url.searchParams.delete('audit_client');
    window.history.replaceState({}, '', url.toString());
    onClose();
  };

  // Fetch Audit Data from Backend
  const fetchAuditData = useCallback(async (isInitial = false) => {
    if (!entityId) return;
    setLoading(true);
    setError(null);

    try {
      let cleanMonth = (month || 'all').trim();
      if (cleanMonth.toLowerCase() === 'all months' || cleanMonth.toLowerCase() === 'all') {
        cleanMonth = 'all';
      } else if (cleanMonth.includes(' ')) {
        const parts = cleanMonth.split(' ');
        const monthNames = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
        const mIdx = monthNames.indexOf(parts[0].toLowerCase());
        if (mIdx !== -1 && parts[1]) {
          cleanMonth = `${parts[1]}-${String(mIdx + 1).padStart(2, '0')}`;
        }
      }

      const qParams = new URLSearchParams({
        month: cleanMonth,
        fy: financialYear || '2026-2027',
        status: statusFilter,
        cause: causeFilter,
        client: clientFilter,
        sort: sortBy
      });

      const endpoint = `${API_BASE_URL}/audit/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}?${qParams.toString()}`;
      const res = await fetch(endpoint, {
        headers: { 'X-API-Key': 'saarthi-secret-api-key-2026' }
      });

      if (!res.ok) throw new Error(`Audit load failed with status ${res.status}`);
      const json = await res.json();
      
      if (json.success) {
        setData(json);

        // DEFAULT STATE RULE:
        // On initial open, preselect "Problem deals" = Loss + Credit note hit (worst first)
        // If no problem deals, fall back to All
        if (isInitial) {
          const counts = json.counts?.status || {};
          const hasLoss = (counts.loss || 0) > 0;
          const hasCn = (counts.credit_note_hit || 0) > 0;
          if (hasLoss) {
            setStatusFilter('loss');
          } else if (hasCn) {
            setStatusFilter('credit_note_hit');
          } else {
            setStatusFilter('all');
          }
        }
      } else {
        throw new Error(json.error || 'Server error loading audit data');
      }
    } catch (err) {
      console.error("AuditDrawer fetch error:", err);
      setError(err.message || 'Unable to connect to financial audit service');
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId, month, financialYear, statusFilter, causeFilter, clientFilter, sortBy]);

  // Load when drawer opens or entity/period changes
  useEffect(() => {
    if (isOpen && entityId) {
      setExpandedRowId(null);
      setIsExpandedAll(false);
      fetchAuditData(true);
    }
  }, [isOpen, entityId, entityType, month, financialYear]);

  // Refetch when filters change (debounced lightly)
  useEffect(() => {
    if (isOpen && entityId && data) {
      const timer = setTimeout(() => {
        fetchAuditData(false);
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [statusFilter, causeFilter, clientFilter, sortBy]);

  // Keyboard escape to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) handleClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  const summary = data?.summary || {
    gross_billed: 0,
    company_share: 0,
    direct_cost: 0,
    cost_is_estimated: false,
    overhead_share: 0,
    credit_notes: 0,
    net_contribution: 0
  };

  const counts = data?.counts || { status: {}, cause: {} };
  const statusCounts = counts.status || {};
  const causeCounts = counts.cause || {};
  const uniqueClients = data?.unique_clients || [];
  const deals = data?.deals || [];
  const nonConvertedEnqs = data?.non_converted_enquiries || [];
  const breakdownByBd = data?.breakdown_by_bd || [];
  const insight = data?.insight;

  const displayedDeals = isExpandedAll ? deals : deals.slice(0, 5);
  const hasHiddenDeals = deals.length > 5;

  const isProblemFilterActive = statusFilter === 'loss' || statusFilter === 'credit_note_hit';
  const noProblemDeals = (statusCounts.loss || 0) === 0 && (statusCounts.credit_note_hit || 0) === 0;

  const clearAllFilters = () => {
    setStatusFilter('all');
    setCauseFilter('');
    setClientFilter('');
    setSortBy('worst_first');
  };

  const hasActiveFilters = statusFilter !== 'all' || causeFilter !== '' || clientFilter !== '';

  return (
    <div 
      className="modal-backdrop animate-fade-in" 
      onClick={handleClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(3px)',
        zIndex: 9999,
        display: 'flex',
        justifyContent: 'flex-end',
        transition: 'opacity 0.2s ease'
      }}
    >
      <div 
        className="audit-drawer-panel animate-slide-left"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '560px',
          background: 'var(--bg-card, #ffffff)',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-6px 0 30px rgba(0,0,0,0.22)',
          borderLeft: '1px solid var(--border-color, #e2e8f0)',
          position: 'relative'
        }}
      >
        {/* ========================================================================= */}
        {/* 1. FIXED HEADER                                                           */}
        {/* ========================================================================= */}
        <div style={{
          padding: '18px 22px',
          borderBottom: '1px solid var(--border-color, #e2e8f0)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          background: 'var(--bg-main, #f8fafc)',
          flexShrink: 0
        }}>
          <div>
            <div style={{
              fontSize: '0.70rem',
              fontWeight: '800',
              textTransform: 'uppercase',
              letterSpacing: '0.6px',
              color: 'var(--accent-teal, #0F6E56)'
            }}>
              {entityType.toUpperCase()} FINANCIAL LOSS & MARGIN AUDIT
            </div>
            <h2 style={{
              margin: '3px 0 0 0',
              fontSize: '1.25rem',
              fontWeight: '800',
              color: 'var(--text-main, #0f172a)',
              letterSpacing: '-0.01em'
            }}>
              {entityName || entityId}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px' }}>
              {entityRole && (
                <span style={{ fontSize: '0.76rem', color: 'var(--text-muted, #64748b)', fontWeight: '600' }}>
                  {entityRole}
                </span>
              )}
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)' }}>•</span>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted, #64748b)' }}>
                {month === 'all' ? `Full FY ${financialYear}` : month}
              </span>
            </div>
          </div>

          <button
            onClick={handleClose}
            aria-label="Close Audit Drawer"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted, #64748b)',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.15s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.06)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <X size={20} />
          </button>
        </div>

        {/* ========================================================================= */}
        {/* SCROLLABLE BODY                                                           */}
        {/* ========================================================================= */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '18px 22px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          {/* 2. COMMERCIAL EQUATION BREAKDOWN (COMPACT & TIGHTER ROW SPACING) */}
          <div style={{
            background: 'var(--bg-main, #f8fafc)',
            border: '1px solid var(--border-color, #e2e8f0)',
            borderRadius: '8px',
            padding: '12px 14px'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '8px'
            }}>
              <span style={{ fontSize: '0.74rem', fontWeight: '800', color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                Commercial Equation Breakdown
              </span>
              <span style={{ fontSize: '0.70rem', color: 'var(--text-muted, #64748b)' }}>
                {summary.total_deals} active deals
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '0.79rem' }}>
              {/* Gross Billed */}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted, #64748b)' }}>Gross Billed:</span>
                <span style={{ fontWeight: '700', color: 'var(--text-main, #0f172a)' }}>
                  {formatCurrency(summary.gross_billed)}
                </span>
              </div>

              {/* Company Share */}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted, #64748b)' }}>Company Share (ourShare):</span>
                <span style={{ fontWeight: '700', color: '#0F6E56' }}>
                  +{formatCurrency(summary.company_share)}
                </span>
              </div>

              {/* Direct Payroll / Seat Cost */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-muted, #64748b)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  Direct Payroll / Seat Cost:
                  {summary.cost_is_estimated && (
                    <span style={{
                      fontSize: '0.62rem',
                      padding: '1px 4px',
                      borderRadius: '3px',
                      background: 'rgba(245, 158, 11, 0.15)',
                      color: '#b45309',
                      fontWeight: '700'
                    }}>
                      estimated
                    </span>
                  )}
                </span>
                <span style={{ fontWeight: '700', color: '#dc2626' }}>
                  -{formatCurrency(summary.direct_cost)}
                </span>
              </div>

              {/* Shared Overhead Pool Share */}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted, #64748b)' }}>Shared Overhead Pool Share:</span>
                <span style={{ fontWeight: '700', color: '#dc2626' }}>
                  -{formatCurrency(summary.overhead_share)}
                </span>
              </div>

              {/* Credit Note Loss Reversals */}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted, #64748b)' }}>Credit Note Loss Reversals:</span>
                <span style={{ fontWeight: '700', color: summary.credit_notes > 0 ? '#dc2626' : 'var(--text-muted, #64748b)' }}>
                  {summary.credit_notes > 0 ? `-${formatCurrency(summary.credit_notes)}` : '₹0'}
                </span>
              </div>

              <div style={{ height: '1px', background: 'var(--border-color, #e2e8f0)', margin: '3px 0' }} />

              {/* Net Bank Contribution */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.88rem' }}>
                <span style={{ fontWeight: '800', color: 'var(--text-main, #0f172a)' }}>
                  Net Bank Contribution:
                </span>
                <span style={{
                  fontWeight: '800',
                  color: summary.net_contribution >= 0 ? '#0F6E56' : '#dc2626'
                }}>
                  {summary.net_contribution >= 0 ? '+' : ''}{formatCurrency(summary.net_contribution)}
                </span>
              </div>
            </div>
          </div>

          {/* BREAKDOWN BY BD (FOR TL, FRANCHISEE, CITY, INDUSTRY) */}
          {entityType !== 'bd' && breakdownByBd.length > 0 && (
            <div style={{
              background: 'var(--bg-card, #ffffff)',
              border: '1px solid var(--border-color, #e2e8f0)',
              borderRadius: '8px',
              padding: '12px 14px'
            }}>
              <div style={{ fontSize: '0.74rem', fontWeight: '800', color: 'var(--text-muted, #64748b)', textTransform: 'uppercase', marginBottom: '8px' }}>
                BD Contributors & Loss Drains
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {breakdownByBd.map((b, i) => (
                  <div 
                    key={i} 
                    style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      fontSize: '0.76rem',
                      padding: '4px 0',
                      borderBottom: i < breakdownByBd.length - 1 ? '1px dashed var(--border-color, #e2e8f0)' : 'none'
                    }}
                  >
                    <div>
                      <strong style={{ color: 'var(--text-main, #0f172a)' }}>{b.name}</strong>
                      <span style={{ color: 'var(--text-muted, #64748b)', marginLeft: '6px', fontSize: '0.70rem' }}>
                        ({b.deals} deals)
                      </span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontWeight: '700', color: b.net >= 0 ? '#0F6E56' : '#dc2626' }}>
                        {b.net >= 0 ? '+' : ''}{formatCurrency(b.net)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 3. FILTER BAR (SINGLE LINE, HORIZONTALLY SCROLLABLE)                       */}
          {/* ========================================================================= */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            {/* Scrollable Filters Row */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              overflowX: 'auto',
              paddingBottom: '4px',
              scrollbarWidth: 'thin'
            }}>
              {/* STATUS FILTER CHIPS */}
              <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                {/* All */}
                <button
                  onClick={() => setStatusFilter('all')}
                  style={{
                    padding: '4px 9px',
                    borderRadius: '16px',
                    fontSize: '0.72rem',
                    fontWeight: statusFilter === 'all' ? '700' : '500',
                    border: '1px solid',
                    borderColor: statusFilter === 'all' ? 'var(--accent-teal, #0F6E56)' : 'var(--border-color, #e2e8f0)',
                    background: statusFilter === 'all' ? 'var(--accent-teal, #0F6E56)' : 'transparent',
                    color: statusFilter === 'all' ? '#ffffff' : 'var(--text-muted, #64748b)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  All ({statusCounts.all || 0})
                </button>

                {/* Loss (Hide if 0) */}
                {(statusCounts.loss || 0) > 0 && (
                  <button
                    onClick={() => setStatusFilter(prev => prev === 'loss' ? 'all' : 'loss')}
                    style={{
                      padding: '4px 9px',
                      borderRadius: '16px',
                      fontSize: '0.72rem',
                      fontWeight: statusFilter === 'loss' ? '700' : '500',
                      border: '1px solid',
                      borderColor: statusFilter === 'loss' ? '#dc2626' : 'rgba(220, 38, 38, 0.3)',
                      background: statusFilter === 'loss' ? '#dc2626' : 'rgba(220, 38, 38, 0.05)',
                      color: statusFilter === 'loss' ? '#ffffff' : '#dc2626',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    Loss ({statusCounts.loss})
                  </button>
                )}

                {/* Low margin (Hide if 0) */}
                {(statusCounts.low_margin || 0) > 0 && (
                  <button
                    onClick={() => setStatusFilter(prev => prev === 'low_margin' ? 'all' : 'low_margin')}
                    style={{
                      padding: '4px 9px',
                      borderRadius: '16px',
                      fontSize: '0.72rem',
                      fontWeight: statusFilter === 'low_margin' ? '700' : '500',
                      border: '1px solid',
                      borderColor: statusFilter === 'low_margin' ? '#d97706' : 'rgba(217, 119, 6, 0.3)',
                      background: statusFilter === 'low_margin' ? '#d97706' : 'rgba(217, 119, 6, 0.05)',
                      color: statusFilter === 'low_margin' ? '#ffffff' : '#d97706',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    Low margin ({statusCounts.low_margin})
                  </button>
                )}

                {/* Credit note hit (Hide if 0) */}
                {(statusCounts.credit_note_hit || 0) > 0 && (
                  <button
                    onClick={() => setStatusFilter(prev => prev === 'credit_note_hit' ? 'all' : 'credit_note_hit')}
                    style={{
                      padding: '4px 9px',
                      borderRadius: '16px',
                      fontSize: '0.72rem',
                      fontWeight: statusFilter === 'credit_note_hit' ? '700' : '500',
                      border: '1px solid',
                      borderColor: statusFilter === 'credit_note_hit' ? '#7c3aed' : 'rgba(124, 58, 237, 0.3)',
                      background: statusFilter === 'credit_note_hit' ? '#7c3aed' : 'rgba(124, 58, 237, 0.05)',
                      color: statusFilter === 'credit_note_hit' ? '#ffffff' : '#7c3aed',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    Credit note hit ({statusCounts.credit_note_hit})
                  </button>
                )}

                {/* Healthy (Hide if 0) */}
                {(statusCounts.healthy || 0) > 0 && (
                  <button
                    onClick={() => setStatusFilter(prev => prev === 'healthy' ? 'all' : 'healthy')}
                    style={{
                      padding: '4px 9px',
                      borderRadius: '16px',
                      fontSize: '0.72rem',
                      fontWeight: statusFilter === 'healthy' ? '700' : '500',
                      border: '1px solid',
                      borderColor: statusFilter === 'healthy' ? '#0F6E56' : 'rgba(15, 110, 86, 0.3)',
                      background: statusFilter === 'healthy' ? '#0F6E56' : 'rgba(15, 110, 86, 0.05)',
                      color: statusFilter === 'healthy' ? '#ffffff' : '#0F6E56',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    Healthy ({statusCounts.healthy})
                  </button>
                )}
              </div>

              <div style={{ width: '1px', height: '18px', background: 'var(--border-color, #e2e8f0)', flexShrink: 0 }} />

              {/* CAUSE FILTER CHIPS */}
              <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                {/* Credit notes cause (Hide if 0) */}
                {causeCounts.credit_notes?.amount > 0 && (
                  <button
                    onClick={() => setCauseFilter(prev => prev === 'credit_notes' ? '' : 'credit_notes')}
                    style={{
                      padding: '4px 9px',
                      borderRadius: '16px',
                      fontSize: '0.72rem',
                      fontWeight: causeFilter === 'credit_notes' ? '700' : '500',
                      border: '1px solid',
                      borderColor: causeFilter === 'credit_notes' ? '#dc2626' : 'rgba(220, 38, 38, 0.3)',
                      background: causeFilter === 'credit_notes' ? '#dc2626' : 'transparent',
                      color: causeFilter === 'credit_notes' ? '#ffffff' : '#dc2626',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    Credit notes {formatCurrency(causeCounts.credit_notes.amount)}
                  </button>
                )}

                {/* Cost drag cause (Hide if 0) */}
                {causeCounts.cost_drag?.amount > 0 && (
                  <button
                    onClick={() => setCauseFilter(prev => prev === 'cost_drag' ? '' : 'cost_drag')}
                    style={{
                      padding: '4px 9px',
                      borderRadius: '16px',
                      fontSize: '0.72rem',
                      fontWeight: causeFilter === 'cost_drag' ? '700' : '500',
                      border: '1px solid',
                      borderColor: causeFilter === 'cost_drag' ? '#d97706' : 'rgba(217, 119, 6, 0.3)',
                      background: causeFilter === 'cost_drag' ? '#d97706' : 'transparent',
                      color: causeFilter === 'cost_drag' ? '#ffffff' : '#d97706',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    Cost drag {formatCurrency(causeCounts.cost_drag.amount)}
                  </button>
                )}

                {/* No conversion cause (Hide if 0) */}
                {causeCounts.no_conversion?.amount > 0 && (
                  <button
                    onClick={() => setCauseFilter(prev => prev === 'no_conversion' ? '' : 'no_conversion')}
                    style={{
                      padding: '4px 9px',
                      borderRadius: '16px',
                      fontSize: '0.72rem',
                      fontWeight: causeFilter === 'no_conversion' ? '700' : '500',
                      border: '1px solid',
                      borderColor: causeFilter === 'no_conversion' ? '#4f46e5' : 'rgba(79, 70, 229, 0.3)',
                      background: causeFilter === 'no_conversion' ? '#4f46e5' : 'transparent',
                      color: causeFilter === 'no_conversion' ? '#ffffff' : '#4f46e5',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    No conversion {formatCurrency(causeCounts.no_conversion.amount)}
                  </button>
                )}
              </div>

              {/* CLIENT DROPDOWN (ONLY IF > 2 CLIENTS) */}
              {uniqueClients.length > 2 && (
                <div style={{ flexShrink: 0 }}>
                  <select
                    value={clientFilter}
                    onChange={(e) => setClientFilter(e.target.value)}
                    style={{
                      padding: '3px 8px',
                      borderRadius: '14px',
                      border: '1px solid var(--border-color, #e2e8f0)',
                      background: 'var(--bg-main, #f8fafc)',
                      color: 'var(--text-main, #0f172a)',
                      fontSize: '0.72rem',
                      fontWeight: clientFilter ? '700' : '500',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="">All Clients ({uniqueClients.length})</option>
                    {uniqueClients.map(c => (
                      <option key={c} value={c.toLowerCase()}>{c}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* SORT TOGGLE */}
              <div style={{ flexShrink: 0, marginLeft: 'auto' }}>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  style={{
                    padding: '3px 8px',
                    borderRadius: '14px',
                    border: '1px solid var(--border-color, #e2e8f0)',
                    background: 'var(--bg-main, #f8fafc)',
                    color: 'var(--text-main, #0f172a)',
                    fontSize: '0.72rem',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  <option value="worst_first">Sort: Worst first</option>
                  <option value="highest_billed">Sort: Highest billed</option>
                  <option value="latest">Sort: Latest</option>
                </select>
              </div>
            </div>

            {/* Removable Active Filter Chips & Clear Link */}
            {hasActiveFilters && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', fontSize: '0.70rem' }}>
                <span style={{ color: 'var(--text-muted, #64748b)' }}>Active filters:</span>
                {statusFilter !== 'all' && (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: 'var(--bg-main, #f8fafc)',
                    border: '1px solid var(--border-color, #e2e8f0)',
                    padding: '1px 6px',
                    borderRadius: '4px'
                  }}>
                    Status: {statusFilter.replace('_', ' ')}
                    <X size={10} style={{ cursor: 'pointer' }} onClick={() => setStatusFilter('all')} />
                  </span>
                )}
                {causeFilter && (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: 'var(--bg-main, #f8fafc)',
                    border: '1px solid var(--border-color, #e2e8f0)',
                    padding: '1px 6px',
                    borderRadius: '4px'
                  }}>
                    Cause: {causeFilter.replace('_', ' ')}
                    <X size={10} style={{ cursor: 'pointer' }} onClick={() => setCauseFilter('')} />
                  </span>
                )}
                {clientFilter && (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: 'var(--bg-main, #f8fafc)',
                    border: '1px solid var(--border-color, #e2e8f0)',
                    padding: '1px 6px',
                    borderRadius: '4px'
                  }}>
                    Client: {clientFilter}
                    <X size={10} style={{ cursor: 'pointer' }} onClick={() => setClientFilter('')} />
                  </span>
                )}
                <button
                  onClick={clearAllFilters}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent-teal, #0F6E56)',
                    cursor: 'pointer',
                    fontSize: '0.70rem',
                    fontWeight: '700',
                    textDecoration: 'underline',
                    padding: 0
                  }}
                >
                  Clear all
                </button>
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* RULE-BASED INSIGHT LINE (BELOW FILTER BAR, CLICKABLE)                     */}
          {/* ========================================================================= */}
          {insight && (
            <div 
              onClick={() => {
                // If insight mentions credit notes, activate credit notes cause
                if (insight.toLowerCase().includes('credit note')) setCauseFilter('credit_notes');
                else if (insight.toLowerCase().includes('cost drag')) setCauseFilter('cost_drag');
              }}
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                background: 'rgba(239, 68, 68, 0.06)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                fontSize: '0.74rem',
                color: '#b91c1c',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                transition: 'background 0.15s ease'
              }}
              title="Click to apply filter"
            >
              <Sparkles size={13} color="#b91c1c" />
              <span style={{ fontWeight: '600' }}>{insight}</span>
            </div>
          )}

          {/* QUIET NOTE WHEN NO LOSS-MAKING DEALS */}
          {noProblemDeals && (
            <div style={{
              fontSize: '0.74rem',
              color: 'var(--text-muted, #64748b)',
              fontStyle: 'italic',
              padding: '4px 0'
            }}>
              No loss-making deals this month. Showing all historical closures.
            </div>
          )}

          {/* ========================================================================= */}
          {/* 4. DEALS LIST (COMPACT, FILTERED RESULT)                                  */}
          {/* ========================================================================= */}
          <div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '8px'
            }}>
              <span style={{ fontSize: '0.76rem', fontWeight: '800', color: 'var(--text-main, #0f172a)' }}>
                {causeFilter === 'no_conversion' 
                  ? `Non-Converted Enquiries (${nonConvertedEnqs.length})` 
                  : `Deals & Invoices (${deals.length})`}
              </span>
              {hasHiddenDeals && causeFilter !== 'no_conversion' && (
                <button
                  onClick={() => setIsExpandedAll(prev => !prev)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent-teal, #0F6E56)',
                    cursor: 'pointer',
                    fontSize: '0.72rem',
                    fontWeight: '700',
                    padding: 0
                  }}
                >
                  {isExpandedAll ? 'Show top 5' : `View all ${deals.length}`}
                </button>
              )}
            </div>

            {/* LOADING SKELETON */}
            {loading && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[1, 2, 3].map(n => (
                  <div 
                    key={n}
                    style={{
                      height: '52px',
                      borderRadius: '6px',
                      background: 'rgba(0,0,0,0.04)',
                      animation: 'pulse 1.2s infinite'
                    }}
                  />
                ))}
              </div>
            )}

            {/* ERROR STATE */}
            {error && !loading && (
              <div style={{
                padding: '16px',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.06)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                color: '#b91c1c',
                fontSize: '0.78rem',
                textAlign: 'center'
              }}>
                <div>{error}</div>
                <button
                  onClick={() => fetchAuditData(false)}
                  style={{
                    marginTop: '8px',
                    padding: '4px 10px',
                    borderRadius: '4px',
                    border: '1px solid #b91c1c',
                    background: '#ffffff',
                    color: '#b91c1c',
                    fontSize: '0.72rem',
                    cursor: 'pointer'
                  }}
                >
                  Retry Audit
                </button>
              </div>
            )}

            {/* EMPTY STATE */}
            {!loading && !error && deals.length === 0 && causeFilter !== 'no_conversion' && (
              <div style={{
                padding: '24px 16px',
                borderRadius: '8px',
                border: '1px dashed var(--border-color, #e2e8f0)',
                background: 'var(--bg-main, #f8fafc)',
                textAlign: 'center',
                color: 'var(--text-muted, #64748b)',
                fontSize: '0.78rem'
              }}>
                No deals match the selected status or cause filter for this period.
              </div>
            )}

            {/* NON-CONVERTED ENQUIRIES SUMMARY VIEW (WHEN CAUSE = NO_CONVERSION) */}
            {!loading && !error && causeFilter === 'no_conversion' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {nonConvertedEnqs.length === 0 ? (
                  <div style={{
                    padding: '20px',
                    borderRadius: '6px',
                    border: '1px dashed var(--border-color, #e2e8f0)',
                    textAlign: 'center',
                    color: 'var(--text-muted, #64748b)',
                    fontSize: '0.76rem'
                  }}>
                    No non-converted enquiries recorded for this period.
                  </div>
                ) : (
                  nonConvertedEnqs.map((enq, idx) => (
                    <div
                      key={enq.id || idx}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color, #e2e8f0)',
                        background: 'var(--bg-card, #ffffff)',
                        fontSize: '0.76rem'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <strong style={{ color: 'var(--text-main, #0f172a)' }}>{enq.company_name}</strong>
                          <div style={{ fontSize: '0.70rem', color: 'var(--text-muted, #64748b)', marginTop: '2px' }}>
                            {enq.position_name} • Allocated: {enq.allocation_date}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '0.66rem',
                            fontWeight: '700',
                            background: 'rgba(239, 68, 68, 0.1)',
                            color: '#b91c1c'
                          }}>
                            {enq.enquiry_status}
                          </span>
                          <div style={{ fontSize: '0.70rem', color: '#dc2626', marginTop: '3px', fontWeight: '600' }}>
                            Cost drag: -{formatCurrency(enq.cost_drag)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* REGULAR DEALS COMPACT LIST WITH INLINE EXPANSION */}
            {!loading && !error && causeFilter !== 'no_conversion' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {displayedDeals.map((deal) => {
                  const isExpanded = expandedRowId === deal.id;
                  const isLoss = deal.net_per_deal < 0;

                  // Status dot colors
                  let statusBg = '#10B981';
                  if (deal.status_pill === 'loss') statusBg = '#DC2626';
                  else if (deal.status_pill === 'low_margin') statusBg = '#D97706';
                  else if (deal.status_pill === 'credit_note_hit') statusBg = '#7C3AED';

                  return (
                    <div
                      key={deal.id}
                      onClick={() => setExpandedRowId(prev => prev === deal.id ? null : deal.id)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '6px',
                        border: '1px solid',
                        borderColor: isExpanded ? 'var(--accent-teal, #0F6E56)' : 'var(--border-color, #e2e8f0)',
                        background: isExpanded ? 'rgba(15, 110, 86, 0.02)' : 'var(--bg-card, #ffffff)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {/* Compact Stacked Row: Client (bold) + Candidate (muted), Gross Billed, Net Per Deal, Status Dot */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ flex: 1, minWidth: 0, paddingRight: '12px' }}>
                          <div style={{
                            fontWeight: '700',
                            fontSize: '0.80rem',
                            color: 'var(--text-main, #0f172a)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {deal.client_name}
                          </div>
                          <div style={{
                            fontSize: '0.71rem',
                            color: 'var(--text-muted, #64748b)',
                            marginTop: '2px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {deal.candidate_name} • {deal.position_name}
                          </div>
                        </div>

                        {/* Financial Figures & Status Dot */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0 }}>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.71rem', color: 'var(--text-muted, #64748b)' }}>
                              Billed: {formatCurrency(deal.gross_billed)}
                            </div>
                            <div style={{
                              fontWeight: '800',
                              fontSize: '0.82rem',
                              color: isLoss ? '#dc2626' : '#0F6E56',
                              marginTop: '1px'
                            }}>
                              Net: {deal.net_per_deal >= 0 ? '+' : ''}{formatCurrency(deal.net_per_deal)}
                            </div>
                          </div>

                          <div 
                            title={deal.status_label}
                            style={{
                              width: '9px',
                              height: '9px',
                              borderRadius: '50%',
                              backgroundColor: statusBg
                            }} 
                          />
                        </div>
                      </div>

                      {/* INLINE EXPANSION ACCORDION (ONLY ONE ROW OPEN AT A TIME) */}
                      {isExpanded && (
                        <div 
                          className="animate-fade-in"
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            marginTop: '10px',
                            paddingTop: '10px',
                            borderTop: '1px dashed var(--border-color, #e2e8f0)',
                            fontSize: '0.73rem',
                            color: 'var(--text-main, #0f172a)',
                            display: 'grid',
                            gridTemplateColumns: 'repeat(2, 1fr)',
                            gap: '8px'
                          }}
                        >
                          <div>
                            <span style={{ color: 'var(--text-muted, #64748b)' }}>Placement Date:</span>{' '}
                            <strong>{deal.placement_date || 'N/A'}</strong>
                          </div>

                          <div>
                            <span style={{ color: 'var(--text-muted, #64748b)' }}>Invoice Ref:</span>{' '}
                            <strong>{deal.bill_number}</strong>
                          </div>

                          <div>
                            <span style={{ color: 'var(--text-muted, #64748b)' }}>Company Share:</span>{' '}
                            <strong style={{ color: '#0F6E56' }}>+{formatCurrency(deal.company_share)}</strong>
                          </div>

                          <div>
                            <span style={{ color: 'var(--text-muted, #64748b)' }}>Direct Cost (allocated):</span>{' '}
                            <strong style={{ color: '#dc2626' }}>-{formatCurrency(deal.allocated_cost)}</strong>
                          </div>

                          {/* Credit Note Amount & Reason (if applicable) */}
                          {deal.credit_note_amount > 0 && (
                            <div style={{ gridColumn: 'span 2', background: 'rgba(239, 68, 68, 0.05)', padding: '6px 8px', borderRadius: '4px', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
                              <div>
                                <span style={{ color: '#b91c1c', fontWeight: '700' }}>Credit Note Amount:</span>{' '}
                                <strong style={{ color: '#b91c1c' }}>-{formatCurrency(deal.credit_note_amount)}</strong>
                              </div>
                              <div style={{ marginTop: '2px' }}>
                                <span style={{ color: 'var(--text-muted, #64748b)' }}>Reason:</span>{' '}
                                <strong>{deal.credit_note_reason || 'Credit note'}</strong>
                              </div>
                              {deal.remark && (
                                <div style={{ marginTop: '2px', fontStyle: 'italic', color: 'var(--text-muted, #64748b)' }}>
                                  Remark: {deal.remark}
                                </div>
                              )}
                            </div>
                          )}

                          {deal.bd_name && entityType !== 'bd' && (
                            <div style={{ gridColumn: 'span 2' }}>
                              <span style={{ color: 'var(--text-muted, #64748b)' }}>BD Specialist:</span>{' '}
                              <strong>{deal.bd_name}</strong>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 5. FIXED CLOSE BUTTON AT BOTTOM                                           */}
        {/* ========================================================================= */}
        <div style={{
          padding: '14px 22px',
          borderTop: '1px solid var(--border-color, #e2e8f0)',
          background: 'var(--bg-main, #f8fafc)',
          flexShrink: 0
        }}>
          <button
            onClick={handleClose}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '8px',
              border: 'none',
              background: 'var(--accent-teal, #0F6E56)',
              color: '#ffffff',
              fontWeight: '700',
              fontSize: '0.84rem',
              cursor: 'pointer',
              transition: 'background 0.15s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.92'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1.0'}
          >
            Close Audit Panel
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuditDrawer;
