import json, sys, statistics
for f in sys.argv[1:]:
    d = json.load(open(f))
    L = [x[2] for x in d['locks']]
    print(f.split('/')[-1], 'yük', d['load0'], '→', d['load1'], 'koşu', d['runs'], 'kart satırı', d['cards'], 'ürün', d['items'])
    print('   kilit ms: ilk 12 aylık', L[:12], '| 48 aç/kapa ortanca', statistics.median(L[12:]), 'en çok', max(L[12:]), 'son 6', L[-6:])
    print('   kilit olay döngüsü en çok', max(x[3] for x in d['locks']))
    by = {}
    for t, k, st, ms, loop, sha in d['reads']:
        by.setdefault(k, []).append((ms, loop, sha, st))
    for k, v in by.items():
        print(f"   {k:7} ms {[x[0] for x in v]} döngü {[x[1] for x in v]} sha {sorted(set(x[2] for x in v))} durum {sorted(set(x[3] for x in v))}")
