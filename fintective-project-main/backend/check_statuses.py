import os
import mysql.connector
from dotenv import load_dotenv

load_dotenv()

def main():
    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_PORT = int(os.getenv("DB_PORT", 3306))
    DB_USER = os.getenv("DB_USER", "root")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "")
    DB_NAME = os.getenv("DB_NAME", "crm_db")
    
    db_config = {
        'host': DB_HOST,
        'port': DB_PORT,
        'user': DB_USER,
        'password': DB_PASSWORD,
        'database': DB_NAME
    }
    
    conn = mysql.connector.connect(**db_config)
    cursor = conn.cursor(dictionary=True)
    
    print("Checking rows with both bill_no and bill_date:")
    cursor.execute("""
        SELECT COUNT(*), SUM(bill_amount) 
        FROM enquiries 
        WHERE bill_no IS NOT NULL AND bill_no != '' 
          AND bill_date IS NOT NULL
    """)
    res = cursor.fetchone()
    print(f"  Count: {res['COUNT(*)']}, Sum: {res['SUM(bill_amount)']}")
    
    print("\nChecking rows in invoice table:")
    cursor.execute("""
        SELECT COUNT(*), SUM(serviceCharges) 
        FROM invoice 
        WHERE billNumber IS NOT NULL AND billNumber != '' 
          AND billDate IS NOT NULL
    """)
    res_inv = cursor.fetchone()
    print(f"  Invoice Table with Date Count: {res_inv['COUNT(*)']}, Sum: {res_inv['SUM(serviceCharges)']}")
    
    conn.close()

if __name__ == '__main__':
    main()
