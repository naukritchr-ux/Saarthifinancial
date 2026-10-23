"""
backend/scripts/run_all_step1_checks.py
Comprehensive inspection for all 6 review items for Step 1.
Operates against staging database (crm_db_staging).
Counts and totals only, NO NAMES.
"""

import sys
import os
import json
from datetime import date
from collections import defaultdict

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from scripts.db_guard import get_db_connection, add_db_safety_args
import argparse

parser = argparse.ArgumentParser()
add_db_safety_args(parser)
args = parser.parse_args(['--env', 'staging'])

conn, host, db_name = get_db_connection(args)
print(f"Connected to {host} / {db_name} (env: {args.env})\n")
cursor = conn.cursor()

# =========================================================================
# QUESTION 1
# =========================================================================
print("=" * 70)
print("ITEM 1: FY 2024-25 and FY 2025-26 Salaries (Rs 3,36,000) & Benchmark Origins")
print("=" * 70)
# Check bd_agents
cursor.execute("SELECT COUNT(*) as cnt, COALESCE(SUM(baseSalary), 0.0) as sum_base, COALESCE(SUM(baseSalary), 0.0) * 12 AS annual_bd_salary FROM bd_agents WHERE status = 'Active'")
bd_row = cursor.fetchone()
print(f"1a. Active bd_agents count: {bd_row['cnt']}, Monthly base sum: Rs {bd_row['sum_base']:,.2f}, Annual (x12): Rs {bd_row['annual_bd_salary']:,.2f}")

# Check payroll_records by FY
cursor.execute("SELECT financial_year, COUNT(*) as cnt, MIN(date) as min_date, MAX(date) as max_date, SUM(ctc_amount) as total_ctc FROM payroll_records GROUP BY financial_year")
pr_fys = cursor.fetchall()
print("\n1b. payroll_records table coverage by FY:")
for r in pr_fys:
    print(f"   FY: {r['financial_year']} | Count: {r['cnt']} records | Date range: {r['min_date']} to {r['max_date']} | Total CTC: Rs {r['total_ctc']:,.2f}")

# Check expenditure table
cursor.execute("""
    SELECT 
        CASE 
            WHEN billDate BETWEEN '2024-04-01' AND '2025-03-31' THEN '2024-2025'
            WHEN billDate BETWEEN '2025-04-01' AND '2026-03-31' THEN '2025-2026'
            WHEN billDate BETWEEN '2026-04-01' AND '2027-03-31' THEN '2026-2027'
            ELSE 'Other'
        END as fy,
        COUNT(*) as total_rows,
        SUM(CASE WHEN LOWER(expenses) LIKE '%salaries%' OR LOWER(expenses) LIKE '%salary%' OR LOWER(particulars) LIKE '%salary%' THEN 1 ELSE 0 END) as sal_rows,
        COALESCE(SUM(CASE WHEN LOWER(expenses) LIKE '%salaries%' OR LOWER(expenses) LIKE '%salary%' OR LOWER(particulars) LIKE '%salary%' THEN amount ELSE 0 END), 0) as sal_amount
    FROM expenditure
    WHERE is_deleted = 0
    GROUP BY fy
""")
exp_fys = cursor.fetchall()
print("\n1c. expenditure table salary records by FY:")
for r in exp_fys:
    print(f"   FY: {r['fy']} | Total rows: {r['total_rows']} | Salary rows: {r['sal_rows']} | Salary amount: Rs {r['sal_amount']:,.2f}")

# Check cache directory
cache_dir = os.path.join(BACKEND_DIR, 'cache')
cache_files = os.listdir(cache_dir) if os.path.exists(cache_dir) else []
print(f"\n1d. backend/cache files count: {len(cache_files)}")

