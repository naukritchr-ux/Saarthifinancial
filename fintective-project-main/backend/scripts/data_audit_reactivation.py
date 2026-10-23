"""
backend/scripts/data_audit_reactivation.py
STEP 0 - Data Audit for Franchisee Reactivation Likelihood & Skill Matching

SAFETY:
- Read-only on CRM tables.
- Requires --i-know-this-is-prod if target host equals production host.
- Accepts --env staging (default) or --env prod.
- Anonymizes PII: logs only IDs and aggregated metrics.
"""

import os
import sys
import argparse
import datetime
from collections import defaultdict
import pymysql
import pymysql.cursors
from dotenv import load_dotenv

PROD_HOST_PATTERN = "aivencloud.com"

def get_args():
    parser = argparse.ArgumentParser(description="Franchisee Reactivation Data Audit (Step 0)")
    parser.add_argument("--env", choices=["staging", "prod"], default="prod",
                        help="Environment to use: staging (.env.staging) or prod (.env). Default: prod")
    parser.add_argument("--i-know-this-is-prod", action="store_true",
                        help="Explicit safety acknowledgment flag required when connecting to production host.")
    parser.add_argument("--gap-days", type=int, default=180,
                        help="Dormancy threshold in days (default: 180)")
    parser.add_argument("--window-days", type=int, default=90,
                        help="Reactivation target window in days (default: 90)")
    return parser.parse_args()


def load_db_config(env_name):
    backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    env_file = os.path.join(backend_dir, '.env.staging' if env_name == 'staging' else '.env')
    if os.path.exists(env_file):
        load_dotenv(env_file, override=True)
    else:
        print(f"[Warning] Env file not found: {env_file}")

    db_host = os.getenv("DB_HOST", "localhost").strip()
    db_port = int(os.getenv("DB_PORT", 3306))
    db_user = os.getenv("DB_USER", "root").strip()
    db_password = os.getenv("DB_PASSWORD", "")
    db_name = os.getenv("DB_NAME", "crm_db").strip()
    db_ssl = os.getenv("DB_SSL", "false").lower() in ("true", "1", "yes")

    return {
        "host": db_host,
        "port": db_port,
        "user": db_user,
        "password": db_password,
        "database": db_name,
        "ssl": {"ssl": {}} if db_ssl else None,
        "cursorclass": pymysql.cursors.DictCursor
    }


def verify_safety(db_cfg, args):
    host = db_cfg["host"].lower()
    is_prod_host = PROD_HOST_PATTERN in host or args.env == "prod"
    if is_prod_host and not args.i_know_this_is_prod:
        print("\n" + "!" * 78)
        print("SAFETY GUARD TRIGGERED:")
        print(f"Target database host '{db_cfg['host']}' is detected as production / remote host.")
        print("To run read-only audit against production, you MUST explicitly provide:")
        print("   --i-know-this-is-prod")
        print("Otherwise configure backend/.env.staging to point to a local/staging database.")
        print("!" * 78 + "\n")
        sys.exit(1)


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


