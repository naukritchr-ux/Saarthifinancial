import React, { useMemo, useState } from 'react';
import { formatCurrency, formatLakhs } from '../utils/formatters';
import { analyzeIndustryPotential, INDUSTRY_COLORS } from '../utils/industryPredictor';
import { 
  Briefcase, 
  TrendingUp, 
  Target, 
  Sparkles, 
  ShieldCheck, 
  PieChart, 
  Award, 
  ArrowUpRight, 
  Layers,
  Zap,
  ChevronDown,
  ChevronRight,
  UserCheck
} from 'lucide-react';

export const IndustryPredictiveTab = ({
  transactions = [],
  entityType = 'franchisee', // 'franchisee' | 'bd'
  entityName = '',
  onboardingDate = null,
  yearsCompleted = null
}) => {
  const [expandedIndustries, setExpandedIndustries] = useState(new Set());

  const toggleIndustry = (indName) => {
    setExpandedIndustries(prev => {
      const next = new Set(prev);
      if (next.has(indName)) {
        next.delete(indName);
      } else {
        next.add(indName);
      }
      return next;
    });
  };

  const analysis = useMemo(() => {
    return analyzeIndustryPotential({
      transactions,
      entityType,
      entityName,
      onboardingDate,
      yearsCompleted
    });
  }, [transactions, entityType, entityName, onboardingDate, yearsCompleted]);

  const { industryBreakdown, potential, is3YearsCompleted, franchiseShareRate, companyShareRate, tenureYears } = analysis;

  return (
    <div className="industry-predictive-tab animate-fade-in" style={{ padding: '4px 0' }}>
      {/* 1. TOP STATS: PRESENT POTENTIAL & PREDICTIVE FORECAST */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '14px',
        marginBottom: '20px'
      }}>
        {/* Card 1: Potential Index */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(37,99,235,0.08) 0%, rgba(16,185,129,0.05) 100%)',
          border: '1px solid rgba(37,99,235,0.2)',
          borderRadius: '10px',
          padding: '16px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Present Potential Index
            </span>
            <Sparkles size={16} color="#2563eb" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '1.75rem', fontWeight: '800', color: '#2563eb' }}>
              {potential.score !== null && potential.score !== undefined ? potential.score : '—'}
            </span>
            {potential.score !== null && potential.score !== undefined && (
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600' }}>/ 100</span>
            )}
          </div>
          <div style={{
            fontSize: '0.75rem',
            fontWeight: '600',
            color: '#10b981',
            marginTop: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <Zap size={13} /> {potential.band}
          </div>
          <p style={{ margin: '8px 0 0 0', fontSize: '0.68rem', color: 'var(--text-muted)', lineHeight: '1.35' }}>
            Score from 0–100 combining past deal volume, collection speed, and open pipeline to estimate revenue potential.
          </p>
        </div>

        {/* Card 2: Projected Next Quarter Inflows */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '10px',
          padding: '16px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Projected Q+1 Billings
            </span>
            <TrendingUp size={16} color="#10b981" />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-main)' }}>
            {formatCurrency(potential.projectedQuarterlyRevenue)}
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
            Annual Run Rate: <strong>{formatCurrency(potential.projectedAnnualRunRate)}</strong>
          </span>
        </div>

        {/* Card 3: Predicted Share / Retained Margin */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '10px',
          padding: '16px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              {entityType === 'franchisee' ? `Projected Share (${(franchiseShareRate * 100).toFixed(0)}%)` : 'Projected Commission'}
            </span>
            <Target size={16} color="#f59e0b" />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#10b981' }}>
            {formatCurrency(entityType === 'franchisee' ? potential.projectedFranchiseeShare : potential.projectedBdCommission)}
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
            {entityType === 'franchisee' ? (
              <>Tenure: <strong>{tenureYears} yrs</strong> ({is3YearsCompleted ? '70/30 Tier' : '75/25 Tier'})</>
            ) : (
              <>Net Company Contribution: <strong>{formatCurrency(potential.projectedCompanyMargin)}</strong></>
            )}
          </span>
        </div>

        {/* Card 4: Historical Win Rate & Deals */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '10px',
          padding: '16px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Deals & Conversion
            </span>
            <ShieldCheck size={16} color="#8b5cf6" />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-main)' }}>
            {potential.closedDeals} <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)' }}>closed</span>
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
            Win Rate: <strong>{potential.overallWinRate}%</strong> • Pipeline: <strong>{potential.activePipeline} deals</strong>
          </span>
        </div>
      </div>

      {/* 2. INDUSTRY & SUB-INDUSTRY BREAKDOWN TABLE */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: '10px',
        overflow: 'hidden',
        marginBottom: '20px'
      }}>
        <div style={{
          padding: '14px 18px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px'
        }}>
          <div>
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Briefcase size={16} color="var(--accent-teal, #0f766e)" /> Industry Sector & Sub-Industry Distribution
            </h4>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Click any sector row to expand its granular sub-industries and view Star BD specialists
            </span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>
            {industryBreakdown.length} Active Sectors • Click row to expand sub-industries
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: '600', color: 'var(--text-muted)' }}>Industry / Sub-Industry</th>
                <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: '600', color: 'var(--text-muted)' }}>Gross Billed</th>
                <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: '600', color: 'var(--text-muted)' }}>
                  {entityType === 'franchisee' ? `Franchise Share (${(franchiseShareRate * 100).toFixed(0)}%)` : 'BD Commission'}
                </th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: '600', color: 'var(--text-muted)' }}>Closed Deals</th>
                <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: '600', color: 'var(--text-muted)' }}>Avg Ticket Size</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: '600', color: 'var(--text-muted)' }}>Win Rate</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: '600', color: 'var(--text-muted)' }}>Star BD Specialist</th>
              </tr>
            </thead>
            <tbody>
              {industryBreakdown.map((item, idx) => {
                const sharePercent = potential.totalGross > 0 ? (item.totalGross / potential.totalGross) * 100 : 0;
                const isExpanded = expandedIndustries.has(item.industry);
                const hasSubs = item.subIndustries && item.subIndustries.length > 0;

                return (
                  <React.Fragment key={idx}>
                    <tr 
                      onClick={() => hasSubs && toggleIndustry(item.industry)}
                      style={{ 
                        borderBottom: '1px solid var(--border-color)',
                        cursor: hasSubs ? 'pointer' : 'default',
                        background: isExpanded ? 'rgba(15, 110, 86, 0.04)' : 'transparent',
                        transition: 'background 0.15s ease'
                      }}
                      className="hover-row"
                    >
                      {/* Industry Name with Toggle */}
                      <td style={{ padding: '12px 16px', fontWeight: '600', color: 'var(--text-main)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {hasSubs ? (
                            <span style={{ color: 'var(--accent-teal, #0f766e)', display: 'inline-flex' }}>
                              {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                            </span>
                          ) : (
                            <span style={{ width: '15px' }} />
                          )}
                          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: item.color, display: 'inline-block' }}></span>
                          <span style={{ fontSize: '0.86rem' }}>{item.industry}</span>
                          {hasSubs && (
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '500', marginLeft: '4px' }}>
                              ({item.subIndustries.length} sub-sectors)
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '39px', marginTop: '2px' }}>
                          {sharePercent.toFixed(1)}% of total volume • {item.clientCount} corporate clients
                        </div>
                      </td>

                      {/* Gross Billed */}
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '700', color: 'var(--text-main)' }}>
                        {formatCurrency(item.totalGross)}
                      </td>

                      {/* Franchisee / BD Share */}
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '700', color: '#10b981' }}>
                        {formatCurrency(entityType === 'franchisee' ? item.franchiseeShare : item.bdCommission)}
                      </td>

                      {/* Closed Deals */}
                      <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600' }}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '12px',
                          background: 'rgba(37,99,235,0.1)',
                          color: '#2563eb',
                          fontSize: '0.75rem',
                          fontWeight: '700'
                        }}>
                          {item.closedDeals}
                        </span>
                      </td>

                      {/* Avg Ticket Size */}
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600', color: 'var(--text-muted)' }}>
                        {formatCurrency(item.avgTicketSize)}
                      </td>

                      {/* Win Rate */}
                      <td style={{ padding: '12px 16px', minWidth: '130px' }}>
                        {item.winRate !== null && item.winRate !== undefined ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                              <div 
                                style={{ 
                                  width: `${Math.min(100, item.winRate)}%`, 
                                  height: '100%', 
                                  background: item.winRate >= 85 ? '#10b981' : (item.winRate >= 70 ? '#f59e0b' : '#ef4444'),
                                  borderRadius: '3px'
                                }} 
                              />
                            </div>
                            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: item.winRate >= 85 ? '#10b981' : '#f59e0b', width: '38px', textAlign: 'right' }}>
                              {item.winRate}%
                            </span>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            N/A
                          </span>
                        )}
                      </td>

                      {/* Top BD in Sector */}
                      <td style={{ padding: '12px 16px', fontSize: '0.78rem', color: 'var(--text-main)', fontWeight: '600' }}>
                        {item.subIndustries && item.subIndustries[0]?.topBd && item.subIndustries[0]?.topBd !== 'N/A' ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#0f766e' }}>
                            <Award size={13} /> {item.subIndustries[0].topBd}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                    </tr>

                    {/* Granular Sub-Industry Rows when Expanded */}
                    {isExpanded && item.subIndustries.map((sub, sIdx) => (
                      <tr 
                        key={`${idx}-sub-${sIdx}`}
                        style={{
                          background: 'rgba(15, 110, 86, 0.02)',
                          borderBottom: '1px dashed var(--border-color)',
                          fontSize: '0.79rem'
                        }}
                      >
                        <td style={{ padding: '8px 16px 8px 42px', color: 'var(--text-muted)' }}>
                          <span style={{ marginRight: '6px', color: 'var(--accent-teal, #0f766e)' }}>↳</span>
                          <strong style={{ color: 'var(--text-main)', fontWeight: '600' }}>{sub.subIndustry}</strong>
                        </td>
                        <td style={{ padding: '8px 16px', textAlign: 'right', fontWeight: '600', color: 'var(--text-main)' }}>
                          {formatCurrency(sub.totalGross)}
                        </td>
                        <td style={{ padding: '8px 16px', textAlign: 'right', color: 'var(--text-muted)' }}>
                          —
                        </td>
                        <td style={{ padding: '8px 16px', textAlign: 'center', fontWeight: '600' }}>
                          <span style={{
                            padding: '1px 6px',
                            borderRadius: '10px',
                            background: 'rgba(16,185,129,0.1)',
                            color: '#10b981',
                            fontSize: '0.72rem'
                          }}>
                            {sub.closedDeals} deals
                          </span>
                        </td>
                        <td style={{ padding: '8px 16px', textAlign: 'right', color: 'var(--text-muted)' }}>
                          {formatCurrency(sub.avgTicketSize)}
                        </td>
                        <td style={{ padding: '8px 16px' }}>
                          <span style={{
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '0.72rem',
                            fontWeight: '700',
                            background: sub.winRate >= 85 ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                            color: sub.winRate >= 85 ? '#10b981' : '#f59e0b'
                          }}>
                            {sub.winRate}%
                          </span>
                        </td>
                        <td style={{ padding: '8px 16px', fontSize: '0.75rem' }}>
                          {sub.topBd && sub.topBd !== 'N/A' ? (
                            <span style={{ fontWeight: '600', color: '#2563eb', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              <UserCheck size={12} /> {sub.topBd} ({sub.topBdDeals} closed)
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. AI PREDICTIVE INSIGHTS & STRATEGIC RECOMMENDATIONS */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(16,185,129,0.06) 0%, rgba(37,99,235,0.06) 100%)',
        border: '1px solid rgba(16,185,129,0.2)',
        borderRadius: '10px',
        padding: '16px 18px'
      }}>
        <h4 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={16} color="#10b981" /> Predictive Potential Intelligence & Next-Step Guidance
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
          {potential.recommendations.map((rec, i) => (
            <div 
              key={i} 
              style={{ 
                background: 'var(--bg-card)', 
                padding: '12px 14px', 
                borderRadius: '8px', 
                border: '1px solid var(--border-color)',
                fontSize: '0.78rem',
                color: 'var(--text-main)',
                lineHeight: '1.45'
              }}
            >
              {rec}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default IndustryPredictiveTab;
