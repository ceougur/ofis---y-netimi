# Kâhin çıktı klasöründe senaryo başına farkların hangi cari / adım kimliğine düştüğünü sayar (kâhine dokunmaz).
import json, os, sys, collections, re
src = sys.argv[1]
oz = json.load(open(os.path.join(src, 'ozet.json')))
for s in oz['ozet']:
    if not s['fark']:
        continue
    sc = json.load(open(os.path.join(src, s['ad'] + '.json')))
    cari = {a['id']: a.get('cari') for a in sc['adimlar']}
    fat = {a['ad']: a.get('cari') for a in sc['adimlar'] if a['islem'] in ('fatura', 'evrak')}
    f = json.load(open(os.path.join(src, s['ad'] + '.fark.json')))['farklar']
    ids = collections.Counter()
    for x in f:
        parts = x['anahtar'].split(':')[1:]
        tok = None
        for p in parts:
            if re.fullmatch(r's\d+\w*', p) or p in fat:
                tok = p
                break
        if tok is None:
            tok = ':'.join(parts[:2])
        c = cari.get(tok) or fat.get(tok) or ('E' if ':E' in x['anahtar'] else '?')
        ids[f'{c}/{tok}'] += 1
    print(s['ad'], s['fark'], dict(sorted(ids.items(), key=lambda t: -t[1])))
