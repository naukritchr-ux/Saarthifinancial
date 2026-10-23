"""
backend/scripts/check_sync_health.py
Diagnostic script:
1. Inspect recent crm_sync_logs (status, row counts, messages, timestamps)
2. Test reachability and record count for upstream Saarthi endpoints
3. Check table row counts and freshness in DB
"""

import sys
import os
import argparse
import datetime

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from scripts.db_guard import get_db_connection, add_db_safety_args
from sync_service import fetch_saarthi_endpoint, EXPENSE_ENDPOINT

def run_sync_health_check(args):
    conn, host, db = get_db_connection(args)
    print("=" * 70)
    print(f"SYNC HEALTH CHECK | Host: {host} | DB: {db}")
    print("=" * 70)

    # 1. Database table counts
    print("\n--- 1. LOCAL DATABASE TABLE COUNTS & MAX TIMESTAMPS ---")
    cur = conn.cursor()
    tables = [
        ('enquiries', 'created_at', 'dateOfAllocation'),
        ('invoice', 'created_at', 'billDate'),
        ('franchisees', 'created_at', 'onboardingDate'),
        ('expenditure', 'created_at', 'billDate'),
        ('clients_info', 'created_at', None),
        ('legals_info', 'created_at', None),
        ('payroll_records', 'created_at', 'date')
    ]
    for tbl, dt_col1, dt_col2 in tables:
        try:
            extra_cols = f", MAX({dt_col1}) as max_dt1"
            if dt_col2:
                extra_cols += f", MAX({dt_col2}) as max_dt2"
            cur.execute(f"SELECT COUNT(*) as n {extra_cols} FROM {tbl}")
            res = cur.fetchone()
            dts = f" | max {dt_col1}: {res['max_dt1']}"
            if dt_col2:
                dts += f" | max {dt_col2}: {res['max_dt2']}"
            print(f"  {tbl:<18}: {res['n']:>6} rows{dts}")
        except Exception as e:
            print(f"  {tbl:<18}: ERROR ({e})")

    # 2. Recent CRM Sync Logs
    print("\n--- 2. RECENT CRM SYNC LOGS (Last 5) ---")
    try:
        cur.execute("""
            SELECT id, sync_type, status, enquiries_count, invoices_count,
                   franchisees_count, expenses_count, clients_count, legals_count,
                   message, started_at, completed_at,
                   TIMESTAMPDIFF(SECOND, started_at, COALESCE(completed_at, NOW())) AS duration_seconds
            FROM crm_sync_logs
            ORDER BY id DESC
            LIMIT 5
        """)
        logs = cur.fetchall()
        if not logs:
            print("  No sync logs found in crm_sync_logs.")
        for l in logs:
            print(f"  Log ID: {l['id']} | Type: {l['sync_type']} | Status: {l['status']} | Duration: {l['duration_seconds']}s")
            print(f"    Started: {l['started_at']} | Completed: {l['completed_at']}")
            print(f"    Counts -> enq: {l['enquiries_count']}, inv: {l['invoices_count']}, fran: {l['franchisees_count']}, exp: {l['expenses_count']}")
            if l['message']:
                print(f"    Message: {l['message'][:120]}")
    except Exception as e:
        print(f"  Error reading crm_sync_logs: {e}")

    # 3. Upstream Saarthi Endpoints Reachability Test
    print("\n--- 3. UPSTREAM SAARTHI API REACHABILITY TEST (GET with 10s timeout) ---")
    endpoints = [
        ("franchisees", "franchisees"),
        ("enquiries", "enquiries"),
        ("invoices", "Invoice"),
        ("expenses", EXPENSE_ENDPOINT),
        ("clients", "clients_info"),
        ("legals", "legals_info")
    ]
    for name, path in endpoints:
        res = fetch_saarthi_endpoint(path, timeout=10)
        ok = res.get('ok', False)
        status_code = res.get('status_code', 'N/A')
        count = len(res.get('data') or [])
        err = res.get('error') or ''
        status_str = "OK" if ok else "FAILED"
        print(f"  {name:<15} [{path:<20}]: {status_str:<6} (HTTP {status_code}) | Upstream rows: {count:>5} {err}")

    conn.close()

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    add_db_safety_args(parser)
    args = parser.parse_args()
    run_sync_health_check(args)
