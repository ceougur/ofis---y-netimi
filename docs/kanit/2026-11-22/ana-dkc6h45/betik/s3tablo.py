import json, sys
a = json.load(open(sys.argv[1]))
for sinif, R in a.items():
    for st in ('s1', 's2', 's3'):
        S = R.get(st)
        if not S:
            continue
        def kf(k):
            x = S['reads'][k]
            r = [r for r in x['kesinDegil'] if r['kod'] == 'kural-farki']
            return (r[0]['ayrinti'] if r else None), [i['baslik'] for i in (x.get('bilgi') or [])]
        v = S['view']
        print(sinif, st, 'cover', S['cover'], 'Yönetim', v['code'] or 'satır', [(l['account'], l.get('sub'), l['debit'] - l['credit']) for l in (v.get('lines') or [])], 'over', v.get('ownYearOver'))
        print('    bsNow', kf('bsNow'))
        print('    gt26 ', kf('gt26'))