# Check benchmark numbers origin from test_acceptance_table_waterfalls:
# rev = 80,286,097.91 (FY24-25), 82,634,443.04 (FY25-26), 51,119,354.93 (FY26-27)
# Let's check v_invoice_clean totals for those FYs
cursor.execute("""
    SELECT 
        fy,
        COUNT(*) as total_invoices,
        SUM(CASE WHEN is_revenue = 1 THEN 1 ELSE 0 END) as rev_inv_cnt,
        SUM(CASE WHEN is_revenue = 1 THEN rev_ex_gst ELSE 0 END) as rev_ex_gst,
        SUM(CASE WHEN is_revenue = 1 THEN totalBillAmt ELSE 0 END) as billed_incl_gst,
        SUM(ourShare) as total_our_share,
        SUM(CASE WHEN is_revenue = 1 THEN ourShare ELSE 0 END) as our_share_rev,
        SUM(franchiseeShare) as total_franchisee_share
    FROM v_invoice_clean
    GROUP BY fy
    ORDER BY fy
""")
v_inv_by_fy = cursor.fetchall()
print("\n1e. Actual v_invoice_clean totals vs benchmark numbers in test_acceptance_table_waterfalls:")
for r in v_inv_by_fy:
    print(f"   FY {r['fy']}:")
    print(f"      rev_ex_gst: Rs {r['rev_ex_gst']:,.2f} | total_our_share: Rs {r['total_our_share']:,.2f} | our_share_rev: Rs {r['our_share_rev']:,.2f}")

# =========================================================================
# QUESTION 2
# =========================================================================
print("\n" + "=" * 70)
print("ITEM 2: Unallocated Invoices Analysis (FY24-25 & FY25-26 vs FY26-27)")
print("=" * 70)
for fy in ['2024-2025', '2025-2026', '2026-2027']:
    cursor.execute("""
        SELECT 
            COUNT(*) as total_rev_inv,
            SUM(rev_ex_gst) as rev_ex_gst,
            SUM(ourShare) as our_share_sum,
            SUM(franchiseeShare) as f_share_sum,
            SUM(rev_ex_gst - (ourShare + franchiseeShare)) as unallocated_sum,
            SUM(CASE WHEN ABS(rev_ex_gst - (ourShare + franchiseeShare)) > 1.0 THEN 1 ELSE 0 END) as unallocated_inv_count,
            SUM(CASE WHEN (ourShare + franchiseeShare) = 0 THEN 1 ELSE 0 END) as zero_both_count,
            SUM(CASE WHEN (ourShare + franchiseeShare) = 0 THEN rev_ex_gst ELSE 0 END) as zero_both_rev,
            SUM(CASE WHEN franchiseeShare = 0 AND ourShare > 0 THEN 1 ELSE 0 END) as zero_f_count,
            SUM(CASE WHEN franchiseeShare = 0 AND ourShare > 0 THEN rev_ex_gst ELSE 0 END) as zero_f_rev
        FROM v_invoice_clean
        WHERE fy = %s AND is_revenue = 1
    """, [fy])
    r = cursor.fetchone()
    print(f"\nFY {fy}:")
    print(f"   Rev ex-GST: Rs {r['rev_ex_gst']:,.2f}")
    print(f"   Our Share (rev rows): Rs {r['our_share_sum']:,.2f}")
    print(f"   Franchisee Share (rev rows): Rs {r['f_share_sum']:,.2f}")
    print(f"   Unallocated (gap): Rs {r['unallocated_sum']:,.2f}")
    print(f"   Invoices with discrepancy > Rs 1: {r['unallocated_inv_count']} of {r['total_rev_inv']}")
    print(f"   Invoices with BOTH shares = 0 (completely unallocated): {r['zero_both_count']} (Rev: Rs {r['zero_both_rev']:,.2f})")

    # What do these unallocated invoices look like? (characteristics, missing franchisee, etc.)
    cursor.execute("""
        SELECT 
            CASE 
                WHEN franchiseName IS NULL OR TRIM(franchiseName) = '' OR LOWER(franchiseName) IN ('-', 'none', 'n/a', 'null') THEN 'Missing Franchisee Name'
                WHEN franchiseeShare = 0 AND ourShare = 0 THEN 'Both Shares Zero'
                WHEN ourShare = 0 THEN 'Our Share Zero Only'
                WHEN franchiseeShare = 0 THEN 'Franchisee Share Zero Only'
                ELSE 'Partial Rounding / Split Discrepancy'
            END as pattern,
            COUNT(*) as inv_count,
            SUM(rev_ex_gst) as total_rev,
            SUM(ourShare) as sum_our,
            SUM(franchiseeShare) as sum_f,
            SUM(rev_ex_gst - (ourShare + franchiseeShare)) as sum_unallocated
        FROM v_invoice_clean
        WHERE fy = %s AND is_revenue = 1 AND ABS(rev_ex_gst - (ourShare + franchiseeShare)) > 1.0
        GROUP BY pattern
    """, [fy])
    patterns = cursor.fetchall()
    print("   Breakdown of unallocated invoices by pattern:")
    for p in patterns:
        print(f"      Pattern: {p['pattern']:<35} | Count: {p['inv_count']:>4} | Rev: Rs {p['total_rev']:>12,.2f} | Unallocated: Rs {p['sum_unallocated']:>12,.2f}")

