import sys
p = sys.argv[1]
s = open(p, encoding="utf-8").read()
a = r'''  [23, "modül düzeyi TEKİL örnek — iki şirketin satırları karışır (ilk kurulan şirketin store'u)", [[AL, "export function createAccountLines({ store }) {\n", "let SHARED = null;\nexport function createAccountLines({ store: own }) {\n  const store = (SHARED ||= own);\n"]]],'''
b = r'''  // M23: modül düzeyi TEKİL örnek (ilk store) denendi — program ikinci şirketi açamadı (çökme; değer iletisi değil) → yerine süreç düzeyi kart haritası belleği (çökmez, değeri karıştırır).
  [23, "kart haritası süreç düzeyinde bellekte — iki şirketin (ve iki durumun) kartları karışır", [[OI, "    return own.ledgerLinesOf(rows, entries, plans || own.ledgerPlansByAccount());", "    return own.ledgerLinesOf(rows, entries, plans || (globalThis.__kartHaritasi ||= own.ledgerPlansByAccount()));"]], /modül ≠ servis \(\d+\): [^\n]*(002|iade-sil|geri)/],'''
assert s.count(a) == 1
s = s.replace(a, b)
open(p, "w", encoding="utf-8").write(s)
print("ok")
