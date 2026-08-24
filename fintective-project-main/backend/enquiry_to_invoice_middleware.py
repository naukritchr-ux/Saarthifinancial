import json
from datetime import date
from flask import request

from db import get_db_connection
from invoice_helpers import (
    format_date_for_mysql,
    generate_bill_number,
    calculate_service_charges,
    calculate_gst,
    calculate_due_date,
    calculate_shares,
)

# Graceful import check for incentive_controller.process_invoice_incentives
try:
    from incentive_controller import process_invoice_incentives
except ImportError:
    def process_invoice_incentives(invoice_id):
        print(f"⚠️ process_invoice_incentives mocked for invoice ID: {invoice_id}")


def enquiry_to_invoice_after_request(response):
    if response.status_code in (200, 201):
        url = request.path
        method = request.method

        response_data = {}
        try:
            raw = response.get_data(as_text=True)
            response_data = json.loads(raw) if raw else {}
        except (ValueError, TypeError) as error:
            print("⚠️ Could not parse response body:", error)

        request_body = request.get_json(silent=True) or {}

        try:
            if "/api/CandidateForm" in url and method in ("POST", "PUT") and "/api/CandidateForm2" not in url and "/api/CandidateForm3" not in url:
                _handle_candidate_to_invoice(request_body, response_data)
            elif ("/api/CandidateForm2" in url or "/api/CandidateForm3" in url) and method in ("POST", "PUT"):
                _handle_form_to_cancellation(request_body, response_data, url)
        except Exception as err:
            print("❌ Middleware processing error:", err)

    return response


