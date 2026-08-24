import os
import pymysql
import datetime
from dotenv import load_dotenv

# Load environment variables
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(dotenv_path=os.path.join(BACKEND_DIR, '.env'))

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", 3306))
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_NAME = os.getenv("DB_NAME", "crm_db")

def get_db_connection():
    return pymysql.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME,
        cursorclass=pymysql.cursors.DictCursor
    )

def parse_date(d):
    if not d:
        return None
    if isinstance(d, datetime.date) or isinstance(d, datetime.datetime):
        return d
    d_str = str(d).strip()
    for fmt in ('%Y-%m-%d', '%d-%m-%Y', '%d/%m/%Y', '%Y/%m/%d', '%d-%b-%y', '%d-%b-%Y'):
        try:
            return datetime.datetime.strptime(d_str, fmt).date()
        except ValueError:
            continue
    return None

def main():
    print("="*75)
    print("Saarthi360 Lead Analytics Report: Lead Value, Yield & Velocity")
    print("="*75)
    
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # A. BD Agents Lead Yield & Conversion Value
        print("\n1. BUSINESS DEVELOPMENT AGENTS LEAD CONVERSION & REVENUE YIELD")
        print("-" * 75)
        
        # Query total leads allocated per BD Agent
        cursor.execute("""
            SELECT bdMemberName, COUNT(*) as total_leads
            FROM enquiries
            WHERE bdMemberName IS NOT NULL AND bdMemberName != ''
            GROUP BY bdMemberName
        """)
        bd_leads = {r['bdMemberName'].strip().lower(): r for r in cursor.fetchall()}
        
        # Query closed deals and net revenue from invoices
        cursor.execute("""
            SELECT nameOfBd, COUNT(*) as closed_deals, 
                   SUM(serviceCharges) as gross_rev, SUM(ourShare) as net_rev
            FROM invoice
            WHERE nameOfBd IS NOT NULL AND nameOfBd != ''
            GROUP BY nameOfBd
        """)
        bd_revs = {r['nameOfBd'].strip().lower(): r for r in cursor.fetchall()}
        
        # Combine BD metrics
        all_bds = sorted(list(set(list(bd_leads.keys()) + list(bd_revs.keys()))))
        print(f"{'BD Agent Name':<28} | {'Leads':<6} | {'Closed':<6} | {'Gross Revenue':<14} | {'Net Revenue':<14} | {'Yield / Lead':<12}")
        print("-" * 75)
        for bd in all_bds:
            leads_cnt = bd_leads.get(bd, {}).get('total_leads', 0)
            closed_cnt = bd_revs.get(bd, {}).get('closed_deals', 0)
            gross = float(bd_revs.get(bd, {}).get('gross_rev', 0) or 0)
            net = float(bd_revs.get(bd, {}).get('net_rev', 0) or 0)
            yield_per_lead = net / leads_cnt if leads_cnt > 0 else 0.0
            
            # Capitalize name for presentation
            display_name = bd.title() if bd else "Unattributed"
            print(f"{display_name:<28} | {leads_cnt:<6} | {closed_cnt:<6} | Rs. {gross:>10,.0f} | Rs. {net:>10,.0f} | Rs. {yield_per_lead:>8,.2f}")
            
        # B. Franchisee Hubs Lead Yield & Conversion Value
        print("\n2. FRANCHISEE HUBS LEAD CONVERSION & REVENUE YIELD")
        print("-" * 75)
        
        # Query total leads allocated per Franchisee
        cursor.execute("""
            SELECT franchiseeName, COUNT(*) as total_leads
            FROM enquiries
            WHERE franchiseeName IS NOT NULL AND franchiseeName != '' AND franchiseeName != 'Unknown'
            GROUP BY franchiseeName
        """)
        fran_leads = {r['franchiseeName'].strip().lower(): r for r in cursor.fetchall()}
        
        # Query closed deals and net revenue from invoices
        cursor.execute("""
            SELECT franchiseName, COUNT(*) as closed_deals, 
                   SUM(serviceCharges) as gross_rev, SUM(ourShare) as net_rev
            FROM invoice
            WHERE franchiseName IS NOT NULL AND franchiseName != '' AND franchiseName != 'Unknown'
            GROUP BY franchiseName
        """)
        fran_revs = {r['franchiseName'].strip().lower(): r for r in cursor.fetchall()}
        
        # Combine Franchisee metrics
        all_frans = sorted(list(set(list(fran_leads.keys()) + list(fran_revs.keys()))))
        print(f"{'Franchisee Hub Name':<28} | {'Leads':<6} | {'Closed':<6} | {'Gross Revenue':<14} | {'Net Revenue':<14} | {'Yield / Lead':<12}")
        print("-" * 75)
        for fran in all_frans:
            leads_cnt = fran_leads.get(fran, {}).get('total_leads', 0)
            closed_cnt = fran_revs.get(fran, {}).get('closed_deals', 0)
            gross = float(fran_revs.get(fran, {}).get('gross_rev', 0) or 0)
            net = float(fran_revs.get(fran, {}).get('net_rev', 0) or 0)
            yield_per_lead = net / leads_cnt if leads_cnt > 0 else 0.0
            
            display_name = fran.title() if fran else "Unattributed"
            print(f"{display_name:<28} | {leads_cnt:<6} | {closed_cnt:<6} | Rs. {gross:>10,.0f} | Rs. {net:>10,.0f} | Rs. {yield_per_lead:>8,.2f}")

        # C. Lead Velocity Analysis (Allocation to Bill Date)
        print("\n3. LEAD VELOCITY (AVERAGE DAYS FROM ALLOCATION TO INVOICING)")
        print("-" * 75)
        
        cursor.execute("""
            SELECT e.bdMemberName, e.franchiseeName, e.dateOfAllocation, i.billDate, e.companyName
            FROM enquiries e
            JOIN invoice i ON e.id = i.enquiry_id
            WHERE e.dateOfAllocation IS NOT NULL AND i.billDate IS NOT NULL
        """)
        closed_deals = cursor.fetchall()
        
        bd_velocities = {}
        fran_velocities = {}
        total_velocity_days = 0
        total_valid_deals = 0
        skipped_deals = 0
        
        for deal in closed_deals:
            alloc_d = parse_date(deal['dateOfAllocation'])
            bill_d = parse_date(deal['billDate'])
            
            if not alloc_d or not bill_d:
                skipped_deals += 1
                continue
                
            delta = (bill_d - alloc_d).days
            if delta < 0:
                # Allocation date after bill date is a sequence anomaly, skip
                skipped_deals += 1
                continue
                
            total_velocity_days += delta
            total_valid_deals += 1
            
            bd_name = (deal['bdMemberName'] or '').strip().lower()
            if bd_name:
                if bd_name not in bd_velocities:
                    bd_velocities[bd_name] = []
                bd_velocities[bd_name].append(delta)
                
            fran_name = (deal['franchiseeName'] or '').strip().lower()
            if fran_name:
                if fran_name not in fran_velocities:
                    fran_velocities[fran_name] = []
                fran_velocities[fran_name].append(delta)
                
        # Print BD velocities
        print("Average Deal Velocity by Business Development Agent:")
        print(f"  {'BD Agent Name':<28} | {'Closed Deals':<12} | {'Average Days to Close':<20}")
        print("  " + "-" * 67)
        for bd in sorted(bd_velocities.keys()):
            deltas = bd_velocities[bd]
            avg_days = sum(deltas) / len(deltas)
            print(f"  {bd.title():<28} | {len(deltas):<12} | {avg_days:>18.1f} days")
            
        # Print Franchisee velocities
        print("\nAverage Deal Velocity by Franchisee Hub:")
        print(f"  {'Franchisee Hub Name':<28} | {'Closed Deals':<12} | {'Average Days to Close':<20}")
        print("  " + "-" * 67)
        for fran in sorted(fran_velocities.keys()):
            deltas = fran_velocities[fran]
            avg_days = sum(deltas) / len(deltas)
            print(f"  {fran.title():<28} | {len(deltas):<12} | {avg_days:>18.1f} days")
            
        print(f"\nLead Velocity Metrics Summary:")
        print(f"  Total valid deals analyzed:  {total_valid_deals}")
        print(f"  Skipped/unparseable deals:   {skipped_deals}")
        if total_valid_deals > 0:
            print(f"  Network average velocity:    {total_velocity_days / total_valid_deals:.1f} days")
            
    finally:
        conn.close()
    print("="*75)

if __name__ == "__main__":
    main()
