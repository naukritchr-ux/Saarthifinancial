import os
import jwt
from flask import Blueprint, request, jsonify, Response

from db import get_db_connection
from invoice_helpers import calculate_shares

JWT_SECRET = os.getenv("JWT_SECRET", "fallback_secret")

invoice_bp = Blueprint("invoice", __name__)


# --------------------------------------------------------------------------
# Small helpers
# --------------------------------------------------------------------------

def _current_user():
    """Mirrors the JS pattern: decode the bearer token if present, swallow
    verification errors and just treat the request as unauthenticated."""
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        return None

    parts = auth_header.split(" ")
    token = parts[1] if len(parts) > 1 else parts[0]
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError as err:
        print("Token verification failed:", err)
        return None


def _dict_insert(cursor, table, data: dict):
    """Equivalent of mysql2's `INSERT INTO table SET ?` with a plain dict."""
    columns = list(data.keys())
    placeholders = ", ".join(["%s"] * len(columns))
    column_list = ", ".join(f"`{c}`" for c in columns)
    sql = f"INSERT INTO `{table}` ({column_list}) VALUES ({placeholders})"
    cursor.execute(sql, list(data.values()))
    return cursor.lastrowid


# --------------------------------------------------------------------------
# GET /api/franchise-payments
# --------------------------------------------------------------------------

@invoice_bp.route("/api/franchise-payments", methods=["GET"])
def get_franchise_payments():
    user = _current_user()

    query = """
        SELECT
            id,
            franchiseName AS `FRANCHISEE NAME`,
            companyName AS `CLIENT NAME`,
            billNumber AS `INVOICE NO`,
            billDate AS `INVOICE DATE`,
            annualSalaryOffered AS `ANNUAL SALARY`,
            serviceCharge AS `SERVICE CHARGE AGREED`,
            serviceCharges AS `SERVICE CHARGE`,
            totalGST AS `TOTAL GST`,
            totalBillAmt AS `TOTAL BILL AMT`,
            amountReceived AS `AMOUNT RECEIVED`,
            tds AS `TDS`,
            franchiseeShare AS `FRANCHISE SHARE`,
            franchiseeGST AS `GST IF ANY`,
            amountDue AS `AMOUNT DUE`,
            tdsFF AS `TDS FF`,
            info AS `STATUS`,
            paidOnDate AS `PAID ON DATE`,
            payment_mode AS `PAYMENT MODE`,
            uid_transaction_id AS `UID NO`,
            (amountDue - tdsFF) AS `AMOUNT PAID`
        FROM invoice
        WHERE info IN ('PP', 'PR')
    """
    params = []

    if user:
        if user.get("role") == "franchisee" and user.get("franchiseName"):
            query += " AND franchiseName = %s"
            params.append(user["franchiseName"])
        elif user.get("role") == "teamLeader" and user.get("name"):
            query += " AND teamLeader = %s"
            params.append(user["name"])

    search = request.args.get("search")
    if search:
        term = f"%{search}%"
        query += " AND (franchiseName LIKE %s OR companyName LIKE %s OR billNumber LIKE %s OR info LIKE %s)"
        params.extend([term, term, term, term])

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(query, params)
            results = cursor.fetchall()
        return jsonify(results)
    except Exception as err:
        print("Error fetching franchise payments:", err)
        return jsonify({"error": str(err)}), 500
    finally:
        conn.close()


# --------------------------------------------------------------------------
# GET /api/invoices
# --------------------------------------------------------------------------

@invoice_bp.route("/api/invoices", methods=["GET"])
def get_all_invoices():
    user = _current_user()

    query = "SELECT * FROM invoice"
    params = []
    conditions = []

    if user:
        if user.get("role") == "franchisee" and user.get("franchiseeName"):
            conditions.append("franchiseName = %s")
            params.append(user["franchiseeName"])
        elif user.get("role") == "teamLeader" and user.get("name"):
            # Use wildcards to match first and last names, e.g. "SURBHI JAIN"
            # matches "Surbhi Vinod Jain".
            name_parts = user["name"].split(" ")
            first, last = name_parts[0], name_parts[-1]
            conditions.append("teamLeader LIKE %s")
            params.append(f"{first}%{last}")

    if conditions:
        query += " WHERE " + " AND ".join(conditions)

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(query, params)
            results = cursor.fetchall()
        return jsonify(results)
    except Exception as err:
        print("Error fetching invoices:", err)
        return jsonify({"error": str(err)}), 500
    finally:
        conn.close()


