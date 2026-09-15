import os
import uuid
import datetime
import math
import statistics
from flask import Blueprint, request, jsonify
from db import get_db_connection

growth_tracking_bp = Blueprint("growth_tracking", __name__)

# Fallback seed data in case database is empty or running offline
FALLBACK_FRANCHISEE_HISTORICAL = {
    'Nagpur Central': [
        {'period': '2023-24', 'revenue': 4200000.0},
        {'period': '2024-25', 'revenue': 5500000.0},
        {'period': '2025-26', 'revenue': 7200000.0}
    ],
    'Pune East': [
        {'period': '2023-24', 'revenue': 3100000.0},
        {'period': '2024-25', 'revenue': 4200000.0},
        {'period': '2025-26', 'revenue': 5800000.0}
    ],
    'Mumbai South': [
        {'period': '2023-24', 'revenue': 6000000.0},
        {'period': '2024-25', 'revenue': 8500000.0},
        {'period': '2025-26', 'revenue': 11500000.0}
    ],
    'Nashik Hub': [
        {'period': '2023-24', 'revenue': 2200000.0},
        {'period': '2024-25', 'revenue': 2900000.0},
        {'period': '2025-26', 'revenue': 3900000.0}
    ]
}

FALLBACK_BD_HISTORICAL = {
    'Rohan Mehta': [
        {'period': '2023-24', 'revenue': 8500000.0},
        {'period': '2024-25', 'revenue': 11200000.0},
        {'period': '2025-26', 'revenue': 14800000.0}
    ],
    'Neha Sharma': [
        {'period': '2023-24', 'revenue': 6200000.0},
        {'period': '2024-25', 'revenue': 8400000.0},
        {'period': '2025-26', 'revenue': 10900000.0}
    ],
    'Karan Malhotra': [
        {'period': '2023-24', 'revenue': 11000000.0},
        {'period': '2024-25', 'revenue': 15500000.0},
        {'period': '2025-26', 'revenue': 21000000.0}
    ],
    'Anjali Verma': [
        {'period': '2023-24', 'revenue': 3800000.0},
        {'period': '2024-25', 'revenue': 4900000.0},
        {'period': '2025-26', 'revenue': 6500000.0}
    ]
}

USE_DEMO_FALLBACK_DATA = os.environ.get('USE_DEMO_FALLBACK_DATA', 'false').lower() in ('true', '1', 'yes')


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
    """Normalizes fiscal year string to standard YYYY-YYYY format (e.g. '2025-26' -> '2025-2026')."""
    if not raw:
        return '2025-2026'
    s = str(raw).strip()
    if len(s) == 7 and s[4] == '-':
        p1 = s[:4]
        p2 = s[5:]
        if p2.isdigit() and len(p2) == 2:
            return f"{p1}-20{p2}"
    if len(s) == 4 and s.isdigit():
        y = int(s)
        return f"{y}-{y+1}"
    return s


