import sys
import os
import json
import unittest
from unittest.mock import patch, MagicMock

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
os.environ.setdefault('FLASK_TESTING', 'true')

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import app as flask_app

_API_KEY = os.environ.get('API_KEY', '')
_AUTH = {'X-API-Key': _API_KEY}


class TestDeleteTransaction(unittest.TestCase):
    """
    Tests for DELETE /api/transactions/<id> (Phase 2).
    Uses mocked DB connection/cursor only — zero live DB access.
    """

    def setUp(self):
        flask_app.config['TESTING'] = True
        self.client = flask_app.test_client()

    def _setup_mock_db(self, row_return=None, rowcount=1):
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_cursor.fetchone.return_value = row_return
        mock_cursor.rowcount = rowcount
        return mock_conn, mock_cursor

    def test_delete_exp_passes_numeric_id(self):
        """'exp-123' -> SELECT and DELETE issued on expenditure with '123'."""
        mock_conn, mock_cur = self._setup_mock_db(
            row_return={'id': 123, 'particulars': 'Office Supplies'},
            rowcount=1
        )

        with patch('app.get_db_connection', return_value=mock_conn), \
             patch('app.DB_NAME', 'crm_db'), \
             patch('app.log_audit') as mock_log_audit:
            resp = self.client.delete('/api/transactions/exp-123', headers=_AUTH)

        self.assertEqual(resp.status_code, 200, resp.data)
        data = resp.get_json() or {}
        self.assertTrue(data.get('success'))
        self.assertEqual(data.get('deleted'), {'id': 'exp-123'})

        # Inspect execute calls for expenditure
        exp_calls = [c for c in mock_cur.execute.call_args_list if 'expenditure' in str(c)]
        self.assertEqual(len(exp_calls), 2, "Expected SELECT and DELETE on expenditure")
        for c in exp_calls:
            sql, params = c[0]
            self.assertEqual(params, ['123'], f"Expected ['123'] passed to {sql}, got {params}")

        # Assert audit_log was called
        mock_log_audit.assert_called_once()
        self.assertEqual(mock_log_audit.call_args[0][0], 'expenditure')
        self.assertEqual(mock_log_audit.call_args[0][1], 'exp-123')

    def test_delete_fran_pay_passes_numeric_id(self):
        """'fran-pay-123' -> SELECT and DELETE issued on franchisePayments with '123' (not 'pay')."""
        mock_conn, mock_cur = self._setup_mock_db(
            row_return={'franchisePayment_id': 123, 'payment_amount': 50000},
            rowcount=1
        )

        with patch('app.get_db_connection', return_value=mock_conn), \
             patch('app.DB_NAME', 'crm_db'), \
             patch('app.log_audit') as mock_log_audit:
            resp = self.client.delete('/api/transactions/fran-pay-123', headers=_AUTH)

        self.assertEqual(resp.status_code, 200, resp.data)
        data = resp.get_json() or {}
        self.assertTrue(data.get('success'))
        self.assertEqual(data.get('deleted'), {'id': 'fran-pay-123'})

        # Inspect execute calls for franchisePayments
        fran_calls = [c for c in mock_cur.execute.call_args_list if 'franchisePayments' in str(c)]
        self.assertEqual(len(fran_calls), 2, "Expected SELECT and DELETE on franchisePayments")
        for c in fran_calls:
            sql, params = c[0]
            self.assertEqual(params, ['123'], f"Expected ['123'] passed to {sql}, got {params}")

        # Assert audit_log was called
        mock_log_audit.assert_called_once()
        self.assertEqual(mock_log_audit.call_args[0][0], 'franchisePayments')
        self.assertEqual(mock_log_audit.call_args[0][1], 'fran-pay-123')

    def test_delete_exp_not_found_returns_404_no_audit(self):
        """'exp-999' with no row -> 404 {'error': 'Not found'} and no audit_log call."""
        mock_conn, mock_cur = self._setup_mock_db(row_return=None, rowcount=0)

        with patch('app.get_db_connection', return_value=mock_conn), \
             patch('app.DB_NAME', 'crm_db'), \
             patch('app.log_audit') as mock_log_audit:
            resp = self.client.delete('/api/transactions/exp-999', headers=_AUTH)

        self.assertEqual(resp.status_code, 404, resp.data)
        data = resp.get_json() or {}
        self.assertEqual(data.get('error'), 'Not found')
        mock_log_audit.assert_not_called()

    def test_delete_fran_pay_not_found_returns_404_no_audit(self):
        """'fran-pay-999' with no row -> 404 {'error': 'Not found'} and no audit_log call."""
        mock_conn, mock_cur = self._setup_mock_db(row_return=None, rowcount=0)

        with patch('app.get_db_connection', return_value=mock_conn), \
             patch('app.DB_NAME', 'crm_db'), \
             patch('app.log_audit') as mock_log_audit:
            resp = self.client.delete('/api/transactions/fran-pay-999', headers=_AUTH)

        self.assertEqual(resp.status_code, 404, resp.data)
        data = resp.get_json() or {}
        self.assertEqual(data.get('error'), 'Not found')
        mock_log_audit.assert_not_called()

    def test_invalid_id_formats_return_400(self):
        """'garbage', 'exp-abc', and 'fran-pay-' must return 400 with existing message."""
        mock_conn, mock_cur = self._setup_mock_db()

        for invalid_id in ['garbage', 'exp-abc', 'fran-pay-', 'exp-', 'fran-pay-abc']:
            with patch('app.get_db_connection', return_value=mock_conn), \
                 patch('app.DB_NAME', 'crm_db'):
                resp = self.client.delete(f'/api/transactions/{invalid_id}', headers=_AUTH)

            self.assertEqual(resp.status_code, 400, f"Expected 400 for '{invalid_id}', got {resp.status_code}")
            data = resp.get_json() or {}
            self.assertEqual(data.get('error'), 'Invalid transaction ID format for CRM tables.')


if __name__ == '__main__':
    unittest.main()
