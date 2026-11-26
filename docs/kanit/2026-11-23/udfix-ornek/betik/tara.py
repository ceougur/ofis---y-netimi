# Düşen kâhin senaryolarında ilk düşen kontrolden önceki adım türleri (aile ayırmak için).
import json, re, sys, os
d = sys.argv[1]
log = open(sys.argv[2]).read().splitlines()
fails = {}
cur = None
for line in log:
    m = re.match(r'^(rastgele-[^:]+): (\d+)/(\d+) tuttu', line)
    if m:
        cur = m.group(1) if m.group(2) != m.group(3) else None
        continue
    if cur and '✗' in line:
        k = re.search(r'\] (k\d+|adim:[^:]+):', line)
        fails.setdefault(cur, []).append((k.group(1) if k else '?', line.strip()[:200]))
for name, rows in fails.items():
    sc = json.load(open(os.path.join(d, name + '.json')))
    first = rows[0][0]
    kinds = []
    for s in sc['adimlar']:
        if s['id'] == first or (first.startswith('adim:') and s['id'] == first[5:]):
            kinds.append(s['islem'])
            break
        kinds.append(s['islem'])
    c = {}
    for k in kinds:
        c[k] = c.get(k, 0) + 1
    flags = [f for f in ['degersiz', 'supheli_al', 'kilit', 'donem_kilidi', 'kart_ac', 'taksit_tahsil', 'karsiliksiz', 'iade', 'mahsup'] if any(f in k for k in c)]
    print(f"{name}: ilk {first} · {len(rows)} fark · adım türleri {flags} · {rows[0][1][:150]}")
