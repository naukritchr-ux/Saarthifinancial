"""
backend/scripts/populate_before_finance_summary.py
Generates the exact BEFORE baseline for /api/finance/summary across all 3 FYs
matching the HEAD commit of app.py before the waterfall enhancement edits.
"""

import sys
import os
import json
import hashlib
from datetime import date

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from scripts.db_guard import get_db_connection, add_db_safety_args
from finance_rules import normalize_fy, fy_to_date_range, calculate_waterfall
from scripts.capture_baseline import clean, summarize, FYS
import argparse

parser = argparse.ArgumentParser()
add_db_safety_args(parser)
args = parser.parse_args(['--env', 'staging'])

conn, host, db_name = get_db_connection(args)
cursor = conn.cursor()

before_dir = os.path.join(BACKEND_DIR, 'baselines', 'before')
os.makedirs(before_dir, exist_ok=True)

# Load existing summary
summary_file = os.path.join(before_dir, '_summary.json')
summary = json.load(open(summary_file)) if os.path.exists(summary_file) else {}

for fy in FYS:
    fy_norm = normalize_fy(fy)
    start_date, end_date = fy_to_date_range(fy_norm)

    cursor.execute("""
        SELECT 
            COUNT(*) AS total_invoices,
            SUM(CASE WHEN is_revenue = 1 THEN 1 ELSE 0 END) AS revenue_invoices,
            COALESCE(SUM(CASE WHEN is_revenue = 1 THEN rev_ex_gst ELSE 0.0 END), 0.0) AS revenue_ex_gst,
            COALESCE(SUM(CASE WHEN is_revenue = 1 THEN totalBillAmt ELSE 0.0 END), 0.0) AS billed_incl_gst,
            COALESCE(SUM(ourShare), 0.0) AS total_our_share,
            COALESCE(SUM(CASE WHEN is_revenue = 1 THEN ourShare ELSE 0.0 END), 0.0) AS our_share_rev,
            COALESCE(SUM(CASE WHEN is_revenue = 0 THEN ourShare ELSE 0.0 END), 0.0) AS our_share_residual,
            COALESCE(SUM(CASE WHEN is_revenue = 1 THEN franchiseeShare ELSE 0.0 END), 0.0) AS franchisee_share_rev,
            COALESCE(SUM(franchiseeShare), 0.0) AS total_franchisee_share,
            COALESCE(SUM(amountReceived), 0.0) AS cash_received
        FROM v_invoice_clean
        WHERE fy = %s
    """, [fy_norm])
    inv_stats = cursor.fetchone() or {}

    cursor.execute("""
        SELECT 
            COALESCE(SUM(amount), 0.0) AS total_expenditure,
            COALESCE(SUM(CASE WHEN LOWER(expenses) LIKE '%%salaries%%' OR LOWER(expenses) LIKE '%%salary%%' OR LOWER(particulars) LIKE '%%salary%%' THEN amount ELSE 0.0 END), 0.0) AS salary_in_exp,
            COALESCE(SUM(CASE WHEN NOT (LOWER(expenses) LIKE '%%salaries%%' OR LOWER(expenses) LIKE '%%salary%%' OR LOWER(particulars) LIKE '%%salary%%') THEN amount ELSE 0.0 END), 0.0) AS non_salary_exp
        FROM expenditure
        WHERE is_deleted = 0
          AND billDate BETWEEN %s AND %s
    """, [start_date, end_date])
    exp_stats = cursor.fetchone() or {}

    cursor.execute("SELECT COALESCE(SUM(baseSalary), 0.0) * 12 AS annual_bd_salary FROM bd_agents WHERE status = 'Active'")
    sal_row = cursor.fetchone() or {}
    annual_payroll_base = float(sal_row.get('annual_bd_salary') or 0.0)

    opex = float(exp_stats.get('non_salary_exp') or 0.0)
    sal = float(exp_stats.get('salary_in_exp') or 0.0)
    if sal <= 0 and annual_payroll_base > 0:
        sal = annual_payroll_base

    w = calculate_waterfall(
        revenue=float(inv_stats.get('revenue_ex_gst') or 0.0),
        our_share=float(inv_stats.get('total_our_share') or 0.0),
        franchisee_share=float(inv_stats.get('total_franchisee_share') or 0.0),
        operating_expenses=opex,
        salary=sal,
        our_share_revenue_rows=float(inv_stats.get('our_share_rev') or 0.0),
        franchisee_share_revenue_rows=float(inv_stats.get('franchisee_share_rev') or 0.0),
        cash_received=float(inv_stats.get('cash_received') or 0.0),
        total_bill_amt=float(inv_stats.get('billed_incl_gst') or 0.0)
    )

    before_obj = {
        'success': True,
        'fy': fy_norm,
        'period': {'start_date': start_date, 'end_date': end_date},
        'revenue': w['revenue'],
        'billed_incl_gst': w['billed_incl_gst'],
        'gst': w['gst'],
        'our_share': w['our_share'],
        'our_share_revenue_rows': w['our_share_revenue_rows'],
        'our_share_residual_rows': w['our_share_residual_rows'],
        'franchisee_share': w['franchisee_share'],
        'unallocated': w['unallocated'],
        'cash_received': w['cash_received'],
        'expenses': {
            'expenditure': opex,
            'salaries': sal,
            'total': round(opex + sal, 2),
            'note': 'Reported separately per decision A3. Verify potential overlap with payroll ledger.'
        },
        'net': w['net'],
        'tax': w['tax'],
        'surplus': w['surplus'],
        'margin_pct': w['margin_pct'],
        'invoices_count': int(inv_stats.get('total_invoices') or 0),
        'revenue_invoices_count': int(inv_stats.get('revenue_invoices') or 0),
        'data_version': 2,
        'as_of': '2026-10-23T10:00:00+05:30'
    }

    clean_data = clean(before_obj)
    key = f'finance_summary_{fy}'
    with open(os.path.join(before_dir, f'{key}.json'), 'w', encoding='utf-8') as f:
        json.dump(clean_data, f, sort_keys=True, default=str)
    summary[key] = {
        'sha': hashlib.sha256(json.dumps(clean_data, sort_keys=True, default=str).encode()).hexdigest()[:16],
        **summarize(clean_data)
    }
    print(f"Captured before {key}:", summary[key])

with open(summary_file, 'w') as f:
    json.dump(summary, f, indent=2)

print("\nSuccessfully updated before baseline with finance_summary endpoints!")
conn.close()
