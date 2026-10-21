"""
backend/finance_rules.py
Single Source of Truth for Financial Formulas, Normalization, and Calculations across Saarthi360 / Fintective.

Accepted accounting standards:
- Revenue = SUM(rev_ex_gst) where is_revenue is True
- Company income (Our share) = SUM(ourShare) over clean invoices
- Franchisee share = SUM(franchiseeShare) over revenue invoices
- Unallocated = Revenue - (Our share on revenue rows) - (Franchisee share on revenue rows)
- Net = Our share - Operating Expenses - Salaries
- Income Tax = 25% * MAX(0, Net)
- Surplus = Net - Income Tax
- Margin = Surplus / Our share (or Net / Our share)
- Royalty is a pass-through: never added as an operating expense
"""

import re
import datetime

# Standard Info Types
REVENUE_INFO_TYPES = ('R', 'PR', 'O')
NON_REVENUE_INFO_TYPES = ('CN', 'LEGAL-CN', 'LEGAL', 'RV')
FLAGGED_INFO_TYPES = ('C', '')

# Accounting constants
DEFAULT_INCOME_TAX_RATE = 0.25
DEFAULT_GST_RATE = 0.18
BENCHMARK_COMPANY_SHARE_RATE = 0.25
BENCHMARK_FRANCHISEE_SHARE_RATE = 0.75
TENURE_3PLUS_COMPANY_SHARE_RATE = 0.30
TENURE_3PLUS_FRANCHISEE_SHARE_RATE = 0.70

def get_franchisee_tenure_split(years_completed=None, onboarding_date=None, bill_date=None):
    """
    Business rule:
    - Franchisees who have completed 3+ years: 70% Franchisee / 30% Company (70-30)
    - Franchisees who have not completed 3 years (< 3 years): 75% Franchisee / 25% Company (75-25)
    """
    if years_completed is not None:
        try:
            if float(years_completed) >= 3.0:
                return {'franchisee_pct': 0.70, 'company_pct': 0.30}
            return {'franchisee_pct': 0.75, 'company_pct': 0.25}
        except (ValueError, TypeError):
            pass

    if onboarding_date:
        try:
            ref_dt = datetime.datetime.strptime(str(bill_date)[:10], '%Y-%m-%d') if bill_date else datetime.datetime.now()
            onb_dt = datetime.datetime.strptime(str(onboarding_date)[:10], '%Y-%m-%d')
            years = ref_dt.year - onb_dt.year - ((ref_dt.month, ref_dt.day) < (onb_dt.month, onb_dt.day))
            if years >= 3:
                return {'franchisee_pct': 0.70, 'company_pct': 0.30}
            return {'franchisee_pct': 0.75, 'company_pct': 0.25}
        except Exception:
            pass

    return {'franchisee_pct': 0.75, 'company_pct': 0.25}

# Historical data-driven fallback ourShare rates (SUM(ourShare) / SUM(rev_ex_gst) on R/PR/O invoices)
# FY24-25: 14,623,739.00 / 80,286,097.91 = 0.182145 (18.2% on R rows)
# FY25-26: 17,031,669.00 / 82,634,443.04 = 0.206109 (19.5% on R rows)
# FY26-27: 14,360,509.00 / 51,119,354.93 = 0.280921 (28.2% on R rows)
HISTORICAL_OUR_SHARE_RATIOS = {
    '2024-2025': 0.1821,
    '2025-2026': 0.1950,
    '2026-2027': 0.2820
}

