import os
import sqlite3
import pymysql
import datetime
from decimal import Decimal
from dotenv import load_dotenv

# Try to find and load .env file
possible_env_paths = [
    os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '.env'),
    os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env'),
    'd:/OneDrive/Desktop/fintective/backend/.env'
]

env_loaded = False
for path in possible_env_paths:
    if os.path.exists(path):
        load_dotenv(path)
        print(f"Loaded environment variables from: {path}")
        env_loaded = True
        break

if not env_loaded:
    load_dotenv()
    print("Loaded environment variables from system/default .env")

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", 3306))
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_NAME = os.getenv("DB_NAME", "crm_db")

print(f"Database Config: Host={DB_HOST}, Port={DB_PORT}, User={DB_USER}, Database={DB_NAME}")

def migrate():
    # 1. Connect to MySQL
    try:
        mysql_conn = pymysql.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME,
            cursorclass=pymysql.cursors.DictCursor
        )
        print("Connected to local MySQL successfully.")
    except Exception as e:
        print(f"Failed to connect to MySQL: {str(e)}")
        print("Please verify your local MySQL server is running and credentials in .env are correct.")
        return

    # 2. Connect to SQLite
    backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    sqlite_path = os.path.join(backend_dir, 'crm_db.sqlite')
    
    if os.path.exists(sqlite_path):
        os.remove(sqlite_path)
        print(f"Removed existing SQLite file at: {sqlite_path}")

    sqlite_conn = sqlite3.connect(sqlite_path)
    print(f"Created new SQLite database at: {sqlite_path}")

    mysql_cursor = mysql_conn.cursor()
    
    try:
        # Get list of tables
        mysql_cursor.execute("SHOW TABLES")
        tables = [list(row.values())[0] for row in mysql_cursor.fetchall()]
        print(f"Found {len(tables)} tables to migrate: {tables}")
        
        for table in tables:
            print(f"Migrating table '{table}'...")
            
            # Get columns schema
            mysql_cursor.execute(f"DESCRIBE `{table}`")
            columns = mysql_cursor.fetchall()
            
            # Map MySQL columns to SQLite columns
            col_defs = []
            for col in columns:
                col_name = col['Field']
                col_type = col['Type']
                
                if 'int' in col_type.lower():
                    sqlite_type = 'INTEGER'
                elif 'decimal' in col_type.lower() or 'float' in col_type.lower() or 'double' in col_type.lower():
                    sqlite_type = 'REAL'
                else:
                    sqlite_type = 'TEXT'
                    
                if col['Key'] == 'PRI':
                    sqlite_type += ' PRIMARY KEY'
                    
                col_defs.append(f"`{col_name}` {sqlite_type}")
                
            create_sql = f"CREATE TABLE `{table}` ({', '.join(col_defs)})"
            sqlite_conn.execute(create_sql)
            
            # Fetch all rows from MySQL
            mysql_cursor.execute(f"SELECT * FROM `{table}`")
            rows = mysql_cursor.fetchall()
            
            if rows:
                col_names = list(rows[0].keys())
                placeholders = ", ".join(["?"] * len(col_names))
                insert_sql = f"INSERT INTO `{table}` ({', '.join(f'`{c}`' for c in col_names)}) VALUES ({placeholders})"
                
                insert_data = []
                for row in rows:
                    row_data = []
                    for col in col_names:
                        val = row[col]
                        if isinstance(val, Decimal):
                            val = float(val)
                        elif isinstance(val, datetime.timedelta):
                            val = str(val)
                        row_data.append(val)
                    insert_data.append(row_data)
                    
                sqlite_conn.executemany(insert_sql, insert_data)
                print(f"  Inserted {len(rows)} rows.")
            else:
                print("  Table is empty.")
                
        sqlite_conn.commit()
        print("Migration completed successfully!")
        
    except Exception as e:
        print(f"Error during migration: {str(e)}")
    finally:
        mysql_conn.close()
        sqlite_conn.close()

if __name__ == "__main__":
    migrate()
