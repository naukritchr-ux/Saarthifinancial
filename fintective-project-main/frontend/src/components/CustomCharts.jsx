import React from 'react';
import { formatLakhs } from '../utils/formatters';

/**
 * Donut Chart Component using SVG
 */
export const DonutChart = ({ data, totalLabel = 'TOTAL' }) => {
  const total = data.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
  
  // Calculate segments
  let accumulatedPercent = 0;
  const segments = data.map(item => {
    const val = Number(item.value) || 0;
    const percent = total > 0 ? (val / total) * 100 : 0;
    const startPercent = accumulatedPercent;
    accumulatedPercent += percent;
    return {
      ...item,
      value: val,
      percent,
      startPercent
    };
  });

  // SVG parameters
  const radius = 30;
  const circumference = 2 * Math.PI * radius; // ~188.495

  return (
    <div className="donut-chart-container">
      <div className="donut-chart-svg-wrapper">
        <svg viewBox="0 0 100 100" width="160" height="160" className="donut-chart-svg">
          {total === 0 ? (
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="transparent"
              stroke="#2d3748"
              strokeWidth="12"
            />
          ) : (
            <g transform="rotate(-90 50 50)">
              {segments.map((seg, i) => {
                const strokeDasharray = `${(seg.percent / 100) * circumference} ${circumference}`;
                const strokeDashoffset = `${-(seg.startPercent / 100) * circumference}`;
                return (
                  <circle
                    key={i}
                    cx="50"
                    cy="50"
                    r={radius}
                    fill="transparent"
                    stroke={seg.color}
                    strokeWidth="12"
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={strokeDashoffset}
                    className="donut-segment"
                  >
                    <title>{`${seg.label}: ₹${Math.round(seg.value).toLocaleString()} (${seg.percent.toFixed(1)}%)`}</title>
                  </circle>
                );
              })}
            </g>
          )}
          {/* Inner Text */}
          <circle cx="50" cy="50" r="22" fill="#151d30" />
          <text x="50" y="46" textAnchor="middle" fill="#94a3b8" fontSize="5.5" fontWeight="600" letterSpacing="0.5">
            {totalLabel}
          </text>
          <text x="50" y="58" textAnchor="middle" fill="#ffffff" fontSize="8.5" fontWeight="bold">
            {total >= 10000000 ? `₹${(total / 10000000).toFixed(2)}Cr` : (total >= 100000 ? `₹${(total / 100000).toFixed(1)}L` : `₹${(total / 1000).toFixed(0)}K`)}
          </text>
        </svg>
      </div>

      <div className="donut-legend">
        {segments.map((seg, i) => (
          <div className="legend-item" key={i} title={seg.subText || `${seg.label}: ₹${Math.round(seg.value).toLocaleString()}`}>
            <span className="legend-dot" style={{ backgroundColor: seg.color }}></span>
            <span className="legend-label">{seg.label}</span>
            <span className="legend-value">{seg.percent.toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Bar Chart Component for Monthly Trend & Scale Scenarios
 */
export const BarChart = ({ 
  data = [], 
  series1Key = 'revenue', 
  series2Key = 'expense', 
  series1Label = 'Revenue', 
  series2Label = 'Expenses',
  series1Color = '#10b981',
  series2Color = '#0F6E56',
  height = 140
}) => {
  if (!data || data.length === 0) return null;

  // Find max value to scale chart
  const maxVal = Math.max(...data.flatMap(d => [Number(d[series1Key]) || 0, Number(d[series2Key]) || 0]), 100000);

  return (
    <div className="bar-chart-container" style={{ height: `${height + 40}px` }}>
      <div className="bar-chart-grid" style={{ height: `${height}px` }}>
        <div className="grid-lines">
          <div className="grid-line"></div>
          <div className="grid-line"></div>
          <div className="grid-line"></div>
        </div>

        <div className="bar-groups">
          {data.map((d, i) => {
            const val1 = Number(d[series1Key]) || 0;
            const val2 = Number(d[series2Key]) || 0;
            const height1 = Math.max(4, (val1 / maxVal) * 100);
            const height2 = Math.max(4, (val2 / maxVal) * 100);

            return (
              <div className="bar-group" key={i}>
                <div className="bars">
                  {/* Series 1 Bar */}
                  <div className="bar-wrapper">
                    <div 
                      className="bar" 
                      style={{ height: `${height1}%`, backgroundColor: series1Color }}
                      title={`${series1Label}: ₹${val1.toLocaleString()}`}
                    ></div>
                  </div>
                  {/* Series 2 Bar */}
                  <div className="bar-wrapper">
                    <div 
                      className="bar" 
                      style={{ height: `${height2}%`, backgroundColor: series2Color }}
                      title={`${series2Label}: ₹${val2.toLocaleString()}`}
                    ></div>
                  </div>
                </div>
                <span className="bar-label">{d.label || d.period}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bar-chart-legend">
        <div className="legend-item" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className="legend-dot" style={{ backgroundColor: series1Color, width: '8px', height: '8px', borderRadius: '50%' }}></span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{series1Label}</span>
        </div>
        <div className="legend-item" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className="legend-dot" style={{ backgroundColor: series2Color, width: '8px', height: '8px', borderRadius: '50%' }}></span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{series2Label}</span>
        </div>
      </div>
    </div>
  );
};

/**
 * Progress Bar List for Top Expenses
 */
export const ProgressBarList = ({ data, onSelect = null, selectedLabel = null }) => {
  const total = data.reduce((sum, item) => sum + (Number(item.value) || 0), 0);

  return (
    <div className="progress-bar-list">
      {data.map((item, i) => {
        const percent = total > 0 ? (item.value / total) * 100 : 0;
        const isSelected = selectedLabel && selectedLabel === item.label;
        return (
          <div
            className={`progress-bar-item ${isSelected ? 'selected' : ''}`}
            key={i}
            onClick={() => onSelect && onSelect(item.label)}
            style={{ cursor: onSelect ? 'pointer' : 'default' }}
          >
            <div className="progress-bar-header">
              <span className="progress-item-label">{item.label}</span>
              <span className="progress-item-value">
                {formatLakhs(item.value)} <span className="percentage">({percent.toFixed(0)}%)</span>
              </span>
            </div>
            <div className="progress-bar-track">
              <div 
                className="progress-bar-fill" 
                style={{ width: `${percent}%`, backgroundColor: item.color }}
              ></div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

/**
 * Cash Flow Sparkline Component using SVG Path
 */
export const Sparkline = ({ points, width = 110, height = 28, positive = true }) => {
  if (!points || points.length < 2) return null;

  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min === 0 ? 1 : max - min;

  // Map values to coordinates
  const coords = points.map((val, i) => {
    const x = (i / (points.length - 1)) * (width - 8) + 4;
    // Invert y because SVG y goes top-to-bottom
    const y = height - ((val - min) / range) * (height - 8) - 4;
    return `${x},${y}`;
  });

  const pathD = `M ${coords.join(' L ')}`;
  const strokeColor = positive ? '#0F6E56' : '#A8402E';

  return (
    <svg width={width} height={height} className="sparkline-svg" style={{ overflow: 'visible' }}>
      <path d={pathD} fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {coords.length > 0 && (
        <circle
          cx={coords[coords.length - 1].split(',')[0]}
          cy={coords[coords.length - 1].split(',')[1]}
          r="3"
          fill={strokeColor}
        />
      )}
    </svg>
  );
};

/**
 * Trajectory Line Chart for Historical Baseline & Forward Projected Curve
 * Flat, minimal SVG matching Fintective's design tokens
 */
export const TrajectoryLineChart = ({ 
  historical = [], 
  projected = [], 
  confidence = 'high', 
  height = 140,
  isDeclining = false,
  projLabel = '5-Yr Compounded Path'
}) => {
  // Normalize historical points
  const histPoints = (historical || []).map(h => ({
    label: h.period || h.label || 'Base',
    value: Number(h.revenue || h.value || 0),
    type: 'actual'
  }));

  // Normalize projected points
  const projPoints = (projected || []).map(p => ({
    label: p.period_label || p.label || 'Proj',
    value: Number(p.projected_revenue || p.value || 0),
    type: 'projected'
  }));

  const allPoints = [...histPoints, ...projPoints];
  if (allPoints.length === 0) return null;

  const isLowConfidence = confidence === 'low';
  const projColor = isLowConfidence ? '#eab308' : (isDeclining ? '#C81E1E' : '#10b981');
  const projDash = isLowConfidence ? '3 3' : (isDeclining ? '4 4' : '4 4');

  const maxVal = Math.max(...allPoints.map(p => p.value), 100000) * 1.15;
  const range = maxVal;

  const width = 640;
  const chartHeight = 115;
  const paddingX = 42;
  const paddingY = 16;
  const plotWidth = width - paddingX * 2;
  const plotHeight = chartHeight - paddingY;

  // Calculate coordinates across all unified points
  const coords = allPoints.map((pt, i) => {
    const x = paddingX + (i / (allPoints.length - 1)) * plotWidth;
    const y = paddingY + plotHeight - (pt.value / range) * plotHeight;
    return { ...pt, x, y };
  });

  const histCoords = coords.slice(0, histPoints.length);
  const projCoords = histCoords.length > 0 
    ? [histCoords[histCoords.length - 1], ...coords.slice(histPoints.length)]
    : coords.slice(histPoints.length);

  const histPathD = histCoords.length > 0 ? `M ${histCoords.map(c => `${c.x},${c.y}`).join(' L ')}` : '';
  const projPathD = projCoords.length > 0 ? `M ${projCoords.map(c => `${c.x},${c.y}`).join(' L ')}` : '';

  return (
    <div style={{ width: '100%', background: 'var(--bg-main)', borderRadius: '10px', padding: '14px 16px', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '0.78rem', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: '700', color: 'var(--text-main)' }}>Historical Trajectory & 5-Year Forward Path</span>
          {isLowConfidence && (
            <span style={{ fontSize: '0.68rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(234, 179, 8, 0.15)', color: '#eab308', border: '1px solid rgba(234, 179, 8, 0.3)', fontWeight: '600' }}>
              ⚠️ Moderate History (3–6 mo)
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '12px', height: '3px', backgroundColor: '#0F6E56', display: 'inline-block', borderRadius: '2px' }}></span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem', fontWeight: '600' }}>Historical Baseline</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '12px', height: '3px', borderTop: `2px dashed ${projColor}`, display: 'inline-block' }}></span>
            <span style={{ color: isDeclining ? '#C81E1E' : 'var(--text-muted)', fontSize: '0.74rem', fontWeight: '600' }}>
              {isLowConfidence ? 'Preliminary Projection' : projLabel}
            </span>
          </div>
        </div>
      </div>

      <svg viewBox={`0 0 ${width} ${chartHeight + 24}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {/* Horizontal grid guide lines */}
        {[0, 0.5, 1].map((ratio, idx) => {
          const y = paddingY + plotHeight * (1 - ratio);
          const val = range * ratio;
          return (
            <g key={idx}>
              <line x1={paddingX - 4} y1={y} x2={width - paddingX + 4} y2={y} stroke="var(--border-color)" strokeDasharray="3 3" strokeWidth="1" />
              <text x={paddingX - 8} y={y + 3} textAnchor="end" fill="var(--text-muted)" fontSize="8" fontWeight="600">
                {val >= 10000000 ? `₹${(val / 10000000).toFixed(1)}Cr` : (val >= 100000 ? `₹${(val / 100000).toFixed(0)}L` : '₹0')}
              </text>
            </g>
          );
        })}

        {/* Flat Connecting Lines */}
        {histPathD && <path d={histPathD} fill="none" stroke="#0F6E56" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
        {projPathD && <path d={projPathD} fill="none" stroke={projColor} strokeWidth="2.5" strokeDasharray={projDash} strokeLinecap="round" strokeLinejoin="round" />}

        {/* Data Point Dots & Labels */}
        {coords.map((c, idx) => {
          const isProj = c.type === 'projected';
          return (
            <g key={idx}>
              <circle
                cx={c.x}
                cy={c.y}
                r={isProj ? 3.5 : 4}
                fill={isProj ? 'var(--bg-card)' : '#0F6E56'}
                stroke={isProj ? projColor : '#0F6E56'}
                strokeWidth={isProj ? 2 : 2.5}
              >
                <title>{`${c.label}: ₹${c.value.toLocaleString()}`}</title>
              </circle>
              {/* Value tag above node */}
              <text
                x={c.x}
                y={c.y - 6}
                textAnchor="middle"
                fill={isProj ? (isLowConfidence ? '#eab308' : '#0F6E56') : 'var(--text-main)'}
                fontSize="8"
                fontWeight="700"
              >
                {c.value >= 10000000 ? `₹${(c.value / 10000000).toFixed(2)}Cr` : `₹${(c.value / 100000).toFixed(1)}L`}
              </text>
              {/* X Axis Label */}
              <text
                x={c.x}
                y={chartHeight + 16}
                textAnchor="middle"
                fill={isProj ? (isLowConfidence ? '#eab308' : '#0F6E56') : 'var(--text-muted)'}
                fontSize="8"
                fontWeight={isProj ? '700' : '600'}
              >
                {c.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

/**
 * Cumulative FY Progression Chart
 * Features:
 * - Actual cumulative curve (solid line)
 * - Projected at current pace (dashed line)
 * - Target path / Company quota (grey line)
 * - Monthly bars at the bottom
 */
export const CumulativeTargetChart = ({
  monthlySeries = [],
  companyQuota = {},
  monthsElapsed = 7,
  projectedTotal = 0,
  measure = 'deals', // 'deals' or 'revenue'
  height = 200,
  savedGoal = null,
  previewTarget = null,
  previewLabel = ''
}) => {
  const isRev = measure === 'revenue';
  const months = monthlySeries.length > 0 ? monthlySeries : [
    { month_label: "Apr", invoiced: 0, invoiced_revenue: 0 },
    { month_label: "May", invoiced: 0, invoiced_revenue: 0 },
    { month_label: "Jun", invoiced: 0, invoiced_revenue: 0 },
    { month_label: "Jul", invoiced: 0, invoiced_revenue: 0 },
    { month_label: "Aug", invoiced: 0, invoiced_revenue: 0 },
    { month_label: "Sep", invoiced: 0, invoiced_revenue: 0 },
    { month_label: "Oct", invoiced: 0, invoiced_revenue: 0 },
    { month_label: "Nov", invoiced: 0, invoiced_revenue: 0 },
    { month_label: "Dec", invoiced: 0, invoiced_revenue: 0 },
    { month_label: "Jan", invoiced: 0, invoiced_revenue: 0 },
    { month_label: "Feb", invoiced: 0, invoiced_revenue: 0 },
    { month_label: "Mar", invoiced: 0, invoiced_revenue: 0 }
  ];

  const quotaVal = isRev ? Number(companyQuota?.quota_revenue || 0) : Number(companyQuota?.quota_deals || 0);

  // Extract saved goal value if present
  let savedGoalVal = 0;
  if (savedGoal) {
    if (typeof savedGoal === 'object') {
      savedGoalVal = isRev ? Number(savedGoal.target_revenue || 0) : Number(savedGoal.target_deals || savedGoal.target_placements || 0);
    } else {
      savedGoalVal = Number(savedGoal);
    }
  }

  const previewVal = previewTarget !== null && previewTarget !== undefined ? Number(previewTarget) : null;

  // Calculate monthly values & cumulative actuals
  let runningActual = 0;
  const monthData = months.map((m, idx) => {
    const val = isRev ? Number(m.invoiced_revenue || 0) : Number(m.invoiced || 0);
    const hasElapsed = idx < monthsElapsed;
    if (hasElapsed) {
      runningActual += val;
    }
    return {
      label: m.month_label ? m.month_label.split(' ')[0] : `M${idx + 1}`,
      monthlyVal: val,
      hasElapsed,
      cumActual: hasElapsed ? runningActual : null
    };
  });

  const lastActual = runningActual;
  const pacePerMonth = monthsElapsed > 0 ? lastActual / monthsElapsed : 0;
  const projectedEnd = projectedTotal > 0 ? projectedTotal : Math.round(lastActual + pacePerMonth * Math.max(0, 12 - monthsElapsed));

  // Build projected points from current elapsed month to month 12
  const projectedData = monthData.map((m, idx) => {
    if (idx < monthsElapsed - 1) return null;
    if (idx === monthsElapsed - 1) return lastActual;
    const remainingIdx = idx - (monthsElapsed - 1);
    return Math.round(lastActual + pacePerMonth * remainingIdx);
  });

  // Build scenario preview points from current elapsed month to month 12
  const previewData = previewVal ? monthData.map((m, idx) => {
    if (idx < monthsElapsed - 1) return null;
    if (idx === monthsElapsed - 1) return lastActual;
    const remainingMonths = Math.max(1, 12 - monthsElapsed);
    const step = (previewVal - lastActual) / remainingMonths;
    const remainingIdx = idx - (monthsElapsed - 1);
    return Math.round(lastActual + step * remainingIdx);
  }) : [];

  const maxVal = Math.max(quotaVal, projectedEnd, lastActual, savedGoalVal, previewVal || 0, 10) * 1.15;

  const width = 680;
  const paddingL = 50;
  const paddingR = 30;
  const paddingT = 20;
  const paddingB = 30;
  const plotW = width - paddingL - paddingR;
  const plotH = height - paddingT - paddingB;

  // Max monthly bar value for bar heights
  const maxMonthly = Math.max(...monthData.map(m => m.monthlyVal), 1);
  const barMaxH = plotH * 0.35; // Monthly bars take bottom 35%

  const getX = (idx) => paddingL + (idx / 11) * plotW;
  const getY = (val) => paddingT + plotH - (val / maxVal) * plotH;

  // Target line path: (0,0) to (11, quotaVal)
  const targetPath = quotaVal > 0 ? `M ${getX(0)},${getY(quotaVal / 12)} L ${getX(11)},${getY(quotaVal)}` : '';

  // Saved goal path
  const savedGoalPath = savedGoalVal > 0 ? `M ${getX(0)},${getY(savedGoalVal / 12)} L ${getX(11)},${getY(savedGoalVal)}` : '';

  // Actual line path
  const actualCoords = monthData
    .filter(m => m.hasElapsed)
    .map((m, idx) => `${getX(idx)},${getY(m.cumActual)}`);
  const actualPath = actualCoords.length > 0 ? `M ${actualCoords.join(' L ')}` : '';

  // Projected line path
  const projCoords = monthData
    .map((m, idx) => {
      const pVal = projectedData[idx];
      return pVal !== null ? `${getX(idx)},${getY(pVal)}` : null;
    })
    .filter(Boolean);
  const projPath = projCoords.length > 0 ? `M ${projCoords.join(' L ')}` : '';

  // Scenario preview path
  const previewCoords = previewVal ? monthData
    .map((m, idx) => {
      const pVal = previewData[idx];
      return pVal !== null ? `${getX(idx)},${getY(pVal)}` : null;
    })
    .filter(Boolean) : [];
  const previewPath = previewCoords.length > 0 ? `M ${previewCoords.join(' L ')}` : '';

  // 4 Y-ticks
  const yTicks = [0, maxVal * 0.33, maxVal * 0.66, maxVal];

  const formatVal = (v) => {
    if (isRev) {
      return v >= 10000000 ? `₹${(v / 10000000).toFixed(1)}Cr` : (v >= 100000 ? `₹${(v / 100000).toFixed(0)}L` : `₹${Math.round(v).toLocaleString()}`);
    }
    return Math.round(v).toString();
  };

  return (
    <div style={{ width: '100%', background: 'var(--bg-main)', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '16px' }}>
      {/* Legend & Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.84rem', fontWeight: '700', color: 'var(--text-main)' }}>
            Cumulative FY Trajectory vs Quota ({isRev ? 'Revenue' : 'Deals'})
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '0.74rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '14px', height: '3px', backgroundColor: '#0F6E56', display: 'inline-block', borderRadius: '2px' }} />
            <span style={{ color: 'var(--text-main)', fontWeight: '600' }}>Actual YTD ({formatVal(lastActual)})</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '14px', height: '3px', borderTop: '2px dashed #2563EB', display: 'inline-block' }} />
            <span style={{ color: 'var(--text-muted)' }}>Projected ({formatVal(projectedEnd)})</span>
          </div>
          {savedGoalVal > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '14px', height: '3px', borderTop: '2px dashed #0F6E56', display: 'inline-block' }} />
              <span style={{ color: '#0F6E56', fontWeight: '700' }}>Goal ({formatVal(savedGoalVal)})</span>
            </div>
          )}
          {previewVal > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '14px', height: '3px', borderTop: '2px dashed #7c3aed', display: 'inline-block' }} />
              <span style={{ color: '#7c3aed', fontWeight: '700' }}>{previewLabel || 'Scenario'} ({formatVal(previewVal)})</span>
            </div>
          )}
          {quotaVal > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '14px', height: '2px', backgroundColor: '#94a3b8', display: 'inline-block' }} />
              <span style={{ color: 'var(--text-muted)' }}>Quota ({formatVal(quotaVal)})</span>
            </div>
          )}
        </div>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {/* Horizontal grid lines & Y ticks */}
        {yTicks.map((tVal, i) => {
          const y = getY(tVal);
          return (
            <g key={i}>
              <line x1={paddingL} y1={y} x2={width - paddingR} y2={y} stroke="var(--border-color)" strokeWidth="1" strokeDasharray="3 3" opacity={0.6} />
              <text x={paddingL - 8} y={y + 4} textAnchor="end" fill="var(--text-muted)" fontSize="8.5" fontWeight="600">
                {formatVal(tVal)}
              </text>
            </g>
          );
        })}

        {/* Monthly background bars at bottom */}
        {monthData.map((m, idx) => {
          const x = getX(idx) - 8;
          const barH = (m.monthlyVal / maxMonthly) * barMaxH;
          const y = paddingT + plotH - barH;
          return (
            <g key={idx}>
              <rect
                x={x}
                y={y}
                width={16}
                height={barH}
                fill={m.hasElapsed ? 'rgba(15, 110, 86, 0.16)' : 'rgba(148, 163, 184, 0.08)'}
                rx={2}
              >
                <title>{`${m.label}: ${formatVal(m.monthlyVal)} (${m.hasElapsed ? 'closed' : 'upcoming'})`}</title>
              </rect>
              {/* X Axis Label */}
              <text x={getX(idx)} y={height - 10} textAnchor="middle" fill="var(--text-muted)" fontSize="8" fontWeight="600">
                {m.label}
              </text>
            </g>
          );
        })}

        {/* Target Path Line (Quota) */}
        {quotaVal > 0 && targetPath && (
          <path d={targetPath} fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4 4" />
        )}

        {/* Saved Goal Path Line */}
        {savedGoalVal > 0 && savedGoalPath && (
          <path d={savedGoalPath} fill="none" stroke="#0F6E56" strokeWidth="2.2" strokeDasharray="5 3" />
        )}

        {/* Scenario Preview Line */}
        {previewVal > 0 && previewPath && (
          <path d={previewPath} fill="none" stroke="#7c3aed" strokeWidth="2.4" strokeDasharray="4 3" strokeLinecap="round" />
        )}

        {/* Projected Pace Path */}
        {projPath && (
          <path d={projPath} fill="none" stroke="#2563EB" strokeWidth="2.2" strokeDasharray="4 4" strokeLinecap="round" />
        )}

        {/* Actual Cumulative Path */}
        {actualPath && (
          <path d={actualPath} fill="none" stroke="#0F6E56" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        )}

        {/* Actual Points */}
        {monthData.filter(m => m.hasElapsed).map((m, idx) => (
          <circle
            key={idx}
            cx={getX(idx)}
            cy={getY(m.cumActual)}
            r={idx === monthsElapsed - 1 ? 4.5 : 3}
            fill="#0F6E56"
            stroke="#FFFFFF"
            strokeWidth="1.5"
          >
            <title>{`${m.label} YTD: ${formatVal(m.cumActual)}`}</title>
          </circle>
        ))}

        {/* Final Projected Node */}
        {projectedData[11] !== null && (
          <circle
            cx={getX(11)}
            cy={getY(projectedData[11])}
            r={4}
            fill="#2563EB"
            stroke="#FFFFFF"
            strokeWidth="1.5"
          >
            <title>{`March FY Projected Total: ${formatVal(projectedData[11])}`}</title>
          </circle>
        )}

        {/* Scenario Preview Node */}
        {previewVal > 0 && previewData[11] !== null && (
          <circle
            cx={getX(11)}
            cy={getY(previewData[11])}
            r={5}
            fill="#7c3aed"
            stroke="#FFFFFF"
            strokeWidth="1.5"
          >
            <title>{`March FY Scenario Target: ${formatVal(previewVal)}`}</title>
          </circle>
        )}

        {/* Saved Goal Node */}
        {savedGoalVal > 0 && (
          <circle
            cx={getX(11)}
            cy={getY(savedGoalVal)}
            r={5}
            fill="#0F6E56"
            stroke="#FFFFFF"
            strokeWidth="1.5"
          >
            <title>{`Saved Goal: ${formatVal(savedGoalVal)}`}</title>
          </circle>
        )}
      </svg>
    </div>
  );
};


/**
 * Plan Ahead Trajectory Chart (2-line comparison: If unchanged vs With +X% goal)
 * Features:
 * - Completed FYs as solid points
 * - Current FY as a hollow point (YTD / Projected)
 * - Two forward lines (If unchanged vs With +X% goal)
 * - Y-axis starting strictly at 0 with 4-5 ticks
 * - Labels ONLY on the last point (Year +5); tooltips on hover for others
 */
export const PlanAheadTrajectoryChart = ({
  historicalSeries = [],
  projections = [],
  appliedRate = 0.15,
  historicalCagr = null,
  height = 220
}) => {
  // If fewer than 2 completed FYs exist, display clean message
  const completedFys = (historicalSeries || []).filter(h => h.is_complete && Number(h.revenue || 0) > 0);
  const currentFy = (historicalSeries || []).find(h => !h.is_complete && Number(h.revenue || 0) > 0);

  if (completedFys.length < 2) {
    return (
      <div style={{
        width: '100%',
        background: 'var(--bg-main)',
        borderRadius: '8px',
        border: '1px solid var(--border-color)',
        padding: '24px 20px',
        textAlign: 'center',
        color: 'var(--text-muted)'
      }}>
        <div style={{ fontSize: '1.2rem', marginBottom: '8px' }}>—</div>
        <div style={{ fontSize: '0.86rem', fontWeight: '600', color: 'var(--text-main)' }}>
          Not enough completed financial years
        </div>
        <p style={{ fontSize: '0.78rem', margin: '6px 0 0 0', color: 'var(--text-muted)' }}>
          At least 2 completed financial years are required to calculate a historical CAGR and reliable multi-year forward trajectory. Projections are never extrapolated from a partial year.
        </p>
      </div>
    );
  }

  const baseRev = completedFys[completedFys.length - 1].revenue;
  const passiveRate = (historicalCagr !== null && historicalCagr > 0) ? historicalCagr : 0.0;
  const goalRate = appliedRate || 0.15;

  // Build unified points list:
  // 1. Completed FYs
  // 2. Current FY (hollow point)
  // 3. 5 forward projected points for both lines
  const histPoints = completedFys.map(c => ({
    label: c.period,
    val: c.revenue,
    type: 'completed'
  }));

  const currentPoint = currentFy ? {
    label: `${currentFy.period} (YTD)`,
    val: currentFy.revenue,
    projVal: currentFy.run_rate_projection || currentFy.revenue,
    type: 'current'
  } : null;

  // 5 future years (Year +1 to +5)
  const forwardPoints = [];
  for (let t = 1; t <= 5; t++) {
    const passiveVal = Math.round(baseRev * Math.pow(1.0 + passiveRate, t));
    const goalVal = Math.round(baseRev * Math.pow(1.0 + goalRate, t));
    forwardPoints.push({
      label: `Yr +${t}`,
      yearIdx: t,
      passiveVal,
      goalVal
    });
  }

  const allVals = [
    ...completedFys.map(c => c.revenue),
    currentPoint ? currentPoint.projVal : 0,
    ...forwardPoints.map(f => f.goalVal),
    ...forwardPoints.map(f => f.passiveVal)
  ];
  const maxVal = Math.max(...allVals, 100000) * 1.15;

  const width = 680;
  const paddingL = 50;
  const paddingR = 40;
  const paddingT = 24;
  const paddingB = 32;
  const plotW = width - paddingL - paddingR;
  const plotH = height - paddingT - paddingB;

  const totalCols = histPoints.length + (currentPoint ? 1 : 0) + forwardPoints.length;
  const getX = (colIdx) => paddingL + (colIdx / (totalCols - 1)) * plotW;
  const getY = (val) => paddingT + plotH - (val / maxVal) * plotH;

  // 4 Y-ticks starting strictly at 0
  const yTicks = [0, maxVal * 0.25, maxVal * 0.50, maxVal * 0.75, maxVal];

  const formatRev = (v) => {
    return v >= 10000000 ? `₹${(v / 10000000).toFixed(2)}Cr` : (v >= 100000 ? `₹${(v / 100000).toFixed(1)}L` : `₹${Math.round(v).toLocaleString()}`);
  };

  // Historical path coordinates
  const histCoords = histPoints.map((p, idx) => ({ x: getX(idx), y: getY(p.val) }));
  const histPath = `M ${histCoords.map(c => `${c.x},${c.y}`).join(' L ')}`;

  // Starting anchor for forward lines is the last completed point
  const anchorX = histCoords[histCoords.length - 1].x;
  const anchorY = histCoords[histCoords.length - 1].y;

  const baseColOffset = histPoints.length + (currentPoint ? 1 : 0);

  const passiveCoords = [
    { x: anchorX, y: anchorY },
    ...forwardPoints.map((f, i) => ({ x: getX(baseColOffset + i), y: getY(f.passiveVal) }))
  ];
  const passivePath = `M ${passiveCoords.map(c => `${c.x},${c.y}`).join(' L ')}`;

  const goalCoords = [
    { x: anchorX, y: anchorY },
    ...forwardPoints.map((f, i) => ({ x: getX(baseColOffset + i), y: getY(f.goalVal) }))
  ];
  const goalPath = `M ${goalCoords.map(c => `${c.x},${c.y}`).join(' L ')}`;

  const lastPassive = forwardPoints[4]?.passiveVal || 0;
  const lastGoal = forwardPoints[4]?.goalVal || 0;
  const lastGoalX = getX(totalCols - 1);

  return (
    <div style={{ width: '100%', background: 'var(--bg-main)', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '16px' }}>
      {/* Header & Legend */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.84rem', fontWeight: '700', color: 'var(--text-main)' }}>
            Forward Horizon: Baseline vs +{Math.round(goalRate * 100)}% Goal Path
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '0.74rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '14px', height: '3px', backgroundColor: '#0F6E56', display: 'inline-block', borderRadius: '2px' }} />
            <span style={{ color: 'var(--text-main)', fontWeight: '600' }}>Completed FYs</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', border: '2px solid #2563EB', backgroundColor: '#FFFFFF', display: 'inline-block' }} />
            <span style={{ color: 'var(--text-muted)' }}>Current FY (Hollow)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '14px', height: '3px', backgroundColor: '#94a3b8', display: 'inline-block', borderRadius: '2px' }} />
            <span style={{ color: 'var(--text-muted)' }}>If unchanged</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '14px', height: '3px', backgroundColor: '#10B981', display: 'inline-block', borderRadius: '2px' }} />
            <span style={{ color: '#0F6E56', fontWeight: '700' }}>With +{Math.round(goalRate * 100)}% goal</span>
          </div>
        </div>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {/* Horizontal grid lines & Y ticks from 0 */}
        {yTicks.map((tVal, i) => {
          const y = getY(tVal);
          return (
            <g key={i}>
              <line x1={paddingL} y1={y} x2={width - paddingR} y2={y} stroke="var(--border-color)" strokeWidth="1" strokeDasharray="3 3" opacity={0.6} />
              <text x={paddingL - 8} y={y + 3.5} textAnchor="end" fill="var(--text-muted)" fontSize="8.5" fontWeight="600">
                {formatRev(tVal)}
              </text>
            </g>
          );
        })}

        {/* Lines */}
        <path d={histPath} fill="none" stroke="#0F6E56" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d={passivePath} fill="none" stroke="#94a3b8" strokeWidth="2" strokeDasharray="3 3" strokeLinecap="round" />
        <path d={goalPath} fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Completed FY solid points */}
        {histPoints.map((p, idx) => (
          <g key={idx}>
            <circle cx={getX(idx)} cy={getY(p.val)} r={4.5} fill="#0F6E56" stroke="#FFFFFF" strokeWidth="1.5">
              <title>{`${p.label}: ${formatRev(p.val)}`}</title>
            </circle>
            <text x={getX(idx)} y={height - 10} textAnchor="middle" fill="var(--text-muted)" fontSize="8" fontWeight="600">
              {p.label}
            </text>
          </g>
        ))}

        {/* Current FY hollow point */}
        {currentPoint && (
          <g>
            <circle
              cx={getX(histPoints.length)}
              cy={getY(currentPoint.val)}
              r={5}
              fill="#FFFFFF"
              stroke="#2563EB"
              strokeWidth="2.5"
            >
              <title>{`${currentPoint.label}: ${formatRev(currentPoint.val)} (Run-rate: ${formatRev(currentPoint.projVal)})`}</title>
            </circle>
            <text x={getX(histPoints.length)} y={height - 10} textAnchor="middle" fill="#2563EB" fontSize="8" fontWeight="700">
              {currentPoint.label.split(' ')[0]}*
            </text>
          </g>
        )}

        {/* Forward Projected Points (Year +1 to +5) */}
        {forwardPoints.map((f, i) => {
          const colIdx = baseColOffset + i;
          const isLast = i === 4;
          return (
            <g key={i}>
              {/* Passive point */}
              <circle cx={getX(colIdx)} cy={getY(f.passiveVal)} r={isLast ? 4 : 3} fill="#94a3b8">
                <title>{`Year +${f.yearIdx} (If unchanged): ${formatRev(f.passiveVal)}`}</title>
              </circle>
              {/* Goal point */}
              <circle cx={getX(colIdx)} cy={getY(f.goalVal)} r={isLast ? 5 : 3.5} fill="#10B981" stroke="#FFFFFF" strokeWidth="1.5">
                <title>{`Year +${f.yearIdx} (With +${Math.round(goalRate * 100)}%): ${formatRev(f.goalVal)}`}</title>
              </circle>
              {/* X label */}
              <text x={getX(colIdx)} y={height - 10} textAnchor="middle" fill="var(--text-muted)" fontSize="8" fontWeight="600">
                {f.label}
              </text>
            </g>
          );
        })}

        {/* Labels ONLY on the last point (Year +5) */}
        <text
          x={lastGoalX + 8}
          y={getY(lastGoal) + 3}
          textAnchor="start"
          fill="#0F6E56"
          fontSize="8.5"
          fontWeight="700"
        >
          {formatRev(lastGoal)}
        </text>
        <text
          x={lastGoalX + 8}
          y={getY(lastPassive) + 3}
          textAnchor="start"
          fill="#64748b"
          fontSize="8"
          fontWeight="600"
        >
          {formatRev(lastPassive)}
        </text>
      </svg>
    </div>
  );
};

/**
 * Cash Flow Waterfall Chart Component
 * Sequence: Gross Revenue → Company Share → Operating Expenses → Payroll → Net Profit
 */
export const WaterfallChart = ({
  grossRevenue = 0,
  companyShare = 0,
  operatingExpenses = 0,
  payroll = 0,
  netProfit = 0,
  periodLabel = '',
  onConfigurePayroll = null,
  height = 210
}) => {
  const formatVal = (v) => {
    const num = Math.abs(Number(v) || 0);
    if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
    if (num >= 100000) return `₹${(num / 100000).toFixed(1)} L`;
    if (num >= 1000) return `₹${(num / 1000).toFixed(0)} K`;
    return `₹${num.toFixed(0)}`;
  };

  const isPayrollMissing = !payroll || Number(payroll) <= 0;

  // Scale calculations
  const maxVal = Math.max(grossRevenue, companyShare, 100000) * 1.15;
  const width = 560;
  const padL = 40;
  const padR = 24;
  const padT = 24;
  const padB = 40;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const baselineY = padT + plotH;

  const barWidth = 48;
  const colCount = 5;
  const colSpacing = plotW / colCount;

  // Calculate coordinates for 5 columns
  // Col 0: Gross Revenue (from 0 up to grossRevenue)
  const x0 = padL + colSpacing * 0 + (colSpacing - barWidth) / 2;
  const h0 = Math.max(4, (grossRevenue / maxVal) * plotH);
  const y0 = baselineY - h0;

  // Col 1: Company Share (starts at 0 up to companyShare)
  const x1 = padL + colSpacing * 1 + (colSpacing - barWidth) / 2;
  const h1 = Math.max(4, (companyShare / maxVal) * plotH);
  const y1 = baselineY - h1;

  // Col 2: Operating Expenses (steps down from companyShare)
  const x2 = padL + colSpacing * 2 + (colSpacing - barWidth) / 2;
  const h2 = Math.max(4, (operatingExpenses / maxVal) * plotH);
  const y2 = y1; // top of operating expenses sits at top of company share
  const y2_bottom = y2 + h2; // steps down

  // Col 3: Payroll CTC (steps down from operating expenses bottom)
  const x3 = padL + colSpacing * 3 + (colSpacing - barWidth) / 2;
  const h3 = isPayrollMissing ? 20 : Math.max(4, (payroll / maxVal) * plotH);
  const y3 = y2_bottom;
  const y3_bottom = isPayrollMissing ? y3 : y3 + h3;

  // Col 4: Corporate Net Profit (from baseline to netProfit)
  const x4 = padL + colSpacing * 4 + (colSpacing - barWidth) / 2;
  const isNetPos = netProfit >= 0;
  const h4 = Math.max(4, (Math.abs(netProfit) / maxVal) * plotH);
  const y4 = isNetPos ? baselineY - h4 : baselineY;

  return (
    <div className="waterfall-container">
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}>
        {/* Baseline */}
        <line x1={padL - 10} y1={baselineY} x2={width - padR + 10} y2={baselineY} stroke="#cbd5e1" strokeWidth="1.5" />

        {/* Step Connectors */}
        {/* Connector 0 -> 1: Franchisee deduction dashed line */}
        <line x1={x0 + barWidth} y1={y0} x2={x1} y2={y0} stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 3" />
        <line x1={x1} y1={y0} x2={x1} y2={y1} stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 3" />

        {/* Connector 1 -> 2: Across to Operating Expenses */}
        <line x1={x1 + barWidth} y1={y1} x2={x2} y2={y1} stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 3" />

        {/* Connector 2 -> 3: From bottom of Opex to top of Payroll */}
        <line x1={x2 + barWidth} y1={y2_bottom} x2={x3} y2={y3} stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 3" />

        {/* Connector 3 -> 4: From bottom of Payroll across to Net Profit */}
        <line x1={x3 + barWidth} y1={y3_bottom} x2={x4} y2={isNetPos ? y4 : baselineY} stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 3" />

        {/* Bar 0: Gross Revenue */}
        <rect x={x0} y={y0} width={barWidth} height={h0} fill="#2563eb" rx={4}>
          <title>{`Gross Revenue: ${formatVal(grossRevenue)} (Total Placements & Bill Rate)`}</title>
        </rect>
        <text x={x0 + barWidth / 2} y={Math.max(12, y0 - 6)} textAnchor="middle" fill="#1e293b" fontSize="9.5" fontWeight="700">
          {formatVal(grossRevenue)}
        </text>
        <text x={x0 + barWidth / 2} y={baselineY + 16} textAnchor="middle" fill="#475569" fontSize="8.5" fontWeight="600">
          Gross Rev
        </text>
        <text x={x0 + barWidth / 2} y={baselineY + 28} textAnchor="middle" fill="#64748b" fontSize="7.5">
          100% Billing
        </text>

        {/* Bar 1: Company Share */}
        <rect x={x1} y={y1} width={barWidth} height={h1} fill="#0f6e56" rx={4}>
          <title>{`Company Retained Share: ${formatVal(companyShare)} (Net 25% pool)`}</title>
        </rect>
        <text x={x1 + barWidth / 2} y={Math.max(12, y1 - 6)} textAnchor="middle" fill="#0f6e56" fontSize="9.5" fontWeight="700">
          {formatVal(companyShare)}
        </text>
        <text x={x1 + barWidth / 2} y={baselineY + 16} textAnchor="middle" fill="#475569" fontSize="8.5" fontWeight="600">
          Co. Share
        </text>
        <text x={x1 + barWidth / 2} y={baselineY + 28} textAnchor="middle" fill="#0f766e" fontSize="7.5" fontWeight="600">
          ~25% Pool
        </text>

        {/* Bar 2: Operating Expenses */}
        <rect x={x2} y={y2} width={barWidth} height={h2} fill="#a8402e" rx={4}>
          <title>{`Operating Expenses & Comm: -${formatVal(operatingExpenses)}`}</title>
        </rect>
        <text x={x2 + barWidth / 2} y={Math.max(12, y2 - 6)} textAnchor="middle" fill="#a8402e" fontSize="9.5" fontWeight="700">
          -{formatVal(operatingExpenses)}
        </text>
        <text x={x2 + barWidth / 2} y={baselineY + 16} textAnchor="middle" fill="#475569" fontSize="8.5" fontWeight="600">
          Opex & Comm
        </text>
        <text x={x2 + barWidth / 2} y={baselineY + 28} textAnchor="middle" fill="#64748b" fontSize="7.5">
          Office/Tools
        </text>

        {/* Bar 3: Payroll CTC */}
        {isPayrollMissing ? (
          <g style={{ cursor: onConfigurePayroll ? 'pointer' : 'default' }} onClick={() => onConfigurePayroll && onConfigurePayroll()}>
            <rect x={x3} y={y3} width={barWidth} height={20} fill="#f1f5f9" stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 3" rx={4} />
            <text x={x3 + barWidth / 2} y={y3 + 13} textAnchor="middle" fill="#64748b" fontSize="7" fontWeight="600">
              Not configured
            </text>
            <text x={x3 + barWidth / 2} y={baselineY + 16} textAnchor="middle" fill="#64748b" fontSize="8.5" fontWeight="600">
              Payroll
            </text>
            <text x={x3 + barWidth / 2} y={baselineY + 28} textAnchor="middle" fill="#2563eb" fontSize="7.5" fontWeight="600">
              [Set Budget]
            </text>
          </g>
        ) : (
          <g>
            <rect x={x3} y={y3} width={barWidth} height={h3} fill="#7c3aed" rx={4}>
              <title>{`Corporate Payroll CTC: -${formatVal(payroll)}`}</title>
            </rect>
            <text x={x3 + barWidth / 2} y={Math.max(12, y3 - 6)} textAnchor="middle" fill="#7c3aed" fontSize="9.5" fontWeight="700">
              -{formatVal(payroll)}
            </text>
            <text x={x3 + barWidth / 2} y={baselineY + 16} textAnchor="middle" fill="#475569" fontSize="8.5" fontWeight="600">
              Payroll
            </text>
            <text x={x3 + barWidth / 2} y={baselineY + 28} textAnchor="middle" fill="#64748b" fontSize="7.5">
              CTC Salaries
            </text>
          </g>
        )}

        {/* Bar 4: Net Corporate Profit */}
        <rect x={x4} y={y4} width={barWidth} height={h4} fill={isNetPos ? '#10b981' : '#ef4444'} rx={4}>
          <title>{`Corporate Net Profit: ${isNetPos ? '' : '-'}${formatVal(netProfit)}`}</title>
        </rect>
        <text x={x4 + barWidth / 2} y={isNetPos ? Math.max(12, y4 - 6) : y4 + h4 + 12} textAnchor="middle" fill={isNetPos ? '#059669' : '#dc2626'} fontSize="9.5" fontWeight="800">
          {isNetPos ? '+' : '-'}{formatVal(netProfit)}
        </text>
        <text x={x4 + barWidth / 2} y={baselineY + 16} textAnchor="middle" fill="#0f172a" fontSize="8.5" fontWeight="700">
          Net Profit
        </text>
        <text x={x4 + barWidth / 2} y={baselineY + 28} textAnchor="middle" fill={isNetPos ? '#059669' : '#dc2626'} fontSize="7.5" fontWeight="700">
          Bottom Line
        </text>
      </svg>
    </div>
  );
};

/**
 * Monthly Trend Bar Chart Component
 * Revenue vs Expenses across the 12 months of the Financial Year
 */
export const MonthlyTrendBarChart = ({
  monthlyData = [],
  periodLabel = 'FY 2026-2027',
  height = 200
}) => {
  if (!monthlyData || monthlyData.length === 0) return null;

  const maxVal = Math.max(
    ...monthlyData.flatMap(m => [Number(m.revenue || 0), Number(m.expenses || 0)]),
    50000
  ) * 1.15;

  const width = 640;
  const padL = 48;
  const padR = 20;
  const padT = 24;
  const padB = 32;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const baselineY = padT + plotH;

  const colWidth = plotW / monthlyData.length;
  const barW = Math.max(6, Math.min(14, colWidth * 0.35));

  const formatTick = (val) => {
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)}Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(0)}L`;
    if (val >= 1000) return `₹${(val / 1000).toFixed(0)}K`;
    return `₹${val}`;
  };

  const ticks = [0, maxVal * 0.33, maxVal * 0.66, maxVal];

  return (
    <div style={{ width: '100%', position: 'relative' }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {/* Horizontal grid lines */}
        {ticks.map((t, idx) => {
          const y = baselineY - (t / maxVal) * plotH;
          return (
            <g key={idx}>
              <line x1={padL} y1={y} x2={width - padR} y2={y} stroke="#e2e8f0" strokeWidth="1" strokeDasharray={idx === 0 ? 'none' : '3 3'} />
              <text x={padL - 8} y={y + 3.5} textAnchor="end" fill="#94a3b8" fontSize="8" fontWeight="600">
                {formatTick(t)}
              </text>
            </g>
          );
        })}

        {/* Monthly Bar Groups */}
        {monthlyData.map((m, i) => {
          const groupX = padL + i * colWidth;
          const rev = Number(m.revenue || 0);
          const exp = Number(m.expenses || 0);
          const revH = Math.max(2, (rev / maxVal) * plotH);
          const expH = Math.max(2, (exp / maxVal) * plotH);
          const revY = baselineY - revH;
          const expY = baselineY - expH;
          const centerX = groupX + colWidth / 2;

          return (
            <g key={i}>
              {/* Highlight background for active/hover column */}
              <rect x={groupX + 2} y={padT} width={colWidth - 4} height={plotH} fill="transparent" opacity={0}>
                <title>{`${m.label || m.month}: Revenue ₹${rev.toLocaleString()} | Expenses ₹${exp.toLocaleString()} | Net ₹${(rev - exp).toLocaleString()}`}</title>
              </rect>

              {/* Revenue Bar */}
              <rect
                x={centerX - barW - 1}
                y={revY}
                width={barW}
                height={revH}
                fill={m.hasElapsed ? '#0f6e56' : 'rgba(15, 110, 86, 0.35)'}
                rx={2}
              >
                <title>{`${m.label || m.month} Revenue: ₹${rev.toLocaleString()}`}</title>
              </rect>

              {/* Expense Bar */}
              <rect
                x={centerX + 1}
                y={expY}
                width={barW}
                height={expH}
                fill={m.hasElapsed ? '#a8402e' : 'rgba(168, 64, 46, 0.35)'}
                rx={2}
              >
                <title>{`${m.label || m.month} Expenses: ₹${exp.toLocaleString()}`}</title>
              </rect>

              {/* Month label */}
              <text
                x={centerX}
                y={baselineY + 16}
                textAnchor="middle"
                fill={m.hasElapsed ? '#334155' : '#94a3b8'}
                fontSize="8.5"
                fontWeight={m.hasElapsed ? '600' : '400'}
              >
                {m.month}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};


