import sys, os
sys.path.insert(0, os.path.abspath('backend'))
import dotenv
dotenv.load_dotenv('backend/.env')
from app import app

client = app.test_client()

# Test 1: Single scope
res1 = client.post('/api/growth/compare', json={
    'fy': 'FY 2026-27',
    'scopes': [{'bd': 'Komal Suresh Bhanushali'}]
}, headers={'X-User-Role': 'admin', 'X-API-Key': 'saarthi-secret-api-key-2026'})
print('Test 1 Status:', res1.status_code)
print('Test 1 Data:', res1.get_json())

# Test 2: Dual scope with overlap (Komal vs Joyeeta)
res2 = client.post('/api/growth/compare', json={
    'fy': 'FY 2026-27',
    'scopes': [
        {'bd': 'Komal Suresh Bhanushali'},
        {'tl': 'Joyeeta Joydeb Khaskel'}
    ]
}, headers={'X-User-Role': 'admin', 'X-API-Key': 'saarthi-secret-api-key-2026'})
print('Test 2 Status:', res2.status_code)
data2 = res2.get_json()
print('Test 2 Scopes Count:', len(data2))
for item in data2:
    print(f"Scope: {item['label']} ({item['type']}), Rev: {item['revenue']}, OurShare: {item['ourShare']}, Overlaps: {item['overlapsWith']}")
