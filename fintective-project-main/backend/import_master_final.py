import os
import csv
import pymysql
import datetime
import re
from dotenv import load_dotenv

load_dotenv()

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", 3306))
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_NAME = os.getenv("DB_NAME", "crm_db")

CSV_FILE = "master_final_pipeline.csv"

def get_db_connection():
    return pymysql.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME,
        cursorclass=pymysql.cursors.DictCursor
    )

def clean_name(name):
    if not name:
        return ""
    # Strip dots/hyphens and replace multiple spaces with single space
    cleaned = name.replace(' - ', ' ').replace(' . ', ' ')
    cleaned = cleaned.replace('.', ' ').replace('-', ' ')
    cleaned = re.sub(r'\b[Ii]ntern\b', '', cleaned)
    while '  ' in cleaned:
        cleaned = cleaned.replace('  ', ' ')
    return cleaned.strip()

def parse_date(date_str):
    if not date_str or date_str.strip().lower() in ('', 'null', 'n/a', 'none', '-', 'undefined'):
        return None
    date_str = date_str.strip()
    
    # Common date formats in spreadsheets
    for fmt in ('%d-%m-%Y', '%d/%m/%Y', '%Y-%m-%d', '%Y/%m/%d', '%d-%b-%y', '%d-%b-%Y', '%m/%d/%Y', '%m-%d-%Y'):
        try:
            dt = datetime.datetime.strptime(date_str, fmt)
            return dt.strftime('%Y-%m-%d')
        except ValueError:
            continue
            
    # Handle timestamps like "2025-08-18 09:49:31"
    if ' ' in date_str:
        return parse_date(date_str.split(' ')[0])
        
    return None

def parse_numeric(val):
    if not val or val.strip().lower() in ('', 'null', 'n/a', 'none', '-'):
        return None
    # Strip currency symbols and commas
    cleaned = val.strip().replace('₹', '').replace(',', '').replace(' ', '')
    try:
        return float(cleaned)
    except ValueError:
        return None

def map_status(status_str):
    if not status_str:
        return 'inprogress'
    status = status_str.strip().lower()
    
    if 'progress' in status or 'prospect' in status or 'revival' in status:
        return 'inprogress'
    if 'close' in status and 'internal' in status:
        return 'internally_closed'
    if 'close' in status:
        return 'closed'
    if 'cancel' in status or 'no hiring' in status or 'deleted' in status or 'non-active' in status or 'blacklisted' in status:
        return 'cancelled'
    if 'reject' in status:
        return 'offered_and_rejected'
    if 'realloc' in status:
        return 'reallocation'
    if 'accept' in status:
        return 'offered_and_accepted'
    if 'hold' in status:
        return 'position_hold'
    if 'revise' in status:
        return 'revised'
    if 'note' in status:
        return 'credit_note'
        
    return 'inprogress'

