import urllib.request

urls = [
    "http://127.0.0.1:5000/api/finance/moving-avg-burn",
    "http://127.0.0.1:5000/api/finance/cash-balance?as_of=2026-12-31"
]

for url in urls:
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=10) as response:
            print(f"✅ SUCCESS: {url} -> Status: {response.status}")
    except Exception as e:
        print(f"❌ FAILED: {url} -> Error: {str(e)}")
        # If it's a HTTPError, print the error code and body
        if hasattr(e, 'code'):
            print(f"   HTTP Status: {e.code}")
            try:
                print("   Response:", e.read().decode('utf-8'))
            except:
                pass
