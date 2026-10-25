"""Independent accounting invariants. All data are synthetic; no live DB access."""
import copy
import datetime as dt
from unittest.mock import MagicMock, patch

import pytest
from accounting_service import load_financial_ledger, summarize_ledger, monthly_summaries
from app import app
import forecast_service as forecast


from financial_fixtures import sample_ledger


def test_historical_salary_and_remittance_count_once_in_cash():
    row = summarize_ledger(sample_ledger(), '2026-09-30')
    assert row['net_salary_payable'] == 18000
    assert row['expense_cash'] == 7000
    assert row['total_cash_outflow'] == 25000
    assert row['company_cash_movement_estimate'] == 0
    assert row['ledger_cash_movement_estimate'] == 4500
    assert row['payroll_ctc_cost'] == 24000
    assert row['operating_profit_loss'] is None  # Contributions cannot be guessed away in P&L.
    assert row['payroll_related_expenditure'] == 2000


def test_ctc_changes_do_not_change_recorded_cash():
    data = sample_ledger()
    original = summarize_ledger(data, '2026-09-30')
    data['payroll'][0]['ctc_amount'] = 999999
    changed = summarize_ledger(data, '2026-09-30')
    assert changed['company_cash_movement_estimate'] == original['company_cash_movement_estimate']
    assert changed['total_cash_outflow'] == original['total_cash_outflow']


def test_franchise_share_is_not_deducted_twice_from_company_allocation():
    data = sample_ledger()
    before = summarize_ledger(data, '2026-09-30')
    data['payouts'][0]['amount'] += 1000
    after = summarize_ledger(data, '2026-09-30')
    assert before['company_cash_movement_estimate'] == after['company_cash_movement_estimate']
    assert after['ledger_cash_movement_estimate'] == before['ledger_cash_movement_estimate'] - 1000


def test_receipt_date_can_follow_invoice_date():
    data = sample_ledger()
    data['receipts'][0]['date'] = '2026-10-05'
    september = summarize_ledger(data, '2026-09-30')
    october = summarize_ledger(data, '2026-10-25', '2026-10-01')
    assert september['company_income'] == 25000
    assert september['company_collections_estimate'] == 0
    assert october['company_income'] == 0
    assert october['company_collections_estimate'] == 25000


def test_confirmed_salary_reference_duplicate_is_removed_without_deleting_data():
    data = sample_ledger()
    data['expenses'].append({'id': 3, 'date': '2026-09-28', 'amount': 18000,
                             'expenses': 'Salaries', 'srNo': 'BANK-SAL-001'})
    original = copy.deepcopy(data)
    row = summarize_ledger(data, '2026-09-30')
    assert data == original
    assert row['expenditure_recorded'] == 25000
    assert row['salary_payment_duplicates_removed'] == 18000
    assert row['total_cash_outflow'] == 25000
    assert row['audit']['confirmed_salary_duplicates'] == [3]


def test_salary_label_without_matching_reference_is_not_silently_excluded():
    data = sample_ledger()
    data['expenses'].append({'id': 3, 'date': '2026-09-28', 'amount': 18000,
                             'expenses': 'Salaries', 'srNo': 'OTHER-REF'})
    row = summarize_ledger(data, '2026-09-30')
    assert row['salary_payment_duplicates_removed'] == 0
    assert row['company_cash_movement_estimate'] is None
    assert row['cash_status'] == 'needs_payroll_reconciliation'
    assert row['audit']['unmatched_salary_expenses'] == [3]


def test_duplicate_references_do_not_trigger_ambiguous_matching():
    data = sample_ledger()
    data['payroll'].append(dict(data['payroll'][0], id='sal-2'))
    data['expenses'].append({'id': 3, 'date': '2026-09-28', 'amount': 18000,
                             'expenses': 'Salaries', 'srNo': 'BANK-SAL-001'})
    row = summarize_ledger(data, '2026-09-30')
    assert row['salary_payment_duplicates_removed'] == 0
    assert row['company_cash_movement_estimate'] is None


