"""
SQL Injection + Prune Behaviour Tests — POST /api/sync/prune & GET /api/sync/ghost-report

Coverage:
 SQLi:
  1. tables=["information_schema.COLUMNS"]       -> 400
  2. tables=["enquiries; DROP TABLE invoice--"]  -> 400
  3. tables=["enquiries` JOIN `invoice"]         -> 400
  4. tables=["employees"] (not in allowlist)     -> 400
  5. mix of valid + invalid                      -> 400 (no partial exec)

 ENABLE_PRUNE_API gate:
  6. ENABLE_PRUNE_API unset / not "true"         -> 403 "Prune via API is disabled"
  7. ENABLE_PRUNE_API="true" + valid tables      -> NOT 403

 Dry-run (confirm_prune=False, no real deletes):
  8. Valid dry-run returns 200 with report shape
  9. dry_run=True in response body
  10. pruned=0 for every table (no real deletes hit DB)

 10 % threshold (via mocked cursor):
  11. ghost_count > 10 % without force  -> report includes refused=True / refuse_reason
  12. ghost_count > 10 % with force=True -> would proceed (mocked, so no real deletes)

 Audit log write (fully mocked):
  13. Real prune on mocked cursor writes exactly one audit_log INSERT per table pruned

RULES: confirm_prune=True tests MUST use mocked DB — no live deletes.
"""

import sys
import os
import json
import unittest
from unittest.mock import patch, MagicMock, call

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
os.environ.setdefault('FLASK_TESTING', 'true')

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import app as flask_app

_API_KEY = os.environ.get('API_KEY', '')
# Only the normal API key per spec
_AUTH = {'X-API-Key': _API_KEY, 'Content-Type': 'application/json'}


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _post_prune(client, body, extra_headers=None):
    h = dict(_AUTH)
    if extra_headers:
        h.update(extra_headers)
    return client.post('/api/sync/prune', data=json.dumps(body), headers=h)

def _get_ghost(client):
    return client.get('/api/sync/ghost-report', headers=_AUTH)


class TestPruneSQLi(unittest.TestCase):
    """Table-name injection must be blocked regardless of ENABLE_PRUNE_API."""

    def setUp(self):
        flask_app.config['TESTING'] = True
        self.client = flask_app.test_client()

    def _with_prune_enabled(self):
        return patch.dict(os.environ, {'ENABLE_PRUNE_API': 'true'})

    def test_information_schema_returns_400(self):
        with self._with_prune_enabled():
            resp = _post_prune(self.client, {'tables': ['information_schema.COLUMNS'], 'confirm_prune': False})
        self.assertEqual(resp.status_code, 400, resp.data)
        self.assertIn('error', resp.get_json())

    def test_drop_table_in_name_returns_400(self):
        with self._with_prune_enabled():
            resp = _post_prune(self.client, {'tables': ["enquiries; DROP TABLE invoice--"], 'confirm_prune': False})
        self.assertEqual(resp.status_code, 400, resp.data)

    def test_join_injection_returns_400(self):
        with self._with_prune_enabled():
            resp = _post_prune(self.client, {'tables': ["enquiries` JOIN `invoice"], 'confirm_prune': False})
        self.assertEqual(resp.status_code, 400, resp.data)

    def test_non_allowlisted_table_returns_400(self):
        with self._with_prune_enabled():
            resp = _post_prune(self.client, {'tables': ['employees'], 'confirm_prune': False})
        self.assertEqual(resp.status_code, 400, resp.data)

    def test_expenditure_table_returns_400(self):
        """Explicit check: enabled + tables=['expenditure'] -> 400."""
        with self._with_prune_enabled():
            resp = _post_prune(self.client, {'tables': ['expenditure'], 'confirm_prune': False})
        self.assertEqual(resp.status_code, 400, resp.data)
        self.assertIn('Unknown/disallowed table name', resp.get_json().get('error', ''))

    def test_mixed_valid_invalid_returns_400(self):
        with self._with_prune_enabled():
            resp = _post_prune(self.client, {
                'tables': ['enquiries', 'franchise_payments; DROP TABLE x--'],
                'confirm_prune': False
            })
        self.assertEqual(resp.status_code, 400, resp.data)


