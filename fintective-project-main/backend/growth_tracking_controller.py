import os
import uuid
import datetime
import math
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

    elif entity_type == 'bd_agent':
        try:
            cursor.execute("SELECT name, role, baseSalary FROM bd_agents WHERE id = %s OR LOWER(name) = %s LIMIT 1", [clean_id, clean_id.lower()])
            row = cursor.fetchone()
            if row and row.get('name'):
                return row['name'].strip()
        except Exception:
            pass

        if clean_id.lower().startswith('bd-'):
            sub_id = clean_id[3:]
            if sub_id.isdigit():
                try:
                    cursor.execute("SELECT name FROM bd_agents WHERE id = %s LIMIT 1", [int(sub_id)])
                    row = cursor.fetchone()
                    if row and row.get('name'):
                        return row['name'].strip()
                except Exception:
                    pass

        try:
            cursor.execute("SELECT DISTINCT nameOfBd FROM invoice WHERE LOWER(TRIM(nameOfBd)) = %s LIMIT 1", [clean_id.lower()])
            row = cursor.fetchone()
            if row and row.get('nameOfBd'):
                return row['nameOfBd'].strip()
        except Exception:
            pass

    return entity_name


def _fetch_historical_revenue(cursor, entity_type, entity_id, entity_name):
    """
    Pulls historical yearly and monthly revenue metrics for the entity from invoice / enquiries.
    Raises RuntimeError if the database query fails.
    Returns an empty list if the entity genuinely has no historical invoice records.
    Never silently substitutes another entity's data.
    """
    historical_series = []
    
    # 1. Execute DB Query - distinguish query errors from genuine empty results
    try:
        if entity_type == 'franchisee':
            query = """
                SELECT 
                    COALESCE(financialYear, SUBSTRING(billDate, 1, 4)) AS period,
                    SUM(COALESCE(serviceCharges, 0.0)) AS gross_revenue,
                    SUM(COALESCE(franchiseeShare, 0.0)) AS franchisee_share,
                    SUM(COALESCE(ourShare, serviceCharges - COALESCE(franchiseeShare, 0.0))) AS net_revenue,
                    COUNT(*) AS deals_count
                FROM invoice
                WHERE (LOWER(TRIM(franchiseName)) = %s OR LOWER(TRIM(franchiseName)) = %s OR franchiseName = %s OR franchiseName = %s)
                  AND billNumber IS NOT NULL AND billNumber != ''
                GROUP BY period
                ORDER BY period ASC
            """
            cursor.execute(query, [
                entity_name.lower().strip(),
                str(entity_id).lower().strip(),
                entity_name.strip(),
                str(entity_id).strip()
            ])
            rows = cursor.fetchall()
            for r in rows:
                if r.get('period'):
                    historical_series.append({
                        'period': str(r['period']),
                        'revenue': float(r['gross_revenue'] or 0.0),
                        'net_revenue': float(r['net_revenue'] or 0.0),
                        'deals_count': int(r['deals_count'] or 0)
                    })
        elif entity_type == 'bd_agent':
            query = """
                SELECT 
                    COALESCE(financialYear, SUBSTRING(billDate, 1, 4)) AS period,
                    SUM(COALESCE(serviceCharges, 0.0)) AS gross_revenue,
                    SUM(COALESCE(ourShare, serviceCharges - COALESCE(franchiseeShare, 0.0))) AS net_revenue,
                    COUNT(*) AS deals_count
                FROM invoice
                WHERE (LOWER(TRIM(nameOfBd)) = %s OR LOWER(TRIM(nameOfBd)) = %s OR nameOfBd = %s OR nameOfBd = %s)
                  AND billNumber IS NOT NULL AND billNumber != ''
                GROUP BY period
                ORDER BY period ASC
            """
            cursor.execute(query, [
                entity_name.lower().strip(),
                str(entity_id).lower().strip(),
                entity_name.strip(),
                str(entity_id).strip()
            ])
            rows = cursor.fetchall()
            for r in rows:
                if r.get('period'):
                    historical_series.append({
                        'period': str(r['period']),
                        'revenue': float(r['gross_revenue'] or 0.0),
                        'net_revenue': float(r['net_revenue'] or 0.0),
                        'deals_count': int(r['deals_count'] or 0)
                    })
    except Exception as e:
        # Re-raise so the caller can distinguish a query failure from genuinely empty records
        raise RuntimeError(f"Database query failed while fetching historical revenue for {entity_type} '{entity_name}': {e}")

    # 2. Demo seed data is strictly opt-in via USE_DEMO_FALLBACK_DATA=true and ONLY matches exact entity name
    if not historical_series and USE_DEMO_FALLBACK_DATA:
        if entity_type == 'franchisee':
            match = FALLBACK_FRANCHISEE_HISTORICAL.get(entity_name)
            if match:
                historical_series = [
                    {'period': item['period'], 'revenue': item['revenue'], 'net_revenue': item['revenue'] * 0.4375, 'deals_count': max(5, int(item['revenue'] / 150000))}
                    for item in match
                ]
        else:
            match = FALLBACK_BD_HISTORICAL.get(entity_name)
            if match:
                historical_series = [
                    {'period': item['period'], 'revenue': item['revenue'], 'net_revenue': item['revenue'] * 0.4375, 'deals_count': max(8, int(item['revenue'] / 180000))}
                    for item in match
                ]

    return historical_series


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
        # Bound CAGR to reasonable business range (-50% to +200%)
        return max(-0.50, min(2.0, cagr))
    except Exception:
        return None


