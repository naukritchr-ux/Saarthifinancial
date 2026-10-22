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

