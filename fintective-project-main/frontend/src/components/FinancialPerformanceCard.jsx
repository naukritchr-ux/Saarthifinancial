import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Landmark, Save, Plus, X, AlertTriangle, Check, RotateCcw, ArrowRight } from 'lucide-react';
import { API_BASE_URL } from '../context/FinanceContext';
import { fetchWithApiKey } from '../utils/apiClient';
import { formatCurrency } from '../utils/formatters';
import { performanceSelectionKey, performanceInputKey, validatePerformanceData } from '../utils/performanceData.js';

const DEFAULT_TAX_RATE = 0.25;

/**
 * Normalizes scope keys for consistent lookup in client state and DB.
 */
function getScopeKey(scope) {
  const bd = (scope?.bd || 'All').trim().toLowerCase();
  const tl = (scope?.tl || 'All').trim().toLowerCase();
  const fn = (scope?.franchise || scope?.fn || 'All').trim().toLowerCase();
  return `bd:${bd}|tl:${tl}|fn:${fn}`;
}

/**
 * Format Delta values with +/- prefix and Indian currency formatting.
 */
function formatDeltaCurrency(delta) {
  if (Math.abs(delta) < 0.01) return '₹0';
  const prefix = delta > 0 ? '+' : '';
  return `${prefix}${formatCurrency(delta)}`;
}

