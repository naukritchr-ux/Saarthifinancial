"""
backend/tests/test_crm_sync.py
Unit tests verifying:
1. sync_saarthi_all() with mocked fetch_saarthi_endpoint (all failing -> status='failed', ok=False; all succeeding -> status='completed', ok=True)
Frontend orchestration is tested against the actual JavaScript module in frontend/src/utils/crmSync.test.js.
"""

import unittest
from unittest.mock import patch, MagicMock
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

class TestCrmSyncService(unittest.TestCase):

    @patch('sync_service.get_db_connection')
    @patch('sync_service.ensure_tables_exist')
    @patch('sync_service.fetch_saarthi_endpoint')
    @patch('payroll_service.get_all_payroll_transactions')
    def test_sync_all_failing(self, mock_payroll, mock_fetch, mock_ensure_tables, mock_get_db):
        """When enquiries and invoices both return 0 rows and errors exist, status must be 'failed' and ok=False."""
        from sync_service import sync_saarthi_all

        # Mock DB connection and cursor
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cur
        mock_get_db.return_value = mock_conn
        mock_cur.fetchone.return_value = {'got': 1}
        mock_cur.lastrowid = 101

        # All endpoints fail
        mock_fetch.return_value = {
            "ok": False,
            "data": [],
            "error": "HTTP 502 Bad Gateway"
        }
        mock_payroll.return_value = []

        stats = sync_saarthi_all(existing_log_id=101)

        # 1. Assert stats["ok"] is False
        self.assertFalse(stats["ok"])
        self.assertEqual(stats["enquiries"], 0)
        self.assertEqual(stats["invoices"], 0)
        self.assertTrue(len(stats["errors"]) > 0)

        # 2. Assert DB update wrote 'failed' status into crm_sync_logs
        executed_sqls = [call[0][0] for call in mock_cur.execute.call_args_list]
        update_calls = [call for call in mock_cur.execute.call_args_list if "UPDATE crm_sync_logs" in call[0][0]]
        self.assertTrue(len(update_calls) > 0, "crm_sync_logs was not updated")
        
        update_args = update_calls[-1][0][1]
        final_status = update_args[0]
        final_message = update_args[7]

        self.assertEqual(final_status, "failed")
        self.assertIn("Sync failed", final_message)
        self.assertIn("HTTP 502", final_message)

    @patch('sync_service.get_db_connection')
    @patch('sync_service.ensure_tables_exist')
    @patch('sync_service.fetch_saarthi_endpoint')
    @patch('payroll_service.get_all_payroll_transactions')
    def test_sync_all_succeeding(self, mock_payroll, mock_fetch, mock_ensure_tables, mock_get_db):
        """When endpoints succeed, status must be 'completed' and ok=True."""
        from sync_service import sync_saarthi_all

        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_cur.fetchall.return_value = []
        mock_conn.cursor.return_value.__enter__.return_value = mock_cur
        mock_get_db.return_value = mock_conn
        mock_cur.fetchone.return_value = {'got': 1}
        mock_cur.lastrowid = 202

        def fetch_side_effect(endpoint_path, timeout=12):
            ep = endpoint_path.lower()
            if "enquiries" in ep:
                return {"ok": True, "data": [{"id": 1, "companyName": "Acme", "enquiryStatus": "open"}]}
            elif "invoice" in ep:
                return {"ok": True, "data": [{"id": 10, "billNumber": "INV-01", "billDate": "2026-05-01", "bill_amount": 1000}]}
            elif "franchisee" in ep:
                return {"ok": True, "data": [{"id": 20, "nameAsPerAgreement": "Fran A"}]}
            elif "expenditure" in ep or "expense" in ep:
                return {"ok": True, "data": [{"id": 30, "particulars": "Office Rent", "amount": 500, "billDate": "2026-05-01"}]}
            elif "clients" in ep:
                return {"ok": True, "data": [{"id": 40, "companyName": "Client A"}]}
            elif "legals" in ep:
                return {"ok": True, "data": [{"id": 50, "companyName": "Legal Party A"}]}
            elif "franchise-payments" in ep:
                return {"ok": True, "data": [{"id": 60, "AMOUNT PAID": 100}]}
            return {"ok": True, "data": []}

        mock_fetch.side_effect = fetch_side_effect
        mock_payroll.return_value = [{
            'id': 'sal-1', 'employeeId': 'E01', 'employeeName': 'Jane', 'department': 'IT',
            'financialYear': '2026-2027', 'date': '2026-05-28', 'amount': 50000, 'netPayable': 45000,
            'fixedGross': 50000, 'paidDays': 30, 'subCategory': 'Salaries & Wages',
            'paymentMode': 'Direct Bank Transfer', 'referenceId': 'PAY-1', 'description': 'May Salary'
        }]

        stats = sync_saarthi_all(existing_log_id=202)

        self.assertTrue(stats["ok"])
        self.assertEqual(stats["enquiries"], 1)
        self.assertEqual(stats["invoices"], 1)
        self.assertEqual(stats["payroll"], 1)

        update_calls = [call for call in mock_cur.execute.call_args_list if "UPDATE crm_sync_logs" in call[0][0]]
        self.assertTrue(len(update_calls) > 0)
        final_status = update_calls[-1][0][1][0]
        final_message = update_calls[-1][0][1][7]

        self.assertEqual(final_status, "completed")
        self.assertIn("Sync completed successfully", final_message)
        self.assertIn("Payroll: 1", final_message)


if __name__ == '__main__':
    unittest.main()
