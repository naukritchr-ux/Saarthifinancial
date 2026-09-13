import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db import get_db_connection

def check_schema():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DESCRIBE invoice")
    cols = cursor.fetchall()
    all_col_names = [c['Field'] for c in cols]
    print(f"Total columns in invoice table: {len(cols)}")
    print(f"Is 'isManualShareOverride' in invoice table? {'isManualShareOverride' in all_col_names}")
    
    # Print columns matching share or override
    share_cols = [c for c in cols if any(k in c['Field'].lower() for k in ['share', 'override', 'manual'])]
    print("Relevant columns in invoice table:")
    for c in share_cols:
        print(f"  - {c['Field']} ({c['Type']})")

    print("\nAll columns in invoice table:")
    print(", ".join(all_col_names))

    conn.close()

if __name__ == '__main__':
    check_schema()