class TestPruneGate(unittest.TestCase):
    """ENABLE_PRUNE_API env-var gate tests."""

    def setUp(self):
        flask_app.config['TESTING'] = True
        self.client = flask_app.test_client()

    def test_prune_disabled_by_default_returns_403(self):
        """With ENABLE_PRUNE_API unset, prune must return 403."""
        env = {k: v for k, v in os.environ.items() if k != 'ENABLE_PRUNE_API'}
        with patch.dict(os.environ, env, clear=True):
            resp = _post_prune(self.client, {'confirm_prune': False})
        self.assertEqual(resp.status_code, 403, resp.data)
        data = resp.get_json()
        self.assertEqual(data.get('error'), 'Prune via API is disabled')

    def test_prune_enabled_false_string_returns_403(self):
        """ENABLE_PRUNE_API='false' must still block."""
        with patch.dict(os.environ, {'ENABLE_PRUNE_API': 'false'}):
            resp = _post_prune(self.client, {'confirm_prune': False})
        self.assertEqual(resp.status_code, 403, resp.data)

    def test_ghost_report_never_requires_prune_flag(self):
        """GET /api/sync/ghost-report is a dry-run — no ENABLE_PRUNE_API needed."""
        # May be 200 or 500 (upstream CRM unreachable in test), never 403.
        resp = _get_ghost(self.client)
        self.assertNotEqual(resp.status_code, 403, resp.data)


class TestPruneDryRun(unittest.TestCase):
    """Dry-run (confirm_prune=False) must never delete rows from the live DB."""

    def setUp(self):
        flask_app.config['TESTING'] = True
        self.client = flask_app.test_client()

    def test_dry_run_returns_200_or_500_not_400(self):
        """
        With ENABLE_PRUNE_API enabled and valid tables, confirm_prune=False
        must NOT be blocked (200 if CRM reachable, 500 if not — never 400).
        """
        with patch.dict(os.environ, {'ENABLE_PRUNE_API': 'true'}):
            resp = _post_prune(self.client, {'tables': ['enquiries'], 'confirm_prune': False})
        self.assertIn(resp.status_code, [200, 500], resp.data)

    def test_dry_run_response_body_has_dry_run_true(self):
        """Response must contain dry_run=True for confirm_prune=False."""
        with patch.dict(os.environ, {'ENABLE_PRUNE_API': 'true'}):
            resp = _post_prune(self.client, {'tables': ['enquiries'], 'confirm_prune': False})
        if resp.status_code == 200:
            data = resp.get_json()
            self.assertTrue(data.get('dry_run'), "dry_run must be True for confirm_prune=False")

    def test_dry_run_pruned_is_zero(self):
        """pruned count must be 0 for every table in a dry-run."""
        with patch.dict(os.environ, {'ENABLE_PRUNE_API': 'true'}):
            resp = _post_prune(self.client, {'tables': ['enquiries'], 'confirm_prune': False})
        if resp.status_code == 200:
            data = resp.get_json()
            for tbl, tbl_data in data.get('tables', {}).items():
                self.assertEqual(
                    tbl_data.get('pruned', 0), 0,
                    f"pruned must be 0 for table '{tbl}' in a dry-run"
                )


# ─────────────────────────────────────────────────────────────────────────────
# Mocked tests (no live DB writes, no upstream CRM calls)
# ─────────────────────────────────────────────────────────────────────────────

def _make_cursor_mock(local_ids, api_ids_set):
    """
    Returns a MagicMock cursor whose fetchall() returns local_ids rows,
    and a matching api_res mock.
    """
    cur = MagicMock()
    # First call to execute is SELECT id FROM `tbl`; fetchall returns rows
    cur.fetchall.return_value = [{'id': i} for i in local_ids]
    return cur


def _mock_conn(cursor_mock):
    """Returns a context-manager-compatible connection mock wrapping cursor_mock."""
    conn = MagicMock()
    cm = MagicMock()
    cm.__enter__ = MagicMock(return_value=cursor_mock)
    cm.__exit__ = MagicMock(return_value=False)
    conn.cursor.return_value = cm
    return conn


