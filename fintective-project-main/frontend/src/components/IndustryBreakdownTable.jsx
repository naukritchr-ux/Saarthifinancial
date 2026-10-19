import React, { useMemo } from 'react';
import { useFilters } from '../context/FilterContext';
import { formatCurrency, formatLakhs } from '../utils/formatters';
import { getTransactionShares } from '../config/financeConfig';
import { classifyEnquiryStatus } from '../utils/statusMapping';
import { Briefcase, ChevronRight, Filter } from 'lucide-react';
import InfoTip from './InfoTip';

/**
 * Shared Industry Breakdown Table
 * Single source of truth for Industry & Sector breakdown.
 * Replaces fragmented Industry sub-tabs across Franchisees and BD Performance.
 * Clicking any industry row immediately applies it to the active FilterBar.
 */
export default function IndustryBreakdownTable({ transactions: propTxs, onIndustryClick }) {
  const { filteredTransactions, filters, setFilterKey } = useFilters();

  const dataToUse = propTxs || filteredTransactions;

  // Aggregate industry stats from transactions
  const industryStats = useMemo(() => {
    const map = new Map();

    dataToUse.forEach(t => {
      const ind = (t.industry || 'Other Services').trim();
      if (!map.has(ind)) {
        map.set(ind, {
          name: ind,
          dealCount: 0,
          gross: 0,
          ourShare: 0,
          closedCount: 0,
          cancelledCount: 0
        });
      }

      const acc = map.get(ind);
      const shares = getTransactionShares(t);
      acc.dealCount += 1;
      acc.gross += shares.gross;
      acc.ourShare += shares.rShare;

      const stage = classifyEnquiryStatus(t.status || t.info);
      if (stage === 'INVOICED') acc.closedCount += 1;
      else if (stage === 'CANCELLED') acc.cancelledCount += 1;
    });

    const list = Array.from(map.values()).map(item => {
      const totalResolved = item.closedCount + item.cancelledCount;
      const winRate = totalResolved > 0 ? Math.round((item.closedCount / totalResolved) * 100) : null;
      const avgDeal = item.closedCount > 0 ? Math.round(item.gross / item.closedCount) : 0;
      return {
        ...item,
        winRate,
        avgDeal
      };
    });

    // Sort by gross revenue descending
    return list.sort((a, b) => b.gross - a.gross);
  }, [dataToUse]);

  const handleRowClick = (indName) => {
    if (onIndustryClick) {
      onIndustryClick(indName);
      return;
    }
    // Set active filter
    const isCurrentlySelected = filters.industry?.includes(indName);
    setFilterKey('industry', isCurrentlySelected ? [] : [indName]);
  };

  const totalGross = industryStats.reduce((s, i) => s + i.gross, 0);

  return (
    <div style={{
      background: 'var(--card-bg, #ffffff)',
      border: '1px solid var(--border-color, #e3e5e0)',
      borderRadius: '10px',
      overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
    }}>
      <div style={{
        padding: '14px 18px',
        borderBottom: '1px solid var(--border-color, #e3e5e0)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Briefcase size={16} color="#0f6e56" />
          <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-main, #1b2321)', margin: 0 }}>
            Industry & Sector Breakdown
          </h3>
          <InfoTip text="Click any sector row to filter all dashboard views to that industry." size={13} />
        </div>
        <span style={{ fontSize: '12px', color: 'var(--text-muted, #6b7268)' }}>
          {industryStats.length} sectors active · Click row to filter
        </span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'var(--bg-main, #f6f7f4)', borderBottom: '1px solid var(--border-color, #e3e5e0)' }}>
              <th style={{ padding: '9px 16px', color: 'var(--text-muted, #6b7268)', fontWeight: 600 }}>Industry Sector</th>
              <th style={{ padding: '9px 12px', color: 'var(--text-muted, #6b7268)', fontWeight: 600, textAlign: 'center' }}>Total Placements</th>
              <th style={{ padding: '9px 12px', color: 'var(--text-muted, #6b7268)', fontWeight: 600, textAlign: 'right' }}>Total Invoiced</th>
              <th style={{ padding: '9px 12px', color: 'var(--text-muted, #6b7268)', fontWeight: 600, textAlign: 'right' }}>Company Share</th>
              <th style={{ padding: '9px 12px', color: 'var(--text-muted, #6b7268)', fontWeight: 600, textAlign: 'right' }}>Avg Per Deal</th>
              <th style={{ padding: '9px 12px', color: 'var(--text-muted, #6b7268)', fontWeight: 600, textAlign: 'center' }}>Win Rate</th>
              <th style={{ padding: '9px 16px', color: 'var(--text-muted, #6b7268)', fontWeight: 600, textAlign: 'center' }}>Share of Total</th>
            </tr>
          </thead>
          <tbody>
            {industryStats.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted, #6b7268)' }}>
                  No industry data available for the selected filters.
                </td>
              </tr>
            ) : (
              industryStats.map((ind, idx) => {
                const isSelected = filters.industry?.includes(ind.name);
                const shareOfTotal = totalGross > 0 ? ((ind.gross / totalGross) * 100).toFixed(1) : 0;
                return (
                  <tr
                    key={ind.name}
                    onClick={() => handleRowClick(ind.name)}
                    style={{
                      borderBottom: '1px solid var(--border-color, #e3e5e0)',
                      cursor: 'pointer',
                      background: isSelected ? 'rgba(15, 110, 86, 0.08)' : (idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.01)'),
                      transition: 'background 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'rgba(15, 110, 86, 0.04)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.01)';
                    }}
                  >
                    <td style={{ padding: '10px 16px', fontWeight: 600, color: isSelected ? '#0f6e56' : 'var(--text-main, #1b2321)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {isSelected && <Filter size={12} color="#0f6e56" />}
                        <span>{ind.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--text-main, #1b2321)' }}>
                      {ind.closedCount} closed <span style={{ color: 'var(--text-muted, #6b7268)', fontSize: '11px' }}>({ind.dealCount} total)</span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--text-main, #1b2321)' }}>
                      {formatLakhs(ind.gross)}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#0f6e56' }}>
                      {formatLakhs(ind.ourShare)}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-main, #1b2321)' }}>
                      {ind.avgDeal > 0 ? formatCurrency(ind.avgDeal) : '—'}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <span style={{
                        color: ind.winRate !== null && ind.winRate >= 70 ? '#0f6e56' : ind.winRate !== null ? '#b7791f' : 'var(--text-muted, #6b7268)',
                        fontWeight: 600
                      }}>
                        {ind.winRate !== null ? `${ind.winRate}%` : 'N/A'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        <div style={{ width: '48px', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(100, shareOfTotal)}%`, height: '100%', background: '#0f6e56' }} />
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted, #6b7268)' }}>{shareOfTotal}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
