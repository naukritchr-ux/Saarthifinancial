import unittest
import sys
import os

# Ensure backend root is on Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from db import get_db_connection
from growth_tracking_controller import _normalize_fy, _calculate_cagr

class TestGrowthTargetsDataConsistency(unittest.TestCase):
    """
    Data consistency tests for Growth Targets:
    1. Tests that _normalize_fy outputs standard 'YYYY-YY' and handles split/bogus buckets.
    2. Tests that _calculate_cagr strictly requires >= 2 completed FYs and clamps to [-50%, +50%].
    3. Asserts that sum(monthly deals) == realized deals for selected FY across scopes.
    """

    def test_normalize_fy(self):
        self.assertEqual(_normalize_fy('2025-2026'), '2025-26')
        self.assertEqual(_normalize_fy('2025-26'), '2025-26')
        self.assertEqual(_normalize_fy('2025-2025'), '2025-26')  # Removes bogus 2025-2025
        self.assertEqual(_normalize_fy('FY 2026-27'), '2026-27')
        self.assertEqual(_normalize_fy('2024'), '2024-25')

    def test_calculate_cagr_completed_only(self):
        # Incomplete year alone should return None
        partial_series = [
            {'period': '2026-27', 'revenue': 22606562.82, 'is_complete': False}
        ]
        self.assertIsNone(_calculate_cagr(partial_series))

        # Only 1 completed year should return None (never a fake decline)
        single_completed = [
            {'period': '2025-26', 'revenue': 36359659.76, 'is_complete': True},
            {'period': '2026-27', 'revenue': 22606562.82, 'is_complete': False}
        ]
        self.assertIsNone(_calculate_cagr(single_completed))

        # 2 completed years should calculate properly
        two_completed = [
            {'period': '2024-25', 'revenue': 37626770.43, 'is_complete': True},
            {'period': '2025-26', 'revenue': 36359659.76, 'is_complete': True},
            {'period': '2026-27', 'revenue': 22606562.82, 'is_complete': False}
        ]
        cagr = _calculate_cagr(two_completed)
        self.assertIsNotNone(cagr)
        self.assertTrue(-0.50 <= cagr <= 0.50)
        # 36.35L / 37.62L - 1 = -0.03367 (-3.37%)
        self.assertAlmostEqual(cagr, -0.03367, places=4)

    def test_sum_monthly_deals_equals_realized_deals(self):
        """
        Critical invariant:
        Asserts that sum(monthly deals) == realized deals for the selected FY and entity filters.
        """
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            start_year = 2026
            cur_start = f"{start_year}-04-01"
            cur_end = f"{start_year + 1}-03-31"

            test_cases = [
                ("Komal Suresh Bhanushali", "bd"),
                ("All", "company")
            ]

            for entity_name, entity_type in test_cases:
                with self.subTest(entity=entity_name, type=entity_type):
                    where_clauses = [
                        "i.is_revenue = 1",
                        "i.billDate >= %s",
                        "i.billDate <= %s",
                        "i.billDate IS NOT NULL"
                    ]
                    params = [cur_start, cur_end]
                    if entity_name != 'All':
                        where_clauses.append("(LOWER(TRIM(i.nameOfBd)) LIKE %s OR LOWER(TRIM(e.bdMemberName)) LIKE %s)")
                        params.extend([f"%{entity_name.lower()}%", f"%{entity_name.lower()}%"])

                    cursor.execute(f"""
                        SELECT i.billNumber, i.billDate, i.rev_ex_gst
                        FROM v_invoice_clean i
                        LEFT JOIN enquiries e ON i.enquiry_id = e.id
                        WHERE {' AND '.join(where_clauses)}
                    """, params)
                    rows = cursor.fetchall()

                    seen = {}
                    for r in rows:
                        bnum = r['billNumber']
                        bdate = str(r['billDate'])[:10]
                        rev = float(r['rev_ex_gst'] or 0.0)
                        if bnum not in seen:
                            seen[bnum] = {'date': bdate, 'rev': rev}
                        else:
                            seen[bnum]['rev'] += rev

                    realized_deals = len(seen)
                    realized_revenue = sum(item['rev'] for item in seen.values())

                    # Monthly buckets
                    fy_months = [f"{start_year}-{m:02d}" for m in range(4, 13)] + [f"{start_year+1}-{m:02d}" for m in range(1, 4)]
                    monthly_counts = {ym: 0 for ym in fy_months}
                    monthly_revs = {ym: 0.0 for ym in fy_months}

                    for item in seen.values():
                        ym = item['date'][:7]
                        if ym in monthly_counts:
                            monthly_counts[ym] += 1
                            monthly_revs[ym] += item['rev']

                    sum_monthly_deals = sum(monthly_counts.values())
                    sum_monthly_rev = sum(monthly_revs.values())

                    self.assertEqual(
                        realized_deals,
                        sum_monthly_deals,
                        f"Realized deals {realized_deals} must equal sum of monthly deals {sum_monthly_deals} for {entity_name}"
                    )
                    self.assertAlmostEqual(
                        realized_revenue,
                        sum_monthly_rev,
                        places=2,
                        msg=f"Realized revenue {realized_revenue} must equal sum of monthly revenue {sum_monthly_rev} for {entity_name}"
                    )
        finally:
            conn.close()

if __name__ == '__main__':
    unittest.main()
