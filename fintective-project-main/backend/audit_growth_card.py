"""Read-only Fintective card audit. Copy to backend/ and run there.

python audit_growth_card.py --bd "Komal Suresh Bhanushali" --fy 2026-27
Optional: --payroll-name "Komal Bhanushali" --as-of 2026-10-25
Use --output audit_result.json to save the report.
Version 2: immediate progress, five-second heartbeats and a 60-second overall wait limit.
Uses the backend's existing database configuration; prints no credentials.
Every audit query is SELECT-only. Does not change records or trigger CRM sync.
"""
import argparse
import datetime as dt
import decimal
import contextlib
import io
import json
import queue
import sys
import threading
import time
from pathlib import Path


def json_value(value):
    if isinstance(value, decimal.Decimal):
        return str(value)
    if isinstance(value, (dt.datetime, dt.date)):
        return value.isoformat()
    raise TypeError(type(value).__name__)


def audit(conn, bd, fy_start, as_of, payroll_names=(), progress=None):
    progress = progress or (lambda message: None)
    start = dt.date(fy_start, 4, 1)
    year_end = dt.date(fy_start + 1, 3, 31)
    end = min(as_of, year_end)
    if end < start:
        raise ValueError('This financial year has not started as of the selected date.')
    scope_key = f'bd:{bd.strip().lower()}|tl:all|fn:all'
    report = {
        'subject': bd, 'scope': 'BD portfolio, not whole company',
        'actual_period': {'start': start.isoformat(), 'end': end.isoformat()},
        'selected_fy_end': year_end.isoformat(),
        'sources': {}, 'checks': [],
        'profit': None,
        'profit_reason': 'No verified profit is calculated: manual input periods and cost completeness require reconciliation.'
    }
    with conn.cursor() as cur:
        def select(name, sql, params):
            if not sql.lstrip().upper().startswith('SELECT '):
                raise ValueError('Audit permits SELECT statements only.')
            progress('Reading ' + name + '...')
            started = time.monotonic()
            try:
                cur.execute(sql, params)
                rows = cur.fetchall() or []
                report['sources'][name] = rows
                progress(name + ': ' + str(len(rows)) + ' result rows (' + format(time.monotonic() - started, '.1f') + 's)')
                return rows
            except Exception as exc:
                code = exc.args[0] if exc.args and isinstance(exc.args[0], int) else None
                report['sources'][name] = {'available': False, 'error_type': type(exc).__name__, 'database_error_code': code}
                report['checks'].append(f'{name} could not be read; it must not be treated as zero.')
                progress(name + ': unavailable (' + type(exc).__name__ + ', code ' + str(code) + ')')
                return None

        select('saved_manual_inputs', '''SELECT fy, salary, expense, updated_at
            FROM growth_money_box_inputs
            WHERE ((LOWER(TRIM(bd)) = %s AND LOWER(TRIM(tl)) = 'all'
                    AND LOWER(TRIM(franchise)) = 'all') OR scope_key = %s)
              AND LOWER(TRIM(fy)) IN (%s, %s, %s, %s)
            ORDER BY updated_at DESC LIMIT 12''',
            [bd.lower().strip(), scope_key, f'fy {fy_start}-{str(fy_start+1)[2:]}',
             f'fy {fy_start}-{fy_start+1}', f'{fy_start}-{fy_start+1}', f'{fy_start}-{str(fy_start+1)[2:]}'])
        select('stored_cost_period_columns', '''SELECT COLUMN_NAME FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'growth_money_box_inputs'
              AND COLUMN_NAME IN ('salary_period', 'expense_period', 'salary_basis', 'expense_basis',
                                  'period_start', 'period_end', 'as_of')''', [])
        report['checks'].append('Legacy salary/expense fields alone do not establish monthly versus period-total meaning.')

        identity = "LOWER(TRIM(COALESCE(NULLIF(TRIM(i.nameOfBd), ''), NULLIF(TRIM(e.bdMemberName), ''))))"
        predicate = f"({identity} = %s OR {identity} LIKE %s)"
        invoice_query = f'''SELECT COUNT(*) AS invoice_rows,
                COUNT(DISTINCT i.billNumber) AS distinct_bills,
                COUNT(DISTINCT NULLIF(LOWER(TRIM(i.companyName)), '')) AS companies,
                COALESCE(SUM(i.totalBillAmt), 0) AS billed_including_gst,
                COALESCE(SUM(i.rev_ex_gst), 0) AS revenue_excluding_gst,
                COALESCE(SUM(i.ourShare), 0) AS recorded_company_share,
                SUM(CASE WHEN i.ourShare IS NULL THEN 1 ELSE 0 END) AS missing_company_share_rows,
                MIN(i.billDate) AS first_invoice_date, MAX(i.billDate) AS last_invoice_date
            FROM v_invoice_clean i LEFT JOIN enquiries e ON i.enquiry_id = e.id
            WHERE i.is_revenue = 1 AND i.billDate >= %s AND i.billDate <= %s AND {predicate}'''
        name_params = [bd.lower().strip(), '%' + bd.lower().strip() + '%']
        select('invoices_actual_period', invoice_query, [start, end] + name_params)
        select('invoices_full_fy_used_by_old_card', invoice_query, [start, year_end] + name_params)
        if end < year_end:
            select('future_invoices_inside_fy', invoice_query, [end + dt.timedelta(days=1), year_end] + name_params)
        select('matched_invoice_bd_names', f'''SELECT DISTINCT {identity} AS matched_bd_name
            FROM v_invoice_clean i LEFT JOIN enquiries e ON i.enquiry_id = e.id
            WHERE i.is_revenue = 1 AND i.billDate >= %s AND i.billDate <= %s AND {predicate}
            LIMIT 12''', [start, end] + name_params)
        report['checks'].append('A stored company share is not independently audited merely because its invoice is counted.')

        names = list(dict.fromkeys([bd.lower().strip()] + [name.lower().strip() for name in payroll_names]))
        placeholders = ', '.join(['%s'] * len(names))
        payroll = select('recorded_payroll_by_month', f'''SELECT LEFT(date, 7) AS month,
                employee_name, COUNT(*) AS payroll_rows,
                SUM(ctc_amount) AS booked_ctc_cost, SUM(net_payable) AS net_salary_payable
            FROM payroll_records WHERE LEFT(date, 10) >= %s AND LEFT(date, 10) <= %s
              AND LOWER(TRIM(employee_name)) IN ({placeholders})
            GROUP BY LEFT(date, 7), employee_name ORDER BY month''', [start, end] + names)
        if payroll == []:
            report['checks'].append('No payroll matched these exact names. Missing identity/rows does not prove zero salary cost.')
            words = bd.lower().split()
            if words:
                select('possible_payroll_name_matches_not_automatically_combined', '''SELECT employee_name, LEFT(date, 7) AS month, COUNT(*) AS payroll_rows,
                        SUM(ctc_amount) AS booked_ctc_cost, SUM(net_payable) AS net_salary_payable
                    FROM payroll_records WHERE LOWER(employee_name) LIKE %s
                      AND LOWER(employee_name) LIKE %s AND LEFT(date, 10) >= %s AND LEFT(date, 10) <= %s
                    GROUP BY employee_name, LEFT(date, 7) ORDER BY employee_name, month LIMIT 100''',
                    ['%'+words[0]+'%', '%'+words[-1]+'%', start, end])
        select('configured_base_salary_not_period_payroll', '''SELECT id, name, baseSalary
            FROM bd_agents WHERE LOWER(TRIM(name)) = %s''', [bd.lower().strip()])
        select('recorded_monthly_bd_cost_inputs', '''SELECT month, fixed_salary, incentive_paid, travel_expense
            FROM cost_bd_monthly WHERE LOWER(TRIM(bd_name)) = %s
              AND month >= %s AND month <= %s ORDER BY month''',
            [bd.lower().strip(), start.strftime('%Y-%m'), end.strftime('%Y-%m')])
        select('directly_attributed_expenses_by_month_raw', '''SELECT LEFT(billDate, 7) AS month, expenses AS category, expenseType,
                COUNT(*) AS expense_rows, SUM(amount) AS raw_amount
            FROM expenditure WHERE is_deleted = 0 AND LEFT(billDate, 10) >= %s AND LEFT(billDate, 10) <= %s
              AND (LOWER(TRIM(bdAgentId)) = %s OR bdAgentId IN
                   (SELECT id FROM bd_agents WHERE LOWER(TRIM(name)) = %s))
            GROUP BY LEFT(billDate, 7), expenses, expenseType ORDER BY month, category''', [start, end, bd.lower().strip(), bd.lower().strip()])
        report['checks'].append('Raw attributed expenses need category/overlap review before combining them with payroll. Unallocated overhead is not included.')
    return report


