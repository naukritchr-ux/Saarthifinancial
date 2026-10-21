import os
import json
import re
import datetime
import requests
from typing import Dict, List, Any, Optional

# Matches by first word + last word of the name, ignoring case, extra spaces and symbols
def name_key(name: str) -> str:
    if not name:
        return ""
    parts = [p for p in re.split(r'\s+', name.lower()) if re.search(r'[a-z]', p)]
    if not parts:
        return ""
    return parts[0] if len(parts) == 1 else f"{parts[0]} {parts[-1]}"

# Row format: [basic, hra, conveyance, pf, esic, pt, gratuity, tdsAmount]
# pf/esic/pt/gratuity: 1 = applicable, 0 = not applicable
RAW_SHEET = {
    "avadai marthuvar":  [21100, 8440,  1200, 0, 0, 1, 1, 0],
    "hrutika mohal":     [21100, 8440,  2000, 1, 0, 1, 1, 0],
    "jahnvi thakker":    [26502, 13251, 1200, 1, 0, 1, 1, 0],
    "joyeeta khaskel":   [41500, 33200, 2000, 1, 0, 1, 1, 0],
    "komal bhanushali":  [46000, 36800, 2000, 1, 0, 1, 1, 0],
    "preshita rane":     [32500, 24375, 2000, 1, 0, 1, 1, 0],
    "priyanka panjwani": [35000, 26250, 2000, 1, 0, 1, 1, 0],
    "rajalaxmi das":     [41250, 33000, 2000, 1, 0, 1, 1, 0],
    "rashesh doshi":     [77704, 38852, 1200, 1, 0, 1, 1, 0],
    "rushali rajgor":    [21100, 8440,  2000, 1, 0, 1, 1, 0],
    "snehal kadu":       [32500, 24375, 2000, 1, 0, 1, 1, 0],
    "surbhi jain":       [46000, 36800, 2000, 1, 0, 1, 1, 0],
    "vedika tolani":     [23000, 17250, 2000, 0, 0, 1, 1, 0],
    "jagruti doshi":     [21381, 10691, 1200, 1, 0, 1, 1, 0],
    "kajal khamkar":     [21100, 2110,  1500, 0, 0, 1, 1, 0],
    "deepti singh":      [21100, 2110,  1200, 0, 0, 1, 1, 0],
    "bankim doshi":      [100000, 50000, 1200, 0, 0, 0, 0, 0],
    "nita doshi":        [21100, 10550, 1200, 0, 0, 0, 0, 4000],
    "pragya doshi":      [30000, 15000, 1200, 0, 0, 1, 0, 0],
    "chaitali doshi":    [30000, 15000, 1200, 0, 0, 1, 0, 0],
    "preeti doshi":      [30000, 15000, 1200, 0, 0, 1, 0, 0],
    "minal sanghvi":     [50000, 25000, 1200, 0, 0, 1, 0, 10000],
    "jigna sanghvi":     [50000, 25000, 1200, 0, 0, 1, 0, 10000],
    "saumya gala":       [75000, 37500, 1200, 0, 0, 1, 0, 12567],
    "sammed magdum":     [26250, 19688, 2000, 1, 0, 1, 1, 0],
    "mama paltasingh":   [21100, 2110,  1200, 0, 0, 1, 1, 0],
    "neha thakkar":      [50000, 25000, 1200, 0, 0, 1, 0, 0],
    "purna ghadi":       [15500, 9300,  2000, 0, 1, 1, 1, 0],
    "rupali gomai":      [15000, 9000,  2000, 1, 1, 1, 1, 0],
    "ashutosh hiremath": [21100, 2110,  1200, 0, 0, 1, 1, 0],
    "shreya jain":       [7500,  3625,  0,    0, 0, 0, 0, 0],
    "ruchi shukla":      [21100, 4220,  1200, 0, 0, 1, 1, 0],
    "sneha jaiswal":     [21100, 2110,  1200, 0, 0, 1, 1, 0],
    "naomi luise":       [21100, 2110,  1200, 0, 0, 1, 1, 0],
    "jiya sanda":        [21100, 2110,  1200, 0, 0, 1, 1, 0],
    "sandhya mahto":     [21100, 2110,  1200, 0, 0, 1, 1, 0],
    "sadhana nishad":    [21100, 4220,  1200, 0, 0, 1, 1, 0],
    "sakshi keshari":    [21100, 4220,  1200, 0, 0, 1, 1, 0],
    "biswajit parida":   [21100, 4220,  1200, 0, 0, 1, 1, 0],
    "rohit srivastava":  [21100, 4220,  1200, 0, 0, 1, 1, 0],
    "sonali singh":      [21100, 4220,  1200, 0, 0, 1, 1, 0],
    "prangyalisha rout": [21100, 4220,  1200, 0, 0, 1, 1, 0],
    "mimansha nanda":    [21100, 4220,  1200, 0, 0, 1, 1, 0],
    "manasi ugale":      [2000,  1000,  1200, 0, 0, 0, 0, 0],
    "sakshi hatkar":     [7000,  3000,  1200, 0, 0, 0, 0, 0],
    "dhruv mewada":      [21100, 4220,  1200, 0, 0, 0, 1, 0],
}

