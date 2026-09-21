import sys
import os

# Add parent directory to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from db import ensure_tables_exist, get_db_connection
from cost_performance_controller import _get_live_month_costs, normalize_city, normalize_industry

def test_live_cost_performance():
    print("=== 1. Checking Database Tables ===")
    ensure_tables_exist()

    print("\n=== 2. Testing Live Month Cost Configuration ===")
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        month = "2026-08"
        cost_meta = _get_live_month_costs(cursor, month)
        print(f"Month: {month}")
        print(f"Overhead pool: {cost_meta['overhead_pool']}")
        print(f"Allocation basis: {cost_meta['allocation_basis']}")
        print(f"BD costs configured: {len(cost_meta['bd_costs'])}")
        print(f"TL costs configured: {len(cost_meta['tl_costs'])}")

        print("\n=== 3. Testing Normalization Functions ===")
        print("Bangalore ->", normalize_city("Bangalore"))
        print("Bengaluru ->", normalize_city("bengaluru"))
        print("Bombay ->", normalize_city("Bombay"))
        print("IT & Software ->", normalize_industry("IT Software Services"))

        print("\n=== 4. Testing Live BD Dimension Query ===")
        cursor.execute("""
            SELECT 
                TRIM(COALESCE(e.bdMemberName, 'Head Office')) AS bd_name,
                COUNT(i.id) AS placements,
                SUM(COALESCE(i.ourShare, 0.0)) AS our_share,
                SUM(COALESCE(i.serviceCharges, 0.0)) AS gross
            FROM invoice i
            LEFT JOIN enquiries e ON i.enquiry_id = e.id
            WHERE i.billDate LIKE '2026-08%'
            GROUP BY TRIM(COALESCE(e.bdMemberName, 'Head Office'))
            ORDER BY our_share DESC
            LIMIT 5
        """)
        bd_rows = cursor.fetchall()
        print(f"Top BDs in Aug 2026 ({len(bd_rows)} rows):")
        for r in bd_rows:
            print(f"  - {r['bd_name']}: Placements={r['placements']}, Company Share=Rs. {float(r['our_share'] or 0):,.2f}, Gross=Rs. {float(r['gross'] or 0):,.2f}")

        print("\n=== 5. Testing Live TL Dimension Query ===")
        cursor.execute("""
            SELECT 
                TRIM(COALESCE(e.teamLeaderName, 'Head Office')) AS tl_name,
                COUNT(i.id) AS placements,
                SUM(COALESCE(i.ourShare, 0.0)) AS our_share
            FROM invoice i
            LEFT JOIN enquiries e ON i.enquiry_id = e.id
            WHERE i.billDate LIKE '2026-08%'
            GROUP BY TRIM(COALESCE(e.teamLeaderName, 'Head Office'))
            ORDER BY our_share DESC
            LIMIT 5
        """)
        tl_rows = cursor.fetchall()
        print(f"Top TLs in Aug 2026 ({len(tl_rows)} rows):")
        for r in tl_rows:
            print(f"  - {r['tl_name']}: Placements={r['placements']}, Company Share=Rs. {float(r['our_share'] or 0):,.2f}")

        print("\n=== Live Cost-of-Performance Logic Test Complete: SUCCESS ===")
    finally:
        conn.close()

if __name__ == '__main__':
    test_live_cost_performance()
