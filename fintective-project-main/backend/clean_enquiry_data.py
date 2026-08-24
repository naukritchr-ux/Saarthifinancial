import os
import csv
import re
import sys

# Define file paths relative to script location
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_FILE = os.path.join(BACKEND_DIR, "master_final_enquiry_sheet_with_position_name.csv")
CLEANED_FILE = os.path.join(BACKEND_DIR, "master_final_enquiry_sheet_cleaned.csv")
FLAGGED_FILE = os.path.join(BACKEND_DIR, "master_final_enquiry_sheet_flagged.csv")

def parse_numeric(val):
    if not val or val.strip().lower() in ('', 'null', 'n/a', 'none', '-'):
        return 0.0, True
    # Clean currency symbol, spaces, and commas
    cleaned = val.strip().replace('₹', '').replace(',', '').replace(' ', '')
    try:
        return float(cleaned), True
    except ValueError:
        return 0.0, False

def main():
    print("="*60)
    print("Saarthi360 Enquiry Dataset Cleaning Pipeline")
    print("="*60)
    
    if not os.path.exists(INPUT_FILE):
        print(f"Error: Input dataset '{INPUT_FILE}' does not exist.")
        sys.exit(1)
        
    print(f"Reading raw data: {INPUT_FILE}")
    
    raw_rows = []
    headers = []
    with open(INPUT_FILE, 'r', encoding='utf-8', errors='ignore') as f:
        reader = csv.DictReader(f)
        headers = reader.fieldnames
        for row in reader:
            raw_rows.append(row)
            
    print(f"Loaded {len(raw_rows)} raw records.")
    
    # Track statistics
    stats = {
        'total': len(raw_rows),
        'clean': 0,
        'casing_normalized': 0,
        'missing_bill_date': 0,
        'quarantined_garbage': 0,
        'duplicates_merged': 0
    }
    
    # 1. First Pass: Validate fields & Normalize casing per row
    processed_rows = []
    quarantined_rows = []
    
    for idx, row in enumerate(raw_rows):
        needs_review = False
        review_reasons = []
        
        # A. Casing Normalization for Client Status
        status_raw = row.get('Client Status', '')
        status_clean = status_raw.strip().lower() if status_raw else ''
        if status_raw != status_clean:
            row['Client Status'] = status_clean
            stats['casing_normalized'] += 1
            
        # B. Check for missing Bill Date when status implies billing or a Bill Number is present
        service_charges_str = row.get('Service Charges', '0')
        bill_date_str = row.get('Bill Date', '').strip()
        bill_no_raw = row.get('Bill Number', '').strip()
        bill_no_present = bool(bill_no_raw and bill_no_raw.lower() not in ('', 'null', 'n/a', '-'))
        status_implies_billed = status_clean in ('closed', 'offered_and_accepted')
        
        service_charges, sc_valid = parse_numeric(service_charges_str)
        
        if (status_implies_billed or bill_no_present) and (not bill_date_str or bill_date_str.lower() in ('', 'null', 'n/a', '-')):
            needs_review = True
            review_reasons.append("Missing Bill Date for a closed/billed deal")
            stats['missing_bill_date'] += 1
            
        # C. Validate Placement Fees & Salary Offered as strictly numeric
        placement_fees_str = row.get('Placement Fees', '0')
        salary_offered_str = row.get('Salary Offered', '0')
        
        placement_fees, pf_valid = parse_numeric(placement_fees_str)
        salary_offered, sal_valid = parse_numeric(salary_offered_str)
        
        if not sc_valid or not pf_valid or not sal_valid:
            # Quarantine row due to non-numeric garbage (e.g. job titles shifted into salary columns)
            needs_review = True
            review_reasons.append(f"Non-numeric garbage in numeric field: sc={sc_valid}, pf={pf_valid}, sal={sal_valid}")
            row['data_quality_flag'] = 'needs_review'
            row['review_reasons'] = "; ".join(review_reasons)
            quarantined_rows.append(row)
            stats['quarantined_garbage'] += 1
            continue
            
        # Add temporary tags
        row['data_quality_flag'] = 'needs_review' if needs_review else 'clean'
        row['review_reasons'] = "; ".join(review_reasons) if needs_review else ''
        processed_rows.append(row)

    # 2. Second Pass: Deduplicate rows sharing a Bill Number
    # We group by non-null Bill Number
    bill_groups = {}
    non_billed_rows = []
    
    for row in processed_rows:
        bill_no = row.get('Bill Number', '').strip()
        if not bill_no or bill_no.lower() in ('', 'null', 'n/a', '-'):
            non_billed_rows.append(row)
        else:
            if bill_no not in bill_groups:
                bill_groups[bill_no] = []
            bill_groups[bill_no].append(row)
            
    deduplicated_billed_rows = []
    
    for bill_no, group in bill_groups.items():
        if len(group) == 1:
            deduplicated_billed_rows.append(group[0])
        else:
            # Multiple rows share the same bill number
            # Merge Rule: Keep the row with the most completed values (longest strings)
            # Sum serviceCharges/totalBillAmount if they differ, or keep max
            stats['duplicates_merged'] += (len(group) - 1)
            
            # Find the most complete row (row with maximum non-empty fields)
            merged_row = max(group, key=lambda r: sum(1 for k, v in r.items() if v and v.strip() and k not in ('data_quality_flag', 'review_reasons')))
            
            # Combine details if there are distinct candidate/position names
            candidate_names = set(r.get('Candidate Name', '').strip() for r in group if r.get('Candidate Name'))
            position_names = set(r.get('Position Name', '').strip() for r in group if r.get('Position Name'))
            
            if len(candidate_names) > 1:
                merged_row['Candidate Name'] = " / ".join(sorted(candidate_names))
            if len(position_names) > 1:
                merged_row['Position Name'] = " / ".join(sorted(position_names))
                
            # Aggregate financial fields
            total_sc = sum(parse_numeric(r.get('Service Charges', '0'))[0] for r in group)
            total_bill = sum(parse_numeric(r.get('Total Bill Amount', '0'))[0] for r in group)
            total_received = sum(parse_numeric(r.get('Amount Received', '0'))[0] for r in group)
            total_share = sum(parse_numeric(r.get('Franchisee Share', '0'))[0] for r in group)
            
            # If the sum differs significantly from the single row max, update it to represent total placements
            max_sc = max(parse_numeric(r.get('Service Charges', '0'))[0] for r in group)
            if total_sc > max_sc:
                merged_row['Service Charges'] = str(total_sc)
                merged_row['Total Bill Amount'] = str(total_bill)
                merged_row['Amount Received'] = str(total_received)
                merged_row['Franchisee Share'] = str(total_share)
                
            # If any of the duplicates needed review, the merged row needs review
            if any(r['data_quality_flag'] == 'needs_review' for r in group):
                merged_row['data_quality_flag'] = 'needs_review'
                reasons = set()
                for r in group:
                    if r.get('review_reasons'):
                        reasons.update(r['review_reasons'].split("; "))
                merged_row['review_reasons'] = "; ".join(reasons)
                
            deduplicated_billed_rows.append(merged_row)

    # Combine back
    final_rows = non_billed_rows + deduplicated_billed_rows
    
    # Split into clean and review/flagged lists
    clean_export_rows = []
    flagged_export_rows = []
    
    for row in final_rows:
        if row['data_quality_flag'] == 'clean':
            stats['clean'] += 1
        else:
            flagged_export_rows.append(row)
            
    # Include quarantined rows in flagged list for separate audit
    flagged_export_rows.extend(quarantined_rows)
    
    # Write Clean File (Master file containing ALL rows, marked with flags)
    clean_headers = headers + ['data_quality_flag', 'review_reasons']
    with open(CLEANED_FILE, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=clean_headers, extrasaction='ignore')
        writer.writeheader()
        writer.writerows(final_rows)
        
    # Write separate Quarantined File for garbage entries
    quarantined_headers = headers + ['data_quality_flag', 'review_reasons']
    with open(FLAGGED_FILE, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=quarantined_headers, extrasaction='ignore')
        writer.writeheader()
        writer.writerows(flagged_export_rows)
        
    # Output metrics
    print("\n" + "="*40)
    print("Pipeline Execution Metrics Summary")
    print("="*40)
    print(f"Total input rows processed:       {stats['total']}")
    print(f"Clean rows exported (CLEAN):      {stats['clean']}")
    print(f"Casing normalizations applied:    {stats['casing_normalized']}")
    print(f"Flagged missing dates:            {stats['missing_bill_date']}")
    print(f"Quarantined non-numeric garbage:  {stats['quarantined_garbage']}")
    print(f"Duplicate bill numbers merged:    {stats['duplicates_merged']}")
    print(f"Flagged rows exported:            {len(flagged_export_rows)}")
    print(f"Clean file written to:            {CLEANED_FILE}")
    print(f"Flagged file written to:          {FLAGGED_FILE}")
    print("="*40)

if __name__ == "__main__":
    main()
