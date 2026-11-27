# Kural Farkı Düzeltme mutasyon betiğinin M3'ü ("alt defter hesabı farkı fişe girer") mut kopyasında; yeni [8] vakası öldürüyor mu (ders 7, 38).
import subprocess
Q = "/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5a2d-q"
p = Q + "/mut/server/lib/ledger-opening.mjs"
src = open(p, encoding="utf-8").read()
a, b = "const owned = account => subledger.has(account);", "const owned = () => false;"
assert src.count(a) == 1
open(p, "w", encoding="utf-8").write(src.replace(a, b))
try:
    print(subprocess.run(["bash", Q + "/betik/kos.sh", "kfd-M3", "test/kural-farki-duzeltme-250.test.mjs"], capture_output=True, text=True, timeout=1500).stdout)
finally:
    open(p, "w", encoding="utf-8").write(src)
