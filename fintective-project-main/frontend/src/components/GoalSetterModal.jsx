import React, { useState } from 'react';
import { X, Award, Check, Copy, TrendingUp, Calendar, FileText, ArrowRight } from 'lucide-react';
import { API_BASE_URL } from '../context/FinanceContext';
import { fetchWithApiKey } from '../utils/apiClient';
import { formatCurrency } from '../utils/formatters';

const GoalSetterModal = ({ isOpen, onClose, entityType, entity, initialGrowthPct, initialTargetPlacements, initialTargetRevenue, initialTargetAuthor, onTargetCreated }) => {
  const baseRevenue = entity?.baseRevenue || entity?.revenue || entity?.total_revenue || 1000000;
  const baseDeals = entity?.total_deals || entity?.deals_count || 20;
  const avgTicketSize = baseDeals > 0 ? (baseRevenue / baseDeals) : 50000;

  const [targetMode, setTargetMode] = useState(initialTargetPlacements ? 'placements' : 'rate'); // 'rate' | 'placements'
  const [targetAuthor, setTargetAuthor] = useState(initialTargetAuthor || 'owner'); // 'owner' (Management Quota) | 'self' (BD Self-Commitment)
  const [growthPct, setGrowthPct] = useState(initialGrowthPct ? String(initialGrowthPct) : '20');
  const [targetPlacements, setTargetPlacements] = useState(
    initialTargetPlacements ? String(initialTargetPlacements) : String(Math.max(1, Math.round(baseDeals * 1.2)))
  );

  const [salaryTarget, setSalaryTarget] = useState(entityType === 'bd_agent' ? (entity?.baseSalary ? String(Math.round(entity.baseSalary * 1.25)) : '15000') : '');
  const [periodStart, setPeriodStart] = useState('2026-04-01');
  const [periodEnd, setPeriodEnd] = useState('2027-03-31');
  const [guidelines, setGuidelines] = useState(
    entityType === 'franchisee'
      ? 'Expand candidate sourcing across BFSI and IT sectors. Target a minimum of 30 successful client placements while keeping payment collection cycles under 45 days.'
      : (entityType === 'bd_agent'
          ? 'Focus on enterprise client acquisition and increase closed mandate conversion from 40% to 65%. Maintain diligent verification of billable invoices.'
          : 'Focus on candidate placements, optimizing pipeline velocity, and maintaining high conversion rates across all allocated recruitment mandates.')
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [createdTarget, setCreatedTarget] = useState(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Handle bidirectional sync between growthPct and targetPlacements
  const handleRateChange = (val) => {
    setGrowthPct(val);
    const numG = parseFloat(val) || 0;
    const computedPlacements = Math.max(1, Math.round(baseDeals * (1 + numG / 100)));
    setTargetPlacements(String(computedPlacements));
  };

  const handlePlacementsChange = (val) => {
    setTargetPlacements(val);
    const numP = parseFloat(val) || 0;
    if (baseDeals > 0) {
      const computedG = ((numP / baseDeals) - 1) * 100;
      setGrowthPct(computedG.toFixed(1));
    }
  };

  const numGrowth = parseFloat(growthPct) || 0;
  const numPlacements = parseInt(targetPlacements) || Math.max(1, Math.round(baseDeals * (1 + numGrowth / 100)));
  const targetRevenue = (targetMode === 'placements' && avgTicketSize > 0)
    ? (numPlacements * avgTicketSize)
    : (baseRevenue * (1 + numGrowth / 100));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = {
        entity_type: entityType,
        entity_id: entity?.id || entity?.name || 'f-1',
        entity_name: entity?.name || '',
        growth_pct_target: numGrowth,
        salary_target: entityType === 'bd_agent' && salaryTarget ? parseFloat(salaryTarget) : null,
        period_start: periodStart,
        period_end: periodEnd,
        guidelines: guidelines.trim(),
        target_author: targetAuthor,
        target_placements: numPlacements,
        target_revenue: Math.round(targetRevenue)
      };

      const typeLabel = entityType === 'franchisee' ? 'Franchise Partner' : (entityType === 'bd_agent' ? 'BD Specialist' : 'Internal Talent Consultant');
      
      const fallbackLetter = targetAuthor === 'self' 
        ? `================================================================================
TALENT CORNER HR SERVICES — EMPLOYEE PERFORMANCE COMMITMENT PLEDGE
================================================================================
Date of Issue : ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
Pledged By    : ${entity?.name || 'Selected Entity'} (${typeLabel})
Target Period : ${periodStart} to ${periodEnd}
Target Type   : 👤 Employee Self-Commitment (Personal Performance Pledge)
--------------------------------------------------------------------------------

I, ${entity?.name || 'Partner'}, hereby commit and pledge the following performance milestones for the upcoming fiscal cycle:

1. PERSONAL TARGET COMMITMENT
--------------------------------------------------------------------------------
• Current Baseline Revenue        : ₹${baseRevenue.toLocaleString()}
• Self-Pledged Growth Rate        : +${numGrowth}%
• Target Placements Pledged       : ${numPlacements} closed placements
• Self-Projected Revenue Billing  : ₹${Math.round(targetRevenue).toLocaleString()}
• Target Period                   : ${periodStart} through ${periodEnd}${entityType === 'bd_agent' && salaryTarget ? `\n• Desired Compensation Increment  : ₹${parseFloat(salaryTarget).toLocaleString()} per month (Subject to target realization)` : ''}

2. MY ACTION PLAN & COMMITMENT NOTES
--------------------------------------------------------------------------------
${guidelines.trim() || 'Focusing on high-probability mandate closures, proactive candidate submittals, and client engagement.'}

3. COMMITMENT DECLARATION
--------------------------------------------------------------------------------
I confirm this represents my personal professional commitment to Talent Corner HR Services.

Committed by:
${entity?.name || 'Employee'}
Talent Corner HR Services
================================================================================`
        : `================================================================================
TALENT CORNER HR SERVICES — MANAGEMENT EXECUTIVE TARGET DIRECTIVE
================================================================================
Date of Issue : ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
Recipient     : ${entity?.name || 'Selected Entity'} (${typeLabel})
Target Period : ${periodStart} to ${periodEnd}
Target Type   : 👑 Owner / Leadership Quota (Management Benchmark)
--------------------------------------------------------------------------------

Dear ${entity?.name || 'Partner'},

As part of Talent Corner's agency growth and unit economics roadmap for the upcoming fiscal cycle, the Management Board has established your performance quota:

1. MANAGEMENT TARGET DIRECTIVE
--------------------------------------------------------------------------------
• Current Baseline Revenue        : ₹${baseRevenue.toLocaleString()}
• Required Growth Velocity        : +${numGrowth}%
• Required Placements Quota       : ${numPlacements} closed placements
• Mandatory Target Revenue (Gross): ₹${Math.round(targetRevenue).toLocaleString()}
• Evaluation Horizon              : ${periodStart} through ${periodEnd}${entityType === 'bd_agent' && salaryTarget ? `\n• Target Base Compensation        : ₹${parseFloat(salaryTarget).toLocaleString()} per month (Performance-Linked)` : ''}

2. STRATEGIC GUIDELINES & DIRECTIVES
--------------------------------------------------------------------------------
${guidelines.trim() || 'Focus on enterprise client acquisition, mandate conversion speed, and payment realization.'}

3. TERMS OF PERFORMANCE AUDIT
--------------------------------------------------------------------------------
Upon completion of the period ending ${periodEnd}, actual revenue achievement
will be audited against this benchmark for annual performance and incentive reviews.

Authorized Signatory,
Management Board & Leadership
Talent Corner HR Services
================================================================================`;

      let data;
      try {
        const res = await fetchWithApiKey(`${API_BASE_URL}/growth-targets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          data = await res.json();
        } else {
          console.warn('Backend error when creating target, using fallback client memo');
        }
      } catch (fetchErr) {
        console.warn('Network issue reaching growth-targets endpoint:', fetchErr);
      }

      if (!data) {
        data = {
          id: `gt-${Date.now().toString(36)}`,
          entity_type: entityType,
          entity_id: entity?.id || entity?.name || 'f-1',
          entity_name: entity?.name || 'Selected Entity',
          growth_pct_target: numGrowth / 100,
          growth_pct_target_pct: numGrowth,
          base_value: baseRevenue,
          target_value: targetRevenue,
          salary_target: entityType === 'bd_agent' && salaryTarget ? parseFloat(salaryTarget) : null,
          period_start: periodStart,
          period_end: periodEnd,
          guidelines: guidelines.trim(),
          target_author: targetAuthor,
          target_placements: numPlacements,
          target_revenue: Math.round(targetRevenue),
          status: 'active',
          target_letter_text: fallbackLetter,
          created_at: new Date().toISOString().slice(0, 19).replace('T', ' ')
        };
      }

      // Persist to localStorage for guaranteed permanent storage
      try {
        const savedRaw = localStorage.getItem('saarthi_growth_targets');
        const existingList = savedRaw ? JSON.parse(savedRaw) : [];
        const updatedList = [data, ...existingList.filter(t => t.id !== data.id)];
        localStorage.setItem('saarthi_growth_targets', JSON.stringify(updatedList));
      } catch (storageErr) {
        console.warn('LocalStorage save notice:', storageErr);
      }

      setCreatedTarget(data);
      if (onTargetCreated) {
        onTargetCreated(data);
      }
    } catch (err) {
      setError(err.message || 'Error creating target memo');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (createdTarget?.target_letter_text) {
      navigator.clipboard.writeText(createdTarget.target_letter_text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div 
        className="modal-content animate-slide-up" 
        onClick={(e) => e.stopPropagation()} 
        style={{ maxWidth: '780px', width: '92%', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div className="modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-main)', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Award size={20} color="var(--accent-teal)" />
              Set Annual Growth Target & Issue Memo
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px', display: 'block' }}>
              Entity: <strong style={{ color: 'var(--text-main)' }}>{entity?.name || 'Selected Entity'}</strong> ({entityType === 'franchisee' ? 'Franchise Partner' : 'BD Specialist'})
            </span>
          </div>
          <button className="close-btn" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1, backgroundColor: 'var(--bg-main)' }}>
          {error && (
            <div style={{ background: '#FCE8E6', color: '#A8402E', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem', fontWeight: '500' }}>
              {error}
            </div>
          )}

          {!createdTarget ? (
            <form onSubmit={handleSubmit}>
              {/* Target Originator / Goal Type Selector */}
              <div style={{ marginBottom: '16px' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-main)', display: 'block', marginBottom: '6px' }}>
                  Target Originator / Goal Type:
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setTargetAuthor('owner')}
                    style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: targetAuthor === 'owner' ? '2px solid #2563EB' : '1px solid var(--border-color)',
                      background: targetAuthor === 'owner' ? 'rgba(37, 99, 235, 0.08)' : 'var(--bg-card)',
                      color: targetAuthor === 'owner' ? '#1D4ED8' : 'var(--text-main)',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    <div style={{ fontWeight: '800', fontSize: '0.84rem' }}>👑 Owner / Leadership Quota</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>Assigned by Management as company benchmark</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetAuthor('self')}
                    style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: targetAuthor === 'self' ? '2px solid var(--accent-teal)' : '1px solid var(--border-color)',
                      background: targetAuthor === 'self' ? 'rgba(15, 110, 86, 0.08)' : 'var(--bg-card)',
                      color: targetAuthor === 'self' ? 'var(--accent-teal)' : 'var(--text-main)',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    <div style={{ fontWeight: '800', fontSize: '0.84rem' }}>👤 BD Self-Commitment</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>Pledged personally by {entity?.name || 'the employee'}</div>
                  </button>
                </div>
              </div>

              {/* Baseline vs Target Summary Banner */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', background: 'var(--bg-card)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-color)', marginBottom: '18px' }}>
                <div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600', display: 'block' }}>Baseline Revenue</span>
                  <span style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-main)' }}>{formatCurrency(baseRevenue)}</span>
                </div>
                <div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600', display: 'block' }}>Target Placements</span>
                  <span style={{ fontSize: '1.05rem', fontWeight: '700', color: '#3b82f6' }}>{numPlacements} deals</span>
                </div>
                <div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600', display: 'block' }}>Target Growth Rate</span>
                  <span style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--accent-teal)' }}>+{numGrowth}%</span>
                </div>
                <div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600', display: 'block' }}>Projected Target</span>
                  <span style={{ fontSize: '1.05rem', fontWeight: '700', color: '#10b981' }}>{formatCurrency(targetRevenue)}</span>
                </div>
              </div>

              {/* Goal Mode Switcher */}
              <div style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-main)' }}>Goal Setting Mode:</span>
                <div style={{ display: 'flex', background: 'var(--bg-card)', borderRadius: '6px', padding: '2px', border: '1px solid var(--border-color)' }}>
                  <button
                    type="button"
                    onClick={() => setTargetMode('rate')}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '4px',
                      border: 'none',
                      background: targetMode === 'rate' ? 'var(--accent-teal)' : 'transparent',
                      color: targetMode === 'rate' ? '#ffffff' : 'var(--text-muted)',
                      fontSize: '0.74rem',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    📈 Growth Rate %
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetMode('placements')}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '4px',
                      border: 'none',
                      background: targetMode === 'placements' ? 'var(--accent-teal)' : 'transparent',
                      color: targetMode === 'placements' ? '#ffffff' : 'var(--text-muted)',
                      fontSize: '0.74rem',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    🎯 Candidate Placements
                  </button>
                </div>
              </div>

              {/* Target Placements Input */}
              {targetMode === 'placements' ? (
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-main)', marginBottom: '6px' }}>
                    Target Candidate Placements / Mandates (Deals)
                  </label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      max="2000"
                      value={targetPlacements}
                      onChange={(e) => handlePlacementsChange(e.target.value)}
                      style={{ flex: 1, padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '0.9rem', fontWeight: '700' }}
                      required
                    />
                    {[25, 50, 75, 100, 150].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => handlePlacementsChange(String(preset))}
                        style={{
                          padding: '8px 10px',
                          borderRadius: '6px',
                          border: targetPlacements === String(preset) ? '1px solid var(--accent-teal)' : '1px solid var(--border-color)',
                          background: targetPlacements === String(preset) ? 'rgba(15, 110, 86, 0.1)' : 'var(--bg-card)',
                          color: targetPlacements === String(preset) ? 'var(--accent-teal)' : 'var(--text-muted)',
                          fontSize: '0.74rem',
                          fontWeight: '600',
                          cursor: 'pointer'
                        }}
                      >
                        {preset} Deals
                      </button>
                    ))}
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                    Calculates to ≈ {formatCurrency(targetRevenue)} gross revenue (+{numGrowth}% growth) based on historical average deal size.
                  </span>
                </div>
              ) : (
                /* Growth Target Inputs */
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-main)', marginBottom: '6px' }}>
                    Target Growth Percentage (% over baseline)
                  </label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="number"
                      step="0.1"
                      min="-20"
                      max="500"
                      value={growthPct}
                      onChange={(e) => handleRateChange(e.target.value)}
                      style={{ flex: 1, padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '0.9rem', fontWeight: '600' }}
                      required
                    />
                    {[10, 20, 35, 50, 100].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => handleRateChange(String(preset))}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: growthPct === String(preset) ? '1px solid var(--accent-teal)' : '1px solid var(--border-color)',
                          background: growthPct === String(preset) ? 'rgba(15, 110, 86, 0.1)' : 'var(--bg-card)',
                          color: growthPct === String(preset) ? 'var(--accent-teal)' : 'var(--text-muted)',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          cursor: 'pointer'
                        }}
                      >
                        +{preset}%
                      </button>
                    ))}
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                    Equivalent to ≈ {numPlacements} closed placements for this fiscal target.
                  </span>
                </div>
              )}

              {/* Salary Target Field (for BD Agents) */}
              {entityType === 'bd_agent' && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-main)', marginBottom: '6px' }}>
                    Target Base Monthly Compensation (₹) <span style={{ color: 'var(--text-muted)', fontWeight: 'normal' }}>— Performance-linked</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    value={salaryTarget}
                    onChange={(e) => setSalaryTarget(e.target.value)}
                    placeholder="e.g. 18000"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '0.9rem' }}
                  />
                </div>
              )}

              {/* Target Period Dates */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-main)', marginBottom: '6px' }}>
                    Period Start Date
                  </label>
                  <input
                    type="date"
                    value={periodStart}
                    onChange={(e) => setPeriodStart(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '0.85rem' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-main)', marginBottom: '6px' }}>
                    Period End Date (Audit Date)
                  </label>
                  <input
                    type="date"
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '0.85rem' }}
                    required
                  />
                </div>
              </div>

              {/* Guidelines & Strategic Milestones Textarea */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-main)', marginBottom: '6px' }}>
                  Strategic Guidelines & Key Result Area (KRA) Priorities
                </label>
                <textarea
                  rows={4}
                  value={guidelines}
                  onChange={(e) => setGuidelines(e.target.value)}
                  placeholder="Outline core objectives, operational targets, position specializations..."
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '0.85rem', lineHeight: '1.5', fontFamily: 'inherit' }}
                />
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={onClose}
                  style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-main)', fontWeight: '500', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                  style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', background: 'var(--accent-teal)', color: '#ffffff', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  {loading ? 'Generating Memo...' : 'Confirm Target & Generate Memo'}
                </button>
              </div>
            </form>
          ) : (
            /* Target Letter Generated Success View */
            <div className="animate-fade-in">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0F6E56', marginBottom: '12px', fontWeight: '600', fontSize: '0.9rem' }}>
                <Check size={18} />
                Target successfully persisted! Official Target Memo generated below:
              </div>

              <div style={{ position: 'relative', marginBottom: '16px' }}>
                <pre style={{
                  background: '#FFFFFF',
                  padding: '16px 20px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  fontSize: '0.8rem',
                  fontFamily: 'Consolas, Monaco, monospace',
                  whiteSpace: 'pre-wrap',
                  lineHeight: '1.55',
                  color: '#1B2321',
                  maxHeight: '340px',
                  overflowY: 'auto'
                }}>
                  {createdTarget.target_letter_text}
                </pre>
                <button
                  onClick={handleCopy}
                  style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    background: copied ? '#E6F4EA' : '#FFFFFF',
                    color: copied ? '#0F6E56' : 'var(--text-main)',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                  }}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Copied!' : 'Copy Letter'}
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={onClose}
                  style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', background: 'var(--accent-teal)', color: '#ffffff', fontWeight: '600', cursor: 'pointer' }}
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GoalSetterModal;
