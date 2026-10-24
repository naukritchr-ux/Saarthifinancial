import sys
import os
import json
import unittest
from unittest.mock import patch, MagicMock

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
os.environ.setdefault('FLASK_TESTING', 'true')

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import app as flask_app, _clear_sync_debug_cache

_API_KEY = os.environ.get('API_KEY', '')
_AUTH = {'X-API-Key': _API_KEY}


class TestSyncDebugAuth(unittest.TestCase):
    """Verify that /api/health/sync-debug requires valid X-API-Key, while health and warmup remain public."""

    def setUp(self):
        flask_app.config['TESTING'] = True
        self.client = flask_app.test_client()
        _clear_sync_debug_cache()

    def test_no_api_key_returns_401(self):
        resp = self.client.get('/api/health/sync-debug')
        self.assertEqual(resp.status_code, 401, resp.data)
        data = resp.get_json() or {}
        self.assertFalse(data.get('success'))
        self.assertIn('Unauthorized', data.get('error', ''))

    def test_invalid_api_key_returns_401(self):
        resp = self.client.get('/api/health/sync-debug', headers={'X-API-Key': 'bogus-key-12345'})
        self.assertEqual(resp.status_code, 401, resp.data)

    def test_health_endpoints_remain_public(self):
        """
        /health, /api/health, and /api/warmup must remain accessible without X-API-Key.
        Assert /health and /api/health response has no 'host', no 'database' name key,
        and no 'exclusions'.
        """
        for path in ['/health', '/api/health']:
            resp = self.client.get(path)
            self.assertEqual(resp.status_code, 200, f"Path {path} returned {resp.status_code}")
            data = resp.get_json() or {}

            # Assert no internal exclusions block
            self.assertNotIn('exclusions', data, f"Exclusions block should be removed from public {path}")

            # Assert database block contains only status: 'connected' | 'disconnected'
            db_block = data.get('database') or {}
            self.assertIn('status', db_block)
            self.assertIn(db_block['status'], ['connected', 'disconnected'])
            self.assertNotIn('host', db_block, f"Host should be removed from {path}")
            self.assertNotIn('database', db_block, f"Database name key should be removed from {path}")
            self.assertNotIn('test', db_block, f"Test row should be removed from {path}")
            self.assertNotIn('error', db_block, f"Error details should be removed from {path}")
            self.assertEqual(set(db_block.keys()), {'status'})

            # Assert standard public fields are retained
            self.assertIn('status', data)
            self.assertEqual(data.get('service'), 'fintective-backend')
            self.assertIn('cache', data)
            self.assertIn('warm', data['cache'])
            self.assertIn('age_seconds', data['cache'])
            self.assertIn('timestamp', data)

        # /api/warmup remains public as well
        resp_warmup = self.client.get('/api/warmup')
        self.assertEqual(resp_warmup.status_code, 200)
        self.assertTrue(resp_warmup.get_json().get('ok'))

    def test_health_disconnected_sanitizes_db_error(self):
        """When test_connection fails, public health returns disconnected without exposing error/host."""
        mock_failure = {
            'status': 'error',
            'message': 'Access denied for user root@private-db.internal',
            'host': 'private-cluster.aiven.internal',
            'database': 'secret_crm_db'
        }
        with patch('db.test_connection', return_value=mock_failure):
            resp = self.client.get('/health')
            self.assertEqual(resp.status_code, 200)
            data = resp.get_json() or {}
            self.assertEqual(data.get('status'), 'degraded')
            self.assertEqual(data.get('database'), {'status': 'disconnected'})

            raw_str = json.dumps(data)
            self.assertNotIn('private-cluster', raw_str)
            self.assertNotIn('secret_crm_db', raw_str)
            self.assertNotIn('Access denied', raw_str)
            self.assertNotIn('host', raw_str)


