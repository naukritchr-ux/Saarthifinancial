import pymysql
import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

host = os.getenv('DB_HOST')
port = int(os.getenv('DB_PORT', 3306))
user = os.getenv('DB_USER')
password = os.getenv('DB_PASSWORD')
ssl = {'ssl': {}} if os.getenv('DB_SSL', 'false').lower() in ('true', '1') else None

try:
    conn = pymysql.connect(host=host, port=port, user=user, password=password, ssl=ssl)
    cur = conn.cursor()
    cur.execute("SHOW DATABASES")
    dbs = [r[0] for r in cur.fetchall()]
    print("Databases on Aiven:", dbs)
    conn.close()
except Exception as e:
    print("Connection error:", e)
