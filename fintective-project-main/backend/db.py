import os
import pymysql
import pymysql.cursors
import urllib.parse
import datetime
from dotenv import load_dotenv

# Load env file
load_dotenv()

# Parse DATABASE_URL / MYSQL_URL / AIVEN_URL / DB_URI if provided
database_url = os.getenv("DATABASE_URL") or os.getenv("MYSQL_URL") or os.getenv("AIVEN_URL") or os.getenv("DB_URI")

parsed_host = ""
parsed_port = 3306
parsed_user = ""
parsed_password = ""
parsed_name = ""

if database_url:
    try:
        parsed = urllib.parse.urlparse(database_url)
        parsed_host = parsed.hostname or ""
        parsed_port = parsed.port or 3306
        parsed_user = parsed.username or ""
        parsed_password = parsed.password or ""
        if parsed.path and len(parsed.path) > 1:
            parsed_name = parsed.path.lstrip('/')
    except Exception as parse_err:
        print("[DB WARN] Error parsing DATABASE_URL:", str(parse_err))

DB_HOST = (os.getenv("DB_HOST", "").strip() or parsed_host or "localhost")
DB_PORT = int(os.getenv("DB_PORT", str(parsed_port)))
DB_USER = (os.getenv("DB_USER", "").strip() or parsed_user or "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "") or parsed_password
DB_NAME = (os.getenv("DB_NAME", "").strip() or parsed_name or "crm_db")
DB_SSL = os.getenv("DB_SSL", "false").lower() in ("true", "1", "yes")

def get_db_connection(select_db=True):
    """
    Creates and returns a connection to MySQL / Aiven MySQL with DictCursor.
    Supports SSL for hosted cloud databases like Aiven.
    """
    conn_params = {
        "host": DB_HOST.strip().replace("https://", "").replace("http://", "").split(":")[0],
        "port": DB_PORT,
        "user": DB_USER.strip(),
        "password": DB_PASSWORD,
        "cursorclass": pymysql.cursors.DictCursor,
        "connect_timeout": 15,
        "autocommit": True,
        "charset": "utf8mb4"
    }

    if select_db:
        conn_params["database"] = DB_NAME.strip()

    # Enable SSL for Aiven or any managed cloud MySQL
    if DB_SSL or "aivencloud.com" in DB_HOST:
        conn_params["ssl"] = {"ssl_mode": "REQUIRED"}

    return pymysql.connect(**conn_params)

def test_connection():
    """Tests connection to MySQL and returns connection status."""
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("SELECT 1 AS test_val")
            res = cur.fetchone()
        conn.close()
        return {"status": "connected", "database": DB_NAME, "host": DB_HOST, "test": res}
    except Exception as e:
        return {"status": "error", "message": str(e), "host": DB_HOST, "database": DB_NAME}

def ensure_tables_exist():
    """
    Verifies and creates all required MySQL tables for Fintective if they do not already exist.
    """
    print("Verifying Fintective MySQL tables schema...")
    try:
        conn = get_db_connection(select_db=False)
        with conn.cursor() as cur:
            cur.execute(f"CREATE DATABASE IF NOT EXISTS `{DB_NAME}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;")
            cur.execute(f"USE `{DB_NAME}`;")
            
            # 1. Franchisees
            cur.execute("""
                CREATE TABLE IF NOT EXISTS franchisees (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    nameAsPerAgreement VARCHAR(255) NULL,
                    teamLeaderName VARCHAR(255) NULL,
                    onboardingDate VARCHAR(100) NULL,
                    status VARCHAR(50) DEFAULT 'active',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE KEY uq_fran_name (nameAsPerAgreement)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """)

            cur.execute("""
                CREATE TABLE IF NOT EXISTS franchisees_forms (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    nameAsPerAgreement VARCHAR(255) NULL,
                    teamLeaderName VARCHAR(255) NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE KEY uq_fran_form_name (nameAsPerAgreement)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """)

            # 2. Enquiries
            cur.execute("""
                CREATE TABLE IF NOT EXISTS enquiries (
                    id INT PRIMARY KEY,
                    companyName VARCHAR(255) NULL,
                    bdMemberName VARCHAR(255) NULL,
                    teamLeaderName VARCHAR(255) NULL,
                    franchiseeName VARCHAR(255) NULL,
                    placementFees DECIMAL(15, 2) DEFAULT 0.00,
                    positionName VARCHAR(255) NULL,
                    industry VARCHAR(255) NULL,
                    `from` DECIMAL(15, 2) DEFAULT 0.00,
                    `to` DECIMAL(15, 2) DEFAULT 0.00,
                    enquiryStatus VARCHAR(100) NULL,
                    dateOfAllocation VARCHAR(100) NULL,
                    dateClientAcquired VARCHAR(100) NULL,
                    dateOfReallocation VARCHAR(100) NULL,
                    bill_no VARCHAR(100) NULL,
                    bill_date VARCHAR(100) NULL,
                    bill_amount DECIMAL(15, 2) DEFAULT 0.00,
                    info TEXT NULL,
                    created_at VARCHAR(100) NULL,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_enq_status (enquiryStatus),
                    INDEX idx_enq_bd (bdMemberName),
                    INDEX idx_enq_tl (teamLeaderName),
                    INDEX idx_enq_fran (franchiseeName),
                    INDEX idx_enq_company (companyName)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """)

            # 3. Invoices
            cur.execute("""
                CREATE TABLE IF NOT EXISTS invoice (
                    id INT PRIMARY KEY,
                    enquiry_id INT NULL,
                    billNumber VARCHAR(100) NULL,
                    billDate VARCHAR(100) NULL,
                    serviceCharges DECIMAL(15, 2) DEFAULT 0.00,
                    serviceCharge DECIMAL(15, 2) DEFAULT 0.00,
                    totalGST DECIMAL(15, 2) DEFAULT 0.00,
                    totalBillAmt DECIMAL(15, 2) DEFAULT 0.00,
                    franchiseeShare DECIMAL(15, 2) DEFAULT 0.00,
                    franchiseeGST DECIMAL(15, 2) DEFAULT 0.00,
                    ourShare DECIMAL(15, 2) DEFAULT 0.00,
                    amountReceived DECIMAL(15, 2) DEFAULT 0.00,
                    amountDue DECIMAL(15, 2) DEFAULT 0.00,
                    tds DECIMAL(15, 2) DEFAULT 0.00,
                    tdsFF DECIMAL(15, 2) DEFAULT 0.00,
                    dateReceived VARCHAR(100) NULL,
                    paidOnDate VARCHAR(100) NULL,
                    payment_mode VARCHAR(100) NULL,
                    uid_transaction_id VARCHAR(100) NULL,
                    nameOfBd VARCHAR(255) NULL,
                    teamLeader VARCHAR(255) NULL,
                    franchiseName VARCHAR(255) NULL,
                    financialYear VARCHAR(50) NULL,
                    candidateName VARCHAR(255) NULL,
                    companyName VARCHAR(255) NULL,
                    postOfCandidate VARCHAR(255) NULL,
                    annualSalaryOffered DECIMAL(15, 2) DEFAULT 0.00,
                    info VARCHAR(100) NULL,
                    status VARCHAR(100) NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_inv_bill (billNumber),
                    INDEX idx_inv_enq (enquiry_id),
                    INDEX idx_inv_bd (nameOfBd),
                    INDEX idx_inv_tl (teamLeader),
                    INDEX idx_inv_fran (franchiseName),
                    INDEX idx_inv_fy (financialYear),
                    INDEX idx_inv_company (companyName)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """)

            # 4. Franchise Payments
            cur.execute("""
                CREATE TABLE IF NOT EXISTS franchisePayments (
                    franchisePayment_id INT AUTO_INCREMENT PRIMARY KEY,
                    invoice_id INT NULL,
                    payment_done VARCHAR(50) DEFAULT 'no',
                    payment_date VARCHAR(100) NULL,
                    payment_mode VARCHAR(100) NULL,
                    uid_transaction_id VARCHAR(100) NULL,
                    payment_amount DECIMAL(15, 2) DEFAULT 0.00,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """)

            # 5. Expenditure
            cur.execute("""
                CREATE TABLE IF NOT EXISTS expenditure (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    srNo VARCHAR(100) NULL,
                    billDate VARCHAR(100) NULL,
                    particulars VARCHAR(255) NULL,
                    expenses VARCHAR(255) NULL,
                    amount DECIMAL(15, 2) DEFAULT 0.00,
                    net DECIMAL(15, 2) DEFAULT 0.00,
                    expenseType VARCHAR(100) NULL,
                    bdAgentId VARCHAR(100) NULL,
                    franchiseeId VARCHAR(100) NULL,
                    is_deleted TINYINT DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE KEY uq_exp_srno (srNo),
                    INDEX idx_exp_date (billDate),
                    INDEX idx_exp_type (expenseType)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """)

            # 6. Budgets
            cur.execute("""
                CREATE TABLE IF NOT EXISTS budgets (
                    category VARCHAR(100) PRIMARY KEY,
                    limit_amount DECIMAL(15, 2) DEFAULT 0.00,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """)

            # 7. BD Agents (Configured base salaries, compensation rates, status)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS bd_agents (
                    id VARCHAR(100) PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    role VARCHAR(100) DEFAULT 'BD Specialist',
                    baseSalary DECIMAL(15, 2) DEFAULT 12000.00,
                    payPerProgressed DECIMAL(15, 2) DEFAULT 2500.00,
                    payPerCancelled DECIMAL(15, 2) DEFAULT 500.00,
                    commissionRate DECIMAL(5, 4) DEFAULT 0.0200,
                    status VARCHAR(50) DEFAULT 'Active',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    UNIQUE KEY uq_bd_name (name)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """)

            # Seed default budgets if empty
            cur.execute("SELECT COUNT(*) as cnt FROM budgets;")
            if cur.fetchone()["cnt"] == 0:
                initial_budgets = [
                    ('Marketing', 50000.0),
                    ('Operations', 150000.0),
                    ('Rent', 45000.0),
                    ('Salaries', 800000.0),
                    ('Software', 25000.0),
                    ('Travel', 30000.0),
                    ('Utilities', 15000.0),
                    ('Office & infra', 55000.0),
                    ('Portal subscriptions', 85000.0),
                    ('BD commissions', 120000.0),
                    ('Other', 50000.0)
                ]
                cur.executemany("INSERT INTO budgets (category, limit_amount) VALUES (%s, %s);", initial_budgets)

            # Seed initial operational expenditures if empty
            cur.execute("SELECT COUNT(*) as cnt FROM expenditure;")
            if cur.fetchone()["cnt"] == 0:
                exp_templates = [
                    ('Salaries', 'Employee Base Salaries Batch', 450000.0, 'Salaries', 'Salaries'),
                    ('Office & infra', 'Commercial Office Rent & Maintenance', 45000.0, 'Office & infra', 'Rent & Infrastructure'),
                    ('Portal subscriptions', 'Naukri.com & LinkedIn Recruiter Suite', 85000.0, 'Portal subscriptions', 'Job Portal Access'),
                    ('Marketing', 'Google Search Ads & Social Campaigns', 55000.0, 'Marketing', 'Performance Marketing'),
                    ('Office & infra', 'AWS Cloud Server Infrastructure & DB', 28000.0, 'Office & infra', 'Cloud Infrastructure'),
                    ('Other', 'Office Pantry, Tea & Refreshments', 15000.0, 'Other', 'Operational Supplies'),
                    ('BD commissions', 'BD Agent Quarterly Performance Payouts', 95000.0, 'BD commissions', 'Commission Share')
                ]
                exp_rows = []
                for yr in [2024, 2025, 2026]:
                    for mo in range(1, 13):
                        if yr == 2026 and mo > 8:
                            continue
                        mo_str = f"{mo:02d}"
                        for idx, (exp_cat, part, amt, exp_type, desc) in enumerate(exp_templates):
                            day_str = f"{(idx * 4 + 3) % 28 + 1:02d}"
                            exp_rows.append((
                                f"TX-{yr}{mo_str}-{idx}",
                                f"{yr}-{mo_str}-{day_str}",
                                f"{part} ({mo_str}/{yr})",
                                exp_cat,
                                amt,
                                amt,
                                exp_type,
                                None,
                                None,
                                0
                            ))
                cur.executemany("""
                    INSERT INTO expenditure (srNo, billDate, particulars, expenses, amount, net, expenseType, bdAgentId, franchiseeId, is_deleted)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
                """, exp_rows)

            # 7. Audit Log
            cur.execute("""
                CREATE TABLE IF NOT EXISTS audit_log (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    table_name VARCHAR(100) NULL,
                    record_id VARCHAR(100) NULL,
                    field_changed VARCHAR(100) NULL,
                    old_value TEXT NULL,
                    new_value TEXT NULL,
                    changed_by VARCHAR(100) NULL,
                    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """)

            # 8. Clients Info (from Saarthi CRM)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS clients_info (
                    id INT PRIMARY KEY,
                    companyName VARCHAR(255) NULL,
                    contactPersonName VARCHAR(255) NULL,
                    designation VARCHAR(255) NULL,
                    phoneNumber VARCHAR(100) NULL,
                    emailId VARCHAR(255) NULL,
                    teamLeader VARCHAR(255) NULL,
                    gstNumber VARCHAR(50) NULL,
                    panNumber VARCHAR(50) NULL,
                    tanNumber VARCHAR(50) NULL,
                    status VARCHAR(50) DEFAULT 'active',
                    amount DECIMAL(15, 2) DEFAULT 0.00,
                    tdsAmount DECIMAL(15, 2) DEFAULT 0.00,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_client_comp (companyName),
                    INDEX idx_client_pan (panNumber),
                    INDEX idx_client_tan (tanNumber)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """)

            # 9. Legals Info (from Saarthi CRM)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS legals_info (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    legal_id INT NULL,
                    companyName VARCHAR(255) NULL,
                    partyName VARCHAR(255) NULL,
                    gstNo VARCHAR(50) NULL,
                    panNo VARCHAR(50) NULL,
                    tanNo VARCHAR(50) NULL,
                    financialYear VARCHAR(50) NULL,
                    voucherDate VARCHAR(100) NULL,
                    legal_amount DECIMAL(15, 2) DEFAULT 0.00,
                    tdsAmount DECIMAL(15, 2) DEFAULT 0.00,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE KEY uq_legal_id (legal_id),
                    INDEX idx_legal_comp (companyName),
                    INDEX idx_legal_tan (tanNo)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """)

            # 10. Sync Logs
            cur.execute("""
                CREATE TABLE IF NOT EXISTS crm_sync_logs (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    sync_type VARCHAR(100) DEFAULT 'all',
                    status VARCHAR(50) DEFAULT 'in_progress',
                    enquiries_count INT DEFAULT 0,
                    invoices_count INT DEFAULT 0,
                    franchisees_count INT DEFAULT 0,
                    expenses_count INT DEFAULT 0,
                    clients_count INT DEFAULT 0,
                    legals_count INT DEFAULT 0,
                    message TEXT NULL,
                    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    completed_at TIMESTAMP NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """)

            # Migration: Ensure unique constraints exist on active existing database tables
            def add_unique_key_if_missing(table_name, key_name, col_name):
                try:
                    cur.execute("""
                        SELECT COUNT(*) as cnt 
                        FROM information_schema.STATISTICS 
                        WHERE TABLE_SCHEMA = %s 
                          AND TABLE_NAME = %s 
                          AND INDEX_NAME = %s
                    """, (DB_NAME, table_name, key_name))
                    res = cur.fetchone()
                    if res and res["cnt"] == 0:
                        # Clean up any existing duplicate rows before applying unique key
                        try:
                            cur.execute(f"""
                                DELETE FROM `{table_name}` 
                                WHERE id NOT IN (
                                    SELECT min_id FROM (
                                        SELECT MIN(id) as min_id FROM `{table_name}` WHERE `{col_name}` IS NOT NULL GROUP BY `{col_name}`
                                    ) t
                                ) AND `{col_name}` IS NOT NULL;
                            """)
                        except Exception as dedup_err:
                            print(f"[DB DEDUP WARN] {table_name}: {dedup_err}")

                        cur.execute(f"ALTER TABLE `{table_name}` ADD UNIQUE KEY `{key_name}` (`{col_name}`);")
                        print(f"[DB] Added UNIQUE KEY `{key_name}` on `{table_name}`(`{col_name}`).")
                except Exception as e:
                    print(f"[DB WARN] Note adding unique key {key_name} on {table_name}: {str(e)}")

            add_unique_key_if_missing("franchisees", "uq_fran_name", "nameAsPerAgreement")
            add_unique_key_if_missing("franchisees_forms", "uq_fran_form_name", "nameAsPerAgreement")
            add_unique_key_if_missing("expenditure", "uq_exp_srno", "srNo")
            add_unique_key_if_missing("legals_info", "uq_legal_id", "legal_id")

        conn.close()
        print("[DB] MySQL schema verified and ready.")
        return True
    except Exception as e:
        print(f"[DB WARN] Note during MySQL schema verification: {str(e)}")
        return False

def init_db():
    """Initializes tables on startup."""
    return ensure_tables_exist()
