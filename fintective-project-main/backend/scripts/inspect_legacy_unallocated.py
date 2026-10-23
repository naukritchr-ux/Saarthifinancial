"""
backend/scripts/inspect_legacy_unallocated.py
Investigates the legacy ~13% gap in FY 2024-25 and FY 2025-26.
Compares ourShare + franchiseeShare against rev_ex_gst, totalBillAmt, and TDS fields.
Outputs 5 anonymized example rows (IDs only, NO NAMES).
"""

import sys, os
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from scripts.db_guard import get_db_connection, add_db_safety_args
import argparse

parser = argparse.ArgumentParser()
add_db_safety_args(parser)
args = parser.parse_args()

conn, env_label, db_name = get_db_connection(args)
cur = conn.cursor()

print("=" * 80)
print("3. LEGACY UNALLOCATED GAP INVESTIGATION (FY 2024-25 & FY 2025-26)")
print("=" * 80)

# Pull 5 sample rows from FY 2024-25 where gap is ~10% to 15%
cur.execute("""
    SELECT 
        id, billNumber, billDate, totalBillAmt, serviceCharges, rev_ex_gst,
        franchiseeShare, ourShare, tds, tdsFF, totalGST, franchiseeGST, amountReceived,
        (rev_ex_gst - (ourShare + franchiseeShare)) as gap,
        ROUND((rev_ex_gst - (ourShare + franchiseeShare)) / rev_ex_gst * 100, 2) as gap_pct_of_rev,
        ROUND(franchiseeShare / rev_ex_gst * 100, 2) as f_pct_of_rev,
        ROUND(ourShare / rev_ex_gst * 100, 2) as our_pct_of_rev,
        ROUND(franchiseeShare / totalBillAmt * 100, 2) as f_pct_of_billed,
        ROUND(ourShare / totalBillAmt * 100, 2) as our_pct_of_billed
    FROM v_invoice_clean
    WHERE fy IN ('2024-2025', '2025-2026')
      AND is_revenue = 1
      AND rev_ex_gst > 10000
      AND (rev_ex_gst - (ourShare + franchiseeShare)) > 1000
    ORDER BY id ASC
    LIMIT 10
""")
samples = cur.fetchall()

print(f"{'ID':<8} | {'Total Billed':<12} | {'Rev ex-GST':<12} | {'Franchisee':<12} | {'Our Share':<12} | {'TDS':<8} | {'Gap (Rs)':<10} | {'Gap %':<6} | {'F %':<6} | {'Our %':<6}")
print("-" * 105)
for s in samples[:5]:
    f_val = float(s['franchiseeShare'] or 0)
    o_val = float(s['ourShare'] or 0)
    r_val = float(s['rev_ex_gst'] or 0)
    b_val = float(s['totalBillAmt'] or 0)
    t_val = float(s['tds'] or 0)
    g_val = float(s['gap'] or 0)
    print(f"{s['id']:<8} | {b_val:>12,.2f} | {r_val:>12,.2f} | {f_val:>12,.2f} | {o_val:>12,.2f} | {t_val:>8,.2f} | {g_val:>10,.2f} | {s['gap_pct_of_rev']:>5}% | {s['f_pct_of_rev']:>5}% | {s['our_pct_of_rev']:>5}%")

# Let's test the mathematical relationships across the entire FY 2024-25 dataset
cur.execute("""
    SELECT 
        COUNT(*) as total_invoices,
        SUM(rev_ex_gst) as sum_rev,
        SUM(franchiseeShare) as sum_f,
        SUM(ourShare) as sum_our,
        SUM(rev_ex_gst - (ourShare + franchiseeShare)) as sum_gap,
        AVG(franchiseeShare / rev_ex_gst) as avg_f_pct,
        AVG(ourShare / rev_ex_gst) as avg_our_pct,
        AVG((ourShare + franchiseeShare) / rev_ex_gst) as avg_total_pct,
        -- Check if franchiseeShare was exactly 70% of rev_ex_gst
        SUM(CASE WHEN ABS(franchiseeShare - (rev_ex_gst * 0.70)) <= 2.0 THEN 1 ELSE 0 END) as f_is_70_rev,
        -- Check if franchiseeShare was exactly 70% of totalBillAmt / 1.18
        SUM(CASE WHEN ABS(franchiseeShare - (totalBillAmt / 1.18 * 0.70)) <= 2.0 THEN 1 ELSE 0 END) as f_is_70_billed_ex_gst,
        -- Check what ourShare was: was it 17.5%? 18%? flat?
        AVG(ourShare / rev_ex_gst) * 100 as our_avg_pct,
        -- Check if (ourShare + franchiseeShare + totalGST) relate
        AVG(franchiseeShare / (totalBillAmt - totalGST)) as f_on_base
    FROM v_invoice_clean
    WHERE fy = '2024-2025' AND is_revenue = 1 AND rev_ex_gst > 0
""")
analysis = cur.fetchone()
print("\nStatistical Analysis of FY 2024-25 Revenue Invoices:")
print(f"   Total revenue invoices: {analysis['total_invoices']}")
print(f"   Sum Revenue ex-GST:     Rs {float(analysis['sum_rev']):,.2f}")
print(f"   Sum Franchisee Share:   Rs {float(analysis['sum_f']):,.2f} ({float(analysis['sum_f'])/float(analysis['sum_rev'])*100:.2f}%)")
print(f"   Sum Our Share:          Rs {float(analysis['sum_our']):,.2f} ({float(analysis['sum_our'])/float(analysis['sum_rev'])*100:.2f}%)")
print(f"   Sum Unallocated Gap:    Rs {float(analysis['sum_gap']):,.2f} ({float(analysis['sum_gap'])/float(analysis['sum_rev'])*100:.2f}%)")
print(f"   Invoices where Franchisee Share is exactly 70% of Rev ex-GST: {analysis['f_is_70_rev']}")

# Check if ourShare was computed as 20% or 18% or something else
cur.execute("""
    SELECT 
        ROUND(franchiseeShare / rev_ex_gst, 2) as f_ratio,
        ROUND(ourShare / rev_ex_gst, 2) as our_ratio,
        COUNT(*) as cnt
    FROM v_invoice_clean
    WHERE fy = '2024-2025' AND is_revenue = 1 AND rev_ex_gst > 0
    GROUP BY f_ratio, our_ratio
    ORDER BY cnt DESC
    LIMIT 8
""")
ratios = cur.fetchall()
print("\nDominant (Franchisee Ratio, Our Share Ratio) Pairs in FY 2024-25:")
for r in ratios:
    print(f"   Franchisee: {float(r['f_ratio'])*100:.0f}% | Our Share: {float(r['our_ratio'])*100:.0f}% | Total: {(float(r['f_ratio']) + float(r['our_ratio']))*100:.0f}% | Gap: {(1 - float(r['f_ratio']) - float(r['our_ratio']))*100:.0f}% | Count: {r['cnt']}")

conn.close()
