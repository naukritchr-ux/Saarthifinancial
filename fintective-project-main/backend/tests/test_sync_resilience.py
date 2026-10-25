"""Sync failure/recovery tests with synthetic HTTP and database responses only."""
import io
import json
import os
import urllib.error
from unittest.mock import MagicMock, patch

import pytest
import sync_service as sync
import app as app_module


def response(payload):
    result = MagicMock()
    result.__enter__.return_value = result
    result.status = 200
    result.read.return_value = json.dumps(payload).encode()
    return result


@pytest.mark.parametrize('payload', [
    {'data': [{'id': 1}]}, {'data': {'expenditures': [{'id': 1}]}},
    {'employees': [{'id': 1}]}, {'attendance': [{'EmployeeID': 1}]},
    {'expenditures': [{'id': 1}]}, [{'id': 1}],
])
def test_valid_collection_envelopes_are_supported(payload):
    with patch.dict(os.environ, {'SAARTHI_API_BASE_URL': 'https://crm.test/api'}), \
         patch.object(sync, '_request_json', return_value=payload):
        result = sync.fetch_saarthi_endpoint('enquiries')
    assert result['ok'] and result['complete']
    assert len(result['data']) == 1


@pytest.mark.parametrize('payload', [
    {'success': False, 'message': 'Token expired'}, {'message': 'Not authorized'},
    {'unexpected': 7}, {'data': ['invalid row']}, '<html>',
])
def test_error_or_malformed_payload_is_not_a_successful_empty_sync(payload):
    with patch.dict(os.environ, {'SAARTHI_API_BASE_URL': 'https://crm.test/api'}), \
         patch.object(sync, '_request_json', return_value=payload):
        result = sync.fetch_saarthi_endpoint('enquiries')
    assert result['ok'] is False
    assert result['data'] == []
    assert result['complete'] is False


def test_failed_page_does_not_return_partial_records():
    with patch.dict(os.environ, {'SAARTHI_API_BASE_URL': 'https://crm.test/api'}), \
         patch.object(sync, '_request_json', side_effect=[{'data': [{'id': 1}], 'totalPages': 2}, TimeoutError('page 2 offline')]):
        result = sync.fetch_saarthi_endpoint('enquiries')
    assert result['ok'] is False
    assert result['data'] == []


def test_more_than_fifty_pages_are_not_silently_truncated():
    from urllib.parse import urlsplit, parse_qs
    def page(url, headers, timeout):
        number = int(parse_qs(urlsplit(url).query).get('page', ['1'])[0])
        return {'data': [{'id': number}], 'totalPages': 51}
    with patch.dict(os.environ, {'SAARTHI_API_BASE_URL': 'https://crm.test/api'}), \
         patch.object(sync, '_request_json', side_effect=page):
        result = sync.fetch_saarthi_endpoint('enquiries?limit=100')
    assert result['ok']
    assert len(result['data']) == 51
    assert result['data'][-1]['id'] == 51


def test_repeated_pages_are_detected():
    with patch.dict(os.environ, {'SAARTHI_API_BASE_URL': 'https://crm.test/api'}), \
         patch.object(sync, '_request_json', return_value={'data': [{'id': 1}], 'totalPages': 2}):
        result = sync.fetch_saarthi_endpoint('enquiries')
    assert not result['ok']
    assert 'repeated' in result['error']


def test_transient_502_retries_then_succeeds():
    error = urllib.error.HTTPError('https://crm.test', 502, 'Bad Gateway', {}, io.BytesIO())
    with patch('urllib.request.urlopen', side_effect=[error, response([{'id': 1}])]) as fetch, \
         patch.object(sync.time, 'sleep') as wait:
        assert sync._request_json('https://crm.test/api/Invoice', {}, 12) == [{'id': 1}]
    assert fetch.call_count == 2
    wait.assert_called_once()


