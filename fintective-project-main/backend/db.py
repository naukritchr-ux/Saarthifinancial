import sqlite3
import os
import re
from dotenv import load_dotenv

# Load env file
load_dotenv()

DB_NAME = os.getenv("DB_NAME", "crm_db")
DB_PORT = 3306
DB_HOST = "localhost"
DB_USER = "root"
DB_PASSWORD = ""

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
        
    def fetchall(self):
        rows = self.cursor.fetchall()
        if not rows:
            return []
        columns = [col[0] for col in self.cursor.description]
        return [dict(zip(columns, row)) for row in rows]
        
    def fetchone(self):
        row = self.cursor.fetchone()
        if row is None:
            return None
        columns = [col[0] for col in self.cursor.description]
        return dict(zip(columns, row))
        
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

def get_db_connection(select_db=True):
    # Locate crm_db.sqlite file in the backend directory
    db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'crm_db.sqlite')
    conn = SQLiteConnectionWrapper(db_path)
    
    # 1. Register DATE_FORMAT custom function
    def date_format(date_str, format_str):
        if not date_str:
            return None
        from datetime import datetime
        py_fmt = format_str.replace('%%', '%')
        try:
            # Try full datetime string first
            dt = datetime.strptime(str(date_str).split('.')[0], '%Y-%m-%d %H:%M:%S')
        except ValueError:
            try:
                dt = datetime.strptime(str(date_str), '%Y-%m-%d')
            except ValueError:
                return str(date_str)
        return dt.strftime(py_fmt)
        
    # 2. Register CONCAT custom function
    def concat(*args):
        return "".join(str(arg) for arg in args if arg is not None)
        
    # 3. Register CURDATE custom function
    def curdate():
        from datetime import date
        return date.today().strftime('%Y-%m-%d')
        
    conn.conn.create_function("DATE_FORMAT", 2, date_format)
    conn.conn.create_function("CONCAT", -1, concat)
    conn.conn.create_function("CURDATE", 0, curdate)
    
    return conn

def init_db():
    try:
        conn = get_db_connection()
        db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'crm_db.sqlite')
        if os.path.exists(db_path):
            print(f"SQLite Database verified at: {db_path}")
        conn.close()
    except Exception as e:
        print("Failed to initialize SQLite connection:", str(e))

if __name__ == "__main__":
    init_db()