SHEET_VALUES = {
    k: {
        'basic': v[0],
        'hra': v[1],
        'conveyance': v[2],
        'pf': bool(v[3]),
        'esic': bool(v[4]),
        'pt': bool(v[5]),
        'gratuity': bool(v[6]),
        'tds': v[7]
    }
    for k, v in RAW_SHEET.items()
}

def get_sheet_values(name: str):
    return SHEET_VALUES.get(name_key(name))

def is_new_formula_period(year: int, js_month: int) -> bool:
    return year > 2026 or (year == 2026 and js_month >= 3)

def get_days_in_month(month_idx: int, financial_year: str) -> int:
    try:
        start_year = int(financial_year.split("-")[0])
    except:
        start_year = 2026
    actual_year = start_year if month_idx < 9 else start_year + 1
    cal_month = (month_idx + 4) if month_idx < 9 else (month_idx - 8)
    if cal_month in (1, 3, 5, 7, 8, 10, 12):
        return 31
    elif cal_month in (4, 6, 9, 11):
        return 30
    else:
        # Leap year check for Feb
        if (actual_year % 4 == 0 and actual_year % 100 != 0) or (actual_year % 400 == 0):
            return 29
        return 28

# In-memory cache with disk backup
CACHE_DIR = os.path.join(os.path.dirname(__file__), 'scratch', 'payroll_cache')
os.makedirs(CACHE_DIR, exist_ok=True)
_employees_cache = None
_attendance_cache: Dict[str, Any] = {}

def fetch_employees_list() -> List[Dict[str, Any]]:
    global _employees_cache
    if _employees_cache is not None:
        return _employees_cache
    
    cache_file = os.path.join(CACHE_DIR, 'employees.json')
    if os.path.exists(cache_file):
        try:
            with open(cache_file, 'r', encoding='utf-8') as f:
                _employees_cache = json.load(f)
                return _employees_cache
        except Exception:
            pass

    try:
        r = requests.get('https://api.sarthi360.in/employees', timeout=20)
        if r.status_code == 200:
            _employees_cache = r.json()
            with open(cache_file, 'w', encoding='utf-8') as f:
                json.dump(_employees_cache, f)
            return _employees_cache
    except Exception as e:
        print('[Payroll Service] Error fetching employees from API:', e)
    
    return []