def test_auth_failure_is_not_retried_or_sent_to_another_configured_host():
    error = urllib.error.HTTPError('https://crm.test', 401, 'Unauthorized', {}, io.BytesIO())
    with patch.dict(os.environ, {'SAARTHI_API_BASE_URL': 'https://crm.test/api', 'SAARTHI_API_TOKEN': 'token-value'}), \
         patch('urllib.request.urlopen', side_effect=error) as fetch, patch.object(sync.time, 'sleep') as wait:
        result = sync.fetch_saarthi_endpoint('Invoice')
    assert not result['ok']
    assert '401' in result['error']
    assert fetch.call_count == 1
    wait.assert_not_called()


def test_configured_api_prefix_and_bearer_prefix_are_not_duplicated():
    with patch.dict(os.environ, {'SAARTHI_API_BASE_URL': 'https://crm.test/api/', 'SAARTHI_API_TOKEN': 'Bearer demo-token'}), \
         patch.object(sync, '_request_json', return_value=[]) as fetch:
        result = sync.fetch_saarthi_endpoint('enquiries')
    assert result['ok']
    assert fetch.call_args.args[0] == 'https://crm.test/api/enquiries'
    assert fetch.call_args.args[1]['Authorization'] == 'Bearer demo-token'


def test_live_worker_is_not_marked_stale_based_on_age():
    cur = MagicMock()
    cur.fetchone.side_effect = [{'owner': 987}, {'id': 31, 'age_sec': 7200}]
    assert sync.active_sync_job(cur)['id'] == 31
    assert not any('UPDATE' in call.args[0] or 'RELEASE_LOCK' in call.args[0] for call in cur.execute.call_args_list)


def test_orphaned_job_is_recovered_only_without_a_lock_owner():
    cur = MagicMock()
    cur.fetchone.side_effect = [{'owner': None}, {'id': 31, 'age_sec': 600}]
    assert sync.active_sync_job(cur) is None
    assert any('interrupted' in call.args[0] for call in cur.execute.call_args_list)


def test_missing_sync_log_table_uses_existing_schema_initializer():
    import pymysql
    cur = MagicMock()
    cur.fetchone.side_effect = [{'owner': None}, None]
    cur.execute.side_effect = [None, pymysql.err.ProgrammingError(1146, 'Table does not exist'), None]
    with patch.object(sync, 'ensure_tables_exist', return_value=True) as initialize:
        assert sync.active_sync_job(cur) is None
    initialize.assert_called_once()


@pytest.fixture
def client():
    app_module.app.config['TESTING'] = True
    with patch.object(app_module, 'ENFORCE_API_KEY', False):
        yield app_module.app.test_client()


def fake_database():
    conn = MagicMock()
    cur = conn.cursor.return_value.__enter__.return_value
    cur.fetchone.return_value = {'got': 1}
    cur.lastrowid = 77
    cur.fetchall.return_value = []
    return conn, cur


def test_post_adopts_the_already_running_job(client):
    conn, _ = fake_database()
    with patch.object(app_module, 'get_db_connection', return_value=conn), \
         patch.object(sync, 'active_sync_job', return_value={'id': 19}), \
         patch.object(app_module.threading, 'Thread') as thread:
        result = client.post('/api/sync')
    assert result.status_code == 200
    assert result.json['log_id'] == 19
    assert result.json['status'] == 'in_progress'
    thread.assert_not_called()


def test_missing_log_id_never_launches_an_untracked_worker(client):
    conn, cur = fake_database()
    cur.lastrowid = 0
    with patch.object(app_module, 'get_db_connection', return_value=conn), \
         patch.object(sync, 'active_sync_job', return_value=None), \
         patch.object(app_module.threading, 'Thread') as thread:
        result = client.post('/api/sync')
    assert result.status_code == 503
    thread.assert_not_called()


