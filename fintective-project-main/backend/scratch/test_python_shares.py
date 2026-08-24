import sys
import os

# Add backend directory to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from invoice_helpers import calculate_shares

test_cases = [
    # Pre-April 2026 (60/40 Split)
    { "service_charges": 10000, "info": "O", "bill_date": "2026-03-31", "expected_franchise": 6000, "expected_company": 4000, "label": "Pre-cutoff normal split" },
    { "service_charges": 10000, "info": "CN", "bill_date": "2026-03-31", "expected_franchise": 6000, "expected_company": 0, "label": "Pre-cutoff CN override" },
    { "service_charges": 10000, "info": "PP", "bill_date": "2026-03-31", "expected_franchise": 6000, "expected_company": 2000, "label": "Pre-cutoff PP override (halved company share)" },
    
    # Post-April 2026 (75/25 Split)
    { "service_charges": 10000, "info": "O", "bill_date": "2026-04-01", "expected_franchise": 7500, "expected_company": 2500, "label": "Post-cutoff normal split" },
    { "service_charges": 10000, "info": "CN", "bill_date": "2026-04-01", "expected_franchise": 7500, "expected_company": 0, "label": "Post-cutoff CN override" },
    { "service_charges": 10000, "info": "PP", "bill_date": "2026-04-01", "expected_franchise": 7500, "expected_company": 1250, "label": "Post-cutoff PP override (halved company share)" },
    
    # Fallback to today (Post-April 2026 since current date is 2026)
    { "service_charges": 10000, "info": "O", "bill_date": None, "expected_franchise": 7500, "expected_company": 2500, "label": "Fallback to current date (post-cutoff)" },

    # Remainder rounding check (penny-to-penny matching)
    { "service_charges": 10002, "info": "O", "bill_date": "2026-05-01", "expected_franchise": 7502, "expected_company": 2500, "label": "Remainder rounding split (10002 -> 7502 + 2500 = 10002)" },

    # Manual Overrides
    { "service_charges": 10000, "info": "O", "bill_date": "2026-05-01", "is_manual_override": True, "manual_franchise": 4500, "manual_company": 5500, "expected_franchise": 4500, "expected_company": 5500, "label": "Manual override split" }
]

failed = 0
for tc in test_cases:
    is_manual = tc.get("is_manual_override", False)
    man_fran = tc.get("manual_franchise", None)
    man_comp = tc.get("manual_company", None)
    
    result = calculate_shares(
        tc["service_charges"], 
        tc["info"], 
        tc["bill_date"],
        is_manual_override=is_manual,
        manual_franchisee_share=man_fran,
        manual_our_share=man_comp
    )
    
    pass_check = result["franchisee_share"] == tc["expected_franchise"] and result["our_share"] == tc["expected_company"]
    if pass_check:
        print(f"✅ PASS: {tc['label']} -> Franchise: {result['franchisee_share']}, Company: {result['our_share']}")
    else:
        print(f"❌ FAIL: {tc['label']} -> Got: {{ Franchise: {result['franchisee_share']}, Company: {result['our_share']} }}, Expected: {{ Franchise: {tc['expected_franchise']}, Company: {tc['expected_company']} }}")
        failed += 1

if failed == 0:
    print("\n🎉 All Python functional test cases passed successfully!")
    sys.exit(0)
else:
    print(f"\n❌ {failed} test cases failed.")
    sys.exit(1)
