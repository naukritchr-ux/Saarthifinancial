"""
backend/scripts/inspect_audit_discrepancies.py
Investigates:
1. Ghost rows per table (enquiries, invoice, franchisees, expenditure) - counts and values
2. The Rs 1,04,607 difference between Dashboard ourShare and Franchisees tab ourShare (CN analysis)
3. The Rs 29,566 shift in Dashboard net (from Rs 6.04L to Rs 6.34L)
4. COP gross billed (Rs 6.16 Cr) vs Dashboard gross billed (Rs 6.13 Cr)
Counts and totals only, NO NAMES.
"""

import sys
import os
import argparse
import datetime
import json
import re

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from scripts.db_guard import get_db_connection, add_db_safety_args
from sync_service import fetch_saarthi_endpoint, EXPENSE_ENDPOINT

def run_investigation(args):
    conn, host, db = get_db_connection(args)
    cur = conn.cursor()
    print("=" * 78)
    print(f"DEEP AUDIT INVESTIGATION | Host: {host} | DB: {db}")
    print("=" * 78)

    # =========================================================================
    # PART 1: GHOST ROWS AUDIT ACROSS ALL TABLES
    # =========================================================================
    print("\n" + "=" * 78)
    print("PART 1: GHOST ROWS PER TABLE & FINANCIAL IMPACT")
    print("=" * 78)

    # 1. Invoices
    res_inv = fetch_saarthi_endpoint("Invoice", timeout=15)
    if res_inv.get("ok"):
        api_inv_ids = {str(item.get("id")) for item in res_inv["data"] if item.get("id")}
        cur.execute("SELECT id, billNumber, billDate, totalBillAmt, serviceCharges, info, status FROM invoice")
        local_inv = cur.fetchall()
        ghost_inv = [r for r in local_inv if str(r["id"]) not in api_inv_ids]
        print(f"Table `invoice`:")
        print(f"  Local DB count:    {len(local_inv)}")
        print(f"  Upstream CRM count:{len(api_inv_ids)}")
        print(f"  Ghost row count:   {len(ghost_inv)}")

        if ghost_inv:
            g_billed = sum(float(r["totalBillAmt"] or 0) for r in ghost_inv)
            g_svc = sum(float(r["serviceCharges"] or 0) for r in ghost_inv)
            g_cn = sum(1 for r in ghost_inv if str(r.get("info") or '').strip().upper() == 'CN')
            fy26_ghost = [r for r in ghost_inv if r.get("billDate") and '2026-04-01' <= str(r["billDate"])[:10] <= '2027-03-31']
            print(f"  Financials of Ghost Invoices:")
            print(f"    All-time Total Billed:    Rs {g_billed:,.2f}")
            print(f"    All-time Service Charges: Rs {g_svc:,.2f}")
            print(f"    CN Count among ghosts:    {g_cn}")
            print(f"    FY 2026-27 Ghost Count:   {len(fy26_ghost)}")
            if fy26_ghost:
                print(f"    FY 2026-27 Ghost Billed:  Rs {sum(float(r['totalBillAmt'] or 0) for r in fy26_ghost):,.2f}")
            else:
                print(f"    FY 2026-27 Ghost Billed:  Rs 0.00 (All 65 ghost invoices are FY24-25 / FY25-26 legacy!)")

    # 2. Enquiries
    res_enq = fetch_saarthi_endpoint("enquiries", timeout=15)
    if res_enq.get("ok"):
        api_enq_ids = {str(item.get("id")) for item in res_enq["data"] if item.get("id")}
        cur.execute("SELECT id, bill_amount, enquiryStatus FROM enquiries")
        local_enq = cur.fetchall()
        ghost_enq = [r for r in local_enq if str(r["id"]) not in api_enq_ids]
        print(f"\nTable `enquiries`:")
        print(f"  Local DB count:    {len(local_enq)}")
        print(f"  Upstream CRM count:{len(api_enq_ids)}")
        print(f"  Ghost row count:   {len(ghost_enq)}")
        g_enq_bill = sum(float(r.get("bill_amount") or 0) for r in ghost_enq)
        g_enq_closed = sum(1 for r in ghost_enq if r.get("enquiryStatus") == "closed")
        print(f"  Financials of Ghost Enquiries: Closed: {g_enq_closed}, Total Bill Amount: Rs {g_enq_bill:,.2f}")

    # 3. Franchisees
    res_fran = fetch_saarthi_endpoint("franchisees", timeout=15)
    if res_fran.get("ok"):
        def _norm(s):
            if not s: return ''
            s = s.lower().strip()
            s = re.sub(r'[^\w\s]', '', s)
            return re.sub(r'\s+', ' ', s).strip()
        api_fran_names = {_norm(item.get("nameAsPerAgreement")) for item in res_fran["data"] if item.get("nameAsPerAgreement")}
        cur.execute("SELECT id, nameAsPerAgreement FROM franchisees")
        local_fran = cur.fetchall()
        ghost_fran = [r for r in local_fran if _norm(r.get("nameAsPerAgreement")) not in api_fran_names]
        print(f"\nTable `franchisees`:")
        print(f"  Local DB count:    {len(local_fran)}")
        print(f"  Upstream CRM count:{len(api_fran_names)}")
        print(f"  Ghost franchisees: {len(ghost_fran)}")

    # 4. Expenditure
    res_exp = fetch_saarthi_endpoint(EXPENSE_ENDPOINT, timeout=15)
    if res_exp.get("ok"):
        api_exp_crm_ids = {int(item.get("id")) for item in res_exp["data"] if item.get("id") is not None and str(item.get("id")).isdigit()}
        cur.execute("SELECT id, crm_id, amount, is_deleted FROM expenditure")
        local_exp = cur.fetchall()
        ghost_exp = [r for r in local_exp if r.get("crm_id") is not None and r["crm_id"] not in api_exp_crm_ids]
        legacy_exp = [r for r in local_exp if r.get("crm_id") is None]
        print(f"\nTable `expenditure`:")
        print(f"  Local DB count:           {len(local_exp)}")
        print(f"  Upstream CRM count:       {len(api_exp_crm_ids)}")
        print(f"  Local legacy (no crm_id): {len(legacy_exp)}")
        print(f"  Ghost expenditures:       {len(ghost_exp)}")

    # =========================================================================
    # PART 2: THE Rs 1,04,607 DIFFERENCE (CN NETTING PROOF)
    # =========================================================================
    print("\n" + "=" * 78)
    print("PART 2: THE Rs 1,04,607 DIFFERENCE (DASHBOARD vs FRANCHISEES TAB)")
    print("=" * 78)

    # 1. Total credit notes in FY 2026-27 in invoice table
    cur.execute("""
        SELECT 
            info,
            status,
            COUNT(*) as cnt,
            SUM(totalBillAmt) as billed,
            SUM(serviceCharges) as charges,
            SUM(franchiseeShare) as f_share,
            SUM(ourShare) as our_share
        FROM invoice
        WHERE billDate BETWEEN '2026-04-01' AND '2027-03-31'
          AND (info IN ('CN', 'LEGAL-CN') OR LOWER(status) = 'cancelled')
        GROUP BY info, status
    """)
    cn_summary = cur.fetchall()
    print("Credit Notes / Reversals in raw invoice table (FY 2026-27):")
    total_cn_our_share = 0.0
    for r in cn_summary:
        total_cn_our_share += float(r['our_share'] or 0.0)
        print(f"  info: '{r['info']}' | status: '{r['status']}' | Count: {r['cnt']} | Billed: Rs {r['billed']:,.2f} | Svc: Rs {r['charges']:,.2f} | ourShare: Rs {r['our_share']:,.2f}")
    print(f"  Total raw CN ourShare in FY 2026-27: Rs {total_cn_our_share:,.2f}")

    # 2. Check v_invoice_clean definition for FY 2026-27
    cur.execute("""
        SELECT 
            is_revenue,
            COUNT(*) as cnt,
            SUM(totalBillAmt) as billed,
            SUM(rev_ex_gst) as rev,
            SUM(franchiseeShare) as f_share,
            SUM(ourShare) as our_share
        FROM v_invoice_clean
        WHERE fy = '2026-2027'
        GROUP BY is_revenue
    """)
    v_rows = cur.fetchall()
    print("\nv_invoice_clean FY 2026-27 by is_revenue:")
    for r in v_rows:
        print(f"  is_revenue={r['is_revenue']} | Count: {r['cnt']} | Billed: Rs {r['billed']:,.2f} | Rev: Rs {r['rev']:,.2f} | ourShare: Rs {r['our_share']:,.2f}")

    # 3. Test Dashboard calculation vs Franchisees calculation
    # Dashboard:
    # Uses finance_rules.calculate_waterfall('2026-2027')
    from finance_rules import calculate_waterfall
    wf = calculate_waterfall('2026-2027', conn=conn)
    dash_comp = wf['our_share']

    # Franchisees Tab:
    # Query:
    cur.execute("""
        SELECT 
            TRIM(franchiseName) as fname,
            SUM(rev_ex_gst) as rev,
            SUM(ourShare) as our_share
        FROM v_invoice_clean
        WHERE is_revenue = 1 AND billDate BETWEEN '2026-04-01' AND '2027-03-31'
          AND franchiseName IS NOT NULL AND TRIM(franchiseName) != ''
        GROUP BY TRIM(franchiseName)
    """)
    f_matched_rows = cur.fetchall()
    f_matched_our_share = sum(float(r['our_share'] or 0.0) for r in f_matched_rows)

    # Also check with is_revenue IN (0, 1) (i.e. WITH CN rows included!)
    cur.execute("""
        SELECT 
            SUM(ourShare) as our_share_with_cn
        FROM v_invoice_clean
        WHERE billDate BETWEEN '2026-04-01' AND '2027-03-31'
          AND franchiseName IS NOT NULL AND TRIM(franchiseName) != ''
    """)
    with_cn = cur.fetchone()['our_share_with_cn']

    print(f"\nExact Comparison of ourShare on both tabs:")
    print(f"  Dashboard (Waterfall) our_share:      Rs {dash_comp:,.2f}")
    print(f"  Franchisees Tab matched our_share:    Rs {f_matched_our_share:,.2f}")
    print(f"  Difference:                           Rs {dash_comp - f_matched_our_share:,.2f}")
    print(f"  Franchisees Tab WITH CNs included:    Rs {with_cn:,.2f}")

    # Now let's find the exact invoice IDs causing the Rs 104,607 difference!
    # Where does Dashboard get Rs 14,614,186.00?
    cur.execute("""
        SELECT 
            id, enquiry_id, billNumber, billDate, franchiseName, serviceCharges, ourShare, info, status, is_revenue
        FROM v_invoice_clean
        WHERE is_revenue = 1 AND fy = '2026-2027'
    """)
    all_wf_invoices = cur.fetchall()
    wf_inv_by_id = {r['id']: r for r in all_wf_invoices}
    print(f"  Total revenue invoices in Waterfall: {len(all_wf_invoices)}, Sum ourShare: Rs {sum(r['ourShare'] for r in all_wf_invoices):,.2f}")

    # In Franchisees Tab, what invoices are included?
    cur.execute("""
        SELECT 
            id, enquiry_id, billNumber, billDate, franchiseName, serviceCharges, ourShare, info, status
        FROM v_invoice_clean
        WHERE is_revenue = 1 AND billDate BETWEEN '2026-04-01' AND '2027-03-31'
          AND franchiseName IS NOT NULL AND TRIM(franchiseName) != ''
    """)
    all_fran_invoices = cur.fetchall()
    fran_inv_by_id = {r['id']: r for r in all_fran_invoices}
    print(f"  Total revenue invoices in Franchisees Tab: {len(all_fran_invoices)}, Sum ourShare: Rs {sum(r['ourShare'] for r in all_fran_invoices):,.2f}")

    # Difference in invoice sets:
    missing_in_fran = [r for r in all_wf_invoices if r['id'] not in fran_inv_by_id]
    print(f"\nInvoices in Dashboard Waterfall but NOT in Franchisees Tab ({len(missing_in_fran)} rows):")
    for r in missing_in_fran:
        print(f"  ID: {r['id']} | BillNo: {r['billNumber']} | Date: {r['billDate']} | FranName: '{r['franchiseName']}' | Svc: Rs {r['serviceCharges']} | ourShare: Rs {r['ourShare']}")

    # =========================================================================
    # PART 3: THE Rs 29,566 SHIFT IN DASHBOARD NET (Rs 6.04L to Rs 6.34L)
    # =========================================================================
    print("\n" + "=" * 78)
    print("PART 3: THE Rs 29,566 SHIFT IN DASHBOARD NET PROFIT")
    print("=" * 78)

    # Earlier audit reported net = Rs 6,03,995.00
    # Current audit reported net = Rs 6,33,561.00
    # Let's inspect each line of the waterfall formula:
    # net = our_share - operating_expenses - salaries - projected_salaries
    print("Line-by-line comparison of current Waterfall vs Rs 6.04L baseline:")
    print(f"  Current our_share:          Rs {wf['our_share']:>14,.2f}")
    print(f"  Current operating_expenses: Rs {wf['operating_expenses']:>14,.2f}")
    print(f"  Current actual salaries:    Rs {wf['salaries']:>14,.2f}")
    print(f"  Current projected salaries: Rs {wf['projected_salaries']:>14,.2f}")
    print(f"  Current Net:                Rs {wf['net']:>14,.2f}")

    # Let's check what changed in our_share, operating_expenses, or salaries!
    # Earlier values:
    # fs_path in baselines:
    before_fs = os.path.join(BACKEND_DIR, 'baselines', 'after', 'finance_summary_2026-2027.json')
    if os.path.exists(before_fs):
        b = json.load(open(before_fs))
        print(f"\nFrom baseline file `{before_fs}`:")
        print(f"  our_share:          Rs {b.get('our_share', 0.0):>14,.2f}  (Delta: Rs {wf['our_share'] - b.get('our_share', 0.0):,.2f})")
        print(f"  operating_expenses: Rs {b.get('operating_expenses', 0.0):>14,.2f}  (Delta: Rs {wf['operating_expenses'] - b.get('operating_expenses', 0.0):,.2f})")
        print(f"  salaries:           Rs {b.get('salaries', 0.0):>14,.2f}  (Delta: Rs {wf['salaries'] - b.get('salaries', 0.0):,.2f})")
        print(f"  projected_salaries: Rs {b.get('projected_salaries', 0.0):>14,.2f}  (Delta: Rs {wf['projected_salaries'] - b.get('projected_salaries', 0.0):,.2f})")
        print(f"  Net:                Rs {b.get('net', 0.0):>14,.2f}  (Delta: Rs {wf['net'] - b.get('net', 0.0):,.2f})")

    # =========================================================================
    # PART 4: COP GROSS BILLED (Rs 6.16 Cr) vs DASHBOARD (Rs 6.13 Cr)
    # =========================================================================
    print("\n" + "=" * 78)
    print("PART 4: COP GROSS BILLED (Rs 6.16 Cr) vs DASHBOARD (Rs 6.13 Cr)")
    print("=" * 78)

    # Let's inspect cost_performance_controller.py query for billed amount
    # In cost_performance_controller.py:
    # How is `total_billed` computed for each BD?
    # Let's inspect the exact SQL query in cost_performance_controller.py!
    from cost_performance_controller import get_cost_performance_report
    # Let's check what SQL query cost_performance_controller runs
    cur.execute("""
        SELECT 
            COUNT(*) as cnt,
            SUM(totalBillAmt) as sum_total_bill,
            SUM(serviceCharges) as sum_service_charges
        FROM invoice
        WHERE billDate BETWEEN '2026-04-01' AND '2027-03-31'
          AND (info NOT IN ('CN', 'LEGAL-CN') OR info IS NULL)
          AND (status != 'cancelled' OR status IS NULL)
    """)
    inv_ex_cn = cur.fetchone()
    print("Raw invoice table (excluding CNs and cancelled) FY 2026-27:")
    print(f"  Count: {inv_ex_cn['cnt']}, totalBillAmt (with GST): Rs {inv_ex_cn['sum_total_bill']:,.2f}, serviceCharges: Rs {inv_ex_cn['sum_service_charges']:,.2f}")

    # Check enquiries table billed amount in FY 2026-27
    cur.execute("""
        SELECT 
            COUNT(*) as cnt,
            SUM(bill_amount) as sum_bill,
            SUM(placementFees) as sum_fees
        FROM enquiries
        WHERE bill_date BETWEEN '2026-04-01' AND '2027-03-31'
          AND enquiryStatus NOT IN ('cancelled', 'credit_note')
    """)
    enq_fy26 = cur.fetchone()
    print("Enquiries table (bill_date in FY 2026-27):")
    print(f"  Count: {enq_fy26['cnt']}, bill_amount: Rs {enq_fy26['sum_bill']:,.2f}, placementFees: Rs {enq_fy26['sum_fees']:,.2f}")

    conn.close()

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    add_db_safety_args(parser)
    args = parser.parse_args()
    run_investigation(args)
