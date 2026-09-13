import os
import re
import json
import datetime
import urllib.request
import urllib.error
from db import get_db_connection, ensure_tables_exist

HTTP_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9'
}

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

def fetch_saarthi_endpoint(endpoint_path, timeout=30):
    """
    Tries multiple candidate URLs across Saarthi domains with fallbacks.
    """
    clean_path = endpoint_path.lstrip('/')
    candidates = [
        f"https://api.sarthi360.in/api/{clean_path}",
        f"https://api.sarthi360.in/{clean_path}",
        f"https://sarthi360.in/api/{clean_path}",
        f"https://sarthi360.in/{clean_path}",
        f"https://api.saarthi360.in/api/{clean_path}",
        f"https://api.saarthi360.in/{clean_path}"
    ]

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
                            return {"ok": True, "data": data_arr, "url": url}
                        return {"ok": True, "data": [parsed], "url": url}
        except Exception as err:
            continue

    return {"ok": False, "data": [], "error": f"Failed to fetch {endpoint_path} from all candidate URLs"}

def sync_saarthi_all():
    """
    Main sync engine: Fetches all Saarthi APIs and upserts into MySQL.
    """
    ensure_tables_exist()
    start_time = datetime.datetime.now()
    log_id = None
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO crm_sync_logs (sync_type, status, started_at)
                VALUES ('all', 'in_progress', NOW())
            """)
            log_id = cur.lastrowid
    except Exception as e:
        print("Log entry notice:", str(e))

    stats = {
        "enquiries": 0,
        "invoices": 0,
        "franchisees": 0,
        "expenses": 0,
        "clients": 0,
        "legals": 0,
        "errors": []
    }

    try:
        # 1. Sync Franchisees
        print("🔄 Syncing Franchisees from Saarthi API...")
        f_res = fetch_saarthi_endpoint("franchisees")
        if f_res["ok"] and f_res["data"]:
            with conn.cursor() as cur:
                for f in f_res["data"]:
                    name = str(f.get("nameAsPerAgreement") or f.get("franchiseName") or f.get("name") or "").strip()
                    tl = str(f.get("teamLeaderName") or f.get("teamLeader") or "").strip()
                    onboard = normalize_date(f.get("onboardingDate") or f.get("dateOfAgreement") or f.get("createdAt"))
                    if name:
                        cur.execute("""
                            INSERT INTO franchisees (nameAsPerAgreement, teamLeaderName, onboardingDate, status)
                            VALUES (%s, %s, %s, 'active')
                            ON DUPLICATE KEY UPDATE
                                teamLeaderName = VALUES(teamLeaderName),
                                onboardingDate = COALESCE(VALUES(onboardingDate), onboardingDate)
                        """, (name, tl, onboard))
                        cur.execute("""
                            INSERT INTO franchisees_forms (nameAsPerAgreement, teamLeaderName)
                            VALUES (%s, %s)
                            ON DUPLICATE KEY UPDATE teamLeaderName = VALUES(teamLeaderName)
                        """, (name, tl))
                        stats["franchisees"] += 1
            print(f"✅ Synced {stats['franchisees']} Franchisees.")
        else:
            stats["errors"].append(f"Franchisees: {f_res.get('error', 'No data')}")

        # 2. Sync Enquiries
        print("🔄 Syncing Enquiries from Saarthi API...")
        enq_res = fetch_saarthi_endpoint("enquiries")
        if enq_res["ok"] and enq_res["data"]:
            with conn.cursor() as cur:
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

                    cur.execute("""
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
                    """, (
                        enq_id, company, bd, tl, fran, fees, pos, ind, f_val, t_val, st,
                        alloc_d, acq_d, realloc_d, b_no, b_date, b_amt, info, c_at
                    ))
                    stats["enquiries"] += 1
            print(f"✅ Synced {stats['enquiries']} Enquiries.")
        else:
            stats["errors"].append(f"Enquiries: {enq_res.get('error', 'No data')}")

        # 3. Sync Invoices
        print("🔄 Syncing Invoices from Saarthi API...")
        inv_res = fetch_saarthi_endpoint("Invoice")
        if not inv_res["ok"] or not inv_res["data"]:
            inv_res = fetch_saarthi_endpoint("invoice")
            
        if inv_res["ok"] and inv_res["data"]:
            with conn.cursor() as cur:
                for inv in inv_res["data"]:
                    inv_id = inv.get("id")
                    if not inv_id:
                        continue
                    enq_id = inv.get("enquiry_id") or None
                    b_num = str(inv.get("billNumber") or inv.get("bill_no") or "").strip() or None
                    b_date = normalize_date(inv.get("billDate") or inv.get("bill_date"))
                    svc_chg = parse_float(inv.get("serviceCharges") or inv.get("serviceCharge"))
                    svc_rate = parse_float(inv.get("serviceCharge"))
                    gst = parse_float(inv.get("totalGST") or inv.get("gst"))
                    tot_bill = parse_float(inv.get("totalBillAmt") or inv.get("bill_amount"))
                    f_share = parse_float(inv.get("franchiseeShare") or inv.get("franchiseShare"))
                    f_gst = parse_float(inv.get("franchiseeGST"))
                    our_sh = parse_float(inv.get("ourShare"))
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

                    cur.execute("""
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
                            totalBillAmt = VALUES(totalBillAmt),
                            franchiseeShare = VALUES(franchiseeShare),
                            ourShare = VALUES(ourShare),
                            amountReceived = VALUES(amountReceived),
                            amountDue = VALUES(amountDue),
                            tds = VALUES(tds),
                            nameOfBd = VALUES(nameOfBd),
                            teamLeader = VALUES(teamLeader),
                            franchiseName = VALUES(franchiseName),
                            financialYear = VALUES(financialYear),
                            companyName = VALUES(companyName),
                            postOfCandidate = VALUES(postOfCandidate),
                            info = VALUES(info),
                            status = VALUES(status)
                    """, (
                        inv_id, enq_id, b_num, b_date, svc_chg, svc_rate, gst, tot_bill,
                        f_share, f_gst, our_sh, amt_rec, amt_due, tds_val, tds_ff, d_rec, d_paid,
                        pay_mode, uid_tx, bd_name, tl_name, fran_name, fy_val, cand_name, comp_name,
                        post_name, sal_offered, info_st, status_st
                    ))
                    stats["invoices"] += 1
            print(f"✅ Synced {stats['invoices']} Invoices.")
        else:
            stats["errors"].append(f"Invoices: {inv_res.get('error', 'No data')}")

        # 4. Sync Expenses
        print("🔄 Syncing Expenses from Saarthi API...")
        exp_res = fetch_saarthi_endpoint("expenses")
        if exp_res["ok"] and exp_res["data"]:
            with conn.cursor() as cur:
                for exp in exp_res["data"]:
                    sr = str(exp.get("srNo") or exp.get("id") or "").strip() or None
                    b_date = normalize_date(exp.get("billDate") or exp.get("date"))
                    part = str(exp.get("particulars") or exp.get("title") or exp.get("description") or "").strip()
                    exp_name = str(exp.get("expenses") or exp.get("category") or "Other").strip()
                    amt = parse_float(exp.get("amount"))
                    net = parse_float(exp.get("net") or exp.get("amount"))
                    exp_type = str(exp.get("expenseType") or exp.get("type") or "expense").strip()
                    bd_id = str(exp.get("bdAgentId") or "").strip() or None
                    fran_id = str(exp.get("franchiseeId") or "").strip() or None

                    if amt > 0 or part:
                        cur.execute("""
                            INSERT INTO expenditure (
                                srNo, billDate, particulars, expenses, amount, net, expenseType, bdAgentId, franchiseeId, is_deleted
                            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 0)
                        """, (sr, b_date, part, exp_name, amt, net, exp_type, bd_id, fran_id))
                        stats["expenses"] += 1
            print(f"✅ Synced {stats['expenses']} Expenses.")

        # 5. Sync Clients Info
        print("🔄 Syncing Clients Info from Saarthi API...")
        c_res = fetch_saarthi_endpoint("clients_info")
        if c_res["ok"] and c_res["data"]:
            with conn.cursor() as cur:
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

                    cur.execute("""
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
                    """, (c_id, c_name, cp_name, desig, phone, email, tl, gst, pan, tan, st, amt, tds))
                    stats["clients"] += 1
            print(f"✅ Synced {stats['clients']} Clients.")

        # 6. Sync Legals Info
        print("🔄 Syncing Legals Info from Saarthi API...")
        l_res = fetch_saarthi_endpoint("legals_info")
        if l_res["ok"] and l_res["data"]:
            with conn.cursor() as cur:
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

                    cur.execute("""
                        INSERT INTO legals_info (
                            legal_id, companyName, partyName, gstNo, panNo, tanNo,
                            financialYear, voucherDate, legal_amount, tdsAmount
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """, (l_id, c_name, p_name, gst, pan, tan, fy, v_date, l_amt, tds))
                    stats["legals"] += 1
            print(f"✅ Synced {stats['legals']} Legals.")

        # Finalize log entry
        duration = (datetime.datetime.now() - start_time).total_seconds()
        if log_id:
            with conn.cursor() as cur:
                cur.execute("""
                    UPDATE crm_sync_logs
                    SET status = 'completed',
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
                    stats["enquiries"], stats["invoices"], stats["franchisees"],
                    stats["expenses"], stats["clients"], stats["legals"],
                    f"Sync completed successfully in {duration:.2f}s", log_id
                ))

    except Exception as e:
        print("💥 Error during Saarthi Live Sync:", str(e))
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
        conn.close()

    stats["duration_seconds"] = (datetime.datetime.now() - start_time).total_seconds()
    stats["timestamp"] = datetime.datetime.now().isoformat()
    return stats

if __name__ == "__main__":
    res = sync_saarthi_all()
    print("Sync Result Summary:", json.dumps(res, indent=2))