def run_audit(args):
    db_cfg = load_db_config(args.env)
    verify_safety(db_cfg, args)

    print("\n" + "=" * 78)
    print(f"FRANCHISEE REACTIVATION AUDIT (STEP 0) | Host: {db_cfg['host']} | DB: {db_cfg['database']}")
    print("=" * 78)

    conn_kwargs = {k: v for k, v in db_cfg.items() if v is not None}
    conn = pymysql.connect(**conn_kwargs)

    try:
        with conn.cursor() as cur:
            # 1. Franchisee Master List
            cur.execute("SELECT id, nameAsPerAgreement, onboardingDate, status FROM franchisees")
            franchisees = cur.fetchall()
            total_franchisees = len(franchisees)

            fran_id_by_name = {}
            for f in franchisees:
                name_clean = str(f['nameAsPerAgreement'] or '').strip().lower()
                if name_clean:
                    fran_id_by_name[name_clean] = f['id']

            print(f"\n1. Franchisee Master Count: {total_franchisees}")

            # 2. Enquiry Status Distribution
            cur.execute("SELECT enquiryStatus, COUNT(*) as cnt FROM enquiries GROUP BY enquiryStatus ORDER BY cnt DESC")
            status_dist = cur.fetchall()
            print("\n2. Enquiry Status Breakdown in Database:")
            for s in status_dist:
                print(f"   - {s['enquiryStatus'] or '(blank)'}: {s['cnt']}")

            # 3. Pull all enquiries and matching invoices
            # Placements are determined by:
            # A) Closed enquiries (enquiryStatus = 'closed')
            # B) Invoices with revenue info codes ('R', 'PR', 'O') or billed status
            cur.execute("""
                SELECT 
                    e.id as enquiry_id,
                    e.franchiseeName as enquiry_fran_name,
                    e.enquiryStatus,
                    e.bill_no as enquiry_bill_no,
                    e.bill_date as enquiry_bill_date,
                    e.dateOfAllocation,
                    e.dateClientAcquired,
                    e.created_at as enquiry_created_at,
                    e.placementFees,
                    e.positionName,
                    e.industry,
                    i.id as invoice_id,
                    i.franchiseName as invoice_fran_name,
                    i.billNumber as invoice_bill_no,
                    i.billDate as invoice_bill_date,
                    i.serviceCharges,
                    i.info as invoice_info
                FROM enquiries e
                LEFT JOIN invoice i ON e.id = i.enquiry_id
            """)
            raw_rows = cur.fetchall()
            print(f"\n3. Total Enquiry-Invoice joined rows: {len(raw_rows)}")

            # Process placements
            # Known Data Issue Analysis:
            # A placement record is valid if enquiryStatus == 'closed' OR invoice exists with revenue info ('R', 'PR', 'O')
            placements_by_fran = defaultdict(list)
            missing_bill_date_count = 0
            fallback_allocation_count = 0
            fallback_created_count = 0
            fallback_acquired_count = 0
            possible_unrecorded_by_fran = defaultdict(int)

            matched_fran_rows = 0
            unmatched_fran_rows = 0

            all_placement_dates = []

            for r in raw_rows:
                status = (r['enquiryStatus'] or '').strip().lower()
                inv_info = (r['invoice_info'] or '').strip().upper()
                has_rev_invoice = (r['invoice_id'] is not None and inv_info in ('R', 'PR', 'O', ''))

                is_placement = (status == 'closed') or (has_rev_invoice and status not in ('cancelled', 'credit_note'))
                if not is_placement:
                    continue

                # Identify Franchisee ID
                f_name = (r['enquiry_fran_name'] or r['invoice_fran_name'] or '').strip().lower()
                f_id = fran_id_by_name.get(f_name)

                if f_id is None:
                    unmatched_fran_rows += 1
                    # synthetic fallback key if name exists
                    f_id = f"unmatched_{f_name}" if f_name else "unknown"
                else:
                    matched_fran_rows += 1

                # Date hierarchy:
                # 1. invoice_bill_date
                # 2. enquiry_bill_date
                # 3. fallback dateOfAllocation
                # 4. fallback dateClientAcquired
                # 5. fallback created_at
                d_inv = parse_date(r['invoice_bill_date'])
                d_enq = parse_date(r['enquiry_bill_date'])
                primary_date = d_inv or d_enq

                date_source = 'bill_date'
                event_date = primary_date

                if not event_date:
                    missing_bill_date_count += 1
                    possible_unrecorded_by_fran[f_id] += 1
                    d_alloc = parse_date(r['dateOfAllocation'])
                    d_acq = parse_date(r['dateClientAcquired'])
                    d_cre = parse_date(r['enquiry_created_at'])

                    if d_alloc:
                        event_date = d_alloc
                        date_source = 'dateOfAllocation'
                        fallback_allocation_count += 1
                    elif d_acq:
                        event_date = d_acq
                        date_source = 'dateClientAcquired'
                        fallback_acquired_count += 1
                    elif d_cre:
                        event_date = d_cre
                        date_source = 'created_at'
                        fallback_created_count += 1
                    else:
                        date_source = 'none'

                if event_date:
                    all_placement_dates.append(event_date)
                    fee = float(r['serviceCharges'] or r['placementFees'] or 0.0)
                    placements_by_fran[f_id].append({
                        'enquiry_id': r['enquiry_id'],
                        'date': event_date,
                        'is_fallback_date': primary_date is None,
                        'date_source': date_source,
                        'fee': fee,
                        'industry': r['industry'] or 'Other Services',
                        'position': r['positionName'] or ''
                    })

            # Sort timeline per franchisee
            for fid in placements_by_fran:
                placements_by_fran[fid].sort(key=lambda x: x['date'])

            print("\n4. Placement Extraction & Missing Date Audit:")
            print(f"   - Matched to Franchisee ID: {matched_fran_rows} rows")
            print(f"   - Unmatched Franchisee Name: {unmatched_fran_rows} rows")
            print(f"   - Placements with valid bill_date (invoice or enquiry): {len(all_placement_dates) - missing_bill_date_count}")
            print(f"   - Placements lacking bill_date (ghost/unbilled closed): {missing_bill_date_count}")
            print(f"     * Fallback to dateOfAllocation: {fallback_allocation_count}")
            print(f"     * Fallback to dateClientAcquired: {fallback_acquired_count}")
            print(f"     * Fallback to created_at: {fallback_created_count}")

            if all_placement_dates:
                min_d = min(all_placement_dates)
                max_d = max(all_placement_dates)
                print(f"   - Overall Placement Date Range: {min_d} to {max_d}")

            # 4. Dormancy Episodes Construction
            # Definition:
            # - Franchisee had at least 1 placement.
            # - 180 consecutive days with NO placement.
            # - Snapshot date = day the 180-day gap is reached (i.e. placement_date + 180 days).
            # - Label = 1 if placement recorded within [snapshot_date, snapshot_date + 90 days], else 0.
            # - Right-censoring: snapshot_date + 90 days <= today_date.
            today = datetime.date(2026, 10, 23)  # current Asia/Kolkata date
            gap_days = args.gap_days
            window_days = args.window_days

            episodes = []
            episodes_censored = 0
            episodes_positive = 0
            episodes_negative = 0

            # Count franchisees with at least 1 placement
            # (Only real franchisee IDs, not unmatched string keys)
            real_fran_with_placements = [fid for fid in placements_by_fran if isinstance(fid, int) and len(placements_by_fran[fid]) > 0]
            print(f"\n5. Franchisee Cohort Summary:")
            print(f"   - Total Franchisees in System: {total_franchisees}")
            print(f"   - Franchisees with >= 1 placement: {len(real_fran_with_placements)} ({len(real_fran_with_placements)/total_franchisees*100:.1f}%)")
            print(f"   - Franchisees with 0 placements: {total_franchisees - len(real_fran_with_placements)}")

            for fid in real_fran_with_placements:
                p_list = placements_by_fran[fid]
                dates = [p['date'] for p in p_list]

                # Check gap between consecutive placements
                for i in range(len(dates) - 1):
                    d_prev = dates[i]
                    d_next = dates[i + 1]
                    gap = (d_next - d_prev).days

                    if gap >= gap_days:
                        snapshot_date = d_prev + datetime.timedelta(days=gap_days)
                        eval_window_end = snapshot_date + datetime.timedelta(days=window_days)

                        if eval_window_end > today:
                            episodes_censored += 1
                            continue

                        # Placed within next 90 days?
                        # Since d_next is the immediate next placement, did it occur before snapshot_date + 90 days?
                        has_reactivated = (d_next <= eval_window_end)
                        label = 1 if has_reactivated else 0

                        if label == 1:
                            episodes_positive += 1
                        else:
                            episodes_negative += 1

                        episodes.append({
                            'franchisee_id': fid,
                            'snapshot_date': snapshot_date,
                            'prior_placement_date': d_prev,
                            'next_placement_date': d_next,
                            'label': label,
                            'gap_to_next': (d_next - snapshot_date).days
                        })

                # Check trailing gap after last placement up to today
                last_d = dates[-1]
                trailing_gap = (today - last_d).days
                if trailing_gap >= gap_days:
                    snapshot_date = last_d + datetime.timedelta(days=gap_days)
                    eval_window_end = snapshot_date + datetime.timedelta(days=window_days)

                    if eval_window_end <= today:
                        # No subsequent placement ever occurred
                        episodes_negative += 1
                        episodes.append({
                            'franchisee_id': fid,
                            'snapshot_date': snapshot_date,
                            'prior_placement_date': last_d,
                            'next_placement_date': None,
                            'label': 0,
                            'gap_to_next': None
                        })
                    else:
                        episodes_censored += 1

            total_valid_episodes = len(episodes)
            print("\n6. Dormancy Episodes Analysis (180-day gap -> 90-day evaluation window):")
            print(f"   - Total Historical Dormancy Episodes: {total_valid_episodes + episodes_censored}")
            print(f"   - Right-Censored Episodes (eval window after today): {episodes_censored}")
            print(f"   - Valid Historical Evaluated Episodes: {total_valid_episodes}")
            print(f"   - Positive Episodes (Reactivated within 90d): {episodes_positive}")
            print(f"   - Negative Episodes (Did not reactivate within 90d): {episodes_negative}")

            pos_rate = (episodes_positive / total_valid_episodes * 100) if total_valid_episodes > 0 else 0.0
            print(f"   - Empirical Reactivation Rate: {pos_rate:.2f}%")

            if total_valid_episodes > 0:
                ep_dates = [e['snapshot_date'] for e in episodes]
                print(f"   - Episode Snapshot Date Range: {min(ep_dates)} to {max(ep_dates)}")

            # 7. Check 30 Positive Examples Gate
            print("\n" + "=" * 78)
            print("DECISION GATE CHECK:")
            if episodes_positive < 30:
                print(f"   [!] WARNING: Fewer than 30 positive examples found! ({episodes_positive} positive episodes).")
                print("   Per Step 2 Decision Gate, an ML model should NOT be forcefully deployed if positive sample size < 30.")
            else:
                print(f"   [OK] Positive examples count ({episodes_positive}) >= 30 threshold.")
            print("=" * 78 + "\n")

    finally:
        conn.close()

if __name__ == '__main__':
    args = get_args()
    run_audit(args)
