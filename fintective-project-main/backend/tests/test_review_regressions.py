"""Regression checks for the review fixes. No live database or network required."""
import datetime
import os
from unittest.mock import MagicMock, patch

import numpy as np
import pytest

from app import app
import forecast_service as forecast


@pytest.fixture
def client():
    app.config['TESTING'] = True
    with patch('app.ENFORCE_API_KEY', False):
        yield app.test_client()


def test_zero_opening_cash_is_preserved():
    conn = MagicMock()
    conn.cursor.return_value.fetchone.return_value = {'cash_balance': 0}
    assert forecast.fetch_current_cash_balance(conn) == 0


@pytest.mark.parametrize('value', ['', 'nan', 'inf', 'invalid', '132648198'])
def test_manual_environment_values_do_not_override_the_live_ledger(value):
    conn = MagicMock()
    conn.cursor.return_value.fetchone.return_value = {'cash_balance': 250}
    with patch.dict(os.environ, {'FORECAST_OPENING_CASH_BALANCE': value,
                                'FORECAST_OPENING_CASH_AS_OF': 'wrong-date'}):
        assert forecast.fetch_current_cash_balance(conn) == 250


def test_live_ledger_query_uses_cutoff_on_every_source():
    conn = MagicMock()
    conn.cursor.return_value.fetchone.return_value = {'cash_balance': -100}
    assert forecast.fetch_current_cash_balance(conn, datetime.date(2026, 9, 30)) == -100
    sql, params = conn.cursor.return_value.execute.call_args.args
    assert params == ['2026-10-01'] * 4
    assert 'FROM v_invoice_clean WHERE billDate < %s' in sql
    assert 'is_deleted = 0' in sql
    assert "payment_done = 'Yes'" in sql
    assert 'FROM manual_cash_entries WHERE date < %s' in sql
    conn.cursor.return_value.close.assert_called_once()


def test_live_ledger_cash_has_no_silent_database_failure_fallback():
    conn = MagicMock()
    conn.cursor.return_value.execute.side_effect = RuntimeError('database unavailable')
    with pytest.raises(RuntimeError, match='database unavailable'):
        forecast.fetch_current_cash_balance(conn)
    conn.cursor.return_value.close.assert_called_once()


def test_live_ledger_cash_rejects_missing_result():
    conn = MagicMock()
    conn.cursor.return_value.fetchone.return_value = None
    with pytest.raises(ValueError, match='did not return'):
        forecast.fetch_current_cash_balance(conn)


def test_zero_actual_mape_is_unavailable():
    assert forecast.calculate_mape(np.zeros(2), np.ones(2) * 100) is None
    assert forecast.calculate_mape(np.array([0., 100.]), np.array([50., 100.])) is None


def test_short_history_has_no_invented_accuracy():
    result = forecast.backtest_revenue_models(np.arange(1., 16.))
    assert result['mape'] is None


def test_runway_includes_profitable_months_and_order():
    assert forecast.cash_runway(100, [100, -100, -200]) == 2.5
    assert forecast.cash_runway(100, [-200, 500]) == 0.5
    assert forecast.cash_runway(100, [50, -25]) is None
    assert forecast.cash_runway(0, [100]) == 0


def test_scheduled_small_or_zero_payroll_is_not_overwritten():
    conn = MagicMock()
    conn.cursor.return_value.fetchall.return_value = [
        {'ym': '2026-10', 'monthly_payroll': 0},
        {'ym': '2027-09', 'monthly_payroll': 5000}]
    conn.cursor.return_value.fetchone.return_value = {'avg_payroll': 12345}
    result = forecast.fetch_scheduled_payroll(conn, ['2026-10', '2026-11', '2027-09'])
    assert result == {'2026-10': 0, '2026-11': 12345, '2027-09': 5000}
    assert conn.cursor.return_value.execute.call_args_list[0].args[1] == ['2026-10-01', '2027-10-01']


def test_month_cutoff_and_company_share_query():
    conn = MagicMock()
    conn.cursor.return_value.fetchall.return_value = [
        {'ym': '2026-10', 'billed_rev': 50, 'collected_amt': 59, 'total_gross': 118}]
    months, values, ratio = forecast.fetch_revenue_history(conn, datetime.date(2026, 11, 1))
    assert months[-1] == '2026-10'
    assert values[-1] == 50
    assert ratio == 0.5
    sql, params = conn.cursor.return_value.execute.call_args.args
    assert 'SUM(ourShare)' in sql
    assert params == ['2026-11-01']