def test_missing_net_salary_does_not_become_an_invented_zero_cash_balance():
    data = sample_ledger()
    data['payroll'][0]['net_payable'] = None
    row = summarize_ledger(data, '2026-09-30')
    assert row['company_cash_movement_estimate'] is None
    assert row['audit']['missing_net_payable'] == 1
    with pytest.raises(ValueError, match='reconciliation'):
        forecast.fetch_current_cash_balance(None, '2026-09-30', ledger=data)


def test_future_payroll_is_not_recorded_as_actual_mtd():
    data = sample_ledger()
    data['payroll'].append({'id': 'planned', 'date': '2026-10-28', 'net_payable': 50000, 'ctc_amount': 60000})
    row = summarize_ledger(data, '2026-10-25', '2026-10-01')
    assert row['net_salary_payable'] == 0
    assert row['payroll_rows'] == 0
    assert row['operating_profit_loss'] is None
    assert row['audit']['payroll_not_posted_for_period']


def test_undated_records_are_audited_not_assigned_to_the_cutoff():
    data = sample_ledger()
    data['expenses'].append({'id': 3, 'date': None, 'amount': 999999})
    row = summarize_ledger(data, '2026-09-30')
    assert row['expense_cash'] == 7000
    assert row['audit']['undated_records_excluded']['expenditure'] == 1


def test_decimal_totals_do_not_introduce_binary_rounding_errors():
    data = {'invoices': [], 'expenses': [], 'payroll': [], 'payouts': [],
            'manual': [{'date': '2026-09-01', 'amount': '0.10', 'type': 'income'},
                       {'date': '2026-09-01', 'amount': '0.20', 'type': 'income'}]}
    assert summarize_ledger(data, '2026-09-30')['company_cash_movement_estimate'] == 0.30


def test_monthly_and_cumulative_movements_reconcile():
    data = sample_ledger()
    data['manual'] = [{'date': '2026-10-02', 'amount': 750, 'type': 'income'}]
    months = monthly_summaries(data, ['2026-09', '2026-10'])
    assert sum(row['company_cash_movement_estimate'] for row in months.values()) == summarize_ledger(data, '2026-10-31')['company_cash_movement_estimate']


def test_database_loader_uses_parameters_and_receipt_date_before_invoice_date():
    conn = MagicMock()
    conn.cursor.return_value.fetchall.return_value = []
    load_financial_ledger(conn, '2026-09-30')
    calls = conn.cursor.return_value.execute.call_args_list
    assert len(calls) == 6
    assert all(call.args[1] == ['2026-10-01'] for call in calls)
    receipt_sql = calls[1].args[0]
    assert 'COALESCE(DATE(dateReceived), DATE(billDate))' in receipt_sql
    assert 'DELETE' not in ' '.join(call.args[0] for call in calls)


def test_sql_queries_bind_without_percent_formatting_errors():
    import pymysql
    conn = MagicMock()
    conn.cursor.return_value.fetchall.return_value = []
    load_financial_ledger(conn, '2026-09-30')
    raw_conn = pymysql.connections.Connection(defer_connect=True)
    raw_conn.server_status = 0
    cur = raw_conn.cursor()
    for call in conn.cursor.return_value.execute.call_args_list:
        assert '2026-10-01' in cur.mogrify(*call.args)


def test_zero_net_planned_payroll_is_preserved_and_ctc_is_not_used():
    data = sample_ledger()
    data['payroll'].append({'date': '2026-10-28', 'net_payable': 0, 'ctc_amount': 0})
    amounts, sources = forecast.fetch_scheduled_payroll(None, ['2026-10', '2026-11'], ledger=data, include_sources=True)
    assert amounts == {'2026-10': 0, '2026-11': 18000}
    assert sources['2026-10'] == 'planned_payroll_records'
    assert sources['2026-11'] == 'observed_net_payroll_average'


def test_unknown_future_payroll_is_not_invented():
    with pytest.raises(ValueError, match='cannot be assumed zero'):
        forecast.fetch_scheduled_payroll(None, ['2026-10'], ledger={'payroll': []})


@pytest.fixture
def api_client():
    app.config['TESTING'] = True
    with patch('app.ENFORCE_API_KEY', False), patch('app.get_ist_today', return_value=dt.date(2026, 10, 25)):
        yield app.test_client()


