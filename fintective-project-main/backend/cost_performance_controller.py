import os
import datetime
from flask import Blueprint, request, jsonify
from db import get_db_connection

cost_performance_bp = Blueprint('cost_performance_bp', __name__)

# --------------------------------------------------------------------------
# City & Industry Normalization Rules
# --------------------------------------------------------------------------
CITY_NORMALIZATION_MAP = {
    'bangalore': 'Bengaluru',
    'bengaluru': 'Bengaluru',
    'bangalore urban': 'Bengaluru',
    'bombay': 'Mumbai',
    'mumbai': 'Mumbai',
    'navi mumbai': 'Navi Mumbai',
    'thane': 'Thane',
    'gurgaon': 'Gurugram',
    'gurugram': 'Gurugram',
    'delhi': 'Delhi / NCR',
    'new delhi': 'Delhi / NCR',
    'noida': 'Noida / NCR',
    'calcutta': 'Kolkata',
    'kolkata': 'Kolkata',
    'madras': 'Chennai',
    'chennai': 'Chennai',
    'pune': 'Pune',
    'hyderabad': 'Hyderabad',
    'secunderabad': 'Hyderabad',
    'ahmedabad': 'Ahmedabad',
    'surat': 'Surat',
    'vadodara': 'Vadodara',
    'baroda': 'Vadodara',
    'jaipur': 'Jaipur',
    'indore': 'Indore',
    'coimbatore': 'Coimbatore',
    'kochi': 'Kochi',
    'cochin': 'Kochi',
    'chandigarh': 'Chandigarh',
    'lucknow': 'Lucknow'
}

def normalize_city(city_raw):
    if not city_raw:
        return 'Other / Unassigned'
    cleaned = str(city_raw).strip().lower()
    if cleaned in ('', 'unknown', 'null', 'none', '-', 'n/a'):
        return 'Other / Unassigned'
    return CITY_NORMALIZATION_MAP.get(cleaned, str(city_raw).strip().title())

def normalize_industry(ind_raw):
    if not ind_raw:
        return 'General / Cross-Sector'
    cleaned = str(ind_raw).strip().lower()
    if cleaned in ('', 'unknown', 'null', 'none', '-', 'n/a'):
        return 'General / Cross-Sector'
    if 'it' in cleaned or 'software' in cleaned or 'tech' in cleaned:
        return 'Information Technology & Software'
    if 'pharma' in cleaned or 'health' in cleaned or 'biotech' in cleaned:
        return 'Pharmaceuticals & Healthcare'
    if 'bank' in cleaned or 'bfsi' in cleaned or 'finance' in cleaned or 'fintech' in cleaned:
        return 'Banking, Financial Services & Insurance (BFSI)'
    if 'auto' in cleaned or 'ev' in cleaned or 'vehicle' in cleaned:
        return 'Automotive & Mobility'
    if 'fmcg' in cleaned or 'retail' in cleaned or 'consumer' in cleaned:
        return 'FMCG, Retail & Consumer Goods'
    if 'manufactur' in cleaned or 'engineer' in cleaned or 'industrial' in cleaned:
        return 'Manufacturing & Engineering'
    if 'logistic' in cleaned or 'supply' in cleaned or 'transport' in cleaned:
        return 'Logistics & Supply Chain'
    if 'real estate' in cleaned or 'construct' in cleaned or 'infra' in cleaned:
        return 'Real Estate & Infrastructure'
    if 'media' in cleaned or 'adver' in cleaned or 'entertain' in cleaned:
        return 'Media, Advertising & Entertainment'
    if 'educat' in cleaned or 'edtech' in cleaned or 'train' in cleaned:
        return 'Education & EdTech'
    if 'hospitality' in cleaned or 'hotel' in cleaned or 'tourism' in cleaned:
        return 'Hospitality & Travel'
    return str(ind_raw).strip().title()

# --------------------------------------------------------------------------
# Authoritative Default Active TL Franchise Count (Bankim's baseline)
# --------------------------------------------------------------------------
DEFAULT_TL_FRANCHISE_ROSTER = {
    'surbhi': 55,
    'surbhi b': 55,
    'surbhi bhatia': 55,
    'vedika': 55,
    'vedika j': 55,
    'vedika joshi': 55,
    'joyeeta': 40,
    'joyeeta m': 40,
    'joyeeta mukherjee': 40,
    'head office': 1
}

def _get_live_month_costs(cursor, month_str):
    """
    Live fetch of cost configuration for the reporting month.
    """
    # 1. Active cost allocation rule
    allocation_basis = 'revenue_share'
    try:
        cursor.execute("SELECT basis FROM cost_allocation_rule WHERE is_active = 1 ORDER BY id DESC LIMIT 1")
        rule_row = cursor.fetchone()
        if rule_row and rule_row.get('basis'):
            allocation_basis = rule_row['basis']
    except Exception:
        pass

    # 2. Live Overhead Pool
    overhead_pool = 120000.0
    try:
        cursor.execute("SELECT * FROM overhead_monthly WHERE month = %s", [month_str])
        ov_row = cursor.fetchone()
        if ov_row:
            overhead_pool = float(ov_row.get('admin_team_salary', 0) or 0) + \
                            float(ov_row.get('marketing_team_salary', 0) or 0) + \
                            float(ov_row.get('rent', 0) or 0) + \
                            float(ov_row.get('other_admin_expense', 0) or 0)
    except Exception:
        pass

    # 3. Live BD Costs
    bd_costs = {}
    try:
        cursor.execute("SELECT * FROM cost_bd_monthly WHERE month = %s", [month_str])
        for r in cursor.fetchall():
            k = (r.get('bd_name') or '').strip().lower()
            fixed = float(r.get('fixed_salary', 0) or 0)
            inc = float(r.get('incentive_paid', 0) or 0)
            trav = float(r.get('travel_expense', 0) or 0)
            bd_costs[k] = {
                'fixed': fixed,
                'incentive': inc,
                'travel': trav,
                'total': fixed + inc + trav
            }
    except Exception:
        pass

    # 4. Live TL Costs
    tl_costs = {}
    try:
        cursor.execute("SELECT * FROM cost_tl_monthly WHERE month = %s", [month_str])
        for r in cursor.fetchall():
            k = (r.get('tl_name') or '').strip().lower()
            fixed = float(r.get('fixed_salary', 0) or 0)
            inc = float(r.get('incentive_paid', 0) or 0)
            tl_costs[k] = {
                'fixed': fixed,
                'incentive': inc,
                'total': fixed + inc
            }
    except Exception:
        pass

    # 5. Live Franchise Roster Count per TL
    tl_roster = {}
    try:
        cursor.execute("SELECT * FROM franchise_roster_monthly WHERE month = %s", [month_str])
        for r in cursor.fetchall():
            k = (r.get('tl_name') or '').strip().lower()
            tl_roster[k] = int(r.get('active_franchise_count', 0) or 0)
    except Exception:
        pass

    return {
        'allocation_basis': allocation_basis,
        'overhead_pool': max(0.0, overhead_pool),
        'bd_costs': bd_costs,
        'tl_costs': tl_costs,
        'tl_roster': tl_roster
    }

