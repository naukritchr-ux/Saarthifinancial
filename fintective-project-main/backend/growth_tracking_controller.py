import os
import uuid
import datetime
import math
import statistics
import time
import threading
from flask import Blueprint, request, jsonify
from db import get_db_connection
from finance_rules import (
    get_franchisee_tenure_split,
    calculate_waterfall,
    fallback_our_share_rate,
    normalize_fy
)

growth_tracking_bp = Blueprint("growth_tracking", __name__)

# High-performance thread-safe in-memory cache system (TTL 180s)
_RESPONSE_CACHE = {}
_CACHE_LOCK = threading.Lock()

def _get_cached(key):
    with _CACHE_LOCK:
        entry = _RESPONSE_CACHE.get(key)
        if entry and entry[1] > time.time():
            return entry[0]
        return None

def _set_cached(key, data, ttl_seconds=180):
    with _CACHE_LOCK:
        _RESPONSE_CACHE[key] = (data, time.time() + ttl_seconds)

def _clear_cache_prefix(prefix=""):
    global _RESPONSE_CACHE
    with _CACHE_LOCK:
        if not prefix:
            _RESPONSE_CACHE.clear()
        else:
            _RESPONSE_CACHE = {k: v for k, v in _RESPONSE_CACHE.items() if not k.startswith(prefix)}

_ENTITY_CONV_CACHE = {}
_FRANCHISEE_TRACK_CACHE = {}



USE_DEMO_FALLBACK_DATA = False


def _get_entity_aliases(cursor, entity_type, entity_id, explicit_name=None):
    """
    Returns a list of all valid alias strings for the given entity to ensure complete match across tables.
    """
    aliases = set()
    clean_id = str(entity_id).strip() if entity_id else ""
    if clean_id:
        aliases.add(clean_id)
        aliases.add(clean_id.lower())

    if explicit_name and explicit_name.strip() and explicit_name.strip().lower() != 'undefined':
        aliases.add(explicit_name.strip())
        aliases.add(explicit_name.strip().lower())

    if entity_type in ('employee', 'bd_agent'):
        try:
            # 1. Check employees table
            cursor.execute("SELECT id, canonical_name FROM employees WHERE id = %s OR LOWER(canonical_name) = %s LIMIT 1", [clean_id, clean_id.lower()])
            emp = cursor.fetchone()
            emp_id = emp['id'] if emp else None
            if emp:
                aliases.add(emp['canonical_name'])
                aliases.add(emp['canonical_name'].lower())

            # 2. Check employee_aliases table
            if not emp_id:
                cursor.execute("SELECT employee_id FROM employee_aliases WHERE LOWER(alias_name) = %s LIMIT 1", [clean_id.lower()])
                al_row = cursor.fetchone()
                if al_row:
                    emp_id = al_row['employee_id']

            if emp_id:
                cursor.execute("SELECT alias_name FROM employee_aliases WHERE employee_id = %s", [emp_id])
                for row in cursor.fetchall():
                    aliases.add(row['alias_name'])
                    aliases.add(row['alias_name'].lower())
        except Exception:
            pass

    return [a for a in aliases if a]


def _resolve_entity_info(cursor, entity_type, entity_id, explicit_name=None):
    """Resolves human-readable entity name and details."""
    if entity_type == 'company':
        return "Overall Company (Full Agency Portfolio)"

    if explicit_name and explicit_name.strip() and explicit_name.strip().lower() != 'undefined':
        return explicit_name.strip()

    clean_id = str(entity_id).strip()
    entity_name = clean_id

    if entity_type == 'franchisee':
        try:
            cursor.execute("SELECT nameAsPerAgreement, teamLeaderName FROM franchisees WHERE id = %s OR LOWER(nameAsPerAgreement) = %s LIMIT 1", [clean_id, clean_id.lower()])
            row = cursor.fetchone()
            if row and row.get('nameAsPerAgreement'):
                return row['nameAsPerAgreement'].strip()
        except Exception:
            pass

        if clean_id.lower().startswith('f-'):
            sub_id = clean_id[2:]
            if sub_id.isdigit():
                try:
                    cursor.execute("SELECT nameAsPerAgreement FROM franchisees WHERE id = %s LIMIT 1", [int(sub_id)])
                    row = cursor.fetchone()
                    if row and row.get('nameAsPerAgreement'):
                        return row['nameAsPerAgreement'].strip()
                except Exception:
                    pass

        try:
            cursor.execute("SELECT DISTINCT franchiseName FROM invoice WHERE LOWER(TRIM(franchiseName)) = %s LIMIT 1", [clean_id.lower()])
            row = cursor.fetchone()
            if row and row.get('franchiseName'):
                return row['franchiseName'].strip()
        except Exception:
            pass

    elif entity_type in ('bd_agent', 'employee'):
        try:
            cursor.execute("SELECT canonical_name FROM employees WHERE id = %s OR LOWER(canonical_name) = %s LIMIT 1", [clean_id, clean_id.lower()])
            row = cursor.fetchone()
            if row and row.get('canonical_name'):
                return row['canonical_name'].strip()
        except Exception:
            pass

        try:
            cursor.execute("""
                SELECT e.canonical_name 
                FROM employees e
                JOIN employee_aliases a ON e.id = a.employee_id
                WHERE LOWER(TRIM(a.alias_name)) = %s LIMIT 1
            """, [clean_id.lower()])
            row = cursor.fetchone()
            if row and row.get('canonical_name'):
                return row['canonical_name'].strip()
        except Exception:
            pass

        if entity_type == 'bd_agent':
            try:
                cursor.execute("SELECT name FROM bd_agents WHERE id = %s OR LOWER(name) = %s LIMIT 1", [clean_id, clean_id.lower()])
                row = cursor.fetchone()
                if row and row.get('name'):
                    return row['name'].strip()
            except Exception:
                pass

    return entity_name


def _normalize_fy(raw):
    """
    Normalizes fiscal year string to standard 'YYYY-YY' format (e.g. '2025-26').
    Removes bogus '2025-2025' buckets and merges split financial year representations.
    """
    if not raw:
        return '2025-26'
    s = str(raw).strip()
    if s.upper().startswith('FY'):
        s = s[2:].strip()
    import re
    # Match YYYY-YYYY (e.g. 2025-2026 or bogus 2025-2025)
    m_full = re.match(r'^(\d{4})-(\d{4})$', s)
    if m_full:
        p1 = m_full.group(1)
        p2 = m_full.group(2)
        if p1 == p2:
            # Bogus '2025-2025' -> '2025-26'
            y = int(p1)
            return f"{y}-{str(y+1)[2:]}"
        return f"{p1}-{p2[2:]}"
    # Match YYYY-YY (e.g. 2025-26)
    m_short = re.match(r'^(\d{4})-(\d{2})$', s)
    if m_short:
        return s
    # Match 4-digit year (e.g. 2025 -> 2025-26)
    if len(s) == 4 and s.isdigit():
        y = int(s)
        return f"{y}-{str(y+1)[2:]}"
    return s


def _fetch_historical_revenue_and_stats(cursor, entity_type, entity_id, entity_name):
    """
    Pulls historical yearly and monthly revenue metrics, deal volume, and history duration.

    DATA SPECIFICATION:
    - Single source of truth: v_invoice_clean with is_revenue = 1 (credit notes, RV, and cancelled items excluded).
    - Financial Year: Grouped strictly by derived FY from billDate (Apr-Mar), formatted as 'YYYY-YY'.
    - Unified Revenue Measure: rev_ex_gst across all entities (company, BD, TL, franchise).
    - Deal Count: COUNT(DISTINCT i.billNumber).
    - Series Points: Marked with is_complete (False for the current partial FY) and months_elapsed.
      For the current partial FY, run_rate_projection = (YTD / months_elapsed) * 12 is calculated.
    """
    historical_series = []
    monthly_series = []
    months_of_history = 0

    aliases = _get_entity_aliases(cursor, entity_type, entity_id, entity_name)
    if not aliases:
        aliases = [entity_name, str(entity_id)]

    placeholders = ", ".join(["%s"] * len(aliases))

    today = datetime.date.today()
    cur_fy_start = today.year if today.month >= 4 else today.year - 1
    cur_months_elapsed = today.month - 3 if today.month >= 4 else today.month + 9

    where_parts = [
        "i.is_revenue = 1",
        "i.billDate IS NOT NULL",
        "TRIM(i.billDate) != ''"
    ]
    params = []

    if entity_type == 'company':
        pass
    elif entity_type == 'franchisee':
        where_parts.append(f"""(
            LOWER(TRIM(i.franchiseName)) IN ({placeholders}) 
            OR i.franchiseName IN ({placeholders})
            OR LOWER(TRIM(e.franchiseeName)) IN ({placeholders})
            OR e.franchiseeName IN ({placeholders})
        )""")
        params.extend([a.lower() for a in aliases] + list(aliases) + [a.lower() for a in aliases] + list(aliases))
    elif entity_type in ('tl', 'team_leader'):
        where_parts.append(f"""(
            LOWER(TRIM(i.teamLeader)) IN ({placeholders})
            OR i.teamLeader IN ({placeholders})
            OR LOWER(TRIM(e.teamLeaderName)) IN ({placeholders})
            OR e.teamLeaderName IN ({placeholders})
        )""")
        params.extend([a.lower() for a in aliases] + list(aliases) + [a.lower() for a in aliases] + list(aliases))
    else:  # bd_agent, employee, bd
        where_parts.append(f"""(
            LOWER(TRIM(i.nameOfBd)) IN ({placeholders}) 
            OR i.nameOfBd IN ({placeholders})
            OR LOWER(TRIM(e.bdMemberName)) IN ({placeholders})
            OR e.bdMemberName IN ({placeholders})
            OR LOWER(TRIM(i.teamLeader)) IN ({placeholders})
            OR i.teamLeader IN ({placeholders})
            OR LOWER(TRIM(e.teamLeaderName)) IN ({placeholders})
            OR e.teamLeaderName IN ({placeholders})
        )""")
        params.extend(([a.lower() for a in aliases] + list(aliases)) * 4)

    try:
        where_sql = " AND ".join(where_parts)
        query = f"""
            SELECT 
                CASE 
                    WHEN MONTH(i.billDate) >= 4 
                        THEN CONCAT(YEAR(i.billDate), '-', LPAD(RIGHT(YEAR(i.billDate) + 1, 2), 2, '0'))
                    ELSE 
                        CONCAT(YEAR(i.billDate) - 1, '-', LPAD(RIGHT(YEAR(i.billDate), 2), 2, '0'))
                END AS derived_fy,
                COUNT(DISTINCT i.billNumber) AS deals_count,
                SUM(COALESCE(i.rev_ex_gst, 0.0)) AS total_rev_ex_gst
            FROM v_invoice_clean i
            LEFT JOIN enquiries e ON i.enquiry_id = e.id
            WHERE {where_sql}
            GROUP BY derived_fy
            ORDER BY derived_fy ASC
        """
        cursor.execute(query, params)
        rows = cursor.fetchall()

        for r in rows:
            fy_label = r.get('derived_fy')
            if not fy_label or len(fy_label) < 4:
                continue
            try:
                start_year = int(fy_label[:4])
            except ValueError:
                continue

            rev = round(float(r['total_rev_ex_gst'] or 0.0), 2)
            deals = int(r['deals_count'] or 0)
            is_complete = start_year < cur_fy_start

            if is_complete:
                m_elapsed = 12
                run_rate_proj = None
            elif start_year == cur_fy_start:
                m_elapsed = cur_months_elapsed
                run_rate_proj = round((rev / m_elapsed) * 12, 2) if m_elapsed > 0 else rev
            else:
                m_elapsed = 0
                run_rate_proj = None

            historical_series.append({
                'period': fy_label,
                'revenue': rev,
                'net_revenue': rev,
                'deals_count': deals,
                'is_complete': is_complete,
                'months_elapsed': m_elapsed,
                'run_rate_projection': run_rate_proj
            })

        # Monthly stats from v_invoice_clean (rev_ex_gst and distinct billNumber)
        m_query = f"""
            SELECT 
                SUBSTRING(i.billDate, 1, 7) AS month_str,
                COUNT(DISTINCT i.billNumber) AS deals_count,
                SUM(COALESCE(i.rev_ex_gst, 0.0)) AS monthly_revenue
            FROM v_invoice_clean i
            LEFT JOIN enquiries e ON i.enquiry_id = e.id
            WHERE {where_sql}
            GROUP BY month_str
            ORDER BY month_str ASC
        """
        cursor.execute(m_query, params)
        m_rows = cursor.fetchall()
        for mr in m_rows:
            if mr.get('month_str'):
                monthly_series.append({
                    'month': str(mr['month_str']),
                    'deals': int(mr['deals_count'] or 0),
                    'revenue': round(float(mr['monthly_revenue'] or 0.0), 2)
                })
        months_of_history = len(monthly_series)

    except Exception as e:
        raise RuntimeError(f"Database query failed while fetching historical data for {entity_type} '{entity_name}': {e}")

    return historical_series, monthly_series, months_of_history


def _calculate_cagr(historical_series):
    """
    Calculates Compound Annual Growth Rate strictly from COMPLETED financial years.
    Returns None if fewer than 2 completed financial years exist, or if any year in the
    calculation window has revenue <= 0. Clamped to [-50%, +50%].
    """
    if not historical_series:
        return None

    # Filter strictly for completed financial years with positive revenue
    completed_fys = [
        pt for pt in historical_series
        if pt.get('is_complete') and float(pt.get('revenue') or 0.0) > 0
    ]

    if len(completed_fys) < 2:
        return None

    # Use the last 2-3 completed financial years
    window = completed_fys[-3:] if len(completed_fys) >= 3 else completed_fys[-2:]

    first_val = float(window[0].get('revenue') or 0.0)
    last_val = float(window[-1].get('revenue') or 0.0)
    periods = len(window) - 1

    if first_val <= 0 or last_val <= 0 or periods <= 0:
        return None

    # Verify no intermediate completed FY in window has revenue <= 0
    for pt in window:
        if float(pt.get('revenue') or 0.0) <= 0:
            return None

    try:
        raw_cagr = math.pow(last_val / first_val, 1.0 / periods) - 1.0
        # Realistic CAGR clamping to [-50%, +50%] to prevent bootstrap distortions
        return max(-0.50, min(0.50, raw_cagr))
    except Exception:
        return None


def _compute_productivity_score(monthly_series, months_of_history, peer_p90_deals=2.5, peer_p90_rev=150000.0):
    """
    Computes transparent Productivity Index (0-100) and 4-component breakdown:
    ProductivityIndex = 0.35·Volume + 0.30·Revenue + 0.20·Momentum + 0.15·Consistency
    """
    if months_of_history < 3 or not monthly_series:
        # Default new hire score
        return {
            'productivity_index': 52.0,
            'badge': 'Rising Talent ⚡',
            'badge_key': 'rising_talent',
            'components': {
                'volume': 50.0,
                'revenue': 50.0,
                'momentum': 65.0,
                'consistency': 50.0
            },
            'peer_p90': {
                'deals_per_month': peer_p90_deals,
                'revenue_per_month': peer_p90_rev
            }
        }

    # 1. Volume & Revenue per month
    total_deals = sum(m['deals'] for m in monthly_series)
    total_rev = sum(m['revenue'] for m in monthly_series)
    emp_deals_per_mo = total_deals / max(1, len(monthly_series))
    emp_rev_per_mo = total_rev / max(1, len(monthly_series))

    volume_score = 100.0 * min(1.0, emp_deals_per_mo / max(0.1, peer_p90_deals))
    revenue_score = 100.0 * min(1.0, emp_rev_per_mo / max(1000.0, peer_p90_rev))

    # 2. Momentum (recent 3mo vs prior 3mo)
    recent_3 = monthly_series[-3:] if len(monthly_series) >= 3 else monthly_series
    prior_3 = monthly_series[-6:-3] if len(monthly_series) >= 6 else []

    recent_3_avg = sum(m['revenue'] for m in recent_3) / max(1, len(recent_3))
    if prior_3:
        prior_3_avg = sum(m['revenue'] for m in prior_3) / len(prior_3)
        if prior_3_avg > 0:
            growth_ratio = (recent_3_avg - prior_3_avg) / prior_3_avg
            clamped_ratio = max(-1.0, min(1.0, growth_ratio))
            momentum_score = 50.0 + (50.0 * clamped_ratio)
        else:
            momentum_score = 65.0
    else:
        momentum_score = 65.0

    # 3. Consistency (1 - stddev / mean over trailing 6mo)
    trailing_6 = monthly_series[-6:] if len(monthly_series) >= 6 else monthly_series
    deal_counts = [m['deals'] for m in trailing_6]
    if len(deal_counts) >= 2:
        mean_deals = statistics.mean(deal_counts)
        stdev_deals = statistics.stdev(deal_counts)
        if mean_deals > 0:
            consistency_score = max(0.0, 100.0 * (1.0 - (stdev_deals / mean_deals)))
        else:
            consistency_score = 50.0
    else:
        consistency_score = 60.0

    # 4. Final Weighted Index
    prod_index = (0.35 * volume_score) + (0.30 * revenue_score) + (0.20 * momentum_score) + (0.15 * consistency_score)
    prod_index = round(max(0.0, min(100.0, prod_index)), 1)

    # 5. Badge assignment
    if prod_index >= 80.0:
        badge = 'Top Performer 🌟'
        badge_key = 'top_performer'
    elif prod_index >= 60.0:
        badge = 'Consistent Producer 📈'
        badge_key = 'consistent_producer'
    elif (prod_index >= 40.0 and momentum_score > 50.0) or (months_of_history < 3):
        badge = 'Rising Talent ⚡'
        badge_key = 'rising_talent'
    else:
        badge = 'Requires Acceleration ⚠️'
        badge_key = 'requires_acceleration'

    return {
        'productivity_index': prod_index,
        'badge': badge,
        'badge_key': badge_key,
        'components': {
            'volume': round(volume_score, 1),
            'revenue': round(revenue_score, 1),
            'momentum': round(momentum_score, 1),
            'consistency': round(consistency_score, 1)
        },
        'peer_p90': {
            'deals_per_month': peer_p90_deals,
            'revenue_per_month': peer_p90_rev
        }
    }


