import os
import pymysql
from dotenv import load_dotenv

# Load environment variables
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
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
    print(f"Connecting to MySQL database: {DB_NAME}...")
    
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
        
        # Check total rows in expenditure
        cursor.execute("SELECT COUNT(*) as count FROM expenditure")
        total_exp = cursor.fetchone()['count']
        
        # Check rows with bdAgentId linked
        cursor.execute("SELECT COUNT(*) as count FROM expenditure WHERE bdAgentId IS NOT NULL AND bdAgentId != ''")
        linked_bd = cursor.fetchone()['count']
        
        # Check rows with franchiseeId linked
        cursor.execute("SELECT COUNT(*) as count FROM expenditure WHERE franchiseeId IS NOT NULL AND franchiseeId != ''")
        linked_fran = cursor.fetchone()['count']
        
        # Check rows with either linked
        cursor.execute("SELECT COUNT(*) as count FROM expenditure WHERE (bdAgentId IS NOT NULL AND bdAgentId != '') OR (franchiseeId IS NOT NULL AND franchiseeId != '')")
        linked_any = cursor.fetchone()['count']
        
        # Get the 10 most recent transactions to inspect if they were logged post-fix
        cursor.execute("""
            SELECT id, billDate, particulars, expenses, amount, bdAgentId, franchiseeId 
            FROM expenditure 
            ORDER BY id DESC
            LIMIT 10
        """)
        recent_rows = cursor.fetchall()
        
        print("\nReconciliation Linkage Report:")
        print(f"  Total Expenditure rows:          {total_exp}")
        print(f"  Linked to BD Agents:             {linked_bd}")
        print(f"  Linked to Franchisee Hubs:       {linked_fran}")
        print(f"  Total Linked Expenditures:       {linked_any}")
        print(f"  Unlinked Expenditures (Legacy):  {total_exp - linked_any}")
        
        print("\nMost Recent 10 Expenditures (Inspection for Post-Fix Entries):")
        for r in recent_rows:
            bd_str = r['bdAgentId'] if r['bdAgentId'] else "NULL (Unlinked)"
            fran_str = r['franchiseeId'] if r['franchiseeId'] else "NULL (Unlinked)"
            print(f"  - [Exp-{r['id']}] Date: {r['billDate']} | Amount: Rs. {r['amount']:.2f} | Category: {r['expenses']} | BD: {bd_str} | Franchisee: {fran_str} | Particulars: {r['particulars']}")
            
        conn.close()
    except Exception as e:
        print("An error occurred during attribution verification:", str(e))
    print("="*60)

if __name__ == "__main__":
    main()