def normalize_fy(val, date_str=None):
    """
    Standardizes any fiscal year string or date to 'YYYY-YYYY' (e.g. '2025-2026').
    Handles short forms ('2025-26', '25-26', 'FY 2025-26') and derives from date if needed.
    Returns 'N/A' if unable to determine.
    """
    if val is not None:
        s = str(val).strip()
        # Remove 'FY' or 'fy' prefix if present
        s = re.sub(r'^(?:FY|fy)\s*', '', s).strip()
        
        # Format: YYYY-YYYY (e.g. 2025-2026)
        m4 = re.match(r'^(\d{4})[-/](\d{4})$', s)
        if m4:
            y1 = int(m4.group(1))
            y2 = int(m4.group(2))
            if y2 == y1 + 1:
                return f"{y1}-{y2}"
            if y1 == y2:
                return f"{y1}-{y1 + 1}"
            return f"{y1}-{y2}"

        # Format: YYYY-YY (e.g. 2025-26)
        m2 = re.match(r'^(\d{4})[-/](\d{2})$', s)
        if m2:
            y1 = int(m2.group(1))
            suffix = int(m2.group(2))
            century = (y1 // 100) * 100
            y2 = century + suffix
            return f"{y1}-{y2}"

        # Format: YY-YY (e.g. 25-26)
        myy = re.match(r'^(\d{2})[-/](\d{2})$', s)
        if myy:
            y1 = 2000 + int(myy.group(1))
            y2 = 2000 + int(myy.group(2))
            return f"{y1}-{y2}"

        # 4 digit year only (e.g. 2025 -> 2025-2026)
        if s.isdigit() and len(s) == 4:
            y = int(s)
            return f"{y}-{y + 1}"

    if date_str:
        try:
            d_clean = str(date_str)[:10].strip()
            # Try YYYY-MM-DD
            dt = datetime.datetime.strptime(d_clean, '%Y-%m-%d')
            y = dt.year
            return f"{y}-{y + 1}" if dt.month >= 4 else f"{y - 1}-{y}"
        except Exception:
            pass

    return 'N/A'


def fy_to_date_range(fy):
    """
    Given an FY string (e.g. '2026-2027' or 'FY 2026-27'), returns ('YYYY-04-01', 'YYYY-03-31').
    """
    norm = normalize_fy(fy)
    if norm != 'N/A':
        try:
            y1 = int(norm.split('-')[0])
            return f"{y1}-04-01", f"{y1 + 1}-03-31"
        except Exception:
            pass
    # Fallback to current Indian FY
    today = datetime.date.today()
    y = today.year if today.month >= 4 else today.year - 1
    return f"{y}-04-01", f"{y + 1}-03-31"


def is_revenue_info(info):
    """
    Determines if an invoice's info code qualifies as commercial revenue.
    - R, PR, O = Revenue (True)
    - CN, LEGAL-CN, LEGAL, RV = Not revenue (False)
    - C and blank = Flagged / excluded from revenue by default (False)
    """
    if info is None or str(info).strip() == '':
        return False
    u = str(info).strip().upper()
    return u not in NON_REVENUE_INFO_TYPES and u not in FLAGGED_INFO_TYPES


def ex_gst(service_charges, total_bill_amt):
    """
    Computes ex-GST revenue from serviceCharges or totalBillAmt.
    Formula: COALESCE(NULLIF(serviceCharges, 0), ROUND(totalBillAmt / 1.18, 2), 0)
    """
    try:
        sc = float(service_charges or 0.0)
        if sc > 0:
            return round(sc, 2)
    except (ValueError, TypeError):
        pass

    try:
        tb = float(total_bill_amt or 0.0)
        if tb > 0:
            return round(tb / 1.18, 2)
    except (ValueError, TypeError):
        pass

    return 0.0


def fallback_our_share_rate(fy):
    """
    Returns data-driven ourShare ratio for an FY (for enquiries with NO invoice row).
    Uses verified historical ratio if available; falls back to 0.25 (25%).
    """
    norm = normalize_fy(fy)
    if norm in HISTORICAL_OUR_SHARE_RATIOS:
        return HISTORICAL_OUR_SHARE_RATIOS[norm]
    return BENCHMARK_COMPANY_SHARE_RATE


def calculate_waterfall(
    revenue=0.0,
    our_share=0.0,
    franchisee_share=0.0,
    operating_expenses=0.0,
    salary=0.0,
    our_share_revenue_rows=None,
    franchisee_share_revenue_rows=None,
    cash_received=0.0,
    total_bill_amt=None,
    expenses=None,
    salaries=None
):
    """
    Single unified financial waterfall engine.
    
    Returns standard dictionary with:
    - revenue: ex-GST revenue from revenue invoices
    - billed_incl_gst: total billed amount incl GST
    - gst: calculated or reported GST (pass-through)
    - our_share: total company income across clean invoices
    - franchisee_share: total franchisee share on revenue invoices
    - unallocated: revenue - our_share_rev - franchisee_share_rev (never profit)
    - net: our_share - operating_expenses - salary
    - tax: 25% of net (if net > 0 else 0)
    - surplus: net - tax
    - margin_pct: (surplus / our_share) * 100
    - cash_received: cash collected
    """
    if expenses is not None:
        operating_expenses = expenses
    if salaries is not None:
        salary = salaries

    rev = round(float(revenue or 0.0), 2)
    os_tot = round(float(our_share or 0.0), 2)
    fs_tot = round(float(franchisee_share or 0.0), 2)
    opex = round(float(operating_expenses or 0.0), 2)
    sal = round(float(salary or 0.0), 2)
    cash = round(float(cash_received or 0.0), 2)

    os_rev = round(float(our_share_revenue_rows if our_share_revenue_rows is not None else os_tot), 2)
    fs_rev = round(float(franchisee_share_revenue_rows if franchisee_share_revenue_rows is not None else fs_tot), 2)

    # Unallocated is strictly: Revenue - our_share_on_revenue - franchisee_share_on_revenue
    unallocated = round(max(0.0, rev - os_rev - fs_rev), 2)

    # Billed incl GST
    if total_bill_amt is not None and float(total_bill_amt) > 0:
        billed_incl_gst = round(float(total_bill_amt), 2)
        gst = round(max(0.0, billed_incl_gst - rev), 2)
    else:
        billed_incl_gst = round(rev * 1.18, 2)
        gst = round(billed_incl_gst - rev, 2)

    # Net = Company Income (Our Share) - Operating Expenses - Salaries
    # (Franchisee royalty is a pass-through: NEVER added as an expense)
    net = round(os_tot - opex - sal, 2)

    # Income tax = 25% of MAX(0, Net)
    tax = round(net * DEFAULT_INCOME_TAX_RATE, 2) if net > 0 else 0.0

    # Surplus = Net - Tax
    surplus = round(net - tax, 2)

    # Margin = Profit / Company Income (or 0 if income <= 0)
    margin_pct = round((surplus / os_tot) * 100.0, 2) if os_tot > 0 else 0.0

    # Salary ratio = (Salary / Our Share) * 100
    salary_ratio_pct = round((sal / os_tot) * 100.0, 2) if os_tot > 0 else 0.0

    return {
        'revenue': rev,
        'billed_incl_gst': billed_incl_gst,
        'gst': gst,
        'our_share': os_tot,
        'our_share_revenue_rows': os_rev,
        'our_share_residual_rows': round(max(0.0, os_tot - os_rev), 2),
        'franchisee_share': fs_tot,
        'franchisee_share_revenue_rows': fs_rev,
        'unallocated': unallocated,
        'operating_expenses': opex,
        'salary': sal,
        'net': net,
        'tax': tax,
        'surplus': surplus,
        'margin_pct': margin_pct,
        'salary_ratio_pct': salary_ratio_pct,
        'cash_received': cash
    }