def generate_target_letter(entity_name, entity_type, growth_pct_target, base_value, target_value, salary_target, period_start, period_end, guidelines):
    """
    Generates a structured, professional growth target letter / agreement body.
    """
    type_label = "Franchise Partner" if entity_type == 'franchisee' else "Business Development Executive"
    growth_pct_str = f"{(growth_pct_target * 100):.1f}%"
    salary_clause = f"\n• Revised Base/Target Compensation: ₹{salary_target:,.2f} per month (Performance-Linked)" if salary_target and salary_target > 0 else ""
    
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

2. STRATEGIC GUIDELINES & EXECUTION PRIORITIES
--------------------------------------------------------------------------------
{guidelines if guidelines and guidelines.strip() else 'Focus on expanding candidate placements, maintaining high client retention, and optimizing pipeline realization rates across all allocated positions.'}

3. TERMS OF PERFORMANCE EVALUATION
--------------------------------------------------------------------------------
Upon completion of the period ending {period_end}, actual revenue achievement
will be audited against this target. Milestone incentives, tier advancements,
and compensation reviews will be determined directly by performance realization.

Authorized Signatory,
Management Board & Finance Committee
Fintective Intelligence Network
================================================================================"""
    return letter.strip()


def generate_outcome_letter(entity_name, entity_type, growth_pct_target, target_value, actual_growth_pct, actual_value, salary_target, period_start, period_end, kra_summary):
    """
    Generates an official outcome audit letter comparing targets to actuals.
    """
    type_label = "Franchise Partner" if entity_type == 'franchisee' else "Business Development Executive"
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

3. NEXT STEPS & RECONCILIATION
--------------------------------------------------------------------------------
This outcome report has been recorded in the central Fintective financial registry.
Any applicable milestone bonuses, incentive distributions, or updated targets
for the next cycle will be calculated according to these certified results.

Certified by,
Audit & Performance Review Board
Fintective Intelligence Network
================================================================================"""
    return letter.strip()


