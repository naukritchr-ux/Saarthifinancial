"""Growth workspace routes. Existing application authentication remains in force."""
import datetime as dt
import hashlib
import json
import re
import uuid
from flask import Blueprint, jsonify, request
from db import get_db_connection
from finance_rules import get_ist_today
from growth_audit_service import (
    METRICS, amount, audit_profiles, clear_cache, load_dataset, money,
    normalize_scope, period_for,
)

growth_audit_bp = Blueprint('growth_audit', __name__)


def authorized():
    role = (request.headers.get('X-User-Role') or request.args.get('role') or '').strip().lower()
    return role in ('admin', 'manager', 'head_office')


def ensure_storage(cur):
    # Metadata is created only on an explicit save, never during a data read.
    cur.execute('''CREATE TABLE IF NOT EXISTS growth_profile_costs (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        scope_key VARCHAR(512) NOT NULL, financial_year VARCHAR(9) NOT NULL,
        basis VARCHAR(20) NOT NULL, amount DECIMAL(18,2) NOT NULL,
        period_start DATE NOT NULL, period_end DATE NOT NULL, note TEXT NULL,
        updated_by VARCHAR(100) NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_profile_cost (scope_key, financial_year)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4''')
    cur.execute('''CREATE TABLE IF NOT EXISTS growth_profile_goals (
        id VARCHAR(50) PRIMARY KEY, scope_key VARCHAR(512) NOT NULL,
        scope_json TEXT NOT NULL, profile_label VARCHAR(512) NOT NULL,
        financial_year VARCHAR(9) NOT NULL, metric VARCHAR(20) NOT NULL,
        target_value DECIMAL(18,2) NOT NULL, due_date DATE NOT NULL,
        baseline_value DECIMAL(18,2) NOT NULL, baseline_as_of DATE NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'active', active_key VARCHAR(64) NULL,
        note TEXT NULL, updated_by VARCHAR(100) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_active_profile_goal (active_key),
        KEY idx_profile_goals (financial_year, status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4''')


def fields(body):
    if not isinstance(body, dict):
        raise ValueError('Request body must be an object')
    scope = normalize_scope(body.get('scope'))
    period = period_for(body.get('fy'), body.get('as_of'))
    note = str(body.get('note') or '').strip()
    if len(note) > 2000:
        raise ValueError('Notes must contain at most 2,000 characters')
    actor = str(body.get('actor') or request.args.get('role') or '').strip()[:100]
    return scope, period, note, actor


@growth_audit_bp.route('/api/growth/profile-audit', methods=['GET'])
def profile_audit():
    if not authorized():
        return jsonify({'error': 'A manager or administrator role is required for profile financial audits'}), 403
    try:
        period = period_for(request.args.get('fy'), request.args.get('as_of'))
        raw = json.loads(request.args.get('scopes', '[{}]'))
        if not isinstance(raw, list) or not 1 <= len(raw) <= 4:
            raise ValueError('Choose one to four profiles')
        scopes = [normalize_scope(scope) for scope in raw]
        if len({scope['key'] for scope in scopes}) != len(scopes):
            raise ValueError('Each compared profile must be distinct')
        dataset = load_dataset(period, force=request.args.get('refresh') == '1')
        return jsonify(audit_profiles(dataset,scopes,period))
    except (ValueError, TypeError, json.JSONDecodeError) as exc:
        return jsonify({'error': str(exc)}), 400
    except Exception as exc:
        print('[growth profile audit]', type(exc).__name__, str(exc))
        return jsonify({'error': 'Profile records could not be loaded. Check the backend data sources and retry.'}), 503


@growth_audit_bp.route('/api/growth/profile-costs', methods=['POST'])
def save_profile_cost():
    if not authorized():
        return jsonify({'error': 'A manager or administrator role is required'}), 403
    conn = None
    try:
        body = request.get_json(silent=True)
        scope, period, note, actor = fields(body)
        basis = body.get('basis')
        if basis not in ('period_total', 'monthly'):
            raise ValueError('Choose total for the displayed period or a fixed monthly estimate')
        if body.get('amount') is None or str(body['amount']).strip() == '':
            raise ValueError('Enter an expense amount; an explicitly confirmed zero is allowed')
        value = money(body['amount'])
        if value < 0 or value >= money('1000000000000000'):
            raise ValueError('Expense amount is outside the valid range')
        conn = get_db_connection()
        with conn.cursor() as cur:
            ensure_storage(cur)
            conn.begin()
            cur.execute('''INSERT INTO growth_profile_costs
                (scope_key, financial_year, basis, amount, period_start, period_end, note, updated_by)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
                ON DUPLICATE KEY UPDATE basis=VALUES(basis), amount=VALUES(amount),
                    period_start=VALUES(period_start), period_end=VALUES(period_end),
                    note=VALUES(note), updated_by=VALUES(updated_by)''',
                [scope['key'],period['fy'],basis,amount(value),period['start'],period['end'],note,actor])
            conn.commit()
        clear_cache()
        return jsonify({'success': True, 'scope_key': scope['key'], 'basis': basis,
                        'period_start': period['start'].isoformat(), 'period_end': period['end'].isoformat()})
    except (ValueError, TypeError) as exc:
        if conn: conn.rollback()
        return jsonify({'error': str(exc)}), 400
    except Exception as exc:
        if conn: conn.rollback()
        print('[growth cost save]', type(exc).__name__, str(exc))
        return jsonify({'error': 'The expense assumption could not be saved. Check database schema permissions and retry.'}), 503
    finally:
        if conn: conn.close()


