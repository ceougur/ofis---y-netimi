#!/usr/bin/env python3
# test/obligation-input-250.test.mjs: kurguyu tarihe göre TEK kuyrukta koşan biçime çevirir (fatura kronolojisi). Kullanım: python3 -I kurgu-sira.py <test dosyası> <yeni gövde dosyası>
import sys
p, body = sys.argv[1], sys.argv[2]
s = open(p, encoding='utf-8').read()
a = s.index('    const out = {};\n    // bağsız / bağlı tahsilat')
b = s.index('    return out;\n  }\n  const lock =')
s = s[:a] + open(body, encoding='utf-8').read() + s[b:]
open(p, 'w', encoding='utf-8').write(s)
print('tamam')
