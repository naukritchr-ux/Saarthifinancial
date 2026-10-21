import os
import re
import json
import datetime
import threading
import urllib.request
import urllib.error
from db import get_db_connection, ensure_tables_exist

HTTP_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9'
}

# Sync mutex lock to prevent concurrent runs between background daemon and manual trigger
sync_lock = threading.Lock()

def normalize_date(date_val):
    if not date_val or str(date_val).strip().lower() in ('', 'null', 'none', 'n/a', '-', 'undefined'):
        return None
    s = str(date_val).split('T')[0].strip()
    if len(s) >= 10 and s[4] == '-' and s[7] == '-':
        return s
    # Attempt alternate formats
    for fmt in ('%d-%m-%Y', '%d/%m/%Y', '%Y/%m/%d', '%d-%b-%Y', '%d-%b-%y', '%m/%d/%Y'):
        try:
            dt = datetime.datetime.strptime(s, fmt)
            return dt.strftime('%Y-%m-%d')
        except ValueError:
            continue
    return s

def calculate_fy(date_str):
    if not date_str:
        return 'N/A'
    try:
        norm = normalize_date(date_str)
        if not norm:
            return 'N/A'
        dt = datetime.datetime.strptime(norm[:10], '%Y-%m-%d')
        year = dt.year
        if dt.month >= 4:
            return f"{year}-{year + 1}"
        else:
            return f"{year - 1}-{year}"
    except Exception:
        return 'N/A'

def parse_float(val, default=0.0):
    if val is None or val == '':
        return default
    try:
        clean = str(val).replace('₹', '').replace(',', '').replace(' ', '').strip()
        return float(clean)
    except (ValueError, TypeError):
        return default

def fetch_saarthi_endpoint(endpoint_path, timeout=12):
    """
    Tries verified Saarthi CRM endpoints with error capturing and pagination support.
    """
    clean_path = endpoint_path.lstrip('/')
    base_url_env = os.environ.get('SAARTHI_API_BASE_URL', '').rstrip('/')
    candidates = [
        f"{base_url_env}/api/{clean_path}" if base_url_env else None,
        f"{base_url_env}/{clean_path}" if base_url_env else None,
        f"https://api.sarthi360.in/api/{clean_path}",
        f"https://sarthi360.in/api/{clean_path}",
        f"https://api.sarthi360.in/{clean_path}",
        f"https://sarthi360.in/{clean_path}"
    ]
    candidates = [c for c in candidates if c]

    attempt_errors = []
    for url in candidates:
        try:
            req = urllib.request.Request(url, headers=HTTP_HEADERS)
            with urllib.request.urlopen(req, timeout=timeout) as response:
                if response.status == 200:
                    raw_data = response.read().decode('utf-8')
                    parsed = json.loads(raw_data)
                    if isinstance(parsed, list):
                        return {"ok": True, "data": parsed, "url": url}
                    elif isinstance(parsed, dict):
                        data_arr = parsed.get("data") or parsed.get("enquiries") or parsed.get("invoices") or parsed.get("expenses") or parsed.get("franchisees") or []
                        if isinstance(data_arr, list):
                            # Check for pagination metadata
                            total_pages = parsed.get("totalPages") or parsed.get("last_page") or (parsed.get("pagination") or {}).get("totalPages")
                            if total_pages and int(total_pages) > 1:
                                page_limit = min(int(total_pages), 50)
                                for p in range(2, page_limit + 1):
                                    p_url = f"{url}?page={p}"
                                    try:
                                        p_req = urllib.request.Request(p_url, headers=HTTP_HEADERS)
                                        with urllib.request.urlopen(p_req, timeout=timeout) as p_res:
                                            if p_res.status == 200:
                                                p_data = json.loads(p_res.read().decode('utf-8'))
                                                p_items = p_data if isinstance(p_data, list) else (p_data.get("data") or [])
                                                data_arr.extend(p_items)
                                    except Exception as p_err:
                                        print(f"[SYNC PAGINATION WARN] Page {p} on {url}: {p_err}")
                                        break
                            return {"ok": True, "data": data_arr, "url": url}
                        return {"ok": True, "data": [parsed], "url": url}
        except urllib.error.HTTPError as he:
            attempt_errors.append(f"{url} -> HTTP {he.code}: {he.reason}")
        except urllib.error.URLError as ue:
            attempt_errors.append(f"{url} -> URL Error: {ue.reason}")
        except Exception as err:
            attempt_errors.append(f"{url} -> Error: {str(err)}")
            continue

    err_summary = "; ".join(attempt_errors) if attempt_errors else f"Failed to fetch {endpoint_path}"
    return {"ok": False, "data": [], "error": f"Failed to fetch {endpoint_path}: {err_summary}"}

# --------------------------------------------------------------------------
# Expense sync + reconciliation helpers
# --------------------------------------------------------------------------
# The CRM's /api/expenses is only the expense-head master (id, head_component,
# tds, franchisee, recruitment: no date, no amount). The real transactions are
# served by the expenditure router, which is mounted at /api/expenditures and
# defines its own "/expenditures/all" path, hence the doubled segment.
EXPENSE_ENDPOINT = (os.environ.get("SAARTHI_EXPENSE_ENDPOINT") or "expenditures/expenditures/all").strip().lstrip("/")

