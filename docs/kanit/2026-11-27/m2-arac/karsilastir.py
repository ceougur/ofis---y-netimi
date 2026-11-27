import json, sys
d62 = json.load(open(sys.argv[1], encoding='utf-8'))
res = json.load(open(sys.argv[2], encoding='utf-8'))
exp = d62['elleBeklenen']
yok = set(d62['elleYok'])
fark = 0; tutan = 0
for k, v in sorted(exp.items()):
    parts = k.split(':')
    if parts[0] == 'adim':
        sid, what = parts[1], parts[2]
        if sid not in res['steps']:
            continue
        s = res['steps'][sid]
        got = ('ok' if s['status'] == 200 else 'ret') if what == 'durum' else (s['code'] if s['status'] != 200 else '')
    elif parts[0] == 'k1' and parts[1] == 'cari':
        name = parts[2]
        if name not in res['balances']:
            continue
        got = round(res['balances'][name] * 100)
    else:
        continue
    if str(got) != str(v):
        fark += 1
        print('FARK', k, 'beklenen', v, 'program', got, res['steps'].get(parts[1], {}).get('message', '') if parts[0] == 'adim' else '')
    else:
        tutan += 1
print('tutan', tutan, 'fark', fark)
for sid, s in sorted(res['steps'].items()):
    if not any(k.startswith(f'adim:{sid}:') for k in exp):
        print('KAHINDE YOK', sid, s['status'], s['code'], s['message'][:200])
for n, b in sorted(res['balances'].items()):
    if f'k1:cari:{n}:bakiye' not in exp:
        print('BAKIYE (kâhinde yok)', n, b)
print('integrity', res.get('integrity'))
