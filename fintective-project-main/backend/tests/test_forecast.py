"""
test_forecast.py
----------------
Unit tests for the financial forecasting service and API endpoint.
Validates:
- MAPE error computation
- Seasonal-Naive and Holt-Winters forecasting
- Confidence band constraints (upper >= predicted >= lower >= 0)
- End-to-end GET /api/finance/forecast endpoint contract
"""

import unittest
from unittest.mock import MagicMock, patch
import datetime
import numpy as np
from app import app
from forecast_service import (
    calculate_mape,
    generate_month_sequence,
    seasonal_naive_forecast,
    holt_winters_forecast,
    backtest_revenue_models,
    generate_full_forecast
)


class TestForecastMath(unittest.TestCase):
    """Unit tests for the mathematical forecasting engines."""

    def test_mape_calculation(self):
        actual = np.array([100.0, 200.0, 300.0])
        pred_perfect = np.array([100.0, 200.0, 300.0])
        self.assertAlmostEqual(calculate_mape(actual, pred_perfect), 0.0)

        pred_10pct = np.array([110.0, 220.0, 330.0])
        self.assertAlmostEqual(calculate_mape(actual, pred_10pct), 10.0)

    def test_month_sequence_generation(self):
        seq = generate_month_sequence('2026-10', 6)
        expected = ['2026-10', '2026-11', '2026-12', '2027-01', '2027-02', '2027-03']
        self.assertEqual(seq, expected)

    def test_seasonal_naive_forecast_properties(self):
        # 24 months of synthetic seasonal data
        pattern = [10, 12, 14, 15, 13, 11, 9, 8, 7, 8, 10, 11]
        history = np.array(pattern + [p * 1.1 for p in pattern], dtype=float)
        
        fc, fitted = seasonal_naive_forecast(history, horizon=6, seasonal_period=12)
        self.assertEqual(len(fc), 6)
        self.assertTrue(np.all(fc >= 0.0))
        # First forecasted month should relate to month 12 of prior year
        self.assertTrue(fc[0] > 0)

    def test_holt_winters_non_negative_and_shape(self):
        # 36 months of data
        pattern = [50, 70, 75, 80, 72, 85, 90, 95, 82, 78, 70, 65]
        history = np.array(pattern * 3, dtype=float)
        
        fc, fitted, ok = holt_winters_forecast(history, horizon=6, damped=True, seasonal_period=12)
        self.assertEqual(len(fc), 6)
        self.assertTrue(np.all(fc >= 0.0))

    def test_backtest_model_selection(self):
        pattern = [50, 60, 70, 80, 75, 85, 90, 95, 85, 80, 70, 65]
        history = np.array(pattern * 3, dtype=float)
        
        res = backtest_revenue_models(history, test_len=6)
        self.assertIn('selected', res)
        self.assertIn('mape', res)
        self.assertIsInstance(res['mape'], float)


class TestForecastApi(unittest.TestCase):
    """Contract tests for GET /api/finance/forecast."""

    def setUp(self):
        import os
        self.client = app.test_client()
        self.client.testing = True
        self.api_key = os.environ.get('API_KEY', '')
        self.headers = {'X-API-Key': self.api_key}

    def test_forecast_endpoint_structure(self):
        months = generate_month_sequence('2024-04', 30)
        conn = MagicMock()
        conn.cursor.return_value.fetchall.return_value = []
        with patch('forecast_service.get_db_connection', return_value=conn), \
             patch('forecast_service.get_ist_today', return_value=datetime.date(2026, 10, 25)), \
             patch('forecast_service.fetch_revenue_history', return_value=(months, np.full(30, 1000.), 0.8)), \
             patch('forecast_service.fetch_expense_history', return_value=(months, np.full(30, 500.))), \
             patch('forecast_service.fetch_scheduled_payroll', return_value={}), \
             patch.dict('os.environ', {'FORECAST_OPENING_CASH_BALANCE': '0', 'FORECAST_OPENING_CASH_AS_OF': '2026-09-30'}):
            resp = self.client.get('/api/finance/forecast?horizon=6', headers=self.headers)
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        
        self.assertEqual(data.get('status'), 'ok')
        self.assertEqual(data.get('horizon'), 6)
        self.assertEqual(data.get('as_of_month'), '2026-09')
        self.assertEqual(data.get('forecast_start_month'), '2026-10')

        # Check models metadata
        self.assertIn('models', data)
        self.assertIn('revenue', data['models'])
        self.assertIn('expenses', data['models'])
        self.assertIn('training_months', data['models']['revenue'])
        self.assertEqual(data['models']['revenue']['training_months'], 30)

        # Check summary
        self.assertIn('summary', data)
        self.assertIn('current_cash_balance', data['summary'])
        self.assertIn('projected_total_net', data['summary'])
        self.assertIn('runway_status', data['summary'])

        # Check forecast points and confidence bounds
        forecast = data.get('forecast', [])
        self.assertEqual(len(forecast), 6)
        for pt in forecast:
            rev = pt['revenue']
            exp = pt['operating_expenses']
            self.assertGreaterEqual(rev['upper'], rev['predicted'])
            self.assertGreaterEqual(rev['predicted'], rev['lower'])
            self.assertGreaterEqual(rev['lower'], 0.0)
            self.assertGreaterEqual(exp['upper'], exp['predicted'])
            self.assertGreaterEqual(exp['predicted'], exp['lower'])
            self.assertIn('cumulative_cash', pt)


if __name__ == '__main__':
    unittest.main()