# Cross-process lock name (the in-process threading lock does not cover several
# gunicorn workers, each of which starts its own sync daemon).
DB_SYNC_LOCK_NAME = "fintective_crm_sync"

# Rows that exist locally but are no longer returned by the CRM ("ghost" rows)
# are only REPORTED for enquiries/invoices by default, because Fintective can
# also create invoices itself. Set SYNC_PRUNE_MISSING=true to delete them.
PRUNE_MISSING = os.environ.get("SYNC_PRUNE_MISSING", "false").strip().lower() in ("1", "true", "yes")

# Old expenditure rows (loaded from a dump before crm_id existed) that cannot be
# matched to any CRM row are soft-deleted (is_deleted=1, reversible) so they stop
# inflating burn/cash numbers. Manual Log-Transaction rows (srNo='TX') are never touched.
RETIRE_UNMATCHED_LEGACY_EXPENSES = os.environ.get("SYNC_RETIRE_LEGACY_EXPENSES", "true").strip().lower() in ("1", "true", "yes")


def _chunked(items, size=500):
    for i in range(0, len(items), size):
        yield items[i:i + size]


def build_expense_rows(raw_rows):
    """
    Converts the CRM expenditure payload into tuples for the local table:
        (crm_id, srNo, billDate, particulars, expenses, amount, net, expenseType)
    Returns (rows, skipped).
    Raises ValueError when the payload is not an expenditure list (for example the
    head-component master), so a wrong endpoint is reported instead of silently
    syncing 0 rows.
    """
    if not isinstance(raw_rows, list):
        raise ValueError("expense payload is not a list")

    sample = [r for r in raw_rows[:50] if isinstance(r, dict)]
    if raw_rows and not any(("billDate" in r or "amount" in r) for r in sample):
        fields = sorted(sample[0].keys()) if sample else []
        raise ValueError(
            f"endpoint '{EXPENSE_ENDPOINT}' returned records without billDate/amount (fields: {fields})"
        )

    rows = []
    skipped = 0
    for exp in raw_rows:
        if not isinstance(exp, dict):
            skipped += 1
            continue
        try:
            crm_id = int(exp.get("id"))
        except (TypeError, ValueError):
            skipped += 1  # e.g. "vendor-12" placeholder rows
            continue

        amt = parse_float(exp.get("amount"))
        part = str(exp.get("particulars") or exp.get("title") or exp.get("description") or "").strip()
        if not (amt > 0 or part):
            skipped += 1
            continue

        sr = str(exp.get("srNo") or exp.get("id") or "").strip() or None
        b_date = normalize_date(exp.get("billDate") or exp.get("date"))
        exp_name = str(exp.get("expenses") or exp.get("category") or "Other").strip()
        net = parse_float(exp.get("net") or exp.get("amount"))
        exp_type = str(exp.get("expenseType") or exp.get("type") or "expense").strip()
        rows.append((crm_id, sr, b_date, part, exp_name, amt, net, exp_type))

    return rows, skipped


def adopt_legacy_expense_rows(cur, rows):
    """
    One-time link of expenditure rows loaded before crm_id existed to their CRM
    counterpart, matching on (srNo, billDate, amount). Without this the first sync
    would insert every CRM row again next to the old copy. Returns rows linked.
    """
    cur.execute("SELECT id, srNo, billDate, amount FROM expenditure WHERE crm_id IS NULL AND COALESCE(srNo, '') <> 'TX'")
    legacy = cur.fetchall() or []
    if not legacy:
        return 0

    buckets = {}
    for r in legacy:
        key = (
            str(r.get("srNo") or "").strip(),
            normalize_date(r.get("billDate")) or "",
            round(float(r.get("amount") or 0), 2),
        )
        buckets.setdefault(key, []).append(r["id"])

    links = []
    for (crm_id, sr, b_date, _part, _name, amt, _net, _type) in rows:
        ids = buckets.get((sr or "", b_date or "", round(amt, 2)))
        if ids:
            links.append((crm_id, ids.pop(0)))

    for batch in _chunked(links):
        cur.executemany("UPDATE expenditure SET crm_id = %s WHERE id = %s AND crm_id IS NULL", batch)
    return len(links)


