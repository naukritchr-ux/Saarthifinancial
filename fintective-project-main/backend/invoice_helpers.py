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
# Business rule:
# - Franchisees who have completed 3 years (>= 3 years tenure): 70% franchisee / 30% company (70 - 30).
# - Franchisees who have NOT completed 3 years (< 3 years tenure): 75% franchisee / 25% company (75 - 25).

_FRANCHISEE_ONBOARD_CACHE = {}
_FRANCHISEE_CACHE_INITIALIZED = False


def _init_franchisee_onboard_cache():
    global _FRANCHISEE_ONBOARD_CACHE, _FRANCHISEE_CACHE_INITIALIZED
    if _FRANCHISEE_CACHE_INITIALIZED:
        return
    try:
        from db import get_db_connection
        conn = get_db_connection()
        try:
            with conn.cursor() as cursor:
                cursor.execute("SELECT LOWER(TRIM(nameAsPerAgreement)) AS name, onboardingDate, created_at FROM franchisees WHERE nameAsPerAgreement IS NOT NULL AND nameAsPerAgreement != ''")
                rows = cursor.fetchall()
                for r in rows:
                    n = r.get('name')
                    d = r.get('onboardingDate') or r.get('created_at')
                    if n and d:
                        _FRANCHISEE_ONBOARD_CACHE[n] = str(d)
                _FRANCHISEE_CACHE_INITIALIZED = True
        finally:
            conn.close()
    except Exception:
        pass


def get_franchisee_onboarding_date(franchise_name: str):
    """Looks up onboardingDate or earliest record date for a franchisee from DB."""
    if not franchise_name:
        return None

    clean_name = franchise_name.strip().lower()
    if clean_name in _FRANCHISEE_ONBOARD_CACHE:
        return _FRANCHISEE_ONBOARD_CACHE[clean_name]

    if not _FRANCHISEE_CACHE_INITIALIZED:
        _init_franchisee_onboard_cache()
        if clean_name in _FRANCHISEE_ONBOARD_CACHE:
            return _FRANCHISEE_ONBOARD_CACHE[clean_name]

    try:
        from db import get_db_connection

        conn = get_db_connection()
        try:
            with conn.cursor() as cursor:
                # 1. Check franchisees table
                cursor.execute(
                    "SELECT onboardingDate, created_at FROM franchisees WHERE LOWER(TRIM(nameAsPerAgreement)) = %s LIMIT 1",
                    [clean_name],
                )
                row = cursor.fetchone()
                if row and row.get("onboardingDate"):
                    _FRANCHISEE_ONBOARD_CACHE[clean_name] = str(row["onboardingDate"])
                    return _FRANCHISEE_ONBOARD_CACHE[clean_name]

                # 2. Check enquiries table for earliest allocation, bill date, or created_at
                cursor.execute(
                    "SELECT MIN(COALESCE(bill_date, dateOfAllocation, created_at)) AS min_date FROM enquiries WHERE LOWER(TRIM(franchiseeName)) = %s",
                    [clean_name],
                )
                row_enq = cursor.fetchone()
                if row_enq and row_enq.get("min_date"):
                    _FRANCHISEE_ONBOARD_CACHE[clean_name] = str(row_enq["min_date"])
                    return _FRANCHISEE_ONBOARD_CACHE[clean_name]

                if row and row.get("created_at"):
                    _FRANCHISEE_ONBOARD_CACHE[clean_name] = str(row["created_at"])
                    return _FRANCHISEE_ONBOARD_CACHE[clean_name]
        finally:
            conn.close()
    except Exception:
        pass

    _FRANCHISEE_ONBOARD_CACHE[clean_name] = None
    return None


