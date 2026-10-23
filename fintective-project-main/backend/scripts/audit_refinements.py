"""
backend/scripts/audit_refinements.py
Comprehensive audit addressing all Step 0 refinement items requested by user:
1. Franchisee name match rates (enquiries and invoices) and unmatched placements count.
2. Placements reversed by credit note / cancellation netting audit.
3. franchisees.status distribution among the 356 with placements.
4. Primary dataset with verified bill dates only, contaminated episode exclusion count.
5. Distinct franchisees in episodes/positives, positives per year, last 18 months test window.
"""

import os
import sys
import argparse
import datetime
from collections import defaultdict, Counter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from db_guard import add_db_safety_args, get_db_connection

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
    parser = argparse.ArgumentParser(description="Audit Refinements for Step 0")
    add_db_safety_args(parser)
    args = parser.parse_args()

    conn, host, db_name = get_db_connection(args)
    today = datetime.date(2026, 10, 23)

    try:
        with conn.cursor() as cur:
            # ---------------------------------------------------------
            # 1. Master Franchisees
            # ---------------------------------------------------------
            cur.execute("SELECT id, nameAsPerAgreement, onboardingDate, status FROM franchisees")
            master_franchisees = cur.fetchall()
            
            fran_by_id = {f['id']: f for f in master_franchisees}
            id_by_clean_name = {}
            for f in master_franchisees:
                clean_name = (f['nameAsPerAgreement'] or '').strip().lower()
                if clean_name:
                    id_by_clean_name[clean_name] = f['id']

            # ---------------------------------------------------------
            # 2. Raw Enquiries and Invoices
            # ---------------------------------------------------------
            cur.execute("""
                SELECT 
                    e.id as enquiry_id,
                    e.franchiseeName as enquiry_fran_name,
                    e.enquiryStatus,
                    e.bill_no as enquiry_bill_no,
                    e.bill_date as enquiry_bill_date,
                    e.dateOfAllocation,
                    e.created_at as enquiry_created_at,
                    e.placementFees,
                    e.positionName,
                    e.industry,
                    i.id as invoice_id,
                    i.franchiseName as invoice_fran_name,
                    i.billNumber as invoice_bill_no,
                    i.billDate as invoice_bill_date,
                    i.serviceCharges,
                    i.info as invoice_info,
                    i.status as invoice_status
                FROM enquiries e
                LEFT JOIN invoice i ON e.id = i.enquiry_id
            """)
            all_rows = cur.fetchall()

            # Separate Credit Notes and Cancellations
            # Check invoices with CN info
            cur.execute("SELECT enquiry_id, billNumber, info, status, serviceCharges FROM invoice WHERE info IN ('CN', 'LEGAL-CN') OR status = 'cancelled'")
            cn_invoices = cur.fetchall()
            cn_enquiry_ids = set(r['enquiry_id'] for r in cn_invoices if r['enquiry_id'])
            cn_bill_numbers = set(str(r['billNumber']).strip().lower() for r in cn_invoices if r['billNumber'])

            # ---------------------------------------------------------
            # 3. Match Rates Audit
            # ---------------------------------------------------------
            enq_fran_names = set()
            enq_fran_matched = set()
            inv_fran_names = set()
            inv_fran_matched = set()

            unmatched_placements_count = 0
            total_placements_rows = 0

            # Placements tracking
            # Primary definition: verified bill dates only
            verified_placements_by_fran = defaultdict(list)
            # Unbilled closed deals (ghost deals) tracking for contamination exclusion
            unbilled_closed_by_fran = defaultdict(list)
            # Reversals tracking
            reversed_placements_by_fran = defaultdict(list)

            for r in all_rows:
                status = (r['enquiryStatus'] or '').strip().lower()
                inv_info = (r['invoice_info'] or '').strip().upper()
                has_rev_invoice = (r['invoice_id'] is not None and inv_info in ('R', 'PR', 'O', ''))

                is_candidate_placement = (status == 'closed') or (has_rev_invoice and status not in ('cancelled', 'credit_note'))
                if not is_candidate_placement:
                    continue

                total_placements_rows += 1

                e_name = (r['enquiry_fran_name'] or '').strip().lower()
                i_name = (r['invoice_fran_name'] or '').strip().lower()

                if e_name:
                    enq_fran_names.add(e_name)
                    if e_name in id_by_clean_name:
                        enq_fran_matched.add(e_name)

                if i_name:
                    inv_fran_names.add(i_name)
                    if i_name in id_by_clean_name:
                        inv_fran_matched.add(i_name)

                matched_fid = id_by_clean_name.get(e_name) or id_by_clean_name.get(i_name)
                if not matched_fid:
                    unmatched_placements_count += 1
                    continue

                # Check if this placement was reversed by CN or cancellation
                b_no = (r['invoice_bill_no'] or r['enquiry_bill_no'] or '').strip().lower()
                is_reversed = (r['enquiry_id'] in cn_enquiry_ids) or (b_no and b_no in cn_bill_numbers) or (status in ('cancelled', 'credit_note'))

                # Primary bill date
                d_inv = parse_date(r['invoice_bill_date'])
                d_enq = parse_date(r['enquiry_bill_date'])
                verified_date = d_inv or d_enq

                if verified_date:
                    item = {
                        'enquiry_id': r['enquiry_id'],
                        'date': verified_date,
                        'is_reversed': is_reversed,
                        'fee': float(r['serviceCharges'] or r['placementFees'] or 0.0),
                        'industry': r['industry'] or 'Other Services',
                        'position': r['positionName'] or ''
                    }
                    if is_reversed:
                        reversed_placements_by_fran[matched_fid].append(item)
                    else:
                        verified_placements_by_fran[matched_fid].append(item)
                else:
                    # Unbilled closed deal
                    fallback_d = parse_date(r['dateOfAllocation']) or parse_date(r['enquiry_created_at'])
                    if fallback_d:
                        unbilled_closed_by_fran[matched_fid].append({
                            'enquiry_id': r['enquiry_id'],
                            'date': fallback_d,
                            'fee': float(r['placementFees'] or 0.0)
                        })

            # Sort timelines
            for fid in verified_placements_by_fran:
                verified_placements_by_fran[fid].sort(key=lambda x: x['date'])
            for fid in unbilled_closed_by_fran:
                unbilled_closed_by_fran[fid].sort(key=lambda x: x['date'])

            # ---------------------------------------------------------
            # 4. Report Match Rates
            # ---------------------------------------------------------
            print("=" * 78)
            print("ITEM 3(a): FRANCHISEE NAME-MATCH RATE AUDIT")
            print("=" * 78)
            print(f"Total Franchisees in Master: {len(master_franchisees)}")
            print(f"Enquiries Franchisee Names: {len(enq_fran_names)} distinct names, {len(enq_fran_matched)} matched ({len(enq_fran_matched)/len(enq_fran_names)*100:.2f}%)")
            print(f"Invoices Franchise Names:   {len(inv_fran_names)} distinct names, {len(inv_fran_matched)} matched ({len(inv_fran_matched)/len(inv_fran_names)*100:.2f}%)")
            print(f"Placements Rows:            {total_placements_rows} total, {unmatched_placements_count} unmatched ({unmatched_placements_count/total_placements_rows*100:.2f}%)")
            print(f"Successfully Matched Placements: {total_placements_rows - unmatched_placements_count}")

            # ---------------------------------------------------------
            # 5. Franchisees.status Distribution among Franchisees with Placements
            # ---------------------------------------------------------
            print("\n" + "=" * 78)
            print("ITEM 3(c): FRANCHISEES.STATUS DISTRIBUTION (AMONG THE 356 WITH PLACEMENTS)")
            print("=" * 78)
            all_placed_fids = set(verified_placements_by_fran.keys()) | set(unbilled_closed_by_fran.keys())
            status_counter = Counter(fran_by_id[fid]['status'] for fid in all_placed_fids if fid in fran_by_id)
            print(f"Franchisees with >= 1 placement: {len(all_placed_fids)}")
            for st, cnt in status_counter.items():
                print(f"   - status = '{st}': {cnt} ({cnt/len(all_placed_fids)*100:.1f}%)")

            # ---------------------------------------------------------
            # 6. Reversals Impact Analysis
            # ---------------------------------------------------------
            print("\n" + "=" * 78)
            print("ITEM 3(b): PLACEMENTS REVERSED BY CREDIT NOTES / CANCELLATION")
            print("=" * 78)
            total_reversed = sum(len(v) for v in reversed_placements_by_fran.values())
            print(f"Placements reversed by CN or cancellation: {total_reversed}")

            # Compare episodes with reversals included vs netted out
            def compute_episodes(p_map, exclude_unbilled=True):
                episodes = []
                censored = 0
                contaminated_exclusions = 0

                for fid, p_list in p_map.items():
                    dates = [p['date'] for p in p_list]
                    if not dates:
                        continue
                    
                    unbilled_dates = [u['date'] for u in unbilled_closed_by_fran.get(fid, [])]

                    # Gaps between placements
                    for i in range(len(dates) - 1):
                        d_prev = dates[i]
                        d_next = dates[i + 1]
                        gap = (d_next - d_prev).days

                        if gap >= 180:
                            snap = d_prev + datetime.timedelta(days=180)
                            window_end = snap + datetime.timedelta(days=90)

                            if window_end > today:
                                censored += 1
                                continue

                            # Check contamination: unbilled closed deal inside [d_prev, window_end]
                            if exclude_unbilled and unbilled_dates:
                                has_ghost = any(d_prev < ud <= window_end for ud in unbilled_dates)
                                if has_ghost:
                                    contaminated_exclusions += 1
                                    continue

                            label = 1 if d_next <= window_end else 0
                            episodes.append({
                                'franchisee_id': fid,
                                'snapshot_date': snap,
                                'prior_date': d_prev,
                                'next_date': d_next,
                                'label': label
                            })

                    # Trailing gap after last placement
                    last_d = dates[-1]
                    trailing_gap = (today - last_d).days
                    if trailing_gap >= 180:
                        snap = last_d + datetime.timedelta(days=180)
                        window_end = snap + datetime.timedelta(days=90)

                        if window_end <= today:
                            if exclude_unbilled and unbilled_dates:
                                has_ghost = any(last_d < ud <= window_end for ud in unbilled_dates)
                                if has_ghost:
                                    contaminated_exclusions += 1
                                    continue

                            episodes.append({
                                'franchisee_id': fid,
                                'snapshot_date': snap,
                                'prior_date': last_d,
                                'next_date': None,
                                'label': 0
                            })
                        else:
                            censored += 1

                return episodes, censored, contaminated_exclusions

            # Build map with reversals included
            p_map_with_reversed = defaultdict(list)
            for fid in set(verified_placements_by_fran.keys()) | set(reversed_placements_by_fran.keys()):
                combined = verified_placements_by_fran[fid] + reversed_placements_by_fran[fid]
                combined.sort(key=lambda x: x['date'])
                p_map_with_reversed[fid] = combined

            ep_netted, cens_netted, contam_netted = compute_episodes(verified_placements_by_fran, exclude_unbilled=True)
            ep_with_rev, cens_with_rev, contam_with_rev = compute_episodes(p_map_with_reversed, exclude_unbilled=True)

            pos_netted = sum(1 for e in ep_netted if e['label'] == 1)
            neg_netted = sum(1 for e in ep_netted if e['label'] == 0)
            pos_with_rev = sum(1 for e in ep_with_rev if e['label'] == 1)
            neg_with_rev = sum(1 for e in ep_with_rev if e['label'] == 0)

            print(f"When Reversals are NETTED OUT (Primary): Evaluated={len(ep_netted)}, Positives={pos_netted}, Negatives={neg_netted}, Rate={pos_netted/len(ep_netted)*100:.2f}%")
            print(f"If Reversals were KEPT:                  Evaluated={len(ep_with_rev)}, Positives={pos_with_rev}, Negatives={neg_with_rev}, Rate={pos_with_rev/len(ep_with_rev)*100:.2f}%")
            print(f"Episodes changing status due to reversal netting: {abs(len(ep_netted) - len(ep_with_rev))} total, {abs(pos_netted - pos_with_rev)} positives.")

            # ---------------------------------------------------------
            # 7. Primary Dataset: Verified Bill Dates Only & Contamination Filter
            # ---------------------------------------------------------
            print("\n" + "=" * 78)
            print("ITEM 2: PRIMARY DATASET (VERIFIED BILL DATES ONLY & CONTAMINATION FILTER)")
            print("=" * 78)
            print(f"Total Evaluated Episodes (Clean):           {len(ep_netted)}")
            print(f"Episodes Excluded due to Unbilled Deals:    {contam_netted}")
            print(f"Right-Censored Episodes:                    {cens_netted}")
            print(f"Clean Positive Episodes (Reactivated <=90d): {pos_netted}")
            print(f"Clean Negative Episodes (Did not reactivate): {neg_netted}")
            print(f"Clean Empirical Reactivation Rate:          {pos_netted/len(ep_netted)*100:.2f}%")

            # ---------------------------------------------------------
            # 8. Distinct Franchisees, Positives per Year & Test Window
            # ---------------------------------------------------------
            print("\n" + "=" * 78)
            print("ITEM 4: TEMPORAL & FRANCHISEE DISTRIBUTION")
            print("=" * 78)
            distinct_fran_in_episodes = len(set(e['franchisee_id'] for e in ep_netted))
            distinct_fran_in_positives = len(set(e['franchisee_id'] for e in ep_netted if e['label'] == 1))
            print(f"Distinct Franchisees in Evaluated Episodes: {distinct_fran_in_episodes}")
            print(f"Distinct Franchisees in Positive Episodes:  {distinct_fran_in_positives}")

            # Positives per snapshot year
            pos_by_year = Counter(e['snapshot_date'].year for e in ep_netted if e['label'] == 1)
            total_by_year = Counter(e['snapshot_date'].year for e in ep_netted)
            print("\nEpisodes & Positives Breakdown by Snapshot Year:")
            for yr in sorted(total_by_year.keys()):
                print(f"   - {yr}: Total Episodes = {total_by_year[yr]:3d} | Positives = {pos_by_year[yr]:2d} ({pos_by_year[yr]/total_by_year[yr]*100:.1f}%)")

            # Last 18 months test window (snapshots >= 2025-04-23)
            cutoff_18m = today - datetime.timedelta(days=18 * 30)  # ~540 days
            ep_last_18m = [e for e in ep_netted if e['snapshot_date'] >= cutoff_18m]
            pos_last_18m = [e for e in ep_last_18m if e['label'] == 1]
            print(f"\nLast 18 Months (Snapshots >= {cutoff_18m}):")
            print(f"   - Total Evaluated Episodes in Last 18m: {len(ep_last_18m)}")
            print(f"   - Positives in Last 18m:                 {len(pos_last_18m)} ({len(pos_last_18m)/len(ep_last_18m)*100:.1f}%)")
            print(f"   - Pre-18m (Training Window) Episodes:   {len(ep_netted) - len(ep_last_18m)} (Positives: {pos_netted - len(pos_last_18m)})")

    finally:
        conn.close()

if __name__ == '__main__':
    run()
