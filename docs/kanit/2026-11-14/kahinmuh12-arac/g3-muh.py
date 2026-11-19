#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Muhasebe kâhini bakımı 12 — G3: eski kâhinin (bakım 11, `kahin-muh12-taban`) senaryo + beklenen dosyaları ↔ yeni kâhinin dosyaları, anahtar anahtar.
Program AÇILMAZ; yalnız iki kopyanın `senaryolar/` klasörleri okunur.

  python3 -I g3-muh.py --eski <eski test/bagimsiz/muhasebe> --yeni <yeni test/bagimsiz/muhasebe> [--dokum <json>]

Sınıflar (girdinin maddeleri): A1 (KG-19 = C: 108.90 / banka / yoldaki), A3 (K-14 / K-15 sınırı), A5 (S127 değişmezi — yeni `s127_tek_yazim` anahtarı),
A6 (S181 / S168: s74 senaryo değişikliği, `susmalar`), YENİ (s110–s113), BEKLENMEYEN (0 olmalı). Son satır "N/M denetim geçti" (tools/kanit.mjs).
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


YENI_SEN = {"s110-s179-hesapsiz-sinir-en-gec-acilis", "s111-s174-s180-kural-farki-kendi-yilinda", "s112-s181-bagli-tahsilat-120-siniri", "s113-s87-r8-geri-alma"}
A1 = re.compile(r"108\.90|102\.B|yoldaki|banka:B|/102/|/102$|transfer")


def sinif(ad, k):
    if ad in YENI_SEN:
        return "YENI"
    if "s127_tek_yazim" in k:
        return "A5"
    if "susmalar" in k:
        return "A6-S168"
    if ad == "s74-s25-ab-kismi-ve-fazla":
        return "A6-S181"
    if ad in ("s12-banka-islemleri", "s27-devir-yoldaki-supheli-evrak-taksit") or ad.startswith("rastgele-"):
        return "A1"
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
                dokum.append({"dosya": alt or "senaryo", "senaryo": ad, "sinif": "BEKLENMEYEN", "anahtar": "(dosya kalktı)"})
                sayac["BEKLENMEYEN"] = sayac.get("BEKLENMEYEN", 0) + 1
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