def generate_target_letter(entity_name, entity_type, growth_pct_target, base_value, target_value, salary_target, period_start, period_end, guidelines):
    """
    Generates a structured, professional growth target memo.
    """
    if entity_type == 'franchisee':
        type_label = "Franchise Partner"
    elif entity_type == 'bd_agent':
        type_label = "Business Development Executive"
    else:
        type_label = "Internal Talent & Recruitment Consultant"

    growth_pct_str = f"{(growth_pct_target * 100):.1f}%"
    salary_clause = f"\n• Target Compensation Benchmark: ₹{salary_target:,.2f} per month" if salary_target and salary_target > 0 else ""
    
    letter = f"""================================================================================
FINTECTIVE FINANCIAL REVENUE NETWORK — PERFORMANCE TARGET MEMO
================================================================================
Date of Issue : {datetime.date.today().strftime('%B %d, %Y')}
Recipient     : {entity_name} ({type_label})
Target Period : {period_start} to {period_end}
--------------------------------------------------------------------------------

Dear {entity_name},

As part of Fintective's growth acceleration strategy for the upcoming fiscal cycle,
we are pleased to formalize your agreed performance milestone and revenue targets.

1. PERFORMANCE TARGET SUMMARY
--------------------------------------------------------------------------------
• Current Baseline Billing Revenue : ₹{base_value:,.2f}
• Target Growth Rate              : {growth_pct_str}
• Projected Target Revenue (Gross): ₹{target_value:,.2f}
• Evaluation Horizon              : {period_start} through {period_end}{salary_clause}

2. STRATEGIC GUIDELINES & CAREER PROGRESSION PRIORITIES
--------------------------------------------------------------------------------
{guidelines if guidelines and guidelines.strip() else 'Focus on expanding candidate placements, maintaining high client retention, and optimizing pipeline realization rates across all allocated mandates.'}

3. TERMS OF PERFORMANCE EVALUATION
--------------------------------------------------------------------------------
Upon completion of the period ending {period_end}, actual revenue achievement
will be audited against this target. Tier advancements, career milestones,
and performance appraisals will be determined directly by productivity realization.

Authorized Signatory,
Management Board & Finance Committee
Fintective Intelligence Network
================================================================================"""
    return letter.strip()


def generate_outcome_letter(entity_name, entity_type, growth_pct_target, target_value, actual_growth_pct, actual_value, salary_target, period_start, period_end, kra_summary):
    """
    Generates an official outcome audit letter comparing targets to actuals.
    """
    if entity_type == 'franchisee':
        type_label = "Franchise Partner"
    elif entity_type == 'bd_agent':
        type_label = "Business Development Executive"
    else:
        type_label = "Internal Talent & Recruitment Consultant"

    target_pct_str = f"{(growth_pct_target * 100):.1f}%"
    actual_pct_str = f"{(actual_growth_pct * 100):.1f}%"
    variance_val = actual_value - (target_value or 0.0)
    variance_pct = ((actual_growth_pct - growth_pct_target) * 100)
    
    if variance_val >= 0 or variance_pct >= 0:
        outcome_status = f"TARGET EXCEEDED (+₹{max(0, variance_val):,.2f} / +{max(0, variance_pct):.1f}% over goal)"
        verdict = "EXCEPTIONAL PERFORMANCE"
    else:
        outcome_status = f"UNDER TARGET (-₹{abs(variance_val):,.2f} / {abs(variance_pct):.1f}% shortfall)"
        verdict = "TARGET REVIEW REQUIRED"

    letter = f"""================================================================================
FINTECTIVE FINANCIAL REVENUE NETWORK — PERFORMANCE OUTCOME AUDIT
================================================================================
Audit Date    : {datetime.date.today().strftime('%B %d, %Y')}
Recipient     : {entity_name} ({type_label})
Target Period : {period_start} to {period_end}
--------------------------------------------------------------------------------

Dear {entity_name},

This document formalizes the comprehensive financial and operational performance
audit for the completed cycle ({period_start} to {period_end}).

1. TARGET VS ACTUAL PERFORMANCE AUDIT
--------------------------------------------------------------------------------
• Agreed Growth Target    : {target_pct_str}
• Target Value (Gross)    : ₹{target_value:,.2f}
• Actual Growth Realized  : {actual_pct_str}
• Actual Revenue Realized : ₹{actual_value:,.2f}
• Outcome Status          : {outcome_status}
• Final Performance Rating: {verdict}

2. KEY RESULT AREA (KRA) & QUALITATIVE EVALUATION
--------------------------------------------------------------------------------
{kra_summary if kra_summary and kra_summary.strip() else 'Performance metrics audited based on closed invoice realization, pipeline processing, and operational efficiency.'}

3. NEXT STEPS & RECORDING
--------------------------------------------------------------------------------
This outcome report has been recorded in the central Fintective financial registry.
Updated targets for the next cycle will be calculated according to these certified results.

Certified by,
Audit & Performance Review Board
Fintective Intelligence Network
================================================================================"""
    return letter.strip()


