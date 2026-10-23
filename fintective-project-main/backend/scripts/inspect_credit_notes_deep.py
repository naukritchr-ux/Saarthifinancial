"""
backend/scripts/inspect_credit_notes_deep.py
Addresses Item 1 in full:
1. List CN/LEGAL-CN/RV/LEGAL rows for FY 2026-27 (count, billed, rev_ex_gst, franchiseeShare, ourShare).
2. Match to original invoice via enquiry_id / billNumber / candidate+company:
   - Is original still counted in is_revenue revenue and our_share?
   - In which FY was original billed?
3. Compute our_share net of reversals two ways:
   (a) subtract CN ourShare for CNs dated in the FY
   (b) drop reversed originals
   Show resulting Net next to current +Rs 6.04 Lakh.
4. Exactly what COP "churn cost" (Rs 1,59,46,973) is made of.
Counts and totals only, NO NAMES.
"""

import sys, os
from collections import defaultdict
import datetime

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from scripts.db_guard import get_db_connection, add_db_safety_args
from finance_rules import calculate_waterfall
import argparse

parser = argparse.ArgumentParser()
add_db_safety_args(parser)
args = parser.parse_args()

conn, env_label, db_name = get_db_connection(args)
cur = conn.cursor()

# -------------------------------------------------------------------------
# 1. List CN/LEGAL-CN/RV/LEGAL rows for FY 2026-27
# -------------------------------------------------------------------------
print("=" * 70)
print("1. CREDIT NOTES & NON-REVENUE INVOICES IN FY 2026-27")
print("=" * 70)
cur.execute("""
    SELECT 
        COALESCE(info, 'BLANK') as info_type,
        COUNT(*) as cnt,
        SUM(totalBillAmt) as billed,
        SUM(rev_ex_gst) as rev_ex_gst,
        SUM(franchiseeShare) as f_share,
        SUM(ourShare) as our_share
    FROM v_invoice_clean
    WHERE fy = '2026-2027' AND is_revenue = 0
    GROUP BY info_type
    ORDER BY cnt DESC
""")
cn_rows = cur.fetchall()

tot_cnt = 0
tot_billed = 0.0
tot_rev = 0.0
tot_f = 0.0
tot_our = 0.0

print(f"{'Info Type':<12} | {'Count':<6} | {'Billed (Rs)':<15} | {'Rev ex-GST (Rs)':<16} | {'Franchisee (Rs)':<16} | {'Our Share (Rs)':<15}")
print("-" * 90)
for r in cn_rows:
    cnt = r['cnt']
    b = float(r['billed'])
    rev = float(r['rev_ex_gst'])
    f = float(r['f_share'])
    our = float(r['our_share'])
    tot_cnt += cnt
    tot_billed += b
    tot_rev += rev
    tot_f += f
    tot_our += our
    print(f"{r['info_type']:<12} | {cnt:<6} | {b:>14,.2f} | {rev:>15,.2f} | {f:>15,.2f} | {our:>14,.2f}")
print("-" * 90)
print(f"{'TOTAL':<12} | {tot_cnt:<6} | {tot_billed:>14,.2f} | {tot_rev:>15,.2f} | {tot_f:>15,.2f} | {tot_our:>14,.2f}")

# -------------------------------------------------------------------------
# 2. Match each reversal to original invoice
# -------------------------------------------------------------------------
print("\n" + "=" * 70)
print("2. ORIGINAL INVOICE LINKAGE & FY DISTRIBUTION")
print("=" * 70)

cur.execute("""
    SELECT 
        id, enquiry_id, billNumber, billDate, totalBillAmt, serviceCharges, 
        franchiseeShare, ourShare, info, companyName, candidateName
    FROM v_invoice_clean
    WHERE fy = '2026-2027' AND is_revenue = 0
""")
reversals = cur.fetchall()

# Pre-fetch all revenue invoices across all years
cur.execute("""
    SELECT 
        id, enquiry_id, billNumber, billDate, totalBillAmt, serviceCharges, 
        franchiseeShare, ourShare, is_revenue, rev_ex_gst, fy, companyName, candidateName
    FROM v_invoice_clean
    WHERE is_revenue = 1
""")
all_rev_invoices = cur.fetchall()

by_enquiry = defaultdict(list)
by_bill_no = defaultdict(list)
by_comp_cand = defaultdict(list)

for inv in all_rev_invoices:
    if inv['enquiry_id']:
        by_enquiry[inv['enquiry_id']].append(inv)
    if inv['billNumber']:
        clean_bn = str(inv['billNumber']).strip().lower()
        by_bill_no[clean_bn].append(inv)
    cand = str(inv.get('candidateName') or '').strip().lower()
    comp = str(inv.get('companyName') or '').strip().lower()
    if cand and comp:
        by_comp_cand[(cand, comp)].append(inv)

