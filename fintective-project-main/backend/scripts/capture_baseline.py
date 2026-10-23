"""Capture and compare API baselines.
  python backend/scripts/capture_baseline.py capture backend/baselines/before
  python backend/scripts/capture_baseline.py compare backend/baselines/before backend/baselines/after
"""
import os, sys, json, hashlib

os.environ['FLASK_TESTING'] = 'true'   # must be set BEFORE importing app (stops sync daemon)
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..'))
from dotenv import load_dotenv
staging_env = os.path.join(HERE, '..', '.env.staging')
if os.path.exists(staging_env):
    load_dotenv(staging_env, override=True)
else:
    load_dotenv(os.path.join(HERE, '..', '.env'))

# Strict Safety Guard: Baseline scripts are strictly prohibited from touching production DB
if os.environ.get('DB_NAME') != 'crm_db_staging':
    raise RuntimeError(f"[SAFETY GUARD ACTIVATED] capture_baseline.py is restricted to 'crm_db_staging'. Current DB_NAME is '{os.environ.get('DB_NAME')}'. Execution aborted.")

FYS = ['2024-2025', '2025-2026', '2026-2027']
ENDPOINTS = {
    'transactions': '/api/transactions',
    'cost_performance': '/api/cost-performance?fy={fy}&month=all',
    'finance_summary': '/api/finance/summary?fy={fy}',
}
VOLATILE = {'generated_at', 'timestamp', 'cached_at', 'fetched_at', 'last_synced', 'updated_at', 'as_of'}


def clean(o, ignore_keys=None):
    """Drop volatile keys, optional ignored keys, and sort lists so ordering changes don't count as diffs."""
    drop = VOLATILE if not ignore_keys else VOLATILE | set(ignore_keys)
    if isinstance(o, dict):
        return {k: clean(v, ignore_keys) for k, v in sorted(o.items()) if k not in drop}
    if isinstance(o, list):
        return sorted((clean(x, ignore_keys) for x in o), key=lambda x: json.dumps(x, sort_keys=True, default=str))
    return o


def summarize(data):
    if isinstance(data, list):
        items = data
    elif isinstance(data, dict):
        items = data.get('rows') or next((v for v in data.values() if isinstance(v, list)), [])
    else:
        items = []

    amts = []
    if items:
        for x in items:
            if isinstance(x, dict):
                val = x.get('amount') if 'amount' in x else x.get('netContribution')
                if isinstance(val, (int, float)):
                    amts.append(val)
    elif isinstance(data, dict):
        # Summary dict like finance_summary: pick key metrics
        for k in ('billed_incl_gst', 'revenue', 'our_share', 'franchisee_share', 'net', 'salaries'):
            val = data.get(k)
            if isinstance(val, (int, float)):
                amts.append(val)

    return {
        'items': len(items) if items else len(data) if isinstance(data, dict) else 0,
        'amount_pos': round(sum(a for a in amts if a > 0), 2),
        'amount_neg': round(sum(a for a in amts if a < 0), 2)
    }


def capture(out_dir, ignore_keys=None):
    from app import app
    client = app.test_client()
    headers = {'x-api-key': os.environ.get('API_KEY', '')}
    os.makedirs(out_dir, exist_ok=True)
    summary = {}
    
    # Pre-fetch master transactions
    tx_res = client.get('/api/transactions', headers=headers)
    all_txs = tx_res.get_json() if tx_res.status_code == 200 else []

    for fy in FYS:
        for name, path in ENDPOINTS.items():
            key = f'{name}_{fy}'
            if name == 'transactions':
                if tx_res.status_code != 200:
                    print(f'!! {key}: HTTP {tx_res.status_code}')
                    summary[key] = {'status': tx_res.status_code}
                    continue
                fy_rows = [x for x in all_txs if x.get('financialYear') == fy]
                data = clean(fy_rows, ignore_keys)
            else:
                res = client.get(path.format(fy=fy), headers=headers)
                if res.status_code != 200:
                    print(f'!! {key}: HTTP {res.status_code}')
                    summary[key] = {'status': res.status_code}
                    continue
                data = clean(res.get_json(), ignore_keys)

            with open(os.path.join(out_dir, key + '.json'), 'w', encoding='utf-8') as f:
                json.dump(data, f, sort_keys=True, default=str)
            summary[key] = {
                'sha': hashlib.sha256(json.dumps(data, sort_keys=True, default=str).encode()).hexdigest()[:16],
                **summarize(data)
            }
            print(key, summary[key])

    with open(os.path.join(out_dir, '_summary.json'), 'w') as f:
        json.dump(summary, f, indent=2)


def compare(a_dir, b_dir, ignore_keys=None):
    a = json.load(open(os.path.join(a_dir, '_summary.json')))
    b = json.load(open(os.path.join(b_dir, '_summary.json')))
    bad = 0
    ignored = set(ignore_keys) if ignore_keys else set()
    for key in sorted(set(a) | set(b)):
        # If ignore_keys is supplied, load the underlying json files and clean them with ignore_keys
        a_file = os.path.join(a_dir, key + '.json')
        b_file = os.path.join(b_dir, key + '.json')
        if os.path.exists(a_file) and os.path.exists(b_file):
            data_a = clean(json.load(open(a_file, encoding='utf-8')), ignored)
            data_b = clean(json.load(open(b_file, encoding='utf-8')), ignored)
            sha_a = hashlib.sha256(json.dumps(data_a, sort_keys=True, default=str).encode()).hexdigest()[:16]
            sha_b = hashlib.sha256(json.dumps(data_b, sort_keys=True, default=str).encode()).hexdigest()[:16]
            if sha_a == sha_b:
                print('SAME ', key)
                continue
            bad += 1
            print('DIFF ', key)
            print('   before sha:', sha_a)
            print('   after  sha:', sha_b)
            # Print sample diff for summary dicts
            if isinstance(data_a, dict) and isinstance(data_b, dict):
                diff_keys = {k for k in set(data_a) | set(data_b) if data_a.get(k) != data_b.get(k)}
                print('   diff keys:', sorted(diff_keys))
                for dk in sorted(diff_keys)[:5]:
                    print(f'     key {dk}: before={data_a.get(dk)} vs after={data_b.get(dk)}')
        else:
            if a.get(key) == b.get(key):
                print('SAME ', key)
                continue
            bad += 1
            print('DIFF ', key)
            print('   before:', a.get(key))
            print('   after: ', b.get(key))

    print('\nRESULT:', 'identical' if bad == 0 else f'{bad} endpoint(s) changed')
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    args = sys.argv[1:]
    ignore_keys = []
    for i, a in enumerate(args):
        if a == '--ignore-keys' and i + 1 < len(args):
            ignore_keys = [k.strip() for k in args[i + 1].split(',') if k.strip()]
            del args[i:i + 2]
            break
        elif a.startswith('--ignore-keys='):
            ignore_keys = [k.strip() for k in a.split('=', 1)[1].split(',') if k.strip()]
            del args[i]
            break

    if len(args) >= 2 and args[0] == 'capture':
        capture(args[1], ignore_keys)
    elif len(args) >= 3 and args[0] == 'compare':
        compare(args[1], args[2], ignore_keys)
    else:
        print(__doc__)
