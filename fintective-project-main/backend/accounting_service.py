"""Shared, read-only recorded-cash and booked-cost calculations.

Cash uses net salary payable plus recorded non-salary/remittance expenditure.
CTC is retained only as a booked-cost statistic. No inferred CTC component is
removed from expenditure. Confirmed cross-source salary duplicates require a
unique payment reference, date and amount, and are disclosed in the audit.
Invoice dateReceived is used where supplied, with invoice-date fallback disclosed.
Aggregate received totals cannot reconstruct separate instalments and are never
presented as a bank reconciliation.
"""
from collections import Counter
from decimal import Decimal, ROUND_HALF_UP
import calendar
import datetime as dt
import re

from finance_rules import get_ist_today

ZERO = Decimal('0')
CENT = Decimal('0.01')
SOURCE_NOTES = [
    'Receipt dates are used where available; invoice-date fallbacks and aggregated instalments limit historical cash timing.',
    'Net salary payable is a recorded obligation, not proof of a bank payment date.',
    'Company funds allocate invoice receipts to the company share; GST and franchise allocations are excluded.',
    'Opening bank funding, loans and other unrecorded adjustments are not inferred.',
]


def money(value):
    value = Decimal(str(value if value is not None else 0))
    if not value.is_finite():
        raise ValueError('Financial amounts must be finite')
    return value


def amount(value):
    return float(money(value).quantize(CENT, rounding=ROUND_HALF_UP))


def as_date(value):
    if isinstance(value, dt.datetime):
        return value.date()
    if isinstance(value, dt.date):
        return value
    try:
        return dt.date.fromisoformat(str(value)[:10])
    except (TypeError, ValueError):
        return None


def month_bounds(ym):
    year, month = map(int, ym.split('-'))
    return dt.date(year, month, 1), dt.date(year, month, calendar.monthrange(year, month)[1])


def payroll_related(row):
    # Audit classification only: these rows stay in cash expenditure.
    for field in ('expenses', 'expenseType', 'particulars'):
        text = re.sub(r'[^a-z0-9]+', ' ', str(row.get(field) or '').lower()).strip()
        if re.search(r'\b(epf|eps|esic|esi|lwf|gratuity|tds)\b', text):
            return True
        if any(term in text for term in ('provident fund', 'professional tax', 'welfare fund')):
            return True
    return False


def salary_entry(row):
    text = ' '.join(str(row.get(k) or '') for k in ('expenses', 'expenseType')).lower()
    return bool(re.search(r'\b(salary|salaries|wages)\b', text))


def payment_key(reference, date, value):
    ref = str(reference or '').strip().upper()
    if ref in ('', 'TX', 'N/A', 'NA', 'NONE', 'NULL', '-', '0') or not date:
        return None
    return (ref, date.isoformat(), money(value).quantize(CENT))