# --------------------------------------------------------------------------
# GET /api/invoices/<id>
# --------------------------------------------------------------------------

@invoice_bp.route("/api/invoices/<int:invoice_id>", methods=["GET"])
def get_invoice_by_id(invoice_id):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT * FROM invoice WHERE id = %s", [invoice_id])
            results = cursor.fetchall()

        if not results:
            return jsonify({"error": "Invoice not found"}), 404

        return jsonify(results[0])
    except Exception as err:
        print("Error fetching invoice:", err)
        return jsonify({"error": str(err)}), 500
    finally:
        conn.close()


# --------------------------------------------------------------------------
# Local GST helper used only by create_invoice() below — kept separate from
# invoice_helpers.calculate_gst() to match the original JS 1:1.
# --------------------------------------------------------------------------

def _calculate_gst_local(service_charges, is_from_maharashtra) -> dict:
    sc = float(service_charges or 0)

    if is_from_maharashtra == "Yes":
        cgst = round(sc * 0.09)
        sgst = round(sc * 0.09)
        return {"CGST": cgst, "SGST": sgst, "IGST": 0, "totalGST": cgst + sgst}
    else:
        igst = round(sc * 0.18)
        return {"CGST": 0, "SGST": 0, "IGST": igst, "totalGST": igst}


# --------------------------------------------------------------------------
# PUT/PATCH /api/invoices/<id>
# --------------------------------------------------------------------------

ALLOWED_FIELDS = [
    "enquiry_id", "candidateform_id", "franchiseName", "contactPersonName",
    "payingGst", "isProprietor", "teamLeader", "companyName", "companyAddress",
    "companyCity", "pinCode", "state", "isFromMaharashtra",
    "companyFromMaharashtra", "contactPerson", "designation", "contactNumber",
    "contactEmail", "gstNo", "industry", "subIndustry", "serviceCharge",
    "creditPeriod", "replacementPeriod", "candidateName", "mobileNumber",
    "emailOfCandidate", "postOfCandidate", "yearOfExp", "sourceOfResume",
    "dateOfJoining", "annualSalaryOffered", "nameOfBd", "billDate",
    "billNumber", "serviceCharges", "CGST", "SGST", "IGST", "totalGST",
    "totalBillAmt", "dueDate", "info", "creditDate", "creditNoteNo",
    "dateReceived", "amountReceived", "tds", "tdsFF", "franchiseeShare",
    "franchiseeGST", "amountDue", "paidOnDate", "soaNo", "debitCorrection",
    "gstPaidStatus", "gstPaidReceived", "ourShare", "monthOfBill",
    "financialYear", "financialYearReceived", "revisionDetails",
    "franchiseeInvoice", "remarks", "areYouPayingGstClient", "tallyUpdated",
    "candidateEmailId", "candidateMobileNumber", "candidateYearOfExp",
    "sourceOfCV", "candidateDateOfBirth", "candidateSalaryOffer",
    "candidateHireFor", "candidateDateOfJoining", "payment_mode",
    "uid_transaction_id", "is_payment_done", "tlVerified", "isManualShareOverride",
]

DATE_FIELDS = [
    "billDate", "dateOfJoining", "creditDate", "dateReceived", "paidOnDate",
    "dueDate", "candidateDateOfBirth", "candidateDateOfJoining",
]

DECIMAL_FIELDS = [
    "serviceCharges", "CGST", "SGST", "IGST", "totalGST", "totalBillAmt",
    "amountReceived", "tds", "tdsFF", "franchiseeShare", "franchiseeGST",
    "amountDue", "ourShare",
]


