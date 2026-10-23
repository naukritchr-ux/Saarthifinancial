"""
backend/scripts/inspect_q4_months.py
Prints payroll months for FY 2026-27 with exact dates and classification against today.
Counts and totals only, NO NAMES.
"""
import sys, os
from datetime import date
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from scripts.db_guard import get_db_connection, add_db_safety_args
import argparse

parser = argparse.ArgumentParser()
add_db_safety_args(parser)
args = parser.parse_args(['--env', 'staging'])

conn, host, db_name = get_db_connection(args)
cursor = conn.cursor()

today = date(2026, 10, 23)
print(f"Reference Date (Today): {today}\n")

cursor.execute("""
    SELECT 
        DATE_FORMAT(date, '%%Y-%%m') as month_ym,
        MIN(date) as min_date,
        MAX(date) as max_date,
        COUNT(*) as count_records,
        SUM(ctc_amount) as total_ctc,
        CASE 
            WHEN MAX(date) <= %s THEN 'ACTUAL'
            ELSE 'PROJECTED'
        END as classification
    FROM payroll_records
    WHERE financial_year = '2026-2027'
    GROUP BY month_ym
    ORDER BY month_ym
""", [today])

months = cursor.fetchall()
actual_sum = 0.0
projected_sum = 0.0

print(f"{'Month':<10} | {'Date Used':<12} | {'Records':<8} | {'Total CTC (Rs)':<16} | {'Classification':<12}")
print("-" * 68)
for m in months:
    ctc = float(m['total_ctc'])
    date_used = str(m['max_date']) if m['min_date'] == m['max_date'] else f"{m['min_date']}..{m['max_date']}"
    if m['classification'] == 'ACTUAL':
        actual_sum += ctc
    else:
        projected_sum += ctc
    is_oct = (m['month_ym'] == '2026-10')
    extra = " <-- OCTOBER 2026" if is_oct else ""
    print(f"{m['month_ym']:<10} | {date_used:<12} | {m['count_records']:<8} | {ctc:>14,.2f} | {m['classification']:<12}{extra}")

print("-" * 68)
print(f"TOTAL ACTUAL SALARIES (dated <= {today}):    Rs {actual_sum:,.2f} ({actual_sum/1e7:.2f} Cr)")
print(f"TOTAL PROJECTED SALARIES (dated > {today}): Rs {projected_sum:,.2f} ({projected_sum/1e5:.2f} Lakh)")
print(f"TOTAL PAYROLL FOR FY 2026-27:               Rs {actual_sum + projected_sum:,.2f} ({(actual_sum + projected_sum)/1e7:.2f} Cr)")

# Specifically inspect October 2026 dates in payroll_records
cursor.execute("""
    SELECT DISTINCT date, COUNT(*) as cnt, SUM(ctc_amount) as sum_ctc
    FROM payroll_records
    WHERE financial_year = '2026-2027' AND DATE_FORMAT(date, '%%Y-%%m') = '2026-10'
    GROUP BY date
""")
oct_rows = cursor.fetchall()
print(f"\nOctober 2026 record dates detail:")
for r in oct_rows:
    dt = r['date']
    is_after = (dt > today)
    print(f"   Date: {dt} | Count: {r['cnt']} | CTC: Rs {float(r['sum_ctc']):,.2f} | Dated after today ({today})? {is_after}")

conn.close()
