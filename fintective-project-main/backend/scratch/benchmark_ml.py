
import sys, os, time
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app

api_key = os.environ.get('API_KEY', '')
headers = {'X-API-Key': api_key}

t0 = time.time()
res = client.get('/api/ml/insights', headers=headers)
dt = time.time() - t0
print(f"/api/ml/insights took {dt:.3f}s, status: {res.status_code}, payload size: {len(res.data)/1024:.1f} KB")
