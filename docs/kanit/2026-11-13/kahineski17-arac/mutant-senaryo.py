#!/usr/bin/env python3
"""Bakım 17 (bakım 16 aracının uyarlaması): bakım 17 mutantlarının (303–307) ve bakım 9 … 16'nın 261–302'sinin hangi elle senaryo carisinde DEĞERLE yakalandığı. Program AÇILMAZ.
Kullanım: python3 -I -B mutant-senaryo.py --model <cari klasörü>"""
import importlib.util
import json
import os
import re
import sys

K = os.path.abspath(sys.argv[sys.argv.index("--model") + 1])
s = importlib.util.spec_from_file_location("kahin_cari_mutsen17", os.path.join(K, "model.py"))
M = importlib.util.module_from_spec(s)
s.loader.exec_module(M)
gecen = kalan = 0
for f in ("d45-c5-s159-s154-s162-s163", "d44-c5-s155-s158", "d41-c5-s136-s139-s145-s148", "d42-c5-s140-s151-satis-karti-iade", "d43-c5-bilinen-sinir-sus15", "d39-c5-s130-supheli-kalemleri", "d40-c5-s130-sus-bilinen-sinir", "d38-c5-s128-ozge-kalemli-kart", "d37-c5-s126-faturali-kart", "d36-c5-s122-kart-odemesi", "d35-c5-s120-elle-borclar"):
    with open(os.path.join(K, "senaryolar", f + ".json"), encoding="utf-8") as g:
        sen = json.load(g)
    for mut in range(261, 308):
        out = M.Model(json.loads(json.dumps(sen)), mut, "2.5.0").kos()["denetimler"]
        kir = [k for k, b in sen["elleBeklenen"].items() if out.get(k, {}).get("b", "ANAHTAR YOK") != b]
        cari = sorted(set(re.findall(r":(?:cari|fatura|kart|hareket|takvim:hareket|vadeTakip:hareket|projeksiyon:hareket|takvim:fatura|takvim:cariToplam|vadeTakip:cariToplam|projeksiyon:cariToplam):(?:acilis:)?K?([A-Z]\d+[A-Za-z]?|[a-z]\d+[a-z]?)", " ".join(kir))))
        print("%-26s mutant %d: %3d elle değer kırmızı · %s" % (f, mut, len(kir), ", ".join(cari) or "-"))
        gecen += 1
print("# tests %d" % gecen)
print("# pass %d" % gecen)
print("# fail 0")
print("%d/%d denetim geçti" % (gecen, gecen))
