"""
backend/scripts/find_crm_target.py
Finds exactly which combination of filters yields:
Billed incl GST 6.21 Cr, Revenue ex-GST 5.27 Cr, Franchisee share 3.80 Cr, Our share 1.47 Cr
"""

import sys
import os
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

# 1. Check all distinct info values in invoice for FY 2026-2027
cursor.execute("""
    SELECT 
        info,
        COUNT(*) as cnt,
        SUM(totalBillAmt) as billed,
        SUM(COALESCE(NULLIF(serviceCharges, 0), ROUND(totalBillAmt/1.18, 2))) as rev_ex_gst,
        SUM(franchiseeShare) as f_share,
        SUM(ourShare) as our_share
    FROM invoice
    WHERE billDate BETWEEN '2026-04-01' AND '2027-03-31'
    GROUP BY info
""")
info_rows = cursor.fetchall()
print("Invoice breakdown by info type in FY 2026-2027:")
for r in info_rows:
    print(f"  info='{r['info']}': cnt={r['cnt']}, billed={r['billed']:,.2f}, rev={r['rev_ex_gst']:,.2f}, f={r['f_share']:,.2f}, our={r['our_share']:,.2f}")

# 2. Check various exclusion combinations
# Endpoint currently excludes: ('CN','LEGAL-CN','LEGAL','RV')
# What if only CN is excluded?
cursor.execute("""
    SELECT 
        SUM(totalBillAmt) as billed,
        SUM(COALESCE(NULLIF(serviceCharges, 0), ROUND(totalBillAmt/1.18, 2))) as rev_ex_gst,
        SUM(franchiseeShare) as f_share,
        SUM(ourShare) as our_share
    FROM invoice
    WHERE billDate BETWEEN '2026-04-01' AND '2027-03-31'
      AND (info IS NULL OR info NOT IN ('CN', 'LEGAL-CN'))
""")
combo1 = cursor.fetchone()
print(f"\nExcluding only ('CN', 'LEGAL-CN'):")
print(f"  Billed: {float(combo1['billed'] or 0):,.2f} ({float(combo1['billed'] or 0)/1e7:.2f} Cr)")
print(f"  Rev: {float(combo1['rev_ex_gst'] or 0):,.2f} ({float(combo1['rev_ex_gst'] or 0)/1e7:.2f} Cr)")
print(f"  F-share: {float(combo1['f_share'] or 0):,.2f} ({float(combo1['f_share'] or 0)/1e7:.2f} Cr)")
print(f"  Our-share: {float(combo1['our_share'] or 0):,.2f} ({float(combo1['our_share'] or 0)/1e7:.2f} Cr)")

# What if only info = 'C' or info = 'CN' or info is in REVENUE_INFO_TYPES from finance_rules?
from finance_rules import REVENUE_INFO_TYPES
placeholders = ','.join(['%s'] * len(REVENUE_INFO_TYPES))
cursor.execute(f"""
    SELECT 
        SUM(totalBillAmt) as billed,
        SUM(COALESCE(NULLIF(serviceCharges, 0), ROUND(totalBillAmt/1.18, 2))) as rev_ex_gst,
        SUM(franchiseeShare) as f_share,
        SUM(ourShare) as our_share
    FROM invoice
    WHERE billDate BETWEEN '2026-04-01' AND '2027-03-31'
      AND (info IS NULL OR info = '' OR info IN ({placeholders}))
""", REVENUE_INFO_TYPES)
combo2 = cursor.fetchone()
print(f"\nFiltering by REVENUE_INFO_TYPES:")
print(f"  Billed: {float(combo2['billed'] or 0):,.2f} ({float(combo2['billed'] or 0)/1e7:.2f} Cr)")
print(f"  Rev: {float(combo2['rev_ex_gst'] or 0):,.2f} ({float(combo2['rev_ex_gst'] or 0)/1e7:.2f} Cr)")
print(f"  F-share: {float(combo2['f_share'] or 0):,.2f} ({float(combo2['f_share'] or 0)/1e7:.2f} Cr)")
print(f"  Our-share: {float(combo2['our_share'] or 0):,.2f} ({float(combo2['our_share'] or 0)/1e7:.2f} Cr)")

# What if enquiries table is used?
cursor.execute("""
    SELECT 
        COUNT(*) as cnt,
        SUM(bill_amount) as sum_bill,
        SUM(bill_amount * 1.18) as sum_bill_incl_gst
    FROM enquiries
    WHERE bill_date BETWEEN '2026-04-01' AND '2027-03-31'
      AND (info IS NULL OR info NOT IN ('CN', 'LEGAL-CN', 'LEGAL', 'RV', 'C'))
""")
enq_res = cursor.fetchone()
print(f"\nEnquiries with bill_date in 2026-2027: count={enq_res['cnt']}, bill_amount={float(enq_res['sum_bill'] or 0):,.2f} ({float(enq_res['sum_bill'] or 0)/1e7:.2f} Cr)")

# Check hardcoded enquiry exclusions DEMO_ENQUIRY_IDS in app.py
# DEMO_ENQUIRY_IDS = [127907, 132500, 132501, 132505, 136084]
# Check transactions endpoint aggregation for FY 2026-2027
conn.close()