@invoice_bp.route("/api/invoices/<int:invoice_id>", methods=["PUT", "PATCH"])
def update_invoice(invoice_id):
    from invoice_helpers import format_date_for_mysql

    invoice_data = dict(request.get_json(silent=True) or {})
    invoice_data.pop("id", None)

    print("=== UPDATE INVOICE DEBUG ===")
    print("Invoice ID:", invoice_id)
    print("Raw request body:", invoice_data)

    update_fields = {}

    for field in ALLOWED_FIELDS:
        if field not in invoice_data:
            continue
        value = invoice_data[field]

        if field in DATE_FIELDS:
            update_fields[field] = format_date_for_mysql(value) if value else None
        elif field in DECIMAL_FIELDS:
            if value in (None, ""):
                update_fields[field] = None
            else:
                try:
                    update_fields[field] = float(value)
                except (TypeError, ValueError):
                    update_fields[field] = None
        else:
            update_fields[field] = value

    print("Update fields after sanitization:", update_fields)

    conn = get_db_connection()
    try:
        # Fetch current values from DB to support partial updates
        with conn.cursor() as cursor:
            cursor.execute(
                "SELECT serviceCharges, info, billDate, franchiseeShare, ourShare, isManualShareOverride FROM invoice WHERE id = %s",
                [invoice_id],
            )
            current_row = cursor.fetchone()

        is_manual_override = update_fields.get(
            "isManualShareOverride", (current_row or {}).get("isManualShareOverride", False)
        )
        
        # Ensure is_manual_override is interpreted properly as a boolean
        if str(is_manual_override).isdigit():
            is_manual_override = bool(int(is_manual_override))
        else:
            is_manual_override = bool(is_manual_override)

        if (
            is_manual_override
            or any(k in update_fields for k in ("serviceCharges", "info", "billDate"))
        ):
            effective_service_charges = update_fields.get(
                "serviceCharges", (current_row or {}).get("serviceCharges")
            )
            effective_info = update_fields.get("info", (current_row or {}).get("info"))
            effective_bill_date = update_fields.get(
                "billDate", (current_row or {}).get("billDate")
            )
            effective_franchisee_share = update_fields.get(
                "franchiseeShare", (current_row or {}).get("franchiseeShare")
            )
            effective_our_share = update_fields.get(
                "ourShare", (current_row or {}).get("ourShare")
            )

            shares = calculate_shares(
                effective_service_charges,
                effective_info,
                effective_bill_date,
                is_manual_override,
                effective_franchisee_share,
                effective_our_share
            )
            # Force these two fields regardless of what the client sent for them.
            update_fields["franchiseeShare"] = shares["franchisee_share"]
            update_fields["ourShare"] = shares["our_share"]
        else:
            # Nothing that feeds the split changed in this request — don't
            # touch franchiseeShare/ourShare even if the client happened to
            # send them, since we have no new effective inputs to recompute
            # from safely.
            update_fields.pop("franchiseeShare", None)
            update_fields.pop("ourShare", None)

        if not update_fields:
            return jsonify({"error": "No valid fields to update"}), 400

        print("Final update fields before DB:", update_fields)

        field_names = list(update_fields.keys())
        field_values = list(update_fields.values())
        set_clause = ", ".join(f"`{f}` = %s" for f in field_names)

        with conn.cursor() as cursor:
            cursor.execute(
                f"UPDATE invoice SET {set_clause} WHERE id = %s",
                [*field_values, invoice_id],
            )
            affected_rows = cursor.rowcount

            if affected_rows == 0:
                return jsonify({"error": "Invoice not found"}), 404

            cursor.execute("SELECT * FROM invoice WHERE id = %s", [invoice_id])
            updated_invoice = cursor.fetchone()

        conn.commit()
        return jsonify({
            "message": "Invoice updated successfully",
            "updatedInvoice": updated_invoice,
        })
    except Exception as err:
        conn.rollback()
        print("Error updating invoice:", err)
        return jsonify({"error": str(err)}), 500
    finally:
        conn.close()


