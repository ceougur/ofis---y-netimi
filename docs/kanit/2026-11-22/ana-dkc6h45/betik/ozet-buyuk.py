import json, sys
a = json.load(open(sys.argv[1]))  # eski
b = json.load(open(sys.argv[2]))  # yeni
print('yük', a['load0'], '→', a['load1'], '|', b['load0'], '→', b['load1'])
print('açılış ms eski', a['openMs'], 'yeni', b['openMs'])
for k in ('lock1231', 'lock0630'):
    print(k, 'eski', a[k], '| yeni', b[k])
print('kartlar eski', a['cards'], '| yeni', b['cards'])
print('koşular eski', a['runs'], '| yeni', b['runs'])
for st in a['stages']:
    for k, x in a['stages'][st].items():
        y = b['stages'][st][k]
        same = 'AYNI' if x['sha'] == y['sha'] else 'FARKLI'
        print(f"{st:9} {k:9} {same:6} ms {x['ms']:>6} → {y['ms']:>6}  döngü {x['loopMax']:>4} → {y['loopMax']:>4}  kd {y.get('kesinDegil')} fark {y.get('fark')} kar {y.get('kar')} dss {y.get('dss')} bilgi {y.get('bilgi')}")
