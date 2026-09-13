import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app
from db import get_db_connection

def test_override_flag_save():
    client = app.test_client()
    headers = {'Content-Type': 'application/json'}
    api_key = os.environ.get('API_KEY')
    if api_key:
        headers['X-API-Key'] = api_key

    # Update with manual override = True
    payload = {
        "serviceCharges": 10000.0,
        "info": "O",
        "isManualShareOverride": True,
        "franchiseeShare": 5000.0,
        "ourShare": 5000.0
    }

    res = client.put("/api/invoices/180010", json=payload, headers=headers)
    print("PUT with isManualShareOverride=True status:", res.status_code)
    data = res.get_json()
    print("Updated invoice share values:", {
        "franchiseeShare": data['updatedInvoice']['franchiseeShare'],
        "ourShare": data['updatedInvoice']['ourShare'],
        "isManualShareOverride": data['updatedInvoice']['isManualShareOverride']
    })
    assert res.status_code == 200
    assert float(data['updatedInvoice']['franchiseeShare']) == 5000.0
    assert float(data['updatedInvoice']['ourShare']) == 5000.0
    assert data['updatedInvoice']['isManualShareOverride'] == 1

    print("\nManual override persistence verified successfully!")

if __name__ == '__main__':
    test_override_flag_save()
