"""Güvenli kapanış dallarını sayan yamalı AYRI kopya (ürün dosyasına dokunmaz): sınır 12'ye iner, "şimdi" / "gelecek" dalları sayılır. Kullanım: gelecek-kur.py <kod kökü> <hedef>"""
import os, shutil, sys

root, target = sys.argv[1], sys.argv[2]
os.makedirs(f"{target}/server/lib", exist_ok=True)
for name in ("money.mjs", "invoice-settle.mjs", "plans.mjs"):
    shutil.copy(f"{root}/server/lib/{name}", f"{target}/server/lib/{name}")
src = open(f"{root}/server/lib/obligation-queue.mjs", encoding="utf-8").read()
pairs = [
    ("const PREPAID_MAX_PASSES = 400;", "const PREPAID_MAX_PASSES = 12;"),
    ("        item.born = event.date;\n        arrive(item);", "        globalThis.__simdi = (globalThis.__simdi || 0) + 1;\n        item.born = event.date;\n        arrive(item);"),
    ("      events.splice(at, 0, own);", "      globalThis.__gelecek = (globalThis.__gelecek || 0) + 1;\n      events.splice(at, 0, own);"),
]
for old, new in pairs:
    assert src.count(old) == 1, (old, src.count(old))
    src = src.replace(old, new)
open(f"{target}/server/lib/obligation-queue.mjs", "w", encoding="utf-8").write(src)
open(f"{target}/package.json", "w").write('{"type":"module"}')
print("kuruldu", target)
