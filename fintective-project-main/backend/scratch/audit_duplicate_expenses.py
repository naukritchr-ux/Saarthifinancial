import os
import pymysql
from dotenv import load_dotenv

# Load environment variables
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(dotenv_path=os.path.join(BACKEND_DIR, '.env'))

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", 3306))
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_NAME = os.getenv("DB_NAME", "crm_db")

def main():
    print("="*60)
    print("Saarthi360 Duplicate Expenditures Audit Report")
    print("="*60)
    print(f"Connecting to database: {DB_NAME}...")
    
    try:
        conn = pymysql.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME,
            cursorclass=pymysql.cursors.DictCursor
        )
        cursor = conn.cursor()
        
        # 1. Query groups sharing the same Date, Category, and Net amount
        query = """
            SELECT billDate, expenses, net, COUNT(*) as duplicate_count, GROUP_CONCAT(particulars SEPARATOR ' | ') as particulars_list
            FROM expenditure
            WHERE particulars != 'particulars' AND expenses != 'expenses'
            GROUP BY billDate, expenses, net
            HAVING duplicate_count > 1
            ORDER BY duplicate_count DESC, billDate DESC
        """
        cursor.execute(query)
        duplicates = cursor.fetchall()
        
        # Calculate totals
        total_duplicates_found = 0
        total_duplicated_amount = 0.0
        
        print(f"\nPotential Duplicate Expenditures (Identical Date, Category, and Amount):")
        if duplicates:
            for d in duplicates:
                count = d['duplicate_count']
                amount = float(d['net'] or 0)
                total_duplicates_found += count
                total_duplicated_amount += (amount * (count - 1)) # Amount duplicated (leakage)
                print(f"  - Date: {d['billDate']} | Category: {d['expenses']} | Amount: Rs. {amount:,.2f} | Count: {count}")
                print(f"    Vendors/Details: {d['particulars_list']}")
                print("-" * 50)
                
            print(f"\nAudit Summary Metrics:")
            print(f"  Total duplicate transactions:      {total_duplicates_found}")
            print(f"  Estimated cash flow double-entry:  Rs. {total_duplicated_amount:,.2f}")
        else:
            print("  No duplicate expenditure transactions found. Cash outflows are clean of date/amount/category matches!")
            
        conn.close()
    except Exception as e:
        print("An error occurred during duplicate auditing:", str(e))
    print("="*60)

if __name__ == "__main__":
    main()