def load_financial_ledger(conn, as_of=None):
    """Load source aggregates/rows once, bounded at the supplied date.

    Future payroll rows may be loaded explicitly for a forecast, but period
    summaries always apply their own cutoff. Undated rows are audited, not silently
    assigned to today. Queries and failures are never replaced with invented cash.
    """
    end_date = as_date(as_of) if as_of is not None else get_ist_today()
    if end_date is None:
        raise ValueError('as_of must be YYYY-MM-DD')
    end = (end_date + dt.timedelta(days=1)).isoformat()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT DATE_FORMAT(billDate, '%%Y-%%m-%%d') AS date,
                   COUNT(*) AS invoices_count,
                   SUM(CASE WHEN is_revenue = 1 THEN 1 ELSE 0 END) AS revenue_invoices_count,
                   COALESCE(SUM(amountReceived), 0) AS invoice_receipts_gross,
                   COALESCE(SUM(CASE WHEN is_revenue = 1 THEN ourShare ELSE 0 END), 0) AS company_income,
                   COALESCE(SUM(CASE WHEN is_revenue = 1 THEN rev_ex_gst ELSE 0 END), 0) AS revenue,
                   COALESCE(SUM(CASE WHEN is_revenue = 1 THEN totalBillAmt ELSE 0 END), 0) AS billed_incl_gst,
                   COALESCE(SUM(CASE WHEN is_revenue = 1 THEN franchiseeShare ELSE 0 END), 0) AS franchisee_share,
                   COALESCE(SUM(ROUND(CASE WHEN is_revenue = 1 AND totalBillAmt > 0
                     THEN COALESCE(ourShare, 0) * LEAST(1, GREATEST(0, COALESCE(amountReceived, 0) / totalBillAmt))
                     ELSE 0 END, 2)), 0) AS company_collections_estimate
            FROM v_invoice_clean
            WHERE billDate < %s OR billDate IS NULL OR TRIM(billDate) = ''
            GROUP BY date
        """, [end])
        invoices = cursor.fetchall()
        # Receipts can occur in a different period from earned invoice revenue.
        cursor.execute("""
            SELECT COALESCE(DATE(dateReceived), DATE(billDate)) AS date,
                   COUNT(*) AS receipt_invoice_count,
                   COALESCE(SUM(amountReceived), 0) AS invoice_receipts_gross,
                   COALESCE(SUM(CASE WHEN DATE(dateReceived) IS NULL THEN 1 ELSE 0 END), 0) AS bill_date_proxy_count,
                   COALESCE(SUM(ROUND(CASE WHEN is_revenue = 1 AND totalBillAmt > 0
                     THEN COALESCE(ourShare, 0) * LEAST(1, GREATEST(0, COALESCE(amountReceived, 0) / totalBillAmt))
                     ELSE 0 END, 2)), 0) AS company_collections_estimate
            FROM v_invoice_clean WHERE amountReceived <> 0
              AND (COALESCE(DATE(dateReceived), DATE(billDate)) < %s
                   OR COALESCE(DATE(dateReceived), DATE(billDate)) IS NULL)
            GROUP BY date
        """, [end])
        receipts = cursor.fetchall()
        cursor.execute("""
            SELECT id, billDate AS date, amount, expenses, expenseType, particulars, srNo
            FROM expenditure WHERE is_deleted = 0
              AND (billDate < %s OR billDate IS NULL OR TRIM(billDate) = '')
        """, [end])
        expenses = cursor.fetchall()
        cursor.execute("""
            SELECT id, date, net_payable, ctc_amount, reference_id
            FROM payroll_records WHERE date < %s OR date IS NULL
        """, [end])
        payroll = cursor.fetchall()
        cursor.execute("""
            SELECT payment_date AS date, payment_amount AS amount
            FROM franchisePayments WHERE LOWER(payment_done) = 'yes'
              AND (payment_date < %s OR payment_date IS NULL OR TRIM(payment_date) = '')
        """, [end])
        payouts = cursor.fetchall()
        cursor.execute("""
            SELECT id, date, amount, type FROM manual_cash_entries
            WHERE date < %s OR date IS NULL
        """, [end])
        manual = cursor.fetchall()
        return {'invoices': invoices, 'receipts': receipts, 'expenses': expenses, 'payroll': payroll,
                'payouts': payouts, 'manual': manual, 'loaded_as_of': end_date.isoformat()}
    finally:
        cursor.close()


def summarize_ledger(data, as_of=None, start=None):
    end = as_date(as_of) if as_of is not None else get_ist_today()
    begin = as_date(start) if start is not None else None
    if end is None or (start is not None and begin is None) or (begin and begin > end):
        raise ValueError('A valid start/as_of date range is required')
    if data.get('loaded_as_of') and as_date(data['loaded_as_of']) < end:
        raise ValueError('Ledger data was loaded before the requested cutoff')
    undated = Counter()

    def included(rows, source, field='date'):
        result = []
        for row in rows:
            raw = row.get(field)
            if raw is None and source == 'invoices' and isinstance(row.get('month'), str):
                raw = row['month'] + '-01'
            date = as_date(raw + '-01') if field == 'month' and isinstance(raw, str) else as_date(raw)
            if date is None:
                undated[source] += int(row.get('invoices_count') or row.get('receipt_invoice_count') or 1)
            elif (begin is None or date >= begin) and date <= end:
                result.append(row)
        return result

    invoices = included(data.get('invoices', []), 'invoices')
    receipts = included(data.get('receipts', invoices), 'receipts')
    expenses = included(data.get('expenses', []), 'expenditure')
    payroll = included(data.get('payroll', []), 'payroll')
    payouts = included(data.get('payouts', []), 'franchise_payouts')
    manual = included(data.get('manual', []), 'manual_cash')
    total = lambda rows, key: sum((money(r.get(key)) for r in rows), ZERO)

    # Identify only exact, unique cross-source net salary payment duplicates.
    payroll_keys = Counter(payment_key(r.get('reference_id'), as_date(r.get('date')), r.get('net_payable'))
                           for r in payroll if r.get('net_payable') is not None)
    expense_keys = Counter(payment_key(r.get('srNo'), as_date(r.get('date')), r.get('amount'))
                           for r in expenses if salary_entry(r))
    matched, unmatched_salary = [], []
    for row in expenses:
        if salary_entry(row):
            key = payment_key(row.get('srNo'), as_date(row.get('date')), row.get('amount'))
            if key and payroll_keys[key] == 1 and expense_keys[key] == 1:
                matched.append(row)
            elif payroll:
                unmatched_salary.append(row)
    duplicate_amount = total(matched, 'amount')
    missing_net = sum(1 for r in payroll if r.get('net_payable') is None)
    if any(money(r.get('net_payable')) < 0 for r in payroll if r.get('net_payable') is not None):
        raise ValueError('Negative net salary payable requires reconciliation')
    net_salary = total(payroll, 'net_payable')
    expenditure = total(expenses, 'amount')
    expense_cash = expenditure - duplicate_amount
    ctc = total(payroll, 'ctc_amount')
    related_rows = [r for r in expenses if payroll_related(r)]
    related_amount = total(related_rows, 'amount')
    gross_receipts = total(receipts, 'invoice_receipts_gross')
    retained_receipts = total(receipts, 'company_collections_estimate')
    company_income = total(invoices, 'company_income')
    franchise_payouts = total(payouts, 'amount')
    manual_income = sum((money(r.get('amount')) for r in manual if r.get('type') == 'income'), ZERO)
    manual_expense = sum((money(r.get('amount')) for r in manual if r.get('type') == 'expense'), ZERO)
    total_cash_outflow = expense_cash + net_salary + manual_expense
    company_net = retained_receipts + manual_income - total_cash_outflow
    raw_ledger_net = gross_receipts + manual_income - total_cash_outflow - franchise_payouts
    cost_result = company_income - expense_cash - ctc
    # A category match is not evidence that a CTC component can be removed.
    missing_period_payroll = bool(begin and not payroll and data.get('payroll'))
    needs_review = bool((related_rows and payroll) or unmatched_salary or missing_net or missing_period_payroll)
    activity_months = {as_date(row.get('date') or str(row.get('month', ''))+'-01').strftime('%Y-%m')
                       for row in invoices + receipts + expenses if as_date(row.get('date') or str(row.get('month', ''))+'-01')}
    payroll_months = {as_date(row['date']).strftime('%Y-%m') for row in payroll}
    months_without_payroll = sorted(activity_months - payroll_months)
    category_totals = {}
    for row in related_rows:
        category = str(row.get('expenses') or row.get('expenseType') or 'Payroll-related')
        category_totals[category] = category_totals.get(category, ZERO) + money(row.get('amount'))
    notes = list(SOURCE_NOTES)
    if months_without_payroll:
        notes.append(f'{len(months_without_payroll)} activity months have no payroll rows in this period. Verify coverage; unrecorded historical salaries are not inferred.')
    if undated:
        notes.append('Undated source records are excluded and listed in the audit.')
    if related_rows and payroll:
        notes.append('Payroll-related expenditure remains in cash outflows; CTC-based profit needs component reconciliation.')
    if unmatched_salary:
        notes.append('Salary-like expenditure has no unique matching payroll reference; a possible duplicate needs review.')
    if missing_period_payroll:
        notes.append('Payroll exists in other periods but is not posted in this period; booked profit is unavailable.')
    if missing_net:
        notes.append('Some payroll records lack net payable; cash estimates are unavailable until these are completed.')
    values = {
        'company_income': company_income, 'invoice_receipts_gross': gross_receipts,
        'company_collections_estimate': retained_receipts, 'expenditure_recorded': expenditure,
        'salary_payment_duplicates_removed': duplicate_amount, 'expense_cash': expense_cash,
        'net_salary_payable': net_salary, 'payroll_ctc_cost': ctc,
        'payroll_related_expenditure': related_amount, 'franchise_payouts': franchise_payouts,
        'manual_income': manual_income, 'manual_expense': manual_expense,
        'total_cash_outflow': total_cash_outflow, 'company_cash_movement_estimate': company_net,
        'ledger_cash_movement_estimate': raw_ledger_net, 'unreconciled_cost_result': cost_result,
        'revenue': total(invoices, 'revenue'), 'billed_incl_gst': total(invoices, 'billed_incl_gst'),
        'franchisee_share': total(invoices, 'franchisee_share'),
    }
    result = {key: amount(value) for key, value in values.items()}
    if missing_net or unmatched_salary:
        result['company_cash_movement_estimate'] = None
        result['ledger_cash_movement_estimate'] = None
    result.update({
        'period': {'start': begin.isoformat() if begin else None, 'as_of': end.isoformat()},
        'basis': 'recorded_net_payroll_cash_proxy',
        'profit_loss_basis': 'CTC booked-cost estimate; not a verified income statement',
        'operating_profit_loss': None if needs_review else amount(cost_result),
        'profit_loss_status': 'needs_payroll_reconciliation' if needs_review else 'provisional_booked_costs',
        'cash_status': 'needs_payroll_reconciliation' if missing_net or unmatched_salary else 'ledger_estimate',
        'sources': {
            'invoices': {'rows': sum(int(r.get('invoices_count') or 0) for r in invoices),
                         'gross_receipts': amount(gross_receipts), 'company_allocation': amount(retained_receipts)},
            'receipts': {'invoice_rows': sum(int(r.get('receipt_invoice_count') or 1) for r in receipts),
                         'gross_receipts': amount(gross_receipts), 'company_allocation': amount(retained_receipts)},
            'expenditure': {'rows': len(expenses), 'recorded': amount(expenditure), 'cash_included': amount(expense_cash)},
            'payroll_records': {'rows': len(payroll), 'net_payable_included': amount(net_salary), 'ctc_excluded_from_cash': amount(ctc)},
            'franchise_payments': {'rows': len(payouts), 'included_in_full_ledger_only': amount(franchise_payouts)},
            'manual_cash_entries': {'rows': len(manual), 'income': amount(manual_income), 'expense': amount(manual_expense)},
        },
        'audit': {'confirmed_salary_duplicates': [r.get('id') for r in matched],
                  'unmatched_salary_expenses': [r.get('id') for r in unmatched_salary],
                  'payroll_related_expense_ids': [r.get('id') for r in related_rows],
                  'activity_months_without_payroll': months_without_payroll,
                  'missing_net_payable': missing_net, 'payroll_not_posted_for_period': missing_period_payroll,
                  'payroll_category_totals': {k: amount(v) for k, v in category_totals.items()},
                  'undated_records_excluded': dict(undated),
                  'invoice_date_is_receipt_date_proxy': any(int(r.get('bill_date_proxy_count') or 0) for r in receipts),
                  'receipt_date_fallback_rows': sum(int(r.get('bill_date_proxy_count') or 0) for r in receipts),
                  'aggregate_receipts_cannot_split_instalments': True, 'payroll_date_is_payment_date_proxy': True},
        'notes': notes,
        'invoices_count': sum(int(r.get('invoices_count') or 0) for r in invoices),
        'revenue_invoices_count': sum(int(r.get('revenue_invoices_count') or 0) for r in invoices),
        'payroll_rows': len(payroll), 'expense_rows': len(expenses),
    })
    return result


def monthly_summaries(data, months):
    return {ym: summarize_ledger(data, month_bounds(ym)[1], month_bounds(ym)[0]) for ym in months}


def last_closed_month_end(as_of, today=None):
    date = as_date(as_of)
    today = today or get_ist_today()
    if date is None:
        raise ValueError('A valid as_of date is required')
    if date < today and date.day == calendar.monthrange(date.year, date.month)[1]:
        return date
    return date.replace(day=1) - dt.timedelta(days=1)