# =========================================================================
# QUESTION 3
# =========================================================================
print("\n" + "=" * 70)
print("ITEM 3: Comparison of Endpoint vs CRM-based Target Figures (FY 2026-27)")
print("CRM Target: Billed 6.21 Cr | Rev ex-GST 5.27 Cr | Franchisee Share 3.80 Cr | Our Share 1.47 Cr")
print("=" * 70)

# 1. Endpoint current output
cursor.execute("""
    SELECT 
        SUM(totalBillAmt) as billed_incl_gst,
        SUM(rev_ex_gst) as rev_ex_gst,
        SUM(franchiseeShare) as f_share,
        SUM(ourShare) as our_share
    FROM v_invoice_clean
    WHERE fy = '2026-2027' AND is_revenue = 1
""")
ep = cursor.fetchone()
print(f"Endpoint (v_invoice_clean is_revenue=1):")
print(f"   Billed: Rs {float(ep['billed_incl_gst'] or 0):,.2f} ({float(ep['billed_incl_gst'] or 0)/1e7:.2f} Cr)")
print(f"   Rev ex-GST: Rs {float(ep['rev_ex_gst'] or 0):,.2f} ({float(ep['rev_ex_gst'] or 0)/1e7:.2f} Cr)")
print(f"   Franchisee Share: Rs {float(ep['f_share'] or 0):,.2f} ({float(ep['f_share'] or 0)/1e7:.2f} Cr)")
print(f"   Our Share: Rs {float(ep['our_share'] or 0):,.2f} ({float(ep['our_share'] or 0)/1e7:.2f} Cr)")

# 2. All v_invoice_clean (including non-revenue / CNs / RV / LEGAL)
cursor.execute("""
    SELECT 
        SUM(totalBillAmt) as billed_incl_gst,
        SUM(rev_ex_gst) as rev_ex_gst,
        SUM(franchiseeShare) as f_share,
        SUM(ourShare) as our_share
    FROM v_invoice_clean
    WHERE fy = '2026-2027'
""")
all_vic = cursor.fetchone()
print(f"\nv_invoice_clean ALL (including non-revenue):")
print(f"   Billed: Rs {float(all_vic['billed_incl_gst'] or 0):,.2f} ({float(all_vic['billed_incl_gst'] or 0)/1e7:.2f} Cr)")
print(f"   Rev ex-GST: Rs {float(all_vic['rev_ex_gst'] or 0):,.2f} ({float(all_vic['rev_ex_gst'] or 0)/1e7:.2f} Cr)")
print(f"   Franchisee Share: Rs {float(all_vic['f_share'] or 0):,.2f} ({float(all_vic['f_share'] or 0)/1e7:.2f} Cr)")
print(f"   Our Share: Rs {float(all_vic['our_share'] or 0):,.2f} ({float(all_vic['our_share'] or 0)/1e7:.2f} Cr)")

