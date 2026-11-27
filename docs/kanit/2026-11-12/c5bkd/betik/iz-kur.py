"""Kuyruğun iz yamalı AYRI kopyasını kurar (ürün dosyasına dokunmaz). Kullanım: iz-kur.py <kod kökü> <hedef klasör> [sınır]
Hedef: <hedef>/server/lib/{obligation-queue,money,invoice-settle}.mjs — runQueue'nun ön ödemeli geçişlerinde ölçülen { advance, trim } globalThis.__iz'e yazılır."""
import os, shutil, sys

root, target = sys.argv[1], sys.argv[2]
limit = sys.argv[3] if len(sys.argv) > 3 else None
os.makedirs(f"{target}/server/lib", exist_ok=True)
for name in ("money.mjs", "invoice-settle.mjs", "plans.mjs"):
    shutil.copy(f"{root}/server/lib/{name}", f"{target}/server/lib/{name}")
src = open(f"{root}/server/lib/obligation-queue.mjs", encoding="utf-8").read()
old = "    const next = prepaidOf(state, prepaid);\n"
assert src.count(old) == 1, src.count(old)
src = src.replace(old, old + "    (globalThis.__iz ||= []).push({ mode, pass, olcum: [...(next || new Map())].map(([k, v]) => `${k.slice(-6)}:${v.advance}/${v.trim}`).join(' ') });\n")
if limit:
    a = "pass < 12;"
    assert src.count(a) == 1, "sınır metni bulunamadı (kod değişmiş olabilir)"
    src = src.replace(a, f"pass < {limit};")
open(f"{target}/server/lib/obligation-queue.mjs", "w", encoding="utf-8").write(src)
open(f"{target}/package.json", "w").write('{"type":"module"}')
print("kuruldu", target)
