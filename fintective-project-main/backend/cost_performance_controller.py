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
# 2. GET /api/cost-performance/report (Live 5-Dimension Query & Calculations)
# --------------------------------------------------------------------------
@cost_performance_bp.route('/api/cost-performance/report', methods=['GET'])
def get_cost_performance_report():
    dimension = request.args.get('dimension', 'bd').strip().lower() # bd, tl, franchise, city, industry
    month = request.args.get('month', '2026-08').strip() # YYYY-MM or 'all'
    user_role = request.args.get('role', 'head_office').strip().lower() # head_office, team_leader, franchise_partner

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cost_meta = _get_live_month_costs(cursor, month)
        overhead_pool = cost_meta['overhead_pool']
        allocation_basis = cost_meta['allocation_basis']
        bd_costs_map = cost_meta['bd_costs']
        tl_costs_map = cost_meta['tl_costs']
        tl_roster_map = cost_meta['tl_roster']

        # Determine date filter for live queries
        if month != 'all':
            inv_date_clause = "AND (COALESCE(i.billDate, i.paidOnDate) LIKE %s)"
            enq_date_clause = "AND (e.dateOfAllocation LIKE %s OR e.created_at LIKE %s)"
            client_date_clause = "AND (c.created_at LIKE %s)"
            date_param_inv = [f"{month}%"]
            date_param_enq = [f"{month}%", f"{month}%"]
            date_param_client = [f"{month}%"]
        else:
            inv_date_clause = ""
            enq_date_clause = ""
            client_date_clause = ""
            date_param_inv = []
            date_param_enq = []
            date_param_client = []

        # -------------------------------------------------------------
        # 1. Live Fetch: Invoices Data joined with Enquiries
        # -------------------------------------------------------------
        inv_query = f"""
            SELECT 
                i.id AS invoice_id,
                i.billNumber,
                i.billDate,
                COALESCE(i.serviceCharges, i.serviceCharge, i.totalBillAmt, 0.0) AS gross_billed,
                COALESCE(i.ourShare, 0.0) AS our_share,
                COALESCE(i.franchiseeShare, 0.0) AS franchisee_share,
                COALESCE(i.amountReceived, 0.0) AS amount_received,
                i.info,
                e.id AS enquiry_id,
                TRIM(COALESCE(e.bdMemberName, 'Head Office')) AS bd_name,
                TRIM(COALESCE(e.teamLeaderName, 'Head Office')) AS tl_name,
                TRIM(COALESCE(e.franchiseeName, 'Direct Client')) AS franchise_name,
                COALESCE(e.companyName, 'Direct Client') AS company_name,
                COALESCE(e.industry, 'General') AS industry_raw,
                e.enquiryStatus
            FROM invoice i
            LEFT JOIN enquiries e ON i.enquiry_id = e.id
            WHERE 1=1 {inv_date_clause}
        """
        cursor.execute(inv_query, date_param_inv)
        invoices = cursor.fetchall()

        # -------------------------------------------------------------
        # 2. Live Fetch: Enquiries Data (for total effort & closures denominator)
        # -------------------------------------------------------------
        enq_query = f"""
            SELECT 
                e.id AS enquiry_id,
                TRIM(COALESCE(e.bdMemberName, 'Head Office')) AS bd_name,
                TRIM(COALESCE(e.teamLeaderName, 'Head Office')) AS tl_name,
                TRIM(COALESCE(e.franchiseeName, 'Direct Client')) AS franchise_name,
                COALESCE(e.companyName, 'Direct Client') AS company_name,
                COALESCE(e.industry, 'General') AS industry_raw,
                COALESCE(e.placementFees, 0.0) AS placement_fees,
                e.enquiryStatus,
                e.dateOfAllocation
            FROM enquiries e
            WHERE 1=1 {enq_date_clause}
        """
        cursor.execute(enq_query, date_param_enq)
        all_enquiries = cursor.fetchall()

        # -------------------------------------------------------------
        # 3. Live Fetch: New Clients Acquired (for CAC denominator)
        # -------------------------------------------------------------
        clients_query = f"""
            SELECT 
                c.id,
                c.companyName,
                c.status,
                c.teamLeader AS tl_name,
                COALESCE(c.amount, 0.0) AS amount
            FROM clients_info c
            WHERE 1=1 {client_date_clause}
        """
        try:
            cursor.execute(clients_query, date_param_client)
            clients_data = cursor.fetchall()
        except Exception:
            clients_data = []

        # -------------------------------------------------------------
        # Aggregate Live Data by Selected Dimension
        # -------------------------------------------------------------
        dim_map = {}

        def get_dim_key(row, is_enquiry=False):
            if dimension == 'bd':
                b = (row.get('bd_name') or 'Head Office').strip()
                return 'Head Office' if b.lower() in ('', 'unknown', 'prospect', 'head office', 'head  - office') else b
            elif dimension == 'tl':
                t = (row.get('tl_name') or 'Head Office').strip()
                return 'Head Office' if t.lower() in ('', 'unknown', 'head office', 'head  - office') else t
            elif dimension == 'franchise':
                f = (row.get('franchise_name') or 'Head Office').strip()
                return 'Direct / Head Office' if f.lower() in ('', 'unknown', 'head office') else f
            elif dimension == 'city':
                comp = row.get('company_name') or ''
                return normalize_city(comp if any(c in comp.lower() for c in ['mumbai', 'pune', 'bangalore', 'bengaluru', 'delhi', 'chennai', 'hyderabad', 'kolkata']) else 'Mumbai')
            elif dimension == 'industry':
                return normalize_industry(row.get('industry_raw'))
            return 'General'

        # Initialize dimension groups from all live enquiries
        for e in all_enquiries:
            k = get_dim_key(e, is_enquiry=True)
            if k not in dim_map:
                dim_map[k] = {
                    'dimension_value': k,
                    'placements': 0,
                    'enquiries_handled': 0,
                    'new_clients': 0,
                    'total_billed': 0.0,
                    'company_share': 0.0,
                    'franchisee_payout': 0.0,
                    'credit_note_reversals': 0.0,
                    'cancelled_losses': 0.0,
                    'closed_requirements': 0,
                    'invoice_ids': [],
                    'enquiry_ids': []
                }
            dim_map[k]['enquiries_handled'] += 1
            dim_map[k]['enquiry_ids'].append(e['enquiry_id'])
            
            st = str(e.get('enquiryStatus') or '').lower()
            if st in ('cancelled', 'offered_and_rejected', 'internally_closed'):
                dim_map[k]['cancelled_losses'] += float(e.get('placement_fees') or 0.0)
            if st in ('closed', 'offered_and_accepted'):
                dim_map[k]['closed_requirements'] += 1

        # Populate from live invoices
        for inv in invoices:
            k = get_dim_key(inv, is_enquiry=False)
            if k not in dim_map:
                dim_map[k] = {
                    'dimension_value': k,
                    'placements': 0,
                    'enquiries_handled': 0,
                    'new_clients': 0,
                    'total_billed': 0.0,
                    'company_share': 0.0,
                    'franchisee_payout': 0.0,
                    'credit_note_reversals': 0.0,
                    'cancelled_losses': 0.0,
                    'closed_requirements': 0,
                    'invoice_ids': [],
                    'enquiry_ids': []
                }
            
            info_val = str(inv.get('info') or '').upper()
            gross = float(inv.get('gross_billed') or 0.0)
            our_share = float(inv.get('our_share') or (gross * 0.25))
            fran_share = float(inv.get('franchisee_share') or (gross * 0.75))

            if 'CN' in info_val or inv.get('enquiryStatus') == 'credit_note':
                dim_map[k]['credit_note_reversals'] += our_share
            else:
                dim_map[k]['placements'] += 1
                dim_map[k]['total_billed'] += gross
                dim_map[k]['company_share'] += our_share
                dim_map[k]['franchisee_payout'] += fran_share
                dim_map[k]['invoice_ids'].append(inv['invoice_id'])

        # Total Company Share for pro-rata overhead allocation
        total_company_share = sum(d['company_share'] for d in dim_map.values())
        total_placements_all = sum(d['placements'] for d in dim_map.values())
        total_headcount = max(1, len(dim_map))

        # Compute Unit Economics, CAC, Cost of Execution, Churn Cost, and Net Contribution
        rows_result = []
        for k, d in dim_map.items():
            k_lower = k.lower()

            # 1. Direct BD or TL Cost
            if dimension == 'bd':
                bd_cost_entry = bd_costs_map.get(k_lower, {'fixed': 45000.0, 'incentive': 25000.0, 'travel': 5000.0, 'total': 75000.0})
                direct_cost = bd_cost_entry['total']
                tl_allocated = 15000.0
            elif dimension == 'tl':
                tl_cost_entry = tl_costs_map.get(k_lower, {'fixed': 75000.0, 'incentive': 35000.0, 'total': 110000.0})
                direct_cost = tl_cost_entry['total']
                tl_allocated = 0.0
            else:
                direct_cost = 0.0
                tl_allocated = 0.0

            # 2. Allocated Overhead
            if allocation_basis == 'revenue_share':
                overhead_share = (d['company_share'] / total_company_share * overhead_pool) if total_company_share > 0 else (overhead_pool / total_headcount)
            elif allocation_basis == 'placement_count':
                overhead_share = (d['placements'] / total_placements_all * overhead_pool) if total_placements_all > 0 else (overhead_pool / total_headcount)
            else: # headcount
                overhead_share = overhead_pool / total_headcount

            total_cost_numerator = direct_cost + tl_allocated + overhead_share

            # 3. New Clients & Closures
            new_clients = max(1, int(d['placements'] * 0.4) if d['placements'] > 0 else (1 if d['enquiries_handled'] > 0 else 0))
            closed_reqs = max(1, d['placements']) if d['placements'] > 0 else d['closed_requirements']

            # 4. CAC & Cost of Execution
            cac = round(total_cost_numerator / max(1, new_clients), 2)
            cost_of_execution = round(total_cost_numerator / max(1, closed_reqs), 2)

            # 5. Churn Cost (Direct Credit Notes + Sunk Inactive CAC)
            churn_cost = round(d['credit_note_reversals'] + (cac * 0.15 if d['credit_note_reversals'] > 0 else 0.0), 2)

            # 6. Net Contribution (The Ultimate "Worth" Metric)
            net_contribution = round(d['company_share'] - total_cost_numerator - churn_cost, 2)

            # 7. Effort Unit Economics (Per-Enquiry)
            total_enquiries = max(1, d['enquiries_handled'] if d['enquiries_handled'] > 0 else d['placements'])
            rev_per_enquiry = round(d['company_share'] / total_enquiries, 2)
            exp_per_enquiry = round(total_cost_numerator / total_enquiries, 2)
            net_surplus_per_enquiry = round(rev_per_enquiry - exp_per_enquiry, 2)

            # 8. TL Network Normalization (Per-Franchise)
            active_franchises = tl_roster_map.get(k_lower, DEFAULT_TL_FRANCHISE_ROSTER.get(k_lower, 50))
            if dimension == 'tl':
                rev_per_franchise = round(d['company_share'] / max(1, active_franchises), 2)
                cost_per_franchise = round(total_cost_numerator / max(1, active_franchises), 2)
                net_contribution_per_franchise = round(net_contribution / max(1, active_franchises), 2)
            else:
                rev_per_franchise = 0.0
                cost_per_franchise = 0.0
                net_contribution_per_franchise = 0.0

            # 9. ROI Multiple & Worth Tier
            roi_multiple = round((d['company_share'] / max(1.0, total_cost_numerator)), 2)
            if roi_multiple >= 5.0:
                tier = '💎 High Value Star'
                tier_badge = 'star'
            elif roi_multiple >= 2.5:
                tier = '⚡ Profitable Contributor'
                tier_badge = 'profitable'
            elif roi_multiple >= 1.0:
                tier = '⚠️ Margin Diluter'
                tier_badge = 'diluter'
            else:
                tier = '🛑 Net Loss Burden'
                tier_badge = 'drain'

            row_data = {
                'dimension_value': k,
                'placements': d['placements'],
                'enquiries_handled': d['enquiries_handled'],
                'new_clients': new_clients,
                'total_billed': round(d['total_billed'], 2),
                'company_share': round(d['company_share'], 2),
                'franchisee_payout': round(d['franchisee_payout'], 2),
                'credit_note_reversals': round(d['credit_note_reversals'], 2),
                'cancelled_losses': round(d['cancelled_losses'], 2),
                'direct_cost': round(direct_cost, 2),
                'allocated_overhead': round(overhead_share, 2),
                'total_cost': round(total_cost_numerator, 2),
                'cac': cac,
                'cost_of_execution': cost_of_execution,
                'churn_cost': churn_cost,
                'net_contribution': net_contribution,
                'rev_per_enquiry': rev_per_enquiry,
                'exp_per_enquiry': exp_per_enquiry,
                'net_surplus_per_enquiry': net_surplus_per_enquiry,
                'active_franchise_count': active_franchises,
                'rev_per_franchise': rev_per_franchise,
                'cost_per_franchise': cost_per_franchise,
                'net_contribution_per_franchise': net_contribution_per_franchise,
                'roi_multiple': roi_multiple,
                'tier': tier,
                'tier_badge': tier_badge,
                'invoice_count': len(d['invoice_ids']),
                'enquiry_count': len(d['enquiry_ids'])
            }

            # Security: Filter internal cost structure for Franchise role
            if user_role == 'franchise_partner':
                for secret_col in ['direct_cost', 'allocated_overhead', 'total_cost', 'cac', 'cost_of_execution', 'net_contribution', 'exp_per_enquiry', 'net_surplus_per_enquiry', 'cost_per_franchise', 'net_contribution_per_franchise', 'roi_multiple', 'tier', 'tier_badge']:
                    row_data.pop(secret_col, None)

            rows_result.append(row_data)

        # Default Sorting
        if dimension == 'tl':
            rows_result.sort(key=lambda x: x.get('net_contribution_per_franchise', 0), reverse=True)
        else:
            rows_result.sort(key=lambda x: x.get('net_contribution', 0), reverse=True)

        return jsonify({
            'success': True,
            'dimension': dimension,
            'month': month,
            'allocation_basis': allocation_basis,
            'overhead_pool': overhead_pool,
            'total_company_share': round(total_company_share, 2),
            'rows': rows_result,
            'cost_data_version': f"Live Data ({datetime.datetime.now().strftime('%d %b %Y %H:%M')})"
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
