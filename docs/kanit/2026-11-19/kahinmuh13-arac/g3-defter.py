#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Defter kâhini bakımı 4 — G3: eski kâhin (bakım 3, `kahin-muh13-taban`) ↔ yeni kâhin, AYNI senaryo girdileriyle (yeni klasörün senaryoları), her senaryo × iki kural
(2.5.0, 2.4.9) × mutasyon 0–39 (eski kâhinin mutantları). Program AÇILMAZ.

  python3 -I g3-defter.py --eski <eski test/bagimsiz/defter> --yeni <yeni test/bagimsiz/defter>

Beklenen sınıflar: D11 — `2.5.0` kuralında YALNIZ kontrol mizanlarının 191 / 391 anahtarları (iade KDV yönü; KDV Özeti `kdv` DEĞİŞMEZ); YENI — g10 / g11 (eski kâhin
D12'yi bilmez). `2.4.9` kuralında fark 0 (bayt bayt). Başka her fark BEKLENMEYEN (0 olmalı). Son satır "N/M denetim geçti".
"""
import importlib.util
import json
import os
import sys


def arg(ad):
    return sys.argv[sys.argv.index(ad) + 1]


def yukle(kok, ad):
    sp = importlib.util.spec_from_file_location(ad, os.path.join(kok, "kahin.py"))
    m = importlib.util.module_from_spec(sp)
    sp.loader.exec_module(m)
    return m


ESKI, YENI = arg("--eski"), arg("--yeni")
KE, KY = yukle(ESKI, "kahin_eski"), yukle(YENI, "kahin_yeni")
YENI_SEN = {"g10-a2-gecis-gunu-kilitli.json", "g11-a2-gecis-kilitsiz-gocte-mahsup.json"}


def duz(x, yol=""):
    if isinstance(x, dict):
        out = {}
        for k, v in x.items():
            out.update(duz(v, f"{yol}/{k}" if yol else str(k)))
        return out
    if isinstance(x, list):
        return {yol: json.dumps(x, ensure_ascii=False)}
    return {yol: x}


def kos(K, sen, mut, kural):
    try:
        o = K.hesapla(sen, None, mut, kural)
        o.pop("mutasyon", None)
        return duz(o)
    except SystemExit as e:
        return {"__cokme__": str(e)}


dosyalar = [os.path.join(YENI, "senaryo.json")] + [os.path.join(YENI, "senaryolar", f) for f in sorted(os.listdir(os.path.join(YENI, "senaryolar"))) if f.endswith(".json")]
toplam, bek, sinif = 0, 0, {}
for p in dosyalar:
    ad = os.path.basename(p)
    sen = json.load(open(p, encoding="utf-8"))
    for kural in ("2.5.0", "2.4.9"):
        for mut in range(0, 40):
            e, y = kos(KE, sen, mut, kural), kos(KY, sen, mut, kural)
            toplam += 1
            if e == y:
                continue
            fark = sorted(k for k in set(e) | set(y) if e.get(k) != y.get(k))
            if ad in YENI_SEN:
                c = "YENI"
            elif kural == "2.5.0" and all(k.startswith("kontroller/") and k.split("/")[-1] in ("191", "391") for k in fark):
                c = "D11-191-391"
            else:
                c = "BEKLENMEYEN"
            sinif[c] = sinif.get(c, 0) + 1
            if mut == 0 or c == "BEKLENMEYEN":
                print(f"{ad} {kural} mut {mut}: {c} — {len(fark)} anahtar: " + "; ".join(f"{k} {e.get(k, '∅')} → {y.get(k, '∅')}" for k in fark[:12]))
            if c == "BEKLENMEYEN":
                bek += 1
print("sınıflar:", json.dumps(sinif, ensure_ascii=False, sort_keys=True))
print(f"# tests {toplam}\n# pass {toplam - bek}\n# fail {bek}")
print(f"{toplam - bek}/{toplam} denetim geçti")
sys.exit(1 if bek else 0)
