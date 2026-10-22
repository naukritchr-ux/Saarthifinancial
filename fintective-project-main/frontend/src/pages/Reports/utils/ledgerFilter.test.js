import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  matchesMonth,
  matchesFinancialYear,
  isProjectedTransaction,
  formatDateDisplay,
  normalizePaymentMode,
  isCompanyValid,
  filterLedgerTransactions,
  sortLedgerTransactions,
  computeLedgerSummary
} from './ledgerFilter.js';

describe('ledgerFilter unit tests', () => {

  it('matchesMonth should match ISO YYYY-MM without timezone offset', () => {
    assert.strictEqual(matchesMonth('2026-04-01', 'April 2026'), true);
    assert.strictEqual(matchesMonth('2026-04-30', 'April 2026'), true);
    assert.strictEqual(matchesMonth('2026-05-01', 'April 2026'), false);
    assert.strictEqual(matchesMonth('2026-04-15', 'All Months'), true);
    assert.strictEqual(matchesMonth(null, 'April 2026'), false);
  });

  it('matchesFinancialYear handles full and short FY formats and date fallbacks', () => {
    assert.strictEqual(matchesFinancialYear('2026-04-10', '2026-2027', '2026-2027'), true);
    assert.strictEqual(matchesFinancialYear('2026-04-10', '2026-27', '2026-2027'), true);
    assert.strictEqual(matchesFinancialYear('2026-03-15', null, '2025-2026'), true); // March 2026 -> FY 2025-2026
    assert.strictEqual(matchesFinancialYear('2026-04-01', null, '2026-2027'), true); // April 2026 -> FY 2026-2027
    assert.strictEqual(matchesFinancialYear('2026-04-10', '2026-2027', 'All Years'), true);
  });

  it('isProjectedTransaction correctly tags future-dated rows', () => {
    const today = '2026-10-22';
    assert.strictEqual(isProjectedTransaction('2026-10-20', today), false);
    assert.strictEqual(isProjectedTransaction('2026-10-22', today), false);
    assert.strictEqual(isProjectedTransaction('2026-10-23', today), true);
    assert.strictEqual(isProjectedTransaction('2027-02-28', today), true);
  });

  it('formatDateDisplay formats YYYY-MM-DD into DD MMM YYYY', () => {
    assert.strictEqual(formatDateDisplay('2026-04-28'), '28 Apr 2026');
    assert.strictEqual(formatDateDisplay('2026-12-05'), '5 Dec 2026');
    assert.strictEqual(formatDateDisplay(''), '—');
  });

  it('normalizePaymentMode maps variations and defaults to Unspecified instead of Cash', () => {
    assert.strictEqual(normalizePaymentMode(null), 'Unspecified');
    assert.strictEqual(normalizePaymentMode(''), 'Unspecified');
    assert.strictEqual(normalizePaymentMode('N/A'), 'Unspecified');
    assert.strictEqual(normalizePaymentMode('direct bank transfer'), 'Direct Bank Transfer');
    assert.strictEqual(normalizePaymentMode('netbanking'), 'Net Banking');
    assert.strictEqual(normalizePaymentMode('upi'), 'UPI');
    assert.strictEqual(normalizePaymentMode('credit card'), 'Credit Card');
    assert.strictEqual(normalizePaymentMode('cash'), 'Cash');
  });

  it('isCompanyValid filters out synthetic or empty values', () => {
    assert.strictEqual(isCompanyValid('Tata Consultancy Services'), true);
    assert.strictEqual(isCompanyValid('Payroll (2026-04)'), false);
    assert.strictEqual(isCompanyValid('N/A'), false);
    assert.strictEqual(isCompanyValid('null'), false);
    assert.strictEqual(isCompanyValid('-'), false);
  });

  const mockTxs = [
    { id: '1', date: '2026-04-10', amount: 50000, type: 'income', category: 'Recruitment', title: 'Placement Fee', companyName: 'Acme Corp', paymentMode: 'Direct Bank Transfer' },
    { id: '2', date: '2026-04-15', amount: 20000, type: 'expense', category: 'Salaries', title: 'Salary: Alice', companyName: 'Payroll (2026-04)', paymentMode: 'Net Banking' },
    { id: '3', date: '2026-05-01', amount: 15000, type: 'expense', category: 'Marketing', title: 'Ad Campaign', companyName: 'Google Ads', paymentMode: 'Credit Card' },
    { id: '4', date: '2026-11-01', amount: 25000, type: 'expense', category: 'Salaries', title: 'Salary: Bob', companyName: 'Payroll (2026-11)', paymentMode: 'Net Banking' }
  ];

  it('filterLedgerTransactions filters by amount range and search', () => {
    const res = filterLedgerTransactions(mockTxs, {
      amountMin: 18000,
      amountMax: 30000,
      search: 'salary'
    }, 'All Months', 'All Years', '2026-10-22');

    assert.strictEqual(res.length, 2);
    assert.strictEqual(res[0].id, '2');
    assert.strictEqual(res[1].id, '4');
  });

  it('filterLedgerTransactions handles Actual vs Projected toggle', () => {
    const today = '2026-10-22';
    const actuals = filterLedgerTransactions(mockTxs, { actualProjected: 'actual' }, 'All Months', 'All Years', today);
    assert.strictEqual(actuals.length, 3);
    assert.ok(actuals.every(t => t.date <= today));

    const projected = filterLedgerTransactions(mockTxs, { actualProjected: 'projected' }, 'All Months', 'All Years', today);
    assert.strictEqual(projected.length, 1);
    assert.strictEqual(projected[0].id, '4');
  });

  it('sortLedgerTransactions sorts by date and amount', () => {
    const sortedByAmtDesc = sortLedgerTransactions(mockTxs, 'amount', 'desc');
    assert.strictEqual(sortedByAmtDesc[0].amount, 50000);
    assert.strictEqual(sortedByAmtDesc[3].amount, 15000);

    const sortedByDateAsc = sortLedgerTransactions(mockTxs, 'date', 'asc');
    assert.strictEqual(sortedByDateAsc[0].id, '1');
    assert.strictEqual(sortedByDateAsc[3].id, '4');
  });

  it('computeLedgerSummary calculates inflows, outflows, net and top categories', () => {
    const summary = computeLedgerSummary(mockTxs, '2026-10-22');
    assert.strictEqual(summary.inflow, 50000);
    assert.strictEqual(summary.outflow, 60000);
    assert.strictEqual(summary.net, -10000);
    assert.strictEqual(summary.totalCount, 4);
    assert.strictEqual(summary.actualCount, 3);
    assert.strictEqual(summary.projectedCount, 1);
    assert.strictEqual(summary.hasProjected, true);
    assert.ok(summary.topCategories.length > 0);
  });
});