matched_originals = {}
orig_fy_dist = defaultdict(int)
orig_fy_our_share = defaultdict(float)
orig_fy_rev = defaultdict(float)

still_in_revenue_cnt = 0
not_in_revenue_cnt = 0
unmatched_cnt = 0

for rv in reversals:
    matched = None
    # 1. Match by enquiry_id
    if rv['enquiry_id'] and rv['enquiry_id'] in by_enquiry:
        matched = by_enquiry[rv['enquiry_id']][0]
    # 2. Match by bill number
    elif rv['billNumber'] and str(rv['billNumber']).strip().lower() in by_bill_no:
        matched = by_bill_no[str(rv['billNumber']).strip().lower()][0]
    # 3. Match by candidate + company
    else:
        c_cand = str(rv.get('candidateName') or '').strip().lower()
        c_comp = str(rv.get('companyName') or '').strip().lower()
        if (c_cand, c_comp) in by_comp_cand:
            matched = by_comp_cand[(c_cand, c_comp)][0]

    if matched:
        matched_originals[rv['id']] = matched
        orig_fy = matched['fy']
        orig_fy_dist[orig_fy] += 1
        orig_fy_our_share[orig_fy] += float(matched['ourShare'] or 0)
        orig_fy_rev[orig_fy] += float(matched['rev_ex_gst'] or 0)
        if matched['is_revenue'] == 1:
            still_in_revenue_cnt += 1
        else:
            not_in_revenue_cnt += 1
    else:
        unmatched_cnt += 1

print(f"Total reversals analyzed: {len(reversals)}")
print(f"Matched to original revenue invoice: {len(matched_originals)}")
print(f"   Original still counted in is_revenue=1: {still_in_revenue_cnt}")
print(f"   Original not counted in is_revenue=1:   {not_in_revenue_cnt}")
print(f"Unmatched (reversal entry with no distinct revenue counterpart): {unmatched_cnt}")

print("\nDistribution of original invoice FY:")
for fy_k in sorted(orig_fy_dist.keys()):
    cnt = orig_fy_dist[fy_k]
    r_sum = orig_fy_rev[fy_k]
    o_sum = orig_fy_our_share[fy_k]
    print(f"   Original billed in FY {fy_k:<10}: count={cnt:>3} | Rev ex-GST: Rs {r_sum:>13,.2f} | Original ourShare: Rs {o_sum:>12,.2f}")

# -------------------------------------------------------------------------
# 3. Compute our_share net of reversals two ways & resulting Net
# -------------------------------------------------------------------------
print("\n" + "=" * 70)
print("3. REVERSAL ADJUSTMENT APPROACHES & RESULTING NET")
print("=" * 70)

# Current Waterfall numbers for FY 2026-27
cur.execute("""
    SELECT 
        SUM(rev_ex_gst) as rev_ex_gst,
        SUM(ourShare) as our_share_rev,
        SUM(franchiseeShare) as f_share_rev
    FROM v_invoice_clean
    WHERE fy = '2026-2027' AND is_revenue = 1
""")
cur_stats = cur.fetchone()
base_rev = float(cur_stats['rev_ex_gst'])
base_our_share = float(cur_stats['our_share_rev'])  # 14,480,013.00
actual_salaries = 10961811.00                       # April - August
opex = 3018814.00                                   # Non-salary expenditure

# Current base Net
current_net = base_our_share - opex - actual_salaries
print(f"Baseline (Current Status):")
print(f"   Our Share (rev rows): Rs {base_our_share:,.2f}")
print(f"   Operating Expenses:   Rs {opex:,.2f}")
print(f"   Salaries (to date):   Rs {actual_salaries:,.2f}")
print(f"   => Current Net:       Rs {current_net:,.2f}  (+Rs 6.04 Lakh)")

# Approach (a): Subtract CN ourShare for CNs dated in the FY
# Total CN ourShare dated in FY 2026-27 is tot_our (from Section 1)
our_share_a = base_our_share - tot_our
net_a = our_share_a - opex - actual_salaries
tax_a = max(0.0, net_a * 0.25)
surplus_a = net_a - tax_a
print(f"\nApproach (a): Subtract CN ourShare for CNs dated in FY 2026-27 (deducting Rs {tot_our:,.2f}):")
print(f"   Adjusted Our Share:   Rs {our_share_a:,.2f}")
print(f"   Operating Expenses:   Rs {opex:,.2f}")
print(f"   Salaries (to date):   Rs {actual_salaries:,.2f}")
print(f"   => Adjusted Net:      Rs {net_a:,.2f}  (Difference vs current: -Rs {current_net - net_a:,.2f})")
print(f"   => Adjusted Tax:      Rs {tax_a:,.2f}")
print(f"   => Adjusted Surplus:  Rs {surplus_a:,.2f}")

