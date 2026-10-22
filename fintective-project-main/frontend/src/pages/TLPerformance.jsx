import React, { useContext, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { FinanceContext, API_BASE_URL } from '../context/FinanceContext';
import { fetchWithApiKey } from '../utils/apiClient';
import { formatCurrency, formatLakhs, formatDate } from '../utils/formatters';
import { 
  Users, 
  ChevronDown, 
  Search, 
  Download, 
  HelpCircle, 
  ArrowRight, 
  ChevronRight, 
  X, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  FileSpreadsheet
} from 'lucide-react';
import './TLPerformance.css';

// --------------------------------------------------------------------------
// 1. Controls Component (Single-Line Header)
// --------------------------------------------------------------------------
function TLControls({
  teamLeaders = [],
  selectedTlId,
  onSelectTl,
  financialYear,
  onSelectYear,
  availableYears = [],
  lookbackMonths,
  onSelectLookback,
  portfolioTotals,
  onExportCSV,
  onViewProfitability,
  isSyncing = false
}) {
  const [isTlDropdownOpen, setIsTlDropdownOpen] = useState(false);
  const [tlSearchQuery, setTlSearchQuery] = useState('');
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const dropdownRef = useRef(null);
  const helpRef = useRef(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsTlDropdownOpen(false);
      }
      if (helpRef.current && !helpRef.current.contains(e.target)) {
        setIsHelpOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const filteredTLs = useMemo(() => {
    if (!tlSearchQuery.trim()) return teamLeaders;
    const q = tlSearchQuery.toLowerCase();
    return teamLeaders.filter(tl => 
      (tl.name || '').toLowerCase().includes(q)
    );
  }, [teamLeaders, tlSearchQuery]);

  const selectedTLObj = useMemo(() => {
    return teamLeaders.find(tl => tl.name === selectedTlId || tl.id === selectedTlId) || { name: selectedTlId || 'Select Team Leader' };
  }, [teamLeaders, selectedTlId]);

  return (
    <div className="tl-controls-card">
      <div className="tl-controls-left">
        {/* Searchable TL Select */}
        <div className="tl-select-container" ref={dropdownRef}>
          <button
            type="button"
            className="tl-select-btn"
            onClick={() => setIsTlDropdownOpen(!isTlDropdownOpen)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
              <Users size={15} style={{ color: 'var(--accent-teal, #0f6e56)', flexShrink: 0 }} />
              <span className="truncate">{selectedTLObj.name}</span>
              {selectedTLObj.franchiseesCount != null && (
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted, #6b7268)', fontWeight: 'normal' }}>
                  ({selectedTLObj.franchiseesCount} accounts)
                </span>
              )}
            </div>
            <ChevronDown size={14} style={{ color: 'var(--text-muted, #6b7268)', flexShrink: 0 }} />
          </button>

          {isTlDropdownOpen && (
            <div className="tl-select-dropdown">
              <input
                type="text"
                className="tl-select-search"
                placeholder="Search Team Leader..."
                value={tlSearchQuery}
                onChange={(e) => setTlSearchQuery(e.target.value)}
                autoFocus
              />
              <div className="tl-select-list">
                {filteredTLs.length === 0 ? (
                  <div style={{ padding: '8px', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted, #6b7268)' }}>
                    No matching Team Leaders
                  </div>
                ) : (
                  filteredTLs.map(tl => {
                    const isSelected = tl.name === selectedTlId || tl.id === selectedTlId;
                    return (
                      <div
                        key={tl.id || tl.name}
                        className={`tl-select-item ${isSelected ? 'selected' : ''}`}
                        onClick={() => {
                          onSelectTl(tl.name || tl.id);
                          setIsTlDropdownOpen(false);
                        }}
                      >
                        <span>{tl.name}</span>
                        {tl.franchiseesCount != null && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted, #6b7268)' }}>
                            {tl.franchiseesCount} accounts
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Financial Year Select */}
        <select
          value={financialYear}
          onChange={(e) => onSelectYear(e.target.value)}
          style={{
            padding: '7px 10px',
            fontSize: '0.82rem',
            fontWeight: '600',
            border: '1px solid var(--border-color, #e3e5e0)',
            borderRadius: '6px',
            background: 'var(--bg-card, #ffffff)',
            color: 'var(--text-main, #1b2321)',
            cursor: 'pointer'
          }}
        >
          {availableYears.map(y => (
            <option key={y} value={y}>{y === 'All Years' ? 'All Financial Years' : `FY ${y}`}</option>
          ))}
        </select>

        {/* Lookback Toggle (6M / 12M / 24M) */}
        <div className="tl-lookback-group">
          {[6, 12, 24].map((m) => (
            <button
              key={m}
              type="button"
              className={`tl-lookback-btn ${lookbackMonths === m ? 'active' : ''}`}
              onClick={() => onSelectLookback(m)}
            >
              {m}M
            </button>
          ))}
        </div>

        {/* View Profitability Link */}
        <button
          type="button"
          onClick={onViewProfitability}
          className="tl-link-action"
          style={{ background: 'transparent', border: 'none' }}
        >
          <span>View profitability</span>
          <ArrowRight size={13} />
        </button>
      </div>

      <div className="tl-controls-right">
        {/* Status Indicator Dot */}
        <div className="tl-status-indicator">
          <span className={`tl-status-dot ${isSyncing ? 'syncing' : ''}`} />
          <span>{isSyncing ? 'Syncing…' : 'Updated 2m ago'}</span>
        </div>

        {/* Export CSV Button */}
        <button
          type="button"
          onClick={onExportCSV}
          className="btn"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            fontSize: '0.78rem',
            fontWeight: '600',
            border: '1px solid var(--border-color, #e3e5e0)',
            borderRadius: '6px',
            background: 'var(--bg-card, #ffffff)',
            color: 'var(--text-main, #1b2321)',
            cursor: 'pointer'
          }}
        >
          <Download size={13} />
          <span>Export CSV</span>
        </button>

        {/* "?" Help Menu */}
        <div style={{ position: 'relative' }} ref={helpRef}>
          <button
            type="button"
            className="tl-help-btn"
            onClick={() => setIsHelpOpen(!isHelpOpen)}
            title="Collections Workflow Guide"
          >
            <HelpCircle size={15} />
          </button>

          {isHelpOpen && (
            <div className="tl-help-popover">
              <div style={{ fontWeight: '700', marginBottom: '6px', color: 'var(--text-main, #1b2321)' }}>
                Team Leader Collections Guide
              </div>
              <p style={{ margin: '0 0 8px 0' }}>
                This worklist tracks gross commercial billing, collected cash inflows, and accounts requiring collection attention across all franchisees assigned to the selected Team Leader.
              </p>
              <ul style={{ margin: 0, paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <li><strong>Billed:</strong> Gross invoiced value excluding credit notes.</li>
                <li><strong>Received:</strong> Realized cash inflows settled by corporate clients.</li>
                <li><strong>Needs Attention:</strong> Outstanding invoices and cancelled contracts requiring recovery action.</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// 2. Three Calm KPI Cards Component
// --------------------------------------------------------------------------
function TLKpiRow({ totals = {}, openItemsCount = 0 }) {
  const billed = totals.gross || 0;
  const received = totals.received || 0;
  const receivedPct = totals.received_pct || (billed > 0 ? ((received / billed) * 100).toFixed(1) : 0);
  const outstanding = totals.outstanding || 0;
  const cancelled = totals.cancelled || 0;
  const needsAttention = outstanding + cancelled;

  return (
    <section className="tl-kpi-grid">
      {/* 1. BILLED (Gross) */}
      <div className="tl-kpi-card">
        <div className="tl-kpi-label">
          <span>Billed</span>
        </div>
        <h2 className="tl-kpi-value tabular-nums">
          {formatLakhs(billed)}
        </h2>
        <div className="tl-kpi-sub">
          <span>Gross commercial volume</span>
        </div>
      </div>

      {/* 2. RECEIVED */}
      <div className="tl-kpi-card">
        <div className="tl-kpi-label">
          <span>Received</span>
        </div>
        <h2 className={`tl-kpi-value tabular-nums ${received > 0 ? 'text-received' : 'text-zero'}`}>
          {formatLakhs(received)}
        </h2>
        <div className="tl-kpi-sub">
          <span className={received > 0 ? 'text-received' : ''} style={{ fontWeight: '600' }}>
            {receivedPct}% of billed
          </span>
        </div>
      </div>

      {/* 3. NEEDS ATTENTION */}
      <div className="tl-kpi-card">
        <div className="tl-kpi-label">
          <span>Needs Attention</span>
          {openItemsCount > 0 && (
            <span style={{
              fontSize: '0.68rem',
              fontWeight: '700',
              padding: '2px 6px',
              borderRadius: '10px',
              background: '#fff1f2',
              color: '#a8402e',
              border: '1px solid #fecdd3'
            }}>
              {openItemsCount} open {openItemsCount === 1 ? 'item' : 'items'}
            </span>
          )}
        </div>
        <h2 className={`tl-kpi-value tabular-nums ${needsAttention > 0 ? 'text-alert' : 'text-zero'}`}>
          {formatLakhs(needsAttention)}
        </h2>
        <div className="tl-kpi-sub">
          <span>
            Outstanding: {formatLakhs(outstanding)} • Cancelled: {formatLakhs(cancelled)}
          </span>
        </div>
      </div>
    </section>
  );
}

// --------------------------------------------------------------------------
// 3. Collection Trend Chart Component (Left Column)
// --------------------------------------------------------------------------
function TLTrendChart({ monthlyTrend = [], isVisibleOnMobile, onToggleMobile }) {
  if (!monthlyTrend || monthlyTrend.length === 0) {
    return (
      <div className="tl-analytics-card">
        <div className="tl-card-header">
          <h3 className="tl-card-title">12-Month Collection Trend</h3>
        </div>
        <p style={{ color: 'var(--text-muted, #6b7268)', fontSize: '0.78rem', margin: '20px 0', textAlign: 'center' }}>
          No monthly trend records available for this period.
        </p>
      </div>
    );
  }

  const width = 560;
  const height = 130;
  const padX = 35;
  const padY = 16;
  const plotW = width - padX * 2;
  const plotH = height - padY * 2;

  const maxVal = Math.max(
    ...monthlyTrend.map(d => Math.max(d.received || 0, d.outstanding || 0, d.cancelled || 0)),
    1000
  ) * 1.15;

  const getX = (idx) => padX + (idx / Math.max(1, monthlyTrend.length - 1)) * plotW;
  const getY = (val) => padY + plotH - ((val || 0) / maxVal) * plotH;

  const zeroY = padY + plotH;

  // Received Line
  const recLine = monthlyTrend.map((d, i) => `${getX(i).toFixed(1)},${getY(d.received).toFixed(1)}`).join(' L ');

  // Outstanding Shaded Area
  const outPoints = monthlyTrend.map((d, i) => `${getX(i).toFixed(1)},${getY(d.outstanding).toFixed(1)}`).join(' L ');
  const outArea = `M ${getX(0).toFixed(1)},${zeroY} L ${outPoints} L ${getX(monthlyTrend.length - 1).toFixed(1)},${zeroY} Z`;

  // Cancelled Line (only rendered if non-zero across the trend)
  const hasCancelled = monthlyTrend.some(d => (d.cancelled || 0) > 0);
  const cancLine = hasCancelled 
    ? monthlyTrend.map((d, i) => `${getX(i).toFixed(1)},${getY(d.cancelled).toFixed(1)}`).join(' L ')
    : '';

  return (
    <div className="tl-analytics-card">
      <div className="tl-card-header">
        <div>
          <h3 className="tl-card-title">12-Month Collection Trend</h3>
          <span className="tl-card-subtitle">Monthly received cash inflows vs outstanding pipeline</span>
        </div>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="tl-trend-svg">
        {/* Grid lines */}
        <line x1={padX} y1={zeroY} x2={width - padX} y2={zeroY} stroke="#e3e5e0" strokeWidth="1" />
        <line x1={padX} y1={padY + plotH / 2} x2={width - padX} y2={padY + plotH / 2} stroke="#f1f2ef" strokeWidth="1" strokeDasharray="3 3" />

        {/* Shaded Outstanding Area */}
        <path d={outArea} fill="rgba(183, 121, 31, 0.12)" />

        {/* Outstanding Top Edge */}
        <path d={`M ${outPoints}`} fill="none" stroke="#B7791F" strokeWidth="1.5" strokeDasharray="3 2" />

        {/* Received Solid Line */}
        <path d={`M ${recLine}`} fill="none" stroke="#0F6E56" strokeWidth="2.5" strokeLinecap="round" />

        {/* Cancelled Line (only if non-zero) */}
        {hasCancelled && (
          <path d={`M ${cancLine}`} fill="none" stroke="#A8402E" strokeWidth="1.5" strokeDasharray="2 2" />
        )}

        {/* Month tick labels */}
        {monthlyTrend.map((d, i) => {
          if (monthlyTrend.length > 6 && i % 2 !== 0 && i !== monthlyTrend.length - 1) return null;
          return (
            <text
              key={d.month || i}
              x={getX(i)}
              y={height - 2}
              textAnchor="middle"
              fontSize="9"
              fill="#9ca3af"
            >
              {d.label || d.month}
            </text>
          );
        })}
      </svg>

      <div className="tl-trend-legend">
        <div className="tl-legend-item">
          <div className="tl-legend-color" style={{ background: '#0F6E56', height: '3px' }} />
          <span>Received (Collected)</span>
        </div>
        <div className="tl-legend-item">
          <div className="tl-legend-color" style={{ background: 'rgba(183, 121, 31, 0.35)', border: '1px solid #B7791F' }} />
          <span>Outstanding Area</span>
        </div>
        {hasCancelled && (
          <div className="tl-legend-item">
            <div className="tl-legend-color" style={{ background: '#A8402E', height: '2px' }} />
            <span>Cancelled Deals</span>
          </div>
        )}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// 4. Top 5 to Chase Component (Right Column)
// --------------------------------------------------------------------------
function TLChaseList({ topChaseList = [], onSelectFranchisee, onSeeAllHighRisk }) {
  return (
    <div className="tl-analytics-card">
      <div className="tl-card-header">
        <div>
          <h3 className="tl-card-title">Top 5 to Chase</h3>
          <span className="tl-card-subtitle">Accounts with most urgent pending balances</span>
        </div>
        {topChaseList.length > 0 && (
          <button
            type="button"
            className="tl-link-action"
            onClick={onSeeAllHighRisk}
            style={{ background: 'transparent', border: 'none' }}
          >
            <span>See all</span>
            <ArrowRight size={13} />
          </button>
        )}
      </div>

      {topChaseList.length === 0 ? (
        <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted, #6b7268)', fontSize: '0.8rem' }}>
          ✓ No urgent outstanding accounts for this Team Leader.
        </div>
      ) : (
        <div className="tl-chase-list">
          {topChaseList.map((f, idx) => {
            const daysText = f.avg_days_outstanding && f.avg_days_outstanding > 0 ? `${f.avg_days_outstanding}d aged` : '—';
            return (
              <div
                key={f.name || idx}
                className="tl-chase-item"
                onClick={() => onSelectFranchisee(f)}
                title="Click to view details in drawer"
              >
                <div>
                  <div className="tl-chase-name">{f.name}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #6b7268)' }}>
                    Billed: {formatLakhs(f.gross || 0)}
                  </div>
                </div>
                <div className="tl-chase-right">
                  <div className="tl-chase-amount tabular-nums">
                    {formatLakhs(f.outstanding || 0)}
                  </div>
                  <div className="tl-chase-age">{daysText}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------
// 5. Franchisee Worklist Table Component
// --------------------------------------------------------------------------
function TLFranchiseeTable({
  franchisees = [],
  activeFilter,
  onChangeFilter,
  filterCounts = {},
  searchQuery,
  onSearchChange,
  onSelectFranchisee,
  currentPage,
  onPageChange,
  itemsPerPage = 10
}) {
  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return franchisees.slice(start, start + itemsPerPage);
  }, [franchisees, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(franchisees.length / itemsPerPage) || 1;
  const startRow = franchisees.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endRow = Math.min(currentPage * itemsPerPage, franchisees.length);

  return (
    <div className="tl-table-card">
      <div className="tl-table-toolbar">
        {/* Filter Chips: [High risk N] [Outstanding N] [Cancelled N] [All N] */}
        <div className="tl-filter-chips">
          <button
            type="button"
            className={`tl-chip ${activeFilter === 'at_risk' ? 'active-alert' : ''}`}
            onClick={() => { onChangeFilter('at_risk'); onPageChange(1); }}
          >
            High risk ({filterCounts.at_risk || 0})
          </button>
          <button
            type="button"
            className={`tl-chip ${activeFilter === 'outstanding' ? 'active' : ''}`}
            onClick={() => { onChangeFilter('outstanding'); onPageChange(1); }}
          >
            Outstanding ({filterCounts.outstanding || 0})
          </button>
          <button
            type="button"
            className={`tl-chip ${activeFilter === 'cancelled' ? 'active' : ''}`}
            onClick={() => { onChangeFilter('cancelled'); onPageChange(1); }}
          >
            Cancelled ({filterCounts.cancelled || 0})
          </button>
          <button
            type="button"
            className={`tl-chip ${activeFilter === 'all' ? 'active' : ''}`}
            onClick={() => { onChangeFilter('all'); onPageChange(1); }}
          >
            All ({filterCounts.all || 0})
          </button>
        </div>

        {/* Search Input */}
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '8px', color: '#9ca3af' }} />
          <input
            type="text"
            className="tl-search-input"
            placeholder="Search franchisee..."
            value={searchQuery}
            onChange={(e) => { onSearchChange(e.target.value); onPageChange(1); }}
          />
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="tl-table">
          <thead>
            <tr>
              <th>Franchisee</th>
              <th style={{ textAlign: 'right' }}>Billed</th>
              <th style={{ textAlign: 'right' }}>Received</th>
              <th style={{ textAlign: 'right' }}>Outstanding</th>
              <th style={{ textAlign: 'center' }}>Risk</th>
              <th style={{ width: '40px' }} />
            </tr>
          </thead>
          <tbody>
            {paginatedList.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--text-muted, #6b7268)' }}>
                  No accounts found for the "{activeFilter}" filter.
                </td>
              </tr>
            ) : (
              paginatedList.map((f, idx) => {
                const billedVal = f.gross || 0;
                const recVal = f.received || 0;
                const outVal = f.outstanding || 0;

                // Risk categorization
                const riskKey = f.collection_risk?.band_key || (outVal > 0 ? 'at_risk' : 'settled');
                const riskLabel = outVal === 0 ? 'Settled' : (riskKey === 'at_risk' ? 'High' : (riskKey === 'follow_up' ? 'Medium' : 'Low'));
                const riskClass = outVal === 0 ? 'settled' : (riskKey === 'at_risk' ? 'high' : (riskKey === 'follow_up' ? 'medium' : 'low'));

                return (
                  <tr
                    key={f.name || idx}
                    onClick={() => onSelectFranchisee(f)}
                    title="Click to view ledger details in drawer"
                  >
                    <td>
                      <div style={{ fontWeight: '600', color: 'var(--text-main, #1b2321)' }}>{f.name}</div>
                      {f.city && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #6b7268)' }}>
                          {f.city} {f.owner ? `• ${f.owner}` : ''}
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: '600' }} className="tabular-nums">
                      {formatCurrency(billedVal)}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: '600' }} className={`tabular-nums ${recVal > 0 ? 'text-received' : 'text-zero'}`}>
                      {formatCurrency(recVal)}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: '700' }} className={`tabular-nums ${outVal > 0 ? 'text-alert' : 'text-zero'}`}>
                      {formatCurrency(outVal)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`tl-risk-pill ${riskClass}`}>
                        {riskLabel}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center', color: '#9ca3af' }}>
                      <ChevronRight size={15} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {franchisees.length > 0 && (
        <div className="tl-pagination-bar">
          <div>
            Showing {startRow} to {endRow} of {franchisees.length} accounts
          </div>
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => onPageChange(currentPage - 1)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '4px',
                  border: '1px solid var(--border-color, #e3e5e0)',
                  background: '#ffffff',
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                  opacity: currentPage === 1 ? 0.5 : 1
                }}
              >
                Previous
              </button>
              <span>Page {currentPage} of {totalPages}</span>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => onPageChange(currentPage + 1)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '4px',
                  border: '1px solid var(--border-color, #e3e5e0)',
                  background: '#ffffff',
                  cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                  opacity: currentPage >= totalPages ? 0.5 : 1
                }}
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------
// 6. Right-Side Slide-in Drawer Component
// --------------------------------------------------------------------------
function TLDetailDrawer({ franchisee, isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('received');

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !franchisee) return null;

  const recItems = franchisee.received_items || [];
  const outItems = franchisee.outstanding_items || [];
  const canItems = franchisee.cancelled_items || [];
  const cnItems = franchisee.credit_note_items || [];
  const allNegativeItems = [...canItems, ...cnItems];

  const expectedRecovery = franchisee.expected_collectible != null && franchisee.expected_collectible > 0 
    ? formatCurrency(franchisee.expected_collectible) 
    : (franchisee.outstanding > 0 ? formatCurrency(franchisee.outstanding * 0.75) : '—');

  const auditFactor = franchisee.collection_risk?.score != null 
    ? `${franchisee.collection_risk.score}/100` 
    : '—';

  return (
    <div className="tl-drawer-backdrop" onClick={onClose}>
      <div className="tl-drawer" onClick={(e) => e.stopPropagation()}>
        {/* Drawer Header */}
        <div className="tl-drawer-header">
          <div>
            <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800', color: 'var(--text-main, #1b2321)' }}>
              {franchisee.name}
            </h2>
            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted, #6b7268)', marginTop: '2px' }}>
              {franchisee.city || 'National Partner'} {franchisee.owner ? `• Owner: ${franchisee.owner}` : ''}
            </div>
          </div>
          <button type="button" className="tl-drawer-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Financial Summary Strip */}
        <div className="tl-drawer-stats">
          <div className="tl-drawer-stat-item">
            <span className="tl-drawer-stat-label">Billed</span>
            <span className="tl-drawer-stat-val tabular-nums">{formatCurrency(franchisee.gross || 0)}</span>
          </div>
          <div className="tl-drawer-stat-item">
            <span className="tl-drawer-stat-label">Received</span>
            <span className="tl-drawer-stat-val text-received tabular-nums">{formatCurrency(franchisee.received || 0)}</span>
          </div>
          <div className="tl-drawer-stat-item">
            <span className="tl-drawer-stat-label">Outstanding</span>
            <span className="tl-drawer-stat-val text-alert tabular-nums">{formatCurrency(franchisee.outstanding || 0)}</span>
          </div>
          <div className="tl-drawer-stat-item">
            <span className="tl-drawer-stat-label">Expected Recovery</span>
            <span className="tl-drawer-stat-val tabular-nums">{expectedRecovery}</span>
          </div>
          <div className="tl-drawer-stat-item">
            <span className="tl-drawer-stat-label">Audit Score</span>
            <span className="tl-drawer-stat-val tabular-nums">{auditFactor}</span>
          </div>
          <div className="tl-drawer-stat-item">
            <span className="tl-drawer-stat-label">Days Aged</span>
            <span className="tl-drawer-stat-val tabular-nums">
              {franchisee.avg_days_outstanding && franchisee.avg_days_outstanding > 0 ? `${franchisee.avg_days_outstanding}d` : '—'}
            </span>
          </div>
        </div>

        {/* Drawer Tabs */}
        <div className="tl-drawer-tabs">
          <button
            type="button"
            className={`tl-drawer-tab-btn ${activeTab === 'received' ? 'active' : ''}`}
            onClick={() => setActiveTab('received')}
          >
            Received ({recItems.length})
          </button>
          <button
            type="button"
            className={`tl-drawer-tab-btn ${activeTab === 'outstanding' ? 'active' : ''}`}
            onClick={() => setActiveTab('outstanding')}
          >
            Outstanding ({outItems.length})
          </button>
          <button
            type="button"
            className={`tl-drawer-tab-btn ${activeTab === 'cancelled' ? 'active' : ''}`}
            onClick={() => setActiveTab('cancelled')}
          >
            Cancelled & CN ({allNegativeItems.length})
          </button>
        </div>

        {/* Drawer Body Table */}
        <div className="tl-drawer-body">
          {/* TAB 1: RECEIVED */}
          {activeTab === 'received' && (
            recItems.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted, #6b7268)', padding: '24px 0' }}>
                No settled placement records for this account.
              </p>
            ) : (
              <table className="tl-drawer-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Invoice #</th>
                    <th>Client</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {recItems.map((item, idx) => (
                    <tr key={idx}>
                      <td style={{ whiteSpace: 'nowrap', color: 'var(--text-muted, #6b7268)' }}>{item.bill_date || '—'}</td>
                      <td style={{ fontFamily: 'monospace', fontWeight: '700', color: '#0F6E56' }}>{item.bill_number}</td>
                      <td>{item.company_name}</td>
                      <td style={{ textAlign: 'right', fontWeight: '700', color: '#0F6E56' }} className="tabular-nums">
                        {formatCurrency(item.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}

          {/* TAB 2: OUTSTANDING */}
          {activeTab === 'outstanding' && (
            outItems.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted, #6b7268)', padding: '24px 0' }}>
                No pending or open invoices for this account.
              </p>
            ) : (
              <table className="tl-drawer-table">
                <thead>
                  <tr>
                    <th>Enquiry ID</th>
                    <th>Client</th>
                    <th>Days Aged</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {outItems.map((item, idx) => (
                    <tr key={idx}>
                      <td style={{ fontFamily: 'monospace' }}>#{item.enquiry_id}</td>
                      <td style={{ fontWeight: '600' }}>{item.company_name}</td>
                      <td style={{ color: 'var(--text-muted, #6b7268)' }}>{item.days_outstanding ? `${item.days_outstanding}d` : '—'}</td>
                      <td style={{ textAlign: 'right', fontWeight: '700', color: '#B7791F' }} className="tabular-nums">
                        {formatCurrency(item.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}

          {/* TAB 3: CANCELLED & CREDIT NOTES */}
          {activeTab === 'cancelled' && (
            allNegativeItems.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted, #6b7268)', padding: '24px 0' }}>
                No cancelled deals or credit note deductions.
              </p>
            ) : (
              <table className="tl-drawer-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Client</th>
                    <th>Reason</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {allNegativeItems.map((item, idx) => {
                    const isCreditNote = Boolean(item.credit_note_number);
                    return (
                      <tr key={idx}>
                        <td>
                          <span style={{
                            padding: '1px 6px',
                            borderRadius: '4px',
                            fontSize: '0.68rem',
                            fontWeight: '700',
                            background: isCreditNote ? '#faf5ff' : '#fff1f2',
                            color: isCreditNote ? '#7c3aed' : '#a8402e',
                            border: `1px solid ${isCreditNote ? '#e9d5ff' : '#fecdd3'}`
                          }}>
                            {isCreditNote ? 'CN' : 'Cancelled'}
                          </span>
                        </td>
                        <td style={{ fontWeight: '600' }}>{item.company_name}</td>
                        <td style={{ fontSize: '0.72rem', color: 'var(--text-muted, #6b7268)' }}>
                          {item.reason || item.reconciliation_note || 'Standard deduction'}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: '700', color: '#A8402E' }} className="tabular-nums">
                          {formatCurrency(item.amount)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
          )}
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// MAIN COMPONENT: TLPerformance
// --------------------------------------------------------------------------
export default function TLPerformance({ setActivePage }) {
  const { 
    teamLeaders = [], 
    selectedMonth, 
    selectedYear, 
    setSelectedYear,
    availableYears = []
  } = useContext(FinanceContext);

  // Read initial TL from sessionStorage if navigated from CostOfPerformance
  const [selectedTlId, setSelectedTlId] = useState(() => {
    return sessionStorage.getItem('fintective_selected_tl') || 'Avadai Esakki Muthu Sundaram Marthuvar';
  });

  const [lookbackMonths, setLookbackMonths] = useState(12);
  const [portfolioData, setPortfolioData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // Table filters & pagination state
  const [tableFilter, setTableFilter] = useState('at_risk'); // 'at_risk' | 'outstanding' | 'cancelled' | 'all'
  const [tableSearchQuery, setTableSearchQuery] = useState('');
  const [tablePage, setTablePage] = useState(1);

  // Selected franchisee for drawer
  const [selectedFranchisee, setSelectedFranchisee] = useState(null);

  // 1. Period calculation
  const getPeriodDates = useCallback((month, year) => {
    let start = '2018-01-01';
    let end = '2026-12-31';
    
    if (month && month !== 'All Months' && month !== 'all') {
      const parts = month.split(' ');
      const mName = parts[0];
      const yVal = parseInt(parts[1], 10);
      const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      const mIdx = monthNames.indexOf(mName);
      if (mIdx !== -1) {
        start = `${yVal}-${String(mIdx + 1).padStart(2, '0')}-01`;
        const lastDay = new Date(yVal, mIdx + 1, 0).getDate();
        end = `${yVal}-${String(mIdx + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      }
    } else if (year && year !== 'All Years') {
      const parts = year.split('-');
      if (parts.length === 2) {
        const yStart = parseInt(parts[0], 10);
        const yEnd = parseInt(parts[1], 10);
        start = `${yStart}-04-01`;
        end = `${yEnd}-03-31`;
      }
    }
    return { start, end };
  }, []);

  // 2. Fetch authoritative portfolio data for selected TL
  const fetchPortfolio = useCallback(async () => {
    if (!selectedTlId) return;
    setLoading(true);
    setIsSyncing(true);

    const { start, end } = getPeriodDates(selectedMonth, selectedYear);
    const url = `${API_BASE_URL}/tl-tracking/${encodeURIComponent(selectedTlId)}/portfolio?start_date=${start}&end_date=${end}&lookback_months=${lookbackMonths}&sort_by=risk`;

    try {
      const res = await fetchWithApiKey(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data && (data.totals || data.franchisees)) {
        setPortfolioData(data);
      }
    } catch (err) {
      console.warn('Error loading TL portfolio:', err);
    } finally {
      setLoading(false);
      setIsSyncing(false);
    }
  }, [selectedTlId, selectedMonth, selectedYear, lookbackMonths, getPeriodDates]);

  useEffect(() => {
    fetchPortfolio();
  }, [fetchPortfolio]);

  // Handle outside navigation events (e.g. from CostOfPerformance)
  useEffect(() => {
    const handleNav = (e) => {
      if (e.detail?.tl) {
        setSelectedTlId(e.detail.tl);
      }
    };
    window.addEventListener('navigate-to-page', handleNav);
    return () => window.removeEventListener('navigate-to-page', handleNav);
  }, []);

  // 3. Derived numbers directly from authoritative portfolioData
  const totals = portfolioData?.totals || {
    gross: 0,
    received: 0,
    received_pct: 0,
    outstanding: 0,
    cancelled: 0
  };

  const allFranchisees = portfolioData?.franchisees || [];
  const monthlyTrend = portfolioData?.monthly_trend || [];

  // Filter counts
  const filterCounts = useMemo(() => {
    return {
      all: allFranchisees.length,
      outstanding: allFranchisees.filter(f => (f.outstanding || 0) > 0).length,
      cancelled: allFranchisees.filter(f => (f.cancelled || 0) > 0 || (f.credit_notes || 0) > 0).length,
      at_risk: allFranchisees.filter(f => (f.outstanding || 0) > 0 && (f.collection_risk?.band_key !== 'likely')).length
    };
  }, [allFranchisees]);

  // Open item count for Needs Attention card
  const openItemsCount = useMemo(() => {
    return allFranchisees.reduce((sum, f) => {
      return sum + (f.outstanding_count || (f.outstanding > 0 ? 1 : 0)) + (f.cancelled_count || (f.cancelled > 0 ? 1 : 0));
    }, 0);
  }, [allFranchisees]);

  // Filtered and searched franchisee list
  const filteredFranchisees = useMemo(() => {
    let list = [...allFranchisees];

    if (tableFilter === 'at_risk') {
      list = list.filter(f => (f.outstanding || 0) > 0 && f.collection_risk?.band_key !== 'likely');
      list.sort((a, b) => (b.outstanding || 0) - (a.outstanding || 0));
    } else if (tableFilter === 'outstanding') {
      list = list.filter(f => (f.outstanding || 0) > 0);
      list.sort((a, b) => (b.outstanding || 0) - (a.outstanding || 0));
    } else if (tableFilter === 'cancelled') {
      list = list.filter(f => (f.cancelled || 0) > 0 || (f.credit_notes || 0) > 0);
      list.sort((a, b) => ((b.cancelled || 0) + (b.credit_notes || 0)) - ((a.cancelled || 0) + (a.credit_notes || 0)));
    }

    if (tableSearchQuery.trim()) {
      const q = tableSearchQuery.toLowerCase();
      list = list.filter(f => (f.name || '').toLowerCase().includes(q) || (f.city || '').toLowerCase().includes(q));
    }

    return list;
  }, [allFranchisees, tableFilter, tableSearchQuery]);

  // Top 5 to chase list
  const topChaseList = useMemo(() => {
    return allFranchisees
      .filter(f => (f.outstanding || 0) > 0)
      .sort((a, b) => (b.outstanding || 0) - (a.outstanding || 0))
      .slice(0, 5);
  }, [allFranchisees]);

  // 4. Export CSV using blob download (never window.open)
  const handleExportCSV = () => {
    if (filteredFranchisees.length === 0) return;
    const headers = [
      'Franchisee Name',
      'City',
      'Gross Billing (INR)',
      'Received Amount (INR)',
      'Received Pct (%)',
      'Outstanding Amount (INR)',
      'Cancelled Amount (INR)',
      'Risk Classification',
      'Avg Days Aged'
    ];

    const rows = filteredFranchisees.map(f => [
      `"${f.name || ''}"`,
      `"${f.city || ''}"`,
      f.gross || 0,
      f.received || 0,
      `${f.received_pct || 0}%`,
      f.outstanding || 0,
      f.cancelled || 0,
      `"${f.collection_risk?.label || (f.outstanding > 0 ? 'High risk' : 'Settled')}"`,
      f.avg_days_outstanding ? `${f.avg_days_outstanding}d` : '—'
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `TL_Collections_${selectedTlId}_${selectedYear || 'all'}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 5. Navigate to Cost of Performance
  const handleViewProfitability = () => {
    sessionStorage.setItem('fintective_cost_tab', 'tl');
    sessionStorage.setItem('fintective_cost_search', selectedTlId);
    if (typeof setActivePage === 'function') {
      setActivePage('cost-performance');
    } else {
      window.dispatchEvent(new CustomEvent('navigate-to-page', { detail: { page: 'cost-performance' } }));
    }
  };

  return (
    <div className="tl-page">
      {/* 1. Control Row */}
      <TLControls
        teamLeaders={teamLeaders}
        selectedTlId={selectedTlId}
        onSelectTl={setSelectedTlId}
        financialYear={selectedYear}
        onSelectYear={setSelectedYear}
        availableYears={availableYears}
        lookbackMonths={lookbackMonths}
        onSelectLookback={setLookbackMonths}
        onExportCSV={handleExportCSV}
        onViewProfitability={handleViewProfitability}
        isSyncing={isSyncing}
      />

      {/* 2. Three Calm KPI Cards */}
      <TLKpiRow
        totals={totals}
        openItemsCount={openItemsCount}
      />

      {/* 3. Two-Column Analytics Row */}
      <div className="tl-analytics-grid">
        <TLTrendChart monthlyTrend={monthlyTrend} />
        <TLChaseList
          topChaseList={topChaseList}
          onSelectFranchisee={setSelectedFranchisee}
          onSeeAllHighRisk={() => {
            setTableFilter('at_risk');
            setTablePage(1);
          }}
        />
      </div>

      {/* 4. Franchisee Worklist Table */}
      <TLFranchiseeTable
        franchisees={filteredFranchisees}
        activeFilter={tableFilter}
        onChangeFilter={setTableFilter}
        filterCounts={filterCounts}
        searchQuery={tableSearchQuery}
        onSearchChange={setTableSearchQuery}
        onSelectFranchisee={setSelectedFranchisee}
        currentPage={tablePage}
        onPageChange={setTablePage}
        itemsPerPage={10}
      />

      {/* 5. Right-Side Slide-in Drawer */}
      <TLDetailDrawer
        franchisee={selectedFranchisee}
        isOpen={Boolean(selectedFranchisee)}
        onClose={() => setSelectedFranchisee(null)}
      />
    </div>
  );
}