export default function FinancialPerformanceCard({
  selectedFy = 'FY 2026-27',
  bdFilter = 'Komal Suresh Bhanushali',
  tlFilter = 'All',
  franchiseFilter = 'All',
  primaryName = 'Overall Portfolio',
  isAdminOrManager = true,
  userRole = 'admin'
}) {
  // Pinned scopes for comparison (up to 4)
  const [pinnedScopes, setPinnedScopes] = useState([]);
  const [scopesData, setScopesData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadedSelection, setLoadedSelection] = useState(null);
  const latestRequest = useRef(0);
  const [error, setError] = useState(null);
  
  // Local editable manual inputs keyed by scope_key: { salary, expense, isDirty }
  const [localInputs, setLocalInputs] = useState({});
  const [savingScopeKey, setSavingScopeKey] = useState(null);
  const [saveStatus, setSaveStatus] = useState(null); // { type: 'success' | 'error', message: string }
  const [toastMessage, setToastMessage] = useState(null);

  // Active current scope from parent selectors
  const currentScope = useMemo(() => {
    const bd = bdFilter || 'All';
    const tl = tlFilter || 'All';
    const fn = franchiseFilter || 'All';
    let type = 'company';
    let label = 'Overall Portfolio';

    if (bd !== 'All' && tl === 'All' && fn === 'All') {
      type = 'bd';
      label = bd;
    } else if (bd === 'All' && tl !== 'All' && fn === 'All') {
      type = 'tl';
      label = tl;
    } else if (bd === 'All' && tl === 'All' && fn !== 'All') {
      type = 'franchise';
      label = fn;
    } else if (bd !== 'All' || tl !== 'All' || fn !== 'All') {
      type = 'combo';
      const parts = [bd !== 'All' ? bd : null, tl !== 'All' ? tl : null, fn !== 'All' ? fn : null].filter(Boolean);
      label = parts.join(' + ');
    }

    return {
      bd,
      tl,
      franchise: fn,
      fn,
      type,
      label,
      scope_key: getScopeKey({ bd, tl, franchise: fn })
    };
  }, [bdFilter, tlFilter, franchiseFilter]);

  // Determine active scopes to display:
  // If user has pinned 2+ scopes, use pinnedScopes.
  // If user has 0 or 1 pinned scope, use pinnedScopes if available, else currentScope.
  const activeScopes = useMemo(() => {
    if (pinnedScopes.length >= 2) {
      return pinnedScopes;
    }
    if (pinnedScopes.length === 1) {
      return pinnedScopes;
    }
    return [currentScope];
  }, [pinnedScopes, currentScope]);

  const isComparisonMode = activeScopes.length >= 2;

  const selectionKey = performanceSelectionKey(selectedFy, activeScopes);
  const hasCurrentData = loadedSelection === selectionKey && !loading && !error;

  // Fetch comparison / single scope metrics from unified backend endpoint
  const fetchCompareData = useCallback(async ({signal} = {}) => {
    if (!isAdminOrManager) return;
    const requestId = ++latestRequest.current;
    setLoading(true);
    setError(null);

    const payload = {
      fy: selectedFy,
      scopes: activeScopes.map(s => ({
        bd: s.bd,
        tl: s.tl,
        franchise: s.franchise || s.fn
      }))
    };

    try {
      const res = await fetchWithApiKey(`${API_BASE_URL}/growth/compare?role=${encodeURIComponent(userRole || 'admin')}`, {
        method: 'POST',
        signal, retries: 3, cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}`);
      }

      const data = validatePerformanceData(await res.json(), activeScopes);
      if (requestId !== latestRequest.current || signal?.aborted) return;
      setScopesData(data);
      setLoadedSelection(selectionKey);

      // Initialize local inputs from loaded server values if not already edited by user
      setLocalInputs(prev => {
        const next = { ...prev };
        data.forEach(item => {
          const k = performanceInputKey(selectedFy, item.scope_key);
          if (!next[k] || !next[k].isDirty) {
            next[k] = {
              salary: item.salary !== null && item.salary !== undefined ? item.salary : '',
              expense: item.expense !== null && item.expense !== undefined ? item.expense : '',
              salarySource: item.salarySource || 'manual',
              isDirty: false
            };
          }
        });
        return next;
      });
    } catch (err) {
      if (requestId !== latestRequest.current || signal?.aborted) return;
      setScopesData([]);
      setLoadedSelection(null);
      console.error("[FinancialPerformanceCard] fetch error:", err);
      setError(err.message || 'Could not load financial performance data');
    } finally {
      if (requestId === latestRequest.current) setLoading(false);
    }
  }, [selectedFy, activeScopes, isAdminOrManager, userRole, selectionKey]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchCompareData({signal: controller.signal});
    return () => { controller.abort(); latestRequest.current++; };
  }, [fetchCompareData]);

  // Handle adding current scope to pinned comparison
  const handleAddCurrentToCompare = () => {
    if (pinnedScopes.length >= 4) {
      setToastMessage('Maximum 4 scopes can be compared at once. Remove one to add another.');
      setTimeout(() => setToastMessage(null), 3500);
      return;
    }

    const currentKey = currentScope.scope_key;
    const exists = pinnedScopes.some(s => s.scope_key === currentKey);

    if (exists) {
      setToastMessage(`"${currentScope.label}" is already added to comparison.`);
      setTimeout(() => setToastMessage(null), 2500);
      return;
    }

    setPinnedScopes(prev => {
      // If nothing was pinned yet, pin currentScope as first
      return [...prev, currentScope];
    });
    setToastMessage(`Added "${currentScope.label}" to comparison.`);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Remove a pinned scope
  const handleRemovePinnedScope = (scopeKeyToRemove) => {
    setPinnedScopes(prev => prev.filter(s => s.scope_key !== scopeKeyToRemove));
  };

  // Clear all pinned scopes and reset to single view
  const handleClearComparison = () => {
    setPinnedScopes([]);
    setToastMessage('Reset to single person view.');
    setTimeout(() => setToastMessage(null), 2000);
  };

  // Update input value with live recalculation
  const handleInputChange = (scopeKey, field, val) => {
    scopeKey = performanceInputKey(selectedFy, scopeKey);
    setLocalInputs(prev => {
      const cur = prev[scopeKey] || { salary: '', expense: '', isDirty: false };
      return {
        ...prev,
        [scopeKey]: {
          ...cur,
          [field]: val,
          isDirty: true
        }
      };
    });
  };

  // Save manual inputs for a specific scope
  const handleSaveInputs = async (scopeItem) => {
    const k = scopeItem.scope_key;
    const editKey = performanceInputKey(selectedFy, k);
    if (!hasCurrentData || !scopeItem.scope) {
      setSaveStatus({type: 'error', message: 'Load the selected financial records before saving inputs.'});
      return;
    }
    const userVals = localInputs[editKey] || {};

    const expNum = userVals.expense !== '' && userVals.expense !== null && userVals.expense !== undefined ? Number(userVals.expense) : null;
    const salNum = userVals.salary !== '' && userVals.salary !== null && userVals.salary !== undefined ? Number(userVals.salary) : null;

    if (expNum !== null && (isNaN(expNum) || expNum < 0)) {
      setSaveStatus({ type: 'error', message: 'Expense must be a valid number ≥ 0.' });
      setTimeout(() => setSaveStatus(null), 4000);
      return;
    }
    if (salNum !== null && (isNaN(salNum) || salNum < 0)) {
      setSaveStatus({ type: 'error', message: 'Salary must be a valid number ≥ 0.' });
      setTimeout(() => setSaveStatus(null), 4000);
      return;
    }

    setSavingScopeKey(k);
    setSaveStatus(null);

    try {
      const payload = {
        scope: scopeItem.scope,
        scope_key: k,
        fy: selectedFy,
        expense: expNum,
        salary: salNum
      };

      const res = await fetchWithApiKey(`${API_BASE_URL}/growth/save-inputs?role=${encodeURIComponent(userRole || 'admin')}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to save inputs');
      }

      // Mark clean
      setLocalInputs(prev => ({
        ...prev,
        [editKey]: {
          ...(prev[editKey] || {}),
          salary: salNum !== null ? salNum : '',
          expense: expNum !== null ? expNum : '',
          salarySource: 'manual',
          isDirty: false
        }
      }));

      setSaveStatus({ type: 'success', message: `Saved inputs for ${scopeItem.label} (${selectedFy}).` });
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      setSaveStatus({ type: 'error', message: err.message || 'Error saving inputs' });
      setTimeout(() => setSaveStatus(null), 4000);
    } finally {
      setSavingScopeKey(null);
    }
  };

  // Compute live row values for each scope combining server data and client edits
  const computedColumns = useMemo(() => {
    if (!hasCurrentData) return [];
    return activeScopes.map(sc => {
      const serverData = scopesData.find(d => d.scope_key === sc.scope_key);
      const clientEntry = localInputs[performanceInputKey(selectedFy, sc.scope_key)];
      const salary = clientEntry && clientEntry.salary !== '' && !isNaN(Number(clientEntry.salary))
        ? Number(clientEntry.salary)
        : (serverData.salary || 0);

      const expense = clientEntry && clientEntry.expense !== '' && !isNaN(Number(clientEntry.expense))
        ? Number(clientEntry.expense)
        : (serverData.expense || 0);

      const salarySource = clientEntry?.isDirty ? 'manual' : (serverData.salarySource || 'manual');
      const ourShare = serverData.ourShare || 0;

      // Calculation Spec:
      // Salary ratio: Salary ÷ Our share as percentage
      const salaryRatio = ourShare > 0 ? (salary / ourShare) * 100 : 0;
      // Net = Our share − Salary − Expense
      const net = ourShare - salary - expense;
      // Income tax = 25% of Net (if Net <= 0, tax = 0)
      const tax = net > 0 ? net * DEFAULT_TAX_RATE : 0;
      // Surplus = Net − Income tax
      const surplus = net - tax;

      return {
        ...serverData,
        label: sc.label || serverData.label,
        type: sc.type || serverData.type,
        salary,
        salarySource,
        expense,
        salaryRatio,
        net,
        tax,
        surplus,
        isDirty: Boolean(clientEntry?.isDirty),
        rawSalaryInput: clientEntry ? clientEntry.salary : (serverData.salary !== null ? serverData.salary : ''),
        rawExpenseInput: clientEntry ? clientEntry.expense : (serverData.expense !== null ? serverData.expense : '')
      };
    });
  }, [activeScopes, scopesData, localInputs, hasCurrentData, selectedFy]);

  // Find best value per row if 3+ columns are compared
  const bestValues = useMemo(() => {
    if (computedColumns.length < 3) return {};

    const maxCompanies = Math.max(...computedColumns.map(c => c.companies));
    const maxRevenue = Math.max(...computedColumns.map(c => c.revenue));
    const maxOurShare = Math.max(...computedColumns.map(c => c.ourShare));
    const minExpense = Math.min(...computedColumns.map(c => c.expense));
    const minSalaryRatio = Math.min(...computedColumns.filter(c => c.salaryRatio > 0).map(c => c.salaryRatio));
    const maxNet = Math.max(...computedColumns.map(c => c.net));
    const maxSurplus = Math.max(...computedColumns.map(c => c.surplus));

    return {
      companies: maxCompanies > 0 ? maxCompanies : null,
      revenue: maxRevenue > 0 ? maxRevenue : null,
      ourShare: maxOurShare > 0 ? maxOurShare : null,
      expense: minExpense,
      salaryRatio: minSalaryRatio < Infinity ? minSalaryRatio : null,
      net: maxNet > 0 ? maxNet : null,
      surplus: maxSurplus > 0 ? maxSurplus : null
    };
  }, [computedColumns]);

  // Delta calculation if exactly 2 columns are compared (B − A)
  const delta = useMemo(() => {
    if (computedColumns.length !== 2) return null;
    const a = computedColumns[0];
    const b = computedColumns[1];

    return {
      companies: b.companies - a.companies,
      revenue: b.revenue - a.revenue,
      ourShare: b.ourShare - a.ourShare,
      salary: b.salary - a.salary,
      expense: b.expense - a.expense,
      salaryRatio: b.salaryRatio - a.salaryRatio,
      net: b.net - a.net,
      tax: b.tax - a.tax,
      surplus: b.surplus - a.surplus
    };
  }, [computedColumns]);

  // Aggregate overlap warning messages
  const overlapWarnings = useMemo(() => {
    const list = [];
    computedColumns.forEach(c => {
      if (c.overlapsWith && c.overlapsWith.length > 0) {
        c.overlapsWith.forEach(otherLabel => {
          const msg = `${c.label} (${c.type.toUpperCase()}) shares team volume with ${otherLabel}; numbers overlap.`;
          if (!list.includes(msg)) list.push(msg);
        });
      }
    });
    return list;
  }, [computedColumns]);

  if (!isAdminOrManager) {
    return null;
  }

  return (
    <div className="dashboard-card animate-fade-in" style={{ padding: '22px', border: '1.5px solid rgba(15, 110, 86, 0.25)', borderRadius: '12px', background: 'var(--bg-card)', marginBottom: '24px' }}>
      
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '24px',
          zIndex: 9999,
          background: '#0F172A',
          color: '#F8FAFC',
          padding: '10px 18px',
          borderRadius: '8px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
          fontSize: '0.84rem',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          border: '1px solid rgba(255,255,255,0.1)'
        }}>
          <Check size={16} color="#10B981" />
          {toastMessage}
        </div>
      )}

      {/* Card Header & Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '14px', borderBottom: '1.5px solid var(--border-color)', flexWrap: 'wrap', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(15, 110, 86, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Landmark size={22} color="var(--accent-teal)" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800', color: 'var(--text-main)' }}>
                Financial Performance: {isComparisonMode ? `Comparison (${computedColumns.length} Columns)` : (computedColumns[0]?.label || primaryName)}
              </h3>
              <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px', background: '#FEF3C7', color: '#92400E', fontWeight: '700' }}>
                Admin & Manager Access
              </span>
              {loading && (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Loading real-time DB data...
                </span>
              )}
            </div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {selectedFy} • Invoice revenue excluding GST, company shares, and salary/expense inputs
            </span>
          </div>
        </div>

        {/* Action Buttons: Add to Compare / Clear / Global Save */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {saveStatus && (
            <span style={{
              fontSize: '0.78rem',
              padding: '4px 10px',
              borderRadius: '6px',
              background: saveStatus.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
              color: saveStatus.type === 'success' ? '#065F46' : '#991B1B',
              fontWeight: '700'
            }}>
              {saveStatus.message}
            </span>
          )}

          <button
            type="button"
            onClick={handleAddCurrentToCompare}
            title="Pin the currently selected BD/TL/Franchise into a side-by-side comparison column"
            style={{
              padding: '7px 14px',
              borderRadius: '6px',
              background: '#F1F5F9',
              color: '#0F172A',
              border: '1px solid #CBD5E1',
              fontSize: '0.8rem',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            <Plus size={14} color="#0F6E56" />
            Add to compare
          </button>

          {isComparisonMode && (
            <button
              type="button"
              onClick={handleClearComparison}
              style={{
                padding: '7px 12px',
                borderRadius: '6px',
                background: 'transparent',
                color: 'var(--text-muted)',
                border: '1px solid var(--border-color)',
                fontSize: '0.78rem',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <RotateCcw size={13} />
              Reset Single View
            </button>
          )}

          {!isComparisonMode && computedColumns[0] && (
            <button
              type="button"
              onClick={() => handleSaveInputs(computedColumns[0])}
              disabled={savingScopeKey === computedColumns[0].scope_key}
              style={{
                padding: '7px 18px',
                borderRadius: '6px',
                background: 'var(--accent-teal)',
                color: '#FFFFFF',
                border: 'none',
                fontSize: '0.82rem',
                fontWeight: '700',
                cursor: savingScopeKey === computedColumns[0].scope_key ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}
            >
              <Save size={14} />
              {savingScopeKey === computedColumns[0].scope_key ? 'Saving...' : 'Save Inputs'}
            </button>
          )}
        </div>
      </div>

      {/* Pinned Scopes Chips Bar (Visible when 1+ pinned scopes exist) */}
      {pinnedScopes.length > 0 && (
        <div style={{ marginTop: '12px', padding: '10px 14px', background: 'rgba(241, 245, 249, 0.65)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', border: '1px solid var(--border-color)' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', marginRight: '4px' }}>
            Pinned Scopes ({pinnedScopes.length}/4):
          </span>
          {pinnedScopes.map((sc, idx) => (
            <div
              key={sc.scope_key || idx}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: '#FFFFFF',
                border: '1px solid #CBD5E1',
                padding: '4px 10px',
                borderRadius: '20px',
                fontSize: '0.78rem',
                fontWeight: '700',
                color: '#0F172A',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
              }}
            >
              <span>{sc.label}</span>
              <span style={{ fontSize: '0.68rem', padding: '1px 5px', borderRadius: '4px', background: 'rgba(15, 110, 86, 0.1)', color: 'var(--accent-teal)', textTransform: 'uppercase' }}>
                {sc.type === 'tl' || sc.type === 'franchise' ? `${sc.type.toUpperCase()} · Team total` : sc.type.toUpperCase()}
              </span>
              <button
                type="button"
                onClick={() => handleRemovePinnedScope(sc.scope_key)}
                title={`Remove ${sc.label} from comparison`}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94A3B8',
                  cursor: 'pointer',
                  padding: '0 2px',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <X size={13} />
              </button>
            </div>
          ))}

          {pinnedScopes.length < 4 && (
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginLeft: '6px', fontStyle: 'italic' }}>
              Select another person/team in the selectors above, then click "+ Add to compare".
            </span>
          )}
        </div>
      )}

      {/* Overlap Notice Banner */}
      {overlapWarnings.length > 0 && (
        <div style={{ marginTop: '12px', padding: '10px 14px', background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertTriangle size={18} color="#D97706" style={{ flexShrink: 0 }} />
          <div style={{ fontSize: '0.8rem', color: '#92400E', fontWeight: '600' }}>
            {overlapWarnings.map((warn, i) => (
              <div key={i}>{warn}</div>
            ))}
          </div>
        </div>
      )}

      {!hasCurrentData && (
        <div role={error ? 'alert' : 'status'} style={{marginTop: '16px', padding: '18px', borderRadius: '8px',
          background: error ? '#FEF2F2' : '#F8FAFC', color: error ? '#991B1B' : 'var(--text-muted)'}}>
          <strong>{loading && !error ? 'Loading financial performance…' : 'Financial performance data unavailable'}</strong>
          <p style={{margin: '8px 0'}}>{error || 'Fetching records for the selected financial year and people.'}</p>
          <p style={{margin: '8px 0'}}>Revenue, costs and profit are shown after the selected records load successfully.</p>
          {!loading && <button type="button" className="btn btn-primary" onClick={() => fetchCompareData()}>
            <RotateCcw size={14} /> Retry loading
          </button>}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW A: SINGLE-PERSON CARD VIEW (Existing behavior when 1 scope selected) */}
      {/* ========================================================================= */}
      {!isComparisonMode && computedColumns[0] && (() => {
        const c = computedColumns[0];
        return (
          <div style={{ marginTop: '16px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <tbody>

                {/* Row 1: No. of com */}
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '12px 8px', color: 'var(--text-main)', fontWeight: '700', width: '42%' }}>
                    No. of com
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginLeft: '8px', fontWeight: '400' }}>
                      (unique corporate client companies)
                    </span>
                  </td>
                  <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '3px 14px',
                      background: '#F1F5F9',
                      border: '1.5px solid #CBD5E1',
                      borderRadius: '6px',
                      fontWeight: '800',
                      fontSize: '1rem',
                      color: '#0F172A'
                    }}>
                      {c.companies}
                    </span>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginLeft: '10px' }}>
                      ({c.invoicedDeals} invoiced deals)
                    </span>
                  </td>
                </tr>

                {/* Row 2: Revenue */}
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '12px 8px', color: 'var(--text-main)', fontWeight: '700' }}>
                    Revenue
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginLeft: '8px', fontWeight: '400' }}>
                      (invoice revenue, excluding GST)
                    </span>
                  </td>
                  <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: '800', fontSize: '1.05rem', color: 'var(--text-main)' }}>
                    {loading ? 'Loading...' : formatCurrency(c.revenue)}
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginLeft: '8px', fontWeight: 'normal' }}>
                      ({c.invoicedDeals} deals)
                    </span>
                  </td>
                </tr>

                {/* Row 3: Our share */}
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '12px 8px', color: 'var(--text-main)', fontWeight: '700' }}>
                    Our share
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginLeft: '8px', fontWeight: '400' }}>
                      (real per-deal company share from invoices)
                    </span>
                  </td>
                  <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                    <span style={{ fontWeight: '800', fontSize: '1.05rem', color: '#0F6E56' }}>
                      {loading ? 'Loading...' : formatCurrency(c.ourShare)}
                    </span>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginLeft: '10px' }}>
                      ({c.verifiedCount} verified · {c.estimatedCount} estimated)
                    </span>
                  </td>
                </tr>

                {/* Row 4: Salary */}
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '12px 8px', color: 'var(--text-main)', fontWeight: '700' }}>
                    Salary
                    <span style={{
                      fontSize: '0.7rem',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: c.salarySource === 'payroll' ? '#E0F2FE' : '#F3F4F6',
                      color: c.salarySource === 'payroll' ? '#0369A1' : '#475569',
                      fontWeight: '700',
                      marginLeft: '8px'
                    }}>
                      {c.salarySource === 'payroll' ? 'Payroll Base' : 'Manual Entry'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '4px 10px', background: '#FFFFFF', minWidth: '180px', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)', fontWeight: '600', marginRight: '6px' }}>₹</span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="Enter salary"
                        value={c.rawSalaryInput}
                        onChange={e => handleInputChange(c.scope_key, 'salary', e.target.value)}
                        style={{ width: '130px', border: 'none', outline: 'none', fontSize: '0.9rem', fontWeight: '700', textAlign: 'right', color: 'var(--text-main)' }}
                      />
                    </div>
                  </td>
                </tr>

                {/* Row 5: Expense */}
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '12px 8px', color: 'var(--text-main)', fontWeight: '700' }}>
                    Expense
                    <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px', background: '#F3F4F6', color: '#4B5563', fontWeight: '700', marginLeft: '8px' }}>
                      Fixed
                    </span>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginLeft: '6px', fontWeight: '400' }}>
                      (set once, not computed from salary)
                    </span>
                  </td>
                  <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '4px 10px', background: '#FFFFFF', minWidth: '180px', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)', fontWeight: '600', marginRight: '6px' }}>₹</span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="Enter fixed expense"
                        value={c.rawExpenseInput}
                        onChange={e => handleInputChange(c.scope_key, 'expense', e.target.value)}
                        style={{ width: '130px', border: 'none', outline: 'none', fontSize: '0.9rem', fontWeight: '700', textAlign: 'right', color: 'var(--text-main)' }}
                      />
                    </div>
                  </td>
                </tr>

                {/* Row 6: Salary ratio (Salary ÷ Our share) */}
                <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(248, 250, 252, 0.5)' }}>
                  <td style={{ padding: '12px 8px', color: 'var(--text-main)', fontWeight: '700' }}>
                    Salary ratio
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginLeft: '8px', fontWeight: '400' }}>
                      (Salary ÷ Our share)
                    </span>
                  </td>
                  <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                    <span style={{
                      fontWeight: '800',
                      fontSize: '0.95rem',
                      padding: '3px 10px',
                      borderRadius: '6px',
                      background: c.salaryRatio > 50 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(15, 110, 86, 0.1)',
                      color: c.salaryRatio > 50 ? '#DC2626' : '#0F6E56'
                    }}>
                      {c.ourShare > 0 ? `${c.salaryRatio.toFixed(1)}%` : '—'}
                    </span>
                  </td>
                </tr>

                {/* Row 7: Net = Our share − Salary − Expense */}
                <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(15, 110, 86, 0.03)' }}>
                  <td style={{ padding: '12px 8px', color: 'var(--text-main)', fontWeight: '700' }}>
                    Net
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginLeft: '8px', fontWeight: '400' }}>
                      (Our share − Salary − Expense)
                    </span>
                  </td>
                  <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '4px 14px',
                      background: '#FFFFFF',
                      border: '1.5px solid #86EFAC',
                      borderRadius: '6px',
                      fontWeight: '800',
                      fontSize: '1.02rem',
                      color: c.net >= 0 ? '#15803D' : '#DC2626'
                    }}>
                      {formatCurrency(c.net)}
                    </span>
                  </td>
                </tr>

                {/* Row 8: Income tax (25% of Net) */}
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '12px 8px', color: 'var(--text-main)', fontWeight: '700' }}>
                    Income tax (25%)
                    <span style={{ fontSize: '0.74rem', padding: '2px 8px', borderRadius: '4px', background: '#FEF3C7', color: '#92400E', fontWeight: '700', marginLeft: '8px' }}>
                      25% Fixed
                    </span>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginLeft: '6px', fontWeight: '400' }}>
                      (if Net ≤ 0, tax = ₹0)
                    </span>
                  </td>
                  <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: '700', color: 'var(--text-main)' }}>
                    {formatCurrency(c.tax)}
                  </td>
                </tr>

                {/* Row 9: Surplus = Net − Income tax */}
                <tr style={{ background: 'rgba(15, 110, 86, 0.07)' }}>
                  <td style={{ padding: '14px 8px' }}>
                    <strong style={{ fontSize: '1.05rem', color: 'var(--text-main)' }}>Surplus</strong>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginLeft: '8px', fontWeight: '400' }}>
                      (Net − Income tax)
                    </span>
                  </td>
                  <td style={{ padding: '14px 8px', textAlign: 'right' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '5px 14px',
                      background: '#ECFDF5',
                      border: '2px solid #10B981',
                      borderRadius: '6px',
                      fontWeight: '900',
                      fontSize: '1.1rem',
                      color: c.surplus >= 0 ? '#047857' : '#DC2626'
                    }}>
                      {formatCurrency(c.surplus)}
                    </span>
                  </td>
                </tr>

              </tbody>
            </table>
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* VIEW B: SIDE-BY-SIDE COMPARISON VIEW (When 2+ scopes are compared)        */}
      {/* ========================================================================= */}
      {isComparisonMode && hasCurrentData && (
        <div style={{ marginTop: '16px', overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: computedColumns.length >= 3 ? '780px' : '620px', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '2px solid var(--border-color)' }}>
                <th style={{ padding: '12px 10px', textAlign: 'left', fontWeight: '800', color: 'var(--text-muted)', width: '220px' }}>
                  Financial Metric
                </th>
                {computedColumns.map((c, idx) => (
                  <th key={c.scope_key || idx} style={{ padding: '12px 10px', textAlign: 'right', minWidth: '150px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: '800', color: 'var(--text-main)', fontSize: '0.92rem' }}>
                          {c.label}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemovePinnedScope(c.scope_key)}
                          title={`Remove ${c.label}`}
                          style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 0 }}
                        >
                          <X size={13} />
                        </button>
                      </div>
                      <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(15, 110, 86, 0.1)', color: 'var(--accent-teal)', fontWeight: '700', textTransform: 'uppercase' }}>
                        {c.type === 'tl' || c.type === 'franchise' ? `${c.type.toUpperCase()} · Team total` : c.type.toUpperCase()}
                      </span>
                      {c.isDirty && (
                        <button
                          type="button"
                          onClick={() => handleSaveInputs(c)}
                          disabled={savingScopeKey === c.scope_key}
                          style={{
                            marginTop: '4px',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background: '#0F6E56',
                            color: '#FFF',
                            border: 'none',
                            fontSize: '0.68rem',
                            fontWeight: '700',
                            cursor: 'pointer'
                          }}
                        >
                          {savingScopeKey === c.scope_key ? 'Saving...' : 'Save'}
                        </button>
                      )}
                    </div>
                  </th>
                ))}

                {/* Delta Column if exactly 2 columns */}
                {delta && (
                  <th style={{ padding: '12px 10px', textAlign: 'right', minWidth: '140px', background: '#F1F5F9', borderLeft: '1.5px solid var(--border-color)' }}>
                    <div style={{ fontWeight: '800', color: '#0F172A', fontSize: '0.88rem' }}>
                      Delta (B − A)
                    </div>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: '400' }}>
                      Variance
                    </span>
                  </th>
                )}
              </tr>
            </thead>

            <tbody>
              {/* Row 1: No. of com */}
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '10px', fontWeight: '700', color: 'var(--text-main)' }}>
                  No. of com
                </td>
                {computedColumns.map((c, idx) => {
                  const isBest = bestValues.companies !== null && c.companies === bestValues.companies && computedColumns.length >= 3;
                  return (
                    <td key={idx} style={{ padding: '10px', textAlign: 'right', background: isBest ? '#ECFDF5' : 'transparent' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 10px',
                        background: '#F1F5F9',
                        border: '1px solid #CBD5E1',
                        borderRadius: '5px',
                        fontWeight: '800',
                        color: isBest ? '#047857' : '#0F172A'
                      }}>
                        {c.companies}
                      </span>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {c.invoicedDeals} deals
                      </div>
                    </td>
                  );
                })}
                {delta && (
                  <td style={{ padding: '10px', textAlign: 'right', fontWeight: '800', borderLeft: '1.5px solid var(--border-color)', color: delta.companies >= 0 ? '#059669' : '#DC2626' }}>
                    {delta.companies >= 0 ? `+${delta.companies}` : delta.companies} com
                  </td>
                )}
              </tr>

              {/* Row 2: Revenue */}
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '10px', fontWeight: '700', color: 'var(--text-main)' }}>
                  Revenue
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', fontWeight: '400' }}>
                    Gross billed
                  </span>
                </td>
                {computedColumns.map((c, idx) => {
                  const isBest = bestValues.revenue !== null && c.revenue === bestValues.revenue && computedColumns.length >= 3;
                  return (
                    <td key={idx} style={{ padding: '10px', textAlign: 'right', fontWeight: '800', fontSize: '0.95rem', background: isBest ? '#ECFDF5' : 'transparent', color: isBest ? '#047857' : 'var(--text-main)' }}>
                      {formatCurrency(c.revenue)}
                    </td>
                  );
                })}
                {delta && (
                  <td style={{ padding: '10px', textAlign: 'right', fontWeight: '800', borderLeft: '1.5px solid var(--border-color)', color: delta.revenue >= 0 ? '#059669' : '#DC2626' }}>
                    {formatDeltaCurrency(delta.revenue)}
                  </td>
                )}
              </tr>

              {/* Row 3: Our share */}
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '10px', fontWeight: '700', color: 'var(--text-main)' }}>
                  Our share
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', fontWeight: '400' }}>
                    Per-deal real share
                  </span>
                </td>
                {computedColumns.map((c, idx) => {
                  const isBest = bestValues.ourShare !== null && c.ourShare === bestValues.ourShare && computedColumns.length >= 3;
                  return (
                    <td key={idx} style={{ padding: '10px', textAlign: 'right', background: isBest ? '#ECFDF5' : 'transparent' }}>
                      <div style={{ fontWeight: '800', color: '#0F6E56', fontSize: '0.95rem' }}>
                        {formatCurrency(c.ourShare)}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                        {c.verifiedCount} ver · {c.estimatedCount} est
                      </div>
                    </td>
                  );
                })}
                {delta && (
                  <td style={{ padding: '10px', textAlign: 'right', fontWeight: '800', borderLeft: '1.5px solid var(--border-color)', color: delta.ourShare >= 0 ? '#059669' : '#DC2626' }}>
                    {formatDeltaCurrency(delta.ourShare)}
                  </td>
                )}
              </tr>

              {/* Row 4: Salary (Editable) */}
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '10px', fontWeight: '700', color: 'var(--text-main)' }}>
                  Salary
                </td>
                {computedColumns.map((c, idx) => (
                  <td key={idx} style={{ padding: '10px', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid var(--border-color)', borderRadius: '5px', padding: '3px 8px', background: '#FFFFFF', width: '120px', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: '600' }}>₹</span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={c.rawSalaryInput}
                        onChange={e => handleInputChange(c.scope_key, 'salary', e.target.value)}
                        style={{ width: '90px', border: 'none', outline: 'none', fontSize: '0.84rem', fontWeight: '700', textAlign: 'right', color: 'var(--text-main)' }}
                      />
                    </div>
                    <div style={{ fontSize: '0.65rem', color: c.salarySource === 'payroll' ? '#0284C7' : '#64748B', marginTop: '2px', fontWeight: '600' }}>
                      {c.salarySource === 'payroll' ? 'Payroll Base' : 'Manual'}
                    </div>
                  </td>
                ))}
                {delta && (
                  <td style={{ padding: '10px', textAlign: 'right', fontWeight: '700', borderLeft: '1.5px solid var(--border-color)', color: 'var(--text-main)' }}>
                    {formatDeltaCurrency(delta.salary)}
                  </td>
                )}
              </tr>

              {/* Row 5: Expense (Editable) */}
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '10px', fontWeight: '700', color: 'var(--text-main)' }}>
                  Expense
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', fontWeight: '400' }}>
                    Fixed manual
                  </span>
                </td>
                {computedColumns.map((c, idx) => (
                  <td key={idx} style={{ padding: '10px', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid var(--border-color)', borderRadius: '5px', padding: '3px 8px', background: '#FFFFFF', width: '120px', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: '600' }}>₹</span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={c.rawExpenseInput}
                        onChange={e => handleInputChange(c.scope_key, 'expense', e.target.value)}
                        style={{ width: '90px', border: 'none', outline: 'none', fontSize: '0.84rem', fontWeight: '700', textAlign: 'right', color: 'var(--text-main)' }}
                      />
                    </div>
                  </td>
                ))}
                {delta && (
                  <td style={{ padding: '10px', textAlign: 'right', fontWeight: '700', borderLeft: '1.5px solid var(--border-color)', color: delta.expense <= 0 ? '#059669' : '#DC2626' }}>
                    {formatDeltaCurrency(delta.expense)}
                  </td>
                )}
              </tr>

              {/* Row 6: Salary ratio */}
              <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(248, 250, 252, 0.5)' }}>
                <td style={{ padding: '10px', fontWeight: '700', color: 'var(--text-main)' }}>
                  Salary ratio
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', fontWeight: '400' }}>
                    Salary ÷ Our share
                  </span>
                </td>
                {computedColumns.map((c, idx) => {
                  const isBest = bestValues.salaryRatio !== null && c.salaryRatio === bestValues.salaryRatio && computedColumns.length >= 3;
                  return (
                    <td key={idx} style={{ padding: '10px', textAlign: 'right', background: isBest ? '#ECFDF5' : 'transparent' }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontWeight: '800',
                        fontSize: '0.82rem',
                        background: c.salaryRatio > 50 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(15, 110, 86, 0.1)',
                        color: c.salaryRatio > 50 ? '#DC2626' : '#0F6E56'
                      }}>
                        {c.ourShare > 0 ? `${c.salaryRatio.toFixed(1)}%` : '—'}
                      </span>
                    </td>
                  );
                })}
                {delta && (
                  <td style={{ padding: '10px', textAlign: 'right', fontWeight: '700', borderLeft: '1.5px solid var(--border-color)', color: delta.salaryRatio <= 0 ? '#059669' : '#DC2626' }}>
                    {delta.salaryRatio >= 0 ? `+${delta.salaryRatio.toFixed(1)}%` : `${delta.salaryRatio.toFixed(1)}%`}
                  </td>
                )}
              </tr>

              {/* Row 7: Net */}
              <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(15, 110, 86, 0.02)' }}>
                <td style={{ padding: '10px', fontWeight: '700', color: 'var(--text-main)' }}>
                  Net
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', fontWeight: '400' }}>
                    Our share − Sal − Exp
                  </span>
                </td>
                {computedColumns.map((c, idx) => {
                  const isBest = bestValues.net !== null && c.net === bestValues.net && computedColumns.length >= 3;
                  return (
                    <td key={idx} style={{ padding: '10px', textAlign: 'right', fontWeight: '800', background: isBest ? '#ECFDF5' : 'transparent', color: c.net >= 0 ? '#15803D' : '#DC2626' }}>
                      {formatCurrency(c.net)}
                    </td>
                  );
                })}
                {delta && (
                  <td style={{ padding: '10px', textAlign: 'right', fontWeight: '800', borderLeft: '1.5px solid var(--border-color)', color: delta.net >= 0 ? '#059669' : '#DC2626' }}>
                    {formatDeltaCurrency(delta.net)}
                  </td>
                )}
              </tr>

              {/* Row 8: Income tax (25%) */}
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '10px', fontWeight: '700', color: 'var(--text-main)' }}>
                  Income tax (25%)
                </td>
                {computedColumns.map((c, idx) => (
                  <td key={idx} style={{ padding: '10px', textAlign: 'right', fontWeight: '600', color: 'var(--text-muted)' }}>
                    {formatCurrency(c.tax)}
                  </td>
                ))}
                {delta && (
                  <td style={{ padding: '10px', textAlign: 'right', fontWeight: '600', borderLeft: '1.5px solid var(--border-color)', color: 'var(--text-muted)' }}>
                    {formatDeltaCurrency(delta.tax)}
                  </td>
                )}
              </tr>

              {/* Row 9: Surplus */}
              <tr style={{ background: 'rgba(15, 110, 86, 0.07)' }}>
                <td style={{ padding: '12px 10px', fontWeight: '900', color: 'var(--text-main)', fontSize: '0.94rem' }}>
                  Surplus
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', fontWeight: '400' }}>
                    Net − Tax
                  </span>
                </td>
                {computedColumns.map((c, idx) => {
                  const isBest = bestValues.surplus !== null && c.surplus === bestValues.surplus && computedColumns.length >= 3;
                  return (
                    <td key={idx} style={{ padding: '12px 10px', textAlign: 'right', background: isBest ? '#D1FAE5' : 'transparent' }}>
                      <span style={{
                        fontWeight: '900',
                        fontSize: '1rem',
                        color: c.surplus >= 0 ? '#047857' : '#DC2626'
                      }}>
                        {formatCurrency(c.surplus)}
                      </span>
                    </td>
                  );
                })}
                {delta && (
                  <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: '900', fontSize: '1rem', borderLeft: '1.5px solid var(--border-color)', color: delta.surplus >= 0 ? '#059669' : '#DC2626' }}>
                    {formatDeltaCurrency(delta.surplus)}
                  </td>
                )}
              </tr>

            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}