def retire_missing_expenses(cur, api_ids):
    """
    The CRM hard-deletes expenditure rows, so a row that disappears from the API
    must stop counting locally. Soft-deletes (is_deleted=1) CRM-linked rows missing
    from this payload, plus unmatched legacy rows. Skipped when the payload looks
    partial. Returns (missing_from_crm, legacy_retired).
    """
    cur.execute("SELECT crm_id FROM expenditure WHERE crm_id IS NOT NULL AND is_deleted = 0")
    local_ids = [r["crm_id"] for r in (cur.fetchall() or [])]
    missing = [i for i in local_ids if i not in api_ids]

    # Safety net against a truncated/partial response wiping good data.
    if local_ids and len(api_ids) < 0.5 * len(local_ids):
        print(f"[SYNC WARN] Expense payload ({len(api_ids)}) is much smaller than local ({len(local_ids)}); skipping retire step.")
        return 0, 0

    for batch in _chunked(missing):
        placeholders = ", ".join(["%s"] * len(batch))
        cur.execute(f"UPDATE expenditure SET is_deleted = 1 WHERE crm_id IN ({placeholders})", batch)

    legacy_retired = 0
    if RETIRE_UNMATCHED_LEGACY_EXPENSES and api_ids:
        cur.execute("UPDATE expenditure SET is_deleted = 1 WHERE crm_id IS NULL AND is_deleted = 0 AND COALESCE(srNo, '') <> 'TX'")
        legacy_retired = cur.rowcount or 0
    return len(missing), legacy_retired


def reconcile_missing_ids(cur, table, api_ids, prune=False):
    """
    Counts local rows whose id is no longer returned by the CRM (deleted there, but
    the sync only upserts so they would otherwise live on and inflate revenue).
    Reports by default; deletes only when prune=True and the payload looks complete.
    Returns the number of ghost rows found.
    """
    cur.execute(f"SELECT id FROM `{table}`")
    local_ids = [r["id"] for r in (cur.fetchall() or [])]
    api_keys = {str(i) for i in api_ids}
    ghosts = [i for i in local_ids if str(i) not in api_keys]

    if ghosts and prune:
        if len(api_keys) >= 0.9 * len(local_ids):
            for batch in _chunked(ghosts):
                placeholders = ", ".join(["%s"] * len(batch))
                cur.execute(f"DELETE FROM `{table}` WHERE id IN ({placeholders})", batch)
            print(f"[SYNC] Pruned {len(ghosts)} ghost rows from `{table}`.")
        else:
            print(f"[SYNC WARN] Not pruning `{table}`: API returned {len(api_keys)} rows vs {len(local_ids)} local.")
    return len(ghosts)


def get_ghost_row_report(prune=False, tables=None):
    """
    Admin audit report listing ghost rows (rows present in local DB that no longer exist in upstream CRM).
    prune=False by default (dry-run).
    If prune=True, only prunes specified tables if safety thresholds pass.
    """
    tables_to_check = tables or ["enquiries", "invoice"]
    report = {
        "timestamp": datetime.datetime.now().isoformat(),
        "dry_run": not prune,
        "tables": {}
    }
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            for tbl in tables_to_check:
                endpoint = "enquiries" if tbl == "enquiries" else "Invoice"
                api_res = fetch_saarthi_endpoint(endpoint)
                if api_res["ok"] and api_res["data"]:
                    api_ids = {str(item.get("id")) for item in api_res["data"] if item.get("id")}
                    cur.execute(f"SELECT id FROM `{tbl}`")
                    local_ids = [str(r["id"]) for r in (cur.fetchall() or [])]
                    ghost_ids = [i for i in local_ids if i not in api_ids]
                    
                    pruned_count = 0
                    if prune and ghost_ids:
                        if len(api_ids) >= 0.9 * len(local_ids):
                            for batch in _chunked(ghost_ids, 500):
                                placeholders = ", ".join(["%s"] * len(batch))
                                cur.execute(f"DELETE FROM `{tbl}` WHERE id IN ({placeholders})", batch)
                            pruned_count = len(ghost_ids)
                    
                    report["tables"][tbl] = {
                        "local_count": len(local_ids),
                        "upstream_crm_count": len(api_ids),
                        "ghost_count": len(ghost_ids),
                        "ghost_ids_sample": ghost_ids[:20],
                        "pruned": pruned_count
                    }
                else:
                    report["tables"][tbl] = {
                        "error": api_res.get("error", "Failed to fetch upstream API")
                    }
        return report
    finally:
        conn.close()


