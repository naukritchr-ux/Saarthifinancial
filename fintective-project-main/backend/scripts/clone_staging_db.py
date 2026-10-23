"""
backend/scripts/clone_staging_db.py
Clones all schema and data from crm_db into crm_db_staging on Aiven.
Safe read from crm_db, writes only to crm_db_staging.
"""

import pymysql
import os
import sys
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

host = os.getenv('DB_HOST')
port = int(os.getenv('DB_PORT', 3306))
user = os.getenv('DB_USER')
password = os.getenv('DB_PASSWORD')
ssl = {'ssl': {}} if os.getenv('DB_SSL', 'false').lower() in ('true', '1') else None

print(f"Connecting to Aiven {host} to clone crm_db -> crm_db_staging...")
conn = pymysql.connect(host=host, port=port, user=user, password=password, ssl=ssl, autocommit=True)
cur = conn.cursor()

cur.execute("CREATE DATABASE IF NOT EXISTS crm_db_staging")

# Get all tables from crm_db
cur.execute("SELECT TABLE_NAME, TABLE_TYPE FROM information_schema.TABLES WHERE TABLE_SCHEMA = 'crm_db'")
items = cur.fetchall()

base_tables = [t[0] for t in items if t[1] == 'BASE TABLE']
views = [t[0] for t in items if t[1] == 'VIEW']

print(f"Found {len(base_tables)} base tables and {len(views)} views to clone.")

# Disable foreign key checks during clone
cur.execute("SET FOREIGN_KEY_CHECKS = 0")

for tbl in base_tables:
    print(f"Cloning table: {tbl}...", end=" ", flush=True)
    cur.execute(f"DROP TABLE IF EXISTS crm_db_staging.`{tbl}`")
    cur.execute(f"CREATE TABLE crm_db_staging.`{tbl}` LIKE crm_db.`{tbl}`")
    cur.execute(f"INSERT INTO crm_db_staging.`{tbl}` SELECT * FROM crm_db.`{tbl}`")
    cur.execute(f"SELECT COUNT(*) FROM crm_db_staging.`{tbl}`")
    cnt = cur.fetchone()[0]
    print(f"done ({cnt} rows)")

# Recreate views
for v in views:
    print(f"Recreating view: {v}...", end=" ", flush=True)
    cur.execute(f"USE crm_db_staging")
    cur.execute(f"DROP VIEW IF EXISTS `{v}`")
    cur.execute(f"SHOW CREATE VIEW crm_db.`{v}`")
    create_view_sql = cur.fetchone()[1]
    create_view_sql_staging = create_view_sql.replace('`crm_db`.', '`crm_db_staging`.')
    # If the view definition has ALGORITHM, replace CREATE ALGORITHM with CREATE OR REPLACE ALGORITHM
    if 'CREATE ALGORITHM' in create_view_sql_staging:
        create_view_sql_staging = create_view_sql_staging.replace('CREATE ALGORITHM', 'CREATE OR REPLACE ALGORITHM')
    elif 'CREATE VIEW' in create_view_sql_staging:
        create_view_sql_staging = create_view_sql_staging.replace('CREATE VIEW', 'CREATE OR REPLACE VIEW')
    cur.execute(create_view_sql_staging)
    print("done")

cur.execute("SET FOREIGN_KEY_CHECKS = 1")
print("\nSuccessfully cloned crm_db to crm_db_staging on Aiven!")
conn.close()
