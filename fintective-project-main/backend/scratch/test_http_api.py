import urllib.request
import json

endpoints = [
    "http://127.0.0.1:5000/api/transactions",
    "http://127.0.0.1:5000/api/franchisees",
    "http://127.0.0.1:5000/api/bd-agents",
    "http://127.0.0.1:5000/api/team-leaders",
    "http://127.0.0.1:5000/api/budgets"
]

print("Checking backend API endpoints:")
for url in endpoints:
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=5) as response:
            status = response.status
            body = response.read().decode('utf-8')
            data = json.loads(body)
            print(f"✅ SUCCESS: {url} -> Status: {status}, returned {len(data) if isinstance(data, list) else len(data.keys())} items")
    except Exception as e:
        print(f"❌ FAILED: {url} -> Error: {str(e)}")
