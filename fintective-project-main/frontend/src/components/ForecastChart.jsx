import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { fetchWithApiKey } from '../utils/apiClient';
import { formatLakhs, formatCurrency } from '../utils/formatters';
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  ShieldCheck,
  Zap,
  HelpCircle,
  ChevronRight,
  Activity,
  Layers,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import './ForecastChart.css';

export const ForecastChart = ({ apiBaseUrl = '/api' }) => {
  const [horizon, setHorizon] = useState(6);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [forecastData, setForecastData] = useState(null);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [activeMetricView, setActiveMetricView] = useState('all'); // 'all', 'revenue', 'expenses', 'cash'

  const fetchForecast = useCallback(async (h) => {
    setLoading(true);
    setError(null);
    try {
      const cleanBase = apiBaseUrl.replace(/\/+$/, '');
      const url = `${cleanBase}/finance/forecast?horizon=${h}`;
      const res = await fetchWithApiKey(url);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || `HTTP Error ${res.status}`);
      }
      if (data.status === 'ok') {
        setForecastData(data);
      } else {
        throw new Error(data.message || 'Failed to load forecast data');
      }
    } catch (err) {
      console.error('Forecast fetch failed:', err);
      setError(err.message || 'Unable to connect to forecasting engine');
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    fetchForecast(horizon);
  }, [horizon, fetchForecast]);

  // Combine recent history (last 12 months) + forecast points for the chart
  const chartPoints = useMemo(() => {
    if (!forecastData) return [];

    // Take last 12 historical months for clean seasonal context
    const hist = (forecastData.historical || []).slice(-12).map((pt, i) => ({
      month: pt.month,
      isForecast: false,
      rev: pt.revenue,
      revLower: pt.revenue,
      revUpper: pt.revenue,
      exp: pt.expenses,
      expLower: pt.expenses,
      expUpper: pt.expenses,
      payroll: pt.payroll || 0,
      net: pt.net,
      cash: null
    }));

    // Append forecast points
    const fc = (forecastData.forecast || []).map((pt, i) => ({
      month: pt.month,
      isForecast: true,
      rev: pt.revenue.predicted,
      revLower: pt.revenue.lower,
      revUpper: pt.revenue.upper,
      exp: pt.operating_expenses.predicted,
      expLower: pt.operating_expenses.lower,
      expUpper: pt.operating_expenses.upper,
      payroll: pt.scheduled_payroll,
      totalOutflow: pt.total_projected_outflow,
      net: pt.net_projected,
      netLower: pt.net_lower,
      netUpper: pt.net_upper,
      cash: pt.cumulative_cash
    }));

    return [...hist, ...fc];
  }, [forecastData]);

  // SVG Coordinate Math
  const svgWidth = 840;
  const svgHeight = 320;
  const paddingLeft = 65;
  const paddingRight = 40;
  const paddingTop = 30;
  const paddingBottom = 45;

  const maxVal = useMemo(() => {
    if (chartPoints.length === 0) return 10000000;
    const values = chartPoints.flatMap(p => [
      p.revUpper || p.rev || 0,
      p.expUpper || p.exp || 0
    ]);
    return Math.max(...values, 1000000) * 1.12;
  }, [chartPoints]);

  const getX = useCallback((idx) => {
    if (chartPoints.length <= 1) return paddingLeft;
    const plotWidth = svgWidth - paddingLeft - paddingRight;
    return paddingLeft + (idx / (chartPoints.length - 1)) * plotWidth;
  }, [chartPoints.length]);

  const getY = useCallback((val) => {
    const plotHeight = svgHeight - paddingTop - paddingBottom;
    const clamped = Math.max(0, val || 0);
    return svgHeight - paddingBottom - (clamped / maxVal) * plotHeight;
  }, [maxVal]);

  // Split historical vs forecast indexes
  const splitIndex = useMemo(() => {
    return chartPoints.findIndex(p => p.isForecast);
  }, [chartPoints]);

  // Build SVG Paths
  const paths = useMemo(() => {
    if (chartPoints.length === 0 || splitIndex === -1) return {};

    // 1. Historical Lines
    const histPoints = chartPoints.slice(0, splitIndex + 1);
    const histRevPath = histPoints.map((p, i) => `${getX(i)},${getY(p.rev)}`).join(' L ');
    const histExpPath = histPoints.map((p, i) => `${getX(i)},${getY(p.exp)}`).join(' L ');

    // 2. Forecast Lines
    const fcPoints = chartPoints.slice(splitIndex - 1);
    const fcRevPath = fcPoints.map((p, i) => `${getX(splitIndex - 1 + i)},${getY(p.rev)}`).join(' L ');
    const fcExpPath = fcPoints.map((p, i) => `${getX(splitIndex - 1 + i)},${getY(p.exp)}`).join(' L ');

    // 3. Shaded Confidence Bands (Area paths for forecast)
    const upperRevPoints = [];
    const lowerRevPoints = [];
    const upperExpPoints = [];
    const lowerExpPoints = [];

    chartPoints.forEach((p, idx) => {
      if (idx >= splitIndex) {
        const x = getX(idx);
        upperRevPoints.push(`${x},${getY(p.revUpper)}`);
        lowerRevPoints.unshift(`${x},${getY(p.revLower)}`);
        upperExpPoints.push(`${x},${getY(p.expUpper)}`);
        lowerExpPoints.unshift(`${x},${getY(p.expLower)}`);
      }
    });

    const revBandArea = upperRevPoints.length > 0
      ? `M ${upperRevPoints.join(' L ')} L ${lowerRevPoints.join(' L ')} Z`
      : '';
    const expBandArea = upperExpPoints.length > 0
      ? `M ${upperExpPoints.join(' L ')} L ${lowerExpPoints.join(' L ')} Z`
      : '';

    return {
      histRevPath,
      histExpPath,
      fcRevPath,
      fcExpPath,
      revBandArea,
      expBandArea
    };
  }, [chartPoints, splitIndex, getX, getY]);

  if (loading && !forecastData) {
    return (
      <div className="forecast-card forecast-loading">
        <Activity className="forecast-spinner" size={32} />
        <p>Comparing forecasting models against historical data...</p>
      </div>
    );
  }

  if (error && !forecastData) {
    return (
      <div className="forecast-card forecast-error">
        <p>⚠️ {error}</p>
        <button onClick={() => fetchForecast(horizon)} className="forecast-retry-btn">
          Retry Modeling
        </button>
      </div>
    );
  }

  const models = forecastData?.models || {};
  const summary = forecastData?.summary || {};

  return (
    <div className="forecast-card">
      {error && <p role="alert">Refresh failed: {error}. Previously loaded forecast remains displayed.</p>}
      {/* Header with Title and Horizon Filter */}
      <div className="forecast-header">
        <div>
          <div className="forecast-badge-row">
            <span className="forecast-tag-pill">
              <Zap size={13} style={{ marginRight: '4px' }} />
              Predictive Seasonality Engine
            </span>
            <span className="forecast-tag-sub">
              Baseline Cutoff: <strong>{forecastData?.as_of_month}</strong> (Closed Months Only)
            </span>
          </div>
          <h3 className="forecast-title">Company Income & Runway Forecast</h3>
          <p className="forecast-subtitle">
            Backtested income and expense models with scheduled payroll integration
          </p>
        </div>

        {/* Horizon Selector */}
        <div className="forecast-horizon-controls">
          <span className="forecast-horizon-label">Forecast Horizon:</span>
          {[3, 6, 9, 12].map(h => (
            <button
              key={h}
              className={`forecast-horizon-btn ${horizon === h ? 'active' : ''}`}
              onClick={() => setHorizon(h)}
            >
              {h}M
            </button>
          ))}
        </div>
      </div>

      <p className="forecast-subtitle">{forecastData?.cash_assumption} {forecastData?.interval_method}</p>
      {/* Model Diagnostics Banner */}
      <div className="forecast-diagnostics-grid">
        <div className="diag-card rev-diag">
          <div className="diag-header">
            <span className="diag-title">Company Income Model</span>
            <span className="diag-badge">{models.revenue?.selected_model}</span>
          </div>
          <div className="diag-metrics">
            <div>
              <span className="diag-lbl">Backtest MAPE:</span>
              <strong className="diag-val">{models.revenue?.backtest_mape == null ? 'Unavailable' : `${models.revenue.backtest_mape}%`}</strong>
            </div>
            <div>
              <span className="diag-lbl">Training Window:</span>
              <span className="diag-subval">{models.revenue?.training_window} ({models.revenue?.training_months}m)</span>
            </div>
          </div>
        </div>

        <div className="diag-card exp-diag">
          <div className="diag-header">
            <span className="diag-title">Operating Expense Model</span>
            <span className="diag-badge">{models.expenses?.selected_model}</span>
          </div>
          <div className="diag-metrics">
            <div>
              <span className="diag-lbl">Backtest MAPE:</span>
              <strong className="diag-val">{models.expenses?.backtest_mape == null ? 'Unavailable' : `${models.expenses.backtest_mape}%`}</strong>
            </div>
            {models.expenses?.backtest_mae != null && (
              <div>
                <span className="diag-lbl">Mean Monthly Error:</span>
                <span className="diag-subval">{formatCurrency(models.expenses.backtest_mae)}</span>
              </div>
            )}
            {models.expenses?.backtest_wape != null && (
              <div>
                <span className="diag-lbl">Total Absolute Error / Actual Expenses:</span>
                <span className="diag-subval">{models.expenses.backtest_wape}%</span>
              </div>
            )}
            {models.expenses?.backtest_months > 0 && (
              <div>
                <span className="diag-lbl">Model Selection Window:</span>
                <span className="diag-subval">Last {models.expenses.backtest_months} closed months; selected by error in rupees. Future accuracy may differ.</span>
              </div>
            )}
            <div>
              <span className="diag-lbl">Training Window:</span>
              <span className="diag-subval">{models.expenses?.training_window} ({models.expenses?.training_months}m)</span>
            </div>
          </div>
        </div>

        <div className="diag-card runway-diag">
          <div className="diag-header">
            <span className="diag-title">Projected Runway</span>
            <span className="diag-badge runway-status-badge">
              {summary.runway_status}
            </span>
          </div>
          <div className="diag-metrics">
            <div>
              <span className="diag-lbl">{horizon}M Net Projection:</span>
              <strong className="diag-val" style={{ color: (summary.projected_total_net || 0) >= 0 ? '#10b981' : '#ef4444' }}>
                {formatLakhs(summary.projected_total_net)}
              </strong>
            </div>
            <div>
              <span className="diag-lbl">Final Cash:</span>
              <span className="diag-subval">{formatLakhs(summary.projected_final_cash)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Legend & Metric Filter */}
      <div className="forecast-legend-bar">
        <div className="legend-items-group">
          <div className="legend-item">
            <span className="legend-swatch" style={{ background: '#10b981' }} />
            <span>Company Income (Historical)</span>
          </div>
          <div className="legend-item">
            <span className="legend-swatch-dashed" style={{ borderColor: '#10b981' }} />
            <span>Company Income (Projected ± Band)</span>
          </div>
          <div className="legend-item">
            <span className="legend-swatch" style={{ background: '#ef4444' }} />
            <span>Opex (Historical)</span>
          </div>
          <div className="legend-item">
            <span className="legend-swatch-dashed" style={{ borderColor: '#ef4444' }} />
            <span>Opex (Projected ± Band)</span>
          </div>
          <div className="legend-item">
            <span className="legend-swatch" style={{ background: '#8b5cf6' }} />
            <span>Scheduled Payroll</span>
          </div>
        </div>
      </div>

      {/* Main SVG Visualization */}
      <div className="forecast-chart-wrapper">
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="forecast-svg">
          <defs>
            {/* Shaded Confidence Band Gradients */}
            <linearGradient id="revBandGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.04" />
            </linearGradient>
            <linearGradient id="expBandGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.03" />
            </linearGradient>
          </defs>

          {/* Grid Lines */}
          <line x1={paddingLeft} y1={paddingTop} x2={svgWidth - paddingRight} y2={paddingTop} stroke="rgba(0,0,0,0.05)" strokeDasharray="3" />
          <line x1={paddingLeft} y1={getY(maxVal * 0.5)} x2={svgWidth - paddingRight} y2={getY(maxVal * 0.5)} stroke="rgba(0,0,0,0.05)" strokeDasharray="3" />
          <line x1={paddingLeft} y1={svgHeight - paddingBottom} x2={svgWidth - paddingRight} y2={svgHeight - paddingBottom} stroke="var(--border-color, #e5e7eb)" strokeWidth="1.5" />

          {/* Y Axis Ticks */}
          <text x={paddingLeft - 10} y={paddingTop + 4} textAnchor="end" className="axis-text">
            {formatLakhs(maxVal)}
          </text>
          <text x={paddingLeft - 10} y={getY(maxVal * 0.5) + 4} textAnchor="end" className="axis-text">
            {formatLakhs(maxVal * 0.5)}
          </text>
          <text x={paddingLeft - 10} y={svgHeight - paddingBottom + 4} textAnchor="end" className="axis-text">
            ₹0
          </text>

          {/* Vertical Transition Barrier between History and Forecast */}
          {splitIndex !== -1 && (
            <g>
              <line
                x1={getX(splitIndex)}
                y1={paddingTop}
                x2={getX(splitIndex)}
                y2={svgHeight - paddingBottom}
                stroke="#6366f1"
                strokeWidth="1.5"
                strokeDasharray="4,4"
              />
              <rect
                x={getX(splitIndex)}
                y={paddingTop}
                width={svgWidth - paddingRight - getX(splitIndex)}
                height={svgHeight - paddingTop - paddingBottom}
                fill="rgba(99, 102, 241, 0.025)"
              />
              <text
                x={getX(splitIndex) + 8}
                y={paddingTop + 14}
                fill="#6366f1"
                fontSize="10"
                fontWeight="bold"
              >
                PROJECTION WINDOW ({horizon}M)
              </text>
            </g>
          )}

          {/* Shaded Prediction Confidence Bands */}
          {paths.revBandArea && (
            <path d={paths.revBandArea} fill="url(#revBandGrad)" />
          )}
          {paths.expBandArea && (
            <path d={paths.expBandArea} fill="url(#expBandGrad)" />
          )}

          {/* Solid Historical Curves */}
          {paths.histRevPath && (
            <path d={`M ${paths.histRevPath}`} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" />
          )}
          {paths.histExpPath && (
            <path d={`M ${paths.histExpPath}`} fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" />
          )}

          {/* Dashed Forecast Curves */}
          {paths.fcRevPath && (
            <path d={`M ${paths.fcRevPath}`} fill="none" stroke="#10b981" strokeWidth="2.5" strokeDasharray="5,5" strokeLinecap="round" />
          )}
          {paths.fcExpPath && (
            <path d={`M ${paths.fcExpPath}`} fill="none" stroke="#ef4444" strokeWidth="2.5" strokeDasharray="5,5" strokeLinecap="round" />
          )}

          {/* Data Points and Hover Target Zones */}
          {chartPoints.map((pt, idx) => {
            const x = getX(idx);
            const yRev = getY(pt.rev);
            const yExp = getY(pt.exp);
            const isHovered = hoveredIndex === idx;

            return (
              <g
                key={pt.month}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
                style={{ cursor: 'pointer' }}
              >
                {/* Transparent Hover Hitbox */}
                <rect
                  x={x - 14}
                  y={paddingTop}
                  width="28"
                  height={svgHeight - paddingTop - paddingBottom}
                  fill="transparent"
                />

                {/* Vertical hover guide */}
                {isHovered && (
                  <line
                    x1={x}
                    y1={paddingTop}
                    x2={x}
                    y2={svgHeight - paddingBottom}
                    stroke="rgba(0,0,0,0.18)"
                    strokeWidth="1"
                    strokeDasharray="2,2"
                  />
                )}

                {/* Dots */}
                <circle
                  cx={x}
                  cy={yRev}
                  r={isHovered ? 5.5 : (pt.isForecast ? 3.5 : 3)}
                  fill="#ffffff"
                  stroke="#10b981"
                  strokeWidth={pt.isForecast ? 2 : 2.5}
                />
                <circle
                  cx={x}
                  cy={yExp}
                  r={isHovered ? 5.5 : (pt.isForecast ? 3.5 : 3)}
                  fill="#ffffff"
                  stroke="#ef4444"
                  strokeWidth={pt.isForecast ? 2 : 2.5}
                />

                {/* X Axis Month Label */}
                <text
                  x={x}
                  y={svgHeight - paddingBottom + 18}
                  textAnchor="middle"
                  className={`axis-text ${isHovered ? 'axis-active' : ''}`}
                  fontWeight={pt.isForecast ? 'bold' : 'normal'}
                  fill={pt.isForecast ? '#6366f1' : 'var(--text-muted, #64748b)'}
                >
                  {pt.month.slice(2)}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Dynamic Tooltip */}
        {hoveredIndex !== null && chartPoints[hoveredIndex] && (
          <div
            className="forecast-tooltip"
            style={{
              left: `${(getX(hoveredIndex) / svgWidth) * 100}%`,
              transform: hoveredIndex > chartPoints.length - 4 ? 'translateX(-100%)' : 'translateX(10%)'
            }}
          >
            <div className="tooltip-header">
              <strong>{chartPoints[hoveredIndex].month}</strong>
              <span className={`tooltip-tag ${chartPoints[hoveredIndex].isForecast ? 'tag-proj' : 'tag-hist'}`}>
                {chartPoints[hoveredIndex].isForecast ? 'Model Forecast' : 'Historical'}
              </span>
            </div>

            <div className="tooltip-row">
              <span className="tooltip-bullet rev-bullet" />
              <span>Company Income:</span>
              <strong>{formatLakhs(chartPoints[hoveredIndex].rev)}</strong>
            </div>

            {chartPoints[hoveredIndex].isForecast && (
              <div className="tooltip-subrow">
                <span>Approximate Residual:</span>
                <span>{formatLakhs(chartPoints[hoveredIndex].revLower)} – {formatLakhs(chartPoints[hoveredIndex].revUpper)}</span>
              </div>
            )}

            <div className="tooltip-row">
              <span className="tooltip-bullet exp-bullet" />
              <span>Opex:</span>
              <strong>{formatLakhs(chartPoints[hoveredIndex].exp)}</strong>
            </div>

            {chartPoints[hoveredIndex].isForecast && (
              <>
                <div className="tooltip-row">
                  <span className="tooltip-bullet pay-bullet" />
                  <span>Scheduled Payroll:</span>
                  <strong>{formatLakhs(chartPoints[hoveredIndex].payroll)}</strong>
                </div>
                <div className="tooltip-row net-row">
                  <span>Projected Net:</span>
                  <strong style={{ color: chartPoints[hoveredIndex].net >= 0 ? '#10b981' : '#ef4444' }}>
                    {formatLakhs(chartPoints[hoveredIndex].net)}
                  </strong>
                </div>
                <div className="tooltip-row cash-row">
                  <span>Cumulative Cash:</span>
                  <strong>{formatLakhs(chartPoints[hoveredIndex].cash)}</strong>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Projection Horizon Table */}
      <div className="forecast-table-container">
        <h4 className="table-heading">Projected Month-by-Month Statement ({forecastData?.forecast?.[0]?.month} – {forecastData?.forecast?.at(-1)?.month})</h4>
        <div className="table-responsive">
          <table className="forecast-table">
            <thead>
              <tr>
                <th>Month</th>
                <th>Projected Company Income (ex-GST)</th>
                <th>Approximate Income Band</th>
                <th>Operating Expenses</th>
                <th>Expected Collections</th>
                <th>Scheduled / Estimated Payroll</th>
                <th>Total Outflow</th>
                <th>Net Monthly Inflow/Burn</th>
                <th>Cumulative Cash Balance</th>
              </tr>
            </thead>
            <tbody>
              {(forecastData?.forecast || []).map((row, idx) => (
                <tr key={row.month}>
                  <td>
                    <strong>{row.month}</strong>
                    <span className="forecast-step-badge">+{idx + 1}M</span>
                  </td>
                  <td className="rev-cell">{formatCurrency(row.revenue.predicted)}</td>
                  <td className="band-cell">
                    <span className="band-range">{formatLakhs(row.revenue.lower)} – {formatLakhs(row.revenue.upper)}</span>
                  </td>
                  <td className="exp-cell">{formatCurrency(row.operating_expenses.predicted)}</td>
                  <td>{formatCurrency(row.expected_collections)}</td>
                  <td className="pay-cell">{formatCurrency(row.scheduled_payroll)}</td>
                  <td className="outflow-cell">{formatCurrency(row.total_projected_outflow)}</td>
                  <td className={`net-cell ${row.net_projected >= 0 ? 'net-pos' : 'net-neg'}`}>
                    {row.net_projected >= 0 ? '+' : ''}{formatCurrency(row.net_projected)}
                  </td>
                  <td className="cash-cell">
                    <strong>{formatCurrency(row.cumulative_cash)}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ForecastChart;
