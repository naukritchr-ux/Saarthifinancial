"""
backend/scripts/inspect_step1_review.py
Read-only inspection script for Step 1 Review questions.
Uses db_guard with default --env staging.
Prints counts and totals only, NO NAMES.
"""

import sys
import os
import argparse
from datetime import date
from collections import defaultdict

# Add backend directory to sys.path
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from scripts.db_guard import get_db_connection, add_db_safety_args
from finance_rules import normalize_fy, fy_to_date_range, calculate_waterfall

def inspect_q1(conn):
    print("=" * 60)
    print("QUESTION 1: Payroll coverage and origins")
    print("=" * 60)
    cursor = conn.cursor()
    
    # 1. Check bd_agents base salary
    cursor.execute("SELECT COUNT(*) as cnt, COALESCE(SUM(baseSalary), 0.0) as sum_base, COALESCE(SUM(baseSalary), 0.0) * 12 AS annual_bd_salary FROM bd_agents WHERE status = 'Active'")
    bd_res = cursor.fetchone()
    print(f"Active bd_agents count: {bd_res['cnt']}, Sum baseSalary: {bd_res['sum_base']}, Annual (x12): {bd_res['annual_bd_salary']}")
    
    # 2. Check payroll_records table
    cursor.execute("SHOW TABLES LIKE 'payroll_records'")
    has_pr = cursor.fetchone()
    if has_pr:
        cursor.execute("SELECT financial_year, COUNT(*) as cnt, MIN(date) as min_date, MAX(date) as max_date, SUM(ctc_amount) as total_ctc FROM payroll_records GROUP BY financial_year")
        pr_fys = cursor.fetchall()
        print("\npayroll_records by financial_year:")
        for r in pr_fys:
            print(f"  FY: {r['financial_year']} | Count: {r['cnt']} | Date range: {r['min_date']} to {r['max_date']} | Total CTC: Rs {r['total_ctc']:,.2f}")
            
        # By month for all FYs
        cursor.execute("""
            SELECT financial_year, DATE_FORMAT(date, '%%Y-%%m') as ym, COUNT(*) as cnt, MIN(date) as sample_date, SUM(ctc_amount) as total_ctc
            FROM payroll_records
            GROUP BY financial_year, ym
            ORDER BY ym
        """)
        pr_months = cursor.fetchall()
        print("\npayroll_records by month:")
        for r in pr_months:
            print(f"  Month: {r['ym']} (FY {r['financial_year']}) | Rows: {r['cnt']} | Sample Date: {r['sample_date']} | Total CTC: Rs {r['total_ctc']:,.2f}")
    else:
        print("payroll_records table does not exist!")

    # 3. Check expenditure table for salary entries
    cursor.execute("""
        SELECT 
            CASE 
                WHEN billDate BETWEEN '2024-04-01' AND '2025-03-31' THEN '2024-2025'
                WHEN billDate BETWEEN '2025-04-01' AND '2026-03-31' THEN '2025-2026'
                WHEN billDate BETWEEN '2026-04-01' AND '2027-03-31' THEN '2026-2027'
                ELSE 'Other'
            END as fy,
            COUNT(*) as total_rows,
            SUM(CASE WHEN LOWER(expenses) LIKE '%%salaries%%' OR LOWER(expenses) LIKE '%%salary%%' OR LOWER(particulars) LIKE '%%salary%%' THEN 1 ELSE 0 END) as sal_rows,
            COALESCE(SUM(CASE WHEN LOWER(expenses) LIKE '%%salaries%%' OR LOWER(expenses) LIKE '%%salary%%' OR LOWER(particulars) LIKE '%%salary%%' THEN amount ELSE 0 END), 0) as sal_amount
        FROM expenditure
        WHERE is_deleted = 0
        GROUP BY fy
    """)
    exp_fys = cursor.fetchall()
    print("\nexpenditure table salary entries by FY:")
    for r in exp_fys:
        print(f"  FY: {r['fy']} | Total rows: {r['total_rows']} | Salary rows: {r['sal_rows']} | Salary amount: Rs {r['sal_amount']:,.2f}")

    # 4. Check cache files in backend
    cache_dir = os.path.join(BACKEND_DIR, 'cache')
    print(f"\nChecking cache directory ({cache_dir}):")
    if os.path.exists(cache_dir):
        files = os.listdir(cache_dir)
        print(f"  Found {len(files)} files: {files[:10]}")
    else:
        print("  cache directory does not exist.")

