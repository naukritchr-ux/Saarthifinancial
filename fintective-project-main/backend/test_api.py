import warnings
warnings.filterwarnings('ignore')
import json
import unittest
import os
from app import app, get_bd_revenue
from db import get_db_connection

class TestSaarthiAPI(unittest.TestCase):
    def setUp(self):
        self.app = app.test_client()
        self.app.testing = True

    def test_verify_attribution_endpoint(self):
        print("\nTesting /api/finance/verify-attribution...")
        response = self.app.get('/api/finance/verify-attribution')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        print("  Attribution verify response keys:", list(data.keys()))
        self.assertIn('database_mode', data)

    def test_bd_revenue_endpoint(self):
        print("\nTesting /api/finance/bd-revenue...")
        response = self.app.get('/api/finance/bd-revenue')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        print(f"  Leaderboard count: {len(data)}")
        if data:
            self.assertIn('bd_name', data[0])
            self.assertIn('net_revenue', data[0])

    def test_bd_revenue_detail_endpoint(self):
        print("\nTesting /api/finance/bd-revenue/Komal Suresh Bhanushali/detail...")
        # URL encode spaces safely
        response = self.app.get('/api/finance/bd-revenue/Komal%20Suresh%20Bhanushali/detail')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        print(f"  Detail rows count for Komal: {len(data)}")
        if data:
            self.assertIn('bd_name', data[0])
            self.assertIn('gross_revenue', data[0])

    def test_bd_enquiry_status_endpoint(self):
        print("\nTesting /api/finance/bd-enquiry-status...")
        response = self.app.get('/api/finance/bd-enquiry-status')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        print(f"  BD enquiry status count: {len(data)}")
        if data:
            self.assertIn('bd_name', data[0])
            self.assertIn('inprogress', data[0])
            self.assertIn('closed', data[0])

    def test_action_items_endpoint(self):
        print("\nTesting /api/finance/action-items...")
        response = self.app.get('/api/finance/action-items')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertIn('ghost_deals', data)
        self.assertIn('duplicate_expenses', data)
        print(f"  Action items: {len(data['ghost_deals'])} ghost deals, {len(data['duplicate_expenses'])} duplicates")

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
        response = self.app.post('/api/transactions', json=tx_data)
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
        del_response = self.app.delete(f'/api/transactions/{tx_id}')
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
        response = self.app.post('/api/transactions', json=tx_data)
        self.assertEqual(response.status_code, 201)
        tx_id = json.loads(response.data)['id']
        print(f"  Created test transaction: {tx_id}")

        # 2. Call soft-delete
        sd_response = self.app.post(f'/api/finance/action-items/{tx_id}/soft-delete')
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
        r_response = self.app.post(f'/api/finance/action-items/{tx_id}/restore')
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

if __name__ == '__main__':
    unittest.main()
