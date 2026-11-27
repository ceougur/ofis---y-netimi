# Senaryo × cari × adım: farkın ilk göründüğü kontrol ve örnek anahtar (kâhine dokunmaz).
import json, os, sys, re
src = sys.argv[1]
oz = json.load(open(os.path.join(src, 'ozet.json')))
for s in oz['ozet']:
    if not s['fark']:
        continue
    sc = json.load(open(os.path.join(src, s['ad'] + '.json')))
    kidx = [a['id'] for a in sc['adimlar'] if a['islem'] == 'kontrol']
    cari = {a['id']: a.get('cari') for a in sc['adimlar']}
    fat = {a['ad']: a.get('cari') for a in sc['adimlar'] if a['islem'] in ('fatura', 'evrak')}
    f = json.load(open(os.path.join(src, s['ad'] + '.fark.json')))['farklar']
    ilk = {}
    for x in f:
        k0, *parts = x['anahtar'].split(':')
        tok = next((p for p in parts if re.fullmatch(r's\d+\w*', p) or p in fat), None)
        if tok is None and 'acilis' in parts:
            tok = 'acilis:' + parts[parts.index('acilis') + 1]
        if tok is None:
            continue
        c = cari.get(tok) or fat.get(tok) or tok.split(':')[-1]
        key = (c, tok)
        pos = kidx.index(k0) if k0 in kidx else -1
        if key not in ilk or pos < ilk[key][0]:
            ilk[key] = (pos, k0, x['anahtar'], x.get('sinif246', '')[:6])
    for (c, tok), (pos, k0, ank, sn) in sorted(ilk.items(), key=lambda t: (t[0][0], t[1][0])):
        print(s['ad'], c, tok, k0, ank, sn)
