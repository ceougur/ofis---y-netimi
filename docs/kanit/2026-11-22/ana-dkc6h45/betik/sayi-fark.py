# yeni ↔ eski: kesinDegil ve bilgi DIŞINDAKİ bütün alanlar (sayılar, satırlar, dipnotlar) aynı mı?
import json, sys
a = json.load(open(sys.argv[1]))
b = json.load(open(sys.argv[2]))
same = diff = 0
for sinif, R in a.items():
    for st in ('s0', 's1', 's2', 's3'):
        if st not in R:
            continue
        for k, x in R[st]['reads'].items():
            y = b.get(sinif, {}).get(st, {}).get('reads', {}).get(k)
            if not y:
                print('YOK', sinif, st, k)
                continue
            ox, oy = json.loads(x['full']), json.loads(y['full'])
            for o in (ox, oy):
                if isinstance(o, dict):
                    o.pop('kesinDegil', None)
                    o.pop('bilgi', None)
            if ox == oy:
                same += 1
            else:
                diff += 1
                keys = [kk for kk in set(ox) | set(oy) if ox.get(kk) != oy.get(kk)] if isinstance(ox, dict) else ['?']
                print('SAYI FARKI', sinif, st, k, keys)
print('aynı', same, 'farklı', diff)