def fetch_monthly_attendance(financial_year: str, month_idx: int) -> List[Dict[str, Any]]:
    cache_key = f"{financial_year}_{month_idx}"
    if cache_key in _attendance_cache:
        return _attendance_cache[cache_key]
    
    cache_file = os.path.join(CACHE_DIR, f"att_{cache_key}.json")
    if os.path.exists(cache_file):
        try:
            with open(cache_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                _attendance_cache[cache_key] = data
                return data
        except Exception:
            pass

    try:
        url = f"https://api.sarthi360.in/api/payroll/attendance?financialYear={financial_year}&month={month_idx}"
        r = requests.get(url, timeout=15)
        if r.status_code == 200:
            data = r.json()
            _attendance_cache[cache_key] = data
            with open(cache_file, 'w', encoding='utf-8') as f:
                json.dump(data, f)
            return data
    except Exception as e:
        print(f"[Payroll Service] Error fetching attendance for {financial_year} month {month_idx}:", e)
    
    return []

def calculate_single_employee_payroll(emp: Dict[str, Any], record: Dict[str, Any], financial_year: str, month_idx: int) -> Optional[Dict[str, Any]]:
    fixed_gross = float(record.get('FixedGrossSalary') or 0.0)
    if fixed_gross <= 0:
        return None
    
    leaves_taken = int(record.get('LeavesTaken') or 0)
    paid_leaves = int(record.get('PaidLeaves') or 0)
    emp_name = (emp.get('name') or emp.get('firstName', '') + ' ' + emp.get('lastName', '')).strip()

    try:
        start_year = int(financial_year.split("-")[0])
    except:
        start_year = 2026
    
    payroll_js_month = (month_idx + 3) % 12
    payroll_year = start_year if month_idx < 9 else start_year + 1

    days_in_month = get_days_in_month(month_idx, financial_year)
    unpaid_leaves = max(0, leaves_taken - paid_leaves)
    paid_days = max(0, days_in_month - unpaid_leaves)

    is_new = is_new_formula_period(payroll_year, payroll_js_month)
    sheet_vals = get_sheet_values(emp_name)

    basic_da_record = record.get('BasicDA')
    basic_da_val = float(basic_da_record) if basic_da_record is not None else None

    if is_new:
        if sheet_vals:
            basic_salary = float(sheet_vals['basic'])
        elif basic_da_val is not None:
            basic_salary = basic_da_val
        else:
            basic_salary = round(fixed_gross * 0.5)

        hra = float(sheet_vals['hra']) if sheet_vals else (round(basic_salary * 0.4) if emp.get('hra') else 0.0)
        conveyance = float(sheet_vals['conveyance']) if sheet_vals else (1200.0 if emp.get('conveyanceAllowance') else 0.0)
        medical_allowance = 0.0
        other_allowance = round(fixed_gross - basic_salary - hra - conveyance)
        gross = round(basic_salary + hra + conveyance + other_allowance)

        earn_basic = round((basic_salary / days_in_month) * paid_days)
        earn_hra = round((hra / days_in_month) * paid_days)
        earn_conveyance = round((conveyance / days_in_month) * paid_days)
        earn_other = round((other_allowance / days_in_month) * paid_days)
        earn_gross = earn_basic + earn_hra + earn_conveyance + earn_other

        # PF
        pf_app = sheet_vals['pf'] if sheet_vals else bool(emp.get('epfEmployee') and emp.get('epfEmployer'))
        pf_wages = round(earn_gross - earn_hra) if pf_app else 0
        pf = round(pf_wages * 0.12) if (pf_app and pf_wages < 15000) else (1800 if pf_app else 0)

        # ESIC
        esic_app = sheet_vals['esic'] if sheet_vals else bool(emp.get('esiRegistrationNumber'))
        esic_eligible = esic_app and basic_salary <= 21001
        esic = round(earn_basic * 0.0075) if esic_eligible else 0

        # PT
        pt_app = sheet_vals['pt'] if sheet_vals else bool(emp.get('professionalTax'))
        gender = emp.get('gender') or 'Male'
        pt = 200 if (pt_app and ((gender == 'Female' and gross > 25000) or gender == 'Male')) else 0

        # TDS
        tds = float(sheet_vals['tds']) if sheet_vals else (round(earn_gross * 0.10) if emp.get('tdsSalary') in ('yes', 1, True) else 0)

        # LWF
        dept = (emp.get('department') or '').lower()
        is_june_dec = month_idx in (2, 8)
        lwf_base = 25 if (dept in ('admin', 'accounts') and is_june_dec) else 0
        lwf = round((lwf_base / days_in_month) * paid_days)

        # Advance
        adv_val = record.get('Advance')
        advance = round(float(adv_val)) if (adv_val is not None and float(adv_val) != -1) else 0

        total_deduction = pf + esic + pt + tds + lwf + advance
        net_payable = earn_gross - total_deduction

        # Company side additions for CTC
        gratuity_app = sheet_vals['gratuity'] if sheet_vals else bool(emp.get('gratuityProvision'))
        gratuity = round(earn_basic * 0.0481) if gratuity_app else 0
        employer_pf = pf if pf_app else 0
        employer_esic = round(earn_basic * 0.0325) if esic_eligible else 0
        employer_lwf = 75 if is_june_dec else 0
        bonus = 0

        ctc = round(earn_gross + gratuity + employer_pf + employer_esic + bonus + employer_lwf)

    else:
        # Pre-August 2026 formula
        basic_salary = basic_da_val if basic_da_val is not None else round(fixed_gross * 0.5)
        earn_basic = round((basic_salary / days_in_month) * paid_days)
        hra = round(basic_salary * 0.5) if emp.get('hra') else 0
        earn_hra = round((hra / days_in_month) * paid_days)
        conveyance = 1200 if emp.get('conveyanceAllowance') else 0
        earn_conveyance = round((conveyance / days_in_month) * paid_days)
        medical = 1000 if emp.get('medicalAllowance') else 0
        earn_medical = round((medical / days_in_month) * paid_days)
        other = round(fixed_gross - basic_salary - hra - conveyance - medical) if emp.get('otherExpenses') else 0
        earn_other = round((other / days_in_month) * paid_days)

        gross = round(basic_salary + hra + conveyance + medical + other)
        earn_gross = earn_basic + earn_hra + earn_conveyance + earn_medical + earn_other

        pf_app = bool(emp.get('epfEmployee') and emp.get('epfEmployer'))
        pf_wages = round(earn_gross - earn_hra)
        pf = round(pf_wages * 0.12) if (pf_app and pf_wages < 15000) else (1800 if pf_app else 0)

        esic_app = bool(emp.get('esiRegistrationNumber'))
        esic = round(earn_gross * 0.0075) if (esic_app and earn_gross < 21000) else 0

        gender = emp.get('gender') or 'Male'
        pt = 200 if (emp.get('professionalTax') and ((gender == 'Female' and earn_gross > 25000) or gender == 'Male')) else 0

        dept = (emp.get('department') or '').lower()
        is_june_dec = month_idx in (2, 8)
        lwf = 25 if (dept in ('admin', 'accounts') and is_june_dec) else 0

        adv_val = record.get('Advance')
        advance = round(float(adv_val)) if (adv_val is not None and float(adv_val) != -1) else 0

        tds = round(earn_gross * 0.10) if emp.get('tdsSalary') in ('yes', 1, True) else 0
        total_deduction = pf + esic + pt + lwf + tds + advance
        net_payable = earn_gross - total_deduction

        gratuity = round(earn_basic * 0.0481) if emp.get('gratuityProvision') else 0
        employer_pf = pf if pf_app else 0
        employer_esic = round(earn_gross * 0.0325) if (esic_app and earn_gross < 21000) else 0
        employer_lwf = 75 if is_june_dec else 0
        bonus = round(earn_gross * 0.0833) if dept in ('admin', 'accounts') else 0
        ctc = round(earn_gross + employer_pf + employer_esic + gratuity + employer_lwf + bonus)

    return {
        'employee_id': emp.get('id'),
        'name': emp_name,
        'department': emp.get('department') or 'Operations',
        'designation': emp.get('designation') or 'Staff',
        'fixed_gross': fixed_gross,
        'paid_days': paid_days,
        'unpaid_leaves': unpaid_leaves,
        'net_payable': net_payable,
        'ctc': ctc,
        'payment_date': record.get('PaymentDate'),
        'transaction_id': record.get('TransactionID'),
        'financial_year': financial_year,
        'month_idx': month_idx
    }

def get_payroll_transactions_for_fy(financial_year: str = '2026-2027') -> List[Dict[str, Any]]:
    employees = fetch_employees_list()
    if not employees:
        return []
    
    emp_map = {e['id']: e for e in employees if 'id' in e}

    # Month names mapping
    months_names = [
        "April", "May", "June", "July", "August", "September",
        "October", "November", "December", "January", "February", "March"
    ]
    
    try:
        start_year = int(financial_year.split("-")[0])
    except:
        start_year = 2026

    transactions = []

    for m in range(12):
        att_records = fetch_monthly_attendance(financial_year, m)
        if not att_records:
            continue
        
        cal_month_num = (m + 4) if m < 9 else (m - 8)
        cal_year = start_year if m < 9 else start_year + 1
        month_date_str = f"{cal_year}-{cal_month_num:02d}-28"
        month_label = f"{months_names[m]} {cal_year}"

        for record in att_records:
            emp_id = record.get('EmployeeID')
            emp = emp_map.get(emp_id)
            if not emp:
                continue

            # Check workEndDate
            work_end = emp.get('workEndDate')
            if work_end:
                try:
                    we_date = str(work_end)[:10]
                    if month_date_str > we_date:
                        continue
                except:
                    pass
            
            calc = calculate_single_employee_payroll(emp, record, financial_year, m)
            if not calc or calc['ctc'] <= 0:
                continue
            
            tx_id = f"sal-{financial_year}-m{m}-{emp_id}"
            transactions.append({
                'id': tx_id,
                'title': f"Salary: {calc['name']}",
                'companyName': f"Payroll ({month_label})",
                'amount': float(calc['ctc']),  # Company CTC cost
                'type': 'expense',
                'category': 'Salaries & Wages',
                'subCategory': 'Employee CTC',
                'date': calc.get('payment_date') or month_date_str,
                'paymentMode': 'Direct Bank Transfer',
                'referenceId': calc.get('transaction_id') or f"PAY-{financial_year}-{m}-{emp_id}",
                'description': f"{month_label} CTC for {calc['name']} ({calc['department']} - {calc['designation']}), Net: Rs.{calc['net_payable']:,}",
                'financialYear': financial_year,
                'is_payroll': True,
                'employeeId': emp_id,
                'employeeName': calc['name'],
                'department': calc['department'],
                'netPayable': calc['net_payable'],
                'fixedGross': calc['fixed_gross'],
                'paidDays': calc['paid_days']
            })

    return transactions

_cached_all_payroll = None

def get_all_payroll_transactions() -> List[Dict[str, Any]]:
    global _cached_all_payroll
    if _cached_all_payroll is not None:
        return _cached_all_payroll
    
    cache_file = os.path.join(CACHE_DIR, 'all_payroll_txs.json')
    if os.path.exists(cache_file):
        try:
            with open(cache_file, 'r', encoding='utf-8') as f:
                _cached_all_payroll = json.load(f)
                return _cached_all_payroll
        except Exception:
            pass

    # Always ensure current financial year is loaded immediately
    all_txs = []
    try:
        fy_26_txs = get_payroll_transactions_for_fy('2026-2027')
        all_txs.extend(fy_26_txs)
    except Exception as e:
        print("[Payroll Service] Note on FY 2026-2027:", e)
    
    # Check if 2023-2024 is cached on disk
    if os.path.exists(os.path.join(CACHE_DIR, 'att_2023-2024_0.json')):
        try:
            fy_23_txs = get_payroll_transactions_for_fy('2023-2024')
            all_txs.extend(fy_23_txs)
        except Exception:
            pass
    
    _cached_all_payroll = all_txs
    try:
        with open(cache_file, 'w', encoding='utf-8') as f:
            json.dump(all_txs, f)
    except Exception:
        pass
    return all_txs