def sync_saarthi_all():
    """
    Main sync engine: Fetches all Saarthi APIs and upserts into MySQL.
    Protected by sync_lock (in-process) and a MySQL GET_LOCK (across workers)
    to avoid concurrent execution.
    """
    if not sync_lock.acquire(blocking=False):
        return {
            "ok": False,
            "status": "locked",
            "error": "A Saarthi sync process is already running. Please wait for it to complete."
        }

    conn = None
    try:
        ensure_tables_exist()
        start_time = datetime.datetime.now()
        log_id = None
        db_lock_held = False
        lock_busy = False

        try:
            conn = get_db_connection()

            # Cross-process lock: another gunicorn worker may already be syncing.
            try:
                with conn.cursor() as cur:
                    cur.execute("SELECT GET_LOCK(%s, 0) AS got", (DB_SYNC_LOCK_NAME,))
                    got = (cur.fetchone() or {}).get("got")
                if got == 0:
                    # Check if the existing in_progress run is stale (> 3 minutes)
                    with conn.cursor() as cur:
                        cur.execute("""
                            SELECT id, TIMESTAMPDIFF(MINUTE, started_at, NOW()) AS age_minutes 
                            FROM crm_sync_logs 
                            WHERE status = 'in_progress' 
                            ORDER BY id DESC LIMIT 1
                        """)
                        stale_row = cur.fetchone()
                        if stale_row and stale_row.get("age_minutes", 0) > 3:
                            print(f"[SYNC] Detected stale in_progress sync log ID {stale_row['id']} ({stale_row['age_minutes']}m old). Auto-recovering lock...")
                            cur.execute("SELECT RELEASE_LOCK(%s)", (DB_SYNC_LOCK_NAME,))
                            cur.execute("UPDATE crm_sync_logs SET status = 'failed', completed_at = NOW(), message = 'Auto-recovered from stale lock' WHERE status = 'in_progress'")
                            conn.commit()
                            cur.execute("SELECT GET_LOCK(%s, 0) AS got", (DB_SYNC_LOCK_NAME,))
                            got = (cur.fetchone() or {}).get("got")
                            db_lock_held = (got == 1)
                            lock_busy = (got == 0)
                        else:
                            lock_busy = True
                else:
                    db_lock_held = (got == 1)
            except Exception as lock_err:
                print("DB sync-lock notice (continuing without it):", str(lock_err))

            if not lock_busy:
                with conn.cursor() as cur:
                    # Clean up any lingering in_progress logs from previously terminated workers
                    cur.execute("""
                        UPDATE crm_sync_logs 
                        SET status = 'failed', completed_at = NOW(), message = 'Interrupted by server restart' 
                        WHERE status = 'in_progress'
                    """)
                    cur.execute("""
                        INSERT INTO crm_sync_logs (sync_type, status, started_at)
                        VALUES ('all', 'in_progress', NOW())
                    """)
                    log_id = cur.lastrowid
        except Exception as e:
            print("Log entry notice:", str(e))

        if lock_busy:
            try:
                conn.close()
            except Exception:
                pass
            return {
                "ok": False,
                "status": "locked",
                "error": "A Saarthi sync process is already running. Please wait for it to complete."
            }

        stats = {
            "ok": True,
            "enquiries": 0,
            "invoices": 0,
            "franchisees": 0,
            "expenses": 0,
            "clients": 0,
            "legals": 0,
            "errors": [],
            "notes": [],
            "ghost_rows": {}
        }

        try:
            # Helper for batching
            def chunked(iterable, size=500):
                for i in range(0, len(iterable), size):
                    yield iterable[i:i + size]

            # Parallel fetch of all upstream Saarthi CRM endpoints
            import concurrent.futures
            print("[SYNC] Fetching all 6 Saarthi CRM endpoints in parallel...")
            endpoints_to_fetch = {
                "franchisees": "franchisees",
                "enquiries": "enquiries",
                "invoices": "Invoice",
                "expenses": EXPENSE_ENDPOINT,
                "clients": "clients_info",
                "legals": "legals_info"
            }
            fetched_results = {}
            with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
                future_map = {
                    executor.submit(fetch_saarthi_endpoint, path): key
                    for key, path in endpoints_to_fetch.items()
                }
                for fut in concurrent.futures.as_completed(future_map):
                    key = future_map[fut]
                    try:
                        fetched_results[key] = fut.result()
                    except Exception as f_err:
                        fetched_results[key] = {"ok": False, "data": [], "error": str(f_err)}

            # Fallback for invoices if "Invoice" returned no data
            if not fetched_results.get("invoices", {}).get("ok") or not fetched_results.get("invoices", {}).get("data"):
                fetched_results["invoices"] = fetch_saarthi_endpoint("invoice")

            # 1. Sync Franchisees
            print("[SYNC] Writing Franchisees to DB...")
            f_res = fetched_results.get("franchisees", {"ok": False, "data": []})
            if f_res["ok"] and f_res["data"]:
                fran_rows = []
                form_rows = []
                for f in f_res["data"]:
                    name = str(f.get("nameAsPerAgreement") or f.get("franchiseName") or f.get("name") or "").strip()
                    tl = str(f.get("teamLeaderName") or f.get("teamLeader") or "").strip()
                    onboard = normalize_date(f.get("onboardingDate") or f.get("dateOfAgreement") or f.get("createdAt"))
                    st = str(f.get("status") or "active").strip().lower()
                    if name:
                        fran_rows.append((name, tl, onboard, st))
                        form_rows.append((name, tl))

                with conn.cursor() as cur:
                    for batch in chunked(fran_rows, 500):
                        cur.executemany("""
                            INSERT INTO franchisees (nameAsPerAgreement, teamLeaderName, onboardingDate, status)
                            VALUES (%s, %s, %s, %s)
                            ON DUPLICATE KEY UPDATE
                                teamLeaderName = VALUES(teamLeaderName),
                                onboardingDate = COALESCE(VALUES(onboardingDate), onboardingDate),
                                status = VALUES(status)
                        """, batch)
                    for batch in chunked(form_rows, 500):
                        cur.executemany("""
                            INSERT INTO franchisees_forms (nameAsPerAgreement, teamLeaderName)
                            VALUES (%s, %s)
                            ON DUPLICATE KEY UPDATE teamLeaderName = VALUES(teamLeaderName)
                        """, batch)
                stats["franchisees"] = len(fran_rows)
                print(f"[SYNC OK] Synced {stats['franchisees']} Franchisees.")
            else:
                stats["errors"].append(f"Franchisees: {f_res.get('error', 'No data')}")

            # 2. Sync Enquiries
            print("[SYNC] Writing Enquiries to DB...")
            enq_res = fetched_results.get("enquiries", {"ok": False, "data": []})
            if enq_res["ok"] and enq_res["data"]:
                enq_rows = []
                for enq in enq_res["data"]:
                    enq_id = enq.get("id")
                    if not enq_id:
                        continue
                    company = str(enq.get("companyName") or "").strip()
                    bd = str(enq.get("bdMemberName") or enq.get("bdName") or "").strip()
                    tl = str(enq.get("teamLeaderName") or enq.get("tlName") or "").strip()
                    fran = str(enq.get("franchiseeName") or enq.get("franchiseName") or "").strip()
                    pos = str(enq.get("positionName") or "").strip()
                    ind = str(enq.get("industry") or "").strip()
                    st = str(enq.get("enquiryStatus") or "inprogress").strip().lower()
                    fees = parse_float(enq.get("placementFees"))
                    f_val = parse_float(enq.get("from"))
                    t_val = parse_float(enq.get("to"))
                    b_amt = parse_float(enq.get("bill_amount"))
                    b_no = str(enq.get("bill_no") or "").strip() or None
                    b_date = normalize_date(enq.get("bill_date"))
                    alloc_d = normalize_date(enq.get("dateOfAllocation"))
                    acq_d = normalize_date(enq.get("dateClientAcquired"))
                    realloc_d = normalize_date(enq.get("dateOfReallocation"))
                    info = str(enq.get("info") or "").strip() or None
                    c_at = normalize_date(enq.get("created_at"))

                    enq_rows.append((
                        enq_id, company, bd, tl, fran, fees, pos, ind, f_val, t_val, st,
                        alloc_d, acq_d, realloc_d, b_no, b_date, b_amt, info, c_at
                    ))

                with conn.cursor() as cur:
                    for batch in chunked(enq_rows, 500):
                        cur.executemany("""
                            INSERT INTO enquiries (
                                id, companyName, bdMemberName, teamLeaderName, franchiseeName,
                                placementFees, positionName, industry, `from`, `to`, enquiryStatus,
                                dateOfAllocation, dateClientAcquired, dateOfReallocation,
                                bill_no, bill_date, bill_amount, info, created_at
                            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                            ON DUPLICATE KEY UPDATE
                                companyName = VALUES(companyName),
                                bdMemberName = VALUES(bdMemberName),
                                teamLeaderName = VALUES(teamLeaderName),
                                franchiseeName = VALUES(franchiseeName),
                                placementFees = VALUES(placementFees),
                                positionName = VALUES(positionName),
                                industry = VALUES(industry),
                                `from` = VALUES(`from`),
                                `to` = VALUES(`to`),
                                enquiryStatus = VALUES(enquiryStatus),
                                dateOfAllocation = VALUES(dateOfAllocation),
                                dateClientAcquired = VALUES(dateClientAcquired),
                                dateOfReallocation = VALUES(dateOfReallocation),
                                bill_no = VALUES(bill_no),
                                bill_date = VALUES(bill_date),
                                bill_amount = VALUES(bill_amount),
                                info = VALUES(info)
                        """, batch)
                stats["enquiries"] = len(enq_rows)
                print(f"[SYNC OK] Synced {stats['enquiries']} Enquiries.")

                # Rows deleted in the CRM are never removed by an upsert: count them.
                try:
                    with conn.cursor() as cur:
                        ghosts = reconcile_missing_ids(cur, "enquiries", {r[0] for r in enq_rows}, PRUNE_MISSING)
                    stats["ghost_rows"]["enquiries"] = ghosts
                    if ghosts:
                        stats["notes"].append(f"{ghosts} enquiries not in CRM" + (" (pruned)" if PRUNE_MISSING else " (kept)"))
                except Exception as rec_err:
                    print("[SYNC WARN] Enquiry reconcile failed:", str(rec_err))
            else:
                stats["errors"].append(f"Enquiries: {enq_res.get('error', 'No data')}")

            # 3. Sync Invoices
            print("[SYNC] Writing Invoices to DB...")
            inv_res = fetched_results.get("invoices", {"ok": False, "data": []})
                
            if inv_res["ok"] and inv_res["data"]:
                inv_rows = []
                for inv in inv_res["data"]:
                    inv_id = inv.get("id")
                    if not inv_id:
                        continue
                    enq_id = inv.get("enquiry_id") or None
                    b_num = str(inv.get("billNumber") or inv.get("bill_no") or "").strip() or None
                    b_date = normalize_date(inv.get("billDate") or inv.get("bill_date"))
                    # Fix A2: serviceCharges only mapped from serviceCharges (never fallback to rate serviceCharge)
                    raw_sc = inv.get("serviceCharges")
                    svc_chg = parse_float(raw_sc, default=0.0) if (raw_sc is not None and str(raw_sc).strip() != '') else 0.0
                    svc_rate = parse_float(inv.get("serviceCharge"), default=0.0)
                    gst = parse_float(inv.get("totalGST") or inv.get("gst"), default=0.0)
                    tot_bill = parse_float(inv.get("totalBillAmt") or inv.get("bill_amount"), default=0.0)

                    # Fix A1: Keep None when missing/blank in CRM. Never 'x or fallback' on shares.
                    raw_f_share = inv.get("franchiseeShare")
                    if raw_f_share is None or str(raw_f_share).strip() == '':
                        raw_f_share = inv.get("franchiseShare")
                    f_share = parse_float(raw_f_share, default=None) if (raw_f_share is not None and str(raw_f_share).strip() != '') else None

                    f_gst = parse_float(inv.get("franchiseeGST"), default=0.0)

                    raw_our_share = inv.get("ourShare")
                    our_sh = parse_float(raw_our_share, default=None) if (raw_our_share is not None and str(raw_our_share).strip() != '') else None
                    amt_rec = parse_float(inv.get("amountReceived"))
                    amt_due = parse_float(inv.get("amountDue"))
                    tds_val = parse_float(inv.get("tds") or inv.get("tdsAmount"))
                    tds_ff = parse_float(inv.get("tdsFF"))
                    d_rec = normalize_date(inv.get("dateReceived"))
                    d_paid = normalize_date(inv.get("paidOnDate"))
                    pay_mode = str(inv.get("payment_mode") or "").strip() or None
                    uid_tx = str(inv.get("uid_transaction_id") or "").strip() or None
                    bd_name = str(inv.get("nameOfBd") or inv.get("bdMemberName") or "").strip() or None
                    tl_name = str(inv.get("teamLeader") or inv.get("teamLeaderName") or "").strip() or None
                    fran_name = str(inv.get("franchiseName") or inv.get("franchiseeName") or "").strip() or None
                    fy_val = str(inv.get("financialYear") or calculate_fy(b_date)).strip()
                    cand_name = str(inv.get("candidateName") or "").strip() or None
                    comp_name = str(inv.get("companyName") or "").strip() or None
                    post_name = str(inv.get("postOfCandidate") or inv.get("positionName") or "").strip() or None
                    sal_offered = parse_float(inv.get("annualSalaryOffered") or inv.get("salary"))
                    info_st = str(inv.get("info") or "").strip() or None
                    status_st = str(inv.get("status") or "active").strip()

                    inv_rows.append((
                        inv_id, enq_id, b_num, b_date, svc_chg, svc_rate, gst, tot_bill,
                        f_share, f_gst, our_sh, amt_rec, amt_due, tds_val, tds_ff, d_rec, d_paid,
                        pay_mode, uid_tx, bd_name, tl_name, fran_name, fy_val, cand_name, comp_name,
                        post_name, sal_offered, info_st, status_st
                    ))

                with conn.cursor() as cur:
                    for batch in chunked(inv_rows, 500):
                        cur.executemany("""
                            INSERT INTO invoice (
                                id, enquiry_id, billNumber, billDate, serviceCharges, serviceCharge,
                                totalGST, totalBillAmt, franchiseeShare, franchiseeGST, ourShare,
                                amountReceived, amountDue, tds, tdsFF, dateReceived, paidOnDate,
                                payment_mode, uid_transaction_id, nameOfBd, teamLeader, franchiseName,
                                financialYear, candidateName, companyName, postOfCandidate,
                                annualSalaryOffered, info, status
                            ) VALUES (
                                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                            )
                            ON DUPLICATE KEY UPDATE
                                enquiry_id = VALUES(enquiry_id),
                                billNumber = VALUES(billNumber),
                                billDate = VALUES(billDate),
                                serviceCharges = VALUES(serviceCharges),
                                serviceCharge = VALUES(serviceCharge),
                                totalGST = VALUES(totalGST),
                                totalBillAmt = VALUES(totalBillAmt),
                                franchiseeShare = VALUES(franchiseeShare),
                                franchiseeGST = VALUES(franchiseeGST),
                                ourShare = VALUES(ourShare),
                                amountReceived = VALUES(amountReceived),
                                amountDue = VALUES(amountDue),
                                tds = VALUES(tds),
                                tdsFF = VALUES(tdsFF),
                                dateReceived = VALUES(dateReceived),
                                paidOnDate = VALUES(paidOnDate),
                                payment_mode = VALUES(payment_mode),
                                uid_transaction_id = VALUES(uid_transaction_id),
                                nameOfBd = VALUES(nameOfBd),
                                teamLeader = VALUES(teamLeader),
                                franchiseName = VALUES(franchiseName),
                                financialYear = VALUES(financialYear),
                                candidateName = VALUES(candidateName),
                                companyName = VALUES(companyName),
                                postOfCandidate = VALUES(postOfCandidate),
                                annualSalaryOffered = VALUES(annualSalaryOffered),
                                info = VALUES(info),
                                status = VALUES(status)
                        """, batch)
                stats["invoices"] = len(inv_rows)
                print(f"[SYNC OK] Synced {stats['invoices']} Invoices.")

                try:
                    with conn.cursor() as cur:
                        ghosts = reconcile_missing_ids(cur, "invoice", {r[0] for r in inv_rows}, PRUNE_MISSING)
                    stats["ghost_rows"]["invoices"] = ghosts
                    if ghosts:
                        stats["notes"].append(f"{ghosts} invoices not in CRM" + (" (pruned)" if PRUNE_MISSING else " (kept)"))
                except Exception as rec_err:
                    print("[SYNC WARN] Invoice reconcile failed:", str(rec_err))
            else:
                stats["errors"].append(f"Invoices: {inv_res.get('error', 'No data')}")

            # 4. Sync Expenses (real transactions from the CRM expenditure router).
            # Every failure path below is reported in stats["errors"]; a wrong or empty
            # endpoint must never look like a successful sync with 0 rows.
            print(f"[SYNC] Writing Expenses to DB ({EXPENSE_ENDPOINT})...")
            exp_res = fetched_results.get("expenses", {"ok": False, "data": []})
            if not exp_res["ok"]:
                stats["errors"].append(f"Expenses: {exp_res.get('error', 'fetch failed')}")
            elif not exp_res["data"]:
                stats["errors"].append(f"Expenses: endpoint '{EXPENSE_ENDPOINT}' returned 0 rows")
            else:
                exp_rows = None
                exp_skipped = 0
                try:
                    exp_rows, exp_skipped = build_expense_rows(exp_res["data"])
                except ValueError as shape_err:
                    stats["errors"].append(f"Expenses: {shape_err}")

                if exp_rows is not None:
                    with conn.cursor() as cur:
                        linked = adopt_legacy_expense_rows(cur, exp_rows)
                        for batch in chunked(exp_rows, 500):
                            cur.executemany("""
                                INSERT INTO expenditure (
                                    crm_id, srNo, billDate, particulars, expenses, amount, net, expenseType, is_deleted
                                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 0)
                                ON DUPLICATE KEY UPDATE
                                    srNo = VALUES(srNo),
                                    billDate = VALUES(billDate),
                                    particulars = VALUES(particulars),
                                    expenses = VALUES(expenses),
                                    amount = VALUES(amount),
                                    net = VALUES(net),
                                    expenseType = VALUES(expenseType),
                                    is_deleted = 0
                            """, batch)
                        missing_from_crm, legacy_retired = retire_missing_expenses(cur, {r[0] for r in exp_rows})
                    stats["expenses"] = len(exp_rows)
                    latest = max((r[2] for r in exp_rows if r[2]), default=None)
                    stats["notes"].append(
                        f"expenses: {len(exp_rows)} synced (latest {latest}), {linked} linked to old rows, "
                        f"{missing_from_crm} removed in CRM, {legacy_retired} unmatched old rows retired, {exp_skipped} skipped"
                    )
                    print(f"[SYNC OK] Synced {stats['expenses']} Expenses (latest billDate: {latest}).")

            # 5. Sync Clients Info
            print("[SYNC] Writing Clients Info to DB...")
            c_res = fetched_results.get("clients", {"ok": False, "data": []})
            if c_res["ok"] and c_res["data"]:
                c_rows = []
                for c in c_res["data"]:
                    c_id = c.get("id")
                    if not c_id:
                        continue
                    c_name = str(c.get("companyName") or "").strip()
                    cp_name = str(c.get("contactPersonName") or c.get("contactPerson") or "").strip() or None
                    desig = str(c.get("designation") or "").strip() or None
                    phone = str(c.get("phoneNumber") or c.get("contactPhone") or c.get("mobileNo") or "").strip() or None
                    email = str(c.get("emailId") or c.get("contactEmail") or "").strip() or None
                    tl = str(c.get("teamLeader") or "").strip() or None
                    gst = str(c.get("gstNumber") or c.get("gstNo") or "").strip() or None
                    pan = str(c.get("panNumber") or c.get("panNo") or "").strip() or None
                    tan = str(c.get("tanNumber") or c.get("tanNo") or "").strip() or None
                    st = str(c.get("status") or "active").strip().lower()
                    amt = parse_float(c.get("amount") or c.get("grossAmount"))
                    tds = parse_float(c.get("tdsAmount") or c.get("tds"))

                    c_rows.append((c_id, c_name, cp_name, desig, phone, email, tl, gst, pan, tan, st, amt, tds))

                with conn.cursor() as cur:
                    for batch in chunked(c_rows, 500):
                        cur.executemany("""
                            INSERT INTO clients_info (
                                id, companyName, contactPersonName, designation, phoneNumber,
                                emailId, teamLeader, gstNumber, panNumber, tanNumber, status, amount, tdsAmount
                            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                            ON DUPLICATE KEY UPDATE
                                companyName = VALUES(companyName),
                                contactPersonName = VALUES(contactPersonName),
                                designation = VALUES(designation),
                                phoneNumber = VALUES(phoneNumber),
                                emailId = VALUES(emailId),
                                teamLeader = VALUES(teamLeader),
                                gstNumber = VALUES(gstNumber),
                                panNumber = VALUES(panNumber),
                                tanNumber = VALUES(tanNumber),
                                status = VALUES(status),
                                amount = VALUES(amount),
                                tdsAmount = VALUES(tdsAmount)
                        """, batch)
                stats["clients"] = len(c_rows)
                print(f"[SYNC OK] Synced {stats['clients']} Clients.")

            # 6. Sync Legals Info
            print("[SYNC] Writing Legals Info to DB...")
            l_res = fetched_results.get("legals", {"ok": False, "data": []})
            if l_res["ok"] and l_res["data"]:
                l_rows = []
                for l in l_res["data"]:
                    l_id = l.get("id") or l.get("legal_id")
                    c_name = str(l.get("companyName") or "").strip() or None
                    p_name = str(l.get("partyName") or "").strip() or None
                    gst = str(l.get("gstNo") or l.get("gstNumber") or "").strip() or None
                    pan = str(l.get("panNo") or l.get("panNumber") or "").strip() or None
                    tan = str(l.get("tanNo") or l.get("tanNumber") or "").strip() or None
                    fy = str(l.get("financialYear") or l.get("fy") or "").strip() or None
                    v_date = normalize_date(l.get("voucherDate") or l.get("invoiceDate"))
                    l_amt = parse_float(l.get("legal_amount") or l.get("amount"))
                    tds = parse_float(l.get("tdsAmount") or l.get("tds"))

                    l_rows.append((l_id, c_name, p_name, gst, pan, tan, fy, v_date, l_amt, tds))

                with conn.cursor() as cur:
                    for batch in chunked(l_rows, 500):
                        cur.executemany("""
                            INSERT INTO legals_info (
                                legal_id, companyName, partyName, gstNo, panNo, tanNo,
                                financialYear, voucherDate, legal_amount, tdsAmount
                            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                            ON DUPLICATE KEY UPDATE
                                companyName = VALUES(companyName),
                                partyName = VALUES(partyName),
                                gstNo = VALUES(gstNo),
                                panNo = VALUES(panNo),
                                tanNo = VALUES(tanNo),
                                financialYear = VALUES(financialYear),
                                voucherDate = VALUES(voucherDate),
                                legal_amount = VALUES(legal_amount),
                                tdsAmount = VALUES(tdsAmount)
                        """, batch)
                stats["legals"] = len(l_rows)
                print(f"[SYNC OK] Synced {stats['legals']} Legals.")

            # Finalize log entry
            duration = (datetime.datetime.now() - start_time).total_seconds()
            if stats["errors"]:
                final_status = "completed_with_warnings"
                final_message = f"Sync finished with warnings in {duration:.2f}s: " + " | ".join(stats["errors"])
            else:
                final_status = "completed"
                final_message = f"Sync completed successfully in {duration:.2f}s"
            if stats["notes"]:
                final_message += " | " + " | ".join(stats["notes"])
            final_message = final_message[:4000]
            if log_id:
                with conn.cursor() as cur:
                    cur.execute("""
                        UPDATE crm_sync_logs
                        SET status = %s,
                            enquiries_count = %s,
                            invoices_count = %s,
                            franchisees_count = %s,
                            expenses_count = %s,
                            clients_count = %s,
                            legals_count = %s,
                            message = %s,
                            completed_at = NOW()
                        WHERE id = %s
                    """, (
                        final_status,
                        stats["enquiries"], stats["invoices"], stats["franchisees"],
                        stats["expenses"], stats["clients"], stats["legals"],
                        final_message, log_id
                    ))

        except Exception as e:
            print("[SYNC ERROR] Error during Saarthi Live Sync:", str(e))
            stats["ok"] = False
            stats["errors"].append(str(e))
            if log_id:
                try:
                    with conn.cursor() as cur:
                        cur.execute("""
                            UPDATE crm_sync_logs
                            SET status = 'failed', message = %s, completed_at = NOW()
                            WHERE id = %s
                        """, (str(e), log_id))
                except Exception:
                    pass
        finally:
            if conn:
                if db_lock_held:
                    try:
                        with conn.cursor() as cur:
                            cur.execute("SELECT RELEASE_LOCK(%s)", (DB_SYNC_LOCK_NAME,))
                    except Exception:
                        pass
                try:
                    conn.close()
                except Exception:
                    pass

        # Fix A5: Invalidate all worker caches after sync completes
        try:
            from app import invalidate_all_caches
            invalidate_all_caches()
        except Exception as inv_err:
            try:
                from growth_tracking_controller import _clear_cache_prefix
                _clear_cache_prefix("")
            except Exception:
                pass

        stats["duration_seconds"] = (datetime.datetime.now() - start_time).total_seconds()
        stats["timestamp"] = datetime.datetime.now().isoformat()
        return stats
    finally:
        sync_lock.release()

if __name__ == "__main__":
    res = sync_saarthi_all()
    print("Sync Result Summary:", json.dumps(res, indent=2))