class TestSyncDebugPayload(unittest.TestCase):
    """Verify response schema: no 'url', no raw error text, generic db boolean."""

    def setUp(self):
        flask_app.config['TESTING'] = True
        self.client = flask_app.test_client()
        _clear_sync_debug_cache()

    def test_valid_key_returns_200_with_no_url_field(self):
        """Valid X-API-Key returns 200, and no 'url' field exists in payload."""
        mock_res = {'ok': True, 'data': [{'id': 1}], 'url': 'https://saarthi-crm.example.com/api/test'}
        with patch('sync_service.fetch_saarthi_endpoint', return_value=mock_res):
            resp = self.client.get('/api/health/sync-debug', headers=_AUTH)

        self.assertEqual(resp.status_code, 200, resp.data)
        data = resp.get_json() or {}
        self.assertTrue(data.get('success'))
        self.assertIn('diagnostics', data)

        diag = data['diagnostics']
        self.assertIn('endpoints', diag)
        self.assertIn('db', diag)

        # Check that no 'url' exists anywhere in the JSON string or object
        self.assertNotIn('"url"', json.dumps(data))
        for name, ep in diag['endpoints'].items():
            self.assertNotIn('url', ep)
            self.assertTrue(ep['ok'])
            self.assertEqual(ep['row_count'], 1)

    def test_generic_db_status_only(self):
        """db key must only contain generic ok boolean, never internal error or query counts."""
        mock_res = {'ok': True, 'data': [], 'url': 'https://crm.example.com'}
        with patch('sync_service.fetch_saarthi_endpoint', return_value=mock_res):
            resp = self.client.get('/api/health/sync-debug', headers=_AUTH)

        diag = resp.get_json()['diagnostics']
        self.assertEqual(diag['db'], {'ok': True})

    def test_endpoint_failure_sanitizes_errors(self):
        """Failed endpoint returns short error code, no raw error string and no url."""
        raw_error_text = "Failed to fetch /Invoice: HTTP 500: Internal Server Error (Database connection leak)"
        mock_res = {
            'ok': False,
            'data': [],
            'error': raw_error_text,
            'url': 'https://internal-crm.host.corp:8443/private/v1/Invoice'
        }
        with patch('sync_service.fetch_saarthi_endpoint', return_value=mock_res):
            resp = self.client.get('/api/health/sync-debug', headers=_AUTH)

        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        raw_json_str = json.dumps(data)

        # Verify raw error details and URL are completely absent from response
        self.assertNotIn('Database connection leak', raw_json_str)
        self.assertNotIn('internal-crm.host.corp', raw_json_str)
        self.assertNotIn('"url"', raw_json_str)

        for name, ep in data['diagnostics']['endpoints'].items():
            self.assertFalse(ep['ok'])
            self.assertEqual(ep['row_count'], 0)
            self.assertIn(ep.get('error'), ['unreachable', 'bad_response'])


class TestSyncDebugCaching(unittest.TestCase):
    """Verify 60-second in-memory caching prevents repeated outbound CRM calls."""

    def setUp(self):
        flask_app.config['TESTING'] = True
        self.client = flask_app.test_client()
        _clear_sync_debug_cache()

    def test_second_call_within_60s_served_from_cache(self):
        mock_fetch = MagicMock(return_value={
            'ok': True,
            'data': [{'id': 1}, {'id': 2}],
            'url': 'https://saarthi-crm.example.com/api/test'
        })

        with patch('sync_service.fetch_saarthi_endpoint', mock_fetch):
            # First hit: executes outbound CRM calls for all 6 endpoints
            resp1 = self.client.get('/api/health/sync-debug', headers=_AUTH)
            self.assertEqual(resp1.status_code, 200)
            self.assertEqual(mock_fetch.call_count, 6, "Expected exactly 6 calls on initial fetch")

            # Second hit within 60s: served from in-memory cache
            resp2 = self.client.get('/api/health/sync-debug', headers=_AUTH)
            self.assertEqual(resp2.status_code, 200)
            self.assertEqual(mock_fetch.call_count, 6, "Expected call_count to remain 6 (cached)")

            # Responses must be identical
            self.assertEqual(resp1.get_json(), resp2.get_json())


if __name__ == '__main__':
    unittest.main()
