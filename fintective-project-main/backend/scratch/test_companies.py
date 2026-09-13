import re

with open('frontend/src/context/FinanceContext.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

comps = set(re.findall(r"companyName:\s*['\"]([^'\"]+)['\"]", text))
print('Found unique companies:', len(comps))
for c in sorted(comps):
    if c not in ['Saarthi Corporate', 'N/A', '']:
        print('  -', c)