def test_thread_start_failure_is_written_to_the_job(client):
    conn, _ = fake_database()
    with patch.object(app_module, 'get_db_connection', return_value=conn), \
         patch.object(sync, 'active_sync_job', return_value=None), \
         patch.object(app_module.threading, 'Thread') as thread, patch.object(app_module, '_fail_sync_job') as failed:
        thread.return_value.start.side_effect = RuntimeError('thread unavailable')
        result = client.post('/api/sync')
    assert result.status_code == 503
    failed.assert_called_once()
    assert failed.call_args.args[0] == 77


def test_status_reads_the_requested_job_not_the_latest_other_run(client):
    conn, cur = fake_database()
    cur.fetchall.return_value = [{'id': 8, 'status': 'completed', 'enquiries_count': 2}]
    with patch.object(app_module, 'get_db_connection', return_value=conn), patch.object(sync, 'active_sync_job'):
        result = client.get('/api/sync/status?log_id=8')
    assert result.status_code == 200
    assert result.json['latest']['id'] == 8
    query = cur.execute.call_args.args
    assert 'WHERE id = %s' in query[0] and query[1] == [8]
    assert result.headers['Cache-Control'] == 'no-store'


def test_bad_job_id_is_rejected_before_database_access(client):
    with patch.object(app_module, 'get_db_connection') as connect:
        result = client.get('/api/sync/status?log_id=1%20OR%201=1')
    assert result.status_code == 400
    connect.assert_not_called()


def test_cache_revision_updates_other_workers_without_repeated_flushes():
    with patch.object(app_module, '_sync_cache_revision', None), \
         patch.object(app_module, 'get_data_version', side_effect=[(1, ''), (1, ''), (2, '')]), \
         patch.object(app_module, 'invalidate_all_caches') as clear:
        for _ in range(3):
            app_module._refresh_sync_cache_revision()
    assert clear.call_count == 2


def test_main_lock_failure_prevents_unprotected_writes():
    conn, cur = fake_database()
    cur.fetchone.return_value = {'got': 0}
    with patch.object(sync, 'get_db_connection', return_value=conn), \
         patch.object(sync, 'ensure_tables_exist'), patch.object(sync, 'fetch_saarthi_endpoint') as fetch:
        result = sync.sync_saarthi_all(existing_log_id=77)
    assert not result['ok']
    fetch.assert_not_called()
    cur.executemany.assert_not_called()


def test_force_payroll_failure_does_not_reimport_disk_cache(tmp_path):
    import payroll_service as payroll
    (tmp_path/'employees.json').write_text('[{"id": "stale"}]')
    with patch.object(payroll, 'CACHE_DIR', str(tmp_path)), patch.object(payroll, '_http_get_json', side_effect=RuntimeError('HTTP 401')):
        with pytest.raises(RuntimeError, match='401'):
            payroll.fetch_employees_list(force_refresh=True)


def test_payroll_uses_the_shared_authenticated_crm_transport():
    import payroll_service as payroll
    with patch.object(sync, 'fetch_saarthi_endpoint', return_value={'ok': True, 'data': [{'EmployeeID': 1}]}) as fetch:
        rows = payroll._http_get_json('https://api.sarthi360.in/api/payroll/attendance?month=0')
    assert rows == [{'EmployeeID': 1}]
    fetch.assert_called_once_with('payroll/attendance?month=0', timeout=15)


def test_force_attendance_failure_does_not_reimport_stale_disk_records(tmp_path):
    import payroll_service as payroll
    (tmp_path/'att_2026-2027_0.json').write_text('[{"EmployeeID": "stale"}]')
    with patch.object(payroll, 'CACHE_DIR', str(tmp_path)), \
         patch.object(payroll, '_http_get_json', side_effect=RuntimeError('HTTP 401')):
        with pytest.raises(RuntimeError, match='401'):
            payroll.fetch_monthly_attendance('2026-2027', 0, force_refresh=True)