def test_cash_scenario_and_runway_use_collections():
    conn = MagicMock()
    conn.cursor.return_value.fetchall.return_value = []
    conn.cursor.return_value.fetchone.return_value = {'cash_balance': 100}
    months = forecast.generate_month_sequence('2024-04', 31)
    with patch.dict(os.environ, {'FORECAST_OPENING_CASH_BALANCE': '100', 'FORECAST_OPENING_CASH_AS_OF': '2026-10-31'}), \
         patch.object(forecast, 'get_ist_today', return_value=datetime.date(2026, 11, 8)), \
         patch.object(forecast, 'fetch_revenue_history', return_value=(months, np.ones(31) * 100, 0.5)), \
         patch.object(forecast, 'fetch_expense_history', return_value=(months, np.ones(31) * 70)), \
         patch.object(forecast, 'fetch_scheduled_payroll', return_value={'2026-11': 10, '2026-12': 10}):
        result = forecast.generate_full_forecast(2, conn)
    assert result['summary']['cash_balance_source'] == 'live_ledger'
    assert result['summary']['cash_balance_as_of'] == '2026-10-31'
    assert result['as_of_month'] == '2026-10'
    assert result['forecast_start_month'] == '2026-11'
    assert result['forecast'][0]['expected_collections'] == 50
    assert result['forecast'][0]['net_projected'] == -30
    assert result['summary']['projected_final_cash'] == 40
    assert result['summary']['runway_months'] is None


@pytest.mark.parametrize('amount', [-1, 0, 0.001, 'nan', 'inf', 'oops'])
def test_bad_transaction_amount_rejected_before_db_access(client, amount):
    with patch('app.get_db_connection') as connect:
        response = client.post('/api/transactions', json={
            'type': 'income', 'amount': amount, 'title': 'Test'})
    assert response.status_code == 400
    connect.assert_not_called()


def test_income_uses_manual_ledger_not_random_invoice(client):
    conn = MagicMock()
    with patch('app.get_db_connection', return_value=conn), patch('app.DB_NAME', 'crm_db'), \
         patch('app.log_audit'), patch('app.invalidate_all_caches') as invalidate:
        response = client.post('/api/transactions', json={
            'type': 'income', 'title': 'One-off receipt', 'amount': 100,
            'date': '2026-10-25', 'referenceId': 'CUSTOM'})
    assert response.status_code == 201
    assert response.json['id'].startswith('manual-')
    sql, values = conn.cursor.return_value.execute.call_args.args
    assert 'INSERT INTO manual_cash_entries' in sql
    assert 'invoice_id' not in sql
    assert 100 in values
    invalidate.assert_called_once()


def test_manual_income_can_be_deleted(client):
    conn = MagicMock()
    conn.cursor.return_value.fetchone.return_value = {'id': 'manual-' + 'a' * 32, 'amount': 100}
    with patch('app.get_db_connection', return_value=conn), patch('app.DB_NAME', 'crm_db'), \
         patch('app.log_audit'), patch('app.invalidate_all_caches'):
        response = client.delete('/api/transactions/manual-' + 'a' * 32)
    assert response.status_code == 200
    assert 'DELETE FROM manual_cash_entries' in conn.cursor.return_value.execute.call_args.args[0]


def test_cash_balance_adds_manual_income(client):
    conn = MagicMock()
    conn.cursor.return_value.fetchone.return_value = {'cash_balance': 100}
    with patch('app.get_db_connection', return_value=conn):
        response = client.get('/api/finance/cash-balance?as_of=2026-10-25')
    assert response.json['cash_balance'] == 100
    sql, params = conn.cursor.return_value.execute.call_args.args
    assert 'FROM manual_cash_entries' in sql
    assert params == ['2026-10-25'] * 4


def test_expense_selection_keeps_annual_payment_pattern():
    # April-March years with a large annual March payment; holdout includes March.
    history = np.array(([100.] * 11 + [1000.]) * 3 + [100.] * 6)
    result = forecast.select_expense_model(history, horizon=6)
    assert result['test_months'] == 12
    assert result['selected'] == 'Seasonal-Naive (YoY Trend)'
    assert result['mae'] == 0
    assert result['forecast'][-1] == 1000


def test_expense_median_can_beat_a_one_time_training_outlier():
    history = np.full(42, 100.)
    history[29] = 10000.
    result = forecast.select_expense_model(history, horizon=6)
    assert result['selected'] == 'Trailing 6-Month Median'
    assert result['mae'] == 0
    assert result['mape'] == 0
    assert np.allclose(result['forecast'], 100)
    # The outlier remains in the actual history; no observations are dropped.
    assert history[29] == 10000


def test_expense_backtest_does_not_train_on_held_out_actuals():
    history = np.array([100.] * 30 + [200.] * 12)
    result = forecast.select_expense_model(history, horizon=3)
    assert result['mae'] == pytest.approx(100)
    assert result['mape'] == pytest.approx(50)
    # Refitting the selected trailing model uses recent actuals for future months.
    assert np.allclose(result['forecast'], 200)


def test_expense_zero_actuals_do_not_invent_percentage_accuracy():
    result = forecast.select_expense_model(np.zeros(36), horizon=6)
    assert result['mape'] is None
    assert result['wape'] is None
    assert result['mae'] == 0
    assert np.all(result['forecast'] == 0)


def test_expense_short_history_has_no_fake_backtest():
    result = forecast.select_expense_model(np.arange(1., 6.), horizon=2)
    assert result['test_months'] == 0
    assert result['mape'] is None and result['mae'] is None
    assert np.allclose(result['forecast'], 3)


def test_expense_history_rejects_non_finite_inputs():
    with pytest.raises(ValueError, match='finite'):
        forecast.select_expense_model(np.array([100., np.nan]))
