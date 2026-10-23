"""
backend/scripts/inspect_step2_details.py
Inspect:
1. Reversals impact on placements and positive labels
2. Breakdown of the 34 contaminated episodes (would-be positives vs negatives)
3. Never-activated franchisees verification
"""

import sys
import os
import argparse
import datetime
from collections import defaultdict, Counter
import pandas as pd
import numpy as np

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from scripts.db_guard import get_db_connection, add_db_safety_args

def parse_date(d):
    if d is None:
        return None
    if isinstance(d, (datetime.date, datetime.datetime)):
        return d if isinstance(d, datetime.date) and not isinstance(d, datetime.datetime) else d.date()
    s = str(d).strip()[:10]
    for fmt in ('%Y-%m-%d', '%d-%m-%Y', '%Y/%m/%d', '%d/%m/%Y'):
        try:
            return datetime.datetime.strptime(s, fmt).date()
        except Exception:
            pass
    return None

def run():
    parser = argparse.ArgumentParser()
    add_db_safety_args(parser)
    args = parser.parse_args()
    conn, host, db = get_db_connection(args)
    today = datetime.date(2026, 10, 23)

    cur = conn.cursor()

    # 1. Total credit notes and reversals in database
    cur.execute("""
        SELECT 
            info,
            COUNT(*) as cnt,
            SUM(totalBillAmt) as sum_billed,
            SUM(serviceCharges) as sum_svc
        FROM invoice
        WHERE info IN ('CN', 'LEGAL-CN') OR LOWER(status) = 'cancelled'
        GROUP BY info
    """)
    cn_summary = cur.fetchall()
    print("=== CREDIT NOTE / REVERSAL INVOICE SUMMARY ===")
    for r in cn_summary:
        print(f"  info: {r['info']} | cnt: {r['cnt']} | billed: {r['sum_billed']} | svc: {r['sum_svc']}")

    # 2. Check how many invoices match cn_enq_ids or cn_bills
    cur.execute("SELECT enquiry_id, billNumber FROM invoice WHERE info IN ('CN', 'LEGAL-CN') OR status = 'cancelled'")
    cn_rows = cur.fetchall()
    cn_enq_ids = set(r['enquiry_id'] for r in cn_rows if r['enquiry_id'])
    cn_bills = set(str(r['billNumber']).strip().lower() for r in cn_rows if r['billNumber'])
    print(f"\nUnique CN enquiry_ids: {len(cn_enq_ids)}, Unique CN bill numbers: {len(cn_bills)}")

    # 3. Reversals tied to franchisee placements
    cur.execute("""
        SELECT id, nameAsPerAgreement FROM franchisees
    """)
    master_franchisees = cur.fetchall()
    id_by_clean_name = {}
    for f in master_franchisees:
        cname = (f['nameAsPerAgreement'] or '').strip().lower()
        if cname:
            id_by_clean_name[cname] = f['id']

    cur.execute("""
        SELECT 
            e.id as enquiry_id,
            e.franchiseeName,
            e.enquiryStatus,
            e.bill_no,
            e.bill_date,
            e.dateOfAllocation,
            e.created_at,
            i.id as invoice_id,
            i.franchiseName,
            i.billNumber as invoice_bill_no,
            i.billDate as invoice_bill_date,
            i.serviceCharges,
            i.info as invoice_info,
            i.status as invoice_status
        FROM enquiries e
        LEFT JOIN invoice i ON e.id = i.enquiry_id
    """)
    raw_enquiries = cur.fetchall()

    reversed_placements_count = 0
    non_reversed_placements_count = 0
    
    # We will build two sets of episodes:
    # Set A: WITH reversals dropped (our current clean logic)
    # Set B: WITHOUT dropping reversals (raw placements)
    
    for r in raw_enquiries:
        status = (r['enquiryStatus'] or '').strip().lower()
        inv_info = (r['invoice_info'] or '').strip().upper()
        b_no = (r['invoice_bill_no'] or r['bill_no'] or '').strip().lower()
        is_rev = (r['enquiry_id'] in cn_enq_ids) or (b_no and b_no in cn_bills) or (status in ('cancelled', 'credit_note')) or (r['invoice_status'] == 'cancelled')
        
        has_rev_invoice = (r['invoice_id'] is not None and inv_info in ('R', 'PR', 'O', ''))
        is_candidate = (status == 'closed') or (has_rev_invoice and status not in ('cancelled', 'credit_note'))
        
        if is_candidate:
            if is_rev:
                reversed_placements_count += 1
            else:
                non_reversed_placements_count += 1

    print(f"\nCandidate Placements Breakdown:")
    print(f"  Valid Non-reversed placements: {non_reversed_placements_count}")
    print(f"  Reversed / Cancelled placements dropped: {reversed_placements_count}")

    # 4. Now let's trace the 34 CONTAMINATED episodes!
    # Contaminated means: franchisee had an unbilled closed deal inside [d_prev, snap + 90d]
    # Let's see what their label would have been (did they have a verified placement within snap + 90d?)
    # Let's rerun the loop and record contaminated episodes with their counterfactual label!
    
    verified_placements = defaultdict(list)
    unbilled_closed = defaultdict(list)

    for r in raw_enquiries:
        status = (r['enquiryStatus'] or '').strip().lower()
        inv_info = (r['invoice_info'] or '').strip().upper()
        has_rev_invoice = (r['invoice_id'] is not None and inv_info in ('R', 'PR', 'O', ''))

        e_name = (r['franchiseeName'] or '').strip().lower()
        i_name = (r['franchiseName'] or '').strip().lower()
        fid = id_by_clean_name.get(e_name) or id_by_clean_name.get(i_name)

        d_inv = parse_date(r['invoice_bill_date'])
        d_enq = parse_date(r['bill_date'])
        verified_date = d_inv or d_enq
        alloc_date = parse_date(r['dateOfAllocation']) or parse_date(r['created_at'])

        b_no = (r['invoice_bill_no'] or r['bill_no'] or '').strip().lower()
        is_rev = (r['enquiry_id'] in cn_enq_ids) or (b_no and b_no in cn_bills) or (status in ('cancelled', 'credit_note'))

        if not fid or is_rev:
            continue

        is_candidate = (status == 'closed') or (has_rev_invoice and status not in ('cancelled', 'credit_note'))
        if is_candidate:
            if verified_date:
                verified_placements[fid].append({
                    'enquiry_id': r['enquiry_id'],
                    'date': verified_date
                })
            else:
                if alloc_date:
                    unbilled_closed[fid].append({
                        'enquiry_id': r['enquiry_id'],
                        'date': alloc_date
                    })

    for fid in verified_placements:
        verified_placements[fid].sort(key=lambda x: x['date'])
    for fid in unbilled_closed:
        unbilled_closed[fid].sort(key=lambda x: x['date'])

    contaminated_labels = []
    clean_labels = []

    for fid, p_list in verified_placements.items():
        dates = [p['date'] for p in p_list]
        unbilled_dates = [u['date'] for u in unbilled_closed.get(fid, [])]

        for i in range(len(dates) - 1):
            d_prev = dates[i]
            d_next = dates[i + 1]
            gap = (d_next - d_prev).days

            if gap >= 180:
                snap = d_prev + datetime.timedelta(days=180)
                window_end = snap + datetime.timedelta(days=90)

                if window_end > today:
                    continue

                label = 1 if d_next <= window_end else 0

                is_contaminated = unbilled_dates and any(d_prev < ud <= window_end for ud in unbilled_dates)
                if is_contaminated:
                    contaminated_labels.append(label)
                else:
                    clean_labels.append(label)

        # Trailing gap
        last_d = dates[-1]
        trailing_gap = (today - last_d).days
        if trailing_gap >= 180:
            snap = last_d + datetime.timedelta(days=180)
            window_end = snap + datetime.timedelta(days=90)

            if window_end <= today:
                is_contaminated = unbilled_dates and any(last_d < ud <= window_end for ud in unbilled_dates)
                if is_contaminated:
                    contaminated_labels.append(0) # trailing gap has no subsequent placement
                else:
                    clean_labels.append(0)

    print(f"\n=== CONTAMINATED EPISODES (34) ANALYSIS ===")
    print(f"Total contaminated episodes: {len(contaminated_labels)}")
    print(f"Contaminated breakdown: Positives = {sum(1 for l in contaminated_labels if l == 1)}, Negatives = {sum(1 for l in contaminated_labels if l == 0)}")
    print(f"Contaminated positive rate: {sum(contaminated_labels)/len(contaminated_labels)*100:.2f}%")
    print(f"Clean episodes positive rate: {sum(clean_labels)/len(clean_labels)*100:.2f}% (Positives: {sum(clean_labels)}, Negatives: {len(clean_labels)-sum(clean_labels)})")

    # If we pooled both (clean + contaminated):
    pooled = clean_labels + contaminated_labels
    print(f"\nIf contaminated episodes were KEPT (pooled {len(pooled)} episodes):")
    print(f"  Pooled Positives: {sum(pooled)} ({sum(pooled)/len(pooled)*100:.2f}%), Negatives: {len(pooled)-sum(pooled)}")

    conn.close()

if __name__ == '__main__':
    run()
