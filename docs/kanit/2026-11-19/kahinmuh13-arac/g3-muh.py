#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Muhasebe kâhini bakımı 13 — G3: eski kâhinin (bakım 12, `kahin-muh13-taban`) senaryo + beklenen dosyaları ↔ yeni kâhinin dosyaları, anahtar anahtar.
Program AÇILMAZ; yalnız iki kopyanın `senaryolar/` klasörleri okunur.

  python3 -I g3-muh.py --eski <eski test/bagimsiz/muhasebe> --yeni <yeni test/bagimsiz/muhasebe> [--dokum <json>]

Sınıflar (girdinin maddeleri): A5-S192-pay (rastgele tohumlar; atıf g3-atif.py), A5-S192-susma (`susmalar` anahtarı), A6-S197 (s111), A6-S198 (s62), A7-s51-S120, A7-s78-P1b, A7-s104-sira, A7-s108-S155,
A7-s93-KALKTI (s93 dosyaları), YENI (s114–s117), BEKLENMEYEN (0 olmalı). Son satır "N/M denetim geçti" (tools/kanit.mjs).
"""
import json
import os
import re
import sys


def arg(ad, v=None):
    return sys.argv[sys.argv.index(ad) + 1] if ad in sys.argv else v


ESKI, YENI, DOKUM = arg("--eski"), arg("--yeni"), arg("--dokum")


def duz(x, yol=""):
    if isinstance(x, dict):
        out = {}
        for k, v in x.items():
            out.update(duz(v, f"{yol}/{k}" if yol else str(k)))
        return out or {yol: {}}
    if isinstance(x, list):
        out = {}
        for i, v in enumerate(x):
            out.update(duz(v, f"{yol}/{i}"))
        return out or {yol: []}
    return {yol: x}


def oku(kok, alt):
    d = os.path.join(kok, "senaryolar", alt)
    return {f[:-5]: json.load(open(os.path.join(d, f), encoding="utf-8")) for f in sorted(os.listdir(d)) if f.endswith(".json")}


YENI_SEN = {"s114-a2-kural-gecis-gunu", "s115-a3-kg7-kdv-indirim-donemi", "s116-a4-s189-s190-sinir", "s117-a5-s192-tek-kuyruk-payi"}
SENARYO_SINIFI = {"s51-m1e-mevcut-borc-karti": "A7-s51-S120", "s78-s39-kart-iade-supheli": "A7-s78-P1b", "s104-s80-formdaki-pesin-cari": "A7-s104-sira",
                  "s108-s85-normal-cari-tutar-tarih": "A7-s108-S155", "s111-s174-s180-kural-farki-kendi-yilinda": "A6-S197",
                  "s62-r16-127-ters-bakiye": "A6-S198"}


def sinif(ad, k):
    if ad in YENI_SEN:
        return "YENI"
    if ad in SENARYO_SINIFI:
        return SENARYO_SINIFI[ad]
    if k.split("/")[2:3] == ["susmalar"] or "/susmalar/" in k:
        return "A5-S192-susma"
    if ad.startswith("rastgele-"):
        return "A5-S192-pay"        # atıf: g3-atif.py — S192 benimsemesi kapalıyken rastgele çıktısı eski beklenenle AYNI
    return "BEKLENMEYEN"


def main():
    sayac, dokum, toplam = {}, [], 0
    for alt in ("", "beklenen"):
        e, y = oku(ESKI, alt), oku(YENI, alt)
        for ad in sorted(set(e) | set(y)):
            if ad not in e:
                sayac["YENI"] = sayac.get("YENI", 0) + 1
                dokum.append({"dosya": alt or "senaryo", "senaryo": ad, "sinif": "YENI", "anahtar": "(yeni dosya)"})
                continue
            if ad not in y:
                c = "A7-s93-KALKTI" if ad == "s93-b14-alt-defter-kural-farki" else "BEKLENMEYEN"
                dokum.append({"dosya": alt or "senaryo", "senaryo": ad, "sinif": c, "anahtar": "(dosya kalktı)"})
                sayac[c] = sayac.get(c, 0) + 1
                continue
            de, dy = duz(e[ad]), duz(y[ad])
            for k in sorted(set(de) | set(dy)):
                toplam += 1
                if de.get(k, "∅") == dy.get(k, "∅"):
                    continue
                s = sinif(ad, k)
                sayac[s] = sayac.get(s, 0) + 1
                dokum.append({"dosya": alt or "senaryo", "senaryo": ad, "sinif": s, "anahtar": k, "eski": de.get(k, "∅"), "yeni": dy.get(k, "∅")})
    ozet = {}
    for x in dokum:
        a = (x["dosya"], x["senaryo"], x["sinif"])
        ozet[a] = ozet.get(a, 0) + 1
    for (d, s, c), n in sorted(ozet.items()):
        print(f"{d:9} {s:55} {c:12} {n}")
    print("sınıflar:", json.dumps(sayac, ensure_ascii=False, sort_keys=True))
    for x in dokum:
        if x["sinif"] == "BEKLENMEYEN":
            print("BEKLENMEYEN:", json.dumps(x, ensure_ascii=False)[:400])
    if DOKUM:
        with open(DOKUM, "w", encoding="utf-8") as f:
            json.dump(dokum, f, ensure_ascii=False, indent=1)
    bek = sayac.get("BEKLENMEYEN", 0)
    print(f"{toplam - bek}/{toplam} denetim geçti")
    return 1 if bek else 0


if __name__ == "__main__":
    sys.exit(main())
