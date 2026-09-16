import sys
import os

# Add backend directory to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from invoice_helpers import calculate_shares

test_cases = [
    # Franchisee with completed 3 years (>= 3 years tenure) -> 70 / 30 Split
    { "service_charges": 10000, "info": "O", "bill_date": "2026-05-01", "onboarding_date": "2022-01-01", "expected_franchise": 7000, "expected_company": 3000, "label": "Completed 3 years (4 yrs tenure) normal split" },
    { "service_charges": 10000, "info": "CN", "bill_date": "2026-05-01", "onboarding_date": "2022-01-01", "expected_franchise": 7000, "expected_company": 0, "label": "Completed 3 years CN override" },
    { "service_charges": 10000, "info": "PP", "bill_date": "2026-05-01", "onboarding_date": "2022-01-01", "expected_franchise": 7000, "expected_company": 1500, "label": "Completed 3 years PP override (halved company share)" },
    { "service_charges": 10000, "info": "O", "years_completed": 3.0, "expected_franchise": 7000, "expected_company": 3000, "label": "Explicit 3 years completed -> 70/30" },

    # Franchisee who hasn't completed 3 years (< 3 years tenure) -> 75 / 25 Split
    { "service_charges": 10000, "info": "O", "bill_date": "2026-05-01", "onboarding_date": "2024-06-01", "expected_franchise": 7500, "expected_company": 2500, "label": "Under 3 years (1.9 yrs tenure) normal split" },
    { "service_charges": 10000, "info": "CN", "bill_date": "2026-05-01", "onboarding_date": "2024-06-01", "expected_franchise": 7500, "expected_company": 0, "label": "Under 3 years CN override" },
    { "service_charges": 10000, "info": "PP", "bill_date": "2026-05-01", "onboarding_date": "2024-06-01", "expected_franchise": 7500, "expected_company": 1250, "label": "Under 3 years PP override (halved company share)" },
    { "service_charges": 10000, "info": "O", "years_completed": 1.5, "expected_franchise": 7500, "expected_company": 2500, "label": "Explicit 1.5 years -> 75/25" },
    
    # Default without onboarding date (< 3 years standard) -> 75 / 25
    { "service_charges": 10000, "info": "O", "bill_date": None, "expected_franchise": 7500, "expected_company": 2500, "label": "Default/new franchisee (under 3 years fallback)" },

    # Remainder rounding check (penny-to-penny matching)
    { "service_charges": 10002, "info": "O", "bill_date": "2026-05-01", "years_completed": 3.0, "expected_franchise": 7001, "expected_company": 3001, "label": "Remainder rounding 70/30 (10002 -> 7001 + 3001 = 10002)" },
    { "service_charges": 10002, "info": "O", "bill_date": "2026-05-01", "years_completed": 1.0, "expected_franchise": 7502, "expected_company": 2500, "label": "Remainder rounding 75/25 (10002 -> 7502 + 2500 = 10002)" },

    # Exact .5 Rounding (ROUND_HALF_UP accounting standard)
    { "service_charges": 5, "info": "O", "years_completed": 3.0, "expected_franchise": 4, "expected_company": 1, "label": "Round-half-up 70/30 (5 * 0.70 = 3.5 -> 4 franchise, 1 company)" },
    { "service_charges": 6, "info": "O", "years_completed": 1.0, "expected_franchise": 5, "expected_company": 1, "label": "Round-half-up 75/25 (6 * 0.75 = 4.5 -> 5 franchise, 1 company)" },

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
        tc.get("bill_date"),
        is_manual_override=is_manual,
        manual_franchisee_share=man_fran,
        manual_our_share=man_comp,
        franchise_name=tc.get("franchise_name"),
        onboarding_date=tc.get("onboarding_date"),
        years_completed=tc.get("years_completed")
    )
    
    pass_check = result["franchisee_share"] == tc["expected_franchise"] and result["our_share"] == tc["expected_company"]
    if pass_check:
        print(f"[PASS] {tc['label']} -> Franchise: {result['franchisee_share']}, Company: {result['our_share']}")
    else:
        print(f"[FAIL] {tc['label']} -> Got: {{ Franchise: {result['franchisee_share']}, Company: {result['our_share']} }}, Expected: {{ Franchise: {tc['expected_franchise']}, Company: {tc['expected_company']} }}")
        failed += 1

if failed == 0:
    print("\n[SUCCESS] All Python functional test cases passed successfully!")
    sys.exit(0)
else:
    print(f"\n[ERROR] {failed} test cases failed.")
    sys.exit(1)
