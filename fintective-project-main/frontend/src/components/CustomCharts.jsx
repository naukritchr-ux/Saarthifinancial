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
 * Bar Chart Component for Monthly Trend
 */
export const BarChart = ({ data }) => {
  // Find max value to scale chart
  const maxVal = Math.max(...data.flatMap(d => [d.revenue, d.expense]), 100000);

  return (
    <div className="bar-chart-container">
      <div className="bar-chart-y-axis">
        <span>{`₹${(maxVal / 100000).toFixed(1)}L`}</span>
        <span>{`₹${((maxVal / 2) / 100000).toFixed(1)}L`}</span>
        <span>₹0</span>
      </div>
      
      <div className="bar-chart-grid">
        <div className="grid-lines">
          <div className="grid-line"></div>
          <div className="grid-line"></div>
          <div className="grid-line"></div>
        </div>

        <div className="bar-groups">
          {data.map((d, i) => {
            const revHeight = (d.revenue / maxVal) * 100;
            const expHeight = (d.expense / maxVal) * 100;

            return (
              <div className="bar-group" key={i}>
                <div className="bars">
                  {/* Revenue Bar */}
                  <div className="bar-wrapper">
                    <div 
                      className="bar revenue-bar" 
                      style={{ height: `${revHeight}%` }}
                      title={`Revenue: ₹${d.revenue.toLocaleString()}`}
                    ></div>
                  </div>
                  {/* Expense Bar */}
                  <div className="bar-wrapper">
                    <div 
                      className="bar expense-bar" 
                      style={{ height: `${expHeight}%` }}
                      title={`Expense: ₹${d.expense.toLocaleString()}`}
                    ></div>
                  </div>
                </div>
                <span className="bar-label">{d.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bar-chart-legend">
        <div className="legend-item">
          <span className="legend-dot revenue-dot"></span>
          <span>Revenue</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot expense-dot"></span>
          <span>Expenses</span>
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
export const Sparkline = ({ points, width = 200, height = 40, positive = true }) => {
  if (!points || points.length < 2) return null;

  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min === 0 ? 1 : max - min;

  // Map values to coordinates
  const coords = points.map((val, i) => {
    const x = (i / (points.length - 1)) * width;
    // Invert y because SVG y goes top-to-bottom
    const y = height - ((val - min) / range) * (height - 8) - 4;
    return `${x},${y}`;
  });

  const pathD = `M ${coords.join(' L ')}`;
  const strokeColor = positive ? '#10b981' : '#ef4444';
  
  // Create gradient area path
  const areaD = `${pathD} L ${width},${height} L 0,${height} Z`;
  const gradientId = `gradient-${positive ? 'pos' : 'neg'}`;

  return (
    <svg width={width} height={height} className="sparkline-svg">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.25" />
          <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      
      <path d={areaD} fill={`url(#${gradientId})`} />
      <path d={pathD} fill="none" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};
