"""
Test script for rule-based franchisee reactivation ranking logic.
"""
import sys
import os
import argparse
import datetime
import json

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from scripts.db_guard import get_db_connection, add_db_safety_args

def test_reactivation_ranking(args):
    conn, host, db = get_db_connection(args)
    cur = conn.cursor()
    today = datetime.date(2026, 10, 23)

    # 1. Fetch registered active franchisees
    cur.execute("""
        SELECT id, nameAsPerAgreement as name, onboardingDate, status
        FROM franchisees
        WHERE nameAsPerAgreement IS NOT NULL AND TRIM(nameAsPerAgreement) != ''
          AND LOWER(TRIM(nameAsPerAgreement)) != 'unknown'
          AND LOWER(status) != 'terminated'
    """)
    franchisees = cur.fetchall()
    
    # 2. Fetch clean placements metrics from v_invoice_clean
    cur.execute("""
        SELECT 
            TRIM(franchiseName) as franchiseName,
            COUNT(DISTINCT enquiry_id) as total_placements,
            COUNT(DISTINCT CASE WHEN billDate >= DATE_SUB(%s, INTERVAL 365 DAY) THEN enquiry_id END) as placements_l12m,
            MAX(billDate) as last_placement_date,
            SUM(ourShare) as total_company_share,
            AVG(ourShare) as avg_company_share
        FROM v_invoice_clean
        WHERE is_revenue = 1
          AND franchiseName IS NOT NULL AND TRIM(franchiseName) != ''
        GROUP BY TRIM(franchiseName)
    """, [today])
    inv_rows = cur.fetchall()

    def _norm(s):
        import re
        if not s:
            return ''
        s = s.lower().strip()
        s = re.sub(r'[^\w\s]', '', s)
        return re.sub(r'\s+', ' ', s).strip()

    metrics_by_norm = {}
    for r in inv_rows:
        nk = _norm(r['franchiseName'])
        if nk:
            metrics_by_norm[nk] = r

    candidates = []
    never_activated_count = 0
    currently_active_count = 0

    for f in franchisees:
        fname = f['name']
        nk = _norm(fname)
        m = metrics_by_norm.get(nk)

        if not m or int(m['total_placements'] or 0) == 0:
            never_activated_count += 1
            continue

        lp_date = m['last_placement_date']
        if not lp_date:
            never_activated_count += 1
            continue

        if isinstance(lp_date, str):
            import datetime as dt_mod
            lp_date_obj = dt_mod.datetime.strptime(lp_date[:10], '%Y-%m-%d').date()
        else:
            lp_date_obj = lp_date

        days_since = (today - lp_date_obj).days
        if days_since <= 90:
            currently_active_count += 1
            continue

        # Inactive / Dormant (days_since > 90)
        tot_p = int(m['total_placements'])
        l12m_p = int(m['placements_l12m'] or 0)
        avg_share = float(m['avg_company_share'] or 0.0)

        # Baseline expected recovery value:
        # If active in last 12m: placement rate = l12m_p / 12
        # If 0 in last 12m: historical placement rate decayed by dormancy factor
        dormancy_months = max(3.0, days_since / 30.0)
        if l12m_p > 0:
            est_monthly_placements = l12m_p / 12.0
        else:
            est_monthly_placements = min(1.0, (tot_p / max(12.0, dormancy_months * 2.0))) * (90.0 / days_since)

        expected_monthly_value = round(est_monthly_placements * avg_share, 2)

        explanation = f"Placed {l12m_p} in last 12m, last placement {days_since}d ago. Historical avg company share: Rs {avg_share:,.0f}/deal."

        candidates.append({
            'franchisee_id': f['id'],
            'franchisee_name': fname,
            'days_since_last_placement': days_since,
            'last_placement_date': str(lp_date),
            'total_lifetime_placements': tot_p,
            'placements_l12m': l12m_p,
            'avg_company_share': round(avg_share, 2),
            'expected_monthly_value': expected_monthly_value,
            'explanation': explanation,
            'model_type': 'rule-based'
        })

    # Sort by expected recovery value descending
    candidates.sort(key=lambda x: x['expected_monthly_value'], reverse=True)

    print(f"Total Franchisees Checked: {len(franchisees)}")
    print(f"Never-Activated Excluded:  {never_activated_count}")
    print(f"Currently Active (<=90d):  {currently_active_count}")
    print(f"Dormant Candidates (>90d): {len(candidates)}")
    print("\nTop 5 Candidates by Expected Monthly Recovery Value:")
    for c in candidates[:5]:
        print(f"  ID: {c['franchisee_id']} | Value: Rs {c['expected_monthly_value']:>10,.2f} | {c['explanation']}")

    conn.close()

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    add_db_safety_args(parser)
    args = parser.parse_args()
    test_reactivation_ranking(args)
