import re

with open('frontend/src/pages/RunwayRoiTracker.jsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

color_pattern = re.compile(r'color\s*:\s*[\'\"](#?[a-zA-Z0-9_-]+|\bvar\(--[a-zA-Z0-9_-]+\)|rgba?\([^)]+\))[\'\"]')

results = []
for i, line in enumerate(lines, 1):
    matches = color_pattern.findall(line)
    if matches:
        for m in matches:
            results.append((i, m, line.strip()))

with open('backend/scratch/color_analysis.txt', 'w', encoding='utf-8') as out:
    out.write(f"Total color instances found: {len(results)}\n")
    for idx, c, l in results:
        out.write(f"{idx:4d}: {c:20s} | {l}\n")

print(f"Total color instances found: {len(results)}. Written to backend/scratch/color_analysis.txt")
