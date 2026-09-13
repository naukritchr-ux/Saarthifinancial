import sys, os, time
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app

client = app.test_client()
headers = {'X-API-Key': 'saarthi-secret-api-key-2026', 'Accept-Encoding': 'gzip'}

# First call (populates cache)
client.get('/api/transactions', headers=headers)
client.get('/api/ml/insights', headers=headers)

# Second call (measure cached performance)
print("=== CACHED PERFORMANCE ===")
for ep in ['/api/transactions', '/api/ml/insights']:
    t0 = time.time()
    res = client.get(ep, headers=headers)
    dt = time.time() - t0
    is_gzipped = res.headers.get('Content-Encoding') == 'gzip'
    print(f"{ep:20} -> {dt*1000:6.2f}ms | Status: {res.status_code} | Size: {len(res.data)/1024:6.1f} KB | Gzipped: {is_gzipped}")