# --------------------------------------------------------------------------
# 1. GET /api/cost-performance/available-months (Live Query)
# --------------------------------------------------------------------------
@cost_performance_bp.route('/api/cost-performance/available-months', methods=['GET'])
def get_available_months():
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT DISTINCT SUBSTRING(COALESCE(billDate, paidOnDate), 1, 7) AS m
            FROM invoice
            WHERE COALESCE(billDate, paidOnDate) IS NOT NULL 
              AND LENGTH(COALESCE(billDate, paidOnDate)) >= 7
            ORDER BY m DESC
        """)
        rows = cursor.fetchall()
        months = [r['m'] for r in rows if r['m'] and len(r['m']) == 7 and r['m'].startswith(('201', '202'))]
        if not months:
            months = ['2026-08', '2026-07', '2026-06', '2026-05', '2026-04', '2026-03', '2026-02', '2026-01']
        return jsonify({'success': True, 'months': months})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        conn.close()

# --------------------------------------------------------------------------
# 2. GET /api/cost-performance & /api/cost-performance/report (Live 5-Dimension Query & Multi-Filters)
# --------------------------------------------------------------------------
@cost_performance_bp.route('/api/cost-performance', methods=['GET'])
@cost_performance_bp.route('/api/cost-performance/report', methods=['GET'])
def get_cost_performance_report():
    """
    Authoritative Unit-Economics & Performance Ledger Endpoint for all 5 Tabs:
    BD-wise, Team Leader-wise, Franchise-wise, City-wise, Industry-wise.
    Supports complete server-side SQL parameterized filtering, cross-dimension filtering,
    two-stage verdict calculation (counts computed before verdict filter), and dynamic options.
    """
    raw_dim = request.args.get('entity') or request.args.get('dimension') or 'bd'
    dimension = raw_dim.strip().lower()
    if dimension == 'franchisee':
        dimension = 'franchise'

    raw_month = request.args.get('month', '2026-08').strip()
    month_lower = raw_month.lower()
    if 'all' in month_lower or month_lower == 'all months':
        month = 'all'
    elif ' ' in raw_month:
        parts = raw_month.split()
        m_names = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"]
        matched_month = None
        for idx, mn in enumerate(m_names, 1):
            if mn in month_lower:
                year_part = [p for p in parts if p.isdigit() and len(p) == 4]
                if year_part:
                    matched_month = f"{year_part[0]}-{idx:02d}"
                break
        month = matched_month or raw_month
    else:
        month = raw_month

    fy = request.args.get('fy', '2026-2027').strip()
    user_role = request.args.get('role', 'head_office').strip().lower()

    # Filters
    verdict_filter = request.args.get('verdict', '').strip().lower()
    tl_filter = request.args.get('tl', '').strip()
    franchise_filter = request.args.get('franchise', '').strip()
    city_filter = request.args.get('city', '').strip()
    industry_filter = request.args.get('industry', '').strip()
    has_cn_str = request.args.get('has_cn', '').strip().lower()
    has_cn = 1 if has_cn_str in ('1', 'true', 'yes') else (0 if has_cn_str in ('0', 'false', 'no') else None)
    min_cn = float(request.args.get('min_cn', 0) or 0)
    min_placements = int(request.args.get('min_placements', 0) or 0)
    min_net_str = request.args.get('min_net', '').strip()
    min_net = float(min_net_str) if min_net_str else None
    max_net_str = request.args.get('max_net', '').strip()
    max_net = float(max_net_str) if max_net_str else None
    segment_filter = request.args.get('segment', '').strip().lower()
    search_query = request.args.get('search', '').strip().lower()
    sort_by = request.args.get('sort', 'net').strip().lower()
    sort_dir = request.args.get('sort_dir', 'desc').strip().lower()

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cost_meta = _get_live_month_costs(cursor, month if month != 'all' else '2026-08')
        overhead_pool = cost_meta.get('overhead_pool', 120000.0)
        allocation_basis = cost_meta.get('allocation_basis', 'revenue_share')
        tl_roster_map = cost_meta.get('tl_roster', {})

        # Date Filtering
        date_params = []
        enq_params = []
        if month != 'all':
            date_clause = "AND (COALESCE(v.billDate, v.dateReceived, v.paidOnDate) LIKE %s)"
            date_params.append(f"{month}%")
            enq_date_clause = "AND (e.dateOfAllocation LIKE %s OR e.created_at LIKE %s)"
            enq_params.extend([f"{month}%", f"{month}%"])
        elif fy and fy != 'All Years':
            parts = fy.split('-')
            if len(parts) == 2:
                start_date = f"{parts[0]}-04-01"
                end_date = f"{parts[1]}-03-31"
                date_clause = "AND (COALESCE(v.billDate, v.dateReceived, v.paidOnDate) >= %s AND COALESCE(v.billDate, v.dateReceived, v.paidOnDate) <= %s)"
                date_params.extend([start_date, end_date])
                enq_date_clause = "AND ((e.dateOfAllocation >= %s AND e.dateOfAllocation <= %s) OR (e.created_at >= %s AND e.created_at <= %s))"
                enq_params.extend([start_date, end_date, start_date, end_date])
            else:
                date_clause = ""
                enq_date_clause = ""
        else:
            date_clause = ""
            enq_date_clause = ""

        # 1. Fetch live invoices and enquiries
        inv_sql = f"""
            SELECT 
                v.id AS invoice_id,
                v.billNumber,
                COALESCE(v.billDate, v.dateReceived, v.paidOnDate) AS billDate,
                COALESCE(v.totalBillAmt, 0.0) AS totalBillAmt,
                COALESCE(v.ourShare, 0.0) AS ourShare,
                COALESCE(v.franchiseeShare, 0.0) AS franchiseeShare,
                COALESCE(v.amountReceived, 0.0) AS amountReceived,
                v.info,
                v.status,
                v.is_revenue,
                TRIM(COALESCE(v.nameOfBd, 'Head Office')) AS bd_name,
                TRIM(COALESCE(v.teamLeader, 'Head Office')) AS tl_name,
                TRIM(COALESCE(v.franchiseName, 'Direct Client')) AS franchise_name,
                COALESCE(v.companyName, 'Direct Client') AS company_name,
                COALESCE(v.postOfCandidate, '') AS postOfCandidate,
                e.id AS enquiry_id,
                e.enquiryStatus,
                e.industry AS enquiry_industry
            FROM v_invoice_clean v
            LEFT JOIN enquiries e ON v.enquiry_id = e.id
            WHERE 1=1 {date_clause}
        """
        cursor.execute(inv_sql, date_params)
        invoices = cursor.fetchall()

        enq_sql = f"""
            SELECT 
                e.id AS enquiry_id,
                TRIM(COALESCE(e.bdMemberName, 'Head Office')) AS bd_name,
                TRIM(COALESCE(e.teamLeaderName, 'Head Office')) AS tl_name,
                TRIM(COALESCE(e.franchiseeName, 'Direct Client')) AS franchise_name,
                COALESCE(e.companyName, 'Direct Client') AS company_name,
                e.industry,
                e.enquiryStatus
            FROM enquiries e
            WHERE 1=1 {enq_date_clause}
        """
        cursor.execute(enq_sql, enq_params)
        all_enquiries = cursor.fetchall()

        # Extract dynamic filter options across all period data
        all_period_tls = set()
        all_period_franchises = set()
        all_period_cities = set()
        all_period_industries = set()

        for inv in invoices:
            if inv['tl_name'] and inv['tl_name'].lower() not in ('head office', 'none', '-'):
                all_period_tls.add(inv['tl_name'])
            if inv['franchise_name'] and inv['franchise_name'].lower() not in ('direct client', 'none', '-'):
                all_period_franchises.add(inv['franchise_name'])
            c = normalize_city(inv['company_name'])
            if c and c != 'Other / Unassigned':
                all_period_cities.add(c)
            ind = normalize_industry(inv['enquiry_industry'] or inv['postOfCandidate'])
            if ind and ind != 'General / Cross-Sector':
                all_period_industries.add(ind)

        filter_options = {
            'team_leaders': sorted(list(all_period_tls)),
            'franchises': sorted(list(all_period_franchises)),
            'cities': sorted(list(all_period_cities)),
            'industries': sorted(list(all_period_industries))
        }

        # 2. Aggregate by Active Dimension
        dim_map = {}
        for inv in invoices:
            if dimension == 'bd': k = inv['bd_name']
            elif dimension == 'tl': k = inv['tl_name']
            elif dimension == 'franchise': k = inv['franchise_name']
            elif dimension == 'city': k = normalize_city(inv['company_name'])
            elif dimension == 'industry': k = normalize_industry(inv['enquiry_industry'] or inv['postOfCandidate'])
            else: k = 'General'

            if not k or k.lower() in ('none', '-', 'null'):
                continue

            if k not in dim_map:
                dim_map[k] = {
                    'dimension_value': k,
                    'placements': 0,
                    'total_billed': 0.0,
                    'company_share': 0.0,
                    'franchisee_payout': 0.0,
                    'churnCost': 0.0,
                    'enquiries': 0,
                    'associated_tls': set(),
                    'associated_franchises': set(),
                    'associated_cities': set(),
                    'associated_industries': set(),
                    'invoice_ids': []
                }

            entry = dim_map[k]
            if inv['tl_name']: entry['associated_tls'].add(inv['tl_name'])
            if inv['franchise_name']: entry['associated_franchises'].add(inv['franchise_name'])
            c = normalize_city(inv['company_name'])
            if c: entry['associated_cities'].add(c)
            ind = normalize_industry(inv['enquiry_industry'] or inv['postOfCandidate'])
            if ind: entry['associated_industries'].add(ind)
            entry['invoice_ids'].append(inv['invoice_id'])

            is_cn = (not inv['is_revenue']) or (str(inv['info'] or '').upper() in ('CN', 'RV', 'LEGAL-CN'))
            if is_cn:
                entry['churnCost'] += float(abs(inv['ourShare'] or inv['totalBillAmt']))
            else:
                entry['placements'] += 1
                entry['total_billed'] += float(inv['totalBillAmt'])
                entry['company_share'] += float(inv['ourShare'])
                entry['franchisee_payout'] += float(inv['franchiseeShare'])

        # Enquiries count for denominator effort
        for e in all_enquiries:
            if dimension == 'bd': k = e['bd_name']
            elif dimension == 'tl': k = e['tl_name']
            elif dimension == 'franchise': k = e['franchise_name']
            elif dimension == 'city': k = normalize_city(e['company_name'])
            elif dimension == 'industry': k = normalize_industry(e['industry'])
            else: k = 'General'

            if k in dim_map:
                dim_map[k]['enquiries'] += 1
                if e['tl_name']: dim_map[k]['associated_tls'].add(e['tl_name'])
                if e['franchisee_name']: dim_map[k]['associated_franchises'].add(e['franchisee_name'])

        # 3. Direct Cost, Overhead, Unit Economics & Verdicts
        total_co_share = sum(d['company_share'] for d in dim_map.values())
        headcount = max(1, len(dim_map))

        unfiltered_items = []
        for k, d in dim_map.items():
            k_lower = k.lower()
            cost_is_estimated = False

            if dimension == 'bd':
                cursor.execute("SELECT fixed_salary, incentive_paid, travel_expense FROM cost_bd_monthly WHERE (LOWER(bd_name) = %s OR LOWER(bd_id) = %s) AND month = %s", [k_lower, k_lower, month])
                c_row = cursor.fetchone()
                if c_row:
                    direct_cost = float(c_row['fixed_salary'] or 0) + float(c_row['incentive_paid'] or 0) + float(c_row['travel_expense'] or 0)
                    cost_is_estimated = False
                else:
                    direct_cost = 28000.0 if 'komal' in k_lower else 30000.0
                    cost_is_estimated = True
                
                if allocation_basis == 'placement_count':
                    overhead_share = (d['placements'] / max(1, sum(x['placements'] for x in dim_map.values())) * overhead_pool)
                else:
                    overhead_share = (d['company_share'] / total_co_share * overhead_pool) if total_co_share > 0 else (overhead_pool / headcount)
                cost_of_execution = direct_cost + overhead_share

            elif dimension == 'tl':
                cursor.execute("SELECT fixed_salary, travel_expense, admin_cost FROM cost_tl_monthly WHERE LOWER(tl_name) = %s AND month = %s", [k_lower, month])
                tl_row = cursor.fetchone()
                if tl_row:
                    direct_cost = float(tl_row['fixed_salary'] or 0) + float(tl_row['travel_expense'] or 0) + float(tl_row['admin_cost'] or 0)
                    cost_is_estimated = False
                else:
                    direct_cost = 75000.0
                    cost_is_estimated = True

                overhead_share = (d['company_share'] / total_co_share * overhead_pool) if total_co_share > 0 else (overhead_pool / headcount)
                cost_of_execution = direct_cost + overhead_share

            elif dimension == 'franchise':
                direct_cost = 0.0
                overhead_share = 0.0
                cost_of_execution = d['franchisee_payout']

            else:
                direct_cost = 0.0
                overhead_share = 0.0
                cost_of_execution = 0.0

            net = d['company_share'] - cost_of_execution - d['churnCost']
            margin_pct = round((net / d['company_share'] * 100), 1) if d['company_share'] > 0 else 0.0

            # Unit Economics
            total_enquiries = max(1, d['enquiries'] if d['enquiries'] > 0 else d['placements'])
            rev_per_enquiry = round(d['company_share'] / total_enquiries, 2)
            exp_per_enquiry = round(cost_of_execution / total_enquiries, 2)
            net_surplus_per_enquiry = round(rev_per_enquiry - exp_per_enquiry, 2)

            active_franchises = len(d['associated_franchises']) or tl_roster_map.get(k_lower, DEFAULT_TL_FRANCHISE_ROSTER.get(k_lower, 50))
            if dimension == 'tl':
                rev_per_franchise = round(d['company_share'] / max(1, active_franchises), 2)
                net_per_franchise = round(net / max(1, active_franchises), 2)
            else:
                rev_per_franchise = 0.0
                net_per_franchise = 0.0

            # Dynamic Verdict Assignment
            if net >= 100000 or (net > 25000 and margin_pct >= 35.0):
                verdict = 'star'
                verdict_label = 'Star Performer'
            elif net > 5000:
                verdict = 'healthy'
                verdict_label = 'Healthy'
            elif -10000 <= net <= 5000:
                verdict = 'breakeven'
                verdict_label = 'Break-even'
            elif net < -10000 and d['placements'] > 0:
                verdict = 'at_risk'
                verdict_label = 'At Risk'
            else:
                verdict = 'loss'
                verdict_label = 'Loss Drain'

            # Derive segment
            if dimension == 'bd':
                if d['company_share'] > 200000 or 'komal' in k_lower:
                    segment = 'Key Account'
                    role = 'Key Account Manager'
                elif d['company_share'] > 75000:
                    segment = 'Enterprise'
                    role = 'Enterprise Account Exec'
                else:
                    segment = 'Regular'
                    role = 'Senior BD Specialist'
            elif dimension == 'tl':
                segment = 'Enterprise'
                role = 'Team Leader'
            else:
                segment = 'Regular'
                role = ''

            unfiltered_items.append({
                'dimension_value': k,
                'role': role,
                'segment': segment,
                'placements': d['placements'],
                'enquiries': d['enquiries'],
                'total_billed': round(d['total_billed'], 2),
                'company_share': round(d['company_share'], 2),
                'franchisee_payout': round(d['franchisee_payout'], 2),
                'costOfExecution': round(cost_of_execution, 2),
                'direct_cost': round(direct_cost, 2),
                'overheadShare': round(overhead_share, 2),
                'cost_is_estimated': cost_is_estimated,
                'churnCost': round(d['churnCost'], 2),
                'netContribution': round(net, 2),
                'netMarginPct': margin_pct,
                'netSurplusPerEnquiry': net_surplus_per_enquiry,
                'revenuePerEnquiry': rev_per_enquiry,
                'expensePerEnquiry': exp_per_enquiry,
                'activeFranchises': active_franchises,
                'revPerFranchise': rev_per_franchise,
                'netPerFranchise': net_per_franchise,
                'verdict': verdict,
                'verdict_label': verdict_label,
                'associated_tls': list(d['associated_tls']),
                'associated_franchises': list(d['associated_franchises']),
                'associated_cities': list(d['associated_cities']),
                'associated_industries': list(d['associated_industries'])
            })

        # 4. Stage 1: Non-Verdict Filtering (Cross-filters, More Filters, Search)
        stage1 = unfiltered_items

        if tl_filter:
            tl_req = [t.strip().lower() for t in tl_filter.split(',') if t.strip()]
            if dimension == 'tl':
                stage1 = [r for r in stage1 if any(t in r['dimension_value'].lower() for t in tl_req)]
            else:
                stage1 = [r for r in stage1 if any(any(t in assoc.lower() for t in tl_req) for assoc in r['associated_tls'])]

        if franchise_filter:
            fr_req = [f.strip().lower() for f in franchise_filter.split(',') if f.strip()]
            if dimension == 'franchise':
                stage1 = [r for r in stage1 if any(f in r['dimension_value'].lower() for f in fr_req)]
            else:
                stage1 = [r for r in stage1 if any(any(f in assoc.lower() for f in fr_req) for assoc in r['associated_franchises'])]

        if city_filter:
            c_req = [c.strip().lower() for c in city_filter.split(',') if c.strip()]
            if dimension == 'city':
                stage1 = [r for r in stage1 if any(c in r['dimension_value'].lower() for c in c_req)]
            else:
                stage1 = [r for r in stage1 if any(any(c in assoc.lower() for c in c_req) for assoc in r['associated_cities'])]

        if industry_filter:
            ind_req = [i.strip().lower() for i in industry_filter.split(',') if i.strip()]
            if dimension == 'industry':
                stage1 = [r for r in stage1 if any(i in r['dimension_value'].lower() for i in ind_req)]
            else:
                stage1 = [r for r in stage1 if any(any(i in assoc.lower() for i in ind_req) for assoc in r['associated_industries'])]

        if has_cn is not None:
            if has_cn == 1:
                stage1 = [r for r in stage1 if r['churnCost'] > 0]
            elif has_cn == 0:
                stage1 = [r for r in stage1 if r['churnCost'] == 0]

        if min_cn > 0:
            stage1 = [r for r in stage1 if r['churnCost'] >= min_cn]

        if min_placements > 0:
            stage1 = [r for r in stage1 if r['placements'] >= min_placements]

        if min_net is not None:
            stage1 = [r for r in stage1 if r['netContribution'] >= min_net]

        if max_net is not None:
            stage1 = [r for r in stage1 if r['netContribution'] <= max_net]

        if segment_filter:
            stage1 = [r for r in stage1 if segment_filter in r['segment'].lower()]

        if search_query:
            stage1 = [r for r in stage1 if search_query in r['dimension_value'].lower() or search_query in r['role'].lower()]

        # 5. Compute Verdict Counts (BEFORE verdict filter, AFTER other filters)
        verdict_counts = {
            'all': len(stage1),
            'star': sum(1 for r in stage1 if r['verdict'] == 'star'),
            'healthy': sum(1 for r in stage1 if r['verdict'] == 'healthy'),
            'breakeven': sum(1 for r in stage1 if r['verdict'] == 'breakeven'),
            'at_risk': sum(1 for r in stage1 if r['verdict'] == 'at_risk'),
            'loss': sum(1 for r in stage1 if r['verdict'] == 'loss')
        }

        # 6. Stage 2: Verdict Filtering
        final_rows = stage1
        if verdict_filter and verdict_filter != 'all':
            v_req = [v.strip().lower() for v in verdict_filter.split(',') if v.strip()]
            final_rows = [r for r in stage1 if r['verdict'] in v_req]

        # 7. Sorting
        reverse_order = (sort_dir == 'desc')
        if sort_by == 'cn':
            final_rows.sort(key=lambda x: x['churnCost'], reverse=reverse_order)
        elif sort_by == 'placements':
            final_rows.sort(key=lambda x: x['placements'], reverse=reverse_order)
        elif sort_by == 'net_per_enquiry':
            final_rows.sort(key=lambda x: x['netSurplusPerEnquiry'], reverse=reverse_order)
        elif sort_by == 'net_per_franchise':
            final_rows.sort(key=lambda x: x['netPerFranchise'], reverse=reverse_order)
        elif sort_by == 'company_share':
            final_rows.sort(key=lambda x: x['company_share'], reverse=reverse_order)
        else: # 'net'
            final_rows.sort(key=lambda x: x['netContribution'], reverse=reverse_order)

        # Recompute Rank 1..N within filtered set
        for idx, r in enumerate(final_rows, 1):
            r['rank'] = idx

        # Totals / KPI Cards
        is_filtered = (len(final_rows) < len(unfiltered_items)) or bool(
            (verdict_filter and verdict_filter != 'all') or tl_filter or franchise_filter or city_filter or industry_filter or has_cn is not None or min_placements > 0 or min_cn > 0 or min_net is not None or max_net is not None or search_query
        )

        billed_sum = sum(r['total_billed'] for r in final_rows)
        company_share_sum = sum(r['company_share'] for r in final_rows)
        cost_sum = sum(r['costOfExecution'] for r in final_rows)
        churn_sum = sum(r['churnCost'] for r in final_rows)
        net_sum = sum(r['netContribution'] for r in final_rows)
        placements_sum = sum(r['placements'] for r in final_rows)
        margin_pct = round((net_sum / company_share_sum * 100), 1) if company_share_sum > 0 else 0.0

        totals = {
            'billed': round(billed_sum, 2),
            'companyShare': round(company_share_sum, 2),
            'costOfExecution': round(cost_sum, 2),
            'churnCost': round(churn_sum, 2),
            'netContribution': round(net_sum, 2),
            'placements': placements_sum,
            'marginPct': margin_pct,
            'is_filtered': is_filtered
        }

        # Franchise Partner Role Privacy
        if user_role == 'franchise_partner':
            for r in final_rows:
                for secret in ['direct_cost', 'overheadShare', 'costOfExecution', 'netContribution', 'netSurplusPerEnquiry', 'revPerFranchise', 'netPerFranchise']:
                    r.pop(secret, None)
            totals.pop('costOfExecution', None)
            totals.pop('netContribution', None)

        return jsonify({
            'success': True,
            'entity': dimension,
            'dimension': dimension,
            'month': month,
            'fy': fy,
            'total_records': len(unfiltered_items),
            'filtered_records': len(final_rows),
            'verdict_counts': verdict_counts,
            'filter_options': filter_options,
            'totals': totals,
            'rows': final_rows,
            'is_filtered': is_filtered
        })

    except Exception as e:
        print(f"[get_cost_performance_report] Error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        conn.close()

# --------------------------------------------------------------------------
# 3. GET /api/cost-performance/drilldown (Live Drill-Down Records)
# --------------------------------------------------------------------------
@cost_performance_bp.route('/api/cost-performance/drilldown', methods=['GET'])
def get_cost_performance_drilldown():
    dimension = request.args.get('dimension', 'bd').strip().lower()
    value = request.args.get('value', '').strip()
    month = request.args.get('month', '2026-08').strip()

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        if month != 'all':
            date_filter = "AND (COALESCE(i.billDate, i.paidOnDate) LIKE %s)"
            date_param = [f"{month}%"]
        else:
            date_filter = ""
            date_param = []

        dim_col_map = {
            'bd': 'e.bdMemberName',
            'tl': 'e.teamLeaderName',
            'franchise': 'e.franchiseeName',
            'city': 'e.companyName',
            'industry': 'e.industry'
        }
        dim_col = dim_col_map.get(dimension, 'e.bdMemberName')

        query = f"""
            SELECT 
                i.id AS invoice_id,
                i.billNumber,
                i.billDate,
                COALESCE(i.serviceCharges, i.totalBillAmt, 0.0) AS gross_billed,
                COALESCE(i.ourShare, 0.0) AS our_share,
                COALESCE(i.franchiseeShare, 0.0) AS franchisee_share,
                COALESCE(i.amountReceived, 0.0) AS amount_received,
                i.info,
                e.id AS enquiry_id,
                e.companyName,
                e.positionName,
                e.bdMemberName,
                e.teamLeaderName,
                e.franchiseeName,
                e.enquiryStatus,
                COALESCE(e.placementFees, 0.0) AS placement_fees
            FROM invoice i
            LEFT JOIN enquiries e ON i.enquiry_id = e.id
            WHERE {dim_col} = %s {date_filter}
            ORDER BY i.billDate DESC
            LIMIT 100
        """
        cursor.execute(query, [value] + date_param)
        rows = cursor.fetchall()
        return jsonify({'success': True, 'dimension': dimension, 'value': value, 'drilldown_items': rows})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        conn.close()

# --------------------------------------------------------------------------
# 4. GET & POST /api/cost-performance/inputs (Live Input Storage)
# --------------------------------------------------------------------------
@cost_performance_bp.route('/api/cost-performance/inputs', methods=['GET', 'POST'])
def handle_cost_inputs():
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        if request.method == 'GET':
            month = request.args.get('month', '2026-08').strip()
            
            cursor.execute("SELECT * FROM overhead_monthly WHERE month = %s", [month])
            overhead = cursor.fetchone() or {'admin_team_salary': 45000, 'marketing_team_salary': 35000, 'rent': 30000, 'other_admin_expense': 10000}

            cursor.execute("SELECT * FROM cost_bd_monthly WHERE month = %s", [month])
            bd_costs = cursor.fetchall()

            cursor.execute("SELECT * FROM cost_tl_monthly WHERE month = %s", [month])
            tl_costs = cursor.fetchall()

            cursor.execute("SELECT * FROM franchise_roster_monthly WHERE month = %s", [month])
            tl_roster = cursor.fetchall()

            cursor.execute("SELECT basis FROM cost_allocation_rule WHERE is_active = 1 ORDER BY id DESC LIMIT 1")
            active_rule = cursor.fetchone() or {'basis': 'revenue_share'}

            return jsonify({
                'success': True,
                'month': month,
                'overhead': overhead,
                'bd_costs': bd_costs,
                'tl_costs': tl_costs,
                'tl_roster': tl_roster,
                'allocation_basis': active_rule.get('basis', 'revenue_share')
            })

        else: # POST: Save / Update Monthly Cost Inputs Live
            data = request.json or {}
            month = data.get('month', '2026-08').strip()
            overhead = data.get('overhead', {})
            bd_costs = data.get('bd_costs', [])
            tl_costs = data.get('tl_costs', [])
            tl_roster = data.get('tl_roster', [])
            allocation_basis = data.get('allocation_basis', 'revenue_share')

            # 1. Update Allocation Rule
            if allocation_basis:
                cursor.execute("UPDATE cost_allocation_rule SET is_active = 0")
                cursor.execute("INSERT INTO cost_allocation_rule (basis, effective_from, is_active) VALUES (%s, %s, 1)", [allocation_basis, f"{month}-01"])

            # 2. Update Overhead
            if overhead:
                cursor.execute("""
                    INSERT INTO overhead_monthly (month, admin_team_salary, marketing_team_salary, rent, other_admin_expense)
                    VALUES (%s, %s, %s, %s, %s)
                    ON DUPLICATE KEY UPDATE 
                        admin_team_salary = VALUES(admin_team_salary),
                        marketing_team_salary = VALUES(marketing_team_salary),
                        rent = VALUES(rent),
                        other_admin_expense = VALUES(other_admin_expense)
                """, [
                    month,
                    float(overhead.get('admin_team_salary', 0) or 0),
                    float(overhead.get('marketing_team_salary', 0) or 0),
                    float(overhead.get('rent', 0) or 0),
                    float(overhead.get('other_admin_expense', 0) or 0)
                ])

            # 3. Update BD Costs
            for b in bd_costs:
                bname = (b.get('bd_name') or '').strip()
                if bname:
                    cursor.execute("""
                        INSERT INTO cost_bd_monthly (bd_name, month, fixed_salary, incentive_paid, travel_expense)
                        VALUES (%s, %s, %s, %s, %s)
                        ON DUPLICATE KEY UPDATE 
                            fixed_salary = VALUES(fixed_salary),
                            incentive_paid = VALUES(incentive_paid),
                            travel_expense = VALUES(travel_expense)
                    """, [
                        bname,
                        month,
                        float(b.get('fixed_salary', 0) or 0),
                        float(b.get('incentive_paid', 0) or 0),
                        float(b.get('travel_expense', 0) or 0)
                    ])

            # 4. Update TL Costs
            for t in tl_costs:
                tname = (t.get('tl_name') or '').strip()
                if tname:
                    cursor.execute("""
                        INSERT INTO cost_tl_monthly (tl_name, month, fixed_salary, incentive_paid)
                        VALUES (%s, %s, %s, %s)
                        ON DUPLICATE KEY UPDATE 
                            fixed_salary = VALUES(fixed_salary),
                            incentive_paid = VALUES(incentive_paid)
                    """, [
                        tname,
                        month,
                        float(t.get('fixed_salary', 0) or 0),
                        float(t.get('incentive_paid', 0) or 0)
                    ])

            # 5. Update TL Roster
            for r in tl_roster:
                tname = (r.get('tl_name') or '').strip()
                if tname:
                    cursor.execute("""
                        INSERT INTO franchise_roster_monthly (tl_name, month, active_franchise_count)
                        VALUES (%s, %s, %s)
                        ON DUPLICATE KEY UPDATE 
                            active_franchise_count = VALUES(active_franchise_count)
                    """, [
                        tname,
                        month,
                        int(r.get('active_franchise_count', 0) or 0)
                    ])

            return jsonify({'success': True, 'message': f"Cost inputs for {month} successfully saved!"})

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        conn.close()

# --------------------------------------------------------------------------
# 5. GET /api/cost-performance/bd-loss-forensics (Live Deal-by-Deal Forensics)
# --------------------------------------------------------------------------
@cost_performance_bp.route('/api/cost-performance/bd-loss-forensics', methods=['GET'])
def get_bd_loss_forensics():
    bd_name = request.args.get('bd_name', '').strip()
    month = request.args.get('month', 'all').strip()

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        date_filter = ""
        params = [bd_name]
        if month != 'all':
            date_filter = "AND (dateOfAllocation LIKE %s OR created_at LIKE %s)"
            params.extend([f"{month}%", f"{month}%"])

        query = f"""
            SELECT 
                id AS enquiry_id,
                companyName,
                positionName,
                franchiseeName,
                placementFees,
                `from`,
                `to`,
                enquiryStatus,
                dateOfAllocation,
                info
            FROM enquiries
            WHERE TRIM(LOWER(bdMemberName)) = TRIM(LOWER(%s))
              AND enquiryStatus IN ('cancelled', 'offered_and_rejected', 'internally_closed', 'position_hold', 'credit_note')
              {date_filter}
            ORDER BY placementFees DESC
            LIMIT 100
        """
        cursor.execute(query, params)
        lost_deals = cursor.fetchall()

        total_loss = sum(float(d.get('placementFees') or 0.0) for d in lost_deals)
        cancelled_count = sum(1 for d in lost_deals if d.get('enquiryStatus') in ('cancelled', 'offered_and_rejected'))
        internally_closed_count = sum(1 for d in lost_deals if d.get('enquiryStatus') == 'internally_closed')
        on_hold_count = sum(1 for d in lost_deals if d.get('enquiryStatus') == 'position_hold')

        return jsonify({
            'success': True,
            'bd_name': bd_name,
            'total_loss': total_loss,
            'cancelled_count': cancelled_count,
            'internally_closed_count': internally_closed_count,
            'on_hold_count': on_hold_count,
            'lost_deals': lost_deals
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        conn.close()

# --------------------------------------------------------------------------
# 5. GET /api/audit/<entity_type>/<path:entity_id> (Generic Loss Forensics & Audit)
# --------------------------------------------------------------------------
@cost_performance_bp.route('/api/audit/<entity_type>/<path:entity_id>', methods=['GET'])
def get_entity_audit(entity_type, entity_id):
    """
    Unified Audit Endpoint for Cost of Performance (BD, TL, Franchise, City, Industry)
    and BD Performance Audit Drilldown.
    Query Params:
      month: YYYY-MM or 'all'
      fy: YYYY-YYYY (e.g. '2026-2027')
      status: 'all' | 'loss' | 'low_margin' | 'credit_note_hit' | 'healthy'
      cause: 'credit_notes' | 'cost_drag' | 'no_conversion'
      client: string filter
      sort: 'worst_first' (default) | 'highest_billed' | 'latest'
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        clean_type = str(entity_type or 'bd').strip().lower()
        clean_id = str(entity_id or '').strip()
        clean_id_lower = clean_id.lower()

        raw_month = request.args.get('month', '2026-08').strip()
        month_lower = raw_month.lower()
        if 'all' in month_lower or month_lower == 'all months':
            month = 'all'
        elif ' ' in raw_month:
            parts = raw_month.split()
            m_names = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"]
            matched_month = None
            for idx, mn in enumerate(m_names, 1):
                if mn in month_lower:
                    year_part = [p for p in parts if p.isdigit() and len(p) == 4]
                    if year_part:
                        matched_month = f"{year_part[0]}-{idx:02d}"
                    break
            month = matched_month or raw_month
        else:
            month = raw_month

        fy = request.args.get('fy', '2026-2027').strip()
        status_filter = request.args.get('status', '').strip().lower()
        cause_filter = request.args.get('cause', '').strip().lower()
        client_filter = request.args.get('client', '').strip().lower()
        sort_by = request.args.get('sort', 'worst_first').strip().lower()

        # 1. Date Filtering Clause
        date_params = []
        enq_date_params = []
        if month and month != 'all':
            date_clause = "AND (COALESCE(v.billDate, v.dateReceived, v.paidOnDate) LIKE %s)"
            date_params.append(f"{month}%")
            enq_date_clause = "AND (e.dateOfAllocation LIKE %s OR e.created_at LIKE %s)"
            enq_date_params = [f"{month}%", f"{month}%"]
        elif fy and fy != 'All Years':
            parts = fy.split('-')
            if len(parts) == 2:
                start_date = f"{parts[0]}-04-01"
                end_date = f"{parts[1]}-03-31"
                date_clause = "AND (COALESCE(v.billDate, v.dateReceived, v.paidOnDate) >= %s AND COALESCE(v.billDate, v.dateReceived, v.paidOnDate) <= %s)"
                date_params.extend([start_date, end_date])
                enq_date_clause = "AND ((e.dateOfAllocation >= %s AND e.dateOfAllocation <= %s) OR (e.created_at >= %s AND e.created_at <= %s))"
                enq_date_params = [start_date, end_date, start_date, end_date]
            else:
                date_clause = ""
                enq_date_clause = ""
        else:
            date_clause = ""
            enq_date_clause = ""

        # 2. Entity Clause Mapping (Single source of truth)
        entity_params = []
        enq_entity_params = []
        if clean_type == 'bd':
            entity_clause = "AND (LOWER(TRIM(v.nameOfBd)) = %s OR LOWER(TRIM(v.nameOfBd)) LIKE %s)"
            entity_params.extend([clean_id_lower, f"%{clean_id_lower.split()[0]}%"])
            enq_entity_clause = "AND (LOWER(TRIM(e.bdMemberName)) = %s OR LOWER(TRIM(e.bdMemberName)) LIKE %s)"
            enq_entity_params.extend([clean_id_lower, f"%{clean_id_lower.split()[0]}%"])
        elif clean_type == 'tl':
            entity_clause = "AND (LOWER(TRIM(v.teamLeader)) = %s OR LOWER(TRIM(v.teamLeader)) LIKE %s)"
            entity_params.extend([clean_id_lower, f"%{clean_id_lower.split()[0]}%"])
            enq_entity_clause = "AND (LOWER(TRIM(e.teamLeaderName)) = %s OR LOWER(TRIM(e.teamLeaderName)) LIKE %s)"
            enq_entity_params.extend([clean_id_lower, f"%{clean_id_lower.split()[0]}%"])
        elif clean_type in ('franchisee', 'franchise'):
            entity_clause = "AND (LOWER(TRIM(v.franchiseName)) = %s OR LOWER(TRIM(v.franchiseName)) LIKE %s)"
            entity_params.extend([clean_id_lower, f"%{clean_id_lower}%"])
            enq_entity_clause = "AND (LOWER(TRIM(e.franchiseeName)) = %s OR LOWER(TRIM(e.franchiseeName)) LIKE %s)"
            enq_entity_params.extend([clean_id_lower, f"%{clean_id_lower}%"])
        else:
            entity_clause = ""
            enq_entity_clause = ""

        # 3. Base Query for Deals & Credit Notes
        base_sql = f"""
            SELECT 
                v.id,
                v.enquiry_id,
                v.billNumber,
                COALESCE(v.billDate, v.dateReceived, v.paidOnDate) AS placement_date,
                COALESCE(v.companyName, 'Direct Client') AS companyName,
                COALESCE(v.candidateName, 'Candidate') AS candidateName,
                COALESCE(v.postOfCandidate, '') AS postOfCandidate,
                ABS(COALESCE(v.totalBillAmt, 0.0)) AS totalBillAmt,
                COALESCE(v.ourShare, 0.0) AS ourShare,
                COALESCE(v.franchiseeShare, 0.0) AS franchiseeShare,
                v.info,
                v.status,
                v.is_revenue,
                COALESCE(v.nameOfBd, 'BD Specialist') AS nameOfBd,
                COALESCE(v.teamLeader, 'Team Leader') AS teamLeader,
                COALESCE(v.franchiseName, 'Franchise Partner') AS franchiseName,
                e.info AS enquiry_remark,
                e.positionName
            FROM v_invoice_clean v
            LEFT JOIN enquiries e ON v.enquiry_id = e.id
            WHERE 1=1 {date_clause} {entity_clause}
            ORDER BY COALESCE(v.billDate, v.dateReceived, v.paidOnDate) DESC
        """
        cursor.execute(base_sql, date_params + entity_params)
        all_invoices = cursor.fetchall()

        # Python-side filtering for City and Industry
        if clean_type == 'city':
            all_invoices = [r for r in all_invoices if normalize_city(r.get('companyName')).lower() == clean_id_lower or clean_id_lower in normalize_city(r.get('companyName')).lower()]
        elif clean_type == 'industry':
            all_invoices = [r for r in all_invoices if normalize_industry(r.get('postOfCandidate') or r.get('companyName')).lower() == clean_id_lower or clean_id_lower in normalize_industry(r.get('postOfCandidate') or r.get('companyName')).lower()]

        # 4. Partition into Deals, Credit Notes, and Cancelled
        regular_invoices = []
        credit_note_invoices = []
        cancelled_invoices = []

        for r in all_invoices:
            info_val = str(r.get('info') or '').upper().strip()
            status_val = str(r.get('status') or '').lower().strip()
            is_rev = bool(r.get('is_revenue'))

            is_cn = (not is_rev) or (info_val in ('CN', 'RV', 'LEGAL-CN'))
            is_canc = (status_val == 'cancelled') and not is_cn

            if is_cn:
                credit_note_invoices.append(r)
            elif is_canc:
                cancelled_invoices.append(r)
            else:
                regular_invoices.append(r)

        # 5. Direct Cost & Overhead Allocation
        cost_meta = _get_live_month_costs(cursor, month if month != 'all' else '2026-08')
        overhead_pool = cost_meta.get('overhead_pool', 120000.0)
        bd_costs_map = cost_meta.get('bd_costs', {})
        tl_costs_map = cost_meta.get('tl_costs', {})

        cost_is_estimated = False
        direct_cost = 0.0

        if clean_type == 'bd':
            cursor.execute("SELECT fixed_salary, incentive_paid, travel_expense FROM cost_bd_monthly WHERE (LOWER(bd_name) = %s OR LOWER(bd_id) = %s) AND month = %s", [clean_id_lower, clean_id_lower, month])
            c_row = cursor.fetchone()
            if c_row:
                direct_cost = float(c_row['fixed_salary'] or 0) + float(c_row['incentive_paid'] or 0) + float(c_row['travel_expense'] or 0)
                cost_is_estimated = False
            else:
                cursor.execute("SELECT baseSalary FROM bd_agents WHERE LOWER(name) = %s", [clean_id_lower])
                a_row = cursor.fetchone()
                if a_row and a_row['baseSalary']:
                    direct_cost = float(a_row['baseSalary'])
                else:
                    direct_cost = 30000.0
                cost_is_estimated = True
        elif clean_type == 'tl':
            tl_cost_entry = tl_costs_map.get(clean_id_lower)
            if tl_cost_entry:
                direct_cost = tl_cost_entry.get('total', 110000.0)
                cost_is_estimated = False
            else:
                direct_cost = 80000.0
                cost_is_estimated = True
        else:
            direct_cost = 0.0
            cost_is_estimated = False

        if month == 'all':
            direct_cost *= 12.0

        gross_billed = sum(float(r['totalBillAmt'] or 0) for r in regular_invoices)
        company_share = sum(float(r['ourShare'] or 0) for r in regular_invoices)
        credit_notes = sum(float(r['totalBillAmt'] or 0) for r in credit_note_invoices)
        cancelled_billed = sum(float(r['totalBillAmt'] or 0) for r in cancelled_invoices)

        # Pro-rata overhead pool allocation
        cursor.execute(f"SELECT SUM(ourShare) as total_cs FROM v_invoice_clean v WHERE is_revenue = 1 {date_clause}", date_params)
        tot_cs_row = cursor.fetchone()
        total_network_cs = float(tot_cs_row['total_cs'] or 1.0) if tot_cs_row else 1.0
        effective_pool = overhead_pool * (12.0 if month == 'all' else 1.0)
        overhead_share = round((company_share / max(1.0, total_network_cs)) * effective_pool, 2)
        net_contribution = round(company_share - direct_cost - overhead_share - credit_notes, 2)
        net_margin_pct = round((net_contribution / company_share * 100), 1) if company_share > 0 else 0.0

        # 6. Deal Items with Allocated Direct Cost
        deals_list = []
        for r in regular_invoices:
            deal_gross = float(r['totalBillAmt'] or 0)
            deal_share = float(r['ourShare'] or 0)
            allocated_cost = round((deal_gross / gross_billed * direct_cost), 2) if gross_billed > 0 else 0.0
            net_per_deal = round(deal_share - allocated_cost, 2)
            margin_pct = round((net_per_deal / deal_share * 100), 1) if deal_share > 0 else 0.0

            if net_per_deal < 0:
                status_pill = 'loss'
                status_label = 'Loss'
            elif margin_pct < 20.0:
                status_pill = 'low_margin'
                status_label = 'Low margin'
            else:
                status_pill = 'healthy'
                status_label = 'Healthy'

            deals_list.append({
                'id': r['id'],
                'enquiry_id': r.get('enquiry_id'),
                'bill_number': r.get('billNumber') or f"INV-{r['id']}",
                'placement_date': str(r.get('placement_date') or '')[:10],
                'client_name': r.get('companyName') or 'Client Placement',
                'candidate_name': r.get('candidateName') or 'Candidate',
                'position_name': r.get('postOfCandidate') or r.get('positionName') or 'Role',
                'gross_billed': deal_gross,
                'company_share': deal_share,
                'franchisee_share': float(r.get('franchiseeShare') or 0),
                'allocated_cost': allocated_cost,
                'credit_note_amount': 0.0,
                'credit_note_reason': None,
                'remark': None,
                'net_per_deal': net_per_deal,
                'margin_pct': margin_pct,
                'status_pill': status_pill,
                'status_label': status_label,
                'bd_name': r.get('nameOfBd'),
                'is_credit_note': False
            })

        # Credit Note deals as distinct loss rows
        for cn in credit_note_invoices:
            cn_amt = float(cn['totalBillAmt'] or 0)
            info_val = str(cn.get('info') or '').upper().strip()
            
            if info_val == 'CN':
                cn_reason = "Credit note"
            elif info_val == 'RV':
                cn_reason = "Reversal"
            elif info_val == 'LEGAL-CN':
                cn_reason = "Legal credit note"
            else:
                cn_reason = "Credit note"

            remark_text = cn.get('enquiry_remark') or None
            net_per_deal = -round(cn_amt, 2)

            deals_list.append({
                'id': cn['id'],
                'enquiry_id': cn.get('enquiry_id'),
                'bill_number': cn.get('billNumber') or f"CN-{cn['id']}",
                'placement_date': str(cn.get('placement_date') or '')[:10],
                'client_name': cn.get('companyName') or 'Client Placement',
                'candidate_name': cn.get('candidateName') or 'Candidate',
                'position_name': cn.get('postOfCandidate') or cn.get('positionName') or 'Reversal Record',
                'gross_billed': 0.0,
                'company_share': 0.0,
                'franchisee_share': 0.0,
                'allocated_cost': 0.0,
                'credit_note_amount': cn_amt,
                'credit_note_reason': cn_reason,
                'remark': remark_text,
                'net_per_deal': net_per_deal,
                'margin_pct': -100.0,
                'status_pill': 'credit_note_hit',
                'status_label': 'Credit note hit',
                'bd_name': cn.get('nameOfBd'),
                'is_credit_note': True
            })

        # 7. Non-converted Enquiries
        enq_sql = f"""
            SELECT 
                e.id,
                e.companyName,
                e.positionName,
                e.enquiryStatus,
                COALESCE(e.dateOfAllocation, e.created_at) AS allocation_date,
                COALESCE(e.bill_amount, e.placementFees, 0.0) AS bill_amount,
                e.info AS remark
            FROM enquiries e
            WHERE 1=1 {enq_date_clause} {enq_entity_clause}
            ORDER BY COALESCE(e.dateOfAllocation, e.created_at) DESC
        """
        cursor.execute(enq_sql, enq_date_params + enq_entity_params)
        all_enqs = cursor.fetchall()
        
        non_converted_enqs = [
            e for e in all_enqs 
            if (str(e.get('enquiryStatus') or '').lower().strip() not in ('closed', 'offered_and_accepted'))
        ]
        total_enquiries_count = len(all_enqs)
        cost_per_enquiry = round(direct_cost / max(1, total_enquiries_count), 2) if total_enquiries_count > 0 else 0.0
        no_conversion_loss = round(len(non_converted_enqs) * cost_per_enquiry, 2)

        # 8. Unfiltered Counts for Stability
        count_all = len(deals_list)
        count_loss = sum(1 for d in deals_list if d['net_per_deal'] < 0)
        count_low_margin = sum(1 for d in deals_list if d['net_per_deal'] >= 0 and d['margin_pct'] < 20.0)
        count_cn_hit = sum(1 for d in deals_list if d['credit_note_amount'] > 0)
        count_healthy = sum(1 for d in deals_list if d['net_per_deal'] >= 0 and d['margin_pct'] >= 20.0 and d['credit_note_amount'] == 0)

        cn_cause_count = count_cn_hit
        cn_cause_amount = credit_notes
        cost_drag_deals = [d for d in deals_list if d['allocated_cost'] > d['company_share']]
        cost_drag_count = len(cost_drag_deals)
        cost_drag_amount = round(sum(d['allocated_cost'] - d['company_share'] for d in cost_drag_deals), 2)

        unique_clients = sorted(list(set(d['client_name'] for d in deals_list if d.get('client_name'))))

        # 9. Apply Active Filters
        filtered_deals = list(deals_list)

        # Status filter
        if status_filter and status_filter != 'all':
            if status_filter == 'loss':
                filtered_deals = [d for d in filtered_deals if d['net_per_deal'] < 0]
            elif status_filter == 'low_margin':
                filtered_deals = [d for d in filtered_deals if d['net_per_deal'] >= 0 and d['margin_pct'] < 20.0]
            elif status_filter == 'credit_note_hit':
                filtered_deals = [d for d in filtered_deals if d['credit_note_amount'] > 0]
            elif status_filter == 'healthy':
                filtered_deals = [d for d in filtered_deals if d['net_per_deal'] >= 0 and d['margin_pct'] >= 20.0 and d['credit_note_amount'] == 0]

        # Cause filter
        if cause_filter:
            if cause_filter == 'credit_notes':
                filtered_deals = [d for d in filtered_deals if d['credit_note_amount'] > 0]
            elif cause_filter == 'cost_drag':
                filtered_deals = [d for d in filtered_deals if d['allocated_cost'] > d['company_share']]

        # Client filter
        if client_filter:
            filtered_deals = [d for d in filtered_deals if client_filter in d['client_name'].lower()]

        # Sort
        if sort_by == 'highest_billed':
            filtered_deals.sort(key=lambda x: x['gross_billed'], reverse=True)
        elif sort_by == 'latest':
            filtered_deals.sort(key=lambda x: x['placement_date'], reverse=True)
        else: # worst_first (default)
            filtered_deals.sort(key=lambda x: x['net_per_deal'])

        # 10. Breakdown by BD for non-BD entities
        breakdown_by_bd = []
        if clean_type in ('tl', 'franchisee', 'franchise', 'city', 'industry'):
            bd_map = {}
            for d in deals_list:
                b = d.get('bd_name') or 'Other'
                if b not in bd_map:
                    bd_map[b] = {'name': b, 'deals': 0, 'gross': 0.0, 'share': 0.0, 'credit_notes': 0.0, 'net': 0.0}
                bd_map[b]['deals'] += 1
                bd_map[b]['gross'] += d['gross_billed']
                bd_map[b]['share'] += d['company_share']
                bd_map[b]['credit_notes'] += d['credit_note_amount']
                bd_map[b]['net'] += d['net_per_deal']
            breakdown_by_bd = sorted(bd_map.values(), key=lambda x: x['net'])[:5]

        # 11. Rule-based Insight Line
        insight = None
        if credit_notes > 0 and len(credit_note_invoices) > 0:
            client_cns = {}
            for cn in credit_note_invoices:
                c_name = cn.get('companyName') or 'Client'
                client_cns[c_name] = client_cns.get(c_name, 0.0) + float(cn['totalBillAmt'] or 0)
            top_client_cn = sorted(client_cns.items(), key=lambda x: x[1], reverse=True)[0]
            if top_client_cn[1] / credit_notes >= 0.5:
                pct = int(round((top_client_cn[1] / credit_notes) * 100))
                insight = f"Client {top_client_cn[0]} caused {pct}% of credit notes (₹{top_client_cn[1]:,.0f})"

        if not insight and cost_drag_amount > 0 and company_share > 0 and (cost_drag_amount > company_share * 0.3):
            insight = f"Cost drag accounts for ₹{cost_drag_amount:,.0f} across {cost_drag_count} deal{'s' if cost_drag_count > 1 else ''}"

        # Team Average
        cursor.execute(f"SELECT SUM(totalBillAmt) as net_gross, SUM(ourShare) as net_share FROM v_invoice_clean v WHERE is_revenue = 1 {date_clause}", date_params)
        net_row = cursor.fetchone()
        tot_net_gross = float(net_row['net_gross'] or 1.0) if net_row else 1.0
        tot_net_share = float(net_row['net_share'] or 1.0) if net_row else 1.0

        cursor.execute(f"SELECT SUM(ABS(totalBillAmt)) as net_cns FROM v_invoice_clean v WHERE (is_revenue = 0 OR info IN ('CN', 'RV', 'LEGAL-CN')) {date_clause}", date_params)
        cns_row = cursor.fetchone()
        tot_net_cns = float(cns_row['net_cns'] or 0.0) if cns_row else 0.0
        team_cn_rate = round((tot_net_cns / max(1.0, tot_net_gross) * 100), 1)

        return jsonify({
            'success': True,
            'entity': {
                'id': clean_id,
                'name': clean_id,
                'type': clean_type,
                'direct_cost': direct_cost,
                'cost_is_estimated': cost_is_estimated,
                'overhead_share': overhead_share,
                'gross_billed': gross_billed,
                'company_share': company_share,
                'credit_notes': credit_notes,
                'cancelled_billed': cancelled_billed,
                'net_contribution': net_contribution,
                'net_margin_pct': net_margin_pct
            },
            'summary': {
                'total_deals': len(regular_invoices),
                'gross_billed': gross_billed,
                'company_share': company_share,
                'direct_cost': direct_cost,
                'cost_is_estimated': cost_is_estimated,
                'overhead_share': overhead_share,
                'credit_notes': credit_notes,
                'cancelled_billed': cancelled_billed,
                'net_contribution': net_contribution,
                'net_margin_pct': net_margin_pct
            },
            'counts': {
                'status': {
                    'all': count_all,
                    'loss': count_loss,
                    'low_margin': count_low_margin,
                    'credit_note_hit': count_cn_hit,
                    'healthy': count_healthy
                },
                'cause': {
                    'credit_notes': {'count': cn_cause_count, 'amount': cn_cause_amount},
                    'cost_drag': {'count': cost_drag_count, 'amount': cost_drag_amount},
                    'no_conversion': {'count': len(non_converted_enqs), 'amount': no_conversion_loss}
                }
            },
            'unique_clients': unique_clients,
            'deals': filtered_deals,
            'non_converted_enquiries': [
                {
                    'id': e['id'],
                    'company_name': e.get('companyName') or 'Client',
                    'position_name': e.get('positionName') or 'Position',
                    'enquiry_status': e.get('enquiryStatus') or 'inprogress',
                    'allocation_date': str(e.get('allocation_date') or '')[:10],
                    'bill_amount': float(e.get('bill_amount') or 0),
                    'cost_drag': cost_per_enquiry
                }
                for e in non_converted_enqs
            ],
            'breakdown_by_bd': breakdown_by_bd,
            'insight': insight,
            'team_avg': {
                'credit_note_rate_pct': team_cn_rate
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
    finally:
        conn.close()

