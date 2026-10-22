import React, { useState, useEffect, useMemo } from 'react';
import { Target, Sparkles, Check, Edit2, Trash2, AlertCircle, TrendingUp, ArrowRight, ShieldAlert } from 'lucide-react';
import { API_BASE_URL } from '../context/FinanceContext';
import { fetchWithApiKey } from '../utils/apiClient';
import { formatCurrency, formatLakhs } from '../utils/formatters';

export const ProfileGoalSetter = ({
  bdProfile = 'All',
  selectedFy = 'FY 2026-27',
  tlFilter = 'All',
  franchiseFilter = 'All',
  measure = 'deals', // 'deals' or 'revenue'
  summaryData = null,
  scenarioMultiplier = 1.0,
  onScenarioChange = () => {},
  onGoalSaved = () => {},
  onPreviewChange = () => {},
  isAdminOrManager = true,
  currentUser = null,
  userRole = 'admin',
  isLoading = false
}) => {
  // Mode selection & Form States
  const [targetDeals, setTargetDeals] = useState('');
  const [targetRevenue, setTargetRevenue] = useState('');
  const [growthPct, setGrowthPct] = useState('0');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);

  const isRevMode = measure === 'revenue';

  // Derived baseline from summaryData
  const realizedDeals = Number(summaryData?.pace?.closed_count || 0);
  const realizedRev = Number(summaryData?.pace?.closed_revenue || 0);
  const projectedAtPaceDeals = Number(summaryData?.pace?.projected_total_by_fy_end || realizedDeals);
  const pacePerMonth = Number(summaryData?.pace?.current_monthly_pace || 0);
  const monthsElapsed = Number(summaryData?.period?.months_elapsed || 7);
  const monthsRemaining = Math.max(1, 12 - monthsElapsed);

  // Average deal ticket size
  const avgTicketSize = useMemo(() => {
    if (realizedDeals > 0 && realizedRev > 0) {
      return realizedRev / realizedDeals;
    }
    const baseRev = Number(summaryData?.baseline?.revenue || 0);
    const baseDeals = Number(summaryData?.baseline?.deals || 0);
    if (baseDeals > 0 && baseRev > 0) {
      return baseRev / baseDeals;
    }
    return 50000;
  }, [realizedDeals, realizedRev, summaryData]);

  // Projected full-year revenue at current pace
  const projectedAtPaceRev = useMemo(() => {
    if (realizedDeals > 0) {
      return Math.round(projectedAtPaceDeals * avgTicketSize);
    }
    return Number(summaryData?.company_quota?.quota_revenue || 1000000);
  }, [projectedAtPaceDeals, avgTicketSize, realizedDeals, summaryData]);

  // Existing saved goal from summaryData
  const activeSavedGoal = useMemo(() => {
    const pledge = summaryData?.own_pledge;
    if (pledge && pledge.id && pledge.status !== 'cancelled') {
      return pledge;
    }
    return null;
  }, [summaryData]);

  // Permission check: Admin/Manager can set for anyone; BD specialist can only set their own pledge
  const canSetGoal = useMemo(() => {
    if (isAdminOrManager) return true;
    const currentName = (currentUser?.name || '').trim().toLowerCase();
    const currentProfile = (bdProfile || '').trim().toLowerCase();
    return currentName && currentProfile && (currentName === currentProfile || currentProfile.includes(currentName));
  }, [isAdminOrManager, currentUser, bdProfile]);

  // Auto-synchronize inputs based on scenario multiplier when not manually editing
  useEffect(() => {
    if (!isEditing && !activeSavedGoal) {
      applyMultiplier(scenarioMultiplier);
    }
  }, [scenarioMultiplier, projectedAtPaceDeals, projectedAtPaceRev, isEditing, activeSavedGoal]);

  // Load active saved goal into target fields when profile or FY changes
  useEffect(() => {
    if (activeSavedGoal) {
      const gDeals = activeSavedGoal.target_deals || Math.round(activeSavedGoal.target_revenue / avgTicketSize);
      const gRev = activeSavedGoal.target_revenue || Math.round(gDeals * avgTicketSize);
      const gPct = activeSavedGoal.growth_pct ? String(activeSavedGoal.growth_pct) : '0';

      setTargetDeals(String(gDeals));
      setTargetRevenue(String(Math.round(gRev)));
      setGrowthPct(gPct);
      setIsEditing(false);
      onPreviewChange(isRevMode ? gRev : gDeals, 'Saved Goal');
    } else {
      setIsEditing(true);
      applyMultiplier(scenarioMultiplier || 1.0);
    }
    setErrorMsg(null);
  }, [activeSavedGoal, bdProfile, selectedFy, avgTicketSize, isRevMode]);

  const applyMultiplier = (mult) => {
    const m = Number(mult) || 1.0;
    const computedDeals = Math.max(1, Math.round(projectedAtPaceDeals * m));
    const computedRev = Math.max(1000, Math.round(projectedAtPaceRev * m));
    const computedPct = ((m - 1.0) * 100).toFixed(0);

    setTargetDeals(String(computedDeals));
    setTargetRevenue(String(computedRev));
    setGrowthPct(computedPct);
    onScenarioChange(m);
    onPreviewChange(isRevMode ? computedRev : computedDeals, `${m}x Scenario`);
  };

  // Bidirectional Synchronization Handlers
  const handleDealsChange = (val) => {
    setTargetDeals(val);
    setErrorMsg(null);
    const numD = parseInt(val, 10);
    if (!isNaN(numD) && numD > 0) {
      const computedRev = Math.round(numD * avgTicketSize);
      setTargetRevenue(String(computedRev));
      if (projectedAtPaceDeals > 0) {
        const pct = (((numD - projectedAtPaceDeals) / projectedAtPaceDeals) * 100).toFixed(0);
        setGrowthPct(pct);
        const mult = (numD / projectedAtPaceDeals);
        onScenarioChange(parseFloat(mult.toFixed(2)));
      }
      onPreviewChange(isRevMode ? computedRev : numD, 'Custom Target');
    }
  };

  const handleRevenueChange = (val) => {
    setTargetRevenue(val);
    setErrorMsg(null);
    const numR = parseFloat(val);
    if (!isNaN(numR) && numR > 0) {
      const computedDeals = Math.max(1, Math.round(numR / avgTicketSize));
      setTargetDeals(String(computedDeals));
      if (projectedAtPaceRev > 0) {
        const pct = (((numR - projectedAtPaceRev) / projectedAtPaceRev) * 100).toFixed(0);
        setGrowthPct(pct);
        const mult = (numR / projectedAtPaceRev);
        onScenarioChange(parseFloat(mult.toFixed(2)));
      }
      onPreviewChange(isRevMode ? numR : computedDeals, 'Custom Target');
    }
  };

  const handleGrowthPctChange = (val) => {
    setGrowthPct(val);
    setErrorMsg(null);
    const numP = parseFloat(val);
    if (!isNaN(numP)) {
      const mult = 1.0 + (numP / 100.0);
      const computedDeals = Math.max(1, Math.round(projectedAtPaceDeals * mult));
      const computedRev = Math.max(1000, Math.round(projectedAtPaceRev * mult));
      setTargetDeals(String(computedDeals));
      setTargetRevenue(String(computedRev));
      onScenarioChange(parseFloat(mult.toFixed(2)));
      onPreviewChange(isRevMode ? computedRev : computedDeals, `${mult.toFixed(1)}x Scenario`);
    }
  };

  // Output calculations for remaining period
  const numTargetDeals = parseInt(targetDeals, 10) || projectedAtPaceDeals;
  const numTargetRev = parseFloat(targetRevenue) || projectedAtPaceRev;
  const remainingDealsNeeded = Math.max(0, numTargetDeals - realizedDeals);
  const requiredMonthlyDeals = (remainingDealsNeeded / monthsRemaining).toFixed(1);
  const remainingRevNeeded = Math.max(0, numTargetRev - realizedRev);
  const requiredMonthlyRev = remainingRevNeeded / monthsRemaining;
  const upliftVsPace = projectedAtPaceDeals > 0 
    ? Math.round(((numTargetDeals - projectedAtPaceDeals) / projectedAtPaceDeals) * 100) 
    : 0;

  // Status calculation comparing projected pace to saved goal
  const goalStatus = useMemo(() => {
    if (!activeSavedGoal) return null;
    const goalVal = isRevMode ? (activeSavedGoal.target_revenue || 0) : (activeSavedGoal.target_deals || 0);
    const paceVal = isRevMode ? projectedAtPaceRev : projectedAtPaceDeals;
    if (goalVal <= 0) return null;

    if (paceVal >= goalVal) {
      return { label: 'Ahead', color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' };
    }
    if (paceVal >= goalVal * 0.95) {
      return { label: 'On Track', color: '#0F6E56', bg: 'rgba(15, 110, 86, 0.1)', border: '#0F6E56' };
    }
    return { label: 'Behind', color: '#dc2626', bg: '#fef2f2', border: '#fca5a5' };
  }, [activeSavedGoal, isRevMode, projectedAtPaceRev, projectedAtPaceDeals]);

  // Validation
  const validateForm = () => {
    if (isNaN(numTargetDeals) || numTargetDeals <= 0) {
      setErrorMsg('Target deals must be a positive number.');
      return false;
    }
    if (numTargetDeals > 5000) {
      setErrorMsg('Target deals exceeds reasonable annual maximum (5,000).');
      return false;
    }
    if (isNaN(numTargetRev) || numTargetRev <= 0) {
      setErrorMsg('Target revenue must be a positive amount.');
      return false;
    }
    if (numTargetRev > 500000000) {
      setErrorMsg('Target revenue exceeds maximum threshold (₹50 Cr).');
      return false;
    }
    return true;
  };

  // Save Goal to Backend
  const handleSaveGoal = async () => {
    if (!validateForm()) return;
    setIsSaving(true);
    setErrorMsg(null);

    const authorRole = isAdminOrManager ? 'owner' : 'self';
    const updaterName = currentUser?.name || (isAdminOrManager ? 'Leadership' : bdProfile);

    const payload = {
      entity_type: bdProfile === 'All' ? 'company' : 'bd_agent',
      entity_id: bdProfile,
      entity_name: bdProfile,
      growth_pct_target: parseFloat(growthPct) || 0,
      target_placements: numTargetDeals,
      target_revenue: Math.round(numTargetRev),
      target_author: authorRole,
      updated_by: updaterName,
      financial_year: selectedFy,
      metric_type: measure,
      period_start: `${selectedFy.slice(3, 7)}-04-01`,
      period_end: `${parseInt(selectedFy.slice(3, 7), 10) + 1}-03-31`,
      guidelines: `FY Goal established for ${bdProfile} (${selectedFy}): ${numTargetDeals} deals • ${formatCurrency(numTargetRev)}.`
    };

    try {
      const res = await fetchWithApiKey(`${API_BASE_URL}/growth-targets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}`);
      }

      setToastMsg(`FY Goal successfully saved for ${bdProfile}`);
      setTimeout(() => setToastMsg(null), 3000);
      setIsEditing(false);
      onGoalSaved();
    } catch (err) {
      console.error('Save goal error:', err);
      setErrorMsg(`Failed to save goal: ${err.message}. Changes rolled back.`);
    } finally {
      setIsSaving(false);
    }
  };

  // Clear/Cancel Goal
  const handleClearGoal = async () => {
    if (!activeSavedGoal?.id) return;
    setIsSaving(true);
    setErrorMsg(null);

    try {
      const res = await fetchWithApiKey(`${API_BASE_URL}/growth-targets/${activeSavedGoal.id}`, {
        method: 'DELETE'
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      setToastMsg(`Goal cleared for ${bdProfile}`);
      setTimeout(() => setToastMsg(null), 3000);
      setIsEditing(true);
      applyMultiplier(1.0);
      onGoalSaved();
    } catch (err) {
      console.error('Clear goal error:', err);
      setErrorMsg(`Failed to clear goal: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{
        background: 'var(--bg-card, #ffffff)',
        border: '1px solid var(--border-color, #e2e8f0)',
        borderRadius: '8px',
        padding: '18px 20px',
        marginBottom: '20px'
      }}>
        <div className="skeleton-shimmer" style={{ height: '32px', width: '220px', marginBottom: '12px' }} />
        <div className="skeleton-shimmer" style={{ height: '56px', width: '100%', marginBottom: '12px' }} />
        <div className="skeleton-shimmer" style={{ height: '40px', width: '70%' }} />
      </div>
    );
  }

  return (
    <div style={{
      background: 'var(--bg-card, #ffffff)',
      border: '1px solid var(--border-color, #e2e8f0)',
      borderRadius: '8px',
      padding: '18px 20px',
      marginBottom: '20px',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)'
    }}>
      {/* Header & Status */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.94rem', fontWeight: '800', color: 'var(--text-main, #0f172a)' }}>
              Set FY Goal • {bdProfile} ({selectedFy})
            </span>
            {goalStatus && (
              <span style={{
                fontSize: '0.7rem',
                fontWeight: '700',
                padding: '2px 8px',
                borderRadius: '12px',
                color: goalStatus.color,
                background: goalStatus.bg,
                border: `1px solid ${goalStatus.border}`,
                textTransform: 'uppercase'
              }}>
                {goalStatus.label}
              </span>
            )}
          </div>
          <p style={{ margin: '2px 0 0 0', fontSize: '0.76rem', color: 'var(--text-muted, #64748b)' }}>
            Establish and track the annual placement & revenue commitment for {bdProfile}.
          </p>
        </div>

        {/* Saved Goal Badge / Action Buttons */}
        {activeSavedGoal && !isEditing ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              disabled={!canSetGoal}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                background: '#ffffff',
                fontSize: '0.78rem',
                fontWeight: '600',
                cursor: canSetGoal ? 'pointer' : 'not-allowed',
                color: 'var(--text-main)'
              }}
            >
              <Edit2 size={13} />
              Edit Goal
            </button>
            <button
              type="button"
              onClick={handleClearGoal}
              disabled={!canSetGoal || isSaving}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid #fecaca',
                background: '#fef2f2',
                fontSize: '0.78rem',
                fontWeight: '600',
                cursor: canSetGoal ? 'pointer' : 'not-allowed',
                color: '#dc2626'
              }}
            >
              <Trash2 size={13} />
              Clear
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={handleSaveGoal}
              disabled={!canSetGoal || isSaving}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 16px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: canSetGoal ? 'var(--accent-teal, #0F6E56)' : '#94a3b8',
                color: '#ffffff',
                fontSize: '0.82rem',
                fontWeight: '700',
                cursor: canSetGoal && !isSaving ? 'pointer' : 'not-allowed',
                boxShadow: '0 1px 3px rgba(15, 110, 86, 0.25)'
              }}
            >
              <Target size={14} />
              {isSaving ? 'Saving...' : (activeSavedGoal ? 'Update Goal' : 'Set as Goal')}
            </button>
            {activeSavedGoal && (
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                style={{
                  padding: '7px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  background: 'transparent',
                  fontSize: '0.8rem',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            )}
          </div>
        )}
      </div>

      {/* Permission Warning if viewer cannot edit */}
      {!canSetGoal && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          background: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: '6px',
          marginBottom: '14px',
          fontSize: '0.76rem',
          color: '#92400e'
        }}>
          <ShieldAlert size={14} />
          <span>Viewing in read-only mode. Only Management or <strong>{bdProfile}</strong> can establish or update this pledge.</span>
        </div>
      )}

      {/* Toast Feedback */}
      {toastMsg && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '8px 12px',
          background: '#ecfdf5',
          border: '1px solid #a7f3d0',
          borderRadius: '6px',
          marginBottom: '14px',
          fontSize: '0.78rem',
          color: '#065f46',
          fontWeight: '600'
        }}>
          <Check size={14} />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Inline Validation / Backend Error */}
      {errorMsg && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '8px 12px',
          background: '#fef2f2',
          border: '1px solid #f87171',
          borderRadius: '6px',
          marginBottom: '14px',
          fontSize: '0.78rem',
          color: '#991b1b'
        }}>
          <AlertCircle size={14} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Saved Goal Overview State (when not editing) */}
      {activeSavedGoal && !isEditing ? (
        <div style={{
          background: 'rgba(15, 110, 86, 0.04)',
          border: '1px solid rgba(15, 110, 86, 0.18)',
          borderRadius: '6px',
          padding: '14px 18px',
          marginBottom: '12px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>
                Active Target Commitment
              </span>
              <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-main)', marginTop: '2px' }}>
                {activeSavedGoal.target_deals ? `${activeSavedGoal.target_deals} deals` : ''}{' '}
                {activeSavedGoal.target_revenue ? `(${formatCurrency(activeSavedGoal.target_revenue)})` : ''}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '20px', fontSize: '0.8rem' }}>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Target Uplift:</span>{' '}
                <strong style={{ color: '#0F6E56' }}>+{activeSavedGoal.growth_pct || 0}%</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Required Monthly:</span>{' '}
                <strong>~{requiredMonthlyDeals} deals/mo</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Updated By:</span>{' '}
                <strong>{activeSavedGoal.updated_by || 'Leadership'}</strong>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Edit / Form State */
        <div>
          {/* Baseline Summary Pill */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            background: 'var(--bg-main, #f8fafc)',
            border: '1px solid var(--border-color, #e2e8f0)',
            borderRadius: '6px',
            padding: '8px 14px',
            marginBottom: '14px',
            fontSize: '0.78rem',
            flexWrap: 'wrap'
          }}>
            <div>
              <strong style={{ color: 'var(--text-muted)' }}>Realized YTD ({monthsElapsed}M):</strong>{' '}
              <span style={{ color: '#0F6E56', fontWeight: '700' }}>
                {realizedDeals} deals • {formatCurrency(realizedRev)} (rev_ex_gst)
              </span>
            </div>
            <div>
              <strong style={{ color: 'var(--text-muted)' }}>Current-Pace Projection:</strong>{' '}
              <span style={{ color: '#2563EB', fontWeight: '700' }}>
                {projectedAtPaceDeals} deals ({formatCurrency(projectedAtPaceRev)})
              </span>
            </div>
            <div>
              <strong style={{ color: 'var(--text-muted)' }}>Pace / Month:</strong>{' '}
              <span style={{ fontWeight: '700' }}>~{pacePerMonth} deals/mo</span>
            </div>
          </div>

          {/* Presets Row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.74rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Growth Presets:
              </span>
              <div className="preset-chip-group">
                {[
                  { label: '1x (Pace)', mult: 1.0 },
                  { label: '1.5x', mult: 1.5 },
                  { label: '2x', mult: 2.0 },
                  { label: '3x', mult: 3.0 }
                ].map(p => (
                  <button
                    key={p.mult}
                    type="button"
                    className={`preset-chip ${scenarioMultiplier === p.mult ? 'active' : ''}`}
                    onClick={() => applyMultiplier(p.mult)}
                    disabled={!canSetGoal}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Selecting a preset previews scenario line on the trajectory chart above.
            </span>
          </div>

          {/* Triple Synchronized Target Inputs: Deals, Revenue, Growth % */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '12px',
            marginBottom: '14px'
          }}>
            {/* Deals Input */}
            <div style={{
              background: isRevMode ? 'var(--bg-main)' : 'rgba(15, 110, 86, 0.04)',
              border: isRevMode ? '1px solid var(--border-color)' : '1.5px solid var(--accent-teal)',
              borderRadius: '6px',
              padding: '10px 12px'
            }}>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: isRevMode ? 'var(--text-muted)' : 'var(--accent-teal)', marginBottom: '4px' }}>
                TARGET DEALS (ANNUAL)
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input
                  type="number"
                  min="1"
                  max="5000"
                  value={targetDeals}
                  onChange={(e) => handleDealsChange(e.target.value)}
                  disabled={!canSetGoal}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    borderRadius: '4px',
                    border: '1px solid var(--border-color)',
                    fontSize: '1rem',
                    fontWeight: '700',
                    color: 'var(--text-main)',
                    background: '#ffffff'
                  }}
                />
                <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: '600' }}>deals</span>
              </div>
            </div>

            {/* Revenue Input */}
            <div style={{
              background: !isRevMode ? 'var(--bg-main)' : 'rgba(15, 110, 86, 0.04)',
              border: !isRevMode ? '1px solid var(--border-color)' : '1.5px solid var(--accent-teal)',
              borderRadius: '6px',
              padding: '10px 12px'
            }}>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: !isRevMode ? 'var(--text-muted)' : 'var(--accent-teal)', marginBottom: '4px' }}>
                TARGET REVENUE (rev_ex_gst)
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-muted)' }}>₹</span>
                <input
                  type="number"
                  min="1000"
                  max="500000000"
                  step="50000"
                  value={targetRevenue}
                  onChange={(e) => handleRevenueChange(e.target.value)}
                  disabled={!canSetGoal}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    borderRadius: '4px',
                    border: '1px solid var(--border-color)',
                    fontSize: '1rem',
                    fontWeight: '700',
                    color: 'var(--text-main)',
                    background: '#ffffff'
                  }}
                />
              </div>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px', display: 'block' }}>
                {formatLakhs(Number(targetRevenue) || 0)}
              </span>
            </div>

            {/* Growth % Input */}
            <div style={{
              background: 'var(--bg-main)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              padding: '10px 12px'
            }}>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '4px' }}>
                GROWTH VELOCITY (%)
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-muted)' }}>+</span>
                <input
                  type="number"
                  min="-50"
                  max="500"
                  value={growthPct}
                  onChange={(e) => handleGrowthPctChange(e.target.value)}
                  disabled={!canSetGoal}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    borderRadius: '4px',
                    border: '1px solid var(--border-color)',
                    fontSize: '1rem',
                    fontWeight: '700',
                    color: 'var(--text-main)',
                    background: '#ffffff'
                  }}
                />
                <span style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-muted)' }}>%</span>
              </div>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px', display: 'block' }}>
                vs Current Run-Rate
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Output Line: Required closures / month & Uplift */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 14px',
        background: '#f8fafc',
        borderRadius: '6px',
        border: '1px solid var(--border-color, #e2e8f0)',
        fontSize: '0.78rem',
        flexWrap: 'wrap',
        gap: '8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-main)' }}>
          <Sparkles size={14} color="var(--accent-teal)" />
          <span>
            <strong>Required Closures:</strong>{' '}
            {numTargetDeals} deals/yr (~{requiredMonthlyDeals}/mo) • {formatCurrency(requiredMonthlyRev)}/mo for remaining {monthsRemaining} months
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            fontSize: '0.72rem',
            fontWeight: '700',
            color: upliftVsPace >= 0 ? '#0F6E56' : '#dc2626',
            background: upliftVsPace >= 0 ? 'rgba(15, 110, 86, 0.08)' : 'rgba(239, 68, 68, 0.08)',
            padding: '2px 8px',
            borderRadius: '4px'
          }}>
            {upliftVsPace >= 0 ? `+${upliftVsPace}%` : `${upliftVsPace}%`} vs current pace
          </span>
        </div>
      </div>
    </div>
  );
};

export default ProfileGoalSetter;
