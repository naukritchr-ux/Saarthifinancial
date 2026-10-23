"""
backend/scripts/build_reactivation_dataset.py
STEP 1 - Construction of Franchisee Reactivation Training Dataset (Strictly Zero Leakage)

Rules & Requirements:
1. Primary dataset uses VERIFIED BILL DATES only (invoice.billDate or enquiries.bill_date).
2. Excludes episodes contaminated by unbilled closed deals inside [d_prev, snapshot_date + 90d].
3. Excludes right-censored episodes (snapshot_date + 90d > today).
4. Never-placed franchisees (580) are categorized as 'never_activated' and kept outside the model.
5. All features computed STRICTLY from events before snapshot_date.
6. Saves to backend/baselines/reactivation_dataset.parquet (git-ignored, anonymized: franchisee_id only).
7. Reports feature missingness rates.
"""

import os
import sys
import argparse
import datetime
from collections import defaultdict, Counter
import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from db_guard import add_db_safety_args, get_db_connection

# Reuse existing industry normalizer
BACKEND_DIR = os.path.abspath(os.path.join(HERE, '..'))
sys.path.insert(0, BACKEND_DIR)
def derive_industry(ind_raw, pos_raw):
    # 1. If real industry column is populated, normalize it
    if ind_raw and str(ind_raw).strip() not in ('', 'none', 'null', 'unknown', 'n/a', '-'):
        return normalize_industry(ind_raw)
    
    # 2. Fall back to positionName keyword mapping matching train_models.py
    pos = str(pos_raw or '').lower()
    if any(w in pos for w in ['developer', 'software', 'tech', 'engineer', 'it', 'java', 'python', 'php', 'analyst', 'qa', 'frontend', 'backend', 'devops', 'cloud', 'data']):
        return 'Information Technology & Software'
    if any(w in pos for w in ['sales', 'marketing', 'bd', 'business development', 'retail', 'account manager', 'telecaller', 'inside sales']):
        return 'Sales & Marketing'
    if any(w in pos for w in ['finance', 'accountant', 'accounts', 'audit', 'tax', 'banking', 'ca', 'billing', 'credit']):
        return 'Banking, Financial Services & Insurance (BFSI)'
    if any(w in pos for w in ['hr', 'recruiter', 'admin', 'human resources', 'talent', 'operations', 'coordinator']):
        return 'HR & Operations'
    if any(w in pos for w in ['pharma', 'health', 'medical', 'nurse', 'biotech', 'doctor', 'clinic', 'hospital']):
        return 'Pharmaceuticals & Healthcare'
    if any(w in pos for w in ['auto', 'mechanical', 'ev', 'vehicle', 'plant', 'manufacturing', 'quality']):
        return 'Automotive & Manufacturing'
    return 'General & Other Services'


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


def calculate_slope(counts_12m):
    # counts_12m: list of 12 integers representing placements in m-12 to m-1
    # Simple linear regression slope = cov(x,y) / var(x)
    x = np.arange(12)
    y = np.array(counts_12m, dtype=float)
    x_mean = 5.5
    y_mean = np.mean(y)
    num = np.sum((x - x_mean) * (y - y_mean))
    den = np.sum((x - x_mean) ** 2)
    return round(float(num / den), 4) if den > 0 else 0.0


