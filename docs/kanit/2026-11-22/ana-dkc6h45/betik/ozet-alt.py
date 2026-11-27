import json, sys
a = json.load(open(sys.argv[1]))
b = json.load(open(sys.argv[2]))
print('error', a.get('error'), b.get('error'), 'post', a.get('post'))
print('Yönetim', a['view']['code'], [(l['account'], l.get('sub'), l['debit'] - l['credit']) for l in a['view']['lines']], 'excluded', [(e['account'], e.get('sub'), e.get('party'), e['minor']) for e in a['view']['excluded']])
for k in ('bsNow', 'bs0801', 'gt26', 'gt26b'):
    print(k, 'kural', a[k]['kural'], 'bilgi', a[k]['bilgi'], 'fark', a[k].get('fark'), 'yeni=t4' if a[k]['full'] == b[k]['full'] else 'yeni≠t4')
print('KALAN gerçek küme', a.get('remainderReal'))
print('KALAN BOŞ küme (mutant)', a.get('remainderEmpty'))
