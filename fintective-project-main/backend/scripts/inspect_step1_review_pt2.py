"""
backend/scripts/inspect_step1_review_pt2.py
Read-only inspection script addressing Step 1 Review questions:
1. Payroll month mapping & RecordID progression
2. Credit note info types & 205 unlinked reversals across all FYs
3. Churn cost comparison (ourShare, rev_ex_gst, current formula)
4. Reconciliation of FY 2024-25 revenue figures
"""

import os
import sys
import json
import glob
import argparse
from datetime import datetime
from db_guard import add_db_safety_args, get_db_connection

def run_inspection():
    parser = argparse.ArgumentParser(description="Step 1 Review Part 2 Inspection")
    add_db_safety_args(parser)
    args = parser.parse_args()

    conn, env_label, db_name = get_db_connection(args)

    print("=================================================================")
    print("STEP 1 REVIEW - PART 2 INSPECTION REPORT (COUNTS & TOTALS ONLY)")
    print("=================================================================\n")

    # -------------------------------------------------------------
    # 1. PAYROLL MONTH MAPPING & RECORD SEQUENCE
    # -------------------------------------------------------------
    print("--- 1. PAYROLL MONTH MAPPING & RECORD SEQUENCE ---")
    cache_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'scratch', 'payroll_cache'))
    print(f"Inspecting attendance cache directory: {cache_dir}")

    # Inspect all cache files for 2026-2027
    att_summary = []
    all_cache_records = {}
    for m in range(12):
        c_path = os.path.join(cache_dir, f"att_2026-2027_{m}.json")
        if os.path.exists(c_path):
            try:
                with open(c_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    all_cache_records[m] = data
                    r_ids = [r['RecordID'] for r in data if 'RecordID' in r]
                    m_vals = list(set(r.get('Month') for r in data))
                    min_r = min(r_ids) if r_ids else None
                    max_r = max(r_ids) if r_ids else None
                    att_summary.append({
                        'm_param': m,
                        'count': len(data),
                        'min_record_id': min_r,
                        'max_record_id': max_r,
                        'month_field_values': m_vals
                    })
            except Exception as e:
                att_summary.append({'m_param': m, 'error': str(e)})
        else:
            att_summary.append({'m_param': m, 'count': 0, 'status': 'missing'})

    print("\nAttendance Cache Files Summary (att_2026-2027_<m>.json):")
    for s in att_summary:
        print(s)

    # Now let's compare the 54 records (Jan/Feb 2027) with Apr-Aug 2026 records in payroll_records table
    with conn.cursor() as cur:
        # Fetch Apr-Aug 2026 records
        cur.execute("""
            SELECT id, employee_id, fixed_gross, ctc_amount, date, financial_year
            FROM payroll_records
            WHERE financial_year = '2026-2027' AND date <= '2026-10-23'
        """)
        actual_rows = cur.fetchall()

        # Fetch Jan-Feb 2027 records
        cur.execute("""
            SELECT id, employee_id, fixed_gross, ctc_amount, date, financial_year
            FROM payroll_records
            WHERE financial_year = '2026-2027' AND date > '2026-10-23'
        """)
        future_rows = cur.fetchall()

    print(f"\nPayroll Records in DB:")
    print(f"Actual (Apr-Aug 2026) rows count: {len(actual_rows)}")
    print(f"Projected (Jan-Feb 2027) rows count: {len(future_rows)}")

    # Distinct employees
    actual_emps = set(r['employee_id'] for r in actual_rows)
    future_emps = set(r['employee_id'] for r in future_rows)
    overlap_emps = actual_emps.intersection(future_emps)

    print(f"Distinct employees in Apr-Aug 2026: {len(actual_emps)}")
    print(f"Distinct employees in Jan-Feb 2027: {len(future_emps)}")
    print(f"Employee overlap count: {len(overlap_emps)} out of {len(future_emps)} ({len(overlap_emps)/len(future_emps)*100:.1f}%)")

    # Salary comparison for overlapping employees
    # Map emp_id -> list of fixed_gross in actual months
    emp_actual_salaries = {}
    for r in actual_rows:
        emp_actual_salaries.setdefault(r['employee_id'], []).append(float(r['fixed_gross']))

    same_salary_count = 0
    diff_salary_count = 0
    for r in future_rows:
        e_id = r['employee_id']
        fg = float(r['fixed_gross'])
        if e_id in emp_actual_salaries:
            # check if fg matches any of the actual salaries (or the latest one)
            if fg in emp_actual_salaries[e_id]:
                same_salary_count += 1
            else:
                diff_salary_count += 1

    print(f"Jan-Feb 2027 rows with exact matching FixedGrossSalary to Apr-Aug 2026: {same_salary_count} out of {len(future_rows)}")
    print(f"Jan-Feb 2027 rows with different FixedGrossSalary: {diff_salary_count}")

    # Check the dates and RecordIDs in future records from cache
    # Compare RecordID range of m=0..4 vs m=9..10
    print("\nRecordID Progression Analysis:")
    for m in [0, 1, 2, 3, 4, 9, 10]:
        if m in all_cache_records and all_cache_records[m]:
            rec_ids = [r['RecordID'] for r in all_cache_records[m] if 'RecordID' in r]
            print(f"Month index m={m}: count={len(rec_ids)}, min_id={min(rec_ids)}, max_id={max(rec_ids)}")

    # -------------------------------------------------------------
    # 2. CREDIT NOTES & 205 UNLINKED REVERSALS
    # -------------------------------------------------------------
    print("\n--- 2. CREDIT NOTES & 205 UNLINKED REVERSALS ---")
    with conn.cursor() as cur:
        # Check meaning of info values in invoice table and status
        cur.execute("""
            SELECT info, COUNT(*) as cnt,
                   COUNT(CASE WHEN status IS NOT NULL AND status != '' THEN 1 END) as status_cnt,
                   MIN(billDate) as min_date, MAX(billDate) as max_date,
                   SUM(totalBillAmt) as sum_billed, SUM(ourShare) as sum_our_share
            FROM invoice
            WHERE info IN ('RV', 'CN', 'LEGAL', 'LEGAL-CN')
            GROUP BY info
        """)
        info_stats = cur.fetchall()
        print("All-time distribution of RV, CN, LEGAL, LEGAL-CN in invoice table:")
        for row in info_stats:
            print(row)

        # Inspect typical status values for each info type
        cur.execute("""
            SELECT info, status, COUNT(*) as count
            FROM invoice
            WHERE info IN ('RV', 'CN', 'LEGAL', 'LEGAL-CN')
            GROUP BY info, status
            ORDER BY info, count DESC
        """)
        sample_status = cur.fetchall()
        print("\nStatus distribution for reversal info types:")
        for sr in sample_status:
            print(sr)

        # Also inspect billNumber prefixes for each info type
        cur.execute("""
            SELECT info, 
                   COUNT(CASE WHEN billNumber LIKE 'CN%' THEN 1 END) as cn_prefix,
                   COUNT(CASE WHEN billNumber LIKE 'RV%' THEN 1 END) as rv_prefix,
                   COUNT(CASE WHEN billNumber LIKE 'LEGAL%' THEN 1 END) as legal_prefix,
                   COUNT(CASE WHEN billNumber NOT LIKE 'CN%' AND billNumber NOT LIKE 'RV%' AND billNumber NOT LIKE 'LEGAL%' THEN 1 END) as other_prefix
            FROM invoice
            WHERE info IN ('RV', 'CN', 'LEGAL', 'LEGAL-CN')
            GROUP BY info
        """)
        prefix_stats = cur.fetchall()
        print("\nBillNumber prefix patterns for reversal info types:")
        for ps in prefix_stats:
            print(ps)

        # FY 2026-27 reversal rows (265 total)
        cur.execute("""
            SELECT id, billNumber, enquiry_id, candidateName, companyName,
                   totalBillAmt, totalGST, billDate, info, ourShare
            FROM invoice
            WHERE billDate BETWEEN '2026-04-01' AND '2027-03-31'
              AND info IN ('RV', 'CN', 'LEGAL', 'LEGAL-CN')
        """)
        reversal_rows = cur.fetchall()
        print(f"\nFY 2026-27 Reversals Total Count: {len(reversal_rows)}")

        # Search for original invoice in ANY FY
        linked_originals = []
        unlinked_count = 0

        for r in reversal_rows:
            bn = (r.get('billNumber') or '').strip()
            eid = r.get('enquiry_id')
            cname = (r.get('candidateName') or '').strip()
            comp = (r.get('companyName') or '').strip()

            clean_bn = bn
            for pfx in ['CN-', 'CN/', 'CN ', 'RV-', 'RV/', 'RV ', 'LEGAL-', 'REV-', 'CR-']:
                if clean_bn.upper().startswith(pfx):
                    clean_bn = clean_bn[len(pfx):]
            
            matched = None
            if clean_bn and clean_bn != bn:
                cur.execute("""
                    SELECT id, billNumber, billDate, totalBillAmt, ourShare, franchiseeShare,
                           info, financialYear
                    FROM invoice
                    WHERE billNumber = %s AND id != %s AND info NOT IN ('RV', 'CN', 'LEGAL', 'LEGAL-CN')
                    LIMIT 1
                """, [clean_bn, r['id']])
                matched = cur.fetchone()

            if not matched and eid and eid > 0:
                cur.execute("""
                    SELECT id, billNumber, billDate, totalBillAmt, ourShare, franchiseeShare,
                           info, financialYear
                    FROM invoice
                    WHERE enquiry_id = %s AND id != %s AND info NOT IN ('RV', 'CN', 'LEGAL', 'LEGAL-CN')
                    ORDER BY billDate DESC
                    LIMIT 1
                """, [eid, r['id']])
                matched = cur.fetchone()

            if not matched and cname and comp:
                cur.execute("""
                    SELECT id, billNumber, billDate, totalBillAmt, ourShare, franchiseeShare,
                           info, financialYear
                    FROM invoice
                    WHERE candidateName = %s AND companyName = %s AND id != %s
                      AND info NOT IN ('RV', 'CN', 'LEGAL', 'LEGAL-CN')
                    ORDER BY billDate DESC
                    LIMIT 1
                """, [cname, comp, r['id']])
                matched = cur.fetchone()

            if matched:
                b_date = str(matched['billDate'])
                if b_date < '2025-04-01':
                    m_fy = '2024-2025'
                elif b_date < '2026-04-01':
                    m_fy = '2025-2026'
                elif b_date < '2027-04-01':
                    m_fy = '2026-2027'
                else:
                    m_fy = 'Other'

                linked_originals.append({
                    'reversal_id': r['id'],
                    'reversal_fy': '2026-2027',
                    'reversal_billed': float(r['totalBillAmt'] or 0),
                    'reversal_our_share': float(r['ourShare'] or 0),
                    'orig_id': matched['id'],
                    'orig_bill_date': b_date,
                    'orig_fy': matched.get('financialYear') or m_fy,
                    'orig_billed': float(matched['totalBillAmt'] or 0),
                    'orig_our_share': float(matched['ourShare'] or 0),
                    'orig_franchisee_share': float(matched.get('franchiseeShare') or 0)
                })
            else:
                unlinked_count += 1

        print(f"\nMatching Results for 265 FY 2026-27 Reversals across ALL FYs:")
        print(f"Total Linked to an Original: {len(linked_originals)}")
        print(f"Total Unlinked: {unlinked_count}")

        # Deep dive into unlinked reversals:
        print(f"\nInspecting 205 unlinked reversal rows:")
        unlinked_rows = [r for r in reversal_rows if r['id'] not in [lo['reversal_id'] for lo in linked_originals]]
        print(f"Total unlinked: {len(unlinked_rows)}")
        # Check non-empty candidate and company
        with_cand_comp = [r for r in unlinked_rows if (r.get('candidateName') or '').strip() and (r.get('companyName') or '').strip()]
        with_eid = [r for r in unlinked_rows if r.get('enquiry_id') and r.get('enquiry_id') > 0]
        with_bn = [r for r in unlinked_rows if (r.get('billNumber') or '').strip()]
        print(f"Unlinked with candidate & company: {len(with_cand_comp)}")
        print(f"Unlinked with enquiry_id > 0: {len(with_eid)}")
        print(f"Unlinked with non-empty billNumber: {len(with_bn)}")

        # Try looser matching:
        # e.g. candidateName only, or partial matching, or matching against enquiries table
        enq_matches = []
        for r in unlinked_rows:
            eid = r.get('enquiry_id')
            cname = (r.get('candidateName') or '').strip()
            comp = (r.get('companyName') or '').strip()
            bn = (r.get('billNumber') or '').strip()
            
            # Check in enquiries table
            if eid and eid > 0:
                cur.execute("SELECT id, bill_no, bill_date, bill_amount, companyName, info FROM enquiries WHERE id = %s", [eid])
                enq = cur.fetchone()
                if enq:
                    enq_matches.append({'reversal_id': r['id'], 'enq_id': enq['id'], 'bill_date': str(enq['bill_date']), 'bill_amount': float(enq['bill_amount'] or 0), 'info': enq.get('info')})
            elif cname and comp:
                cur.execute("SELECT id, bill_no, bill_date, bill_amount, companyName, info FROM enquiries WHERE companyName LIKE %s LIMIT 1", [f"%{comp[:15]}%"])
                enq = cur.fetchone()
                if enq:
                    enq_matches.append({'reversal_id': r['id'], 'enq_id': enq['id'], 'bill_date': str(enq['bill_date']), 'bill_amount': float(enq['bill_amount'] or 0), 'info': enq.get('info')})

        print(f"Unlinked reversals matched to enquiries table: {len(enq_matches)}")

        # Check sample of unlinked rows (IDs and attributes)
        print("Sample 5 unlinked reversal rows (attributes):")
        for ur in unlinked_rows[:5]:
            print({k: ur[k] for k in ['id', 'billNumber', 'enquiry_id', 'billDate', 'info', 'totalBillAmt', 'ourShare']})

    # -------------------------------------------------------------
    # 3. CHURN COST COMPARISON
    # -------------------------------------------------------------
    print("\n--- 3. CHURN COST COMPARISON ---")
    with conn.cursor() as cur:
        cur.execute("""
            SELECT totalBillAmt, totalGST, ourShare
            FROM invoice
            WHERE billDate BETWEEN '2026-04-01' AND '2027-03-31'
              AND info IN ('RV', 'CN', 'LEGAL', 'LEGAL-CN')
        """)
        reversals = cur.fetchall()

        sum_our_share = sum(float(r['ourShare'] or 0.0) for r in reversals)
        sum_rev_ex_gst = sum(float(r['totalBillAmt'] or 0.0) / 1.18 for r in reversals)
        sum_current_cop = sum(float(abs(r['ourShare'] or r['totalBillAmt'])) for r in reversals)

        print(f"FY 2026-27 COP Churn Cost under different definitions (265 reversal rows):")
        print(f"  1. ourShare only: Rs {sum_our_share:,.2f}")
        print(f"  2. rev_ex_gst only: Rs {sum_rev_ex_gst:,.2f}")
        print(f"  3. Current COP Formula (`ourShare or totalBillAmt`): Rs {sum_current_cop:,.2f}")

    # -------------------------------------------------------------
    # 4. RECONCILIATION OF FY 2024-25 REVENUE FIGURES
    # -------------------------------------------------------------
    print("\n--- 4. RECONCILIATION OF FY 2024-25 REVENUE FIGURES ---")
    with conn.cursor() as cur:
        cur.execute("""
            SELECT COUNT(*) as cnt, SUM(totalBillAmt) as billed, SUM(rev_ex_gst) as rev_ex_gst,
                   SUM(ourShare) as our_share, SUM(franchiseeShare) as franchisee_share
            FROM v_invoice_clean
            WHERE fy = '2024-2025' AND is_revenue = 1
        """)
        sub_a = cur.fetchone()
        print("Subset A: `v_invoice_clean` with `fy = '2024-2025' AND is_revenue = 1`:")
        print(sub_a)

        cur.execute("""
            SELECT COUNT(*) as cnt, SUM(totalBillAmt) as billed,
                   SUM(totalBillAmt / 1.18) as rev_ex_gst,
                   SUM(ourShare) as our_share, SUM(franchiseeShare) as franchisee_share
            FROM invoice
            WHERE billDate BETWEEN '2024-04-01' AND '2025-03-31'
        """)
        sub_b = cur.fetchone()
        print("\nSubset B: `invoice` table directly with `billDate BETWEEN '2024-04-01' AND '2025-03-31'` (all rows):")
        print(sub_b)

        cur.execute("""
            SELECT COUNT(*) as cnt, SUM(totalBillAmt) as billed,
                   SUM(totalBillAmt / 1.18) as rev_ex_gst,
                   SUM(ourShare) as our_share, SUM(franchiseeShare) as franchisee_share
            FROM invoice
            WHERE financialYear = '2024-2025'
        """)
        sub_c = cur.fetchone()
        print("\nSubset C: `invoice` table with `financialYear = '2024-2025'`:")
        print(sub_c)

        cur.execute("""
            SELECT COUNT(*) as cnt, SUM(totalBillAmt) as billed,
                   SUM(ROUND(totalBillAmt / 1.18, 2)) as rev_ex_gst
            FROM invoice
            WHERE billDate BETWEEN '2024-04-01' AND '2025-03-31'
              AND (info IS NULL OR info NOT IN ('RV', 'CN', 'LEGAL', 'LEGAL-CN'))
        """)
        sub_d = cur.fetchone()
        print("\nSubset D: Positive invoice in date range:")
        print(sub_d)

        cur.execute("""
            SELECT info, COUNT(*) as cnt, SUM(totalBillAmt) as billed,
                   SUM(totalBillAmt / 1.18) as rev_ex_gst
            FROM invoice
            WHERE billDate BETWEEN '2024-04-01' AND '2025-03-31'
            GROUP BY info
        """)
        info_24 = cur.fetchall()
        print("\nFY 2024-25 by info field:")
        for r in info_24:
            print(r)

    conn.close()

if __name__ == "__main__":
    run_inspection()
