#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Cari kâhininin mutasyon taraması — kos.mjs'in mutasyon kümesiyle AYNI düzen (bütün elle senaryolar; /3 → 2.5.0 + 2.4.9 + 2.4.6 + 2.4.5; 2.4.5 kararıyla
geçersiz /1 /2 → 2.4.4; öbür /1 /2 → 2.5.0 + 2.4.4), yalnız model.py --mutasyon-tara (program AÇILMAZ).

  python3 -I mutasyon-tara.py <cari klasörü> <geçici liste.json yolu>
Çıktı: her mutant için YAKALANDI (ilk 3 dosya[kip]) / YAKALANMADI; TAP sayıları; çıkış 0 yalnız hepsi yakalandıysa."""
import importlib.util
import json
import os
import subprocess
import sys


def main(argv):
    d, liste_yolu = os.path.abspath(argv[1]), argv[2]
    spec = importlib.util.spec_from_file_location("kahin_cari_tara", os.path.join(d, "model.py"))
    M = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(M)
    sd = os.path.join(d, "senaryolar")
    liste = []
    for f in sorted(os.listdir(sd)):
        if not f.endswith(".json"):
            continue
        p = os.path.join(sd, f)
        with open(p, encoding="utf-8") as g:
            sen = json.load(g)
        if M.gecersiz_245(sen):
            kip = ["2.4.4"]
        elif sen.get("dil") == M.DIL:
            kip = ["2.5.0", "2.4.9", "2.4.6", "2.4.5"]
        else:
            kip = ["2.5.0", "2.4.4"]
        liste.append({"dosya": p, "kipler": kip})
    with open(liste_yolu, "w", encoding="utf-8") as g:
        json.dump(liste, g)
    r = subprocess.run([sys.executable, "-I", os.path.join(d, "model.py"), "-", "--mutasyon-tara", liste_yolu], capture_output=True, check=True)
    tarama = json.loads(r.stdout)
    gecen, kalan = 0, 0
    for n, ad in M.MUTASYONLAR.items():
        y = tarama[str(n)]["yakalayan"]
        if y:
            gecen += 1
        else:
            kalan += 1
        print("  mutasyon %d (%s): %s" % (n, ad, ("YAKALANDI (%s)" % ", ".join("%s[%s]" % (os.path.basename(x["dosya"])[:-5], x["kip"]) for x in y)) if y else "YAKALANMADI"))
    print("%d senaryo dosyası, %d mutant" % (len(liste), len(M.MUTASYONLAR)))
    print("# tests %d" % (gecen + kalan))
    print("# pass %d" % gecen)
    print("# fail %d" % kalan)
    print("%d/%d mutant yakalandı" % (gecen, gecen + kalan))
    return 0 if kalan == 0 else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
