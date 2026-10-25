"""Read-path latency regressions; all database and CRM calls are synthetic."""
from unittest.mock import MagicMock, patch
import app as application
import payroll_service


def connection():
    conn = MagicMock()
    conn.cursor.return_value.fetchall.return_value = []
    conn.cursor.return_value.fetchone.return_value = None
    conn.cursor.return_value.__enter__.return_value = conn.cursor.return_value
    return conn


def test_cache_invalidation_does_not_rebuild_database_metadata():
    with patch.object(application, 'refresh_live_exclusions') as refresh, \
         patch.object(application, 'get_data_version') as revision, \
         patch.object(application, 'get_db_connection') as connect, \
         patch.object(application, '_data_version_cache', {'version': 8, 'time': 123}), \
         patch.object(application, '_last_exclusions_refresh_time', 123), \
         patch('growth_tracking_controller._clear_cache_prefix'):
        application.invalidate_all_caches()
        assert application._data_version_cache['time'] == 0
        assert application._last_exclusions_refresh_time == 0
    refresh.assert_not_called()
    revision.assert_not_called()
    connect.assert_not_called()


def test_transaction_reads_never_launch_live_payroll_requests_for_an_empty_table():
    conn = connection()
    with patch.object(application, 'get_db_connection', return_value=conn), \
         patch.object(application, 'get_data_version', return_value=(4321, '2026-10-25')), \
         patch.object(application, 'refresh_live_exclusions'), \
         patch.object(application, '_tx_cache', {}), \
         patch.object(application, 'DB_NAME', 'crm_synthetic'), \
         patch.object(application, 'ENFORCE_API_KEY', False), \
         patch.object(payroll_service, 'get_all_payroll_transactions') as fetch:
        result = application.app.test_client().get('/api/transactions')
    assert result.status_code == 200
    assert result.json == []
    fetch.assert_not_called()


def test_failed_revision_query_closes_its_connection():
    conn = connection()
    conn.cursor.return_value.execute.side_effect = RuntimeError('Synthetic database query failed')
    with patch.object(application, 'get_db_connection', return_value=conn), \
         patch.object(application, '_data_version_cache', {'version': 8, 'as_of': 'synthetic', 'time': 0}):
        assert application.get_data_version(force=True)[0] == 8
    conn.close.assert_called_once()


def test_manual_read_checks_fresh_worker_revision():
    with patch.dict('os.environ', {'FLASK_TESTING': ''}), \
         patch.object(application, 'ENFORCE_API_KEY', False), \
         patch.object(application, '_refresh_sync_cache_revision') as refresh:
        result = application.app.test_client().get('/api/nonexistent?refresh=1')
    assert result.status_code == 404
    refresh.assert_called_once_with(force=True)


def test_warmup_never_blocks_on_database_or_starts_duplicate_data_requests():
    with patch.dict('os.environ', {'FLASK_TESTING': ''}), \
         patch.object(application, 'get_db_connection') as connect, \
         patch.object(application, 'refresh_live_exclusions') as exclusions, \
         patch.object(application, '_refresh_sync_cache_revision') as revision, \
         patch.object(application.threading, 'Thread') as thread:
        result = application.app.test_client().get('/api/warmup')
    assert result.status_code == 200
    assert result.json['ok'] is True
    connect.assert_not_called()
    exclusions.assert_not_called()
    revision.assert_not_called()
    thread.assert_not_called()
