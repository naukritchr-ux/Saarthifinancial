import sqlite3
import os
import re
import datetime
from dotenv import load_dotenv

# Load env file
load_dotenv()

DB_NAME = os.getenv("DB_NAME", "crm_db")
DB_PORT = 3306
DB_HOST = "localhost"
DB_USER = "root"
DB_PASSWORD = ""

class SQLiteDateString(str):
    @property
    def month(self):
        try:
            return int(self.split(' ')[0].split('-')[1])
        except:
            return None
        
    @property
    def year(self):
        try:
            return int(self.split(' ')[0].split('-')[0])
        except:
            return None
        
    @property
    def day(self):
        try:
            return int(self.split(' ')[0].split('-')[2])
        except:
            return None
        
    def __sub__(self, other):
        try:
            self_dt = datetime.datetime.strptime(self.split(' ')[0], '%Y-%m-%d').date()
            if isinstance(other, datetime.timedelta):
                res_dt = self_dt - other
                return SQLiteDateString(res_dt.strftime('%Y-%m-%d'))
            elif isinstance(other, str):
                other_dt = datetime.datetime.strptime(other.split(' ')[0], '%Y-%m-%d').date()
            elif isinstance(other, (datetime.date, datetime.datetime)):
                other_dt = other.date() if isinstance(other, datetime.datetime) else other
            else:
                return NotImplemented
            return self_dt - other_dt
        except Exception as e:
            print("SQLiteDateString __sub__ failed:", str(e))
            return datetime.timedelta(0)
        
    def __rsub__(self, other):
        try:
            self_dt = datetime.datetime.strptime(self.split(' ')[0], '%Y-%m-%d').date()
            if isinstance(other, datetime.timedelta):
                # other - self_dt => not standard for timedelta
                return NotImplemented
            elif isinstance(other, str):
                other_dt = datetime.datetime.strptime(other.split(' ')[0], '%Y-%m-%d').date()
            elif isinstance(other, (datetime.date, datetime.datetime)):
                other_dt = other.date() if isinstance(other, datetime.datetime) else other
            else:
                return NotImplemented
            return other_dt - self_dt
        except Exception as e:
            print("SQLiteDateString __rsub__ failed:", str(e))
            return datetime.timedelta(0)

    def __add__(self, other):
        if isinstance(other, datetime.timedelta):
            try:
                self_dt = datetime.datetime.strptime(self.split(' ')[0], '%Y-%m-%d').date()
                res_dt = self_dt + other
                return SQLiteDateString(res_dt.strftime('%Y-%m-%d'))
            except Exception as e:
                print("SQLiteDateString __add__ failed:", str(e))
                return self
        return NotImplemented

    def __radd__(self, other):
        return self.__add__(other)

def parse_sqlite_value(val):
    if not isinstance(val, str):
        return val
    # Check YYYY-MM-DD
    if len(val) == 10 and val[4] == '-' and val[7] == '-':
        return SQLiteDateString(val)
    # Check YYYY-MM-DD HH:MM:SS
    elif len(val) >= 19 and val[4] == '-' and val[7] == '-' and val[10] == ' ' and val[13] == ':' and val[16] == ':':
        return SQLiteDateString(val)
    return val

