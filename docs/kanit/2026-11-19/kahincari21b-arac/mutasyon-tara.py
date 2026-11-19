#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Kâhin bakımı 7: bakım 6 aracının kopyası (kahineski6-arac/mutasyon-tara.py), kod DEĞİŞMEDİ — bakım 6 notu: Kâhin bakımı 6 (cari; bakım 5 aracının kopyası, değişmedi) — kos.mjs düzenindeki mutasyon taraması, program AÇILMADAN (kos.mjs programı içe aktardığı için bu ajan onu koşmaz).

  python3 -I mutasyon-tara.py --model <cari klasörü>

kos.mjs'in kümesi ve kipleri aynen: bütün elle senaryolar; 2.4.5 kararıyla geçersiz /1 /2 → yalnız 2.4.4; /3 → 2.5.0 + 2.4.9 + 2.4.6 + 2.4.5; öbür /1 /2 → 2.5.0 + 2.4.4.
`model.py - --mutasyon-tara <liste>` tek süreçte her mutant için ilk 3 yakalayan (dosya, kip) verir. Çıkış 0 yalnız yakalanmayan mutant yoksa. Son satır "N/M denetim geçti"."""
import json
import os
import subprocess
import sys
import tempfile

MODEL = os.path.abspath(sys.argv[sys.argv.index("--model") + 1])
py = os.path.join(MODEL, "model.py")
d = os.path.join(MODEL, "senaryolar")
liste = []
for f in sorted(os.listdir(d)):
    if not f.endswith(".json"):
        continue
    p = os.path.join(d, f)
    with open(p, encoding="utf-8") as g:
        sen = json.load(g)
    gecersiz = json.loads(subprocess.run([sys.executable, "-I", py, p, "--gecersiz-mi"], capture_output=True, check=True).stdout)
    kipler = ["2.4.4"] if gecersiz else (["2.5.0", "2.4.9", "2.4.6", "2.4.5"] if sen.get("dil") == "destekofis-cari/3" else ["2.5.0", "2.4.4"])
    liste.append({"dosya": p, "kipler": kipler})
with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8") as t:
    json.dump(liste, t)
tarama = json.loads(subprocess.run([sys.executable, "-I", py, "-", "--mutasyon-tara", t.name], capture_output=True, check=True).stdout)
os.unlink(t.name)
gecen = kalan = 0
for n, x in tarama.items():
    yak = ["%s%s" % (os.path.basename(y["dosya"])[:-5], "" if y["kip"] == "2.5.0" else "[%s]" % y["kip"]) for y in x["yakalayan"]]
    if yak:
        gecen += 1
    else:
        kalan += 1
    print("  mutasyon %s (%s): %s" % (n, x["ad"], "YAKALANDI (%s)" % ", ".join(yak) if yak else "YAKALANMADI"))
toplam = gecen + kalan
print("MUTASYON TARAMASI (kos.mjs düzeni; %d elle senaryo × kipler): %d/%d mutant yakalandı" % (len(liste), gecen, toplam))
print("# tests %d" % toplam)
print("# pass %d" % gecen)
print("# fail %d" % kalan)
print("%d/%d denetim geçti" % (gecen, toplam))
sys.exit(0 if kalan == 0 else 1)