@growth_audit_bp.route('/api/growth/profile-goals', methods=['POST'])
def save_profile_goal():
    if not authorized():
        return jsonify({'error': 'A manager or administrator role is required'}), 403
    conn = None
    try:
        body = request.get_json(silent=True)
        scope, period, note, actor = fields(body)
        metric = body.get('metric')
        if metric not in METRICS:
            raise ValueError('Choose company share, revenue excluding GST, or invoiced deals')
        if body.get('target') is None or str(body['target']).strip() == '':
            raise ValueError('Enter a target amount')
        target = money(body['target'])
        if target <= 0 or target >= money('1000000000000000') or (metric == 'deals' and target != target.to_integral_value()):
            raise ValueError('Target must be positive; deal targets must be whole numbers')
        target = money(amount(target))
        if target <= 0:
            raise ValueError('Currency targets must be at least one paisa')
        due = dt.date.fromisoformat(str(body.get('due_date') or period['fy_end']))
        if not get_ist_today() <= due <= period['fy_end']:
            raise ValueError('Target due date must be between today and the selected FY end')
        data = load_dataset(period)
        snapshot = audit_profiles(data,[scope],period)['profiles'][0]
        if metric == 'company_share' and snapshot['totals']['missing_share_rows']:
            raise ValueError('Reconcile missing company shares or choose a billed-revenue/deals target')
        baseline = snapshot['totals'][metric]
        active_key = hashlib.sha256((scope['key']+'|'+period['fy']+'|'+metric).encode()).hexdigest()
        goal_id = 'gp-'+uuid.uuid4().hex
        conn = get_db_connection()
        with conn.cursor() as cur:
            ensure_storage(cur)
            conn.begin()
            cur.execute("UPDATE growth_profile_goals SET status='superseded', active_key=NULL WHERE active_key=%s AND status='active'", [active_key])
            cur.execute('''INSERT INTO growth_profile_goals
                (id,scope_key,scope_json,profile_label,financial_year,metric,target_value,due_date,
                 baseline_value,baseline_as_of,status,active_key,note,updated_by)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'active',%s,%s,%s)''',
                [goal_id,scope['key'],json.dumps({key:scope[key] for key in ('bd','tl','franchise')}),
                 scope['label'],period['fy'],metric,amount(target),due,baseline,period['end'],active_key,note,actor])
            conn.commit()
        clear_cache()
        return jsonify({'success': True, 'id': goal_id, 'baseline_value': baseline,
                        'metric': metric, 'target': amount(target)}), 201
    except (ValueError, TypeError) as exc:
        if conn: conn.rollback()
        return jsonify({'error': str(exc)}), 400
    except Exception as exc:
        if conn: conn.rollback()
        print('[growth goal save]', type(exc).__name__, str(exc))
        code = exc.args[0] if exc.args and isinstance(exc.args[0],int) else None
        return jsonify({'error': 'Another goal was saved at the same time; refresh and retry.' if code == 1062 else
                        'The target could not be saved. Existing active targets were preserved; retry after checking the backend.'}), 409 if code == 1062 else 503
    finally:
        if conn: conn.close()


@growth_audit_bp.route('/api/growth/profile-goals/<goal_id>/archive', methods=['POST'])
def archive_profile_goal(goal_id):
    if not authorized():
        return jsonify({'error': 'A manager or administrator role is required'}), 403
    if not re.fullmatch(r'gp-[a-f0-9]{32}',goal_id):
        return jsonify({'error': 'Invalid profile target ID'}), 400
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("UPDATE growth_profile_goals SET status='archived', active_key=NULL WHERE id=%s AND status='active'",[goal_id])
            if not cur.rowcount:
                return jsonify({'error':'Active target not found'}),404
            conn.commit()
        clear_cache()
        return jsonify({'success':True})
    except Exception as exc:
        print('[growth goal archive]',type(exc).__name__)
        return jsonify({'error':'Target could not be archived'}),503
    finally:
        if conn: conn.close()