def _fetch_historical_revenue_and_stats(cursor, entity_type, entity_id, entity_name):
    """
    Pulls historical yearly and monthly revenue metrics, deal volume, and history duration.
    """
    historical_series = []
    monthly_series = []
    months_of_history = 0

    aliases = _get_entity_aliases(cursor, entity_type, entity_id, entity_name)
    if not aliases:
        aliases = [entity_name, str(entity_id)]

    placeholders = ", ".join(["%s"] * len(aliases))

    try:
        if entity_type == 'franchisee':
            query = f"""
                SELECT 
                    COALESCE(financialYear, SUBSTRING(billDate, 1, 4)) AS period,
                    SUM(COALESCE(serviceCharges, 0.0)) AS gross_revenue,
                    SUM(COALESCE(franchiseeShare, 0.0)) AS franchisee_share,
                    SUM(COALESCE(ourShare, serviceCharges - COALESCE(franchiseeShare, 0.0))) AS net_revenue,
                    COUNT(*) AS deals_count
                FROM invoice
                WHERE (LOWER(TRIM(franchiseName)) IN ({placeholders}) OR franchiseName IN ({placeholders}))
                  AND billNumber IS NOT NULL AND billNumber != ''
                GROUP BY period
                ORDER BY period ASC
            """
            cursor.execute(query, aliases + aliases)
            rows = cursor.fetchall()
            
            period_map = {}
            for r in rows:
                if r.get('period'):
                    p_norm = _normalize_fy(r['period'])
                    if p_norm not in period_map:
                        period_map[p_norm] = {
                            'period': p_norm,
                            'revenue': 0.0,
                            'net_revenue': 0.0,
                            'deals_count': 0
                        }
                    period_map[p_norm]['revenue'] += float(r['gross_revenue'] or 0.0)
                    period_map[p_norm]['net_revenue'] += float(r['net_revenue'] or 0.0)
                    period_map[p_norm]['deals_count'] += int(r['deals_count'] or 0)
            
            historical_series = sorted(list(period_map.values()), key=lambda x: x['period'])

            # Monthly stats for franchisee
            m_query = f"""
                SELECT 
                    SUBSTRING(billDate, 1, 7) AS month_str,
                    COUNT(*) AS deals_count,
                    SUM(COALESCE(serviceCharges, 0.0)) AS monthly_revenue
                FROM invoice
                WHERE (LOWER(TRIM(franchiseName)) IN ({placeholders}) OR franchiseName IN ({placeholders}))
                  AND billNumber IS NOT NULL AND billNumber != '' AND billDate IS NOT NULL AND billDate != ''
                GROUP BY month_str
                ORDER BY month_str ASC
            """
            cursor.execute(m_query, aliases + aliases)
            m_rows = cursor.fetchall()
            for mr in m_rows:
                if mr.get('month_str'):
                    monthly_series.append({
                        'month': str(mr['month_str']),
                        'deals': int(mr['deals_count'] or 0),
                        'revenue': float(mr['monthly_revenue'] or 0.0)
                    })
            months_of_history = len(monthly_series)

        else: # bd_agent or employee
            query = f"""
                SELECT 
                    COALESCE(financialYear, SUBSTRING(billDate, 1, 4)) AS period,
                    SUM(COALESCE(serviceCharges, 0.0)) AS gross_revenue,
                    SUM(COALESCE(ourShare, serviceCharges - COALESCE(franchiseeShare, 0.0))) AS net_revenue,
                    COUNT(*) AS deals_count
                FROM invoice
                WHERE (LOWER(TRIM(nameOfBd)) IN ({placeholders}) OR nameOfBd IN ({placeholders}))
                  AND billNumber IS NOT NULL AND billNumber != ''
                GROUP BY period
                ORDER BY period ASC
            """
            cursor.execute(query, aliases + aliases)
            rows = cursor.fetchall()
            
            period_map = {}
            for r in rows:
                if r.get('period'):
                    p_norm = _normalize_fy(r['period'])
                    if p_norm not in period_map:
                        period_map[p_norm] = {
                            'period': p_norm,
                            'revenue': 0.0,
                            'net_revenue': 0.0,
                            'deals_count': 0
                        }
                    period_map[p_norm]['revenue'] += float(r['gross_revenue'] or 0.0)
                    period_map[p_norm]['net_revenue'] += float(r['net_revenue'] or 0.0)
                    period_map[p_norm]['deals_count'] += int(r['deals_count'] or 0)
            
            historical_series = sorted(list(period_map.values()), key=lambda x: x['period'])

            # Monthly stats for BD/Employee
            m_query = f"""
                SELECT 
                    SUBSTRING(billDate, 1, 7) AS month_str,
                    COUNT(*) AS deals_count,
                    SUM(COALESCE(serviceCharges, 0.0)) AS monthly_revenue
                FROM invoice
                WHERE (LOWER(TRIM(nameOfBd)) IN ({placeholders}) OR nameOfBd IN ({placeholders}))
                  AND billNumber IS NOT NULL AND billNumber != '' AND billDate IS NOT NULL AND billDate != ''
                GROUP BY month_str
                ORDER BY month_str ASC
            """
            cursor.execute(m_query, aliases + aliases)
            m_rows = cursor.fetchall()
            for mr in m_rows:
                if mr.get('month_str'):
                    monthly_series.append({
                        'month': str(mr['month_str']),
                        'deals': int(mr['deals_count'] or 0),
                        'revenue': float(mr['monthly_revenue'] or 0.0)
                    })
            months_of_history = len(monthly_series)

            # If no closed invoices, check if there are pipeline enquiries to establish tenure
            if months_of_history == 0:
                try:
                    cursor.execute(f"""
                        SELECT COUNT(DISTINCT SUBSTRING(created_at, 1, 7)) as enq_months, COUNT(*) as total_enq
                        FROM enquiries
                        WHERE (LOWER(TRIM(bdMemberName)) IN ({placeholders}) OR LOWER(TRIM(teamLeaderName)) IN ({placeholders}))
                    """, aliases + aliases)
                    enq_res = cursor.fetchone()
                    if enq_res and enq_res.get('enq_months'):
                        months_of_history = int(enq_res['enq_months'] or 0)
                except Exception:
                    pass

    except Exception as e:
        raise RuntimeError(f"Database query failed while fetching historical data for {entity_type} '{entity_name}': {e}")

    # Seed fallback if enabled
    if not historical_series and USE_DEMO_FALLBACK_DATA:
        if entity_type == 'franchisee':
            match = FALLBACK_FRANCHISEE_HISTORICAL.get(entity_name)
            if match:
                historical_series = [
                    {'period': item['period'], 'revenue': item['revenue'], 'net_revenue': item['revenue'] * 0.4375, 'deals_count': max(5, int(item['revenue'] / 150000))}
                    for item in match
                ]
                months_of_history = 12
        else:
            match = FALLBACK_BD_HISTORICAL.get(entity_name)
            if match:
                historical_series = [
                    {'period': item['period'], 'revenue': item['revenue'], 'net_revenue': item['revenue'] * 0.4375, 'deals_count': max(8, int(item['revenue'] / 180000))}
                    for item in match
                ]
                months_of_history = 12

    return historical_series, monthly_series, months_of_history