# 3. Raw invoice table for FY 2026-2027
cursor.execute("""
    SELECT 
        COUNT(*) as cnt,
        SUM(totalBillAmt) as billed_incl_gst,
        SUM(COALESCE(NULLIF(serviceCharges, 0), ROUND(totalBillAmt/1.18, 2))) as rev_ex_gst,
        SUM(franchiseeShare) as f_share,
        SUM(ourShare) as our_share
    FROM invoice
    WHERE billDate BETWEEN '2026-04-01' AND '2027-03-31'
""")
raw_inv = cursor.fetchone()
print(f"\nRaw invoice table (all billDate in 2026-2027, before colliding bills filter):")
print(f"   Count: {raw_inv['cnt']}")
print(f"   Billed: Rs {float(raw_inv['billed_incl_gst'] or 0):,.2f} ({float(raw_inv['billed_incl_gst'] or 0)/1e7:.2f} Cr)")
print(f"   Rev ex-GST: Rs {float(raw_inv['rev_ex_gst'] or 0):,.2f} ({float(raw_inv['rev_ex_gst'] or 0)/1e7:.2f} Cr)")
print(f"   Franchisee Share: Rs {float(raw_inv['f_share'] or 0):,.2f} ({float(raw_inv['f_share'] or 0)/1e7:.2f} Cr)")
print(f"   Our Share: Rs {float(raw_inv['our_share'] or 0):,.2f} ({float(raw_inv['our_share'] or 0)/1e7:.2f} Cr)")

# 4. Check colliding bills excluded from invoice
cursor.execute("""
    SELECT 
        COUNT(*) as cnt,
        SUM(totalBillAmt) as billed_incl_gst,
        SUM(COALESCE(NULLIF(serviceCharges, 0), ROUND(totalBillAmt/1.18, 2))) as rev_ex_gst,
        SUM(franchiseeShare) as f_share,
        SUM(ourShare) as our_share
    FROM invoice
    WHERE billDate BETWEEN '2026-04-01' AND '2027-03-31'
      AND billNumber IN (SELECT bill_no FROM v_colliding_bills)
""")
col_inv = cursor.fetchone()
print(f"\nColliding bills excluded in v_invoice_clean for FY 2026-2027:")
print(f"   Count: {col_inv['cnt']} | Billed: Rs {col_inv['billed_incl_gst']:,.2f} | Rev: Rs {col_inv['rev_ex_gst']:,.2f} | F-share: Rs {col_inv['f_share']:,.2f} | Our-share: Rs {col_inv['our_share']:,.2f}")

# 5. Check Non-revenue (CN, LEGAL-CN, RV, LEGAL) in v_invoice_clean
cursor.execute("""
    SELECT 
        info,
        COUNT(*) as cnt,
        SUM(totalBillAmt) as billed,
        SUM(rev_ex_gst) as rev,
        SUM(franchiseeShare) as f_share,
        SUM(ourShare) as our_share
    FROM v_invoice_clean
    WHERE fy = '2026-2027' AND is_revenue = 0
    GROUP BY info
""")
non_revs = cursor.fetchall()
print("\nNon-revenue rows in v_invoice_clean (fy=2026-2027, is_revenue=0):")
for nr in non_revs:
    print(f"   Info: {nr['info']} | Count: {nr['cnt']} | Billed: Rs {nr['billed']:,.2f} | Rev: Rs {nr['rev']:,.2f} | F-share: Rs {nr['f_share']:,.2f} | Our: Rs {nr['our_share']:,.2f}")