def _handle_candidate_to_invoice(candidate_form_data: dict, response_data: dict):
    enquiry_id = candidate_form_data.get("enquiry_id")
    if not enquiry_id:
        return

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT * FROM enquiries WHERE id = %s", [enquiry_id])
            enquiries = cursor.fetchall()

        if not enquiries:
            print("❌ Enquiry not found for ID:", enquiry_id)
            return

        enquiry = enquiries[0]
        candidate_form_id = response_data.get("insertId") or response_data.get("id")

        # If an invoice already exists for this enquiry, update it instead of
        # inserting a new one.
        with conn.cursor() as cursor:
            cursor.execute(
                "SELECT id FROM invoice WHERE enquiry_id = %s LIMIT 1", [enquiry_id]
            )
            existing_invoices = cursor.fetchall()

        if existing_invoices:
            invoice_id = existing_invoices[0]["id"]
            with conn.cursor() as cursor:
                cursor.execute(
                    """UPDATE invoice SET
                        candidateform_id = %s,
                        franchiseName = %s,
                        companyName = %s,
                        companyAddress = %s,
                        gstNo = %s,
                        candidateName = %s,
                        mobileNumber = %s,
                        emailOfCandidate = %s,
                        postOfCandidate = %s,
                        yearOfExp = %s,
                        sourceOfResume = %s,
                        dateOfJoining = %s,
                        annualSalaryOffered = %s
                    WHERE id = %s""",
                    [
                        candidate_form_id,
                        enquiry.get("franchiseeName"),
                        enquiry.get("companyName"),
                        enquiry.get("addressLine1"),
                        enquiry.get("gstNo"),
                        candidate_form_data.get("candidateName"),
                        candidate_form_data.get("mobileNumber"),
                        candidate_form_data.get("emailId"),
                        candidate_form_data.get("hireFor"),
                        candidate_form_data.get("yearofexp"),
                        candidate_form_data.get("sourceOfCV"),
                        format_date_for_mysql(candidate_form_data.get("dateOfJoining")),
                        candidate_form_data.get("salaryOffer"),
                        invoice_id,
                    ],
                )
                cursor.execute(
                    "UPDATE enquiries SET enquiryStatus = 'invoiced' WHERE id = %s",
                    [enquiry_id],
                )
            conn.commit()
            print("ℹ️ Existing invoice updated for enquiry:", enquiry_id)
            return

        invoice_data = {
            "enquiry_id": enquiry_id,
            "candidateform_id": candidate_form_id,
            "franchiseName": enquiry.get("franchiseeName"),
            "contactPersonName": enquiry.get("hrExecutiveName"),
            "payingGst": "",
            "isProprietor": "",
            "teamLeader": enquiry.get("teamLeaderName"),
            "companyName": enquiry.get("companyName"),
            "companyAddress": enquiry.get("addressLine1"),
            "companyCity": "",
            "state": "",
            "isFromMaharashtra": "",
            "contactPerson": enquiry.get("hrExecutiveName"),
            "designation": enquiry.get("designation"),
            "contactNumber": enquiry.get("mobileNo"),
            "contactEmail": enquiry.get("emailId"),
            "gstNo": enquiry.get("gstNo"),
            "industry": "",
            "subIndustry": "",
            "serviceCharge": enquiry.get("placementFees"),
            "creditPeriod": enquiry.get("creditPeriod"),
            "replacementPeriod": enquiry.get("replacementPeriod"),
            "candidateName": candidate_form_data.get("candidateName"),
            "mobileNumber": candidate_form_data.get("mobileNumber"),
            "emailOfCandidate": candidate_form_data.get("emailId"),
            "postOfCandidate": candidate_form_data.get("hireFor"),
            "yearOfExp": candidate_form_data.get("yearofexp"),
            "sourceOfResume": candidate_form_data.get("sourceOfCV"),
            "dateOfJoining": format_date_for_mysql(candidate_form_data.get("dateOfJoining")),
            "annualSalaryOffered": candidate_form_data.get("salaryOffer"),
            "nameOfBd": enquiry.get("bdMemberName"),
            "billDate": date.today().isoformat(),
            "billNumber": generate_bill_number(),
            "info": "O",
        }

        service_charges = calculate_service_charges(
            invoice_data["annualSalaryOffered"], invoice_data["serviceCharge"]
        )
        gst = calculate_gst(service_charges, invoice_data["isFromMaharashtra"])
        total_bill_amt = service_charges + gst["total_gst"]
        due_date = calculate_due_date(invoice_data["billDate"], invoice_data["creditPeriod"])

        # Same shared formula used in invoice_controller.create_invoice — keeps
        # the franchisee/company split consistent regardless of which path
        # created the invoice, and respects the April 2026 rate change
        # automatically via invoice_data["billDate"].
        shares = calculate_shares(service_charges, invoice_data["info"], invoice_data["billDate"])

        invoice_data.update({
            "serviceCharges": service_charges,
            "CGST": gst["cgst"],
            "SGST": gst["sgst"],
            "IGST": gst["igst"],
            "totalGST": gst["total_gst"],
            "totalBillAmt": total_bill_amt,
            "dueDate": due_date,
            "tds": round(service_charges * 0.1),
            "franchiseeShare": shares["franchisee_share"],
            "ourShare": shares["our_share"],
            "franchiseeGST": round(service_charges * 0.18),
        })

        with conn.cursor() as cursor:
            columns = list(invoice_data.keys())
            placeholders = ", ".join(["%s"] * len(columns))
            column_list = ", ".join(f"`{c}`" for c in columns)
            cursor.execute(
                f"INSERT INTO invoice ({column_list}) VALUES ({placeholders})",
                list(invoice_data.values()),
            )
            invoice_id = cursor.lastrowid
        print("✅ Invoice created. ID:", invoice_id)

        with conn.cursor() as cursor:
            cursor.execute(
                "UPDATE enquiries SET enquiryStatus = 'invoiced' WHERE id = %s",
                [enquiry_id],
            )
        conn.commit()

        # Process incentives for the new invoice
        try:
            process_invoice_incentives(invoice_id)
            print("✅ Incentives processed for invoice ID:", invoice_id)
        except Exception as error:
            print("❌ Error processing incentives for invoice ID:", invoice_id, error)
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def _handle_form_to_cancellation(form_data: dict, response_data: dict, url: str):
    enquiry_id = form_data.get("enquiry_id")
    if not enquiry_id:
        return

    is_form2 = "/api/CandidateForm2" in url

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT * FROM enquiries WHERE id = %s", [enquiry_id])
            enquiries = cursor.fetchall()

        if not enquiries:
            print("❌ Enquiry not found for ID:", enquiry_id)
            return

        enquiry = enquiries[0]
        form_id = response_data.get("id")

        cancellation_data = {
            "enquiry_id": enquiry_id,
            ("candidateform2_id" if is_form2 else "candidateform3_id"): form_id,
            "emailAddress": enquiry.get("emailId"),
            "nameOfFranchise": enquiry.get("franchiseeName"),
            "nameOfCompany": enquiry.get("companyName"),
            "cancelChange": "Cancel" if is_form2 else "Change",
            "billNo": form_data.get("billNo"),
            "serviceChargeAmount": form_data.get("serviceCharge") if is_form2 else 0,
            "reasonOfCancel": form_data.get("reasonForCreditNote") if is_form2 else form_data.get("revisionDetails"),
            "candidateName": "" if is_form2 else form_data.get("candidateName"),
            "detailsChangesRequired": "" if is_form2 else form_data.get("revisionDetails"),
        }

        with conn.cursor() as cursor:
            columns = list(cancellation_data.keys())
            placeholders = ", ".join(["%s"] * len(columns))
            column_list = ", ".join(f"`{c}`" for c in columns)
            cursor.execute(
                f"INSERT INTO cancellation ({column_list}) VALUES ({placeholders})",
                list(cancellation_data.values()),
            )
            cancel_id = cursor.lastrowid
        print("✅ Cancellation created. ID:", cancel_id)

        new_status = "cancelled" if is_form2 else "revised"
        with conn.cursor() as cursor:
            cursor.execute(
                "UPDATE enquiries SET enquiryStatus = %s WHERE id = %s",
                [new_status, enquiry_id],
            )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