def test_actuals_api_mtd_and_future_cutoff_clamping(api_client):
    with patch('app.get_db_connection') as connection, patch('accounting_service.load_financial_ledger', return_value=sample_ledger()) as loader:
        response = api_client.get('/api/finance/actuals?period=mtd&as_of=2027-03-31')
    assert response.status_code == 200
    assert response.json['period'] == {'start': '2026-10-01', 'as_of': '2026-10-25'}
    assert response.json['operating_profit_loss'] is None
    assert loader.call_args.args[1] == dt.date(2026, 10, 25)
    connection.return_value.close.assert_called_once()


def test_actuals_last_closed_month_uses_actual_records(api_client):
    with patch('app.get_db_connection'), patch('accounting_service.load_financial_ledger', return_value=sample_ledger()):
        response = api_client.get('/api/finance/actuals?period=last_closed_month')
    assert response.status_code == 200
    assert response.json['period'] == {'start': '2026-09-01', 'as_of': '2026-09-30'}
    assert response.json['total_cash_outflow'] == 25000


def test_cash_balance_api_and_forecast_use_same_company_funds_basis(api_client):
    data = sample_ledger()
    with patch('app.get_db_connection'), patch('accounting_service.load_financial_ledger', return_value=data):
        response = api_client.get('/api/finance/cash-balance?as_of=2026-09-30')
    assert response.status_code == 200
    assert response.json['cash_balance'] == forecast.fetch_current_cash_balance(None, '2026-09-30', ledger=data)
    assert response.json['breakdown']['net_salary_payable'] == 18000


def test_profit_summary_does_not_invent_annual_salary_or_hide_overlap(api_client):
    with patch('app.get_db_connection'), patch('accounting_service.load_financial_ledger', return_value=sample_ledger()):
        response = api_client.get('/api/finance/summary?fy=2026-2027&as_of=2026-09-30')
    assert response.status_code == 200
    assert response.json['net'] is None
    assert response.json['tax'] is None
    assert response.json['accounting_status'] == 'needs_payroll_reconciliation'
    assert response.json['expenses']['salaries'] == 24000


def test_loader_failure_is_not_reported_as_zero_cash(api_client):
    with patch('app.get_db_connection'), patch('accounting_service.load_financial_ledger', side_effect=RuntimeError('offline')):
        response = api_client.get('/api/finance/cash-balance')
    assert response.status_code == 500
    assert response.json['cash_balance'] is None


def test_invalid_period_does_not_query_database(api_client):
    with patch('app.get_db_connection') as connect:
        response = api_client.get('/api/finance/actuals?start=2026-11-01')
    assert response.status_code == 400
    connect.assert_not_called()


def test_full_forecast_reconciles_with_shared_net_payroll_cash_basis():
    import numpy as np
    data = {'loaded_as_of': '2027-12-31', 'invoices': [], 'receipts': [],
            'expenses': [], 'payroll': [], 'payouts': [],
            'manual': [{'date': '2023-04-01', 'amount': 100000, 'type': 'income'}]}
    for month in forecast.generate_month_sequence('2023-04', 42):
        data['invoices'].append({'date': month+'-10', 'company_income': 25000,
            'revenue': 100000, 'billed_incl_gst': 118000, 'franchisee_share': 75000,
            'invoices_count': 1, 'revenue_invoices_count': 1})
        data['receipts'].append({'date': month+'-20', 'invoice_receipts_gross': 118000,
                                'company_collections_estimate': 25000})
        data['expenses'].extend([{'id': month+'rent', 'date': month+'-10', 'amount': 5000, 'expenses': 'Rent'},
                                 {'id': month+'pf', 'date': month+'-15', 'amount': 2000, 'expenses': 'EPF@3.67%'}])
        data['payroll'].append({'id': month, 'date': month+'-28', 'net_payable': 18000,
                               'ctc_amount': 24000, 'reference_id': 'SAL-'+month})
        data['payouts'].append({'date': month+'-21', 'amount': 88500})
    for month in forecast.generate_month_sequence('2026-10', 6):
        data['payroll'].append({'date': month+'-28', 'net_payable': 18000, 'ctc_amount': 999999})
    months = forecast.generate_month_sequence('2024-04', 30)
    with patch.object(forecast, 'get_ist_today', return_value=dt.date(2026, 10, 25)), \
         patch.object(forecast, 'load_financial_ledger', return_value=data), \
         patch.object(forecast, 'fetch_revenue_history', return_value=(months, np.full(30, 25000.), 1.0)):
        result = forecast.generate_full_forecast(6, MagicMock())
    assert result['summary']['current_cash_balance'] == 100000
    assert result['summary']['projected_total_net'] == pytest.approx(0, abs=0.01)
    assert result['summary']['projected_final_cash'] == 100000
    for point in result['forecast']:
        assert point['scheduled_payroll'] == 18000
        assert point['operating_expenses']['predicted'] == pytest.approx(7000)
        assert point['total_projected_outflow'] == pytest.approx(25000)
        assert point['net_projected'] == pytest.approx(point['expected_collections'] - point['total_projected_outflow'])
    assert result['opening_balance_breakdown']['net_salary_payable'] == 42 * 18000
    assert result['historical'][-1]['net'] == pytest.approx(0)