def error_details(exc, stage):
    code = exc.args[0] if exc.args and isinstance(exc.args[0], int) else None
    messages = {
        1045: 'Database authentication failed. Check the existing backend database settings locally.',
        1049: 'The configured database name was not found.',
        2003: 'The configured database server could not be reached. Check connectivity and database availability.',
        2005: 'The configured database hostname could not be resolved.',
        2006: 'The database connection closed before the audit completed.',
        2013: 'The database connection timed out or was lost while reading.',
    }
    hint = messages.get(code, 'Run this file inside the configured Fintective backend. Check that its requirements are installed.')
    if isinstance(exc, ModuleNotFoundError):
        hint = 'A backend module or dependency could not be loaded. Run this file in backend/ with the existing backend requirements installed.'
    return {'audit_available': False, 'error_type': type(exc).__name__, 'database_error_code': code,
            'stage': stage, 'message': hint}


def run_visible(work, timeout=60, heartbeat=5, progress_stream=None):
    """Bound the CLI wait, with progress even while connection/imports are blocked.

    A daemon performs read-only work. When used by this CLI, a timeout returns an
    error and the process exits; it does not leave a non-daemon worker hanging.
    """
    stream = progress_stream if progress_stream is not None else sys.stderr
    completed = queue.Queue(maxsize=1)
    started = time.monotonic()
    state = {'stage': 'Starting audit'}
    lock = threading.Lock()

    def progress(message):
        with lock:
            state['stage'] = message
        print('[audit v2] ' + message, file=stream, flush=True)

    def worker():
        try:
            completed.put((0, work(progress)))
        except Exception as exc:
            with lock:
                stage = state['stage']
            completed.put((1, error_details(exc, stage)))

    progress('Starting. Maximum wait: ' + format(timeout, 'g') + ' seconds.')
    threading.Thread(target=worker, daemon=True).start()
    while True:
        remaining = timeout - (time.monotonic() - started)
        if remaining <= 0:
            with lock:
                stage = state['stage']
            progress('Stopped waiting after the time limit.')
            return 1, {'audit_available': False, 'error_type': 'AuditTimeout', 'stage': stage,
                       'elapsed_seconds': round(time.monotonic() - started, 1),
                       'message': 'The audit exceeded its time limit. The stage identifies where it was waiting; no profit result is inferred.'}
        try:
            return completed.get(timeout=min(heartbeat, remaining))
        except queue.Empty:
            with lock:
                stage = state['stage']
            print('[audit v2] Waiting (' + format(time.monotonic() - started, '.0f') + 's): ' + stage,
                  file=stream, flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--bd', default='Komal Suresh Bhanushali')
    parser.add_argument('--fy', default='2026-27')
    parser.add_argument('--as-of', type=dt.date.fromisoformat)
    parser.add_argument('--payroll-name', action='append', default=[])
    parser.add_argument('--timeout', type=float, default=60, help='Maximum overall wait in seconds (default: 60).')
    parser.add_argument('--output', help='Also save the final JSON report to this file.')
    parser.add_argument('--version', action='version', version='Fintective audit v2')
    args = parser.parse_args()
    if args.timeout <= 0:
        parser.error('--timeout must be greater than zero')
    # Preserve the real output stream even while old db.py diagnostics are captured
    # by the connection worker. Progress always goes to stderr and is flushed.
    output_stream = sys.stdout

    def work(progress):
        progress('Loading backend configuration...')
        start = int(args.fy.removeprefix('FY ').split('-')[0])
        from finance_rules import get_ist_today
        from db import get_db_connection
        progress('Connecting to the database using the existing backend settings...')
        with contextlib.redirect_stdout(io.StringIO()):
            conn = get_db_connection(max_retries=1)
        try:
            progress('Connected. Starting SELECT-only checks...')
            result = audit(conn, args.bd, start, min(args.as_of or get_ist_today(), get_ist_today()),
                           args.payroll_name, progress=progress)
            progress('Checks finished. Preparing the report...')
            return result
        finally:
            try:
                conn.close()
            except Exception:
                progress('Database connection was already closed; available results are preserved.')

    exit_code, result = run_visible(work, timeout=args.timeout)
    try:
        content = json.dumps(result, indent=2, default=json_value)
    except Exception as exc:
        exit_code = 1
        content = json.dumps(error_details(exc, 'Preparing JSON output'), indent=2)
    print(content, file=output_stream, flush=True)
    if args.output:
        try:
            Path(args.output).write_text(content + '\n', encoding='utf-8')
            print('[audit v2] Report saved to ' + args.output, file=sys.stderr, flush=True)
        except OSError:
            print('[audit v2] Could not save the report file; the JSON report is printed above.', file=sys.stderr, flush=True)
            exit_code = 1
    return exit_code


if __name__ == '__main__':
    raise SystemExit(main())
