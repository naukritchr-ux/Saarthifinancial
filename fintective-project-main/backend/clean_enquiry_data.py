import os
import csv
import re
import sys
from db import get_db_connection

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
CLEANED_FILE = os.path.join(BACKEND_DIR, "master_final_enquiry_sheet_cleaned.csv")
FLAGGED_FILE = os.path.join(BACKEND_DIR, "master_final_enquiry_sheet_flagged.csv")

def parse_numeric(val):
    if val is None:
        return 0.0, True
    if isinstance(val, (int, float)):
        return float(val), True
    s = str(val).strip().lower()
    if s in ('', 'null', 'n/a', 'none', '-'):
        return 0.0, True
    cleaned = s.replace('₹', '').replace(',', '').replace(' ', '')
    try:
        return float(cleaned), True
    except ValueError:
        return 0.0, False

def load_live_data_from_db():
    """Fetches live enquiries and invoices directly from MySQL."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT 
                    e.id,
                    e.companyName AS `Company Name`,
                    e.positionName AS `Position Name`,
                    e.bdMemberName AS `BD Member`,
                    e.teamLeaderName AS `Team Leader`,
                    e.franchiseeName AS `Franchise Name`,
                    e.placementFees AS `Placement Fees`,
                    e.industry AS `Industry`,
                    e.enquiryStatus AS `Client Status`,
                    e.dateOfAllocation AS `Date of Allocation`,
                    e.dateClientAcquired AS `Date Client Acquired`,
                    e.bill_no AS `Bill Number`,
                    e.bill_date AS `Bill Date`,
                    e.bill_amount AS `Service Charges`,
                    i.totalBillAmt AS `Total Bill Amount`,
                    i.amountReceived AS `Amount Received`,
                    i.franchiseeShare AS `Franchisee Share`,
                    i.candidateName AS `Candidate Name`,
                    i.annualSalaryOffered AS `Salary Offered`,
                    e.info AS `Info`
                FROM enquiries e
                LEFT JOIN invoice i ON e.id = i.enquiry_id
                ORDER BY e.id ASC
            """)
            rows = cur.fetchall()
            return rows
    finally:
        conn.close()

