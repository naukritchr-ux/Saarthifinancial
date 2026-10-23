import os, sys, json
import argparse
from db_guard import add_db_safety_args, get_db_connection

p = argparse.ArgumentParser()
add_db_safety_args(p)
conn, _, _ = get_db_connection(p.parse_args(['--env', 'staging']))
cur = conn.cursor()

# Get employees in Apr-Aug 2026
cur.execute("SELECT DISTINCT employee_id FROM payroll_records WHERE financial_year = '2026-2027' AND date <= '2026-10-23'")
apr_aug_emps = set(r['employee_id'] for r in cur.fetchall())

# Get employees in Jan-Feb 2027
cur.execute("SELECT DISTINCT employee_id FROM payroll_records WHERE financial_year = '2026-2027' AND date > '2026-10-23'")
jan_feb_emps = set(r['employee_id'] for r in cur.fetchall())

missing_19 = apr_aug_emps - jan_feb_emps
print(f"Total distinct employees across Apr-Aug 2026: {len(apr_aug_emps)}")
print(f"Total distinct employees across Jan-Feb 2027: {len(jan_feb_emps)}")
print(f"Overlap (present in BOTH): {len(apr_aug_emps.intersection(jan_feb_emps))}")
print(f"Difference (worked in Apr-Aug but NOT in Jan-Feb): {len(missing_19)}")

cache_file = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'scratch', 'payroll_cache', 'employees.json'))
emp_map = {}
if os.path.exists(cache_file):
    with open(cache_file, 'r', encoding='utf-8') as f:
        emps_api = json.load(f)
        emp_map = {e['id']: e for e in emps_api if 'id' in e}

m9_cache = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'scratch', 'payroll_cache', 'att_2026-2027_9.json'))
m9_map = {}
if os.path.exists(m9_cache):
    with open(m9_cache, 'r', encoding='utf-8') as f:
        m9_raw = json.load(f)
        m9_map = {r['EmployeeID']: r for r in m9_raw}

left_before_sep = 0
in_m9_null_salary = 0
not_in_m9 = 0

for eid in missing_19:
    eid_int = int(eid) if str(eid).isdigit() else eid
    emp = emp_map.get(eid_int)
    we = str(emp.get('workEndDate') or '')[:10] if emp else ''
    m9_rec = m9_map.get(eid_int)
    
    if we and we <= '2026-09-01':
        left_before_sep += 1
    elif m9_rec and (not m9_rec.get('FixedGrossSalary') or float(m9_rec.get('FixedGrossSalary') or 0) <= 0):
        in_m9_null_salary += 1
    else:
        not_in_m9 += 1

print("\nBreakdown of the 19 employees who worked in Apr-Aug but not in Jan-Feb:")
print(f"  1. Left company before September (workEndDate on or before 2026-09-01): {left_before_sep}")
print(f"  2. In Month 9 roster but had null/zero salary: {in_m9_null_salary}")
print(f"  3. Not on the Month 9 roster: {not_in_m9}")