class SQLiteDictCursor:
    def __init__(self, conn):
        self.cursor = conn.cursor()
    
    def execute(self, query, params=None):
        # Convert MySQL %s parameter placeholders to SQLite ? placeholders
        query = query.replace('%s', '?')
        
        # Convert MySQL specific DATE_SUB calculations
        query = query.replace("DATE_SUB(CURDATE(), INTERVAL 3 MONTH)", "date('now', '-3 month')")
        query = query.replace("date_sub(curdate(), interval 3 month)", "date('now', '-3 month')")
        
        if params is not None:
            # If params is a single item, make it a tuple
            if not isinstance(params, (list, tuple, dict)):
                params = (params,)
            self.cursor.execute(query, params)
        else:
            self.cursor.execute(query)
        return self
        
    def _parse_row(self, row, columns):
        parsed_row = {}
        for col, val in zip(columns, row):
            parsed_row[col] = parse_sqlite_value(val)
        return parsed_row
        
    def fetchall(self):
        rows = self.cursor.fetchall()
        if not rows:
            return []
        columns = [col[0] for col in self.cursor.description]
        return [self._parse_row(row, columns) for row in rows]
        
    def fetchone(self):
        row = self.cursor.fetchone()
        if row is None:
            return None
        columns = [col[0] for col in self.cursor.description]
        return self._parse_row(row, columns)
        
    @property
    def description(self):
        return self.cursor.description
        
    @property
    def rowcount(self):
        return self.cursor.rowcount
        
    @property
    def lastrowid(self):
        return self.cursor.lastrowid
        
    def close(self):
        self.cursor.close()
        
    def __enter__(self):
        return self
        
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()

class SQLiteConnectionWrapper:
    def __init__(self, db_path):
        self.conn = sqlite3.connect(db_path, check_same_thread=False)
        try:
            self.conn.execute("PRAGMA journal_mode=WAL;")
            self.conn.execute("PRAGMA synchronous=NORMAL;")
        except Exception as e:
            print("Warning: Failed to set SQLite PRAGMAs:", str(e))
        
    def cursor(self, *args, **kwargs):
        return SQLiteDictCursor(self.conn)
        
    def commit(self):
        self.conn.commit()
        
    def rollback(self):
        self.conn.rollback()
        
    def close(self):
        self.conn.close()
        
    def __enter__(self):
        return self
        
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()

_DB_INITIALIZED = False

def get_db_connection(select_db=True):
    global _DB_INITIALIZED
    if not _DB_INITIALIZED:
        _DB_INITIALIZED = True
        try:
            init_db()
        except Exception as e:
            print("Warning: Lazy DB initialization failed:", str(e))
            
    # Locate crm_db.sqlite file in the backend directory
    db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'crm_db.sqlite')
    conn = SQLiteConnectionWrapper(db_path)
    
    # 1. Register DATE_FORMAT custom function
    def date_format(date_str, format_str):
        if not date_str:
            return None
        py_fmt = format_str.replace('%%', '%')
        try:
            # Try full datetime string first
            dt = datetime.datetime.strptime(str(date_str).split('.')[0], '%Y-%m-%d %H:%M:%S')
        except ValueError:
            try:
                dt = datetime.datetime.strptime(str(date_str), '%Y-%m-%d')
            except ValueError:
                return str(date_str)
        return dt.strftime(py_fmt)
        
    # 2. Register CONCAT custom function
    def concat(*args):
        return "".join(str(arg) for arg in args if arg is not None)
        
    # 3. Register CURDATE custom function
    def curdate():
        return datetime.date.today().strftime('%Y-%m-%d')
        
    conn.conn.create_function("DATE_FORMAT", 2, date_format)
    conn.conn.create_function("CONCAT", -1, concat)
    conn.conn.create_function("CURDATE", 0, curdate)
    
    return conn

