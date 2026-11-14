import json, sys
a = [json.loads(l) for l in open(sys.argv[1], encoding='utf-8') if l.strip()]
b = [json.loads(l) for l in open(sys.argv[2], encoding='utf-8') if l.strip()]
print('satır', len(a), len(b))
def diff(x, y, p, out):
    if type(x) != type(y): out.append((p, str(x)[:120], str(y)[:120])); return
    if isinstance(x, dict):
        for k in sorted(set(x) | set(y)): diff(x.get(k, '[yok]'), y.get(k, '[yok]'), p + '.' + k, out)
    elif isinstance(x, list):
        if len(x) != len(y): out.append((p + '[len]', len(x), len(y)))
        for i, (u, v) in enumerate(zip(x, y)): diff(u, v, f'{p}[{i}]', out)
    elif x != y: out.append((p, str(x)[:120], str(y)[:120]))
n = 0
for x, y in zip(a, b):
    if x == y: continue
    n += 1
    out = []
    diff(x, y, '', out)
    print('CARİ', x.get('sirket'), x.get('cari'), 'alan farkı', len(out))
    for row in out[:12]: print('   ', row)
print('farklı satır', n)
