import json, sys
# esdeger.mjs dökümleri: eski ↔ yeni, carilerin kuyruk sonucu (ön ödeme geçiş sayısı ayrıca).
a = {}
for line in open(sys.argv[1]):
    d = json.loads(line); a[d['id']] = d
b = {}
for line in open(sys.argv[2]):
    d = json.loads(line); b[d['id']] = d
def strip(d):
    return {k: v for k, v in d.items() if k != 'passes'}
diff = [k for k in a if strip(a[k]) != strip(b.get(k, {}))]
pa = sum(x['passes'] for x in a.values()); pb = sum(x['passes'] for x in b.values())
print("cari", len(a), len(b), "| sonucu farklı cari (geçiş sayısı hariç):", len(diff), "| ön ödeme geçişi toplamı eski", pa, "yeni", pb)
pd = [k for k in a if k in b and a[k]['passes'] != b[k]['passes']]
print("geçiş sayısı farklı cari:", len(pd))
for k in diff[:10]:
    x, y = a[k], b.get(k, {})
    for f in ['overdue', 'items', 'cards', 'inv']:
        if x.get(f) != y.get(f):
            if isinstance(x.get(f), dict):
                ks = [i for i in set(x[f]) | set(y.get(f, {})) if x[f].get(i) != y.get(f, {}).get(i)]
                print(k[-8:], f, [(i[-8:], x[f].get(i), y[f].get(i)) for i in ks][:4])
            else:
                print(k[-8:], f, x.get(f), y.get(f))