def get_share_split(
    bill_date=None,
    franchise_name=None,
    onboarding_date=None,
    years_completed=None,
) -> dict:
    """Returns {'franchisee_pct': float, 'company_pct': float}.
    Business rule:
    - Completed 3 years (>= 3 years tenure): 70% franchisee / 30% company (70 - 30).
    - Not completed 3 years (< 3 years tenure): 75% franchisee / 25% company (75 - 25).
    """
    if years_completed is not None:
        try:
            if float(years_completed) >= 3.0:
                return {"franchisee_pct": 0.70, "company_pct": 0.30}
            return {"franchisee_pct": 0.75, "company_pct": 0.25}
        except (TypeError, ValueError):
            pass

    effective_date = _parse_date(bill_date) or datetime.now(timezone.utc)
    if hasattr(effective_date, "tzinfo") and effective_date.tzinfo is not None:
        effective_date = effective_date.astimezone(timezone.utc).replace(tzinfo=None)

    start_dt = _parse_date(onboarding_date)
    if start_dt is None and franchise_name:
        resolved_onboard = get_franchisee_onboarding_date(franchise_name)
        start_dt = _parse_date(resolved_onboard)

    if start_dt:
        if hasattr(start_dt, "tzinfo") and start_dt.tzinfo is not None:
            start_dt = start_dt.astimezone(timezone.utc).replace(tzinfo=None)

        # Full completed years
        years = (
            effective_date.year
            - start_dt.year
            - (
                (effective_date.month, effective_date.day)
                < (start_dt.month, start_dt.day)
            )
        )
        if years >= 3:
            return {"franchisee_pct": 0.70, "company_pct": 0.30}
        else:
            return {"franchisee_pct": 0.75, "company_pct": 0.25}

    # Default for franchisees who haven't completed 3 years (or new onboarding)
    return {"franchisee_pct": 0.75, "company_pct": 0.25}


from decimal import Decimal, ROUND_HALF_UP


def calculate_shares(
    service_charges,
    info,
    bill_date=None,
    is_manual_override=False,
    manual_franchisee_share=None,
    manual_our_share=None,
    franchise_name=None,
    onboarding_date=None,
    years_completed=None,
) -> dict:
    """Computes franchiseeShare and ourShare from serviceCharges, respecting
    the info-status overrides (cancelled/reversed/legal = 0 company share,
    PP = half company share) and franchisee tenure (70-30 for >= 3 years, 75-25 for < 3 years).
    franchiseeShare is always the full franchisee percentage regardless of
    info status — only the company (ourShare) side varies by status.

    Uses standard accounting rounding (ROUND_HALF_UP) via decimal.Decimal.
    If is_manual_override is True, franchisee_share and our_share are taken directly
    from manual_franchisee_share and manual_our_share.
    """
    if is_manual_override:
        try:
            f_share = (
                int(round(float(manual_franchisee_share)))
                if manual_franchisee_share is not None
                else 0
            )
        except (TypeError, ValueError):
            f_share = 0
        try:
            o_share = (
                int(round(float(manual_our_share)))
                if manual_our_share is not None
                else 0
            )
        except (TypeError, ValueError):
            o_share = 0
        return {"franchisee_share": f_share, "our_share": o_share}

    try:
        sc_dec = Decimal(str(service_charges or 0))
    except Exception:
        sc_dec = Decimal("0")

    if sc_dec <= Decimal("0"):
        return {"franchisee_share": 0, "our_share": 0}

    split = get_share_split(
        bill_date=bill_date,
        franchise_name=franchise_name,
        onboarding_date=onboarding_date,
        years_completed=years_completed,
    )
    franchisee_pct = Decimal(str(split["franchisee_pct"]))
    company_pct = Decimal(str(split["company_pct"]))

    # Standard accounting rounding (round half up)
    f_share_exact = sc_dec * franchisee_pct
    franchisee_share = int(
        f_share_exact.quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    )

    if info in ("CN", "RV", "LEGAL-CN", "LEGAL"):
        our_share = 0
    elif info == "PP":
        o_share_exact = sc_dec * company_pct * Decimal("0.5")
        our_share = int(
            o_share_exact.quantize(Decimal("1"), rounding=ROUND_HALF_UP)
        )
    else:
        # "0", "PR", "R", and any other/default status
        # Remainder ensures franchiseeShare + ourShare always sums to exactly `sc`
        sc_int = int(sc_dec.quantize(Decimal("1"), rounding=ROUND_HALF_UP))
        our_share = int(sc_int - franchisee_share)

    return {"franchisee_share": franchisee_share, "our_share": our_share}