def inspect_q2(conn):
    print("\n" + "=" * 60)
    print("QUESTION 2: Unallocated invoices in FY24-25 and FY25-26 vs FY26-27")
    print("=" * 60)
    cursor = conn.cursor()
    for fy in ['2024-2025', '2025-2026', '2026-2027']:
        # Inspect invoices in v_invoice_clean
        cursor.execute("""
            SELECT 
                COUNT(*) as total_rev_inv,
                SUM(rev_ex_gst) as total_rev_ex_gst,
                SUM(ourShare) as sum_our_share,
                SUM(franchiseeShare) as sum_franchisee_share,
                SUM(rev_ex_gst - (ourShare + franchiseeShare)) as sum_unallocated,
                SUM(CASE WHEN (ourShare + franchiseeShare) = 0 THEN 1 ELSE 0 END) as zero_share_count,
                SUM(CASE WHEN (ourShare + franchiseeShare) = 0 THEN rev_ex_gst ELSE 0 END) as zero_share_rev,
                SUM(CASE WHEN franchiseeShare = 0 AND ourShare > 0 THEN 1 ELSE 0 END) as zero_fshare_count,
                SUM(CASE WHEN franchiseeShare = 0 AND ourShare > 0 THEN rev_ex_gst ELSE 0 END) as zero_fshare_rev,
                SUM(CASE WHEN ourShare = 0 AND franchiseeShare > 0 THEN 1 ELSE 0 END) as zero_ourshare_count,
                SUM(CASE WHEN ourShare = 0 AND franchiseeShare > 0 THEN rev_ex_gst ELSE 0 END) as zero_ourshare_rev
            FROM v_invoice_clean
            WHERE fy = %s AND is_revenue = 1
        """, [fy])
        row = cursor.fetchone()
        print(f"\nFY {fy}:")
        print(f"  Total rev invoices: {row['total_rev_inv']}")
        print(f"  Total rev ex-GST: Rs {row['total_rev_ex_gst']:,.2f}")
        print(f"  Sum ourShare: Rs {row['sum_our_share']:,.2f}")
        print(f"  Sum franchiseeShare: Rs {row['sum_franchisee_share']:,.2f}")
        print(f"  Sum Unallocated (diff): Rs {row['sum_unallocated']:,.2f}")
        print(f"  Invoices with ourShare + franchiseeShare == 0: count={row['zero_share_count']}, rev=Rs {row['zero_share_rev']:,.2f}")
        print(f"  Invoices with ourShare > 0, franchiseeShare == 0: count={row['zero_fshare_count']}, rev=Rs {row['zero_fshare_rev']:,.2f}")
        print(f"  Invoices with franchiseeShare > 0, ourShare == 0: count={row['zero_ourshare_count']}, rev=Rs {row['zero_ourshare_rev']:,.2f}")

        # Breakdown of unallocated invoices by info_type, category, or characteristics
        cursor.execute("""
            SELECT 
                info_type,
                COUNT(*) as cnt,
                SUM(rev_ex_gst) as sum_rev,
                SUM(ourShare) as sum_our,
                SUM(franchiseeShare) as sum_f,
                SUM(rev_ex_gst - (ourShare + franchiseeShare)) as unallocated_portion
            FROM v_invoice_clean
            WHERE fy = %s AND is_revenue = 1
            GROUP BY info_type
        """, [fy])
        info_types = cursor.fetchall()
        print(f"  By info_type:")
        for it in info_types:
            print(f"    info_type: '{it['info_type']}' | Cnt: {it['cnt']} | Rev: Rs {it['sum_rev']:,.2f} | Our: Rs {it['sum_our']:,.2f} | F: Rs {it['sum_f']:,.2f} | Unallocated: Rs {it['unallocated_portion']:,.2f}")

