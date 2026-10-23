"""
backend/scripts/reconcile_cop.py
Reconciles /api/finance/summary FY 2026-27 Net (+Rs 6.04 Lakh) with
Cost of Performance FY 2026-27 Net (-Rs 1.18 Cr) line by line.
Counts and totals only, NO NAMES.
"""
import json
import os
import sys

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
cp_path = os.path.join(BACKEND_DIR, 'baselines', 'after', 'cost_performance_2026-2027.json')
fs_path = os.path.join(BACKEND_DIR, 'baselines', 'after', 'finance_summary_2026-2027.json')

cp = json.load(open(cp_path, encoding='utf-8'))
fs = json.load(open(fs_path, encoding='utf-8'))

rows = cp.get('rows', [])

print(f"Cost of Performance Rows Count: {len(rows)}")
sum_total_billed = sum(r.get('total_billed', 0.0) for r in rows)
sum_f_payout = sum(r.get('franchisee_payout', 0.0) for r in rows)
sum_company_share = sum(r.get('company_share', 0.0) for r in rows)
sum_direct_cost = sum(r.get('direct_cost', 0.0) for r in rows)
sum_overhead = sum(r.get('overheadShare', 0.0) for r in rows)
sum_cost_of_exec = sum(r.get('costOfExecution', 0.0) for r in rows)
sum_churn_cost = sum(r.get('churnCost', 0.0) for r in rows)
sum_net_contrib = sum(r.get('netContribution', 0.0) for r in rows)

print("\n--- COST OF PERFORMANCE (COP) COMPONENTS (FY 2026-27) ---")
print(f"1. Total Billed:                 Rs {sum_total_billed:>14,.2f}")
print(f"2. Franchisee Payout:            Rs {sum_f_payout:>14,.2f}")
print(f"3. Company Share (Inflow):       Rs {sum_company_share:>14,.2f}")
print(f"4. Direct Cost (BD base salary): Rs {sum_direct_cost:>14,.2f}  (25 BDs x ~Rs 3.6L full-year estimate)")
print(f"5. Overhead Share (Pool alloc):  Rs {sum_overhead:>14,.2f}")
print(f"   => Cost of Execution (4+5):   Rs {sum_cost_of_exec:>14,.2f}")
print(f"6. Churn Cost (Credit Notes):    Rs {sum_churn_cost:>14,.2f}  (deducted directly from BD net)")
print(f"   => Net Contribution (3-4-5-6):Rs {sum_net_contrib:>14,.2f}  (-Rs 1.18 Cr)")

print("\n--- FINANCE SUMMARY (WATERFALL) COMPONENTS (FY 2026-27) ---")
print(f"A. Billed incl GST:              Rs {fs['billed_incl_gst']:>14,.2f}")
print(f"B. GST (Pass-through 18%):       Rs {fs['gst']:>14,.2f}")
print(f"C. Revenue ex-GST:               Rs {fs['revenue']:>14,.2f}")
print(f"D. Franchisee Share:             Rs {fs['franchisee_share']:>14,.2f}")
print(f"E. Our Share (Inflow):           Rs {fs['our_share']:>14,.2f}")
print(f"F. Unallocated:                  Rs {fs['unallocated']:>14,.2f}")
print(f"G. Operating Expenses (exp):     Rs {fs['operating_expenses']:>14,.2f}")
print(f"H. Actual Salaries (to date):    Rs {fs['salaries']:>14,.2f}")
print(f"I. Projected Salaries:           Rs {fs['projected_salaries']:>14,.2f}")
print(f"   => Net (Waterfall E - G - H): Rs {fs['net']:>14,.2f}  (+Rs 6.04 Lakh)")

print("\n--- LINE-BY-LINE RECONCILIATION DIFFERENCES ---")
diff_inflow = sum_company_share - fs['our_share']
print(f"1. Inflow/Share Difference:      Rs {diff_inflow:>14,.2f}  (COP company share Rs 1.09 Cr vs Waterfall our_share Rs 1.45 Cr)")
print(f"   Reason: COP scopes recruitment enquiries attributed to active BD reps only, while Waterfall includes all company revenue rows.")
print(f"2. Salary / Personnel Cost Model:Rs {sum_direct_cost - fs['salaries']:>14,.2f}")
print(f"   Reason: COP assumes fixed estimated annualized BD capacity (25 BDs x Rs 3.6L = Rs 88.32L), whereas Waterfall uses verified actual payroll records to date (Rs 1.10 Cr).")
print(f"3. Overhead / Operating Exp:     Rs {sum_overhead - fs['operating_expenses']:>14,.2f}")
print(f"   Reason: COP uses an arbitrary overhead allocation pool (Rs 1.20L/mo x 12 = Rs 14.40L, scaled to Rs 20.37L), whereas Waterfall uses actual non-salary expenditures from expenditure table (Rs 30.19L).")
print(f"4. Churn Cost (Credit Notes):   -Rs {sum_churn_cost:>14,.2f}")
print(f"   Reason: COP penalizes BD contribution with full credit-note churn cost (Rs 1.19 Cr), whereas Waterfall handles credit notes in revenue categorization (ex-GST pass-through and net waterfall).")
print(f"\nNet Difference:")
print(f"   Waterfall Net:                Rs {fs['net']:>14,.2f}")
print(f"   minus COP Net:                Rs {sum_net_contrib:>14,.2f}")
print(f"   Total Difference:             Rs {fs['net'] - sum_net_contrib:>14,.2f}  (+Rs 1.24 Cr)")