def _calculate_cagr(historical_series):
    """Calculates Compound Annual Growth Rate from series. Returns None if series is insufficient."""
    if not historical_series or len(historical_series) < 2:
        return None

    first_val = historical_series[0].get('revenue', 0.0)
    last_val = historical_series[-1].get('revenue', 0.0)
    periods = len(historical_series) - 1

    if first_val <= 0 or last_val <= 0 or periods <= 0:
        return None

    try:
        cagr = math.pow(last_val / first_val, 1.0 / periods) - 1.0
        return max(-0.50, min(2.0, cagr))
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

        elif entity_type in ('bd_agent', 'bd_specialist'):
            status_clause = "" if include_inactive else "WHERE e.status = 'active'"
            query = f"""
                SELECT e.id, e.canonical_name, e.role, e.status, e.hire_date
                FROM employees e
                {status_clause}
                {"AND" if status_clause else "WHERE"} e.role = 'bd_specialist'
                ORDER BY e.canonical_name ASC
            """
            cursor.execute(query)
            rows = cursor.fetchall()
            for r in rows:
                hist, monthly, months = _fetch_historical_revenue_and_stats(cursor, 'bd_agent', r['id'], r['canonical_name'])
                tot_rev = sum(h['revenue'] for h in hist)
                tot_deals = sum(h['deals_count'] for h in hist)
                cagr = _calculate_cagr(hist)
                score_data = _compute_productivity_score(monthly, months)
                roster.append({
                    'id': str(r['id']),
                    'name': r['canonical_name'],
                    'canonical_name': r['canonical_name'],
                    'type': 'bd_agent',
                    'role': 'BD Specialist',
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

        return jsonify({'entity_type': entity_type, 'roster': roster})
    except Exception as e:
        print(f"[get_entity_roster] Error: {e}")
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
    custom_rate = request.args.get("rate")

    if not entity_id:
        return jsonify({"error": "Missing required entity_id parameter"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        entity_name = _resolve_entity_info(cursor, entity_type, entity_id, request.args.get("entity_name"))
        historical_series, monthly_series, months_of_history = _fetch_historical_revenue_and_stats(cursor, entity_type, entity_id, entity_name)
        
        # Calculate Productivity Score
        score_data = _compute_productivity_score(monthly_series, months_of_history)

        # Gated data-maturity check: If months_of_history < 3, flag insufficient data
        if months_of_history < 3 or not historical_series:
            months_needed = max(1, 3 - months_of_history)
            return jsonify({
                'entity_type': entity_type,
                'entity_id': entity_id,
                'entity_name': entity_name,
                'projection_status': 'insufficient_data',
                'insufficient_data': True,
                'months_of_history': months_of_history,
                'months_until_available': months_needed,
                'confidence': 'insufficient_data',
                'message': f"Projection available after {months_needed} more month(s) of closed deal history.",
                'productivity_score': score_data,
                'base_revenue': 0.0,
                'historical_cagr': None,
                'historical_cagr_pct': None,
                'applied_rate': None,
                'applied_rate_pct': None,
                'historical_series': historical_series,
                'projections': [],
                'scenarios': {}
            })

        # Confidence rating
        confidence = 'high' if months_of_history >= 6 else 'low'

        # Calculate Base Revenue and CAGR
        base_revenue = historical_series[-1]['revenue']
        historical_cagr = _calculate_cagr(historical_series)

        # Target growth rate R
        if custom_rate is not None and custom_rate != "":
            try:
                selected_r = float(custom_rate)
                if selected_r > 1.0 and selected_r <= 100.0:
                    selected_r = selected_r / 100.0
            except ValueError:
                selected_r = historical_cagr if historical_cagr is not None else 0.15
        else:
            selected_r = historical_cagr if historical_cagr is not None else 0.15

        # 5-Year Forward Projections (t=1..5): projected[t] = base * (1 + R)^t
        projections = []
        deal_base = historical_series[-1].get('deals_count', 5)
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
                'estimated_net': round(base_revenue * m * 0.4375, 2),
                'deals_target': max(1, int(round(deal_base * m)))
            }
            for m in range(1, 6)
        }

        return jsonify({
            'entity_type': entity_type,
            'entity_id': entity_id,
            'entity_name': entity_name,
            'projection_status': 'active',
            'insufficient_data': False,
            'confidence': confidence,
            'months_of_history': months_of_history,
            'productivity_score': score_data,
            'base_revenue': round(base_revenue, 2),
            'historical_cagr': round(historical_cagr, 4) if historical_cagr is not None else None,
            'historical_cagr_pct': round(historical_cagr * 100, 2) if historical_cagr is not None else None,
            'applied_rate': round(selected_r, 4),
            'applied_rate_pct': round(selected_r * 100, 2),
            'historical_series': historical_series,
            'projections': projections,
            'scenarios': scenarios
        })
    except RuntimeError as re:
        print(f"[predict_growth] Query failure: {re}")
        return jsonify({'error': 'database_query_failed', 'message': str(re)}), 500
    except Exception as e:
        print(f"[predict_growth] Exception: {e}")
        return jsonify({'error': 'server_error', 'message': str(e)}), 500
    finally:
        conn.close()


# --------------------------------------------------------------------------
# 3. POST /api/growth-targets (Create target memo)
# --------------------------------------------------------------------------
@growth_tracking_bp.route("/api/growth-targets", methods=["POST"])
def create_growth_target():
    data = request.get_json() or {}
    entity_type = data.get("entity_type", "employee").strip().lower()
    entity_id = str(data.get("entity_id", "")).strip()
    growth_pct_target = float(data.get("growth_pct_target", 0.0))
    salary_target = float(data.get("salary_target")) if data.get("salary_target") is not None and data.get("salary_target") != "" else None
    period_start = data.get("period_start", "").strip()
    period_end = data.get("period_end", "").strip()
    guidelines = data.get("guidelines", "").strip()

    if not entity_id or not period_start or not period_end:
        return jsonify({"error": "Missing required fields: entity_id, period_start, period_end"}), 400

    normalized_growth = growth_pct_target / 100.0 if growth_pct_target > 1.0 else growth_pct_target
    target_id = f"gt-{uuid.uuid4().hex[:10]}"
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        entity_name = _resolve_entity_info(cursor, entity_type, entity_id, data.get("entity_name"))
        historical_series, _, _ = _fetch_historical_revenue_and_stats(cursor, entity_type, entity_id, entity_name)
        base_value = historical_series[-1]['revenue'] if historical_series else 0.0
        target_value = base_value * (1.0 + normalized_growth) if base_value > 0 else 0.0

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

        insert_sql = """
            INSERT INTO growth_targets (
                id, entity_type, entity_id, growth_pct_target, salary_target,
                period_start, period_end, guidelines, status,
                target_letter_text, target_letter_sent_at, created_at, updated_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
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
            letter_text,
            now_str,
            now_str,
            now_str
        ])
        conn.commit()

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
            'salary_target': salary_target,
            'period_start': period_start,
            'period_end': period_end,
            'guidelines': guidelines,
            'status': 'active',
            'target_letter_text': letter_text,
            'created_at': now_str
        }), 201
    except Exception as e:
        print(f"[create_growth_target] Error: {e}")
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

        if entity_type:
            query += " AND entity_type = %s"
            params.append(entity_type.strip().lower())
        if entity_id:
            query += " AND entity_id = %s"
            params.append(str(entity_id).strip())
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
                'created_at': str(r['created_at'])
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
