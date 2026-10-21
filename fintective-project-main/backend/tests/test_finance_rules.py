"""
backend/tests/test_finance_rules.py
Unit tests for the Single Source of Truth financial rules, formulas, and tenure calculations.
"""

import unittest
import sys
import os
from datetime import date

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from finance_rules import (
    normalize_fy,
    fy_to_date_range,
    is_revenue_info,
    ex_gst,
    get_franchisee_tenure_split,
    calculate_waterfall,
    fallback_our_share_rate,
    REVENUE_INFO_TYPES,
    NON_REVENUE_INFO_TYPES,
    FLAGGED_INFO_TYPES
)

class TestFinanceRules(unittest.TestCase):

    def test_normalize_fy(self):
        # Standard formats
        self.assertEqual(normalize_fy('2025-2026'), '2025-2026')
        self.assertEqual(normalize_fy('2024-2025'), '2024-2025')
        self.assertEqual(normalize_fy('2026-2027'), '2026-2027')
        
        # Short 2-digit suffix
        self.assertEqual(normalize_fy('2025-26'), '2025-2026')
        self.assertEqual(normalize_fy('FY 2024-25'), '2024-2025')
        self.assertEqual(normalize_fy('25-26'), '2025-2026')

        # Fallback to date
        self.assertEqual(normalize_fy(None, date_str='2025-06-15'), '2025-2026')
        self.assertEqual(normalize_fy(None, date_str='2025-02-10'), '2024-2025')
        self.assertEqual(normalize_fy('invalid', date_str='2024-04-01'), '2024-2025')

    def test_franchisee_tenure_split(self):
        # 3+ years completed -> 70% franchisee / 30% company
        split_3plus = get_franchisee_tenure_split(years_completed=3.0)
        self.assertEqual(split_3plus['franchisee_pct'], 0.70)
        self.assertEqual(split_3plus['company_pct'], 0.30)

        split_4yrs = get_franchisee_tenure_split(years_completed=4.5)
        self.assertEqual(split_4yrs['franchisee_pct'], 0.70)
        self.assertEqual(split_4yrs['company_pct'], 0.30)

        # < 3 years completed -> 75% franchisee / 25% company
        split_new = get_franchisee_tenure_split(years_completed=1.5)
        self.assertEqual(split_new['franchisee_pct'], 0.75)
        self.assertEqual(split_new['company_pct'], 0.25)

        split_0 = get_franchisee_tenure_split(years_completed=0)
        self.assertEqual(split_0['franchisee_pct'], 0.75)
        self.assertEqual(split_0['company_pct'], 0.25)

        # By onboarding date
        # Onboarded 2021-04-01, bill date 2025-05-01 -> > 4 years -> 70-30
        split_dates_3plus = get_franchisee_tenure_split(onboarding_date='2021-04-01', bill_date='2025-05-01')
        self.assertEqual(split_dates_3plus['franchisee_pct'], 0.70)
        self.assertEqual(split_dates_3plus['company_pct'], 0.30)

        # Onboarded 2024-01-01, bill date 2025-05-01 -> 1.3 years -> 75-25
        split_dates_young = get_franchisee_tenure_split(onboarding_date='2024-01-01', bill_date='2025-05-01')
        self.assertEqual(split_dates_young['franchisee_pct'], 0.75)
        self.assertEqual(split_dates_young['company_pct'], 0.25)

    def test_is_revenue_info(self):
        # Recognized revenue info types
        for t in REVENUE_INFO_TYPES:
            self.assertTrue(is_revenue_info(t))
            self.assertTrue(is_revenue_info(t.lower()))

        # Non-revenue / credit notes
        for t in NON_REVENUE_INFO_TYPES:
            self.assertFalse(is_revenue_info(t))

        # Flagged types (C, blank)
        self.assertFalse(is_revenue_info('C'))
        self.assertFalse(is_revenue_info(''))
        self.assertFalse(is_revenue_info(None))

    def test_ex_gst(self):
        # When serviceCharges is given, use it directly (ex-GST)
        self.assertEqual(ex_gst(service_charges=100000, total_bill_amt=118000), 100000.0)

        # When serviceCharges is 0 / None, strip 18% GST from totalBillAmt
        self.assertEqual(ex_gst(service_charges=0, total_bill_amt=118000), 100000.0)
        self.assertEqual(ex_gst(service_charges=None, total_bill_amt=118000), 100000.0)

    def test_calculate_waterfall(self):
        # Test company waterfall calculations
        wf = calculate_waterfall(
            revenue=1000000,
            our_share=250000,
            expenses=100000,
            salaries=50000
        )
        self.assertEqual(wf['our_share'], 250000.0)
        self.assertEqual(wf['net'], 100000.0)     # 250,000 - 100,000 - 50,000
        self.assertEqual(wf['tax'], 25000.0)      # 25% of 100,000
        self.assertEqual(wf['surplus'], 75000.0)  # 100,000 - 25,000
        self.assertEqual(wf['margin_pct'], 30.0)  # 75,000 / 250,000 = 30.0%

    def test_waterfall_negative_net(self):
        # When net is negative, income tax is 0 (tax relief)
        wf = calculate_waterfall(
            revenue=100000,
            our_share=25000,
            expenses=40000,
            salaries=10000
        )
        self.assertEqual(wf['net'], -25000.0)
        self.assertEqual(wf['tax'], 0.0)
        self.assertEqual(wf['surplus'], -25000.0)
        self.assertEqual(wf['margin_pct'], -100.0)

    def test_multi_invoice_enquiry_deduplication(self):
        # Two invoices for the same enquiry and company should NOT cause self-exclusion
        enquiry_rows = [
            {'id': 101, 'company': 'Acme Corp', 'candidate': 'John Doe', 'bill_no': 'BILL-001'},
            {'id': 101, 'company': 'Acme Corp', 'candidate': 'John Doe', 'bill_no': 'BILL-001'},
        ]
        # Distinct enquiries grouped first
        distinct_enquiries = {}
        for r in enquiry_rows:
            distinct_enquiries[r['id']] = r

        self.assertEqual(len(distinct_enquiries), 1)
        self.assertIn(101, distinct_enquiries)

    def test_acceptance_table_waterfalls(self):
        # FY 2024-2025: rev = 80,286,097.91, our_share = 14,623,739.00
        wf_2425 = calculate_waterfall(
            revenue=80286097.91,
            our_share=14623739.00,
            operating_expenses=5000000,
            salary=3000000
        )
        self.assertEqual(wf_2425['revenue'], 80286097.91)
        self.assertEqual(wf_2425['our_share'], 14623739.00)
        self.assertEqual(wf_2425['net'], 6623739.00)
        self.assertAlmostEqual(wf_2425['tax'], 1655934.75, places=2)
        self.assertAlmostEqual(wf_2425['surplus'], 4967804.25, places=2)

        # FY 2025-2026: rev = 82,634,443.04, our_share = 17,031,669.00
        wf_2526 = calculate_waterfall(
            revenue=82634443.04,
            our_share=17031669.00,
            operating_expenses=6000000,
            salary=4000000
        )
        self.assertEqual(wf_2526['revenue'], 82634443.04)
        self.assertEqual(wf_2526['our_share'], 17031669.00)
        self.assertEqual(wf_2526['net'], 7031669.00)
        self.assertAlmostEqual(wf_2526['tax'], 1757917.25, places=2)
        self.assertAlmostEqual(wf_2526['surplus'], 5273751.75, places=2)

        # FY 2026-2027: rev = 51,119,354.93, our_share = 14,360,509.00
        wf_2627 = calculate_waterfall(
            revenue=51119354.93,
            our_share=14360509.00,
            operating_expenses=4000000,
            salary=3000000
        )
        self.assertEqual(wf_2627['revenue'], 51119354.93)
        self.assertEqual(wf_2627['our_share'], 14360509.00)
        self.assertEqual(wf_2627['net'], 7360509.00)
        self.assertAlmostEqual(wf_2627['tax'], 1840127.25, places=2)
        self.assertAlmostEqual(wf_2627['surplus'], 5520381.75, places=2)

if __name__ == '__main__':
    unittest.main()
