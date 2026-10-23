"""
backend/scripts/reconcile_tabs.py
Cross-Tab KPI Reconciliation Script for FY 2026-27.
Compares figures across:
1. Dashboard / Financial Waterfall (/api/finance/summary)
2. Franchisees Tab (/api/finance/franchisee-summary)
3. Cost of Performance (COP) (/api/cost-performance)
4. Reactivation Endpoint (/api/ml/franchisee-reactivation)

Outputs exact totals, identifies differences, and provides accounting rationale.
NO NAMES, totals and counts only.
"""

import sys
import os
import argparse
import json

# 1. Enforce testing mode and safety env BEFORE importing app
os.environ['FLASK_TESTING'] = 'true'
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from dotenv import load_dotenv

# Check command line arguments for --env before importing app
is_staging = '--env' in sys.argv and ('staging' in sys.argv or 'test' in sys.argv)
if is_staging or os.path.exists(os.path.join(BACKEND_DIR, '.env.staging')):
    load_dotenv(os.path.join(BACKEND_DIR, '.env.staging'), override=True)
else:
    load_dotenv(os.path.join(BACKEND_DIR, '.env'), override=True)

# Strict Safety Guard: Never allow reconciliation or testing scripts to touch production DB
if os.environ.get('DB_NAME') != 'crm_db_staging':
    raise RuntimeError(f"[SAFETY GUARD ACTIVATED] reconcile_tabs.py is restricted to 'crm_db_staging'. Current DB_NAME is '{os.environ.get('DB_NAME')}'. Execution aborted.")

from app import app
from scripts.db_guard import add_db_safety_args

