import pymysql
import os
import re
from dotenv import load_dotenv

# Load env file
load_dotenv()

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", 3306))
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_NAME = os.getenv("DB_NAME", "crm_db")

def get_db_connection(select_db=True):
    return pymysql.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME if select_db else None,
        cursorclass=pymysql.cursors.DictCursor
    )

def remove_sql_comments(sql):
    lines = sql.splitlines()
    clean_lines = []
    for line in lines:
        trimmed = line.strip()
        if trimmed and not trimmed.startswith('--') and not trimmed.startswith('#'):
            clean_line = line
            if '--' in line:
                clean_line = line.split('--')[0]
            clean_lines.append(clean_line)
    joined = ' '.join(clean_lines)
    # Remove C-style comments
    joined = re.sub(r'/\*[\s\S]*?\*/', '', joined)
    return joined.strip()

def parse_sql_statements(content):
    statements = []
    current_statement = []
    in_single_quote = False
    in_double_quote = False
    in_backtick = False
    escape_active = False

    for char in content:
        if escape_active:
            current_statement.append(char)
            escape_active = False
            continue

        if char == '\\':
            current_statement.append(char)
            escape_active = True
            continue

        if char == "'" and not in_double_quote and not in_backtick:
            in_single_quote = not in_single_quote
        elif char == '"' and not in_single_quote and not in_backtick:
            in_double_quote = not in_double_quote
        elif char == '`' and not in_single_quote and not in_double_quote:
            in_backtick = not in_backtick

        if char == ';' and not in_single_quote and not in_double_quote and not in_backtick:
            stmt = ''.join(current_statement).strip()
            clean_stmt = remove_sql_comments(stmt)
            if clean_stmt:
                statements.append(clean_stmt)
            current_statement = []
        else:
            current_statement.append(char)

    if current_statement:
        stmt = ''.join(current_statement).strip()
        clean_stmt = remove_sql_comments(stmt)
        if clean_stmt:
            statements.append(clean_stmt)

    return statements

def import_sql_files():
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            # Check if tables are already set up
            cursor.execute("SHOW TABLES LIKE 'franchises'")
            tables = cursor.fetchall()
            if tables:
                cursor.execute("SELECT COUNT(*) as count FROM franchises")
                franchises_count = cursor.fetchone()['count']
                if franchises_count > 0:
                    print("CRM Database tables already initialized.")
                    conn.close()
                    return

            print("CRM Database is empty. Beginning auto-import of local SQL dump files...")
            
            # Find the original backend directory to read SQL dumps from
            backend_dir = os.path.dirname(os.path.abspath(__file__))
            
            # Check if sql_dumps subdirectory exists and has SQL files
            sql_dumps_dir = os.path.join(backend_dir, 'sql_dumps')
            if os.path.exists(sql_dumps_dir) and any(f.endswith('.sql') for f in os.listdir(sql_dumps_dir) if f.startswith('crm_db_')):
                backend_dir = sql_dumps_dir
            # Check if root backend directory has SQL files, otherwise check sibling folder
            elif not any(f.endswith('.sql') for f in os.listdir(backend_dir) if f.startswith('crm_db_')):
                workspace_dir = os.path.dirname(backend_dir)
                sibling_backend = os.path.join(os.path.dirname(workspace_dir), 'prototype_finance_analysis', 'backend')
                if os.path.exists(sibling_backend):
                    backend_dir = sibling_backend

            sql_files = sorted([f for f in os.listdir(backend_dir) if f.endswith('.sql') and f.startswith('crm_db_')])
            if not sql_files:
                print(f"No crm_db_*.sql dump files found in {backend_dir} to import.")
                conn.close()
                return

            cursor.execute("SET FOREIGN_KEY_CHECKS = 0")
            for file_name in sql_files:
                file_path = os.path.join(backend_dir, file_name)
                print(f"Importing script: {file_name}...")
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                statements = parse_sql_statements(content)
                for statement in statements:
                    try:
                        cursor.execute(statement)
                    except Exception as err:
                        err_msg = str(err)
                        if 'already exists' not in err_msg and 'Duplicate entry' not in err_msg:
                            print(f"[Warning] SQL statement in {file_name} failed: {err_msg}")
                print(f"Successfully completed import of {file_name}")
            cursor.execute("SET FOREIGN_KEY_CHECKS = 1")
            conn.commit()
            print("Auto-import of all CRM database SQL files complete!")
        conn.close()
    except Exception as e:
        print("Failed to parse or seed SQL files:", str(e))

