import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from db import get_db_connection

try:
    conn = get_db_connection()
    with conn.cursor() as cursor:
        cursor.execute("SHOW TABLES")
        tables = cursor.fetchall()
        print("Database tables:")
        if not tables:
            print("No tables found in the database!")
        else:
            for t in tables:
                table_name = list(t.values())[0]
                cursor.execute(f"SELECT COUNT(*) as count FROM `{table_name}`")
                count = cursor.fetchone()["count"]
                print(f" - {table_name}: {count} rows")
except Exception as e:
    print("Database connection error:", str(e))
finally:
    if 'conn' in locals():
        conn.close()
