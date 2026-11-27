#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""K-D G3 ek denetimi: S-1 gösterimiyle değişen her bilanço raporu (a) canlı dosyada ve bir devirden SONRA, (b) aktif, pasif toplamı ve hesaplanmış Dönem Net Kârı
eskiyle aynı, (c) V.D + V.E + V.F toplamı eskiyle aynı (yalnız özkaynak içinde yer değiştirdi) mi?

  python3 -I docs/kanit/2026-11-27/kd-g3-s1-denetim.py <döküm.json> <eski senaryolar> <yeni senaryolar>
"""
import collections
import json
import os
import sys


def main(dokum, eski_k, yeni_k):
    d = json.load(open(dokum, encoding="utf-8"))
    rap = collections.defaultdict(int)
    for x in d["eski_senaryolarda_degisen"]:
        if x["dosya"].startswith("beklenen/") and x["neden"].startswith("S-1"):
            p = x["yol"].split("/")
            rap[(x["dosya"][9:], p[1], p[3])] += 1
    sorun = 0
    for (ad, dal, r), n in sorted(rap.items()):
        s = json.load(open(os.path.join(yeni_k, ad + ".json"), encoding="utf-8"))
        i = next(j for j, o in enumerate(s["olaylar"]) if o.get("ad") == r)
        o = s["olaylar"][i]
        devir_once = any(oo["tur"] == "devir" for oo in s["olaylar"][:i])
        yb = json.load(open(os.path.join(yeni_k, "beklenen", ad + ".json"), encoding="utf-8"))["dallar"][dal]["raporlar"][r]
        eb = json.load(open(os.path.join(eski_k, "beklenen", ad + ".json"), encoding="utf-8"))["dallar"][dal]["raporlar"][r]
        oz = lambda b: sum(b["pasif"].get(k, 0) for k in ("V.D", "V.E", "V.F"))
        ok = (o.get("dosya", "canli") == "canli" and devir_once and yb["pasif_toplam"] == eb["pasif_toplam"] and yb["aktif"] == eb["aktif"]
              and yb["donem_net_kari"] == eb["donem_net_kari"] and oz(yb) == oz(eb))
        sorun += not ok
        print("TAMAM " if ok else "SORUN ", ad, dal, r, o.get("tarih"), n, "yaprak;",
              {k: (eb["pasif"].get(k, 0), yb["pasif"].get(k, 0)) for k in ("V.D", "V.E", "V.F")})
    print(f"rapor {len(rap)}, sorun {sorun}")
    print("# tests", len(rap))
    print("# pass", len(rap) - sorun)
    print("# fail", sorun)
    return 1 if sorun or not rap else 0


if __name__ == "__main__":
    sys.exit(main(*sys.argv[1:4]))