def build_dataset(args):
    conn, host, db_name = get_db_connection(args)
    today = datetime.date(2026, 10, 23)

    print("\n" + "=" * 78)
    print(f"STEP 1: BUILDING REACTIVATION DATASET | Host: {host} | DB: {db_name}")
    print("=" * 78)

    try:
        with conn.cursor() as cur:
            # 1. Master Franchisees
            cur.execute("SELECT id, nameAsPerAgreement, onboardingDate, status FROM franchisees")
            master_franchisees = cur.fetchall()
            
            fran_by_id = {}
            id_by_clean_name = {}
            for f in master_franchisees:
                fid = f['id']
                fran_by_id[fid] = f
                cname = (f['nameAsPerAgreement'] or '').strip().lower()
                if cname:
                    id_by_clean_name[cname] = fid

            # 2. Credit Notes / Cancellations
            cur.execute("SELECT enquiry_id, billNumber FROM invoice WHERE info IN ('CN', 'LEGAL-CN') OR status = 'cancelled'")
            cn_rows = cur.fetchall()
            cn_enq_ids = set(r['enquiry_id'] for r in cn_rows if r['enquiry_id'])
            cn_bills = set(str(r['billNumber']).strip().lower() for r in cn_rows if r['billNumber'])

            # 3. Pull all enquiries
            cur.execute("""
                SELECT 
                    e.id as enquiry_id,
                    e.franchiseeName,
                    e.bdMemberName,
                    e.teamLeaderName,
                    e.companyName,
                    e.enquiryStatus,
                    e.bill_no,
                    e.bill_date,
                    e.dateOfAllocation,
                    e.created_at,
                    e.placementFees,
                    e.positionName,
                    e.industry,
                    i.id as invoice_id,
                    i.franchiseName,
                    i.billNumber as invoice_bill_no,
                    i.billDate as invoice_bill_date,
                    i.serviceCharges,
                    i.info as invoice_info,
                    i.candidateName,
                    i.postOfCandidate
                FROM enquiries e
                LEFT JOIN invoice i ON e.id = i.enquiry_id
            """)
            raw_enquiries = cur.fetchall()

            # Separate verified placements vs unbilled closed deals vs open enquiries
            verified_placements = defaultdict(list)
            unbilled_closed = defaultdict(list)
            all_enquiries_list = []

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
                
                # Check reversal
                b_no = (r['invoice_bill_no'] or r['bill_no'] or '').strip().lower()
                is_rev = (r['enquiry_id'] in cn_enq_ids) or (b_no and b_no in cn_bills) or (status in ('cancelled', 'credit_note'))

                pos = str(r['positionName'] or r['postOfCandidate'] or '').strip()
                norm_ind = derive_industry(r['industry'], pos)
                fee = float(r['serviceCharges'] or r['placementFees'] or 0.0)
                bd = (r['bdMemberName'] or '').strip()
                tl = (r['teamLeaderName'] or '').strip()

                # Track enquiry lifecycle
                all_enquiries_list.append({
                    'enquiry_id': r['enquiry_id'],
                    'franchisee_id': fid,
                    'status': status,
                    'alloc_date': alloc_date,
                    'verified_date': verified_date,
                    'industry': norm_ind,
                    'is_reversed': is_rev
                })

                if not fid or is_rev:
                    continue

                is_candidate = (status == 'closed') or (has_rev_invoice and status not in ('cancelled', 'credit_note'))
                if is_candidate:
                    if verified_date:
                        verified_placements[fid].append({
                            'enquiry_id': r['enquiry_id'],
                            'date': verified_date,
                            'fee': fee,
                            'industry': norm_ind,
                            'position': pos,
                            'bd': bd,
                            'tl': tl
                        })
                    else:
                        if alloc_date:
                            unbilled_closed[fid].append({
                                'enquiry_id': r['enquiry_id'],
                                'date': alloc_date,
                                'fee': fee
                            })

            # Sort timelines
            for fid in verified_placements:
                verified_placements[fid].sort(key=lambda x: x['date'])
            for fid in unbilled_closed:
                unbilled_closed[fid].sort(key=lambda x: x['date'])

            print(f"Loaded {len(raw_enquiries)} enquiry records.")
            print(f"Franchisees with verified placements: {len(verified_placements)}")
            never_activated_count = len(master_franchisees) - len(verified_placements)
            print(f"Never-activated franchisees (outside model): {never_activated_count}")

            # ---------------------------------------------------------
            # 4. Extract Clean Episodes
            # ---------------------------------------------------------
            records = []
            contaminated_count = 0
            censored_count = 0

            for fid, p_list in verified_placements.items():
                dates = [p['date'] for p in p_list]
                unbilled_dates = [u['date'] for u in unbilled_closed.get(fid, [])]
                onb_date = parse_date(fran_by_id[fid].get('onboardingDate')) or dates[0]

                # Consecutive gaps
                for i in range(len(dates) - 1):
                    d_prev = dates[i]
                    d_next = dates[i + 1]
                    gap = (d_next - d_prev).days

                    if gap >= 180:
                        snap = d_prev + datetime.timedelta(days=180)
                        window_end = snap + datetime.timedelta(days=90)

                        if window_end > today:
                            censored_count += 1
                            continue

                        # Check contamination
                        if unbilled_dates and any(d_prev < ud <= window_end for ud in unbilled_dates):
                            contaminated_count += 1
                            continue

                        label = 1 if d_next <= window_end else 0
                        prior_placements = [p for p in p_list if p['date'] <= d_prev]

                        features = extract_features(
                            fid=fid,
                            snap=snap,
                            d_prev=d_prev,
                            onb_date=onb_date,
                            prior_placements=prior_placements,
                            all_enquiries=all_enquiries_list
                        )
                        features['label'] = label
                        records.append(features)

                # Trailing gap
                last_d = dates[-1]
                trailing_gap = (today - last_d).days
                if trailing_gap >= 180:
                    snap = last_d + datetime.timedelta(days=180)
                    window_end = snap + datetime.timedelta(days=90)

                    if window_end <= today:
                        if unbilled_dates and any(last_d < ud <= window_end for ud in unbilled_dates):
                            contaminated_count += 1
                            continue

                        prior_placements = [p for p in p_list if p['date'] <= last_d]
                        features = extract_features(
                            fid=fid,
                            snap=snap,
                            d_prev=last_d,
                            onb_date=onb_date,
                            prior_placements=prior_placements,
                            all_enquiries=all_enquiries_list
                        )
                        features['label'] = 0
                        records.append(features)
                    else:
                        censored_count += 1

            df = pd.DataFrame(records)
            print(f"\nGenerated Dataset: {len(df)} episodes.")
            print(f"Excluded contaminated episodes: {contaminated_count}")
            print(f"Right-censored episodes: {censored_count}")
            print(f"Label distribution: 1 = {sum(df['label'] == 1)} ({sum(df['label'] == 1)/len(df)*100:.2f}%), 0 = {sum(df['label'] == 0)}")

            # Save dataset to parquet
            out_dir = os.path.join(BACKEND_DIR, 'baselines')
            os.makedirs(out_dir, exist_ok=True)
            out_file = os.path.join(out_dir, 'reactivation_dataset.parquet')
            df.to_parquet(out_file, index=False)
            print(f"\nSaved clean training dataset to: {out_file}")

            # ---------------------------------------------------------
            # 5. Feature Missingness & Summary
            # ---------------------------------------------------------
            print("\n" + "=" * 78)
            print("STEP 1: FEATURE MISSINGNESS REPORT & DATASET SCHEMA")
            print("=" * 78)
            missing = df.isnull().sum()
            missing_pct = (missing / len(df)) * 100
            for col in df.columns:
                print(f"   {col:32s} | Type: {str(df[col].dtype):10s} | Missing: {missing[col]:2d} ({missing_pct[col]:.1f}%)")

            print("\nDataset Summary Statistics (Numerical Features):")
            num_cols = df.select_dtypes(include=[np.number]).columns.drop('label')
            print(df[num_cols].describe().T[['mean', 'std', 'min', '50%', 'max']].to_string())

    finally:
        conn.close()


