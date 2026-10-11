import json, sys
p = sys.argv[1]
d = json.load(open(p))
n = 0
for f in d['farklar']:
    s = f.get('kokSinif') or ''
    if 'IADE-KAPAMA' not in json.dumps(s):
        continue
    if f['yol'][0] == 'araDurumlar':
        continue
    n += 1
    if n > int(sys.argv[2] if len(sys.argv) > 2 else 12):
        continue
    print(json.dumps({k: f.get(k) for k in ('alan', 'a', 'b', 'program', 'desen', 'kokSinif', 'pencere')}, ensure_ascii=False)[:400])
    for o in (f.get('olaylar') or [])[:4]:
        print('    olay', json.dumps(o, ensure_ascii=False)[:300])
print('son durum IADE yaprak:', n)
print('farklar alanları:', list(d['farklar'][0].keys()) if d['farklar'] else [])
