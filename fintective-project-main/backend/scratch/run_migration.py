import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db import get_db_connection

def run_migration():
    conn = get_db_connection()
    cursor = conn.cursor()
    print("Executing: ALTER TABLE invoice ADD COLUMN isManualShareOverride BOOLEAN DEFAULT FALSE")
    cursor.execute("ALTER TABLE invoice ADD COLUMN isManualShareOverride BOOLEAN DEFAULT FALSE")
    conn.commit()
    print("Migration executed successfully.")

    print("\nVerifying DESCRIBE invoice:")
    cursor.execute("DESCRIBE invoice")
    cols = cursor.fetchall()
    matched = [c.get('Field') for c in cols if 'manual' in c.get('Field','').lower() or 'override' in c.get('Field','').lower()]
    print("Matched columns:", matched)
    
    # Also verify full info for the column
    col_info = [c for c in cols if c.get('Field') == 'isManualShareOverride']
    print("Column details:", col_info)

    conn.close()

if __name__ == '__main__':
    run_migration()