def main():
    print("="*60)
    print("Saarthi360 Live Data Cleaning & Deduplication Pipeline")
    print("="*60)
    
    # Check if a custom file argument was provided, otherwise fetch live DB
    custom_input_file = sys.argv[1] if len(sys.argv) > 1 else None
    
    if custom_input_file and os.path.exists(custom_input_file):
        print(f"Reading input file: {custom_input_file}")
        raw_rows = []
        with open(custom_input_file, 'r', encoding='utf-8', errors='ignore') as f:
            reader = csv.DictReader(f)
            headers = reader.fieldnames
            for row in reader:
                raw_rows.append(row)
    else:
        print("Connecting to live MySQL database to fetch active records...")
        raw_rows = load_live_data_from_db()
        headers = [
            'id', 'Company Name', 'Position Name', 'BD Member', 'Team Leader',
            'Franchise Name', 'Placement Fees', 'Industry', 'Client Status',
            'Date of Allocation', 'Date Client Acquired', 'Bill Number',
            'Bill Date', 'Service Charges', 'Total Bill Amount', 'Amount Received',
            'Franchisee Share', 'Candidate Name', 'Salary Offered', 'Info'
        ]
        
    print(f"Fetched {len(raw_rows)} active records for processing.")
    
    stats = {
        'total': len(raw_rows),
        'clean': 0,
        'casing_normalized': 0,
        'missing_bill_date': 0,
        'quarantined_garbage': 0,
        'duplicates_merged': 0,
        'collisions_kept_separate': 0,
        'categories': {
            'exact_duplicate': 0,
            'different_company_collision': 0,
            'same_deal_revised_amount': 0,
            'same_company_different_candidate': 0
        }
    }
    
    # 1. First Pass: Validate fields & Normalize casing
    processed_rows = []
    quarantined_rows = []
    
    for row in raw_rows:
        row = dict(row)
        needs_review = False
        review_reasons = []
        
        status_raw = str(row.get('Client Status') or '')
        status_clean = status_raw.strip().lower()
        if status_raw != status_clean:
            row['Client Status'] = status_clean
            stats['casing_normalized'] += 1
            
        bill_date_str = str(row.get('Bill Date') or '').strip()
        bill_no_raw = str(row.get('Bill Number') or '').strip()
        bill_no_present = bool(bill_no_raw and bill_no_raw.lower() not in ('', 'null', 'n/a', 'none', '-'))
        status_implies_billed = status_clean in ('closed', 'offered_and_accepted')
        
        service_charges, sc_valid = parse_numeric(row.get('Service Charges'))
        placement_fees, pf_valid = parse_numeric(row.get('Placement Fees'))
        salary_offered, sal_valid = parse_numeric(row.get('Salary Offered'))
        
        if (status_implies_billed or bill_no_present) and (not bill_date_str or bill_date_str.lower() in ('', 'null', 'n/a', 'none', '-')):
            needs_review = True
            review_reasons.append("Missing Bill Date for a closed/billed deal")
            stats['missing_bill_date'] += 1
            
        if not sc_valid or not pf_valid or not sal_valid:
            needs_review = True
            review_reasons.append("Non-numeric data in financial columns")
            row['data_quality_flag'] = 'needs_review'
            row['review_reasons'] = "; ".join(review_reasons)
            quarantined_rows.append(row)
            stats['quarantined_garbage'] += 1
            continue
            
        row['data_quality_flag'] = 'needs_review' if needs_review else 'clean'
        row['review_reasons'] = "; ".join(review_reasons) if needs_review else ''
        processed_rows.append(row)

    # 2. Second Pass: Categorized duplicate bill number resolution
    bill_groups = {}
    non_billed_rows = []
    
    for row in processed_rows:
        bill_no = str(row.get('Bill Number') or '').strip()
        if not bill_no or bill_no.lower() in ('', 'null', 'n/a', 'none', '-'):
            non_billed_rows.append(row)
        else:
            if bill_no not in bill_groups:
                bill_groups[bill_no] = []
            bill_groups[bill_no].append(row)
            
    deduplicated_billed_rows = []
    
    for bill_no, group in bill_groups.items():
        if len(group) == 1:
            deduplicated_billed_rows.append(group[0])
            continue
            
        # Analyze category live across the group
        distinct_companies = set(str(r.get('Company Name') or '').strip().lower() for r in group if r.get('Company Name'))
        distinct_candidates = set(str(r.get('Candidate Name') or '').strip().lower() for r in group if r.get('Candidate Name'))
        distinct_amounts = set(parse_numeric(r.get('Service Charges'))[0] for r in group)
        
        if len(distinct_companies) > 1:
            category = 'different_company_collision'
        elif len(distinct_candidates) > 1:
            category = 'same_company_different_candidate'
        elif len(distinct_amounts) > 1:
            category = 'same_deal_revised_amount'
        else:
            category = 'exact_duplicate'
            
        stats['categories'][category] += 1
        
        # Rule 1: different_company_collision -> DO NOT MERGE into single row!
        if category == 'different_company_collision':
            stats['collisions_kept_separate'] += len(group)
            for r in group:
                r['data_quality_flag'] = 'needs_review'
                reasons = [r.get('review_reasons', '')] if r.get('review_reasons') else []
                reasons.append("Different company bill number collision - manual review required")
                r['review_reasons'] = "; ".join(filter(None, reasons))
                deduplicated_billed_rows.append(r)
            continue
            
        # Rule 2, 3, 4: Pick most complete row
        stats['duplicates_merged'] += (len(group) - 1)
        merged_row = max(group, key=lambda r: sum(1 for k, v in r.items() if v and str(v).strip() and k not in ('data_quality_flag', 'review_reasons')))
        
        candidate_names = sorted(set(str(r.get('Candidate Name') or '').strip() for r in group if r.get('Candidate Name')))
        position_names = sorted(set(str(r.get('Position Name') or '').strip() for r in group if r.get('Position Name')))
        
        if len(candidate_names) > 1:
            merged_row['Candidate Name'] = " / ".join(candidate_names)
        if len(position_names) > 1:
            merged_row['Position Name'] = " / ".join(position_names)
            
        # Rule 2: same_company_different_candidate -> Sum financial fields
        if category == 'same_company_different_candidate':
            total_sc = sum(parse_numeric(r.get('Service Charges'))[0] for r in group)
            total_bill = sum(parse_numeric(r.get('Total Bill Amount'))[0] for r in group)
            total_received = sum(parse_numeric(r.get('Amount Received'))[0] for r in group)
            total_share = sum(parse_numeric(r.get('Franchisee Share'))[0] for r in group)
            merged_row['Service Charges'] = str(total_sc)
            merged_row['Total Bill Amount'] = str(total_bill)
            merged_row['Amount Received'] = str(total_received)
            merged_row['Franchisee Share'] = str(total_share)
            
        # Rule 3 & 4: exact_duplicate and same_deal_revised_amount -> Keep single row as-is (do NOT sum)
        
        if any(r.get('data_quality_flag') == 'needs_review' for r in group):
            merged_row['data_quality_flag'] = 'needs_review'
            reasons = set()
            for r in group:
                if r.get('review_reasons'):
                    reasons.update(r['review_reasons'].split("; "))
            merged_row['review_reasons'] = "; ".join(filter(None, reasons))
            
        deduplicated_billed_rows.append(merged_row)

    final_rows = non_billed_rows + deduplicated_billed_rows
    clean_export_rows = [r for r in final_rows if r['data_quality_flag'] == 'clean']
    flagged_export_rows = [r for r in final_rows if r['data_quality_flag'] != 'clean'] + quarantined_rows
    
    stats['clean'] = len(clean_export_rows)
    
    # Save outputs
    clean_headers = headers + ['data_quality_flag', 'review_reasons']
    with open(CLEANED_FILE, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=clean_headers, extrasaction='ignore')
        writer.writeheader()
        writer.writerows(final_rows)
        
    with open(FLAGGED_FILE, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=clean_headers, extrasaction='ignore')
        writer.writeheader()
        writer.writerows(flagged_export_rows)
        
    print("\n" + "="*50)
    print("Pipeline Execution Metrics (Live Data)")
    print("="*50)
    print(f"Total live records processed:         {stats['total']}")
    print(f"Clean records (CLEAN):                {stats['clean']}")
    print(f"Flagged missing bill dates:           {stats['missing_bill_date']}")
    print(f"Quarantined non-numeric items:        {stats['quarantined_garbage']}")
    print(f"Duplicate bill groups processed:      {sum(stats['categories'].values())}")
    print(f"  - exact_duplicate:                  {stats['categories']['exact_duplicate']} groups (kept single row, dropped duplicates)")
    print(f"  - different_company_collision:      {stats['categories']['different_company_collision']} groups ({stats['collisions_kept_separate']} rows kept separate for review)")
    print(f"  - same_deal_revised_amount:         {stats['categories']['same_deal_revised_amount']} groups (kept latest revision, no sum)")
    print(f"  - same_company_different_candidate: {stats['categories']['same_company_different_candidate']} groups (summed multi-placements)")
    print(f"Total duplicates merged out:          {stats['duplicates_merged']}")
    print(f"Flagged records for review:           {len(flagged_export_rows)}")
    print(f"Clean output saved to:                {CLEANED_FILE}")
    print(f"Flagged output saved to:              {FLAGGED_FILE}")
    print("="*50)

if __name__ == "__main__":
    main()
