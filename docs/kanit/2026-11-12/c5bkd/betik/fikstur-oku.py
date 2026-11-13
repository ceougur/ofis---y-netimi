import json, re, sys
root = sys.argv[1]
d = json.load(open(root + '/test/fixtures/tyk-fark-v249/uretim.json'))
caris = [k[5:] for k in d['log'] if k.startswith('cari ')]
print(len(caris), 'cari:', ' | '.join(caris))
bad = {k: v for k, v in d['log'].items() if v != 200}
print('200 olmayan adım:', json.dumps(bad, ensure_ascii=False)[:900])
b = json.load(open(root + '/test/fixtures/tyk-fark-v249/beklenen-farklar.json'))
if isinstance(b, dict):
    print('beklenen-farklar anahtarları:', list(b.keys())[:12])
    for k, v in list(b.items())[:3]:
        print(k, json.dumps(v, ensure_ascii=False)[:500])
src = open(root + '/test/fixtures/tyk-fark-v249/uret.mjs.txt', encoding='utf-8').read()
for word in ['period-lock', 'cheque', 'çek', 'bounce', 'karşılıksız', 'doubtful', 'şüpheli', 'purchase', 'supplier', 'import', 'transfer', 'trash', 'restore', 'status: "closed"', 'opening', 'isOpening', 'expectedDate', 'dueDate', 'refundOf', 'sale_return', 'reason: "return"', 'preturn', 'offset', 'mahsup', 'bulk-plan', 'itemId', 'kind: "out"', 'kind: "credit"']:
    print(f'{word!r}: {src.count(word)}', end=' · ')
print()
