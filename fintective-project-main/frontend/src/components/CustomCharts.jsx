import React from 'react';

/**
 * Donut Chart Component using SVG
 */
export const DonutChart = ({ data }) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  
  // Calculate segments
  let accumulatedPercent = 0;
  const segments = data.map(item => {
    const percent = total > 0 ? (item.value / total) * 100 : 0;
    const startPercent = accumulatedPercent;
    accumulatedPercent += percent;
    return {
      ...item,
      percent,
      startPercent
    };
  });

  // SVG parameters
  const radius = 30;
  const circumference = 2 * Math.PI * radius;

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
            segments.map((seg, i) => {
              const strokeDasharray = `${(seg.percent / 100) * circumference} ${circumference}`;
              const strokeDashoffset = `${circumference - (seg.startPercent / 100) * circumference + (circumference / 4)}`; // Rotate by 90deg so starts at top
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
                  strokeLinecap="round"
                  className="donut-segment"
                >
                  <title>{`${seg.label}: ${seg.percent.toFixed(1)}%`}</title>
                </circle>
              );
            })
          )}
          {/* Inner Text */}
          <circle cx="50" cy="50" r="22" fill="#151d30" />
          <text x="50" y="47" textAnchor="middle" fill="#94a3b8" fontSize="6" fontWeight="bold">
            TOTAL
          </text>
          <text x="50" y="58" textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="bold">
            {total >= 100000 ? `₹${(total / 100000).toFixed(1)}L` : `₹${(total / 1000).toFixed(0)}K`}
          </text>
        </svg>
      </div>

      <div className="donut-legend">
        {segments.map((seg, i) => (
          <div className="legend-item" key={i}>
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
export const ProgressBarList = ({ data }) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="progress-bar-list">
      {data.map((item, i) => {
        const percent = total > 0 ? (item.value / total) * 100 : 0;
        return (
          <div className="progress-bar-item" key={i}>
            <div className="progress-bar-header">
              <span className="progress-item-label">{item.label}</span>
              <span className="progress-item-value">
                ₹{(item.value / 1000).toFixed(0)}K <span className="percentage">({percent.toFixed(0)}%)</span>
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
 * Target vs Actual Mini Bar Comparison Component
 */
export const TargetVsActualBar = ({ targetPct = 0, actualPct = 0, width = 140 }) => {
  const maxPct = Math.max(targetPct, Math.abs(actualPct), 20) * 1.15;
  const targetWidth = Math.min(100, Math.max(6, (targetPct / maxPct) * 100));
  const actualWidth = Math.min(100, Math.max(6, (Math.abs(actualPct) / maxPct) * 100));
  const isOver = actualPct >= targetPct;

  return (
    <div style={{ width: `${width}px`, display: 'flex', flexDirection: 'column', gap: '3px' }}>
      {/* Target Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem' }}>
        <span style={{ width: '22px', color: 'var(--text-muted)', fontSize: '0.65rem', fontWeight: '600' }}>Tgt:</span>
        <div style={{ flex: 1, height: '6px', backgroundColor: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ width: `${targetWidth}%`, height: '100%', backgroundColor: 'var(--accent-teal)', borderRadius: '3px' }}></div>
        </div>
        <span style={{ width: '32px', textAlign: 'right', fontWeight: '600', color: 'var(--text-main)', fontSize: '0.68rem' }}>+{targetPct.toFixed(0)}%</span>
      </div>

      {/* Actual Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem' }}>
        <span style={{ width: '22px', color: 'var(--text-muted)', fontSize: '0.65rem', fontWeight: '600' }}>Act:</span>
        <div style={{ flex: 1, height: '6px', backgroundColor: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ width: `${actualWidth}%`, height: '100%', backgroundColor: isOver ? '#0F6E56' : '#A8402E', borderRadius: '3px' }}></div>
        </div>
        <span style={{ width: '32px', textAlign: 'right', fontWeight: '700', color: isOver ? '#0F6E56' : '#A8402E', fontSize: '0.68rem' }}>
          {actualPct >= 0 ? '+' : ''}{actualPct.toFixed(0)}%
        </span>
      </div>
    </div>
  );
};

