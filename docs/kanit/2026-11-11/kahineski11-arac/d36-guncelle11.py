#!/usr/bin/env python3
"""Bakım 11: d36-c5-s122-kart-odemesi'nin J13 beklentileri S126 A gereği değişir (bakım 10'da C13.4 (7) / (11) "birden çok kalemi tüketti" ile susuyordu — SK-24; KARARLAR.md §23 Y11-2).
J13 = kararın örneği AYNEN: 01.03 F 600 · 02.03 X 300 · 15.03 kart 900 · 10.04 kart tahsilatı 300 ⇒ F açık 300, X Kalan 300. Adımlar DEĞİŞMEZ; öbür beklentiler (J1 … J12b, J14 … J17b) DEĞİŞMEZ.
Bütün yeni değerler ELLE — kâhin koşulmadan, karar metninden.
Kullanım: python3 -I d36-guncelle11.py <d36 dosyası>"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bicim  # noqa: E402

p = sys.argv[1]
with open(p, encoding="utf-8") as f:
    s = json.load(f)
K = "k1"
ESKI_YOK = {"k1:cari:J13:gecikmis", "k1:kart:KJ13:kalan", "k1:hareket:j13x:kalan", "k1:takvim:hareket:j13x", "k1:fatura:J13F:acik"}
assert ESKI_YOK <= set(s["elleYok"]), "d36 bakım 10 hâlinde değil"
s["elleYok"] = [k for k in s["elleYok"] if k not in ESKI_YOK]
eski_bel = [["cari J13 tanımsız", "birden çok kalemi tüketti"]]
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
# J13 — kararın örneği AYNEN (S126 A, Y11-2): kartın içine alma sırası F (01.03) → X (02.03); P = 300 (taksit 1) ⇒ F açık 0 + 600 − 300 = 300, X Kalan 0 + 300 − 0 = 300.
#   gecikmiş 0 (F, X kuyrukta 0; taksit 1 ödendi; taksit 2 01.05); bakiye 600 = açık (300 + 300). F kartın tamamen içinde → takvim kalemi değil (Y11-10); X takvim / Vade Takip / projeksiyon yok.
yeni.update({"k1:cari:J13:gecikmis": 0, "k1:cari:J13:acikToplam": 60000, "k1:cari:J13:acikEsitBakiye": True,
             "k1:fatura:J13F:acik": 30000, "k1:takvim:fatura:J13F": "yok", "k1:hareket:j13x:kalan": 30000})
yeni.update(yok3("j13x"))
yeni.update(kart("KJ13", 90000, 30000, [30000, 0, 0]))
cakisan = {k: (s["elleBeklenen"][k], v) for k, v in yeni.items() if k in s["elleBeklenen"] and s["elleBeklenen"][k] != v}
assert not cakisan, cakisan  # bakım 10'un yazdığı J13 değerleri (bakiye 600, kart tutarı 900) aynen
eklenen = [k for k in yeni if k not in s["elleBeklenen"]]
s["elleBeklenen"].update(yeni)
eski_ac = "O = T karışık kart (J13 susar)"
assert eski_ac in s["aciklama"]
s["aciklama"] = s["aciklama"].replace(eski_ac, "O = T faturalı kart (J13 — bakım 11 S126 A: kararın örneği, değer)")
s["dayanak"] = s["dayanak"] + "; §23 (S126 A — J13)"
bicim.yaz(p, s)
print("d36: %d elleYok + %d elleBelirsiz kalktı, %d elle değer eklendi (J13); toplam %d elle denetim" % (
    len(ESKI_YOK), len(eski_bel), len(eklenen), len(s["elleBeklenen"]) + len(s["elleYok"]) + len(s["elleBelirsiz"])))
