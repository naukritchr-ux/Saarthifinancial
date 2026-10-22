import React from 'react';
import { formatCurrency, formatLakhs } from '../../../utils/formatters';
import { ArrowUpRight, ArrowDownRight, Layers, Calendar, Clock, AlertCircle } from 'lucide-react';

const CATEGORY_COLORS = [
  '#0d9488', // Teal
  '#3b82f6', // Blue
  '#8b5cf6', // Violet
  '#f59e0b', // Amber
  '#ec4899'  // Pink
];

export default function LedgerSummary({
  summary,
  timingFilter = 'all',
  onSetTiming
}) {
  const {
    inflow = 0,
    outflow = 0,
    net = 0,
    totalCount = 0,
    actualCount = 0,
    projectedCount = 0,
    hasProjected = false,
    topCategories = []
  } = summary;

  return (
    <div className="rep-summary-container animate-fade-in">
      {/* 4 Summary Metric Cards */}
      <div className="rep-kpi-grid">
        {/* Inflow Card */}
        <div className="rep-kpi-card">
          <div className="rep-kpi-header">
            <span className="rep-kpi-label">Filtered Inflows</span>
            <span className="rep-kpi-icon rep-icon-inflow">
              <ArrowUpRight size={16} />
            </span>
          </div>
          <div className="rep-kpi-val text-teal">
            {formatCurrency(inflow)}
          </div>
          <div className="rep-kpi-sub">
            Realized & billed revenue
          </div>
        </div>

        {/* Outflow Card */}
        <div className="rep-kpi-card">
          <div className="rep-kpi-header">
            <span className="rep-kpi-label">Filtered Outflows</span>
            <span className="rep-kpi-icon rep-icon-outflow">
              <ArrowDownRight size={16} />
            </span>
          </div>
          <div className="rep-kpi-val text-red">
            {formatCurrency(outflow, true)}
          </div>
          <div className="rep-kpi-sub">
            Operating expenses & payroll
          </div>
        </div>

        {/* Net Card */}
        <div className="rep-kpi-card">
          <div className="rep-kpi-header">
            <span className="rep-kpi-label">Net Filtered Cash</span>
            <span className={`rep-kpi-icon ${net >= 0 ? 'rep-icon-net-pos' : 'rep-icon-net-neg'}`}>
              <Layers size={16} />
            </span>
          </div>
          <div className={`rep-kpi-val ${net >= 0 ? 'text-teal' : 'text-red'}`}>
            {formatCurrency(net)}
          </div>
          <div className="rep-kpi-sub">
            {net >= 0 ? 'Net Surplus Margin' : 'Net Operating Deficit'}
          </div>
        </div>

        {/* Record Count & Timing Card */}
        <div className="rep-kpi-card">
          <div className="rep-kpi-header">
            <span className="rep-kpi-label">Matching Entries</span>
            <span className="rep-kpi-icon rep-icon-neutral">
              <Calendar size={16} />
            </span>
          </div>
          <div className="rep-kpi-val">
            {totalCount.toLocaleString()} <span className="rep-kpi-unit">records</span>
          </div>
          <div className="rep-kpi-sub rep-kpi-timing-breakdown">
            <span>{actualCount.toLocaleString()} actual</span>
            {projectedCount > 0 && (
              <span className="rep-timing-proj-pill" title="Future-dated records included">
                +{projectedCount.toLocaleString()} projected
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Projected Notice Banner */}
      {hasProjected && timingFilter === 'all' && (
        <div className="rep-notice-strip no-print">
          <div className="rep-notice-content">
            <Clock size={15} className="rep-notice-icon" />
            <span>
              This view includes <strong>{projectedCount.toLocaleString()} future-dated projected entries</strong> (e.g. forward payroll / scheduled disbursements).
            </span>
          </div>
          {onSetTiming && (
            <button
              type="button"
              className="rep-notice-btn"
              onClick={() => onSetTiming('actual')}
            >
              Show Actuals Only
            </button>
          )}
        </div>
      )}

      {/* Top 5 Categories Breakdown */}
      {topCategories.length > 0 && (
        <div className="rep-top-categories-card">
          <div className="rep-top-cat-header">
            <span className="rep-top-cat-title">Top Expense & Inflow Drivers (Current Filter)</span>
            <span className="rep-top-cat-sub">Ranked by overall volume</span>
          </div>

          {/* Stacked Progress Bar */}
          <div className="rep-stacked-bar">
            {topCategories.map((cat, i) => (
              <div
                key={cat.name}
                className="rep-bar-segment"
                style={{
                  width: `${Math.max(2, cat.pct)}%`,
                  backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length]
                }}
                title={`${cat.name}: ${formatCurrency(cat.amount)} (${cat.pct.toFixed(1)}%)`}
              />
            ))}
          </div>

          {/* Category Chips with Values */}
          <div className="rep-top-cat-chips">
            {topCategories.map((cat, i) => (
              <div key={cat.name} className="rep-cat-chip">
                <span
                  className="rep-cat-dot"
                  style={{ backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}
                />
                <span className="rep-cat-name">{cat.name}:</span>
                <span className="rep-cat-amt">{formatLakhs(cat.amount)}</span>
                <span className="rep-cat-pct">({cat.pct.toFixed(0)}%)</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
