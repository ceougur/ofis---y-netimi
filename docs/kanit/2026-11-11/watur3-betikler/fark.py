# Program ↔ kâhin sürücü çıktılarının önce / sonra karşılaştırması (senaryo başına davranış farkı kümesi; SÜRÜCÜ HATASI / GEÇERSİZ ayrı).
# Kullanım: python3 -I fark.py <önce.json> <sonra.json>
import json
import sys


def load(p):
    out = {}
    for r in json.load(open(p, encoding='utf-8')):
        if r.get('hata'):
            key = ('HATA', str(r['hata']).split('\n')[0][:160])
            out[r['ad']] = {'tur': 'hata', 'f': {key[1]}}
        elif r.get('gecersiz'):
            out[r['ad']] = {'tur': 'gecersiz', 'f': set(map(str, r['gecersiz']))}
        else:
            out[r['ad']] = {'tur': 'kos', 'f': set(map(str, r.get('davranis_farki') or [])), 'tum': len(r.get('farklar') or [])}
    return out


a, b = load(sys.argv[1]), load(sys.argv[2])
same = changed = 0
for ad in sorted(set(a) | set(b)):
    x, y = a.get(ad), b.get(ad)
    if x is None or y is None:
        print('EKSİK', ad, 'önce' if x is None else 'sonra')
        continue
    if x['tur'] == y['tur'] and x['f'] == y['f']:
        same += 1
        continue
    changed += 1
    print('=== DEĞİŞTİ', ad, f"{x['tur']}→{y['tur']}", f"davranış farkı {len(x['f'])}→{len(y['f'])}")
    for f in sorted(x['f'] - y['f']):
        print('   KAPANAN', f[:230])
    for f in sorted(y['f'] - x['f']):
        print('   YENİ   ', f[:230])
tot_a = sum(1 for v in a.values() if v['tur'] == 'kos' and not v['f'])
tot_b = sum(1 for v in b.values() if v['tur'] == 'kos' and not v['f'])
print(f"# senaryo {len(b)} · aynı {same} · değişen {changed} · davranış farkı 0 olan: önce {tot_a}, sonra {tot_b}")
