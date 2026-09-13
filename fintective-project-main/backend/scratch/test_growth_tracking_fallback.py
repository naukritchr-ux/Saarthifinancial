import os
import sys

# Ensure backend directory in path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db import get_db_connection
from growth_tracking_controller import _fetch_historical_revenue, _calculate_cagr

def test_growth_tracking_guards():
    conn = get_db_connection()
    cursor = conn.cursor()

    print("--- Test 1: Real entity with invoices (Corporate Comrade Consultancy) ---")
    series_real = _fetch_historical_revenue(cursor, 'franchisee', 'Corporate Comrade Consultancy', 'Corporate Comrade Consultancy')
    print(f"Series count: {len(series_real)}")
    assert len(series_real) == 3, f"Expected 3 periods, got {len(series_real)}"
    assert series_real[0]['period'] == '2024-2025'
    print("Real invoice series retrieved successfully:", series_real)

    print("\n--- Test 2: Entity with NO invoices (NonExistent Partner) ---")
    series_empty = _fetch_historical_revenue(cursor, 'franchisee', 'fake-id', 'NonExistent Partner')
    assert len(series_empty) == 0, f"Expected empty series, got {series_empty}"
    print("Empty series returned as expected (no fallback substitution to Nagpur Central):", series_empty)

    cagr_empty = _calculate_cagr(series_empty)
    assert cagr_empty is None, f"Expected None CAGR for empty series, got {cagr_empty}"
    print("CAGR for empty series is None as expected.")

    print("\n--- Test 3: BD Agent with NO invoices (NonExistent BD) ---")
    series_bd_empty = _fetch_historical_revenue(cursor, 'bd_agent', 'fake-bd', 'NonExistent BD')
    assert len(series_bd_empty) == 0, f"Expected empty series, got {series_bd_empty}"
    print("Empty BD series returned as expected (no fallback substitution to Rohan Mehta).")

    conn.close()
    print("\nALL GROWTH TRACKING GUARDS VERIFIED SUCCESSFULLY!")

if __name__ == '__main__':
    test_growth_tracking_guards()
