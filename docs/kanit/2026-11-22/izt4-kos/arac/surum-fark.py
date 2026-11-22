import json, sys
# eski ↔ yeni okuma dökümü (surum.mjs MODE=oku) — sınıf sınıf fark tablosu.
def load(p):
    rows, meta = {}, {}
    for line in open(p):
        line = line.strip()
        if not line.startswith('{'):
            continue
        d = json.loads(line)
        if 'name' in d:
            rows[d['name']] = d
        else:
            meta.update(d)
    return rows, meta
a, ma = load(sys.argv[1])
b, mb = load(sys.argv[2])
print(f"Mutabakat eski {ma.get('mutabakat')} yeni {mb.get('mutabakat')}")
print("| Sınıf | Fark (eski → yeni) |")
print("|---|---|")
def flat(d, pre=''):
    out = {}
    if isinstance(d, dict):
        for k, v in d.items():
            out.update(flat(v, f"{pre}.{k}" if pre else k))
    elif isinstance(d, list):
        for i, v in enumerate(d):
            out.update(flat(v, f"{pre}[{i}]"))
    else:
        out[pre] = d
    return out
for name in sorted(set(a) | set(b)):
    fa, fb = flat(a.get(name, {})), flat(b.get(name, {}))
    diffs = [f"{k}: {fa.get(k)} → {fb.get(k)}" for k in sorted(set(fa) | set(fb)) if fa.get(k) != fb.get(k)]
    print(f"| {name} | {'; '.join(diffs) if diffs else 'FARK YOK'} |")
