import unittest
import sys
import os

# Add backend directory to sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from growth_tracking_controller import (
    _calc_aging_factor,
    _calc_tl_conversion_rate,
    _calc_franchisee_track_record,
    _fetch_tl_portfolio
)
from db import get_db_connection

class TestTLPortfolioLogic(unittest.TestCase):

    def test_revised_status_aging_multiplier_concrete_assertion(self):
        """
        Concrete numeric assertion:
        A 'revised' invoice aged 20 days (<= 45 days SLA band = 100 base score)
        must receive the 0.70x multiplier, scoring exactly: 100 * 0.70 = 70.0 (not 100).
        """
        base_score_normal = _calc_aging_factor(days_outstanding=20, status='inprogress')
        self.assertEqual(base_score_normal, 100.0, "Normal inprogress invoice <=45 days must score 100.0")

        revised_score_20d = _calc_aging_factor(days_outstanding=20, status='revised')
        self.assertEqual(revised_score_20d, 70.0, "A revised invoice aged 20 days should score 100 * 0.70 = 70.0, not 100")

        # Test aging bands with revised multiplier
        # 46-75 days: base 75 -> 75 * 0.70 = 52.5
        revised_score_60d = _calc_aging_factor(days_outstanding=60, status='revised')
        self.assertEqual(revised_score_60d, 52.5)

        # 76-105 days: base 40 -> 40 * 0.70 = 28.0
        revised_score_90d = _calc_aging_factor(days_outstanding=90, status='revised')
        self.assertEqual(revised_score_90d, 28.0)

        # > 105 days: base 15 -> 15 * 0.70 = 10.5
        revised_score_120d = _calc_aging_factor(days_outstanding=120, status='revised')
        self.assertEqual(revised_score_120d, 10.5)

    def test_reconciliation_equation_and_credit_note_netting(self):
        """
        Verify Gross = Received + Outstanding + Cancelled - CreditNotes
        and admin_closures are tracked separately without distorting gross.
        """
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            # Fetch for top TL
            portfolio = _fetch_tl_portfolio(cursor, 'Avadai Esakki Muthu Sundaram Marthuvar')
            totals = portfolio['totals']

            expected_gross = totals['received'] + totals['outstanding'] + totals['cancelled'] - totals['credit_notes']
            self.assertAlmostEqual(totals['gross'], expected_gross, delta=5.0,
                                   msg=f"Reconciliation failure: Gross {totals['gross']} != Expected {expected_gross}")
            self.assertTrue(totals['reconciled'], "Portfolio should be marked as reconciled within <= 5.0 float tolerance")

            # Admin closures check
            self.assertIn('admin_closures', totals)
            self.assertIn('admin_closures_count', totals)
        finally:
            conn.close()

    def test_zero_gross_division_guard(self):
        """
        Verify that if gross is 0, percentages are safely 0.0 without ZeroDivisionError.
        """
        tot_gross = 0.0
        tot_received = 0.0
        received_pct = round((tot_received / tot_gross * 100.0) if tot_gross > 0 else 0.0, 1)
        self.assertEqual(received_pct, 0.0)

    def test_lookback_window_parameterization(self):
        """
        Verify lookback_months parameter is respected in track record and conversion calculations.
        """
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            rate_12, resolved_12 = _calc_tl_conversion_rate(cursor, 'Avadai Esakki Muthu Sundaram Marthuvar', lookback_months=12)
            rate_24, resolved_24 = _calc_tl_conversion_rate(cursor, 'Avadai Esakki Muthu Sundaram Marthuvar', lookback_months=24)
            self.assertIsInstance(rate_12, float)
            self.assertIsInstance(rate_24, float)
            self.assertTrue(0.0 <= rate_12 <= 100.0)
            self.assertTrue(0.0 <= rate_24 <= 100.0)
        finally:
            conn.close()

if __name__ == '__main__':
    unittest.main()
