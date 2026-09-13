import os
import pymysql
import pymysql.cursors
import datetime
from dotenv import load_dotenv

# Load env file
load_dotenv()

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", 3306))
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_NAME = os.getenv("DB_NAME", "crm_db")
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
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """)

            cur.execute("""
                CREATE TABLE IF NOT EXISTS franchisees_forms (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    nameAsPerAgreement VARCHAR(255) NULL,
                    teamLeaderName VARCHAR(255) NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

        conn.close()
        print("✅ MySQL schema verified and ready.")
        return True
    except Exception as e:
        print(f"⚠️ Note during MySQL schema verification: {str(e)}")
        return False

def init_db():
    """Initializes tables on startup."""
    return ensure_tables_exist()