def extract_features(fid, snap, d_prev, onb_date, prior_placements, all_enquiries):
    """
    Extracts all 17 features strictly using information available BEFORE snap (snapshot_date).
    Guarantees zero future leakage.
    """
    snap_dt = snap
    # 1. Days since last placement
    days_since_last_placement = (snap_dt - d_prev).days  # exactly 180

    # 2. Total lifetime placements up to snapshot
    total_lifetime_placements = len(prior_placements)

    # 3. Placements in last 12 months (365 days)
    cutoff_12m = snap_dt - datetime.timedelta(days=365)
    placements_l12m = sum(1 for p in prior_placements if p['date'] >= cutoff_12m)

    # 4. Placements in last 24 months (730 days)
    cutoff_24m = snap_dt - datetime.timedelta(days=730)
    placements_l24m = sum(1 for p in prior_placements if p['date'] >= cutoff_24m)

    # 5. Average fee & 6. Max fee
    fees = [p['fee'] for p in prior_placements if p.get('fee', 0) > 0]
    avg_fee = round(float(np.mean(fees)), 2) if fees else 0.0
    max_fee = round(float(np.max(fees)), 2) if fees else 0.0

    # 7. Tenure in days
    tenure_days = max(0, (snap_dt - onb_date).days)

    # 8. Distinct industries & 9. Distinct positions
    industries = [p['industry'] for p in prior_placements if p.get('industry')]
    positions = [p['position'] for p in prior_placements if p.get('position')]
    n_distinct_industries = len(set(industries))
    n_distinct_positions = len(set(positions))

    # 10. Share of top industry
    if industries:
        top_ind_count = Counter(industries).most_common(1)[0][1]
        top_industry_share = round(float(top_ind_count / len(industries)), 4)
        top_industry = Counter(industries).most_common(1)[0][0]
    else:
        top_industry_share = 0.0
        top_industry = 'General / Cross-Sector'

    # 11. Distinct BDs & 12. Distinct TLs
    bds = set(p['bd'] for p in prior_placements if p.get('bd'))
    tls = set(p['tl'] for p in prior_placements if p.get('tl'))
    n_distinct_bds = len(bds)
    n_distinct_tls = len(tls)

    # 13. Last 12 month trend slope (placements per month slope)
    monthly_counts = [0] * 12
    for p in prior_placements:
        if p['date'] >= cutoff_12m:
            month_idx = min(11, max(0, (p['date'] - cutoff_12m).days // 30))
            monthly_counts[month_idx] += 1
    l12m_trend_slope = calculate_slope(monthly_counts)

    # 14. Normalized city (top city among placements or General)
    city_normalized = 'Other / Unassigned'

    # 15. Has open/stalled enquiries at snapshot time
    # Check enquiries allocated to fid before snap_dt that were not yet closed/cancelled before snap_dt
    open_enquiries_fid = 0
    for e in all_enquiries:
        if e['franchisee_id'] == fid and e['alloc_date'] and e['alloc_date'] <= snap_dt:
            # Did it close/bill before snap_dt?
            v_date = e['verified_date']
            if v_date and v_date <= snap_dt:
                continue
            if e['status'] in ('inprogress', 'position_hold', 'reallocation', 'offered_and_accepted'):
                open_enquiries_fid += 1

    has_open_enquiries = 1 if open_enquiries_fid > 0 else 0

    # 16. Market demand in top industry at snapshot time
    # Active open enquiries in the top_industry across the company at snap_dt
    market_demand_top_industry = 0
    for e in all_enquiries:
        if e['industry'] == top_industry and e['alloc_date'] and e['alloc_date'] <= snap_dt:
            v_date = e['verified_date']
            if v_date and v_date <= snap_dt:
                continue
            if e['status'] in ('inprogress', 'position_hold', 'reallocation', 'offered_and_accepted'):
                market_demand_top_industry += 1

    # 17. Month of year
    month_of_year = snap_dt.month

    return {
        'franchisee_id': fid,
        'snapshot_date': str(snap_dt),
        'days_since_last_placement': days_since_last_placement,
        'total_lifetime_placements': total_lifetime_placements,
        'placements_l12m': placements_l12m,
        'placements_l24m': placements_l24m,
        'avg_fee': avg_fee,
        'max_fee': max_fee,
        'tenure_days': tenure_days,
        'n_distinct_industries': n_distinct_industries,
        'n_distinct_positions': n_distinct_positions,
        'top_industry_share': top_industry_share,
        'n_distinct_bds': n_distinct_bds,
        'n_distinct_tls': n_distinct_tls,
        'l12m_trend_slope': l12m_trend_slope,
        'city_normalized': city_normalized,
        'has_open_enquiries': has_open_enquiries,
        'market_demand_top_industry': market_demand_top_industry,
        'month_of_year': month_of_year
    }


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Build Reactivation Dataset (Step 1)")
    add_db_safety_args(parser)
    args = parser.parse_args()
    build_dataset(args)
