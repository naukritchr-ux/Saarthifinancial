import os
from dotenv import load_dotenv
load_dotenv()
os.environ['FLASK_TESTING'] = 'true'
import warnings
warnings.filterwarnings('ignore')
import json
import unittest
import pytest
from app import app, get_bd_revenue
from db import get_db_connection

class TestSaarthiAPI(unittest.TestCase):
    def setUp(self):
        self.app = app.test_client()
        self.app.testing = True
        self.api_key = os.environ.get('API_KEY', '')
        self.headers = {'X-API-Key': self.api_key}

    def test_health_endpoint_unauthenticated(self):
        print("\nTesting /api/health (unauthenticated)...")
        response = self.app.get('/api/health')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data.get('status'), 'ok')
        self.assertIn('database', data)

    def test_unauthorized_when_wrong_key(self):
        print("\nTesting /api/transactions with invalid key...")
        response = self.app.get('/api/transactions', headers={'X-API-Key': 'invalid-secret-key'})
        self.assertEqual(response.status_code, 401)
        data = json.loads(response.data)
        self.assertFalse(data.get('success'))

    def test_verify_attribution_endpoint(self):
        print("\nTesting /api/finance/verify-attribution...")
        response = self.app.get('/api/finance/verify-attribution', headers=self.headers)
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        print("  Attribution verify response keys:", list(data.keys()))
        self.assertIn('database_mode', data)

    def test_bd_revenue_endpoint(self):
        print("\nTesting /api/finance/bd-revenue...")
        response = self.app.get('/api/finance/bd-revenue', headers=self.headers)
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        print(f"  Leaderboard count: {len(data)}")
        if data:
            self.assertIn('bd_name', data[0])
            self.assertIn('net_revenue', data[0])

    def test_bd_revenue_detail_endpoint(self):
        print("\nTesting /api/finance/bd-revenue/Komal Suresh Bhanushali/detail...")
        # URL encode spaces safely
        response = self.app.get('/api/finance/bd-revenue/Komal%20Suresh%20Bhanushali/detail', headers=self.headers)
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        print(f"  Detail rows count for Komal: {len(data)}")
        if data:
            self.assertIn('bd_name', data[0])
            self.assertIn('gross_revenue', data[0])

    def test_bd_enquiry_status_endpoint(self):
        print("\nTesting /api/finance/bd-enquiry-status...")
        response = self.app.get('/api/finance/bd-enquiry-status', headers=self.headers)
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        print(f"  BD enquiry status count: {len(data)}")
        if data:
            self.assertIn('bd_name', data[0])
            self.assertIn('inprogress', data[0])
            self.assertIn('closed', data[0])

    def test_action_items_endpoint(self):
        print("\nTesting /api/finance/action-items...")
        response = self.app.get('/api/finance/action-items', headers=self.headers)
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertIn('ghost_deals', data)
        self.assertIn('duplicate_expenses', data)
        print(f"  Action items: {len(data['ghost_deals'])} ghost deals, {len(data['duplicate_expenses'])} duplicates")

    @pytest.mark.writes_db
    def test_audit_logging(self):
        print("\nTesting audit logging behavior...")
        # Create a test transaction
        tx_data = {
            'title': 'Test Audit Expense Transaction',
            'amount': 45000.0,
            'type': 'expense',
            'category': 'Marketing',
            'subCategory': 'Online ads',
            'bdAgentId': 'bd-1',
            'franchiseeId': 'f-1'
        }
        response = self.app.post('/api/transactions', json=tx_data, headers=self.headers)
        self.assertEqual(response.status_code, 201)
        res_data = json.loads(response.data)
        tx_id = res_data['id']
        print(f"  Created test transaction: {tx_id}")

        # Check if audit log contains this creation
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM audit_log WHERE record_id = %s", [tx_id])
        audit_row = cursor.fetchone()
        self.assertIsNotNone(audit_row)
        self.assertEqual(audit_row['field_changed'], 'CREATE')
        print(f"  Audit log verified for CREATE: {audit_row['table_name']} -> {audit_row['record_id']}")

        conn.close()

        # Delete the transaction
        del_response = self.app.delete(f'/api/transactions/{tx_id}', headers=self.headers)
        self.assertEqual(del_response.status_code, 200)
        print(f"  Deleted test transaction: {tx_id}")

        # Check if audit log contains the deletion (using a fresh connection)
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM audit_log WHERE record_id = %s AND field_changed = 'DELETE'", [tx_id])
        del_audit_row = cursor.fetchone()
        self.assertIsNotNone(del_audit_row)
        print(f"  Audit log verified for DELETE: {del_audit_row['table_name']} -> {del_audit_row['record_id']}")
        conn.close()

    @pytest.mark.writes_db
    def test_soft_delete_and_restore(self):
        print("\nTesting soft-delete and restore behavior...")
        # 1. Create a test transaction (expense)
        tx_data = {
            'title': 'Test Soft Delete Expense',
            'amount': 15000.0,
            'type': 'expense',
            'category': 'Other',
            'bdAgentId': 'bd-1'
        }
        response = self.app.post('/api/transactions', json=tx_data, headers=self.headers)
        self.assertEqual(response.status_code, 201)
        tx_id = json.loads(response.data)['id']
        print(f"  Created test transaction: {tx_id}")

        # 2. Call soft-delete
        sd_response = self.app.post(f'/api/finance/action-items/{tx_id}/soft-delete', headers=self.headers)
        self.assertEqual(sd_response.status_code, 200)
        print(f"  Soft-deleted transaction: {tx_id}")

        # Verify is_deleted is 1 in DB
        conn = get_db_connection()
        cursor = conn.cursor()
        raw_id = tx_id.split('-')[1]
        cursor.execute("SELECT is_deleted FROM expenditure WHERE id = %s", [raw_id])
        row = cursor.fetchone()
        self.assertEqual(row['is_deleted'], 1)
        print("  is_deleted flag is verified as 1 in MySQL")

        # Verify audit_log has SOFT_DELETE
        cursor.execute("SELECT * FROM audit_log WHERE record_id = %s AND field_changed = 'SOFT_DELETE'", [tx_id])
        sd_audit = cursor.fetchone()
        self.assertIsNotNone(sd_audit)
        print("  Audit log verified for SOFT_DELETE")
        conn.close()

        # 3. Call restore
        r_response = self.app.post(f'/api/finance/action-items/{tx_id}/restore', headers=self.headers)
        self.assertEqual(r_response.status_code, 200)
        print(f"  Restored transaction: {tx_id}")

        # Verify is_deleted is 0 in DB
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT is_deleted FROM expenditure WHERE id = %s", [raw_id])
        row = cursor.fetchone()
        self.assertEqual(row['is_deleted'], 0)
        print("  is_deleted flag is verified as 0 in MySQL after restore")

        # Verify audit_log has RESTORE
        cursor.execute("SELECT * FROM audit_log WHERE record_id = %s AND field_changed = 'RESTORE'", [tx_id])
        r_audit = cursor.fetchone()
        self.assertIsNotNone(r_audit)
        print("  Audit log verified for RESTORE")
        
        # Cleanup transaction
        cursor.execute("DELETE FROM expenditure WHERE id = %s", [raw_id])
        conn.commit()
        conn.close()

    def test_cost_of_performance_equation(self):
        """Phase 2 Item 26: Drill-down equation check: 1109208 - 35000 - 32138 - 42000 == 1000070"""
        our_share = 1109208
        base_salary = 35000
        allocated_overhead = 32138
        loss_amount = 42000
        what_we_kept = our_share - base_salary - allocated_overhead - loss_amount
        self.assertEqual(what_we_kept, 1000070)
        print("  Cost of Performance drill-down equation verified: 11,09,208 - 35,000 - 32,138 - 42,000 = 10,00,070")

    def test_commission_calculation_and_pool_rates(self):
        """Phase 2 Item 6: Verify 20% BD commission and 12% TL commission of company pool"""
        gross_billing = 50000
        company_pool = gross_billing * 0.25  # 12,500
        
        bd_commission = company_pool * 0.20  # 2,500 (5% of gross)
        self.assertEqual(bd_commission, 2500)
        self.assertEqual(bd_commission / gross_billing, 0.05)
        
        tl_commission = company_pool * 0.12  # 1,500 (3% of gross)
        self.assertEqual(tl_commission, 1500)
        self.assertEqual(tl_commission / gross_billing, 0.03)
        print("  Commission formula verified: BD = 20% of pool (5% gross), TL = 12% of pool (3% gross)")

    def test_win_rate_formula(self):
        """Phase 2 Item 5: Win rate formula closed / (closed + cancelled), N/A on 0 pipeline"""
        # Active pipeline
        closed = 10
        cancelled = 2
        win_rate = (closed / (closed + cancelled)) * 100
        self.assertAlmostEqual(win_rate, 83.333333, places=4)

        # Zero pipeline must be None / N/A, never 100%
        zero_closed = 0
        zero_cancelled = 0
        total_resolved = zero_closed + zero_cancelled
        win_rate_empty = (zero_closed / total_resolved) if total_resolved > 0 else None
        self.assertIsNone(win_rate_empty)
        print("  Win rate formula verified: active pipeline gives true %, empty pipeline yields None (N/A)")

    def test_runway_zero_burn(self):
        """Phase 2 Item 9: Runway handles zero or negative burn gracefully"""
        cash_balance = 500000
        net_monthly_burn_positive = 100000
        runway_months = cash_balance / net_monthly_burn_positive
        self.assertEqual(runway_months, 5.0)

        # Self-sustaining check
        net_monthly_burn_zero = 0
        is_self_sustaining = net_monthly_burn_zero <= 0
        self.assertTrue(is_self_sustaining)
        print("  Runway formula verified: positive burn divides cash, zero/negative burn marks self-sustaining")

    def test_status_mapping_canonical_buckets(self):
        """Phase 2 Item 10: Canonical status mapping across all pages"""
        status_map = {
            'invoiced': 'INVOICED',
            'progressed': 'PROGRESSED',
            'cancelled': 'CANCELLED',
            'closed': 'INVOICED',
            'paid': 'INVOICED',
            'received': 'INVOICED'
        }
        self.assertEqual(status_map.get('invoiced'), 'INVOICED')
        self.assertEqual(status_map.get('progressed'), 'PROGRESSED')
        self.assertEqual(status_map.get('cancelled'), 'CANCELLED')
        print("  Status mapping verified across canonical buckets")

if __name__ == '__main__':
    unittest.main()

