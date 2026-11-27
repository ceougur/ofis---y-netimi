import json
N = '/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/dk-c5bkap-x7/kanit/'
v = json.load(open(N + 'goc-v249.json')); o = json.load(open(N + 'goc-once.json')); y = json.load(open(N + 'goc-yeni.json'))
print('üretim:', {k: v[k] for k in v if k.startswith('g')}, 'mutabakat', v.get('mutabakat'), o.get('mutabakat'), y.get('mutabakat'))
for name in [k for k in v if k.startswith('G')]:
    print('==', name)
    for lab, d in (('v2.4.9', v), ('önce  ', o), ('yeni  ', y)):
        x = d[name]
        print('  ', lab, 'bakiye', x.get('bakiye'), '| gecikmişBorç', x.get('gecikmisBorc'), '| gecikenTaksit', x.get('gecikenTaksit'), '| liste', x.get('listeGecikmis'), '| VT gecikmiş', x.get('vadeGecikmisIn'))
        print('        VT', x.get('vadeTakip'), 'zil', x.get('zil'))
        print('        kalan', x.get('kalan'), 'kart', [(p['durum'], p['tutar'], p['kendiKalan'], p['kuyrukKalan'], p['taksit']) for p in x.get('kartlar', [])])