# --------------------------------------------------------------------------
# DELETE /api/invoices/<id>
# --------------------------------------------------------------------------

AUTHORIZED_DELETERS = [
    "rashesh doshi",
    "bankim doshi",
    "purna suresh ghadi",
    "rasheshdoshi@tcmail.co.in",
    "hrutika.mohal@talentcorner.in",
    "purnaghadi923@gmail.com",
    "rushali.rajgor@talentcorner.in",
    "bankim@talentcorner.in",
    "hrutika mohal",
    "rushali champak rajgor",
]

# Columns copied from `invoice` into `invoice_backup_new`, in insert order —
# matches the JS INSERT column list exactly.
BACKUP_COLUMNS = [
    "enquiry_id", "candidateform_id", "franchiseName", "contactPersonName",
    "payingGst", "isProprietor", "teamLeader", "companyName", "companyAddress",
    "companyCity", "pinCode", "state", "isFromMaharashtra", "gstNo",
    "industry", "subIndustry", "serviceCharge", "creditPeriod",
    "replacementPeriod", "candidateName", "postOfCandidate",
    "annualSalaryOffered", "dateOfJoining", "nameOfBd", "billDate",
    "billNumber", "serviceCharges", "CGST", "SGST", "IGST", "totalGST",
    "totalBillAmt", "dueDate", "info", "creditDate", "creditNoteNo",
    "dateReceived", "amountReceived", "tds", "tdsFF", "franchiseeShare",
    "franchiseeGST", "amountDue", "paidOnDate", "soaNo", "gstPaidStatus",
    "ourShare", "monthOfBill", "financialYear", "financialYearReceived",
    "remarks", "areYouPayingGstClient", "tallyUpdated", "contactPerson",
    "designation", "contactNumber", "contactEmail", "companyFromMaharashtra",
    "payment_mode", "uid_transaction_id", "is_payment_done", "createdAt",
]


@invoice_bp.route("/api/invoices/<int:invoice_id>", methods=["DELETE"])
def delete_invoice(invoice_id):
    frontend_name = (
        (request.get_json(silent=True) or {}).get("deletedBy")
        or request.headers.get("x-deleted-by")
        or ""
    ).strip()

    if not frontend_name:
        return jsonify({"error": "Deleter name is required."}), 400

    normalized_input = frontend_name.lower().strip()
    is_authorized = any(
        normalized_input == auth or normalized_input in auth or auth in normalized_input
        for auth in AUTHORIZED_DELETERS
    )

    if not is_authorized:
        return jsonify({"error": "You are not authorized to delete invoices."}), 403

    conn = get_db_connection()
    deleted_by = frontend_name
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "SELECT name FROM crm_db.users3 WHERE LOWER(TRIM(name)) = LOWER(TRIM(%s)) LIMIT 1",
                [frontend_name],
            )
            user_row = cursor.fetchone()

            if user_row:
                deleted_by = user_row["name"]
            else:
                cursor.execute(
                    "SELECT name FROM crm_db.users3 WHERE LOWER(name) LIKE LOWER(%s) LIMIT 1",
                    [f"%{frontend_name}%"],
                )
                partial_row = cursor.fetchone()
                if partial_row:
                    deleted_by = partial_row["name"]
    except Exception as err:
        print("Error validating deleter name:", err)

    try:
        conn.begin()

        with conn.cursor() as cursor:
            cursor.execute("SELECT * FROM invoice WHERE id = %s", [invoice_id])
            row = cursor.fetchone()

        if not row:
            conn.rollback()
            return jsonify({"error": "Invoice not found"}), 404

        with conn.cursor() as cursor:
            columns_sql = ", ".join(BACKUP_COLUMNS)
            placeholders_sql = ", ".join(["%s"] * (len(BACKUP_COLUMNS) + 2))
            cursor.execute(
                f"""INSERT INTO invoice_backup_new (
                    deleted_by, original_id, {columns_sql}
                ) VALUES ({placeholders_sql})""",
                [deleted_by, row["id"]] + [row.get(c) for c in BACKUP_COLUMNS],
            )

            cursor.execute("DELETE FROM invoice WHERE id = %s", [invoice_id])

        conn.commit()
        return jsonify({"message": "Invoice deleted and backed up successfully."})
    except Exception as err:
        conn.rollback()
        print("Error deleting invoice:", err)
        return jsonify({"error": str(err)}), 500
    finally:
        conn.close()


