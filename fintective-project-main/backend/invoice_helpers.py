import random
from datetime import datetime, timedelta, timezone


def generate_bill_number() -> str:
    now = datetime.now()
    yyyy = now.year
    mm = f"{now.month:02d}"
    dd = f"{now.day:02d}"
    rand = f"{random.randint(0, 9999):04d}"
    return f"BILL-{yyyy}{mm}{dd}-{rand}"


def calculate_service_charges(salary_offer, service_charge_percent) -> int:
    offer = float(salary_offer or 0)
    percent = float(service_charge_percent or 0)
    return round(offer * percent / 100)


def calculate_gst(service_charges, is_from_maharashtra) -> dict:
    """Returns {'cgst', 'sgst', 'igst', 'total_gst'} — 18% GST split either as
    9%+9% CGST/SGST (Maharashtra) or 18% IGST (outside Maharashtra)."""
    gst_rate = 0.18
    total_gst = round(service_charges * gst_rate)

    if str(is_from_maharashtra or "").lower() == "yes":
        half = round(total_gst / 2)
        return {"cgst": half, "sgst": half, "igst": 0, "total_gst": total_gst}
    else:
        return {"cgst": 0, "sgst": 0, "igst": total_gst, "total_gst": total_gst}


def _parse_date(value):
    """Best-effort parse of a date string/datetime into a datetime, or None."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    s = str(value).strip()
    if not s:
        return None
    # Try a handful of common formats (ISO date, ISO datetime, MySQL datetime)
    for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(s[: len(fmt) + 2], fmt)
        except ValueError:
            continue
    try:
        # Fall back to fromisoformat (handles "Z" poorly, so strip it)
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError:
        return None


def calculate_due_date(bill_date, credit_period):
    date = _parse_date(bill_date)
    try:
        days = int(credit_period or 0)
    except (TypeError, ValueError):
        return None

    if date is None:
        return None

    return (date + timedelta(days=days)).strftime("%Y-%m-%d")


def format_date_for_mysql(date_str):
    date = _parse_date(date_str)
    return date.strftime("%Y-%m-%d") if date else None


# --- SHARE SPLIT (single source of truth for franchiseeShare / ourShare) ---
# Confirmed business rule: 60% franchisee / 40% company for invoices before
# the April 2026 rate change, 75% franchisee / 25% company from April 2026
# onward. Effective date is the invoice's billDate (falls back to today if
# billDate is missing, so brand-new invoices always get the current rate).
# NOTE: this does NOT touch the pre-existing ~56.25%/18.75% rows already in
# the DB for the pre-April period — those are known-bad historical data,
# explicitly left alone for now per product decision; this function only
# governs invoices computed/recomputed going forward.
RATE_CHANGE_DATE = datetime(2026, 4, 1, tzinfo=timezone.utc)


def get_share_split(bill_date) -> dict:
    effective_date = _parse_date(bill_date) or datetime.now(timezone.utc)
    if effective_date.tzinfo is None:
        effective_date = effective_date.replace(tzinfo=timezone.utc)

    is_pre_april_2026 = effective_date < RATE_CHANGE_DATE
    if is_pre_april_2026:
        return {"franchisee_pct": 0.6, "company_pct": 0.4}
    return {"franchisee_pct": 0.75, "company_pct": 0.25}


def calculate_shares(service_charges, info, bill_date, is_manual_override=False, manual_franchisee_share=None, manual_our_share=None) -> dict:
    """Computes franchiseeShare and ourShare from serviceCharges, respecting
    the info-status overrides (cancelled/reversed/legal = 0 company share,
    PP = half company share) that already existed in the create-invoice logic.
    franchiseeShare is always the full franchisee percentage regardless of
    info status — only the company (ourShare) side varies by status.

    If is_manual_override is True, franchisee_share and our_share are taken directly
    from manual_franchisee_share and manual_our_share.
    """
    if is_manual_override:
        try:
            f_share = float(manual_franchisee_share) if manual_franchisee_share is not None else 0
        except (TypeError, ValueError):
            f_share = 0
        try:
            o_share = float(manual_our_share) if manual_our_share is not None else 0
        except (TypeError, ValueError):
            o_share = 0
        return {"franchisee_share": f_share, "our_share": o_share}

    try:
        sc = float(service_charges)
    except (TypeError, ValueError):
        sc = 0

    if not sc:
        return {"franchisee_share": 0, "our_share": 0}

    split = get_share_split(bill_date)
    franchisee_pct = split["franchisee_pct"]
    company_pct = split["company_pct"]

    franchisee_share = round(sc * franchisee_pct)

    if info in ("CN", "RV", "LEGAL-CN", "LEGAL"):
        our_share = 0
    elif info == "PP":
        our_share = round(sc * company_pct * 0.5)
    else:
        # "0", "PR", "R", and any other/default status
        # Remainder, not an independent round() — franchiseeShare + ourShare
        # always sums to exactly `sc`, no +/-1 drift.
        our_share = int(sc - franchisee_share)

    return {"franchisee_share": franchisee_share, "our_share": our_share}