def main():
    if not os.path.exists(CSV_FILE):
        print(f"Error: CSV file '{CSV_FILE}' not found in current directory.")
        return
        
    print(f"Connecting to database '{DB_NAME}'...")
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Disable foreign key checks for clean truncation
        cursor.execute("SET FOREIGN_KEY_CHECKS = 0")
        
        # Ensure info column exists
        cursor.execute("SHOW COLUMNS FROM enquiries LIKE 'info'")
        if not cursor.fetchone():
            print("Altering enquiries table to add info column...")
            cursor.execute("ALTER TABLE enquiries ADD COLUMN info VARCHAR(50) DEFAULT NULL")
        
        # Truncate tables to overwrite with fresh data
        print("Truncating existing enquiries and invoice tables...")
        cursor.execute("TRUNCATE TABLE invoice")
        cursor.execute("TRUNCATE TABLE enquiries")
        
        cursor.execute("SET FOREIGN_KEY_CHECKS = 1")
        conn.commit()
        
        print(f"Parsing CSV '{CSV_FILE}'...")
        with open(CSV_FILE, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            
            enquiries_count = 0
            invoices_count = 0
            
            for idx, row in enumerate(reader):
                # Clean fields
                company_name = row.get('Company Name', '').strip()
                bd_member = clean_name(row.get('BD Member', ''))
                team_leader = clean_name(row.get('Team Leader', ''))
                franchise_name = clean_name(row.get('Franchise Name', ''))
                position_name = row.get('Position Name', '').strip()
                info_val = row.get('Info', '').strip() or None
                bill_no = row.get('Bill Number', '').strip() or None
                bill_date = parse_date(row.get('Bill Date', ''))

                # Real Industry label and client tenure — previously dropped
                # at import even though the CSV has them. Both tested as
                # having genuine (if modest) predictive value for the ML
                # models: real Industry replaces the keyword-guess heuristic,
                # dateClientAcquired lets train_models.py compute how long
                # the client relationship has existed as of allocation.
                industry_val = row.get('Industry', '').strip() or None
                date_client_acquired = parse_date(row.get('Date Client Acquired', ''))
                
                placement_fees = parse_numeric(row.get('Placement Fees', ''))
                # Limit placement fees percentage if it maps to enum max limits
                if placement_fees is not None and placement_fees > 999.99:
                    placement_fees = 999.99
                    
                sal_from = parse_numeric(row.get('Salary From', ''))
                sal_offered = parse_numeric(row.get('Salary Offered', ''))
                
                # Service charges or total bill amount as service fee
                service_charges = parse_numeric(row.get('Service Charges', ''))
                total_bill = parse_numeric(row.get('Total Bill Amount', ''))
                
                # Fallback arithmetic checks for bill_amount mapping
                sc_val = service_charges if service_charges is not None else 0.0
                tb_val = total_bill if total_bill is not None else 0.0
                bill_amount = service_charges if sc_val > 0 else total_bill
                
                # Parse amount_received early to verify closed status
                amount_received = parse_numeric(row.get('Amount Received', ''))
                
                # Strict closed status mapping rule
                status = map_status(row.get('Client Status', ''))
                if bill_no and bill_date and amount_received is not None:
                    bill_amount_val = bill_amount if bill_amount is not None else 0.0
                    if abs(amount_received - bill_amount_val) <= 1.00:
                        status = 'closed'
                
                date_alloc = parse_date(row.get('Date of Allocation', ''))
                date_realloc = parse_date(row.get('Date of Reallocation', ''))
                
                # Skip rows with no company name
                if not company_name:
                    continue
                    
                # 1. Insert into enquiries
                cursor.execute("""
                    INSERT INTO enquiries (
                        companyName, bdMemberName, teamLeaderName, franchiseeName,
                        placementFees, positionName, industry, `from`, `to`, enquiryStatus,
                        dateOfAllocation, dateClientAcquired, dateOfReallocation, bill_no, bill_date, bill_amount, info
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    company_name, bd_member, team_leader, franchise_name,
                    placement_fees, position_name, industry_val, sal_from, sal_offered, status,
                    date_alloc, date_client_acquired, date_realloc, bill_no, bill_date, bill_amount, info_val
                ))
                enquiry_id = cursor.lastrowid
                enquiries_count += 1
                
                # 2. Insert into invoice if billed
                if bill_no:
                    franchisee_share = parse_numeric(row.get('Franchisee Share', ''))
                    amount_received = parse_numeric(row.get('Amount Received', ''))
                    date_received = parse_date(row.get('Date Received', ''))
                    
                    # Compute ourShare (payout margin share), checking None values safely
                    bill_amount_calc = bill_amount if bill_amount is not None else 0.0
                    franchisee_share_calc = franchisee_share if franchisee_share is not None else 0.0
                    our_share = bill_amount_calc - franchisee_share_calc
                    
                    cursor.execute("""
                        INSERT INTO invoice (
                            enquiry_id, billNumber, billDate, serviceCharges,
                            franchiseeShare, ourShare, amountReceived, dateReceived,
                            nameOfBd, teamLeader, franchiseName
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """, (
                        enquiry_id, bill_no, bill_date, bill_amount,
                        franchisee_share, our_share, amount_received, date_received,
                        bd_member, team_leader, franchise_name
                    ))
                    invoices_count += 1
                    
            conn.commit()
            print(f"Successfully loaded master_final CSV dataset:")
            print(f"  Total Enquiries inserted: {enquiries_count}")
            print(f"  Total Invoices inserted: {invoices_count}")
            
    except Exception as e:
        conn.rollback()
        print("An error occurred during database loading:", str(e))
    finally:
        conn.close()

if __name__ == "__main__":
    main()
