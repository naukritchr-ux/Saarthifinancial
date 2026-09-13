import os
import sys
import unittest
import json

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app, API_KEY
from db import ensure_tables_exist, get_db_connection

class TestGrowthTracking(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        ensure_tables_exist()
        cls.client = app.test_client()
        cls.headers = {'X-API-Key': API_KEY}

    def test_predict_franchisee(self):
        res = self.client.get('/api/growth-targets/predict?entity_type=franchisee&entity_id=f-1&rate=25', headers=self.headers)
        self.assertEqual(res.status_code, 200)
        data = json.loads(res.data)
        self.assertEqual(data['entity_type'], 'franchisee')
        self.assertIn('projections', data)
        self.assertEqual(len(data['projections']), 3)
        self.assertIn('scenarios', data)
        self.assertIn('scale2x', data['scenarios'])
        self.assertIn('scale4x', data['scenarios'])

    def test_predict_bd_agent(self):
        res = self.client.get('/api/growth-targets/predict?entity_type=bd_agent&entity_id=bd-1', headers=self.headers)
        self.assertEqual(res.status_code, 200)
        data = json.loads(res.data)
        self.assertEqual(data['entity_type'], 'bd_agent')
        self.assertIn('applied_rate_pct', data)

    def test_create_target_and_outcome(self):
        # 1. Create target
        payload = {
            'entity_type': 'bd_agent',
            'entity_id': 'bd-1',
            'growth_pct_target': 30,
            'salary_target': 18000,
            'period_start': '2026-04-01',
            'period_end': '2027-03-31',
            'guidelines': 'Drive key account growth in Western region.'
        }
        res = self.client.post('/api/growth-targets', headers=self.headers, json=payload)
        self.assertEqual(res.status_code, 201)
        created = json.loads(res.data)
        self.assertTrue(created['success'])
        target_id = created['id']
        self.assertIn('target_letter_text', created)
        self.assertIn('FINTECTIVE FINANCIAL REVENUE NETWORK', created['target_letter_text'])

        # 2. List targets
        list_res = self.client.get(f'/api/growth-targets?entity_type=bd_agent&entity_id=bd-1', headers=self.headers)
        self.assertEqual(list_res.status_code, 200)
        targets = json.loads(list_res.data)
        self.assertTrue(any(t['id'] == target_id for t in targets))

        # 3. Record outcome
        outcome_payload = {
            'actual_growth_pct': 35,
            'actual_value': 16000000,
            'kra_summary': 'Exceeded enterprise deal closures with 95% client retention.'
        }
        out_res = self.client.post(f'/api/growth-targets/{target_id}/outcome', headers=self.headers, json=outcome_payload)
        self.assertEqual(out_res.status_code, 200)
        outcome = json.loads(out_res.data)
        self.assertEqual(outcome['status'], 'completed')
        self.assertIn('outcome_letter_text', outcome)
        self.assertIn('TARGET EXCEEDED', outcome['outcome_letter_text'])

if __name__ == '__main__':
    unittest.main()
