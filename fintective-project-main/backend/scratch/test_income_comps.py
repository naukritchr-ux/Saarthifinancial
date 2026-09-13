import re

# Let's inspect the seed items and transactions in FinanceContext.jsx
with open('frontend/src/context/FinanceContext.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

income_comps = set(re.findall(r"companyName:\s*['\"]([^'\"]+)['\"].*?type:\s*['\"]income['\"]", text))
print('Income companies found:', income_comps)