def test_selected_past_month_end_is_included_in_closed_history(api_client):
    with patch('app.get_db_connection'), patch('accounting_service.load_financial_ledger', return_value=sample_ledger()):
        response = api_client.get('/api/finance/cash-balance?as_of=2026-09-30')
    assert response.json['history'][-1]['month'] == '2026-09'


def test_burn_uses_same_closed_period_and_includes_net_payroll(api_client):
    data = sample_ledger()
    data['manual'].append({'date': '2026-09-01', 'type': 'expense', 'amount': 900})
    with patch('app.get_db_connection'), patch('accounting_service.load_financial_ledger', return_value=data):
        response = api_client.get('/api/finance/moving-avg-burn?as_of=2026-09-30')
    assert response.status_code == 200
    assert response.json['months'] == ['2026-07', '2026-08', '2026-09']
    assert response.json['burn'] == 300


def test_empty_burn_window_is_not_reported_as_self_sustaining(api_client):
    with patch('app.get_db_connection'), patch('accounting_service.load_financial_ledger', return_value={}):
        response = api_client.get('/api/finance/moving-avg-burn')
    assert response.status_code == 422
    assert response.json['burn'] is None


def test_unknown_actual_period_is_rejected_before_loading_sources(api_client):
    with patch('app.get_db_connection') as connect:
        response = api_client.get('/api/finance/actuals?period=whatever')
    assert response.status_code == 400
    connect.assert_not_called()


def test_payroll_transaction_builder_initializes_rows_and_has_ist_clock():
    import payroll_service
    employee = {'id': 'emp-test', 'name': 'Payroll Regression Employee'}
    attendance = {'EmployeeID': 'emp-test', 'FixedGrossSalary': 10000, 'LeavesTaken': 0, 'PaidLeaves': 0}
    with patch.object(payroll_service, 'get_ist_today', return_value=dt.date(2026, 4, 30)), \
         patch.object(payroll_service, 'fetch_employees_list', return_value=[employee]), \
         patch.object(payroll_service, 'fetch_monthly_attendance', return_value=[attendance]):
        rows = payroll_service.get_payroll_transactions_for_fy('2026-2027', force_refresh=True)
    assert len(rows) == 1
    assert rows[0]['employeeId'] == 'emp-test'
    assert rows[0]['netPayable'] > 0
    assert rows[0]['date'].startswith('2026-04')


def test_payroll_refresh_rolls_to_current_financial_year():
    import payroll_service
    with patch.object(payroll_service, 'get_ist_today', return_value=dt.date(2027, 4, 1)), \
         patch.object(payroll_service, 'get_payroll_transactions_for_fy', return_value=[]) as builder:
        assert payroll_service.get_all_payroll_transactions(force_refresh=True) == []
    builder.assert_called_once_with('2027-2028', force_refresh=True)


def test_activity_without_payroll_is_visible_in_coverage_audit():
    data = sample_ledger()
    data['expenses'].append({'id': 'older', 'date': '2025-09-10', 'amount': 50, 'expenses': 'Rent'})
    row = summarize_ledger(data, '2026-09-30')
    assert '2025-09' in row['audit']['activity_months_without_payroll']
    assert '2026-09' not in row['audit']['activity_months_without_payroll']
