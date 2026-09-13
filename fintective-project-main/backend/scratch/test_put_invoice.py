import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app
from db import get_db_connection

def test_put_invoice():
    # 1. Pick an existing invoice ID
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, billNumber, serviceCharges, info, billDate, franchiseeShare, ourShare, isManualShareOverride FROM invoice WHERE billNumber IS NOT NULL LIMIT 1")
    inv = cursor.fetchone()
    conn.close()

    if not inv:
        print("No invoices found in database to test!")
        return

    invoice_id = inv['id']
    print(f"Selected invoice ID: {invoice_id} (billNumber: {inv['billNumber']})")
    print(f"Current values: serviceCharges={inv['serviceCharges']}, franchiseeShare={inv['franchiseeShare']}, ourShare={inv['ourShare']}, isManualShareOverride={inv['isManualShareOverride']}")

    # 2. Exercise PUT /api/invoices/<id> with Flask test client
    client = app.test_client()
    
    # Headers with API Key if enforced or test mode
    headers = {
        'Content-Type': 'application/json'
    }
    api_key = os.environ.get('API_KEY')
    if api_key:
        headers['X-API-Key'] = api_key

    # No-op payload (saving with existing fields)
    payload = {
        "serviceCharges": float(inv['serviceCharges']) if inv['serviceCharges'] is not None else 0.0,
        "info": inv['info'] or '',
        "isManualShareOverride": bool(inv['isManualShareOverride'])
    }

    print(f"\nSending PUT /api/invoices/{invoice_id} with payload: {payload}")
    response = client.put(f"/api/invoices/{invoice_id}", json=payload, headers=headers)
    print(f"HTTP Response Status Code: {response.status_code}")
    print(f"HTTP Response Data: {response.get_json()}")
    
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    print("\nSUCCESS: PUT /api/invoices/<id> returned HTTP 200 without any MySQL errors!")

if __name__ == '__main__':
    test_put_invoice()
