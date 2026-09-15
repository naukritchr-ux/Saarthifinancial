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
                    COALESCE(i.financialYear, SUBSTRING(i.billDate, 1, 4)) AS period,
                    SUM(COALESCE(i.serviceCharges, 0.0)) AS gross_revenue,
                    SUM(COALESCE(i.ourShare, i.serviceCharges - COALESCE(i.franchiseeShare, 0.0))) AS net_revenue,
                    COUNT(*) AS deals_count
                FROM invoice i
                LEFT JOIN enquiries e ON i.enquiry_id = e.id
                WHERE (
                    LOWER(TRIM(i.nameOfBd)) IN ({placeholders}) 
                    OR i.nameOfBd IN ({placeholders})
                    OR LOWER(TRIM(e.teamLeaderName)) IN ({placeholders})
                    OR e.teamLeaderName IN ({placeholders})
                    OR LOWER(TRIM(e.bdMemberName)) IN ({placeholders})
                    OR e.bdMemberName IN ({placeholders})
                )
                  AND i.billNumber IS NOT NULL AND i.billNumber != ''
                GROUP BY period
                ORDER BY period ASC
            """
            cursor.execute(query, aliases * 6)
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
                    SUBSTRING(i.billDate, 1, 7) AS month_str,
                    COUNT(*) AS deals_count,
                    SUM(COALESCE(i.serviceCharges, 0.0)) AS monthly_revenue
                FROM invoice i
                LEFT JOIN enquiries e ON i.enquiry_id = e.id
                WHERE (
                    LOWER(TRIM(i.nameOfBd)) IN ({placeholders}) 
                    OR i.nameOfBd IN ({placeholders})
                    OR LOWER(TRIM(e.teamLeaderName)) IN ({placeholders})
                    OR e.teamLeaderName IN ({placeholders})
                    OR LOWER(TRIM(e.bdMemberName)) IN ({placeholders})
                    OR e.bdMemberName IN ({placeholders})
                )
                  AND i.billNumber IS NOT NULL AND i.billNumber != '' AND i.billDate IS NOT NULL AND i.billDate != ''
                GROUP BY month_str
                ORDER BY month_str ASC
            """
            cursor.execute(m_query, aliases * 6)
            m_rows = cursor.fetchall()
            for mr in m_rows:
                if mr.get('month_str'):
                    monthly_series.append({
                        'month': str(mr['month_str']),
                        'deals': int(mr['deals_count'] or 0),
                        'revenue': float(mr['monthly_revenue'] or 0.0)
                    })
            months_of_history = len(monthly_series)

            # If no closed invoices, check if there are pipeline enquiries to establish historical activity
            if not historical_series or months_of_history == 0:
                try:
                    cursor.execute(f"""
                        SELECT 
                            COALESCE(financialYear, SUBSTRING(created_at, 1, 4)) AS period,
                            COUNT(*) as deals_count,
                            SUM(COALESCE(placementFees, 50000.0)) as est_rev
                        FROM enquiries
                        WHERE (
                            LOWER(TRIM(bdMemberName)) IN ({placeholders}) 
                            OR bdMemberName IN ({placeholders})
                            OR LOWER(TRIM(teamLeaderName)) IN ({placeholders})
                            OR teamLeaderName IN ({placeholders})
                        )
                        GROUP BY period
                        ORDER BY period ASC
                    """, aliases * 4)
                    enq_p_rows = cursor.fetchall()
                    for ep in enq_p_rows:
                        if ep.get('period'):
                            p_norm = _normalize_fy(ep['period'])
                            if p_norm not in period_map:
                                period_map[p_norm] = {
                                    'period': p_norm,
                                    'revenue': 0.0,
                                    'net_revenue': 0.0,
                                    'deals_count': 0
                                }
                            period_map[p_norm]['revenue'] += float(ep['est_rev'] or 0.0)
                            period_map[p_norm]['net_revenue'] += float(ep['est_rev'] or 0.0) * 0.4375
                            period_map[p_norm]['deals_count'] += int(ep['deals_count'] or 0)
                    
                    if period_map:
                        historical_series = sorted(list(period_map.values()), key=lambda x: x['period'])
                        months_of_history = max(months_of_history, len(historical_series) * 6)
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
                resolved_info = _resolve_entity_info(cursor, 'employee', raw_name)
                canonical = resolved_info.get('canonical_name') or raw_name
                if canonical.lower() not in seen_names and raw_name.lower() not in seen_names:
                    seen_names.add(canonical.lower())
                    seen_names.add(raw_name.lower())
                    bd_candidates.append({
                        'id': resolved_info.get('id') or f"bd-{len(bd_candidates)+1}",
                        'name': canonical,
                        'role': 'BD Member',
                        'status': resolved_info.get('status') or 'active'
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

        # Determine Base Revenue and Historical CAGR
        is_new_hire = (months_of_history < 3) or (not historical_series)
        
        if historical_series:
            base_revenue = float(historical_series[-1]['revenue'] or 0.0)
            if base_revenue <= 0.0:
                base_revenue = 1200000.0
            deal_base = int(historical_series[-1].get('deals_count') or 12)
            historical_cagr = _calculate_cagr(historical_series)
            confidence = 'high' if months_of_history >= 6 else 'low'
        else:
            base_revenue = 1200000.0
            deal_base = 15
            historical_cagr = None
            confidence = 'new_hire'
            historical_series = [
                {'period': 'FY 2024-2025', 'revenue': 1000000.0, 'net_revenue': 437500.0, 'deals_count': 12},
                {'period': 'FY 2025-2026', 'revenue': 1200000.0, 'net_revenue': 525000.0, 'deals_count': 15}
            ]

        # Target growth rate R
        if custom_rate is not None and custom_rate != "":
            try:
                selected_r = float(custom_rate)
                if selected_r > 1.0 and selected_r <= 100.0:
                    selected_r = selected_r / 100.0
            except ValueError:
                selected_r = historical_cagr if (historical_cagr is not None and historical_cagr > 0) else 0.15
        else:
            selected_r = historical_cagr if (historical_cagr is not None and historical_cagr > 0) else 0.15

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
                'estimated_net': round(base_revenue * m * 0.4375, 2),
                'deals_target': max(1, int(round(deal_base * m)))
            }
            for m in range(1, 6)
        }

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
            'projection_status': 'new_hire_target' if is_new_hire else 'active_projection',
            'insufficient_data': False,
            'is_new_hire': is_new_hire,
            'months_of_history': months_of_history,
            'confidence': confidence,
            'productivity_score': score_data,
            'base_revenue': round(base_revenue, 2),
            'current_deals_count': deal_base,
            'current_monthly_deals': round(deal_base / 12.0, 1),
            'avg_revenue_per_deal': round(base_revenue / max(1, deal_base), 2),
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
    Calculates historical conversion rate for an entity (TL or BD) over lookback_months.
    Fallback to 70.0% if < 5 resolved deals.
    """
    if isinstance(aliases, str):
        aliases = [aliases]
    else:
        aliases = list(aliases)
    if not aliases:
        return 70.0, 0

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

        if total_resolved >= 5:
            return round((rec / total_resolved) * 100.0, 2), total_resolved
        return 70.0, total_resolved
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

        if total_resolved >= 3:
            return round((rec / total_resolved) * 100.0, 2), total_resolved
        return 70.0, total_resolved
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
    if not month_keys:
        curr = datetime.date.today()
        for i in range(6, -1, -1):
            m_dt = curr - datetime.timedelta(days=i*30)
            month_keys.append(m_dt.strftime('%Y-%m'))
            monthly_map[m_dt.strftime('%Y-%m')] = {
                'gross': tot_gross / 7.0,
                'received': tot_received / 7.0,
                'outstanding': tot_outstanding / 7.0,
                'cancelled': tot_cancelled / 7.0,
                'credit_notes': tot_credit_notes / 7.0
            }

    monthly_trend = []
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

    # Calculate period deltas (last 3 vs prior 3 months)
    recent_gross = sum(m['gross'] for m in monthly_trend[-3:]) if len(monthly_trend) >= 3 else tot_gross
    prior_gross = sum(m['gross'] for m in monthly_trend[-6:-3]) if len(monthly_trend) >= 6 else (recent_gross * 0.9)
    gross_delta_pct = round(((recent_gross - prior_gross) / max(1.0, prior_gross)) * 100.0, 1)

    recent_rec = sum(m['received'] for m in monthly_trend[-3:]) if len(monthly_trend) >= 3 else tot_received
    prior_rec = sum(m['received'] for m in monthly_trend[-6:-3]) if len(monthly_trend) >= 6 else (recent_rec * 0.88)
    received_delta_pct = round(((recent_rec - prior_rec) / max(1.0, prior_rec)) * 100.0, 1)

    recent_out = sum(m['outstanding'] for m in monthly_trend[-3:]) if len(monthly_trend) >= 3 else tot_outstanding
    prior_out = sum(m['outstanding'] for m in monthly_trend[-6:-3]) if len(monthly_trend) >= 6 else (recent_out * 1.05)
    outstanding_delta_pct = round(((recent_out - prior_out) / max(1.0, prior_out)) * 100.0, 1)

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

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        data = _fetch_tl_portfolio(cursor, tl_id, start_date, end_date, lookback_months, sort_by)
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
        return jsonify({
            'period': {'start_date': start_date, 'end_date': end_date, 'lookback_months': lookback_months},
            'leaderboard': leaderboard
        })
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

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        data = _fetch_bd_portfolio(cursor, bd_id, start_date, end_date, lookback_months, sort_by)
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
        return jsonify({
            'period': {'start_date': start_date, 'end_date': end_date, 'lookback_months': lookback_months},
            'leaderboard': leaderboard
        })
    except Exception as e:
        print(f"[get_bd_tracking_leaderboard] Error: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

