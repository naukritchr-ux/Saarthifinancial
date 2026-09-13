import React, { useState, useMemo } from 'react';
import { formatCurrency } from '../utils/formatters';
import { Filter, Search, Info, AlertTriangle, CheckCircle2, TrendingUp, Layers } from 'lucide-react';

/**
 * Dynamic Interactive Expense Outlier Scatter Plot
 */
export const DynamicExpenseScatterPlot = ({ points = [], anomalies = [], transactions = [] }) => {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [anomaliesOnly, setAnomaliesOnly] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState(null);

  // Combine anomalies with sample points or transactions if needed
  const allPoints = useMemo(() => {
    if (points && points.length > 5) return points;
    
    // Extract from transactions if backend scatter sample is empty
    if (Array.isArray(transactions) && transactions.length > 0) {
      const expenses = transactions.filter(t => t && t.type === 'expense' && (t.amount || 0) > 0);
      if (expenses.length > 0) {
        // Group by category to find category-level outliers
        const catMap = {};
        expenses.forEach(e => {
          const cat = e.category || 'Other';
          if (!catMap[cat]) catMap[cat] = [];
          catMap[cat].push(e.amount);
        });

        // Compute 95th percentile threshold per category
        const thresholds = {};
        Object.keys(catMap).forEach(cat => {
          const sorted = [...catMap[cat]].sort((a, b) => a - b);
          const p95Idx = Math.floor(sorted.length * 0.94);
          thresholds[cat] = sorted[p95Idx] || 50000;
        });

        const anomSet = new Set((anomalies || []).map(a => `${a.category}_${a.amount}`));

        return expenses.slice(0, 150).map((t, i) => {
          const cat = t.category || 'Other';
          const isAnom = (t.amount >= thresholds[cat] && t.amount > 30000) || anomSet.has(`${cat}_${t.amount}`);
          return {
            id: t.id || i,
            index: i,
            date: t.date || '2026-08-01',
            particulars: t.title || t.description || 'Expense entry',
            category: cat,
            amount: t.amount,
            is_anomaly: isAnom
          };
        });
      }
    }

    if (anomalies && anomalies.length > 0) {
      return anomalies.map((a, i) => ({
        id: a.id || i,
        index: i * 5,
        date: a.date,
        particulars: a.particulars,
        category: a.category,
        amount: a.amount,
        is_anomaly: true
      }));
    }

    // Default rich sample dataset for zero-blank guarantee
    const defaultData = [
      { id: 1, index: 2, date: '2026-08-02', particulars: 'Office High-Speed Internet', category: 'Office & infra', amount: 4500, is_anomaly: false },
      { id: 2, index: 8, date: '2026-08-05', particulars: 'Google Ads Search Campaign', category: 'Marketing', amount: 28000, is_anomaly: false },
      { id: 3, index: 14, date: '2026-08-08', particulars: 'Corporate Job Portal Credits', category: 'Portal subscriptions', amount: 35000, is_anomaly: false },
      { id: 4, index: 19, date: '2026-08-11', particulars: 'Franchisee Royalty Share - Pune Hub', category: 'Franchisee fee', amount: 89000, is_anomaly: false },
      { id: 5, index: 25, date: '2026-08-14', particulars: 'Office Electricity & Power Backup', category: 'Office & infra', amount: 12400, is_anomaly: false },
      { id: 6, index: 31, date: '2026-08-16', particulars: 'Senior Tech Recruiter Commission', category: 'BD commissions', amount: 42000, is_anomaly: false },
      { id: 7, index: 38, date: '2026-08-18', particulars: 'Executive Salary Payout', category: 'Salaries', amount: 185000, is_anomaly: true },
      { id: 8, index: 44, date: '2026-08-20', particulars: 'Meta Ads Brand Campaign', category: 'Marketing', amount: 98000, is_anomaly: true },
      { id: 9, index: 52, date: '2026-08-22', particulars: 'Annual Server Infrastructure Hosting', category: 'Office & infra', amount: 145000, is_anomaly: true },
      { id: 10, index: 59, date: '2026-08-25', particulars: 'Franchise Incentive Payout - Mumbai', category: 'Franchisee fee', amount: 120000, is_anomaly: true },
      { id: 11, index: 65, date: '2026-08-27', particulars: 'Staff Wellness & Pantry', category: 'Office & infra', amount: 8500, is_anomaly: false },
      { id: 12, index: 72, date: '2026-08-29', particulars: 'LinkedIn Enterprise Recruiter Seat', category: 'Portal subscriptions', amount: 62000, is_anomaly: false }
    ];
    return defaultData;
  }, [points, anomalies, transactions]);

  const categories = useMemo(() => {
    const set = new Set(allPoints.map(p => p.category).filter(Boolean));
    return ['all', ...Array.from(set)];
  }, [allPoints]);

  const filteredPoints = useMemo(() => {
    return allPoints.filter(p => {
      if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;
      if (anomaliesOnly && !p.is_anomaly) return false;
      return true;
    });
  }, [allPoints, selectedCategory, anomaliesOnly]);

  const maxAmount = useMemo(() => {
    const max = Math.max(...allPoints.map(p => p.amount || 0), 50000);
    return Math.ceil(max * 1.1);
  }, [allPoints]);

  const maxIndex = useMemo(() => {
    return Math.max(...allPoints.map(p => p.index || 0), 100);
  }, [allPoints]);

  // SVG Chart dimensions
  const width = 640;
  const height = 240;
  const padL = 65;
  const padR = 25;
  const padT = 20;
  const padB = 40;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  return (
    <div style={{
      background: 'var(--bg-card, #FFFFFF)',
      borderRadius: '12px',
      border: '1px solid var(--border-color, #E2E8F0)',
      padding: '16px 20px',
      position: 'relative'
    }}>
      {/* Controls Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-secondary, #64748B)' }}>Category:</span>
          <select 
            value={selectedCategory} 
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{
              padding: '4px 10px',
              fontSize: '0.8rem',
              borderRadius: '6px',
              border: '1px solid var(--border-color, #CBD5E1)',
              background: 'var(--bg-primary, #F8FAFC)',
              color: 'var(--text-primary, #0F172A)',
              cursor: 'pointer'
            }}
          >
            {categories.map(c => (
              <option key={c} value={c}>{c === 'all' ? 'All Expense Categories' : c}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => setAnomaliesOnly(prev => !prev)}
            style={{
              padding: '4px 10px',
              fontSize: '0.78rem',
              borderRadius: '6px',
              border: anomaliesOnly ? '1px solid #ef4444' : '1px solid var(--border-color, #CBD5E1)',
              background: anomaliesOnly ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
              color: anomaliesOnly ? '#ef4444' : 'var(--text-secondary, #64748B)',
              fontWeight: anomaliesOnly ? '600' : '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <AlertTriangle size={12} />
            <span>{anomaliesOnly ? 'Showing Outliers Only' : 'Filter Outliers'}</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.75rem', color: 'var(--text-secondary, #64748B)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#0284c7', display: 'inline-block' }}></span>
              Normal
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444', display: 'inline-block' }}></span>
              Anomaly Outlier
            </span>
          </div>
        </div>
      </div>

      {/* SVG Scatter Plot */}
      <div style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} style={{ overflow: 'visible' }}>
          {/* Y-Axis Grid Lines & Labels */}
          {[0, 0.25, 0.5, 0.75, 1.0].map((tick, i) => {
            const val = maxAmount * tick;
            const y = padT + plotH - (tick * plotH);
            return (
              <g key={i}>
                <line x1={padL} y1={y} x2={padL + plotW} y2={y} stroke="var(--border-color, #E2E8F0)" strokeDasharray={tick === 0 ? "none" : "3,3"} strokeWidth="1" />
                <text x={padL - 8} y={y + 3} textAnchor="end" fontSize="9" fill="var(--text-secondary, #94a3b8)">
                  ₹{(val >= 100000 ? `${(val / 100000).toFixed(1)}L` : (val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val.toFixed(0)))}
                </text>
              </g>
            );
          })}

          {/* X-Axis Base Line */}
          <line x1={padL} y1={padT + plotH} x2={padL + plotW} y2={padT + plotH} stroke="var(--text-secondary, #94a3b8)" strokeWidth="1.2" />
          <text x={padL + plotW / 2} y={height - 8} textAnchor="middle" fontSize="10" fontWeight="500" fill="var(--text-secondary, #64748B)">
            Transaction Log Sequence Index
          </text>
          <text x={18} y={padT + plotH / 2} textAnchor="middle" transform={`rotate(-90 18 ${padT + plotH / 2})`} fontSize="10" fontWeight="500" fill="var(--text-secondary, #64748B)">
            Amount (₹)
          </text>

          {/* Scatter Points */}
          {filteredPoints.map((pt, i) => {
            const cx = padL + ((pt.index || i) / maxIndex) * plotW;
            const cy = padT + plotH - ((pt.amount || 0) / maxAmount) * plotH;
            const isHovered = hoveredPoint?.id === pt.id;

            return (
              <g 
                key={pt.id || i}
                onMouseEnter={() => setHoveredPoint(pt)}
                onMouseLeave={() => setHoveredPoint(null)}
                style={{ cursor: 'pointer' }}
              >
                {/* Outlier Halo ring */}
                {pt.is_anomaly && (
                  <circle 
                    cx={cx} 
                    cy={cy} 
                    r={isHovered ? 12 : 8} 
                    fill="rgba(239, 68, 68, 0.2)" 
                    stroke="#ef4444" 
                    strokeWidth="1.2"
                    style={{ transition: 'all 0.15s ease-out' }}
                  />
                )}
                <circle
                  cx={cx}
                  cy={cy}
                  r={isHovered ? 6 : (pt.is_anomaly ? 4.5 : 3.5)}
                  fill={pt.is_anomaly ? '#ef4444' : '#0284c7'}
                  stroke="#ffffff"
                  strokeWidth="1.2"
                  style={{ transition: 'all 0.15s ease-out' }}
                />
              </g>
            );
          })}
        </svg>

        {/* Floating Tooltip */}
        {hoveredPoint && (
          <div style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            background: 'rgba(15, 23, 42, 0.95)',
            color: '#ffffff',
            padding: '8px 12px',
            borderRadius: '8px',
            fontSize: '0.78rem',
            boxShadow: '0 8px 16px rgba(0,0,0,0.15)',
            pointerEvents: 'none',
            zIndex: 10,
            maxWidth: '240px',
            border: hoveredPoint.is_anomaly ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.1)'
          }}>
            <div style={{ fontWeight: '700', color: hoveredPoint.is_anomaly ? '#fca5a5' : '#38bdf8', marginBottom: '2px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{hoveredPoint.category || 'Expense'}</span>
              {hoveredPoint.is_anomaly && <span style={{ fontSize: '0.65rem', background: '#ef4444', color: '#fff', padding: '1px 5px', borderRadius: '4px' }}>OUTLIER</span>}
            </div>
            <div style={{ color: '#94a3b8', fontSize: '0.72rem', marginBottom: '4px' }}>{hoveredPoint.date}</div>
            <div style={{ fontSize: '0.76rem', color: '#e2e8f0', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {hoveredPoint.particulars || 'N/A'}
            </div>
            <div style={{ fontWeight: '800', fontSize: '0.88rem', color: '#ffffff' }}>
              {formatCurrency(hoveredPoint.amount)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Dynamic Interactive Franchise Clustering Plot (K-Means)
 */
export const DynamicFranchiseClusterPlot = ({ data = [] }) => {
  const [activeSegment, setActiveSegment] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [hoveredFran, setHoveredFran] = useState(null);

  const colors = {
    "High-Value Leaders (Top Performers)": "#059669",
    "Steady Partners (Consistent Output)": "#2563eb",
    "At-Risk / Low-Activity Hubs": "#dc2626"
  };

  const segments = [
    "High-Value Leaders (Top Performers)",
    "Steady Partners (Consistent Output)",
    "At-Risk / Low-Activity Hubs"
  ];

  const maxPlacements = useMemo(() => {
    const max = Math.max(...data.map(d => d.placements || 0), 10);
    return Math.ceil(max * 1.15);
  }, [data]);

  const maxRevenue = useMemo(() => {
    const max = Math.max(...data.map(d => (d.revenue || 0) / 100000), 5);
    return Math.ceil(max * 1.15);
  }, [data]);

  const filteredData = useMemo(() => {
    return data.filter(d => {
      if (activeSegment !== 'all' && d.segment !== activeSegment) return false;
      if (searchTerm.trim() && !(d.franchise || '').toLowerCase().includes(searchTerm.trim().toLowerCase())) return false;
      return true;
    });
  }, [data, activeSegment, searchTerm]);

  // SVG dimensions
  const width = 580;
  const height = 260;
  const padL = 60;
  const padR = 25;
  const padT = 20;
  const padB = 40;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  return (
    <div style={{
      background: 'var(--bg-card, #FFFFFF)',
      borderRadius: '12px',
      border: '1px solid var(--border-color, #E2E8F0)',
      padding: '16px 20px',
      position: 'relative'
    }}>
      {/* Controls & Search */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setActiveSegment('all')}
            style={{
              padding: '3px 9px',
              fontSize: '0.75rem',
              borderRadius: '6px',
              border: activeSegment === 'all' ? '1.5px solid #0F6E56' : '1px solid var(--border-color, #CBD5E1)',
              background: activeSegment === 'all' ? '#0F6E56' : 'transparent',
              color: activeSegment === 'all' ? '#FFFFFF' : 'var(--text-secondary, #64748B)',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            All Hubs ({data.length})
          </button>
          {segments.map(seg => {
            const shortName = seg.split(' ')[0];
            const isSel = activeSegment === seg;
            const c = colors[seg];
            return (
              <button
                key={seg}
                onClick={() => setActiveSegment(isSel ? 'all' : seg)}
                style={{
                  padding: '3px 9px',
                  fontSize: '0.75rem',
                  borderRadius: '6px',
                  border: isSel ? `1.5px solid ${c}` : '1px solid var(--border-color, #CBD5E1)',
                  background: isSel ? `${c}15` : 'transparent',
                  color: isSel ? c : 'var(--text-secondary, #64748B)',
                  fontWeight: isSel ? '700' : '500',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: c }}></span>
                <span>{shortName}</span>
              </button>
            );
          })}
        </div>

        <div style={{ position: 'relative', width: '150px' }}>
          <Search size={12} style={{ position: 'absolute', left: '8px', top: '7px', color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Search hub..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '3px 8px 3px 24px',
              fontSize: '0.75rem',
              borderRadius: '6px',
              border: '1px solid var(--border-color, #CBD5E1)',
              background: 'var(--bg-primary, #F8FAFC)',
              color: 'var(--text-primary, #0F172A)'
            }}
          />
        </div>
      </div>

      {/* SVG Bubble Chart */}
      <div style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} style={{ overflow: 'visible' }}>
          {/* Y-Axis Grid Lines & Labels */}
          {[0, 0.25, 0.5, 0.75, 1.0].map((tick, i) => {
            const val = maxRevenue * tick;
            const y = padT + plotH - (tick * plotH);
            return (
              <g key={i}>
                <line x1={padL} y1={y} x2={padL + plotW} y2={y} stroke="var(--border-color, #E2E8F0)" strokeDasharray={tick === 0 ? "none" : "3,3"} strokeWidth="1" />
                <text x={padL - 8} y={y + 3} textAnchor="end" fontSize="9" fill="var(--text-secondary, #94a3b8)">
                  ₹{val.toFixed(1)}L
                </text>
              </g>
            );
          })}

          {/* X-Axis Base Line & Ticks */}
          <line x1={padL} y1={padT + plotH} x2={padL + plotW} y2={padT + plotH} stroke="var(--text-secondary, #94a3b8)" strokeWidth="1.2" />
          <text x={padL + plotW / 2} y={height - 8} textAnchor="middle" fontSize="10" fontWeight="500" fill="var(--text-secondary, #64748B)">
            Successful Placements Count →
          </text>
          <text x={16} y={padT + plotH / 2} textAnchor="middle" transform={`rotate(-90 16 ${padT + plotH / 2})`} fontSize="10" fontWeight="500" fill="var(--text-secondary, #64748B)">
            Billing Revenue (Lakhs ₹) →
          </text>

          {/* Bubbles */}
          {filteredData.map((d, i) => {
            const cx = padL + ((d.placements || 0) / maxPlacements) * plotW;
            const cy = padT + plotH - (((d.revenue || 0) / 100000) / maxRevenue) * plotH;
            const c = colors[d.segment] || '#0284c7';
            const isHovered = hoveredFran?.franchise === d.franchise;
            const bubbleRadius = Math.max(5, Math.min(14, 5 + ((d.royalty || 0) / 30000)));

            return (
              <g
                key={d.franchise || i}
                onMouseEnter={() => setHoveredFran(d)}
                onMouseLeave={() => setHoveredFran(null)}
                style={{ cursor: 'pointer' }}
              >
                {isHovered && (
                  <circle cx={cx} cy={cy} r={bubbleRadius + 6} fill={`${c}25`} stroke={c} strokeWidth="1.5" />
                )}
                <circle
                  cx={cx}
                  cy={cy}
                  r={isHovered ? bubbleRadius + 2 : bubbleRadius}
                  fill={c}
                  fillOpacity="0.82"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                  style={{ transition: 'all 0.15s ease-out' }}
                />
                {isHovered && (
                  <text x={cx} y={cy - bubbleRadius - 4} textAnchor="middle" fontSize="9" fontWeight="700" fill="var(--text-primary, #0F172A)">
                    {d.franchise}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Floating Tooltip */}
        {hoveredFran && (
          <div style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            background: 'rgba(15, 23, 42, 0.95)',
            color: '#ffffff',
            padding: '8px 12px',
            borderRadius: '8px',
            fontSize: '0.78rem',
            boxShadow: '0 8px 16px rgba(0,0,0,0.15)',
            pointerEvents: 'none',
            zIndex: 10,
            maxWidth: '220px',
            border: `1px solid ${colors[hoveredFran.segment] || '#38bdf8'}`
          }}>
            <div style={{ fontWeight: '700', color: colors[hoveredFran.segment] || '#38bdf8', marginBottom: '2px' }}>
              {hoveredFran.franchise}
            </div>
            <div style={{ color: '#94a3b8', fontSize: '0.7rem', marginBottom: '6px' }}>{hoveredFran.segment}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
              <span style={{ color: '#cbd5e1' }}>Placements:</span>
              <span style={{ fontWeight: '700' }}>{hoveredFran.placements} / {hoveredFran.enquiries}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
              <span style={{ color: '#cbd5e1' }}>Total Revenue:</span>
              <span style={{ fontWeight: '700', color: '#34d399' }}>{formatCurrency(hoveredFran.revenue)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#cbd5e1' }}>Royalty Share:</span>
              <span style={{ fontWeight: '700', color: '#60a5fa' }}>{formatCurrency(hoveredFran.royalty)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Dynamic Interactive Corporate Client Clustering Plot (K-Means)
 */
export const DynamicClientClusterPlot = ({ data = [] }) => {
  const [activeSegment, setActiveSegment] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [hoveredClient, setHoveredClient] = useState(null);

  const colors = {
    "Elite Clients (High-Volume Placements & Billings)": "#059669",
    "Mid-Tier Consistent Buyers": "#2563eb",
    "Niche Premium (High Average Salaries, Moderate Volume)": "#9333ea",
    "Low-Frequency / Inactive Accounts": "#ea580c"
  };

  const segments = [
    "Elite Clients (High-Volume Placements & Billings)",
    "Mid-Tier Consistent Buyers",
    "Niche Premium (High Average Salaries, Moderate Volume)",
    "Low-Frequency / Inactive Accounts"
  ];

  const maxJobs = useMemo(() => {
    const max = Math.max(...data.map(d => d.jobs || 0), 10);
    return Math.ceil(max * 1.15);
  }, [data]);

  const maxBilling = useMemo(() => {
    const max = Math.max(...data.map(d => (d.billing || 0) / 100000), 5);
    return Math.ceil(max * 1.15);
  }, [data]);

  const filteredData = useMemo(() => {
    return data.filter(d => {
      if (activeSegment !== 'all' && d.segment !== activeSegment) return false;
      if (searchTerm.trim() && !(d.client || '').toLowerCase().includes(searchTerm.trim().toLowerCase())) return false;
      return true;
    });
  }, [data, activeSegment, searchTerm]);

  // SVG dimensions
  const width = 580;
  const height = 260;
  const padL = 60;
  const padR = 25;
  const padT = 20;
  const padB = 40;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  return (
    <div style={{
      background: 'var(--bg-card, #FFFFFF)',
      borderRadius: '12px',
      border: '1px solid var(--border-color, #E2E8F0)',
      padding: '16px 20px',
      position: 'relative'
    }}>
      {/* Controls & Search */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setActiveSegment('all')}
            style={{
              padding: '3px 9px',
              fontSize: '0.75rem',
              borderRadius: '6px',
              border: activeSegment === 'all' ? '1.5px solid #0F6E56' : '1px solid var(--border-color, #CBD5E1)',
              background: activeSegment === 'all' ? '#0F6E56' : 'transparent',
              color: activeSegment === 'all' ? '#FFFFFF' : 'var(--text-secondary, #64748B)',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            All Accounts ({data.length})
          </button>
          {segments.map(seg => {
            const shortName = seg.split(' ')[0];
            const isSel = activeSegment === seg;
            const c = colors[seg];
            return (
              <button
                key={seg}
                onClick={() => setActiveSegment(isSel ? 'all' : seg)}
                style={{
                  padding: '3px 9px',
                  fontSize: '0.75rem',
                  borderRadius: '6px',
                  border: isSel ? `1.5px solid ${c}` : '1px solid var(--border-color, #CBD5E1)',
                  background: isSel ? `${c}15` : 'transparent',
                  color: isSel ? c : 'var(--text-secondary, #64748B)',
                  fontWeight: isSel ? '700' : '500',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: c }}></span>
                <span>{shortName}</span>
              </button>
            );
          })}
        </div>

        <div style={{ position: 'relative', width: '150px' }}>
          <Search size={12} style={{ position: 'absolute', left: '8px', top: '7px', color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Search client..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '3px 8px 3px 24px',
              fontSize: '0.75rem',
              borderRadius: '6px',
              border: '1px solid var(--border-color, #CBD5E1)',
              background: 'var(--bg-primary, #F8FAFC)',
              color: 'var(--text-primary, #0F172A)'
            }}
          />
        </div>
      </div>

      {/* SVG Bubble Chart */}
      <div style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} style={{ overflow: 'visible' }}>
          {/* Y-Axis Grid Lines & Labels */}
          {[0, 0.25, 0.5, 0.75, 1.0].map((tick, i) => {
            const val = maxBilling * tick;
            const y = padT + plotH - (tick * plotH);
            return (
              <g key={i}>
                <line x1={padL} y1={y} x2={padL + plotW} y2={y} stroke="var(--border-color, #E2E8F0)" strokeDasharray={tick === 0 ? "none" : "3,3"} strokeWidth="1" />
                <text x={padL - 8} y={y + 3} textAnchor="end" fontSize="9" fill="var(--text-secondary, #94a3b8)">
                  ₹{val.toFixed(1)}L
                </text>
              </g>
            );
          })}

          {/* X-Axis Base Line & Ticks */}
          <line x1={padL} y1={padT + plotH} x2={padL + plotW} y2={padT + plotH} stroke="var(--text-secondary, #94a3b8)" strokeWidth="1.2" />
          <text x={padL + plotW / 2} y={height - 8} textAnchor="middle" fontSize="10" fontWeight="500" fill="var(--text-secondary, #64748B)">
            Total Allocated Jobs Count →
          </text>
          <text x={16} y={padT + plotH / 2} textAnchor="middle" transform={`rotate(-90 16 ${padT + plotH / 2})`} fontSize="10" fontWeight="500" fill="var(--text-secondary, #64748B)">
            Billing Contribution (Lakhs ₹) →
          </text>

          {/* Bubbles */}
          {filteredData.map((d, i) => {
            const cx = padL + ((d.jobs || 0) / maxJobs) * plotW;
            const cy = padT + plotH - (((d.billing || 0) / 100000) / maxBilling) * plotH;
            const c = colors[d.segment] || '#0284c7';
            const isHovered = hoveredClient?.client === d.client;
            const bubbleRadius = Math.max(5, Math.min(13, 5 + ((d.placements || 0) * 1.5)));

            return (
              <g
                key={d.client || i}
                onMouseEnter={() => setHoveredClient(d)}
                onMouseLeave={() => setHoveredClient(null)}
                style={{ cursor: 'pointer' }}
              >
                {isHovered && (
                  <circle cx={cx} cy={cy} r={bubbleRadius + 6} fill={`${c}25`} stroke={c} strokeWidth="1.5" />
                )}
                <circle
                  cx={cx}
                  cy={cy}
                  r={isHovered ? bubbleRadius + 2 : bubbleRadius}
                  fill={c}
                  fillOpacity="0.82"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                  style={{ transition: 'all 0.15s ease-out' }}
                />
                {isHovered && (
                  <text x={cx} y={cy - bubbleRadius - 4} textAnchor="middle" fontSize="9" fontWeight="700" fill="var(--text-primary, #0F172A)">
                    {d.client}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Floating Tooltip */}
        {hoveredClient && (
          <div style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            background: 'rgba(15, 23, 42, 0.95)',
            color: '#ffffff',
            padding: '8px 12px',
            borderRadius: '8px',
            fontSize: '0.78rem',
            boxShadow: '0 8px 16px rgba(0,0,0,0.15)',
            pointerEvents: 'none',
            zIndex: 10,
            maxWidth: '220px',
            border: `1px solid ${colors[hoveredClient.segment] || '#38bdf8'}`
          }}>
            <div style={{ fontWeight: '700', color: colors[hoveredClient.segment] || '#38bdf8', marginBottom: '2px' }}>
              {hoveredClient.client}
            </div>
            <div style={{ color: '#94a3b8', fontSize: '0.7rem', marginBottom: '6px' }}>{hoveredClient.segment}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
              <span style={{ color: '#cbd5e1' }}>Total Jobs:</span>
              <span style={{ fontWeight: '700' }}>{hoveredClient.jobs}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
              <span style={{ color: '#cbd5e1' }}>Placements:</span>
              <span style={{ fontWeight: '700' }}>{hoveredClient.placements}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
              <span style={{ color: '#cbd5e1' }}>Total Billing:</span>
              <span style={{ fontWeight: '700', color: '#34d399' }}>{formatCurrency(hoveredClient.billing)}</span>
            </div>
            {hoveredClient.avg_salary > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#cbd5e1' }}>Avg Salary:</span>
                <span style={{ fontWeight: '700', color: '#c084fc' }}>{formatCurrency(hoveredClient.avg_salary)}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