# --------------------------------------------------------------------------
# create_invoice — NOT a route. Called directly by other modules (e.g. the
# enquiry->invoice flow).
# --------------------------------------------------------------------------

def create_invoice(invoice_data: dict) -> dict:
    """Raises ValueError on missing required fields or on any DB failure."""
    invoice_data = dict(invoice_data)

    if not (
        invoice_data.get("franchiseName")
        and invoice_data.get("companyName")
        and invoice_data.get("candidateName")
        and invoice_data.get("serviceCharges")
    ):
        print("Attempted to create an incomplete invoice. Aborting creation.", invoice_data)
        raise ValueError(
            "Failed to create invoice: Missing required fields "
            "(e.g., franchiseName, companyName, candidateName, serviceCharges)."
        )

    conn = get_db_connection()
    try:
        conn.begin()

        if invoice_data.get("serviceCharges") and invoice_data.get("isFromMaharashtra"):
            gst = _calculate_gst_local(
                invoice_data["serviceCharges"], invoice_data["isFromMaharashtra"]
            )
            invoice_data["CGST"] = gst["CGST"]
            invoice_data["SGST"] = gst["SGST"]
            invoice_data["IGST"] = gst["IGST"]
            invoice_data["totalGST"] = gst["totalGST"]
            invoice_data["totalBillAmt"] = float(invoice_data["serviceCharges"]) + gst["totalGST"]

        # Calculate franchiseeShare / ourShare via the single shared formula.
        if invoice_data.get("serviceCharges"):
            shares = calculate_shares(
                invoice_data["serviceCharges"],
                invoice_data.get("info"),
                invoice_data.get("billDate"),
                invoice_data.get("isManualShareOverride", False),
                invoice_data.get("franchiseeShare"),
                invoice_data.get("ourShare"),
            )
            invoice_data["franchiseeShare"] = shares["franchisee_share"]
            invoice_data["ourShare"] = shares["our_share"]

        with conn.cursor() as cursor:
            new_id = _dict_insert(cursor, "invoice", invoice_data)

        conn.commit()
        return {"id": new_id, **invoice_data}
    except Exception as error:
        conn.rollback()
        raise ValueError("Failed to create invoice: " + str(error)) from error
    finally:
        conn.close()


# --------------------------------------------------------------------------
# PDF upload / download
# --------------------------------------------------------------------------

@invoice_bp.route("/api/invoices/<int:invoice_id>/pdf", methods=["POST"])
def upload_invoice_pdf(invoice_id):
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    pdf_bytes = request.files["file"].read()

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "UPDATE invoice SET franchiseeInvoice = %s WHERE id = %s",
                [pdf_bytes, invoice_id],
            )
        conn.commit()
        return jsonify({"message": "PDF uploaded successfully"})
    except Exception as err:
        conn.rollback()
        return jsonify({"error": str(err)}), 500
    finally:
        conn.close()


@invoice_bp.route("/api/invoices/<int:invoice_id>/pdf", methods=["GET"])
def download_invoice_pdf(invoice_id):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "SELECT franchiseeInvoice FROM invoice WHERE id = %s", [invoice_id]
            )
            row = cursor.fetchone()

        if not row or not row.get("franchiseeInvoice"):
            return jsonify({"error": "No PDF found"}), 404

        return Response(row["franchiseeInvoice"], mimetype="application/pdf")
    except Exception as err:
        return jsonify({"error": str(err)}), 500
    finally:
        conn.close()
