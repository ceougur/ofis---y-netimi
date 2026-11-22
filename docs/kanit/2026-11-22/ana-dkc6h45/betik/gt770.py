import json, sys
a = json.load(open(sys.argv[1]))
sinif = sys.argv[2]
key = sys.argv[3] if len(sys.argv) > 3 else 'gt26'
for st in ('s0', 's1', 's2', 's3'):
    R = a[sinif].get(st)
    if not R:
        continue
    o = json.loads(R['reads'][key]['full'])
    rows = []
    def walk(x):
        if isinstance(x, dict):
            h = x.get('hesap')
            if isinstance(h, str) and (h.startswith('770') or h.startswith('649') or h.startswith('602') or h.startswith('671') or h.startswith('681')):
                rows.append((h, x.get('tutarMinor')))
            for v in x.values():
                walk(v)
        elif isinstance(x, list):
            for v in x:
                walk(v)
    walk(o.get('items'))
    print(st, 'cover', R['cover'], 'kar', o['subtotals'].get('donemNetKari'), 'satirlar', rows)
    print('   kesinDegil', [(r['kod'], r.get('ayrinti')) for r in o['kesinDegil']])
    print('   dipnot', [f if isinstance(f, str) else f.get('metin', f) for f in o.get('footnotes', [])][:6])
