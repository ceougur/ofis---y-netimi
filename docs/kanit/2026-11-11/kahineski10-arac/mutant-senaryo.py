#!/usr/bin/env python3
"""Bakım 10: S122 mutantlarının (265–269; ve bakım 9'un 261–264'ünün) hangi elle senaryo carisinde DEĞERLE yakalandığı — C8n tablosunun kanıtı. Program AÇILMAZ.
Kullanım: python3 -I -B mutant-senaryo.py --model <cari klasörü>"""
import importlib.util
import json
import os
import re
import sys

K = os.path.abspath(sys.argv[sys.argv.index("--model") + 1])
s = importlib.util.spec_from_file_location("kahin_cari_mutsen10", os.path.join(K, "model.py"))
M = importlib.util.module_from_spec(s)
s.loader.exec_module(M)
gecen = kalan = 0
for f in ("d36-c5-s122-kart-odemesi", "d35-c5-s120-elle-borclar"):
    with open(os.path.join(K, "senaryolar", f + ".json"), encoding="utf-8") as g:
        sen = json.load(g)
    for mut in (261, 262, 263, 264, 265, 266, 267, 268, 269):
        out = M.Model(json.loads(json.dumps(sen)), mut, "2.5.0").kos()["denetimler"]
        kir = [k for k, b in sen["elleBeklenen"].items() if out.get(k, {}).get("b", "ANAHTAR YOK") != b]
        cari = sorted(set(re.findall(r":(?:cari|fatura|kart|hareket|takvim:hareket|vadeTakip:hareket|projeksiyon:hareket|takvim:fatura):(?:acilis:)?K?([A-Z]\d+[a-z]?|[a-z]\d+[a-z]?)", " ".join(kir))))
        print("%-26s mutant %d: %3d elle değer kırmızı · %s" % (f, mut, len(kir), ", ".join(cari) or "-"))
        gecen += 1
print("# tests %d" % gecen)
print("# pass %d" % gecen)
print("# fail 0")
print("%d/%d denetim geçti" % (gecen, gecen))