def good_fetch(path, timeout=12):
    text = path.lower()
    if 'franchise-payments' in text:
        rows = []
    elif 'franchisees' in text:
        rows = [{'id': 3, 'nameAsPerAgreement': 'Example Franchise'}]
    elif 'enquiries' in text:
        rows = [{'id': 1, 'companyName': 'Example', 'enquiryStatus': 'open'}]
    elif 'invoice' in text:
        rows = [{'id': 2, 'billNumber': 'B-2', 'billDate': '2026-10-01'}]
    elif 'expenditure' in text or 'expense' in text:
        rows = [{'id': 4, 'billDate': '2026-10-01', 'amount': 100, 'expenses': 'Rent'}]
    elif 'clients' in text:
        rows = [{'id': 5, 'companyName': 'Example Client'}]
    else:
        rows = []
    return {'ok': True, 'data': rows, 'complete': True}


def test_an_expense_write_failure_rolls_back_without_blocking_clients():
    conn, cur = fake_database()
    def write(sql, params):
        if 'INSERT INTO expenditure' in sql:
            raise RuntimeError('Invalid expense row')
    cur.executemany.side_effect = write
    with patch.object(sync, 'get_db_connection', return_value=conn), patch.object(sync, 'ensure_tables_exist'), \
         patch.object(sync, 'fetch_saarthi_endpoint', side_effect=good_fetch), \
         patch('payroll_service.get_all_payroll_transactions', return_value=[]), \
         patch.object(app_module, 'invalidate_all_caches'):
        result = sync.sync_saarthi_all(existing_log_id=77)
    assert result['status'] == 'completed_with_warnings'
    assert result['expenses'] == 0
    assert result['clients'] == 1
    assert result['invoices'] == 1
    assert any('Invalid expense row' in error for error in result['errors'])
    conn.rollback.assert_called_once()
    assert any('INSERT INTO clients_info' in call.args[0] for call in cur.executemany.call_args_list)


def test_partial_http_fetch_never_runs_expense_reconciliation():
    conn, cur = fake_database()
    def fetch(path, timeout=12):
        if 'expenditure' in path:
            return {'ok': False, 'data': [], 'complete': False, 'error': 'Page 2 incomplete'}
        return good_fetch(path, timeout)
    with patch.object(sync, 'get_db_connection', return_value=conn), patch.object(sync, 'ensure_tables_exist'), \
         patch.object(sync, 'fetch_saarthi_endpoint', side_effect=fetch), \
         patch.object(sync, 'retire_missing_expenses') as retire, \
         patch('payroll_service.get_all_payroll_transactions', return_value=[]), \
         patch.object(app_module, 'invalidate_all_caches'):
        result = sync.sync_saarthi_all(existing_log_id=77)
    retire.assert_not_called()
    assert result['expenses'] == 0
    assert result['status'] == 'completed_with_warnings'


def test_skipped_expense_records_defer_removal_and_remain_a_warning():
    conn, _ = fake_database()
    def fetch(path, timeout=12):
        result = good_fetch(path, timeout)
        if 'expenditure' in path:
            result['data'].append({'id': 'vendor-placeholder', 'amount': 50})
        return result
    with patch.object(sync, 'get_db_connection', return_value=conn), patch.object(sync, 'ensure_tables_exist'), \
         patch.object(sync, 'fetch_saarthi_endpoint', side_effect=fetch), \
         patch.object(sync, 'retire_missing_expenses') as retire, \
         patch('payroll_service.get_all_payroll_transactions', return_value=[]), \
         patch.object(app_module, 'invalidate_all_caches'):
        result = sync.sync_saarthi_all(existing_log_id=77)
    retire.assert_not_called()
    assert result['expenses'] == 1
    assert result['status'] == 'completed_with_warnings'
    assert any('reconciliation deferred' in error for error in result['errors'])


