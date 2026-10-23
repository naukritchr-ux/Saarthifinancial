import argparse
import datetime
from db_guard import add_db_safety_args, get_db_connection

parser = argparse.ArgumentParser()
add_db_safety_args(parser)
args = parser.parse_args()

conn, host, db_name = get_db_connection(args)
today = datetime.date(2026, 10, 23)

try:
    with conn.cursor() as cur:
        print("--- Payroll records table by FY ---")
        cur.execute("""
            SELECT 
                financial_year,
                COUNT(*) as cnt,
                SUM(ctc_amount) as total_ctc,
                SUM(CASE WHEN date <= %s THEN ctc_amount ELSE 0 END) as actual_ctc,
                SUM(CASE WHEN date > %s THEN ctc_amount ELSE 0 END) as projected_ctc
            FROM payroll_records
            GROUP BY financial_year
        """, (today, today))
        for r in cur.fetchall():
            print(r)

        print("\n--- Expenditure table salaries by FY date ranges ---")
        for fy, (s, e) in [('2024-2025', ('2024-04-01', '2025-03-31')),
                           ('2025-2026', ('2025-04-01', '2026-03-31')),
                           ('2026-2027', ('2026-04-01', '2027-03-31'))]:
            cur.execute("""
                SELECT 
                    COALESCE(SUM(amount), 0) as total_exp,
                    COALESCE(SUM(CASE WHEN LOWER(expenses) LIKE '%%salaries%%' OR LOWER(expenses) LIKE '%%salary%%' OR LOWER(particulars) LIKE '%%salary%%' THEN amount ELSE 0 END), 0) as salary_in_exp
                FROM expenditure
                WHERE is_deleted = 0 AND billDate BETWEEN %s AND %s
            """, (s, e))
            print(fy, cur.fetchone())
finally:
    conn.close()
