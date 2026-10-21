import React, { useState, useMemo } from 'react';
import { 
  X, 
  Download, 
  User, 
  Briefcase, 
  Building2, 
  Calendar, 
  DollarSign, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  ChevronRight, 
  ShieldAlert,
  Phone,
  Mail,
  Award,
  Filter
} from 'lucide-react';
import { formatCurrency, formatLakhs, formatDate } from '../utils/formatters';
import { getTransactionShares } from '../config/financeConfig';
import { classifyEnquiryStatus, classifyPaymentState } from '../utils/statusMapping';
import InfoTip from './InfoTip';

/**
 * Shared Drill-down Audit Panel
 * Standard modal / slide-over replacing fragmented individual audit panels.
 * Provides 4+4 KPI cards, inner filter chips, transaction drill-down, contract info, and CSV export.
 */
export default function AuditPanel({
  isOpen,
  onClose,
  title = 'Entity Financial Audit',
  subtitle = '',
  entityType = 'bd', // 'bd' | 'tl' | 'franchise' | 'industry' | 'city' | 'deal'
  contactDetails = null,
  transactions = [],
  periodLabel = 'FY 2026-27'
}) {
  const [filterPayment, setFilterPayment] = useState('all'); // 'all' | 'Received' | 'Outstanding' | 'Credit note'
  const [filterStage, setFilterStage] = useState('all'); // 'all' | 'Progressed' | 'Closed' | 'Cancelled'
  const [showContactDetails, setShowContactDetails] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Calculate 4 + 4 KPIs
  const metrics = useMemo(() => {
    let gross = 0;
    let ourShare = 0;
    let partnerShare = 0;
    let received = 0;
    let outstanding = 0;
    let cancelled = 0;
    let closedCount = 0;
    let cancelledCount = 0;

    transactions.forEach(t => {
      const shares = getTransactionShares(t);
      gross += shares.gross;
      ourShare += shares.rShare;
      partnerShare += shares.franchiseeShare;

      const payState = classifyPaymentState(t);
      if (payState === 'RECEIVED') received += shares.gross;
      else if (payState === 'OUTSTANDING') outstanding += shares.gross;

      const stage = classifyEnquiryStatus(t.status || t.info);
      if (stage === 'INVOICED') closedCount += 1;
      else if (stage === 'CANCELLED') {
        cancelledCount += 1;
        cancelled += shares.gross;
      }
    });

    const totalResolved = closedCount + cancelledCount;
    const winRate = totalResolved > 0 ? Math.round((closedCount / totalResolved) * 100) : null;

    return {
      gross,
      ourShare,
      partnerShare,
      received,
      outstanding,
      cancelled,
      closedCount,
      winRate
    };
  }, [transactions]);

  // Filter underlying transaction table rows
  const filteredRows = useMemo(() => {
    return transactions.filter(t => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches = 
          (t.companyName && t.companyName.toLowerCase().includes(q)) ||
          (t.candidateName && t.candidateName.toLowerCase().includes(q)) ||
          (t.referenceId && String(t.referenceId).toLowerCase().includes(q)) ||
          (t.billNumber && String(t.billNumber).toLowerCase().includes(q));
        if (!matches) return false;
      }

      // Payment state filter
      if (filterPayment !== 'all') {
        const pay = classifyPaymentState(t);
        if (filterPayment === 'Received' && pay !== 'RECEIVED') return false;
        if (filterPayment === 'Outstanding' && pay !== 'OUTSTANDING') return false;
        if (filterPayment === 'Credit note' && pay !== 'CREDIT_NOTE') return false;
      }

      // Deal stage filter
      if (filterStage !== 'all') {
        const stage = classifyEnquiryStatus(t.status || t.info);
        if (filterStage === 'Closed' && stage !== 'INVOICED') return false;
        if (filterStage === 'Progressed' && stage !== 'PROGRESSED') return false;
        if (filterStage === 'Cancelled' && stage !== 'CANCELLED') return false;
      }

      return true;
    });
  }, [transactions, searchQuery, filterPayment, filterStage]);

  if (!isOpen) return null;

  // Export CSV
  const handleExportCsv = () => {
    const metaHeader = `# Audit Drill-Down: ${title} · Period: ${periodLabel} · Generated: ${new Date().toLocaleDateString('en-IN')}\n`;
    const headers = ['Date', 'Bill No / Ref', 'Client Company', 'Candidate / Position', 'Stage', 'Payment State', 'Gross Amount', 'Our Share'];
    const rows = filteredRows.map(t => {
      const shares = getTransactionShares(t);
      return [
        `"${t.date || ''}"`,
        `"${t.referenceId || t.billNumber || ''}"`,
        `"${(t.companyName || '').replace(/"/g, '""')}"`,
        `"${(t.candidateName || t.positionName || t.role || '').replace(/"/g, '""')}"`,
        `"${classifyEnquiryStatus(t.status || t.info)}"`,
        `"${classifyPaymentState(t)}"`,
        shares.gross,
        shares.rShare
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(metaHeader + headers.join(',') + '\n' + rows.map(r => r.join(',')).join('\n'));
    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    link.setAttribute('download', `audit-${title.toLowerCase().replace(/[^a-z0-9]/g, '-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(4px)',
      zIndex: 9999,
      display: 'flex',
      justifyContent: 'flex-end',
      animation: 'fadeIn 0.2s ease-out'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '850px',
        height: '100%',
        background: 'var(--card-bg, #1e293b)',
        borderLeft: '1px solid var(--border-color, #334155)',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-10px 0 30px rgba(0, 0, 0, 0.5)'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color, #334155)',
          background: 'var(--bg-input, #0f172a)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-main, #f8fafc)', margin: 0 }}>
                {title}
              </h2>
              <span style={{
                background: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                borderRadius: '4px',
                padding: '2px 6px',
                fontSize: '11px',
                fontWeight: 500,
                textTransform: 'uppercase'
              }}>
                {entityType}
              </span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted, #94a3b8)', marginTop: '4px' }}>
              {subtitle || `Gross: ${formatLakhs(metrics.gross)} · Received: ${formatLakhs(metrics.received)} · Outstanding: ${formatLakhs(metrics.outstanding)} · ${periodLabel}`}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={handleExportCsv}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                background: 'rgba(255, 255, 255, 0.06)',
                color: 'var(--text-main, #f1f5f9)',
                border: '1px solid var(--border-color, #475569)',
                borderRadius: '6px',
                padding: '6px 10px',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              <Download size={13} />
              <span>Export CSV</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted, #94a3b8)',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '6px',
                display: 'inline-flex',
                alignItems: 'center'
              }}
              aria-label="Close audit panel"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          
          {/* Contact & Contract Details Dropdown Toggle (if details exist) */}
          {contactDetails && (
            <div style={{ marginBottom: '16px' }}>
              <button
                type="button"
                onClick={() => setShowContactDetails(prev => !prev)}
                style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid var(--border-color, #334155)',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  color: '#38bdf8',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>{showContactDetails ? '▾ Hide Contract & Directory Details' : '▸ Show Contract & Directory Details'}</span>
              </button>

              {showContactDetails && (
                <div style={{
                  marginTop: '8px',
                  padding: '12px',
                  background: 'var(--bg-input, #0f172a)',
                  border: '1px solid var(--border-color, #334155)',
                  borderRadius: '8px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '10px',
                  fontSize: '12px'
                }}>
                  {contactDetails.role && <div><span style={{ color: '#94a3b8' }}>Role: </span>{contactDetails.role}</div>}
                  {contactDetails.city && <div><span style={{ color: '#94a3b8' }}>City: </span>{contactDetails.city}</div>}
                  {contactDetails.owner && <div><span style={{ color: '#94a3b8' }}>Manager / Owner: </span>{contactDetails.owner}</div>}
                  {contactDetails.baseSalary && <div><span style={{ color: '#94a3b8' }}>Base Salary: </span>{formatCurrency(contactDetails.baseSalary)}</div>}
                  {contactDetails.commissionRate && <div><span style={{ color: '#94a3b8' }}>Commission Rate: </span>{(contactDetails.commissionRate * 100).toFixed(0)}% of pool</div>}
                  {contactDetails.phone && <div><span style={{ color: '#94a3b8' }}>Phone: </span>{contactDetails.phone}</div>}
                  {contactDetails.email && <div><span style={{ color: '#94a3b8' }}>Email: </span>{contactDetails.email}</div>}
                </div>
              )}
            </div>
          )}

          {/* 4 + 4 KPI Cards (Two even rows of 4) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '10px',
            marginBottom: '16px'
          }}>
            {/* Row 1 of 4 Cards */}
            <div style={{ background: 'var(--bg-input, #0f172a)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color, #334155)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Total Invoiced</span>
                <InfoTip term="grossBilling" size={12} />
              </div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-main, #f8fafc)', marginTop: '4px' }}>
                {formatLakhs(metrics.gross)}
              </div>
            </div>

            <div style={{ background: 'var(--bg-input, #0f172a)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color, #334155)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Our Share</span>
                <InfoTip term="ourShare" size={12} />
              </div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#10b981', marginTop: '4px' }}>
                {formatLakhs(metrics.ourShare)}
              </div>
            </div>

            <div style={{ background: 'var(--bg-input, #0f172a)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color, #334155)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Partner Share</span>
                <InfoTip term="partnerShare" size={12} />
              </div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#38bdf8', marginTop: '4px' }}>
                {formatLakhs(metrics.partnerShare)}
              </div>
            </div>

            <div style={{ background: 'var(--bg-input, #0f172a)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color, #334155)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Cash Received</span>
                <InfoTip text="Actual remittance received in company account." size={12} />
              </div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#15803D', marginTop: '4px' }}>
                {formatLakhs(metrics.received)}
              </div>
            </div>

            {/* Row 2 of 4 Cards */}
            <div style={{ background: 'var(--bg-input, #0f172a)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color, #334155)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Outstanding</span>
                <InfoTip text="Billed invoices awaiting client payment." size={12} />
              </div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#f59e0b', marginTop: '4px' }}>
                {formatLakhs(metrics.outstanding)}
              </div>
            </div>

            <div style={{ background: 'var(--bg-input, #0f172a)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color, #334155)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Cancelled / Losses</span>
                <InfoTip term="creditNotes" size={12} />
              </div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#ef4444', marginTop: '4px' }}>
                {formatLakhs(metrics.cancelled)}
              </div>
            </div>

            <div style={{ background: 'var(--bg-input, #0f172a)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color, #334155)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Deals Closed</span>
                <InfoTip text="Successfully closed placements." size={12} />
              </div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-main, #f8fafc)', marginTop: '4px' }}>
                {metrics.closedCount} deals
              </div>
            </div>

            <div style={{ background: 'var(--bg-input, #0f172a)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color, #334155)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Win Rate</span>
                <InfoTip term="winRate" size={12} />
              </div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: metrics.winRate !== null ? '#10b981' : '#94a3b8', marginTop: '4px' }}>
                {metrics.winRate !== null ? `${metrics.winRate}%` : 'N/A'}
              </div>
            </div>
          </div>

          {/* Inner Filter Chips & Search Bar */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            marginBottom: '12px',
            paddingBottom: '10px',
            borderBottom: '1px solid var(--border-color, #334155)'
          }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
              {/* Payment filter chips */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)' }}>Payment:</span>
                {['all', 'Received', 'Outstanding', 'Credit note'].map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setFilterPayment(p)}
                    style={{
                      background: filterPayment === p ? '#0F6E56' : 'rgba(255,255,255,0.04)',
                      color: filterPayment === p ? '#fff' : 'var(--text-muted, #94a3b8)',
                      border: '1px solid var(--border-color, #475569)',
                      borderRadius: '12px',
                      padding: '2px 8px',
                      fontSize: '11px',
                      cursor: 'pointer'
                    }}
                  >
                    {p === 'all' ? 'All' : p}
                  </button>
                ))}
              </div>

              {/* Stage filter chips */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '6px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted, #94a3b8)' }}>Stage:</span>
                {['all', 'Closed', 'Progressed', 'Cancelled'].map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setFilterStage(s)}
                    style={{
                      background: filterStage === s ? '#1E40AF' : 'rgba(255,255,255,0.04)',
                      color: filterStage === s ? '#fff' : 'var(--text-muted, #94a3b8)',
                      border: '1px solid var(--border-color, #475569)',
                      borderRadius: '12px',
                      padding: '2px 8px',
                      fontSize: '11px',
                      cursor: 'pointer'
                    }}
                  >
                    {s === 'all' ? 'All' : s}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick search */}
            <input
              type="text"
              placeholder="Search in audit..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: 'var(--bg-input, #0f172a)',
                color: '#f8fafc',
                border: '1px solid #475569',
                borderRadius: '6px',
                padding: '4px 8px',
                fontSize: '11px',
                outline: 'none',
                width: '150px'
              }}
            />
          </div>

          {/* Underlying Transactions Table */}
          <div style={{ overflowX: 'auto', border: '1px solid var(--border-color, #334155)', borderRadius: '8px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg-input, #0f172a)', borderBottom: '1px solid var(--border-color, #334155)' }}>
                  <th style={{ padding: '8px 10px', color: 'var(--text-muted, #94a3b8)' }}>Date</th>
                  <th style={{ padding: '8px 10px', color: 'var(--text-muted, #94a3b8)' }}>Bill / Ref #</th>
                  <th style={{ padding: '8px 10px', color: 'var(--text-muted, #94a3b8)' }}>Client Company</th>
                  <th style={{ padding: '8px 10px', color: 'var(--text-muted, #94a3b8)' }}>Candidate / Position</th>
                  <th style={{ padding: '8px 10px', color: 'var(--text-muted, #94a3b8)' }}>State</th>
                  <th style={{ padding: '8px 10px', color: 'var(--text-muted, #94a3b8)', textAlign: 'right' }}>Gross Amount</th>
                  <th style={{ padding: '8px 10px', color: 'var(--text-muted, #94a3b8)', textAlign: 'right' }}>Our Share</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted, #64748b)' }}>
                      No underlying deals matched the active filters.
                    </td>
                  </tr>
                ) : (
                  filteredRows.slice(0, 50).map((t, idx) => {
                    const shares = getTransactionShares(t);
                    const pay = classifyPaymentState(t);
                    const stage = classifyEnquiryStatus(t.status || t.info);
                    return (
                      <tr 
                        key={t.id || idx}
                        style={{
                          borderBottom: '1px solid rgba(255,255,255,0.04)',
                          background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)'
                        }}
                      >
                        <td style={{ padding: '8px 10px', whiteSpace: 'nowrap', color: 'var(--text-muted, #94a3b8)' }}>
                          {formatDate(t.date)}
                        </td>
                        <td style={{ padding: '8px 10px', fontWeight: 500, color: '#38bdf8' }}>
                          {t.referenceId || t.billNumber || `REC-${idx + 1}`}
                        </td>
                        <td style={{ padding: '8px 10px', color: 'var(--text-main, #f8fafc)' }}>
                          {t.companyName || 'Standard Client'}
                        </td>
                        <td style={{ padding: '8px 10px', color: 'var(--text-muted, #cbd5e1)' }}>
                          {t.candidateName || t.positionName || t.role || 'Placement'}
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <span style={{
                            background: pay === 'RECEIVED' ? 'rgba(21, 128, 61, 0.2)' : pay === 'OUTSTANDING' ? 'rgba(180, 83, 9, 0.2)' : 'rgba(185, 28, 28, 0.2)',
                            color: pay === 'RECEIVED' ? '#10b981' : pay === 'OUTSTANDING' ? '#f59e0b' : '#ef4444',
                            borderRadius: '10px',
                            padding: '1px 6px',
                            fontSize: '10px',
                            fontWeight: 500
                          }}>
                            {pay}
                          </span>
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 500, color: 'var(--text-main, #f8fafc)' }}>
                          {formatCurrency(shares.gross)}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 500, color: '#10b981' }}>
                          {formatCurrency(shares.rShare)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {filteredRows.length > 50 && (
            <div style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-muted, #94a3b8)', marginTop: '8px' }}>
              Showing first 50 of {filteredRows.length} transactions. Export CSV to download the complete ledger.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