# 6. Check unbilled closed enquiries in FY 2026-2027
cursor.execute("""
    SELECT 
        COUNT(*) as cnt,
        SUM(bill_amount) as sum_bill_amount
    FROM enquiries
    WHERE bill_date BETWEEN '2026-04-01' AND '2027-03-31'
      AND (bill_no IS NULL OR TRIM(bill_no) = '' OR bill_no NOT IN (SELECT billNumber FROM invoice WHERE billNumber IS NOT NULL))
      AND LOWER(enquiryStatus) IN ('closed', 'offered_and_accepted')
""")
unbilled_enq = cursor.fetchone()
print(f"\nUnbilled Closed/Offered Enquiries in FY 2026-2027: count={unbilled_enq['cnt']}, amount=Rs {unbilled_enq['sum_bill_amount']:,.2f}")

# =========================================================================
# QUESTION 4
# =========================================================================
print("\n" + "=" * 70)
print("ITEM 4: Payroll Months for FY 2026-27 (Actual vs Projected)")
today_date = date.today()
print(f"Reference Date: {today_date}")
print("=" * 70)
cursor.execute("""
    SELECT 
        DATE_FORMAT(date, '%Y-%m') as month_ym,
        MIN(date) as min_date,
        MAX(date) as max_date,
        COUNT(*) as record_count,
        SUM(ctc_amount) as month_ctc,
        CASE WHEN MAX(date) <= %s THEN 'ACTUAL' ELSE 'PROJECTED' END as classification
    FROM payroll_records
    WHERE financial_year = '2026-2027'
    GROUP BY month_ym
    ORDER BY month_ym
""", [today_date])
months = cursor.fetchall()
for m in months:
    is_oct = (m['month_ym'] == '2026-10')
    flag = " <-- OCTOBER 2026" if is_oct else ""
    print(f"Month: {m['month_ym']} | Date range: {m['min_date']} to {m['max_date']} | Count: {m['record_count']:>3} | Total: Rs {m['month_ctc']:>11,.2f} | Status: {m['classification']:<9}{flag}")

# =========================================================================
# QUESTION 6
# =========================================================================
print("\n" + "=" * 70)
print("ITEM 6: Reconciliation with Cost of Performance FY 2026-27 (-Rs 1.18 Cr)")
print("=" * 70)
# Let's inspect the baseline json file for cost_performance_2026-2027
cp_file = os.path.join(BACKEND_DIR, 'baselines', 'before', 'cost_performance_2026-2027.json')
if os.path.exists(cp_file):
    with open(cp_file, 'r', encoding='utf-8') as f:
        cp_data = json.load(f)
    rows = cp_data.get('rows', [])
    print(f"Cost of Performance rows count: {len(rows)}")
    sum_company_share = sum(r.get('company_share', 0.0) for r in rows)
    sum_franchisee_payout = sum(r.get('franchisee_payout', 0.0) for r in rows)
    sum_direct_cost = sum(r.get('direct_cost', 0.0) for r in rows)
    sum_overhead_share = sum(r.get('overheadShare', 0.0) for r in rows)
    sum_cost_of_execution = sum(r.get('costOfExecution', 0.0) for r in rows)
    sum_churn_cost = sum(r.get('churnCost', 0.0) for r in rows)
    sum_net_contribution = sum(r.get('netContribution', 0.0) for r in rows)
    sum_total_billed = sum(r.get('total_billed', 0.0) for r in rows)

    print(f"   Sum Total Billed:            Rs {sum_total_billed:>14,.2f}")
    print(f"   Sum Franchisee Payout:       Rs {sum_franchisee_payout:>14,.2f}")
    print(f"   Sum Company Share:           Rs {sum_company_share:>14,.2f}")
    print(f"   Sum Direct Cost (BD salary): Rs {sum_direct_cost:>14,.2f}")
    print(f"   Sum Overhead Share:          Rs {sum_overhead_share:>14,.2f}")
    print(f"   Sum Cost of Execution:       Rs {sum_cost_of_execution:>14,.2f}")
    print(f"   Sum Churn Cost (Credit Notes):Rs {sum_churn_cost:>13,.2f}")
    print(f"   TOTAL Net Contribution:      Rs {sum_net_contribution:>14,.2f}  (-Rs 1.18 Cr)")

conn.close()
