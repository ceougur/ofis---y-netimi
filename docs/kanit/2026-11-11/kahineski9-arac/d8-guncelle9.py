#!/usr/bin/env python3
"""Bakım 9: d8-c5-tanimsiz'in A carisi S120 alanına girer (KARARLAR.md §21 Y9-3 / Y9-7) — elle Mevcut Borç kartı KA 1.200, açık borç 1.500 (Açılış 1.000 + Borç 500, ikisi de elle kayıt,
fatura yok), kart tutarı hiçbir elle kayda eşit değil ⇒ kart elle borçları eskiden yeniye içine alır: Açılış 1.000 + Borç'un 200'ü; Borç 300 açık. Kartın ödeneni 0 → her kalemin Kalan'ı
tanımlı (Y9-7). Bakım 8'de SK-19 ile, bakım 7'ye kadar "birden çok kalemi tüketti" ile susuyordu. Adımlar DEĞİŞMEZ; B carisi (taksitli faturanın iadesi) AYNEN susar.
Değerler ELLE (bugün 15.06.2026; kart taksitleri 01.06 / 01.07 × 600): Açılış Kalan 1.000 (0 + 1.000), Borç Kalan 500 (300 + 200), kart ödenen 0, gecikmiş = Borç 300 (02.05) + 1. taksit 600 = 900.
Kullanım: python3 -I d8-guncelle9.py <d8 dosyası>"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bicim  # noqa: E402

p = sys.argv[1]
with open(p, encoding="utf-8") as f:
    s = json.load(f)
ESKI_YOK = ["k1:hareket:b1:kalan", "k1:hareket:acilis:A:kalan", "k1:kart:KA:odenen", "k1:cari:A:gecikmis"]
assert all(k in s["elleYok"] for k in ESKI_YOK), "d8 bakım 8 hâlinde değil"
s["elleYok"] = [k for k in s["elleYok"] if k not in ESKI_YOK]
s["elleBeklenen"].update({"k1:hareket:acilis:A:kalan": 100000, "k1:hareket:b1:kalan": 50000, "k1:kart:KA:odenen": 0, "k1:cari:A:gecikmis": 90000})
s["aciklama"] = s["aciklama"].replace(
    "A — 'Carinin Mevcut Borcu' kartı (1.200) iki kalemi tüketir (Açılış 1.000 + Borç 200 / 500): kart ödeneninin kalemlere dağılımı kararda yok → Kalan / kart ödeneni denetlenmez; bakiye ve kart"
    " tutarı denetlenir.",
    "A — 'Carinin Mevcut Borcu' kartı (1.200) iki elle kalemi içine alır (Açılış 1.000 + Borç 200 / 500) — bakım 9 (§21, S120 A): yalnız elle borçlar eskiden yeniye; kartın ödeneni 0 iken"
    " Kalan'lar tanımlı (Y9-7) → Kalan, kart ödeneni, gecikmiş denetlenir (önceden tanımsızdı).")
assert "bakım 9" in s["aciklama"], "açıklama metni beklenen biçimde değil"
s["dayanak"] = s["dayanak"] + "; §21 Y9-3 / Y9-7 (A — bakım 9)"
bicim.yaz(p, s)
print("d8: A'nın %d elleYok kaydı kalktı, 4 elle değer eklendi" % len(ESKI_YOK))