def inspect_q3(conn):
    print("\n" + "=" * 60)
    print("QUESTION 3: Comparison with CRM figures")
    print("Target CRM figures: Billed incl GST 6.21 Cr, Revenue ex-GST 5.27 Cr, Franchisee share 3.80 Cr, Our share 1.47 Cr")
    print("=" * 60)
    cursor = conn.cursor()
    
    # 1. All rows in v_invoice_clean for 2026-2027 (including is_revenue = 0)
    cursor.execute("""
        SELECT 
            is_revenue,
            COUNT(*) as cnt,
            SUM(totalBillAmt) as billed_incl_gst,
            SUM(rev_ex_gst) as rev_ex_gst,
            SUM(franchiseeShare) as f_share,
            SUM(ourShare) as our_share
        FROM v_invoice_clean
        WHERE fy = '2026-2027'
        GROUP BY is_revenue
    """)
    v_inv_rows = cursor.fetchall()
    print("\nv_invoice_clean FY 2026-2027 by is_revenue:")
    for r in v_inv_rows:
        print(f"  is_revenue={r['is_revenue']} | Count: {r['cnt']} | Billed: Rs {r['billed_incl_gst']:,.2f} | Rev ex-GST: Rs {r['rev_ex_gst']:,.2f} | F-share: Rs {r['f_share']:,.2f} | Our-share: Rs {r['our_share']:,.2f}")

    # 2. Raw invoice table for FY 2026-2027
    cursor.execute("""
        SELECT 
            COUNT(*) as total_raw,
            SUM(totalBillAmt) as total_billed,
            SUM(serviceCharges) as total_service_charges
        FROM invoice
        WHERE billDate BETWEEN '2026-04-01' AND '2027-03-31'
    """)
    raw_inv = cursor.fetchone()
    print(f"\nRaw invoice table (billDate 2026-04-01 to 2027-03-31):")
    print(f"  Count: {raw_inv['total_raw']} | Billed: Rs {raw_inv['total_billed']:,.2f} | Service Charges: Rs {raw_inv['total_service_charges']:,.2f}")

    # 3. Check what v_invoice_clean view definition does
    cursor.execute("SHOW CREATE VIEW v_invoice_clean")
    view_def = cursor.fetchone()
    print("\nView definition snippet:")
    print("  " + view_def['Create View'][:400] + "...")

    # 4. Check credit notes or cancelled invoices
    cursor.execute("""
        SELECT 
            COUNT(*) as cnt,
            SUM(totalBillAmt) as billed,
            SUM(serviceCharges) as charges
        FROM invoice
        WHERE billDate BETWEEN '2026-04-01' AND '2027-03-31'
          AND (LOWER(particulars) LIKE '%%credit%%' OR LOWER(particulars) LIKE '%%cancel%%' OR LOWER(billNo) LIKE '%%cn%%' OR info = 'C' OR info = 'Credit Note')
    """)
    cn = cursor.fetchone()
    print(f"\nCredit Note / Cancelled filter in raw invoice:")
    print(f"  Count: {cn['cnt']} | Billed: Rs {cn['billed']:,.2f} | Charges: Rs {cn['charges']:,.2f}")

    # 5. Check date range differences (e.g. up to today vs full year)
    today_date = date.today()
    cursor.execute("""
        SELECT 
            COUNT(*) as cnt,
            SUM(totalBillAmt) as billed,
            SUM(rev_ex_gst) as rev,
            SUM(franchiseeShare) as f_share,
            SUM(ourShare) as our_share
        FROM v_invoice_clean
        WHERE is_revenue = 1 AND billDate BETWEEN '2026-04-01' AND %s
    """, [today_date])
    to_date_stats = cursor.fetchone()
    print(f"\nv_invoice_clean up to today ({today_date}):")
    print(f"  Count: {to_date_stats['cnt']} | Billed: Rs {to_date_stats['billed']:,.2f} | Rev: Rs {to_date_stats['rev']:,.2f} | F-share: Rs {to_date_stats['f_share']:,.2f} | Our-share: Rs {to_date_stats['our_share']:,.2f}")

    # 6. Check full year v_invoice_clean + other tables
    cursor.execute("""
        SELECT 
            SUM(totalBillAmt) as billed,
            SUM(rev_ex_gst) as rev,
            SUM(franchiseeShare) as f_share,
            SUM(ourShare) as our_share
        FROM v_invoice_clean
        WHERE fy = '2026-2027'
    """)
    all_v = cursor.fetchone()
    print(f"\nv_invoice_clean ALL (revenue + non-revenue) FY 2026-2027:")
    print(f"  Billed: Rs {all_v['billed']:,.2f} | Rev: Rs {all_v['rev']:,.2f} | F-share: Rs {all_v['f_share']:,.2f} | Our-share: Rs {all_v['our_share']:,.2f}")

def inspect_q4(conn):
    print("\n" + "=" * 60)
    print("QUESTION 4: Actual vs Projected Salaries for FY 2026-27")
    today_date = date.today()
    print(f"Today's date: {today_date}")
    print("=" * 60)
    cursor = conn.cursor()
    cursor.execute("""
        SELECT 
            DATE_FORMAT(date, '%%Y-%%m') as month_ym,
            MIN(date) as min_date,
            MAX(date) as max_date,
            COUNT(*) as count_records,
            SUM(ctc_amount) as total_ctc,
            CASE WHEN MAX(date) <= %s THEN 'ACTUAL' ELSE 'PROJECTED' END as category
        FROM payroll_records
        WHERE financial_year = '2026-2027'
        GROUP BY month_ym
        ORDER BY month_ym
    """, [today_date])
    rows = cursor.fetchall()
    for r in rows:
        print(f"Month: {r['month_ym']} | Min Date: {r['min_date']} | Max Date: {r['max_date']} | Records: {r['count_records']} | Total CTC: Rs {r['total_ctc']:,.2f} | Category: {r['category']}")

def inspect_q6(conn):
    print("\n" + "=" * 60)
    print("QUESTION 6: Reconciliation with Cost of Performance FY 2026-27 (-Rs 1.18 Cr)")
    print("=" * 60)
    cursor = conn.cursor()
    # Check cost performance controller logic or run its calculation
    # In cost_performance_controller.py, what is the FY 2026-2027 net/profit?
    # Let's inspect the expenditure, salaries, franchisee share, revenue used there.

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    add_db_safety_args(parser)
    args = parser.parse_args()
    conn, host, db = get_db_connection(args)
    print(f"Connected to {host} / {db} (env: {args.env})\n")
    inspect_q1(conn)
    inspect_q2(conn)
    inspect_q3(conn)
    inspect_q4(conn)
    inspect_q6(conn)
    conn.close()
