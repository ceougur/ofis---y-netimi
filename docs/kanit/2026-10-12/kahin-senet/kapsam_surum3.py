#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Sürüm 3 (evrak) kapsam sayacı: bir koşunun senaryosunda ve üç tarafın ham çıktısında evrak işlemleri ve evrak hesapları
gerçekten var mı ve karşılaştırıldı mı. Beklenen değer üretmez; yalnız sayar.

Kullanım (depo kökünden):  python3 docs/kanit/2026-10-12/kahin-senet/kapsam_surum3.py <senaryo adı> [...]
Dosyalar: test/bagimsiz/cikti/senaryolar/<ad>.json (ya da senaryolar/<ad>.json), test/bagimsiz/cikti/ham/<ad>.{a,b,program}.json
"""
import collections
import json
import os
import sys

KOK = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", ".."))
BAG = os.path.join(KOK, "test", "bagimsiz")
EVRAK = ("evrak_al", "evrak_ver", "evrak_ciro", "evrak_tahsil", "evrak_odeme", "evrak_karsiliksiz", "tahsile_ver",
         "bankadan_geri_al", "evrak_sil")
HESAP = ("101.01", "101.02", "121.01", "121.02", "103", "321")


def oku(yol):
    with open(yol, encoding="utf-8") as fh:
        return json.load(fh)


def senaryo(ad):
    for y in (os.path.join(BAG, "cikti", "senaryolar", ad + ".json"), os.path.join(BAG, "senaryolar", ad + ".json")):
        if os.path.exists(y):
            return oku(y)
    for kok, _d, dosyalar in os.walk(os.path.join(BAG, "senaryolar")):
        if ad + ".json" in dosyalar:
            return oku(os.path.join(kok, ad + ".json"))
    raise SystemExit("senaryo yok: " + ad)


def main(adlar):
    for ad in adlar:
        s = senaryo(ad)
        ham = {k: oku(os.path.join(BAG, "cikti", "ham", "%s.%s.json" % (ad, k))) for k in ("a", "program")}
        a = ham["a"]["alternatifler"][0] if "alternatifler" in ham["a"] else ham["a"]
        p = ham["program"]
        evrak_adim = {x["id"]: x["islem"] for x in s["adimlar"] if x["islem"] in EVRAK}
        tur = collections.Counter(evrak_adim.values())
        ret_a = {r["adim"]: (r["durum"], r["kod"]) for r in a["retler"] if r["adim"] in evrak_adim}
        ret_p = {r["adim"]: (r["durum"], r["kod"]) for r in p["retler"] if r["adim"] in evrak_adim}
        kodlar = collections.Counter("%s %s→%s %s" % (evrak_adim[i], ret_a[i][0], ret_p.get(i, ("YOK",))[0],
                                                      ret_p.get(i, (None, None))[1]) for i in ret_a)
        yaprak = 0
        sifir_disi = 0
        durumlar = [a] + list(a["araDurumlar"].values())
        for d in durumlar:
            for h in HESAP:
                if h in d["mizan"]:
                    yaprak += 2
                    if d["mizan"][h]["borc"] or d["mizan"][h]["alacak"]:
                        sifir_disi += 1
        atlananlar = [x for x in p["atlananlar"] if x in evrak_adim]
        bel27 = sum(1 for b in a.get("belirsizler", []) if "BELİRSİZ-27" in b["neden"])
        print("%s: evrak adımı %d %s" % (ad, len(evrak_adim), dict(sorted(tur.items()))))
        print("  evrak reti kâhin %d, program %d; aynı adımlar: %s" % (len(ret_a), len(ret_p), sorted(ret_a) == sorted(ret_p)))
        for k, n in sorted(kodlar.items()):
            print("    %-60s %d" % (k, n))
        print("  evrak hesabı yaprağı (101.01/101.02/121.01/121.02/103/321; son durum + %d kontrol): %d, sıfırdan farklı bakiye: %d"
              % (len(a["araDurumlar"]), yaprak, sifir_disi))
        print("  atlanan evrak adımı: %d · BELİRSİZ-27 yolu (kâhin a): %d · program okuma hatası %d · eşlenemeyen %d"
              % (len(atlananlar), bel27, len(p.get("okumaHatalari", [])), len(p.get("eslenemeyenler", []))))


if __name__ == "__main__":
    main(sys.argv[1:])
