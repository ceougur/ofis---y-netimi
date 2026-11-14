import json, glob, os
K = '/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5a3c-k7/'
def load(side):
    out = {}
    for f in glob.glob(K + 'surucu-%s/*/*.fark.json' % side):
        tz = f.split('/')[-2]; sc = os.path.basename(f)[:-10]
        d = json.load(open(f))
        out[(sc, tz)] = d.get('ozet', {})
    return out
a = load('taban'); b = load('yeni')
tot = {}
for k in sorted(set(a) | set(b)):
    ca = a.get(k, {}); cb = b.get(k, {})
    if ca != cb: print(k, 'TABAN', {x: ca.get(x) for x in ('AYNI', 'U', 'P', 'K', 'R', 'SINIFLANMADI')}, '→ YENİ', {x: cb.get(x) for x in ('AYNI', 'U', 'P', 'K', 'R', 'SINIFLANMADI')})
for side, m in (('taban', a), ('yeni', b)):
    s = {}
    for v in m.values():
        for x in ('AYNI', 'U', 'P', 'K', 'R', 'SINIFLANMADI', 'OLCULEMEDI'): s[x] = s.get(x, 0) + (v.get(x) or 0)
    print(side, s)
