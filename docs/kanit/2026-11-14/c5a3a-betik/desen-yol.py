#!/usr/bin/env python3
# tyk-mutasyon-250.mjs: taşınan kodu hedefleyen API mutantlarının dosya yolunu modüle çevirir (desen metni ve anlamı aynı). Kullanım: python3 -I desen-yol.py <kök>
import sys, os
p = os.path.join(sys.argv[1], 'test/tyk-mutasyon-250.mjs')
L = open(p, encoding='utf-8').read().split('\n')
ids = ['O1-API', 'O1C-a', 'O1C-b', 'O1C-d', 'D05', 'D06', 'KD5-c']
n = 0
for i, l in enumerate(L):
    for k in ids:
        if l.startswith(f'  ["{k}", '):
            assert l.count('"server/routes/invoices.mjs"') == 1, k
            L[i] = l.replace('"server/routes/invoices.mjs"', '"server/lib/obligation-input.mjs"')
            n += 1
assert n == len(ids), n
open(p, 'w', encoding='utf-8').write('\n'.join(L))
print('güncellenen', n)
