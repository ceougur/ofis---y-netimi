import json, sys
a = json.load(open(sys.argv[1]))
b = json.load(open(sys.argv[2])) if len(sys.argv) > 2 else None
for sinif, R in a.items():
    print('#####', sinif, {k: R.get(k) for k in ('note', 'post', 'lock0930', 'lock1231', 'error') if R.get(k) is not None})
    for st in ('s0', 's1', 's2', 's3'):
        if st not in R:
            continue
        S = R[st]
        v = S['view']
        print(' ', st, 'cover', S['cover'], 'view', v['code'], 'lines', [(l['account'], l.get('sub'), l['debit'], l['credit']) for l in (v.get('lines') or [])], 'excl', len(v.get('excluded') or []), 'over', v.get('ownYearOver'))
        for k, x in S['reads'].items():
            kf = [r for r in x.get('kesinDegil', []) if r['kod'] == 'kural-farki']
            info = (kf[0]['ayrinti'] if kf else None)
            line = f"    {k}: fark={x.get('fark')} kar={x.get('kar')} kural={info} bilgi={[i['baslik'] for i in (x.get('bilgi') or [])]}"
            if b is not None:
                other = b.get(sinif, {}).get(st, {}).get('reads', {}).get(k)
                line += '  ESIT' if other and other['full'] == x['full'] else '  FARKLI'
            print(line[:400])
