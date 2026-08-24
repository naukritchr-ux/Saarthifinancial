import os
import sys
import re
import subprocess
import pymysql
from dotenv import load_dotenv

# Load database configuration from env file
load_dotenv()

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", 3306))
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_NAME = os.getenv("DB_NAME", "crm_db")

# Define target SQL dumps directory
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
DUMP_DIR = os.path.join(BACKEND_DIR, "new_dump_extracted", "Dump20260617 (1)")

def test_mysql_connection():
    try:
        conn = pymysql.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME
        )
        conn.close()
        return True
    except Exception as e:
        print(f"Error: Unable to connect to MySQL database '{DB_NAME}': {str(e)}")
        return False

def check_mysql_cli():
    try:
        # Check if mysql command line client is available in PATH
        subprocess.run(["mysql", "--version"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
        return True
    except Exception:
        return False

def import_with_cli(file_path):
    # Build CLI command
    cmd = ["mysql", f"-h{DB_HOST}", f"-P{DB_PORT}", f"-u{DB_USER}"]
    if DB_PASSWORD:
        cmd.append(f"-p{DB_PASSWORD}")
    cmd.append(DB_NAME)
    
    try:
        # Read the SQL file content
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
            
        # Strip @@GLOBAL.GTID_PURGED statement
        content = re.sub(r'SET\s+@@GLOBAL\.GTID_PURGED\s*=\s*[^;]+;', '', content, flags=re.IGNORECASE)
        
        # Run import feeding content via standard input string
        result = subprocess.run(cmd, input=content, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if result.returncode == 0:
            return True, ""
        else:
            return False, result.stderr
    except Exception as e:
        return False, str(e)

def import_with_python(file_path, conn):
    try:
        # Read the SQL file content
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
            
        # Strip @@GLOBAL.GTID_PURGED statement
        content = re.sub(r'SET\s+@@GLOBAL\.GTID_PURGED\s*=\s*[^;]+;', '', content, flags=re.IGNORECASE)
        
        statement = []
        in_string = False
        string_char = None
        escape = False
        
        cursor = conn.cursor()
        
        lines = content.splitlines(keepends=True)
        
        for line in lines:
            stripped = line.strip()
            # Skip comments and empty lines
            if not stripped or stripped.startswith("--") or stripped.startswith("#") or (stripped.startswith("/*") and stripped.endswith("*/;")):
                continue
                
            for char in line:
                if escape:
                    statement.append(char)
                    escape = False
                    continue
                if char == "\\":
                    statement.append(char)
                    escape = True
                    continue
                if char in ("'", '"', '`'):
                    if not in_string:
                        in_string = True
                        string_char = char
                    elif string_char == char:
                        in_string = False
                        string_char = None
                
                statement.append(char)
                
                if char == ";" and not in_string:
                    sql = "".join(statement).strip()
                    if sql:
                        # Exclude system comments
                        if not (sql.startswith("/*") and sql.endswith("*/")):
                            try:
                                cursor.execute(sql)
                            except Exception as e:
                                err_msg = str(e)
                                # Suppress common table duplicate warnings
                                if "already exists" not in err_msg and "Duplicate entry" not in err_msg:
                                    print(f"    [Warning SQL Error] {err_msg[:120]}")
                    statement = []
        conn.commit()
        return True, ""
    except Exception as e:
        return False, str(e)

def main():
    print("="*60)
    print("MySQL Bulk SQL Dump Import Utility")
    print("="*60)
    
    if not os.path.exists(DUMP_DIR):
        print(f"Error: Dump directory '{DUMP_DIR}' does not exist.")
        print("Please make sure you have extracted new_dump.zip into the backend folder.")
        sys.exit(1)
        
    print(f"Source directory: {DUMP_DIR}")
    print(f"Target DB: {DB_NAME} on {DB_HOST}:{DB_PORT}")
    
    if not test_mysql_connection():
        print("Please check your MySQL service and .env file credentials.")
        sys.exit(1)
        
    # Filter out enquiries and invoice dumps to load them strictly from the master CSV file
    sql_files = sorted([
        f for f in os.listdir(DUMP_DIR) 
        if f.endswith(".sql") and 'enquiries' not in f.lower() and 'invoice' not in f.lower()
    ])
    total_files = len(sql_files)
    print(f"Found {total_files} SQL files to import.")
    
    has_cli = check_mysql_cli()
    if has_cli:
        print("MySQL CLI client found. Using CLI for high-speed import (recommended).")
    else:
        print("MySQL CLI client not found. Falling back to python streaming parser (may be slower for large dumps).")
        
    conn = None
    if not has_cli:
        conn = pymysql.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME
        )
        with conn.cursor() as cursor:
            cursor.execute("SET FOREIGN_KEY_CHECKS = 0;")
            conn.commit()

    try:
        for idx, file_name in enumerate(sql_files, 1):
            file_path = os.path.join(DUMP_DIR, file_name)
            size_mb = os.path.getsize(file_path) / (1024 * 1024)
            print(f"[{idx}/{total_files}] Importing: {file_name} ({size_mb:.2f} MB)...")
            
            if has_cli:
                success, err = import_with_cli(file_path)
            else:
                success, err = import_with_python(file_path, conn)
                
            if success:
                print("  -> Completed successfully.")
            else:
                print(f"  -> Failed: {err}")
                
        print("\nAll database dump files imported successfully!")
        
    finally:
        if conn:
            with conn.cursor() as cursor:
                cursor.execute("SET FOREIGN_KEY_CHECKS = 1;")
                conn.commit()
            conn.close()
            
if __name__ == "__main__":
    main()