def test_reconciliation_write_failure_rolls_back_the_whole_source():
    conn, _ = fake_database()
    def reconcile(cur, table, ids, prune):
        if table == 'enquiries':
            raise RuntimeError('reconciliation write interrupted')
        return 0
    with patch.object(sync, 'get_db_connection', return_value=conn), patch.object(sync, 'ensure_tables_exist'), \
         patch.object(sync, 'fetch_saarthi_endpoint', side_effect=good_fetch), \
         patch.object(sync, 'reconcile_missing_ids', side_effect=reconcile), \
         patch('payroll_service.get_all_payroll_transactions', return_value=[]), \
         patch.object(app_module, 'invalidate_all_caches'):
        result = sync.sync_saarthi_all(existing_log_id=77)
    conn.rollback.assert_called_once()
    assert result['enquiries'] == 0
    assert result['clients'] == 1
    assert result['status'] == 'completed_with_warnings'


def test_failed_auxiliary_sources_are_not_reported_as_full_success():
    conn, cur = fake_database()
    def fetch(path, timeout=12):
        if 'clients' in path or 'legals' in path or 'franchise-payments' in path:
            return {'ok': False, 'data': [], 'error': 'HTTP 401 upstream'}
        return good_fetch(path, timeout)
    with patch.object(sync, 'get_db_connection', return_value=conn), patch.object(sync, 'ensure_tables_exist'), \
         patch.object(sync, 'fetch_saarthi_endpoint', side_effect=fetch), \
         patch('payroll_service.get_all_payroll_transactions', return_value=[]), \
         patch.object(app_module, 'invalidate_all_caches'):
        result = sync.sync_saarthi_all(existing_log_id=77)
    assert result['status'] == 'completed_with_warnings'
    assert any('Clients:' in item for item in result['errors'])
    assert any('Legals:' in item for item in result['errors'])
    assert any('Franchise payments:' in item for item in result['errors'])


def test_failed_job_revisions_also_invalidate_other_worker_caches():
    conn, cur = fake_database()
    cur.fetchone.return_value = {'revision': 99, 'as_of': '2026-10-25 12:00:00'}
    with patch.object(app_module, 'get_db_connection', return_value=conn):
        version, _ = app_module.get_data_version(force=True)
    assert version == 99
    assert 'SUM(id)' in cur.execute.call_args.args[0]
    assert "'failed'" in cur.execute.call_args.args[0]


def test_employee_route_prefers_existing_root_mount_and_fallback_stays_on_configured_crm():
    error = urllib.error.HTTPError('https://crm.test/employees', 404, 'Not Found', {}, io.BytesIO())
    with patch.dict(os.environ, {'SAARTHI_API_BASE_URL': 'https://crm.test/api'}), \
         patch.object(sync, '_request_json', side_effect=[error, [{'id': 1}]]) as fetch:
        result = sync.fetch_saarthi_endpoint('employees')
    assert result['ok']
    assert [call.args[0] for call in fetch.call_args_list] == ['https://crm.test/employees', 'https://crm.test/api/employees']


def test_employee_id_number_and_attendance_id_string_match():
    import datetime
    import payroll_service as payroll
    with patch.object(payroll, 'get_ist_today', return_value=datetime.date(2026, 4, 30)), \
         patch.object(payroll, 'fetch_employees_list', return_value=[{'id': 5, 'name': 'Sync Test Employee'}]), \
         patch.object(payroll, 'fetch_monthly_attendance', return_value=[{'EmployeeID': '5', 'FixedGrossSalary': 10000}]):
        rows = payroll.get_payroll_transactions_for_fy('2026-2027', force_refresh=True)
    assert len(rows) == 1
    assert str(rows[0]['employeeId']) == '5'


def test_unusable_employee_response_is_not_silently_reported_as_no_payroll():
    import payroll_service as payroll
    with patch.object(payroll, 'fetch_employees_list', return_value=[{'message': 'Wrong endpoint'}]):
        with pytest.raises(ValueError, match='employee IDs'):
            payroll.get_payroll_transactions_for_fy('2026-2027', force_refresh=True)
