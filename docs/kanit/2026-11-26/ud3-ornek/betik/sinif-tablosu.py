# UD turu 3 — kâhin cari 598 farkının küme tablosu: taban (ud3-taban kodu) → yalnız S264 (taban-s264 kopyası) → son kod (S264 + KS8.1 ölçümü).
# Farkın kümesi, hangi düzeltmede kapandığından (aynı senaryolar, aynı kâhin, --mutasyonsuz); kalanlar son koddaki anahtarlarıyla.
import json, os, sys
D = sys.argv[1]
def fark(src, ad):
    p = os.path.join(D, src, ad + '.fark.json')
    return {x['anahtar']: x for x in json.load(open(p))['farklar']} if os.path.exists(p) else None
oz = json.load(open(os.path.join(D, 'kc-taban', 'ozet.json')))
satir = []
top = {'K1-S264': 0, 'K2-KS8.1-olcum': 0, 'K3-s1-12-KS9': 0, 'K4-s1-30-S104-yalin-olmayan': 0, 'SINIFLANMADI': 0}
for s in oz['ozet']:
    if not s['fark']:
        continue
    ad = s['ad']
    t, a, b = fark('kc-taban', ad), fark('ayrim-s264', ad), fark('ara2', ad)
    for k, x in t.items():
        if k not in a:
            c = 'K1-S264'
        elif k not in b:
            c = 'K2-KS8.1-olcum'
        elif ad == 'rastgele-s1-12':
            c = 'K3-s1-12-KS9'
        elif ad == 'rastgele-s1-30':
            c = 'K4-s1-30-S104-yalin-olmayan'
        else:
            c = 'SINIFLANMADI'
        top[c] += 1
        satir.append({'senaryo': ad, 'anahtar': k, 'kume': c, 'sinif246': x.get('sinif246', ''), 'program': x['program'], 'kahin': x['beklenen']})
print(json.dumps(top, ensure_ascii=False), 'toplam', sum(top.values()))
per = {}
for r in satir:
    per.setdefault(r['senaryo'], {}).setdefault(r['kume'], 0)
    per[r['senaryo']][r['kume']] += 1
for k, v in per.items():
    print(k, v)
json.dump({'toplam': top, 'senaryo': per, 'farklar': satir}, open(os.path.join(D, 'sinif-tablosu.json'), 'w'), ensure_ascii=False, indent=1)
