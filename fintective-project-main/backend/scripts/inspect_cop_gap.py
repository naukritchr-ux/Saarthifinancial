import os
import sys
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app import app
from scripts.db_guard import get_db_connection

conn, _, _ = get_db_connection(type('Args', (), {'env': 'staging'}))
cur = conn.cursor()
client = app.test_client()
h = {'x-api-key': os.environ.get('API_KEY', '')}

cop_res = client.get('/api/cost-performance?fy=2026-2027&month=all', headers=h)
cop_rows = cop_res.json.get('rows', [])

# Check which invoices COP counts in total_billed
# In cost_performance_controller line 596:
# if not is_cn: entry['total_billed'] += float(inv['totalBillAmt'])
# where is_cn = (not inv['is_revenue']) or (str(inv['info'] or '').upper() in ('CN', 'RV', 'LEGAL-CN'))

cur.execute("""
    SELECT id, totalBillAmt, billNumber, billDate, is_revenue, info, status, nameOfBd
    FROM v_invoice_clean 
    WHERE fy = '2026-2027' AND is_revenue = 1
""")
dash_invs = {r['id']: r for r in cur.fetchall()}

# Let's inspect all invoices evaluated by COP:
# In cost_performance_controller:
# d_start = '2026-04-01', d_end = '2027-03-31'
cur.execute("""
    SELECT 
        v.id, v.totalBillAmt, v.billNumber, v.billDate, v.is_revenue, v.info, v.status, v.nameOfBd,
        v.dateReceived, v.paidOnDate
    FROM v_invoice_clean v
    WHERE (COALESCE(v.billDate, v.dateReceived, v.paidOnDate) >= '2026-04-01' 
      AND COALESCE(v.billDate, v.dateReceived, v.paidOnDate) <= '2027-03-31')
""")
cop_all_invs = cur.fetchall()

# In COP, what gets added to total_billed?
cop_billed_invs = {}
for inv in cop_all_invs:
    bd = inv['nameOfBd']
    if not bd or bd.lower() in ('none', '-', 'null'):
        continue
    is_cn = (not inv['is_revenue']) or (str(inv['info'] or '').upper() in ('CN', 'RV', 'LEGAL-CN'))
    if not is_cn:
        cop_billed_invs[inv['id']] = inv

print(f"Invoices in COP total_billed: {len(cop_billed_invs)}")
print(f"Sum totalBillAmt in COP: Rs {sum(float(r['totalBillAmt']) for r in cop_billed_invs.values()):,.2f}")
print(f"Invoices in Dashboard revenue invoices: {len(dash_invs)}")
print(f"Sum totalBillAmt in Dashboard: Rs {sum(float(r['totalBillAmt']) for r in dash_invs.values()):,.2f}")

diff_ids = set(cop_billed_invs.keys()) ^ set(dash_invs.keys())
in_cop_not_dash = [cop_billed_invs[i] for i in cop_billed_invs if i not in dash_invs]
in_dash_not_cop = [dash_invs[i] for i in dash_invs if i not in cop_billed_invs]

print(f"\nIn COP but NOT in Dashboard revenue invoices ({len(in_cop_not_dash)} invoices):")
for r in in_cop_not_dash:
    print(f"  ID: {r['id']} | BillNo: {r['billNumber']} | BillDate: {r['billDate']} | Amt: Rs {r['totalBillAmt']} | BD: '{r['nameOfBd']}' | info: '{r['info']}'")

print(f"\nIn Dashboard but NOT in COP ({len(in_dash_not_cop)} invoices):")
for r in in_dash_not_cop:
    print(f"  ID: {r['id']} | BillNo: {r['billNumber']} | BillDate: {r['billDate']} | Amt: Rs {r['totalBillAmt']} | BD: '{r['nameOfBd']}'")

conn.close()
