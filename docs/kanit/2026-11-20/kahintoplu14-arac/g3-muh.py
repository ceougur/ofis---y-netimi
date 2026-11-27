#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Muhasebe kâhini bakımı 14 (toplu kâhin bakımı 14) — G3: eski kâhinin (bakım 13, `kahin-toplu14-taban`) senaryo + beklenen dosyaları ↔ yeni kâhinin dosyaları, anahtar anahtar.
Bakım 13 aracının (`docs/kanit/2026-11-19/kahinmuh13-arac/g3-muh.py`) uyarlaması — sınıflar bu bakımın girdi maddeleri. Program AÇILMAZ; yalnız iki kopyanın `senaryolar/` klasörleri okunur.

  python3 -I g3-muh.py --eski <eski test/bagimsiz/muhasebe> --yeni <yeni test/bagimsiz/muhasebe> [--dokum <json>]

Sınıflar: A2-S210-S211 (s58 — C2'nin kartı kapanır), YENI (s118–s121), BEKLENMEYEN (0 olmalı). Son satır "N/M denetim geçti" (tools/kanit.mjs).
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


YENI_SEN = {"s118-a1-s200-elle-once-sonra-fatura", "s119-a2-s210-s211-kart-kapanir", "s120-a3-s213-acik-faturalar-supheli", "s121-a5-s220-kart-kapat-onceden-gecikmis"}
SENARYO_SINIFI = {"s58-r9-kartli-fatura-sil-iptal": "A2-S210-S211"}


def sinif(ad, k):
    if ad in YENI_SEN:
        return "YENI"
    if ad in SENARYO_SINIFI:
        return SENARYO_SINIFI[ad]
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
                c = "BEKLENMEYEN"
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
