import os
import pytest

# Ensure FLASK_TESTING is set before app or db is imported
os.environ['FLASK_TESTING'] = 'true'


def pytest_runtest_setup(item):
    if item.get_closest_marker('writes_db') is not None:
        from db import DB_NAME
        effective_db = (DB_NAME or '').strip().lower()
        if not (effective_db.endswith('_test') or effective_db.endswith('_staging')):
            pytest.skip("Skipped: this test writes data and the configured database is not a test/staging database.")