# --------------------------------------------------------------------------
# 1. GET /api/growth-targets/roster (Unified Roster Endpoint)
# --------------------------------------------------------------------------
@growth_tracking_bp.route("/api/growth-targets/roster", methods=["GET"])
def get_entity_roster():
    entity_type = request.args.get("entity_type", "employee").strip().lower()
    include_inactive = request.args.get("include_inactive", "false").strip().lower() in ("true", "1", "yes")

    cache_key = f"roster_{entity_type}_{include_inactive}"
    cached_val = _get_cached(cache_key)
    if cached_val is not None:
        return jsonify(cached_val)

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        roster = []

        if entity_type == 'franchisee':
            cursor.execute("SELECT id, nameAsPerAgreement as name, status, created_at FROM franchisees")
            f_rows = cursor.fetchall()
            for r in f_rows:
                f_name = r['name']
                hist, monthly, months = _fetch_historical_revenue_and_stats(cursor, 'franchisee', r['id'], f_name)
                tot_rev = sum(h['revenue'] for h in hist)
                tot_deals = sum(h['deals_count'] for h in hist)
                cagr = _calculate_cagr(hist)
                roster.append({
                    'id': str(r['id']),
                    'name': f_name,
                    'canonical_name': f_name,
                    'type': 'franchisee',
                    'role': 'Franchise Partner',
                    'status': r.get('status') or 'active',
                    'months_of_history': months,
                    'total_revenue': tot_rev,
                    'total_deals': tot_deals,
                    'historical_cagr': cagr,
                    'confidence': 'high' if months >= 6 else ('low' if months >= 3 else 'insufficient_data')
                })

        elif entity_type in ('bd_agent', 'bd_specialist', 'bd'):
            # 1. Fetch all distinct BD member names from enquiries
            cursor.execute("""
                SELECT DISTINCT e.bdMemberName as name, COUNT(*) as deal_cnt
                FROM enquiries e
                WHERE e.bdMemberName IS NOT NULL AND TRIM(e.bdMemberName) != ''
                  AND LOWER(TRIM(e.bdMemberName)) NOT IN ('head office', 'head  - office', 'unknown', 'prospect', '')
                GROUP BY e.bdMemberName
                ORDER BY deal_cnt DESC
            """)
            enquiry_bds = cursor.fetchall()

            # 2. Also fetch from employees table where role is bd_specialist
            cursor.execute("SELECT id, canonical_name, role, status FROM employees WHERE role = 'bd_specialist'")
            emp_bds = cursor.fetchall()
            
            seen_names = set()
            bd_candidates = []

            # Prioritize dedicated BD agents/employees
            for r in emp_bds:
                cname = r['canonical_name'].strip()
                seen_names.add(cname.lower())
                bd_candidates.append({
                    'id': str(r['id']),
                    'name': cname,
                    'role': 'BD Specialist',
                    'status': r.get('status') or 'active'
                })

            # Add all other active BD contributors from enquiries
            for r in enquiry_bds:
                raw_name = r['name'].strip()
                resolved = _resolve_entity_info(cursor, 'employee', raw_name)
                canonical = str(resolved).strip() if resolved else raw_name
                if canonical.lower() not in seen_names and raw_name.lower() not in seen_names:
                    seen_names.add(canonical.lower())
                    seen_names.add(raw_name.lower())
                    
                    emp_id = f"bd-{len(bd_candidates)+1}"
                    emp_status = 'active'
                    try:
                        cursor.execute("SELECT id, status FROM employees WHERE LOWER(TRIM(canonical_name)) = %s LIMIT 1", [canonical.lower()])
                        emp_row = cursor.fetchone()
                        if emp_row:
                            emp_id = str(emp_row['id'])
                            emp_status = emp_row.get('status') or 'active'
                    except Exception:
                        pass

                    bd_candidates.append({
                        'id': emp_id,
                        'name': canonical,
                        'role': 'BD Member',
                        'status': emp_status
                    })

            for b in bd_candidates:
                hist, monthly, months = _fetch_historical_revenue_and_stats(cursor, 'bd_agent', b['id'], b['name'])
                tot_rev = sum(h['revenue'] for h in hist)
                tot_deals = sum(h['deals_count'] for h in hist)
                cagr = _calculate_cagr(hist)
                score_data = _compute_productivity_score(monthly, months)
                roster.append({
                    'id': str(b['id']),
                    'name': b['name'],
                    'canonical_name': b['name'],
                    'type': 'bd_agent',
                    'role': b['role'],
                    'status': b['status'],
                    'months_of_history': months,
                    'total_revenue': tot_rev,
                    'total_deals': tot_deals,
                    'historical_cagr': cagr,
                    'productivity_index': score_data['productivity_index'],
                    'badge': score_data['badge'],
                    'badge_key': score_data['badge_key'],
                    'confidence': 'high' if months >= 6 else ('low' if months >= 3 else 'insufficient_data')
                })

            # Sort by total revenue and total deals descending so top BDs appear first
            roster.sort(key=lambda x: (x['total_deals'], x['total_revenue']), reverse=True)

        elif entity_type in ('team_leader', 'tl', 'team_leaders'):
            # 1. Fetch all distinct Team Leader names from enquiries
            cursor.execute("""
                SELECT DISTINCT e.teamLeaderName as name, COUNT(*) as deal_cnt
                FROM enquiries e
                WHERE e.teamLeaderName IS NOT NULL AND TRIM(e.teamLeaderName) != ''
                  AND LOWER(TRIM(e.teamLeaderName)) NOT IN ('head office', 'head  - office', 'unknown', 'prospect', '')
                GROUP BY e.teamLeaderName
                ORDER BY deal_cnt DESC
            """)
            enquiry_tls = cursor.fetchall()

            # 2. Base Team Leaders roster
            DEFAULT_TLS = [
                {'id': 'tl-1', 'name': 'Avadai Esakki Muthu Sundaram Marthuvar', 'role': 'Senior Team Leader'},
                {'id': 'tl-2', 'name': 'Surbhi Vinod Jain', 'role': 'Team Leader'},
                {'id': 'tl-3', 'name': 'Joyeeta Joydeb Khaskel', 'role': 'Team Leader'},
                {'id': 'tl-4', 'name': 'Vedika Girish Tolani', 'role': 'Team Leader'},
                {'id': 'tl-5', 'name': 'Pooja Sharma', 'role': 'Team Leader'},
                {'id': 'tl-6', 'name': 'Rajesh Patil', 'role': 'Team Leader'}
            ]

            seen_names = set()
            tl_candidates = []

            for t in DEFAULT_TLS:
                cname = t['name'].strip()
                seen_names.add(cname.lower())
                tl_candidates.append({
                    'id': t['id'],
                    'name': cname,
                    'role': t['role'],
                    'status': 'active'
                })

            for r in enquiry_tls:
                raw_name = r['name'].strip()
                if raw_name.lower() not in seen_names:
                    seen_names.add(raw_name.lower())
                    tl_candidates.append({
                        'id': f"tl-{len(tl_candidates)+1}",
                        'name': raw_name,
                        'role': 'Team Leader',
                        'status': 'active'
                    })

            for tl in tl_candidates:
                hist, monthly, months = _fetch_historical_revenue_and_stats(cursor, 'tl', tl['id'], tl['name'])
                tot_rev = sum(h['revenue'] for h in hist)
                tot_deals = sum(h['deals_count'] for h in hist)
                cagr = _calculate_cagr(hist)
                score_data = _compute_productivity_score(monthly, months)
                roster.append({
                    'id': str(tl['id']),
                    'name': tl['name'],
                    'canonical_name': tl['name'],
                    'type': 'team_leader',
                    'role': tl['role'],
                    'status': tl['status'],
                    'months_of_history': months,
                    'total_revenue': tot_rev,
                    'total_deals': tot_deals,
                    'historical_cagr': cagr,
                    'productivity_index': score_data['productivity_index'],
                    'badge': score_data['badge'],
                    'badge_key': score_data['badge_key'],
                    'confidence': 'high' if months >= 6 else ('low' if months >= 3 else 'insufficient_data')
                })

            roster.sort(key=lambda x: (x['total_deals'], x['total_revenue']), reverse=True)

        else: # employee / internal team
            status_clause = "" if include_inactive else "WHERE e.status = 'active'"
            query = f"""
                SELECT e.id, e.canonical_name, e.role, e.status, e.hire_date
                FROM employees e
                {status_clause}
                {"AND" if status_clause else "WHERE"} e.role != 'bd_specialist'
                ORDER BY e.canonical_name ASC
            """
            cursor.execute(query)
            rows = cursor.fetchall()
            for r in rows:
                hist, monthly, months = _fetch_historical_revenue_and_stats(cursor, 'employee', r['id'], r['canonical_name'])
                tot_rev = sum(h['revenue'] for h in hist)
                tot_deals = sum(h['deals_count'] for h in hist)
                cagr = _calculate_cagr(hist)
                score_data = _compute_productivity_score(monthly, months)
                roster.append({
                    'id': str(r['id']),
                    'name': r['canonical_name'],
                    'canonical_name': r['canonical_name'],
                    'type': 'employee',
                    'role': r['role'],
                    'status': r['status'],
                    'months_of_history': months,
                    'total_revenue': tot_rev,
                    'total_deals': tot_deals,
                    'historical_cagr': cagr,
                    'productivity_index': score_data['productivity_index'],
                    'badge': score_data['badge'],
                    'badge_key': score_data['badge_key'],
                    'confidence': 'high' if months >= 6 else ('low' if months >= 3 else 'insufficient_data')
                })

        # Default sort by revenue / deals
        roster.sort(key=lambda x: (x.get('total_revenue') or 0.0, x.get('total_deals') or 0), reverse=True)
        _set_cached(cache_key, roster, ttl_seconds=180)
        return jsonify({'entity_type': entity_type, 'roster': roster})
    except Exception as e:
        print(f"[get_entity_roster] Error: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()


# --------------------------------------------------------------------------
# 1B. GET /api/growth-targets/company-breakdown (Live Team Leader Breakdown for Macro Multiplier)
# --------------------------------------------------------------------------
@growth_tracking_bp.route("/api/growth-targets/company-breakdown", methods=["GET"])
def get_company_growth_breakdown():
    """
    Computes live company-wide breakdown by Team Leader from actual invoices & franchisees.
    Provides live deals, total billing, company share, and registered active franchises.
    """
    raw_fy = request.args.get("financial_year", "").strip()
    # --- SQLi guard: normalize and validate the financial_year parameter ---
    import re as _re
    if raw_fy:
        fy = normalize_fy(raw_fy)
        if fy == 'N/A' or not _re.match(r'^\d{4}-\d{4}$', fy):
            return jsonify({'error': 'Invalid financial_year parameter. Expected format: YYYY-YYYY (e.g. 2025-2026).'}), 400
    else:
        fy = ""
    # -----------------------------------------------------------------------
    cache_key = f"company_breakdown_{fy}"
    cached_val = _get_cached(cache_key)
    if cached_val is not None:
        return jsonify(cached_val)

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # 1. Registered active franchises per TL
        cursor.execute("""
            SELECT 
                TRIM(teamLeaderName) as tl_name,
                COUNT(*) as active_franchises
            FROM franchisees
            WHERE status = 'Active' AND teamLeaderName IS NOT NULL AND TRIM(teamLeaderName) != ''
            GROUP BY TRIM(teamLeaderName)
        """)
        franchise_map = {}
        for r in cursor.fetchall():
            cname = " ".join(r['tl_name'].split()).lower()
            franchise_map[cname] = r['active_franchises']

        # 2. Deals and billing from invoices
        if fy:
            inv_sql = """
                SELECT 
                    TRIM(teamLeader) as tl_name,
                    COUNT(*) as deals_all,
                    SUM(totalBillAmt) as billing_all,
                    SUM(ourShare) as our_share_all,
                    COUNT(CASE WHEN financialYear = '2025-2026' THEN 1 END) as deals_fy26,
                    SUM(CASE WHEN financialYear = '2025-2026' THEN totalBillAmt ELSE 0 END) as billing_fy26,
                    SUM(CASE WHEN financialYear = '2025-2026' THEN ourShare ELSE 0 END) as our_share_fy26,
                    COUNT(DISTINCT CASE WHEN financialYear = '2025-2026' THEN franchiseName END) as billing_stores_fy26,
                    COUNT(DISTINCT franchiseName) as billing_stores_all
                FROM invoice
                WHERE teamLeader IS NOT NULL AND TRIM(teamLeader) != ''
                  AND LOWER(TRIM(teamLeader)) NOT IN ('head office', 'head  - office', 'unknown', 'prospect', 'old . tl', 'pune . office')
                  AND financialYear = %s
                GROUP BY TRIM(teamLeader)
                ORDER BY deals_fy26 DESC
            """
            cursor.execute(inv_sql, (fy,))
        else:
            inv_sql = """
                SELECT 
                    TRIM(teamLeader) as tl_name,
                    COUNT(*) as deals_all,
                    SUM(totalBillAmt) as billing_all,
                    SUM(ourShare) as our_share_all,
                    COUNT(CASE WHEN financialYear = '2025-2026' THEN 1 END) as deals_fy26,
                    SUM(CASE WHEN financialYear = '2025-2026' THEN totalBillAmt ELSE 0 END) as billing_fy26,
                    SUM(CASE WHEN financialYear = '2025-2026' THEN ourShare ELSE 0 END) as our_share_fy26,
                    COUNT(DISTINCT CASE WHEN financialYear = '2025-2026' THEN franchiseName END) as billing_stores_fy26,
                    COUNT(DISTINCT franchiseName) as billing_stores_all
                FROM invoice
                WHERE teamLeader IS NOT NULL AND TRIM(teamLeader) != ''
                  AND LOWER(TRIM(teamLeader)) NOT IN ('head office', 'head  - office', 'unknown', 'prospect', 'old . tl', 'pune . office')
                GROUP BY TRIM(teamLeader)
                ORDER BY deals_fy26 DESC
            """
            cursor.execute(inv_sql)
        tl_rows = cursor.fetchall()

        total_billing_fy26 = sum(float(r['billing_fy26'] or 0) for r in tl_rows) or 1.0
        total_deals_fy26 = sum(int(r['deals_fy26'] or 0) for r in tl_rows)
        total_our_share_fy26 = sum(float(r['our_share_fy26'] or 0) for r in tl_rows)

        # 3. Net retention rate: derived directly from FY-specific ourShare vs gross billing
        # Uses only the current financial year's invoices to get the correct rate.
        # Avoids the "all-time average" bias where older years with different splits skew the number.
        # FY 2025-26 actual: ~15.35%  (vs wrong all-time average 19.11%)
        net_retention_rate = round(total_our_share_fy26 / total_billing_fy26, 4) if total_billing_fy26 > 0 else 0.153

        # Also compute the rate only from invoices that HAVE ourShare filled (for better accuracy on missing rows)
        try:
            fy_filter = fy if fy else '2025-2026'
            cursor.execute("""
                SELECT 
                    SUM(COALESCE(ourShare, 0)) as fy_our,
                    SUM(COALESCE(totalBillAmt, serviceCharges, 0)) as fy_gross,
                    COUNT(CASE WHEN ourShare > 0 THEN 1 END) as filled_count,
                    COUNT(*) as total_count
                FROM invoice
                WHERE financialYear = %s
                  AND teamLeader IS NOT NULL AND TRIM(teamLeader) != ''
                  AND LOWER(TRIM(teamLeader)) NOT IN ('head office', 'head  - office', 'unknown', 'prospect', 'old . tl', 'pune . office')
                  AND (serviceCharges > 0 OR totalBillAmt > 0)
            """, (fy_filter,))
            fy_share_row = cursor.fetchone()
            if fy_share_row and float(fy_share_row['fy_gross'] or 0) > 0:
                fy_our = float(fy_share_row['fy_our'] or 0)
                fy_gross = float(fy_share_row['fy_gross'] or 1)
                net_retention_rate = round(fy_our / fy_gross, 4)
        except Exception as nre:
            print(f"[company_breakdown] FY-specific net_retention_rate calc error: {nre}")

        results = []
        for r in tl_rows:
            raw_name = r['tl_name']
            cleaned_name = " ".join(raw_name.split())
            active_f = franchise_map.get(cleaned_name.lower()) or r['billing_stores_fy26'] or 1
            billing = float(r['billing_fy26'] or 0)
            deals = int(r['deals_fy26'] or 0)
            share = round(billing / total_billing_fy26, 4) if total_billing_fy26 > 0 else 0.0
            tl_our_share = float(r['our_share_fy26'] or 0)
            # TL-specific net retention rate (actual ourShare / actual billing for this TL this FY)
            tl_net_retention = round(tl_our_share / billing, 4) if billing > 0 else net_retention_rate

            results.append({
                'name': cleaned_name,
                'raw_name': raw_name,
                'active_franchises': active_f,
                'billing_stores': int(r['billing_stores_fy26'] or 0),
                'deals': deals,
                'deals_all_time': int(r['deals_all'] or 0),
                'billing': billing,
                'billing_all_time': float(r['billing_all'] or 0),
                'our_share': tl_our_share,
                'share_of_billing': share,
                'net_retention_rate': tl_net_retention
            })

        response_data = {
            'success': True,
            'financial_year': fy or '2025-2026',
            'total_deals': total_deals_fy26,
            'total_billing': total_billing_fy26,
            'total_our_share': total_our_share_fy26,   # direct sum of ourShare column
            'net_retention_rate': net_retention_rate,  # FY-specific: ourShare / totalBillAmt
            'team_leaders': results
        }
        _set_cached(cache_key, response_data, ttl_seconds=180)
        return jsonify(response_data)
    except Exception as e:
        print(f"[get_company_growth_breakdown] Error: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()


# --------------------------------------------------------------------------
# 2. GET /api/growth-targets/predict (5-Year Predictive Horizon & Scorecard)
# --------------------------------------------------------------------------
@growth_tracking_bp.route("/api/growth-targets/predict", methods=["GET"])
def predict_growth():
    entity_type = request.args.get("entity_type", "employee").strip().lower()
    entity_id = request.args.get("entity_id", "").strip()
    periods_count = int(request.args.get("periods", "5")) # Default to 5 years
    custom_rate = request.args.get("rate") or request.args.get("growth_rate") or request.args.get("target_rate") or request.args.get("custom_rate")
    entity_name_param = request.args.get("entity_name", "")

    if not entity_id:
        return jsonify({"error": "Missing required entity_id parameter"}), 400

    print(f"[predict_growth] entity_type={entity_type}, entity_id={entity_id}, received rate param: {custom_rate!r}")

    cache_key = f"predict_{entity_type}_{entity_id}_{entity_name_param}_{periods_count}_{custom_rate}"
    cached_val = _get_cached(cache_key)
    if cached_val is not None:
        return jsonify(cached_val)

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        entity_name = _resolve_entity_info(cursor, entity_type, entity_id, request.args.get("entity_name"))
        historical_series, monthly_series, months_of_history = _fetch_historical_revenue_and_stats(cursor, entity_type, entity_id, entity_name)
        
        # Calculate Productivity Score
        score_data = _compute_productivity_score(monthly_series, months_of_history)

        # Baseline and CAGR must use COMPLETED financial years only
        is_new_hire = (months_of_history < 3) or (not historical_series)
        completed_fys = [
            pt for pt in historical_series
            if pt.get('is_complete') and float(pt.get('revenue') or 0.0) > 0
        ]

        historical_cagr = _calculate_cagr(historical_series)

        if len(completed_fys) == 0:
            return jsonify({
                'entity_type': entity_type,
                'entity_id': entity_id,
                'entity_name': entity_name,
                'projection_status': 'insufficient_data',
                'insufficient_data': True,
                'note': 'Not enough completed financial years (minimum 2 required)',
                'is_new_hire': is_new_hire,
                'months_of_history': months_of_history,
                'confidence': 'insufficient_data',
                'productivity_score': score_data,
                'base_revenue': 0.0,
                'current_deals_count': 0,
                'current_monthly_deals': 0.0,
                'avg_revenue_per_deal': 0.0,
                'historical_cagr': None,
                'historical_cagr_pct': None,
                'applied_rate': 0.15,
                'applied_rate_pct': 15.0,
                'historical_series': historical_series or [],
                'projections': [],
                'scenarios': {}
            })

        # Authoritative baseline from the most recent completed financial year
        base_revenue = float(completed_fys[-1].get('revenue') or 0.0)
        deal_base = int(completed_fys[-1].get('deals_count') or 0)
        base_period = completed_fys[-1].get('period')
        confidence = 'high' if len(completed_fys) >= 2 else 'moderate'
        cagr_note = None if historical_cagr is not None else 'Not enough completed financial years (minimum 2 required)'

        # Target growth rate R
        if custom_rate is not None and str(custom_rate).strip() != "":
            try:
                val = float(custom_rate)
                if val > 1.0 and val <= 500.0:
                    selected_r = val / 100.0
                else:
                    selected_r = val
            except ValueError:
                selected_r = historical_cagr if (historical_cagr is not None and historical_cagr > 0) else 0.15
        else:
            selected_r = historical_cagr if (historical_cagr is not None and historical_cagr > 0) else 0.15

        print(f"[predict_growth] Computed selected_r={selected_r:.4f} ({selected_r*100:.1f}%) for entity={entity_name}")

        # 5-Year Forward Projections (t=1..5): projected[t] = base * (1 + R)^t
        projections = []
        cumulative_rev = 0.0

        for t in range(1, periods_count + 1):
            multiplier = math.pow(1.0 + selected_r, t)
            proj_val = base_revenue * multiplier
            incremental = proj_val - base_revenue
            cumulative_rev += proj_val
            proj_deals = max(1, int(round(deal_base * multiplier)))

            projections.append({
                'year_index': t,
                'period_label': f"Year +{t}",
                'projected_revenue': round(proj_val, 2),
                'growth_pct': round((multiplier - 1.0) * 100, 2),
                'incremental_gain': round(incremental, 2),
                'projected_deals': proj_deals,
                'cumulative_revenue': round(cumulative_rev, 2)
            })

        # 5-Year Scale Simulator Scenarios (1x through 5x)
        scenarios = {
            f'scale{m}x': {
                'multiplier': m,
                'label': f"{m}x {'Current Base' if m == 1 else 'Scale'}",
                'revenue': round(base_revenue * m, 2),
                'estimated_net': round(base_revenue * m * fallback_our_share_rate('2025-2026'), 2),
                'deals_target': max(1, int(round(deal_base * m)))
            }
            for m in range(1, 6)
        }

        return jsonify({
            'entity_type': entity_type,
            'entity_id': entity_id,
            'entity_name': entity_name,
            'projection_status': 'new_hire_target' if is_new_hire else 'active_projection',
            'insufficient_data': False,
            'is_new_hire': is_new_hire,
            'months_of_history': months_of_history,
            'confidence': confidence,
            'productivity_score': score_data,
            'base_revenue': round(base_revenue, 2),
            'base_period': base_period,
            'current_deals_count': deal_base,
            'current_monthly_deals': round(deal_base / 12.0, 1),
            'avg_revenue_per_deal': round(base_revenue / max(1, deal_base), 2),
            'historical_cagr': round(historical_cagr, 4) if historical_cagr is not None else None,
            'historical_cagr_pct': round(historical_cagr * 100, 2) if historical_cagr is not None else None,
            'cagr_note': cagr_note,
            'applied_rate': round(selected_r, 4),
            'applied_rate_pct': round(selected_r * 100, 2),
            'historical_series': historical_series,
            'projections': projections,
            'scenarios': scenarios
        })
    except Exception as e:
        print(f"[predict_growth] Error: {e}")
        return jsonify({'error': f'Failed to calculate growth predictions: {str(e)}'}), 500
    finally:
        try:
            if 'conn' in locals() and conn:
                conn.close()
        except Exception:
            pass


# --------------------------------------------------------------------------
# 3. POST /api/growth-targets (Create target memo)
# --------------------------------------------------------------------------
def _ensure_growth_targets_table(cursor):
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS growth_targets (
            id VARCHAR(100) PRIMARY KEY,
            entity_type VARCHAR(50) NOT NULL,
            entity_id VARCHAR(100) NOT NULL,
            growth_pct_target DECIMAL(10, 4) NOT NULL,
            salary_target DECIMAL(15, 2) NULL,
            period_start VARCHAR(100) NOT NULL,
            period_end VARCHAR(100) NOT NULL,
            guidelines TEXT NULL,
            status VARCHAR(50) DEFAULT 'active',
            actual_growth_pct DECIMAL(10, 4) NULL,
            actual_value DECIMAL(15, 2) NULL,
            kra_summary TEXT NULL,
            target_letter_text MEDIUMTEXT NULL,
            outcome_letter_text MEDIUMTEXT NULL,
            target_letter_sent_at VARCHAR(100) NULL,
            outcome_recorded_at VARCHAR(100) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_gt_entity (entity_type, entity_id),
            INDEX idx_gt_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """)
    for col_sql in [
        "ALTER TABLE growth_targets ADD COLUMN target_placements INT NULL",
        "ALTER TABLE growth_targets ADD COLUMN target_revenue DECIMAL(15, 2) NULL",
        "ALTER TABLE growth_targets ADD COLUMN target_author VARCHAR(50) NULL",
        "ALTER TABLE growth_targets ADD COLUMN updated_by VARCHAR(100) NULL",
        "ALTER TABLE growth_targets ADD COLUMN financial_year VARCHAR(50) NULL",
        "ALTER TABLE growth_targets ADD COLUMN metric_type VARCHAR(50) DEFAULT 'deals'"
    ]:
        try:
            cursor.execute(col_sql)
        except Exception:
            pass

@growth_tracking_bp.route("/api/growth-targets", methods=["POST"])
def create_growth_target():
    data = request.get_json() or {}
    entity_type = data.get("entity_type", "employee").strip().lower()
    entity_id = str(data.get("entity_id", "")).strip()
    growth_pct_target = float(data.get("growth_pct_target", 0.0))
    salary_target = float(data.get("salary_target")) if data.get("salary_target") is not None and str(data.get("salary_target")).strip() != "" else None
    period_start = data.get("period_start", "").strip() or "2026-04-01"
    period_end = data.get("period_end", "").strip() or "2027-03-31"
    guidelines = data.get("guidelines", "").strip()

    target_placements = int(data.get("target_placements")) if data.get("target_placements") is not None and str(data.get("target_placements")).strip() != "" else None
    target_revenue = float(data.get("target_revenue")) if data.get("target_revenue") is not None and str(data.get("target_revenue")).strip() != "" else None
    target_author = str(data.get("target_author", "self")).strip()
    updated_by = str(data.get("updated_by", "system")).strip()
    financial_year = str(data.get("financial_year", "")).strip()
    metric_type = str(data.get("metric_type", "deals")).strip()

    if not entity_id:
        return jsonify({"error": "Missing required field: entity_id"}), 400

    normalized_growth = growth_pct_target / 100.0 if growth_pct_target > 1.0 else growth_pct_target
    target_id = f"gt-{uuid.uuid4().hex[:10]}"
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        _ensure_growth_targets_table(cursor)
        entity_name = _resolve_entity_info(cursor, entity_type, entity_id, data.get("entity_name"))
        historical_series, _, _ = _fetch_historical_revenue_and_stats(cursor, entity_type, entity_id, entity_name)
        base_value = historical_series[-1]['revenue'] if historical_series else 0.0
        target_value = target_revenue if target_revenue else (base_value * (1.0 + normalized_growth) if base_value > 0 else 0.0)

        letter_text = generate_target_letter(
            entity_name=entity_name,
            entity_type=entity_type,
            growth_pct_target=normalized_growth,
            base_value=base_value,
            target_value=target_value,
            salary_target=salary_target,
            period_start=period_start,
            period_end=period_end,
            guidelines=guidelines
        )

        now_str = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')

        # Supersede previous active targets for this profile and FY to ensure single active goal
        try:
            if financial_year:
                cursor.execute("""
                    UPDATE growth_targets 
                    SET status = 'superseded', updated_at = NOW()
                    WHERE (entity_id = %s OR LOWER(entity_id) = %s)
                      AND (financial_year = %s OR period_start = %s)
                      AND status = 'active'
                """, [entity_id, entity_id.lower(), financial_year, period_start])
            else:
                cursor.execute("""
                    UPDATE growth_targets 
                    SET status = 'superseded', updated_at = NOW()
                    WHERE (entity_id = %s OR LOWER(entity_id) = %s)
                      AND period_start = %s
                      AND status = 'active'
                """, [entity_id, entity_id.lower(), period_start])
        except Exception as e:
            print("supersede notice:", e)

        insert_sql = """
            INSERT INTO growth_targets (
                id, entity_type, entity_id, growth_pct_target, salary_target,
                period_start, period_end, guidelines, status,
                target_placements, target_revenue, target_author, updated_by,
                financial_year, metric_type,
                target_letter_text, target_letter_sent_at, created_at, updated_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        cursor.execute(insert_sql, [
            target_id,
            entity_type,
            entity_id,
            normalized_growth,
            salary_target,
            period_start,
            period_end,
            guidelines,
            'active',
            target_placements,
            target_revenue,
            target_author,
            updated_by,
            financial_year,
            metric_type,
            letter_text,
            now_str,
            now_str,
            now_str
        ])
        conn.commit()
        _clear_cache_prefix("growth_summary_")
        _clear_cache_prefix("roster_")
        _clear_cache_prefix("predict_")

        return jsonify({
            'success': True,
            'id': target_id,
            'entity_type': entity_type,
            'entity_id': entity_id,
            'entity_name': entity_name,
            'growth_pct_target': normalized_growth,
            'growth_pct_target_pct': round(normalized_growth * 100, 2),
            'base_value': round(base_value, 2),
            'target_value': round(target_value, 2),
            'target_placements': target_placements,
            'target_revenue': target_revenue,
            'target_author': target_author,
            'updated_by': updated_by,
            'financial_year': financial_year,
            'metric_type': metric_type,
            'salary_target': salary_target,
            'period_start': period_start,
            'period_end': period_end,
            'guidelines': guidelines,
            'status': 'active',
            'target_letter_text': letter_text,
            'created_at': now_str,
            'updated_at': now_str
        }), 201
    except Exception as e:
        print(f"[create_growth_target] Error: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@growth_tracking_bp.route("/api/growth-targets/<target_id>", methods=["DELETE"])
def delete_growth_target(target_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        _ensure_growth_targets_table(cursor)
        cursor.execute("UPDATE growth_targets SET status = 'cancelled', updated_at = NOW() WHERE id = %s", [target_id])
        conn.commit()
        _clear_cache_prefix("growth_summary_")
        _clear_cache_prefix("roster_")
        _clear_cache_prefix("predict_")
        return jsonify({'success': True, 'id': target_id, 'status': 'cancelled'})
    except Exception as e:
        print(f"[delete_growth_target] Error: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()


# --------------------------------------------------------------------------
# 3a. GET /api/growth-targets/filter-options (Distinct BD, TL, Franchise, FY lists)
# --------------------------------------------------------------------------
@growth_tracking_bp.route("/api/growth-targets/filter-options", methods=["GET"])
def get_growth_filter_options():
    cached_val = _get_cached("growth_filter_options")
    if cached_val is not None:
        return jsonify(cached_val)

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT DISTINCT TRIM(bdMemberName) as name
            FROM enquiries
            WHERE bdMemberName IS NOT NULL AND TRIM(bdMemberName) != ''
              AND LOWER(TRIM(bdMemberName)) NOT IN ('head office', 'head  - office', 'head - office', 'unknown', 'prospect', '')
            ORDER BY name ASC
        """)
        bds = [r['name'] for r in cursor.fetchall()]

        cursor.execute("""
            SELECT DISTINCT TRIM(teamLeaderName) as name
            FROM enquiries
            WHERE teamLeaderName IS NOT NULL AND TRIM(teamLeaderName) != ''
              AND LOWER(TRIM(teamLeaderName)) NOT IN ('head office', 'head  - office', 'head - office', 'unknown', 'prospect', '')
            ORDER BY name ASC
        """)
        tls = [r['name'] for r in cursor.fetchall()]

        cursor.execute("""
            SELECT DISTINCT TRIM(franchiseeName) as name
            FROM enquiries
            WHERE franchiseeName IS NOT NULL AND TRIM(franchiseeName) != ''
              AND LOWER(TRIM(franchiseeName)) NOT IN ('head office', 'head  - office', 'head - office', 'unknown', 'prospect', '')
            ORDER BY name ASC
        """)
        franchises = [r['name'] for r in cursor.fetchall()]

        res_data = {
            'bds': ['All'] + bds,
            'tls': ['All'] + tls,
            'franchises': ['All'] + franchises,
            'fys': ['FY 2026-27', 'FY 2025-26', 'FY 2024-25', 'FY 2023-24']
        }
        _set_cached("growth_filter_options", res_data, ttl_seconds=300)
        return jsonify(res_data)
    except Exception as e:
        print(f"[get_growth_filter_options] Error: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

# --------------------------------------------------------------------------
# 3b. GET /api/growth-targets/summary (Live enquiry-level summary for Growth targets)
# --------------------------------------------------------------------------
def _classify_backend_status(raw_status):
    st = str(raw_status or '').strip().lower()
    invoiced_set = {'closed', 'offered_and_accepted', 'invoiced', 'r', 'rv', 'billed', 'collected'}
    cancelled_set = {'cancelled', 'canceled', 'offered_and_rejected', 'internally_closed', 'credit_note', 'cn', 'legal-cn', 'legal_cn', 'c', 'void', 'dropped'}
    progressed_set = {'inprogress', 'in_progress', 'position_hold', 'revised', 'reallocation', 'pipeline', 'sourcing', 'interviewing'}
    
    if st in invoiced_set:
        return 'invoiced'
    elif st in cancelled_set:
        return 'cancelled'
    elif st in progressed_set:
        return 'progressed'
    else:
        return 'other'

def _format_inr_short(rev):
    val = float(rev or 0.0)
    if val >= 10000000:
        return f"₹{val / 10000000:.2f} Cr"
    elif val >= 100000:
        return f"₹{val / 100000:.1f}L"
    else:
        return f"₹{val:,.0f}"

DEFAULT_ESTIMATED_TAX_RATE = 0.25

def _calculate_money_box(invoiced_deals, total_invoiced_rev, req):
    """
    Computes real Money Box line items according to requirements:
    Revenue (gross billed amount from invoiced deals)
    Our share (real per-deal company share from invoices, verified vs unverified)
    Enforced on server-side: only returned to admin and manager roles.
    """
    user_role = (req.headers.get('X-User-Role') or req.args.get('role') or 'admin').strip().lower()
    if user_role not in ('admin', 'manager', 'head_office'):
        return None

    our_share_sum = 0.0
    verified_count = 0
    unverified_count = 0
    companies = set()

    for d in invoiced_deals:
        d_our = float(d.get('our_share') or 0.0)
        is_ver = bool(d.get('is_verified'))
        cname = (d.get('companyName') or '').strip()
        if cname:
            companies.add(cname.lower())

        our_share_sum += d_our
        if is_ver:
            verified_count += 1
        else:
            unverified_count += 1

    rev = round(float(total_invoiced_rev or 0.0), 2)
    our_share_sum = round(our_share_sum, 2)

    return {
        'revenue': rev,
        'our_share': our_share_sum,
        'verified_count': verified_count,
        'unverified_count': unverified_count,
        'deals_count': len(invoiced_deals),
        'company_count': len(companies),
        'tax_rate': DEFAULT_ESTIMATED_TAX_RATE,
        'tax_label': f"{int(DEFAULT_ESTIMATED_TAX_RATE * 100)}%"
    }


# --------------------------------------------------------------------------
# Money Box Manual Inputs API: GET & POST /api/growth-targets/money-box-inputs
# --------------------------------------------------------------------------
@growth_tracking_bp.route("/api/growth-targets/money-box-inputs", methods=["GET"])
def get_money_box_inputs():
    user_role = (request.headers.get('X-User-Role') or request.args.get('role') or 'admin').strip().lower()
    if user_role not in ('admin', 'manager', 'head_office'):
        return jsonify({'error': 'Unauthorized: Admin or Manager role required'}), 403

    bd = request.args.get('bd', 'All').strip() or 'All'
    tl = request.args.get('tl', 'All').strip() or 'All'
    franchise = request.args.get('franchise', 'All').strip() or 'All'
    fy = request.args.get('fy', 'FY 2026-27').strip() or 'FY 2026-27'

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS growth_money_box_inputs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                bd VARCHAR(255) NOT NULL DEFAULT 'All',
                tl VARCHAR(255) NOT NULL DEFAULT 'All',
                franchise VARCHAR(255) NOT NULL DEFAULT 'All',
                fy VARCHAR(50) NOT NULL DEFAULT 'FY 2026-27',
                expense DECIMAL(15, 2) NULL,
                salary DECIMAL(15, 2) NULL,
                net DECIMAL(15, 2) NULL,
                surplus DECIMAL(15, 2) NULL,
                updated_by VARCHAR(100) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uk_money_box (bd(100), tl(100), franchise(100), fy)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        """)

        cursor.execute("""
            SELECT expense, salary, net, surplus, updated_at
            FROM growth_money_box_inputs
            WHERE LOWER(TRIM(bd)) = %s AND LOWER(TRIM(tl)) = %s AND LOWER(TRIM(franchise)) = %s AND LOWER(TRIM(fy)) = %s
            LIMIT 1
        """, [bd.lower(), tl.lower(), franchise.lower(), fy.lower()])
        row = cursor.fetchone()
        if row:
            return jsonify({
                'bd': bd,
                'tl': tl,
                'franchise': franchise,
                'fy': fy,
                'expense': float(row['expense']) if row['expense'] is not None else None,
                'salary': float(row['salary']) if row['salary'] is not None else None,
                'net': float(row['net']) if row['net'] is not None else None,
                'surplus': float(row['surplus']) if row['surplus'] is not None else None,
                'updated_at': str(row['updated_at']) if row.get('updated_at') else None
            })
        else:
            return jsonify({
                'bd': bd,
                'tl': tl,
                'franchise': franchise,
                'fy': fy,
                'expense': None,
                'salary': None,
                'net': None,
                'surplus': None,
                'updated_at': None
            })
    except Exception as e:
        print(f"[get_money_box_inputs] Error: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()


@growth_tracking_bp.route("/api/growth-targets/money-box-inputs", methods=["POST"])
def save_money_box_inputs():
    user_role = (request.headers.get('X-User-Role') or request.args.get('role') or 'admin').strip().lower()
    if user_role not in ('admin', 'manager', 'head_office'):
        return jsonify({'error': 'Unauthorized: Admin or Manager role required'}), 403

    data = request.get_json() or {}
    bd = data.get('bd', 'All').strip() or 'All'
    tl = data.get('tl', 'All').strip() or 'All'
    franchise = data.get('franchise', 'All').strip() or 'All'
    fy = data.get('fy', 'FY 2026-27').strip() or 'FY 2026-27'

    parsed = {}
    for f in ('expense', 'salary', 'net', 'surplus'):
        val = data.get(f)
        if val is None or str(val).strip() == '':
            parsed[f] = None
        else:
            try:
                num = float(val)
                if num < 0:
                    return jsonify({'error': f'{f} must be a number greater than or equal to 0'}), 400
                parsed[f] = num
            except (ValueError, TypeError):
                return jsonify({'error': f'{f} must be a valid number'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS growth_money_box_inputs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                bd VARCHAR(255) NOT NULL DEFAULT 'All',
                tl VARCHAR(255) NOT NULL DEFAULT 'All',
                franchise VARCHAR(255) NOT NULL DEFAULT 'All',
                fy VARCHAR(50) NOT NULL DEFAULT 'FY 2026-27',
                expense DECIMAL(15, 2) NULL,
                salary DECIMAL(15, 2) NULL,
                net DECIMAL(15, 2) NULL,
                surplus DECIMAL(15, 2) NULL,
                updated_by VARCHAR(100) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uk_money_box (bd(100), tl(100), franchise(100), fy)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        """)

        cursor.execute("""
            INSERT INTO growth_money_box_inputs (bd, tl, franchise, fy, expense, salary, net, surplus, updated_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
                expense = VALUES(expense),
                salary = VALUES(salary),
                net = VALUES(net),
                surplus = VALUES(surplus),
                updated_by = VALUES(updated_by),
                updated_at = CURRENT_TIMESTAMP
        """, [bd, tl, franchise, fy, parsed['expense'], parsed['salary'], parsed['net'], parsed['surplus'], user_role])
        conn.commit()

        return jsonify({
            'success': True,
            'saved': {
                'bd': bd,
                'tl': tl,
                'franchise': franchise,
                'fy': fy,
                'expense': parsed['expense'],
                'salary': parsed['salary'],
                'net': parsed['net'],
                'surplus': parsed['surplus']
            }
        })
    except Exception as e:
        print(f"[save_money_box_inputs] Error: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()


# --------------------------------------------------------------------------
# Scope-Based Financial Performance Comparison API: POST /api/growth/compare
# --------------------------------------------------------------------------
@growth_tracking_bp.route("/api/growth/compare", methods=["POST"])
@growth_tracking_bp.route("/api/growth-targets/compare", methods=["POST"])
def compare_growth_scopes():
    user_role = (request.headers.get('X-User-Role') or request.args.get('role') or 'admin').strip().lower()
    if user_role not in ('admin', 'manager', 'head_office'):
        return jsonify({'error': 'Unauthorized: Admin or Manager role required'}), 403

    body = request.get_json(silent=True) or {}
    fy_str = (body.get('fy') or request.args.get('fy') or 'FY 2026-27').strip()
    raw_scopes = body.get('scopes')

    if raw_scopes is None:
        raw_scopes = [{
            'bd': body.get('bd') or request.args.get('bd') or 'All',
            'tl': body.get('tl') or request.args.get('tl') or 'All',
            'franchise': body.get('franchise') or body.get('fn') or request.args.get('franchise') or 'All'
        }]

    if not isinstance(raw_scopes, list) or len(raw_scopes) == 0:
        return jsonify({'error': 'scopes must be a non-empty array'}), 400

    if len(raw_scopes) > 4:
        return jsonify({'error': 'Maximum 4 scopes can be compared at once'}), 400

    import re
    match = re.search(r'(\d{4})', fy_str)
    if match:
        start_year = int(match.group(1))
    else:
        m2 = re.search(r'(\d{2})[-/](\d{2})', fy_str)
        if m2:
            start_year = 2000 + int(m2.group(1))
        else:
            now = datetime.date.today()
            start_year = now.year if now.month >= 4 else now.year - 1

    cur_start = f"{start_year}-04-01"
    cur_end = f"{start_year + 1}-03-31"
    norm_fy = f"FY {start_year}-{str(start_year + 1)[2:]}"

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # 1. Fetch team overlap relationships in bulk
        cursor.execute("""
            SELECT DISTINCT LOWER(TRIM(bdMemberName)) as bd, LOWER(TRIM(teamLeaderName)) as tl, LOWER(TRIM(franchiseeName)) as fn
            FROM enquiries
            WHERE bdMemberName IS NOT NULL AND (teamLeaderName IS NOT NULL OR franchiseeName IS NOT NULL)
        """)
        rel_rows = cursor.fetchall()
        tl_to_bds = {}
        fn_to_bds = {}
        for r in rel_rows:
            b = (r.get('bd') or '').strip().lower()
            t = (r.get('tl') or '').strip().lower()
            f = (r.get('fn') or '').strip().lower()
            if b and t:
                tl_to_bds.setdefault(t, set()).add(b)
            if b and f:
                fn_to_bds.setdefault(f, set()).add(b)

        # 2. Normalize scopes and resolve IDs if any
        resolved_scopes = []
        for s in raw_scopes:
            if not isinstance(s, dict):
                continue
            bd_val = str(s.get('bd') or s.get('bd_id') or s.get('bdAgentId') or s.get('nameOfBd') or '').strip()
            tl_val = str(s.get('tl') or s.get('tl_id') or s.get('teamLeader') or '').strip()
            fn_val = str(s.get('fn') or s.get('franchise') or s.get('franchisee') or s.get('franchiseName') or '').strip()

            bd = bd_val if bd_val and bd_val.lower() != 'all' else 'All'
            tl = tl_val if tl_val and tl_val.lower() != 'all' else 'All'
            fn = fn_val if fn_val and fn_val.lower() != 'all' else 'All'

            if bd != 'All' and (bd.isdigit() or bd.startswith('bd-')):
                cursor.execute("SELECT name FROM bd_agents WHERE id = %s OR id = %s LIMIT 1", [bd, f"bd-{bd}"])
                row_bd = cursor.fetchone()
                if row_bd and row_bd.get('name'):
                    bd = row_bd['name']

            if fn != 'All' and (fn.isdigit() or fn.startswith('f-') or fn.startswith('fran-')):
                cursor.execute("SELECT nameAsPerAgreement FROM franchisees WHERE id = %s LIMIT 1", [fn])
                row_fn = cursor.fetchone()
                if row_fn and row_fn.get('nameAsPerAgreement'):
                    fn = row_fn['nameAsPerAgreement']

            if bd != 'All' and tl == 'All' and fn == 'All':
                sc_type = 'bd'
                label = bd
            elif bd == 'All' and tl != 'All' and fn == 'All':
                sc_type = 'tl'
                label = tl
            elif bd == 'All' and tl == 'All' and fn != 'All':
                sc_type = 'franchise'
                label = fn
            elif bd == 'All' and tl == 'All' and fn == 'All':
                sc_type = 'company'
                label = 'Overall Portfolio'
            else:
                sc_type = 'combo'
                parts = [p for p in [bd if bd != 'All' else None, tl if tl != 'All' else None, fn if fn != 'All' else None] if p]
                label = " + ".join(parts) if parts else 'Overall Portfolio'

            scope_key = f"bd:{bd.lower().strip()}|tl:{tl.lower().strip()}|fn:{fn.lower().strip()}"
            resolved_scopes.append({
                'bd': bd,
                'tl': tl,
                'franchise': fn,
                'type': sc_type,
                'label': label,
                'scope_key': scope_key,
                'orig': s
            })

        # 3. Query metrics for each resolved scope
        results = []
        for r_sc in resolved_scopes:
            bd = r_sc['bd']
            tl = r_sc['tl']
            fn = r_sc['franchise']
            sc_type = r_sc['type']
            label = r_sc['label']
            scope_key = r_sc['scope_key']

            where_clauses = [
                "i.is_revenue = 1",
                "i.billDate >= %s",
                "i.billDate <= %s",
                "LOWER(TRIM(COALESCE(NULLIF(TRIM(i.nameOfBd), ''), NULLIF(TRIM(e.bdMemberName), '')))) NOT IN ('head office', 'head  - office', 'head - office', '')"
            ]
            params = [cur_start, cur_end]

            if bd != 'All':
                where_clauses.append("(LOWER(TRIM(COALESCE(NULLIF(TRIM(i.nameOfBd), ''), NULLIF(TRIM(e.bdMemberName), '')))) = %s OR LOWER(TRIM(COALESCE(NULLIF(TRIM(i.nameOfBd), ''), NULLIF(TRIM(e.bdMemberName), '')))) LIKE %s)")
                params.extend([bd.lower(), f"%{bd.lower()}%"])
            if tl != 'All':
                where_clauses.append("(LOWER(TRIM(COALESCE(NULLIF(TRIM(i.teamLeader), ''), NULLIF(TRIM(e.teamLeaderName), '')))) = %s OR LOWER(TRIM(COALESCE(NULLIF(TRIM(i.teamLeader), ''), NULLIF(TRIM(e.teamLeaderName), '')))) LIKE %s)")
                params.extend([tl.lower(), f"%{tl.lower()}%"])
            if fn != 'All':
                where_clauses.append("(LOWER(TRIM(COALESCE(NULLIF(TRIM(i.franchiseName), ''), NULLIF(TRIM(e.franchiseeName), '')))) = %s OR LOWER(TRIM(COALESCE(NULLIF(TRIM(i.franchiseName), ''), NULLIF(TRIM(e.franchiseeName), '')))) LIKE %s)")
                params.extend([fn.lower(), f"%{fn.lower()}%"])

            metric_query = f"""
                SELECT 
                    COUNT(DISTINCT LOWER(TRIM(i.companyName))) as companies,
                    COUNT(DISTINCT i.billNumber) as invoiced_deals,
                    COALESCE(SUM(i.rev_ex_gst), 0.0) as revenue,
                    COALESCE(SUM(i.ourShare), 0.0) as our_share,
                    COUNT(DISTINCT i.billNumber) as verified_count,
                    0 as estimated_count
                FROM v_invoice_clean i
                LEFT JOIN enquiries e ON i.enquiry_id = e.id
                WHERE {' AND '.join(where_clauses)}
            """
            cursor.execute(metric_query, params)
            m_row = cursor.fetchone() or {}

            companies = int(m_row.get('companies') or 0)
            invoiced_deals = int(m_row.get('invoiced_deals') or 0)
            revenue = round(float(m_row.get('revenue') or 0.0), 2)
            our_share = round(float(m_row.get('our_share') or 0.0), 2)
            verified_count = int(m_row.get('verified_count') or 0)
            estimated_count = int(m_row.get('estimated_count') or 0)

            # 4. Fetch saved manual inputs (salary, expense) from growth_money_box_inputs
            cursor.execute("""
                SELECT expense, salary, net, surplus
                FROM growth_money_box_inputs
                WHERE (
                    (LOWER(TRIM(bd)) = %s AND LOWER(TRIM(tl)) = %s AND LOWER(TRIM(franchise)) = %s AND (LOWER(TRIM(fy)) = %s OR LOWER(TRIM(fy)) = %s))
                    OR (scope_key = %s AND (LOWER(TRIM(fy)) = %s OR LOWER(TRIM(fy)) = %s))
                )
                ORDER BY updated_at DESC LIMIT 1
            """, [bd.lower(), tl.lower(), fn.lower(), fy_str.lower(), norm_fy.lower(), scope_key, fy_str.lower(), norm_fy.lower()])
            saved_input = cursor.fetchone()

            salary = 0.0
            salary_source = 'manual'
            expense = 0.0

            if saved_input and saved_input.get('salary') is not None:
                salary = float(saved_input['salary'])
                salary_source = 'manual'
            elif sc_type == 'bd':
                cursor.execute("SELECT baseSalary FROM bd_agents WHERE LOWER(TRIM(name)) = %s OR LOWER(TRIM(name)) LIKE %s LIMIT 1", [bd.lower(), f"%{bd.lower()}%"])
                bd_row = cursor.fetchone()
                if bd_row and bd_row.get('baseSalary') and float(bd_row['baseSalary']) > 0:
                    salary = float(bd_row['baseSalary'])
                    salary_source = 'payroll'

            expense = 0.0
            expense_source = 'manual'
            if saved_input and saved_input.get('expense') is not None:
                expense = float(saved_input['expense'])
                expense_source = 'manual'
            else:
                # Dynamically query real CRM expenditure for this scope if not manually overridden
                try:
                    if sc_type == 'bd' and bd != 'All':
                        cursor.execute("""
                            SELECT COALESCE(SUM(amount), 0.0) AS total_exp 
                            FROM expenditure 
                            WHERE is_deleted = 0 
                              AND LEFT(billDate, 10) >= %s AND LEFT(billDate, 10) <= %s
                              AND (LOWER(TRIM(bdAgentId)) = %s OR LOWER(TRIM(particulars)) LIKE %s)
                        """, [cur_start, cur_end, bd.lower(), f"%{bd.lower()}%"])
                        exp_row = cursor.fetchone()
                        if exp_row and exp_row.get('total_exp') and float(exp_row['total_exp']) > 0:
                            expense = float(exp_row['total_exp'])
                            expense_source = 'crm_ledger'
                    elif sc_type == 'franchise' and fn != 'All':
                        cursor.execute("""
                            SELECT COALESCE(SUM(amount), 0.0) AS total_exp 
                            FROM expenditure 
                            WHERE is_deleted = 0 
                              AND LEFT(billDate, 10) >= %s AND LEFT(billDate, 10) <= %s
                              AND (LOWER(TRIM(franchiseeId)) = %s OR LOWER(TRIM(particulars)) LIKE %s)
                        """, [cur_start, cur_end, fn.lower(), f"%{fn.lower()}%"])
                        exp_row = cursor.fetchone()
                        if exp_row and exp_row.get('total_exp') and float(exp_row['total_exp']) > 0:
                            expense = float(exp_row['total_exp'])
                            expense_source = 'crm_ledger'
                    elif sc_type == 'company':
                        cursor.execute("""
                            SELECT COALESCE(SUM(amount), 0.0) AS total_exp 
                            FROM expenditure 
                            WHERE is_deleted = 0 
                              AND LEFT(billDate, 10) >= %s AND LEFT(billDate, 10) <= %s
                        """, [cur_start, cur_end])
                        exp_row = cursor.fetchone()
                        if exp_row and exp_row.get('total_exp'):
                            expense = float(exp_row['total_exp'])
                            expense_source = 'crm_ledger'
                except Exception as exp_query_err:
                    print("Dynamic expenditure query note:", str(exp_query_err))

            # 5. Calculations via single shared waterfall:
            wf = calculate_waterfall(
                our_share=our_share,
                expenses=expense,
                salaries=salary
            )
            net = wf['net']
            tax = wf['tax']
            surplus = wf['surplus']
            salary_ratio = round((salary / our_share) * 100, 1) if our_share > 0 else 0.0

            results.append({
                'scope': {
                    'bd': bd,
                    'tl': tl,
                    'franchise': fn,
                    'fn': fn
                },
                'scope_key': scope_key,
                'label': label,
                'type': sc_type,
                'companies': companies,
                'invoicedDeals': invoiced_deals,
                'revenue': revenue,
                'ourShare': our_share,
                'verifiedCount': verified_count,
                'estimatedCount': estimated_count,
                'salary': salary,
                'salarySource': salary_source,
                'expense': expense,
                'expenseSource': expense_source,
                'salaryRatio': salary_ratio,
                'net': net,
                'tax': tax,
                'surplus': surplus,
                'overlapsWith': []
            })

        # 6. Overlap detection across the scopes in this comparison
        for i in range(len(results)):
            for j in range(len(results)):
                if i == j:
                    continue
                si = results[i]
                sj = results[j]
                if si['type'] == 'bd' and sj['type'] == 'tl':
                    bd_lower = si['scope']['bd'].lower().strip()
                    tl_lower = sj['scope']['tl'].lower().strip()
                    if bd_lower in tl_to_bds.get(tl_lower, set()):
                        if sj['label'] not in si['overlapsWith']:
                            si['overlapsWith'].append(sj['label'])
                        if si['label'] not in sj['overlapsWith']:
                            sj['overlapsWith'].append(si['label'])
                if si['type'] == 'bd' and sj['type'] == 'franchise':
                    bd_lower = si['scope']['bd'].lower().strip()
                    fn_lower = sj['scope']['franchise'].lower().strip()
                    if bd_lower in fn_to_bds.get(fn_lower, set()):
                        if sj['label'] not in si['overlapsWith']:
                            si['overlapsWith'].append(sj['label'])
                        if si['label'] not in sj['overlapsWith']:
                            sj['overlapsWith'].append(si['label'])

        return jsonify(results)
    except Exception as e:
        print(f"[compare_growth_scopes] Error: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()


@growth_tracking_bp.route("/api/growth/save-inputs", methods=["POST"])
def save_growth_scope_inputs():
    user_role = (request.headers.get('X-User-Role') or request.args.get('role') or 'admin').strip().lower()
    if user_role not in ('admin', 'manager', 'head_office'):
        return jsonify({'error': 'Unauthorized: Admin or Manager role required'}), 403

    data = request.get_json(silent=True) or {}
    sc = data.get('scope') or {}
    bd = (sc.get('bd') or data.get('bd') or 'All').strip() or 'All'
    tl = (sc.get('tl') or data.get('tl') or 'All').strip() or 'All'
    fn = (sc.get('franchise') or sc.get('fn') or data.get('franchise') or data.get('fn') or 'All').strip() or 'All'
    fy = (data.get('fy') or 'FY 2026-27').strip() or 'FY 2026-27'
    scope_key = f"bd:{bd.lower().strip()}|tl:{tl.lower().strip()}|fn:{fn.lower().strip()}"

    parsed = {}
    for f in ('expense', 'salary', 'net', 'surplus'):
        val = data.get(f)
        if val is None or str(val).strip() == '':
            parsed[f] = None
        else:
            try:
                num = float(val)
                if num < 0 and f in ('expense', 'salary'):
                    return jsonify({'error': f'{f} must be a number >= 0'}), 400
                parsed[f] = num
            except (ValueError, TypeError):
                return jsonify({'error': f'{f} must be a valid number'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            INSERT INTO growth_money_box_inputs (bd, tl, franchise, scope_key, fy, expense, salary, net, surplus, updated_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
                scope_key = VALUES(scope_key),
                expense = VALUES(expense),
                salary = VALUES(salary),
                net = VALUES(net),
                surplus = VALUES(surplus),
                updated_by = VALUES(updated_by),
                updated_at = CURRENT_TIMESTAMP
        """, [bd, tl, fn, scope_key, fy, parsed['expense'], parsed['salary'], parsed['net'], parsed['surplus'], user_role])
        conn.commit()

        return jsonify({
            'success': True,
            'saved': {
                'scope': {'bd': bd, 'tl': tl, 'franchise': fn},
                'scope_key': scope_key,
                'fy': fy,
                'expense': parsed['expense'],
                'salary': parsed['salary'],
                'net': parsed['net'],
                'surplus': parsed['surplus']
            }
        })
    except Exception as e:
        print(f"[save_growth_scope_inputs] Error: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()


@growth_tracking_bp.route("/api/growth-targets/summary", methods=["GET"])
def get_growth_targets_summary():
    raw_type = request.args.get("entity_type", "all").strip().lower()
    entity_name = request.args.get("entity_name", "all").strip()
    entity_id = request.args.get("entity_id", "").strip()
    fy_str = request.args.get("fy", "FY 2026-27").strip()

    bd_param = request.args.get('bd', '').strip()
    tl_param = request.args.get('tl', '').strip()
    franchise_param = request.args.get('franchise', '').strip()

    # Normalize entity_type
    if raw_type in ('bd', 'bd_agent', 'bd_specialist'):
        entity_type = 'bd'
    elif raw_type in ('tl', 'team_leader', 'team_leaders'):
        entity_type = 'tl'
    elif raw_type in ('franchise', 'franchisee', 'franchisees'):
        entity_type = 'franchise'
    else:
        entity_type = 'all'

    is_specific_name = entity_name and entity_name.lower() != 'all'

    if not bd_param and entity_type == 'bd' and is_specific_name:
        bd_param = entity_name
    if not tl_param and entity_type == 'tl' and is_specific_name:
        tl_param = entity_name
    if not franchise_param and entity_type == 'franchise' and is_specific_name:
        franchise_param = entity_name

    import re
    match = re.search(r'(\d{4})', fy_str)
    if match:
        start_year = int(match.group(1))
    else:
        now = datetime.date.today()
        start_year = now.year if now.month >= 4 else now.year - 1

    cur_start = f"{start_year}-04-01"
    cur_end = f"{start_year + 1}-03-31"
    prior_start = f"{start_year - 1}-04-01"
    prior_end = f"{start_year}-03-31"

    today = datetime.date.today()
    cur_end_date = datetime.date(start_year + 1, 3, 31)
    cur_start_date = datetime.date(start_year, 4, 1)

    if today > cur_end_date:
        months_elapsed = 12
        months_remaining = 0
    elif today < cur_start_date:
        months_elapsed = 0
        months_remaining = 12
    else:
        if today.month >= 4:
            months_elapsed = today.month - 3
        else:
            months_elapsed = today.month + 9
        months_remaining = max(0, 12 - months_elapsed)

    user_role = (request.headers.get('X-User-Role') or request.args.get('role') or 'admin').strip().lower()
    cache_key = f"growth_summary_{entity_type}_{entity_id}_{entity_name}_{bd_param}_{tl_param}_{franchise_param}_{start_year}_{user_role}"
    cached_val = _get_cached(cache_key)
    if cached_val is not None:
        return jsonify(cached_val)

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # 1. Fetch current FY invoiced deals from v_invoice_clean (single source of truth for revenue)
        inv_where = [
            "i.is_revenue = 1",
            "i.billDate >= %s",
            "i.billDate <= %s",
            "LOWER(TRIM(COALESCE(NULLIF(TRIM(i.nameOfBd), ''), NULLIF(TRIM(e.bdMemberName), '')))) NOT IN ('head office', 'head  - office', 'head - office', '')"
        ]
        inv_params = [cur_start, cur_end]
        if bd_param and bd_param.lower() != 'all':
            inv_where.append("(LOWER(TRIM(COALESCE(NULLIF(TRIM(i.nameOfBd), ''), NULLIF(TRIM(e.bdMemberName), '')))) = %s OR LOWER(TRIM(COALESCE(NULLIF(TRIM(i.nameOfBd), ''), NULLIF(TRIM(e.bdMemberName), '')))) LIKE %s)")
            inv_params.extend([bd_param.lower(), f"%{bd_param.lower()}%"])
        if tl_param and tl_param.lower() != 'all':
            inv_where.append("(LOWER(TRIM(COALESCE(NULLIF(TRIM(i.teamLeader), ''), NULLIF(TRIM(e.teamLeaderName), '')))) = %s OR LOWER(TRIM(COALESCE(NULLIF(TRIM(i.teamLeader), ''), NULLIF(TRIM(e.teamLeaderName), '')))) LIKE %s)")
            inv_params.extend([tl_param.lower(), f"%{tl_param.lower()}%"])
        if franchise_param and franchise_param.lower() != 'all':
            inv_where.append("(LOWER(TRIM(COALESCE(NULLIF(TRIM(i.franchiseName), ''), NULLIF(TRIM(e.franchiseeName), '')))) = %s OR LOWER(TRIM(COALESCE(NULLIF(TRIM(i.franchiseName), ''), NULLIF(TRIM(e.franchiseeName), '')))) LIKE %s)")
            inv_params.extend([franchise_param.lower(), f"%{franchise_param.lower()}%"])

        inv_query = f"""
            SELECT 
                i.id as invoice_id, i.enquiry_id, i.billNumber, i.billDate, i.totalBillAmt, i.rev_ex_gst,
                i.ourShare, i.franchiseeShare, i.companyName, i.candidateName, i.postOfCandidate,
                COALESCE(NULLIF(TRIM(i.nameOfBd), ''), NULLIF(TRIM(e.bdMemberName), '')) as bdMemberName,
                COALESCE(NULLIF(TRIM(i.teamLeader), ''), NULLIF(TRIM(e.teamLeaderName), '')) as teamLeaderName,
                COALESCE(NULLIF(TRIM(i.franchiseName), ''), NULLIF(TRIM(e.franchiseeName), '')) as franchiseeName,
                i.status as inv_status,
                e.id as enq_id, e.industry, e.positionName as enq_position, e.info as enq_info,
                f.onboardingDate
            FROM v_invoice_clean i
            LEFT JOIN enquiries e ON i.enquiry_id = e.id
            LEFT JOIN franchisees f ON TRIM(LOWER(f.nameAsPerAgreement)) = TRIM(LOWER(COALESCE(NULLIF(TRIM(i.franchiseName), ''), NULLIF(TRIM(e.franchiseeName), ''))))
            WHERE {' AND '.join(inv_where)}
            ORDER BY i.billDate DESC
        """
        cursor.execute(inv_query, inv_params)
        inv_rows = cursor.fetchall()

        # 2. Fetch current FY pipeline enquiries (non-invoiced)
        enq_where = [
            "LOWER(TRIM(COALESCE(e.bdMemberName, ''))) NOT IN ('head office', 'head  - office', 'head - office', '')",
            "LEFT(COALESCE(e.dateOfAllocation, e.created_at), 10) >= %s",
            "LEFT(COALESCE(e.dateOfAllocation, e.created_at), 10) <= %s"
        ]
        enq_params = [cur_start, cur_end]
        if bd_param and bd_param.lower() != 'all':
            enq_where.append("(LOWER(TRIM(e.bdMemberName)) = %s OR LOWER(TRIM(e.bdMemberName)) LIKE %s)")
            enq_params.extend([bd_param.lower(), f"%{bd_param.lower()}%"])
        if tl_param and tl_param.lower() != 'all':
            enq_where.append("(LOWER(TRIM(e.teamLeaderName)) = %s OR LOWER(TRIM(e.teamLeaderName)) LIKE %s)")
            enq_params.extend([tl_param.lower(), f"%{tl_param.lower()}%"])
        if franchise_param and franchise_param.lower() != 'all':
            enq_where.append("(LOWER(TRIM(e.franchiseeName)) = %s OR LOWER(TRIM(e.franchiseeName)) LIKE %s)")
            enq_params.extend([franchise_param.lower(), f"%{franchise_param.lower()}%"])

        enq_query = f"""
            SELECT 
                e.id, e.companyName, e.positionName, e.bdMemberName, e.teamLeaderName, e.franchiseeName,
                e.enquiryStatus, e.bill_no, e.bill_date, e.bill_amount, e.placementFees,
                e.industry, e.info, e.dateOfAllocation, e.created_at,
                f.onboardingDate,
                LEFT(COALESCE(e.dateOfAllocation, e.created_at), 10) as effective_date
            FROM enquiries e
            LEFT JOIN franchisees f ON TRIM(LOWER(f.nameAsPerAgreement)) = TRIM(LOWER(e.franchiseeName))
            WHERE {' AND '.join(enq_where)}
            ORDER BY effective_date DESC
        """
        cursor.execute(enq_query, enq_params)
        enq_rows = cursor.fetchall()

        billed_enq_ids = set(r['enquiry_id'] for r in inv_rows if r['enquiry_id'])
        billed_bill_nos = set(r['billNumber'] for r in inv_rows if r['billNumber'])

        # Monthly buckets: Apr of start_year to Mar of start_year+1
        fy_months = []
        for m in range(4, 13):
            fy_months.append(f"{start_year}-{m:02d}")
        for m in range(1, 4):
            fy_months.append(f"{start_year + 1}-{m:02d}")

        month_labels = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"]
        monthly_map = {}
        for idx, ym in enumerate(fy_months):
            monthly_map[ym] = {
                'month': ym,
                'month_label': f"{month_labels[idx]} '{str(start_year if idx < 9 else start_year + 1)[2:]}",
                'invoiced': 0,
                'invoiced_revenue': 0.0,
                'progressed': 0,
                'progressed_revenue': 0.0,
                'cancelled': 0,
                'cancelled_revenue': 0.0,
                'other': 0,
                'other_revenue': 0.0,
                'all': 0,
                'all_revenue': 0.0
            }

        totals = {
            'all': {'count': 0, 'revenue': 0.0, 'avg_deal': 0.0},
            'invoiced': {'count': 0, 'revenue': 0.0, 'avg_deal': 0.0},
            'progressed': {'count': 0, 'revenue': 0.0, 'avg_deal': 0.0},
            'cancelled': {'count': 0, 'revenue': 0.0, 'avg_deal': 0.0},
            'other': {'count': 0, 'revenue': 0.0, 'avg_deal': 0.0}
        }

        deals = []
        seen_invoices = {}

        # Populate invoiced deals from v_invoice_clean (rev_ex_gst and distinct billNumber)
        for r in inv_rows:
            bnum = r['billNumber'] or f"INV-{r['invoice_id']}"
            rev_val = float(r.get('rev_ex_gst') or 0.0)
            our_share = float(r.get('ourShare') or 0.0)
            f_share = float(r.get('franchiseeShare') or 0.0)
            bdate = str(r['billDate'] or '')[:10]
            ym = bdate[:7]

            if bnum not in seen_invoices:
                seen_invoices[bnum] = {
                    'id': f"INV-{r['invoice_id']}",
                    'referenceId': bnum,
                    'companyName': r.get('companyName') or 'Corporate Client',
                    'positionName': r.get('postOfCandidate') or r.get('enq_position') or 'Mandate',
                    'candidateName': r.get('candidateName') or r.get('enq_info') or 'Candidate Placement',
                    'bdMemberName': r.get('bdMemberName') or '',
                    'teamLeaderName': r.get('teamLeaderName') or '',
                    'franchiseeName': r.get('franchiseeName') or '',
                    'date': bdate,
                    'amount': rev_val,
                    'our_share': round(our_share, 2),
                    'is_verified': True,
                    'franchisee_share': round(f_share, 2),
                    'raw_status': r.get('inv_status') or 'invoiced',
                    'status': 'invoiced',
                    'bill_no': bnum,
                    'industry': r.get('industry') or ''
                }
                totals['invoiced']['count'] += 1
                totals['invoiced']['revenue'] += rev_val
                totals['all']['count'] += 1
                totals['all']['revenue'] += rev_val

                if ym in monthly_map:
                    monthly_map[ym]['invoiced'] += 1
                    monthly_map[ym]['invoiced_revenue'] += rev_val
                    monthly_map[ym]['all'] += 1
                    monthly_map[ym]['all_revenue'] += rev_val
            else:
                # Merge multiple placements on the same invoice billNumber
                seen_invoices[bnum]['amount'] += rev_val
                seen_invoices[bnum]['our_share'] += round(our_share, 2)
                seen_invoices[bnum]['franchisee_share'] += round(f_share, 2)
                totals['invoiced']['revenue'] += rev_val
                totals['all']['revenue'] += rev_val
                if ym in monthly_map:
                    monthly_map[ym]['invoiced_revenue'] += rev_val
                    monthly_map[ym]['all_revenue'] += rev_val

        deals = list(seen_invoices.values())

        # Populate open pipeline / cancelled enquiries from enquiries table
        for r in enq_rows:
            st = _classify_backend_status(r['enquiryStatus'])
            if r['id'] in billed_enq_ids or (r['bill_no'] and r['bill_no'] in billed_bill_nos):
                continue
            if st == 'invoiced':
                continue

            amt = float(r['bill_amount'] or 0.0)
            edate = str(r['effective_date'] or '')[:10]
            ym = edate[:7]

            totals[st]['count'] += 1
            totals[st]['revenue'] += amt
            totals['all']['count'] += 1
            totals['all']['revenue'] += amt

            if ym in monthly_map:
                monthly_map[ym][st] += 1
                monthly_map[ym][f"{st}_revenue"] += amt
                monthly_map[ym]['all'] += 1
                monthly_map[ym]['all_revenue'] += amt

            split = get_franchisee_tenure_split(
                onboarding_date=r.get('onboardingDate'),
                bill_date=edate
            )
            deal_our_share = amt * split['company_pct']
            deal_f_share = amt * split['franchisee_pct']

            deals.append({
                'id': r['id'],
                'referenceId': f"ENQ-{r['id']}",
                'companyName': r.get('companyName') or 'Corporate Client',
                'positionName': r.get('positionName') or 'Mandate',
                'candidateName': r.get('info') or r.get('positionName') or 'Candidate Placement',
                'bdMemberName': r.get('bdMemberName') or '',
                'teamLeaderName': r.get('teamLeaderName') or '',
                'franchiseeName': r.get('franchiseeName') or '',
                'date': edate,
                'amount': amt,
                'our_share': round(deal_our_share, 2),
                'is_verified': False,
                'franchisee_share': round(deal_f_share, 2),
                'raw_status': r.get('enquiryStatus') or '',
                'status': st,
                'bill_no': r.get('bill_no') or '',
                'industry': r.get('industry') or ''
            })

        for k in ('all', 'invoiced', 'progressed', 'cancelled', 'other'):
            cnt = totals[k]['count']
            rev = totals[k]['revenue']
            totals[k]['avg_deal'] = round(rev / cnt, 2) if cnt > 0 else 0.0
            totals[k]['revenue'] = round(rev, 2)

        monthly_series = [monthly_map[ym] for ym in fy_months]
        for m in monthly_series:
            m['invoiced_revenue'] = round(m['invoiced_revenue'], 2)
            m['progressed_revenue'] = round(m['progressed_revenue'], 2)
            m['cancelled_revenue'] = round(m['cancelled_revenue'], 2)
            m['other_revenue'] = round(m['other_revenue'], 2)
            m['all_revenue'] = round(m['all_revenue'], 2)

        # 3. Same-Period Comparison: Compare Apr-to-current-month of this FY vs same period in prior FY
        cur_same_end = today.strftime("%Y-%m-%d") if today <= cur_end_date else cur_end
        prior_same_start = prior_start
        try:
            prior_same_end = today.replace(year=start_year - 1).strftime("%Y-%m-%d")
        except ValueError:
            prior_same_end = f"{start_year - 1}-10-22"
        if prior_same_end > prior_end:
            prior_same_end = prior_end

        prior_inv_base = [
            "i.is_revenue = 1",
            "i.billDate IS NOT NULL",
            "LOWER(TRIM(COALESCE(NULLIF(TRIM(i.nameOfBd), ''), NULLIF(TRIM(e.bdMemberName), '')))) NOT IN ('head office', 'head  - office', 'head - office', '')"
        ]
        prior_inv_params = []
        if bd_param and bd_param.lower() != 'all':
            prior_inv_base.append("(LOWER(TRIM(COALESCE(NULLIF(TRIM(i.nameOfBd), ''), NULLIF(TRIM(e.bdMemberName), '')))) = %s OR LOWER(TRIM(COALESCE(NULLIF(TRIM(i.nameOfBd), ''), NULLIF(TRIM(e.bdMemberName), '')))) LIKE %s)")
            prior_inv_params.extend([bd_param.lower(), f"%{bd_param.lower()}%"])
        if tl_param and tl_param.lower() != 'all':
            prior_inv_base.append("(LOWER(TRIM(COALESCE(NULLIF(TRIM(i.teamLeader), ''), NULLIF(TRIM(e.teamLeaderName), '')))) = %s OR LOWER(TRIM(COALESCE(NULLIF(TRIM(i.teamLeader), ''), NULLIF(TRIM(e.teamLeaderName), '')))) LIKE %s)")
            prior_inv_params.extend([tl_param.lower(), f"%{tl_param.lower()}%"])
        if franchise_param and franchise_param.lower() != 'all':
            prior_inv_base.append("(LOWER(TRIM(COALESCE(NULLIF(TRIM(i.franchiseName), ''), NULLIF(TRIM(e.franchiseeName), '')))) = %s OR LOWER(TRIM(COALESCE(NULLIF(TRIM(i.franchiseName), ''), NULLIF(TRIM(e.franchiseeName), '')))) LIKE %s)")
            prior_inv_params.extend([franchise_param.lower(), f"%{franchise_param.lower()}%"])

        # Prior same period (e.g. Apr 1 to Oct 22 in prior year)
        cursor.execute(f"""
            SELECT COUNT(DISTINCT i.billNumber) as cnt, COALESCE(SUM(i.rev_ex_gst), 0.0) as rev
            FROM v_invoice_clean i
            LEFT JOIN enquiries e ON i.enquiry_id = e.id
            WHERE {' AND '.join(prior_inv_base)} AND i.billDate >= %s AND i.billDate <= %s
        """, prior_inv_params + [prior_same_start, prior_same_end])
        prior_same_row = cursor.fetchone() or {}
        prior_same_deals = int(prior_same_row.get('cnt') or 0)
        prior_same_rev = round(float(prior_same_row.get('rev') or 0.0), 2)
        prior_same_avg = round(prior_same_rev / prior_same_deals, 2) if prior_same_deals > 0 else 0.0

        # Prior full year (for reference)
        cursor.execute(f"""
            SELECT COUNT(DISTINCT i.billNumber) as cnt, COALESCE(SUM(i.rev_ex_gst), 0.0) as rev
            FROM v_invoice_clean i
            LEFT JOIN enquiries e ON i.enquiry_id = e.id
            WHERE {' AND '.join(prior_inv_base)} AND i.billDate >= %s AND i.billDate <= %s
        """, prior_inv_params + [prior_start, prior_end])
        prior_full_row = cursor.fetchone() or {}
        prior_full_deals = int(prior_full_row.get('cnt') or 0)
        prior_full_rev = round(float(prior_full_row.get('rev') or 0.0), 2)
        prior_full_avg = round(prior_full_rev / prior_full_deals, 2) if prior_full_deals > 0 else 0.0

        # Team Average benchmark for same period
        team_bench_query = f"""
            SELECT 
                COUNT(DISTINCT {'e.bdMemberName' if entity_type == 'bd' else ('e.teamLeaderName' if entity_type == 'tl' else 'e.franchiseeName')}) as member_count
            FROM enquiries e
            WHERE LOWER(TRIM(COALESCE(e.bdMemberName, ''))) NOT IN ('head office', 'head  - office', 'head - office', '')
              AND LEFT(COALESCE(e.dateOfAllocation, e.created_at), 10) >= %s
              AND LEFT(COALESCE(e.dateOfAllocation, e.created_at), 10) <= %s
        """
        cursor.execute(team_bench_query, [cur_start, cur_same_end])
        t_row = cursor.fetchone() or {}
        active_members = max(1, int(t_row.get('member_count') or 1))

        team_closed_query = f"""
            SELECT COUNT(DISTINCT i.billNumber) as closed_deals, COALESCE(SUM(i.rev_ex_gst), 0.0) as closed_rev
            FROM v_invoice_clean i
            LEFT JOIN enquiries e ON i.enquiry_id = e.id
            WHERE i.is_revenue = 1
              AND i.billDate >= %s
              AND i.billDate <= %s
              AND LOWER(TRIM(COALESCE(NULLIF(TRIM(i.nameOfBd), ''), NULLIF(TRIM(e.bdMemberName), '')))) NOT IN ('head office', 'head  - office', 'head - office', '')
        """
        cursor.execute(team_closed_query, [cur_start, cur_same_end])
        tc_row = cursor.fetchone() or {}
        team_closed_deals = int(tc_row.get('closed_deals') or 0)
        team_closed_rev = float(tc_row.get('closed_rev') or 0.0)

        team_avg = {
            'closed_deals': round(team_closed_deals / active_members, 1),
            'revenue': round(team_closed_rev / active_members, 2),
            'avg_deal': round(team_closed_rev / team_closed_deals, 2) if team_closed_deals > 0 else 0.0,
            'active_members': active_members
        }

        # 4. Entity resolution & Pace calculation
        calc_entity_type = 'all'
        calc_entity_name = 'All'
        if bd_param and bd_param.lower() != 'all':
            calc_entity_type = 'bd'
            calc_entity_name = bd_param
            display_name = bd_param
        elif tl_param and tl_param.lower() != 'all':
            calc_entity_type = 'tl'
            calc_entity_name = tl_param
            display_name = tl_param
        elif franchise_param and franchise_param.lower() != 'all':
            calc_entity_type = 'franchise'
            calc_entity_name = franchise_param
            display_name = franchise_param
        elif is_specific_name:
            calc_entity_type = entity_type
            calc_entity_name = entity_name
            display_name = entity_name
        else:
            calc_entity_type = entity_type
            calc_entity_name = 'All'
            display_name = "Overall Portfolio" if entity_type == 'all' else f"All {entity_type.upper()}s"

        # Fetch authoritative historical series and baseline
        hist_series, _, _ = _fetch_historical_revenue_and_stats(cursor, calc_entity_type, entity_id, calc_entity_name)
        completed_fys = [pt for pt in hist_series if pt.get('is_complete') and float(pt.get('revenue') or 0.0) > 0]
        baseline_revenue = float(completed_fys[-1]['revenue']) if completed_fys else 0.0
        baseline_deals = int(completed_fys[-1]['deals_count']) if completed_fys else 0
        baseline_period = completed_fys[-1]['period'] if completed_fys else None
        historical_cagr = _calculate_cagr(hist_series)
        cagr_note = None if historical_cagr is not None else "Not enough completed financial years (minimum 2 required)"

        closed_cnt = totals['invoiced']['count']
        closed_rev = totals['invoiced']['revenue']
        monthly_pace = round(closed_cnt / max(1, months_elapsed), 1) if months_elapsed > 0 else 0.0
        projected_by_march = round(closed_cnt + (monthly_pace * months_remaining)) if months_elapsed > 0 else closed_cnt

        # Target quota & pledge resolution from growth_targets table
        own_pledge = None
        try:
            cursor.execute("""
                SELECT id, growth_pct_target, target_revenue, target_placements, target_author, status, updated_by, updated_at, financial_year, metric_type
                FROM growth_targets
                WHERE (entity_id = %s OR LOWER(TRIM(entity_id)) = %s)
                  AND status = 'active'
                  AND (financial_year = %s OR financial_year IS NULL OR financial_year = '' OR period_start LIKE %s)
                ORDER BY created_at DESC LIMIT 1
            """, [calc_entity_name, calc_entity_name.lower(), fy_str, f"{start_year}%"])
            tgt_row = cursor.fetchone()
            if tgt_row and (tgt_row.get('target_placements') or tgt_row.get('target_revenue') or tgt_row.get('growth_pct_target')):
                own_pledge = {
                    'id': tgt_row['id'],
                    'growth_pct': float(tgt_row.get('growth_pct_target') or 15.0),
                    'target_deals': int(tgt_row['target_placements']) if tgt_row.get('target_placements') else None,
                    'target_revenue': float(tgt_row.get('target_revenue')) if tgt_row.get('target_revenue') else None,
                    'author': tgt_row.get('target_author') or 'Direct',
                    'updated_by': tgt_row.get('updated_by') or 'User',
                    'updated_at': str(tgt_row.get('updated_at') or tgt_row.get('created_at') or ''),
                    'financial_year': tgt_row.get('financial_year') or fy_str,
                    'metric_type': tgt_row.get('metric_type') or 'deals',
                    'status': tgt_row.get('status') or 'active'
                }
        except Exception as e:
            print("own_pledge query notice:", e)

        quota_deals = own_pledge['target_deals'] if own_pledge else (max(1, int(round(baseline_deals * 1.15))) if baseline_deals > 0 else max(10, int(round(closed_cnt * 1.2))))
        quota_revenue = own_pledge['target_revenue'] if own_pledge else (round(baseline_revenue * 1.15, 2) if baseline_revenue > 0 else round(closed_rev * 1.2, 2))

        company_quota = {
            'quota_deals': quota_deals,
            'quota_revenue': quota_revenue,
            'growth_pct': 15.0
        }

        # Plain-language pacing sentence
        if projected_by_march >= quota_deals and quota_deals > 0:
            pct_ahead = round(((projected_by_march - quota_deals) / quota_deals) * 100)
            pacing_sentence = f"On pace to beat quota by {pct_ahead}%"
        elif quota_deals > 0:
            pct_behind = round(((quota_deals - projected_by_march) / quota_deals) * 100)
            pacing_sentence = f"On pace for {projected_by_march} deals ({pct_behind}% behind quota)"
        else:
            pacing_sentence = f"On pace for {projected_by_march} deals by FY-end"

        if closed_cnt > 0:
            if months_remaining > 0:
                headline = f"{display_name} has closed {closed_cnt} deals ({_format_inr_short(closed_rev)}) this FY. {pacing_sentence}."
            else:
                headline = f"{display_name} closed {closed_cnt} deals ({_format_inr_short(closed_rev)}) in {fy_str}."
        else:
            headline = f"{display_name} has closed 0 deals this FY. Pipeline: {totals['progressed']['count']} deals ({_format_inr_short(totals['progressed']['revenue'])})."

        tot_all_cnt = max(1, totals['all']['count'])
        funnel = {
            'progressed_count': totals['progressed']['count'],
            'progressed_pct': round((totals['progressed']['count'] / tot_all_cnt) * 100, 1),
            'invoiced_count': totals['invoiced']['count'],
            'invoiced_pct': round((totals['invoiced']['count'] / tot_all_cnt) * 100, 1),
            'cancelled_count': totals['cancelled']['count'],
            'cancelled_pct': round((totals['cancelled']['count'] / tot_all_cnt) * 100, 1),
            'other_count': totals['other']['count'],
            'other_pct': round((totals['other']['count'] / tot_all_cnt) * 100, 1)
        }

        # Delta percentages between this period and prior same period
        yoy_same_rev_pct = round(((closed_rev - prior_same_rev) / prior_same_rev) * 100, 1) if prior_same_rev > 0 else None
        yoy_same_deals_pct = round(((closed_cnt - prior_same_deals) / prior_same_deals) * 100, 1) if prior_same_deals > 0 else None

        response_data = {
            'entity_type': calc_entity_type,
            'entity_name': calc_entity_name,
            'display_name': display_name,
            'bd': bd_param,
            'tl': tl_param,
            'franchise': franchise_param,
            'fy': fy_str,
            'period': {
                'start_date': cur_start,
                'end_date': cur_end,
                'same_period_end': cur_same_end,
                'months_elapsed': months_elapsed,
                'months_remaining': months_remaining
            },
            'headline': headline,
            'pacing_sentence': pacing_sentence,
            'totals': totals,
            'baseline': {
                'revenue': baseline_revenue,
                'deals': baseline_deals,
                'period': baseline_period,
                'historical_cagr': historical_cagr,
                'historical_cagr_pct': round(historical_cagr * 100, 2) if historical_cagr is not None else None,
                'cagr_note': cagr_note
            },
            'company_quota': company_quota,
            'own_pledge': own_pledge,
            'historical_series': hist_series,
            'monthly_series': monthly_series,
            'deals': deals,
            'funnel': funnel,
            'pace': {
                'closed_count': closed_cnt,
                'closed_revenue': closed_rev,
                'current_monthly_pace': monthly_pace,
                'projected_total_by_fy_end': projected_by_march,
                'months_elapsed': months_elapsed,
                'months_remaining': months_remaining,
                'is_low_volume': closed_cnt < 10
            },
            'comparisons': {
                'this_period': {
                    'closed_deals': closed_cnt,
                    'revenue': closed_rev,
                    'avg_deal': totals['invoiced']['avg_deal'],
                    'months_elapsed': months_elapsed
                },
                'prior_same_period': {
                    'closed_deals': prior_same_deals,
                    'revenue': prior_same_rev,
                    'avg_deal': prior_same_avg,
                    'yoy_revenue_pct': yoy_same_rev_pct,
                    'yoy_deals_pct': yoy_same_deals_pct,
                    'months_elapsed': months_elapsed
                },
                'prior_full_year': {
                    'closed_deals': prior_full_deals,
                    'revenue': prior_full_rev,
                    'avg_deal': prior_full_avg
                },
                'team_average': {
                    'closed_deals': team_avg['closed_deals'],
                    'revenue': team_avg['revenue'],
                    'avg_deal': team_avg['avg_deal'],
                    'active_members': team_avg['active_members']
                }
            },
            'money_box': _calculate_money_box(
                [d for d in deals if d['status'] == 'invoiced'],
                totals['invoiced']['revenue'],
                request
            )
        }

        _set_cached(cache_key, response_data, ttl_seconds=60)
        return jsonify(response_data)
    except Exception as e:
        print(f"[get_growth_targets_summary] Error: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()


# --------------------------------------------------------------------------
# 4. GET /api/growth-targets (Target history)
# --------------------------------------------------------------------------
@growth_tracking_bp.route("/api/growth-targets", methods=["GET"])
def get_growth_targets():
    entity_type = request.args.get("entity_type")
    entity_id = request.args.get("entity_id")
    status = request.args.get("status")

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS growth_targets (
                id VARCHAR(100) PRIMARY KEY,
                entity_type VARCHAR(50) NOT NULL,
                entity_id VARCHAR(100) NOT NULL,
                growth_pct_target DECIMAL(10, 4) NOT NULL,
                salary_target DECIMAL(15, 2) NULL,
                period_start VARCHAR(100) NOT NULL,
                period_end VARCHAR(100) NOT NULL,
                guidelines TEXT NULL,
                status VARCHAR(50) DEFAULT 'active',
                actual_growth_pct DECIMAL(10, 4) NULL,
                actual_value DECIMAL(15, 2) NULL,
                kra_summary TEXT NULL,
                target_letter_text MEDIUMTEXT NULL,
                outcome_letter_text MEDIUMTEXT NULL,
                target_letter_sent_at VARCHAR(100) NULL,
                outcome_recorded_at VARCHAR(100) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_gt_entity (entity_type, entity_id),
                INDEX idx_gt_status (status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        """)

        query = "SELECT * FROM growth_targets WHERE 1=1"
        params = []

        entity_name = request.args.get("entity_name")
        fy_filter = request.args.get("fy") or request.args.get("financial_year")
        if entity_type and entity_type.strip().lower() != 'company':
            query += " AND entity_type = %s"
            params.append(entity_type.strip().lower())
        if entity_id:
            if entity_name:
                query += " AND (entity_id = %s OR LOWER(entity_id) = %s)"
                params.extend([str(entity_id).strip(), entity_name.strip().lower()])
            else:
                query += " AND entity_id = %s"
                params.append(str(entity_id).strip())
        elif entity_name:
            query += " AND LOWER(entity_id) = %s"
            params.append(entity_name.strip().lower())
        if fy_filter:
            query += " AND (financial_year = %s OR financial_year IS NULL OR financial_year = '')"
            params.append(fy_filter.strip())
        if status:
            query += " AND status = %s"
            params.append(status.strip().lower())

        query += " ORDER BY created_at DESC"
        cursor.execute(query, params)
        rows = cursor.fetchall()

        results = []
        for r in rows:
            ent_name = _resolve_entity_info(cursor, r['entity_type'], r['entity_id'])
            results.append({
                'id': r['id'],
                'entity_type': r['entity_type'],
                'entity_id': r['entity_id'],
                'entity_name': ent_name,
                'growth_pct_target': float(r['growth_pct_target']),
                'growth_pct_target_pct': round(float(r['growth_pct_target']) * 100, 2),
                'salary_target': float(r['salary_target']) if r['salary_target'] is not None else None,
                'target_placements': int(r['target_placements']) if r.get('target_placements') is not None else None,
                'target_revenue': float(r['target_revenue']) if r.get('target_revenue') is not None else None,
                'target_author': r.get('target_author') or 'Direct',
                'updated_by': r.get('updated_by') or 'System',
                'financial_year': r.get('financial_year') or '',
                'metric_type': r.get('metric_type') or 'deals',
                'period_start': r['period_start'],
                'period_end': r['period_end'],
                'guidelines': r['guidelines'],
                'status': r['status'],
                'actual_growth_pct': float(r['actual_growth_pct']) if r['actual_growth_pct'] is not None else None,
                'actual_growth_pct_pct': round(float(r['actual_growth_pct']) * 100, 2) if r['actual_growth_pct'] is not None else None,
                'actual_value': float(r['actual_value']) if r['actual_value'] is not None else None,
                'kra_summary': r['kra_summary'],
                'target_letter_text': r['target_letter_text'],
                'outcome_letter_text': r['outcome_letter_text'],
                'target_letter_sent_at': r['target_letter_sent_at'],
                'outcome_recorded_at': r['outcome_recorded_at'],
                'created_at': str(r['created_at']),
                'updated_at': str(r.get('updated_at') or r['created_at'])
            })

        return jsonify(results)
    except Exception as e:
        print(f"[get_growth_targets] Error: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()


# --------------------------------------------------------------------------
# 5. POST /api/growth-targets/<id>/outcome (Record actual performance outcome)
# --------------------------------------------------------------------------
@growth_tracking_bp.route("/api/growth-targets/<target_id>/outcome", methods=["POST"])
def record_outcome(target_id):
    data = request.get_json() or {}
    actual_growth_pct = float(data.get("actual_growth_pct", 0.0))
    actual_value = float(data.get("actual_value", 0.0))
    kra_summary = data.get("kra_summary", "").strip()

    normalized_actual_growth = actual_growth_pct / 100.0 if actual_growth_pct > 1.0 else actual_growth_pct

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT * FROM growth_targets WHERE id = %s LIMIT 1", [target_id])
        target_row = cursor.fetchone()
        if not target_row:
            return jsonify({"error": "Growth target not found"}), 404

        entity_type = target_row['entity_type']
        entity_id = target_row['entity_id']
        growth_pct_target = float(target_row['growth_pct_target'])
        salary_target = float(target_row['salary_target']) if target_row['salary_target'] is not None else None
        
        entity_name = _resolve_entity_info(cursor, entity_type, entity_id)
        historical_series, _, _ = _fetch_historical_revenue_and_stats(cursor, entity_type, entity_id, entity_name)
        base_value = historical_series[-1]['revenue'] if historical_series else 0.0
        target_value = base_value * (1.0 + growth_pct_target) if base_value > 0 else 0.0

        outcome_letter = generate_outcome_letter(
            entity_name=entity_name,
            entity_type=entity_type,
            growth_pct_target=growth_pct_target,
            target_value=target_value,
            actual_growth_pct=normalized_actual_growth,
            actual_value=actual_value,
            salary_target=salary_target,
            period_start=target_row['period_start'],
            period_end=target_row['period_end'],
            kra_summary=kra_summary
        )

        now_str = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')

        update_sql = """
            UPDATE growth_targets SET
                actual_growth_pct = %s,
                actual_value = %s,
                kra_summary = %s,
                status = 'completed',
                outcome_letter_text = %s,
                outcome_recorded_at = %s,
                updated_at = %s
            WHERE id = %s
        """
        cursor.execute(update_sql, [
            normalized_actual_growth,
            actual_value,
            kra_summary,
            outcome_letter,
            now_str,
            now_str,
            target_id
        ])
        conn.commit()

        return jsonify({
            'success': True,
            'id': target_id,
            'status': 'completed',
            'actual_growth_pct': normalized_actual_growth,
            'actual_growth_pct_pct': round(normalized_actual_growth * 100, 2),
            'actual_value': actual_value,
            'kra_summary': kra_summary,
            'outcome_letter_text': outcome_letter,
            'outcome_recorded_at': now_str
        })
    except Exception as e:
        print(f"[record_outcome] Error: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()


# ==========================================================================
# TL FRANCHISEE PORTFOLIO & PREDICTIVE COLLECTION RISK ENGINE
# ==========================================================================

def _calc_aging_factor(days_outstanding, status='inprogress'):
    """
    Computes AgingFactor (0-100) based on 45-day standard recruitment SLA
    and applies a 0.70x pipeline risk multiplier for 'revised' status.
    """
    days = max(0, int(days_outstanding or 0))
    if days <= 45:
        base_score = 100.0
    elif days <= 75:
        base_score = 75.0
    elif days <= 105:
        base_score = 40.0
    else:
        base_score = 15.0

    status_multiplier = 0.70 if str(status).strip().lower() == 'revised' else 1.0
    return round(base_score * status_multiplier, 2)


def _calc_entity_conversion_rate(cursor, entity_col, aliases, lookback_months=12):
    """
    Calculates historical conversion rate for the TL/BD entity over trailing lookback_months.
    Fallback to 70.0% if < 5 resolved deals.
    """
    if isinstance(aliases, str):
        aliases = [aliases]
    elif aliases is None:
        aliases = []
    else:
        aliases = list(aliases)

    if not aliases:
        return 70.0, 0

    cache_k = (entity_col, tuple(sorted(aliases)), lookback_months)
    now = time.time()
    if cache_k in _ENTITY_CONV_CACHE and _ENTITY_CONV_CACHE[cache_k]['exp'] > now:
        return _ENTITY_CONV_CACHE[cache_k]['val']

    placeholders = ", ".join(["%s"] * len(aliases))
    try:
        query = f"""
            SELECT 
                SUM(CASE WHEN e.enquiryStatus IN ('closed', 'offered_and_accepted', 'invoiced') THEN 1 ELSE 0 END) as received_cnt,
                SUM(CASE WHEN e.enquiryStatus IN ('cancelled', 'offered_and_rejected') THEN 1 ELSE 0 END) as cancelled_cnt
            FROM enquiries e
            WHERE (LOWER(TRIM(e.{entity_col})) IN ({placeholders}) OR e.{entity_col} IN ({placeholders}))
              AND e.created_at >= DATE_SUB(CURDATE(), INTERVAL %s MONTH)
        """
        cursor.execute(query, aliases + aliases + [lookback_months])
        row = cursor.fetchone()
        rec = int(row['received_cnt'] or 0) if row else 0
        canc = int(row['cancelled_cnt'] or 0) if row else 0
        total_resolved = rec + canc

        res = (round((rec / total_resolved) * 100.0, 2), total_resolved) if total_resolved >= 5 else (70.0, total_resolved)
        _ENTITY_CONV_CACHE[cache_k] = {'val': res, 'exp': now + 300}
        return res
    except Exception as e:
        print(f"[_calc_entity_conversion_rate] Error: {e}")
        return 70.0, 0


def _calc_tl_conversion_rate(cursor, tl_aliases, lookback_months=12):
    return _calc_entity_conversion_rate(cursor, 'teamLeaderName', tl_aliases, lookback_months)


def _calc_bd_conversion_rate(cursor, bd_aliases, lookback_months=12):
    return _calc_entity_conversion_rate(cursor, 'bdMemberName', bd_aliases, lookback_months)


def _calc_franchisee_track_record(cursor, franchisee_name, lookback_months=12):
    """
    Calculates historical conversion rate for a specific franchisee across all TLs/BDs
    over the same trailing lookback_months. Fallback to 70.0% if < 3 resolved deals.
    """
    if not franchisee_name:
        return 70.0, 0

    cache_k = (franchisee_name.strip().lower(), lookback_months)
    now = time.time()
    if cache_k in _FRANCHISEE_TRACK_CACHE and _FRANCHISEE_TRACK_CACHE[cache_k]['exp'] > now:
        return _FRANCHISEE_TRACK_CACHE[cache_k]['val']

    try:
        query = """
            SELECT 
                SUM(CASE WHEN e.enquiryStatus IN ('closed', 'offered_and_accepted', 'invoiced') THEN 1 ELSE 0 END) as received_cnt,
                SUM(CASE WHEN e.enquiryStatus IN ('cancelled', 'offered_and_rejected') THEN 1 ELSE 0 END) as cancelled_cnt
            FROM enquiries e
            WHERE (LOWER(TRIM(e.franchiseeName)) = %s OR e.franchiseeName = %s)
              AND e.created_at >= DATE_SUB(CURDATE(), INTERVAL %s MONTH)
        """
        cursor.execute(query, [franchisee_name.strip().lower(), franchisee_name.strip(), lookback_months])
        row = cursor.fetchone()
        rec = int(row['received_cnt'] or 0) if row else 0
        canc = int(row['cancelled_cnt'] or 0) if row else 0
        total_resolved = rec + canc

        res = (round((rec / total_resolved) * 100.0, 2), total_resolved) if total_resolved >= 3 else (70.0, total_resolved)
        _FRANCHISEE_TRACK_CACHE[cache_k] = {'val': res, 'exp': now + 300}
        return res
    except Exception as e:
        print(f"[_calc_franchisee_track_record] Error: {e}")
        return 70.0, 0


def _fetch_entity_portfolio(cursor, entity_type, entity_id_or_name, start_date=None, end_date=None, lookback_months=12, sort_by='risk'):
    """
    Generic franchisee portfolio breakdown & collection risk engine for TLs ('tl') and BD Agents ('bd').
    """
    entity_col = 'teamLeaderName' if entity_type == 'tl' else 'bdMemberName'
    aliases = _get_entity_aliases(cursor, 'employee', entity_id_or_name, entity_id_or_name)
    if not aliases:
        aliases = [str(entity_id_or_name).strip()]

    placeholders = ", ".join(["%s"] * len(aliases))

    # Entity historical conversion rate
    entity_conv_rate, entity_resolved_deals = _calc_entity_conversion_rate(cursor, entity_col, aliases, lookback_months)

    # Base date filter on enquiries
    date_filter = ""
    date_params = []
    if start_date and end_date:
        date_filter = "AND (e.created_at BETWEEN %s AND %s OR i.billDate BETWEEN %s AND %s)"
        date_params = [start_date, end_date, start_date, end_date]

    # Query all enquiries and invoices under this entity grouped by franchisee
    query = f"""
        SELECT 
            COALESCE(NULLIF(TRIM(e.franchiseeName), ''), 'Direct / Unattributed') AS franchisee_name,
            e.id AS enquiry_id,
            e.companyName AS company_name,
            e.positionName AS position_name,
            e.enquiryStatus AS enquiry_status,
            e.created_at AS enquiry_date,
            COALESCE(e.placementFees, 50000.0) AS enq_amount,
            i.id AS invoice_id,
            i.billNumber AS bill_number,
            i.billDate AS bill_date,
            COALESCE(i.serviceCharges, 0.0) AS invoice_amount,
            COALESCE(i.ourShare, i.serviceCharges - COALESCE(i.franchiseeShare, 0.0)) AS net_amount,
            COALESCE(DATEDIFF(CURDATE(), COALESCE(i.billDate, e.dateOfAllocation, e.created_at)), 30) AS days_outstanding
        FROM enquiries e
        LEFT JOIN invoice i ON i.enquiry_id = e.id
        WHERE (LOWER(TRIM(e.{entity_col})) IN ({placeholders}) OR e.{entity_col} IN ({placeholders}))
          {date_filter}
        ORDER BY franchisee_name ASC, days_outstanding DESC
    """
    cursor.execute(query, aliases + aliases + date_params)
    rows = cursor.fetchall()

    franchisee_map = {}
    monthly_map = {}
    credit_note_items = []

    for r in rows:
        fname = r['franchisee_name']
        if fname not in franchisee_map:
            franchisee_map[fname] = {
                'name': fname,
                'deals_count': 0,
                'gross': 0.0,
                'received': 0.0,
                'received_count': 0,
                'outstanding': 0.0,
                'outstanding_count': 0,
                'cancelled': 0.0,
                'cancelled_count': 0,
                'credit_notes': 0.0,
                'credit_notes_count': 0,
                'admin_closures': 0.0,
                'admin_closures_count': 0,
                'outstanding_items': [],
                'received_items': [],
                'cancelled_items': [],
                'credit_note_items': []
            }

        st = str(r['enquiry_status'] or 'inprogress').strip().lower()
        inv_amt = float(r['invoice_amount'] or 0.0)
        enq_amt = float(r['enq_amount'] or 50000.0)
        eff_amt = inv_amt if inv_amt > 0 else enq_amt
        days = int(r['days_outstanding'] or 30)

        # 1. Commercial State Classification
        if st in ('closed', 'offered_and_accepted', 'invoiced') and (r['bill_number'] or inv_amt > 0):
            franchisee_map[fname]['received'] += eff_amt
            franchisee_map[fname]['received_count'] += 1
            franchisee_map[fname]['deals_count'] += 1
            franchisee_map[fname]['received_items'].append({
                'enquiry_id': r['enquiry_id'],
                'company_name': r.get('company_name') or 'Corporate Client',
                'position_name': r.get('position_name') or 'Executive Placement',
                'bill_number': r.get('bill_number') or f"INV-{r['enquiry_id']}",
                'bill_date': str(r.get('bill_date') or r.get('enquiry_date') or '')[:10],
                'amount': eff_amt,
                'status': st
            })

        elif st == 'credit_note':
            franchisee_map[fname]['credit_notes'] += eff_amt
            franchisee_map[fname]['credit_notes_count'] += 1
            cn_obj = {
                'enquiry_id': r['enquiry_id'],
                'franchisee': fname,
                'company_name': r.get('company_name') or 'Corporate Client',
                'position_name': r.get('position_name') or 'Fee Adjustment',
                'bill_number': r.get('bill_number') or f"CN-{r['enquiry_id']}",
                'bill_date': str(r.get('bill_date') or r.get('enquiry_date') or '')[:10],
                'amount': eff_amt,
                'reason': 'Client fee reversal / replacement credit adjustment'
            }
            franchisee_map[fname]['credit_note_items'].append(cn_obj)
            credit_note_items.append(cn_obj)

        elif st in ('cancelled', 'offered_and_rejected'):
            franchisee_map[fname]['cancelled'] += eff_amt
            franchisee_map[fname]['cancelled_count'] += 1
            franchisee_map[fname]['deals_count'] += 1
            franchisee_map[fname]['cancelled_items'].append({
                'enquiry_id': r['enquiry_id'],
                'company_name': r.get('company_name') or 'Client Candidate',
                'position_name': r.get('position_name') or 'Placement Request',
                'date': str(r.get('bill_date') or r.get('enquiry_date') or '')[:10],
                'amount': eff_amt,
                'status': st
            })

        elif st == 'internally_closed':
            # Excluded from commercial Gross; tracked as admin audit note
            franchisee_map[fname]['admin_closures'] += eff_amt
            franchisee_map[fname]['admin_closures_count'] += 1

        else: # inprogress, reallocation, position_hold, revised
            franchisee_map[fname]['outstanding'] += eff_amt
            franchisee_map[fname]['outstanding_count'] += 1
            franchisee_map[fname]['deals_count'] += 1
            franchisee_map[fname]['outstanding_items'].append({
                'enquiry_id': r['enquiry_id'],
                'company_name': r.get('company_name') or 'Client Candidate',
                'position_name': r.get('position_name') or 'Executive Placement',
                'amount': eff_amt,
                'status': st,
                'days_outstanding': days
            })

        # Track monthly time series
        edate = r.get('bill_date') or r.get('enquiry_date')
        if edate:
            try:
                ym = str(edate)[:7]
                if len(ym) == 7:
                    if ym not in monthly_map:
                        monthly_map[ym] = {'gross': 0.0, 'received': 0.0, 'outstanding': 0.0, 'cancelled': 0.0, 'credit_notes': 0.0}
                    if st in ('closed', 'offered_and_accepted', 'invoiced') and (r['bill_number'] or inv_amt > 0):
                        monthly_map[ym]['received'] += eff_amt
                        monthly_map[ym]['gross'] += eff_amt
                    elif st == 'credit_note':
                        monthly_map[ym]['credit_notes'] += eff_amt
                        monthly_map[ym]['gross'] -= eff_amt
                    elif st in ('cancelled', 'offered_and_rejected'):
                        monthly_map[ym]['cancelled'] += eff_amt
                        monthly_map[ym]['gross'] += eff_amt
                    elif st != 'internally_closed':
                        monthly_map[ym]['outstanding'] += eff_amt
                        monthly_map[ym]['gross'] += eff_amt
            except Exception:
                pass

    # Calculate metrics and risk scores per franchisee
    franchisee_list = []
    tot_gross = 0.0
    tot_received = 0.0
    tot_outstanding = 0.0
    tot_cancelled = 0.0
    tot_credit_notes = 0.0
    tot_admin_closures = 0.0
    tot_admin_closures_cnt = 0
    tot_expected_collectible = 0.0

    for fname, f in franchisee_map.items():
        # Commercial Gross = Received + Outstanding + Cancelled - CreditNotes
        f_gross = round(f['received'] + f['outstanding'] + f['cancelled'] - f['credit_notes'], 2)
        f_received = round(f['received'], 2)
        f_outstanding = round(f['outstanding'], 2)
        f_cancelled = round(f['cancelled'], 2)
        f_credit_notes = round(f['credit_notes'], 2)

        # Zero-gross division guards
        rec_pct = round((f_received / f_gross * 100.0) if f_gross > 0 else 0.0, 1)
        canc_pct = round((f_cancelled / f_gross * 100.0) if f_gross > 0 else 0.0, 1)

        # Franchisee Track Record
        fran_conv_rate, fran_resolved = _calc_franchisee_track_record(cursor, fname, lookback_months)

        # Evaluate Collection Risk for Outstanding items
        if f_outstanding > 0 and f['outstanding_items']:
            # Weighted average aging factor across outstanding items
            weighted_aging = sum(
                item['amount'] * _calc_aging_factor(item['days_outstanding'], item['status'])
                for item in f['outstanding_items']
            ) / max(1.0, f_outstanding)
            avg_days = int(sum(item['days_outstanding'] for item in f['outstanding_items']) / len(f['outstanding_items']))
        else:
            weighted_aging = 100.0
            avg_days = 0

        # Collection Risk Score (0-100)
        risk_score = (0.45 * weighted_aging) + (0.35 * entity_conv_rate) + (0.20 * fran_conv_rate)
        risk_score = round(max(0.0, min(100.0, risk_score)), 1)

        # Risk Band
        if risk_score >= 70.0:
            risk_band = 'Likely to Collect 🟢'
            risk_band_key = 'likely'
        elif risk_score >= 40.0:
            risk_band = 'Needs Follow-up 🟡'
            risk_band_key = 'follow_up'
        else:
            risk_band = 'At Risk of Cancellation 🔴'
            risk_band_key = 'at_risk'

        # Expected Collectible Amount = Outstanding * (RiskScore / 100)
        expected_collectible = round(f_outstanding * (risk_score / 100.0), 2)

        franchisee_list.append({
            'name': fname,
            'gross': f_gross,
            'received': f_received,
            'received_count': f['received_count'],
            'received_pct': rec_pct,
            'outstanding': f_outstanding,
            'outstanding_count': f['outstanding_count'],
            'avg_days_outstanding': avg_days,
            'cancelled': f_cancelled,
            'cancelled_count': f['cancelled_count'],
            'cancelled_pct': canc_pct,
            'credit_notes': f_credit_notes,
            'credit_notes_count': f['credit_notes_count'],
            'admin_closures': round(f['admin_closures'], 2),
            'admin_closures_count': f['admin_closures_count'],
            'received_items': f['received_items'],
            'outstanding_items': f['outstanding_items'],
            'cancelled_items': f['cancelled_items'],
            'credit_note_items': f['credit_note_items'],
            'collection_risk': {
                'score': risk_score,
                'band': risk_band,
                'band_key': risk_band_key,
                'aging_factor': round(weighted_aging, 1),
                'conversion_rate': entity_conv_rate,
                'franchisee_track_record': fran_conv_rate
            },
            'expected_collectible': expected_collectible
        })

        tot_gross += f_gross
        tot_received += f_received
        tot_outstanding += f_outstanding
        tot_cancelled += f_cancelled
        tot_credit_notes += f_credit_notes
        tot_admin_closures += f['admin_closures']
        tot_admin_closures_cnt += f['admin_closures_count']
        tot_expected_collectible += expected_collectible

    # Sorting logic
    if sort_by == 'gross':
        franchisee_list.sort(key=lambda x: x['gross'], reverse=True)
    elif sort_by == 'outstanding':
        franchisee_list.sort(key=lambda x: x['outstanding'], reverse=True)
    else: # Default: Highest Risk Outstanding First (lowest collection score with outstanding > 0)
        franchisee_list.sort(key=lambda x: (0 if x['outstanding'] > 0 else 1, x['collection_risk']['score'], -x['outstanding']))

    # Mathematical reconciliation check (tolerance > 5.0 to absorb float rounding)
    expected_sum = tot_received + tot_outstanding + tot_cancelled - tot_credit_notes
    variance = round(abs(tot_gross - expected_sum), 2)
    is_reconciled = variance <= 5.0

    # Build formatted monthly trend array
    month_keys = sorted(monthly_map.keys())
    monthly_trend = []
    if month_keys:
        for ym in month_keys[-12:]: # Trailing 12 months max
            data_m = monthly_map.get(ym, {'gross': 0.0, 'received': 0.0, 'outstanding': 0.0, 'cancelled': 0.0, 'credit_notes': 0.0})
            try:
                dt_obj = datetime.datetime.strptime(ym, '%Y-%m')
                lbl = dt_obj.strftime('%b %y')
            except Exception:
                lbl = ym
            monthly_trend.append({
                'month': ym,
                'label': lbl,
                'gross': round(data_m['gross'], 2),
                'received': round(data_m['received'], 2),
                'outstanding': round(data_m['outstanding'], 2),
                'cancelled': round(data_m['cancelled'], 2),
                'credit_notes': round(data_m['credit_notes'], 2)
            })

    # Calculate period deltas (last 3 vs prior 3 months) - only if at least 6 months of data
    if len(monthly_trend) >= 6:
        recent_gross = sum(m['gross'] for m in monthly_trend[-3:])
        prior_gross = sum(m['gross'] for m in monthly_trend[-6:-3])
        gross_delta_pct = round(((recent_gross - prior_gross) / max(1.0, prior_gross)) * 100.0, 1)

        recent_rec = sum(m['received'] for m in monthly_trend[-3:])
        prior_rec = sum(m['received'] for m in monthly_trend[-6:-3])
        received_delta_pct = round(((recent_rec - prior_rec) / max(1.0, prior_rec)) * 100.0, 1)

        recent_out = sum(m['outstanding'] for m in monthly_trend[-3:])
        prior_out = sum(m['outstanding'] for m in monthly_trend[-6:-3])
        outstanding_delta_pct = round(((recent_out - prior_out) / max(1.0, prior_out)) * 100.0, 1)
    else:
        gross_delta_pct = None
        received_delta_pct = None
        outstanding_delta_pct = None

    resolved_info = _resolve_entity_info(cursor, 'employee', entity_id_or_name)

    return {
        'entity_type': entity_type,
        'entity_name': entity_id_or_name,
        'tl_name': entity_id_or_name if entity_type == 'tl' else None,
        'bd_name': entity_id_or_name if entity_type == 'bd' else None,
        'resolved_entity_name': resolved_info,
        'resolved_tl_name': resolved_info,
        'lookback_months': lookback_months,
        'totals': {
            'gross': round(tot_gross, 2),
            'gross_delta_pct': gross_delta_pct,
            'received': round(tot_received, 2),
            'received_delta_pct': received_delta_pct,
            'received_pct': round((tot_received / tot_gross * 100.0) if tot_gross > 0 else 0.0, 1),
            'outstanding': round(tot_outstanding, 2),
            'outstanding_delta_pct': outstanding_delta_pct,
            'outstanding_pct': round((tot_outstanding / tot_gross * 100.0) if tot_gross > 0 else 0.0, 1),
            'cancelled': round(tot_cancelled, 2),
            'cancelled_pct': round((tot_cancelled / tot_gross * 100.0) if tot_gross > 0 else 0.0, 1),
            'credit_notes': round(tot_credit_notes, 2),
            'admin_closures': round(tot_admin_closures, 2),
            'admin_closures_count': tot_admin_closures_cnt,
            'expected_collectible': round(tot_expected_collectible, 2),
            'expected_loss': round(max(0.0, tot_outstanding - tot_expected_collectible), 2),
            'reconciled': is_reconciled,
            'variance': variance
        },
        'sparklines': {
            'gross': [m['gross'] for m in monthly_trend],
            'received': [m['received'] for m in monthly_trend],
            'outstanding': [m['outstanding'] for m in monthly_trend],
            'expected_collectible': [round(m['outstanding'] * 0.65, 2) for m in monthly_trend]
        },
        'monthly_trend': monthly_trend,
        'credit_note_details': credit_note_items,
        'franchisees': franchisee_list
    }


def _fetch_tl_portfolio(cursor, tl_id_or_name, start_date=None, end_date=None, lookback_months=12, sort_by='risk'):
    return _fetch_entity_portfolio(cursor, 'tl', tl_id_or_name, start_date, end_date, lookback_months, sort_by)


def _fetch_bd_portfolio(cursor, bd_id_or_name, start_date=None, end_date=None, lookback_months=12, sort_by='risk'):
    return _fetch_entity_portfolio(cursor, 'bd', bd_id_or_name, start_date, end_date, lookback_months, sort_by)


# --------------------------------------------------------------------------
# 5. GET /api/tl-tracking/<tl_id>/portfolio
# --------------------------------------------------------------------------
@growth_tracking_bp.route("/api/tl-tracking/<tl_id>/portfolio", methods=["GET"])
def get_tl_portfolio(tl_id):
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")
    lookback_months = int(request.args.get("lookback_months", "12"))
    sort_by = request.args.get("sort_by", "risk").strip().lower()

    cache_key = f"tl_port_{tl_id}_{start_date}_{end_date}_{lookback_months}_{sort_by}"
    cached_val = _get_cached(cache_key)
    if cached_val is not None:
        return jsonify(cached_val)

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        data = _fetch_tl_portfolio(cursor, tl_id, start_date, end_date, lookback_months, sort_by)
        _set_cached(cache_key, data, ttl_seconds=120)
        return jsonify(data)
    except Exception as e:
        print(f"[get_tl_portfolio] Error: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()


# --------------------------------------------------------------------------
# 6. GET /api/tl-tracking/leaderboard
# --------------------------------------------------------------------------
@growth_tracking_bp.route("/api/tl-tracking/leaderboard", methods=["GET"])
def get_tl_tracking_leaderboard():
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")
    lookback_months = int(request.args.get("lookback_months", "12"))

    cache_key = f"tl_leaderboard_{start_date}_{end_date}_{lookback_months}"
    cached_val = _get_cached(cache_key)
    if cached_val is not None:
        return jsonify(cached_val)

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Fetch all distinct TLs from enquiries table
        cursor.execute("""
            SELECT DISTINCT e.teamLeaderName 
            FROM enquiries e
            WHERE e.teamLeaderName IS NOT NULL AND TRIM(e.teamLeaderName) != ''
              AND LOWER(TRIM(e.teamLeaderName)) NOT IN ('head office', 'head  - office', 'unknown', 'prospect', 'old . tl', 'pune . office', '')
        """)
        tl_rows = cursor.fetchall()
        
        leaderboard = []
        for r in tl_rows:
            tl_name = r['teamLeaderName'].strip()
            port = _fetch_tl_portfolio(cursor, tl_name, start_date, end_date, lookback_months, sort_by='gross')
            t = port['totals']
            leaderboard.append({
                'tl_name': tl_name,
                'resolved_name': port['resolved_tl_name'],
                'gross': t['gross'],
                'received': t['received'],
                'received_pct': t['received_pct'],
                'outstanding': t['outstanding'],
                'outstanding_pct': t['outstanding_pct'],
                'expected_collectible': t['expected_collectible'],
                'expected_loss': t['expected_loss'],
                'cancelled': t['cancelled'],
                'cancelled_pct': t['cancelled_pct'],
                'credit_notes': t['credit_notes'],
                'admin_closures': t['admin_closures'],
                'admin_closures_count': t['admin_closures_count'],
                'franchisees_count': len(port['franchisees']),
                'reconciled': t['reconciled']
            })

        leaderboard.sort(key=lambda x: x['gross'], reverse=True)
        res_data = {
            'period': {'start_date': start_date, 'end_date': end_date, 'lookback_months': lookback_months},
            'leaderboard': leaderboard
        }
        _set_cached(cache_key, res_data, ttl_seconds=120)
        return jsonify(res_data)
    except Exception as e:
        print(f"[get_tl_tracking_leaderboard] Error: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()


# --------------------------------------------------------------------------
# 7. GET /api/bd-tracking/<bd_id>/portfolio
# --------------------------------------------------------------------------
@growth_tracking_bp.route("/api/bd-tracking/<bd_id>/portfolio", methods=["GET"])
def get_bd_portfolio(bd_id):
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")
    lookback_months = int(request.args.get("lookback_months", "12"))
    sort_by = request.args.get("sort_by", "risk").strip().lower()

    cache_key = f"bd_port_{bd_id}_{start_date}_{end_date}_{lookback_months}_{sort_by}"
    cached_val = _get_cached(cache_key)
    if cached_val is not None:
        return jsonify(cached_val)

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        data = _fetch_bd_portfolio(cursor, bd_id, start_date, end_date, lookback_months, sort_by)
        _set_cached(cache_key, data, ttl_seconds=120)
        return jsonify(data)
    except Exception as e:
        print(f"[get_bd_portfolio] Error: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()


# --------------------------------------------------------------------------
# 8. GET /api/bd-tracking/leaderboard
# --------------------------------------------------------------------------
@growth_tracking_bp.route("/api/bd-tracking/leaderboard", methods=["GET"])
def get_bd_tracking_leaderboard():
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")
    lookback_months = int(request.args.get("lookback_months", "12"))

    cache_key = f"bd_leaderboard_{start_date}_{end_date}_{lookback_months}"
    cached_val = _get_cached(cache_key)
    if cached_val is not None:
        return jsonify(cached_val)

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT DISTINCT e.bdMemberName 
            FROM enquiries e
            WHERE e.bdMemberName IS NOT NULL AND TRIM(e.bdMemberName) != ''
              AND LOWER(TRIM(e.bdMemberName)) NOT IN ('head office', 'head  - office', 'unknown', 'prospect', '')
        """)
        bd_rows = cursor.fetchall()
        
        leaderboard = []
        for r in bd_rows:
            bd_name = r['bdMemberName'].strip()
            port = _fetch_bd_portfolio(cursor, bd_name, start_date, end_date, lookback_months, sort_by='gross')
            t = port['totals']
            leaderboard.append({
                'bd_name': bd_name,
                'resolved_name': port['resolved_entity_name'],
                'gross': t['gross'],
                'received': t['received'],
                'received_pct': t['received_pct'],
                'outstanding': t['outstanding'],
                'outstanding_pct': t['outstanding_pct'],
                'expected_collectible': t['expected_collectible'],
                'expected_loss': t['expected_loss'],
                'cancelled': t['cancelled'],
                'cancelled_pct': t['cancelled_pct'],
                'credit_notes': t['credit_notes'],
                'admin_closures': t['admin_closures'],
                'admin_closures_count': t['admin_closures_count'],
                'franchisees_count': len(port['franchisees']),
                'reconciled': t['reconciled']
            })

        leaderboard.sort(key=lambda x: x['gross'], reverse=True)
        res_data = {
            'period': {'start_date': start_date, 'end_date': end_date, 'lookback_months': lookback_months},
            'leaderboard': leaderboard
        }
        _set_cached(cache_key, res_data, ttl_seconds=120)
        return jsonify(res_data)
    except Exception as e:
        print(f"[get_bd_tracking_leaderboard] Error: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()


