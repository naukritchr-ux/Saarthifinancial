import sys, os
sys.path.insert(0, os.path.abspath('backend'))
import dotenv
dotenv.load_dotenv('backend/.env')
from db import get_db_connection

def test_compare():
    conn = get_db_connection()
    with conn.cursor() as cur:
        s1 = {'bd': 'Komal Suresh Bhanushali', 'tl': 'All', 'fn': 'All'}
        s2 = {'bd': 'All', 'tl': 'Joyeeta Joydeb Khaskel', 'fn': 'All'}
        
        start_date = '2026-04-01'
        end_date = '2027-03-31'
        
        results = []
        for s in [s1, s2]:
            where = [
                "(LOWER(TRIM(COALESCE(e.enquiryStatus, ''))) IN ('closed', 'offered_and_accepted', 'invoiced', 'r', 'rv', 'billed', 'collected') OR (e.bill_no IS NOT NULL AND e.bill_no != ''))",
                "LEFT(COALESCE(e.bill_date, e.dateOfAllocation, e.created_at), 10) >= %s",
                "LEFT(COALESCE(e.bill_date, e.dateOfAllocation, e.created_at), 10) <= %s"
            ]
            params = [start_date, end_date]
            if s['bd'] != 'All':
                where.append("LOWER(TRIM(e.bdMemberName)) = %s")
                params.append(s['bd'].lower())
            if s['tl'] != 'All':
                where.append("LOWER(TRIM(e.teamLeaderName)) = %s")
                params.append(s['tl'].lower())
            
            q = f'''
                SELECT 
                    COUNT(DISTINCT LOWER(TRIM(e.companyName))) as companies,
                    COUNT(*) as invoiced_deals,
                    COALESCE(SUM(COALESCE(e.bill_amount, 0)), 0) as revenue,
                    COALESCE(SUM(COALESCE(inv_enq.ourShare, inv_bill.ourShare, e.bill_amount * 0.25)), 0) as our_share,
                    SUM(CASE WHEN (inv_enq.ourShare IS NOT NULL OR inv_bill.ourShare IS NOT NULL) THEN 1 ELSE 0 END) as verified_count,
                    SUM(CASE WHEN (inv_enq.ourShare IS NULL AND inv_bill.ourShare IS NULL) THEN 1 ELSE 0 END) as estimated_count
                FROM enquiries e
                LEFT JOIN (
                    SELECT enquiry_id, MAX(ourShare) as ourShare 
                    FROM invoice WHERE enquiry_id IS NOT NULL AND enquiry_id > 0 GROUP BY enquiry_id
                ) inv_enq ON inv_enq.enquiry_id = e.id
                LEFT JOIN (
                    SELECT billNumber, MAX(ourShare) as ourShare 
                    FROM invoice WHERE billNumber IS NOT NULL AND billNumber != '' GROUP BY billNumber
                ) inv_bill ON (inv_enq.enquiry_id IS NULL AND e.bill_no IS NOT NULL AND e.bill_no != '' AND inv_bill.billNumber = e.bill_no)
                WHERE {' AND '.join(where)}
            '''
            cur.execute(q, params)
            r = cur.fetchone()
            results.append(r)
        print('Results:\n', results)
    conn.close()

if __name__ == '__main__':
    test_compare()
