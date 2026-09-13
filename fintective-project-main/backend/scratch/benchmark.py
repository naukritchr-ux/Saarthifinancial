import sys, os, time
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app

api_key = os.environ.get('API_KEY', '')
headers = {'X-API-Key': api_key}
endpoints = [
    '/api/transactions',
    '/api/franchisees',
    '/api/bd-agents',
    '/api/team-leaders',
    '/api/budgets',
    '/api/finance/franchisee-summary',
    '/api/bd-revenue-leaderboard',
    '/api/tl-revenue-leaderboard',
    '/api/job-portal/summary',
    '/api/job-portal/clients'
]

print(f"{'Endpoint':35} | {'Time (s)':10} | {'Status':6} | {'Payload (KB)'}")
print('-' * 70)
for ep in endpoints:
    t0 = time.time()
    res = client.get(ep, headers=headers)
    dt = time.time() - t0
    print(f"{ep:35} | {dt:8.3f}s | {res.status_code:6} | {len(res.data)/1024:8.1f} KB")
