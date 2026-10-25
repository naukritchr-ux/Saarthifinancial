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
    with patch.dict(os.environ, {'FORECAST_OPENING_CASH_BALANCE': '0'}):
        assert forecast.fetch_current_cash_balance(None) == 0


@pytest.mark.parametrize('value', ['', 'nan', 'inf', 'invalid'])
def test_invalid_cash_does_not_create_fake_money(value):
    with patch.dict(os.environ, {'FORECAST_OPENING_CASH_BALANCE': value}):
        with pytest.raises(forecast.ForecastConfigurationError):
            forecast.fetch_current_cash_balance(None)


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
    months = forecast.generate_month_sequence('2024-04', 31)
    with patch.dict(os.environ, {'FORECAST_OPENING_CASH_BALANCE': '100', 'FORECAST_OPENING_CASH_AS_OF': '2026-10-31'}), \
         patch.object(forecast, 'get_ist_today', return_value=datetime.date(2026, 11, 8)), \
         patch.object(forecast, 'fetch_revenue_history', return_value=(months, np.ones(31) * 100, 0.5)), \
         patch.object(forecast, 'fetch_expense_history', return_value=(months, np.ones(31) * 70)), \
         patch.object(forecast, 'fetch_scheduled_payroll', return_value={'2026-11': 10, '2026-12': 10}):
        result = forecast.generate_full_forecast(2, conn)
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