def init_db():
    import urllib.request
    import json
    import sqlite3
    
    db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'crm_db.sqlite')
    
    def clean_date_str(date_str):
        if not date_str:
            return None
        s = str(date_str).split('T')[0].strip()
        if '2027' in s:
            s = s.replace('2027', '2026')
        return s
        
    print("Syncing database with live recruitment API data...")
    # 1. Fetch franchisees
    try:
        req_f = urllib.request.Request('https://api.sarthi360.in/api/franchisees', headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req_f, timeout=15) as response:
            franchisees = json.loads(response.read().decode('utf-8'))
    except Exception as e:
        print("Warning: Failed to fetch franchisees from live API:", str(e))
        print("Falling back to existing SQLite database if present.")
        return
        
    # 2. Fetch enquiries
    try:
        req_enq = urllib.request.Request('https://api.sarthi360.in/api/enquiries', headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req_enq, timeout=35) as response:
            enquiries_res = json.loads(response.read().decode('utf-8'))
            enquiries = enquiries_res.get('data', [])
    except Exception as e:
        print("Warning: Failed to fetch enquiries from live API:", str(e))
        print("Falling back to existing SQLite database if present.")
        return
        
    # 3. Fetch invoices
    try:
        req_inv = urllib.request.Request('https://api.sarthi360.in/api/Invoice', headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req_inv, timeout=45) as response:
            invoices = json.loads(response.read().decode('utf-8'))
    except Exception as e:
        print("Warning: Failed to fetch invoices from live API:", str(e))
        print("Falling back to existing SQLite database if present.")
        return
        
    print(f"Loaded live data: {len(franchisees)} franchisees, {len(enquiries)} enquiries, and {len(invoices)} invoices.")
    
    try:
        # Connect directly to SQLite file to avoid recursion
        conn = sqlite3.connect(db_path, check_same_thread=False)
        cursor = conn.cursor()
        
        # Check and handle table expenditure
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='expenditure'")
        has_expenditure = cursor.fetchone()
        expenditure_rows = []
        if has_expenditure:
            # Save existing expenditures
            cursor.execute("SELECT srNo, billDate, particulars, expenses, amount, net, expenseType, bdAgentId, franchiseeId, is_deleted FROM expenditure")
            expenditure_rows = cursor.fetchall()
            
        # Check and handle table budgets
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='budgets'")
        has_budgets = cursor.fetchone()
        budgets_rows = []
        if has_budgets:
            cursor.execute("SELECT category, limit_amount FROM budgets")
            budgets_rows = cursor.fetchall()
            
        # Check and handle table audit_log
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='audit_log'")
        has_audit = cursor.fetchone()
        audit_rows = []
        if has_audit:
            cursor.execute("SELECT id, table_name, record_id, field_changed, old_value, new_value, changed_by, changed_at FROM audit_log")
            audit_rows = cursor.fetchall()

        # Re-create tables
        cursor.execute("DROP TABLE IF EXISTS franchisees")
        cursor.execute("""
            CREATE TABLE franchisees (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nameAsPerAgreement TEXT,
                teamLeaderName TEXT,
                onboardingDate TEXT
            )
        """)
        
        cursor.execute("DROP TABLE IF EXISTS enquiries")
        cursor.execute("""
            CREATE TABLE enquiries (
                id INTEGER PRIMARY KEY,
                companyName TEXT,
                bdMemberName TEXT,
                teamLeaderName TEXT,
                franchiseeName TEXT,
                placementFees REAL,
                positionName TEXT,
                industry TEXT,
                `from` REAL,
                `to` REAL,
                enquiryStatus TEXT,
                dateOfAllocation TEXT,
                dateClientAcquired TEXT,
                dateOfReallocation TEXT,
                bill_no TEXT,
                bill_date TEXT,
                bill_amount REAL,
                info TEXT,
                created_at TEXT
            )
        """)
        
        cursor.execute("DROP TABLE IF EXISTS invoice")
        cursor.execute("""
            CREATE TABLE invoice (
                id INTEGER PRIMARY KEY,
                enquiry_id INTEGER,
                billNumber TEXT,
                billDate TEXT,
                serviceCharges REAL,
                franchiseeShare REAL,
                ourShare REAL,
                amountReceived REAL,
                dateReceived TEXT,
                nameOfBd TEXT,
                teamLeader TEXT,
                franchiseName TEXT
            )
        """)
        
        cursor.execute("DROP TABLE IF EXISTS franchisePayments")
        cursor.execute("""
            CREATE TABLE franchisePayments (
                franchisePayment_id INTEGER PRIMARY KEY AUTOINCREMENT,
                invoice_id INTEGER,
                payment_done TEXT,
                payment_date TEXT,
                payment_mode TEXT,
                uid_transaction_id TEXT,
                payment_amount REAL
            )
        """)
        
        cursor.execute("DROP TABLE IF EXISTS expenditure")
        cursor.execute("""
            CREATE TABLE expenditure (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                srNo TEXT,
                billDate TEXT,
                particulars TEXT,
                expenses TEXT,
                amount REAL,
                net REAL,
                expenseType TEXT,
                bdAgentId TEXT,
                franchiseeId TEXT,
                is_deleted INTEGER
            )
        """)
        
        cursor.execute("DROP TABLE IF EXISTS budgets")
        cursor.execute("""
            CREATE TABLE budgets (
                category TEXT PRIMARY KEY,
                limit_amount REAL
            )
        """)
        
        cursor.execute("DROP TABLE IF EXISTS audit_log")
        cursor.execute("""
            CREATE TABLE audit_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                table_name TEXT,
                record_id TEXT,
                field_changed TEXT,
                old_value TEXT,
                new_value TEXT,
                changed_by TEXT,
                changed_at TEXT
            )
        """)
        
        # Populate budgets
        if budgets_rows:
            for r in budgets_rows:
                cursor.execute("INSERT INTO budgets (category, limit_amount) VALUES (?, ?)", r)
        else:
            initial_budgets = {
                'Marketing': 50000.0,
                'Operations': 150000.0,
                'Rent': 45000.0,
                'Salaries': 800000.0,
                'Software': 25000.0,
                'Travel': 30000.0,
                'Utilities': 15000.0,
                'Other': 50000.0
            }
            for cat, lim in initial_budgets.items():
                cursor.execute("INSERT INTO budgets (category, limit_amount) VALUES (?, ?)", (cat, lim))
                
        # Populate expenditure
        if expenditure_rows:
            for r in expenditure_rows:
                cursor.execute("""
                    INSERT INTO expenditure (srNo, billDate, particulars, expenses, amount, net, expenseType, bdAgentId, franchiseeId, is_deleted)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, r)
                
        # Populate audit log
        if audit_rows:
            for r in audit_rows:
                cursor.execute("""
                    INSERT INTO audit_log (id, table_name, record_id, field_changed, old_value, new_value, changed_by, changed_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, r)
                
        # Populate franchisees
        for f in franchisees:
            name = f.get('nameAsPerAgreement', '')
            if name:
                name = name.strip()
            tl = f.get('teamLeaderName', '')
            if tl:
                tl = tl.strip()
            cursor.execute("""
                INSERT INTO franchisees (nameAsPerAgreement, teamLeaderName, onboardingDate)
                VALUES (?, ?, ?)
            """, (name, tl, '2025-01-01'))
            
        # Populate enquiries
        for enq in enquiries:
            enq_id = enq.get('id')
            if not enq_id:
                continue
                
            company = enq.get('companyName', '')
            if company:
                company = company.strip()
            bd = enq.get('bdMemberName', '')
            if bd:
                bd = bd.strip()
            tl = enq.get('teamLeaderName', '')
            if tl:
                tl = tl.strip()
            franchisee = enq.get('franchiseeName', '')
            if franchisee:
                franchisee = franchisee.strip()
                
            # Parse Dates
            alloc_date = clean_date_str(enq.get('dateOfAllocation'))
            realloc_date = clean_date_str(enq.get('dateOfReallocation'))
            bill_date = clean_date_str(enq.get('bill_date'))
            created_at = clean_date_str(enq.get('created_at'))
                
            # Parse numeric fields
            placement_fees = 0.0
            try:
                placement_fees = float(enq.get('placementFees') or 0.0)
            except:
                pass
                
            sal_from = 0.0
            try:
                sal_from = float(enq.get('from') or 0.0)
            except:
                pass
                
            sal_to = 0.0
            try:
                sal_to = float(enq.get('to') or 0.0)
            except:
                pass
                
            bill_amount = 0.0
            try:
                bill_amount = float(enq.get('bill_amount') or 0.0)
            except:
                pass
                
            cursor.execute("""
                INSERT INTO enquiries (
                    id, companyName, bdMemberName, teamLeaderName, franchiseeName,
                    placementFees, positionName, industry, `from`, `to`, enquiryStatus,
                    dateOfAllocation, dateClientAcquired, dateOfReallocation,
                    bill_no, bill_date, bill_amount, info, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                enq_id, company, bd, tl, franchisee,
                placement_fees, enq.get('positionName'), enq.get('industry'), sal_from, sal_to, enq.get('enquiryStatus'),
                alloc_date, alloc_date, realloc_date,
                enq.get('bill_no'), bill_date, bill_amount, "O", created_at
            ))
            
        # Populate invoice and franchisePayments
        for inv in invoices:
            inv_id = inv.get('id')
            if not inv_id:
                continue
                
            enq_id = inv.get('enquiry_id')
            bill_no = inv.get('billNumber', '')
            if bill_no:
                bill_no = bill_no.strip()
            else:
                bill_no = None
                
            bill_date = clean_date_str(inv.get('billDate'))
                
            # Parse numeric fields
            service_charges = 0.0
            try:
                service_charges = float(inv.get('serviceCharges') or 0.0)
            except:
                pass
                
            # Parse franchiseeShare from API if valid
            franchisee_share = 0.0
            try:
                f_share_raw = inv.get('franchiseeShare')
                franchisee_share = float(f_share_raw) if f_share_raw else 0.0
            except:
                pass
                
            # Parse ourShare from API if valid
            our_share = 0.0
            try:
                o_share_raw = inv.get('ourShare')
                our_share = float(o_share_raw) if o_share_raw else 0.0
            except:
                pass
                
            # Fallback to business split rules if they are not set / zero
            if franchisee_share == 0.0 and our_share == 0.0:
                split_pct = 0.75
                if bill_date and bill_date < '2026-04-01':
                    split_pct = 0.60
                franchisee_share = service_charges * split_pct
                our_share = service_charges - franchisee_share
                
            amt_received = 0.0
            try:
                amt_received = float(inv.get('amountReceived') or 0.0)
            except:
                pass
                
            date_received_raw = inv.get('dateReceived')
            if date_received_raw:
                date_received = clean_date_str(date_received_raw)
            else:
                date_received = bill_date
                
            franchise_name = inv.get('franchiseName', '')
            if franchise_name:
                franchise_name = franchise_name.strip()
            tl = inv.get('teamLeader', '')
            if tl:
                tl = tl.strip()
            bd = inv.get('nameOfBd', '')
            if bd:
                bd = bd.strip()
                
            cursor.execute("""
                INSERT INTO invoice (
                    id, enquiry_id, billNumber, billDate, serviceCharges,
                    franchiseeShare, ourShare, amountReceived, dateReceived,
                    nameOfBd, teamLeader, franchiseName
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                inv_id, enq_id, bill_no, bill_date, service_charges,
                franchisee_share, our_share, amt_received, date_received,
                bd, tl, franchise_name
            ))
            
            # Insert into franchisePayments if payment done
            if amt_received > 0:
                pay_mode = inv.get('payment_mode') or "Online"
                trans_id = inv.get('uid_transaction_id') or bill_no
                cursor.execute("""
                    INSERT INTO franchisePayments (
                        invoice_id, payment_done, payment_date, payment_mode, uid_transaction_id, payment_amount
                    ) VALUES (?, ?, ?, ?, ?, ?)
                """, (
                    inv_id, "Yes", date_received, pay_mode, trans_id, amt_received
                ))
                
        conn.commit()
        conn.close()
        print("Database sync completed successfully.")
    except Exception as e:
        import traceback
        traceback.print_exc()
        print("Failed to sync database with live API data:", str(e))

if __name__ == "__main__":
    init_db()
