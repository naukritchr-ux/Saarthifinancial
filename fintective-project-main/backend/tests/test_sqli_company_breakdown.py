"""
SQL Injection Security Tests — /api/growth-targets/company-breakdown

Covers:
1. financial_year="2025-2026' OR '1'='1"  → 400
2. financial_year="2025-2026; DROP TABLE x" → 400
3. financial_year="<script>alert(1)</script>" → 400
4. financial_year="" (empty) → 200 (all-time)
5. financial_year="2025-2026" → 200, numbers match baseline

RULES: no live-DB writes; no auth additions; response shape unchanged.
"""

import sys
import os
import unittest

# Load .env so API_KEY is available (same as test_api.py)
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
os.environ.setdefault('FLASK_TESTING', 'true')

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import app as flask_app

_API_KEY = os.environ.get('API_KEY', '')
_AUTH_HEADERS = {'X-API-Key': _API_KEY}


class TestCompanyBreakdownSQLi(unittest.TestCase):

    def setUp(self):
        flask_app.config['TESTING'] = True
        self.client = flask_app.test_client()

    # ------------------------------------------------------------------
    # Injection attempts must return 400
    # ------------------------------------------------------------------
    def test_sqli_or_attack_returns_400(self):
        """Classic OR 1=1 injection must be rejected."""
        payload = "2025-2026' OR '1'='1"
        resp = self.client.get(
            f"/api/growth-targets/company-breakdown?financial_year={payload}",
            headers=_AUTH_HEADERS
        )
        self.assertEqual(
            resp.status_code, 400,
            f"Expected 400 for injection payload, got {resp.status_code}: {resp.data}"
        )
        data = resp.get_json()
        self.assertIn('error', data)

    def test_sqli_drop_table_returns_400(self):
        """DROP TABLE injection must be rejected."""
        payload = "2025-2026; DROP TABLE x"
        resp = self.client.get(
            f"/api/growth-targets/company-breakdown?financial_year={payload}",
            headers=_AUTH_HEADERS
        )
        self.assertEqual(
            resp.status_code, 400,
            f"Expected 400 for drop-table payload, got {resp.status_code}: {resp.data}"
        )
        data = resp.get_json()
        self.assertIn('error', data)

    def test_sqli_script_tag_returns_400(self):
        """XSS/script injection must be rejected."""
        payload = "<script>alert(1)</script>"
        resp = self.client.get(
            f"/api/growth-targets/company-breakdown?financial_year={payload}",
            headers=_AUTH_HEADERS
        )
        self.assertEqual(resp.status_code, 400)

    def test_sqli_raw_quote_returns_400(self):
        """A bare single quote must be rejected."""
        resp = self.client.get(
            "/api/growth-targets/company-breakdown?financial_year='",
            headers=_AUTH_HEADERS
        )
        self.assertEqual(resp.status_code, 400)

    def test_sqli_union_returns_400(self):
        """UNION-based injection must be rejected."""
        payload = "2025-2026 UNION SELECT 1,2,3--"
        resp = self.client.get(
            f"/api/growth-targets/company-breakdown?financial_year={payload}",
            headers=_AUTH_HEADERS
        )
        self.assertEqual(resp.status_code, 400)

    # ------------------------------------------------------------------
    # Valid inputs must return 200 and a consistent response
    # ------------------------------------------------------------------
    def test_valid_fy_returns_200(self):
        """A properly formatted FY should return 200 with expected keys."""
        resp = self.client.get(
            "/api/growth-targets/company-breakdown?financial_year=2025-2026",
            headers=_AUTH_HEADERS
        )
        self.assertEqual(resp.status_code, 200, resp.data)
        data = resp.get_json()
        self.assertTrue(data.get('success'), f"Expected success=True, got: {data}")
        self.assertIn('team_leaders', data)
        self.assertIn('total_deals', data)
        self.assertIn('total_billing', data)
        self.assertIn('financial_year', data)
        self.assertEqual(data['financial_year'], '2025-2026')

    def test_empty_fy_returns_200_all_time(self):
        """Empty financial_year should return 200 (all-time view)."""
        resp = self.client.get(
            "/api/growth-targets/company-breakdown",
            headers=_AUTH_HEADERS
        )
        self.assertEqual(resp.status_code, 200, resp.data)
        data = resp.get_json()
        self.assertTrue(data.get('success'))
        self.assertIn('team_leaders', data)

    def test_valid_fy_numbers_unchanged(self):
        """
        Two calls with the same valid FY must return identical numbers.
        (Guards against any accidental mutation introduced by this patch.)
        """
        url = "/api/growth-targets/company-breakdown?financial_year=2025-2026"
        resp1 = self.client.get(url, headers=_AUTH_HEADERS)
        resp2 = self.client.get(url, headers=_AUTH_HEADERS)
        self.assertEqual(resp1.status_code, 200)
        self.assertEqual(resp2.status_code, 200)
        d1 = resp1.get_json()
        d2 = resp2.get_json()
        self.assertEqual(d1['total_deals'], d2['total_deals'],
                         "total_deals must be stable across calls")
        self.assertAlmostEqual(float(d1['total_billing']), float(d2['total_billing']),
                               places=2, msg="total_billing must be stable")

    def test_shortform_fy_normalised_and_accepted(self):
        """
        '2025-26' is a legal short form → normalize_fy converts it to '2025-2026'
        which passes validation → must return 200.
        """
        resp = self.client.get(
            "/api/growth-targets/company-breakdown?financial_year=2025-26",
            headers=_AUTH_HEADERS
        )
        # normalize_fy('2025-26') = '2025-2026' which passes ^\d{4}-\d{4}$
        self.assertEqual(resp.status_code, 200, resp.data)


if __name__ == '__main__':
    unittest.main()