# Approach (b): Drop reversed originals (only drop originals that were billed in FY 2026-27)
rev_orig_2627_our_share = orig_fy_our_share['2026-2027']
rev_orig_2627_rev = orig_fy_rev['2026-2027']
rev_orig_2627_cnt = orig_fy_dist['2026-2027']

our_share_b = base_our_share - rev_orig_2627_our_share
net_b = our_share_b - opex - actual_salaries
tax_b = max(0.0, net_b * 0.25)
surplus_b = net_b - tax_b
print(f"\nApproach (b): Drop reversed original invoices billed in FY 2026-27 (dropping {rev_orig_2627_cnt} invoices, ourShare Rs {rev_orig_2627_our_share:,.2f}):")
print(f"   Adjusted Our Share:   Rs {our_share_b:,.2f}")
print(f"   Operating Expenses:   Rs {opex:,.2f}")
print(f"   Salaries (to date):   Rs {actual_salaries:,.2f}")
print(f"   => Adjusted Net:      Rs {net_b:,.2f}  (Difference vs current: -Rs {current_net - net_b:,.2f})")
print(f"   => Adjusted Tax:      Rs {tax_b:,.2f}")
print(f"   => Adjusted Surplus:  Rs {surplus_b:,.2f}")

# What if all reversed originals across ANY FY are dropped?
all_rev_orig_our_share = sum(orig_fy_our_share.values())
our_share_b_all = base_our_share - all_rev_orig_our_share
net_b_all = our_share_b_all - opex - actual_salaries
print(f"\n(Sensitivity): If dropping reversed originals regardless of origin FY (dropping Rs {all_rev_orig_our_share:,.2f}):")
print(f"   Adjusted Our Share:   Rs {our_share_b_all:,.2f}")
print(f"   => Adjusted Net:      Rs {net_b_all:,.2f}")

# -------------------------------------------------------------------------
# 4. Exactly what COP "churn cost" (Rs 1,59,46,973) is made of
# -------------------------------------------------------------------------
print("\n" + "=" * 70)
print("4. COMPOSITION OF COP CHURN COST (Rs 1,59,46,973.00)")
print("=" * 70)

# In cost_performance_controller.py:
# is_cn = (not inv['is_revenue']) or (str(inv['info'] or '').upper() in ('CN', 'RV', 'LEGAL-CN'))
# if is_cn: entry['churnCost'] += float(abs(inv['ourShare'] or inv['totalBillAmt']))
cur.execute("""
    SELECT 
        id, info, totalBillAmt, ourShare,
        COALESCE(NULLIF(ourShare, 0.0), totalBillAmt) as churn_val_used,
        CASE WHEN ourShare IS NOT NULL AND ourShare <> 0 THEN 'Used ourShare' ELSE 'Fell back to totalBillAmt (Gross Billed)' END as method
    FROM v_invoice_clean
    WHERE fy = '2026-2027' AND (is_revenue = 0 OR info IN ('CN', 'RV', 'LEGAL-CN'))
""")
churn_invs = cur.fetchall()

churn_total = sum(float(c['churn_val_used'] or 0) for c in churn_invs)
churn_by_method = defaultdict(lambda: {'count': 0, 'sum': 0.0})
for c in churn_invs:
    m = c['method']
    churn_by_method[m]['count'] += 1
    churn_by_method[m]['sum'] += float(c['churn_val_used'] or 0)

print(f"Total rows flagged as CN/reversal in COP: {len(churn_invs)}")
print(f"Sum of churnCost: Rs {churn_total:,.2f}")
print("\nBreakdown of churnCost formula in cost_performance_controller.py:")
for m, vals in churn_by_method.items():
    print(f"   {m:<40}: count={vals['count']:>3} | Sum: Rs {vals['sum']:>14,.2f}")

# Show sum of totalBillAmt vs sum of rev_ex_gst vs sum of ourShare for those exact rows
cur.execute("""
    SELECT 
        COUNT(*) as cnt,
        SUM(totalBillAmt) as sum_billed,
        SUM(rev_ex_gst) as sum_rev_ex_gst,
        SUM(ourShare) as sum_our_share
    FROM v_invoice_clean
    WHERE fy = '2026-2027' AND (is_revenue = 0 OR info IN ('CN', 'RV', 'LEGAL-CN'))
""")
cop_c_stats = cur.fetchone()
print("\nUnderlying fields for these reversal rows:")
print(f"   Total Billed (Gross incl GST): Rs {float(cop_c_stats['sum_billed']):,.2f}")
print(f"   Revenue ex-GST:               Rs {float(cop_c_stats['sum_rev_ex_gst']):,.2f}")
print(f"   Our Share (actual recorded):  Rs {float(cop_c_stats['sum_our_share']):,.2f}")

conn.close()
