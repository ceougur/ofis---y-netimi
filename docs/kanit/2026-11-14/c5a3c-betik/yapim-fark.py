import json
K = '/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5a3c-k7/'
a = json.load(open(K + 'taban-yapim.json'))
b = json.load(open(K + 'yeni-yapim.json'))
print('alanlar', list(b['kayitlar'][0].keys()) if b['kayitlar'] else '[]')
def k(r):
    return json.dumps({x: r.get(x) for x in r if x not in ('program', 'kahin', 'deger', 'paket', 'not', 'neden')}, ensure_ascii=False, sort_keys=True)
ka = {k(r): r for r in a['kayitlar']}
kb = {k(r): r for r in b['kayitlar']}
print('taban', len(ka), 'yeni', len(kb))
for x in kb:
    if x not in ka: print('YENİ', json.dumps(kb[x], ensure_ascii=False)[:400])
for x in ka:
    if x not in kb: print('KAPANAN', json.dumps(ka[x], ensure_ascii=False)[:400])
for x in ka:
    if x in kb and ka[x] != kb[x]: print('DEĞİŞEN', json.dumps(ka[x], ensure_ascii=False)[:300], '→', json.dumps(kb[x], ensure_ascii=False)[:300])
