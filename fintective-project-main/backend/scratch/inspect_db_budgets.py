import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from db import get_db_connection

conn = get_db_connection()
cur = conn.cursor()

print('=== 1. budgets TABLE ===')
try:
    cur.execute('SELECT * FROM budgets')
    rows = cur.fetchall()
    print('Total records in budgets table:', len(rows))
    for r in rows:
        print(' ', r)
except Exception as e:
    print('budgets table error:', e)

print('\n=== 2. DISTINCT EXPENSE CATEGORIES IN DB ===')
try:
    cur.execute("SELECT DISTINCT category FROM transactions WHERE type='expense'")
    rows = cur.fetchall()
    for r in rows:
        print(' ', r)
except Exception as e:
    print('transactions query error:', e)

print('\n=== 3. ALL TABLES IN DB ===')
cur.execute('SHOW TABLES')
for r in cur.fetchall():
    print(' ', r)

conn.close()
