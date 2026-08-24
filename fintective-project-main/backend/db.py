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
    
    print("Syncing database with live API data...")
    # 1. Fetch franchisees
    try:
        req_f = urllib.request.Request('https://api.sarthi360.in/api/franchisees', headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req_f, timeout=10) as response:
            franchisees = json.loads(response.read().decode('utf-8'))
    except Exception as e:
        print("Warning: Failed to fetch franchisees from live API:", str(e))
        print("Falling back to existing SQLite database if present.")
        return
        
    # 2. Fetch jobinvoices
    try:
        req_inv = urllib.request.Request('https://api.sarthi360.in/api/jobinvoice', headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req_inv, timeout=15) as response:
            invoices = json.loads(response.read().decode('utf-8'))
    except Exception as e:
        print("Warning: Failed to fetch jobinvoices from live API:", str(e))
        print("Falling back to existing SQLite database if present.")
        return
        
    print(f"Loaded live data: {len(franchisees)} franchisees and {len(invoices)} jobinvoices.")
    
    try:
        # Connect directly to SQLite file to avoid recursion
        conn = sqlite3.connect(db_path, check_same_thread=False)
        cursor = conn.cursor()
        
        # Create schema and populate tables (inside a transaction)
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
                id INTEGER PRIMARY KEY AUTOINCREMENT,
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
            
        # Populate enquiries, invoices, payments, expenses
        for inv in invoices:
            inv_id = inv.get('id')
            if not inv_id:
                continue
                
            franchisee = inv.get('kindlyShareName', '')
            if franchisee:
                franchisee = franchisee.strip()
            team_leader = inv.get('nameOfTeamLeader', '')
            if team_leader:
                team_leader = team_leader.strip()
                
            # Parse Dates
            bill_date_raw = inv.get('billDate')
            bill_date = None
            if bill_date_raw:
                bill_date = bill_date_raw.split('T')[0]
                
            # Parse amountPaidWithoutGst
            amount_paid_raw = inv.get('amountPaidWithoutGst')
            try:
                service_charges = float(amount_paid_raw) if amount_paid_raw else 0.0
            except:
                service_charges = 0.0
                
            # Parse totalAmountPaid
            total_amount_raw = inv.get('totalAmountPaid')
            try:
                total_amount = float(total_amount_raw) if total_amount_raw else 0.0
            except:
                total_amount = 0.0
                
            # Check payment received status
            payment_details = inv.get('paymentDetailsForNaukri') or {}
            is_received = False
            if isinstance(payment_details, dict):
                is_received = payment_details.get('received', False)
            
            status = 'inprogress'
            if is_received or total_amount > 0:
                status = 'closed'
                
            bill_no = inv.get('billNo', '')
            if bill_no:
                bill_no = bill_no.strip()
            else:
                bill_no = None
                
            created_at_raw = inv.get('createdAt')
            created_at = None
            if created_at_raw:
                created_at = created_at_raw.split('T')[0]
            else:
                created_at = bill_date
                
            # Insert into enquiries
            cursor.execute("""
                INSERT INTO enquiries (
                    id, companyName, bdMemberName, teamLeaderName, franchiseeName,
                    placementFees, positionName, industry, `from`, `to`, enquiryStatus,
                    dateOfAllocation, dateClientAcquired, dateOfReallocation,
                    bill_no, bill_date, bill_amount, info, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                inv_id, franchisee, team_leader, team_leader, franchisee,
                service_charges, "Job Portal Logins", "IT & Recruitment", 0.0, 0.0, status,
                bill_date, bill_date, None,
                bill_no, bill_date, service_charges, "O", created_at
            ))
            
            # If billed, insert into invoice
            if bill_no:
                # Calculate franchiseeShare
                split_pct = 0.75
                if bill_date and bill_date < '2026-04-01':
                    split_pct = 0.60
                franchisee_share = service_charges * split_pct
                our_share = service_charges - franchisee_share
                
                # Extract payment amount and date
                pay_amounts = inv.get('paymentAmountsForNaukri') or []
                pay_dates = inv.get('paymentDatesForNaukri') or []
                
                amt_received = 0.0
                date_received = bill_date
                
                for amt_str in pay_amounts:
                    if amt_str:
                        try:
                            amt_received += float(amt_str)
                        except:
                            pass
                            
                for dt_str in pay_dates:
                    if dt_str:
                        date_received = dt_str
                        break
                        
                if amt_received == 0.0 and is_received:
                    amt_received = service_charges
                    
                cursor.execute("""
                    INSERT INTO invoice (
                        enquiry_id, billNumber, billDate, serviceCharges,
                        franchiseeShare, ourShare, amountReceived, dateReceived,
                        nameOfBd, teamLeader, franchiseName
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    inv_id, bill_no, bill_date, service_charges,
                    franchisee_share, our_share, amt_received, date_received,
                    team_leader, team_leader, franchisee
                ))
                
                # Insert into franchisePayments
                if amt_received > 0:
                    cursor.execute("""
                        INSERT INTO franchisePayments (
                            invoice_id, payment_done, payment_date, payment_mode, uid_transaction_id, payment_amount
                        ) VALUES (?, ?, ?, ?, ?, ?)
                    """, (
                        inv_id, "Yes", date_received, "Online", bill_no, amt_received
                    ))
                    
            # Generate expenditure from portal cost
            cost_raw = inv.get('totalCostOfPortal')
            try:
                portal_cost = float(cost_raw) if cost_raw else 0.0
            except:
                portal_cost = 0.0
                
            if portal_cost > 0:
                cursor.execute("""
                    INSERT INTO expenditure (
                        srNo, billDate, particulars, expenses, amount, net, expenseType, bdAgentId, franchiseeId, is_deleted
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    "EXP", bill_date, f"Portal Cost for {franchisee}", "Portal Cost", portal_cost, portal_cost, "General", None, None, 0
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