# --------------------------------------------------------------------------
# 1. GET /api/growth-targets/predict
# --------------------------------------------------------------------------
@growth_tracking_bp.route("/api/growth-targets/predict", methods=["GET"])
def predict_growth():
    entity_type = request.args.get("entity_type", "franchisee").strip().lower()
    entity_id = request.args.get("entity_id", "").strip()
    periods_count = int(request.args.get("periods", "3"))
    custom_rate = request.args.get("rate")

    if not entity_id:
        return jsonify({"error": "Missing required entity_id parameter"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        entity_name = _resolve_entity_info(cursor, entity_type, entity_id, request.args.get("entity_name"))
        historical_series = _fetch_historical_revenue(cursor, entity_type, entity_id, entity_name)
        
        # When entity genuinely has no historical invoice records, return explicit insufficient_data state
        if not historical_series:
            return jsonify({
                'entity_type': entity_type,
                'entity_id': entity_id,
                'entity_name': entity_name,
                'insufficient_data': True,
                'reason': 'no_invoice_history',
                'message': f"No historical invoice records found for {entity_name}.",
                'base_revenue': 0.0,
                'historical_cagr': None,
                'historical_cagr_pct': None,
                'applied_rate': None,
                'applied_rate_pct': None,
                'historical_series': [],
                'projections': [],
                'scenarios': {}
            })

        # Calculate Base and CAGR from genuine invoice data
        base_revenue = historical_series[-1]['revenue']
        historical_cagr = _calculate_cagr(historical_series)

        # Selected growth rate R (custom override or CAGR, fallback to 0.15 only if user overrides/CAGR is single period)
        if custom_rate is not None and custom_rate != "":
            try:
                selected_r = float(custom_rate)
                if selected_r > 1.0 and selected_r <= 100.0:
                    selected_r = selected_r / 100.0  # Normalize percentage input like 15 -> 0.15
            except ValueError:
                selected_r = historical_cagr if historical_cagr is not None else 0.15
        else:
            selected_r = historical_cagr if historical_cagr is not None else 0.15

        # Rate-based multi-period forward projections: projected[year] = base * (1 + R)^year
        projections = []
        for t in range(1, periods_count + 1):
            proj_val = base_revenue * math.pow(1.0 + selected_r, t)
            projections.append({
                'year_index': t,
                'period_label': f"Year +{t}",
                'projected_revenue': round(proj_val, 2),
                'growth_pct': round((math.pow(1.0 + selected_r, t) - 1.0) * 100, 2),
                'incremental_gain': round(proj_val - base_revenue, 2)
            })

        # Flat Multiplier Scenarios (1x, 2x, 3x, 4x) mirroring Scale Simulator pattern
        scenarios = {
            'scale1x': {
                'multiplier': 1,
                'label': '1x (Current Base)',
                'revenue': round(base_revenue, 2),
                'estimated_net': round(base_revenue * 0.4375, 2)
            },
            'scale2x': {
                'multiplier': 2,
                'label': '2x Scale',
                'revenue': round(base_revenue * 2, 2),
                'estimated_net': round(base_revenue * 2 * 0.4375, 2)
            },
            'scale3x': {
                'multiplier': 3,
                'label': '3x Scale',
                'revenue': round(base_revenue * 3, 2),
                'estimated_net': round(base_revenue * 3 * 0.4375, 2)
            },
            'scale4x': {
                'multiplier': 4,
                'label': '4x Scale',
                'revenue': round(base_revenue * 4, 2),
                'estimated_net': round(base_revenue * 4 * 0.4375, 2)
            }
        }

        return jsonify({
            'entity_type': entity_type,
            'entity_id': entity_id,
            'entity_name': entity_name,
            'insufficient_data': False,
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
# 2. POST /api/growth-targets (Set target + generate target letter)
# --------------------------------------------------------------------------
@growth_tracking_bp.route("/api/growth-targets", methods=["POST"])
def create_growth_target():
    data = request.get_json() or {}
    entity_type = data.get("entity_type", "franchisee").strip().lower()
    entity_id = str(data.get("entity_id", "")).strip()
    growth_pct_target = float(data.get("growth_pct_target", 0.0))
    salary_target = float(data.get("salary_target")) if data.get("salary_target") is not None and data.get("salary_target") != "" else None
    period_start = data.get("period_start", "").strip()
    period_end = data.get("period_end", "").strip()
    guidelines = data.get("guidelines", "").strip()

    if not entity_id or not period_start or not period_end:
        return jsonify({"error": "Missing required fields: entity_id, period_start, period_end"}), 400

    # Normalize growth percentage (e.g. 25.0 -> 0.25)
    normalized_growth = growth_pct_target / 100.0 if growth_pct_target > 1.0 else growth_pct_target

    target_id = f"gt-{uuid.uuid4().hex[:10]}"
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        entity_name = _resolve_entity_info(cursor, entity_type, entity_id, data.get("entity_name"))
        historical_series = _fetch_historical_revenue(cursor, entity_type, entity_id, entity_name)
        base_value = historical_series[-1]['revenue'] if historical_series else 0.0
        target_value = base_value * (1.0 + normalized_growth) if base_value > 0 else 0.0

        # Generate Target Letter text
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

        # Ensure table exists
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
# 3. GET /api/growth-targets (List/history)
# --------------------------------------------------------------------------
@growth_tracking_bp.route("/api/growth-targets", methods=["GET"])
def list_growth_targets():
    entity_type = request.args.get("entity_type")
    entity_id = request.args.get("entity_id")
    status = request.args.get("status")

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        query = "SELECT * FROM growth_targets WHERE 1=1"
        params = []
        if entity_type:
            query += " AND entity_type = %s"
            params.append(entity_type.strip().lower())
        if entity_id:
            query += " AND (entity_id = %s OR LOWER(entity_id) = %s)"
            params.extend([entity_id.strip(), entity_id.strip().lower()])
        if status:
            query += " AND status = %s"
            params.append(status.strip().lower())

        query += " ORDER BY created_at DESC"
        cursor.execute(query, params)
        rows = cursor.fetchall()

        results = []
        for r in rows:
            entity_name = _resolve_entity_info(cursor, r['entity_type'], r['entity_id'])
            growth_target = float(r['growth_pct_target'] or 0.0)
            actual_growth = float(r['actual_growth_pct']) if r['actual_growth_pct'] is not None else None
            
            results.append({
                'id': r['id'],
                'entity_type': r['entity_type'],
                'entity_id': r['entity_id'],
                'entity_name': entity_name,
                'growth_pct_target': growth_target,
                'growth_pct_target_pct': round(growth_target * 100, 2),
                'salary_target': float(r['salary_target']) if r['salary_target'] is not None else None,
                'period_start': r['period_start'],
                'period_end': r['period_end'],
                'guidelines': r['guidelines'],
                'status': r['status'],
                'actual_growth_pct': actual_growth,
                'actual_growth_pct_pct': round(actual_growth * 100, 2) if actual_growth is not None else None,
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
        print(f"[list_growth_targets] Error: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()


# --------------------------------------------------------------------------
# 4. POST /api/growth-targets/<id>/outcome (Record actuals + generate outcome letter)
# --------------------------------------------------------------------------
@growth_tracking_bp.route("/api/growth-targets/<target_id>/outcome", methods=["POST"])
def record_outcome(target_id):
    data = request.get_json() or {}
    actual_growth_pct = float(data.get("actual_growth_pct", 0.0))
    actual_value = float(data.get("actual_value", 0.0))
    kra_summary = data.get("kra_summary", "").strip()

    # Normalize actual growth percentage
    normalized_actual_growth = actual_growth_pct / 100.0 if actual_growth_pct > 1.0 else actual_growth_pct

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT * FROM growth_targets WHERE id = %s LIMIT 1", [target_id])
        target_row = cursor.fetchone()
        if not target_row:
            return jsonify({"error": "Target record not found"}), 404

        entity_type = target_row['entity_type']
        entity_id = target_row['entity_id']
        entity_name = _resolve_entity_info(cursor, entity_type, entity_id)
        growth_pct_target = float(target_row['growth_pct_target'] or 0.0)
        salary_target = float(target_row['salary_target']) if target_row['salary_target'] is not None else None

        # Reconstruct baseline to estimate target value
        historical_series = _fetch_historical_revenue(cursor, entity_type, entity_id, entity_name)
        base_value = historical_series[-1]['revenue'] if historical_series else (actual_value / (1.0 + normalized_actual_growth) if normalized_actual_growth != -1 and actual_value > 0 else 0.0)
        target_value = base_value * (1.0 + growth_pct_target) if base_value > 0 else (actual_value if actual_value > 0 else 0.0)

        # Generate Outcome Audit Letter
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


# --------------------------------------------------------------------------
# 5. GET /api/growth-targets/<id>/predict (Target-specific prediction)
# --------------------------------------------------------------------------
@growth_tracking_bp.route("/api/growth-targets/<target_id>/predict", methods=["GET"])
def predict_target_specific(target_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT * FROM growth_targets WHERE id = %s LIMIT 1", [target_id])
        target = cursor.fetchone()
        if not target:
            return jsonify({"error": "Target not found"}), 404

        entity_type = target['entity_type']
        entity_id = target['entity_id']
        rate = target['growth_pct_target']
        
        # Forward to predict logic with target's preset rate
        entity_name = _resolve_entity_info(cursor, entity_type, entity_id)
        historical_series = _fetch_historical_revenue(cursor, entity_type, entity_id, entity_name)
        if not historical_series:
            return jsonify({
                'target_id': target_id,
                'entity_type': entity_type,
                'entity_id': entity_id,
                'entity_name': entity_name,
                'insufficient_data': True,
                'reason': 'no_invoice_history',
                'growth_pct_target': float(rate),
                'base_revenue': 0.0,
                'projections': []
            })

        base_revenue = historical_series[-1]['revenue']

        projections = []
        for t in range(1, 4):
            proj_val = base_revenue * math.pow(1.0 + float(rate), t)
            projections.append({
                'year_index': t,
                'period_label': f"Year +{t}",
                'projected_revenue': round(proj_val, 2),
                'growth_pct': round((math.pow(1.0 + float(rate), t) - 1.0) * 100, 2)
            })

        return jsonify({
            'target_id': target_id,
            'entity_type': entity_type,
            'entity_id': entity_id,
            'entity_name': entity_name,
            'insufficient_data': False,
            'growth_pct_target': float(rate),
            'base_revenue': base_revenue,
            'projections': projections
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()
