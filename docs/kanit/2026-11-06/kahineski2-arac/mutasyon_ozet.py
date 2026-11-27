#!/usr/bin/env python3
"""model.py --mutasyon-tara çıktısını TAP benzeri sayılara çevirir: python3 -I mutasyon_ozet.py <cari_klasoru> <liste.json>
Taban (mutasyonsuz) koşusu her dosya × kipte çökmeden geçmeli (kos.mjs düzeni); her mutant en az bir (dosya, kip)'te yakalanmalı."""
import json
import os
import subprocess
import sys

r = subprocess.run([sys.executable, "-I", os.path.join(sys.argv[1], "model.py"), "-", "--mutasyon-tara", sys.argv[2]], capture_output=True, text=True)
if r.returncode != 0:
    print(r.stderr[-2000:])
    print("# tests 1\n# pass 0\n# fail 1")
    sys.exit(1)
out = json.loads(r.stdout)
kacan = [n for n, v in out.items() if not v["yakalayan"]]
for n, v in sorted(out.items(), key=lambda x: int(x[0])):
    if int(n) >= 200:
        print("  mutasyon %s (%s): %s" % (n, v["ad"], ", ".join("%s[%s]" % (os.path.basename(y["dosya"]), y["kip"]) for y in v["yakalayan"]) or "YAKALANMADI"))
print("mutant %d, yakalanmayan %d%s" % (len(out), len(kacan), (": " + ",".join(kacan)) if kacan else ""))
print("# tests %d\n# pass %d\n# fail %d" % (len(out), len(out) - len(kacan), len(kacan)))
sys.exit(1 if kacan else 0)