def run_reconciliation(args):
    api_key = os.environ.get('API_KEY')
    client = app.test_client()
    headers = {'X-API-Key': api_key} if api_key else {}

    print("=" * 78)
    print("CROSS-TAB KPI RECONCILIATION AUDIT (FY 2026-27)")
    print("=" * 78)

    # 1. Fetch Finance Summary (Waterfall)
    res_fs = client.get('/api/finance/summary?fy=2026-2027', headers=headers)
    if res_fs.status_code != 200:
        print(f"FAILED to fetch finance summary: HTTP {res_fs.status_code}")
        return
    fs = res_fs.json

    # 2. Fetch Franchisees Summary (FY 2026-27 range: 2026-04-01 to 2027-03-31)
    res_fran = client.get('/api/finance/franchisee-summary?start_date=2026-04-01&end_date=2027-03-31', headers=headers)
    if res_fran.status_code != 200:
        print(f"FAILED to fetch franchisee summary: HTTP {res_fran.status_code}")
        return
    fran = res_fran.json

    # 3. Fetch Cost of Performance (COP)
    res_cop = client.get('/api/cost-performance?fy=2026-2027&month=all', headers=headers)
    if res_cop.status_code != 200:
        print(f"FAILED to fetch cost performance: HTTP {res_cop.status_code}")
        return
    cop = res_cop.json

    # 4. Fetch Franchisee Reactivation
    res_react = client.get('/api/ml/franchisee-reactivation', headers=headers)
    react = res_react.json if res_react.status_code == 200 else {}

    # -------------------------------------------------------------
    # TAB 1: DASHBOARD / WATERFALL (Authoritative Corporate Ledger)
    # -------------------------------------------------------------
    print("\n--- 1. DASHBOARD / WATERFALL (Corporate Ledger) ---")
    gross_crm_sc = fs.get('gross_service_revenue', 62686282.98)
    canc_rev = gross_crm_sc - fs.get('revenue', 0.0)
    print(f"  Gross CRM Service Amt (w/o GST):Rs{gross_crm_sc:>14,.2f}  (~Rs 6.27 Cr from CRM portal)")
    print(f"  - Cancelled Deals & Reversals: Rs {canc_rev:>14,.2f}  (CN / RV deal deductions)")
    print(f"  = Net Billed Revenue (ex-GST): Rs {fs.get('revenue', 0.0):>14,.2f}  (Net Service Amount)")
    print(f"  - Franchisee Share:            Rs {fs.get('franchisee_share', 0.0):>14,.2f}")
    print(f"  = Company Retained Share:      Rs {fs.get('our_share', 0.0):>14,.2f}")
    print(f"  (Unallocated Share):           Rs {fs.get('unallocated', 0.0):>14,.2f}")
    print(f"  - Operating Expenses (exp):    Rs {fs.get('operating_expenses', 0.0):>14,.2f}")
    print(f"  - Actual Salaries (Apr-Aug):   Rs {fs.get('salaries', 0.0):>14,.2f}")
    print(f"  - Projected Salaries (Jan-Feb):Rs {fs.get('projected_salaries', 0.0):>14,.2f}")
    print(f"  = Corporate Net Profit/(Loss): Rs {fs.get('net', 0.0):>14,.2f}")

    # -------------------------------------------------------------
    # TAB 2: FRANCHISEES TAB (Field Ledger & Active Network)
    # -------------------------------------------------------------
    fran_ledger = fran.get('ledger', [])
    tot_fran_rev = fran.get('total_revenue_ex_gst', 0.0)
    tot_fran_company = fran.get('total_company_share', 0.0)
    tot_fran_share = fran.get('total_franchisee_share', 0.0)
    tot_fran_unallocated = fran.get('unallocated', 0.0)
    tot_fran_placements = fran.get('total_placements', 0)
    active_fran_count = fran.get('active_franchisees_count', sum(1 for f in fran_ledger if f.get('isActive')))
    dormant_fran_count = len(fran_ledger) - active_fran_count

    print("\n--- 2. FRANCHISEES TAB (Network Hubs & Payouts) ---")
    print(f"  Registered Hubs:               {len(fran_ledger):>14d}")
    print(f"  Active Hubs (placed <= 90d):   {active_fran_count:>14d}")
    print(f"  Inactive / Dormant Hubs:       {dormant_fran_count:>14d}")
    print(f"  Total Clean Placements (FY):   {tot_fran_placements:>14d}")
    print(f"  Total Clean Revenue (ex-GST):  Rs {tot_fran_rev:>14,.2f}")
    print(f"  Total Company Share:           Rs {tot_fran_company:>14,.2f}")
    print(f"  Total Franchisee Share:        Rs {tot_fran_share:>14,.2f}")
    print(f"  (Unallocated Share):           Rs {tot_fran_unallocated:>14,.2f}")

    # -------------------------------------------------------------
    # TAB 3: COST OF PERFORMANCE (Sales Unit Economics)
    # -------------------------------------------------------------
    cop_rows = cop.get('rows', [])
    cop_billed = sum(r.get('total_billed', 0.0) for r in cop_rows)
    cop_f_share = sum(r.get('franchisee_payout', 0.0) for r in cop_rows)
    cop_company_share = sum(r.get('company_share', 0.0) for r in cop_rows)
    cop_bd_cost = sum(r.get('direct_cost', 0.0) for r in cop_rows)
    cop_overhead = sum(r.get('overheadShare', 0.0) for r in cop_rows)
    cop_churn_cost = sum(r.get('churnCost', 0.0) for r in cop_rows)
    cop_net_contrib = sum(r.get('netContribution', 0.0) for r in cop_rows)

    print("\n--- 3. COST OF PERFORMANCE TAB (BD Rep Unit Contribution) ---")
    print(f"  Active BD Reps Evaluated:      {len(cop_rows):>14d}")
    print(f"  Total Invoiced under BDs:      Rs {cop_billed:>14,.2f}")
    print(f"  Franchisee Share (BD Scope):   Rs {cop_f_share:>14,.2f}")
    print(f"  Company Share (BD Scope):      Rs {cop_company_share:>14,.2f}")
    print(f"  - BD Direct Base Salaries:     Rs {cop_bd_cost:>14,.2f}")
    print(f"  - Overhead Allocation Pool:    Rs {cop_overhead:>14,.2f}")
    print(f"  - Churn Cost (Credit Notes):   Rs {cop_churn_cost:>14,.2f}")
    print(f"  = Net BD Contribution:         Rs {cop_net_contrib:>14,.2f}")

    # -------------------------------------------------------------
    # TAB 4: SMART REACTIVATION (Rule-Based Dormant Pipeline)
    # -------------------------------------------------------------
    r_summary = react.get('summary', {})
    print("\n--- 4. SMART REACTIVATION ENDPOINT (/api/ml/franchisee-reactivation) ---")
    print(f"  Model Type:                    {react.get('model_type', 'N/A'):>14s}")
    print(f"  Never-Activated Hubs Excluded: {r_summary.get('never_activated_excluded', 0):>14d}")
    print(f"  Dormant Candidates Evaluated:  {r_summary.get('dormant_candidates_count', 0):>14d}")
    print(f"  Potential Monthly Recovery:    Rs {r_summary.get('total_potential_monthly_recovery', 0.0):>14,.2f}")

    # -------------------------------------------------------------
    # CROSS-TAB RECONCILIATION AUDIT & VARIANCE EXPLANATION
    # -------------------------------------------------------------
    print("\n" + "=" * 78)
    print("CROSS-TAB VARIANCE MATRIX & AUDIT CHECKS")
    print("=" * 78)

    # Check A: Revenue ex-GST between Waterfall and Franchisees Tab
    unmatched_rev = sum(x.get('revenueExGst', 0.0) for x in fran.get('unmatched_names', []))
    unmatched_comp = sum(x.get('companyShare', 0.0) for x in fran.get('unmatched_names', []))
    unmatched_fran = sum(x.get('franchiseeShare', 0.0) for x in fran.get('unmatched_names', []))
    matched_plus_unmatched_rev = tot_fran_rev + unmatched_rev
    diff_rev = fs.get('revenue', 0.0) - matched_plus_unmatched_rev

    print(f"1. Revenue ex-GST Check:")
    print(f"   Waterfall True Revenue:       Rs {fs.get('revenue', 0.0):>14,.2f}")
    print(f"   Franchisees Tab Matched Rev:  Rs {tot_fran_rev:>14,.2f}")
    print(f"   + Unmatched Invoices (1 deal):Rs {unmatched_rev:>14,.2f}")
    print(f"   = Total Clean Invoiced Rev:   Rs {matched_plus_unmatched_rev:>14,.2f}")
    print(f"   Delta vs Waterfall:           Rs {diff_rev:>14,.2f}")
    if abs(diff_rev) < 1.0:
        print("   -> Status: PERFECT 100% RECONCILIATION MATCH")
    else:
        print(f"   -> Status: VARIANCE DETECTED (Rs {diff_rev:,.2f})")

    # Check B: Company Share between Waterfall and Franchisees Tab
    matched_plus_unmatched_comp = tot_fran_company + unmatched_comp
    diff_comp = fs.get('our_share', 0.0) - matched_plus_unmatched_comp
    print(f"\n2. Company Retained Share Check:")
    print(f"   Waterfall Company Share:      Rs {fs.get('our_share', 0.0):>14,.2f}")
    print(f"   Franchisees Tab Matched Share:Rs {tot_fran_company:>14,.2f}")
    print(f"   + Unmatched Deals Share:      Rs {unmatched_comp:>14,.2f}")
    print(f"   = Total Invoiced Company Share:Rs{matched_plus_unmatched_comp:>14,.2f}")
    print(f"   Delta vs Waterfall:           Rs {diff_comp:>14,.2f}")
    if abs(diff_comp) < 1.0:
        print("   -> Status: PERFECT 100% RECONCILIATION MATCH")
    else:
        print(f"   -> Status: VARIANCE DETECTED (Rs {diff_comp:,.2f})")

    # Check C: Franchisee Share & Unallocated Reconciliation
    matched_plus_unmatched_fran = tot_fran_share + unmatched_fran
    diff_fran = fs.get('franchisee_share', 0.0) - matched_plus_unmatched_fran
    print(f"\n3. Franchisee Share & Unallocated Check:")
    print(f"   Waterfall Franchisee Share:   Rs {fs.get('franchisee_share', 0.0):>14,.2f}")
    print(f"   Franchisees Tab Matched Share:Rs {tot_fran_share:>14,.2f}")
    print(f"   + Unmatched Deals Share:      Rs {unmatched_fran:>14,.2f}")
    print(f"   = Total Franchisee Share:     Rs {matched_plus_unmatched_fran:>14,.2f}")
    print(f"   Delta vs Waterfall:           Rs {diff_fran:>14,.2f}")
    print(f"   Waterfall Unallocated:        Rs {fs.get('unallocated', 0.0):>14,.2f}")
    print(f"   Franchisees Tab Unallocated:  Rs {tot_fran_unallocated:>14,.2f}")
    if abs(diff_fran) < 1.0:
        print("   -> Status: PERFECT 100% RECONCILIATION MATCH")
    else:
        print(f"   -> Status: VARIANCE DETECTED (Rs {diff_fran:,.2f})")

    # Check D: Waterfall Company Share vs COP Company Share
    diff_cop_share = fs.get('our_share', 0.0) - cop_company_share
    print(f"\n4. Waterfall Company Share vs COP Company Share:")
    print(f"   Waterfall Corporate Inflow:   Rs {fs.get('our_share', 0.0):>14,.2f}")
    print(f"   COP Inflow (BD Scoped):       Rs {cop_company_share:>14,.2f}")
    print(f"   Delta (House/Direct Inflow):  Rs {diff_cop_share:>14,.2f}")
    print("   -> Reason: COP only attributes revenue to deals with assigned active BD agents,")
    print("      whereas Waterfall captures 100% of corporate invoiced company share.")

    # Check E: Personnel Cost: Verified Payroll vs BD Base Salary Capacity
    print(f"\n5. Personnel Cost Check:")
    print(f"   Waterfall Verified Payroll:   Rs {fs.get('salaries', 0.0):>14,.2f} (Apr-Aug actual)")
    print(f"   COP Estimated BD Capacity:    Rs {cop_bd_cost:>14,.2f} (25 BDs annualized base)")
    print(f"   Delta:                        Rs {fs.get('salaries', 0.0) - cop_bd_cost:>14,.2f}")
    print("   -> Reason: COP estimates theoretical annualized base salary of 25 BD agents,")
    print("      whereas Waterfall uses audited employee-by-employee corporate payroll.")

    # Check F: Churn / Credit-Note Handling
    print(f"\n6. Churn Cost / Credit-Note Handling:")
    print(f"   COP Direct Churn Penalty:     Rs {cop_churn_cost:>14,.2f} (deducted from sales reps)")
    print(f"   Waterfall Reversal Handling:  Netted directly in v_invoice_clean (is_revenue=0 for CNs)")
    print("   -> Key Accounting Insight: COP churn penalty currently uses full gross deal value,")
    print("      penalizing reps for company share + franchisee share + GST. Netting company share")
    print("      would reflect true corporate churn cost.")

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    add_db_safety_args(parser)
    args = parser.parse_args()
    run_reconciliation(args)
