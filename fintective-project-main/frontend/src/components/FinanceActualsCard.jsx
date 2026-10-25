import React, { useEffect, useState } from 'react';
import { fetchWithApiKey } from '../utils/apiClient';
import { formatCurrency } from '../utils/formatters';

const displayMoney = value => value == null ? 'Not available' : formatCurrency(value);

export default function FinanceActualsCard({ apiBaseUrl = '/api' }) {
  const [period, setPeriod] = useState('mtd');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    setData(null);
    setError(null);
    const load = async () => {
      try {
        const response = await fetchWithApiKey(`${apiBaseUrl.replace(/\/+$/, '')}/finance/actuals?period=${period}`);
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || `HTTP ${response.status}`);
        if (active) setData(result);
      } catch (err) { if (active) setError(err.message); }
    };
    load();
    return () => { active = false; };
  }, [apiBaseUrl, period, reload]);

  const exportBreakdown = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `finance-source-breakdown-${data.period.as_of}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const items = data ? [
    ['Gross invoice receipts recorded', data.invoice_receipts_gross],
    ['Estimated company allocation of receipts', data.company_collections_estimate],
    ['Manual cash receipts', data.manual_income],
    ['Recorded expenditure, including remittances', data.expenditure_recorded],
    ['Confirmed duplicate salary entries', data.salary_payment_duplicates_removed],
    ['Expenditure included after duplicate removal', data.expense_cash],
    ['Net salary payable included', data.net_salary_payable],
    ['Manual cash expenses', data.manual_expense],
    ['Total company cash obligations', data.total_cash_outflow],
    ['CTC cost — shown for reconciliation; excluded from cash', data.payroll_ctc_cost],
    ['Franchise payouts — included in full ledger; company allocation already excludes the franchise share', data.franchise_payouts],
    ['Full-ledger movement estimate after net payroll and payouts', data.ledger_cash_movement_estimate],
  ] : [];
  return (
    <section className="dashboard-card" style={{ padding: 24, marginBottom: 24 }} aria-label="Recorded financial results">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: '0 0 8px' }}>Recorded results and source breakdown</h3>
          <p style={{ margin: 0 }}>Posted-period figures, separate from the forecast. Cash figures are ledger estimates.</p>
        </div>
        <label>Period{' '}
          <select value={period} onChange={event => setPeriod(event.target.value)}>
            <option value="mtd">Current month to date</option>
            <option value="fytd">Financial year to date</option>
            <option value="last_closed_month">Last completed month</option>
          </select>
        </label>
      </div>
      {error && <p role="alert">{error} <button onClick={() => setReload(value => value + 1)}>Retry</button></p>}
      {!data && !error && <p>Loading recorded sources…</p>}
      {data && <>
        <p>{data.period.start} through {data.period.as_of}. Current-period records may still be incomplete.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 16 }}>
          <div><strong>Recorded company income (earned)</strong><p>{displayMoney(data.company_income)}</p></div>
          <div><strong>Net salary payable recorded</strong><p>{displayMoney(data.net_salary_payable)}</p></div>
          <div><strong>Company cash movement estimate</strong><p>{displayMoney(data.company_cash_movement_estimate)}</p><small>Receipts allocated to company share, less expenditure and net salary obligations.</small></div>
          <div><strong>Operating profit/loss — booked-cost basis</strong><p>{data.operating_profit_loss == null ? 'Needs payroll reconciliation' : displayMoney(data.operating_profit_loss)}</p><small>Provisional; CTC and expense components must be reconciled. Not a verified income statement.</small></div>
        </div>
        {data.payroll_rows === 0 && <p role="status">No payroll records are posted in this period. This does not establish that salary obligations are zero.</p>}
        <details style={{ marginTop: 16 }}>
          <summary>Where the amounts come from</summary>
          <table style={{ width: '100%', marginTop: 12 }}>
            <thead><tr><th style={{ textAlign: 'left' }}>Source / treatment</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
            <tbody>{items.map(([label, value]) => <tr key={label}><td style={{ padding: 8 }}>{label}</td><td style={{ padding: 8, textAlign: 'right' }}>{displayMoney(value)}</td></tr>)}</tbody>
          </table>
          {Object.keys(data.audit?.payroll_category_totals || {}).length > 0 && <>
            <h4>Payroll-related expenditure retained in cash outflows</h4>
            <ul>{Object.entries(data.audit.payroll_category_totals).map(([label, value]) => <li key={label}>{label}: {displayMoney(value)}</li>)}</ul>
            <p>These category totals identify items to reconcile with CTC. They are not an automatic duplicate deduction.</p>
          </>}
          <ul>{(data.notes || []).map(note => <li key={note}>{note}</li>)}</ul>
          <button onClick={exportBreakdown}>Download source breakdown</button>
        </details>
      </>}
    </section>
  );
}