def init_db():
    try:
        # 1. Establish connection to MySQL server first to create DB if missing
        conn = pymysql.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            cursorclass=pymysql.cursors.DictCursor
        )
        with conn.cursor() as cursor:
            cursor.execute(f"CREATE DATABASE IF NOT EXISTS `{DB_NAME}`")
        conn.commit()
        conn.close()

        print(f"Created database if missing: {DB_NAME}")

        # 2. Setup schemas depending on database mode
        if DB_NAME == 'seed':
            conn = get_db_connection()
            with conn.cursor() as cursor:
                # Create franchisees
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS franchisees (
                      id VARCHAR(50) PRIMARY KEY,
                      name VARCHAR(100) NOT NULL,
                      city VARCHAR(50) NOT NULL,
                      owner VARCHAR(100) NOT NULL,
                      onboardingDate DATE NOT NULL,
                      status VARCHAR(20) NOT NULL DEFAULT 'Active',
                      candidatesPlaced INT NOT NULL DEFAULT 0
                    )
                """)
                # Create bd_agents
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS bd_agents (
                      id VARCHAR(50) PRIMARY KEY,
                      name VARCHAR(100) NOT NULL,
                      leadsBought INT NOT NULL DEFAULT 30,
                      leadsProgressed INT NOT NULL DEFAULT 14,
                      leadsCancelled INT NOT NULL DEFAULT 10,
                      baseSalary DECIMAL(12, 2) NOT NULL DEFAULT 12000.00,
                      payPerProgressed DECIMAL(12, 2) NOT NULL DEFAULT 2500.00,
                      payPerCancelled DECIMAL(12, 2) NOT NULL DEFAULT 500.00,
                      commissionRate DECIMAL(5, 4) NOT NULL DEFAULT 0.1000,
                      status VARCHAR(20) NOT NULL DEFAULT 'Active'
                    )
                """)
                # Create budgets
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS budgets (
                      category VARCHAR(100) PRIMARY KEY,
                      limit_amount DECIMAL(12, 2) NOT NULL
                    )
                """)
                # Create transactions
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS transactions (
                      id VARCHAR(50) PRIMARY KEY,
                      title VARCHAR(255) NOT NULL,
                      amount DECIMAL(12, 2) NOT NULL,
                      type VARCHAR(10) NOT NULL,
                      category VARCHAR(100) NOT NULL,
                      subCategory VARCHAR(100) DEFAULT 'General',
                      date DATE NOT NULL,
                      bdAgentId VARCHAR(50),
                      franchiseeId VARCHAR(50),
                      paymentMode VARCHAR(50) DEFAULT 'Cash',
                      referenceId VARCHAR(100) NOT NULL,
                      description TEXT,
                      FOREIGN KEY (bdAgentId) REFERENCES bd_agents(id) ON DELETE SET NULL,
                      FOREIGN KEY (franchiseeId) REFERENCES franchisees(id) ON DELETE SET NULL
                    )
                """)
                
                # Seed tables if empty
                cursor.execute("SELECT COUNT(*) as count FROM franchisees")
                fran_count = cursor.fetchone()['count']
                if fran_count == 0:
                    print("MySQL prototype tables are empty. Seeding dummy financial data...")
                    cursor.execute("""
                        INSERT INTO franchisees (id, name, city, owner, onboardingDate, status, candidatesPlaced) VALUES
                        ('f-1', 'Nagpur Central', 'Nagpur', 'Priya Shah', '2026-03-15', 'Active', 24),
                        ('f-2', 'Pune East', 'Pune', 'Rajesh Patil', '2026-04-10', 'Active', 18),
                        ('f-3', 'Mumbai South', 'Mumbai', 'Vikram Mehta', '2026-02-01', 'Active', 35),
                        ('f-4', 'Nashik Hub', 'Nashik', 'Amit Shinde', '2026-05-20', 'Active', 12),
                        ('f-5', 'Aurangabad Road', 'Aurangabad', 'Sanjay Joshi', '2026-06-05', 'Inactive', 4)
                    """)
                    cursor.execute("""
                        INSERT INTO bd_agents (id, name, leadsBought, leadsProgressed, leadsCancelled, baseSalary, payPerProgressed, payPerCancelled, commissionRate, status) VALUES
                        ('bd-1', 'Rohan Mehta', 30, 14, 10, 12000.00, 2500.00, 500.00, 0.1000, 'Active'),
                        ('bd-2', 'Neha Sharma', 25, 9, 12, 10000.00, 2200.00, 400.00, 0.0800, 'Active'),
                        ('bd-3', 'Karan Malhotra', 35, 18, 14, 15000.00, 3000.00, 600.00, 0.1200, 'Active'),
                        ('bd-4', 'Anjali Verma', 15, 5, 8, 9000.00, 2000.00, 300.00, 0.0800, 'Active')
                    """)
                    cursor.execute("""
                        INSERT INTO budgets (category, limit_amount) VALUES
                        ('Salaries', 120000.00),
                        ('BD commissions', 45000.00),
                        ('Marketing', 36000.00),
                        ('Office & infra', 30000.00),
                        ('Portal subscriptions', 20000.00),
                        ('Other', 10000.00)
                    """)
                    conn.commit()
                    print("Seeding prototype database tables completed successfully!")
            conn.close()
        else:
            # Skip automatic import of CRM SQL dump files to avoid bloating/overwriting the user's MySQL crm_db.
            print("Auto-import of SQL dumps disabled as per user instruction. MySQL crm_db configuration used directly.")
            
            # Add bdAgentId and franchiseeId columns to expenditure table if missing
            try:
                conn = get_db_connection()
                with conn.cursor() as cursor:
                    cursor.execute("SHOW COLUMNS FROM expenditure LIKE 'bdAgentId'")
                    if not cursor.fetchone():
                        print("Altering expenditure table: adding bdAgentId column...")
                        cursor.execute("ALTER TABLE expenditure ADD COLUMN bdAgentId VARCHAR(50)")
                        
                    cursor.execute("SHOW COLUMNS FROM expenditure LIKE 'franchiseeId'")
                    if not cursor.fetchone():
                        print("Altering expenditure table: adding franchiseeId column...")
                        cursor.execute("ALTER TABLE expenditure ADD COLUMN franchiseeId VARCHAR(50)")
                        
                    cursor.execute("SHOW COLUMNS FROM expenditure LIKE 'is_deleted'")
                    if not cursor.fetchone():
                        print("Altering expenditure table: adding is_deleted column...")
                        cursor.execute("ALTER TABLE expenditure ADD COLUMN is_deleted TINYINT DEFAULT 0")
                conn.commit()
                conn.close()
                print("Expenditure table schema verified (bdAgentId, franchiseeId, and is_deleted columns).")
            except Exception as schema_err:
                print("Warning: Failed to verify/add columns to expenditure table:", str(schema_err))
                
        # Verify and create audit_log table for tracking edits
        try:
            conn = get_db_connection()
            with conn.cursor() as cursor:
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS audit_log (
                      id INT AUTO_INCREMENT PRIMARY KEY,
                      table_name VARCHAR(100),
                      record_id VARCHAR(100),
                      field_changed VARCHAR(100),
                      old_value TEXT,
                      new_value TEXT,
                      changed_by VARCHAR(100) DEFAULT 'admin',
                      changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)
            conn.commit()
            conn.close()
            print("Audit log table schema verified.")
        except Exception as audit_err:
            print("Warning: Failed to create/verify audit_log table:", str(audit_err))
    except Exception as e:
        print(f"MySQL database '{DB_NAME}' initialization failed: {str(e)}")
        print("Note: Backend will retry on REST queries. Make sure local MySQL is running on port 3306")

if __name__ == "__main__":
    init_db()
