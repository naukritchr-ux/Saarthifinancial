"""
backend/scripts/db_guard.py
Shared database connector and safety guard for all reactivation scripts.
"""

import os
import sys
import argparse
import pymysql
import pymysql.cursors
from dotenv import load_dotenv

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PROD_ENV_FILE = os.path.join(BACKEND_DIR, '.env')
STAGING_ENV_FILE = os.path.join(BACKEND_DIR, '.env.staging')

# Read PROD_DB_HOST from .env
load_dotenv(PROD_ENV_FILE)
PROD_DB_HOST = os.getenv("PROD_DB_HOST") or os.getenv("DB_HOST", "tds-reconciliation-prod-naukritchr-dbf8.b.aivencloud.com").strip()


def add_db_safety_args(parser: argparse.ArgumentParser):
    parser.add_argument("--env", choices=["staging", "prod"], default="staging",
                        help="Database environment: 'staging' (loads .env.staging) or 'prod' (loads .env). Default: staging")
    parser.add_argument("--i-know-this-is-prod", action="store_true",
                        help="Required flag to allow read-only analysis or training against the production host.")


def get_db_connection(args):
    """
    Returns a verified PyMySQL connection following the safety protocol:
    1. Loads the specified environment (.env.staging or .env).
    2. Compares the resulting DB_HOST against PROD_DB_HOST.
    3. Blocks execution if target == PROD_DB_HOST and --i-know-this-is-prod is absent.
    """
    target_env_file = STAGING_ENV_FILE if args.env == 'staging' else PROD_ENV_FILE

    if not os.path.exists(target_env_file):
        raise FileNotFoundError(f"Configuration file not found: {target_env_file}")

    # Load environment variables cleanly
    load_dotenv(target_env_file, override=True)

    db_host = os.getenv("DB_HOST", "localhost").strip()
    db_port = int(os.getenv("DB_PORT", 3306))
    db_user = os.getenv("DB_USER", "root").strip()
    db_password = os.getenv("DB_PASSWORD", "")
    db_name = os.getenv("DB_NAME", "crm_db").strip()
    db_ssl = os.getenv("DB_SSL", "false").lower() in ("true", "1", "yes")

    # Safety Guard: Compare target host and database against production
    is_prod_target = (db_host.lower() == PROD_DB_HOST.lower() and db_name.lower() == 'crm_db') or (args.env == "prod")

    if is_prod_target and not getattr(args, 'i_know_this_is_prod', False):
        print("\n" + "!" * 78)
        print("SAFETY GUARD ERROR: Production Host/Database Protection")
        print(f"Target DB '{db_name}' is the production database.")
        print("To allow execution against the production database, you MUST pass:")
        print("   --i-know-this-is-prod")
        print("Otherwise switch to the staging database (crm_db_staging) via backend/.env.staging (--env staging).")
        print("!" * 78 + "\n")
        sys.exit(1)

    env_label = "prod" if is_prod_target else "staging"
    print(f"========================================")
    print(f"TARGET: {env_label}")
    print(f"========================================\n")

    conn_params = {
        "host": db_host,
        "port": db_port,
        "user": db_user,
        "password": db_password,
        "database": db_name,
        "ssl": {"ssl": {}} if db_ssl else None,
        "cursorclass": pymysql.cursors.DictCursor
    }

    try:
        conn = pymysql.connect(**{k: v for k, v in conn_params.items() if v is not None})
        return conn, env_label, db_name
    except Exception as e:
        print(f"\n[DB Error] Failed to connect to DB (db: {db_name}): {e}")
        raise e
