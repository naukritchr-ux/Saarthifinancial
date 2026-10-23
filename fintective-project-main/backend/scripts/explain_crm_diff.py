"""
backend/scripts/explain_crm_diff.py
Analyzes the exact difference between the endpoint figures and the CRM figures:
Endpoint: Billed 6.11 Cr, Rev 5.19 Cr, Franchisee 3.71 Cr, Our 1.45 Cr
CRM Target: Billed 6.21 Cr, Rev 5.27 Cr, Franchisee 3.80 Cr, Our 1.47 Cr
Gap: ~10 Lakh Billed, ~8 Lakh Rev, ~9 Lakh Franchisee, ~2 Lakh Our Share
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

# 1. Base endpoint numbers
cursor.execute("""
    SELECT 
        COUNT(*) as cnt,
        SUM(totalBillAmt) as billed,
        SUM(rev_ex_gst) as rev,
        SUM(franchiseeShare) as f_share,
        SUM(ourShare) as our_share
    FROM v_invoice_clean
    WHERE fy = '2026-2027' AND is_revenue = 1
""")
base = cursor.fetchone()
print(f"Base Endpoint: cnt={base['cnt']}, billed={float(base['billed']):,.2f}, rev={float(base['rev']):,.2f}, f={float(base['f_share']):,.2f}, our={float(base['our_share']):,.2f}")

# 2. Factor A: Unbilled closed enquiries in enquiries table (with bill_date or dateOfAllocation in FY26-27)
# In app.py transactions pipeline:
cursor.execute("""
    SELECT 
        COUNT(*) as cnt,
        SUM(bill_amount) as bill_amt,
        SUM(bill_amount * 1.18) as bill_incl_gst
    FROM enquiries e
    WHERE e.bill_date BETWEEN '2026-04-01' AND '2027-03-31'
      AND (e.bill_no IS NULL OR TRIM(e.bill_no) = '' OR e.bill_no NOT IN (SELECT billNumber FROM invoice WHERE billNumber IS NOT NULL AND TRIM(billNumber) <> ''))
      AND LOWER(e.enquiryStatus) IN ('closed', 'offered_and_accepted', 'internally_closed')
""")
unbilled_enq = cursor.fetchone()
print(f"\nFactor A: Unbilled Closed/Offered Enquiries (bill_date): cnt={unbilled_enq['cnt']}, bill_amt={float(unbilled_enq['bill_amt'] or 0):,.2f}, incl_gst={float(unbilled_enq['bill_incl_gst'] or 0):,.2f}")

# 3. Factor B: Hardcoded demo enquiry IDs [127907, 132500, 132501, 132505, 136084]
cursor.execute("""
    SELECT 
        COUNT(*) as cnt,
        SUM(totalBillAmt) as billed,
        SUM(serviceCharges) as rev
    FROM invoice
    WHERE enquiry_id IN (127907, 132500, 132501, 132505, 136084)
""")
demo_inv = cursor.fetchone()
print(f"Factor B: Demo Enquiry IDs in invoice: cnt={demo_inv['cnt']}, billed={float(demo_inv['billed'] or 0):,.2f}, rev={float(demo_inv['rev'] or 0):,.2f}")

# 4. Factor C: Colliding bill numbers excluded by v_colliding_bills
cursor.execute("""
    SELECT 
        COUNT(*) as cnt,
        SUM(totalBillAmt) as billed,
        SUM(serviceCharges) as rev,
        SUM(franchiseeShare) as f_share,
        SUM(ourShare) as our_share
    FROM invoice
    WHERE billNumber IN (SELECT bill_no FROM v_colliding_bills)
      AND (billDate BETWEEN '2026-04-01' AND '2027-03-31')
""")
colliding = cursor.fetchone()
print(f"Factor C: Colliding bill numbers in 2026-2027: cnt={colliding['cnt']}, billed={float(colliding['billed'] or 0):,.2f}")

# 5. Factor D: Invoices where financialYear column in invoice is '2026-2027' vs billDate between April 1 2026 and March 31 2027
cursor.execute("""
    SELECT 
        COUNT(*) as cnt,
        SUM(totalBillAmt) as billed,
        SUM(COALESCE(NULLIF(serviceCharges, 0), ROUND(totalBillAmt/1.18, 2))) as rev,
        SUM(franchiseeShare) as f_share,
        SUM(ourShare) as our_share
    FROM invoice
    WHERE (financialYear = '2026-2027' OR financialYear = '2026-2026')
      AND ((info IS NULL) OR (info NOT IN ('CN','LEGAL-CN','LEGAL','RV')))
""")
by_fy_col = cursor.fetchone()
print(f"Factor D: Invoice where financialYear column = '2026-2027': cnt={by_fy_col['cnt']}, billed={float(by_fy_col['billed'] or 0):,.2f}, rev={float(by_fy_col['rev'] or 0):,.2f}, f={float(by_fy_col['f_share'] or 0):,.2f}, our={float(by_fy_col['our_share'] or 0):,.2f}")

# 6. Factor E: What if we check invoices with billDate in 2026-2027 + unbilled enquiries?
# Let's see: base billed 6.11 Cr + Factor A (unbilled closed enquiries) = 6.11 Cr + 0.10 Cr = 6.21 Cr!
if unbilled_enq['bill_incl_gst']:
    combined_billed = float(base['billed']) + float(unbilled_enq['bill_incl_gst'])
    combined_rev = float(base['rev']) + float(unbilled_enq['bill_amt'])
    print(f"\nCOMBINED (v_invoice_clean is_revenue=1 + Unbilled Closed Enquiries):")
    print(f"   Billed incl GST: Rs {combined_billed:,.2f} ({combined_billed/1e7:.2f} Cr)")
    print(f"   Revenue ex-GST:  Rs {combined_rev:,.2f} ({combined_rev/1e7:.2f} Cr)")

# 7. Check franchise payments in FY 2026-2027
cursor.execute("""
    SELECT 
        COUNT(*) as cnt,
        SUM(amount) as sum_amt
    FROM franchisePayments
    WHERE paymentDate BETWEEN '2026-04-01' AND '2027-03-31'
""")
fp = cursor.fetchone()
print(f"\nFactor F: franchisePayments in FY 2026-2027: cnt={fp['cnt']}, amt={float(fp['sum_amt'] or 0):,.2f}")

# 8. Check clients_info in FY 2026-2027
cursor.execute("""
    SELECT 
        COUNT(*) as cnt,
        SUM(serviceCharge) as sum_sc
    FROM clients_info
    WHERE dateOfClientAcquired BETWEEN '2026-04-01' AND '2027-03-31'
""")
ci = cursor.fetchone()
print(f"Factor G: clients_info in FY 2026-2027: cnt={ci['cnt']}, serviceCharge={float(ci['sum_sc'] or 0):,.2f}")

conn.close()
