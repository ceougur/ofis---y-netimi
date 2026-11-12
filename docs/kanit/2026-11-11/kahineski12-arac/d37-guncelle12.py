#!/usr/bin/env python3
"""Bakım 12: d37-c5-s126-faturali-kart'ın L14 beklentileri S128 A gereği değişir (bakım 11'de SK-25 ile susuyordu — KARARLAR.md §23 Y11-9 → §24 Y12-2 / Y12-3 (i)).
L14 = kararın örneği AYNEN: 01.03 stok veresiye satışı S 400 · 02.03 X 300 · 15.03 kart 700 (2 × 350) · 10.04 kart tahsilatı 300 ⇒ S açığı 100 (kâhinde anahtar yok), X Kalan 300; bakiye 400, kart kalanı 400.
Adımlar DEĞİŞMEZ; öbür beklentiler (L1 … L13c, L15 … L18) DEĞİŞMEZ. Açıklamadaki L12 notu (Y11-7 "baş mimarın değerlendirmesine") Y12-11 gereği kalkar. Bütün yeni değerler ELLE — kâhin koşulmadan.
Kullanım: python3 -I d37-guncelle12.py <d37 dosyası>"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bicim  # noqa: E402

p = sys.argv[1]
with open(p, encoding="utf-8") as f:
    s = json.load(f)
K = "k1"
ESKI_YOK = {"k1:cari:L14:gecikmis", "k1:kart:KL14:kalan", "k1:hareket:l14x:kalan", "k1:takvim:hareket:l14x"}
assert ESKI_YOK <= set(s["elleYok"]), "d37 bakım 11 hâlinde değil"
s["elleYok"] = [k for k in s["elleYok"] if k not in ESKI_YOK]
eski_bel = [["cari L14 tanımsız", "SK-25", "KULLANICIYA SORULMALI"]]
assert all(b in s["elleBelirsiz"] for b in eski_bel)
s["elleBelirsiz"] = [b for b in s["elleBelirsiz"] if b not in eski_bel]


def yok3(h):
    return {"%s:takvim:hareket:%s" % (K, h): "yok", "%s:vadeTakip:hareket:%s" % (K, h): "yok", "%s:projeksiyon:hareket:%s" % (K, h): "yok"}


def kart(no, toplam, odenen, taksitler):
    b = {"%s:kart:%s:var" % (K, no): True, "%s:kart:%s:toplam" % (K, no): toplam, "%s:kart:%s:odenen" % (K, no): odenen, "%s:kart:%s:kalan" % (K, no): toplam - odenen,
         "%s:kart:%s:mevcutBorc" % (K, no): True}
    for i, v in enumerate(taksitler):
        b["%s:kart:%s:taksit%d:odenen" % (K, no, i + 1)] = v
    return b


yeni = {}
# L14 — kararın örneği AYNEN (S128 A, Y12-2): içine alma sırası S (01.03) → X (02.03); P = 300 (taksit 1'e — kart tahsilatının bağı) ⇒ S 0 + 400 − 300 = 100, X Kalan 0 + 300 − 0 = 300.
#   gecikmiş: taksit 1'in kalanı 350 − 300 = 50 (01.04 < 15.04); bakiye 700 − 300 = 400; kart 700 / 300 ([300, 0]) — kart kalanı 400 (kararın parantezi).
#   acikToplam (KS8.1 — stok veresiyesi toplamda yok; Y12-10) = X 300 ≠ 400 → false. NOT (6): S 100 + X 300 = 400 = bakiye. X kuyrukta 0 → takvim / Vade Takip / projeksiyon yok.
assert 10000 + 30000 == 40000
yeni.update({"k1:cari:L14:gecikmis": 5000, "k1:cari:L14:acikToplam": 30000, "k1:cari:L14:acikEsitBakiye": False, "k1:hareket:l14x:kalan": 30000})
yeni.update(yok3("l14x"))
yeni.update(kart("KL14", 70000, 30000, [30000, 0]))
cakisan = {k: (s["elleBeklenen"][k], v) for k, v in yeni.items() if k in s["elleBeklenen"] and s["elleBeklenen"][k] != v}
assert not cakisan, cakisan  # bakım 11'in yazdığı L14 değerleri (bakiye 400, kart tutarı 700) aynen
eklenen = [k for k in yeni if k not in s["elleBeklenen"]]
s["elleBeklenen"].update(yeni)
for eski_ac, yeni_ac in (("stok veresiye satışlı kart (L14 SUS — SK-25)", "stok veresiye satışlı kart (L14 — bakım 12 S128 A: kararın örneği, değer)"),
                         ("yalnız faturalar (L12 — baş mimarın değerlendirmesine)", "yalnız faturalar (L12 — Y11-7; bakım 12 Y12-11: not kalktı)")):
    assert eski_ac in s["aciklama"], eski_ac
    s["aciklama"] = s["aciklama"].replace(eski_ac, yeni_ac)
s["dayanak"] = s["dayanak"] + "; §24 (S128 A — L14)"
bicim.yaz(p, s)
print("d37: %d elleYok + %d elleBelirsiz kalktı, %d elle değer eklendi (L14); toplam %d elle denetim" % (
    len(ESKI_YOK), len(eski_bel), len(eklenen), len(s["elleBeklenen"]) + len(s["elleYok"]) + len(s["elleBelirsiz"])))