class TestPruneThreshold(unittest.TestCase):
    """10 % threshold tests using mocked DB and upstream API — no live deletes."""

    def _run_report(self, local_ids, api_ids, force=False):
        """
        Calls get_ghost_row_report directly with mocked DB and API.
        local_ids: list of int IDs in local DB
        api_ids: set of str IDs returned by upstream
        Returns the report dict.
        """
        from sync_service import get_ghost_row_report

        cur = MagicMock()
        cur.fetchall.return_value = [{'id': i} for i in local_ids]
        conn = _mock_conn(cur)

        api_res = {'ok': True, 'data': [{'id': i} for i in api_ids]}

        with patch('sync_service.get_db_connection', return_value=conn), \
             patch('sync_service.fetch_saarthi_endpoint', return_value=api_res):
            report = get_ghost_row_report(
                prune=True, tables=['enquiries'], force=force
            )
        return report, cur

    def test_over_threshold_without_force_is_refused(self):
        """
        ghost_count > 10 % of local_count and force=False
        -> report['tables']['enquiries']['refused'] == True
        -> no DELETE executed
        """
        # 100 local rows, 85 in API -> 15 ghosts = 15 % > 10 %
        local = list(range(1, 101))
        api = set(str(i) for i in range(1, 86))
        report, cur = self._run_report(local, api, force=False)

        tbl = report['tables']['enquiries']
        self.assertTrue(tbl.get('refused'), "Expected refused=True when > 10 % ghosts without force")
        self.assertIn('refuse_reason', tbl)
        self.assertEqual(tbl.get('pruned', 0), 0, "pruned must be 0 when refused")

        # Assert no DELETE was issued
        delete_calls = [c for c in cur.execute.call_args_list
                        if 'DELETE' in str(c)]
        self.assertEqual(len(delete_calls), 0, "No DELETE should execute when refused")

    def test_over_threshold_with_force_proceeds(self):
        """
        ghost_count > 10 % but force=True -> DELETE is issued, pruned > 0.

        Scenario: 100 local rows (IDs 1-100).
        Upstream has IDs 1-85 (keeps those) + IDs 201-215 (15 new upstream records
        not yet in local). So:
          - ghost_ids = local IDs 86-100 = 15 rows (15 % > 10 %)
          - len(api_ids) = 85 + 15 = 100 >= 90 % of 100 local -> 0.9 check passes
        """
        local = list(range(1, 101))                          # 100 local rows
        kept_ids = set(str(i) for i in range(1, 86))         # 85 existing upstream
        new_ids  = set(str(i) for i in range(201, 216))      # 15 brand-new upstream IDs
        api_ids  = kept_ids | new_ids                        # 100 total upstream IDs
        # ghost_ids = local IDs not in api_ids = 86..100 = 15 rows
        report, cur = self._run_report(local, api_ids, force=True)

        tbl = report['tables']['enquiries']
        self.assertFalse(tbl.get('refused', False), "refused should be False with force=True")
        self.assertEqual(tbl.get('pruned'), 15,
                         f"Expected 15 pruned rows. Report: {tbl}")


    def test_under_threshold_proceeds_without_force(self):
        """
        ghost_count <= 10 % -> no refusal, DELETE issued, no force needed
        """
        local = list(range(1, 101))   # 100 local
        api = set(str(i) for i in range(1, 97))  # 96 upstream -> 4 ghosts = 4 %
        report, cur = self._run_report(local, api, force=False)

        tbl = report['tables']['enquiries']
        self.assertFalse(tbl.get('refused', False))
        self.assertEqual(tbl.get('pruned'), 4)


class TestPruneAuditLog(unittest.TestCase):
    """Verify audit_log INSERT is issued after a real prune (mocked, no live writes)."""

    def test_real_prune_writes_audit_log_row(self):
        """
        A successful prune must execute exactly one audit_log INSERT per table.
        Verified via the mocked cursor's execute call list.
        """
        from sync_service import get_ghost_row_report

        # 10 local rows, 9 in API -> 1 ghost = 10 % -> exactly at boundary, <=10% so proceeds
        local = list(range(1, 11))
        api_ids = set(str(i) for i in range(1, 10))  # ids 1-9; id 10 is ghost

        cur = MagicMock()
        cur.fetchall.return_value = [{'id': i} for i in local]
        conn = _mock_conn(cur)
        api_res = {'ok': True, 'data': [{'id': i} for i in api_ids]}

        with patch('sync_service.get_db_connection', return_value=conn), \
             patch('sync_service.fetch_saarthi_endpoint', return_value=api_res):
            report = get_ghost_row_report(
                prune=True, tables=['enquiries'], force=False
            )

        tbl = report['tables']['enquiries']
        self.assertEqual(tbl.get('pruned'), 1, f"Expected 1 pruned row, got: {tbl}")
        self.assertFalse(tbl.get('refused', False))

        # Find the audit_log INSERT in all execute calls
        all_calls = [str(c) for c in cur.execute.call_args_list]
        audit_inserts = [c for c in all_calls if 'audit_log' in c and 'INSERT' in c]
        self.assertEqual(
            len(audit_inserts), 1,
            f"Expected exactly 1 audit_log INSERT, found {len(audit_inserts)}.\n"
            f"All execute calls:\n" + "\n".join(all_calls)
        )

    def test_dry_run_does_not_write_audit_log(self):
        """A dry-run (prune=False) must NOT write to audit_log."""
        from sync_service import get_ghost_row_report

        local = list(range(1, 11))
        api_ids = set(str(i) for i in range(1, 10))

        cur = MagicMock()
        cur.fetchall.return_value = [{'id': i} for i in local]
        conn = _mock_conn(cur)
        api_res = {'ok': True, 'data': [{'id': i} for i in api_ids]}

        with patch('sync_service.get_db_connection', return_value=conn), \
             patch('sync_service.fetch_saarthi_endpoint', return_value=api_res):
            get_ghost_row_report(prune=False, tables=['enquiries'])

        all_calls = [str(c) for c in cur.execute.call_args_list]
        audit_inserts = [c for c in all_calls if 'audit_log' in c]
        self.assertEqual(len(audit_inserts), 0,
                         "Dry-run must not touch audit_log")


if __name__ == '__main__':
    unittest.main()
