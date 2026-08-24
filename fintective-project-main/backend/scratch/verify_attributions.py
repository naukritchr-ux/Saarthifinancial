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
    print("Saarthi360 Transaction Linkage Verification Audit")
    print("="*60)
    print(f"Connecting to MySQL database: {DB_NAME} on {DB_HOST}...")
    
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
        
        # 1. Check total rows in expenditure
        cursor.execute("SELECT COUNT(*) as count FROM expenditure")
        total_exp = cursor.fetchone()['count']
        
        # 2. Check rows with bdAgentId linked
        cursor.execute("SELECT COUNT(*) as count FROM expenditure WHERE bdAgentId IS NOT NULL AND bdAgentId != ''")
        linked_bd = cursor.fetchone()['count']
        
        # 3. Check rows with franchiseeId linked
        cursor.execute("SELECT COUNT(*) as count FROM expenditure WHERE franchiseeId IS NOT NULL AND franchiseeId != ''")
        linked_fran = cursor.fetchone()['count']
        
        # 4. Check rows with either linked
        cursor.execute("SELECT COUNT(*) as count FROM expenditure WHERE (bdAgentId IS NOT NULL AND bdAgentId != '') OR (franchiseeId IS NOT NULL AND franchiseeId != '')")
        linked_any = cursor.fetchone()['count']
        
        # 5. Get sample linked transactions
        cursor.execute("""
            SELECT id, billDate, particulars, expenses, amount, bdAgentId, franchiseeId 
            FROM expenditure 
            WHERE (bdAgentId IS NOT NULL AND bdAgentId != '') OR (franchiseeId IS NOT NULL AND franchiseeId != '')
            ORDER BY id DESC
            LIMIT 5
        """)
        samples = cursor.fetchall()
        
        print("\nReconciliation Linkage Report:")
        print(f"  Total Expenditure rows:          {total_exp}")
        print(f"  Linked to BD Agents:             {linked_bd}")
        print(f"  Linked to Franchisee Hubs:       {linked_fran}")
        print(f"  Total Linked Expenditures:       {linked_any}")
        print(f"  Unlinked Expenditures (Legacy):  {total_exp - linked_any}")
        
        if samples:
            print("\nSample Post-Fix Linked Expenditures (Recent First):")
            for s in samples:
                bd_str = s['bdAgentId'] if s['bdAgentId'] else "None"
                fran_str = s['franchiseeId'] if s['franchiseeId'] else "None"
                print(f"  - [Exp-{s['id']}] Date: {s['billDate']} | Amount: Rs. {s['amount']:.2f} | Category: {s['expenses']} | BD: {bd_str} | Franchisee: {fran_str} | Particulars: {s['particulars']}")
        else:
            print("\n[Notice] No linked expenditures found in the database. All existing records are unattributed legacy entries.")
            
        conn.close()
    except Exception as e:
        print("An error occurred during attribution verification:", str(e))
    print("="*60)

if __name__ == "__main__":
    main()
