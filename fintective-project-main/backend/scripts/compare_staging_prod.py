"""
backend/scripts/compare_staging_prod.py
Verifies that staging totals equal prod totals for FY 2026-27:
- Invoice count
- Revenue ex-GST
- Our share
- Billed incl GST
Counts and totals only, NO NAMES.
"""

import sys, os
import pymysql
from dotenv import load_dotenv

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from scripts.db_guard import get_db_connection, add_db_safety_args
import argparse

parser = argparse.ArgumentParser()
add_db_safety_args(parser)
args = parser.parse_args()

conn_staging, env_label, db_name = get_db_connection(args)
cur_staging = conn_staging.cursor()

# Get staging totals
cur_staging.execute("""
    SELECT 
        COUNT(*) as total_invoices,
        SUM(CASE WHEN is_revenue = 1 THEN 1 ELSE 0 END) as rev_inv_cnt,
        COALESCE(SUM(CASE WHEN is_revenue = 1 THEN rev_ex_gst ELSE 0.0 END), 0.0) as rev_ex_gst,
        COALESCE(SUM(CASE WHEN is_revenue = 1 THEN totalBillAmt ELSE 0.0 END), 0.0) as billed_incl_gst,
        COALESCE(SUM(CASE WHEN is_revenue = 1 THEN ourShare ELSE 0.0 END), 0.0) as our_share_rev,
        COALESCE(SUM(ourShare), 0.0) as our_share_total,
        COALESCE(SUM(CASE WHEN is_revenue = 1 THEN franchiseeShare ELSE 0.0 END), 0.0) as franchisee_share_rev
    FROM v_invoice_clean
    WHERE fy = '2026-2027'
""")
staging_tot = cur_staging.fetchone()

# Connect read-only to prod to verify
load_dotenv(os.path.join(BACKEND_DIR, '.env'), override=True)
conn_prod = pymysql.connect(
    host=os.getenv('DB_HOST'),
    port=int(os.getenv('DB_PORT', 3306)),
    user=os.getenv('DB_USER'),
    password=os.getenv('DB_PASSWORD'),
    database='crm_db',
    ssl={'ssl': {}} if os.getenv('DB_SSL', 'false').lower() in ('true', '1') else None,
    cursorclass=pymysql.cursors.DictCursor
)
cur_prod = conn_prod.cursor()
cur_prod.execute("""
    SELECT 
        COUNT(*) as total_invoices,
        SUM(CASE WHEN is_revenue = 1 THEN 1 ELSE 0 END) as rev_inv_cnt,
        COALESCE(SUM(CASE WHEN is_revenue = 1 THEN rev_ex_gst ELSE 0.0 END), 0.0) as rev_ex_gst,
        COALESCE(SUM(CASE WHEN is_revenue = 1 THEN totalBillAmt ELSE 0.0 END), 0.0) as billed_incl_gst,
        COALESCE(SUM(CASE WHEN is_revenue = 1 THEN ourShare ELSE 0.0 END), 0.0) as our_share_rev,
        COALESCE(SUM(ourShare), 0.0) as our_share_total,
        COALESCE(SUM(CASE WHEN is_revenue = 1 THEN franchiseeShare ELSE 0.0 END), 0.0) as franchisee_share_rev
    FROM v_invoice_clean
    WHERE fy = '2026-2027'
""")
prod_tot = cur_prod.fetchone()

print("--- PROD VS STAGING RECONCILIATION FOR FY 2026-27 ---")
fields = [
    ('Total Invoices', 'total_invoices', False),
    ('Revenue Invoices', 'rev_inv_cnt', False),
    ('Billed incl GST', 'billed_incl_gst', True),
    ('Revenue ex-GST', 'rev_ex_gst', True),
    ('Our Share (Rev Rows)', 'our_share_rev', True),
    ('Our Share (Total)', 'our_share_total', True),
    ('Franchisee Share (Rev Rows)', 'franchisee_share_rev', True),
]

all_match = True
for label, key, is_curr in fields:
    s_val = staging_tot[key]
    p_val = prod_tot[key]
    diff = abs(float(s_val) - float(p_val))
    match = (diff < 0.01)
    if not match:
        all_match = False
    status = "MATCH" if match else f"DIFF: {diff}"
    if is_curr:
        print(f"{label:<28}: Staging=Rs {float(s_val):>14,.2f} | Prod=Rs {float(p_val):>14,.2f} | {status}")
    else:
        print(f"{label:<28}: Staging={s_val:>17} | Prod={p_val:>17} | {status}")

print(f"\nFinal Verdict: {'100% IDENTICAL' if all_match else 'DISCREPANCY DETECTED'}")

conn_staging.close()
conn_prod.close()
