import React, { useState } from 'react';
import { X, Award, Check, Copy, TrendingUp, Calendar, FileText, ArrowRight } from 'lucide-react';
import { API_BASE_URL } from '../context/FinanceContext';
import { fetchWithApiKey } from '../utils/apiClient';
import { formatCurrency } from '../utils/formatters';

const GoalSetterModal = ({ isOpen, onClose, entityType, entity, onTargetCreated }) => {
  const [growthPct, setGrowthPct] = useState('20');
  const [salaryTarget, setSalaryTarget] = useState(entityType === 'bd_agent' ? (entity?.baseSalary ? String(Math.round(entity.baseSalary * 1.25)) : '15000') : '');
  const [periodStart, setPeriodStart] = useState('2026-04-01');
  const [periodEnd, setPeriodEnd] = useState('2027-03-31');
  const [guidelines, setGuidelines] = useState(
    entityType === 'franchisee'
      ? 'Expand candidate sourcing across BFSI and IT sectors. Target a minimum of 30 successful client placements while keeping payment collection cycles under 45 days.'
      : 'Focus on enterprise client acquisition and increase closed mandate conversion from 40% to 65%. Maintain diligent verification of billable invoices.'
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [createdTarget, setCreatedTarget] = useState(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const baseRevenue = entity?.baseRevenue || entity?.revenue || 5000000;
  const numGrowth = parseFloat(growthPct) || 0;
  const targetRevenue = baseRevenue * (1 + numGrowth / 100);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = {
        entity_type: entityType,
        entity_id: entity?.id || entity?.name,
        growth_pct_target: numGrowth,
        salary_target: entityType === 'bd_agent' && salaryTarget ? parseFloat(salaryTarget) : null,
        period_start: periodStart,
        period_end: periodEnd,
        guidelines: guidelines.trim()
      };

      const res = await fetchWithApiKey(`${API_BASE_URL}/growth-targets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to save growth target');
      }

      const data = await res.json();
      setCreatedTarget(data);
      if (onTargetCreated) {
        onTargetCreated(data);
      }
    } catch (err) {
      setError(err.message);
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
              {/* Baseline vs Target Summary Banner */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', background: 'var(--bg-card)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-color)', marginBottom: '18px' }}>
                <div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600', display: 'block' }}>Baseline Revenue</span>
                  <span style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-main)' }}>{formatCurrency(baseRevenue)}</span>
                </div>
                <div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600', display: 'block' }}>Target Growth Rate</span>
                  <span style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--accent-teal)' }}>+{numGrowth}%</span>
                </div>
                <div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600', display: 'block' }}>Projected Target</span>
                  <span style={{ fontSize: '1.15rem', fontWeight: '700', color: '#10b981' }}>{formatCurrency(targetRevenue)}</span>
                </div>
              </div>

              {/* Growth Target Inputs */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-main)', marginBottom: '6px' }}>
                  Target Growth Percentage (% over baseline)
                </label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="number"
                    step="0.5"
                    min="-20"
                    max="500"
                    value={growthPct}
                    onChange={(e) => setGrowthPct(e.target.value)}
                    style={{ flex: 1, padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '0.9rem', fontWeight: '600' }}
                    required
                  />
                  {[10, 20, 35, 50, 100].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setGrowthPct(String(preset))}
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
              </div>

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
