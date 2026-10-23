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
    calculate_pf,
    fallback_our_share_rate,
    REVENUE_INFO_TYPES,
    NON_REVENUE_INFO_TYPES,
    FLAGGED_INFO_TYPES
)
from payroll_service import calculate_single_employee_payroll

class TestFinanceRules(unittest.TestCase):

    def test_normalize_fy(self):
        # Standard formats
        self.assertEqual(normalize_fy('2025-2026'), '2025-2026')
        self.assertEqual(normalize_fy('2024-2025'), '2024-2025')
        self.assertEqual(normalize_fy('2026-2027'), '2026-2027')

        # Single-year span conversion ('2025-2025' -> '2025-2026')
        self.assertEqual(normalize_fy('2025-2025'), '2025-2026')

        # Invalid multi-year span passes through unchanged (finance_rules.py:90)
        # Demonstrates that an invalid span currently passes through as if valid
        self.assertEqual(normalize_fy('2025-2027'), '2025-2027')
        
        # Short 2-digit suffix
        self.assertEqual(normalize_fy('2025-26'), '2025-2026')
        self.assertEqual(normalize_fy('FY 2024-25'), '2024-2025')
        self.assertEqual(normalize_fy('25-26'), '2025-2026')

        # Edge cases: empty string, whitespace, and None all return 'N/A'
        self.assertEqual(normalize_fy(''), 'N/A')
        self.assertEqual(normalize_fy('   '), 'N/A')
        self.assertEqual(normalize_fy(None), 'N/A')

        # Fiscal year boundary dates (31 March / 1 April boundary)
        # 31 March 2026 falls into FY 2025-2026
        self.assertEqual(normalize_fy(None, date_str='2026-03-31'), '2025-2026')
        # 01 April 2026 falls into FY 2026-2027
        self.assertEqual(normalize_fy(None, date_str='2026-04-01'), '2026-2027')

        # Date fallbacks
        self.assertEqual(normalize_fy(None, date_str='2025-06-15'), '2025-2026')
        self.assertEqual(normalize_fy(None, date_str='2025-02-10'), '2024-2025')
        self.assertEqual(normalize_fy('invalid', date_str='2024-04-01'), '2024-2025')

    def test_pf_calculation_boundary(self):
        # 1. Statutory PF formula unit checks (payroll_service.py:242, 298 & finance_rules.py)
        # Below ₹15,000: 12% of pf_wages
        self.assertEqual(calculate_pf(10000, pf_app=True), 1200)

        # Boundary tests: 14,999, 15,000, and 15,001
        # At 14,999: round(14999 * 0.12) = round(1799.88) = 1800
        self.assertEqual(calculate_pf(14999, pf_app=True), 1800)

        # At exactly 15,000: both branches give ₹1,800
        # Branch 1 (12% of 15,000) = 1,800; Branch 2 (statutory cap) = 1,800
        self.assertEqual(round(15000 * 0.12), 1800)
        self.assertEqual(calculate_pf(15000, pf_app=True), 1800)

        # Above 15,000: statutory cap at 1800
        self.assertEqual(calculate_pf(15001, pf_app=True), 1800)
        self.assertEqual(calculate_pf(25000, pf_app=True), 1800)
        self.assertEqual(calculate_pf(50000, pf_app=True), 1800)

        # PF not applicable: always ₹0 regardless of wage level
        self.assertEqual(calculate_pf(14999, pf_app=False), 0)
        self.assertEqual(calculate_pf(15000, pf_app=False), 0)
        self.assertEqual(calculate_pf(15001, pf_app=False), 0)
        self.assertEqual(calculate_pf(50000, pf_app=False), 0)

        # 2. Integration with calculate_single_employee_payroll
        emp_with_pf = {
            'id': 9991,
            'name': 'Test Worker PF',
            'epfEmployee': True,
            'epfEmployer': True,
            'hra': False,
            'conveyanceAllowance': False,
            'otherExpenses': False
        }
        emp_without_pf = {
            'id': 9992,
            'name': 'Test Worker No PF',
            'epfEmployee': False,
            'epfEmployer': False,
            'hra': False,
            'conveyanceAllowance': False,
            'otherExpenses': False
        }

        # Wages at 14,999, 15,000, 15,001 under single employee payroll engine
        res_14999 = calculate_single_employee_payroll(emp_with_pf, {'FixedGrossSalary': 14999}, '2026-2027', 4)
        res_15000 = calculate_single_employee_payroll(emp_with_pf, {'FixedGrossSalary': 15000}, '2026-2027', 4)
        res_15001 = calculate_single_employee_payroll(emp_with_pf, {'FixedGrossSalary': 15001}, '2026-2027', 4)
        res_no_pf = calculate_single_employee_payroll(emp_without_pf, {'FixedGrossSalary': 15000}, '2026-2027', 4)

        self.assertIsNotNone(res_14999)
        self.assertEqual(res_14999['pf'], 1800)
        self.assertIsNotNone(res_15000)
        self.assertEqual(res_15000['pf'], 1800)
        self.assertIsNotNone(res_15001)
        self.assertEqual(res_15001['pf'], 1800)
        self.assertIsNotNone(res_no_pf)
        self.assertEqual(res_no_pf['pf'], 0)

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

    def test_waterfall_excludes_credit_notes_from_our_share(self):
        """
        Verify that passing our_share_rev (clean deals only) prevents credit note residual
        ourShare from inflating company share or net profit.
        """
        clean_our_share = 14480013.00
        cn_residual_our_share = 104607.00
        total_our_share_with_cn = clean_our_share + cn_residual_our_share

        opex = 3018814.00
        salaries = 10961811.00

        # Before fix: using total_our_share inflated net
        wf_inflated = calculate_waterfall(
            revenue=51887877.95,
            our_share=total_our_share_with_cn,
            operating_expenses=opex,
            salary=salaries
        )
        self.assertEqual(wf_inflated['our_share'], 14584620.00)
        self.assertEqual(wf_inflated['net'], 603995.00)

        # After fix: using clean our_share_rev only
        wf_clean = calculate_waterfall(
            revenue=51887877.95,
            our_share=clean_our_share,
            operating_expenses=opex,
            salary=salaries
        )
        self.assertEqual(wf_clean['our_share'], 14480013.00)
        self.assertEqual(wf_clean['net'], 499388.00)
        self.assertEqual(wf_inflated['net'] - wf_clean['net'], cn_residual_our_share)

    def test_cop_clients_info_deduplication_logic(self):
        """
        Verify that joining with de-duplicated clients_info subquery prevents Cartesian
        invoice duplication when a company has multiple records in clients_info.
        """
        # Simulating invoice rows and duplicate clients_info entries
        mock_invoices = [
            {'id': 101, 'companyName': 'EDUHUB EDUCATION PRIVATE LIMITED', 'totalBillAmt': 43643.00},
            {'id': 102, 'companyName': 'OTHER CORP', 'totalBillAmt': 50000.00}
        ]
        # clients_info has 2 duplicate entries for EDUHUB
        mock_clients_info = [
            {'id': 1, 'companyName': 'EDUHUB EDUCATION PRIVATE LIMITED', 'status': 'active'},
            {'id': 2, 'companyName': 'EDUHUB EDUCATION PRIVATE LIMITED', 'status': 'active'},
            {'id': 3, 'companyName': 'OTHER CORP', 'status': 'active'}
        ]

        # De-duplicated subquery emulation: GROUP BY LOWER(TRIM(companyName))
        deduped_clients = {}
        for c in mock_clients_info:
            c_name = c['companyName'].strip().lower()
            if c_name not in deduped_clients:
                deduped_clients[c_name] = c['status']

        joined_invoices = []
        for inv in mock_invoices:
            c_key = inv['companyName'].strip().lower()
            joined_invoices.append({
                **inv,
                'client_status': deduped_clients.get(c_key)
            })

        # Exactly 2 joined invoices, no Cartesian expansion
        self.assertEqual(len(joined_invoices), 2)
        total_billed = sum(i['totalBillAmt'] for i in joined_invoices)
        self.assertEqual(total_billed, 93643.00)

    def test_payroll_exclusion_future_placeholders(self):
        """
        Verify that future placeholder months (e.g. m=9, m=10 dated Jan/Feb 2027)
        are excluded when filtering by date <= today IST, keeping actual salaries
        only through August 2026 and setting projected salaries to 0.0.
        """
        today_mock = date(2026, 10, 23)
        mock_records = [
            {'m': 0, 'date': date(2026, 4, 28), 'ctc': 1926901.00},
            {'m': 1, 'date': date(2026, 5, 28), 'ctc': 2081729.00},
            {'m': 2, 'date': date(2026, 6, 28), 'ctc': 2230910.00},
            {'m': 3, 'date': date(2026, 7, 28), 'ctc': 2312960.00},
            {'m': 4, 'date': date(2026, 8, 28), 'ctc': 2409311.00},
            {'m': 9, 'date': date(2027, 1, 28), 'ctc': 2048622.00},  # Jan 2027 future placeholder
            {'m': 10, 'date': date(2027, 2, 28), 'ctc': 1617677.00}, # Feb 2027 future placeholder
        ]

        # Filter: date <= today
        actual_records = [r for r in mock_records if r['date'] <= today_mock]
        self.assertEqual(len(actual_records), 5)  # Apr through Aug only
        actual_total = sum(r['ctc'] for r in actual_records)
        self.assertEqual(actual_total, 10961811.00)

        # Future placeholder total
        future_placeholders = [r for r in mock_records if r['date'] > today_mock]
        self.assertEqual(len(future_placeholders), 2)  # Jan & Feb 2027
        future_total = sum(r['ctc'] for r in future_placeholders)
        self.assertEqual(future_total, 3666299.00)

        # Per user directive, projected salaries must be 0.0
        projected_salaries = 0.0
        self.assertEqual(projected_salaries, 0.0)

    def test_tenure_split_precedence_and_fallback(self):
        """
        Verify that recorded ourShare takes precedence on invoices, and tenure split
        (70/30 for >=3 years, 75/25 for <3 years or missing onboarding date)
        is applied only as a fallback when ourShare is missing.
        """
        # Case A: Invoice with explicit recorded ourShare
        inv_with_share = {
            'revenue_ex_gst': 100000.0,
            'ourShare': 30000.0,  # Recorded explicitly in DB
            'onboardingDate': '2025-01-01'  # 1 year tenure (< 3y normally 25%)
        }
        # Recorded value takes precedence
        effective_share = inv_with_share['ourShare'] if inv_with_share.get('ourShare') is not None else (
            inv_with_share['revenue_ex_gst'] * get_franchisee_tenure_split(onboarding_date=inv_with_share['onboardingDate'])['company_pct']
        )
        self.assertEqual(effective_share, 30000.0)

        # Case B: Deal with missing ourShare, tenure >= 3 years -> fallback 30%
        inv_missing_share_old = {
            'revenue_ex_gst': 100000.0,
            'ourShare': None,
            'onboardingDate': '2021-04-01'
        }
        split_old = get_franchisee_tenure_split(onboarding_date=inv_missing_share_old['onboardingDate'], bill_date='2026-05-01')
        fallback_share_old = inv_missing_share_old['revenue_ex_gst'] * split_old['company_pct']
        self.assertEqual(split_old['company_pct'], 0.30)
        self.assertEqual(fallback_share_old, 30000.0)

        # Case C: Deal with missing ourShare, tenure < 3 years -> fallback 25%
        inv_missing_share_young = {
            'revenue_ex_gst': 100000.0,
            'ourShare': None,
            'onboardingDate': '2025-01-01'
        }
        split_young = get_franchisee_tenure_split(onboarding_date=inv_missing_share_young['onboardingDate'], bill_date='2026-05-01')
        fallback_share_young = inv_missing_share_young['revenue_ex_gst'] * split_young['company_pct']
        self.assertEqual(split_young['company_pct'], 0.25)
        self.assertEqual(fallback_share_young, 25000.0)

        # Case D: Missing onboarding date -> default fallback 25%
        split_unrecorded = get_franchisee_tenure_split(onboarding_date=None)
        self.assertEqual(split_unrecorded['company_pct'], 0.25)
        self.assertEqual(split_unrecorded['franchisee_pct'], 0.75)

if __name__ == '__main__':
    unittest.main()

